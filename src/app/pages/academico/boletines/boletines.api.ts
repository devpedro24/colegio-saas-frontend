import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {fromOpaqueAcademic} from '../shared/opaqueAcademic'
import type {BoletinData} from './boletines.types'

export const useBoletin = (matriculaId: string) => {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  return useQuery<BoletinData>({
    queryKey: ['boletines', currentUser?.tenant_channel ?? '', activeColegio?.slug ?? '', currentUser?.id ?? '', matriculaId],
    queryFn: () =>
      api
        .get<{data: unknown}>(`/evaluacion/boletines/${encodeURIComponent(matriculaId)}?opaque=1`)
        .then((res) => fromOpaqueAcademic<BoletinData>(res.data)),
    enabled: !!matriculaId,
  })
}
