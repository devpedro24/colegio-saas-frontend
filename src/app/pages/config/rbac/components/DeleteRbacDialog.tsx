import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  // Tipo de entidad a eliminar ('permiso' | 'rol') para los textos.
  entity: 'permiso' | 'rol'
  // Nombre a mostrar (label del rol o clave del permiso).
  name?: string
  onClose: () => void
}

// Modal de confirmacion "Eliminar permiso/rol?". Solo UI: Eliminar solo cierra el modal.
const DeleteRbacDialog: FC<Props> = ({show, entity, name, onClose}) => {
  return createPortal(
    <Modal
      id='kt_modal_delete_rbac'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-500px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>Eliminar {entity}?</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      <div className='modal-body py-lg-10 px-lg-10 text-center'>
        <i className='ki-duotone ki-trash fs-5x text-danger mb-5'>
          <span className='path1'></span>
          <span className='path2'></span>
          <span className='path3'></span>
          <span className='path4'></span>
          <span className='path5'></span>
        </i>
        <div className='fs-5 text-gray-800'>
          Estas a punto de eliminar el {entity} <span className='fw-bold'>{name}</span>. Esta accion
          no se puede deshacer.
        </div>
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          Cancelar
        </button>
        <button type='button' className='btn btn-danger' onClick={onClose}>
          Si, eliminar
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {DeleteRbacDialog}
