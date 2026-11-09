import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react'
import {Link, useParams} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useQuery} from '@tanstack/react-query'
import {api, ApiError} from '@/lib/api/client'
import {AuthLayout} from '@/app/modules/auth/AuthLayout'
import LegacyEnrollmentPage, {PhoneField} from './LegacyEnrollmentPage'
import {EnrollmentAddress, type Department} from './EnrollmentAddress'
import {IntakeIcon, IntakeModal, IntakeNotice, IntakePayments} from './IntakeUI'
import {editableElement, studentName, useIntakeText} from './intakeWorkflow'
import {getEnrollmentStates, type Application, type Campaign, type StudentData} from './ingreso.types'

type PublicCatalog = {
  colegio: string
  campanas: Campaign[]
  zona_horaria: string
  limites_envio: {max_file_bytes: number}
}
type View = 'portal' | 'request' | 'access' | 'received' | 'form' | 'status'
const steps = ['personal', 'contact', 'family', 'additional', 'documents', 'send']
const emptyData = (): StudentData => ({pais: 'CO', adicionales: {}})

export default function PublicIntakePage() {
  if (window.location.hash.includes('solicitud=')) return <LegacyEnrollmentPage />
  return <PublicIntake />
}

function PublicIntake() {
  const t = useIntakeText(),
    intl = useIntl(),
    {campaign: routeCampaign} = useParams()
  const states = getEnrollmentStates(intl)
  const catalog = useQuery({
    queryKey: ['ingreso-publico', location.host, 'catalogo'],
    queryFn: () => api.get<PublicCatalog>('/ingreso-publico/catalogo'),
    staleTime: 60000,
    retry: false,
  })
  const [campaignToken, setCampaignToken] = useState<string | undefined>(routeCampaign)
  const campaign = catalog.data?.campanas.find(
    (item) => item.url_token === (campaignToken ?? catalog.data.campanas[0]?.url_token),
  )
  const [application, setApplication] = useState<Application>()
  const [view, setView] = useState<View>('portal'),
    [step, setStep] = useState(0)
  const [data, setData] = useState<StudentData>(emptyData),
    [email, setEmail] = useState(''),
    [grade, setGrade] = useState('')
  const [identityType, setIdentityType] = useState('TI'),
    [identity, setIdentity] = useState(''),
    [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [radicado, setRadicado] = useState('')
  const [consent, setConsent] = useState(false),
    [saved, setSaved] = useState(false),
    [preview, setPreview] = useState<string>()
  const submissionKey = useRef(crypto.randomUUID())
  const savedData = useRef(''),
    saving = useRef<Promise<void> | null>(null)
  const geography = useQuery({
    queryKey: ['ingreso-publico', location.host, 'ubicaciones'],
    queryFn: () => api.get<{data: Department[]}>('/ingreso-publico/ubicaciones'),
    enabled: !!application,
    staleTime: Infinity,
  })
  const apply = useCallback((next: Application) => {
    submissionKey.current = crypto.randomUUID()
    setApplication(next)
    setData({
      pais: 'CO',
      ...next.datos,
      adicionales: next.datos.adicionales ?? {},
    })
    savedData.current = JSON.stringify({
      pais: 'CO',
      ...next.datos,
      adicionales: next.datos.adicionales ?? {},
    })
    setView(next.estado === 'borrador' ? 'form' : 'status')
  }, [])
  useEffect(() => {
    let active = true
    api
      .get<{data: Application}>('/ingreso-publico/solicitud')
      .then((result) => {
        if (active) apply(result.data)
      })
      .catch((e) => {
        if (active && (!(e instanceof ApiError) || e.status !== 401)) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [apply])
  const editable = application && ['borrador', 'correcciones'].includes(application.estado)
  const canEdit = (key: string) =>
    !application ||
    (!['tipo_documento', 'numero_documento'].includes(key) && editableElement(application, `datos.${key}`))
  const update = (key: keyof StudentData, value: string) => {
    setSaved(false)
    setData((current) => ({...current, [key]: value}))
  }
  const saveDraft = useCallback(async () => {
    if (!application || !editable || JSON.stringify(data) === savedData.current) return
    if (saving.current) await saving.current
    const snapshot = JSON.stringify(data)
    const request = api
      .put('/ingreso-publico/solicitud/borrador', {datos: data}, {notifyLocalChange: false})
      .then(() => {
        savedData.current = snapshot
        setSaved(true)
      })
    saving.current = request
    try {
      await request
    } finally {
      saving.current = null
    }
  }, [application, editable, data])
  useEffect(() => {
    if (view !== 'form' || busy || !editable) return
    const timer = setTimeout(() => {
      void saveDraft().catch((e) => setError(e.message))
    }, 1500)
    return () => clearTimeout(timer)
  }, [view, busy, editable, saveDraft])
  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failed'))
    } finally {
      setBusy(false)
    }
  }
  const textField = (key: keyof StudentData, required = false, type = 'text') => (
    <div className='intake-field' key={key}>
      <label className={required ? 'required' : ''} htmlFor={`intake-${key}`}>
        {t(key)}
      </label>
      <input
        id={`intake-${key}`}
        className='form-control'
        type={type}
        required={required}
        maxLength={key === 'direccion' ? 200 : 160}
        value={String(data[key] ?? '')}
        disabled={busy || !canEdit(key)}
        onChange={(event) => update(key, event.target.value)}
      />
    </div>
  )
  const phone = (key: 'telefono' | 'telefono_responsable') => (
    <div className='intake-field' key={key}>
      <PhoneField
        id={`intake-${key}`}
        label={t(key)}
        dialLabel={t('dialCode')}
        otherCountry={t('otherCountry')}
        locale={intl.locale}
        required
        value={data[key] ?? ''}
        disabled={busy || !canEdit(key)}
        onChange={(value) => update(key, value)}
      />
    </div>
  )
  const identityFields = (
    <>
      <div className='intake-field'>
        <label htmlFor='intake-identity-type'>{t('tipo_documento')}</label>
        <select
          id='intake-identity-type'
          className='form-select'
          value={identityType}
          onChange={(e) => setIdentityType(e.target.value)}
        >
          {['RC', 'TI', 'CC', 'CE', 'PASAPORTE', 'OTRO'].map((value) => (
            <option key={value} value={value}>
              {intl.formatMessage({
                id: `intake.documentType.${value}`,
                defaultMessage: value,
              })}
            </option>
          ))}
        </select>
      </div>
      <div className='intake-field'>
        <label className='required' htmlFor='intake-identity'>
          {t('numero_documento')}
        </label>
        <input
          id='intake-identity'
          name='student-identification'
          autoComplete='off'
          className='form-control'
          required
          maxLength={40}
          pattern='[a-zA-Z0-9-]{3,40}'
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
        />
      </div>
    </>
  )
  const documents = application && (
    <div>
      {application.campana.configuracion.documentos
        .filter(
          (requirement) =>
            !requirement.grados.length ||
            requirement.grados.includes(application.grado_aprobado_token ?? application.grado_token),
        )
        .map((requirement) => {
          const versions = application.documentos.filter((document) => document.requisito === requirement.key)
          const latest = versions[0]
          const allowed = editable && editableElement(application, `documentos.${requirement.key}`)
          return (
            <section className='intake-document' key={requirement.key}>
              <h3 className={requirement.obligatorio ? 'required' : ''}>{requirement.nombre}</h3>
              <p className='intake-muted'>{requirement.instrucciones}</p>
              {requirement.vigencia && <p className='intake-muted'>{requirement.vigencia}</p>}
              {latest ? (
                <div className='intake-document-file'>
                  <button
                    type='button'
                    className='btn btn-sm btn-light-info'
                    onClick={() => setPreview(latest.url_token)}
                  >
                    <IntakeIcon name='eye' />
                    {latest.nombre}
                  </button>
                  <span className='intake-badge' data-status={latest.estado}>
                    {states[latest.estado]}
                  </span>
                  <small>{t('version', {number: latest.version})}</small>
                  {latest.observacion && <p>{latest.observacion}</p>}
                </div>
              ) : (
                <p className='intake-muted'>{t('awaitingDocument')}</p>
              )}
              {allowed && (
                <label className='form-label'>
                  {t(latest ? 'replaceDocument' : 'uploadDocument')}
                  <input
                    className='form-control'
                    type='file'
                    disabled={busy}
                    accept={requirement.formatos.map((ext) => `.${ext}`).join(',')}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      void run(async () => {
                        if (file.size > (catalog.data?.limites_envio.max_file_bytes ?? 1_000_000_000))
                          throw new Error(intl.formatMessage({id: 'intake.fileTooLarge'}))
                        await saveDraft()
                        const body = new FormData()
                        body.append('documento', file)
                        body.append('carga_token', crypto.randomUUID())
                        const result = await api.post<{data: Application}>(
                          `/ingreso-publico/documentos/${requirement.key}`,
                          body,
                          {notifyLocalChange: false},
                        )
                        setApplication(result.data)
                      })
                    }}
                  />
                </label>
              )}
              {versions.length > 1 && (
                <details>
                  <summary>{t('previousVersions')}</summary>
                  {versions.slice(1).map((document) => (
                    <p key={document.url_token}>
                      <button
                        type='button'
                        className='btn btn-sm btn-light'
                        onClick={() => setPreview(document.url_token)}
                      >
                        {document.nombre} · {t('version', {number: document.version})}
                      </button>
                    </p>
                  ))}
                </details>
              )}
            </section>
          )
        })}
    </div>
  )
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run(async () => {
      await saveDraft()
      if (step < 5) {
        setStep(step + 1)
        return
      }
      const result = await api.post<{data: Application}>(
        '/ingreso-publico/solicitud',
        {
          datos: data,
          enviar: true,
          consentimiento: consent,
          envio_token: submissionKey.current,
          privacidad_version: application?.campana.privacidad_version,
        },
        {notifyLocalChange: false},
      )
      apply(result.data)
    })
  }
  if (application && !application.pin_manual) return <LegacyEnrollmentPage />
  const errorNotice = (error || catalog.error) && (
    <IntakeNotice kind='danger'>{error || catalog.error?.message}</IntakeNotice>
  )
  const previewModal = preview && (
    <IntakeModal title={t('documentPreview')} close={() => setPreview(undefined)} wide>
      <iframe
        title={t('documentPreview')}
        src={`/api/ingreso-publico/documentos/${preview}?vista=1`}
        style={{width: '100%', height: '65vh', border: 0}}
      />
      <a className='btn btn-light-primary mt-4' href={`/api/ingreso-publico/documentos/${preview}`}>
        {t('download')}
      </a>
    </IntakeModal>
  )
  if (application && (view === 'form' || view === 'status'))
    return (
      <div className='intake-next intake-public-form'>
        <header className='intake-public-brand'>
          <Link to='/auth'>
            <img src='/api/branding/logo' alt='' />
            <span>
              {catalog.data?.colegio}
              <small>{t('admissionsPortal')}</small>
            </span>
          </Link>
          <button
            type='button'
            className='btn btn-light'
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await saveDraft()
                await api.post('/ingreso-publico/salir', {})
                setApplication(undefined)
                setData(emptyData())
                setView('portal')
              })
            }
          >
            {t('exit')}
          </button>
        </header>
        <main className='intake-public-shell intake-stack'>
          {errorNotice}
          <section className='intake-card intake-heading'>
            <div>
              <h1>{t(view === 'form' ? 'applicationForm' : 'applicationStatus')}</h1>
              <p className='intake-muted mb-0'>
                {application.radicado} · {studentName(application)}
              </p>
            </div>
            <span className='intake-badge' data-status={application.estado}>
              {states[application.estado]}
            </span>
          </section>
          {view === 'form' ? (
            <div className='intake-wizard'>
              <aside className='intake-card'>
                <nav className='intake-steps' aria-label={t('formSteps')}>
                  {steps.map((name, index) => (
                    <button
                      type='button'
                      key={name}
                      className={step === index ? 'active' : ''}
                      aria-current={step === index ? 'step' : undefined}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await saveDraft()
                          setStep(index)
                        })
                      }
                    >
                      <span>{index + 1}</span>
                      {t(name)}
                    </button>
                  ))}
                </nav>
                <p className='intake-muted mt-5 mb-0'>{t('serverDraft')}</p>
              </aside>
              <form className='intake-card' onSubmit={submit}>
                <h2>{t(steps[step])}</h2>
                <p className='intake-muted'>{t('requiredHelp')}</p>
                {application.estado === 'correcciones' && (
                  <IntakeNotice kind='warning'>{t('correctionOnly')}</IntakeNotice>
                )}
                <fieldset disabled={busy || !editable}>
                  {step === 0 && (
                    <div className='intake-grid'>
                      {textField('primer_nombre', true)}
                      {textField('segundo_nombre')}
                      {textField('primer_apellido', true)}
                      {textField('segundo_apellido')}
                      {textField('nacimiento', true, 'date')}
                      {textField('tipo_documento', true)}
                      {textField('numero_documento', true)}
                      <div className='intake-field'>
                        <label>{t('email')}</label>
                        <input className='form-control' disabled value={application.email} />
                      </div>
                    </div>
                  )}
                  {step === 1 && (
                    <div className='intake-grid'>
                      {phone('telefono')}
                      <EnrollmentAddress
                        data={data}
                        departments={geography.data?.data ?? []}
                        disabled={busy}
                        editable={canEdit}
                        onChange={(next) =>
                          setData((current) => ({
                            ...current,
                            ...Object.fromEntries(Object.entries(next).filter(([key]) => canEdit(key))),
                          }))
                        }
                      />
                      {geography.error && <IntakeNotice kind='danger'>{geography.error.message}</IntakeNotice>}
                    </div>
                  )}
                  {step === 2 && (
                    <div className='intake-grid'>
                      {textField('madre')}
                      {textField('padre')}
                      {textField('responsable', true)}
                      {textField('parentesco', true)}
                      {phone('telefono_responsable')}
                    </div>
                  )}
                  {step === 3 && (
                    <div className='intake-grid'>
                      {!application.campana.configuracion.campos.length && (
                        <p className='intake-muted'>{t('noAdditional')}</p>
                      )}
                      {application.campana.configuracion.campos.map((field) => (
                        <div className='intake-field' key={field.key}>
                          <label htmlFor={`extra-${field.key}`} className={field.obligatorio ? 'required' : ''}>
                            {field.nombre}
                          </label>
                          {field.tipo === 'seleccion' ? (
                            <select
                              id={`extra-${field.key}`}
                              className='form-select'
                              required={field.obligatorio}
                              disabled={!canEdit(`adicionales.${field.key}`)}
                              value={data.adicionales[field.key] ?? ''}
                              onChange={(e) =>
                                setData({
                                  ...data,
                                  adicionales: {
                                    ...data.adicionales,
                                    [field.key]: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value=''>{t('select')}</option>
                              {field.opciones?.map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          ) : field.tipo === 'telefono' ? (
                            <PhoneField
                              id={`extra-${field.key}`}
                              label={field.nombre}
                              dialLabel={t('dialCode')}
                              otherCountry={t('otherCountry')}
                              locale={intl.locale}
                              required={field.obligatorio}
                              disabled={!canEdit(`adicionales.${field.key}`)}
                              value={data.adicionales[field.key] ?? ''}
                              onChange={(value) =>
                                setData({
                                  ...data,
                                  adicionales: {
                                    ...data.adicionales,
                                    [field.key]: value,
                                  },
                                })
                              }
                            />
                          ) : (
                            <input
                              id={`extra-${field.key}`}
                              className='form-control'
                              required={field.obligatorio}
                              disabled={!canEdit(`adicionales.${field.key}`)}
                              maxLength={1000}
                              type={field.tipo === 'fecha' ? 'date' : field.tipo === 'email' ? 'email' : 'text'}
                              inputMode={field.tipo === 'numero' ? 'numeric' : undefined}
                              pattern={field.tipo === 'numero' ? '[0-9]+' : undefined}
                              value={data.adicionales[field.key] ?? ''}
                              onChange={(e) =>
                                setData({
                                  ...data,
                                  adicionales: {
                                    ...data.adicionales,
                                    [field.key]:
                                      field.tipo === 'numero' ? e.target.value.replace(/\D/g, '') : e.target.value,
                                  },
                                })
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {step === 4 && documents}
                  {step === 5 && (
                    <>
                      <IntakeNotice>{t('submissionHelp')}</IntakeNotice>
                      <p>
                        <strong>{studentName({...application, datos: data})}</strong>
                        <br />
                        {application.email}
                      </p>
                      <h3>{t('privacy')}</h3>
                      <p style={{whiteSpace: 'pre-wrap'}}>{application.campana.configuracion.privacidad}</p>
                      <label className='form-check d-flex gap-3'>
                        <input
                          type='checkbox'
                          required
                          className='form-check-input'
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                        />
                        {t('consent')}
                      </label>
                    </>
                  )}
                </fieldset>
                <div className='intake-wizard-actions'>
                  {step > 0 && (
                    <button type='button' className='btn btn-light' disabled={busy} onClick={() => setStep(step - 1)}>
                      {t('previous')}
                    </button>
                  )}
                  <button
                    type='button'
                    className='btn btn-light-primary'
                    disabled={busy || !editable}
                    onClick={() => void run(saveDraft)}
                  >
                    {t('saveProgress')}
                  </button>
                  <button className='btn btn-primary ms-auto' disabled={busy || !editable}>
                    {busy ? t('processing') : t(step === 5 ? 'submitApplication' : 'continue')}
                  </button>
                </div>
                <p className='intake-save-state' role='status'>
                  {saved ? t('draftSaved') : t('serverDraft')}
                </p>
              </form>
            </div>
          ) : (
            <>
              <section className='intake-card'>
                <h2>{t('nextStep')}</h2>
                <p className='intake-muted'>{t(`status${application.estado}`)}</p>
                {application.observacion && <IntakeNotice>{application.observacion}</IntakeNotice>}
                {application.correcciones
                  ?.filter((entry) => !entry.resuelta)
                  .map((entry) => (
                    <IntakeNotice key={entry.key} kind='warning'>
                      <strong>{entry.motivo}</strong>
                      <br />
                      {t('correctionDeadline', {
                        date: intl.formatDate(entry.hasta, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: catalog.data?.zona_horaria,
                        }),
                      })}
                    </IntakeNotice>
                  ))}
                <div className='intake-actions'>
                  {editable && (
                    <button
                      className='btn btn-primary'
                      onClick={() => {
                        setView('form')
                        setStep(0)
                      }}
                    >
                      {t(application.estado === 'correcciones' ? 'correctApplication' : 'continueForm')}
                    </button>
                  )}
                  <button
                    className='btn btn-light-info'
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await api.get<{data: Application}>('/ingreso-publico/solicitud')
                        apply(result.data)
                      })
                    }
                  >
                    <IntakeIcon name='arrow-clockwise' />
                    {t('refreshStatus')}
                  </button>
                  {application.estado === 'matriculada' && (
                    <Link className='btn btn-primary' to='/auth'>
                      {t('signIn')}
                    </Link>
                  )}
                </div>
              </section>
              <section className='intake-card'>
                <h2>{t('documents')}</h2>
                {documents}
              </section>
              <section className='intake-card'>
                <h2>{t('history')}</h2>
                <ol className='intake-history'>
                  {application.historial.map((event, index) => (
                    <li key={index}>
                      {states[event.evento] ?? intl.formatMessage({id: 'intake.historyUpdate'})}
                      <small>
                        {intl.formatDate(event.created_at, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: catalog.data?.zona_horaria,
                        })}
                      </small>
                      {event.observacion}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
          <section className='intake-card'>
            <IntakePayments />
          </section>
        </main>
        {previewModal}
      </div>
    )
  return (
    <div className='intake-next intake-public-entry'>
      <AuthLayout>
        <div>
          <Link to='/auth' className='btn btn-sm btn-light mb-6'>
            <IntakeIcon name='arrow-left' />
            {t('backToLogin')}
          </Link>
          <div className='d-flex align-items-center gap-4 mb-4'>
            <img src='/api/branding/logo' alt={t('schoolLogo')} width={48} height={48} style={{objectFit: 'contain'}} />
            <h1 className='mb-0'>{t('admissionsPortal')}</h1>
          </div>
          <p className='intake-muted'>{catalog.data?.colegio}</p>
          {errorNotice}
          {catalog.isPending ? (
            <p role='status'>{t('loading')}</p>
          ) : (
            <>
              {view !== 'received' && (
                <div className='intake-field mb-6'>
                  <label htmlFor='public-campaign'>{t('campaign')}</label>
                  <select
                    className='form-select'
                    id='public-campaign'
                    value={campaign?.url_token ?? ''}
                    onChange={(e) => {
                      setCampaignToken(e.target.value)
                      setGrade('')
                    }}
                  >
                    <option value=''>{t('select')}</option>
                    {catalog.data?.campanas.map((item) => (
                      <option key={item.url_token} value={item.url_token}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {view === 'portal' && (
                <>
                  <p className='intake-muted'>{t('portalHelp')}</p>
                  {!campaign && <IntakeNotice kind='warning'>{t(catalog.data?.campanas.length ? 'select' : 'noCampaigns')}</IntakeNotice>}
                  <div className='intake-entry-options'>
                    <button className='btn btn-primary' disabled={!campaign} onClick={() => setView('request')}>
                      <IntakeIcon name='ticket-perforated' />
                      {t('requestPin')}
                    </button>
                    <button
                      className='btn btn-light-primary'
                      onClick={() => {
                        setCampaignToken('')
                        setView('access')
                      }}
                    >
                      {t('havePin')}
                    </button>
                    <button
                      className='btn btn-light-info'
                      onClick={() => {
                        setCampaignToken('')
                        setView('access')
                      }}
                    >
                      {t('applicationStatus')}
                    </button>
                  </div>
                  <IntakeNotice>{t('manualPinHelp')}</IntakeNotice>
                </>
              )}
              {view === 'request' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(async () => {
                      const result = await api.post<{radicado: string}>(
                        `/ingreso-publico/${campaign?.url_token}/iniciar`,
                        {
                          primer_nombre: data.primer_nombre,
                          primer_apellido: data.primer_apellido,
                          email,
                          grado_token: grade,
                          tipo_documento: identityType,
                          numero_documento: identity,
                        },
                      )
                      setRadicado(result.radicado)
                      setView('received')
                    })
                  }}
                >
                  <h2>{t('requestPin')}</h2>
                  <div className='intake-grid'>
                    {textField('primer_nombre', true)}
                    {textField('primer_apellido', true)}
                    {identityFields}
                    <div className='intake-field'>
                      <label className='required' htmlFor='pin-email'>
                        {t('individualEmail')}
                      </label>
                      <input
                        id='pin-email'
                        type='email'
                        className='form-control'
                        required
                        maxLength={255}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className='intake-field'>
                      <label className='required' htmlFor='pin-grade'>
                        {t('grade')}
                      </label>
                      <select
                        id='pin-grade'
                        className='form-select'
                        required
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                      >
                        <option value=''>{t('select')}</option>
                        {campaign?.configuracion.grados.map((item) => (
                          <option key={item.token} value={item.token}>
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className='intake-muted my-5'>{t('individualEmailHelp')}</p>
                  <button disabled={busy || !campaign} className='btn btn-primary w-100'>
                    {busy ? t('processing') : t('sendPinRequest')}
                  </button>
                </form>
              )}
              {view === 'access' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(async () => {
                      const result = await api.post<{data: Application}>('/ingreso-publico/consultar', {
                        tipo_documento: identityType,
                        numero_documento: identity,
                        pin,
                        ...(campaign ? {campana_token: campaign.url_token} : {}),
                      })
                      apply(result.data)
                      if (
                        result.data.pin_manual &&
                        result.data.estado === 'borrador' &&
                        !result.data.datos.nacimiento
                      ) {
                        const renewal = await api.post<{
                          data: {encontrado: boolean; datos?: StudentData; grado_token?: string}
                        }>(
                          '/ingreso-publico/solicitud/renovacion',
                          {tipo_documento: identityType, numero_documento: identity},
                          {notifyLocalChange: false},
                        )
                        if (renewal.data.encontrado && renewal.data.datos)
                          setData({
                            pais: 'CO',
                            ...renewal.data.datos,
                            adicionales: renewal.data.datos.adicionales ?? {},
                          })
                      }
                      setPin('')
                    })
                  }}
                >
                  <h2>{t('accessApplication')}</h2>
                  <div className='intake-grid'>
                    {identityFields}
                    <div className='intake-field intake-wide'>
                      <label className='required' htmlFor='access-pin'>
                        {t('pin')}
                      </label>
                      <input
                        id='access-pin'
                        name='application-pin'
                        className='form-control intake-pin'
                        type='text'
                        inputMode='numeric'
                        autoComplete='one-time-code'
                        required
                        pattern='[0-9]{8}'
                        maxLength={8}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                  <p className='intake-muted my-5'>{t('pinHelp')}</p>
                  <button className='btn btn-primary w-100' disabled={busy}>
                    {busy ? t('processing') : t('enter')}
                  </button>
                </form>
              )}
              {view === 'received' && (
                <>
                  <IntakeNotice kind='success'>{t('requestReceived')}</IntakeNotice>
                  <h2>{radicado}</h2>
                  <p className='intake-muted'>{t('manualPinHelp')}</p>
                  <button
                    className='btn btn-primary w-100 mb-5'
                    onClick={() => {
                      setCampaignToken('')
                      setView('access')
                    }}
                  >
                    {t('havePin')}
                  </button>
                </>
              )}
              {view !== 'portal' && (
                <button
                  type='button'
                  className='btn btn-light w-100 my-5'
                  disabled={busy}
                  onClick={() => {
                    setCampaignToken(undefined)
                    setView('portal')
                    setError('')
                  }}
                >
                  {t('back')}
                </button>
              )}
              <IntakePayments />
            </>
          )}
        </div>
      </AuthLayout>
    </div>
  )
}
