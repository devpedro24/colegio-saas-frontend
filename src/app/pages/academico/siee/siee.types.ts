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
  escala_token: string | null
  metodo_token: string | null
}

export interface CurriculoItem {
  grado_token: string
  materia_token: string
  area_token: string | null
  peso_area: string | null
  grado_nombre?: string
  materia_nombre?: string
  area_nombre?: string | null
}

export interface SieeGrade {
  url_token: string
  nombre: string
  nivel_token: string
  estado?: string
}

export interface SieeSubject {
  url_token: string
  nombre: string
  nivel_token: string | null
  area_token: string | null
  area?: {url_token: string; nombre: string} | null
  estado?: string
}

export interface SieeArea {
  url_token: string
  nombre: string
}

export interface SieeResponse {
  editable: boolean
  curriculo_editable: boolean
  configuracion: SieeConfiguracion
  escalas: Array<{url_token: string; nombre: string; tipo: string; valor_min: number; valor_max: number; decimales: number}>
  metodos: Array<{url_token: string; calculo_nota: string; nota_minima: number; ambito: string}>
  curriculo: CurriculoItem[]
  grados: SieeGrade[]
  materias: SieeSubject[]
  areas: SieeArea[]
}
