import {PaginationBar} from './PaginationBar'

export type AcademicPageMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from?: number | null
  to?: number | null
}

type Props = {
  meta?: AcademicPageMeta | null
  visibleCount?: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  onLoadMore?: () => void
  loading?: boolean
}

export function AcademicPagination({meta, onPageChange, onPerPageChange}: Props) {
  if (!meta || meta.total <= 20) return null

  return <PaginationBar
    currentPage={meta.current_page}
    totalPages={meta.last_page}
    total={meta.total}
    perPage={meta.per_page}
    onPageChange={onPageChange}
    onPerPageChange={onPerPageChange}
  />
}
