import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import vm from 'node:vm'

function engine() {
  const context = vm.createContext({crypto: {randomUUID}, structuredClone})
  context.window = context
  for (const name of ['font-catalog','model','proposal-model','layout-model','field-guide','page-layout','report-engine','canvas-engine','canvas-objects']) {
    vm.runInContext(readFileSync(new URL(`../public/bulletin-editor/${name}.js`, import.meta.url), 'utf8'), context)
  }
  return context
}

test('Shift and rectangle selection include only hit objects and complete groups, with no native text selection', () => {
  const {ReportCanvasObjects: objects} = engine()
  const nodes = [{id:'a',x:20,y:20,w:80,h:20,groupKey:'one'}, {id:'b',x:20,y:70,w:80,h:20,groupKey:'one'}, {id:'c',x:200,y:20,w:80,h:20}, {id:'hidden',x:20,y:20,w:80,h:20,hidden:true}]
  assert.deepEqual([...objects.select(nodes, [], 'a', false)], ['a','b'])
  assert.deepEqual([...objects.select(nodes, ['a','b'], 'c', true)], ['a','b','c'])
  assert.deepEqual([...objects.select(nodes, ['a','b','c'], 'b', true)], ['c'])
  assert.deepEqual([...objects.inRect(nodes, {x:10,y:10,w:100,h:35})], ['a','b'])
  const bounds = objects.bounds(nodes.slice(0,2))
  const moved = objects.transform(nodes.slice(0,2), bounds, {...bounds,x:120,y:40}, {w:816,h:1056})
  assert.equal(moved[1].y - moved[0].y, 50)
})

test('group membership and bound school logo survive import without flattening student data', () => {
  const {ReportPrototypeModel: model,ReportCanvasObjects: objects,ReportPrototypeEngine: report} = engine()
  const doc = model.documentDesign('blank'), nodes = [model.block('image',44,44,{source:'school-logo'}),model.block('text',200,44,{text:'{{school}}'})]
  objects.group(nodes,'header-group');doc.pages[0].blocks=nodes
  const clean = model.validate(JSON.parse(JSON.stringify(doc)))
  assert.ok(clean.pages[0].blocks.every(n=>n.groupKey==='header-group'))
  assert.equal(clean.pages[0].blocks[0].source,'school-logo')
  clean.institution={name:'Colegio de prueba',logo:'data:image/png;base64,AABB'}
  assert.match(report.content(clean.pages[0].blocks[0],clean,report.context(clean)),/data:image\/png;base64,AABB/)
  assert.ok(objects.canUngroup(clean.pages[0].blocks))
  objects.ungroup(clean.pages[0].blocks)
  assert.ok(clean.pages[0].blocks.every(n=>!n.groupKey))
})

test('selected-only sample data renders indicators while unrelated fields remain placeholders', () => {
  const {ReportPrototypeModel:model,ReportCanvasEngine:canvas} = engine()
  const doc=model.documentDesign('blank');doc.layout='canvas'
  const header=model.block('header'),student=model.block('student',44,200),indicators=model.block('indicators',44,350)
  doc.pages[0].blocks=[header,student,indicators]
  const layout=canvas.design(doc,'fields',()=>40,{[header.id]:'values',[indicators.id]:'values'})
  assert.match(layout.pages[0].blocks[0]._html,/Colegio/)
  assert.doesNotMatch(layout.pages[0].blocks[0]._html,/field-chip/)
  assert.match(layout.pages[0].blocks[1]._html,/\[Nombre del estudiante\]/)
  assert.match(layout.pages[0].blocks[2]._html,/Comprende textos narrativos/)
  assert.doesNotMatch(layout.pages[0].blocks[2]._html,/\[Indicadores de aprendizaje\]/)
  assert.equal(doc.pages[0].blocks[1].text,'')
})

test('ungrouped header parts still produce a repeated bound header for continuation pages', () => {
  const {ReportPrototypeModel:model,ReportPrototypeEngine:report,ReportCanvasEngine:canvas} = engine()
  const doc=model.documentDesign('blank');doc.layout='canvas'
  doc.pages[0].blocks=[model.block('text',44,44,{text:'{{school}}',headerPart:true,repeat:true,h:30}),model.block('image',500,44,{source:'school-logo',headerPart:true,repeat:true,w:60,h:60}),model.block('table',44,150,{h:80})]
  const header=report.repeatingHeader(doc)
  assert.equal(header._repeatParts.length,2)
  const measure=(html)=>html.includes('<table')?100:60
  const emitted=canvas.emit(doc,'numeric','values',measure)
  assert.ok(emitted.pages.length>1)
  assert.ok(emitted.pages.slice(1).some(page=>page.blocks.some(n=>n._repeatParts)))
})
