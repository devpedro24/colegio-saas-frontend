import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {RbacRole} from '../rbac.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  // null = crear; un rol = editar (la clave queda inmutable).
  role: RbacRole | null
  onClose: () => void
}

// Modal "Nuevo/Editar rol". Solo UI: el submit unicamente cierra el modal (sin backend).
// Campos (fiel a role-form-dialog.tsx): Nombre y Clave.
const RoleFormDialog: FC<Props> = ({show, role, onClose}) => {
  const isEdit = role !== null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onClose()
  }

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
        <h2 className='fw-bold'>{isEdit ? 'Editar rol' : 'Nuevo rol'}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {/* key remonta el form al cambiar de rol para refrescar los defaultValue. */}
      <form onSubmit={handleSubmit} key={role?.id ?? 'none'}>
        <div className='modal-body py-lg-10 px-lg-10'>
          <div className='text-muted fs-7 mb-7'>
            Un rol es un conjunto de permisos. Los colegios lo reciben segun su plan.
          </div>

          {/* Nombre */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Nombre</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='Coordinador Academico'
              defaultValue={role?.label ?? ''}
            />
          </div>

          {/* Clave (inmutable al editar) */}
          <div className='fv-row'>
            <label className='required fs-6 fw-semibold mb-2'>Clave</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='coord_academico'
              defaultValue={role?.key ?? ''}
              disabled={isEdit}
            />
            {isEdit && (
              <div className='text-muted fs-8 mt-2'>La clave no se puede cambiar una vez creada.</div>
            )}
          </div>
        </div>

        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            Cancelar
          </button>
          <button type='submit' className='btn btn-primary'>
            {isEdit ? 'Guardar cambios' : 'Crear rol'}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

export {RoleFormDialog}
