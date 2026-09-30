import {createContext, useContext, useEffect, type ReactNode} from 'react'
import {Link, useSearchParams} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useAnosLectivos} from './anos-lectivos/anos-lectivos.api'

type AcademicYearContextValue = {
  yearId: string
  yearToken: string
  years: {id: string; url_token: string; legacy_url_token?: string; nombre: string; estado: string}[]
  setYearId: (id: string) => void
  setYearToken: (token: string) => void
  writable: boolean
}

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null)

export function AcademicYearProvider({children}: {children: ReactNode}) {
  const {data} = useAnosLectivos()
  const [params, setParams] = useSearchParams()
  const years = data?.data ?? []
  const requested = params.get('ano')
  const selected = years.find(item => item.url_token === requested || item.legacy_url_token === requested || String(item.id) === requested)
    ?? years.find(item => item.estado === 'en_curso')
    ?? years.find(item => item.estado === 'planificado')
    ?? years[0]
  const yearId = selected ? String(selected.id) : ''
  const yearToken = selected?.url_token ?? ''
  useEffect(() => {
    if (!selected || requested === selected.url_token) return
    const next = new URLSearchParams(params)
    next.set('ano', selected.url_token)
    setParams(next, {replace: true})
  }, [selected, requested, params, setParams])
  const setYearId = (id: string) => {
    const year = years.find(item => String(item.id) === id)
    if (!year) return
    const next = new URLSearchParams(params)
    next.set('ano', year.url_token)
    setParams(next)
  }
  const setYearToken = (token: string) => {
    const year = years.find(item => item.url_token === token)
    if (!year) return
    const next = new URLSearchParams(params)
    next.set('ano', year.url_token)
    setParams(next)
  }

  return <AcademicYearContext.Provider value={{yearId, yearToken, years, setYearId, setYearToken,
    writable: !!selected && !['cerrado', 'archivado'].includes(selected.estado)}}>{children}</AcademicYearContext.Provider>
}

// Context and its hook intentionally live together so every annual view uses one selector.
// eslint-disable-next-line react-refresh/only-export-components
export function useAcademicYear() {
  const value = useContext(AcademicYearContext)
  if (!value) throw new Error('La vista académica requiere un año lectivo.')
  return value
}

export function AcademicYearPicker() {
  const {yearToken, years, setYearToken} = useAcademicYear()
  const intl = useIntl()
  return <select className='form-select form-select-solid w-auto' aria-label={intl.formatMessage({id: 'common.field.anoLectivo'})} value={yearToken}
    onChange={event => setYearToken(event.target.value)} disabled={!years.length}>
    {years.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}
  </select>
}

export function AcademicYearCell({yearId}: {yearId: string | number | null | undefined}) {
  const {years} = useAcademicYear()
  const name = years.find(item => String(item.id) === String(yearId) || item.url_token === yearId)?.nombre
  return <td>{name ?? '—'}</td>
}

export function AcademicYearContent({children, disableActions = true}: {children: ReactNode; disableActions?: boolean}) {
  const {yearId, writable} = useAcademicYear()
  const intl = useIntl()
  if (!yearId) return <div className='alert alert-info'>
    {intl.formatMessage({id: 'academico.anos.annual.noYear'})}{' '}
    <Link to='/academico/anos-lectivos'>{intl.formatMessage({id: 'academico.anos.new'})}</Link>
  </div>
  return <>
    {!writable && <div className='alert alert-info'>{intl.formatMessage({id: 'academico.anos.annual.readOnly'})}</div>}
    {disableActions
      ? <fieldset disabled={!writable} className='border-0 p-0 m-0 w-100'>{children}</fieldset>
      : children}
  </>
}
