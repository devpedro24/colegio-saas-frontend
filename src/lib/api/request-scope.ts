export const PLATFORM_PATH_PREFIXES = [
  '/platform',
  '/colegios',
  '/plans',
  '/rbac',
  '/mfa',
  '/login',
  '/logout',
  '/me',
  '/account',
] as const

/** Clasifica rutas sin depender del estado global ni del navegador. */
export function isPlatformPath(path: string): boolean {
  return PLATFORM_PATH_PREFIXES.some(
    (prefix) =>
      path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  )
}
