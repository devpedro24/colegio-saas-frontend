import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'

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
    configuracion: {privacidad: 'Autorizo al colegio a tratar estos datos exclusivamente para revisar la solicitud de matrícula.', pin_expira_en: '2027-12-31T23:59',
      grados: [{token: grade, nombre: 'Primero', cupo: 30}], campos: [
        {key: 'representante_nombre', nombre: 'Nombre del representante legal', obligatorio: true, tipo: 'texto'},
        {key: 'representante_parentesco', nombre: 'Parentesco del representante', obligatorio: true, tipo: 'texto'},
        {key: 'representante_telefono', nombre: 'Teléfono del representante', obligatorio: true, tipo: 'texto'},
        {key: 'procedencia', nombre: 'Colegio de procedencia', obligatorio: false, tipo: 'texto'}],
      documentos: [{key: 'identidad', nombre: 'Documento de identidad', instrucciones: 'Adjunta una copia clara y completa.', obligatorio: true, formatos: ['pdf','png'], grados: []}]}}
  const app = {url_token: application, radicado: 'MAT-PRUEBA', estado: 'enviada', email: 'estudiante@example.test', grado_token: grade,
    campana: campaign, datos: {primer_nombre: 'Ana', primer_apellido: 'Pruebas', nacimiento: '2018-02-14', tipo_documento: 'TI', numero_documento: '1234567', direccion: 'Calle 1 # 2-3', adicionales: {procedencia: 'Colegio de ejemplo', representante_nombre: 'Lucero Pruebas', representante_parentesco: 'Mamá', representante_telefono: '+573174948808'}},
    documentos: [{url_token: 'D'.repeat(24), requisito: 'identidad', nombre: 'Identificacion.png', version: 1, estado: 'pendiente'}],
    historial: [{evento:'documento_cargado', observacion:'Documento de identidad (versión 1)', created_at:new Date().toISOString()}]}
  const settings = {version: 0, requiere_revision: true, privacidad: '', zona_horaria: 'America/Bogota', grados: [
    {url_token: 'R'.repeat(24), nombre: 'Primero', nivel: 'primaria', edad_min: null, edad_max: null},
    {url_token: 'T'.repeat(24), nombre: 'Segundo', nivel: 'primaria', edad_min: null, edad_max: null}]}
  const catalog = {anos: [{token: campaign.ano_token, nombre: '2027'}], grados: [
    {token: grade, nombre: 'Primero', ano_token: campaign.ano_token, regla_token: settings.grados[0].url_token},
    {token: 'H'.repeat(24), nombre: 'Segundo', ano_token: campaign.ano_token, regla_token: settings.grados[1].url_token}],
    campanas: [campaign], correo_operativo: true, zona_horaria: settings.zona_horaria}
  const presentCampaign = () => {
    campaign.zona_horaria = settings.zona_horaria
    if (settings.version > 0) campaign.configuracion.privacidad = settings.privacidad
    campaign.privacidad_version = createHash('sha256').update(campaign.configuracion.privacidad).digest('hex')
    if (settings.version > 0) campaign.configuracion.grados.forEach(g => {
      const ruleToken = catalog.grados.find(x => x.token === g.token)?.regla_token
      const range = settings.grados.find(x => x.url_token === ruleToken)
      Object.assign(g, {edad_min: range?.edad_min ?? null, edad_max: range?.edad_max ?? null})
    })
    return campaign
  }
  presentCampaign()
  let session = false, rejectNextSubmission = false
  const writes = []
  const mail = mailFixture(user, writes)
  const middleware = (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/ingreso')) return mail.middleware(req, res, next)
    const reply = (data, status = 200) => {res.statusCode = status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data))}
    if (req.method === 'GET') {
      if (url.pathname === '/api/ingreso-publico/ubicaciones') return reply({data: [{codigo: '41', nombre: 'HUILA', municipios: [{codigo: '41001', nombre: 'NEIVA'}]}, {codigo: '05', nombre: 'ANTIOQUIA', municipios: [{codigo: '05001', nombre: 'MEDELLÍN'}]}]})
      if (url.pathname === '/api/ingreso/configuracion') return user.permissions.includes('ingreso.configurar') ? reply({data: settings}) : reply({message: 'Forbidden'}, 403)
      if (url.pathname === '/api/ingreso-publico/catalogo') return reply({colegio: 'Colegio de prueba', zona_horaria: settings.zona_horaria,
        limites_envio: {max_file_bytes: 1000000000, max_submission_bytes: 1000000000, max_archivos: 20}})
      if (url.pathname === `/api/ingreso-publico/campanas/${token}`) return reply({data: presentCampaign()})
      if (url.pathname === '/api/ingreso-publico/solicitud') return session ? reply({data: app}) : reply({message:'Ingresa con correo y PIN'},401)
      if (url.pathname === '/api/ingreso/catalogo') return reply({...catalog, campanas: [presentCampaign()]})
      if (url.pathname.endsWith('/solicitudes')) return reply({data: [app], page: 1, last_page: 1, total: 1, grupos: [{token: group, grado_token: grade, nombre: 'Primero / 01A', cupo: 30}]})
      return reply({data: app})
    }
    let body = ''; req.on('data', c => {body += c}); req.on('end', () => {
      const upload = (req.headers['content-type'] ?? '').startsWith('multipart/form-data')
      const d = body && !upload ? JSON.parse(body) : {}; writes.push({path: url.pathname, data: d, csrf: req.headers['x-csrf-token']})
      if (url.pathname === '/api/ingreso/configuracion') {
        if (!user.permissions.includes('ingreso.configurar')) return reply({message: 'Forbidden'}, 403)
        if (d.version !== settings.version) return reply({message: 'Version conflict'}, 409)
        assert.deepEqual(Object.keys(d).sort(), ['grados', 'privacidad', 'version'])
        assert.ok(d.privacidad.trim().length >= 20 && d.privacidad.length <= 5000)
        for (const g of d.grados) {
          assert.deepEqual(Object.keys(g).sort(), ['edad_max', 'edad_min', 'url_token'])
          assert.ok((g.edad_min === null && g.edad_max === null) || (Number.isInteger(g.edad_min) && Number.isInteger(g.edad_max) && g.edad_min >= 1 && g.edad_min <= g.edad_max && g.edad_max <= 120))
          Object.assign(settings.grados.find(x => x.url_token === g.url_token), g)
        }
        settings.privacidad = d.privacidad; settings.version++; settings.requiere_revision = false
        presentCampaign()
        return reply({data: settings})
      }
      if (upload) {
        assert.equal(url.pathname, '/api/ingreso-publico/solicitud')
        assert.equal(req.headers['x-csrf-token'], 'intake-csrf')
        const match = body.match(/name="datos"\r\n\r\n([^\r]+)\r\n/)
        d.datos = JSON.parse(match[1]); d.enviar = true
        d.envio_token = body.match(/name="envio_token"\r\n\r\n([^\r]+)\r\n/)[1]
        d.privacidad_version = body.match(/name="privacidad_version"\r\n\r\n([^\r]+)\r\n/)[1]
        if (d.privacidad_version !== presentCampaign().privacidad_version) return reply({message: 'Aviso actualizado', errors: {privacidad_version: ['El aviso cambió (fixture).']}}, 422)
        if (rejectNextSubmission) {rejectNextSubmission = false; return reply({message: 'Revisa la fecha de nacimiento.', errors: {'datos.nacimiento': ['La fecha no coincide con el documento (fixture).']}}, 422)}
        assert.ok(body.includes('name="documentos[identidad]"'))
        const version = Math.max(...app.documentos.map(doc => doc.version), 0) + 1
        app.documentos.unshift({url_token:String(version).padStart(24,'N'), requisito:'identidad', nombre:'Identificacion-corregida.png', version, estado:'pendiente'})
        app.datos = d.datos; app.estado = 'enviada'
        return reply({data:app})
      }
      if (req.method === 'DELETE' && url.pathname === '/api/ingreso-publico/documentos/identidad') {app.documentos[0].estado = 'retirado'; return reply({data:app})}
      if (url.pathname.endsWith('/iniciar')) {res.setHeader('Set-Cookie', 'ingreso_challenge='+ 'b'.repeat(64) +'; Path=/api/ingreso-publico; HttpOnly; SameSite=Strict'); return reply({message: 'Revisa tu correo para obtener el PIN.'},202)}
      if (url.pathname === '/api/ingreso-publico/consultar') {session = true; res.setHeader('Set-Cookie', ['ingreso_csrf=intake-csrf; Path=/; SameSite=Strict']); return reply({data: app})}
      if (url.pathname === '/api/ingreso-publico/solicitud') {app.datos = d.datos; if (d.enviar) app.estado = 'enviada'; return reply({data: app})}
      if (url.pathname.includes('/documentos/')) {app.documentos[0].estado = d.estado; app.documentos[0].observacion = d.observacion; app.estado = d.estado === 'rechazado' ? 'correcciones' : 'revision'; app.historial.unshift({evento:`documento_${d.estado}`,observacion:`Documento de identidad: ${d.observacion ?? ''}`,created_at:new Date().toISOString()}); return reply({data: app})}
      if (url.pathname.endsWith('/decision')) {app.estado = d.estado; app.grado_aprobado_token = grade; return reply({data: app})}
      if (url.pathname.endsWith('/distribuir')) {if (d.confirmar) app.estado = 'matriculada'; return reply({asignaciones: [{solicitud_token: application, nombre:'Ana Pruebas', grupo_token:group, grupo:'01A'}], sin_cupo: 0})}
      if (url.pathname.includes('/campanas')) {
        assert.ok(!Object.hasOwn(d.configuracion, 'privacidad'))
        assert.ok(d.configuracion.grados.every(g => !Object.hasOwn(g, 'edad_min') && !Object.hasOwn(g, 'edad_max') && !Object.hasOwn(g, 'edad_corte')))
        const privacy = campaign.configuracion.privacidad
        Object.assign(campaign, d); campaign.configuracion.privacidad = privacy
        return reply({data:presentCampaign()})
      }
      reply({ok:true})
    })
  }
  return {middleware, writes, token, mail, app, settings, catalog, user, failSubmission: () => {rejectNextSubmission = true}}
}

export async function runEnrollmentSmoke({navigate: navigatePage, evaluate, until, screenshot, command, fixture, errors, apiReads, summaryOnly = false}) {
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
  if (summaryOnly) {
    const messages = {
      es: {management: 'Matrículas por enlace', configure: 'Configurar', duplicate: 'Duplicar para el próximo año', create: '+ Convocatoria', cancel: 'Cancelar', settings: 'Configuración de matrículas', level: 'Primaria', firstRange: 'De 6 a 8 años, incluidos', secondRange: 'De 9 a 12 años, incluidos', legacyRange: 'De 5 a 7 años, incluidos'},
      en: {management: 'Enrollment by link', configure: 'Configure', duplicate: 'Copy for next year', create: '+ Enrollment round', cancel: 'Cancel', settings: 'Enrollment settings', level: 'Primary', firstRange: '6 to 8 years, inclusive', secondRange: '9 to 12 years, inclusive', legacyRange: '5 to 7 years, inclusive'},
    }
    const summary = `document.querySelector('[aria-labelledby="campaign-institutional-summary"]')`
    const assertSummary = async expected => {
      await until(`${summary}?.textContent.includes(${JSON.stringify(expected)})`)
      assert.ok(await evaluate(`!${summary}.querySelector('input,textarea,select')`), 'The institutional summary stays read-only')
      assert.ok(await evaluate(`!!${summary}.querySelector('a[href="/ajustes-institucionales/matriculas"]')`))
    }
    const selectGrade = async token => {
      const grade = fixture.catalog.grados.find(g => g.token === token)
      await evaluate(`Array.from(document.querySelectorAll('.campaign-grades label')).find(label=>label.textContent.trim()===${JSON.stringify(grade.nombre)}).querySelector('input').click()`)
    }
    fixture.catalog.anos.push({token: 'Z'.repeat(24), nombre: '2028'})
    fixture.catalog.grados.push({...fixture.catalog.grados[0], token: 'J'.repeat(24), ano_token: 'Z'.repeat(24)})
    assert.ok(fixture.catalog.grados.every(g => g.token !== g.regla_token), 'Annual and institutional grade tokens must differ')
    // Annual grades in different years share institutional rules, never annual tokens.
    fixture.settings.version = 1
    fixture.settings.privacidad = 'Aviso institucional vigente para todas las convocatorias.'
    Object.assign(fixture.settings.grados[0], {edad_min: 6, edad_max: 8})
    Object.assign(fixture.settings.grados[1], {edad_min: 9, edad_max: 12})
    for (const locale of ['es', 'en']) {
      const copy = messages[locale]
      const languageScript = await command('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('i18nConfig',JSON.stringify({selectedLang:'${locale}'}));`})
      await navigate('/admisiones/solicitudes', copy.management)
      await click(copy.configure); await until(`!!document.getElementById('campaign-name')`)
      await assertSummary(copy.firstRange)
      await selectGrade(fixture.catalog.grados[1].token); await assertSummary(copy.secondRange)
      assert.ok(await evaluate(`${summary}.textContent.includes('Aviso institucional vigente')`))
      await click(copy.cancel); await until(`!document.querySelector('.modal.show')`)
      await click(copy.duplicate); await until(`!!document.getElementById('campaign-name')`)
      assert.equal(await evaluate(`document.getElementById('campaign-year').value`), 'Z'.repeat(24), 'Copied campaign uses the next year')
      assert.ok(await evaluate(`!document.getElementById('doc-size-0') && !document.getElementById('campaign-open').checked && [...document.querySelectorAll('.campaign-grades input[type=checkbox]')].filter(input=>input.checked).length===1`), 'Copy keeps mapped grades, starts closed and has no per-document size setting')
      await click(copy.cancel); await until(`!document.querySelector('.modal.show')`)
      await click(copy.create); await until(`!!document.getElementById('campaign-name')`)
      await selectGrade(fixture.catalog.grados[0].token); await assertSummary(copy.firstRange)
      await selectGrade(fixture.catalog.grados[1].token); await assertSummary(copy.secondRange)
      await fill('campaign-year', 'Z'.repeat(24))
      await until(`document.querySelectorAll('.campaign-grades label').length === 1`)
      assert.ok(await evaluate(`!${summary}.textContent.includes(${JSON.stringify(copy.secondRange)})`), 'Changing year clears old grade summaries')
      await selectGrade('J'.repeat(24)); await assertSummary(copy.firstRange)
      await screenshot(`matriculas-resumen-tokens-${locale}`)
      await click(copy.cancel); await until(`!document.querySelector('.modal.show')`)
      await navigate('/ajustes-institucionales/matriculas', copy.settings)
      await until(`!!document.getElementById('enrollment-privacy')`)
      assert.ok(await evaluate(`document.querySelector('[data-testid="enrollment-settings-card"]').textContent.includes(${JSON.stringify(copy.level)}) && ![...document.querySelectorAll('[data-testid="enrollment-settings-card"] p')].some(p=>p.textContent==='primaria')`), 'Canonical level uses the existing localized label')
      await command('Page.removeScriptToEvaluateOnNewDocument', {identifier: languageScript.identifier})
    }
    fixture.settings.version = 0
    fixture.app.campana.configuracion.privacidad = 'Aviso heredado que permanece vigente antes del primer guardado.'
    Object.assign(fixture.app.campana.configuracion.grados[0], {edad_min: 5, edad_max: 7})
    await navigate('/admisiones/solicitudes', messages.es.management)
    await click(messages.es.configure); await until(`!!document.getElementById('campaign-name')`)
    await assertSummary(messages.es.legacyRange)
    assert.ok(await evaluate(`${summary}.textContent.includes('Aviso heredado que permanece vigente')`))
    assert.equal(fixture.writes.length, 0, 'Viewing and editing summaries makes no writes')
    assert.deepEqual(errors, [])
    console.log('PASS: read-only summaries map distinct annual/institutional tokens for existing/new campaigns and another year; legacy ranges/privacy, localized levels and ES/EN; no writes or mail.')
    return
  }
  await navigate('/ajustes-institucionales/matriculas', 'Configuración de matrículas')
  await until(`!!document.getElementById('enrollment-privacy')`)
  const firstGrade = fixture.settings.grados[0].url_token
  const secondGrade = fixture.settings.grados[1].url_token
  assert.ok(await evaluate(`!document.querySelector('[data-testid="enrollment-settings-card"] select') && document.body.innerText.includes('Hay diferencias')`))
  assert.ok(await evaluate(`!!document.querySelector('[data-kt-nav="/ajustes-institucionales/matriculas"] .ki-setting-2')`))
  await evaluate(`document.getElementById('age-enabled-${firstGrade}').click()`)
  assert.equal(await evaluate(`document.getElementById('${firstGrade}-edad_min').value`), '', 'Enabling a range never guesses a default')
  await fill('enrollment-privacy', 'Aviso institucional de prueba para todas las convocatorias del colegio.')
  await fill(`${firstGrade}-edad_min`, '8')
  assert.ok(await evaluate(`document.querySelector('[data-testid="enrollment-settings-card"] button[type="submit"], [data-testid="enrollment-settings-card"] .btn-primary').disabled`), 'Both bounds are required')
  await fill(`${firstGrade}-edad_max`, '7')
  assert.ok(await evaluate(`document.getElementById('${firstGrade}-edad_max').validity.rangeUnderflow`))
  await fill(`${firstGrade}-edad_min`, '1'); await fill(`${firstGrade}-edad_max`, '120')
  await fill('enrollment-privacy', ' '.repeat(25))
  assert.ok(await evaluate(`document.querySelector('[data-testid="enrollment-settings-card"] .btn-primary').disabled`), 'Whitespace privacy cannot be saved')
  await fill('enrollment-privacy', 'Aviso institucional de prueba para todas las convocatorias del colegio.')
  const unrelatedBeforeSave = apiReads.filter(p => !p.startsWith('/api/ingreso')).length
  await click('Guardar configuración'); await until(`document.body.innerText.includes('Configuración de matrículas guardada.')`)
  assert.equal(fixture.settings.version, 1)
  assert.equal(fixture.settings.grados[1].edad_min, null)
  assert.equal(apiReads.filter(p => !p.startsWith('/api/ingreso')).length, unrelatedBeforeSave, 'Settings save does not refetch unrelated modules')
  await reload(); await until(`document.getElementById('${firstGrade}-edad_max')?.value === '120'`)
  await fill('enrollment-privacy', 'Cambios locales que deben conservarse durante un conflicto.')
  fixture.settings.version++
  await click('Guardar configuración'); await until(`document.body.innerText.includes('Otra persona actualizó')`)
  assert.equal(await evaluate(`document.getElementById('enrollment-privacy').value`), 'Cambios locales que deben conservarse durante un conflicto.')
  await click('Cargar versión actual'); await until(`document.getElementById('enrollment-privacy')?.value === 'Aviso institucional de prueba para todas las convocatorias del colegio.'`)
  await evaluate(`document.getElementById('age-enabled-${secondGrade}').click()`)
  await fill(`${secondGrade}-edad_min`, '6'); await fill(`${secondGrade}-edad_max`, '10')
  await evaluate(`document.getElementById('age-enabled-${secondGrade}').click()`)
  await click('Guardar configuración'); await until(`document.body.innerText.includes('Configuración de matrículas guardada.')`)
  assert.equal(fixture.settings.grados[1].edad_max, null)
  await screenshot('matriculas-institucionales-desktop', true)
  await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
  assert.ok(await evaluate(`(()=>{const button=document.querySelector('[data-testid="enrollment-settings-card"] .btn-primary'),card=button.closest('.card');return button.getBoundingClientRect().right <= card.getBoundingClientRect().right && card.getBoundingClientRect().right-button.getBoundingClientRect().right<40})()`))
  await screenshot('matriculas-institucionales-mobile', true)
  await command('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  fixture.user.permissions = fixture.user.permissions.filter(p => p !== 'ingreso.configurar')
  await navigate('/ajustes-institucionales/matriculas', 'eCommerce Dashboard')
  assert.ok(await evaluate(`!document.querySelector('[data-testid="enrollment-settings-card"]') && !document.querySelector('a[href="/ajustes-institucionales/matriculas"]')`))
  fixture.user.permissions.push('ingreso.configurar')
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
  assert.ok(await evaluate(`!document.getElementById('campaign-privacy') && !document.querySelector('.modal [id$="-edad_min"]') && !!document.querySelector('.modal a[href="/ajustes-institucionales/matriculas"]')`), 'Campaign rules are read-only and link to the same institutional page')
  await until(`getComputedStyle(document.querySelector('.modal.show')).opacity==='1'`)
  assert.equal(await evaluate(`document.getElementById('campaign-no-end').checked`), false, 'Existing dated campaign retains its end date')
  await evaluate(`document.getElementById('campaign-no-end').click()`)
  assert.ok(await evaluate(`document.getElementById('campaign-end').disabled && !document.getElementById('campaign-end').required`), 'No closing date disables date validation')
  await click('Guardar convocatoria'); await until(`!document.querySelector('.modal.show')`)
  assert.equal(fixture.writes.at(-1).data.hasta, null, 'Open-ended date is explicit null in API')
  await until(`!![...document.querySelectorAll('.toast-container .toast')].find(el => el.textContent.includes('Convocatoria guardada'))`)
  assert.equal(await evaluate(`!!document.querySelector('.alert-success')`), false, 'Saving a campaign uses the shared toast instead of a persistent success banner')
  await reload(); await until(`document.body.innerText.includes('Sin fecha de cierre')`)
  assert.ok(await evaluate(`document.querySelector('#manage-campaign option:checked').textContent.includes('Abierta · sin fecha de cierre')`), 'An enabled open-ended campaign is labeled as open without a closing date')
  await click('Configurar'); await until(`!!document.getElementById('campaign-name')`)
  assert.ok(await evaluate(`document.getElementById('campaign-no-end').checked`), 'Open-ended setting survives reload')
  await evaluate(`document.getElementById('campaign-open').click()`)
  await click('Guardar convocatoria'); await until(`!document.querySelector('.modal.show')`)
  await until(`document.querySelector('#manage-campaign option:checked').textContent.includes('No publicada')`)
  await click('Configurar'); await until(`!!document.getElementById('campaign-name')`)
  await evaluate(`document.getElementById('campaign-open').click()`)
  await click('Guardar convocatoria'); await until(`!document.querySelector('.modal.show')`)
  await click('Configurar'); await until(`!!document.getElementById('campaign-name')`)
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
  assert.equal(await evaluate(`document.getElementById('campaign-pin-expiry').value`), '2027-12-31T23:59', 'PIN expiration persists in the campaign editor')
  await evaluate(`document.getElementById('campaign-pin-no-expiry').click()`)
  assert.ok(await evaluate(`document.getElementById('campaign-pin-expiry').disabled && !document.querySelector('.modal.show').textContent.includes('15 minutos')`), 'No-expiration selection hides the date and the obsolete 15-minute warning')
  await click('Guardar convocatoria'); await until(`!document.querySelector('.modal.show')`)
  assert.equal(fixture.writes.at(-1).data.configuracion.pin_expira_en, null, 'The campaign can be explicitly saved without PIN expiration')
  await click('Configurar'); await until(`!!document.getElementById('campaign-pin-no-expiry')`)
  assert.equal(await evaluate(`document.getElementById('campaign-pin-no-expiry').checked`), true, 'No-expiration choice persists')
  await evaluate(`document.getElementById('campaign-pin-no-expiry').click()`)
  const beforeMissingPinDate = fixture.writes.length
  await fill('campaign-pin-expiry',''); await click('Guardar convocatoria')
  assert.equal(await evaluate(`document.getElementById('campaign-pin-expiry').validity.valueMissing`), true, 'PIN expiration is required')
  assert.equal(fixture.writes.length, beforeMissingPinDate)
  await fill('campaign-pin-expiry','2028-01-15T18:00')
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
  assert.equal(fixture.writes.at(-1).data.configuracion.pin_expira_en, '2028-01-15T18:00', 'The chosen PIN deadline is saved with the campaign')
  await click('Ver solicitud'); await until(`!!document.querySelector('.modal.show')`)
  await click('Revisar'); await fill('document-reason','La imagen debe mostrar el documento completo.'); await click('Solicitar corrección')
  await until(`document.body.innerText.includes('Requiere correcciones')`)
  await screenshot('ingreso-revision-desktop',true); await click('Cerrar')
  await navigate('/ingreso','Consulta tu matrícula')
  assert.equal(await evaluate(`!!document.getElementById('intake-campaign') || !!document.getElementById('intake-email')`), false, 'Tracking needs only the PIN on the school portal')
  assert.equal(await evaluate(`[0,1,2,3].every(i=>!!document.getElementById('intake-pin-'+i)) && !document.getElementById('intake-pin')`), true, 'Check enrollment defaults to four separate PIN cells')
  assert.ok(await evaluate(`(()=>{const hero=document.querySelector('.ingreso-hero').getBoundingClientRect();const card=document.querySelector('.ingreso-card').getBoundingClientRect();return Math.abs(hero.width-card.width)<2 && Math.abs(hero.left-card.left)<2})()`), 'The white enrollment card keeps the same full width as the header')
  await screenshot('ingreso-consulta-cuatro-casillas-desktop',true)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await screenshot('ingreso-consulta-cuatro-casillas-mobile',true)
  assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'PIN consultation must fit mobile')
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await fill('intake-pin-0','0427')
  await until(`[0,1,2,3].map(i=>document.getElementById('intake-pin-'+i).value).join('')==='0427'`)
  assert.equal(await evaluate(`!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Consultar matrícula').disabled`), true, 'Entering four digits enables consultation')
  assert.equal(await evaluate(`!document.body.innerText.includes('código anterior') && !document.getElementById('intake-pin')`), true, 'The old long-code option is absent from the public portal')
  await navigate(`/ingreso/${fixture.token}`,'Empecemos con tu correo')
  assert.equal(await evaluate(`!!document.getElementById('intake-campaign')`), false, 'The unique link fixes the campaign without asking the applicant to choose it')
  assert.equal(await evaluate(`document.body.innerText.includes('Seguimiento de mi solicitud')`), false, 'The campaign link does not have mode tabs')
  await navigate('/ingreso','Consulta tu matrícula')
  await navigate(`/ingreso/${fixture.token}#codigo`,'Empecemos con tu correo')
  assert.equal(await evaluate(`location.hash === '' && !!document.getElementById('intake-email')`), true, 'A stale #codigo link starts with the email step instead of pretending a PIN was sent')
  await fill('intake-email','estudiante@example.test'); await fill('intake-grade','G'.repeat(24)); await click('Recibir PIN y continuar')
  await until(`!!document.getElementById('intake-pin-0') && document.body.innerText.includes('Te enviamos el PIN')`)
  assert.equal(await evaluate(`location.hash === ''`), true, 'The temporary PIN screen does not contaminate the public URL')
  assert.equal(await evaluate(`!!document.getElementById('intake-email') || !!document.getElementById('intake-campaign') || document.body.innerText.includes('Recuperar PIN') || document.body.innerText.includes('Seguimiento de mi solicitud')`), false, 'PIN step is linear and asks for neither email, campaign nor recovery')
  assert.equal(await evaluate(`!![...document.querySelectorAll('.toast-container .toast')].find(el=>el.textContent.includes('PIN'))`), false, 'PIN-sent confirmation stays in the card, not a toast')
  await screenshot('ingreso-pin-cuatro-casillas-desktop',true)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await screenshot('ingreso-pin-cuatro-casillas-mobile',true)
  assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'Four PIN cells must fit mobile')
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await fill('intake-pin-0','0427')
  await until(`[0,1,2,3].map(i=>document.getElementById('intake-pin-'+i).value).join('')==='0427'`)
  await click('Continuar con la inscripción')
  await until(`!!document.querySelector('.ingreso-overview') && document.body.innerText.includes('Tu inscripción')`)
  assert.equal(await evaluate(`document.querySelector('.ingreso-public').innerText.includes('MAT-PRUEBA')`), false, 'The public form does not display the internal reference')
  assert.deepEqual(fixture.writes.at(-1), {path:'/api/ingreso-publico/consultar',data:{pin:'0427'},csrf:undefined}, 'The same browser sends the short PIN with its HttpOnly challenge cookie')
  await screenshot('ingreso-portal-desktop',true)
  assert.ok(await evaluate(`!!document.querySelector('.ingreso-age') && !!document.querySelector('.ingreso-relationship-options') && !!document.getElementById('data-address')`), 'Age, representative and required address are visible')
  assert.ok(await evaluate(`document.querySelector('.ingreso-public').getAttribute('translate')==='no' && !document.querySelector('.ingreso-save-bar')`), 'No draft save action remains')
  assert.ok(await evaluate(`(()=>{const button=document.querySelector('.ingreso-action-primary'),card=button.closest('.ingreso-card');return !!card && Math.abs(button.getBoundingClientRect().right-card.getBoundingClientRect().right)<40})()`), 'Final Submit stays inside its white card, aligned right')
  assert.ok(await evaluate(`(()=>{const card=document.querySelector('.ingreso-information-card');return card?.querySelectorAll('.ingreso-section-heading').length===3 && document.querySelector('.ingreso-student-form').querySelectorAll('.ingreso-card').length===1})()`), 'Student, representative and additional information share one white card')
  assert.ok(await evaluate(`(()=>{const boxes=[...document.querySelectorAll('.ingreso-relationship-options label')].map(el=>el.getBoundingClientRect());return Math.max(...boxes.map(b=>b.top))-Math.min(...boxes.map(b=>b.top))<2 && boxes.every(b=>b.height>=44)})()`), 'Relationship choices align on one row')
  const controlStyles = await evaluate(`(()=>{const label=document.querySelector('.ingreso-relationship-options label'),input=label.querySelector('input'),text=label.querySelector('span'),circle=document.querySelector('.ingreso-same-phone input');return {display:getComputedStyle(label).display,gap:text.getBoundingClientRect().left-input.getBoundingClientRect().right,radius:getComputedStyle(circle).borderRadius}})()`)
  assert.ok(controlStyles.display.includes('flex') && controlStyles.gap>=7 && controlStyles.radius==='50%', `Relationship radios have a visible gap and same-phone control is circular: ${JSON.stringify(controlStyles)}`)
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('.ingreso-action-primary')).backgroundColor==='rgb(81, 68, 184)'`), 'Final Submit retains the primary purple color')
  assert.ok(await evaluate(`(()=>{const img=document.querySelector('.ingreso-dial-menu summary img');return img?.complete && img.naturalWidth>0})()`), 'The calling-code control shows a real flag image')
  assert.ok(await evaluate(`(()=>{const summary=document.querySelector('.ingreso-dial-menu summary'),items=[summary.querySelector('img'),summary.querySelector('span'),summary.querySelector('.ingreso-dial-chevron')];const middle=summary.getBoundingClientRect().top+summary.getBoundingClientRect().height/2;return items.every(item=>Math.abs(item.getBoundingClientRect().top+item.getBoundingClientRect().height/2-middle)<2)})()`), 'Flag, dialing code and chevron are vertically centered')
  await evaluate(`document.querySelector('.ingreso-dial-menu summary').click()`)
  assert.ok(await evaluate(`(()=>{const menu=document.querySelector('.ingreso-dial-menu'),icon=menu.querySelector('.ingreso-dial-chevron i');return menu.open && icon.classList.contains('ki-down') && getComputedStyle(icon).transform!=='none'})()`), 'KeenIcons chevron turns upward while country list is open')
  assert.ok(await evaluate(`document.querySelector('.ingreso-dial-menu .ingreso-dial-options').querySelectorAll('button img').length===11`), 'Country options show local flag images')
  await screenshot('ingreso-indicativos-desktop')
  await evaluate(`document.querySelector('.ingreso-dial-options button').click()`)
  assert.ok(await evaluate(`document.querySelector('.ingreso-timeline').textContent.includes('Documento rechazado') && !document.querySelector('.ingreso-timeline').textContent.includes('Documento cargado')`), 'Tracking highlights review outcomes, not every upload')
  assert.ok(await evaluate(`(()=>{const pending=document.createElement('span');pending.className='ingreso-status';pending.dataset.status='pendiente';document.querySelector('.ingreso-document').append(pending);const color=getComputedStyle(pending).backgroundColor;pending.remove();return color==='rgb(255, 241, 205)'})()`), 'Pending review uses amber, not approval green')
  await fill('data-phone','3001234567')
  await fill('address-department', '41'); await fill('address-municipality', '41001')
  await fill('address-department', '05')
  assert.equal(await evaluate("document.getElementById('address-municipality').value"), '', 'Changing department clears municipality')
  await fill('address-department', '41'); await fill('address-municipality', '41001')
  const beforeSelection = fixture.writes.length
  await click('Retirar documento')
  assert.equal(fixture.app.documentos[0].estado, 'rechazado', 'Removing a file does not write to the server')
  await evaluate(`(()=>{const input=document.getElementById('upload-identidad');const transfer=new DataTransfer();transfer.items.add(new File(['fixture'],'Identificacion-corregida.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await until(`document.body.innerText.includes('Identificacion-corregida.png')`)
  assert.equal(fixture.writes.length, beforeSelection, 'Selecting/removing a file must not make an API write')
  await evaluate(`document.getElementById('intake-consent').click()`)
  await fill('data-primer_apellido', '')
  await click('Enviar a revisión')
  assert.equal(fixture.writes.length, beforeSelection, 'Missing first surname blocks submission')
  await fill('data-primer_apellido', '   ')
  await click('Enviar a revisión')
  assert.equal(fixture.writes.length, beforeSelection, 'Whitespace is not a required surname')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('label[for="data-primer_apellido"]'),'::after').color`), 'rgb(197, 47, 75)')
  await fill('data-primer_apellido', 'Pruebas')
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await screenshot('ingreso-portal-mobile',true)
  assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'Public form must fit mobile')
  fixture.settings.privacidad = 'Aviso actualizado del colegio para revisar y aceptar antes de enviar.'
  fixture.settings.version++
  await click('Enviar a revisión')
  await until(`document.body.innerText.includes('El aviso cambió (fixture).')`)
  assert.ok(await evaluate(`document.getElementById('intake-consent').disabled && !document.getElementById('intake-consent').checked && document.body.innerText.includes('Identificacion-corregida.png')`))
  await click('Cargar y revisar aviso actual')
  await until(`document.body.innerText.includes('Aviso actualizado del colegio para revisar y aceptar antes de enviar.')`)
  assert.ok(await evaluate(`!document.getElementById('intake-consent').checked && document.body.innerText.includes('Identificacion-corregida.png') && document.getElementById('data-primer_apellido').value === 'Pruebas'`), 'Reloading the notice preserves the form and local files, and requires new consent')
  await evaluate(`document.getElementById('intake-consent').click()`)
  fixture.failSubmission()
  await click('Enviar a revisión')
  await until(`document.body.innerText.includes('La fecha no coincide con el documento (fixture).')`)
  assert.ok(await evaluate(`document.body.innerText.includes('Identificacion-corregida.png') && document.getElementById('data-primer_apellido').value === 'Pruebas'`), 'Failed submission retains selected files and form data')
  assert.equal(fixture.app.estado, 'correcciones', 'Failed submission does not transition the application')
  const failedKey = fixture.writes.at(-1).data.envio_token
  await click('Enviar a revisión')
  await until(`document.body.innerText.includes('Solicitud enviada.')`)
  assert.equal(fixture.writes.at(-1).data.envio_token, failedKey, 'Retry retains its submission key')
  assert.equal(fixture.writes.length, beforeSelection + 3, 'Only final submissions and retries carry data/files')
  assert.equal(fixture.writes.at(-1).data.privacidad_version, fixture.app.campana.privacidad_version)
  assert.equal(fixture.writes.at(-1).data.datos.telefono, '+573001234567')
  await reload(); await until(`document.getElementById('data-phone')?.value === '3001234567'`)
  assert.ok(await evaluate(`!Object.values(localStorage).some(v=>v.includes('A'.repeat(32))||v.includes('estudiante@example.test'))`),'No personal data or PIN persisted locally')
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await navigatePage('/ingreso/'+fixture.token+'#solicitud='+'a'.repeat(64),'Te enviamos el PIN')
  await until(`document.body.innerText.includes('Te enviamos el PIN')`)
  assert.equal(await evaluate(`!!document.getElementById('intake-pin-0') && !document.body.innerText.includes('MAT-PRUEBA')`), true, 'Private email link asks for its PIN even when another session exists')
  assert.equal(await evaluate(`document.body.innerText.includes('Corregir correo o grado')`), false, 'Private email link does not offer to change the email or grade')
  await fill('intake-pin-0','0427'); await click('Continuar con la inscripción')
  await until(`!!document.querySelector('.ingreso-overview')`)
  assert.deepEqual(fixture.writes.at(-1).data, {pin:'0427',access:'a'.repeat(64)}, 'Email link sends its private secret only when verifying the PIN')
  await navigate('/admisiones/solicitudes','Matrículas por enlace'); await until(`document.body.innerText.includes('MAT-PRUEBA')`)
  await click('Ver solicitud'); await until(`document.body.innerText.includes('Documentos y versiones')`); await click('Revisar'); await click('Aprobar documento')
  await until(`!document.getElementById('document-reason')`); await click('Aprobar solicitud')
  await until(`document.body.innerText.includes('Asignación individual')`); await fill('approved-group','Q'.repeat(24)); await click('Revisar asignación')
  await until(`document.body.innerText.includes('Confirmar asignación de grupos')`); await click('Confirmar matrículas')
  await until(`document.body.innerText.includes('Grupos asignados y matrículas confirmadas.')`)
  // A separate language pass checks actual rendered text, not just catalog existence.
  const englishScript = await command('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('i18nConfig',JSON.stringify({selectedLang:'en'}));`})
  await navigate('/ajustes-institucionales/matriculas', 'Enrollment settings')
  await until(`!!document.getElementById('enrollment-privacy')`)
  assert.ok(await evaluate(`document.body.innerText.includes('No age restriction') && document.body.innerText.includes('Save settings')`))
  await screenshot('matriculas-institucionales-en-desktop', true)
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
  await until(`document.body.innerText.includes('Student information') && document.body.innerText.includes('Enrollment confirmed')`)
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
