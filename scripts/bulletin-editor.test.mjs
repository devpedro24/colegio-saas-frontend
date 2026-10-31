import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import vm from 'node:vm'

function engine() {
  const context = vm.createContext({crypto: {randomUUID}, structuredClone, console})
  context.window = context
  for (const name of ['font-catalog', 'model', 'proposal-model', 'layout-model', 'field-guide', 'page-layout', 'report-engine', 'canvas-engine']) {
    vm.runInContext(readFileSync(new URL(`../public/bulletin-editor/${name}.js`, import.meta.url), 'utf8'), context)
  }
  return context
}

test('print tables retain configured widths on headers and cells, including expanded annual periods', () => {
  const {ReportPrototypeModel: model, ReportPrototypeEngine: report} = engine()
  const doc = model.documentDesign('blank', 'final')
  const node = model.block('table', 40, 100, {table: {...model.tableDefaults(), columns: [
    {key: 'subject', label: 'Materia', width: 60},
    {key: 'periods', label: 'P', width: 20},
    {key: 'grade', label: 'Final', width: 20},
  ]}})
  const context = report.context(doc), parts = report.tableParts(node, doc, context)
  const html = report.tableHTML(parts, parts.units.slice(0, 1), context)
  const widths = [...html.matchAll(/<(?:th|td)\b[^>]*style="width:([\d.]+)%"/g)].map(match => Number(match[1]))
  assert.deepEqual(widths, [60, 5, 5, 5, 5, 20, 60, 5, 5, 5, 5, 20])
})

test('fitting edited text shrinks stale boxes, follows wrapping and leaves tables and shapes sized by the user', () => {
  const {ReportPrototypeModel: model, ReportCanvasEngine: canvas} = engine()
  const doc = model.documentDesign('blank'), title = model.block('title')
  assert.equal(title.padding, 0)
  assert.equal(title.lineHeight, 1.2)
  title.h = 300
  const measure = (_, node) => Math.ceil(node.text.length / (node.w / node.fontSize)) * node.fontSize * node.lineHeight + 2
  canvas.fitText(title, doc, measure)
  assert.ok(title.h < 35)
  const first = title.h
  title.fontSize = 40
  canvas.fitText(title, doc, measure)
  assert.ok(title.h > first)
  title.w = 150
  canvas.fitText(title, doc, measure)
  assert.ok(title.h > 90)
  title.text = 'Sol'
  canvas.fitText(title, doc, measure)
  assert.equal(title.h, 50)
  for (const type of ['table', 'grades', 'image', 'rectangle']) {
    const node = model.block(type, 40, 40, {h: 180})
    canvas.fitText(node, doc, () => 25)
    assert.equal(node.h, 180)
  }
})

test('structured text slots preserve automatic fields through validation and escape typed HTML', () => {
  const {ReportPrototypeModel: model, ReportPrototypeEngine: report, ReportFieldGuide: fields} = engine()
  const doc = model.documentDesign('blank')
  const student = model.block('student', 44, 44, {content: {student: fields.internalize('ESTUDIANTE: [Nombre del estudiante]\nCurso: [Grado y grupo]')}})
  const header = model.block('header', 44, 120, {content: {
    headerTitle: fields.internalize('INFORME DE [Nombre del colegio]'),
    headerBody: '<script>alert(1)</script>\n[Año lectivo]',
  }})
  doc.pages[0].blocks = [student, header]
  const clean = model.validate(JSON.parse(JSON.stringify(doc)))
  assert.equal(clean.pages[0].blocks[0].content.student, 'ESTUDIANTE: {{student}}\nCurso: {{group}}')
  const ctx = report.context(clean)
  const html = report.content(clean.pages[0].blocks[0], clean, ctx, 'values')
  assert.match(html, /ESTUDIANTE:/)
  assert.match(html, /Lucía/)
  assert.doesNotMatch(html, /\[Nombre del estudiante\]/)
  const masthead = report.content(clean.pages[0].blocks[1], clean, ctx, 'values')
  assert.match(masthead, /data-edit-content="headerTitle"/)
  assert.match(masthead, /data-edit-content="headerBody"/)
  assert.match(masthead, /&lt;script&gt;/)
  assert.doesNotMatch(masthead, /<script>/)
})

test('footer resize handles keep the opposite edges fixed and respect the page boundaries', () => {
  const {ReportPageLayout: page} = engine()
  const box = {x: 40, y: 50, w: 180, h: 60}, size = {w: 816, h: 1056}
  for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    const next = page.transformBox(box, handle, 12, 10, size)
    assert.equal(next.x, handle.includes('w') ? 52 : 40)
    assert.equal(next.y, handle.includes('n') ? 60 : 50)
    assert.equal(next.x + next.w, handle.includes('e') ? 232 : 220)
    assert.equal(next.y + next.h, handle.includes('s') ? 120 : 110)
  }
  const limited = page.transformBox(box, 'nw', 1000, 1000, size)
  assert.equal(limited.w, 50)
  assert.equal(limited.h, 22)
  const outside = page.transformBox(box, 'se', 2000, 2000, size)
  assert.equal(outside.x + outside.w, size.w)
  assert.equal(outside.y + outside.h, size.h)
})

test('footer guides align with page numbering and can be disabled', () => {
  const {ReportPageLayout: page} = engine()
  const box = {x: 44, y: 990, w: 350, h: 30}, target = {x: 560, y: 992, w: 180, h: 30}
  const aligned = page.alignBox(box, [target], {w: 816, h: 1056})
  assert.equal(aligned.box.y, 992)
  assert.ok(aligned.guides.some(guide => guide.axis === 'y' && guide.at === 992))
  const off = page.alignBox(box, [target], {w: 816, h: 1056}, false)
  assert.equal(off.box.y, 990)
  assert.equal(off.guides.length, 0)
  const baseline = page.alignBox(box, [{...target, textY: 1001}], {w: 816, h: 1056}, true, 8)
  assert.equal(baseline.box.y + 8, 1001)
  assert.ok(baseline.guides.some(guide => guide.axis === 'y' && guide.at === 1001))
  assert.equal(baseline.guides.find(guide => guide.axis === 'y').kind, 'baseline')
})

test('a footer guide compares writing baselines instead of differently sized text boxes', () => {
  const {ReportPageLayout: page} = engine()
  const box = {x: 44, y: 950, w: 350, h: 70}
  const number = {x: 600, y: 948, w: 170, h: 22, textY: 964}
  // Bottom edges can coincide while the first text lines remain far apart.
  const different = page.alignBox(box, [number], {w: 816, h: 1056}, true, 42)
  assert.equal(different.guides.filter(guide => guide.kind === 'baseline').length, 0)
  const close = page.alignBox({...box, y: 924}, [number], {w: 816, h: 1056}, true, 42)
  assert.equal(close.box.y + 42, number.textY)
})

test('baseline markers exist only in editable page elements and never in printed output', () => {
  const {ReportPrototypeModel: model, ReportPageLayout: page} = engine()
  const doc = model.documentDesign('blank')
  const editable = page.render(doc, {fields: {}}, 0, 1, true)
  assert.equal((editable.match(/class="sheet-baseline"/g) || []).length, 2)
  assert.ok(!page.render(doc, {fields: {}}, 0, 1, false).includes('sheet-baseline'))
})

test('resized footer height survives validation, rendering and pagination reserve', () => {
  const {ReportPrototypeModel: model, ReportPageLayout: page} = engine()
  const doc = model.documentDesign('blank')
  doc.sheet = model.normalizeSheet({footer: {height: 90, bottom: 20}})
  const clean = model.validate(JSON.parse(JSON.stringify(doc)))
  assert.equal(clean.sheet.footer.height, 90)
  assert.ok(page.render(clean, {fields: {}}, 0, 1).includes('height:90px;box-sizing:border-box'))
  assert.ok(page.bottom(clean, {fields: {}}, () => 15) <= model.pageSize(clean).h - 119)
  assert.equal(model.normalizeSheet({}).footer.height, null)
})

test('automatic scale values render as separate escaped rows in preview and official reports', () => {
  const {ReportPrototypeModel: model, ReportPrototypeEngine: report} = engine()
  const doc = model.documentDesign('blank'), block = model.block('scale', 44, 44)
  const sample = report.content(block, doc, report.context(doc))
  assert.equal((sample.match(/class="scale-range"/g) || []).length, 4)
  assert.ok(sample.includes('Desempeño Superior'))
  const actual = report.content(block, doc, {actual: true, visual: false, fields: {
    scaleLegend: '4.0 – 5.0: Desempeño Alto\n0.0 – 3.9: <b>Bajo</b>',
  }})
  assert.equal((actual.match(/class="scale-range"/g) || []).length, 2)
  assert.ok(actual.includes('&lt;b&gt;Bajo&lt;/b&gt;'))
  assert.ok(!actual.includes('Desempeño Superior'))
  const fields = report.content(block, doc, report.context(doc), 'fields')
  assert.ok(fields.includes('[Escala de valoración del SIEE]'))
})

test('school preview uses saved SIEE ranges instead of the standalone sample bands', () => {
  const {ReportPrototypeModel: model, ReportPrototypeEngine: report} = engine()
  const doc = model.documentDesign('blank')
  const ranges = [{nombre: 'Inicial', desde: '0.0', hasta: '3.9'}, {nombre: 'Avanzado', desde: '4.0', hasta: '5.0'}]
  doc.institution = {name: 'School', scaleLegend: '4.0 – 5.0: Desempeño Avanzado\n0.0 – 3.9: Desempeño Inicial', performanceRanges: ranges}
  const preview = report.context(doc)
  assert.equal(preview.fields.scaleLegend, doc.institution.scaleLegend)
  assert.equal(report.performance(4.5, preview.performanceRanges), 'Avanzado')
  doc.institution.scaleLegend = ''
  doc.institution.performanceRanges = []
  assert.equal(report.context(doc).fields.scaleLegend, '')
  assert.equal(report.performance(4.5, report.context(doc).performanceRanges), '—')
})

test('friendly fields keep Spanish aliases after switching the interface language', () => {
  const {ReportPrototypeModel: model, ReportFieldGuide: fields} = engine()
  model.fields.student = 'Student name'
  assert.equal(fields.internalize('[Nombre del estudiante] / [Student name]'), '{{student}} / {{student}}')
  assert.equal(fields.humanize('{{student}}'), '[Student name]')
})

test('actual records expand beyond the two authoring rows without losing subjects', () => {
  const {ReportPrototypeModel: model, ReportCanvasEngine: canvas} = engine()
  const doc = model.documentDesign('blank')
  doc.layout = 'canvas'
  doc.pages[0].blocks = [model.block('table', 44, 44, {w: 650, h: 140})]
  doc.runtime = {actual: true, periodCount: 1, fields: {}, rows: Array.from({length: 75}, (_, i) => ({
    key: `subject-${i}`, subject: `Subject ${i}`, display: '4.0', indicators: [], hours: 2, periodDisplay: ['4.0'],
  })), areaRows: [], scaleRows: []}
  const measure = html => html.includes('<table') ? Math.max(40, (html.match(/<tr\b/g)?.length ?? 0) * 40) : 30
  const result = canvas.emit(doc, null, 'values', measure)
  assert.ok(result.pages.length > 1)
  const html = result.pages.flatMap(page => page.blocks.map(block => block._html)).join('')
  for (let i = 0; i < 75; i++) assert.equal(html.split(`data-row-key="subject-${i}"`).length - 1, 1)
  assert.ok(!html.includes('Lucía Torres'))
})

test('official visual result uses its configured label instead of a demo numeric band', () => {
  const {ReportPrototypeModel: model, ReportPrototypeEngine: report} = engine()
  const doc = model.documentDesign('blank'), block = model.block('table', 44, 44)
  const context = {actual: true, visual: true, periodCount: 1, fields: {}, areaRows: [], rows: [
    {key: 'subject', subject: 'Matemáticas', display: 'Logro alcanzado', performance: 'Logro alcanzado', emoji: '🙂', indicators: [], hours: 2},
  ]}
  const html = report.content(block, doc, context)
  assert.ok(html.includes('Logro alcanzado'))
  assert.ok(html.includes('🙂'))
  assert.ok(!html.includes('Superior'))
})
