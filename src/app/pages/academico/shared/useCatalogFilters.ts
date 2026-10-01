import {useEffect, useCallback} from 'react'
import {useSearchParams} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'

type Filters = {ano: string; grupo: string; materia: string}
const fields = ['ano', 'grupo', 'materia'] as const
const token = (value: string | null | undefined) => /^[A-Za-z0-9_-]{24}$/.test(value ?? '') ? value! : ''
export const readCatalogFilters = (params: URLSearchParams): Filters => ({
  ano: token(params.get('ano')), grupo: token(params.get('grupo')), materia: token(params.get('materia')),
})

/** Public selectors survive F5 in the URL; private tab memory restores navigation.
 * QueryClient clears at logout/context switch. No browser storage or personal data. */
export function useCatalogFilters(scope: string) {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const cached = client.getQueryData<Filters>(['academic-view-filters', scope])
  const selection = fields.some(field => params.has(field)) ? readCatalogFilters(params)
    : cached ?? {ano: '', grupo: '', materia: ''}
  const serialized = JSON.stringify(selection)
  const search = params.toString()
  useEffect(() => {
    const current: Filters = JSON.parse(serialized)
    client.setQueryDefaults(['academic-view-filters'], {gcTime: Infinity, staleTime: Infinity})
    client.setQueryData(['academic-view-filters', scope], current)
    const next = new URLSearchParams(search)
    for (const field of fields) {
      if (current[field]) next.set(field, current[field]); else next.delete(field)
    }
    if (next.toString() !== search) setParams(next, {replace: true})
  }, [client, scope, serialized, search, setParams])
  const update = useCallback((changes: Partial<Filters>) => {
    const next = new URLSearchParams(search)
    const merged = {...JSON.parse(serialized) as Filters, ...changes}
    for (const field of fields) {
      const value = token(merged[field])
      if (value) next.set(field, value); else next.delete(field)
    }
    client.setQueryData(['academic-view-filters', scope], readCatalogFilters(next))
    setParams(next, {replace: true})
  }, [client, scope, serialized, search, setParams])
  return [selection, update] as const
}
