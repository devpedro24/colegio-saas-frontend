/**
 * Construye la URL completa de un subdominio en desarrollo:
 * `http://{slug}.localhost:5173`.
 *
 * En produccion `window.location.port` viene vacio y la URL queda sin puerto
 * (estandar 80/443).
 */
export function devDomain(slug: string): string {
  const port = window.location.port ? `:${window.location.port}` : ''
  return `${window.location.protocol}//${slug}.localhost${port}`
}

/** true si el dominio actual es localhost (desarrollo). */
export function isDev(): boolean {
  return window.location.hostname.endsWith('.localhost') || window.location.hostname === 'localhost'
}
