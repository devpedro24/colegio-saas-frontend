import {useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import {Modal} from 'react-bootstrap'
import {useCatalogoEvaluacion, usePlanilla, useGuardarNotas, useActividadPlanilla} from '../evaluacion.api'
import {KTIcon} from '@/_metronic/helpers'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import type {NotaUpdate, SeccionPlanilla, ActividadEvaluacion, PlanillaResponse} from '../evaluacion.types'
import {AcademicPagination} from '@/app/shared/components/AcademicPagination'
import {usePageSize} from '@/app/shared/hooks/usePageSize'
import {gradeDecimal, validGrade} from '../gradeDecimal'

export const PlanillaView = () => {
  const {asignacionId = '', periodoId = ''} = useParams()
  return <PlanillaEditor key={`${asignacionId}:${periodoId}`} assignment={asignacionId} period={periodoId} />
}

function PlanillaEditor({assignment, period}: {assignment: string; period: string}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const navigate = useNavigate()
  const catalog = useCatalogoEvaluacion({assignmentToken: assignment})
  const selected = catalog.data?.selected_asignacion ?? catalog.data?.asignaciones.find(a => a.url_token === assignment)
  const [page, setPage] = useState(1); const [perPage, setPerPage] = usePageSize('evaluacion-planilla')
  const query = usePlanilla(assignment, period, page, perPage, '')
  const save = useGuardarNotas(assignment, period); const activityMutation = useActividadPlanilla(assignment, period)
  const [draft, setDraft] = useState<Record<string, Omit<NotaUpdate, 'motivo'>>>({})
  const [editor, setEditor] = useState<{section: SeccionPlanilla; activity?: ActividadEvaluacion} | null>(null)
  const [activityForm, setActivityForm] = useState({nombre: '', fecha: '', peso: ''})
  const [selectedSection, setSelectedSection] = useState('')
  const [reason, setReason] = useState('')
  const snapshot = useRef<PlanillaResponse | undefined>(undefined)
  const dirty = Object.keys(draft).length > 0
  if (!dirty && query.data) snapshot.current = query.data
  const data = dirty ? snapshot.current : query.data
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {if (dirtyRef.current) {event.preventDefault(); event.returnValue = ''}}
    const link = (event: MouseEvent) => {
      const target = (event.target as Element)?.closest('a[href]')
      if (target && dirtyRef.current && !window.confirm(intl.formatMessage({id: 'grading.unsaved'}))) {event.preventDefault(); event.stopImmediatePropagation()}
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', link, true)
    return () => {window.removeEventListener('beforeunload', unload); document.removeEventListener('click', link, true)}
  }, [intl])
  if (query.isPending) return <div role='status' className='p-6'>{t('common.loading')}</div>
  if (query.error || !data) return <div role='alert' className='alert alert-danger'>{query.error?.message ?? t('common.error')}</div>

  const allSections = data.secciones ?? []
  const sectionKey = (section: SeccionPlanilla) => section.preinforme_token ?? section.componente_token ?? 'directa'
  const sections = allSections.filter(section => !selectedSection || sectionKey(section) === selectedSection)
  const activities = sections.flatMap(section => section.actividades)
  const byGrade = new Map(data.calificaciones.map(g => [`${g.actividad_id}:${g.matricula_id}`, g]))
  const byResult = new Map(data.resultados.map(r => [r.matricula_id, r]))
  const editable = data.editable && !save.isPending && !activityMutation.isPending
  const clean = () => {
    if (dirty && !window.confirm(t('grading.unsaved'))) return false
    setDraft({}); return true
  }
  const updateGrade = (activity: string, enrollment: string, value: string) => {
    const key = `${activity}:${enrollment}`; const current = byGrade.get(key)
    setDraft(previous => ({...previous, [key]: {actividad_id: activity, matricula_id: enrollment,
      valor: value === '' ? null : value.replace(',', '.'), version: previous[key]?.version ?? current?.version ?? 0,
      observacion: current?.observacion ?? null}}))
  }
  const valueOf = (activity: string, enrollment: string) => {
    const key = `${activity}:${enrollment}`
    return key in draft ? draft[key].valor ?? '' : gradeDecimal(byGrade.get(key)?.valor)
  }
  const focusCell = (row: number, col: number) => {
    document.querySelector<HTMLInputElement>(`[data-grade-row="${row}"][data-grade-col="${col}"]`)?.focus()
  }
  const keyboard = (event: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const moves: Record<string, [number, number]> = {ArrowDown: [1, 0], ArrowUp: [-1, 0], Enter: [event.shiftKey ? -1 : 1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]}
    if (event.key in moves) {
      event.preventDefault(); const [r, c] = moves[event.key]; focusCell(row + r, col + c)
    }
    if (event.key === 'Escape') event.currentTarget.blur()
  }
  const paste = (event: ClipboardEvent<HTMLInputElement>, row: number, col: number) => {
    event.preventDefault()
    const rows = event.clipboardData.getData('text/plain').replace(/\r/g, '').replace(/\n$/, '').split('\n').map(line => line.split('\t'))
    const changes: {activity: string; enrollment: string; value: string}[] = []
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const enrollment = data.matriculas[row + r]; const activity = activities[col + c]
      const value = gradeDecimal(rows[r][c])
      if (!enrollment || !activity || !validGrade(value, data.configuracion.valor_min, data.configuracion.valor_max)) {
        toast.error(t('grading.invalidPaste')); return
      }
      changes.push({activity: activity.id, enrollment: enrollment.id, value})
    }
    changes.forEach(change => updateGrade(change.activity, change.enrollment, change.value))
  }
  const saveGrades = () => {
    const values = Object.values(draft)
    if (values.some(v => !validGrade(gradeDecimal(v.valor), data.configuracion.valor_min, data.configuracion.valor_max))) {toast.error(t('grading.invalidGrade')); return}
    if (data.requiere_motivo && reason.trim().length < 3) return
    save.mutate(values.map(v => ({...v, valor: v.valor == null ? null : gradeDecimal(v.valor), motivo: reason.trim()})), {
      onSuccess: () => {setDraft({}); setReason(''); toast.success(t('grading.saved'))},
      onError: error => toast.error(error.message),
    })
  }
  const openActivity = (section: SeccionPlanilla, activity?: ActividadEvaluacion) => {
    if (dirty) {toast.show(t('grading.saveFirst'), 'info'); return}
    setEditor({section, activity})
    setActivityForm({nombre: activity?.nombre ?? '', fecha: activity?.fecha?.slice(0, 10) ?? section.fecha_inicio?.slice(0, 10) ?? data.periodo.fecha_inicio.slice(0, 10), peso: gradeDecimal(activity?.peso)})
  }
  const commitActivity = (remove = false) => {
    if (!editor) return
    if (remove && !window.confirm(t('grading.confirmDelete'))) return
    activityMutation.mutate({operacion: remove ? 'eliminar' : editor.activity ? 'editar' : 'crear',
      componente_token: editor.section.componente_token, preinforme_token: editor.section.preinforme_token,
      actividad_token: editor.activity?.url_token ?? editor.activity?.id, version: editor.activity?.version ?? 0,
      ...(!remove ? {...activityForm, peso: activityForm.peso ? gradeDecimal(activityForm.peso) : null} : {}),
    }, {onSuccess: () => {setEditor(null); toast.success(t('grading.saved'))}, onError: error => toast.error(error.message)})
  }

  return <div className='card grade-sheet'>
    <div className='card-body pb-0'>
      <div className='d-flex flex-wrap justify-content-between align-items-start gap-4 mb-5'>
        <div>
          <button className='btn btn-link p-0 mb-3 text-muted' onClick={() => {if (clean()) navigate('/evaluacion/catalogo')}}><KTIcon iconName='arrow-left' className='fs-4' />{t('grading.back')}</button>
          <h2 className='fs-2 fw-bold mb-2'>{selected?.materia.nombre ?? t('evaluacion.planilla.title')}</h2>
          <div className='d-flex align-items-center flex-wrap gap-3 text-muted'>
            <span><KTIcon iconName='people' className='fs-4 me-1' />{selected ? `${selected.grupo.grado.nombre} / (${selected.grupo.nombre})` : '—'}</span>
            <span className='badge badge-light-primary'>{data.periodo?.nombre}</span>
            <span>{data.configuracion.valor_min} – {data.configuracion.valor_max}</span>
          </div>
        </div>
        <div className='d-flex align-items-center gap-3'>
          <span className={`fs-7 ${dirty ? 'text-warning' : 'text-muted'}`} role='status'>{dirty ? intl.formatMessage({id: 'grading.changes'}, {count: Object.keys(draft).length}) : t('grading.upToDate')}</span>
          <button className='btn btn-primary' disabled={!data.editable || !dirty || (data.requiere_motivo && reason.trim().length < 3) || save.isPending} onClick={saveGrades}><KTIcon iconName='check' className='fs-3' />{save.isPending ? t('grading.saving') : t('grading.save')}</button>
        </div>
      </div>
      <p className='text-muted fs-7 mb-5'>{t('grading.keyboard')}</p>
      {dirty && data.requiere_motivo && <div className='mb-5'><label className='form-label required' htmlFor='grade-save-reason'>{t('evaluacion.planilla.motivo')}</label>
        <input id='grade-save-reason' className='form-control form-control-solid' value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></div>}
      {!data.editable && <div className='alert alert-info'>{t('grading.readOnly')}</div>}
      {dirty && query.data !== snapshot.current && <div className='alert alert-warning'>{t('grading.remoteChanges')}</div>}
      {data.estructura_anterior && <div className='alert alert-light border'>{t('grading.legacy')}</div>}
      {allSections.length > 1 && <div className='nav nav-tabs nav-line-tabs gap-4 mb-5'>
        <button className={`nav-link ${!selectedSection ? 'active' : ''}`} onClick={() => setSelectedSection('')}>{t('grading.all')}</button>
        {allSections.map(section => <button key={sectionKey(section)} className={`nav-link ${selectedSection === sectionKey(section) ? 'active' : ''}`}
          onClick={() => setSelectedSection(sectionKey(section))}>{section.nombre}</button>)}
      </div>}
      <div className='row g-4 mb-5'>{sections.map(section => <div className={sections.length > 1 ? 'col-lg-6 col-xl-4' : 'col-12'} key={sectionKey(section)}>
        <div className='border rounded-3 p-4 h-100'>
          <div className='d-flex justify-content-between align-items-center gap-3 mb-3'>
            <span className='fw-bold'>{section.nombre ?? t('grading.periodActivities')}{data.usa_preinformes && section.peso != null ? ` · ${gradeDecimal(section.peso)}%` : ''}</span>
            {data.permisos.crear && <button className='btn btn-sm btn-light-primary' disabled={!editable} onClick={() => openActivity(section)}><KTIcon iconName='plus' className='fs-4' />{t('grading.activity')}</button>}
          </div>
          <label className='form-check form-switch form-check-custom form-check-solid'>
            <input className='form-check-input h-20px w-35px' type='checkbox' checked={section.modo === 'WEIGHTED_AVERAGE'} disabled={!editable || !data.permisos.configurar || dirty}
              onChange={e => activityMutation.mutate({operacion: 'modo', componente_token: section.componente_token, preinforme_token: section.preinforme_token,
                version: section.version, modo: e.target.checked ? 'WEIGHTED_AVERAGE' : 'SIMPLE_AVERAGE'}, {onError: error => toast.error(error.message)})} />
            <span className='form-check-label fs-7'>{t('grading.useWeights')}</span>
          </label>
          {section.modo === 'WEIGHTED_AVERAGE' && <p className='text-muted fs-7 mt-3 mb-0'>{t('grading.total')}: {Number(section.actividades.reduce((sum, a) => sum + Number(a.peso ?? 0), 0).toFixed(4))}% / 100%</p>}
        </div>
      </div>)}</div>
      <div className='d-flex flex-wrap gap-3 justify-content-end align-items-center mb-4'>
        <span className='text-muted fs-7'>{intl.formatMessage({id: 'grading.students'}, {count: data.pagination.matriculas.total})}</span>
      </div>
    </div>
    <div className='grade-sheet-scroll' role='region' aria-label={t('evaluacion.planilla.title')} tabIndex={0}>
      <table className='table grade-sheet-table mb-0' style={{minWidth: `${340 + sections.reduce((count, section) => count + Math.max(1, section.actividades.length) + (data.usa_preinformes ? 1 : 0), 0) * 128}px`}}>
        <colgroup><col style={{width: 'var(--grade-student-width)'}} />{sections.flatMap(section => Array.from({length: Math.max(1, section.actividades.length) + (data.usa_preinformes ? 1 : 0)}, (_, index) => <col key={`${sectionKey(section)}-${index}`} />))}<col style={{width: 'var(--grade-result-width)'}} /></colgroup>
        <thead>
          <tr><th className='grade-student' rowSpan={2}>{t('evaluacion.matriculas.estudiante')}</th>
            {sections.map(section => <th key={sectionKey(section)} className='grade-section' colSpan={Math.max(1, section.actividades.length) + (data.usa_preinformes ? 1 : 0)}>
              {section.nombre ?? t('grading.periodActivities')}{data.usa_preinformes && section.peso != null ? ` · ${gradeDecimal(section.peso)}%` : ''}
            </th>)}<th className='grade-result' rowSpan={2}>{t('evaluacion.planilla.definitiva')}</th>
          </tr>
          <tr>{sections.flatMap(section => [...(section.actividades.length ? section.actividades.map(activity => <th key={activity.id} className='grade-activity'>
            <button className='btn btn-link p-0 fw-semibold text-gray-800 w-100' disabled={!editable || (!data.permisos.editar && !data.permisos.eliminar)} onClick={() => openActivity(section, activity)}>
              {activity.nombre}{data.permisos.editar && <KTIcon iconName='pencil' className='fs-8 ms-2 text-muted' />}
            </button><span className='d-block text-muted fw-normal fs-8 mt-1'>{activity.fecha?.slice(0, 10)}{section.modo === 'WEIGHTED_AVERAGE' ? ` · ${gradeDecimal(activity.peso) || '—'}%` : ''}</span>
          </th>) : [<th key={sectionKey(section)} className='grade-activity text-muted fw-normal'>{t('grading.noActivities')}</th>]),
          ...(data.usa_preinformes ? [<th key={`${sectionKey(section)}-subtotal`} className='grade-activity text-primary'>{t('grading.subtotal')}</th>] : [])])}</tr>
        </thead>
        <tbody>{data.matriculas.map((enrollment, rowIndex) => {
          const result = byResult.get(enrollment.id)
          const rowDirty = Object.values(draft).some(v => v.matricula_id === enrollment.id)
          return <tr key={enrollment.id}><th scope='row' className='grade-student'><span className='grade-row-number'>{(data.pagination.matriculas.current_page - 1) * data.pagination.matriculas.per_page + rowIndex + 1}</span><span>{enrollment.nombre_lista ?? enrollment.estudiante.name}</span>
            {data.periodo.estado === 'cerrado' && <button className='btn btn-link p-0 d-block fs-8 mt-2' onClick={() => {if (clean()) navigate(`/evaluacion/recuperaciones/${enrollment.url_token}`)}}>{t('evaluacion.recuperaciones.title')}</button>}
          </th>
            {sections.flatMap(section => [...(section.actividades.length ? section.actividades.map(activity => {
              const colIndex = activities.indexOf(activity)
              const value = valueOf(activity.id, enrollment.id)
              const changed = `${activity.id}:${enrollment.id}` in draft
              const valid = validGrade(gradeDecimal(value), data.configuracion.valor_min, data.configuracion.valor_max)
              return <td key={activity.id} className={changed ? 'grade-cell changed' : 'grade-cell'}>
                <input type='text' inputMode='decimal' autoComplete='off' className={`grade-input ${valid ? '' : 'invalid'}`} disabled={!editable}
                  data-grade-row={rowIndex} data-grade-col={colIndex} aria-invalid={!valid} aria-label={`${enrollment.estudiante.name} · ${activity.nombre}`}
                  value={value} onChange={e => updateGrade(activity.id, enrollment.id, e.target.value)}
                  onBlur={() => {if (changed && valid && value !== gradeDecimal(value)) updateGrade(activity.id, enrollment.id, gradeDecimal(value))}}
                  onFocus={e => e.target.select()} onKeyDown={e => keyboard(e, rowIndex, colIndex)} onPaste={e => paste(e, rowIndex, colIndex)} />
              </td>
            }) : [<td key={sectionKey(section)} className='grade-cell text-center text-muted'>—</td>]),
            ...(data.usa_preinformes ? [<td key={`${sectionKey(section)}-subtotal`} className='grade-cell text-center fw-semibold text-primary'>
              {rowDirty ? '—' : (() => {
                const subtotal = result?.secciones?.find(s => s.componente_token === section.componente_token)
                return gradeDecimal(subtotal?.display_value ?? subtotal?.provisional) || t('grading.pending')
              })()}
            </td>] : [])])}
            <td className='grade-result' title={rowDirty ? t('grading.saveToCalculate') : result?.motivo}>
              {rowDirty ? <span className='text-muted fs-8'>{t('grading.saveToCalculate')}</span> : result?.estado === 'calculado'
                ? <span className={`badge fs-6 badge-light-${result.aprobado ? 'success' : 'danger'}`}>{gradeDecimal(result.display_value)}</span>
                : result?.provisional != null ? <span className='grade-provisional' title={t('grading.provisionalHelp')}>
                    {gradeDecimal(result.provisional)} <small>{t('grading.provisional')}</small>
                  </span> : <span className='text-muted fs-8'>{t('grading.pending')}</span>}
            </td>
          </tr>
        })}</tbody>
      </table>
      {!data.matriculas.length && <div className='text-center text-muted p-8'>{t('grading.noStudents')}</div>}
    </div>
    <div className='card-body pt-4'><AcademicPagination meta={data.pagination.matriculas} onPageChange={next => {if (clean()) setPage(next)}}
      onPerPageChange={next => {if (clean()) {setPerPage(next); setPage(1)}}} /></div>
    <Modal show={!!editor} onHide={() => {if (!activityMutation.isPending) setEditor(null)}} centered>
      <Modal.Header closeButton><Modal.Title>{t(editor?.activity ? 'grading.editActivity' : 'grading.newActivity')}</Modal.Title></Modal.Header>
      <Modal.Body>
        <label className='form-label required' htmlFor='grade-activity-name'>{t('grading.name')}</label>
        <input id='grade-activity-name' className='form-control mb-5' autoFocus maxLength={160} value={activityForm.nombre} onChange={e => setActivityForm(p => ({...p, nombre: e.target.value}))} />
        <label className='form-label required' htmlFor='grade-activity-date'>{t('grading.date')}</label>
        <input id='grade-activity-date' type='date' className='form-control mb-5' value={activityForm.fecha} min={data.periodo?.fecha_inicio.slice(0, 10)} max={data.periodo?.fecha_fin.slice(0, 10)} onChange={e => setActivityForm(p => ({...p, fecha: e.target.value}))} />
        {editor?.section.modo === 'WEIGHTED_AVERAGE' && <><label className='form-label required' htmlFor='grade-activity-weight'>{t('grading.weight')}</label>
          <input id='grade-activity-weight' inputMode='decimal' className='form-control' value={activityForm.peso} onChange={e => setActivityForm(p => ({...p, peso: e.target.value.replace(',', '.')}))} /></>}
        {activityMutation.error && <div className='alert alert-danger mt-4' role='alert'>{activityMutation.error.message}</div>}
      </Modal.Body>
      <Modal.Footer className='justify-content-between'>
        <div>{editor?.activity && data.permisos.eliminar && <button className='btn btn-light-danger' disabled={activityMutation.isPending} onClick={() => commitActivity(true)}><KTIcon iconName='trash' className='fs-3' />{t('grading.delete')}</button>}</div>
        <div className='d-flex gap-3'><button className='btn btn-light' disabled={activityMutation.isPending} onClick={() => setEditor(null)}>{t('grading.cancel')}</button>
          <button className='btn btn-primary' disabled={activityMutation.isPending || !activityForm.nombre.trim() || !activityForm.fecha || (editor?.section.modo === 'WEIGHTED_AVERAGE' && (!activityForm.peso || !validGrade(activityForm.peso, '0', '100'))) || (editor?.activity ? !data.permisos.editar : !data.permisos.crear)}
            onClick={() => commitActivity()}>{t('grading.save')}</button></div>
      </Modal.Footer>
    </Modal>
  </div>
}
