import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  MatrixCellInput,
  PermissionInput,
  RbacAdminPermission,
  RbacAdminRole,
  RbacCatalog,
  RoleInput,
} from './rbac-admin.types';

const RBAC_KEY = ['platform', 'rbac'] as const;

/** Catalogo RBAC completo (roles, permisos, matriz, features de plan). */
export function useRbacCatalog() {
  return useQuery({
    queryKey: RBAC_KEY,
    queryFn: () => api.get<RbacCatalog>('/rbac/catalog'),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: RBAC_KEY });
}

// ---- Permisos ----

export function useCreatePermission() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: PermissionInput) => api.post<{ permission: RbacAdminPermission }>('/rbac/permissions', input),
    onSuccess: invalidate,
  });
}

export function useUpdatePermission() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: PermissionInput }) =>
      api.put<{ permission: RbacAdminPermission }>(`/rbac/permissions/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeletePermission() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ deleted: boolean }>(`/rbac/permissions/${id}`),
    onSuccess: invalidate,
  });
}

// ---- Roles ----

export function useCreateRole() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: RoleInput) => api.post<{ role: RbacAdminRole }>('/rbac/roles', input),
    onSuccess: invalidate,
  });
}

export function useUpdateRole() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RoleInput }) =>
      api.put<{ role: RbacAdminRole }>(`/rbac/roles/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ deleted: boolean }>(`/rbac/roles/${id}`),
    onSuccess: invalidate,
  });
}

// ---- Matriz ----

export function useSetMatrixCell() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: MatrixCellInput) => api.put('/rbac/matrix', input),
    onSuccess: invalidate,
  });
}
