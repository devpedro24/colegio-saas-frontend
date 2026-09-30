/* eslint-disable @typescript-eslint/no-explicit-any */
import Pusher from 'pusher-js'
import Echo from 'laravel-echo'
import {getCsrfToken, setSocketIdProvider} from './api/client'

declare global {
  interface Window {
    Pusher: typeof Pusher
    Echo: Echo<any>
  }
}

window.Pusher = Pusher

let echoInstance: Echo<any> | null = null

export function initializeEcho(tenantChannel?: string | null, platform = false): Echo<any> {
  if (echoInstance) {
    echoInstance.disconnect()
  }

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT ? parseInt(import.meta.env.VITE_REVERB_PORT) : 8080,
    wssPort: import.meta.env.VITE_REVERB_PORT ? parseInt(import.meta.env.VITE_REVERB_PORT) : 8080,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    authorizer: (channel: {name: string}) => ({
      authorize: (socketId: string, callback: (error: Error | null, data: {auth: string; channel_data?: string; shared_secret?: string} | null) => void) => {
        const impersonatedTenant = platform && tenantChannel && channel.name === `private-tenant.${tenantChannel}`
        const csrf = getCsrfToken()
        fetch(impersonatedTenant ? '/api/tenant-broadcasting/auth' : '/api/broadcasting/auth', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json', 'Content-Type': 'application/json',
            ...(csrf ? {'X-CSRF-Token': csrf} : {}),
          },
          body: JSON.stringify({socket_id: socketId, channel_name: channel.name}),
        }).then(async response => {
          if (!response.ok) throw new Error(`WebSocket authorization failed (${response.status})`)
          callback(null, await response.json())
        }).catch(error => callback(error, null))
      },
    }),
  })

  window.Echo = echoInstance
  setSocketIdProvider(() => echoInstance?.socketId())
  return echoInstance
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect()
    echoInstance = null
    setSocketIdProvider(() => undefined)
  }
}

export function getEcho(): Echo<any> | null {
  return echoInstance
}

export {echoInstance as echo}
