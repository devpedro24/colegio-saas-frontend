// Capa de datos de suplantación (endpoints CENTRALES de plataforma).
//
// Estos endpoints viven bajo '/platform/*', así que el api client los trata SIEMPRE como
// rutas de plataforma: usan el token NORMAL del superadmin y NO envían header X-Tenant,
// incluso si ya hay un colegio activo (p.ej. al salir de una suplantación).

import {useMutation} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {ActiveColegio} from './impersonation.store'

/** Respuesta de POST /platform/impersonar. */
export interface EnterColegioResponse {
  data: {
    colegio: ActiveColegio
    /** Token de impersonación (texto plano) del usuario sombra en el tenant. */
    token: string
    /** Expiración ISO8601 UTC del token (now + 2h). */
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
 * POST /platform/impersonar  body { colegio_id }
 * El caller debe, en onSuccess, llamar setActive(res.data.colegio, res.data.token).
 */
export function useEnterColegio() {
  return useMutation({
    mutationFn: (colegioId: string) =>
      api.post<EnterColegioResponse>('/platform/impersonar', {colegio_id: colegioId}),
  })
}

/**
 * Salir de la suplantación (volver a Plataforma).
 * POST /platform/impersonar/salir  body { colegio_id }
 */
export function useExitColegio() {
  return useMutation({
    mutationFn: (colegioId: string) =>
      api.post<ExitColegioResponse>('/platform/impersonar/salir', {colegio_id: colegioId}),
  })
}
