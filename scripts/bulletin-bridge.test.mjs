import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {randomUUID} from 'node:crypto'

async function bridge({deleteError} = {}) {
  const listeners = new Map(), calls = [], timers = new Map(), events = []
  const origin = 'http://school.localhost', token = 'a'.repeat(24)
  let nextTimer = 0, items
  const parent = {postMessage(message) {
    if (!message.id) return
    calls.push(message)
    const payload = message.action === 'catalog' ? {items, institution: {name: 'Test school'}, lang: 'es', canEdit: true, nextPage: 2, lastPage: 1}
      : message.action === 'save' ? {token, version: 8, ...message.payload.input} : {eliminada: true}
    queueMicrotask(() => {
      for (const listener of listeners.get('message') || []) listener({origin, source: parent,
        data: {channel: message.channel, id: message.id, payload, error: message.action === 'delete' ? deleteError : undefined}})
    })
  }}
  const context = vm.createContext({parent, URL, structuredClone, crypto: {randomUUID}, Event,
    setTimeout: fn => {const id = ++nextTimer; timers.set(id, fn); return id}, clearTimeout: id => timers.delete(id),
    MutationObserver: class {observe() {}},
    document: {baseURI: origin + '/bulletin-editor/', documentElement: {}, body: {}, querySelectorAll: () => []},
    addEventListener: (type, listener) => listeners.set(type, [...(listeners.get(type) || []), listener]),
    dispatchEvent: event => events.push(event),
  })
  context.window = context
  for (const name of ['font-catalog', 'model', 'proposal-model', 'layout-model', 'field-guide']) {
    vm.runInContext(fs.readFileSync(new URL(`../public/bulletin-editor/${name}.js`, import.meta.url), 'utf8'), context)
  }
  const doc = context.ReportPrototypeModel.documentDesign('blank')
  items = [{token, nombre: 'Temporary test', ambito: 'periodo', version: 7, configuracion: {canvas: doc}}]
  vm.runInContext(fs.readFileSync(new URL('../public/bulletin-editor/saas-bridge.js', import.meta.url), 'utf8'), context)
  const api = context.SchoolBulletinEditor
  await api.catalog()
  return {api, doc, token, calls, timers, events, emit: action => {
    for (const listener of listeners.get('message') || []) listener({origin, source: parent,
      data: {channel: 'school-bulletin-editor-v1', action}})
  }}
}

test('deleting a saved template sends its opaque selector and current version, then removes the local record', async () => {
  const {api, token, calls} = await bridge()
  await api.remove(token)
  const deletion = calls.find(call => call.action === 'delete')
  assert.equal(deletion.payload.token, token)
  assert.equal(deletion.payload.version, 7)
  assert.equal((await api.catalog()).length, 0)
  await assert.rejects(api.remove(token), /ya no está disponible/)
  assert.equal(calls.filter(call => call.action === 'delete').length, 1)
})

test('saving restores the preview valuation without persisting sample pupils or results', async () => {
  for (const scale of ['numeric', 'visual']) {
    const {api, doc, calls} = await bridge()
    doc.sampleScale = scale
    doc.sample = {student: 'sample pupil', count: 25}
    const saved = await api.save(doc, false)
    const canvas = calls.find(call => call.action === 'save').payload.input.configuracion.canvas
    assert.equal(canvas.design.previewScale, scale)
    assert.equal(canvas.sample, undefined)
    assert.equal(canvas.sampleScale, undefined)
    assert.equal(saved.doc.sampleScale, scale)
  }
})

test('older saved templates always have a valid numeric preview default', async () => {
  const {api, doc} = await bridge()
  delete doc.sampleScale
  assert.equal(api.decorate(doc).sampleScale, 'numeric')
})

test('a rejected deletion leaves the template available for review and retry', async () => {
  const {api, token} = await bridge({deleteError: 'Version conflict'})
  await assert.rejects(api.remove(token), /Version conflict/)
  assert.equal((await api.catalog()).length, 1)
})

test('discarding a work draft cancels the queued edit before returning to the gallery', async () => {
  const {api, doc, timers, events, emit} = await bridge()
  api.changed(doc, true)
  assert.equal(timers.size, 1)
  emit('discard')
  assert.equal(timers.size, 0)
  assert.equal(events.at(-1).type, 'school-editor:discard')
})

test('reviewing the current work draft opens its visual preview without a mutation request', async () => {
  const {calls, events, emit} = await bridge()
  const requests = calls.length
  emit('preview')
  assert.equal(events.at(-1).type, 'school-editor:preview')
  assert.equal(calls.length, requests)
})
