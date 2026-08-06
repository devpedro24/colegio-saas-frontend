import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  email: string | null
  password: string | null
  onClose: () => void
}

const CredencialesDialog: FC<Props> = ({show, email, password, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})

  return createPortal(
    <Modal
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-500px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>{t('academico.usuarios.password.title')}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>
      <div className='modal-body py-lg-10 px-lg-10'>
        <div className='alert alert-info d-flex align-items-center mb-7'>
          <i className='ki-duotone ki-information-3 fs-2 me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{t('academico.usuarios.password.text')}</span>
        </div>
        <div className='fv-row mb-6'>
          <label className='fs-6 fw-semibold mb-2 text-muted'>
            {t('common.email')}
          </label>
          <input type='text' className='form-control form-control-solid' value={email ?? '—'} readOnly />
        </div>
        <div className='fv-row'>
          <label className='fs-6 fw-semibold mb-2 text-muted'>
            {t('common.password.temporal')}
          </label>
          <input type='text' className='form-control form-control-solid' value={password ?? '—'} readOnly />
        </div>
      </div>
      <div className='modal-footer'>
        <button type='button' className='btn btn-primary' onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {CredencialesDialog}
