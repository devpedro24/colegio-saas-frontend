import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react'
import {Link, useNavigate, useParams} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useQuery} from '@tanstack/react-query'
import {api, ApiError} from '@/lib/api/client'
import {AuthLayout} from '@/app/modules/auth/AuthLayout'
import LegacyEnrollmentPage, {PhoneField} from './LegacyEnrollmentPage'
import {EnrollmentAddress, type Department} from './EnrollmentAddress'
import {EnrollmentPrivacy} from './EnrollmentPrivacy'
import {EnrollmentGradeSummary} from './EnrollmentGradeSummary'
import {RepresentativeRelationshipField} from './RepresentativeRelationshipField'
import {ageOnDate, birthDateError, schoolDate} from './enrollmentAge'
import {additionalInput, additionalType, cleanAdditional, cleanIdentity, cleanName, cleanText, identityPattern, nameFields, namePattern, numericIdentity} from './enrollmentInput'
import {IntakeIcon, IntakeModal, IntakeNotice, IntakePayments} from './IntakeUI'
import {editableElement, studentName, useIntakeText} from './intakeWorkflow'
import {getEnrollmentStates, type Application, type Campaign, type StudentData} from './ingreso.types'

type PublicCatalog = {
  colegio: string
  campanas: Campaign[]
  zona_horaria: string
  limites_envio: {max_file_bytes: number}
}
type View = 'request' | 'access' | 'received' | 'form' | 'status'
const formSteps = ['personal', 'contact', 'family', 'additional', 'documents', 'send'] as const
type FormStep = typeof formSteps[number]
const emptyData = (): StudentData => ({pais: 'CO', adicionales: {}})

export default function PublicIntakePage() {
  const {renewalToken} = useParams()
  if (!renewalToken && window.location.hash.includes('solicitud=')) return <LegacyEnrollmentPage />
  return <PublicIntake key={renewalToken} renewalToken={renewalToken} />
}

function PublicIntake({renewalToken}: {renewalToken?: string}) {
  const applicationBase = renewalToken ? `/mi-renovacion/${renewalToken}` : '/ingreso-publico'
  const navigate = useNavigate()
  const [annex, setAnnex] = useState<File>()
  const annexKey = useRef(crypto.randomUUID())
  const t = useIntakeText(),
    intl = useIntl(),
    {campaign: routeCampaign} = useParams()
  const spanish = intl.locale.startsWith('es')
  const states = getEnrollmentStates(intl)
  const catalog = useQuery({
    queryKey: ['ingreso-publico', location.host, 'catalogo'],
    queryFn: () => api.get<PublicCatalog>('/ingreso-publico/catalogo'),
    staleTime: 60000,
    retry: false,
  })
  const selectedCampaign = useQuery({
    queryKey: ['ingreso-publico', location.host, 'convocatoria', routeCampaign],
    queryFn: () => api.get<{data: Campaign}>(`/ingreso-publico/campanas/${routeCampaign}`),
    enabled: !!routeCampaign,
    retry: false,
  })
  const campaign = selectedCampaign.data?.data
  const [application, setApplication] = useState<Application>()
  const [view, setView] = useState<View>(routeCampaign ? 'request' : 'access'),
    [selectedStep, setStep] = useState<FormStep>('personal')
  const hasAdditional = !!application?.campana.configuracion.campos.length
  const steps = formSteps.filter(name => name !== 'additional' || hasAdditional)
  const step = selectedStep === 'additional' && !hasAdditional ? 'documents' : selectedStep
  const stepIndex = steps.indexOf(step)
  const [data, setData] = useState<StudentData>(emptyData),
    [email, setEmail] = useState(''),
    [grade, setGrade] = useState('')
  const [identityType, setIdentityType] = useState('TI'),
    [identity, setIdentity] = useState(''),
    [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [sameRepresentativePhone, setSameRepresentativePhone] = useState(false)
  useEffect(() => {
    setView(routeCampaign ? 'request' : 'access')
    setApplication(undefined)
    setData(emptyData())
    setGrade('')
    setError('')
    setPin('')
    setShowPin(false)
    setSameRepresentativePhone(false)
  }, [routeCampaign])
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
    setConsent(false)
    setSameRepresentativePhone(!!next.datos.telefono && next.datos.telefono === next.datos.telefono_responsable)
    setApplication(next)
    setGrade(next.grado_token ?? '')
    setData({
      pais: 'CO',
      ...next.datos,
      adicionales: next.datos.adicionales ?? {},
    })
    savedData.current = JSON.stringify({datos: {
      pais: 'CO',
      ...next.datos,
      adicionales: next.datos.adicionales ?? {},
    }, grado_token: next.grado_token ?? ''})
    setView(next.estado === 'borrador' ? 'form' : 'status')
  }, [])
  useEffect(() => {
    let active = true
    api
      .get<{data: Application}>(`${applicationBase}/solicitud`)
      .then(async ({data: file}) => {
        if (!active || (routeCampaign && file.campana.url_token !== routeCampaign)) return
        if (renewalToken && file.estado === 'borrador' && !file.datos.nacimiento && file.datos.numero_documento) {
          const {data: previous} = await api.post<{data: {datos?: StudentData; grado_token?: string}}>(
            `${applicationBase}/solicitud/renovacion`,
            {tipo_documento: file.datos.tipo_documento, numero_documento: file.datos.numero_documento},
            {notifyLocalChange: false},
          )
          if (!active) return
          apply(file)
          if (previous.datos) {
            setData({...previous.datos, ...file.datos, adicionales: file.datos.adicionales ?? previous.datos.adicionales ?? {}})
            if (previous.grado_token) setGrade(previous.grado_token)
          }
        } else {
          apply(file)
        }
      })
      .catch((e) => {
        if (active && (renewalToken || !(e instanceof ApiError) || e.status !== 401)) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [apply, routeCampaign, renewalToken, applicationBase])
  const editable = application && ['borrador', 'correcciones'].includes(application.estado)
  const canEdit = (key: string) =>
    !application ||
    (!['tipo_documento', 'numero_documento'].includes(key) && editableElement(application, `datos.${key}`))
  const today = schoolDate(application?.campana.zona_horaria ?? catalog.data?.zona_horaria ?? 'America/Bogota')
  const currentAge = ageOnDate(data.nacimiento, today)
  const gradeRule = application?.campana.configuracion.grados.find(item => item.token === (application.grado_aprobado_token ?? grade))
  const ageError = birthDateError(intl, data.nacimiento, today, application?.grado_aprobado_token ?? grade, gradeRule, application?.validacion_edad)
  const update = (key: keyof StudentData, value: string) => {
    value = nameFields.includes(key) ? cleanName(value) : key === 'numero_documento' ? cleanIdentity(value, data.tipo_documento) : cleanText(value)
    setSaved(false)
    const copy = key === 'telefono' && sameRepresentativePhone && canEdit('telefono_responsable')
    if (key === 'telefono' && sameRepresentativePhone && !canEdit('telefono_responsable')) setSameRepresentativePhone(false)
    setData((current) => ({...current, [key]: value, ...(copy ? {telefono_responsable: value} : {})}))
  }
  const saveDraft = useCallback(async () => {
    const snapshot = JSON.stringify({datos: data, grado_token: grade})
    if (!application || !editable || snapshot === savedData.current) return
    if (data.nacimiento && currentAge === null) throw new Error(ageError)
    if (saving.current) await saving.current
    const request = api
      .put<{data: Application}>(`${applicationBase}/solicitud/borrador`, {datos: data, grado_token: grade || null}, {notifyLocalChange: false})
      .then((result) => {
        setApplication(result.data)
        savedData.current = snapshot
        setSaved(true)
      })
    saving.current = request
    try {
      await request
    } finally {
      saving.current = null
    }
  }, [application, editable, data, grade, currentAge, ageError, applicationBase])
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
      if (e instanceof ApiError && e.status === 422 && e.errors?.privacidad_version) {
        setConsent(false)
        const latest = await api.get<{data: Application}>(`${applicationBase}/solicitud`).catch(() => undefined)
        if (latest) setApplication(latest.data)
      }
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
        pattern={nameFields.includes(key) ? namePattern : undefined}
        max={key === 'nacimiento' ? today : undefined}
        ref={input => {if (key === 'nacimiento') input?.setCustomValidity(ageError)}}
        required={required}
        maxLength={key === 'direccion' ? 200 : ['madre', 'padre', 'responsable'].includes(key) ? 160 : nameFields.includes(key) ? 80 : 160}
        value={String(data[key] ?? '')}
        disabled={busy || !canEdit(key)}
        onChange={(event) => update(key, event.target.value)}
      />
      {key === 'nacimiento' && <>
        <small className='intake-muted d-block mt-2' role='status' aria-live='polite'>
          {currentAge !== null ? intl.formatMessage({id: 'intake.ui.currentAge'}, {age: currentAge}) : intl.formatMessage({id: 'intake.ui.ageIsCalculatedFromTheDateOfBirth'})}
        </small>
        {ageError && <small className='text-danger d-block mt-2' role='alert'>{ageError}</small>}
      </>}
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
        disabled={busy || !canEdit(key) || (key === 'telefono_responsable' && sameRepresentativePhone)}
        onChange={(value) => update(key, value)}
      />
      {key === 'telefono_responsable' && <label className='form-check d-flex align-items-center gap-3 mt-3'>
        <input id='same-contact-phone' type='checkbox' className='form-check-input' checked={sameRepresentativePhone}
          disabled={busy || !canEdit(key) || (!data.telefono && !sameRepresentativePhone)}
          onChange={event => {
            setSameRepresentativePhone(event.target.checked)
            if (event.target.checked) update('telefono_responsable', data.telefono ?? '')
          }} />
        {intl.formatMessage({id: 'intake.ui.sameContactPhone'})}
      </label>}
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
          onChange={(e) => {setIdentityType(e.target.value); setIdentity('')}}
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
          inputMode={numericIdentity(identityType) ? 'numeric' : 'text'}
          pattern={identityPattern(identityType)}
          value={identity}
          onChange={(e) => setIdentity(cleanIdentity(e.target.value, identityType))}
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
            requirement.grados.includes(application.grado_aprobado_token ?? application.grado_token ?? ''),
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
                          `${applicationBase}/documentos/${requirement.key}`,
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
      if ((step === 'personal' || step === 'send') && ageError) throw new Error(ageError)
      await saveDraft()
      if (step !== 'send') {
        setStep(steps[stepIndex + 1])
        return
      }
      const result = await api.post<{data: Application}>(
        `${applicationBase}/solicitud`,
        {
          datos: data,
          grado_token: grade || null,
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
  if (!renewalToken && application && !application.pin_manual) return <LegacyEnrollmentPage />
  const errorNotice = (error || catalog.error || selectedCampaign.error) && (
    <IntakeNotice kind='danger'>{error || catalog.error?.message || selectedCampaign.error?.message}</IntakeNotice>
  )
  const previewModal = preview && (
    <IntakeModal title={t('documentPreview')} close={() => setPreview(undefined)} wide>
      <iframe
        title={t('documentPreview')}
        src={`/api${applicationBase}/documentos/${preview}?vista=1`}
        style={{width: '100%', height: '65vh', border: 0}}
      />
      <a className='btn btn-light-primary mt-4' href={`/api${applicationBase}/documentos/${preview}`}>
        {t('download')}
      </a>
    </IntakeModal>
  )
  if (application && (view === 'form' || view === 'status'))
    return (
      <div className='intake-next intake-public-form'>
        <header className='intake-public-brand'>
          <Link to={renewalToken ? '/dashboard' : '/auth'}>
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
                if (renewalToken) { navigate('/dashboard'); return }
                await api.post('/ingreso-publico/salir', {})
                setApplication(undefined)
                setData(emptyData())
                setView(routeCampaign ? 'request' : 'access')
              })
            }
          >
            {renewalToken ? (spanish ? 'Volver a mi cuenta' : 'Back to my account') : t('exit')}
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
              <div className='d-flex flex-wrap gap-6 mt-4'><EnrollmentGradeSummary application={application} /></div>
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
                      className={step === name ? 'active' : ''}
                      aria-current={step === name ? 'step' : undefined}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await saveDraft()
                          setStep(name)
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
                <h2>{t(step)}</h2>
                <p className='intake-muted'>{t('requiredHelp')}</p>
                {application.estado === 'correcciones' && (
                  <IntakeNotice kind='warning'>{t('correctionOnly')}</IntakeNotice>
                )}
                <fieldset disabled={busy || !editable}>
                  {step === 'personal' && (
                    <div className='intake-grid'>
                      <div className='intake-field intake-wide'>
                        <label className='required' htmlFor='application-grade'>{t('grade')}</label>
                        <select id='application-grade' className='form-select' required value={grade}
                          disabled={!!application.grado_token || application.estado !== 'borrador'}
                          onChange={(event) => setGrade(event.target.value)}>
                          <option value=''>{t('select')}</option>
                          {application.campana.configuracion.grados.map((item) => <option key={item.token} value={item.token}>{item.nombre}</option>)}
                        </select>
                      </div>
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
                  {step === 'contact' && (
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
                  {step === 'family' && (
                    <div className='intake-grid'>
                      {textField('madre')}
                      {textField('padre')}
                      {textField('responsable', true)}
                      <RepresentativeRelationshipField id='intake-parentesco' label={t('parentesco')}
                        required value={data.parentesco ?? ''} disabled={busy || !canEdit('parentesco')}
                        onChange={value => update('parentesco', value)} />
                      {phone('telefono_responsable')}
                    </div>
                  )}
                  {step === 'additional' && (
                    <div className='intake-grid'>
                      {application.campana.configuracion.campos.map((field) => (
                        additionalType(field) === 'parentesco' ? <RepresentativeRelationshipField key={field.key}
                          id={`extra-${field.key}`} label={field.nombre} required={field.obligatorio}
                          disabled={busy || !canEdit(`adicionales.${field.key}`)} value={data.adicionales[field.key] ?? ''}
                          onChange={value => {setSaved(false); setData(current => ({...current, adicionales: {...current.adicionales, [field.key]: value}}))}} /> : <div className='intake-field' key={field.key}>
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
                          ) : additionalType(field) === 'telefono' ? (
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
                              {...additionalInput(field)}
                              value={data.adicionales[field.key] ?? ''}
                              onChange={(e) =>
                                setData({
                                  ...data,
                                  adicionales: {
                                    ...data.adicionales,
                                    [field.key]:
                                      cleanAdditional(field, e.target.value),
                                  },
                                })
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {step === 'documents' && documents}
                  {step === 'send' && (
                    <>
                      <IntakeNotice>{t('submissionHelp')}</IntakeNotice>
                      <p>
                        <strong>{studentName({...application, datos: data})}</strong>
                        <br />
                        {application.email}
                      </p>
                      <h3>{t('privacy')}</h3>
                      <EnrollmentPrivacy notice={application.campana.configuracion.privacidad} policy={application.campana.configuracion.politica_datos} />
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
                  {stepIndex > 0 && (
                    <button type='button' className='btn btn-light' disabled={busy} onClick={() => setStep(steps[stepIndex - 1])}>
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
                    {busy ? t('processing') : t(step === 'send' ? 'submitApplication' : 'continue')}
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
                        setStep('personal')
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
                        const result = await api.get<{data: Application}>(`${applicationBase}/solicitud`)
                        apply(result.data)
                      })
                    }
                  >
                    <IntakeIcon name='arrow-clockwise' />
                    {t('refreshStatus')}
                  </button>
                  {!renewalToken && application.estado === 'matriculada' && (
                    <Link className='btn btn-primary' to='/auth'>
                      {t('signIn')}
                    </Link>
                  )}
                </div>
              </section>
              <section className='intake-card'>
                <h2>{t('documents')}</h2>
                {documents}
                {application.documentos.filter(doc => doc.anexo_renovacion).map(doc => (
                  <a key={doc.url_token} className='d-block mt-3 text-break' href={`/api${applicationBase}/documentos/${doc.url_token}`}>
                    {doc.nombre}
                  </a>
                ))}
                {renewalToken && application.estado === 'aprobada' && <form className='mt-5' onSubmit={event => {
                  event.preventDefault()
                  if (!annex) return
                  const input = event.currentTarget
                  void run(async () => {
                    const body = new FormData()
                    body.append('documento', annex)
                    body.append('carga_token', annexKey.current)
                    const result = await api.post<{data: Application}>(`${applicationBase}/anexos`, body)
                    apply(result.data)
                    setAnnex(undefined)
                    input.reset()
                  })
                }}>
                  <label className='form-label' htmlFor='renewal-annex'>
                    {spanish ? 'Adjuntar un documento mientras esperas grupo' : 'Attach a document while awaiting group assignment'}
                  </label>
                  <input id='renewal-annex' type='file' className='form-control' accept='.pdf,.jpg,.jpeg,.png' disabled={busy}
                    onChange={event => {setAnnex(event.target.files?.[0]); annexKey.current = crypto.randomUUID()}} />
                  <button className='btn btn-primary mt-3' disabled={busy || !annex}>
                    {busy ? t('processing') : spanish ? 'Adjuntar documento' : 'Attach document'}
                  </button>
                </form>}
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
  if (renewalToken) return <main className='container py-8' aria-live='polite'>
    {errorNotice || (spanish ? 'Cargando tu trámite…' : 'Loading your application…')}
    <Link className='d-block mt-3' to='/dashboard'>{spanish ? 'Volver a mi cuenta' : 'Back to my account'}</Link>
  </main>
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
          {catalog.isPending || (!!routeCampaign && selectedCampaign.isPending) ? (
            <p role='status'>{t('loading')}</p>
          ) : (
            <>
              {view === 'request' && campaign && (
                <div className='intake-field mb-6'>
                  <label>{t('campaign')}</label>
                  <p className='fw-semibold mb-0'>{campaign.nombre}</p>
                </div>
              )}
              {view === 'request' && campaign && (
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
                          grado_token: grade || null,
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
                      <label htmlFor='pin-grade'>
                        {t('optionalGrade')}
                      </label>
                      <select
                        id='pin-grade'
                        className='form-select'
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
                      <div className='position-relative'>
                        <input
                          id='access-pin'
                          name='application-pin'
                          className={`form-control pe-12${showPin ? '' : ' intake-pin'}`}
                          type='text'
                          inputMode='numeric'
                          autoComplete='one-time-code'
                          required
                          pattern='[0-9]{8}'
                          maxLength={8}
                          value={pin}
                          disabled={busy}
                          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                        />
                        <button type='button' className='btn btn-icon btn-active-light-primary position-absolute end-0 top-0'
                          aria-label={t(showPin ? 'hidePin' : 'showPin')} aria-pressed={showPin}
                          disabled={busy} onClick={() => setShowPin((visible) => !visible)}>
                          <IntakeIcon name={showPin ? 'eye-slash' : 'eye'} />
                        </button>
                      </div>
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
                  <p className='intake-muted mb-1'>{t('requestNumber')}</p>
                  <h2>{radicado}</h2>
                  <IntakeNotice>{t('pinPending')}</IntakeNotice>
                  <p className='intake-muted'>{t('manualPinHelp')}</p>
                  <button
                    className='btn btn-primary w-100 mb-5'
                    onClick={() => {
                      setView('access')
                    }}
                  >
                    {t('accessApplication')}
                  </button>
                </>
              )}
              {view === 'request' && (
                <Link to='/ingreso' className='btn btn-light w-100 my-5'>{t('accessApplication')}</Link>
              )}
              <IntakePayments />
            </>
          )}
        </div>
      </AuthLayout>
    </div>
  )
}
