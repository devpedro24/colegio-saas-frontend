// Capa de datos del feature Colegios: funciones sobre el api client + hooks de
// TanStack Query. Todas las rutas viven bajo /api (proxied) con auth Bearer y el
// middleware 'platform' del backend.

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {
  Colegio,
  ColegioSede,
  ColegioSedeInput,
  CreateColegioInput,
  CreateColegioResponse,
  RectorPasswordInfo,
  ResetPasswordResponse,
  UpdateColegioInput,
} from './colegios.types'

/** Clave de cache de la lista de colegios. */
export const COLEGIOS_KEY = ['colegios'] as const

/** GET /colegios — lista todos los colegios (tenants) de la plataforma. */
export function useColegios() {
  return useQuery({
    queryKey: COLEGIOS_KEY,
    queryFn: () => api.get<{data: Colegio[]}>('/colegios'),
  })
}

/** POST /colegios — crea (provisiona) un colegio y devuelve la contrasena del rector. */
export function useCreateColegio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateColegioInput) =>
      api.post<CreateColegioResponse>('/colegios', input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** PUT /colegios/{id} — edita nombre, razon social, NIT y plan. */
export function useUpdateColegio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, input}: {id: string; input: UpdateColegioInput}) =>
      api.put<{colegio: Colegio}>(`/colegios/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** PATCH /colegios/{id}/status — habilita (active) o inhabilita (suspended). */
export function useUpdateColegioStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, status}: {id: string; status: 'active' | 'suspended'}) =>
      api.patch<{colegio: Colegio}>(`/colegios/${id}/status`, {status}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** PATCH /colegios/{id}/plan — cambia solo el plan (re-sincroniza el RBAC del tenant). */
export function useUpdateColegioPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, plan}: {id: string; plan: string}) =>
      api.patch<{colegio: Colegio}>(`/colegios/${id}/plan`, {plan}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** POST /colegios/{id}/reset-password — regenera la contrasena temporal del rector. */
export function useResetRectorPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ResetPasswordResponse>(`/colegios/${id}/reset-password`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** GET /colegios/{id}/rector-password — consulta la clave temporal VIGENTE. */
export function useRectorPassword(id: string | null) {
  return useQuery({
    queryKey: [...COLEGIOS_KEY, id, 'rector-password'],
    queryFn: () => api.get<RectorPasswordInfo>(`/colegios/${id}/rector-password`),
    enabled: id !== null,
    refetchOnWindowFocus: false,
  })
}

/** Clave de cache de las sedes de un colegio (por id del colegio). */
const sedesKey = (id: string | null) => [...COLEGIOS_KEY, id, 'sedes'] as const

/** GET /colegios/{id}/sedes — sedes del colegio gestionadas por el superadmin. */
export function useColegioSedes(id: string | null) {
  return useQuery({
    queryKey: sedesKey(id),
    queryFn: () =>
      api.get<{data: ColegioSede[]}>(`/colegios/${id}/sedes`),
    enabled: id !== null,
  })
}

/** POST /colegios/{id}/sedes — crea una sede en el colegio. */
export function useCreateColegioSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: ColegioSedeInput}) =>
      api.post<{data: ColegioSede}>(`/colegios/${id}/sedes`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({queryKey: sedesKey(variables.id)})
    },
  })
}

/** PUT /colegios/{id}/sedes/{sedeId} — edita una sede del colegio. */
export function useUpdateColegioSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, sedeId, input}: {id: string; sedeId: number; input: ColegioSedeInput}) =>
      api.put<{data: ColegioSede}>(`/colegios/${id}/sedes/${sedeId}`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({queryKey: sedesKey(variables.id)})
    },
  })
}

/** DELETE /colegios/{id}/sedes/{sedeId} — elimina (soft-delete) una sede. */
export function useDeleteColegioSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, sedeId}: {id: string; sedeId: number}) =>
      api.delete(`/colegios/${id}/sedes/${sedeId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({queryKey: sedesKey(variables.id)})
    },
  })
}
