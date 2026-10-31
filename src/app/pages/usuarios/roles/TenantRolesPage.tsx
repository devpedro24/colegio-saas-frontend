import {Fragment, useState, type FormEvent} from 'react'
import {Navigate} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {PageTitle} from '@/_metronic/layout/core'
import {Content} from '@/_metronic/layout/components/content'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {rbacActionLabel, rbacModuleLabel} from '@/app/pages/config/rbac/rbac.labels'
import '@/app/pages/config/rbac/rbac-matrix.css'
import {useToast} from '@/lib/ui/toast'
import {useTenantRoleActions, useTenantRoles, type TenantRole, type TenantRoleCell} from './tenant-roles.api'

export default function TenantRolesPage() {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const {hasPermission, hasRole, isPlatform} = useAuthz()
  const toast = useToast()
  const allowed = !isPlatform && hasRole('rector') && hasPermission('usuarios.ajustar_permisos')
  const {data, isLoading, error} = useTenantRoles(allowed)
  const {create, rename, remove, toggle} = useTenantRoleActions()
  const [tab, setTab] = useState<'matrix' | 'roles'>('matrix')
  const [newLabel, setNewLabel] = useState('')
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  if (!allowed) return <Navigate to='/dashboard' replace />

  const run = async (operation: Promise<unknown>, success: string) => {
    try { await operation; toast.success(success) }
    catch (err) { toast.error(err instanceof Error ? err.message : t('common.error')) }
  }
  const createRole = (event: FormEvent) => {
    event.preventDefault()
    if (!newLabel.trim()) return
    void run(create.mutateAsync(newLabel.trim()).then(() => setNewLabel('')), t('common.toast.created'))
  }
  const saveName = (role: TenantRole) => {
    if (!role.custom || !editLabel.trim() || editLabel.trim() === role.label) return
    void run(rename.mutateAsync({key: role.key, label: editLabel.trim()})
      .then(() => setEditingRole(null)), t('common.toast.updated'))
  }
  const deleteRole = (role: TenantRole) => {
    if (!role.custom || !window.confirm(t('tenantRbac.deleteRole') + '?')) return
    void run(remove.mutateAsync(role.key).then(() => setEditingRole(null)), t('common.toast.deleted'))
  }
  const limit = data?.custom_role_limit
  const reached = limit !== null && limit !== undefined && (data?.custom_role_count ?? 0) >= limit

  const cellContent = (role: TenantRole, permission: {key: string; action: string}, cell?: TenantRoleCell) => {
    if (!cell) return <span className='text-muted'>—</span>
    if (cell.type === 'denied') return <span className='text-muted' title={t('tenantRbac.denied')}>—</span>
    if (cell.locked_by_plan || role.locked_by_plan) {
      return <span className='badge badge-light-warning' title={t('tenantRbac.planLocked')}>
        <i className='ki-duotone ki-lock fs-8 me-1'><span className='path1' /><span className='path2' /><span className='path3' /></i>
        {t('tenantRbac.planLocked')}
      </span>
    }
    if (cell.type === 'structural') return <span className='badge badge-light-primary' title={t('tenantRbac.structural')}>
      <i className='ki-duotone ki-lock fs-8 me-1'><span className='path1' /><span className='path2' /><span className='path3' /></i>
      {cell.level ? t(`rbac.level.${cell.level}`) : t('tenantRbac.structural')}
    </span>
    return <button type='button' className={`btn btn-sm ${cell.granted ? 'btn-light-success' : 'btn-light-secondary'}`}
      aria-pressed={cell.granted} disabled={toggle.isPending}
      aria-label={t('tenantRbac.changeCell', {permission: rbacActionLabel(intl, permission.key, permission.action), role: role.label})}
      onClick={() => void run(toggle.mutateAsync({role: role.key, permission: permission.key, granted: !cell.granted}), t('tenantRbac.saved'))}>
      {cell.granted ? t('tenantRbac.active') : t('tenantRbac.inactive')}
    </button>
  }

  return <><PageTitle>{t('tenantRbac.title')}</PageTitle><Content>
    <div className='card'>
      <div className='card-header border-0 pt-6'>
        <div className='card-title flex-column align-items-start'>
          <h2 className='fw-bold mb-1'>{t('tenantRbac.title')}</h2>
          <span className='text-muted fs-7'>{t('tenantRbac.help')}</span>
        </div>
      </div>
      <div className='card-body py-4'>
        {isLoading && <p role='status'>{t('common.loading', {name: t('rbac.title')})}</p>}
        {error && <div className='alert alert-danger' role='alert'>{error.message}</div>}
        {data && <>
          <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x mb-6 fs-6 fw-bold'>
            <li className='nav-item'><button type='button' className={`nav-link ${tab === 'matrix' ? 'active' : ''}`}
              onClick={() => setTab('matrix')}>{t('rbac.tab.matrix')}</button></li>
            <li className='nav-item'><button type='button' className={`nav-link ${tab === 'roles' ? 'active' : ''}`}
              onClick={() => setTab('roles')}>{t('rbac.tab.roles')}</button></li>
          </ul>
          {tab === 'matrix' && <>
            <p className='text-muted fs-7 mb-4'>{t('tenantRbac.matrixHelp')}</p>
            <p className='text-info fs-8 d-md-none mb-3'>{t('tenantRbac.scrollHint')}</p>
            <div className='d-flex flex-wrap align-items-center gap-4 mb-5 fs-8'>
              <span className='badge badge-light-primary'>{t('tenantRbac.structural')}</span>
              <span className='badge badge-light-success'>{t('tenantRbac.active')}</span>
              <span className='badge badge-light-secondary'>{t('tenantRbac.inactive')}</span>
              <span className='badge badge-light-warning'>{t('tenantRbac.planLocked')}</span>
              <span className='text-muted'>— {t('tenantRbac.denied')}</span>
            </div>
            <div className='table-responsive rbac-matrix-scroll' role='region' tabIndex={0} aria-label={t('rbac.tab.matrix')}>
              <table className='table table-row-bordered table-row-gray-200 align-middle gs-0 gy-3 mb-0'
                style={{minWidth: Math.max(850, 300 + data.roles.length * 150)}}>
                <thead><tr className='fw-bold fs-8 text-uppercase text-muted'>
                  <th className='min-w-300px'>{t('rbac.matrix.col.permission')}</th>
                  {data.roles.map(role => <th key={role.key} scope='col' className='min-w-150px text-center'>
                    {role.label}{role.locked_by_plan && <span className='d-block badge badge-light-warning mt-1'>{t('tenantRbac.planLocked')}</span>}
                  </th>)}
                </tr></thead>
                <tbody className='fw-semibold'>{data.data.map(module => <Fragment key={module.module}>
                  <tr className='bg-light'><th colSpan={data.roles.length + 1}
                    className='text-gray-700 fw-bold text-uppercase fs-8 py-2'>
                    <span className='rbac-matrix-group-label'>{rbacModuleLabel(intl, module.module)}</span>
                  </th></tr>
                  {module.permissions.map(permission => <tr key={permission.key}>
                    <th scope='row' className='rbac-matrix-permission py-3'>
                      <span className='d-block text-gray-800 fw-bold'>{rbacActionLabel(intl, permission.key, permission.action)}</span>
                      <span className='text-muted font-monospace fs-8'>{permission.key}</span>
                    </th>
                    {data.roles.map(role => <td key={role.key} className='text-center py-3'>
                      {cellContent(role, permission, permission.cells[role.key])}
                    </td>)}
                  </tr>)}
                </Fragment>)}</tbody>
              </table>
            </div>
          </>}
          {tab === 'roles' && <>
            <p className='text-muted fs-7 mb-3'>{t('tenantRbac.rolesHelp')}</p>
            <p className='fw-semibold'>{limit === null
              ? t('tenantRbac.roleQuotaUnlimited', {count: data.custom_role_count})
              : t('tenantRbac.roleQuota', {count: data.custom_role_count, limit: limit ?? 0})}</p>
            <form className='d-flex flex-wrap gap-2 align-items-end mb-5' onSubmit={createRole}>
              <label className='flex-grow-1'><span className='form-label d-block'>{t('tenantRbac.roleName')}</span>
                <input className='form-control' value={newLabel} maxLength={120} onChange={e => setNewLabel(e.target.value)} disabled={reached} /></label>
              <button className='btn btn-primary' disabled={reached || !newLabel.trim() || create.isPending}>{t('tenantRbac.newRole')}</button>
            </form>
            {reached && <div className='text-muted fs-7 mb-4'>{t('tenantRbac.planLocked')}</div>}
            <div className='table-responsive'><table className='table table-row-dashed align-middle gs-0 gy-4'>
              <thead><tr className='text-muted fw-bold fs-7 text-uppercase'>
                <th>{t('common.field.rol')}</th><th>{t('common.field.key')}</th>
                <th className='text-end'>{t('tenantRbac.roleActions')}</th>
              </tr></thead>
              <tbody>{data.roles.map(role => <tr key={role.key}>
                <td>{editingRole === role.key ? <input className='form-control' value={editLabel} maxLength={120}
                  aria-label={t('tenantRbac.roleName')} onChange={e => setEditLabel(e.target.value)} />
                  : <span className='fw-bold text-gray-800'>{role.label}</span>}
                  {role.locked_by_plan && <span className='badge badge-light-warning ms-2'>{t('tenantRbac.planLocked')}</span>}
                </td>
                <td className='text-muted font-monospace fs-7'>{role.key}</td>
                <td className='text-end'>{role.custom && (editingRole === role.key ? <div className='d-flex justify-content-end gap-2'>
                  <button type='button' className='btn btn-sm btn-light-primary' onClick={() => saveName(role)}
                    disabled={rename.isPending || !editLabel.trim()}>{t('tenantRbac.saveRole')}</button>
                  <button type='button' className='btn btn-sm btn-light' onClick={() => setEditingRole(null)}>{t('common.cancel')}</button>
                </div> : <div className='d-flex justify-content-end gap-2'>
                  <button type='button' className='btn btn-sm btn-light-primary' onClick={() => {
                    setEditingRole(role.key); setEditLabel(role.label)
                  }}>{t('tenantRbac.editRole')}</button>
                  <button type='button' className='btn btn-sm btn-light-danger' onClick={() => deleteRole(role)}
                    disabled={remove.isPending}>{t('tenantRbac.removeRole')}</button>
                </div>)}</td>
              </tr>)}</tbody>
            </table></div>
          </>}
        </>}
      </div>
    </div>
  </Content></>
}
