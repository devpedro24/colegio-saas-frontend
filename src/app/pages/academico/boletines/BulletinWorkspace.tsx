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
import {bulletinPdfUrl, type BulletinIssue} from './emisiones.api'
import {TemplateSelection} from './components/TemplateSelection'
import {BulletinHistoryModal} from './components/BulletinHistoryModal'
import './boletines.css'

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
  const [history, setHistory] = useState<{token: string; name: string} | null>(null)
  const running = useRef(false)
  const cache = useQueryClient()
  const query = useCatalogoEvaluacion({view: 'boletines', yearId: year, groupId: group, enabled: canObserve || canEmit})
  const canTemplates = hasFeature('boletines_personalizables') && (hasPermission('boletines.plantillas.ver') || hasPermission('boletines.plantillas.gestionar'))
  const data = query.data
  const groups = data?.grupos.filter(item => item.ano_lectivo_id === year) ?? []
  const periods = data?.periodos.filter(item => item.ano_lectivo_id === year) ?? []
  const period = requestedPeriod === 'final' ? 'final' : periods.some(item => item.url_token === requestedPeriod) ? requestedPeriod
    : (periods.find(item => item.estado === 'abierto') ?? periods[0])?.url_token ?? ''
  const observations = useGroupObservations(group, period, canObserve && tab === 'observations' && period !== 'final')
  const observationByStudent = new Map(observations.data?.matriculas.map(row => [row.matricula_token, row.observacion]))
  const students = group ? data?.matriculas ?? [] : []
  useEffect(() => {
    if (!data?.anos.length) return
    const nextYear = year || (data.anos.find(item => item.estado === 'en_curso') ?? data.anos[0]).url_token
    const available = data.grupos.filter(item => item.ano_lectivo_id === nextYear)
    const nextGroup = group || (teacherScope && available.length === 1 ? available[0].url_token : '')
    // Resolve defaults together, not one catalog request for each field.
    if (year !== nextYear || group !== nextGroup) setFilters({ano: nextYear, grupo: nextGroup})
  }, [data, year, group, setFilters, teacherScope])
  const reset = () => {setSelected([]); setResults({})}
  const generate = async () => {
    if (running.current || !selected.length || !period || !template) return
    running.current = true; setBusy(true); setResults({})
    try {
      // One bounded request per student: a failed student never hides successful PDFs.
      for (const token of selected) {
        try {
          const response = await api.post<{data: BulletinIssue}>(`/boletines/emisiones/${encodeURIComponent(token)}/emitir?opaque=1`,
            {contexto: period === 'final' ? 'final' : 'periodo', ...(period === 'final' ? {} : {periodo_token: period}), plantilla_token: template})
          setResults(current => ({...current, [token]: {issue: response.data}}))
        } catch (error) {
          setResults(current => ({...current, [token]: {error: error instanceof Error ? error.message : t('common.error')}}))
        }
      }
      void cache.invalidateQueries({queryKey: ['boletines', 'emisiones']})
    } finally {running.current = false; setBusy(false)}
  }
  if (!canObserve && !canEmit) return <div className='alert alert-warning'>{t('boletines.restricted')}</div>
  return <div className='bulletin-workspace d-flex flex-column gap-5'>
    <AcademicPageHeader title={t('boletines.workspace.title')}
      description={en ? 'Work with the students in your authorized groups.' : 'Trabaja con los estudiantes de tus grupos autorizados.'}>
      <fieldset disabled={busy} className='workspace-filters gap-3 border-0 p-0 m-0'>
        <select id='workspace-year' className='form-select form-select-solid w-auto' aria-label={t('academico.config.yearLabel')}
          value={year} onChange={e => {setFilters({ano: e.target.value, grupo: ''}); setPeriod(''); setTemplate(''); reset()}}>
          {data?.anos.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}
        </select>
        <select id='workspace-period' className='form-select form-select-solid w-auto' aria-label={t('evaluacion.period')}
          value={period} onChange={e => {setPeriod(e.target.value); setTemplate(''); reset(); if (e.target.value === 'final') setTab('reports')}}>
          {periods.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre} · {t(`academico.periodos.estado.${item.estado}`)}</option>)}
          {tab === 'reports' && <option value='final'>{t('boletines.issue.final')}</option>}
        </select>
        {!(teacherScope && groups.length === 1) && <select id='workspace-group' aria-label={t('evaluacion.matriculas.grupo')} className='form-select form-select-solid workspace-group' value={group} disabled={busy}
          onChange={e => {setFilters({grupo: e.target.value}); reset()}}><option value=''>{t('academic.filter.selectGroup')}</option>
          {groups.map(item => <option key={item.url_token} value={item.url_token}>{item.grado.nombre} / {item.nombre}</option>)}
        </select>}
      </fieldset>
    </AcademicPageHeader>
    {query.error && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
    {!group ? <div className='alert alert-warning bulletin-group-notice mb-0 rounded-4' role='status'>{t('boletines.workspace.groupFirst')}</div> : <div className='card'><div className='card-header gap-3 justify-content-start' role='tablist'>
      {canObserve && <button className={`btn my-3 ${tab === 'observations' ? 'bulletin-blue-button' : 'btn-light'}`} role='tab' aria-selected={tab === 'observations'} onClick={() => {if (period === 'final') {setPeriod(''); setTemplate('')} setTab('observations')}}>
        {t('boletines.observation.title')}</button>}
      {canEmit && <button className={`btn my-3 ${tab === 'reports' ? 'bulletin-blue-button' : 'btn-light'}`} role='tab' aria-selected={tab === 'reports'} onClick={() => setTab('reports')}>
        {t('boletines.title')}</button>}
    </div><div className='card-body'>
      {query.isFetching && <p role='status'>{t('common.pleaseWait')}</p>}
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
        <div className='bulletin-issue-toolbar'>
          <TemplateSelection scope={period === 'final' ? 'final' : 'periodo'} value={template} enabled={canTemplates} disabled={busy} onChange={setTemplate} />
          <div className='bulletin-generation-actions'><small>{intl.formatMessage({id: 'boletines.workspace.selectedCount'}, {count: selected.length})}</small>
          <button className='btn bulletin-blue-button' disabled={busy || !period || !selected.length || !template} onClick={() => void generate()}><i className='bi bi-file-earmark-pdf' aria-hidden='true' />{t('boletines.issue.prepare')}</button></div>
          {busy && <span role='status'>{Object.keys(results).length} / {selected.length}</span>}
        </div>
        {!canTemplates && <p className='text-muted'>{t('boletines.picker.access')}</p>}
        <div className='table-responsive'><table className='table align-middle'><thead><tr>
          <th><input type='checkbox' className='form-check-input' aria-label={en ? 'Select all' : 'Seleccionar todos'} disabled={busy || !students.length}
            checked={!!students.length && students.every(student => selected.includes(student.url_token))}
            onChange={e => setSelected(e.target.checked ? students.map(student => student.url_token) : [])} /></th>
          <th className='w-40px'>#</th><th>{t('evaluacion.matriculas.estudiante')}</th><th className='text-end'>{t('boletines.workspace.documents')}</th></tr></thead>
          <tbody>{students.map((student, index) => <tr key={student.url_token}><td><input type='checkbox' className='form-check-input' disabled={busy}
            aria-label={student.nombre_lista ?? student.estudiante.name} checked={selected.includes(student.url_token)}
            onChange={e => setSelected(items => e.target.checked ? [...items, student.url_token] : items.filter(token => token !== student.url_token))} /></td>
            <td className='text-muted'>{index + 1}</td><td className='fw-semibold'>{student.nombre_lista ?? student.estudiante.name}</td><td className='bulletin-student-actions'>
              {results[student.url_token]?.error && <span role='alert' className='text-danger'>{results[student.url_token].error}</span>}
              <div className='d-flex flex-wrap gap-2 justify-content-end'>
              {results[student.url_token]?.issue && <a className='btn btn-sm bulletin-blue-button' href={bulletinPdfUrl(results[student.url_token].issue!.token)} target='_blank' rel='noreferrer'><i className='bi bi-download' aria-hidden='true' />{t('boletines.issue.download')}</a>}
              <button type='button' className='btn btn-sm bulletin-history-button' onClick={() => setHistory({token: student.url_token, name: student.nombre_lista ?? student.estudiante.name})}><i className='bi bi-clock-history' aria-hidden='true' />{t('boletines.archive.open')}</button></div>
            </td></tr>)}</tbody></table></div>
      </div>}
      {!!group && !query.isFetching && !students.length && <p className='text-muted'>{t('evaluacion.matriculas.empty')}</p>}
    </div></div>}
    {history && <BulletinHistoryModal enrollment={history} periods={periods.map(item => ({id: item.url_token, nombre: item.nombre}))} onClose={() => setHistory(null)} />}
  </div>
}
