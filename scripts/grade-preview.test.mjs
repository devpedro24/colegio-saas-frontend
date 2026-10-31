import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)
const source = fs.readFileSync(new URL('../src/app/pages/academico/evaluacion/useGradePreview.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText

function harness() {
  let state = null, cleanup, previous, timer, writes = 0
  const calls = []
  const loaded = {exports: {}}
  const mocks = {
    react: {useState: () => [state, next => {state = next; writes++}], useEffect: (run, dependencies) => {
      if (JSON.stringify(dependencies) !== previous) {cleanup?.(); previous = JSON.stringify(dependencies); cleanup = run()}
    }},
    '@/lib/api/client': {api: {post: (url, body, options) => new Promise((resolve, reject) => calls.push({url, body, options, resolve, reject}))}},
    '../shared/opaqueAcademic': {toOpaqueAcademic: value => value, fromOpaqueAcademic: value => value},
    './gradeDecimal': {validGrade: value => value === '' || (/^\d+(?:\.\d{1,8})?$/.test(value) && Number(value) <= 5)},
  }
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', code)(
    id => mocks[id] ?? require(id), loaded, loaded.exports, action => {timer = action; return action}, action => {if (timer === action) timer = null})
  const data = {editable: true, configuracion: {valor_min: '0', valor_max: '5'}, escala_visual: {tipo: 'numerica', opciones: []}}
  return {calls, data, get writes() {return writes}, tick: () => {const action = timer; timer = null; action?.()},
    render: (draft, sheet = data) => loaded.exports.useGradePreview('assignment', 'period', sheet, draft)}
}
const row = value => ({a: {actividad_id: 'activity', matricula_id: 'student', valor: value, version: 2}})
const settle = () => new Promise(resolve => setImmediate(resolve))

test('preview batches typing, ignores stale responses and never requests a grade save', async () => {
  const h = harness()
  assert.equal(h.render({}).pending, false); h.tick(); assert.equal(h.calls.length, 0)
  h.render(row('3')); h.render(row('4')); h.tick()
  assert.equal(h.calls.length, 1)
  assert.match(h.calls[0].url, /\/vista-previa\?opaque=1$/)
  assert.equal(h.calls[0].body.notas[0].valor, '4')
  assert.equal(h.calls[0].options.notifyLocalChange, false)
  h.render(row('5')); h.tick()
  h.calls[1].resolve({data: {resultados: [{matricula_id: 'student', display_value: '5'}]}}); await settle()
  assert.equal(h.render(row('5')).results.get('student').display_value, '5')
  const writes = h.writes
  h.calls[0].resolve({data: {resultados: [{matricula_id: 'student', display_value: '4'}]}}); await settle()
  assert.equal(h.writes, writes)
  assert.equal(h.render(row('5')).results.get('student').display_value, '5')
  h.render({}); h.tick(); assert.equal(h.calls.length, 2)
})

test('preview handles visual categories, invalid input and read-only periods', async () => {
  const h = harness()
  assert.equal(h.render(row('abc')).invalid, true); h.tick(); assert.equal(h.calls.length, 0)
  h.render(row('4'), {...h.data, editable: false}); h.tick(); assert.equal(h.calls.length, 0)
  const visual = {...h.data, escala_visual: {tipo: 'imagenes', opciones: [{url_token: 'happy'}]}}
  const draft = {a: {...row(null).a, escala_opcion_token: 'happy'}}
  h.render(draft, visual); h.tick()
  assert.equal(h.calls[0].body.notas[0].escala_opcion_token, 'happy')
  assert.equal(h.calls[0].body.notas[0].valor, null)
  h.calls[0].reject(new Error('Version conflict')); await settle()
  assert.equal(h.render(draft, visual).error, 'Version conflict')
})
