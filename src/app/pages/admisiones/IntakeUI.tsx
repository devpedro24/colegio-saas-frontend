import type {ReactNode} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntakeText} from './intakeWorkflow'
import './intake-workflow.scss'

export function IntakeIcon({name}: {name: string}) {
  return <i className={`bi bi-${name}`} aria-hidden='true' />
}
export function IntakeNotice({
  children,
  kind = 'info',
}: {
  children: ReactNode
  kind?: 'info' | 'warning' | 'danger' | 'success'
}) {
  return (
    <div className={`intake-notice ${kind}`} role={kind === 'danger' ? 'alert' : 'status'}>
      <IntakeIcon name={kind === 'warning' ? 'exclamation-triangle' : 'info-circle'} />
      <div>{children}</div>
    </div>
  )
}
export function IntakePayments() {
  const t = useIntakeText()
  return (
    <div className='intake-payments'>
      {['pinPayment', 'enrollmentPayment'].map((key) => (
        <span key={key}>
          <IntakeIcon name='credit-card' />
          {t(key)}
          <small>{t('soon')}</small>
        </span>
      ))}
    </div>
  )
}
export function IntakeModal({
  title,
  children,
  close,
  footer,
  wide = false,
}: {
  title: string
  children: ReactNode
  close: () => void
  footer?: ReactNode
  wide?: boolean
}) {
  const t = useIntakeText()
  return (
    <Modal
      show
      centered
      scrollable
      backdrop='static'
      onHide={close}
      size={wide ? 'xl' : 'lg'}
      dialogClassName='intake-dialog'
    >
      <Modal.Header>
        <Modal.Title>{title}</Modal.Title>
        <button className='intake-close' type='button' aria-label={t('close')} onClick={close}>
          <IntakeIcon name='x-lg' />
        </button>
      </Modal.Header>
      <Modal.Body className='intake-next'>{children}</Modal.Body>
      {footer && <Modal.Footer>{footer}</Modal.Footer>}
    </Modal>
  )
}
