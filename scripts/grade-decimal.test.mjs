import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../src/app/pages/academico/evaluacion/gradeDecimal.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {gradeDecimal, validGrade} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
test('grade decimals normalize comma and padding without rounding or coercing missing grades into zero', () => {
  assert.equal(gradeDecimal('4,50000000'), '4.5')
  assert.equal(gradeDecimal('0.10000001'), '0.10000001')
  assert.equal(gradeDecimal(null), '')
  assert.equal(gradeDecimal('0.00000000'), '0')
  assert.equal(gradeDecimal('5.000'), '5')
})
test('grades reject malformed numbers and scale/range errors while allowing explicit empty cells', () => {
  for (const value of ['4.5', '0', '5', '', '0.12345678']) assert.equal(validGrade(value, '0', '5'), true, value)
  for (const value of ['5.01', '-1', '1e0', '1.2.3', '0.123456789', 'abc']) assert.equal(validGrade(value, '0', '5'), false, value)
})
