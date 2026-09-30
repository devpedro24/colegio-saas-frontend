import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const helper = fs.readFileSync(new URL('../src/app/modules/accounts/accountPresentation.ts', import.meta.url), 'utf8')
const source = helper + '\n' + fs.readFileSync(new URL('../src/_metronic/layout/components/header/_NavbarContent.ts', import.meta.url), 'utf8').replace(/^import \{escapeUserHtml, userInitials\}.*$/m, '')
const js = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
}).outputText
const {getNavbarHtml} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

for (const lang of ['es', 'en']) {
  const messages = JSON.parse(fs.readFileSync(new URL(`../src/_metronic/i18n/messages/${lang}.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''))
  const intl = {formatMessage: ({id}) => {
    assert.ok(messages[id], `Missing ${lang}: ${id}`)
    return messages[id]
  }}

  test(`institutional flyout exposes only authorized destinations in ${lang}`, () => {
    const withoutAccess = getNavbarHtml(intl, {showQuickIcons: false})
    assert.ok(!withoutAccess.includes('data-testid="institutional-settings-trigger"'))

    const dataOnly = getNavbarHtml(intl, {showQuickIcons: false, canConfigureInstitution: true})
    assert.ok(dataOnly.includes('data-testid="institutional-settings-panel"'))
    assert.ok(dataOnly.includes('data-kt-nav="/ajustes-institucionales/datos"'))
    assert.ok(!dataOnly.includes('data-kt-nav="/ajustes-institucionales/sedes"'))

    const campusesOnly = getNavbarHtml(intl, {showQuickIcons: false, canManageCampuses: true})
    assert.ok(!campusesOnly.includes('data-kt-nav="/ajustes-institucionales/datos"'))
    assert.ok(campusesOnly.includes('data-kt-nav="/ajustes-institucionales/sedes"'))

    const fullAccess = getNavbarHtml(intl, {showQuickIcons: false, canConfigureInstitution: true, canManageCampuses: true})
    assert.ok(fullAccess.includes(`>${messages['header.user.institutionalSettings']}<`))
    assert.ok(fullAccess.includes('data-kt-menu-placement="{default: \'bottom-end\', lg: \'left-start\'}"'))
  })
}


test('account identity is escaped and future menu sections remain available', () => {
 const intl = {formatMessage: ({id}) => id}
 const html = getNavbarHtml(intl, {showQuickIcons: false, userName: '<img src=x onerror=alert(1)>', userEmail: 'real@example.test', planLabel: '<Premium>'})
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'))
 assert.ok(html.includes('&lt;Premium&gt;'))
 assert.ok(!html.includes('<img src=x'))
 assert.ok(!html.includes('Max Smith') && !html.includes('max@kt.com'))
 for (const id of ['header.menu.myProjects', 'header.user.mySubscription', 'header.user.myStatements', 'header.user.referrals', 'header.user.billing', 'header.user.payments', 'header.user.statements']) {
   assert.ok(html.includes(id), `${id} must remain in the user menu`)
 }
 assert.ok(!html.includes('badge-circle fw-bold fs-7">3'), 'No invented project count')
 assert.ok(html.includes('data-kt-nav="/account/settings"'))
})
