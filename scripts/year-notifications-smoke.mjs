import assert from 'node:assert/strict'

export function yearNotificationsFixture() {
  const records = []
  let attempts = 0
  const middleware = (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    const send = (data, status = 200) => {res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data))}
    if (url.pathname === '/api/notification-records') {
      send({data: [...records].reverse(), meta: {current_page: 1, last_page: 1, total: records.length}})
      return
    }
    if (req.method === 'GET' && url.pathname.endsWith('/estado-copia')) {
      send({data: {origen_token: null, opciones: {}, reemplazable: true}}); return
    }
    if (req.method === 'GET' && url.pathname.endsWith('/resumen-duplicacion')) {send({data: null}); return}
    if (!['POST', 'PUT', 'DELETE'].includes(req.method) || !/^\/api\/(anos-lectivos|periodos)/.test(url.pathname)) {next(); return}
    let body = ''
    req.on('data', chunk => {body += chunk})
    req.on('end', () => {
      const input = JSON.parse(body || '{}')
      const success = input.nombre === '2029'
      const event = url.pathname.endsWith('/duplicar') ? 'year.duplicar' : url.pathname.endsWith('/copiar-configuracion') ? 'year.copiarConfiguracion'
        : url.pathname.includes('/periodos') ? 'period.store' : req.method === 'PUT' ? 'year.update' : 'year.store'
      const message = 'Revisa los datos del año lectivo.'
      const token = String(++attempts).padStart(24, 'x')
      records.push({token, event, variant: success ? 'success' : 'danger', subject: success ? input.nombre : '',
        message: success ? null : message, created_at: new Date().toISOString()})
      res.setHeader('X-Notification-Record', token)
      send(success ? {data: {url_token: 'y'.repeat(24), ...input}} : {message, errors: {nombre: [message]}}, success ? 201 : 422)
    })
  }
  return {middleware, records}
}

export async function runYearNotificationsSmoke({navigate, evaluate, until, command, screenshot, errors}) {
  const clickText = text => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button');b.click()})()`)
  const submit = () => evaluate(`document.querySelector('.modal.show form').requestSubmit()`)
  const clearToasts = () => evaluate(`document.querySelectorAll('.app-toast-close').forEach(b=>b.click())`)
  const closeModal = async () => {await evaluate(`document.querySelector('.modal.show .modal-footer .btn-light').click()`);await until(`!document.querySelector('.modal.show')`);await clearToasts()}
  const assertOverlay = async () => {
    await until(`!!document.querySelector('.app-toast--danger')`)
    const result = await evaluate(`(()=>{const toast=document.querySelector('.app-toast--danger'),r=toast.getBoundingClientRect(),region=toast.closest('.app-toast-region');return {modal:!!document.querySelector('.modal.show'),onTop:!!document.elementFromPoint(r.left+20,r.top+20)?.closest('.app-toast'),hidden:!!region.closest('[aria-hidden="true"]'),inside:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}})()`)
    assert.deepEqual(result, {modal:true,onTop:true,hidden:false,inside:true})
  }
  await navigate('/academico/anos-lectivos', 'Años lectivos')
  await clickText('Nuevo año lectivo')
  await until(`!!document.querySelector('.modal.show form')`)
  const original = await evaluate(`document.querySelector('.modal.show input[type="text"]').value`)
  await submit();await assertOverlay()
  assert.equal(await evaluate(`document.querySelector('.modal.show input[type="text"]').value`), original)
  assert.ok(await evaluate(`!!document.querySelector('.modal.show .invalid-feedback')`), 'Field guidance remains beside the input.')
  await screenshot('year-error-toast-above-modal')
  await closeModal()

  await evaluate(`document.querySelector('tbody button.btn-icon.btn-light-primary').click()`)
  await until(`!!document.querySelector('.modal.show form')`)
  await submit();await assertOverlay();await closeModal()

  await evaluate(`document.querySelector('tbody .btn-light-primary:not(.btn-icon)').click()`)
  await until(`!!document.querySelector('.academic-year-dialog form')`)
  await submit();await assertOverlay()
  assert.equal(await evaluate(`document.querySelectorAll('.modal.show .alert-danger').length`), 0)
  await closeModal()

  await evaluate(`document.querySelector('tbody .btn-light-info').click()`)
  await until(`!!document.querySelector('#copy-year-source')`)
  await evaluate(`(()=>{const s=document.querySelector('#copy-year-source');s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.modal.show input[type="checkbox"]').click()})()`)
  await until(`!document.querySelector('.modal.show button[type="submit"]').disabled`)
  await submit();await assertOverlay()
  assert.equal(await evaluate(`document.querySelectorAll('.modal.show .alert-danger').length`), 0)
  await closeModal()

  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await clickText('Nuevo año lectivo');await until(`!!document.querySelector('.modal.show form')`)
  await submit();await assertOverlay();await screenshot('year-error-toast-mobile');await closeModal()
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})

  await clickText('Nuevo año lectivo');await until(`!!document.querySelector('.modal.show form')`)
  await evaluate(`(()=>{const e=document.querySelector('.modal.show input[type="text"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2029');e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await submit();await until(`!document.querySelector('.modal.show') && !!document.querySelector('.app-toast--success')`)
  await clearToasts()
  const openRecords = async () => {
    const pos = await evaluate(`(()=>{const r=document.querySelector('[aria-controls="kt_menu_notifications"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`)
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',...pos})
    await until(`document.querySelector('#kt_menu_notifications').classList.contains('show')`)
    await evaluate(`document.querySelector('#notifications-tab-logs').click()`)
    await until(`document.querySelectorAll('[data-notification-record]').length===6`)
  }
  await openRecords()
  assert.ok(await evaluate(`document.querySelector('[data-testid="notification-records"]').textContent.includes('Año lectivo creado')`))
  assert.ok(await evaluate(`document.querySelector('[data-testid="notification-records"]').textContent.includes('2029')`))
  await screenshot('year-notification-records')
  await navigate('/academico/anos-lectivos', 'Años lectivos')
  await openRecords()
  assert.equal(await evaluate(`document.querySelectorAll('[data-notification-record]').length`), 6, 'Records survive reload without duplication.')
  assert.deepEqual(errors,[])
  console.log('PASS: create/edit/duplicate/copy errors retain modals and inputs, visible accessible toast over backdrop on desktop/mobile, success closes form, bell records survive reload.')
}
