import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'

export type AttendanceState = 'sin_marcar' | 'presente' | 'ausente' | 'tarde' | 'justificada'
export interface AttendanceSummary {
  registradas: number; ausentes: number; tardes: number; justificadas: number
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
  anos: Array<{token: string; nombre: string; estado: string}>
  ano_lectivo_token: string | null
  asignaciones: Array<{token: string; nombre: string; ano_lectivo_token: string; ano_lectivo_nombre: string | null
    grupo_token: string; grupo_nombre: string; materia_token: string; materia_nombre: string}>
}
export interface AttendanceSheetColumn {
  sesion_token: string; fecha: string; hora_inicio: string; hora_fin: string
  registrada: boolean; version: number; historica: boolean; editable: boolean
  matriculas: string[]; marcas: Record<string, AttendanceState>
}
export interface AttendanceSheet {
  periodos: Array<{token: string; nombre: string; estado: string}>
  periodo: {token: string; nombre: string; estado: string}
  estudiantes: Array<{matricula_token: string; nombre: string; activa: boolean; resumen: AttendanceSummary}>
  columnas: AttendanceSheetColumn[]
}
export interface AttendanceAbsence {
  matricula_token: string; sesion_token: string; asignacion_token: string
  fecha: string; hora_inicio: string; hora_fin: string; materia: string; grupo: string
}
export interface AttendanceRequest {
  token: string; estudiante: string; asignatura: string; grupo: string
  origen: 'estudiante' | 'docente'
  estado: 'revision_docente' | 'pendiente_aprobacion' | 'aprobada' | 'rechazada'
  motivo: string; respuesta_docente: string | null; respuesta_aprobador: string | null
  created_at: string
  marcas: Array<{fecha: string; hora_inicio: string; hora_fin: string; estado_anterior: AttendanceState}>
}
export interface AttendancePageMeta {
  current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null
}

const key = (assignment: string, date: string) => ['asistencias', 'detalle', assignment, date] as const

export function useAttendanceCatalog(yearToken = '') {
  return useQuery({
    queryKey: ['asistencias', 'catalogo', yearToken],
    staleTime: 5 * 60_000,
    placeholderData: previous => previous,
    queryFn: () => api.get<{data: AttendanceCatalog}>(`/asistencias?opaque=1${yearToken ? `&ano_lectivo_token=${encodeURIComponent(yearToken)}` : ''}`)
      .then(response => response.data),
  })
}

export function useAttendanceSheet(assignment: string, period: string) {
  return useQuery({
    queryKey: ['asistencias', 'planilla', assignment, period], enabled: !!assignment,
    staleTime: 10_000,
    queryFn: () => {
      const params = new URLSearchParams({opaque: '1', asignacion_token: assignment})
      if (period) params.set('periodo_token', period)
      return api.get<{data: AttendanceSheet}>(`/asistencias/planilla?${params}`).then(response => response.data)
    },
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

export function useOwnAbsences(page: number) {
  return useQuery({
    queryKey: ['asistencias', 'mis-faltas', page],
    queryFn: () => api.get<{data: {faltas: AttendanceAbsence[]; pagination: AttendancePageMeta}}>(
      `/asistencias/mis-faltas?opaque=1&page=${page}&per_page=50`,
    ).then(response => response.data),
  })
}

export function useAttendanceRequests(scope: 'propias' | 'docente' | 'aprobacion', page: number, estado?: string) {
  return useQuery({
    queryKey: ['asistencias', 'solicitudes', scope, page, estado],
    queryFn: () => {
      const params = new URLSearchParams({opaque: '1', scope, page: String(page)})
      if (estado) params.set('estado', estado)
      return api.get<{data: {solicitudes: AttendanceRequest[]; pagination: AttendancePageMeta}}>(
        `/asistencias/solicitudes?${params}`,
      ).then(response => response.data)
    },
  })
}

export function useCreateAttendanceRequest() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {matricula_token: string; asignacion_token?: string;
      marcas: Array<{sesion_token: string; fecha: string}>; motivo: string}) =>
      api.post('/asistencias/solicitudes?opaque=1', input),
    onSuccess: () => client.invalidateQueries({queryKey: ['asistencias']}),
  })
}

export function useReviewAttendanceRequest() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {token: string; decision: 'remitir' | 'rechazar'; respuesta: string}) =>
      api.put(`/asistencias/solicitudes/${input.token}/revision-docente?opaque=1`,
        {decision: input.decision, respuesta: input.respuesta}),
    onSuccess: () => client.invalidateQueries({queryKey: ['asistencias']}),
  })
}

export function useResolveAttendanceRequest() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {token: string; decision: 'aprobar' | 'rechazar'; respuesta: string}) =>
      api.put(`/asistencias/solicitudes/${input.token}/resolucion?opaque=1`,
        {decision: input.decision, respuesta: input.respuesta}),
    onSuccess: () => client.invalidateQueries({queryKey: ['asistencias']}),
  })
}
