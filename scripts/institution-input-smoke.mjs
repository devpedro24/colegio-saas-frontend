import assert from 'node:assert/strict'

export function institutionInputFixture() {
  const state = {record: null, writes: [], failNext: false, onboarding: false}
  const status = () => ({required: state.onboarding, password_required: false, institution_required: state.onboarding,
    institution: state.record, logo_url: '/api/branding/logo'})
  return {state, middleware(req, res, next) {
    const path = new URL(req.url, 'http://localhost').pathname
    if (!['/api/config/datos-institucionales', '/api/onboarding/institution', '/api/onboarding/status'].includes(path)) return next()
    const send = (body, code = 200) => {res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body))}
    if (req.method === 'GET') return send(path.endsWith('/status') ? status() : {data: state.record})
    let raw = ''
    req.on('data', chunk => {raw += chunk})
    req.on('end', () => {
      const data = JSON.parse(raw || '{}')
      state.writes.push({path, data})
      if (state.failNext) {state.failNext = false; return send({message: 'Revisa los datos institucionales.', errors: {nit: ['Revisa el NIT del colegio.']}}, 422)}
      state.record = {...data}
      if (path.endsWith('/institution')) {state.onboarding = false; return send(status())}
      send({data: state.record})
    })
  }}
}

export async function runInstitutionInputSmoke({navigate: navigatePage, evaluate, until, screenshot, command, fixture, errors}) {
  const navigate = async (route, text) => {
    const origin = await evaluate('performance.timeOrigin')
    await navigatePage(route, text)
    await until(`performance.timeOrigin !== ${origin} && document.body.innerText.includes(${JSON.stringify(text)})`)
  }
  const fill = (id, value) => evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const submit = async prefix => {
    await until(`!document.getElementById(${JSON.stringify(prefix + 'nombre')}).closest('form').querySelector('button[type="submit"]').disabled`)
    await evaluate(`document.getElementById(${JSON.stringify(prefix + 'nombre')}).closest('form').requestSubmit()`)
  }
  await navigate('/ajustes-institucionales/datos', 'Datos institucionales')
  await until(`!!document.querySelector('#institution-nombre') && document.querySelector('#institution-telefono').maxLength === 10`)
  await fill('institution-nombre', '123')
  assert.equal(await evaluate(`document.querySelector('#institution-nombre').checkValidity()`), false)
  await fill('institution-nombre', 'Colegio 7 @de Agosto')
  assert.equal(await evaluate(`document.querySelector('#institution-nombre').value`), 'Colegio 7 de Agosto')
  await fill('institution-nit', 'ABC900.123.456-7')
  assert.equal(await evaluate(`document.querySelector('#institution-nit').value`), '900.123.456-7')
  await fill('institution-resolucion_men', 'Resolución 0123 de 2026 / MEN')
  await fill('institution-direccion', 'Carrera 7 # 12-34')
  await fill('institution-telefono', '300123456')
  await until(`document.querySelector('#institution-nombre').closest('form').querySelector('button[type="submit"]').disabled`)
  await fill('institution-telefono', '300123456789')
  await until(`document.querySelector('#institution-telefono').value === '3001234567'`)
  await fill('institution-correo', 'sin-arroba')
  assert.equal(await evaluate(`document.querySelector('#institution-correo').checkValidity()`), false)
  const before = fixture.state.writes.length
  await submit('institution-')
  assert.equal(fixture.state.writes.length, before, 'Invalid data must not be submitted')
  await fill('institution-correo', 'contacto@example.test')
  fixture.state.failNext = true
  await submit('institution-')
  await until(`document.body.innerText.includes('Revisa el NIT del colegio.')`)
  assert.equal(await evaluate(`document.querySelector('#institution-nombre').value`), 'Colegio 7 de Agosto')
  await submit('institution-')
  await until(`document.body.innerText.includes('Datos institucionales guardados')`)
  assert.equal(fixture.state.record.telefono, '+573001234567')
  await navigate('/ajustes-institucionales/datos', 'Datos institucionales')
  await until(`document.querySelector('#institution-nombre')?.value === 'Colegio 7 de Agosto'`)
  await fill('institution-nombre', 'Instituto "José Martí" (2)')
  await submit('institution-')
  await until(`document.body.innerText.includes('Datos institucionales guardados')`)
  assert.equal(fixture.state.record.nombre, 'Instituto "José Martí" (2)')
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
  await evaluate(`document.querySelectorAll('.app-toast-close').forEach(button=>button.click())`)
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= 391`), 'Institution settings fit mobile')
  await screenshot('institution-input-mobile', true)

  fixture.state.record = null
  fixture.state.onboarding = true
  await navigate('/bienvenida', 'Datos institucionales')
  await until(`!!document.querySelector('#onboarding-telefono-country[data-country="CO"]')`)
  await fill('onboarding-nombre', 'Colegio 7 @de Agosto')
  await fill('onboarding-nit', 'ABC900123456-7')
  await fill('onboarding-resolucion_men', 'Resolución 0123 de 2026')
  await fill('onboarding-direccion', 'Calle 1 # 2-3')
  await fill('onboarding-telefono', '3211234567')
  await fill('onboarding-correo', 'inicio@example.test')
  fixture.state.failNext = true
  await submit('onboarding-')
  await until(`document.body.innerText.includes('Revisa el NIT del colegio.')`)
  assert.equal(await evaluate(`document.querySelector('#onboarding-nombre').value`), 'Colegio 7 de Agosto')
  await screenshot('institution-onboarding-mobile', true)
  await submit('onboarding-')
  await until(`location.pathname !== '/bienvenida'`)
  assert.equal(fixture.state.record.telefono, '+573211234567')
  assert.equal(fixture.state.record.nombre, 'Colegio 7 de Agosto')
  assert.deepEqual(errors, [], 'Uncaught institution browser errors')
  console.log('PASS: institutional creation/edit, NIT, email, cellular length, error recovery, reload, onboarding and mobile.')
}
