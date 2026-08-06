import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {usePlanes, useCreatePlan, useUpdatePlan} from '../planes.api'
import {Plan} from '../planes.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  /** null => Crear; un plan => Editar (precargado). */
  plan: Plan | null
  onClose: () => void
}

/** Deriva una key (slug) a partir del nombre. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const priceToInput = (v: string | null): string => (v == null ? '' : String(Number(v)))
const intToInput = (v: number | null): string => (v == null ? '' : String(v))
const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v))

// Formulario interno: se remonta (via key) por plan, asi el estado arranca precargado.
const PlanForm: FC<{plan: Plan | null; onClose: () => void}> = ({plan, onClose}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)
  const isEdit = plan !== null
  const toast = useToast()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const {data: planesData} = usePlanes()
  const catalog = planesData?.catalog

  // key de feature -> id i18n de su label (lo manda el backend en catalog.features).
  const featureLabel = (fkey: string): string => {
    const id = catalog?.features.find((f) => f.key === fkey)?.label
    return id ? intl.formatMessage({id}) : fkey
  }

  const [key, setKey] = useState(plan?.key ?? '')
  const [keyTouched, setKeyTouched] = useState(false)
  const [name, setName] = useState(plan?.name ?? '')
  const [description, setDescription] = useState(plan?.description ?? '')
  const [isActive, setIsActive] = useState(plan?.is_active ?? true)
  const [priceMonthly, setPriceMonthly] = useState(priceToInput(plan?.price_monthly ?? null))
  const [priceAnnual, setPriceAnnual] = useState(priceToInput(plan?.price_annual ?? null))
  const [maxEstudiantes, setMaxEstudiantes] = useState(intToInput(plan?.max_estudiantes ?? null))
  const [storageGb, setStorageGb] = useState(intToInput(plan?.storage_gb ?? null))
  const [maxSedes, setMaxSedes] = useState(intToInput(plan?.max_sedes ?? null))
  const [maxPasarelas, setMaxPasarelas] = useState(intToInput(plan?.max_pasarelas ?? null))
  const [selected, setSelected] = useState<string[]>(plan?.features ?? [])
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const pending = create.isPending || update.isPending

  const toggleFeature = (fkey: string) =>
    setSelected((prev) => (prev.includes(fkey) ? prev.filter((k) => k !== fkey) : [...prev, fkey]))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const input = {
      key,
      name,
      description: description.trim() || null,
      is_active: isActive,
      price_monthly: numOrNull(priceMonthly),
      price_annual: numOrNull(priceAnnual),
      max_estudiantes: numOrNull(maxEstudiantes),
      storage_gb: numOrNull(storageGb),
      max_sedes: numOrNull(maxSedes),
      max_pasarelas: numOrNull(maxPasarelas),
      features: selected,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (isEdit && plan) {
      update.mutate(
        {id: plan.id, input},
        {
          onSuccess: () => {
            toast.success(t('common.toast.updated', {name}))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(
        {...input, sort_order: (planesData?.data.length ?? 0) + 1},
        {
          onSuccess: () => {
            toast.success(t('common.toast.created', {name}))
            onClose()
          },
          onError,
        }
      )
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='modal-body py-lg-10 px-lg-10'>
        {/* Nombre + Key */}
        <div className='row'>
          <div className='col-md-7 fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>{t('planes.field.name')}</label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('name') ? 'is-invalid' : ''}`}
              placeholder={t('planes.field.namePh')}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!isEdit && !keyTouched) setKey(slugify(e.target.value))
              }}
            />
            {fe('name') && <div className='invalid-feedback'>{fe('name')}</div>}
          </div>
          <div className='col-md-5 fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>{t('common.field.key')}</label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('key') ? 'is-invalid' : ''}`}
              placeholder={t('planes.field.keyPh')}
              value={key}
              disabled={isEdit}
              readOnly={isEdit}
              onChange={(e) => {
                setKey(e.target.value)
                setKeyTouched(true)
              }}
            />
            {fe('key') && <div className='invalid-feedback'>{fe('key')}</div>}
            {isEdit && <div className='text-muted fs-8 mt-1'>{t('planes.field.keyLocked')}</div>}
          </div>
        </div>

        {/* Descripcion */}
        <div className='fv-row mb-7'>
          <label className='fs-6 fw-semibold mb-2'>{t('common.description')}</label>
          <textarea
            className={`form-control form-control-solid ${fe('description') ? 'is-invalid' : ''}`}
            rows={2}
            placeholder={t('planes.field.descriptionPh')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {fe('description') && <div className='invalid-feedback'>{fe('description')}</div>}
        </div>

        {/* Precios */}
        <div className='row'>
          <div className='col-md-6 fv-row mb-7'>
            <label className='fs-6 fw-semibold mb-2'>{t('planes.field.priceMonthly')}</label>
            <div className='input-group'>
              <span className='input-group-text'>$</span>
              <input
                type='number'
                min='0'
                step='1000'
                className={`form-control form-control-solid ${fe('price_monthly') ? 'is-invalid' : ''}`}
                placeholder={t('planes.field.priceMonthlyPh')}
                value={priceMonthly}
                onChange={(e) => setPriceMonthly(e.target.value)}
              />
            </div>
            {fe('price_monthly') && <div className='text-danger fs-7 mt-1'>{fe('price_monthly')}</div>}
          </div>
          <div className='col-md-6 fv-row mb-7'>
            <label className='fs-6 fw-semibold mb-2'>{t('planes.field.priceAnnual')}</label>
            <div className='input-group'>
              <span className='input-group-text'>$</span>
              <input
                type='number'
                min='0'
                step='1000'
                className={`form-control form-control-solid ${fe('price_annual') ? 'is-invalid' : ''}`}
                placeholder={t('planes.field.priceAnnualPh')}
                value={priceAnnual}
                onChange={(e) => setPriceAnnual(e.target.value)}
              />
            </div>
            {fe('price_annual') && <div className='text-danger fs-7 mt-1'>{fe('price_annual')}</div>}
          </div>
        </div>

        {/* Limites cuantitativos (vacio = ilimitado) */}
        <label className='fs-6 fw-semibold mb-2'>{t('planes.limits.title')}</label>
        <div className='text-muted fs-7 mb-4'>{t('planes.limits.help')}</div>
        <div className='row'>
          <div className='col-md-3 fv-row mb-7'>
            <label className='fs-7 fw-semibold text-muted mb-2'>{t('plan.limit.maxEstudiantes')}</label>
            <input
              type='number'
              min='1'
              className={`form-control form-control-solid ${fe('max_estudiantes') ? 'is-invalid' : ''}`}
              placeholder={t('common.unlimited')}
              value={maxEstudiantes}
              onChange={(e) => setMaxEstudiantes(e.target.value)}
            />
            {fe('max_estudiantes') && <div className='invalid-feedback'>{fe('max_estudiantes')}</div>}
          </div>
          <div className='col-md-3 fv-row mb-7'>
            <label className='fs-7 fw-semibold text-muted mb-2'>{t('plan.limit.storageGb')}</label>
            <input
              type='number'
              min='1'
              className={`form-control form-control-solid ${fe('storage_gb') ? 'is-invalid' : ''}`}
              placeholder={t('common.unlimited')}
              value={storageGb}
              onChange={(e) => setStorageGb(e.target.value)}
            />
            {fe('storage_gb') && <div className='invalid-feedback'>{fe('storage_gb')}</div>}
          </div>
          <div className='col-md-3 fv-row mb-7'>
            <label className='fs-7 fw-semibold text-muted mb-2'>{t('plan.limit.maxSedes')}</label>
            <input
              type='number'
              min='1'
              className={`form-control form-control-solid ${fe('max_sedes') ? 'is-invalid' : ''}`}
              placeholder={t('common.unlimited')}
              value={maxSedes}
              onChange={(e) => setMaxSedes(e.target.value)}
            />
            {fe('max_sedes') && <div className='invalid-feedback'>{fe('max_sedes')}</div>}
          </div>
          <div className='col-md-3 fv-row mb-7'>
            <label className='fs-7 fw-semibold text-muted mb-2'>{t('plan.limit.maxPasarelas')}</label>
            <input
              type='number'
              min='1'
              className={`form-control form-control-solid ${fe('max_pasarelas') ? 'is-invalid' : ''}`}
              placeholder={t('common.unlimited')}
              value={maxPasarelas}
              onChange={(e) => setMaxPasarelas(e.target.value)}
            />
            {fe('max_pasarelas') && <div className='invalid-feedback'>{fe('max_pasarelas')}</div>}
          </div>
        </div>

        {/* Estado */}
        <div className='fv-row mb-7'>
          <label className='form-check form-switch form-check-custom form-check-solid'>
            <input
              className='form-check-input'
              type='checkbox'
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className='form-check-label fw-semibold text-gray-800'>{t('common.active')}</span>
          </label>
        </div>

        {/* Features del catalogo cerrado */}
        <div className='fv-row'>
          <label className='fs-6 fw-semibold mb-2'>{t('planes.features.title')}</label>
          <div className='text-muted fs-7 mb-4'>
            {t('planes.features.help', {count: selected.length})}
          </div>
          <div className='mh-300px overflow-auto pe-2'>
            {(catalog?.features ?? []).length === 0 && (
              <div className='text-muted fs-7'>{t('planes.features.loading')}</div>
            )}
            {(catalog?.features ?? []).map((f) => (
              <label
                key={f.key}
                className='d-flex align-items-center justify-content-between border border-gray-300 border-dashed rounded p-4 mb-3 cursor-pointer'
              >
                <span className='fw-semibold text-gray-800 fs-6'>{featureLabel(f.key)}</span>
                <span className='form-check form-switch form-check-custom form-check-solid ms-3'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    checked={selected.includes(f.key)}
                    onChange={() => toggleFeature(f.key)}
                  />
                </span>
              </label>
            ))}
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
              {t('common.pleaseWait')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : isEdit ? (
            intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.plan'})})
          ) : (
            intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.plan'})})
          )}
        </button>
      </div>
    </form>
  )
}

// Modal "Nuevo plan" / "Editar plan". Submit real: POST /plans o PUT /plans/{id}.
const PlanFormDialog: FC<Props> = ({show, plan, onClose}) => {
  const intl = useIntl()
  const isEdit = plan !== null

  return createPortal(
    <Modal
      id='kt_modal_plan_form'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <div className='d-flex flex-column'>
          <h2 className='fw-bold'>
            {intl.formatMessage({id: isEdit ? 'planes.edit.title' : 'planes.new'})}
          </h2>
          <span className='text-muted fs-7'>{intl.formatMessage({id: 'planes.form.subtitle'})}</span>
        </div>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {show && <PlanForm key={plan?.id ?? 'new'} plan={plan} onClose={onClose} />}
    </Modal>,
    modalsRoot
  )
}

export {PlanFormDialog}
