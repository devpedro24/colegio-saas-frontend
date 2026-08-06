import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {
  useCreatePeriodo,
  useDeletePeriodo,
  usePeriodos,
  useUpdatePeriodo,
} from '../anos-lectivos.api'
import type {AnoLectivo, CreatePeriodoInput, Periodo} from '../anos-lectivos.types'

const modalsRoot = document.getElementById('root-modals') || document.body

// Estado del periodo -> clase de badge (etiqueta por i18n).
const PERIODO_STATUS_CLASS: Record<string, string> = {
  planificado: 'badge badge-light-secondary',
  abierto: 'badge badge-light-success',
  cerrado: 'badge badge-light-dark',
}

const toDateInput = (value: string): string => (value ? value.slice(0, 10) : '')

interface PeriodoFormState {
  nombre: string
  orden: string
  fecha_inicio: string
  fecha_fin: string
  peso: string
}

const emptyPeriodoForm = (nextOrden: number): PeriodoFormState => ({
  nombre: '',
  orden: String(nextOrden),
  fecha_inicio: '',
  fecha_fin: '',
  peso: '',
})

const fromPeriodo = (p: Periodo): PeriodoFormState => ({
  nombre: p.nombre,
  orden: String(p.orden),
  fecha_inicio: toDateInput(p.fecha_inicio),
  fecha_fin: toDateInput(p.fecha_fin),
  peso: p.peso === null ? '' : String(p.peso),
})

type Props = {
  show: boolean
  ano: AnoLectivo | null
  onClose: () => void
}

// Contenido interno del modal (se remonta por ano lectivo). Lista los periodos y
// permite crear/editar/eliminar uno a la vez con un formulario en linea.
const PeriodosContent: FC<{ano: AnoLectivo}> = ({ano}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)
  const toast = useToast()

  const {data, isLoading, isError} = usePeriodos(ano.id)
  const create = useCreatePeriodo(ano.id)
  const update = useUpdatePeriodo(ano.id)
  const del = useDeletePeriodo(ano.id)

  const periodos = data?.data ?? []
  const nextOrden = periodos.length + 1

  const [editing, setEditing] = useState<Periodo | null>(null)
  const [form, setForm] = useState<PeriodoFormState>(emptyPeriodoForm(nextOrden))
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<PeriodoFormState>) => setForm((prev) => ({...prev, ...patch}))
  const pending = create.isPending || update.isPending

  const startCreate = () => {
    setEditing(null)
    setForm(emptyPeriodoForm(periodos.length + 1))
    setError(null)
  }
  const startEdit = (p: Periodo) => {
    setEditing(p)
    setForm(fromPeriodo(p))
    setError(null)
  }

  const badge = (estado: string) => ({
    className: PERIODO_STATUS_CLASS[estado] ?? 'badge badge-light-secondary',
    label: intl.formatMessage({id: `academico.periodos.estado.${estado}`, defaultMessage: estado}),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: CreatePeriodoInput = {
      nombre: form.nombre.trim(),
      orden: Number(form.orden) || 0,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      peso: form.peso.trim() === '' ? null : Number(form.peso),
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (editing) {
      update.mutate(
        {id: editing.id, input},
        {
          onSuccess: () => {
            toast.success(t('common.toast.updated'))
            startCreate()
          },
          onError,
        }
      )
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success(t('common.toast.created'))
          startCreate()
        },
        onError,
      })
    }
  }

  const handleDelete = (p: Periodo) => {
    del.mutate(p.id, {
      onSuccess: () => {
        toast.success(t('common.toast.deleted'))
        if (editing?.id === p.id) startCreate()
      },
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : t('common.toast.deleteError')
        toast.error(message)
      },
    })
  }

  return (
    <div className='modal-body py-lg-8 px-lg-8'>
      {/* Lista de periodos */}
      {isLoading && (
        <div className='d-flex justify-content-center align-items-center py-10'>
          <span className='spinner-border text-primary me-3' role='status'></span>
          <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.periodo'})})}</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className='alert alert-danger d-flex align-items-center my-3'>
          <i className='ki-duotone ki-information fs-2 text-danger me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.periodo'})})}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div className='table-responsive mb-8'>
          <table className='table table-row-dashed align-middle gs-0 gy-3'>
            <thead>
              <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                <th className='w-40px'>{t('academico.periodos.col.orden')}</th>
                <th className='min-w-150px'>{t('common.name')}</th>
                <th className='min-w-175px'>{t('academico.periodos.col.fechas')}</th>
                <th className='min-w-75px'>{t('academico.periodos.col.peso')}</th>
                <th className='min-w-100px'>{t('common.status')}</th>
                <th className='min-w-100px text-end'>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {periodos.map((p) => {
                const b = badge(p.estado)
                return (
                  <tr key={p.id}>
                    <td>{p.orden}</td>
                    <td className='text-gray-800 fw-bold'>{p.nombre}</td>
                    <td>
                      {toDateInput(p.fecha_inicio)} &rarr; {toDateInput(p.fecha_fin)}
                    </td>
                    <td>{p.peso === null ? '—' : `${p.peso}%`}</td>
                    <td>
                      <span className={b.className}>{b.label}</span>
                    </td>
                    <td>
                      <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-primary btn-sm me-2'
                          title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.periodo'})})}
                          onClick={() => startEdit(p)}
                        >
                          <i className='ki-duotone ki-pencil fs-6'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                        </button>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-danger btn-sm'
                          title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.periodo'})})}
                          disabled={del.isPending}
                          onClick={() => handleDelete(p)}
                        >
                          <i className='ki-duotone ki-trash fs-6'>
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
              {periodos.length === 0 && (
                <tr>
                  <td colSpan={6} className='text-center text-muted py-8'>
                    {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.periodo'})})}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulario en linea: crear / editar periodo */}
      <div className='separator separator-dashed mb-6'></div>
      <h4 className='fw-bold mb-4'>
        {editing ? t('academico.periodos.formTitleEdit') : t('academico.periodos.new')}
      </h4>
      <form onSubmit={handleSubmit}>
        <div className='row'>
          <div className='col-md-6 fv-row mb-5'>
            <label className='required fs-7 fw-semibold mb-2'>
              {t('academico.periodos.field.nombre')}
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
              placeholder={t('academico.periodos.field.nombrePh')}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
            {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
          </div>
          <div className='col-md-3 fv-row mb-5'>
            <label className='required fs-7 fw-semibold mb-2'>
              {t('academico.periodos.field.orden')}
            </label>
            <input
              type='number'
              min={1}
              className={`form-control form-control-solid ${fe('orden') ? 'is-invalid' : ''}`}
              value={form.orden}
              onChange={(e) => set({orden: e.target.value})}
            />
            {fe('orden') && <div className='invalid-feedback'>{fe('orden')}</div>}
          </div>
          <div className='col-md-3 fv-row mb-5'>
            <label className='fs-7 fw-semibold mb-2'>{t('academico.periodos.field.peso')}</label>
            <input
              type='number'
              min={0}
              max={100}
              className={`form-control form-control-solid ${fe('peso') ? 'is-invalid' : ''}`}
              value={form.peso}
              onChange={(e) => set({peso: e.target.value})}
            />
            {fe('peso') && <div className='invalid-feedback'>{fe('peso')}</div>}
          </div>
          <div className='col-md-6 fv-row mb-5'>
            <label className='required fs-7 fw-semibold mb-2'>
              {t('academico.periodos.field.fechaInicio')}
            </label>
            <input
              type='date'
              className={`form-control form-control-solid ${fe('fecha_inicio') ? 'is-invalid' : ''}`}
              value={form.fecha_inicio}
              onChange={(e) => set({fecha_inicio: e.target.value})}
            />
            {fe('fecha_inicio') && <div className='invalid-feedback'>{fe('fecha_inicio')}</div>}
          </div>
          <div className='col-md-6 fv-row mb-5'>
            <label className='required fs-7 fw-semibold mb-2'>
              {t('academico.periodos.field.fechaFin')}
            </label>
            <input
              type='date'
              className={`form-control form-control-solid ${fe('fecha_fin') ? 'is-invalid' : ''}`}
              value={form.fecha_fin}
              onChange={(e) => set({fecha_fin: e.target.value})}
            />
            {fe('fecha_fin') && <div className='invalid-feedback'>{fe('fecha_fin')}</div>}
          </div>
        </div>
        <div className='d-flex justify-content-end gap-3'>
          {editing && (
            <button type='button' className='btn btn-light' onClick={startCreate}>
              {t('common.cancel')}
            </button>
          )}
          <button type='submit' className='btn btn-primary' disabled={pending}>
            {pending ? (
              <span className='indicator-progress d-block'>
                {t('common.pleaseWait')}
                <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
              </span>
            ) : (
              intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.periodo'})})
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// Modal "Periodos" del ano lectivo seleccionado.
const PeriodosDialog: FC<Props> = ({show, ano, onClose}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)
  return createPortal(
    <Modal
      id='kt_modal_periodos'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-750px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <div className='d-flex flex-column'>
          <h2 className='fw-bold'>{t('academico.periodos.title')}</h2>
          {ano && (
            <span className='text-muted fs-7'>
              {t('academico.periodos.subtitle', {name: ano.nombre})}
            </span>
          )}
        </div>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {ano && show && <PeriodosContent key={ano.id} ano={ano} />}
    </Modal>,
    modalsRoot
  )
}

export {PeriodosDialog}
