import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'

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
  institution: (Institution & {id?: number}) | null
  logo_url: string | null
}

export const onboardingKey = (tenantId?: string | null) => ['onboarding', tenantId] as const

export function useOnboarding(tenantId?: string | null, enabled = true) {
  return useQuery({
    queryKey: onboardingKey(tenantId),
    queryFn: () => api.get<OnboardingStatus>('/onboarding/status'),
    enabled: enabled && !!tenantId,
    staleTime: 10_000,
    retry: 1,
  })
}
