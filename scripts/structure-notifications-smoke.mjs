import assert from 'node:assert/strict'

export function structureNotificationsFixture() {
  const token = letter => letter.repeat(24)
  const year = {url_token:token('a'), nombre:'2026'}
  const campus = {url_token:token('m'), nombre:'Sede Principal', estado:'activa', es_principal:true}
  const annual = {ano_lectivo_token:token('a'), ano_lectivo:year, estado:'activo'}
  const shift = {...annual, url_token:token('J'), nombre:'Mañana', sede_token:token('m'), sede:campus, hora_inicio:'07:00:00', hora_fin:'12:00:00', estado:'activa'}
  const level = {...annual, url_token:token('N'), nombre:'Primaria', nivel_educativo:'basica_primaria'}
  const grade = {...annual, url_token:token('G'), nombre:'Primero', codigo:'01', nivel_token:token('N'), nivel:level}
  const group = {...annual, url_token:token('c'), nombre:'01A', grado_token:token('G'), grado:grade, jornada_token:token('J'), jornada:shift, sede_token:token('m'), sede:campus, cupo_maximo:30}
  const rows = {
    jornadas:[shift], niveles:[level], grados:[grade], grupos:[group], sedes:[campus],
    'bloques-horarios':[{...annual,url_token:token('B'),nombre:'Primera hora',jornada_token:token('J'),jornada:shift,hora_inicio:'07:00:00',hora_fin:'08:00:00',es_descanso:false}],
    'espacios-fisicos':[{...annual,url_token:token('g'),nombre:'Aula 1',tipo:'aula',capacidad:30,sede_token:token('m'),sede:campus,estado:'disponible',ubicacion:null}],
    docentes:[{url_token:token('f'),name:'Docente de prueba'}],
  }
  const modules = {jornadas:'jornada',niveles:'nivel',grados:'grado',grupos:'grupo','bloques-horarios':'bloque','espacios-fisicos':'espacio'}
  const state = {successNext:false, records:[], rows}
  const middleware = (req,res,next) => {
    const url=new URL(req.url,'http://localhost')
    const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
    const page=(data,p=1,size=20)=>({data:data.slice((p-1)*size,p*size),meta:{current_page:p,per_page:size,last_page:Math.max(1,Math.ceil(data.length/size)),total:data.length,from:data.length?1:null,to:data.length}})
    if(url.pathname==='/api/notification-records') {send(page([...state.records].reverse(),Number(url.searchParams.get('page')||1)));return}
    if(url.pathname==='/api/catalogos-academicos') {send(page(rows[url.searchParams.get('tipo')]||[],1,1000));return}
    if(!url.pathname.startsWith('/api/estructura/')) {next();return}
    const [entity,,action]=url.pathname.slice('/api/estructura/'.length).split('/')
    if(req.method==='GET') {
      if(action==='director') send({data:{grupo_token:token('c'),docente_token:null,docente_nombre:null,version:0,historial:[]}})
      else if(rows[entity]) send(page(rows[entity],1,1000))
      else next()
      return
    }
    let body=''
    req.on('data',chunk=>{body+=chunk})
    req.on('end',()=>{
      const input=JSON.parse(body||'{}'), success=state.successNext
      state.successNext=false
      const event=action==='director'?'structure.director.save':`structure.${modules[entity]}.${req.method==='POST'?'store':req.method==='PUT'?'update':'destroy'}`
      const message=req.method==='DELETE'?'No se puede eliminar: el registro tiene información asociada.':'Revisa los datos de la estructura organizacional.'
      const variant=success?(req.method==='DELETE'?'deleted':req.method==='PUT'?'updated':'success'):'danger'
      const key=String(state.records.length+1).padStart(24,'x')
      state.records.push({token:key,event,variant,subject:success?(input.nombre||rows[entity]?.[0]?.nombre||''): '',message:success?null:message,created_at:new Date().toISOString()})
      res.setHeader('X-Notification-Record',key)
      send(success?{data:{...rows[entity]?.[0],...input}}:{message,errors:{nombre:[message]}},success?(req.method==='POST'?201:200):422)
    })
  }
  return {...state, middleware, state}
}

export async function runStructureNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(b=>b.click())`)
  const close=async()=>{await evaluate(`document.querySelector('.modal.show .modal-footer .btn-light').click()`);await until(`!document.querySelector('.modal.show')`);await clear()}
  const submit=()=>evaluate(`(()=>{const form=document.querySelector('.modal.show form');form.noValidate=true;form.requestSubmit()})()`)
  const overlay=async()=>{
    await until(`!!document.querySelector('.app-toast--danger')`)
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
    const geometry=await evaluate(`(()=>{const e=document.querySelector('.app-toast--danger'),r=e.getBoundingClientRect();return {modal:!!document.querySelector('.modal.show'),onTop:!!document.elementFromPoint(r.left+20,r.top+20)?.closest('.app-toast'),hidden:!!e.closest('[aria-hidden="true"]'),inside:r.left>=0&&r.right<=innerWidth}})()`)
    assert.deepEqual(geometry,{modal:true,onTop:true,hidden:false,inside:true},'Error toast is above the modal/backdrop; dialog remains open.')
  }
  const tabs=['jornadas','niveles','grados','grupos','bloques','espacios']
  for(const tab of tabs) {
    await navigate(`/academico/estructura?tab=${tab}`,'Estructura organizacional')
    await until(`!!document.querySelector('tbody button[title^="Editar"]')`)
    await evaluate(`document.querySelector('.card-body button.btn-primary').click()`)
    await until(`!!document.querySelector('.modal.show form')`)
    const snapshot=await evaluate(`JSON.stringify([...document.querySelectorAll('.modal.show input,.modal.show select')].map(e=>e.value))`)
    await submit();await overlay()
    assert.equal(await evaluate(`JSON.stringify([...document.querySelectorAll('.modal.show input,.modal.show select')].map(e=>e.value))`),snapshot,'Creation failure preserves form values.')
    fixture.state.successNext=true
    await clear();await submit()
    await until(`!document.querySelector('.modal.show')&&!!document.querySelector('.app-toast--success')`)
    await clear()
    await evaluate(`document.querySelector('tbody button[title^="Editar"]').click()`)
    await until(`!!document.querySelector('.modal.show form')`)
    await submit();await overlay()
    if(tab==='bloques') await screenshot('structure-block-error-over-modal')
    await close()
    await evaluate(`document.querySelector('tbody button[title^="Eliminar"]').click()`)
    await until(`!!document.querySelector('.modal.show .btn-danger')`)
    await evaluate(`document.querySelector('.modal.show .btn-danger').click()`)
    await overlay()
    assert.ok(await evaluate(`document.querySelector('.app-toast-message').textContent.includes('información asociada')`),'Deletion errors show the actual server reason.')
    await close()
    console.log('PASS:',tab,'create/edit/delete failures retain modal; successful create closes it.')
  }
  await navigate('/academico/estructura?tab=grupos','Estructura organizacional')
  await until(`!!document.querySelector('tbody button[title^="Editar"]')`)
  await evaluate(`[...document.querySelectorAll('tbody button[title]')].find(b=>b.title.toLowerCase().includes('director')).click()`)
  await until(`!!document.querySelector('.modal.show select')`)
  await evaluate(`document.querySelector('.modal.show select').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`)
  await evaluate(`document.querySelector('.modal.show select').focus()`)
  await until(`document.querySelector('.modal.show select').options.length>1`)
  await evaluate(`(()=>{const s=document.querySelector('.modal.show select');s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`!document.querySelector('.modal.show .modal-footer .btn-primary').disabled`)
  await evaluate(`document.querySelector('.modal.show .modal-footer .btn-primary').click()`)
  await overlay()
  assert.equal(await evaluate(`document.querySelectorAll('.modal.show .alert-danger').length`),0)
  fixture.state.successNext=true
  await clear();await evaluate(`document.querySelector('.modal.show .modal-footer .btn-primary').click()`)
  await until(`!document.querySelector('.modal.show')`);await clear()

  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await navigate('/academico/estructura?tab=niveles','Estructura organizacional')
  await until(`!!document.querySelector('tbody button[title^="Editar"]')`)
  await evaluate(`document.querySelector('tbody button[title^="Editar"]').click()`)
  await until(`!!document.querySelector('.modal.show form')`)
  await submit();await overlay();await screenshot('structure-error-toast-mobile');await close()
  const openLogs=async()=>{
    await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications').classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-logs').click()`)
    await until(`document.querySelectorAll('[data-notification-record]').length===20`)
  }
  await openLogs()
  assert.ok(await evaluate(`document.querySelector('[data-testid="notification-records"]').textContent.includes('Estructura organizacional')`))
  await screenshot('structure-notification-records-mobile')
  await evaluate(`[...document.querySelectorAll('[data-testid="notification-records"] button')].find(b=>b.textContent==='Siguiente').click()`)
  await until(`document.querySelectorAll('[data-notification-record]').length===${fixture.state.records.length-20}`)
  await navigate('/academico/estructura?tab=niveles','Estructura organizacional')
  await openLogs()
  assert.deepEqual(errors,[])
  console.log('PASS: group director error/success, mobile overlay, persisted bell records after reload and pagination.')
}
