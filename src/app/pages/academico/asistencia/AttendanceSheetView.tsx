import {useEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react'
import {Modal} from 'react-bootstrap'
import {useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {useSearchParams} from 'react-router-dom'
import {ApiError, api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {AttendancePolicySettings} from './AttendancePolicyPanel'
import {TeacherCorrectionForm} from './AttendanceRequests'
import {useAttendance, useAttendanceCatalog, useAttendanceSheet,
  type AttendanceSheet, type AttendanceSheetColumn, type AttendanceState} from './asistencia.api'
import './attendance-sheet.css'

type Draft = {version: number; marks: Record<string, AttendanceState>}
const columnKey = (column: AttendanceSheetColumn) => `${column.fecha}:${column.sesion_token}`
const dateLabel = (date: string) => {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
const publicToken = (value: string | null) => /^[A-Za-z0-9_-]{24}$/.test(value ?? '') ? value! : ''

function AttendanceGrid({sheet, assignment, selected, onSelect, onDirtyChange}: {
  sheet: AttendanceSheet; assignment: string; selected: string; onSelect: (key: string) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const client = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const gridRef = useRef<HTMLTableElement>(null)
  const periodClosed = sheet.periodo.estado === 'cerrado'
  useEffect(() => { setDrafts({}) }, [assignment, sheet.periodo.token, revision])
  useEffect(() => { if (periodClosed) setDrafts({}) }, [periodClosed])
  useEffect(() => { onDirtyChange(Object.keys(drafts).length > 0) }, [drafts, onDirtyChange])
  const columns = sheet.columnas
  const selectedColumn = columns.find(column => columnKey(column) === selected)
  const dirtyKeys = Object.keys(drafts)
  const stale = dirtyKeys.some(key => columns.find(column => columnKey(column) === key)?.version !== drafts[key].version)
  const cellState = (column: AttendanceSheetColumn, token: string) =>
    drafts[columnKey(column)]?.marks[token] ?? column.marcas[token] ?? 'sin_marcar'

  const changeCell = (column: AttendanceSheetColumn, token: string, choice: 'presente' | 'ausente') => {
    const key = columnKey(column)
    const original = column.marcas[token] ?? 'sin_marcar'
    if (!column.editable || !column.matriculas.includes(token)
      || original === 'ausente' || original === 'tarde' || original === 'justificada') return
    setDrafts(previous => {
      const existing = previous[key]
      const value = (existing?.marks[token] ?? original) === choice ? 'sin_marcar' : choice
      const marks = {...existing?.marks}
      if (value === original) delete marks[token]
      else marks[token] = value
      const updated = {...previous}
      if (Object.keys(marks).length) updated[key] = {version: existing?.version ?? column.version, marks}
      else delete updated[key]
      return updated
    })
  }

  const focusCell = (row: number, col: number, choice: 'presente' | 'ausente') => {
    const target = gridRef.current?.querySelector<HTMLButtonElement>(
      `button[data-attendance-row="${row}"][data-attendance-col="${col}"][data-attendance-choice="${choice}"]`,
    )
    if (!target || target.disabled) return false
    target.focus()
    return true
  }

  const navigateCell = (event: KeyboardEvent<HTMLButtonElement>, row: number, col: number,
    choice: 'presente' | 'ausente') => {
    const key = event.key
    if (!['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return
    const rows = sheet.estudiantes.length
    const cols = columns.length
    let found = false
    if (key === 'Tab') {
      const step = event.shiftKey ? -1 : 1
      for (let index = row * cols + col + step; index >= 0 && index < rows * cols; index += step) {
        if (focusCell(Math.floor(index / cols), index % cols, 'presente')) { found = true; break }
      }
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (key === 'ArrowLeft' && choice === 'ausente') found = focusCell(row, col, 'presente')
      if (key === 'ArrowRight' && choice === 'presente') found = focusCell(row, col, 'ausente')
      const step = key === 'ArrowLeft' ? -1 : 1
      for (let next = col + step; !found && next >= 0 && next < cols; next += step) {
        found = focusCell(row, next, step < 0 ? 'ausente' : 'presente')
      }
    } else {
      const step = key === 'ArrowUp' ? -1 : 1
      for (let next = row + step; next >= 0 && next < rows; next += step) {
        if (focusCell(next, col, choice)) { found = true; break }
      }
    }
    if (found || key !== 'Tab') event.preventDefault()
  }

  const save = async () => {
    if (saving || stale) return
    const targets = dirtyKeys.length ? columns.filter(column => dirtyKeys.includes(columnKey(column)))
      : selectedColumn?.editable && !selectedColumn.registrada ? [selectedColumn] : []
    if (!targets.length) return
    setSaving(true)
    const saved: string[] = []
    try {
      for (const column of targets) {
        const key = columnKey(column)
        const draft = drafts[key]
        await api.put('/asistencias?opaque=1', {
          asignacion_token: assignment, sesion_token: column.sesion_token,
          fecha: column.fecha, version: draft?.version ?? column.version,
          marcas: column.matriculas.map(token => ({matricula_token: token,
            estado: draft?.marks[token] ?? column.marcas[token] ?? 'sin_marcar'})),
        })
        saved.push(key)
      }
      toast.success(t('attendance.saved'))
    } catch (error) {
      const reason = error instanceof ApiError
        ? Object.values(error.errors ?? {}).flat()[0] ?? error.message : t('attendance.saveError')
      toast.error(saved.length ? `${t('attendance.partialSave')} ${reason}` : reason)
    } finally {
      if (saved.length) setDrafts(previous => {
        const updated = {...previous}
        saved.forEach(key => delete updated[key])
        return updated
      })
      await client.invalidateQueries({queryKey: ['asistencias', 'planilla', assignment]})
      await client.invalidateQueries({queryKey: ['asistencias', 'detalle', assignment]})
      setSaving(false)
    }
  }

  return <section className='card mb-6'><div className='card-body'>
    {periodClosed && <div className='alert alert-danger mb-4' role='alert'>{t('attendance.sheet.periodClosed')}</div>}
    <div className='d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4'>
      <div>
        <h3 className='fs-4 fw-bold mb-1'>{t('attendance.sheet.title')}</h3>
        <p className='text-muted fs-7 mb-0'>{t('attendance.sheet.help')}</p>
      </div>
      {!periodClosed && <button type='button' className='btn btn-primary' disabled={saving || stale ||
        (selectedColumn && !selectedColumn.matriculas.length && !dirtyKeys.length) ||
        (!dirtyKeys.length && (!selectedColumn?.editable || selectedColumn.registrada))}
        onClick={save}>{saving ? t('common.pleaseWait') : dirtyKeys.length
          ? t('attendance.sheet.saveChanges') : t('attendance.sheet.saveBlank')}</button>}
    </div>
    {stale && <div className='alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2' role='alert'>
      <span>{t('attendance.stale')}</span>
      <button type='button' className='btn btn-sm btn-light' onClick={() => {
        if (window.confirm(t('attendance.sheet.discard'))) setRevision(value => value + 1)
      }}>
        {t('attendance.reload')}
      </button>
    </div>}
    {!columns.length && <div className='alert alert-info'>{t('attendance.sheet.noClasses')}</div>}
    {!!columns.length && !sheet.estudiantes.length && <div className='alert alert-info'>{t('attendance.sheet.noStudents')}</div>}
    {!!columns.length && <div className='attendance-sheet-scroll' tabIndex={0} aria-label={t('attendance.sheet.title')}>
      <table ref={gridRef} className='attendance-sheet-table'>
        <thead><tr>
          <th className='attendance-sheet-student'>{t('attendance.student')}</th>
          {columns.map(column => <th key={columnKey(column)} className={`attendance-sheet-date ${selected === columnKey(column) ? 'is-selected' : ''}`}>
            <button type='button' onClick={() => onSelect(columnKey(column))} aria-pressed={selected === columnKey(column)}
              title={t('attendance.sheet.selectDate')}>
              <span>{dateLabel(column.fecha)}</span>
              <small>{column.hora_inicio}–{column.hora_fin}</small>
              {column.historica && <small>{t('attendance.historical')}</small>}
              {column.registrada && <span className='attendance-sheet-recorded' aria-label={t('attendance.recorded')} />}
            </button>
          </th>)}
          <th className='attendance-sheet-total'>{t('attendance.absenceSummary')}</th>
        </tr></thead>
        <tbody>{sheet.estudiantes.map((student, index) => <tr key={student.matricula_token}>
          <th scope='row' className='attendance-sheet-student'>
            <span className='attendance-sheet-number'>{index + 1}</span>{student.nombre}
          </th>
          {columns.map((column, columnIndex) => {
            const key = columnKey(column)
            const state = cellState(column, student.matricula_token)
            const belongs = column.matriculas.includes(student.matricula_token)
            const locked = !column.editable || !student.activa || !belongs
              || ['ausente', 'tarde', 'justificada'].includes(column.marcas[student.matricula_token] ?? '')
            return <td key={key} className={`attendance-sheet-cell attendance-sheet-${state} ${selected === key ? 'is-selected' : ''}`}>
              {belongs && (state === 'tarde' || state === 'justificada'
                ? <span className='attendance-sheet-legacy' title={t(`attendance.${state}`)}>{state === 'tarde' ? 'T' : 'J'}</span>
                : <div className='attendance-sheet-choices' role='group'
                    aria-label={`${student.nombre} · ${dateLabel(column.fecha)} ${column.hora_inicio}`}>
                    {(['presente', 'ausente'] as const).map(choice => <button key={choice} type='button'
                      className={state === choice ? 'is-active' : ''} aria-pressed={state === choice}
                      disabled={locked || saving} onClick={() => changeCell(column, student.matricula_token, choice)}
                      tabIndex={choice === 'presente' ? 0 : -1}
                      data-attendance-row={index} data-attendance-col={columnIndex} data-attendance-choice={choice}
                      onKeyDown={event => navigateCell(event, index, columnIndex, choice)}
                      aria-label={t(`attendance.${choice}`)}
                      title={locked && state === 'ausente' ? t('attendance.sheet.correctAbsence') : t(`attendance.${choice}`)}>
                      {choice === 'presente' ? '✓' : 'X'}
                    </button>)}
                  </div>)}
            </td>
          })}
          <td className='attendance-sheet-total'>
            <strong>{student.resumen.faltas_equivalentes}</strong> / {student.resumen.registradas}
            <small>{student.resumen.porcentaje} %</small>
            {student.resumen.alerta && <span className='badge badge-light-warning'>{t('attendance.alert')}</span>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className='attendance-sheet-legend mt-4'>
      <span><b className='text-success'>✓</b> {t('attendance.presente')}</span>
      <span><b className='text-danger'>X</b> {t('attendance.ausente')}</span>
      <span><b>·</b> {t('attendance.unmarked')}</span>
      <span>T {t('attendance.tarde')} · J {t('attendance.justificada')}</span>
    </div>
    <p className='text-muted fs-7 mt-3 mb-0'>{t('attendance.summaryHelp')}</p>
  </div></section>
}

export function AttendanceSheetView({canConfigure, canRequest}: {canConfigure: boolean; canRequest: boolean}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const requestedYear = publicToken(params.get('ano'))
  const requestedGroup = publicToken(params.get('grupo'))
  const requestedAssignment = publicToken(params.get('asignacion'))
  const requestedPeriod = publicToken(params.get('periodo'))
  const [selected, setSelected] = useState('')
  const [dirty, setDirty] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const catalog = useAttendanceCatalog(requestedYear)
  const years = catalog.data?.anos ?? []
  const year = years.some(item => item.token === requestedYear)
    ? requestedYear : catalog.data?.ano_lectivo_token ?? ''
  const catalogReady = !!catalog.data && !catalog.isPlaceholderData && catalog.data.ano_lectivo_token === year
  const assignments = catalogReady ? catalog.data?.asignaciones : undefined
  const groups = useMemo(() => [...new Map((assignments ?? []).map(item => [item.grupo_token, {
    token: item.grupo_token, nombre: item.grupo_nombre,
  }])).values()], [assignments])
  const group = groups.some(item => item.token === requestedGroup) ? requestedGroup : ''
  const subjects = (assignments ?? []).filter(item => item.grupo_token === group)
  const assignment = subjects.some(item => item.token === requestedAssignment) ? requestedAssignment : ''
  const sheet = useAttendanceSheet(assignment, requestedPeriod)
  const selectedColumn = sheet.data?.columnas.find(column => columnKey(column) === selected)
  const detail = useAttendance(assignment, canRequest && selectedColumn?.registrada ? selectedColumn.fecha : '')
  const canLeave = () => !dirty || window.confirm(t('attendance.sheet.discard'))
  const yearInfo = years.find(item => item.token === year)

  useEffect(() => {
    if (!catalogReady || !year) return
    if (!requestedYear && catalog.data) {
      client.setQueryData(['asistencias', 'catalogo', year], catalog.data)
    }
    const next = new URLSearchParams(params)
    if (next.get('ano') !== year) next.set('ano', year)
    if (params.has('grupo') && !group) {
      next.delete('grupo'); next.delete('asignacion'); next.delete('periodo')
    } else if (params.has('asignacion') && !assignment) {
      next.delete('asignacion'); next.delete('periodo')
    } else if (!assignment && next.has('periodo')) next.delete('periodo')
    if (next.toString() !== params.toString()) setParams(next, {replace: true})
  }, [catalogReady, year, group, assignment, requestedYear, requestedGroup, requestedAssignment,
    catalog.data, client, params, setParams])

  useEffect(() => {
    if (!requestedYear || !(catalog.error instanceof ApiError) || catalog.error.status !== 404) return
    setParams(current => {
      const next = new URLSearchParams(current)
      for (const key of ['ano', 'grupo', 'asignacion', 'periodo']) next.delete(key)
      return next
    }, {replace: true})
  }, [catalog.error, requestedYear, setParams])

  useEffect(() => {
    if (!assignment) return
    if (requestedPeriod && sheet.isError && sheet.error instanceof ApiError && sheet.error.status === 404) {
      setParams(current => {const next = new URLSearchParams(current); next.delete('periodo'); return next}, {replace: true})
      return
    }
    if (!sheet.data) return
    const periodToken = sheet.data.periodo.token
    if (requestedPeriod === periodToken) return
    if (!requestedPeriod) client.setQueryData(['asistencias', 'planilla', assignment, periodToken], sheet.data)
    setParams(current => {const next = new URLSearchParams(current); next.set('periodo', periodToken); return next}, {replace: true})
  }, [assignment, requestedPeriod, sheet.data, sheet.error, sheet.isError, client, setParams])

  const changeFilter = (field: 'ano' | 'grupo' | 'asignacion' | 'periodo', value: string) => {
    if (!canLeave()) return
    setDirty(false)
    setSelected('')
    setParams(current => {
      const next = new URLSearchParams(current)
      if (value) next.set(field, value); else next.delete(field)
      if (field === 'ano') for (const key of ['grupo', 'asignacion', 'periodo']) next.delete(key)
      if (field === 'grupo') for (const key of ['asignacion', 'periodo']) next.delete(key)
      if (field === 'asignacion') next.delete('periodo')
      return next
    })
  }

  return <>
    <section className='card mb-6'><div className='card-body'>
      <div className='d-flex flex-wrap justify-content-between align-items-start gap-3 mb-5'>
        <div><h2 className='fs-3 fw-bold mb-1'>{t('attendance.heading')}</h2>
          <p className='text-muted mb-0'>{t('attendance.sheet.intro')}</p></div>
        <div className='d-flex flex-wrap align-items-center gap-3'>
          {canConfigure && <button type='button' className='btn btn-light-primary' disabled={!year || !catalogReady}
            onClick={() => setShowPolicy(true)}>{t('attendance.sheet.configure')}</button>}
          <select className='form-select form-select-solid w-auto' aria-label={t('attendance.policyYear')}
            value={year} disabled={!years.length} onChange={event => changeFilter('ano', event.target.value)}>
            {!year && <option value=''>{t('attendance.sheet.selectYear')}</option>}
            {years.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className='row g-4'>
        <div className='col-md-5'><label htmlFor='attendance-group' className='form-label'>{t('attendance.sheet.group')}</label>
          <select id='attendance-group' className='form-select' value={group} disabled={!catalogReady}
            onChange={event => changeFilter('grupo', event.target.value)}>
            <option value=''>{t('attendance.sheet.selectGroup')}</option>
            {groups.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
          </select></div>
        <div className='col-md-4'><label htmlFor='attendance-subject' className='form-label'>{t('attendance.sheet.subject')}</label>
          <select id='attendance-subject' className='form-select' value={assignment} disabled={!group}
            onChange={event => changeFilter('asignacion', event.target.value)}>
            <option value=''>{t('attendance.sheet.selectSubject')}</option>
            {subjects.map(item => <option key={item.token} value={item.token}>{item.materia_nombre}</option>)}
          </select></div>
        <div className='col-md-3'><label htmlFor='attendance-period' className='form-label'>{t('attendance.sheet.period')}</label>
          <select id='attendance-period' className='form-select' value={sheet.data?.periodo.token ?? requestedPeriod}
            disabled={!assignment || !sheet.data?.periodos.length}
            onChange={event => changeFilter('periodo', event.target.value)}>
            {!sheet.data && <option value=''>{t('attendance.sheet.selectPeriod')}</option>}
            {sheet.data?.periodos.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
          </select></div>
      </div>
    </div></section>
    {(catalog.isPending || catalog.isPlaceholderData || sheet.isPending && !!assignment) && <div role='status' className='card card-body mb-6'>{t('attendance.loading')}</div>}
    {(catalog.isError || sheet.isError) && <div role='alert' className='alert alert-danger'>
      {sheet.error instanceof ApiError ? sheet.error.message : catalog.error instanceof ApiError
        ? catalog.error.message : t('attendance.loadError')}
    </div>}
    {!assignment && catalogReady && <div className='card card-body mb-6 text-muted'>{t('attendance.sheet.choose')}</div>}
    {assignment && sheet.data && <AttendanceGrid key={`${assignment}:${sheet.data.periodo.token}`} sheet={sheet.data}
      assignment={assignment} selected={selected} onSelect={setSelected} onDirtyChange={setDirty} />}
    {canRequest && selectedColumn?.registrada && <div className='mb-6'>
      <div className='alert alert-light-info'>{t('attendance.sheet.correctionDate')} {dateLabel(selectedColumn.fecha)} · {selectedColumn.hora_inicio}–{selectedColumn.hora_fin}</div>
      {detail.isLoading && <p role='status'>{t('attendance.loading')}</p>}
      {detail.data?.clases && <TeacherCorrectionForm key={`${assignment}:${selectedColumn.fecha}`}
        classes={detail.data.clases}
        assignment={assignment} date={selectedColumn.fecha} />}
    </div>}
    <Modal show={showPolicy} onHide={() => setShowPolicy(false)} size='xl' centered scrollable>
      <Modal.Header closeButton><Modal.Title>{t('attendance.policyTitle')}</Modal.Title></Modal.Header>
      <Modal.Body>{yearInfo && <AttendancePolicySettings year={year} yearName={yearInfo.nombre}
        readOnly={['cerrado', 'archivado'].includes(yearInfo.estado)} />}</Modal.Body>
    </Modal>
  </>
}
