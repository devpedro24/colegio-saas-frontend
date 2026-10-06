import {useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {
  useAttendanceRequests, useCreateAttendanceRequest, useOwnAbsences,
  useResolveAttendanceRequest, useReviewAttendanceRequest,
  type AttendanceClass, type AttendanceRequest,
} from './asistencia.api'

const message = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback
const slotKey = (token: string, date: string) => `${token}:${date}`

function Pager({page, last, total, onPage}: {page: number; last: number; total: number; onPage: (value: number) => void}) {
  const intl = useIntl()
  return <div className='d-flex align-items-center justify-content-between gap-3 mt-4'>
    <span className='text-muted fs-7'>{total} {intl.formatMessage({id: 'attendance.requestsTotal'})} · {page}/{Math.max(1, last)}</span>
    <div className='d-flex gap-2'>
      <button type='button' className='btn btn-sm btn-light' disabled={page <= 1} onClick={() => onPage(page - 1)}
        aria-label={intl.formatMessage({id: 'attendance.previous'})}>{intl.formatMessage({id: 'attendance.previous'})}</button>
      <button type='button' className='btn btn-sm btn-light' disabled={page >= last} onClick={() => onPage(page + 1)}
        aria-label={intl.formatMessage({id: 'attendance.next'})}>{intl.formatMessage({id: 'attendance.next'})}</button>
    </div>
  </div>
}

export function StudentJustifications() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const query = useOwnAbsences(page)
  const create = useCreateAttendanceRequest()
  const absences = query.data?.faltas ?? []
  const chosen = absences.filter(row => selected.includes(slotKey(row.sesion_token, row.fecha)))
  const assignment = chosen[0]?.asignacion_token
  const enrollment = chosen[0]?.matricula_token
  const changePage = (value: number) => {setPage(value); setSelected([])}
  return <section className='card mb-6'><div className='card-body'>
    <h2 className='fs-4 fw-bold'>{t('attendance.myAbsences')}</h2>
    <p className='text-muted'>{t('attendance.studentHelp')}</p>
    {query.isLoading && <p role='status'>{t('attendance.loading')}</p>}
    {query.isError && <div role='alert' className='alert alert-danger'>{message(query.error, t('attendance.loadError'))}</div>}
    {query.data && <>
      <div className='table-responsive'><table className='table table-row-dashed align-middle gy-2'>
        <thead><tr><th className='w-25px' scope='col'>{t('attendance.select')}</th>
          <th scope='col'>{t('attendance.date')}</th><th scope='col'>{t('attendance.assignment')}</th>
          <th scope='col'>{t('attendance.slot')}</th></tr></thead>
        <tbody>{absences.map(row => {
          const key = slotKey(row.sesion_token, row.fecha)
          return <tr key={key}><td><input type='checkbox' className='form-check-input' checked={selected.includes(key)}
            disabled={!!assignment && assignment !== row.asignacion_token}
            aria-label={`${t('attendance.select')} ${row.materia} ${row.fecha} ${row.hora_inicio}`}
            onChange={event => setSelected(current => event.target.checked ? [...current, key] : current.filter(value => value !== key))} /></td>
            <td>{row.fecha}</td><td>{row.materia} · {row.grupo}</td>
            <td>{row.hora_inicio}–{row.hora_fin}</td></tr>
        })}</tbody>
      </table></div>
      {!absences.length && <p className='text-muted'>{t('attendance.noAbsences')}</p>}
      <Pager page={page} last={query.data.pagination.last_page} total={query.data.pagination.total} onPage={changePage} />
      <label className='form-label mt-4' htmlFor='attendance-student-reason'>{t('attendance.reason')}</label>
      <textarea id='attendance-student-reason' className='form-control' rows={3} maxLength={2000} minLength={10}
        value={reason} onChange={event => setReason(event.target.value)} />
      <div className='text-muted fs-7 mt-2'>{t('attendance.sameSubjectHelp')}</div>
      <button type='button' className='btn btn-primary mt-4' disabled={!chosen.length || reason.trim().length < 10 || create.isPending}
        onClick={() => create.mutate({matricula_token: enrollment!, asignacion_token: assignment,
          marcas: chosen.map(row => ({sesion_token: row.sesion_token, fecha: row.fecha})), motivo: reason.trim()}, {
          onSuccess: () => {toast.success(t('attendance.requestSent')); setSelected([]); setReason('')},
          onError: error => toast.error(message(error, t('attendance.requestError'))),
        })}>{t('attendance.sendJustification')}</button>
    </>}
  </div></section>
}

export function TeacherCorrectionForm({classes, assignment, date}: {classes: AttendanceClass[]; assignment: string; date: string}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreateAttendanceRequest()
  const [student, setStudent] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const candidates = useMemo(() => {
    const names = new Map<string, string>()
    classes.forEach(row => row.estudiantes.forEach(item => {
      if (row.registrada && (item.estado === 'ausente' || item.estado === 'tarde')) names.set(item.matricula_token, item.nombre)
    }))
    return [...names].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [classes])
  const slots = classes.filter(row => row.registrada && row.estudiantes.some(item => item.matricula_token === student
    && (item.estado === 'ausente' || item.estado === 'tarde')))
  if (!candidates.length) return null
  return <section className='card mb-6'><div className='card-body'>
    <h2 className='fs-4 fw-bold'>{t('attendance.requestCorrection')}</h2>
    <p className='text-muted'>{t('attendance.teacherHelp')}</p>
    <label htmlFor='attendance-correction-student' className='form-label'>{t('attendance.student')}</label>
    <select id='attendance-correction-student' className='form-select mb-4' value={student}
      onChange={event => {setStudent(event.target.value); setSelected([])}}>
      <option value=''>{t('attendance.selectStudent')}</option>
      {candidates.map(([token, name]) => <option key={token} value={token}>{name}</option>)}
    </select>
    {!!student && <div className='d-flex flex-wrap gap-3 mb-4'>{slots.map(row =>
      <label key={row.sesion_token} className='form-check form-check-custom form-check-solid'>
        <input className='form-check-input' type='checkbox' checked={selected.includes(row.sesion_token)}
          onChange={event => setSelected(current => event.target.checked ? [...current, row.sesion_token]
            : current.filter(token => token !== row.sesion_token))} />
        <span className='form-check-label'>{date} · {row.hora_inicio}–{row.hora_fin}</span>
      </label>,
    )}</div>}
    <label className='form-label' htmlFor='attendance-teacher-reason'>{t('attendance.reason')}</label>
    <textarea id='attendance-teacher-reason' className='form-control' rows={3} maxLength={2000} minLength={10}
      value={reason} onChange={event => setReason(event.target.value)} />
    <button type='button' className='btn btn-primary mt-4' disabled={!student || !selected.length || reason.trim().length < 10 || create.isPending}
      onClick={() => create.mutate({matricula_token: student, asignacion_token: assignment,
        marcas: selected.map(token => ({sesion_token: token, fecha: date})), motivo: reason.trim()}, {
        onSuccess: () => {toast.success(t('attendance.requestSent')); setStudent(''); setSelected([]); setReason('')},
        onError: error => toast.error(message(error, t('attendance.requestError'))),
      })}>{t('attendance.sendCorrection')}</button>
  </div></section>
}

export function AttendanceRequestInbox({scope}: {scope: 'propias' | 'docente' | 'aprobacion'}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [showAll, setShowAll] = useState(false)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const status = showAll || scope === 'propias' ? undefined
    : scope === 'docente' ? 'revision_docente' : 'pendiente_aprobacion'
  const query = useAttendanceRequests(scope, page, status)
  const review = useReviewAttendanceRequest()
  const resolve = useResolveAttendanceRequest()
  const decide = (row: AttendanceRequest, decision: 'remitir' | 'aprobar' | 'rechazar') => {
    const response = responses[row.token]?.trim() ?? ''
    if (decision === 'rechazar' && response.length < 10) {
      toast.error(t('attendance.rejectionReason'))
      return
    }
    if (decision === 'aprobar' && !window.confirm(t('attendance.confirmApproval'))) return
    const callbacks = {
      onSuccess: () => {toast.success(t('attendance.requestUpdated')); setResponses(current => ({...current, [row.token]: ''}))},
      onError: (error: unknown) => toast.error(message(error, t('attendance.requestError'))),
    }
    if (scope === 'docente' && decision !== 'aprobar') {
      review.mutate({token: row.token, decision, respuesta: response}, callbacks)
    } else if (scope === 'aprobacion' && decision !== 'remitir') {
      resolve.mutate({token: row.token, decision, respuesta: response}, callbacks)
    }
  }
  const title = scope === 'propias' ? 'attendance.myRequests'
    : scope === 'docente' ? 'attendance.teacherInbox' : 'attendance.approvalInbox'
  return <section className='card mb-6'><div className='card-body'>
    <div className='d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3'>
      <h2 className='fs-4 fw-bold mb-0'>{t(title)}</h2>
      {scope !== 'propias' && <label className='form-check form-switch form-check-custom form-check-solid'>
        <input className='form-check-input' type='checkbox' checked={showAll}
          onChange={event => {setShowAll(event.target.checked); setPage(1)}} />
        <span className='form-check-label'>{t('attendance.showAllRequests')}</span>
      </label>}
    </div>
    {query.isLoading && <p role='status'>{t('attendance.loading')}</p>}
    {query.isError && <div role='alert' className='alert alert-danger'>{message(query.error, t('attendance.loadError'))}</div>}
    {query.data && <>
      {!query.data.solicitudes.length && <p className='text-muted'>{t('attendance.noRequests')}</p>}
      <div className='d-flex flex-column gap-3'>{query.data.solicitudes.map(row => <article key={row.token} className='border rounded p-4'>
        <div className='d-flex flex-wrap align-items-center gap-2 mb-2'>
          <strong>{row.estudiante}</strong><span className='text-muted'>· {row.asignatura} · {row.grupo}</span>
          <span className='badge badge-light-primary'>{t(`attendance.requestStatus.${row.estado}`)}</span>
        </div>
        <div className='text-muted fs-7 mb-2'>{row.marcas.map(item =>
          `${item.fecha} ${item.hora_inicio}–${item.hora_fin}`,
        ).join(' · ')}</div>
        <p className='mb-2'>{row.motivo}</p>
        {row.respuesta_docente && <p className='text-muted mb-2'>{t('attendance.teacherResponse')}: {row.respuesta_docente}</p>}
        {row.respuesta_aprobador && <p className='text-muted mb-2'>{t('attendance.approverResponse')}: {row.respuesta_aprobador}</p>}
        {((scope === 'docente' && row.estado === 'revision_docente') ||
          (scope === 'aprobacion' && row.estado === 'pendiente_aprobacion')) && <>
          <label className='form-label' htmlFor={`attendance-response-${row.token}`}>{t('attendance.responseOptional')}</label>
          <textarea id={`attendance-response-${row.token}`} className='form-control form-control-sm mb-3' rows={2}
            maxLength={2000} value={responses[row.token] ?? ''}
            onChange={event => setResponses(current => ({...current, [row.token]: event.target.value}))} />
          <div className='d-flex flex-wrap gap-2'>
            <button type='button' className='btn btn-sm btn-primary' disabled={review.isPending || resolve.isPending}
              onClick={() => decide(row, scope === 'docente' ? 'remitir' : 'aprobar')}>
              {t(scope === 'docente' ? 'attendance.forward' : 'attendance.approve')}
            </button>
            <button type='button' className='btn btn-sm btn-light-danger' disabled={review.isPending || resolve.isPending}
              onClick={() => decide(row, 'rechazar')}>{t('attendance.reject')}</button>
          </div>
        </>}
      </article>)}</div>
      <Pager page={page} last={query.data.pagination.last_page} total={query.data.pagination.total} onPage={setPage} />
    </>}
  </div></section>
}
