import {useQuery} from '@tanstack/react-query'
import {useEffect} from 'react'
import {useIntl} from 'react-intl'
import {Link} from 'react-router-dom'
import {api} from '@/lib/api/client'
import messages from './notificationUpdates.messages.json'
import './notification-updates.css'

export type NotificationUpdate = {
  token: string
  event: string
  resource_title: string
  subject: string
  group: string
  grade: string | null
  year: string | null
  url: string
  created_at: string
  attendance_date?: string
  attendance_time?: string
  event_date?: string
  event_time?: string | null
  institutional?: boolean
}

export default function NotificationUpdates({scope, page, setPage, onTotal, onOpen}: {
  scope: string; page: number; setPage: (page: number) => void; onTotal: (total: number) => void; onOpen: () => void
}) {
  const intl = useIntl()
  const copy = messages[intl.locale.startsWith('es') ? 'es' : 'en']
  const query = useQuery({queryKey: ['notification-updates', scope, page],
    queryFn: () => api.get<{data: NotificationUpdate[]; meta: {current_page: number; last_page: number; total: number}}>(`/notification-updates?page=${page}`)})
  useEffect(() => {if (query.data) onTotal(query.data.meta.total)}, [query.data, onTotal])
  if (query.isPending) return <div className='text-center py-10' role='status'>{copy.loading}</div>
  if (query.isError) return <div className='text-center py-10'><p role='alert'>{copy.error}</p>
    <button className='btn btn-sm btn-light-primary' type='button' onClick={() => void query.refetch()}>{copy.retry}</button></div>
  if (!query.data.data.length) return <div className='d-flex flex-column flex-center text-center py-10 h-100'>
    <span className='symbol symbol-50px mb-4'><span className='symbol-label bg-light-primary'>
      <i className='ki-solid ki-notification-bing fs-2x text-primary' aria-hidden='true' /></span></span>
    <p className='fw-semibold text-gray-900 mb-2'>{copy.empty}</p><p className='text-muted mb-0'>{copy.emptyHelp}</p></div>
  return <div data-testid='notification-updates'>
    {query.data.data.map(update => {
      const grading = update.event.startsWith('aula.grade.')
      const attendance = update.event.startsWith('attendance.')
      const calendar = update.event.startsWith('calendar.')
      const source = calendar ? 'calendar' : attendance ? 'attendance' : 'aula'
      const rejected = update.event === 'attendance.justification.rejected'
      const published = update.event === 'aula.resource.published'
      const attendanceLabels: Record<string, string> = {
        'attendance.absent': copy.absent, 'attendance.late': copy.late,
        'attendance.justification.requested': copy.justificationRequested,
        'attendance.justification.forwarded': copy.justificationForwarded,
        'attendance.justification.approved': copy.justificationApproved,
        'attendance.justification.rejected': copy.justificationRejected,
      }
      const calendarLabels: Record<string, string> = {'calendar.event.published': copy.eventPublished,
        'calendar.event.updated': copy.eventUpdated, 'calendar.event.deleted': copy.eventDeleted}
      const label = calendar ? calendarLabels[update.event] ?? copy.eventUpdated : attendance ? attendanceLabels[update.event] ?? copy.attendanceUpdated : grading ? copy.graded : published ? copy.published : copy.updated
      const color = rejected ? 'danger' : attendance ? update.event.endsWith('.approved') ? 'success' : 'warning' : grading ? 'success' : 'primary'
      // Only navigate to an explicit internal resource route; never trust arbitrary feed URLs.
      const url = (attendance && update.url === '/academico/asistencia') ||
        (calendar && /^\/comunicacion\/eventos\?evento=[A-Za-z0-9_-]{24}$/.test(update.url)) ||
        (source === 'aula' && /^\/evaluacion\/aula\/recursos\/[A-Za-z0-9_-]{24}$/.test(update.url)) ? update.url : null
      const date = calendar ? update.event_date : update.attendance_date
      const time = calendar ? update.event_time : update.attendance_time
      const context = calendar ? update.institutional ? copy.institutional : update.group
        : [update.subject, [update.grade, update.group].filter(Boolean).join(' / '), update.year].filter(Boolean).join(' · ')
      const content = <>
        <span className='symbol symbol-35px flex-shrink-0'><span className={`symbol-label ${rejected ? 'bg-light-danger' : 'notification-source-icon'}`}>
          <i className={`ki-solid ki-${calendar ? 'calendar' : attendance ? rejected ? 'cross-circle' : 'profile-user' : grading ? 'teacher' : published ? 'document' : 'pencil'} fs-3 ${rejected ? `text-${color}` : ''}`} aria-hidden='true' />
        </span></span>
        <span className='min-w-0 flex-grow-1'>
          <span className='notification-source-label'>{calendar ? copy.sourceCalendar : attendance ? copy.sourceAttendance : copy.sourceAula}</span>
          <span className='d-block fw-semibold text-gray-900'>{label}</span>
          {update.resource_title && <span className='d-block text-gray-800 fs-7 text-break'>{update.resource_title}</span>}
          {date && <span className='d-block text-gray-800 fs-7'>
            {intl.formatDate(`${date}T12:00:00Z`, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'})}
            {time ? ` · ${time}` : ''}</span>}
          <span className='d-block text-muted fs-7 text-break'>{context}</span>
          <time className='d-block text-muted fs-8 mt-1' dateTime={update.created_at}>
            {intl.formatDate(update.created_at, {day: 'numeric', month: 'short', year: 'numeric'})}
            {' · '}{intl.formatTime(update.created_at, {hour: 'numeric', minute: '2-digit'})}</time>
        </span>
      </>
      return url ? <Link key={update.token} to={url} onClick={onOpen} data-source={source} className='notification-update d-flex gap-3 py-4 border-bottom border-gray-200 text-decoration-none'
        data-notification-update={update.token}>{content}</Link> : <div key={update.token} data-source={source} className='notification-update d-flex gap-3 py-4 border-bottom border-gray-200'
          data-notification-update={update.token}>{content}</div>
    })}
    {query.data.meta.last_page > 1 && <div className='d-flex justify-content-between align-items-center pt-4 gap-2'>
      <button type='button' className='btn btn-sm btn-light' disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>{copy.previous}</button>
      <span className='text-muted fs-8'>{page} / {query.data.meta.last_page}</span>
      <button type='button' className='btn btn-sm btn-light' disabled={page >= query.data.meta.last_page || query.isFetching} onClick={() => setPage(page + 1)}>{copy.next}</button>
    </div>}
  </div>
}
