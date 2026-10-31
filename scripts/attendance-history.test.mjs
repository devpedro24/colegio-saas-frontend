import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = fs.readFileSync(new URL('../src/app/pages/academico/asistencia/AttendanceRequests.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
}}).outputText

function renderInbox(scope) {
  let queryArgs
  const requests = ['revision_docente', 'pendiente_aprobacion', 'aprobada', 'rechazada'].map(estado => ({
    token: estado, estado, estudiante: `Estudiante ${estado}`, asignatura: 'Ciencias', grupo: 'A',
    marcas: [], motivo: 'Motivo de prueba',
  }))
  const mocks = {
    'react-intl': {useIntl: () => ({formatMessage: ({id}) => id})},
    '@/lib/api/client': {}, '@/lib/ui/toast': {useToast: () => ({})},
    './AttendanceApprovalModal': {AttendanceApprovalModal: () => null},
    './asistencia.api': {
      useAttendanceRequests: (...args) => {
        queryArgs = args
        return {data: {solicitudes: requests, pagination: {last_page: 3, total: 44}}}
      },
      useReviewAttendanceRequest: () => ({isPending: false}),
      useResolveAttendanceRequest: () => ({isPending: false}),
    },
  }
  const module = {exports: {}}
  new Function('require', 'module', 'exports', compiled)(id => id in mocks ? mocks[id] : require(id), module, module.exports)
  const html = renderToStaticMarkup(React.createElement(module.exports.AttendanceRequestInbox, {scope}))
  return {html, queryArgs}
}

test('teacher justification history is always requested and visible without a toggle', () => {
  const {html, queryArgs} = renderInbox('docente')
  assert.deepEqual(queryArgs, ['docente', 1, undefined])
  assert.doesNotMatch(html, /checkbox|attendance.showAllRequests/)
  for (const status of ['revision_docente', 'pendiente_aprobacion', 'aprobada', 'rechazada']) {
    assert.ok(html.includes(`attendance.requestStatus.${status}`))
  }
  assert.equal((html.match(/attendance.forward/g) ?? []).length, 1)
  assert.equal((html.match(/attendance.reject/g) ?? []).length, 1)
  assert.match(html, /attendance.next/)
  assert.match(html, /class="badge badge-light-danger">attendance.requestStatus.rechazada/)
  assert.match(html, /class="badge badge-light-primary">attendance.requestStatus.aprobada/)
})

test('approval inbox retains its separate filter and own requests remain unfiltered', () => {
  const approval = renderInbox('aprobacion')
  assert.deepEqual(approval.queryArgs, ['aprobacion', 1, 'pendiente_aprobacion'])
  assert.match(approval.html, /attendance.showAllRequests/)
  const own = renderInbox('propias')
  assert.deepEqual(own.queryArgs, ['propias', 1, undefined])
  assert.doesNotMatch(own.html, /checkbox|attendance.showAllRequests/)
})
