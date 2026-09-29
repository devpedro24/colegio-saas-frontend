import {useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent} from 'react'
import {useIntl} from 'react-intl'
import {ApiError, api} from '@/lib/api/client'
import './LogoUploader.css'

type Aspect = 'auto' | 'square'
type Drag = {x: number; y: number; offsetX: number; offsetY: number}

type Props = {
  existingUrl?: string | null
  saveLabel: string
  onSaved: () => Promise<void>
  onContinue?: () => void
}

const HEIGHT = 300
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function LogoUploader({existingUrl, saveLabel, onSaved, onContinue}: Props) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [aspect, setAspect] = useState<Aspect>('auto')
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let bitmap: ImageBitmap | null = null
    if (!file) { setImage(null); return }
    if (file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type)) {
      setError(intl.formatMessage({id: 'logo.invalidFile'}))
      setImage(null)
      return
    }
    void createImageBitmap(file).then(decoded => {
      bitmap = decoded
      if (cancelled) { decoded.close(); return }
      if (decoded.width < 200 || decoded.height < 100 || decoded.width > 6000 || decoded.height > 6000) {
        setError(intl.formatMessage({id: 'logo.invalidDimensions'}))
        setImage(null)
        return
      }
      setError('')
      setImage(decoded)
    }).catch(() => { if (!cancelled) setError(intl.formatMessage({id: 'logo.invalidFile'})) })
    return () => { cancelled = true; bitmap?.close() }
  }, [file, intl])

  const ratio = image && aspect === 'auto' ? clamp(image.width / image.height, 1, 3) : 1
  const canvasWidth = Math.round(HEIGHT * ratio)
  const scale = image ? (aspect === 'square'
    ? Math.max(canvasWidth / image.width, HEIGHT / image.height)
    : Math.min(canvasWidth / image.width, HEIGHT / image.height)) * zoom : 1
  const drawnWidth = image ? Math.round(image.width * scale) : 0
  const drawnHeight = image ? Math.round(image.height * scale) : 0
  const overflowX = Math.max(0, drawnWidth - canvasWidth)
  const overflowY = Math.max(0, drawnHeight - HEIGHT)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvasWidth, HEIGHT)
    context.imageSmoothingQuality = 'high'
    const x = Math.round((canvasWidth - drawnWidth) / 2 - offsetX * overflowX / 2)
    const y = Math.round((HEIGHT - drawnHeight) / 2 - offsetY * overflowY / 2)
    context.drawImage(image, x, y, drawnWidth, drawnHeight)
  }, [image, canvasWidth, drawnWidth, drawnHeight, overflowX, overflowY, offsetX, offsetY])

  const selectFile = (selected: File | null) => {
    setFile(selected)
    setImage(null)
    setAspect('auto')
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
    setError('')
  }

  const changeAspect = (next: Aspect) => {
    setAspect(next)
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
  }

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!image || (!overflowX && !overflowY)) return
    dragRef.current = {x: event.clientX, y: event.clientY, offsetX, offsetY}
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current
    const canvas = canvasRef.current
    if (!start || !canvas) return
    const bounds = canvas.getBoundingClientRect()
    if (overflowX && bounds.width) {
      const delta = (event.clientX - start.x) * canvasWidth / bounds.width
      setOffsetX(clamp(start.offsetX - 2 * delta / overflowX, -1, 1))
    }
    if (overflowY && bounds.height) {
      const delta = (event.clientY - start.y) * HEIGHT / bounds.height
      setOffsetY(clamp(start.offsetY - 2 * delta / overflowY, -1, 1))
    }
  }

  const stopDrag = () => { dragRef.current = null; setDragging(false) }

  const moveWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' && overflowX) setOffsetX(value => clamp(value + 0.1, -1, 1))
    else if (event.key === 'ArrowRight' && overflowX) setOffsetX(value => clamp(value - 0.1, -1, 1))
    else if (event.key === 'ArrowUp' && overflowY) setOffsetY(value => clamp(value + 0.1, -1, 1))
    else if (event.key === 'ArrowDown' && overflowY) setOffsetY(value => clamp(value - 0.1, -1, 1))
    else return
    event.preventDefault()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || !image) return
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('logo', file)
      body.append('aspect', aspect)
      body.append('zoom', String(zoom))
      body.append('offset_x', String(offsetX))
      body.append('offset_y', String(offsetY))
      await api.post('/onboarding/logo', body)
      await onSaved()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.fieldError('logo') ?? cause.message : t('onboarding.saveError'))
    } finally {
      setBusy(false)
    }
  }

  return <form className='logo-uploader' onSubmit={save}>
    {error && <div className='alert alert-danger' role='alert'>{error}</div>}
    <label className='form-label fw-bold' htmlFor='school-logo-file'>{t('onboarding.selectLogo')}</label>
    <input
      id='school-logo-file'
      type='file'
      accept='.png,.jpg,.jpeg,image/png,image/jpeg'
      className='form-control logo-uploader-file'
      onChange={event => selectFile(event.target.files?.[0] ?? null)}
    />

    {image && <div className='logo-uploader-modes' role='group' aria-label={t('logo.shapeLabel')}>
      <button type='button' className={aspect === 'auto' ? 'is-active' : ''} aria-pressed={aspect === 'auto'} onClick={() => changeAspect('auto')}>{t('logo.keepShape')}</button>
      <button type='button' className={aspect === 'square' ? 'is-active' : ''} aria-pressed={aspect === 'square'} onClick={() => changeAspect('square')}>{t('logo.cropSquare')}</button>
    </div>}

    <div className='logo-uploader-editor'>
      <div
        className={`logo-uploader-preview${image ? ' is-editable' : ''}${dragging ? ' is-dragging' : ''}`}
        style={image ? {aspectRatio: `${canvasWidth} / ${HEIGHT}`, maxWidth: aspect === 'square' ? 360 : 450} : undefined}
        role='img'
        aria-label={image ? t('logo.dragHint') : t('onboarding.logoPreview')}
        tabIndex={image ? 0 : undefined}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onKeyDown={moveWithKeys}
      >
        {image ? <canvas ref={canvasRef} width={canvasWidth} height={HEIGHT} />
          : <img src={existingUrl ?? '/media/logo-colegio-transparent.png'} alt={t('onboarding.logoPreview')} />}
        {image && (overflowX > 0 || overflowY > 0) && <span className='logo-uploader-drag-hint' aria-hidden='true'><i className='bi bi-arrows-move' /> {t('logo.dragHint')}</span>}
      </div>

      {image && <div className='logo-uploader-controls'>
        <div className='logo-uploader-zoom'>
          <button type='button' aria-label={t('logo.zoomOut')} disabled={zoom <= 1} onClick={() => setZoom(value => clamp(Math.round((value - 0.1) * 100) / 100, 1, 3))}>−</button>
          <input type='range' min='1' max='3' step='0.05' value={zoom} aria-label={t('logo.zoom')} onChange={event => setZoom(Number(event.target.value))} />
          <button type='button' aria-label={t('logo.zoomIn')} disabled={zoom >= 3} onClick={() => setZoom(value => clamp(Math.round((value + 0.1) * 100) / 100, 1, 3))}>+</button>
        </div>
        <button type='button' className='logo-uploader-reset' onClick={() => {setZoom(1); setOffsetX(0); setOffsetY(0)}}>{t('logo.reset')}</button>
      </div>}
      {image && <p className='logo-uploader-caption'>{aspect === 'square' ? t('logo.squareHelp') : t('logo.autoHelp')}</p>}
    </div>

    <div className='logo-uploader-actions'>
      {existingUrl && onContinue && <button type='button' className='btn btn-light' onClick={onContinue}>{t('onboarding.continue')}</button>}
      <button type='submit' className='btn btn-success' disabled={!image || busy}>
        {busy ? t('onboarding.processing') : saveLabel}
        {!busy && <i className='bi bi-arrow-right ms-2' aria-hidden='true' />}
      </button>
    </div>
  </form>
}
