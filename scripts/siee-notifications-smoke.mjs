import assert from 'node:assert/strict'
import {structureNotificationsFixture} from './structure-notifications-smoke.mjs'

export function sieeNotificationsFixture() {
  const base=structureNotificationsFixture(), {state}=base, token=c=>c.repeat(24)
  const year=token('a'), grade=state.rows.grados[0]
  state.rows.grados.push({...grade,url_token:token('H'),nombre:'Segundo'})
  const area={url_token:token('R'),nombre:'Ciencias',estado:'activo'}
  const subjects=['Biología','Física'].map((nombre,i)=>({url_token:token(i?'V':'S'),nombre,estado:'activo',nivel_token:null,area_token:area.url_token,area}))
  state.rows.materias=subjects;state.rows.areas=[area]
  const scale={url_token:token('E'),ano_lectivo_token:year,nombre:'Escala numérica',tipo:'numerica',valor_min:1,valor_max:5,decimales:1,nivel_educativo:null,
    desempenos:[{nombre:'Bajo',desde:'1.0',hasta:'2.9'},{nombre:'Básico',desde:'3.0',hasta:'5.0'}]}
  const method={url_token:token('T'),calculo_nota:'promedio_simple',nota_minima:3,ambito:'materia'}
  state.configuration={usar_areas:true,modo_area:'WEIGHTED_AVERAGE',modo_asignatura:'SIMPLE_AVERAGE',modo_anual:'SIMPLE_AVERAGE',
    redondeo:'HALF_DOWN',precision_calculo:8,recuperacion:'REPLACE',mostrar_final:true,etiqueta_final:'Definitiva anual',escala_token:scale.url_token,metodo_token:method.url_token}
  state.curriculum=[{grado_token:grade.url_token,materia_token:subjects[0].url_token,area_token:area.url_token,peso_area:'100',
    grado_nombre:grade.nombre,materia_nombre:subjects[0].nombre,area_nombre:area.nombre}]
  state.writes=[]
  const detail=()=>({editable:true,curriculo_editable:true,configuracion:state.configuration,escalas:[scale],metodos:[method],curriculo:state.curriculum,grados:state.rows.grados,materias:subjects,areas:[area]})
  const page=data=>({data,meta:{current_page:1,per_page:1000,last_page:1,total:data.length,from:1,to:data.length}})
  return {state,middleware(req,res,next){
    const url=new URL(req.url,'http://localhost'), path=url.pathname
    const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
    if(path==='/api/anos-lectivos')return send({data:[{url_token:year,nombre:'2026',estado:'en_curso'}]})
    if(path==='/api/config/escalas'&&req.method==='GET')return send({data:[scale]})
    const isScale=path===`/api/config/escalas/${scale.url_token}`
    if(!path.startsWith(`/api/siee/${year}`)&&!isScale)return base.middleware(req,res,next)
    if(req.method==='GET')return send(path.endsWith('/curriculo')?page(state.curriculum):{data:detail()})
    let body='';req.on('data',chunk=>{body+=chunk});req.on('end',()=>{
      const input=JSON.parse(body||'{}'),success=state.successNext;state.successNext=false
      state.writes.push({path,input})
      const event=isScale?'parameters.scale.update':path.endsWith('/masivo')?'siee.curriculum.saveBulk':path.endsWith('/curriculo')?'siee.curriculum.save':'siee.configuration.update'
      const message='Revisa los datos del SIEE o del currículo por grado.'
      const key=String(state.records.length+1).padStart(24,'s')
      state.records.push({token:key,event,variant:success?'updated':'danger',subject:'',message:success?null:message,created_at:new Date().toISOString()})
      res.setHeader('X-Notification-Record',key)
      if(!success)return send({message:'Datos inválidos',errors:{[isScale?'desempenos.0.nombre':path.endsWith('/masivo')?'items.0.peso_area':path.endsWith('/curriculo')?'peso_area':'etiqueta_final']:[message]}},422)
      if(isScale)Object.assign(scale,input)
      else if(event.endsWith('.update'))Object.assign(state.configuration,input)
      else for(const item of input.items||[input]){
        const existing=state.curriculum.find(row=>row.grado_token===item.grado_token&&row.materia_token===item.materia_token)
        const names={grado_nombre:state.rows.grados.find(row=>row.url_token===item.grado_token).nombre,materia_nombre:subjects.find(row=>row.url_token===item.materia_token).nombre,area_nombre:area.nombre}
        if(existing)Object.assign(existing,item,names,{area_token:area.url_token})
        else state.curriculum.push({...item,...names,area_token:area.url_token})
      }
      send({data:isScale?scale:event.endsWith('saveBulk')?{guardados:input.items.length}:detail()})
    })
  }}
}

export async function runSieeNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(e=>e.click())`)
  const button=async(text,scope='document')=>evaluate(`[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`)
  const change=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const updated=async()=>{await until(`!!document.querySelector('.app-toast--updated')`);await clear()}
  const failed=async(modal=false)=>{
    await until(`!!document.querySelector('.app-toast--danger')`)
    assert.ok(await evaluate(`document.querySelector('.app-toast-message').textContent.includes('Revisa los datos del SIEE')`))
    if(modal){
      await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`)
      assert.equal(await evaluate(`(()=>{const e=document.querySelector('.app-toast--danger'),r=e.getBoundingClientRect();return !!document.querySelector('.modal.show')&&!e.closest('[aria-hidden="true"]')&&!!document.elementFromPoint(r.left+20,r.top+20)?.closest('.app-toast')&&r.left>=0&&r.right<=innerWidth})()`),true)
    }
  }
  const snapshot=()=>evaluate(`JSON.stringify([...document.querySelectorAll('.modal.show input')].map(e=>[e.value,e.checked]))`)
  const modalSave=()=>evaluate(`document.querySelector('.modal.show .modal-footer .btn-primary').click()`)
  const modalSucceed=async()=>{await clear();fixture.state.successNext=true;await modalSave();await until(`!document.querySelector('.modal-backdrop')`);await updated()}
  await navigate('/academico/siee','Configuración SIEE')
  await until(`!!document.querySelector('tbody input[aria-label^="Peso"]')`)
  await change('fieldset input[type="text"]','Cierre de prueba')
  await button('Guardar SIEE');await failed()
  assert.equal(await evaluate(`document.querySelector('fieldset input[type="text"]').value`),'Cierre de prueba')
  await clear();fixture.state.successNext=true;await button('Guardar SIEE');await updated()
  assert.equal(fixture.state.configuration.etiqueta_final,'Cierre de prueba')
  const weight='tbody input[aria-label^="Peso"]'
  await until(`!document.querySelector(${JSON.stringify(weight)}).disabled`)
  await evaluate(`document.querySelector(${JSON.stringify(weight)}).focus()`)
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65})
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65})
  await command('Input.insertText',{text:'33'})
  await evaluate(`new Promise(r=>requestAnimationFrame(r))`)
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  await failed();assert.equal(await evaluate(`document.querySelector(${JSON.stringify(weight)}).value`),'33')
  assert.equal(fixture.state.curriculum[0].peso_area,'100')
  await clear();fixture.state.successNext=true
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(weight)});e.focus();e.blur()})()`);await updated()
  assert.equal(fixture.state.curriculum[0].peso_area,'33')
  console.log('PASS: configuration and individual weight errors preserve values, retry saves and refreshes.')
  await button('Agregar materias a grados');await until(`!!document.querySelector('.modal.show fieldset input')`)
  await evaluate(`document.querySelectorAll('.modal.show .row.mb-6 input')[1].click()`)
  await until(`document.querySelectorAll('.modal.show details input[type="checkbox"]').length===2`)
  await evaluate(`document.querySelectorAll('.modal.show details input[type="checkbox"]').forEach(e=>e.click())`)
  await change('.modal.show details input[inputmode="decimal"]','40')
  await change('.modal.show details .col-md-6:nth-child(2) input[inputmode="decimal"]','60')
  await until(`!document.querySelector('.modal.show .modal-footer .btn-primary').disabled`)
  const before=await snapshot();await modalSave();await failed(true)
  assert.equal(await snapshot(),before)
  assert.equal(await evaluate(`document.querySelectorAll('.modal.show .alert-danger').length`),0)
  await screenshot('siee-curriculum-error-over-modal');await modalSucceed()
  assert.equal(fixture.state.curriculum.length,3)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await button('Configuración actual');await until(`document.querySelectorAll('.modal.show details').length===2`)
  await change('.modal.show details input[inputmode="decimal"]','100')
  const mobileBefore=await snapshot();await modalSave();await failed(true)
  assert.equal(await snapshot(),mobileBefore)
  await screenshot('siee-curriculum-error-mobile');await modalSucceed()
  console.log('PASS: bulk additions/current curriculum, retained selections and percentages, desktop/mobile overlay.')
  const rangeForm=()=>evaluate(`(()=>{const f=document.querySelector('form');f.noValidate=true;f.requestSubmit()})()`)
  await change('form fieldset input','Bajo de prueba');await rangeForm();await failed()
  assert.equal(await evaluate(`document.querySelector('form fieldset input').value`),'Bajo de prueba')
  await clear();fixture.state.successNext=true;await rangeForm();await updated()
  await button('Añadir rango')
  assert.equal(await evaluate(`document.querySelectorAll('form fieldset input').length`),9)
  await evaluate(`[...document.querySelectorAll('form fieldset .btn-light-danger')].at(-1).click()`)
  assert.equal(await evaluate(`document.querySelectorAll('form fieldset input').length`),6)
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),'No page-level horizontal overflow on mobile.')
  const openLogs=async()=>{
    await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications')?.classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-logs').click()`)
    await until(`document.querySelectorAll('[data-notification-record]').length===${fixture.state.records.length}`)
  }
  await openLogs()
  const text=await evaluate(`document.querySelector('[data-testid="notification-records"]').textContent`)
  assert.match(text,/Configuración SIEE actualizada/);assert.match(text,/Currículo por grado actualizado/);assert.match(text,/Peso de materia/);assert.match(text,/Escala valorativa actualizada/)
  await navigate('/academico/siee','Configuración SIEE');await openLogs()
  assert.equal(await evaluate(`document.querySelectorAll('[data-notification-record]').length`),fixture.state.records.length)
  await screenshot('siee-notification-records-mobile')
  assert.deepEqual(errors,[])
  console.log('PASS: performance ranges, localized bell records after reload, no browser errors; no real school data changed.')
}
