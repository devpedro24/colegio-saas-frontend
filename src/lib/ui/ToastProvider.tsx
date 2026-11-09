import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FC, type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {useLang} from '@/_metronic/i18n/Metronici18n'
import messages from './toast.messages.json'
import './toast.css'

import {ToastContext, type ToastApi, type ToastVariant} from './toast.context'

type ToastItem = {id: number; message: string; variant: ToastVariant}
const DURATION = 5000
let counter = 0

function ToastIcon({variant}: {variant: ToastVariant}) {
  return <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
    {variant === 'success' && <><circle cx='12' cy='12' r='9' /><path d='m8 12 2.5 2.5L16 9' /></>}
    {variant === 'updated' && <><path d='m14 5 5 5M4 20l5-1L20 8a2.1 2.1 0 0 0-5-5L4 14Z' /><path d='m4 14 5 5' /></>}
    {variant === 'deleted' && <path d='M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7' />}
    {variant === 'warning' && <><path d='m10.3 3.8-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.2l-8-14a2 2 0 0 0-3.4 0Z' /><path d='M12 9v4m0 4h.01' /></>}
    {variant === 'danger' && <><circle cx='12' cy='12' r='9' /><path d='m9 9 6 6m0-6-6 6' /></>}
    {variant === 'info' && <path d='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2v1' />}
  </svg>
}

function ToastNotice({item, remove}: {item: ToastItem; remove: (id: number) => void}) {
  const lang = useLang(), copy = messages[lang]
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false)
  const paused = hovered || focused
  const remaining = useRef(DURATION)
  useEffect(() => {
    if (paused) return
    const started = performance.now()
    const timer = window.setTimeout(() => remove(item.id), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (performance.now() - started))
    }
  }, [item.id, paused, remove])

  return <div className={`toast show app-toast app-toast--${item.variant}${paused ? ' is-paused' : ''}`}
    role={item.variant === 'danger' ? 'alert' : 'status'} aria-live={item.variant === 'danger' ? 'assertive' : 'polite'} aria-atomic='true'
    style={{'--toast-duration': `${DURATION}ms`} as CSSProperties}
    onPointerEnter={event => {if (event.pointerType !== 'touch') setHovered(true)}} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
    }}>
    <span className='app-toast-icon'><ToastIcon variant={item.variant} /></span>
    <p className='app-toast-message'><span className='visually-hidden'>{copy[item.variant]}: </span>{item.message}</p>
    <button type='button' className='app-toast-close' aria-label={copy.dismiss} onClick={() => remove(item.id)}>
      <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' aria-hidden='true'><path d='m4 4 8 8m0-8-8 8' /></svg>
    </button>
    <span className='app-toast-timer' aria-hidden='true'><span /></span>
  </div>
}

export const ToastProvider: FC<{children: ReactNode}> = ({children}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const lang = useLang()
  const remove = useCallback((id: number) => setToasts(prev => prev.filter(item => item.id !== id)), [])
  const show = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++counter
    setToasts(prev => [...prev, {id, message, variant}])
  }, [])
  const api = useMemo<ToastApi>(() => ({show,
    success: (message, variant = 'success') => show(message, variant),
    error: message => show(message, 'danger'), warning: message => show(message, 'warning'), info: message => show(message, 'info'),
  }), [show])
  return <ToastContext.Provider value={api}>
    {children}
    {toasts.length > 0 && createPortal(<section className='toast-container app-toast-region' aria-label={messages[lang].region}>
      {toasts.map(item => <ToastNotice key={item.id} item={item} remove={remove} />)}
    </section>, document.body)}
  </ToastContext.Provider>
}
