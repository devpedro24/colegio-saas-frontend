import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = '../src/app/pages/academico/evaluacion/'
function load(path, mocks = {}) {
  const source = fs.readFileSync(new URL(root + path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  }}).outputText
  const module = {exports: {}}
  new Function('require', 'module', 'exports', code)(id => id in mocks ? mocks[id] : require(id), module, module.exports)
  return module.exports
}
const format = load('gradeDisplay.ts')
const visual = load('components/VisualChoice.tsx')
const number = load('../../../shared/components/NumberInput.tsx')
const view = load('components/RecuperacionesView.tsx', {
  '@/app/shared/components/NumberInput': number,
  'react-intl': {useIntl: () => ({formatMessage: ({id}) => id})},
  '@/_metronic/helpers': {}, '@/lib/ui/toast': {}, '../recuperaciones.api': {},
  '@/lib/drafts/WorkDrafts': {useWorkDraft: () => ({notice: null, afterSave: () => () => {}})},
  './VisualChoice': visual, '../gradeDisplay': format,
})
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const choice = {url_token: 'choice', nombre: 'Logrado', emoji: '😄', imagen_url: null, aprueba: true}
const numeric = {display_value: '5.0', valoracion: null, aprobado: true}
const item = {
  id: 'recovery', version: 2, materia: 'Matemáticas', periodo: 'Cuarto período', periodo_id: 'fourth', periodo_orden: 4,
  periodo_estado: 'abierto', tipo: 'nivelacion', estado: 'aprobada', politica: 'REPLACE',
  valor_original_exacto: '423/160', nota_recuperacion: '5.00000000', valor_efectivo_exacto: '5',
  resultado_original: {...numeric, display_value: '2.6', aprobado: false}, resultado_recuperacion: numeric,
  resultado_manual: null, resultado_efectivo: numeric, escala_visual: {tipo: 'numerica', opciones: []},
  can_record: true, can_cancel: true,
}
const props = {canManage: true, saving: false, cancelling: false, onSave() {}, onCancel() {}}

test('grade presentation uses exactly one decimal and SIEE exact-five rounding, without floats', () => {
  for (const [input, expected] of [['3.00', '3.0'], ['0.00', '0.0'], ['5.00000000', '5.0'],
    ['3.05', '3.0'], ['3.05001', '3.1'], ['2.95', '2.9'], ['2.9501', '3.0'],
    ['2,8', '2.8'], ['-0.05', '0.0'], ['-2.951', '-3.0']]) {
    assert.equal(format.gradeDisplay(input), expected)
  }
  assert.equal(format.gradeDisplay('423/160'), '—', 'fractions must be formatted by the exact backend calculator')
})

test('recovery history renders presentation fields, never internal fractions or decimal padding', () => {
  const html = render(view.RecoveryRecord, {...props, item})
  assert.doesNotMatch(html, /423\/160|5\.00000000|step="0\.01"/)
  assert.match(html, /2\.6/)
  assert.match(html, /value="5\.0"/)
  assert.match(html, /step="0\.1"/)
  assert.match(html, /badge-light-primary/)
})

test('visual recovery and manual final result use scoped choice selectors, not numeric inputs', () => {
  const visualResult = {display_value: null, valoracion: choice, aprobado: true}
  const html = render(view.RecoveryRecord, {...props, item: {...item, politica: 'MANUAL',
    escala_visual: {tipo: 'imagenes', opciones: [choice]}, resultado_original: visualResult,
    resultado_recuperacion: visualResult, resultado_efectivo: visualResult, resultado_manual: visualResult,
  }})
  assert.equal((html.match(/<select/g) ?? []).length, 2)
  assert.doesNotMatch(html, /type="number"|423\/160|5\.00000000/)
  assert.match(html, /Logrado/)
  assert.match(html, /value="choice" selected/)
  assert.match(html, /evaluacion.recuperaciones.gradeVisual/)
})

test('results are grouped chronologically with annual results last and period states visible', () => {
  const rows = [3, null, 1, 2].map(order => ({periodo_id: order === null ? null : `p${order}`,
    periodo: order === null ? null : `Período ${order}`, periodo_orden: order,
    periodo_estado: order === null ? null : order === 3 ? 'abierto' : 'cerrado'}))
  const html = render(view.RecoveryPeriodGroups, {items: rows,
    renderItem: row => React.createElement('div', {key: row.periodo_id}, 'Materia')})
  assert.ok(html.indexOf('Período 1') < html.indexOf('Período 2'))
  assert.ok(html.indexOf('Período 2') < html.indexOf('Período 3'))
  assert.ok(html.indexOf('Período 3') < html.indexOf('evaluacion.recuperaciones.annual'))
  assert.match(html, /period.abierto/)
  assert.match(html, /period.cerrado/)
})

test('closed recovery renders the warning and has no grade form', () => {
  const html = render(view.RecoveryRecord, {...props, item: {...item, can_record: false,
    can_cancel: false, motivo_bloqueo: 'Período cerrado'}})
  assert.match(html, /alert-warning/)
  assert.doesNotMatch(html, /<form|<input|<select/)
})

test('visual recovery request sends opaque category tokens and no fabricated numeric grade', () => {
  let sent
  const api = load('recuperaciones.api.ts', {
    '@tanstack/react-query': {useQueryClient: () => ({}), useMutation: options => options},
    '@/lib/api/client': {api: {put: (url, body) => {sent = {url, body}}}},
    '../shared/opaqueAcademic': {},
  })
  api.useRegistrarRecuperacion('enrollment').mutationFn({id: 'recovery', version: 2, grade: '', manual: '',
    choice: 'choice', manualChoice: 'manualChoice', reason: 'Motivo'})
  assert.equal(sent.body.nota_recuperacion, null)
  assert.equal(sent.body.nota_manual, null)
  assert.equal(sent.body.escala_opcion_token, 'choice')
  assert.equal(sent.body.escala_opcion_manual_token, 'manualChoice')
})
