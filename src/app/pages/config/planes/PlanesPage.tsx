import {FC, useState} from 'react'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {planes as planesMock, featureLabel} from './planes.mock'
import {Plan, PlanPeriod} from './planes.types'
import {PlanFormDialog} from './components/PlanFormDialog'
import {DeletePlanDialog} from './components/DeletePlanDialog'

const configBreadCrumbs: Array<PageLink> = [
  {
    title: 'Configuracion',
    path: '/configuracion/planes',
    isSeparator: false,
    isActive: false,
  },
]

// Sufijo del precio segun periodicidad (solo diseno).
const PERIOD_SUFFIX: Record<PlanPeriod, string> = {
  mensual: '/mes',
  anual: '/anual',
}

// Formatea el precio en pesos colombianos (sin decimales).
const formatPrice = (value: number): string => `$${value.toLocaleString('es-CO')}`

const PlanesPage: FC = () => {
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState<Plan | null>(null)

  return (
    <>
      <PageTitle breadcrumbs={configBreadCrumbs}>Planes</PageTitle>
      <Content>
        {/* begin::Cabecera */}
        <div className='d-flex flex-wrap align-items-center justify-content-between gap-3 mb-6'>
          <div className='d-flex flex-column'>
            <h3 className='fw-bold text-gray-900 mb-1'>Planes</h3>
            <span className='text-muted fs-7'>
              Crea y configura los planes de membresia y sus features
            </span>
          </div>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => setShowCreate(true)}
          >
            <i className='ki-duotone ki-plus fs-2'></i>
            Nuevo plan
          </button>
        </div>
        {/* end::Cabecera */}

        {/* begin::Grid de planes (col-md-4, se apila en movil) */}
        <div className='row g-6 g-xl-9'>
          {planesMock.map((plan) => (
            <div className='col-md-6 col-lg-4' key={plan.id}>
              {/* begin::Card plan */}
              <div className='card h-100'>
                <div className='card-body d-flex flex-column p-9'>
                  {/* Nombre + estado */}
                  <div className='d-flex align-items-center justify-content-between mb-3'>
                    <h2 className='fw-bold text-gray-900 mb-0'>{plan.name}</h2>
                    <span
                      className={
                        plan.active
                          ? 'badge badge-light-success'
                          : 'badge badge-light-secondary'
                      }
                    >
                      {plan.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Precio grande + /mes */}
                  <div className='d-flex align-items-baseline mb-4'>
                    {plan.price !== null ? (
                      <>
                        <span className='fs-3x fw-bold text-gray-900'>
                          {formatPrice(plan.price)}
                        </span>
                        <span className='fs-6 fw-semibold text-muted ms-2'>
                          {PERIOD_SUFFIX[plan.period]}
                        </span>
                      </>
                    ) : (
                      <span className='fs-4 fw-semibold text-muted'>Precio por definir</span>
                    )}
                  </div>

                  {/* Descripcion */}
                  <p className='text-muted fs-6 mb-2'>{plan.description}</p>

                  <div className='separator separator-dashed my-5'></div>

                  {/* Features con check-circle */}
                  <div className='mb-8 flex-grow-1'>
                    <div className='text-muted fw-semibold fs-7 text-uppercase mb-4'>
                      {plan.features.length} features incluidas
                    </div>
                    {plan.features.map((key) => (
                      <div className='d-flex align-items-center mb-4' key={key}>
                        <i className='ki-duotone ki-check-circle fs-3 text-success me-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <span className='fw-semibold text-gray-700 fs-6'>
                          {featureLabel(key)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Acciones: Editar + Eliminar */}
                  <div className='d-flex gap-3'>
                    <button
                      type='button'
                      className='btn btn-light-primary flex-grow-1'
                      onClick={() => setEditing(plan)}
                    >
                      <i className='ki-duotone ki-pencil fs-4'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                      </i>
                      Editar
                    </button>
                    <button
                      type='button'
                      className='btn btn-icon btn-light-danger'
                      title='Eliminar plan'
                      onClick={() => setDeleting(plan)}
                    >
                      <i className='ki-duotone ki-trash fs-4'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                        <span className='path3'></span>
                        <span className='path4'></span>
                        <span className='path5'></span>
                      </i>
                    </button>
                  </div>
                </div>
              </div>
              {/* end::Card plan */}
            </div>
          ))}
        </div>
        {/* end::Grid de planes */}
      </Content>

      {/* Modales (solo UI: abren/cierran, sin submit real) */}
      <PlanFormDialog show={showCreate} plan={null} onClose={() => setShowCreate(false)} />
      <PlanFormDialog
        show={editing !== null}
        plan={editing}
        onClose={() => setEditing(null)}
      />
      <DeletePlanDialog
        show={deleting !== null}
        plan={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

export default PlanesPage
