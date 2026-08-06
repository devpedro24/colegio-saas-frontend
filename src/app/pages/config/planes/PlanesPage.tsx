import {FC, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {usePlanes} from './planes.api'
import {Plan, PlanLimit} from './planes.types'
import {PlanFormDialog} from './components/PlanFormDialog'

// Formatea un precio (string numerico del backend) en pesos colombianos.
const formatPrice = (value: string | null): string | null =>
  value == null ? null : `$${Number(value).toLocaleString('es-CO')}`

const PlanesPage: FC = () => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)

  const configBreadCrumbs: Array<PageLink> = [
    {
      title: t('config.breadcrumb'),
      path: '/configuracion/planes',
      isSeparator: false,
      isActive: false,
    },
  ]

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)

  const {data, isLoading, isError} = usePlanes()
  const planes = data?.data ?? []
  const limits = data?.catalog.limits ?? []

  // key de feature -> id i18n de su label (el backend manda el id en catalog.features).
  const featureLabelId = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of data?.catalog.features ?? []) map.set(f.key, f.label)
    return map
  }, [data?.catalog.features])

  const featureLabel = (key: string): string => {
    const id = featureLabelId.get(key)
    return id ? intl.formatMessage({id}) : key
  }

  // Valor de un limite del plan: numero formateado o "Ilimitado" (null).
  const limitValue = (plan: Plan, key: PlanLimit['key']): string => {
    const v = plan[key]
    return v == null ? t('common.unlimited') : v.toLocaleString('es-CO')
  }

  return (
    <>
      <PageTitle breadcrumbs={configBreadCrumbs}>{t('common.plans')}</PageTitle>
      <Content>
        {/* begin::Cabecera */}
        <div className='d-flex flex-wrap align-items-center justify-content-between gap-3 mb-6'>
          <div className='d-flex flex-column'>
            <h3 className='fw-bold text-gray-900 mb-1'>{t('common.plans')}</h3>
            <span className='text-muted fs-7'>{t('planes.subtitle')}</span>
          </div>
          <button type='button' className='btn btn-primary' onClick={() => setShowCreate(true)}>
            <i className='ki-duotone ki-plus fs-2'></i>
            {t('planes.new')}
          </button>
        </div>
        {/* end::Cabecera */}

        {/* Loading */}
        {isLoading && (
          <div className='d-flex justify-content-center align-items-center py-20'>
            <span className='spinner-border text-primary me-3' role='status'></span>
            <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.plan'})})}</span>
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className='alert alert-danger d-flex align-items-center'>
            <i className='ki-duotone ki-information fs-2 text-danger me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.plan'})})}</span>
          </div>
        )}

        {/* begin::Grid de planes */}
        {!isLoading && !isError && (
          <div className='row g-6 g-xl-9'>
            {planes.length === 0 && (
              <div className='col-12'>
                <div className='text-center text-muted py-20'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.plan'})})}</div>
              </div>
            )}
            {planes.map((plan) => {
              const monthly = formatPrice(plan.price_monthly)
              const annual = formatPrice(plan.price_annual)
              return (
                <div className='col-md-6 col-lg-4' key={plan.id}>
                  {/* begin::Card plan */}
                  <div className='card h-100'>
                    <div className='card-body d-flex flex-column p-9'>
                      {/* Nombre + estado */}
                      <div className='d-flex align-items-center justify-content-between mb-3'>
                        <h2 className='fw-bold text-gray-900 mb-0'>{plan.name}</h2>
                        <span
                          className={
                            plan.is_active
                              ? 'badge badge-light-success'
                              : 'badge badge-light-secondary'
                          }
                        >
                          {plan.is_active ? t('common.active') : t('common.inactive')}
                        </span>
                      </div>

                      {/* Precio mensual grande + anual */}
                      <div className='mb-4'>
                        {monthly ? (
                          <div className='d-flex align-items-baseline'>
                            <span className='fs-3x fw-bold text-gray-900'>{monthly}</span>
                            <span className='fs-6 fw-semibold text-muted ms-2'>
                              {t('planes.perMonth')}
                            </span>
                          </div>
                        ) : (
                          <span className='fs-4 fw-semibold text-muted'>{t('planes.priceTbd')}</span>
                        )}
                        {annual && (
                          <div className='fs-7 fw-semibold text-muted mt-1'>
                            {annual} {t('planes.perYear')}
                          </div>
                        )}
                      </div>

                      {/* Descripcion */}
                      {plan.description && (
                        <p className='text-muted fs-6 mb-2'>{plan.description}</p>
                      )}

                      <div className='separator separator-dashed my-5'></div>

                      {/* Limites */}
                      <div className='row g-3 mb-6'>
                        {limits.map((l) => (
                          <div className='col-6' key={l.key}>
                            <div className='text-muted fs-8 text-uppercase'>
                              {t(l.label)}
                            </div>
                            <div className='fw-bold text-gray-800 fs-6'>
                              {limitValue(plan, l.key)}
                              {l.unit && plan[l.key] != null ? ` ${t(l.unit)}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Features con check-circle */}
                      <div className='mb-8 flex-grow-1'>
                        <div className='text-muted fw-semibold fs-7 text-uppercase mb-4'>
                          {t('planes.featuresCount', {count: plan.features.length})}
                        </div>
                        {plan.features.map((key) => (
                          <div className='d-flex align-items-center mb-4' key={key}>
                            <i className='ki-duotone ki-check-circle fs-3 text-success me-3'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                            </i>
                            <span className='fw-semibold text-gray-700 fs-6'>{featureLabel(key)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Accion: Editar (los planes no se eliminan en el backend) */}
                      <button
                        type='button'
                        className='btn btn-light-primary w-100'
                        onClick={() => setEditing(plan)}
                      >
                        <i className='ki-duotone ki-pencil fs-4'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        {intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.plan'})})}
                      </button>
                    </div>
                  </div>
                  {/* end::Card plan */}
                </div>
              )
            })}
          </div>
        )}
        {/* end::Grid de planes */}
      </Content>

      {/* Modales conectados al backend real */}
      <PlanFormDialog show={showCreate} plan={null} onClose={() => setShowCreate(false)} />
      <PlanFormDialog show={editing !== null} plan={editing} onClose={() => setEditing(null)} />
    </>
  )
}

export default PlanesPage
