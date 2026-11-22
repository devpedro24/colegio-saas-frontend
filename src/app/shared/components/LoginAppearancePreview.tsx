import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {AuthScreen} from '@/app/modules/auth/AuthScreen'
import {Login} from '@/app/modules/auth/components/Login'
import './LoginAppearancePreview.css'

const frameDocument = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body id="kt_body" class="notranslate"><div id="root" inert></div></body></html>'

export default function LoginAppearancePreview({imageUrl, isPlatform, onHide}: {
  imageUrl: string | null; isPlatform: boolean; onHide: () => void
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const container = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [mobile, setMobile] = useState(false)
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const width = mobile ? 390 : 1440
  const height = mobile ? 844 : 900
  const scale = containerWidth ? Math.min(1, containerWidth / width) : 1

  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  const prepareFrame = (frame: HTMLIFrameElement) => {
    const target = frame.contentDocument
    if (!target) return
    target.documentElement.lang = intl.locale
    target.documentElement.setAttribute('data-bs-theme', document.documentElement.getAttribute('data-bs-theme') || 'light')
    for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) {
      const copy = style.cloneNode(true) as HTMLElement
      if (style instanceof HTMLLinkElement) (copy as HTMLLinkElement).href = style.href
      target.head.appendChild(copy)
    }
    setRoot(target.getElementById('root'))
  }

  return <Modal show onHide={onHide} size='xl' fullscreen='md-down' centered scrollable dialogClassName='login-preview-dialog'>
    <Modal.Header closeButton><Modal.Title>{t('loginAppearance.previewTitle')}</Modal.Title></Modal.Header>
    <Modal.Body>
      <div className='d-flex align-items-center flex-wrap gap-3 mb-4'>
        <div className='btn-group' role='group' aria-label={t('loginAppearance.previewTitle')}>
          <button type='button' className={`btn btn-sm ${mobile ? 'btn-light' : 'btn-primary'}`} aria-pressed={!mobile} onClick={() => setMobile(false)}>{t('loginAppearance.desktop')}</button>
          <button type='button' className={`btn btn-sm ${mobile ? 'btn-primary' : 'btn-light'}`} aria-pressed={mobile} onClick={() => setMobile(true)}>{t('loginAppearance.mobile')}</button>
        </div>
        <span className='text-muted fs-7'>{width} × {height}</span>
      </div>
      <p className='text-muted fs-7'>{t('loginAppearance.previewHelp')}</p>
      <div ref={container} className='login-preview-viewport'>
        <div className='login-preview-viewport__size' style={{width: width * scale, height: height * scale}}>
          <iframe title={t('loginAppearance.previewTitle')} srcDoc={frameDocument} sandbox='allow-same-origin'
            tabIndex={-1} onLoad={event => prepareFrame(event.currentTarget)}
            style={{width, height, transform: `scale(${scale})`, transformOrigin: 'top left'}} />
        </div>
      </div>
      {root && createPortal(<AuthScreen imageUrl={imageUrl} isPlatform={isPlatform}>
        <Login showEnrollmentEntry={!isPlatform} />
      </AuthScreen>, root)}
    </Modal.Body>
    <Modal.Footer><button type='button' className='btn btn-light' onClick={onHide}>{t('loginAppearance.closePreview')}</button></Modal.Footer>
  </Modal>
}
