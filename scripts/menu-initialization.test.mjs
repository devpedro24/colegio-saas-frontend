import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/_metronic/assets/ts/components/MenuComponent.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText

test('repeated menu bootstrap keeps one click toggle, including module replacement', () => {
  const store = new Map(), delegates = [], listeners = []
  const document = {body:{},querySelectorAll:()=>[],addEventListener:(type,callback)=>listeners.push({type,callback})}
  const DataUtil = {
    has:(element,key)=>store.get(element)?.has(key) ?? false,
    set:(element,key,value)=>{if(!store.has(element))store.set(element,new Map());store.get(element).set(key,value)},
  }
  const utils = {DataUtil,DOMEventHandlerUtil:{on:(element,selector,type,callback)=>delegates.push({element,selector,type,callback})}}
  const load = () => {
    const exports = {}
    vm.runInNewContext(code,{exports,require:name=>name==='@popperjs/core'?{}:utils,document,
      window:{addEventListener:(type,callback)=>listeners.push({type,callback})}})
    return exports.MenuComponent
  }
  const Menu = load()
  Menu.bootstrap()
  const count = delegates.length + listeners.length
  Menu.bootstrap()
  Menu.reinitialization()
  load().bootstrap()
  assert.equal(delegates.length + listeners.length,count,'Remounts and hot module updates must reuse the global delegates.')

  const toggle = delegates.filter(item=>item.type==='click'&&item.selector.includes('[data-kt-menu-trigger]:not(.menu-item)'))
  assert.equal(toggle.length,1,'Exactly one handler may toggle a notification button per click.')
  const trigger = {}, instance = {click:()=>{instance.open=!instance.open},open:false}
  Menu.getInstance = () => instance
  toggle[0].callback.call(trigger,{})
  assert.equal(instance.open,true,'The click opens the panel rather than opening and closing it.')
  toggle[0].callback.call(trigger,{})
  assert.equal(instance.open,false,'The next click closes it.')
})
