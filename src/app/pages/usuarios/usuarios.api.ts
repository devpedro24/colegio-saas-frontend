// Capa de datos del feature Usuarios del colegio: hooks de TanStack Query sobre
// el api client. Rutas tenant bajo /api/usuarios (permiso usuarios.gestionar).

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {Usuario, UsuarioCreateInput, UsuarioUpdateInput} from './usuarios.types'

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export const USUARIOS_KEY = ['usuarios'] as const

export interface UsuarioCreateResult {
  data: Usuario
  password: string | null
}

/** GET /api/usuarios?page=&per_page= — usuarios del colegio + de cada sede (tenant hijo) activa. */
export function useUsuarios(page: number = 1, perPage: number = 5) {
  return useQuery({
    queryKey: [...USUARIOS_KEY, {page, perPage}],
    queryFn: () => api.get<{data: Usuario[]; meta: PaginationMeta}>(
      `/usuarios?page=${page}&per_page=${perPage}`
    ),
  })
}

/** POST /api/usuarios — crea un usuario en el colegio o en la sede indicada. */
export function useCreateUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UsuarioCreateInput) =>
      api.post<UsuarioCreateResult>('/usuarios', input).then((res) => ({...res, data: res.data})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: USUARIOS_KEY}),
  })
}

/** PUT /api/usuarios/{url_token} — edita datos, rol o estado (en su BD). */
export function useUpdateUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: UsuarioUpdateInput}) =>
      api.put<{data: Usuario}>(`/usuarios/${encodeURIComponent(id)}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: USUARIOS_KEY}),
  })
}

/** GET /api/usuarios/{url_token}/temporal-password — consulta la clave temporal. */
export function useUserTemporalPassword(id: string | null, sedeToken?: string | null) {
  return useQuery({
    queryKey: [...USUARIOS_KEY, id, 'temporal-password', sedeToken ?? ''],
    queryFn: () => api.get<{status: 'temporal' | 'changed' | 'none'; email: string; password: string | null}>(`/usuarios/${encodeURIComponent(id ?? '')}/temporal-password${sedeToken ? `?sede_url_token=${encodeURIComponent(sedeToken)}` : ''}`),
    enabled: id !== null,
    refetchOnWindowFocus: false,
  })
}

/** POST /api/usuarios/{url_token}/reset-password — regenera la clave temporal. */
export function useResetUserPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, sedeToken}: {id: string; sedeToken?: string | null}) =>
      api.post<{data: Usuario; password: string}>(`/usuarios/${encodeURIComponent(id)}/reset-password${sedeToken ? `?sede_url_token=${encodeURIComponent(sedeToken)}` : ''}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: USUARIOS_KEY}),
  })
}

/** DELETE /api/usuarios/{url_token} — borrado logico (en su BD). */
export function useDeleteUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, sedeToken}: {id: string; sedeToken?: string | null}) =>
      api.delete<{data: null}>(`/usuarios/${encodeURIComponent(id)}${sedeToken ? `?sede_url_token=${encodeURIComponent(sedeToken)}` : ''}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: USUARIOS_KEY}),
  })
}
