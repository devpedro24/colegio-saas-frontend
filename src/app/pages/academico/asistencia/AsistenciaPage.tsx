import {useEffect, useState} from 'react'
import {PageTitle} from '@/_metronic/layout/core'
import {Content} from '@/_metronic/layout/components/content'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {AttendancePolicySettings} from './AttendancePolicyPanel'
import {useAttendance, useAttendanceCatalog, useSaveAttendance, type AttendanceClass, type AttendanceState} from './asistencia.api'

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function ClassRoster({row, assignment, date}: {row: AttendanceClass; assignment: string; date: string}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const save = useSaveAttendance(assignment, date)
  const [marks, setMarks] = useState<Record<string, AttendanceState | null>>({})
  const [dirty, setDirty] = useState(false)
  const [draftVersion, setDraftVersion] = useState<number | null>(null)
  useEffect(() => {
    if (!dirty) setMarks(Object.fromEntries(row.estudiantes.map(student => [student.matricula_token, student.estado])))
  }, [row, dirty])
  const update = (token: string, state: AttendanceState) => {
    setMarks(current => ({...current, [token]: state}))
    if (!dirty) setDraftVersion(row.version)
    setDirty(true)
  }
  const complete = row.estudiantes.length > 0 && row.estudiantes.every(student => marks[student.matricula_token])
  const stale = dirty && draftVersion !== row.version

  return <section className='card mb-5'>
    <div className='card-header border-0 align-items-center'>
      <div className='card-title flex-column align-items-start'>
        <h3 className='fs-5 fw-bold mb-1'>{row.hora_inicio}–{row.hora_fin}</h3>
        <span className='text-muted fs-7'>{row.registrada ? t('attendance.recorded') : t('attendance.pending')}{row.historica ? ` · ${t('attendance.historical')}` : ''}</span>
      </div>
      {row.editable && <div className='card-toolbar d-flex gap-2 flex-wrap'>
        <button type='button' className='btn btn-sm btn-light-primary' onClick={() =>
          {setMarks(Object.fromEntries(row.estudiantes.map(student => [student.matricula_token, 'presente']))); if (!dirty) setDraftVersion(row.version); setDirty(true)}}>
          {t('attendance.allPresent')}
        </button>
        <button type='button' className='btn btn-sm btn-primary' disabled={!complete || stale || save.isPending} onClick={() =>
          save.mutate({sesion_token: row.sesion_token, version: draftVersion ?? row.version, marcas: row.estudiantes.map(student => ({
            matricula_token: student.matricula_token, estado: marks[student.matricula_token]!,
          }))}, {
            onSuccess: () => {setDirty(false); setDraftVersion(null); toast.success(t('attendance.saved'))},
            onError: error => toast.error(error instanceof ApiError ? error.message : t('attendance.saveError')),
          })}>
          {t('attendance.save')}
        </button>
      </div>}
    </div>
    <div className='card-body pt-0'>
      {stale && <div role='alert' className='alert alert-warning d-flex justify-content-between align-items-center gap-3'>
        <span>{t('attendance.stale')}</span>
        <button type='button' className='btn btn-sm btn-light' onClick={() => {setDirty(false); setDraftVersion(null)}}>{t('attendance.reload')}</button>
      </div>}
      <div className='table-responsive' style={{maxHeight: 560, overflowY: 'auto'}}>
        <table className='table table-row-dashed align-middle gy-2 mb-0'>
          <thead className='bg-light position-sticky top-0'><tr>
            <th>{t('attendance.student')}</th><th className='text-center'>{t('attendance.state')}</th>
            <th className='text-center'>{t('attendance.absenceSummary')}</th>
          </tr></thead>
          <tbody>{row.estudiantes.map(student => <tr key={student.matricula_token}>
            <td className='fw-semibold'>{student.nombre}</td>
            <td className='text-center'>
              {row.editable ? <select className='form-select form-select-sm w-auto mx-auto' aria-label={`${t('attendance.title')}: ${student.nombre}`}
                value={marks[student.matricula_token] ?? ''} onChange={event => update(student.matricula_token, event.target.value as AttendanceState)}>
                <option value=''>{t('attendance.unmarked')}</option><option value='presente'>{t('attendance.present')}</option>
                <option value='ausente'>{t('attendance.absent')}</option><option value='tarde'>{t('attendance.late')}</option>
              </select> : t(`attendance.${student.estado ?? 'unmarked'}`)}
            </td>
            <td className='text-center text-nowrap'>
              {student.resumen.faltas_equivalentes} / {student.resumen.registradas}
              {' · '}{student.resumen.porcentaje} %
              {student.resumen.alerta && <span className='badge badge-light-warning ms-2'>{t('attendance.alert')}</span>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </section>
}

export default function AsistenciaPage() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {hasPermission, hasRole, isPlatform} = useAuthz()
  const [assignment, setAssignment] = useState('')
  const [date, setDate] = useState(today)
  const catalog = useAttendanceCatalog()
  const query = useAttendance(assignment, date)
  const canConfigure = hasPermission('academico.configurar') &&
    (hasRole('rector') || hasRole('coord_academico') || hasRole('coord_combinado') || isPlatform)
  return <><PageTitle>{t('attendance.title')}</PageTitle><Content>
    <div className='card mb-6'><div className='card-body'>
      <h2 className='fs-3 fw-bold mb-1'>{t('attendance.heading')}</h2>
      <p className='text-muted mb-5'>{t('attendance.help')}</p>
      <div className='row g-3'>
        <div className='col-md-8'><label htmlFor='attendance-assignment' className='form-label'>{t('attendance.assignment')}</label>
          <select id='attendance-assignment' className='form-select' value={assignment} onChange={event => setAssignment(event.target.value)}>
            <option value=''>{t('attendance.selectAssignment')}</option>
            {catalog.data?.asignaciones.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
          </select>
        </div>
        <div className='col-md-4'><label htmlFor='attendance-date' className='form-label'>{t('attendance.date')}</label>
          <input id='attendance-date' type='date' className='form-control' value={date} onChange={event => setDate(event.target.value)} />
        </div>
      </div>
    </div></div>
    {canConfigure && <AttendancePolicySettings />}
    {(catalog.isLoading || query.isLoading) && <div role='status' className='text-muted'>{t('attendance.loading')}</div>}
    {(catalog.isError || query.isError) && <div role='alert' className='alert alert-danger'>
      {query.error instanceof ApiError ? query.error.message : catalog.error instanceof ApiError ? catalog.error.message : t('attendance.loadError')}
    </div>}
    {query.data?.periodo && <p className='text-muted'>{query.data.periodo.nombre} · {query.data.periodo.estado}</p>}
    {assignment && <p className='text-muted fs-7'>{t('attendance.summaryHelp')}</p>}
    {assignment && query.data?.clases?.length === 0 && <div className='alert alert-info'>{t('attendance.empty')}</div>}
    {query.data?.clases?.map(row => <ClassRoster key={`${assignment}:${date}:${row.sesion_token}`} row={row} assignment={assignment} date={date} />)}
  </Content></>
}
