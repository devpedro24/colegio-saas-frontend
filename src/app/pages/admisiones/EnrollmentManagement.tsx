import {useState} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {Link, useNavigate, useSearchParams} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useToast} from '@/lib/ui/toast'
import {AcademicPageHeader} from '@/app/shared/components/AcademicPageHeader'
import {CampaignPreview} from './CampaignPreview'
import EnrollmentRoster from './EnrollmentRoster'
import {EnrollmentApplication} from './EnrollmentApplication'
import {enrollmentSettingsPath, useEnrollmentScope} from './enrollmentSettings.api'
import {IntakeIcon, IntakeModal, IntakeNotice, IntakePayments} from './IntakeUI'
import {studentName, useIntakeText} from './intakeWorkflow'
import {
  getCampaignStatus,
  getEnrollmentStates,
  type Allocation,
  type Application,
  type ApplicationsPage,
  type Catalog,
  type Campaign,
} from './ingreso.types'
import './ingreso.css'

type Notice = {
  key: string
  email: string
  asunto: string
  enviada_en?: string
  creada_en: string
  contenido?: string
}
const statusFilters = [
  'pin_pendiente',
  'borrador',
  'enviada',
  'revision',
  'correcciones',
  'validada',
  'espera',
  'aprobada',
  'rechazada',
  'anulada',
  'matriculada',
]

const sectionPaths: Record<string, string> = {applications: 'solicitudes', pins: 'pines', campaigns: 'convocatorias', enrolled: 'matriculas', notifications: 'notificaciones'}

export default function EnrollmentManagement({section = 'applications'}: {section?: string}) {
  const t = useIntakeText(),
    intl = useIntl(),
    toast = useToast(),
    qc = useQueryClient(),
    scope = useEnrollmentScope()
  const {hasPermission} = useAuthz(),
    [params, setParams] = useSearchParams()
  const can = (action: string) => hasPermission(`ingreso.${action}`)
  const states = getEnrollmentStates(intl)
  const navigate = useNavigate()
  const tab = section
  const canEnroll = hasPermission('academico.matriculas.gestionar')
  const canIntake = ['ver', 'configurar', 'revisar', 'decidir', 'asignar'].some(can)
  const [campaign, setCampaign] = useState(''),
    [state, setState] = useState(''),
    [grade, setGrade] = useState('')
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false)
  const [previewCampaign, setPreviewCampaign] = useState<Campaign>()
  const [proposal, setProposal] = useState<{
    asignaciones: Allocation[]
    sin_cupo: number
  }>()
  const catalog = useQuery({
    queryKey: ['ingreso', scope, 'catalogo'],
    enabled: canIntake,
    queryFn: () => api.get<Catalog>('/ingreso/catalogo'),
    staleTime: 30000,
  })
  const activeCampaign = catalog.data?.campanas.find((item) => item.url_token === campaign)
  const listState = tab === 'pins' ? 'pin_pendiente' : state
  const path = campaign ? `/ingreso/campanas/${campaign}/solicitudes` : '/ingreso/solicitudes'
  const list = useQuery({
    queryKey: ['ingreso', scope, 'solicitudes', campaign, listState, grade, query, page],
    enabled: can('ver') && ['applications', 'pins'].includes(tab),
    staleTime: 15000,
    queryFn: () =>
      api.get<ApplicationsPage>(
        `${path}?${new URLSearchParams({page: String(page), estado: listState, grado_token: grade, buscar: query})}`,
      ),
  })
  const applicationToken = params.get('solicitud') ?? ''
  const detail = useQuery({
    queryKey: ['ingreso', scope, 'solicitud', applicationToken],
    enabled: !!applicationToken && can('ver'),
    staleTime: 15000,
    queryFn: () => api.get<{data: Application; grupos: ApplicationsPage['grupos']}>(`/ingreso/solicitudes/${applicationToken}`),
  })
  const notices = useQuery({
    queryKey: ['ingreso', scope, 'notificaciones'],
    enabled: tab === 'notifications' && can('ver'),
    staleTime: 30000,
    queryFn: () => api.get<{data: Notice[]}>('/ingreso/notificaciones'),
  })
  const refresh = () => qc.invalidateQueries({queryKey: ['ingreso', scope]})
  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('failed'))
    } finally {
      setBusy(false)
    }
  }
  const update = async (next: Application) => {
    qc.setQueryData(['ingreso', scope, 'solicitud', next.url_token], {
      ...qc.getQueryData<{data: Application; grupos: ApplicationsPage['grupos']}>(['ingreso', scope, 'solicitud', next.url_token]),
      data: next,
    })
    await Promise.all([
      qc.invalidateQueries({queryKey: ['ingreso', scope, 'solicitudes']}),
      qc.invalidateQueries({queryKey: ['ingreso', scope, 'notificaciones']}),
      qc.invalidateQueries({queryKey: ['ingreso', scope, 'catalogo']}),
      qc.invalidateQueries({queryKey: ['matriculas']}),
    ])
    toast.success(t('saved'))
  }
  const changeTab = (next: string) => {
    navigate(`/admisiones/${sectionPaths[next]}`)
    setPage(1)
    setState('')
  }
  const counts = catalog.data?.conteos ?? list.data?.conteos ?? {}
  const metrics = [
    ['totalApplications', 'files', Object.values(counts).reduce((total, count) => total + Number(count), 0)],
    ['pendingReview', 'file-earmark-check', Number(counts.enviada ?? 0) + Number(counts.revision ?? 0)],
    ['pendingPins', 'ticket-perforated', counts.pin_pendiente ?? 0],
    ['enrolled', 'mortarboard', counts.matriculada ?? 0],
  ] as const
  return (
    <div className='intake-next intake-stack'>
      {previewCampaign && <CampaignPreview name={previewCampaign.nombre} configuration={previewCampaign.configuracion} close={() => setPreviewCampaign(undefined)} />}
      <AcademicPageHeader title={t('managementTitle')} description={t('managementHelp')}>
        <div className='intake-actions ms-auto'>
          <Link className='btn btn-light-info' to='/ingreso' target='_blank' rel='noreferrer'><IntakeIcon name='box-arrow-up-right' />{t('publicAccess')}</Link>
          {can('configurar') && (
            <>
              <button
                className='btn btn-primary'
                disabled={busy || !catalog.data?.anos.length}
                onClick={() => navigate('/admisiones/convocatorias/nueva')}
              >
                <IntakeIcon name='plus-lg' />
                {t('newCampaign')}
              </button>
              <Link className='btn btn-light-primary' to={enrollmentSettingsPath}>
                <IntakeIcon name='gear' />
                {t('enrollmentSettings')}
              </Link>
            </>
          )}
        </div>
      </AcademicPageHeader>
      {(catalog.error || list.error || detail.error || notices.error) && (
        <IntakeNotice kind='danger'>
          {catalog.error?.message || list.error?.message || detail.error?.message || notices.error?.message}
        </IntakeNotice>
      )}
      {catalog.data?.correo_operativo === false && (
        <IntakeNotice kind='warning'>
          {intl.formatMessage({
            id: 'intake.ui.outgoingEmailIsInTestModeNoPinsOrCredentialsWillBe',
          })}
          {hasPermission('config.correo') && (
            <Link to='/ajustes-institucionales/correo' className='ms-3'>
              {intl.formatMessage({id: 'intake.ui.connectGmailStepByStep'})}
            </Link>
          )}
        </IntakeNotice>
      )}
      {applicationToken ? (
        detail.data ? (
          <EnrollmentApplication
            key={applicationToken}
            application={detail.data.data}
            groups={detail.data.grupos ?? list.data?.grupos ?? []}
            can={can}
            busy={busy}
            run={run}
            update={update}
            back={() => setParams({})}
          />
        ) : (
          <section className='intake-card' role='status'>
            {t('loading')}
          </section>
        )
      ) : (
        <>
          <section className='intake-card'>
            <nav className='intake-tabs' aria-label={t('managementSections')}>
              {[...(can('ver') ? ['applications', 'pins'] : []), ...(canIntake ? ['campaigns'] : []), ...(canEnroll ? ['enrolled'] : []), ...(can('ver') ? ['notifications'] : [])].map((name) => (
                <button
                  key={name}
                  className={tab === name ? 'active' : ''}
                  onClick={() => changeTab(name)}
                >
                  <IntakeIcon
                    name={
                      {
                        applications: 'files',
                        pins: 'ticket-perforated',
                        campaigns: 'calendar-event',
                        notifications: 'envelope',
                        enrolled: 'mortarboard',
                      }[name] ?? 'files'
                    }
                  />
                  {t(name)}
                </button>
              ))}
            </nav>
            {can('ver') && ['applications', 'pins'].includes(tab) && (
              <>
                <form
                  className='intake-filters'
                  onSubmit={(e) => {
                    e.preventDefault()
                    setQuery(search.trim())
                    setPage(1)
                  }}
                >
                  <div className='intake-field'>
                    <label htmlFor='filter-campaign'>{t('campaign')}</label>
                    <select
                      id='filter-campaign'
                      className='form-select form-select-solid'
                      value={campaign}
                      onChange={(e) => {
                        setCampaign(e.target.value)
                        setGrade('')
                        setPage(1)
                      }}
                    >
                      <option value=''>{t('allCampaigns')}</option>
                      {catalog.data?.campanas.map((item) => (
                        <option key={item.url_token} value={item.url_token}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='intake-field'>
                    <label htmlFor='filter-state'>{t('status')}</label>
                    <select
                      id='filter-state'
                      className='form-select form-select-solid'
                      disabled={tab === 'pins'}
                      value={listState}
                      onChange={(e) => {
                        setState(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value=''>{t('allStates')}</option>
                      {statusFilters.map((value) => (
                        <option key={value} value={value}>
                          {states[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='intake-field'>
                    <label htmlFor='filter-grade'>{t('grade')}</label>
                    <select
                      id='filter-grade'
                      className='form-select form-select-solid'
                      value={grade}
                      onChange={(e) => {
                        setGrade(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value=''>{t('allGrades')}</option>
                      {catalog.data?.grados
                        .filter((item) => !activeCampaign || item.ano_token === activeCampaign.ano_token)
                        .map((item) => (
                          <option key={item.token} value={item.token}>
                            {item.nombre} · {catalog.data?.anos.find((year) => year.token === item.ano_token)?.nombre}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className='intake-field'>
                    <label htmlFor='filter-search'>{t('searchStudent')}</label>
                    <div className='input-group'>
                      <input
                        id='filter-search'
                        className='form-control'
                        maxLength={100}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <button className='btn btn-light-info' type='submit' aria-label={t('search')}>
                        <IntakeIcon name='search' />
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </section>
          {can('ver') && (
            <div className='intake-metrics'>
              {metrics.map(([label, icon, count]) => (
                <article key={label}>
                  <IntakeIcon name={icon} />
                  <div>
                    <strong>{count}</strong>
                    <small>{t(label)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
          {tab === 'enrolled' && <EnrollmentRoster embedded />}
          {tab !== 'enrolled' && <section className='intake-card'>
            {can('ver') && ['applications', 'pins'].includes(tab) && (
              <>
                <div className='intake-heading'><h2>{t(tab === 'pins' ? 'pins' : 'applications')}</h2><small className='intake-muted'>{t('resultCount', {count: list.data?.total ?? 0})}</small></div>
                {tab === 'pins' && <IntakeNotice>{t('manualPinHelp')}</IntakeNotice>}
                <div aria-busy={list.isFetching}>
                  <table className='intake-table'>
                    <thead>
                      <tr>
                        <th>{t('reference')}</th>
                        <th>{t('student')}</th>
                        <th>{t('grade')}</th>
                        <th>{t('status')}</th>
                        <th>{t('updatedAt')}</th>
                        <th>{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.data?.data.map((item) => (
                        <tr key={item.url_token}>
                          <td>
                            <small>{item.radicado}</small>
                          </td>
                          <td className='intake-student-cell'>
                            <div className='intake-person'><span className='intake-avatar' aria-hidden='true'>{[item.datos.primer_nombre, item.datos.primer_apellido].map(name => name?.[0] ?? '').join('')}</span><div><strong>{studentName(item)}</strong><small>{item.email}</small></div></div>
                          </td>
                          <td>
                            {catalog.data?.grados.find((candidate) => candidate.token === item.grado_token)?.nombre ??
                              '—'}
                          </td>
                          <td className='intake-status-cell'>
                            <span className='intake-badge' data-status={item.estado}>
                              {states[item.estado]}
                            </span>
                          </td>
                          <td className='intake-updated-cell'><small>{item.actualizada_en ? intl.formatDate(item.actualizada_en, {dateStyle: 'short', timeStyle: 'short', timeZone: catalog.data?.zona_horaria}) : '—'}</small></td>
                          <td className='intake-action-cell'>
                            <button
                              className='btn btn-sm btn-light-primary'
                              disabled={busy}
                              onClick={() => setParams({solicitud: item.url_token})}
                            >
                              <IntakeIcon name='folder2-open' />
                              {t('openApplication')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {list.isPending ? (
                  <p role='status'>{t('loading')}</p>
                ) : (
                  !list.data?.data.length && <p className='intake-muted py-6'>{t('noApplications')}</p>
                )}
                <div className='intake-actions mt-6'>
                  <small className='intake-muted me-auto'>
                    {t('pagination', {
                      page,
                      total: list.data?.last_page ?? 1,
                    })}
                  </small>
                  <button
                    className='btn btn-sm btn-light'
                    disabled={page <= 1 || list.isFetching}
                    onClick={() => setPage(page - 1)}
                  >
                    {t('previous')}
                  </button>
                  <button
                    className='btn btn-sm btn-light'
                    disabled={page >= (list.data?.last_page ?? 1) || list.isFetching}
                    onClick={() => setPage(page + 1)}
                  >
                    {t('next')}
                  </button>
                </div>
              </>
            )}
            {tab === 'campaigns' && (
              <div className='intake-campaign-grid'>
                {catalog.data?.campanas.map((item) => (
                  <article className='intake-document intake-campaign' key={item.url_token}>
                    <div className='intake-heading'>
                      <h2>{item.nombre}</h2>
                      <span className='intake-badge'>{getCampaignStatus(intl, item)}</span>
                    </div>
                    <p className='intake-muted'>
                      {item.apertura_en?.replace('T', ' ') ?? item.desde} —{' '}
                      {item.cierre_en?.replace('T', ' ') ?? item.hasta ?? t('noClosingDate')}
                    </p>
                    <p className='intake-muted'>{t('campaignSummary', {grades: item.configuracion.grados.length, documents: item.configuracion.documentos.length, fields: item.configuracion.campos.length})}</p>
                    <p>{item.configuracion.grados.map((candidate) => candidate.nombre).join(' · ')}</p>
                    <div className='intake-actions'>
                      <button className='btn btn-sm btn-light-info' title={t('previewForm')} onClick={() => setPreviewCampaign(item)}><IntakeIcon name='eye' />{t('previewForm')}</button>
                      <a className='btn btn-sm btn-light-info' href={item.enlace} target='_blank' rel='noreferrer'>
                        <IntakeIcon name='box-arrow-up-right' />
                        {t('publicLink')}
                      </a>
                      <button
                        className='btn btn-sm btn-light'
                        onClick={() =>
                          void run(async () => {
                            await navigator.clipboard.writeText(item.enlace ?? '')
                            toast.success(t('linkCopied'))
                          })
                        }
                      >
                        {t('copyLink')}
                      </button>
                      {can('configurar') && (
                        <>
                          <button className='btn btn-sm btn-light-primary' onClick={() => navigate(`/admisiones/convocatorias/${item.url_token}/editar`)}>
                            {t('configure')}
                          </button>
                          {catalog.data?.anos.some(
                            (year) =>
                              year.nombre >=
                              (catalog.data.anos.find((year) => year.token === item.ano_token)?.nombre ?? ''),
                          ) && (
                            <button
                              className='btn btn-sm btn-light-primary'
                              onClick={() => navigate(`/admisiones/convocatorias/${item.url_token}/reutilizar`)}
                            >
                              {t('reuseCampaign')}
                            </button>
                          )}
                        </>
                      )}
                      {can('asignar') && can('ver') && (
                        <button
                          className='btn btn-sm btn-light-info'
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              setCampaign(item.url_token ?? '')
                              setProposal(
                                await api.post(
                                  `/ingreso/campanas/${item.url_token}/distribuir`,
                                  {confirmar: false},
                                  {notifyLocalChange: false},
                                ),
                              )
                            })
                          }
                        >
                          {t('suggestGroups')}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {catalog.isPending ? (
                  <p role='status'>{t('loading')}</p>
                ) : (
                  !catalog.data?.campanas.length && <IntakeNotice>{t('noCampaignsAdmin')}</IntakeNotice>
                )}
              </div>
            )}
            {tab === 'notifications' && (
              <>
                {notices.isPending ? (
                  <p role='status'>{t('loading')}</p>
                ) : (
                  <>
                    <IntakeNotice>{t('notificationsHelp')}</IntakeNotice>
                    {notices.data?.data.map((notice) => (
                      <article className='intake-document' key={notice.key}>
                        <div className='intake-heading'>
                          <h3>{notice.asunto}</h3>
                          <span className={`intake-badge ${notice.enviada_en ? 'text-success' : ''}`}>
                            {t(notice.enviada_en ? 'delivered' : 'queued')}
                          </span>
                        </div>
                        <p className='intake-muted'>
                          {notice.email} ·{' '}
                          {intl.formatDate(notice.creada_en, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: catalog.data?.zona_horaria,
                          })}
                        </p>
                        {notice.contenido && <p style={{whiteSpace: 'pre-wrap'}}>{notice.contenido}</p>}
                      </article>
                    ))}
                    {!notices.data?.data.length && <p className='intake-muted'>{t('noNotifications')}</p>}
                  </>
                )}
              </>
            )}
          </section>}
          <section className='intake-card'>
            <IntakePayments />
          </section>
        </>
      )}
      {proposal && (
        <IntakeModal
          title={t('confirmEnrollment')}
          close={() => !busy && setProposal(undefined)}
          footer={
            <>
              <button className='btn btn-light' disabled={busy} onClick={() => setProposal(undefined)}>
                {t('cancel')}
              </button>
              <button
                className='btn btn-primary'
                disabled={busy || !proposal.asignaciones.length}
                onClick={() =>
                  void run(async () => {
                    await api.post(
                      `/ingreso/campanas/${campaign}/distribuir`,
                      {confirmar: true, asignaciones: proposal.asignaciones},
                      {notifyLocalChange: false},
                    )
                    setProposal(undefined)
                    await refresh()
                    toast.success(t('saved'))
                  })
                }
              >
                {busy ? t('processing') : t('confirm')}
              </button>
            </>
          }
        >
          <IntakeNotice>{t('credentialsHelp')}</IntakeNotice>
          <ul>
            {proposal.asignaciones.map((pair) => (
              <li key={pair.solicitud_token}>
                {pair.nombre} → {pair.grupo}
              </li>
            ))}
          </ul>
          {proposal.sin_cupo > 0 && (
            <IntakeNotice kind='warning'>{t('withoutCapacity', {count: proposal.sin_cupo})}</IntakeNotice>
          )}
        </IntakeModal>
      )}
    </div>
  )
}
