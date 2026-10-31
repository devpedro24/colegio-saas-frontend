import {useCallback, useEffect} from 'react'
import {createSearchParams, useHref, useLocation, useSearchParams, type SetURLSearchParams} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'

const fields = ['ano', 'grupo', 'materia', 'asignacion', 'periodo', 'grado']
export function publicAcademicSearch(params: URLSearchParams): URLSearchParams {
  const result = new URLSearchParams()
  for (const field of fields) {
    const value = params.get(field)
    if (value && /^[A-Za-z0-9_-]{24}$/.test(value)) result.set(field, value)
  }
  return result
}

/** Only opaque selectors, in session memory. Explicit URL filters take precedence. */
export function useAcademicSearchParams(scope?: string) {
  const [url, setUrl] = useSearchParams()
  const routePath = useHref({pathname: useLocation().pathname})
  const client = useQueryClient()
  const key = ['academic-search-filters', scope]
  const params = new URLSearchParams(url)
  if (scope && !fields.some(field => url.has(field))) {
    new URLSearchParams(client.getQueryData<string>(key)).forEach((value, field) => params.set(field, value))
  }
  const search = params.toString()
  const urlSearch = url.toString()
  const remember = useCallback((next: URLSearchParams) => {
    if (!scope) return
    client.setQueryDefaults(['academic-search-filters'], {gcTime: Infinity, staleTime: Infinity})
    client.setQueryData(['academic-search-filters', scope], publicAcademicSearch(next).toString())
  }, [client, scope])
  useEffect(() => {
    remember(new URLSearchParams(search))
    if (search !== urlSearch && window.location.pathname === routePath) setUrl(search, {replace: true})
  }, [search, urlSearch, remember, setUrl, routePath])
  const update: SetURLSearchParams = useCallback((next, options) => {
    // Browser history changes before React commits a navigation. A late default-
    // selection effect from the previous page must not navigate back to it.
    if (window.location.pathname !== routePath) return
    const current = new URLSearchParams(search)
    const resolved = createSearchParams(typeof next === 'function' ? next(current) : next)
    remember(resolved)
    setUrl(resolved, options)
  }, [search, remember, setUrl, routePath])
  return [params, update] as const
}
