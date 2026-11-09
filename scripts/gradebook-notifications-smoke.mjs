import assert from 'node:assert/strict'
import {structureNotificationsFixture} from './structure-notifications-smoke.mjs'

// Isolated HTTP fixtures exercise the real components without writing academic data.
export function gradebookNotificationsFixture({catalog,planilla}) {
  const base=structureNotificationsFixture(), {state}=base, token=c=>c.repeat(24)
  const assignment=catalog.asignaciones[0].url_token, period=planilla.periodo.url_token
  const enrollment=planilla.matriculas[0].url_token, group=catalog.grupos[0].url_token
  const path=`/api/evaluacion/planillas/${assignment}/${period}`
  catalog.can_manage_manual_areas=true;catalog.can_manage_manual_annuals=true
  planilla.configuracion.decimales=1;planilla.requiere_motivo=true
  planilla.usa_preinformes=true;planilla.modo_preinformes='SIMPLE_AVERAGE'
  planilla.secciones[0].nombre='Primer preinforme';planilla.secciones[0].peso='50'
  planilla.secciones[0].preinforme_token=token('P')
  planilla.secciones[0].actividades[0].fecha='2026-09-10'
  planilla.secciones.push({componente_token:token('M'),preinforme_token:token('Q'),nombre:'Segundo preinforme',peso:'50',modo:'MANUAL',version:1,actividades:[]})
  planilla.resultados=[{matricula_token:enrollment,estado:'calculado',raw_value:'3.0',display_value:'3.0',aprobado:true,manual_version:0,
    secciones:planilla.secciones.map(s=>({componente_token:s.componente_token,estado:'pendiente',manual_version:0}))}]
  state.planilla=planilla;state.catalog=catalog;state.writes=[];state.previews=0
  state.visual=false;state.manualSubject=false
  state.choices=[{url_token:token('H'),nombre:'Logrado',emoji:'😊',valor_equivalente:'4.0',aprueba:true},
    {url_token:token('L'),nombre:'En proceso',emoji:'😐',valor_equivalente:'2.0',aprueba:false}]
  state.area={url_token:token('A'),nombre:'Área de prueba'}
  state.manual={area:{estado:'pendiente',manual_version:0},annual:{estado:'pendiente',manual_version:0}}
  state.route=`/evaluacion/planillas/${assignment}/${period}`
  state.areaRoute=`/evaluacion/areas/manual?ano=${catalog.anos[0].url_token}&grupo=${group}&periodo=${period}`
  state.annualRoute=`/evaluacion/anuales/manual?ano=${catalog.anos[0].url_token}&grupo=${group}`
  const sheet=()=>({...planilla,configuracion:{...planilla.configuracion,modo_asignatura:state.manualSubject?'MANUAL':'SIMPLE_AVERAGE'},
    escala_visual:{tipo:state.visual?'imagenes':'numerica',opciones:state.visual?state.choices:[]}})
  const manualSheet=annual=>({grupo:{url_token:group,nombre:'Primero / A'},periodo:planilla.periodo,areas:[state.area],area_token:state.area.url_token,
    ambito:'materia',recursos:[catalog.asignaciones[0].materia],recurso_token:catalog.asignaciones[0].materia_token,
    editable:true,valor_min:'0',valor_max:'5',escala_visual:sheet().escala_visual,
    matriculas:[{url_token:enrollment,nombre_lista:'Estudiante de prueba',resultado:state.manual[annual?'annual':'area']}],
    pagination:{page:1,per_page:20,total:1,last_page:1}})
  return {state,middleware(req,res,next){
    const url=new URL(req.url,'http://localhost'), p=url.pathname
    const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
    if(p==='/api/evaluacion/catalogo')return send({data:catalog})
    if(p.startsWith('/api/indicadores/politica/'))return send({data:{alcance:'grupo',docente_puede_editar:false,version:1,configurado:true}})
    if(p==='/api/indicadores/tabla')return send({data:{grupo_token:group,periodo_token:period,materias:[]}})
    if(p===path&&req.method==='GET')return send({data:sheet()})
    if(p==='/api/evaluacion/areas/manual')return send({data:manualSheet(false)})
    if(p==='/api/evaluacion/anuales/manual')return send({data:manualSheet(true)})
    if(!p.startsWith(path)&&!p.startsWith('/api/evaluacion/areas/manual/')&&!p.startsWith('/api/evaluacion/anuales/manual/'))return base.middleware(req,res,next)
    let body='';req.on('data',c=>{body+=c});req.on('end',()=>{
      const input=JSON.parse(body||'{}')
      if(p.endsWith('/vista-previa')){state.previews++;return send({data:{resultados:planilla.resultados}})}
      const success=state.successNext;state.successNext=false;state.writes.push({path:p,input})
      const activities=p.endsWith('/actividades'), manual=p.includes('/resultados-manuales/')||p.includes('/manual/')
      const annul=manual&&input.valor===null&&!input.escala_opcion_token
      const action=activities?({crear:'store',editar:'update',eliminar:'destroy',editar_lote:'saveBulk',modo:'policy'})[input.operacion]:annul?'destroy':'save'
      const module=activities?'activity':p.includes('/areas/manual/')?'manualArea':p.includes('/anuales/manual/')?'manualAnnual':p.includes('/componentes/')?'manualComponent':manual?'manualSubject':'grades'
      const key=String(state.records.length+1).padStart(24,'g'), variant=success?(action==='destroy'?'deleted':action==='store'?'success':'updated'):'danger'
      const message='Revisa los datos de la planilla antes de guardar.'
      state.records.push({token:key,event:`gradebook.${module}.${action}`,variant,subject:'',message:success?null:message,created_at:new Date().toISOString()})
      res.setHeader('X-Notification-Record',key)
      if(!success)return send({message:'Datos inválidos',errors:{valor:[message]}},422)
      const section=planilla.secciones.find(s=>s.componente_token===input.componente_token)||planilla.secciones[0]
      if(activities){
        if(input.operacion==='crear')section.actividades.push({url_token:token('N'),nombre:input.nombre,fecha:input.fecha,peso:input.peso,version:1})
        if(input.operacion==='editar'){const row=section.actividades.find(a=>a.url_token===input.actividad_token);Object.assign(row,input,{version:row.version+1})}
        if(input.operacion==='eliminar')section.actividades=section.actividades.filter(a=>a.url_token!==input.actividad_token)
        if(input.operacion==='editar_lote')input.actividades.forEach(a=>Object.assign(section.actividades.find(row=>row.url_token===a.actividad_token),a))
        if(input.operacion==='modo')section.modo=input.modo
        section.version++
      }else if(manual){
        const result=p.includes('/areas/manual/')?state.manual.area:p.includes('/anuales/manual/')?state.manual.annual:p.includes('/componentes/')?planilla.resultados[0].secciones[1]:planilla.resultados[0]
        Object.assign(result,{estado:annul?'pendiente':'calculado',raw_value:input.valor,display_value:input.valor,manual_version:result.manual_version+1,valoracion:state.choices.find(c=>c.url_token===input.escala_opcion_token)})
      }else{
        for(const row of input.notas){const previous=planilla.calificaciones.find(g=>g.actividad_token===row.actividad_token&&g.matricula_token===row.matricula_token)
          const saved={...row,version:(previous?.version??0)+1};if(previous)Object.assign(previous,saved);else planilla.calificaciones.push(saved)}
      }
      send({data:sheet()})
    })
  }}
}

export async function runGradebookNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const {state}=fixture
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(e=>e.click())`)
  const click=async(text,scope='document')=>evaluate(`[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled).click()`)
  const change=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor((e.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement).prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const select=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  const snapshot=()=>evaluate(`JSON.stringify([...document.querySelectorAll('.modal.show input,.modal.show select,.modal.show textarea')].map(e=>e.value))`)
  const failed=async(action,modal=false)=>{await clear();const before=modal?await snapshot():null;await action();await until(`!!document.querySelector('.app-toast--danger')`)
    assert.match(await evaluate(`document.querySelector('.app-toast--danger .app-toast-message').textContent`),/Revisa los datos de la planilla/)
    assert.equal(await evaluate(`document.querySelectorAll('.alert-danger').length`),0)
    if(modal){assert.equal(await snapshot(),before);await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`)
      assert.equal(await evaluate(`(()=>{const e=document.querySelector('.app-toast--danger'),r=e.getBoundingClientRect();return !!document.querySelector('.modal.show')&&!e.closest('[aria-hidden="true"]')&&r.left>=0&&r.right<=innerWidth&&!!document.elementFromPoint(r.left+20,r.top+20)?.closest('.app-toast')})()`),true)}
  }
  const succeed=async(action,variant='updated',modal=false)=>{await clear();state.successNext=true;await action();await until(`!!document.querySelector('.app-toast--${variant}')`)
    if(modal)await until(`!document.querySelector('.modal.show')&&!document.querySelector('.modal-backdrop')`);await clear()}
  const saveModal=()=>click('Guardar cambios',`document.querySelector('.modal.show')`)
  const open=()=>navigate(state.route,'Matemáticas')
  await open();await until(`!!document.querySelector('.grade-input')`)
  await change('.grade-input','4.5');await change('#grade-save-reason','Corrección numérica de prueba')
  await until(`!document.querySelector('.grade-result[aria-busy="true"]')`)
  const saveGrades=()=>click('Guardar cambios')
  const recordsBefore=state.records.length
  assert.ok(state.previews>0);assert.equal(state.records.length,recordsBefore,'Preview does not write notification history.')
  await failed(saveGrades);assert.equal(await evaluate(`document.querySelector('.grade-input').value`),'4.5')
  assert.equal(await evaluate(`document.querySelector('#grade-save-reason').value`),'Corrección numérica de prueba')
  await succeed(saveGrades)
  assert.equal(state.writes.at(-1).input.notas[0].valor,'4.5')
  await until(`!document.querySelector('.grade-component-card button').disabled`)
  await evaluate(`document.querySelector('.grade-component-card button').click()`);await until(`!!document.querySelector('#grade-activity-name')`)
  await change('#grade-activity-name','Actividad de prueba');await change('#grade-activity-date','2026-09-15')
  await failed(saveModal,true);await screenshot('gradebook-activity-error');await succeed(saveModal,'success',true)
  await until(`[...document.querySelectorAll('.grade-activity button')].some(e=>e.textContent.includes('Actividad de prueba'))`)
  const editNew=()=>evaluate(`[...document.querySelectorAll('.grade-activity button')].find(e=>e.textContent.includes('Actividad de prueba')).click()`)
  await editNew();await change('#grade-activity-name','Actividad de prueba editada');await failed(saveModal,true);await succeed(saveModal,'updated',true)
  await editNew();await evaluate(`window.confirm=()=>true`)
  const remove=()=>click('Eliminar',`document.querySelector('.modal.show')`)
  await failed(remove,true);await succeed(remove,'deleted',true)
  await evaluate(`document.querySelectorAll('.grade-sheet-tabs button')[1].click()`)
  await until(`!!document.querySelector('input[id^="activity-name-"]')`)
  await change('input[id^="activity-name-"]','Edición rápida conservada')
  const quickSave=()=>click('Guardar actividades')
  await failed(quickSave);assert.equal(await evaluate(`document.querySelector('input[id^="activity-name-"]').value`),'Edición rápida conservada')
  await succeed(quickSave)
  await until(`!document.querySelector('.grade-component-mode').disabled`)
  await failed(()=>select('.grade-component-mode','WEIGHTED_AVERAGE'))
  await succeed(()=>select('.grade-component-mode','WEIGHTED_AVERAGE'))
  console.log('PASS: numeric grades, preview exclusion, activity create/edit/delete/batch and calculation mode; errors retain data.')
  await open();await until(`document.querySelectorAll('.grade-sheet-tabs button').length===3`)
  await evaluate(`document.querySelectorAll('.grade-sheet-tabs button')[2].click()`)
  await evaluate(`document.querySelector('tbody .grade-cell button').click()`)
  await until(`!!document.querySelector('#manual-component-value')`)
  await change('#manual-component-value','4.0');await change('#manual-component-reason','Resultado manual de prueba')
  await failed(saveModal,true);await succeed(saveModal,'updated',true)
  await evaluate(`document.querySelector('tbody .grade-cell button').click()`)
  await until(`!!document.querySelector('#manual-component-reason')`);await change('#manual-component-reason','Anulación manual de prueba')
  await succeed(()=>click('Anular resultado',`document.querySelector('.modal.show')`),'updated',true)
  state.visual=true
  await open();await until(`!!document.querySelector('select[data-grade-row]')`)
  await select('select[data-grade-row]',state.choices[0].url_token);await change('#grade-save-reason','Valoración visual de prueba')
  await failed(saveGrades);assert.equal(await evaluate(`document.querySelector('select[data-grade-row]').value`),state.choices[0].url_token)
  await succeed(saveGrades);assert.equal(state.writes.at(-1).input.notas[0].escala_opcion_token,state.choices[0].url_token)
  state.manualSubject=true
  await open();await until(`!!document.querySelector('tbody .btn-light-primary')`)
  await evaluate(`document.querySelector('tbody .btn-light-primary').click()`)
  await until(`!!document.querySelector('#manual-subject-value')`)
  await select('#manual-subject-value',state.choices[0].url_token);await change('#manual-subject-reason','Valoración manual de prueba')
  await failed(saveModal,true);await succeed(saveModal,'updated',true)
  await evaluate(`document.querySelector('tbody .btn-light-primary').click()`);await until(`!!document.querySelector('#manual-subject-reason')`)
  await change('#manual-subject-reason','Anulación de valoración de prueba')
  await succeed(()=>click('Anular definitiva',`document.querySelector('.modal.show')`),'updated',true)
  console.log('PASS: caritas grade saves and subject/component manual results; annul and error preservation.')
  for(const kind of ['area','annual']){
    state.visual=kind==='annual'
    if(kind==='annual')await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    await navigate(state[kind+'Route'],kind==='area'?'Resultados de área':'Definitivas anuales')
    await until(`!!document.querySelector('tbody .btn-light-primary')`)
    await evaluate(`document.querySelector('tbody .btn-light-primary').click()`);await until(`!!document.querySelector('#manual-${kind}-value')`)
    if(state.visual)await select(`#manual-${kind}-value`,state.choices[0].url_token);else await change(`#manual-${kind}-value`,'4.1')
    await change(`#manual-${kind}-reason`,'Registro con justificación de prueba')
    await failed(saveModal,true);if(kind==='annual')await screenshot('gradebook-manual-error-mobile')
    await succeed(saveModal,'updated',true)
    await evaluate(`document.querySelector('tbody .btn-light-primary').click()`);await until(`!!document.querySelector('#manual-${kind}-reason')`)
    await change(`#manual-${kind}-reason`,'Anulación con justificación de prueba')
    await succeed(()=>click('Anular resultado',`document.querySelector('.modal.show')`),'updated',true)
  }
  const logs=async()=>{await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications')?.classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-logs').click()`);await until(`document.querySelectorAll('[data-notification-record]').length===20`)}
  await logs();await screenshot('gradebook-records-mobile')
  assert.doesNotMatch(await evaluate(`document.querySelector('#kt_menu_notifications').textContent`),/event\.gradebook|scope\.gradebook/)
  const count=state.records.length
  await navigate(state.annualRoute,'Definitivas anuales');await logs();assert.equal(state.records.length,count,'History reload does not duplicate notifications.')
  assert.deepEqual(errors,[])
  console.log('PASS: manual area/annual, numeric/caritas, mobile overlay and notification history after reload.')
}
