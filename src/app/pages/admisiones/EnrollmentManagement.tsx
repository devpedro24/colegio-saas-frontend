import {useIntl} from 'react-intl'
import {useState} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {Modal} from 'react-bootstrap'
import {Link} from 'react-router-dom'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {AcademicPageHeader} from '@/app/shared/components/AcademicPageHeader'
import {CampaignEditor} from './CampaignEditor'
import type {Allocation, Application, ApplicationsPage, Campaign, Catalog, DocumentVersion} from './ingreso.types'
import {getEnrollmentStates} from './ingreso.types'
import './ingreso.css'

export default function EnrollmentManagement() {
  const intl = useIntl()
  const states = getEnrollmentStates(intl)
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const {hasPermission} = useAuthz(), {currentUser} = useAuth(), qc = useQueryClient()
  const can = (p: string) => hasPermission(`ingreso.${p}`)
  const scope = currentUser?.tenant_channel ?? 'tenant'
  const [campaign, setCampaign] = useState(''), [filter, setFilter] = useState(''), [page, setPage] = useState(1)
  const [editor, setEditor] = useState<{initial?: Campaign}>(), [detail, setDetail] = useState<Application>()
  const [proposal, setProposal] = useState<{asignaciones: Allocation[]; sin_cupo: number}>()
  const [grade, setGrade] = useState(''), [group, setGroup] = useState(''), [reason, setReason] = useState('')
  const [review, setReview] = useState<DocumentVersion>(), [reviewReason, setReviewReason] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const catalog = useQuery({queryKey: ['ingreso', scope, 'catalogo'], queryFn: () => api.get<Catalog>('/ingreso/catalogo'), staleTime: 30000})
  const active = campaign || catalog.data?.campanas[0]?.url_token || ''
  const selected = catalog.data?.campanas.find(c => c.url_token === active)
  const list = useQuery({queryKey: ['ingreso', scope, active, filter, page], enabled: !!active && can('ver'),
    queryFn: () => api.get<ApplicationsPage>(`/ingreso/campanas/${active}/solicitudes?page=${page}&estado=${filter}`), staleTime: 15000})
  const refresh = () => qc.invalidateQueries({queryKey: ['ingreso', scope]})
  async function run(fn: () => Promise<void>) {setBusy(true); setError(''); setNotice(''); try {await fn()} catch (e) {setError(e instanceof Error ? e.message : t('intake.ui.theOperationCouldNotBeCompleted'))} finally {setBusy(false)}}
  const open = (token: string) => run(async () => {const {data} = await api.get<{data: Application}>(`/ingreso/solicitudes/${token}`); setDetail(data); setReview(undefined); setReviewReason(''); setGrade(data.grado_aprobado_token ?? data.grado_token); setReason(''); setGroup('')})
  const documentsApproved = detail?.campana.configuracion.documentos
    .filter(r => !r.grados.length || r.grados.includes(grade))
    .every(r => {const doc = detail.documentos.find(d => d.requisito === r.key); return doc ? doc.estado === 'aprobado' : !r.obligatorio}) ?? false
  const decision = (state: string) => run(async () => {
    if (!detail) return
    const res = await api.post<{data: Application}>(`/ingreso/solicitudes/${detail.url_token}/decision`, {estado: state, grado_token: grade, observacion: reason}, {notifyLocalChange: false})
    setDetail(res.data); setNotice(t('intake.ui.decisionSavedTheNotificationHasBeenQueued')); await refresh()
  })
  const reviewDoc = (state: string) => run(async () => {
    if (!detail || !review) return
    const res = await api.put<{data: Application}>(`/ingreso/solicitudes/${detail.url_token}/documentos/${review.url_token}`, {estado: state, observacion: reviewReason}, {notifyLocalChange: false})
    setDetail(res.data); setReview(undefined); await refresh()
  })
  return <div className='d-flex flex-column gap-6'>
    <AcademicPageHeader title={t('intake.ui.enrollmentByLink')} description={t('intake.ui.enrollmentRoundsDocumentsDecisionsAndGroupAssignments')}>
      {can('configurar') && <button className='btn btn-primary' disabled={busy || !catalog.data?.anos.length} onClick={() => {setError(''); setEditor({})}}>{t('intake.ui.enrollmentRound')}</button>}
    </AcademicPageHeader>
    {(error || catalog.error || list.error) && <div className='alert alert-danger' role='alert'>{error || catalog.error?.message || list.error?.message}</div>}
    {notice && <div className='alert alert-success' role='status'>{notice}</div>}
    {catalog.data?.correo_operativo === false && <div className='alert alert-warning' role='status'>{t('intake.ui.outgoingEmailIsInTestModeNoPinsOrCredentialsWillBe')}{' '}{hasPermission('config.correo') && <Link to='/ajustes-institucionales/correo'>{t('intake.ui.connectGmailStepByStep')}</Link>}</div>}
    {catalog.isPending ? <p role='status'>{t('intake.ui.loadingEnrollmentRounds')}</p> : <section className='card'><div className='card-body'>
      <div className='row g-3 align-items-end'><div className='col-12 col-sm-6'><label className='form-label fw-semibold' htmlFor='manage-campaign'>{t('intake.ui.enrollmentRoundLabel')}</label><select id='manage-campaign' className='form-select form-select-solid' value={active} onChange={e => {setCampaign(e.target.value); setPage(1); setProposal(undefined)}}>
        <option value=''>{t('intake.ui.select')}</option>{catalog.data?.campanas.map(c => <option key={c.url_token} value={c.url_token}>{c.nombre} · {c.abierta ? t('intake.ui.enabled') : t('intake.ui.closed')}</option>)}</select></div>
        <div className='col-12 col-sm-6'><label className='form-label fw-semibold' htmlFor='manage-filter'>{t('intake.ui.applicationStatus')}</label><select id='manage-filter' className='form-select form-select-solid' value={filter} onChange={e => {setFilter(e.target.value); setPage(1)}}><option value=''>{t('intake.ui.all')}</option>{['borrador','enviada','revision','correcciones','espera','aprobada','rechazada','matriculada'].map(s => <option key={s} value={s}>{states[s]}</option>)}</select></div></div>
      {!catalog.data?.campanas.length && <p className='text-muted mt-5 mb-0'>{t('intake.ui.thereAreNoEnrollmentRoundsYetSetUpGradesDocumentsAndDates')}</p>}
      {selected && <><div className='ingreso-actions'><a className='btn btn-light-primary' href={selected.enlace} target='_blank' rel='noreferrer'>{t('intake.ui.openPublicLink')}</a>
        <button className='btn btn-light' onClick={() => void run(async () => {await navigator.clipboard.writeText(selected.enlace ?? ''); setNotice(t('intake.ui.linkCopied'))})}>{t('intake.ui.copyLink')}</button>
        {can('configurar') && <button className='btn btn-light-warning' onClick={() => {setError(''); setEditor({initial: selected})}}>{t('intake.ui.configure')}</button>}
        {can('asignar') && can('ver') && <button disabled={busy} className='btn btn-light-success' onClick={() => void run(async () => {setProposal(await api.post(`/ingreso/campanas/${active}/distribuir`, {confirmar: false}, {notifyLocalChange: false}))})}>{t('intake.ui.suggestGroupAssignments')}</button>}</div>
        <p className='text-muted mt-4 mb-0'>{selected.hasta ? t('intake.dateRange', {start: selected.desde, end: selected.hasta}) : t('intake.openEnded', {start: selected.desde})}{t('intake.ui.paymentsComingSoon')}</p></>}
    </div></section>}
    {can('ver') && active && <section className='card'><div className='card-header'><h3 className='card-title'>{t('intake.ui.applications')}{' '}{list.data?.total ?? 0}</h3></div><div className='card-body'><div className='table-responsive'><table className='table table-row-dashed align-middle gy-4'><thead><tr className='text-muted fw-bold'><th>{t('intake.ui.referenceNumber')}</th><th>{t('intake.ui.studentEmail')}</th><th>{t('intake.ui.status')}</th><th className='text-end'>{t('intake.ui.review')}</th></tr></thead>
      <tbody>{list.data?.data.map(s => <tr key={s.url_token}><td>{s.radicado}</td><td>{s.datos.primer_nombre} {s.datos.primer_apellido}<div className='text-muted'>{s.email}</div></td><td><span className='badge badge-light-primary'>{states[s.estado]}</span></td><td className='text-end'><button className='btn btn-sm btn-light-primary' disabled={busy} onClick={() => void open(s.url_token)}>{t('intake.ui.viewApplication')}</button></td></tr>)}</tbody></table></div>
      {list.isFetching && <p role='status'>{t('intake.ui.refreshingApplications')}</p>}{!list.isFetching && !list.data?.data.length && <p>{t('intake.ui.noApplicationsMatchThisFilter')}</p>}
      <div className='ingreso-actions'><button className='btn btn-sm btn-light' disabled={page <= 1 || list.isFetching} onClick={() => setPage(page-1)}>{t('intake.ui.previous')}</button><span>{t('intake.page', {page, total: list.data?.last_page ?? 1})}</span><button className='btn btn-sm btn-light' disabled={page >= (list.data?.last_page ?? 1) || list.isFetching} onClick={() => setPage(page+1)}>{t('intake.ui.next')}</button></div>
    </div></section>}
    {editor && catalog.data && <CampaignEditor key={editor.initial?.url_token ?? 'new'} catalog={catalog.data} initial={editor.initial} busy={busy} error={error} close={() => setEditor(undefined)} save={c => void run(async () => {
      const {data} = c.url_token ? await api.put<{data: Campaign}>(`/ingreso/campanas/${c.url_token}`, c, {notifyLocalChange: false}) : await api.post<{data: Campaign}>('/ingreso/campanas', c, {notifyLocalChange: false})
      setEditor(undefined); setCampaign(data.url_token ?? ''); await refresh(); setNotice(t('intake.ui.enrollmentRoundSaved'))
    })} />}
    <Modal show={!!detail} onHide={() => !busy && setDetail(undefined)} size='xl' centered scrollable><Modal.Header closeButton closeLabel={t('intake.ui.close')}><Modal.Title>{t('intake.ui.reviewLabel')}{' '}{detail?.radicado}</Modal.Title></Modal.Header><Modal.Body className='ingreso'>
      {error && <div className='alert alert-danger' role='alert'>{error}</div>}{notice && <div className='alert alert-success' role='status'>{notice}</div>}
      {detail && <><span className='ingreso-status' data-status={detail.estado}>{states[detail.estado]}</span><h3 className='mt-5'>{detail.datos.primer_nombre} {detail.datos.segundo_nombre} {detail.datos.primer_apellido} {detail.datos.segundo_apellido}</h3>
        <div className='ingreso-grid'><p>{t('intake.ui.email')}{' '}{detail.email}</p><p>{t('intake.ui.documentLabel')}{' '}{detail.datos.tipo_documento} {detail.datos.numero_documento}</p><p>{t('intake.ui.dateOfBirth')}{' '}{detail.datos.nacimiento}</p><p>{t('intake.ui.phone')}{' '}{detail.datos.telefono || t('intake.ui.notProvided')}</p><p>{t('intake.ui.address')}{' '}{detail.datos.direccion || t('intake.ui.notSpecified')}</p></div>
        {detail.campana.configuracion.campos.map(f => <p key={f.key}>{f.nombre}: {detail.datos.adicionales?.[f.key] || t('intake.ui.notProvided')}</p>)}
        <h3 className='mt-6'>{t('intake.ui.documentsAndVersions')}</h3>{detail.campana.configuracion.documentos.filter(r => !r.grados.length || r.grados.includes(detail.grado_aprobado_token ?? detail.grado_token)).map(req => {
          const versions = detail.documentos.filter(d => d.requisito === req.key)
          return <section className='ingreso-row' key={req.key}><h4>{req.nombre}{req.obligatorio && ' *'}</h4>{!versions.length && <p>{t('intake.ui.awaitingUpload')}</p>}{versions.map((d,i) => <div className='d-flex flex-wrap align-items-center gap-4 mb-3' key={d.url_token}>
            <a href={`/api/ingreso/solicitudes/${detail.url_token}/documentos/${d.url_token}`}>{d.nombre} · v{d.version}</a><span className='ingreso-status' data-status={d.estado}>{states[d.estado]}</span>{d.observacion && <span>{d.observacion}</span>}
            {i === 0 && can('revisar') && ['enviada','revision','correcciones','espera'].includes(detail.estado) && <button className='btn btn-sm btn-light-primary' onClick={() => {setReview(d); setReviewReason(d.observacion ?? '')}}>{t('intake.ui.reviewDocument')}</button>}</div>)}</section>
        })}
        {review && <section className='ingreso-card mt-4'><h4>{t('intake.ui.reviewDocument')}{' '}{review.nombre}</h4><label htmlFor='document-reason'>{t('intake.ui.commentRequiredToReject')}</label><textarea id='document-reason' className='form-control' maxLength={2000} value={reviewReason} onChange={e => setReviewReason(e.target.value)} /><div className='ingreso-actions'>
          <button className='btn btn-light-success' disabled={busy} onClick={() => void reviewDoc('aprobado')}>{t('intake.ui.approveDocument')}</button><button className='btn btn-light-warning' disabled={busy || !reviewReason.trim()} onClick={() => void reviewDoc('rechazado')}>{t('intake.ui.requestCorrection')}</button><button className='btn btn-light' onClick={() => setReview(undefined)}>{t('intake.ui.cancelReview')}</button></div></section>}
        {can('decidir') && ['enviada','revision','correcciones','espera'].includes(detail.estado) && <section className='ingreso-card mt-6'><h3>{t('intake.ui.enrollmentDecision')}</h3>
          <label htmlFor='approved-grade'>{t('intake.ui.gradeToApprove')}</label><select id='approved-grade' className='form-select' disabled={!can('cambiar_grado')} value={grade} onChange={e => setGrade(e.target.value)}>{detail.campana.configuracion.grados.map(g => <option key={g.token} value={g.token}>{g.nombre}</option>)}</select>
          <label htmlFor='decision-reason' className='mt-4'>{t('intake.ui.reasonComment')}</label><textarea id='decision-reason' className='form-control' maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} />
          <p className='ingreso-help mt-4'>{t('intake.ui.approvalCreatesAStudentAccountAndSendsTemporaryCredentialsTheGroupIs')}</p>
          {can('cambiar_grado') && grade !== (detail.grado_aprobado_token ?? detail.grado_token) && <button className='btn btn-light-warning' disabled={busy || !reason.trim()} onClick={() => void run(async () => {
            const res = await api.put<{data: Application}>(`/ingreso/solicitudes/${detail.url_token}/grado`, {grado_token: grade, observacion: reason}, {notifyLocalChange: false}); setDetail(res.data); await refresh()
          })}>{t('intake.ui.proposeThisGradeAndRequestTheRelevantDocuments')}</button>}
          {(!documentsApproved || detail.estado === 'correcciones') && <p className='ingreso-help'>{t('intake.ui.beforeApprovalDocumentsMustBeApprovedAndTheApplicationMustBeResubmitted')}</p>}
          <div className='ingreso-actions'><button className='btn btn-primary' disabled={busy || !documentsApproved || detail.estado === 'correcciones' || (grade !== detail.grado_token && !reason.trim())} onClick={() => void decision('aprobada')}>{t('intake.ui.approveApplication')}</button>
            {['correcciones','espera','rechazada'].map(s => <button key={s} className='btn btn-light-warning' disabled={busy || !reason.trim()} onClick={() => void decision(s)}>{states[s]}</button>)}</div></section>}
        {can('asignar') && detail.estado === 'aprobada' && <section className='ingreso-card mt-6'><h3>{t('intake.ui.individualAssignment')}</h3><label htmlFor='approved-group'>{t('intake.ui.group')}</label><select id='approved-group' className='form-select' value={group} onChange={e => setGroup(e.target.value)}><option value=''>{t('intake.ui.select')}</option>{list.data?.grupos.filter(g => g.grado_token === detail.grado_aprobado_token).map(g => <option key={g.token} value={g.token}>{g.nombre} {' '}{t('intake.ui.capacity')}{' '}{g.cupo ?? t('intake.ui.unlimited')}</option>)}</select>
          <button className='btn btn-primary mt-4' disabled={busy || !group} onClick={() => setProposal({asignaciones: [{solicitud_token: detail.url_token, nombre: `${detail.datos.primer_nombre} ${detail.datos.primer_apellido}`, grupo_token: group, grupo: list.data?.grupos.find(g => g.token === group)?.nombre ?? ''}], sin_cupo: 0})}>{t('intake.ui.reviewAssignment')}</button></section>}
        <details className='mt-6'><summary>{t('intake.ui.processHistory')}</summary>{detail.historial.map((h,i) => <p key={i}>{h.created_at} · {states[h.evento] ?? t('intake.historyUpdate')} {h.observacion}</p>)}</details>
      </>}
    </Modal.Body><Modal.Footer><button className='btn btn-light' disabled={busy} onClick={() => {setDetail(undefined); setReview(undefined)}}>{t('intake.ui.close')}</button></Modal.Footer></Modal>
    <Modal show={!!proposal} onHide={() => !busy && setProposal(undefined)} size='lg' centered><Modal.Header closeButton closeLabel={t('intake.ui.close')}><Modal.Title>{t('intake.ui.confirmGroupAssignments')}</Modal.Title></Modal.Header><Modal.Body className='ingreso'>
      {error && <div role='alert' className='alert alert-danger'>{error}</div>}<p>{t('intake.ui.reviewTheProposalCapacityIsCheckedAgainOnConfirmationOpeningThisWindow')}</p>
      <ul>{proposal?.asignaciones.map(a => <li key={a.solicitud_token}>{a.nombre} → {a.grupo}</li>)}</ul>{!!proposal?.sin_cupo && <aside>{proposal.sin_cupo} {' '}{t('intake.ui.applicationsRemainPendingBecauseTheGroupsHaveNoAvailablePlaces')}</aside>}
    </Modal.Body><Modal.Footer><button className='btn btn-light' disabled={busy} onClick={() => setProposal(undefined)}>{t('intake.ui.cancel')}</button><button className='btn btn-primary' disabled={busy || !proposal?.asignaciones.length} onClick={() => void run(async () => {
      await api.post(`/ingreso/campanas/${active}/distribuir`, {confirmar: true, asignaciones: proposal?.asignaciones}, {notifyLocalChange: false}); setProposal(undefined); setDetail(undefined); await refresh(); setNotice(t('intake.ui.groupsAssignedAndEnrollmentsConfirmed'))
    })}>{t('intake.ui.confirmEnrollments')}</button></Modal.Footer></Modal>
  </div>
}
