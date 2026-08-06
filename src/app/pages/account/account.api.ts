// Capa de datos de AJUSTES DE CUENTA: perfil, email, contraseña, desactivación y
// vinculación de Google. Hooks de TanStack Query sobre el api client (rutas bajo /api/account).

import {useMutation} from '@tanstack/react-query'
import {api} from '@/lib/api/client'

/** Usuario devuelto por los endpoint de cuenta (subconjunto para refrescar UI). */
export interface AccountUser {
  id: number | string
  name: string
  email: string
  phone?: string | null
  google_email?: string | null
  tenant_id?: string | null
}

export interface AccountResponse {
  message: string
  user?: AccountUser
}

export interface GoogleConnectResponse {
  url: string
}

export interface UpdateProfileInput {
  name: string
  phone?: string
}

export interface ChangeEmailInput {
  email: string
  password: string
}

export interface ChangePasswordInput {
  current_password: string
  new_password: string
  new_password_confirmation: string
}

export interface DeactivateInput {
  password: string
}

/** PUT /account/profile — actualiza nombre y teléfono del perfil. */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api.put<AccountResponse>('/account/profile', input),
  })
}

/** POST /account/email — cambia el correo (autoriza con la contraseña). */
export function useChangeEmail() {
  return useMutation({
    mutationFn: (input: ChangeEmailInput) =>
      api.post<AccountResponse>('/account/email', input),
  })
}

/** POST /account/password — cambia la contraseña (verifica la actual). */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      api.post<AccountResponse>('/account/password', input),
  })
}

/** POST /account/deactivate — desactiva la cuenta (autoriza con la contraseña). */
export function useDeactivateAccount() {
  return useMutation({
    mutationFn: (input: DeactivateInput) =>
      api.post<AccountResponse>('/account/deactivate', input),
  })
}

/** POST /account/google/connect — devuelve la URL de autorización de Google. */
export function useGoogleConnect() {
  return useMutation({
    mutationFn: () => api.post<GoogleConnectResponse>('/account/google/connect'),
  })
}

/** DELETE /account/google — desvincula la cuenta de Google. */
export function useGoogleUnlink() {
  return useMutation({
    mutationFn: () => api.delete<AccountResponse>('/account/google'),
  })
}