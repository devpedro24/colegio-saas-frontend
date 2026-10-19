import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import type {EnrollmentSettings} from './ingreso.types'

export const enrollmentSettingsPath = '/ajustes-institucionales/matriculas'

export function useEnrollmentScope() {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  return activeColegio?.slug ?? currentUser?.tenant_channel ?? 'tenant'
}

export function useEnrollmentSettings() {
  const scope = useEnrollmentScope()
  return useQuery({queryKey: ['ingreso', scope, 'configuracion'],
    queryFn: () => api.get<{data: EnrollmentSettings}>('/ingreso/configuracion'), staleTime: 30_000})
}
