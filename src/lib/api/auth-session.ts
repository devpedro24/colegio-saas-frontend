export const AUTH_SESSION_INVALIDATED_EVENT = 'colegio-saas:auth-session-invalidated'

/** Notifica a la capa React que el servidor rechazó la sesión principal. */
export function notifyAuthSessionInvalidated(target?: EventTarget): void {
  const dispatcher = target ?? (typeof window !== 'undefined' ? window : null)
  dispatcher?.dispatchEvent(new Event(AUTH_SESSION_INVALIDATED_EVENT))
}
