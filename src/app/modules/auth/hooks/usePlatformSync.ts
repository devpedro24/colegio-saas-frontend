import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../core/Auth'
import { getEcho } from '@/lib/echo'
import { COLEGIOS_KEY } from '@/app/pages/config/colegios/colegios.api'
import { PLANES_KEY } from '@/app/pages/config/planes/planes.api'
import { RBAC_KEY } from '@/app/pages/config/rbac/rbac.api'

const RESOURCE_KEYS: Record<string, readonly string[]> = {
  colegios: COLEGIOS_KEY,
  plans: PLANES_KEY,
  rbac: RBAC_KEY,
}

export function usePlatformSync() {
  const { currentUser } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!currentUser?.is_platform) return

    const echo = getEcho()
    if (!echo) return

    const channel = echo.private('platform')
    const handler = (payload: { resource?: string; action?: string }) => {
      const key = payload.resource ? RESOURCE_KEYS[payload.resource] : null
      if (key) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    }

    channel.listen('.changed', handler)

    return () => {
      channel.stopListening('.changed', handler)
      echo.leaveChannel('platform')
    }
  }, [currentUser?.is_platform, queryClient])
}
