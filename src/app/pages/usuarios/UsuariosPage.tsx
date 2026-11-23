import {FC, useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {Link, Navigate} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../_metronic/layout/core'
import {Content} from '../../../_metronic/layout/components/content'
import {useToast} from '@/lib/ui/toast'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {useDeleteUsuario, useEgresarUsuario, useReincorporarEstudiante, useUsuarios} from './usuarios.api'
import type {Usuario} from './usuarios.types'
import {DeleteConfirmDialog} from '../academico/estructura/components/DeleteConfirmDialog'
import {CredencialesDialog} from './components/CredencialesDialog'
import {UsuarioFormDialog} from './components/UsuarioFormDialog'
import {UserPasswordDialog} from './components/UserPasswordDialog'
import {PaginationBar} from '@/app/shared/components/PaginationBar'
import {usePageSize} from '@/app/shared/hooks/usePageSize'
import {EgresoConfirmDialog} from './components/EgresoConfirmDialog'
import {AdditionalRolesDialog} from './roles/AdditionalRolesDialog'

const statusBadge = (status: string): {cls: string; label: string} => {
  switch (status) {
    case 'active':
      return {cls: 'badge badge-light-success', label: 'common.active'}
    case 'suspended':
      return {cls: 'badge badge-light-warning', label: 'common.suspended'}
    case 'egresado':
      return {cls: 'badge badge-light-info', label: 'academico.usuarios.egreso.status'}
    default:
      return {cls: 'badge badge-light-secondary', label: 'common.inactive'}
  }
}

const UsuariosPage: FC = () => {
  const authz = useAuthz()
  const {activeColegio} = useImpersonation()
  if (authz.isPlatform && !activeColegio) return <Navigate to='/dashboard' replace />
  return <TenantUsuariosPage />
}

const TenantUsuariosPage: FC = () => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const toast = useToast()
  const authz = useAuthz()
  const breadcrumbs: Array<PageLink> = [
    {title: t('header.menu.userManagement'), path: '/usuarios', isSeparator: false, isActive: false},
  ]

  const [formOpen, setFormOpen] = useState(false)
  const [userEdit, setUserEdit] = useState<Usuario | null>(null)
  const [deleteUser, setDeleteUser] = useState<Usuario | null>(null)
  const [egresoUser, setEgresoUser] = useState<Usuario | null>(null)
  const [creds, setCreds] = useState<{email: string; password: string} | null>(null)
  const [pwdUser, setPwdUser] = useState<Usuario | null>(null)
  const [rolesUser, setRolesUser] = useState<Usuario | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize()
  const canManage = authz.hasPermission('usuarios.gestionar')
  const canMarkDeparture = authz.hasPermission('estudiantes.egreso.gestionar')
  const canAuthorizeReturn = authz.hasPermission('estudiantes.reincorporacion.autorizar')
  const [returnUser, setReturnUser] = useState<Usuario | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const reincorporar = useReincorporarEstudiante()
  const canAdjustRoles = !authz.isPlatform && authz.hasRole('rector') && authz.hasPermission('usuarios.ajustar_permisos')
  const {data, isLoading, isError} = useUsuarios(page, pageSize,
    canManage ? 'all' : canMarkDeparture ? 'departure' : canAuthorizeReturn ? 'return' : null)
  const del = useDeleteUsuario()
  const egresar = useEgresarUsuario()

  const list = data?.data ?? []
  const meta = data?.meta

  const openCreate = () => { setUserEdit(null); setFormOpen(true) }
  const openEdit = (u: Usuario) => { setUserEdit(u); setFormOpen(true) }

  const onDelete = () => {
    if (!deleteUser) return
    del.mutate({id: deleteUser.url_token, sedeToken: deleteUser.sede_url_token}, {
      onSuccess: () => { toast.success(t('common.toast.deleted'), 'deleted'); setDeleteUser(null) },
      onError: () => { toast.error(t('common.toast.deleteError')); setDeleteUser(null) },
    })
  }

  const onEgresar = () => {
    if (!egresoUser) return
    egresar.mutate({id: egresoUser.url_token, sedeToken: egresoUser.sede_url_token}, {
      onSuccess: () => { toast.success(t('academico.usuarios.egreso.success')); setEgresoUser(null) },
      onError: () => toast.error(t('academico.usuarios.egreso.error')),
    })
  }

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{t('header.menu.users')}</PageTitle>
      <Content>
        {!canManage && !canMarkDeparture && !canAuthorizeReturn ? (
          <div className='alert alert-warning d-flex align-items-center py-5'>
            <i className='ki-duotone ki-information fs-2 text-warning me-3'>
              <span className='path1'></span><span className='path2'></span><span className='path3'></span>
            </i>
            <span>{t('academico.usuarios.noPermission')}</span>
          </div>
        ) : (
          <div className='card'>
            <div className='card-header border-0 pt-6'>
              <div className='card-title flex-column align-items-start'>
                <h3 className='fw-bold mb-1'>{t('header.menu.users')}</h3>
                <span className='text-muted fs-7'>{t('academico.usuarios.subtitle')}</span>
              </div>
              <div className='card-toolbar'>
                {canManage && <button type='button' className='btn btn-primary' onClick={openCreate}>
                  <i className='ki-duotone ki-plus fs-2'></i>
                  {t('academico.usuarios.new')}
                </button>}
              </div>
            </div>
            <div className='card-body py-4'>
              {isLoading && (
                <div className='d-flex justify-content-center align-items-center py-15'>
                  <span className='spinner-border text-primary me-3' role='status'></span>
                   <span className='text-muted fs-6'>{t('common.loading', {name: intl.formatMessage({id: 'entity.usuarios'})})}</span>
                </div>
              )}
              {isError && !isLoading && (
                <div className='alert alert-danger d-flex align-items-center my-5'>
                  <i className='ki-duotone ki-information fs-2 text-danger me-3'>
                    <span className='path1'></span><span className='path2'></span><span className='path3'></span>
                  </i>
                   <span>{t('common.loadError', {name: intl.formatMessage({id: 'entity.usuarios'})})}</span>
                </div>
              )}
              {!isLoading && !isError && (
                <div className='table-responsive'>
                  <table className='table table-row-dashed align-middle gs-0 gy-4'>
                    <thead>
                      <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                        <th className='min-w-200px'>{t('academico.usuarios.col.nombre')}</th>
                        <th className='min-w-200px'>{t('common.email')}</th>
                        <th className='min-w-160px'>{t('common.field.rol')}</th>
                        <th className='min-w-180px'>{t('common.field.sede')}</th>
                        <th className='min-w-100px'>{t('common.status')}</th>
                         <th className='min-w-120px text-end'>{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className='text-gray-600 fw-semibold'>
                      {list.map((u) => {
                        const status = statusBadge(u.status)
                        return (
                          <tr key={`${u.sede_url_token ?? 'principal'}:${u.url_token}`}>
                            <td>
                              <div className='d-flex align-items-center gap-2'>
                                <span className='symbol symbol-40px symbol-circle me-3 bg-light-primary text-primary'>
                                  <span className='symbol-label fw-bold'>{u.name.charAt(0).toUpperCase()}</span>
                                </span>
                                <span className='text-gray-800 fw-bold'>{u.name}</span>
                              </div>
                            </td>
                            <td><span className='text-gray-700'>{u.email}</span></td>
                            <td>
                              <span className='text-gray-700'>
                                {intl.formatMessage({id: `academico.usuarios.rol.${u.role}`})}
                                {u.roles.filter(role => role.startsWith('custom_')).length > 0 &&
                                  <span className='badge badge-light-primary ms-2'>+{u.roles.filter(role => role.startsWith('custom_')).length}</span>}
                              </span>
                            </td>
                            <td>
                              <span className='text-gray-700'>
                                {u.sede_nombre ?? t('academico.usuarios.sede.colegio')}
                              </span>
                            </td>
                            <td><span className={status.cls}>{t(status.label)}</span></td>
                            <td>
                              <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                                {u.role === 'estudiante' && !u.sede_url_token && authz.hasPermission('academico.matriculas.gestionar') &&
                                  <Link className='btn btn-sm btn-light-primary' to={'/admisiones/matriculas?estudiante=' + encodeURIComponent(u.url_token)}>
                                    {intl.locale.startsWith('en') ? 'Academic history' : 'Trayectoria académica'}
                                  </Link>}
                                {canAdjustRoles && u.role !== 'estudiante' && u.status !== 'egresado' &&
                                  <button type='button' className='btn btn-icon btn-light-primary btn-sm'
                                    title={t('tenantRbac.assignRoles')} onClick={() => setRolesUser(u)}>
                                    <i className='ki-duotone ki-shield-tick fs-5'><span className='path1'></span><span className='path2'></span></i>
                                  </button>}
                                {canManage && u.must_change_password && u.status !== 'egresado' && (
                                  <button
                                    type='button'
                                    className='btn btn-icon btn-light-warning btn-sm'
                                    title={t('academico.usuarios.tempPassword')}
                                    onClick={() => setPwdUser(u)}
                                  >
                                    <i className='ki-duotone ki-key fs-5'>
                                      <span className='path1'></span><span className='path2'></span>
                                    </i>
                                  </button>
                                )}
                                {canAuthorizeReturn && u.role === 'estudiante' && u.status === 'egresado' && (
                                  <button type='button' className='btn btn-sm btn-light-primary' onClick={() => {
                                    setReturnUser(u)
                                    setReturnReason('')
                                  }}>{t('academico.usuarios.regreso.action')}</button>
                                )}
                                {u.role === 'estudiante' && u.status !== 'egresado' && canMarkDeparture && (
                                  <button
                                    type='button'
                                    className='btn btn-sm btn-light-warning'
                                    title={t('academico.usuarios.egreso.action')}
                                    onClick={() => setEgresoUser(u)}
                                  >
                                    {t('academico.usuarios.egreso.action')}
                                  </button>
                                )}
                                {canManage && u.status !== 'egresado' && <button
                                  type='button'
                                  className='btn btn-icon btn-light-primary btn-sm'
                                   title={t('common.edit', {name: intl.formatMessage({id: 'entity.usuario'})})}
                                  onClick={() => openEdit(u)}
                                >
                                  <i className='ki-duotone ki-pencil fs-5'>
                                    <span className='path1'></span><span className='path2'></span>
                                  </i>
                                </button>}
                                {canManage && u.status !== 'egresado' && <button
                                  type='button'
                                  className='btn btn-icon btn-light-danger btn-sm'
                                   title={t('common.delete', {name: intl.formatMessage({id: 'entity.usuario'})})}
                                  onClick={() => setDeleteUser(u)}
                                >
                                  <i className='ki-duotone ki-trash fs-5'>
                                    <span className='path1'></span><span className='path2'></span><span className='path3'></span><span className='path4'></span><span className='path5'></span>
                                  </i>
                                </button>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {list.length === 0 && (
                        <tr>
                          <td colSpan={6} className='text-center text-muted py-10'>
                              {t('common.empty', {name: intl.formatMessage({id: 'entity.usuarios'})})}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {meta && meta.total > pageSize && (
                <PaginationBar
                  currentPage={meta.current_page}
                  totalPages={meta.last_page}
                  total={meta.total}
                  perPage={meta.per_page}
                  onPageChange={(p) => setPage(p)}
                  onPerPageChange={(ps) => { setPageSize(ps); setPage(1) }}
                />
              )}
            </div>
          </div>
        )}

        <UsuarioFormDialog
          show={formOpen}
          usuario={userEdit}
          onClose={() => { setFormOpen(false); setUserEdit(null) }}
          onCreated={(email, password) => setCreds({email, password})}
        />
        <AdditionalRolesDialog user={rolesUser} onClose={() => setRolesUser(null)} />
        <CredencialesDialog
          show={creds !== null}
          email={creds?.email ?? null}
          password={creds?.password ?? null}
          onClose={() => setCreds(null)}
        />
        <DeleteConfirmDialog
          show={deleteUser !== null}
          title={t('academico.usuarios.deleteConfirm.title')}
          text={t('academico.usuarios.deleteConfirm.text')}
          pending={del.isPending}
          onConfirm={onDelete}
          onClose={() => setDeleteUser(null)}
        />
        <Modal show={!!returnUser} onHide={() => {if (!reincorporar.isPending) setReturnUser(null)}} centered aria-labelledby='student-return-title'>
          <form onSubmit={event => {
            event.preventDefault()
            if (!returnUser || reincorporar.isPending || returnReason.trim().length < 5) return
            reincorporar.mutate({user: returnUser, motivo: returnReason.trim()}, {
              onSuccess: () => {setReturnUser(null); toast.success(t('academico.usuarios.regreso.success'))},
              onError: error => toast.error(error.message || t('common.toast.genericError')),
            })
          }}>
            <Modal.Header closeButton={!reincorporar.isPending}>
              <Modal.Title id='student-return-title'>{t('academico.usuarios.regreso.action')}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>{t('academico.usuarios.regreso.explanation', {name: returnUser?.name ?? ''})}</p>
              <label className='form-label required' htmlFor='student-return-reason'>{t('academico.usuarios.regreso.reason')}</label>
              <textarea id='student-return-reason' className='form-control' rows={3} required minLength={5} maxLength={1000}
                disabled={reincorporar.isPending} value={returnReason} onChange={e => setReturnReason(e.target.value)} />
            </Modal.Body>
            <Modal.Footer>
              <button type='button' className='btn btn-light' disabled={reincorporar.isPending} onClick={() => setReturnUser(null)}>{t('common.cancel')}</button>
              <button className='btn btn-primary' disabled={returnReason.trim().length < 5 || reincorporar.isPending}>{t('academico.usuarios.regreso.confirm')}</button>
            </Modal.Footer>
          </form>
        </Modal>
        <EgresoConfirmDialog
          user={egresoUser}
          pending={egresar.isPending}
          onConfirm={onEgresar}
          onClose={() => setEgresoUser(null)}
        />
        <UserPasswordDialog
          show={pwdUser !== null}
          usuario={pwdUser}
          onClose={() => setPwdUser(null)}
        />
      </Content>
    </>
  )
}

export default UsuariosPage
