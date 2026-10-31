import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/app/pages/academico/plan-estudios/components/schedule-layout.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const layoutModule = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const {layoutSessions} = layoutModule
const session = (id, start, end) => ({id, bloque: {hora_inicio: start, hora_fin: end}})
const customSession = (id, start, end) => ({id, bloque: null, hora_inicio: start, hora_fin: end})

test('simultaneous classes have distinct columns and adjacent classes reuse full width', () => {
  const entries = [session('3', '10:00', '11:00'), session('2', '08:30', '10:00'), session('1', '08:00', '09:00')]
  const layout = layoutSessions(entries)
  assert.deepEqual(layout.map(({session, lane, lanes}) => [session.id, lane, lanes]), [['1', 0, 2], ['2', 1, 2], ['3', 0, 1]])
  assert.equal(entries[0].id, '3')
})

test('connected overlaps reuse lanes without allowing colliding intervals to share one', () => {
  const layout = layoutSessions([session('1', '08:00', '12:00'), session('2', '08:00', '09:00'), session('3', '09:00', '11:00'), session('4', '10:00', '12:00')])
  assert.deepEqual(layout.map(({lane, lanes}) => [lane, lanes]), [[0, 3], [1, 3], [1, 3], [2, 3]])
  assert.deepEqual(layoutSessions([]), [])
})

test('custom hours and predefined blocks share the same weekly layout', () => {
  const layout = layoutSessions([
    customSession('3', '09:00', '09:45'),
    session('1', '08:00', '09:00'),
    customSession('2', '08:30', '09:15'),
  ])
  assert.deepEqual(layout.map(({session, lane, lanes}) => [session.id, lane, lanes]), [['1', 0, 2], ['2', 1, 2], ['3', 0, 2]])
})

// Exercise the actual rendered controls and their handlers without opening a browser.
const require = createRequire(import.meta.url)
const panelSource = fs.readFileSync(new URL('../src/app/pages/academico/plan-estudios/components/SchedulingPanel.tsx', import.meta.url), 'utf8')
const panelJs = ts.transpileModule(panelSource, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
}}).outputText
const messages = JSON.parse(fs.readFileSync(new URL('../src/_metronic/i18n/messages/es.json', import.meta.url), 'utf8'))
const formatMessage = ({id}, values = {}) => {
  assert.ok(id in messages, `Missing translation: ${id}`)
  return messages[id].replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')
}
const box = ({children}) => React.createElement('div', null, children)
const Modal = Object.assign(({show, children, 'aria-labelledby': labelledby}) => show
  ? React.createElement('section', {role: 'dialog', 'aria-labelledby': labelledby}, children) : null,
{Header: box, Title: ({id, children}) => React.createElement('h2', {id}, children), Body: box, Footer: box})
const OptionSelect = ({label, value, tipo}) => React.createElement('select', {'aria-label': label, 'data-filter': tipo, value, readOnly: true}, React.createElement('option', {value}, value))
const group = {id: 'group', url_token: 'group', nombre: 'A', ano_lectivo_id: 'year', jornada_id: 'journey', sede_id: 'campus', grado: {nombre: 'Primero'}, sede: {nombre: 'Sede central'}, jornada: {nombre: 'Mañana', hora_inicio: '08:00', hora_fin: '12:00'}}
const subject = {id: 'subject', url_token: 'subject', nombre: 'Matemáticas y pensamiento lógico con un nombre largo'}
const lesson = {...customSession('lesson/token', '08:00', '09:00'), bloque_horario_id: null, materia: subject, materia_id: 'subject', grupo: group, grupo_id: 'group', dia: 'lunes', docente_id: 'teacher', docente: {id: 'teacher', url_token: 'teacher', name: 'Docente de prueba'}, espacio_fisico_id: 'room', espacio: {id: 'room', url_token: 'room', nombre: 'Salón principal'}}
const assignment = {...lesson, id: 'assignment/token', ano_lectivo_id: 'year'}

function harness({mode = 'horarios', canManage = true, yearWritable = true, hasGroup = true} = {}) {
  let stateCursor = 0, refCursor = 0, tree
  const states = [], refs = [], mutations = []
  let params = new URLSearchParams(hasGroup ? 'grupo=group' : '')
  const catalog = {can_manage: canManage, grupos: [group], docentes: [lesson.docente], espacios: [lesson.espacio], materias: [subject], bloques: [], asignaciones: [assignment], sesiones: [lesson], anos: [], areas: []}
  const list = {rows: catalog.asignaciones, response: {schedule: catalog}, isLoading: false, isFetching: false, error: null, meta: {current_page: 1, last_page: 1, total: 1, per_page: 20}, onPageChange() {}, onPerPageChange() {}}
  const mocks = {
    react: {...React, useState(initial) {
      const index = stateCursor++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], value => {states[index] = typeof value === 'function' ? value(states[index]) : value}]
    }, useRef(initial) {return refs[refCursor++] ??= {current: initial}}, useEffect() {}, useId: () => 'details-title'},
    '@tanstack/react-query': {useMutation: () => ({mutate: value => mutations.push(value), isPending: false}), useQueryClient: () => ({invalidateQueries() {}})},
    'react-intl': {useIntl: () => ({formatMessage, formatDate: (date, options) => new Intl.DateTimeFormat('es', options).format(date), formatNumber: value => new Intl.NumberFormat('es').format(value)})},
    'react-bootstrap': {Modal},
    'react-dom': {createPortal: element => element},
    'react-router-dom': {useSearchParams: () => [params, next => {params = typeof next === 'function' ? next(params) : next}]},
    '@/lib/api/client': {ApiError: Error, api: {}},
    '@/app/shared/components/AcademicPagination': {AcademicPagination: () => null},
    '@/lib/format/schoolTime': {formatSchoolTime: time => `${Number(time.slice(0, 2)) % 12 || 12}:${time.slice(3, 5)} ${Number(time.slice(0, 2)) < 12 ? 'AM' : 'PM'}`},
    '../../shared/AcademicOptionSelect': {AcademicOptionSelect: OptionSelect},
    '../horarios.api': {useSchedule: () => ({data: catalog, isLoading: false, error: null})},
    '../../shared/opaqueAcademic': {fromOpaqueAcademic: value => value, toOpaqueAcademic: value => value},
    '../../academic-year-context': {useAcademicYear: () => ({yearToken: 'year', years: [{url_token: 'year', nombre: '2026'}], writable: yearWritable})},
    '../../estructura/useAcademicPagedList': {useAcademicPagedList: () => list},
    './schedule-layout': layoutModule,
    './schedule.css': {},
  }
  const module = {exports: {}}
  new Function('require', 'module', 'exports', panelJs)(id => {
    if (id in mocks) return mocks[id]
    if (id === 'react/jsx-runtime') return require(id)
    throw new Error(`Unmocked import: ${id}`)
  }, module, module.exports)
  const render = () => {stateCursor = 0; refCursor = 0; tree = module.exports.SchedulingPanel({mode}); return tree}
  render()
  return {render, mutations, catalog, html: () => renderToStaticMarkup(tree), tree: () => tree}
}
function elements(tree, predicate) {
  const result = []
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!React.isValidElement(node)) return
    if (predicate(node)) result.push(node)
    visit(node.props.children)
  }
  visit(tree)
  return result
}
const hasClass = (element, name) => element.props.className?.split(' ').includes(name)
const cards = h => elements(h.tree(), element => element.type === 'button' && hasClass(element, 'schedule-session'))
const dialog = h => elements(h.tree(), element => element.type === Modal && element.props.show)[0]
const button = (tree, label) => elements(tree, element => element.type === 'button' && element.props.children === label)[0]
const click = element => {assert.ok(element, 'Expected an actionable element'); element.props.onClick({stopPropagation() {}})}

test('all seven days remain present and a native button opens a labelled read-only detail', () => {
  const h = harness({canManage: false})
  // Session payloads may omit campus/journey relations already present in the catalog.
  h.catalog.sesiones = [{...lesson, grupo: {...group, sede: null, jornada: null}}]
  h.render()
  assert.equal(elements(h.tree(), element => element.props['data-schedule-day']).length, 7)
  assert.equal(elements(h.tree(), element => element.type === 'abbr' && element.props['aria-label']).length, 7)
  const card = cards(h)[0]
  assert.equal(card.props.type, 'button')
  assert.equal(card.props['aria-haspopup'], 'dialog')
  for (const value of [subject.nombre, 'lunes', '8:00', '9:00', 'Salón principal', 'Docente de prueba']) assert.ok(card.props['aria-label'].includes(value))
  assert.equal(hasClass(card, 'schedule-session-draggable'), false)
  click(card); h.render()
  const detail = dialog(h)
  assert.equal(detail.props['aria-labelledby'], 'details-title')
  const html = renderToStaticMarkup(detail)
  for (const value of [subject.nombre, 'Sede central', 'Mañana', 'Docente de prueba', 'Salón principal']) assert.ok(html.includes(value))
  assert.doesNotMatch(html, /<form|<select|<input/)
  assert.equal(button(detail, formatMessage({id: 'common.edit'})), undefined)
  assert.equal(button(detail, formatMessage({id: 'schedule.copy'})), undefined)
  click(button(detail, formatMessage({id: 'common.close'}))); h.render()
  assert.equal(dialog(h), undefined)
  assert.deepEqual(h.mutations, [])
})

test('detail actions preserve editing, copying and confirmed deletion with public tokens', () => {
  for (const action of ['common.edit', 'schedule.copy', 'common.delete']) {
    const h = harness()
    click(cards(h)[0]); h.render()
    click(button(dialog(h), formatMessage({id: action}))); h.render()
    if (action === 'common.edit') {
      const editor = dialog(h)
      assert.equal(elements(editor, element => element.type === 'form').length, 1)
      assert.equal(elements(editor, element => element.type === OptionSelect && element.props.tipo === 'materias')[0].props.value, 'subject')
      assert.equal(elements(editor, element => element.props.id === 'schedule-start')[0].props.value, '08:00')
    } else if (action === 'schedule.copy') {
      assert.equal(dialog(h), undefined)
      assert.equal(elements(h.tree(), element => element.props['data-schedule-copy-banner']).length, 1)
      click(cards(h)[0]); h.render()
      assert.equal(dialog(h), undefined, 'Copy placement must not open the detail')
    } else {
      assert.deepEqual(h.mutations, [], 'Deletion still requires confirmation')
      click(button(dialog(h), formatMessage({id: 'common.delete'})))
      assert.deepEqual(h.mutations, [{path: '/horarios/lesson%2Ftoken', method: 'delete'}])
    }
  }
})

test('a closed academic year removes drag and mutation actions from both modes', () => {
  const h = harness({yearWritable: false})
  assert.equal(hasClass(cards(h)[0], 'schedule-session-draggable'), false)
  click(cards(h)[0]); h.render()
  assert.equal(elements(dialog(h), element => element.type === 'button').length, 1)
  const assignments = harness({mode: 'asignaciones', yearWritable: false})
  assert.equal(elements(assignments.tree(), element => hasClass(element, 'schedule-assignment-action')).length, 0)
  const toolbar = elements(assignments.tree(), element => hasClass(element, 'schedule-toolbar-actions'))[0]
  assert.equal(button(toolbar, formatMessage({id: 'schedule.assignWholeGroup'})), undefined)
})

test('assignment rows retain labelled values, contextual icon actions and all filters', () => {
  const h = harness({mode: 'asignaciones'})
  const filters = elements(h.tree(), element => hasClass(element, 'schedule-filters'))[0]
  assert.deepEqual(elements(filters, element => element.type === OptionSelect).map(element => [element.props.tipo, element.props.hideLabel]), [['grupos', undefined], ['materias', undefined], ['docentes', undefined]])
  const html = h.html()
  assert.doesNotMatch(html, /table-responsive/)
  for (const value of ['2026', subject.nombre, 'Docente de prueba', 'Primero / (A)']) assert.ok(html.includes(value))
  assert.equal(elements(h.tree(), element => hasClass(element, 'schedule-assignment-label')).length, 3)
  const actions = elements(h.tree(), element => hasClass(element, 'schedule-assignment-action'))
  assert.equal(actions.length, 2)
  for (const action of actions) {
    assert.equal(action.props.type, 'button')
    assert.ok(action.props['aria-label'].includes(subject.nombre))
    assert.ok(action.props['aria-label'].includes('Primero / (A)'))
    assert.equal(elements(action, element => element.type === 'i' && element.props['aria-hidden'] === 'true').length, 1)
  }
  click(actions[0]); h.render()
  assert.equal(elements(dialog(h), element => element.type === OptionSelect && element.props.tipo === 'grupos')[0].props.value, 'group')
  const deleting = harness({mode: 'asignaciones'})
  click(elements(deleting.tree(), element => hasClass(element, 'schedule-assignment-action'))[1]); deleting.render()
  assert.deepEqual(deleting.mutations, [])
  click(button(dialog(deleting), formatMessage({id: 'common.delete'})))
  assert.deepEqual(deleting.mutations, [{path: '/asignaciones/assignment%2Ftoken', method: 'delete'}])
})

test('managers still select a group before accessing the weekly calendar', () => {
  const h = harness({hasGroup: false})
  assert.equal(cards(h).length, 0)
  assert.ok(h.html().includes(formatMessage({id: 'schedule.groupRequired'})))
  assert.equal(button(h.tree(), formatMessage({id: 'schedule.print'})).props.disabled, true)
})

test('day headers expose every overlapping filtered class through full-width detail options', () => {
  const h = harness()
  h.catalog.sesiones = Array.from({length: 12}, (_, index) => ({...lesson, id: `overlap-${index}`, materia: {...subject, nombre: `Asignatura ${index}`}}))
  h.render()
  const headers = elements(h.tree(), element => hasClass(element, 'schedule-day-open'))
  assert.equal(headers[0].props['aria-label'], 'lunes (12)')
  assert.equal(headers[1].props.disabled, true)
  click(headers[0]); h.render()
  const choices = elements(dialog(h), element => hasClass(element, 'schedule-day-session-option'))
  assert.equal(choices.length, 12)
  for (const choice of choices) {
    click(choice); h.render()
    assert.equal(elements(dialog(h), element => hasClass(element, 'schedule-day-session-option') && element.props['aria-current'] === 'true')[0].props['aria-label'], choice.props['aria-label'])
    const name = elements(choice, element => element.type === 'strong')[0].props.children
    assert.ok(renderToStaticMarkup(elements(dialog(h), element => element.type === 'dl')[0]).includes(name))
  }
  assert.deepEqual(h.mutations, [])
})

test('dragging retains quarter-hour placement and suppresses the subsequent detail click', t => {
  const globals = {
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    document: {elementFromPoint: () => ({closest: () => ({dataset: {scheduleDay: 'martes'}, getBoundingClientRect: () => ({top: 0})})})},
  }
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, {value, configurable: true})
    t.after(() => {if (previous) Object.defineProperty(globalThis, key, previous); else delete globalThis[key]})
  }
  const h = harness()
  const card = cards(h)[0]
  const target = {getBoundingClientRect: () => ({top: 0}), setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {}}
  card.props.onPointerDown({pointerType: 'mouse', button: 0, pointerId: 1, clientX: 10, clientY: 0, currentTarget: target})
  card.props.onPointerMove({pointerId: 1, clientX: 50, clientY: 28, preventDefault() {}})
  card.props.onPointerUp({pointerType: 'mouse', pointerId: 1, clientX: 50, clientY: 28, currentTarget: target})
  assert.equal(h.mutations.length, 1)
  assert.deepEqual(h.mutations[0], {path: '/horarios/lesson%2Ftoken', method: 'put', body: {
    dia: 'martes', grupo_id: 'group', materia_id: 'subject', docente_id: 'teacher', espacio_fisico_id: 'room', bloque_horario_id: null, hora_inicio: '08:15', hora_fin: '09:15',
  }})
  click(card); h.render()
  assert.equal(dialog(h), undefined)
})
