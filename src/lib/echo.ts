import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Reverb usa el protocolo Pusher por debajo; laravel-echo necesita Pusher global.
(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

const SCHEME = import.meta.env.VITE_REVERB_SCHEME ?? 'http';
const PORT = Number(import.meta.env.VITE_REVERB_PORT ?? 8080);

/**
 * Crea una instancia de Echo conectada al servidor Reverb, autenticando los
 * canales privados con el token Sanctum actual. El endpoint de auth va por el
 * mismo origen (proxy de Vite), asi conserva el subdominio del colegio y el
 * tenant/usuario se resuelven en su BD.
 */
export function createEcho(token: string): Echo<'reverb'> {
  return new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
    wsPort: PORT,
    wssPort: PORT,
    forceTLS: SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: '/api/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  });
}
