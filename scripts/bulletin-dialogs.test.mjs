import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

function element() {
  const attributes=new Map(),listeners=new Map(),classes=new Set()
  return {open:true,disabled:false,childNodes:[],classList:{add:key=>classes.add(key),remove:key=>classes.delete(key),contains:key=>classes.has(key)},
    getBoundingClientRect:()=>({left:100,top:100,right:400,bottom:400}),
    setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key),removeAttribute:key=>attributes.delete(key),
    addEventListener:(key,fn)=>listeners.set(key,fn),dispatch:(key,event)=>listeners.get(key)?.(event),
    replaceChildren(...nodes){this.childNodes=nodes},querySelectorAll(){return this.controls||[]}}
}
function dialogs() {
  const context=vm.createContext({document:{createElement:element}});context.window=context
  vm.runInContext(readFileSync(new URL('../public/bulletin-editor/studio-dialogs.js',import.meta.url),'utf8'),context)
  return context.ReportStudioDialogs
}

test('backdrop clicks pulse without dismissal; content clicks and dragging outside do not',()=>{
  const api=dialogs(),dialog=element();api.bind(dialog);api.bind(dialog)
  const outside={target:dialog,clientX:50,clientY:50,button:0}
  dialog.dispatch('pointerdown',outside);dialog.dispatch('pointerup',outside)
  assert.ok(dialog.open);assert.ok(dialog.classList.contains('studio-dialog-pulse'))
  dialog.dispatch('animationend',{target:dialog,animationName:'studio-dialog-feedback'})
  dialog.dispatch('pointerdown',{...outside,clientX:150,clientY:150});dialog.dispatch('pointerup',outside)
  assert.ok(!dialog.classList.contains('studio-dialog-pulse'))
  assert.ok(!api.outside({...outside,target:element()},dialog))
})

test('pending publication disables actions and close, then restores the original state after an error',()=>{
  const api=dialogs(),dialog=element(),publish=element(),cancel=element(),close=element(),unavailable=element()
  unavailable.disabled=true;publish.childNodes=[{textContent:'Publicar revisión'}];dialog.controls=[publish,cancel,close,unavailable]
  api.bind(dialog);const finish=api.busy(dialog,publish,'Publicando revisión…')
  assert.ok(dialog.controls.every(control=>control.disabled))
  assert.equal(publish.childNodes[1].textContent,'Publicando revisión…')
  let blocked=false;dialog.dispatch('cancel',{preventDefault:()=>blocked=true});assert.ok(blocked)
  try{throw new Error('Simulated rejection')}catch{}finally{finish()}
  assert.ok(!publish.disabled&&!cancel.disabled&&!close.disabled);assert.ok(unavailable.disabled)
  assert.equal(publish.childNodes[0].textContent,'Publicar revisión')
  assert.ok(!dialog.getAttribute('aria-busy'))
})
