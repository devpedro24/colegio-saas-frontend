// Capa de datos del feature Anos lectivos: funciones sobre el api client + hooks de
// TanStack Query. Rutas tenant bajo /api (proxied) con auth Bearer (usuario de colegio).

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {
  AnoLectivo,
  CreateAnoLectivoInput,
  CreatePeriodoInput,
  Periodo,
  UpdateAnoLectivoInput,
  UpdatePeriodoInput,
} from './anos-lectivos.types'

/** Clave de cache de la lista de anos lectivos. */
export const ANOS_LECTIVOS_KEY = ['anos-lectivos'] as const

/** Clave de cache de los periodos de un ano lectivo. */
export const periodosKey = (anoLectivoId: string) =>
  ['anos-lectivos', anoLectivoId, 'periodos'] as const

/** GET /anos-lectivos — lista los anos lectivos del colegio. */
export function useAnosLectivos() {
  return useQuery({
    queryKey: ANOS_LECTIVOS_KEY,
    queryFn: () => api.get<{data: AnoLectivo[]}>('/anos-lectivos').then((res) => res.data),
  })
}

/** POST /anos-lectivos — crea un ano lectivo (estado inicial: planificado). */
export function useCreateAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateAnoLectivoInput) =>
      api.post<{data: AnoLectivo}>('/anos-lectivos', input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** PUT /anos-lectivos/{id} — edita nombre, calendario, fechas y numero de periodos. */
export function useUpdateAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, input}: {id: string; input: UpdateAnoLectivoInput}) =>
      api.put<{data: AnoLectivo}>(`/anos-lectivos/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** POST /anos-lectivos/{id}/iniciar — planificado -> en_curso (RN-PA-001). */
export function useIniciarAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.post<{data: AnoLectivo}>(`/anos-lectivos/${id}/iniciar`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** POST /anos-lectivos/{id}/cerrar — en_curso -> cerrado (dispara promocion). */
export function useCerrarAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.post<{data: AnoLectivo}>(`/anos-lectivos/${id}/cerrar`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** GET /anos-lectivos/{id}/periodos — periodos de un ano lectivo. */
export function usePeriodos(anoLectivoId: string | null) {
  return useQuery({
    queryKey: periodosKey(anoLectivoId ?? '_'),
    enabled: !!anoLectivoId,
    queryFn: () =>
      api.get<{data: Periodo[]}>(`/anos-lectivos/${anoLectivoId}/periodos`).then((res) => res.data),
  })
}

/** POST /anos-lectivos/{id}/periodos — crea un periodo del ano lectivo. */
export function useCreatePeriodo(anoLectivoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePeriodoInput) =>
      api.post<{data: Periodo}>(`/anos-lectivos/${anoLectivoId}/periodos`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: periodosKey(anoLectivoId)})
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** PUT /periodos/{id} — edita un periodo. */
export function useUpdatePeriodo(anoLectivoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, input}: {id: string; input: UpdatePeriodoInput}) =>
      api.put<{data: Periodo}>(`/periodos/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: periodosKey(anoLectivoId)})
    },
  })
}

/** DELETE /periodos/{id} — elimina un periodo. */
export function useDeletePeriodo(anoLectivoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/periodos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: periodosKey(anoLectivoId)})
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}
