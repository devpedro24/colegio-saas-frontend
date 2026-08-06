import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useTenantSync} from '@/app/modules/auth/hooks/useTenantSync'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {
  useBloquesHorarios,
  useCreateBloqueHorario,
  useDeleteBloqueHorario,
  useJornadas,
  useUpdateBloqueHorario,
} from '../estructura.api'
import type {BloqueHorario, CreateBloqueHorarioInput} from '../estructura.types'
import {DeleteConfirmDialog} from './DeleteConfirmDialog'

const modalsRoot = document.getElementById('root-modals') || document.body

const emptyForm = (): CreateBloqueHorarioInput => ({
  jornada_id: '',
  nombre: '',
  hora_inicio: '',
  hora_fin: '',
  es_descanso: false,
  orden: 0,
  estado: 'activo',
})

const fromBloque = (b: BloqueHorario): CreateBloqueHorarioInput => ({
  jornada_id: b.jornada_id,
  nombre: b.nombre,
  hora_inicio: b.hora_inicio,
  hora_fin: b.hora_fin,
  es_descanso: b.es_descanso,
  orden: b.orden,
  estado: b.estado,
})

const BloqueFormDialog: FC<{show: boolean; bloque: BloqueHorario | null; onClose: () => void}> = ({
  show,
  bloque,
  onClose,
}) => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data: jornadas} = useJornadas()
  const create = useCreateBloqueHorario()
  const update = useUpdateBloqueHorario()
  const isEdit = bloque !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<CreateBloqueHorarioInput>(bloque ? fromBloque(bloque) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<CreateBloqueHorarioInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: CreateBloqueHorarioInput = {
      ...form,
      nombre: form.nombre.trim(),
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

    if (isEdit && bloque) {
      update.mutate(
        {id: bloque.id, input},
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
              {t('common.field.jornada')}
            </label>
            <select
              className={`form-select form-select-solid ${fe('jornada_id') ? 'is-invalid' : ''}`}
              value={form.jornada_id}
              onChange={(e) => set({jornada_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {(jornadas?.data ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre}
                </option>
              ))}
            </select>
            {fe('jornada_id') && <div className='invalid-feedback'>{fe('jornada_id')}</div>}
          </div>

          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.estructura.bloque.nombre')}
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
              placeholder={t('academico.estructura.bloque.nombrePh')}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
            {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>
                {t('academico.estructura.bloque.horaInicio')}
              </label>
              <input
                type='time'
                step={60}
                className={`form-control form-control-solid ${fe('hora_inicio') ? 'is-invalid' : ''}`}
                value={form.hora_inicio}
                onChange={(e) => set({hora_inicio: e.target.value})}
              />
              {fe('hora_inicio') && <div className='invalid-feedback'>{fe('hora_inicio')}</div>}
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>
                {t('academico.estructura.bloque.horaFin')}
              </label>
              <input
                type='time'
                step={60}
                className={`form-control form-control-solid ${fe('hora_fin') ? 'is-invalid' : ''}`}
                value={form.hora_fin}
                onChange={(e) => set({hora_fin: e.target.value})}
              />
              {fe('hora_fin') && <div className='invalid-feedback'>{fe('hora_fin')}</div>}
            </div>
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.bloque.orden')}</label>
              <input
                type='number'
                min={0}
                className={`form-control form-control-solid ${fe('orden') ? 'is-invalid' : ''}`}
                value={form.orden}
                onChange={(e) => set({orden: Number(e.target.value)})}
              />
              {fe('orden') && <div className='invalid-feedback'>{fe('orden')}</div>}
            </div>
            <div className='col-md-6 d-flex align-items-end fv-row mb-7'>
              <label className='form-check form-switch form-check-custom form-check-solid'>
                <input
                  className='form-check-input'
                  type='checkbox'
                  checked={form.es_descanso ?? false}
                  onChange={(e) => set({es_descanso: e.target.checked})}
                />
                <span className='form-check-label fw-semibold text-gray-700'>
                  {t('academico.estructura.bloque.descanso')}
                </span>
              </label>
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
              intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.bloqueHorario'})})
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const BloquesTab: FC = () => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, isError} = useBloquesHorarios()
  const del = useDeleteBloqueHorario()

  const [formOpen, setFormOpen] = useState(false)
  const [edit, setEdit] = useState<BloqueHorario | null>(null)
  const [deleteId, setDeleteId] = useState<BloqueHorario | null>(null)

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
          <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.bloqueHorario'})})}</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className='alert alert-danger d-flex align-items-center my-5'>
          <i className='ki-duotone ki-information fs-2 text-danger me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.bloqueHorario'})})}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div className='table-responsive'>
          <table className='table table-row-dashed align-middle gs-0 gy-4'>
            <thead>
              <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                <th className='min-w-120px'>{t('academico.estructura.bloque.nombre')}</th>
                <th className='min-w-150px'>{t('common.field.jornada')}</th>
                <th className='min-w-160px'>{t('academico.estructura.bloque.horaInicio')}</th>
                <th className='min-w-160px'>{t('academico.estructura.bloque.horaFin')}</th>
                <th className='min-w-100px'>{t('academico.estructura.bloque.orden')}</th>
                <th className='min-w-100px'>{t('academico.estructura.bloque.descanso')}</th>
                <th className='min-w-100px'>{t('common.status')}</th>
                <th className='min-w-150px text-end'>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {list.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className='text-gray-800 fw-bold'>{b.nombre}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{b.jornada?.nombre ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{b.hora_inicio}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{b.hora_fin}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{b.orden}</span>
                  </td>
                  <td>
                    {b.es_descanso ? (
                      <span className='badge badge-light-warning'>
                        {t('academico.estructura.bloque.descansoBadge')}
                      </span>
                    ) : (
                      <span className='text-gray-400'>—</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        b.estado === 'activo'
                          ? 'badge badge-light-success'
                          : 'badge badge-light-secondary'
                      }
                    >
                      {t(
                        b.estado === 'activo'
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
                        title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.bloqueHorario'})})}
                        onClick={() => {
                          setEdit(b)
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
                        title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.bloqueHorario'})})}
                        onClick={() => setDeleteId(b)}
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
                  <td colSpan={8} className='text-center text-muted py-10'>
                    {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.bloqueHorario'})})}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <BloqueFormDialog
        show={formOpen}
        bloque={edit}
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

export {BloquesTab}