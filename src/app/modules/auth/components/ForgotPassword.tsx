import {useEffect, useState, type FormEvent} from 'react'
import {Link} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {api, ApiError} from '@/lib/api/client'
import {PasswordField} from '@/app/shared/components/PasswordField'
import {PasswordRequirements} from '@/app/shared/components/PasswordRequirements'
import {passwordMeetsPolicy} from '@/app/shared/passwordPolicy'

type Method = 'link' | 'otp'
type Challenge = {challenge: string; expires_in: number; resend_after: number}

export function ForgotPassword() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const [method, setMethod] = useState<Method>('link')
  const [email, setEmail] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [expiresAt, setExpiresAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if ((!resendAt && !challenge) || done) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [resendAt, challenge, done])
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const expired = !!challenge && now >= expiresAt

  const errorMessage = (cause: unknown) => cause instanceof ApiError
    ? cause.status === 429 ? t('auth.recovery.rateLimit') : cause.fieldError('code') ?? cause.fieldError('password') ?? cause.fieldError('email') ?? cause.message
    : t('auth.forgotPassword.error')

  async function requestRecovery() {
    setBusy(true)
    setError('')
    try {
      if (method === 'otp') {
        const data = await api.post<Challenge>('/forgot-password/otp', {email}, {notifyLocalChange: false})
        setChallenge(data)
        setExpiresAt(Date.now() + data.expires_in * 1000)
        setResendAt(Date.now() + data.resend_after * 1000)
        setCode('')
      } else {
        await api.post('/forgot-password', {email}, {notifyLocalChange: false})
        setResendAt(Date.now() + 60000)
      }
      setNow(Date.now())
      setSent(true)
    } catch (cause) {setError(errorMessage(cause))}
    finally {setBusy(false)}
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!challenge || method !== 'otp') {await requestRecovery(); return}
    setError('')
    if (!passwordMeetsPolicy(password)) {setError(t('password.invalid')); return}
    if (password !== confirmation) {setError(t('password.mismatch')); return}
    setBusy(true)
    try {
      await api.post('/reset-password/otp', {email, challenge: challenge.challenge, code, password, password_confirmation: confirmation}, {notifyLocalChange: false})
      setDone(true)
      setCode(''); setPassword(''); setConfirmation(''); setChallenge(null)
    } catch (cause) {setError(errorMessage(cause))}
    finally {setBusy(false)}
  }

  const choose = (value: Method) => {
    setMethod(value); setChallenge(null); setSent(false); setError(''); setCode('')
    setPassword(''); setConfirmation('')
  }

  return <form className='form w-100' id='kt_login_password_reset_form' onSubmit={submit}>
    <div className='text-center mb-8'>
      <h1 className='text-gray-900 fw-bolder mb-3'>{t(done ? 'security.reset.title' : 'auth.forgotPassword.title')}</h1>
      {!done && <p className='text-gray-600 mb-0'>{t('auth.recovery.help')}</p>}
    </div>
    {error && <div className='alert alert-danger' role='alert'>{error}</div>}
    {done ? <div className='alert alert-success' role='status'>{t('security.reset.done')}</div> : <>
      <fieldset className='mb-7' disabled={busy}>
        <legend className='form-label fs-6 fw-semibold'>{t('auth.recovery.method')}</legend>
        <div className='row g-3'>
          {(['link', 'otp'] as const).map(value => <div className='col-6' key={value}>
            <label className={'d-flex align-items-center gap-3 border rounded-3 p-4 h-100 cursor-pointer' + (method === value ? ' border-primary bg-light-primary' : '')}>
              <input type='radio' name='recovery-method' value={value} checked={method === value} onChange={() => choose(value)} />
              <span className='fw-semibold fs-7'>{t(value === 'link' ? 'auth.recovery.link' : 'auth.recovery.otp')}</span>
            </label>
          </div>)}
        </div>
      </fieldset>
      <label className='form-label fw-semibold' htmlFor='recovery-email'>{t('common.email')}</label>
      <input id='recovery-email' className='form-control bg-transparent mb-5' type='email' autoComplete='email' placeholder='nombre@ejemplo.com'
        required maxLength={255} value={email} disabled={busy || !!challenge} onChange={event => {setEmail(event.target.value); setSent(false)}} />
      {sent && <div className='alert alert-info fs-7' role='status'>{t(method === 'otp' ? 'auth.recovery.otpSent' : 'auth.recovery.linkSent')}</div>}
      {challenge && <>
        <label className='form-label fw-semibold' htmlFor='recovery-code'>{t('auth.recovery.code')}</label>
        <input id='recovery-code' className='form-control mb-3 text-center fs-2 fw-bold' type='text' inputMode='numeric' autoComplete='one-time-code'
          required pattern='[0-9]{6}' minLength={6} maxLength={6} value={code} disabled={busy || expired}
          onChange={event => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
        <p className={'fs-7 mb-5 ' + (expired ? 'text-danger' : 'text-gray-600')}>{t(expired ? 'auth.recovery.expired' : 'auth.recovery.codeHelp')}</p>
        <label className='form-label' htmlFor='recovery-password'>{t('security.reset.password')}</label>
        <PasswordField id='recovery-password' wrapperClassName='mb-3' required minLength={8} maxLength={128} autoComplete='new-password'
          value={password} disabled={busy} onChange={event => setPassword(event.target.value)} />
        <PasswordRequirements password={password} />
        <label className='form-label' htmlFor='recovery-confirm'>{t('security.reset.confirm')}</label>
        <PasswordField id='recovery-confirm' wrapperClassName='mb-6' required minLength={8} maxLength={128} autoComplete='new-password'
          value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} />
      </>}
      <button type='submit' id='kt_password_reset_submit' className='btn btn-primary w-100 mb-4' disabled={busy || (!challenge && wait > 0) || expired}>
        {!busy && !challenge && wait > 0 ? intl.formatMessage({id: 'auth.recovery.resendWait'}, {seconds: wait})
          : t(busy ? 'common.pleaseWait' : challenge ? 'auth.recovery.reset' : method === 'otp' ? 'auth.recovery.sendCode' : 'auth.recovery.sendLink')}
      </button>
      {challenge && <button type='button' className='btn btn-light w-100 mb-4' disabled={busy || wait > 0} onClick={() => void requestRecovery()}>
        {wait > 0 ? intl.formatMessage({id: 'auth.recovery.resendWait'}, {seconds: wait}) : t('auth.recovery.resend')}
      </button>}
      {(challenge || sent) && <button type='button' className='btn btn-link w-100 mb-4' disabled={busy} onClick={() => choose(method)}>{t('auth.recovery.changeEmail')}</button>}
    </>}
    <div className='text-center'><Link to='/auth/login'>{t('security.reset.login')}</Link></div>
  </form>
}
