import {FC, useState, type FormEvent} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useSedes} from '../estructura/estructura.api'
import {DeleteConfirmDialog} from '../estructura/components/DeleteConfirmDialog'
import {
  useCreateUsuario,
  useDeleteUsuario,
  useUpdateUsuario,
  useUsuarios,
} from './usuarios.api'
import type {Usuario, UsuarioCreateInput, UsuarioUpdateInput} from './usuarios.types'
import {ROLE_KEYS, STATUS_KEYS} from './usuarios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

/** Modal con las credenciales de un usuario recién creado. */
const CredencialesDialog: FC<{
  show: boolean
  email: string | null
  password: string | null
  onClose: () => void
}> = ({show, email, password, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})

  return createPortal(
    <Modal
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-500px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>{t('academico.usuarios.password.title')}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>
      <div className='modal-body py-lg-10 px-lg-10'>
        <div className='alert alert-info d-flex align-items-center mb-7'>
          <i className='ki-duotone ki-information-3 fs-2 me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{t('academico.usuarios.password.text')}</span>
        </div>

        <div className='fv-row mb-6'>
          <label className='fs-6 fw-semibold mb-2 text-muted'>
            {t('academico.usuarios.password.email')}
          </label>
          <input type='text' className='form-control form-control-solid' value={email ?? '—'} readOnly />
        </div>
        <div className='fv-row'>
          <label className='fs-6 fw-semibold mb-2 text-muted'>
            {t('academico.usuarios.password.pass')}
          </label>
          <input type='text' className='form-control form-control-solid' value={password ?? '—'} readOnly />
        </div>
      </div>
      <div className='modal-footer'>
        <button type='button' className='btn btn-primary' onClick={onClose}>
          {t('academico.usuarios.password.close')}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

// Modal crear/editar usuario. Al crear se elige la sede destino (colegio o sede
// adicional); al editar, la sede se conserva (el usuario no se mueve de BD).
const UsuarioFormDialog: FC<{
  show: boolean
  usuario: Usuario | null
  onClose: () => void
  onCreated: (email: string, password: string) => void
}> = ({show, usuario, onClose, onCreated}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreateUsuario()
  const update = useUpdateUsuario()
  const {data: sedes} = useSedes(show)
  const isEdit = usuario !== null
  const pending = create.isPending || update.isPending

  // Sedes adicionales (tenant hijo) como destino; la principal se omite de la lista.
  const sedesExtra = (sedes ?? []).filter((s) => s.tenant_id !== null && !s.es_principal)

  const [name, setName] = useState(usuario?.name ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [role, setRole] = useState(usuario?.role ?? 'docente')
  const [sedeId, setSedeId] = useState<string>(usuario?.sede_id ?? '')
  const [status, setStatus] = useState<string>(usuario?.status ?? 'active')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('academico.usuarios.toast.saveError'))
      }
    }

    if (isEdit && usuario) {
      const input: UsuarioUpdateInput = {
        name: name.trim(),
        role,
        sede_id: usuario.sede_id ?? null,
        status,
        ...(password.trim() ? {password: password.trim()} : {}),
      }
      update.mutate(
        {id: usuario.id, input},
        {
          onSuccess: () => {
            toast.success(t('academico.usuarios.toast.updated'))
            onClose()
          },
          onError,
        }
      )
    } else {
      const input: UsuarioCreateInput = {
        name: name.trim(),
        email: email.trim(),
        role,
        sede_id: sedeId ? Number(sedeId) : null,
        ...(password.trim() ? {password: password.trim()} : null),
      }
      create.mutate(input, {
        onSuccess: (res) => {
          toast.success(t('academico.usuarios.toast.created'))
          onClose()
          onCreated(res.data.email, res.password ?? '')
        },
        onError,
      })
    }
  }

  return createPortal(
    <Modal
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-600px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {isEdit ? t('academico.usuarios.formTitleEdit') : t('academico.usuarios.formTitleNew')}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div className='modal-body py-lg-10 px-lg-10'>
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.usuarios.field.nombre')}
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('name') ? 'is-invalid' : ''}`}
              value={name}
              placeholder={t('academico.usuarios.field.nombrePh')}
              onChange={(e) => setName(e.target.value)}
            />
            {fe('name') && <div className='invalid-feedback'>{fe('name')}</div>}
          </div>

          {!isEdit && (
            <div className='fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>
                {t('academico.usuarios.field.email')}
              </label>
              <input
                type='email'
                className={`form-control form-control-solid ${fe('email') ? 'is-invalid' : ''}`}
                value={email}
                placeholder={t('academico.usuarios.field.emailPh')}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fe('email') && <div className='invalid-feedback'>{fe('email')}</div>}
            </div>
          )}

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>
                {t('academico.usuarios.field.rol')}
              </label>
              <select
                className={`form-select form-select-solid ${fe('role') ? 'is-invalid' : ''}`}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {intl.formatMessage({id: `academico.usuarios.rol.${r}`, defaultMessage: r})}
                  </option>
                ))}
              </select>
              {fe('role') && <div className='invalid-feedback'>{fe('role')}</div>}
            </div>
            {!isEdit ? (
              <div className='col-md-6 fv-row mb-7'>
                <label className='required fs-6 fw-semibold mb-2'>
                  {t('academico.usuarios.field.sede')}
                </label>
                <select
                  className={`form-select form-select-solid ${fe('sede_id') ? 'is-invalid' : ''}`}
                  value={sedeId}
                  onChange={(e) => setSedeId(e.target.value)}
                >
                  <option value=''>{t('academico.usuarios.sede.colegio')}</option>
                  {sedesExtra.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
                {fe('sede_id') && <div className='invalid-feedback'>{fe('sede_id')}</div>}
              </div>
            ) : (
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>{t('academico.usuarios.field.sede')}</label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={usuario?.sede_nombre ?? t('academico.usuarios.sede.colegio')}
                  readOnly
                />
              </div>
            )}
          </div>

          {!isEdit ? (
            <div className='fv-row'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.usuarios.field.password')}
              </label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('password') ? 'is-invalid' : ''}`}
                value={password}
                placeholder={t('academico.usuarios.field.passwordPh')}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fe('password') && <div className='invalid-feedback'>{fe('password')}</div>}
            </div>
          ) : (
            <div className='row'>
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>{t('academico.usuarios.field.password')}</label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={password}
                  placeholder={t('academico.usuarios.field.passwordPh')}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>{t('academico.usuarios.col.estado')}</label>
                <select
                  className='form-select form-select-solid'
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_KEYS.map((s) => (
                    <option key={s} value={s}>
                      {t(`academico.usuarios.estado.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={pending}>
            {pending ? (
              <span className='spinner-border spinner-border-sm align-middle'></span>
            ) : (
              t('academico.usuarios.save')
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const statusBadge = (status: string): {cls: string; label: string} => {
  switch (status) {
    case 'active':
      return {cls: 'badge badge-light-success', label: 'academico.usuarios.estado.activo'}
    case 'suspended':
      return {cls: 'badge badge-light-warning', label: 'academico.usuarios.estado.suspendido'}
    default:
      return {cls: 'badge badge-light-secondary', label: 'academico.usuarios.estado.inactivo'}
  }
}

const UsuariosPage: FC = () => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const toast = useToast()
  const authz = useAuthz()

  const breadcrumbs: Array<PageLink> = [
    {title: t('academico.title'), path: '/academico/usuarios', isSeparator: false, isActive: false},
  ]

  const [formOpen, setFormOpen] = useState(false)
  const [userEdit, setUserEdit] = useState<Usuario | null>(null)
  const [deleteUser, setDeleteUser] = useState<Usuario | null>(null)
  const [creds, setCreds] = useState<{email: string; password: string} | null>(null)

  const {data, isLoading, isError} = useUsuarios()
  const del = useDeleteUsuario()

  const list = data ?? []

  const canManage = authz.hasPermission('usuarios.gestionar')

  const openCreate = () => {
    setUserEdit(null)
    setFormOpen(true)
  }
  const openEdit = (u: Usuario) => {
    setUserEdit(u)
    setFormOpen(true)
  }

  const onDelete = () => {
    if (!deleteUser) return
    del.mutate(
      {id: deleteUser.id, sedeId: deleteUser.sede_id},
      {
        onSuccess: () => {
          toast.success(t('academico.usuarios.toast.deleted'))
          setDeleteUser(null)
        },
        onError: () => {
          toast.error(t('academico.usuarios.toast.deleteError'))
          setDeleteUser(null)
        },
      }
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{t('academico.usuarios.title')}</PageTitle>
      <Content>
        {!canManage && (
          <div className='alert alert-warning d-flex align-items-center my-5'>
            <i className='ki-duotone ki-information fs-2 text-warning me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{t('academico.usuarios.noPermission')}</span>
          </div>
        )}

        {canManage && (
          <div className='card'>
            <div className='card-header border-0 pt-6'>
              <div className='card-title flex-column align-items-start'>
                <h3 className='fw-bold mb-1'>{t('academico.usuarios.title')}</h3>
                <span className='text-muted fs-7'>{t('academico.usuarios.subtitle')}</span>
              </div>
              <div className='card-toolbar'>
                <button type='button' className='btn btn-primary' onClick={openCreate}>
                  <i className='ki-duotone ki-plus fs-2'></i>
                  {t('academico.usuarios.new')}
                </button>
              </div>
            </div>

            <div className='card-body pt-4'>
              {isLoading && (
                <div className='d-flex justify-content-center align-items-center py-15'>
                  <span className='spinner-border text-primary me-3' role='status'></span>
                  <span className='text-muted fs-6'>{t('academico.usuarios.loading')}</span>
                </div>
              )}

              {isError && !isLoading && (
                <div className='alert alert-danger d-flex align-items-center my-5'>
                  <i className='ki-duotone ki-information fs-2 text-danger me-3'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                  </i>
                  <span>{t('academico.usuarios.loadError')}</span>
                </div>
              )}

              {!isLoading && !isError && (
                <div className='table-responsive'>
                  <table className='table table-row-dashed align-middle gs-0 gy-4'>
                    <thead>
                      <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                        <th className='min-w-200px'>{t('academico.usuarios.col.nombre')}</th>
                        <th className='min-w-200px'>{t('academico.usuarios.col.email')}</th>
                        <th className='min-w-160px'>{t('academico.usuarios.col.rol')}</th>
                        <th className='min-w-180px'>{t('academico.usuarios.col.sede')}</th>
                        <th className='min-w-100px'>{t('academico.usuarios.col.estado')}</th>
                        <th className='min-w-120px text-end'>{t('academico.usuarios.col.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className='text-gray-600 fw-semibold'>
                      {list.map((u) => {
                        const status = statusBadge(u.status)
                        return (
                          <tr key={`${u.tenant_id ?? 'principal'}-${u.id}`}>
                            <td>
                              <div className='d-flex align-items-center'>
                                <span className='symbol symbol-40px symbol-circle me-3 bg-light-primary text-primary'>
                                  <span className='symbol-label fw-bold'>
                                    {u.name.charAt(0).toUpperCase()}
                                  </span>
                                </span>
                                <span className='text-gray-800 fw-bold'>{u.name}</span>
                              </div>
                            </td>
                            <td>
                              <span className='text-gray-700'>{u.email}</span>
                            </td>
                            <td>
                              <span className='text-gray-700'>
                                {intl.formatMessage({
                                  id: `academico.usuarios.rol.${u.role}`,
                                  defaultMessage: u.role,
                                })}
                              </span>
                            </td>
                            <td>
                              <span className='text-gray-700'>
                                {u.sede_nombre ?? t('academico.usuarios.sede.colegio')}
                              </span>
                            </td>
                            <td>
                              <span className={status.cls}>{t(status.label)}</span>
                            </td>
                            <td>
                              <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                                <button
                                  type='button'
                                  className='btn btn-icon btn-light-primary btn-sm'
                                  title={t('academico.estructura.edit')}
                                  onClick={() => openEdit(u)}
                                >
                                  <i className='ki-duotone ki-pencil fs-5'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </button>
                                <button
                                  type='button'
                                  className='btn btn-icon btn-light-danger btn-sm'
                                  title={t('academico.estructura.delete')}
                                  onClick={() => setDeleteUser(u)}
                                >
                                  <i className='ki-duotone ki-trash fs-5'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                    <span className='path3'></span>
                                    <span className='path4'></span>
                                    <span className='path5'></span>
                                  </i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {list.length === 0 && (
                        <tr>
                          <td colSpan={6} className='text-center text-muted py-10'>
                            {t('academico.usuarios.empty')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <UsuarioFormDialog
          show={formOpen}
          usuario={userEdit}
          onClose={() => {
            setFormOpen(false)
            setUserEdit(null)
          }}
          onCreated={(email, password) => setCreds({email, password})}
        />
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
      </Content>
    </>
  )
}

export default UsuariosPage