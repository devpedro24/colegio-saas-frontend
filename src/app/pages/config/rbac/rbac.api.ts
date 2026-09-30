// Capa de datos del feature RBAC: funciones sobre el api client + hooks de
// TanStack Query. Rutas bajo /api con sesión HttpOnly y middleware 'platform'.
// Esta es la administracion del catalogo CENTRAL (fuente de verdad del RBAC).

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {
  MatrixCellInput,
  PermissionInput,
  RbacCatalog,
  RbacPermission,
  RbacRole,
  RoleInput,
} from './rbac.types'

/** Clave de cache del catalogo RBAC. */
export const RBAC_KEY = ['rbac-catalog'] as const

/** GET /rbac/catalog — roles, permisos, matriz, niveles, features y categorias. */
export function useRbacCatalog() {
  return useQuery({
    queryKey: RBAC_KEY,
    queryFn: () => api.get<RbacCatalog>('/rbac/catalog'),
  })
}

function useInvalidateRbac() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({queryKey: RBAC_KEY})
}

// ---- Permisos ----

export function useCreatePermission() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: (input: PermissionInput) =>
      api.post<{permission: RbacPermission}>('/rbac/permissions', input),
    onSuccess: invalidate,
  })
}

export function useUpdatePermission() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: ({key, input}: {key: string; input: PermissionInput}) =>
      api.put<{permission: RbacPermission}>(`/rbac/permissions/${encodeURIComponent(key)}`, input),
    onSuccess: invalidate,
  })
}

export function useDeletePermission() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: (key: string) => api.delete<{deleted: boolean}>(`/rbac/permissions/${encodeURIComponent(key)}`),
    onSuccess: invalidate,
  })
}

// ---- Roles ----

export function useCreateRole() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: (input: RoleInput) => api.post<{role: RbacRole}>('/rbac/roles', input),
    onSuccess: invalidate,
  })
}

export function useUpdateRole() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: ({key, input}: {key: string; input: RoleInput}) =>
      api.put<{role: RbacRole}>(`/rbac/roles/${encodeURIComponent(key)}`, input),
    onSuccess: invalidate,
  })
}

export function useDeleteRole() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: (key: string) => api.delete<{deleted: boolean}>(`/rbac/roles/${encodeURIComponent(key)}`),
    onSuccess: invalidate,
  })
}

// ---- Matriz ----

/** PUT /rbac/matrix — fija (o borra, si type=denied) la celda (rol, permiso). */
export function useSetMatrixCell() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: (input: MatrixCellInput) => api.put('/rbac/matrix', input),
    onSuccess: invalidate,
  })
}
