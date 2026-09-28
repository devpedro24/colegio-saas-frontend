import {useState, type FormEvent} from 'react'
import {Link, useSearchParams} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'

export function ResetPassword() {
  const intl = useIntl()
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = (id: string) => intl.formatMessage({id}, {name: ''})
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/reset-password', {email: params.get('email'), token: params.get('token'), password, password_confirmation: confirmation})
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.error'))
    } finally { setBusy(false) }
  }
  return <form className='form w-100' onSubmit={submit}>
    <h1 className='mb-8'>{t('security.reset.title')}</h1>
    {error && <div role='alert' className='alert alert-danger'>{error}</div>}
    {done ? <div className='alert alert-success'>{t('security.reset.done')}</div> : <>
      <p className='text-muted'>{t('security.reset.help')}</p>
      <label className='form-label' htmlFor='new-password'>{t('security.reset.password')}</label>
      <input id='new-password' className='form-control mb-6' type='password' required minLength={12} autoComplete='new-password' value={password} onChange={e => setPassword(e.target.value)} />
      <label className='form-label' htmlFor='confirm-password'>{t('security.reset.confirm')}</label>
      <input id='confirm-password' className='form-control mb-6' type='password' required minLength={12} autoComplete='new-password' value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      <button className='btn btn-primary w-100 mb-6' disabled={busy || !params.get('token')}>{t('common.save')}</button>
    </>}
    <Link to='/auth/login'>{t('security.reset.login')}</Link>
  </form>
}
