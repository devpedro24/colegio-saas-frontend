import {useParams, useNavigate, Navigate} from 'react-router-dom'
import {useBoletin} from '../boletines.api'
import {useCatalogoEvaluacion} from '../../evaluacion/evaluacion.api'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import type {BoletinData, BoletinPeriodoResult} from '../boletines.types'
import {useIntl} from 'react-intl'
import '../boletines.css'
import {gradeDecimal} from '../../evaluacion/gradeDecimal'
import {VisualChoice} from '../../evaluacion/components/VisualChoice'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {BulletinObservationCard} from './BulletinObservationCard'
import {BulletinIssueCard} from './BulletinIssueCard'

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
  const {hasPermission} = useAuthz()
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
  const visual = boletin.escala_visual?.tipo === 'imagenes'
  const weightedAreas = boletin.configuracion.usar_areas && boletin.configuracion.modo_area === 'WEIGHTED_AVERAGE'
  const periodHeading = (period: BoletinData['periodos'][number]) =>
    `${period.nombre}${period.peso == null ? '' : ` · ${Number(period.peso)} %`}`
  const renderValue = (result?: Omit<BoletinPeriodoResult, 'periodo_id'>) => {
    if (visual) return result?.valoracion ? <VisualChoice compact choice={result.valoracion} /> : '—'
    if (!result?.display_value) return '—'
    return <span className={`badge ${result.aprobado ? 'badge-light-success' : 'badge-light-danger'}`}>
      {gradeDecimal(result.display_value)}
      {result.origen === 'recuperacion' && <span className='ms-1' title={t('boletines.recovered')} aria-label={t('boletines.recovered')}>↗</span>}
    </span>
  }

  return (<>
    <KTCard className='grade-report'>
      <div className='card-header border-0 pt-5'>
        <h3 className='card-title align-items-start flex-column'>
          <span className='card-label fw-bold fs-3 mb-1'>
            {t('boletines.title')} · {t('boletines.preview')}
          </span>
          <span className='text-muted mt-1 fw-semibold fs-7'>
            {t('boletines.institucion')} {boletin.institucion} ·{' '}
            {boletin.estudiante?.nombre_lista ?? boletin.estudiante?.name} · {boletin.grado} / {boletin.grupo} ({boletin.ano})
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
                        {periodHeading(p)}
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
                            {renderValue(res)}
                          </td>
                        )
                      })}
                      {mostrarFinal && (
                        <td className='text-center fw-bold'>
                          {renderValue(area.anual)}
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
                      {periodHeading(p)}
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
                      {weightedAreas && asig.peso_area != null && (
                        <span className='text-muted fs-8 ms-2'>({asig.peso_area}%)</span>
                      )}
                    </td>
                    {boletin.periodos.map((p) => {
                      const res = asig.periodos.find((ap) => ap.periodo_id === p.id)
                      return (
                        <td key={p.id} className='text-center'>
                          {renderValue(res)}
                        </td>
                      )
                    })}
                    {mostrarFinal && (
                      <td className='text-center fw-bold'>
                        {renderValue(asig.anual)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {!!boletin.indicadores?.length && <section className='mt-8'>
          <h4 className='fw-bold mb-2'>{t('indicators.title')}</h4>
          <p className='text-muted fs-7'>{t('indicators.noGradeEffect')}</p>
          {boletin.periodos.map(period => {
            const rows = boletin.indicadores?.filter(item => item.periodo_id === period.id) ?? []
            if (!rows.length) return null
            return <div key={period.id} className='mb-6'>
              <h5 className='fw-semibold mb-3'>{period.nombre}</h5>
              <div className='table-responsive'><table className='table table-bordered align-middle gs-3 gy-3'>
                <thead><tr className='fw-bold bg-light'><th>{t('boletines.asignaturas')}</th><th>{t('indicators.newText')}</th></tr></thead>
                <tbody>{rows.map((item, index) => <tr key={`${item.materia_id}:${index}`}>
                  <td>{item.materia}</td><td>{item.texto}</td>
                </tr>)}</tbody>
              </table></div>
            </div>
          })}
        </section>}
      </KTCardBody>
    </KTCard>
    {(hasPermission('boletines.observaciones.gestionar') || hasPermission('boletines.observaciones.aprobar'))
      && <BulletinObservationCard matriculaToken={matriculaId} />}
    <BulletinIssueCard matriculaToken={matriculaId} periods={boletin.periodos} />
  </>)
}
