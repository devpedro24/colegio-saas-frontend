// Capa de datos del feature Planes: funciones sobre el api client + hooks de
// TanStack Query. Rutas bajo /api con sesión HttpOnly y middleware 'platform'.

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {Plan, PlanInput, PlanesResponse} from './planes.types'

/** Clave de cache del listado de planes. */
export const PLANES_KEY = ['plans'] as const

/** GET /plans — planes + catalogo cerrado de features/limites. */
export function usePlanes() {
  return useQuery({
    queryKey: PLANES_KEY,
    queryFn: () => api.get<PlanesResponse>('/plans'),
  })
}

/** POST /plans — crea un plan nuevo. */
export function useCreatePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PlanInput) => api.post<{plan: Plan}>('/plans', input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: PLANES_KEY})
    },
  })
}

/** PUT /plans/{key} — actualiza un plan por su clave pública. */
export function useUpdatePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({key, input}: {key: string; input: PlanInput}) =>
      api.put<{plan: Plan}>(`/plans/${encodeURIComponent(key)}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: PLANES_KEY})
    },
  })
}
