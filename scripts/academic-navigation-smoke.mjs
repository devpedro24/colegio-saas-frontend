import assert from 'node:assert/strict'

export async function runAcademicNavigationSmoke({navigate, evaluate, until, command, screenshot,
  detailedReads, apiWrites, fixtures, user, tokens, closedPeriod, publish, errors}) {
  const pause = () => new Promise(resolve => setTimeout(resolve, 350))
  const menu = async route => {
    await evaluate(`document.querySelector('[data-kt-nav="${route}"]').click()`)
    await until(`location.pathname === '${route}'`)
    await pause()
  }
  const openSheet = async () => {
    await until(`!![...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Ver Planilla')`)
    await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Ver Planilla').click()`)
    await until(`!!document.querySelector('.grade-sheet')`)
    await pause()
  }
  user.onboarding = fixtures['/api/onboarding/status']
  const attendance = fixtures['/api/asistencias/planilla'].data
  attendance.estudiantes = [{matricula_token: tokens.enrollment, nombre: 'Estudiante de prueba', activa: true,
    resumen: {registradas: 0, ausentes: 0, tardes: 0, justificadas: 0, faltas_equivalentes: 0, porcentaje: 0, alerta: false}}]
  attendance.columnas = [{sesion_token: 'S'.repeat(24), fecha: '2026-10-23', hora_inicio: '08:00', hora_fin: '09:00',
    registrada: false, version: 0, historica: false, editable: true, matriculas: [tokens.enrollment], marcas: {}}]
  await navigate('/evaluacion/catalogo', 'Mis Asignaciones')
  await until(`window.Echo?.connector.pusher.channels.channels['private-tenant.${user.tenant_channel}']?.subscribed === true`)
  await pause()
  console.log('Cold gradebook catalog reads:', detailedReads.filter(p => p.startsWith('/api/evaluacion/catalogo')).length)
  assert.equal(detailedReads.filter(p => p.startsWith('/api/evaluacion/catalogo')).length, 2)
  await openSheet()
  await menu('/academico/asistencia')
  await until(`new URLSearchParams(location.search).get('periodo') === '${tokens.period}'`)
  await menu('/academico/indicadores')
  await until(`!!document.querySelector('.group-indicator-rich')`)
  await evaluate(`(()=>{const s=document.querySelector('#assigned-indicator-period');s.value='${closedPeriod}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await until(`!!document.querySelector('.alert-warning')`)
  await pause()
  await evaluate(`window.cacheSentinel='same-document';window.originalNow=Date.now;Date.now=()=>window.originalNow()+35000`)
  const before = detailedReads.length
  const authBefore = apiWrites.filter(p => p === '/api/broadcasting/auth').length
  await menu('/evaluacion/catalogo')
  await openSheet()
  await menu('/academico/asistencia')
  await until(`!!document.querySelector('#attendance-period')`)
  await menu('/academico/indicadores')
  await until(`!!document.querySelector('#assigned-indicator-period')`)
  await pause()
  const repeated = detailedReads.slice(before)
  console.log('Reads on returning to gradebook, attendance and indicators after 35s:', JSON.stringify(repeated))
  assert.deepEqual(repeated, [], 'Unchanged views must reuse cache, not refetch on navigation.')
  assert.equal(await evaluate(`document.querySelector('#assigned-indicator-period').value`), closedPeriod,
    'Returning must retain the selected period, not silently load the open one.')
  assert.equal(await evaluate('window.cacheSentinel'), 'same-document')
  assert.equal(apiWrites.filter(p => p === '/api/broadcasting/auth').length, authBefore)
  await evaluate('Date.now=window.originalNow')

  // A real save must update its own data once, without invalidating other modules.
  await evaluate(`(()=>{const s=document.querySelector('#assigned-indicator-period');s.value='${tokens.period}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await until(`!!document.querySelector('.group-indicator-row-actions .btn-light-primary')`)
  await evaluate(`document.querySelector('.group-indicator-row-actions .btn-light-primary').click()`)
  await until(`!!document.querySelector('.group-indicator-editor')`)
  await evaluate(`(()=>{const editor=document.querySelector('.group-indicator-editor');editor.innerHTML='<p>Indicador guardado durante la prueba.</p>';editor.dispatchEvent(new InputEvent('input',{bubbles:true}));})()`)
  let checkpoint = detailedReads.length
  await evaluate(`document.querySelector('.group-indicator-actions .btn-primary').click()`)
  await until(`document.querySelector('.group-indicator-rich')?.textContent.includes('Indicador guardado durante la prueba.')`)
  await pause()
  const savedReads = detailedReads.slice(checkpoint)
  assert.ok(savedReads.length > 0)
  assert.ok(savedReads.every(p => p.startsWith('/api/indicadores')), JSON.stringify(savedReads))
  assert.equal(new Set(savedReads).size, savedReads.length, 'Hook and local invalidation must coalesce.')

  fixtures['/api/indicadores/tabla'].data.materias[0].texto_html = '<p>Indicador actualizado por otro docente.</p>'
  checkpoint = detailedReads.length
  publish(['indicators'])
  await until(`document.querySelector('.group-indicator-rich')?.textContent.includes('Indicador actualizado por otro docente.')`)
  assert.ok(detailedReads.slice(checkpoint).every(p => p.startsWith('/api/indicadores')))

  await menu('/academico/asistencia')
  await until(`!!document.querySelector('button[data-attendance-choice="presente"]')`)
  checkpoint = detailedReads.length
  await evaluate(`document.querySelector('button[data-attendance-choice="presente"]').click()`)
  await evaluate(`document.querySelector('.attendance-sheet-table').closest('section').querySelector('button.btn-primary').click()`)
  await until(`document.querySelector('.attendance-sheet-recorded') !== null`)
  await pause()
  const attendanceReads = detailedReads.slice(checkpoint)
  assert.ok(attendanceReads.every(p => p.startsWith('/api/asistencias')), JSON.stringify(attendanceReads))
  assert.equal(attendanceReads.filter(p => p.startsWith('/api/asistencias/planilla')).length, 1)
  attendance.estudiantes[0].nombre = 'Estudiante actualizado en otra sesión'
  publish(['attendance'])
  await until(`document.querySelector('.attendance-sheet-table')?.innerText.includes('Estudiante actualizado en otra sesión')`)

  // Grade changes invalidate the hidden sheet, not the visible attendance view.
  checkpoint = detailedReads.length
  fixtures['/api/evaluacion/planillas/1/1'].data.resultados[0].motivo = 'Notas actualizadas por otra sesión'
  publish(['grades'])
  await new Promise(resolve => setTimeout(resolve, 5500))
  assert.deepEqual(detailedReads.slice(checkpoint), [])
  await menu('/evaluacion/catalogo')
  await openSheet()
  assert.equal(detailedReads.slice(checkpoint).filter(p => p.includes('/api/evaluacion/planillas/')).length, 1)

  // Closing a period and changing permissions must still invalidate cached locks.
  attendance.periodo.estado = 'cerrado'
  attendance.columnas[0].editable = false
  fixtures['/api/indicadores/opciones-asignadas'].data.periodos.find(p => p.token === tokens.period).estado = 'cerrado'
  fixtures['/api/indicadores/tabla'].data.materias[0].puede_editar = false
  await menu('/academico/asistencia')
  publish(['academic'])
  await until(`document.querySelector('.attendance-sheet-table button[data-attendance-choice="presente"]')?.disabled === true`)
  await menu('/academico/indicadores')
  await until(`!!document.querySelector('.alert-warning') && !document.querySelector('.group-indicator-row-actions .btn-light-primary')`)
  user.permissions = user.permissions.filter(p => p !== 'indicadores.grupo.editar')
  const meBefore = detailedReads.filter(p => p === '/api/me').length
  publish(['rbac'])
  for (let i = 0; i < 80 && detailedReads.filter(p => p === '/api/me').length === meBefore; i++) await pause()
  assert.equal(detailedReads.filter(p => p === '/api/me').length, meBefore + 1)
  await screenshot('academic-cache-closed-period')
  await menu('/academico/asistencia')
  checkpoint = detailedReads.length
  await command('Page.reload')
  await until(`!!document.querySelector('.attendance-sheet-table')`)
  await pause()
  assert.equal(detailedReads.slice(checkpoint).filter(p => p.startsWith('/api/asistencias?')).length, 1)
  assert.equal(detailedReads.slice(checkpoint).filter(p => p.startsWith('/api/asistencias/planilla?')).length, 1)
  assert.deepEqual(errors, [])
  console.log('PASS: zero GETs on academic SPA return; filters preserved; saves refresh once; real remote grade/attendance/indicator events, period locks, permissions and F5 verified.')
}
