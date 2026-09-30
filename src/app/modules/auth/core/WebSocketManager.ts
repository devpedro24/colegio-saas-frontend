import {useEffect} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {useAuth} from './Auth'
import {getCurrentUser} from './_requests'
import {ApiError} from '@/lib/api/client'
import {initializeEcho, disconnectEcho} from '@/lib/echo'
import {onLocalChange, refreshesIdentity, shouldRefreshQuery, type RealtimeScope} from '@/lib/realtime'
import {clearImpersonation, useImpersonation} from '../../impersonation/impersonation.store'

/** Owns the socket for the entire authenticated session, independent of the page. */
export function WebSocketManager() {
  const {auth, currentUser, setCurrentUser, saveAuth} = useAuth()
  const {activeColegio} = useImpersonation()
  const client = useQueryClient()
  const platform = currentUser?.is_platform === true
  const tenantChannel = platform ? activeColegio?.channel_token : currentUser?.tenant_channel
  const userId = currentUser?.id

  useEffect(() => {
    if (!auth?.authenticated || !userId) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let refreshingUser = false
    let refreshUserAgain = false
    const pending = new Map<RealtimeScope, Set<string>>()
    const refreshUser = async () => {
      if (refreshingUser) {refreshUserAgain = true; return}
      refreshingUser = true
      try {
        const {data} = await getCurrentUser()
        if (!disposed) setCurrentUser(data)
      } catch (error) {
        if (!disposed && error instanceof ApiError && [401, 403].includes(error.status)) {
          saveAuth(undefined)
          setCurrentUser(undefined)
          clearImpersonation()
          client.clear()
        }
      } finally {
        refreshingUser = false
        if (refreshUserAgain && !disposed) {refreshUserAgain = false; void refreshUser()}
      }
    }
    const schedule = (scope: RealtimeScope, resources: string[] = ['all']) => {
      if (disposed) return
      const batch = pending.get(scope) ?? new Set<string>()
      resources.forEach(resource => batch.add(resource))
      pending.set(scope, batch)
      if (timer) return
      timer = setTimeout(() => {
        timer = undefined
        const batches = [...pending]
        pending.clear()
        for (const [target, changed] of batches) {
          const resources = [...changed]
          // Mark inactive views stale; fetch only visible queries, preserving filters/forms.
          void client.invalidateQueries({predicate: query => shouldRefreshQuery(query.queryKey, resources, target)})
          if ((target === 'platform' || !platform) && refreshesIdentity(resources)) void refreshUser()
        }
      }, 100)
    }
    const unsubscribeLocal = onLocalChange(change => {
      if (change.scope === 'tenant') {
        if (!platform || (activeColegio && change.tenantKey === activeColegio.slug)) schedule('tenant', [change.resource])
      } else schedule(platform ? 'platform' : 'tenant', [change.resource])
    })
    try {
      const echo = initializeEcho(tenantChannel, platform)
      const subscribe = (name: string, scope: RealtimeScope) => {
        echo.private(name)
          .listen('.application.changed', (payload: {resources?: string[]}) => schedule(scope, payload.resources))
          // Reverb does not replay missed messages. Every (re)subscription refreshes the views.
          .subscribed(() => schedule(scope, ['all']))
          .error((error: unknown) => {
            console.error('[WS] Subscription failed', name, error)
            schedule(scope, ['all'])
          })
      }
      if (platform) subscribe('platform', 'platform')
      if (tenantChannel) subscribe(`tenant.${tenantChannel}`, 'tenant')
    } catch (error) {
      console.error('[WS] Connection failed', error)
    }
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      unsubscribeLocal()
      disconnectEcho()
    }
    // Recreate only for identity/context changes, not when /me refreshes the profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.authenticated, userId, platform, tenantChannel, activeColegio?.slug, client])
  return null
}
