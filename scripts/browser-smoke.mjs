// UI smoke test with isolated browser profile and in-memory API fixtures. No real database.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import assert from 'node:assert/strict'
import {createServer} from 'vite'

const root = path.resolve(import.meta.dirname, '..')
const browserPath = process.env.SMOKE_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
assert.ok(fs.existsSync(browserPath), 'Set SMOKE_BROWSER_PATH to a Chromium browser executable.')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'colegio-ui-smoke-'))
const artifacts = path.join(root, 'artifacts', 'ui-smoke')
fs.mkdirSync(artifacts, {recursive: true})
const today = new Date().toLocaleDateString('en-CA')
const user = {id: 1, name: 'Rector de prueba', email: 'rector@example.test', is_platform: false, roles: ['rector'], permissions: ['academico.anos.gestionar', 'academico.configurar', 'academico.estructura.gestionar', 'academico.plan_estudios.gestionar'], mfa_enabled: false}
const year = {id: 1, nombre: '2026', estado: 'en_curso', tipo_calendario: 'A', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', num_periodos: 3}
const group = {id: 1, nombre: 'A', ano_lectivo_id: 1, jornada_id: 1, sede_id: 1, grado: {id: 1, nombre: 'Primero', nivel_id: 1}, sede: {id: 1, nombre: 'Sede Principal'}, jornada: {id: 1, nombre: 'Mañana', hora_inicio: '07:00:00', hora_fin: '12:30:00'}}
const groupB = {...group, id: 2, nombre: 'B'}
const groupC = {...group, id: 3, nombre: 'C', jornada_id: 2, jornada: {id: 2, nombre: 'Tarde', hora_inicio: '13:00:00', hora_fin: '17:00:00'}}
const enrollment = {id: 1, estudiante_id: 2, ano_lectivo_id: 1, grupo_id: 1, estado: 'activa', estudiante: {id: 2, name: 'Estudiante de prueba'}, grupo: group}
const assignment = {id: 1, ano_lectivo_id: 1, grupo_id: 1, materia_id: 1, docente_id: 3, grupo: group, materia: {id: 1, nombre: 'Matemáticas'}}
const period = {id: 1, ano_lectivo_id: 1, nombre: 'Trimestre 1', orden: 1, estado: 'abierto'}
const block = {id: 1, nombre: 'Primera', jornada_id: 1, hora_inicio: '08:00', hora_fin: '09:00'}
const config = {usar_areas: false, modo_area: 'SIMPLE_AVERAGE', modo_asignatura: 'SIMPLE_AVERAGE', modo_anual: 'SIMPLE_AVERAGE', redondeo: 'HALF_UP', precision_calculo: 8, recuperacion: 'REPLACE', mostrar_final: true, etiqueta_final: 'Definitiva', escala_id: 1, metodo_id: 1, valor_min: '0', valor_max: '5', decimales: 2, nota_minima: '3'}
const event = {id: 1, titulo: 'Feria de ciencias', descripcion: 'Compartimos nuestros experimentos.', fecha: today, hora_inicio: null, hora_fin: null, categoria: 'actividad', institucional: true, materia_id: null, grupos: [], created_by: 1, created_at: new Date().toISOString()}
const fixtures = {
  '/api/me': {user},
  '/api/tenant-status': {is_tenant: true, tenant: {id: 'smoke', name: 'Colegio de prueba', status: 'active'}},
  '/api/anos-lectivos': {data: [year]},
  '/api/horarios': {data: {can_manage: true, anos: [year], grupos: [group, groupB, groupC], docentes: [], areas: [], materias: [{...assignment.materia, estado: 'activo', nivel_id: null}], bloques: [block], espacios: [], asignaciones: [], sesiones: [{id: 1, asignacion_id: null, grupo_id: 1, materia_id: 1, docente_id: null, grupo: group, materia: assignment.materia, docente: null, dia: 'lunes', bloque_horario_id: 1, hora_inicio: null, hora_fin: null, espacio_fisico_id: null, bloque: block, espacio: null}, {id: 2, asignacion_id: null, grupo_id: 2, materia_id: 1, docente_id: null, grupo: groupB, materia: assignment.materia, docente: null, dia: 'lunes', bloque_horario_id: null, hora_inicio: '08:00:00', hora_fin: '09:00:00', espacio_fisico_id: null, bloque: null, espacio: null}]}},
  '/api/eventos/catalogo': {data: {es_rector: true, puede_crear: true, docentes_cualquier_grupo: false, grupos: [group], materias: [assignment.materia], asignaciones: [assignment]}},
  '/api/eventos': {data: [event], last_page: 1},
  '/api/eventos/1': {data: {...event, archivos: [], puede_editar: true}},
  '/api/evaluacion/catalogo': {data: {can_manage: true, can_configure: true, can_view_reports: true, anos: [year, {...year, id: 2, nombre: '2027'}], periodos: [period, {...period, id: 2, ano_lectivo_id: 2}], asignaciones: [assignment], matriculas: [enrollment], grupos: [group], estudiantes: []}},
  '/api/evaluacion/planillas/1/1': {data: {editable: true, configuracion: config, componentes: [{id: 1, asignacion_id: 1, periodo_id: 1, nombre: 'Talleres', modo: 'SIMPLE_AVERAGE', peso: null, actividades: [{id: 1, componente_id: 1, nombre: 'Taller 1', fecha: today, peso: null}]}], matriculas: [enrollment], calificaciones: [], resultados: [{matricula_id: 1, estado: 'pendiente', motivo: 'Faltan notas'}]}},
  '/api/evaluacion/boletines/1': {data: {tipo: 'VISTA_PREVIA', generado_en: new Date().toISOString(), institucion: 'Colegio de prueba', estudiante: enrollment.estudiante, grupo: 'A', grado: 'Primero', ano: '2026', configuracion: config, periodos: [period], asignaturas: [{materia_id: 1, nombre: 'Matemáticas', peso_area: null, periodos: [{periodo_id: 1, estado: 'pendiente'}], anual: {estado: 'pendiente'}}], areas: [], advertencias: []}},
  '/api/siee/1': {data: {editable: true, configuracion: config, version: 1, escalas: [{id: 1, nombre: 'Numérica', tipo: 'numerica', valor_min: '0', valor_max: '5', decimales: 2}], metodos: [{id: 1, calculo_nota: 'promedio_simple', nota_minima: '3', ambito: 'materia'}], curriculo: [], grados: [group.grado], materias: [assignment.materia], areas: []}},
}
const writes = []
let server, browser, socket
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  server = await createServer({root, logLevel: 'error', server: {host: '127.0.0.1', port: 5197, strictPort: true}, plugins: [{name: 'smoke-api', configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      const url = new URL(req.url, 'http://localhost')
      if (!url.pathname.startsWith('/api')) return next()
      console.log('Fixture', req.method, url.pathname)
      if (req.method !== 'GET') writes.push({method: req.method, path: url.pathname})
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(fixtures[url.pathname] ?? {data: [], meta: {total: 0, current_page: 1, last_page: 1}}))
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
    for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await sleep(100) }
    console.error('Page at failure:', await evaluate('document.body.innerText.slice(0, 2500)'), errors)
    const capture = await command('Page.captureScreenshot', {format: 'png'})
    fs.writeFileSync(path.join(artifacts, 'failure.png'), Buffer.from(capture.data, 'base64'))
    throw new Error(`UI condition timed out: ${expression}`)
  }
  await command('Page.enable'); await command('Runtime.enable')
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('colegio-saas.auth-token','smoke-token');localStorage.setItem('i18nConfig',JSON.stringify({selectedLang:'es'}));`})
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  const navigate = async (route, text) => { console.log('Checking', route); await command('Page.navigate', {url: `http://127.0.0.1:5197${route}`}); await until(`document.body.innerText.includes(${JSON.stringify(text)})`) }
  const screenshot = async name => { const image = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false}); fs.writeFileSync(path.join(artifacts, `${name}.png`), Buffer.from(image.data, 'base64')) }
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
  await navigate('/academico/evaluacion/planillas/1/1', 'Taller 1')
  await until(`!!document.querySelector('input[aria-label="Estudiante de prueba · Taller 1"]')`)
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Estudiante de prueba · Taller 1"]').max`), '5')
  await screenshot('gradebook-desktop')
  await navigate('/academico/boletines/1', 'Informe preliminar')
  await screenshot('report-preview')
  await navigate('/academico/siee', 'Currículo por Grado')
  await screenshot('siee-desktop')
  await navigate('/academico/plan-estudios?tab=horarios', 'Matemáticas')
  await until(`document.querySelectorAll('.schedule-session').length === 2`)
  assert.ok(await evaluate(`document.querySelector('.schedule-time-axis').innerText.includes('19:00')`), 'The weekly grid must remain visible through 19:00.')
  assert.ok(await evaluate(`(()=>{const [a,b]=[...document.querySelectorAll('.schedule-session')].map(el=>el.getBoundingClientRect());return a.right <= b.left && a.top === b.top})()`), 'Simultaneous classes must not cover one another.')
  await screenshot('schedule-desktop')
  await evaluate(`document.querySelector('.schedule-session').click()`)
  await until(`!!document.querySelector('.modal.show')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show select[name="bloque_horario_id"]')`))
  await sleep(300)
  await screenshot('schedule-block-modal')
  await evaluate(`document.querySelector('.modal.show .btn-close').click()`)
  await until(`!document.querySelector('.modal.show')`)
  await evaluate(`[...document.querySelectorAll('.schedule-session')][1].click()`)
  await until(`!!document.querySelector('.modal.show input[name="hora_inicio"]')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show input[name="hora_fin"]')`))
  await sleep(300)
  await screenshot('schedule-custom-modal')
  await evaluate(`document.querySelector('.modal.show .btn-close').click()`)
  await until(`!document.querySelector('.modal.show')`)
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
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.modal.show input[readonly]')].map(input=>input.value)`), ['Mañana', 'Sede Principal', '08:00', '09:00'])
  assert.ok(await evaluate(`document.querySelector('.modal.show').innerText.includes('Sede Principal')`))
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'Schedule modal overflows the mobile viewport.')
  await evaluate(`document.querySelector('.modal.show .btn-primary').scrollIntoView({block:'center'})`)
  await screenshot('schedule-mobile')
  assert.ok(await evaluate(`(()=>{const button=document.querySelector('.modal.show .btn-primary');const box=button.getBoundingClientRect();return button.contains(document.elementFromPoint(box.left+box.width*.85,box.top+box.height*.5))})()`), 'A floating control covers the schedule save button.')
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  assert.equal(writes.length, 0, 'Smoke test should not submit any mutation.')
  assert.deepEqual(errors, [], 'Uncaught browser errors.')
  console.log('PASS: matching menus, event modal, mobile width, gradebook scale, report preview, SIEE and non-overlapping schedules; screenshots in artifacts/ui-smoke.')
} finally {
  socket?.close()
  browser?.kill()
  await server?.close()
  // Profile is isolated in the OS temporary directory, never the user browser profile.
}
