export interface SieeConfiguracion {
  usar_areas: boolean
  modo_area: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE' | 'MANUAL' | 'DISABLED'
  modo_asignatura: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE' | 'MANUAL'
  modo_anual: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE' | 'MANUAL'
  redondeo: 'HALF_UP' | 'TRUNCATE'
  precision_calculo: number
  recuperacion: 'REPLACE' | 'AVERAGE' | 'MAX_PASSING_GRADE' | 'MANUAL'
  mostrar_final: boolean
  etiqueta_final: string
  escala_id: number | null
  metodo_id: number | null
}

export interface SieeResponse {
  editable: boolean
  configuracion: SieeConfiguracion
  escalas: Array<{id: number; nombre: string; tipo: string; valor_min: number; valor_max: number; decimales: number}>
  metodos: Array<{id: number; calculo_nota: string; nota_minima: number; ambito: string}>
  curriculo: Array<{ano_lectivo_id: number; grado_id: number; materia_id: number; area_id: number | null; peso_area: number | null}>
  grados: Array<{id: number; nombre: string}>
  materias: Array<{id: number; nombre: string}>
  areas: Array<{id: number; nombre: string}>
}
