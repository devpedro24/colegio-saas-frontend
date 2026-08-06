import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useTenantSync} from '@/app/modules/auth/hooks/useTenantSync'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAnosLectivos} from '../../anos-lectivos/anos-lectivos.api'
import {
  useCreateGrupo,
  useDeleteGrupo,
  useGrados,
  useGrupos,
  useJornadas,
  useSedes,
  useUpdateGrupo,
} from '../estructura.api'
import type {CreateGrupoInput, Grupo} from '../estructura.types'
import {DeleteConfirmDialog} from './DeleteConfirmDialog'

const modalsRoot = document.getElementById('root-modals') || document.body

const emptyForm = (): CreateGrupoInput => ({
  grado_id: '',
  ano_lectivo_id: '',
  jornada_id: null,
  sede_id: null,
  nombre: '',
  cupo_maximo: null,
  estado: 'activo',
})

const fromGrupo = (g: Grupo): CreateGrupoInput => ({
  grado_id: g.grado_id,
  ano_lectivo_id: g.ano_lectivo_id,
  jornada_id: g.jornada_id,
  sede_id: g.sede_id,
  nombre: g.nombre,
  cupo_maximo: g.cupo_maximo,
  estado: g.estado,
})

const GrupoFormDialog: FC<{show: boolean; grupo: Grupo | null; onClose: () => void}> = ({
  show,
  grupo,
  onClose,
}) => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data: anos} = useAnosLectivos()
  const {data: grados} = useGrados()
  const {data: jornadas} = useJornadas()
  const {data: sedes} = useSedes()
  const create = useCreateGrupo()
  const update = useUpdateGrupo()
  const isEdit = grupo !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<CreateGrupoInput>(grupo ? fromGrupo(grupo) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<CreateGrupoInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: CreateGrupoInput = {
      ...form,
      nombre: form.nombre.trim(),
      cupo_maximo: form.cupo_maximo ? Number(form.cupo_maximo) : null,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (isEdit && grupo) {
      update.mutate(
        {id: grupo.id, input},
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
              {t('common.field.anoLectivo')}
            </label>
            <select
              className={`form-select form-select-solid ${fe('ano_lectivo_id') ? 'is-invalid' : ''}`}
              value={form.ano_lectivo_id}
              onChange={(e) => set({ano_lectivo_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {(anos?.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            {fe('ano_lectivo_id') && <div className='invalid-feedback'>{fe('ano_lectivo_id')}</div>}
          </div>

          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.estructura.grupo.grado')}
            </label>
            <select
              className={`form-select form-select-solid ${fe('grado_id') ? 'is-invalid' : ''}`}
              value={form.grado_id}
              onChange={(e) => set({grado_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {(grados?.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nivel?.nombre ? `${g.nivel.nombre} / ` : ''}
                  {g.nombre}
                </option>
              ))}
            </select>
            {fe('grado_id') && <div className='invalid-feedback'>{fe('grado_id')}</div>}
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>
                {t('academico.estructura.grupo.nombre')}
              </label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
                placeholder={t('academico.estructura.grupo.nombrePh')}
                value={form.nombre}
                onChange={(e) => set({nombre: e.target.value})}
              />
              {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('academico.estructura.grupo.cupo')}</label>
              <input
                type='number'
                min={1}
                max={9999}
                className={`form-control form-control-solid ${fe('cupo_maximo') ? 'is-invalid' : ''}`}
                placeholder={t('academico.estructura.grupo.cupoPh')}
                value={form.cupo_maximo ?? ''}
                onChange={(e) => set({cupo_maximo: e.target.value ? Number(e.target.value) : null})}
              />
              {fe('cupo_maximo') && <div className='invalid-feedback'>{fe('cupo_maximo')}</div>}
            </div>
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('common.field.jornada')}</label>
              <select
                className={`form-select form-select-solid ${fe('jornada_id') ? 'is-invalid' : ''}`}
                value={form.jornada_id ?? ''}
                onChange={(e) => set({jornada_id: e.target.value || null})}
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
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('common.field.sede')}</label>
              <select
                className={`form-select form-select-solid ${fe('sede_id') ? 'is-invalid' : ''}`}
                value={form.sede_id ?? ''}
                onChange={(e) => set({sede_id: e.target.value || null})}
              >
                <option value=''>{t('common.select')}</option>
                {(sedes?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              {fe('sede_id') && <div className='invalid-feedback'>{fe('sede_id')}</div>}
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
              intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.grupo'})})
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const GruposTab: FC = () => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, isError} = useGrupos()
  const del = useDeleteGrupo()

  const [formOpen, setFormOpen] = useState(false)
  const [edit, setEdit] = useState<Grupo | null>(null)
  const [deleteId, setDeleteId] = useState<Grupo | null>(null)

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
          <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.grupo'})})}</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className='alert alert-danger d-flex align-items-center my-5'>
          <i className='ki-duotone ki-information fs-2 text-danger me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.grupo'})})}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div className='table-responsive'>
          <table className='table table-row-dashed align-middle gs-0 gy-4'>
            <thead>
              <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                <th className='min-w-120px'>{t('academico.estructura.grupo.nombre')}</th>
                <th className='min-w-150px'>{t('common.field.anoLectivo')}</th>
                <th className='min-w-150px'>{t('academico.estructura.grupo.grado')}</th>
                <th className='min-w-120px'>{t('common.field.jornada')}</th>
                <th className='min-w-100px'>{t('academico.estructura.grupo.cupo')}</th>
                <th className='min-w-100px'>{t('common.status')}</th>
                <th className='min-w-150px text-end'>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {list.map((g) => (
                <tr key={g.id}>
                  <td>
                    <span className='text-gray-800 fw-bold'>
                      {g.grado?.nombre ?? '—'} / {g.nombre}
                    </span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{g.ano_lectivo?.nombre ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{g.grado?.nombre ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{g.jornada?.nombre ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>{g.cupo_maximo ?? '—'}</span>
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
                        title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.grupo'})})}
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
                        title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.grupo'})})}
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
                  <td colSpan={7} className='text-center text-muted py-10'>
                    {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.grupo'})})}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <GrupoFormDialog
        show={formOpen}
        grupo={edit}
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

export {GruposTab}