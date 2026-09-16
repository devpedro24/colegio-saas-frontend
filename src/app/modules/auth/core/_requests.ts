import { api, ApiError, setToken } from '@/lib/api/client'
import { AuthModel, UserModel } from './_models'

/**
 * Autenticacion REAL contra el backend Laravel (Sanctum).
 *
 * Contrato (dominio central, middleware auth:sanctum):
 *   POST /login   { email, password, code? } -> { token, user }
 *   GET  /me                                 -> { user }
 *   POST /logout                             -> invalida el token del usuario
 *
 * Si el usuario tiene MFA activo, POST /login sin `code` responde 422 con
 * { mfa_required: true }; el frontend entonces pide el codigo y reintenta con `code`.
 *
 * El token se guarda con el api client (sessionStorage key 'colegio-saas.auth-token')
 * y se inyecta como `Authorization: Bearer <token>` en cada peticion.
 */

interface LoginResponse {
  token: string
  expires_at: string | null
  user: UserModel
}

/**
 * Inicia sesion: POST /login, guarda el token y devuelve el AuthModel de Metronic.
 * `code` es el codigo TOTP de 6 digitos; se envia solo cuando el backend lo exige (MFA).
 */
export async function login(
  email: string,
  password: string,
  code?: string,
): Promise<{ data: AuthModel }> {
  const {token, expires_at} = await api.post<LoginResponse>('/login', {
    email,
    password,
    ...(code ? { code } : {}),
  })
  setToken(token, expires_at)
  return {data: {api_token: token, expires_at}}
}

/**
 * ¿El error de login indica que se requiere MFA? El backend responde 422 con
 * `{ mfa_required: true }` (o, alternativamente, con message/errors 'mfa_required').
 */
export function isMfaRequiredError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) {
    return false
  }
  const data = error.data as { mfa_required?: boolean } | undefined
  return (
    data?.mfa_required === true ||
    error.message === 'mfa_required' ||
    Boolean(error.fieldError('mfa_required'))
  )
}

/**
 * Recupera el usuario autenticado: GET /me.
 * El token se toma del almacenamiento de sesión (vía el api client), por eso el
 * parametro `_token` se ignora; se mantiene para no cambiar la firma que espera
 * la plantilla (AuthInit / Login).
 */
export async function getUserByToken(_token: string): Promise<{ data: UserModel }> {
  void _token
  const { user } = await api.get<{ user: UserModel }>('/me')
  return { data: normalizeUser(user) }
}

/** Cierra sesion en el backend (invalida el token) y limpia el token local. */
export async function logout(): Promise<void> {
  try {
    await api.post('/logout')
  } finally {
    setToken(null)
  }
}

/** Mapea el usuario del backend a los campos de presentacion de la plantilla. */
function normalizeUser(user: UserModel): UserModel {
  const parts = (user.name ?? '').trim().split(/\s+/)
  const first = parts.shift() ?? ''
  const last = parts.join(' ')
  return {
    ...user,
    first_name: user.first_name ?? first,
    last_name: user.last_name ?? last,
    fullname: user.fullname ?? user.name,
  }
}
