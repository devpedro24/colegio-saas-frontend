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

export type ManualAreaSheet = {
  grupo: {url_token: string; nombre: string}
  periodo: {url_token: string; nombre: string; estado: string}
  areas: Array<{url_token: string; nombre: string}>
  area_token: string | null
  editable: boolean
  valor_min: string
  valor_max: string
  escala_visual: {tipo: 'imagenes' | 'numerica'; opciones: Array<{url_token: string; nombre: string}>}
  matriculas: Array<{url_token: string; nombre_lista: string; resultado: {
    estado: 'calculado' | 'pendiente'; display_value?: string; origen?: string; manual_version: number;
    valoracion?: {url_token: string; nombre: string}; motivo?: string
  }}>
  pagination: {page: number; per_page: number; total: number; last_page: number}
}

export const useManualAreaSheet = (group: string, period: string, area: string, page: number) => useQuery<ManualAreaSheet>({
  queryKey: ['evaluacion', 'areas', 'manual', group, period, area, page],
  enabled: !!group && !!period,
  queryFn: () => {
    const params = new URLSearchParams({opaque: '1', grupo_token: group, periodo_token: period, page: String(page)})
    if (area) params.set('area_token', area)
    return api.get<{data: ManualAreaSheet}>(`${EVAL_URL}/areas/manual?${params}`).then(response => response.data)
  },
})

export const useGuardarResultadoManualArea = () => {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({group, period, area, enrollment, valor, escalaOpcionToken, motivo, version}: {
      group: string; period: string; area: string; enrollment: string; valor: string | null;
      escalaOpcionToken?: string | null; motivo: string; version: number
    }) => api.put(`${EVAL_URL}/areas/manual/${encodeURIComponent(group)}/${encodeURIComponent(period)}/${encodeURIComponent(area)}/${encodeURIComponent(enrollment)}?opaque=1`,
      {valor, escala_opcion_token: escalaOpcionToken ?? null, motivo, version}),
    onSuccess: () => {
      cache.invalidateQueries({queryKey: ['evaluacion', 'areas', 'manual']})
      cache.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      cache.invalidateQueries({queryKey: ['boletines']})
    },
  })
}

export type ManualAnnualSheet = Omit<ManualAreaSheet, 'periodo' | 'areas' | 'area_token'> & {
  ambito: 'materia' | 'area'
  recursos: Array<{url_token: string; nombre: string}>
  recurso_token: string | null
}

export const useManualAnnualSheet = (group: string, scope: 'materia' | 'area', resource: string, page: number) => useQuery<ManualAnnualSheet>({
  queryKey: ['evaluacion', 'anuales', 'manual', group, scope, resource, page],
  enabled: !!group,
  queryFn: () => {
    const params = new URLSearchParams({opaque: '1', grupo_token: group, ambito: scope, page: String(page)})
    if (resource) params.set(`${scope}_token`, resource)
    return api.get<{data: ManualAnnualSheet}>(`${EVAL_URL}/anuales/manual?${params}`).then(response => response.data)
  },
})

export const useGuardarResultadoManualAnual = () => {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({group, enrollment, scope, resource, valor, escalaOpcionToken, motivo, version}: {
      group: string; enrollment: string; scope: 'materia' | 'area'; resource: string;
      valor: string | null; escalaOpcionToken?: string | null; motivo: string; version: number
    }) => api.put(`${EVAL_URL}/anuales/manual/${encodeURIComponent(group)}/${encodeURIComponent(enrollment)}?opaque=1`,
      {ambito: scope, [`${scope}_token`]: resource, valor, escala_opcion_token: escalaOpcionToken ?? null, motivo, version}),
    onSuccess: () => {
      cache.invalidateQueries({queryKey: ['evaluacion', 'anuales', 'manual']})
      cache.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      cache.invalidateQueries({queryKey: ['boletines']})
      cache.invalidateQueries({queryKey: ['anos-lectivos']})
    },
  })
}

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

export const useGuardarResultadoManual = (asignacionId: string, periodoId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({matriculaId, valor, escalaOpcionToken, motivo, version}: {matriculaId: string; valor: string | null; escalaOpcionToken?: string | null; motivo: string; version: number}) =>
      api.put(`${EVAL_URL}/planillas/${encodeURIComponent(asignacionId)}/${encodeURIComponent(periodoId)}/resultados-manuales/${encodeURIComponent(matriculaId)}?opaque=1`,
        {valor, escala_opcion_token: escalaOpcionToken ?? null, motivo, version}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'planillas', asignacionId, periodoId]})
      queryClient.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      queryClient.invalidateQueries({queryKey: ['boletines']})
    },
  })
}

export const useGuardarResultadoManualComponente = (asignacionId: string, periodoId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({componenteId, matriculaId, valor, escalaOpcionToken, motivo, version}: {
      componenteId: string; matriculaId: string; valor: string | null; escalaOpcionToken?: string | null; motivo: string; version: number
    }) => api.put(`${EVAL_URL}/planillas/${encodeURIComponent(asignacionId)}/${encodeURIComponent(periodoId)}/componentes/${encodeURIComponent(componenteId)}/resultados-manuales/${encodeURIComponent(matriculaId)}?opaque=1`,
      {valor, escala_opcion_token: escalaOpcionToken ?? null, motivo, version}),
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
  modo?: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE' | 'MANUAL'
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
