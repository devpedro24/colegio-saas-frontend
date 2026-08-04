import {FC} from 'react'
import {FormattedMessage} from 'react-intl'
import {toAbsoluteUrl} from '../../../../../../_metronic/helpers'
import {useAuth} from '../../../../auth'
import {useToast} from '@/lib/ui/toast'
import {ApiError} from '@/lib/api/client'
import {useGoogleConnect, useGoogleUnlink} from '@/app/pages/account/account.api'

// Card de "Cuentas conectadas": SOLO Google (se eliminaron GitHub y Slack por
// innecesarios). La vinculación es REAL (OAuth2): al activar se navega a la
// URL de autorización de Google y al volver se refresca la sesión con el
// correo vinculado en la respuesta del backend.
const ConnectedAccounts: FC = () => {
  const toast = useToast()
  const {currentUser, setCurrentUser} = useAuth()

  const linked = Boolean(currentUser?.google_email)

  const connectMutation = useGoogleConnect()
  const unlinkMutation = useGoogleUnlink()

  const onConnect = () => {
    connectMutation.mutate(undefined, {
      onSuccess: (data) => {
        window.location.assign(data.url)
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : 'No se pudo vincular Google.')
      },
    })
  }

  const onUnlink = () => {
    unlinkMutation.mutate(undefined, {
      onSuccess: (data) => {
        const user = data.user
        if (user) {
          setCurrentUser((prev) => (prev ? {...prev, google_email: user.google_email ?? null} : prev))
        }
        toast.success(data.message ?? 'Cuenta de Google desvinculada.')
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : 'No se pudo desvincular Google.')
      },
    })
  }

  return (
    <div className='card mb-5 mb-xl-10'>
      <div
        className='card-header border-0 cursor-pointer'
        role='button'
        data-bs-toggle='collapse'
        data-bs-target='#kt_account_connected_accounts'
        aria-expanded='true'
        aria-controls='kt_account_connected_accounts'
      >
        <div className='card-title m-0'>
          <h3 className='fw-bold m-0'>
            <FormattedMessage id='account.connected.title' defaultMessage='Cuentas conectadas' />
          </h3>
        </div>
      </div>

      <div id='kt_account_connected_accounts' className='collapse show'>
        <div className='card-body border-top p-9'>
          <div className='py-2'>
            <div className='d-flex flex-stack'>
              <div className='d-flex'>
                <img
                  src={toAbsoluteUrl('media/svg/brand-logos/google-icon.svg')}
                  className='w-30px me-6'
                  alt=''
                />

                <div className='d-flex flex-column'>
                  <a href='#' className='fs-5 text-gray-900 text-hover-primary fw-bolder'>
                    Google
                  </a>
                  <div className='fs-6 fw-bold text-gray-500'>
                    {linked ? (
                      <FormattedMessage
                        id='account.connected.googleLinked'
                        defaultMessage='Vinculada con {email}'
                        values={{email: currentUser?.google_email ?? ''}}
                      />
                    ) : (
                      <FormattedMessage
                        id='account.connected.googleDesc'
                        defaultMessage='Vincula tu cuenta de Google para iniciar sesión con un solo clic'
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className='d-flex justify-content-end'>
                {linked ? (
                  <button
                    type='button'
                    className='btn btn-light btn-active-light-danger'
                    onClick={onUnlink}
                    disabled={unlinkMutation.isPending}
                  >
                    {unlinkMutation.isPending ? (
                      <span className='indicator-progress d-block'>
                        <FormattedMessage id='account.pleaseWait' defaultMessage='Por favor espera...' />
                        <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                      </span>
                    ) : (
                      <FormattedMessage id='account.unlink' defaultMessage='Desvincular' />
                    )}
                  </button>
                ) : (
                  <button
                    type='button'
                    className='btn btn-light btn-active-light-primary'
                    onClick={onConnect}
                    disabled={connectMutation.isPending}
                  >
                    {connectMutation.isPending ? (
                      <span className='indicator-progress d-block'>
                        <FormattedMessage id='account.pleaseWait' defaultMessage='Por favor espera...' />
                        <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                      </span>
                    ) : (
                      <FormattedMessage id='account.linkGoogle' defaultMessage='Vincular cuenta de Google' />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export {ConnectedAccounts}