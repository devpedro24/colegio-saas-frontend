import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {AcademicPageMeta} from '@/app/shared/components/AcademicPagination'
import type {SieeResponse, SieeConfiguracion, CurriculoItem} from './siee.types'

const BASE_URL = '/siee'

// El año en la ruta SIEE se identifica únicamente por su selector público.
// Fallar aquí evita enviar accidentalmente un ID interno si cambia el caller.
const sieeYearPath = (yearToken: string) => {
  if (!/^[A-Za-z0-9_-]{24}$/.test(yearToken)) throw new Error('Selector público SIEE inválido')
  return `${BASE_URL}/${encodeURIComponent(yearToken)}`
}

export const useSiee = (yearToken: string) => {
  return useQuery<SieeResponse>({
    queryKey: ['siee', yearToken],
    queryFn: () => api.get<{data: SieeResponse}>(sieeYearPath(yearToken)).then((res) => res.data),
    enabled: !!yearToken,
  })
}

export type CurriculoFilters = {
  page: number
  perPage: number
  search: string
  gradoToken: string
  materiaToken: string
  areaToken: string
}

export const useCurriculo = (yearToken: string, filters: CurriculoFilters) => useQuery({
  queryKey: ['siee', 'curriculo', yearToken, filters],
  queryFn: () => {
    const params = new URLSearchParams({page: String(filters.page), per_page: String(filters.perPage)})
    if (filters.search) params.set('search', filters.search)
    if (filters.gradoToken) params.set('grado_token', filters.gradoToken)
    if (filters.materiaToken) params.set('materia_token', filters.materiaToken)
    if (filters.areaToken) params.set('area_token', filters.areaToken)
    return api.get<{data: CurriculoItem[]; meta: AcademicPageMeta}>(
      `${sieeYearPath(yearToken)}/curriculo?${params}`
    )
  },
  enabled: !!yearToken,
})

export const useUpdateSiee = (yearToken: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SieeConfiguracion) =>
      api.put<{data: SieeResponse}>(sieeYearPath(yearToken), data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['siee', yearToken]})
      queryClient.invalidateQueries({queryKey: ['siee', 'curriculo', yearToken]})
    },
  })
}

export const useUpdateCurriculo = (yearToken: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      grado_token: string
      materia_token: string
      area_token: string | null
      peso_area: string | null
    }) =>
      api
        .put<{data: SieeResponse}>(`${sieeYearPath(yearToken)}/curriculo`, data)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['siee', yearToken]})
      queryClient.invalidateQueries({queryKey: ['siee', 'curriculo', yearToken]})
    },
  })
}
