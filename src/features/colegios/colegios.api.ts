import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  Colegio,
  CreateColegioInput,
  CreateColegioResponse,
  ResetPasswordResponse,
  UpdateColegioInput,
} from './types';

const COLEGIOS_KEY = ['platform', 'colegios'] as const;

/** Lista los colegios (tenants) de la plataforma. */
export function useColegios() {
  return useQuery({
    queryKey: COLEGIOS_KEY,
    queryFn: () => api.get<{ data: Colegio[] }>('/colegios').then((response) => response.data),
  });
}

/** Crea (provisiona) un colegio nuevo. */
export function useCreateColegio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateColegioInput) =>
      api.post<CreateColegioResponse>('/colegios', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLEGIOS_KEY });
    },
  });
}

/** Edita los datos de un colegio (nombre, razon social, NIT, plan). */
export function useUpdateColegio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateColegioInput }) =>
      api.put<{ colegio: Colegio }>(`/colegios/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLEGIOS_KEY });
    },
  });
}

/** Regenera la contrasena temporal del rector (se muestra una sola vez). */
export function useResetRectorPassword() {
  return useMutation({
    mutationFn: (id: string) => api.post<ResetPasswordResponse>(`/colegios/${id}/reset-password`),
  });
}

/** Habilita (active) o inhabilita (suspended) un colegio. */
export function useUpdateColegioStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      api.patch<{ colegio: Colegio }>(`/colegios/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLEGIOS_KEY });
    },
  });
}
