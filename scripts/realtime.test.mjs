import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/lib/realtime.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {shouldRefreshQuery, refreshesIdentity, onLocalChange, notifyLocalChange, resourceForPath,
  rememberOwnChange, isOwnChange} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('the originating tab recognizes its own broadcast without hiding another tab change', () => {
  const own = '3e0aa476-d27c-4d85-8720-83dc8dd2f21c'
  rememberOwnChange(own)
  assert.equal(isOwnChange(own), true)
  assert.equal(isOwnChange('d1a029e1-d178-412b-b947-009340769a4e'), false)
  assert.equal(isOwnChange(undefined), false)
})

test('a school year change refreshes selectors and dependent academic views', () => {
  for (const root of ['anos-lectivos', 'estructura', 'plan-estudios', 'horarios', 'siee', 'evaluacion', 'boletines']) {
    assert.equal(shouldRefreshQuery([root, 'year-token', 'group-token'], ['academic'], 'tenant'), true, root)
  }
  assert.equal(shouldRefreshQuery(['horarios'], ['events'], 'tenant'), true)
  assert.equal(shouldRefreshQuery(['evaluacion', 'planillas'], ['schedule'], 'tenant'), true)
})

test('platform events do not refresh another active school, and tenant events do not touch the central cache', () => {
  assert.equal(shouldRefreshQuery(['horarios'], ['all'], 'platform'), false)
  assert.equal(shouldRefreshQuery(['colegios'], ['all'], 'tenant'), false)
  assert.equal(shouldRefreshQuery(['colegios'], ['schools'], 'platform'), true)
  assert.equal(shouldRefreshQuery(['new-module'], ['new-resource'], 'tenant'), true)
  assert.equal(shouldRefreshQuery(['horarios'], ['access'], 'tenant'), true)
})

test('identity is refreshed for changed roles, profile or access, without refreshing it for every class', () => {
  for (const resource of ['rbac', 'users', 'account', 'access']) assert.equal(refreshesIdentity([resource]), true)
  assert.equal(refreshesIdentity(['schedule']), false)
  assert.equal(resourceForPath('/asignaciones/opaque-token?opaque=1'), 'schedule')
  assert.equal(resourceForPath('/asistencias?opaque=1'), 'attendance')
  assert.equal(shouldRefreshQuery(['asistencias', 'group'], ['attendance'], 'tenant'), true)
  assert.equal(shouldRefreshQuery(['anos-lectivos'], ['attendance'], 'tenant'), false)
  assert.equal(resourceForPath('/siee/opaque-token/curriculo/masivo'), 'curriculum')
  assert.equal(resourceForPath('/siee/opaque-token/curriculo?opaque=1'), 'curriculum')
  assert.equal(resourceForPath('/siee/opaque-token'), 'academic-config')
  assert.equal(shouldRefreshQuery(['anos-lectivos'], ['schedule'], 'tenant'), false)
  for (const root of ['academic-options', 'academic-options-all']) {
    for (const resource of ['academic', 'structure', 'curriculum', 'schedule', 'users']) {
      assert.equal(shouldRefreshQuery([root, 'grupos'], [resource], 'tenant'), true)
    }
    assert.equal(shouldRefreshQuery([root, 'grupos'], ['schedule'], 'platform'), false)
  }
})

test('local successful mutations use the same topics and unsubscribe on logout', () => {
  const received = []
  const stop = onLocalChange(change => received.push(change))
  notifyLocalChange({resource: resourceForPath('/anos-lectivos/1'), token: 'session'})
  stop()
  notifyLocalChange({resource: 'academic', token: 'old-session'})
  assert.deepEqual(received, [{resource: 'academic', token: 'session'}])
})

test('autosaving an exam does not refetch every classroom or gradebook', () => {
  for (const suffix of ['respuestas', 'pagina', 'incidentes']) {
    assert.equal(resourceForPath(`/aula/intentos/opaque/${suffix}?opaque=1`), 'aula-attempt')
    assert.equal(shouldRefreshQuery(['aula', 'catalogo'], ['aula-attempt'], 'tenant'), false)
    assert.equal(shouldRefreshQuery(['evaluacion', 'planillas'], ['aula-attempt'], 'tenant'), false)
  }
  assert.equal(resourceForPath('/aula/intentos/opaque/finalizar?opaque=1'), 'aula-grade')
})

test('opening a classroom resource updates only private progress', () => {
  assert.equal(resourceForPath('/aula/recursos/opaque/abrir?opaque=1'), 'aula-progress')
  for (const root of ['aula', 'evaluacion', 'usuarios', 'estructura', 'onboarding']) {
    assert.equal(shouldRefreshQuery([root], ['aula-progress'], 'tenant'), false, root)
  }
  assert.equal(refreshesIdentity(['aula-progress']), false)
  assert.equal(resourceForPath('/aula/recursos/opaque/archivar?opaque=1'), 'aula')
  assert.equal(shouldRefreshQuery(['estructura', 'sedes'], ['aula'], 'tenant'), false)
  assert.equal(shouldRefreshQuery(['usuarios'], ['aula'], 'tenant'), false)
  assert.equal(shouldRefreshQuery(['onboarding'], ['aula'], 'tenant'), false)
  assert.equal(shouldRefreshQuery(['aula', 'catalogo'], ['aula'], 'tenant'), true)
  assert.equal(shouldRefreshQuery(['evaluacion', 'planillas'], ['aula'], 'tenant'), false)
  assert.equal(shouldRefreshQuery(['evaluacion', 'planillas'], ['aula-grade'], 'tenant'), true)
  assert.equal(resourceForPath('/aula/secciones/opaque/recursos?opaque=1'), 'aula-grade')
  assert.equal(resourceForPath('/aula/recursos/opaque?opaque=1'), 'aula-grade')
  assert.equal(resourceForPath('/aula/recursos/opaque/archivar?opaque=1'), 'aula')
})

test('enrollment documents and sender settings refresh their own module only', () => {
  assert.equal(resourceForPath('/ingreso-publico/documentos/identidad'), 'enrollment-intake')
  assert.equal(resourceForPath('/correo-institucional'), 'school-mail')
  assert.equal(shouldRefreshQuery(['ingreso','tenant'], ['enrollment-intake'], 'tenant'), true)
  assert.equal(shouldRefreshQuery(['ingreso','tenant'], ['school-mail'], 'tenant'), true)
  for (const resource of ['enrollment-intake','school-mail']) {
    for (const root of ['onboarding','estructura','anos-lectivos','horarios','siee','aula']) assert.equal(shouldRefreshQuery([root], [resource], 'tenant'), false)
    assert.equal(refreshesIdentity([resource]), false)
  }
})

test('mail approval events refresh only the matching scope and never identity or academic modules', () => {
  for (const path of ['/platform/correo-solicitudes/TOKEN/resolver', '/platform/correo-solicitudes?estado=pendiente', '/correo-institucional/solicitudes']) {
    assert.equal(resourceForPath(path), 'school-mail-requests')
  }
  assert.equal(resourceForPath('/platform/correo-solicitudes-other'), 'all')
  assert.equal(shouldRefreshQuery(['school-mail-requests', 'summary'], ['school-mail-requests'], 'platform'), true)
  assert.equal(shouldRefreshQuery(['school-mail-requests', 'list', 'pendiente', 1], ['school-mail-requests'], 'platform'), true)
  assert.equal(shouldRefreshQuery(['school-mail'], ['school-mail-requests'], 'tenant'), true)
  assert.equal(shouldRefreshQuery(['school-mail'], ['school-mail-requests'], 'platform'), false)
  assert.equal(shouldRefreshQuery(['school-mail-requests'], ['school-mail-requests'], 'tenant'), false)
  for (const scope of ['tenant', 'platform']) {
    for (const root of ['ingreso', 'onboarding', 'estructura', 'anos-lectivos', 'colegios', 'horarios', 'account']) {
      assert.equal(shouldRefreshQuery([root], ['school-mail-requests'], scope), false, `${scope}/${root}`)
    }
  }
  assert.equal(refreshesIdentity(['school-mail-requests']), false)
})

test('attachment uploads refresh only the visible classroom content', () => {
  for (const path of ['/aula/recursos/opaque/adjuntos?opaque=1', '/aula/entregas/opaque/adjuntos?opaque=1',
    '/aula/adjuntos/opaque?opaque=1']) {
    assert.equal(resourceForPath(path), 'aula-content')
  }
  for (const key of [['aula', 'classroom-token'], ['aula', 'recurso', 'resource-token'],
    ['aula', 'entregas', 'resource-token']]) {
    assert.equal(shouldRefreshQuery(key, ['aula-content', 'audit'], 'tenant'), true, key.join('/'))
  }
  for (const key of [['aula', 'catalogo', 'year-token', 'group-token'], ['aula', 'planilla-destino', 'section-token'],
    ['aula', 'mi-intento', 'resource-token'], ['onboarding'], ['estructura', 'sedes'], ['anos-lectivos'],
    ['horarios'], ['siee', 'token'], ['evaluacion', 'planillas']]) {
    assert.equal(shouldRefreshQuery(key, ['aula-content', 'audit'], 'tenant'), false, key.join('/'))
  }
  assert.equal(refreshesIdentity(['aula-content', 'audit']), false)
})
