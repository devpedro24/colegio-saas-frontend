import {useIntl} from 'react-intl'
import {useState, type FormEvent} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {Modal} from 'react-bootstrap'
import {Navigate} from 'react-router-dom'
import {PageTitle} from '@/_metronic/layout/core'
import {Content} from '@/_metronic/layout/components/content'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {api} from '@/lib/api/client'
import {getMailLabels, type PlatformMailRequest} from '../../academico/configuracion/schoolMail.types'

type RequestList = {data: PlatformMailRequest[]; meta: {current_page: number; last_page: number; total: number; per_page: number}}

export default function SchoolMailRequestsPage() {
  const {isPlatform} = useAuthz()
  const {activeColegio} = useImpersonation()
  if (!isPlatform || activeColegio) return <Navigate to='/dashboard' replace />
  return <RequestsContent />
}

function RequestsContent() {
  const intl = useIntl()
  const {mailActionLabels, mailRequestLabels} = getMailLabels(intl)
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const qc = useQueryClient()
  const [state, setState] = useState<'pendiente' | 'todas'>('pendiente'), [page, setPage] = useState(1)
  const [selected, setSelected] = useState<PlatformMailRequest | null>(null), [decision, setDecision] = useState<'aprobar' | 'rechazar'>('aprobar')
  const [observation, setObservation] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const query = useQuery({queryKey: ['school-mail-requests', 'list', state, page],
    queryFn: () => api.get<RequestList>(`/platform/correo-solicitudes?estado=${state}&page=${page}`), refetchOnWindowFocus: true})
  const selectedCurrent = query.data?.data.find(row => row.url_token === selected?.url_token)
  const selectedIsPending = selectedCurrent?.estado === 'pendiente'
  const observationLength = observation.trim().length
  const validObservation = (decision === 'aprobar' && observationLength === 0) || (observationLength >= 10 && observationLength <= 1000)
  const canResolve = !busy && !query.isError && selectedIsPending && selectedCurrent?.disponible === true && validObservation
  async function resolve(e: FormEvent) {
    e.preventDefault()
    if (!canResolve || !selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.post<{data: PlatformMailRequest}>(`/platform/correo-solicitudes/${encodeURIComponent(selected.url_token)}/resolver`,
        {decision, ...(observation.trim() ? {observacion: observation.trim()} : {})}, {notifyLocalChange: false})
      setSelected(null); setObservation('')
      setNotice(t('schoolMail.requestResolved', {status: mailRequestLabels[result.data.estado].toLocaleLowerCase(intl.locale)}))
    } catch(cause) {setError(cause instanceof Error ? cause.message : t('intake.ui.theRequestCouldNotBeResolved'))}
    finally {await qc.invalidateQueries({queryKey: ['school-mail-requests']}); setBusy(false)}
  }
  function choose(row: PlatformMailRequest, next: 'aprobar' | 'rechazar') {
    setSelected(row); setDecision(next); setObservation(''); setError(''); setNotice('')
  }
  return <>
    <PageTitle>{t('intake.ui.emailConnectionRequests')}</PageTitle>
    <Content>
      <div className='card'>
        <div className='card-header align-items-center gap-4 py-5'>
          <div><h2 className='fs-3 mb-2'>{t('intake.ui.emailConnectionRequests')}</h2><p className='text-muted mb-0'>{t('intake.ui.eachApprovalAuthorizesTheRequestingPrincipalFor24HoursAndOneAction')}</p></div>
          <div className='d-flex flex-wrap align-items-center gap-3'>
            <label htmlFor='mail-requests-filter'>{t('intake.ui.status')}</label>
            <select id='mail-requests-filter' className='form-select w-auto' value={state} disabled={busy} onChange={e => {setState(e.target.value === 'todas' ? 'todas' : 'pendiente'); setPage(1)}}>
              <option value='pendiente'>{t('intake.ui.pendingRequests')}</option><option value='todas'>{t('intake.ui.allRequests')}</option>
            </select>
            <button className='btn btn-light' disabled={query.isFetching || busy} onClick={() => void qc.invalidateQueries({queryKey: ['school-mail-requests']})}>{t('intake.ui.refreshRequests')}</button>
          </div>
        </div>
        <div className='card-body'>
          {(error || query.error) && <div className='alert alert-danger' role='alert'>{error || query.error?.message}</div>}
          {notice && <div className='alert alert-success' role='status'>{notice}</div>}
          {query.isPending ? <p role='status'>{t('intake.ui.loadingRequests')}</p> : query.data && <>
            {query.data.data.length === 0 ? <p>{t('intake.ui.thereAreNoRequestsWithThisStatus')}</p> : <ul className='list-unstyled mb-0' aria-label={t('intake.ui.emailRequests')}>
              {query.data.data.map(row => <li key={row.url_token} className='border rounded p-5 mb-4 text-break' data-testid='mail-request-row'>
                <div className='d-flex flex-wrap justify-content-between gap-3 mb-3'><h3 className='fs-5 mb-0'>{row.colegio.nombre}</h3><span className={`badge badge-light-${row.estado === 'rechazada' ? 'danger' : row.estado === 'pendiente' ? 'warning' : row.estado === 'aprobada' ? 'success' : 'secondary'}`}>{mailRequestLabels[row.estado]}</span></div>
                <p className='mb-2'><strong>{mailActionLabels[row.accion]}</strong> · {row.colegio.slug}</p>
                <p className='mb-2'>{t('intake.ui.requestedBy')}{' '}{row.solicitante}</p>
                <p className='mb-2'>{t('intake.ui.reason')}{' '}{row.motivo}</p>
                {row.observacion && <p className='mb-2'>{t('intake.ui.comment')}{' '}{row.observacion}</p>}
                <p className='text-muted mb-2'>{t('intake.ui.created')}{' '}{new Date(row.creada_en).toLocaleString(intl.locale)}{row.vence_en && t('schoolMail.expiresAt', {date: new Date(row.vence_en).toLocaleString(intl.locale)})}</p>
                {row.disponible === false && <p className='text-danger mb-2' role='status'>{t('intake.ui.schoolTemporarilyUnavailable')}</p>}
                {row.estado === 'pendiente' && <div className='d-flex flex-wrap gap-3 mt-4'>
                  <button className='btn btn-sm btn-primary' disabled={busy || query.isError || row.disponible !== true} onClick={() => choose(row, 'aprobar')}>{t('intake.ui.approve')}</button>
                  <button className='btn btn-sm btn-light-danger' disabled={busy || query.isError || row.disponible !== true} onClick={() => choose(row, 'rechazar')}>{t('intake.ui.reject')}</button>
                </div>}
              </li>)}
            </ul>}
            <nav aria-label={t('intake.ui.requestPages')} className='d-flex flex-wrap align-items-center justify-content-between gap-3 mt-5'>
              <span>{t('schoolMail.pagination', {count: query.data.meta.total, page: query.data.meta.current_page, total: query.data.meta.last_page})}</span>
              <div className='d-flex gap-3'><button className='btn btn-sm btn-light' disabled={busy || query.isFetching || page <= 1} onClick={() => setPage(value => value - 1)}>{t('intake.ui.previous')}</button><button className='btn btn-sm btn-light' disabled={busy || query.isFetching || page >= query.data.meta.last_page} onClick={() => setPage(value => value + 1)}>{t('intake.ui.next')}</button></div>
            </nav>
          </>}
        </div>
      </div>
      <Modal show={!!selected} onHide={() => {if (!busy) setSelected(null)}} centered aria-labelledby='resolve-mail-title'>
        <Modal.Header closeButton={!busy} closeLabel={t('intake.ui.close')}><Modal.Title id='resolve-mail-title'>{decision === 'aprobar' ? t('intake.ui.approveApplication') : t('intake.ui.rejectApplication')}</Modal.Title></Modal.Header>
        <form onSubmit={e => void resolve(e)}>
          <Modal.Body>
            {error && <div role='alert' className='alert alert-danger'>{error}</div>}
            {selected && <><p className='text-break'>{selected.colegio.nombre} · {mailActionLabels[selected.accion]}</p><p className='text-break'>{selected.motivo}</p></>}
            {decision === 'aprobar' && <p>{t('intake.ui.youWillAuthorizeOneActionWithinTheNext24HoursThePrincipal')}</p>}
            {!selectedIsPending && <p role='alert'>{t('intake.ui.thisRequestIsNoLongerPendingInTheCurrentListRefreshThe')}</p>}
            {selectedCurrent?.disponible === false && <p role='alert'>{t('intake.ui.schoolTemporarilyUnavailable')}</p>}
            <label htmlFor='mail-resolution-observation' className='form-label'>{decision === 'rechazar' ? t('intake.ui.rejectionReason10To1000Characters') : t('intake.ui.commentOptional10To1000CharactersIfProvided')}</label>
            <textarea id='mail-resolution-observation' className='form-control' value={observation} disabled={busy} required={decision === 'rechazar'} minLength={10} maxLength={1000} onChange={e => setObservation(e.target.value)} />
            <p className='text-muted mt-3'>{t('intake.ui.doNotIncludeKeysOrPasswordsInYourComment')}</p>
          </Modal.Body>
          <Modal.Footer><button type='button' className='btn btn-light' disabled={busy} onClick={() => setSelected(null)}>{t('intake.ui.cancel')}</button><button className={`btn ${decision === 'aprobar' ? 'btn-primary' : 'btn-danger'}`} disabled={!canResolve}>{busy ? t('intake.ui.saving') : decision === 'aprobar' ? t('intake.ui.confirmApproval') : t('intake.ui.confirmRejection')}</button></Modal.Footer>
        </form>
      </Modal>
    </Content>
  </>
}
