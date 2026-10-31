import type {IntlShape} from 'react-intl'

// Etiquetas del catálogo base. La clave técnica permanece estable, pero nunca
// reemplazamos una descripción personalizada escrita por el superadministrador.
const academicDefaults: Record<string, [legacy: string, spanish: string]> = {
  'academico.anos.gestionar': ['anos.gestionar', 'Gestionar años lectivos'],
  'academico.anos.transicionar': ['anos.iniciar_cerrar', 'Iniciar o cerrar años lectivos'],
  'academico.periodos.transicionar': ['periodos.abrir_cerrar_reabrir', 'Abrir, cerrar o reabrir períodos académicos'],
  'academico.configurar': ['configurar', 'Configurar parámetros académicos'],
  'academico.estructura.gestionar': ['estructura.gestionar', 'Gestionar la estructura organizacional'],
  'academico.plan_estudios.gestionar': ['plan_estudios.gestionar', 'Gestionar el plan de estudios'],
  'academico.matriculas.gestionar': ['matriculas.gestionar', 'Gestionar matrículas'],
  'eventos.gestionar': ['eventos.gestionar_todos', 'Gestionar todos los eventos del colegio'],
  'eventos.configurar': ['eventos.configurar', 'Configurar eventos'],
  'eventos.publicar_institucional': ['eventos.publicar_institucional', 'Publicar eventos institucionales'],
  'eventos.publicar_asignados': ['eventos.publicar_asignados', 'Publicar eventos para grupos asignados'],
}

export function rbacModuleLabel(intl: IntlShape, module: string): string {
  return module === 'academico' || module === 'Académico'
    ? intl.formatMessage({id: 'rbac.module.academic'}) : module
}

export function rbacActionLabel(intl: IntlShape, key: string, action: string): string {
  const defaults = academicDefaults[key]
  return defaults && (action === defaults[0] || action === defaults[1])
    ? intl.formatMessage({id: `rbac.action.${key}`}) : action
}
