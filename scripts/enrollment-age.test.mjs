import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/app/pages/admisiones/enrollmentAge.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {schoolDate, ageOnDate, isOutsideAgeRange} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('school calendar controls birthdays across UTC midnight and year boundaries', () => {
  const instant = new Date('2027-01-01T02:00:00Z')
  assert.equal(schoolDate('America/Bogota', instant), '2026-12-31')
  assert.equal(schoolDate('Pacific/Kiritimati', instant), '2027-01-01')
  assert.equal(ageOnDate('2020-01-01', schoolDate('America/Bogota', instant)), 6)
  assert.equal(ageOnDate('2020-01-01', schoolDate('Pacific/Kiritimati', instant)), 7)
  assert.equal(ageOnDate('2020-01-01', schoolDate('America/Bogota', new Date('2027-01-01T05:00:00Z'))), 7)
})

test('calendar age handles leap birthdays, invalid dates and future births', () => {
  assert.equal(ageOnDate('2020-02-29', '2027-02-28'), 6)
  assert.equal(ageOnDate('2020-02-29', '2027-03-01'), 7)
  assert.equal(ageOnDate('2020-02-29', '2028-02-29'), 8)
  for (const birth of [undefined, '', '2020-02-30', '2019-02-29', 'bad', '2028-01-01']) assert.equal(ageOnDate(birth, '2027-01-01'), null)
})

test('institutional ranges include both limits, while disabled ranges do not block', () => {
  const range = {edad_min: 6, edad_max: 8}
  assert.equal(isOutsideAgeRange('2020-10-14', 'grade', '2026-10-14', range), false)
  assert.equal(isOutsideAgeRange('2018-10-14', 'grade', '2026-10-14', range), false)
  assert.equal(isOutsideAgeRange('2018-10-14', 'grade', '2027-10-14', range), true)
  assert.equal(isOutsideAgeRange('2020-10-15', 'grade', '2026-10-14', range), true)
  assert.equal(isOutsideAgeRange('2020-10-15', 'grade', '2026-10-14', {edad_min: null, edad_max: null}), false)
  assert.equal(isOutsideAgeRange('2020-10-15', 'grade', '2026-10-14', undefined), false)
  assert.equal(isOutsideAgeRange('1906-10-14', 'grade', '2026-10-14', {edad_min: 1, edad_max: 120}), false)
  assert.equal(isOutsideAgeRange('2025-10-14', 'grade', '2026-10-14', {edad_min: 1, edad_max: 1}), false)
})

test('a server snapshot survives birthdays and rule changes only for the same birth and grade', () => {
  const snapshot = {nacimiento: '2018-10-14', grado_token: 'first', edad: 8, fecha: '2026-10-14', edad_min: 6, edad_max: 8}
  const range = {edad_min: 6, edad_max: 8}
  assert.equal(isOutsideAgeRange(snapshot.nacimiento, 'first', '2027-10-14', range, snapshot), false)
  assert.equal(isOutsideAgeRange(snapshot.nacimiento, 'first', '2027-10-14', {edad_min: 5, edad_max: 5}, snapshot), false)
  assert.equal(isOutsideAgeRange(snapshot.nacimiento, 'second', '2027-10-14', range, snapshot), true)
  assert.equal(isOutsideAgeRange('2017-10-14', 'first', '2027-10-14', range, snapshot), true)
})
