import {useEffect, useRef, useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {api} from '@/lib/api/client'
import {usePublishedTemplates, type SavedTemplate, type TemplateInstitution, type TemplateScope} from '../plantillas.api'
import '../boletines.css'

const channel = 'school-bulletin-preview-v1'

function CanvasPreview({item, institution, large = false}: {item: SavedTemplate; institution: TemplateInstitution; large?: boolean}) {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const client = useQueryClient()
  const intl = useIntl()
  const frame = useRef<HTMLIFrameElement>(null)
  const canvas = item.configuracion.canvas
  const source = useQuery({queryKey: ['bulletin-preview-source'], staleTime: Infinity,
    queryFn: () => fetch('/bulletin-editor/template-preview.html').then(response => {if (!response.ok) throw new Error('Preview unavailable'); return response.text()})
      .then(html => html.replace('<head>', '<head><base href="/bulletin-editor/">'))})
  const images = useQuery({queryKey: ['boletines', 'template-preview-assets', currentUser?.tenant_channel, activeColegio?.slug, currentUser?.id, item.token, item.revision_publicada],
    queryFn: async () => Object.fromEntries(await Promise.all(Object.entries(canvas?.assets ?? {}).map(async ([key, token]) => {
      if (!/^[A-Za-z0-9_-]{24}$/.test(token)) throw new Error('Invalid image reference')
      const content = await client.fetchQuery({queryKey: ['boletines', 'template-asset', currentUser?.tenant_channel, activeColegio?.slug, currentUser?.id, token],
        queryFn: () => api.get<{data: {content: string}}>(`/boletines/plantillas/archivos/${token}?opaque=1`).then(row => row.data.content), staleTime: 15 * 60_000})
      return [key, content]
    }))), staleTime: 15 * 60_000})
  const send = useRef(() => {})
  send.current = () => {
    if (images.data && canvas) frame.current?.contentWindow?.postMessage({channel, action: 'render', payload: {
      document: canvas, scope: item.ambito, institution, assets: images.data, mode: large ? 'full' : 'thumbnail', lang: intl.locale,
    }}, window.location.origin)
  }
  useEffect(() => {
    const ready = (event: MessageEvent) => {if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.channel === channel && event.data.action === 'ready') send.current()}
    window.addEventListener('message', ready)
    return () => window.removeEventListener('message', ready)
  }, [])
  useEffect(() => {send.current()}, [images.data, canvas, institution, large, intl.locale])
  if (!canvas || images.isError) return <div className='template-preview-unavailable'><i className='bi bi-file-earmark-text' aria-hidden='true' /><span>{item.nombre}</span></div>
  return <iframe ref={frame} srcDoc={source.data || undefined} title={intl.formatMessage({id: 'boletines.picker.previewOf'}, {name: item.nombre})}
    className={large ? 'template-full-preview' : 'template-thumbnail'} onLoad={() => send.current()} tabIndex={large ? 0 : -1} />
}

export function TemplateSelection({scope, value, onChange, enabled, disabled = false}: {
  scope: TemplateScope; value: string; onChange: (token: string) => void; enabled: boolean; disabled?: boolean
}) {
  const intl = useIntl(), t = (id: string) => intl.formatMessage({id})
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<SavedTemplate | null>(null)
  const carousel = useRef<HTMLDivElement>(null)
  const drag = useRef<{x: number; left: number} | null>(null)
  const moved = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [edges, setEdges] = useState({previous: false, next: false})
  const query = usePublishedTemplates(scope, enabled && (open || !!value))
  const pages = query.data?.pages ?? [], items = pages.flatMap(page => page.plantillas)
  const institution = pages[0]?.institucion ?? {name: pages[0]?.colegio ?? ''}
  const selected = items.find(item => item.token === value)
  const updateEdges = () => {
    const node = carousel.current
    if (node) setEdges({previous: node.scrollLeft > 2, next: node.scrollLeft + node.clientWidth < node.scrollWidth - 2})
  }
  useEffect(() => {
    const node = carousel.current
    if (!node || !open || preview) return
    const observer = new ResizeObserver(updateEdges)
    observer.observe(node)
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || node.scrollWidth <= node.clientWidth + 2 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      if ((event.deltaY > 0 && node.scrollLeft + node.clientWidth < node.scrollWidth - 2) || (event.deltaY < 0 && node.scrollLeft > 2)) {
        event.preventDefault()
        node.scrollBy({left: event.deltaY})
      }
    }
    node.addEventListener('wheel', wheel, {passive: false})
    updateEdges()
    return () => {observer.disconnect(); node.removeEventListener('wheel', wheel)}
  }, [items.length, open, preview])
  const move = (direction: number) => {
    const node = carousel.current
    node?.scrollBy({left: direction * (node.clientWidth + 18), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'})
  }
  const choose = (item: SavedTemplate) => {onChange(item.token); setPreview(null); setOpen(false)}
  const close = () => {if (preview) setPreview(null); else setOpen(false)}
  return <>
    <button type='button' className='bulletin-template-trigger' disabled={disabled || !enabled} onClick={() => {setPreview(null); setOpen(true)}}>
      <span className='bulletin-template-icon'><i className='bi bi-grid-1x2' aria-hidden='true' /></span>
      <span><small>{t('boletines.issue.template')}</small><strong>{selected?.nombre ?? t('boletines.picker.select')}</strong></span><i className='bi bi-chevron-down ms-auto' aria-hidden='true' />
    </button>
    <Modal show={open} onHide={close} centered scrollable size='xl' backdrop='static' className={preview ? 'bulletin-design-preview-modal' : 'bulletin-picker-modal'} aria-labelledby='bulletin-picker-title'>
      <Modal.Header><div><Modal.Title id='bulletin-picker-title'>{preview?.nombre ?? t('boletines.picker.title')}</Modal.Title><p className='mb-0 mt-1 text-muted fs-7'>{t(preview ? 'templates.sampleOnly' : 'boletines.picker.help')}</p></div>
        <button type='button' className='bulletin-modal-close' aria-label={t('common.close')} onClick={close}><i className='ki-outline ki-cross' aria-hidden='true' /></button>
      </Modal.Header>
      <Modal.Body className={preview ? 'p-0' : 'p-5'}>{preview ? <CanvasPreview item={preview} institution={institution} large /> : <>
        {query.isPending && <p role='status'>{t('common.pleaseWait')}</p>}
        {query.isError && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
        {query.isSuccess && !items.length && <p>{t('boletines.picker.empty')}</p>}
        {(edges.previous || edges.next) && <div className='bulletin-carousel-nav'>
          <button type='button' className='bulletin-carousel-arrow' disabled={!edges.previous} aria-label={t('boletines.issue.previous')} onClick={() => move(-1)}><i className='bi bi-chevron-left' aria-hidden='true' /></button>
          <button type='button' className='bulletin-carousel-arrow' disabled={!edges.next} aria-label={t('boletines.issue.next')} onClick={() => move(1)}><i className='bi bi-chevron-right' aria-hidden='true' /></button>
        </div>}
        <div ref={carousel} className={`bulletin-template-carousel ${dragging ? 'is-dragging' : ''}`} role='region' aria-label={t('boletines.picker.title')} tabIndex={0} onScroll={updateEdges}
          onKeyDown={event => {if (event.target === event.currentTarget && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1)}}}
          onPointerDown={event => {if (event.pointerType !== 'mouse' || event.button !== 0) return; moved.current = false; drag.current = {x: event.clientX, left: event.currentTarget.scrollLeft}}}
          onPointerMove={event => {if (!drag.current || event.currentTarget.scrollWidth <= event.currentTarget.clientWidth + 2) return
            const delta = event.clientX - drag.current.x
            if (Math.abs(delta) > 6 && !moved.current) {moved.current = true; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId)}
            if (moved.current) event.currentTarget.scrollLeft = drag.current.left - delta}}
          onPointerUp={() => {drag.current = null; setDragging(false)}} onPointerCancel={() => {drag.current = null; setDragging(false)}}
          onPointerLeave={() => {if (!moved.current) drag.current = null}}
          onClickCapture={event => {if (moved.current) {event.preventDefault(); event.stopPropagation(); moved.current = false}}}>
          {items.map(item => <article key={item.token} className={`bulletin-template-option ${item.token === value ? 'is-selected' : ''}`}>
          <button type='button' className='bulletin-template-cover' onClick={() => setPreview(item)} aria-label={intl.formatMessage({id: 'boletines.picker.previewOf'}, {name: item.nombre})}><CanvasPreview item={item} institution={institution} /></button>
          <div className='p-4'><h4>{item.nombre}</h4><p className='text-muted fs-8'>{t(scope === 'final' ? 'boletines.issue.final' : 'boletines.issue.period')} · {t('boletines.issue.revision')} {item.revision_publicada}</p>
            <div className='d-flex gap-2'><button className='btn btn-sm bulletin-blue-button flex-grow-1' type='button' onClick={() => choose(item)}>{t(item.token === value ? 'boletines.picker.selected' : 'boletines.picker.use')}</button>
              <button type='button' className='btn btn-sm btn-light-info' onClick={() => setPreview(item)} aria-label={intl.formatMessage({id: 'boletines.picker.previewOf'}, {name: item.nombre})}><i className='bi bi-eye' aria-hidden='true' /></button></div>
          </div></article>)}</div>
        {query.hasNextPage && <button type='button' className='btn btn-light-info mt-4' disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t(query.isFetchingNextPage ? 'common.pleaseWait' : 'boletines.picker.more')}</button>}
        </>}
      </Modal.Body>
      {preview && <Modal.Footer><button type='button' className='btn btn-light' onClick={close}>{t('common.close')}</button><button type='button' className='btn bulletin-blue-button' onClick={() => choose(preview)}>{t('boletines.picker.use')}</button></Modal.Footer>}
    </Modal>
  </>
}
