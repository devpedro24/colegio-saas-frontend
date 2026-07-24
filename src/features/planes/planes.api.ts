import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Plan, PlanesResponse, PlanInput } from './planes.types';

const PLANES_KEY = ['platform', 'planes'] as const;

/** Lista los planes + el catalogo cerrado de features/limites. */
export function usePlanes() {
  return useQuery({
    queryKey: PLANES_KEY,
    queryFn: () => api.get<PlanesResponse>('/plans'),
  });
}

/** Crea un plan nuevo. */
export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PlanInput) => api.post<{ plan: Plan }>('/plans', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANES_KEY });
    },
  });
}

/** Actualiza un plan existente. */
export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: PlanInput }) =>
      api.put<{ plan: Plan }>(`/plans/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANES_KEY });
    },
  });
}
