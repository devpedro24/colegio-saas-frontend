import assert from 'node:assert/strict'
import {structureNotificationsFixture} from './structure-notifications-smoke.mjs'

export function studyPlanNotificationsFixture() {
  const base=structureNotificationsFixture(), {state}=base, {rows}=state, token=c=>c.repeat(24)
  const area={url_token:token('A'),ano_lectivo_token:token('a'),nombre:'Ciencias',estado:'activo',descripcion:'Área de prueba'}
  const subject={url_token:token('M'),ano_lectivo_token:token('a'),nombre:'Biología',area_token:area.url_token,area,nivel_token:null,estado:'activo',intensidad_horaria:4}
  const assignment={url_token:token('D'),ano_lectivo_token:token('a'),grupo_token:token('c'),grupo:rows.grupos[0],materia_token:subject.url_token,materia:subject,docente_token:token('f'),docente:rows.docentes[0]}
  const session={url_token:token('S'),ano_lectivo_token:token('a'),asignacion_token:assignment.url_token,grupo_token:token('c'),grupo:rows.grupos[0],materia_token:subject.url_token,materia:subject,docente_token:token('f'),docente:rows.docentes[0],dia:'lunes',bloque_horario_token:null,bloque:null,hora_inicio:'07:00:00',hora_fin:'08:00:00',espacio_fisico_token:null,espacio:null}
  rows.materias=[subject];rows.areas=[area];rows.espacios=rows['espacios-fisicos']
  const meta={current_page:1,last_page:1,per_page:1000,total:1,from:1,to:1}
  return {state,middleware(req,res,next) {
    const url=new URL(req.url,'http://localhost'), plan=url.pathname.startsWith('/api/plan-estudios/')
    const schedule=/^\/api\/(horarios|asignaciones)(\/[^/]+)?$/.test(url.pathname)
    const send=(body,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body))}
    if(!plan&&!schedule) return base.middleware(req,res,next)
    const kind=plan?(url.pathname.includes('/areas')?'area':'materia'):url.pathname.includes('/asignaciones')?'assignment':'schedule'
    const item={area,materia:subject,assignment,schedule:session}[kind]
    if(req.method==='GET') {
      if(plan) return send({data:[item],meta})
      return send({data:{can_manage:true,anos:[{url_token:token('a'),nombre:'2026',estado:'en_curso'}],grupos:rows.grupos,docentes:rows.docentes,materias:[subject],areas:[area],bloques:[],espacios:rows.espacios,asignaciones:[assignment],sesiones:[session],pagination:{asignaciones:meta}}})
    }
    let body=''
    req.on('data',chunk=>{body+=chunk})
    req.on('end',()=>{
      const input=JSON.parse(body||'{}'), success=state.successNext
      assert.ok(!Object.keys(input).some(k=>k==='id'||k.endsWith('_id')),'Writes use public tokens.')
      state.successNext=false
      const action=url.pathname.endsWith('/asignaciones/grupo')?'assignGroup':req.method==='DELETE'?'destroy':req.method==='PUT'?'update':'store'
      const variant=success?(action==='destroy'?'deleted':action==='update'||action==='assignGroup'?'updated':'success'):'danger'
      const message=req.method==='DELETE'?'No se puede eliminar: el registro tiene información asociada.':'Revisa la configuración del plan de estudios.'
      const key=String(state.records.length+1).padStart(24,'z')
      state.records.push({token:key,event:`plan.${kind}.${action}`,variant,subject:success?item.nombre||'Biología · 01A':'',message:success?null:message,created_at:new Date().toISOString()})
      res.setHeader('X-Notification-Record',key)
      send(success?{data:{...item,...input}}:{message:'Datos inválidos',errors:{nombre:[message]}},success?(action==='store'?201:200):422)
    })
  }}
}

export async function runStudyPlanNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(e=>e.click())`)
  const close=async()=>{await evaluate(`document.querySelector('.modal.show .modal-footer .btn-light').click()`);await until(`!document.querySelector('.modal-backdrop')`);await clear()}
  const submit=()=>evaluate(`(()=>{const f=document.querySelector('.modal.show form');f.noValidate=true;f.requestSubmit()})()`)
  const values=()=>evaluate(`JSON.stringify([...document.querySelectorAll('.modal.show input,.modal.show select')].map(e=>e.value))`)
  const change=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
  const choose=async(selector)=>{
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`)
    await until(`document.querySelector(${JSON.stringify(selector)}).options.length>1`)
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=[...e.options].find(o=>o.value&&!o.disabled).value;e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  }
  const overlay=async()=>{
    await until(`!!document.querySelector('.app-toast--danger')`)
    await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`)
    assert.equal(await evaluate(`(()=>{const e=document.querySelector('.app-toast--danger'),r=e.getBoundingClientRect();return !!document.querySelector('.modal.show')&&!e.closest('[aria-hidden="true"]')&&!!document.elementFromPoint(r.left+20,r.top+20)?.closest('.app-toast')&&r.left>=0&&r.right<=innerWidth})()`),true)
  }
  const fail=async(action=submit)=>{await clear();const before=await values();await action();await overlay();assert.equal(await values(),before,'Errors preserve the entered values.')}
  const succeed=async(action=submit,variant='success')=>{
    fixture.state.successNext=true;await clear();await action()
    await until(`!document.querySelector('.modal.show')&&!!document.querySelector('.app-toast--${variant}')`);await clear()
    await until(`!document.querySelector('.modal-backdrop')`)
  }
  await navigate('/academico/plan-estudios?tab=areas','Plan de estudios')
  await until(`document.querySelectorAll('section tbody').length===2`)
  for(let section=0;section<2;section++){
    const root=`document.querySelectorAll('section')[${section}]`
    await evaluate(`${root}.querySelector('button.btn-primary').click()`)
    await until(`!!document.querySelector('.modal.show form')`)
    await change('.modal.show input[type="text"]','Nombre de prueba')
    if(section===1){
      await choose('.modal.show select')
      await choose('.modal.show .row select')
    }
    await fail();await succeed()
    await evaluate(`${root}.querySelector('tbody button[title^="Editar"]').click()`)
    await until(`!!document.querySelector('.modal.show form')`)
    await fail()
    if(section===1) await screenshot('study-plan-subject-error-over-modal')
    await succeed(submit,'updated')
    await evaluate(`${root}.querySelector('tbody button[title^="Eliminar"]').click()`)
    await until(`!!document.querySelector('.modal.show .btn-danger')`)
    const remove=()=>evaluate(`document.querySelector('.modal.show .btn-danger').click()`)
    await fail(remove);await succeed(remove,'deleted')
    console.log('PASS:',section?'materias':'áreas','create/edit/delete feedback, modal retention, success closure.')
  }
  await navigate('/academico/plan-estudios?tab=asignaciones','Plan de estudios')
  await until(`!!document.querySelector('tbody button[title^="Editar"]')`)
  await evaluate(`document.querySelector('.schedule-toolbar-actions .btn-primary').click()`)
  await until(`!!document.querySelector('.modal.show form')`)
  await choose('.modal.show select[name="grupo_id"]')
  await choose('.modal.show select[name="materia_id"]')
  await choose('.modal.show select[name="docente_id"]')
  await fail();await succeed()
  await evaluate(`document.querySelector('tbody button[title^="Editar"]').click()`)
  await until(`!!document.querySelector('.modal.show form')`)
  await fail();await succeed(submit,'updated')
  await evaluate(`document.querySelector('tbody button[title^="Eliminar"]').click()`)
  await until(`!!document.querySelector('.modal.show .btn-danger')`)
  const remove=()=>evaluate(`document.querySelector('.modal.show .btn-danger').click()`)
  await fail(remove);await succeed(remove,'deleted')
  await evaluate(`document.querySelector('.schedule-toolbar-actions .btn-light-primary').click()`)
  await until(`document.querySelectorAll('.modal.show select').length===2`)
  await choose('.modal.show select')
  await choose('.modal.show select[aria-label="Docente"]')
  const bulk=()=>evaluate(`document.querySelector('.modal.show .modal-footer .btn-primary').click()`)
  await fail(bulk);await succeed(bulk,'updated')
  console.log('PASS: single/group teaching assignments.')

  const timetable='/academico/plan-estudios?tab=horarios&grupo='+ 'c'.repeat(24)
  await navigate(timetable,'Plan de estudios')
  await until(`!!document.querySelector('.schedule-session')`)
  await evaluate(`document.querySelector('.schedule-toolbar-actions .btn-primary').click()`)
  await until(`!!document.querySelector('.modal.show form')`)
  await choose('.modal.show select[name="materia_id"]')
  await change('#schedule-start','07:00');await change('#schedule-end','08:00')
  await fail();await succeed()
  await evaluate(`document.querySelector('[data-schedule-actions-button]').click()`)
  await until(`!!document.querySelector('[data-schedule-actions-menu]')`)
  await evaluate(`document.querySelector('[data-schedule-actions-menu] button').click()`)
  await until(`!!document.querySelector('.modal.show form')`)
  await fail();await succeed(submit,'updated')
  await evaluate(`document.querySelector('[data-schedule-actions-button]').click()`)
  await until(`!!document.querySelector('[data-schedule-actions-menu]')`)
  await evaluate(`document.querySelectorAll('[data-schedule-actions-menu] button')[2].click()`)
  await until(`!!document.querySelector('.modal.show .btn-danger')`)
  await fail(remove);await succeed(remove,'deleted')
  // Copying is a direct timetable operation, so feedback must also work without a modal.
  await evaluate(`document.querySelector('[data-schedule-actions-button]').click()`)
  await until(`!!document.querySelector('[data-schedule-actions-menu]')`)
  await evaluate(`document.querySelectorAll('[data-schedule-actions-menu] button')[1].click()`)
  await until(`!!document.querySelector('[data-schedule-copy-banner]')`)
  fixture.state.successNext=true
  await evaluate(`(()=>{const e=document.querySelector('[data-schedule-day="martes"]');e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=e.getBoundingClientRect(),x=r.left+r.width/2;for(let y=200;y<innerHeight-60;y+=20){if(document.elementFromPoint(x,y)?.closest('[data-schedule-day]')===e){e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y}));return}}throw new Error('No visible timetable drop point')})()`)
  await until(`!!document.querySelector('.app-toast--success')`);await clear()
  console.log('PASS: timetable create/edit/delete and direct copy.')
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await navigate('/academico/plan-estudios?tab=asignaciones','Plan de estudios')
  await until(`!!document.querySelector('tbody button[title^="Editar"]')`)
  await evaluate(`document.querySelector('tbody button[title^="Editar"]').click()`)
  await until(`!!document.querySelector('.modal.show form')`)
  await fail();await screenshot('study-plan-assignment-error-mobile');await close()
  const openLogs=async()=>{
    await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications').classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-logs').click()`)
    await until(`document.querySelectorAll('[data-notification-record]').length===20`)
    assert.ok(await evaluate(`document.querySelector('[data-testid="notification-records"]').textContent.includes('Plan de estudios')`))
  }
  await openLogs();await screenshot('study-plan-notification-records-mobile')
  await navigate('/academico/plan-estudios?tab=asignaciones','Plan de estudios');await openLogs()
  assert.deepEqual(errors,[])
  console.log('PASS: mobile overlay, bell history, reload persistence; no browser errors.')
}
