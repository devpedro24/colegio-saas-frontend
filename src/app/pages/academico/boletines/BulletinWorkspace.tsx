import {useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import {useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useCatalogoEvaluacion} from '../evaluacion/evaluacion.api'
import {AcademicPageHeader} from '@/app/shared/components/AcademicPageHeader'
import {useGroupObservations} from './observaciones.api'
import {useCatalogFilters} from '../shared/useCatalogFilters'
import {ObservationEditor} from './components/BulletinObservationCard'
import {useTemplateCatalog} from './plantillas.api'
import {bulletinPdfUrl, type BulletinIssue} from './emisiones.api'

export default function BulletinWorkspace() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const en = intl.locale.startsWith('en')
  const {hasPermission, hasFeature, hasRole} = useAuthz()
  const teacherScope = hasRole('docente') || hasRole('director_grupo')
  const canObserve = hasPermission('boletines.observaciones.gestionar')
  const canEmit = hasPermission('boletines.emisiones.preparar')
  const [filters, setFilters] = useCatalogFilters('boletines-gestion')
  const {ano: year, grupo: group} = filters
  const [requestedPeriod, setPeriod] = useState('')
  const [tab, setTab] = useState(canObserve ? 'observations' : 'reports')
  const [template, setTemplate] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [results, setResults] = useState<Record<string, {issue?: BulletinIssue; error?: string}>>({})
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const cache = useQueryClient()
  const query = useCatalogoEvaluacion({view: 'boletines', yearId: year, groupId: group, enabled: canObserve || canEmit})
  const canTemplates = hasFeature('boletines_personalizables') && hasPermission('boletines.plantillas.ver')
  const templates = useTemplateCatalog(1, canTemplates && tab === 'reports')
  const data = query.data
  const groups = data?.grupos.filter(item => item.ano_lectivo_id === year) ?? []
  const periods = data?.periodos.filter(item => item.ano_lectivo_id === year) ?? []
  const period = periods.some(item => item.url_token === requestedPeriod) ? requestedPeriod
    : (periods.find(item => item.estado === 'abierto') ?? periods[0])?.url_token ?? ''
  const observations = useGroupObservations(group, period, canObserve && tab === 'observations')
  const observationByStudent = new Map(observations.data?.matriculas.map(row => [row.matricula_token, row.observacion]))
  const students = group ? data?.matriculas ?? [] : []
  useEffect(() => {
    if (!data?.anos.length) return
    const nextYear = year || (data.anos.find(item => item.estado === 'en_curso') ?? data.anos[0]).url_token
    const available = data.grupos.filter(item => item.ano_lectivo_id === nextYear)
    const nextGroup = group || (available.length === 1 ? available[0].url_token : '')
    // Resolve defaults together, not one catalog request for each field.
    if (year !== nextYear || group !== nextGroup) setFilters({ano: nextYear, grupo: nextGroup})
  }, [data, year, group, setFilters])
  const reset = () => {setSelected([]); setResults({})}
  const generate = async () => {
    if (running.current || !selected.length || !period) return
    running.current = true; setBusy(true); setResults({})
    try {
      // One bounded request per student: a failed student never hides successful PDFs.
      for (const token of selected) {
        try {
          const response = await api.post<{data: BulletinIssue}>(`/boletines/emisiones/${encodeURIComponent(token)}/emitir?opaque=1`,
            {contexto: 'periodo', periodo_token: period, plantilla_token: template || null})
          setResults(current => ({...current, [token]: {issue: response.data}}))
        } catch (error) {
          setResults(current => ({...current, [token]: {error: error instanceof Error ? error.message : t('common.error')}}))
        }
      }
      void cache.invalidateQueries({queryKey: ['boletines', 'emisiones']})
    } finally {running.current = false; setBusy(false)}
  }
  if (!canObserve && !canEmit) return <div className='alert alert-warning'>{t('boletines.restricted')}</div>
  return <div className='d-flex flex-column gap-5'>
    <AcademicPageHeader title={en ? 'Observations and report issuance' : 'Observaciones y emisión de boletines'}
      description={en ? 'Work with the students in your authorized groups.' : 'Trabaja con los estudiantes de tus grupos autorizados.'}>
      <fieldset disabled={busy} className='d-flex flex-wrap gap-3 border-0 p-0 m-0'>
        <select id='workspace-year' className='form-select form-select-solid w-auto' aria-label={t('academico.config.yearLabel')}
          value={year} onChange={e => {setFilters({ano: e.target.value, grupo: ''}); setPeriod(''); reset()}}>
          {data?.anos.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}
        </select>
        <select id='workspace-period' className='form-select form-select-solid w-auto' aria-label={t('evaluacion.period')}
          value={period} onChange={e => {setPeriod(e.target.value); reset()}}>
          {periods.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre} · {t(`academico.periodos.estado.${item.estado}`)}</option>)}
        </select>
      </fieldset>
    </AcademicPageHeader>
    {!(teacherScope && groups.length === 1) && <div className='card card-body'><fieldset disabled={busy} className='row g-4'>
      <div className='col-md-6'><label className='form-label' htmlFor='workspace-group'>{t('evaluacion.matriculas.grupo')}</label>
        <select id='workspace-group' className='form-select' value={group} disabled={groups.length === 1 || busy}
          onChange={e => {setFilters({grupo: e.target.value}); reset()}}><option value=''>{t('academic.filter.selectGroup')}</option>
          {groups.map(item => <option key={item.url_token} value={item.url_token}>{item.grado.nombre} / {item.nombre}</option>)}
        </select></div>
    </fieldset></div>}
    {query.error && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
    <div className='card'><div className='card-header gap-3 justify-content-start' role='tablist'>
      {canObserve && <button className={`btn my-3 ${tab === 'observations' ? 'btn-primary' : 'btn-light'}`} role='tab' aria-selected={tab === 'observations'} onClick={() => setTab('observations')}>
        {t('boletines.observation.title')}</button>}
      {canEmit && <button className={`btn my-3 ${tab === 'reports' ? 'btn-primary' : 'btn-light'}`} role='tab' aria-selected={tab === 'reports'} onClick={() => setTab('reports')}>
        {t('boletines.title')}</button>}
    </div><div className='card-body'>
      {query.isFetching && <p role='status'>{t('common.pleaseWait')}</p>}
      {!group && <p className='text-muted'>{t('academic.filter.selectGroup')}</p>}
      {canObserve && <div hidden={tab !== 'observations'} role='tabpanel' className='table-responsive'>
        {observations.isError && <div className='alert alert-danger' role='alert'>{observations.error.message}</div>}
        {!!group && !!period && observations.isPending && <p role='status'>{t('common.pleaseWait')}</p>}
        <table className='table align-middle'><thead><tr><th className='w-40px'>#</th><th className='ps-5'>{t('evaluacion.matriculas.estudiante')}</th><th>{t('boletines.observation.label')}</th></tr></thead>
          <tbody>{students.map((student, index) => <tr key={`${student.url_token}-${period}`}><td className='text-muted'>{index + 1}</td><td className='ps-5 fw-semibold' style={{width: '30%', minWidth: 180}}>{student.nombre_lista ?? student.estudiante.name}</td>
            <td style={{minWidth: 320}}>{observations.data && <ObservationEditor matriculaToken={student.url_token}
              title={periods.find(item => item.url_token === period)?.nombre ?? ''}
              target={{contexto: 'periodo', periodo_token: period}} observation={observationByStudent.get(student.url_token) ?? null}
              canEdit={observations.data.puede_editar && observationByStudent.has(student.url_token)} blockedReason={observations.data.motivo_bloqueo} />}</td></tr>)}</tbody></table>
      </div>}
      {canEmit && <div hidden={tab !== 'reports'} role='tabpanel'>
        <div className='d-flex flex-wrap gap-3 align-items-center mb-5'>
          <select className='form-select w-auto' aria-label={t('boletines.issue.template')} value={template} disabled={busy} onChange={e => setTemplate(e.target.value)}>
            <option value=''>{t('boletines.issue.baseTemplate')}</option>
            {templates.data?.plantillas.filter(item => item.ambito === 'periodo' && item.revision_publicada !== null).map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
          </select>
          <button className='btn btn-primary' disabled={busy || !period || !selected.length} onClick={() => void generate()}>{t('boletines.issue.prepare')} ({selected.length})</button>
          {busy && <span role='status'>{Object.keys(results).length} / {selected.length}</span>}
        </div>
        <div className='table-responsive'><table className='table align-middle'><thead><tr>
          <th><input type='checkbox' className='form-check-input' aria-label={en ? 'Select all' : 'Seleccionar todos'} disabled={busy || !students.length}
            checked={!!students.length && students.every(student => selected.includes(student.url_token))}
            onChange={e => setSelected(e.target.checked ? students.map(student => student.url_token) : [])} /></th>
          <th className='w-40px'>#</th><th>{t('evaluacion.matriculas.estudiante')}</th><th>{t('boletines.title')}</th></tr></thead>
          <tbody>{students.map((student, index) => <tr key={student.url_token}><td><input type='checkbox' className='form-check-input' disabled={busy}
            aria-label={student.nombre_lista ?? student.estudiante.name} checked={selected.includes(student.url_token)}
            onChange={e => setSelected(items => e.target.checked ? [...items, student.url_token] : items.filter(token => token !== student.url_token))} /></td>
            <td className='text-muted'>{index + 1}</td><td>{student.nombre_lista ?? student.estudiante.name}</td><td>
              {results[student.url_token]?.error && <span role='alert' className='text-danger'>{results[student.url_token].error}</span>}
              {results[student.url_token]?.issue && <a className='btn btn-light-primary btn-sm' href={bulletinPdfUrl(results[student.url_token].issue!.token)} target='_blank' rel='noreferrer'>{t('boletines.issue.download')}</a>}
            </td></tr>)}</tbody></table></div>
      </div>}
      {!!group && !query.isFetching && !students.length && <p className='text-muted'>{t('evaluacion.matriculas.empty')}</p>}
    </div></div>
  </div>
}
