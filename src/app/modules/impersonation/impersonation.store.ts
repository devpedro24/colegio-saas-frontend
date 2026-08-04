// Estado global de "colegio activo" (suplantación / cambio de contexto del superadmin).
//
// Cuando el superadmin entra a administrar un colegio, guardamos aquí { activeColegio, token }.
// Se persiste en localStorage con las claves EXACTAS del contrato:
//   - 'colegio-saas.active-colegio'      -> JSON { id, name, slug }
//   - 'colegio-saas.impersonation-token' -> token de impersonación (texto plano)
//
// Es un store "vanilla" (sin dependencias) con patrón subscribe + useSyncExternalStore, para
// que lo puedan leer TANTO componentes React (hook `useImpersonation`) COMO módulos NO-React
// (el api client `@/lib/api/client`, que necesita leer el estado de forma síncrona en cada
// petición). El snapshot en memoria (`state`) es una referencia estable entre mutaciones, tal
// como exige useSyncExternalStore.

import {useSyncExternalStore} from 'react'

export const ACTIVE_COLEGIO_KEY = 'colegio-saas.active-colegio'
export const IMPERSONATION_TOKEN_KEY = 'colegio-saas.impersonation-token'

/** Colegio que el superadmin está administrando (subconjunto mínimo del colegio real). */
export interface ActiveColegio {
  id: string
  name: string
  slug: string
}

export interface ImpersonationState {
  activeColegio: ActiveColegio | null
  token: string | null
}

const EMPTY: ImpersonationState = {activeColegio: null, token: null}

/** Lee el estado desde localStorage. Sólo es válido si EXISTEN colegio Y token a la vez. */
function readFromStorage(): ImpersonationState {
  try {
    const raw = localStorage.getItem(ACTIVE_COLEGIO_KEY)
    const token = localStorage.getItem(IMPERSONATION_TOKEN_KEY)
    if (!raw || !token) return EMPTY
    const activeColegio = JSON.parse(raw) as ActiveColegio
    if (!activeColegio || !activeColegio.id) return EMPTY
    return {activeColegio, token}
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
export function setActiveColegio(colegio: ActiveColegio, token: string): void {
  localStorage.setItem(ACTIVE_COLEGIO_KEY, JSON.stringify(colegio))
  localStorage.setItem(IMPERSONATION_TOKEN_KEY, token)
  state = {activeColegio: colegio, token}
  emit()
}

/** Volver a Plataforma: descarta el token temporal y el colegio activo. */
export function clearImpersonation(): void {
  localStorage.removeItem(ACTIVE_COLEGIO_KEY)
  localStorage.removeItem(IMPERSONATION_TOKEN_KEY)
  state = EMPTY
  emit()
}

/**
 * Devuelve { colegioId, token } SÓLO si hay una suplantación activa (colegio + token).
 * Lo consume el api client para decidir si envía el token de impersonación + header X-Tenant.
 */
export function getActiveImpersonation(): {colegioId: string; token: string} | null {
  const {activeColegio, token} = state
  if (activeColegio && token) return {colegioId: activeColegio.id, token}
  return null
}

// Sincronización entre pestañas: si otra pestaña cambia el colegio activo o el token,
// re-leemos y notificamos a los suscriptores de ESTA pestaña.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === ACTIVE_COLEGIO_KEY || e.key === IMPERSONATION_TOKEN_KEY) {
      state = readFromStorage()
      emit()
    }
  })
}

/** Hook reactivo: { activeColegio, token, setActive, clear }. */
export function useImpersonation() {
  const snapshot = useSyncExternalStore(subscribe, getImpersonation, getImpersonation)
  return {
    activeColegio: snapshot.activeColegio,
    token: snapshot.token,
    setActive: setActiveColegio,
    clear: clearImpersonation,
  }
}
