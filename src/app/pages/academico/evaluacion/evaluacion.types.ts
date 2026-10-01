export interface AsignacionDocente {
  id: string
  ano_lectivo_id: string
  grupo_id: string
  materia_id: string
  docente_id: string
  url_token: string
  materia: { id: string; nombre: string }
  grupo: { id: string; nombre: string; grado: { id: string; nombre: string } }
}

export interface Matricula {
  id: string
  url_token: string
  estudiante_id: string
  grupo_id: string
  ano_lectivo_id: string
  estado: string
  estudiante: { id: string; name: string }
  nombre_lista?: string
  grupo?: { id: string; nombre: string; grado: { id: string; nombre: string } }
}

import type {AcademicPageMeta} from '@/app/shared/components/AcademicPagination'

export interface EvaluacionCatalogoResponse {
  can_manage_enrollments?: boolean
  can_manage: boolean
  can_configure: boolean
  can_view_reports: boolean
  anos: Array<{id: string; url_token: string; nombre: string; estado: string}>
  periodos: Array<{id: string; url_token: string; ano_lectivo_id: string; nombre: string; orden: number; estado: string}>
  asignaciones: AsignacionDocente[]
  matriculas: Matricula[]
  grupos: Array<{id: string; url_token: string; nombre: string; ano_lectivo_id: string; grado: {id: string; nombre: string}}>
  estudiantes: Array<{id: string; url_token: string; name: string}>
  estudiantes_disponibles: Array<{id: string; url_token: string; name: string}>
  materias: Array<{id: string; url_token: string; nombre: string}>
  selected_asignacion?: AsignacionDocente | null
  selected_matricula?: Matricula | null
  pagination: {asignaciones: AcademicPageMeta; matriculas: AcademicPageMeta}
}

export interface ComponenteEvaluacion {
  id: string
  asignacion_id: string
  periodo_id: string
  nombre: string
  modo: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE'
  peso: string | number | null
  actividades?: ActividadEvaluacion[]
}

export interface ActividadEvaluacion {
  id: string
  url_token: string
  version: number
  componente_id: string
  nombre: string
  fecha: string
  peso: string | number | null
}

export interface Calificacion {
  actividad_id: string
  matricula_id: string
  valor: string | null
  observacion: string | null
  version: number
}

export interface ResultadoEstudiante {
  matricula_id: string
  secciones?: Array<{componente_token: string; estado: 'calculado' | 'pendiente'; display_value?: string; provisional?: string | null; motivo?: string}>
  raw_value?: string
  exact_value?: string
  display_value?: string
  aprobado?: boolean
  estado: 'calculado' | 'pendiente'
  motivo?: string
  provisional?: string | null
}

export interface PlanillaResponse {
  editable: boolean
  requiere_motivo: boolean
  permisos: {crear: boolean; editar: boolean; eliminar: boolean; configurar: boolean}
  secciones: SeccionPlanilla[]
  usa_preinformes: boolean
  modo_preinformes: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE' | null
  estructura_anterior: boolean
  periodo: {nombre: string; fecha_inicio: string; fecha_fin: string; estado: string}
  configuracion: import('../siee/siee.types').SieeConfiguracion & {valor_min: string; valor_max: string; decimales: number; nota_minima: string}
  componentes: ComponenteEvaluacion[]
  matriculas: Matricula[]
  calificaciones: Calificacion[]
  resultados: ResultadoEstudiante[]
  pagination: {matriculas: AcademicPageMeta}
}

export interface SeccionPlanilla {
  preinforme_token: string | null
  componente_token: string | null
  nombre: string | null
  peso: string | null
  modo: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE'
  version: number
  fecha_inicio?: string | null
  fecha_fin?: string | null
  actividades: ActividadEvaluacion[]
}

export interface NotaUpdate {
  actividad_id: string
  matricula_id: string
  valor: string | null
  version: number
  observacion?: string | null
  motivo: string
}
