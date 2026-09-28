export interface AsignacionDocente {
  id: number
  ano_lectivo_id: number
  grupo_id: number
  materia_id: number
  docente_id: number
  materia: { id: number; nombre: string }
  grupo: { id: number; nombre: string; grado: { id: number; nombre: string } }
}

export interface Matricula {
  id: number
  estudiante_id: number
  grupo_id: number
  ano_lectivo_id: number
  estado: string
  estudiante: { id: number; name: string }
  grupo?: { id: number; nombre: string; grado: { id: number; nombre: string } }
}

export interface EvaluacionCatalogoResponse {
  can_manage: boolean
  can_configure: boolean
  can_view_reports: boolean
  anos: Array<{id: number; nombre: string; estado: string}>
  periodos: Array<{id: number; ano_lectivo_id: number; nombre: string; orden: number; estado: string}>
  asignaciones: AsignacionDocente[]
  matriculas: Matricula[]
  grupos: Array<{id: number; nombre: string; ano_lectivo_id: number; grado: {id: number; nombre: string}}>
  estudiantes: Array<{id: number; name: string}>
}

export interface ComponenteEvaluacion {
  id: number
  asignacion_id: number
  periodo_id: number
  nombre: string
  modo: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE'
  peso: string | number | null
  actividades?: ActividadEvaluacion[]
}

export interface ActividadEvaluacion {
  id: number
  componente_id: number
  nombre: string
  fecha: string
  peso: string | number | null
}

export interface Calificacion {
  id: number
  actividad_id: number
  matricula_id: number
  valor: string | null
  observacion: string | null
  version: number
}

export interface ResultadoEstudiante {
  matricula_id: number
  raw_value?: string
  exact_value?: string
  display_value?: string
  aprobado?: boolean
  estado: 'calculado' | 'pendiente'
  motivo?: string
}

export interface PlanillaResponse {
  editable: boolean
  configuracion: import('../siee/siee.types').SieeConfiguracion & {valor_min: string; valor_max: string; decimales: number; nota_minima: string}
  componentes: ComponenteEvaluacion[]
  matriculas: Matricula[]
  calificaciones: Calificacion[]
  resultados: ResultadoEstudiante[]
}

export interface NotaUpdate {
  actividad_id: number
  matricula_id: number
  valor: string | null
  version: number
  observacion?: string | null
  motivo: string
}
