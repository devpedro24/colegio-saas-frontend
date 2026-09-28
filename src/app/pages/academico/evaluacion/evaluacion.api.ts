import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {
  EvaluacionCatalogoResponse,
  PlanillaResponse,
  ComponenteEvaluacion,
  ActividadEvaluacion,
  NotaUpdate,
} from './evaluacion.types'

const EVAL_URL = '/evaluacion'

export const useCatalogoEvaluacion = () => {
  return useQuery<EvaluacionCatalogoResponse>({
    queryKey: ['evaluacion', 'catalogo'],
    queryFn: () =>
      api.get<{data: EvaluacionCatalogoResponse}>(`${EVAL_URL}/catalogo`).then((res) => res.data),
  })
}

export const useMatricular = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {grupo_id: number; estudiante_id: number}) =>
      api.post(`${EVAL_URL}/matriculas`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
    },
  })
}

export const usePlanilla = (asignacionId: number, periodoId: number) => {
  return useQuery<PlanillaResponse>({
    queryKey: ['evaluacion', 'planillas', asignacionId, periodoId],
    queryFn: () =>
      api
        .get<{data: PlanillaResponse}>(`${EVAL_URL}/planillas/${asignacionId}/${periodoId}`)
        .then((res) => res.data),
    enabled: !!asignacionId && !!periodoId,
  })
}

export const useGuardarNotas = (asignacionId: number, periodoId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notas: NotaUpdate[]) =>
      api.put(`${EVAL_URL}/planillas/${asignacionId}/${periodoId}`, {notas}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'planillas', asignacionId, periodoId]})
    },
  })
}

export const useGuardarComponente = (asignacionId: number, periodoId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ComponenteEvaluacion>) => {
      if (data.id) {
        return api.put(`${EVAL_URL}/componentes/${data.id}`, data)
      }
      return api.post(`${EVAL_URL}/componentes`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'planillas', asignacionId, periodoId]})
    },
  })
}

export const useGuardarActividad = (asignacionId: number, periodoId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ActividadEvaluacion>) => {
      if (data.id) {
        return api.put(`${EVAL_URL}/actividades/${data.id}`, data)
      }
      return api.post(`${EVAL_URL}/actividades`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'planillas', asignacionId, periodoId]})
    },
  })
}
