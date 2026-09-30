// UI smoke test with isolated browser profile and in-memory API fixtures. No real database.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn, spawnSync} from 'node:child_process'
import {once} from 'node:events'
import assert from 'node:assert/strict'
import {createServer} from 'vite'

const root = path.resolve(import.meta.dirname, '..')
const realtimeMode = process.argv.includes('--realtime')
const paginationMode = process.argv.includes('--pagination')
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
const user = {id: 1, name: 'Rector de prueba', email: 'rector@example.test', tenant_id: 'smoke', is_platform: false, roles: ['rector'], permissions: ['academico.anos.gestionar', 'academico.anos.transicionar', 'academico.periodos.transicionar', 'academico.configurar', 'academico.estructura.gestionar', 'academico.plan_estudios.gestionar'], mfa_enabled: false}
const urlTokens = {year: 'a'.repeat(24), nextYear: 'b'.repeat(24), group: 'c'.repeat(24), groupB: 'd'.repeat(24), groupC: 'e'.repeat(24), teacher: 'f'.repeat(24), space: 'g'.repeat(24), assignment: 'h'.repeat(24), period: 'j'.repeat(24), enrollment: 'k'.repeat(24), sede: 'm'.repeat(24)}
const year = {id: 1, url_token: urlTokens.year, nombre: '2026', estado: 'en_curso', tipo_calendario: 'A', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', num_periodos: 3, periodo_sumatorio: true}
const nextYear = {...year, id: 2, url_token: urlTokens.nextYear, legacy_url_token: '2'.repeat(64), nombre: '2027', estado: 'planificado'}
const group = {id: 1, url_token: urlTokens.group, nombre: 'A', ano_lectivo_id: 1, jornada_id: 1, sede_id: 1, grado: {id: 1, nombre: 'Primero', nivel_id: 1}, sede: {id: 1, nombre: 'Sede Principal'}, jornada: {id: 1, nombre: 'Mañana', hora_inicio: '07:00:00', hora_fin: '12:30:00'}}
const groupB = {...group, id: 2, url_token: urlTokens.groupB, nombre: 'B'}
const groupC = {...group, id: 3, url_token: urlTokens.groupC, nombre: 'C', jornada_id: 2, jornada: {id: 2, nombre: 'Tarde', hora_inicio: '13:00:00', hora_fin: '17:00:00'}}
const extraGroups = Array.from({length: 49}, (_, index) => ({...group, id: index + 4, url_token: `${'n'.repeat(21)}${String(index + 4).padStart(3, '0')}`, nombre: `Grupo ${index + 4}`}))
const enrollment = {id: 1, url_token: urlTokens.enrollment, estudiante_id: 2, ano_lectivo_id: 1, grupo_id: 1, estado: 'activa', estudiante: {id: 2, name: 'Estudiante de prueba'}, grupo: group}
const assignment = {id: 1, url_token: urlTokens.assignment, ano_lectivo_id: 1, grupo_id: 1, materia_id: 1, docente_id: 3, grupo: group, materia: {id: 1, nombre: 'Matemáticas'}}
const period = {id: 1, url_token: urlTokens.period, ano_lectivo_id: 1, nombre: 'Trimestre 1', orden: 1, fecha_inicio: '2026-09-01', fecha_fin: '2026-09-30', peso: 50, estado: 'abierto', es_actual: true, reapertura_manual: false, created_at: null}
const nextPeriod = {...period, id: 2, url_token: 'l'.repeat(24), nombre: 'Trimestre 2', orden: 2, fecha_inicio: '2026-10-01', fecha_fin: '2026-12-31', estado: 'planificado', es_actual: false}
const block = {id: 1, nombre: 'Primera', jornada_id: 1, hora_inicio: '08:00', hora_fin: '08:45'}
const config = {usar_areas: false, modo_area: 'SIMPLE_AVERAGE', modo_asignatura: 'SIMPLE_AVERAGE', modo_anual: 'SIMPLE_AVERAGE', redondeo: 'HALF_UP', precision_calculo: 8, recuperacion: 'REPLACE', mostrar_final: true, etiqueta_final: 'Definitiva', escala_id: 1, metodo_id: 1, valor_min: '0', valor_max: '5', decimales: 2, nota_minima: '3'}
const event = {id: 1, titulo: 'Feria de ciencias', descripcion: 'Compartimos nuestros experimentos.', fecha: today, hora_inicio: null, hora_fin: null, categoria: 'actividad', institucional: true, materia_id: null, grupos: [], created_by: 1, created_at: new Date().toISOString()}
const sede = {id: '1', hashed_id: urlTokens.sede, nombre: 'Sede Norte', direccion: 'Calle 1', telefono: '601 123 4567', responsable: null, coordinador_name: 'Coordinadora de prueba', coordinador_email: 'coordinadora@example.test', tenant_id: 'sede-smoke', tenant_slug: 'norte', tenant_domain: 'norte', tenant_status: 'active', es_principal: false, estado: 'activa', created_at: null}
const fixtures = {
  '/api/me': {user},
  '/api/onboarding/status': {required: false, password_required: false, institution_required: false, institution: null, logo_url: null},
  '/api/broadcasting/auth': {auth: 'smoke'},
  '/api/tenant-status': {is_tenant: true, tenant: {id: 'smoke', name: 'Colegio de prueba', status: 'active'}},
  '/api/anos-lectivos': {data: [year, nextYear]},
  '/api/anos-lectivos/1/periodos': {data: [period, nextPeriod]},
  '/api/anos-lectivos/2/estado-copia': {data: {origen_id: 1, opciones: {jornadas: true, periodos: true}, reemplazable: false}},
  '/api/config/datos-institucionales': {data: {nombre: 'Colegio de prueba', nit: '900123456-7', resolucion_men: '123 de 2026', direccion: 'Calle 1', telefono: '601 123 4567', correo: 'contacto@example.test'}},
  '/api/estructura/sedes': {data: [sede]},
  [`/api/estructura/sedes/${urlTokens.sede}`]: {data: sede},
  '/api/estructura/sedes/opaque-sede-one': {data: sede},
  '/api/estructura/jornadas': {data: [{id: 1, ano_lectivo_id: 1, nombre: 'Mañana', sede_id: 1, estado: 'activa', hora_inicio: '07:00:00', hora_fin: '12:30:00'}]},
  '/api/estructura/bloques-horarios': {data: [{...block, ano_lectivo_id: 1, estado: 'activo', es_descanso: false, jornada: {id: 1, nombre: 'Mañana', sede_id: 1}}]},
  '/api/plan-estudios/areas': {data: [{id: 1, ano_lectivo_id: 1, nombre: 'Matemáticas', descripcion: null, estado: 'activo'}]},
  '/api/plan-estudios/materias': {data: [{id: 1, ano_lectivo_id: 1, area_id: 1, nivel_id: null, nombre: 'Matemáticas', intensidad_horaria: 5, estado: 'activo'}]},
  '/api/horarios': {data: {can_manage: true, anos: [year], grupos: [group, groupB, groupC], docentes: [{id: 3, url_token: urlTokens.teacher, name: 'Docente de prueba'}], areas: [], materias: [{...assignment.materia, estado: 'activo', nivel_id: null}], bloques: [block], espacios: [{id: 1, url_token: urlTokens.space, nombre: 'Aula Primero', sede_id: 1}], asignaciones: [{...assignment, docente_id: null, docente: null}], sesiones: [{id: 1, asignacion_id: 1, grupo_id: 1, materia_id: 1, docente_id: null, grupo: group, materia: assignment.materia, docente: null, dia: 'lunes', bloque_horario_id: 1, hora_inicio: null, hora_fin: null, espacio_fisico_id: 1, bloque: block, espacio: {id: 1, nombre: 'Aula Primero'}}, {id: 2, asignacion_id: null, grupo_id: 2, materia_id: 1, docente_id: null, grupo: groupB, materia: assignment.materia, docente: null, dia: 'lunes', bloque_horario_id: null, hora_inicio: '08:00:00', hora_fin: '09:15:00', espacio_fisico_id: null, bloque: null, espacio: null}]}},
  '/api/eventos/catalogo': {data: {es_rector: true, puede_crear: true, docentes_cualquier_grupo: false, grupos: [group], materias: [assignment.materia], asignaciones: [assignment]}},
  '/api/eventos': {data: [event], last_page: 1},
  '/api/eventos/1': {data: {...event, archivos: [], puede_editar: true}},
  '/api/evaluacion/catalogo': {data: {can_manage: true, can_configure: true, can_view_reports: true, anos: [year, nextYear], periodos: [period, {...period, id: 2, ano_lectivo_id: 2, url_token: 'l'.repeat(24)}], asignaciones: [assignment], matriculas: [enrollment], grupos: [group], estudiantes: []}},
  '/api/evaluacion/planillas/1/1': {data: {editable: true, configuracion: config, componentes: [{id: 1, asignacion_id: 1, periodo_id: 1, nombre: 'Talleres', modo: 'SIMPLE_AVERAGE', peso: null, actividades: [{id: 1, componente_id: 1, nombre: 'Taller 1', fecha: today, peso: null}]}], matriculas: [enrollment], calificaciones: [], resultados: [{matricula_id: 1, estado: 'pendiente', motivo: 'Faltan notas'}]}},
  '/api/evaluacion/boletines/1': {data: {tipo: 'VISTA_PREVIA', generado_en: new Date().toISOString(), institucion: 'Colegio de prueba', estudiante: enrollment.estudiante, grupo: 'A', grado: 'Primero', ano: '2026', configuracion: config, periodos: [period], periodo_sumatorio: {orden: 4, nombre: 'P4', modo: 'SIMPLE_AVERAGE'}, asignaturas: [{materia_id: 1, nombre: 'Matemáticas', peso_area: null, periodos: [{periodo_id: 1, estado: 'pendiente'}], anual: {estado: 'pendiente'}}], areas: [], advertencias: []}},
  '/api/siee/1': {data: {editable: true, configuracion: config, escalas: [{id: 1, nombre: 'Numérica', tipo: 'numerica', valor_min: '0', valor_max: '5', decimales: 2}], metodos: [{id: 1, calculo_nota: 'promedio_simple', nota_minima: '3', ambito: 'materia'}], curriculo: [], grados: [group.grado], materias: [assignment.materia], areas: []}},
}
if (paginationMode) {
  fixtures['/api/plan-estudios/areas'].data = Array.from({length: 25}, (_, index) => ({id: index + 1, ano_lectivo_id: 1, nombre: `Área ${String(index + 1).padStart(2, '0')}`, descripcion: null, estado: 'activo'}))
  fixtures['/api/siee/1'].data.materias = Array.from({length: 12}, (_, index) => ({id: index + 1, nombre: `Materia ${String(index + 1).padStart(2, '0')}`}))
  fixtures['/api/siee/1/curriculo'] = {data: fixtures['/api/siee/1'].data.materias.map(materia => ({ano_lectivo_id: 1, grado_id: 1, materia_id: materia.id, area_id: null, peso_area: null}))}
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
const scheduleReads = []
const pagedReads = []
let server, browser, socket
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  server = await createServer({root, logLevel: 'error', server: {host: '127.0.0.1', port: 5197, strictPort: true}, plugins: [{name: 'smoke-api', configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      const url = new URL(req.url, 'http://localhost')
      if (!url.pathname.startsWith('/api')) return next()
      console.log('Fixture', req.method, url.pathname)
      const annualStructure = ['/api/estructura/jornadas', '/api/estructura/bloques-horarios', '/api/plan-estudios/areas', '/api/plan-estudios/materias']
      let fixture = annualStructure.includes(url.pathname) && url.searchParams.get('ano_lectivo_id') === '2'
        ? {data: []} : fixtures[url.pathname]
      if (url.pathname === '/api/catalogos-academicos' && req.method === 'GET') {
        const catalogs = {
          grupos: [group, groupB, groupC, ...extraGroups],
          docentes: fixtures['/api/horarios'].data.docentes,
          espacios: fixtures['/api/horarios'].data.espacios,
          materias: fixtures['/api/horarios'].data.materias,
          grados: [group.grado],
          areas: fixtures['/api/plan-estudios/areas'].data,
          estudiantes: [],
        }
        const page = Math.max(1, Number(url.searchParams.get('page') || 1))
        const perPage = Math.max(1, Number(url.searchParams.get('per_page') || 5))
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const rows = (catalogs[url.searchParams.get('tipo')] || []).filter(item => (item.nombre || item.name || '').toLocaleLowerCase().includes(search))
        const data = rows.slice((page - 1) * perPage, page * perPage)
        const selectedId = Number(url.searchParams.get('selected_id'))
        const selected = rows.find(item => item.id === selectedId)
        if (selected && !data.some(item => item.id === selectedId)) data.push(selected)
        fixture = {data, meta: {current_page: page, per_page: perPage,
          last_page: Math.max(1, Math.ceil(rows.length / perPage)), total: rows.length}}
      }
      if (paginationMode && url.pathname === '/api/plan-estudios/areas' && req.method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1))
        const perPage = Number(url.searchParams.get('per_page') || 5)
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const rows = fixtures[url.pathname].data.filter(item => item.nombre.toLocaleLowerCase().includes(search))
        pagedReads.push({page, perPage, search})
        fixture = {data: rows.slice((page - 1) * perPage, page * perPage), meta: {current_page: page, per_page: perPage, last_page: Math.max(1, Math.ceil(rows.length / perPage)), total: rows.length}}
      }
      if (paginationMode && url.pathname === '/api/siee/1/curriculo' && req.method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1))
        const perPage = Number(url.searchParams.get('per_page') || 5)
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const rows = fixtures[url.pathname].data.filter(item => fixtures['/api/siee/1'].data.materias.find(materia => materia.id === item.materia_id)?.nombre.toLocaleLowerCase().includes(search))
        pagedReads.push({path: url.pathname, page, perPage, search})
        fixture = {data: rows.slice((page - 1) * perPage, page * perPage), meta: {current_page: page, per_page: perPage, last_page: Math.max(1, Math.ceil(rows.length / perPage)), total: rows.length}}
      }
      if (paginationMode && url.pathname === '/api/evaluacion/catalogo' && req.method === 'GET') {
        const source = fixtures[url.pathname].data
        const assignmentPage = Math.max(1, Number(url.searchParams.get('asignaciones_page') || 1))
        const assignmentPerPage = Number(url.searchParams.get('asignaciones_per_page') || 5)
        const enrollmentPage = Math.max(1, Number(url.searchParams.get('matriculas_page') || 1))
        const enrollmentPerPage = Number(url.searchParams.get('matriculas_per_page') || 5)
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const studentSearch = (url.searchParams.get('student_search') || '').toLocaleLowerCase()
        const assignments = source.asignaciones.filter(item => item.materia.nombre.toLocaleLowerCase().includes(search))
        const enrollments = source.matriculas
        const students = source.estudiantes_disponibles.filter(item => item.name.toLocaleLowerCase().includes(studentSearch))
        const meta = (page, perPage, total) => ({current_page: page, per_page: perPage, last_page: Math.max(1, Math.ceil(total / perPage)), total})
        pagedReads.push({path: url.pathname, assignmentPage, assignmentPerPage, enrollmentPage, enrollmentPerPage, search, studentSearch})
        fixture = {data: {...source,
          asignaciones: assignments.slice((assignmentPage - 1) * assignmentPerPage, assignmentPage * assignmentPerPage),
          matriculas: enrollments.slice((enrollmentPage - 1) * enrollmentPerPage, enrollmentPage * enrollmentPerPage),
          selected_asignacion: source.asignaciones.find(item => item.url_token === url.searchParams.get('asignacion_token')) ?? null,
          selected_matricula: source.matriculas.find(item => item.url_token === url.searchParams.get('matricula_token')) ?? null,
          estudiantes_disponibles: students,
          pagination: {asignaciones: meta(assignmentPage, assignmentPerPage, assignments.length), matriculas: meta(enrollmentPage, enrollmentPerPage, enrollments.length)},
        }}
      }
      if (paginationMode && url.pathname === '/api/evaluacion/planillas/1/1' && req.method === 'GET') {
        const source = fixtures[url.pathname].data
        const page = Math.max(1, Number(url.searchParams.get('page') || 1))
        const perPage = Number(url.searchParams.get('per_page') || 5)
        const search = (url.searchParams.get('search') || '').toLocaleLowerCase()
        const enrollments = source.matriculas.filter(item => item.estudiante.name.toLocaleLowerCase().includes(search))
        const pageRows = enrollments.slice((page - 1) * perPage, page * perPage)
        pagedReads.push({path: url.pathname, page, perPage, search})
        fixture = {data: {...source, matriculas: pageRows,
          resultados: source.resultados.filter(item => pageRows.some(row => row.id === item.matricula_id)),
          pagination: {matriculas: {current_page: page, per_page: perPage, last_page: Math.max(1, Math.ceil(enrollments.length / perPage)), total: enrollments.length}},
        }}
      }
      if (url.pathname === '/api/horarios') {
        const groupId = url.searchParams.get('grupo_id')
        const teacherId = url.searchParams.get('docente_id')
        const subjectId = url.searchParams.get('materia_id')
        scheduleReads.push({view: url.searchParams.get('vista'), group: groupId, teacher: teacherId})
        const assignments = fixture.data.asignaciones.filter(item => (!groupId || String(item.grupo_id) === groupId)
          && (!teacherId || String(item.docente_id) === teacherId) && (!subjectId || String(item.materia_id) === subjectId))
        const sessions = fixture.data.sesiones.filter(item => (!groupId || String(item.grupo_id) === groupId)
          && (!teacherId || String(item.docente_id) === teacherId) && (!subjectId || String(item.materia_id) === subjectId))
        if (url.searchParams.has('page')) {
          const page = Math.max(1, Number(url.searchParams.get('page') || 1))
          const perPage = Number(url.searchParams.get('per_page') || 5)
          fixture = {data: {...fixture.data,
            asignaciones: assignments.slice((page - 1) * perPage, page * perPage),
            pagination: {asignaciones: {current_page: page, per_page: perPage, last_page: Math.max(1, Math.ceil(assignments.length / perPage)), total: assignments.length}},
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
        res.end(JSON.stringify(fixture ?? {data: [], meta: {total: 0, current_page: 1, last_page: 1}}))
      }
      if (req.method === 'GET') return respond()
      let body = ''
      req.on('data', chunk => {body += chunk})
      req.on('end', () => {
        const parsed = req.headers['content-type']?.includes('application/json') ? JSON.parse(body || '{}') : Object.fromEntries(new URLSearchParams(body))
        if (url.pathname === '/api/account/profile') { Object.assign(user, parsed); fixture = {message: 'Perfil actualizado.', user} }
        if (url.pathname === '/api/mfa/setup') fixture = {secret: 'JBSWY3DPEHPK3PXP', otpauth_url: 'otpauth://totp/Colegio%20SaaS:rector%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Colegio%20SaaS&algorithm=SHA1&digits=6&period=30'}
        if (url.pathname === '/api/mfa/confirm') {user.mfa_enabled = true; fixture = {mfa_enabled: true, recovery_codes: ['aaaaa-bbbbb-ccccc-ddddd','11111-22222-33333-44444']}}
        if (realtimeMode && url.pathname === '/api/broadcasting/auth') {
          fixture = reverbProbe({action: 'auth', ...parsed})
        }
        if (url.pathname !== '/api/broadcasting/auth') {
          writes.push({method: req.method, path: url.pathname, body: parsed})
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result?.value
  }
  const until = async expression => {
    for (let i = 0; i < 300; i++) {
      try { if (await evaluate(expression)) return } catch { /* A navigation can replace the page during evaluation. */ }
      await sleep(100)
    }
    console.error('Page at failure:', await evaluate('document.body.innerText.slice(0, 2500)'), errors)
    const capture = await command('Page.captureScreenshot', {format: 'png'})
    fs.writeFileSync(path.join(artifacts, 'failure.png'), Buffer.from(capture.data, 'base64'))
    throw new Error(`UI condition timed out: ${expression}`)
  }
  await command('Page.enable'); await command('Runtime.enable')
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('colegio-saas.auth-token','smoke-token');localStorage.setItem('i18nConfig',JSON.stringify({selectedLang:'es'}));`})
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  const navigate = async (route, text) => { console.log('Checking', route); await command('Page.navigate', {url: `http://127.0.0.1:5197${route}`}); await until(`document.body.innerText.includes(${JSON.stringify(text)})`) }
  const screenshot = async (name, full = false) => { const image = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: full}); fs.writeFileSync(path.join(artifacts, `${name}.png`), Buffer.from(image.data, 'base64')) }
  if (process.argv.includes('--account')) {
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
    await until(`${areaRows}?.length === 5`)
    await evaluate(`document.querySelector('section[aria-label="Materias"]').scrollIntoView({block:'start'})`)
    await screenshot('materias-filters-desktop', true)
    assert.ok(await evaluate(`(()=>{const section=document.querySelector('section[aria-label="Materias"]');return !!section.querySelector('select[aria-label="Área"]') && !!section.querySelector('select[aria-label="Nivel educativo"]') && !!section.querySelector('select[aria-label="Estado"]') && section.querySelectorAll('input[type="search"]').length===1})()`), 'The Materias section needs one name search and visibly identified area, level, and status selectors.')
    await evaluate(`(()=>{const area=document.querySelector('section[aria-label="Materias"] select[aria-label="Área"]');area.focus();area.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}))})()`)
    await until(`document.querySelector('section[aria-label="Materias"] select[aria-label="Área"]').options.length === 26`)
    assert.ok(pagedReads.some(read => read.page === 1 && read.perPage === 1000), 'Opening the area selector must load the remaining existing areas.')
    assert.ok(pagedReads.some(read => read.page === 1 && read.perPage === 5), 'The first area request must fetch five rows.')
    assert.ok(await evaluate(`!!document.querySelector('.pagination')`), 'More than 20 results require numbered pages.')
    await evaluate(`Array.from(document.querySelectorAll('.pagination button')).find(button => button.textContent.trim() === '2').click()`)
    await until(`${areaRows}?.[0]?.innerText.includes('Área 06')`)
    assert.ok(pagedReads.some(read => read.page === 2 && read.perPage === 5), 'Page two must retain the selected size.')
    await evaluate(`(() => {const select=document.querySelector('select[aria-label="Filas por página"]');select.value='50';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`${areaRows}?.length === 25`)
    assert.ok(pagedReads.some(read => read.page === 1 && read.perPage === 50), 'Changing the size must change the backend request.')
    await evaluate(`document.querySelector('input[aria-label="Buscar por nombre"]').focus()`)
    await command('Input.insertText', {text: 'Área 25'})
    await until(`${areaRows}?.length === 1 && ${areaRows}?.[0]?.innerText.includes('Área 25')`)
    assert.ok(pagedReads.some(read => read.search === 'área 25'), 'Search must run on the backend.')
    await evaluate(`(() => {const select=Array.from(document.querySelectorAll('select')).find(item => item.value==='50' && Array.from(item.options).some(option => option.value==='1000'));select.value='5';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    fixtures['/api/plan-estudios/areas'].data = fixtures['/api/plan-estudios/areas'].data.slice(0, 12)
    await navigate(path, 'Áreas y materias')
    await until(`${areaRows}?.length === 5`)
    assert.equal(await evaluate(`!!document.querySelector('.pagination')`), false, 'No numbered pager for 20 or fewer rows.')
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Mostrar más').click()`)
    await until(`${areaRows}?.length === 10`)
    assert.ok(pagedReads.some(read => read.page === 2 && read.perPage === 5), 'Show more must request the next five without changing size.')
    await navigate('/academico/siee', 'Configuración SIEE')
    const curriculoRows = `document.querySelector('#siee-curriculo-search')?.closest('.card')?.querySelectorAll('table tbody tr')`
    await until(`${curriculoRows}?.length === 5`)
    assert.ok(pagedReads.some(read => read.path === '/api/siee/1/curriculo' && read.page === 1 && read.perPage === 5))
    await evaluate(`Array.from(document.querySelector('#siee-curriculo-search').closest('.card').querySelectorAll('button')).find(button => button.textContent.trim() === 'Mostrar más').click()`)
    await until(`${curriculoRows}?.length === 10`)
    assert.ok(pagedReads.some(read => read.path === '/api/siee/1/curriculo' && read.page === 2 && read.perPage === 5))
    await evaluate(`document.querySelector('#siee-curriculo-search').focus()`)
    await command('Input.insertText', {text: 'Materia 12'})
    await until(`${curriculoRows}?.length === 1 && ${curriculoRows}?.[0]?.innerText.includes('Materia 12')`)
    assert.ok(pagedReads.some(read => read.path === '/api/siee/1/curriculo' && read.search === 'materia 12'))
    await navigate('/academico/evaluacion/catalogo', 'Evaluación')
    const assignmentRows = `document.querySelectorAll('table')[0]?.querySelectorAll('tbody tr')`
    const enrollmentRows = `document.querySelectorAll('table')[1]?.querySelectorAll('tbody tr')`
    await until(`${assignmentRows}?.length === 5 && ${enrollmentRows}?.length === 5`)
    assert.ok(pagedReads.some(read => read.path === '/api/evaluacion/catalogo' && read.assignmentPage === 1 && read.assignmentPerPage === 5 && read.enrollmentPage === 1 && read.enrollmentPerPage === 5))
    await evaluate(`Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === 'Mostrar más')[0].click()`)
    await until(`${assignmentRows}?.length === 10`)
    assert.ok(pagedReads.some(read => read.path === '/api/evaluacion/catalogo' && read.assignmentPage === 2 && read.assignmentPerPage === 5))
    await evaluate(`Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === 'Mostrar más')[1].click()`)
    await until(`${enrollmentRows}?.length === 10`)
    assert.ok(pagedReads.some(read => read.path === '/api/evaluacion/catalogo' && read.enrollmentPage === 2 && read.enrollmentPerPage === 5))
    assert.ok(await evaluate(`!document.querySelector('#evaluacion-search') && document.querySelectorAll('input[type="search"]').length === 1 && !document.querySelector('form select[aria-label="Estudiante"]')`), 'Evaluation needs only one student search, without duplicate filter searches or student select.')
    assert.ok(await evaluate(`!!document.querySelector('select[aria-label="Grupo"] option[value=""]') && !!document.querySelector('select[aria-label="Materia"] option[value=""]') && !!document.querySelector('select[aria-label="Estado"] option[value=""]')`), 'Group, subject, and status filters must be clear selects.')
    await evaluate(`document.querySelector('input[role="combobox"][aria-label="Estudiante"]').focus()`)
    await command('Input.insertText', {text: 'Alumno 12'})
    await until(`!!document.querySelector('#evaluacion-estudiantes-resultados button') && document.querySelector('#evaluacion-estudiantes-resultados').innerText.includes('Alumno 12')`)
    for (let i = 0; i < 20 && !pagedReads.some(read => read.path === '/api/evaluacion/catalogo' && read.studentSearch === 'alumno 12'); i++) await sleep(100)
    assert.ok(pagedReads.some(read => read.path === '/api/evaluacion/catalogo' && read.studentSearch === 'alumno 12'))
    await evaluate(`document.querySelector('form select[aria-label="Grupo"]').value='1';document.querySelector('form select[aria-label="Grupo"]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#evaluacion-estudiantes-resultados button').click()`)
    await until(`!document.querySelector('#evaluacion-estudiantes-resultados') && document.querySelector('form button.btn-primary')?.disabled === false`)
    await navigate(`/academico/evaluacion/planillas/${urlTokens.assignment}/${urlTokens.period}`, 'Planilla')
    const planillaRows = `Array.from(document.querySelectorAll('table')).at(-1)?.querySelectorAll('tbody tr')`
    await until(`${planillaRows}?.length === 5`)
    assert.ok(pagedReads.some(read => read.path === '/api/evaluacion/planillas/1/1' && read.page === 1 && read.perPage === 5))
    await evaluate(`document.querySelector('input[aria-label="Estudiante 01 · Taller 1"]').focus()`)
    await command('Input.insertText', {text: '4.2'})
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Mostrar más').click()`)
    await until(`${planillaRows}?.length === 10`)
    assert.ok(pagedReads.some(read => read.path === '/api/evaluacion/planillas/1/1' && read.page === 2 && read.perPage === 5))
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Estudiante 01 · Taller 1"]').value`), '4.2', 'Loading more students must retain unsaved marks.')
    assert.deepEqual(errors, [], 'Academic pagination browser errors.')
    console.log('PASS: areas, SIEE, evaluation catalog and gradebook: 5 default, numbered pages above 20, backend search, fixed-size show-more and retained grade drafts.')
  } else if (realtimeMode) {
    user.institution = {name: 'Colegio de prueba', plan: {key: 'esencial', name: 'Esencial'}}
    const subscribed = `window.Echo?.connector.pusher.channels.channels['private-tenant.smoke']?.subscribed === true`
    await navigate(`/academico/plan-estudios?ano=${urlTokens.year}&tab=horarios&grupo=${urlTokens.group}&espacio=${urlTokens.space}`, 'Horarios')
    await until(subscribed)
    await until(`!!document.querySelector('.schedule-session')`)
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
    fixtures['/api/horarios'].data.sesiones[0].materia = {id: 1, nombre: 'Clase actualizada por otra sesión'}
    reverbProbe({action: 'publish', resources: ['schedule']})
    await until(`document.body.innerText.includes('Clase actualizada por otra sesión')`)
    assert.ok(scheduleReads.length > readsBefore)
    const scheduleUpdates = scheduleReads.slice(readsBefore)
    assert.ok(scheduleUpdates.some(read => read.group === '1'), 'The selected group is refreshed.')
    assert.ok(scheduleUpdates.every(read => read.view === 'horarios' && [null, '1'].includes(read.group)), 'Only the empty filter catalog and selected group are requested.')
    await evaluate(`window.Echo.connector.pusher.disconnect()`)
    await until(`window.Echo.connector.pusher.connection.state === 'disconnected'`)
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
    assert.ok(await evaluate(`(() => {const trigger=document.querySelector('[data-testid="institutional-settings-trigger"]'),panel=document.querySelector('[data-testid="institutional-settings-panel"]');return !!trigger && !!panel && trigger.parentElement===panel.parentElement && panel.classList.contains('menu-sub-dropdown') && trigger.parentElement.getAttribute('data-kt-menu-placement')?.includes('left-start') && [...panel.querySelectorAll('a[data-kt-nav]')].map(a=>a.getAttribute('data-kt-nav')).join(',') === '/ajustes-institucionales/datos,/ajustes-institucionales/sedes'})()`), 'Institutional settings must open a separate flyout with Datos and Sedes.')
    await sleep(350)
    await screenshot('institutional-menu-mobile')
    await evaluate(`document.querySelector('[data-testid="institutional-settings-panel"] a[data-kt-nav="/ajustes-institucionales/datos"]').click()`)
    await until(`location.pathname === '/ajustes-institucionales/datos' && !!document.querySelector('.institutional-settings__header') && document.body.innerText.includes('Datos institucionales')`)
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), 'Institutional data page overflows on mobile.')
    await screenshot('institutional-data-mobile')
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
    for (const section of ['datos', 'sedes']) {
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
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Estudiante de prueba · Taller 1"]').max`), '5')
  await screenshot('gradebook-desktop')
  await navigate(`/academico/boletines/${urlTokens.enrollment}`, 'Informe preliminar')
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
  assert.equal(await evaluate(`document.querySelector('.modal.show #copy-year-source').value`), '1')
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
  await evaluate(`(()=>{const select=document.querySelector('.card-toolbar select');select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.nextYear}' && !document.querySelector('table tbody')?.innerText.includes('Primera')`)
  assert.equal(await evaluate(`document.querySelector('.card-toolbar select').value`), '2')
  await evaluate(`(()=>{const select=document.querySelector('.card-toolbar select');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.year}' && document.querySelector('table tbody')?.innerText.includes('Primera')`)
  assert.ok(await evaluate(`document.querySelector('[data-kt-nav="/academico/evaluacion/catalogo"]')?.getAttribute('href') === '/academico/evaluacion/catalogo'`), 'A header link must open its real route in another tab.')
  await navigate('/academico/estructura?tab=bloques&ano=1', 'Primera')
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.year}'`)
  await navigate('/academico/plan-estudios?tab=areas', 'Matemáticas')
  await evaluate(`(()=>{const select=document.querySelector('.card-toolbar select');select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.nextYear}' && !document.querySelector('table tbody')?.innerText.includes('Matemáticas')`)
  await evaluate(`(()=>{const select=document.querySelector('.card-toolbar select');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.year}' && document.querySelector('table tbody')?.innerText.includes('Matemáticas')`)
  await navigate(`/academico/plan-estudios?tab=areas&ano=${nextYear.legacy_url_token}`, 'Plan de estudios')
  await until(`new URLSearchParams(location.search).get('ano') === '${urlTokens.nextYear}' && !document.querySelector('table tbody')?.innerText.includes('Matemáticas')`)
  await navigate('/academico/plan-estudios?tab=resumen', 'Plan de estudios')
  await until(`document.querySelectorAll('.schedule-controls select').length === 2`)
  assert.ok(await evaluate(`(()=>{const controls=document.querySelector('.schedule-controls');controls.querySelector('select').focus();return controls.querySelectorAll('input[type="search"]').length===0 && [...controls.querySelectorAll('select')].every(select=>select.classList.contains('form-select-solid'))})()`), 'Summary filters must be plain solid selects without search inputs.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Grupo"]');select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`[...document.querySelectorAll('.row.g-5 .fs-2x')].map(item=>item.textContent.trim()).join(',')==='1,0,1'`)
  assert.ok(scheduleReads.some(read => read.view === null && read.group === '2'), 'Summary must request the selected group by internal ID.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Docente"]');select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`[...document.querySelectorAll('.row.g-5 .fs-2x')].map(item=>item.textContent.trim()).join(',')==='0,0,0'`)
  assert.ok(scheduleReads.some(read => read.view === null && read.group === '2' && read.teacher === '3'), 'Summary must request the selected teacher by internal ID.')
  await navigate('/academico/plan-estudios?tab=asignaciones', 'Sin docente asignado')
  assert.ok(await evaluate(`(()=>{const controls=document.querySelector('.schedule-controls');controls.querySelector('select').focus();return controls.querySelectorAll('select').length===3 && controls.querySelectorAll('input[type="search"]').length===0 && [...controls.querySelectorAll('select')].every(select=>select.classList.contains('form-select-solid'))})()`), 'Assignment filters must be three plain solid selects without search inputs.')
  assert.ok(await evaluate(`document.querySelector('table tbody')?.innerText.includes('Primero / (A)')`), 'The assignment table must show grade and group together.')
  await evaluate(`document.querySelector('table tbody .btn-light-primary').click()`)
  await until(`!!document.querySelector('.modal.show select[name="materia_id"]')`)
  assert.ok(await evaluate(`(()=>{const modal=document.querySelector('.modal.show');return modal.querySelectorAll('input[type="search"]').length===0 && [...modal.querySelectorAll('select[name]')].every(select=>!!modal.querySelector('label[for="'+select.id+'"]'))})()`), 'Assignment form selectors need labels and no duplicate search inputs.')
  assert.ok(await evaluate(`!document.querySelector('.modal.show select[name="materia_id"]').disabled && !document.querySelector('.modal.show select[name="grupo_id"]').disabled`), 'Subject and group must be editable in assignments.')
  await evaluate(`document.querySelector('.modal.show .btn-close').click()`)
  await until(`!document.querySelector('.modal.show')`)
  await navigate('/academico/plan-estudios?tab=horarios&grupo=1&espacio=1&docente=3', 'Plan de estudios')
  await until(`(()=>{const params=new URLSearchParams(location.search);return params.get('grupo')==='${urlTokens.group}' && params.get('espacio')==='${urlTokens.space}' && params.get('docente')==='${urlTokens.teacher}'})()`)
  await navigate('/academico/plan-estudios?tab=horarios', 'Selecciona un grupo')
  assert.ok(await evaluate(`(()=>{const controls=document.querySelector('.schedule-controls');controls.querySelector('select').focus();return controls.querySelectorAll('select').length===3 && controls.querySelectorAll('input[type="search"]').length===0 && [...controls.querySelectorAll('select')].every(select=>select.classList.contains('form-select-solid'))})()`), 'Timetable filters must be three plain solid selects without search inputs.')
  await until(`!!document.querySelector('.schedule-controls select[aria-label="Grupo"] option[value="52"]')`)
  assert.ok(await evaluate(`document.querySelector('.schedule-controls select[aria-label="Grupo"] option[value="52"]').textContent.includes('Grupo 52')`), 'A group beyond the first 50 catalog choices must be reachable in the selector without a search field.')
  assert.equal(await evaluate(`document.querySelectorAll('.schedule-session').length`), 0, 'The rector must choose a group before loading the timetable.')
  assert.ok(scheduleReads.some(read => read.view === 'horarios' && read.group === null), 'The first schedule request must ask only for catalogs.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Grupo"]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('grupo') === '${urlTokens.group}' && document.querySelectorAll('.schedule-session').length === 1`)
  assert.ok(scheduleReads.some(read => read.view === 'horarios' && read.group === '1'), 'The timetable request must send the chosen group to the API.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Espacio físico"]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('espacio') === '${urlTokens.space}' && document.querySelectorAll('.schedule-session').length === 1`)
  await command('Page.reload')
  await sleep(500)
  await until(`document.querySelectorAll('.schedule-session').length === 1 && document.querySelector('.schedule-controls select[aria-label="Grupo"]')?.value === '1' && document.querySelector('.schedule-controls select[aria-label="Espacio físico"]')?.value === '1'`)
  assert.ok(await evaluate(`(()=>{const url=new URL(location.href);return ['ano','grupo','espacio'].every(name => /^[A-Za-z0-9_-]{20,30}$/.test(url.searchParams.get(name) ?? ''))})()`), 'The selected year, group and room must have short opaque URL tokens.')
  assert.ok(await evaluate(`(()=>{const scroll=document.querySelector('.schedule-scroll');return scroll.scrollHeight <= scroll.clientHeight + 1 && scroll.scrollWidth > scroll.clientWidth})()`), 'Only horizontal scrolling should remain inside the timetable.')
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Docente"]');select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('docente') === '${urlTokens.teacher}' && document.querySelectorAll('.schedule-session').length === 0`)
  await command('Page.reload')
  await sleep(500)
  await until(`document.querySelector('.schedule-controls select[aria-label="Docente"]')?.value === '3' && document.querySelectorAll('.schedule-session').length === 0`)
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
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Grupo"]');select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('grupo') === '${urlTokens.groupB}' && document.querySelectorAll('.schedule-session').length === 1`)
  await evaluate(`document.querySelector('.schedule-session').click()`)
  await until(`!!document.querySelector('.modal.show input[name="hora_inicio"]')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show input[name="hora_fin"]')`))
  await sleep(300)
  await screenshot('schedule-custom-modal')
  await evaluate(`document.querySelector('.modal.show .btn-close').click()`)
  await until(`!document.querySelector('.modal.show')`)
  await evaluate(`(()=>{const select=document.querySelector('.schedule-controls select[aria-label="Grupo"]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`new URLSearchParams(location.search).get('grupo') === '${urlTokens.group}' && document.querySelectorAll('.schedule-session').length === 1`)
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Agregar clase')).click()`)
  await until(`!!document.querySelector('.modal.show select[name="grupo_id"]')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show select[name="materia_id"]')`))
  assert.equal(await evaluate(`document.querySelector('.modal.show select[name="docente_id"] option').value`), '')
  await evaluate(`(()=>{const select=document.querySelector('.modal.show select[name="grupo_id"]');select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`!!document.querySelector('.modal.show #schedule-start')`)
  assert.equal(await evaluate(`!!document.querySelector('.modal.show select[name="bloque_horario_id"]')`), false)
  await evaluate(`(()=>{const select=document.querySelector('.modal.show select[name="grupo_id"]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`!!document.querySelector('.modal.show input[type="checkbox"]')`)
  await evaluate(`document.querySelector('.modal.show input[type="checkbox"]').click()`)
  await until(`!!document.querySelector('.modal.show select[name="bloque_horario_id"]')`)
  await evaluate(`(()=>{const select=document.querySelector('.modal.show select[name="bloque_horario_id"]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
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
  assert.deepEqual([writes[0].method, writes[0].path, writes[0].body.dia, writes[0].body.bloque_horario_id], ['PUT', '/api/horarios/1', 'martes', 1])
  assert.deepEqual([writes[0].body.grupo_id, writes[0].body.materia_id, writes[0].body.espacio_fisico_id, writes[0].body.docente_id], [1, 1, 1, null])
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
  assert.deepEqual([writes[1].method, writes[1].path, writes[1].body.dia, writes[1].body.hora_inicio, writes[1].body.hora_fin, writes[1].body.bloque_horario_id], ['POST', '/api/horarios', 'miercoles', '09:15', '10:00', null])
  assert.deepEqual([writes[1].body.grupo_id, writes[1].body.materia_id, writes[1].body.espacio_fisico_id, writes[1].body.docente_id], [1, 1, 1, null])
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
  await command('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: touch.x, y: touch.y - 56, id: 0}]})
  await until(`!!document.querySelector('[data-schedule-day="lunes"] .schedule-drop-preview')`)
  await screenshot('schedule-touch-drag')
  await command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []})
  for (let i = 0; i < 50 && writes.length < 3; i++) await sleep(100)
  assert.equal(writes.length, 3, 'Touch dragging should also move a class.')
  assert.deepEqual([writes[2].method, writes[2].path, writes[2].body.dia, writes[2].body.hora_inicio, writes[2].body.hora_fin], ['PUT', '/api/horarios/1', 'lunes', '07:30', '08:15'])
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
  socket?.close()
  browser?.kill()
  await server?.close()
  // Profile is isolated in the OS temporary directory, never the user browser profile.
}
