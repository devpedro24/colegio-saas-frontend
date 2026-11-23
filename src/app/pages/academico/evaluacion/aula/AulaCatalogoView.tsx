import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useCatalogFilters} from '../../shared/useCatalogFilters'
import {useAulaCatalogo, useEntregasAnteriores, aulaAdjuntoUrl, aulaPortadaUrl} from './aula.api'
import {AulaConfigurationDialog} from './AulaConfigurationDialog'
import './aula.css'

function HistorialEntregas({year}: {year: string}) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const history = useEntregasAnteriores(year, page, open)
  return <section className='card card-body'>
    <h3 className='mb-0'><button type='button' className='btn btn-light text-start' aria-expanded={open}
      onClick={() => setOpen(!open)}><i className='bi bi-clock-history me-2' aria-hidden='true' />
      Entregas de grupos anteriores</button></h3>
    {open && <div className='mt-4' aria-live='polite'>
      {history.isLoading && <p>Cargando entregas…</p>}
      {history.isError && <p className='text-danger'>No se pudieron cargar tus entregas. <button type='button'
        className='btn btn-sm btn-light' onClick={() => history.refetch()}>Reintentar</button></p>}
      {history.data?.data.map(item => <details key={item.token} className='border rounded p-3 mb-2 text-break'>
        <summary><strong>{item.titulo}</strong> · {item.grado} / {item.grupo} · {item.materia}</summary>
        {item.entregada_at && <p className='text-muted mt-3'>Entregada el {new Date(item.entregada_at).toLocaleDateString('es-CO')}</p>}
        <h4 className='fs-6 mt-3'>Tu entrega</h4>
        {item.texto && <p style={{whiteSpace: 'pre-wrap'}}>{item.texto}</p>}
        {item.adjuntos.map(file => <a className='d-block mb-2' key={file.token} href={aulaAdjuntoUrl(file.token)}>{file.nombre}</a>)}
        <h4 className='fs-6 mt-3'>Retroalimentación</h4>
        <p className='mb-0' style={{whiteSpace: 'pre-wrap'}}>{item.retroalimentacion || 'Todavía no hay comentarios del docente.'}</p>
      </details>)}
      {history.data?.data.length === 0 && <p>No hay entregas en esta página.</p>}
      {(page > 1 || history.data?.hay_mas) && <div className='d-flex gap-2 mt-3'>
        <button type='button' className='btn btn-sm btn-light' disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <button type='button' className='btn btn-sm btn-light' disabled={!history.data?.hay_mas} onClick={() => setPage(page + 1)}>Siguiente</button>
      </div>}
    </div>}
  </section>
}

export function AulaCatalogoView() {
  const navigate = useNavigate()
  const [configurationOpen, setConfigurationOpen] = useState(false)
  const [filters, setFilters] = useCatalogFilters('aula')
  const {data, isLoading, error} = useAulaCatalogo(filters.ano, filters.grupo)
  if (isLoading) return <div className='card card-body'>Cargando aulas…</div>
  if (error || !data) return <div className='alert alert-danger'>No se pudieron cargar las aulas. {error?.message}</div>
  const needsGroup = data.requiere_grupo
  const groupToken = filters.grupo || (!needsGroup ? data.grupo_seleccionado ?? '' : '')
  const cards = data.aulas.filter(item => !filters.materia || item.materia_token === filters.materia)
  const subjects = data.aulas.map(item => ({token: item.materia_token, name: item.materia}))
    .filter((item, index, items) => items.findIndex(other => other.token === item.token) === index)
  const open = (item: typeof cards[number]) => navigate(`/evaluacion/aula/${item.aula_token}`)

  return <div className='d-flex flex-column gap-6'>
    <div className='card'><div className='card-body d-flex flex-wrap align-items-end justify-content-between gap-4'>
      <div><h2 className='mb-1'>Aula</h2><p className='text-muted mb-0'>Materiales, tareas y evaluaciones de tus asignaturas.</p></div>
      <div className='d-flex flex-wrap gap-3'>
        {data.puede_configurar && <button type='button' className='btn btn-light align-self-end'
          onClick={() => setConfigurationOpen(true)}><i className='bi bi-gear me-2' aria-hidden='true' />Configuración</button>}
        <label className='aula-filter'>Año lectivo<select className='form-select' value={filters.ano || data.ano_token || ''}
          onChange={event => setFilters({ano: event.target.value, grupo: '', materia: ''})}>
          {data.anos.map(year => <option key={year.token} value={year.token}>{year.nombre}</option>)}</select></label>
        {needsGroup && <label className='aula-filter'>Grupo académico<select className='form-select' value={groupToken}
          onChange={event => setFilters({grupo: event.target.value, materia: ''})}><option value=''>Selecciona un grupo académico</option>
          {data.grupos.map(group => <option key={group.token} value={group.token}>{group.etiqueta}</option>)}</select></label>}
        {needsGroup && groupToken && <label className='aula-filter'>Asignatura<select className='form-select' value={filters.materia}
          onChange={event => setFilters({materia: event.target.value})}><option value=''>Todas las asignaturas</option>
          {subjects.map(item => <option key={item.token} value={item.token}>{item.name}</option>)}</select></label>}
      </div>
    </div></div>
    {needsGroup && !groupToken ? <div className='card card-body text-center py-15'>
      <h3 className='mb-2'>Selecciona un grupo académico</h3>
      <p className='text-muted mb-0'>Primero elige un grupo para consultar sus asignaturas y aulas.</p>
    </div> : cards.length ? <div className='aula-grid'>{cards.map(item => <article key={`${item.grupo_token}:${item.materia_token}`} className='card aula-card'>
      <div className='aula-card-cover' aria-hidden='true'>{item.aula_token && item.portada_token
        ? <img src={aulaPortadaUrl(item.aula_token)} alt='' /> : <span>{item.materia.slice(0, 1).toUpperCase()}</span>}</div>
      <div className='card-body'><span className='badge badge-light-success mb-3'>{item.grupo}</span>
        <h3 className='fs-3'>{item.materia}</h3><p className='text-muted'>Docente: {item.docente}</p>
        {item.progreso && <div className='aula-card-progress' aria-label={`${item.progreso.porcentaje}% del aula completado`}>
          <div className='aula-card-progress-meta'><span>{item.progreso.total === 0 ? 'Sin recursos'
            : item.progreso.completados === item.progreso.total ? 'Completado' : 'En progreso'}</span>
            <strong>{item.progreso.porcentaje}%</strong></div>
          <div className='aula-card-progress-track'><span style={{width: `${item.progreso.porcentaje}%`}} /></div>
          <small>{item.progreso.completados} de {item.progreso.total} recursos completados</small>
        </div>}
        <button type='button' className='btn btn-success w-100' onClick={() => open(item)}>Entrar al aula</button>
      </div></article>)}</div>
      : <div className='card card-body text-center text-muted py-15'>No hay asignaturas disponibles para estos filtros.</div>}
    {data.tiene_entregas_anteriores && data.ano_token && <HistorialEntregas key={data.ano_token} year={data.ano_token} />}
    {data.puede_configurar && <AulaConfigurationDialog show={configurationOpen} onHide={() => setConfigurationOpen(false)} />}
  </div>
}
