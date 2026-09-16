import {FC, useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {FormattedMessage, useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useResetRectorPassword} from '../colegios.api'
import {Colegio, ResetPasswordResponse} from '../colegios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  colegio: Colegio | null
  onClose: () => void
}

// Modal "Contraseña del rector". La clave anterior nunca es recuperable:
// POST /reset-password genera una nueva, invalida la anterior y la devuelve una vez.
const RectorPasswordDialog: FC<Props> = ({show, colegio, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const reset = useResetRectorPassword()
  const [generated, setGenerated] = useState<ResetPasswordResponse | null>(null)

  // Al cerrar, limpia la contrasena mostrada para no dejarla en el DOM.
  useEffect(() => {
    if (!show) {
      setGenerated(null)
      reset.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  const regenerate = () => {
    if (!colegio) return
    reset.mutate(colegio.id, {
      onSuccess: (data) => {
        setGenerated(data)
        toast.success(t('common.pwd.toast'))
      },
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : t('common.pwd.error')
        toast.error(message)
      },
    })
  }

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value).then(() => toast.success(t('common.pwd.copied')))
  }

  const renderBody = () => {
    if (generated) {
      return (
        <>
          <div className='text-muted fs-7 mb-5'>{t('common.pwd.once')}</div>
          <div className='mb-3'>
            <span className='text-muted'>{t('colegios.f.school')} </span>
            <span className='fw-bold text-gray-800'>{colegio?.name}</span>
          </div>
          <div className='mb-3'>
            <span className='text-muted'>{t('colegios.f.rector')} </span>
            <span className='fw-bold text-gray-800'>{generated.rector_email}</span>
          </div>
          <div>
            <span className='text-muted'>{t('colegios.f.tempPassword')}</span>
            <div className='d-flex align-items-stretch gap-2 mt-2'>
              <div className='flex-grow-1 rounded bg-light-primary text-primary font-monospace fs-4 fw-bold px-4 py-3 text-center'>
                {generated.rector_password}
              </div>
              <button
                type='button'
                className='btn btn-icon btn-light-primary'
                onClick={() => copy(generated.rector_password)}
                title={t('common.pwd.copy')}
              >
                <i className='ki-duotone ki-copy fs-2'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
              </button>
            </div>
          </div>
        </>
      )
    }

    return (
      <div className='alert alert-warning d-flex align-items-start py-4'>
        <i className='ki-duotone ki-information fs-2 text-warning me-3'>
          <span className='path1'></span>
          <span className='path2'></span>
          <span className='path3'></span>
        </i>
        <div className='text-gray-700 fs-6'>
          <FormattedMessage
            id='common.pwd.body'
            values={{name: <span className='fw-bold text-gray-900'>{colegio?.name}</span>}}
          />
        </div>
      </div>
    )
  }

  const renderFooter = () => {
    if (generated) {
      return (
        <button type='button' className='btn btn-primary' onClick={onClose}>
          {t('common.close')}
        </button>
      )
    }

    return (
      <>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type='button' className='btn btn-primary' onClick={regenerate} disabled={reset.isPending}>
          {reset.isPending ? (
            <span className='indicator-progress d-block'>
              {t('common.pwd.regenerating')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            <>
              <i className='ki-duotone ki-key fs-3'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              {t('common.pwd.reset')}
            </>
          )}
        </button>
      </>
    )
  }

  return createPortal(
    <Modal
      id='kt_modal_rector_password'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-550px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {generated ? t('common.pwd.newTitle') : t('common.pwd.title')}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      <div className='modal-body py-lg-10 px-lg-10'>{renderBody()}</div>

      <div className='modal-footer'>{renderFooter()}</div>
    </Modal>,
    modalsRoot
  )
}

export {RectorPasswordDialog}
