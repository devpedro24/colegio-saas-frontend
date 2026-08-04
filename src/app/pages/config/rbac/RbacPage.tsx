import {FC, Fragment, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useRbacCatalog, useDeletePermission, useDeleteRole} from './rbac.api'
import {toCellState} from './rbac.catalog'
import {CellState, RbacMatrixCell, RbacPermission, RbacRole} from './rbac.types'
import {PermissionFormDialog} from './components/PermissionFormDialog'
import {RoleFormDialog} from './components/RoleFormDialog'
import {DeleteRbacDialog} from './components/DeleteRbacDialog'
import {MatrixCellDialog} from './components/MatrixCellDialog'

type TabKey = 'permissions' | 'roles' | 'matrix'

// Candado (ki-lock, 3 paths) reutilizado donde aplica gating por plan / estructural.
const LockIcon: FC<{className?: string}> = ({className}) => (
  <i className={`ki-duotone ki-lock ${className ?? ''}`}>
    <span className='path1'></span>
    <span className='path2'></span>
    <span className='path3'></span>
  </i>
)

// Badge de una celda de la matriz segun su estado clasificado.
const CellBadge: FC<{state: CellState}> = ({state}) => {
  const intl = useIntl()
  if (state.type === 'denied') {
    return <span className='text-muted'>—</span>
  }
  if (state.type === 'structural') {
    const level = state.level
      ? intl.formatMessage({id: `rbac.level.${state.level}`, defaultMessage: state.level})
      : ''
    return (
      <span
        className='badge badge-light-primary'
        title={`${intl.formatMessage({id: 'rbac.cell.structuralTitle'})} · ${level}`}
      >
        <LockIcon className='fs-8 me-1' />
        {level}
      </span>
    )
  }
  const cls = state.default_granted ? 'badge badge-light-success' : 'badge badge-light-secondary'
  return (
    <span
      className={cls}
      title={intl.formatMessage({
        id: state.default_granted ? 'rbac.cell.configOnTitle' : 'rbac.cell.configOffTitle',
      })}
    >
      {intl.formatMessage({id: state.default_granted ? 'rbac.cell.configOn' : 'rbac.cell.config'})}
    </span>
  )
}

const RbacPage: FC = () => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)

  const configBreadCrumbs: Array<PageLink> = [
    {
      title: t('config.breadcrumb'),
      path: '/configuracion/roles-permisos',
      isSeparator: false,
      isActive: false,
    },
  ]

  const [tab, setTab] = useState<TabKey>('permissions')

  const [showPermCreate, setShowPermCreate] = useState(false)
  const [editingPerm, setEditingPerm] = useState<RbacPermission | null>(null)
  const [showRoleCreate, setShowRoleCreate] = useState(false)
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null)
  const [deleting, setDeleting] = useState<{kind: 'permiso' | 'rol'; id: number; name: string} | null>(
    null
  )
  const [editingCell, setEditingCell] = useState<{
    role: RbacRole
    permission: RbacPermission
    state: CellState
  } | null>(null)

  const toast = useToast()
  const {data, isLoading, isError} = useRbacCatalog()
  const deletePermission = useDeletePermission()
  const deleteRole = useDeleteRole()
  const deletePending = deletePermission.isPending || deleteRole.isPending

  const roles = data?.roles ?? []
  const permissions = data?.permissions ?? []
  const features = data?.features ?? []
  const levels = data?.levels ?? []

  // key de feature -> id i18n de su label (el backend manda el id en catalog.features).
  const featureLabelId = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of features) map.set(f.key, f.label)
    return map
  }, [features])
  const featureLabel = (key: string): string => {
    const id = featureLabelId.get(key)
    return id ? intl.formatMessage({id}) : key
  }

  // Indexa la matriz por "role_key|permission_key".
  const cellMap = useMemo(() => {
    const map = new Map<string, RbacMatrixCell>()
    for (const c of data?.matrix ?? []) {
      map.set(`${c.role_key}|${c.permission_key}`, c)
    }
    return map
  }, [data?.matrix])

  // Agrupa los permisos por modulo (respetando el orden del catalogo) para la matriz.
  const grouped = useMemo(() => {
    const groups: {module: string; permissions: RbacPermission[]}[] = []
    for (const perm of permissions) {
      let group = groups.find((g) => g.module === perm.module)
      if (!group) {
        group = {module: perm.module, permissions: []}
        groups.push(group)
      }
      group.permissions.push(perm)
    }
    return groups
  }, [permissions])

  const openCell = (role: RbacRole, permission: RbacPermission) => {
    setEditingCell({role, permission, state: toCellState(cellMap.get(`${role.key}|${permission.key}`))})
  }

  const confirmDelete = () => {
    if (!deleting) return
    const mutation = deleting.kind === 'permiso' ? deletePermission : deleteRole
    mutation.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t(deleting.kind === 'permiso' ? 'rbac.toast.permDeleted' : 'rbac.toast.roleDeleted'))
        setDeleting(null)
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : t('rbac.toast.deleteError'))
      },
    })
  }

  return (
    <>
      <PageTitle breadcrumbs={configBreadCrumbs}>{t('rbac.title')}</PageTitle>
      <Content>
        {/* begin::Card */}
        <div className='card'>
          {/* begin::Card header */}
          <div className='card-header border-0 pt-6'>
            <div className='card-title flex-column align-items-start'>
              <h3 className='fw-bold mb-1'>{t('rbac.title')}</h3>
              <span className='text-muted fs-7'>{t('rbac.subtitle')}</span>
            </div>
          </div>
          {/* end::Card header */}

          {/* begin::Card body */}
          <div className='card-body py-4'>
            {/* Loading */}
            {isLoading && (
              <div className='d-flex justify-content-center align-items-center py-15'>
                <span className='spinner-border text-primary me-3' role='status'></span>
                <span className='text-muted fs-6'>{t('rbac.loading')}</span>
              </div>
            )}

            {/* Error */}
            {isError && !isLoading && (
              <div className='alert alert-danger d-flex align-items-center my-5'>
                <i className='ki-duotone ki-information fs-2 text-danger me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <span>{t('rbac.loadError')}</span>
              </div>
            )}

            {!isLoading && !isError && (
              <>
                {/* begin::Tabs */}
                <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x mb-6 fs-6 fw-bold'>
                  <li className='nav-item'>
                    <a
                      className={`nav-link cursor-pointer ${tab === 'permissions' ? 'active' : ''}`}
                      onClick={() => setTab('permissions')}
                    >
                      {t('rbac.tab.permissions')}
                    </a>
                  </li>
                  <li className='nav-item'>
                    <a
                      className={`nav-link cursor-pointer ${tab === 'roles' ? 'active' : ''}`}
                      onClick={() => setTab('roles')}
                    >
                      {t('rbac.tab.roles')}
                    </a>
                  </li>
                  <li className='nav-item'>
                    <a
                      className={`nav-link cursor-pointer ${tab === 'matrix' ? 'active' : ''}`}
                      onClick={() => setTab('matrix')}
                    >
                      {t('rbac.tab.matrix')}
                    </a>
                  </li>
                </ul>
                {/* end::Tabs */}

                {/* ============================= PERMISOS ============================= */}
                {tab === 'permissions' && (
                  <div>
                    <div className='d-flex justify-content-end mb-4'>
                      <button
                        type='button'
                        className='btn btn-primary'
                        onClick={() => setShowPermCreate(true)}
                      >
                        <i className='ki-duotone ki-plus fs-2'></i>
                        {t('rbac.perm.new')}
                      </button>
                    </div>
                    <div className='table-responsive'>
                      <table className='table table-row-dashed align-middle gs-0 gy-4'>
                        <thead>
                          <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                            <th className='min-w-200px'>{t('rbac.perm.col.module')}</th>
                            <th className='min-w-250px'>{t('rbac.perm.col.action')}</th>
                            <th className='min-w-200px'>{t('rbac.perm.col.key')}</th>
                            <th className='min-w-150px'>{t('rbac.perm.col.feature')}</th>
                            <th className='min-w-125px text-end'>{t('rbac.perm.col.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className='text-gray-600 fw-semibold'>
                          {permissions.map((p) => (
                            <tr key={p.id}>
                              <td className='text-gray-700'>{p.module}</td>
                              <td className='text-gray-800 fw-bold'>{p.action}</td>
                              <td>
                                <span className='text-muted font-monospace fs-7'>{p.key}</span>
                              </td>
                              <td>
                                {p.feature_key ? (
                                  <span
                                    className='badge badge-light-info'
                                    title={t('rbac.perm.gatedTitle')}
                                  >
                                    <LockIcon className='fs-8 me-1' />
                                    {featureLabel(p.feature_key)}
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
                                    title={t('rbac.perm.editTitle')}
                                    onClick={() => setEditingPerm(p)}
                                  >
                                    <i className='ki-duotone ki-pencil fs-5'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                    </i>
                                  </button>
                                  {p.is_system ? (
                                    <span className='badge badge-light-secondary'>{t('rbac.system')}</span>
                                  ) : (
                                    <button
                                      type='button'
                                      className='btn btn-icon btn-light-danger btn-sm'
                                      title={t('rbac.perm.deleteTitle')}
                                      onClick={() =>
                                        setDeleting({kind: 'permiso', id: p.id, name: p.key})
                                      }
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
                          {permissions.length === 0 && (
                            <tr>
                              <td colSpan={5} className='text-center text-muted py-10'>
                                {t('rbac.perm.empty')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ============================== ROLES ============================== */}
                {tab === 'roles' && (
                  <div>
                    <div className='d-flex justify-content-end mb-4'>
                      <button
                        type='button'
                        className='btn btn-primary'
                        onClick={() => setShowRoleCreate(true)}
                      >
                        <i className='ki-duotone ki-plus fs-2'></i>
                        {t('rbac.role.new')}
                      </button>
                    </div>
                    <div className='table-responsive'>
                      <table className='table table-row-dashed align-middle gs-0 gy-4'>
                        <thead>
                          <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                            <th className='min-w-300px'>{t('rbac.role.col.role')}</th>
                            <th className='min-w-200px'>{t('rbac.role.col.key')}</th>
                            <th className='min-w-125px text-end'>{t('rbac.role.col.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className='text-gray-600 fw-semibold'>
                          {roles.map((r) => (
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
                                    title={t('rbac.role.editTitle')}
                                    onClick={() => setEditingRole(r)}
                                  >
                                    <i className='ki-duotone ki-pencil fs-5'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                    </i>
                                  </button>
                                  {r.is_system ? (
                                    <span className='badge badge-light-secondary'>{t('rbac.system')}</span>
                                  ) : (
                                    <button
                                      type='button'
                                      className='btn btn-icon btn-light-danger btn-sm'
                                      title={t('rbac.role.deleteTitle')}
                                      onClick={() => setDeleting({kind: 'rol', id: r.id, name: r.label})}
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
                          {roles.length === 0 && (
                            <tr>
                              <td colSpan={3} className='text-center text-muted py-10'>
                                {t('rbac.role.empty')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ============================== MATRIZ ============================== */}
                {tab === 'matrix' && (
                  <div>
                    {/* Leyenda + ayuda */}
                    <div className='d-flex flex-wrap align-items-center gap-4 mb-5'>
                      <span className='text-muted fs-7'>{t('rbac.matrix.help')}</span>
                      <span className='d-flex align-items-center gap-2'>
                        <span className='badge badge-light-primary'>
                          <LockIcon className='fs-8 me-1' />
                          {t('rbac.cellType.structural')}
                        </span>
                        <span className='text-muted fs-8'>{t('rbac.matrix.legend.structuralHint')}</span>
                      </span>
                      <span className='d-flex align-items-center gap-2'>
                        <span className='badge badge-light-success'>{t('rbac.cell.configOn')}</span>
                        <span className='badge badge-light-secondary'>{t('rbac.cell.config')}</span>
                        <span className='text-muted fs-8'>{t('rbac.matrix.legend.configHint')}</span>
                      </span>
                      <span className='d-flex align-items-center gap-2'>
                        <span className='text-muted'>—</span>
                        <span className='text-muted fs-8'>{t('rbac.matrix.legend.denied')}</span>
                      </span>
                    </div>

                    <div className='table-responsive'>
                      <table className='table table-row-bordered table-row-gray-200 align-middle gs-0 gy-3 mb-0'>
                        <thead>
                          <tr className='fw-bold fs-8 text-uppercase text-muted'>
                            <th className='min-w-275px'>{t('rbac.matrix.col.permission')}</th>
                            {roles.map((r) => (
                              <th key={r.key} className='min-w-125px text-center'>
                                {r.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className='fw-semibold'>
                          {grouped.map((group) => (
                            <Fragment key={`mod-${group.module}`}>
                              {/* Fila cabecera de modulo */}
                              <tr className='bg-light'>
                                <td
                                  colSpan={roles.length + 1}
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
                                        {perm.feature_key && (
                                          <span className='text-info ms-2'>
                                            <LockIcon className='fs-8 me-1' />
                                            {featureLabel(perm.feature_key)}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </td>
                                  {/* Celda editable por rol */}
                                  {roles.map((role) => (
                                    <td key={role.key} className='text-center'>
                                      <button
                                        type='button'
                                        className='btn btn-sm btn-active-light-primary p-1'
                                        title={t('rbac.matrix.editCell')}
                                        onClick={() => openCell(role, perm)}
                                      >
                                        <CellBadge
                                          state={toCellState(cellMap.get(`${role.key}|${perm.key}`))}
                                        />
                                      </button>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {/* end::Card body */}
        </div>
        {/* end::Card */}
      </Content>

      {/* Modales conectados al backend real */}
      <PermissionFormDialog
        show={showPermCreate}
        permission={null}
        features={features}
        onClose={() => setShowPermCreate(false)}
      />
      <PermissionFormDialog
        show={editingPerm !== null}
        permission={editingPerm}
        features={features}
        onClose={() => setEditingPerm(null)}
      />
      <RoleFormDialog show={showRoleCreate} role={null} onClose={() => setShowRoleCreate(false)} />
      <RoleFormDialog show={editingRole !== null} role={editingRole} onClose={() => setEditingRole(null)} />
      <DeleteRbacDialog
        show={deleting !== null}
        entity={deleting?.kind ?? 'permiso'}
        name={deleting?.name}
        onConfirm={confirmDelete}
        pending={deletePending}
        onClose={() => setDeleting(null)}
      />
      <MatrixCellDialog
        show={editingCell !== null}
        role={editingCell?.role ?? null}
        permission={editingCell?.permission ?? null}
        state={editingCell?.state ?? null}
        levels={levels}
        onClose={() => setEditingCell(null)}
      />
    </>
  )
}

export default RbacPage
