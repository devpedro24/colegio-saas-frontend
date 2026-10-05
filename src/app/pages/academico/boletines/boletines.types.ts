export interface BoletinPeriodoResult {
  periodo_id: string
  estado: string
  raw_value?: string
  exact_value?: string
  display_value?: string
  aprobado?: boolean
  motivo?: string
  origen?: 'recuperacion'
  resultado_original?: Omit<BoletinPeriodoResult, 'periodo_id'>
  nota_recuperacion?: string
  politica_recuperacion?: string
  valoracion?: import('../configuracion/configuracion.types').EscalaOpcion
}

export interface BoletinAsignatura {
  materia_id: string
  nombre: string
  area_id: string | null
  peso_area: number | null
  periodos: BoletinPeriodoResult[]
  anual: Omit<BoletinPeriodoResult, 'periodo_id'>
}

export interface BoletinArea {
  area_id: string
  nombre: string
  periodos: BoletinPeriodoResult[]
  anual: Omit<BoletinPeriodoResult, 'periodo_id'>
}

export interface BoletinData {
  tipo: string
  generado_en: string
  institucion: string
  estudiante: {id: string; name: string; nombre_lista?: string}
  grupo: string
  grado: string
  ano: string
  configuracion: import('../siee/siee.types').SieeConfiguracion
  escala_visual?: {tipo: 'imagenes'; nombre: string; opciones: import('../configuracion/configuracion.types').EscalaOpcion[]} | null
  periodos: Array<{id: string; nombre: string; peso: number | null; estado: string}>
  periodo_sumatorio: {orden: number; nombre: string; modo: string} | null
  asignaturas: BoletinAsignatura[]
  areas: BoletinArea[]
  advertencias: string[]
}
