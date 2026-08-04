import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreateAnoLectivo, useUpdateAnoLectivo} from '../anos-lectivos.api'
import type {AnoLectivo, CreateAnoLectivoInput, TipoCalendario} from '../anos-lectivos.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  /** Si viene un ano, el dialogo edita; si es null, crea. */
  ano: AnoLectivo | null
  onClose: () => void
}

interface FormState {
  nombre: string
  tipo_calendario: TipoCalendario
  fecha_inicio: string
  fecha_fin: string
  num_periodos: string
  tiene_quinto_periodo: boolean
}

/** Recorta un ISO datetime/date a 'YYYY-MM-DD' para <input type=date>. */
const toDateInput = (value: string): string => (value ? value.slice(0, 10) : '')

const emptyForm = (): FormState => ({
  nombre: '',
  tipo_calendario: 'A',
  fecha_inicio: '',
  fecha_fin: '',
  num_periodos: '4',
  tiene_quinto_periodo: false,
})

const fromAno = (a: AnoLectivo): FormState => ({
  nombre: a.nombre,
  tipo_calendario: a.tipo_calendario,
  fecha_inicio: toDateInput(a.fecha_inicio),
  fecha_fin: toDateInput(a.fecha_fin),
  num_periodos: String(a.num_periodos),
  tiene_quinto_periodo: a.tiene_quinto_periodo,
})

// Formulario interno: se remonta (via key) por modo/ano para arrancar precargado.
const AnoLectivoForm: FC<{ano: AnoLectivo | null; onClose: () => void}> = ({ano, onClose}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)
  const toast = useToast()
  const create = useCreateAnoLectivo()
  const update = useUpdateAnoLectivo()
  const isEdit = ano !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(ano ? fromAno(ano) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<FormState>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: CreateAnoLectivoInput = {
      nombre: form.nombre.trim(),
      tipo_calendario: form.tipo_calendario,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      num_periodos: Number(form.num_periodos) || 0,
      tiene_quinto_periodo: form.tiene_quinto_periodo,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('academico.anos.toast.saveError'))
      }
    }

    if (isEdit && ano) {
      update.mutate(
        {id: ano.id, input},
        {
          onSuccess: () => {
            toast.success(t('academico.anos.toast.updated', {name: input.nombre}))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success(t('academico.anos.toast.created', {name: input.nombre}))
          onClose()
        },
        onError,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='modal-body py-lg-10 px-lg-10'>
        {/* Nombre */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('academico.anos.field.nombre')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
            placeholder={t('academico.anos.field.nombrePh')}
            value={form.nombre}
            onChange={(e) => set({nombre: e.target.value})}
          />
          {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
        </div>

        {/* Tipo de calendario */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('academico.anos.field.calendario')}</label>
          <select
            className={`form-select form-select-solid ${fe('tipo_calendario') ? 'is-invalid' : ''}`}
            value={form.tipo_calendario}
            onChange={(e) => set({tipo_calendario: e.target.value as TipoCalendario})}
          >
            <option value='A'>{t('academico.anos.calendario.A')}</option>
            <option value='B'>{t('academico.anos.calendario.B')}</option>
          </select>
          <div className='text-muted fs-7 mt-1'>{t('academico.anos.field.calendarioHelp')}</div>
          {fe('tipo_calendario') && <div className='invalid-feedback'>{fe('tipo_calendario')}</div>}
        </div>

        {/* Fechas */}
        <div className='row'>
          <div className='col-md-6 fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>{t('academico.anos.field.fechaInicio')}</label>
            <input
              type='date'
              className={`form-control form-control-solid ${fe('fecha_inicio') ? 'is-invalid' : ''}`}
              value={form.fecha_inicio}
              onChange={(e) => set({fecha_inicio: e.target.value})}
            />
            {fe('fecha_inicio') && <div className='invalid-feedback'>{fe('fecha_inicio')}</div>}
          </div>
          <div className='col-md-6 fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>{t('academico.anos.field.fechaFin')}</label>
            <input
              type='date'
              className={`form-control form-control-solid ${fe('fecha_fin') ? 'is-invalid' : ''}`}
              value={form.fecha_fin}
              onChange={(e) => set({fecha_fin: e.target.value})}
            />
            {fe('fecha_fin') && <div className='invalid-feedback'>{fe('fecha_fin')}</div>}
          </div>
        </div>

        {/* Numero de periodos */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('academico.anos.field.numPeriodos')}</label>
          <input
            type='number'
            min={1}
            max={12}
            className={`form-control form-control-solid ${fe('num_periodos') ? 'is-invalid' : ''}`}
            value={form.num_periodos}
            onChange={(e) => set({num_periodos: e.target.value})}
          />
          {fe('num_periodos') && <div className='invalid-feedback'>{fe('num_periodos')}</div>}
        </div>

        {/* Quinto periodo */}
        <div className='fv-row'>
          <label className='form-check form-switch form-check-custom form-check-solid'>
            <input
              className='form-check-input'
              type='checkbox'
              checked={form.tiene_quinto_periodo}
              onChange={(e) => set({tiene_quinto_periodo: e.target.checked})}
            />
            <span className='form-check-label fw-semibold text-gray-700'>
              {t('academico.anos.field.quinto')}
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
            t('academico.anos.save')
          )}
        </button>
      </div>
    </form>
  )
}

// Modal "Nuevo / Editar ano lectivo". Submit real: POST o PUT /anos-lectivos.
const AnoLectivoFormDialog: FC<Props> = ({show, ano, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  return createPortal(
    <Modal
      id='kt_modal_ano_lectivo'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {ano ? t('academico.anos.edit.title') : t('academico.anos.create.title')}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {show && <AnoLectivoForm key={ano?.id ?? 'new'} ano={ano} onClose={onClose} />}
    </Modal>,
    modalsRoot
  )
}

export {AnoLectivoFormDialog}
