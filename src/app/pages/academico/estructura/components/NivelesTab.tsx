import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreateNivel, useDeleteNivel, useNiveles, useUpdateNivel} from '../estructura.api'
import type {CreateNivelInput, Nivel} from '../estructura.types'
import {DeleteConfirmDialog} from './DeleteConfirmDialog'

const modalsRoot = document.getElementById('root-modals') || document.body

const emptyForm = (): CreateNivelInput => ({
  nivel_educativo: '',
  nombre: '',
  orden: 0,
  estado: 'activo',
})

const fromNivel = (n: Nivel): CreateNivelInput => ({
  nivel_educativo: n.nivel_educativo,
  nombre: n.nombre,
  orden: n.orden,
  estado: n.estado,
})

const NivelFormDialog: FC<{show: boolean; nivel: Nivel | null; onClose: () => void}> = ({
  show,
  nivel,
  onClose,
}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreateNivel()
  const update = useUpdateNivel()
  const isEdit = nivel !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<CreateNivelInput>(nivel ? fromNivel(nivel) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<CreateNivelInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: CreateNivelInput = {
      ...form,
      nivel_educativo: form.nivel_educativo.trim(),
      nombre: form.nombre.trim(),
      orden: Number(form.orden) || 0,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('academico.estructura.toast.saveError'))
      }
    }

    if (isEdit && nivel) {
      update.mutate(
        {id: nivel.id, input},
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
              {t('academico.estructura.nivel.nivelEducativo')}
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('nivel_educativo') ? 'is-invalid' : ''}`}
              placeholder={t('academico.estructura.nivel.nivelEducativoPh')}
              value={form.nivel_educativo}
              disabled={isEdit}
              onChange={(e) => set({nivel_educativo: e.target.value})}
            />
            {fe('nivel_educativo') && <div className='invalid-feedback'>{fe('nivel_educativo')}</div>}
          </div>

          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.estructura.nivel.nombre')}
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
              placeholder={t('academico.estructura.nivel.nombrePh')}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
            {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
          </div>

          <div className='fv-row'>
            <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.nivel.orden')}</label>
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

const NivelesTab: FC = () => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)
  const toast = useToast()
  const {data, isLoading, isError} = useNiveles()
  const del = useDeleteNivel()

  const [formOpen, setFormOpen] = useState(false)
  const [edit, setEdit] = useState<Nivel | null>(null)
  const [deleteId, setDeleteId] = useState<Nivel | null>(null)

  const list = data ?? []

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
                <th className='min-w-150px'>{t('academico.estructura.nivel.nombre')}</th>
                <th className='min-w-150px'>{t('academico.estructura.nivel.nivelEducativo')}</th>
                <th className='min-w-100px'>{t('academico.estructura.nivel.orden')}</th>
                <th className='min-w-120px'>{t('academico.estructura.grado.nombre')}</th>
                <th className='min-w-100px'>{t('academico.estructura.col.estado')}</th>
                <th className='min-w-150px text-end'>{t('academico.estructura.col.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {list.map((n) => (
                <tr key={n.id}>
                  <td>
                    <span className='text-gray-800 fw-bold'>{n.nombre}</span>
                  </td>
                  <td>
                    <span className='badge badge-light-info'>{n.nivel_educativo}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{n.orden}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>
                      {t('academico.estructura.nivel.gradosCount', {count: n.grados_count ?? 0})}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        n.estado === 'activo'
                          ? 'badge badge-light-success'
                          : 'badge badge-light-secondary'
                      }
                    >
                      {t(
                        n.estado === 'activo'
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
                        title={t('academico.estructura.edit')}
                        onClick={() => {
                          setEdit(n)
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
                        title={t('academico.estructura.delete')}
                        onClick={() => setDeleteId(n)}
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
                    {t('academico.estructura.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <NivelFormDialog
        show={formOpen}
        nivel={edit}
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
              toast.success(t('academico.estructura.toast.deleted'))
              setDeleteId(null)
            },
            onError: () => {
              toast.error(t('academico.estructura.toast.deleteError'))
              setDeleteId(null)
            },
          })
        }}
        onClose={() => setDeleteId(null)}
      />
    </>
  )
}

export {NivelesTab}