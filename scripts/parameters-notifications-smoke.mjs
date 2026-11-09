import assert from 'node:assert/strict'
import {structureNotificationsFixture} from './structure-notifications-smoke.mjs'

export function parametersNotificationsFixture() {
  const base=structureNotificationsFixture(), {state}=base, token=c=>c.repeat(24)
  const annual={ano_lectivo_token:token('a')}
  const options=[
    {url_token:token('O'),nombre:'Bien',orden:1,valor_equivalente:'5',emoji:'🙂',aprueba:true,imagen_url:null},
    {url_token:token('P'),nombre:'En proceso',orden:2,valor_equivalente:'2.5',emoji:'😐',aprueba:false,imagen_url:null},
  ]
  const scales=[
    {...annual,url_token:token('E'),nombre:'Escala numérica',nivel_educativo:null,tipo:'numerica',valor_min:1,valor_max:5,decimales:1,desempenos:[],opciones:[]},
    {...annual,url_token:token('I'),nombre:'Caritas',nivel_educativo:'preescolar',tipo:'imagenes',valor_min:null,valor_max:null,decimales:null,opciones_bloqueadas:false,opciones:options},
  ]
  const rows={escalas:scales,'metodos-aprobacion':[{...annual,url_token:token('T'),calculo_nota:'promedio_simple',nota_minima:3,ambito:'materia'}],
    'modelos-pedagogicos':[{...annual,url_token:token('Q'),nivel_educativo:'primaria',docente_unico:true,salon_fijo:true,tiene_director_grupo:true}]}
  state.sequence=[];state.writes=[]
  return {state,middleware(req,res,next){
    const url=new URL(req.url,'http://localhost')
    const parts=url.pathname.match(/^\/api\/config\/(escalas|metodos-aprobacion|modelos-pedagogicos)(?:\/(.*))?$/)
    if(!parts) return base.middleware(req,res,next)
    const [,entity,rest]=parts, nested=rest?.includes('/opciones')
    const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
    if(req.method==='GET') return send({data:rows[entity]})
    let body=''
    req.on('data',chunk=>{body+=chunk})
    req.on('end',()=>{
      const multipart=req.headers['content-type']?.startsWith('multipart/')
      const input=multipart?{}:JSON.parse(body||'{}')
      state.writes.push({path:url.pathname,input,multipart})
      const success=state.sequence.length?state.sequence.shift():state.successNext
      state.successNext=false
      const kind=nested?'options':{escalas:'scale','metodos-aprobacion':'approval','modelos-pedagogicos':'model'}[entity]
      const action=nested?(rest.endsWith('/imagen')?'upload':'save'):req.method==='DELETE'?'destroy':req.method==='PUT'?'update':'store'
      const variant=success?(action==='destroy'?'deleted':['update','save','upload'].includes(action)?'updated':'success'):'danger'
      const message='Revisa los datos de los parámetros académicos.'
      const key=String(state.records.length+1).padStart(24,'p')
      state.records.push({token:key,event:`parameters.${kind}.${action}`,variant,subject:success?input.nombre||'':'',message:success?null:message,created_at:new Date().toISOString()})
      res.setHeader('X-Notification-Record',key)
      const row=rows[entity].find(item=>rest?.startsWith(item.url_token))||rows[entity][0]
      const data=nested?(action==='save'?options:{...options[0],imagen_url:'/media/logo-colegio-transparent.png'}):{...row,...input}
      send(success?{data}:{message:'Datos inválidos',errors:{[nested?'opciones.0.nombre':entity==='escalas'?'nombre':entity==='metodos-aprobacion'?'nota_minima':'nivel_educativo']:[message]}},success?(action==='store'?201:200):422)
    })
  }}
}

export async function runParametersNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(e=>e.click())`)
  const values=()=>evaluate(`JSON.stringify([...document.querySelectorAll('.modal.show input,.modal.show select')].map(e=>[e.value,e.checked]))`)
  const change=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const submit=()=>evaluate(`(()=>{const f=document.querySelector('.modal.show form');f.noValidate=true;f.requestSubmit()})()`)
  const close=async()=>{await evaluate(`document.querySelector('.modal.show .modal-footer .btn-light').click()`);await until(`!document.querySelector('.modal-backdrop')`);await clear()}
  const overlay=async()=>{
    await until(`!!document.querySelector('.app-toast--danger')`)
    await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`)
    assert.equal(await evaluate(`(()=>{const e=document.querySelector('.app-toast--danger'),r=e.getBoundingClientRect();return !!document.querySelector('.modal.show')&&!e.closest('[aria-hidden="true"]')&&!!document.elementFromPoint(r.left+20,r.top+20)?.closest('.app-toast')&&r.left>=0&&r.right<=innerWidth})()`),true)
  }
  const fail=async()=>{
    await clear();const before=await values();await submit();await overlay()
    assert.equal(await values(),before,'Errors preserve inputs, ranges, choices and switches.')
  }
  const succeed=async(variant='success')=>{
    fixture.state.successNext=true;await clear();await submit()
    await until(`!document.querySelector('.modal.show')&&!!document.querySelector('.app-toast--${variant}')`)
    await until(`!document.querySelector('.modal-backdrop')`);await clear()
  }
  for(const tab of ['escala','metodo','modelo']){
    await navigate('/academico/parametros-academicos?tab='+tab,'Parámetros académicos')
    await until(`!!document.querySelector('tbody button[title^="Editar"]')`)
    await evaluate(`document.querySelector('.card-body button.btn-primary').click()`)
    await until(`!!document.querySelector('.modal.show form')`)
    if(tab==='escala'){
      await change('.modal.show input[type="text"]','Escala de prueba')
      await evaluate(`document.querySelector('.modal.show fieldset .btn-light-primary').click()`)
      await until(`!!document.querySelector('.modal.show fieldset input')`)
      await change('.modal.show fieldset input','Rango de prueba')
      // Add/remove remains local until the explicit save.
      await evaluate(`document.querySelector('.modal.show fieldset .btn-light-danger').click()`)
      await until(`!document.querySelector('.modal.show fieldset input')`)
    }
    if(tab==='modelo') await evaluate(`document.querySelector('.modal.show input[type="checkbox"]').click()`)
    await fail();await succeed()
    await evaluate(`document.querySelector('tbody button[title^="Editar"]').click()`)
    await until(`!!document.querySelector('.modal.show form')`)
    await fail()
    if(tab==='metodo') await screenshot('parameters-method-error-over-modal')
    await succeed('updated')
    const remove=()=>evaluate(`document.querySelector('tbody button[title^="Eliminar"]').click()`)
    await clear();await remove();await until(`!!document.querySelector('.app-toast--danger')`)
    assert.ok(await evaluate(`document.querySelector('.app-toast-message').textContent.includes('Revisa los datos')`))
    fixture.state.successNext=true;await clear();await remove()
    await until(`!!document.querySelector('.app-toast--deleted')`);await clear()
    console.log('PASS:',tab,'create/edit/delete, retained fields, visible feedback, successful closure.')
  }
  await navigate('/academico/parametros-academicos?tab=escala','Parámetros académicos')
  await until(`document.querySelectorAll('tbody button[title^="Editar"]').length===2`)
  await evaluate(`document.querySelectorAll('tbody button[title^="Editar"]')[1].click()`)
  await until(`document.querySelectorAll('.modal.show input[type="file"]').length===2`)
  const choiceRows=()=>evaluate(`document.querySelectorAll('.modal.show .border.rounded-3').length`)
  const beforeRows=await choiceRows()
  await evaluate(`document.querySelector('.modal.show .mt-5 > .d-flex .btn-light-primary').click()`)
  assert.equal(await choiceRows(),beforeRows+1)
  await evaluate(`[...document.querySelectorAll('.modal.show .border.rounded-3 .btn-light-danger')].at(-1).click()`)
  assert.equal(await choiceRows(),beforeRows)
  fixture.state.sequence=[true,false]
  await fail()
  assert.ok(fixture.state.writes.at(-1).path.endsWith('/opciones'))
  fixture.state.sequence=[true,true];await clear();await submit()
  await until(`!document.querySelector('.modal-backdrop')`);await clear()
  await evaluate(`document.querySelectorAll('tbody button[title^="Editar"]')[1].click()`)
  await until(`!!document.querySelector('.modal.show input[type="file"]')`)
  const upload=()=>evaluate(`new Promise(resolve=>{const c=document.createElement('canvas');c.width=c.height=64;c.toBlob(blob=>{const dt=new DataTransfer();dt.items.add(new File([blob],'carita.png',{type:'image/png'}));const e=document.querySelector('.modal.show input[type="file"]');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));resolve()},'image/png')})`)
  const beforeUpload=await values();await upload();await overlay();assert.equal(await values(),beforeUpload)
  fixture.state.successNext=true;await clear();await upload()
  await until(`!!document.querySelector('.app-toast--updated')&&!!document.querySelector('.modal.show img')`)
  assert.ok(fixture.state.writes.at(-1).multipart)
  await close()
  console.log('PASS: ranges and categories add/remove, category-save failure recovery, image upload error/success.')
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await navigate('/academico/parametros-academicos?tab=modelo','Parámetros académicos')
  await until(`!!document.querySelector('tbody button[title^="Editar"]')`)
  await evaluate(`document.querySelector('tbody button[title^="Editar"]').click()`)
  await until(`!!document.querySelector('.modal.show form')`)
  await fail();await screenshot('parameters-model-error-mobile');await close()
  const openLogs=async()=>{
    await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications').classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-logs').click()`)
    await until(`document.querySelectorAll('[data-notification-record]').length===20`)
    assert.ok(await evaluate(`document.querySelector('[data-testid="notification-records"]').textContent.includes('Parámetros académicos')`))
  }
  await openLogs();await screenshot('parameters-notification-records-mobile')
  await navigate('/academico/parametros-academicos?tab=modelo','Parámetros académicos');await openLogs()
  assert.deepEqual(errors,[])
  console.log('PASS: mobile overlay, persisted bell history after reload, no browser errors.')
}
