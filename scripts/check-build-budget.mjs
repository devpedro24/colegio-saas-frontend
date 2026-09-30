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
