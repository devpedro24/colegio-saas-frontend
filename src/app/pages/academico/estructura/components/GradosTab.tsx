import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useTenantSync} from '@/app/modules/auth/hooks/useTenantSync'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreateGrado, useDeleteGrado, useGrados, useNiveles, useUpdateGrado} from '../estructura.api'
import type {CreateGradoInput, Grado} from '../estructura.types'
import {DeleteConfirmDialog} from './DeleteConfirmDialog'

const modalsRoot = document.getElementById('root-modals') || document.body

const emptyForm = (): CreateGradoInput => ({
  nivel_id: '',
  nombre: '',
  codigo: '',
  orden: 0,
  estado: 'activo',
})

const fromGrado = (g: Grado): CreateGradoInput => ({
  nivel_id: g.nivel_id,
  nombre: g.nombre,
  codigo: g.codigo ?? '',
  orden: g.orden,
  estado: g.estado,
})

const GradoFormDialog: FC<{show: boolean; grado: Grado | null; onClose: () => void}> = ({
  show,
  grado,
  onClose,
}) => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data: niveles} = useNiveles()
  const create = useCreateGrado()
  const update = useUpdateGrado()
  const isEdit = grado !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<CreateGradoInput>(grado ? fromGrado(grado) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<CreateGradoInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: CreateGradoInput = {
      ...form,
      nombre: form.nombre.trim(),
      codigo: form.codigo?.trim() || null,
      orden: Number(form.orden) || 0,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (isEdit && grado) {
      update.mutate(
        {id: grado.id, input},
        {
          onSuccess: () => {
            toast.success(t('common.toast.updated'))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success(t('common.toast.created'))
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
              {t('common.field.nivel')}
            </label>
            <select
              className={`form-select form-select-solid ${fe('nivel_id') ? 'is-invalid' : ''}`}
              value={form.nivel_id}
              onChange={(e) => set({nivel_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {(niveles?.data ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre}
                </option>
              ))}
            </select>
            {fe('nivel_id') && <div className='invalid-feedback'>{fe('nivel_id')}</div>}
          </div>

          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.estructura.grado.nombre')}
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
              placeholder={t('academico.estructura.grado.nombrePh')}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
            {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.grado.codigo')}</label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('codigo') ? 'is-invalid' : ''}`}
                placeholder={t('academico.estructura.grado.codigoPh')}
                value={form.codigo ?? ''}
                onChange={(e) => set({codigo: e.target.value})}
              />
              {fe('codigo') && <div className='invalid-feedback'>{fe('codigo')}</div>}
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.grado.orden')}</label>
              <input
                type='number'
                min={0}
                className={`form-control form-control-solid ${fe('orden') ? 'is-invalid' : ''}`}
                value={form.orden}
                onChange={(e) => set({orden: Number(e.target.value)})}
              />
              {fe('orden') && <div className='invalid-feedback'>{fe('orden')}</div>}
            </div>
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
              intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.grado'})})
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const GradosTab: FC = () => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, isError} = useGrados()
  const del = useDeleteGrado()

  const [formOpen, setFormOpen] = useState(false)
  const [edit, setEdit] = useState<Grado | null>(null)
  const [deleteId, setDeleteId] = useState<Grado | null>(null)

  const list = data?.data ?? []

  return (
    <>
      <div className='d-flex justify-content-end mb-4'>
        <button
          type='button'
          className='btn btn-primary'
          onClick={() => {
            setEdit(null)
            setFormOpen(true)
          }}
        >
          <i className='ki-duotone ki-plus fs-2'></i>
          {t('academico.estructura.new')}
        </button>
      </div>

      {isLoading && (
        <div className='d-flex justify-content-center align-items-center py-15'>
          <span className='spinner-border text-primary me-3' role='status'></span>
          <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.grado'})})}</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className='alert alert-danger d-flex align-items-center my-5'>
          <i className='ki-duotone ki-information fs-2 text-danger me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.grado'})})}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div className='table-responsive'>
          <table className='table table-row-dashed align-middle gs-0 gy-4'>
            <thead>
              <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                <th className='min-w-150px'>{t('academico.estructura.grado.nombre')}</th>
                <th className='min-w-150px'>{t('academico.estructura.grado.codigo')}</th>
                <th className='min-w-150px'>{t('common.field.nivel')}</th>
                <th className='min-w-100px'>{t('academico.estructura.grado.orden')}</th>
                <th className='min-w-100px'>{t('common.status')}</th>
                <th className='min-w-150px text-end'>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {list.map((g) => (
                <tr key={g.id}>
                  <td>
                    <span className='text-gray-800 fw-bold'>{g.nombre}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{g.codigo ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{g.nivel?.nombre ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{g.orden}</span>
                  </td>
                  <td>
                    <span
                      className={
                        g.estado === 'activo'
                          ? 'badge badge-light-success'
                          : 'badge badge-light-secondary'
                      }
                    >
                      {t(
                        g.estado === 'activo'
                          ? 'academico.estructura.estado.activo'
                          : 'academico.estructura.estado.inactivo'
                      )}
                    </span>
                  </td>
                  <td>
                    <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                      <button
                        type='button'
                        className='btn btn-icon btn-light-primary btn-sm'
                        title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.grado'})})}
                        onClick={() => {
                          setEdit(g)
                          setFormOpen(true)
                        }}
                      >
                        <i className='ki-duotone ki-pencil fs-5'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                      </button>
                      <button
                        type='button'
                        className='btn btn-icon btn-light-danger btn-sm'
                        title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.grado'})})}
                        onClick={() => setDeleteId(g)}
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
                  <td colSpan={6} className='text-center text-muted py-10'>
                    {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.grado'})})}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <GradoFormDialog
        show={formOpen}
        grado={edit}
        onClose={() => {
          setFormOpen(false)
          setEdit(null)
        }}
      />
      <DeleteConfirmDialog
        show={deleteId !== null}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={del.isPending}
        onConfirm={() => {
          if (!deleteId) return
          del.mutate(deleteId.id, {
            onSuccess: () => {
              toast.success(t('common.toast.deleted'))
              setDeleteId(null)
            },
            onError: () => {
              toast.error(t('common.toast.deleteError'))
              setDeleteId(null)
            },
          })
        }}
        onClose={() => setDeleteId(null)}
      />
    </>
  )
}

export {GradosTab}