import {useEffect, useState} from 'react'
import {useParams, useNavigate, Navigate} from 'react-router-dom'
import {useCatalogoEvaluacion, usePlanilla, useGuardarNotas, useGuardarComponente, useGuardarActividad} from '../evaluacion.api'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import type {NotaUpdate, ComponenteEvaluacion} from '../evaluacion.types'

export const PlanillaView = () => {
  const {asignacionId, periodoId} = useParams()
  const intl = useIntl()
  const catalog = useCatalogoEvaluacion()
  if (catalog.isLoading) return <div className='text-muted p-5' role='status'>{intl.formatMessage({id: 'siee.cargando'})}</div>
  if (catalog.error || !catalog.data) return <div className='alert alert-danger' role='alert'>{catalog.error?.message || intl.formatMessage({id: 'common.error'})}</div>

  const assignment = catalog.data.asignaciones.find(item => item.url_token === asignacionId || String(item.id) === asignacionId)
  const period = catalog.data.periodos.find(item => item.url_token === periodoId || String(item.id) === periodoId)
  if (!assignment || !period || assignment.ano_lectivo_id !== period.ano_lectivo_id) {
    return <div className='alert alert-danger' role='alert'>{intl.formatMessage({id: 'common.error'})}</div>
  }
  if (asignacionId !== assignment.url_token || periodoId !== period.url_token) {
    return <Navigate to={`/academico/evaluacion/planillas/${assignment.url_token}/${period.url_token}`} replace />
  }
  return <PlanillaEditor key={`${assignment.id}:${period.id}`} asignacionId={assignment.id} periodoId={period.id} />
}

const PlanillaEditor = ({asignacionId, periodoId}: {asignacionId: number; periodoId: number}) => {
  const intl = useIntl()
  const toast = useToast()
  const navigate = useNavigate()
  const {data, isLoading, error} = usePlanilla(asignacionId, periodoId)
  const notasMutation = useGuardarNotas(Number(asignacionId), Number(periodoId))
  const componenteMutation = useGuardarComponente(Number(asignacionId), Number(periodoId))
  const actividadMutation = useGuardarActividad(Number(asignacionId), Number(periodoId))

  const [draftNotas, setDraftNotas] = useState<Record<string, Omit<NotaUpdate, 'motivo'>>>({})
  const [motivo, setMotivo] = useState('')
  const [showComponenteForm, setShowComponenteForm] = useState(false)
  const [showActividadForm, setShowActividadForm] = useState<number | null>(null)
  const [componenteForm, setComponenteForm] = useState<{nombre: string; peso: string; modo: ComponenteEvaluacion['modo']}>({nombre: '', peso: '', modo: 'SIMPLE_AVERAGE'})
  const [actividadForm, setActividadForm] = useState({nombre: '', fecha: '', peso: ''})

  const dirty = Object.keys(draftNotas).length > 0
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  if (isLoading) return <div className='text-muted p-5' role='status'>{intl.formatMessage({id: 'siee.cargando'})}</div>
  if (error || !data) return <div className='alert alert-danger' role='alert'>{error?.message || intl.formatMessage({id: 'common.error'})}</div>

  const handleNotaChange = (actividadId: number, matriculaId: number, value: string) => {
    const key = `${actividadId}-${matriculaId}`
    const current = data.calificaciones.find(c => c.actividad_id === actividadId && c.matricula_id === matriculaId)
    setDraftNotas(prev => ({...prev, [key]: {
      actividad_id: actividadId, matricula_id: matriculaId, valor: value === '' ? null : value,
      version: prev[key]?.version ?? current?.version ?? 0,
      observacion: current?.observacion ?? null,
    }}))
  }

  const handleSave = () => {
    const notasToUpdate: NotaUpdate[] = Object.values(draftNotas).map(row => ({...row, motivo: motivo.trim()}))
    if (notasToUpdate.length > 0) {
      notasMutation.mutate(notasToUpdate, {
        onSuccess: () => {
          toast.success(intl.formatMessage({id: 'evaluacion.planilla.saved'}))
          setDraftNotas({})
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

  const handleCrearComponente = () => {
    componenteMutation.mutate(
      {
        asignacion_id: Number(asignacionId),
        periodo_id: Number(periodoId),
        nombre: componenteForm.nombre,
        peso: componenteForm.peso ? Number(componenteForm.peso) : null,
        modo: componenteForm.modo,
      },
      {
        onSuccess: () => {
          toast.success(intl.formatMessage({id: 'evaluacion.planilla.btn_crear'}))
          setShowComponenteForm(false)
          setComponenteForm({nombre: '', peso: '', modo: 'SIMPLE_AVERAGE'})
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleCrearActividad = (componenteId: number) => {
    actividadMutation.mutate(
      {
        componente_id: componenteId,
        nombre: actividadForm.nombre,
        fecha: actividadForm.fecha,
        peso: actividadForm.peso ? Number(actividadForm.peso) : null,
      },
      {
        onSuccess: () => {
          toast.success(intl.formatMessage({id: 'evaluacion.planilla.btn_crear'}))
          setShowActividadForm(null)
          setActividadForm({nombre: '', fecha: '', peso: ''})
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const actividades = data.componentes.flatMap((c) => c.actividades || [])

  return (
    <div className='row g-5'>
      {data.editable && (
        <div className='col-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title'>
                <span className='card-label fw-bold fs-3'>{intl.formatMessage({id: 'evaluacion.planilla.componentes_title'})}</span>
              </h3>
              <div className='card-toolbar'>
                <button
                  className='btn btn-sm btn-primary'
                  onClick={() => setShowComponenteForm(!showComponenteForm)}
                >
                  {intl.formatMessage({id: 'evaluacion.planilla.btn_componente'})}
                </button>
              </div>
            </div>
            <KTCardBody>
              {showComponenteForm && (
                <div className='row g-3 mb-5 p-4 bg-light rounded'>
                  <div className='col-md-3'>
                    <input
                      className='form-control form-control-sm'
                      placeholder={intl.formatMessage({id: 'evaluacion.planilla.nombre_placeholder'})}
                      value={componenteForm.nombre}
                      onChange={(e) => setComponenteForm((p) => ({...p, nombre: e.target.value}))}
                    />
                  </div>
                  <div className='col-md-2'>
                    <input
                      className='form-control form-control-sm'
                      placeholder={intl.formatMessage({id: 'evaluacion.planilla.peso'})}
                      type='number'
                      value={componenteForm.peso}
                      onChange={(e) => setComponenteForm((p) => ({...p, peso: e.target.value}))}
                    />
                  </div>
                  <div className='col-md-3'>
                    <select
                      className='form-select form-select-sm'
                      value={componenteForm.modo}
                      onChange={(e) => setComponenteForm((p) => ({...p, modo: e.target.value as ComponenteEvaluacion['modo']}))}
                    >
                      <option value='SIMPLE_AVERAGE'>{intl.formatMessage({id: 'evaluacion.planilla.promedio_simple'})}</option>
                      <option value='WEIGHTED_AVERAGE'>{intl.formatMessage({id: 'evaluacion.planilla.promedio_ponderado'})}</option>
                    </select>
                  </div>
                  <div className='col-md-2'>
                    <button className='btn btn-sm btn-success w-100' disabled={componenteMutation.isPending || !componenteForm.nombre.trim()} onClick={handleCrearComponente}>
                      {intl.formatMessage({id: 'evaluacion.planilla.btn_crear'})}
                    </button>
                  </div>
                </div>
              )}
              {data.componentes.map((comp) => (
                <div key={comp.id} className='mb-4'>
                  <div className='d-flex justify-content-between align-items-center mb-2'>
                    <span className='fw-bold'>
                      {comp.nombre} {comp.peso != null && <span className='text-muted'>({comp.peso}%)</span>}
                      <span className='badge badge-light-info ms-2'>{intl.formatMessage({id: comp.modo === 'SIMPLE_AVERAGE' ? 'evaluacion.planilla.promedio_simple' : 'evaluacion.planilla.promedio_ponderado'})}</span>
                    </span>
                    <button
                      className='btn btn-sm btn-light'
                      onClick={() => setShowActividadForm(showActividadForm === comp.id ? null : comp.id)}
                    >
                      {intl.formatMessage({id: 'evaluacion.planilla.btn_actividad'})}
                    </button>
                  </div>
                  {showActividadForm === comp.id && (
                    <div className='row g-3 mb-3 p-3 bg-light-warning rounded'>
                      <div className='col-md-3'>
                        <input
                          className='form-control form-control-sm'
                          placeholder={intl.formatMessage({id: 'evaluacion.planilla.nombre_actividad'})}
                          value={actividadForm.nombre}
                          onChange={(e) => setActividadForm((p) => ({...p, nombre: e.target.value}))}
                        />
                      </div>
                      <div className='col-md-3'>
                        <input
                          className='form-control form-control-sm'
                          type='date'
                          value={actividadForm.fecha}
                          onChange={(e) => setActividadForm((p) => ({...p, fecha: e.target.value}))}
                        />
                      </div>
                      <div className='col-md-2'>
                        <input
                          className='form-control form-control-sm'
                          placeholder={intl.formatMessage({id: 'evaluacion.planilla.peso'})}
                          type='number'
                          value={actividadForm.peso}
                          onChange={(e) => setActividadForm((p) => ({...p, peso: e.target.value}))}
                        />
                      </div>
                      <div className='col-md-2'>
                        <button
                          className='btn btn-sm btn-success w-100'
                          onClick={() => handleCrearActividad(comp.id)}
                          disabled={actividadMutation.isPending || !actividadForm.nombre.trim() || !actividadForm.fecha}
                        >
                          {intl.formatMessage({id: 'evaluacion.planilla.btn_crear'})}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className='ms-4'>
                    {comp.actividades?.map((act) => (
                      <span key={act.id} className='badge badge-light me-2 mb-1'>
                        {act.nombre} {act.peso != null && `(${act.peso}%)`}
                      </span>
                    ))}
                    {(!comp.actividades || comp.actividades.length === 0) && (
                      <span className='text-muted fs-8'>{intl.formatMessage({id: 'evaluacion.planilla.sin_actividades'})}</span>
                    )}
                  </div>
                </div>
              ))}
              {data.componentes.length === 0 && (
                <div className='text-muted text-center py-5'>
                  {intl.formatMessage({id: 'evaluacion.planilla.no_componentes'})}
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      )}

      <div className='col-12'>
        <KTCard>
          <div className='card-header border-0 pt-5'>
            <h3 className='card-title align-items-start flex-column'>
              <span className='card-label fw-bold fs-3 mb-1'>{intl.formatMessage({id: 'evaluacion.planilla.title'})}</span>
              <span className='text-muted mt-1 fw-semibold fs-7'>
                {data.editable ? intl.formatMessage({id: 'evaluacion.planilla.estado_abierto'}) : intl.formatMessage({id: 'evaluacion.planilla.estado_cerrado'})}
              </span>
            </h3>
            <div className='card-toolbar'>
              <button className='btn btn-light me-3' onClick={() => {if (!dirty || window.confirm(intl.formatMessage({id: 'evaluacion.planilla.unsaved'}))) navigate('/academico/evaluacion/catalogo')}}>
                {intl.formatMessage({id: 'evaluacion.planilla.volver'})}
              </button>
              {data.editable && (
                <button
                  className='btn btn-primary'
                  onClick={handleSave}
                  disabled={!dirty || motivo.trim().length < 3 || notasMutation.isPending}
                >
                  {notasMutation.isPending ? intl.formatMessage({id: 'evaluacion.planilla.guardando'}) : `${intl.formatMessage({id: 'evaluacion.planilla.guardar'})} (${Object.keys(draftNotas).length})`}
                </button>
              )}
            </div>
          </div>
          <KTCardBody className='py-3'>
            {data.editable && <label className='form-label w-100 mb-5'>{intl.formatMessage({id: 'evaluacion.planilla.motivo'})}<input className='form-control mt-2' value={motivo} maxLength={500} onChange={e => setMotivo(e.target.value)} /></label>}
            {data.resultados.some(r => r.estado === 'pendiente') && <div className='alert alert-info'>{intl.formatMessage({id: 'evaluacion.planilla.pendingHelp'})}</div>}
            {actividades.length === 0 ? (
              <div className='text-muted text-center py-8'>
                {intl.formatMessage({id: 'evaluacion.planilla.no_actividades_calificar'})}
              </div>
            ) : (
              <div className='table-responsive'>
                <table className='table table-bordered table-row-dashed table-row-gray-300 align-middle gs-0 gy-3'>
                  <thead>
                    <tr className='fw-bold bg-light'>
                      <th className='min-w-200px' rowSpan={2}>
                        {intl.formatMessage({id: 'evaluacion.matriculas.estudiante'})}
                      </th>
                      {data.componentes.filter(comp => comp.actividades?.length).map((comp) => (
                        <th
                          key={comp.id}
                          colSpan={comp.actividades?.length || 1}
                          className='text-center border-start'
                        >
                          {comp.nombre} {comp.peso != null && `(${comp.peso}%)`}
                        </th>
                      ))}
                      <th className='min-w-80px text-center border-start' rowSpan={2}>
                        {intl.formatMessage({id: 'evaluacion.planilla.definitiva'})}
                      </th>
                    </tr>
                    <tr className='fw-bold bg-light'>
                      {data.componentes.map((comp) =>
                        comp.actividades?.map((act) => (
                          <th key={act.id} className='min-w-80px text-center fs-8'>
                            {act.nombre}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.matriculas.map((mat) => {
                      const resultado = data.resultados.find((r) => r.matricula_id === mat.id)
                      return (
                        <tr key={mat.id}>
                          <td className='fw-semibold'>{mat.estudiante.name}</td>
                          {actividades.map((act) => {
                            const currentGrade = data.calificaciones.find(
                              (c) => c.actividad_id === act.id && c.matricula_id === mat.id
                            )
                            const draftKey = `${act.id}-${mat.id}`
                            const draft = draftNotas[draftKey]
                            const draftValue = draft ? draft.valor ?? '' : undefined
                            const displayValue =
                              draftValue !== undefined
                                ? draftValue
                                : currentGrade?.valor != null
                                  ? String(currentGrade.valor)
                                  : ''

                            return (
                              <td key={act.id} className='text-center p-1'>
                                {data.editable ? (
                                  <input
                                    type='number'
                                    step='any'
                                    min={data.configuracion.valor_min}
                                    max={data.configuracion.valor_max}
                                    disabled={notasMutation.isPending}
                                    aria-label={`${mat.estudiante.name} · ${act.nombre}`}
                                    className={`form-control form-control-sm text-center ${
                                      draftValue !== undefined ? 'bg-light-warning' : ''
                                    }`}
                                    value={displayValue}
                                    onChange={(e) => handleNotaChange(act.id, mat.id, e.target.value)}
                                  />
                                ) : (
                                  <span>{currentGrade?.valor ?? '—'}</span>
                                )}
                              </td>
                            )
                          })}
                          <td className='text-center fw-bold'>
                            {resultado?.display_value ? (
                              <span
                                className={`badge ${
                                  resultado.aprobado ? 'badge-light-success' : 'badge-light-danger'
                                }`}
                              >
                                {resultado.display_value}
                              </span>
                            ) : (
                              <span className='text-muted' title={resultado?.motivo}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </KTCardBody>
        </KTCard>
      </div>
    </div>
  )
}
