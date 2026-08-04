import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {
  useCreateMetodo,
  useDeleteMetodo,
  useMetodosAprobacion,
  useUpdateMetodo,
} from '../configuracion.api'
import type {
  AmbitoAprobacion,
  CalculoNota,
  MetodoAprobacion,
  MetodoAprobacionInput,
} from '../configuracion.types'

const modalsRoot = document.getElementById('root-modals') || document.body
const CALCULOS: CalculoNota[] = ['promedio_simple', 'ponderado', 'sumatoria']
const AMBITOS: AmbitoAprobacion[] = ['materia', 'area', 'promedio_general']

type Props = {anoLectivoId: string}

interface FormState {
  calculo_nota: CalculoNota
  nota_minima: string
  ambito: AmbitoAprobacion
}

const emptyForm = (): FormState => ({
  calculo_nota: 'promedio_simple',
  nota_minima: '3.0',
  ambito: 'materia',
})

const fromMetodo = (m: MetodoAprobacion): FormState => ({
  calculo_nota: m.calculo_nota,
  nota_minima: String(m.nota_minima),
  ambito: m.ambito,
})

// Dialogo interno crear/editar metodo de aprobacion.
const MetodoForm: FC<{
  anoLectivoId: string
  metodo: MetodoAprobacion | null
  onClose: () => void
}> = ({anoLectivoId, metodo, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreateMetodo(anoLectivoId)
  const update = useUpdateMetodo(anoLectivoId)
  const isEdit = metodo !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(metodo ? fromMetodo(metodo) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)
  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<FormState>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null)
    const input: MetodoAprobacionInput = {
      ano_lectivo_id: anoLectivoId,
      calculo_nota: form.calculo_nota,
      nota_minima: Number(form.nota_minima) || 0,
      ambito: form.ambito,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('academico.config.metodo.toast.saveError'))
      }
    }

    if (isEdit && metodo) {
      update.mutate(
        {id: metodo.id, input},
        {
          onSuccess: () => {
            toast.success(t('academico.config.metodo.toast.updated'))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success(t('academico.config.metodo.toast.created'))
          onClose()
        },
        onError,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='modal-body py-lg-8 px-lg-8'>
        <div className='fv-row mb-6'>
          <label className='required fs-6 fw-semibold mb-2'>
            {t('academico.config.metodo.field.calculo')}
          </label>
          <select
            className='form-select form-select-solid'
            value={form.calculo_nota}
            onChange={(e) => set({calculo_nota: e.target.value as CalculoNota})}
          >
            {CALCULOS.map((c) => (
              <option key={c} value={c}>
                {t(`academico.config.metodo.calculo.${c}`)}
              </option>
            ))}
          </select>
        </div>

        <div className='row'>
          <div className='col-md-6 fv-row mb-2'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.config.metodo.field.notaMinima')}
            </label>
            <input
              type='number'
              step='0.1'
              className={`form-control form-control-solid ${fe('nota_minima') ? 'is-invalid' : ''}`}
              value={form.nota_minima}
              onChange={(e) => set({nota_minima: e.target.value})}
            />
            {fe('nota_minima') && <div className='invalid-feedback'>{fe('nota_minima')}</div>}
          </div>
          <div className='col-md-6 fv-row mb-2'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.config.metodo.field.ambito')}
            </label>
            <select
              className='form-select form-select-solid'
              value={form.ambito}
              onChange={(e) => set({ambito: e.target.value as AmbitoAprobacion})}
            >
              {AMBITOS.map((a) => (
                <option key={a} value={a}>
                  {t(`academico.config.metodo.ambito.${a}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type='submit' className='btn btn-primary' disabled={pending}>
          {pending ? (
            <span className='indicator-progress d-block'>
              {t('common.saving')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            t('academico.config.metodo.save')
          )}
        </button>
      </div>
    </form>
  )
}

// Bloque 5: metodo de aprobacion. Lista + crear/editar/eliminar, filtrada por ano lectivo.
const MetodosAprobacionCard: FC<Props> = ({anoLectivoId}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, isError} = useMetodosAprobacion(anoLectivoId)
  const del = useDeleteMetodo(anoLectivoId)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MetodoAprobacion | null>(null)

  const metodos = data ?? []

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (m: MetodoAprobacion) => {
    setEditing(m)
    setShowForm(true)
  }
  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = (m: MetodoAprobacion) => {
    del.mutate(m.id, {
      onSuccess: () => toast.success(t('academico.config.metodo.toast.deleted')),
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : t('academico.config.metodo.toast.deleteError')
        toast.error(message)
      },
    })
  }

  return (
    <div className='card'>
      <div className='card-header border-0 pt-6'>
        <div className='card-title flex-column align-items-start'>
          <h3 className='fw-bold mb-1'>{t('academico.config.metodo.title')}</h3>
          <span className='text-muted fs-7'>{t('academico.config.metodo.subtitle')}</span>
        </div>
        <div className='card-toolbar'>
          <button type='button' className='btn btn-primary' onClick={openCreate}>
            <i className='ki-duotone ki-plus fs-2'></i>
            {t('academico.config.metodo.new')}
          </button>
        </div>
      </div>
      <div className='card-body py-4'>
        {isLoading && (
          <div className='d-flex justify-content-center align-items-center py-10'>
            <span className='spinner-border text-primary me-3' role='status'></span>
            <span className='text-muted fs-6'>{t('academico.config.metodo.loading')}</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className='alert alert-danger d-flex align-items-center my-3'>
            <i className='ki-duotone ki-information fs-2 text-danger me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{t('academico.config.metodo.loadError')}</span>
          </div>
        )}

        {!isLoading && !isError && (
          <div className='table-responsive'>
            <table className='table table-row-dashed align-middle gs-0 gy-4'>
              <thead>
                <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                  <th className='min-w-200px'>{t('academico.config.metodo.col.calculo')}</th>
                  <th className='min-w-100px'>{t('academico.config.metodo.col.notaMinima')}</th>
                  <th className='min-w-150px'>{t('academico.config.metodo.col.ambito')}</th>
                  <th className='min-w-100px text-end'>{t('academico.config.metodo.col.actions')}</th>
                </tr>
              </thead>
              <tbody className='text-gray-600 fw-semibold'>
                {metodos.map((m) => (
                  <tr key={m.id}>
                    <td className='text-gray-800 fw-bold'>
                      {t(`academico.config.metodo.calculo.${m.calculo_nota}`)}
                    </td>
                    <td>{m.nota_minima}</td>
                    <td>{t(`academico.config.metodo.ambito.${m.ambito}`)}</td>
                    <td>
                      <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-primary btn-sm me-2'
                          title={t('academico.config.metodo.edit')}
                          onClick={() => openEdit(m)}
                        >
                          <i className='ki-duotone ki-pencil fs-6'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                        </button>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-danger btn-sm'
                          title={t('academico.config.metodo.delete')}
                          disabled={del.isPending}
                          onClick={() => handleDelete(m)}
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
                ))}
                {metodos.length === 0 && (
                  <tr>
                    <td colSpan={4} className='text-center text-muted py-10'>
                      {t('academico.config.metodo.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createPortal(
        <Modal
          id='kt_modal_metodo'
          tabIndex={-1}
          aria-hidden='true'
          dialogClassName='modal-dialog modal-dialog-centered mw-650px'
          show={showForm}
          onHide={closeForm}
          backdrop={true}
        >
          <div className='modal-header'>
            <h2 className='fw-bold'>
              {editing
                ? t('academico.config.metodo.formTitleEdit')
                : t('academico.config.metodo.formTitleNew')}
            </h2>
            <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={closeForm}>
              <i className='ki-duotone ki-cross fs-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
            </div>
          </div>
          {showForm && (
            <MetodoForm
              key={editing?.id ?? 'new'}
              anoLectivoId={anoLectivoId}
              metodo={editing}
              onClose={closeForm}
            />
          )}
        </Modal>,
        modalsRoot
      )}
    </div>
  )
}

export {MetodosAprobacionCard}
