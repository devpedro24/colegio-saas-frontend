/** Tipos del panel del superadmin para el catalogo RBAC (roles, permisos, matriz). */

export type CellType = 'structural' | 'configurable' | 'denied';

export interface RbacAdminRole {
  id: number;
  key: string;
  label: string;
  is_system: boolean;
  sort_order: number;
}

export interface RbacAdminPermission {
  id: number;
  key: string;
  module: string;
  action: string;
  feature_key: string | null;
  description: string | null;
  is_system: boolean;
  sort_order: number;
}

/** Celda de la matriz global. Solo existen filas structural/configurable. */
export interface RbacAdminMatrixCell {
  role_key: string;
  permission_key: string;
  type: 'structural' | 'configurable';
  level: string | null;
  default_granted: boolean;
}

/** Feature de plan (de PlanCatalog) para ligar permisos y hacer gating. */
export interface RbacFeature {
  key: string;
  category: string;
  label: string;
  description: string;
}

export interface RbacCategory {
  key: string;
  label: string;
}

export interface RbacCatalog {
  roles: RbacAdminRole[];
  permissions: RbacAdminPermission[];
  matrix: RbacAdminMatrixCell[];
  levels: string[];
  features: RbacFeature[];
  categories: RbacCategory[];
}

export interface PermissionInput {
  key?: string; // solo al crear (inmutable despues)
  module: string;
  action: string;
  feature_key: string | null;
  description: string | null;
}

export interface RoleInput {
  key?: string; // solo al crear
  label: string;
}

export interface MatrixCellInput {
  role_key: string;
  permission_key: string;
  type: CellType;
  level?: string | null;
  default_granted?: boolean;
}
