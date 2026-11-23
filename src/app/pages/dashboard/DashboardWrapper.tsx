import {lazy, Suspense} from 'react'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

const PlatformDashboard = lazy(() => import('./PlatformDashboard'))
const SchoolDashboard = lazy(() => import('./SchoolDashboard'))

export function DashboardWrapper() {
  const {isPlatform} = useAuthz()
  const {activeColegio} = useImpersonation()

  return (
    <Suspense fallback={null}>
      {isPlatform && !activeColegio ? <PlatformDashboard /> : <SchoolDashboard />}
    </Suspense>
  )
}
