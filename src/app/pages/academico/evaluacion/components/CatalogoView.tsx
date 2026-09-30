import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useCatalogoEvaluacion, useMatricular} from '../evaluacion.api'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import {useToast} from '@/lib/ui/toast'
import {AcademicPagination} from '@/app/shared/components/AcademicPagination'
import {usePageSize} from '@/app/shared/hooks/usePageSize'
import {AcademicOptionSelect} from '../../shared/AcademicOptionSelect'

export const CatalogoView = ({reportsOnly = false}: {reportsOnly?: boolean}) => {
  const navigate = useNavigate()
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const [year, setYear] = useState('')
  const [period, setPeriod] = useState('')
  const [form, setForm] = useState({grupo_id: '', estudiante_id: ''})
  const [group, setGroup] = useState('')
  const [materia, setMateria] = useState('')
  const [status, setStatus] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('')
  const [assignmentPage, setAssignmentPage] = useState(1)
  const [enrollmentPage, setEnrollmentPage] = useState(1)
  const [assignmentPerPage, setAssignmentPerPage] = usePageSize('evaluacion-asignaciones')
  const [enrollmentPerPage, setEnrollmentPerPage] = usePageSize('evaluacion-matriculas')
  const {data, isLoading, error, isFetching} = useCatalogoEvaluacion({
    yearId: year, groupId: group, materiaId: materia, enrollmentStatus: status,
    studentSearch: debouncedStudentSearch,
    assignmentPage, assignmentPerPage, enrollmentPage, enrollmentPerPage,
  })
  const mutation = useMatricular()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedStudentSearch(studentSearch.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [studentSearch])

  useEffect(() => {
    if (!year && data?.anos.length) {
      setYear((data.anos.find(ano => ano.estado === 'en_curso') ?? data.anos[0]).url_token)
    }
  }, [data?.anos, year])

  const resetPages = () => {setAssignmentPage(1); setEnrollmentPage(1)}
  const changeAssignmentSize = (size: number) => {setAssignmentPerPage(size); setAssignmentPage(1)}
  const changeEnrollmentSize = (size: number) => {setEnrollmentPerPage(size); setEnrollmentPage(1)}

  if (isLoading) return <div className='card card-body' role='status'>{t('common.loading')}</div>
  if (error || !data) return <div className='alert alert-danger' role='alert'>{error?.message || t('common.error')}</div>
  if (!year && data.anos.length > 0) return <div className='card card-body' role='status'>{t('common.loading')}</div>
  const selectedYear = year || (data.anos.find(a => a.estado === 'en_curso') ?? data.anos[0])?.url_token || ''
  const periods = data.periodos.filter(p => p.ano_lectivo_id === selectedYear)
  const selectedPeriod = periods.some(p => p.url_token === period) ? period : (periods.find(p => p.estado === 'abierto') ?? periods[0])?.url_token ?? ''
  const selectedPeriodToken = selectedPeriod
  const assignments = data.asignaciones
  const enrollments = data.matriculas
  const groups = data.grupos.filter(g => g.ano_lectivo_id === selectedYear)
  const students = data.estudiantes_disponibles ?? data.estudiantes.filter(student => !enrollments.some(enrollment => enrollment.estudiante_id === student.id))
  const studentMatches = studentSearch.trim() && !form.estudiante_id
    ? students.filter(student => student.name.toLocaleLowerCase().includes(studentSearch.trim().toLocaleLowerCase())).slice(0, 8)
    : []

  return <div className='d-flex flex-column gap-6'>
    <div className='card'><div className='card-body d-flex flex-wrap align-items-end justify-content-between gap-4 py-6'>
      <div><h3>{t(reportsOnly ? 'boletines.title' : 'evaluacion.title')}</h3><p className='text-muted mb-0'>{t('evaluacion.catalogo.desc')}</p></div>
      <div className='d-flex flex-wrap gap-3'>
        <select className='form-select form-select-solid w-auto' aria-label={t('academico.config.yearLabel')} value={selectedYear} onChange={e => {setYear(e.target.value); setPeriod(''); setGroup(''); setMateria(''); setForm({grupo_id: '', estudiante_id: ''}); setStudentSearch(''); setDebouncedStudentSearch(''); resetPages()}}>
          {!data.anos.length && <option value=''>{t('academico.config.yearLabel')}</option>}
          {data.anos.map(a => <option key={a.url_token} value={a.url_token}>{a.nombre}</option>)}
        </select>
        {!reportsOnly && <select className='form-select form-select-solid w-auto' aria-label={t('evaluacion.period')} value={selectedPeriod} onChange={e => setPeriod(e.target.value)}>
          {!periods.length && <option value=''>{t('evaluacion.period')}</option>}
          {periods.map(p => <option key={p.url_token} value={p.url_token}>{p.nombre} · {t(`academico.periodos.estado.${p.estado}`)}</option>)}
        </select>}
      </div>
    </div></div>
    <div className='card'><div className='card-body row g-3 align-items-end'>
      <div className='col-12 col-sm-6 col-lg-3'>
        <AcademicOptionSelect tipo='grupos' yearId={selectedYear} label={t('evaluacion.matriculas.grupo')} opaque
          value={group} onChange={value => {setGroup(value); resetPages()}} initialOptions={groups}
          emptyLabel={t('academic.filter.selectGroup')} selectOnly hideLabel
          formatOption={option => `${option.grado?.nombre ?? ''} / ${option.nombre ?? ''}`} />
      </div>
      {!reportsOnly && <div className='col-12 col-sm-6 col-lg-3'>
        <AcademicOptionSelect tipo='materias' yearId={selectedYear} label={t('siee.materia')} opaque
          value={materia} onChange={value => {setMateria(value); setAssignmentPage(1)}}
          initialOptions={data.materias ?? []} emptyLabel={t('academic.filter.selectSubject')} selectOnly hideLabel />
      </div>}
      {data.can_view_reports && <div className='col-12 col-sm-6 col-lg-3'>
        <select id='evaluacion-status' aria-label={t('evaluacion.matriculas.estado')} className='form-select form-select-solid' value={status}
          onChange={event => {setStatus(event.target.value); setEnrollmentPage(1)}}>
          <option value=''>{t('academic.filter.selectStatus')}</option>
          <option value='activa'>{t('evaluacion.matriculas.estado.activa')}</option>
          <option value='retirada'>{t('evaluacion.matriculas.estado.retirada')}</option>
        </select>
      </div>}
      <div className='col-12 col-sm-6 col-lg-3'>
        <button type='button' className='btn btn-sm btn-light w-100' onClick={() => {
          setGroup(''); setMateria(''); setStatus(''); resetPages()
        }}>{t('audit.clear')}</button>
      </div>
    </div></div>
    {!reportsOnly && <KTCard>
      <div className='card-header'><h3 className='card-title'>{t('evaluacion.mis_asignaciones')}</h3>
        {data.can_configure && <div className='card-toolbar'><button className='btn btn-light-primary btn-sm' onClick={() => navigate('/academico/siee')}>{t('siee.title')}</button></div>}
      </div>
      <KTCardBody><div className='table-responsive' aria-busy={isFetching}><table className='table table-row-dashed align-middle gy-4'>
        <thead><tr className='text-muted fw-bold'><th>{t('siee.materia')}</th><th>{t('evaluacion.matriculas.grupo')}</th><th className='text-end'>{t('evaluacion.catalogo.acciones')}</th></tr></thead>
        <tbody>{assignments.map(a => <tr key={a.id}>
          <td className='fw-semibold'>{a.materia.nombre}</td><td>{a.grupo.grado.nombre} / {a.grupo.nombre}</td>
          <td className='text-end'><button className='btn btn-light-primary btn-sm' disabled={!selectedPeriodToken || !a.url_token} onClick={() => navigate(`/academico/evaluacion/planillas/${a.url_token}/${selectedPeriodToken}`)}>{t('evaluacion.catalogo.ver_planilla')}</button></td>
        </tr>)}
        {!assignments.length && <tr><td colSpan={3} className='text-center text-muted py-8'>{t('evaluacion.catalogo.no_asignaturas')}</td></tr>}
        </tbody>
      </table></div>
      <AcademicPagination meta={data.pagination?.asignaciones} visibleCount={assignments.length} loading={isFetching}
        onPageChange={setAssignmentPage} onPerPageChange={changeAssignmentSize} />
      </KTCardBody>
    </KTCard>}
    {data.can_view_reports && <KTCard>
      <div className='card-header'><h3 className='card-title'>{t(data.can_manage ? 'evaluacion.matriculas.title' : 'boletines.title')}</h3></div>
      <KTCardBody>
        {data.can_manage && !reportsOnly && <form className='row g-4 align-items-end mb-6' onSubmit={e => {
          e.preventDefault()
          mutation.mutate({grupo_id: form.grupo_id, estudiante_id: form.estudiante_id}, {
            onSuccess: () => {toast.success(t('evaluacion.matriculas.saved')); setForm({grupo_id: '', estudiante_id: ''}); setStudentSearch(''); setDebouncedStudentSearch(''); setEnrollmentPage(1)},
            onError: err => toast.error(err.message),
          })
        }}>
          <div className='col-12 col-md-3'><AcademicOptionSelect tipo='grupos' yearId={selectedYear} opaque
            label={t('evaluacion.matriculas.grupo')} value={form.grupo_id}
            onChange={value => setForm(previous => ({...previous, grupo_id: value}))}
            initialOptions={groups} emptyLabel={t('academic.filter.selectGroup')} required selectOnly hideLabel
            formatOption={option => `${option.grado?.nombre ?? ''} / ${option.nombre ?? ''}`} /></div>
          <div className='col-12 col-md-6 position-relative'>
            <input className={`form-control ${form.estudiante_id ? 'border-success' : ''}`} type='search' maxLength={120}
              role='combobox' aria-label={t('evaluacion.matriculas.estudiante')}
              aria-autocomplete='list' aria-controls='evaluacion-estudiantes-resultados'
              aria-expanded={studentMatches.length > 0} autoComplete='off'
              placeholder={intl.formatMessage({id: 'common.search'}, {name: t('evaluacion.matriculas.estudiante').toLowerCase()})}
              value={studentSearch} onChange={event => {setStudentSearch(event.target.value); setForm(current => ({...current, estudiante_id: ''}))}}
              onKeyDown={event => {
                if (event.key === 'Enter' && studentMatches.length) {
                  event.preventDefault()
                  const student = studentMatches[0]
                  setForm(current => ({...current, estudiante_id: String(student.id)}))
                  setStudentSearch(student.name)
                }
              }} />
            {studentMatches.length > 0 && <div id='evaluacion-estudiantes-resultados' role='listbox' className='position-absolute start-0 end-0 bg-white border rounded shadow-sm mt-1 z-index-3'>
              {studentMatches.map(student => <button key={student.id} type='button' role='option' aria-selected={false}
                className='btn btn-light w-100 text-start rounded-0' onClick={() => {
                  setForm(current => ({...current, estudiante_id: String(student.id)}))
                  setStudentSearch(student.name)
                }}>{student.name}</button>)}
            </div>}
          </div>
          <div className='col-12 col-md-3'><button className='btn btn-primary w-100' disabled={mutation.isPending || !form.grupo_id || !form.estudiante_id}>{t(mutation.isPending ? 'evaluacion.matriculas.btn_matriculando' : 'evaluacion.matriculas.btn_matricular')}</button></div>
        </form>}
        <div className='table-responsive' aria-busy={isFetching}><table className='table table-row-dashed align-middle gy-4'>
          <thead><tr className='text-muted fw-bold'><th>{t('evaluacion.matriculas.estudiante')}</th><th>{t('evaluacion.matriculas.grupo')}</th><th>{t('evaluacion.matriculas.estado')}</th><th className='text-end'>{t('boletines.title')}</th></tr></thead>
          <tbody>{enrollments.map(m => <tr key={m.id}>
            <td className='fw-semibold'>{m.estudiante.name}</td><td>{m.grupo?.grado.nombre} / {m.grupo?.nombre}</td><td><span className='badge badge-light-success'>{t(`evaluacion.matriculas.estado.${m.estado}`)}</span></td>
            <td className='text-end'><button className='btn btn-light-primary btn-sm' disabled={!m.url_token} onClick={() => navigate(`/academico/boletines/${m.url_token}`)}>{t('evaluacion.matriculas.ver_boletin')}</button></td>
          </tr>)}
          {!enrollments.length && <tr><td colSpan={4} className='text-muted text-center py-8'>{t('evaluacion.matriculas.empty')}</td></tr>}
          </tbody>
        </table></div>
        <AcademicPagination meta={data.pagination?.matriculas} visibleCount={enrollments.length} loading={isFetching}
          onPageChange={setEnrollmentPage} onPerPageChange={changeEnrollmentSize} />
      </KTCardBody>
    </KTCard>}
    {reportsOnly && !data.can_view_reports && <div className='alert alert-info'>{t('boletines.restricted')}</div>}
  </div>
}
