import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

const context = vm.createContext({})
vm.runInContext(readFileSync(new URL('../public/bulletin-editor/canvas-zoom.js', import.meta.url), 'utf8'), context)
const {fromWheel, attach} = context.ReportCanvasZoom

test('wheel zoom supports mice and trackpads, reverses direction and stays within the editor range', () => {
  assert.ok(fromWheel(.8, -120) > .8)
  assert.ok(fromWheel(.8, 120) < .8)
  assert.equal(fromWheel(.2, 120), .2)
  assert.equal(fromWheel(1.8, -120), 1.8)
  assert.ok(Math.abs(fromWheel(fromWheel(.8, -50), 50) - .8) < 1e-12)
  assert.equal(fromWheel(.8, 3, 1), fromWheel(.8, 48, 0))
  assert.equal(fromWheel(.8, Infinity), .8)
})

test('Ctrl wheel cancels browser zoom only in an active editor, while normal scrolling remains native', () => {
  let listener, enabled = true, zoom = .8, prevented = 0, changes = 0
  const keyboardTarget = {addEventListener() {}, removeEventListener() {}}
  const element = {
    ownerDocument: keyboardTarget,
    addEventListener(type, callback, options) {
      assert.equal(type, 'wheel')
      assert.equal(options.passive, false)
      listener = callback
    },
    removeEventListener(type, callback) {
      assert.equal(type, 'wheel')
      assert.equal(callback, listener)
    },
  }
  const detach = attach(element, {enabled: () => enabled, zoom: () => zoom, change(value) {zoom = value; changes++}})
  const event = ctrlKey => ({ctrlKey, deltaY: -120, deltaMode: 0, preventDefault() {prevented++}})
  listener(event(false))
  assert.equal(prevented, 0)
  assert.equal(changes, 0)
  listener(event(true))
  assert.equal(prevented, 1)
  assert.ok(zoom > .8)
  enabled = false
  listener(event(true))
  assert.equal(prevented, 1)
  zoom = 1.8; enabled = true
  listener(event(true))
  assert.equal(prevented, 2, 'at the limit it must still prevent browser zoom')
  assert.equal(changes, 1)
  detach()
})

test('Ctrl plus/minus handles both keyboard layouts and keypad keys, even with focus outside the canvas', () => {
  let keydown, enabled = true, zoom = .8, prevented = 0
  const document = {addEventListener(type, fn) {assert.equal(type, 'keydown'); keydown = fn}, removeEventListener() {}}
  const element = {ownerDocument: document, addEventListener() {}, removeEventListener() {}}
  attach(element, {enabled: () => enabled, zoom: () => zoom, change: value => {zoom = value}})
  const press = (key, code, ctrlKey = true) => keydown({key, code, ctrlKey, preventDefault() {prevented++}})
  press('+'); assert.equal(zoom, .9)
  press('='); assert.equal(zoom, 1)
  press('-'); assert.equal(zoom, .9)
  press('Add', 'NumpadAdd'); assert.equal(zoom, 1)
  press('Subtract', 'NumpadSubtract'); assert.equal(zoom, .9)
  press('+', '', false); assert.equal(zoom, .9)
  press('s'); assert.equal(prevented, 5)
  enabled = false; press('+'); assert.equal(zoom, .9)
  assert.equal(prevented, 5)
})
