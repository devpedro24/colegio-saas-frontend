import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const sharedSource = fs.readFileSync(new URL('../src/lib/validation/personInput.ts', import.meta.url), 'utf8')
const sharedJs = ts.transpileModule(sharedSource, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const sharedUrl = 'data:text/javascript;base64,' + Buffer.from(sharedJs).toString('base64')
const {relationshipChoice} = await import(sharedUrl)
const source = fs.readFileSync(new URL('../src/app/pages/admisiones/enrollmentInput.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replaceAll('@/lib/validation/personInput', sharedUrl), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {cleanName, cleanIdentity, cleanText, namePattern, identityPattern, additionalType, additionalInput} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('personal names keep accents and legitimate separators while rejecting digits and markup', () => {
  const names = new RegExp(`^(?:${namePattern})$`, 'v')
  for (const name of ['María José', 'Óscar Muñoz', "O'Connor", 'D’Angelo', 'Jean-Luc', '李明', 'Jose\u0301']) assert.ok(names.test(name), name)
  for (const name of ['Ana1', '<script>alert(1)</script>', 'Ana_Pérez', '123', '--', 'Ana@Pérez']) assert.equal(names.test(name), false, name)
  assert.equal(cleanName('María1 @Pérez'), 'María Pérez')
  assert.equal(cleanName('Ana\nMaría'), 'Ana María')
})

test('national document types are numeric and foreign types preserve alphanumeric identifiers', () => {
  for (const type of ['CC', 'TI', 'RC']) {
    assert.equal(cleanIdentity('12AB-0345', type), '120345')
    assert.equal(new RegExp(`^(?:${identityPattern(type)})$`, 'v').test('AB123'), false)
    assert.ok(new RegExp(`^(?:${identityPattern(type)})$`, 'v').test('0012345'))
  }
  for (const type of ['CE', 'PASAPORTE', 'OTRO']) assert.equal(cleanIdentity('ab-123', type), 'AB-123')
  assert.equal(new RegExp(`^(?:${identityPattern('OTRO')})$`, 'v').test('---'), false)
})

test('additional labels infer personal fields without treating school names as personal names', () => {
  const kind = (nombre, tipo = 'texto') => additionalType({key: 'campo_qa', nombre, tipo, obligatorio: true})
  for (const label of ['Nombre del representante legal', 'Nombres y apellidos', 'Apellidos de la madre']) assert.equal(kind(label), 'nombre')
  assert.equal(kind('Nombre del colegio de procedencia'), 'texto')
  assert.equal(kind('Celular del padre'), 'telefono')
  assert.equal(kind('Correo del representante'), 'email')
  assert.equal(kind('Cédula del acudiente'), 'identificacion_numerica')
  assert.equal(kind('Cédula de extranjería'), 'identificacion')
  assert.equal(kind('Nombre del representante', 'numero'), 'numero')
  assert.equal(additionalInput({key: 'fecha', nombre: 'Fecha', tipo: 'fecha'}).type, 'date')
  assert.equal(cleanText("Calle 7 # 2-3, O'Connor"), "Calle 7 # 2-3, O'Connor")
  assert.equal(cleanText('Texto\u0000<>'), 'Texto')
})

 test('relationships preserve saved values and keep letters only in custom descriptions', () => {
  for (const value of ['Madre', 'Mamá', 'Mama']) assert.equal(relationshipChoice(value), 'Madre')
  for (const value of ['Padre', 'Papá', 'Papa']) assert.equal(relationshipChoice(value), 'Padre')
  for (const value of ['Abuela', 'Tutor legal', 'Otro']) assert.equal(relationshipChoice(value), 'Otro')
  assert.equal(relationshipChoice(''), '')
  assert.equal(additionalType({key: 'parentesco', nombre: 'Parentesco del representante', tipo: 'texto'}), 'parentesco')
  assert.equal(cleanName('Tía123 @materna'), 'Tía materna')
})
