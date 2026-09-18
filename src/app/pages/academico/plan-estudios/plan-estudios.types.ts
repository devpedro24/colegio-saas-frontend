// Tipos del feature Plan de estudios (Bloque C / Fase 1): áreas, materias,
// asignación docente y horarios. Dominio en ESPAÑOL, alineado con Bloques A/B.
// Datos ficticios e interactivos (aún sin backend); ver plan-estudios.store.ts.
// Niveles, grados, grupos, jornadas, bloques horarios, espacios físicos y
// docentes SÍ vienen del backend real (estructura.api.ts / usuarios.api.ts).

export type EstadoRegistro = 'activo' | 'inactivo'

export interface Area {
  id: string
  nombre: string
  descripcion: string | null
  estado: EstadoRegistro
}

export interface CreateAreaInput {
  nombre: string
  descripcion?: string | null
  estado?: EstadoRegistro
}

export interface Materia {
  id: string
  area_id: string
  nombre: string
  /** Horas semanales de intensidad. */
  intensidad_horaria: number
  /** FK a Nivel (estructura.api.ts). null = aplica a todos los niveles. */
  nivel_id: string | null
  estado: EstadoRegistro
}

export interface CreateMateriaInput {
  area_id: string
  nombre: string
  intensidad_horaria: number
  nivel_id?: string | null
  estado?: EstadoRegistro
}

export interface AsignacionDocente {
  id: string
  docente_id: string
  materia_id: string
  grupo_id: string
  ano_lectivo_id: string
}

export interface CreateAsignacionInput {
  docente_id: string
  materia_id: string
  grupo_id: string
  ano_lectivo_id: string
}

export const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const
export type DiaSemana = (typeof DIAS_SEMANA)[number]

export interface SesionHorario {
  id: string
  asignacion_id: string
  dia: DiaSemana
  bloque_horario_id: string
  espacio_fisico_id: string | null
}

export interface CreateSesionInput {
  asignacion_id: string
  dia: DiaSemana
  bloque_horario_id: string
  espacio_fisico_id?: string | null
}

/** Tipo de colisión detectada por el motor de conflictos (anticipo de UX; el backend re-validará). */
export type TipoConflicto = 'docente' | 'grupo' | 'espacio'
