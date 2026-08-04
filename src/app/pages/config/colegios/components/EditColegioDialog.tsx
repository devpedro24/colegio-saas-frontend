import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useUpdateColegio} from '../colegios.api'
import {Colegio} from '../colegios.types'
import {usePlanes} from '../../planes/planes.api'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  colegio: Colegio | null
  onClose: () => void
}

// Formulario interno: se remonta (via key) por colegio, asi el estado arranca
// precargado con sus datos. Campos = lo que acepta PUT /colegios/{id}
// (name, legal_name, nit, plan). El subdominio NO es editable (solo lectura) y el
// rector se gestiona desde "Contrasena del rector".
const EditForm: FC<{colegio: Colegio; onClose: () => void}> = ({colegio, onClose}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)
  const toast = useToast()
  const update = useUpdateColegio()
  // Planes reales; incluye el plan actual del colegio aunque este inactivo, para
  // que el select siempre muestre el valor seleccionado.
  const {data: planesData} = usePlanes()
  const activePlans = (planesData?.data ?? []).filter((p) => p.is_active)
  const planOptions =
    colegio.plan && !activePlans.some((p) => p.key === colegio.plan)
      ? [{key: colegio.plan, name: colegio.plan}, ...activePlans]
      : activePlans
  const [name, setName] = useState(colegio.name)
  const [legalName, setLegalName] = useState(colegio.legal_name ?? '')
  const [nit, setNit] = useState(colegio.nit ?? '')
  const [plan, setPlan] = useState(colegio.plan)
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    update.mutate(
      {
        id: colegio.id,
        input: {
          name,
          legal_name: legalName.trim() || null,
          nit: nit.trim() || null,
          plan,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('colegios.toast.updated', {name}))
          onClose()
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(err)
            if (!err.errors) toast.error(err.message)
          } else {
            toast.error(t('colegios.toast.updateError'))
          }
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='modal-body py-lg-10 px-lg-10'>
        {/* Nombre */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('colegios.field.name')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('name') ? 'is-invalid' : ''}`}
            placeholder={t('colegios.field.namePh')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {fe('name') && <div className='invalid-feedback'>{fe('name')}</div>}
        </div>

        {/* Subdominio (solo lectura: no se puede cambiar) */}
        <div className='fv-row mb-7'>
          <label className='fs-6 fw-semibold mb-2'>{t('colegios.field.subdomain')}</label>
          <input
            type='text'
            className='form-control form-control-solid'
            value={colegio.subdomain}
            disabled
            readOnly
          />
        </div>

        {/* Razon social + NIT */}
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
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            {fe('legal_name') && <div className='invalid-feedback'>{fe('legal_name')}</div>}
          </div>
          <div className='col-md-6 fv-row mb-7'>
            <label className='fs-6 fw-semibold mb-2'>
              {t('colegios.field.nit')}{' '}
              <span className='text-muted fw-normal'>({t('common.optional')})</span>
            </label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('nit') ? 'is-invalid' : ''}`}
              placeholder={t('colegios.field.nitPh')}
              value={nit}
              onChange={(e) => setNit(e.target.value)}
            />
            {fe('nit') && <div className='invalid-feedback'>{fe('nit')}</div>}
          </div>
        </div>

        {/* Plan */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('colegios.field.plan')}</label>
          <select
            className={`form-select form-select-solid ${fe('plan') ? 'is-invalid' : ''}`}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
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
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type='submit' className='btn btn-primary' disabled={update.isPending}>
          {update.isPending ? (
            <span className='indicator-progress d-block'>
              {t('common.saving')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            t('common.save')
          )}
        </button>
      </div>
    </form>
  )
}

// Modal "Editar colegio". Submit real: PUT /colegios/{id}.
const EditColegioDialog: FC<Props> = ({show, colegio, onClose}) => {
  const intl = useIntl()
  return createPortal(
    <Modal
      id='kt_modal_edit_colegio'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <div className='d-flex flex-column'>
          <h2 className='fw-bold'>{intl.formatMessage({id: 'colegios.edit.title'})}</h2>
          {colegio && <span className='text-muted fs-7'>{colegio.subdomain}</span>}
        </div>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {colegio && <EditForm key={colegio.id} colegio={colegio} onClose={onClose} />}
    </Modal>,
    modalsRoot
  )
}

export {EditColegioDialog}
