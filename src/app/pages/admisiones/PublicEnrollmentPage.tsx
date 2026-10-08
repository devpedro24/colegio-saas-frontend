import {useIntl} from 'react-intl'
import {useEffect, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {api, ApiError} from '@/lib/api/client'
import type {Application, Campaign, StudentData} from './ingreso.types'
import {getEnrollmentStates} from './ingreso.types'
import './ingreso.css'

const root = '/ingreso-publico'
const empty: StudentData = {adicionales: {}}
export default function PublicEnrollmentPage() {
  const intl = useIntl()
  const states = getEnrollmentStates(intl)
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const {campaign: routeCampaign} = useParams()
  const [catalog, setCatalog] = useState<{colegio: string; campanas: Campaign[]}>()
  const [campaignToken, setCampaignToken] = useState(routeCampaign ?? '')
  const [app, setApp] = useState<Application>()
  const [data, setData] = useState<StudentData>(empty)
  const [email, setEmail] = useState(''), [pin, setPin] = useState(''), [grade, setGrade] = useState('')
  const [consent, setConsent] = useState(false), [mode, setMode] = useState<'start' | 'login'>(routeCampaign ? 'start' : 'login')
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const campaign = app?.campana ?? catalog?.campanas.find(c => c.url_token === campaignToken)
  const editable = !!app && ['borrador', 'correcciones'].includes(app.estado)
  const ready = !!app && (campaign?.configuracion.documentos ?? []).filter(r => !r.grados.length || r.grados.includes(app.grado_aprobado_token ?? app.grado_token)).every(r => {
    const doc = app.documentos.find(d => d.requisito === r.key)
    return (!r.obligatorio || !!doc) && doc?.estado !== 'rechazado'
  })
  const apply = (value: Application) => {setApp(value); setData({...empty, ...value.datos, adicionales: value.datos.adicionales ?? {}})}
  useEffect(() => {
    let live = true
    Promise.all([api.get<{colegio: string; campanas: Campaign[]}>(`${root}/catalogo`),
      api.get<{data: Application}>(`${root}/solicitud`).catch(e => {if (e instanceof ApiError && e.status === 401) return null; throw e})])
      .then(([c, a]) => {if (live) {setCatalog(c); if (a) apply(a.data)}})
      .catch(e => {if (live) setError(e.message)}).finally(() => {if (live) setLoading(false)})
    return () => {live = false}
  }, [])
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try {await fn()} catch (e) {setError(e instanceof Error ? e.message : t('intake.ui.theOperationCouldNotBeCompleted'))} finally {setBusy(false)}
  }
  const auth = async () => {
    if (!campaignToken) {setError(t('intake.ui.selectAnEnrollmentRound')); return}
    await run(async () => {
      if (mode === 'start') {
        await api.post<{message: string}>(`${root}/${campaignToken}/iniciar`, {email, grado_token: grade})
        setNotice(t('intake.pinSent')); setMode('login')
      } else {
        const res = await api.post<{data: Application}>(`${root}/${campaignToken}/acceder`, {email, pin})
        apply(res.data); setPin('')
      }
    })
  }
  const save = (submit: boolean) => run(async () => {
    const res = await api.put<{data: Application}>(`${root}/solicitud`, {datos: data, enviar: submit, consentimiento: consent})
    apply(res.data); setNotice(submit ? t('intake.ui.applicationSubmittedWeWillEmailYouWhenItHasBeenReviewed') : t('intake.ui.draftSavedYouCanContinueLaterUsingYourEmailAndPin'))
  })
  const fields = [['primer_nombre',t('intake.ui.firstName')],['segundo_nombre',t('intake.ui.middleNameOptional')],['primer_apellido',t('intake.ui.firstSurname')],
    ['segundo_apellido',t('intake.ui.secondSurnameOptional')],['nacimiento',t('intake.ui.dateOfBirthLabel')],['numero_documento',t('intake.ui.documentNumber')],
    ['telefono',t('intake.ui.contactPhoneOptional')],['direccion',t('intake.ui.addressOptional')]] as const
  return <main className='ingreso ingreso-public'><div className='ingreso-shell'>
    <header className='ingreso-hero'><h1>{t('intake.ui.studentEnrollment')}</h1><p>{catalog?.colegio ?? t('intake.ui.schoolPortal')} {' '}{t('intake.ui.onlineApplicationAndTracking')}</p></header>
    {error && <div role='alert' className='alert alert-danger'>{error}</div>}
    {notice && <div role='status' className='alert alert-success'>{notice}</div>}
    {loading ? <p role='status'>{t('intake.ui.loadingPortal')}</p> : !app ? <section className='ingreso-card'>
      <div className='ingreso-actions mb-6'><button type='button' className={`btn ${mode === 'start' ? 'btn-primary' : 'btn-light'}`} onClick={() => setMode('start')}>{t('intake.ui.newApplication')}</button>
        <button type='button' className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-light'}`} onClick={() => setMode('login')}>{t('intake.ui.trackMyApplication')}</button></div>
      <h2>{mode === 'start' ? t('intake.ui.startWithYourEmail') : t('intake.ui.trackOrContinueYourEnrollment')}</h2>
      <p className='ingreso-help'>{t('intake.ui.youDoNotNeedToCreateAnAccountYouWillReceiveA')}</p>
      <form onSubmit={e => {e.preventDefault(); void auth()}}><div className='ingreso-grid'>
        <div><label htmlFor='intake-campaign'>{t('intake.ui.enrollmentRoundLabel')}</label><select id='intake-campaign' required className='form-select' value={campaignToken} onChange={e => {setCampaignToken(e.target.value); setGrade('')}}>
          <option value=''>{t('intake.ui.chooseAnEnrollmentRound')}</option>{catalog?.campanas.map(c => <option key={c.url_token} value={c.url_token}>{c.nombre}{!c.abierta ? t('intake.ui.closedLabel') : ''}</option>)}</select></div>
        <div><label htmlFor='intake-email'>{t('intake.ui.studentSigninEmail')}</label><input id='intake-email' type='email' required autoComplete='email' className='form-control' value={email} onChange={e => setEmail(e.target.value)} /></div>
        {mode === 'start' ? <div><label htmlFor='intake-grade'>{t('intake.ui.requestedGrade')}</label><select id='intake-grade' className='form-select' required value={grade} onChange={e => setGrade(e.target.value)}>
          <option value=''>{t('intake.ui.selectAGrade')}</option>{campaign?.configuracion.grados.map(g => <option key={g.token} value={g.token}>{g.nombre}</option>)}</select></div>
          : <div><label htmlFor='intake-pin'>{t('intake.ui.pinReceivedByEmail')}</label><input id='intake-pin' className='form-control' required autoComplete='one-time-code' maxLength={32} value={pin} onChange={e => setPin(e.target.value)} /></div>}
      </div><div className='ingreso-actions'><button disabled={busy || !campaignToken || (mode === 'start' && !campaign?.abierta)} className='btn btn-primary'>{busy ? t('intake.ui.processing') : mode === 'start' ? t('intake.ui.receivePinAndContinue') : t('intake.ui.signInWithPin')}</button>
        {mode === 'login' && <button type='button' className='btn btn-light' disabled={busy || !campaignToken || !email} onClick={() => void run(async () => {
          await api.post<{message: string}>(`${root}/${campaignToken}/recuperar`, {email}); setNotice(t('intake.pinRecovered'))
        })}>{t('intake.ui.recoverPin')}</button>}</div></form>
      <p className='ingreso-help mt-5'>{t('intake.ui.useADifferentEmailForEachStudentItWillBeTheirSignin')}</p>
    </section> : <>
      <section className='ingreso-card'><div className='d-flex justify-content-between flex-wrap gap-3'><div><h2>{app.radicado}</h2><span className='ingreso-status' data-status={app.estado}>{states[app.estado]}</span></div>
        <button type='button' disabled={busy} className='btn btn-light' onClick={() => void run(async () => {await api.post(`${root}/salir`); setApp(undefined); setData(empty); setConsent(false)})}>{t('intake.ui.signOutOfTracking')}</button></div>
        {app.observacion && <aside className='mt-5'>{app.observacion}</aside>}
        <p className='mt-5'>{t('intake.ui.requestedGradeLabel')}{' '}{campaign?.configuracion.grados.find(g => g.token === app.grado_token)?.nombre}.
          {app.grado_aprobado_token && <> {' '}{t('intake.ui.gradeAssignedByTheSchool')}{' '}<strong>{campaign?.configuracion.grados.find(g => g.token === app.grado_aprobado_token)?.nombre}</strong>.</>}</p>
        {app.estado === 'aprobada' && <p className='mt-5'>{t('intake.ui.yourStudentAccountIsReadyCheckYourEmailAndChangeTheTemporary')}</p>}
        {app.grupo && <p className='mt-5'>{t('intake.ui.assignedGroup')}{' '}<strong>{app.grupo}</strong></p>}
      </section>
      <section className='ingreso-card'><h2>{t('intake.ui.studentInformation')}</h2><p className='ingreso-help'>{t('intake.ui.ageIsCalculatedFromTheDateOfBirth')}</p><div className='ingreso-grid'>
        {fields.map(([key,label]) => <div key={key}><label htmlFor={`data-${key}`}>{label}</label><input id={`data-${key}`} className='form-control' disabled={!editable || busy}
          type={key === 'nacimiento' ? 'date' : 'text'} maxLength={key === 'direccion' ? 200 : 80} value={data[key] ?? ''} onChange={e => setData({...data, [key]: e.target.value})} /></div>)}
        <div><label htmlFor='data-document-type'>{t('intake.ui.documentType')}</label><select id='data-document-type' className='form-select' disabled={!editable || busy} value={data.tipo_documento ?? ''} onChange={e => setData({...data, tipo_documento: e.target.value})}>
          <option value=''>{t('intake.ui.select')}</option>{[['RC',t('intake.ui.birthRegistration')],['TI',t('intake.ui.colombianIdentityCardForMinors')],['CC',t('intake.ui.colombianCitizenshipId')],['CE',t('intake.ui.foreignResidentId')],['PPT',t('intake.ui.temporaryProtectionPermit')],['PASAPORTE',t('intake.ui.passport')],['OTRO',t('intake.ui.otherForeignIdentityDocument')]].map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        {campaign?.configuracion.campos.map(f => <div key={f.key}><label htmlFor={`extra-${f.key}`}>{f.nombre}{f.obligatorio ? ' *' : t('intake.ui.optional')}</label><input id={`extra-${f.key}`} className='form-control' disabled={!editable || busy}
          type={f.tipo === 'fecha' ? 'date' : 'text'} maxLength={1000} value={data.adicionales[f.key] ?? ''} onChange={e => setData({...data, adicionales: {...data.adicionales, [f.key]: e.target.value}})} /></div>)}
      </div>{editable && <div className='ingreso-actions'><button className='btn btn-light-primary' disabled={busy} onClick={() => void save(false)}>{t('intake.ui.saveDraft')}</button><span className='ingreso-help'>{t('intake.ui.saveBeforeLeavingDocumentsAreSavedWhenUploaded')}</span></div>}</section>
      <section className='ingreso-card'><h2>{t('intake.ui.documents')}</h2><p className='ingreso-help'>{t('intake.ui.onlyAuthorizedSchoolStaffCanReviewThemPreviousVersionsAreRetained')}</p>
        {campaign?.configuracion.documentos.filter(d => !d.grados.length || d.grados.includes(app.grado_aprobado_token ?? app.grado_token)).map(req => {
          const versions = app.documentos.filter(d => d.requisito === req.key), doc = versions[0]
          return <div className='ingreso-document' key={req.key}><div><h3 className='fs-5'>{req.nombre}{req.obligatorio ? ' *' : t('intake.ui.optional')}</h3><p>{req.instrucciones}</p>
            <p className='ingreso-help'>{req.formatos.join(', ').toUpperCase()} {' '}{t('intake.ui.maximum')}{' '}{req.max_mb} MB</p>
            {doc && <><span className='ingreso-status' data-status={doc.estado}>{states[doc.estado]}</span><p className='mt-3'><a href={`/api${root}/documentos/${doc.url_token}`}>{doc.nombre}</a> · v{doc.version}</p>{doc.observacion && <aside>{doc.observacion}</aside>}</>}
            {versions.length > 1 && <details className='mt-3'><summary>{t('intake.ui.previousVersions')}</summary>{versions.slice(1).map(v => <p key={v.url_token}><a href={`/api${root}/documentos/${v.url_token}`}>{t('intake.ui.version')}{' '}{v.version}: {v.nombre}</a> · {states[v.estado]}</p>)}</details>}
          </div>{editable && doc?.estado !== 'aprobado' && <div><label htmlFor={`upload-${req.key}`}>{doc ? t('intake.ui.replaceDocument') : t('intake.ui.uploadDocument')}</label>
            <input id={`upload-${req.key}`} className='form-control' type='file' accept={req.formatos.map(f => `.${f}`).join(',')} disabled={busy} onChange={e => {
              const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
              if (file.size > req.max_mb * 1024 * 1024) {setError(t('intake.fileTooLarge', {size: req.max_mb})); return}
              void run(async () => {const body = new FormData(); body.append('archivo', file); setApp((await api.post<{data: Application}>(`${root}/documentos/${req.key}`, body)).data)})
            }} /></div>}</div>
        })}
      </section>
      {editable && <section className='ingreso-card'><h2>{t('intake.ui.confirmSubmission')}</h2><p style={{whiteSpace: 'pre-wrap'}}>{campaign?.configuracion.privacidad}</p>
        <div className='form-check'><input id='intake-consent' type='checkbox' className='form-check-input' checked={consent} onChange={e => setConsent(e.target.checked)} /><label htmlFor='intake-consent'>{t('intake.ui.iConfirmTheInformationAndConsentToItsProcessingForThisApplication')}</label></div>
        {!ready && <p className='ingreso-help mt-4'>{t('intake.ui.uploadAllRequiredDocumentsAndReplaceRejectedOnesBeforeSubmitting')}</p>}
        <div className='ingreso-actions'><button className='btn btn-primary' disabled={busy || !consent || !ready} onClick={() => void save(true)}>{t('intake.ui.submitForReview')}</button></div></section>}
      <section className='ingreso-card'><h2>{t('intake.ui.tracking')}</h2>{app.historial.map((h,i) => <p key={i}><time>{new Date(h.created_at).toLocaleString(intl.locale)}</time> · {states[h.evento] ?? t('intake.historyUpdate')}{h.observacion && ` — ${h.observacion}`}</p>)}</section>
    </>}
    <footer className='d-flex justify-content-between flex-wrap gap-3'><Link to='/auth'>{t('intake.ui.goToSignIn')}</Link><span className='ingreso-help'>{t('intake.ui.onlinePaymentsComingSoon')}</span></footer>
  </div></main>
}
