import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {FormattedMessage, useIntl} from 'react-intl'

const modalsRoot = document.getElementById('root-modals') || document.body

export interface ResetPasswordInfo {
  status: 'temporal' | 'changed' | 'none'
  email: string | null
  password: string | null
}

export interface ResetPasswordGenerated {
  email: string
  password: string
}

type Props = {
  show: boolean
  onClose: () => void
  entityName: string
  entityLabel?: string
  pwInfo: ResetPasswordInfo | null
  isLoading: boolean
  isError: boolean
  onRegenerate: () => void
  isRegenerating: boolean
  generated: ResetPasswordGenerated | null
  accessUrl?: string | null
  /** IDs de i18n para los textos del modal (default: common.pwd.*) */
  i18nPrefix?: string
}

const ResetPasswordDialog: FC<Props> = ({
  show,
  onClose,
  entityName,
  entityLabel = 'Colegio',
  pwInfo,
  isLoading,
  isError,
  onRegenerate,
  isRegenerating,
  generated,
  accessUrl,
  i18nPrefix = 'common.pwd',
}) => {
  const intl = useIntl()
  const t = (id: string, d?: string) => intl.formatMessage({id, defaultMessage: d})
  const tk = (key: string) => t(`${i18nPrefix}.${key}`, t(`common.pwd.${key}`))

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value)
  }

  const renderBody = () => {
    if (generated) {
      return (
        <>
          <div className='text-muted fs-7 mb-5'>{tk('once')}</div>
          <div className='mb-3'>
            <span className='text-muted'>{entityLabel} </span>
            <span className='fw-bold text-gray-800'>{entityName}</span>
          </div>
          <div className='mb-3'>
            <span className='text-muted'>Email </span>
            <span className='fw-bold text-gray-800'>{generated.email}</span>
          </div>
          <div>
            <span className='text-muted'>{tk('currentLabel')}</span>
            <div className='mt-2 rounded bg-light-primary text-primary font-monospace fs-4 fw-bold px-4 py-3 text-center'>
              {generated.password}
            </div>
          </div>
          {accessUrl && (
            <div className='mt-6'>
              <span className='text-muted'>URL de acceso</span>
              <div className='text-gray-700 fs-7 mt-1'>{accessUrl}</div>
            </div>
          )}
        </>
      )
    }

    if (isLoading) {
      return (
        <div className='d-flex justify-content-center align-items-center py-10'>
          <span className='spinner-border text-primary' role='status'></span>
        </div>
      )
    }

    if (isError || !pwInfo) {
      return (
        <div className='alert alert-danger d-flex align-items-start py-4'>
          <i className='ki-duotone ki-information fs-2 text-danger me-3'>
            <span className='path1'></span><span className='path2'></span><span className='path3'></span>
          </i>
          <span>{tk('loadError')}</span>
        </div>
      )
    }

    if (pwInfo.status === 'temporal' && pwInfo.password) {
      return (
        <>
          <div className='alert alert-primary d-flex align-items-center py-3'>
            <i className='ki-duotone ki-information-5 fs-2 me-3'>
              <span className='path1'></span><span className='path2'></span>
            </i>
            <span className='fs-7'>{tk('temporalActive')}</span>
          </div>
          <div className='mb-3'>
            <span className='text-muted'>Email </span>
            <span className='fw-bold text-gray-800'>{pwInfo.email}</span>
          </div>
          <div className='mb-5'>
            <span className='text-muted'>{tk('currentLabel')}</span>
            <div className='d-flex align-items-stretch gap-2'>
              <div className='flex-grow-1 mt-2 rounded bg-light-primary text-primary font-monospace fs-4 fw-bold px-4 py-3 text-center'>
                {pwInfo.password}
              </div>
              <button
                type='button'
                className='btn btn-icon btn-light-primary align-self-end'
                onClick={() => copy(pwInfo.password ?? '')}
                title={tk('copy')}
              >
                <i className='ki-duotone ki-copy fs-2'>
                  <span className='path1'></span><span className='path2'></span><span className='path3'></span>
                </i>
              </button>
            </div>
          </div>
          {accessUrl && (
            <div className='mt-4'>
              <span className='text-muted'>URL de acceso</span>
              <div className='text-gray-700 fs-7 mt-1'>{accessUrl}</div>
            </div>
          )}
        </>
      )
    }

    if (pwInfo.status === 'changed') {
      return (
        <div className='alert alert-warning d-flex align-items-start py-4'>
          <i className='ki-duotone ki-information fs-2 text-warning me-3'>
            <span className='path1'></span><span className='path2'></span><span className='path3'></span>
          </i>
          <span>
            <FormattedMessage
              id={`${i18nPrefix}.changedBody`}
              defaultMessage={intl.formatMessage({id: 'common.pwd.changedBody'})}
              values={{name: <span className='fw-bold text-gray-900'>{entityName}</span>}}
            />
          </span>
        </div>
      )
    }

    // status === 'none'
    return (
      <div className='text-gray-700 fs-6'>
        <FormattedMessage
          id={`${i18nPrefix}.noneBody`}
          defaultMessage={intl.formatMessage({id: 'common.pwd.noneBody'})}
          values={{name: <span className='fw-bold text-gray-900'>{entityName}</span>}}
        />
      </div>
    )
  }

  const renderFooter = () => {
    if (generated) {
      return (
        <button type='button' className='btn btn-primary' onClick={onClose}>
          {t('common.close', 'Cerrar')}
        </button>
      )
    }

    const showRegenerate = isError || !pwInfo || pwInfo.status !== 'changed'
    const showReset = !isError && pwInfo?.status === 'changed'

    return (
      <>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel', 'Cancelar')}
        </button>
        {showReset && (
          <button type='button' className='btn btn-primary' onClick={onRegenerate} disabled={isRegenerating}>
            {isRegenerating ? (
              <span className='indicator-progress d-block'>
                {tk('regenerating')}
                <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
              </span>
            ) : (
              <>
                <i className='ki-duotone ki-key fs-3'>
                  <span className='path1'></span><span className='path2'></span>
                </i>
                {tk('reset')}
              </>
            )}
          </button>
        )}
        {showRegenerate && (
          <button type='button' className='btn btn-light-primary' onClick={onRegenerate} disabled={isRegenerating}>
            {isRegenerating ? (
              <span className='indicator-progress d-block'>
                {tk('regenerating')}
                <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
              </span>
            ) : (
              <>
                <i className='ki-duotone ki-key fs-3'>
                  <span className='path1'></span><span className='path2'></span>
                </i>
                {tk('regenerate')}
              </>
            )}
          </button>
        )}
      </>
    )
  }

  return createPortal(
    <Modal
      id='kt_modal_reset_password'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-550px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {generated ? tk('newTitle') : tk('title')}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span><span className='path2'></span>
          </i>
        </div>
      </div>

      <div className='modal-body py-lg-10 px-lg-10'>{renderBody()}</div>

      <div className='modal-footer'>{renderFooter()}</div>
    </Modal>,
    modalsRoot
  )
}

export {ResetPasswordDialog}
