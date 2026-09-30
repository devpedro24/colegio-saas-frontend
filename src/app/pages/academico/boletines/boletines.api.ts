import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {fromOpaqueAcademic} from '../shared/opaqueAcademic'
import type {BoletinData} from './boletines.types'

export const useBoletin = (matriculaId: string) => {
  return useQuery<BoletinData>({
    queryKey: ['boletines', matriculaId],
    queryFn: () =>
      api
        .get<{data: unknown}>(`/evaluacion/boletines/${encodeURIComponent(matriculaId)}?opaque=1`)
        .then((res) => fromOpaqueAcademic<BoletinData>(res.data)),
    enabled: !!matriculaId,
  })
}
