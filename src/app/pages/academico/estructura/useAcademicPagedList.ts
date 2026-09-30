import {useEffect, useState} from 'react'
import {useQueries, useQuery} from '@tanstack/react-query'
import {usePageSize} from '@/app/shared/hooks/usePageSize'
import type {AcademicPaged} from './estructura.api'
import {getEstructuraPage} from './estructura.api'
import {useAcademicYear} from '../academic-year-context'

/**
 * Server-side paging for academic tables. Small lists use successive requests of
 * the selected size behind "Mostrar más"; numbered pages appear above 20 rows.
 */
export function useAcademicPagedList<T>(options: {
  key: readonly unknown[]
  storageKey: string
  enabled: boolean
  fetchPage: (page: number, perPage: number, search: string, filters: Record<string, string>) => Promise<AcademicPaged<T>>
}) {
  const [pageSize, savePageSize] = usePageSize(options.storageKey)
  const [page, setPage] = useState(1)
  const [visiblePages, setVisiblePages] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const scope = JSON.stringify(options.key)

  useEffect(() => {
    setPage(1)
    setVisiblePages(1)
  }, [scope])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== search) {
        setPage(1)
        setVisiblePages(1)
        setSearch(searchInput)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput, search])

  const key = [...options.key, search, filters, pageSize]
  const query = useQuery({
    queryKey: [...key, page],
    enabled: options.enabled,
    queryFn: () => options.fetchPage(page, pageSize, search, filters),
  })
  const total = query.data?.meta?.total ?? 0
  const extraPages = total <= 20 && page === 1 ? Array.from({length: Math.min(visiblePages - 1, (query.data?.meta?.last_page ?? 1) - 1)}, (_, index) => index + 2) : []
  const extra = useQueries({queries: extraPages.map(nextPage => ({
    queryKey: [...key, nextPage],
    enabled: options.enabled,
    queryFn: () => options.fetchPage(nextPage, pageSize, search, filters),
  }))})
  const rows = [...(query.data?.data ?? []), ...extra.flatMap(result => result.data?.data ?? [])]
  const meta = query.data?.meta

  useEffect(() => {
    if (meta && page > meta.last_page) setPage(Math.max(1, meta.last_page))
  }, [page, meta])

  const setFilter = (name: string, value: string) => {
    setFilters(current => ({...current, [name]: value}))
    setPage(1)
    setVisiblePages(1)
  }
  const changePageSize = (size: number) => {
    savePageSize(size)
    setPage(1)
    setVisiblePages(1)
  }
  return {
    rows, meta, pageSize, page, searchInput, setSearchInput, filters, setFilter,
    isLoading: query.isPending || extra.some(result => result.isPending),
    isError: query.isError || extra.some(result => result.isError),
    isFetching: query.isFetching || extra.some(result => result.isFetching),
    onPageChange: setPage,
    onPerPageChange: changePageSize,
    onLoadMore: () => setVisiblePages(current => Math.min(current + 1, meta?.last_page ?? current)),
  }
}

export function useEstructuraList<T>(entity: 'jornadas' | 'niveles' | 'grados' | 'grupos' | 'bloques-horarios' | 'espacios-fisicos') {
  const {yearId} = useAcademicYear()
  return useAcademicPagedList<T>({
    key: ['estructura', entity, yearId],
    storageKey: `estructura.${entity}`,
    enabled: !!yearId,
    fetchPage: (page, perPage, search, filters) => getEstructuraPage<T>(entity, yearId, {page, perPage, search, filters}),
  })
}
