import {useEffect} from 'react'
import { useAuth } from '../core/Auth'
import { initializeEcho, disconnectEcho } from '@/lib/echo'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

export function useWebSocketSync() {
  const {auth, currentUser} = useAuth()
  const {activeColegio, token: impersonationToken} = useImpersonation()
  const effectiveToken = impersonationToken ?? auth?.api_token
  const tenantId = activeColegio?.id ?? currentUser?.tenant_id

  useEffect(() => {
    if (!effectiveToken) return

    try {
      initializeEcho(effectiveToken, {
        tenantId,
        impersonating: Boolean(impersonationToken && activeColegio),
      })
    } catch (error) {
      console.error('[WS] Failed to initialize Echo:', error)
    }

    return () => {
      disconnectEcho()
    }
  }, [effectiveToken, tenantId, impersonationToken, activeColegio])
}
