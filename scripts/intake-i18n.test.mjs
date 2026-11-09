import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import {createIntl} from 'react-intl'
import {parse} from '@formatjs/icu-messageformat-parser'

const read = file => fs.readFileSync(new URL('../'+file, import.meta.url), 'utf8').replace(/^\uFEFF/, '')
const catalogs = Object.fromEntries(['es','en'].map(lang=>[lang,JSON.parse(read(`src/_metronic/i18n/messages/${lang}.json`))]))
const components = ['admisiones/CampaignEditor.tsx','admisiones/EnrollmentManagement.tsx','admisiones/PublicEnrollmentPage.tsx','admisiones/StudentEnrollmentStatus.tsx','admisiones/AdmisionesPage.tsx','academico/configuracion/components/SchoolMailCard.tsx','config/correo/SchoolMailRequestsPage.tsx'].map(file=>'src/app/pages/'+file)
components.push('src/_metronic/layout/components/header/SchoolMailRequestsNotification.tsx')
components.push('src/app/pages/admisiones/EnrollmentSettingsCard.tsx')
components.push('src/app/pages/admisiones/EnrollmentApplication.tsx', 'src/app/pages/admisiones/IntakeUI.tsx', 'src/app/pages/admisiones/LegacyEnrollmentPage.tsx')

test('application PIN uses a masked code field instead of triggering saved password autofill', () => {
  const source = ts.createSourceFile('PublicEnrollmentPage.tsx', read('src/app/pages/admisiones/PublicEnrollmentPage.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let attributes
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'input') {
      const literals = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute)
        .filter(attribute => attribute.initializer && ts.isStringLiteral(attribute.initializer))
        .map(attribute => [attribute.name.getText(source), attribute.initializer.text]))
      if (literals.id === 'access-pin') attributes = literals
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.equal(attributes?.type, 'text')
  assert.equal(attributes?.autoComplete, 'one-time-code')
  assert.equal(attributes?.inputMode, 'numeric')
  assert.match(source.text, /id='access-pin'[\s\S]*?maxLength=\{8\}/)
})

test('Spanish and English catalogs are free of encoding corruption', () => {
  for(const [locale,messages] of Object.entries(catalogs)) for(const [id,value] of Object.entries(messages)) {
    assert.doesNotMatch(value,/Ã|Â|â€|�/,`${locale}: ${id}`)
  }
  assert.equal(catalogs.en['comunicacion.title'], 'Communication')
  assert.equal(catalogs.en['account.field.password'], 'Password')
})

test('new intake and mail messages have both translations and valid ICU syntax', () => {
  const keys=new Set(Object.values(catalogs).flatMap(c=>Object.keys(c).filter(k=>/^(intake|schoolMail)\./.test(k))))
  assert.ok(keys.size > 280)
  for(const key of keys) for(const locale of ['es','en']) {
    assert.ok(catalogs[locale][key], `${locale}: ${key}`)
    assert.doesNotThrow(()=>parse(catalogs[locale][key]), `${locale}: ${key}`)
  }
  for(const locale of ['es','en']) {
    const intl=createIntl({locale,messages:catalogs[locale],onError:error=>{throw error}})
    for(const count of [0,1,2]) assert.ok(intl.formatMessage({id:'schoolMail.pendingCount'},{count}).includes(String(count)))
    assert.ok(intl.formatMessage({id:'intake.fileTooLarge'}).includes(locale === 'es' ? 'límite' : 'limit'))
    assert.equal(intl.formatMessage({id:'intake.page'},{page:2,total:4}), locale==='es'?'Página 2 de 4':'Page 2 of 4')
  }
})

test('new components have no hardcoded JSX copy and every literal translation key exists', () => {
  for(const file of components) {
    const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
    function visit(node) {
      if(ts.isJsxText(node)&&/[\p{L}]/u.test(node.text)) assert.ok(['· v'].includes(node.text.trim()), `${file}: untranslated ${node.text}`)
      if(ts.isJsxAttribute(node)&&['title','placeholder','aria-label'].includes(node.name.getText(source))&&node.initializer&&ts.isStringLiteral(node.initializer)) {
        assert.ok(node.initializer.text.includes('@'),`${file}: untranslated attribute ${node.initializer.text}`)
      }
      if(ts.isCallExpression(node)&&['t','flow'].includes(node.expression.getText(source))&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])) {
        const prefix = node.expression.getText(source)==='flow' || /\bt\s*=\s*useIntakeText\(/.test(source.text) ? 'intake.flow.' : ''
        const key = prefix + node.arguments[0].text
        for(const locale of ['es','en']) assert.ok(catalogs[locale][key],`${locale}: ${key}`)
      }
      ts.forEachChild(node,visit)
    }
    visit(source)
  }
})
