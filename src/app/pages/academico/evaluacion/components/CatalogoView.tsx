import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useCatalogoEvaluacion, useMatricular} from '../evaluacion.api'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import {useToast} from '@/lib/ui/toast'

export const CatalogoView = ({reportsOnly = false}: {reportsOnly?: boolean}) => {
  const navigate = useNavigate()
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, error} = useCatalogoEvaluacion()
  const mutation = useMatricular()
  const [year, setYear] = useState('')
  const [period, setPeriod] = useState('')
  const [form, setForm] = useState({grupo_id: '', estudiante_id: ''})

  if (isLoading) return <div className='card card-body' role='status'>{t('common.loading')}</div>
  if (error || !data) return <div className='alert alert-danger' role='alert'>{error?.message || t('common.error')}</div>
  const selectedYear = year || String((data.anos.find(a => a.estado === 'en_curso') ?? data.anos[0])?.id ?? '')
  const periods = data.periodos.filter(p => String(p.ano_lectivo_id) === selectedYear)
  const selectedPeriod = periods.some(p => String(p.id) === period) ? period : String((periods.find(p => p.estado === 'abierto') ?? periods[0])?.id ?? '')
  const selectedPeriodToken = periods.find(p => String(p.id) === selectedPeriod)?.url_token
  const assignments = data.asignaciones.filter(a => String(a.ano_lectivo_id) === selectedYear)
  const enrollments = data.matriculas.filter(m => String(m.ano_lectivo_id) === selectedYear)
  const groups = data.grupos.filter(g => String(g.ano_lectivo_id) === selectedYear)
  const students = data.estudiantes.filter(s => !enrollments.some(m => m.estudiante_id === s.id))

  return <div className='d-flex flex-column gap-6'>
    <div className='card'><div className='card-body d-flex flex-wrap align-items-end justify-content-between gap-4 py-6'>
      <div><h3>{t(reportsOnly ? 'boletines.title' : 'evaluacion.title')}</h3><p className='text-muted mb-0'>{t('evaluacion.catalogo.desc')}</p></div>
      <div className='d-flex flex-wrap gap-3'>
        <label className='form-label mb-0'>{t('academico.config.yearLabel')}
          <select className='form-select form-select-solid mt-2' value={selectedYear} onChange={e => {setYear(e.target.value); setPeriod(''); setForm({grupo_id: '', estudiante_id: ''})}}>
            {!data.anos.length && <option value=''>—</option>}
            {data.anos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        {!reportsOnly && <label className='form-label mb-0'>{t('evaluacion.period')}
          <select className='form-select form-select-solid mt-2' value={selectedPeriod} onChange={e => setPeriod(e.target.value)}>
            {!periods.length && <option value=''>—</option>}
            {periods.map(p => <option key={p.id} value={p.id}>{p.nombre} · {t(`academico.periodos.estado.${p.estado}`)}</option>)}
          </select>
        </label>}
      </div>
    </div></div>
    {!reportsOnly && <KTCard>
      <div className='card-header'><h3 className='card-title'>{t('evaluacion.mis_asignaciones')}</h3>
        {data.can_configure && <div className='card-toolbar'><button className='btn btn-light-primary btn-sm' onClick={() => navigate('/academico/siee')}>{t('siee.title')}</button></div>}
      </div>
      <KTCardBody><div className='table-responsive'><table className='table table-row-dashed align-middle gy-4'>
        <thead><tr className='text-muted fw-bold'><th>{t('siee.materia')}</th><th>{t('evaluacion.matriculas.grupo')}</th><th className='text-end'>{t('evaluacion.catalogo.acciones')}</th></tr></thead>
        <tbody>{assignments.map(a => <tr key={a.id}>
          <td className='fw-semibold'>{a.materia.nombre}</td><td>{a.grupo.grado.nombre} / {a.grupo.nombre}</td>
          <td className='text-end'><button className='btn btn-light-primary btn-sm' disabled={!selectedPeriodToken || !a.url_token} onClick={() => navigate(`/academico/evaluacion/planillas/${a.url_token}/${selectedPeriodToken}`)}>{t('evaluacion.catalogo.ver_planilla')}</button></td>
        </tr>)}
        {!assignments.length && <tr><td colSpan={3} className='text-center text-muted py-8'>{t('evaluacion.catalogo.no_asignaturas')}</td></tr>}
        </tbody>
      </table></div></KTCardBody>
    </KTCard>}
    {data.can_view_reports && <KTCard>
      <div className='card-header'><h3 className='card-title'>{t(data.can_manage ? 'evaluacion.matriculas.title' : 'boletines.title')}</h3></div>
      <KTCardBody>
        {data.can_manage && !reportsOnly && <form className='row g-4 align-items-end mb-6' onSubmit={e => {
          e.preventDefault()
          mutation.mutate({grupo_id: Number(form.grupo_id), estudiante_id: Number(form.estudiante_id)}, {
            onSuccess: () => {toast.success(t('evaluacion.matriculas.saved')); setForm({grupo_id: '', estudiante_id: ''})},
            onError: err => toast.error(err.message),
          })
        }}>
          <div className='col-md-4'><label className='form-label w-100'>{t('evaluacion.matriculas.grupo')}
            <select required className='form-select mt-2' value={form.grupo_id} onChange={e => setForm({...form, grupo_id: e.target.value})}>
              <option value=''>{t('evaluacion.matriculas.select_grupo')}</option>{groups.map(g => <option key={g.id} value={g.id}>{g.grado.nombre} / {g.nombre}</option>)}
            </select>
          </label></div>
          <div className='col-md-4'><label className='form-label w-100'>{t('evaluacion.matriculas.estudiante')}
            <select required className='form-select mt-2' value={form.estudiante_id} onChange={e => setForm({...form, estudiante_id: e.target.value})}>
              <option value=''>{t('evaluacion.matriculas.select_estudiante')}</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label></div>
          <div className='col-md-4'><button className='btn btn-primary mb-2 w-100' disabled={mutation.isPending || !form.grupo_id || !form.estudiante_id}>{t(mutation.isPending ? 'evaluacion.matriculas.btn_matriculando' : 'evaluacion.matriculas.btn_matricular')}</button></div>
        </form>}
        <div className='table-responsive'><table className='table table-row-dashed align-middle gy-4'>
          <thead><tr className='text-muted fw-bold'><th>{t('evaluacion.matriculas.estudiante')}</th><th>{t('evaluacion.matriculas.grupo')}</th><th>{t('evaluacion.matriculas.estado')}</th><th className='text-end'>{t('boletines.title')}</th></tr></thead>
          <tbody>{enrollments.map(m => <tr key={m.id}>
            <td className='fw-semibold'>{m.estudiante.name}</td><td>{m.grupo?.grado.nombre} / {m.grupo?.nombre}</td><td><span className='badge badge-light-success'>{t(`evaluacion.matriculas.estado.${m.estado}`)}</span></td>
            <td className='text-end'><button className='btn btn-light-primary btn-sm' disabled={!m.url_token} onClick={() => navigate(`/academico/boletines/${m.url_token}`)}>{t('evaluacion.matriculas.ver_boletin')}</button></td>
          </tr>)}
          {!enrollments.length && <tr><td colSpan={4} className='text-muted text-center py-8'>{t('evaluacion.matriculas.empty')}</td></tr>}
          </tbody>
        </table></div>
      </KTCardBody>
    </KTCard>}
    {reportsOnly && !data.can_view_reports && <div className='alert alert-info'>{t('boletines.restricted')}</div>}
  </div>
}
