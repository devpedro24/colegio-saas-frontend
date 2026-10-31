import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/app/pages/config/rbac/rbac.labels.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {rbacActionLabel, rbacModuleLabel} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

for (const language of ['es', 'en']) {
  const messages = JSON.parse(fs.readFileSync(new URL(`../src/_metronic/i18n/messages/${language}.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''))
  const intl = {formatMessage: ({id}) => {
    assert.ok(messages[id], `Missing ${language}: ${id}`)
    return messages[id]
  }}
  test(`RBAC legacy labels are readable in ${language} without changing permission keys`, () => {
    assert.equal(rbacModuleLabel(intl, 'academico'), messages['rbac.module.academic'])
    assert.equal(rbacModuleLabel(intl, 'Académico'), messages['rbac.module.academic'])
    assert.equal(rbacActionLabel(intl, 'academico.anos.gestionar', 'anos.gestionar'), messages['rbac.action.academico.anos.gestionar'])
    assert.equal(rbacActionLabel(intl, 'academico.anos.gestionar', 'Gestionar años lectivos'), messages['rbac.action.academico.anos.gestionar'])
    assert.equal(rbacActionLabel(intl, 'eventos.publicar_asignados', 'eventos.publicar_asignados'), messages['rbac.action.eventos.publicar_asignados'])
  })
  test(`RBAC preserves superadmin custom labels in ${language}`, () => {
    assert.equal(rbacModuleLabel(intl, 'Módulo propio'), 'Módulo propio')
    assert.equal(rbacActionLabel(intl, 'academico.anos.gestionar', 'Autorizar calendario propio'), 'Autorizar calendario propio')
    assert.equal(rbacActionLabel(intl, 'colegio.propia', 'Acción propia'), 'Acción propia')
  })
}
