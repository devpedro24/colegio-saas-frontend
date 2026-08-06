import {FC} from 'react'
import {useIntl} from 'react-intl'
import {Link, Navigate, useParams} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {useImpersonation} from '../../../modules/impersonation/impersonation.store'
import {useAuthz} from '../../../modules/auth/core/authz'
import {sedeSubdomainUrl, useSede} from '../estructura/estructura.api'

const tenantStatusBadge = (status: string | null): {cls: string; label: string} => {
  switch (status) {
    case 'active':
      return {cls: 'badge badge-light-success', label: 'common.active'}
    case 'in_retention':
      return {cls: 'badge badge-light-warning', label: 'academico.estructura.sede.tenantStatus.cuarentena'}
    default:
      return {cls: 'badge badge-light-secondary', label: 'common.inactive'}
  }
}

// Pagina propia de una sede (/academico/sedes/:id). Muestra los datos de la sede, su state
// de tenant hijo (subdominio, coordinador, tenant id) y permite abrir el subdominio en otra
// pestaña. Los modulos de la estructura se habilitaran proximamente.
const SedeDetallePage: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {id} = useParams<{id: string}>()
  const {activeColegio} = useImpersonation()
  const {isPlatform} = useAuthz()
  const {data: sedeWrap, isLoading, isError} = useSede(id)
  const sede = (sedeWrap as any)?.data

  // Mismo gating que el resto del modulo Academico.
  if (isPlatform && !activeColegio) {
    return <Navigate to='/academico/anos-lectivos' replace />
  }

  const breadcrumbs: Array<PageLink> = [
    {
      title: t('academico.title'),
      path: '/academico',
      isSeparator: false,
      isActive: false,
    },
    {
      title: t('academico.config.title'),
      path: '/academico/configuracion?tab=sedes',
      isSeparator: false,
      isActive: false,
    },
  ]

  const canOpen = !!sede?.tenant_domain && sede.tenant_status === 'active'

  const openCampus = () => {
    if (sede?.tenant_domain) {
      window.open(sedeSubdomainUrl(sede.tenant_domain), '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>
        {sede?.nombre ?? t('academico.sede.detail.title')}
      </PageTitle>
      <Content>
        <div className='d-flex align-items-center justify-content-between mb-6'>
          <div>
            <h3 className='fw-bold mb-1'>{t('academico.sede.detail.title')}</h3>
            <span className='text-muted fs-7'>{t('academico.sede.detail.subtitle')}</span>
          </div>
          <div className='d-flex align-items-center gap-2'>
            <button
              type='button'
              className={`btn btn-primary btn-sm${canOpen ? '' : ' disabled'}`}
              disabled={!canOpen}
              title={canOpen ? undefined : t('academico.sede.detail.openDisabled')}
              onClick={openCampus}
            >
              <i className='ki-duotone ki-exit-right-corner fs-3 me-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              {t('academico.sede.open')}
            </button>
            <Link to='/academico/configuracion?tab=sedes' className='btn btn-light btn-sm'>
              <i className='ki-duotone ki-arrow-left fs-3 me-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              {t('academico.sede.detail.back')}
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className='card'>
            <div className='card-body d-flex justify-content-center align-items-center py-15'>
              <span className='spinner-border text-primary me-3' role='status'></span>
              <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.sede'})})}</span>
            </div>
          </div>
        )}

        {isError && !isLoading && (
          <div className='card'>
            <div className='card-body py-10'>
              <div className='alert alert-danger d-flex align-items-center mb-0'>
                <i className='ki-duotone ki-information fs-2 text-danger me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <span>{t('academico.sede.detail.notFound')}</span>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !isError && sede && (
          <>
            <div className='card mb-6'>
              <div className='card-header border-0 pt-6'>
                <div className='card-title flex-column align-items-start'>
                  <div className='d-flex align-items-center gap-3'>
                    <h3 className='fw-bold mb-0'>{sede.nombre}</h3>
                    {sede.es_principal && (
                      <span className='badge badge-light-primary'>
                        {t('colegios.sedes.principal')}
                      </span>
                    )}
                    <span
                      className={
                        sede.estado === 'activa'
                          ? 'badge badge-light-success'
                          : 'badge badge-light-secondary'
                      }
                    >
                      {t(
                        sede.estado === 'activa'
                          ? 'common.active'
                          : 'common.inactive'
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className='card-body pt-4'>
                <div className='row g-6'>
                  <div className='col-md-4'>
                    <div className='fs-8 fw-semibold text-muted text-uppercase mb-1'>
                      {t('common.address')}
                    </div>
                    <div className='text-gray-800 fw-semibold'>{sede.direccion ?? '—'}</div>
                  </div>
                  <div className='col-md-4'>
                    <div className='fs-8 fw-semibold text-muted text-uppercase mb-1'>
                      {t('common.phone')}
                    </div>
                    <div className='text-gray-800 fw-semibold'>{sede.telefono ?? '—'}</div>
                  </div>
                  <div className='col-md-4'>
                    <div className='fs-8 fw-semibold text-muted text-uppercase mb-1'>
                      {t('academico.sede.detail.coordinador')}
                    </div>
                    <div className='text-gray-800 fw-semibold'>
                      {sede.coordinador_name ? `${sede.coordinador_name} Â· ${sede.coordinador_email}` : (sede.coordinador_email ?? '—')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!sede.es_principal && (
              <div className='card mb-6'>
                <div className='card-header border-0 pt-6'>
                  <div className='card-title flex-column align-items-start'>
                    <h3 className='fw-bold mb-1'>{t('academico.sede.detail.tenant')}</h3>
                    <span className='text-muted fs-7'>{t('academico.estructura.sede.tenantInfo')}</span>
                  </div>
                </div>
                <div className='card-body pt-4'>
                  <div className='row g-6'>
                    <div className='col-md-4'>
                      <div className='fs-8 fw-semibold text-muted text-uppercase mb-1'>
                        {t('common.subdomain')}
                      </div>
                      <div className='text-gray-800 fw-semibold'>{sede.tenant_domain ?? '—'}</div>
                    </div>
                    <div className='col-md-4'>
                      <div className='fs-8 fw-semibold text-muted text-uppercase mb-1'>
                        {t('common.status')}
                      </div>
                      {(() => {
                        const badge = tenantStatusBadge(sede.tenant_status)
                        return <span className={badge.cls}>{t(badge.label)}</span>
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className='card'>
              <div className='card-header border-0 pt-6'>
                <div className='card-title flex-column align-items-start'>
                  <h3 className='fw-bold mb-1'>{t('academico.sede.detail.structure')}</h3>
                </div>
              </div>
              <div className='card-body py-10 d-flex flex-column align-items-center text-center'>
                <i className='ki-duotone ki-buildings fs-2tx text-primary mb-4'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <span className='text-muted fs-6 max-w-500px'>
                  {t('academico.sede.detail.placeholder')}
                </span>
              </div>
            </div>
          </>
        )}
      </Content>
    </>
  )
}

export default SedeDetallePage