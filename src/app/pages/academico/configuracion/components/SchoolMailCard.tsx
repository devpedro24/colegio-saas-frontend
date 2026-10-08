import {useIntl} from 'react-intl'
import {useEffect, useState, type FormEvent} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {Modal} from 'react-bootstrap'
import {api, ApiError} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {canAccessSchoolMail} from '@/app/modules/auth/core/schoolMailAccess'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {getMailLabels, type MailAction, type SchoolMailSettings as Settings} from '../schoolMail.types'
import '../../../admisiones/ingreso.css'

const external = {target: '_blank', rel: 'noopener noreferrer'}

export function SchoolMailCard() {
  const intl = useIntl()
  const {mailActionLabels, mailRequestLabels} = getMailLabels(intl)
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const {currentUser} = useAuth(), qc = useQueryClient()
  const {activeColegio} = useImpersonation()
  const isRector = canAccessSchoolMail(currentUser, !!activeColegio)
  const queryKey = ['school-mail', currentUser?.tenant_channel, activeColegio?.slug]
  const query = useQuery({queryKey, queryFn: () => api.get<Settings>('/correo-institucional'), staleTime: 30000, refetchOnWindowFocus: true})
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [disconnect, setDisconnect] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false), [action, setAction] = useState<MailAction>('editar'), [reason, setReason] = useState('')
  const [blockedGrant, setBlockedGrant] = useState<string | null>(null)
  const [, setClock] = useState(0)
  const settings = query.data, request = settings?.solicitud
  const expires = request?.vence_en
  useEffect(() => {
    if (!expires) return
    const remaining = Date.parse(expires) - Date.now()
    if (remaining <= 0 || !Number.isFinite(remaining)) return
    const timer = window.setTimeout(() => setClock(value => value + 1), Math.min(remaining + 50, 2147483647))
    return () => window.clearTimeout(timer)
  }, [expires])
  const expired = !!expires && Date.parse(expires) <= Date.now()
  const grantKey = request?.url_token ?? 'initial'
  const available = isRector && !query.isError && blockedGrant !== grantKey
  const validGrant = request?.estado === 'aprobada' && !!expires && !expired && Date.parse(expires) > Date.now()
  // Server flags include ownership and the permitted action. Expiry only closes a
  // previously enabled form while the tab stays open; it never grants access.
  const canEdit = available && settings?.puede_editar === true && !expired
  const canDisconnect = available && settings?.puede_desconectar === true && !expired
  const canRequest = isRector && !query.isError && settings?.requiere_autorizacion === true && request?.estado !== 'pendiente' && !validGrant
  const apply = async (next: Settings, changedConnection = false) => {
    await qc.cancelQueries({queryKey})
    qc.setQueryData(queryKey, next)
    if (changedConnection) await qc.invalidateQueries({queryKey: ['ingreso', currentUser?.tenant_channel]})
  }
  async function failed(cause: unknown) {
    setError(cause instanceof Error ? cause.message : t('intake.ui.theOperationCouldNotBeCompleted'))
    if (cause instanceof ApiError && cause.status === 403) setBlockedGrant(grantKey)
    await query.refetch()
  }
  async function save(values: {email: string; nombre: string; app_password: string}) {
    if (!canEdit || busy) return
    setBusy(true); setError(''); setNotice('')
    try {await apply(await api.put<Settings>('/correo-institucional', values, {notifyLocalChange:false}), true); setNotice(t('intake.ui.googleAcceptedTheTestEmailAndWeSavedTheConnectionCheckThat'))}
    catch(e) {await failed(e)}
    finally {setBusy(false)}
  }
  async function remove() {
    if (!canDisconnect || busy) return
    setBusy(true); setError(''); setNotice('')
    try {await apply(await api.delete<Settings>('/correo-institucional', {notifyLocalChange:false}), true); setDisconnect(false); setNotice(t('intake.ui.connectionRemovedFromThePlatformAlsoRevokeTheAppPasswordInGoogle'))}
    catch(e) {await failed(e)}
    finally {setBusy(false)}
  }
  async function requestApproval(e: FormEvent) {
    e.preventDefault()
    if (!canRequest || busy || reason.trim().length < 10 || reason.trim().length > 1000) return
    setBusy(true); setError(''); setNotice('')
    try {
      await apply(await api.post<Settings>('/correo-institucional/solicitudes', {accion: action, motivo: reason.trim()}, {notifyLocalChange:false}))
      setRequestOpen(false); setReason(''); setNotice(t('intake.ui.requestSentDirectlyToTheSuperadministrator'))
    } catch(e) {await failed(e)}
    finally {setBusy(false)}
  }
  return <div className='ingreso'>
    <header className='ingreso-hero'><h2>{t('intake.ui.yourSchoolEmailConnected')}</h2><p>{t('intake.ui.sendPinsEnrollmentNoticesAndPasswordRecoveryEmailsFromYourGmailOr')}</p></header>
    <div className='ingreso-grid'>
      <section className='ingreso-card'><h3>{t('intake.ui.emailConnection')}</h3><p className='ingreso-help'>{t('intake.ui.onlyThePrincipalCanConnectAnEmailAccountLaterChangesAndDisconnection')}</p>
        {(error || query.error) && <div role='alert' className='alert alert-danger'>{query.error?.message || error}</div>}
        {notice && <div role='status' className='alert alert-success'>{notice}</div>}
        <button type='button' className='btn btn-sm btn-light mb-4' disabled={busy || query.isFetching} onClick={() => void query.refetch()}>{t('intake.ui.refreshStatus')}</button>
        {query.isPending ? <p role='status'>{t('intake.ui.checkingConnection')}</p> : settings && <>
          <p><span className='ingreso-status'>{settings.configurado ? t('intake.ui.connectionSaved') : t('intake.ui.noGmailAccountConnected')}</span></p>
          {settings.configurado && <dl data-testid='school-mail-summary' className='text-break'><dt>{t('intake.ui.senderName')}</dt><dd>{settings.nombre}</dd><dt>{t('intake.ui.senderEmail')}</dt><dd>{settings.email}</dd></dl>}
          {query.data?.verificado_en && <p className='ingreso-help'>{t('intake.ui.lastAcceptedTest')}{' '}{new Date(query.data.verificado_en).toLocaleString(intl.locale)}{t('intake.ui.thisDoesNotGuaranteeThatAPasswordRevokedLaterWillStillWork')}</p>}
          {request && <aside className='alert alert-info text-break' data-testid='school-mail-request'>
            <strong>{mailActionLabels[request.accion]} · {expired && request.estado === 'aprobada' ? t('intake.ui.expired') : mailRequestLabels[request.estado]}</strong>
            <p className='mb-2'>{request.motivo}</p>
            <p className='mb-2'>{t('intake.ui.requested')}{' '}{new Date(request.creada_en).toLocaleString(intl.locale)}</p>
            {request.observacion && <p className='mb-2'>{t('intake.ui.comment')}{' '}{request.observacion}</p>}
            {expires && <p className='mb-0'>{t('intake.ui.expires')}{' '}{new Date(expires).toLocaleString(intl.locale)}</p>}
            {request.estado === 'pendiente' && <p className='mb-0'>{t('intake.ui.awaitingTheSuperadministratorResponseARequestIsAlreadyPending')}</p>}
          </aside>}
          {!isRector && <p className='ingreso-help'>{t('intake.ui.readonlyViewThePrincipalMustRequestAndUseTheirOwnAuthorization')}</p>}
          {canEdit && <MailConnectionForm key={`${grantKey}:${settings.email}`} settings={settings} busy={busy} save={save} />}
          {canRequest && <button className='btn btn-primary' disabled={busy} onClick={() => {setAction('editar'); setError(''); setRequestOpen(true)}}>{t('intake.ui.requestAuthorization')}</button>}
          {canDisconnect && <button className='btn btn-light-danger' disabled={busy} onClick={()=>setDisconnect(true)}>{t('intake.ui.disconnectGmail')}</button>}
          {disconnect && canDisconnect && <aside className='mt-4'><p>{t('intake.ui.thePasswordSavedHereWillBeRemovedIfNoOtherPlatformEmail')}</p><div className='ingreso-actions'><button className='btn btn-danger' disabled={busy} onClick={()=>void remove()}>{t('intake.ui.confirmDisconnection')}</button><button className='btn btn-light' disabled={busy} onClick={()=>setDisconnect(false)}>{t('intake.ui.cancel')}</button></div></aside>}
        </>}
      </section>
      <section className='ingreso-card' aria-label={t('intake.ui.gmailConnectionGuide')}><h3>{t('intake.ui.howToGetThePasswordStepByStep')}</h3>
        <ol className='ps-6'>
          <li className='mb-6'><strong>{t('intake.ui.useTheSchoolEmailAccount')}</strong><p className='ingreso-help mb-0'>{t('intake.ui.signInToGoogleWithTheSameAccountYouWillEnterIn')}</p></li>
          <li className='mb-6'><strong>{t('intake.ui.enableTwostepVerification')}</strong><p className='ingreso-help'>{t('intake.ui.secureYourAccountFirst')}</p><a className='btn btn-sm btn-light-primary' href='https://myaccount.google.com/security' {...external}>{t('intake.ui.openGoogleSecurity')}</a></li>
          <li className='mb-6'><strong>{t('intake.ui.createAnAppPassword')}</strong><p className='ingreso-help'>{t('intake.ui.inGoogleUseANameSuchAsSchoolPlatformAndGenerateThe')}</p><a className='btn btn-sm btn-light-primary' href='https://myaccount.google.com/apppasswords' {...external}>{t('intake.ui.generateAGoogleAppPassword')}</a></li>
          <li className='mb-6'><strong>{t('intake.ui.pasteThePasswordHereAndTest')}</strong><p className='ingreso-help'>{t('intake.ui.copyThe16LettersSpacesAreAllowedWhenPastingEnterYourEmail')}</p></li>
        </ol>
        <details><summary className='fw-bold'>{t('intake.ui.optionMissingOrConnectionFailing')}</summary><p className='ingreso-help mt-4'>{t('intake.ui.googleMayRestrictAppPasswordsDueToOrganizationPoliciesAdvancedProtectionOr')}</p>
          <p className='ingreso-help'>{t('intake.ui.ifThePasswordIsCorrectButTheTestFailsSecureOutboundSmtp')}</p></details>
        <p className='ingreso-help mt-5'>{t('intake.ui.gmailHasSendingLimitsAndAntispamControlsThePlatformOnlyUsesThis')}</p>
        <a href={`https://support.google.com/accounts/answer/185833?hl=${intl.locale}`} {...external}>{t('intake.ui.officialGoogleGuide')}</a>
      </section>
    </div>
    <Modal show={requestOpen && canRequest} onHide={() => {if (!busy) setRequestOpen(false)}} centered aria-labelledby='mail-request-title'>
      <Modal.Header closeButton={!busy} closeLabel={t('intake.ui.close')}><Modal.Title id='mail-request-title'>{t('intake.ui.requestSuperadministratorAuthorization')}</Modal.Title></Modal.Header>
      <form onSubmit={e => void requestApproval(e)}>
        <Modal.Body>
          {error && <div role='alert' className='alert alert-danger'>{error}</div>}
          <label htmlFor='mail-request-action' className='form-label'>{t('intake.ui.requestedAction')}</label>
          <select id='mail-request-action' className='form-select mb-4' value={action} disabled={busy} onChange={e => setAction(e.target.value as MailAction)}><option value='editar'>{t('intake.ui.editConnection')}</option>{settings?.configurado && <option value='desconectar'>{t('intake.ui.disconnectEmail')}</option>}</select>
          <label htmlFor='mail-request-reason' className='form-label'>{t('intake.ui.reason10To1000Characters')}</label>
          <textarea id='mail-request-reason' className='form-control' required minLength={10} maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} />
          <p className='text-muted mt-3'>{t('intake.ui.authorizationIsPersonalForThisActionOnlyAndValidForOneUse')}</p>
        </Modal.Body>
        <Modal.Footer><button type='button' className='btn btn-light' disabled={busy} onClick={() => setRequestOpen(false)}>{t('intake.ui.cancel')}</button><button className='btn btn-primary' disabled={busy || reason.trim().length < 10}>{busy ? t('intake.ui.sending') : t('intake.ui.sendRequest')}</button></Modal.Footer>
      </form>
    </Modal>
  </div>
}

// Mount only while authorized: secrets never enter query caches or browser storage.
function MailConnectionForm({settings, busy, save}: {settings: Settings; busy: boolean; save: (values: {email: string; nombre: string; app_password: string}) => Promise<void>}) {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const [email, setEmail] = useState(settings.email ?? ''), [name, setName] = useState(settings.nombre ?? ''), [password, setPassword] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    const secret = password
    setPassword('')
    await save({email, nombre: name, app_password: secret})
  }
  return <form onSubmit={e => void submit(e)} autoComplete='off'>
    <label htmlFor='school-mail-email'>{t('intake.ui.sendingEmailAddress')}</label><input id='school-mail-email' className='form-control mb-5' type='email' required maxLength={255} value={email} onChange={e=>setEmail(e.target.value)} placeholder='colegio@gmail.com' disabled={busy}/>
    <label htmlFor='school-mail-name'>{t('intake.ui.senderDisplayName')}</label><input id='school-mail-name' className='form-control mb-5' required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder={t('intake.ui.exampleSchool')} disabled={busy}/>
    <label htmlFor='school-mail-password'>{t('intake.ui.googleAppPassword')}</label><input id='school-mail-password' className='form-control' type='password' autoComplete='new-password' spellCheck={false} maxLength={64} required={!settings.configurado || email !== settings.email} value={password} onChange={e=>setPassword(e.target.value)} placeholder={settings.configurado ? t('intake.ui.leaveBlankToKeepTheSavedPassword') : t('intake.ui.pasteThe16letterPasswordHere')} disabled={busy} aria-describedby='school-mail-secret-help'/>
    <p id='school-mail-secret-help' className='ingreso-help mt-3'>{t('intake.ui.doNotUseYourRegularGmailPasswordOrVerificationCodeThePassword')}</p>
    <button className='btn btn-primary w-100' disabled={busy}>{busy ? t('intake.ui.testingConnection') : t('intake.ui.testAndSaveConnection')}</button>
    <p className='ingreso-help mt-4'>{t('intake.ui.theTestSendsAMessageOnlyToTheSpecifiedSenderAddressWe')}</p>
  </form>
}
