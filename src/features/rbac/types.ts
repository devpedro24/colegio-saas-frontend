/** Tipo de celda en la matriz de permisos (las 3 capas). */
export type CellType = 'structural' | 'configurable' | 'denied';

export interface PermissionCell {
  type: CellType;
  /** Nivel de acceso si es estructural: crud | editar | ver | reportar | aprobar | c. */
  level: string | null;
  granted: boolean;
  /** Bloqueado porque el plan del colegio no incluye su feature (candado + upsell). */
  locked_by_plan?: boolean;
  /** Feature del plan requerida para desbloquear (si locked_by_plan). */
  required_feature?: string | null;
}

export interface MatrixPermission {
  key: string;
  action: string;
  /** roleKey -> celda. */
  cells: Record<string, PermissionCell>;
}

export interface MatrixModule {
  module: string;
  permissions: MatrixPermission[];
}

export interface MatrixRole {
  key: string;
  label: string;
}

export interface RbacMatrix {
  roles: MatrixRole[];
  modules: MatrixModule[];
}

export interface TogglePermissionInput {
  role: string;
  permission: string;
  granted: boolean;
}
