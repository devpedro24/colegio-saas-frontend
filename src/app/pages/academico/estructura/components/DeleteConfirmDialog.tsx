import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  title: string
  text: string
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}

// Confirmacion generica de borrado (soft-delete). Reutilizada por todos los
// tabs de Estructura para no duplicar el modal.
const DeleteConfirmDialog: FC<Props> = ({show, title, text, pending, onConfirm, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})

  return createPortal(
    <Modal
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-450px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>{title}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>
      <div className='modal-body py-lg-10 px-lg-10'>
        <p className='text-gray-700 fs-6'>{text}</p>
      </div>
      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type='button' className='btn btn-danger' disabled={pending} onClick={onConfirm}>
          {pending ? (
            <span className='spinner-border spinner-border-sm align-middle'></span>
          ) : (
            t('academico.estructura.deleteConfirm.confirm')
          )}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {DeleteConfirmDialog}