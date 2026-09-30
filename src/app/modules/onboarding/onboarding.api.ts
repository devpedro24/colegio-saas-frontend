import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '../auth/core/Auth'

export interface Institution {
  nombre: string
  nit: string
  resolucion_men: string
  direccion: string
  telefono: string
  correo: string
}

export interface OnboardingStatus {
  required: boolean
  password_required: boolean
  institution_required: boolean
  institution: Institution | null
  logo_url: string | null
}

export const onboardingKey = (tenantId?: string | null) => ['onboarding', tenantId] as const

export function useOnboarding(tenantId?: string | null, enabled = true) {
  const {currentUser} = useAuth()
  return useQuery({
    queryKey: onboardingKey(tenantId),
    queryFn: () => api.get<OnboardingStatus>('/onboarding/status'),
    enabled: enabled && !!tenantId,
    initialData: () => currentUser?.tenant_channel === tenantId ? currentUser?.onboarding : undefined,
    initialDataUpdatedAt: currentUser?.onboardingFetchedAt,
    staleTime: 5 * 60_000,
  })
}
