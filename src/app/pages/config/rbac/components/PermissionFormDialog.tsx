import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreatePermission, useUpdatePermission} from '../rbac.api'
import {RbacFeature, RbacPermission} from '../rbac.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  // null = crear; un permiso = editar (la clave queda inmutable).
  permission: RbacPermission | null
  features: RbacFeature[]
  onClose: () => void
}

/** Deriva una key a partir del modulo + accion (solo sugerencia al crear). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

const PermForm: FC<{
  permission: RbacPermission | null
  features: RbacFeature[]
  onClose: () => void
}> = ({permission, features, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const isEdit = permission !== null
  const toast = useToast()
  const create = useCreatePermission()
  const update = useUpdatePermission()
  const pending = create.isPending || update.isPending

  const [key, setKey] = useState(permission?.key ?? '')
  const [keyTouched, setKeyTouched] = useState(false)
  const [module, setModule] = useState(permission?.module ?? '')
  const [action, setAction] = useState(permission?.action ?? '')
  const [featureKey, setFeatureKey] = useState(permission?.feature_key ?? '')
  const [description, setDescription] = useState(permission?.description ?? '')
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)

  // key de feature -> id i18n de su label (el backend lo manda en el catalogo).
  const featureLabel = (fkey: string): string => {
    const id = features.find((f) => f.key === fkey)?.label
    return id ? intl.formatMessage({id}) : fkey
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const input = {
      module,
      action,
      feature_key: featureKey || null,
      description: description.trim() || null,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (isEdit && permission) {
      update.mutate(
        {id: permission.id, input},
        {
          onSuccess: () => {
            toast.success(t('common.toast.updated'))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(
        {...input, key},
        {
          onSuccess: () => {
            toast.success(t('common.toast.created'))
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
        <div className='text-muted fs-7 mb-7'>{t('rbac.perm.help')}</div>

        {/* Modulo */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('rbac.perm.module')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('module') ? 'is-invalid' : ''}`}
            placeholder={t('rbac.perm.modulePh')}
            value={module}
            onChange={(e) => {
              setModule(e.target.value)
              if (!isEdit && !keyTouched) setKey(slugify(`${e.target.value} ${action}`))
            }}
          />
          {fe('module') && <div className='invalid-feedback'>{fe('module')}</div>}
        </div>

        {/* Descripcion (accion) */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('common.description')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('action') ? 'is-invalid' : ''}`}
            placeholder={t('rbac.perm.actionPh')}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          {fe('action') && <div className='invalid-feedback'>{fe('action')}</div>}
        </div>

        {/* Clave (inmutable al editar) */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('common.field.key')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('key') ? 'is-invalid' : ''}`}
            placeholder={t('rbac.perm.keyPh')}
            value={key}
            disabled={isEdit}
            readOnly={isEdit}
            onChange={(e) => {
              setKey(e.target.value)
              setKeyTouched(true)
            }}
          />
          {fe('key') && <div className='invalid-feedback'>{fe('key')}</div>}
          {isEdit && <div className='text-muted fs-8 mt-2'>{t('rbac.perm.keyLocked')}</div>}
        </div>

        {/* Feature del plan */}
        <div className='fv-row mb-7'>
          <label className='fs-6 fw-semibold mb-2'>{t('rbac.perm.feature')}</label>
          <select
            className={`form-select form-select-solid ${fe('feature_key') ? 'is-invalid' : ''}`}
            value={featureKey}
            onChange={(e) => setFeatureKey(e.target.value)}
          >
            <option value=''>{t('rbac.perm.featureNone')}</option>
            {features.map((f) => (
              <option key={f.key} value={f.key}>
                {featureLabel(f.key)}
              </option>
            ))}
          </select>
          {fe('feature_key') && <div className='invalid-feedback'>{fe('feature_key')}</div>}
          <div className='text-muted fs-8 mt-2'>{t('rbac.perm.featureHelp')}</div>
        </div>

        {/* Notas */}
        <div className='fv-row'>
          <label className='fs-6 fw-semibold mb-2'>{t('rbac.perm.notes')}</label>
          <textarea
            className={`form-control form-control-solid ${fe('description') ? 'is-invalid' : ''}`}
            rows={2}
            placeholder={t('rbac.perm.notesPh')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {fe('description') && <div className='invalid-feedback'>{fe('description')}</div>}
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
            intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.permiso'})})
          ) : (
            t('rbac.perm.create')
          )}
        </button>
      </div>
    </form>
  )
}

// Modal "Nuevo/Editar permiso". Submit real: POST/PUT /rbac/permissions.
const PermissionFormDialog: FC<Props> = ({show, permission, features, onClose}) => {
  const intl = useIntl()
  const isEdit = permission !== null

  return createPortal(
    <Modal
      id='kt_modal_rbac_permission'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {intl.formatMessage({id: isEdit ? 'rbac.perm.editTitle' : 'rbac.perm.new'})}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {show && (
        <PermForm
          key={permission?.id ?? 'new'}
          permission={permission}
          features={features}
          onClose={onClose}
        />
      )}
    </Modal>,
    modalsRoot
  )
}

export {PermissionFormDialog}
