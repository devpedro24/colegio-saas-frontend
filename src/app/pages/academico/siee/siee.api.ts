import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {SieeResponse, SieeConfiguracion} from './siee.types'

const BASE_URL = '/siee'

export const useSiee = (anoLectivoId: string) => {
  return useQuery<SieeResponse>({
    queryKey: ['siee', anoLectivoId],
    queryFn: () => api.get<{data: SieeResponse}>(`${BASE_URL}/${anoLectivoId}`).then((res) => res.data),
    enabled: !!anoLectivoId,
  })
}

export const useUpdateSiee = (anoLectivoId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SieeConfiguracion) =>
      api.put<{data: SieeResponse}>(`${BASE_URL}/${anoLectivoId}`, data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['siee', anoLectivoId]})
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
    },
  })
}
