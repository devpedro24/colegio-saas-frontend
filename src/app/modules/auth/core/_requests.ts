import {api, ApiError} from '@/lib/api/client'
import type {AuthModel, UserModel} from './_models'

/** La sesión vive en cookie HttpOnly. El navegador no recibe un Bearer en JSON. */
interface LoginResponse {
  user: UserModel
  csrf_token?: string
}

export async function login(email: string, password: string, code?: string): Promise<{data: AuthModel; user: UserModel}> {
  const {user} = await api.post<LoginResponse>('/login', {
    email, password, ...(code ? {code} : {}),
  })
  return {data: {authenticated: true}, user: normalizeUser(user)}
}

export function isMfaRequiredError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) return false
  const data = error.data as {mfa_required?: boolean} | undefined
  return data?.mfa_required === true || error.message === 'mfa_required' || Boolean(error.fieldError('mfa_required'))
}

/** F5 rehidrata la sesión desde /me sin leer cookies HttpOnly en JavaScript. */
export async function getCurrentUser(): Promise<{data: UserModel}> {
  const {user} = await api.get<{user: UserModel; csrf_token?: string}>('/me')
  return {data: normalizeUser(user)}
}

export async function logout(): Promise<void> {
  await api.post('/logout')
}

/** Registro permanece preparado para cuando el backend exponga la ruta. */
export async function register(
  email: string, first_name: string, last_name: string,
  password: string, password_confirmation: string,
): Promise<{data: AuthModel; user: UserModel}> {
  const {user} = await api.post<LoginResponse>('/register', {
    email, first_name, last_name, password, password_confirmation,
  })
  return {data: {authenticated: true}, user: normalizeUser(user)}
}

export async function requestPassword(email: string): Promise<{result: boolean}> {
  await api.post('/forgot-password', {email})
  return {result: true}
}

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
