import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useTenantSync} from '@/app/modules/auth/hooks/useTenantSync'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreateEscala, useDeleteEscala, useEscalas, useUpdateEscala} from '../configuracion.api'
import type {
  EscalaValorativa,
  EscalaValorativaInput,
  NivelEducativo,
  TipoEscala,
} from '../configuracion.types'

const modalsRoot = document.getElementById('root-modals') || document.body
const NIVELES: NivelEducativo[] = ['preescolar', 'primaria', 'secundaria', 'media']

type Props = {anoLectivoId: string}

interface FormState {
  nombre: string
  nivel_educativo: string // '' = todos
  tipo: TipoEscala
  valor_min: string
  valor_max: string
  decimales: string
}

const emptyForm = (): FormState => ({
  nombre: '',
  nivel_educativo: '',
  tipo: 'numerica',
  valor_min: '1',
  valor_max: '5',
  decimales: '1',
})

const fromEscala = (e: EscalaValorativa): FormState => ({
  nombre: e.nombre,
  nivel_educativo: e.nivel_educativo ?? '',
  tipo: e.tipo,
  valor_min: e.valor_min === null ? '' : String(e.valor_min),
  valor_max: e.valor_max === null ? '' : String(e.valor_max),
  decimales: e.decimales === null ? '' : String(e.decimales),
})

// Dialogo interno crear/editar escala (se remonta por escala via key en el padre).
const EscalaForm: FC<{
  anoLectivoId: string
  escala: EscalaValorativa | null
  onClose: () => void
}> = ({anoLectivoId, escala, onClose}) => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreateEscala(anoLectivoId)
  const update = useUpdateEscala(anoLectivoId)
  const isEdit = escala !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(escala ? fromEscala(escala) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)
  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<FormState>) => setForm((prev) => ({...prev, ...patch}))
  const isNumerica = form.tipo === 'numerica'

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null)
    const input: EscalaValorativaInput = {
      ano_lectivo_id: anoLectivoId,
      nombre: form.nombre.trim(),
      nivel_educativo: (form.nivel_educativo || null) as NivelEducativo | null,
      tipo: form.tipo,
      valor_min: isNumerica && form.valor_min !== '' ? Number(form.valor_min) : null,
      valor_max: isNumerica && form.valor_max !== '' ? Number(form.valor_max) : null,
      decimales: isNumerica && form.decimales !== '' ? Number(form.decimales) : null,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (isEdit && escala) {
      update.mutate(
        {id: escala.id, input},
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

  return (
    <form onSubmit={handleSubmit}>
      <div className='modal-body py-lg-8 px-lg-8'>
        <div className='fv-row mb-6'>
          <label className='required fs-6 fw-semibold mb-2'>
            {t('academico.config.escala.field.nombre')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.escala.field.nombrePh')}
            value={form.nombre}
            onChange={(e) => set({nombre: e.target.value})}
          />
          {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
        </div>

        <div className='row'>
          <div className='col-md-6 fv-row mb-6'>
            <label className='fs-6 fw-semibold mb-2'>
              {t('academico.config.escala.field.nivel')}
            </label>
            <select
              className='form-select form-select-solid'
              value={form.nivel_educativo}
              onChange={(e) => set({nivel_educativo: e.target.value})}
            >
              <option value=''>{t('academico.nivel.todos')}</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {t(`academico.nivel.${n}`)}
                </option>
              ))}
            </select>
          </div>
          <div className='col-md-6 fv-row mb-6'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.config.escala.field.tipo')}
            </label>
            <select
              className='form-select form-select-solid'
              value={form.tipo}
              onChange={(e) => set({tipo: e.target.value as TipoEscala})}
            >
              <option value='numerica'>{t('academico.config.escala.tipo.numerica')}</option>
              <option value='imagenes'>{t('academico.config.escala.tipo.imagenes')}</option>
            </select>
          </div>
        </div>

        {isNumerica && (
          <div className='row'>
            <div className='col-md-4 fv-row mb-2'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.config.escala.field.valorMin')}
              </label>
              <input
                type='number'
                step='0.1'
                className={`form-control form-control-solid ${fe('valor_min') ? 'is-invalid' : ''}`}
                value={form.valor_min}
                onChange={(e) => set({valor_min: e.target.value})}
              />
              {fe('valor_min') && <div className='invalid-feedback'>{fe('valor_min')}</div>}
            </div>
            <div className='col-md-4 fv-row mb-2'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.config.escala.field.valorMax')}
              </label>
              <input
                type='number'
                step='0.1'
                className={`form-control form-control-solid ${fe('valor_max') ? 'is-invalid' : ''}`}
                value={form.valor_max}
                onChange={(e) => set({valor_max: e.target.value})}
              />
              {fe('valor_max') && <div className='invalid-feedback'>{fe('valor_max')}</div>}
            </div>
            <div className='col-md-4 fv-row mb-2'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.config.escala.field.decimales')}
              </label>
              <input
                type='number'
                min={0}
                max={3}
                className={`form-control form-control-solid ${fe('decimales') ? 'is-invalid' : ''}`}
                value={form.decimales}
                onChange={(e) => set({decimales: e.target.value})}
              />
              {fe('decimales') && <div className='invalid-feedback'>{fe('decimales')}</div>}
            </div>
          </div>
        )}
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type='submit' className='btn btn-primary' disabled={pending}>
          {pending ? (
            <span className='indicator-progress d-block'>
              {t('common.pleaseWait')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.escala'})})
          )}
        </button>
      </div>
    </form>
  )
}

// Bloque 4: escala valorativa. Lista + crear/editar/eliminar, filtrada por ano lectivo.
const EscalasCard: FC<Props> = ({anoLectivoId}) => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, isError} = useEscalas(anoLectivoId)
  const del = useDeleteEscala(anoLectivoId)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EscalaValorativa | null>(null)

  const escalas = data?.data ?? []

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (e: EscalaValorativa) => {
    setEditing(e)
    setShowForm(true)
  }
  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = (e: EscalaValorativa) => {
    del.mutate(e.id, {
      onSuccess: () => toast.success(t('common.toast.deleted')),
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : t('common.toast.deleteError')
        toast.error(message)
      },
    })
  }

  const nivelLabel = (n: NivelEducativo | null) =>
    n ? t(`academico.nivel.${n}`) : t('academico.nivel.todos')

  return (
    <div className='card'>
      <div className='card-header border-0 pt-6'>
        <div className='card-title flex-column align-items-start'>
          <h3 className='fw-bold mb-1'>{t('academico.config.escala.title')}</h3>
          <span className='text-muted fs-7'>{t('academico.config.escala.subtitle')}</span>
        </div>
        <div className='card-toolbar'>
          <button type='button' className='btn btn-primary' onClick={openCreate}>
            <i className='ki-duotone ki-plus fs-2'></i>
            {t('academico.config.escala.new')}
          </button>
        </div>
      </div>
      <div className='card-body py-4'>
        {isLoading && (
          <div className='d-flex justify-content-center align-items-center py-10'>
            <span className='spinner-border text-primary me-3' role='status'></span>
            <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.escala'})})}</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className='alert alert-danger d-flex align-items-center my-3'>
            <i className='ki-duotone ki-information fs-2 text-danger me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.escala'})})}</span>
          </div>
        )}

        {!isLoading && !isError && (
          <div className='table-responsive'>
            <table className='table table-row-dashed align-middle gs-0 gy-4'>
              <thead>
                <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                  <th className='min-w-150px'>{t('common.name')}</th>
                  <th className='min-w-125px'>{t('common.field.nivel')}</th>
                  <th className='min-w-100px'>{t('academico.config.escala.col.tipo')}</th>
                  <th className='min-w-100px'>{t('academico.config.escala.col.rango')}</th>
                  <th className='min-w-100px text-end'>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className='text-gray-600 fw-semibold'>
                {escalas.map((e) => (
                  <tr key={e.id}>
                    <td className='text-gray-800 fw-bold'>{e.nombre}</td>
                    <td>{nivelLabel(e.nivel_educativo)}</td>
                    <td>{t(`academico.config.escala.tipo.${e.tipo}`)}</td>
                    <td>
                      {e.tipo === 'numerica' && e.valor_min !== null && e.valor_max !== null
                        ? `${e.valor_min} — ${e.valor_max}`
                        : '—'}
                    </td>
                    <td>
                      <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-primary btn-sm me-2'
                          title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.escala'})})}
                          onClick={() => openEdit(e)}
                        >
                          <i className='ki-duotone ki-pencil fs-6'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                        </button>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-danger btn-sm'
                          title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.escala'})})}
                          disabled={del.isPending}
                          onClick={() => handleDelete(e)}
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
                {escalas.length === 0 && (
                  <tr>
                    <td colSpan={5} className='text-center text-muted py-10'>
                      {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.escala'})})}
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
          id='kt_modal_escala'
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
                ? t('academico.config.escala.formTitleEdit')
                : t('academico.config.escala.formTitleNew')}
            </h2>
            <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={closeForm}>
              <i className='ki-duotone ki-cross fs-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
            </div>
          </div>
          {showForm && (
            <EscalaForm
              key={editing?.id ?? 'new'}
              anoLectivoId={anoLectivoId}
              escala={editing}
              onClose={closeForm}
            />
          )}
        </Modal>,
        modalsRoot
      )}
    </div>
  )
}

export {EscalasCard}
