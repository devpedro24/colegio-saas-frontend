import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import path from 'node:path'

export function eventsFixture(base, catalog, today) {
  const preview = spawnSync('php', [path.resolve(import.meta.dirname, '../../colegio-saas-backend/tests/Support/render-event-mail.php')], {encoding: 'utf8', windowsHide: true})
  assert.equal(preview.status, 0, 'The actual Laravel email template must render.')
  let event = {...base, estado: 'publicado', publicado_en: new Date().toISOString(), version: 1,
    origen: 'evento', enviar_correo: false, puede_editar: true, archivos: []}
  const writes = [], reads = [], readUrls = []
  let denseEvents = []
  const tasks = [{...event, categoria: 'tarea', institucional: false, url_token: 'z'.repeat(24), titulo: 'Tarea sin plazo', descripcion: 'Matemáticas',
    origen: 'aula', fecha: today, fecha_limite: null},
  {...event, categoria: 'tarea', institucional: false, url_token: 'q'.repeat(24), titulo: 'Tarea con plazo', descripcion: 'Matemáticas', origen: 'aula', fecha: today, fecha_limite: new Date().toISOString()}]
  const middleware = async (req, res, next) => {
    const path = new URL(req.url, 'http://localhost').pathname
    if (path === '/event-preview') {res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(preview.stdout); return}
    if (!path.startsWith('/api/eventos')) return next()
    const reply = (data, status = 200) => {res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data))}
    if (req.method === 'GET') {
      reads.push(path)
      readUrls.push(req.url)
      const category = new URL(req.url, 'http://localhost').searchParams.get('categoria')
      if (path === '/api/eventos/catalogo') return reply({data: {...catalog, puede_institucional: true}})
      if (path === '/api/eventos/resumen') return reply({data: category && category !== event.categoria ? [] : [{fecha: today, total: denseEvents.length + 1,
        titulo_unico: denseEvents.length ? null : event.titulo,
        marcas: [{categoria: event.categoria, estado: event.estado, total: denseEvents.length + 1}]}]})
      if (path === '/api/eventos/flujo') {
        if (category && category !== event.categoria) return reply({data: [], next_cursor: null})
        const url = new URL(req.url, 'http://localhost')
        const offset = Number(url.searchParams.get('cursor')?.replace('next-', '') ?? 0)
        const limit = offset ? 10 : 50
        const all = [event, ...denseEvents]
        return reply({data: all.slice(offset, offset + limit), next_cursor: offset + limit < all.length ? `next-${offset + limit}` : null})
      }
      if (path === '/api/eventos/tareas') return reply({data: tasks, last_page: 1})
      if (path === '/api/eventos') return reply({data: [event], last_page: 1})
      if (path === `/api/eventos/${event.url_token}`) return reply({data: event})
      return reply({message: 'Missing event'}, 404)
    }
    let raw = ''; for await (const chunk of req) raw += chunk
    const body = raw ? JSON.parse(raw) : {}
    writes.push({path, body, method: req.method})
    if (path.endsWith('/publicar')) {
      event = {...event, estado: 'publicado', publicado_en: new Date().toISOString(), version: event.version + 1,
        correos: {pendiente: event.enviar_correo ? 12 : 0, enviando: 0, enviado: 0, fallido: 0, cancelado: 0}}
      return reply({data: event})
    }
    if (path.endsWith('/correos/reintentar')) {
      event.correos.pendiente += event.correos.fallido; event.correos.fallido = 0
      return reply({data: null})
    }
    event = {...event, ...body, estado: req.method === 'POST' ? 'borrador' : event.estado,
      publicado_en: req.method === 'POST' ? null : event.publicado_en, version: event.version + 1}
    return reply({data: event}, req.method === 'POST' ? 201 : 200)
  }
  return {middleware, writes, reads, readUrls,
    populateDense: () => {denseEvents = Array.from({length: 300}, (_, i) => ({...event,
      url_token: 'd'.repeat(20) + String(i).padStart(4, '0'), titulo: `Encuentro escolar ${i + 1}`,
      created_at: event.created_at}))},
    failed: () => {event.correos = {pendiente: 0, enviando: 0, enviado: 11, fallido: 1, cancelado: 0}}}
}

export async function runEventsSmoke({navigate, evaluate, until, screenshot: capture, command, fixture, errors}) {
  const screenshot = async (...args) => {
    await until(`[...document.querySelectorAll('.modal.show')].every(e=>getComputedStyle(e).opacity==='1' && getComputedStyle(e.querySelector('.modal-dialog')).transform==='none')`)
    await capture(...args)
  }
  const click = async text => evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().replace(/^\\+\\s*/, '')===${JSON.stringify(text)})?.click()`)
  const fill = async (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await navigate('/comunicacion/eventos', 'Tarea sin plazo')
  assert.equal(await evaluate(`document.body.innerText.includes('Ver todos los eventos')`), false)
  assert.equal(await evaluate(`document.querySelector('select[aria-label="Filtrar por tipo de evento"] option:checked').textContent`), 'Todos los tipos de evento')
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Filtrar por tipo de evento"]');select.value='tarea';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`document.querySelector('.event-recent-card .badge')?.textContent==='2' && document.querySelectorAll('.event-preview').length===2`)
  assert.ok(await evaluate(`[...document.querySelectorAll('.event-preview h4')].every(node=>node.textContent.startsWith('Tarea'))`))
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Filtrar por tipo de evento"]');select.value='reunion';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`document.querySelector('.event-recent-card .badge')?.textContent==='0' && document.querySelectorAll('.event-preview').length===0`)
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Filtrar por tipo de evento"]');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`document.querySelector('.event-recent-card .badge')?.textContent==='3'`)
  assert.ok(await evaluate(`document.body.innerText.includes('Sin fecha límite: se muestra el día de publicación.')`))
  assert.ok(await evaluate(`document.body.innerText.includes('En el calendario por su fecha de entrega.')`))
  await screenshot('events-calendar-integrated')
  await click('Nuevo evento'); await until(`!!document.querySelector('#event-title')`)
  assert.equal(await evaluate(`!!document.querySelector('#event-category option[value=tarea]')`), false)
  assert.equal(await evaluate(`document.querySelector('#event-category').value`), '')
  assert.equal(await evaluate(`document.querySelector('#event-category option[value=""]').textContent`), 'Selecciona tipo de evento')
  assert.ok(await evaluate(`/^\\d{4}-\\d{2}-\\d{2}$/.test(document.querySelector('#event-date').value)`))
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('[data-testid="academic-page-header"]')).backgroundColor !== getComputedStyle(document.body).backgroundColor`))
  assert.equal(await evaluate(`document.querySelector('.event-mail-status input').checked`), false)
  await evaluate(`(()=>{const select=document.querySelector('#event-category');select.value='actividad';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await fill('event-title', 'Jornada del colegio')
  await fill('event-description', 'Descripción de prueba para estudiantes.')
  await evaluate(`document.querySelector('.event-group-picker input').click()`)
  await screenshot('events-create-desktop')
  await click('Guardar borrador')
  await until(`document.querySelector('.modal.show .badge')?.textContent==='Borrador'`)
  assert.equal(fixture.writes.length, 1)
  assert.equal(fixture.writes[0].body.enviar_correo, false)
  assert.equal(fixture.writes[0].body.grupo_tokens.length, 1)
  assert.ok(await evaluate(`!!document.querySelector('.toast')`))
  await click('Editar'); await until(`!!document.querySelector('#event-title')`)
  await evaluate(`document.querySelector('.event-mail-status input').click()`)
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  await screenshot('events-create-mobile')
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
  await click('Publicar evento')
  await until(`document.querySelector('.modal.show')?.textContent.includes('Pendientes: 12')`)
  assert.ok(fixture.writes.at(-1).path.endsWith('/publicar'))
  assert.equal(fixture.writes.at(-2).body.enviar_correo, true)
  await screenshot('events-published-mobile')
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  await click('Editar'); await until(`!!document.querySelector('#event-title')`)
  assert.equal(await evaluate(`document.querySelector('.event-mail-status input').disabled`), true)
  assert.equal(await evaluate(`document.querySelector('.event-group-picker input').disabled`), true)
  assert.equal(await evaluate(`!!document.querySelector('button[value=publish]')`), false)
  await click('Cancelar'); await click('Cerrar')
  fixture.failed()
  await navigate('/comunicacion/eventos?evento='+'i'.repeat(24), 'Notificaciones por correo')
  await until(`document.querySelector('.modal.show')?.textContent.includes('Requieren revisión: 1')`)
  await screenshot('events-mail-status-desktop')
  await click('Reintentar correos fallidos')
  await until(`document.querySelector('.modal.show')?.textContent.includes('Pendientes: 1')`)
  await click('Cerrar')
  await evaluate(`[...document.querySelectorAll('.event-preview')].find(e=>e.textContent.includes('Tarea sin plazo')).click()`)
  await until(`location.pathname.includes('/aula/recursos/')`)
  assert.equal(fixture.reads.includes('/api/eventos/'+'z'.repeat(24)), false, 'Classroom tasks do not open an event editor.')
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('i18nConfig',JSON.stringify({selectedLang:'en'}));`})
  await navigate('/comunicacion/eventos', 'Classroom task')
  await click('New event'); await until(`!!document.querySelector('#event-title')`)
  assert.equal(await evaluate(`document.querySelector('#event-category option[value=""]').textContent`), 'Select event type')
  assert.ok(await evaluate(`document.body.innerText.includes('Email event when publishing')`))
  await screenshot('events-create-english')
  await navigate('/event-preview', 'Feria de ciencias y creatividad')
  await screenshot('events-email-desktop')
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  await screenshot('events-email-mobile', true)
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'The branded email fits mobile screens.')
  fixture.populateDense()
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false})
  await navigate('/comunicacion/eventos', 'Recent events')
  await until(`document.querySelector('.event-recent-card .badge')?.textContent==='303'`)
  assert.equal(await evaluate(`document.querySelectorAll('.event-preview').length`), 50)
  assert.ok(await evaluate(`document.querySelector('.event-day.today .event-more-count')?.textContent.startsWith('+')`))
  const dotInfo = await evaluate(`[document.querySelectorAll('.event-day.today .event-dots i').length, document.querySelector('.event-day.today').clientWidth]`)
  assert.ok(dotInfo[0] >= 2, `Dots must expand horizontally when space allows: ${dotInfo}`)
  assert.equal(await evaluate(`!!document.querySelector('.event-day.today small')`), false)
  const heights = await evaluate(`[document.querySelector('.event-recent-card').getBoundingClientRect().height, document.querySelector('.event-calendar-grid').closest('.card').getBoundingClientRect().height]`)
  assert.ok(Math.abs(heights[0] - heights[1]) < 3, `Cards must match height: ${heights}`)
  await screenshot('events-dense-calendar')
  const octoberReads = fixture.readUrls.filter(url => url.includes('/api/eventos/resumen') && url.includes('desde=2026-10-01')).length
  await evaluate(`document.querySelector('button[aria-label="Next month"]').click()`)
  await until(`document.querySelector('input[type=month]').value==='2026-11'`)
  await evaluate(`document.querySelector('button[aria-label="Previous month"]').click()`)
  await until(`document.querySelector('input[type=month]').value==='2026-10'`)
  assert.equal(fixture.readUrls.filter(url => url.includes('/api/eventos/resumen') && url.includes('desde=2026-10-01')).length,
    octoberReads, 'Returning to a loaded month reuses the in-memory query cache.')
  await evaluate(`document.querySelector('.event-day.today').click()`)
  await until(`document.querySelectorAll('.event-preview').length===50`)
  const firstPageTitles = await evaluate(`[...document.querySelectorAll('.event-preview h4')].map(node=>node.textContent)`)
  const beforeMore = fixture.readUrls.filter(url => url.includes('/api/eventos/flujo')).length
  await evaluate(`[...document.querySelectorAll('.event-recent-card button')].find(b=>b.textContent.includes('Load 10 more')).click()`)
  await until(`document.querySelectorAll('.event-preview').length===60`)
  assert.equal(fixture.readUrls.filter(url => url.includes('/api/eventos/flujo')).length, beforeMore + 1)
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.event-preview h4')].slice(0,50).map(node=>node.textContent)`),
    firstPageTitles, 'Previously visible events must stay in the same positions when cursor pages share a timestamp.')
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.event-preview h4')].slice(50,60).map(node=>node.textContent)`),
    Array.from({length: 10}, (_, i) => `Encuentro escolar ${i + 50}`), 'Ten new events append below the first 50.')
  await screenshot('events-dense-day')
  assert.deepEqual(errors, [], 'No uncaught browser errors.')
  console.log('PASS: Events draft/publication, mail, tasks, ES/EN, desktop/mobile, 300-event calendar day and stable ten-item cursor loading.')
}
