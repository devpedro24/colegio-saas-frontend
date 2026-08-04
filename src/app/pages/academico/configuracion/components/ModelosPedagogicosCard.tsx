import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {
  useCreateModelo,
  useDeleteModelo,
  useModelosPedagogicos,
  useUpdateModelo,
} from '../configuracion.api'
import type {ModeloPedagogico, ModeloPedagogicoInput, NivelEducativo} from '../configuracion.types'

const modalsRoot = document.getElementById('root-modals') || document.body
const NIVELES: NivelEducativo[] = ['preescolar', 'primaria', 'secundaria', 'media']

type Props = {anoLectivoId: string}

interface FormState {
  nivel_educativo: NivelEducativo
  docente_unico: boolean
  salon_fijo: boolean
  tiene_director_grupo: boolean
}

const emptyForm = (): FormState => ({
  nivel_educativo: 'preescolar',
  docente_unico: true,
  salon_fijo: true,
  tiene_director_grupo: true,
})

const fromModelo = (m: ModeloPedagogico): FormState => ({
  nivel_educativo: m.nivel_educativo,
  docente_unico: m.docente_unico,
  salon_fijo: m.salon_fijo,
  tiene_director_grupo: m.tiene_director_grupo,
})

// Dialogo interno crear/editar modelo pedagogico.
const ModeloForm: FC<{
  anoLectivoId: string
  modelo: ModeloPedagogico | null
  onClose: () => void
}> = ({anoLectivoId, modelo, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreateModelo(anoLectivoId)
  const update = useUpdateModelo(anoLectivoId)
  const isEdit = modelo !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(modelo ? fromModelo(modelo) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)
  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<FormState>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null)
    const input: ModeloPedagogicoInput = {
      ano_lectivo_id: anoLectivoId,
      nivel_educativo: form.nivel_educativo,
      docente_unico: form.docente_unico,
      salon_fijo: form.salon_fijo,
      tiene_director_grupo: form.tiene_director_grupo,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('academico.config.modelo.toast.saveError'))
      }
    }

    if (isEdit && modelo) {
      update.mutate(
        {id: modelo.id, input},
        {
          onSuccess: () => {
            toast.success(t('academico.config.modelo.toast.updated'))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success(t('academico.config.modelo.toast.created'))
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
            {t('academico.config.modelo.field.nivel')}
          </label>
          <select
            className={`form-select form-select-solid ${fe('nivel_educativo') ? 'is-invalid' : ''}`}
            value={form.nivel_educativo}
            onChange={(e) => set({nivel_educativo: e.target.value as NivelEducativo})}
          >
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {t(`academico.nivel.${n}`)}
              </option>
            ))}
          </select>
          {fe('nivel_educativo') && <div className='invalid-feedback'>{fe('nivel_educativo')}</div>}
        </div>

        <div className='fv-row mb-4'>
          <label className='form-check form-switch form-check-custom form-check-solid'>
            <input
              className='form-check-input'
              type='checkbox'
              checked={form.docente_unico}
              onChange={(e) => set({docente_unico: e.target.checked})}
            />
            <span className='form-check-label fw-semibold text-gray-700'>
              {t('academico.config.modelo.field.docenteUnico')}
            </span>
          </label>
        </div>
        <div className='fv-row mb-4'>
          <label className='form-check form-switch form-check-custom form-check-solid'>
            <input
              className='form-check-input'
              type='checkbox'
              checked={form.salon_fijo}
              onChange={(e) => set({salon_fijo: e.target.checked})}
            />
            <span className='form-check-label fw-semibold text-gray-700'>
              {t('academico.config.modelo.field.salonFijo')}
            </span>
          </label>
        </div>
        <div className='fv-row'>
          <label className='form-check form-switch form-check-custom form-check-solid'>
            <input
              className='form-check-input'
              type='checkbox'
              checked={form.tiene_director_grupo}
              onChange={(e) => set({tiene_director_grupo: e.target.checked})}
            />
            <span className='form-check-label fw-semibold text-gray-700'>
              {t('academico.config.modelo.field.directorGrupo')}
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
            <span className='indicator-progress d-block'>
              {t('common.saving')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            t('academico.config.modelo.save')
          )}
        </button>
      </div>
    </form>
  )
}

const Bool: FC<{on: boolean; onLabel: string; offLabel: string}> = ({on, onLabel, offLabel}) => (
  <span className={on ? 'badge badge-light-success' : 'badge badge-light-warning'}>
    {on ? onLabel : offLabel}
  </span>
)

// Bloque 6: modelo pedagogico por nivel. Lista + crear/editar/eliminar, filtrada por ano.
const ModelosPedagogicosCard: FC<Props> = ({anoLectivoId}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, isError} = useModelosPedagogicos(anoLectivoId)
  const del = useDeleteModelo(anoLectivoId)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ModeloPedagogico | null>(null)

  const modelos = data ?? []

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (m: ModeloPedagogico) => {
    setEditing(m)
    setShowForm(true)
  }
  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = (m: ModeloPedagogico) => {
    del.mutate(m.id, {
      onSuccess: () => toast.success(t('academico.config.modelo.toast.deleted')),
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : t('academico.config.modelo.toast.deleteError')
        toast.error(message)
      },
    })
  }

  return (
    <div className='card'>
      <div className='card-header border-0 pt-6'>
        <div className='card-title flex-column align-items-start'>
          <h3 className='fw-bold mb-1'>{t('academico.config.modelo.title')}</h3>
          <span className='text-muted fs-7'>{t('academico.config.modelo.subtitle')}</span>
        </div>
        <div className='card-toolbar'>
          <button type='button' className='btn btn-primary' onClick={openCreate}>
            <i className='ki-duotone ki-plus fs-2'></i>
            {t('academico.config.modelo.new')}
          </button>
        </div>
      </div>
      <div className='card-body py-4'>
        {isLoading && (
          <div className='d-flex justify-content-center align-items-center py-10'>
            <span className='spinner-border text-primary me-3' role='status'></span>
            <span className='text-muted fs-6'>{t('academico.config.modelo.loading')}</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className='alert alert-danger d-flex align-items-center my-3'>
            <i className='ki-duotone ki-information fs-2 text-danger me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{t('academico.config.modelo.loadError')}</span>
          </div>
        )}

        {!isLoading && !isError && (
          <div className='table-responsive'>
            <table className='table table-row-dashed align-middle gs-0 gy-4'>
              <thead>
                <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                  <th className='min-w-125px'>{t('academico.config.modelo.col.nivel')}</th>
                  <th className='min-w-150px'>{t('academico.config.modelo.col.docente')}</th>
                  <th className='min-w-150px'>{t('academico.config.modelo.col.aula')}</th>
                  <th className='min-w-125px'>{t('academico.config.modelo.col.director')}</th>
                  <th className='min-w-100px text-end'>{t('academico.config.modelo.col.actions')}</th>
                </tr>
              </thead>
              <tbody className='text-gray-600 fw-semibold'>
                {modelos.map((m) => (
                  <tr key={m.id}>
                    <td className='text-gray-800 fw-bold'>
                      {t(`academico.nivel.${m.nivel_educativo}`)}
                    </td>
                    <td>
                      <Bool
                        on={m.docente_unico}
                        onLabel={t('academico.config.modelo.docente.unico')}
                        offLabel={t('academico.config.modelo.docente.rotacion')}
                      />
                    </td>
                    <td>
                      <Bool
                        on={m.salon_fijo}
                        onLabel={t('academico.config.modelo.aula.fija')}
                        offLabel={t('academico.config.modelo.aula.desplazamiento')}
                      />
                    </td>
                    <td>
                      {m.tiene_director_grupo ? (
                        <i className='ki-duotone ki-check-circle fs-2 text-success'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                      ) : (
                        <i className='ki-duotone ki-cross-circle fs-2 text-muted'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                      )}
                    </td>
                    <td>
                      <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-primary btn-sm me-2'
                          title={t('academico.config.modelo.edit')}
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
                          title={t('academico.config.modelo.delete')}
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
                {modelos.length === 0 && (
                  <tr>
                    <td colSpan={5} className='text-center text-muted py-10'>
                      {t('academico.config.modelo.empty')}
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
          id='kt_modal_modelo'
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
                ? t('academico.config.modelo.formTitleEdit')
                : t('academico.config.modelo.formTitleNew')}
            </h2>
            <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={closeForm}>
              <i className='ki-duotone ki-cross fs-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
            </div>
          </div>
          {showForm && (
            <ModeloForm
              key={editing?.id ?? 'new'}
              anoLectivoId={anoLectivoId}
              modelo={editing}
              onClose={closeForm}
            />
          )}
        </Modal>,
        modalsRoot
      )}
    </div>
  )
}

export {ModelosPedagogicosCard}
