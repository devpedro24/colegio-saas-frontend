import {FC} from 'react'
import {useIntl} from 'react-intl'
import {Link, Navigate, useParams} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {useImpersonation} from '../../../modules/impersonation/impersonation.store'
import {useSede} from '../estructura/estructura.api'

// Pagina propia de una sede (/academico/sedes/:id). Por ahora muestra los datos de la
// sede; los modulos de la estructura (jornadas, niveles, grados, grupos, bloques,
// espacios) se habilitaran proximamente.
const SedeDetallePage: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {id} = useParams<{id: string}>()
  const {activeColegio} = useImpersonation()
  const {data: sede, isLoading, isError} = useSede(id)

  // Mismo gating que el resto del modulo Academico.
  if (!activeColegio) {
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
          <Link to='/academico/configuracion?tab=sedes' className='btn btn-light btn-sm'>
            <i className='ki-duotone ki-arrow-left fs-3 me-1'>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            {t('academico.sede.detail.back')}
          </Link>
        </div>

        {isLoading && (
          <div className='card'>
            <div className='card-body d-flex justify-content-center align-items-center py-15'>
              <span className='spinner-border text-primary me-3' role='status'></span>
              <span className='text-muted fs-6'>{t('academico.estructura.loading')}</span>
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
                        {t('academico.estructura.sede.principalBadge')}
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
                          ? 'academico.estructura.estado.activa'
                          : 'academico.estructura.estado.inactiva'
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className='card-body pt-4'>
                <div className='row g-6'>
                  <div className='col-md-4'>
                    <div className='fs-8 fw-semibold text-muted text-uppercase mb-1'>
                      {t('academico.estructura.sede.direccion')}
                    </div>
                    <div className='text-gray-800 fw-semibold'>{sede.direccion ?? '—'}</div>
                  </div>
                  <div className='col-md-4'>
                    <div className='fs-8 fw-semibold text-muted text-uppercase mb-1'>
                      {t('academico.estructura.sede.telefono')}
                    </div>
                    <div className='text-gray-800 fw-semibold'>{sede.telefono ?? '—'}</div>
                  </div>
                  <div className='col-md-4'>
                    <div className='fs-8 fw-semibold text-muted text-uppercase mb-1'>
                      {t('academico.estructura.sede.responsable')}
                    </div>
                    <div className='text-gray-800 fw-semibold'>{sede.responsable ?? '—'}</div>
                  </div>
                </div>
              </div>
            </div>

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
