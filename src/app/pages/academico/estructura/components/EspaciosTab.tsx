import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {
  useCreateEspacioFisico,
  useDeleteEspacioFisico,
  useEspaciosFisicos,
  useSedes,
  useUpdateEspacioFisico,
} from '../estructura.api'
import type {CreateEspacioFisicoInput, EspacioFisico} from '../estructura.types'
import {DeleteConfirmDialog} from './DeleteConfirmDialog'

const modalsRoot = document.getElementById('root-modals') || document.body

const TIPOS = ['aula', 'laboratorio', 'biblioteca', 'auditorio', 'patio', 'otro'] as const

const emptyForm = (): CreateEspacioFisicoInput => ({
  sede_id: null,
  nombre: '',
  tipo: 'aula',
  capacidad: null,
  ubicacion: '',
  estado: 'disponible',
})

const fromEspacio = (e: EspacioFisico): CreateEspacioFisicoInput => ({
  sede_id: e.sede_id,
  nombre: e.nombre,
  tipo: e.tipo,
  capacidad: e.capacidad,
  ubicacion: e.ubicacion ?? '',
  estado: e.estado,
})

const tipoLabel = (t: (id: string) => string, tipo: string): string => {
  const key = `academico.estructura.espacio.tipo.${tipo}`
  return TIPOS.includes(tipo as (typeof TIPOS)[number]) ? t(key) : tipo
}

const EspacioFormDialog: FC<{show: boolean; espacio: EspacioFisico | null; onClose: () => void}> = ({
  show,
  espacio,
  onClose,
}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data: sedes} = useSedes()
  const create = useCreateEspacioFisico()
  const update = useUpdateEspacioFisico()
  const isEdit = espacio !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<CreateEspacioFisicoInput>(
    espacio ? fromEspacio(espacio) : emptyForm()
  )
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<CreateEspacioFisicoInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: CreateEspacioFisicoInput = {
      ...form,
      nombre: form.nombre.trim(),
      ubicacion: form.ubicacion?.trim() || null,
      capacidad: form.capacidad ? Number(form.capacidad) : null,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('academico.estructura.toast.saveError'))
      }
    }

    if (isEdit && espacio) {
      update.mutate(
        {id: espacio.id, input},
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
              {t('academico.estructura.espacio.nombre')}
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
              placeholder={t('academico.estructura.espacio.nombrePh')}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
            {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>
                {t('academico.estructura.espacio.tipo')}
              </label>
              <select
                className={`form-select form-select-solid ${fe('tipo') ? 'is-invalid' : ''}`}
                value={form.tipo}
                onChange={(e) => set({tipo: e.target.value})}
              >
                {TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipoLabel(t, tipo)}
                  </option>
                ))}
              </select>
              {fe('tipo') && <div className='invalid-feedback'>{fe('tipo')}</div>}
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.estructura.espacio.capacidad')}
              </label>
              <input
                type='number'
                min={1}
                max={9999}
                className={`form-control form-control-solid ${fe('capacidad') ? 'is-invalid' : ''}`}
                value={form.capacidad ?? ''}
                onChange={(e) => set({capacidad: e.target.value ? Number(e.target.value) : null})}
              />
              {fe('capacidad') && <div className='invalid-feedback'>{fe('capacidad')}</div>}
            </div>
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.espacio.sede')}</label>
              <select
                className={`form-select form-select-solid ${fe('sede_id') ? 'is-invalid' : ''}`}
                value={form.sede_id ?? ''}
                onChange={(e) => set({sede_id: e.target.value || null})}
              >
                <option value=''>{t('common.select')}</option>
                {(sedes ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              {fe('sede_id') && <div className='invalid-feedback'>{fe('sede_id')}</div>}
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.estructura.espacio.ubicacion')}
              </label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('ubicacion') ? 'is-invalid' : ''}`}
                value={form.ubicacion ?? ''}
                onChange={(e) => set({ubicacion: e.target.value})}
              />
              {fe('ubicacion') && <div className='invalid-feedback'>{fe('ubicacion')}</div>}
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
              t('academico.estructura.save')
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const EspaciosTab: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, isError} = useEspaciosFisicos()
  const del = useDeleteEspacioFisico()

  const [formOpen, setFormOpen] = useState(false)
  const [edit, setEdit] = useState<EspacioFisico | null>(null)
  const [deleteId, setDeleteId] = useState<EspacioFisico | null>(null)

  const list = data ?? []

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'badge badge-light-success'
      case 'ocupado':
        return 'badge badge-light-primary'
      case 'mantenimiento':
        return 'badge badge-light-warning'
      default:
        return 'badge badge-light-secondary'
    }
  }

  const estadoKey = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'academico.estructura.estado.disponible'
      case 'ocupado':
        return 'academico.estructura.estado.ocupado'
      case 'mantenimiento':
        return 'academico.estructura.estado.mantenimiento'
      default:
        return 'academico.estructura.estado.inactivo'
    }
  }

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
                <th className='min-w-160px'>{t('academico.estructura.espacio.nombre')}</th>
                <th className='min-w-120px'>{t('academico.estructura.espacio.tipo')}</th>
                <th className='min-w-100px'>{t('academico.estructura.espacio.capacidad')}</th>
                <th className='min-w-140px'>{t('academico.estructura.espacio.ubicacion')}</th>
                <th className='min-w-140px'>{t('academico.estructura.espacio.sede')}</th>
                <th className='min-w-120px'>{t('academico.estructura.col.estado')}</th>
                <th className='min-w-150px text-end'>{t('academico.estructura.col.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {list.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className='text-gray-800 fw-bold'>{e.nombre}</span>
                  </td>
                  <td>
                    <span className='badge badge-light'>{tipoLabel(t, e.tipo)}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{e.capacidad ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{e.ubicacion ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{e.sede?.nombre ?? '—'}</span>
                  </td>
                  <td>
                    <span className={estadoBadge(e.estado)}>{t(estadoKey(e.estado))}</span>
                  </td>
                  <td>
                    <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                      <button
                        type='button'
                        className='btn btn-icon btn-light-primary btn-sm'
                        title={t('academico.estructura.edit')}
                        onClick={() => {
                          setEdit(e)
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
                        onClick={() => setDeleteId(e)}
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
                  <td colSpan={7} className='text-center text-muted py-10'>
                    {t('academico.estructura.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <EspacioFormDialog
        show={formOpen}
        espacio={edit}
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

export {EspaciosTab}