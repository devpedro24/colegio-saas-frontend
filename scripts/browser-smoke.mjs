// UI smoke test with isolated browser profile and in-memory API fixtures. No real database.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn, spawnSync} from 'node:child_process'
import {once} from 'node:events'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {enrollmentFixture, runEnrollmentSmoke} from './enrollment-smoke.mjs'
import {eventsFixture, runEventsSmoke} from './events-smoke.mjs'
import {runAcademicNavigationSmoke} from './academic-navigation-smoke.mjs'

const root = path.resolve(import.meta.dirname, '..')
const academicCacheMode = process.argv.includes('--academic-cache')
const realtimeMode = process.argv.includes('--realtime') || academicCacheMode
const paginationMode = process.argv.includes('--pagination')
const platformMode = process.argv.includes('--platform')
const performanceMode = process.argv.includes('--performance')
const cacheMode = process.argv.includes('--cache')
const gradingMode = process.argv.includes('--grading')
const workflowMode = process.argv.includes('--academic-workflow')
const aulaMode = process.argv.includes('--aula')
const eventsMode = process.argv.includes('--events')
const teacherAccessMode = process.argv.includes('--teacher-access') || academicCacheMode
const indicatorScopeMode = process.argv.includes('--indicator-scope')
const indicatorSheetMode = process.argv.includes('--indicator-sheet')
const rbacMode = process.argv.includes('--rbac')
const intakeMode = process.argv.includes('--ingreso') || process.argv.includes('--ingreso-summary')
const apiReads = []
const apiWrites = []
const indicatorSheetWrites = []
const indicatorSheetDeletes = []
const closedIndicatorPeriod = 'q'.repeat(24)
const detailedReads = []
const samplePdf = () => {
  const stream = 'BT /F1 22 Tf 60 720 Td (Vista previa del archivo) Tj ET'
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => {offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`})
  const start = Buffer.byteLength(pdf)
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
  return Buffer.from(pdf)
}
const reverbProbe = input => {
  const result = spawnSync('php', [path.join(root, '../colegio-saas-backend/tests/Support/reverb-probe.php')], {
    input: JSON.stringify(input), encoding: 'utf8', windowsHide: true,
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return JSON.parse(result.stdout)
}
const browserPath = process.env.SMOKE_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
assert.ok(fs.existsSync(browserPath), 'Set SMOKE_BROWSER_PATH to a Chromium browser executable.')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'colegio-ui-smoke-'))
const artifacts = path.join(root, 'artifacts', 'ui-smoke')
fs.mkdirSync(artifacts, {recursive: true})
const today = new Date().toLocaleDateString('en-CA')
const user = {id: 'u'.repeat(24), tenant_channel: 't'.repeat(24), name: 'Rector de prueba', email: 'rector@example.test', is_platform: false, roles: ['rector'], permissions: ['academico.anos.gestionar', 'academico.anos.transicionar', 'academico.periodos.transicionar', 'academico.configurar', 'academico.estructura.gestionar', 'academico.plan_estudios.gestionar'], mfa_enabled: false}
if (workflowMode || paginationMode) user.institution = {name: 'Colegio de prueba', plan: {name: 'Premium', features: ['nucleo', 'academico']}}
if (platformMode) { user.is_platform = true; user.tenant_channel = null; user.roles = ['superadmin']; user.permissions = [] }
if (rbacMode) user.permissions.push('usuarios.ajustar_permisos')
if (indicatorScopeMode) user.permissions.push('indicadores.configurar', 'indicadores.base.gestionar')
if (indicatorSheetMode) user.permissions.push('indicadores.base.gestionar')
const rbacFixture = rbacMode ? {data: [
  {module: 'academico', permissions: [
    {key: 'academico.anos.gestionar', action: 'anos.gestionar', feature_key: 'academico', cells: {
      rector: {type: 'structural', level: 'crud', granted: true, locked_by_plan: false},
      docente: {type: 'denied', level: null, granted: false, locked_by_plan: false},
      custom_apoyo: {type: 'configurable', level: null, granted: true, locked_by_plan: false},
    }},
    {key: 'academico.matriculas.gestionar', action: 'matriculas.gestionar', feature_key: 'academico', cells: {
      rector: {type: 'structural', level: 'crud', granted: true, locked_by_plan: false},
      docente: {type: 'configurable', level: null, granted: false, locked_by_plan: false},
      custom_apoyo: {type: 'configurable', level: null, granted: false, locked_by_plan: false},
    }},
  ]},
  {module: 'Aula', permissions: [{key: 'aula.ver_todas', action: 'Ver todas las aulas', feature_key: 'aula', cells: {
    rector: {type: 'structural', level: 'ver', granted: false, locked_by_plan: true},
    docente: {type: 'configurable', level: null, granted: false, locked_by_plan: true},
    custom_apoyo: {type: 'configurable', level: null, granted: false, locked_by_plan: true},
  }}]},
], roles: [
  {key: 'rector', label: 'Rector', custom: false, locked_by_plan: false},
  {key: 'docente', label: 'Docente', custom: false, locked_by_plan: false},
  {key: 'custom_apoyo', label: 'Apoyo académico', custom: true, locked_by_plan: false},
], custom_role_limit: 2, custom_role_count: 1, plan_features: ['nucleo', 'academico']} : null
if (rbacFixture) {
  for (const [key, label] of [
    ['coord_academico', 'Coordinador académico'], ['coord_convivencia', 'Coordinador de convivencia'],
    ['coord_combinado', 'Coordinador académico y de convivencia'], ['secretaria', 'Secretaría académica'],
    ['director_grupo', 'Director de grupo'], ['estudiante', 'Estudiante'], ['personal_apoyo', 'Personal de apoyo'],
  ]) rbacFixture.roles.push({key, label, custom: false, locked_by_plan: false})
  rbacFixture.data[0].permissions.push(...Array.from({length: 60}, (_, index) => ({
    key: `academico.recorrido.${index + 1}`, action: `Permiso de recorrido ${index + 1}`, feature_key: 'academico',
    cells: {rector: {type: 'structural', level: 'ver', granted: true, locked_by_plan: false}},
  })))
}
const rbacCatalogFixture = rbacMode && platformMode ? {
  permissions: rbacFixture.data.flatMap(module => module.permissions.map((permission, sort_order) => ({
    key: permission.key, module: module.module, action: permission.action, feature_key: permission.feature_key,
    description: null, is_system: true, sort_order,
  }))),
  roles: rbacFixture.roles.filter(role => !role.custom).map((role, sort_order) => ({
    key: role.key, label: role.label, is_system: true, sort_order,
  })),
  matrix: [
    {role_key: 'rector', permission_key: 'academico.anos.gestionar', type: 'structural', level: 'crud', default_granted: true},
    {role_key: 'docente', permission_key: 'academico.matriculas.gestionar', type: 'configurable', level: null, default_granted: false},
  ], levels: ['crud', 'editar', 'ver'], features: [
    {key: 'nucleo', category: 'general', label: 'plan.f.nucleo', description: 'plan.f.nucleo.desc', required: true},
    {key: 'academico', category: 'academico', label: 'plan.f.academico', description: 'plan.f.academico.desc'},
  ], categories: [{key: 'general', label: 'plan.cat.general'}, {key: 'academico', label: 'plan.cat.academico'}],
} : null
const intakeFixture = intakeMode ? enrollmentFixture(user) : null
if (process.argv.includes('--institutional')) user.permissions.push('config.correo')
if (realtimeMode) user.tenant_channel = reverbProbe({action: 'channel'}).token
const urlTokens = {year: 'a'.repeat(24), nextYear: 'b'.repeat(24), group: 'c'.repeat(24), groupB: 'd'.repeat(24), groupC: 'e'.repeat(24), groupPre: '7'.repeat(24), teacher: 'f'.repeat(24), space: 'g'.repeat(24), assignment: 'h'.repeat(24), period: 'j'.repeat(24), enrollment: 'k'.repeat(24), sede: 'm'.repeat(24), event: 'i'.repeat(24), materia: 'v'.repeat(24)}
const sieeTokens = {grade: 'o'.repeat(24), level: 'p'.repeat(24), area: 'q'.repeat(24), scale: 'r'.repeat(24), method: 's'.repeat(24)}
const sieePath = `/api/siee/${urlTokens.year}`
const sieeCurriculumPath = `${sieePath}/curriculo`
const opaquePlanillaPath = `/api/evaluacion/planillas/${urlTokens.assignment}/${urlTokens.period}`
const opaqueBoletinPath = `/api/evaluacion/boletines/${urlTokens.enrollment}`
const promotionPath = `/api/anos-lectivos/${urlTokens.year}/promociones`
const year = {id: 1, url_token: urlTokens.year, nombre: '2026', estado: 'en_curso', tipo_calendario: 'A', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', num_periodos: 3, periodo_sumatorio: true}
const nextYear = {...year, id: 2, url_token: urlTokens.nextYear, legacy_url_token: '2'.repeat(64), nombre: '2027', estado: 'planificado'}
const group = {id: 1, url_token: urlTokens.group, nombre: 'A', ano_lectivo_id: 1, jornada_id: 1, sede_id: 1, grado: {id: 1, nombre: 'Primero', nivel_id: 1}, sede: {id: 1, nombre: 'Sede Principal'}, jornada: {id: 1, nombre: 'Mañana', hora_inicio: '07:00:00', hora_fin: '12:30:00'}}
const groupB = {...group, id: 2, url_token: urlTokens.groupB, nombre: 'B'}
const groupC = {...group, id: 3, url_token: urlTokens.groupC, nombre: 'C', jornada_id: 2, jornada: {id: 2, nombre: 'Tarde', hora_inicio: '13:00:00', hora_fin: '17:00:00'}}
const extraGroups = Array.from({length: 49}, (_, index) => ({...group, id: index + 4, url_token: `${'n'.repeat(21)}${String(index + 4).padStart(3, '0')}`, nombre: `Grupo ${index + 4}`}))
const groupPre = {...group, id: 53, url_token: urlTokens.groupPre, grado: {id: 3, nombre: 'Prejardín', nivel_id: 2}}
const enrollment = {id: 1, url_token: urlTokens.enrollment, estudiante_id: 2, ano_lectivo_id: 1, grupo_id: 1, estado: 'activa', estudiante: {id: 2, name: 'Estudiante de prueba'}, grupo: group}
const assignment = {id: 1, url_token: urlTokens.assignment, ano_lectivo_id: 1, grupo_id: 1, materia_id: 1, docente_id: 3, grupo: group, materia: {id: 1, nombre: 'Matemáticas'}}
const period = {id: 1, url_token: urlTokens.period, ano_lectivo_id: 1, nombre: 'Trimestre 1', orden: 1, fecha_inicio: '2026-09-01', fecha_fin: '2026-09-30', peso: 50, estado: 'abierto', es_actual: true, reapertura_manual: false, created_at: null}
const nextPeriod = {...period, id: 2, url_token: 'l'.repeat(24), nombre: 'Trimestre 2', orden: 2, fecha_inicio: '2026-10-01', fecha_fin: '2026-12-31', estado: 'planificado', es_actual: false}
const block = {id: 1, nombre: 'Primera', jornada_id: 1, hora_inicio: '08:00', hora_fin: '08:45'}
const config = {usar_areas: false, modo_area: 'SIMPLE_AVERAGE', modo_asignatura: 'SIMPLE_AVERAGE', modo_anual: 'SIMPLE_AVERAGE', redondeo: 'HALF_UP', precision_calculo: 8, recuperacion: 'REPLACE', mostrar_final: true, etiqueta_final: 'Definitiva', escala_token: sieeTokens.scale, metodo_token: sieeTokens.method, valor_min: '0', valor_max: '5', decimales: 2, nota_minima: '3'}
const event = {url_token: urlTokens.event, titulo: 'Feria de ciencias', descripcion: 'Compartimos nuestros experimentos.', fecha: today, hora_inicio: null, hora_fin: null, categoria: 'actividad', institucional: true, materia_token: null, grupo_tokens: [], grupos: [], created_by_token: user.id, created_at: new Date().toISOString()}
const sede = {id: '1', hashed_id: urlTokens.sede, nombre: 'Sede Norte', direccion: 'Calle 1', telefono: '601 123 4567', responsable: null, coordinador_name: 'Coordinadora de prueba', coordinador_email: 'coordinadora@example.test', tenant_id: 'sede-smoke', tenant_slug: 'norte', tenant_domain: 'norte', tenant_status: 'active', es_principal: false, estado: 'activa', created_at: null}
const publicToken = (resource, id) => resource === 'ano_lectivo'
  ? Number(id) === 2 ? urlTokens.nextYear : urlTokens.year
  : resource === 'sede' ? urlTokens.sede
    : resource === 'espacio_fisico' && Number(id) === 1 ? urlTokens.space
    : resource === 'grupo' && Number(id) <= 3 ? [urlTokens.group, urlTokens.groupB, urlTokens.groupC][Number(id) - 1]
    : resource === 'grado' && Number(id) === 1 ? sieeTokens.grade
    : resource === 'nivel' && Number(id) === 1 ? sieeTokens.level
    : resource === 'materia' && Number(id) === 1 ? urlTokens.materia
    : resource === 'asignacion' && Number(id) === 1 ? urlTokens.assignment
    : resource === 'periodo' && Number(id) === 1 ? urlTokens.period
    : resource === 'matricula' && Number(id) === 1 ? urlTokens.enrollment
    : (resource === 'docente' || resource === 'usuario') && Number(id) === 3 ? urlTokens.teacher
    : `${({area: 'x', materia: 'v', nivel: 'y', grado: 'o', jornada: 'j', grupo: 'c', bloque_horario: 'b', espacio_fisico: 'g', sesion_horario: 'z'})[resource] ?? 'w'}${String(id).padStart(23, '0')}`
const nestedResource = {area: 'area', materia: 'materia', nivel: 'nivel', grado: 'grado', sede: 'sede', jornada: 'jornada', grupo: 'grupo', ano_lectivo: 'ano_lectivo', estudiante: 'estudiante', docente: 'usuario', bloque: 'bloque_horario', espacio: 'espacio_fisico'}
const opaqueRecord = (row, resource) => {
  if (Array.isArray(row)) return row.map(item => opaqueRecord(item, resource))
  if (!row || typeof row !== 'object') return row
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === 'id') {result.url_token = row.url_token?.length === 24 ? row.url_token : publicToken(resource, value); continue}
    if (['hashed_id', 'tenant_id', 'responsable', 'es_principal'].includes(key)) continue
    if (key.endsWith('_id')) {result[`${key.slice(0, -3)}_token`] = value == null ? null : publicToken(key.slice(0, -3), value); continue}
    result[key] = nestedResource[key] ? opaqueRecord(value, nestedResource[key]) : value
  }
  return result
}
const academicResource = pathname => {
  const name = pathname.split('/')[3]
  return ({sedes: 'sede', jornadas: 'jornada', niveles: 'nivel', grados: 'grado', grupos: 'grupo', 'bloques-horarios': 'bloque_horario', 'espacios-fisicos': 'espacio_fisico', areas: 'area', materias: 'materia'})[name]
}
const opaqueEvaluation = (pathname, response) => {
  if (!response || !('data' in response)) return response
  if (pathname === '/api/evaluacion/catalogo') {
    const data = response.data
    return {...response, data: {...data,
      anos: opaqueRecord(data.anos, 'ano_lectivo'),
      periodos: opaqueRecord(data.periodos, 'periodo'),
      asignaciones: opaqueRecord(data.asignaciones, 'asignacion'),
      matriculas: opaqueRecord(data.matriculas, 'matricula'),
      grupos: opaqueRecord(data.grupos, 'grupo'),
      materias: opaqueRecord(data.materias, 'materia'),
      estudiantes: opaqueRecord(data.estudiantes, 'estudiante'),
      estudiantes_disponibles: opaqueRecord(data.estudiantes_disponibles, 'estudiante'),
      selected_asignacion: data.selected_asignacion ? opaqueRecord(data.selected_asignacion, 'asignacion') : null,
      selected_matricula: data.selected_matricula ? opaqueRecord(data.selected_matricula, 'matricula') : null,
    }}
  }
  if (pathname.startsWith('/api/evaluacion/planillas/')) {
    const data = response.data
    return {...response, data: {...data,
      periodo: opaqueRecord(period, 'periodo'), permisos: {crear: true, editar: true, eliminar: true, configurar: true},
      usa_preinformes: gradingMode, modo_preinformes: gradingMode ? 'SIMPLE_AVERAGE' : null, estructura_anterior: false,
      pagination: data.pagination ?? {matriculas: {current_page: 1, per_page: 20, last_page: 1, total: data.matriculas.length}},
      secciones: data.componentes.map(item => ({componente_token: publicToken('componente', item.id), preinforme_token: gradingMode ? `p${String(item.id).padStart(23, '0')}` : null,
        nombre: gradingMode ? item.nombre : null, modo: item.modo, peso: item.peso, version: item.version ?? 1,
        actividades: opaqueRecord(item.actividades ?? [], 'actividad').map(a => ({...a, version: a.version ?? 1}))})),
      componentes: data.componentes.map(item => ({...opaqueRecord(item, 'componente'), actividades: opaqueRecord(item.actividades ?? [], 'actividad')})),
      matriculas: opaqueRecord(data.matriculas, 'matricula'),
      calificaciones: data.calificaciones.map(({id: _id, ...row}) => opaqueRecord(row, 'calificacion')),
      resultados: data.resultados.map(item => opaqueRecord(item, 'resultado')),
    }}
  }
  if (pathname.startsWith('/api/evaluacion/boletines/')) {
    const data = response.data
    const convertResults = rows => rows.map(row => ({...row, periodos: opaqueRecord(row.periodos, 'resultado')})).map(row => opaqueRecord(row, 'resultado'))
    return {...response, data: {...data,
      estudiante: opaqueRecord(data.estudiante, 'estudiante'),
      periodos: opaqueRecord(data.periodos, 'periodo'),
      asignaturas: convertResults(data.asignaturas),
      areas: convertResults(data.areas),
    }}
  }
  return response
}
const opaqueSchedule = response => {
  if (!response || !('data' in response)) return response
  const data = response.data
  return {...response, data: {...data,
    anos: opaqueRecord(data.anos, 'ano_lectivo'),
    grupos: opaqueRecord(data.grupos, 'grupo'),
    docentes: opaqueRecord(data.docentes, 'usuario'),
    areas: opaqueRecord(data.areas, 'area'),
    materias: opaqueRecord(data.materias, 'materia'),
    bloques: opaqueRecord(data.bloques, 'bloque_horario'),
    espacios: opaqueRecord(data.espacios, 'espacio_fisico'),
    asignaciones: opaqueRecord(data.asignaciones, 'asignacion'),
    sesiones: opaqueRecord(data.sesiones, 'sesion_horario'),
  }}
}
const hasPrivateIdKey = value => Array.isArray(value) ? value.some(hasPrivateIdKey)
  : value && typeof value === 'object' ? Object.entries(value).some(([key, field]) => key === 'id' || key.endsWith('_id') || hasPrivateIdKey(field))
    : false
const fixtures = {
  '/api/me': {user, csrf_token: 'smoke-csrf'},
  '/api/platform/impersonar/estado': {data: {colegio: null}},
  '/api/platform/auditoria/colegios': {data: [{slug: 'colegio-prueba', name: 'Colegio de prueba'}]},
  '/api/platform/auditoria': {data: [], current_page: 1, last_page: 1, total: 0},
  '/api/colegios': {data: [{name: 'Colegio de prueba', slug: 'colegio-prueba', legal_name: null, nit: null, plan: 'premium', status: 'active', subdomain: 'colegio-prueba.localhost', created_at: null}]},
  '/api/colegios/colegio-prueba/sedes': {data: [{url_token: urlTokens.sede, nombre: 'Sede Norte', direccion: 'Calle 1', telefono: '601 123 4567', estado: 'activa', tenant_slug: 'norte', tenant_domain: 'norte.localhost', tenant_status: 'active'}]},
  '/api/onboarding/status': {required: false, password_required: false, institution_required: false, institution: null, logo_url: null},
  '/api/broadcasting/auth': {auth: 'smoke'},
  '/api/tenant-status': {is_tenant: true, tenant: {id: 'smoke', name: 'Colegio de prueba', status: 'active'}},
  '/api/anos-lectivos': {data: [year, nextYear]},
  '/api/anos-lectivos/1/periodos': {data: [period, nextPeriod]},
  '/api/anos-lectivos/2/estado-copia': {data: {origen_id: 1, opciones: {jornadas: true, periodos: true}, reemplazable: false}},
  [promotionPath]: {data: [{matricula_token: urlTokens.enrollment, estudiante: 'Mariana Rodríguez Peña',
    grado: 'Primero', grado_token: sieeTokens.grade, grupo: 'A',
    propuesta: {estado: 'calculada', resultado: 'promovido', numero_reprobadas: 0,
      numero_obligatorias_reprobadas: 0, promedio: '4.20', promedio_cumple: true, huella: 'f'.repeat(64)},
    decision: null}], meta: {current_page: 1, last_page: 1, total: 1}, politica: null,
    materias: [{token: urlTokens.materia, nombre: 'Matemáticas'}],
    grados: [{token: sieeTokens.grade, nombre: 'Primero'}, {token: 'u'.repeat(24), nombre: 'Segundo'}]},
  '/api/config/datos-institucionales': {data: {nombre: 'Colegio de prueba', nit: '900123456-7', resolucion_men: '123 de 2026', direccion: 'Calle 1', telefono: '601 123 4567', correo: 'contacto@example.test'}},
  '/api/config/zona-horaria': {data: {zona_horaria: 'America/Bogota', zonas: [
    {id: 'America/Bogota', offset: 'UTC-05:00'}, {id: 'Pacific/Auckland', offset: 'UTC+13:00'},
  ]}},
  '/api/estructura/sedes': {data: [sede]},
  [`/api/estructura/sedes/${urlTokens.sede}`]: {data: sede},
  '/api/estructura/sedes/opaque-sede-one': {data: sede},
  '/api/estructura/jornadas': {data: [{id: 1, ano_lectivo_id: 1, nombre: 'Mañana', sede_id: 1, estado: 'activa', hora_inicio: '07:00:00', hora_fin: '12:30:00'}]},
  '/api/estructura/bloques-horarios': {data: [{...block, ano_lectivo_id: 1, estado: 'activo', es_descanso: false, jornada: {id: 1, nombre: 'Mañana', sede_id: 1}}]},
  '/api/plan-estudios/areas': {data: [{id: 1, ano_lectivo_id: 1, nombre: 'Matemáticas', descripcion: null, estado: 'activo'}]},
  '/api/plan-estudios/materias': {data: [{id: 1, ano_lectivo_id: 1, area_id: 1, nivel_id: null, nombre: 'Matemáticas', intensidad_horaria: 5, estado: 'activo'}]},
  '/api/horarios': {data: {can_manage: true, anos: [year], grupos: [group, groupB, groupC, groupPre], docentes: [{id: 3, url_token: urlTokens.teacher, name: 'Docente de prueba'}], areas: [], materias: [{...assignment.materia, estado: 'activo', nivel_id: null}], bloques: [block], espacios: [{id: 1, url_token: urlTokens.space, nombre: 'Aula Primero', sede_id: 1}], asignaciones: [{...assignment, docente_id: null, docente: null}], sesiones: [{id: 1, asignacion_id: 1, grupo_id: 1, materia_id: 1, docente_id: null, grupo: group, materia: assignment.materia, docente: null, dia: 'lunes', bloque_horario_id: 1, hora_inicio: null, hora_fin: null, espacio_fisico_id: 1, bloque: block, espacio: {id: 1, nombre: 'Aula Primero'}}, {id: 2, asignacion_id: null, grupo_id: 2, materia_id: 1, docente_id: null, grupo: groupB, materia: assignment.materia, docente: null, dia: 'lunes', bloque_horario_id: null, hora_inicio: '08:00:00', hora_fin: '09:15:00', espacio_fisico_id: null, bloque: null, espacio: null}]}},
  '/api/eventos/catalogo': {data: {es_rector: true, puede_crear: true, docentes_cualquier_grupo: false, grupos: [{url_token: urlTokens.group, nombre: 'A', grado_token: sieeTokens.grade, ano_lectivo_token: urlTokens.year, grado: {url_token: sieeTokens.grade, nombre: 'Primero'}}], materias: [{url_token: urlTokens.materia, nombre: 'Matemáticas'}], asignaciones: [{grupo_token: urlTokens.group, materia_token: urlTokens.materia}]}},
  '/api/eventos': {data: [event], last_page: 1},
  '/api/eventos/tareas': {data: [], last_page: 1},
  [`/api/eventos/${urlTokens.event}`]: {data: {...event, archivos: [], puede_editar: true}},
  '/api/evaluacion/catalogo': {data: {can_manage: true, can_configure: true, can_view_reports: true, anos: [year, nextYear], periodos: [period, {...period, id: 2, ano_lectivo_id: 2, url_token: 'l'.repeat(24)}], asignaciones: [assignment], matriculas: [enrollment], grupos: [group], estudiantes: []}},
  '/api/indicadores': {data: {periodo_token: urlTokens.period, indicadores: [], pagina: 1, ultima_pagina: 1, total: 0}},
  [`/api/indicadores/politica/${urlTokens.year}`]: {data: {alcance: 'grupo', docente_puede_editar: false, version: 1, configurado: true}},
  '/api/evaluacion/planillas/1/1': {data: {editable: true, requiere_motivo: true, configuracion: config, componentes: [{id: 1, asignacion_id: 1, periodo_id: 1, nombre: 'Talleres', modo: 'SIMPLE_AVERAGE', peso: null, actividades: [{id: 1, componente_id: 1, nombre: 'Taller 1', fecha: today, peso: null}]}], matriculas: [enrollment], calificaciones: [], resultados: [{matricula_id: 1, estado: 'pendiente', motivo: 'Faltan notas'}]}},
  '/api/evaluacion/boletines/1': {data: {tipo: 'VISTA_PREVIA', generado_en: new Date().toISOString(), institucion: 'Colegio de prueba', estudiante: enrollment.estudiante, grupo: 'A', grado: 'Primero', ano: '2026', configuracion: config, periodos: [period], periodo_sumatorio: {orden: 4, nombre: 'P4', modo: 'SIMPLE_AVERAGE'}, asignaturas: [{materia_id: 1, nombre: 'Matemáticas', peso_area: null, periodos: [{periodo_id: 1, estado: 'pendiente'}], anual: {estado: 'pendiente'}}], areas: [], advertencias: []}},
  '/api/evaluacion/recuperaciones': {data: [], candidatos: [
    {asignacion_token: urlTokens.assignment, periodo_token: urlTokens.period, materia: 'Matemáticas', periodo: 'Trimestre 1', valor_original: '2.0', tipo: 'nivelacion', puede_abrir: true},
  ], can_manage: true, contexto: {estudiante: 'Estudiante reprobado', grado: 'Primero', grupo: 'A', ano_lectivo_token: urlTokens.year}, meta: {current_page: 1, last_page: 1, total: 0}},
  [sieePath]: {data: {editable: true, curriculo_editable: true, configuracion: config, escalas: [{url_token: sieeTokens.scale, nombre: 'Numérica', tipo: 'numerica', valor_min: '0', valor_max: '5', decimales: 2}], metodos: [{url_token: sieeTokens.method, calculo_nota: 'promedio_simple', nota_minima: '3', ambito: 'materia'}], curriculo: [], grados: [{url_token: sieeTokens.grade, nombre: 'Primero', nivel_token: sieeTokens.level, estado: 'activo'}], materias: [{url_token: 'v'.repeat(24), nombre: 'Matemáticas', nivel_token: null, area_token: null, estado: 'activo'}], areas: []}},
}
fixtures[sieeCurriculumPath] = {data: [], meta: {current_page: 1, per_page: 1000, last_page: 1, total: 0}}
user.permissions.push('academico.matriculas.gestionar')
user.permissions.push('notas.gestionar_nivelaciones')
fixtures['/api/evaluacion/catalogo'].data.can_manage_enrollments = true
fixtures['/api/evaluacion/catalogo'].data.materias = [{id: 1, nombre: 'Matemáticas'}]
if (teacherAccessMode) {
  user.name = 'Docente de prueba'
  user.roles = ['docente']
  user.institution = {plan: {name: 'Esencial', features: ['nucleo', 'academico']}}
  user.permissions = ['notas.registrar_materia_asignada', 'boletines.grupo.ver', 'boletines.observaciones.gestionar', 'indicadores.grupo.ver', 'indicadores.grupo.editar',
    'asistencia.registrar_clases', 'eventos.publicar_asignados', 'boletines.emisiones.preparar', 'boletines.emisiones.ver', 'notas.gestionar_nivelaciones']
  fixtures['/api/evaluacion/catalogo'].data.can_manage = false
  fixtures['/api/evaluacion/catalogo'].data.can_configure = false
  fixtures['/api/evaluacion/catalogo'].data.can_manage_enrollments = false
  fixtures['/api/evaluacion/catalogo'].data.estados_disponibles = ['activa']
  fixtures['/api/eventos/catalogo'].data.es_rector = false
  fixtures['/api/eventos/catalogo'].data.puede_institucional = false
  fixtures['/api/eventos/catalogo'].data.grupos[0].ano_lectivo_inicio = '2026-01-01'
  fixtures['/api/eventos/catalogo'].data.grupos[0].ano_lectivo_fin = '2026-12-31'
  fixtures['/api/eventos/catalogo'].data.grupos.push({url_token: 'h'.repeat(24), nombre: 'B',
    ano_lectivo_inicio: '2025-01-01', ano_lectivo_fin: '2025-12-31',
    grado: {url_token: sieeTokens.grade, nombre: 'Primero'}})
  fixtures['/api/indicadores'] = {data: {periodo_token: urlTokens.period, indicadores: [], pagina: 1, ultima_pagina: 1, total: 0}}
  fixtures['/api/indicadores/tabla'] = {data: {grupo_token: urlTokens.group, periodo_token: urlTokens.period,
    materias: [{materia_token: urlTokens.materia, materia: 'Matemáticas',
      texto_html: '<p>Resuelve <strong>sumas</strong> sencillas.</p><p>Explica el proceso.</p>',
      version: 1, puede_editar: true}]}}
  fixtures['/api/indicadores/opciones-asignadas'] = {data: {
    anos: [{token: urlTokens.year, nombre: '2026', estado: 'en_curso'}],
    grupos: [{token: urlTokens.group, ano_token: urlTokens.year, grado_token: sieeTokens.grade,
      nombre: 'A', grado_nombre: 'Primero', materias: [{token: urlTokens.materia, nombre: 'Matemáticas'}]}],
    periodos: [{token: closedIndicatorPeriod, ano_token: urlTokens.year, nombre: 'Primer período', orden: 1, estado: 'cerrado'},
      {token: urlTokens.period, ano_token: urlTokens.year, nombre: 'Trimestre 1', orden: 2, estado: 'abierto'}],
  }}
  fixtures[`/api/indicadores/politica/${urlTokens.year}`] = {data: {
    alcance: 'grupo', docente_puede_editar: true, version: 1, configurado: true,
    indicadores_grado: 0, indicadores_grupo: 0,
  }}
  fixtures['/api/boletines/politica'] = {data: {requiere_observacion_final: false,
    docente_edita_indicadores_grupo: true, version: 1}}
  fixtures[`/api/boletines/observaciones/${urlTokens.enrollment}`] = {data: {
    matricula_token: urlTokens.enrollment, politica: {requiere_observacion_final: false, version: 1},
    puede_editar: true, puede_aprobar: false,
    periodos: [{periodo_token: urlTokens.period, nombre: 'Trimestre 1', observacion: null,
      puede_editar: true, motivo_bloqueo: null}], final: null,
  }}
  fixtures[`/api/boletines/emisiones/${urlTokens.enrollment}`] = {data: [], pagina: 1, ultima_pagina: 1, total: 0}
  fixtures[`/api/boletines/emisiones/${urlTokens.enrollment}/emitir`] = {data: {token: 'B'.repeat(24), estado: 'aprobado', pdf_disponible: true}}
  fixtures['/api/asistencias'] = {data: {anos: [{token: urlTokens.year, nombre: '2026', estado: 'en_curso'}],
    ano_lectivo_token: urlTokens.year, asignaciones: [{token: urlTokens.assignment, nombre: 'Matemáticas · Primero / A',
      ano_lectivo_token: urlTokens.year, ano_lectivo_nombre: '2026', grupo_token: urlTokens.group,
      grupo_nombre: 'Primero / A', materia_token: urlTokens.materia, materia_nombre: 'Matemáticas'}]}}
  fixtures['/api/asistencias/planilla'] = {data: {periodos: [{token: urlTokens.period, nombre: 'Trimestre 1', estado: 'abierto'}],
    periodo: {token: urlTokens.period, nombre: 'Trimestre 1', estado: 'abierto'}, estudiantes: [], columnas: []}}
}
if (indicatorScopeMode) {
  fixtures[`/api/indicadores/politica/${urlTokens.year}`] = {data: {
    alcance: 'grado', docente_puede_editar: false, version: 1, configurado: true,
    indicadores_grado: 1, indicadores_grupo: 2,
  }}
  fixtures[`/api/indicadores/contexto/${urlTokens.year}`] = {data: {
    grados: [{token: sieeTokens.grade, nombre: 'Primero'}],
    materias: [{token: urlTokens.materia, nombre: 'Matemáticas'}],
    periodos: [{token: urlTokens.period, nombre: 'Trimestre 1', orden: 1, estado: 'abierto'}],
  }}
  fixtures['/api/indicadores/bases'] = {data: [], meta: {pagina: 1, ultima_pagina: 1, total: 0}}
  fixtures['/api/indicadores/borradores'] = {data: [{texto: 'Reconoce los números del uno al diez.'}]}
  fixtures['/api/indicadores/vinculos'] = {data: [{
    indicador_token: '1'.repeat(24), vinculo_token: '2'.repeat(24),
    texto_base: 'Resuelve sumas sencillas.', version_base: 1,
    texto_vinculado: 'Resuelve sumas sencillas.', revision_vinculada: 1,
    orden: 1, periodos_orden: [1], version_vinculo: 1,
  }], meta: {pagina: 1, ultima_pagina: 1, total: 1}}
  fixtures['/api/indicadores/opciones-asignadas'] = {data: {
    anos: [{token: urlTokens.year, nombre: '2026', estado: 'en_curso'}],
    grupos: [{token: urlTokens.group, ano_token: urlTokens.year, grado_token: sieeTokens.grade,
      nombre: 'A', grado_nombre: 'Primero', materias: [{token: urlTokens.materia, nombre: 'Matemáticas'}]}],
    periodos: [{token: urlTokens.period, ano_token: urlTokens.year, nombre: 'Trimestre 1', orden: 1, estado: 'abierto'}],
  }}
  fixtures['/api/indicadores'] = {data: {periodo_token: urlTokens.period, indicadores: [], pagina: 1,
    ultima_pagina: 1, total: 0}}
}
if (indicatorSheetMode) {
  fixtures[`/api/indicadores/politica/${urlTokens.year}`] = {data: {
    alcance: 'grupo', docente_puede_editar: true, version: 1, configurado: true,
    indicadores_grado: 0, indicadores_grupo: 0,
  }}
  fixtures['/api/indicadores/opciones-asignadas'] = {data: {
    anos: [{token: urlTokens.year, nombre: '2026', estado: 'en_curso'}],
    grupos: [{token: urlTokens.group, ano_token: urlTokens.year, grado_token: sieeTokens.grade,
      nombre: 'A', grado_nombre: 'Primero', materias: [
        {token: urlTokens.materia, nombre: 'Matemáticas'}, {token: 'z'.repeat(24), nombre: 'Lenguaje'},
      ]}, {token: urlTokens.groupB, ano_token: urlTokens.year, grado_token: sieeTokens.grade,
      nombre: 'B', grado_nombre: 'Primero', materias: [{token: urlTokens.materia, nombre: 'Matemáticas'}]}],
    periodos: [{token: urlTokens.period, ano_token: urlTokens.year, nombre: 'Trimestre 1', orden: 1, estado: 'abierto'}],
  }}
  fixtures['/api/indicadores/tabla'] = {data: {grupo_token: urlTokens.group, periodo_token: urlTokens.period,
    materias: [{materia_token: 'z'.repeat(24), materia: 'Lenguaje', texto_html: '', version: 0, puede_editar: true},
      {materia_token: urlTokens.materia, materia: 'Matemáticas', texto_html: '<ul><li>Resuelve <strong>sumas</strong>.</li><li>Explica el proceso.</li></ul>',
        version: 1, puede_editar: true}]}}
}
if (aulaMode || eventsMode) {
  user.permissions.push('aula.ver_todas', 'aula.recursos.gestionar')
  const aulaToken = 'y'.repeat(24), resourceToken = 'z'.repeat(24), quizToken = 'q'.repeat(24)
  const preOne = 'p'.repeat(24), preTwo = 'r'.repeat(24)
  const attachments = [{token: 'f'.repeat(24), nombre: 'Guía de lectura.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', es_imagen: false},
  {token: 'g'.repeat(24), nombre: 'Presentación de clase.pptx',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', es_imagen: false}]
  fixtures['/api/aula/catalogo'] = {data: {anos: [{token: urlTokens.year, nombre: '2026', estado: 'en_curso'}],
    ano_token: urlTokens.year, grupos: [{token: urlTokens.group, nombre: '01A', grado: 'Primero', etiqueta: 'Primero / 01A'}],
    requiere_grupo: true, grupo_seleccionado: null,
    aulas: [{aula_token: aulaToken, grupo_token: urlTokens.group, grupo: 'Primero / 01A',
      materia_token: urlTokens.materia, materia: 'Matemáticas', docente: 'Docente de prueba', portada_token: null}],
     puede_gestionar: true, puede_configurar: true}}
   fixtures['/api/aula/configuracion'] = {data: {permitir_edicion_periodos_cerrados: true,
     colores_periodos: {'1': '#2563eb', '2': '#0891b2', '3': '#7c3aed', '4': '#d97706'},
     color_preinforme: '#64748b', puede_configurar_colores: true,
     periodos_configurables: [{orden: 1, nombre: 'Primer período'}, {orden: 2, nombre: 'Período cerrado'}]}}
  fixtures[`/api/aula/${aulaToken}`] = {data: {token: aulaToken, grupo: 'Primero / 01A', materia: 'Matemáticas',
     portada_token: null, estudiante: false, puede_gestionar: true, limite_archivo_bytes: 26214400,
     permitir_edicion_periodos_cerrados: true,
     colores_periodos: {'1': '#2563eb', '2': '#0891b2', '3': '#7c3aed', '4': '#d97706'},
     color_preinforme: '#64748b',
    permisos: {crear: true, editar: true, publicar: true, archivar: true, eliminar: true, evaluaciones: true},
    periodos: [{token: urlTokens.period, nombre: 'Primer período', orden: 1, estado: 'abierto',
      preinformes: [{token: preOne, nombre: 'Primer preinforme'}, {token: preTwo, nombre: 'Segundo preinforme'}]},
    {token: 'c'.repeat(24), nombre: 'Período cerrado', orden: 2, estado: 'cerrado', preinformes: []}],
    secciones: [{token: 's'.repeat(24), titulo: 'Semana 1', periodo: 'Primer período', periodo_token: urlTokens.period,
      preinforme_token: preOne, visible_estudiantes: true, orden: 1,
      recursos: [{token: resourceToken, tipo: 'texto', titulo: 'Guía de lectura', estado: 'publicado',
        visible_estudiantes: true, calificable: false, llevar_planilla: false, actividad_token: null,
        contenido: {bloques: [{tipo: 'tarjeta', texto: 'Lee con atención.'},
          {tipo: 'enlace', texto: 'Biblioteca', url: 'https://example.org/biblioteca'}]},
        version: 1, seccion_token: 's'.repeat(24), adjuntos: attachments},
      {token: quizToken, tipo: 'cuestionario', titulo: 'Evaluación de lectura', estado: 'publicado',
        visible_estudiantes: true, calificable: true, llevar_planilla: false, actividad_token: null}]},
    {token: 't'.repeat(24), titulo: 'Semana 2 sin recursos', periodo: 'Primer período', periodo_token: urlTokens.period,
      preinforme_token: preTwo, visible_estudiantes: true, orden: 2, recursos: []}]}}
  fixtures['/api/aula/secciones/' + 's'.repeat(24) + '/planilla'] = {data: {componentes: [], requiere_preinforme: false}}
  fixtures[`/api/aula/recursos/${resourceToken}`] = {data: {token: resourceToken, tipo: 'texto',
    aula_token: aulaToken, seccion_token: 's'.repeat(24),
    titulo: 'Guía de lectura', contenido: {bloques: [{tipo: 'tarjeta', texto: 'Lee con atención.'},
      {tipo: 'enlace', texto: 'Biblioteca', url: 'https://example.org/biblioteca'}]}, estado: 'publicado',
    visible_estudiantes: true, calificable: false, llevar_planilla: false, actividad_token: null, peso: null,
    disponible_desde: null, disponible_hasta: null, fecha_limite: null, zona_publicacion: 'America/Bogota',
    version: 1, adjuntos: attachments, estudiante: false, puede_gestionar: true, puede_adjuntar: true, puede_calificar: false,
    puede_evaluar: false, puede_interactuar: false}}
  fixtures[`/api/aula/recursos/${quizToken}`] = {data: {token: quizToken, aula_token: aulaToken,
    seccion_token: 's'.repeat(24), tipo: 'cuestionario', titulo: 'Evaluación de lectura',
    contenido: {bloques: []}, estado: 'publicado', visible_estudiantes: true, calificable: true,
    llevar_planilla: false, actividad_token: null, peso: null, disponible_desde: null, disponible_hasta: null,
    fecha_limite: null, zona_publicacion: 'America/Bogota', version: 1, adjuntos: [], estudiante: false,
    puede_gestionar: true, puede_calificar: true, puede_evaluar: true, puede_interactuar: false,
    preguntas: [{token: 'p'.repeat(24), tipo: 'unica', enunciado: '¿Cuál es la idea principal del texto?',
      opciones: ['La naturaleza', 'La amistad'], respuesta_correcta: {valor: 'La amistad'}, puntos: '2'}]}}
  fixtures[`/api/aula/recursos/${quizToken}/intentos`] = {data: []}
}
if (workflowMode) {
  const catalog = fixtures[sieePath].data
  fixtures['/api/estructura/niveles'] = {data: [{id: 1, ano_lectivo_id: 1, nombre: 'Básica Primaria', nivel_educativo: 'primaria', estado: 'activo'}]}
  fixtures['/api/plan-estudios/materias'].data.push({id: 2, ano_lectivo_id: 1, area_id: 1, nivel_id: 1, nombre: 'Geometría', intensidad_horaria: 3, estado: 'activo'})
  catalog.grados.push({url_token: '2'.repeat(24), nombre: 'Segundo', nivel_token: sieeTokens.level, estado: 'activo'},
    {url_token: '3'.repeat(24), nombre: 'Transición', nivel_token: '4'.repeat(24), estado: 'activo'})
  catalog.materias.push({url_token: '5'.repeat(24), nombre: 'Lectura inicial', nivel_token: '4'.repeat(24), area_token: sieeTokens.area, estado: 'activo'},
    {url_token: '6'.repeat(24), nombre: 'Geometría', nivel_token: sieeTokens.level, area_token: sieeTokens.area, estado: 'activo'})
}
if (paginationMode) {
  user.permissions.push('boletines.emisiones.ver')
  fixtures[sieePath].data.configuracion.usar_areas = true
  fixtures[sieePath].data.configuracion.modo_area = 'WEIGHTED_AVERAGE'
  fixtures['/api/plan-estudios/areas'].data = Array.from({length: 25}, (_, index) => ({id: index + 1, ano_lectivo_id: 1, nombre: `Área ${String(index + 1).padStart(2, '0')}`, descripcion: null, estado: 'activo'}))
  fixtures[sieePath].data.editable = false
  fixtures[sieePath].data.areas = [{url_token: sieeTokens.area, nombre: 'Ciencias'}]
  fixtures[sieePath].data.materias = Array.from({length: 25}, (_, index) => ({
    url_token: `v${String(index + 1).padStart(23, '0')}`, nombre: `Materia ${String(index + 1).padStart(2, '0')}`,
    nivel_token: index === 11 ? 'z'.repeat(24) : index === 1 ? null : sieeTokens.level,
    area_token: sieeTokens.area, area: {url_token: sieeTokens.area, nombre: 'Ciencias'}, estado: 'activo',
  }))
  fixtures[sieeCurriculumPath] = {data: fixtures[sieePath].data.materias.map(materia => ({grado_token: sieeTokens.grade, materia_token: materia.url_token, area_token: sieeTokens.area, grado_nombre: 'Primero', materia_nombre: materia.nombre, area_nombre: 'Ciencias', peso_area: null}))}
  fixtures['/api/evaluacion/catalogo'].data.asignaciones = Array.from({length: 12}, (_, index) => ({
    ...assignment, id: index + 1,
    url_token: index === 0 ? urlTokens.assignment : `${'h'.repeat(22)}${String(index + 1).padStart(2, '0')}`,
    materia_id: index + 1, materia: {id: index + 1, nombre: `Materia ${String(index + 1).padStart(2, '0')}`},
  }))
  fixtures['/api/evaluacion/catalogo'].data.matriculas = Array.from({length: 12}, (_, index) => ({
    ...enrollment, id: index + 1, estudiante_id: index + 2,
    url_token: index === 0 ? urlTokens.enrollment : `${'k'.repeat(22)}${String(index + 1).padStart(2, '0')}`,
    estudiante: {id: index + 2, name: `Estudiante ${String(index + 1).padStart(2, '0')}`},
  }))
  fixtures['/api/evaluacion/catalogo'].data.estudiantes_disponibles = Array.from({length: 12}, (_, index) => ({id: index + 100, name: `Alumno ${String(index + 1).padStart(2, '0')}`}))
  fixtures['/api/evaluacion/planillas/1/1'].data.matriculas = fixtures['/api/evaluacion/catalogo'].data.matriculas
  fixtures['/api/evaluacion/planillas/1/1'].data.resultados = fixtures['/api/evaluacion/catalogo'].data.matriculas.map(matricula => ({matricula_id: matricula.id, estado: 'pendiente', motivo: 'Faltan notas'}))
}
const writes = []
if (gradingMode) {
  user.permissions.push('academico.preinformes.ver', 'academico.preinformes.gestionar')
  const sheet = fixtures['/api/evaluacion/planillas/1/1'].data
  sheet.componentes[0].nombre = 'Primer avance'
  sheet.componentes.push({...sheet.componentes[0], id: 2, nombre: 'Segundo avance', actividades: [{id: 2, componente_id: 2, nombre: 'Exposición', fecha: today, peso: null}]})
  sheet.matriculas = [enrollment, {...enrollment, id: 2, url_token: publicToken('matricula', 2), estudiante: {id: 4, name: 'Santiago López'}}]
  fixtures['/api/preinformes'] = {data: {anos: [opaqueRecord(year, 'ano_lectivo')], ano: opaqueRecord(year, 'ano_lectivo'), incluido_plan: true, puede_gestionar: true,
    periodos: [{...opaqueRecord(period, 'periodo'), version: 1, editable: true, configuracion: {usar_preinformes: true, modo: 'SIMPLE_AVERAGE', fechas_estrictas: false},
      preinformes: [{url_token: 'p'.repeat(24), nombre: 'Primer avance', peso: null, fecha_inicio: null, fecha_fin: null}, {url_token: 'q'.repeat(24), nombre: 'Segundo avance', peso: null, fecha_inicio: null, fecha_fin: null}]}]}}
}
const auditReads = []
const scheduleReads = []
const pagedReads = []
const paged = (rows, requestedPage, requestedPerPage) => {
  const page = rows.length <= 20 ? 1 : requestedPage
  const perPage = rows.length <= 20 ? 20 : requestedPerPage
  return {data: rows.slice((page - 1) * perPage, page * perPage),
    meta: {current_page: page, per_page: perPage, last_page: Math.max(1, Math.ceil(rows.length / perPage)), total: rows.length}}
}
let server, browser, socket
const eventFixture = eventsMode || teacherAccessMode ? eventsFixture(event, fixtures['/api/eventos/catalogo'].data, today) : null
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  server = await createServer({root, logLevel: 'error', server: {host: '127.0.0.1', port: 5197, strictPort: true}, plugins: [{name: 'smoke-api', configureServer(vite) {
    if (intakeFixture) vite.middlewares.use(intakeFixture.middleware)
    if (eventFixture) vite.middlewares.use(eventFixture.middleware)
    vite.middlewares.use((req, res, next) => {
      const url = new URL(req.url, 'http://localhost')
      if (aulaMode && url.pathname === '/office/web-apps/apps/api/documents/api.js') {
        res.setHeader('Content-Type', 'application/javascript')
        res.end(`window.DocsAPI={DocEditor:class{constructor(id,config){const place=document.getElementById(id);const frame=document.createElement('iframe');frame.title=config.document.title;frame.srcdoc='<main style="font-family:sans-serif;padding:2rem">Vista de '+config.document.title+'</main>';place.replaceWith(frame);this.frame=frame}destroyEditor(){this.frame?.remove()}}}`)
        return
      }
      if (!url.pathname.startsWith('/api')) return next()
      if (req.method === 'GET') {
        apiReads.push(url.pathname)
        detailedReads.push(url.pathname + url.search)
      } else apiWrites.push(url.pathname)
      if (rbacMode && req.method === 'GET' && url.pathname === '/api/rbac/roles') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(rbacFixture))
        return
      }
      if (rbacCatalogFixture && req.method === 'GET' && url.pathname === '/api/rbac/catalog') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(rbacCatalogFixture))
        return
      }
      if (aulaMode && req.method === 'GET' && /^\/api\/aula\/adjuntos\/[A-Za-z0-9_-]{24}\/vista-oficina$/.test(url.pathname)) {
        const pptx = url.pathname.includes('/' + 'g'.repeat(24) + '/')
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({data: {script_url: 'http://127.0.0.1:5197/office/web-apps/apps/api/documents/api.js',
          config: {token: 'signed-test-config', documentType: pptx ? 'slide' : 'word',
            document: {fileType: pptx ? 'pptx' : 'docx', title: pptx ? 'Presentación de clase.pptx' : 'Guía de lectura.docx'}}}}))
        return
      }
      if (aulaMode && req.method === 'GET' && /^\/api\/aula\/adjuntos\/[A-Za-z0-9_-]{24}\/medio$/.test(url.pathname)) {
        res.setHeader('Content-Type', 'application/pdf')
        res.end(samplePdf())
        return
      }
      const opaqueAcademic = url.searchParams.get('opaque') === '1' && (url.pathname.startsWith('/api/estructura/') || url.pathname.startsWith('/api/plan-estudios/'))
      const opaqueEval = url.searchParams.get('opaque') === '1' && url.pathname.startsWith('/api/evaluacion/')
      const opaqueTimetable = url.searchParams.get('opaque') === '1' && url.pathname === '/api/horarios'
      const scheduleRoute = /^\/api\/(horarios|asignaciones)(\/[^/]+)?$/.test(url.pathname)
      const opaqueCalendar = url.searchParams.get('opaque') === '1' &&
        (url.pathname.startsWith('/api/anos-lectivos') || url.pathname.startsWith('/api/periodos/'))
      if (opaqueAcademic) assert.ok([...url.searchParams.keys()].every(key => !key.endsWith('_id')), 'Opaque academic queries cannot carry numeric foreign keys.')
      if (opaqueEval) assert.ok([...url.searchParams.keys()].every(key => !key.endsWith('_id')), 'Opaque evaluation queries cannot carry numeric foreign keys.')
      if (opaqueTimetable) assert.ok([...url.searchParams.keys()].every(key => !key.endsWith('_id')), 'Opaque timetable queries cannot carry numeric foreign keys.')
      if (scheduleRoute) {
        assert.equal(url.searchParams.get('opaque'), '1', 'Schedule requests must use the opaque API contract.')
        const routeSelector = url.pathname.split('/')[3]
        if (routeSelector) assert.match(routeSelector, /^[A-Za-z0-9_-]{24}$/, 'Schedule routes must use an opaque selector.')
      }
      console.log('Fixture', req.method, url.pathname)
      if (url.pathname === '/api/platform/auditoria') auditReads.push(url.searchParams.get('colegio_slug'))
      const annualStructure = ['/api/estructura/jornadas', '/api/estructura/bloques-horarios', '/api/plan-estudios/areas', '/api/plan-estudios/materias']
      let fixture = annualStructure.includes(url.pathname) && (url.searchParams.get('ano_lectivo_id') === '2' || url.searchParams.get('ano_lectivo_token') === urlTokens.nextYear)
        ? {data: []} : fixtures[url.pathname]
      if (teacherAccessMode && req.method === 'GET' && url.pathname === '/api/boletines/observaciones/grupo') {
        assert.equal(url.searchParams.get('grupo_token'), urlTokens.group)
        assert.equal(url.searchParams.get('periodo_token'), urlTokens.period)
        const catalog = fixtures[`/api/boletines/observaciones/${urlTokens.enrollment}`].data
        const row = catalog.periodos[0]
        fixture = {data: {grupo_token: urlTokens.group, periodo_token: urlTokens.period,
          puede_editar: catalog.puede_editar && row.puede_editar, motivo_bloqueo: row.motivo_bloqueo,
          matriculas: [{matricula_token: urlTokens.enrollment, observacion: row.observacion}]}}
      }
      if (teacherAccessMode && req.method === 'GET' && url.pathname === '/api/indicadores/tabla'
        && url.searchParams.get('periodo_token') === closedIndicatorPeriod) {
        fixture = {data: {...fixture.data, periodo_token: closedIndicatorPeriod,
          materias: fixture.data.materias.map(row => ({...row, puede_editar: false}))}}
      }
      if (url.pathname === opaquePlanillaPath) fixture = fixtures['/api/evaluacion/planillas/1/1']
      if (url.pathname === opaqueBoletinPath) fixture = fixtures['/api/evaluacion/boletines/1']
      if (url.pathname === `/api/anos-lectivos/${urlTokens.year}/periodos`) fixture = fixtures['/api/anos-lectivos/1/periodos']
      if (url.pathname === promotionPath && req.method === 'GET') fixture = fixtures[promotionPath]
      if (url.pathname === `/api/anos-lectivos/${urlTokens.nextYear}/estado-copia`) {
        const {origen_id: _origin, ...status} = fixtures['/api/anos-lectivos/2/estado-copia'].data
        fixture = {data: {...status, origen_token: urlTokens.year}}
      }
      if (url.pathname === '/api/catalogos-academicos' && req.method === 'GET') {
        const opaque = url.searchParams.get('opaque') === '1'
        const catalogs = {
          grupos: opaque ? opaqueRecord([group, groupB, groupC, ...extraGroups, groupPre], 'grupo') : [group, groupB, groupC, ...extraGroups, groupPre],
          docentes: opaque ? opaqueRecord(fixtures['/api/horarios'].data.docentes, 'usuario') : fixtures['/api/horarios'].data.docentes,
          espacios: opaque ? opaqueRecord(fixtures['/api/horarios'].data.espacios, 'espacio_fisico') : fixtures['/api/horarios'].data.espacios,
          materias: opaque ? fixtures[sieePath].data.materias : fixtures['/api/horarios'].data.materias,
          grados: [group.grado],
          areas: fixtures['/api/plan-estudios/areas'].data,
          estudiantes: [],
        }
        if (opaque) {
          assert.equal(url.searchParams.get('ano_lectivo_token'), urlTokens.year, 'Opaque catalog requests must use the year token.')
          catalogs.grados = fixtures[sieePath].data.grados
          catalogs.areas = fixtures[sieePath].data.areas
        }
        const page = Math.max(1, Number(url.searchParams.get('page') || 1))
        const perPage = Math.max(1, Number(url.searchParams.get('per_page') || 5))
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const compatibleGroup = [group, groupB, groupC, ...extraGroups, groupPre].find(item => item.url_token === url.searchParams.get('compatible_grupo_token'))
        const compatibleLevel = compatibleGroup ? (compatibleGroup.grado.nivel_id === 2 ? '4'.repeat(24) : sieeTokens.level) : opaque ? url.searchParams.get('compatible_nivel_token') : Number(url.searchParams.get('compatible_nivel_id'))
        const curriculumGrade = compatibleGroup?.grado.nivel_id === 2 ? '3'.repeat(24) : sieeTokens.grade
        const enrolledSubjects = new Set(fixtures[sieeCurriculumPath].data.filter(row => row.grado_token === curriculumGrade).map(row => row.materia_token))
        const rows = (catalogs[url.searchParams.get('tipo')] || []).filter(item =>
          (item.nombre || item.name || '').toLocaleLowerCase().includes(search)
          && (!compatibleLevel || (opaque ? (item.nivel_token == null || item.nivel_token === compatibleLevel) : (item.nivel_id == null || item.nivel_id === compatibleLevel)))
          && (!compatibleGroup || url.searchParams.get('tipo') !== 'materias' || enrolledSubjects.has(item.url_token)))
        const data = rows.slice((page - 1) * perPage, page * perPage)
        const selectedId = opaque ? url.searchParams.get('selected_token') : Number(url.searchParams.get('selected_id'))
        const optionKey = opaque ? 'url_token' : 'id'
        const selected = rows.find(item => item[optionKey] === selectedId)
        if (selected && !data.some(item => item[optionKey] === selectedId)) data.push(selected)
        fixture = {data, meta: {current_page: page, per_page: perPage,
          last_page: Math.max(1, Math.ceil(rows.length / perPage)), total: rows.length}}
      }
      if (workflowMode && url.pathname === '/api/plan-estudios/materias' && req.method === 'GET' && url.searchParams.get('ano_lectivo_token') === urlTokens.year) {
        const levelToken = url.searchParams.get('nivel_token')
        const rows = fixtures[url.pathname].data.filter(item => url.searchParams.get('nivel_general') === '1'
          ? item.nivel_id === null : levelToken ? publicToken('nivel', item.nivel_id) === levelToken : true)
        fixture = paged(rows, Number(url.searchParams.get('page') || 1), Number(url.searchParams.get('per_page') || 20))
      }
      if (paginationMode && url.pathname === '/api/plan-estudios/areas' && req.method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1))
        const perPage = Number(url.searchParams.get('per_page') || 20)
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const rows = fixtures[url.pathname].data.filter(item => item.nombre.toLocaleLowerCase().includes(search))
        pagedReads.push({page, perPage, search})
        fixture = paged(rows, page, perPage)
      }
      if (paginationMode && url.pathname === sieeCurriculumPath && req.method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1))
        const requestedPerPage = Number(url.searchParams.get('per_page') || 20)
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const rows = fixtures[url.pathname].data.filter(item => fixtures[sieePath].data.materias.find(materia => materia.url_token === item.materia_token)?.nombre.toLocaleLowerCase().includes(search))
        const perPage = rows.length <= 20 ? 20 : requestedPerPage
        pagedReads.push({path: url.pathname, page, perPage: requestedPerPage, search})
        fixture = {data: rows.slice((page - 1) * perPage, page * perPage), meta: {current_page: page, per_page: perPage, last_page: Math.max(1, Math.ceil(rows.length / perPage)), total: rows.length}}
      }
      if (paginationMode && url.pathname === '/api/evaluacion/catalogo' && req.method === 'GET') {
        const source = fixture.data
        const assignmentPage = Math.max(1, Number(url.searchParams.get('asignaciones_page') || 1))
        const assignmentPerPage = Number(url.searchParams.get('asignaciones_per_page') || 20)
        const enrollmentPage = Math.max(1, Number(url.searchParams.get('matriculas_page') || 1))
        const enrollmentPerPage = Number(url.searchParams.get('matriculas_per_page') || 20)
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const studentSearch = (url.searchParams.get('student_search') || '').toLocaleLowerCase()
        const assignments = source.asignaciones.filter(item => item.materia.nombre.toLocaleLowerCase().includes(search))
        const enrollments = source.matriculas
        const students = source.estudiantes_disponibles.filter(item => item.name.toLocaleLowerCase().includes(studentSearch))
        const assignmentSlice = paged(assignments, assignmentPage, assignmentPerPage)
        const enrollmentSlice = url.searchParams.get('vista') === 'boletines' && url.searchParams.has('ano_lectivo_token')
          ? {data: enrollments, meta: {current_page: 1, per_page: enrollments.length, last_page: 1, total: enrollments.length}}
          : paged(enrollments, enrollmentPage, enrollmentPerPage)
        pagedReads.push({path: url.pathname, assignmentPage, assignmentPerPage, enrollmentPage, enrollmentPerPage, search, studentSearch})
        fixture = {data: {...source,
          asignaciones: assignmentSlice.data,
          matriculas: enrollmentSlice.data,
          selected_asignacion: source.asignaciones.find(item => item.url_token === url.searchParams.get('asignacion_token')) ?? null,
          selected_matricula: source.matriculas.find(item => item.url_token === url.searchParams.get('matricula_token')) ?? null,
          estudiantes_disponibles: students,
          pagination: {asignaciones: assignmentSlice.meta, matriculas: enrollmentSlice.meta},
        }}
      }
      if (aulaMode && url.pathname === '/api/aula/catalogo' && req.method === 'GET') {
        const chosen = url.searchParams.get('grupo_token')
        fixture = {data: {...fixture.data, grupo_seleccionado: chosen,
          aulas: chosen === urlTokens.group ? fixture.data.aulas : []}}
      }
      if (paginationMode && (url.pathname === '/api/evaluacion/planillas/1/1' || url.pathname === opaquePlanillaPath) && req.method === 'GET') {
        const source = fixture.data
        pagedReads.push({path: url.pathname, page: url.searchParams.get('page'), perPage: url.searchParams.get('per_page')})
        fixture = {data: {...source,
          pagination: {matriculas: {current_page: 1, per_page: source.matriculas.length, last_page: 1, total: source.matriculas.length}},
        }}
      }
      if (url.pathname === '/api/horarios') {
        const groupId = url.searchParams.get(opaqueTimetable ? 'grupo_token' : 'grupo_id')
        const teacherId = url.searchParams.get(opaqueTimetable ? 'docente_token' : 'docente_id')
        const subjectId = url.searchParams.get(opaqueTimetable ? 'materia_token' : 'materia_id')
        scheduleReads.push({view: url.searchParams.get('vista'), group: groupId, teacher: teacherId})
        const matches = (resource, id, selected) => !selected || (opaqueTimetable ? publicToken(resource, id) === selected : String(id) === selected)
        const assignments = fixture.data.asignaciones.filter(item => matches('grupo', item.grupo_id, groupId)
          && matches('docente', item.docente_id, teacherId) && matches('materia', item.materia_id, subjectId))
        const sessions = fixture.data.sesiones.filter(item => matches('grupo', item.grupo_id, groupId)
          && matches('docente', item.docente_id, teacherId) && matches('materia', item.materia_id, subjectId))
        if (url.searchParams.has('page')) {
          const page = Math.max(1, Number(url.searchParams.get('page') || 1))
          const perPage = Number(url.searchParams.get('per_page') || 20)
          const pageData = paged(assignments, page, perPage)
          fixture = {data: {...fixture.data,
            asignaciones: pageData.data,
            pagination: {asignaciones: pageData.meta},
          }}
        }
        if (url.searchParams.get('vista') === 'horarios') {
          fixture = {data: {...fixture.data,
            asignaciones: groupId ? assignments : [],
            sesiones: groupId ? sessions : [],
          }}
        } else if (!url.searchParams.has('page') && (groupId || teacherId)) {
          const subjectIds = new Set([...assignments, ...sessions].map(item => item.materia_id))
          fixture = {data: {...fixture.data, asignaciones: assignments, sesiones: sessions,
            counts: {materias: subjectIds.size, sesiones: sessions.length},
            pagination: {asignaciones: {current_page: 1, per_page: 5, last_page: 1, total: assignments.length}},
          }}
        }
      }
      const respond = () => {
        res.setHeader('Content-Type', 'application/json')
        const response = fixture ?? {data: [], meta: {total: 0, current_page: 1, last_page: 1}}
        const exposed = opaqueCalendar && url.pathname === '/api/anos-lectivos' && 'data' in response
          ? {...response, data: opaqueRecord(response.data, 'ano_lectivo')}
          : opaqueCalendar && url.pathname.endsWith('/periodos') && 'data' in response
            ? {...response, data: opaqueRecord(response.data, 'periodo')}
            : opaqueAcademic && 'data' in response
          ? {...response, data: opaqueRecord(response.data, academicResource(url.pathname))}
          : opaqueEval ? opaqueEvaluation(url.pathname, response)
            : opaqueTimetable ? opaqueSchedule(response) : response
        if (opaqueEval || opaqueTimetable || opaqueCalendar) assert.ok(!hasPrivateIdKey(exposed), 'Opaque response cannot contain private IDs.')
        res.end(JSON.stringify(exposed))
      }
      if (req.method === 'GET') return respond()
      let body = ''
      req.on('data', chunk => {body += chunk})
      req.on('end', () => {
        const parsed = req.headers['content-type']?.includes('application/json') ? JSON.parse(body || '{}') : Object.fromEntries(new URLSearchParams(body))
        if (teacherAccessMode && req.method === 'PUT' && url.pathname === `/api/boletines/observaciones/${urlTokens.enrollment}`) {
          assert.equal(parsed.periodo_token, urlTokens.period)
          const observation = {...parsed, estado: 'borrador', version: parsed.version + 1, autor: 'Docente de prueba'}
          fixtures[url.pathname].data.periodos[0].observacion = observation
          fixture = {data: observation}
        }
        if (teacherAccessMode && url.pathname === `/api/boletines/emisiones/${urlTokens.enrollment}/emitir`) {
          assert.equal(parsed.periodo_token, urlTokens.period)
          assert.equal(parsed.contexto, 'periodo')
        }
        if (teacherAccessMode && url.pathname === '/api/evaluacion/recuperaciones' && req.method === 'POST') {
          assert.equal(parsed.periodo_token, urlTokens.period)
          assert.equal(parsed.asignacion_token, urlTokens.assignment)
          const row = {url_token: 'R'.repeat(24), matricula_token: urlTokens.enrollment,
            asignacion_token: urlTokens.assignment, periodo_token: urlTokens.period, materia: 'Matemáticas',
            periodo: 'Trimestre 1', tipo: 'nivelacion', estado: 'pendiente', politica: 'REPLACE', version: 1,
            valor_original_exacto: '2', nota_recuperacion: null, valor_efectivo_exacto: null,
            can_record: true, can_cancel: true, motivo_bloqueo: null}
          fixtures['/api/evaluacion/recuperaciones'].data = [row]
          fixtures['/api/evaluacion/recuperaciones'].candidatos = []
          fixture = {data: row}
        }
        if (teacherAccessMode && url.pathname === `/api/evaluacion/recuperaciones/${'R'.repeat(24)}` && req.method === 'PUT') {
          assert.equal(parsed.version, 1)
          const row = fixtures['/api/evaluacion/recuperaciones'].data[0]
          Object.assign(row, {nota_recuperacion: parsed.nota_recuperacion, valor_efectivo_exacto: parsed.nota_recuperacion,
            estado: 'aprobada', version: 2})
          fixture = {data: row}
        }
        if (teacherAccessMode && req.method === 'PUT' && url.pathname === `/api/indicadores/tabla/${urlTokens.materia}`) {
          assert.equal(parsed.grupo_token, urlTokens.group)
          assert.equal(parsed.periodo_token, urlTokens.period)
          indicatorSheetWrites.push(parsed)
          const row = fixtures['/api/indicadores/tabla'].data.materias[0]
          Object.assign(row, {texto_html: parsed.texto_html, version: row.version + 1})
          fixture = {data: row}
        }
        if (academicCacheMode && req.method === 'PUT' && url.pathname === '/api/asistencias') {
          const column = fixtures['/api/asistencias/planilla'].data.columnas[0]
          assert.equal(parsed.sesion_token, column.sesion_token)
          assert.equal(parsed.version, column.version)
          column.marcas = Object.fromEntries(parsed.marcas.map(item => [item.matricula_token, item.estado]))
          column.version++; column.registrada = true
          fixture = {data: {guardado: true}}
        }
        if (teacherAccessMode && req.method === 'DELETE' && url.pathname === `/api/indicadores/tabla/${urlTokens.materia}`) {
          assert.equal(url.searchParams.get('grupo_token'), urlTokens.group)
          assert.equal(url.searchParams.get('periodo_token'), urlTokens.period)
          const row = fixtures['/api/indicadores/tabla'].data.materias[0]
          assert.equal(Number(url.searchParams.get('version')), row.version)
          indicatorSheetDeletes.push(url.pathname)
          Object.assign(row, {texto_html: '', version: row.version + 1})
          fixture = {data: row}
        }
         if (aulaMode && url.pathname === `/api/aula/recursos/${'z'.repeat(24)}/abrir`) {
          fixtures[`/api/aula/recursos/${'z'.repeat(24)}`].data.progreso = 'completado'
          fixture = {data: {progreso: 'completado', aula_token: 'y'.repeat(24),
            resumen: {completados: 1, total: 2, porcentaje: 50}}}
         }
         if (aulaMode && url.pathname === '/api/aula/configuracion' && req.method === 'PUT') {
           fixtures['/api/aula/configuracion'].data = {...fixtures['/api/aula/configuracion'].data, ...parsed}
           fixtures[`/api/aula/${'y'.repeat(24)}`].data.permitir_edicion_periodos_cerrados = parsed.permitir_edicion_periodos_cerrados
           fixtures[`/api/aula/${'y'.repeat(24)}`].data.colores_periodos = parsed.colores_periodos
           fixtures[`/api/aula/${'y'.repeat(24)}`].data.color_preinforme = parsed.color_preinforme
           fixture = {data: parsed}
         }
        if (aulaMode && url.pathname === `/api/aula/recursos/${'z'.repeat(24)}/adjuntos` && req.method === 'POST') {
          const attachment = {token: 'n'.repeat(24), nombre: 'Material adicional.pdf', mime: 'application/pdf', es_imagen: false}
          fixtures[`/api/aula/recursos/${'z'.repeat(24)}`].data.adjuntos.push(attachment)
          fixture = {data: attachment}
        }
        if (aulaMode && url.pathname === `/api/aula/recursos/${'z'.repeat(24)}` && req.method === 'PUT') {
          const resource = fixtures[`/api/aula/recursos/${'z'.repeat(24)}`].data
          Object.assign(resource, parsed, {version: resource.version + 1})
          const summary = fixtures[`/api/aula/${'y'.repeat(24)}`].data.secciones[0].recursos[0]
          Object.assign(summary, resource)
          fixture = {data: resource}
        }
        if (opaqueAcademic) assert.ok(!Object.keys(parsed).some(key => key.endsWith('_id')), 'Opaque academic writes cannot carry numeric foreign keys.')
        if (opaqueEval) assert.ok(!hasPrivateIdKey(parsed), 'Opaque evaluation writes cannot carry private IDs.')
        if (scheduleRoute) assert.ok(!hasPrivateIdKey(parsed), 'Opaque schedule writes cannot carry private IDs.')
        if (opaqueCalendar) assert.ok(!hasPrivateIdKey(parsed), 'Opaque calendar writes cannot carry private IDs.')
        if (url.pathname === '/api/account/profile') { Object.assign(user, parsed); fixture = {message: 'Perfil actualizado.', user} }
        if (url.pathname === `${promotionPath}/politica` && req.method === 'PUT') {
          assert.equal(parsed.version, 0)
          fixtures[promotionPath].politica = {...parsed, version: 1}
          fixture = {data: {version: 1}}
        }
        if (url.pathname === `${promotionPath}/${urlTokens.enrollment}` && req.method === 'PUT') {
          assert.equal(parsed.huella, 'f'.repeat(64))
          assert.equal(parsed.resultado, 'promovido')
          assert.equal(parsed.grado_destino_token, 'u'.repeat(24))
          fixtures[promotionPath].data[0].decision = {resultado: 'promovido', grado_destino_token: 'u'.repeat(24),
            motivo: parsed.motivo, version: 1, vigente: true, aprobada_en: new Date().toISOString()}
          fixture = {data: {resultado: 'promovido', version: 1}}
        }
        if (url.pathname === '/api/mfa/setup') fixture = {secret: 'JBSWY3DPEHPK3PXP', otpauth_url: 'otpauth://totp/Colegio%20SaaS:rector%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Colegio%20SaaS&algorithm=SHA1&digits=6&period=30'}
        if (url.pathname === '/api/mfa/confirm') {user.mfa_enabled = true; fixture = {mfa_enabled: true, recovery_codes: ['aaaaa-bbbbb-ccccc-ddddd','11111-22222-33333-44444']}}
        if (paginationMode && url.pathname === sieeCurriculumPath) {
          assert.equal(parsed.grado_token, sieeTokens.grade)
          assert.ok(parsed.area_token === null || parsed.area_token === sieeTokens.area)
          assert.ok(!Object.keys(parsed).some(key => key.endsWith('_id')))
          const row = fixtures[url.pathname].data.find(item => item.grado_token === parsed.grado_token && item.materia_token === parsed.materia_token)
          if (row) row.peso_area = parsed.peso_area
          fixture = fixtures[sieePath]
        }
        if (url.pathname === sieeCurriculumPath + '/masivo') {
          assert.ok(!hasPrivateIdKey(parsed))
          for (const item of parsed.items) {
            const grade = fixtures[sieePath].data.grados.find(g => g.url_token === item.grado_token)
            const subject = fixtures[sieePath].data.materias.find(m => m.url_token === item.materia_token)
            const rows = fixtures[sieeCurriculumPath].data
            const previous = rows.find(r => r.grado_token === item.grado_token && r.materia_token === item.materia_token)
            const values = {...item, grado_nombre: grade.nombre, materia_nombre: subject.nombre, area_token: subject.area_token, area_nombre: subject.area?.nombre ?? null}
            if (previous) Object.assign(previous, values); else rows.push(values)
          }
          fixture = {data: {guardados: parsed.items.length}}
        }
        if (realtimeMode && url.pathname === '/api/broadcasting/auth') {
          fixture = reverbProbe({action: 'auth', ...parsed})
        }
        if (url.pathname !== '/api/broadcasting/auth') {
          writes.push({method: req.method, path: url.pathname, body: parsed})
        }
        if (gradingMode && url.pathname === opaquePlanillaPath + '/actividades') {
          const sheet = fixtures['/api/evaluacion/planillas/1/1'].data
          const component = sheet.componentes.find(c => publicToken('componente', c.id) === parsed.componente_token)
          assert.ok(component)
          if (parsed.operacion === 'crear') component.actividades.push({id: 3, componente_id: component.id, version: 1, nombre: parsed.nombre, fecha: parsed.fecha, peso: parsed.peso})
          else if (parsed.operacion === 'editar') Object.assign(component.actividades.find(a => publicToken('actividad', a.id) === parsed.actividad_token), {nombre: parsed.nombre, fecha: parsed.fecha, peso: parsed.peso, version: 2})
          else if (parsed.operacion === 'modo') {component.modo = parsed.modo; component.version = (component.version ?? 1) + 1}
          fixture = {data: {guardado: true}}
        }
        if (gradingMode && url.pathname === opaquePlanillaPath && req.method === 'PUT') {
          assert.ok(parsed.notas.every(n => !('actividad_id' in n) && !('matricula_id' in n) && n.motivo.length >= 3))
          const sheet = fixtures['/api/evaluacion/planillas/1/1'].data
          sheet.calificaciones = parsed.notas.map(n => ({actividad_id: sheet.componentes.flatMap(c => c.actividades).find(a => publicToken('actividad', a.id) === n.actividad_token).id,
            matricula_id: sheet.matriculas.find(m => publicToken('matricula', m.id) === n.matricula_token).id, valor: n.valor, version: 1, observacion: null}))
          fixture = fixtures['/api/evaluacion/planillas/1/1']
        }
        if (gradingMode && url.pathname === `/api/preinformes/${urlTokens.period}` && req.method === 'PUT') {
          assert.equal(parsed.preinformes.length, 3)
          assert.equal(parsed.version, 1)
          const configured = fixtures['/api/preinformes'].data.periodos[0]
          Object.assign(configured, {version: 2, preinformes: parsed.preinformes,
            configuracion: {usar_preinformes: parsed.usar_preinformes, modo: parsed.modo, fechas_estrictas: parsed.fechas_estrictas}})
          fixture = {data: {guardado: true}}
        }
        respond()
      })
    })
  }}]})
  await server.listen()
  console.log('Smoke API and Vite ready.')
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1', 'about:blank'], {windowsHide: true, stdio: 'ignore'})
  const activePortFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 150 && !fs.existsSync(activePortFile); i++) await sleep(100)
  assert.ok(fs.existsSync(activePortFile), 'Browser debugging endpoint did not start.')
  const port = fs.readFileSync(activePortFile, 'utf8').split('\n')[0]
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  console.log('Browser ready.')
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await once(socket, 'open')
  let serial = 0
  const pending = new Map(), errors = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const promise = pending.get(message.id)
      if (promise) { pending.delete(message.id); message.error ? promise.reject(new Error(JSON.stringify(message.error))) : promise.resolve(message.result) }
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') console.error('Browser console:', message.params.args.map(arg => arg.value ?? arg.description).join(' ').slice(0, 800))
  })
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 30000)
    const id = ++serial; pending.set(id, {resolve: result => {clearTimeout(timer); resolve(result)}, reject: error => {clearTimeout(timer); reject(error)}}); socket.send(JSON.stringify({id, method, params}))
  })
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true})
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result?.value
  }
  const until = async expression => {
    for (let i = 0; i < 300; i++) {
      try { if (await evaluate(expression)) return } catch { /* A navigation can replace the page during evaluation. */ }
      await sleep(100)
    }
    console.error('Page at failure:', await evaluate('({url: location.href, text: document.body.innerText.slice(0, 2500), navigation: window.smokeNavigation})'), errors)
    const capture = await command('Page.captureScreenshot', {format: 'png'})
    fs.writeFileSync(path.join(artifacts, 'failure.png'), Buffer.from(capture.data, 'base64'))
    throw new Error(`UI condition timed out: ${expression}`)
  }
  await command('Page.enable'); await command('Runtime.enable')
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `document.cookie='school_saas_csrf=smoke-csrf; path=/';localStorage.setItem('i18nConfig',JSON.stringify({selectedLang:'es'}));`})
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  const navigate = async (route, text) => { console.log('Checking', route); await command('Page.navigate', {url: `http://127.0.0.1:5197${route}`}); await until(`document.body.innerText.includes(${JSON.stringify(text)})`) }
  const screenshot = async (name, full = false) => { const image = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: full}); fs.writeFileSync(path.join(artifacts, `${name}.png`), Buffer.from(image.data, 'base64')) }
  const assertIndicatorNavigationCache = async condition => {
    await evaluate(`document.querySelector('[data-kt-nav="/academico/anos-lectivos"]').click()`)
    await until(`location.pathname === '/academico/anos-lectivos'`)
    await new Promise(resolve => setTimeout(resolve, 500))
    const checkpoint = detailedReads.length
    await evaluate(`document.querySelector('[data-kt-nav="/academico/indicadores"]').click()`)
    await until(condition)
    await new Promise(resolve => setTimeout(resolve, 500))
    assert.deepEqual(detailedReads.slice(checkpoint), [], 'Rector indicators must retain filters and cached data on SPA return.')
  }
  const assertStickyMatrix = async () => {
    const geometry = await evaluate(`(async()=>{
      const pane=document.querySelector('.rbac-matrix-scroll');
      const header=pane.querySelector('thead th:first-child');
      const role=pane.querySelector('thead th:nth-child(2)');
      const permission=pane.querySelector('.rbac-matrix-permission');
      pane.scrollTop=0;pane.scrollLeft=0;
      await new Promise(requestAnimationFrame);
      const before={top:header.getBoundingClientRect().top,left:permission.getBoundingClientRect().left,roleLeft:role.getBoundingClientRect().left};
      pane.scrollTop=600;pane.scrollLeft=180;
      await new Promise(requestAnimationFrame);
      const after={top:header.getBoundingClientRect().top,left:permission.getBoundingClientRect().left,roleLeft:role.getBoundingClientRect().left};
      return {before,after,scrollTop:pane.scrollTop,scrollLeft:pane.scrollLeft,headerPosition:getComputedStyle(header).position};
    })()`)
    assert.ok(geometry.scrollTop >= 500 && geometry.scrollLeft >= 100, JSON.stringify(geometry))
    assert.equal(geometry.headerPosition, 'sticky')
    assert.ok(Math.abs(geometry.before.top - geometry.after.top) <= 2, `Role headers moved vertically: ${JSON.stringify(geometry)}`)
    assert.ok(Math.abs(geometry.before.left - geometry.after.left) <= 2, `Permission column moved horizontally: ${JSON.stringify(geometry)}`)
    assert.ok(geometry.before.roleLeft - geometry.after.roleLeft >= 100, `Role columns should scroll horizontally: ${JSON.stringify(geometry)}`)
  }
  if (rbacCatalogFixture) {
    await navigate('/configuracion/roles-permisos', 'Roles y Permisos')
    await until(`document.querySelectorAll('table tbody tr').length >= 3`)
    assert.equal(await evaluate(`document.querySelector('table tbody tr td:first-child')?.textContent.trim()`), 'Académico')
    assert.equal(await evaluate(`document.querySelector('table tbody tr td:nth-child(2)')?.textContent.trim()`), 'Gestionar años lectivos')
    assert.ok(await evaluate(`document.querySelector('table tbody tr td:nth-child(4)')?.textContent.includes('Gestión académica')`))
    await screenshot('rbac-plataforma-permisos-desktop')
    await evaluate(`[...document.querySelectorAll('.nav-link')].find(el => el.textContent.trim() === 'Matriz')?.click()`)
    await until(`document.querySelector('table tbody tr.bg-light')?.textContent.includes('Académico')`)
    assert.ok(await evaluate(`document.querySelector('table tbody tr:not(.bg-light)')?.textContent.includes('Gestionar años lectivos')`))
    await screenshot('rbac-plataforma-matriz-desktop')
    await assertStickyMatrix()
    await screenshot('rbac-plataforma-matriz-scroll')
    assert.deepEqual(errors, [], 'Uncaught browser errors in platform RBAC.')
    console.log('PASS: platform RBAC permission and matrix labels are human-readable.')
  } else if (rbacMode) {
    await navigate('/usuarios/roles-permisos', 'Roles y permisos del colegio')
    await until(`document.querySelectorAll('table tbody tr').length >= 5`)
    assert.equal(await evaluate(`!!document.querySelector('#tenant-role-select')`), false)
    assert.equal(await evaluate(`document.querySelectorAll('table thead th').length`), rbacFixture.roles.length + 1)
    assert.ok(await evaluate(`document.body.innerText.includes('Gestionar años lectivos') &&
      document.body.innerText.includes('Gestionar matrículas') &&
      document.body.innerText.includes('Académico')`), 'The matrix must show readable academic labels.')
    assert.ok(await evaluate(`document.body.innerText.includes('No disponible en este plan')`), 'Plan-locked cells must be visible.')
    await screenshot('rbac-rector-matriz-desktop')
    await assertStickyMatrix()
    await screenshot('rbac-rector-matriz-scroll')
    await evaluate(`[...document.querySelectorAll('.nav-link')].find(el => el.textContent.trim() === 'Roles')?.click()`)
    await until(`document.body.innerText.includes('Crear rol adicional') && !!document.querySelector('table')`)
    assert.equal(await evaluate(`document.querySelectorAll('table tbody tr').length`), rbacFixture.roles.length)
    await screenshot('rbac-rector-roles-desktop')
    await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
    await evaluate(`[...document.querySelectorAll('.nav-link')].find(el => el.textContent.trim() === 'Matriz')?.click()`)
    await until(`document.querySelectorAll('table thead th').length === ${rbacFixture.roles.length + 1}`)
    assert.ok(await evaluate(`(()=>{const pane=document.querySelector('.table-responsive');return pane.scrollWidth > pane.clientWidth})()`),
      'The matrix must scroll horizontally on mobile.')
    await screenshot('rbac-rector-matriz-mobile')
    assert.deepEqual(apiWrites.filter(path => path.startsWith('/api/rbac/')), [], 'Visual smoke must not change school permissions.')
    assert.deepEqual(errors, [], 'Uncaught browser errors in school RBAC.')
    console.log('PASS: rector matrix, readable labels, role management, plan locks and mobile horizontal scroll.')
  } else if (indicatorScopeMode) {
    await navigate('/ajustes-institucionales/indicadores', 'Configuración de indicadores')
    await until(`!!document.querySelector('input[name="indicator-scope"]:checked')`)
    assert.ok(await evaluate(`document.body.innerText.includes('Por grado: un indicador se muestra en todos sus grupos')`))
    assert.equal(await evaluate(`document.querySelector('form.card .form-switch input[type="checkbox"]')?.disabled`), true)
    await screenshot('indicadores-alcance-rector')
    await evaluate(`document.querySelector('input[name="indicator-scope"][value="grupo"]').click()`)
    await until(`document.body.innerText.includes('Se copiarán los indicadores de grado a cada grupo por separado')`)
    await until(`document.querySelector('form.card .form-switch input[type="checkbox"]')?.disabled === false`)
    assert.equal(await evaluate(`document.querySelector('.card-footer button[type="submit"]')?.disabled`), true)
    await navigate('/academico/indicadores', 'Indicadores de aprendizaje')
    await until(`!!document.querySelector('#indicator-grade')`)
    await evaluate(`(()=>{const select=document.querySelector('#indicator-grade');select.value='${sieeTokens.grade}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`!!document.querySelector('#indicator-subject option[value="${urlTokens.materia}"]')`)
    await evaluate(`(()=>{const select=document.querySelector('#indicator-subject');select.value='${urlTokens.materia}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.body.innerText.includes('Resuelve sumas sencillas.') && !!document.querySelector('#indicator-draft option')`)
    assert.ok(await evaluate(`document.body.innerText.includes('Reconoce los números del uno al diez.')`))
    await assertIndicatorNavigationCache(`document.querySelector('#indicator-grade')?.value === '${sieeTokens.grade}' && document.querySelector('#indicator-subject')?.value === '${urlTokens.materia}' && document.body.innerText.includes('Resuelve sumas sencillas.')`)
    await screenshot('indicadores-grado-rector')
    assert.deepEqual(errors, [], 'Uncaught browser errors in rector indicators.')
    assert.deepEqual(apiWrites.filter(path => path.startsWith('/api/indicadores')), [], 'Scope smoke must not change indicator data.')
    console.log('PASS: rector indicator settings, conversion warning, grade editor and reusable group drafts.')
  } else if (indicatorSheetMode) {
    await navigate('/academico/indicadores', 'Indicadores de aprendizaje')
    await until(`!!document.querySelector('#assigned-indicator-group')`)
    await evaluate(`(()=>{const select=document.querySelector('#assigned-indicator-group');select.value='${urlTokens.group}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.querySelectorAll('.group-indicator-table tbody tr').length === 2`)
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.group-indicator-table tbody th')].map(el => el.textContent.trim())`),
      ['Lenguaje', 'Matemáticas'])
    assert.equal(await evaluate(`!!document.querySelector('#assigned-indicator-subject')`), false)
    assert.equal(await evaluate(`document.querySelector('.group-indicator-rich strong')?.textContent`), 'sumas')
    assert.ok(await evaluate(`parseFloat(getComputedStyle(document.querySelector('.group-indicator-frame')).borderTopLeftRadius) >= 10`))
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.group-indicator-table thead th')).backgroundColor`), 'rgb(22, 134, 83)')
    const originalDescription = await evaluate(`document.querySelector('.group-indicator-table tbody tr:nth-child(2) .group-indicator-rich').innerHTML`)
    await evaluate(`document.querySelector('.group-indicator-table tbody tr:nth-child(2) .group-indicator-edit').click()`)
    await until(`!!document.querySelector('.group-indicator-table tbody tr:nth-child(2) .group-indicator-editor')`)
    await evaluate(`document.querySelector('.group-indicator-table tbody tr:nth-child(2) .group-indicator-editor').focus()`)
    await command('Input.insertText', {text: 'Borrador que se descarta'})
    await evaluate(`document.querySelector('.group-indicator-table tbody tr:nth-child(2) .group-indicator-actions .btn-light').click()`)
    await until(`!!document.querySelector('.group-indicator-table tbody tr:nth-child(2) .group-indicator-rich')`)
    assert.equal(await evaluate(`document.querySelector('.group-indicator-table tbody tr:nth-child(2) .group-indicator-rich').innerHTML`), originalDescription,
      'Cancel must restore exactly one copy of the original indicator.')
    assert.equal(await evaluate(`document.querySelectorAll('.group-indicator-table tbody tr:nth-child(2) .group-indicator-description ul').length`), 1,
      'Cancel must discard the editable DOM instead of leaving a second list in the action container.')
    assert.equal(await evaluate(`document.querySelector('.group-indicator-table tbody tr:nth-child(2) .group-indicator-description').textContent.includes('Borrador que se descarta')`), false)
    await assertIndicatorNavigationCache(`document.querySelector('#assigned-indicator-group')?.value === '${urlTokens.group}' && document.querySelectorAll('.group-indicator-table tbody tr').length === 2`)
    await screenshot('indicadores-tabla-rector')
    await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
    await screenshot('indicadores-tabla-rector-mobile')
    assert.deepEqual(apiWrites.filter(path => path.startsWith('/api/indicadores')), [], 'Visual smoke must not change indicators.')
    assert.deepEqual(errors, [], 'Uncaught browser errors in rector indicator sheet.')
    console.log('PASS: rector group indicator sheet, two columns, rich preview and mobile layout.')
  } else if (academicCacheMode) {
    await runAcademicNavigationSmoke({navigate, evaluate, until, command, screenshot, detailedReads, apiWrites,
      fixtures, user, tokens: urlTokens, closedPeriod: closedIndicatorPeriod,
      publish: resources => reverbProbe({action: 'publish', resources}), errors})
  } else if (teacherAccessMode) {
    await navigate('/academico/indicadores', 'Indicadores de aprendizaje')
    await until(`!!document.querySelector('.group-indicator-table tbody tr')`)
    assert.equal(await evaluate(`!!document.querySelector('#assigned-indicator-group')`), false)
    assert.equal(await evaluate(`!!document.querySelector('#assigned-indicator-subject')`), false)
    assert.equal(await evaluate(`document.querySelector('.group-indicator-table tbody tr th')?.textContent`), 'Matemáticas')
    assert.equal(await evaluate(`document.querySelector('.group-indicator-rich strong')?.textContent`), 'sumas')
    assert.equal(await evaluate(`document.querySelectorAll('.group-indicator-rich p').length`), 2)
    await screenshot('indicadores-tabla-docente-lectura')
    await evaluate(`(()=>{const select=document.querySelector('#assigned-indicator-period');select.value='${closedIndicatorPeriod}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.querySelector('.alert-warning')?.textContent.includes('Período o año cerrado')`)
    await until(`!!document.querySelector('.group-indicator-table tbody tr') && !document.querySelector('.group-indicator-edit')`)
    await screenshot('indicadores-periodo-cerrado')
    await evaluate(`(()=>{const select=document.querySelector('#assigned-indicator-period');select.value='${urlTokens.period}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`!!document.querySelector('.group-indicator-edit') && !document.querySelector('.alert-warning')`)
    await evaluate(`document.querySelector('.group-indicator-edit').click()`)
    await until(`!!document.querySelector('.group-indicator-editor[contenteditable="true"]')`)
    assert.ok(await evaluate(`!!document.querySelector('.group-indicator-toolbar [aria-label="Negrita"]')`))
    await evaluate(`(()=>{const editor=document.querySelector('.group-indicator-editor');editor.focus();const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range)})()`)
    await command('Input.insertText', {text: ' Primer'})
    await command('Input.insertText', {text: ' Segundo'})
    assert.ok(await evaluate(`document.querySelector('.group-indicator-editor').textContent.includes('Primer Segundo')`),
      'Successive keystrokes must remain in the indicator editor.')
    await evaluate(`(()=>{const editor=document.querySelector('.group-indicator-editor');const range=document.createRange();range.selectNodeContents(editor.lastElementChild);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.querySelector('[aria-label="Negrita"]').click()})()`)
    await until(`document.querySelector('[aria-label="Negrita"]')?.getAttribute('aria-pressed') === 'true'`)
    assert.ok(await evaluate(`document.querySelector('[aria-label="Negrita"]').classList.contains('group-indicator-tool-active')`),
      'Bold button must be visibly active when selected text is bold.')
    await until(`getComputedStyle(document.querySelector('[aria-label="Negrita"]')).backgroundColor === 'rgb(10, 175, 83)'`)
    await screenshot('indicadores-negrita-activa')
    await evaluate(`document.querySelector('[aria-label="Negrita"]').click()`)
    await until(`document.querySelector('[aria-label="Negrita"]')?.getAttribute('aria-pressed') === 'false'`)
    assert.ok(await evaluate(`!document.querySelector('[aria-label="Negrita"]').classList.contains('group-indicator-tool-active')`),
      'Bold button must stop highlighting when bold is removed.')
    await until(`getComputedStyle(document.querySelector('[aria-label="Negrita"]')).backgroundColor !== 'rgb(10, 175, 83)'`)
    await evaluate(`document.querySelector('[aria-label="Negrita"]').click()`)
    await until(`document.querySelector('[aria-label="Negrita"]')?.getAttribute('aria-pressed') === 'true'`)
    assert.ok(await evaluate(`[...document.querySelectorAll('.group-indicator-editor b, .group-indicator-editor strong')].some(el => el.textContent.includes('Primer Segundo'))`),
      'Bold command must format the selected text.')
    await evaluate(`(()=>{const editor=document.querySelector('.group-indicator-editor');const range=document.createRange();range.selectNodeContents(editor.firstElementChild);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.querySelector('[aria-label="Lista con puntos"]').click()})()`)
    assert.ok(await evaluate(`!!document.querySelector('.group-indicator-editor ul li')`), 'Bulleted list command must format a line.')
    await until(`document.querySelector('[aria-label="Lista con puntos"]')?.getAttribute('aria-pressed') === 'true'`)
    assert.equal(await evaluate(`document.querySelector('[aria-label="Negrita"]')?.getAttribute('aria-pressed')`), 'false',
      'Moving to an unbold line must clear the bold highlight.')
    await evaluate(`document.querySelector('.group-indicator-source').click()`)
    await until(`document.querySelector('.group-indicator-source').getAttribute('aria-pressed') === 'true'`)
    assert.ok(await evaluate(`document.querySelector('.group-indicator-source-editor')?.value.includes('<ul>')`))
    await evaluate(`document.querySelector('.group-indicator-source').click()`)
    await until(`!!document.querySelector('.group-indicator-editor ul li')`)
    await screenshot('indicadores-tabla-docente')
    await evaluate(`document.querySelector('.group-indicator-actions .btn-primary').click()`)
    await until(`!document.querySelector('.group-indicator-editor') && document.querySelector('.group-indicator-rich')?.textContent.includes('Primer Segundo')`)
    assert.equal(indicatorSheetWrites.length, 1)
    assert.ok(indicatorSheetWrites[0].texto_html.includes('<strong>') && indicatorSheetWrites[0].texto_html.includes('<ul>'))
    await evaluate(`document.querySelector('.group-indicator-row-actions .btn-light-danger').click()`)
    await until(`!!document.querySelector('.group-indicator-delete-confirm')`)
    await evaluate(`document.querySelector('.group-indicator-delete-confirm .btn-danger').click()`)
    await until(`!!document.querySelector('.group-indicator-table .group-indicator-row-actions') && !document.querySelector('.group-indicator-row-actions .btn-light-danger')`)
    assert.equal(indicatorSheetDeletes.length, 1)
    assert.ok(await evaluate(`document.querySelector('.group-indicator-description')?.textContent.includes('Sin descripción')`))
    const menu = await evaluate(`document.querySelector('#kt_app_header_menu')?.innerText ?? ''`)
    for (const forbidden of ['Años lectivos', 'Estructura organizacional', 'Plan de estudios', 'Parámetros académicos', 'Configuración SIEE', 'Reportes']) {
      assert.ok(!menu.includes(forbidden), `Teacher sees ${forbidden}`)
    }
    await navigate('/academico/boletines', 'Boletín de Calificaciones')
    await until(`document.querySelectorAll('table tbody tr').length === 1`)
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Grupo"]')`), false)
    assert.equal(await evaluate(`!!document.querySelector('#evaluacion-status')`), false)
    const previewReadsStart = apiReads.length
    for (let visit = 0; visit < 2; visit++) {
      await navigate(`/academico/boletines/${urlTokens.enrollment}`, 'Informe preliminar')
      await until(`!!document.querySelector('.grade-report tbody tr')`)
      assert.equal(await evaluate(`!!document.querySelector('[id^="observation-"]')`), false,
        'Report preview must not contain period or final observation editors, including after reload.')
      const previewText = await evaluate(`document.body.innerText`)
      assert.ok(!previewText.includes('Observaciones para el boletín') && !previewText.includes('Emisión individual de boletines'),
        'Observation management and issuance belong exclusively in the bulletin workspace.')
    }
    assert.ok(!apiReads.slice(previewReadsStart).some(route => route.startsWith('/api/boletines/observaciones/') || route.startsWith('/api/boletines/emisiones/')),
      'The read-only preview must not request observation editors or issuance history.')
    await screenshot('boletin-vista-previa-docente')
    const workspaceStart = detailedReads.length
    await navigate('/academico/boletines/gestion', 'Observaciones y emisión de boletines')
    await until(`!!document.querySelector('textarea') && document.querySelector('#workspace-group').disabled`)
    assert.ok(await evaluate(`!!document.querySelector('[data-testid="academic-page-header"] #workspace-year.form-select-solid')`),
      'The workspace year selector must match the gradebook header.')
    assert.equal(await evaluate(`document.querySelector('#workspace-period option:checked').textContent`), 'Trimestre 1 · Abierto')
    assert.equal(detailedReads.slice(workspaceStart).filter(route => route.startsWith('/api/boletines/observaciones/grupo?')).length, 1)
    assert.ok(detailedReads.slice(workspaceStart).filter(route => route.startsWith('/api/evaluacion/catalogo')).length <= 2,
      'Default year and group must resolve together, not cascade through three catalog reads.')
    assert.equal(apiReads.slice(workspaceStart).filter(route => route === `/api/boletines/observaciones/${urlTokens.enrollment}`).length, 0)
    await evaluate(`(()=>{const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Avanza en su aprendizaje.');input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Guardar observación').click()`)
    await until(`document.body.innerText.includes('Guardada')`)
    await screenshot('observaciones-grupo-desktop')
    const beforeIssuance = detailedReads.length
    await evaluate(`[...document.querySelectorAll('[role=tab]')].find(button=>button.textContent.includes('Boletín')).click()`)
    await evaluate(`document.querySelector('input[aria-label="Seleccionar todos"]').click()`)
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Generar boletín')).click()`)
    await until(`!!document.querySelector('a[href*="/emisiones/documentos/"]')`)
    await screenshot('emision-grupo-desktop')
    await sleep(250) // Include the debounced local invalidation.
    assert.equal(detailedReads.slice(beforeIssuance).filter(route => route.startsWith('/api/boletines/observaciones/') || route.startsWith('/api/evaluacion/catalogo')).length, 0,
      'Issuing a PDF must not refetch the roster or observations.')
    await evaluate(`[...document.querySelectorAll('[role=tab]')].find(button=>button.textContent.includes('Observaciones')).click()`)
    const beforeNavigation = detailedReads.length
    const authBeforeNavigation = apiWrites.filter(route => route === '/api/broadcasting/auth').length
    await evaluate(`(()=>{window.smokeNavigation=[];for(const key of ['pushState','replaceState']){const original=history[key];history[key]=function(...args){window.smokeNavigation.push([key,args[2]]);return original.apply(this,args)}}})()`)
    await evaluate(`document.querySelector('[data-kt-nav="/academico/boletines"]').click()`)
    await until(`location.pathname === '/academico/boletines'`)
    await until(`!!document.querySelector('a[href="/academico/boletines/gestion"]')`)
    await evaluate(`document.querySelector('a[href="/academico/boletines/gestion"]').click()`)
    await until(`!!document.querySelector('#workspace-period') && !!document.querySelector('textarea')`)
    assert.equal(detailedReads.slice(beforeNavigation).filter(route => route.startsWith('/api/boletines/observaciones/')).length, 0,
      'Returning within the app must reuse observations from memory.')
    assert.equal(apiWrites.filter(route => route === '/api/broadcasting/auth').length, authBeforeNavigation,
      'SPA navigation must keep its authorized WebSocket.')
    const beforeReload = detailedReads.length
    await command('Page.reload')
    await until(`!!document.querySelector('textarea') && document.querySelector('#workspace-year').value === '${urlTokens.year}'`)
    assert.equal(detailedReads.slice(beforeReload).filter(route => route.startsWith('/api/evaluacion/catalogo')).length, 1,
      'F5 restores public URL selectors and needs only one catalog read.')
    assert.equal(detailedReads.slice(beforeReload).filter(route => route.startsWith('/api/boletines/observaciones/grupo?')).length, 1)
    await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
    assert.ok(await evaluate(`(()=>{const header=document.querySelector('[data-testid="academic-page-header"]');return header.scrollWidth <= header.clientWidth + 1})()`))
    await screenshot('observaciones-grupo-mobile')
    await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
    console.log('PASS: one group observation request, cached SPA return, no socket reauthorization on navigation, and one catalog read after F5.')
    await navigate(`/evaluacion/recuperaciones/${urlTokens.enrollment}?desde=boletines`, 'Abrir proceso')
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Abrir proceso').click()`)
    await until(`!!document.querySelector('input[id^="grade-"]')`)
    await evaluate(`(()=>{for(const [selector,value] of [['input[id^="grade-"]','4'],['input[id^="reason-"]','Refuerzo completado']]) {const input=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`)
    await evaluate(`document.querySelector('input[id^="grade-"]').closest('form').requestSubmit()`)
    await until(`document.body.innerText.includes('Aprobada')`)
    await screenshot('nivelacion-abierta-docente')
    const recoveryRow = fixtures['/api/evaluacion/recuperaciones'].data[0]
    Object.assign(recoveryRow, {can_record: false, can_cancel: false,
      motivo_bloqueo: 'La nivelación solo se puede crear, modificar o anular con el período abierto.'})
    await navigate(`/evaluacion/recuperaciones/${urlTokens.enrollment}?desde=boletines`, 'La nivelación solo se puede')
    assert.equal(await evaluate(`!!document.querySelector('input[id^="grade-"]') || !!document.querySelector('details')`), false)
    await screenshot('nivelacion-cerrada-docente')
    Object.assign(fixtures[`/api/boletines/observaciones/${urlTokens.enrollment}`].data.periodos[0], {
      puede_editar: false, motivo_bloqueo: 'La observación solo se puede modificar con el período abierto.',
    })
    fixtures['/api/evaluacion/catalogo'].data.periodos[0].estado = 'cerrado'
    await navigate('/academico/boletines/gestion', 'La observación solo se puede modificar')
    assert.equal(await evaluate(`document.querySelector('textarea').disabled`), true)
    assert.equal(await evaluate(`document.querySelector('#workspace-period option:checked').textContent`), 'Trimestre 1 · Cerrado')
    await navigate('/evaluacion/catalogo', 'Mis Asignaciones')
    await until(`document.querySelectorAll('table tbody tr').length === 1`)
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Grupo"]')`), false)
    await navigate('/academico/asistencia', 'Planilla de asistencia')
    await until(`new URLSearchParams(location.search).get('asignacion') === '${urlTokens.assignment}'`)
    assert.equal(await evaluate(`!!document.querySelector('#attendance-group')`), false)
    assert.equal(await evaluate(`!!document.querySelector('#attendance-subject')`), false)
    assert.equal(await evaluate(`!!document.querySelector('#attendance-period')`), true)
    await navigate('/comunicacion/eventos', 'Feria de ciencias')
    await until(`document.querySelector('.event-recent-card') !== null`)
    assert.equal(await evaluate(`!!document.querySelector('select[aria-label="Grupo"]')`), false,
      'A historical assignment must not create a redundant group selector in the current month.')
    assert.ok(eventFixture.readUrls.some(url => url.includes(`grupo_token=${urlTokens.group}`)), 'Calendar must query the assigned group')
    await command('Page.navigate', {url: 'http://127.0.0.1:5197/academico/anos-lectivos'})
    await until(`location.pathname === '/dashboard'`)
    for (const denied of ['/academico/estructura', '/academico/plan-estudios',
      '/academico/parametros-academicos', '/academico/siee']) {
      await command('Page.navigate', {url: `http://127.0.0.1:5197${denied}`})
      await until(`location.pathname === '/dashboard'`)
    }
    await command('Page.navigate', {url: 'http://127.0.0.1:5197/academico/boletines/plantillas'})
    await until(`location.pathname === '/academico/boletines'`)
    assert.ok(!apiReads.some(read => read === '/api/anos-lectivos' || read === '/api/estructura/sedes'))
    assert.deepEqual(errors, [], 'Uncaught browser errors in teacher navigation.')
    console.log('PASS: teacher navigation, scoped indicators/report, and unique-group gradebook, attendance and calendar.')
  } else if (eventsMode) {
    await runEventsSmoke({navigate, evaluate, until, screenshot, command, fixture: eventFixture, errors})
  } else if (intakeMode) {
    await runEnrollmentSmoke({navigate, evaluate, until, screenshot, command, fixture: intakeFixture, errors, apiReads, summaryOnly: process.argv.includes('--ingreso-summary')})
  } else if (aulaMode) {
    await navigate('/evaluacion/aula', 'Selecciona un grupo académico')
    assert.ok(await evaluate(`!document.body.innerText.includes('Docente de prueba')`), 'No debe cargar las aulas antes de elegir grupo.')
    await evaluate(`(()=>{const select=[...document.querySelectorAll('select')].find(e=>e.textContent.includes('Primero / 01A'));select.value='${urlTokens.group}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.body.innerText.includes('Docente de prueba')`)
    assert.ok(await evaluate(`document.body.innerText.includes('Matemáticas')`))
    assert.ok(await evaluate(`document.body.innerText.includes('Docente de prueba')`))
    await screenshot('aula-catalogo-desktop')
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Configuración')).click()`)
    await until(`!!document.querySelector('.modal.show input[type=checkbox]')`)
    assert.ok(await evaluate(`document.body.innerText.includes('Permitir preparar contenido en períodos cerrados')`))
    assert.ok(await evaluate(`document.querySelectorAll('.modal.show input[type=color]').length === 3`),
      'El rector debe poder configurar dos períodos y los preinformes.')
    await screenshot('aula-configuracion-colores')
    await evaluate(`document.querySelector('.modal.show input[type=checkbox]').click()`)
    await evaluate(`[...document.querySelectorAll('.modal.show button')].find(button => button.textContent.includes('Guardar cambios')).click()`)
    await until(`!document.querySelector('.modal.show')`)
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Configuración')).click()`)
    await until(`document.querySelector('.modal.show input[type=checkbox]').checked === false`)
    await evaluate(`document.querySelector('.modal.show button.btn-close').click()`)
    await until(`!document.querySelector('.modal.show')`)
    const navigationReads = apiReads.length
    await evaluate(`[...document.querySelectorAll('.aula-card button')].find(button => button.textContent.includes('Entrar al aula')).click()`)
    await until(`document.body.innerText.includes('Semana 1') && !!document.querySelector('.aula-sidebar')`)
    assert.deepEqual(apiReads.slice(navigationReads).filter(path =>
      ['/api/me', '/api/onboarding/status', '/api/estructura/sedes', '/api/usuarios', '/api/aula/catalogo'].includes(path)), [],
    'Navegar del catálogo al aula no debe recargar identidad, onboarding, sedes, usuarios ni catálogo.')
    await navigate('/evaluacion/aula/' + 'y'.repeat(24), 'Semana 1')
    assert.ok(await evaluate(`document.body.innerText.includes('Guía de lectura')`))
    assert.ok(await evaluate(`!!document.querySelector('.aula-sidebar') && !!document.querySelector('.aula-main')`),
      'El Aula debe mostrar navegación lateral y contenido por secciones.')
    assert.ok(await evaluate(`document.querySelectorAll('.aula-nav-preinforme').length === 2 &&
      document.querySelectorAll('.aula-preinforme-heading').length === 2 &&
      !document.querySelectorAll('.aula-nav-section-toggle')[1].hasAttribute('aria-expanded') &&
      !document.querySelectorAll('.aula-section-toggle')[1].hasAttribute('aria-expanded')`),
    'Los preinformes deben agruparse y las secciones vacías no deben mostrar acordeón.')
    assert.ok(await evaluate(`document.querySelector('.aula-nav-period').style.getPropertyValue('--aula-period-accent') === '#2563eb' &&
      document.querySelector('.aula-period-heading').style.getPropertyValue('--aula-period-accent') === '#2563eb' &&
      document.querySelector('.aula-nav-preinforme').style.getPropertyValue('--aula-preinforme-accent') === '#64748b' &&
      document.querySelector('.aula-preinforme-heading').style.getPropertyValue('--aula-preinforme-accent') === '#64748b'`),
    'Los mismos colores configurados deben aparecer a izquierda y derecha.')
    await evaluate(`document.querySelector('.aula-nav-section-toggle').click()`)
    await until(`document.querySelector('.aula-nav-section-toggle').getAttribute('aria-expanded') === 'false'`)
    await evaluate(`document.querySelector('.aula-nav-section-toggle').click()`)
    await until(`document.querySelector('.aula-nav-section-toggle').getAttribute('aria-expanded') === 'true'`)
    await evaluate(`document.querySelector('.aula-section-toggle').click()`)
    await until(`document.querySelector('.aula-section-toggle').getAttribute('aria-expanded') === 'false'`)
    await evaluate(`document.querySelector('.aula-section-toggle').click()`)
    await until(`document.querySelector('.aula-section-toggle').getAttribute('aria-expanded') === 'true'`)
    await evaluate(`document.querySelector('.aula-nav-section-toggle').click();document.querySelector('.aula-section-toggle').click()`)
    await until(`document.querySelector('.aula-nav-section-toggle').getAttribute('aria-expanded') === 'false' &&
      document.querySelector('.aula-section-toggle').getAttribute('aria-expanded') === 'false'`)
    await command('Page.reload')
    await until(`!!document.querySelector('.aula-section-toggle') &&
      document.querySelector('.aula-nav-section-toggle').getAttribute('aria-expanded') === 'false' &&
      document.querySelector('.aula-section-toggle').getAttribute('aria-expanded') === 'false'`)
    await navigate('/evaluacion/aula/recursos/' + 'z'.repeat(24), 'Lee con atención.')
    await navigate('/evaluacion/aula/' + 'y'.repeat(24), 'Semana 1')
    assert.ok(await evaluate(`document.querySelector('.aula-nav-section-toggle').getAttribute('aria-expanded') === 'false' &&
      document.querySelector('.aula-section-toggle').getAttribute('aria-expanded') === 'false'`),
    'Ambos acordeones deben recordar su estado tras F5 y después de salir del aula.')
    await evaluate(`document.querySelector('.aula-nav-section-toggle').click();document.querySelector('.aula-section-toggle').click()`)
    await until(`document.querySelector('.aula-nav-section-toggle').getAttribute('aria-expanded') === 'true' &&
      document.querySelector('.aula-section-toggle').getAttribute('aria-expanded') === 'true'`)
    await screenshot('aula-detalle-desktop')
    await command('Emulation.setDeviceMetricsOverride', {width: 2200, height: 1000, deviceScaleFactor: 1, mobile: false})
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Nueva sección')).click()`)
    await until(`!!document.querySelector('.aula-editor-page .aula-inline-form')`)
    assert.ok(await evaluate(`(() => {
      const period = [...document.querySelectorAll('.aula-editor-page select')].find(select =>
        select.closest('label')?.textContent.includes('Período'))
       return !!period && period.required && period.value === '' &&
         !!period.querySelector('option[value="${'c'.repeat(24)}"]:disabled') &&
         !!document.querySelector('.aula-editor-page input[required]')
    })()`), 'Crear sección debe exigir nombre y selección explícita de período.')
    assert.ok(await evaluate(`(() => {
      const main = document.querySelector('.aula-main'), style = getComputedStyle(main)
      const available = main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      return main.clientWidth > 1400 && document.querySelector('.aula-editor-page form').getBoundingClientRect().width >= available * .98
    })()`), 'El formulario de sección debe ocupar todo el ancho útil del panel derecho.')
    await evaluate(`document.querySelector('.aula-editor-page > button').click()`)
    await until(`!!document.querySelector('.aula-section')`)
    await evaluate(`document.querySelector('.aula-section-actions button[aria-label^="Editar sección"]').click()`)
    await until(`!!document.querySelector('.aula-editor-page')`)
    assert.ok(await evaluate(`!![...document.querySelectorAll('.aula-editor-page select')].find(select =>
      select.closest('label')?.textContent.includes('Período'))`),
      'Editar sección debe permitir corregir el período.')
    await evaluate(`document.querySelector('.aula-editor-page > button').click()`)
    await until(`!!document.querySelector('.aula-section')`)
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Agregar recurso')).click()`)
    await until(`document.body.innerText.includes('Tipo de contenido')`)
    assert.ok(await evaluate(`(() => {
      const main = document.querySelector('.aula-main'), style = getComputedStyle(main)
      const available = main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      return document.querySelector('.aula-resource-form').getBoundingClientRect().width >= available * .98 &&
        document.querySelector('.aula-rich-editor').getBoundingClientRect().width >= available * .98
    })()`), 'El compositor y su editor deben ocupar todo el ancho útil del panel derecho.')
    const composerState = await evaluate(`({sidebar: !!document.querySelector('.aula-sidebar'),
      editor: !!document.querySelector('.aula-rich-editor'), modals: [...document.querySelectorAll('.modal.show')].map(el => el.className)})`)
    assert.ok(composerState.sidebar && composerState.editor && composerState.modals.length === 0,
      `La edición debe ocupar el panel derecho y conservar el menú lateral: ${JSON.stringify(composerState)}`)
    assert.ok(await evaluate(`!document.body.innerText.includes('Fecha límite') && !document.body.innerText.includes('+ Bloque')`),
      'El compositor no debe pedir una segunda fecha límite ni obligar a editar bloques.')
    assert.ok(await evaluate(`(() => {
      const icons = [...document.querySelectorAll('.aula-kind-option .aula-kind-icon')]
      return icons.length === 4 && new Set(icons.map(icon => getComputedStyle(icon).color)).size === 4
    })()`), 'Lectura, material, tarea y cuestionario deben distinguirse por color.')
    await evaluate(`[...document.querySelectorAll('.aula-kind-option')].find(button => button.textContent.includes('Tarea')).click()`)
    assert.ok(await evaluate(`document.body.innerText.includes('La disponibilidad hasta es también el plazo de entrega.')`))
    await sleep(500)
    await screenshot('aula-compositor-desktop')
    await navigate('/evaluacion/aula/recursos/' + 'z'.repeat(24), 'Lee con atención.')
    assert.ok(await evaluate(`(() => {
      const main = document.querySelector('.aula-main'), blocks = document.querySelector('.aula-blocks')
      const style = getComputedStyle(main), available = main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      return !!blocks && blocks.getBoundingClientRect().width >= available * .98
    })()`), 'El contenido de un recurso debe ocupar todo el ancho útil del panel derecho.')
    await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
    assert.ok(await evaluate(`document.querySelector('a[href="https://example.org/biblioteca"]')?.textContent === 'Biblioteca'`))
    assert.ok(await evaluate(`!!document.querySelector('.aula-sidebar .aula-nav-resource.is-active')`),
      'El recurso debe conservar la navegación lateral del aula.')
    assert.ok(await evaluate(`document.querySelectorAll('.aula-resource-fact').length === 2 &&
      document.body.innerText.includes('Disponible sin límite de fecha') && document.querySelectorAll('.aula-material').length === 2 &&
      document.querySelectorAll('.aula-material-actions button').length === 2`),
    'El recurso debe mostrar evaluación, disponibilidad y tarjetas con opción de quitar.')
    assert.ok(await evaluate(`!!document.querySelector('.aula-material-thumb-word .bi-file-earmark-word-fill') &&
      !!document.querySelector('.aula-material-thumb-powerpoint .bi-file-earmark-ppt-fill')`),
    'Las tarjetas múltiples deben mostrar íconos reconocibles de Word y PowerPoint.')
    assert.ok(await evaluate(`(() => {
      const download = getComputedStyle(document.querySelector('.aula-material-actions .aula-download-button')).backgroundColor
      const edit = getComputedStyle(document.querySelector('.aula-resource-page .btn-light-warning')).backgroundColor
      const type = getComputedStyle(document.querySelector('.aula-resource-kind')).backgroundColor
      const primary = getComputedStyle(document.documentElement).getPropertyValue('--bs-primary').trim()
      return download === 'rgb(23, 198, 83)' && primary.toLowerCase() === '#17c653' && edit !== download && type !== download
    })()`), 'Descargar debe ser verde sin colorear Editar recurso ni el tipo de contenido.')
    await evaluate(`document.querySelector('.aula-material-open').click()`)
    await until(`!!document.querySelector('.aula-preview-modal.show')`)
    assert.ok(await evaluate(`document.querySelector('.aula-preview-modal').innerText.includes('Archivo 1 de 2') &&
      !!document.querySelector('.aula-preview-navigation')`), 'El visor amplio debe permitir recorrer adjuntos.')
    await until(`!!document.querySelector('.aula-preview-modal iframe')`)
    await evaluate(`document.querySelectorAll('.aula-preview-navigation button')[1].click()`)
    await until(`document.querySelector('.aula-preview-header strong')?.textContent.includes('.pptx') &&
      !!document.querySelector('.aula-preview-modal iframe')`)
    assert.equal(await evaluate(`document.querySelector('.aula-preview-modal iframe')?.title`), 'Presentación de clase.pptx')
    assert.equal(apiReads.filter(path => path.endsWith('/vista-oficina')).length, 2,
      'Cada Office se configura una vez al abrirlo; no se descarga un PDF.')
    await sleep(450)
    await screenshot('aula-adjuntos-visor-desktop')
    await evaluate(`document.querySelector('.aula-preview-modal .btn-close').click()`)
    await until(`!document.querySelector('.aula-preview-modal.show')`)
    const beforeUploadReads = apiReads.length
    const beforeUploadWrites = apiWrites.length
    await evaluate(`(() => {
      const input = document.querySelector('.aula-resource-page input[type="file"]')
      const transfer = new DataTransfer()
      transfer.items.add(new File(['%PDF-1.4'], 'Material adicional.pdf', {type:'application/pdf'}))
      input.files = transfer.files
      input.dispatchEvent(new Event('change', {bubbles:true}))
    })()`)
    await until(`document.querySelectorAll('.aula-material').length === 3`)
    assert.ok(await evaluate(`!!document.querySelector('.aula-material-thumb-pdf .bi-file-earmark-pdf-fill') &&
      document.querySelectorAll('.aula-material-file-icon').length === 3`),
    'Al agregar un PDF, las tres tarjetas deben conservar su ícono de formato.')
    await screenshot('aula-adjuntos-iconos-desktop')
    await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
    await screenshot('aula-adjuntos-iconos-mobile', true)
    const mobileAttachmentLayout = await evaluate(`({width: innerWidth, scroll: document.documentElement.scrollWidth,
      icons: [...document.querySelectorAll('.aula-material-file-icon')].map(icon => ({width: icon.getBoundingClientRect().width,
        fontSize: getComputedStyle(icon).fontSize, color: getComputedStyle(icon).color}))})`)
    assert.ok(mobileAttachmentLayout.scroll <= mobileAttachmentLayout.width + 1 &&
      mobileAttachmentLayout.icons.every(icon => icon.width > 20),
    `Los íconos de los adjuntos deben seguir visibles sin desbordamiento en móvil: ${JSON.stringify(mobileAttachmentLayout)}`)
    await command('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false})
    await sleep(350)
    assert.deepEqual(apiWrites.slice(beforeUploadWrites), [`/api/aula/recursos/${'z'.repeat(24)}/adjuntos`],
      'Subir un archivo debe enviar una sola escritura.')
    const uploadReads = apiReads.slice(beforeUploadReads)
    for (const path of [`/api/aula/recursos/${'z'.repeat(24)}`, `/api/aula/${'y'.repeat(24)}`,
      `/api/aula/recursos/${'z'.repeat(24)}/entregas`]) {
      assert.equal(uploadReads.filter(read => read === path).length, 0,
        `La subida ya recibió el adjunto y no debe volver a consultar ${path}.`)
    }
    assert.deepEqual(uploadReads.filter(path => ['/api/me', '/api/onboarding/status', '/api/estructura/sedes',
      '/api/anos-lectivos', '/api/horarios', '/api/siee', '/api/aula/catalogo'].includes(path)), [],
    'Adjuntar un archivo no debe recargar identidad ni catálogos académicos.')
    const beforeRemovalReads = apiReads.length
    const beforeRemovalWrites = apiWrites.length
    await evaluate(`(() => {
      window.confirm = () => true
      const file = [...document.querySelectorAll('.aula-material')].find(item => item.textContent.includes('Material adicional.pdf'))
      file.querySelector('.aula-material-actions button:last-child').click()
    })()`)
    await until(`document.querySelectorAll('.aula-material').length === 2`)
    await sleep(350)
    assert.deepEqual(apiWrites.slice(beforeRemovalWrites), [`/api/aula/adjuntos/${'n'.repeat(24)}`],
      'Quitar un adjunto debe enviar una sola escritura.')
    assert.deepEqual(apiReads.slice(beforeRemovalReads).filter(path => path.startsWith('/api/aula/')), [],
      'Quitar un adjunto debe actualizar la caché sin releer el aula, recurso ni entregas.')
    fixtures['/api/aula/recursos/' + 'z'.repeat(24)].data.adjuntos = [
      {token: 'h'.repeat(24), nombre: 'Guía en PDF.pdf', mime: 'application/pdf', es_imagen: false}]
    await command('Page.reload')
    await until(`!!document.querySelector('.aula-material-grid.is-single .aula-material-inline iframe')`)
    assert.ok(await evaluate(`document.querySelectorAll('.aula-material-grid.is-single .aula-material').length === 1`),
      'Un solo archivo debe conservar su vista previa dentro del recurso.')
    await screenshot('aula-adjunto-unico-desktop')
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Editar recurso')).click()`)
    await until(`document.body.innerText.includes('Tipo de contenido') && !!document.querySelector('.aula-resource-form select')`)
    assert.ok(await evaluate(`!!document.querySelector('.aula-sidebar') && !!document.querySelector('.aula-resource-form')`),
      'Editar desde el recurso debe abrir el formulario en el panel derecho para poder cambiar de sección.')
    const beforeEditReads = apiReads.length
    const beforeEditWrites = apiWrites.length
    await evaluate(`(() => {
      const input = document.querySelector('.aula-resource-form input[required]')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, 'Guía de lectura actualizada')
      input.dispatchEvent(new Event('input', {bubbles: true}))
      document.querySelector('.aula-resource-form .aula-form-actions button:last-child').click()
    })()`)
    await until(`!!document.querySelector('.aula-resource-page')`)
    await sleep(350)
    assert.ok(await evaluate(`document.body.innerText.includes('Guía de lectura actualizada')`),
      'La edición debe reflejar el título actualizado en la vista del recurso.')
    assert.deepEqual(apiWrites.slice(beforeEditWrites), [`/api/aula/recursos/${'z'.repeat(24)}`],
      'Editar un recurso debe enviar una sola escritura.')
    assert.deepEqual(apiReads.slice(beforeEditReads).filter(path => [
      `/api/aula/recursos/${'z'.repeat(24)}`, `/api/aula/${'y'.repeat(24)}`,
      `/api/aula/recursos/${'z'.repeat(24)}/entregas`,
    ].includes(path)), [],
      'La edición debe usar la respuesta de la API sin repetir GET de aula ni recurso.')
    await navigate('/evaluacion/aula/recursos/' + 'q'.repeat(24), 'Preguntas del cuestionario')
    assert.ok(await evaluate(`!!document.querySelector('.aula-question-layout') && !!document.querySelector('.aula-sidebar .aula-nav-resource.is-active')`),
      'El editor de preguntas debe tener navegación propia y conservar el menú del aula.')
    await evaluate(`[...document.querySelectorAll('.aula-question-header button')].find(button => button.textContent.includes('Agregar pregunta')).click()`)
    assert.ok(await evaluate(`document.querySelectorAll('.aula-question-index>button').length === 2 && document.querySelector('.aula-question-stage textarea')?.offsetWidth > 300`),
      'El editor debe agregar preguntas y sus campos deben aprovechar el ancho del panel.')
    await screenshot('aula-cuestionario-desktop')
    await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), 'Aula mobile viewport overflows.')
    await screenshot('aula-recurso-mobile', true)
    await navigate('/evaluacion/aula/' + 'y'.repeat(24), 'Semana 1')
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), 'Aula detail mobile viewport overflows.')
    await screenshot('aula-detalle-mobile', true)
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Agregar recurso')).click()`)
    await until(`!!document.querySelector('.aula-resource-form .aula-kind-grid')`)
    await sleep(500)
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1 && !!document.querySelector('.aula-resource-form .aula-form-actions button:last-child')`),
      'El compositor y su botón de guardar deben ser accesibles en móvil.')
    await screenshot('aula-compositor-mobile')
    const reading = fixtures[`/api/aula/recursos/${'z'.repeat(24)}`].data
    Object.assign(reading, {estudiante: true, progreso: 'sin_iniciar', completar_al: 'abrir', puede_gestionar: false})
    const openingsBefore = apiWrites.filter(path => path.endsWith('/abrir')).length
    await navigate('/evaluacion/aula/recursos/' + 'z'.repeat(24), 'Lee con atención.')
    await until(`document.body.innerText.includes('Lee con atención.')`)
    for (let i = 0; i < 30 && apiWrites.filter(path => path.endsWith('/abrir')).length === openingsBefore; i++) await sleep(100)
    assert.equal(apiWrites.filter(path => path.endsWith('/abrir')).length - openingsBefore, 1,
      'La primera lectura debe registrar una sola apertura.')
    await sleep(400)
    assert.equal(apiWrites.filter(path => path.endsWith('/abrir')).length - openingsBefore, 1,
      'Ni los cambios de progreso ni los re-renderizados deben repetir la apertura.')
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Contenido del aula')).click()`)
    await until(`!!document.querySelector('.aula-sidebar') && document.body.innerText.includes('Semana 1')`)
    await evaluate(`document.querySelector('.aula-sidebar .aula-nav-resource').click()`)
    await until(`document.body.innerText.includes('Lee con atención.')`)
    assert.equal(apiWrites.filter(path => path.endsWith('/abrir')).length - openingsBefore, 1,
      'Volver por navegación interna a un recurso completado no debe repetir la apertura.')
    assert.deepEqual(errors, [], 'Uncaught browser errors in Aula.')
    console.log('PASS: Aula catalog, section, safe content and mobile layout with isolated fixtures.')
  } else if (workflowMode) {
    await navigate('/academico/siee', 'Currículo por Grado')
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Agregar materias a grados')).click()`)
    await until(`document.querySelectorAll('.curriculum-bulk-modal input[type="checkbox"]').length === 3`)
    await evaluate(`[...document.querySelectorAll('.curriculum-bulk-modal button')].find(b=>b.textContent.includes('Seleccionar todos los grados')).click()`)
    await until(`document.querySelectorAll('.curriculum-bulk-modal details').length === 3`)
    assert.ok(await evaluate(`!document.querySelector('.curriculum-bulk-modal details').innerText.includes('Lectura inicial')`))
    assert.ok(await evaluate(`document.querySelectorAll('.curriculum-bulk-modal details')[2].innerText.includes('Lectura inicial') && !document.querySelectorAll('.curriculum-bulk-modal details')[2].innerText.includes('Geometría')`))
    assert.equal(await evaluate(`document.querySelectorAll('.curriculum-bulk-modal input[inputmode="decimal"]').length`), 0)
    await evaluate(`document.querySelector('.curriculum-bulk-modal section button').click()`)
    await evaluate(`document.querySelectorAll('.curriculum-bulk-modal details')[2].querySelector('button').click()`)
    await screenshot('curriculum-bulk-desktop', true)
    await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true)
    await screenshot('curriculum-bulk-mobile', true)
    await command('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false})
    await evaluate(`document.querySelector('.curriculum-bulk-modal .modal-footer .btn-primary').click()`)
    await until(`!document.querySelector('.modal.show')`)
    const saved = writes.find(w=>w.path === sieeCurriculumPath + '/masivo')
    assert.equal(saved.body.items.length, 4)
    assert.ok(saved.body.items.every(i=>i.peso_area === null))
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Configuración actual')).click()`)
    await until(`document.querySelectorAll('.curriculum-bulk-modal details').length === 3 && document.querySelectorAll('.curriculum-bulk-modal details input[type="checkbox"]:checked').length >= 4`)
    assert.ok(await evaluate(`(()=>{const first=document.querySelector('.curriculum-bulk-modal details');const math=[...first.querySelectorAll('label')].find(e=>e.textContent.includes('Matemáticas'))?.querySelector('input[type="checkbox"]');const geometry=[...first.querySelectorAll('label')].find(e=>e.textContent.includes('Geometría'))?.querySelector('input[type="checkbox"]');return math?.checked && math.disabled && geometry && !geometry.checked})()`), 'La configuración actual debe marcar las materias ya inscritas y mostrar las faltantes.')
    await evaluate(`(()=>{const first=document.querySelector('.curriculum-bulk-modal details');[...first.querySelectorAll('label')].find(e=>e.textContent.includes('Geometría')).querySelector('input[type="checkbox"]').click()})()`)
    await until(`document.querySelector('.curriculum-bulk-modal .modal-footer')?.innerText.includes('1 relaciones nuevas')`)
    await evaluate(`document.querySelector('.curriculum-bulk-modal .modal-footer .btn-primary').click()`)
    await until(`!document.querySelector('.modal.show')`)
    const updates = writes.filter(w=>w.path === sieeCurriculumPath + '/masivo')
    assert.equal(updates.length, 2)
    assert.deepEqual(updates[1].body.items, [{grado_token: sieeTokens.grade, materia_token: '6'.repeat(24), peso_area: null}])
    assert.equal(fixtures[sieeCurriculumPath].data.length, 5)
    await navigate('/academico/plan-estudios?tab=areas', 'Nueva materia')
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Nueva materia')).click()`)
    await until(`!!document.querySelector('.modal.show select:required')`)
    assert.ok(await evaluate(`(()=>{const select=[...document.querySelectorAll('.modal.show select')].find(e=>e.textContent.includes('Todos los niveles'));return select?.required && select.value==='' && select.options[0].textContent.includes('Selecciona el nivel educativo') && select.options[1].textContent.includes('Todos los niveles')})()`), 'Una materia nueva debe exigir elegir nivel o Todos los niveles explícitamente.')
    await evaluate(`document.querySelector('.modal.show .modal-header .btn').click()`)
    await until(`!document.querySelector('.modal.show')`)
    const subjectLevelFilter = `document.querySelector('section[aria-label="Materias"] select[aria-label="Nivel educativo"]')`
    await until(`${subjectLevelFilter}?.options.length === 3`)
    assert.ok(await evaluate(`(()=>{const select=${subjectLevelFilter};return select.value==='' && select.options[0].textContent.includes('Selecciona el nivel educativo') && select.options[1].textContent.includes('Todos los niveles')})()`))
    await evaluate(`(()=>{const select=${subjectLevelFilter};select.value='__all__';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`(()=>{const rows=document.querySelectorAll('section[aria-label="Materias"] table tbody tr');return rows.length===1 && rows[0].innerText.includes('Matemáticas')})()`)
    assert.ok(detailedReads.some(read => read.includes('/api/plan-estudios/materias?') && read.includes('nivel_general=1') && !read.includes('nivel_token=')))
    await evaluate(`(()=>{const select=${subjectLevelFilter};select.value='${sieeTokens.level}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`(()=>{const rows=document.querySelectorAll('section[aria-label="Materias"] table tbody tr');return rows.length===1 && rows[0].innerText.includes('Geometría')})()`)
    assert.ok(detailedReads.some(read => read.includes('/api/plan-estudios/materias?') && read.includes(`nivel_token=${sieeTokens.level}`) && !read.includes('nivel_general=1')))
    await evaluate(`(()=>{const select=${subjectLevelFilter};select.value='';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.querySelectorAll('section[aria-label="Materias"] table tbody tr').length===2`)
    await navigate('/evaluacion/catalogo', 'Mis Asignaciones')
    assert.equal(await evaluate(`!!document.querySelector('a[href="/admisiones/matriculas"]')`), true, 'Enrollment has its own navigation entry, separate from evaluation.')
    assert.equal(await evaluate(`!!document.querySelector('form')`), false, 'Evaluation no longer contains the enrollment form.')
    const select = async (label, value) => {
      await until(`!!document.querySelector('select[aria-label="${label}"] option[value="${value}"]')`)
      await evaluate(`(()=>{const e=document.querySelector('select[aria-label="${label}"]'); e.value='${value}';e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    }
    await select('Grupo', urlTokens.group)
    await select('Materia', urlTokens.materia)
    await until(`location.search.includes('grupo=${urlTokens.group}') && location.search.includes('materia=${urlTokens.materia}')`)
    await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Ver Planilla')`)
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Ver Planilla').click()`)
    await until(`!!document.querySelector('.grade-input')`)
    const dimensions = await evaluate(`(()=>{const input=document.querySelector('.grade-input').getBoundingClientRect(),table=document.querySelector('.grade-sheet-scroll').getBoundingClientRect(),card=document.querySelector('.grade-sheet-scroll').closest('.card').getBoundingClientRect();return {width:input.width,height:input.height,margin:table.x-card.x}})()`)
    assert.ok(dimensions.width >= 120 && dimensions.height <= 40 && dimensions.margin >= 15, JSON.stringify(dimensions))
    await evaluate(`[...document.querySelectorAll('a,button')].find(e=>e.textContent.includes('Volver a mis planillas')).click()`)
    await until(`!!document.querySelector('select[aria-label="Materia"]') && location.search.includes('materia=${urlTokens.materia}')`)
    await evaluate(`window.workflowReloadPending = true`)
    await command('Page.reload')
    await until(`!window.workflowReloadPending && document.readyState === 'complete' && document.querySelector('select[aria-label="Grupo"]')?.value === '${urlTokens.group}' && document.querySelector('select[aria-label="Materia"]')?.value === '${urlTokens.materia}'`)
    await navigate('/academico/plan-estudios?tab=horarios', 'Agregar clase')
    await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Agregar clase'))`)
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Agregar clase')).click()`)
    await until(`!!document.querySelector('.modal.show select[name="materia_id"]')`)
    assert.equal(await evaluate(`document.querySelector('.modal.show select[name="materia_id"]').disabled`), true)
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.modal.show select')].slice(0,3).map(e=>e.name)`), ['dia','grupo_id','materia_id'])
    await evaluate(`(()=>{const e=document.querySelector('.modal.show select[name="grupo_id"]');e.value='${urlTokens.group}';e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.querySelector('.modal.show select[name="materia_id"]').options.length > 1`)
    assert.ok(await evaluate(`(()=>{const text=document.querySelector('.modal.show select[name="materia_id"]').textContent;return text.includes('Geometría') && text.includes('Matemáticas') && !text.includes('Lectura inicial')})()`), 'Horario de Primaria debe ofrecer su nivel y Todos los niveles, no Preescolar.')
    await evaluate(`(()=>{const e=document.querySelector('.modal.show select[name="materia_id"]');e.value='${urlTokens.materia}';e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await evaluate(`(()=>{const e=document.querySelector('.modal.show select[name="grupo_id"]');e.value='${urlTokens.groupB}';e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.querySelector('.modal.show select[name="materia_id"]').value === ''`)
    await evaluate(`(()=>{const e=document.querySelector('.modal.show select[name="grupo_id"]');e.value='${urlTokens.groupPre}';e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.querySelector('.modal.show select[name="materia_id"]').textContent.includes('Lectura inicial')`)
    assert.ok(await evaluate(`(()=>{const text=document.querySelector('.modal.show select[name="materia_id"]').textContent;return text.includes('Matemáticas') && !text.includes('Geometría')})()`), 'Horario de Prejardín debe ofrecer su nivel y Todos los niveles, no Primaria.')
    await screenshot('schedule-group-subject', true)
    await evaluate(`document.querySelector('.modal.show .btn-close').click()`)
    await until(`!document.querySelector('.modal.show')`)
    await navigate('/academico/plan-estudios?tab=asignaciones', 'Asignar docente')
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Asignar docente')).click()`)
    await until(`!!document.querySelector('.modal.show select[name="grupo_id"]')`)
    await evaluate(`(()=>{const e=document.querySelector('.modal.show select[name="grupo_id"]');e.value='${urlTokens.groupPre}';e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.querySelector('.modal.show select[name="materia_id"]').textContent.includes('Lectura inicial')`)
    assert.ok(await evaluate(`(()=>{const text=document.querySelector('.modal.show select[name="materia_id"]').textContent;return text.includes('Matemáticas') && !text.includes('Geometría')})()`), 'Asignación docente de Prejardín debe ofrecer su nivel y Todos los niveles, no Primaria.')
    assert.deepEqual(errors, [])
    console.log('PASS: multi-grade curriculum, group-level plus all-level subjects in Horarios and Asignación docente, atomic payload, responsive modal, admissions separation, filter reload/return and compact grade grid.')
  } else if (gradingMode) {
    await navigate(`/evaluacion/planillas/${urlTokens.assignment}/${urlTokens.period}`, 'Taller 1')
    await until(`document.querySelectorAll('.grade-input').length === 4`)
    await evaluate(`(() => {const data = new DataTransfer(); data.setData('text/plain', '4,5\\t3.5\\n5\\t4'); document.querySelector('.grade-input').dispatchEvent(new ClipboardEvent('paste', {bubbles:true, clipboardData:data}))})()`)
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.grade-input')].map(i=>i.value)`), ['4.5','3.5','5','4'])
    await evaluate(`document.querySelector('.grade-input').focus(); document.querySelector('.grade-input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`)
    assert.equal(await evaluate(`document.activeElement.dataset.gradeRow`), '1')
    await evaluate(`(() => {const e=document.querySelector('#grade-save-reason'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Registro de actividades'); e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar cambios' && !b.closest('.modal')).click()`)
    await until(`!document.querySelector('#grade-save-reason')`)
    assert.equal(writes.find(w => w.path === opaquePlanillaPath).body.notas[0].valor, '4.5')
    await evaluate(`(() => {const e=document.querySelector('.grade-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'4.2'); e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await until(`!!document.querySelector('#grade-save-reason')`)
    assert.equal(await evaluate(`document.querySelector('#grade-save-reason').value`), '', 'Cada guardado debe pedir un motivo nuevo.')
    await evaluate(`(() => {const e=document.querySelector('#grade-save-reason'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Corrección posterior'); e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar cambios' && !b.closest('.modal')).click()`)
    await until(`!document.querySelector('#grade-save-reason')`)
    assert.equal(writes.filter(w => w.path === opaquePlanillaPath)[1].body.notas[0].motivo, 'Corrección posterior')
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Actividad').click()`)
    await until(`!!document.querySelector('#grade-activity-name')`)
    await evaluate(`(() => {const e=document.querySelector('#grade-activity-name'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Quiz de lectura'); e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await evaluate(`document.querySelector('.modal-footer .btn-primary').click()`)
    await until(`!document.querySelector('.modal.show') && document.body.innerText.includes('Quiz de lectura')`)
    await evaluate(`[...document.querySelectorAll('th button')].find(b=>b.textContent.includes('Quiz de lectura')).click()`)
    await until(`!!document.querySelector('#grade-activity-name')`)
    await evaluate(`(() => {const e=document.querySelector('#grade-activity-name'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Quiz de comprensión'); e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await evaluate(`document.querySelector('.modal-footer .btn-primary').click()`)
    await until(`!document.querySelector('.modal.show') && document.body.innerText.includes('Quiz de comprensión')`)
    assert.ok(writes.some(w => w.body.operacion === 'editar' && w.body.nombre === 'Quiz de comprensión'))
    await screenshot('grading-desktop', true)
    await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
    await screenshot('grading-mobile', true)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true, 'Only the grade grid should scroll horizontally.')
    await navigate('/academico/preinformes', 'Preinformes')
    await until(`!!document.querySelector('#pre-name-0')`)
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Agregar preinforme')).click()`)
    await until(`!!document.querySelector('#pre-name-2')`)
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar cambios').click()`)
    await until(`document.querySelector('button.btn-primary')?.disabled === true`)
    assert.ok(writes.some(w => w.path.startsWith('/api/preinformes/') && w.body.preinformes.length === 3))
    await screenshot('preinformes-mobile', true)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true)
    await command('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false})
    await screenshot('preinformes-desktop', true)
    assert.equal(errors.length, 0, JSON.stringify(errors))
    console.log('PASS: new grading UI, Excel paste, keyboard navigation, canonical decimal save, activity creation/edit, preinformes save and mobile overflow.')
  } else if (process.argv.includes('--promotion')) {
    await navigate('/academico/anos-lectivos', 'Años lectivos')
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.trim()==='Promoción').click()`)
    await until(`document.querySelector('.modal.show')?.innerText.includes('Mariana Rodríguez Peña')`)
    assert.ok(await evaluate(`document.querySelector('.modal.show').innerText.includes('Política del año')`))
    await screenshot('promotion-desktop', true)
    await evaluate(`(()=>{const modal=document.querySelector('.modal.show');modal.querySelector('input[type="checkbox"]').click();[...modal.querySelectorAll('button')].find(button=>button.textContent.trim()==='Guardar política').click()})()`)
    for (let i = 0; i < 40 && !writes.some(write => write.path === `${promotionPath}/politica`); i++) await sleep(100)
    assert.ok(writes.some(write => write.path === `${promotionPath}/politica` && write.body.materias_obligatorias[0] === urlTokens.materia))
    await sleep(500)
    await evaluate(`(()=>{const modal=document.querySelector('.modal.show');const target=modal.querySelectorAll('select')[1];target.value='${'u'.repeat(24)}';target.dispatchEvent(new Event('change',{bubbles:true}));modal.querySelector('input[maxlength="2000"]').focus()})()`)
    await command('Input.insertText', {text: 'Resultados anuales revisados por rectoría'})
    await evaluate(`[...document.querySelectorAll('.modal.show button')].find(button=>button.textContent.trim()==='Aprobar decisión').click()`)
    for (let i = 0; i < 40 && !writes.some(write => write.path === `${promotionPath}/${urlTokens.enrollment}`); i++) await sleep(100)
    assert.ok(writes.some(write => write.path === `${promotionPath}/${urlTokens.enrollment}`))
    await until(`document.querySelector('.modal.show')?.innerText.includes('Decisión vigente')`)
    for (const width of [390, 320]) {
      await command('Emulation.setDeviceMetricsOverride', {width, height: 844, deviceScaleFactor: 1, mobile: true})
      await sleep(250)
      assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), 'Promotion modal must fit mobile width.')
      await screenshot(`promotion-mobile-${width}`, true)
    }
    assert.deepEqual(errors, [])
    console.log('PASS: promotion policy, approval and responsive desktop/mobile layout.')
  } else if (cacheMode) {
    user.onboarding = fixtures['/api/onboarding/status']
    await navigate('/academico/anos-lectivos', 'Años lectivos')
    await sleep(500)
    await evaluate(`window.cacheNavigationSentinel = 'same-document'`)
    const menu = async (route, title) => {
      await evaluate(`document.querySelector('a[data-kt-nav=${JSON.stringify(route)}]').click()`)
      await until(`location.pathname === ${JSON.stringify(route)} && document.body.innerText.includes(${JSON.stringify(title)})`)
      await sleep(400)
    }
    const tab = async (label, key) => {
      await evaluate(`[...document.querySelectorAll('.nav-tabs .nav-link')].find(a=>a.textContent.trim()===${JSON.stringify(label)}).click()`)
      await until(`new URLSearchParams(location.search).get('tab') === ${JSON.stringify(key)}`)
      await sleep(400)
    }
    await menu('/academico/estructura', 'Estructura organizacional')
    await tab('Niveles', 'niveles')
    await menu('/academico/siee', 'Currículo por Grado')
    assert.equal(apiReads.filter(p => p === '/api/anos-lectivos').length, 1, 'SIEE reuses the loaded year selector.')
    await menu('/academico/plan-estudios', 'Plan de estudios')
    let before = detailedReads.length
    await tab('Áreas y materias', 'areas')
    const areaReads = detailedReads.slice(before)
    assert.equal(areaReads.filter(p => p.startsWith('/api/plan-estudios/areas?')).length, 1, JSON.stringify(areaReads))
    assert.equal(areaReads.filter(p => p.startsWith('/api/plan-estudios/materias?')).length, 1)
    assert.equal(areaReads.filter(p => p.startsWith('/api/estructura/niveles?')).length, 0, 'Reuse the complete structure level table as a catalog.')
    before = detailedReads.length
    await evaluate(`(()=>{const select=document.querySelector('section select[aria-label="Estado"]');select.value='activo';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await sleep(400)
    assert.equal(detailedReads.slice(before).filter(p => p.startsWith('/api/plan-estudios/areas?')).length, 1, 'A new filter has its own request.')
    before = detailedReads.length
    await evaluate(`(()=>{const select=document.querySelector('section select[aria-label="Estado"]');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await sleep(400)
    assert.deepEqual(detailedReads.slice(before), [], 'Clearing a filter reuses the unfiltered cache key.')
    before = detailedReads.length
    await tab('Asignación docente', 'asignaciones')
    assert.equal(detailedReads.slice(before).filter(p => p.startsWith('/api/horarios?')).length, 1, 'One response provides assignment rows AND catalogs.')
    assert.equal(detailedReads.slice(before).filter(p => p.startsWith('/api/catalogos-academicos?')).length, 0, 'No catalog download on tab entry.')
    await evaluate(`document.querySelector('select[aria-label="Grupo"]').dispatchEvent(new PointerEvent('pointerover', {bubbles:true}))`)
    await sleep(300)
    assert.equal(detailedReads.slice(before).filter(p => p.startsWith('/api/catalogos-academicos?')).length, 0, 'Hover must not download selectors.')
    await tab('Horarios', 'horarios')
    before = detailedReads.length
    await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Grupo"]');select.value='${urlTokens.group}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`!!document.querySelector('.schedule-session')`)
    await sleep(400)
    assert.equal(detailedReads.slice(before).filter(p => p.startsWith('/api/horarios?')).length, 1, 'Changing group needs one timetable response, not a catalog + timetable.')
    // Exceed the old 30-second expiry without a page reload or changing the
    // realtime recovery clock (which deliberately reconciles disconnected tabs).
    await evaluate(`window.originalNow=Date.now; Date.now=()=>window.originalNow()+35000`)
    await tab('Áreas y materias', 'areas')
    await menu('/academico/siee', 'Currículo por Grado')
    await menu('/academico/plan-estudios', 'Plan de estudios')
    await tab('Áreas y materias', 'areas')
    before = detailedReads.length
    await tab('Asignación docente', 'asignaciones')
    await tab('Áreas y materias', 'areas')
    await menu('/academico/siee', 'Currículo por Grado')
    assert.deepEqual(detailedReads.slice(before), [], 'Returning to cached views must not request unchanged data.')
    assert.equal(apiReads.filter(p => p === '/api/anos-lectivos').length, 1)
    assert.equal(await evaluate('window.cacheNavigationSentinel'), 'same-document')
    await evaluate(`Date.now=window.originalNow`)
    await menu('/academico/plan-estudios', 'Plan de estudios')
    await tab('Áreas y materias', 'areas')
    await evaluate(`document.querySelector('section table tbody tr td:last-child button').click()`)
    await until(`!!document.querySelector('.modal.show form')`)
    before = detailedReads.length
    await evaluate(`document.querySelector('.modal.show form').requestSubmit()`)
    await until(`!document.querySelector('.modal.show')`)
    await sleep(500)
    const afterSave = detailedReads.slice(before)
    assert.equal(afterSave.filter(p => p.startsWith('/api/plan-estudios/areas?')).length, 1, 'Hook + local realtime invalidation refresh areas only once after a save.')
    assert.equal(afterSave.filter(p => p.startsWith('/api/plan-estudios/materias?')).length, 1)
    assert.equal(afterSave.filter(p => p.startsWith('/api/anos-lectivos')).length, 0, 'Editing an area must not reload years.')
    assert.ok(writes.some(write => write.method === 'PUT' && write.path.startsWith('/api/plan-estudios/areas/')))
    assert.deepEqual(errors, [])
    console.log('PASS: SPA cache >30s; years once across SIEE/plan; areas 1; assignments 1; group timetable 1; cached return 0; hover 0; save refreshes once.')
    console.log('Measured GETs:', JSON.stringify(detailedReads))
  } else if (performanceMode) {
    user.onboarding = fixtures['/api/onboarding/status']
    const route = `/academico/plan-estudios?ano=${urlTokens.year}&tab=areas`
    await navigate(route, 'Matemáticas')
    await sleep(500)
    assert.equal(apiReads.filter(path => path === '/api/me').length, 1, 'One session validation on startup.')
    assert.equal(apiReads.filter(path => path === '/api/onboarding/status').length, 0, 'Onboarding is bootstrapped by /me.')
    const before = apiReads.length
    await command('Page.reload')
    await until(`document.querySelector('table')?.innerText.includes('Matemáticas')`)
    await sleep(500)
    const reloadReads = apiReads.slice(before)
    assert.equal(reloadReads.filter(path => path === '/api/me').length, 1, 'F5 validates the session exactly once.')
    assert.equal(reloadReads.filter(path => path === '/api/onboarding/status').length, 0)
    assert.deepEqual(errors, [])
    console.log('PASS: startup and F5: 1 /me, 0 /onboarding/status; no uncaught errors.')
  } else if (platformMode) {
    await navigate('/configuracion/colegios', 'Colegio de prueba')
    assert.equal(apiReads.filter(path => path === '/api/estructura/sedes').length, 0,
      'La plataforma sin suplantación no necesita cargar sedes del colegio en la barra lateral.')
    assert.equal(await evaluate(`localStorage.getItem('colegio-saas.auth-token')`), null)
    await evaluate(`document.querySelector('table tbody tr td:last-child button:nth-of-type(3)').click()`)
    await until(`document.querySelector('#kt_modal_colegio_sedes')?.innerText.includes('Sede Norte')`)
    assert.ok(writes.every(write => !write.path.includes('/colegios/1')))
    const sedeRead = '/api/colegios/colegio-prueba/sedes'
    assert.ok(await evaluate(`!!document.querySelector('#kt_modal_colegio_sedes tr')`))
    await evaluate(`document.querySelector('#kt_modal_colegio_sedes tbody tr td:last-child button').click()`)
    await until(`!!document.querySelector('#kt_modal_colegio_sedes form')`)
    await evaluate(`(()=>{const input=document.querySelector('#kt_modal_colegio_sedes form input[type="text"]');input.focus();input.select()})()`)
    await command('Input.insertText', {text: 'Sede Norte Renovada'})
    await evaluate(`document.querySelector('#kt_modal_colegio_sedes form button[type="submit"]').click()`)
    for (let i = 0; i < 30 && !writes.some(write => write.path === `${sedeRead}/${urlTokens.sede}`); i++) await sleep(100)
    assert.ok(writes.some(write => write.method === 'PUT' && write.path === `${sedeRead}/${urlTokens.sede}` && write.body.nombre === 'Sede Norte Renovada'))
    await navigate('/configuracion/auditoria', 'Auditoría')
    await until(`document.querySelector('#audit-tenant')?.options.length > 1`)
    await evaluate(`(()=>{const select=document.querySelector('#audit-tenant');select.value='colegio-prueba';select.dispatchEvent(new Event('change',{bubbles:true}));select.closest('form').requestSubmit()})()`)
    for (let i = 0; i < 30 && !auditReads.includes('colegio-prueba'); i++) await sleep(100)
    assert.ok(auditReads.includes('colegio-prueba'), 'Audit school filters must use public slugs.')
    assert.deepEqual(errors, [], 'Platform public identifier browser errors.')
    console.log('PASS: Colegios uses slug; platform sede edit uses opaque token and no stored credential.')
  } else if (process.argv.includes('--account')) {
    user.institution = {name: 'Colegio real', plan: {key: 'premium', name: 'Premium'}}
    user.profile_capabilities = {edit_name: true, edit_email: true, edit_phone: true, google_link: false}
    await navigate('/account/overview', 'Rector de prueba')
    assert.ok(await evaluate(`document.querySelector('.account-summary__tabs a[href="/account/overview"]').classList.contains('active') && !document.querySelector('.account-summary__tabs a[href="/account/settings"]').classList.contains('active')`))
    assert.ok(await evaluate(`getComputedStyle(document.querySelector('.account-summary__tabs a.active')).borderBottomColor !== getComputedStyle(document.querySelector('.account-summary__tabs a:not(.active)')).borderBottomColor`), 'The active profile tab needs a visible underline.')
    assert.ok(await evaluate(`Math.abs(document.querySelector('.account-summary').getBoundingClientRect().bottom - document.querySelector('.account-summary__tabs').getBoundingClientRect().bottom) < 2`), 'Profile tabs should meet the bottom of the header card.')
    assert.ok(await evaluate(`!document.body.innerText.includes('Max Smith') && !document.body.innerText.includes('max@kt.com')`))
    await evaluate(`window.accountSentinel = true; document.querySelector('[data-kt-nav="/account/settings"]').click()`)
    await until(`location.pathname === '/account/settings' && !!document.querySelector('#profile-name')`)
    assert.ok(await evaluate(`document.querySelector('.account-summary__tabs a[href="/account/settings"]').classList.contains('active') && !document.querySelector('.account-summary__tabs a[href="/account/overview"]').classList.contains('active')`))
    assert.ok(await evaluate(`getComputedStyle(document.querySelector('.account-summary__tabs a.active')).borderBottomColor !== getComputedStyle(document.querySelector('.account-summary__tabs a:not(.active)')).borderBottomColor`))
    await evaluate(`document.querySelector('#profile-name').focus(); document.querySelector('#profile-name').select()`)
    await command('Input.insertText', {text: 'María Fernanda Rectora'})
    await evaluate(`document.querySelector('#profile-name').closest('form').querySelector('button[type="submit"]').click()`)
    await until(`document.querySelector('[data-testid="account-menu-name"]')?.textContent === 'María Fernanda Rectora'`)
    assert.equal(await evaluate('window.accountSentinel'), true, 'Profile updates without reload.')
    assert.equal(await evaluate(`document.querySelector('[data-testid="account-menu-plan"]').textContent`), 'Premium')
    await screenshot('profile-settings-desktop', true)
    await sleep(500)
    await evaluate(`document.querySelector('#kt_header_user_menu_toggle [data-kt-menu-trigger]').click()`)
    await until(`document.querySelector('.account-user-menu')?.classList.contains('show')`)
    assert.ok(await evaluate(`['Mis proyectos', 'Mi suscripción', 'Mis estados de cuenta', 'Ajustes Institucionales'].every(label => document.querySelector('.account-user-menu').innerText.includes(label))`))
    await until(`Number(getComputedStyle(document.querySelector('.account-user-menu')).opacity) >= 0.99`)
    await sleep(250)
    await screenshot('profile-menu-desktop')
    await evaluate(`document.querySelector('#profile-name').click()`)
    for (const width of [390, 320]) {
      await command('Emulation.setDeviceMetricsOverride', {width, height: 844, deviceScaleFactor: 1, mobile: true})
      await sleep(300)
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Profile settings must fit mobile.')
      await screenshot('profile-settings-mobile-' + width, true)
    }
    await sleep(500)
    await evaluate(`document.querySelector('#kt_header_user_menu_toggle [data-kt-menu-trigger]').click()`)
    await until(`document.querySelector('.account-user-menu')?.classList.contains('show')`)
    assert.ok(await evaluate(`document.querySelector('.account-user-menu').getBoundingClientRect().right <= innerWidth + 1`))
    await until(`Number(getComputedStyle(document.querySelector('.account-user-menu')).opacity) >= 0.99`)
    await sleep(250)
    await screenshot('profile-menu-mobile')
    user.mfa_required = false; user.mfa_enabled = false
    await navigate('/dashboard', 'Académico')
    assert.equal(await evaluate(`!!document.querySelector('#kt_header_user_menu_toggle')`), true)
    await navigate('/account/settings', 'Verificación en dos pasos')
    await evaluate(`document.querySelector('#mfa-password').focus()`)
    await command('Input.insertText', {text: 'Synthetic1!'})
    await evaluate(`document.querySelector('#mfa-password').closest('form').querySelector('button[type="submit"]').click()`)
    await until(`!!document.querySelector('.account-mfa-qr svg')`)
    assert.ok(await evaluate(`document.body.innerText.includes('no se introduce en Gmail')`))
    await evaluate(`document.querySelector('#account-security button[aria-expanded="false"]').click()`)
    assert.ok(await evaluate(`document.querySelector('[data-testid="mfa-secret"]').textContent === 'JBSWY3DPEHPK3PXP'`))
    await evaluate(`document.querySelector('#mfa-code').focus()`)
    await command('Input.insertText', {text: '123456'})
    await evaluate(`document.querySelector('#mfa-code').closest('form').querySelector('button[type="submit"]').click()`)
    await until(`!!document.querySelector('.account-recovery-codes')`)
    assert.equal(await evaluate(`document.querySelector('#account-security button.btn-primary').disabled`), true)
    await screenshot('mfa-recovery-mobile', true)
    await evaluate(`document.querySelector('#account-security input[type="checkbox"]').click(); document.querySelector('#account-security button.btn-primary').click()`)
    await until(`!!document.querySelector('#kt_header_user_menu_toggle')`)
    user.profile_capabilities.edit_name = false; user.profile_capabilities.edit_email = false; user.roles = ['estudiante']
    await navigate('/account/settings', 'El colegio administra')
    assert.ok(await evaluate(`document.querySelector('#profile-name').disabled && document.querySelector('#kt_signin_email_button button').disabled`))
    assert.deepEqual(errors, [], 'Profile and MFA browser errors.')
    console.log('PASS: profile menu, unrestricted dashboard, optional MFA QR and recovery, student restrictions, responsive 320/390.')
  } else if (paginationMode) {
    const path = `/academico/plan-estudios?ano=${urlTokens.year}&tab=areas`
    const areaRows = `document.querySelectorAll('table')[0]?.querySelectorAll('tbody tr')`
    await navigate(path, 'Áreas y materias')
    await until(`${areaRows}?.length === 20`)
    await evaluate(`document.querySelector('section[aria-label="Materias"]').scrollIntoView({block:'start'})`)
    await screenshot('materias-filters-desktop', true)
    assert.ok(await evaluate(`(()=>{const section=document.querySelector('section[aria-label="Materias"]');return !!section.querySelector('select[aria-label="Área"]') && !!section.querySelector('select[aria-label="Nivel educativo"]') && !!section.querySelector('select[aria-label="Estado"]') && section.querySelectorAll('input[type="search"]').length===1})()`), 'The Materias section needs one name search and visibly identified area, level, and status selectors.')
    await evaluate(`(()=>{const area=document.querySelector('section[aria-label="Materias"] select[aria-label="Área"]');area.focus();area.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))})()`)
    await until(`document.querySelector('section[aria-label="Materias"] select[aria-label="Área"]').options.length === 26`)
    assert.ok(pagedReads.some(read => read.page === 1 && read.perPage === 1000), 'Opening the area selector must load the remaining existing areas.')
    assert.ok(pagedReads.some(read => read.page === 1 && read.perPage === 20), 'The first area request must fetch twenty rows.')
    assert.ok(await evaluate(`!!document.querySelector('.pagination')`), 'More than 20 results require numbered pages.')
    assert.deepEqual(await evaluate(`Array.from(document.querySelector('select[aria-label="Filas por página"]').options).map(option => Number(option.value))`), [5, 10, 20, 50, 100, 1000])
    await evaluate(`Array.from(document.querySelectorAll('.pagination button')).find(button => button.textContent.trim() === '2').click()`)
    await until(`${areaRows}?.[0]?.innerText.includes('Área 21')`)
    assert.ok(pagedReads.some(read => read.page === 2 && read.perPage === 20), 'Page two must retain the default size.')
    await evaluate(`(() => {const select=document.querySelector('select[aria-label="Filas por página"]');select.value='50';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`${areaRows}?.length === 25`)
    assert.ok(pagedReads.some(read => read.page === 1 && read.perPage === 50), 'Changing the size must change the backend request.')
    await evaluate(`(() => {const select=document.querySelector('select[aria-label="Filas por página"]');select.value='5';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`${areaRows}?.length === 5`)
    assert.ok(pagedReads.some(read => read.page === 1 && read.perPage === 5), 'A user-selected five-row page size must reach the backend.')
    await evaluate(`document.querySelector('input[aria-label="Buscar por nombre"]').focus()`)
    await command('Input.insertText', {text: 'Área 25'})
    await until(`${areaRows}?.length === 1 && ${areaRows}?.[0]?.innerText.includes('Área 25')`)
    assert.ok(pagedReads.some(read => read.search === 'área 25'), 'Search must run on the backend.')
    const readsBeforeReload = pagedReads.length
    fixtures['/api/plan-estudios/areas'].data = fixtures['/api/plan-estudios/areas'].data.slice(0, 12)
    await navigate(path, 'Áreas y materias')
    await until(`${areaRows}?.length === 12`)
    assert.ok(pagedReads.slice(readsBeforeReload).some(read => read.page === 1 && read.perPage === 5), 'The explicit five-row preference remains saved after navigation.')
    assert.equal(await evaluate(`!!document.querySelector('.pagination') || !!document.querySelector('select[aria-label="Filas por página"]') || document.body.innerText.includes('Mostrar más')`), false, 'A list with twenty or fewer rows is complete and has no pagination footer.')
    await navigate('/academico/siee', 'Configuración SIEE')
    const curriculoRows = `document.querySelector('#siee-curriculo-search')?.closest('.card')?.querySelectorAll('table tbody tr')`
    await until(`${curriculoRows}?.length === 20`)
    assert.ok(pagedReads.some(read => read.path === sieeCurriculumPath && read.page === 1 && read.perPage === 20), 'Curriculum defaults to twenty rows.')
    assert.ok(await evaluate(`(()=>{const card=document.querySelector('#siee-curriculo-search').closest('.card');return card.querySelector('table tbody tr input[type="number"]')?.disabled===false && document.querySelector('.card-header button.btn-primary')?.disabled===true})()`), 'An empty closed term must not disable curriculum weights even while SIEE settings are locked.')
    assert.ok(await evaluate(`document.body.innerText.includes('Agregar materias a grados') && document.body.innerText.includes('Filtros de búsqueda')`))
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Agregar materias a grados')).click()`)
    await until(`!!document.querySelector('.curriculum-bulk-modal input[type="checkbox"]')`)
    await evaluate(`document.querySelector('.curriculum-bulk-modal input[type="checkbox"]').click()`)
    await until(`!!document.querySelector('.curriculum-bulk-modal details')`)
    assert.ok(await evaluate(`(()=>{const text=document.querySelector('.curriculum-bulk-modal details').innerText;return text.includes('Materia 01') && text.includes('Materia 02') && !text.includes('Materia 12')})()`))
    await evaluate(`document.querySelectorAll('.curriculum-bulk-modal details button')[1].click()`)
    await evaluate(`document.querySelector('.curriculum-bulk-modal details input[type="checkbox"]').click()`)
    await evaluate(`document.querySelector('.curriculum-bulk-modal input[inputmode="decimal"]').focus()`)
    await command('Input.insertText', {text: '20.5'})
    await evaluate(`document.querySelector('.curriculum-bulk-modal .modal-footer .btn-primary').click()`)
    await until(`!document.querySelector('.modal.show')`)
    await until(`document.querySelector('#siee-curriculo-search').closest('.card').querySelector('table tbody tr input[type="number"]')?.value === '20.5'`)
    assert.ok(writes.some(write => write.path === sieeCurriculumPath + '/masivo' && write.body.items[0].peso_area === '20.5'))
    await evaluate(`(()=>{const input=document.querySelector('#siee-curriculo-search').closest('.card').querySelector('table tbody tr input[type="number"]');input.focus();input.select()})()`)
    await command('Input.insertText', {text: '7.25'})
    await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13})
    await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13})
    for (let i = 0; i < 30 && !writes.some(write => write.path === sieeCurriculumPath && write.body.peso_area === '7.25'); i++) await sleep(100)
    assert.ok(writes.some(write => write.path === sieeCurriculumPath && write.body.peso_area === '7.25'), 'Enter must save the exact decimal typed.')
    await until(`(()=>{const input=document.querySelector('#siee-curriculo-search').closest('.card').querySelector('table tbody tr input[type="number"]');return input?.value==='7.25' && !input.disabled})()`)
    await evaluate(`(()=>{const input=document.querySelector('#siee-curriculo-search').closest('.card').querySelector('table tbody tr input[type="number"]');input.focus();input.select()})()`)
    await command('Input.insertText', {text: '9.5'})
    await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9})
    await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9})
    for (let i = 0; i < 30 && !writes.some(write => write.path === sieeCurriculumPath && write.body.peso_area === '9.5'); i++) await sleep(100)
    assert.ok(writes.some(write => write.path === sieeCurriculumPath && write.body.peso_area === '9.5'), 'Tab must save the exact decimal typed.')
    await sleep(500)
    await until(`(()=>{const card=document.querySelector('#siee-curriculo-search').closest('.card');return card.querySelector('[aria-busy]')?.getAttribute('aria-busy')==='false' && ![...card.querySelectorAll('button')].find(button=>button.textContent.trim()==='Mostrar más')?.disabled})()`)
    await screenshot('siee-curriculo-desktop', true)
    await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Curriculum form must fit a mobile viewport.')
    await screenshot('siee-curriculo-mobile', true)
    await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
    await evaluate(`(()=>{const select=document.querySelector('#siee-curriculo-search').closest('.card').querySelector('select[aria-label="Filas por página"]');select.value='5';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`${curriculoRows}?.length === 5`)
    assert.ok(pagedReads.some(read => read.path === sieeCurriculumPath && read.page === 1 && read.perPage === 5))
    await evaluate(`Array.from(document.querySelector('#siee-curriculo-search').closest('.card').querySelectorAll('.pagination button')).find(button => button.textContent.trim() === '2').click()`)
    await until(`${curriculoRows}?.length === 5 && ${curriculoRows}?.[0]?.innerText.includes('Materia 06')`)
    assert.ok(pagedReads.some(read => read.path === sieeCurriculumPath && read.page === 2 && read.perPage === 5))
    await evaluate(`document.querySelector('#siee-curriculo-search').focus()`)
    await command('Input.insertText', {text: 'Materia 25'})
    await until(`${curriculoRows}?.length === 1 && ${curriculoRows}?.[0]?.innerText.includes('Materia 25')`)
    assert.ok(pagedReads.some(read => read.path === sieeCurriculumPath && read.search === 'materia 25'))
    assert.equal(await evaluate(`!!document.querySelector('#siee-curriculo-search').closest('.card').querySelector('.pagination')`), false, 'Curriculum with one result hides pagination controls.')
    await navigate('/academico/evaluacion/catalogo', 'Evaluación')
    const assignmentRows = `document.querySelectorAll('table')[0]?.querySelectorAll('tbody tr')`
    await until(`${assignmentRows}?.length === 12`)
    assert.ok(pagedReads.some(read => read.path === '/api/evaluacion/catalogo' && read.assignmentPage === 1 && read.assignmentPerPage === 20 && read.enrollmentPage === 1 && read.enrollmentPerPage === 20))
    assert.equal(await evaluate(`!!document.querySelector('.pagination') || !!document.querySelector('select[aria-label="Filas por página"]') || document.body.innerText.includes('Mostrar más')`), false, 'Small assignment and enrollment catalogs have no pagination footer.')
    assert.ok(await evaluate(`!!document.querySelector('select[aria-label="Grupo"] option[value=""]') && !!document.querySelector('select[aria-label="Materia"] option[value=""]') && !document.querySelector('form')`))
    const catalogRoster = fixtures['/api/evaluacion/catalogo'].data.matriculas
    catalogRoster[0].nombre_lista = 'Andrade Anzuate Estudiante 01'
    catalogRoster[1].nombre_lista = 'Andrade Ortiz Estudiante 02'
    for (let i = 13; i <= 52; i++) catalogRoster.push({...enrollment, id: i, estudiante_id: i + 1,
      url_token: `k${String(i).padStart(23, '0')}`,
      estudiante: {id: i + 1, name: `Estudiante ${String(i).padStart(2, '0')}`},
      nombre_lista: `Zeta ${String(i).padStart(2, '0')} Estudiante ${String(i).padStart(2, '0')}`})
    fixtures['/api/evaluacion/planillas/1/1'].data.matriculas = catalogRoster
    fixtures['/api/evaluacion/planillas/1/1'].data.resultados = catalogRoster.map(matricula => ({matricula_id: matricula.id, estado: 'pendiente', motivo: 'Faltan notas'}))
    await navigate(`/academico/boletines?ano=${urlTokens.year}&grupo=${urlTokens.group}`, 'Boletín de Calificaciones')
    await until(`document.querySelectorAll('table tbody tr').length === 52`)
    const bulletinLayout = await evaluate(`(()=>{const table=document.querySelector('table'),container=table?.closest('.table-responsive');return {table:!!table,container:!!container,maxHeight:container?.style.maxHeight,height:table?.getBoundingClientRect().height,viewport:innerHeight,pagination:!!document.querySelector('.pagination'),pageSize:!!document.querySelector('select[aria-label="Filas por página"]'),first:document.querySelector('table tbody tr')?.innerText}})()`)
    assert.ok(bulletinLayout.table && bulletinLayout.container && !bulletinLayout.maxHeight && bulletinLayout.height > bulletinLayout.viewport && !bulletinLayout.pagination && !bulletinLayout.pageSize && bulletinLayout.first?.includes('Andrade Anzuate Estudiante 01'),
      `The bulletin roster stays in page flow without pagination: ${JSON.stringify(bulletinLayout)}`)
    await navigate(`/academico/evaluacion/planillas/${urlTokens.assignment}/${urlTokens.period}`, 'Taller 1')
    const planillaRows = `Array.from(document.querySelectorAll('table')).at(-1)?.querySelectorAll('tbody tr')`
    await until(`${planillaRows}?.length === 52`)
    assert.ok(pagedReads.some(read => read.path === opaquePlanillaPath && read.page === null && read.perPage === null))
    assert.ok(await evaluate(`(()=>{const region=document.querySelector('.grade-sheet-scroll');return region.scrollHeight>region.clientHeight && !document.querySelector('.pagination') && !document.querySelector('select[aria-label="Filas por página"]') && [...region.querySelectorAll('tbody tr')].at(-1)?.innerText.includes('Zeta 52')})()`), 'The gradebook shows all students in one scrollable sheet without pagination.')
    await evaluate(`document.querySelector('input[aria-label="Estudiante 01 · Taller 1"]').focus()`)
    await command('Input.insertText', {text: '4.2'})
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Estudiante 01 · Taller 1"]').value`), '4.2', 'Editing a small gradebook retains the exact draft.')
    assert.deepEqual(errors, [], 'Academic pagination browser errors.')
    console.log('PASS: areas and SIEE pagination; bulletin shows all 52 students in page flow and gradebook scrolls its full roster, without pagination.')
  } else if (realtimeMode) {
    user.institution = {name: 'Colegio de prueba', plan: {key: 'esencial', name: 'Esencial'}}
    user.onboarding = fixtures['/api/onboarding/status']
    const subscribed = `window.Echo?.connector.pusher.channels.channels['private-tenant.${user.tenant_channel}']?.subscribed === true`
    await navigate(`/academico/plan-estudios?ano=${urlTokens.year}&tab=horarios&grupo=${urlTokens.group}&espacio=${urlTokens.space}`, 'Horarios')
    await until(subscribed)
    await until(`!!document.querySelector('.schedule-session')`)
    await sleep(300)
    assert.equal(apiReads.filter(path => path === '/api/me').length, 1, 'Initial WebSocket subscription must not duplicate /me.')
    assert.equal(apiReads.filter(path => path === '/api/onboarding/status').length, 0)
    const hiddenReadsBefore = scheduleReads.length
    const canDeferHiddenTab = await evaluate(`(() => {
      Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'})
      return document.visibilityState === 'hidden'
    })()`)
    assert.equal(canDeferHiddenTab, true, 'The test must be able to model a hidden browser tab.')
    fixtures['/api/horarios'].data.sesiones[0].materia = {id: 1, nombre: 'Clase recibida con pestaña oculta'}
    reverbProbe({action: 'publish', resources: ['schedule']})
    await sleep(600)
    assert.equal(scheduleReads.length, hiddenReadsBefore,
      'A hidden tab must defer remote API reads until it becomes visible.')
    await evaluate(`(() => {
      Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'})
      document.dispatchEvent(new Event('visibilitychange'))
    })()`)
    await until(`document.body.innerText.includes('Clase recibida con pestaña oculta')`)
    assert.equal(scheduleReads.length, hiddenReadsBefore + 1,
      'Returning to the tab should refresh the affected schedule once.')
    const stormPaths = ['/api/estructura/sedes', '/api/horarios', '/api/me']
    const beforeStorm = new Map(stormPaths.map(path => [path, apiReads.filter(read => read === path).length]))
    reverbProbe({action: 'publish', count: 20, resources: ['all']})
    await sleep(600)
    for (const path of stormPaths) {
      const count = apiReads.filter(read => read === path).length - beforeStorm.get(path)
      assert.ok(count <= 1, `${path}: a burst of broadcasts must cause no more than one immediate read (got ${count}).`)
    }
    await sleep(5100)
    for (const path of stormPaths) {
      const count = apiReads.filter(read => read === path).length - beforeStorm.get(path)
      assert.ok(count <= 2, `${path}: the trailing refresh must remain bounded even after 20 broadcasts (got ${count}).`)
    }
    await evaluate(`window.realtimePageSentinel = 'unchanged'`)
    user.institution.plan = {key: 'premium', name: 'Premium'}
    reverbProbe({action: 'publish', resources: ['rbac']})
    await until(`document.querySelector('[data-testid="account-menu-plan"]')?.textContent === 'Premium'`)
    fixtures['/api/anos-lectivos'].data.push({...year, id: 3, url_token: 'n'.repeat(24), nombre: '2028'})
    reverbProbe({action: 'publish', resources: ['academic']})
    await until(`Array.from(document.querySelectorAll('option')).some(option => option.textContent.includes('2028'))`)
    assert.equal(await evaluate(`window.realtimePageSentinel`), 'unchanged', 'Year selectors must update without navigation/reload.')
    assert.ok(await evaluate(`location.search.includes('grupo=${urlTokens.group}') && location.search.includes('espacio=${urlTokens.space}')`), 'Remote changes preserve filters.')
    const readsBefore = scheduleReads.length
    const yearsBefore = apiReads.filter(path => path === '/api/anos-lectivos').length
    fixtures['/api/horarios'].data.sesiones[0].materia = {id: 1, nombre: 'Clase actualizada por otra sesión'}
    reverbProbe({action: 'publish', resources: ['schedule']})
    await until(`document.body.innerText.includes('Clase actualizada por otra sesión')`)
    assert.ok(scheduleReads.length > readsBefore)
    const scheduleUpdates = scheduleReads.slice(readsBefore)
    assert.equal(scheduleUpdates.length, 1, 'One remote schedule change causes one timetable read.')
    assert.equal(apiReads.filter(path => path === '/api/anos-lectivos').length, yearsBefore, 'A schedule change does not invalidate years.')
    assert.ok(scheduleUpdates.some(read => read.group === urlTokens.group), 'The selected group is refreshed.')
    assert.ok(scheduleUpdates.every(read => read.view === 'horarios' && [null, urlTokens.group].includes(read.group)), 'Only the empty filter catalog and selected group are requested.')
    await evaluate(`window.Echo.connector.pusher.disconnect()`)
    await until(`window.Echo.connector.pusher.connection.state === 'disconnected'`)
    fixtures['/api/anos-lectivos'].data[0].nombre = '2026 recuperado sin socket'
    await evaluate(`window.nowBeforeRecovery=Date.now; Date.now=()=>window.nowBeforeRecovery()+61000; document.dispatchEvent(new Event('visibilitychange'))`)
    await until(`Array.from(document.querySelectorAll('option')).some(option => option.textContent.includes('2026 recuperado sin socket'))`)
    await evaluate(`Date.now=window.nowBeforeRecovery`)
    fixtures['/api/anos-lectivos'].data.push({...year, id: 4, url_token: 'o'.repeat(24), nombre: '2029'})
    await evaluate(`window.Echo.connector.pusher.connect()`)
    await until(subscribed)
    await until(`Array.from(document.querySelectorAll('option')).some(option => option.textContent.includes('2029'))`)
    await navigate(`/academico/anos-lectivos?ano=${urlTokens.year}`, 'Años lectivos')
    await until(subscribed)
    user.permissions = user.permissions.filter(permission => permission !== 'academico.anos.transicionar')
    reverbProbe({action: 'publish', resources: ['rbac']})
    await until(`!Array.from(document.querySelectorAll('button')).some(button => /Cerrar año|Iniciar año|Reabrir año/.test(button.textContent))`)
    fixtures['/api/anos-lectivos'].data[0].nombre = '2026 actualizado'
    reverbProbe({action: 'publish', resources: ['academic']})
    await until(`document.body.innerText.includes('2026 actualizado')`)
    assert.deepEqual(errors, [], 'Realtime browser errors.')
    await screenshot('realtime-updated')
    console.log('PASS: real Reverb private channel, remote year selectors and schedules, preserved filters, reconnection, permission refresh and navigation.')
  } else if (process.env.ONBOARDING_PREVIEW === '1') {
    const stages = [
      {name: 'password', text: 'Cambia la contraseña temporal', status: {required: true, password_required: true, institution_required: true, institution: null, logo_url: null}},
      {name: 'logo', text: 'Logo del colegio', status: {required: true, password_required: false, institution_required: true, institution: null, logo_url: null}},
      {name: 'institution', text: 'Datos institucionales', status: {required: true, password_required: false, institution_required: true, institution: null, logo_url: '/media/logo-colegio-transparent.png'}},
    ]
    for (const stage of stages) {
      fixtures['/api/onboarding/status'] = stage.status
      await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
      await navigate('/bienvenida', stage.text)
      await screenshot(`onboarding-${stage.name}-desktop`, true)
      if (stage.name === 'logo') {
        await evaluate(`(() => { const canvas=document.createElement('canvas'); canvas.width=900; canvas.height=300; const ctx=canvas.getContext('2d'); for (const [index,color] of ['red','lime','blue'].entries()) {ctx.fillStyle=color;ctx.fillRect(index*300,0,300,300)} return new Promise(resolve => canvas.toBlob(blob => {const file=new File([blob],'school-logo.png',{type:'image/png'});const files=new DataTransfer();files.items.add(file);const input=document.querySelector('#school-logo-file');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));resolve(true)},'image/png')) })()`)
        await until(`document.querySelector('.logo-uploader-preview canvas')?.width === 900`)
        assert.equal(await evaluate(`document.querySelectorAll('.logo-uploader-controls input[type="range"]').length`), 1)
        assert.ok(await evaluate(`document.body.innerText.includes('Mantener proporción') && !document.body.innerText.includes('logo.squareHelp')`))
        await screenshot('onboarding-logo-wide-desktop', true)
        await evaluate(`document.querySelectorAll('.logo-uploader-modes button')[1].click()`)
        await until(`document.querySelector('.logo-uploader-preview canvas')?.width === 300`)
        assert.ok(await evaluate(`document.querySelector('.logo-uploader-preview canvas').getContext('2d').getImageData(150,150,1,1).data[1] > 200`))
        await evaluate(`document.querySelector('.logo-uploader-preview').scrollIntoView({block:'center'})`)
        const crop = await evaluate(`(() => {const box=document.querySelector('.logo-uploader-preview').getBoundingClientRect();return {fromX:box.left+30,toX:box.right-30,y:box.top+box.height/2}})()`)
        await command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: crop.fromX, y: crop.y})
        await command('Input.dispatchMouseEvent', {type: 'mousePressed', x: crop.fromX, y: crop.y, button: 'left', clickCount: 1})
        await command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: crop.toX, y: crop.y, button: 'left', buttons: 1})
        await command('Input.dispatchMouseEvent', {type: 'mouseReleased', x: crop.toX, y: crop.y, button: 'left', clickCount: 1})
        await until(`document.querySelector('.logo-uploader-preview canvas').getContext('2d').getImageData(150,150,1,1).data[0] > 200`)
        await screenshot('onboarding-logo-cropped-desktop', true)
        await evaluate(`document.querySelectorAll('.logo-uploader-modes button')[0].click()`)
        await until(`document.querySelector('.logo-uploader-preview canvas')?.width === 900`)
      }
      await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
      await sleep(250)
      assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), `${stage.name} overflows on mobile`)
      await screenshot(`onboarding-${stage.name}-mobile`, true)
      await command('Emulation.setDeviceMetricsOverride', {width: 320, height: 720, deviceScaleFactor: 1, mobile: true})
      await sleep(150)
      assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), `${stage.name} overflows at 320px`)
      if (stage.name === 'password') {
        fixtures['/api/onboarding/status'] = stages[1].status
        for (const [index, value] of ['Temporal1!', 'NuevaClave123!', 'NuevaClave123!'].entries()) {
          await evaluate(`document.querySelectorAll('input[type="password"]')[${index}].focus()`)
          await command('Input.insertText', {text: value})
        }
        await evaluate(`document.querySelector('.onboarding-form button[type="submit"]').click()`)
        await until(`location.pathname === '/bienvenida' && !!document.querySelector('.logo-uploader')`)
      }
    }
    fixtures['/api/onboarding/status'] = {required: false, password_required: false, institution_required: false, institution: null, logo_url: null}
    await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
    await navigate('/academico/configuracion?tab=datos', 'Datos institucionales')
    await until(`!!document.querySelector('.logo-uploader')`)
    await sleep(300)
    await evaluate(`window.scrollTo(0, document.querySelector('.logo-uploader').getBoundingClientRect().top + window.scrollY - 80)`)
    await sleep(250)
    const editorBox = await evaluate(`(() => {const box=document.querySelector('.logo-uploader').getBoundingClientRect();return {top:box.top,bottom:box.bottom,viewport:innerHeight,scrollY,scrollHeight:document.documentElement.scrollHeight}})()`)
    assert.ok(editorBox.top < editorBox.viewport && editorBox.bottom > 0, `Configuration logo editor is outside the viewport: ${JSON.stringify(editorBox)}`)
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), 'Configuration logo editor overflows on mobile')
    await screenshot('configuration-logo-mobile')
    assert.deepEqual(errors, [], 'Uncaught browser errors.')
    console.log('PASS: onboarding and configuration logo layouts, translations, crop dragging and mobile sizes.')
  } else if (process.argv.includes('--institutional')) {
    await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
    await navigate('/academico/anos-lectivos', 'Años lectivos')
    await until(`!!document.querySelector('[data-testid="institutional-settings-trigger"]')`)
    await sleep(500)
    assert.ok(await evaluate(`!!document.querySelector('[data-kt-nav="/academico/parametros-academicos"]')`), 'Academic settings must have their own header destination.')
    assert.equal(await evaluate(`!!document.querySelector('[data-kt-nav="/academico/configuracion"]')`), false, 'The old combined school configuration must leave the academic menu.')
    const openInstitutionalMenu = async () => {
      await sleep(500)
      await evaluate(`(() => {const root=document.querySelector('#kt_header_user_menu_toggle'),menu=root.querySelector(':scope > [data-kt-menu="true"]');if(!menu.classList.contains('show')) root.querySelector('[data-kt-menu-trigger]').click()})()`)
      await until(`document.querySelector('#kt_header_user_menu_toggle > [data-kt-menu="true"]')?.classList.contains('show')`)
      await evaluate(`(() => {const panel=document.querySelector('[data-testid="institutional-settings-panel"]');if(!panel.classList.contains('show')) document.querySelector('[data-testid="institutional-settings-trigger"]').click()})()`)
      await until(`document.querySelector('[data-testid="institutional-settings-panel"]')?.classList.contains('show')`)
    }
    await openInstitutionalMenu()
    assert.ok(await evaluate(`(() => {const trigger=document.querySelector('[data-testid="institutional-settings-trigger"]'),panel=document.querySelector('[data-testid="institutional-settings-panel"]');return !!trigger && !!panel && trigger.parentElement===panel.parentElement && panel.classList.contains('menu-sub-dropdown') && trigger.parentElement.getAttribute('data-kt-menu-placement')?.includes('left-start') && [...panel.querySelectorAll('a[data-kt-nav]')].map(a=>a.getAttribute('data-kt-nav')).join(',') === '/ajustes-institucionales/datos,/ajustes-institucionales/horario,/ajustes-institucionales/correo,/ajustes-institucionales/sedes'})()`), 'Institutional settings must open a separate flyout with Datos, Horario, Conexión de correo electrónico and Sedes.')
    await sleep(350)
    await screenshot('institutional-menu-mobile')
    await evaluate(`document.querySelector('[data-testid="institutional-settings-panel"] a[data-kt-nav="/ajustes-institucionales/datos"]').click()`)
    await until(`location.pathname === '/ajustes-institucionales/datos' && !!document.querySelector('.institutional-settings__header') && document.body.innerText.includes('Datos institucionales')`)
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), 'Institutional data page overflows on mobile.')
    await screenshot('institutional-data-mobile')
    await openInstitutionalMenu()
    await evaluate(`document.querySelector('[data-testid="institutional-settings-panel"] a[data-kt-nav="/ajustes-institucionales/horario"]').click()`)
    await until(`location.pathname === '/ajustes-institucionales/horario' && !!document.querySelector('#institution-zone option[value="Pacific/Auckland"]')`)
    assert.ok(await evaluate(`document.querySelector('#institution-zone').value === 'America/Bogota'`))
    assert.equal(await evaluate(`!!document.querySelector('#institution-zone-search')`), false, 'Select the institutional time zone directly, without a city search field.')
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), 'Institutional time zone page overflows on mobile.')
    await screenshot('institutional-timezone-mobile')
    await openInstitutionalMenu()
    await evaluate(`document.querySelector('[data-testid="institutional-settings-panel"] a[data-kt-nav="/ajustes-institucionales/sedes"]').click()`)
    await until(`location.pathname === '/ajustes-institucionales/sedes' && document.querySelector('table tbody')?.innerText.includes('Sede Norte')`)
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), 'Campuses page overflows on mobile.')
    await screenshot('institutional-campuses-mobile')
    await evaluate(`document.querySelector('table tbody tr button.btn-light-primary').click()`)
    await until(`location.pathname === '/ajustes-institucionales/sedes/${urlTokens.sede}' && document.body.innerText.includes('Sede Norte')`)
    await evaluate(`document.querySelector('a[href="/ajustes-institucionales/sedes"]').click()`)
    await until(`location.pathname === '/ajustes-institucionales/sedes' && document.querySelector('table tbody')?.innerText.includes('Sede Norte')`)
    await command('Page.navigate', {url: 'http://127.0.0.1:5197/academico/sedes/opaque-sede-one'})
    await until(`location.pathname === '/ajustes-institucionales/sedes/${urlTokens.sede}' && document.body.innerText.includes('Sede Norte')`)
    for (const [legacy, destination] of [
      ['datos', '/ajustes-institucionales/datos'],
      ['sedes', '/ajustes-institucionales/sedes'],
      ['escala', '/academico/parametros-academicos'],
      ['metodo', '/academico/parametros-academicos'],
      ['modelo', '/academico/parametros-academicos'],
    ]) {
      await command('Page.navigate', {url: `http://127.0.0.1:5197/academico/configuracion?tab=${legacy}`})
      await until(`location.pathname === ${JSON.stringify(destination)} && (document.querySelector(${JSON.stringify(['datos', 'sedes'].includes(legacy) ? '.institutional-settings__header' : '.card-header h3')})?.textContent.includes(${JSON.stringify(['datos', 'sedes'].includes(legacy) ? 'Ajustes institucionales' : 'Parámetros académicos')}) ?? false)`)
      if (['escala', 'metodo', 'modelo'].includes(legacy)) {
        assert.equal(await evaluate(`new URLSearchParams(location.search).get('tab')`), legacy, `Legacy ${legacy} tab must be preserved.`)
      }
    }
    for (const section of ['datos', 'horario', 'sedes']) {
      await command('Page.navigate', {url: `http://127.0.0.1:5197/academico/ajustes-institucionales/${section}`})
      await until(`location.pathname === '/ajustes-institucionales/${section}' && !!document.querySelector('.institutional-settings__header')`)
    }
    await command('Page.navigate', {url: 'http://127.0.0.1:5197/ajustes-institucionales'})
    await until(`location.pathname === '/ajustes-institucionales/datos' && !!document.querySelector('.institutional-settings__header')`)
    await navigate('/academico/parametros-academicos?tab=escala', 'Parámetros académicos')
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), 'Academic parameters page overflows on mobile.')
    await screenshot('academic-parameters-mobile')
    await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
    await navigate('/ajustes-institucionales/datos', 'Datos institucionales')
    await screenshot('institutional-data-desktop')
    await navigate('/ajustes-institucionales/horario', 'Configuración horaria')
    await until(`!!document.querySelector('#institution-zone option[value="Pacific/Auckland"]')`)
    assert.equal(await evaluate(`!!document.querySelector('#institution-zone-search')`), false)
    await screenshot('institutional-timezone-desktop')
    await navigate('/ajustes-institucionales/sedes', 'Sede Norte')
    await screenshot('institutional-campuses-desktop')
    await navigate('/academico/parametros-academicos?tab=escala', 'Parámetros académicos')
    await screenshot('academic-parameters-desktop')
    await navigate('/academico/anos-lectivos', 'Años lectivos')
    await sleep(500)
    const avatar = await evaluate(`(() => {const box=document.querySelector('#kt_header_user_menu_toggle [data-kt-menu-trigger]').getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})()`)
    await command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: avatar.x, y: avatar.y})
    await sleep(350)
    if (!await evaluate(`document.querySelector('#kt_header_user_menu_toggle > [data-kt-menu="true"]')?.classList.contains('show')`)) {
      await evaluate(`document.querySelector('#kt_header_user_menu_toggle [data-kt-menu-trigger]').click()`)
    }
    await until(`document.querySelector('#kt_header_user_menu_toggle > [data-kt-menu="true"]')?.classList.contains('show')`)
    const trigger = await evaluate(`(() => {const box=document.querySelector('[data-testid="institutional-settings-trigger"]').getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})()`)
    await command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: trigger.x, y: trigger.y})
    await until(`document.querySelector('[data-testid="institutional-settings-panel"]')?.classList.contains('show')`)
    await sleep(350)
    const flyout = await evaluate(`(() => {const main=document.querySelector('#kt_header_user_menu_toggle > [data-kt-menu="true"]').getBoundingClientRect(),panel=document.querySelector('[data-testid="institutional-settings-panel"]').getBoundingClientRect();return {mainLeft:main.left,mainRight:main.right,panelLeft:panel.left,panelRight:panel.right,panelWidth:panel.width}})()`)
    assert.ok(flyout.panelWidth > 200 && (flyout.panelRight <= flyout.mainLeft + 16 || flyout.panelLeft >= flyout.mainRight - 16), `Institutional flyout must be beside the user menu: ${JSON.stringify(flyout)}`)
    await screenshot('institutional-menu-desktop')
    assert.deepEqual(errors, [], 'Uncaught browser errors during institutional navigation.')
    console.log('PASS: separate institutional flyout, data and campuses pages, campus detail return, mobile width and legacy links.')
  } else if (process.argv.includes('--navigation')) {
    await navigate('/academico/anos-lectivos', 'Años lectivos')
    await until(`document.querySelector('.card-header h3')?.textContent.includes('Años lectivos')`)
    for (const [path, title] of [
      ['/academico/plan-estudios', 'Plan de estudios'],
      ['/academico/estructura', 'Estructura organizacional'],
      ['/academico/anos-lectivos', 'Años lectivos'],
    ]) {
      await evaluate(`document.querySelector('a[data-kt-nav=${JSON.stringify(path)}]').click()`)
      await until(`location.pathname === ${JSON.stringify(path)} && document.querySelector('.card-header h3')?.textContent.includes(${JSON.stringify(title)})`)
    }
    fixtures['/api/anos-lectivos'] = {data: []}
    await navigate('/academico/anos-lectivos', 'Años lectivos')
    await until(`document.querySelector('table tbody')?.textContent.includes('No hay año lectivo')`)
    await evaluate(`document.querySelector('a[data-kt-nav="/academico/plan-estudios"]').click()`)
    await until(`location.pathname === '/academico/plan-estudios' && document.querySelector('.card-header h3')?.textContent.includes('Plan de estudios') && document.body.innerText.includes('Primero crea un año lectivo')`)
    assert.deepEqual(errors, [], 'Uncaught browser errors during academic navigation.')
    console.log('PASS: academic menu navigation updates both URL and page content.')
  } else {
  await navigate('/comunicacion/eventos', 'Feria de ciencias')
  const dropdowns = await evaluate(`['Académico','Comunicación'].map(label=>{const title=[...document.querySelectorAll('#kt_app_header_menu .menu-title')].find(el=>el.textContent===label);const item=title.closest('[data-kt-menu-trigger]');return [item.className,item.querySelector('.menu-sub').className,item.querySelector('.menu-link').className]})`)
  assert.deepEqual(dropdowns[0], dropdowns[1])
  await screenshot('events-desktop')
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Nuevo evento')).click()`)
  await until(`!!document.querySelector('.modal.show')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show input[name="titulo"]')`))
  await screenshot('event-form-desktop')
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  await screenshot('event-form-mobile')
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'Mobile viewport overflows.')
  await navigate('/academico/evaluacion/catalogo', 'Matemáticas')
  await screenshot('grade-catalog-mobile')
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  await navigate(`/academico/evaluacion/planillas/${urlTokens.assignment}/${urlTokens.period}`, 'Taller 1')
  await until(`!!document.querySelector('input[aria-label="Estudiante de prueba · Taller 1"]')`)
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Estudiante de prueba · Taller 1"]').inputMode`), 'decimal')
  await screenshot('gradebook-desktop')
  fixtures['/api/evaluacion/catalogo'].data.matriculas = [
    {...enrollment, tiene_resultados_reprobados: false},
    {...enrollment, id: 2, url_token: 'w'.repeat(24), estudiante_id: 4,
      estudiante: {id: 4, name: 'Estudiante reprobado'}, tiene_resultados_reprobados: true},
  ]
  await navigate('/academico/boletines', 'Estudiante reprobado')
  await until(`document.querySelectorAll('table tbody tr').length === 2`)
  assert.ok(await evaluate(`(()=>{const rows=[...document.querySelectorAll('table tbody tr')];return rows.every(row=>[...row.querySelectorAll('button')].some(button=>button.textContent.trim()==='Ver Boletín')) && !rows[0].innerText.includes('Nivelaciones y habilitaciones') && rows[1].innerText.includes('Nivelaciones y habilitaciones')})()`), 'Recovery action is visible only for a student with a failing bulletin result; both bulletins remain available.')
  await evaluate(`[...document.querySelectorAll('table tbody tr')][1].querySelector('button.btn-light-info').click()`)
  await until(`location.pathname === '/evaluacion/recuperaciones/${'w'.repeat(24)}' && new URLSearchParams(location.search).get('desde') === 'boletines'`)
  await until(`[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Volver')`)
  assert.ok(await evaluate(`!document.body.innerText.includes('Provisional:') && [...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Abrir proceso')?.disabled === false`), 'An open term allows an authorized recovery.')
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Volver').click()`)
  await until(`location.pathname === '/academico/boletines' && document.querySelectorAll('table tbody tr').length === 2`)
  assert.ok(await evaluate(`document.body.innerText.includes('Ver Boletín') && !document.body.innerText.includes('Mis asignaciones')`), 'Back from recovery returns to bulletin list, not gradebooks.')
  await navigate(`/academico/boletines/${urlTokens.enrollment}`, 'Informe preliminar')
  assert.equal(await evaluate(`!!document.querySelector('[id^="observation-"]')`), false,
    'Rector report preview must not contain observation editors.')
  assert.equal(await evaluate(`document.body.innerText.includes('Emisión individual de boletines')`), false,
    'Rector report preview must not contain individual issuance.')
  assert.ok(await evaluate(`document.querySelector('.grade-report thead')?.innerText.includes('P4')`), 'The summary result must appear as the next numbered column.')
  await screenshot('report-preview')
  await navigate('/academico/anos-lectivos', '2027')
  assert.ok(await evaluate(`(()=>{const row=[...document.querySelectorAll('table tbody tr')].find(item=>item.cells[0]?.textContent.trim()==='2026');return !!row && [...row.querySelectorAll('button')].some(button=>button.textContent.trim()==='Cerrar')})()`), 'A rector with the transition permission must see the year Close button.')
  await evaluate(`(()=>{const row=[...document.querySelectorAll('table tbody tr')].find(item=>item.cells[0]?.textContent.trim()==='2026');[...row.querySelectorAll('button')].find(button=>button.textContent.includes('Periodos')).click()})()`)
  await until(`!!document.querySelector('#kt_modal_periodos tbody tr')`)
  assert.ok(await evaluate(`(()=>{const rows=[...document.querySelectorAll('#kt_modal_periodos tbody tr')];return rows.some(row=>row.innerText.includes('Trimestre 1') && [...row.querySelectorAll('button')].some(button=>button.textContent.trim()==='Cerrar')) && rows.some(row=>row.innerText.includes('Trimestre 2') && [...row.querySelectorAll('button')].some(button=>button.textContent.trim()==='Abrir'))})()`), 'A rector with period transition permission must see manual Close and Open buttons.')
  await evaluate(`document.querySelector('#kt_modal_periodos .modal-header .btn-active-color-primary').click()`)
  await until(`!document.querySelector('#kt_modal_periodos tbody tr')`)
  const rectorPermissions = user.permissions
  user.permissions = rectorPermissions.filter(permission => !['academico.anos.transicionar', 'academico.periodos.transicionar'].includes(permission))
  await navigate('/academico/anos-lectivos', '2027')
  assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll('table tbody tr')].find(item=>item.cells[0]?.textContent.trim()==='2026');return [...row.querySelectorAll('button')].some(button=>button.textContent.trim()==='Cerrar')})()`), false, 'A rector without transition permission must not see the year Close button.')
  await evaluate(`(()=>{const row=[...document.querySelectorAll('table tbody tr')].find(item=>item.cells[0]?.textContent.trim()==='2026');[...row.querySelectorAll('button')].find(button=>button.textContent.includes('Periodos')).click()})()`)
  await until(`!!document.querySelector('#kt_modal_periodos tbody tr')`)
  assert.equal(await evaluate(`(()=>[...document.querySelectorAll('#kt_modal_periodos tbody tr button')].some(button=>['Abrir','Cerrar','Reabrir'].includes(button.textContent.trim())))()`), false, 'A rector without transition permission must not see manual period actions.')
  user.permissions = rectorPermissions
  await navigate('/academico/anos-lectivos', '2027')
  await evaluate(`[...document.querySelectorAll('tr')].find(row=>row.innerText.includes('2027')).querySelector('button.btn-light-info').click()`)
  await until(`!!document.querySelector('.modal.show') && document.querySelectorAll('.modal.show input[type="checkbox"]:checked').length === 2`)
  assert.equal(await evaluate(`document.querySelector('.modal.show #copy-year-source').value`), urlTokens.year)
  await screenshot('copy-configuration')
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'Copy modal overflows the mobile viewport.')
  await evaluate(`(()=>{const modal=document.querySelector('.modal.show');modal.scrollTop=modal.scrollHeight;modal.querySelector('.modal-body').scrollTop=modal.querySelector('.modal-body').scrollHeight})()`)
  await sleep(150)
  assert.ok(await evaluate(`document.querySelector('.modal.show .modal-footer').getBoundingClientRect().bottom <= window.innerHeight + 1`), 'Copy modal actions must remain reachable on mobile.')
  await screenshot('copy-configuration-mobile')
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  await navigate('/academico/siee', 'Currículo por Grado')
  await screenshot('siee-desktop')
  await navigate('/academico/estructura?tab=bloques', 'Primera')
  assert.ok(await evaluate(`document.querySelector('table thead').innerText.includes('AÑO LECTIVO')`))
  await evaluate(`(()=>{const select=document.querySelector('.card-toolbar select');select.value='${urlTokens.nextYear}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.nextYear}' && !document.querySelector('table tbody')?.innerText.includes('Primera')`)
  assert.equal(await evaluate(`document.querySelector('.card-toolbar select').value`), urlTokens.nextYear)
  await evaluate(`(()=>{const select=document.querySelector('.card-toolbar select');select.value='${urlTokens.year}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.year}' && document.querySelector('table tbody')?.innerText.includes('Primera')`)
  assert.ok(await evaluate(`document.querySelector('[data-kt-nav="/evaluacion/catalogo"]')?.getAttribute('href') === '/evaluacion/catalogo'`), 'A header link must open its real route in another tab.')
  await navigate('/academico/estructura?tab=bloques&ano=1', 'Primera')
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.year}'`)
  await navigate('/academico/plan-estudios?tab=areas', 'Matemáticas')
  await evaluate(`(()=>{const select=document.querySelector('.card-toolbar select');select.value='${urlTokens.nextYear}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.nextYear}' && !document.querySelector('table tbody')?.innerText.includes('Matemáticas')`)
  await evaluate(`(()=>{const select=document.querySelector('.card-toolbar select');select.value='${urlTokens.year}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.year}' && document.querySelector('table tbody')?.innerText.includes('Matemáticas')`)
  await navigate(`/academico/plan-estudios?tab=areas&ano=${nextYear.legacy_url_token}`, 'Plan de estudios')
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.nextYear}' && !document.querySelector('table tbody')?.innerText.includes('Matemáticas')`)
  await navigate('/academico/plan-estudios?tab=resumen', 'Plan de estudios')
  await until(`document.querySelectorAll('.schedule-controls select').length === 2`)
  assert.ok(await evaluate(`(()=>{const controls=document.querySelector('.schedule-controls');controls.querySelector('select').focus();return controls.querySelectorAll('input[type="search"]').length===0 && [...controls.querySelectorAll('select')].every(select=>select.classList.contains('form-select-solid'))})()`), 'Summary filters must be plain solid selects without search inputs.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Grupo"]');select.value='${urlTokens.groupB}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`[...document.querySelectorAll('.row.g-5 .fs-2x')].map(item=>item.textContent.trim()).join(',')==='1,0,1'`)
  assert.ok(scheduleReads.some(read => read.view === null && read.group === urlTokens.groupB), 'Summary must request the selected group by public token.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Docente"]');select.value='${urlTokens.teacher}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`[...document.querySelectorAll('.row.g-5 .fs-2x')].map(item=>item.textContent.trim()).join(',')==='0,0,0'`)
  assert.ok(scheduleReads.some(read => read.view === null && read.group === urlTokens.groupB && read.teacher === urlTokens.teacher), 'Summary must request the selected teacher by public token.')
  await navigate('/academico/plan-estudios?tab=asignaciones', 'Sin docente asignado')
  assert.ok(await evaluate(`(()=>{const controls=document.querySelector('.schedule-controls');controls.querySelector('select').focus();return controls.querySelectorAll('select').length===3 && controls.querySelectorAll('input[type="search"]').length===0 && [...controls.querySelectorAll('select')].every(select=>select.classList.contains('form-select-solid'))})()`), 'Assignment filters must be three plain solid selects without search inputs.')
  assert.ok(await evaluate(`document.querySelector('table tbody')?.innerText.includes('Primero / (A)')`), 'The assignment table must show grade and group together.')
  await evaluate(`document.querySelector('table tbody .btn-light-primary').click()`)
  await until(`!!document.querySelector('.modal.show select[name="materia_id"]')`)
  assert.ok(await evaluate(`(()=>{const modal=document.querySelector('.modal.show');return modal.querySelectorAll('input[type="search"]').length===0 && [...modal.querySelectorAll('select[name]')].every(select=>!!modal.querySelector('label[for="'+select.id+'"]'))})()`), 'Assignment form selectors need labels and no duplicate search inputs.')
  assert.ok(await evaluate(`!document.querySelector('.modal.show select[name="materia_id"]').disabled && !document.querySelector('.modal.show select[name="grupo_id"]').disabled`), 'Subject and group must be editable in assignments.')
  await evaluate(`document.querySelector('.modal.show .btn-close').click()`)
  await until(`!document.querySelector('.modal.show')`)
  await navigate(`/academico/plan-estudios?tab=horarios&grupo=${urlTokens.group}&espacio=${urlTokens.space}&docente=${urlTokens.teacher}`, 'Plan de estudios')
  await until(`(()=>{const params=new URLSearchParams(location.search);return params.get('grupo')==='${urlTokens.group}' && params.get('espacio')==='${urlTokens.space}' && params.get('docente')==='${urlTokens.teacher}'})()`)
  await navigate('/academico/plan-estudios?tab=horarios', 'Selecciona un grupo')
  assert.ok(await evaluate(`(()=>{const controls=document.querySelector('.schedule-controls');controls.querySelector('select').focus();return controls.querySelectorAll('select').length===3 && controls.querySelectorAll('input[type="search"]').length===0 && [...controls.querySelectorAll('select')].every(select=>select.classList.contains('form-select-solid'))})()`), 'Timetable filters must be three plain solid selects without search inputs.')
  await until(`!!document.querySelector('.schedule-controls select[aria-label="Grupo"] option[value="${extraGroups.at(-1).url_token}"]')`)
  assert.ok(await evaluate(`document.querySelector('.schedule-controls select[aria-label="Grupo"] option[value="${extraGroups.at(-1).url_token}"]').textContent.includes('Grupo 52')`), 'A group beyond the first 50 catalog choices must be reachable in the selector without a search field.')
  assert.equal(await evaluate(`document.querySelectorAll('.schedule-session').length`), 0, 'The rector must choose a group before loading the timetable.')
  assert.ok(scheduleReads.some(read => read.view === 'horarios' && read.group === null), 'The first schedule request must ask only for catalogs.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Grupo"]');select.value='${urlTokens.group}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('grupo') === '${urlTokens.group}' && document.querySelectorAll('.schedule-session').length === 1`)
  assert.ok(scheduleReads.some(read => read.view === 'horarios' && read.group === urlTokens.group), 'The timetable request must send the chosen group token to the API.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Espacio físico"]');select.value='${urlTokens.space}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('espacio') === '${urlTokens.space}' && document.querySelectorAll('.schedule-session').length === 1`)
  await command('Page.reload')
  await sleep(500)
  await until(`document.querySelectorAll('.schedule-session').length === 1 && document.querySelector('.schedule-controls select[aria-label="Grupo"]')?.value === '${urlTokens.group}' && document.querySelector('.schedule-controls select[aria-label="Espacio físico"]')?.value === '${urlTokens.space}'`)
  assert.ok(await evaluate(`(()=>{const url=new URL(location.href);return ['ano','grupo','espacio'].every(name => /^[A-Za-z0-9_-]{20,30}$/.test(url.searchParams.get(name) ?? ''))})()`), 'The selected year, group and room must have short opaque URL tokens.')
  assert.ok(await evaluate(`(()=>{const scroll=document.querySelector('.schedule-scroll');return scroll.scrollHeight <= scroll.clientHeight + 1 && scroll.scrollWidth > scroll.clientWidth})()`), 'Only horizontal scrolling should remain inside the timetable.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Docente"]');select.value='${urlTokens.teacher}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('docente') === '${urlTokens.teacher}' && document.querySelectorAll('.schedule-session').length === 0`)
  await command('Page.reload')
  await sleep(500)
  await until(`document.querySelector('.schedule-controls select[aria-label="Docente"]')?.value === '${urlTokens.teacher}' && document.querySelectorAll('.schedule-session').length === 0`)
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Docente"]');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`!location.search.includes('docente=') && document.querySelectorAll('.schedule-session').length === 1`)
  await screenshot('schedule-actions-desktop')
  assert.ok(await evaluate(`[...document.querySelectorAll('.schedule-session-time')].every(el=>el.getBoundingClientRect().height < 14 && el.scrollWidth <= el.clientWidth)`), 'Class hours must stay on one visible line beside the actions button.')
  const lastTimeLabel = await evaluate(`document.querySelector('.schedule-time-axis span:last-child')?.innerText`)
  assert.ok(/13:00|1:00.*(?:PM|p\.\s?m\.)/i.test(lastTimeLabel), `The weekly grid must cover the selected group's shift; got ${lastTimeLabel}.`)
  assert.ok(await evaluate(`(()=>{const card=document.querySelector('.schedule-session');const room=card.querySelector('.schedule-session-room');return card.innerText.includes('Primero / (A)') && room?.innerText==='Aula Primero' && card.innerText.includes('Sin docente asignado') && [...card.children].every(el=>el.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom && el.scrollWidth <= el.clientWidth)})()`), 'The class card must visibly show time, subject, grade/group, room and teacher without clipping.')
  await screenshot('schedule-desktop')
  await evaluate(`document.querySelector('.schedule-session').click()`)
  await until(`!!document.querySelector('.modal.show')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show select[name="bloque_horario_id"]')`))
  await sleep(300)
  await screenshot('schedule-block-modal')
  await evaluate(`document.querySelector('.modal.show .btn-close').click()`)
  await until(`!document.querySelector('.modal.show')`)
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Espacio físico"]');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`!location.search.includes('espacio=') && document.querySelectorAll('.schedule-session').length === 1`)
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Grupo"]');select.value='${urlTokens.groupB}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('grupo') === '${urlTokens.groupB}' && document.querySelectorAll('.schedule-session').length === 1`)
  await evaluate(`document.querySelector('.schedule-session').click()`)
  await until(`!!document.querySelector('.modal.show input[name="hora_inicio"]')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show input[name="hora_fin"]')`))
  await sleep(300)
  await screenshot('schedule-custom-modal')
  await evaluate(`document.querySelector('.modal.show .btn-close').click()`)
  await until(`!document.querySelector('.modal.show')`)
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Grupo"]');select.value='${urlTokens.group}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('grupo') === '${urlTokens.group}' && document.querySelectorAll('.schedule-session').length === 1`)
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Agregar clase')).click()`)
  await until(`!!document.querySelector('.modal.show select[name="grupo_id"]')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show select[name="materia_id"]')`))
  assert.equal(await evaluate(`document.querySelector('.modal.show select[name="docente_id"] option').value`), '')
  await evaluate(`(()=>{const select=document.querySelector('.modal.show select[name="grupo_id"]');select.value='${urlTokens.groupC}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`!!document.querySelector('.modal.show #schedule-start')`)
  assert.equal(await evaluate(`!!document.querySelector('.modal.show select[name="bloque_horario_id"]')`), false)
  await evaluate(`(()=>{const select=document.querySelector('.modal.show select[name="grupo_id"]');select.value='${urlTokens.group}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`!!document.querySelector('.modal.show input[type="checkbox"]')`)
  await evaluate(`document.querySelector('.modal.show input[type="checkbox"]').click()`)
  await until(`!!document.querySelector('.modal.show select[name="bloque_horario_id"]')`)
  await evaluate(`(()=>{const select=document.querySelector('.modal.show select[name="bloque_horario_id"]');select.value='${publicToken('bloque_horario', 1)}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`document.querySelectorAll('.modal.show input[readonly]').length === 4`)
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.modal.show input[readonly]')].map(input=>input.value)`), ['Mañana', 'Sede Principal', '8:00 AM', '8:45 AM'])
  assert.ok(await evaluate(`document.querySelector('.modal.show').innerText.includes('Sede Principal')`))
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'Schedule modal overflows the mobile viewport.')
  await evaluate(`document.querySelector('.modal.show .btn-primary').scrollIntoView({block:'center'})`)
  await screenshot('schedule-mobile')
  assert.ok(await evaluate(`(()=>{const button=document.querySelector('.modal.show .btn-primary');const box=button.getBoundingClientRect();return button.contains(document.elementFromPoint(box.left+box.width*.85,box.top+box.height*.5))})()`), 'A floating control covers the schedule save button.')
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  assert.equal(writes.length, 0, 'Smoke test should not submit any mutation.')
  await navigate(`/academico/plan-estudios?tab=horarios&grupo=${urlTokens.group}`, 'Matemáticas')
  await until(`document.querySelectorAll('.schedule-session').length === 1`)
  const dragClass = async (day, startMinutes, expectedWrites) => {
    const points = await evaluate(`(()=>{const card=document.querySelector('.schedule-session').getBoundingClientRect();const target=document.querySelector('[data-schedule-day=${JSON.stringify(day)}]').getBoundingClientRect();const firstHour=Number(document.querySelector('.schedule-time-axis span').innerText.split(':')[0]);return {fromX:card.left+25,fromY:card.top+12,toX:target.left+70,toY:target.top+(${startMinutes}-firstHour*60)/60*112+12}})()`)
    await command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: points.fromX, y: points.fromY})
    await command('Input.dispatchMouseEvent', {type: 'mousePressed', x: points.fromX, y: points.fromY, button: 'left', clickCount: 1})
    await command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: points.toX, y: points.toY, button: 'left', buttons: 1})
    await until(`!!document.querySelector('[data-schedule-day=${JSON.stringify(day)}] .schedule-drop-preview')`)
    await command('Input.dispatchMouseEvent', {type: 'mouseReleased', x: points.toX, y: points.toY, button: 'left', clickCount: 1})
    for (let i = 0; i < 50 && writes.length < expectedWrites; i++) await sleep(100)
  }
  await dragClass('martes', 8 * 60, 1)
  assert.equal(writes.length, 1, 'Dragging a class should send exactly one update.')
  assert.deepEqual([writes[0].method, writes[0].path, writes[0].body.dia, writes[0].body.bloque_horario_token], ['PUT', `/api/horarios/${publicToken('sesion_horario', 1)}`, 'martes', publicToken('bloque_horario', 1)])
  assert.deepEqual([writes[0].body.grupo_token, writes[0].body.materia_token, writes[0].body.espacio_fisico_token, writes[0].body.docente_token], [urlTokens.group, urlTokens.materia, urlTokens.space, null])
  assert.equal(await evaluate(`!!document.querySelector('.modal.show')`), false, 'Dragging must not open the edit modal.')
  await until(`document.querySelectorAll('.schedule-session').length === 1`)
  assert.equal(await evaluate(`!!document.querySelector('.schedule-controls button[aria-pressed]')`), false, 'Copy must not be a global mode.')
  await evaluate(`document.querySelector('.schedule-card-actions').click()`)
  await until(`!!document.querySelector('.schedule-actions-menu')`)
  assert.ok(await evaluate(`document.querySelector('.schedule-actions-menu').innerText.includes('Copiar')`))
  await evaluate(`document.querySelectorAll('.schedule-actions-menu button')[1].click()`)
  await until(`!!document.querySelector('.schedule-copy-banner')`)
  await dragClass('miercoles', 9 * 60 + 15, 2)
  assert.equal(writes.length, 2, 'Copying a class should send exactly one creation.')
  assert.deepEqual([writes[1].method, writes[1].path, writes[1].body.dia, writes[1].body.hora_inicio, writes[1].body.hora_fin, writes[1].body.bloque_horario_token], ['POST', '/api/horarios', 'miercoles', '09:15', '10:00', null])
  assert.deepEqual([writes[1].body.grupo_token, writes[1].body.materia_token, writes[1].body.espacio_fisico_token, writes[1].body.docente_token], [urlTokens.group, urlTokens.materia, urlTokens.space, null])
  await until(`document.querySelectorAll('.schedule-session').length === 1`)
  await sleep(400)
  await evaluate(`document.querySelector('.schedule-card-actions').click()`)
  await until(`!!document.querySelector('.schedule-actions-menu')`)
  await evaluate(`document.querySelectorAll('.schedule-actions-menu button')[1].click()`)
  await until(`!!document.querySelector('.schedule-copy-banner')`)
  await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27})
  await until(`!document.querySelector('.schedule-copy-banner')`)
  assert.equal(writes.length, 2, 'Escape must cancel copying without writing.')
  await evaluate(`document.querySelector('.schedule-card-actions').click()`)
  await until(`!!document.querySelector('.schedule-actions-menu')`)
  await evaluate(`document.querySelectorAll('.schedule-actions-menu button')[2].click()`)
  await until(`!!document.querySelector('.modal.show')`)
  await evaluate(`document.querySelector('.modal.show .btn-light').click()`)
  await until(`!document.querySelector('.modal.show')`)
  await until(`(()=>{const box=document.querySelector('.schedule-session').getBoundingClientRect();return document.elementFromPoint(box.left+25,box.top+12)?.closest('.schedule-session')!==null})()`)
  assert.equal(writes.length, 2, 'Cancelling quick-delete must not write.')
  const edge = await evaluate(`(()=>{const card=document.querySelector('.schedule-session').getBoundingClientRect(),scroll=document.querySelector('.schedule-scroll').getBoundingClientRect();return {fromX:card.left+25,y:card.top+12,toX:scroll.right-8,hit:document.elementFromPoint(card.left+25,card.top+12)?.className}})()`)
  assert.ok(String(edge.hit).includes('schedule-session'), `Auto-scroll drag source must be visible: ${JSON.stringify(edge)}`)
  await command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: edge.fromX, y: edge.y})
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', x: edge.fromX, y: edge.y, button: 'left', clickCount: 1})
  await command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: edge.toX, y: edge.y, button: 'left', buttons: 1})
  await until(`document.querySelector('.schedule-scroll').scrollLeft > 300`)
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 10, y: 50, button: 'left', clickCount: 1})
  assert.equal(writes.length, 2, 'Cancelling a drag outside the calendar must not write data.')
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  await command('Emulation.setTouchEmulationEnabled', {enabled: true})
  await navigate(`/academico/plan-estudios?tab=horarios&grupo=${urlTokens.group}`, 'Matemáticas')
  await until(`document.querySelectorAll('.schedule-session').length === 1`)
  await evaluate(`(()=>{const scroll=document.querySelector('.schedule-scroll');window.scrollTo(0,scroll.getBoundingClientRect().top+window.scrollY-120)})()`)
  await evaluate(`document.querySelector('.schedule-card-actions').scrollIntoView({block:'center',inline:'center'})`)
  assert.ok(await evaluate(`(()=>{const button=document.querySelector('.schedule-card-actions'),box=button.getBoundingClientRect();return box.top>=0 && box.bottom<=window.innerHeight && document.elementFromPoint(box.left+box.width/2,box.top+box.height/2)===button})()`), 'Mobile quick actions must be reachable on the class card.')
  await evaluate(`document.querySelector('.schedule-card-actions').click()`)
  await until(`!!document.querySelector('.schedule-actions-menu')`)
  const menuGeometry = await evaluate(`(()=>{const box=document.querySelector('.schedule-actions-menu').getBoundingClientRect(),card=document.querySelector('.schedule-card-actions').getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,cardTop:card.top,width:window.innerWidth,height:window.innerHeight}})()`)
  assert.ok(menuGeometry.left>=0 && menuGeometry.right<=menuGeometry.width && menuGeometry.top>=0 && menuGeometry.bottom<=menuGeometry.height, `Quick actions must fit the mobile viewport: ${JSON.stringify(menuGeometry)}`)
  await screenshot('schedule-actions-mobile')
  await evaluate(`document.querySelectorAll('.schedule-actions-menu button')[1].click()`)
  await until(`!!document.querySelector('.schedule-copy-banner')`)
  await evaluate(`document.querySelector('.schedule-copy-banner button').click()`)
  await until(`!document.querySelector('.schedule-copy-banner')`)
  assert.ok(await evaluate(`(()=>{const scroll=document.querySelector('.schedule-scroll');return scroll.scrollHeight <= scroll.clientHeight + 1 && scroll.scrollTop === 0})()`), 'The timetable must have no inner vertical scroll on mobile.')
  await evaluate(`(()=>{document.querySelector('.schedule-scroll').scrollLeft=0;document.querySelector('.schedule-session').scrollIntoView({block:'center',inline:'start'})})()`)
  await sleep(150)
  await evaluate(`(()=>{const card=document.querySelector('.schedule-session'),top=card.getBoundingClientRect().top+window.scrollY;window.scrollTo(0,Math.max(0,top-window.innerHeight/2))})()`)
  await until(`(()=>{const box=document.querySelector('.schedule-session').getBoundingClientRect();return box.top>=0 && box.bottom<window.innerHeight})()`)
  const touch = await evaluate(`(()=>{const card=document.querySelector('.schedule-session').getBoundingClientRect();return {x:card.left+25,y:card.top+12}})()`)
  const touchVisibility = await evaluate(`(()=>{const card=document.querySelector('.schedule-session'),box=card.getBoundingClientRect(),origin=document.elementFromPoint(box.left+25,box.top+12)?.closest('.schedule-session')===card,destination=document.elementFromPoint(box.left+25,box.top-44)?.closest('.schedule-day')!==null,bottom=box.bottom<window.innerHeight;return {visible:origin&&destination&&bottom,origin,destination,bottom,top:box.top,viewport:window.innerHeight,hit:document.elementFromPoint(box.left+25,box.top+12)?.className,scroll:window.scrollY,body:document.scrollingElement?.scrollHeight}})()`)
  assert.ok(touchVisibility.visible, `Touch origin and destination must be visible inside the calendar: ${JSON.stringify(touchVisibility)}`)
  await command('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: touch.x, y: touch.y, id: 0}]})
  // Exercise a real gesture across frames: a single immediate jump can be
  // coalesced by Chromium before React processes pointer capture.
  for (const distance of [14, 28, 42, 56]) {
    await sleep(50)
    await command('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: touch.x, y: touch.y - distance, id: 0}]})
  }
  await until(`!!document.querySelector('[data-schedule-day="lunes"] .schedule-drop-preview')`)
  await screenshot('schedule-touch-drag')
  await command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []})
  for (let i = 0; i < 50 && writes.length < 3; i++) await sleep(100)
  assert.equal(writes.length, 3, 'Touch dragging should also move a class.')
  assert.deepEqual([writes[2].method, writes[2].path, writes[2].body.dia, writes[2].body.hora_inicio, writes[2].body.hora_fin], ['PUT', `/api/horarios/${publicToken('sesion_horario', 1)}`, 'lunes', '07:30', '08:15'])
  await evaluate(`document.querySelector('.schedule-card-actions').click()`)
  await until(`!!document.querySelector('.schedule-actions-menu')`)
  await evaluate(`document.querySelectorAll('.schedule-actions-menu button')[1].click()`)
  await until(`!!document.querySelector('.schedule-copy-banner')`)
  await evaluate(`document.querySelector('[data-schedule-day="martes"]').scrollIntoView({block:'nearest',inline:'center'})`)
  const paste = await evaluate(`(()=>{const day=document.querySelector('[data-schedule-day="martes"]').getBoundingClientRect();return {x:day.left+80,y:day.top+2*112+12}})()`)
  await command('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: paste.x, y: paste.y, id: 1}]})
  await command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []})
  for (let i = 0; i < 50 && writes.length < 4; i++) await sleep(100)
  assert.equal(writes.length, 4, 'Tapping an empty slot should place one copy without moving the original.')
  assert.deepEqual([writes[3].method, writes[3].path, writes[3].body.dia], ['POST', '/api/horarios', 'martes'])
  assert.deepEqual(errors, [], 'Uncaught browser errors.')
  console.log('PASS: navigation, events, reports, SIEE, schedule move/copy by drag and mobile tap, cancellation and responsive actions; screenshots in artifacts/ui-smoke.')
  }
} finally {
  // Edge may relaunch under a different PID on Windows. Close the isolated browser
  // over CDP so old test tabs cannot reconnect to the next Vite run.
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({id: 999999, method: 'Browser.close'}))
    await sleep(250)
  }
  socket?.close()
  browser?.kill()
  await server?.close()
  // Profile is isolated in the OS temporary directory, never the user browser profile.
}
