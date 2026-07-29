import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {RBAC_FEATURES} from '../rbac.mock'
import {RbacPermission} from '../rbac.types'

// Los modales se montan en #root-modals (fallback a body). Portal => quedan fuera del
// arbol del card y sobre el backdrop.
const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  // null = crear; un permiso = editar (la clave queda inmutable).
  permission: RbacPermission | null
  onClose: () => void
}

// Modal "Nuevo/Editar permiso". Solo UI: el submit unicamente cierra el modal (sin backend).
// Campos (fiel a permission-form-dialog.tsx): Clave, Modulo, Descripcion, Feature del plan, Notas.
const PermissionFormDialog: FC<Props> = ({show, permission, onClose}) => {
  const isEdit = permission !== null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onClose()
  }

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
        <h2 className='fw-bold'>{isEdit ? 'Editar permiso' : 'Nuevo permiso'}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {/* key remonta el form al cambiar de permiso para refrescar los defaultValue. */}
      <form onSubmit={handleSubmit} key={permission?.id ?? 'none'}>
        <div className='modal-body py-lg-10 px-lg-10'>
          <div className='text-muted fs-7 mb-7'>
            Un permiso ligado a una feature solo estara disponible en los planes que la incluyan.
          </div>

          {/* Clave (inmutable al editar) */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Clave</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='notas.registrar'
              defaultValue={permission?.key ?? ''}
              disabled={isEdit}
            />
            {isEdit && (
              <div className='text-muted fs-8 mt-2'>La clave no se puede cambiar una vez creada.</div>
            )}
          </div>

          {/* Modulo */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Modulo</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='Notas y Consolidados'
              defaultValue={permission?.module ?? ''}
            />
          </div>

          {/* Descripcion (accion) */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Descripcion</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='Registrar notas en su materia'
              defaultValue={permission?.action ?? ''}
            />
          </div>

          {/* Feature del plan */}
          <div className='fv-row mb-7'>
            <label className='fs-6 fw-semibold mb-2'>Feature del plan</label>
            <select
              className='form-select form-select-solid'
              defaultValue={permission?.featureKey ?? ''}
            >
              <option value=''>Sin feature (nucleo)</option>
              {RBAC_FEATURES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <div className='text-muted fs-8 mt-2'>
              Si el plan del colegio no incluye esta feature, el permiso queda bloqueado (candado).
            </div>
          </div>

          {/* Notas */}
          <div className='fv-row'>
            <label className='fs-6 fw-semibold mb-2'>Notas</label>
            <textarea
              className='form-control form-control-solid'
              rows={2}
              placeholder='Notas internas (opcional)'
            />
          </div>
        </div>

        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            Cancelar
          </button>
          <button type='submit' className='btn btn-primary'>
            {isEdit ? 'Guardar cambios' : 'Crear permiso'}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

export {PermissionFormDialog}
