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
 * Respuesta de GET /colegios/{id}/rector-password (NO invalida la clave):
 *  - 'temporal': el rector aun no la cambio -> rector_password es la vigente.
 *  - 'changed' : el rector ya cambio su clave -> la temporal ya no funciona.
 *  - 'none'    : no hay clave guardada/recuperable; hay que regenerar.
 */
export interface RectorPasswordInfo {
  status: 'temporal' | 'changed' | 'none'
  rector_email: string | null
  rector_password: string | null
}

/**
 * Sede de un colegio (vive en la BD del tenant; raiz de la jerarquia
 * Sede→Jornada→Nivel→Grado→Grupo). Endpoints del superadmin:
 * /colegios/{id}/sedes.
 */
export interface ColegioSede {
  id: number
  nombre: string
  direccion: string | null
  telefono: string | null
  responsable: string | null
  es_principal: boolean
  estado: 'activa' | 'inactiva'
  created_at: string | null
}

/** Body de POST/PUT /colegios/{id}/sedes. */
export interface ColegioSedeInput {
  nombre: string
  direccion?: string | null
  telefono?: string | null
  responsable?: string | null
  es_principal?: boolean
  estado?: 'activa' | 'inactiva'
}

// NOTA: los planes de los selects de Crear/Editar colegio se leen de la BD real
// via usePlanes() (fase Planes); ya no hay lista estatica aqui.
