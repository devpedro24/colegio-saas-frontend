import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { RbacMatrix, TogglePermissionInput } from './types';

const RBAC_MATRIX_KEY = ['rbac', 'matrix'] as const;

/** Carga la matriz completa de roles x permisos del colegio. */
export function useRbacMatrix() {
  return useQuery({
    queryKey: RBAC_MATRIX_KEY,
    queryFn: () => api.get<RbacMatrix>('/rbac/roles'),
  });
}

/** Devuelve una copia de la matriz con la celda (rol x permiso) actualizada. */
function withUpdatedCell(
  matrix: RbacMatrix,
  role: string,
  permission: string,
  granted: boolean,
): RbacMatrix {
  return {
    ...matrix,
    modules: matrix.modules.map((module) => ({
      ...module,
      permissions: module.permissions.map((perm) =>
        perm.key === permission
          ? { ...perm, cells: { ...perm.cells, [role]: { ...perm.cells[role], granted } } }
          : perm,
      ),
    })),
  };
}

/**
 * Activa/desactiva un permiso configurable. Usa actualizacion optimista:
 * refleja el cambio al instante y lo revierte si el backend lo rechaza.
 */
export function useTogglePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ role, permission, granted }: TogglePermissionInput) =>
      api.put(`/rbac/roles/${role}/permissions/${permission}`, { granted }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: RBAC_MATRIX_KEY });
      const previous = queryClient.getQueryData<RbacMatrix>(RBAC_MATRIX_KEY);
      if (previous) {
        queryClient.setQueryData<RbacMatrix>(
          RBAC_MATRIX_KEY,
          withUpdatedCell(previous, input.role, input.permission, input.granted),
        );
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(RBAC_MATRIX_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: RBAC_MATRIX_KEY });
    },
  });
}
