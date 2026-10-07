import {useState, type FormEvent} from 'react'
import {AulaRichEditor} from './AulaRichEditor'
import {AulaAttachmentGallery} from './AulaAttachmentGallery'
import {type AulaResource, type AulaSection, type ResourceInput,
  useGuardarRecurso, usePlanillaDestino, useSubirAdjunto} from './aula.api'

type Kind = ResourceInput['tipo']
const kinds: {id: Kind; icon: string; title: string; detail: string}[] = [
  {id: 'texto', icon: '▤', title: 'Lectura', detail: 'Texto y contenido para consultar'},
  {id: 'archivo', icon: '▣', title: 'Material', detail: 'Documentos y recursos de apoyo'},
  {id: 'tarea', icon: '✓', title: 'Tarea', detail: 'Consignas y entregas de estudiantes'},
  {id: 'cuestionario', icon: '☷', title: 'Cuestionario', detail: 'Preguntas y evaluación'},
]
const localDate = (iso: string | null, zone: string | null) => iso
  ? new Date(iso).toLocaleString('sv-SE', {timeZone: zone || 'America/Bogota', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).replace(' ', 'T').slice(0, 16) : ''
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#39;'}[char] ?? char))
function priorHtml(resource: AulaResource | null): string {
  if (!resource) return ''
  if (resource.contenido?.html) return resource.contenido.html
  return (resource.contenido?.bloques ?? []).map(block => {
    const text = escape(block.texto ?? '').replace(/\n/g, '<br>')
    if (block.tipo === 'titulo') return `<h2>${text}</h2>`
    if (block.tipo === 'enlace') return `<p><a href="${escape(block.url ?? '')}">${text}</a></p>`
    if (block.tipo === 'lista') return `<ul>${(block.texto ?? '').split('\n').filter(Boolean)
      .map(line => `<li>${escape(line)}</li>`).join('')}</ul>`
    if (block.tipo === 'aviso' || block.tipo === 'tarjeta')
      return `<div class="aula-rich-${block.tipo === 'aviso' ? 'note' : 'card'}">${text}</div>`
    return `<p>${text}</p>`
  }).join('')
}
const blank = (section: string): ResourceInput => ({tipo: 'texto', titulo: '', seccion_token: section,
  contenido: {bloques: [], html: ''}, estado: 'borrador', visible_estudiantes: false,
  calificable: false, llevar_planilla: false, peso: null, disponible_desde: null, disponible_hasta: null,
  configuracion: {reenvios: false, intentos: 1, duracion_minutos: 60, preguntas_por_pagina: 10,
    mezclar_preguntas: false, mezclar_respuestas: false,
    duracion_minima_minutos: 0,
    permitir_regresar: true, permitir_editar_respuestas: true, vigilado: false,
    incidentes_permitidos: 2, transferencia: 'confirmar'}})
function initial(resource: AulaResource | null, section: string): ResourceInput {
  if (!resource) return blank(section)
  return {tipo: resource.tipo, titulo: resource.titulo, seccion_token: section,
    contenido: resource.contenido ?? {bloques: []}, estado: resource.estado,
    visible_estudiantes: resource.visible_estudiantes, calificable: resource.calificable,
    llevar_planilla: resource.llevar_planilla, peso: resource.peso,
    disponible_desde: localDate(resource.disponible_desde, resource.zona_publicacion),
    disponible_hasta: localDate(resource.disponible_hasta ?? (resource.tipo === 'tarea' ? resource.fecha_limite : null),
      resource.zona_publicacion), configuracion: resource.configuracion ?? {}, version: resource.version}
}

export function AulaResourceComposer({section, sections, periods, allowClosedContent, resource, limitBytes, canChangeFiles, canPublish,
  canLinkGradebook, canManageQuiz, onClose, onSaved}: {
  section: string; sections: AulaSection[]; periods: {token: string; estado: string}[];
  allowClosedContent: boolean; resource: AulaResource | null; limitBytes: number;
  canChangeFiles: boolean; canPublish: boolean; canLinkGradebook: boolean; canManageQuiz: boolean;
  onClose: () => void; onSaved: (token: string) => void
}) {
  const save = useGuardarRecurso()
  const upload = useSubirAdjunto()
  const [form, setForm] = useState<ResourceInput>(() => initial(resource, section))
  const [html, setHtml] = useState(() => priorHtml(resource))
  const [files, setFiles] = useState<File[]>([])
  const [savedFiles, setSavedFiles] = useState(resource?.adjuntos ?? [])
  const [savedToken, setSavedToken] = useState(resource?.token ?? '')
  const [pendingPublication, setPendingPublication] = useState(false)
  const [savedVersion, setSavedVersion] = useState(resource?.version ?? 1)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const set = (patch: Partial<ResourceInput>) => setForm(current => ({...current, ...patch}))
  const setOption = (key: string, value: unknown) => setForm(current => ({...current,
    configuracion: {...current.configuracion, [key]: value}}))
  const changeKind = (tipo: Kind) => setForm(current => ({...current, tipo,
    configuracion: {...current.configuracion, completar_al: tipo === 'tarea' ? 'entregar' : tipo === 'cuestionario' ? 'finalizar' : 'abrir'},
    visible_estudiantes: tipo === 'cuestionario' && !(resource?.preguntas?.length) ? false : current.visible_estudiantes,
    calificable: tipo === 'texto' || tipo === 'archivo' ? false : current.calificable,
    llevar_planilla: tipo === 'texto' || tipo === 'archivo' ? false : current.llevar_planilla}))
  const selectedSection = sections.find(item => item.token === form.seccion_token)
  const closedPeriod = periods.find(period => period.token === selectedSection?.periodo_token)?.estado === 'cerrado'
  const editableContent = !closedPeriod || allowClosedContent
  const editableFiles = canChangeFiles && editableContent
  const destination = usePlanillaDestino(form.seccion_token ?? section,
    canLinkGradebook && form.llevar_planilla && !resource?.actividad_token && !closedPeriod)
  const selectedComponent = destination.data?.componentes.find(item =>
    item.token === form.configuracion?.planilla_componente_token) ??
    (destination.data?.componentes.length === 1 ? destination.data.componentes[0] : undefined)
  const addFiles = (chosen: FileList | null) => {
    if (!chosen) return
    const list = Array.from(chosen)
    if (list.some(file => file.size > limitBytes)) {
      setError(`Cada archivo debe pesar máximo ${Math.round(limitBytes / 1024 / 1024)} MB.`); return
    }
    if (files.length + list.length + savedFiles.length > 30) {
      setError('Cada recurso admite hasta 30 archivos.'); return
    }
    setError(''); setFiles(current => [...current, ...list])
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setProgress('')
    if (!editableContent) {setError('El colegio bloqueó los cambios de contenido en períodos cerrados.'); return}
    if (form.llevar_planilla && !resource?.actividad_token && closedPeriod) {
      setError('No se puede vincular a planilla un recurso de un período cerrado. Desactiva «Llevar a planilla» para guardar el contenido.'); return
    }
    if (form.llevar_planilla && !resource?.actividad_token) {
      if (!destination.data || destination.isError) {
        setError('No se pudo verificar la planilla de destino. Revisa la asignación y tus permisos.'); return
      }
      if (destination.data.requiere_preinforme) {
        setError('Esta planilla requiere preinforme. Selecciona una sección del Aula que lo tenga configurado.'); return
      }
      if (destination.data.componentes.length > 1 && !selectedComponent) {
        setError('Selecciona la sección de la planilla donde se creará la actividad.'); return
      }
      if (selectedComponent?.modo === 'WEIGHTED_AVERAGE' && !form.peso) {
        setError('Esta planilla es ponderada. Indica el peso de la actividad.'); return
      }
    }
    let resourceSaved = false
    const publishAfterFiles = (pendingPublication || (!savedToken && files.length > 0)) && form.visible_estudiantes
    try {
      const payload: ResourceInput = {...form, version: savedVersion,
        contenido: {bloques: resource?.contenido?.bloques ?? [], html},
        configuracion: form.llevar_planilla && !resource?.actividad_token && destination.data
          ? {...form.configuracion, planilla_componente_token: selectedComponent?.token ?? null} : form.configuracion,
        visible_estudiantes: publishAfterFiles ? false : form.visible_estudiantes,
        estado: publishAfterFiles ? 'borrador' : form.visible_estudiantes ? 'publicado' : 'borrador'}
      const result = await save.mutateAsync({section: form.seccion_token ?? section, token: savedToken || undefined, data: payload})
      resourceSaved = true
      if (publishAfterFiles) setPendingPublication(true)
      const token = savedToken || result.data.token
      setSavedToken(token)
      const nextVersion = 'version' in result.data ? Number(result.data.version) : 1
      setSavedVersion(nextVersion)
      for (const file of files) {
        setProgress(`Subiendo ${file.name}…`)
        await upload.mutateAsync({token, archivo: file, destino: 'recursos'})
        setFiles(current => current.filter(item => item !== file))
      }
      if (publishAfterFiles) {
        setProgress('Publicando el recurso…')
        const published = await save.mutateAsync({section: form.seccion_token ?? section, token,
          data: {...payload, visible_estudiantes: true, estado: 'publicado', version: nextVersion}})
        setSavedVersion('version' in published.data ? Number(published.data.version) : nextVersion + 1)
      }
      setPendingPublication(false)
      onSaved(token)
    } catch (cause) {setProgress(''); setError(`${cause instanceof Error ? cause.message : 'No se pudo completar la operación.'}${resourceSaved
      ? publishAfterFiles ? ' El recurso quedó guardado como borrador: revisa los archivos pendientes y vuelve a guardar para publicarlo.'
        : ' El recurso sí se guardó, pero puede haber archivos pendientes. Revisa el resultado antes de reintentar.'
      : ''}`)}
  }

  return <section className='aula-editor-page'>
    <button className='btn btn-link p-0 mb-5' onClick={onClose}>← Contenido del aula</button>
    <div className='aula-main-head'><div><span className='aula-eyebrow'>{selectedSection?.titulo ?? 'Aula'}</span>
      <h1>{resource ? 'Editar recurso' : 'Agregar recurso'}</h1>
      <p className='text-muted mb-0'>Prepara el contenido y sus archivos en esta misma página.</p></div></div>
    <form className='aula-inline-form aula-resource-form' onSubmit={event => void submit(event)}>
      <div className='fw-semibold mb-3'>Tipo de contenido</div>
      <div className='aula-kind-grid' role='group' aria-label='Tipo de recurso'>
        {kinds.filter(kind => kind.id !== 'cuestionario' || canManageQuiz || resource?.tipo === 'cuestionario').map(kind => <button type='button' key={kind.id}
          className={`aula-kind-option aula-kind-option-${kind.id} ${form.tipo === kind.id ? 'is-selected' : ''}`}
          aria-pressed={form.tipo === kind.id} onClick={() => changeKind(kind.id)}>
          <span className='aula-kind-icon' aria-hidden='true'>{kind.icon}</span>
          <span><strong>{kind.title}</strong><small>{kind.detail}</small></span></button>)}
      </div>
      <div className='row g-4 mt-2'><div className='col-md-7'><label className='form-label fw-semibold'>Título
        <input className='form-control mt-2' required maxLength={160} value={form.titulo}
          disabled={!!resource?.actividad_token} onChange={event => set({titulo: event.target.value})}
          placeholder='Título del recurso' /></label></div>
        <div className='col-md-5'><label className='form-label fw-semibold'>Sección
          <select className='form-select mt-2' value={form.seccion_token ?? section}
            onChange={event => setForm(current => ({...current, seccion_token: event.target.value,
              configuracion: {...current.configuracion, planilla_componente_token: null}}))}>
            {sections.map(item => <option key={item.token} value={item.token}
              disabled={!allowClosedContent && periods.find(period => period.token === item.periodo_token)?.estado === 'cerrado'}>
              {item.periodo} · {item.titulo}</option>)}</select>
        </label></div></div>
      <div className='mt-6'><label className='form-label fw-semibold'>Contenido e indicaciones</label>
        <AulaRichEditor initialHtml={html} onChange={setHtml} /></div>
      <div className='aula-composer-settings mt-5'><div className='d-flex justify-content-between align-items-center flex-wrap gap-4'>
        <div><strong>Archivos adjuntos</strong><p className='text-muted fs-7 mb-0'>PDF, presentaciones, documentos, hojas de cálculo,
          imágenes, audio o video. Hasta 30 archivos de {Math.round(limitBytes / 1024 / 1024)} MB cada uno.</p></div>
        {editableFiles && <label className='btn btn-light-primary mb-0'>+ Elegir archivos<input className='visually-hidden' type='file' multiple
          accept='.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp3,.ogg,.mp4,.webm'
          onChange={event => {addFiles(event.target.files); event.target.value = ''}} /></label>}</div>
        {!!savedFiles.length && <AulaAttachmentGallery files={savedFiles} canRemove={editableFiles}
          onRemoved={token => setSavedFiles(current => current.filter(file => file.token !== token))} />}
        {!editableFiles && <div className='alert alert-warning mt-4 mb-0'>No puedes modificar los archivos de este recurso{!editableContent ? ': el colegio bloqueó la edición en períodos cerrados.' : '.'}</div>}
        {!!files.length && <div className='aula-selected-files mt-4'>{files.map((file, index) =>
          <div key={`${file.name}-${index}`} className='aula-selected-file'><span>{file.name}</span>
            <button className='btn btn-sm btn-light-danger' type='button' aria-label={`Quitar ${file.name}`}
              onClick={() => setFiles(current => current.filter((_, at) => at !== index))}>Quitar</button></div>)}</div>}
      </div>
      <div className='aula-composer-settings mt-4'><div className='d-flex align-items-center justify-content-between gap-4 flex-wrap'>
        <div><strong>Publicación</strong><div className='text-muted fs-7'>Puedes guardarlo oculto y publicarlo después.</div></div>
        {canPublish && <label className='form-check form-switch mb-0'><input type='checkbox' className='form-check-input aula-visibility-toggle'
          checked={form.visible_estudiantes} onChange={event => set({visible_estudiantes: event.target.checked})} />
          <span className='form-check-label'>Visible para estudiantes</span></label>}</div>
        {form.visible_estudiantes && !selectedSection?.visible_estudiantes && <div className='alert alert-warning py-2 mt-3 mb-0'>
          Esta sección está oculta. Publícala también para que los estudiantes vean el recurso.</div>}
        {form.tipo === 'cuestionario' && !resource?.preguntas?.length && <p className='text-muted mt-3 mb-0'>Guarda este cuestionario oculto, agrega sus preguntas y después publícalo.</p>}
      </div>
      {(form.tipo === 'tarea' || form.tipo === 'cuestionario') && <div className='aula-composer-settings mt-4'><strong>Evaluación</strong>
        <div className='d-flex flex-wrap gap-5 mt-3'><label className='form-check form-switch'>
          <input className='form-check-input' type='checkbox' checked={form.calificable}
            disabled={!!resource?.actividad_token}
            onChange={event => set({calificable: event.target.checked,
              llevar_planilla: event.target.checked && form.llevar_planilla})} />Es calificable</label>
          {(canLinkGradebook || form.llevar_planilla) && <label className='form-check form-switch'><input className='form-check-input' type='checkbox'
            checked={form.llevar_planilla} disabled={!canLinkGradebook || !form.calificable || !!resource?.actividad_token || (closedPeriod && !form.llevar_planilla)}
            onChange={event => set({llevar_planilla: event.target.checked})} />Llevar a planilla</label>}</div>
        {closedPeriod && <p className='text-warning mt-2 mb-0'>{allowClosedContent
          ? 'Puedes preparar y publicar contenido, pero no vincularlo a la planilla de este período cerrado.'
          : 'El colegio bloqueó los cambios de contenido en este período cerrado.'}</p>}
        {form.llevar_planilla && <div className='mt-4'>
          {resource?.actividad_token ? <p className='text-muted mb-0'>Actividad ya vinculada a la planilla.</p> : <>
            {destination.isLoading && <p role='status'>Comprobando la planilla de destino…</p>}
            {destination.isError && <p className='text-danger' role='alert'>No se pudo comprobar la planilla. Comprueba que haya docente asignado y permiso para registrar notas.</p>}
            {destination.data && <div className='border rounded p-4'>
              <strong>Destino de la calificación</strong>
              <p className='mb-2'>{destination.data.grupo} · {destination.data.asignatura} · {destination.data.periodo}
                {destination.data.preinforme ? ` · ${destination.data.preinforme}` : ''}</p>
              {destination.data.requiere_preinforme && <p className='text-danger mb-2'>Esta planilla requiere un preinforme. Cambia la sección del Aula.</p>}
              {destination.data.estado_periodo === 'planificado' && <p className='text-warning mb-2'>El vínculo quedará pendiente hasta que se abra el período.</p>}
              {destination.data.componentes.length > 1 && <label className='form-label w-100'>Sección de la planilla
                <select className='form-select mt-2' value={String(form.configuracion?.planilla_componente_token ?? '')}
                  onChange={event => setOption('planilla_componente_token', event.target.value || null)}>
                  <option value=''>Selecciona una sección</option>
                  {destination.data.componentes.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
                </select></label>}
              {selectedComponent && <p className='mb-0'>Cálculo: {selectedComponent.modo === 'WEIGHTED_AVERAGE' ? 'ponderado' : 'promedio simple'}
                {selectedComponent.modo === 'WEIGHTED_AVERAGE' ? ` · peso usado: ${selectedComponent.peso_utilizado} %` : ''}</p>}
              {!destination.data.componentes.length && <p className='mb-0'>Se creará la primera sección de notas al abrir la planilla.</p>}
            </div>}
          </>}
          <label className='form-label mt-3'>Peso (%) {selectedComponent?.modo === 'WEIGHTED_AVERAGE' ? 'obligatorio' : 'si la planilla es ponderada'}
            <input className='form-control mt-2' type='number' min='0.01' max='100' step='0.01' value={form.peso ?? ''}
              disabled={!!resource?.actividad_token} onChange={event => set({peso: event.target.value || null})} /></label>
        </div>}
      </div>}
      <div className='aula-composer-settings mt-4'><strong>Disponibilidad</strong>
        <p className='text-muted fs-7 mb-3'>Las fechas usan la zona horaria del colegio.</p>
        <div className='row g-3'><div className='col-md-6'><label className='form-label'>Disponible desde
          <input className='form-control mt-2' type='datetime-local' value={form.disponible_desde ?? ''}
            onChange={event => set({disponible_desde: event.target.value || null})} /></label></div>
          <div className='col-md-6'><label className='form-label'>Disponible hasta
            <input className='form-control mt-2' type='datetime-local' value={form.disponible_hasta ?? ''}
              onChange={event => set({disponible_hasta: event.target.value || null})} /></label></div></div>
        {form.tipo === 'tarea' && <div className='text-muted fs-7 mt-2'>La disponibilidad hasta es también el plazo de entrega.</div>}
      </div>
      <div className='aula-composer-settings mt-4'><strong>Finalización para el estudiante</strong>
        {form.tipo === 'tarea' ? <label className='form-label d-block mt-3'>Marcar como completada
          <select className='form-select mt-2' value={String(form.configuracion?.completar_al ?? 'entregar')}
            onChange={event => setOption('completar_al', event.target.value)}>
            <option value='abrir'>Al abrir la tarea</option>
            <option value='entregar'>Al enviar la entrega</option>
            <option value='revisar'>Cuando el docente revise o califique la entrega</option>
          </select></label> : form.tipo === 'cuestionario' ? <label className='form-label d-block mt-3'>Marcar como completado
          <select className='form-select mt-2' value={String(form.configuracion?.completar_al ?? 'finalizar')}
            onChange={event => setOption('completar_al', event.target.value)}>
            <option value='finalizar'>Al finalizar el cuestionario</option>
            <option value='revisar'>Cuando termine la revisión de respuestas abiertas</option>
          </select></label> : <p className='text-muted fs-7 mt-2 mb-0'>Se completa automáticamente cuando el estudiante abre el recurso.</p>}
      </div>
      {form.tipo === 'cuestionario' && <div className='aula-composer-settings mt-4'><strong>Opciones del cuestionario</strong>
        <div className='d-flex flex-wrap gap-5 mt-4'><label className='form-check form-switch'>
          <input className='form-check-input' type='checkbox' checked={Boolean(form.configuracion?.mezclar_preguntas)}
            onChange={event => setOption('mezclar_preguntas', event.target.checked)} />Mezclar preguntas</label>
          <label className='form-check form-switch'><input className='form-check-input' type='checkbox'
            checked={Boolean(form.configuracion?.mezclar_respuestas)}
            onChange={event => setOption('mezclar_respuestas', event.target.checked)} />Mezclar respuestas</label></div>
        <p className='text-muted fs-7 mt-2 mb-3'>Cada estudiante recibe un orden fijo y diferente por intento. Las respuestas de emparejamiento y ordenamiento siempre se presentan mezcladas.</p>
        <div className='row g-3 mt-1'><div className='col-sm-3'><label className='form-label'>Intentos
          <input className='form-control mt-2' type='number' min='1' max='10' value={Number(form.configuracion?.intentos ?? 1)}
            onChange={event => setOption('intentos', Number(event.target.value))} /></label></div>
          <div className='col-sm-3'><label className='form-label'>Tiempo mínimo (min)
            <input className='form-control mt-2' type='number' min='0' max='480' value={Number(form.configuracion?.duracion_minima_minutos ?? 0)}
              onChange={event => setOption('duracion_minima_minutos', Number(event.target.value))} /></label></div>
          <div className='col-sm-3'><label className='form-label'>Tiempo máximo (min)
            <input className='form-control mt-2' type='number' min='1' max='480' value={Number(form.configuracion?.duracion_minutos ?? 60)}
              onChange={event => setOption('duracion_minutos', Number(event.target.value))} /></label></div>
          <div className='col-sm-3'><label className='form-label'>Incidentes permitidos
            <input className='form-control mt-2' type='number' min='0' max='20'
              value={Number(form.configuracion?.incidentes_permitidos ?? 2)}
              onChange={event => setOption('incidentes_permitidos', Number(event.target.value))} /></label></div></div>
        <div className='d-flex flex-wrap gap-5 mt-4'><label className='form-check form-switch'>
          <input className='form-check-input' type='checkbox' checked={Boolean(form.configuracion?.vigilado)}
            onChange={event => setOption('vigilado', event.target.checked)} />Modo vigilado</label>
          <label className='form-check form-switch'><input className='form-check-input' type='checkbox'
            checked={Boolean(form.configuracion?.permitir_regresar ?? true)}
            onChange={event => setOption('permitir_regresar', event.target.checked)} />Permitir regresar</label>
          <label className='form-check form-switch'><input className='form-check-input' type='checkbox'
            checked={Boolean(form.configuracion?.permitir_editar_respuestas ?? true)}
            onChange={event => setOption('permitir_editar_respuestas', event.target.checked)} />Editar respuestas</label></div>
        <label className='form-label mt-4'>Preguntas por página
          <input className='form-control mt-2' type='number' min='1' max='100'
            value={Number(form.configuracion?.preguntas_por_pagina ?? 10)}
            onChange={event => setOption('preguntas_por_pagina', Number(event.target.value))} /></label>
        {form.llevar_planilla && <label className='form-label d-block mt-4'>Transferencia a planilla
          <select className='form-select mt-2' value={String(form.configuracion?.transferencia ?? 'confirmar')}
            onChange={event => setOption('transferencia', event.target.value)}>
            <option value='confirmar'>Confirmación del docente</option>
            <option value='automatica'>Automática para respuestas objetivas</option></select></label>}
      </div>}
      {form.tipo === 'tarea' && <div className='aula-composer-settings mt-4'><label className='form-check form-switch mb-0'>
        <input className='form-check-input' type='checkbox' checked={Boolean(form.configuracion?.reenvios)}
          onChange={event => setOption('reenvios', event.target.checked)} />Permitir reenvíos</label></div>}
      {progress && <div className='alert alert-info mt-4' role='status'>{progress}</div>}
      {error && <div className='alert alert-danger mt-4' role='alert'>{error}</div>}
      <div className='aula-form-actions'><button type='button' className='btn btn-light' onClick={onClose}>Cancelar</button>
        <button className='btn btn-success' disabled={save.isPending || upload.isPending}>
          {save.isPending || upload.isPending ? 'Guardando…' : resource ? 'Guardar cambios' : 'Crear recurso'}</button></div>
    </form>
  </section>
}
