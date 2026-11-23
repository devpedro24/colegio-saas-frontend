import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/lib/validation/institutionInput.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {institutionNamePattern, nitPattern, cleanInstitutionName, cleanInstitutionField, cleanInstitutionText, cleanSedeSlug} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('institution names allow numbers and ordinary punctuation, while rejecting markup and symbol-only values', () => {
  const pattern = new RegExp(`^(?:${institutionNamePattern})$`, 'v')
  for (const name of ['Colegio 7 de Agosto', 'Sede San José (2)', 'Instituto "José Martí"', "Sede O'Connor", 'Colegio I & II']) assert.ok(pattern.test(name), name)
  for (const name of ['123', '---', '<script>', 'Colegio@', 'Sede\nNorte']) assert.equal(pattern.test(name), false, name)
  assert.equal(cleanInstitutionName('Colegio 7 @de Agosto'), 'Colegio 7 de Agosto')
})

test('institutional identifiers keep leading zeros and reject malformed separators', () => {
  const pattern = new RegExp(`^(?:${nitPattern})$`, 'v')
  for (const value of ['900123456-7', '900.123.456-7', '0012345']) assert.ok(pattern.test(value), value)
  for (const value of ['ABC123', '900--7', '900-77', '900..123', '-123', '123-']) assert.equal(pattern.test(value), false, value)
  assert.equal(cleanInstitutionField('nit', 'ABC900.123.456-7'), '900.123.456-7')
  assert.equal(cleanSedeSlug('SN01._Norte'), 'sn01norte')
  assert.equal(cleanSedeSlug('s'.repeat(80)).length, 63)
  assert.equal(cleanInstitutionText('Carrera 7 # 12-34'), 'Carrera 7 # 12-34')
  assert.equal(cleanInstitutionText('Calle\u0000<>'), 'Calle')
})
