import {useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import {Modal} from 'react-bootstrap'
import {useCatalogoEvaluacion, usePlanilla, useGuardarNotas, useActividadPlanilla, useGuardarResultadoManual, useGuardarResultadoManualComponente} from '../evaluacion.api'
import {KTIcon} from '@/_metronic/helpers'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import type {NotaUpdate, SeccionPlanilla, ActividadEvaluacion, PlanillaResponse, Matricula, ResultadoEstudiante} from '../evaluacion.types'
import {gradeDecimal, validGrade} from '../gradeDecimal'
import {VisualChoice} from './VisualChoice'
import {IndicadorWorkspace} from './IndicadorWorkspace'

export const PlanillaView = () => {
  const {asignacionId = '', periodoId = ''} = useParams()
  return <PlanillaEditor key={`${asignacionId}:${periodoId}`} assignment={asignacionId} period={periodoId} />
}

function PlanillaEditor({assignment, period}: {assignment: string; period: string}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const navigate = useNavigate()
  const catalog = useCatalogoEvaluacion({assignmentToken: assignment})
  const selected = catalog.data?.selected_asignacion ?? catalog.data?.asignaciones.find(a => a.url_token === assignment)
  const query = usePlanilla(assignment, period)
  const save = useGuardarNotas(assignment, period); const activityMutation = useActividadPlanilla(assignment, period)
  const manualComponent = useGuardarResultadoManualComponente(assignment, period)
  const [draft, setDraft] = useState<Record<string, Omit<NotaUpdate, 'motivo'>>>({})
  const [editor, setEditor] = useState<{section: SeccionPlanilla; activity?: ActividadEvaluacion} | null>(null)
  const [activityForm, setActivityForm] = useState({nombre: '', fecha: '', peso: ''})
  const [selectedSection, setSelectedSection] = useState('')
  const [reason, setReason] = useState('')
  const [manualEditor, setManualEditor] = useState<{section: SeccionPlanilla; student: Matricula; result: NonNullable<ResultadoEstudiante['secciones']>[number] | undefined} | null>(null)
  const [manualValue, setManualValue] = useState('')
  const [manualReason, setManualReason] = useState('')
  const snapshot = useRef<PlanillaResponse | undefined>(undefined)
  const dirty = Object.keys(draft).length > 0
  if (!dirty && query.data) snapshot.current = query.data
  const data = dirty ? snapshot.current : query.data
  const visual = data?.escala_visual?.tipo === 'imagenes'
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
  if (query.isPending) return <div role='status' className='p-6'>{t('common.pleaseWait')}</div>
  if (query.error || !data) return <div role='alert' className='alert alert-danger'>{query.error?.message ?? t('common.error')}</div>

  if (data.configuracion.modo_asignatura === 'MANUAL') {
    return <ManualSubjectSheet assignment={assignment} period={period} data={data} subject={selected?.materia.nombre ?? ''}
      back={() => navigate('/evaluacion/catalogo')} />
  }

  const allSections = data.secciones ?? []
  const sectionKey = (section: SeccionPlanilla) => section.preinforme_token ?? section.componente_token ?? 'directa'
  const sections = allSections.filter(section => !selectedSection || sectionKey(section) === selectedSection)
  const sectionColumns = (section: SeccionPlanilla) => section.modo === 'MANUAL' ? 1 : Math.max(1, section.actividades.length) + (data.usa_preinformes ? 1 : 0)
  const activities = sections.flatMap(section => section.actividades)
  const byGrade = new Map(data.calificaciones.map(g => [`${g.actividad_id}:${g.matricula_id}`, g]))
  const byResult = new Map(data.resultados.map(r => [r.matricula_id, r]))
  const editable = data.editable && !save.isPending && !activityMutation.isPending && !manualComponent.isPending
  const clean = () => {
    if (dirty && !window.confirm(t('grading.unsaved'))) return false
    setDraft({}); return true
  }
  const updateGrade = (activity: string, enrollment: string, value: string) => {
    const key = `${activity}:${enrollment}`; const current = byGrade.get(key)
    setDraft(previous => ({...previous, [key]: {actividad_id: activity, matricula_id: enrollment,
      valor: value === '' ? null : value.replace(',', '.'), version: previous[key]?.version ?? current?.version ?? 0,
      escala_opcion_token: null, observacion: current?.observacion ?? null}}))
  }
  const updateVisual = (activity: string, enrollment: string, token: string) => {
    const key = `${activity}:${enrollment}`; const current = byGrade.get(key)
    setDraft(previous => ({...previous, [key]: {actividad_id: activity, matricula_id: enrollment,
      valor: null, escala_opcion_token: token || null, version: previous[key]?.version ?? current?.version ?? 0,
      observacion: current?.observacion ?? null}}))
  }
  const choiceOf = (activity: string, enrollment: string) => {
    const key = `${activity}:${enrollment}`
    return key in draft ? draft[key].escala_opcion_token ?? '' : byGrade.get(key)?.escala_opcion_token ?? ''
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
    if (!visual && values.some(v => !validGrade(gradeDecimal(v.valor), data.configuracion.valor_min, data.configuracion.valor_max))) {toast.error(t('grading.invalidGrade')); return}
    if (visual && values.some(v => v.escala_opcion_token && !data.escala_visual?.opciones.some(option => option.url_token === v.escala_opcion_token))) {
      toast.error(t('grading.invalidChoice')); return
    }
    if (data.requiere_motivo && reason.trim().length < 3) return
    save.mutate(values.map(v => ({...v, valor: visual || v.valor == null ? null : gradeDecimal(v.valor), motivo: reason.trim()})), {
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
  const openManualComponent = (section: SeccionPlanilla, student: Matricula) => {
    if (dirty) {toast.show(t('grading.saveFirst'), 'info'); return}
    const result = byResult.get(student.id)?.secciones?.find(item => item.componente_token === section.componente_token)
    setManualEditor({section, student, result})
    setManualValue(result?.estado === 'calculado'
      ? (visual ? result.valoracion?.url_token ?? '' : gradeDecimal(result.raw_value)) : '')
    setManualReason('')
  }
  const submitManualComponent = (annul = false) => {
    if (!manualEditor || !manualEditor.section.componente_token || manualReason.trim().length < 10) return
    const valueValid = visual ? !!data.escala_visual?.opciones.some(option => option.url_token === manualValue)
      : manualValue.trim() !== '' && validGrade(gradeDecimal(manualValue), data.configuracion.valor_min, data.configuracion.valor_max)
    if (!annul && !valueValid) return
    manualComponent.mutate({componenteId: manualEditor.section.componente_token,
      matriculaId: manualEditor.student.url_token, valor: annul || visual ? null : gradeDecimal(manualValue),
      escalaOpcionToken: !annul && visual ? manualValue : null,
      motivo: manualReason.trim(), version: manualEditor.result?.manual_version ?? 0}, {
      onSuccess: () => {setManualEditor(null); toast.success(t('grading.saved'))},
      onError: error => toast.error(error.message),
    })
  }

  const indicatorPeriod = catalog.data?.periodos.find(item => item.id === period || item.url_token === period)
  const indicatorContext = selected && indicatorPeriod && selected.grupo?.grado?.id ? {
    year: selected.ano_lectivo_id, grade: selected.grupo.grado.id,
    group: selected.grupo_id, subject: selected.materia_id,
    period, periodOrder: indicatorPeriod.orden,
  } : null

  return <><div className='card grade-sheet'>
    <div className='card-body pb-0'>
      <div className='d-flex flex-wrap justify-content-between align-items-start gap-4 mb-5'>
        <div>
          <button className='btn btn-link p-0 mb-3 text-muted' onClick={() => {if (clean()) navigate('/evaluacion/catalogo')}}><KTIcon iconName='arrow-left' className='fs-4' />{t('grading.back')}</button>
          <h2 className='fs-2 fw-bold mb-2'>{selected?.materia.nombre ?? t('evaluacion.planilla.title')}</h2>
          <div className='d-flex align-items-center flex-wrap gap-3 text-muted'>
            <span><KTIcon iconName='people' className='fs-4 me-1' />{selected ? `${selected.grupo.grado.nombre} / (${selected.grupo.nombre})` : '—'}</span>
            <span className='badge badge-light-primary'>{data.periodo?.nombre}</span>
            {visual ? <span>{data.escala_visual?.nombre}</span> : <span>{data.configuracion.valor_min} – {data.configuracion.valor_max}</span>}
          </div>
        </div>
        <div className='d-flex align-items-center gap-3'>
          <span className={`fs-7 ${dirty ? 'text-warning' : 'text-muted'}`} role='status'>{dirty ? intl.formatMessage({id: 'grading.changes'}, {count: Object.keys(draft).length}) : t('grading.upToDate')}</span>
          <button className='btn btn-primary' disabled={!data.editable || !dirty || (data.requiere_motivo && reason.trim().length < 3) || save.isPending} onClick={saveGrades}><KTIcon iconName='check' className='fs-3' />{save.isPending ? t('grading.saving') : t('grading.save')}</button>
        </div>
      </div>
      <p className='text-muted fs-7 mb-5'>{t(visual ? 'grading.visualHelp' : 'grading.keyboard')}</p>
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
            {section.modo !== 'MANUAL' && data.permisos.crear && <button className='btn btn-sm btn-light-primary' disabled={!editable} onClick={() => openActivity(section)}><KTIcon iconName='plus' className='fs-4' />{t('grading.activity')}</button>}
          </div>
          <label className='form-label fs-7' htmlFor={`grade-mode-${sectionKey(section)}`}>{t('grading.componentMode')}</label>
          <select id={`grade-mode-${sectionKey(section)}`} className='form-select form-select-sm' value={section.modo}
            disabled={!editable || !data.permisos.configurar || dirty}
            onChange={e => activityMutation.mutate({operacion: 'modo', componente_token: section.componente_token, preinforme_token: section.preinforme_token,
              version: section.version, modo: e.target.value as SeccionPlanilla['modo']}, {onError: error => toast.error(error.message)})}>
            <option value='SIMPLE_AVERAGE'>{t('grading.modeSimple')}</option>
            <option value='WEIGHTED_AVERAGE'>{t('grading.modeWeighted')}</option>
            <option value='MANUAL'>{t('grading.modeManual')}</option>
          </select>
          {section.modo === 'MANUAL' && <p className='text-muted fs-7 mt-3 mb-0'>{t('grading.manualComponentHelp')}</p>}
          {section.modo === 'WEIGHTED_AVERAGE' && <p className='text-muted fs-7 mt-3 mb-0'>{t('grading.total')}: {Number(section.actividades.reduce((sum, a) => sum + Number(a.peso ?? 0), 0).toFixed(4))}% / 100%</p>}
        </div>
      </div>)}</div>
      <div className='d-flex flex-wrap gap-3 justify-content-end align-items-center mb-4'>
        <span className='text-muted fs-7'>{intl.formatMessage({id: 'grading.students'}, {count: data.pagination.matriculas.total})}</span>
      </div>
    </div>
    <div className='grade-sheet-scroll' role='region' aria-label={t('evaluacion.planilla.title')} tabIndex={0}>
      <table className='table grade-sheet-table mb-0' style={{minWidth: `${340 + sections.reduce((count, section) => count + sectionColumns(section), 0) * 128}px`}}>
        <colgroup><col style={{width: 'var(--grade-student-width)'}} />{sections.flatMap(section => Array.from({length: sectionColumns(section)}, (_, index) => <col key={`${sectionKey(section)}-${index}`} />))}<col style={{width: 'var(--grade-result-width)'}} /></colgroup>
        <thead>
          <tr><th className='grade-student' rowSpan={2}>{t('evaluacion.matriculas.estudiante')}</th>
            {sections.map(section => <th key={sectionKey(section)} className='grade-section' colSpan={sectionColumns(section)}>
              {section.nombre ?? t('grading.periodActivities')}{data.usa_preinformes && section.peso != null ? ` · ${gradeDecimal(section.peso)}%` : ''}
            </th>)}<th className='grade-result' rowSpan={2}>{t('evaluacion.planilla.definitiva')}</th>
          </tr>
          <tr>{sections.flatMap(section => section.modo === 'MANUAL' ? [<th key={`${sectionKey(section)}-manual`} className='grade-activity'>{t('grading.manualComponentResult')}</th>] : [...(section.actividades.length ? section.actividades.map(activity => <th key={activity.id} className='grade-activity'>
            <button className='btn btn-link p-0 fw-semibold text-gray-800 w-100' disabled={!editable || (!data.permisos.editar && !data.permisos.eliminar)} onClick={() => openActivity(section, activity)}>
              {activity.nombre}{data.permisos.editar && <KTIcon iconName='pencil' className='fs-8 ms-2 text-muted' />}
            </button><span className='d-block text-muted fw-normal fs-8 mt-1'>{activity.fecha?.slice(0, 10)}{section.modo === 'WEIGHTED_AVERAGE' ? ` · ${gradeDecimal(activity.peso) || '—'}%` : ''}</span>
          </th>) : [<th key={sectionKey(section)} className='grade-activity text-muted fw-normal'>{t('grading.noActivities')}</th>]),
          ...(data.usa_preinformes ? [<th key={`${sectionKey(section)}-subtotal`} className='grade-activity text-primary'>{t('grading.subtotal')}</th>] : [])])}</tr>
        </thead>
        <tbody>{data.matriculas.map((enrollment, rowIndex) => {
          const result = byResult.get(enrollment.id)
          const rowDirty = Object.values(draft).some(v => v.matricula_id === enrollment.id)
          return <tr key={enrollment.id}><th scope='row' className='grade-student'><span className='grade-row-number'>{rowIndex + 1}</span><span>{enrollment.nombre_lista ?? enrollment.estudiante.name}</span>
            {data.periodo.estado === 'cerrado' && <button className='btn btn-link p-0 d-block fs-8 mt-2' onClick={() => {if (clean()) navigate(`/evaluacion/recuperaciones/${enrollment.url_token}`)}}>{t('evaluacion.recuperaciones.title')}</button>}
          </th>
            {sections.flatMap(section => section.modo === 'MANUAL' ? [<td key={`${sectionKey(section)}-manual`} className='grade-cell text-center'>
              {(() => {
                const subtotal = result?.secciones?.find(item => item.componente_token === section.componente_token)
                return <button className='btn btn-sm btn-light-primary' disabled={!editable || dirty || !section.componente_token}
                  onClick={() => openManualComponent(section, enrollment)} aria-label={`${t('grading.manualComponentResult')} · ${enrollment.estudiante.name} · ${section.nombre ?? data.periodo.nombre}`}>
                  {subtotal?.estado === 'calculado' ? (visual ? <VisualChoice compact choice={subtotal.valoracion} /> : gradeDecimal(subtotal.display_value)) : t('grading.manualComponentRegister')}
                </button>
              })()}
            </td>] : [...(section.actividades.length ? section.actividades.map(activity => {
              const colIndex = activities.indexOf(activity)
              const value = valueOf(activity.id, enrollment.id)
              const changed = `${activity.id}:${enrollment.id}` in draft
              const valid = validGrade(gradeDecimal(value), data.configuracion.valor_min, data.configuracion.valor_max)
              return <td key={activity.id} className={changed ? 'grade-cell changed' : 'grade-cell'}>
                {visual ? <div className='d-flex align-items-center justify-content-center gap-2 px-2'>
                  {(() => {
                    const choice = data.escala_visual?.opciones.find(option => option.url_token === choiceOf(activity.id, enrollment.id))
                    return choice?.imagen_url ? <img src={choice.imagen_url} alt='' width={24} height={24} className='rounded-circle object-fit-cover' />
                      : <span aria-hidden='true' className='fs-3'>{choice?.emoji ?? '—'}</span>
                  })()}
                  <select className='form-select form-select-sm border-0' disabled={!editable}
                    data-grade-row={rowIndex} data-grade-col={colIndex}
                    aria-label={`${enrollment.estudiante.name} · ${activity.nombre}`}
                    value={choiceOf(activity.id, enrollment.id)}
                    onChange={event => updateVisual(activity.id, enrollment.id, event.target.value)}>
                    <option value=''>{t('grading.pending')}</option>
                    {data.escala_visual?.opciones.map(option => <option key={option.url_token} value={option.url_token}>
                      {option.emoji ? `${option.emoji} ` : ''}{option.nombre}
                    </option>)}
                  </select>
                </div> : <input type='text' inputMode='decimal' autoComplete='off' className={`grade-input ${valid ? '' : 'invalid'}`} disabled={!editable}
                  data-grade-row={rowIndex} data-grade-col={colIndex} aria-invalid={!valid} aria-label={`${enrollment.estudiante.name} · ${activity.nombre}`}
                  value={value} onChange={e => updateGrade(activity.id, enrollment.id, e.target.value)}
                  onBlur={() => {if (changed && valid && value !== gradeDecimal(value)) updateGrade(activity.id, enrollment.id, gradeDecimal(value))}}
                  onFocus={e => e.target.select()} onKeyDown={e => keyboard(e, rowIndex, colIndex)} onPaste={e => paste(e, rowIndex, colIndex)} />}
              </td>
            }) : [<td key={sectionKey(section)} className='grade-cell text-center text-muted'>—</td>]),
            ...(data.usa_preinformes ? [<td key={`${sectionKey(section)}-subtotal`} className='grade-cell text-center fw-semibold text-primary'>
              {rowDirty ? '—' : (() => {
                const subtotal = result?.secciones?.find(s => s.componente_token === section.componente_token)
                return visual ? <VisualChoice compact choice={subtotal?.valoracion ?? subtotal?.valoracion_provisional} />
                  : gradeDecimal(subtotal?.display_value ?? subtotal?.provisional) || t('grading.pending')
              })()}
            </td>] : [])])}
            <td className='grade-result' title={rowDirty ? t('grading.saveToCalculate') : result?.motivo}>
              {rowDirty ? <span className='text-muted fs-8'>{t('grading.saveToCalculate')}</span>
                : visual && result?.valoracion ? <VisualChoice compact choice={result.valoracion} />
                : visual && result?.valoracion_provisional ? <span className='grade-provisional' title={t('grading.provisionalHelp')}>
                    <VisualChoice compact choice={result.valoracion_provisional} /> <small>{t('grading.provisional')}</small>
                  </span>
                : !visual && result?.estado === 'calculado'
                ? <span className={`badge fs-6 badge-light-${result.aprobado ? 'success' : 'danger'}`}>{gradeDecimal(result.display_value)}</span>
                : !visual && result?.provisional != null ? <span className='grade-provisional' title={t('grading.provisionalHelp')}>
                    {gradeDecimal(result.provisional)} <small>{t('grading.provisional')}</small>
                  </span> : <span className='text-muted fs-8'>{t('grading.pending')}</span>}
            </td>
          </tr>
        })}</tbody>
      </table>
      {!data.matriculas.length && <div className='text-center text-muted p-8'>{t('grading.noStudents')}</div>}
    </div>
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
    <Modal show={!!manualEditor} onHide={() => {if (!manualComponent.isPending) setManualEditor(null)}} centered>
      <Modal.Header closeButton><Modal.Title>{t('grading.manualComponentResult')}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className='fw-semibold'>{manualEditor?.student.nombre_lista ?? manualEditor?.student.estudiante.name} · {manualEditor?.section.nombre ?? data.periodo.nombre}</p>
        <label className='form-label required' htmlFor='manual-component-value'>{t('grading.manualComponentResult')}</label>
        {visual ? <select id='manual-component-value' className='form-select mb-4' value={manualValue} onChange={e => setManualValue(e.target.value)}>
          <option value=''>{t('grading.pending')}</option>
          {data.escala_visual?.opciones.map(option => <option key={option.url_token} value={option.url_token}>{option.nombre}</option>)}
        </select> : <><input id='manual-component-value' className='form-control mb-2' inputMode='decimal' value={manualValue}
          onChange={e => setManualValue(e.target.value.replace(',', '.'))} />
          <small className='d-block text-muted mb-4'>{data.configuracion.valor_min} – {data.configuracion.valor_max}</small></>}
        <label className='form-label required' htmlFor='manual-component-reason'>{t('grading.manualReason')}</label>
        <textarea id='manual-component-reason' className='form-control' rows={3} maxLength={1000} value={manualReason}
          onChange={e => setManualReason(e.target.value)} />
        {manualComponent.error && <div className='alert alert-danger mt-4' role='alert'>{manualComponent.error.message}</div>}
      </Modal.Body>
      <Modal.Footer className='justify-content-between'>
        <div>{manualEditor?.result?.estado === 'calculado' && <button className='btn btn-light-danger' disabled={manualComponent.isPending || manualReason.trim().length < 10}
          onClick={() => submitManualComponent(true)}>{t('grading.manualComponentAnnul')}</button>}</div>
        <div className='d-flex gap-3'><button className='btn btn-light' disabled={manualComponent.isPending} onClick={() => setManualEditor(null)}>{t('grading.cancel')}</button>
          <button className='btn btn-primary' disabled={manualComponent.isPending || manualReason.trim().length < 10 ||
            (visual ? !data.escala_visual?.opciones.some(option => option.url_token === manualValue)
              : manualValue.trim() === '' || !validGrade(gradeDecimal(manualValue), data.configuracion.valor_min, data.configuracion.valor_max))}
            onClick={() => submitManualComponent()}>{t('grading.save')}</button></div>
      </Modal.Footer>
    </Modal>
  </div>
    {indicatorContext && <IndicadorWorkspace key={`${assignment}:${period}`} context={indicatorContext}
      periodState={data.periodo.estado} />}
  </>
}

function ManualSubjectSheet({assignment, period, data, subject, back}: {
  assignment: string; period: string; data: PlanillaResponse; subject: string; back: () => void
}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const save = useGuardarResultadoManual(assignment, period)
  const [editing, setEditing] = useState<{student: Matricula; result: ResultadoEstudiante} | null>(null)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const visual = data.escala_visual?.tipo === 'imagenes'
  const validManualValue = visual ? !!data.escala_visual?.opciones.some(option => option.url_token === value)
    : value.trim() !== '' && validGrade(gradeDecimal(value), data.configuracion.valor_min, data.configuracion.valor_max)
  const results = new Map(data.resultados.map(row => [row.matricula_id, row]))
  const open = (student: Matricula, result: ResultadoEstudiante) => {
    setEditing({student, result}); setValue(result.estado === 'calculado'
      ? (visual ? result.valoracion?.url_token ?? '' : gradeDecimal(result.raw_value)) : '')
    setReason('')
  }
  const submit = (annul = false) => {
    if (!editing || reason.trim().length < 10 || (!annul && !validManualValue)) return
    save.mutate({matriculaId: editing.student.url_token, valor: annul || visual ? null : gradeDecimal(value),
      escalaOpcionToken: !annul && visual ? value : null,
      motivo: reason.trim(), version: editing.result.manual_version ?? 0}, {
      onSuccess: () => {setEditing(null); toast.success(t('grading.saved'))},
      onError: error => toast.error(error.message),
    })
  }
  return <div className='card grade-sheet'><div className='card-body'>
    <button className='btn btn-link p-0 mb-4 text-muted' onClick={back}><KTIcon iconName='arrow-left' className='fs-4' />{t('grading.back')}</button>
    <h2 className='fs-2 fw-bold mb-2'>{subject || t('evaluacion.planilla.title')}</h2>
    <p className='text-muted mb-5'>{data.periodo.nombre} · {t('grading.manualSubjectHelp')}</p>
    {!data.editable && <div className='alert alert-info'>{t('grading.readOnly')}</div>}
    <div className='table-responsive'><table className='table table-row-dashed align-middle'>
      <thead><tr><th>{t('evaluacion.matriculas.estudiante')}</th><th>{t('evaluacion.planilla.definitiva')}</th><th className='text-end'>{t('grading.manualAction')}</th></tr></thead>
      <tbody>{data.matriculas.map(student => {
        const result = results.get(student.id)
        return <tr key={student.id}><th scope='row'>{student.nombre_lista ?? student.estudiante.name}</th>
          <td>{result?.estado === 'calculado'
            ? (result.valoracion ? <VisualChoice compact choice={result.valoracion} />
              : <span className={`badge badge-light-${result.aprobado ? 'success' : 'danger'}`}>{gradeDecimal(result.display_value)}</span>)
            : <span className='badge badge-light-warning'>{t('grading.pending')}</span>}</td>
          <td className='text-end'><button className='btn btn-sm btn-light-primary' disabled={!data.editable || save.isPending || !result}
            onClick={() => result && open(student, result)}>{t(result?.estado === 'calculado' ? 'grading.manualEdit' : 'grading.manualRegister')}</button></td>
        </tr>
      })}</tbody>
    </table></div>
    {!data.matriculas.length && <p className='text-center text-muted'>{t('grading.noStudents')}</p>}
    <Modal show={!!editing} onHide={() => !save.isPending && setEditing(null)} centered>
      <Modal.Header closeButton><Modal.Title>{t('grading.manualTitle')}</Modal.Title></Modal.Header>
      <Modal.Body><p className='fw-semibold'>{editing?.student.nombre_lista ?? editing?.student.estudiante.name}</p>
        <label className='form-label required' htmlFor='manual-subject-value'>{t('evaluacion.planilla.definitiva')}</label>
        {visual ? <div className='d-flex align-items-center gap-3 mb-4'>
          {value && <VisualChoice compact choice={data.escala_visual?.opciones.find(option => option.url_token === value)} />}
          <select id='manual-subject-value' className='form-select' value={value} onChange={event => setValue(event.target.value)}>
            <option value=''>{t('grading.pending')}</option>
            {data.escala_visual?.opciones.map(option => <option key={option.url_token} value={option.url_token}>{option.nombre}</option>)}
          </select>
        </div> : <><input id='manual-subject-value' className='form-control mb-4' inputMode='decimal' value={value}
          onChange={event => setValue(event.target.value.replace(',', '.'))} />
          <small className='d-block text-muted mb-4'>{data.configuracion.valor_min} – {data.configuracion.valor_max}</small></>}
        <label className='form-label required' htmlFor='manual-subject-reason'>{t('grading.manualReason')}</label>
        <textarea id='manual-subject-reason' className='form-control' rows={3} maxLength={1000} value={reason}
          onChange={event => setReason(event.target.value)} />
        {save.error && <div className='alert alert-danger mt-4' role='alert'>{save.error.message}</div>}
      </Modal.Body>
      <Modal.Footer className='justify-content-between'>
        <div>{editing?.result.estado === 'calculado' && <button className='btn btn-light-danger' disabled={save.isPending || reason.trim().length < 10}
          onClick={() => submit(true)}>{t('grading.manualAnnul')}</button>}</div>
        <div className='d-flex gap-3'><button className='btn btn-light' disabled={save.isPending} onClick={() => setEditing(null)}>{t('grading.cancel')}</button>
          <button className='btn btn-primary' disabled={save.isPending || reason.trim().length < 10 || !validManualValue}
            onClick={() => submit()}>{t('grading.save')}</button></div>
      </Modal.Footer>
    </Modal>
  </div></div>
}
