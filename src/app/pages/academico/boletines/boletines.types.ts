export interface BoletinPeriodoResult {
  periodo_id: string
  estado: string
  raw_value?: string
  exact_value?: string
  display_value?: string
  aprobado?: boolean
  motivo?: string
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
  estudiante: {id: string; name: string}
  grupo: string
  grado: string
  ano: string
  configuracion: import('../siee/siee.types').SieeConfiguracion
  periodos: Array<{id: string; nombre: string; peso: number | null; estado: string}>
  periodo_sumatorio: {orden: number; nombre: string; modo: string} | null
  asignaturas: BoletinAsignatura[]
  areas: BoletinArea[]
  advertencias: string[]
}
