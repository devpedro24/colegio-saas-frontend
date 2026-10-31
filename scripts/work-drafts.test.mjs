import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import {createRequire} from 'node:module'

const module = {exports: {}}
new Function('exports', ts.transpileModule(fs.readFileSync(new URL('../src/lib/drafts/crypto.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText)(module.exports)
const {newDraftToken, encryptDraft, decryptDraft, importDraftKey, safeDraftPath, DRAFT_TTL} = module.exports

test('draft encryption round-trips HTML and grades without plaintext and binds owner + record', async () => {
  const key = await importDraftKey(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'))
  const value = {html: '<p>Nombre privado <strong>indicador</strong></p>', grades: [{value: '4.0', version: 7}]}
  const token = newDraftToken()
  assert.match(token, /^[a-zA-Z0-9_-]{24}$/)
  const encrypted = await encryptDraft(key, 'teacher-school', token, value)
  assert(!JSON.stringify(encrypted).includes('Nombre privado'))
  assert.deepEqual(await decryptDraft(key, 'teacher-school', token, encrypted), value)
  await assert.rejects(() => decryptDraft(key, 'other-owner', token, encrypted))
  await assert.rejects(() => decryptDraft(key, 'teacher-school', newDraftToken(), encrypted))
  const second = await encryptDraft(key, 'teacher-school', token, value)
  assert.notEqual(second.iv, encrypted.iv)
  const otherKey = await importDraftKey(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'))
  await assert.rejects(() => decryptDraft(otherKey, 'teacher-school', token, encrypted))
  assert.equal(DRAFT_TTL, 86400000)
})

test('resume only uses internal routes and explicit permitted filter parameters', () => {
  assert.equal(safeDraftPath('/academico/asistencia?grupo=abc&periodo=def&password=secret'), '/academico/asistencia?grupo=abc&periodo=def')
  for (const path of ['//evil.test', '/\\evil.test', 'https://evil.test', 'javascript:alert(1)', '/auth', '/logout', '/account/password?token=secret', '/auth/../logout']) assert.equal(safeDraftPath(path), null)
})

test('login resumes the last private route, preferring an explicit authorized destination', () => {
  const require = createRequire(import.meta.url)
  let location = {pathname: '/auth/login', search: '', state: null}
  const store = {ready: true, entries: new Map([['a', {context: '$route', editedAt: 1, path: '/evaluacion/catalogo'}],
    ['b', {context: '$route', editedAt: 2, path: '/evaluacion/aula/opaque?editar=resource'}]])}
  const compiled = ts.transpileModule(fs.readFileSync(new URL('../src/app/routing/EventLoginRedirect.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022},
  }).outputText
  const loaded = {exports: {}}
  const imports = {'react-router-dom': {Navigate: () => null, useLocation: () => location},
    '@/lib/drafts/WorkDrafts': {useDraftStore: () => store}, '@/lib/drafts/crypto': module.exports}
  new Function('exports', 'require', compiled)(loaded.exports, id => imports[id] ?? require(id))
  const render = authenticated => loaded.exports.EventLoginRedirect({authenticated})
  assert.equal(render(true).props.to, '/evaluacion/aula/opaque?editar=resource')
  location.state = {returnTo: '/academico/asistencia?grupo=g&periodo=p'}
  assert.equal(render(true).props.to, location.state.returnTo)
  location.state = {returnTo: 'https://untrusted.test'}
  assert.equal(render(true).props.to, '/evaluacion/aula/opaque?editar=resource')
  store.ready = false; assert.equal(render(true), null)
  location = {pathname: '/academico/indicadores', search: '?grupo=g&periodo=p&secret=private', state: null}
  assert.deepEqual(render(false).props.state, {returnTo: '/academico/indicadores?grupo=g&periodo=p'})
})
