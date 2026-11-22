import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '../auth/core/Auth'
import {useImpersonation} from '../impersonation/impersonation.store'

export function useSchoolBranding(enabled = true) {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  return useQuery({queryKey: ['school-branding', currentUser?.tenant_channel, activeColegio?.slug],
    queryFn: () => api.get<OnboardingStatus>('/school-branding'),
    enabled: enabled && !!currentUser && (!!activeColegio || !currentUser.is_platform),
  })
}

/** Keep the bootstrapped school branding; support resolves the active school separately. */
export function useInstitutionBranding() {
  const {currentUser} = useAuth()
  const school = useOnboarding(currentUser?.tenant_channel, !currentUser?.is_platform)
  const support = useSchoolBranding(!!currentUser?.is_platform)
  return currentUser?.is_platform ? support : school
}

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
