import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreateColegio} from '../colegios.api'
import {CreateColegioResponse} from '../colegios.types'
import {usePlanes} from '../../planes/planes.api'

// Los modales se montan en #root-modals (fallback a body). Portal => quedan fuera del
// arbol del card y sobre el backdrop.
const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  onClose: () => void
}

interface FormState {
  name: string
  slug: string
  slugTouched: boolean
  legal_name: string
  nit: string
  rector_name: string
  rector_email: string
  plan: string
}

const EMPTY: FormState = {
  name: '',
  slug: '',
  slugTouched: false,
  legal_name: '',
  nit: '',
  rector_name: '',
  rector_email: '',
  plan: '',
}

/** Deriva un subdominio (slug) a partir del nombre. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Modal "Nuevo colegio". Submit real: POST /colegios -> muestra la contrasena
// temporal del rector (una sola vez) e invalida la lista.
const CreateColegioDialog: FC<Props> = ({show, onClose}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)
  const toast = useToast()
  const create = useCreateColegio()
  // Planes reales de la BD (el backend valida plan con exists:plans,key).
  const {data: planesData} = usePlanes()
  const planOptions = (planesData?.data ?? []).filter((p) => p.is_active)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<ApiError | null>(null)
  const [created, setCreated] = useState<{data: CreateColegioResponse; rectorEmail: string} | null>(
    null
  )

  const fe = (field: string): string | undefined => error?.fieldError(field)

  const reset = () => {
    setForm(EMPTY)
    setError(null)
    setCreated(null)
    create.reset()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const set = (patch: Partial<FormState>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    create.mutate(
      {
        name: form.name,
        slug: form.slug,
        rector_email: form.rector_email,
        rector_name: form.rector_name.trim() || undefined,
        legal_name: form.legal_name.trim() || null,
        nit: form.nit.trim() || null,
        plan: form.plan,
      },
      {
        onSuccess: (data) => {
          setCreated({data, rectorEmail: form.rector_email})
          toast.success(t('common.toast.created', {name: data.colegio.name}))
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(err)
            if (!err.errors) toast.error(err.message)
          } else {
            toast.error(t('common.toast.genericError'))
          }
        },
      }
    )
  }

  return createPortal(
    <Modal
      id='kt_modal_create_colegio'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={handleClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>{created ? t('colegios.created.title') : t('colegios.created.title')}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={handleClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {created ? (
        // ----- Pantalla de exito: credenciales del rector (se muestran una vez) -----
        <>
          <div className='modal-body py-lg-10 px-lg-10'>
            <div className='text-muted fs-7 mb-5'>{t('colegios.create.credentialsHelp')}</div>
            <div className='mb-3'>
              <span className='text-muted'>{t('colegios.f.school')} </span>
              <span className='fw-bold text-gray-800'>{created.data.colegio.name}</span>
            </div>
            <div className='mb-3'>
              <span className='text-muted'>{t('colegios.f.access')} </span>
              <span className='fw-bold text-gray-800'>{created.data.colegio.subdomain}</span>
            </div>
            <div className='mb-3'>
              <span className='text-muted'>{t('colegios.f.rector')} </span>
              <span className='fw-bold text-gray-800'>{created.rectorEmail}</span>
            </div>
            <div>
              <span className='text-muted'>{t('colegios.f.tempPassword')}</span>
              <div className='mt-2 rounded bg-light-primary text-primary font-monospace fs-4 fw-bold px-4 py-3 text-center'>
                {created.data.rector_password}
              </div>
            </div>
          </div>
          <div className='modal-footer'>
            <button type='button' className='btn btn-light' onClick={reset}>
              {t('colegios.createAnother')}
            </button>
            <button type='button' className='btn btn-primary' onClick={handleClose}>
              {t('common.close')}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className='modal-body py-lg-10 px-lg-10'>
            {/* Nombre */}
            <div className='fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>{t('colegios.field.name')}</label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('name') ? 'is-invalid' : ''}`}
                placeholder={t('colegios.field.namePh')}
                value={form.name}
                onChange={(e) =>
                  set({
                    name: e.target.value,
                    ...(form.slugTouched ? {} : {slug: slugify(e.target.value)}),
                  })
                }
              />
              {fe('name') && <div className='invalid-feedback'>{fe('name')}</div>}
            </div>

            {/* Subdominio */}
            <div className='fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>{t('common.subdomain')}</label>
              <div className='input-group'>
                <input
                  type='text'
                  className={`form-control form-control-solid ${fe('slug') ? 'is-invalid' : ''}`}
                  placeholder={t('colegios.field.subdomainPh')}
                  value={form.slug}
                  readOnly
                />
                <span className='input-group-text'>.localhost</span>
              </div>
              {fe('slug') && <div className='text-danger fs-7 mt-1'>{fe('slug')}</div>}
              <div className='text-muted fs-8 mt-1'>{t('academico.estructura.sede.slugHelp')}</div>
            </div>

            {/* Razon social + NIT (opcionales) */}
            <div className='row'>
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>
                  {t('colegios.field.legalName')}{' '}
                  <span className='text-muted fw-normal'>({t('common.optional')})</span>
                </label>
                <input
                  type='text'
                  className={`form-control form-control-solid ${fe('legal_name') ? 'is-invalid' : ''}`}
                  placeholder={t('colegios.field.legalNamePh')}
                  value={form.legal_name}
                  onChange={(e) => set({legal_name: e.target.value})}
                />
                {fe('legal_name') && <div className='invalid-feedback'>{fe('legal_name')}</div>}
              </div>
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>
                  {t('common.field.nit')}{' '}
                  <span className='text-muted fw-normal'>({t('common.optional')})</span>
                </label>
                <input
                  type='text'
                  className={`form-control form-control-solid ${fe('nit') ? 'is-invalid' : ''}`}
                  placeholder={t('common.ph.nit')}
                  value={form.nit}
                  onChange={(e) => set({nit: e.target.value})}
                />
                {fe('nit') && <div className='invalid-feedback'>{fe('nit')}</div>}
              </div>
            </div>

            {/* Plan */}
            <div className='fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>{t('colegios.field.plan')}</label>
              <select
                className={`form-select form-select-solid ${fe('plan') ? 'is-invalid' : ''}`}
                value={form.plan}
                onChange={(e) => set({plan: e.target.value})}
              >
                <option value='' disabled>
                  {t('colegios.field.selectPlan')}
                </option>
                {planOptions.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
              {fe('plan') && <div className='invalid-feedback'>{fe('plan')}</div>}
            </div>

            {/* Rector */}
            <div className='row'>
              <div className='col-md-6 fv-row mb-7'>
                <label className='required fs-6 fw-semibold mb-2'>{t('colegios.field.rectorName')}</label>
                <input
                  type='text'
                  className={`form-control form-control-solid ${fe('rector_name') ? 'is-invalid' : ''}`}
                  placeholder={t('colegios.field.rectorNamePh')}
                  value={form.rector_name}
                  onChange={(e) => set({rector_name: e.target.value})}
                />
                {fe('rector_name') && <div className='invalid-feedback'>{fe('rector_name')}</div>}
              </div>
              <div className='col-md-6 fv-row mb-7'>
                <label className='required fs-6 fw-semibold mb-2'>{t('colegios.field.rectorEmail')}</label>
                <input
                  type='email'
                  className={`form-control form-control-solid ${fe('rector_email') ? 'is-invalid' : ''}`}
                  placeholder={t('colegios.field.rectorEmailPh')}
                  value={form.rector_email}
                  onChange={(e) => set({rector_email: e.target.value})}
                />
                {fe('rector_email') && (
                  <div className='invalid-feedback'>{fe('rector_email')}</div>
                )}
              </div>
            </div>
          </div>

          <div className='modal-footer'>
            <button type='button' className='btn btn-light' onClick={handleClose}>
              {t('common.cancel')}
            </button>
            <button type='submit' className='btn btn-primary' disabled={create.isPending}>
              {create.isPending ? (
                <span className='indicator-progress d-block'>
                  {t('common.pleaseWait')}
                  <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                </span>
              ) : (
                intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.colegio'})})
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>,
    modalsRoot
  )
}

export {CreateColegioDialog}
