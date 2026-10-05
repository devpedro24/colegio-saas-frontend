import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {fromOpaqueAcademic, toOpaqueAcademic} from '../shared/opaqueAcademic'
import type {
  EvaluacionCatalogoResponse,
  PlanillaResponse,
  ComponenteEvaluacion,
  ActividadEvaluacion,
  NotaUpdate,
} from './evaluacion.types'

const EVAL_URL = '/evaluacion'

export type CatalogoFilters = {
  view?: 'planillas' | 'matriculas' | 'boletines'
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
      const params = new URLSearchParams({opaque: '1'})
      if (filters.view) params.set('vista', filters.view)
      if (filters.yearId) params.set('ano_lectivo_token', filters.yearId)
      if (filters.groupId) params.set('grupo_token', filters.groupId)
      if (filters.materiaId) params.set('materia_token', filters.materiaId)
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
      return api.get<{data: unknown}>(`${EVAL_URL}/catalogo?${query}`).then((res) => fromOpaqueAcademic<EvaluacionCatalogoResponse>(res.data))
    },
  })
}

export const useMatricular = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {grupo_id: string; estudiante_id: string}) =>
      api.post(`${EVAL_URL}/matriculas?opaque=1`, toOpaqueAcademic(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
    },
  })
}

export const usePlanilla = (asignacionId: string, periodoId: string) => {
  return useQuery<PlanillaResponse>({
    queryKey: ['evaluacion', 'planillas', asignacionId, periodoId],
    queryFn: () =>
      api
        .get<{data: unknown}>(`${EVAL_URL}/planillas/${encodeURIComponent(asignacionId)}/${encodeURIComponent(periodoId)}?opaque=1`)
        .then((res) => fromOpaqueAcademic<PlanillaResponse>(res.data)),
    enabled: !!asignacionId && !!periodoId,
  })
}

export const useGuardarNotas = (asignacionId: string, periodoId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notas: NotaUpdate[]) =>
      api.put(`${EVAL_URL}/planillas/${encodeURIComponent(asignacionId)}/${encodeURIComponent(periodoId)}?opaque=1`, {notas: notas.map(nota => toOpaqueAcademic(nota))}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'planillas', asignacionId, periodoId]})
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      queryClient.invalidateQueries({queryKey: ['boletines']})
    },
  })
}

export type ActividadPlanillaInput = {
  operacion: 'crear' | 'editar' | 'eliminar' | 'modo'
  componente_token: string | null; preinforme_token: string | null; actividad_token?: string
  version: number; nombre?: string; fecha?: string; peso?: string | null
  modo?: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE'
}
export function useActividadPlanilla(asignacion: string, periodo: string) {
  const cache = useQueryClient()
  return useMutation({mutationFn: (data: ActividadPlanillaInput) => api.put(`${EVAL_URL}/planillas/${asignacion}/${periodo}/actividades`, data),
    onSuccess: () => {
      cache.invalidateQueries({queryKey: ['evaluacion', 'planillas', asignacion, periodo]})
      cache.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      cache.invalidateQueries({queryKey: ['boletines']})
    }})
}

export const useGuardarComponente = (asignacionId: string, periodoId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ComponenteEvaluacion>) => {
      const {id, ...payload} = data
      if (id) {
        return api.put(`${EVAL_URL}/componentes/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic(payload))
      }
      return api.post(`${EVAL_URL}/componentes?opaque=1`, toOpaqueAcademic(payload))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'planillas', asignacionId, periodoId]})
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      queryClient.invalidateQueries({queryKey: ['boletines']})
    },
  })
}

export const useGuardarActividad = (asignacionId: string, periodoId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ActividadEvaluacion>) => {
      const {id, ...payload} = data
      if (id) {
        return api.put(`${EVAL_URL}/actividades/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic(payload))
      }
      return api.post(`${EVAL_URL}/actividades?opaque=1`, toOpaqueAcademic(payload))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'planillas', asignacionId, periodoId]})
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      queryClient.invalidateQueries({queryKey: ['boletines']})
    },
  })
}
