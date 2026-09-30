// Capa de datos del feature Colegios: funciones sobre el api client + hooks de
// TanStack Query. Todas las rutas viven bajo /api con sesión HttpOnly y el
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

/** PUT /colegios/{slug} — edita nombre, razon social, NIT y plan. */
export function useUpdateColegio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({slug, input}: {slug: string; input: UpdateColegioInput}) =>
      api.put<{colegio: Colegio}>(`/colegios/${encodeURIComponent(slug)}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** PATCH /colegios/{slug}/status — habilita (active) o inhabilita (suspended). */
export function useUpdateColegioStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({slug, status}: {slug: string; status: 'active' | 'suspended'}) =>
      api.patch<{colegio: Colegio}>(`/colegios/${encodeURIComponent(slug)}/status`, {status}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** PATCH /colegios/{slug}/plan — cambia solo el plan (re-sincroniza el RBAC del tenant). */
export function useUpdateColegioPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({slug, plan}: {slug: string; plan: string}) =>
      api.patch<{colegio: Colegio}>(`/colegios/${encodeURIComponent(slug)}/plan`, {plan}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** POST /colegios/{slug}/reset-password — regenera la contrasena temporal del rector. */
export function useResetRectorPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      api.post<ResetPasswordResponse>(`/colegios/${encodeURIComponent(slug)}/reset-password`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: COLEGIOS_KEY})
    },
  })
}

/** GET /colegios/{slug}/rector-password — consulta la clave temporal VIGENTE. */
export function useRectorPassword(slug: string | null) {
  return useQuery({
    queryKey: [...COLEGIOS_KEY, slug, 'rector-password'],
    queryFn: () => api.get<RectorPasswordInfo>(`/colegios/${encodeURIComponent(slug!)}/rector-password`),
    enabled: slug !== null,
    refetchOnWindowFocus: false,
  })
}

/** Clave de cache de las sedes de un colegio (por slug del colegio). */
const sedesKey = (slug: string | null) => [...COLEGIOS_KEY, slug, 'sedes'] as const

/** GET /colegios/{slug}/sedes — sedes del colegio gestionadas por el superadmin. */
export function useColegioSedes(slug: string | null) {
  return useQuery({
    queryKey: sedesKey(slug),
    queryFn: () =>
      api.get<{data: ColegioSede[]}>(`/colegios/${encodeURIComponent(slug!)}/sedes`),
    enabled: slug !== null,
  })
}

/** POST /colegios/{slug}/sedes — crea una sede en el colegio. */
export function useCreateColegioSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({slug, input}: {slug: string; input: ColegioSedeInput}) =>
      api.post<{data: ColegioSede}>(`/colegios/${encodeURIComponent(slug)}/sedes`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({queryKey: sedesKey(variables.slug)})
    },
  })
}

/** PUT /colegios/{slug}/sedes/{sedeToken} — edita una sede del colegio. */
export function useUpdateColegioSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({slug, sedeToken, input}: {slug: string; sedeToken: string; input: ColegioSedeInput}) =>
      api.put<{data: ColegioSede}>(`/colegios/${encodeURIComponent(slug)}/sedes/${encodeURIComponent(sedeToken)}`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({queryKey: sedesKey(variables.slug)})
    },
  })
}

/** DELETE /colegios/{slug}/sedes/{sedeToken} — elimina (soft-delete) una sede. */
export function useDeleteColegioSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({slug, sedeToken}: {slug: string; sedeToken: string}) =>
      api.delete(`/colegios/${encodeURIComponent(slug)}/sedes/${encodeURIComponent(sedeToken)}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({queryKey: sedesKey(variables.slug)})
    },
  })
}
