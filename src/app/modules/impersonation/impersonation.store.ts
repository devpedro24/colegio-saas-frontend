// La sesión de suplantación vive en una cookie HttpOnly del servidor. Este store
// contiene únicamente el contexto de presentación de la pestaña; se reconstruye
// al iniciar mediante GET /platform/impersonar/estado.
import {useSyncExternalStore} from 'react'
import {queryClient} from '@/lib/api/query-client'

export interface ActiveColegio {
  name: string
  slug: string
  channel_token: string
}

export interface ImpersonationState {
  activeColegio: ActiveColegio | null
}

const EMPTY: ImpersonationState = {activeColegio: null}
let state: ImpersonationState = EMPTY
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getImpersonation(): ImpersonationState {
  return state
}

export function setActiveColegio(colegio: ActiveColegio): void {
  if (state.activeColegio?.slug === colegio.slug && state.activeColegio.channel_token === colegio.channel_token) return
  queryClient.clear()
  state = {activeColegio: colegio}
  listeners.forEach(listener => listener())
}

export function clearImpersonation(): void {
  if (!state.activeColegio) return
  queryClient.clear()
  state = EMPTY
  listeners.forEach(listener => listener())
}

export function useImpersonation() {
  const snapshot = useSyncExternalStore(subscribe, getImpersonation, getImpersonation)
  return {
    activeColegio: snapshot.activeColegio,
    setActive: setActiveColegio,
    clear: clearImpersonation,
  }
}
