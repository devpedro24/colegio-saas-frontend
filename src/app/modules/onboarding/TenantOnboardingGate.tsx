import {Navigate, useLocation} from 'react-router-dom'
import {PrivateRoutes} from '@/app/routing/PrivateRoutes'
import {useAuth} from '@/app/modules/auth'
import {useOnboarding} from './onboarding.api'
import {OnboardingPage} from './OnboardingPage'
import {useIntl} from 'react-intl'

export function TenantOnboardingGate() {
  const {currentUser} = useAuth()
  const intl = useIntl()
  const location = useLocation()
  const status = useOnboarding(currentUser?.tenant_channel)

  if (!currentUser) return null
  if (status.isPending) {
    return <div className='d-flex justify-content-center align-items-center min-vh-100'><span className='spinner-border text-primary' /></div>
  }
  if (status.isError || !status.data) {
    return <div className='container py-20'><div className='alert alert-danger'>{intl.formatMessage({id: 'onboarding.statusError'})} <button className='btn btn-sm btn-light-danger ms-3' onClick={() => status.refetch()}>{intl.formatMessage({id: 'onboarding.retry'})}</button></div></div>
  }
  if (status.data.required) {
    if (location.pathname !== '/bienvenida') return <Navigate to='/bienvenida' replace />
    return <OnboardingPage status={status.data} refresh={() => status.refetch()} />
  }
  if (location.pathname === '/bienvenida') return <Navigate to='/dashboard' replace />
  return <PrivateRoutes />
}
