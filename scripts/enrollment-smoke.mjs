import assert from 'node:assert/strict'

// Every mail endpoint is served in memory. Unknown mail routes fail closed.
function mailFixture(user, writes) {
  const requests = [], reads = []
  let connection = {configurado: false, email: null, nombre: null, verificado_en: null, transporte_plataforma: false, requiere_autorizacion: false}
  let activeColegio = null, readFailure = false, denyNextWrite = false, perPage = 1
  const latest = () => requests.at(-1) ?? null
  const settings = () => {
    const request = latest()
    if (request?.estado === 'aprobada' && Date.parse(request.vence_en) <= Date.now()) request.estado = 'vencida'
    const own = user.roles.includes('rector') && !user.is_platform && !activeColegio
    const granted = own && request?.estado === 'aprobada'
    return {...connection, puede_editar: own && (!connection.requiere_autorizacion || (granted && request.accion === 'editar')),
      puede_desconectar: !!(connection.configurado && granted && request.accion === 'desconectar'), solicitud: request}
  }
  const platformRow = request => ({...request, disponible: request.disponible !== false,
    colegio: request.colegio ?? {slug: 'colegio-prueba', nombre: 'Colegio de prueba'}, solicitante: 'Rector de prueba'})
  const middleware = (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    const reply = (data, status = 200) => {res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data))}
    if (url.pathname === '/api/platform/impersonar/estado') return reply({data: {colegio: activeColegio}})
    if (!/^\/api\/(correo-institucional|platform\/correo-solicitudes)(\/|$)/.test(url.pathname)) return next()
    if (req.method === 'GET') {
      reads.push(url.pathname + url.search)
      if (readFailure) return reply({message: 'No se pudo consultar el correo (fixture).'}, 503)
      if (url.pathname === '/api/correo-institucional') return reply(settings())
      if (!user.is_platform || activeColegio) return reply({message: 'Solo plataforma.'}, 403)
      if (url.pathname.endsWith('/resumen')) return reply({pendientes: requests.filter(row => row.estado === 'pendiente').length})
      if (url.pathname === '/api/platform/correo-solicitudes') {
        const state = url.searchParams.get('estado') ?? 'pendiente', page = Number(url.searchParams.get('page') ?? 1)
        if (!['pendiente', 'todas'].includes(state)) return reply({message: 'Estado no permitido'}, 422)
        const rows = requests.filter(row => state === 'todas' || row.estado === state).map(platformRow)
        return reply({data: rows.slice((page - 1) * perPage, page * perPage), meta: {current_page: page, last_page: Math.max(1, Math.ceil(rows.length / perPage)), total: rows.length, per_page: perPage}})
      }
      return reply({message: 'Missing mail fixture'}, 404)
    }
    let body = ''
    req.on('data', chunk => {body += chunk})
    req.on('end', () => {
      const data = body ? JSON.parse(body) : {}
      writes.push({path: url.pathname, method: req.method, data, csrf: req.headers['x-csrf-token']})
      assert.equal(req.headers['x-csrf-token'], 'smoke-csrf')
      if (url.pathname.startsWith('/api/platform/')) {
        if (!user.is_platform || activeColegio) return reply({message: 'Solo plataforma.'}, 403)
        const token = url.pathname.split('/')[4], request = requests.find(row => row.url_token === token)
        if (!request || request.estado !== 'pendiente') return reply({message: 'La solicitud ya fue resuelta.'}, 409)
        if (request.disponible === false) return reply({message: 'Colegio temporalmente no disponible'}, 503)
        const observationLength = data.observacion?.trim().length ?? 0
        if ((data.decision === 'rechazar' && observationLength === 0) || (data.observacion != null && (observationLength < 10 || observationLength > 1000))) return reply({message: 'La observación debe tener de 10 a 1000 caracteres.'}, 422)
        request.estado = data.decision === 'aprobar' ? 'aprobada' : 'rechazada'
        request.observacion = data.observacion ?? null
        request.vence_en = data.decision === 'aprobar' ? new Date(Date.now() + 86400000).toISOString() : null
        return reply({data: platformRow(request)})
      }
      if (user.is_platform || activeColegio || !user.roles.includes('rector')) return reply({message: 'Solo el rector.'}, 403)
      if (url.pathname === '/api/correo-institucional/solicitudes' && req.method === 'POST') {
        if (latest()?.estado === 'pendiente') return reply({message: 'Ya hay una solicitud pendiente.'}, 409)
        if (!['editar', 'desconectar'].includes(data.accion) || data.motivo.trim().length < 10 || data.motivo.length > 1000) return reply({message: 'Motivo inválido.'}, 422)
        requests.push({url_token: `mail${String(requests.length + 1).padStart(20, '0')}`, estado: 'pendiente', accion: data.accion,
          motivo: data.motivo, observacion: null, creada_en: new Date().toISOString(), vence_en: null})
        return reply(settings())
      }
      if (url.pathname !== '/api/correo-institucional' || !['PUT','DELETE'].includes(req.method)) return reply({message: 'Missing mail fixture'}, 404)
      const allowed = req.method === 'DELETE' ? settings().puede_desconectar : settings().puede_editar
      if (!allowed || denyNextWrite) {denyNextWrite = false; if (latest()) latest().estado = 'obsoleta'; return reply({message: 'Necesitas una autorización propia y vigente.'}, 403)}
      connection = req.method === 'DELETE'
        ? {...connection, configurado: false, email: null, nombre: null, verificado_en: null, transporte_plataforma: false}
        : {configurado: true, email: data.email, nombre: data.nombre, verificado_en: new Date().toISOString(), transporte_plataforma: true, requiere_autorizacion: true}
      if (latest()) latest().estado = 'utilizada'
      return reply(settings())
    })
  }
  return {middleware, reads, requests, latest, settings,
    pageSize: value => {perPage = value},
    failReads: value => {readFailure = value}, denyWrite: () => {denyNextWrite = true},
    impersonate: value => {activeColegio = value},
    actor: role => {user.is_platform = role === 'superadmin'; user.role = role; user.roles = [role]; user.tenant_channel = role === 'superadmin' ? null : 't'.repeat(24)},
    state: (state, expires = null) => {Object.assign(latest(), {estado: state, vence_en: expires})}}
}

export function enrollmentFixture(user) {
  user.permissions.push('config.correo', 'academico.configurar')
  user.permissions.push(...['ver','configurar','revisar','decidir','cambiar_grado','asignar'].map(p => `ingreso.${p}`))
  const token = 'E'.repeat(24), application = 'S'.repeat(24), grade = 'G'.repeat(24), group = 'Q'.repeat(24)
  const campaign = {url_token: token, nombre: 'Matrículas 2027', ano_token: 'Y'.repeat(24), abierta: true,
    desde: '2026-01-01', hasta: '2027-12-31', enlace: `http://127.0.0.1:5197/ingreso/${token}`,
    configuracion: {privacidad: 'Autorizo al colegio a tratar estos datos exclusivamente para revisar la solicitud de matrícula.',
      grados: [{token: grade, nombre: 'Primero', cupo: 30}], campos: [{key: 'procedencia', nombre: 'Colegio de procedencia', obligatorio: false, tipo: 'texto'}],
      documentos: [{key: 'identidad', nombre: 'Documento de identidad', instrucciones: 'Adjunta una copia clara y completa.', obligatorio: true, formatos: ['pdf','png'], max_mb: 5, grados: []}]}}
  const app = {url_token: application, radicado: 'MAT-PRUEBA', estado: 'enviada', email: 'estudiante@example.test', grado_token: grade,
    campana: campaign, datos: {primer_nombre: 'Ana', primer_apellido: 'Pruebas', nacimiento: '2018-02-14', tipo_documento: 'TI', numero_documento: '1234567', adicionales: {procedencia: 'Colegio de ejemplo'}},
    documentos: [{url_token: 'D'.repeat(24), requisito: 'identidad', nombre: 'Identificacion.png', version: 1, estado: 'pendiente'}], historial: []}
  let session = false
  const writes = []
  const mail = mailFixture(user, writes)
  const middleware = (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/ingreso')) return mail.middleware(req, res, next)
    const reply = (data, status = 200) => {res.statusCode = status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data))}
    if (req.method === 'GET') {
      if (url.pathname === '/api/ingreso-publico/catalogo') return reply({colegio: 'Colegio de prueba', campanas: [campaign]})
      if (url.pathname === '/api/ingreso-publico/solicitud') return session ? reply({data: app}) : reply({message:'Ingresa con correo y PIN'},401)
      if (url.pathname === '/api/ingreso/catalogo') return reply({anos: [{token: campaign.ano_token, nombre: '2027'}], grados: [{token: grade, nombre: 'Primero', ano_token: campaign.ano_token}, {token: 'H'.repeat(24), nombre: 'Segundo', ano_token: campaign.ano_token}], campanas: [campaign], correo_operativo: true})
      if (url.pathname.endsWith('/solicitudes')) return reply({data: [app], page: 1, last_page: 1, total: 1, grupos: [{token: group, grado_token: grade, nombre: 'Primero / 01A', cupo: 30}]})
      return reply({data: app})
    }
    let body = ''; req.on('data', c => {body += c}); req.on('end', () => {
      const upload = (req.headers['content-type'] ?? '').startsWith('multipart/form-data')
      const d = body && !upload ? JSON.parse(body) : {}; writes.push({path: url.pathname, data: d, csrf: req.headers['x-csrf-token']})
      if (upload) {app.documentos.unshift({url_token:'N'.repeat(24), requisito:'identidad', nombre:'Identificacion-corregida.png', version:2, estado:'pendiente'}); return reply({data:app},201)}
      if (url.pathname.endsWith('/iniciar')) return reply({message: 'Revisa tu correo para obtener el PIN.'},202)
      if (url.pathname.endsWith('/acceder')) {session = true; res.setHeader('Set-Cookie', ['ingreso_csrf=intake-csrf; Path=/; SameSite=Strict']); return reply({data: app})}
      if (url.pathname === '/api/ingreso-publico/solicitud') {app.datos = d.datos; if (d.enviar) app.estado = 'enviada'; return reply({data: app})}
      if (url.pathname.includes('/documentos/')) {app.documentos[0].estado = d.estado; app.documentos[0].observacion = d.observacion; app.estado = d.estado === 'rechazado' ? 'correcciones' : 'revision'; return reply({data: app})}
      if (url.pathname.endsWith('/decision')) {app.estado = d.estado; app.grado_aprobado_token = grade; return reply({data: app})}
      if (url.pathname.endsWith('/distribuir')) {if (d.confirmar) app.estado = 'matriculada'; return reply({asignaciones: [{solicitud_token: application, nombre:'Ana Pruebas', grupo_token:group, grupo:'01A'}], sin_cupo: 0})}
      if (url.pathname.includes('/campanas')) {Object.assign(campaign, d); return reply({data:campaign})}
      reply({ok:true})
    })
  }
  return {middleware, writes, token, mail}
}

export async function runEnrollmentSmoke({navigate: navigatePage, evaluate, until, screenshot, command, fixture, errors, apiReads}) {
  const navigate = async (route, text) => {
    const previous = await evaluate('performance.timeOrigin')
    await navigatePage(route, text)
    await until(`performance.timeOrigin !== ${previous} && document.body.innerText.includes(${JSON.stringify(text)})`)
  }
  const reload = async () => {
    const previous = await evaluate('performance.timeOrigin')
    await command('Page.reload')
    await until(`performance.timeOrigin !== ${previous} && document.readyState === 'complete'`)
  }
  const click = async text => {
    const button = `Array.from(document.querySelectorAll(document.querySelector('.modal.show') ? '.modal.show button' : 'button')).find(b=>b.getClientRects().length && b.textContent.trim()===${JSON.stringify(text)})`
    await until(`!!${button} && !${button}.disabled`)
    return evaluate(`${button}.click()`)
  }
  const fill = (id, value) => evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)}); const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`)
  await navigate('/ajustes-institucionales/correo','Conexión de correo electrónico')
  await until(`!!document.getElementById('school-mail-email')`)
  await screenshot('correo-institucional-inicial-desktop',true)
  await fill('school-mail-email','colegio@example.test'); await fill('school-mail-name','Colegio de prueba'); await fill('school-mail-password','abcdefghijklmnop')
  await click('Probar y guardar conexión'); await until(`document.body.innerText.includes('Google aceptó el correo de prueba')`)
  const summary = `document.querySelector('[data-testid="school-mail-summary"]')?.textContent.includes('colegio@example.test')`
  await until(summary)
  await screenshot('correo-institucional-desktop',true)
  assert.equal(await evaluate(`!!document.getElementById('school-mail-email')`), false, 'Saved sender is a summary, not an editable form')
  await reload(); await until(summary)
  assert.equal(await evaluate(`!!document.getElementById('school-mail-password')`), false)
  assert.ok(await evaluate(`!JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]).includes('abcdefghijklmnop')`))
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await screenshot('correo-institucional-mobile',true)
  assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  assert.ok(await evaluate(`!!document.querySelector('[data-testid="institutional-settings-panel"] a[data-kt-nav="/ajustes-institucionales/correo"] .ki-sms')`))
  assert.ok(await evaluate(`!document.querySelector('#kt_app_header_menu a[href="/ajustes-institucionales/correo"]')`))
  const baseline = apiReads.length
  const request = async action => {
    await click('Solicitar autorización'); await until(`!!document.getElementById('mail-request-reason')`)
    await fill('mail-request-action', action); await fill('mail-request-reason', 'corto')
    assert.ok(await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Enviar solicitud').disabled`))
    await fill('mail-request-reason', 'Necesitamos actualizar el remitente <b>institucional</b>.')
    await until(`getComputedStyle(document.querySelector('.modal.show')).opacity === '1'`)
    await screenshot('correo-solicitar-autorizacion')
    await click('Enviar solicitud'); await until(`document.body.innerText.includes('Esperando respuesta del superadministrador') && !document.querySelector('.modal.show')`)
  }
  const platform = async () => {
    fixture.mail.actor('superadmin')
    await navigate('/dashboard', 'eCommerce Dashboard')
    await until(`document.querySelector('[data-testid="school-mail-notification"]')?.getAttribute('aria-label').includes('1 pendientes')`)
    await evaluate(`document.querySelector('[data-testid="school-mail-notification"]').click()`)
    await until(`location.pathname === '/configuracion/correo-solicitudes' && !!document.querySelector('[data-testid="mail-request-row"]')`)
    assert.ok(fixture.mail.reads.includes('/api/platform/correo-solicitudes?estado=pendiente&page=1'))
    assert.deepEqual(await evaluate(`[...document.querySelector('#mail-requests-filter').options].map(o=>o.value)`), ['pendiente','todas'])
    assert.ok(await evaluate(`document.querySelector('[data-testid="mail-request-row"]').textContent.includes('Solicitante: Rector de prueba') && !document.querySelector('[data-testid="mail-request-row"]').textContent.includes('@')`), 'Platform requester is a name, not an email')
    assert.ok(await evaluate(`document.querySelector('[data-testid="mail-request-row"]').textContent.includes('<b>institucional</b>') && !document.querySelector('[data-testid="mail-request-row"] b')`), 'Reasons render as plain text')
  }
  const rector = async () => {
    fixture.mail.actor('rector')
    await navigate('/ajustes-institucionales/correo', 'Conexión de correo electrónico')
    await until(`!!document.querySelector('[data-testid="school-mail-request"]')`)
  }
  const approve = async () => {
    await platform()
    await screenshot('correo-solicitudes-pendientes-desktop', true)
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    await screenshot('correo-solicitudes-pendientes-mobile', true)
    assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
    await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
    const beforeResolve = apiReads.length
    await click('Aprobar'); await until(`!!document.getElementById('mail-resolution-observation')`)
    assert.ok(await evaluate(`![...document.querySelectorAll('button')].find(b=>b.textContent==='Confirmar aprobación').disabled`), 'Approval accepts an empty observation')
    await fill('mail-resolution-observation', 'corto')
    assert.ok(await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirmar aprobación').disabled`), 'Approval also rejects short observations')
    assert.equal(await evaluate(`document.getElementById('mail-resolution-observation').maxLength`), 1000)
    await fill('mail-resolution-observation', 'Autorización revisada para esta acción.')
    assert.ok(await evaluate(`![...document.querySelectorAll('button')].find(b=>b.textContent==='Confirmar aprobación').disabled`))
    if (fixture.mail.requests.length % 2 === 1) await fill('mail-resolution-observation', '')
    await until(`getComputedStyle(document.querySelector('.modal.show')).opacity === '1'`)
    await screenshot('correo-resolver-autorizacion')
    await click('Confirmar aprobación'); await until(`document.body.innerText.includes('Solicitud aprobada.')`)
    await until(`document.querySelector('[data-testid="school-mail-notification"]')?.getAttribute('aria-label').includes('0 pendientes')`)
    assert.ok(!await evaluate(`document.querySelector('[data-testid="school-mail-notification"] .badge') !== null`))
    assert.deepEqual(apiReads.slice(beforeResolve).filter(path=>['/api/me','/api/onboarding/status','/api/estructura/sedes','/api/colegios'].includes(path)), [], 'Resolving mail requests must not reload unrelated queries')
    await rector()
  }
  await request('editar')
  assert.ok(await evaluate(`!document.getElementById('school-mail-email') && ![...document.querySelectorAll('button')].some(b=>b.textContent==='Solicitar autorización')`))
  await click('Actualizar estado'); await until(summary)
  assert.equal(fixture.writes.filter(w=>w.path.endsWith('/correo-institucional/solicitudes')).length, 1)
  assert.deepEqual(apiReads.slice(baseline).filter(path=>['/api/me','/api/onboarding/status','/api/estructura/sedes'].includes(path)), [], 'Mail requests must not reload identity or academic state')
  await reload(); await until(`document.body.innerText.includes('Esperando respuesta del superadministrador')`)
  await screenshot('correo-institucional-pendiente', true)
  await approve()
  await until(`document.getElementById('school-mail-email')?.value === 'colegio@example.test'`)
  await screenshot('correo-institucional-autorizado', true)
  await fill('school-mail-name', 'Colegio autorizado'); await fill('school-mail-password', 'abcdefghijklmnop')
  await reload(); await until(`!!document.getElementById('school-mail-password')`)
  assert.equal(await evaluate(`document.getElementById('school-mail-password').value`), '')
  await fill('school-mail-name', 'Colegio autorizado'); await click('Probar y guardar conexión')
  await until(`document.querySelector('[data-testid="school-mail-summary"]')?.textContent.includes('Colegio autorizado')`)
  assert.equal(fixture.mail.latest().estado, 'utilizada')
  assert.ok(!await evaluate(`!!document.getElementById('school-mail-email')`))
  await request('desconectar'); await platform()
  await click('Rechazar'); await until(`!!document.getElementById('mail-resolution-observation')`)
  await fill('mail-resolution-observation', 'corto')
  assert.ok(await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirmar rechazo').disabled`))
  await fill('mail-resolution-observation', 'Conserva el correo <b>actual</b> por ahora.')
  await click('Confirmar rechazo'); await until(`document.body.innerText.includes('Solicitud rechazada.')`)
  await fill('mail-requests-filter', 'todas'); await until(`document.body.innerText.includes('2 solicitudes')`)
  assert.ok(fixture.mail.reads.includes('/api/platform/correo-solicitudes?estado=todas&page=1'))
  await click('Siguiente'); await until(`document.body.innerText.includes('Página 2 de 2')`)
  await screenshot('correo-solicitudes-desktop', true)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await screenshot('correo-solicitudes-mobile', true)
  assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await rector(); await until(`document.body.innerText.includes('Conserva el correo <b>actual</b> por ahora.')`)
  await request('editar'); await approve()
  fixture.mail.denyWrite()
  await click('Probar y guardar conexión'); await until(`document.body.innerText.includes('Necesitas una autorización propia y vigente.')`)
  assert.ok(await evaluate(summary), '403 keeps the saved sender')
  await until(`!document.getElementById('school-mail-email')`)
  fixture.mail.failReads(true); await click('Actualizar estado')
  await until(`document.body.innerText.includes('No se pudo consultar el correo (fixture).')`)
  assert.ok(await evaluate(summary), 'A failed refresh does not pretend the sender was cleared')
  fixture.mail.failReads(false); await click('Actualizar estado')
  await until(`!document.body.innerText.includes('No se pudo consultar el correo (fixture).')`)
  await request('editar'); fixture.mail.state('aprobada', new Date(Date.now() + 86400000).toISOString())
  await click('Actualizar estado'); await until(`!!document.getElementById('school-mail-email')`)
  fixture.mail.state('aprobada', new Date(Date.now() + 1800).toISOString())
  await click('Actualizar estado'); await until(`document.body.innerText.includes('Vencida') && !document.getElementById('school-mail-email')`)
  fixture.mail.actor('secretaria'); await navigate('/ajustes-institucionales/correo', 'eCommerce Dashboard')
  assert.ok(await evaluate(`location.pathname === '/dashboard' && !document.getElementById('school-mail-email') && !document.querySelector('a[href="/ajustes-institucionales/correo"]')`), 'Delegated config.correo grants no mail route, tab or link')
  await navigate('/configuracion/correo-solicitudes', 'eCommerce Dashboard')
  assert.ok(await evaluate(`location.pathname==='/dashboard' && !document.querySelector('[data-testid="school-mail-notification"]')`))
  fixture.mail.actor('superadmin'); fixture.mail.impersonate({slug:'otro-colegio', name:'Otro colegio', channel_token:'x'.repeat(24)})
  const readsBefore = fixture.mail.reads.length
  await navigate('/configuracion/correo-solicitudes', 'eCommerce Dashboard')
  assert.ok(await evaluate(`location.pathname==='/dashboard' && !document.querySelector('[data-testid="school-mail-notification"]')`))
  assert.ok(!fixture.mail.reads.slice(readsBefore).some(path=>path.startsWith('/api/platform/correo-solicitudes')), 'No central mail reads while impersonating')
  fixture.mail.impersonate(null); await rector()
  await request('desconectar'); await approve()
  assert.ok(await evaluate(`!document.getElementById('school-mail-email')`), 'Disconnect grant cannot edit')
  await click('Desconectar Gmail'); await click('Confirmar desconexión'); await until(`document.body.innerText.includes('Conexión eliminada')`)
  assert.equal(fixture.mail.settings().requiere_autorizacion, true, 'Disconnection preserves the protected row')
  await reload(); await until(`document.body.innerText.includes('Sin Gmail conectado')`)
  await screenshot('correo-institucional-desconectado', true)
  assert.ok(await evaluate(`!document.getElementById('school-mail-email')`), 'Reconnect still needs a new edit grant')
  await request('editar'); await approve(); await until(`!!document.getElementById('school-mail-password')`)
  await fill('school-mail-email', 'colegio@example.test'); await fill('school-mail-name', 'Colegio reconectado'); await fill('school-mail-password', 'abcdefghijklmnop')
  await click('Probar y guardar conexión'); await until(summary)
  assert.ok(await evaluate(`!JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]).includes('abcdefghijklmnop')`))
  const unavailable = {...fixture.mail.latest(), url_token: 'offline'.padEnd(24, 'x'), estado: 'pendiente', disponible: false,
    colegio: {slug: 'colegio-offline', nombre: 'Colegio sin conexión'}}
  const available = {...unavailable, url_token: 'online'.padEnd(24, 'x'), disponible: true,
    colegio: {slug: 'colegio-online', nombre: 'Colegio disponible'}}
  fixture.mail.requests.push(unavailable, available); fixture.mail.pageSize(20); fixture.mail.actor('superadmin')
  await navigate('/configuracion/correo-solicitudes', 'Colegio temporalmente no disponible')
  await until(`document.querySelectorAll('[data-testid="mail-request-row"]').length === 2`)
  assert.ok(await evaluate(`(()=>{const rows=[...document.querySelectorAll('[data-testid="mail-request-row"]')];return rows[0].textContent.includes('Pendiente') && [...rows[0].querySelectorAll('button')].every(b=>b.disabled) && [...rows[1].querySelectorAll('button')].every(b=>!b.disabled)})()`), 'Unavailable schools retain their state without hiding or disabling other schools')
  await screenshot('correo-solicitudes-disponibilidad-mixta', true)
  await evaluate(`document.querySelectorAll('[data-testid="mail-request-row"]')[1].querySelector('button').click()`)
  await until(`!!document.getElementById('mail-resolution-observation')`)
  available.disponible = false
  await click('Confirmar aprobación'); await until(`document.querySelector('.modal.show [role="alert"]')?.textContent.includes('Colegio temporalmente no disponible')`)
  assert.equal(available.estado, 'pendiente', '503 must not claim a resolution')
  await until(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirmar aprobación')?.disabled`)
  await screenshot('correo-solicitudes-error-503')
  await click('Cancelar'); await until(`!document.querySelector('[aria-labelledby="resolve-mail-title"]') && !document.querySelector('.modal-backdrop')`)
  await screenshot('correo-solicitudes-no-disponible', true)
  await rector()
  await navigate('/admisiones/solicitudes','Matrículas por enlace')
  let academicHeaderStyle
  const readHeaderStyle = `(()=>{
    const header=document.querySelector('[data-testid="academic-page-header"]');
    const card=getComputedStyle(header), body=getComputedStyle(header.querySelector('.card-body'));
    const title=getComputedStyle(header.querySelector('h3')), help=getComputedStyle(header.querySelector('p'));
    return [card.borderRadius,card.backgroundColor,card.boxShadow,body.padding,title.fontSize,title.fontFamily,title.fontWeight,help.fontSize,help.color];
  })()`
  for (const [route, title, icon] of [
    ['seleccion', 'Selección previa, entrevistas y pruebas', 'user-tick'],
    ['matriculas', 'Gestión de Matrículas', 'address-book'],
    ['solicitudes', 'Convocatoria', 'document'],
  ]) {
    const path = `/admisiones/${route}`
    const link = `document.querySelector('#kt_app_header_menu a[data-kt-nav=${JSON.stringify(path)}]')`
    assert.ok(await evaluate(`!!${link}?.querySelector('.ki-${icon}')`), `${route} has a distinct header icon`)
    await evaluate(`${link}.click()`)
    await until(`location.pathname === ${JSON.stringify(path)} && document.body.innerText.includes(${JSON.stringify(title)})`)
    assert.equal(await evaluate(`!!document.querySelector('nav[aria-label="Ingreso estudiantil"]')`), false, 'No duplicate navigation bar')
    await until(`!!document.querySelector('[data-testid="academic-page-header"]')`)
    const style = await evaluate(readHeaderStyle)
    if (!academicHeaderStyle) academicHeaderStyle = style
    assert.deepEqual(style, academicHeaderStyle, `${route} uses the same card, spacing and typography`)
    assert.equal(await evaluate(`document.body.innerText.includes('Admisiones y matrícula')`), false)
    await screenshot(`ingreso-${route}-estilo-desktop`, true)
  }
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  let mobileHeaderStyle
  for (const [route, title] of [['matriculas','Gestión de Matrículas'],['seleccion','Selección previa, entrevistas y pruebas'],['solicitudes','Convocatoria']]) {
    await navigate(`/admisiones/${route}`, title)
    await until(`!!document.querySelector('[data-testid="academic-page-header"]')`)
    const style = await evaluate(readHeaderStyle)
    if (!mobileHeaderStyle) mobileHeaderStyle = style
    assert.deepEqual(style, mobileHeaderStyle, 'Shared header remains consistent on mobile')
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), `${route} fits mobile width`)
    await screenshot(`ingreso-${route}-estilo-mobile`, true)
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await reload()
  await until(`document.body.innerText.includes('MAT-PRUEBA')`)
  await screenshot('ingreso-gestion-desktop',true)
  await click('Configurar'); await until(`!!document.getElementById('campaign-name')`)
  await until(`getComputedStyle(document.querySelector('.modal.show')).opacity==='1'`)
  assert.equal(await evaluate(`document.getElementById('campaign-no-end').checked`), false, 'Existing dated campaign retains its end date')
  await evaluate(`document.getElementById('campaign-no-end').click()`)
  assert.ok(await evaluate(`document.getElementById('campaign-end').disabled && !document.getElementById('campaign-end').required`), 'No closing date disables date validation')
  await click('Guardar convocatoria'); await until(`!document.querySelector('.modal.show')`)
  assert.equal(fixture.writes.at(-1).data.hasta, null, 'Open-ended date is explicit null in API')
  await reload(); await until(`document.body.innerText.includes('Sin fecha de cierre')`)
  await click('Configurar'); await until(`!!document.getElementById('campaign-name')`)
  assert.ok(await evaluate(`document.getElementById('campaign-no-end').checked`), 'Open-ended setting survives reload')
  await evaluate(`document.getElementById('campaign-no-end').click()`)
  assert.ok(await evaluate(`document.getElementById('campaign-end').required && !document.getElementById('campaign-end').disabled`), 'Scheduled mode requires date again')
  const beforeMissingDate = fixture.writes.length
  await click('Guardar convocatoria')
  assert.equal(await evaluate(`document.getElementById('campaign-end').validity.valueMissing`), true)
  assert.equal(fixture.writes.length, beforeMissingDate)
  await fill('campaign-end', '2027-12-31')
  await click('Guardar convocatoria'); await until(`!document.querySelector('.modal.show')`)
  assert.equal(fixture.writes.at(-1).data.hasta, '2027-12-31', 'A closing date can be reinstated')
  await click('Configurar'); await until(`!!document.getElementById('campaign-name')`)
  await evaluate(`document.getElementById('campaign-no-end').click()`)
  await until(`getComputedStyle(document.querySelector('.modal.show')).opacity==='1'`)
  const gradeColumns = `(()=>{const rows=[...document.querySelectorAll('.campaign-grades > div')].map(el=>el.getBoundingClientRect());return {sameRow:Math.abs(rows[0].top-rows[1].top)<2,stacked:rows[1].top>=rows[0].bottom,sameLeft:Math.abs(rows[0].left-rows[1].left)<2};})()`
  assert.ok((await evaluate(gradeColumns)).sameRow, 'Grades and capacities use two columns on desktop')
  const fieldAlignment = `(()=>{const parent=document.querySelector('.campaign-field-options');const items=[parent.querySelector('select'),parent.querySelector('label'),parent.querySelector('input'),parent.querySelector('button')].map(el=>el.getBoundingClientRect());const centers=items.map(rect=>rect.top+rect.height/2);return Math.max(...centers)-Math.min(...centers);})()`
  assert.ok(await evaluate(fieldAlignment) < 2, 'Required checkbox, label and actions align horizontally')
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[aria-label="Formatos del documento 1"] label')].filter(el=>el.querySelector('input').checked).map(el=>el.textContent)`), ['PDF','PNG','Obligatorio'], 'Editing preserves previously selected formats')
  const writesBeforeInvalid = fixture.writes.length
  await fill('doc-help-0',''); await click('Guardar convocatoria')
  assert.equal(await evaluate(`document.getElementById('doc-help-0').validity.valueMissing`), true)
  assert.equal(fixture.writes.length, writesBeforeInvalid, 'Incomplete document is not submitted')
  await fill('doc-help-0','   '); await click('Guardar convocatoria')
  assert.equal(await evaluate(`document.getElementById('doc-help-0').checkValidity()`), false)
  assert.equal(fixture.writes.length, writesBeforeInvalid, 'Whitespace is not a description')
  await fill('doc-help-0','Adjunta una copia clara y completa.')
  await click('+ Documento')
  assert.equal(await evaluate(`[...document.querySelectorAll('[aria-label="Formatos del documento 2"] label')].filter(el=>['PDF','JPG','PNG','DOCX'].includes(el.textContent)).some(el=>el.querySelector('input').checked)`), false, 'New document formats default unchecked')
  assert.equal(await evaluate(`[...document.querySelectorAll('.modal button')].find(el=>el.textContent==='Guardar convocatoria').disabled`), true, 'At least one format must be chosen')
  await evaluate(`document.getElementById('doc-name-1').closest('section').querySelector('button').click()`)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  const mobileGrades = await evaluate(gradeColumns)
  assert.ok(mobileGrades.stacked && mobileGrades.sameLeft, 'Grade cards stack on mobile')
  assert.ok(await evaluate(fieldAlignment) < 2, 'Field actions stay aligned on mobile')
  assert.ok(await evaluate(`document.querySelector('.modal-body').scrollWidth <= document.querySelector('.modal-body').clientWidth + 1`), 'Modal does not overflow horizontally')
  await evaluate(`document.querySelector('.campaign-grades').scrollIntoView({block:'center'})`)
  await screenshot('ingreso-configuracion-grados-mobile')
  await evaluate(`document.querySelector('.campaign-field-options').scrollIntoView({block:'center'})`)
  await screenshot('ingreso-configuracion-campos-mobile')
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await evaluate(`document.querySelector('.campaign-field-options').scrollIntoView({block:'center'})`)
  await screenshot('ingreso-configuracion-campos-desktop')
  await evaluate(`document.querySelector('.modal-body').scrollTop=0`)
  await fill('campaign-name','Matrículas 2027 · nuevos estudiantes'); await until(`getComputedStyle(document.querySelector('.modal.show')).opacity==='1'`); await screenshot('ingreso-configuracion-desktop',true)
  await click('Guardar convocatoria'); await until(`!document.querySelector('.modal.show')`)
  await click('Ver solicitud'); await until(`!!document.querySelector('.modal.show')`)
  await click('Revisar'); await fill('document-reason','La imagen debe mostrar el documento completo.'); await click('Solicitar corrección')
  await until(`document.body.innerText.includes('Requiere correcciones')`)
  await screenshot('ingreso-revision-desktop',true); await click('Cerrar')
  await navigate(`/ingreso/${fixture.token}`,'Empecemos con tu correo')
  await fill('intake-email','estudiante@example.test'); await fill('intake-grade','G'.repeat(24)); await click('Recibir PIN y continuar')
  await until(`!!document.getElementById('intake-pin')`); await fill('intake-pin','PIN-DE-PRUEBA'); await click('Ingresar con PIN')
  await until(`document.body.innerText.includes('MAT-PRUEBA')`)
  await screenshot('ingreso-portal-desktop',true)
  await fill('data-telefono','3001234567'); await click('Guardar borrador')
  await until(`document.body.innerText.includes('Borrador guardado')`)
  assert.equal(fixture.writes.at(-1).csrf,'intake-csrf','Public portal must use its own CSRF cookie, not rector credentials')
  await evaluate(`(()=>{const input=document.getElementById('upload-identidad');const transfer=new DataTransfer();transfer.items.add(new File(['fixture'],'Identificacion-corregida.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await until(`document.body.innerText.includes('Identificacion-corregida.png')`)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await screenshot('ingreso-portal-mobile',true)
  assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'Public form must fit mobile')
  await evaluate(`document.getElementById('intake-consent').click()`); await click('Enviar a revisión')
  await until(`document.body.innerText.includes('Solicitud enviada.')`)
  await reload(); await until(`document.getElementById('data-telefono')?.value === '3001234567'`)
  assert.ok(await evaluate(`!Object.values(localStorage).some(v=>v.includes('PIN-DE-PRUEBA')||v.includes('estudiante@example.test'))`),'No personal data or PIN persisted locally')
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await navigate('/admisiones/solicitudes','Matrículas por enlace'); await until(`document.body.innerText.includes('MAT-PRUEBA')`)
  await click('Ver solicitud'); await until(`document.body.innerText.includes('Documentos y versiones')`); await click('Revisar'); await click('Aprobar documento')
  await until(`!document.getElementById('document-reason')`); await click('Aprobar solicitud')
  await until(`document.body.innerText.includes('Asignación individual')`); await fill('approved-group','Q'.repeat(24)); await click('Revisar asignación')
  await until(`document.body.innerText.includes('Confirmar asignación de grupos')`); await click('Confirmar matrículas')
  await until(`document.body.innerText.includes('Grupos asignados y matrículas confirmadas.')`)
  // A separate language pass checks actual rendered text, not just catalog existence.
  const englishScript = await command('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('i18nConfig',JSON.stringify({selectedLang:'en'}));`})
  await navigate('/admisiones/solicitudes','Enrollment by link')
  assert.ok(await evaluate(`document.querySelector('#kt_app_header_menu').innerText.includes('Student intake') && document.querySelector('#kt_app_header_menu').innerText.includes('Communication')`))
  await click('Configure'); await until(`!!document.getElementById('campaign-name')`)
  await until(`document.querySelector('.modal.show')?.innerText.includes('No closing date') && document.querySelector('.modal.show')?.innerText.includes('Allow applications through the link')`)
  await click('+ Document'); await click('+ Field')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Document 2 formats"]') !== null`), true)
  assert.equal(await evaluate(`document.querySelector('[aria-label="Field 2 name"]') !== null`), true)
  await until(`getComputedStyle(document.querySelector('.modal.show')).opacity==='1'`)
  await screenshot('ingreso-convocatoria-en-desktop')
  await click('Cancel'); await until(`!document.querySelector('.modal.show')`)
  await click('View application'); await until(`document.body.innerText.includes('Documents and versions')`)
  await screenshot('ingreso-revision-en-desktop'); await click('Close')
  await navigate('/admisiones/seleccion','Admissions')
  assert.ok(await evaluate(`document.body.innerText.includes('Preselection, interviews and tests')`))
  await navigate('/ajustes-institucionales/correo','Email connection')
  assert.ok(await evaluate(`document.body.innerText.includes('Your school email, connected') && document.body.innerText.includes('How to get the password')`))
  await screenshot('correo-en-desktop',true)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await navigate('/admisiones/solicitudes','Enrollment by link'); await click('Configure')
  await until(`getComputedStyle(document.querySelector('.modal.show')).opacity==='1'`)
  assert.ok(await evaluate(`document.querySelector('.modal-body').scrollWidth <= document.querySelector('.modal-body').clientWidth+1`))
  await screenshot('ingreso-convocatoria-en-mobile'); await click('Cancel')
  await navigate(`/ingreso/${fixture.token}`,'Student enrollment')
  assert.ok(await evaluate(`document.body.innerText.includes('Student information') && document.body.innerText.includes('Enrollment confirmed')`))
  await screenshot('ingreso-portal-en-mobile',true)
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  fixture.mail.actor('superadmin')
  await navigate('/configuracion/correo-solicitudes','Email connection requests')
  assert.ok(await evaluate(`document.body.innerText.includes('Each approval authorizes the requesting principal')`))
  await screenshot('correo-solicitudes-en-desktop',true)
  await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:englishScript.identifier})
  fixture.mail.actor('rector')
  await navigate('/admisiones/solicitudes','Matrículas por enlace')
  assert.deepEqual(errors,[])
  console.log('PASS: fixture-only mail approval, rejection, one-use grants, expiry, 403/503, unavailable schools, protected disconnect/reconnect, role gates, badge, pagination, secrets and mobile; enrollment workflow.')
}
