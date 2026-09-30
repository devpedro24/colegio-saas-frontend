import {useMutation, useQuery, useInfiniteQuery, useQueryClient} from '@tanstack/react-query'
import {useEffect} from 'react'
import {api} from '@/lib/api/client'
import {useAcademicYear} from '../academic-year-context'
import type {AcademicListParams, AcademicPageMeta} from '../estructura/estructura.api'
import type {Area, CreateAreaInput, CreateMateriaInput, Materia} from './plan-estudios.types'

export const PLAN_AREAS_KEY = ['plan-estudios', 'areas'] as const
export const PLAN_MATERIAS_KEY = ['plan-estudios', 'materias'] as const

type ApiArea = Omit<Area, 'id'> & {id: number}
type ApiMateria = Omit<Materia, 'id' | 'area_id' | 'nivel_id' | 'area'> & {id: number; area_id: number | null; nivel_id: number | null; area?: {id: number; nombre: string} | null}

const area = (item: ApiArea): Area => ({...item, id: String(item.id)})
const materia = (item: ApiMateria): Materia => ({
  ...item,
  id: String(item.id),
  area_id: item.area_id === null ? '' : String(item.area_id),
  nivel_id: item.nivel_id === null ? null : String(item.nivel_id),
  area: item.area ? {id: String(item.area.id), nombre: item.area.nombre} : null,
})

export function usePlanAreas(search = '', enabled = true, perPage = 20) {
  const {yearId} = useAcademicYear()
  return useQuery({
    queryKey: [...PLAN_AREAS_KEY, yearId, 'options', search, perPage], enabled: !!yearId && enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ano_lectivo_id: yearId, per_page: String(perPage)})
      if (search.trim()) params.set('search', search.trim())
      return (await api.get<{data: ApiArea[]}>(`/plan-estudios/areas?${params}`)).data.map(area)
    },
  })
}

type Paged<T> = {data: T[]; meta: AcademicPageMeta}
function pageUrl(entity: 'areas' | 'materias', yearId: string, params: AcademicListParams) {
  const query = new URLSearchParams({ano_lectivo_id: yearId, page: String(params.page), per_page: String(params.perPage)})
  if (params.search?.trim()) query.set('search', params.search.trim())
  Object.entries(params.filters ?? {}).forEach(([name, value]) => {if (value) query.set(name, value)})
  return `/plan-estudios/${entity}?${query}`
}

/** Un desplegable de áreas completo, cargado solamente cuando el usuario lo abre. */
export function useAllPlanAreas(enabled: boolean) {
  const {yearId} = useAcademicYear()
  const result = useInfiniteQuery({
    queryKey: [...PLAN_AREAS_KEY, yearId, 'all-options'],
    enabled: !!yearId && enabled,
    initialPageParam: 1,
    queryFn: ({pageParam}) => getPlanAreasPage(yearId, {page: pageParam, perPage: 1000}),
    getNextPageParam: last => last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
  })
  useEffect(() => {
    if (enabled && result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage()
  }, [enabled, result.hasNextPage, result.isFetchingNextPage, result.fetchNextPage])
  return {...result, areas: result.data?.pages.flatMap(page => page.data) ?? []}
}
export async function getPlanAreasPage(yearId: string, params: AcademicListParams): Promise<Paged<Area>> {
  const result = await api.get<Paged<ApiArea>>(pageUrl('areas', yearId, params))
  return {...result, data: result.data.map(area)}
}
export async function getPlanMateriasPage(yearId: string, params: AcademicListParams): Promise<Paged<Materia>> {
  const result = await api.get<Paged<ApiMateria>>(pageUrl('materias', yearId, params))
  return {...result, data: result.data.map(materia)}
}
function invalidate(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({queryKey: PLAN_AREAS_KEY}),
    client.invalidateQueries({queryKey: PLAN_MATERIAS_KEY}),
  ])
}

export function useCreatePlanArea() {
  const client = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({mutationFn: (input: CreateAreaInput) => api.post('/plan-estudios/areas', {...input, ano_lectivo_id: yearId}), onSuccess: () => invalidate(client)})
}
export function useUpdatePlanArea() {
  const client = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({mutationFn: ({id, input}: {id: string; input: CreateAreaInput}) => api.put(`/plan-estudios/areas/${id}`, {...input, ano_lectivo_id: yearId}), onSuccess: () => invalidate(client)})
}
export function useDeletePlanArea() {
  const client = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({mutationFn: (id: string) => api.delete(`/plan-estudios/areas/${id}?ano_lectivo_id=${yearId}`), onSuccess: () => invalidate(client)})
}
export function useCreatePlanMateria() {
  const client = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({mutationFn: (input: CreateMateriaInput) => api.post('/plan-estudios/materias', {...input, area_id: input.area_id || null, ano_lectivo_id: yearId}), onSuccess: () => invalidate(client)})
}
export function useUpdatePlanMateria() {
  const client = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({mutationFn: ({id, input}: {id: string; input: CreateMateriaInput}) => api.put(`/plan-estudios/materias/${id}`, {...input, area_id: input.area_id || null, ano_lectivo_id: yearId}), onSuccess: () => invalidate(client)})
}
export function useDeletePlanMateria() {
  const client = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({mutationFn: (id: string) => api.delete(`/plan-estudios/materias/${id}?ano_lectivo_id=${yearId}`), onSuccess: () => invalidate(client)})
}
