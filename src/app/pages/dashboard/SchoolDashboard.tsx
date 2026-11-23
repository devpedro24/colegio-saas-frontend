import type {ReactNode} from 'react'
import {useIntl} from 'react-intl'
import {Link} from 'react-router-dom'
import {Content} from '@/_metronic/layout/components/content'
import {PageTitle} from '@/_metronic/layout/core'
import {useAuth} from '@/app/modules/auth'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {StudentEnrollmentStatus} from '../admisiones/StudentEnrollmentStatus'
import {AttendanceTrend} from './AttendanceTrend'
import './school-dashboard.css'

const demoYear = 2026
const attendanceWeeks = [
  {label: 'latestWeek', days: [94.8, 96.2, 95.9, 98.4, 96.7]},
  {label: 'previousWeek', days: [93.2, 94.5, 95.7, 94.6, 96]},
].map((week) => ({...week, average: week.days.reduce((sum, value) => sum + value, 0) / week.days.length}))
const levels = [
  {label: 'preschool', count: 64, tone: 'green'},
  {label: 'primary', count: 206, tone: 'violet'},
  {label: 'secondary', count: 116, tone: 'blue'},
  {label: 'upperSecondary', count: 42, tone: 'amber'},
]
const studentCount = levels.reduce((sum, {count}) => sum + count, 0)
const metrics = [
  {label: 'students', caption: 'studentsCaption', value: studentCount, icon: 'mortarboard', tone: 'violet'},
  {label: 'teachers', caption: 'teachersCaption', value: 32, icon: 'person-video3', tone: 'blue'},
  {label: 'groups', caption: 'groupsCaption', value: 18, icon: 'grid-1x2', tone: 'amber'},
  {label: 'attendance', caption: 'attendanceCaption', value: attendanceWeeks[0].average / 100, icon: 'clipboard2-check', tone: 'green'},
]
const applications = [
  {label: 'confirmed', count: 38, tone: 'violet'},
  {label: 'awaitingGroup', count: 14, tone: 'blue'},
  {label: 'inReview', count: 10, tone: 'amber'},
]
const total = applications.reduce((sum, {count}) => sum + count, 0)
const events = [
  {date: '2026-11-24', time: '08:00', title: 'eventFair', place: 'placeCourtyard', tone: 'violet'},
  {date: '2026-11-26', time: '15:30', title: 'eventCouncil', place: 'placeTeachersRoom', tone: 'blue'},
  {date: '2026-11-30', time: '10:00', title: 'eventClosing', place: 'placeAuditorium', tone: 'green'},
]
const announcements = [
  {title: 'noticeRenewals', description: 'noticeRenewalsDescription', icon: 'clipboard2-check', tone: 'violet'},
  {title: 'noticeReports', description: 'noticeReportsDescription', icon: 'file-earmark-text', tone: 'blue'},
  {title: 'noticeSchedule', description: 'noticeScheduleDescription', icon: 'clock', tone: 'amber'},
]

function Icon({name}: {name: string}) {
  return <i className={'bi bi-' + name} aria-hidden='true' />
}

function Panel({id, title, icon, tone, children, footer}: {
  id: string
  title: string
  icon: string
  tone: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className='school-dashboard__panel' aria-labelledby={id}>
      <header className='school-dashboard__panel-header'>
        <span className='school-dashboard__icon' data-tone={tone}><Icon name={icon} /></span>
        <h2 id={id}>{title}</h2>
      </header>
      {children}
      {footer && <div className='school-dashboard__panel-footer'>{footer}</div>}
    </section>
  )
}

export default function SchoolDashboard() {
  const intl = useIntl()
  const {currentUser} = useAuth()
  const {hasRole, hasFeature, hasPermission} = useAuthz()
  const {activeColegio} = useImpersonation()
  const t = (key: string) => intl.formatMessage({id: 'schoolDashboard.' + key})
  const student = hasRole('estudiante')
  const school = activeColegio?.name ?? currentUser?.institution?.name
  const firstName = currentUser?.name.trim().split(/\s+/, 1)[0]
  const applicationsPath = hasPermission('ingreso.ver') ? '/admisiones/solicitudes' : null
  const admissionPath = applicationsPath
    ?? (hasPermission('academico.matriculas.gestionar') ? '/admisiones/matriculas' : null)
  const gradebookPath = hasFeature('academico') && ['notas.ver_consolidado_todos', 'notas.editar_no_dicta', 'notas.registrar_materia_asignada'].some(hasPermission)
    ? '/evaluacion/catalogo' : null
  const calendarPath = '/comunicacion/eventos'
  const shortcuts = [
    {label: 'shortcutEnrollment', path: admissionPath, icon: 'person-check'},
    {label: 'shortcutGradebook', path: gradebookPath, icon: 'journal-check'},
    {label: 'shortcutCalendar', path: calendarPath, icon: 'calendar-event'},
  ]
  const tasks = [
    {label: 'taskGroup', description: 'taskGroupDescription', count: applications[1].count, tone: 'violet', path: applicationsPath},
    {label: 'taskReview', description: 'taskReviewDescription', count: applications[2].count, tone: 'amber', path: applicationsPath},
    {label: 'taskGrades', description: 'taskGradesDescription', count: 6, tone: 'blue', path: gradebookPath},
  ]
  const percent = (fraction: number, maximumFractionDigits = 0) =>
    intl.formatNumber(fraction, {style: 'percent', maximumFractionDigits})

  return (
    <Content>
      <PageTitle>{t('title')}</PageTitle>
      <main className='school-dashboard' aria-labelledby='school-dashboard-title'>
        <header className='school-dashboard__hero'>
          <div className='school-dashboard__hero-content'>
            <div className='school-dashboard__context'>
              <span className='school-dashboard__hero-icon'><Icon name='buildings' /></span>
              <span>{school || t('title')}</span>
            </div>
            <h1 id='school-dashboard-title'>
              {firstName ? intl.formatMessage({id: 'schoolDashboard.greeting'}, {name: firstName}) : t('title')}
            </h1>
            <p>{t(student ? 'studentIntro' : 'intro')}</p>
          </div>
          {!student && (
            <div className='school-dashboard__hero-side'>
              <div className='school-dashboard__hero-meta'>
                <span className='school-dashboard__example'><Icon name='circle-fill' />{t('example')}</span>
                <span className='school-dashboard__year'>
                  <Icon name='calendar4-week' />
                  {intl.formatMessage({id: 'schoolDashboard.year'}, {year: String(demoYear)})}
                </span>
              </div>
              <nav className='school-dashboard__shortcuts' aria-label={t('shortcuts')}>
                {shortcuts.map(({label, path, icon}) => path && (
                  <Link to={path} key={label}><Icon name={icon} />{t(label)}</Link>
                ))}
              </nav>
            </div>
          )}
        </header>
        {student ? <StudentEnrollmentStatus /> : (
          <>
            <section aria-labelledby='school-dashboard-overview'>
              <h2 className='school-dashboard__section-title' id='school-dashboard-overview'>{t('overview')}</h2>
              <dl className='school-dashboard__metrics'>
                {metrics.map(({label, caption, value, icon, tone}) => (
                  <div className='school-dashboard__metric' key={label}>
                    <dt>{t(label)}<span className='school-dashboard__icon' data-tone={tone}><Icon name={icon} /></span></dt>
                    <dd>
                      <strong>{label === 'attendance' ? percent(value, 1) : intl.formatNumber(value)}</strong>
                      <span>{t(caption)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className='school-dashboard__analysis'>
              <Panel id='school-dashboard-attendance' title={t('attendanceTrend')} icon='graph-up-arrow' tone='green'>
                <AttendanceTrend weeks={attendanceWeeks} />
              </Panel>
              <Panel id='school-dashboard-enrollment' title={t('enrollment')} icon='person-check' tone='violet'
                footer={admissionPath && <Link to={admissionPath}>{t('openEnrollment')} <Icon name='arrow-right' /></Link>}>
                <div className='school-dashboard__enrollment-total'>
                  <div><strong>{intl.formatNumber(total)}</strong> <span>{t('applications')}</span></div>
                  <span className='school-dashboard__completion'>
                    {intl.formatMessage({id: 'schoolDashboard.completion'}, {percent: percent(applications[0].count / total)})}
                  </span>
                </div>
                <div className='school-dashboard__segments' aria-hidden='true'>
                  {applications.map(({label, count, tone}) =>
                    <span key={label} data-tone={tone} style={{flexGrow: count}} />)}
                </div>
                <ul className='school-dashboard__legend'>
                  {applications.map(({label, count, tone}) => (
                    <li key={label}>
                      <span className='school-dashboard__dot' data-tone={tone} />
                      <span>{t(label)}</span>
                      <strong>{intl.formatNumber(count)}</strong>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel id='school-dashboard-tasks' title={t('tasks')} icon='list-task' tone='amber'>
                <ul className='school-dashboard__tasks'>
                  {tasks.map(({label, description, count, tone, path}) => {
                    const content = (
                      <>
                        <strong className='school-dashboard__task-count' data-tone={tone}>{intl.formatNumber(count)}</strong>
                        <div><h3>{t(label)}</h3><p>{t(description)}</p></div>
                        {path && <Icon name='chevron-right' />}
                      </>
                    )
                    return (
                      <li key={label}>
                        {path
                          ? <Link to={path} className='school-dashboard__task'>{content}</Link>
                          : <div className='school-dashboard__task'>{content}</div>}
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </div>
            <div className='school-dashboard__details'>
              <Panel id='school-dashboard-levels' title={t('studentLevels')} icon='bar-chart-line' tone='violet'>
                <ul className='school-dashboard__levels'>
                  {levels.map(({label, count, tone}) => (
                    <li key={label} data-tone={tone}>
                      <div><span>{t(label)}</span><strong>{intl.formatNumber(count)}</strong></div>
                      <span className='school-dashboard__level-track' aria-hidden='true'>
                        <span style={{width: `${count / studentCount * 100}%`}} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel id='school-dashboard-events' title={t('events')} icon='calendar-event' tone='blue'
                footer={<Link to={calendarPath}>{t('openCalendar')} <Icon name='arrow-right' /></Link>}>
                <ul className='school-dashboard__list'>
                  {events.map(({date, time, title, place, tone}) => {
                    const day = new Date(date + 'T00:00:00Z')
                    const begins = new Date(date + 'T' + time + ':00Z')
                    return (
                      <li key={date}>
                        <time className='school-dashboard__date' dateTime={date} data-tone={tone}
                          aria-label={intl.formatDate(day, {dateStyle: 'long', timeZone: 'UTC'})}>
                          <strong>{intl.formatDate(day, {day: '2-digit', timeZone: 'UTC'})}</strong>
                          <span>{intl.formatDate(day, {month: 'short', timeZone: 'UTC'}).replace('.', '')}</span>
                        </time>
                        <div>
                          <h3>{t(title)}</h3>
                          <p>{intl.formatTime(begins, {hour: 'numeric', minute: '2-digit', timeZone: 'UTC'})} · {t(place)}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
              <Panel id='school-dashboard-announcements' title={t('announcements')} icon='megaphone' tone='amber'>
                <ul className='school-dashboard__list'>
                  {announcements.map(({title, description, icon, tone}) => (
                    <li key={title}>
                      <span className='school-dashboard__icon' data-tone={tone}><Icon name={icon} /></span>
                      <div><h3>{t(title)}</h3><p>{t(description)}</p></div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </>
        )}
      </main>
    </Content>
  )
}
