import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import type {Usuario} from '../usuarios.types'

const modalRoot = document.getElementById('root-modals') || document.body

export function EgresoConfirmDialog({user, pending, onConfirm, onClose}: {
  user: Usuario | null
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string>) => intl.formatMessage({id}, values)

  return createPortal(
    <Modal show={user !== null} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{t('academico.usuarios.egreso.title')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className='mb-0'>{t('academico.usuarios.egreso.explanation', {name: user?.name ?? ''})}</p>
      </Modal.Body>
      <Modal.Footer>
        <button type='button' className='btn btn-light' onClick={onClose} disabled={pending}>
          {t('common.cancel')}
        </button>
        <button type='button' className='btn btn-warning' onClick={onConfirm} disabled={pending}>
          {pending ? <span className='spinner-border spinner-border-sm' role='status' /> : t('academico.usuarios.egreso.confirm')}
        </button>
      </Modal.Footer>
    </Modal>,
    modalRoot
  )
}
