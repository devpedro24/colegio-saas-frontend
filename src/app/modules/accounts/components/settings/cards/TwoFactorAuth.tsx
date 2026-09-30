import {useState, type FormEvent} from 'react'
import {QRCodeSVG} from 'qrcode.react'
import {useIntl} from 'react-intl'
import {useAuth} from '../../../../auth'
import {ApiError} from '@/lib/api/client'
import {getCurrentUser} from '../../../../auth/core/_requests'
import {useMfaSetup, useMfaConfirm, useMfaDisable} from '@/app/pages/account/mfa.api'
import {PasswordField} from '@/app/shared/components/PasswordField'

export function TwoFactorAuth() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {currentUser, setCurrentUser} = useAuth()
  const setup = useMfaSetup(), confirm = useMfaConfirm(), disable = useMfaDisable()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [secret, setSecret] = useState('')
  const [setupUri, setSetupUri] = useState('')
  const [showManualKey, setShowManualKey] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [working, setWorking] = useState(false)
  const enabled = currentUser?.mfa_enabled === true
  const busy = working || setup.isPending || confirm.isPending || disable.isPending
  const run = async (action: () => Promise<void>) => {
    setError(''); setWorking(true)
    try { await action() } catch (err) { setError(err instanceof ApiError ? err.message : t('account.security.error')) }
    finally { setWorking(false) }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      if (secret) {
        const result = await confirm.mutateAsync(code)
        setRecoveryCodes(result.recovery_codes ?? [])
        setSecret(''); setSetupUri(''); setCode('')
      } else if (enabled) {
        await disable.mutateAsync({code, password})
        setCurrentUser(prev => prev ? {...prev, mfa_enabled: false} : prev)
        setCode(''); setPassword('')
      } else {
        const result = await setup.mutateAsync(password)
        setSecret(result.secret); setSetupUri(result.otpauth_url); setPassword('')
      }
    })
  }
  const finish = () => void run(async () => {
    const {data} = await getCurrentUser()
    setCurrentUser(data); setRecoveryCodes([])
  })
  const download = () => {
    const blob = new Blob([`${t('account.security.recoveryTitle')}\n${currentUser?.email}\n\n${recoveryCodes.join('\n')}\n`], {type: 'text/plain;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = 'codigos-recuperacion.txt'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className='card mb-6' id='account-security'>
    <div className='card-header'><h2 className='card-title fs-3 fw-bold'>{t('account.security.title')}</h2></div>
    <div className='card-body p-6 p-md-9'>
      {error && <div className='alert alert-danger' role='alert'>{error}</div>}
      {recoveryCodes.length > 0 ? <>
        <h3 className='fs-4'>{t('account.security.recoveryTitle')}</h3>
        <p className='text-gray-700'>{t('account.security.recoveryHelp')}</p>
        <div className='account-recovery-codes mb-5'>{recoveryCodes.map(value => <code key={value}>{value}</code>)}</div>
        <button type='button' className='btn btn-light-primary mb-5' onClick={download}>{t('account.security.download')}</button>
        <label className='form-check form-check-custom mb-6 gap-3'><input type='checkbox' className='form-check-input' checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /><span>{t('account.security.saved')}</span></label>
        <button type='button' className='btn btn-primary' disabled={!acknowledged || busy} onClick={finish}>{t('account.security.continue')}</button>
      </> : <>
        <p className='fs-6 text-gray-700'>{t('account.security.optionalHelp')}</p>
        {enabled && !secret && <div className='alert alert-success'>{t('account.security.active')}</div>}
        <form onSubmit={submit}>
          {secret ? <>
            <p className='text-gray-700'>{t('account.security.stepApp')}</p>
            <div className='account-mfa-setup mb-5'>
              {setupUri && <div className='account-mfa-qr'><QRCodeSVG value={setupUri} size={190} level='M' marginSize={2} title={t('account.security.qrLabel')} /></div>}
              <div><p className='fw-semibold text-gray-800'>{t('account.security.scanQr')}</p><p className='text-gray-700 mb-0'>{t('account.security.notGmail')}</p></div>
            </div>
            <button type='button' className='btn btn-link p-0 mb-3' onClick={() => setShowManualKey(value => !value)} aria-expanded={showManualKey}>{t('account.security.manualOption')}</button>
            {showManualKey && <div className='bg-light rounded p-4 mb-5'><p className='text-gray-700 mb-2'>{t('account.security.stepSecret')}</p><code className='fs-5 text-break user-select-all d-block mb-3' data-testid='mfa-secret'>{secret}</code><button type='button' className='btn btn-sm btn-light-primary' onClick={() => void navigator.clipboard.writeText(secret)}>{t('account.security.copyKey')}</button></div>}
          </> : <div className='mb-5'>
            <label htmlFor='mfa-password' className='form-label'>{t('account.security.password')}</label>
            <PasswordField id='mfa-password' value={password} autoComplete='current-password' required maxLength={128} onChange={e => setPassword(e.target.value)} />
          </div>}
          {(secret || enabled) && <div className='mb-5'>
            <label htmlFor='mfa-code' className='form-label'>{t(secret ? 'account.security.appCode' : 'account.security.code')}</label>
            <input id='mfa-code' className='form-control' autoComplete='one-time-code' value={code} required maxLength={secret ? 6 : 23} inputMode={secret ? 'numeric' : 'text'} pattern={secret ? '[0-9]{6}' : undefined} onChange={e => setCode(e.target.value)} />
          </div>}
          <button type='submit' className={`btn btn-${enabled && !secret ? 'light-danger' : 'primary'}`} disabled={busy}>{t(busy ? 'common.pleaseWait' : secret ? 'account.security.confirm' : enabled ? 'account.security.disable' : 'account.security.setup')}</button>
        </form>
      </>}
    </div>
  </section>
}
