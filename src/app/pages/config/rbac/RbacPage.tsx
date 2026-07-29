import {FC, useMemo, useState} from 'react'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {
  CELL_META,
  classifyCell,
  FEATURE_LABEL,
  LEVEL_LABEL,
  RBAC_MODULES,
  RBAC_PERMISSIONS,
  RBAC_ROLES,
} from './rbac.mock'
import {CellState, RbacPermission, RbacRole} from './rbac.types'
import {PermissionFormDialog} from './components/PermissionFormDialog'
import {RoleFormDialog} from './components/RoleFormDialog'
import {DeleteRbacDialog} from './components/DeleteRbacDialog'

const configBreadCrumbs: Array<PageLink> = [
  {
    title: 'Configuracion',
    path: '/configuracion/roles-permisos',
    isSeparator: false,
    isActive: false,
  },
]

type TabKey = 'permissions' | 'roles' | 'matrix'

// Candado (ki-lock, 3 paths) reutilizado donde aplica gating por plan.
const LockIcon: FC<{className?: string}> = ({className}) => (
  <i className={`ki-duotone ki-lock ${className ?? ''}`}>
    <span className='path1'></span>
    <span className='path2'></span>
    <span className='path3'></span>
  </i>
)

// Badge de una celda de la matriz segun su estado clasificado.
const CellBadge: FC<{state: CellState}> = ({state}) => {
  if (state.type === 'denied') {
    return <span className='text-muted'>—</span>
  }
  if (state.type === 'structural') {
    return (
      <span
        className={CELL_META.structural.className}
        title={`Estructural · ${LEVEL_LABEL[state.level ?? ''] ?? state.level}`}
      >
        <LockIcon className='fs-7 me-1' />
        {LEVEL_LABEL[state.level ?? ''] ?? state.level}
      </span>
    )
  }
  // configurable: verde si viene por defecto ON, gris si OFF.
  const cls = state.defaultGranted ? 'badge badge-light-success' : 'badge badge-light-secondary'
  return (
    <span className={cls} title={state.defaultGranted ? 'Configurable (por defecto ON)' : 'Configurable (por defecto OFF)'}>
      Config.{state.defaultGranted ? ' ON' : ''}
    </span>
  )
}

const RbacPage: FC = () => {
  const [tab, setTab] = useState<TabKey>('permissions')

  // Modales (solo UI). null = cerrado.
  const [showPermCreate, setShowPermCreate] = useState(false)
  const [editingPerm, setEditingPerm] = useState<RbacPermission | null>(null)
  const [showRoleCreate, setShowRoleCreate] = useState(false)
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null)
  const [deleting, setDeleting] = useState<{entity: 'permiso' | 'rol'; name: string} | null>(null)

  // Agrupa los permisos por modulo (respetando el orden del catalogo) para la matriz.
  const grouped = useMemo(
    () =>
      RBAC_MODULES.map((module) => ({
        module,
        permissions: RBAC_PERMISSIONS.filter((p) => p.module === module),
      })),
    []
  )

  return (
    <>
      <PageTitle breadcrumbs={configBreadCrumbs}>Roles y Permisos</PageTitle>
      <Content>
        {/* begin::Card */}
        <div className='card'>
          {/* begin::Card header */}
          <div className='card-header border-0 pt-6'>
            <div className='card-title flex-column align-items-start'>
              <h3 className='fw-bold mb-1'>Roles y Permisos</h3>
              <span className='text-muted fs-7'>
                Catalogo central de permisos, roles y la matriz que heredan los colegios segun su plan
              </span>
            </div>
          </div>
          {/* end::Card header */}

          {/* begin::Card body */}
          <div className='card-body py-4'>
            {/* begin::Tabs */}
            <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x mb-6 fs-6 fw-bold'>
              <li className='nav-item'>
                <a
                  className={`nav-link cursor-pointer ${tab === 'permissions' ? 'active' : ''}`}
                  onClick={() => setTab('permissions')}
                >
                  Permisos
                </a>
              </li>
              <li className='nav-item'>
                <a
                  className={`nav-link cursor-pointer ${tab === 'roles' ? 'active' : ''}`}
                  onClick={() => setTab('roles')}
                >
                  Roles
                </a>
              </li>
              <li className='nav-item'>
                <a
                  className={`nav-link cursor-pointer ${tab === 'matrix' ? 'active' : ''}`}
                  onClick={() => setTab('matrix')}
                >
                  Matriz
                </a>
              </li>
            </ul>
            {/* end::Tabs */}

            {/* ============================= PERMISOS ============================= */}
            {tab === 'permissions' && (
              <div>
                <div className='d-flex justify-content-end mb-4'>
                  <button type='button' className='btn btn-primary' onClick={() => setShowPermCreate(true)}>
                    <i className='ki-duotone ki-plus fs-2'></i>
                    Nuevo permiso
                  </button>
                </div>
                <div className='table-responsive'>
                  <table className='table table-row-dashed align-middle gs-0 gy-4'>
                    <thead>
                      <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                        <th className='min-w-200px'>Modulo</th>
                        <th className='min-w-250px'>Accion</th>
                        <th className='min-w-200px'>Clave</th>
                        <th className='min-w-150px'>Feature</th>
                        <th className='min-w-125px text-end'>Acciones</th>
                      </tr>
                    </thead>
                    <tbody className='text-gray-600 fw-semibold'>
                      {RBAC_PERMISSIONS.map((p) => (
                        <tr key={p.id}>
                          <td className='text-gray-700'>{p.module}</td>
                          <td className='text-gray-800 fw-bold'>{p.action}</td>
                          <td>
                            <span className='text-muted font-monospace fs-7'>{p.key}</span>
                          </td>
                          <td>
                            {p.featureKey ? (
                              <span className='badge badge-light-info' title='Permiso ligado a una feature de plan (gating)'>
                                <LockIcon className='fs-8 me-1' />
                                {FEATURE_LABEL[p.featureKey] ?? p.featureKey}
                              </span>
                            ) : (
                              <span className='text-muted'>-</span>
                            )}
                          </td>
                          <td>
                            <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                              <button
                                type='button'
                                className='btn btn-icon btn-light-primary btn-sm me-2'
                                title='Editar permiso'
                                onClick={() => setEditingPerm(p)}
                              >
                                <i className='ki-duotone ki-pencil fs-5'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              {p.isSystem ? (
                                <span className='badge badge-light-secondary'>Sistema</span>
                              ) : (
                                <button
                                  type='button'
                                  className='btn btn-icon btn-light-danger btn-sm'
                                  title='Eliminar permiso'
                                  onClick={() => setDeleting({entity: 'permiso', name: p.key})}
                                >
                                  <i className='ki-duotone ki-trash fs-5'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                    <span className='path3'></span>
                                    <span className='path4'></span>
                                    <span className='path5'></span>
                                  </i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================== ROLES ============================== */}
            {tab === 'roles' && (
              <div>
                <div className='d-flex justify-content-end mb-4'>
                  <button type='button' className='btn btn-primary' onClick={() => setShowRoleCreate(true)}>
                    <i className='ki-duotone ki-plus fs-2'></i>
                    Nuevo rol
                  </button>
                </div>
                <div className='table-responsive'>
                  <table className='table table-row-dashed align-middle gs-0 gy-4'>
                    <thead>
                      <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                        <th className='min-w-300px'>Rol</th>
                        <th className='min-w-200px'>Clave</th>
                        <th className='min-w-125px text-end'>Acciones</th>
                      </tr>
                    </thead>
                    <tbody className='text-gray-600 fw-semibold'>
                      {RBAC_ROLES.map((r) => (
                        <tr key={r.id}>
                          <td className='text-gray-800 fw-bold'>{r.label}</td>
                          <td>
                            <span className='text-muted font-monospace fs-7'>{r.key}</span>
                          </td>
                          <td>
                            <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                              <button
                                type='button'
                                className='btn btn-icon btn-light-primary btn-sm me-2'
                                title='Editar rol'
                                onClick={() => setEditingRole(r)}
                              >
                                <i className='ki-duotone ki-pencil fs-5'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              {r.isSystem ? (
                                <span className='badge badge-light-secondary'>Sistema</span>
                              ) : (
                                <button
                                  type='button'
                                  className='btn btn-icon btn-light-danger btn-sm'
                                  title='Eliminar rol'
                                  onClick={() => setDeleting({entity: 'rol', name: r.label})}
                                >
                                  <i className='ki-duotone ki-trash fs-5'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                    <span className='path3'></span>
                                    <span className='path4'></span>
                                    <span className='path5'></span>
                                  </i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================== MATRIZ ============================== */}
            {tab === 'matrix' && (
              <div>
                {/* Leyenda de estados */}
                <div className='d-flex flex-wrap align-items-center gap-4 mb-5'>
                  <span className='text-muted fs-7'>
                    Estado de cada permiso por rol. El superadmin fija cada celda.
                  </span>
                  <span className='d-flex align-items-center gap-2'>
                    <span className='badge badge-light-primary'>
                      <LockIcon className='fs-8 me-1' />
                      Estructural
                    </span>
                    <span className='text-muted fs-8'>fijo (otorgado y bloqueado)</span>
                  </span>
                  <span className='d-flex align-items-center gap-2'>
                    <span className='badge badge-light-success'>Config. ON</span>
                    <span className='badge badge-light-secondary'>Config.</span>
                    <span className='text-muted fs-8'>el colegio lo activa</span>
                  </span>
                  <span className='d-flex align-items-center gap-2'>
                    <span className='text-muted'>—</span>
                    <span className='text-muted fs-8'>denegado</span>
                  </span>
                </div>

                <div className='table-responsive'>
                  <table className='table table-row-bordered table-row-gray-200 align-middle gs-0 gy-3 mb-0'>
                    <thead>
                      <tr className='fw-bold fs-8 text-uppercase text-muted'>
                        <th className='min-w-275px'>Permiso</th>
                        {RBAC_ROLES.map((r) => (
                          <th key={r.key} className='min-w-125px text-center'>
                            {r.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className='fw-semibold'>
                      {grouped.map((group) => (
                        <>
                          {/* Fila cabecera de modulo */}
                          <tr key={`mod-${group.module}`} className='bg-light'>
                            <td
                              colSpan={RBAC_ROLES.length + 1}
                              className='text-gray-700 fw-bold text-uppercase fs-8 py-2'
                            >
                              {group.module}
                            </td>
                          </tr>
                          {group.permissions.map((perm) => (
                            <tr key={perm.key}>
                              {/* Columna permiso: accion + clave + feature (candado si gated) */}
                              <td>
                                <div className='d-flex flex-column'>
                                  <span className='text-gray-800 fw-bold'>{perm.action}</span>
                                  <span className='text-muted font-monospace fs-8'>
                                    {perm.key}
                                    {perm.featureKey && (
                                      <span className='text-info ms-2'>
                                        <LockIcon className='fs-8 me-1' />
                                        {FEATURE_LABEL[perm.featureKey] ?? perm.featureKey}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </td>
                              {/* Celda por rol */}
                              {RBAC_ROLES.map((role) => (
                                <td key={role.key} className='text-center'>
                                  <CellBadge state={classifyCell(perm.cells[role.key])} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          {/* end::Card body */}
        </div>
        {/* end::Card */}
      </Content>

      {/* Modales (solo UI: abren/cierran, sin submit real) */}
      <PermissionFormDialog show={showPermCreate} permission={null} onClose={() => setShowPermCreate(false)} />
      <PermissionFormDialog
        show={editingPerm !== null}
        permission={editingPerm}
        onClose={() => setEditingPerm(null)}
      />
      <RoleFormDialog show={showRoleCreate} role={null} onClose={() => setShowRoleCreate(false)} />
      <RoleFormDialog show={editingRole !== null} role={editingRole} onClose={() => setEditingRole(null)} />
      <DeleteRbacDialog
        show={deleting !== null}
        entity={deleting?.entity ?? 'permiso'}
        name={deleting?.name}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

export default RbacPage
