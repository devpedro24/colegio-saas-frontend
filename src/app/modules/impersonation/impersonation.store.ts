// Estado global de "colegio activo" (suplantación / cambio de contexto del superadmin).
//
// Cuando el superadmin entra a administrar un colegio, guardamos aquí { activeColegio, token }.
// Se persiste solo durante la sesión del navegador:
//   - 'colegio-saas.active-colegio'      -> JSON { id, name, slug }
//   - 'colegio-saas.impersonation-token' -> token de impersonación (texto plano)
//
// Es un store "vanilla" (sin dependencias) con patrón subscribe + useSyncExternalStore, para
// que lo puedan leer TANTO componentes React (hook `useImpersonation`) COMO módulos NO-React
// (el api client `@/lib/api/client`, que necesita leer el estado de forma síncrona en cada
// petición). El snapshot en memoria (`state`) es una referencia estable entre mutaciones, tal
// como exige useSyncExternalStore.

import {useSyncExternalStore} from 'react'
import {isFutureExpiration} from './impersonation-session'

export const ACTIVE_COLEGIO_KEY = 'colegio-saas.active-colegio'
export const IMPERSONATION_TOKEN_KEY = 'colegio-saas.impersonation-token'
export const IMPERSONATION_EXPIRES_KEY = 'colegio-saas.impersonation-expires-at'
export const IMPERSONATION_SESSION_KEY = 'colegio-saas.impersonation-session-id'

/** Colegio que el superadmin está administrando (subconjunto mínimo del colegio real). */
export interface ActiveColegio {
  id: string
  name: string
  slug: string
}

export interface ImpersonationState {
  activeColegio: ActiveColegio | null
  token: string | null
  expiresAt: string | null
  sessionId: string | null
}

const EMPTY: ImpersonationState = {
  activeColegio: null,
  token: null,
  expiresAt: null,
  sessionId: null,
}

/** Lee el estado de sesión. Colegio, token, expiración y sesión deben ser válidos. */
function readFromStorage(): ImpersonationState {
  try {
    const raw = sessionStorage.getItem(ACTIVE_COLEGIO_KEY)
    const token = sessionStorage.getItem(IMPERSONATION_TOKEN_KEY)
    const expiresAt = sessionStorage.getItem(IMPERSONATION_EXPIRES_KEY)
    const sessionId = sessionStorage.getItem(IMPERSONATION_SESSION_KEY)
    if (!raw || !token || !sessionId || !isFutureExpiration(expiresAt)) {
      return EMPTY
    }
    const activeColegio = JSON.parse(raw) as ActiveColegio
    if (!activeColegio || !activeColegio.id) return EMPTY
    return {activeColegio, token, expiresAt, sessionId}
  } catch {
    return EMPTY
  }
}

// Snapshot en memoria. Se REEMPLAZA (nueva referencia) sólo al mutar, nunca se muta en sitio.
let state: ImpersonationState = readFromStorage()

const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Lectura síncrona del estado actual (para el api client y utilidades no-React). */
export function getImpersonation(): ImpersonationState {
  return state
}

/** Entrar a administrar un colegio: persiste colegio + token y notifica. */
export function setActiveColegio(
  colegio: ActiveColegio,
  token: string,
  expiresAt: string,
  sessionId: string,
): void {
  sessionStorage.setItem(ACTIVE_COLEGIO_KEY, JSON.stringify(colegio))
  sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, token)
  sessionStorage.setItem(IMPERSONATION_EXPIRES_KEY, expiresAt)
  sessionStorage.setItem(IMPERSONATION_SESSION_KEY, sessionId)
  state = {activeColegio: colegio, token, expiresAt, sessionId}
  emit()
}

/** Volver a Plataforma: descarta el token temporal y el colegio activo. */
export function clearImpersonation(): void {
  sessionStorage.removeItem(ACTIVE_COLEGIO_KEY)
  sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY)
  sessionStorage.removeItem(IMPERSONATION_EXPIRES_KEY)
  sessionStorage.removeItem(IMPERSONATION_SESSION_KEY)
  localStorage.removeItem(ACTIVE_COLEGIO_KEY)
  localStorage.removeItem(IMPERSONATION_TOKEN_KEY)
  localStorage.removeItem(IMPERSONATION_EXPIRES_KEY)
  localStorage.removeItem(IMPERSONATION_SESSION_KEY)
  state = EMPTY
  emit()
}

/**
 * Devuelve { colegioId, token } SÓLO si hay una suplantación activa (colegio + token).
 * Lo consume el api client para decidir si envía el token de impersonación + header X-Tenant.
 */
export function getActiveImpersonation(): {
  colegioId: string
  token: string
  expiresAt: string
  sessionId: string
} | null {
  const {activeColegio, token, expiresAt, sessionId} = state
  if (activeColegio && token && expiresAt && sessionId && isFutureExpiration(expiresAt)) {
    return {colegioId: activeColegio.id, token, expiresAt, sessionId}
  }
  if (activeColegio || token) clearImpersonation()
  return null
}

// Elimina credenciales persistentes de versiones anteriores. Las sesiones de
// pestañas distintas quedan deliberadamente aisladas.
if (typeof window !== 'undefined') {
  localStorage.removeItem(ACTIVE_COLEGIO_KEY)
  localStorage.removeItem(IMPERSONATION_TOKEN_KEY)
  localStorage.removeItem(IMPERSONATION_EXPIRES_KEY)
  localStorage.removeItem(IMPERSONATION_SESSION_KEY)
}

/** Hook reactivo: { activeColegio, token, setActive, clear }. */
export function useImpersonation() {
  const snapshot = useSyncExternalStore(subscribe, getImpersonation, getImpersonation)
  return {
    activeColegio: snapshot.activeColegio,
    token: snapshot.token,
    expiresAt: snapshot.expiresAt,
    sessionId: snapshot.sessionId,
    setActive: setActiveColegio,
    clear: clearImpersonation,
  }
}
