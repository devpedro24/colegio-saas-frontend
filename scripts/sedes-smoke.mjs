import assert from 'node:assert/strict'

export const contactOptions = {countries: [
  {country: 'CO', calling_code: '57', lengths: [10], pattern: '3[0-9]{9}', leading_digits: null, example: '3211234567', timezones: ['America/Bogota']},
  {country: 'US', calling_code: '1', lengths: [10], pattern: '201[0-9]{7}', leading_digits: null, example: '2015550123', timezones: ['America/New_York']},
  {country: 'GB', calling_code: '44', lengths: [10], pattern: '7[0-9]{9}', leading_digits: null, example: '7400123456', timezones: ['Europe/London']}
]}

export function sedesFixture() {
  const principal = {
    url_token: 'p'.repeat(24),
    nombre: 'Principal',
    estado: 'activa',
    principal: true,
    slug: 'colegio',
    tenant_slug: null,
    tenant_domain: 'colegio.localhost',
    capacidad_maxima: 100
  }
  const state = {rows: [principal], fail: false, writes: [], whatsapp: '573001234567'}
  return {
    state,
    middleware(req, res, next) {
      const url = new URL(req.url, 'http://localhost')
      const contact = url.pathname === '/api/platform/contact-setting'
      if (
        !contact &&
        !url.pathname.startsWith('/api/estructura/sedes') &&
        !url.pathname.startsWith('/api/colegios/colegio-prueba/sedes')
      )
        return next()
      const send = (body, status = 200) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      }
      if (contact) {
        if (req.method === 'GET')
          return send({whatsapp: state.whatsapp, url: `https://wa.me/${state.whatsapp}`})
        let raw = ''
        req.on('data', (part) => (raw += part))
        req.on('end', () => {
          state.whatsapp = JSON.parse(raw).whatsapp?.replace(/^\+/, '') ?? null
          send({
            whatsapp: state.whatsapp,
            url: state.whatsapp ? `https://wa.me/${state.whatsapp}` : null
          })
        })
        return
      }
      if (url.pathname.endsWith('/opciones'))
        return send({
          capacidad: {contratados: 200, asignados: 100, disponibles: 100},
          matriculados: 0,
          dominio: 'colegio.localhost',
          colegio: 'Colegio de prueba',
          celular_pais: 'CO',
          contacto: {whatsapp: state.whatsapp, url: `https://wa.me/${state.whatsapp}`},
          coordinadores: [
            {url_token: 'c'.repeat(24), nombre: 'Ana Coordinadora', correo: 'ana@example.test', rol: 'coord_combinado'}
          ],
          departamentos: [
            {codigo: '41', nombre: 'Huila', municipios: [{codigo: '41001', nombre: 'Neiva'}]},
            {
              codigo: '11',
              nombre: 'Bogotá D.C.',
              municipios: [{codigo: '11001', nombre: 'Bogotá D.C.'}]
            }
          ],
          dependencias: {
            periodos: ['anos'],
            grupos: ['anos', 'niveles', 'grados', 'jornadas'],
            grados: ['anos', 'niveles'],
            niveles: ['anos'],
            jornadas: ['anos']
          }
        })
      if (req.method === 'GET')
        return send({
          data: state.rows,
          meta: {current_page: 1, last_page: 1, per_page: 10, total: state.rows.length}
        })
      let raw = ''
      req.on('data', (part) => (raw += part))
      req.on('end', () => {
        const input = JSON.parse(raw || '{}')
        state.writes.push(input)
        if (state.fail)
          return send(
            {message: 'No se pudo guardar la sede.', errors: {nombre: ['Este nombre ya existe.']}},
            422
          )
        const item = {
          ...input,
          url_token: 'n'.repeat(24),
          principal: false,
          tenant_slug: input.slug,
          tenant_domain: `${input.slug}.colegio.localhost`,
          coordinador_name: 'Ana Coordinadora',
          coordinador_email: 'ana@example.test'
        }
        state.rows = [principal, item]
        send({data: item}, req.method === 'POST' ? 201 : 200)
      })
    }
  }
}

export async function runSedesSmoke({
  fixture,
  user,
  navigate,
  evaluate,
  until,
  command,
  screenshot,
  errors
}) {
  const change = async (id, value) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`
    )
  await navigate('/ajustes-institucionales/sedes', 'Sedes')
  await until(`!![...document.querySelectorAll('button')].find(e=>e.textContent.includes('Nuevo'))`)
  await evaluate(
    `[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Nuevo')).click()`
  )
  await until(`document.querySelector('#sede-coordinator')?.options.length===2`)
  await until(`document.querySelector('#sede-phone').maxLength===10`)
  assert.ok(await evaluate(`document.querySelector('#sede-city').disabled && getComputedStyle(document.querySelector('#sede-city')).cursor==='not-allowed'`))
  assert.ok(await evaluate(`['sede-name','sede-slug','sede-address','sede-phone'].every(id=>document.getElementById(id).placeholder.length>0)`))
  assert.ok(await evaluate(`document.querySelector('#sede-coordinator').textContent.includes('(Coordinador académico y de convivencia)')`))
  await change('sede-name', 'Sede Norte')
  await change('sede-slug', 'norte')
  await change('sede-department', '41')
  assert.equal(await evaluate(`document.querySelector('#sede-city').options.length`), 2)
  assert.equal(
    await evaluate(`document.querySelector('#sede-city').textContent.includes('Bogotá')`),
    false
  )
  await change('sede-city', '41001')
  await change('sede-coordinator', 'c'.repeat(24))
  await change('sede-capacity', '101')
  await until(`document.querySelector('.modal.show button[type=submit]').disabled`)
  const contact = new URL(await evaluate(`document.querySelector('.modal.show a[href^="https://wa.me/"]')?.href`))
  assert.equal(contact.origin + contact.pathname, 'https://wa.me/573001234567')
  assert.match(contact.searchParams.get('text'), /Colegio de prueba/)
  assert.match(contact.searchParams.get('text'), /Sede Norte/)
  assert.match(contact.searchParams.get('text'), /201 estudiantes/)
  assert.match(contact.searchParams.get('text'), /ampliación de 1 cupo/)
  await screenshot('sedes-capacity-desktop')
  await change('sede-capacity', '100')
  await change('sede-phone', '30012345678')
  assert.equal(await evaluate(`document.getElementById('sede-phone').checkValidity()`), false)
  assert.equal(await evaluate(`document.querySelector('.modal.show button[type=submit]').disabled`), true)
  await evaluate(`(()=>{const input=document.getElementById('sede-phone');input.select();const data=new DataTransfer();data.setData('text','300123456789');input.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))})()`)
  assert.equal(await evaluate(`document.getElementById('sede-phone').value`), '300123456789')
  assert.equal(await evaluate(`document.getElementById('sede-phone').checkValidity()`), false)
  await change('sede-phone', '3001234567')
  await evaluate(`document.querySelector('.modal.show .form-switch input').click()`)
  await until(`!!document.getElementById('sede-inherit-all')`)
  await evaluate(`document.getElementById('sede-inherit-all').click()`)
  assert.equal(await evaluate(`document.querySelectorAll('.modal.show .row.g-4 input:checked').length`), 12)
  await evaluate(`document.querySelector('.modal.show .row.g-4 input').click()`)
  assert.equal(await evaluate(`document.getElementById('sede-inherit-all').indeterminate`), true)
  await evaluate(`document.getElementById('sede-inherit-all').click()`)
  fixture.state.fail = true
  await evaluate(`document.querySelector('.modal.show form').requestSubmit()`)
  await until(`!!document.querySelector('.app-toast--danger')`)
  assert.equal(await evaluate(`document.getElementById('sede-name').value`), 'Sede Norte')
  assert.equal(
    await evaluate(
      `(()=>{const e=document.querySelector('.app-toast--danger'),r=e.getBoundingClientRect();return !!document.elementFromPoint(r.left+20,r.top+20)?.closest('.app-toast')})()`
    ),
    true
  )
  fixture.state.fail = false
  await evaluate(`document.querySelector('.modal.show form').requestSubmit()`)
  await until(
    `!document.querySelector('.modal.show') && document.body.innerText.includes('Sede Norte')`
  )
  assert.equal(fixture.state.writes.at(-1).telefono, '+573001234567')
  assert.equal(fixture.state.writes.at(-1).categorias.length, 12)
  await evaluate(
    `document.querySelectorAll('tbody tr')[1].querySelector('.btn-icon.btn-light-primary').click()`
  )
  await until(`document.querySelector('.modal.show #sede-coordinator')?.options.length===2`)
  assert.equal(await evaluate(`document.getElementById('sede-coordinator').value`), 'c'.repeat(24))
  await until(`document.getElementById('sede-phone').value==='3001234567'`)
  await change('sede-status', 'mantenimiento')
  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  })
  await until(`innerWidth===390`)
  await until(`getComputedStyle(document.querySelector('.modal.show')).opacity==='1'`)
  await until(`!document.querySelector('.app-toast')`)
  await screenshot('sedes-edit-mobile')
  const geometry = await evaluate(
    `(()=>{const modal=document.querySelector('.modal.show .modal-content'),body=document.querySelector('.modal.show .modal-body'),r=modal.getBoundingClientRect();return {height:r.height,width:r.width,viewport:innerHeight,scroll:body.scrollHeight>body.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth}})()`
  )
  assert.ok(geometry.height <= geometry.viewport, JSON.stringify(geometry))
  assert.ok(geometry.width <= 390)
  assert.ok(geometry.scroll)
  assert.equal(geometry.overflow, false)
  await evaluate(`document.querySelector('.modal.show form').requestSubmit()`)
  await until(`!document.querySelector('.modal.show')`)
  assert.equal(fixture.state.writes.at(-1).estado, 'mantenimiento')
  Object.assign(user, {
    is_platform: true,
    is_superadmin: false,
    roles: ['superadmin'],
    permissions: [],
    tenant_channel: null
  })
  await runSedesPlatformSmoke({fixture, navigate, evaluate, until, command, screenshot})
  assert.deepEqual(errors, [])
  console.log(
    'PASS: campus form, dependent geography, capacity, contact, errors above modal, edit state and mobile scroll.'
  )
}

export async function runSedesPlatformSmoke({fixture, navigate, evaluate, until, command, screenshot}) {
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  })
  await navigate('/account/settings', 'Contacto de la plataforma')
  await until(`document.querySelector('#platform-whatsapp')?.value==='${fixture.state.whatsapp.slice(2)}'`)
  if (screenshot) await screenshot('platform-contact-desktop', true)
  assert.equal(await evaluate(`document.querySelector('#platform-whatsapp-country').value`), 'CO')
  await evaluate(
    `(()=>{const input=document.querySelector('#platform-whatsapp');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'3009876543');input.dispatchEvent(new Event('input',{bubbles:true}))})()`
  )
  await evaluate(`document.querySelector('#platform-whatsapp').closest('form').requestSubmit()`)
  await until(`!document.querySelector('#platform-whatsapp').disabled`)
  assert.equal(fixture.state.whatsapp, '573009876543')
  await navigate('/account/settings', 'Contacto de la plataforma')
  await until(`document.querySelector('#platform-whatsapp')?.value==='3009876543'`)
  await evaluate(`(()=>{const select=document.getElementById('platform-whatsapp-country');select.value='US';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await evaluate(`(()=>{const input=document.getElementById('platform-whatsapp');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2015550123');input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await evaluate(`document.querySelector('#platform-whatsapp').closest('form').requestSubmit()`)
  await until(`!document.querySelector('#platform-whatsapp').disabled`)
  assert.equal(fixture.state.whatsapp, '12015550123')
  await navigate('/account/settings', 'Contacto de la plataforma')
  await until(`document.querySelector('#platform-whatsapp-country')?.value==='US'`)
  assert.equal(await evaluate(`document.querySelector('#platform-whatsapp').value`), '2015550123')
  await command('Emulation.setTimezoneOverride', {timezoneId: 'America/Bogota'})
  await navigate('/account/settings', 'Contacto de la plataforma')
  await until(`document.querySelector('#profile-phone-country')?.value==='CO'`)
  await evaluate(`(()=>{const input=document.getElementById('profile-phone');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'3211234567');input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await evaluate(`document.querySelector('#profile-phone').closest('form').requestSubmit()`)
  await until(`!document.querySelector('#profile-phone').disabled`)
  await navigate('/account/settings', 'Contacto de la plataforma')
  await until(`document.querySelector('#profile-phone')?.value==='3211234567'`)
  await navigate('/configuracion/colegios', 'Colegio de prueba')
  await evaluate(
    `document.querySelector('table tbody tr td:last-child button:nth-of-type(3)').click()`
  )
  await until(`!!document.querySelector('.modal.show tbody tr')`)
  await evaluate(`document.querySelector('.modal.show tbody tr td:last-child button').click()`)
  await until(`document.querySelector('#sede-capacity')?.value==='100'`)
  await evaluate(
    `(()=>{const input=document.querySelector('#sede-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Principal renovada');input.dispatchEvent(new Event('input',{bubbles:true}))})()`
  )
  await evaluate(`document.querySelector('.modal.show form').requestSubmit()`)
  await until(`!document.getElementById('sede-name')`)
  assert.equal(fixture.state.writes.at(-1).nombre, 'Principal renovada')
  console.log(
    'PASS: superadmin contact setting persists after reload and campus edit shares the form.'
  )
}
