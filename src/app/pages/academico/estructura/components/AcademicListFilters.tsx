import type {ReactNode} from 'react'
import {useIntl} from 'react-intl'

type Props = {
  id?: string
  search: string
  onSearchChange: (value: string) => void
  children?: ReactNode
}

export function AcademicListFilters({id, search, onSearchChange, children}: Props) {
  const intl = useIntl()
  return <div className='d-flex flex-wrap align-items-center gap-3 mb-5'>
    <input
      id={id}
      type='search'
      className='form-control form-control-solid w-auto flex-grow-1 mw-350px'
      aria-label={intl.formatMessage({id: 'academic.pagination.search'})}
      placeholder={intl.formatMessage({id: 'academic.pagination.search'})}
      value={search}
      onChange={event => onSearchChange(event.target.value)}
    />
    {children}
  </div>
}
