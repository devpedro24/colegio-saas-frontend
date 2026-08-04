// Tipos del panel del superadmin para el catalogo CENTRAL de RBAC (roles, permisos,
// matriz global), alineados con el backend real
// (App\Http\Controllers\Api\Platform\RbacController).

/** Clasificacion de una celda (rol x permiso). */
export type CellType = 'structural' | 'configurable' | 'denied'

/** Rol del catalogo central. */
export interface RbacRole {
  id: number
  key: string
  label: string
  is_system: boolean
  sort_order: number
}

/** Permiso del catalogo central. `feature_key` liga el permiso a una feature de plan (gating). */
export interface RbacPermission {
  id: number
  key: string
  module: string
  action: string
  feature_key: string | null
  description: string | null
  is_system: boolean
  sort_order: number
}

/**
 * Celda de la matriz global (rol x permiso). El backend SOLO persiste filas
 * structural/configurable; una celda ausente = denegado.
 */
export interface RbacMatrixCell {
  role_key: string
  permission_key: string
  type: 'structural' | 'configurable'
  level: string | null
  default_granted: boolean
}

/** Feature de plan (de PlanCatalog) para ligar permisos y hacer gating. label = clave i18n. */
export interface RbacFeature {
  key: string
  category: string
  label: string
  description: string
}

/** Categoria del catalogo de features. label = clave i18n. */
export interface RbacCategory {
  key: string
  label: string
}

/** Catalogo RBAC completo (GET /rbac/catalog). */
export interface RbacCatalog {
  roles: RbacRole[]
  permissions: RbacPermission[]
  matrix: RbacMatrixCell[]
  levels: string[]
  features: RbacFeature[]
  categories: RbacCategory[]
}

/** Estado clasificado de una celda (para pintar el badge y precargar el editor). */
export interface CellState {
  type: CellType
  level: string | null
  default_granted: boolean
}

/** Entrada del formulario de permiso. `key` solo al crear (inmutable despues). */
export interface PermissionInput {
  key?: string
  module: string
  action: string
  feature_key: string | null
  description: string | null
}

/** Entrada del formulario de rol. `key` solo al crear. */
export interface RoleInput {
  key?: string
  label: string
}

/** Payload de PUT /rbac/matrix (set de una celda). */
export interface MatrixCellInput {
  role_key: string
  permission_key: string
  type: CellType
  level?: string | null
  default_granted?: boolean
}
