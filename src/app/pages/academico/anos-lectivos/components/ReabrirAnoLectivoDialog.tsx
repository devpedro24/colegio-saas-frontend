import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {FormattedMessage, useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useReabrirAnoLectivo} from '../anos-lectivos.api'
import type {AnoLectivo} from '../anos-lectivos.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  ano: AnoLectivo | null
  onClose: () => void
}

// Corrección excepcional: solo la plataforma puede devolver un año cerrado a curso.
const ReabrirAnoLectivoDialog: FC<Props> = ({show, ano, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const reabrir = useReabrirAnoLectivo()

  const confirm = () => {
    if (!ano) return
    reabrir.mutate(ano.id, {
      onSuccess: () => {
        toast.success(intl.formatMessage({id: 'academico.anos.toast.reabierto'}, {name: ano.nombre}))
        onClose()
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : t('common.toast.genericError'))
      },
    })
  }

  return createPortal(
    <Modal
      id='kt_modal_reabrir_ano'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-500px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>{t('academico.anos.reabrir.title')}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>
      <div className='modal-body py-lg-10 px-lg-10 text-center'>
        <i className='ki-duotone ki-arrows-circle fs-5x text-primary mb-5'>
          <span className='path1'></span>
          <span className='path2'></span>
        </i>
        <div className='fs-5 text-gray-800'>
          <FormattedMessage
            id='academico.anos.reabrir.body'
            values={{name: <span className='fw-bold'>{ano?.nombre}</span>}}
          />
        </div>
      </div>
      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type='button' className='btn btn-primary' onClick={confirm} disabled={reabrir.isPending}>
          {reabrir.isPending ? (
            <span className='indicator-progress d-block'>
              {t('academico.anos.reabrir.pending')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            t('academico.anos.reabrir.confirm')
          )}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {ReabrirAnoLectivoDialog}
