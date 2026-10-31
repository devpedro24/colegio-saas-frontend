import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import vm from 'node:vm'

function engine() {
  const c=vm.createContext({crypto:{randomUUID},structuredClone});c.window=c
  for(const name of ['font-catalog','model','proposal-model','layout-model','field-guide','page-layout','report-engine','canvas-engine','design-library','template-pages'])
    vm.runInContext(readFileSync(new URL(`../public/bulletin-editor/${name}.js`,import.meta.url),'utf8'),c)
  return c
}
const measure=html=>html.includes('<table')?30+(html.match(/<tr\b/g)?.length||0)*32:html.includes('scale-range')?24+(html.match(/scale-range/g)?.length||0)*20:40

test('adding pages preserves the entire existing document and remaps assets and groups',()=>{
  const {ReportPrototypeModel:M,ReportTemplatePages:T}=engine()
  const doc=M.documentDesign('blank');doc.layout='canvas';doc.pages[0].blocks=[M.block('text',40,40,{text:'Trabajo sin guardar'})]
  doc.assets={same:'data:image/png;base64,AAAA'}
  const source=M.documentDesign('blank');source.layout='canvas';source.assets={same:'data:image/png;base64,BBBB'}
  source.design={header:'band',signature:'rector',table:'striped',headerInk:'#FFFFFF'}
  source.pages[0].blocks=[M.block('image',40,40,{asset:'same',groupKey:'group'}),M.block('text',220,40,{text:'{{school}}',groupKey:'group'})]
  const before=JSON.stringify(doc),templateBefore=JSON.stringify(source),result=T.insert(doc,source,0,false,measure)
  assert.equal(JSON.stringify(doc),before)
  assert.equal(JSON.stringify(source),templateBefore)
  assert.equal(result.doc.id,doc.id)
  assert.equal(JSON.stringify(result.doc.pages[0]),JSON.stringify(doc.pages[0]))
  assert.equal(result.doc.pages.length,2)
  const nodes=result.doc.pages[1].blocks
  assert.notEqual(nodes[0].id,source.pages[0].blocks[0].id)
  assert.notEqual(nodes[0].groupKey,'group');assert.equal(nodes[0].groupKey,nodes[1].groupKey)
  assert.equal(result.doc.assets[nodes[0].asset],source.assets.same)
  assert.equal(result.doc.assets.same,doc.assets.same)
  const clean=M.validate(result.doc)
  assert.equal(clean.pages[1].blocks[0].appearance.header,'band')
  assert.equal(clean.pages[1].blocks[0].appearance.signature,'rector')
})

test('replacing a page retains other pages and keeps the template paper and orientation',()=>{
  const {ReportPrototypeModel:M,ReportTemplatePages:T,ReportPrototypeEngine:R}=engine()
  const doc=M.documentDesign('blank');doc.pages.push({id:'keep',blocks:[M.block('text',40,40,{text:'Segunda página'})]})
  const source=R.reference('reference-primary');source.orientation='landscape'
  const result=T.insert(doc,source,0,true,measure)
  assert.equal(result.doc.format,doc.format);assert.equal(result.doc.orientation,doc.orientation)
  assert.equal(result.doc.pages.at(-1).id,'keep')
  assert.equal(result.doc.pages.at(-1).blocks[0].text,'Segunda página')
  assert.equal(result.doc.pages[0].orientation,'landscape');assert.equal(result.doc.pages[0].format,source.format)
})

test('page insertion respects limits while allowing designs of either report type',()=>{
  const {ReportPrototypeModel:M,ReportTemplatePages:T}=engine()
  const doc=M.documentDesign('blank');doc.pages=Array.from({length:12},()=>({id:M.uid(),blocks:[]}))
  const source=M.documentDesign('blank'),before=JSON.stringify(doc)
  assert.throws(()=>T.insert(doc,source,0,false,measure),/12 páginas/)
  assert.equal(JSON.stringify(doc),before)
  source.scope='final';assert.throws(()=>T.insert(doc,source,0,false,measure),/12 páginas/)
  const one=M.documentDesign('blank'),result=T.insert(one,source,0,true,measure)
  assert.equal(result.doc.scope,one.scope);assert.equal(result.doc.pages.length,1)
})

test('expanded legends reflow only following blocks; manual overlaps and columns stay free',()=>{
  const {ReportPrototypeModel:M,ReportCanvasEngine:C}=engine()
  const doc=M.documentDesign('blank');doc.layout='canvas'
  const legend=M.block('scale',44,44,{w:300,h:50}),following=M.block('text',44,110,{w:300,h:25,text:'Materias'}),aside=M.block('text',500,110,{w:200,h:25}),overlap=M.block('text',44,60,{w:300,h:25})
  doc.pages[0].blocks=[legend,following,aside,overlap]
  const before=JSON.stringify(doc),layout=C.design(doc,'values',html=>html.includes('scale-legend')?150:25)
  const nodes=layout.pages.flatMap(p=>p.blocks),find=id=>nodes.find(n=>n.id===id)
  assert.equal(find(following.id).y,210)
  assert.equal(find(aside.id).y,110)
  assert.equal(find(overlap.id).y,60)
  assert.equal(JSON.stringify(doc),before)
})

test('all base annual templates have compact authoring rows and no overlapping results in full preview',()=>{
  const {ReportPrototypeModel:M,ReportPrototypeEngine:R,ReportCanvasEngine:C,ReportDesignLibrary:L}=engine()
  const docs=[M.documentDesign('annual','final'),R.reference('reference-final'),...L.catalog.filter(s=>s.scope==='final').map(s=>L.build(s,{name:'Colegio de prueba'}))]
  for(const input of docs){
    const doc=C.prepare(input,measure)
    for(const mode of ['fields','values']){
      const pages=C.design(doc,mode,measure).pages
      for(const page of pages){const nodes=page.blocks.filter(n=>!n.hidden).sort((a,b)=>a.y-b.y)
        for(let i=1;i<nodes.length;i++)assert.ok(nodes[i].y>=nodes[i-1].y+nodes[i-1].h-1,`${doc.name}: ${mode} authoring overlap`)
      }
    }
    const html=C.fragment(doc.pages[0].blocks.find(n=>['grades','table'].includes(n.type)),doc,'fields')
    assert.ok(!html.includes('Valoración del período'))
    assert.match(html,/\[P1\]/)
    const emitted=C.emit(doc,null,'values',measure)
    for(const page of emitted.pages){const nodes=page.blocks.filter(n=>!n._continuation).sort((a,b)=>a.y-b.y)
      for(let i=1;i<nodes.length;i++)assert.ok(nodes[i].y>=nodes[i-1].y+nodes[i-1].h-1,`${doc.name}: emitted overlap`)
    }
  }
})

test('a full results table pushes promotion and signatures after its last continuation page',()=>{
  const {ReportPrototypeModel:M,ReportCanvasEngine:C}=engine()
  const doc=M.documentDesign('blank');doc.layout='canvas';doc.scope='final'
  const table=M.block('table',44,100,{w:700,h:80}),promotion=M.block('promotion',44,194,{h:30}),signature=M.block('signature',44,238,{h:60})
  doc.pages[0].blocks=[M.block('header',44,30,{h:56}),table,promotion,signature]
  doc.runtime={actual:true,periodCount:4,fields:{promotion:'Promoción de prueba'},rows:Array.from({length:75},(_,i)=>({key:`subject-${i}`,subject:`Materia ${i}`,display:'4.0',indicators:[],hours:2,periodDisplay:['4.0','4.0','4.0','4.0']})),areaRows:[],scaleRows:[]}
  const layout=C.emit(doc,null,'values',measure),size=M.pageSize(doc)
  const results=layout.pages.flatMap((page,i)=>page.blocks.map(n=>({...n,absoluteY:i*size.h+n.y})))
  const lastRow=results.filter(n=>n.id===table.id).at(-1),notice=results.find(n=>n.id===promotion.id),sign=results.find(n=>n.id===signature.id)
  assert.ok(layout.pages.length>1)
  assert.ok(notice.absoluteY>=lastRow.absoluteY+lastRow.h)
  assert.ok(sign.absoluteY>=notice.absoluteY+notice.h)
  for(let i=0;i<75;i++)assert.equal(results.map(n=>n._html).join('').split(`data-row-key="subject-${i}"`).length-1,1)
})

test('page controls insert immediately after, reorder whole pages, remap duplicates and protect locked content',()=>{
  const {ReportPrototypeModel:M,ReportTemplatePages:T}=engine()
  const doc=M.documentDesign('blank');doc.pages[0].title='Primera';doc.pages[0].blocks=[M.block('text',44,44,{text:'Conservar',groupKey:'one'})]
  doc.pages.push({id:'second',title:'Segunda',format:'a4',orientation:'landscape',blocks:[]})
  const inserted=T.update(doc,0,'add');assert.equal(inserted.doc.pages[2].id,'second')
  assert.equal(inserted.index,1)
  const copy=T.update(doc,0,'copy');assert.notEqual(copy.doc.pages[1].blocks[0].id,doc.pages[0].blocks[0].id)
  assert.notEqual(copy.doc.pages[1].blocks[0].groupKey,'one')
  const moved=T.update(doc,1,'up');assert.equal(moved.doc.pages[0].id,'second')
  const locked=T.update(doc,0,'lock').doc
  assert.throws(()=>T.update(locked,0,'delete'),/Desbloquea/)
  assert.throws(()=>T.insert(locked,M.documentDesign('blank'),0,true,measure),/Desbloquea/)
  const unlocked=T.update(locked,0,'lock').doc
  assert.equal(T.update(unlocked,0,'delete').doc.pages.length,1)
  assert.equal(doc.pages.length,2)
})

test('mixed page metadata survives validation; hidden pages stay editable and never enter report output',()=>{
  const {ReportPrototypeModel:M,ReportCanvasEngine:C}=engine()
  const doc=M.documentDesign('blank');doc.layout='canvas';doc.pages[0].title='Vertical'
  doc.pages[0].blocks=[M.block('text',44,44,{text:'Primera {{page}} de {{pages}}'})]
  doc.pages.push({id:'hidden',title:'No publicar',hidden:true,blocks:[M.block('text',44,44,{text:'CONFIDENCIAL'})]},
    {id:'horizontal',title:'Horizontal',format:'a4',orientation:'landscape',locked:true,blocks:[M.block('text',850,44,{w:200,h:35,text:'Última {{page}} de {{pages}}'})]})
  const clean=M.validate(doc),design=C.design(clean,'values',measure),output=C.emit(clean,null,'values',measure)
  assert.equal(design.pages.length,3);assert.ok(design.pages[1].hidden)
  assert.equal(clean.pages[2].blocks[0].x,850)
  assert.equal(output.pages.length,2)
  assert.equal(output.pages[1].size.w,1123);assert.equal(output.pages[1].size.h,794)
  assert.ok(!output.pages.flatMap(p=>p.blocks).some(n=>n._html.includes('CONFIDENCIAL')))
  assert.match(output.pages[1].blocks[0]._html,/data-bound-field="page">2<\/span>/)
  assert.match(output.pages[1].blocks[0]._html,/data-bound-field="pages">2<\/span>/)
  clean.pages.forEach(p=>p.hidden=true);assert.throws(()=>C.emit(clean,null,'values',measure),/al menos una página/)
})
