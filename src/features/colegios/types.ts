/** Clave del plan del colegio. Dinamica: la definen los planes de la BD. */
export type ColegioPlan = string;

/** Estado del colegio (maquina de estados del tenant). */
export type ColegioStatus =
  | 'provisioning'
  | 'configuring'
  | 'active'
  | 'suspended'
  | string;

export interface Colegio {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  nit: string | null;
  plan: ColegioPlan;
  status: ColegioStatus;
  subdomain: string;
  created_at: string | null;
}

export interface UpdateColegioInput {
  name: string;
  legal_name: string | null;
  nit: string | null;
  plan: string;
}

export interface CreateColegioInput {
  name: string;
  slug: string;
  rector_email: string;
  rector_name?: string;
  legal_name?: string | null;
  nit?: string | null;
  plan: string;
}

export interface CreateColegioResponse {
  colegio: Colegio;
  /** Contrasena temporal del rector; se muestra una sola vez. */
  rector_password: string;
}

export interface ResetPasswordResponse {
  colegio: Colegio;
  rector_email: string;
  /** Nueva contrasena temporal del rector; se muestra una sola vez. */
  rector_password: string;
}
