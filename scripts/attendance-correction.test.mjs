import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const source = fs.readFileSync(new URL('../src/app/pages/academico/asistencia/attendanceCorrection.ts', import.meta.url), 'utf8')
const module = {exports: {}}
new Function('exports', ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText)(module.exports)
const {attendanceToday, canEditAttendanceMark, nextAttendanceMark} = module.exports
const column = {fecha: '2026-02-02', editable: true, matriculas: ['student'], marcas: {student: 'ausente'}}

test('absence correction expires at midnight Colombia, not midnight UTC', () => {
  const before = attendanceToday(new Date('2026-02-03T04:59:59Z'))
  const after = attendanceToday(new Date('2026-02-03T05:00:00Z'))
  assert.equal(before, '2026-02-02')
  assert.equal(after, '2026-02-03')
  assert.equal(canEditAttendanceMark(column, 'student', before), true)
  assert.equal(canEditAttendanceMark(column, 'student', after), false)
  assert.equal(canEditAttendanceMark(column, 'student', '2026-02-01'), false)
})

test('permissions, period locks, roster and approved justifications cannot be bypassed', () => {
  assert.equal(canEditAttendanceMark({...column, editable: false}, 'student', column.fecha), false)
  assert.equal(canEditAttendanceMark(column, 'other', column.fecha), false)
  for (const state of ['justificada', 'tarde']) {
    assert.equal(canEditAttendanceMark({...column, marcas: {student: state}}, 'student', column.fecha), false)
  }
})

test('saved absence becomes Present, never blank; a draft can still be cancelled', () => {
  assert.equal(nextAttendanceMark('ausente', 'ausente', 'presente'), 'presente')
  assert.equal(nextAttendanceMark('ausente', 'presente', 'presente'), 'presente')
  assert.equal(nextAttendanceMark('ausente', 'presente', 'ausente'), 'ausente')
  assert.equal(nextAttendanceMark('sin_marcar', 'presente', 'presente'), 'sin_marcar')
})

test('real attendance grid enables same-day absence buttons and locks historical absences', () => {
  const require = createRequire(import.meta.url)
  const gridSource = fs.readFileSync(new URL('../src/app/pages/academico/asistencia/AttendanceSheetView.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(gridSource + '\nexport {AttendanceGrid}', {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022},
  }).outputText
  const mocks = {
    'react-bootstrap': {}, '@tanstack/react-query': {useQueryClient: () => ({})},
    'react-intl': {useIntl: () => ({formatMessage: ({id}) => id})},
    '../shared/useAcademicSearchParams': {}, '@/lib/api/client': {},
    '@/lib/ui/toast': {useToast: () => ({})}, './AttendancePolicyPanel': {},
    '@/lib/drafts/WorkDrafts': {useWorkDraft: () => ({notice: null, afterSave: () => () => {}})},
    './AttendanceRequests': {}, './asistencia.api': {}, './attendance-sheet.css': {},
    './attendanceCorrection': {...module.exports, attendanceToday: () => '2026-02-02'},
  }
  const gridModule = {exports: {}}
  new Function('require', 'module', 'exports', compiled)(id => id in mocks ? mocks[id] : require(id), gridModule, gridModule.exports)
  const render = overrides => renderToStaticMarkup(React.createElement(gridModule.exports.AttendanceGrid, {
    assignment: 'assignment', selected: '', onSelect: () => {}, onDirtyChange: () => {},
    sheet: {periodo: {token: 'period', estado: 'abierto'},
      columnas: [{...column, sesion_token: 'session', hora_inicio: '08:00', hora_fin: '09:00', version: 1, registrada: true, ...overrides}],
      estudiantes: [{matricula_token: 'student', nombre: 'Estudiante', activa: true,
        resumen: {faltas_equivalentes: 1, registradas: 1, porcentaje: 100, alerta: false}}]},
  }))
  const today = render({})
  assert.match(today, /aria-pressed="false" tabindex="0"[^>]*aria-label="attendance.presente"/)
  const yesterday = render({fecha: '2026-02-01'})
  assert.match(yesterday, /aria-pressed="false" disabled="" tabindex="0"[^>]*aria-label="attendance.presente"/)
  assert.match(yesterday, /class="alert alert-warning mb-4" role="note">attendance.sheet.correctionHelp/)
  assert.match(render({editable: false}), /aria-pressed="false" disabled="" tabindex="0"/)
})

test('attendance warning uses localized, general time-zone wording', () => {
  for (const [locale, expected] of [['es', 'según tu zona horaria'], ['en', 'according to your time zone']]) {
    const messages = JSON.parse(fs.readFileSync(new URL(`../src/_metronic/i18n/messages/${locale}.json`, import.meta.url), 'utf8'))
    const warning = messages['attendance.sheet.correctionHelp']
    assert.ok(warning.includes(expected))
    assert.doesNotMatch(warning, /Colombia|UTC/)
  }
})
