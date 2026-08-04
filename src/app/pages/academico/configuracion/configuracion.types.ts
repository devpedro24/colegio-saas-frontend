// Tipos del feature Configuracion del colegio (tenant-scoped). Bloques de la
// configuracion inicial: datos institucionales, escala valorativa, metodo de
// aprobacion y modelo pedagogico (configuracion-por-colegio.md, bloques 1/4/5/6).

/** Niveles educativos de Colombia. */
export type NivelEducativo = 'preescolar' | 'primaria' | 'secundaria' | 'media'

// ------------------------------ Datos institucionales ------------------------------

/** Bloque 1: datos institucionales del colegio (aparecen en documentos). */
export interface DatosInstitucionales {
  nombre: string
  nit: string | null
  resolucion_men: string | null
  direccion: string | null
  telefono: string | null
  correo: string | null
}

/** Body de PUT /config/datos-institucionales. */
export type DatosInstitucionalesInput = DatosInstitucionales

// ------------------------------ Escala valorativa ------------------------------

/** Tipo de escala valorativa. */
export type TipoEscala = 'numerica' | 'imagenes'

/** Bloque 4: escala valorativa (puede variar por nivel — RN-CC-003). Por ano lectivo. */
export interface EscalaValorativa {
  id: string
  ano_lectivo_id: string
  nombre: string
  /** Nivel al que aplica; null = todos los niveles. */
  nivel_educativo: NivelEducativo | null
  tipo: TipoEscala
  valor_min: number | null
  valor_max: number | null
  decimales: number | null
  created_at: string | null
}

/** Body de POST/PUT /config/escalas. */
export interface EscalaValorativaInput {
  ano_lectivo_id: string
  nombre: string
  nivel_educativo: NivelEducativo | null
  tipo: TipoEscala
  valor_min: number | null
  valor_max: number | null
  decimales: number | null
}

// ------------------------------ Metodo de aprobacion ------------------------------

/** Como se calcula la nota final del periodo. */
export type CalculoNota = 'promedio_simple' | 'ponderado' | 'sumatoria'

/** Ambito de evaluacion de la aprobacion. */
export type AmbitoAprobacion = 'materia' | 'area' | 'promedio_general'

/** Bloque 5: metodo de aprobacion y nota minima. Por ano lectivo. */
export interface MetodoAprobacion {
  id: string
  ano_lectivo_id: string
  calculo_nota: CalculoNota
  nota_minima: number
  ambito: AmbitoAprobacion
  created_at: string | null
}

/** Body de POST/PUT /config/metodos-aprobacion. */
export interface MetodoAprobacionInput {
  ano_lectivo_id: string
  calculo_nota: CalculoNota
  nota_minima: number
  ambito: AmbitoAprobacion
}

// ------------------------------ Modelo pedagogico ------------------------------

/** Bloque 6: modelo pedagogico por nivel educativo. Por ano lectivo. */
export interface ModeloPedagogico {
  id: string
  ano_lectivo_id: string
  nivel_educativo: NivelEducativo
  /** Docente unico todo el dia (true) vs rotacion por materia (false). */
  docente_unico: boolean
  /** Estudiantes en salon fijo (true) vs desplazamiento a aulas (false). */
  salon_fijo: boolean
  tiene_director_grupo: boolean
  created_at: string | null
}

/** Body de POST/PUT /config/modelos-pedagogicos. */
export interface ModeloPedagogicoInput {
  ano_lectivo_id: string
  nivel_educativo: NivelEducativo
  docente_unico: boolean
  salon_fijo: boolean
  tiene_director_grupo: boolean
}
