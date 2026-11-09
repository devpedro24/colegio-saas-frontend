import assert from 'node:assert/strict'

export function attendanceNotificationsFixture({user}) {
  const t=c=>c.repeat(24),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date())
  const state={student:false,successNext:true,records:[],updates:[],reads:0}
  const summary={registradas:0,ausentes:0,tardes:0,justificadas:0,faltas_equivalentes:0,porcentaje:0,alerta:false}
  const column={sesion_token:t('s'),fecha:today,hora_inicio:'07:00',hora_fin:'07:50',registrada:false,version:0,historica:false,editable:true,matriculas:[t('e')],marcas:{}}
  const period={token:t('p'),nombre:'Cuarto período',estado:'abierto'}
  const request={token:t('r'),estudiante:'Estudiante de prueba',asignatura:'Matemáticas',grupo:'Primero / 01A',origen:'estudiante',estado:'pendiente_aprobacion',motivo:'Justificación de prueba',respuesta_docente:null,respuesta_aprobador:null,created_at:new Date().toISOString(),marcas:[{fecha:today,hora_inicio:'07:00',hora_fin:'07:50',estado_anterior:'ausente'}]}
  const page=data=>({data,meta:{current_page:1,last_page:1,total:data.length}})
  const pagination={current_page:1,last_page:1,per_page:20,total:1,from:1,to:1}
  const notice=event=>state.updates.push({token:String(state.updates.length+1).padStart(24,'n'),event,resource_title:'',subject:'Matemáticas',group:'01A',grade:'Primero',year:'2026',attendance_date:today,attendance_time:'07:00–07:50',url:'/academico/asistencia',created_at:new Date().toISOString()})
  user.permissions.push('asistencia.registrar_clases','asistencia.correccion.aprobar','asistencia.consultar_grupo')
  user.institution={name:'Colegio de prueba',plan:{name:'Premium',features:['nucleo','academico','asistencia']}}
  return {state,middleware(req,res,next){
    const p=new URL(req.url,'http://localhost').pathname
    const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
    if(p==='/api/me'&&state.student)return send({user:{...user,roles:['estudiante'],permissions:['asistencia.consultar_propia']},csrf_token:'smoke-csrf'})
    if(p==='/api/notification-updates'){state.reads++;return send(page(state.student?[...state.updates].reverse():[]))}
    if(p==='/api/notification-records')return send(page([...state.records].reverse()))
    if(!p.startsWith('/api/asistencias'))return next()
    if(req.method==='GET'){
      if(p==='/api/asistencias')return send({data:{anos:[{token:t('y'),nombre:'2026',estado:'en_curso'}],ano_lectivo_token:t('y'),asignaciones:[{token:t('a'),nombre:'Primero / 01A · Matemáticas',ano_lectivo_token:t('y'),grupo_token:t('g'),grupo_nombre:'Primero / 01A',materia_token:t('m'),materia_nombre:'Matemáticas'}]}})
      if(p.endsWith('/planilla'))return send({data:{periodos:[period],periodo:period,columnas:[column],estudiantes:[{matricula_token:t('e'),nombre:'Estudiante de prueba',activa:true,resumen:summary}]}})
      if(p.endsWith('/solicitudes'))return send({data:{solicitudes:[request],pagination}})
      if(p.endsWith('/mis-faltas'))return send({data:{faltas:[],pagination:{...pagination,total:0}}})
      return next()
    }
    let body='';req.on('data',c=>{body+=c});req.on('end',()=>{
      const input=JSON.parse(body||'{}'),ok=state.successNext;state.successNext=true
      const event=p.endsWith('/resolucion')?'attendance.request.approve':'attendance.sheet.save'
      const token=String(state.records.length+1).padStart(24,'R')
      state.records.push({token,event,variant:ok?'updated':'danger',subject:'',message:null,created_at:new Date().toISOString()})
      res.setHeader('X-Notification-Record',token)
      if(!ok)return send({message:'Error de validación',errors:{respuesta:['La solicitud cambió. Revisa la información antes de aprobar.']}},422)
      if(p.endsWith('/resolucion')){request.estado='aprobada';column.marcas[t('e')]='justificada';notice('attendance.justification.approved')}
      else{const status=input.marcas[0].estado;if(status==='ausente'&&column.marcas[t('e')]!=='ausente')notice('attendance.absent');column.marcas[t('e')]=status;column.registrada=true;column.version++}
      return send({data:{registrada:true,version:column.version,estado:request.estado}})
    })
  }}
}

export async function runAttendanceNotificationsSmoke({fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const {state}=fixture
  const clear=()=>evaluate(`document.querySelectorAll('.app-toast-close').forEach(e=>e.click())`)
  const open=async tab=>{const bounds=await evaluate(`(()=>{const r=document.querySelector('[aria-controls="kt_menu_notifications"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,desktop:innerWidth>=992}})()`)
    if(bounds.desktop)await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:bounds.x,y:bounds.y})
    else await evaluate(`document.querySelector('[aria-controls="kt_menu_notifications"]').click()`)
    await until(`document.querySelector('#kt_menu_notifications')?.classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-${tab}').click()`)}
  await navigate('/academico/asistencia','Planilla del período')
  await until(`!!document.querySelector('[data-attendance-choice="ausente"]')`)
  assert.equal(state.reads,0)
  await evaluate(`document.querySelector('[data-attendance-choice="ausente"]').click()`)
  await until(`!document.querySelector('.attendance-sheet-card button.btn-primary').disabled`)
  await evaluate(`document.querySelector('.attendance-sheet-card button.btn-primary').click()`)
  await until(`!!document.querySelector('.app-toast--success')`)
  assert.equal(state.updates.length,1)
  await clear()
  await until(`!![...document.querySelectorAll('article button')].find(e=>e.textContent.trim()==='Aprobar y justificar')`)
  await evaluate(`[...document.querySelectorAll('article button')].find(e=>e.textContent.trim()==='Aprobar y justificar').click()`)
  await until(`!!document.querySelector('.modal.show')`)
  state.successNext=false
  await evaluate(`document.querySelector('.modal.show .modal-footer .btn-primary').click()`)
  await until(`!!document.querySelector('.app-toast--danger')`)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show')`),'Errors keep the approval modal open.')
  assert.match(await evaluate(`document.querySelector('.app-toast--danger').textContent`),/La solicitud cambió/)
  assert.ok(await evaluate(`Number(getComputedStyle(document.querySelector('.app-toast-region')).zIndex)>Number(getComputedStyle(document.querySelector('.modal')).zIndex)`))
  await screenshot('attendance-approval-toast')
  await clear();await evaluate(`document.querySelector('.modal.show .modal-footer .btn-primary').click()`)
  await until(`!document.querySelector('.modal.show')&&!!document.querySelector('.app-toast--success')`)
  assert.equal(state.updates.length,2)
  await clear();await open('logs');await until(`document.querySelectorAll('[data-notification-record]').length===3`)
  assert.match(await evaluate(`document.querySelector('#notifications-panel').textContent`),/Asistencia guardada|Justificación de asistencia aprobada/)
  console.log('PASS: attendance save, actor records, error toast above retained approval modal, successful approval.')
  state.student=true
  await navigate('/academico/asistencia','Mis inasistencias')
  assert.equal(await evaluate(`!!document.querySelector('#attendance-student-reason')`),false,'Read-only attendance cannot submit justifications.')
  await open('updates');await until(`document.querySelectorAll('[data-notification-update]').length===2`)
  assert.match(await evaluate(`document.querySelector('#notifications-panel').textContent`),/Tu inasistencia fue justificada/)
  await screenshot('attendance-novedades-desktop')
  await evaluate(`document.querySelector('[data-notification-update]').click()`)
  await until(`location.pathname==='/academico/asistencia'&&!document.querySelector('#kt_menu_notifications.show')`)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await navigate('/academico/asistencia','Mis inasistencias');await open('updates')
  await until(`document.querySelectorAll('[data-notification-update]').length===2`)
  assert.ok(await evaluate(`(()=>{const r=document.querySelector('#kt_menu_notifications').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()`))
  await screenshot('attendance-novedades-mobile')
  assert.deepEqual(errors,[])
  console.log('PASS: persistent attendance-only news without Aula, student destination, read-only permissions and mobile dropdown.')
}
