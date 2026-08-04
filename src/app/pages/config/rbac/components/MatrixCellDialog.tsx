import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {FormattedMessage, useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useSetMatrixCell} from '../rbac.api'
import {CellState, CellType, RbacPermission, RbacRole} from '../rbac.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  role: RbacRole | null
  permission: RbacPermission | null
  state: CellState | null
  levels: string[]
  onClose: () => void
}

const TYPE_VALUES: CellType[] = ['structural', 'configurable', 'denied']

// Formulario interno de una celda; se remonta (via key) por celda para arrancar
// precargado con su estado actual.
const CellForm: FC<{
  role: RbacRole
  permission: RbacPermission
  state: CellState
  levels: string[]
  onClose: () => void
}> = ({role, permission, state, levels, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const setCell = useSetMatrixCell()
  const [type, setType] = useState<CellType>(state.type)
  const [level, setLevel] = useState<string>(state.level ?? 'ver')
  const [defaultGranted, setDefaultGranted] = useState<boolean>(state.default_granted)

  const apply = () => {
    setCell.mutate(
      {
        role_key: role.key,
        permission_key: permission.key,
        type,
        level: type === 'structural' ? level : null,
        default_granted: type === 'configurable' ? defaultGranted : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('rbac.cell.toast'))
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : t('rbac.cell.error'))
        },
      }
    )
  }

  return (
    <>
      <div className='modal-body py-lg-8 px-lg-10'>
        <div className='mb-6'>
          <div className='text-gray-800 fw-bold fs-5'>{permission.action}</div>
          <div className='text-muted font-monospace fs-8'>{permission.key}</div>
          <div className='text-muted fs-7 mt-1'>
            {t('rbac.cell.roleLabel')}{' '}
            <span className='fw-semibold text-gray-700'>{role.label}</span>
          </div>
        </div>

        {/* Tipo de celda */}
        <label className='fs-6 fw-semibold mb-2 d-block'>{t('rbac.cell.state')}</label>
        <div className='btn-group w-100 mb-6' role='group'>
          {TYPE_VALUES.map((value) => (
            <button
              key={value}
              type='button'
              className={`btn btn-sm ${type === value ? 'btn-primary' : 'btn-light'}`}
              onClick={() => setType(value)}
            >
              {t(`rbac.cellType.${value}`)}
            </button>
          ))}
        </div>

        {/* Nivel (solo estructural) */}
        {type === 'structural' && (
          <div className='fv-row mb-2'>
            <label className='fs-6 fw-semibold mb-2'>{t('rbac.cell.level')}</label>
            <select
              className='form-select form-select-solid'
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {intl.formatMessage({id: `rbac.level.${lvl}`, defaultMessage: lvl})}
                </option>
              ))}
            </select>
            <div className='text-muted fs-8 mt-2'>{t('rbac.cell.structuralHint')}</div>
          </div>
        )}

        {/* Default (solo configurable) */}
        {type === 'configurable' && (
          <label className='form-check form-switch form-check-custom form-check-solid mb-2'>
            <input
              className='form-check-input'
              type='checkbox'
              checked={defaultGranted}
              onChange={(e) => setDefaultGranted(e.target.checked)}
            />
            <span className='form-check-label fw-semibold text-gray-800'>
              {t('rbac.cell.defaultOn')}
            </span>
          </label>
        )}

        {type === 'denied' && <div className='text-muted fs-7'>{t('rbac.cell.deniedHint')}</div>}
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type='button' className='btn btn-primary' onClick={apply} disabled={setCell.isPending}>
          {setCell.isPending ? (
            <span className='indicator-progress d-block'>
              {t('common.saving')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            t('rbac.cell.apply')
          )}
        </button>
      </div>
    </>
  )
}

// Modal para editar una celda de la matriz (rol x permiso) y guardarla via PUT /rbac/matrix.
const MatrixCellDialog: FC<Props> = ({show, role, permission, state, levels, onClose}) => {
  return createPortal(
    <Modal
      id='kt_modal_matrix_cell'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-500px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          <FormattedMessage id='rbac.cell.title' />
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {role && permission && state && (
        <CellForm
          key={`${role.key}|${permission.key}`}
          role={role}
          permission={permission}
          state={state}
          levels={levels}
          onClose={onClose}
        />
      )}
    </Modal>,
    modalsRoot
  )
}

export {MatrixCellDialog}
