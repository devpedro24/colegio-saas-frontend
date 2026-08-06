// Capa de datos de MFA (verificación en dos pasos / TOTP): hooks de TanStack Query
// sobre el api client. Las rutas viven bajo /api (proxied); el proxy enruta al backend
// del tenant o de plataforma según con qué usuario se haya iniciado sesión.

import {useMutation} from '@tanstack/react-query'
import {api} from '@/lib/api/client'

/** Respuesta de POST /mfa/setup: secreto TOTP + URI otpauth para la app autenticadora. */
export interface MfaSetupResponse {
  /** Secreto TOTP en base32, para teclear manualmente en Google Authenticator. */
  secret: string
  /** URI otpauth://totp/... (sirve para QR o para abrir directamente la app). */
  otpauth_url: string
}

/** Respuesta genérica de confirmar/desactivar MFA. */
export interface MfaStateResponse {
  /** Estado resultante de la verificación en dos pasos. */
  mfa_enabled: boolean
}

/**
 * POST /mfa/setup — inicia la activación: el backend genera y devuelve el secreto TOTP
 * y su `otpauth_url`. Aún NO queda activado hasta confirmar un código válido.
 */
export function useMfaSetup() {
  return useMutation({
    mutationFn: () => api.post<MfaSetupResponse>('/mfa/setup'),
  })
}

/**
 * POST /mfa/confirm — confirma la activación enviando el código de 6 dígitos
 * generado por la app autenticadora. Si es válido, MFA queda activo.
 */
export function useMfaConfirm() {
  return useMutation({
    mutationFn: (code: string) => api.post<MfaStateResponse>('/mfa/confirm', {code}),
  })
}

/**
 * POST /mfa/disable — desactiva la verificación en dos pasos. El backend exige un
 * código válido de la app autenticadora (o la contraseña) para poder desactivar.
 */
export function useMfaDisable() {
  return useMutation({
    mutationFn: (code: string) => api.post<MfaStateResponse>('/mfa/disable', {code}),
  })
}
