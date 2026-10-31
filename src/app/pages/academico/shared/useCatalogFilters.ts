import {useCallback} from 'react'
import {useAcademicSearchParams} from './useAcademicSearchParams'

type Filters = {ano: string; grupo: string; materia: string; periodo: string}
const token = (value: string | null | undefined) => /^[A-Za-z0-9_-]{24}$/.test(value ?? '') ? value! : ''
export const readCatalogFilters = (params: URLSearchParams): Filters => ({
  ano: token(params.get('ano')), grupo: token(params.get('grupo')), materia: token(params.get('materia')),
  periodo: token(params.get('periodo')),
})

/** Public selectors survive F5 in the URL; private tab memory restores navigation.
 * QueryClient clears at logout/context switch. No browser storage or personal data. */
export function useCatalogFilters(scope: string) {
  const [params, setParams] = useAcademicSearchParams(scope)
  const update = useCallback((changes: Partial<Filters>) => setParams(current => {
    const next = new URLSearchParams(current)
    for (const [field, value] of Object.entries(changes)) {
      const selector = token(value)
      if (selector) next.set(field, selector); else next.delete(field)
    }
    return next
  }, {replace: true}), [setParams])
  return [readCatalogFilters(params), update] as const
}
