import assert from 'node:assert/strict'

export function accountInputFixture(user) {
  const state = {writes: [], failNext: false}
  return {state, middleware(req, res, next) {
    const path = new URL(req.url, 'http://localhost').pathname
    if (!['/api/account/profile', '/api/account/email'].includes(path)) return next()
    const send = (body, status = 200) => {res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body))}
    let raw = ''
    req.on('data', chunk => {raw += chunk})
    req.on('end', () => {
      const data = JSON.parse(raw || '{}')
      state.writes.push({path, data})
      if (state.failNext) {state.failNext = false; return send({message: 'Revisa los datos del perfil.', errors: {name: ['Revisa el nombre del perfil.']}}, 422)}
      if (path.endsWith('/profile')) Object.assign(user, {name: data.name, phone: data.phone || null})
      else user.email = data.email
      send({message: path.endsWith('/profile') ? 'Perfil actualizado.' : 'Correo actualizado.', user})
    })
  }}
}

export async function runAccountInputSmoke({navigate: navigatePage, evaluate, until, screenshot, command, fixture, user, errors}) {
  const navigate = async () => {
    const origin = await evaluate('performance.timeOrigin')
    await navigatePage('/account/settings', 'Detalles del perfil')
    await until(`performance.timeOrigin !== ${origin} && !!document.querySelector('#profile-name') && !!document.querySelector('#profile-phone-country[data-country="CO"]')`)
  }
  const fill = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const saveProfile = async () => {
    await until(`!document.querySelector('#profile-name').closest('form').querySelector('button[type="submit"]').disabled`)
    await evaluate(`document.querySelector('#profile-name').closest('form').querySelector('button[type="submit"]').click()`)
  }
  const roles = user.is_platform ? ['superadmin'] : ['rector', 'docente', 'coord_academico', 'coord_convivencia', 'coord_combinado', 'estudiante']
  for (const role of roles) {
    Object.assign(user, {name: 'Ana María', phone: '+573001234567', email: `${role}@example.test`, roles: [role],
      profile_capabilities: {edit_name: role !== 'estudiante', edit_email: role !== 'estudiante', edit_phone: true, google_link: false}})
    await navigate()
    if (role === 'estudiante') {
      assert.equal(await evaluate(`document.querySelector('#profile-name').disabled`), true)
      assert.equal(await evaluate(`document.querySelector('#kt_signin_email_button button').disabled`), true)
      await fill('#profile-phone', '3211234567')
      await saveProfile()
      await until(`document.querySelector('#profile-name').closest('form').querySelector('button[type="submit"]').disabled && document.body.innerText.includes('Perfil actualizado.')`)
      assert.equal(user.name, 'Ana María')
      assert.equal(user.phone, '+573211234567')
      continue
    }
    await fill('#profile-name', '123@')
    const before = fixture.state.writes.length
    await saveProfile()
    await until(`!!document.querySelector('#profile-name-error')`)
    assert.equal(fixture.state.writes.length, before, 'Empty/invalid name must not reach the API')
    await fill('#profile-name', "Óscar1 Jean-Luc O'Connor9")
    await until(`document.querySelector('#profile-name').value === "Óscar Jean-Luc O'Connor"`)
    await fill('#profile-phone', '300123456')
    await until(`document.querySelector('#profile-name').closest('form').querySelector('button[type="submit"]').disabled`)
    await fill('#profile-phone', '32112345678999')
    await until(`document.querySelector('#profile-phone').value === '3211234567'`)
    fixture.state.failNext = true
    await saveProfile()
    await until(`document.querySelector('#profile-name-error')?.textContent.includes('Revisa el nombre del perfil.')`)
    assert.equal(await evaluate(`document.querySelector('#profile-name').value`), "Óscar Jean-Luc O'Connor")
    assert.equal(user.name, 'Ana María')
    await fill('#profile-name', "María José D’Angelo")
    await saveProfile()
    await until(`document.querySelector('[data-testid="account-menu-name"]')?.textContent === 'María José D’Angelo'`)
    await navigate()
    assert.equal(await evaluate(`document.querySelector('#profile-name').value`), 'María José D’Angelo')
    assert.equal(await evaluate(`document.querySelector('#profile-phone').value`), '3211234567')
    await evaluate(`document.querySelector('#kt_signin_email_button button').click()`)
    await fill('#emailaddress', 'sin-arroba')
    await fill('#confirmemailpassword', 'Fixture-Only-123!')
    const emailCount = fixture.state.writes.length
    await evaluate(`document.querySelector('#kt_signin_submit').click()`)
    await until(`document.querySelector('#kt_signin_change_email').textContent.includes('Formato de correo inválido')`)
    assert.equal(fixture.state.writes.length, emailCount)
    assert.equal(await evaluate(`document.querySelector('#emailaddress').maxLength`), 255)
    const longEmail = 'a'.repeat(63) + '@' + 'b'.repeat(62) + '.' + 'c'.repeat(62) + '.test'
    await fill('#emailaddress', longEmail)
    await evaluate(`document.querySelector('#kt_signin_submit').click()`)
    await until(`document.querySelector('#kt_signin_email').textContent.includes(${JSON.stringify(longEmail)})`)
    await evaluate(`document.querySelector('#kt_signin_password_button button').click()`)
    assert.equal(await evaluate(`document.querySelector('#currentpassword').maxLength`), 4096)
    assert.equal(await evaluate(`document.querySelector('#newpassword').maxLength`), 128)
    await fill('#currentpassword', 'Fixture-Only-123!')
    await fill('#newpassword', 'weak')
    await fill('#confirmpassword', 'weak')
    const passwordCount = fixture.state.writes.length
    await evaluate(`document.querySelector('#kt_password_submit').click()`)
    await until(`document.querySelector('#kt_signin_change_password').textContent.includes('La contraseña no cumple')`)
    assert.equal(fixture.state.writes.length, passwordCount)
  }
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
  await until(`document.documentElement.clientWidth === 390`)
  await evaluate(`document.querySelectorAll('.app-toast-close').forEach(button=>button.click())`)
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= 391 && document.body.scrollWidth <= 391`), 'Account settings must fit mobile, including long valid emails')
  await screenshot(`account-input-${user.is_platform ? 'platform' : 'school'}-mobile`, true)
  assert.deepEqual(errors, [], 'Uncaught account browser errors')
  console.log(`PASS: account names, email, cellular number, password limits, error recovery, reload and mobile (${roles.join(', ')}).`)
}
