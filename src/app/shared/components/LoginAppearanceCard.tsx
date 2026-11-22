import {lazy, Suspense, useEffect, useId, useRef, useState, type FormEvent} from 'react'
import {useIntl} from 'react-intl'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {ApiError, api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

type Appearance = {image_url: string | null; version: string; customized: boolean}
const defaultImage = '/media/misc/auth-screens.png'
const LoginAppearancePreview = lazy(() => import('./LoginAppearancePreview'))

export function LoginAppearanceCard({endpoint}: {endpoint: string}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const client = useQueryClient()
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const queryKey = ['login-appearance', endpoint, currentUser?.id, activeColegio?.slug]
  const query = useQuery({queryKey, queryFn: () => api.get<Appearance>(endpoint)})

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const save = useMutation({
    mutationFn: async (restore: boolean) => {
      if (!query.data) throw new Error(t('loginAppearance.loadError'))
      if (restore) return api.delete<Appearance>(endpoint, undefined, {version: query.data.version})
      const body = new FormData()
      body.append('version', query.data.version)
      if (file) body.append('image', file)
      return api.post<Appearance>(endpoint, body)
    },
    onSuccess: data => {
      client.setQueryData(queryKey, data)
      setFile(null)
      if (input.current) input.current.value = ''
      toast.success(t('loginAppearance.saved'))
    },
    onError: error => {
      toast.error(error instanceof ApiError ? error.fieldError('image') ?? error.message : error.message)
      if (error instanceof ApiError && error.status === 409) void query.refetch()
    },
  })

  const select = (selected: File | null) => {
    if (selected && (selected.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type))) {
      toast.error(t('loginAppearance.invalidFile'))
      if (input.current) input.current.value = ''
      setFile(null)
      return
    }
    setFile(selected)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (file && !save.isPending) save.mutate(false)
  }

  return <><section className='card mb-5'>
    <div className='card-header'><h3 className='card-title'>{t('loginAppearance.title')}</h3></div>
    <form onSubmit={submit}>
      <div className='card-body'>
        <p className='text-gray-600'>{t('loginAppearance.help')}</p>
        {query.isError ? <div className='alert alert-danger' role='alert'>
          {t('loginAppearance.loadError')}
          <button type='button' className='btn btn-sm btn-light ms-3' onClick={() => void query.refetch()}>{t('loginAppearance.retry')}</button>
        </div> : query.isPending ? <p role='status'>{t('loginAppearance.loading')}</p> : <>
          <div className='rounded-3 overflow-hidden mb-4' style={{maxWidth: 320, aspectRatio: '4 / 5', background: '#0b6fee'}}>
            <img src={preview || query.data.image_url || defaultImage} alt={t('loginAppearance.preview')}
              style={{display: 'block', width: '100%', height: '100%', objectFit: file || query.data.customized ? 'cover' : 'contain'}} />
          </div>
          <button type='button' className='btn btn-light-primary mb-6' onClick={() => setShowPreview(true)}>{t('loginAppearance.openPreview')}</button>
          <label className='visually-hidden' htmlFor={id}>{t('loginAppearance.choose')}</label>
          <input ref={input} id={id} type='file' className='form-control' accept='image/png,image/jpeg,image/webp'
            disabled={save.isPending} aria-describedby={`${id}-help`}
            onChange={event => select(event.target.files?.[0] ?? null)} />
          <p id={`${id}-help`} className='form-text'>{t('loginAppearance.formats')}</p>
          <p className='text-muted fs-7 mb-0'>{t('loginAppearance.publicNotice')}</p>
        </>}
      </div>
      <div className='card-footer d-flex justify-content-end flex-wrap gap-3'>
        <button type='button' className='btn btn-light' disabled={!query.data?.customized || save.isPending}
          onClick={() => save.mutate(true)}>{t('loginAppearance.restore')}</button>
        <button type='submit' className='btn btn-primary' disabled={!file || !query.data || save.isPending}>
          {t(save.isPending ? 'loginAppearance.saving' : 'loginAppearance.save')}
        </button>
      </div>
    </form>
  </section>
    {showPreview && <Suspense fallback={<p role='status'>{t('loginAppearance.loading')}</p>}>
      <LoginAppearancePreview imageUrl={preview || query.data?.image_url || null}
        isPlatform={endpoint === '/platform/login-appearance'} onHide={() => setShowPreview(false)} />
    </Suspense>}
  </>
}
