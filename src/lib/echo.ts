import Pusher from 'pusher-js'
import Echo from 'laravel-echo'

declare global {
  interface Window {
    Pusher: typeof Pusher
    Echo: Echo<any>
  }
}

window.Pusher = Pusher

let echoInstance: Echo<any> | null = null

export function initializeEcho(token: string, tenantAccess?: {id: string; token: string; viaHeader: boolean}): Echo<any> {
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
        const tenantChannel = tenantAccess && channel.name === `private-tenant.${tenantAccess.id}`
        const viaHeader = tenantChannel && tenantAccess.viaHeader
        fetch(viaHeader ? '/api/tenant-broadcasting/auth' : '/api/broadcasting/auth', {
          method: 'POST',
          headers: {
            Accept: 'application/json', 'Content-Type': 'application/json',
            Authorization: `Bearer ${tenantChannel ? tenantAccess.token : token}`,
            ...(viaHeader ? {'X-Tenant': tenantAccess.id} : {}),
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
  return echoInstance
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect()
    echoInstance = null
  }
}

export function getEcho(): Echo<any> | null {
  return echoInstance
}

export {echoInstance as echo}
