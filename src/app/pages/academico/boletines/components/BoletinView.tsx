import {useParams, useNavigate, Navigate} from 'react-router-dom'
import {useBoletin} from '../boletines.api'
import {useCatalogoEvaluacion} from '../../evaluacion/evaluacion.api'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import type {BoletinData} from '../boletines.types'
import {useIntl} from 'react-intl'
import '../boletines.css'
import {gradeDecimal} from '../../evaluacion/gradeDecimal'

export const BoletinView = () => {
  const {matriculaId} = useParams()
  const intl = useIntl()
  const catalog = useCatalogoEvaluacion({enrollmentToken: matriculaId})
  if (catalog.isLoading) return <div className='card card-body text-muted p-6' role='status'>{intl.formatMessage({id: 'boletines.generando'})}</div>
  if (catalog.error || !catalog.data) return <div className='alert alert-danger' role='alert'>{catalog.error?.message || intl.formatMessage({id: 'common.error'})}</div>

  const enrollment = catalog.data.selected_matricula ?? catalog.data.matriculas.find(item => item.url_token === matriculaId)
  if (!enrollment) return <div className='alert alert-danger' role='alert'>{intl.formatMessage({id: 'common.error'})}</div>
  if (matriculaId !== enrollment.url_token) return <Navigate to={`/academico/boletines/${enrollment.url_token}`} replace />
  return <BoletinContent key={enrollment.url_token} matriculaId={enrollment.url_token} />
}

const BoletinContent = ({matriculaId}: {matriculaId: string}) => {
  const navigate = useNavigate()
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})

  const {data, isLoading, isError, error} = useBoletin(matriculaId)

  if (isLoading) {
    return (
      <div className='card'>
        <div className='card-body text-muted p-6'>
          {t('boletines.generando')}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className='alert alert-danger'>
        {error?.message || t('common.error')}
      </div>
    )
  }

  const boletin = data as BoletinData
  const mostrarFinal = !!boletin.periodo_sumatorio || boletin.configuracion?.mostrar_final !== false
  const etiquetaFinal = boletin.periodo_sumatorio?.nombre ?? boletin.configuracion.etiqueta_final
  const tituloFinal = boletin.periodo_sumatorio ? t('boletines.sumatorioHelp') : undefined

  return (
    <KTCard className='grade-report'>
      <div className='card-header border-0 pt-5'>
        <h3 className='card-title align-items-start flex-column'>
          <span className='card-label fw-bold fs-3 mb-1'>
            {t('boletines.title')} · {t('boletines.preview')}
          </span>
          <span className='text-muted mt-1 fw-semibold fs-7'>
            {t('boletines.institucion')} {boletin.institucion} ·{' '}
            {boletin.estudiante?.name} · {boletin.grado} / {boletin.grupo} ({boletin.ano})
          </span>
        </h3>
        <div className='card-toolbar d-flex gap-2 d-print-none'>
          <button
            type='button'
            className='btn btn-sm btn-light'
            onClick={() => navigate('/academico/boletines')}
          >
            {t('evaluacion.planilla.volver')}
          </button>
          <button
            type='button'
            className='btn btn-sm btn-primary'
            onClick={() => window.print()}
          >
            {t('boletines.imprimir')}
          </button>
        </div>
      </div>
      <KTCardBody className='py-4'>
        <p className='text-muted'>{t('boletines.previewHelp')}</p>
        {boletin.advertencias?.length > 0 && (
          <div className='alert alert-warning mb-6'>
            <strong>{t('boletines.advertencias')}</strong>
            <ul className='mb-0 mt-2'>
              {boletin.advertencias.map((adv, idx) => (
                <li key={idx}>{adv}</li>
              ))}
            </ul>
          </div>
        )}

        {boletin.areas?.length > 0 && (
          <div className='mb-8'>
            <h4 className='fw-bold mb-3'>{t('boletines.areas')}</h4>
            <div className='table-responsive'>
              <table className='table table-bordered table-row-dashed align-middle gs-3 gy-3'>
                <thead>
                  <tr className='fw-bold bg-light'>
                    <th className='min-w-200px'>{t('boletines.areas')}</th>
                    {boletin.periodos.map((p) => (
                      <th key={p.id} className='min-w-100px text-center'>
                        {p.nombre}
                      </th>
                    ))}
                    {mostrarFinal && (
                      <th className='min-w-100px text-center' title={tituloFinal}>{etiquetaFinal}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {boletin.areas.map((area) => (
                    <tr key={area.area_id}>
                      <td className='fw-bold'>{area.nombre}</td>
                      {boletin.periodos.map((p) => {
                        const res = area.periodos.find((ap) => ap.periodo_id === p.id)
                        return (
                          <td key={p.id} className='text-center'>
                            {res?.display_value ? (
                              <span
                                className={`badge ${
                                  res.aprobado ? 'badge-light-success' : 'badge-light-danger'
                                }`}
                              >
                                {gradeDecimal(res.display_value)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        )
                      })}
                      {mostrarFinal && (
                        <td className='text-center fw-bold'>
                          {area.anual?.display_value ? (
                            <span
                              className={`badge ${
                                area.anual.aprobado
                                  ? 'badge-light-success'
                                  : 'badge-light-danger'
                              }`}
                            >
                              {gradeDecimal(area.anual.display_value)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <h4 className='fw-bold mb-3'>{t('boletines.asignaturas')}</h4>
          <div className='table-responsive'>
            <table className='table table-bordered table-row-dashed align-middle gs-3 gy-3'>
              <thead>
                <tr className='fw-bold bg-light'>
                  <th className='min-w-200px'>{t('boletines.asignaturas')}</th>
                  {boletin.periodos.map((p) => (
                    <th key={p.id} className='min-w-100px text-center'>
                      {p.nombre}
                    </th>
                  ))}
                  {mostrarFinal && (
                    <th className='min-w-100px text-center' title={tituloFinal}>{etiquetaFinal}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {boletin.asignaturas.map((asig) => (
                  <tr key={asig.materia_id}>
                    <td className='fw-semibold'>
                      {asig.nombre}
                      {asig.peso_area != null && (
                        <span className='text-muted fs-8 ms-2'>({asig.peso_area}%)</span>
                      )}
                    </td>
                    {boletin.periodos.map((p) => {
                      const res = asig.periodos.find((ap) => ap.periodo_id === p.id)
                      return (
                        <td key={p.id} className='text-center'>
                          {res?.display_value ? (
                            <span
                              className={`badge ${
                                res.aprobado ? 'badge-light-success' : 'badge-light-danger'
                              }`}
                            >
                              {gradeDecimal(res.display_value)}
                              {res.origen === 'recuperacion' && <span className='ms-1' title={t('boletines.recovered')} aria-label={t('boletines.recovered')}>↗</span>}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )
                    })}
                    {mostrarFinal && (
                      <td className='text-center fw-bold'>
                        {asig.anual?.display_value ? (
                          <span
                            className={`badge ${
                              asig.anual.aprobado
                                ? 'badge-light-success'
                                : 'badge-light-danger'
                            }`}
                          >
                            {gradeDecimal(asig.anual.display_value)}
                            {asig.anual.origen === 'recuperacion' && <span className='ms-1' title={t('boletines.recovered')} aria-label={t('boletines.recovered')}>↗</span>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </KTCardBody>
    </KTCard>
  )
}
