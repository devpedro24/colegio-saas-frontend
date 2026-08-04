import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreateRole, useUpdateRole} from '../rbac.api'
import {RbacRole} from '../rbac.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  // null = crear; un rol = editar (la clave queda inmutable).
  role: RbacRole | null
  onClose: () => void
}

/** Deriva una key (slug con guion bajo) a partir del nombre. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const RoleForm: FC<{role: RbacRole | null; onClose: () => void}> = ({role, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const isEdit = role !== null
  const toast = useToast()
  const create = useCreateRole()
  const update = useUpdateRole()
  const pending = create.isPending || update.isPending

  const [label, setLabel] = useState(role?.label ?? '')
  const [key, setKey] = useState(role?.key ?? '')
  const [keyTouched, setKeyTouched] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('rbac.role.saveError'))
      }
    }

    if (isEdit && role) {
      update.mutate(
        {id: role.id, input: {label}},
        {
          onSuccess: () => {
            toast.success(t('rbac.role.toastUpdated'))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(
        {label, key},
        {
          onSuccess: () => {
            toast.success(t('rbac.role.toastCreated'))
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
        <div className='text-muted fs-7 mb-7'>{t('rbac.role.help')}</div>

        {/* Nombre */}
        <div className='fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('rbac.role.name')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('label') ? 'is-invalid' : ''}`}
            placeholder={t('rbac.role.namePh')}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              if (!isEdit && !keyTouched) setKey(slugify(e.target.value))
            }}
          />
          {fe('label') && <div className='invalid-feedback'>{fe('label')}</div>}
        </div>

        {/* Clave (inmutable al editar) */}
        <div className='fv-row'>
          <label className='required fs-6 fw-semibold mb-2'>{t('rbac.role.key')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('key') ? 'is-invalid' : ''}`}
            placeholder={t('rbac.role.keyPh')}
            value={key}
            disabled={isEdit}
            readOnly={isEdit}
            onChange={(e) => {
              setKey(e.target.value)
              setKeyTouched(true)
            }}
          />
          {fe('key') && <div className='invalid-feedback'>{fe('key')}</div>}
          {isEdit && <div className='text-muted fs-8 mt-2'>{t('rbac.role.keyLocked')}</div>}
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
          ) : isEdit ? (
            t('common.save')
          ) : (
            t('rbac.role.create')
          )}
        </button>
      </div>
    </form>
  )
}

// Modal "Nuevo/Editar rol". Submit real: POST/PUT /rbac/roles.
const RoleFormDialog: FC<Props> = ({show, role, onClose}) => {
  const intl = useIntl()
  const isEdit = role !== null

  return createPortal(
    <Modal
      id='kt_modal_rbac_role'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-550px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {intl.formatMessage({id: isEdit ? 'rbac.role.editTitleDialog' : 'rbac.role.newTitle'})}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {show && <RoleForm key={role?.id ?? 'new'} role={role} onClose={onClose} />}
    </Modal>,
    modalsRoot
  )
}

export {RoleFormDialog}
