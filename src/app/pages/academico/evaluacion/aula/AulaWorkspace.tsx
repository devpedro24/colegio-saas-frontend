import {useState, type ReactNode} from 'react'
import {useNavigate} from 'react-router-dom'
import {aulaPortadaUrl, useSubirPortadaAula, type AulaDetail, type AulaResource} from './aula.api'
import {periodAccent, preinformeAccent} from './aula.colors'

const icons: Record<AulaResource['tipo'], string> = {texto: '▤', archivo: '▣', tarea: '✓', cuestionario: '☷'}

export function AulaWorkspace({aula, activeResource, children}: {aula: AulaDetail; activeResource?: string; children: ReactNode}) {
  const navigate = useNavigate()
  const upload = useSubirPortadaAula()
  const [error, setError] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const count = aula.secciones.reduce((total, section) => total + section.recursos.filter(resource => !resource.eliminado).length, 0)

  return <div className='aula-workspace'>
    <aside className='aula-sidebar' aria-label='Navegación del aula'>
      <div className='aula-sidebar-head'>
        <button className='btn btn-link p-0 text-start' onClick={() => navigate('/evaluacion/aula')}>← Volver a mis aulas</button>
        <h2 className='fs-3 fw-bold mt-4 mb-1'>{aula.materia}</h2><div className='text-muted'>{aula.grado} / {aula.grupo}</div>
        {aula.portada_token && <img className='aula-sidebar-cover' src={aulaPortadaUrl(aula.token)} alt={`Portada de ${aula.materia}`} />}
        <div className='aula-sidebar-summary'>{aula.secciones.filter(section => !section.eliminado).length} secciones · {count} recursos</div>
        {aula.puede_gestionar && <label className='aula-cover-action mt-3'>Cambiar portada
          <input className='visually-hidden' type='file' accept='image/png,image/jpeg,image/webp' disabled={upload.isPending}
            onChange={event => {const file = event.target.files?.[0]; if (!file) return
              void upload.mutateAsync({token: aula.token, archivo: file}).catch(cause =>
                setError(cause instanceof Error ? cause.message : 'No se pudo guardar la portada.'))
            }} /></label>}
        {error && <div className='text-danger fs-7 mt-2' role='alert'>{error}</div>}
      </div>
      <nav className='aula-sidebar-nav' aria-label='Secciones y recursos'>
        <button className={`aula-nav-title aula-nav-home ${!activeResource ? 'is-active' : ''}`}
          onClick={() => navigate(`/evaluacion/aula/${aula.token}`)}>Contenido del aula</button>
        {aula.secciones.map((section, index) => {
          const startsPeriod = index === 0 || aula.secciones[index - 1].periodo_token !== section.periodo_token
          const startsPreinforme = !!section.preinforme_token && (startsPeriod || aula.secciones[index - 1].preinforme_token !== section.preinforme_token)
          const hasResources = section.recursos.length > 0
          const expanded = expandedSections[section.token] ?? (index === 0 || section.recursos.some(resource => resource.token === activeResource))
          return <div className={`aula-nav-section ${section.eliminado ? 'is-deleted' : ''} ${startsPeriod ? 'has-period' : ''} ${section.preinforme_token ? 'has-preinforme' : ''} ${startsPreinforme ? 'starts-preinforme' : ''}`} key={section.token}>
          {startsPeriod &&
            <div className='aula-nav-period' style={periodAccent(aula, section.periodo_token)}>{section.periodo}</div>}
          {startsPreinforme &&
            <div className='aula-nav-preinforme' style={preinformeAccent(aula)}>{aula.periodos.find(period => period.token === section.periodo_token)
              ?.preinformes.find(pre => pre.token === section.preinforme_token)?.nombre}</div>}
          <button className='aula-nav-title aula-nav-section-toggle' aria-expanded={hasResources ? expanded : undefined}
            aria-controls={hasResources ? `aula-nav-resources-${section.token}` : undefined}
            onClick={() => hasResources ? setExpandedSections(current => ({...current, [section.token]: !expanded}))
              : navigate(`/evaluacion/aula/${aula.token}#section-${section.token}`)}>
            {hasResources && <span className='aula-nav-chevron' aria-hidden='true'>{expanded ? '⌄' : '›'}</span>}
            <span>{section.titulo}{section.eliminado ? ' · Eliminada' : ''}</span>
            {hasResources && <small>{section.recursos.length}</small>}</button>
          {hasResources && <div id={`aula-nav-resources-${section.token}`} hidden={!expanded}>
          {section.recursos.map(resource => <button key={resource.token}
            className={`aula-nav-resource aula-nav-resource-${resource.tipo} ${activeResource === resource.token ? 'is-active' : ''} ${resource.eliminado ? 'is-deleted' : ''}`}
            disabled={resource.eliminado || section.eliminado}
            aria-current={activeResource === resource.token ? 'page' : undefined}
            onClick={() => navigate(`/evaluacion/aula/recursos/${resource.token}`)}>
            <span aria-hidden='true'>{icons[resource.tipo]}</span><span className='aula-nav-label'>{resource.titulo}{resource.eliminado ? ' · Eliminado' : ''}</span>
            {aula.estudiante && resource.progreso !== 'sin_iniciar' && <span
              className={`aula-progress-mark aula-progress-mark-${resource.progreso ?? 'sin_iniciar'}`}
              role='img' aria-label={resource.progreso === 'completado' ? 'Completado' : 'Pendiente de revisión'}
              title={resource.progreso === 'completado' ? 'Completado' : 'Pendiente de revisión'}>
              {resource.progreso === 'completado' ? '✓' : '⌛'}</span>}
          </button>)}</div>}
        </div>})}
      </nav>
    </aside>
    <main className='aula-main'>{children}</main>
  </div>
}
