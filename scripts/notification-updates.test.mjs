import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

const require=createRequire(import.meta.url)
const root='../src/_metronic/layout/components/header/'
const copy=JSON.parse(fs.readFileSync(new URL(root+'notificationUpdates.messages.json',import.meta.url),'utf8'))
const source=fs.readFileSync(new URL(root+'NotificationUpdates.tsx',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
const token='x'.repeat(24),route='/evaluacion/aula/recursos/'+token
function render(query,locale='es'){
  let queryOptions,total
  const module={exports:{}}
  const mocks={react:{...React,useEffect:effect=>effect()},'react/jsx-runtime':require('react/jsx-runtime'),
    '@tanstack/react-query':{useQuery:options=>{queryOptions=options;return query}},
    'react-intl':{useIntl:()=>({locale,formatDate:()=> '6 nov 2026',formatTime:()=> '10:00'})},
    'react-router-dom':{Link:({to,children,...props})=>React.createElement('a',{href:to,...props},children)},
    '@/lib/api/client':{api:{get:path=>path}},'./notificationUpdates.messages.json':{default:copy},'./notification-updates.css':{}}
  new Function('require','module','exports',js)(id=>{assert.ok(Object.hasOwn(mocks,id),id);return mocks[id]},module,module.exports)
  const tree=module.exports.default({scope:'school:student',page:2,setPage(){},onTotal:value=>{total=value},onOpen(){}})
  return {html:renderToStaticMarkup(tree),queryOptions,total}
}
const notice=(event='aula.resource.published',url=route)=>({token,event,url,resource_title:'Lectura <script>no</script>',
  subject:'Ciencias sociales',group:'04A',grade:'Cuarto',year:'2026',created_at:'2026-11-06T15:00:00Z'})
const query=rows=>({data:{data:rows,meta:{current_page:2,last_page:3,total:41}},isPending:false,isError:false,isFetching:false})

test('resource updates include the course and group and navigate only to an opaque internal resource',()=>{
  const {html,total,queryOptions}=render(query([notice()]))
  assert.match(html,/Se publicó un nuevo recurso/)
  assert.match(html,/Ciencias sociales · Cuarto \/ 04A · 2026/)
  assert.match(html,/Lectura &lt;script&gt;no&lt;\/script&gt;/)
  assert.ok(html.includes(`href="${route}"`))
  assert.equal(total,41)
  assert.deepEqual(queryOptions.queryKey,['notification-updates','school:student',2])
  assert.equal(queryOptions.queryFn(),'/notification-updates?page=2')
})
test('grade notices link to the resource without carrying a grade or student identity in the notification',()=>{
  const html=render(query([notice('aula.grade.saved')])).html
  assert.match(html,/calificación o revisión disponible/)
  assert.ok(html.includes(`href="${route}"`))
  assert.doesNotMatch(html,/Observación|retroalimentación confidencial/)
})
test('unsafe, external and numeric resource destinations never become links',()=>{
  for(const url of ['https://example.test','//example.test','javascript:alert(1)','/evaluacion/aula/recursos/123',route+'?next=https://example.test']){
    assert.doesNotMatch(render(query([notice('aula.resource.updated',url)])).html,/href=/,url)
  }
})
test('attendance notices are translated, dated and link to attendance; rejections are red',()=>{
  const events=[['absent','absent'],['late','late'],['justification.requested','justificationRequested'],
    ['justification.forwarded','justificationForwarded'],['justification.approved','justificationApproved'],['justification.rejected','justificationRejected']]
  for(const locale of ['es','en'])for(const [event,key] of events){
    const row={...notice('attendance.'+event,'/academico/asistencia'),resource_title:'',attendance_date:'2026-11-06',attendance_time:'07:00–07:50'}
    const html=render(query([row]),locale).html
    assert.ok(html.includes(copy[locale][key]))
    assert.match(html,/07:00–07:50/)
    assert.match(html,/href="\/academico\/asistencia"/)
    if(event.endsWith('rejected'))assert.match(html,/bg-light-danger/)
    assert.doesNotMatch(render(query([{...row,url:'/academico/asistencia?student=123'}])).html,/href=/)
  }
})
test('calendar notices identify events, translate actions and accept only the exact opaque calendar destination',()=>{
  for(const locale of ['es','en'])for(const [action,key] of [['published','eventPublished'],['updated','eventUpdated'],['deleted','eventDeleted']]){
    const url='/comunicacion/eventos?evento='+token
    const row={...notice('calendar.event.'+action,url),event_date:'2026-11-06',event_time:'08:00–09:00',institutional:true}
    const html=render(query([row]),locale).html
    assert.ok(html.includes(copy[locale][key]))
    assert.ok(html.includes(copy[locale].sourceCalendar))
    assert.ok(html.includes(copy[locale].institutional))
    assert.ok(html.includes(`href="${url}"`))
    assert.match(html,/data-source="calendar"/)
    assert.match(html,/08:00–09:00/)
    for(const bad of [url+'&redirect=evil','/comunicacion/eventos?evento=12','/academico/asistencia','https://evil.test']){
      assert.doesNotMatch(render(query([{...row,url:bad}]),locale).html,/href=/)
    }
  }
})
test('Aula, attendance and calendar use distinct source labels and visual classes',()=>{
  const html=render(query([notice(),{...notice('attendance.absent','/academico/asistencia'),token:'a'},
    {...notice('calendar.event.published','/comunicacion/eventos?evento='+token),token:'b'}])).html
  for(const source of ['aula','attendance','calendar'])assert.ok(html.includes(`data-source="${source}"`))
  for(const key of ['sourceAula','sourceAttendance','sourceCalendar'])assert.ok(html.includes(copy.es[key]))
})
for(const locale of ['es','en']){
  test(`updates support ${locale} empty, loading, error and publication labels`,()=>{
    assert.deepEqual(Object.keys(copy[locale]).sort(),Object.keys(copy.es).sort())
    assert.ok(render(query([]),locale).html.includes(copy[locale].empty))
    assert.ok(render({isPending:true},locale).html.includes(copy[locale].loading))
    assert.ok(render({isPending:false,isError:true},locale).html.includes(copy[locale].error))
    for(const [event,key] of [['aula.resource.published','published'],['aula.resource.updated','updated'],['aula.grade.saved','graded']]){
      assert.ok(render(query([notice(event)]),locale).html.includes(copy[locale][key]))
    }
  })
}
