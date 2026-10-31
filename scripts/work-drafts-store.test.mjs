import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function compile(name, imports = {}) {
  const module = {exports: {}}
  const code = ts.transpileModule(fs.readFileSync(new URL(`../src/lib/drafts/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText
  new Function('exports', 'require', code)(module.exports, id => {
    if (!(id in imports)) throw new Error(`Missing test import ${id}`)
    return imports[id]
  })
  return module.exports
}
const cryptoModule = compile('crypto')
class ApiError extends Error {constructor(status) {super(String(status)); this.status = status}}
const copy = value => structuredClone(value)
const content = value => ({schema: 1, context: 'grades:assignment:period', title: 'Planilla', path: '/evaluacion/planillas/a/b', base: '1', value})
function harness() {
  const local = new Map(), remote = new Map(), calls = []
  const scope = cryptoModule.newDraftToken()
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
  let nextPut, loseAck = false
  const api = {
    get: async () => ({scope, key, drafts: [...remote.values()].map(copy), server_time: new Date().toISOString()}),
    put: async (url, input) => {
      calls.push(copy(input))
      if (nextPut) {const delay = nextPut; nextPut = null; await delay}
      const token = url.split('/').at(-1), old = remote.get(token)
      if (old?.discarded) throw new ApiError(410)
      if ((old?.version ?? 0) !== input.version) {
        if (old.iv === input.iv && old.ciphertext === input.ciphertext) return copy(old)
        throw new ApiError(409)
      }
      const row = {...input, token, version: input.version + 1, discarded: false,
        expires_at: new Date(Date.parse(input.edited_at) + cryptoModule.DRAFT_TTL).toISOString()}
      remote.set(token, row)
      if (loseAck) {loseAck = false; throw new Error('Connection lost after commit')}
      return copy(row)
    },
    post: async (url, input) => {
      const token = url.split('/').at(-2), old = remote.get(token)
      if ((old?.version ?? 0) !== input.version && !old?.discarded) throw new ApiError(409)
      const row = {...old, token, version: input.version + 1, iv: '', ciphertext: '', discarded: true,
        edited_at: new Date().toISOString(), expires_at: new Date(Date.now() + cryptoModule.DRAFT_TTL).toISOString()}
      remote.set(token, row); return copy(row)
    },
  }
  const db = {listLocalDrafts: async currentScope => [...local.values()].filter(row => row.scope === currentScope).map(copy),
    putLocalDraft: async row => {local.set(row.token, copy(row))}, pruneLocalFiles: async () => [],
    getLocalFile: async () => undefined, putLocalFile: async () => {}}
  const {DraftStore} = compile('store', {'@/lib/api/client': {api, ApiError}, './crypto': cryptoModule, './database': db})
  return {store: () => new DraftStore('/work-drafts'), local, remote, calls, scope, key,
    delay: promise => {nextPut = promise}, loseAck: () => {loseAck = true}}
}
const tick = () => new Promise(resolve => setImmediate(resolve))
async function until(condition) {for (let i = 0; i < 200 && !condition(); i++) await tick(); assert(condition())}

test('typing while a backup is in flight preserves the newest content and revision', async () => {
  const h = harness(), store = h.store(); await store.start()
  try {
    const token = cryptoModule.newDraftToken()
    let release; h.delay(new Promise(resolve => {release = resolve}))
    store.write(token, content('first'))
    const flush = store.flush(); await until(() => h.calls.length === 1)
    store.write(token, content('latest'))
    release(); await flush; await store.flush()
    const saved = h.remote.get(token)
    assert.equal(saved.version, 2)
    assert.equal((await cryptoModule.decryptDraft(store.key, h.scope, token, saved)).value, 'latest')
    assert.equal(store.entries.get(token).status, 'synced')
    await store.discard(token); await until(() => h.remote.get(token)?.discarded)
    assert(!store.entries.has(token))
    assert(h.local.get(token).discarded)
  } finally {store.stop()}
})

test('retries after a lost acknowledgement are idempotent and do not renew expiry', async () => {
  const h = harness(), store = h.store(); await store.start()
  try {
    const token = cryptoModule.newDraftToken(), edited = Date.now() - 3600000
    h.loseAck(); store.write(token, content('pending'), edited); await store.flush()
    assert(h.local.get(token).pending)
    await store.flush()
    assert.equal(h.remote.get(token).version, 1)
    assert.equal(Date.parse(h.remote.get(token).expires_at), edited + cryptoModule.DRAFT_TTL)
    assert.equal(store.entries.get(token).status, 'synced')
  } finally {store.stop()}
})

test('reload preserves different offline work as a branch, with no overwriting or TTL renewal', async () => {
  const h = harness(), store = h.store(); await store.start()
  const token = cryptoModule.newDraftToken(), edited = Date.now() - 7200000
  store.write(token, content('server'), edited); await store.flush()
  const rawKey = store.key
  store.stop()
  const old = h.local.get(token)
  h.local.set(token, {...old, version: 0, pending: true,
    ...await cryptoModule.encryptDraft(rawKey, h.scope, token, content('offline changes'))})
  const restored = h.store(); await restored.start()
  try {
    assert.equal(restored.entries.size, 2)
    const branch = [...restored.entries.values()].find(row => row.value === 'offline changes')
    assert(branch && branch.token !== token)
    assert.equal(branch.editedAt, edited)
    await restored.flush()
    assert.equal(h.remote.size, 2)
    assert.equal((await cryptoModule.decryptDraft(rawKey, h.scope, token, h.remote.get(token))).value, 'server')
  } finally {restored.stop()}
})

test('discarded server copies cannot be resurrected by offline local edits', async () => {
  const h = harness(), store = h.store(); await store.start()
  const token = cryptoModule.newDraftToken()
  store.write(token, content('old')); await store.flush()
  const old = copy(h.local.get(token))
  await store.discard(token); await until(() => h.remote.get(token)?.discarded)
  store.stop(); h.local.set(token, {...old, pending: true})
  const restored = h.store(); await restored.start()
  try {assert.equal(restored.entries.size, 0); assert(h.local.get(token).discarded)} finally {restored.stop()}
})
