import {useEffect, useState, type ReactNode} from 'react'
import {useNavigate} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useCatalogoEvaluacion} from '../evaluacion.api'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import {AcademicPagination} from '@/app/shared/components/AcademicPagination'
import {AcademicPageHeader} from '@/app/shared/components/AcademicPageHeader'
import {usePageSize} from '@/app/shared/hooks/usePageSize'
import {AcademicOptionSelect} from '../../shared/AcademicOptionSelect'
import {useCatalogFilters} from '../../shared/useCatalogFilters'
import {useAuthz} from '@/app/modules/auth/core/authz'

export const CatalogoView = ({reportsOnly = false, reportActions}: {reportsOnly?: boolean; reportActions?: ReactNode | ((selection: {year: string; group: string}) => ReactNode)}) => {
  const navigate = useNavigate()
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {hasRole, hasPermission} = useAuthz()
  const canRecover = hasPermission('notas.gestionar_nivelaciones')
  const teacherScope = hasRole('docente') || hasRole('director_grupo')
  const [filters, setFilters] = useCatalogFilters(reportsOnly ? 'boletines' : 'evaluacion')
  const {ano: year, grupo: group, materia, periodo: period} = filters
  const setPeriod = (value: string) => setFilters({periodo: value})
  const [status, setStatus] = useState('')
  const [assignmentPage, setAssignmentPage] = useState(1)
  const [enrollmentPage, setEnrollmentPage] = useState(1)
  const [assignmentPerPage, setAssignmentPerPage] = usePageSize('evaluacion-asignaciones')
  const [enrollmentPerPage] = usePageSize('evaluacion-matriculas')
  const {data, isLoading, error, isFetching} = useCatalogoEvaluacion({
    yearId: year, groupId: group, materiaId: materia, enrollmentStatus: status,
    assignmentPage, assignmentPerPage,
    enrollmentPage: reportsOnly && group ? undefined : enrollmentPage,
    enrollmentPerPage: reportsOnly && group ? undefined : enrollmentPerPage,
    view: reportsOnly ? 'boletines' : 'planillas',
  })

  useEffect(() => {
    if (!data?.anos.length) return
    const nextYear = year || (data.anos.find(ano => ano.estado === 'en_curso') ?? data.anos[0]).url_token
    const available = data.grupos.filter(item => item.ano_lectivo_id === nextYear)
    const nextGroup = (teacherScope || reportsOnly) && available.length === 1 ? available[0].url_token
      : (teacherScope || reportsOnly) && group && !available.some(item => item.url_token === group) ? '' : group
    const nextSubject = !reportsOnly && teacherScope && available.length === 1 && data.materias.length < 10 ? '' : materia
    if (year !== nextYear || group !== nextGroup || materia !== nextSubject) {
      setFilters({ano: nextYear, grupo: nextGroup, materia: nextSubject}); setEnrollmentPage(1); setAssignmentPage(1)
    }
  }, [data, year, group, materia, reportsOnly, teacherScope, setFilters])

  useEffect(() => {
    if (status && data?.estados_disponibles && !data.estados_disponibles.includes(status)) setStatus('')
  }, [data?.estados_disponibles, status])

  const resetPages = () => {setAssignmentPage(1); setEnrollmentPage(1)}
  const changeAssignmentSize = (size: number) => {setAssignmentPerPage(size); setAssignmentPage(1)}

  if (isLoading) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
  if (error || !data) return <div className='alert alert-danger' role='alert'>{error?.message || t('common.error')}</div>
  if (!year && data.anos.length > 0) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
  const selectedYear = year || (data.anos.find(a => a.estado === 'en_curso') ?? data.anos[0])?.url_token || ''
  const periods = data.periodos.filter(p => p.ano_lectivo_id === selectedYear)
  const selectedPeriod = periods.some(p => p.url_token === period) ? period : (periods.find(p => p.estado === 'abierto') ?? periods[0])?.url_token ?? ''
  const selectedPeriodToken = selectedPeriod
  const assignments = data.asignaciones
  const enrollments = data.matriculas
  const groups = data.grupos.filter(g => g.ano_lectivo_id === selectedYear)
  const soleTeacherGroup = teacherScope && groups.length === 1
  const soleGroup = reportsOnly ? groups.length === 1 : soleTeacherGroup
  const hasReportGroup = groups.some(item => item.url_token === group)
  const simpleTeacherSubjects = soleTeacherGroup && data.materias.length < 10
  const enrollmentOffset = group ? 0 : (data.pagination?.matriculas?.from ?? ((enrollmentPage - 1) * enrollmentPerPage + 1)) - 1
  if (soleGroup && group !== groups[0].url_token) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
  const statuses = data.estados_disponibles ?? []
  const showReportFilters = !soleGroup || statuses.length > 1
  const catalogFilters = <>
    {!soleGroup && <div className={reportsOnly ? 'report-group-filter' : undefined} style={{minWidth: '12rem', flex: reportsOnly ? '0 1 15rem' : '1 1 12rem'}}>
      <AcademicOptionSelect tipo='grupos' yearId={selectedYear} label={t('evaluacion.matriculas.grupo')} opaque
        value={group} onChange={value => {setFilters({grupo: value}); resetPages()}} initialOptions={groups}
        emptyLabel={t('academic.filter.selectGroup')} selectOnly hideLabel
        formatOption={option => `${option.grado?.nombre ?? ''} / ${option.nombre ?? ''}`} />
    </div>}
    {!reportsOnly && !simpleTeacherSubjects && <div style={{minWidth: '12rem', flex: '1 1 12rem'}}>
      <AcademicOptionSelect tipo='materias' yearId={selectedYear} label={t('siee.materia')} opaque
        value={materia} onChange={value => {setFilters({materia: value}); setAssignmentPage(1)}}
        initialOptions={data.materias ?? []} emptyLabel={t('academic.filter.selectSubject')} selectOnly hideLabel />
    </div>}
    {reportsOnly && statuses.length > 1 && <div style={{minWidth: '12rem', flex: '1 1 12rem'}}>
      <select id='evaluacion-status' aria-label={t('evaluacion.matriculas.estado')} className='form-select form-select-solid' value={status}
        onChange={event => {setStatus(event.target.value); setEnrollmentPage(1)}}>
        <option value=''>{t('academic.filter.selectStatus')}</option>
        {statuses.map(item => <option key={item} value={item}>{t(`evaluacion.matriculas.estado.${item}`)}</option>)}
      </select>
    </div>}
    {(!reportsOnly && ((!soleGroup && !!group) || !!materia || !!status)) && <button type='button' className='btn btn-sm btn-light' onClick={() => {
      setFilters({grupo: soleGroup ? groups[0].url_token : '', materia: ''}); setStatus(''); resetPages()
    }}>{t('audit.clear')}</button>}
  </>
  return <div className='d-flex flex-column gap-6'>
    <AcademicPageHeader title={t(reportsOnly ? 'boletines.title' : 'evaluacion.title')}
      description={t(reportsOnly ? 'boletines.catalogo.desc' : 'evaluacion.catalogo.desc')}>
      <div className='d-flex flex-wrap gap-3'>
        <select className='form-select form-select-solid w-auto' aria-label={t('academico.config.yearLabel')} value={selectedYear} onChange={e => {setFilters({ano: e.target.value, grupo: '', materia: '', periodo: ''}); resetPages()}}>
          {!data.anos.length && <option value=''>{t('academico.config.yearLabel')}</option>}
          {data.anos.map(a => <option key={a.url_token} value={a.url_token}>{a.nombre}</option>)}
        </select>
        {!reportsOnly && <select className='form-select form-select-solid w-auto' aria-label={t('evaluacion.period')} value={selectedPeriod} onChange={e => setPeriod(e.target.value)}>
          {!periods.length && <option value=''>{t('evaluacion.period')}</option>}
          {periods.map(p => <option key={p.url_token} value={p.url_token}>{p.nombre} · {t(`academico.periodos.estado.${p.estado}`)}</option>)}
        </select>}
      </div>
    </AcademicPageHeader>
    {!reportsOnly && <KTCard>
      <div className='card-header'><h3 className='card-title'>{t('evaluacion.mis_asignaciones')}</h3>
        <div className='card-toolbar d-flex flex-wrap justify-content-end gap-3' data-testid='assignment-toolbar'>
          {catalogFilters}
          {data.can_manage_manual_areas && data.anos.find(item => item.url_token === selectedYear)?.area_manual && <button className='btn btn-light-primary btn-sm' disabled={!selectedPeriodToken}
            onClick={() => navigate(`/evaluacion/areas/manual?ano=${encodeURIComponent(selectedYear)}&grupo=${encodeURIComponent(group)}&periodo=${encodeURIComponent(selectedPeriodToken)}`)}>{t('grading.manualAreaTitle')}</button>}
          {data.can_manage_manual_annuals && data.anos.find(item => item.url_token === selectedYear)?.anual_manual && <button className='btn btn-light-primary btn-sm'
            onClick={() => navigate(`/evaluacion/anuales/manual?ano=${encodeURIComponent(selectedYear)}&grupo=${encodeURIComponent(group)}`)}>{t('grading.manualAnnualTitle')}</button>}
          {data.can_configure && <button className='btn btn-light-primary btn-sm' onClick={() => navigate('/academico/siee')}>{t('siee.title')}</button>}
        </div>
      </div>
      <KTCardBody><div className='table-responsive' aria-busy={isFetching}><table className='table table-row-dashed align-middle gy-4'>
        <thead><tr className='text-muted fw-bold'><th>{t('siee.materia')}</th><th>{t('evaluacion.matriculas.grupo')}</th><th className='text-end'>{t('evaluacion.catalogo.acciones')}</th></tr></thead>
        <tbody>{assignments.map(a => <tr key={a.id}>
          <td className='fw-semibold'>{a.materia.nombre}</td><td>{a.grupo.grado.nombre} / {a.grupo.nombre}</td>
          <td className='text-end'><button className='btn btn-light-primary btn-sm' disabled={!selectedPeriodToken || !a.url_token} onClick={() => navigate(`/evaluacion/planillas/${a.url_token}/${selectedPeriodToken}`)}>{t('evaluacion.catalogo.ver_planilla')}</button></td>
        </tr>)}
        {!assignments.length && <tr><td colSpan={3} className='text-center text-muted py-8'>{t('evaluacion.catalogo.no_asignaturas')}</td></tr>}
        </tbody>
      </table></div>
      <AcademicPagination meta={data.pagination?.asignaciones} visibleCount={assignments.length} loading={isFetching}
        onPageChange={setAssignmentPage} onPerPageChange={changeAssignmentSize} />
      </KTCardBody>
    </KTCard>}
    {reportsOnly && data.can_view_reports && <KTCard>
      <div className='card-header gap-3'><h3 className='card-title'>{t('boletines.title')}</h3>
        <div className='card-toolbar report-catalog-toolbar d-flex flex-wrap align-items-center justify-content-end gap-3'>
          {showReportFilters && <div className='report-catalog-filters d-flex flex-wrap align-items-center gap-3' data-testid='report-catalog-filters'>{catalogFilters}</div>}
          {reportActions && <div className='report-catalog-actions'>{typeof reportActions === 'function' ? reportActions({year: selectedYear, group: hasReportGroup ? group : ''}) : reportActions}</div>}
        </div>
      </div>
      <KTCardBody>
        {!hasReportGroup ? <div className='alert alert-warning text-warning-emphasis mb-0 rounded-4' role='status'>{t('boletines.workspace.groupFirst')}</div> : <>
        <div className='table-responsive' aria-busy={isFetching}><table className='table report-roster-table table-row-dashed align-middle gy-4'>
          <thead><tr className='text-muted fw-bold'><th className='w-40px'>#</th><th>{t('evaluacion.matriculas.estudiante')}</th><th>{t('evaluacion.matriculas.grupo')}</th><th className='text-end'><span className='d-none d-sm-inline'>{t('boletines.title')}</span><span className='d-sm-none'>{t('evaluacion.catalogo.acciones')}</span></th></tr></thead>
          <tbody>{enrollments.map((m, index) => <tr key={m.id}>
            <td className='text-muted'>{enrollmentOffset + index + 1}</td><td className='fw-semibold'>{m.nombre_lista ?? m.estudiante.name}</td><td>{m.grupo?.grado.nombre} / {m.grupo?.nombre}</td>
            <td className='text-end'><div className='d-flex flex-wrap justify-content-end gap-2'>
              {canRecover && m.tiene_resultados_reprobados && <button className='btn btn-light-info btn-sm report-student-action' disabled={!m.url_token}
                aria-label={t('evaluacion.recuperaciones.title')} title={t('evaluacion.recuperaciones.title')}
                onClick={() => navigate(`/evaluacion/recuperaciones/${m.url_token}?desde=boletines`)}><i className='bi bi-arrow-repeat d-sm-none' aria-hidden='true' /><span className='d-none d-sm-inline'>{t('evaluacion.recuperaciones.title')}</span></button>}
              {data.can_view_reports && <button className='btn btn-light-primary btn-sm report-student-action' disabled={!m.url_token}
                aria-label={t('evaluacion.matriculas.ver_boletin')} title={t('evaluacion.matriculas.ver_boletin')} onClick={() => navigate(`/academico/boletines/${m.url_token}`)}><i className='bi bi-file-earmark-text d-sm-none' aria-hidden='true' /><span className='d-none d-sm-inline'>{t('evaluacion.matriculas.ver_boletin')}</span></button>}
            </div></td>
          </tr>)}
          {!enrollments.length && <tr><td colSpan={4} className='text-muted text-center py-8'>{t('evaluacion.matriculas.empty')}</td></tr>}
          </tbody>
        </table></div>
        </>}
      </KTCardBody>
    </KTCard>}
    {reportsOnly && !data.can_view_reports && <div className='alert alert-info'>{t('boletines.restricted')}</div>}
  </div>
}
