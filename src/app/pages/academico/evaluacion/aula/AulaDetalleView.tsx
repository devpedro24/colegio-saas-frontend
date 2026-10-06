import {useState, type FormEvent} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Modal} from 'react-bootstrap'
import {useAula, useCrearSeccion, useEditarSeccion, useGuardarRecurso, useSubirPortadaAula,
  aulaPortadaUrl, type AulaResource, type ResourceInput} from './aula.api'

const blankResource = (): ResourceInput => ({tipo: 'texto', titulo: '', contenido: {bloques: [{tipo: 'parrafo', texto: ''}]},
  estado: 'borrador', visible_estudiantes: false, calificable: false, llevar_planilla: false,
  peso: null, disponible_desde: null, disponible_hasta: null, fecha_limite: null,
  configuracion: {entrega_tardia: false, reenvios: false, intentos: 1, duracion_minutos: 60,
    preguntas_por_pagina: 10, permitir_regresar: true, permitir_editar_respuestas: true,
    vigilado: false, incidentes_permitidos: 2, transferencia: 'confirmar'}})
const localDate = (iso: string | null, zone: string | null) => iso
  ? new Date(iso).toLocaleString('sv-SE', {timeZone: zone || 'America/Bogota', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).replace(' ', 'T').slice(0, 16) : ''

export function AulaDetalleView() {
  const {aulaToken = ''} = useParams()
  const navigate = useNavigate()
  const {data, isLoading, error} = useAula(aulaToken)
  const createSection = useCrearSeccion()
  const editSection = useEditarSeccion()
  const saveResource = useGuardarRecurso()
  const uploadCover = useSubirPortadaAula()
  const [sectionModal, setSectionModal] = useState(false)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [sectionForm, setSectionForm] = useState({titulo: '', periodo_token: '', preinforme_token: ''})
  const [resourceModal, setResourceModal] = useState(false)
  const [sectionToken, setSectionToken] = useState('')
  const [editing, setEditing] = useState<AulaResource | null>(null)
  const [resourceForm, setResourceForm] = useState<ResourceInput>(blankResource)
  const [message, setMessage] = useState('')
  if (isLoading) return <div className='card card-body'>Cargando aula…</div>
  if (error || !data) return <div className='alert alert-danger'>No se pudo abrir el aula. {error?.message}</div>
  const selectedPeriod = data.periodos.find(item => item.token === sectionForm.periodo_token)
  const openResource = (section: string, resource?: AulaResource) => {
    setSectionToken(section); setEditing(resource ?? null); setMessage('')
    setResourceForm(resource ? {tipo: resource.tipo, titulo: resource.titulo,
      contenido: resource.contenido ?? {bloques: []}, estado: resource.estado,
      visible_estudiantes: resource.visible_estudiantes, calificable: resource.calificable,
      llevar_planilla: resource.llevar_planilla, peso: resource.peso,
      disponible_desde: localDate(resource.disponible_desde, resource.zona_publicacion),
      disponible_hasta: localDate(resource.disponible_hasta, resource.zona_publicacion),
      fecha_limite: localDate(resource.fecha_limite, resource.zona_publicacion),
      configuracion: resource.configuracion ?? {}, version: resource.version} : blankResource())
    setResourceModal(true)
  }
  const submitSection = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    try {if (editingSection) await editSection.mutateAsync({token: editingSection, titulo: sectionForm.titulo})
      else await createSection.mutateAsync({aula: aulaToken, titulo: sectionForm.titulo,
        periodo_token: sectionForm.periodo_token, preinforme_token: sectionForm.preinforme_token || null})
      setSectionModal(false); setEditingSection(null); setSectionForm({titulo: '', periodo_token: '', preinforme_token: ''})
    } catch (cause) {setMessage(cause instanceof Error ? cause.message : 'No se pudo crear la sección.')}
  }
  const submitResource = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    try {await saveResource.mutateAsync({section: sectionToken, token: editing?.token, data: resourceForm})
      setResourceModal(false)
    } catch (cause) {setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar el recurso.')}
  }
  const toggleSection = async (token: string, visible: boolean) => {
    try {await editSection.mutateAsync({token, visible_estudiantes: visible})}
    catch (cause) {setMessage(cause instanceof Error ? cause.message : 'No se pudo cambiar la visibilidad.')}
  }

  return <div className='d-flex flex-column gap-6'>
    <div className='card'><div className='card-body d-flex flex-wrap align-items-center justify-content-between gap-4'>
      <div><button className='btn btn-link p-0 mb-2' onClick={() => navigate('/evaluacion/aula')}>← Volver a mis aulas</button>
        <h2 className='mb-1'>{data.materia}</h2><span className='text-muted'>{data.grupo}</span>
        {data.portada_token && <img className='d-block rounded mt-4' style={{width: 220, maxHeight: 110, objectFit: 'cover'}}
          src={aulaPortadaUrl(aulaToken)} alt={`Portada de ${data.materia}`} />}
        {data.puede_gestionar && <label className='form-label d-block mt-3'>Portada opcional (JPG, PNG o WebP)
          <input className='form-control' type='file' accept='image/png,image/jpeg,image/webp' disabled={uploadCover.isPending}
            onChange={event => {const file = event.target.files?.[0]; if (file) void uploadCover.mutateAsync({token: aulaToken,
              archivo: file}).then(() => setMessage('Portada guardada.')).catch(cause =>
              setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar la portada.'))}} /></label>}</div>
      {data.puede_gestionar && <button className='btn btn-success' onClick={() => {setMessage(''); setEditingSection(null); setSectionForm({titulo: '',
        periodo_token: data.periodos.find(item => item.estado === 'abierto')?.token ?? data.periodos[0]?.token ?? '', preinforme_token: ''}); setSectionModal(true)}}>
        + Sección</button>}
    </div></div>
    {message && <div className='alert alert-danger' role='alert'>{message}</div>}
    {data.secciones.length ? data.secciones.map(section => <section className='card' key={section.token}>
      <div className='card-header border-0 d-flex flex-wrap align-items-center justify-content-between gap-3 py-5'>
        <div><span className='text-muted fs-7'>{section.periodo}</span><h3 className='card-title mb-0'>{section.titulo}</h3></div>
        {data.puede_gestionar && <div className='d-flex align-items-center gap-3'>
          <label className='form-check form-switch mb-0'><input className='form-check-input' type='checkbox'
            checked={section.visible_estudiantes} onChange={event => void toggleSection(section.token, event.target.checked)} />
            <span className='form-check-label'>Visible para estudiantes</span></label>
          <button className='btn btn-sm btn-light-success' onClick={() => openResource(section.token)}>+ Recurso</button>
          <button className='btn btn-sm btn-light' onClick={() => {setMessage(''); setEditingSection(section.token);
            setSectionForm({titulo: section.titulo, periodo_token: section.periodo_token,
              preinforme_token: section.preinforme_token ?? ''}); setSectionModal(true)}}>Renombrar</button>
        </div>}
      </div><div className='card-body pt-0'>
        {section.recursos.length ? <div className='aula-resource-list'>{section.recursos.map(resource => <article key={resource.token} className='aula-resource-item'>
          <span className={`aula-resource-kind aula-resource-kind-${resource.tipo}`}>{resource.tipo}</span>
          <div className='flex-grow-1'><button className='btn btn-link p-0 text-start fw-semibold' onClick={() => navigate(`/evaluacion/aula/recursos/${resource.token}`)}>{resource.titulo}</button>
            <div className='text-muted fs-8'>{resource.estado}{resource.calificable ? ' · Calificable' : ''}
              {resource.actividad_token ? ' · En planilla' : resource.llevar_planilla ? ' · Vínculo pendiente' : ''}
              {!resource.visible_estudiantes && !data.estudiante ? ' · Oculto' : ''}</div></div>
          {data.puede_gestionar && <button className='btn btn-sm btn-light' onClick={() => openResource(section.token, resource)}>Editar</button>}
        </article>)}</div> : <div className='text-muted py-4'>Aún no hay materiales en esta sección.</div>}
      </div></section>) : <div className='card card-body text-center py-12 text-muted'>El aula todavía no tiene secciones.</div>}

    <Modal show={sectionModal} onHide={() => setSectionModal(false)} centered>
      <form onSubmit={event => void submitSection(event)}><Modal.Header closeButton><Modal.Title>{editingSection ? 'Renombrar sección' : 'Nueva sección'}</Modal.Title></Modal.Header>
        <Modal.Body><label className='form-label'>Nombre<input className='form-control' required maxLength={160} value={sectionForm.titulo}
          onChange={event => setSectionForm({...sectionForm, titulo: event.target.value})} placeholder='Semana 1, Primer corte…' /></label>
          {!editingSection && <><label className='form-label mt-4'>Período<select className='form-select' required value={sectionForm.periodo_token}
            onChange={event => setSectionForm({...sectionForm, periodo_token: event.target.value, preinforme_token: ''})}>
            <option value=''>Selecciona un período</option>{data.periodos.map(item => <option key={item.token} value={item.token} disabled={item.estado === 'cerrado'}>{item.nombre}</option>)}</select></label>
          {!!selectedPeriod?.preinformes.length && <label className='form-label mt-4'>Preinforme<select className='form-select' value={sectionForm.preinforme_token}
            onChange={event => setSectionForm({...sectionForm, preinforme_token: event.target.value})}><option value=''>Sin preinforme</option>
            {selectedPeriod.preinformes.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}</select></label>}</>}
        </Modal.Body><Modal.Footer><button type='button' className='btn btn-light' onClick={() => setSectionModal(false)}>Cancelar</button>
          <button className='btn btn-success' disabled={createSection.isPending || editSection.isPending}>
            {editingSection ? 'Guardar nombre' : 'Crear sección'}</button></Modal.Footer></form>
    </Modal>

    <Modal show={resourceModal} onHide={() => setResourceModal(false)} centered scrollable size='lg'>
      <form onSubmit={event => void submitResource(event)}><Modal.Header closeButton><Modal.Title>{editing ? 'Editar recurso' : 'Nuevo recurso'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className='row g-4'><div className='col-md-5'><label className='form-label'>Tipo<select className='form-select' value={resourceForm.tipo}
            onChange={event => setResourceForm({...resourceForm, tipo: event.target.value as ResourceInput['tipo'],
              calificable: event.target.value === 'texto' ? false : resourceForm.calificable,
              llevar_planilla: event.target.value === 'texto' ? false : resourceForm.llevar_planilla})}>
              <option value='texto'>Texto y diseño</option><option value='archivo'>Material</option><option value='tarea'>Tarea</option><option value='cuestionario'>Cuestionario interno</option>
            </select></label></div><div className='col-md-7'><label className='form-label'>Título<input className='form-control' required maxLength={160}
              value={resourceForm.titulo} onChange={event => setResourceForm({...resourceForm, titulo: event.target.value})} /></label></div></div>
          <div className='mt-5'><div className='d-flex justify-content-between'><h4>Contenido</h4><button type='button' className='btn btn-sm btn-light-success'
            onClick={() => setResourceForm({...resourceForm, contenido: {bloques: [...resourceForm.contenido.bloques, {tipo: 'parrafo', texto: ''}]}})}>+ Bloque</button></div>
            {resourceForm.contenido.bloques.map((block, index) => <div className='row g-2 mb-3' key={index}>
              <div className='col-md-3'><select aria-label={`Tipo de bloque ${index + 1}`} className='form-select' value={block.tipo}
                onChange={event => setResourceForm({...resourceForm, contenido: {bloques: resourceForm.contenido.bloques.map((item, at) => at === index ? {...item, tipo: event.target.value} : item)}})}>
                <option value='titulo'>Encabezado</option><option value='parrafo'>Párrafo</option><option value='aviso'>Aviso</option><option value='lista'>Lista</option><option value='tarjeta'>Tarjeta</option><option value='enlace'>Enlace</option></select></div>
              <div className='col-md-8'><textarea className='form-control' aria-label={`Texto del bloque ${index + 1}`} rows={2} value={block.texto ?? ''}
                onChange={event => setResourceForm({...resourceForm, contenido: {bloques: resourceForm.contenido.bloques.map((item, at) => at === index ? {...item, texto: event.target.value} : item)}})} /></div>
              <div className='col-md-1'><button type='button' className='btn btn-sm btn-light-danger' aria-label={`Quitar bloque ${index + 1}`}
                onClick={() => setResourceForm({...resourceForm, contenido: {bloques: resourceForm.contenido.bloques.filter((_, at) => at !== index)}})}>×</button></div>
              {block.tipo === 'enlace' && <div className='col-12'><input className='form-control' type='url' required
                aria-label={`Dirección del enlace ${index + 1}`} placeholder='https://ejemplo.com/recurso' value={block.url ?? ''}
                onChange={event => setResourceForm({...resourceForm, contenido: {bloques: resourceForm.contenido.bloques.map((item, at) =>
                  at === index ? {...item, url: event.target.value} : item)}})} /></div>}
            </div>)}</div>
          <div className='row g-4 mt-2'><div className='col-md-6'><label className='form-label'>Estado<select className='form-select' value={resourceForm.estado}
            onChange={event => setResourceForm({...resourceForm, estado: event.target.value})}><option value='borrador'>Borrador</option>
            <option value='programado'>Programado</option><option value='publicado'>Publicado</option><option value='cerrado'>Cerrado</option><option value='archivado'>Archivado</option></select></label></div>
            <div className='col-md-6 d-flex align-items-center'><label className='form-check form-switch'><input className='form-check-input' type='checkbox'
              checked={resourceForm.visible_estudiantes} onChange={event => setResourceForm({...resourceForm, visible_estudiantes: event.target.checked})} />Visible para estudiantes</label></div></div>
          {resourceForm.tipo !== 'texto' && <div className='d-flex flex-wrap gap-5 mt-4'>
            <label className='form-check form-switch'><input className='form-check-input' type='checkbox' checked={resourceForm.calificable}
              onChange={event => setResourceForm({...resourceForm, calificable: event.target.checked, llevar_planilla: event.target.checked && resourceForm.llevar_planilla})} />Es calificable</label>
            <label className='form-check form-switch'><input className='form-check-input' type='checkbox' disabled={!resourceForm.calificable}
              checked={resourceForm.llevar_planilla} onChange={event => setResourceForm({...resourceForm, llevar_planilla: event.target.checked})} />Llevar a planilla</label>
          </div>}
          {resourceForm.llevar_planilla && <label className='form-label mt-3'>Peso (%) si la planilla es ponderada<input className='form-control' type='number' min='0' max='100'
            value={resourceForm.peso ?? ''} onChange={event => setResourceForm({...resourceForm, peso: event.target.value || null})} /></label>}
          <div className='row g-3 mt-2'>{([['disponible_desde', 'Disponible desde'], ['disponible_hasta', 'Disponible hasta'],
            ['fecha_limite', 'Fecha límite']] as const).filter(([key]) => key !== 'fecha_limite' || resourceForm.tipo === 'tarea').map(([key, label]) =>
            <div className='col-md-4' key={key}><label className='form-label'>{label}<input className='form-control' type='datetime-local'
              value={resourceForm[key] ?? ''} onChange={event => setResourceForm({...resourceForm, [key]: event.target.value || null})} /></label></div>)}</div>
          {resourceForm.tipo === 'cuestionario' && <div className='row g-3 mt-2'><div className='col-md-3'><label className='form-label'>Intentos<input className='form-control' type='number' min='1' max='10'
            value={Number(resourceForm.configuracion?.intentos ?? 1)} onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion, intentos: Number(event.target.value)}})} /></label></div>
            <div className='col-md-3'><label className='form-label'>Duración (min)<input className='form-control' type='number' min='1' max='480'
              value={Number(resourceForm.configuracion?.duracion_minutos ?? 60)} onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion, duracion_minutos: Number(event.target.value)}})} /></label></div>
            <div className='col-md-3'><label className='form-label'>Incidentes permitidos<input className='form-control' type='number' min='0' max='20'
              value={Number(resourceForm.configuracion?.incidentes_permitidos ?? 2)} onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion, incidentes_permitidos: Number(event.target.value)}})} /></label></div>
            <div className='col-md-3 d-flex align-items-center'><label className='form-check form-switch'><input className='form-check-input' type='checkbox'
              checked={Boolean(resourceForm.configuracion?.vigilado)} onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion, vigilado: event.target.checked}})} />Modo vigilado</label></div></div>}
          {resourceForm.tipo === 'cuestionario' && <div className='d-flex flex-wrap gap-5 mt-4'>
            <label className='form-label'>Preguntas por página<input className='form-control' type='number' min='1' max='100'
              value={Number(resourceForm.configuracion?.preguntas_por_pagina ?? 10)}
              onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion,
                preguntas_por_pagina: Number(event.target.value)}})} /></label>
            <label className='form-check form-switch mt-7'><input className='form-check-input' type='checkbox'
              checked={Boolean(resourceForm.configuracion?.permitir_regresar ?? true)}
              onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion,
                permitir_regresar: event.target.checked}})} />Permitir regresar a páginas anteriores</label>
            <label className='form-check form-switch mt-7'><input className='form-check-input' type='checkbox'
              checked={Boolean(resourceForm.configuracion?.permitir_editar_respuestas ?? true)}
              onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion,
                permitir_editar_respuestas: event.target.checked}})} />Permitir editar respuestas guardadas</label>
          </div>}
          {resourceForm.tipo === 'cuestionario' && resourceForm.llevar_planilla && <label className='form-label mt-3'>Transferencia a planilla<select className='form-select'
            value={String(resourceForm.configuracion?.transferencia ?? 'confirmar')} onChange={event => setResourceForm({...resourceForm,
              configuracion: {...resourceForm.configuracion, transferencia: event.target.value}})}>
            <option value='confirmar'>Confirmación del docente (recomendado)</option><option value='automatica'>Automática para preguntas objetivas</option></select></label>}
          {resourceForm.tipo === 'tarea' && <div className='d-flex gap-5 mt-4'><label className='form-check'><input className='form-check-input' type='checkbox'
            checked={Boolean(resourceForm.configuracion?.entrega_tardia)} onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion, entrega_tardia: event.target.checked}})} />Permitir entrega tardía</label>
            <label className='form-check'><input className='form-check-input' type='checkbox' checked={Boolean(resourceForm.configuracion?.reenvios)}
              onChange={event => setResourceForm({...resourceForm, configuracion: {...resourceForm.configuracion, reenvios: event.target.checked}})} />Permitir reenvíos</label></div>}
          {message && <div className='alert alert-danger mt-4' role='alert'>{message}</div>}
        </Modal.Body><Modal.Footer><button className='btn btn-light' type='button' onClick={() => setResourceModal(false)}>Cancelar</button>
          <button className='btn btn-success' disabled={saveResource.isPending}>{editing ? 'Guardar cambios' : 'Crear recurso'}</button></Modal.Footer></form>
    </Modal>
  </div>
}
