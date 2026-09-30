import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/app/pages/academico/plan-estudios/components/schedule-layout.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {layoutSessions} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const session = (id, start, end) => ({id, bloque: {hora_inicio: start, hora_fin: end}})
const customSession = (id, start, end) => ({id, bloque: null, hora_inicio: start, hora_fin: end})

test('simultaneous classes have distinct columns and adjacent classes reuse full width', () => {
  const entries = [session('3', '10:00', '11:00'), session('2', '08:30', '10:00'), session('1', '08:00', '09:00')]
  const layout = layoutSessions(entries)
  assert.deepEqual(layout.map(({session, lane, lanes}) => [session.id, lane, lanes]), [['1', 0, 2], ['2', 1, 2], ['3', 0, 1]])
  assert.equal(entries[0].id, '3')
})

test('connected overlaps reuse lanes without allowing colliding intervals to share one', () => {
  const layout = layoutSessions([session('1', '08:00', '12:00'), session('2', '08:00', '09:00'), session('3', '09:00', '11:00'), session('4', '10:00', '12:00')])
  assert.deepEqual(layout.map(({lane, lanes}) => [lane, lanes]), [[0, 3], [1, 3], [1, 3], [2, 3]])
  assert.deepEqual(layoutSessions([]), [])
})

test('custom hours and predefined blocks share the same weekly layout', () => {
  const layout = layoutSessions([
    customSession('3', '09:00', '09:45'),
    session('1', '08:00', '09:00'),
    customSession('2', '08:30', '09:15'),
  ])
  assert.deepEqual(layout.map(({session, lane, lanes}) => [session.id, lane, lanes]), [['1', 0, 2], ['2', 1, 2], ['3', 0, 2]])
})
