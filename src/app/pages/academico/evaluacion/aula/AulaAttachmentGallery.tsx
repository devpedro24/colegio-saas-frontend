import {useEffect, useId, useRef, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import Modal from 'react-bootstrap/Modal'
import {aulaAdjuntoUrl, aulaImagenUrl, aulaMedioUrl, aulaOficinaUrl,
  useQuitarAdjunto, type AulaAttachment} from './aula.api'

const extension = (file: AulaAttachment) => file.nombre.match(/\.([^.]+)$/)?.[1]?.toUpperCase() ?? 'ARCHIVO'
const isOffice = (file: AulaAttachment) => ['DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX'].includes(extension(file))

function FileThumbnail({file}: {file: AulaAttachment}) {
  if (file.es_imagen) return <span className='aula-material-thumb'>
    <img src={aulaImagenUrl(file.token)} alt='' loading='lazy' />
  </span>

  const format = extension(file)
  const family = file.mime === 'application/pdf' || format === 'PDF' ? 'pdf'
    : ['DOC', 'DOCX'].includes(format) ? 'word'
    : ['XLS', 'XLSX', 'CSV'].includes(format) ? 'excel'
    : ['PPT', 'PPTX'].includes(format) ? 'powerpoint'
    : ['ZIP', 'RAR', '7Z'].includes(format) ? 'archive'
    : file.mime?.startsWith('audio/') ? 'audio'
    : file.mime?.startsWith('video/') ? 'video' : 'generic'
  const icons = {
    pdf: 'bi-file-earmark-pdf-fill', word: 'bi-file-earmark-word-fill',
    excel: 'bi-file-earmark-excel-fill', powerpoint: 'bi-file-earmark-ppt-fill',
    archive: 'bi-file-earmark-zip-fill', audio: 'bi-file-earmark-music-fill',
    video: 'bi-file-earmark-play-fill', generic: 'bi-file-earmark-fill',
  }
  return <span className={`aula-material-thumb aula-material-thumb-${family}`}>
    <i className={`bi ${icons[family]} aula-material-file-icon`} aria-hidden='true' />
    <span className='aula-material-format' aria-hidden='true'>{format}</span>
  </span>
}

type OfficeConfiguration = {script_url: string; config: Record<string, unknown>}
type OfficeEditor = {destroyEditor: () => void}
type DocsApi = {DocEditor: new (id: string, config: Record<string, unknown>) => OfficeEditor}
declare global {interface Window {DocsAPI?: DocsApi}}

const scripts = new Map<string, Promise<void>>()
function loadOfficeScript(url: string): Promise<void> {
  const existing = scripts.get(url)
  if (existing) return existing
  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = () => window.DocsAPI ? resolve() : reject(new Error('El visor Office no se inició.'))
    script.onerror = () => reject(new Error('No se pudo conectar con el visor Office autoalojado.'))
    document.head.appendChild(script)
  }).catch(error => {scripts.delete(url); throw error})
  scripts.set(url, loading)
  return loading
}

function OfficeViewer({settings}: {settings: OfficeConfiguration}) {
  const id = `aula-office-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let editor: OfficeEditor | undefined
    const placeholder = document.createElement('div')
    placeholder.id = id
    placeholder.style.width = '100%'
    placeholder.style.height = '100%'
    const host = container.current
    host?.replaceChildren(placeholder)
    setError('')
    void loadOfficeScript(settings.script_url).then(() => {
      if (!active || !window.DocsAPI) return
      editor = new window.DocsAPI.DocEditor(id, {
        ...settings.config,
        width: '100%', height: '100%',
        events: {onError: () => {if (active) setError('El visor no pudo abrir este documento.')}},
      })
    }).catch(cause => {if (active) setError(cause instanceof Error ? cause.message : 'No se pudo abrir el visor.')})
    return () => {active = false; editor?.destroyEditor(); host?.replaceChildren()}
  }, [id, settings])

  return <div className='aula-office-viewer'>
    {error && <div className='aula-preview-message' role='alert'>{error} El archivo original sigue disponible para descargar.</div>}
    <div ref={container} className='aula-office-placeholder' />
  </div>
}

function Preview({file}: {file: AulaAttachment}) {
  const office = isOffice(file)
  const officeSettings = useQuery({queryKey: ['aula-vista-oficina', file.token], enabled: office,
    staleTime: 5 * 60_000, gcTime: 5 * 60_000, retry: false,
    queryFn: async ({signal}) => {
      const response = await fetch(aulaOficinaUrl(file.token), {credentials: 'same-origin', signal})
      if (!response.ok) {
        const result = await response.json().catch(() => null) as {message?: string} | null
        throw new Error(result?.message ?? 'No se pudo cargar la vista previa.')
      }
      const result = await response.json() as {data: OfficeConfiguration}
      if (!result.data?.script_url || !result.data.config?.token)
        throw new Error('La configuración del visor Office está incompleta.')
      return result.data
    },
  })

  if (file.es_imagen) return <img className='aula-preview-image' src={aulaImagenUrl(file.token)} alt={file.nombre} />
  if (file.mime === 'application/pdf') return <iframe className='aula-preview-frame'
    title={`Vista previa de ${file.nombre}`} src={aulaMedioUrl(file.token)} />
  if (office && officeSettings.data) return <OfficeViewer settings={officeSettings.data} />
  if (office && officeSettings.isPending) return <div className='aula-preview-message' role='status'>Abriendo documento Office…</div>
  if (office && officeSettings.isError) return <div className='aula-preview-message' role='alert'>
    {officeSettings.error instanceof Error ? officeSettings.error.message : 'No se pudo previsualizar.'} Puedes descargar el archivo original.
  </div>
  if (file.mime?.startsWith('audio/')) return <audio className='aula-preview-audio' controls src={aulaMedioUrl(file.token)} />
  if (file.mime?.startsWith('video/')) return <video className='aula-preview-video' controls src={aulaMedioUrl(file.token)} />
  return <div className='aula-preview-message'>No hay vista previa para este formato. Puedes descargar el archivo.</div>
}

export function AulaAttachmentGallery({files, canRemove = false, onRemoved}: {files: AulaAttachment[];
  canRemove?: boolean; onRemoved?: (token: string) => void}) {
  const remove = useQuitarAdjunto()
  const [active, setActive] = useState<string | null>(null)
  const [error, setError] = useState('')
  const activeIndex = files.findIndex(file => file.token === active)
  const selected = files[activeIndex]
  const change = (step: number) => setActive(files[(activeIndex + step + files.length) % files.length]?.token ?? null)
  const discard = async (file: AulaAttachment) => {
    if (!window.confirm(`¿Quitar «${file.nombre}» de este recurso?`)) return
    setError('')
    try {
      await remove.mutateAsync(file.token)
      if (active === file.token) setActive(null)
      onRemoved?.(file.token)
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'No se pudo quitar el archivo.')}
  }
  return <>
    {error && <div className='alert alert-danger mt-3' role='alert'>{error}</div>}
    <div className={`aula-material-grid ${files.length === 1 ? 'is-single' : ''}`}>
      {files.map(file => <article className='aula-material' key={file.token}>
      <button type='button' className='aula-material-open' onClick={() => setActive(file.token)}
        aria-label={`Previsualizar ${file.nombre}`}>
        <FileThumbnail file={file} /><span className='aula-material-name'>{file.nombre}</span>
        <span className='aula-material-hint'>Abrir vista previa ↗</span>
      </button>
      {files.length === 1 && <div className='aula-material-inline'><Preview file={file} /></div>}
      <div className='aula-material-actions'><a className='btn btn-sm aula-download-button' href={aulaAdjuntoUrl(file.token)}>Descargar</a>
        {canRemove && <button className='btn btn-sm btn-light-danger' type='button' disabled={remove.isPending}
          onClick={() => void discard(file)}>Quitar</button>}</div>
    </article>)}</div>
    <Modal show={!!selected} onHide={() => setActive(null)} fullscreen className='aula-preview-modal'>
      {selected && <><Modal.Header closeButton><div className='aula-preview-header'>
        <span className='aula-preview-type'>{extension(selected)}</span>
        <div><strong>{selected.nombre}</strong><small>Archivo {activeIndex + 1} de {files.length}</small></div>
      </div></Modal.Header><Modal.Body><Preview key={selected.token} file={selected} /></Modal.Body>
        <Modal.Footer>
          {files.length > 1 && <div className='aula-preview-navigation'>
            <button className='btn btn-light' onClick={() => change(-1)} aria-label='Archivo anterior'>← Anterior</button>
            <button className='btn btn-light' onClick={() => change(1)} aria-label='Archivo siguiente'>Siguiente →</button>
          </div>}
          <a className='btn aula-download-button' href={aulaAdjuntoUrl(selected.token)}>Descargar original</a>
        </Modal.Footer></>}
    </Modal>
  </>
}
