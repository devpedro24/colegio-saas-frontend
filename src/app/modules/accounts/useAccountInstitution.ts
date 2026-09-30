import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '../auth'
import {useImpersonation} from '../impersonation/impersonation.store'
import type {UserModel} from '../auth/core/_models'

export function useAccountInstitution() {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const context = useQuery({
    queryKey: ['institution-context', activeColegio?.id],
    queryFn: () => api.get<{data: UserModel['institution']}>('/institution-context'),
    enabled: !!currentUser?.is_platform && !!activeColegio,
  })
  return currentUser?.is_platform ? (activeColegio ? context.data?.data : null) : currentUser?.institution
}
