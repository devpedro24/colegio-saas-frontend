const configuredBaseDomain = import.meta.env.VITE_TENANT_BASE_DOMAIN?.trim()
const configuredScheme = import.meta.env.VITE_TENANT_SCHEME?.trim()
const configuredPort = import.meta.env.VITE_TENANT_PORT?.trim()

export function tenantBaseDomain(): string {
  if (configuredBaseDomain) return normalizeBaseDomain(configuredBaseDomain)

  const host = window.location.hostname
  if (host === 'localhost' || host.endsWith('.localhost')) return 'localhost'
  return host
}

export function tenantDomainSuffix(): string {
  return `.${tenantBaseDomain()}`
}

export function tenantOrigin(slugOrDomain: string): string {
  const base = tenantBaseDomain()
  const scheme = configuredScheme || window.location.protocol.replace(':', '')
  const port = configuredPort ?? (base === 'localhost' ? window.location.port : '')
  return buildTenantOrigin(slugOrDomain, {baseDomain: base, scheme, port})
}

export function isCentralHost(hostname = window.location.hostname): boolean {
  const configured = (import.meta.env.VITE_CENTRAL_HOSTS ?? '')
    .split(',')
    .map((host: string) => host.trim())
    .filter(Boolean)
  return configured.length > 0
    ? matchesCentralHost(hostname, configured)
    : hostname === tenantBaseDomain() || hostname === '127.0.0.1'
}

export function isDev(): boolean {
  return tenantBaseDomain() === 'localhost'
}

/** Alias compatible con llamadas antiguas. */
export const devDomain = tenantOrigin
import {buildTenantOrigin, matchesCentralHost, normalizeBaseDomain} from './subdomain-core'
