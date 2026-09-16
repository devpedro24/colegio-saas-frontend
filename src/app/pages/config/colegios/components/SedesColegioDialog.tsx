import {FC, useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {tenantOrigin} from '@/lib/subdomain'
import {useToast} from '@/lib/ui/toast'
import {
  useColegioSedes,
  useCreateColegioSede,
  useDeleteColegioSede,
  useUpdateColegioSede,
} from '../colegios.api'
import {
  Colegio,
  ColegioSede,
  CreateColegioSedeInput,
  UpdateColegioSedeInput,
} from '../colegios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  colegio: Colegio | null
  onClose: () => void
}

type SedeForm = CreateColegioSedeInput

type CoordinatorCredentials = {
  email: string
  password: string
  url: string | null
}

const EMPTY_FORM: SedeForm = {
  nombre: '',
  slug: '',
  direccion: '',
  coordinador_name: '',
  coordinador_email: '',
  heredar: true,
  estado: 'activa',
}

// Modal "Sedes del colegio": el superadmin lista y administra las sedes de un
// colegio (viven en la BD del tenant) via /colegios/{id}/sedes.
const SedesColegioDialog: FC<Props> = ({show, colegio, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()

  const id = show ? colegio?.id ?? null : null
  const {data, isLoading, isError} = useColegioSedes(id)
  const create = useCreateColegioSede()
  const update = useUpdateColegioSede()
  const remove = useDeleteColegioSede()

  const [form, setForm] = useState<SedeForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [credentials, setCredentials] = useState<CoordinatorCredentials | null>(null)

  useEffect(() => {
    if (!show) {
      setForm(EMPTY_FORM)
      setCreating(false)
      setEditingId(null)
      setDeleteId(null)
      setError(null)
      setCredentials(null)
      create.reset()
      update.reset()
      remove.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  const sedes = data?.data ?? []

  const startCreate = () => {
    setCreating(true)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  const startEdit = (sede: ColegioSede) => {
    setCreating(false)
    setDeleteId(null)
    setEditingId(sede.id)
    setForm({
      nombre: sede.nombre,
      slug: sede.tenant_slug ?? '',
      direccion: sede.direccion ?? '',
      coordinador_name: sede.coordinador_name ?? '',
      coordinador_email: sede.coordinador_email ?? '',
      heredar: true,
      estado: sede.estado,
    })
    setError(null)
  }

  const closeForm = () => {
    setCreating(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const set = (patch: Partial<SedeForm>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!id) return

    if (editingId !== null) {
      const input: UpdateColegioSedeInput = {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        estado: form.estado,
      }

      update.mutate(
        {id, sedeId: editingId, input},
        {
          onSuccess: () => {
            toast.success(t('common.toast.updated'))
            closeForm()
          },
          onError: (err) => {
            if (err instanceof ApiError) {
              setError(err)
              if (!err.errors) toast.error(err.message)
            } else {
              toast.error(t('common.toast.genericError'))
            }
          },
        }
      )
    } else {
      const input: CreateColegioSedeInput = {
        nombre: form.nombre.trim(),
        slug: form.slug.trim().toLowerCase(),
        direccion: form.direccion.trim(),
        coordinador_name: form.coordinador_name?.trim() || null,
        coordinador_email: form.coordinador_email?.trim() || null,
        heredar: form.heredar ?? true,
        estado: form.estado,
      }

      create.mutate(
        {id, input},
        {
          onSuccess: (response) => {
            toast.success(t('common.toast.created'))
            setForm(EMPTY_FORM)
            setCreating(false)

            if (response.coordinador_password && response.data.coordinador_email) {
              setCredentials({
                email: response.data.coordinador_email,
                password: response.coordinador_password,
                url: response.data.tenant_domain
                  ? tenantOrigin(response.data.tenant_domain)
                  : null,
              })
            }
          },
          onError: (err) => {
            if (err instanceof ApiError) {
              setError(err)
              if (!err.errors) toast.error(err.message)
            } else {
              toast.error(t('common.toast.genericError'))
            }
          },
        }
      )
    }
  }

  const handleDelete = (sede: ColegioSede) => {
    if (!id) return
    remove.mutate(
      {id, sedeId: sede.id},
      {
        onSuccess: () => {
          toast.success(t('common.toast.deleted'))
          setDeleteId(null)
        },
        onError: (err) => {
          const message = err instanceof ApiError ? err.message : t('common.toast.genericError')
          toast.error(message)
          setDeleteId(null)
        },
      }
    )
  }

  const fe = (field: string): string | undefined => error?.fieldError(field)

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value).then(() => toast.success(t('common.pwd.copied')))
  }

  const pending =
    (create.isPending || update.isPending) && (create.variables ?? update.variables)?.id === id

  return createPortal(
    <Modal
      id='kt_modal_colegio_sedes'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-700px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {credentials
            ? t('academico.estructura.sede.password.title')
            : t('colegios.sedes.title')}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      <div className='modal-body py-lg-10 px-lg-10'>
        {!credentials && (
          <div className='text-muted fs-7 mb-6'>
            {intl.formatMessage({id: 'colegios.sedes.subtitle'}, {name: colegio?.name ?? ''})}
          </div>
        )}

        {credentials && (
          <div>
            <div className='alert alert-info d-flex align-items-start mb-7'>
              <i className='ki-duotone ki-information-3 fs-2 me-3'>
                <span className='path1'></span>
                <span className='path2'></span>
                <span className='path3'></span>
              </i>
              <div>
                <div>{t('academico.estructura.sede.password.text')}</div>
                <div className='fw-semibold mt-1'>{t('common.pwd.once')}</div>
              </div>
            </div>

            <div className='fv-row mb-6'>
              <label className='fs-6 fw-semibold mb-2 text-muted'>{t('common.email')}</label>
              <input
                type='text'
                className='form-control form-control-solid'
                value={credentials.email}
                readOnly
              />
            </div>
            <div className='fv-row mb-6'>
              <label className='fs-6 fw-semibold mb-2 text-muted'>{t('common.password')}</label>
              <div className='d-flex align-items-stretch gap-2'>
                <input
                  type='text'
                  className='form-control form-control-solid font-monospace fw-bold'
                  value={credentials.password}
                  readOnly
                />
                <button
                  type='button'
                  className='btn btn-icon btn-light-primary'
                  onClick={() => copy(credentials.password)}
                  title={t('common.pwd.copy')}
                >
                  <i className='ki-duotone ki-copy fs-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                  </i>
                </button>
              </div>
            </div>
            {credentials.url && (
              <div className='fv-row'>
                <label className='fs-6 fw-semibold mb-2 text-muted'>
                  {t('academico.estructura.sede.password.url')}
                </label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={credentials.url}
                  readOnly
                />
              </div>
            )}
          </div>
        )}

        {!credentials && isLoading && (
          <div className='d-flex justify-content-center align-items-center py-10'>
            <span className='spinner-border text-primary' role='status'></span>
          </div>
        )}

        {!credentials && isError && !isLoading && (
          <div className='alert alert-danger d-flex align-items-center py-3'>
            <i className='ki-duotone ki-information fs-2 text-danger me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.sede'})})}</span>
          </div>
        )}

        {!credentials && !isLoading && !isError && (
          <>
            {/* Formulario crear/editar */}
            {creating || editingId !== null ? (
              <form onSubmit={handleSubmit} className='mb-7'>
                <div className='rounded border border-dashed border-gray-300 p-4'>
                  <div className='row'>
                    <div className={`${editingId === null ? 'col-md-6' : 'col-12'} fv-row mb-4`}>
                      <label className='required fs-7 fw-semibold mb-2'>
                        {t('colegios.sedes.field.name')}
                      </label>
                      <input
                        type='text'
                        className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
                        placeholder={t('colegios.sedes.field.namePh')}
                        value={form.nombre}
                        onChange={(e) => set({nombre: e.target.value})}
                      />
                      {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
                    </div>
                    {editingId === null && (
                      <div className='col-md-6 fv-row mb-4'>
                        <label className='required fs-7 fw-semibold mb-2'>
                          {t('academico.estructura.sede.slug')}
                        </label>
                        <input
                          type='text'
                          className={`form-control form-control-solid ${fe('slug') ? 'is-invalid' : ''}`}
                          placeholder={t('academico.estructura.sede.slugPh')}
                          value={form.slug}
                          onChange={(e) => set({slug: e.target.value})}
                        />
                        {fe('slug') && <div className='invalid-feedback'>{fe('slug')}</div>}
                        {!fe('slug') && (
                          <div className='form-text'>
                            {intl.formatMessage(
                              {id: 'academico.estructura.sede.slugHelp'},
                              {
                                domain: form.slug
                                  ? `${form.slug.toLowerCase()}.${colegio?.slug ?? ''}`
                                  : '...',
                              }
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className='fv-row mb-4'>
                    <label className='required fs-7 fw-semibold mb-2'>{t('common.address')}</label>
                    <input
                      type='text'
                      className={`form-control form-control-solid ${fe('direccion') ? 'is-invalid' : ''}`}
                      value={form.direccion}
                      onChange={(e) => set({direccion: e.target.value})}
                    />
                    {fe('direccion') && <div className='invalid-feedback'>{fe('direccion')}</div>}
                  </div>

                  {editingId === null && (
                    <>
                      <div className='separator separator-dashed my-5'></div>
                      <div className='row'>
                        <div className='col-md-6 fv-row mb-4'>
                          <label className='fs-7 fw-semibold mb-2'>
                            {t('academico.estructura.sede.coordinadorNombre')}
                          </label>
                          <input
                            type='text'
                            className={`form-control form-control-solid ${fe('coordinador_name') ? 'is-invalid' : ''}`}
                            placeholder={t('academico.estructura.sede.coordinadorNombrePh')}
                            value={form.coordinador_name ?? ''}
                            onChange={(e) => set({coordinador_name: e.target.value})}
                          />
                          {fe('coordinador_name') && (
                            <div className='invalid-feedback'>{fe('coordinador_name')}</div>
                          )}
                        </div>
                        <div className='col-md-6 fv-row mb-4'>
                          <label className='fs-7 fw-semibold mb-2'>
                            {t('academico.estructura.sede.coordinadorEmail')}
                          </label>
                          <input
                            type='email'
                            className={`form-control form-control-solid ${fe('coordinador_email') ? 'is-invalid' : ''}`}
                            placeholder={t('academico.estructura.sede.coordinadorEmailPh')}
                            value={form.coordinador_email ?? ''}
                            onChange={(e) => set({coordinador_email: e.target.value})}
                          />
                          {fe('coordinador_email') && (
                            <div className='invalid-feedback'>{fe('coordinador_email')}</div>
                          )}
                        </div>
                      </div>
                      <label className='form-check form-switch form-check-custom form-check-solid mb-4'>
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
                    </>
                  )}

                  <div className='d-flex align-items-center justify-content-between flex-wrap gap-3'>
                    <select
                      className='form-select form-select-solid w-150px'
                      value={form.estado ?? 'activa'}
                      onChange={(e) =>
                        set({estado: e.target.value as SedeForm['estado']})
                      }
                    >
                      <option value='activa'>{t('common.active')}</option>
                      <option value='inactiva'>{t('common.inactive')}</option>
                    </select>
                    <div className='d-flex gap-2'>
                      <button type='button' className='btn btn-light btn-sm' onClick={closeForm}>
                        {t('common.cancel')}
                      </button>
                      <button type='submit' className='btn btn-primary btn-sm' disabled={pending}>
                        {pending ? (
                          <span className='indicator-progress d-block'>
                            {t('common.pleaseWait')}
                            <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                          </span>
                        ) : (
                          intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.sede'})})
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <button type='button' className='btn btn-light-primary btn-sm mb-6' onClick={startCreate}>
                <i className='ki-duotone ki-plus fs-4'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
                {t('colegios.sedes.add')}
              </button>
            )}

            {/* Lista */}
            {sedes.length === 0 ? (
              <div className='text-center text-muted py-10 fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.sede'})})}</div>
            ) : (
              <div className='table-responsive'>
                <table className='table table-row-dashed align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                      <th className='min-w-200px'>{t('common.name')}</th>
                      <th>{t('common.address')}</th>
                      <th className='text-end min-w-140px'>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className='text-gray-600 fw-semibold'>
                    {sedes.map((sede) => (
                      <tr key={sede.id}>
                        <td>
                          <div className='d-flex flex-column'>
                            <div className='d-flex align-items-center gap-2'>
                              <span className='text-gray-800 fw-bold'>{sede.nombre}</span>
                              {sede.tenant_id === null && (
                                <span className='badge badge-light-primary'>
                                  {t('colegios.sedes.principal')}
                                </span>
                              )}
                              <span
                                className={
                                  sede.estado === 'activa'
                                    ? 'badge badge-light-success'
                                    : 'badge badge-light-secondary'
                                }
                              >
                                {sede.estado === 'activa'
                                  ? t('common.active')
                                  : t('common.inactive')}
                              </span>
                            </div>
                            {sede.coordinador_name && (
                              <span className='text-muted fs-7'>{sede.coordinador_name}</span>
                            )}
                            {sede.coordinador_email && (
                              <span className='text-muted fs-7'>{sede.coordinador_email}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className='text-gray-700'>{sede.direccion ?? '—'}</span>
                          {sede.telefono && (
                            <span className='text-muted fs-7 d-block'>{sede.telefono}</span>
                          )}
                        </td>
                        <td>
                          {deleteId === sede.id ? (
                            <div className='d-flex align-items-center justify-content-end gap-2'>
                              <span className='text-muted fs-7'>
                                {intl.formatMessage(
                                  {id: 'common.confirmDelete'},
                                  {name: sede.nombre}
                                )}
                              </span>
                              <button
                                type='button'
                                className='btn btn-sm btn-light'
                                onClick={() => setDeleteId(null)}
                              >
                                {t('common.cancel')}
                              </button>
                              <button
                                type='button'
                                className='btn btn-sm btn-danger'
                                disabled={remove.isPending}
                                onClick={() => handleDelete(sede)}
                              >
                                {intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.sede'})})}
                              </button>
                            </div>
                          ) : (
                            <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                              <button
                                type='button'
                                className='btn btn-icon btn-light-primary btn-sm me-2'
                                title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.sede'})})}
                                onClick={() => startEdit(sede)}
                              >
                                <i className='ki-duotone ki-pencil fs-5'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              {sede.tenant_id !== null && (
                                <button
                                  type='button'
                                  className='btn btn-icon btn-light btn-sm'
                                  title={intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.sede'})})}
                                  onClick={() => setDeleteId(sede.id)}
                                >
                                  <i className='ki-duotone ki-trash fs-5'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {SedesColegioDialog}
