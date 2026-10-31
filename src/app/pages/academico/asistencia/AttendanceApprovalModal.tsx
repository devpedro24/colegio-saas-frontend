import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import type {AttendanceRequest} from './asistencia.api'

export function AttendanceApprovalModal({request, pending, error, onConfirm, onClose}: {
  request: AttendanceRequest | null
  pending: boolean
  error: string
  onConfirm: () => void
  onClose: () => void
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  return <Modal show={request !== null} onHide={() => {if (!pending) onClose()}}
    centered scrollable backdrop={pending ? 'static' : true} keyboard={!pending}
    aria-labelledby='attendance-approval-title' aria-describedby='attendance-approval-description'>
    <Modal.Header closeButton={!pending} closeLabel={t('common.cancel')}>
      <Modal.Title id='attendance-approval-title' className='fs-3 fw-bold'>
        {t('attendance.approvalTitle')}
      </Modal.Title>
    </Modal.Header>
    <Modal.Body className='p-6'>
      <div className='d-flex align-items-start gap-4 mb-5'>
        <span className='symbol symbol-45px flex-shrink-0' aria-hidden='true'>
          <span className='symbol-label bg-light-primary'><i className='bi bi-shield-check text-primary fs-2' /></span>
        </span>
        <p id='attendance-approval-description' className='text-gray-700 mb-0'>
          {t('attendance.confirmApproval')}
        </p>
      </div>
      {request && <div className='bg-light rounded-3 p-4 mb-5'>
        <div className='fw-bold text-gray-900 mb-1'>{request.estudiante}</div>
        <div className='text-gray-700 mb-3'>{request.asignatura} · {request.grupo}</div>
        <ul className='mb-0 ps-5 text-gray-700'>{request.marcas.map(mark => {
          const [year, month, day] = mark.fecha.split('-')
          return <li key={`${mark.fecha}:${mark.hora_inicio}:${mark.hora_fin}`}>
            {day}/{month}/{year} · {mark.hora_inicio}–{mark.hora_fin}
          </li>
        })}</ul>
      </div>}
      <div className='alert alert-warning mb-0'>{t('attendance.approvalNotice')}</div>
      {error && <div className='alert alert-danger mt-4 mb-0' role='alert'>{error}</div>}
    </Modal.Body>
    <Modal.Footer className='gap-2'>
      <button type='button' className='btn btn-light' disabled={pending} onClick={onClose} autoFocus>
        {t('common.cancel')}
      </button>
      <button type='button' className='btn btn-primary' disabled={pending} onClick={onConfirm}>
        {pending && <span className='spinner-border spinner-border-sm me-2' aria-hidden='true' />}
        {t(pending ? 'common.pleaseWait' : 'attendance.approve')}
      </button>
    </Modal.Footer>
  </Modal>
}
