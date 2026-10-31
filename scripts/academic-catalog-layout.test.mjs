import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = name => fs.readFileSync(new URL(`../src/app/pages/academico/${name}`, import.meta.url), 'utf8')
function load(text, mocks) {
  const js = ts.transpileModule(text, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  }}).outputText
  const module = {exports: {}}
  new Function('require', 'module', 'exports', js)(id => {
    if (id in mocks) return mocks[id]
    if (['react', 'react/jsx-runtime'].includes(id)) return require(id)
    throw new Error(`Unmocked import: ${id}`)
  }, module, module.exports)
  return module.exports
}
const intl = {useIntl: () => ({formatMessage: ({id}) => id})}
const box = ({children}) => React.createElement('section', null, children)
function catalog({teacher = true, statuses = ['activa'], reportsOnly = false, subjectCount = 1, groupCount = 1, from = 1} = {}) {
  const {CatalogoView} = load(source('evaluacion/components/CatalogoView.tsx'), {
    'react-intl': intl,
    'react-router-dom': {useNavigate: () => () => {}},
    '../evaluacion.api': {useCatalogoEvaluacion: () => ({data: {
      anos: [{url_token: 'year', estado: 'en_curso', nombre: '2026'}],
      grupos: Array.from({length: groupCount}, (_, index) => ({url_token: index ? `group${index}` : 'group', ano_lectivo_id: 'year', nombre: 'PJA', grado: {nombre: 'Prejardín'}})),
      materias: Array.from({length: subjectCount}, (_, index) => ({url_token: `subject${index}`, nombre: `Materia ${index}`})),
      periodos: [{url_token: 'period', ano_lectivo_id: 'year', estado: 'abierto', nombre: 'Cuarto'}],
      asignaciones: [], matriculas: [{id: 'student-token', url_token: 'student-token', nombre_lista: 'Apellido Nombre', estudiante: {name: 'Nombre Apellido'}, grupo: {nombre: 'PJA', grado: {nombre: 'Prejardín'}}, estado: 'activa'}],
      pagination: {matriculas: {from}}, estados_disponibles: statuses, can_view_reports: true,
    }})},
    '@/_metronic/helpers': {KTCard: box, KTCardBody: box},
    '@/app/shared/components/AcademicPagination': {AcademicPagination: () => null},
    '@/app/shared/components/AcademicPageHeader': {AcademicPageHeader: box},
    '@/app/shared/hooks/usePageSize': {usePageSize: () => [20, () => {}]},
    '../../shared/AcademicOptionSelect': {AcademicOptionSelect: ({tipo}) => React.createElement('span', {'data-filter': tipo})},
    '../../shared/useCatalogFilters': {useCatalogFilters: () => [{ano: 'year', grupo: teacher ? 'group' : '', materia: '', periodo: 'period'}, () => {}]},
    '@/app/modules/auth/core/authz': {useAuthz: () => ({hasRole: () => teacher, hasPermission: () => false})},
  })
  return renderToStaticMarkup(React.createElement(CatalogoView, {
    reportsOnly, reportActions: React.createElement('button', null, 'Emitir boletines'),
  }))
}

test('single-group teacher report has no empty filter card and actions are in list header', () => {
  const html = catalog({reportsOnly: true})
  assert.doesNotMatch(html, /report-catalog-filters/)
  assert.match(html, /card-header gap-3[\s\S]*card-toolbar[\s\S]*Emitir boletines/)
})
test('rector reports retain their group filter', () => {
  const html = catalog({reportsOnly: true, teacher: false})
  assert.match(html, /report-catalog-filters/)
  assert.match(html, /data-filter="grupos"/)
})
test('teacher reports keep the status filter when there are multiple statuses', () => {
  const html = catalog({reportsOnly: true, statuses: ['activa', 'retirada']})
  assert.match(html, /report-catalog-filters/)
  assert.match(html, /evaluacion-status/)
  assert.doesNotMatch(html, /data-filter="grupos"/)
})
test('assignment filters sit in the header, with group selector only when needed', () => {
  const teacher = catalog({subjectCount: 10})
  assert.match(teacher, /assignment-toolbar[\s\S]*data-filter="materias"/)
  assert.doesNotMatch(teacher, /data-filter="grupos"|report-catalog-filters/)
  assert.match(catalog({teacher: false}), /assignment-toolbar[\s\S]*data-filter="grupos"[\s\S]*data-filter="materias"/)
})

test('single-group teachers with fewer than ten subjects do not need subject filters', () => {
  for (const subjectCount of [1, 4, 9]) assert.doesNotMatch(catalog({subjectCount}), /data-filter="materias"/)
  assert.match(catalog({subjectCount: 10}), /data-filter="materias"/)
  assert.match(catalog({subjectCount: 1, groupCount: 2}), /data-filter="materias"/)
  assert.match(catalog({teacher: false, subjectCount: 1}), /data-filter="materias"/)
})

test('report roster shows position rather than internal ID and no status column', () => {
  const teacher = catalog({reportsOnly: true})
  assert.match(teacher, /<td class="text-muted">1<\/td>/)
  assert.doesNotMatch(teacher, /<th>evaluacion.matriculas.estado<\/th>|evaluacion.matriculas.estado.activa/)
  assert.match(catalog({reportsOnly: true, teacher: false, from: 21}), /<td class="text-muted">21<\/td>/)
})
test('gradebook shares the HTML indicator sheet and removes obsolete objective UI', () => {
  const workspace = source('evaluacion/components/IndicadorWorkspace.tsx')
  assert.match(workspace, /<GroupIndicatorSheet group=\{context.group\} period=\{context.period\} subject=\{context.subject\}/)
  assert.doesNotMatch(workspace, /indicators\.objectives|useGroupIndicatorTexts/)
  const sheet = source('evaluacion/components/GroupIndicatorSheet.tsx')
  assert.match(sheet, /useGroupIndicatorSheet\(group, period\)/)
  assert.match(sheet, /!subject \|\| row\.materia_token === subject/)
  assert.match(sheet, /safeIndicatorHtml\(row.texto_html\)/)
})
test('attendance no longer renders the redundant choose-assignment card', () => {
  assert.doesNotMatch(source('asistencia/AttendanceSheetView.tsx'), /t\('attendance.sheet.choose'\)/)
})
