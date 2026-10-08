import type {ReactNode} from 'react'

type Props = {title: string; description: string; children?: ReactNode}

/** Shared academic card styling; inherits the application's theme and typography. */
export function AcademicPageHeader({title, description, children}: Props) {
  return <header className='card' data-testid='academic-page-header'>
    <div className='card-body d-flex flex-wrap align-items-end justify-content-between gap-4 py-6'>
      <div><h3>{title}</h3><p className='text-muted mb-0'>{description}</p></div>
      {children}
    </div>
  </header>
}
