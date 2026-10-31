import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

const context = vm.createContext({})
vm.runInContext(readFileSync(new URL('../public/bulletin-editor/selection-ui.js', import.meta.url), 'utf8'), context)
const {toolbarPosition} = context.ReportSelectionUI

test('context toolbar remains inside the visible canvas at either page edge', () => {
  const area = {x: 70, y: 120, w: 900, h: 700}
  for (const rect of [{x: 60, y: 125, w: 50, h: 25}, {x: 950, y: 790, w: 80, h: 50}]) {
    const at = toolbarPosition(rect, area, 190, 44)
    assert.ok(at.left >= 10 && at.left + 190 <= area.w - 10)
    assert.ok(at.top >= 10 && at.top + 44 <= area.h - 10)
  }
  const top = toolbarPosition({x: 200, y: 125, w: 200, h: 30}, area, 190, 44)
  assert.ok(top.top >= 49, 'near the top edge the controls move below the selection')
})

test('a header near the formatting bar puts quick actions beneath the entire selection', () => {
  const area={x:0,y:37,w:1080,h:600},format={x:58,y:50,w:804,h:52}
  const selected={x:145,y:147,w:602,h:123}
  const at=toolbarPosition(selected,area,280,44,[format])
  assert.ok(at.top+area.y>=selected.y+selected.h+14)
  assert.ok(at.top+area.y>format.y+format.h)
})

test('quick actions go above a bottom selection and respond to scrolling and zoomed bounds', () => {
  const area={x:0,y:37,w:1080,h:600},format={x:58,y:50,w:804,h:52}
  const bottom={x:145,y:550,w:602,h:40}
  const above=toolbarPosition(bottom,area,280,44,[format])
  assert.ok(above.top+area.y+44<bottom.y)
  const scrolled={...bottom,y:80,h:160}
  const below=toolbarPosition(scrolled,area,280,44,[format])
  assert.ok(below.top+area.y>=scrolled.y+scrolled.h+14)
})

test('very tall selections use an open side without covering the text or the formatting bar', () => {
  const area={x:70,y:120,w:1200,h:700},format={x:300,y:132,w:650,h:50}
  const selected={x:400,y:100,w:500,h:900}
  const at=toolbarPosition(selected,area,190,44,[format])
  assert.ok(at.left+area.x>=selected.x+selected.w || at.left+area.x+190<=selected.x)
  assert.ok(at.top>=10&&at.top+44<=area.h-10)
})
