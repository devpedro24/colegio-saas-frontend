import type {QueryClient, Query} from '@tanstack/react-query'
import type {AcademicPaged} from '@/app/pages/academico/estructura/estructura.api'

// Private, tab-local data. Context/logout clears the QueryClient; never persist
// these responses in browser storage. Realtime changes invalidate dependencies.
export const academicCacheRoots = [
  'anos-lectivos', 'estructura', 'plan-estudios', 'horarios', 'siee', 'preinformes', 'config',
  'academic-options', 'academic-options-all', 'eventos-catalogo',
] as const

export function configureAcademicCache(client: QueryClient) {
  for (const root of academicCacheRoots) {
    client.setQueryDefaults([root], {staleTime: Infinity, gcTime: 30 * 60_000})
  }
}

/** A complete, unfiltered table can also supply a selector. Never mistake a
 * searched page (or a first page out of many) for the full catalog. */
export function completeAcademicPage<T>(client: QueryClient, prefix: readonly unknown[]): AcademicPaged<T> | undefined {
  for (const query of client.getQueryCache().findAll({queryKey: prefix})) {
    const [search, filters, , page] = query.queryKey.slice(prefix.length)
    if (query.queryKey.length !== prefix.length + 4 || search !== '' || page !== 1
      || !filters || typeof filters !== 'object' || Object.values(filters).some(Boolean)) continue
    const result = query.state.data as AcademicPaged<T> | undefined
    if (query.state.status === 'success' && !query.state.isInvalidated && query.state.fetchStatus === 'idle'
      && result?.meta?.current_page === 1 && result.data.length === result.meta.total) return result
  }
}

/** Track fetch START, not completion: a pre-write response is not fresh even
 * if it finishes after the write. This coalesces hook + realtime invalidation. */
export function trackQueryReads(client: QueryClient) {
  let revision = 0
  const started = new WeakMap<Query, number>()
  const unsubscribe = client.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'fetch') {
      started.set(event.query, ++revision)
    }
  })
  return {
    checkpoint: () => ++revision,
    needsRefresh: (query: Query, change: number) => (started.get(query) ?? 0) <= change,
    unsubscribe,
  }
}
