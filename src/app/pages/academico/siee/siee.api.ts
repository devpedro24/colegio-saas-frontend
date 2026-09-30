import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {AcademicPageMeta} from '@/app/shared/components/AcademicPagination'
import type {SieeResponse, SieeConfiguracion, CurriculoItem} from './siee.types'

const BASE_URL = '/siee'

export const useSiee = (anoLectivoId: string) => {
  return useQuery<SieeResponse>({
    queryKey: ['siee', anoLectivoId],
    queryFn: () => api.get<{data: SieeResponse}>(`${BASE_URL}/${anoLectivoId}`).then((res) => res.data),
    enabled: !!anoLectivoId,
  })
}

export type CurriculoFilters = {
  page: number
  perPage: number
  search: string
  gradoId: string
  materiaId: string
  areaId: string
}

export const useCurriculo = (anoLectivoId: string, filters: CurriculoFilters) => useQuery({
  queryKey: ['siee', 'curriculo', anoLectivoId, filters],
  queryFn: () => {
    const params = new URLSearchParams({page: String(filters.page), per_page: String(filters.perPage)})
    if (filters.search) params.set('search', filters.search)
    if (filters.gradoId) params.set('grado_id', filters.gradoId)
    if (filters.materiaId) params.set('materia_id', filters.materiaId)
    if (filters.areaId) params.set('area_id', filters.areaId)
    return api.get<{data: CurriculoItem[]; meta: AcademicPageMeta}>(
      `${BASE_URL}/${anoLectivoId}/curriculo?${params}`
    )
  },
  enabled: !!anoLectivoId,
})

export const useUpdateSiee = (anoLectivoId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SieeConfiguracion) =>
      api.put<{data: SieeResponse}>(`${BASE_URL}/${anoLectivoId}`, data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['siee', anoLectivoId]})
      queryClient.invalidateQueries({queryKey: ['siee', 'curriculo', anoLectivoId]})
    },
  })
}

export const useUpdateCurriculo = (anoLectivoId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      grado_id: number
      materia_id: number
      area_id: number | null
      peso_area: number | null
    }) =>
      api
        .put<{data: SieeResponse}>(`${BASE_URL}/${anoLectivoId}/curriculo`, data)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['siee', anoLectivoId]})
      queryClient.invalidateQueries({queryKey: ['siee', 'curriculo', anoLectivoId]})
    },
  })
}
