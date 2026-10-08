/** Shared dependency map for remote broadcasts and successful local writes. */
export type RealtimeScope = 'tenant' | 'platform'
const platformRoots = new Set(['colegios', 'plans', 'rbac-catalog', 'audit', 'audit-tenants', 'school-mail-requests'])
const academic = ['anos-lectivos', 'estructura', 'plan-estudios', 'horarios', 'asistencias', 'siee', 'preinformes', 'config', 'evaluacion', 'boletines', 'aula', 'eventos-catalogo', 'eventos', 'evento', 'onboarding']
const dependencies: Record<string, string[]> = {
  academic,
  structure: ['estructura', 'horarios', 'asistencias', 'plan-estudios', 'evaluacion', 'boletines', 'aula', 'eventos-catalogo', 'eventos', 'evento', 'usuarios'],
  curriculum: ['plan-estudios', 'horarios', 'asistencias', 'evaluacion', 'boletines', 'siee', 'aula'],
  schedule: ['horarios', 'asistencias', 'evaluacion', 'boletines', 'eventos', 'evento', 'eventos-catalogo'],
  attendance: ['asistencias'],
  evaluation: ['evaluacion', 'boletines', 'horarios', 'estructura', 'aula', 'eventos-catalogo'],
  aula: ['aula'],
  'enrollment-intake': ['ingreso'],
  'school-mail': ['school-mail', 'ingreso'],
  'school-mail-requests': ['school-mail-requests', 'school-mail'],
  'aula-grade': ['aula', 'evaluacion'],
  'aula-content': [],
  'aula-progress': [],
  'aula-attempt': [],
  'academic-config': ['config', 'siee', 'preinformes', 'evaluacion', 'boletines', 'onboarding'],
  events: ['eventos', 'evento', 'eventos-catalogo', 'horarios'],
  institution: ['institution-context', 'config', 'onboarding', 'boletines'],
  users: ['usuarios', 'horarios', 'asistencias', 'evaluacion', 'boletines', 'aula', 'eventos-catalogo', 'onboarding', 'account'],
  rbac: ['rbac-catalog', 'roles'],
  schools: ['institution-context', 'colegios', 'audit-tenants'],
  plans: ['institution-context', 'plans', 'colegios', 'rbac-catalog', 'aula'],
  account: ['account', 'onboarding'],
  storage: ['storage', 'eventos', 'evento', 'aula'],
  audit: ['audit'],
}

export function shouldRefreshQuery(key: readonly unknown[], resources: readonly string[], scope: RealtimeScope): boolean {
  const root = String(key[0])
  if (scope === 'tenant' && platformRoots.has(root)) return false
  if (scope === 'platform' && !platformRoots.has(root) && root !== 'account' && root !== 'institution-context') return false
  if (scope === 'tenant' && resources.includes('rbac')) return true
  if (resources.some(resource => resource === 'all' || resource === 'access' || !dependencies[resource])) return true
  if (root === 'academic-options' || root === 'academic-options-all') {
    return resources.some(resource => ['academic', 'structure', 'curriculum', 'schedule', 'users'].includes(resource))
  }
  if (root === 'aula' && resources.includes('aula-content')) {
    const detail = String(key[1] ?? '')
    if ((key.length === 2 && detail !== 'catalogo') || ['recurso', 'entregas'].includes(detail)) return true
  }
  return resources.some(resource => dependencies[resource].includes(root))
}

export function refreshesIdentity(resources: readonly string[]): boolean {
  return resources.some(resource => ['all', 'access', 'rbac', 'users', 'account', 'plans', 'schools', 'institution'].includes(resource))
}

export function resourceForPath(path: string): string {
  if (/^\/?(?:platform\/correo-solicitudes|correo-institucional\/solicitudes)(?:\/|$|\?)/.test(path)) return 'school-mail-requests'
  if (/^\/?siee\/[^/]+\/curriculo(?:\/|$|\?)/.test(path)) return 'curriculum'
  // El autosalvado y la navegación de un examen actualizan su estado local;
  // invalidar todo el Aula en cada escritura multiplicaría las consultas.
  if (/^\/?aula\/intentos\/[^/]+\/(?:respuestas|pagina|incidentes)(?:\/|$|\?)/.test(path)) return 'aula-attempt'
  if (/^\/?aula\/recursos\/[^/]+\/abrir(?:\/|$|\?)/.test(path)) return 'aula-progress'
  if (/^\/?aula\/(?:(?:recursos|entregas)\/[^/]+\/adjuntos|adjuntos\/[^/]+)(?:\/|$|\?)/.test(path)) return 'aula-content'
  if (/^\/?aula\/(?:secciones\/[^/]+\/recursos|recursos\/[^/]+|entregas\/[^/]+\/calificar|intentos\/[^/]+\/(?:finalizar|calificar))(?:$|\?)/.test(path)) return 'aula-grade'
  const root = path.split('?')[0].split('/').filter(Boolean)[0]
  return ({'anos-lectivos': 'academic', periodos: 'academic', estructura: 'structure', 'plan-estudios': 'curriculum',
    ingreso: 'enrollment-intake', 'ingreso-publico': 'enrollment-intake',
    'correo-institucional': 'school-mail',
    horarios: 'schedule', asignaciones: 'schedule', asistencias: 'attendance', evaluacion: 'evaluation', aula: 'aula', preinformes: 'academic', siee: 'academic-config', config: 'academic-config', eventos: 'events',
    onboarding: 'institution', branding: 'institution', usuarios: 'users', rbac: 'rbac', colegios: 'schools', plans: 'plans',
    planes: 'plans', account: 'account', mfa: 'account', storage: 'storage'} as Record<string, string>)[root] ?? 'all'
}

type LocalChange = {resource: string; scope: RealtimeScope; tenantKey?: string}
const listeners = new Set<(change: LocalChange) => void>()
const ownChanges = new Map<string, number>()
const ownChangeTtl = 2 * 60_000
function pruneOwnChanges(now: number) {
  for (const [id, createdAt] of ownChanges) if (now - createdAt > ownChangeTtl) ownChanges.delete(id)
}
export function rememberOwnChange(id: string) {
  const now = Date.now()
  pruneOwnChanges(now)
  ownChanges.set(id, now)
}
export function isOwnChange(id?: string): boolean {
  if (!id) return false
  pruneOwnChanges(Date.now())
  return ownChanges.has(id)
}
export function notifyLocalChange(change: LocalChange) {
  listeners.forEach(listener => listener(change))
}
export function onLocalChange(listener: (change: LocalChange) => void) {
  listeners.add(listener)
  return () => {listeners.delete(listener)}
}
