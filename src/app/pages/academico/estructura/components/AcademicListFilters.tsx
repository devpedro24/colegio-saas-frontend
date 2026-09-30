import type {ReactNode} from 'react'
import {useIntl} from 'react-intl'

type Props = {
  id?: string
  search: string
  onSearchChange: (value: string) => void
  children?: ReactNode
  action?: ReactNode
}

export function AcademicListFilters({id, search, onSearchChange, children, action}: Props) {
  const intl = useIntl()
  return <div className='d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-3 mb-5'>
    <div className='d-flex flex-wrap align-items-center gap-3 flex-grow-1' style={{minWidth: 0}}>
      <input
        id={id}
        type='search'
        className='form-control form-control-solid flex-grow-1 mw-350px'
        style={{minWidth: 180, flexBasis: 220}}
        aria-label={intl.formatMessage({id: 'academic.pagination.search'})}
        placeholder={intl.formatMessage({id: 'academic.pagination.search'})}
        value={search}
        onChange={event => onSearchChange(event.target.value)}
      />
      {children}
    </div>
    {action && <div className='flex-shrink-0 align-self-end align-self-lg-auto ms-lg-auto'>{action}</div>}
  </div>
}
