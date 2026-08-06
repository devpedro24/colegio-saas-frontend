import { useEffect, useRef } from 'react'
import { useAuth } from '../core/Auth'
import { initializeEcho, disconnectEcho } from '@/lib/echo'

export function useWebSocketSync() {
  const { auth } = useAuth()
  const initialized = useRef(false)

  useEffect(() => {
    if (!auth?.api_token) return
    if (initialized.current) return

    try {
      initializeEcho(auth.api_token)
      initialized.current = true
    } catch (error) {
      console.error('[WS] Failed to initialize Echo:', error)
    }

    return () => {
      disconnectEcho()
      initialized.current = false
    }
  }, [auth?.api_token])
}
