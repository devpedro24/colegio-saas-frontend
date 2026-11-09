import {useId, useState, type ReactNode} from 'react'
import {useIntl} from 'react-intl'
import {rbacActionLabel, rbacModuleLabel} from '../rbac.labels'

type Role = {key: string; label: string}
type Permission = {key: string; action: string; feature_key: string | null}

/** A focused role view keeps every permission accessible without sideways scrolling. */
export function MobilePermissionMatrix<R extends Role, P extends Permission>({roles, groups, renderCell, featureLabel}: {
  roles: R[]
  groups: {module: string; permissions: P[]}[]
  renderCell: (role: R, permission: P) => ReactNode
  featureLabel?: (key: string) => string
}) {
  const intl = useIntl(), id = useId()
  const [roleKey, setRoleKey] = useState(''), [search, setSearch] = useState('')
  const role = roles.find(item => item.key === roleKey) ?? roles[0]
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(intl.locale)
  const term = normalize(search.trim())
  const visible = groups.map(group => ({...group, permissions: group.permissions.filter(permission =>
    normalize(`${rbacModuleLabel(intl, group.module)} ${rbacActionLabel(intl, permission.key, permission.action)} ${permission.key}`).includes(term))}))
    .filter(group => group.permissions.length)
  const searchLabel = intl.formatMessage({id: 'common.search'}, {name: intl.formatMessage({id:'rbac.tab.permissions'}).toLocaleLowerCase(intl.locale)})
  return <section className='rbac-mobile-matrix' data-rbac-mobile aria-label={intl.formatMessage({id:'rbac.tab.matrix'})}>
    <div className='rbac-mobile-filters'>
      <label htmlFor={`${id}-role`}><span className='form-label'>{intl.formatMessage({id:'common.field.rol'})}</span>
        <select id={`${id}-role`} className='form-select form-select-solid' value={role?.key ?? ''}
          onChange={event => setRoleKey(event.target.value)} disabled={!roles.length}>
          {roles.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-search`}><span className='form-label'>{intl.formatMessage({id:'rbac.matrix.col.permission'})}</span>
        <input type='search' id={`${id}-search`} className='form-control form-control-solid' value={search}
          placeholder={searchLabel} aria-label={searchLabel} onChange={event => setSearch(event.target.value)} />
      </label>
    </div>
    {role && visible.map(group => <section className='rbac-mobile-module' key={group.module}>
      <h4>{rbacModuleLabel(intl, group.module)}</h4>
      {group.permissions.map(permission => <article className='rbac-mobile-permission' key={permission.key}>
        <div><strong>{rbacActionLabel(intl, permission.key, permission.action)}</strong>
          <small className='font-monospace text-muted'>{permission.key}</small>
          {featureLabel && permission.feature_key && <span className='badge badge-light-info mt-2'>{featureLabel(permission.feature_key)}</span>}
        </div>
        <div className='rbac-mobile-cell'>{renderCell(role, permission)}</div>
      </article>)}
    </section>)}
    {(!role || !visible.length) && <p className='text-muted text-center py-6' role='status'>
      {intl.formatMessage({id:'common.empty'}, {name:intl.formatMessage({id:'rbac.tab.permissions'}).toLocaleLowerCase(intl.locale)})}
    </p>}
  </section>
}
