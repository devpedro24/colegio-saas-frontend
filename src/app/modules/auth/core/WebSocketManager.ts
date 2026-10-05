import {useEffect} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {useAuth} from './Auth'
import {getCurrentUser} from './_requests'
import {ApiError, discardPendingReads} from '@/lib/api/client'
import {trackQueryReads} from '@/lib/api/academic-cache'
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
    let remoteTimer: ReturnType<typeof setTimeout> | undefined
    let nextRemoteRefresh = 0
    const remotePending = new Map<RealtimeScope, {resources: Set<string>; revision: number}>()
    let refreshingUser = false
    let refreshUserAgain = false
    const reads = trackQueryReads(client)
    const pending = new Map<RealtimeScope, {resources: Set<string>; revision: number}>()
    let hasLiveUpdates = () => false
    let lastRecovery = Date.now()
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
    const schedule = (scope: RealtimeScope, resources: string[] = ['all'], revision = reads.checkpoint()) => {
      if (disposed) return
      const batch = pending.get(scope) ?? {resources: new Set<string>(), revision: 0}
      resources.forEach(resource => batch.resources.add(resource))
      batch.revision = Math.max(batch.revision, revision)
      pending.set(scope, batch)
      if (timer) return
      timer = setTimeout(() => {
        timer = undefined
        const batches = [...pending]
        pending.clear()
        for (const [target, changed] of batches) {
          const resources = [...changed.resources]
          // Mark inactive views stale; fetch only visible queries, preserving filters/forms.
          void client.invalidateQueries({predicate: query =>
            shouldRefreshQuery(query.queryKey, resources, target) && reads.needsRefresh(query, changed.revision),
          })
          if ((target === 'platform' || !platform) && refreshesIdentity(resources)) void refreshUser()
        }
      }, 100)
    }
    // A bulk import may produce many queued broadcasts. Apply the first one
    // immediately, then coalesce the rest into a trailing refresh at most once
    // per five seconds. Keep the event-time checkpoint so fresh reads are not
    // fetched again just because the trailing timer fired later.
    const scheduleRemote = (scope: RealtimeScope, resources: string[] = ['all']) => {
      const revision = reads.checkpoint()
      const now = Date.now()
      if (now >= nextRemoteRefresh && !remoteTimer) {
        nextRemoteRefresh = now + 5000
        schedule(scope, resources, revision)
        return
      }
      const batch = remotePending.get(scope) ?? {resources: new Set<string>(), revision: 0}
      resources.forEach(resource => batch.resources.add(resource))
      batch.revision = Math.max(batch.revision, revision)
      remotePending.set(scope, batch)
      if (remoteTimer) return
      remoteTimer = setTimeout(() => {
        remoteTimer = undefined
        nextRemoteRefresh = Date.now() + 5000
        for (const [target, changed] of remotePending) {
          schedule(target, [...changed.resources], changed.revision)
        }
        remotePending.clear()
      }, Math.max(0, nextRemoteRefresh - now))
    }
    const unsubscribeLocal = onLocalChange(change => {
      if (change.scope === 'tenant') {
        if (!platform || (activeColegio && change.tenantKey === activeColegio.slug)) schedule('tenant', [change.resource])
      } else schedule(platform ? 'platform' : 'tenant', [change.resource])
    })
    // Never leave an event-driven cache fresh forever if Reverb/its worker fails.
    // No polling on each navigation: recover visible views at most once/minute
    // offline from Reverb, plus a 15-minute safety reconciliation while connected.
    const recover = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return
      if (Date.now() - lastRecovery < (hasLiveUpdates() ? 15 * 60_000 : 60_000)) return
      lastRecovery = Date.now()
      discardPendingReads()
      if (platform) schedule('platform', ['all'])
      if (tenantChannel || !platform) schedule('tenant', ['all'])
    }
    const recoveryTimer = setInterval(recover, 60_000)
    document.addEventListener('visibilitychange', recover)
    window.addEventListener('online', recover)
    try {
      const echo = initializeEcho(tenantChannel, platform)
      const liveScopes = new Set<RealtimeScope>()
      hasLiveUpdates = () => echo.connector.pusher.connection.state === 'connected'
        && (!platform || liveScopes.has('platform')) && (!tenantChannel || liveScopes.has('tenant'))
      const subscribe = (name: string, scope: RealtimeScope) => {
        let subscribed = false
        echo.private(name)
          .listen('.application.changed', (payload: {resources?: string[]}) => {
            discardPendingReads()
            scheduleRemote(scope, payload.resources)
          })
          // The first subscription accompanies the initial load; only reconnects
          // need recovery because Reverb does not replay missed messages.
          .subscribed(() => {
            liveScopes.add(scope)
            if (subscribed) {
              discardPendingReads()
              schedule(scope, ['all'])
            }
            subscribed = true
          })
          .error((error: unknown) => {
            liveScopes.delete(scope)
            console.error('[WS] Subscription failed', name, error)
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
      if (remoteTimer) clearTimeout(remoteTimer)
      clearInterval(recoveryTimer)
      document.removeEventListener('visibilitychange', recover)
      window.removeEventListener('online', recover)
      reads.unsubscribe()
      unsubscribeLocal()
      disconnectEcho()
    }
    // Recreate only for identity/context changes, not when /me refreshes the profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.authenticated, userId, platform, tenantChannel, activeColegio?.slug, client])
  return null
}
