import {useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import {Link} from 'react-router-dom'
import {Navbar} from '@/_metronic/layout/components/header/Navbar'
import {ImpersonationBanner} from '@/app/modules/impersonation/ImpersonationBanner'
import {useLang} from '@/_metronic/i18n/Metronici18n'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {api} from '@/lib/api/client'
import {useWorkDraft} from '@/lib/drafts/WorkDrafts'
import {useTemplateActions, useTemplateCatalog, type CanvasDocument, type SavedTemplate, type TemplateCatalog, type TemplateInput} from './plantillas.api'
import './plantillas.css'

const channel = 'school-bulletin-editor-v1'
const selector = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{24}$/.test(value)
const isDocument = (value: unknown): value is CanvasDocument => !!value && typeof value === 'object'
  && typeof (value as CanvasDocument).id === 'string' && Array.isArray((value as CanvasDocument).pages)
type WorkingCopy = {doc: CanvasDocument; version: number} | null

/** The same-origin presentation frame delegates API transport and draft storage to this host. */
export default function CanvasTemplatePage() {
  const intl = useIntl()
  const lang = useLang()
  const [source, setSource] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/bulletin-editor/index.html', {signal: controller.signal}).then(response => {if (!response.ok) throw new Error(String(response.status)); return response.text()})
      .then(html => setSource(html.replace('<head>', '<head><base href="/bulletin-editor/">'))).catch(error => {if (error.name !== 'AbortError') setWarning(error.message)})
    return () => controller.abort()
  }, [])
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const frame = useRef<HTMLIFrameElement>(null)
  const catalog = useTemplateCatalog()
  const mutations = useTemplateActions()
  const records = useRef(new Map<string, SavedTemplate>())
  const [working, setWorking] = useState<WorkingCopy>(null)
  const [dirty, setDirty] = useState(false)
  const [warning, setWarning] = useState('')
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<'gallery' | 'editor'>('gallery')
  const t = (id: string) => intl.formatMessage({id})
  const identity = `${currentUser?.tenant_channel ?? ''}:${activeColegio?.slug ?? ''}:${currentUser?.id ?? ''}`
  const recovery = useWorkDraft<WorkingCopy>({context: 'bulletin-template-editor', title: working?.doc.name ?? t('templates.title'),
    value: working, dirty, base: String(working?.version ?? 0), enabled: catalog.data?.puede_editar,
    compatible: value => !!value && (!selector(value.doc.id) || records.current.get(value.doc.id)?.version === value.version),
    restore: value => {if (value && catalog.data?.puede_editar) {
      setWorking(value); setDirty(true)
      frame.current?.contentWindow?.postMessage({channel, action: 'restore', payload: value.doc}, window.location.origin)
    }},
    reset: () => {
      setWorking(null); setDirty(false)
      frame.current?.contentWindow?.postMessage({channel, action: 'discard'}, window.location.origin)
    },
    reviewCurrent: () => frame.current?.contentWindow?.postMessage({channel, action: 'preview'}, window.location.origin),
  })
  const handler = useRef<(event: MessageEvent) => Promise<void>>(async () => {})
  useEffect(() => {records.current.clear(); setWorking(null); setDirty(false); setReady(false)}, [identity])
  useEffect(() => {frame.current?.contentWindow?.postMessage({channel, action: 'locale', payload: lang}, window.location.origin)}, [lang])
  useEffect(() => {
    for (const row of catalog.data?.plantillas ?? []) records.current.set(row.token, row)
  }, [catalog.data])
  handler.current = async event => {
    const message = event.data
    if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow
      || !message || message.channel !== channel || typeof message.action !== 'string') return
    const respond = (payload?: unknown, error?: string) => {
      if (event.source === frame.current?.contentWindow) frame.current?.contentWindow?.postMessage(
        {channel, id: message.id, payload, error}, window.location.origin)
    }
    const payload = message.payload ?? {}
    try {
      if (message.action === 'view') {
        if (payload.mode === 'gallery' || payload.mode === 'editor') setView(payload.mode)
        if (payload.mode === 'gallery') {setWorking(null); setDirty(false)}
        return
      }
      if (message.action === 'discarded') {
        recovery.afterSave()(true); setWorking(null); setDirty(false); return
      }
      if (message.action === 'changed' || message.action === 'saved') {
        if (!isDocument(payload.doc)) return
        setWorking({doc: payload.doc, version: Number(payload.version) || 0})
        setDirty(message.action === 'changed' && payload.dirty === true)
        if (message.action === 'saved' || (dirty && payload.dirty === false && working?.doc.id === payload.doc.id)) recovery.afterSave()()
        return
      }
      if (message.action === 'warning') {setWarning(String(payload.message).slice(0,300)); return}
      if (typeof message.id !== 'string' || message.id.length > 80) return
      if (message.action === 'catalog' && catalog.data) {
        setReady(true)
        respond({items: catalog.data.plantillas, school: catalog.data.colegio,
          institution: catalog.data.institucion ?? {name: catalog.data.colegio},
          canEdit: catalog.data.puede_editar, lang, nextPage: 2, lastPage: catalog.data.ultima_pagina})
        return
      }
      if (message.action === 'catalog-more') {
        const page = Number(payload.page)
        if (!Number.isInteger(page) || page < 2 || page > (catalog.data?.ultima_pagina ?? 1)) throw new Error(t('common.error'))
        const data = await api.get<{data: TemplateCatalog}>(`/boletines/plantillas?opaque=1&page=${page}`)
        data.data.plantillas.forEach(row => records.current.set(row.token, row)); respond(data.data.plantillas); return
      }
      if (message.action === 'asset' && selector(payload.token)) {
        respond((await api.get<{data: {content: string}}>(`/boletines/plantillas/archivos/${payload.token}?opaque=1`)).data); return
      }
      if (message.action === 'versions' && selector(payload.token)) {
        respond((await api.get<{data: unknown[]}>(`/boletines/plantillas/${payload.token}/revisiones?opaque=1`)).data); return
      }
      if (!catalog.data?.puede_editar) throw new Error(t('templates.basicPlanHelp'))
      if (message.action === 'delete') {
        const version = Number(payload.version)
        if (!selector(payload.token) || !Number.isInteger(version) || version < 1) throw new Error(t('common.error'))
        respond(await mutations.remove.mutateAsync({token: payload.token, version}))
        records.current.delete(payload.token)
        if (working?.doc.id === payload.token) {setWorking(null); setDirty(false)}
        return
      }
      if (message.action === 'upload') {
        const content = payload.content
        if (typeof content !== 'string' || content.length > 2_850_000
          || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(content)) throw new Error(t('templates.editor.invalidImage'))
        const [head, encoded] = content.split(',')
        const mime = head.slice(5, head.indexOf(';'))
        const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2,'0')).join('')
        const data = new FormData()
        data.append('archivo', new File([bytes], `imagen-${hash.slice(0,16)}.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`, {type: mime}))
        respond((await api.post<{data: unknown}>('/boletines/plantillas/archivos?opaque=1', data)).data); return
      }
      if (message.action === 'save') {
        const input = payload.input as TemplateInput
        if (!input || !['periodo','final'].includes(input.ambito) || typeof input.nombre !== 'string'
          || !input.configuracion?.canvas || typeof input.configuracion.canvas.key !== 'string' || !Array.isArray(input.configuracion.canvas.pages)) throw new Error(t('common.error'))
        let item: SavedTemplate
        if (selector(payload.id)) {
          const version = Number(payload.version)
          if (!Number.isInteger(version) || version < 1) throw new Error(t('common.error'))
          item = payload.publish === true
            ? await mutations.publish.mutateAsync({token: payload.id, input: {...input, version}})
            : await mutations.save.mutateAsync({token: payload.id, input: {...input, version}})
        } else {
          item = await mutations.create.mutateAsync(input)
          if (payload.publish === true) {
            try {item = await mutations.publish.mutateAsync({token: item.token, input: {...input, version: item.version}})}
            catch (error) {setWarning(error instanceof Error ? error.message : t('common.error')); records.current.set(item.token,item); respond(item); return}
          }
        }
        records.current.set(item.token,item); setWarning(''); respond(item); return
      }
      throw new Error(t('common.error'))
    } catch (reason) {respond(undefined, reason instanceof Error ? reason.message : t('common.error'))}
  }
  useEffect(() => {
    const listener = (event: MessageEvent) => {void handler.current(event)}
    window.addEventListener('message',listener)
    return () => window.removeEventListener('message',listener)
  }, [identity])
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {if(dirty){event.preventDefault(); event.returnValue=''}}
    window.addEventListener('beforeunload',leave)
    return () => window.removeEventListener('beforeunload',leave)
  }, [dirty])
  return <div className={`bulletin-studio bulletin-studio--${view}`}>
    {view === 'gallery' && <header className='bulletin-studio-head'>
      <Link to='/dashboard' className='bulletin-studio-home' aria-label={t('templates.editor.home')}>
        <img src={catalog.data?.institucion?.logo || '/media/logo-colegio-transparent.png'} alt={t('templates.editor.schoolLogo')} />
      </Link>
      <h1>{t('templates.title')}</h1>
      <div className='bulletin-studio-profile'><Navbar minimal /></div>
    </header>}
    <div className='bulletin-studio-notices'>
      <ImpersonationBanner />
      {catalog.isError && <div className='alert alert-danger' role='alert'>{catalog.error.message}</div>}
      {catalog.data && !catalog.data.puede_editar && <div className='alert alert-info'>{t('templates.basicPlanHelp')}</div>}
      {warning && <div className='alert alert-warning' role='alert'>{warning}</div>}
      {view === 'gallery' && <div className='bulletin-studio-draft-notice'>{recovery.notice}</div>}
      {!ready && !catalog.isError && <div className='bulletin-studio-loading' role='status'>{t('common.pleaseWait')}</div>}
    </div>
    {catalog.data && <iframe key={identity} ref={frame} title={t('templates.editor.title')}
      srcDoc={source || undefined} className='bulletin-studio-frame' referrerPolicy='same-origin' />}
  </div>
}
