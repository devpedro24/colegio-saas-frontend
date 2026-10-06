import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/lib/realtime.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {shouldRefreshQuery, refreshesIdentity, onLocalChange, notifyLocalChange, resourceForPath} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

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
  assert.equal(resourceForPath('/aula/intentos/opaque/finalizar?opaque=1'), 'aula')
})
