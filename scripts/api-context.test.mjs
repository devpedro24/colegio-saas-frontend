import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
const impersonationModule = moduleUrl(`export const getActiveImpersonation = () => globalThis.smokeContext.active; export const clearImpersonation = () => {globalThis.smokeContext.active = null}`)
const queryModule = moduleUrl(`export const queryClient = {clear: () => globalThis.smokeContext.clears++}`)
const source = fs.readFileSync(new URL('../src/lib/api/client.ts', import.meta.url), 'utf8')
let js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const realtimeModule = moduleUrl(ts.transpileModule(fs.readFileSync(new URL('../src/lib/realtime.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText)
js = js.replaceAll('@/app/modules/impersonation/impersonation.store', impersonationModule).replaceAll('./query-client', queryModule).replaceAll('../realtime', realtimeModule)
const {api, setToken} = await import(moduleUrl(js))

test('requests from an old school cannot populate the new school context', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const storage = new Map([['colegio-saas.auth-token', 'platform-token']])
  globalThis.localStorage = {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)}
  globalThis.smokeContext = {active: {colegioId: 'school-a', token: 'tenant-a'}, clears: 0}
  try {
    let resolve
    let sentHeaders
    globalThis.fetch = (_url, options) => {sentHeaders = options.headers; return new Promise(done => {resolve = done})}
    const oldRequest = api.get('/evaluacion/catalogo')
    assert.equal(sentHeaders['X-Tenant'], 'school-a')
    assert.equal(sentHeaders.Authorization, 'Bearer tenant-a')
    globalThis.smokeContext.active = {colegioId: 'school-b', token: 'tenant-b'}
    resolve(new Response(JSON.stringify({data: ['private-school-a']}), {headers: {'Content-Type': 'application/json'}}))
    await assert.rejects(oldRequest, {name: 'AbortError'})
    assert.equal(globalThis.smokeContext.active.colegioId, 'school-b')

    globalThis.fetch = async (_url, options) => {sentHeaders = options.headers; return new Response('{}', {headers: {'Content-Type': 'application/json'}})}
    await api.get('/platform/auditoria')
    assert.equal(sentHeaders.Authorization, 'Bearer platform-token')
    assert.equal(sentHeaders['X-Tenant'], undefined)
    setToken(null)
    assert.equal(globalThis.smokeContext.clears, 1)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
    delete globalThis.smokeContext
  }
})
