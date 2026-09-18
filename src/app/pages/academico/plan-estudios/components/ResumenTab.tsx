import {FC, useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {useTenantSync} from '@/app/modules/auth/hooks/useTenantSync'
import {useAnosLectivos} from '../../anos-lectivos/anos-lectivos.api'
import {usePlanEstudiosStore} from '../plan-estudios.store'

// Resumen del plan de estudios para el año lectivo seleccionado: totales y
// cobertura de asignación docente por materia (ayuda a detectar huecos).
const ResumenTab: FC = () => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const {data: anos} = useAnosLectivos()
  const anosList = useMemo(() => anos?.data ?? [], [anos])
  const [anoLectivoId, setAnoLectivoId] = useState('')

  useEffect(() => {
    if (anoLectivoId || anosList.length === 0) return
    const enCurso = anosList.find((a) => a.estado === 'en_curso')
    setAnoLectivoId((enCurso ?? anosList[0]).id)
  }, [anosList, anoLectivoId])

  const {areas, materias, asignaciones, sesiones} = usePlanEstudiosStore()

  const materiasActivas = materias.filter((m) => m.estado === 'activo')
  const areasActivas = areas.filter((a) => a.estado === 'activo')
  const intensidadTotal = materiasActivas.reduce((acc, m) => acc + m.intensidad_horaria, 0)

  const asignacionesDelAno = asignaciones.filter((a) => a.ano_lectivo_id === anoLectivoId)
  const asignacionIdsDelAno = new Set(asignacionesDelAno.map((a) => a.id))
  const sesionesDelAno = sesiones.filter((s) => asignacionIdsDelAno.has(s.asignacion_id))

  const cobertura = materiasActivas.map((m) => {
    const area = areas.find((a) => a.id === m.area_id)
    const asignadas = asignacionesDelAno.filter((a) => a.materia_id === m.id).length
    return {materia: m, areaNombre: area?.nombre ?? '—', asignadas}
  })

  const noYears = anosList.length === 0

  return (
    <>
      <div className='d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-4 mb-6'>
        <div className='d-flex flex-column'>
          <label className='fs-8 fw-semibold text-muted mb-1'>
            {t('academico.planEstudios.resumen.anoLabel')}
          </label>
          <select
            className='form-select form-select-solid w-md-250px'
            value={anoLectivoId}
            disabled={noYears}
            onChange={(e) => setAnoLectivoId(e.target.value)}
          >
            {anosList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
            {noYears && <option value=''>—</option>}
          </select>
        </div>
      </div>

      {noYears && (
        <div className='alert alert-warning d-flex align-items-center'>
          <i className='ki-duotone ki-information fs-2 text-warning me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{t('academico.planEstudios.resumen.noYears')}</span>
        </div>
      )}

      {!noYears && (
        <>
          <div className='row g-4 mb-8'>
            {[
              {label: t('academico.planEstudios.resumen.areas'), value: areasActivas.length},
              {label: t('academico.planEstudios.resumen.materias'), value: materiasActivas.length},
              {label: t('academico.planEstudios.resumen.intensidad'), value: intensidadTotal},
              {label: t('academico.planEstudios.resumen.asignaciones'), value: asignacionesDelAno.length},
              {label: t('academico.planEstudios.resumen.sesiones'), value: sesionesDelAno.length},
            ].map((card) => (
              <div className='col-6 col-md-4 col-lg' key={card.label}>
                <div className='card card-flush h-100'>
                  <div className='card-body text-center py-6'>
                    <div className='fs-2 fw-bold text-gray-900'>{card.value}</div>
                    <div className='text-muted fs-7'>{card.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h4 className='fw-bold mb-4'>{t('academico.planEstudios.resumen.cobertura.title')}</h4>
          <div className='table-responsive'>
            <table className='table table-row-dashed align-middle gs-0 gy-4'>
              <thead>
                <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                  <th className='min-w-150px'>{t('academico.planEstudios.resumen.cobertura.materia')}</th>
                  <th className='min-w-150px'>{t('academico.planEstudios.resumen.cobertura.area')}</th>
                  <th className='min-w-100px'>{t('academico.planEstudios.resumen.cobertura.intensidad')}</th>
                  <th className='min-w-120px'>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className='text-gray-600 fw-semibold'>
                {cobertura.map(({materia, areaNombre, asignadas}) => (
                  <tr key={materia.id}>
                    <td className='text-gray-800 fw-bold'>{materia.nombre}</td>
                    <td>{areaNombre}</td>
                    <td>{materia.intensidad_horaria}</td>
                    <td>
                      <span className={asignadas > 0 ? 'badge badge-light-success' : 'badge badge-light-warning'}>
                        {asignadas > 0
                          ? t('academico.planEstudios.resumen.cobertura.asignada')
                          : t('academico.planEstudios.resumen.cobertura.sinAsignar')}
                      </span>
                    </td>
                  </tr>
                ))}
                {cobertura.length === 0 && (
                  <tr>
                    <td colSpan={4} className='text-center text-muted py-10'>
                      {t('common.empty', {name: intl.formatMessage({id: 'entity.materia'})})}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

export {ResumenTab}
