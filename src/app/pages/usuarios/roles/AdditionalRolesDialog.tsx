import {useEffect, useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import type {Usuario} from '../usuarios.types'
import {useTenantRoleActions, useTenantRoles} from './tenant-roles.api'

export function AdditionalRolesDialog({user, onClose}: {user: Usuario | null; onClose: () => void}) {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const toast = useToast()
  const {data, isLoading, error} = useTenantRoles(!!user)
  const {assign} = useTenantRoleActions()
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => setSelected(user?.roles.filter(role => role.startsWith('custom_')) ?? []), [user])

  const save = () => {
    if (!user) return
    assign.mutate({userToken: user.url_token, roles: selected, sedeUrlToken: user.sede_url_token}, {
      onSuccess: () => {toast.success(t('tenantRbac.saved')); onClose()},
      onError: err => toast.error(err instanceof Error ? err.message : t('common.error')),
    })
  }

  return <Modal show={!!user} onHide={onClose} centered>
    <div className='modal-header'><h2 className='modal-title'>{t('tenantRbac.assignRoles')}</h2>
      <button type='button' className='btn-close' onClick={onClose} aria-label={t('common.close')} /></div>
    <div className='modal-body'>
      <p className='text-muted'>{user?.name} · {t('tenantRbac.assignHelp')}</p>
      {isLoading && <p role='status'>{t('common.loading', {name: t('tenantRbac.assignRoles')})}</p>}
      {error && <div className='alert alert-danger' role='alert'>{error.message}</div>}
      {data?.roles.filter(role => role.custom).map(role => <label key={role.key} className='form-check form-check-custom mb-3'>
        <input type='checkbox' className='form-check-input' checked={selected.includes(role.key)}
          disabled={role.locked_by_plan} onChange={event => setSelected(current => event.target.checked
            ? [...current, role.key] : current.filter(key => key !== role.key))} />
        <span className='form-check-label'>{role.label}{role.locked_by_plan && <span className='text-muted ms-2'>({t('tenantRbac.planLocked')})</span>}</span>
      </label>)}
      {data && !data.roles.some(role => role.custom) && <p className='text-muted'>{t('tenantRbac.noCustomRoles')}</p>}
    </div>
    <div className='modal-footer'><button type='button' className='btn btn-light' onClick={onClose}>{t('common.cancel')}</button>
      <button type='button' className='btn btn-primary' disabled={assign.isPending || isLoading || !data} onClick={save}>{t('common.save')}</button></div>
  </Modal>
}
