import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/app/pages/academico/shared/useCatalogFilters.ts', import.meta.url), 'utf8')
// Test the pure decoder without mounting React. The hook itself is covered by
// browser-smoke --academic-workflow (reload and returning from a sheet).
const standalone = source.replace(/^import .*$/gm, '')
const js = ts.transpileModule(standalone, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {readCatalogFilters} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('catalog filters retain only opaque selectors and ignore raw IDs or unrelated data', () => {
  const token = 'a'.repeat(24)
  assert.deepEqual(readCatalogFilters(new URLSearchParams({ano: token, grupo: token, materia: token, nombre: 'private'})), {ano: token, grupo: token, materia: token})
  for (const invalid of ['1', '2026', 'abc', '<script>', 'a'.repeat(64)]) {
    assert.deepEqual(readCatalogFilters(new URLSearchParams({ano: invalid, grupo: invalid, materia: invalid})), {ano: '', grupo: '', materia: ''})
  }
  assert.equal(/localStorage|sessionStorage/.test(source), false)
})
