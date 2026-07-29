// Tipos del panel del superadmin para el catalogo CENTRAL de RBAC (roles, permisos,
// matriz global). Espeja colegio-saas-frontend/src/features/rbac-admin/rbac-admin.types.ts,
// re-nombrados sin el prefijo "Admin" y adaptados a datos mock (solo diseno).

// Clasificacion de una celda (rol x permiso) de la matriz.
export type CellType = 'structural' | 'configurable' | 'denied'

// Niveles estructurales (otorgado y bloqueado). El valor de la celda estructural es
// uno de estos niveles; se muestra como etiqueta en la UI.
export type StructuralLevel = 'crud' | 'editar' | 'ver' | 'reportar' | 'aprobar' | 'c' | 'auto'

// Valor crudo de una celda en el mock:
//   - un StructuralLevel  -> estructural (otorgado + bloqueado)
//   - 'cfg'               -> configurable, por defecto OFF
//   - 'cfg_on'            -> configurable, por defecto ON
//   - ausente             -> denegado
export type CellValue = StructuralLevel | 'cfg' | 'cfg_on'

// Rol del catalogo central.
export interface RbacRole {
  id: number
  key: string
  label: string
  isSystem: boolean
  sortOrder: number
}

// Permiso del catalogo central. `cells` guarda el valor por rol (mapa rol -> CellValue);
// un rol ausente = denegado. `featureKey` liga el permiso a una feature de plan (gating).
export interface RbacPermission {
  id: number
  key: string
  module: string
  action: string
  featureKey: string | null
  isSystem: boolean
  sortOrder: number
  cells: Partial<Record<string, CellValue>>
}

// Feature de plan (de PlanCatalog) para ligar permisos y hacer gating con candado.
export interface RbacFeature {
  key: string
  label: string
}

// Estado clasificado de una celda concreta (para pintar el badge en la matriz).
export interface CellState {
  type: CellType
  level: StructuralLevel | null
  defaultGranted: boolean
}

// Entrada del formulario de permiso (crear/editar). `key` solo al crear (inmutable).
export interface PermissionInput {
  key?: string
  module: string
  action: string
  featureKey: string | null
  description: string | null
}

// Entrada del formulario de rol (crear/editar). `key` solo al crear.
export interface RoleInput {
  key?: string
  label: string
}
