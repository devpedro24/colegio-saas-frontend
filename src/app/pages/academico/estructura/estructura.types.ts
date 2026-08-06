// Tipos del feature Estructura organizacional (Bloque B / Fase 1).
// Jerarquía: Sede→Jornada→Nivel→Grado→Grupo + bloques horarios + espacios físicos.
// Dominio en ESPANOL, alineado con documentacion-girgit (jerarquia-organizacional.md).

// ---- Sede ----

export interface Sede {
  id: string
  hashed_id: string
  nombre: string
  direccion: string | null
  telefono: string | null
  responsable: string | null
  coordinador_name: string | null
  coordinador_email: string | null
  tenant_id: string | null
  tenant_slug: string | null
  tenant_domain: string | null
  tenant_status: string | null
  es_principal: boolean
  estado: string
  created_at: string | null
}

export interface CreateSedeInput {
  nombre: string
  slug?: string
  direccion?: string | null
  telefono?: string | null
  responsable?: string | null
  coordinador_email?: string | null
  coordinador_name?: string | null
  heredar?: boolean
  es_principal?: boolean
  estado?: string
}

export type UpdateSedeInput = CreateSedeInput

// ---- Jornada ----

export interface Jornada {
  id: string
  sede_id: string
  nombre: string
  hora_inicio: string | null
  hora_fin: string | null
  estado: string
  created_at: string | null
  sede?: {id: string; nombre: string}
  bloques?: BloqueHorario[]
}

export interface CreateJornadaInput {
  sede_id: string
  nombre: string
  hora_inicio?: string | null
  hora_fin?: string | null
  estado?: string
}

export type UpdateJornadaInput = Partial<CreateJornadaInput>

// ---- Nivel ----

export interface Nivel {
  id: string
  nivel_educativo: string
  nombre: string
  orden: number
  estado: string
  created_at: string | null
  grados_count?: number
}

export interface CreateNivelInput {
  nivel_educativo: string
  nombre: string
  orden?: number
  estado?: string
}

export type UpdateNivelInput = Partial<CreateNivelInput>

// ---- Grado ----

export interface Grado {
  id: string
  nivel_id: string
  nombre: string
  codigo: string | null
  orden: number
  estado: string
  created_at: string | null
  nivel?: {id: string; nombre: string; nivel_educativo: string}
}

export interface CreateGradoInput {
  nivel_id: string
  nombre: string
  codigo?: string | null
  orden?: number
  estado?: string
}

export type UpdateGradoInput = Partial<CreateGradoInput>

// ---- Grupo ----

export interface Grupo {
  id: string
  grado_id: string
  ano_lectivo_id: string
  jornada_id: string | null
  sede_id: string | null
  nombre: string
  cupo_maximo: number | null
  estado: string
  created_at: string | null
  grado?: {id: string; nombre: string; nivel?: {id: string; nombre: string}}
  ano_lectivo?: {id: string; nombre: string}
  jornada?: {id: string; nombre: string} | null
  sede?: {id: string; nombre: string} | null
}

export interface CreateGrupoInput {
  grado_id: string
  ano_lectivo_id: string
  jornada_id?: string | null
  sede_id?: string | null
  nombre: string
  cupo_maximo?: number | null
  estado?: string
}

export type UpdateGrupoInput = Partial<CreateGrupoInput>

// ---- Bloque horario ----

export interface BloqueHorario {
  id: string
  jornada_id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  es_descanso: boolean
  orden: number
  estado: string
  created_at: string | null
  jornada?: {id: string; nombre: string; sede_id: string}
}

export interface CreateBloqueHorarioInput {
  jornada_id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  es_descanso?: boolean
  orden?: number
  estado?: string
}

export type UpdateBloqueHorarioInput = Partial<CreateBloqueHorarioInput>

// ---- Espacio físico ----

export interface EspacioFisico {
  id: string
  sede_id: string | null
  nombre: string
  tipo: string
  capacidad: number | null
  ubicacion: string | null
  estado: string
  created_at: string | null
  sede?: {id: string; nombre: string} | null
}

export interface CreateEspacioFisicoInput {
  sede_id?: string | null
  nombre: string
  tipo: string
  capacidad?: number | null
  ubicacion?: string | null
  estado?: string
}

export type UpdateEspacioFisicoInput = Partial<CreateEspacioFisicoInput>
