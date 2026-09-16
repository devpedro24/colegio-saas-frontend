// Tipos del feature Colegios (tenants), alineados con el backend real
// (App\Http\Controllers\Api\Platform\ColegioController). Fase 2: datos reales.

/** Clave del plan del colegio (planes de la BD central). Dinamica. */
export type ColegioPlan = string

/**
 * Estado del colegio (maquina de estados del tenant). El backend solo alterna
 * active/suspended desde el panel, pero un tenant puede estar provisioning/
 * configuring; se deja abierto (| string) para no romper con estados nuevos.
 */
export type ColegioStatus = 'active' | 'configuring' | 'provisioning' | 'suspended' | string

/**
 * Un colegio / institucion tal como lo devuelve el backend (metodo present()).
 * Ojo: el backend NO incluye datos del rector en este objeto (el rector se
 * gestiona aparte, via reset de contrasena).
 */
export interface Colegio {
  id: string
  name: string
  slug: string
  legal_name: string | null
  nit: string | null
  plan: ColegioPlan
  status: ColegioStatus
  subdomain: string
  created_at: string | null
}

/** Body de POST /colegios (store). */
export interface CreateColegioInput {
  name: string
  slug: string
  rector_email: string
  rector_name?: string
  legal_name?: string | null
  nit?: string | null
  plan: string
}

/** Respuesta de POST /colegios: el colegio + la contrasena temporal del rector. */
export interface CreateColegioResponse {
  colegio: Colegio
  /** Contrasena temporal del rector; se muestra una sola vez. */
  rector_password: string
}

/** Body de PUT /colegios/{id} (update). */
export interface UpdateColegioInput {
  name: string
  slug: string
  legal_name: string | null
  nit: string | null
  plan: string
}

/** Respuesta de POST /colegios/{id}/reset-password. */
export interface ResetPasswordResponse {
  colegio: Colegio
  rector_email: string
  /** Nueva contrasena temporal del rector; se muestra una sola vez. */
  rector_password: string
}

/**
 * Sede de un colegio (vive en la BD del tenant; raiz de la jerarquia
 * Sede→Jornada→Nivel→Grado→Grupo). Endpoints del superadmin:
 * /colegios/{id}/sedes.
 */
export interface ColegioSede {
  id: number
  hashed_id: string
  nombre: string
  direccion: string | null
  telefono: string | null
  coordinador_name: string | null
  coordinador_email: string | null
  tenant_id: string | null
  estado: 'activa' | 'inactiva'
  tenant_slug: string | null
  tenant_domain: string | null
  tenant_status: ColegioStatus | null
}

/** Body de POST /colegios/{id}/sedes: provisiona un tenant hijo. */
export interface CreateColegioSedeInput {
  nombre: string
  slug: string
  direccion: string
  coordinador_name?: string | null
  coordinador_email?: string | null
  heredar?: boolean
  estado?: 'activa' | 'inactiva'
}

/** Body de PUT /colegios/{id}/sedes/{sedeId}. */
export interface UpdateColegioSedeInput {
  nombre: string
  direccion?: string | null
  estado?: 'activa' | 'inactiva'
}

/** La clave del coordinador solo existe en esta respuesta de creacion. */
export interface CreateColegioSedeResponse {
  data: ColegioSede
  coordinador_password: string | null
}

// NOTA: los planes de los selects de Crear/Editar colegio se leen de la BD real
// via usePlanes() (fase Planes); ya no hay lista estatica aqui.
