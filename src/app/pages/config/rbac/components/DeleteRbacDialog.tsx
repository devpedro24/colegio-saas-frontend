import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {FormattedMessage, useIntl} from 'react-intl'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  // Tipo de entidad a eliminar ('permiso' | 'rol') para los textos.
  entity: 'permiso' | 'rol'
  // Nombre a mostrar (label del rol o clave del permiso).
  name?: string
  // Ejecuta el borrado real (DELETE /rbac/...). Lo provee la pagina.
  onConfirm: () => void
  pending?: boolean
  onClose: () => void
}

// Modal de confirmacion "Eliminar permiso/rol?". Borrado real via onConfirm.
// Los del sistema (is_system) no llegan aca: no muestran boton de eliminar.
const DeleteRbacDialog: FC<Props> = ({show, entity, name, onConfirm, pending, onClose}) => {
  const intl = useIntl()
  const entityLabel = intl.formatMessage({id: `rbac.entity.${entity}`})

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
        <h2 className='fw-bold'>
          <FormattedMessage id='rbac.delete.title' values={{entity: entityLabel}} />
        </h2>
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
          <FormattedMessage
            id='rbac.delete.body'
            values={{entity: entityLabel, name: <span className='fw-bold'>{name}</span>}}
          />
        </div>
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {intl.formatMessage({id: 'common.cancel'})}
        </button>
        <button type='button' className='btn btn-danger' onClick={onConfirm} disabled={pending}>
          {pending ? (
            <span className='indicator-progress d-block'>
              {intl.formatMessage({id: 'rbac.delete.pending'})}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            intl.formatMessage({id: 'rbac.delete.confirm'})
          )}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {DeleteRbacDialog}
