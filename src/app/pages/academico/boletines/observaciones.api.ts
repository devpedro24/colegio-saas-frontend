import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

export type BulletinPolicy = {
  requiere_observacion_final: boolean
  version: number
}

export type BulletinObservation = {
  contexto: 'periodo' | 'final'
  periodo_token: string | null
  contenido: string
  estado: 'borrador' | 'aprobada'
  version: number
  actualizado_en: string
  aprobado_en: string | null
  autor: string | null
  aprobador: string | null
}

export type BulletinObservationCatalog = {
  matricula_token: string
  politica: BulletinPolicy
  puede_editar: boolean
  puede_aprobar: boolean
  periodos: Array<{periodo_token: string; nombre: string; observacion: BulletinObservation | null;
    puede_editar: boolean; motivo_bloqueo: string | null}>
  final: BulletinObservation | null
}

function useReportCacheScope() {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  return [currentUser?.tenant_channel ?? '', activeColegio?.slug ?? '', currentUser?.id ?? ''] as const
}

const policyKey = (scope: readonly string[]) => ['boletines', 'politica', ...scope] as const
const observationKey = (scope: readonly string[], token: string) => ['boletines', 'observaciones', ...scope, token] as const

export function useBulletinPolicy(enabled: boolean) {
  const scope = useReportCacheScope()
  return useQuery({queryKey: policyKey(scope), enabled, queryFn: () =>
    api.get<{data: BulletinPolicy}>('/boletines/politica').then(result => result.data)})
}

export function useSaveBulletinPolicy() {
  const client = useQueryClient()
  const scope = useReportCacheScope()
  return useMutation({mutationFn: (input: BulletinPolicy) =>
    api.put<{data: BulletinPolicy}>('/boletines/politica', input).then(result => result.data),
    onSuccess: () => {void client.invalidateQueries({queryKey: policyKey(scope)})},
  })
}

export function useBulletinObservations(matriculaToken: string, enabled: boolean) {
  const scope = useReportCacheScope()
  return useQuery({queryKey: observationKey(scope, matriculaToken), enabled: enabled && !!matriculaToken,
    queryFn: () => api.get<{data: BulletinObservationCatalog}>(`/boletines/observaciones/${encodeURIComponent(matriculaToken)}`)
      .then(result => result.data)})
}

export type ObservationTarget = {contexto: 'periodo' | 'final'; periodo_token?: string}

export type GroupObservations = {
  grupo_token: string; periodo_token: string; puede_editar: boolean; motivo_bloqueo: string | null
  matriculas: Array<{matricula_token: string; observacion: BulletinObservation | null}>
}

export function useGroupObservations(group: string, period: string, enabled: boolean) {
  const scope = useReportCacheScope()
  return useQuery({queryKey: ['boletines', 'observaciones-grupo', ...scope, group, period],
    enabled: enabled && !!group && !!period,
    queryFn: () => api.get<{data: GroupObservations}>(`/boletines/observaciones/grupo?${new URLSearchParams({grupo_token: group, periodo_token: period})}`)
      .then(result => result.data)})
}

export function useSaveBulletinObservation(matriculaToken: string) {
  const client = useQueryClient()
  const scope = useReportCacheScope()
  return useMutation({mutationFn: (input: ObservationTarget & {contenido: string; version: number}) =>
    api.put<{data: BulletinObservation}>(`/boletines/observaciones/${encodeURIComponent(matriculaToken)}`, input)
      .then(result => result.data),
    onSuccess: () => {
      void client.invalidateQueries({queryKey: observationKey(scope, matriculaToken)})
      void client.invalidateQueries({queryKey: ['boletines', 'observaciones-grupo', ...scope],
        predicate: query => !!(query.state.data as GroupObservations | undefined)?.matriculas.some(row => row.matricula_token === matriculaToken)})
    },
  })
}

export function useApproveBulletinObservation(matriculaToken: string) {
  const client = useQueryClient()
  const scope = useReportCacheScope()
  return useMutation({mutationFn: (input: ObservationTarget & {version: number}) =>
    api.post<{data: BulletinObservation}>(`/boletines/observaciones/${encodeURIComponent(matriculaToken)}/aprobar`, input)
      .then(result => result.data),
    onSuccess: () => {void client.invalidateQueries({queryKey: observationKey(scope, matriculaToken)})},
  })
}
