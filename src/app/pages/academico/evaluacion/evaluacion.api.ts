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

export type CatalogoFilters = {
  yearId?: string
  groupId?: string
  materiaId?: string
  enrollmentStatus?: string
  search?: string
  studentSearch?: string
  assignmentPage?: number
  assignmentPerPage?: number
  enrollmentPage?: number
  enrollmentPerPage?: number
  assignmentToken?: string
  enrollmentToken?: string
}

export const useCatalogoEvaluacion = (filters: CatalogoFilters = {}) => {
  return useQuery<EvaluacionCatalogoResponse>({
    queryKey: ['evaluacion', 'catalogo', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.yearId) params.set('ano_lectivo_id', filters.yearId)
      if (filters.groupId) params.set('grupo_id', filters.groupId)
      if (filters.materiaId) params.set('materia_id', filters.materiaId)
      if (filters.enrollmentStatus) params.set('estado', filters.enrollmentStatus)
      if (filters.search) params.set('search', filters.search)
      if (filters.studentSearch) params.set('student_search', filters.studentSearch)
      if (filters.assignmentPage) params.set('asignaciones_page', String(filters.assignmentPage))
      if (filters.assignmentPerPage) params.set('asignaciones_per_page', String(filters.assignmentPerPage))
      if (filters.enrollmentPage) params.set('matriculas_page', String(filters.enrollmentPage))
      if (filters.enrollmentPerPage) params.set('matriculas_per_page', String(filters.enrollmentPerPage))
      if (filters.assignmentToken) params.set('asignacion_token', filters.assignmentToken)
      if (filters.enrollmentToken) params.set('matricula_token', filters.enrollmentToken)
      const query = params.toString()
      return api.get<{data: EvaluacionCatalogoResponse}>(`${EVAL_URL}/catalogo${query ? `?${query}` : ''}`).then((res) => res.data)
    },
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

export const usePlanilla = (asignacionId: number, periodoId: number, page: number, perPage: number, search: string) => {
  return useQuery<PlanillaResponse>({
    queryKey: ['evaluacion', 'planillas', asignacionId, periodoId, {page, perPage, search}],
    queryFn: () =>
      api
        .get<{data: PlanillaResponse}>(`${EVAL_URL}/planillas/${asignacionId}/${periodoId}?${new URLSearchParams({page: String(page), per_page: String(perPage), ...(search ? {search} : {})})}`)
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
