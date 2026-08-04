import {FC, useState, type FormEvent} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useNavigate} from 'react-router-dom'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {
  sedeSubdomainUrl,
  useCreateSede,
  useDeleteSede,
  useSedes,
  useUpdateSede,
} from '../../estructura/estructura.api'
import type {CreateSedeInput, Sede} from '../../estructura/estructura.types'
import {DeleteConfirmDialog} from '../../estructura/components/DeleteConfirmDialog'

const modalsRoot = document.getElementById('root-modals') || document.body

const emptyForm = (): CreateSedeInput => ({
  nombre: '',
  slug: '',
  direccion: '',
  telefono: '',
  responsable: '',
  coordinador_name: '',
  coordinador_email: '',
  heredar: true,
  es_principal: false,
  estado: 'activa',
})

const fromSede = (s: Sede): CreateSedeInput => ({
  nombre: s.nombre,
  slug: '',
  direccion: s.direccion ?? '',
  telefono: s.telefono ?? '',
  responsable: s.responsable ?? '',
  coordinador_name: '',
  coordinador_email: s.coordinador_email ?? '',
  heredar: true,
  es_principal: s.es_principal,
  estado: s.estado,
})

/** Modal con las credenciales del coordinador de una sede recién creada. */
const CoordinadorCredentialsDialog: FC<{
  show: boolean
  email: string | null
  password: string | null
  url: string | null
  onClose: () => void
}> = ({show, email, password, url, onClose}) => {
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
        <h2 className='fw-bold'>{t('academico.estructura.sede.password.title')}</h2>
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
          <span>{t('academico.estructura.sede.password.text')}</span>
        </div>

        <div className='fv-row mb-6'>
          <label className='fs-6 fw-semibold mb-2 text-muted'>
            {t('academico.estructura.sede.password.email')}
          </label>
          <input type='text' className='form-control form-control-solid' value={email ?? '—'} readOnly />
        </div>
        <div className='fv-row mb-6'>
          <label className='fs-6 fw-semibold mb-2 text-muted'>
            {t('academico.estructura.sede.password.pass')}
          </label>
          <input type='text' className='form-control form-control-solid' value={password ?? '—'} readOnly />
        </div>
        <div className='fv-row'>
          <label className='fs-6 fw-semibold mb-2 text-muted'>
            {t('academico.estructura.sede.password.url')}
          </label>
          <input type='text' className='form-control form-control-solid' value={url ?? '—'} readOnly />
        </div>
      </div>
      <div className='modal-footer'>
        <button type='button' className='btn btn-primary' onClick={onClose}>
          {t('academico.estructura.sede.password.close')}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

// Modal crear/editar sede. Crear provisiona el tenant hijo (slug + coordinador + herencia).
const SedeFormDialog: FC<{
  show: boolean
  sede: Sede | null
  onClose: () => void
  onCreated: (email: string | null, password: string | null, url: string | null) => void
}> = ({show, sede, onClose, onCreated}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string>) => intl.formatMessage({id}, values)
  const toast = useToast()
  const create = useCreateSede()
  const update = useUpdateSede()
  const isEdit = sede !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<CreateSedeInput>(sede ? fromSede(sede) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<CreateSedeInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const input: CreateSedeInput = isEdit
      ? {
          ...form,
          nombre: form.nombre.trim(),
          direccion: form.direccion?.trim() || null,
          telefono: form.telefono?.trim() || null,
          responsable: form.responsable?.trim() || null,
        }
      : {
          ...form,
          nombre: form.nombre.trim(),
          slug: form.slug?.trim().toLowerCase() || undefined,
          direccion: form.direccion?.trim() || null,
          telefono: form.telefono?.trim() || null,
          responsable: form.responsable?.trim() || null,
          coordinador_name: form.coordinador_name?.trim() || null,
          coordinador_email: form.coordinador_email?.trim() || null,
          heredar: form.heredar ?? true,
          es_principal: false,
        }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('academico.estructura.toast.saveError'))
      }
    }

    if (isEdit && sede) {
      update.mutate(
        {id: sede.id, input},
        {
          onSuccess: () => {
            toast.success(t('academico.estructura.toast.updated'))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(input, {
        onSuccess: (res) => {
          toast.success(t('academico.estructura.sede.toast.created'))
          onClose()
          onCreated(
            res.data.coordinador_email,
            res.coordinador_password ?? null,
            res.data.tenant_domain ? sedeSubdomainUrl(res.data.tenant_domain) : null
          )
        },
        onError,
      })
    }
  }

  return createPortal(
    <Modal
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {isEdit
            ? t('academico.estructura.sede.edit.title')
            : t('academico.estructura.sede.create.title')}
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
              {t('academico.estructura.sede.nombre')}
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
            {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
          </div>

          {!isEdit && (
            <div className='fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>
                {t('academico.estructura.sede.slug')}
              </label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('slug') ? 'is-invalid' : ''}`}
                value={form.slug ?? ''}
                placeholder={t('academico.estructura.sede.slugPh')}
                onChange={(e) => set({slug: e.target.value})}
              />
              {fe('slug') && <div className='invalid-feedback'>{fe('slug')}</div>}
              {!fe('slug') && (
                <div className='form-text'>
                  {t('academico.estructura.sede.slugHelp', {
                    domain: form.slug ? `${form.slug.toLowerCase()}.${window.location.hostname}` : '...',
                  })}
                </div>
              )}
            </div>
          )}

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.sede.direccion')}</label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('direccion') ? 'is-invalid' : ''}`}
                value={form.direccion ?? ''}
                onChange={(e) => set({direccion: e.target.value})}
              />
              {fe('direccion') && <div className='invalid-feedback'>{fe('direccion')}</div>}
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.sede.telefono')}</label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('telefono') ? 'is-invalid' : ''}`}
                value={form.telefono ?? ''}
                onChange={(e) => set({telefono: e.target.value})}
              />
              {fe('telefono') && <div className='invalid-feedback'>{fe('telefono')}</div>}
            </div>
          </div>

          <div className='fv-row mb-7'>
            <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.sede.responsable')}</label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('responsable') ? 'is-invalid' : ''}`}
              value={form.responsable ?? ''}
              onChange={(e) => set({responsable: e.target.value})}
            />
            {fe('responsable') && <div className='invalid-feedback'>{fe('responsable')}</div>}
          </div>

          {!isEdit && (
            <>
              <div className='separator separator-dashed my-8'></div>

              <div className='row'>
                <div className='col-md-6 fv-row mb-7'>
                  <label className='required fs-6 fw-semibold mb-2'>
                    {t('academico.estructura.sede.coordinadorNombre')}
                  </label>                  <input
                    type='text'
                    className={`form-control form-control-solid ${fe('coordinador_nombre') ? 'is-invalid' : ''}`}
                    value={form.coordinador_name ?? ''}
                    placeholder={t('academico.estructura.sede.coordinadorNombrePh')}
                    onChange={(e) => set({coordinador_name: e.target.value})}
                  />
                  {fe('coordinador_name') && (
                    <div className='invalid-feedback'>{fe('coordinador_name')}</div>
                  )}
                </div>
                <div className='col-md-6 fv-row mb-7'>
                  <label className='required fs-6 fw-semibold mb-2'>
                    {t('academico.estructura.sede.coordinadorEmail')}
                  </label>
                  <input
                    type='email'
                    className={`form-control form-control-solid ${fe('coordinador_email') ? 'is-invalid' : ''}`}
                    value={form.coordinador_email ?? ''}
                    placeholder={t('academico.estructura.sede.coordinadorEmailPh')}
                    onChange={(e) => set({coordinador_email: e.target.value})}
                  />
                  {fe('coordinador_email') && (
                    <div className='invalid-feedback'>{fe('coordinador_email')}</div>
                  )}
                </div>
              </div>

              <div className='fv-row'>
                <label className='form-check form-switch form-check-custom form-check-solid'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    checked={form.heredar ?? true}
                    onChange={(e) => set({heredar: e.target.checked})}
                  />
                  <span className='form-check-label fw-semibold text-gray-700'>
                    {t('academico.estructura.sede.heredar')}
                  </span>
                </label>
                <div className='form-text'>{t('academico.estructura.sede.heredarHelp')}</div>
              </div>
            </>
          )}

          {isEdit && sede && !sede.es_principal && (
            <div className='fv-row'>
              <label className='form-check form-switch form-check-custom form-check-solid'>
                <input
                  className='form-check-input'
                  type='checkbox'
                  checked={form.es_principal ?? false}
                  onChange={(e) => set({es_principal: e.target.checked})}
                />
                <span className='form-check-label fw-semibold text-gray-700'>
                  {t('academico.estructura.sede.principal')}
                </span>
              </label>
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
            ) : isEdit ? (
              t('academico.estructura.save')
            ) : (
              t('academico.estructura.sede.save')
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const tenantStatusBadge = (status: string | null): {cls: string; label: string} => {
  switch (status) {
    case 'active':
      return {cls: 'badge badge-light-success', label: 'academico.estructura.sede.tenantStatus.activo'}
    case 'in_retention':
      return {cls: 'badge badge-light-warning', label: 'academico.estructura.sede.tenantStatus.cuarentena'}
    default:
      return {cls: 'badge badge-light-secondary', label: 'academico.estructura.sede.tenantStatus.inactivo'}
  }
}

// Tab Sedes (Configuración del colegio): card + toolbar + modal con provisionamiento
// de tenant hijo (slug, coordinador, herencia) + credenciales generadas.
const SedesConfigTab: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const navigate = useNavigate()
  const {data, isLoading, isError} = useSedes()
  const del = useDeleteSede()

  const [formOpen, setFormOpen] = useState(false)
  const [sedeEdit, setSedeEdit] = useState<Sede | null>(null)
  const [deleteId, setDeleteId] = useState<Sede | null>(null)
  const [creds, setCreds] = useState<{email: string | null; password: string | null; url: string | null} | null>(null)

  const list = data ?? []

  const openCreate = () => {
    setSedeEdit(null)
    setFormOpen(true)
  }
  const openEdit = (s: Sede) => {
    setSedeEdit(s)
    setFormOpen(true)
  }

  const onDelete = () => {
    if (!deleteId) return
    del.mutate(deleteId.id, {
      onSuccess: () => {
        toast.success(t('academico.estructura.toast.deleted'))
        setDeleteId(null)
      },
      onError: () => {
        toast.error(t('academico.estructura.toast.deleteError'))
        setDeleteId(null)
      },
    })
  }

  return (
    <>
      <div className='card'>
        <div className='card-header border-0 pt-6'>
          <div className='card-title flex-column align-items-start'>
            <h3 className='fw-bold mb-1'>{t('academico.estructura.tab.sedes')}</h3>
            <span className='text-muted fs-7'>{t('academico.estructura.sede.subtitle')}</span>
          </div>
          <div className='card-toolbar'>
            <button type='button' className='btn btn-primary' onClick={openCreate}>
              <i className='ki-duotone ki-plus fs-2'></i>
              {t('academico.estructura.new')}
            </button>
          </div>
        </div>

        <div className='card-body pt-4'>
          {isLoading && (
            <div className='d-flex justify-content-center align-items-center py-15'>
              <span className='spinner-border text-primary me-3' role='status'></span>
              <span className='text-muted fs-6'>{t('academico.estructura.loading')}</span>
            </div>
          )}

          {isError && !isLoading && (
            <div className='alert alert-danger d-flex align-items-center my-5'>
              <i className='ki-duotone ki-information fs-2 text-danger me-3'>
                <span className='path1'></span>
                <span className='path2'></span>
                <span className='path3'></span>
              </i>
              <span>{t('academico.estructura.loadError')}</span>
            </div>
          )}

          {!isLoading && !isError && (
            <div className='table-responsive'>
              <table className='table table-row-dashed align-middle gs-0 gy-4'>
                <thead>
                  <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                    <th className='min-w-150px'>{t('academico.estructura.sede.nombre')}</th>
                    <th className='min-w-150px'>{t('academico.estructura.sede.col.coordinador')}</th>
                    <th className='min-w-150px'>{t('academico.estructura.sede.col.subdominio')}</th>
                    <th className='min-w-100px'>{t('academico.estructura.col.estado')}</th>
                    <th className='min-w-120px'>{t('academico.estructura.sede.col.tenant')}</th>
                    <th className='min-w-150px text-end'>{t('academico.estructura.col.actions')}</th>
                  </tr>
                </thead>
                <tbody className='text-gray-600 fw-semibold'>
                  {list.map((s) => {
                    const tenant = s.tenant_status ? tenantStatusBadge(s.tenant_status) : null
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className='d-flex align-items-center gap-2'>
                            <span className='text-gray-800 fw-bold'>{s.nombre}</span>
                            {s.es_principal && (
                              <span className='badge badge-light-primary'>
                                {t('academico.estructura.sede.principalBadge')}
                              </span>
                            )}
                          </div>
                          {s.telefono && <span className='text-muted fs-7'>{s.telefono}</span>}
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            <span className='text-gray-700'>{s.coordinador_email ?? '—'}</span>
                          </div>
                        </td>
                        <td>
                          {s.tenant_domain ? (
                            <span className='text-gray-700'>{s.tenant_domain}</span>
                          ) : (
                            <span className='text-muted'>—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              s.estado === 'activa'
                                ? 'badge badge-light-success'
                                : 'badge badge-light-secondary'
                            }
                          >
                            {t(
                              s.estado === 'activa'
                                ? 'academico.estructura.estado.activa'
                                : 'academico.estructura.estado.inactiva'
                            )}
                          </span>
                        </td>
                        <td>
                          {tenant ? (
                            <span className={tenant.cls}>{t(tenant.label)}</span>
                          ) : (
                            <span className='text-muted'>—</span>
                          )}
                        </td>
                        <td>
                          <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                            <button
                              type='button'
                              className='btn btn-light-primary btn-sm'
                              title={t('academico.sede.open')}
                              onClick={() => navigate(`/academico/sedes/${s.id}`)}
                            >
                              {t('academico.sede.open')}
                            </button>
                            <button
                              type='button'
                              className='btn btn-icon btn-light-primary btn-sm'
                              title={t('academico.estructura.edit')}
                              onClick={() => openEdit(s)}
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
                              onClick={() => setDeleteId(s)}
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
                        {t('academico.estructura.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <SedeFormDialog
        show={formOpen}
        sede={sedeEdit}
        onClose={() => {
          setFormOpen(false)
          setSedeEdit(null)
        }}
        onCreated={(email, password, url) => setCreds({email, password, url})}
      />
      <CoordinadorCredentialsDialog
        show={creds !== null}
        email={creds?.email ?? null}
        password={creds?.password ?? null}
        url={creds?.url ?? null}
        onClose={() => setCreds(null)}
      />
      <DeleteConfirmDialog
        show={deleteId !== null}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={del.isPending}
        onConfirm={onDelete}
        onClose={() => setDeleteId(null)}
      />
    </>
  )
}

export {SedesConfigTab}
