// Capa de datos del feature Anos lectivos: funciones sobre el api client + hooks de
// TanStack Query. Rutas tenant bajo /api con sesión HttpOnly del mismo origen.

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

type PublicYear = Omit<AnoLectivo, 'id'>
type PublicPeriod = Omit<Periodo, 'id' | 'ano_lectivo_id'>
const withPublicYearSelector = (year: PublicYear): AnoLectivo => ({...year, id: year.url_token})
const withPublicPeriodSelector = (period: PublicPeriod): Periodo => ({
  ...period, id: period.url_token, ano_lectivo_id: period.ano_lectivo_token,
})

/** GET /anos-lectivos - lista los anos lectivos del colegio. */
export function useAnosLectivos() {
  return useQuery({
    queryKey: ANOS_LECTIVOS_KEY,
    queryFn: async () => {
      const response = await api.get<{data: PublicYear[]}>('/anos-lectivos?opaque=1')
      return {data: response.data.map(withPublicYearSelector)}
    },
  })
}

/** POST /anos-lectivos — crea un ano lectivo (estado inicial: planificado). */
export function useCreateAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateAnoLectivoInput) =>
      api.post<{data: PublicYear}>('/anos-lectivos?opaque=1', input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

export type DuplicarAnoInput = CreateAnoLectivoInput & {opciones: Record<string, boolean>}

export function useDuplicarAnoLectivo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: DuplicarAnoInput}) =>
      api.post<{data: PublicYear}>(`/anos-lectivos/${id}/duplicar?opaque=1`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY}),
  })
}

export function useCopiarConfiguracionAno() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, origenId, opciones}: {id: string; origenId: string; opciones: Record<string, boolean>}) =>
      api.post<{data: PublicYear}>(`/anos-lectivos/${id}/copiar-configuracion?opaque=1`, {
        origen_token: origenId, opciones,
      }),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY}),
  })
}

export interface EstadoCopiaAno {
  origen_token: string | null
  opciones: Record<string, boolean>
  reemplazable: boolean
}

export function useEstadoCopiaAno(id: string) {
  return useQuery({
    queryKey: ['anos-lectivos', id, 'estado-copia'],
    refetchOnMount: 'always',
    queryFn: () => api.get<{data: EstadoCopiaAno}>(`/anos-lectivos/${id}/estado-copia?opaque=1`),
  })
}

/** PUT /anos-lectivos/{id} — edita nombre, calendario, fechas y numero de periodos. */
export function useUpdateAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, input}: {id: string; input: UpdateAnoLectivoInput}) =>
      api.put<{data: PublicYear}>(`/anos-lectivos/${id}?opaque=1`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** DELETE /anos-lectivos/{id} — solo disponible para el superadministrador. */
export function useDeleteAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/anos-lectivos/${id}?opaque=1`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** POST /anos-lectivos/{id}/iniciar — planificado -> en_curso (RN-PA-001). */
export function useIniciarAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.post<{data: PublicYear}>(`/anos-lectivos/${id}/iniciar?opaque=1`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** POST /anos-lectivos/{id}/cerrar — en_curso -> cerrado (dispara promocion). */
export function useCerrarAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.post<{data: PublicYear}>(`/anos-lectivos/${id}/cerrar?opaque=1`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY})
    },
  })
}

/** POST /anos-lectivos/{id}/reabrir — cerrado -> en_curso, solo plataforma. */
export function useReabrirAnoLectivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.post<{data: PublicYear}>(`/anos-lectivos/${id}/reabrir?opaque=1`),
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
    queryFn: async () => {
      const response = await api.get<{data: PublicPeriod[]}>(`/anos-lectivos/${anoLectivoId}/periodos?opaque=1`)
      return {data: response.data.map(withPublicPeriodSelector)}
    },
  })
}

/** POST /anos-lectivos/{id}/periodos — crea un periodo del ano lectivo. */
export function useCreatePeriodo(anoLectivoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePeriodoInput) =>
      api.post<{data: PublicPeriod}>(`/anos-lectivos/${anoLectivoId}/periodos?opaque=1`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: periodosKey(anoLectivoId)})
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY, exact: true})
    },
  })
}

/** PUT /periodos/{id} — edita un periodo. */
export function useUpdatePeriodo(anoLectivoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, input}: {id: string; input: UpdatePeriodoInput}) =>
      api.put<{data: PublicPeriod}>(`/periodos/${id}?opaque=1`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: periodosKey(anoLectivoId)})
    },
  })
}

/** DELETE /periodos/{id} — elimina un periodo. */
export function useDeletePeriodo(anoLectivoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/periodos/${id}?opaque=1`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: periodosKey(anoLectivoId)})
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY, exact: true})
    },
  })
}

/** Cambios de estado reservados al rector y al superadministrador suplantando. */
function usePeriodoTransition(anoLectivoId: string, action: 'abrir' | 'cerrar' | 'reabrir') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.post<{data: PublicPeriod}>(`/periodos/${id}/${action}?opaque=1`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: periodosKey(anoLectivoId)})
      queryClient.invalidateQueries({queryKey: ANOS_LECTIVOS_KEY, exact: true})
    },
  })
}

export function useAbrirPeriodo(anoLectivoId: string) {
  return usePeriodoTransition(anoLectivoId, 'abrir')
}

export function useCerrarPeriodo(anoLectivoId: string) {
  return usePeriodoTransition(anoLectivoId, 'cerrar')
}

export function useReabrirPeriodo(anoLectivoId: string) {
  return usePeriodoTransition(anoLectivoId, 'reabrir')
}
