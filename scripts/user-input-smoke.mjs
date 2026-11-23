import assert from 'node:assert/strict'

export function userInputFixture() {
  const rows = [], writes = []
  const state = {rows, writes, failNext: false}
  return {state, middleware(req, res, next) {
    const path = new URL(req.url, 'http://localhost').pathname
    if (!/^\/api\/usuarios(?:\/|$)/.test(path)) return next()
    const send = (body, status = 200) => {res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body))}
    if (req.method === 'GET') {
      const data = path.endsWith('/reincorporacion-candidatos') ? rows.filter(row => row.status === 'egresado') : rows
      return send({data, meta: {current_page: 1, last_page: 1, per_page: 20, total: data.length}})
    }
    let raw = ''
    req.on('data', chunk => {raw += chunk})
    req.on('end', () => {
      const data = JSON.parse(raw || '{}')
      writes.push({method: req.method, path, data})
      if (state.failNext) {state.failNext = false; return send({message: 'Datos inválidos.', errors: {name: ['Revisa el nombre del usuario.']}}, 422)}
      if (req.method === 'POST' && path.endsWith('/reincorporacion')) {
        const row = rows.find(item => item.url_token === path.split('/').at(-2))
        if (!row || row.status !== 'egresado') return send({message: 'Revisa el estado del estudiante.'}, 422)
        row.status = 'active'
        return send({data: {url_token: row.url_token, status: row.status}})
      }
      if (req.method === 'POST') {
        const token = String.fromCharCode(97 + rows.length).repeat(24)
        const row = {id: token, url_token: token, ...data, phone: null, roles: [data.role], status: 'active', must_change_password: true, created_at: null, sede_nombre: null}
        rows.push(row)
        return send({data: row, password: 'Fixture-Only-123!'}, 201)
      }
      const row = rows.find(item => item.url_token === path.split('/').at(-1))
      if (!row) return send({message: 'Usuario no encontrado.'}, 404)
      Object.assign(row, data)
      send({data: row})
    })
  }}
}

export async function runUserInputSmoke({navigate, evaluate, until, screenshot, command, fixture, errors}) {
  const click = async text => {
    const target = `[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(text)} && button.getClientRects().length && !button.disabled)`
    await until(`!!(${target})`)
    await evaluate(`(${target}).click()`)
  }
  const fill = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`)
  await navigate('/usuarios', 'Nuevo usuario')
  for (const role of ['estudiante', 'docente', 'coord_academico', 'coord_convivencia', 'coord_combinado']) {
    await click('Nuevo usuario')
    await until(`!!document.querySelector('.modal.show #usuario-name')`)
    await fill('#usuario-name', '123@')
    assert.equal(await evaluate(`document.querySelector('#usuario-name').checkValidity()`), false)
    await fill('#usuario-name', "María1 José O'Connor7")
    assert.equal(await evaluate(`document.querySelector('#usuario-name').value`), "María José O'Connor")
    await fill('#usuario-email', 'sin-arroba')
    assert.equal(await evaluate(`document.querySelector('#usuario-email').checkValidity()`), false)
    const count = fixture.state.writes.length
    await click('Guardar usuario')
    assert.equal(fixture.state.writes.length, count, 'Invalid email must not send a request')
    await fill('#usuario-email', role + '@example.test')
    await fill('.modal.show select', role)
    await click('Guardar usuario')
    await until(`document.querySelector('.modal.show h2')?.textContent.includes('Credenciales')`)
    await evaluate(`document.querySelector('.modal.show .modal-footer button').click()`)
    await until(`!document.querySelector('.modal.show')`)
    const token = fixture.state.rows.at(-1).url_token
    const edit = `[...document.querySelectorAll('tr')].find(row=>row.textContent.includes(${JSON.stringify(role + '@example.test')}))?.querySelector('button[title="Editar usuario"]')`
    await until(`!!(${edit})`)
    await evaluate(`(${edit}).click()`)
    await until(`!!document.querySelector('.modal.show #usuario-name')`)
    await fill('#usuario-name', 'Óscar3 Jean-Luc9')
    assert.equal(await evaluate(`document.querySelector('#usuario-name').value`), 'Óscar Jean-Luc')
    if (role === 'estudiante') {
      fixture.state.failNext = true
      await click('Guardar usuario')
      await until(`document.querySelector('.modal.show')?.textContent.includes('Revisa el nombre del usuario.')`)
      assert.equal(await evaluate(`document.querySelector('#usuario-name').value`), 'Óscar Jean-Luc')
    }
    await click('Guardar usuario')
    await until(`!document.querySelector('.modal.show')`)
    assert.equal(fixture.state.rows.find(row=>row.url_token === token).name, 'Óscar Jean-Luc')
  }
  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  await evaluate(`document.querySelectorAll('.app-toast-close').forEach(button=>button.click())`)
  await until(`!document.querySelector('.app-toast')`)
  await click('Nuevo usuario')
  await until(`!!document.querySelector('.modal.show #usuario-name')`)
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`))
  await screenshot('user-input-mobile', true)
  await click('Cancelar')
  assert.deepEqual(errors, [], 'Uncaught browser errors')
  console.log('PASS: create/edit students, teachers and all coordinator roles; names, email, modal error recovery and mobile form.')
}

export async function runStudentReturnSmoke({navigate, evaluate, until, fixture, errors}) {
  await navigate('/usuarios', 'Ana Pruebas')
  assert.equal(await evaluate("document.body.innerText.includes('Nuevo usuario')"), false)
  await evaluate("[...document.querySelectorAll('tr button')].find(b => b.textContent.trim() === 'Autorizar reincorporación').click()")
  await until("!!document.querySelector('#student-return-reason')")
  const submit = "document.querySelector('.modal.show .modal-footer .btn-primary')"
  assert.equal(await evaluate(submit + '.disabled'), true)
  await evaluate("(()=>{const el=document.querySelector('#student-return-reason');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Regreso autorizado por el colegio.');el.dispatchEvent(new Event('input',{bubbles:true}))})()")
  await until('!' + submit + '.disabled')
  fixture.state.failNext = true
  await evaluate(submit + '.click()')
  await until("!!document.querySelector('.app-toast') && !" + submit + '.disabled')
  assert.equal(await evaluate("document.querySelector('#student-return-reason').value"), 'Regreso autorizado por el colegio.')
  await evaluate(submit + '.click()')
  await until("!document.querySelector('.modal.show') && !document.querySelector('tbody')?.innerText.includes('Ana Pruebas')")
  assert.equal(fixture.state.writes.length, 2)
  const student = fixture.state.rows[0]
  assert.deepEqual(fixture.state.writes.at(-1), {method: 'POST', path: '/api/usuarios/' + student.url_token + '/reincorporacion',
    data: {motivo: 'Regreso autorizado por el colegio.', sede_url_token: student.sede_url_token}})
  assert.equal(student.status, 'active')
  assert.deepEqual(errors, [])
  console.log('PASS: limited student return permission, mandatory reason, retry and updated list.')
}
