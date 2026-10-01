import {useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent} from 'react'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {Modal} from 'react-bootstrap'
import {createPortal} from 'react-dom'
import {useSearchParams} from 'react-router-dom'
import {ApiError, api} from '@/lib/api/client'
import {AcademicPagination} from '@/app/shared/components/AcademicPagination'
import {formatSchoolTime} from '@/lib/format/schoolTime'
import {AcademicOptionSelect, type AcademicOption, type OpaqueAcademicOption} from '../../shared/AcademicOptionSelect'
import {useSchedule, type Assignment, type ScheduleData, type ScheduleGroup, type Session} from '../horarios.api'
import type {AcademicPaged} from '../../estructura/estructura.api'
import {fromOpaqueAcademic, toOpaqueAcademic} from '../../shared/opaqueAcademic'
import {useAcademicYear} from '../../academic-year-context'
import {useAcademicPagedList} from '../../estructura/useAcademicPagedList'
import {layoutSessions, minutes, sessionEnd, sessionStart} from './schedule-layout'
import './schedule.css'

const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const hourHeight = 112
const dragSnapMinutes = 15
const timeFromMinutes = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const cardTimeRange = (start: string, end: string) => {
  const first = formatSchoolTime(start), last = formatSchoolTime(end)
  return `${first.slice(-2) === last.slice(-2) ? first.slice(0, -3) : first}–${last}`
}
type ScheduleDrop = {day: string; start: number}
type ScheduleDrag = {session: Session; pointerId: number; startX: number; startY: number; offsetY: number; active: boolean; x: number; y: number}
type CardMenu = {session: Session; left: number; top: number}
const gradeGroupLabel = (item: ScheduleGroup) => `${item.grado?.nombre ?? ''} / (${item.nombre})`
const groupLabel = (item: ScheduleGroup) => `${gradeGroupLabel(item)}${item.sede?.nombre ? ` · ${item.sede.nombre}` : ''}`
const groupOptionLabel = (item: AcademicOption | OpaqueAcademicOption) => `${item.grado?.nombre ?? ''} / (${item.nombre ?? ''})${item.sede?.nombre ? ` · ${item.sede.nombre}` : ''}`
const subjectHue = (token: string) => [...token].reduce((value, char) => (value * 33 + char.charCodeAt(0)) % 360, 0)

export function SchedulingPanel({mode = 'horarios'}: {mode?: 'asignaciones' | 'horarios' | 'resumen'}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id}, {name: ''})
  const {yearToken: selectedYear, years, writable: yearWritable} = useAcademicYear()
  const [searchParams, setSearchParams] = useSearchParams()
  const previousYearRef = useRef(selectedYear)
  const changingYear = !!previousYearRef.current && !!selectedYear && previousYearRef.current !== selectedYear
  const requestedGroup = changingYear ? '' : searchParams.get('grupo') ?? ''
  const requestedTeacher = changingYear ? '' : searchParams.get('docente') ?? ''
  const requestedRoom = changingYear ? '' : searchParams.get('espacio') ?? ''
  // A single response contains both rows and bounded selectors. The backend
  // authorizes URL tokens; no preliminary catalog request is necessary.
  const catalogQuery = useSchedule(mode, mode !== 'asignaciones', {group: requestedGroup, teacher: requestedTeacher, room: requestedRoom})
  const [subjectId, setSubjectId] = useState('')
  const assignmentList = useAcademicPagedList<Assignment, AcademicPaged<Assignment> & {schedule: ScheduleData}>({
    key: ['horarios', 'assignment-page', selectedYear, requestedGroup, requestedTeacher, requestedRoom, subjectId],
    storageKey: 'plan.asignaciones',
    enabled: mode === 'asignaciones' && !!selectedYear,
    fetchPage: async (page, perPage) => {
      const params = new URLSearchParams({opaque: '1', ano_lectivo_token: selectedYear, page: String(page), per_page: String(perPage)})
      if (requestedGroup) params.set('grupo_token', requestedGroup)
      if (requestedTeacher) params.set('docente_token', requestedTeacher)
      if (requestedRoom) params.set('selected_espacio_token', requestedRoom)
      if (subjectId) params.set('materia_token', subjectId)
      const response = await api.get<{data: unknown}>(`/horarios?${params}`)
      const schedule = fromOpaqueAcademic<ScheduleData>(response.data)
      return {data: schedule.asignaciones, meta: schedule.pagination!.asignaciones!, schedule}
    },
  })
  const query = mode === 'asignaciones'
    ? {data: assignmentList.response?.schedule, isLoading: assignmentList.isLoading, error: assignmentList.error}
    : catalogQuery
  const catalog = query.data
  const selectedGroup = catalog?.grupos.find(item => item.ano_lectivo_id === selectedYear && item.url_token === requestedGroup)
  const selectedTeacher = catalog?.docentes.find(item => item.url_token === requestedTeacher)
  const selectedRoom = catalog?.espacios.find(item => item.url_token === requestedRoom)
  const group = selectedGroup?.url_token ?? ''
  const teacher = selectedTeacher?.url_token ?? ''
  const room = selectedRoom?.url_token ?? ''
  const yearName = (token: string) => years.find(year => year.url_token === token)?.nombre ?? '—'
  const data = query.data
  const resolveGroupOption = (option: ScheduleGroup | OpaqueAcademicOption | null): ScheduleGroup | null => {
    if (!option) return null
    return data?.grupos.find(item => item.url_token === option.url_token)
      ?? {...fromOpaqueAcademic<ScheduleGroup>(option), ano_lectivo_id: selectedYear}
  }
  const client = useQueryClient()
  const [copySource, setCopySource] = useState<Session | null>(null)
  const [cardMenu, setCardMenu] = useState<CardMenu | null>(null)
  const [dropTarget, setDropTarget] = useState<ScheduleDrop | null>(null)
  const dragTargetRef = useRef<ScheduleDrop | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragRef = useRef<ScheduleDrag | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const suppressClickRef = useRef<{id: string; until: number} | null>(null)
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)
  const [assignmentEditing, setAssignmentEditing] = useState<Assignment | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sessionDay, setSessionDay] = useState(days[0])
  const [sessionSubjectId, setSessionSubjectId] = useState('')
  const [sessionGroupId, setSessionGroupId] = useState('')
  const [selectedFormGroup, setSelectedFormGroup] = useState<ScheduleGroup | null>(null)
  const [sessionTeacherId, setSessionTeacherId] = useState('')
  const [sessionSpaceId, setSessionSpaceId] = useState('')
  const [sessionBlockId, setSessionBlockId] = useState('')
  const [sessionStartTime, setSessionStartTime] = useState('')
  const [sessionEndTime, setSessionEndTime] = useState('')
  const [useBlock, setUseBlock] = useState(false)
  function setFilter(name: 'grupo' | 'docente' | 'espacio', value: string) {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (value) next.set(name, value)
      else next.delete(name)
      return next
    })
  }
  useEffect(() => {
    if (!catalog || changingYear) return
    const canonical: Record<'grupo' | 'docente' | 'espacio', string> = {
      grupo: selectedGroup?.url_token ?? '',
      docente: selectedTeacher?.url_token ?? '',
      espacio: selectedRoom?.url_token ?? '',
    }
    if (Object.entries(canonical).every(([name, token]) => (searchParams.get(name) ?? '') === token)) return
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      for (const [name, token] of Object.entries(canonical)) {
        if (token) next.set(name, token)
        else next.delete(name)
      }
      return next
    }, {replace: true})
  }, [catalog, changingYear, searchParams, selectedGroup, selectedTeacher, selectedRoom, setSearchParams])
  useEffect(() => {
    if (previousYearRef.current && selectedYear && previousYearRef.current !== selectedYear) {
      setSearchParams(current => {
        const next = new URLSearchParams(current)
        for (const name of ['grupo', 'docente', 'espacio']) next.delete(name)
        return next
      }, {replace: true})
    }
    previousYearRef.current = selectedYear
  }, [selectedYear, setSearchParams])
  useEffect(() => {
    setShow(false); setCopySource(null); setCardMenu(null)
    setSubjectId('')
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
    scrollFrameRef.current = null; setDropTarget(null); dragTargetRef.current = null; setDraggingId(null); dragRef.current = null
  }, [selectedYear])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (dragRef.current) suppressClickRef.current = {id: dragRef.current.session.id, until: performance.now() + 500}
      clearDrag(); setCopySource(null); setCardMenu(null)
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (cardMenu && !target.closest('[data-schedule-actions-menu], [data-schedule-actions-button]')) setCardMenu(null)
      if (copySource && !target.closest('[data-schedule-day], [data-schedule-actions-menu], [data-schedule-actions-button], [data-schedule-copy-banner]')) {
        setCopySource(null); setDropTarget(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {document.removeEventListener('keydown', onKeyDown); document.removeEventListener('pointerdown', onPointerDown, true)}
  }, [cardMenu, copySource])
  const mutation = useMutation({mutationFn: async ({path, body, method}: {path: string; body?: Record<string, unknown>; method?: 'put' | 'delete'}) => {
    const url = `${path}?opaque=1`
    if (method === 'delete') return api.delete(url)
    return method === 'put' ? api.put(url, toOpaqueAcademic(body ?? {})) : api.post(url, toOpaqueAcademic(body ?? {}))
  }, onSuccess: async () => {await client.invalidateQueries({queryKey: ['horarios']}); setShow(false); setEditing(null); setAssignmentEditing(null); setDeleting(null); setError('')}, onError: e => setError(e instanceof ApiError && e.errors ? Object.values(e.errors).flat()[0] ?? e.message : e.message)})

  const writable = data?.can_manage && yearWritable
  const assignments = mode === 'asignaciones' ? assignmentList.rows : data?.asignaciones.filter(item => String(item.ano_lectivo_id) === selectedYear && (!group || String(item.grupo_id) === group) && (!teacher || String(item.docente_id) === teacher)) ?? []
  const sessions = data?.sesiones.filter(item => String(item.grupo?.ano_lectivo_id) === selectedYear && (!group || String(item.grupo_id) === group) && (!teacher || String(item.docente_id) === teacher) && (!room || String(item.espacio_fisico_id) === room)) ?? []
  const activeGroup = data?.grupos.find(item => String(item.id) === sessionGroupId) ?? (String(selectedFormGroup?.id) === sessionGroupId ? selectedFormGroup : null)
  const visibleBlocks = data?.bloques.filter(item => item.jornada_id === activeGroup?.jornada_id) ?? []
  const blockMode = useBlock && visibleBlocks.length > 0
  const activeBlock = visibleBlocks.find(item => String(item.id) === sessionBlockId)
  const visibleGroups = data?.grupos.filter(item => String(item.ano_lectivo_id) === selectedYear && (!group || String(item.id) === group)) ?? []
  const starts = [...sessions.map(item => minutes(sessionStart(item))), ...visibleGroups.flatMap(item => item.jornada?.hora_inicio ? [minutes(item.jornada.hora_inicio)] : [])]
  const ends = [...sessions.map(item => minutes(sessionEnd(item))), ...visibleGroups.flatMap(item => item.jornada?.hora_fin ? [minutes(item.jornada.hora_fin)] : [])]
  const startHour = Math.floor((starts.length ? Math.min(...starts) : 360) / 60)
  const endHour = Math.max(startHour + 1, Math.ceil((ends.length ? Math.max(...ends) : 1140) / 60))
  const height = (endHour - startHour) * hourHeight

  function getDropTarget(drag: Pick<ScheduleDrag, 'session' | 'offsetY'>, x: number, y: number): ScheduleDrop | null {
    const dayElement = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-schedule-day]')
    const day = dayElement?.dataset.scheduleDay
    if (!day || !days.includes(day)) return null
    const duration = minutes(sessionEnd(drag.session)) - minutes(sessionStart(drag.session))
    const offset = (y - dayElement.getBoundingClientRect().top - drag.offsetY) / hourHeight * 60
    const snapped = Math.round(offset / dragSnapMinutes) * dragSnapMinutes + startHour * 60
    return {day, start: Math.max(startHour * 60, Math.min(endHour * 60 - duration, snapped))}
  }

  function updateDragPreview(drag: ScheduleDrag) {
    const target = getDropTarget(drag, drag.x, drag.y)
    dragTargetRef.current = target
    setDropTarget(previous => previous?.day === target?.day && previous?.start === target?.start ? previous : target)
  }

  function autoScroll() {
    scrollFrameRef.current = null
    const drag = dragRef.current
    const scroll = scrollRef.current
    if (!drag?.active || !scroll) return
    const bounds = scroll.getBoundingClientRect()
    const beforeX = scroll.scrollLeft, beforeY = window.scrollY
    if (drag.x >= bounds.left && drag.x <= bounds.right && drag.y >= bounds.top && drag.y <= bounds.bottom) {
      if (drag.x > bounds.right - 20) scroll.scrollLeft += 16
      else if (drag.x < bounds.left + 20) scroll.scrollLeft -= 16
    }
    if (drag.y > window.innerHeight - 48) window.scrollBy(0, 16)
    else if (drag.y < 48) window.scrollBy(0, -16)
    updateDragPreview(drag)
    if (beforeX !== scroll.scrollLeft || beforeY !== window.scrollY) scrollFrameRef.current = requestAnimationFrame(autoScroll)
  }

  function clearDrag() {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
    scrollFrameRef.current = null
    dragRef.current = null
    dragTargetRef.current = null
    setDropTarget(null)
    setDraggingId(null)
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, session: Session) {
    if (!writable || mutation.isPending || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (copySource && copySource.id !== session.id) {setCopySource(null); setDropTarget(null)}
    const rect = event.currentTarget.getBoundingClientRect()
    dragRef.current = {session, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      offsetY: event.clientY - rect.top, active: false, x: event.clientX, y: event.clientY}
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    drag.x = event.clientX; drag.y = event.clientY
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 7) return
    if (!drag.active) {drag.active = true; setDraggingId(drag.session.id)}
    event.preventDefault()
    updateDragPreview(drag)
    if (scrollFrameRef.current === null) scrollFrameRef.current = requestAnimationFrame(autoScroll)
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const target = drag.active ? (event.pointerType === 'touch'
      ? dragTargetRef.current
      : getDropTarget(drag, event.clientX, event.clientY)) : null
    const copy = copySource?.id === drag.session.id
    if (drag.active) suppressClickRef.current = {id: drag.session.id, until: performance.now() + 500}
    clearDrag()
    if (!target) return
    savePlacement(drag.session, target, copy)
  }

  function savePlacement(session: Session, target: ScheduleDrop, copy: boolean) {
    const length = minutes(sessionEnd(session)) - minutes(sessionStart(session))
    if (!copy && session.dia === target.day && target.start === minutes(sessionStart(session))) return
    const block = data?.bloques.find(item => item.jornada_id === session.grupo.jornada_id
      && minutes(item.hora_inicio) === target.start && minutes(item.hora_fin) === target.start + length)
    setError('')
    setCopySource(null)
    setDropTarget(null)
    mutation.mutate({path: copy ? '/horarios' : `/horarios/${encodeURIComponent(session.id)}`, method: copy ? undefined : 'put', body: {
      dia: target.day, grupo_id: session.grupo_id, materia_id: session.materia_id,
      docente_id: session.docente_id, espacio_fisico_id: session.espacio_fisico_id,
      bloque_horario_id: block?.id ?? null,
      hora_inicio: block ? null : timeFromMinutes(target.start),
      hora_fin: block ? null : timeFromMinutes(target.start + length),
    }})
  }

  function placeCopy(event: ReactMouseEvent<HTMLDivElement>) {
    if (!copySource || mutation.isPending || !writable) return
    const target = getDropTarget({session: copySource, offsetY: 0}, event.clientX, event.clientY)
    if (target) savePlacement(copySource, target, true)
  }

  function openCardMenu(event: ReactMouseEvent<HTMLButtonElement>, session: Session) {
    const box = event.currentTarget.getBoundingClientRect()
    const menuHeight = 132
    const preferredTop = box.bottom + menuHeight + 8 > window.innerHeight ? box.top - menuHeight - 4 : box.bottom + 4
    setCardMenu(previous => previous?.session.id === session.id ? null : {
      session, left: Math.max(8, Math.min(box.right - 180, window.innerWidth - 188)),
      top: Math.max(8, Math.min(preferredTop, window.innerHeight - menuHeight - 8)),
    })
  }

  function openNew() {
    setEditing(null); setAssignmentEditing(null); setSessionDay(days[0]); setSessionSubjectId(''); setSessionGroupId(group)
    setSelectedFormGroup(selectedGroup ?? null)
    setSessionTeacherId(''); setSessionSpaceId(''); setSessionBlockId('')
    setSessionStartTime(''); setSessionEndTime(''); setUseBlock(false); setError(''); setShow(true)
  }
  function openSession(item: Session) {
    setEditing(item); setSessionDay(item.dia); setSessionSubjectId(String(item.materia_id)); setSessionGroupId(String(item.grupo_id))
    setSelectedFormGroup(item.grupo)
    setSessionTeacherId(item.docente_id ? String(item.docente_id) : ''); setSessionSpaceId(item.espacio_fisico_id ? String(item.espacio_fisico_id) : '')
    setSessionBlockId(item.bloque_horario_id ? String(item.bloque_horario_id) : '')
    setSessionStartTime(sessionStart(item).slice(0, 5)); setSessionEndTime(sessionEnd(item).slice(0, 5))
    setUseBlock(Boolean(item.bloque_horario_id)); setError(''); setShow(true)
  }
  function openAssignment(item: Assignment) {
    setEditing(null); setAssignmentEditing(item); setSessionSubjectId(String(item.materia_id)); setSessionGroupId(String(item.grupo_id)); setSessionTeacherId(item.docente_id ? String(item.docente_id) : '')
    setSelectedFormGroup(item.grupo); setError(''); setShow(true)
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === 'asignaciones') {
      const fields = Object.fromEntries(new FormData(event.currentTarget))
      mutation.mutate({path: assignmentEditing ? `/asignaciones/${encodeURIComponent(assignmentEditing.id)}` : '/asignaciones', method: assignmentEditing ? 'put' : undefined, body: {
        ano_lectivo_id: selectedYear,
        grupo_id: String(fields.grupo_id),
        materia_id: String(fields.materia_id),
        docente_id: fields.docente_id ? String(fields.docente_id) : null,
      }})
      return
    }
    mutation.mutate({
      path: editing ? `/horarios/${encodeURIComponent(editing.id)}` : '/horarios', method: editing ? 'put' : undefined,
      body: {
        dia: sessionDay, materia_id: sessionSubjectId, grupo_id: sessionGroupId, docente_id: sessionTeacherId || null,
        espacio_fisico_id: sessionSpaceId || null,
        bloque_horario_id: blockMode ? sessionBlockId : null,
        hora_inicio: blockMode ? null : sessionStartTime, hora_fin: blockMode ? null : sessionEndTime,
      },
    })
  }
  const groupField = <AcademicOptionSelect tipo='grupos' yearId={selectedYear} opaque label={t('schedule.group')} name='grupo_id' required
    value={sessionGroupId} onChange={value => {setSessionGroupId(value); setSessionSubjectId(''); setSessionBlockId(''); setSessionSpaceId('')}}
    onSelectOption={option => setSelectedFormGroup(resolveGroupOption(option))}
    initialOptions={data?.grupos.filter(item => String(item.ano_lectivo_id) === selectedYear) ?? []}
    emptyLabel={t('common.select')} formatOption={groupOptionLabel} selectOnly />
  const subjectField = <AcademicOptionSelect tipo='materias' yearId={selectedYear} opaque label={t('schedule.subject')} name='materia_id' required
    key={sessionGroupId || 'no-group'} disabled={!sessionGroupId} compatibleGroupToken={sessionGroupId || undefined}
    value={sessionSubjectId} onChange={setSessionSubjectId} initialOptions={[] as AcademicOption[]}
    emptyLabel={t(sessionGroupId ? 'common.select' : 'schedule.selectGroupFirst')} selectOnly />
  if (query.isLoading) return <p role='status'>{t('common.pleaseWait')}</p>
  if (query.error) return <div className='alert alert-danger' role='alert'>
    {query.error.message}
    {mode === 'horarios' && group && <button type='button' className='btn btn-sm btn-light ms-3' onClick={() => setFilter('grupo', '')}>{t('schedule.resetGroup')}</button>}
  </div>
  const needsGroup = mode === 'horarios' && !!data?.can_manage && !group
  return <>
    <div className='d-flex flex-wrap align-items-center gap-3 mb-5 schedule-controls'>
      <AcademicOptionSelect tipo='grupos' yearId={selectedYear} opaque label={t('schedule.group')} value={group} onChange={() => undefined} onSelectOption={option => setFilter('grupo', option?.url_token ?? '')} initialOptions={data?.grupos.filter(item => String(item.ano_lectivo_id) === selectedYear) ?? []} emptyLabel={mode === 'horarios' && data?.can_manage ? t('schedule.selectGroup') : t('schedule.allGroups')} formatOption={groupOptionLabel} hideLabel selectOnly />
      {data?.can_manage && <AcademicOptionSelect tipo='docentes' yearId={selectedYear} opaque label={t('schedule.teacher')} value={teacher} onChange={() => undefined} onSelectOption={option => setFilter('docente', option?.url_token ?? '')} initialOptions={data.docentes} emptyLabel={t('schedule.allTeachers')} hideLabel selectOnly />}
      {mode === 'asignaciones' && <AcademicOptionSelect tipo='materias' yearId={selectedYear} opaque label={t('schedule.subject')} value={subjectId} onChange={setSubjectId} initialOptions={data?.materias ?? []} emptyLabel={t('academic.filter.allSubjects')} hideLabel selectOnly />}
      {mode === 'horarios' && <AcademicOptionSelect tipo='espacios' yearId={selectedYear} opaque label={t('schedule.room')} value={room} onChange={() => undefined} onSelectOption={option => setFilter('espacio', option?.url_token ?? '')} initialOptions={data?.espacios ?? []} emptyLabel={t('schedule.allRooms')} hideLabel selectOnly />}
      {writable && mode !== 'resumen' && <button className='btn btn-primary ms-auto' disabled={!selectedYear} onClick={openNew}>+ {t(mode === 'asignaciones' ? 'schedule.newAssignment' : 'schedule.newSession')}</button>}
      {mode === 'horarios' && <button className='btn btn-light' disabled={needsGroup} onClick={() => window.print()}>{t('schedule.print')}</button>}
    </div>
    {needsGroup && <div className='alert alert-light-primary mb-5' role='status'>{t('schedule.groupRequired')}</div>}
    {writable && mode === 'horarios' && !needsGroup && <p className='text-muted fs-7 mb-3' id='schedule-drag-hint'>{t('schedule.dragHint')}</p>}
    {copySource && mode === 'horarios' && <div className='alert alert-info d-flex align-items-center justify-content-between gap-3 schedule-copy-banner' data-schedule-copy-banner role='status'><span>{t('schedule.placeCopy')} <strong>{copySource.materia?.nombre} · {gradeGroupLabel(copySource.grupo)}</strong></span><button type='button' className='btn btn-sm btn-light' onClick={() => {setCopySource(null); setDropTarget(null)}}>{t('common.cancel')}</button></div>}
    {error && !show && <div className='alert alert-danger' role='alert'>{error}</div>}
    {mode === 'resumen' && <div className='row g-5'>{[['schedule.subjects', data?.counts?.materias ?? data?.materias.length], ['schedule.assignments', data?.pagination?.asignaciones?.total ?? assignments.length], ['schedule.sessions', data?.counts?.sesiones ?? sessions.length]].map(([label, value]) => <div className='col-md-4' key={label}><div className='bg-light-primary rounded p-8'><div className='fs-2x fw-bold'>{value}</div><div>{t(String(label))}</div></div></div>)}</div>}
    {mode === 'asignaciones' && <><div className='table-responsive'><table className='table table-row-dashed align-middle'><thead><tr><th>{t('common.field.anoLectivo')}</th>{['teacher', 'subject', 'group', 'actions'].map(item => <th key={item}>{t(`schedule.${item}`)}</th>)}</tr></thead><tbody>{assignments.map(item => <tr key={item.id}><td>{yearName(item.ano_lectivo_id)}</td><td>{item.docente?.name ?? t('schedule.noTeacher')}</td><td>{item.materia?.nombre}</td><td>{gradeGroupLabel(item.grupo)}</td><td>{writable && <div className='d-flex gap-2'><button className='btn btn-sm btn-light-primary' onClick={() => openAssignment(item)}>{t('common.edit')}</button><button className='btn btn-sm btn-light-danger' onClick={() => setDeleting(item.id)}>{t('common.delete')}</button></div>}</td></tr>)}</tbody></table>{!assignments.length && <p className='text-muted p-6'>{assignmentList.isLoading ? t('common.pleaseWait') : t('schedule.emptyAssignments')}</p>}</div><AcademicPagination meta={assignmentList.meta} visibleCount={assignments.length} loading={assignmentList.isFetching} onPageChange={assignmentList.onPageChange} onPerPageChange={assignmentList.onPerPageChange} /></>}
    {mode === 'horarios' && !needsGroup && <div className='schedule-scroll' ref={scrollRef}><div className='schedule-week'>
      <div className='schedule-day-label'/>{days.map((day, i) => <div className='schedule-day-label' key={day}>{intl.formatDate(new Date(2026, 8, 21 + i), {weekday: 'long'})}</div>)}
      <div className='schedule-time-axis' style={{height}}>{Array.from({length: endHour - startHour + 1}, (_, index) => <span key={index} style={{top: index * hourHeight}}>{formatSchoolTime(`${String(startHour + index).padStart(2, '0')}:00`)}</span>)}</div>
      {days.map(day => <div key={day} data-schedule-day={day} className={`schedule-day${dropTarget?.day === day ? ' schedule-day-drop-target' : ''}${copySource ? ' schedule-day-copy-ready' : ''}`} style={{height}} onClick={placeCopy} onPointerMove={event => {
        if (!copySource || dragRef.current?.active) return
        const target = getDropTarget({session: copySource, offsetY: 0}, event.clientX, event.clientY)
        setDropTarget(previous => previous?.day === target?.day && previous?.start === target?.start ? previous : target)
      }}>
        {dropTarget?.day === day && (dragRef.current?.active || copySource) && <div className='schedule-drop-preview' aria-hidden='true' style={{top: (dropTarget.start - startHour * 60) / 60 * hourHeight, height: Math.max(12, (minutes(sessionEnd(dragRef.current?.session ?? copySource!)) - minutes(sessionStart(dragRef.current?.session ?? copySource!))) / 60 * hourHeight - 3)}}>
          <strong>{(dragRef.current?.session ?? copySource)?.materia?.nombre}</strong>
          <span>{formatSchoolTime(timeFromMinutes(dropTarget.start))}–{formatSchoolTime(timeFromMinutes(dropTarget.start + minutes(sessionEnd(dragRef.current?.session ?? copySource!)) - minutes(sessionStart(dragRef.current?.session ?? copySource!))))}</span>
          <small>{t(copySource ? 'schedule.copy' : 'schedule.move')}</small>
        </div>}
        {layoutSessions(sessions.filter(item => item.dia === day)).map(({session: item, lane, lanes}) => {
        const duration = (minutes(sessionEnd(item)) - minutes(sessionStart(item))) / 60 * hourHeight - 3
        const compact = duration < 70
        return <div key={item.id} className='schedule-card-position' style={{top: (minutes(sessionStart(item)) - startHour * 60) / 60 * hourHeight, height: Math.max(12, duration), left: `calc(${lane / lanes * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)`}}>
        <button className={`schedule-session text-start${compact ? ' schedule-session-compact' : duration >= 100 ? ' schedule-session-roomy' : ''}${writable ? ' schedule-session-draggable' : ''}${draggingId === item.id ? ' schedule-session-dragging' : ''}`} aria-describedby={writable ? 'schedule-drag-hint' : undefined} title={[item.materia?.nombre, groupLabel(item.grupo), item.espacio?.nombre ?? t('schedule.noRoom'), item.docente?.name ?? t('schedule.noTeacher')].filter(Boolean).join(' · ')} style={{borderLeftColor: `hsl(${subjectHue(item.materia_id)} 62% 50%)`}} onPointerDown={event => startDrag(event, item)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={clearDrag} onClick={event => {
          event.stopPropagation()
          if (suppressClickRef.current?.id === item.id && performance.now() < suppressClickRef.current.until) return
          if (copySource) return
          openSession(item)
        }}>
          <small className='schedule-session-time'>{cardTimeRange(sessionStart(item), sessionEnd(item))}</small>
          <strong>{item.materia?.nombre}</strong>
          <span>{gradeGroupLabel(item.grupo)}</span>
          <span className='schedule-session-room'>{item.espacio?.nombre ?? t('schedule.noRoom')}</span>
          <small>{item.docente?.name ?? t('schedule.noTeacher')}</small>
        </button>
        {writable && <button type='button' data-schedule-actions-button className='schedule-card-actions' aria-label={`${t('schedule.actions')}: ${item.materia?.nombre}, ${gradeGroupLabel(item.grupo)}`} aria-expanded={cardMenu?.session.id === item.id} onPointerDown={event => event.stopPropagation()} onClick={event => {event.stopPropagation(); openCardMenu(event, item)}}>⋯</button>}
        </div>
      })}</div>)}
    </div>{!sessions.length && <p className='text-muted p-4'>{t('schedule.emptySessions')}</p>}</div>}
    {cardMenu && createPortal(<div data-schedule-actions-menu className='schedule-actions-menu' role='menu' style={{left: cardMenu.left, top: cardMenu.top}}>
      <button role='menuitem' type='button' onClick={() => {setCopySource(null); openSession(cardMenu.session); setCardMenu(null)}}>{t('common.edit')}</button>
      <button role='menuitem' type='button' onClick={() => {setCopySource(cardMenu.session); setCardMenu(null); setDropTarget(null)}}>{t('schedule.copy')}</button>
      <button role='menuitem' type='button' className='text-danger' onClick={() => {setCopySource(null); setDeleting(cardMenu.session.id); setCardMenu(null)}}>{t('common.delete')}</button>
    </div>, document.body)}
    <Modal show={show} onHide={() => setShow(false)} centered scrollable size='lg' className='schedule-editor-modal'><Modal.Header closeButton><Modal.Title>{t(mode === 'asignaciones' ? 'schedule.newAssignment' : 'schedule.session')}</Modal.Title></Modal.Header>
      <form key={assignmentEditing?.id ?? 'new'} onSubmit={save}><Modal.Body>
        {error && <div className='alert alert-danger' role='alert'>{error}</div>}
        {mode === 'asignaciones' ? <div className='vstack gap-5'>
          {groupField}
          {subjectField}
          <AcademicOptionSelect tipo='docentes' yearId={selectedYear} opaque label={t('schedule.teacherOptional')} name='docente_id' value={sessionTeacherId} onChange={setSessionTeacherId} initialOptions={data?.docentes ?? []} emptyLabel={t('schedule.noTeacher')} selectOnly />
        </div> : <>
          <label className='form-label required'>{t('schedule.day')}</label><select required name='dia' className='form-select mb-5' value={sessionDay} onChange={e => setSessionDay(e.target.value)}>{days.map((day, i) => <option key={day} value={day}>{intl.formatDate(new Date(2026, 8, 21 + i), {weekday: 'long'})}</option>)}</select>
          <div className='mb-5'>{groupField}</div>
          <div className='mb-5'>{subjectField}</div>
          {activeGroup && <div className='alert alert-light-primary py-3' role='status'>{activeGroup.jornada ? `${t('schedule.journey')}: ${activeGroup.jornada.nombre} · ${activeGroup.sede?.nombre ?? ''} (${formatSchoolTime(activeGroup.jornada.hora_inicio)}–${formatSchoolTime(activeGroup.jornada.hora_fin)})` : t('schedule.noJourney')}</div>}
          {visibleBlocks.length > 0 && <div className='rounded border p-4 mb-5'>
            <label className='form-check form-switch form-check-custom form-check-solid mb-2'><input className='form-check-input' type='checkbox' checked={blockMode} onChange={e => setUseBlock(e.target.checked)} /><span className='form-check-label fw-semibold'>{t('schedule.useBlock')}</span></label>
            <div className='text-muted fs-7'>{t('schedule.blockHint')}</div>
            {blockMode && <>
              <label className='form-label required mt-4'>{t('schedule.block')}</label>
              <select required name='bloque_horario_id' className='form-select' value={sessionBlockId} onChange={e => setSessionBlockId(e.target.value)}>
                <option value=''>{t('common.select')}</option>
                {visibleBlocks.map(item => <option key={item.id} value={item.id}>{item.nombre} · {formatSchoolTime(item.hora_inicio)}–{formatSchoolTime(item.hora_fin)}</option>)}
              </select>
              {activeBlock && <div className='row g-3 mt-2'>
                {[
                  [t('schedule.journey'), activeGroup?.jornada?.nombre],
                  [t('schedule.campus'), activeGroup?.sede?.nombre],
                  [t('schedule.startTime'), formatSchoolTime(activeBlock.hora_inicio)],
                  [t('schedule.endTime'), formatSchoolTime(activeBlock.hora_fin)],
                ].map(([label, value]) => <div className='col-sm-6' key={label}><label className='form-label fs-7'>{label}</label><input className='form-control bg-light' value={value ?? ''} readOnly /></div>)}
              </div>}
            </>}
          </div>}
          {activeGroup && visibleBlocks.length === 0 && <p className='text-muted fs-7 mb-4'>{t('schedule.noBlocks')}</p>}
          {!blockMode && <div className='row g-4 mb-5'><div className='col-md-6'><label className='form-label required' htmlFor='schedule-start'>{t('schedule.startTime')}</label><input id='schedule-start' name='hora_inicio' required type='time' step={60} className='form-control' min={activeGroup?.jornada?.hora_inicio?.slice(0,5)} max={activeGroup?.jornada?.hora_fin?.slice(0,5)} value={sessionStartTime} onChange={e => setSessionStartTime(e.target.value)} /></div><div className='col-md-6'><label className='form-label required' htmlFor='schedule-end'>{t('schedule.endTime')}</label><input id='schedule-end' name='hora_fin' required type='time' step={60} className='form-control' min={activeGroup?.jornada?.hora_inicio?.slice(0,5)} max={activeGroup?.jornada?.hora_fin?.slice(0,5)} value={sessionEndTime} onChange={e => setSessionEndTime(e.target.value)} /></div></div>}
          <div className='mb-5'><AcademicOptionSelect tipo='docentes' yearId={selectedYear} opaque label={t('schedule.teacherOptional')} name='docente_id' value={sessionTeacherId} onChange={setSessionTeacherId} initialOptions={data?.docentes ?? []} emptyLabel={t('schedule.noTeacher')} selectOnly /></div>
          <AcademicOptionSelect tipo='espacios' yearId={selectedYear} opaque label={t('schedule.room')} value={sessionSpaceId} onChange={setSessionSpaceId} initialOptions={data?.espacios.filter(item => item.sede_id === activeGroup?.sede_id) ?? []} emptyLabel={t('common.select')} filterOption={item => String(item.id) === sessionSpaceId || (!!activeGroup && item.sede_id === activeGroup.sede_id && (item.estado == null || item.estado === 'disponible'))} selectOnly />
        </>}
      </Modal.Body><Modal.Footer>
        {editing && writable && <button className='btn btn-light-danger me-auto' type='button' onClick={() => {setShow(false); setDeleting(editing.id)}}>{t('common.delete')}</button>}
        <button type='button' className='btn btn-light' onClick={() => setShow(false)}>{t('common.close')}</button>
        {writable && <button className='btn btn-primary' disabled={mutation.isPending}>{t('common.save')}</button>}
      </Modal.Footer></form>
    </Modal>
    <Modal show={deleting !== null} onHide={() => setDeleting(null)} centered className='schedule-editor-modal'><Modal.Header closeButton><Modal.Title>{t('common.delete')}</Modal.Title></Modal.Header><Modal.Body>{t('schedule.confirmDelete')}{error && <div className='alert alert-danger mt-4'>{error}</div>}</Modal.Body><Modal.Footer><button className='btn btn-light' onClick={() => setDeleting(null)}>{t('common.cancel')}</button><button className='btn btn-danger' disabled={mutation.isPending} onClick={() => mutation.mutate({path: `/${mode === 'asignaciones' ? 'asignaciones' : 'horarios'}/${encodeURIComponent(deleting!)}`, method: 'delete'})}>{t('common.delete')}</button></Modal.Footer></Modal>
  </>
}
