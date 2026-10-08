import {useIntl} from 'react-intl'
import {useQuery} from '@tanstack/react-query'
import {Link} from 'react-router-dom'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {api} from '@/lib/api/client'

export function SchoolMailRequestsNotification() {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const {isPlatform} = useAuthz()
  const {activeColegio} = useImpersonation()
  const enabled = isPlatform && !activeColegio
  const query = useQuery({queryKey: ['school-mail-requests', 'summary'],
    queryFn: () => api.get<{pendientes: number}>('/platform/correo-solicitudes/resumen'), enabled, refetchOnWindowFocus: true})
  if (!enabled) return null
  const count = query.isError ? undefined : query.data?.pendientes
  const label = count === undefined ? t('intake.ui.emailConnectionRequests') : t('schoolMail.pendingCount', {count})
  return <div className='app-navbar-item ms-1 ms-lg-3'>
    <Link to='/configuracion/correo-solicitudes' className='btn btn-icon btn-light position-relative' aria-label={label} title={query.isError ? t('intake.ui.couldNotLoadTheCountOpenRequests') : label} data-testid='school-mail-notification'>
      <i className='ki-solid ki-sms fs-2' aria-hidden='true' />
      {count !== undefined && count > 0 && <span className='position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger' aria-hidden='true'>{count > 99 ? '99+' : count}</span>}
    </Link>
  </div>
}
