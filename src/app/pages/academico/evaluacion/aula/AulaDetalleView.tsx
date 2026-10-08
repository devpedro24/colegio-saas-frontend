import {Fragment, useEffect, useState, type FormEvent} from 'react'
import {useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom'
import {AulaWorkspace} from './AulaWorkspace'
import {useAulaAccordionState} from './useAulaAccordionState'
import {periodAccent, preinformeAccent} from './aula.colors'
import {AulaResourceComposer} from './AulaResourceComposer'
import {useToast} from '@/lib/ui/toast'
import {useAula, useArchivarRecurso, useCrearSeccion, useEditarSeccion, useEliminarRecurso,
  useEliminarSeccion, useRestaurarRecurso, useRestaurarSeccion, type AulaResource} from './aula.api'
import './aula.css'

const resourceIcon: Record<AulaResource['tipo'], string> = {texto: '▤', archivo: '▣', tarea: '✓', cuestionario: '☷'}
type SectionForm = {titulo: string; periodo_token: string; preinforme_token: string; visible_estudiantes: boolean}
type Editor = {kind: 'section'; token: string | null} | {kind: 'resource'; section: string; resource: AulaResource | null} | null

export function AulaDetalleView() {
  const {aulaToken = ''} = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const {data, isLoading, error} = useAula(aulaToken)
  const createSection = useCrearSeccion()
  const editSection = useEditarSeccion()
  const archiveResource = useArchivarRecurso()
  const deleteResource = useEliminarRecurso()
  const deleteSection = useEliminarSeccion()
  const restoreResource = useRestaurarRecurso()
  const restoreSection = useRestaurarSeccion()
  const toast = useToast()
  const [editor, setEditor] = useState<Editor>(null)
  const [sectionForm, setSectionForm] = useState<SectionForm>({titulo: '', periodo_token: '', preinforme_token: '', visible_estudiantes: true})
  const {values: expandedSections, toggle: toggleContentSection} = useAulaAccordionState(aulaToken, 'content')
  const requestedEdit = searchParams.get('editar')
  useEffect(() => {
    if (!requestedEdit || !data) return
    for (const section of data.secciones) {
      const resource = section.recursos.find(item => item.token === requestedEdit)
      if (resource) {setEditor({kind: 'resource', section: section.token, resource}); break}
    }
    navigate(`/evaluacion/aula/${aulaToken}`, {replace: true})
  }, [requestedEdit, data, aulaToken, navigate])
  useEffect(() => {
    if (!data || !location.hash.startsWith('#section-')) return
    const frame = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({block: 'start'}))
    return () => cancelAnimationFrame(frame)
  }, [data, location.hash])

  if (isLoading) return <div className='card card-body' role='status'>Cargando aula…</div>
  if (error || !data) return <div className='alert alert-danger' role='alert'>No se pudo abrir el aula. {error?.message}</div>
  const selectedPeriod = data.periodos.find(item => item.token === sectionForm.periodo_token)
  const openSection = (token?: string) => {
    const section = data.secciones.find(item => item.token === token)
    setSectionForm(section ? {titulo: section.titulo, periodo_token: section.periodo_token,
      preinforme_token: section.preinforme_token ?? '', visible_estudiantes: section.visible_estudiantes}
      : {titulo: '', periodo_token: '',
        preinforme_token: '', visible_estudiantes: data.permisos.publicar})
    setEditor({kind: 'section', token: section?.token ?? null})
  }
  const submitSection = async (event: FormEvent) => {
    event.preventDefault()
    try {
      if (editor?.kind !== 'section') return
      if (editor.token) await editSection.mutateAsync({token: editor.token, titulo: sectionForm.titulo,
        periodo_token: sectionForm.periodo_token, preinforme_token: sectionForm.preinforme_token || null})
      else await createSection.mutateAsync({aula: aulaToken, titulo: sectionForm.titulo,
        periodo_token: sectionForm.periodo_token, preinforme_token: sectionForm.preinforme_token || null,
        visible_estudiantes: sectionForm.visible_estudiantes})
      setEditor(null)
      toast.success('Sección guardada.')
    } catch (cause) {toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar la sección.')}
  }
  const toggleSection = async (token: string, visible: boolean) => {
    try {await editSection.mutateAsync({token, visible_estudiantes: visible})}
    catch (cause) {toast.error(cause instanceof Error ? cause.message : 'No se pudo cambiar la visibilidad.')}
  }
  const archive = async (resource: AulaResource) => {
    if (!window.confirm(`¿Archivar «${resource.titulo}»? Dejará de mostrarse a los estudiantes y conservará su historial.`)) return
    try {await archiveResource.mutateAsync({token: resource.token, version: resource.version})
      toast.success('Recurso archivado. Puedes restaurarlo desde Editar.')}
    catch (cause) {toast.error(cause instanceof Error ? cause.message : 'No se pudo archivar el recurso.')}
  }
  const changeDeleted = async (kind: 'section' | 'resource', token: string, restore: boolean) => {
    if (!restore && !window.confirm(`¿Eliminar ${kind === 'section' ? 'la sección y sus recursos' : 'el recurso'}? Se conservarán archivos y registros para poder restaurarlos.`)) return
    try {
      if (kind === 'section') await (restore ? restoreSection : deleteSection).mutateAsync(token)
      else await (restore ? restoreResource : deleteResource).mutateAsync(token)
      toast.success(restore ? 'Contenido restaurado.' : 'Contenido eliminado. Puede restaurarse con el permiso correspondiente.')
    } catch (cause) {toast.error(cause instanceof Error ? cause.message : 'No se pudo completar la operación.')}
  }

  return <AulaWorkspace aula={data}>
    {editor?.kind === 'section' ? <section className='aula-editor-page'>
      <button className='btn btn-link p-0 mb-5' onClick={() => setEditor(null)}>← Contenido del aula</button>
      <div className='aula-main-head'><div><span className='aula-eyebrow'>Organización del aula</span>
        <h1>{editor.token ? 'Editar sección' : 'Nueva sección'}</h1>
        <p className='text-muted mb-0'>Agrupa materiales, tareas y cuestionarios en un mismo lugar.</p></div></div>
      <form className='aula-inline-form' onSubmit={event => void submitSection(event)}>
        <label className='form-label fw-semibold'>Nombre de la sección
          <input className='form-control mt-2' required maxLength={160} value={sectionForm.titulo}
            onChange={event => setSectionForm({...sectionForm, titulo: event.target.value})} placeholder='Semana 1' /></label>
        <div className='row g-4 mt-1'><div className='col-md-6'><label className='form-label'>Período
          <select className='form-select mt-2' required value={sectionForm.periodo_token}
            onChange={event => setSectionForm({...sectionForm, periodo_token: event.target.value, preinforme_token: ''})}>
            <option value=''>Selecciona un período</option>{data.periodos.map(item => <option key={item.token}
              value={item.token} disabled={item.estado === 'cerrado' && !data.permitir_edicion_periodos_cerrados}>
              {item.nombre}{item.estado === 'cerrado' && !data.permitir_edicion_periodos_cerrados ? ' · cerrado' : ''}</option>)}</select></label></div>
          {!!selectedPeriod?.preinformes.length && <div className='col-md-6'><label className='form-label'>Preinforme
            <select className='form-select mt-2' value={sectionForm.preinforme_token}
              onChange={event => setSectionForm({...sectionForm, preinforme_token: event.target.value})}>
              <option value=''>Sin preinforme</option>{selectedPeriod.preinformes.map(item => <option key={item.token}
                value={item.token}>{item.nombre}</option>)}</select></label></div>}</div>
          {!editor.token && data.permisos.publicar && <label className='form-check form-switch mt-6'><input className='form-check-input aula-visibility-toggle' type='checkbox'
            checked={sectionForm.visible_estudiantes} onChange={event => setSectionForm({...sectionForm,
              visible_estudiantes: event.target.checked})} />Visible para estudiantes</label>}
        <div className='aula-form-actions'><button type='button' className='btn btn-light' onClick={() => setEditor(null)}>Cancelar</button>
          <button className='btn btn-success' disabled={createSection.isPending || editSection.isPending}>
            {editor.token ? 'Guardar sección' : 'Crear sección'}</button></div>
      </form>
    </section> : editor?.kind === 'resource' ? <AulaResourceComposer key={editor.resource?.token ?? `new-${editor.section}`}
      section={editor.section} sections={data.secciones} periods={data.periodos} resource={editor.resource}
      allowClosedContent={data.permitir_edicion_periodos_cerrados}
      limitBytes={data.limite_archivo_bytes}
      canChangeFiles={data.permisos.archivos && data.permisos.editar}
      canPublish={data.permisos.publicar} canLinkGradebook={data.permisos.planilla}
      canManageQuiz={data.permisos.evaluaciones}
      onClose={() => setEditor(null)}
      onSaved={token => {setEditor(null); navigate(`/evaluacion/aula/recursos/${token}`)}} />
      : <>
        <div className='aula-main-head'><div><span className='aula-eyebrow'>Aula · {data.grupo}</span>
          <h1 className='mb-1'>Contenido del aula</h1>
          <p className='text-muted mb-0'>Recorre cada sección y abre sus materiales, tareas o evaluaciones.</p></div>
          {data.permisos.crear && <button className='btn btn-success'
            disabled={!data.permitir_edicion_periodos_cerrados && data.periodos.every(period => period.estado === 'cerrado')}
            onClick={() => openSection()}>+ Nueva sección</button>}
        </div>
        {data.secciones.length ? <div className='aula-section-stack'>
          {data.secciones.map((section, index) => {
            const isCollapsed = !(expandedSections[section.token] ?? index === 0)
            const hasResources = section.recursos.length > 0
            const periodLocked = data.periodos.find(period => period.token === section.periodo_token)?.estado === 'cerrado'
              && !data.permitir_edicion_periodos_cerrados
            return <Fragment key={section.token}>
            {(index === 0 || data.secciones[index - 1].periodo_token !== section.periodo_token) &&
              <h2 className='aula-period-heading' style={periodAccent(data, section.periodo_token)}>{section.periodo}</h2>}
            {section.preinforme_token && (index === 0 || data.secciones[index - 1].preinforme_token !== section.preinforme_token ||
              data.secciones[index - 1].periodo_token !== section.periodo_token) &&
              <h3 className='aula-preinforme-heading' style={preinformeAccent(data)}>{data.periodos.find(period => period.token === section.periodo_token)
                ?.preinformes.find(pre => pre.token === section.preinforme_token)?.nombre}</h3>}
            <section className={`aula-section ${section.preinforme_token ? 'has-preinforme' : ''} ${section.eliminado ? 'is-deleted' : ''}`} id={`section-${section.token}`}>
            <div className='aula-section-heading'><button type='button' className='aula-section-toggle'
              disabled={!hasResources} aria-expanded={hasResources ? !isCollapsed : undefined}
              aria-controls={hasResources ? `aula-section-resources-${section.token}` : undefined}
              onClick={() => toggleContentSection(section.token, index === 0)}>
              {hasResources && <span className={`aula-section-chevron ${isCollapsed ? 'is-collapsed' : ''}`} aria-hidden='true'>⌄</span>}
              <span><strong>{section.titulo}</strong><small>{section.periodo} · {section.recursos.length} recursos</small></span></button>
              {data.puede_gestionar && <span className={`aula-section-visibility ${section.eliminado ? '' : section.visible_estudiantes ? 'is-visible' : 'is-hidden'}`}>
                {section.eliminado ? 'Eliminada' : section.visible_estudiantes ? 'Visible' : 'Oculta'}</span>}
              {data.puede_gestionar && <div className='aula-section-actions'>
                {section.eliminado ? <>{data.puede_restaurar && <button className='btn btn-sm btn-light-success'
                  disabled={periodLocked} onClick={() => void changeDeleted('section', section.token, true)}>Restaurar sección</button>}</> : <>
                {data.permisos.editar && data.permisos.publicar && <label className='form-check form-switch mb-0' title={periodLocked ? 'Período cerrado: el colegio bloqueó cambios de contenido' : undefined}><input className='form-check-input aula-visibility-toggle' type='checkbox'
                  checked={section.visible_estudiantes} disabled={editSection.isPending || periodLocked}
                  onChange={event => void toggleSection(section.token, event.target.checked)} />
                  <span className='form-check-label'>Visible para estudiantes</span></label>}
                {data.permisos.editar && <button className='btn btn-sm btn-light-warning aula-icon-action' aria-label={`Editar sección ${section.titulo}`}
                  title={`Editar sección ${section.titulo}`} disabled={periodLocked} onClick={() => openSection(section.token)}><i className='bi bi-pencil-square' aria-hidden='true' /></button>}
                {data.permisos.crear && <button className='btn btn-sm btn-light-success' disabled={periodLocked} onClick={() => setEditor({kind: 'resource', section: section.token,
                  resource: null})}>+ Agregar recurso</button>}
                {data.permisos.eliminar && <button className='btn btn-sm btn-light-danger aula-icon-action' aria-label={`Eliminar sección ${section.titulo}`}
                  title={`Eliminar sección ${section.titulo}`} disabled={periodLocked} onClick={() => void changeDeleted('section', section.token, false)}><i className='bi bi-trash3' aria-hidden='true' /></button>}
                </>}
              </div>}
            </div>
            {(!hasResources || !isCollapsed) && <div className='aula-section-content' id={`aula-section-resources-${section.token}`}>
              {section.recursos.length ? <div className='aula-resource-list'>
                {section.recursos.map(resource => <article key={resource.token} className={`aula-row ${resource.eliminado || section.eliminado ? 'is-deleted' : ''}`}>
                  <span className={`aula-row-icon aula-row-icon-${resource.tipo}`} aria-hidden='true'>{resourceIcon[resource.tipo]}</span>
                  <div className='aula-row-copy'><button className='aula-row-title' disabled={resource.eliminado || section.eliminado}
                    onClick={() => navigate(`/evaluacion/aula/recursos/${resource.token}`)}>{resource.titulo}</button>
                    <small>{resource.tipo === 'archivo' ? 'Material' : resource.tipo === 'texto' ? 'Lectura' :
                      resource.tipo === 'tarea' ? 'Tarea' : 'Cuestionario'}{resource.calificable ? ' · Calificable' : ''}
                    {resource.actividad_token ? ' · En planilla' : ''}</small></div>
                  {data.puede_gestionar && <div className='aula-row-actions'>
                    {resource.eliminado ? <><span className='aula-row-status'>Eliminado</span>
                      {data.puede_restaurar && !section.eliminado && <button className='btn btn-sm btn-light-success aula-icon-action'
                        aria-label={`Restaurar ${resource.titulo}`} title={`Restaurar ${resource.titulo}`} disabled={periodLocked}
                        onClick={() => void changeDeleted('resource', resource.token, true)}><i className='bi bi-arrow-counterclockwise' aria-hidden='true' /></button>}</> : !section.eliminado && <>
                    <span className={`aula-row-status ${resource.estado === 'archivado' ? 'is-archived' : resource.visible_estudiantes && resource.estado === 'publicado' ? 'is-visible' : 'is-hidden'}`}>
                      {resource.estado === 'archivado' ? 'Archivado' : resource.visible_estudiantes ? 'Publicado' : 'Oculto'}</span>
                    {data.permisos.editar && (!resource.visible_estudiantes || data.permisos.publicar) &&
                      (resource.tipo !== 'cuestionario' || data.permisos.evaluaciones) &&
                      <button className='btn btn-sm btn-light-warning aula-icon-action' aria-label={`Editar ${resource.titulo}`}
                        title={`Editar ${resource.titulo}`} disabled={periodLocked}
                        onClick={() => setEditor({kind: 'resource', section: section.token, resource})}>
                        <i className='bi bi-pencil-square' aria-hidden='true' /></button>}
                    {data.permisos.archivar && resource.estado !== 'archivado' && <button className='btn btn-sm btn-light-success aula-icon-action'
                      aria-label={`Archivar ${resource.titulo}`} title={`Archivar ${resource.titulo}`}
                      disabled={archiveResource.isPending || periodLocked} onClick={() => void archive(resource)}><i className='bi bi-archive' aria-hidden='true' /></button>}
                    {data.permisos.eliminar && <button className='btn btn-sm btn-light-danger aula-icon-action'
                      aria-label={`Eliminar ${resource.titulo}`} title={`Eliminar ${resource.titulo}`}
                      disabled={periodLocked} onClick={() => void changeDeleted('resource', resource.token, false)}><i className='bi bi-trash3' aria-hidden='true' /></button>}
                    </>}
                  </div>}
                </article>)}
              </div> : <div className='aula-section-empty'>Aún no hay recursos en esta sección.</div>}
            </div>}
          </section></Fragment>})}
        </div> : <div className='aula-empty-state'><span className='aula-empty-icon' aria-hidden='true'>▤</span>
          <h2>El aula está lista para organizarse</h2><p>Crea la primera sección y agrégale recursos.</p>
          {data.permisos.crear && <button className='btn btn-success' onClick={() => openSection()}>Crear sección</button>}</div>}
      </>}
  </AulaWorkspace>
}
