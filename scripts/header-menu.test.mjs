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
    assert.ok(!html.includes('/ajustes-institucionales/correo'), 'Mail connection belongs in the user menu, not global navigation')
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

test('enrollment routes have distinct header icons and no duplicate page navigation', () => {
  const html = getHeaderMenuHtml(intl('es'), {isTenantUser: true, canManageIntake: true, canManageEnrollments: true})
  const icons = [['solicitudes', 'document'], ['seleccion', 'user-tick'], ['matriculas', 'address-book']]
  const font = fs.readFileSync(new URL('../src/_metronic/assets/keenicons/solid/style.css', import.meta.url), 'utf8')
  for (const [route, icon] of icons) {
    const link = html.match(new RegExp(`<a[^>]+href="/admisiones/${route}"[^>]*>(.*?)</a>`))?.[1]
    assert.ok(link?.includes(`ki-solid ki-${icon}`), `${route} uses its own icon`)
    assert.ok(font.includes(`.ki-${icon}.ki-solid:before`), `${icon} exists in bundled font`)
  }
  const page = fs.readFileSync(new URL('../src/app/pages/admisiones/AdmisionesPage.tsx', import.meta.url), 'utf8')
  assert.ok(!page.includes('<nav'), 'Navigation stays in the header, not duplicated above page content')
  assert.ok(!page.includes('NavLink'))
  for (const [route] of icons) assert.ok(page.includes(`path='${route}'`), 'Existing routes remain available')
})

test('all three enrollment views share the academic header instead of custom card styling', () => {
  for (const file of ['admisiones/AdmisionesPage.tsx', 'admisiones/EnrollmentManagement.tsx', 'academico/evaluacion/components/CatalogoView.tsx']) {
    const source = fs.readFileSync(new URL(`../src/app/pages/${file}`, import.meta.url), 'utf8')
    assert.ok(source.includes('<AcademicPageHeader'), file)
  }
  assert.equal(messages('es')['admisiones.title'], 'Gestión de Matrículas')
  assert.equal(messages('en')['admisiones.title'], 'Enrollment Management')
})
