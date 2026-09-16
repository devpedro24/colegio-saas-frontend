export type TenantOriginOptions = {
  baseDomain: string
  scheme: string
  port?: string
}

export function normalizeBaseDomain(domain: string): string {
  return domain.trim().replace(/^\.|\.$/g, '')
}

export function buildTenantOrigin(domainOrSlug: string, options: TenantOriginOptions): string {
  const domain = normalizeBaseDomain(domainOrSlug)
  const base = normalizeBaseDomain(options.baseDomain)
  const host = domain === base || domain.endsWith(`.${base}`) ? domain : `${domain}.${base}`
  const scheme = options.scheme.replace(/:$/, '')
  return `${scheme}://${host}${options.port ? `:${options.port}` : ''}`
}

export function matchesCentralHost(hostname: string, configuredHosts: string[]): boolean {
  return configuredHosts.map((host) => host.trim()).filter(Boolean).includes(hostname)
}
