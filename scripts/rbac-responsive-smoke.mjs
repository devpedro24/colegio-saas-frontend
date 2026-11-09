import assert from 'node:assert/strict'

export async function runRbacResponsiveSmoke({platform, evaluate, until, command, screenshot}) {
  const prefix = platform ? 'platform' : 'school'
  const tab = async label => {
    await evaluate(`[...document.querySelectorAll('.rbac-tabs .nav-link')].find(el=>el.textContent.trim()===${JSON.stringify(label)}).click()`)
  }
  const noPageOverflow = async () => assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'RBAC must fit the viewport without sideways page scrolling.')
  for (const width of [768, 390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height:844,deviceScaleFactor:1,mobile:true})
    await tab('Matriz')
    await until(`getComputedStyle(document.querySelector('[data-rbac-mobile]')).display !== 'none'`)
    await noPageOverflow()
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.rbac-matrix-desktop')).display`),'none')
    await evaluate(`(()=>{const e=document.querySelector('[data-rbac-mobile] select');e.value='docente';e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`document.querySelector('[data-rbac-mobile] select').value === 'docente'`)
    await evaluate(`(()=>{const e=document.querySelector('[data-rbac-mobile] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'matriculas');e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await until(`document.querySelectorAll('.rbac-mobile-permission').length === 1`)
    assert.ok(await evaluate(`document.querySelector('.rbac-mobile-permission').textContent.includes('Gestionar matrículas')`),'Accent-insensitive search must retain the selected role permission.')
    await screenshot(`rbac-${prefix}-matrix-${width}`)
    if (platform && width === 390) {
      await evaluate(`document.querySelector('.rbac-mobile-cell button').click()`)
      await until(`!!document.querySelector('#kt_modal_matrix_cell')`)
      await until(`getComputedStyle(document.querySelector('#kt_modal_matrix_cell').closest('.modal')).opacity === '1'`)
      assert.ok(await evaluate(`document.querySelector('#kt_modal_matrix_cell .modal-content').getBoundingClientRect().height <= innerHeight`))
      assert.ok(await evaluate(`document.querySelector('#kt_modal_matrix_cell').textContent.includes('Docente')`))
      await screenshot('rbac-platform-cell-mobile')
      await evaluate(`document.querySelector('#kt_modal_matrix_cell .modal-header .btn').click()`)
      await until(`!document.querySelector('#kt_modal_matrix_cell')`)
    }
    await tab('Roles')
    await until(`!!document.querySelector('.rbac-responsive-list')`)
    await noPageOverflow()
    assert.ok(await evaluate(`(()=>{const e=document.querySelector('.rbac-responsive-list');return e.scrollWidth <= e.clientWidth+1})()`),'Role cards must not clip edit actions.')
    if (width === 390) await screenshot(`rbac-${prefix}-roles-mobile`)
    if (platform) {
      await tab('Permisos')
      await until(`!!document.querySelector('.rbac-responsive-list')`)
      await noPageOverflow()
      if (width === 390) {
        await screenshot('rbac-platform-permissions-mobile')
        await evaluate(`document.querySelector('.rbac-responsive-list .btn').click()`)
        await until(`!!document.querySelector('#kt_modal_rbac_permission')`)
        await until(`getComputedStyle(document.querySelector('#kt_modal_rbac_permission').closest('.modal')).opacity === '1'`)
        assert.ok(await evaluate(`document.querySelector('#kt_modal_rbac_permission .modal-content').getBoundingClientRect().height <= innerHeight`))
        await screenshot('rbac-platform-permission-form-mobile')
        await evaluate(`document.querySelector('#kt_modal_rbac_permission .modal-header .btn').click()`)
        await until(`!document.querySelector('#kt_modal_rbac_permission')`)
      }
    }
  }
  console.log('PASS: responsive permissions, role cards, focused matrix, search and bounded dialogs at 320, 390 and 768px.')
}
