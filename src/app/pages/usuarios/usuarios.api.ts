// Capa de datos del feature Usuarios del colegio: hooks de TanStack Query sobre
// el api client. Rutas tenant bajo /api/usuarios (permiso usuarios.gestionar).

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {Usuario, UsuarioCreateInput, UsuarioUpdateInput} from './usuarios.types'

export const USUARIOS_KEY = ['usuarios'] as const

export interface UsuarioCreateResult {
  data: Usuario
  password: string | null
}

/** GET /api/usuarios — usuarios del colegio + de cada sede (tenant hijo) activa. */
export function useUsuarios() {
  return useQuery({
    queryKey: USUARIOS_KEY,
    queryFn: () => api.get<{data: Usuario[]}>('/usuarios').then((res) => res.data),
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

/** PUT /api/usuarios/{id} — edita datos, rol o estado (en su BD). */
export function useUpdateUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: UsuarioUpdateInput}) =>
      api.put<{data: Usuario}>(`/usuarios/${id}`, input).then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({queryKey: USUARIOS_KEY}),
  })
}

/** DELETE /api/usuarios/{id} — borrado logico (en su BD). */
export function useDeleteUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, sedeId}: {id: string; sedeId?: string | null}) =>
      api.delete<{data: null}>(`/usuarios/${id}?sede_id=${sedeId ?? ''}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: USUARIOS_KEY}),
  })
}