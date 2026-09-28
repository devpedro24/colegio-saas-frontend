import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {BoletinData} from './boletines.types'

export const useBoletin = (matriculaId: number) => {
  return useQuery<BoletinData>({
    queryKey: ['boletines', matriculaId],
    queryFn: () =>
      api
        .get<{data: BoletinData}>(`/evaluacion/boletines/${matriculaId}`)
        .then((res) => res.data),
    enabled: !!matriculaId,
  })
}
