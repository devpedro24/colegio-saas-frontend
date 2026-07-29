// Datos MOCK del catalogo central de RBAC (solo diseno, sin backend). Transcritos
// FIEL de la fuente de verdad del backend:
//   - App\Rbac\PermissionMatrix (roles + 31 permisos base en 7 modulos)
//   - Database\Seeders\RbacCatalogSeeder (3 permisos "gated" de ejemplo ligados a
//     features de plan -> modulos Reportes y Boletines, para que el gating con
//     candado sea observable) y el mapeo modulo->feature (Asistencia, Comunicaciones).
//   - App\Plans\PlanCatalog (features de plan para el select del formulario).

import {CellState, CellType, CellValue, RbacFeature, RbacPermission, RbacRole} from './rbac.types'

// Marcas de configurable (mismas del backend).
const CFG: CellValue = 'cfg' // configurable, por defecto OFF
const CFG_ON: CellValue = 'cfg_on' // configurable, por defecto ON

// -------------------------------------------------------------------------------------
// Roles del tenant (PermissionMatrix::ROLES). Todos de sistema salvo el custom de demo.
// -------------------------------------------------------------------------------------
export const RBAC_ROLES: RbacRole[] = [
  {id: 1, key: 'rector', label: 'Rector / Administrador del Colegio', isSystem: true, sortOrder: 0},
  {id: 2, key: 'coord_academico', label: 'Coordinador Academico', isSystem: true, sortOrder: 1},
  {id: 3, key: 'coord_convivencia', label: 'Coordinador de Convivencia', isSystem: true, sortOrder: 2},
  {id: 4, key: 'coord_combinado', label: 'Coordinador Academico y de Convivencia', isSystem: true, sortOrder: 3},
  {id: 5, key: 'secretaria', label: 'Secretaria Academica', isSystem: true, sortOrder: 4},
  {id: 6, key: 'docente', label: 'Docente', isSystem: true, sortOrder: 5},
  {id: 7, key: 'director_grupo', label: 'Director de Grupo', isSystem: true, sortOrder: 6},
  {id: 8, key: 'estudiante', label: 'Estudiante / Acudiente', isSystem: true, sortOrder: 7},
  {id: 9, key: 'personal_apoyo', label: 'Personal de Apoyo', isSystem: true, sortOrder: 8},
  // Rol custom (no de sistema) para demostrar la accion Eliminar.
  {id: 10, key: 'bibliotecario', label: 'Bibliotecario', isSystem: false, sortOrder: 9},
]

// -------------------------------------------------------------------------------------
// Permisos. Los 31 base (is_system) + 3 gated de ejemplo (no de sistema).
// El orden fija el agrupado por modulo en la matriz.
// -------------------------------------------------------------------------------------
export const RBAC_PERMISSIONS: RbacPermission[] = [
  // ---- Configuracion del Colegio ----
  {id: 1, key: 'config.identidad', module: 'Configuracion del Colegio', action: 'Configurar logo, NIT, MEN', featureKey: null, isSystem: true, sortOrder: 0, cells: {rector: 'editar'}},
  {id: 2, key: 'config.calendario', module: 'Configuracion del Colegio', action: 'Definir periodos lectivos', featureKey: null, isSystem: true, sortOrder: 1, cells: {rector: 'editar'}},
  {id: 3, key: 'config.jornadas', module: 'Configuracion del Colegio', action: 'Configurar jornadas y bloques', featureKey: null, isSystem: true, sortOrder: 2, cells: {rector: 'editar'}},
  {id: 4, key: 'config.modelo_pedagogico', module: 'Configuracion del Colegio', action: 'Configurar modelo pedagogico por nivel', featureKey: null, isSystem: true, sortOrder: 3, cells: {rector: 'editar'}},
  {id: 5, key: 'config.escala_valorativa', module: 'Configuracion del Colegio', action: 'Configurar escala valorativa', featureKey: null, isSystem: true, sortOrder: 4, cells: {rector: 'editar'}},
  {id: 6, key: 'config.metodo_aprobacion', module: 'Configuracion del Colegio', action: 'Configurar metodo de aprobacion y nota minima', featureKey: null, isSystem: true, sortOrder: 5, cells: {rector: 'editar'}},

  // ---- Usuarios y Roles ----
  {id: 7, key: 'usuarios.gestionar', module: 'Usuarios y Roles', action: 'Crear / editar / desactivar usuarios', featureKey: null, isSystem: true, sortOrder: 6, cells: {rector: 'crud'}},
  {id: 8, key: 'usuarios.asignar_roles', module: 'Usuarios y Roles', action: 'Asignar roles', featureKey: null, isSystem: true, sortOrder: 7, cells: {rector: 'editar'}},
  {id: 9, key: 'usuarios.ajustar_permisos', module: 'Usuarios y Roles', action: 'Ajustar permisos configurables', featureKey: null, isSystem: true, sortOrder: 8, cells: {rector: 'editar'}},

  // ---- Notas y Consolidados ----
  {id: 10, key: 'notas.registrar_materia_asignada', module: 'Notas y Consolidados', action: 'Registrar/editar notas en materia asignada', featureKey: null, isSystem: true, sortOrder: 9, cells: {rector: 'editar', coord_academico: CFG, coord_combinado: CFG, docente: 'editar', director_grupo: 'editar'}},
  {id: 11, key: 'notas.editar_no_dicta', module: 'Notas y Consolidados', action: 'Editar notas de materias que no dicta', featureKey: null, isSystem: true, sortOrder: 10, cells: {rector: 'editar', coord_academico: CFG, coord_combinado: CFG, director_grupo: CFG}},
  {id: 12, key: 'notas.editar_despues_cierre', module: 'Notas y Consolidados', action: 'Editar notas despues del cierre', featureKey: null, isSystem: true, sortOrder: 11, cells: {rector: 'editar', coord_academico: CFG, coord_combinado: CFG, docente: CFG, director_grupo: CFG}},
  {id: 13, key: 'notas.ver_consolidado_grupo', module: 'Notas y Consolidados', action: 'Ver consolidado del grupo dirigido', featureKey: null, isSystem: true, sortOrder: 12, cells: {rector: 'ver', coord_academico: 'ver', coord_combinado: 'ver', director_grupo: 'ver'}},
  {id: 14, key: 'notas.ver_consolidado_todos', module: 'Notas y Consolidados', action: 'Ver consolidado de todos los grupos', featureKey: null, isSystem: true, sortOrder: 13, cells: {rector: 'ver', coord_academico: 'ver', coord_combinado: 'ver'}},
  {id: 15, key: 'notas.ver_propias', module: 'Notas y Consolidados', action: 'Ver notas propias / del estudiante asociado', featureKey: null, isSystem: true, sortOrder: 14, cells: {rector: 'ver', coord_academico: 'ver', coord_combinado: 'ver', secretaria: CFG, estudiante: 'ver'}},
  {id: 16, key: 'notas.coordinar_cierre_periodo', module: 'Notas y Consolidados', action: 'Coordinar cierre de periodo', featureKey: null, isSystem: true, sortOrder: 15, cells: {rector: 'editar', coord_academico: 'editar', coord_combinado: 'editar'}},
  {id: 17, key: 'notas.gestionar_nivelaciones', module: 'Notas y Consolidados', action: 'Gestionar nivelaciones / habilitaciones', featureKey: null, isSystem: true, sortOrder: 16, cells: {rector: 'editar', coord_academico: 'editar', coord_combinado: 'editar'}},

  // ---- Asistencia (feature de plan: asistencia) ----
  {id: 18, key: 'asistencia.registrar_clases', module: 'Asistencia', action: 'Registrar asistencia en sus clases', featureKey: 'asistencia', isSystem: true, sortOrder: 17, cells: {rector: 'editar', docente: 'editar', director_grupo: 'editar'}},
  {id: 19, key: 'asistencia.consultar_grupo', module: 'Asistencia', action: 'Consultar asistencia del grupo dirigido', featureKey: 'asistencia', isSystem: true, sortOrder: 18, cells: {rector: 'ver', coord_academico: 'ver', coord_combinado: 'ver', director_grupo: 'ver'}},
  {id: 20, key: 'asistencia.consultar_propia', module: 'Asistencia', action: 'Consultar asistencia propia / del estudiante', featureKey: 'asistencia', isSystem: true, sortOrder: 19, cells: {rector: 'ver', coord_academico: 'ver', coord_convivencia: 'ver', coord_combinado: 'ver', secretaria: 'ver', estudiante: 'ver'}},

  // ---- Convivencia y Observador ----
  {id: 21, key: 'observador.registrar_academico', module: 'Convivencia y Observador', action: 'Registrar observacion academica en su materia', featureKey: null, isSystem: true, sortOrder: 20, cells: {rector: 'editar', docente: 'editar', director_grupo: 'editar'}},
  {id: 22, key: 'observador.anotacion_grupo', module: 'Convivencia y Observador', action: 'Anotacion disciplinaria en grupo dirigido', featureKey: null, isSystem: true, sortOrder: 21, cells: {rector: 'editar', coord_convivencia: 'editar', coord_combinado: 'editar', director_grupo: 'editar'}},
  {id: 23, key: 'observador.anotacion_cualquiera', module: 'Convivencia y Observador', action: 'Anotacion en cualquier estudiante', featureKey: null, isSystem: true, sortOrder: 22, cells: {rector: 'editar', coord_convivencia: 'editar', coord_combinado: 'editar'}},
  {id: 24, key: 'convivencia.citar_acudientes', module: 'Convivencia y Observador', action: 'Citar formalmente a acudientes', featureKey: null, isSystem: true, sortOrder: 23, cells: {rector: 'editar', coord_academico: CFG, coord_convivencia: CFG, coord_combinado: CFG, director_grupo: CFG}},
  {id: 25, key: 'convivencia.definir_sanciones', module: 'Convivencia y Observador', action: 'Definir sanciones formales', featureKey: null, isSystem: true, sortOrder: 24, cells: {rector: 'editar', coord_convivencia: CFG, coord_combinado: CFG}},
  {id: 26, key: 'convivencia.reportes', module: 'Convivencia y Observador', action: 'Generar reportes de convivencia', featureKey: null, isSystem: true, sortOrder: 25, cells: {rector: 'ver', coord_convivencia: 'reportar', coord_combinado: 'reportar'}},

  // ---- Comunicaciones y Portal (feature de plan: comunicacion_basica) ----
  {id: 27, key: 'comunicados.enviar_colegio', module: 'Comunicaciones y Portal', action: 'Enviar comunicado al colegio entero', featureKey: 'comunicacion_basica', isSystem: true, sortOrder: 26, cells: {rector: 'editar', coord_academico: CFG, coord_convivencia: CFG, coord_combinado: CFG, secretaria: CFG}},
  {id: 28, key: 'mensajes.acudientes', module: 'Comunicaciones y Portal', action: 'Comunicarse con acudientes via portal', featureKey: 'comunicacion_basica', isSystem: true, sortOrder: 27, cells: {rector: 'editar', coord_academico: CFG, coord_convivencia: CFG, coord_combinado: CFG, secretaria: CFG, docente: CFG, director_grupo: CFG, personal_apoyo: CFG}},
  {id: 29, key: 'portal.acceder', module: 'Comunicaciones y Portal', action: 'Acceder al portal', featureKey: 'comunicacion_basica', isSystem: true, sortOrder: 28, cells: {rector: 'ver', coord_academico: 'ver', coord_convivencia: 'ver', coord_combinado: 'ver', secretaria: 'ver', docente: 'ver', director_grupo: 'ver', estudiante: CFG, personal_apoyo: 'ver'}},

  // ---- Auditoria ----
  {id: 30, key: 'auditoria.logs_tenant', module: 'Auditoria', action: 'Acceder a logs del tenant', featureKey: null, isSystem: true, sortOrder: 29, cells: {rector: 'ver'}},
  {id: 31, key: 'auditoria.historial_registro', module: 'Auditoria', action: 'Ver historial de cambios de un registro', featureKey: null, isSystem: true, sortOrder: 30, cells: {rector: 'ver', coord_academico: CFG, coord_convivencia: CFG, coord_combinado: CFG, secretaria: CFG}},

  // ---- Gated de ejemplo (no de sistema): gating por feature de plan con candado ----
  {id: 32, key: 'comunicados.whatsapp', module: 'Comunicaciones y Portal', action: 'Enviar comunicados por WhatsApp', featureKey: 'whatsapp', isSystem: false, sortOrder: 31, cells: {rector: CFG_ON, coord_academico: CFG, coord_convivencia: CFG, coord_combinado: CFG, secretaria: CFG}},
  {id: 33, key: 'reportes.financieros', module: 'Reportes', action: 'Ver reportes financieros', featureKey: 'reportes_financieros', isSystem: false, sortOrder: 32, cells: {rector: 'ver', secretaria: CFG}},
  {id: 34, key: 'boletines.personalizar', module: 'Boletines', action: 'Personalizar plantillas de boletin', featureKey: 'boletines_personalizables', isSystem: false, sortOrder: 33, cells: {rector: 'editar', coord_academico: CFG, coord_combinado: CFG}},
]

// -------------------------------------------------------------------------------------
// Features de plan (PlanCatalog) para el select del formulario de permiso.
// -------------------------------------------------------------------------------------
export const RBAC_FEATURES: RbacFeature[] = [
  {key: 'academico', label: 'Gestion academica'},
  {key: 'asistencia', label: 'Asistencia por sesion'},
  {key: 'pagos_pension', label: 'Pagos de pensiones'},
  {key: 'multi_pasarela', label: 'Multiples pasarelas'},
  {key: 'pagos_sin_friccion', label: 'Pagos sin friccion'},
  {key: 'dian', label: 'Facturacion electronica DIAN'},
  {key: 'comunicacion_basica', label: 'Comunicados y portal'},
  {key: 'app_acudientes', label: 'App de acudientes'},
  {key: 'whatsapp', label: 'WhatsApp oficial'},
  {key: 'boletines_personalizables', label: 'Boletines personalizables'},
  {key: 'multi_sede', label: 'Multi-sede'},
  {key: 'firma_electronica', label: 'Firma electronica'},
  {key: 'carne_qr', label: 'Carne digital con QR'},
  {key: 'generador_horarios', label: 'Generador de horarios'},
  {key: 'reportes_financieros', label: 'Reportes financieros'},
  {key: 'bi_avanzado', label: 'BI avanzado'},
  {key: 'soporte_prioritario', label: 'Soporte prioritario'},
  {key: 'sso', label: 'SSO Google / Microsoft'},
]

// Niveles estructurales seleccionables (PermissionMatrix::STRUCTURAL_LEVELS).
export const RBAC_LEVELS: string[] = ['crud', 'editar', 'ver', 'reportar', 'aprobar', 'c', 'auto']

// Etiquetas en espanol de los niveles (rbacAdmin.level.* del i18n original).
export const LEVEL_LABEL: Record<string, string> = {
  crud: 'Total',
  editar: 'Editar',
  ver: 'Ver',
  reportar: 'Reportar',
  aprobar: 'Aprobar',
  c: 'Aporta',
  auto: 'Auto',
}

// Etiqueta rapida de feature -> nombre en espanol (para los badges).
export const FEATURE_LABEL: Record<string, string> = RBAC_FEATURES.reduce(
  (acc, f) => {
    acc[f.key] = f.label
    return acc
  },
  {} as Record<string, string>
)

// Etiqueta + clase de badge por tipo de celda (colores distintos).
export const CELL_META: Record<CellType, {label: string; className: string}> = {
  structural: {label: 'Estructural', className: 'badge badge-light-primary'},
  configurable: {label: 'Configurable', className: 'badge badge-light-success'},
  denied: {label: 'Denegado', className: 'badge badge-light'},
}

// Clasifica un valor de celda crudo (mismo criterio que PermissionMatrix::classifyCell).
export function classifyCell(value: CellValue | undefined): CellState {
  if (value === undefined) {
    return {type: 'denied', level: null, defaultGranted: false}
  }
  if (value === 'cfg' || value === 'cfg_on') {
    return {type: 'configurable', level: null, defaultGranted: value === 'cfg_on'}
  }
  return {type: 'structural', level: value, defaultGranted: true}
}

// Modulos en el orden en que aparecen los permisos (para agrupar la matriz).
export const RBAC_MODULES: string[] = RBAC_PERMISSIONS.reduce((acc, p) => {
  if (!acc.includes(p.module)) acc.push(p.module)
  return acc
}, [] as string[])
