import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {fromOpaqueAcademic, toOpaqueAcademic} from '../shared/opaqueAcademic'

export type Recuperacion = {
  id: string
  url_token: string
  matricula_id: string
  asignacion_id: string
  periodo_id: string | null
  estudiante: string
  materia: string
  grado: string
  grupo: string
  periodo: string | null
  tipo: 'nivelacion' | 'habilitacion'
  estado: 'pendiente' | 'aprobada' | 'no_aprobada' | 'anulada'
  politica: 'REPLACE' | 'AVERAGE' | 'MAX_PASSING_GRADE' | 'MANUAL'
  valor_original_exacto: string
  nota_recuperacion: string | null
  nota_manual: string | null
  valor_efectivo_exacto: string | null
  plan_mejoramiento: string | null
  motivo: string | null
  version: number
  can_record: boolean
}

export type Candidato = {
  asignacion_id: string
  periodo_id: string | null
  materia: string
  periodo: string | null
  valor_original: string
  tipo: 'nivelacion' | 'habilitacion'
  puede_abrir: boolean
}

export type RecuperacionesResponse = {
  data: Recuperacion[]
  candidatos: Candidato[]
  can_manage: boolean
  contexto: {estudiante: string; grado: string; grupo: string; ano_lectivo_id: string} | null
  meta: {current_page: number; last_page: number; total: number}
}

const base = '/evaluacion/recuperaciones'

export const useRecuperaciones = (matriculaId: string, page = 1) => useQuery<RecuperacionesResponse>({
  queryKey: ['evaluacion', 'recuperaciones', matriculaId, page],
  queryFn: () => api.get<RecuperacionesResponse>(`${base}?${new URLSearchParams({opaque: '1', matricula_token: matriculaId, page: String(page)})}`)
    .then(response => fromOpaqueAcademic<RecuperacionesResponse>(response)),
  enabled: !!matriculaId,
})

export const useCrearRecuperacion = (matriculaId: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (candidate: Candidato) => api.post(`${base}?opaque=1`, toOpaqueAcademic({
      matricula_id: matriculaId,
      asignacion_id: candidate.asignacion_id,
      periodo_id: candidate.periodo_id,
    })),
    onSuccess: () => {
      client.invalidateQueries({queryKey: ['evaluacion', 'recuperaciones', matriculaId]})
      client.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
    },
  })
}

export const useRegistrarRecuperacion = (matriculaId: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({id, grade, manual, reason, version}: {id: string; grade: string; manual: string; reason: string; version: number}) =>
      api.put(`${base}/${encodeURIComponent(id)}?opaque=1`, {
        nota_recuperacion: grade, nota_manual: manual || null, motivo: reason, version,
      }),
    onSuccess: () => {
      client.invalidateQueries({queryKey: ['evaluacion', 'recuperaciones', matriculaId]})
      client.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      client.invalidateQueries({queryKey: ['boletines', matriculaId]})
    },
  })
}

export const useAnularRecuperacion = (matriculaId: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({id, version, reason}: {id: string; version: number; reason: string}) =>
      api.post(`${base}/${encodeURIComponent(id)}/anular?opaque=1`, {version, motivo: reason}),
    onSuccess: () => {
      client.invalidateQueries({queryKey: ['evaluacion', 'recuperaciones', matriculaId]})
      client.invalidateQueries({queryKey: ['evaluacion', 'catalogo']})
      client.invalidateQueries({queryKey: ['boletines', matriculaId]})
    },
  })
}
