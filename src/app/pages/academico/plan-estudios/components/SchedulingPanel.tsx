import {useEffect, useId, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent} from 'react'
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
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const detailsTitleId = useId()
  const [editing, setEditing] = useState<Session | null>(null)
  const [assignmentEditing, setAssignmentEditing] = useState<Assignment | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkGroupId, setBulkGroupId] = useState('')
  const [bulkTeacherId, setBulkTeacherId] = useState('')
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
    setDetailsId(null)
  }, [selectedYear, requestedGroup, requestedTeacher, requestedRoom])
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
  }, onSuccess: async () => {await client.invalidateQueries({queryKey: ['horarios']}); setShow(false); setBulkOpen(false); setEditing(null); setAssignmentEditing(null); setDeleting(null); setError('')}, onError: e => setError(e instanceof ApiError && e.errors ? Object.values(e.errors).flat()[0] ?? e.message : e.message)})

  const writable = data?.can_manage && yearWritable
  const assignments = mode === 'asignaciones' ? assignmentList.rows : data?.asignaciones.filter(item => String(item.ano_lectivo_id) === selectedYear && (!group || String(item.grupo_id) === group) && (!teacher || String(item.docente_id) === teacher)) ?? []
  const sessions = data?.sesiones.filter(item => String(item.grupo?.ano_lectivo_id) === selectedYear && (!group || String(item.grupo_id) === group) && (!teacher || String(item.docente_id) === teacher) && (!room || String(item.espacio_fisico_id) === room)) ?? []
  const details = sessions.find(item => item.id === detailsId)
  const detailsGroup = details && (data?.grupos.find(item => item.id === details.grupo_id) ?? details.grupo)
  const detailDaySessions = details ? layoutSessions(sessions.filter(item => item.dia === details.dia)).map(item => item.session) : []
  const describeSession = (item: Session) => [item.materia.nombre, intl.formatDate(new Date(2026, 8, 21 + days.indexOf(item.dia)), {weekday: 'long'}), cardTimeRange(sessionStart(item), sessionEnd(item)), groupLabel(item.grupo), item.espacio?.nombre ?? t('schedule.noRoom'), item.docente?.name ?? t('schedule.noTeacher')].join(' · ')
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
    <div className='mb-5 schedule-controls'>
      <div className='schedule-filters'>
        <AcademicOptionSelect tipo='grupos' yearId={selectedYear} opaque label={t('schedule.group')} value={group} onChange={() => undefined} onSelectOption={option => setFilter('grupo', option?.url_token ?? '')} initialOptions={data?.grupos.filter(item => String(item.ano_lectivo_id) === selectedYear) ?? []} emptyLabel={mode === 'horarios' && data?.can_manage ? t('schedule.selectGroup') : t('schedule.allGroups')} formatOption={groupOptionLabel} selectOnly />
        {mode === 'asignaciones' && <AcademicOptionSelect tipo='materias' yearId={selectedYear} opaque label={t('schedule.subject')} value={subjectId} onChange={setSubjectId} initialOptions={data?.materias ?? []} emptyLabel={t('academic.filter.allSubjects')} selectOnly />}
        {data?.can_manage && <AcademicOptionSelect tipo='docentes' yearId={selectedYear} opaque label={t('schedule.teacher')} value={teacher} onChange={() => undefined} onSelectOption={option => setFilter('docente', option?.url_token ?? '')} initialOptions={data.docentes} emptyLabel={t('schedule.allTeachers')} selectOnly />}
        {mode === 'horarios' && <AcademicOptionSelect tipo='espacios' yearId={selectedYear} opaque label={t('schedule.room')} value={room} onChange={() => undefined} onSelectOption={option => setFilter('espacio', option?.url_token ?? '')} initialOptions={data?.espacios ?? []} emptyLabel={t('schedule.allRooms')} selectOnly />}
      </div>
      <div className={`schedule-toolbar-actions${mode === 'asignaciones' ? ' schedule-assignment-toolbar' : ''}`}>
        {writable && mode !== 'resumen' && <button type='button' className='btn btn-primary' disabled={!selectedYear} onClick={openNew}>+ {t(mode === 'asignaciones' ? 'schedule.newAssignment' : 'schedule.newSession')}</button>}
        {writable && mode === 'asignaciones' && <button className='btn btn-light-primary' type='button' onClick={() => {
          setBulkGroupId(group); setBulkTeacherId(''); setError(''); setBulkOpen(true)
        }}>{t('schedule.assignWholeGroup')}</button>}
        {mode === 'horarios' && <button type='button' className='btn btn-light' disabled={needsGroup} onClick={() => window.print()}>{t('schedule.print')}</button>}
      </div>
    </div>
    {needsGroup && <div className='alert alert-light-primary mb-5' role='status'>{t('schedule.groupRequired')}</div>}
    {mode === 'horarios' && !needsGroup && <p className={`text-muted fs-7 mb-3${writable ? '' : ' d-md-none'}`} id='schedule-drag-hint'>
      {writable && <span className='d-none d-md-inline'>{t('schedule.dragHint')}</span>}
      <span className='d-md-none'>{t('schedule.mobileHint')}</span>
    </p>}
    {copySource && mode === 'horarios' && <div className='alert alert-info d-flex align-items-center justify-content-between gap-3 schedule-copy-banner' data-schedule-copy-banner role='status'><span>{t('schedule.placeCopy')} <strong>{copySource.materia?.nombre} · {gradeGroupLabel(copySource.grupo)}</strong></span><button type='button' className='btn btn-sm btn-light' onClick={() => {setCopySource(null); setDropTarget(null)}}>{t('common.cancel')}</button></div>}
    {error && !show && <div className='alert alert-danger' role='alert'>{error}</div>}
    {mode === 'resumen' && <div className='row g-5'>{[['schedule.subjects', data?.counts?.materias ?? data?.materias.length], ['schedule.assignments', data?.pagination?.asignaciones?.total ?? assignments.length], ['schedule.sessions', data?.counts?.sesiones ?? sessions.length]].map(([label, value]) => <div className='col-md-4' key={label}><div className='bg-light-primary rounded p-8'><div className='fs-2x fw-bold'>{value}</div><div>{t(String(label))}</div></div></div>)}</div>}
    {mode === 'asignaciones' && <>
      <div className='schedule-assignments'>
        <table className='table table-row-dashed align-middle schedule-assignment-table' role='table' aria-label={t('schedule.assignments')}>
          <thead role='rowgroup'><tr role='row'>
            <th scope='col' role='columnheader' className='schedule-assignment-year'>{t('common.field.anoLectivo')}</th>
            {['teacher', 'subject', 'group'].map(field => <th scope='col' role='columnheader' key={field}>{t(`schedule.${field}`)}</th>)}
            {writable && <th scope='col' role='columnheader'>{t('schedule.actions')}</th>}
          </tr></thead>
          <tbody role='rowgroup'>{assignments.map(item => {
            const assignmentName = `${item.materia.nombre}, ${gradeGroupLabel(item.grupo)}`
            return <tr key={item.id} role='row'>
              <td role='cell' className='schedule-assignment-year'>{yearName(item.ano_lectivo_id)}</td>
              {[
                ['teacher', item.docente?.name ?? t('schedule.noTeacher')],
                ['subject', item.materia.nombre],
                ['group', gradeGroupLabel(item.grupo)],
              ].map(([field, value]) => <td role='cell' key={field}>
                <span className='schedule-assignment-label' aria-hidden='true'>{t(`schedule.${field}`)}</span>
                <span className='schedule-assignment-value'>{value}</span>
              </td>)}
              {writable && <td role='cell' className='schedule-assignment-actions-cell'><div className='d-flex gap-2'>
                <button type='button' className='btn btn-sm btn-light-primary schedule-assignment-action' aria-label={intl.formatMessage({id: 'common.edit'}, {name: assignmentName})} title={intl.formatMessage({id: 'common.edit'}, {name: assignmentName})} onClick={() => openAssignment(item)}>
                  <i className='bi bi-pencil-square' aria-hidden='true' /><span>{t('common.edit')}</span>
                </button>
                <button type='button' className='btn btn-sm btn-light-danger schedule-assignment-action' aria-label={intl.formatMessage({id: 'common.delete'}, {name: assignmentName})} title={intl.formatMessage({id: 'common.delete'}, {name: assignmentName})} onClick={() => setDeleting(item.id)}>
                  <i className='bi bi-trash' aria-hidden='true' /><span>{t('common.delete')}</span>
                </button>
              </div></td>}
            </tr>
          })}</tbody>
        </table>
        {!assignments.length && <p className='text-muted p-6'>{assignmentList.isLoading ? t('common.pleaseWait') : t('schedule.emptyAssignments')}</p>}
      </div>
      <div className='schedule-pagination'><AcademicPagination meta={assignmentList.meta} visibleCount={assignments.length} loading={assignmentList.isFetching} onPageChange={assignmentList.onPageChange} onPerPageChange={assignmentList.onPerPageChange} /></div>
    </>}
    {mode === 'horarios' && !needsGroup && <div className='schedule-scroll' ref={scrollRef}><div className='schedule-week'>
      <div className='schedule-day-label'/>{days.map((day, i) => {
        const date = new Date(2026, 8, 21 + i)
        const label = intl.formatDate(date, {weekday: 'long'})
        const daySessions = layoutSessions(sessions.filter(item => item.dia === day))
        return <div className='schedule-day-label' key={day}>
          <button type='button' className='schedule-day-open' disabled={!daySessions.length} aria-haspopup='dialog' aria-label={`${label} (${intl.formatNumber(daySessions.length)})`} onClick={() => setDetailsId(daySessions[0].session.id)}>
            <span className='schedule-day-long'>{label}</span>
            <abbr className='schedule-day-short' title={label} aria-label={label}>{intl.formatDate(date, {weekday: 'short'})}</abbr>
            {daySessions.length > 0 && <small className='schedule-day-count' aria-hidden='true'>{intl.formatNumber(daySessions.length)}</small>}
          </button>
        </div>
      })}
      <div className='schedule-time-axis' style={{height}}>{Array.from({length: endHour - startHour + 1}, (_, index) => {
        const time = `${String(startHour + index).padStart(2, '0')}:00`
        const [value, period] = formatSchoolTime(time).split(' ')
        return <time key={index} dateTime={time} style={{top: index * hourHeight}}><span>{value}</span> <small>{period}</small></time>
      })}</div>
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
        const sessionLabel = describeSession(item)
        return <div key={item.id} className='schedule-card-position' style={{top: (minutes(sessionStart(item)) - startHour * 60) / 60 * hourHeight, height: Math.max(12, duration), left: `calc(${lane / lanes * 100}% + var(--schedule-card-gap))`, width: `calc(${100 / lanes}% - 2 * var(--schedule-card-gap))`}}>
        <button type='button' className={`schedule-session text-start${compact ? ' schedule-session-compact' : duration >= 100 ? ' schedule-session-roomy' : ''}${writable ? ' schedule-session-draggable' : ''}${draggingId === item.id ? ' schedule-session-dragging' : ''}`} aria-haspopup='dialog' aria-label={sessionLabel} aria-describedby={writable ? 'schedule-drag-hint' : undefined} title={sessionLabel} style={{borderLeftColor: `hsl(${subjectHue(item.materia_id)} 62% 50%)`}} onPointerDown={event => startDrag(event, item)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={clearDrag} onClick={event => {
          event.stopPropagation()
          if (suppressClickRef.current?.id === item.id && performance.now() < suppressClickRef.current.until) return
          if (copySource) return
          setDetailsId(item.id)
        }}>
          <small className='schedule-session-time'>{cardTimeRange(sessionStart(item), sessionEnd(item))}</small>
          <small className='schedule-session-start' aria-hidden='true'>{sessionStart(item).slice(0, 5)}</small>
          <strong>{item.materia?.nombre}</strong>
          <span className='schedule-session-metadata'>{gradeGroupLabel(item.grupo)}</span>
          <span className='schedule-session-room schedule-session-metadata'>{item.espacio?.nombre ?? t('schedule.noRoom')}</span>
          <small className='schedule-session-metadata'>{item.docente?.name ?? t('schedule.noTeacher')}</small>
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
    <Modal show={!!details} onHide={() => setDetailsId(null)} animation={false} centered scrollable aria-labelledby={detailsTitleId} className='schedule-editor-modal'>
      <Modal.Header closeButton closeLabel={t('common.close')}><Modal.Title id={detailsTitleId}>{t('schedule.session')}</Modal.Title></Modal.Header>
      {details && <>
        <Modal.Body>
        {detailDaySessions.length > 1 && <div className='schedule-day-sessions mb-5'>
          <h3 className='fs-6'>{t('schedule.day')}: {intl.formatDate(new Date(2026, 8, 21 + days.indexOf(details.dia)), {weekday: 'long'})}</h3>
          <ul>{detailDaySessions.map(item => <li key={item.id}>
            <button type='button' className='schedule-day-session-option' aria-current={item.id === details.id ? 'true' : undefined} aria-label={describeSession(item)} onClick={() => setDetailsId(item.id)}>
              <strong>{item.materia.nombre}</strong>
              <span>{cardTimeRange(sessionStart(item), sessionEnd(item))} · {gradeGroupLabel(item.grupo)}</span>
            </button>
          </li>)}</ul>
        </div>}
        <dl className='schedule-details-list'>
          {[
            ['schedule.subject', details.materia.nombre],
            ['schedule.day', intl.formatDate(new Date(2026, 8, 21 + days.indexOf(details.dia)), {weekday: 'long'})],
            ['schedule.startTime', formatSchoolTime(sessionStart(details))],
            ['schedule.endTime', formatSchoolTime(sessionEnd(details))],
            ['schedule.group', gradeGroupLabel(details.grupo)],
            ['schedule.teacher', details.docente?.name ?? t('schedule.noTeacher')],
            ['schedule.room', details.espacio?.nombre ?? t('schedule.noRoom')],
            ['schedule.campus', detailsGroup?.sede?.nombre ?? '—'],
            ['schedule.journey', detailsGroup?.jornada?.nombre ?? '—'],
            ...(details.bloque ? [['schedule.block', details.bloque.nombre]] : []),
          ].map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}
        </dl></Modal.Body>
        <Modal.Footer>
          {writable && <>
            <button type='button' className='btn btn-light-primary' onClick={() => {setDetailsId(null); openSession(details)}}>{t('common.edit')}</button>
            <button type='button' className='btn btn-light-primary' onClick={() => {setDetailsId(null); setCopySource(details); setDropTarget(null)}}>{t('schedule.copy')}</button>
            <button type='button' className='btn btn-light-danger' onClick={() => {setDetailsId(null); setDeleting(details.id)}}>{t('common.delete')}</button>
          </>}
          <button type='button' className='btn btn-light' onClick={() => setDetailsId(null)}>{t('common.close')}</button>
        </Modal.Footer>
      </>}
    </Modal>
    <Modal show={show} onHide={() => setShow(false)} centered scrollable size='lg' className='schedule-editor-modal'><Modal.Header closeButton closeLabel={t('common.close')}><Modal.Title>{t(mode === 'asignaciones' ? 'schedule.newAssignment' : 'schedule.session')}</Modal.Title></Modal.Header>
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
        {writable && <button className='btn btn-primary' disabled={mutation.isPending}>{mutation.isPending ? t('common.pleaseWait') : intl.formatMessage({id: 'common.save'}, {name: t(mode === 'asignaciones' ? 'entity.asignacionDocente' : 'entity.sesionHorario')})}</button>}
      </Modal.Footer></form>
    </Modal>
    <Modal show={deleting !== null} onHide={() => setDeleting(null)} centered className='schedule-editor-modal'><Modal.Header closeButton closeLabel={t('common.close')}><Modal.Title>{t('common.delete')}</Modal.Title></Modal.Header><Modal.Body>{t('schedule.confirmDelete')}{error && <div className='alert alert-danger mt-4'>{error}</div>}</Modal.Body><Modal.Footer><button className='btn btn-light' onClick={() => setDeleting(null)}>{t('common.cancel')}</button><button className='btn btn-danger' disabled={mutation.isPending} onClick={() => mutation.mutate({path: `/${mode === 'asignaciones' ? 'asignaciones' : 'horarios'}/${encodeURIComponent(deleting!)}`, method: 'delete'})}>{t('common.delete')}</button></Modal.Footer></Modal>
    <Modal show={bulkOpen} onHide={() => setBulkOpen(false)} centered className='schedule-editor-modal'>
      <Modal.Header closeButton closeLabel={t('common.close')}><Modal.Title>{t('schedule.assignWholeGroup')}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className='text-muted'>{t('schedule.assignWholeGroupHelp')}</p>
        {error && <div className='alert alert-danger' role='alert'>{error}</div>}
        <div className='vstack gap-4'>
          <AcademicOptionSelect tipo='grupos' yearId={selectedYear} opaque label={t('schedule.group')} required
            value={bulkGroupId} onChange={setBulkGroupId} initialOptions={data?.grupos ?? []}
            emptyLabel={t('common.select')} formatOption={groupOptionLabel} selectOnly />
          <AcademicOptionSelect tipo='docentes' yearId={selectedYear} opaque label={t('schedule.teacher')} required
            value={bulkTeacherId} onChange={setBulkTeacherId} initialOptions={data?.docentes ?? []}
            emptyLabel={t('common.select')} selectOnly />
        </div>
      </Modal.Body>
      <Modal.Footer><button className='btn btn-light' type='button' onClick={() => setBulkOpen(false)}>{t('common.cancel')}</button>
        <button className='btn btn-primary' type='button' disabled={!bulkGroupId || !bulkTeacherId || mutation.isPending}
          onClick={() => mutation.mutate({path: '/asignaciones/grupo', body: {
            ano_lectivo_id: selectedYear, grupo_id: bulkGroupId, docente_id: bulkTeacherId,
          }})}>{t('schedule.assignWholeGroup')}</button>
      </Modal.Footer>
    </Modal>
  </>
}
