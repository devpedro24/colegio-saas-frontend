import assert from 'node:assert/strict'
import {structureNotificationsFixture} from './structure-notifications-smoke.mjs'

export function learningNotificationsFixture() {
  const base=structureNotificationsFixture(), {state}=base, token=c=>c.repeat(24)
  const year={url_token:token('a'),token:token('a'),nombre:'2026',estado:'en_curso'}
  const subject={token:token('S'),nombre:'Matemáticas'}, grade={token:token('G'),nombre:'Primero'}
  state.periods=['p','q'].map((letter,i)=>({url_token:token(letter),token:token(letter),ano_token:year.token,nombre:i?'Segundo período':'Primer período',
    orden:i+1,estado:'abierto',fecha_inicio:i?'2026-04-01':'2026-01-01',fecha_fin:i?'2026-06-30':'2026-03-31',version:0,editable:true,
    configuracion:{usar_preinformes:true,modo:'WEIGHTED_AVERAGE',fechas_estrictas:false},
    preinformes:[{url_token:token(i?'A':'B'),nombre:'Primer avance',peso:'40',fecha_inicio:null,fecha_fin:null},
      {url_token:token(i?'C':'D'),nombre:'Segundo avance',peso:'60',fecha_inicio:null,fecha_fin:null}]}))
  state.policy={alcance:'grupo',docente_puede_editar:true,version:1,configurado:true,indicadores_grado:1,indicadores_grupo:1}
  state.sheet={materia_token:subject.token,materia:subject.nombre,texto_html:'<p>Reconoce cantidades.</p>',version:1,puede_editar:true}
  state.bindings=[{indicador_token:token('I'),vinculo_token:token('V'),texto_base:'Organiza colecciones.',texto_vinculado:'Organiza colecciones.',version_base:1,version_vinculo:1,orden:1,periodos_orden:[1]}]
  state.writes=[]
  const page=()=>({data:state.bindings,meta:{pagina:1,ultima_pagina:1,total:state.bindings.length}})
  return {state,middleware(req,res,next){
    const url=new URL(req.url,'http://localhost'),path=url.pathname
    const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
    if(path==='/api/anos-lectivos')return send({data:[year]})
    if(!path.startsWith('/api/preinformes')&&!path.startsWith('/api/indicadores'))return base.middleware(req,res,next)
    if(req.method==='GET'){
      if(path==='/api/preinformes')return send({data:{anos:[year],ano:year,incluido_plan:true,puede_gestionar:true,periodos:state.periods}})
      if(path.includes('/politica/'))return send({data:state.policy})
      if(path.endsWith('/opciones-asignadas'))return send({data:{anos:[year],grupos:[{token:token('c'),ano_token:year.token,grado_token:grade.token,nombre:'01A',grado_nombre:grade.nombre,materias:[subject]}],periodos:state.periods}})
      if(path.endsWith('/tabla'))return send({data:{grupo_token:token('c'),periodo_token:state.periods[0].token,materias:[state.sheet]}})
      if(path.includes('/contexto/'))return send({data:{grados:[grade],materias:[subject],periodos:state.periods}})
      if(path.endsWith('/vinculos'))return send(page())
      if(path.endsWith('/bases'))return send({data:[{indicador_token:token('Z'),texto:'Construye secuencias.',version:1,orden:1}],meta:{pagina:1,ultima_pagina:1,total:1}})
      if(path.endsWith('/borradores'))return send({data:[]})
      return send({data:{indicadores:[],pagina:1,ultima_pagina:1,total:0}})
    }
    let body='';req.on('data',chunk=>{body+=chunk});req.on('end',()=>{
      const input=JSON.parse(body||'{}'),success=state.successNext;state.successNext=false
      state.writes.push({path,input})
      const pre=path.startsWith('/api/preinformes'),policy=path.includes('/politica/'),sheet=path.includes('/tabla/')
      const event=pre?'preinformes.save':policy?'indicators.policy.update':sheet?`indicators.sheet.${req.method==='DELETE'?'destroy':'save'}`:
        path.endsWith('/texto')?'indicators.binding.update':path.endsWith('/vinculos')?'indicators.binding.store':'indicators.base.store'
      const message=pre?'Revisa los datos de los preinformes.':'Revisa los datos de los indicadores.'
      const key=String(state.records.length+1).padStart(24,'l')
      const variant=success?(req.method==='DELETE'?'deleted':event.endsWith('.store')?'success':'updated'):'danger'
      state.records.push({token:key,event,variant,subject:'',message:success?null:message,created_at:new Date().toISOString()})
      res.setHeader('X-Notification-Record',key)
      if(!success)return send({message:'Datos inválidos',errors:{[pre?'preinformes.0.nombre':policy?'alcance':sheet?'texto_html':'texto']:[message]}},422)
      let data={guardado:true}
      if(pre){
        const period=state.periods.find(row=>path.endsWith(row.token));period.version++
        period.configuracion={usar_preinformes:input.usar_preinformes,modo:input.modo,fechas_estrictas:input.fechas_estrictas}
        period.preinformes=input.usar_preinformes?input.preinformes.map((row,i)=>({...row,url_token:row.url_token||String(i).padStart(24,'n')})):[]
      }else if(policy){Object.assign(state.policy,input,{version:state.policy.version+1});data=state.policy}
      else if(sheet){Object.assign(state.sheet,{texto_html:req.method==='DELETE'?'':input.texto_html,version:state.sheet.version+1});data=state.sheet}
      else if(path.endsWith('/texto')){
        const row=state.bindings.find(row=>path.includes(row.vinculo_token));Object.assign(row,{texto_vinculado:input.texto,version_vinculo:row.version_vinculo+1});data=row
      }else if(path.endsWith('/vinculos')) {data={indicador_token:token('Z'),vinculo_token:token('Y'),texto_base:'Construye secuencias.',texto_vinculado:'Construye secuencias.',version_base:1,version_vinculo:1,orden:1,periodos_orden:[1]};state.bindings.push(data)}
      else {data={indicador_token:token('K'),vinculo_token:token('L'),texto_base:input.texto,texto_vinculado:input.texto,version_base:1,version_vinculo:1,orden:1,periodos_orden:[1]};state.bindings.push(data)}
      send({data})
    })
  }}
}

export async function runLearningNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(e=>e.click())`)
  const button=async(text,scope='document')=>evaluate(`[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`)
  const change=async(selector,value,tag='HTMLInputElement')=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${tag}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const select=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  const failed=async()=>{await until(`!!document.querySelector('.app-toast--danger')`);assert.match(await evaluate(`document.querySelector('.app-toast-message').textContent`),/Revisa los datos de los/)}
  const succeed=async(action,variant='updated')=>{await clear();fixture.state.successNext=true;await action();await until(`!!document.querySelector('.app-toast--${variant}')`);await clear()}
  const preValues=()=>evaluate(`JSON.stringify([...document.querySelectorAll('input[id^="pre-"],input[id^="fecha_"],input[type="checkbox"],#preinformes-mode')].map(e=>[e.value,e.checked]))`)
  const preSave=async()=>{await until(`[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Guardar cambios'&&!e.disabled)`);await button('Guardar cambios')}
  await navigate('/academico/preinformes','Preinformes')
  await until(`!!document.querySelector('#pre-name-0')`)
  await change('#pre-name-0','Seguimiento de prueba');await change('#pre-weight-0','20');await change('#pre-weight-1','80')
  await button('Agregar preinforme');await until(`!!document.querySelector('#pre-name-2')`)
  await evaluate(`document.querySelectorAll('button[aria-label="Eliminar"]')[2].click()`)
  const before=await preValues();assert.match(before,/Seguimiento de prueba/);await preSave();await failed();assert.equal(await preValues(),before)
  assert.equal(await evaluate(`document.querySelectorAll('.alert-danger').length`),0)
  await screenshot('preinformes-save-error');await succeed(preSave)
  assert.equal(fixture.state.periods[0].preinformes[0].peso,'20')
  await select('select[aria-label="Tomar estructura de otro período"]','q'.repeat(24))
  await until(`document.querySelector('#pre-name-0').value==='Primer avance'`)
  await succeed(preSave)
  await until(`!document.querySelector('.card-body .form-switch input').disabled`)
  await evaluate(`document.querySelector('.card-body .form-switch input').click()`)
  await until(`!document.querySelector('#pre-name-0')`)
  await preSave();await failed();assert.equal(await evaluate(`document.querySelector('.card-body .form-switch input').checked`),false)
  await succeed(preSave);assert.equal(fixture.state.periods[0].preinformes.length,0)
  console.log('PASS: preinformes add/remove/copy/disable, saved percentages, errors preserve edits without duplicate banners.')
  await navigate('/academico/indicadores','Indicadores de aprendizaje')
  await until(`!!document.querySelector('.group-indicator-edit')`)
  const edit=()=>evaluate(`document.querySelector('.group-indicator-edit').click()`)
  const rich=async(html)=>evaluate(`(()=>{const e=document.querySelector('.group-indicator-editor');e.innerHTML=${JSON.stringify(html)};e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const indicatorSave=()=>evaluate(`document.querySelector('.group-indicator-actions .btn-primary').click()`)
  await edit();await rich('<ul><li><strong>Compara cantidades de prueba.</strong></li></ul>')
  await indicatorSave();await failed()
  assert.match(await evaluate(`document.querySelector('.group-indicator-editor').innerHTML`),/<strong>Compara cantidades/)
  await succeed(indicatorSave)
  await until(`!!document.querySelector('.group-indicator-rich strong')`)
  await evaluate(`document.querySelector('.group-indicator-row-actions .btn-light-danger').click()`)
  const deleteIndicator=()=>evaluate(`document.querySelector('.group-indicator-delete-confirm .btn-danger').click()`)
  await deleteIndicator();await failed();assert.equal(await evaluate(`!!document.querySelector('.group-indicator-delete-confirm .btn-danger')`),true)
  await succeed(deleteIndicator,'deleted');await until(`!document.querySelector('.group-indicator-rich')`)
  await edit();await rich('<p>Indicador nuevo de prueba.</p>');await succeed(indicatorSave,'success')
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await edit();await rich('<p><u>Texto móvil conservado.</u></p>');await indicatorSave();await failed()
  await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`)
  assert.equal(await evaluate(`(()=>{const e=document.querySelector('.app-toast--danger'),r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&!e.closest('[aria-hidden="true"]')&&!!document.elementFromPoint(r.left+20,r.top+20)?.closest('.app-toast')})()`),true)
  await screenshot('indicators-save-error-mobile');await succeed(indicatorSave)
  console.log('PASS: group indicator create/edit/delete, preserved HTML, confirmation retained on error, mobile toast.')
  await navigate('/ajustes-institucionales/indicadores','Configuración de indicadores')
  await until(`!!document.querySelector('input[name="indicator-scope"]')`)
  await evaluate(`document.querySelector('input[name="indicator-scope"][value="grado"]').click()`)
  await until(`!!document.querySelector('form .alert-warning input')`)
  await evaluate(`document.querySelector('form .alert-warning input').click()`)
  const policySave=()=>evaluate(`document.querySelector('form').requestSubmit()`)
  await policySave();await failed()
  assert.equal(await evaluate(`document.querySelector('input[name="indicator-scope"][value="grado"]').checked&&document.querySelector('form .alert-warning input').checked`),true)
  await succeed(policySave)
  await navigate('/academico/indicadores?ano='+ 'a'.repeat(24)+'&grado='+ 'G'.repeat(24)+'&materia='+ 'S'.repeat(24)+'&periodo='+ 'p'.repeat(24),'Indicadores de aprendizaje')
  await until(`!!document.querySelector('form textarea')`)
  await change('form textarea','Describe patrones de prueba.','HTMLTextAreaElement')
  const create=()=>evaluate(`document.querySelector('form').requestSubmit()`)
  await create();await failed();assert.equal(await evaluate(`document.querySelector('form textarea').value`),'Describe patrones de prueba.')
  await succeed(create,'success');await until(`document.querySelector('form textarea').value===''`)
  await evaluate(`document.querySelector('details').open=true`)
  await change('details textarea','Colecciones editadas de prueba.','HTMLTextAreaElement')
  const gradeSave=()=>evaluate(`document.querySelector('details .btn-primary').click()`)
  await gradeSave();await failed();assert.equal(await evaluate(`document.querySelector('details textarea').value`),'Colecciones editadas de prueba.')
  await succeed(gradeSave)
  await until(`document.querySelector('details textarea').value==='Colecciones editadas de prueba.'`)
  const linkedBefore=fixture.state.bindings.length
  await select('select[aria-label="Texto existente"]','Z'.repeat(24))
  const bind=()=>button('Vincular a esta asignatura')
  await bind();await failed();assert.equal(await evaluate(`document.querySelector('select[aria-label="Texto existente"]').value`),'Z'.repeat(24))
  await succeed(bind,'success');await until(`document.querySelector('select[aria-label="Texto existente"]').value===''`)
  assert.equal(fixture.state.bindings.length,linkedBefore+1)
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),'No horizontal page overflow.')
  const openLogs=async()=>{
    await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications')?.classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-logs').click()`)
    await until(`document.querySelectorAll('[data-notification-record]').length===${Math.min(20,fixture.state.records.length)}`)
  }
  await clear();await openLogs()
  const logs=await evaluate(`document.querySelector('[data-testid="notification-records"]').textContent`)
  assert.match(logs,/Configuración de preinformes actualizada/);assert.match(logs,/Descripción de indicadores guardada/);assert.match(logs,/Configuración de indicadores actualizada/);assert.match(logs,/Indicador creado/)
  await navigate('/academico/preinformes','Preinformes');await openLogs();await screenshot('learning-notification-records-mobile')
  assert.deepEqual(errors,[])
  console.log('PASS: policy and grade indicators, persisted localized bell records after reload, no browser errors; fixture data only.')
}
