/* Direct manipulation of repeated page elements. Shared SaaS editor. */
(function(root){
  'use strict';
  const M=typeof module!=='undefined'&&module.exports?require('./layout-model.js'):root.ReportPrototypeModel;
  const D=typeof module!=='undefined'&&module.exports?require('./page-layout.js'):root.ReportPageLayout;
  const F=typeof module!=='undefined'&&module.exports?require('./field-guide.js'):root.ReportFieldGuide;
  const names={footer:'Pie de página',numbering:'Numeración de páginas'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function place(doc,part,box){
    if(!names[part])return;
    doc.sheet=M.normalizeSheet(doc.sheet,!!doc.pagination?.enabled);
    const p=doc.sheet[part],size=M.pageSize(host?.view?host.view():doc);
    if(p.locked)return;
    const width=M.clamp(box.w,50,size.w),height=M.clamp(box.h||p.fontSize*1.5,22,size.h);
    const x=M.clamp(box.x,0,size.w-width),y=M.clamp(box.y,0,size.h-height);
    p.width=width;p.height=height;p.bottom=size.h-y-height;p.free=true;
    if(part==='footer')p.left=x;else p.right=size.w-x-width;
    return {x,y,w:width,h:height};
  }
  function selectionInfo(nodes){
    const count=nodes.length,locked=count>0&&nodes.every(n=>n.locked),some=nodes.some(n=>n.locked);
    return {count,locked,some,label:locked?'Desbloquear':some?'Bloquear todos':'Bloquear',status:locked?'Bloqueado':some?'Selección mixta':'Seleccionado',name:count===1?nodes[0].name:count+' elementos'};
  }
  let host,part='',selectedDoc=null,drag=null,inline=null,pending=null;
  const $=s=>document.querySelector(s);
  function selected(){if(!host)return '';const doc=host.doc();if(selectedDoc!==doc||!doc?.sheet?.[part]?.enabled){part='';selectedDoc=doc;}return part;}
  function clear(){finish();part='';drag=null;document.querySelectorAll('#paper .sheet-guide').forEach(el=>el.remove());document.querySelectorAll('#paper .sheet-selected').forEach(el=>{el.classList.remove('sheet-selected','sheet-locked');el.querySelectorAll('.sheet-selection-tag,.sheet-handle').forEach(n=>n.remove());});}
  function renderToolbar(){
    const key=selected(),p=key&&host.doc().sheet[key];
    if(key){const hint=$('#canvas-hint');hint.textContent=p.locked?'Bloqueado · Desbloquea para mover o editar':'Arrastra para mover · Doble clic para escribir';}
  }
  function decorate(){
    document.querySelectorAll('#paper .sheet-selected').forEach(el=>{el.classList.remove('sheet-selected','sheet-locked');el.querySelectorAll('.sheet-selection-tag,.sheet-handle').forEach(node=>node.remove());});
    const key=selected();if(!key)return;
    const el=$('#paper [data-sheet-target="'+key+'"]'),p=host.doc().sheet[key];if(!el)return;
    el.classList.add('sheet-selected');el.classList.toggle('sheet-locked',p.locked);
    el.insertAdjacentHTML('beforeend',`<span class="sheet-selection-tag">${names[key]} · ${p.locked?'Bloqueado':'Seleccionado'}</span>${p.locked?'':['nw','n','ne','e','se','s','sw','w'].map(h=>`<button class="sheet-handle ${h}" data-sheet-resize="${h}" tabindex="-1" aria-label="Cambiar tamaño de ${names[key].toLowerCase()}"></button>`).join('')}`);
  }
  function inspector(){
    const key=selected();if(!key)return false;
    const p=host.doc().sheet[key],disabled=p.locked?'disabled':'';
    $('#inspector-title').textContent=names[key];
    $('#inspector-content').innerHTML=`<p class="furniture-help">${p.locked?'Este elemento está bloqueado. Usa el candado superior para desbloquearlo.':'Muévelo arrastrándolo en la hoja. Arrastra los tiradores para cambiar el tamaño y haz doble clic para escribir.'}</p><div class="furniture-repeat">Se repite en todas las páginas</div><fieldset class="furniture-fields" ${disabled}><label class="field"><span>Texto</span><textarea data-sheet="${key}.text" data-furniture-prop="text" rows="3">${esc(F.humanize(p.text))}</textarea></label><small class="advanced-help">Escribe [ para insertar un campo automático.</small><div class="field-row"><label class="field"><span>Tipografía</span><select data-furniture-prop="font">${M.fontFamilies.map(font=>`<option ${p.font===font?'selected':''}>${font}</option>`).join('')}</select></label><label class="field"><span>Tamaño de letra</span><input data-furniture-prop="fontSize" type="number" min="8" max="36" value="${p.fontSize}"></label></div><div class="control-row">${[['bold','Negrita','<b>B</b>'],['italic','Cursiva','<i>I</i>'],['underline','Subrayado','<u>U</u>']].map(([prop,label,html])=>`<button class="icon-button ${p[prop]?'active':''}" data-furniture-toggle="${prop}" aria-label="${label}" aria-pressed="${p[prop]}">${html}</button>`).join('')}</div><label class="field"><span>Color del texto</span><input type="color" data-furniture-prop="color" value="${p.color}"></label><div class="control-row">${[['left','Izquierda'],['center','Centro'],['right','Derecha']].map(([value,label])=>`<button class="icon-button ${p.align===value?'active':''}" data-furniture-align="${value}" aria-label="Alinear a ${label.toLowerCase()}"><i class="ki-outline ki-text-align-${value}"></i></button>`).join('')}</div>${key==='footer'?`<span class="inspector-group-title">Separador del pie</span><div class="furniture-line-options">${[['none','Sin línea'],['solid','Continua'],['dashed','Rayas'],['dotted','Puntos']].map(([style,label])=>`<button class="button light ${(!p.rule.enabled&&style==='none'||p.rule.enabled&&style===p.rule.style)?'active':''}" data-furniture-line="${style}">${style==='none'?label:`<span class="line-sample" style="border-top-style:${style}"></span>${label}`}</button>`).join('')}</div><label class="field"><span>Color del separador</span><input type="color" data-furniture-prop="rule.color" value="${p.rule.color}"></label>`:`<label class="field"><span>Comenzar en</span><input data-furniture-prop="start" type="number" min="1" max="9999" value="${p.start}"></label><label class="advanced-check"><input data-furniture-prop="skipFirst" type="checkbox" ${p.skipFirst?'checked':''}>Ocultar en la primera página</label>`}</fieldset><button class="button danger" data-furniture-remove ${disabled}>Quitar ${key==='footer'?'pie':'numeración'}</button><button class="button violet properties-done" data-action="close-properties">Listo</button>`;
    return true;
  }
  function select(key,scroll=false){
    if(!names[key])return;
    host.finish();const doc=host.doc();doc.sheet=M.normalizeSheet(doc.sheet,!!doc.pagination?.enabled);
    if(!doc.sheet[key].enabled)host.commit(()=>doc.sheet[key].enabled=true);
    const same=selected()===key;part=key;selectedDoc=doc;host.clearNodes();if(scroll)host.openInspector(true);
    if(!same){host.paper();host.inspector();}host.header();host.panels();
    if(scroll)$('#paper [data-sheet-target="'+key+'"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function box(){const el=$('#paper [data-sheet-target="'+part+'"]');if(!el)return;const rect=el.getBoundingClientRect(),paper=$('#paper').getBoundingClientRect(),zoom=host.zoom();return {x:(rect.left-paper.left)/zoom,y:(rect.top-paper.top)/zoom,w:rect.width/zoom,h:rect.height/zoom};}
  function alignmentTargets(key){
    const paper=$('#paper').getBoundingClientRect(),zoom=host.zoom();
    return [...document.querySelectorAll('#paper .canvas-block,#paper [data-sheet-target="footer"],#paper [data-sheet-target="numbering"]')]
      .filter(el=>el.dataset.sheetTarget!==key).map(el=>{const r=el.getBoundingClientRect();return {x:(r.left-paper.left)/zoom,y:(r.top-paper.top)/zoom,w:r.width/zoom,h:r.height/zoom,textY:el.querySelector('.sheet-baseline')?(el.querySelector('.sheet-baseline').getBoundingClientRect().top-paper.top)/zoom:null};});
  }
  function pointerDown(event){if(host.locked?.())return false;
    const el=event.target.closest('[data-sheet-target]'),key=el?.dataset.sheetTarget;
    if(!names[key])return false;
    if(event.target.closest('[contenteditable=true]'))return true;
    select(key);if(host.doc().sheet[key].locked)return true;
    drag={key,handle:event.target.closest('[data-sheet-resize]')?.dataset.sheetResize,startX:event.clientX,startY:event.clientY,box:box(),before:host.snapshot(),moved:false,pointerId:event.pointerId};
    event.preventDefault();return true;
  }
  function pointerMove(event){
    if(!drag)return;
    const dx=(event.clientX-drag.startX)/host.zoom(),dy=(event.clientY-drag.startY)/host.zoom();
    if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<2)return;
    drag.moved=true;const paper=$('#paper');if(!paper.hasPointerCapture(event.pointerId))paper.setPointerCapture(event.pointerId);
    const size=M.pageSize(host.view?host.view():host.doc()),next=D.transformBox(drag.box,drag.handle,dx,dy,size);
    const active=$('#paper [data-sheet-target="'+drag.key+'"]');
    const baseline=(active.querySelector('.sheet-baseline').getBoundingClientRect().top-active.getBoundingClientRect().top)/host.zoom();
    const aligned=drag.handle?{box:next,guides:[]}:D.alignBox(next,alignmentTargets(drag.key),size,$('#snap-toggle').checked&&document.fonts?.status!=='loading',baseline);
    place(host.doc(),drag.key,aligned.box);host.paper();
    for(const guide of aligned.guides.filter(g=>g.kind!=='baseline'||Math.abs(($('#paper [data-sheet-target="'+drag.key+'"] .sheet-baseline').getBoundingClientRect().top-paper.getBoundingClientRect().top)/host.zoom()-g.at)<.5))paper.insertAdjacentHTML('beforeend',`<div class="guide sheet-guide ${guide.axis==='x'?'vertical':'horizontal'}" data-guide-kind="${guide.kind}" style="${guide.axis==='x'?'left':'top'}:${guide.at}px" aria-hidden="true"></div>`);
    host.header();event.preventDefault();
  }
  function pointerEnd(event){if(!drag)return;const item=drag;drag=null;if($('#paper').hasPointerCapture(item.pointerId))$('#paper').releasePointerCapture(item.pointerId);if(item.moved){host.history(item.before);host.paper();host.inspector();host.header();}}
  function finish(){if(pending){host.history(pending);pending=null;}if(!inline)return;const item=inline;inline=null;const p=host.doc()?.sheet?.[item.key];if(!p)return;p.text=F.internalize(item.element.innerText).slice(0,item.key==='numbering'?300:2500);item.element.contentEditable='false';item.element.classList.remove('inline-edit');host.history(item.before);host.header();}
  function edit(){if(host.locked?.())return;const key=selected();if(!key||host.doc().sheet[key].locked)return;host.finish();const el=$('#paper [data-sheet-target="'+key+'"] .sheet-content');if(!el)return;const p=host.doc().sheet[key];inline={key,element:el,before:host.snapshot()};el.textContent=F.humanize(p.text);el.contentEditable='true';el.classList.add('inline-edit');el.focus();const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);el.addEventListener('blur',()=>{finish();host.refresh();},{once:true});}
  function click(target){
    if(target.dataset.furnitureSelect){select(target.dataset.furnitureSelect,true);return true;}
    if(!selected())return false;
    const p=host.doc().sheet[part];
    if(target.hasAttribute('data-furniture-remove')||target.dataset.action==='delete'){if(!p.locked)host.commit(()=>{p.enabled=false;part='';});return true;}
    if(target.dataset.action==='lock'){host.commit(()=>p.locked=!p.locked);return true;}
    if(target.dataset.action==='align-center'){if(!p.locked){const current=box();if(!current)return true;host.commit(()=>place(host.doc(),part,{...current,x:(M.pageSize(host.view?host.view():host.doc()).w-current.w)/2}));}return true;}
    if(target.dataset.action==='duplicate'){host.toast('El pie y la numeración ya se repiten en todas las páginas.','info');return true;}
    if(target.dataset.furnitureToggle||target.dataset.furnitureAlign||target.dataset.furnitureLine){if(!p.locked)host.commit(()=>{if(target.dataset.furnitureToggle)p[target.dataset.furnitureToggle]=!p[target.dataset.furnitureToggle];if(target.dataset.furnitureAlign)p.align=target.dataset.furnitureAlign;if(target.dataset.furnitureLine){p.rule.enabled=target.dataset.furnitureLine!=='none';if(p.rule.enabled)p.rule.style=target.dataset.furnitureLine;}});return true;}
    return false;
  }
  function apply(input,key){const p=host.doc().sheet[key],keys=input.dataset.furnitureProp.split('.');let target=p;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):keys.at(-1)==='text'?F.internalize(input.value):input.value;host.doc().sheet=M.normalizeSheet(host.doc().sheet,!!host.doc().pagination?.enabled);}
  function input(input){if(!input.dataset.furnitureProp||!['INPUT','TEXTAREA'].includes(input.tagName)||input.type==='checkbox')return false;const key=selected();if(!key||host.doc().sheet[key].locked)return true;if(!pending)pending=host.snapshot();apply(input,key);host.paper();host.header();return true;}
  function change(input){if(!input.dataset.furnitureProp)return false;const key=selected();if(!key||host.doc().sheet[key].locked)return true;host.commit(()=>apply(input,key));return true;}
  function init(adapter){
    host=adapter;const paper=$('#canvas-scroll');paper.addEventListener('pointermove',pointerMove);paper.addEventListener('pointerup',pointerEnd);paper.addEventListener('pointercancel',pointerEnd);
    paper.addEventListener('dblclick',event=>{if(names[event.target.closest('[data-sheet-target]')?.dataset.sheetTarget])edit();});
    document.addEventListener('keydown',event=>{
      if(!selected()||$('#app-dialog').open||$('#preview-dialog').open||$('#editor-view').hidden||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
      const key=event.key,p=host.doc().sheet[part],vectors={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(vectors[key]){event.preventDefault();event.stopImmediatePropagation();if(!p.locked){const current=box(),step=event.shiftKey?10:1,[dx,dy]=vectors[key];if(!current)return;host.commit(()=>place(host.doc(),part,{...current,x:current.x+dx*step,y:current.y+dy*step}));}}
      else if(key==='Delete'||key==='Backspace'){event.preventDefault();event.stopImmediatePropagation();if(!p.locked)host.commit(()=>{p.enabled=false;part='';});}
      else if(key==='Enter'){event.preventDefault();event.stopImmediatePropagation();edit();}
    },true);
  }
  const api={box,select,edit,init,selected,clear,renderToolbar,decorate,inspector,pointerDown,finish,click,input,change,place,selectionInfo,isEditing:()=>!!inline};
  root.ReportSheetEditor=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
