// Tipos del feature Usuarios del colegio (permiso `usuarios.gestionar`).
// Los usuarios de la sede principal viven en la BD del colegio; los de una sede
// adicional viven en la BD del tenant hijo. Los selectores públicos son opacos.

export interface Usuario {
  id: string
  url_token: string
  name: string
  email: string
  phone: string | null
  role: string
  roles: string[]
  status: string
  must_change_password: boolean
  created_at: string | null
  sede_url_token: string | null
  sede_nombre: string | null
}

export interface UsuarioCreateInput {
  name: string
  email: string
  role: string
  sede_url_token?: string | null
  password?: string | null
}

export interface UsuarioUpdateInput {
  name?: string
  role?: string
  sede_url_token?: string | null
  status?: string | null
  password?: string | null
}

// Roles que admite el backend (PermissionMatrix::roleKeys()). La etiqueta se
// resuelve por i18n (academico.usuarios.rol.<key>).
export const ROLE_KEYS = [
  'rector',
  'coord_academico',
  'coord_convivencia',
  'coord_combinado',
  'secretaria',
  'docente',
  'director_grupo',
  'estudiante',
  'personal_apoyo',
] as const

// Estados posibles del usuario (User::STATUS_*).
export const STATUS_KEYS = ['active', 'inactive', 'suspended'] as const
