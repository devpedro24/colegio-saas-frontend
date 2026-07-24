/** Usuario autenticado del colegio, tal como lo devuelve el backend. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  must_change_password: boolean;
  roles: string[];
  permissions: string[];
  /** true si es usuario de PLATAFORMA (superadministrador). */
  is_platform?: boolean;
  /** UUID del colegio (solo para usuarios de colegio); usado para el canal WS privado. */
  tenant_id?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
