import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {verifyEngine} from './sync-bulletin-engine.mjs'

const root = fileURLToPath(new URL('../public/bulletin-editor/', import.meta.url))
test('browser engine is an intact versioned distribution of the canonical engine', () => {
  const browser = verifyEngine(root)
  const canonical = fileURLToPath(new URL('../../colegio-saas-backend/resources/bulletin-editor/', import.meta.url))
  if (fs.existsSync(canonical)) assert.deepEqual(browser, verifyEngine(canonical))
})

test('distribution verification rejects an accidentally changed engine', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bulletin-engine-'))
  try {
    const manifest = verifyEngine(root)
    for (const name of ['engine-manifest.json', ...Object.keys(manifest.files)]) fs.copyFileSync(path.join(root, name), path.join(temporary, name))
    fs.appendFileSync(path.join(temporary, 'report-engine.js'), '\n// unexpected change\n')
    assert.throws(() => verifyEngine(temporary), /changed without a release: report-engine.js/)
  } finally {fs.rmSync(temporary, {recursive: true, force: true})}
})

test('all catalog web fonts are verified WOFF2 with preserved licenses', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets/fonts/catalog/manifest.json'), 'utf8'))
  assert.equal(catalog.length, 32)
  for (const item of catalog) {
    assert.match(item.file, /^assets\/fonts\/catalog\/[a-z0-9]+\/font\.woff2$/)
    const file = path.join(root, item.file), bytes = fs.readFileSync(file)
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', item.family)
    assert.equal(bytes.length, item.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256)
    assert.match(item.source_sha256, /^[a-f0-9]{64}$/)
    assert.ok(fs.existsSync(path.join(path.dirname(file), 'OFL.txt')))
    assert.ok(!fs.existsSync(file.replace('.woff2', '.ttf')))
  }
  assert.equal(fs.readFileSync(path.join(root, 'assets/fonts/inter-latin.woff2')).subarray(0, 4).toString(), 'wOF2')
})
