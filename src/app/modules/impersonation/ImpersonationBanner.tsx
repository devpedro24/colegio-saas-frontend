// Banner permanente de suplantación: visible SÓLO cuando hay un colegio activo.
// "Estás administrando <colegio> como superadministrador" + botón "Volver a Plataforma".
// El botón sale de la suplantación (endpoint de plataforma) y descarta el token temporal.

import {FormattedMessage, useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import {useImpersonation} from './impersonation.store'
import {useExitColegio} from './impersonation.api'

const ImpersonationBanner = () => {
  const intl = useIntl()
  const toast = useToast()
  const {activeColegio, clear} = useImpersonation()
  const exit = useExitColegio()

  if (!activeColegio) return null

  const handleExit = () => {
    const colegioId = activeColegio.id
    // Optimista: volvemos a Plataforma ya; el backend marca ended_at / revoca el token sombra.
    // Si falla la llamada, el token temporal igual queda descartado localmente (MVP).
    exit.mutate(colegioId, {
      onError: () =>
        toast.error(
          intl.formatMessage({
            id: 'impersonation.exit.error',
            defaultMessage: 'No se pudo cerrar la sesión de administración en el servidor.',
          }),
        ),
    })
    clear()
  }

  return (
    <div className='app-container container-fluid pt-4'>
      <div className='alert alert-warning d-flex align-items-center flex-wrap gap-3 mb-0 py-3 px-4'>
        <i className='ki-duotone ki-security-user fs-2 text-warning'>
          <span className='path1'></span>
          <span className='path2'></span>
        </i>
        <span className='fw-semibold text-gray-800 flex-grow-1'>
          <FormattedMessage
            id='impersonation.banner.text'
            defaultMessage='Estás administrando {colegio} como superadministrador'
            values={{colegio: <strong key='c'>{activeColegio.name}</strong>}}
          />
        </span>
        <button
          type='button'
          className='btn btn-sm btn-warning fw-bold'
          onClick={handleExit}
          disabled={exit.isPending}
        >
          <i className='ki-outline ki-exit-left fs-4 me-1'></i>
          {intl.formatMessage({
            id: 'impersonation.banner.exit',
            defaultMessage: 'Volver a Plataforma',
          })}
        </button>
      </div>
    </div>
  )
}

export {ImpersonationBanner}
