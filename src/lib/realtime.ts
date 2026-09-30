/** Shared dependency map for remote broadcasts and successful local writes. */
export type RealtimeScope = 'tenant' | 'platform'
const platformRoots = new Set(['colegios', 'plans', 'rbac-catalog', 'audit', 'audit-tenants'])
const academic = ['anos-lectivos', 'estructura', 'plan-estudios', 'horarios', 'siee', 'config', 'evaluacion', 'boletines', 'eventos-catalogo', 'eventos', 'evento', 'onboarding']
const dependencies: Record<string, string[]> = {
  academic,
  structure: ['estructura', 'horarios', 'plan-estudios', 'evaluacion', 'boletines', 'eventos-catalogo', 'eventos', 'evento', 'usuarios'],
  curriculum: ['plan-estudios', 'horarios', 'evaluacion', 'boletines', 'siee'],
  schedule: ['horarios', 'evaluacion', 'boletines', 'eventos', 'evento', 'eventos-catalogo'],
  evaluation: ['evaluacion', 'boletines', 'horarios', 'estructura', 'eventos-catalogo'],
  'academic-config': ['config', 'siee', 'evaluacion', 'boletines', 'onboarding'],
  events: ['eventos', 'evento', 'eventos-catalogo', 'horarios'],
  institution: ['config', 'onboarding', 'boletines'],
  users: ['usuarios', 'horarios', 'evaluacion', 'boletines', 'eventos-catalogo', 'onboarding', 'account'],
  rbac: ['rbac-catalog', 'roles'],
  schools: ['colegios', 'audit-tenants'],
  plans: ['plans', 'colegios', 'rbac-catalog'],
  account: ['account', 'onboarding'],
  storage: ['storage', 'eventos', 'evento'],
  audit: ['audit'],
}

export function shouldRefreshQuery(key: readonly unknown[], resources: readonly string[], scope: RealtimeScope): boolean {
  const root = String(key[0])
  if (scope === 'tenant' && platformRoots.has(root)) return false
  if (scope === 'platform' && !platformRoots.has(root) && root !== 'account') return false
  if (scope === 'tenant' && resources.includes('rbac')) return true
  if (resources.some(resource => resource === 'all' || resource === 'access' || !dependencies[resource])) return true
  return resources.some(resource => dependencies[resource].includes(root))
}

export function refreshesIdentity(resources: readonly string[]): boolean {
  return resources.some(resource => ['all', 'access', 'rbac', 'users', 'account'].includes(resource))
}

export function resourceForPath(path: string): string {
  const root = path.split('?')[0].split('/').filter(Boolean)[0]
  return ({'anos-lectivos': 'academic', periodos: 'academic', estructura: 'structure', 'plan-estudios': 'curriculum',
    horarios: 'schedule', evaluacion: 'evaluation', siee: 'academic-config', config: 'academic-config', eventos: 'events',
    onboarding: 'institution', branding: 'institution', usuarios: 'users', rbac: 'rbac', colegios: 'schools', plans: 'plans',
    planes: 'plans', account: 'account', mfa: 'account', storage: 'storage'} as Record<string, string>)[root] ?? 'all'
}

type LocalChange = {resource: string; token: string | null; tenantId?: string}
const listeners = new Set<(change: LocalChange) => void>()
export function notifyLocalChange(change: LocalChange) {
  listeners.forEach(listener => listener(change))
}
export function onLocalChange(listener: (change: LocalChange) => void) {
  listeners.add(listener)
  return () => {listeners.delete(listener)}
}
