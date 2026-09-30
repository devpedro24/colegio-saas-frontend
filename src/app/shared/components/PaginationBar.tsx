import {type FC, useId} from 'react'
import {useIntl} from 'react-intl'

type Props = {
  currentPage: number
  totalPages: number
  total: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 1000]
const MAX_VISIBLE = 5

function visiblePages(current: number, total: number): number[] {
  const pages: number[] = []
  const half = Math.floor(MAX_VISIBLE / 2)
  let start = Math.max(current - half, 1)
  const end = Math.min(start + MAX_VISIBLE - 1, total)
  if (end - start + 1 < MAX_VISIBLE) {
    start = Math.max(end - MAX_VISIBLE + 1, 1)
  }
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
}

const PaginationBar: FC<Props> = ({
  currentPage,
  totalPages,
  total,
  perPage,
  onPageChange,
  onPerPageChange,
}) => {
  const intl = useIntl()
  const sizeId = useId()
  const startItem = (currentPage - 1) * perPage + 1
  const endItem = Math.min(currentPage * perPage, total)
  const pages = visiblePages(currentPage, totalPages)

  return (
    <div className='d-flex flex-stack flex-wrap pt-6'>
      <div className='fs-7 fw-semibold text-gray-600'>
        {intl.formatMessage(
          {id: 'shared.pagination.showing'},
          {start: startItem, end: endItem, total}
        )}
      </div>

      <div className='d-flex align-items-center justify-content-end flex-wrap gap-3'>
        <label className='fs-7 text-gray-600' htmlFor={sizeId}>
          {intl.formatMessage({id: 'shared.pagination.perPage'})}
        </label>
        <select
          id={sizeId}
          className='form-select form-select-sm form-select-solid w-auto'
          aria-label={intl.formatMessage({id: 'shared.pagination.perPage'})}
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <ul className='pagination pagination-sm mb-0'>
          <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
            <button
              type='button'
              className='page-link'
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <i className='ki-outline ki-double-left fs-7' />
            </button>
          </li>

          {pages[0] > 1 && (
            <>
              <li className='page-item'>
                <button type='button' className='page-link' onClick={() => onPageChange(1)}>1</button>
              </li>
              {pages[0] > 2 && (
                <li className='page-item disabled'><span className='page-link'>...</span></li>
              )}
            </>
          )}

          {pages.map((p) => (
            <li key={p} className={`page-item ${currentPage === p ? 'active' : ''}`}>
              <button type='button' className='page-link' onClick={() => onPageChange(p)} aria-current={currentPage === p ? 'page' : undefined}>{p}</button>
            </li>
          ))}

          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && (
                <li className='page-item disabled'><span className='page-link'>...</span></li>
              )}
              <li className='page-item'>
                <button type='button' className='page-link' onClick={() => onPageChange(totalPages)}>{totalPages}</button>
              </li>
            </>
          )}

          <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
            <button
              type='button'
              className='page-link'
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <i className='ki-outline ki-double-right fs-7' />
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}

export {PaginationBar}
