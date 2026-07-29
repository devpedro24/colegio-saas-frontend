import {FC, useMemo, useState} from 'react'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {colegios as colegiosMock} from './colegios.mock'
import {Colegio, ColegioPlan, ColegioStatus} from './colegios.types'
import {CreateColegioDialog} from './components/CreateColegioDialog'
import {EditColegioDialog} from './components/EditColegioDialog'
import {RectorPasswordDialog} from './components/RectorPasswordDialog'
import {DeleteColegioDialog} from './components/DeleteColegioDialog'

const configBreadCrumbs: Array<PageLink> = [
  {
    title: 'Configuracion',
    path: '/configuracion/colegios',
    isSeparator: false,
    isActive: false,
  },
]

// Estado del colegio -> etiqueta + clase de badge (solo diseno). Espeja el STATUS_META
// del feature original (active=success, configuring=warning, provisioning=secondary,
// suspended=danger).
const STATUS_BADGE: Record<ColegioStatus, {label: string; className: string}> = {
  active: {label: 'Activo', className: 'badge badge-light-success'},
  configuring: {label: 'Configurando', className: 'badge badge-light-warning'},
  provisioning: {label: 'Aprovisionando', className: 'badge badge-light-secondary'},
  suspended: {label: 'Suspendido', className: 'badge badge-light-danger'},
}

// Plan -> etiqueta + clase de badge (solo diseno).
const PLAN_BADGE: Record<ColegioPlan, {label: string; className: string}> = {
  esencial: {label: 'Esencial', className: 'badge badge-light-primary'},
  estandar: {label: 'Estandar', className: 'badge badge-light-info'},
  premium: {label: 'Premium', className: 'badge badge-light-dark'},
}

const ColegiosPage: FC = () => {
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Colegio | null>(null)
  const [pwdColegio, setPwdColegio] = useState<Colegio | null>(null)
  const [deleting, setDeleting] = useState<Colegio | null>(null)

  // Switch Habilitar/Inhabilitar por colegio (solo UI). Inhabilitado = suspendido.
  const [enabled, setEnabled] = useState<Record<number, boolean>>(() =>
    colegiosMock.reduce((acc, c) => {
      acc[c.id] = c.status !== 'suspended'
      return acc
    }, {} as Record<number, boolean>)
  )

  // Busqueda local por nombre.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return colegiosMock
    return colegiosMock.filter((c) => c.name.toLowerCase().includes(q))
  }, [search])

  const toggleEnabled = (id: number) =>
    setEnabled((prev) => ({...prev, [id]: !prev[id]}))

  return (
    <>
      <PageTitle breadcrumbs={configBreadCrumbs}>Colegios</PageTitle>
      <Content>
        {/* begin::Card */}
        <div className='card'>
          {/* begin::Card header */}
          <div className='card-header border-0 pt-6'>
            {/* begin::Card title */}
            <div className='card-title flex-column align-items-start'>
              <h3 className='fw-bold mb-1'>Colegios</h3>
              <span className='text-muted fs-7'>
                Instituciones registradas en la plataforma
              </span>
            </div>
            {/* end::Card title */}

            {/* begin::Card toolbar */}
            <div className='card-toolbar flex-wrap gap-3'>
              {/* begin::Search */}
              <div className='d-flex align-items-center position-relative'>
                <i className='ki-duotone ki-magnifier fs-3 position-absolute ms-4'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
                <input
                  type='text'
                  className='form-control form-control-solid w-250px ps-12'
                  placeholder='Buscar colegio'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* end::Search */}

              {/* begin::New */}
              <button
                type='button'
                className='btn btn-primary'
                onClick={() => setShowCreate(true)}
              >
                <i className='ki-duotone ki-plus fs-2'></i>
                Nuevo colegio
              </button>
              {/* end::New */}
            </div>
            {/* end::Card toolbar */}
          </div>
          {/* end::Card header */}

          {/* begin::Card body */}
          <div className='card-body py-4'>
            {/* begin::Table responsive */}
            <div className='table-responsive'>
              <table className='table table-row-dashed align-middle gs-0 gy-4'>
                {/* begin::Head */}
                <thead>
                  <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                    <th className='min-w-250px'>Nombre</th>
                    <th className='min-w-175px'>Subdominio</th>
                    <th className='min-w-100px'>Plan</th>
                    <th className='min-w-125px'>Estado</th>
                    <th className='min-w-200px text-end'>Acciones</th>
                  </tr>
                </thead>
                {/* end::Head */}
                {/* begin::Body */}
                <tbody className='text-gray-600 fw-semibold'>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      {/* Nombre + rector */}
                      <td>
                        <div className='d-flex flex-column'>
                          <span className='text-gray-800 fw-bold'>{c.name}</span>
                          <span className='text-muted fs-7'>{c.rector.name}</span>
                        </div>
                      </td>
                      {/* Subdominio */}
                      <td>
                        <span className='text-gray-700'>{c.subdomain}</span>
                        <span className='text-muted'>.midominio.com</span>
                      </td>
                      {/* Plan */}
                      <td>
                        <span className={PLAN_BADGE[c.plan].className}>
                          {PLAN_BADGE[c.plan].label}
                        </span>
                      </td>
                      {/* Estado */}
                      <td>
                        <span className={STATUS_BADGE[c.status].className}>
                          {STATUS_BADGE[c.status].label}
                        </span>
                      </td>
                      {/* Acciones */}
                      <td>
                        <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                          {/* Editar */}
                          <button
                            type='button'
                            className='btn btn-icon btn-light-primary btn-sm me-2'
                            title='Editar colegio'
                            onClick={() => setEditing(c)}
                          >
                            <i className='ki-duotone ki-pencil fs-5'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                            </i>
                          </button>
                          {/* Contrasena rector */}
                          <button
                            type='button'
                            className='btn btn-icon btn-light btn-sm me-2'
                            title='Contrasena del rector'
                            onClick={() => setPwdColegio(c)}
                          >
                            <i className='ki-duotone ki-key fs-5'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                            </i>
                          </button>
                          {/* Eliminar */}
                          <button
                            type='button'
                            className='btn btn-icon btn-light-danger btn-sm me-4'
                            title='Eliminar colegio'
                            onClick={() => setDeleting(c)}
                          >
                            <i className='ki-duotone ki-trash fs-5'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                              <span className='path3'></span>
                              <span className='path4'></span>
                              <span className='path5'></span>
                            </i>
                          </button>
                          {/* Habilitar / Inhabilitar */}
                          <div className='form-check form-switch form-check-solid'>
                            <input
                              className='form-check-input'
                              type='checkbox'
                              checked={!!enabled[c.id]}
                              onChange={() => toggleEnabled(c.id)}
                              title={enabled[c.id] ? 'Inhabilitar' : 'Habilitar'}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className='text-center text-muted py-10'>
                        No se encontraron colegios.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* end::Body */}
              </table>
            </div>
            {/* end::Table responsive */}
          </div>
          {/* end::Card body */}
        </div>
        {/* end::Card */}
      </Content>

      {/* Modales (solo UI: abren/cierran, sin submit real) */}
      <CreateColegioDialog show={showCreate} onClose={() => setShowCreate(false)} />
      <EditColegioDialog
        show={editing !== null}
        colegio={editing}
        onClose={() => setEditing(null)}
      />
      <RectorPasswordDialog
        show={pwdColegio !== null}
        colegio={pwdColegio}
        onClose={() => setPwdColegio(null)}
      />
      <DeleteColegioDialog
        show={deleting !== null}
        colegio={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

export default ColegiosPage
