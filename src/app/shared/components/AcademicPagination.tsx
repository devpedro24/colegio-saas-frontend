import {useId} from 'react'
import {useIntl} from 'react-intl'
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
  visibleCount: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  onLoadMore: () => void
  loading?: boolean
}

const sizes = [5, 10, 20, 50, 100, 1000]

export function AcademicPagination({meta, visibleCount, onPageChange, onPerPageChange, onLoadMore, loading = false}: Props) {
  const intl = useIntl()
  const sizeId = useId()
  if (!meta) return null

  if (meta.total > 20) {
    return <PaginationBar
      currentPage={meta.current_page}
      totalPages={meta.last_page}
      total={meta.total}
      perPage={meta.per_page}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
    />
  }

  return <div className='d-flex align-items-center justify-content-between flex-wrap gap-3 pt-6'>
    <span className='fs-7 fw-semibold text-gray-600'>
      {intl.formatMessage({id: 'shared.pagination.showing'}, {start: meta.total ? 1 : 0, end: Math.min(visibleCount, meta.total), total: meta.total})}
    </span>
    <div className='d-flex align-items-center flex-wrap gap-3'>
      <label className='fs-7 text-gray-600' htmlFor={sizeId}>{intl.formatMessage({id: 'shared.pagination.perPage'})}</label>
      <select id={sizeId} className='form-select form-select-sm form-select-solid w-auto' value={meta.per_page} onChange={event => onPerPageChange(Number(event.target.value))}>
        {sizes.map(size => <option key={size} value={size}>{size}</option>)}
      </select>
      {visibleCount < meta.total && <button type='button' className='btn btn-sm btn-light-primary' disabled={loading} onClick={onLoadMore}>{intl.formatMessage({id: 'shared.pagination.more'})}</button>}
    </div>
  </div>
}
