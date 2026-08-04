// Tipos del feature Anos lectivos (tenant-scoped). Dominio en ESPANOL, alineado con
// documentacion-girgit (periodos-academicos.md, configuracion-por-colegio.md).
// Fechas en formato ISO 'YYYY-MM-DD' (el backend guarda UTC).

/** Tipo de calendario academico del colegio (RN-PA-002 / D-CALENDARIO). */
export type TipoCalendario = 'A' | 'B'

/**
 * Estado del ano lectivo (FSM: Planificado -> En curso -> Cerrado -> Archivado).
 * Se deja abierto (| string) por robustez ante estados nuevos del backend.
 */
export type AnoLectivoEstado = 'planificado' | 'en_curso' | 'cerrado' | 'archivado' | string

/** Un ano lectivo tal como lo devuelve el backend. */
export interface AnoLectivo {
  id: string
  /** Identificacion: "2026" (Calendario A) o "2025-2026" (Calendario B). */
  nombre: string
  tipo_calendario: TipoCalendario
  /** ISO 'YYYY-MM-DD'. */
  fecha_inicio: string
  /** ISO 'YYYY-MM-DD'. */
  fecha_fin: string
  /** Numero de periodos academicos (tipicamente 4). */
  num_periodos: number
  /** Si el colegio maneja un quinto periodo (RN-PA-008). */
  tiene_quinto_periodo: boolean
  estado: AnoLectivoEstado
  created_at: string | null
}

/** Body de POST /anos-lectivos (crear). */
export interface CreateAnoLectivoInput {
  nombre: string
  tipo_calendario: TipoCalendario
  fecha_inicio: string
  fecha_fin: string
  num_periodos: number
  tiene_quinto_periodo: boolean
}

/** Body de PUT /anos-lectivos/{id} (editar). */
export type UpdateAnoLectivoInput = CreateAnoLectivoInput

/** Estado de un periodo academico (FSM: Planificado -> Abierto -> Cerrado). */
export type PeriodoEstado = 'planificado' | 'abierto' | 'cerrado' | string

/** Un periodo academico de un ano lectivo. */
export interface Periodo {
  id: string
  ano_lectivo_id: string
  nombre: string
  /** Orden 1..N (RN-PA-003 periodos contiguos). */
  orden: number
  /** ISO 'YYYY-MM-DD'. */
  fecha_inicio: string
  /** ISO 'YYYY-MM-DD'. */
  fecha_fin: string
  /** Peso porcentual del periodo (opcional). */
  peso: number | null
  estado: PeriodoEstado
  created_at: string | null
}

/** Body de POST /anos-lectivos/{id}/periodos (crear periodo). */
export interface CreatePeriodoInput {
  nombre: string
  orden: number
  fecha_inicio: string
  fecha_fin: string
  peso: number | null
}

/** Body de PUT /periodos/{id} (editar periodo). */
export type UpdatePeriodoInput = CreatePeriodoInput
