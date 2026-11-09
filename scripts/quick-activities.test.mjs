import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

class TestApiError extends Error {}

const require = createRequire(import.meta.url)
const root = '../src/app/pages/academico/evaluacion/'
const compile = (path, extra = '') => ts.transpileModule(
  fs.readFileSync(new URL(root + path, import.meta.url), 'utf8') + extra,
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}},
).outputText
function evaluate(js, mocks = {}) {
  const module = {exports: {}}
  new Function('require', 'module', 'exports', js)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (id === 'react/jsx-runtime') return require(id)
    throw new Error(`Unmocked import: ${id}`)
  }, module, module.exports)
  return module.exports
}
const decimals = evaluate(compile('gradeDecimal.ts'))
const editing = evaluate(compile('activityEditing.ts'), {'./gradeDecimal': decimals})
const {activityEditRows, activityEditIsCurrent, validateActivityEdit} = editing
const editorJs = compile('components/QuickActivityEditor.tsx')
const planillaJs = compile('components/PlanillaView.tsx')
const messages = JSON.parse(fs.readFileSync(new URL('../src/_metronic/i18n/messages/es.json', import.meta.url), 'utf8'))
const formatMessage = ({id}, values = {}) => {
  assert.ok(Object.hasOwn(messages, id), `Missing translation: ${id}`)
  return messages[id].replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join('')
  : React.isValidElement(node) ? textOf(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node)
function elements(tree, predicate) {
  const result = []
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!React.isValidElement(node)) return
    if (predicate(node)) result.push(node)
    visit(node.props.children)
  }
  visit(tree)
  return result
}
const button = (h, id) => elements(h.tree(), node => node.type === 'button' && textOf(node) === messages[id])[0]
const input = (h, field, token = 'activity/public-a') => {
  const found = elements(h.tree(), node => node.type === 'input' && node.props.id === `activity-${field}-${token}`)[0]
  assert.ok(found, `Missing ${field} input for ${token}`)
  return found
}
// Calling disabled handlers deliberately tests the save guard as well as its UI state.
const invokeSave = h => {
  const control = button(h, 'grading.saveActivities') ?? button(h, 'grading.saving')
  assert.ok(control, 'Expected the batch save action')
  control.props.onClick()
  h.render()
}
const change = (h, field, value, token) => {
  input(h, field, token).props.onChange({target: {value}})
  h.render()
}
const start = '2026-02-01'
const end = '2026-03-31'
function section(overrides = {}) {
  return {componente_token: 'component/public', preinforme_token: 'report/public', nombre: 'Primer preinforme',
    peso: '100', modo: 'WEIGHTED_AVERAGE', version: 11,
    actividades: [
      {id: 'internal-row-a', url_token: 'activity/public-a', componente_id: 'internal-component', version: 5,
        nombre: 'Lectura guiada', fecha: '2026-02-10T00:00:00Z', peso: '20.0000'},
      {id: 'internal-row-b', url_token: 'activity/public-b', componente_id: 'internal-component', version: 8,
        nombre: 'Proyecto', fecha: '2026-03-20T00:00:00Z', peso: '80.0000'},
    ], ...overrides}
}
const rowsWithWeights = weights => weights.map((peso, index) => ({token: `activity/${index}`, version: index + 1,
  nombre: `Actividad ${index + 1}`, fecha: start, peso}))
const validate = (rows, weighted = true) => validateActivityEdit(rows, weighted, start, end)
const editOf = (s = section()) => ({base: activityEditRows(s.actividades), rows: activityEditRows(s.actividades),
  mode: s.modo, componentVersion: s.version})

test('activity snapshots use public tokens, versions, ISO days and decimal text without mutating API data', () => {
  const activities = section().actividades.map(Object.freeze)
  Object.freeze(activities)
  assert.deepEqual(activityEditRows(activities), [
    {token: 'activity/public-a', version: 5, nombre: 'Lectura guiada', fecha: '2026-02-10', peso: '20'},
    {token: 'activity/public-b', version: 8, nombre: 'Proyecto', fecha: '2026-03-20', peso: '80'},
  ])
  assert.equal(activities[0].fecha, '2026-02-10T00:00:00Z')
  assert.equal(activities[0].peso, '20.0000')
  assert.equal(activityEditRows([{...activities[0], peso: null}])[0].peso, '')
})

test('weighted percentages total exactly 100 with four decimal places, including the smallest unit', () => {
  for (const weights of [['33.3333', '33.3333', '33.3334'], ['0.0001', '99.9999'], ['100.0000'], ['20', '80']]) {
    assert.deepEqual(validate(rowsWithWeights(weights)), {valid: true, weightsValid: true, total: 100, complete: true}, weights.join(' + '))
  }
})

test('a one-unit excess is rejected and incomplete totals stay valid but provisional', () => {
  for (const weights of [['33.3333', '33.3333', '33.3333'], ['20', '79.9999']]) {
    assert.deepEqual(validate(rowsWithWeights(weights)), {valid: true, weightsValid: true, total: 99.9999, complete: false})
  }
  assert.deepEqual(validate(rowsWithWeights(['20', '80.0001'])),
    {valid: false, weightsValid: false, total: 100.0001, complete: false})
  assert.equal(validate(rowsWithWeights(['20', '30'])).valid, true)
  assert.equal(validate(rowsWithWeights(['20', '30'])).complete, false)
})

test('weights reject zero, missing, signed, exponential, malformed, over-range and over-precision input', () => {
  for (const peso of ['', ' ', '0', '0.0000', '-1', '+20', '100.0001', '101', '0.00001',
    '33.33333', '1e1', 'NaN', 'Infinity', '.5', '1.', '1,5', '20%', '20x']) {
    const result = validate(rowsWithWeights([peso]))
    assert.equal(result.valid, false, peso)
    assert.equal(result.weightsValid, false, peso)
  }
  assert.equal(validate(rowsWithWeights(['0', '100'])).valid, false, 'A complete total cannot conceal a zero-weight row')
  for (const weighted of [true, false]) assert.equal(validate([], weighted).valid, false, 'An empty batch is not savable')
})

test('names require trimmed content up to 160 characters and dates must be ISO days within inclusive period limits', () => {
  const row = rowsWithWeights(['100'])[0]
  for (const fecha of [start, end]) assert.equal(validate([{...row, fecha}]).valid, true, fecha)
  assert.equal(validateActivityEdit([{...row, fecha: '2028-02-29'}], true, '2028-02-01', '2028-03-31').valid, true)
  assert.equal(validate([{...row, nombre: `  ${'á'.repeat(160)}  `}]).valid, true)
  for (const nombre of ['', ' \t\n ', 'a'.repeat(161)]) assert.equal(validate([{...row, nombre}]).valid, false, nombre)
  for (const fecha of ['', '2026-01-31', '2026-04-01', '2026-2-10', '10/02/2026', '2026-02-10T00:00:00Z']) {
    assert.equal(validate([{...row, fecha}]).valid, false, fecha)
  }
})

test('calendar-impossible dates are invalid even when their text falls within the period', () => {
  const row = rowsWithWeights(['100'])[0]
  const invalid = ['2026-02-29', '2026-02-30', '2026-03-00']
  assert.deepEqual(invalid.map(fecha => [fecha, validate([{...row, fecha}]).valid]), invalid.map(fecha => [fecha, false]))
})

test('simple average ignores absent or obsolete weights while still requiring valid names and dates', () => {
  const rows = rowsWithWeights(['', 'not-a-weight'])
  const result = validate(rows, false)
  assert.equal(result.valid, true)
  assert.equal(result.weightsValid, true)
  assert.equal(result.complete, true)
  assert.equal(validate([{...rows[0], nombre: ' '}], false).valid, false)
  assert.equal(validate([{...rows[0], fecha: '2026-04-01'}], false).valid, false)
})

test('a snapshot survives row reordering and local changes but rejects changed identities, versions, membership or mode', () => {
  const s = section(), edit = editOf(s), current = activityEditRows(s.actividades)
  edit.rows[0] = {...edit.rows[0], nombre: 'Nombre local', peso: '90'}
  assert.equal(activityEditIsCurrent(edit, [...current].reverse(), s.modo, s.version), true)
  const cases = [
    [current.map((row, index) => index === 0 ? {...row, version: row.version + 1} : row), s.modo, s.version],
    [current.map((row, index) => index === 0 ? {...row, token: 'activity/replacement'} : row), s.modo, s.version],
    [current.slice(1), s.modo, s.version],
    [[...current, {...current[0], token: 'activity/new'}], s.modo, s.version],
    [current, 'SIMPLE_AVERAGE', s.version],
    [current, s.modo, s.version + 1],
  ]
  for (const args of cases) assert.equal(activityEditIsCurrent(edit, ...args), false, JSON.stringify(args))
})

// Keep React state, stable setters and effect cleanups across real component renders.
// Only external hooks are mocked; handlers and validation come from the TSX above.
function hookHarness() {
  const states = [], refs = [], effects = []
  let stateCursor = 0, refCursor = 0, effectCursor = 0, queue = []
  return {
    react: {...React,
      useState(initial) {
        const index = stateCursor++
        if (!(index in states)) {
          const state = {value: typeof initial === 'function' ? initial() : initial}
          state.set = value => {state.value = typeof value === 'function' ? value(state.value) : value}
          states[index] = state
        }
        return [states[index].value, states[index].set]
      },
      useRef(initial) {return refs[refCursor++] ??= {current: initial}},
      useEffect(effect, deps) {
        const index = effectCursor++, previous = effects[index]
        if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
          queue.push(() => {previous?.cleanup?.(); effects[index] = {deps, cleanup: effect()}})
        }
      },
    },
    render(component, props) {
      stateCursor = 0; refCursor = 0; effectCursor = 0; queue = []
      const tree = component(props)
      queue.forEach(effect => effect())
      return tree
    },
    unmount() {effects.forEach(effect => effect?.cleanup?.())},
  }
}
function harness(overrides = {}) {
  const hooks = hookHarness(), mutations = [], dirty = [], events = [], toasts = []
  const mutation = {isPending: false, error: null,
    mutate(body, callbacks) {mutations.push({body: structuredClone(body), callbacks})},
    reset() {events.push('mutation.reset'); mutation.error = null},
  }
  let tree, draft
  const props = {assignment: 'assignment/public', period: 'period/public', section: section(),
    periodStart: `${start}T00:00:00Z`, periodEnd: `${end}T23:59:59Z`, editable: true,
    onDirtyChange: value => dirty.push(value), ...overrides}
  const {QuickActivityEditor} = evaluate(editorJs, {
    react: hooks.react,
    'react-intl': {useIntl: () => ({formatMessage})},
    '../activityEditing': editing,
    '@/lib/api/client': {ApiError: TestApiError},
    '../evaluacion.api': {useActividadPlanilla: (assignment, period) => {
      assert.equal(assignment, props.assignment); assert.equal(period, props.period)
      return mutation
    }},
    '@/lib/drafts/WorkDrafts': {useWorkDraft: options => {
      draft = options
      return {notice: null, afterSave: () => {events.push('draft.afterSave'); return () => events.push('draft.finished')}}
    }},
    '@/lib/ui/toast': {useToast: () => ({success: message => toasts.push(['success', message]), error: message => toasts.push(['error', message])})},
  })
  const h = {props, mutations, mutation, dirty, events, toasts,
    tree: () => tree, html: () => renderToStaticMarkup(tree), draft: () => draft,
    render(next = {}) {Object.assign(props, next); tree = hooks.render(QuickActivityEditor, props); return tree},
    unmount: hooks.unmount,
  }
  h.render()
  return h
}

test('real editor SSR exposes labelled names, bounded dates and decimal weights before any edits', () => {
  const h = harness()
  assert.match(h.html(), /aria-label="Edición rápida de actividades"/)
  assert.match(h.html(), /100% \/ 100%/)
  assert.equal(elements(h.tree(), node => node.type === 'input').length, 6)
  for (const activity of h.props.section.actividades) {
    for (const field of ['name', 'date', 'weight']) {
      const control = input(h, field, activity.url_token)
      assert.equal(elements(h.tree(), node => node.type === 'label' && node.props.htmlFor === control.props.id).length, 1)
      assert.equal(control.props.disabled, false)
    }
    assert.equal(input(h, 'date', activity.url_token).props.min, start)
    assert.equal(input(h, 'date', activity.url_token).props.max, end)
  }
  assert.equal(button(h, 'grading.saveActivities'), undefined)
  assert.deepEqual(h.mutations, [])
  assert.deepEqual(h.dirty, [false])
})

test('20/80 to 90/10 edits names, dates and weights locally and commits ALL rows once with public tokens and versions', () => {
  const h = harness(), original = structuredClone(h.props.section)
  change(h, 'name', '  Lectura revisada  ')
  change(h, 'date', '2026-02-28')
  change(h, 'weight', '90')
  assert.equal(button(h, 'grading.saveActivities').props.disabled, true, '90/80 exceeds the total only in the local draft')
  invokeSave(h)
  assert.deepEqual(h.mutations, [], 'No intermediate write is allowed while rebalancing the batch')
  assert.match(h.html(), new RegExp(messages['grading.batchWeightInvalid']))
  change(h, 'name', 'Proyecto final', 'activity/public-b')
  change(h, 'date', '2026-03-31', 'activity/public-b')
  change(h, 'weight', '10,0000', 'activity/public-b')
  assert.equal(button(h, 'grading.saveActivities').props.disabled, false)
  assert.deepEqual(h.mutations, [], 'Field changes never call the API')
  assert.deepEqual(h.props.section, original, 'Local edits cannot modify the query snapshot')
  invokeSave(h)
  assert.equal(h.mutations.length, 1)
  assert.deepEqual(h.mutations[0].body, {operacion: 'editar_lote', componente_token: 'component/public',
    preinforme_token: 'report/public', version: 11, actividades: [
      {actividad_token: 'activity/public-a', version: 5, nombre: 'Lectura revisada', fecha: '2026-02-28', peso: '90'},
      {actividad_token: 'activity/public-b', version: 8, nombre: 'Proyecto final', fecha: '2026-03-31', peso: '10.0000'},
    ]})
  assert.deepEqual(h.events, ['draft.afterSave'], 'The draft is retained until a successful response')
  assert.equal(h.draft().dirty, true)
  h.mutations[0].callbacks.onSuccess(); h.render()
  assert.deepEqual(h.events, ['draft.afterSave', 'draft.finished'])
  assert.equal(h.draft().dirty, false)
  assert.deepEqual(h.dirty, [false, true, false])
  assert.deepEqual(h.toasts, [['success', messages['grading.saved']]])
})

test('a name-only edit still sends every activity and an incomplete weighted total is explicitly savable', () => {
  const s = section()
  s.actividades[1].peso = '30'
  const h = harness({section: s})
  change(h, 'name', 'Lectura actualizada')
  assert.equal(elements(h.tree(), node => node.props.role === 'status' && textOf(node) === messages['grading.batchWeightPartial']).length, 1)
  assert.equal(button(h, 'grading.saveActivities').props.disabled, false)
  invokeSave(h)
  assert.deepEqual(h.mutations[0].body.actividades, [
    {actividad_token: 'activity/public-a', version: 5, nombre: 'Lectura actualizada', fecha: '2026-02-10', peso: '20'},
    {actividad_token: 'activity/public-b', version: 8, nombre: 'Proyecto', fecha: '2026-03-20', peso: '30'},
  ])
})

test('invalid names, out-of-period dates and invalid weights block both the save control and its handler', () => {
  for (const [field, value] of [['name', ' '], ['name', 'n'.repeat(161)], ['date', '2026-01-31'],
    ['date', '2026-04-01'], ['date', ''], ['weight', ''], ['weight', '0'], ['weight', '20.00001']]) {
    const h = harness()
    change(h, field, value)
    assert.equal(button(h, 'grading.saveActivities').props.disabled, true, `${field}=${value}`)
    invokeSave(h)
    assert.deepEqual(h.mutations, [], `${field}=${value}`)
    assert.deepEqual(h.events, [], 'Validation must run before preparing draft completion')
  }
})

test('cancel, draft reset and returning all fields to their original values clear edits without API writes', () => {
  for (const action of ['cancel', 'draft reset', 'revert fields']) {
    const h = harness()
    change(h, 'name', 'Nombre temporal')
    change(h, 'date', '2026-02-12')
    change(h, 'weight', '21')
    if (action === 'cancel') button(h, 'grading.cancel').props.onClick()
    else if (action === 'draft reset') h.draft().reset()
    else {
      change(h, 'name', 'Lectura guiada')
      change(h, 'date', '2026-02-10')
      change(h, 'weight', '20')
    }
    h.render()
    assert.equal(input(h, 'name').props.value, 'Lectura guiada', action)
    assert.equal(input(h, 'date').props.value, '2026-02-10', action)
    assert.equal(input(h, 'weight').props.value, '20', action)
    assert.equal(button(h, 'grading.saveActivities'), undefined, action)
    assert.deepEqual(h.mutations, [], action)
    assert.deepEqual(h.events, action === 'cancel' ? ['mutation.reset'] : [], action)
    assert.deepEqual(h.dirty, [false, true, false], action)
  }
})

test('simple average exposes no weight controls and omits peso from every batch item', () => {
  const s = section({modo: 'SIMPLE_AVERAGE', preinforme_token: null})
  s.actividades[0].peso = null
  const h = harness({section: s})
  assert.equal(elements(h.tree(), node => node.type === 'input').length, 4)
  change(h, 'name', 'Lectura sin ponderación')
  invokeSave(h)
  assert.deepEqual(h.mutations[0].body, {operacion: 'editar_lote', componente_token: 'component/public',
    preinforme_token: null, version: 11, actividades: [
      {actividad_token: 'activity/public-a', version: 5, nombre: 'Lectura sin ponderación', fecha: '2026-02-10'},
      {actividad_token: 'activity/public-b', version: 8, nombre: 'Proyecto', fecha: '2026-03-20'},
    ]})
  assert.ok(h.mutations[0].body.actividades.every(row => !Object.hasOwn(row, 'peso')))
})

test('read-only props disable fields and prevent saving an existing or restored draft', () => {
  const h = harness({editable: false})
  assert.ok(elements(h.tree(), node => node.type === 'input').every(node => node.props.disabled))
  assert.equal(h.draft().enabled, false)
  const restored = editOf(h.props.section)
  restored.rows[0].nombre = 'Borrador anterior'
  h.draft().restore(restored); h.render()
  assert.equal(button(h, 'grading.saveActivities').props.disabled, true)
  invokeSave(h)
  assert.deepEqual(h.mutations, [])
  const active = harness()
  change(active, 'name', 'Edición antes de perder permiso')
  active.render({editable: false})
  invokeSave(active)
  assert.deepEqual(active.mutations, [])
  assert.deepEqual(active.events, [])
})

test('a pending request cannot be submitted twice or discarded before its response', () => {
  const h = harness()
  change(h, 'name', 'Nombre pendiente')
  invokeSave(h)
  h.mutation.isPending = true; h.render()
  assert.equal(button(h, 'grading.saving').props.disabled, true)
  assert.equal(button(h, 'grading.cancel').props.disabled, true)
  assert.ok(elements(h.tree(), node => node.type === 'input').every(node => node.props.disabled))
  invokeSave(h)
  assert.equal(h.mutations.length, 1)
})

test('failed writes retain the draft, show the server error and allow retrying the same versioned batch', () => {
  const h = harness()
  change(h, 'name', 'Conservar al fallar')
  invokeSave(h)
  const error = new Error('Conflicto de versión: recarga las actividades')
  h.mutation.error = error
  h.mutations[0].callbacks.onError(error); h.render()
  assert.equal(input(h, 'name').props.value, 'Conservar al fallar')
  assert.equal(h.draft().dirty, true)
  assert.equal(elements(h.tree(), node => node.props.role === 'alert' && textOf(node) === error.message).length, 0, 'The server error appears once, in the toast')
  assert.deepEqual(h.events, ['draft.afterSave'])
  assert.deepEqual(h.toasts, [['error', error.message]])
  invokeSave(h)
  assert.equal(h.mutations.length, 2)
  assert.deepEqual(h.mutations[1].body, h.mutations[0].body)
})

test('field validation errors use the specific reason in one toast and retain the batch for retry', () => {
  const h = harness()
  change(h, 'name', 'Conservar validación')
  invokeSave(h)
  const error = Object.assign(new TestApiError('Datos inválidos'), {errors: {'actividades.0.fecha': ['La fecha está fuera del preinforme.']}})
  h.mutation.error = error
  h.mutations[0].callbacks.onError(error); h.render()
  assert.deepEqual(h.toasts, [['error', 'La fecha está fuera del preinforme.']])
  assert.equal(input(h, 'name').props.value, 'Conservar validación')
  assert.equal(h.draft().dirty, true)
  assert.equal(elements(h.tree(), node => node.props.role === 'alert').length, 0)
  invokeSave(h)
  assert.deepEqual(h.mutations[1].body, h.mutations[0].body)
})

const staleChanges = [
  ['activity version', s => {s.actividades[0].version++}],
  ['component version', s => {s.version++}],
  ['mode', s => {s.modo = 'SIMPLE_AVERAGE'}],
  ['removed activity', s => {s.actividades.pop()}],
  ['added activity', s => {s.actividades.push({...s.actividades[0], url_token: 'activity/new', nombre: 'Nueva'})}],
  ['replaced activity', s => {s.actividades[0].url_token = 'activity/replacement'}],
]
for (const [label, update] of staleChanges) {
  test(`a stale ${label} blocks overwrites, rejects recovery and cancel reloads the current snapshot`, () => {
    const h = harness()
    change(h, 'name', 'Mi cambio sin guardar')
    const saved = structuredClone(h.draft().value)
    assert.equal(h.draft().compatible(saved), true)
    const remote = structuredClone(h.props.section)
    update(remote)
    remote.actividades[0].nombre = 'Nombre remoto'
    h.render({section: remote})
    assert.equal(button(h, 'grading.saveActivities').props.disabled, true)
    assert.ok(elements(h.tree(), node => node.type === 'input').every(node => node.props.disabled))
    assert.equal(elements(h.tree(), node => node.props.role === 'alert' && textOf(node) === messages['grading.activitiesStale']).length, 1)
    assert.equal(input(h, 'name').props.value, 'Mi cambio sin guardar', 'Remote data must not silently replace local edits')
    assert.equal(h.draft().compatible(saved), false)
    invokeSave(h)
    assert.deepEqual(h.mutations, [])
    assert.deepEqual(h.events, [])
    button(h, 'grading.cancel').props.onClick(); h.render()
    assert.equal(elements(h.tree(), node => node.props.role === 'alert' && textOf(node) === messages['grading.activitiesStale']).length, 0)
    assert.equal(button(h, 'grading.saveActivities'), undefined)
    assert.deepEqual(elements(h.tree(), node => node.type === 'input' && node.props.id.startsWith('activity-name-')).map(node => node.props.value),
      remote.actividades.map(activity => activity.nombre))
    assert.deepEqual(h.mutations, [])
  })
}

test('compatible draft recovery preserves decimal text, and unmount releases the parent dirty guard', () => {
  const h = harness(), restored = editOf(h.props.section)
  restored.rows[0].peso = '33.3333'; restored.rows[1].peso = '66.6667'
  assert.equal(h.draft().compatible(null), false)
  assert.equal(h.draft().compatible(restored), true)
  h.draft().restore(restored); h.render()
  assert.equal(input(h, 'weight').props.value, '33.3333')
  assert.equal(h.draft().context, 'grade-activities:assignment/public:period/public:report/public')
  invokeSave(h)
  assert.deepEqual(h.mutations[0].body.actividades.map(row => row.peso), ['33.3333', '66.6667'])
  h.unmount()
  assert.deepEqual(h.dirty, [false, true, false])
})

test('refreshing a clean editor adopts current data and takes the next edit snapshot from the new versions', () => {
  const h = harness(), remote = structuredClone(h.props.section)
  remote.version = 12
  remote.actividades[0].version = 6
  remote.actividades[0].nombre = 'Nombre actualizado en el servidor'
  remote.actividades.reverse()
  h.render({section: remote})
  assert.equal(input(h, 'name').props.value, 'Nombre actualizado en el servidor')
  assert.equal(button(h, 'grading.saveActivities'), undefined)
  assert.deepEqual(h.mutations, [])
  change(h, 'name', 'Edición sobre la última versión')
  invokeSave(h)
  assert.equal(h.mutations.length, 1)
  assert.equal(h.mutations[0].body.version, 12)
  assert.deepEqual(h.mutations[0].body.actividades.map(row => [row.actividad_token, row.version]),
    [['activity/public-b', 8], ['activity/public-a', 6]])
})

// Inspect the real parent element and handlers; the child is exercised separately
// above so SSR here does not accidentally share the parent's mocked hook slots.
const QuickEditorSlot = () => null
const box = ({children}) => React.createElement('div', null, children)
const Modal = Object.assign(() => null, {Header: box, Title: box, Body: box, Footer: box})
function planillaHarness() {
  const hooks = hookHarness(), mutations = [], notices = [], navigations = []
  const data = {editable: true, requiere_motivo: false,
    permisos: {crear: true, editar: true, eliminar: true, configurar: true},
    secciones: [section(), section({componente_token: 'component/second', preinforme_token: 'report/second', nombre: 'Segundo preinforme', actividades: []})],
    usa_preinformes: true, periodo: {nombre: 'Periodo 1', fecha_inicio: start, fecha_fin: end, estado: 'abierto'},
    configuracion: {modo_asignatura: 'WEIGHTED_AVERAGE', valor_min: '0', valor_max: '5'},
    matriculas: [{id: 'student/public', url_token: 'student/public', estudiante: {name: 'Estudiante de prueba'}}],
    calificaciones: [], resultados: [], pagination: {matriculas: {total: 1}}}
  const mutation = {isPending: false, mutate: body => mutations.push(body)}
  const {PlanillaView} = evaluate(planillaJs, {
    '@/lib/api/client': {ApiError: TestApiError},
    react: {...hooks.react, useEffect() {}},
    'react-router-dom': {useParams: () => ({asignacionId: 'assignment/public', periodoId: 'period/public'}), useNavigate: () => value => navigations.push(value)},
    'react-bootstrap': {Modal},
    'react-intl': {useIntl: () => ({formatMessage})},
    '@/_metronic/helpers': {KTIcon: () => null},
    '@/lib/ui/toast': {useToast: () => ({show: message => notices.push(message)})},
    '@/lib/drafts/WorkDrafts': {useWorkDraft: () => ({notice: null})},
    '../gradeDecimal': decimals,
    '../useGradePreview': {useGradePreview: () => ({results: new Map(), pending: false})},
    './VisualChoice': {VisualChoice: () => null},
    './IndicadorWorkspace': {IndicadorWorkspace: () => null},
    './QuickActivityEditor': {QuickActivityEditor: QuickEditorSlot},
    '../evaluacion.api': {useCatalogoEvaluacion: () => ({data: {asignaciones: [], periodos: []}}),
      usePlanilla: () => ({data}), useGuardarNotas: () => mutation, useActividadPlanilla: () => mutation,
      useGuardarResultadoManualComponente: () => mutation},
  })
  const editor = PlanillaView()
  let tree
  const h = {data, mutations, notices, navigations, tree: () => tree,
    render() {tree = hooks.render(editor.type, editor.props); return tree},
    child: () => elements(tree, node => node.type === QuickEditorSlot)[0]}
  h.render()
  return h
}

test('Planilla mounts the quick editor for a selected nonmanual section with period bounds and permission guards', () => {
  const p = planillaHarness()
  assert.equal(p.child(), undefined)
  elements(p.tree(), node => node.type === 'button' && textOf(node) === 'Primer preinforme')[0].props.onClick(); p.render()
  assert.match(renderToStaticMarkup(p.tree()), /Periodo 1/)
  assert.deepEqual(p.child().props, {assignment: 'assignment/public', period: 'period/public', section: p.data.secciones[0],
    periodStart: start, periodEnd: end, editable: true, onDirtyChange: p.child().props.onDirtyChange})
  p.data.permisos.editar = false; p.render()
  assert.equal(p.child().props.editable, false)
  p.data.permisos.editar = true; p.data.editable = false; p.render()
  assert.equal(p.child().props.editable, false)
  p.data.editable = true
  p.data.secciones[0].modo = 'MANUAL'; p.render()
  assert.equal(p.child(), undefined)
  assert.deepEqual(p.mutations, [])
})

test('Planilla blocks section changes, navigation and grade editing while quick edits are dirty, then cancel releases them', () => {
  const p = planillaHarness()
  const select = label => elements(p.tree(), node => node.type === 'button' && textOf(node) === label)[0]
  select('Primer preinforme').props.onClick(); p.render()
  const h = harness(p.child().props)
  change(h, 'name', 'Edición activa'); p.render()
  assert.equal(p.child().props.editable, true, 'The dirty guard must leave its own editor usable')
  assert.equal(elements(p.tree(), node => node.type === 'input' && node.props['data-grade-row'] != null).length, 2)
  assert.ok(elements(p.tree(), node => node.type === 'input' && node.props['data-grade-row'] != null).every(node => node.props.disabled))
  select('Segundo preinforme').props.onClick(); p.render()
  assert.equal(p.child().props.section.preinforme_token, 'report/public')
  button(p, 'grading.back').props.onClick()
  assert.deepEqual(p.navigations, [])
  assert.deepEqual(p.notices, [messages['grading.saveActivitiesFirst'], messages['grading.saveActivitiesFirst']])
  button(h, 'grading.cancel').props.onClick(); h.render(); p.render()
  assert.ok(elements(p.tree(), node => node.type === 'input' && node.props['data-grade-row'] != null).every(node => !node.props.disabled))
  select('Segundo preinforme').props.onClick(); p.render()
  assert.equal(p.child().props.section.preinforme_token, 'report/second')
  button(p, 'grading.back').props.onClick()
  assert.deepEqual(p.navigations, ['/evaluacion/catalogo'])
  assert.deepEqual(p.mutations, [])
  assert.deepEqual(h.mutations, [])
})
