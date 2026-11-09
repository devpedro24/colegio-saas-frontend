import assert from 'node:assert/strict'

export async function runMobileNavigationSmoke({platform,teacher,evaluate,until,command,screenshot,sleep,navigate,errors}) {
  const role = platform ? 'platform' : teacher ? 'teacher' : 'rector'
  const first = platform ? '/configuracion/roles-permisos' : teacher ? '/evaluacion/catalogo' : '/academico/siee'
  const second = platform ? '/configuracion/colegios' : '/comunicacion/eventos'
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const active = path => `document.querySelector('#kt_app_sidebar_menu [data-kt-nav="${path}"]')?.getAttribute('aria-current') === 'page'`
  const opened = `document.querySelector('#kt_app_sidebar')?.classList.contains('drawer-on')`
  await navigate(first, platform ? 'Roles y Permisos' : teacher ? 'Mis Asignaciones' : 'Configuración SIEE')
  await sleep(1000)

  for (const width of [390,320,768]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height:844,deviceScaleFactor:1,mobile:true})
    await sleep(350)
    await click('#kt_app_sidebar_mobile_toggle')
    await until(opened)
    await until(active(first))
    await until(`document.querySelector('#kt_app_sidebar_menu [aria-current="page"]')?.closest('.menu-sub')?.parentElement.classList.contains('show')`)
    await until(`(()=>{const r=document.querySelector('#kt_app_sidebar').getBoundingClientRect();return r.left>=-1 && r.width>240 && r.right<=innerWidth})()`)
    const footer = '#kt_app_sidebar [data-bs-target="#kt_modal_upgrade_plan"]'
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(footer)}).innerText.trim()`),'Mejorar plan')
    assert.ok(await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(footer)}).getBoundingClientRect();return r.bottom<=innerHeight && r.top>innerHeight-150})()`),'Upgrade remains visible at the bottom.')
    if (width === 390) await screenshot(`navigation-${role}-drawer-mobile`)

    await click('.drawer-overlay')
    await until(`!(${opened}) && !document.querySelector('.drawer-overlay')`)
    const headerSize = await evaluate(`(()=>{const h=document.querySelector('#kt_app_header');return {width:innerWidth,scroll:h.scrollWidth,client:h.clientWidth,buttons:[...h.querySelectorAll('.btn')].filter(e=>e.getBoundingClientRect().width).map(e=>({label:e.getAttribute('aria-label')||e.id,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}})()`)
    assert.ok(headerSize.scroll<=headerSize.client+1,`The header must not overflow on mobile: ${JSON.stringify(headerSize)}`)
    await click('#kt_app_sidebar_mobile_toggle')
    await until(opened)
    assert.equal(await evaluate(active(first)),true,'Reopening preserves the active page.')
    await evaluate(`(()=>{const link=document.querySelector('#kt_app_sidebar_menu [data-kt-nav="${second}"]');const parent=link.closest('.menu-sub')?.parentElement;if(parent && !parent.classList.contains('show')) parent.querySelector(':scope > .menu-link').click()})()`)
    await until(`document.querySelector('#kt_app_sidebar_menu [data-kt-nav="${second}"]').getBoundingClientRect().height > 0`)
    await click(`#kt_app_sidebar_menu [data-kt-nav="${second}"]`)
    await until(`location.pathname === '${second}' && !(${opened})`)
    await until(`!!document.querySelector('#kt_app_sidebar_mobile_toggle') && ${active(second)}`)
    await sleep(900)
    await click('#kt_app_sidebar_mobile_toggle')
    await until(opened)
    await until(active(second))
    await click(footer)
    await until(`document.querySelector('#kt_modal_upgrade_plan')?.classList.contains('show') && !(${opened})`)
    await until(`!!document.querySelector('#kt_modal_upgrade_plan [data-bs-dismiss="modal"]')`)
    await until(`getComputedStyle(document.querySelector('#kt_modal_upgrade_plan')).opacity === '1'`)
    await sleep(350)
    await click('#kt_modal_upgrade_plan [data-bs-dismiss="modal"]')
    await until(`getComputedStyle(document.querySelector('#kt_modal_upgrade_plan')).display === 'none' && !document.querySelector('.modal-backdrop')`)

    const bell = '#kt_app_header button[aria-label="Notificaciones"]'
    await click(bell)
    await until(`document.querySelector('#kt_menu_notifications')?.classList.contains('show')`)
    await until(`getComputedStyle(document.querySelector('#kt_menu_notifications')).opacity === '1'`)
    await sleep(250)
    assert.ok(await evaluate(`(()=>{const r=document.querySelector('#kt_menu_notifications').getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1})()`),'Notifications must stay inside the mobile viewport.')
    if (!platform) {
      assert.ok(await evaluate(`document.querySelector('#kt_menu_notifications').innerText.includes('Sin notificaciones nuevas')`))
      assert.equal(await evaluate(`document.querySelector('#kt_menu_notifications').innerText.includes('Project Alice')`),false,'Schools never see platform demo alerts.')
      if (teacher) assert.equal(await evaluate(`!!document.querySelector('#kt_app_sidebar_menu [data-kt-nav="/academico/siee"]')`),false,'Teacher navigation retains the permission matrix.')
    }
    if (width === 390) await screenshot(`navigation-${role}-notifications-mobile`)
    await click(bell)
    await navigate(first, platform ? 'Roles y Permisos' : teacher ? 'Mis Asignaciones' : 'Configuración SIEE')
    await sleep(900)
  }
  if (teacher) {
    await evaluate(`document.querySelector('[data-kt-lang="en"]').click()`)
    await until(`document.querySelector('#kt_app_header button[aria-label="Notifications"]') !== null`)
    await sleep(700)
    await click('#kt_app_sidebar_mobile_toggle')
    await until(opened)
    assert.equal(await evaluate(`document.querySelector('#kt_app_sidebar [data-bs-target="#kt_modal_upgrade_plan"]').innerText.trim()`),'Upgrade Plan')
    await click('.drawer-overlay')
    await until(`!(${opened}) && !document.querySelector('.drawer-overlay')`)
  }
  await command('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await sleep(350)
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#kt_app_sidebar_mobile_toggle')).display === 'none' || document.querySelector('#kt_app_sidebar_mobile_toggle').getBoundingClientRect().width === 0`),true)
  if (!platform) assert.equal(await evaluate(`getComputedStyle(document.querySelector('#kt_app_sidebar')).display`),'none','A school without additional campuses gets no unnecessary desktop rail.')
  assert.deepEqual(errors,[])
  console.log(`PASS: ${role} navigation, active parent, reopen, backdrop, upgrade footer and notification bell at 320/390/768px; desktop remains intact.`)
}
