import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'

export type AttendanceState = 'presente' | 'ausente' | 'tarde'
export interface AttendanceSummary {
  registradas: number; ausentes: number; tardes: number
  faltas_equivalentes: number; porcentaje: number; alerta: boolean
}
export interface AttendanceStudent {
  matricula_token: string; nombre: string; estado: AttendanceState | null; resumen: AttendanceSummary
}
export interface AttendancePolicy {
  max_faltas: number | null; max_porcentaje: string | number | null
  combinacion: 'cualquiera' | 'ambos'; ambito: 'periodo' | 'anual'
  tardes_por_falta: number; version: number; consecuencia: 'solo_alerta'
}
export interface AttendanceClass {
  sesion_token: string; hora_inicio: string; hora_fin: string
  registrada: boolean; version: number; historica: boolean; editable: boolean; estudiantes: AttendanceStudent[]
}
export interface AttendanceResponse {
  periodo?: {nombre: string; estado: string}
  clases?: AttendanceClass[]
}
export interface AttendanceCatalog {
  asignaciones: Array<{token: string; nombre: string; ano_lectivo_token: string}>
}

const key = (assignment: string, date: string) => ['asistencias', 'detalle', assignment, date] as const

export function useAttendanceCatalog() {
  return useQuery({
    queryKey: ['asistencias', 'catalogo'],
    staleTime: 5 * 60_000,
    queryFn: () => api.get<{data: AttendanceCatalog}>('/asistencias?opaque=1').then(response => response.data),
  })
}

export function useAttendance(assignment: string, date: string) {
  return useQuery({
    queryKey: key(assignment, date),
    enabled: !!assignment && !!date,
    queryFn: () => {
      const params = new URLSearchParams({opaque: '1', asignacion_token: assignment, fecha: date})
      return api.get<{data: AttendanceResponse}>(`/asistencias?${params}`).then(response => response.data)
    },
  })
}

export function useSaveAttendance(assignment: string, date: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {sesion_token: string; version: number; marcas: Array<{matricula_token: string; estado: AttendanceState}>}) =>
      api.put('/asistencias?opaque=1', {asignacion_token: assignment, fecha: date, ...input}),
    onSuccess: () => client.invalidateQueries({queryKey: key(assignment, date)}),
    onError: () => client.invalidateQueries({queryKey: key(assignment, date)}),
  })
}

export function useAttendancePolicy(year: string) {
  return useQuery({
    queryKey: ['asistencias', 'politica', year], enabled: !!year,
    queryFn: () => api.get<{data: AttendancePolicy}>(`/asistencias/politica/${year}?opaque=1`).then(response => response.data),
  })
}

export function useSaveAttendancePolicy(year: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<AttendancePolicy, 'consecuencia'>) =>
      api.put(`/asistencias/politica/${year}?opaque=1`, input),
    onSuccess: () => client.invalidateQueries({queryKey: ['asistencias']}),
    onError: () => client.invalidateQueries({queryKey: ['asistencias', 'politica', year]}),
  })
}
