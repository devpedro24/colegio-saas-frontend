import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
const impersonationModule = moduleUrl(`
  export const getImpersonation = () => globalThis.smokeContext.state;
  export const clearImpersonation = () => {globalThis.smokeContext.state = {activeColegio: null}};
`)
const queryModule = moduleUrl(`export const queryClient = {clear: () => globalThis.smokeContext.clears++}`)
const realtimeModule = moduleUrl(ts.transpileModule(
  fs.readFileSync(new URL('../src/lib/realtime.ts', import.meta.url), 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}},
).outputText)

const originalFetch = globalThis.fetch
const originalStorage = globalThis.localStorage
const originalDocument = globalThis.document
const storage = new Map([
  ['colegio-saas.auth-token', 'old-platform-secret'],
  ['colegio-saas.impersonation-token', 'old-school-secret'],
  ['colegio-saas.active-colegio', JSON.stringify({id: 'legacy-school-id', name: 'Colegio'})],
])
globalThis.smokeContext = {state: {activeColegio: null}, clears: 0}
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
}
globalThis.document = {cookie: 'school_saas_csrf=csrf-value'}
const legacyCalls = []
globalThis.fetch = async (url, options) => {
  legacyCalls.push({url, options})
  return new Response('{}', {headers: {'Content-Type': 'application/json'}})
}

const source = fs.readFileSync(new URL('../src/lib/api/client.ts', import.meta.url), 'utf8')
let js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
js = js.replaceAll('@/app/modules/impersonation/impersonation.store', impersonationModule)
  .replaceAll('./query-client', queryModule).replaceAll('../realtime', realtimeModule)
const {api, onSessionExpired} = await import(moduleUrl(js))
await new Promise(resolve => setTimeout(resolve, 0))

test('legacy credentials are removed immediately and revoked without new cookies', () => {
  assert.equal(storage.size, 0)
  assert.deepEqual(legacyCalls.map(call => call.url), ['/api/logout'])
  assert.ok(legacyCalls.every(call => call.options.credentials === 'omit'))
  assert.ok(legacyCalls.every(call => call.options.headers.Authorization === 'Bearer old-platform-secret'))
  assert.equal(legacyCalls[0].options.body, undefined)
})

test('cookie requests send CSRF, never Bearer or X-Tenant, and discard old school responses', async () => {
  let resolve
  let sent
  globalThis.smokeContext.state = {activeColegio: {slug: 'school-a'}}
  globalThis.fetch = (_url, options) => {
    sent = options
    return new Promise(done => {resolve = done})
  }
  const oldRequest = api.post('/evaluacion/catalogo', {value: 1})
  assert.equal(sent.credentials, 'same-origin')
  assert.equal(sent.headers['X-CSRF-Token'], 'csrf-value')
  assert.equal(sent.headers.Authorization, undefined)
  assert.equal(sent.headers['X-Tenant'], undefined)
  globalThis.smokeContext.state = {activeColegio: {slug: 'school-b'}}
  resolve(new Response(JSON.stringify({data: ['private-school-a']}), {headers: {'Content-Type': 'application/json'}}))
  await assert.rejects(oldRequest, {name: 'AbortError'})
})

test('an expired school context clears only impersonation; platform expiry notifies auth', async () => {
  globalThis.smokeContext.state = {activeColegio: {slug: 'school-a'}}
  globalThis.fetch = async () => new Response(JSON.stringify({message: 'expired'}), {
    status: 401, headers: {'Content-Type': 'application/json'},
  })
  await assert.rejects(api.get('/siee/opaque-token'), {status: 401})
  assert.equal(globalThis.smokeContext.state.activeColegio, null)

  let expired = 0
  const unsubscribe = onSessionExpired(() => {expired++})
  await assert.rejects(api.get('/colegios'), {status: 401})
  assert.equal(expired, 1)
  unsubscribe()
})

test.after(() => {
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalStorage
  globalThis.document = originalDocument
  delete globalThis.smokeContext
})
