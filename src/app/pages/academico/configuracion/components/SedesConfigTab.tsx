import {FC, useState, type FormEvent} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useNavigate} from 'react-router-dom'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreateSede, useDeleteSede, useSedes, useUpdateSede} from '../../estructura/estructura.api'
import type {CreateSedeInput, Sede} from '../../estructura/estructura.types'
import {DeleteConfirmDialog} from '../../estructura/components/DeleteConfirmDialog'

const modalsRoot = document.getElementById('root-modals') || document.body

const emptyForm = (): CreateSedeInput => ({
  nombre: '',
  direccion: '',
  telefono: '',
  responsable: '',
  es_principal: false,
  estado: 'activa',
})

const fromSede = (s: Sede): CreateSedeInput => ({
  nombre: s.nombre,
  direccion: s.direccion ?? '',
  telefono: s.telefono ?? '',
  responsable: s.responsable ?? '',
  es_principal: s.es_principal,
  estado: s.estado,
})

// Modal crear/editar sede.
const SedeFormDialog: FC<{
  show: boolean
  sede: Sede | null
  onClose: () => void
}> = ({show, sede, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
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
    const input: CreateSedeInput = {
      ...form,
      nombre: form.nombre.trim(),
      direccion: form.direccion?.trim() || null,
      telefono: form.telefono?.trim() || null,
      responsable: form.responsable?.trim() || null,
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
        onSuccess: () => {
          toast.success(t('academico.estructura.toast.created'))
          onClose()
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
          {isEdit ? t('academico.estructura.edit.title') : t('academico.estructura.create.title')}
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

          <div className='fv-row mb-7'>
            <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.sede.direccion')}</label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('direccion') ? 'is-invalid' : ''}`}
              value={form.direccion ?? ''}
              onChange={(e) => set({direccion: e.target.value})}
            />
            {fe('direccion') && <div className='invalid-feedback'>{fe('direccion')}</div>}
          </div>

          <div className='row'>
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
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.estructura.sede.responsable')}
              </label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('responsable') ? 'is-invalid' : ''}`}
                value={form.responsable ?? ''}
                onChange={(e) => set({responsable: e.target.value})}
              />
              {fe('responsable') && <div className='invalid-feedback'>{fe('responsable')}</div>}
            </div>
          </div>

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
        </div>
        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={pending}>
            {pending ? (
              <span className='spinner-border spinner-border-sm align-middle'></span>
            ) : (
              t('academico.estructura.save')
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

// Tab Sedes (Configuración del colegio): tabla + crear/editar/eliminar + abrir detalle de sede.
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
      <div className='d-flex justify-content-end mb-4'>
        <button type='button' className='btn btn-primary' onClick={openCreate}>
          <i className='ki-duotone ki-plus fs-2'></i>
          {t('academico.estructura.new')}
        </button>
      </div>

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
                <th className='min-w-200px'>{t('academico.estructura.sede.direccion')}</th>
                <th className='min-w-120px'>{t('academico.estructura.sede.responsable')}</th>
                <th className='min-w-100px'>{t('academico.estructura.col.estado')}</th>
                <th className='min-w-150px text-end'>{t('academico.estructura.col.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {list.map((s) => (
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
                    <span className='text-gray-700'>{s.direccion ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{s.responsable ?? '—'}</span>
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
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className='text-center text-muted py-10'>
                    {t('academico.estructura.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <SedeFormDialog
        show={formOpen}
        sede={sedeEdit}
        onClose={() => {
          setFormOpen(false)
          setSedeEdit(null)
        }}
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
