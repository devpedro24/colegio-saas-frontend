import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const text = fs.readFileSync(new URL('../src/_metronic/layout/components/header/_HeaderMenuContent.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(text, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {getHeaderMenuHtml, renderHeaderDropdown} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const messages = lang => JSON.parse(fs.readFileSync(new URL(`../src/_metronic/i18n/messages/${lang}.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''))
const intl = lang => ({formatMessage: ({id}) => {const value = messages(lang)[id]; assert.ok(value, `Missing ${lang}: ${id}`); return value}})

for (const lang of ['es', 'en']) {
  test(`school navigation uses one dropdown structure and valid ${lang} keys`, () => {
    const html = getHeaderMenuHtml(intl(lang), {isTenantUser: true, canManageUsers: true, canViewPreinformes: true, canManageEnrollments: true})
    const dictionary = messages(lang)
    const communication = renderHeaderDropdown(dictionary['comunicacion.title'], [{label: dictionary['events.calendar'], path: '/comunicacion/eventos', icon: 'calendar-8'}])
    assert.ok(html.includes(communication))
    assert.ok(html.includes('href="/academico/siee" data-kt-nav="/academico/siee"'))
    assert.ok(html.includes('href="/evaluacion/catalogo" data-kt-nav="/evaluacion/catalogo"'))
    assert.ok(html.includes('href="/admisiones/matriculas" data-kt-nav="/admisiones/matriculas"'))
    assert.ok(!getHeaderMenuHtml(intl(lang), {isTenantUser: true}).includes('href="/admisiones/matriculas"'))
    assert.ok(html.includes('href="/academico/preinformes" data-kt-nav="/academico/preinformes"'))
    assert.ok(html.includes('ki-solid ki-calendar-8'))
    assert.ok(!html.slice(0, html.indexOf(dictionary['header.menu.apps'])).includes('class="menu-bullet"'))
    assert.ok(html.includes('data-kt-nav="/academico/siee"'))
    assert.ok(html.includes('data-kt-nav="/academico/boletines"'))
    assert.ok(!html.includes('data-kt-nav="/configuracion/auditoria"'))
  })
  test(`platform navigation exposes audit but no school modules in ${lang}`, () => {
    const html = getHeaderMenuHtml(intl(lang), {isPlatform: true})
    assert.ok(html.includes('data-kt-nav="/configuracion/auditoria"'))
    assert.ok(html.includes('href="/configuracion/roles-permisos"'))
    assert.ok(!html.includes('data-kt-nav="/comunicacion/eventos"'))
  })
}
test('dropdown escapes translated labels and route attributes', () => {
  const html = renderHeaderDropdown('<script>', [{label: 'A & B', path: '" onclick="bad'}])
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('A &amp; B'))
  assert.ok(!html.includes(' onclick="bad'))
})
