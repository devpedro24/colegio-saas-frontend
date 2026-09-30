import {useMutation, useQuery, useInfiniteQuery, useQueryClient} from '@tanstack/react-query'
import {useEffect} from 'react'
import {api} from '@/lib/api/client'
import {useAcademicYear} from '../academic-year-context'
import type {AcademicListParams, AcademicPageMeta} from '../estructura/estructura.api'
import type {Area, CreateAreaInput, CreateMateriaInput, Materia} from './plan-estudios.types'
import {fromOpaqueAcademic, opaqueParams, toOpaqueAcademic} from '../shared/opaqueAcademic'

export const PLAN_AREAS_KEY = ['plan-estudios', 'areas'] as const
export const PLAN_MATERIAS_KEY = ['plan-estudios', 'materias'] as const

export function usePlanAreas(search = '', enabled = true, perPage = 20) {
  const {yearToken} = useAcademicYear()
  return useQuery({
    queryKey: [...PLAN_AREAS_KEY, yearToken, 'options', search, perPage], enabled: !!yearToken && enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ano_lectivo_id: yearToken, per_page: String(perPage)})
      if (search.trim()) params.set('search', search.trim())
      return fromOpaqueAcademic<Area[]>((await api.get<{data: unknown[]}>(`/plan-estudios/areas?${opaqueParams(params)}`)).data)
    },
  })
}

type Paged<T> = {data: T[]; meta: AcademicPageMeta}
function pageUrl(entity: 'areas' | 'materias', yearId: string, params: AcademicListParams) {
  const query = new URLSearchParams({ano_lectivo_id: yearId, page: String(params.page), per_page: String(params.perPage)})
  if (params.search?.trim()) query.set('search', params.search.trim())
  Object.entries(params.filters ?? {}).forEach(([name, value]) => {if (value) query.set(name, value)})
  return `/plan-estudios/${entity}?${opaqueParams(query)}`
}

/** Un desplegable de áreas completo, cargado solamente cuando el usuario lo abre. */
export function useAllPlanAreas(enabled: boolean) {
  const {yearToken} = useAcademicYear()
  const result = useInfiniteQuery({
    queryKey: [...PLAN_AREAS_KEY, yearToken, 'all-options'],
    enabled: !!yearToken && enabled,
    initialPageParam: 1,
    queryFn: ({pageParam}) => getPlanAreasPage(yearToken, {page: pageParam, perPage: 1000}),
    getNextPageParam: last => last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
  })
  useEffect(() => {
    if (enabled && result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage()
  }, [enabled, result.hasNextPage, result.isFetchingNextPage, result.fetchNextPage])
  return {...result, areas: result.data?.pages.flatMap(page => page.data) ?? []}
}
export async function getPlanAreasPage(yearId: string, params: AcademicListParams): Promise<Paged<Area>> {
  const result = await api.get<Paged<unknown>>(pageUrl('areas', yearId, params))
  return {...result, data: fromOpaqueAcademic<Area[]>(result.data)}
}
export async function getPlanMateriasPage(yearId: string, params: AcademicListParams): Promise<Paged<Materia>> {
  const result = await api.get<Paged<unknown>>(pageUrl('materias', yearId, params))
  return {...result, data: fromOpaqueAcademic<Materia[]>(result.data)}
}
function invalidate(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({queryKey: PLAN_AREAS_KEY}),
    client.invalidateQueries({queryKey: PLAN_MATERIAS_KEY}),
  ])
}

export function useCreatePlanArea() {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({mutationFn: (input: CreateAreaInput) => api.post('/plan-estudios/areas?opaque=1', toOpaqueAcademic({...input, ano_lectivo_id: yearToken})), onSuccess: () => invalidate(client)})
}
export function useUpdatePlanArea() {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({mutationFn: ({id, input}: {id: string; input: CreateAreaInput}) => api.put(`/plan-estudios/areas/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic({...input, ano_lectivo_id: yearToken})), onSuccess: () => invalidate(client)})
}
export function useDeletePlanArea() {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({mutationFn: (id: string) => api.delete(`/plan-estudios/areas/${encodeURIComponent(id)}?ano_lectivo_token=${yearToken}&opaque=1`), onSuccess: () => invalidate(client)})
}
export function useCreatePlanMateria() {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({mutationFn: (input: CreateMateriaInput) => api.post('/plan-estudios/materias?opaque=1', toOpaqueAcademic({...input, area_id: input.area_id || null, ano_lectivo_id: yearToken})), onSuccess: () => invalidate(client)})
}
export function useUpdatePlanMateria() {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({mutationFn: ({id, input}: {id: string; input: CreateMateriaInput}) => api.put(`/plan-estudios/materias/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic({...input, area_id: input.area_id || null, ano_lectivo_id: yearToken})), onSuccess: () => invalidate(client)})
}
export function useDeletePlanMateria() {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({mutationFn: (id: string) => api.delete(`/plan-estudios/materias/${encodeURIComponent(id)}?ano_lectivo_token=${yearToken}&opaque=1`), onSuccess: () => invalidate(client)})
}
