import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {FormattedMessage, useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useUpdateColegioStatus} from '../colegios.api'
import {Colegio} from '../colegios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  colegio: Colegio | null
  onClose: () => void
}

// Confirmacion de "Inhabilitar colegio". El backend NO expone borrado: inhabilitar
// = suspender (bloquea el subdominio del tenant). Es reversible con el switch.
const DisableColegioDialog: FC<Props> = ({show, colegio, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const updateStatus = useUpdateColegioStatus()

  const confirm = () => {
    if (!colegio) return
    updateStatus.mutate(
      {id: colegio.id, status: 'suspended'},
      {
        onSuccess: () => {
          toast.success(intl.formatMessage({id: 'colegios.toast.disabled'}, {name: colegio.name}))
          onClose()
        },
        onError: (err) => {
          const message =
            err instanceof ApiError ? err.message : t('common.toast.genericError')
          toast.error(message)
        },
      }
    )
  }

  return createPortal(
    <Modal
      id='kt_modal_disable_colegio'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-500px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>{t('colegios.disable.title')}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      <div className='modal-body py-lg-10 px-lg-10 text-center'>
        <i className='ki-duotone ki-shield-cross fs-5x text-warning mb-5'>
          <span className='path1'></span>
          <span className='path2'></span>
        </i>
        <div className='fs-5 text-gray-800'>
          <FormattedMessage
            id='colegios.disable.body'
            values={{name: <span className='fw-bold'>{colegio?.name}</span>}}
          />
        </div>
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button
          type='button'
          className='btn btn-danger'
          onClick={confirm}
          disabled={updateStatus.isPending}
        >
          {updateStatus.isPending ? (
            <span className='indicator-progress d-block'>
              {t('colegios.disable.pending')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            t('colegios.disable.confirm')
          )}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {DisableColegioDialog}
