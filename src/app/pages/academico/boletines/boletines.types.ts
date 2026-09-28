export interface BoletinPeriodoResult {
  periodo_id: number
  estado: string
  raw_value?: string
  exact_value?: string
  display_value?: string
  aprobado?: boolean
  motivo?: string
}

export interface BoletinAsignatura {
  materia_id: number
  nombre: string
  area_id: number | null
  peso_area: number | null
  periodos: BoletinPeriodoResult[]
  anual: Omit<BoletinPeriodoResult, 'periodo_id'>
}

export interface BoletinArea {
  area_id: number
  nombre: string
  periodos: BoletinPeriodoResult[]
  anual: Omit<BoletinPeriodoResult, 'periodo_id'>
}

export interface BoletinData {
  tipo: string
  generado_en: string
  institucion: string
  estudiante: {id: number; name: string}
  grupo: string
  grado: string
  ano: string
  configuracion: import('../siee/siee.types').SieeConfiguracion
  periodos: Array<{id: number; nombre: string; peso: number | null; estado: string}>
  asignaturas: BoletinAsignatura[]
  areas: BoletinArea[]
  advertencias: string[]
}
