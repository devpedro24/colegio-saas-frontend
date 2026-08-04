// Helpers de autorizacion (gating) en el frontend. Leen el usuario autenticado
// del AuthContext (Auth.tsx) SIN mutarlo, y exponen utilidades para condicionar
// navegacion, rutas y UI segun rol / permiso / si es usuario de plataforma.

import {useMemo} from 'react'
import {useAuth} from './Auth'

/** Superficie de autorizacion derivada del usuario autenticado. */
export interface Authz {
  /** true si es usuario de PLATAFORMA (superadministrador). */
  isPlatform: boolean
  /** Roles (slugs) del usuario, ej: ['rector']. */
  roles: string[]
  /** Permisos efectivos del usuario. */
  permissions: string[]
  /** ¿El usuario tiene el rol indicado? */
  hasRole: (role: string) => boolean
  /** ¿El usuario tiene el permiso indicado? */
  hasPermission: (permission: string) => boolean
}

/**
 * Hook de gating: deriva roles/permisos/plataforma del `currentUser` del
 * AuthContext. No modifica el estado de autenticacion, solo lo lee.
 */
export function useAuthz(): Authz {
  const {currentUser} = useAuth()

  return useMemo<Authz>(() => {
    const roles = currentUser?.roles ?? []
    const permissions = currentUser?.permissions ?? []
    const isPlatform = currentUser?.is_platform === true

    return {
      isPlatform,
      roles,
      permissions,
      hasRole: (role: string) => roles.includes(role),
      hasPermission: (permission: string) => permissions.includes(permission),
    }
  }, [currentUser])
}
