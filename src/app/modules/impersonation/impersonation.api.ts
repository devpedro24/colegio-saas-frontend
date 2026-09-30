// Capa de datos de suplantación (endpoints CENTRALES de plataforma).
//
// Estos endpoints viven bajo '/platform/*', así que el api client los trata SIEMPRE como
// rutas de plataforma: el servidor usa la cookie HttpOnly de plataforma, incluso
// si existe una cookie de suplantación para los endpoints del colegio.

import {useMutation} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {ActiveColegio} from './impersonation.store'

/** Respuesta de POST /platform/impersonar. */
export interface EnterColegioResponse {
  data: {
    colegio: ActiveColegio
    /** Expiración ISO8601 UTC de la cookie de suplantación. */
    expires_at: string
  }
}

/** Respuesta de POST /platform/impersonar/salir. */
export interface ExitColegioResponse {
  data: {
    ended: boolean
  }
}

/**
 * Entrar a administrar un colegio (suplantación).
 * POST /platform/impersonar body { colegio_slug }.
 * La sesión temporal queda en cookie HttpOnly; el caller guarda solo el nombre.
 */
export function useEnterColegio() {
  return useMutation({
    mutationFn: (colegioSlug: string) =>
      api.post<EnterColegioResponse>('/platform/impersonar', {colegio_slug: colegioSlug}),
  })
}

/**
 * Salir de la suplantación (volver a Plataforma).
 * POST /platform/impersonar/salir. No se envía ID ni token desde JavaScript.
 */
export function useExitColegio() {
  return useMutation({
    mutationFn: () => api.post<ExitColegioResponse>('/platform/impersonar/salir'),
  })
}

/** Restablece la pestaña tras F5 usando la cookie HttpOnly, sin Web Storage. */
export function getImpersonationStatus() {
  return api.get<{data: {colegio: ActiveColegio | null}}>('/platform/impersonar/estado')
}
