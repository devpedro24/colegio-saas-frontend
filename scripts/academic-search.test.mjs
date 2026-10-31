import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/app/pages/academico/shared/useAcademicSearchParams.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
}).outputText
const {publicAcademicSearch} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
test('remembered attendance and indicator filters contain only public selectors', () => {
  const token = 'a'.repeat(24)
  assert.equal(publicAcademicSearch(new URLSearchParams({ano: token, asignacion: token, periodo: token,
    grupo: '7', nombre: 'Private', csrf_token: token, grado: '2026'})).toString(),
    new URLSearchParams({ano: token, asignacion: token, periodo: token}).toString())
  assert.equal(publicAcademicSearch(new URLSearchParams()).toString(), '')
  assert.equal(/localStorage|sessionStorage/.test(source), false)
})
