// Compressed transfer budgets, not a substitute for browser LCP/INP measurements.
import fs from 'node:fs'
import path from 'node:path'
import {gzipSync} from 'node:zlib'
import assert from 'node:assert/strict'

const assets = new URL('../dist/assets/', import.meta.url)
const files = fs.readdirSync(assets)
for (const [extension, maxBytes] of [['js', 550_000], ['css', 230_000]]) {
  const names = files.filter(name => name.startsWith('index-') && path.extname(name) === `.${extension}`)
  assert.equal(names.length, 1, `Expected one entry ${extension}; run a clean Vite build.`)
  const bytes = gzipSync(fs.readFileSync(new URL(names[0], assets))).length
  console.log(`Entry ${extension}: ${bytes} gzip bytes / budget ${maxBytes}`)
  assert.ok(bytes <= maxBytes, `Entry ${extension} transfer budget exceeded. Review imports, do not raise it without measurements.`)
}

// Public assets bypass the entry bundle; include the editor's complete offline catalog.
const editor = new URL('../dist/bulletin-editor/', import.meta.url)
function directoryBytes(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).reduce((total, item) => {
    const file = new URL(item.name + (item.isDirectory() ? '/' : ''), directory)
    return total + (item.isDirectory() ? directoryBytes(file) : fs.statSync(file).size)
  }, 0)
}
const editorBytes = directoryBytes(editor)
console.log(`Bulletin editor: ${editorBytes} bytes / budget 10000000`)
assert.ok(editorBytes <= 10_000_000, 'Bulletin editor static assets exceeded their budget. Review fonts and unused copies.')
