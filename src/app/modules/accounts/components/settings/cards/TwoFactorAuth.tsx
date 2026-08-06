import {FC, useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {KTIcon} from '../../../../../../_metronic/helpers'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAuth} from '../../../../auth'
import {
  MfaSetupResponse,
  useMfaConfirm,
  useMfaDisable,
  useMfaSetup,
} from '@/app/pages/account/mfa.api'

// Card de "Verificación en dos pasos" (MFA/TOTP) para la página de ajustes de cuenta.
// Flujo: Activar -> POST /mfa/setup (muestra secreto + otpauth_url para teclear en la app
// autenticadora) -> código de 6 dígitos -> POST /mfa/confirm -> activado.
// Si ya está activo: Desactivar -> POST /mfa/disable.
const TwoFactorAuth: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {currentUser, setCurrentUser} = useAuth()

  const [enabled, setEnabled] = useState<boolean>(currentUser?.mfa_enabled === true)
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>(undefined)
  const [disarming, setDisarming] = useState<boolean>(false)

  const setupMutation = useMfaSetup()
  const confirmMutation = useMfaConfirm()
  const disableMutation = useMfaDisable()

  // MFA/TOTP SOLO para usuarios de PLATAFORMA (superadmin): un usuario que está
  // dentro de un colegio (tenant) no gestiona segundo factor desde sus ajustes.
  const isPlatform = currentUser?.is_platform === true

  if (!isPlatform) {
    return null
  }

  // Refleja el nuevo estado de MFA en el usuario del contexto (para persistirlo en UI).
  const syncUser = (mfa_enabled: boolean) => {
    setCurrentUser((prev) => (prev ? {...prev, mfa_enabled} : prev))
  }

  const startSetup = () => {
    setupMutation.mutate(undefined, {
      onSuccess: (data) => {
        setSetup(data)
        setCode('')
        setCodeError(undefined)
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : t('account.mfa.setupError'))
      },
    })
  }

  const cancelSetup = () => {
    setSetup(null)
    setCode('')
    setCodeError(undefined)
    confirmMutation.reset()
  }

  const confirm = () => {
    setCodeError(undefined)
    confirmMutation.mutate(code, {
      onSuccess: () => {
        setEnabled(true)
        setSetup(null)
        setCode('')
        syncUser(true)
        toast.success(t('account.mfa.enabledToast'))
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          const fieldError = err.fieldError('code')
          if (fieldError) {
            setCodeError(fieldError)
          } else {
            toast.error(err.message)
          }
        } else {
          toast.error(t('account.mfa.confirmError'))
        }
      },
    })
  }

  const disable = () => {
    setCodeError(undefined)
    disableMutation.mutate(code, {
      onSuccess: () => {
        setEnabled(false)
        setSetup(null)
        setDisarming(false)
        setCode('')
        syncUser(false)
        toast.success(t('account.mfa.disabledToast'))
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          const fieldError = err.fieldError('code')
          if (fieldError) {
            setCodeError(fieldError)
          } else {
            toast.error(err.message)
          }
        } else {
          toast.error(t('account.mfa.disableError'))
        }
      },
    })
  }

  return (
    <div className='card mb-5 mb-xl-10'>
      <div
        className='card-header border-0 cursor-pointer'
        role='button'
        data-bs-toggle='collapse'
        data-bs-target='#kt_account_two_factor'
      >
        <div className='card-title m-0'>
          <h3 className='fw-bold m-0'>
            <FormattedMessage id='account.mfa.title' defaultMessage='Verificación en dos pasos' />
          </h3>
        </div>
      </div>

      <div id='kt_account_two_factor' className='collapse show'>
        <div className='card-body border-top p-9'>
          {/* Estado ACTIVADO: badge + botón Desactivar */}
          {enabled ? (
            <div>
              <div className='d-flex flex-wrap align-items-center'>
                <div>
                  <div className='fs-6 fw-bolder mb-1'>
                    <FormattedMessage id='common.status' defaultMessage='Estado' />
                  </div>
                  <div className='d-flex align-items-center'>
                    <span className='badge badge-light-success fw-bold me-2'>
                      <FormattedMessage id='account.mfa.active' defaultMessage='Activada' />
                    </span>
                    <span className='fw-bold text-gray-600'>
                      <FormattedMessage
                        id='account.mfa.activeHint'
                        defaultMessage='Se te pedirá un código de 6 dígitos al iniciar sesión.'
                      />
                    </span>
                  </div>
                </div>

                {!disarming && (
                  <div className='ms-auto'>
                    <button
                      type='button'
                      className='btn btn-light-danger'
                      onClick={() => {
                        setCode('')
                        setCodeError(undefined)
                        setDisarming(true)
                      }}
                    >
                      <FormattedMessage id='account.mfa.disable' defaultMessage='Desactivar' />
                    </button>
                  </div>
                )}
              </div>

              {disarming && (
                <div className='mt-6 pt-6 border-top'>
                  <div className='fv-row mb-4 w-100 mw-300px'>
                    <label htmlFor='kt_mfa_disable_code' className='form-label fs-6 fw-bolder mb-3'>
                      <FormattedMessage
                        id='account.mfa.enterCode'
                        defaultMessage='Ingresa el código de 6 dígitos'
                      />
                    </label>
                    <input
                      id='kt_mfa_disable_code'
                      type='text'
                      inputMode='numeric'
                      autoComplete='one-time-code'
                      maxLength={6}
                      className='form-control form-control-lg form-control-solid'
                      placeholder='000000'
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        setCodeError(undefined)
                      }}
                    />
                    {codeError && (
                      <div className='fv-plugins-message-container'>
                        <div className='fv-help-block'>{codeError}</div>
                      </div>
                    )}
                  </div>
                  <div className='d-flex'>
                    <button
                      type='button'
                      className='btn btn-light-danger me-2 px-6'
                      onClick={disable}
                      disabled={disableMutation.isPending || code.length !== 6}
                    >
                      {disableMutation.isPending ? (
                        <span className='indicator-progress d-block'>
                          <FormattedMessage id='common.pleaseWait' defaultMessage='Por favor espera...' />
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </span>
                      ) : (
                        <FormattedMessage id='account.mfa.disable' defaultMessage='Desactivar' />
                      )}
                    </button>
                    <button
                      type='button'
                      className='btn btn-color-gray-500 btn-active-light-primary px-6'
                      onClick={() => {
                        setDisarming(false)
                        setCode('')
                        setCodeError(undefined)
                      }}
                      disabled={disableMutation.isPending}
                    >
                      <FormattedMessage id='common.cancel' defaultMessage='Cancelar' />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : setup ? (
            /* Estado ACTIVANDO: mostrar secreto + otpauth_url + input de código */
            <div className='flex-row-fluid'>
              <div className='fs-6 text-gray-700 mb-5'>
                <FormattedMessage
                  id='account.mfa.setupHint'
                  defaultMessage='Abre tu app autenticadora (por ejemplo Google Authenticator) y agrega una cuenta escribiendo manualmente este código secreto:'
                />
              </div>

              {/* Secreto en grande, para teclear en la app */}
              <div className='mb-2 fw-bold fs-7 text-gray-600'>
                <FormattedMessage id='account.mfa.secret' defaultMessage='Código secreto' />
              </div>
              <div className='rounded bg-light-primary text-primary font-monospace fs-2 fw-bold px-4 py-4 text-center text-break mb-6'>
                {setup.secret}
              </div>

              {/* Enlace otpauth (manual, sin librería de QR) */}
              <div className='mb-2 fw-bold fs-7 text-gray-600'>
                <FormattedMessage id='account.mfa.otpauthUrl' defaultMessage='Enlace de configuración' />
              </div>
              <div className='rounded bg-light font-monospace fs-8 text-gray-700 px-4 py-3 text-break mb-8'>
                {setup.otpauth_url}
              </div>

              {/* Código de 6 dígitos */}
              <div className='fv-row mb-6 w-100 mw-300px'>
                <label htmlFor='kt_mfa_code' className='form-label fs-6 fw-bolder mb-3'>
                  <FormattedMessage
                    id='account.mfa.enterCode'
                    defaultMessage='Ingresa el código de 6 dígitos'
                  />
                </label>
                <input
                  id='kt_mfa_code'
                  type='text'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  maxLength={6}
                  className='form-control form-control-lg form-control-solid'
                  placeholder='000000'
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    setCodeError(undefined)
                  }}
                />
                {codeError && (
                  <div className='fv-plugins-message-container'>
                    <div className='fv-help-block'>{codeError}</div>
                  </div>
                )}
              </div>

              <div className='d-flex'>
                <button
                  type='button'
                  className='btn btn-primary me-2 px-6'
                  onClick={confirm}
                  disabled={confirmMutation.isPending || code.length !== 6}
                >
                  {confirmMutation.isPending ? (
                    <span className='indicator-progress d-block'>
                      <FormattedMessage id='common.pleaseWait' defaultMessage='Por favor espera...' />
                      <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                    </span>
                  ) : (
                    <FormattedMessage id='account.mfa.confirm' defaultMessage='Confirmar y activar' />
                  )}
                </button>
                <button
                  type='button'
                  className='btn btn-color-gray-500 btn-active-light-primary px-6'
                  onClick={cancelSetup}
                  disabled={confirmMutation.isPending}
                >
                  <FormattedMessage id='common.cancel' defaultMessage='Cancelar' />
                </button>
              </div>
            </div>
          ) : (
            /* Estado DESACTIVADO: aviso + botón Activar */
            <div className='notice d-flex bg-light-primary rounded border-primary border border-dashed p-6'>
              <KTIcon iconName='shield-tick' className='fs-2tx text-primary me-4' />
              <div className='d-flex flex-stack flex-grow-1 flex-wrap flex-md-nowrap'>
                <div className='mb-3 mb-md-0 fw-bold'>
                  <h4 className='text-gray-800 fw-bolder'>
                    <FormattedMessage id='account.mfa.secureTitle' defaultMessage='Protege tu cuenta' />
                  </h4>
                  <div className='fs-6 text-gray-600 pe-7'>
                    <FormattedMessage
                      id='account.mfa.secureBody'
                      defaultMessage='La verificación en dos pasos añade una capa extra de seguridad. Al iniciar sesión deberás proporcionar un código de 6 dígitos generado por tu app autenticadora.'
                    />
                  </div>
                </div>
                <button
                  type='button'
                  className='btn btn-primary px-6 align-self-center text-nowrap'
                  onClick={startSetup}
                  disabled={setupMutation.isPending}
                >
                  {setupMutation.isPending ? (
                    <span className='indicator-progress d-block'>
                      <FormattedMessage id='common.pleaseWait' defaultMessage='Por favor espera...' />
                      <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                    </span>
                  ) : (
                    <FormattedMessage id='account.mfa.enable' defaultMessage='Activar' />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export {TwoFactorAuth}
