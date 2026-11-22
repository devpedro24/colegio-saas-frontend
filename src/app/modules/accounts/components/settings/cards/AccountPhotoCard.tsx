import {useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import {useAuth} from '../../../../auth'
import {api, ApiError} from '@/lib/api/client'
import type {UserModel} from '../../../../auth'
import {useToast} from '@/lib/ui/toast'

export function AccountPhotoCard() {
  const {currentUser, setCurrentUser} = useAuth()
  const intl = useIntl(), toast = useToast()
  const t = (id: string) => intl.formatMessage({id})
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!file) {setPreview(null); return}
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  if (currentUser?.roles.includes('estudiante')) return null
  return <section className='card mb-5'><div className='card-header'><h3 className='card-title'>{t('account.photo.title')}</h3></div>
    <form onSubmit={async event => {
      event.preventDefault()
      if (!file || busy) return
      setBusy(true)
      try {
        const body = new FormData(); body.append('image', file)
        const data = await api.post<{user: UserModel}>('/account/photo', body)
        setCurrentUser(data.user); setFile(null)
        if (input.current) input.current.value = ''
        toast.success(t('account.photo.saved'))
      } catch (error) {toast.error(error instanceof ApiError ? error.fieldError('image') ?? error.message : t('common.toast.saveError'))}
      finally {setBusy(false)}
    }}><div className='card-body'>
      {(preview || currentUser?.avatar_url) && <img src={preview || currentUser?.avatar_url || ''} alt={t('account.photo.title')} className='rounded-circle mb-5 d-block' style={{width:100,height:100,objectFit:'cover'}} />}
      <label className='form-label' htmlFor='account-photo'>{t('account.photo.title')}</label>
      <input ref={input} id='account-photo' type='file' className='form-control' accept='image/png,image/jpeg,image/webp' disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
      <p className='form-text'>{t('account.photo.help')}</p>
    </div><div className='card-footer text-end'><button className='btn btn-primary' disabled={!file || busy}>{t('account.photo.save')}</button></div></form>
  </section>
}
