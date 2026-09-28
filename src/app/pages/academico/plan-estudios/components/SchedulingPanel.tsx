import {useState, type FormEvent} from 'react'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {Modal} from 'react-bootstrap'
import {ApiError, api} from '@/lib/api/client'
import {useSchedule, type ScheduleGroup, type Session} from '../horarios.api'
import {layoutSessions, minutes, sessionEnd, sessionStart} from './schedule-layout'
import './schedule.css'

const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const groupLabel = (item: ScheduleGroup) => `${item.grado?.nombre ?? ''} · ${item.nombre}${item.sede?.nombre ? ` · ${item.sede.nombre}` : ''}`

export function SchedulingPanel({mode = 'horarios'}: {mode?: 'asignaciones' | 'horarios' | 'resumen'}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id}, {name: ''})
  const query = useSchedule()
  const data = query.data
  const client = useQueryClient()
  const [year, setYear] = useState('')
  const [group, setGroup] = useState('')
  const [teacher, setTeacher] = useState('')
  const [room, setRoom] = useState('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [sessionDay, setSessionDay] = useState(days[0])
  const [sessionSubjectId, setSessionSubjectId] = useState('')
  const [sessionGroupId, setSessionGroupId] = useState('')
  const [sessionTeacherId, setSessionTeacherId] = useState('')
  const [sessionSpaceId, setSessionSpaceId] = useState('')
  const [sessionBlockId, setSessionBlockId] = useState('')
  const [sessionStartTime, setSessionStartTime] = useState('')
  const [sessionEndTime, setSessionEndTime] = useState('')
  const [useBlock, setUseBlock] = useState(false)
  const mutation = useMutation({mutationFn: async ({path, body, method}: {path: string; body?: unknown; method?: 'put' | 'delete'}) => {
    if (method === 'delete') return api.delete(path)
    return method === 'put' ? api.put(path, body) : api.post(path, body)
  }, onSuccess: async () => {await client.invalidateQueries({queryKey: ['horarios']}); setShow(false); setEditing(null); setDeleting(null); setError('')}, onError: e => setError(e instanceof ApiError && e.errors ? Object.values(e.errors).flat()[0] ?? e.message : e.message)})

  const selectedYear = year || String(data?.anos.find(item => item.estado === 'en_curso')?.id ?? data?.anos[0]?.id ?? '')
  const writable = data?.can_manage && !['cerrado', 'archivado'].includes(data?.anos.find(item => String(item.id) === selectedYear)?.estado ?? '')
  const assignments = data?.asignaciones.filter(item => String(item.ano_lectivo_id) === selectedYear && (!group || String(item.grupo_id) === group) && (!teacher || String(item.docente_id) === teacher)) ?? []
  const sessions = data?.sesiones.filter(item => String(item.grupo?.ano_lectivo_id) === selectedYear && (!group || String(item.grupo_id) === group) && (!teacher || String(item.docente_id) === teacher) && (!room || String(item.espacio_fisico_id) === room)) ?? []
  const activeGroup = data?.grupos.find(item => String(item.id) === sessionGroupId)
  const visibleBlocks = data?.bloques.filter(item => item.jornada_id === activeGroup?.jornada_id) ?? []
  const blockMode = useBlock && visibleBlocks.length > 0
  const activeBlock = visibleBlocks.find(item => String(item.id) === sessionBlockId)
  const visibleGroups = data?.grupos.filter(item => String(item.ano_lectivo_id) === selectedYear && (!group || String(item.id) === group)) ?? []
  const starts = [...sessions.map(item => minutes(sessionStart(item))), ...visibleGroups.flatMap(item => item.jornada?.hora_inicio ? [minutes(item.jornada.hora_inicio)] : [])]
  const ends = [...sessions.map(item => minutes(sessionEnd(item))), ...visibleGroups.flatMap(item => item.jornada?.hora_fin ? [minutes(item.jornada.hora_fin)] : [])]
  const startHour = Math.floor(Math.min(360, ...starts) / 60)
  const endHour = Math.max(19, Math.ceil(Math.max(1140, ...ends) / 60))
  const height = (endHour - startHour) * 64

  function openNew() {
    setEditing(null); setSessionDay(days[0]); setSessionSubjectId(''); setSessionGroupId(group)
    setSessionTeacherId(''); setSessionSpaceId(''); setSessionBlockId('')
    setSessionStartTime(''); setSessionEndTime(''); setUseBlock(false); setError(''); setShow(true)
  }
  function openSession(item: Session) {
    setEditing(item); setSessionDay(item.dia); setSessionSubjectId(String(item.materia_id)); setSessionGroupId(String(item.grupo_id))
    setSessionTeacherId(item.docente_id ? String(item.docente_id) : ''); setSessionSpaceId(item.espacio_fisico_id ? String(item.espacio_fisico_id) : '')
    setSessionBlockId(item.bloque_horario_id ? String(item.bloque_horario_id) : '')
    setSessionStartTime(sessionStart(item).slice(0, 5)); setSessionEndTime(sessionEnd(item).slice(0, 5))
    setUseBlock(Boolean(item.bloque_horario_id)); setError(''); setShow(true)
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === 'asignaciones') {
      mutation.mutate({path: '/asignaciones', body: {...Object.fromEntries(new FormData(event.currentTarget)), ano_lectivo_id: Number(selectedYear)}})
      return
    }
    mutation.mutate({
      path: editing ? `/horarios/${editing.id}` : '/horarios', method: editing ? 'put' : undefined,
      body: {
        dia: sessionDay, materia_id: Number(sessionSubjectId), grupo_id: Number(sessionGroupId), docente_id: sessionTeacherId ? Number(sessionTeacherId) : null,
        espacio_fisico_id: sessionSpaceId ? Number(sessionSpaceId) : null,
        bloque_horario_id: blockMode ? Number(sessionBlockId) : null,
        hora_inicio: blockMode ? null : sessionStartTime, hora_fin: blockMode ? null : sessionEndTime,
      },
    })
  }
  if (query.isLoading) return <p role='status'>{t('common.pleaseWait')}</p>
  if (query.error) return <div className='alert alert-danger' role='alert'>{query.error.message}</div>
  return <>
    <div className='d-flex flex-wrap gap-3 mb-6 schedule-controls'>
      <select aria-label={t('schedule.year')} className='form-select w-auto' value={selectedYear} onChange={e => {setYear(e.target.value); setGroup('')}}>{data?.anos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
      <select aria-label={t('schedule.group')} className='form-select w-auto' value={group} onChange={e => setGroup(e.target.value)}><option value=''>{t('schedule.allGroups')}</option>{data?.grupos.filter(item => String(item.ano_lectivo_id) === selectedYear).map(item => <option key={item.id} value={item.id}>{groupLabel(item)}</option>)}</select>
      {data?.can_manage && <select aria-label={t('schedule.teacher')} className='form-select w-auto' value={teacher} onChange={e => setTeacher(e.target.value)}><option value=''>{t('schedule.allTeachers')}</option>{data.docentes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
      {mode === 'horarios' && <select aria-label={t('schedule.room')} className='form-select w-auto' value={room} onChange={e => setRoom(e.target.value)}><option value=''>{t('schedule.allRooms')}</option>{data?.espacios.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>}
      {writable && mode !== 'resumen' && <button className='btn btn-primary ms-auto' disabled={!selectedYear} onClick={openNew}>+ {t(mode === 'asignaciones' ? 'schedule.newAssignment' : 'schedule.newSession')}</button>}
      {mode === 'horarios' && <button className='btn btn-light' onClick={() => window.print()}>{t('schedule.print')}</button>}
    </div>
    {error && !show && <div className='alert alert-danger' role='alert'>{error}</div>}
    {mode === 'resumen' && <div className='row g-5'>{[['schedule.subjects', data?.materias.length], ['schedule.assignments', assignments.length], ['schedule.sessions', sessions.length]].map(([label, value]) => <div className='col-md-4' key={label}><div className='bg-light-primary rounded p-8'><div className='fs-2x fw-bold'>{value}</div><div>{t(String(label))}</div></div></div>)}</div>}
    {mode === 'asignaciones' && <div className='table-responsive'><table className='table table-row-dashed align-middle'><thead><tr>{['teacher', 'subject', 'group', 'actions'].map(item => <th key={item}>{t(`schedule.${item}`)}</th>)}</tr></thead><tbody>{assignments.map(item => <tr key={item.id}><td>{item.docente?.name}</td><td>{item.materia?.nombre}</td><td>{item.grupo?.nombre}</td><td>{writable && <button className='btn btn-sm btn-light-danger' onClick={() => setDeleting(item.id)}>{t('common.delete')}</button>}</td></tr>)}</tbody></table>{!assignments.length && <p className='text-muted p-6'>{t('schedule.emptyAssignments')}</p>}</div>}
    {mode === 'horarios' && <div className='schedule-scroll'><div className='schedule-week'>
      <div className='schedule-day-label'/>{days.map((day, i) => <div className='schedule-day-label' key={day}>{intl.formatDate(new Date(2026, 8, 21 + i), {weekday: 'long'})}</div>)}
      <div className='schedule-time-axis' style={{height}}>{Array.from({length: endHour - startHour + 1}, (_, index) => <span key={index} style={{top: index * 64}}>{String(startHour + index).padStart(2, '0')}:00</span>)}</div>
      {days.map(day => <div key={day} className='schedule-day' style={{height}}>{layoutSessions(sessions.filter(item => item.dia === day)).map(({session: item, lane, lanes}) => <button key={item.id} className='schedule-session text-start' title={`${item.materia?.nombre} · ${groupLabel(item.grupo)} · ${item.docente?.name ?? t('schedule.noTeacher')}`} style={{top: (minutes(sessionStart(item)) - startHour * 60) / 60 * 64, height: Math.max(12, (minutes(sessionEnd(item)) - minutes(sessionStart(item))) / 60 * 64 - 3), left: `calc(${lane / lanes * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)`, right: 'auto', borderLeftColor: `hsl(${item.materia_id * 59 % 360} 62% 50%)`}} onClick={() => openSession(item)}><small>{sessionStart(item).slice(0,5)}–{sessionEnd(item).slice(0,5)}</small><strong className='d-block'>{item.materia?.nombre}</strong><span className='d-block'>{item.grupo?.nombre} · {item.docente?.name ?? t('schedule.noTeacher')}</span><small>{item.espacio?.nombre}</small></button>)}</div>)}
    </div>{!sessions.length && <p className='text-muted p-4'>{t('schedule.emptySessions')}</p>}</div>}
    <Modal show={show} onHide={() => setShow(false)} centered scrollable size='lg' className='schedule-editor-modal'><Modal.Header closeButton><Modal.Title>{t(mode === 'asignaciones' ? 'schedule.newAssignment' : 'schedule.session')}</Modal.Title></Modal.Header>
      <form onSubmit={save}><Modal.Body>
        {error && <div className='alert alert-danger' role='alert'>{error}</div>}
        {mode === 'asignaciones' ? <>
          <label className='form-label'>{t('schedule.teacher')}</label><select required name='docente_id' className='form-select mb-5' defaultValue=''><option value=''>{t('common.select')}</option>{data?.docentes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label className='form-label'>{t('schedule.subject')}</label><select required name='materia_id' className='form-select mb-5' defaultValue=''><option value=''>{t('common.select')}</option>{data?.materias.filter(item => item.estado === 'activo').map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
          <label className='form-label'>{t('schedule.group')}</label><select required name='grupo_id' className='form-select mb-5' defaultValue={group}><option value=''>{t('common.select')}</option>{data?.grupos.filter(item => String(item.ano_lectivo_id) === selectedYear).map(item => <option key={item.id} value={item.id}>{groupLabel(item)}</option>)}</select>
        </> : <>
          <label className='form-label'>{t('schedule.day')}</label><select required name='dia' className='form-select mb-5' value={sessionDay} onChange={e => setSessionDay(e.target.value)}>{days.map((day, i) => <option key={day} value={day}>{intl.formatDate(new Date(2026, 8, 21 + i), {weekday: 'long'})}</option>)}</select>
          <label className='form-label'>{t('schedule.subject')}</label><select required name='materia_id' className='form-select mb-5' value={sessionSubjectId} onChange={e => setSessionSubjectId(e.target.value)}><option value=''>{t('common.select')}</option>{data?.materias.filter(item => item.estado === 'activo' && (!activeGroup || item.nivel_id == null || item.nivel_id === activeGroup.grado.nivel_id)).map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
          <label className='form-label'>{t('schedule.group')}</label><select required name='grupo_id' className='form-select mb-5' value={sessionGroupId} onChange={e => {
            const next = data?.grupos.find(item => String(item.id) === e.target.value)
            const subject = data?.materias.find(item => String(item.id) === sessionSubjectId)
            if (subject?.nivel_id != null && next && subject.nivel_id !== next.grado.nivel_id) setSessionSubjectId('')
            setSessionGroupId(e.target.value); setSessionBlockId(''); setSessionSpaceId('')
          }}><option value=''>{t('common.select')}</option>{data?.grupos.filter(item => String(item.ano_lectivo_id) === selectedYear).map(item => <option key={item.id} value={item.id}>{groupLabel(item)}</option>)}</select>
          {activeGroup && <div className='alert alert-light-primary py-3' role='status'>{activeGroup.jornada ? `${t('schedule.journey')}: ${activeGroup.jornada.nombre} · ${activeGroup.sede?.nombre ?? ''} (${activeGroup.jornada.hora_inicio?.slice(0,5) ?? '—'}–${activeGroup.jornada.hora_fin?.slice(0,5) ?? '—'})` : t('schedule.noJourney')}</div>}
          {visibleBlocks.length > 0 && <div className='rounded border p-4 mb-5'>
            <label className='form-check form-switch form-check-custom form-check-solid mb-2'><input className='form-check-input' type='checkbox' checked={blockMode} onChange={e => setUseBlock(e.target.checked)} /><span className='form-check-label fw-semibold'>{t('schedule.useBlock')}</span></label>
            <div className='text-muted fs-7'>{t('schedule.blockHint')}</div>
            {blockMode && <>
              <label className='form-label mt-4'>{t('schedule.block')}</label>
              <select required name='bloque_horario_id' className='form-select' value={sessionBlockId} onChange={e => setSessionBlockId(e.target.value)}>
                <option value=''>{t('common.select')}</option>
                {visibleBlocks.map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.hora_inicio.slice(0,5)}–{item.hora_fin.slice(0,5)}</option>)}
              </select>
              {activeBlock && <div className='row g-3 mt-2'>
                {[
                  [t('schedule.journey'), activeGroup?.jornada?.nombre],
                  [t('schedule.campus'), activeGroup?.sede?.nombre],
                  [t('schedule.startTime'), activeBlock.hora_inicio.slice(0,5)],
                  [t('schedule.endTime'), activeBlock.hora_fin.slice(0,5)],
                ].map(([label, value]) => <div className='col-sm-6' key={label}><label className='form-label fs-7'>{label}</label><input className='form-control bg-light' value={value ?? ''} readOnly /></div>)}
              </div>}
            </>}
          </div>}
          {activeGroup && visibleBlocks.length === 0 && <p className='text-muted fs-7 mb-4'>{t('schedule.noBlocks')}</p>}
          {!blockMode && <div className='row g-4 mb-5'><div className='col-md-6'><label className='form-label' htmlFor='schedule-start'>{t('schedule.startTime')}</label><input id='schedule-start' name='hora_inicio' required type='time' step={60} className='form-control' min={activeGroup?.jornada?.hora_inicio?.slice(0,5)} max={activeGroup?.jornada?.hora_fin?.slice(0,5)} value={sessionStartTime} onChange={e => setSessionStartTime(e.target.value)} /></div><div className='col-md-6'><label className='form-label' htmlFor='schedule-end'>{t('schedule.endTime')}</label><input id='schedule-end' name='hora_fin' required type='time' step={60} className='form-control' min={activeGroup?.jornada?.hora_inicio?.slice(0,5)} max={activeGroup?.jornada?.hora_fin?.slice(0,5)} value={sessionEndTime} onChange={e => setSessionEndTime(e.target.value)} /></div></div>}
          <label className='form-label'>{t('schedule.teacherOptional')}</label><select name='docente_id' className='form-select mb-5' value={sessionTeacherId} onChange={e => setSessionTeacherId(e.target.value)}><option value=''>{t('schedule.noTeacher')}</option>{data?.docentes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label className='form-label'>{t('schedule.room')}</label><select className='form-select' value={sessionSpaceId} onChange={e => setSessionSpaceId(e.target.value)}><option value=''>{t('common.select')}</option>{data?.espacios.filter(item => item.sede_id === activeGroup?.sede_id).map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        </>}
      </Modal.Body><Modal.Footer>
        {editing && writable && <button className='btn btn-light-danger me-auto' type='button' onClick={() => {setShow(false); setDeleting(editing.id)}}>{t('common.delete')}</button>}
        <button type='button' className='btn btn-light' onClick={() => setShow(false)}>{t('common.close')}</button>
        {writable && <button className='btn btn-primary' disabled={mutation.isPending}>{t('common.save')}</button>}
      </Modal.Footer></form>
    </Modal>
    <Modal show={deleting !== null} onHide={() => setDeleting(null)} centered className='schedule-editor-modal'><Modal.Header closeButton><Modal.Title>{t('common.delete')}</Modal.Title></Modal.Header><Modal.Body>{t('schedule.confirmDelete')}{error && <div className='alert alert-danger mt-4'>{error}</div>}</Modal.Body><Modal.Footer><button className='btn btn-light' onClick={() => setDeleting(null)}>{t('common.cancel')}</button><button className='btn btn-danger' disabled={mutation.isPending} onClick={() => mutation.mutate({path: `/${mode === 'asignaciones' ? 'asignaciones' : 'horarios'}/${deleting}`, method: 'delete'})}>{t('common.delete')}</button></Modal.Footer></Modal>
  </>
}
