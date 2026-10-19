import {useIntl} from 'react-intl'
import {useEffect, useRef, useState} from 'react'
import {useParams} from 'react-router-dom'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {KTIcon} from '@/_metronic/helpers'
import type {Application, Campaign, Field, StudentData} from './ingreso.types'
import {getEnrollmentStates} from './ingreso.types'
import {EnrollmentAddress, type Department} from './EnrollmentAddress'
import {ageOnDate, isOutsideAgeRange, schoolDate} from './enrollmentAge'
import flagCo from 'flag-icons/flags/4x3/co.svg'
import flagUs from 'flag-icons/flags/4x3/us.svg'
import flagMx from 'flag-icons/flags/4x3/mx.svg'
import flagVe from 'flag-icons/flags/4x3/ve.svg'
import flagEc from 'flag-icons/flags/4x3/ec.svg'
import flagPe from 'flag-icons/flags/4x3/pe.svg'
import flagPa from 'flag-icons/flags/4x3/pa.svg'
import flagEs from 'flag-icons/flags/4x3/es.svg'
import flagAr from 'flag-icons/flags/4x3/ar.svg'
import flagCl from 'flag-icons/flags/4x3/cl.svg'
import flagGb from 'flag-icons/flags/4x3/gb.svg'
import './ingreso.css'

const root = '/ingreso-publico'
const empty: StudentData = {pais: 'CO', adicionales: {}}
const linkSecret = () => new URLSearchParams(window.location.hash.slice(1)).get('solicitud') ?? ''
const initialMode = (campaign?: string) => campaign ? (linkSecret() ? 'verify' : 'start') : 'track'
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const isRepresentative = (field: Field) => /representante|acudiente|parentesco|emergencia|madre|padre/.test(normalize(`${field.key} ${field.nombre}`))
const isRelationship = (field: Field) => /parentesco|relacion|vinculo/.test(normalize(`${field.key} ${field.nombre}`))
const isPhone = (field: Field) => /telefono|celular|movil/.test(normalize(`${field.key} ${field.nombre}`))
const phoneCountries = [
  {dial: '+57', region: 'CO', flag: flagCo}, {dial: '+1', region: 'US', flag: flagUs},
  {dial: '+52', region: 'MX', flag: flagMx}, {dial: '+58', region: 'VE', flag: flagVe},
  {dial: '+593', region: 'EC', flag: flagEc}, {dial: '+51', region: 'PE', flag: flagPe},
  {dial: '+507', region: 'PA', flag: flagPa}, {dial: '+34', region: 'ES', flag: flagEs},
  {dial: '+54', region: 'AR', flag: flagAr}, {dial: '+56', region: 'CL', flag: flagCl},
  {dial: '+44', region: 'GB', flag: flagGb},
]
function PhoneField({id, label, dialLabel, otherCountry, locale, value, required, disabled, onChange}: {id: string; label: string; dialLabel: string; otherCountry: string; locale: string; value: string; required: boolean; disabled: boolean; onChange: (value: string) => void}) {
  const found = phoneCountries.find(country => value.startsWith(country.dial))
  const [selectedDial, setSelectedDial] = useState(found?.dial ?? (value.startsWith('+') ? 'other' : '+57'))
  const [customDial, setCustomDial] = useState(value.startsWith('+') && !found ? value.match(/^\+[0-9]{1,3}/)?.[0] ?? '+' : '+')
  useEffect(() => {
    if (!value.startsWith('+')) return
    const next = phoneCountries.find(country => value.startsWith(country.dial))?.dial ?? 'other'
    setSelectedDial(next)
    if (next === 'other') setCustomDial(value.match(/^\+[0-9]{1,3}/)?.[0] ?? '+')
  }, [value])
  const dialMenu = useRef<HTMLDetailsElement>(null)
  const prefix = selectedDial === 'other' ? customDial : selectedDial
  const number = value.startsWith('+') ? value.slice(prefix.length) : value
  const selectedCountry = phoneCountries.find(country => country.dial === selectedDial)
  const countryNames = new Intl.DisplayNames([locale], {type: 'region'})
  const chooseDial = (next: string) => {
    setSelectedDial(next)
    onChange((next === 'other' ? customDial : next) + number)
    if (dialMenu.current) dialMenu.current.open = false
  }
  return <div><label htmlFor={id} className={required ? 'required' : ''}>{label}</label><div className='ingreso-phone'>
    <details ref={dialMenu} className='ingreso-dial-menu' onKeyDown={e => {if (e.key === 'Escape' && dialMenu.current) dialMenu.current.open = false}}>
      <summary aria-label={dialLabel} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} onClick={e => {if (disabled) e.preventDefault()}}>
        {selectedCountry ? <img src={selectedCountry.flag} alt='' aria-hidden='true' /> : <span className='ingreso-globe' aria-hidden='true'>◎</span>}
        <span>{prefix}</span><span className='ingreso-dial-chevron' aria-hidden='true'><KTIcon iconType='solid' iconName='down' /></span>
      </summary>
      <div className='ingreso-dial-options' role='listbox' aria-label={dialLabel}>
        {phoneCountries.map(country => <button type='button' role='option' aria-selected={selectedDial === country.dial} key={country.region} onClick={() => chooseDial(country.dial)}>
          <img src={country.flag} alt='' aria-hidden='true' /><span>{countryNames.of(country.region)}</span><strong>{country.dial}</strong>
        </button>)}
        <button type='button' role='option' aria-selected={selectedDial === 'other'} onClick={() => chooseDial('other')}><span className='ingreso-globe' aria-hidden='true'>◎</span><span>{otherCountry}</span><strong>+</strong></button>
      </div>
    </details>
    {selectedDial === 'other' && <input aria-label={dialLabel} className='form-control ingreso-dial-other' inputMode='numeric' pattern='\+[1-9][0-9]{0,2}' value={customDial} disabled={disabled} onChange={e => {const next = '+' + e.target.value.replace(/\D/g, '').slice(0, 3); setCustomDial(next); onChange(next + number)}} />}
    <input id={id} className='form-control' type='tel' inputMode='numeric' autoComplete='tel-national' required={required} disabled={disabled} pattern={prefix === '+57' ? '3[0-9]{9}' : '[0-9]{6,12}'} value={number} onChange={e => onChange(e.target.value ? prefix + e.target.value.replace(/\D/g, '').slice(0, 12) : '')} />
  </div></div>
}
function RepresentativePhone({id, label, dialLabel, otherCountry, sameLabel, locale, value, contact, required, disabled, onChange}: {id: string; label: string; dialLabel: string; otherCountry: string; sameLabel: string; locale: string; value: string; contact: string; required: boolean; disabled: boolean; onChange: (value: string) => void}) {
  const [same, setSame] = useState(!value || value === contact)
  useEffect(() => {if (same && contact && value !== contact) onChange(contact)}, [same, contact, value, onChange])
  return <div><label className='ingreso-same-phone'><input type='checkbox' checked={same} disabled={disabled} onChange={e => {setSame(e.target.checked); if (e.target.checked) onChange(contact)}} />{sameLabel}</label>
    {!same && <PhoneField id={id} label={label} dialLabel={dialLabel} otherCountry={otherCountry} locale={locale} value={value === contact ? '' : value} required={required} disabled={disabled} onChange={onChange} />}</div>
}
export default function PublicEnrollmentPage() {
  const intl = useIntl()
  const toast = useToast()
  const states = getEnrollmentStates(intl)
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const {campaign: routeCampaign} = useParams()
  const [catalog, setCatalog] = useState<{colegio: string; zona_horaria: string; campaign?: Campaign; limites_envio?: {max_file_bytes: number; max_submission_bytes: number; max_archivos: number}}>()
  const campaignToken = routeCampaign ?? ''
  const [app, setApp] = useState<Application>()
  const [data, setData] = useState<StudentData>(empty)
  const [email, setEmail] = useState(''), [grade, setGrade] = useState('')
  const [digits, setDigits] = useState(['', '', '', ''])
  const [access, setAccess] = useState(linkSecret)
  const [consent, setConsent] = useState(false), [mode, setMode] = useState<'start' | 'verify' | 'track'>(initialMode(routeCampaign))
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('')
  const [authError, setAuthError] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [removed, setRemoved] = useState<string[]>([])
  const [submissionErrors, setSubmissionErrors] = useState<string[]>([])
  const [renewalMessage, setRenewalMessage] = useState('')
  const lastLookup = useRef('')
  const [noticeChanged, setNoticeChanged] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const studentForm = useRef<HTMLFormElement>(null)
  const submissionKey = useRef(crypto.randomUUID())
  const campaign = app?.campana ?? catalog?.campaign
  const timezone = campaign?.zona_horaria ?? catalog?.zona_horaria ?? 'America/Bogota'
  const today = schoolDate(timezone, now)
  const currentAge = ageOnDate(data.nacimiento, today)
  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update)}
  }, [])
  const editable = !!app && ['borrador', 'correcciones'].includes(app.estado)
  const ready = !!app && (campaign?.configuracion.documentos ?? []).filter(r => !r.grados.length || r.grados.includes(app.grado_aprobado_token ?? app.grado_token)).every(r => {
    const latest = app.documentos.find(d => d.requisito === r.key)
    const doc = latest?.estado === 'retirado' || removed.includes(r.key) ? undefined : latest
    return !!selectedFiles[r.key] || ((!r.obligatorio || !!doc) && doc?.estado !== 'rechazado')
  })
  const apply = (value: Application) => {setApp(value); setData({...empty, ...value.datos, adicionales: value.datos.adicionales ?? {}}); setSelectedFiles({}); setRemoved([]); setSubmissionErrors([]); setRenewalMessage(''); lastLookup.current = ''; setNoticeChanged(false); setConsent(false); submissionKey.current = crypto.randomUUID()}
  useEffect(() => {
    let live = true
    api.get<{data: Department[]}>(`${root}/ubicaciones`).then(r => {if (live) setDepartments(r.data)}).catch(() => {if (live) setSubmissionErrors([intl.formatMessage({id: 'intake.validation.geographyFailed'})])})
    return () => {live = false}
  }, [intl])
  useEffect(() => {
    if (!editable) return
    const warn = (e: BeforeUnloadEvent) => {e.preventDefault(); e.returnValue = ''}
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [editable])
  useEffect(() => {
    let live = true
    if (window.location.hash === '#codigo') window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setApp(undefined); setMode(initialMode(routeCampaign)); setAccess(linkSecret()); setGrade(''); setLoading(true); setLoadError(''); setAuthError('')
    Promise.all([api.get<{colegio: string; zona_horaria: string}>(`${root}/catalogo`),
      routeCampaign ? api.get<{data: Campaign}>(`${root}/campanas/${routeCampaign}`) : Promise.resolve(null),
      linkSecret() ? Promise.resolve(null)
        : api.get<{data: Application}>(`${root}/solicitud`).catch(e => {if (e instanceof ApiError && e.status === 401) return null; throw e})])
      .then(([c, selected, a]) => {if (live) {setCatalog({...c, campaign: selected?.data}); if (a && (!routeCampaign || a.data.campana.url_token === routeCampaign)) apply(a.data)}})
      .catch(e => {if (live) setLoadError(e.message)}).finally(() => {if (live) setLoading(false)})
    return () => {live = false}
  }, [routeCampaign])
  useEffect(() => {
    const openPrivateLink = () => {
      const secret = linkSecret()
      if (!secret || !routeCampaign) return
      setApp(undefined); setAccess(secret); setDigits(['', '', '', '']); setAuthError(''); setMode('verify')
    }
    window.addEventListener('hashchange', openPrivateLink)
    return () => window.removeEventListener('hashchange', openPrivateLink)
  }, [routeCampaign])
  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {await fn()} catch (e) {toast.error(e instanceof Error ? e.message : t('intake.ui.theOperationCouldNotBeCompleted'))} finally {setBusy(false)}
  }
  const auth = async () => {
    setBusy(true); setAuthError('')
    try {
      if (mode === 'start') {
        if (!campaignToken) return
        await api.post<{message: string}>(`${root}/${campaignToken}/iniciar`, {email, grado_token: grade})
        setDigits(['', '', '', '']); setMode('verify')
      } else {
        const res = await api.post<{data: Application}>(`${root}/consultar`, {pin: digits.join(''), ...(access ? {access} : {})})
        apply(res.data); setDigits(['', '', '', ''])
        if (mode === 'verify') {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
          setAccess('')
        }
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : t('intake.ui.theOperationCouldNotBeCompleted'))
    } finally {setBusy(false)}
  }
  const focusDigit = (index: number) => document.getElementById('intake-pin-' + index)?.focus()
  const putDigits = (index: number, value: string) => {
    const entered = value.replace(/\D/g, '').slice(0, 4)
    const next = [...digits]
    if (!entered) next[index] = ''
    else for (let i = 0; i < entered.length && index + i < 4; i++) next[index + i] = entered[i]
    setDigits(next)
    if (entered) focusDigit(Math.min(index + entered.length, 3))
  }
  const submit = async () => {
    if (busy || noticeChanged || !studentForm.current?.reportValidity() || !consent || !ready) return
    setSubmissionErrors([])
    if (!data.departamento || !data.municipio) {setSubmissionErrors([t('intake.validation.addressRequired')]); return}
    const limits = catalog?.limites_envio ?? {max_file_bytes: 1_000_000_000, max_submission_bytes: 1_000_000_000, max_archivos: 20}
    if (Object.keys(selectedFiles).length > limits.max_archivos || Object.values(selectedFiles).reduce((total, file) => total + file.size, 0) > limits.max_submission_bytes) {setSubmissionErrors([t('intake.validation.batchLimit', {count: limits.max_archivos})]); return}
    const setting = campaign?.configuracion.grados.find(g => g.token === (app?.grado_aprobado_token ?? app?.grado_token))
    const validationDate = schoolDate(timezone)
    if (isOutsideAgeRange(data.nacimiento, app?.grado_aprobado_token ?? app?.grado_token, validationDate, setting, app?.validacion_edad)) {
      setSubmissionErrors([t('intake.validation.ageMismatch', {min: setting!.edad_min!, max: setting!.edad_max!, date: validationDate})]); return
    }
    setBusy(true)
    const body = new FormData()
    body.append('datos', JSON.stringify(data)); body.append('enviar', '1'); body.append('consentimiento', '1')
    body.append('envio_token', submissionKey.current)
    body.append('privacidad_version', campaign?.privacidad_version ?? '')
    Object.entries(selectedFiles).forEach(([key, file]) => body.append(`documentos[${key}]`, file))
    removed.forEach(key => body.append('retirar[]', key))
    try {const res = await api.post<{data: Application}>(`${root}/solicitud`, body); apply(res.data); toast.success(t('intake.ui.applicationSubmittedWeWillEmailYouWhenItHasBeenReviewed'))}
    catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.errors?.privacidad_version) {setNoticeChanged(true); setConsent(false)}
      setSubmissionErrors(error instanceof ApiError && error.errors ? Object.values(error.errors).flat() : [error instanceof Error ? error.message : t('intake.ui.theOperationCouldNotBeCompleted')])
    }
    finally {setBusy(false)}
  }
  const lookupRenewal = async () => {
    const type = data.tipo_documento, number = data.numero_documento?.trim().toUpperCase()
    if (!editable || !type || !number || !/^[A-Z0-9-]{3,40}$/.test(number) || busy) return
    const key = `${app?.url_token}:${type}:${number}`
    if (lastLookup.current === key) return
    lastLookup.current = key
    setRenewalMessage('')
    try {
      const result = await api.post<{data: {encontrado: boolean; grado_token?: string; datos?: StudentData}}>(`${root}/solicitud/renovacion`, {tipo_documento: type, numero_documento: number})
      if (result.data.encontrado && result.data.datos) {
        const previous = result.data.datos
        const gradeToken = result.data.grado_token
        if (gradeToken) setApp(current => current ? {...current, grado_token: gradeToken} : current)
        setData(current => current.tipo_documento === type && current.numero_documento?.trim().toUpperCase() === number
          ? {...current, ...previous, tipo_documento: type, numero_documento: number, adicionales: {...current.adicionales, ...previous.adicionales}} : current)
        setRenewalMessage(t('intake.renewal.prefilled'))
      }
    } catch (error) {
      lastLookup.current = ''
      setRenewalMessage(error instanceof ApiError && error.errors ? Object.values(error.errors).flat().join(' ') : error instanceof Error ? error.message : t('intake.ui.theOperationCouldNotBeCompleted'))
    }
  }
  const reloadNotice = () => run(async () => {
    if (!campaign?.url_token) return
    const {data: latest} = await api.get<{data: Campaign}>(`${root}/campanas/${campaign.url_token}`)
    setApp(current => current ? {...current, campana: latest} : current)
    setCatalog(current => current ? {...current, campaign: latest} : current)
    setConsent(false); setNoticeChanged(false); setSubmissionErrors([])
  })
  const extraFields = campaign?.configuracion.campos ?? []
  const representativeFields = extraFields.filter(isRepresentative)
  const otherFields = extraFields.filter(f => !isRepresentative(f))
  const additionalField = (f: Field) => {
    const value = data.adicionales[f.key] ?? ''
    const update = (next: string) => setData(current => ({...current, adicionales: {...current.adicionales, [f.key]: next}}))
    if (isRelationship(f)) return <fieldset key={f.key} className='ingreso-relationship'><legend className={f.obligatorio ? 'required' : ''}>{f.nombre}</legend><div className='ingreso-relationship-options'>
      {['Mamá', 'Papá', 'Otro'].map(choice => <label key={choice}><input type='radio' required={f.obligatorio} name={`extra-${f.key}`} disabled={!editable || busy} checked={choice === 'Otro' ? !!value && !['Mamá', 'Papá', 'Mama', 'Papa'].includes(value) : value === choice || (choice === 'Mamá' && value === 'Mama') || (choice === 'Papá' && value === 'Papa')} onChange={() => update(choice)} /><span>{choice === 'Mamá' ? t('intake.ui.mother') : choice === 'Papá' ? t('intake.ui.father') : t('intake.ui.other')}</span></label>)}
    </div>{value && !['Mamá', 'Papá', 'Mama', 'Papa'].includes(value) && <input className='form-control mt-3' aria-label={t('intake.ui.specifyRelationship')} placeholder={t('intake.ui.specifyRelationship')} disabled={!editable || busy} required={f.obligatorio} maxLength={1000} value={value === 'Otro' ? '' : value} onChange={e => update(e.target.value || 'Otro')} />}</fieldset>
    if (isPhone(f) && isRepresentative(f)) return <RepresentativePhone key={f.key} id={`extra-${f.key}`} label={f.nombre} dialLabel={t('intake.ui.countryCallingCode')} otherCountry={t('intake.ui.otherCountry')} sameLabel={t('intake.ui.sameContactPhone')} locale={intl.locale} value={value} contact={data.telefono ?? ''} required={f.obligatorio} disabled={!editable || busy} onChange={update} />
    if (isPhone(f)) return <PhoneField key={f.key} id={`extra-${f.key}`} label={f.nombre} dialLabel={t('intake.ui.countryCallingCode')} otherCountry={t('intake.ui.otherCountry')} locale={intl.locale} value={value} required={f.obligatorio} disabled={!editable || busy} onChange={update} />
    return <div key={f.key}><label htmlFor={`extra-${f.key}`} className={f.obligatorio ? 'required' : ''}>{f.nombre}</label><input id={`extra-${f.key}`} className='form-control' disabled={!editable || busy} required={f.obligatorio}
      type={f.tipo === 'fecha' ? 'date' : 'text'} pattern={f.tipo === 'fecha' ? undefined : '.*\\S.*'} maxLength={1000} value={value} onChange={e => update(e.target.value)} /></div>
  }
  const visibleHistory = app?.historial.filter(h => !['documento_cargado', 'documento_retirado', 'borrador'].includes(h.evento)) ?? []
  return <main className='ingreso ingreso-public' lang={intl.locale} translate='no'><div className='ingreso-shell'>
    <header className='ingreso-hero'><h1>{t('intake.ui.studentEnrollment')}</h1><p>{catalog?.colegio ?? t('intake.ui.schoolPortal')} {' '}{t('intake.ui.onlineApplicationAndTracking')}</p></header>
    {loadError && <div role='alert' className='alert alert-danger'>{loadError}</div>}
    {!loading && campaignToken && !campaign && !loadError && <div role='alert' className='alert alert-warning'>{t('intake.ui.invalidEnrollmentLink')}</div>}
    {loading ? <p role='status'>{t('intake.ui.loadingPortal')}</p> : !app ? <section className='ingreso-card'>
      {mode === 'verify' ? <div className='ingreso-verification' role='status'>
        <div className='ingreso-verification-icon' aria-hidden='true'><KTIcon iconName='sms' /></div>
        <div><span className='ingreso-verification-eyebrow'>{t('intake.ui.nextStep')}</span>
          <h2>{t('intake.ui.pinEmailSentTitle')}</h2>
          <p>{email ? t('intake.ui.pinEmailSentTo', {email}) : t('intake.ui.pinEmailSentGeneric')}</p>
          <p className='ingreso-help'>{t(campaign?.configuracion.pin_expira_en ? 'intake.ui.pinExpiresAndLink' : 'intake.ui.pinNoExpiryAndLink')}</p>
        </div>
      </div> : <><h2>{mode === 'start' ? t('intake.ui.startWithYourEmail') : t('intake.ui.trackOrContinueYourEnrollment')}</h2>
        <p className='ingreso-help'>{t(mode === 'start' ? 'intake.ui.youDoNotNeedToCreateAnAccountYouWillReceiveA' : 'intake.ui.enterPinToConsult')}</p></>}
      <form onSubmit={e => {e.preventDefault(); void auth()}}><div className='ingreso-grid'>
        {mode === 'start' ? <><div><label htmlFor='intake-email'>{t('intake.ui.studentSigninEmail')}</label><input id='intake-email' type='email' required autoComplete='email' className='form-control' value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label htmlFor='intake-grade'>{t('intake.ui.requestedGrade')}</label><select id='intake-grade' className='form-select' required value={grade} onChange={e => setGrade(e.target.value)}>
          <option value=''>{t('intake.ui.selectAGrade')}</option>{campaign?.configuracion.grados.map(g => <option key={g.token} value={g.token}>{g.nombre}</option>)}</select></div>
          </> : <fieldset className='ingreso-pin-group'><legend>{t('intake.ui.pinReceivedByEmail')}</legend><div className='ingreso-pin-cells'>
            {digits.map((digit, index) => <input key={index} id={'intake-pin-' + index} className='ingreso-pin-cell' type='text' inputMode='numeric' autoComplete={index === 0 ? 'one-time-code' : 'off'} required pattern='[0-9]'
              aria-label={t('intake.ui.pinDigit', {number: index + 1})} value={digit} onChange={e => putDigits(index, e.target.value)}
              onPaste={e => {e.preventDefault(); putDigits(index, e.clipboardData.getData('text'))}}
              onKeyDown={e => {if (e.key === 'Backspace' && !digit && index > 0) focusDigit(index - 1)
                if (e.key === 'ArrowLeft' && index > 0) {e.preventDefault(); focusDigit(index - 1)}
                if (e.key === 'ArrowRight' && index < 3) {e.preventDefault(); focusDigit(index + 1)}}} />)}
          </div></fieldset>}
      </div>
        {busy && <div className='ingreso-auth-progress' role='status'><span className='spinner-border spinner-border-sm' aria-hidden='true' />{t(mode === 'start' ? 'intake.ui.sendingPin' : 'intake.ui.verifyingPin')}</div>}
        {authError && <p className='ingreso-auth-error' role='alert'>{authError}</p>}
        <div className='ingreso-actions'><button disabled={busy || (mode === 'start' && (!campaignToken || !campaign?.abierta)) || (mode !== 'start' && digits.some(digit => !digit))} className='btn btn-primary'>
          {busy ? t(mode === 'start' ? 'intake.ui.sendingPin' : 'intake.ui.verifyingPin') : mode === 'start' ? t('intake.ui.receivePinAndContinue') : mode === 'verify' ? t('intake.ui.continueEnrollment') : t('intake.ui.consultEnrollment')}</button>
          {mode === 'verify' && campaignToken && !access && <button type='button' className='btn btn-link' disabled={busy} onClick={() => {setMode('start'); setDigits(['', '', '', '']); setAuthError(''); setAccess(''); window.history.replaceState(null, '', window.location.pathname + window.location.search)}}>{t('intake.ui.correctEmailOrGrade')}</button>}
        </div></form>
      {mode === 'start' && <p className='ingreso-help mt-5'>{t('intake.ui.useADifferentEmailForEachStudentItWillBeTheirSignin')}</p>}
      {mode === 'track' && <p className='ingreso-help mt-5'>{t('intake.ui.fourDigitPinNeedsPrivateLink')}</p>}
    </section> : <>
      <section className='ingreso-card ingreso-overview'><div className='d-flex justify-content-between flex-wrap gap-3'><div><span className='ingreso-overline'>{t('intake.ui.enrollmentApplication')}</span><h2>{t('intake.ui.yourEnrollment')}</h2><span className='ingreso-status' data-status={app.estado}>{states[app.estado]}</span></div>
        <button type='button' disabled={busy} className='btn btn-light' onClick={() => void run(async () => {await api.post(`${root}/salir`); setApp(undefined); setData(empty); setConsent(false); toast.success(t('intake.ui.trackingClosed'))})}>{t('intake.ui.signOutOfTracking')}</button></div>
        {app.observacion && <aside className='mt-5'>{app.observacion}</aside>}
        <p className='mt-5'>{t('intake.ui.requestedGradeLabel')}{' '}{campaign?.configuracion.grados.find(g => g.token === app.grado_token)?.nombre}.
          {app.grado_aprobado_token && <> {' '}{t('intake.ui.gradeAssignedByTheSchool')}{' '}<strong>{campaign?.configuracion.grados.find(g => g.token === app.grado_aprobado_token)?.nombre}</strong>.</>}</p>
        {app.estado === 'aprobada' && <p className='mt-5'>{t(app.renovacion ? 'intake.renewal.approved' : 'intake.ui.yourStudentAccountIsReadyCheckYourEmailAndChangeTheTemporary')}</p>}
        {app.grupo && <p className='mt-5'>{t('intake.ui.assignedGroup')}{' '}<strong>{app.grupo}</strong></p>}
      </section>
      <form ref={studentForm} className='ingreso-student-form' onSubmit={e => e.preventDefault()}>
        <section className='ingreso-card ingreso-information-card'><div className='ingreso-section-heading'><span className='ingreso-section-mark'>01</span><div><h2>{t('intake.ui.studentInformation')}</h2><p className='ingreso-help'>{t('intake.ui.studentFieldsHelp')}</p></div></div><div className='ingreso-grid'>
          {([['primer_nombre','intake.ui.firstName',true],['segundo_nombre','intake.ui.middleNameOptional',false],['primer_apellido','intake.ui.firstSurname',true],['segundo_apellido','intake.ui.secondSurnameOptional',false]] as const).map(([key,label,required]) => <div key={key}><label htmlFor={`data-${key}`} className={required ? 'required' : ''}>{t(label)}</label><input id={`data-${key}`} className='form-control' disabled={!editable || busy} required={required} pattern='.*\S.*' maxLength={80} value={data[key] ?? ''} onChange={e => setData({...data, [key]: e.target.value})} /></div>)}
          <div><label htmlFor='data-birth' className='required'>{t('intake.ui.dateOfBirthLabel')}</label><input id='data-birth' className='form-control' type='date' required disabled={!editable || busy} min='1900-01-02' max={today} value={data.nacimiento ?? ''} onChange={e => setData({...data, nacimiento: e.target.value})} />{currentAge !== null && <p className='ingreso-age' role='status'>{t('intake.ui.currentAge', {age: currentAge})}</p>}</div>
          <div><label htmlFor='data-document-type' className='required'>{t('intake.ui.documentType')}</label><select id='data-document-type' className='form-select' required disabled={!editable || busy} value={data.tipo_documento ?? ''} onChange={e => {setData({...data, tipo_documento: e.target.value}); lastLookup.current = ''; setRenewalMessage('')}}>
            <option value=''>{t('intake.ui.select')}</option>{[['RC',t('intake.ui.birthRegistration')],['TI',t('intake.ui.colombianIdentityCardForMinors')],['CC',t('intake.ui.colombianCitizenshipId')],['CE',t('intake.ui.foreignResidentId')],['PASAPORTE',t('intake.ui.passport')],['OTRO',t('intake.ui.otherForeignIdentityDocument')]].map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div><label htmlFor='data-number' className='required'>{t('intake.ui.documentNumber')}</label><input id='data-number' className='form-control' required disabled={!editable || busy} maxLength={40} pattern='[A-Za-z0-9-]{3,40}' value={data.numero_documento ?? ''} onChange={e => {setData({...data, numero_documento: e.target.value}); lastLookup.current = ''; setRenewalMessage('')}} onBlur={() => void lookupRenewal()} />{renewalMessage && <p className='ingreso-help mt-2' role='status'>{renewalMessage}</p>}</div>
          <PhoneField id='data-phone' label={t('intake.ui.contactPhone')} dialLabel={t('intake.ui.countryCallingCode')} otherCountry={t('intake.ui.otherCountry')} locale={intl.locale} value={data.telefono ?? ''} required disabled={!editable || busy} onChange={value => setData({...data, telefono: value})} />
          <EnrollmentAddress data={data} departments={departments} disabled={!editable || busy} onChange={setData} />
        </div>
        {representativeFields.length > 0 && <div className='ingreso-form-section'><div className='ingreso-section-heading'><span className='ingreso-section-mark'>02</span><div><h2>{t('intake.ui.representativeInformation')}</h2><p className='ingreso-help'>{t('intake.ui.representativeHelp')}</p></div></div><div className='ingreso-grid'>{representativeFields.map(additionalField)}</div></div>}
        {otherFields.length > 0 && <div className='ingreso-form-section'><div className='ingreso-section-heading'><span className='ingreso-section-mark'>{representativeFields.length ? '03' : '02'}</span><div><h2>{t('intake.ui.additionalInformation')}</h2></div></div><div className='ingreso-grid'>{otherFields.map(additionalField)}</div></div>}
        {editable && <p className='ingreso-help mt-6'>{t('intake.validation.memoryOnly')}</p>}</section>
      </form>
      <section className='ingreso-card'><h2>{t('intake.ui.documents')}</h2><p className='ingreso-help'>{t(editable ? 'intake.validation.filesHelp' : 'intake.ui.onlyAuthorizedSchoolStaffCanReviewThemPreviousVersionsAreRetained')}</p>
        {campaign?.configuracion.documentos.filter(d => !d.grados.length || d.grados.includes(app.grado_aprobado_token ?? app.grado_token)).map(req => {
          const versions = app.documentos.filter(d => d.requisito === req.key), doc = versions[0]?.estado === 'retirado' || removed.includes(req.key) ? undefined : versions[0]
          const pending = selectedFiles[req.key]
          return <div className='ingreso-document' key={req.key}><div><h3 className={`fs-5 ${req.obligatorio ? 'required' : ''}`}>{req.nombre}</h3><p>{req.instrucciones}</p>
            <p className='ingreso-help'>{req.formatos.join(', ').toUpperCase()}</p>
            {doc && <><span className='ingreso-status' data-status={doc.estado}>{states[doc.estado]}</span><p className='mt-3'><a href={`/api${root}/documentos/${doc.url_token}`}>{doc.nombre}</a> · v{doc.version}</p>{doc.observacion && <aside>{doc.observacion}</aside>}</>}
            {versions.length > (doc ? 1 : 0) && <details className='mt-3'><summary>{t('intake.ui.previousVersions')}</summary>{versions.filter(v => v.url_token !== doc?.url_token).map(v => <p key={v.url_token}><a href={`/api${root}/documentos/${v.url_token}`}>{t('intake.ui.version')}{' '}{v.version}: {v.nombre}</a> · {states[v.estado] ?? t('intake.ui.withdrawn')}</p>)}</details>}
          </div>{editable && doc?.estado !== 'aprobado' && <div><label htmlFor={`upload-${req.key}`}>{doc ? t('intake.ui.replaceDocument') : t('intake.ui.uploadDocument')}</label>
            <input id={`upload-${req.key}`} className='form-control' type='file' accept={req.formatos.map(f => `.${f}`).join(',')} disabled={busy} onChange={e => {
              const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
              if (file.size > (catalog?.limites_envio?.max_file_bytes ?? 1_000_000_000)) {toast.error(t('intake.fileTooLarge')); return}
              const ext = file.name.split('.').pop()?.toLowerCase()
              if (!ext || !req.formatos.includes(ext === 'jpeg' ? 'jpg' : ext)) {toast.error(t('intake.validation.fileFormat')); return}
              setSelectedFiles(current => ({...current, [req.key]: file})); setRemoved(current => current.filter(key => key !== req.key))
            }} />
            {pending && <p className='ingreso-local-file mt-3'><KTIcon iconName='document' />{pending.name}<span>{t('intake.validation.selectedNotSent')}</span></p>}
            {(doc || pending) && <button type='button' className='btn btn-light-danger mt-3' disabled={busy} onClick={() => {
              setSelectedFiles(current => {const next = {...current}; delete next[req.key]; return next})
              if (doc) setRemoved(current => [...new Set([...current, req.key])])
            }}>{t('intake.ui.removeDocument')}</button>}</div>}</div>
        })}
      </section>
      {editable && <section className='ingreso-card'><h2>{t('intake.ui.confirmSubmission')}</h2><p style={{whiteSpace: 'pre-wrap'}}>{campaign?.configuracion.privacidad}</p>
        {noticeChanged && <div className='alert alert-warning' role='alert'><p>{t('intake.settings.noticeChanged')}</p><button type='button' className='btn btn-light-primary' disabled={busy} onClick={() => void reloadNotice()}>{t('intake.settings.reloadNotice')}</button></div>}
        <div className='form-check'><input id='intake-consent' type='checkbox' className='form-check-input' disabled={busy || noticeChanged} checked={consent} onChange={e => setConsent(e.target.checked)} /><label htmlFor='intake-consent'>{t('intake.ui.iConfirmTheInformationAndConsentToItsProcessingForThisApplication')}</label></div>
        {!ready && <p className='ingreso-help mt-4'>{t('intake.ui.uploadAllRequiredDocumentsAndReplaceRejectedOnesBeforeSubmitting')}</p>}
        {submissionErrors.length > 0 && <div className='alert alert-danger mt-5' role='alert'><strong>{t('intake.validation.fixBeforeSubmitting')}</strong><ul className='mb-0 mt-2'>{submissionErrors.map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
        {busy && <p role='status' className='ingreso-help mt-5'><span className='spinner-border spinner-border-sm me-3' />{t('intake.validation.validating')}</p>}
        <div className='ingreso-actions'><button type='button' className='btn ingreso-action-primary' disabled={busy || noticeChanged || !consent || !ready} onClick={() => void submit()}>{t(busy ? 'intake.validation.validating' : 'intake.ui.submitForReview')}</button></div></section>}
      <section className='ingreso-card'><h2>{t('intake.ui.tracking')}</h2><p className='ingreso-help'>{t('intake.ui.trackingHelp')}</p>
        {visibleHistory.length ? <div className='ingreso-timeline'>{visibleHistory.map((h,i) => <div key={i} className='ingreso-timeline-item' data-event={h.evento}>
          <span className='ingreso-timeline-dot' aria-hidden='true' /><div><strong>{states[h.evento] ?? t('intake.historyUpdate')}</strong><time>{new Date(h.created_at).toLocaleString(intl.locale)}</time>{h.observacion && <p>{h.observacion}</p>}</div>
        </div>)}</div> : <p className='ingreso-help'>{t('intake.ui.noTrackingUpdates')}</p>}</section>
    </>}
    <footer className='d-flex justify-content-end'><span className='ingreso-help'>{t('intake.ui.onlinePaymentsComingSoon')}</span></footer>
  </div></main>
}
