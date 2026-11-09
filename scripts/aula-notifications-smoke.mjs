import assert from 'node:assert/strict'
import {structureNotificationsFixture} from './structure-notifications-smoke.mjs'

export function aulaNotificationsFixture({fixtures,user}) {
  const base=structureNotificationsFixture(),{state}=base,t=c=>c.repeat(24),aula=fixtures['/api/aula/'+t('y')].data
  user.institution={name:'Colegio de prueba',plan:{name:'Premium',features:['nucleo','academico','aula','preinformes']}}
  user.permissions.push('aula.contenido.crear','aula.contenido.editar','aula.contenido.publicar','aula.contenido.eliminar','aula.contenido.archivar','aula.configurar')
  aula.permisos.archivos=true;aula.permisos.planilla=false;aula.puede_restaurar=true
  state.updates=[];state.writes=[];state.updateReads=0;state.current='teacher';state.aula=aula;state.user=user
  const page=(rows,n)=>({data:rows.slice((n-1)*20,n*20),meta:{current_page:n,last_page:Math.max(1,Math.ceil(rows.length/20)),total:rows.length}})
  const visible=r=>!r.eliminado&&r.visible_estudiantes&&r.estado==='publicado'&&aula.secciones.find(s=>s.token===r.seccion_token)?.visible_estudiantes
  state.announce=(r,event)=>state.updates.push({token:String(state.updates.length+1).padStart(24,'U'),event,
    resource_title:r.titulo,subject:'Matemáticas',group:'01A',grade:'Primero',year:'2026',url:'/evaluacion/aula/recursos/'+r.token,created_at:new Date().toISOString()})
  const resource=token=>aula.secciones.flatMap(s=>s.recursos).find(r=>r.token===token)
  return {state,middleware(req,res,next){
    const url=new URL(req.url,'http://localhost'),p=url.pathname
    const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
    if(p==='/api/notification-updates'){state.updateReads++;return send(page([...state.updates].reverse(),Number(url.searchParams.get('page')||1)))}
    if(!p.startsWith('/api/aula/'))return base.middleware(req,res,next)
    if(req.method==='GET'){
      if(p==='/api/aula/'+t('y'))return send({data:{...aula,estudiante:state.current==='student',puede_gestionar:state.current!=='student',permisos:state.current==='student'?{}:aula.permisos}})
      const match=p.match(/^\/api\/aula\/recursos\/([\w-]{24})$/)
      if(match){const row=resource(match[1]);return send({data:{...fixtures['/api/aula/recursos/'+t('z')].data,...row,aula_token:t('y'),adjuntos:[],
        estudiante:state.current==='student',puede_gestionar:state.current!=='student',puede_adjuntar:false}})}
      if(p.endsWith('/planilla'))return send({data:{componentes:[],requiere_preinforme:false}})
      return next()
    }
    if(p.endsWith('/abrir'))return send({data:{progreso:{estado:'completado'},aula_token:t('y'),resumen:{}}})
    let body='';req.on('data',c=>{body+=c});req.on('end',()=>{
      const input=JSON.parse(body||'{}'),success=state.successNext;state.successNext=false;state.writes.push({path:p,input})
      const section=p.includes('/secciones/'),sectionCreate=p.endsWith('/secciones'),create=req.method==='POST'&&!p.endsWith('/restaurar'),configuration=p.endsWith('/configuracion')
      const module=configuration?'configuration':sectionCreate||(section&&!p.endsWith('/recursos'))?'section':'resource'
      const action=configuration?'save':req.method==='DELETE'?'destroy':p.endsWith('/restaurar')?'restore':p.endsWith('/archivar')?'archive':create?'store':'update'
      const key=String(state.records.length+1).padStart(24,'R'),message='Revisa los datos del Aula antes de guardar.'
      state.records.push({token:key,event:`aula.${module}.${action}`,variant:success?(action==='destroy'?'deleted':action==='store'?'success':'updated'):'danger',subject:'',message:success?null:message,created_at:new Date().toISOString()})
      res.setHeader('X-Notification-Record',key)
      if(!success)return send({message:'Datos inválidos',errors:{titulo:[message]}},422)
      let data={guardado:true}
      if(configuration)Object.assign(fixtures['/api/aula/configuracion'].data,input)
      else if(module==='section'){
        const s=create?{token:t('n'),recursos:[],periodo:'Primer período',orden:3}:aula.secciones.find(s=>p.includes(s.token))
        const was=s.visible_estudiantes;Object.assign(s,input)
        if(create)aula.secciones.push(s)
        if(req.method==='DELETE')s.eliminado=true
        if(p.endsWith('/restaurar'))s.eliminado=false
        if(!was&&s.visible_estudiantes)s.recursos.filter(visible).forEach(r=>state.announce(r,'aula.resource.published'))
        data=s
      }else{
        const r=create?{token:t('v'),seccion_token:p.split('/')[4],adjuntos:[],version:0}:resource(p.split('/')[4])
        const was=visible(r),before=JSON.stringify({...r,version:0});Object.assign(r,input,{version:r.version+1})
        if(create)aula.secciones.find(s=>s.token===r.seccion_token).recursos.push(r)
        if(req.method==='DELETE')r.eliminado=true
        if(p.endsWith('/restaurar'))r.eliminado=false
        if(p.endsWith('/archivar'))Object.assign(r,{estado:'archivado',visible_estudiantes:false})
        const now=visible(r)
        if(now&&!was)state.announce(r,'aula.resource.published')
        else if(now&&was&&before!==JSON.stringify({...r,version:0}))state.announce(r,'aula.resource.updated')
        data={...fixtures['/api/aula/recursos/'+t('z')].data,...r,aula_token:t('y')}
      }
      send({data})
    })
  }}
}

export async function runAulaNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const {state}=fixture,t=c=>c.repeat(24),route='/evaluacion/aula/'+t('y')
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(e=>e.click())`)
  const click=async text=>evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled).click()`)
  const change=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const select=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  const submit=()=>evaluate(`document.querySelector('.aula-editor-page form').requestSubmit()`)
  const failed=async action=>{await clear();await action();await until(`!!document.querySelector('.app-toast--danger')`)
    assert.match(await evaluate(`document.querySelector('.app-toast--danger .app-toast-message').textContent`),/Revisa los datos del Aula/)}
  const success=async(action,variant='updated')=>{await clear();state.successNext=true;await action();await until(`!!document.querySelector('.app-toast--${variant}')`);await clear()}
  await navigate(route,'Contenido del aula')
  assert.equal(state.updateReads,0,'Updates are lazy and not fetched while the bell is closed.')
  await click('+ Nueva sección');await until(`!!document.querySelector('.aula-inline-form input[required]')`)
  await change('.aula-inline-form input[required]','Sección de prueba')
  await select('.aula-inline-form select',t('j'))
  await evaluate(`document.querySelector('.aula-inline-form input[type=checkbox]').click()`)
  await failed(submit);assert.equal(await evaluate(`document.querySelector('.aula-inline-form input[required]').value`),'Sección de prueba')
  await success(submit,'success');await until(`!document.querySelector('.aula-editor-page')`)
  assert.equal(state.updates.length,0,'Sections create actor history but no resource update.')
  await evaluate(`document.querySelector('.aula-section-actions button[aria-label^="Editar sección"]').click()`)
  await until(`!!document.querySelector('.aula-inline-form input[required]')`)
  await change('.aula-inline-form input[required]','Semana 1 editada');await failed(submit);await success(submit)
  await until(`!document.querySelector('.aula-editor-page')`)
  await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Agregar recurso')).click()`)
  await until(`!!document.querySelector('input[placeholder="Título del recurso"]')`)
  await change('input[placeholder="Título del recurso"]','Lectura de prueba persistente')
  await failed(submit);assert.equal(await evaluate(`document.querySelector('input[placeholder="Título del recurso"]').value`),'Lectura de prueba persistente')
  await success(submit,'success');await until(`location.pathname.includes('/recursos/')`)
  assert.equal(state.updates.length,0,'Hidden resource creates a record, never a recipient notice.')
  await click('Editar recurso');await until(`!!document.querySelector('.aula-resource-form')`)
  await evaluate(`(()=>{const e=[...document.querySelectorAll('.aula-resource-form label')].find(e=>e.textContent.includes('Visible para estudiantes')).querySelector('input');if(!e.checked)e.click()})()`)
  await failed(submit);assert.equal(state.updates.length,0,'Failed publication does not create recipient updates.')
  await success(submit);await until(`location.pathname.includes('/recursos/')`)
  assert.equal(state.updates.length,1)
  await click('Editar recurso');await until(`!!document.querySelector('input[placeholder="Título del recurso"]')`)
  await change('input[placeholder="Título del recurso"]','Lectura visible actualizada')
  await success(submit);await until(`location.pathname.includes('/recursos/')`)
  assert.equal(state.updates.at(-1).event,'aula.resource.updated')
  const resource=state.aula.secciones[0].recursos.find(r=>r.token===t('v'))
  state.announce(resource,'aula.grade.saved')
  const open=async(tab='updates')=>{const bounds=await evaluate(`(()=>{const r=document.querySelector('[aria-controls="kt_menu_notifications"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,desktop:innerWidth>=992}})()`)
    if(bounds.desktop)await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:bounds.x,y:bounds.y})
    else await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications')?.classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-${tab}').click()`)}
  await open();await until(`document.querySelectorAll('[data-notification-update]').length===3`)
  assert.match(await evaluate(`document.querySelector('[data-testid="notification-updates"]').textContent`),/Lectura visible actualizada/)
  await screenshot('aula-notifications-desktop')
  const reads=state.updateReads
  state.announce(resource,'aula.resource.updated')
  await evaluate(`import('/src/lib/realtime.ts').then(m=>m.notifyLocalChange({resource:'aula-grade',scope:'tenant'}))`)
  await until(`document.querySelectorAll('[data-notification-update]').length===4`)
  assert.ok(state.updateReads>reads,'A content change refreshes the open feed without F5.')
  await evaluate(`document.querySelector('[data-notification-update]').click()`)
  await until(`location.pathname==='/evaluacion/aula/recursos/${t('v')}'&&!document.querySelector('#kt_menu_notifications.show')`)
  console.log('PASS: Aula section/resource records, hidden/published/updated notices, lazy fetch, live refresh and resource link.')
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await navigate('/evaluacion/aula/recursos/'+t('v'),'Lectura visible actualizada')
  await open();await until(`document.querySelectorAll('[data-notification-update]').length===4`)
  assert.ok(await evaluate(`(()=>{const r=document.querySelector('#kt_menu_notifications').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()`))
  await screenshot('aula-notifications-mobile')
  await evaluate(`document.querySelector('[data-notification-update]').click()`)
  await until(`!document.querySelector('#kt_menu_notifications.show')`)
  await open('logs');await until(`document.querySelectorAll('[data-notification-record]').length>0`)
  assert.doesNotMatch(await evaluate(`document.querySelector('#notifications-panel').textContent`),/event\.aula|scope\.aula/)
  await screenshot('aula-records-mobile')
  assert.deepEqual(errors,[])
  console.log('PASS: persistent resource updates and actor records after reload, mobile dropdown, independent tabs.')
}
