import assert from 'node:assert/strict'

export function calendarNotificationsFixture({user,base,catalog}) {
  const state={student:false,fail:false,records:[],updates:[],reads:0,
    event:{...base,estado:'borrador',publicado_en:null,version:1,origen:'evento',enviar_correo:false,puede_editar:true,archivos:[],eliminado:false}}
  user.permissions.push('eventos.gestionar','eventos.publicar_asignados','eventos.publicar_institucional')
  user.institution={name:'Colegio de prueba',plan:{name:'Estándar',features:['nucleo','academico','comunicacion_basica']}}
  const page=data=>({data,meta:{current_page:1,last_page:1,total:data.length}})
  return {state,async middleware(req,res,next){
    const path=new URL(req.url,'http://localhost').pathname
    const reply=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
    if(path==='/api/me'&&state.student)return reply({user:{...user,roles:['estudiante'],permissions:[]},csrf_token:'smoke-csrf'})
    if(path==='/api/notification-records')return reply(page(state.records.slice().reverse()))
    if(path==='/api/notification-updates'){state.reads++;return reply(page(state.updates.slice().reverse()))}
    if(!path.startsWith('/api/eventos'))return next()
    if(req.method==='GET'){
      if(path.endsWith('/catalogo'))return reply({data:{...catalog,es_rector:!state.student,puede_crear:!state.student,puede_institucional:!state.student}})
      if(path.endsWith('/resumen'))return reply({data:state.event.eliminado?[]:[{fecha:state.event.fecha,total:1,titulo_unico:state.event.titulo,marcas:[{categoria:'actividad',estado:state.event.estado,total:1}]}]})
      if(path.endsWith('/tareas'))return reply({data:[],last_page:1})
      if(path.endsWith('/flujo'))return reply({data:state.event.eliminado?[]:[state.event],next_cursor:null})
      return reply({data:{...state.event,puede_editar:!state.student&&!state.event.eliminado}})
    }
    let raw='';for await(const chunk of req)raw+=chunk
    const body=raw?JSON.parse(raw):{}
    const action=path.endsWith('/publicar')?'publish':req.method==='DELETE'?'destroy':req.method==='POST'?'store':'update'
    const fail=state.fail;state.fail=false
    res.setHeader('X-Notification-Record','r'.repeat(24))
    state.records.push({token:String(state.records.length).padStart(24,'r'),event:'calendar.event.'+action,
      variant:fail?'danger':action==='destroy'?'deleted':action==='update'?'updated':'success',subject:fail?'':body.titulo||state.event.titulo,message:null,created_at:new Date().toISOString()})
    if(fail)return reply({message:'Datos inválidos',errors:{titulo:['Revisa el título del evento.']}},422)
    if(action==='publish')state.event={...state.event,estado:'publicado',publicado_en:new Date().toISOString(),version:state.event.version+1}
    else if(action==='destroy')state.event={...state.event,eliminado:true}
    else state.event={...state.event,...body,version:state.event.version+1}
    if(action==='publish'||action==='destroy'||action==='update'&&state.event.estado==='publicado'){
      if(action==='destroy')state.updates=[]
      state.updates.push({token:String(state.updates.length).padStart(24,'n'),event:'calendar.event.'+({publish:'published',destroy:'deleted',update:'updated'}[action]),
        resource_title:state.event.titulo,subject:'',group:'Primero / 01A',grade:null,year:null,institutional:false,event_date:state.event.fecha,event_time:'08:00–09:00',
        url:'/comunicacion/eventos?evento='+state.event.url_token,created_at:new Date().toISOString()})
    }
    return reply({data:action==='destroy'?null:state.event},action==='store'?201:200)
  }}
}

export async function runCalendarNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const {state}=fixture
  const click=async text=>evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim().replaceAll('+','').trim()===${JSON.stringify(text)})?.click()`)
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(e=>e.click())`)
  const fill=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const open=async tab=>{const bounds=await evaluate(`(()=>{const r=document.querySelector('[aria-controls="kt_menu_notifications"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,desktop:innerWidth>=992}})()`)
    if(bounds.desktop)await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:bounds.x,y:bounds.y})
    else await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications')?.classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-${tab}').click()`)}
  await navigate('/comunicacion/eventos',state.event.titulo)
  assert.equal(state.reads,0,'No eager notification polling.')
  await click('Nuevo evento');await until(`!!document.querySelector('#event-title')`)
  await fill('event-title','Feria del grupo');await fill('event-description','Proyectos de ciencias')
  await evaluate(`(()=>{const e=document.querySelector('#event-category');e.value='actividad';e.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.event-group-picker input').click()})()`)
  state.fail=true
  await click('Guardar borrador');await until(`!!document.querySelector('.app-toast--danger')`)
  assert.ok(await evaluate(`!!document.querySelector('#event-title')`),'Validation keeps the modal and typed content.')
  assert.match(await evaluate(`document.querySelector('.app-toast--danger').textContent`),/Revisa el título/)
  assert.ok(await evaluate(`Number(getComputedStyle(document.querySelector('.app-toast-region')).zIndex)>Number(getComputedStyle(document.querySelector('.modal')).zIndex)`))
  await screenshot('calendar-validation-toast')
  await clear();await click('Guardar borrador');await until(`!document.querySelector('#event-title')&&!!document.querySelector('.app-toast--success')`)
  assert.equal(state.updates.length,0)
  await clear();await click('Editar');await until(`!!document.querySelector('#event-title')`)
  await click('Publicar evento');await until(`document.querySelector('.modal.show .badge')?.textContent==='Publicado'`)
  assert.equal(state.updates.length,1)
  await click('Cerrar');await clear();await open('logs');await until(`document.querySelectorAll('[data-notification-record]').length===4`)
  assert.match(await evaluate(`document.querySelector('#notifications-panel').textContent`),/Evento publicado|Borrador de evento creado/)
  state.student=true
  await navigate('/comunicacion/eventos',state.event.titulo);await open('updates')
  await until(`document.querySelectorAll('[data-notification-update]').length===1`)
  assert.match(await evaluate(`document.querySelector('#notifications-panel').textContent`),/Evento en mi calendario/)
  await screenshot('calendar-novedades-desktop')
  await evaluate(`document.querySelector('[data-notification-update]').click()`)
  await until(`!!document.querySelector('.modal.show')&&location.search.includes('evento=')`)
  assert.match(await evaluate(`document.querySelector('.modal.show').textContent`),/Feria del grupo/)
  assert.equal(await evaluate(`!!document.querySelector('.modal.show .btn-light-danger')`),false)
  await click('Cerrar')
  state.student=false
  await navigate('/comunicacion/eventos?evento='+state.event.url_token,state.event.titulo)
  await until(`!!document.querySelector('.modal.show')`);await click('Eliminar')
  await until(`!!document.querySelector('.modal.show .alert-warning')`)
  await evaluate(`document.querySelector('.modal.show .btn-danger').click()`)
  await until(`!document.querySelector('.modal.show')`)
  assert.equal(state.updates[0].event,'calendar.event.deleted')
  state.student=true
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await navigate('/comunicacion/eventos','Eventos recientes');await open('updates')
  await until(`!!document.querySelector('[data-notification-update]')`)
  assert.ok(await evaluate(`(()=>{const r=document.querySelector('#kt_menu_notifications').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()`))
  await screenshot('calendar-novedades-mobile')
  await evaluate(`document.querySelector('[data-notification-update]').click()`)
  await until(`document.querySelector('.modal.show')?.textContent.includes('Este evento fue eliminado')`)
  await screenshot('calendar-deleted-event')
  assert.deepEqual(errors,[])
  console.log('PASS: calendar actor records, draft silence, publication, student news without Aula, same-route deep link, deletion, mobile and modal validation toast.')
}
