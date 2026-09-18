import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {Area, CreateAreaInput, CreateMateriaInput, Materia} from './plan-estudios.types'

export const PLAN_AREAS_KEY = ['plan-estudios', 'areas'] as const
export const PLAN_MATERIAS_KEY = ['plan-estudios', 'materias'] as const

type ApiArea = Omit<Area, 'id'> & {id: number}
type ApiMateria = Omit<Materia, 'id' | 'area_id' | 'nivel_id'> & {id: number; area_id: number; nivel_id: number | null}

const area = (item: ApiArea): Area => ({...item, id: String(item.id)})
const materia = (item: ApiMateria): Materia => ({
  ...item,
  id: String(item.id),
  area_id: String(item.area_id),
  nivel_id: item.nivel_id === null ? null : String(item.nivel_id),
})

export function usePlanAreas() {
  return useQuery({
    queryKey: PLAN_AREAS_KEY,
    queryFn: async () => (await api.get<{data: ApiArea[]}>('/plan-estudios/areas')).data.map(area),
  })
}

export function usePlanMaterias() {
  return useQuery({
    queryKey: PLAN_MATERIAS_KEY,
    queryFn: async () => (await api.get<{data: ApiMateria[]}>('/plan-estudios/materias')).data.map(materia),
  })
}

function invalidate(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({queryKey: PLAN_AREAS_KEY}),
    client.invalidateQueries({queryKey: PLAN_MATERIAS_KEY}),
  ])
}

export function useCreatePlanArea() {
  const client = useQueryClient()
  return useMutation({mutationFn: (input: CreateAreaInput) => api.post('/plan-estudios/areas', input), onSuccess: () => invalidate(client)})
}
export function useUpdatePlanArea() {
  const client = useQueryClient()
  return useMutation({mutationFn: ({id, input}: {id: string; input: CreateAreaInput}) => api.put(`/plan-estudios/areas/${id}`, input), onSuccess: () => invalidate(client)})
}
export function useDeletePlanArea() {
  const client = useQueryClient()
  return useMutation({mutationFn: (id: string) => api.delete(`/plan-estudios/areas/${id}`), onSuccess: () => invalidate(client)})
}
export function useCreatePlanMateria() {
  const client = useQueryClient()
  return useMutation({mutationFn: (input: CreateMateriaInput) => api.post('/plan-estudios/materias', input), onSuccess: () => invalidate(client)})
}
export function useUpdatePlanMateria() {
  const client = useQueryClient()
  return useMutation({mutationFn: ({id, input}: {id: string; input: CreateMateriaInput}) => api.put(`/plan-estudios/materias/${id}`, input), onSuccess: () => invalidate(client)})
}
export function useDeletePlanMateria() {
  const client = useQueryClient()
  return useMutation({mutationFn: (id: string) => api.delete(`/plan-estudios/materias/${id}`), onSuccess: () => invalidate(client)})
}
