/* Contextual controls. Document content and persistence remain in the editor host. */
(function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toolbarPosition(rect,area,width,height,obstacles=[]){
    const clamp=(value,min,max)=>Math.max(min,Math.min(value,Math.max(min,max)));
    const left=clamp(rect.x-area.x+(rect.w-width)/2,10,area.w-width-10);
    const selection={x:rect.x-area.x,y:rect.y-area.y,w:rect.w,h:rect.h};
    const blocked=obstacles.map(box=>({x:box.x-area.x-8,y:box.y-area.y-8,w:box.w+16,h:box.h+16}));
    const overlaps=(a,b)=>a.left<b.x+b.w&&a.left+width>b.x&&a.top<b.y+b.h&&a.top+height>b.y;
    const fits=at=>at.left>=10&&at.left+width<=area.w-10&&at.top>=10&&at.top+height<=area.h-10&&!blocked.some(box=>overlaps(at,box));
    // Flip to the other side of the object, rather than pushing the buttons
    // between the formatting bar and the selected object's text.
    const candidates=[{left,top:selection.y-height-28},{left,top:selection.y+selection.h+18}];
    const vertical=candidates.find(fits);if(vertical)return vertical;
    const top=clamp(selection.y+(selection.h-height)/2,10,area.h-height-10);
    for(const side of [selection.x+selection.w+18,selection.x-width-18]){const at={left:side,top};if(fits(at))return at;}
    // A selection can fill the viewport. Keep the controls accessible even then.
    const safeTop=blocked.reduce((value,box)=>Math.max(value,box.y+box.h+8),10);
    return {left,top:clamp(safeTop,10,area.h-height-10)};
  }
  let host,tools,format,popup,menu,signature='',queued=false;
  const $=selector=>document.querySelector(selector);
  const button=(command,label,glyph)=>`<button type="button" class="selection-action" data-context="${command}" aria-label="${label}" title="${label}"><i class="ki-outline ki-${glyph}" aria-hidden="true"></i></button>`;
  function selection(){return host?.selection()||{items:[],part:''};}
  function closeMenus(){if(popup)popup.hidden=true;if(menu)menu.hidden=true;tools?.querySelectorAll('[aria-expanded]').forEach(el=>el.setAttribute('aria-expanded','false'));}
  function clear(){signature='';if(tools)tools.hidden=true;if(format)format.hidden=true;closeMenus();$('#document-tools')?.removeAttribute('hidden');}
  function position(){
    queued=false;if(!tools||tools.hidden)return;
    const {elements}=selection();if(!elements?.length){clear();return;}
    const bounds=elements.map(el=>el.getBoundingClientRect()),area=$('#canvas-area').getBoundingClientRect();
    const rect={x:Math.min(...bounds.map(b=>b.left)),y:Math.min(...bounds.map(b=>b.top)),w:0,h:0};
    rect.w=Math.max(...bounds.map(b=>b.right))-rect.x;rect.h=Math.max(...bounds.map(b=>b.bottom))-rect.y;
    if(rect.y+rect.h<area.top||rect.y>area.bottom){tools.style.visibility='hidden';return;}
    const formatting=format.getBoundingClientRect();
    tools.style.visibility='';const at=toolbarPosition(rect,{x:area.x,y:area.y,w:area.width,h:area.height},tools.offsetWidth,tools.offsetHeight,
      format.hidden?[]:[{x:formatting.x,y:formatting.y,w:formatting.width,h:formatting.height}]);
    tools.style.left=at.left+'px';tools.style.top=at.top+'px';
    const open=popup&&!popup.hidden?popup:menu&&!menu.hidden?menu:null;
    if(open){tools.classList.toggle('open-up',at.top+tools.offsetHeight+open.offsetHeight+12>area.height&&at.top>open.offsetHeight+12);open.style.left=Math.min(0,area.width-at.left-open.offsetWidth-10)+'px';}
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(position);}}
  function refresh(){
    if(!host)return;const current=selection(),items=current.items;
    const main=$('#document-tools [data-adv="toggle-fields"]'),showFields=items.length?host.selectionFields():host.globalFields();main.disabled=!!current.part;main.textContent=showFields?'Ver datos de prueba':'Ver campos';main.setAttribute('aria-pressed',String(showFields));
    if(!items.length){clear();return;}
    const next=current.key;if(next!==signature){closeMenus();signature=next;}
    const first=items[0],locked=items.every(item=>item.locked),mixed=key=>items.some(item=>item[key]!==first[key]);
    tools.hidden=false;format.hidden=false;$('#document-tools').hidden=false;
    const details=format.querySelector('[data-context="properties"]');details.classList.toggle('active',!!host.propertiesOpen());details.setAttribute('aria-expanded',String(!!host.propertiesOpen()));
    const grouping=host.grouping(),fields=host.selectionFields(),view=format.querySelector('[data-adv="toggle-selected-fields"]');
    tools.querySelector('[data-context="group"]').hidden=!!current.part||!grouping.group;tools.querySelector('[data-context="ungroup"]').hidden=!!current.part||!grouping.ungroup;
    view.disabled=!!current.part;view.textContent=fields?'Ver datos de prueba':'Ver campos';view.setAttribute('aria-pressed',String(fields));
    tools.setAttribute('aria-label',locked?'Elemento bloqueado':'Acciones del elemento seleccionado');
    const lock=tools.querySelector('[data-context="lock"]');lock.setAttribute('aria-pressed',String(locked));
    lock.setAttribute('aria-label',locked?'Desbloquear':'Bloquear');lock.title=locked?'Desbloquear':'Bloquear';
    lock.innerHTML=`<i class="ki-outline ki-${locked?'lock-2':'lock-3'}" aria-hidden="true"></i>`;
    tools.querySelector('.selection-lock-label').hidden=!locked;
    for(const command of ['duplicate','delete'])tools.querySelector('[data-context="'+command+'"]').disabled=command==='duplicate'?!!current.part:locked;
    tools.querySelector('[data-context="duplicate"]').title=current.part?'El pie y la numeración se repiten en todas las páginas.':'Duplicar';
    for(const control of format.querySelectorAll('[data-format]')){
      const key=control.dataset.format;control.disabled=locked;
      if(control.tagName==='BUTTON'){const active=items.every(item=>key==='align'?item.align===control.dataset.value:!!item[key]);control.classList.toggle('active',active);control.setAttribute('aria-pressed',String(active));}
      else if(document.activeElement!==control){control.value=mixed(key)&&control.type!=='color'?'':first[key]??'';control.setAttribute('aria-description',mixed(key)?'La selección tiene varios valores.':'');}
    }
    const size=format.querySelector('[data-format="fontSize"]');size.max=current.part?'36':'90';
    format.querySelectorAll('[data-size-step]').forEach(control=>control.disabled=locked);
    format.querySelector('[data-format="strike"]').hidden=!!current.part;
    format.querySelector('.selection-color').style.color=first.color;
    const box=host.box();if(box)for(const input of popup.querySelectorAll('[data-position]')){if(document.activeElement!==input)input.value=Math.round(box[input.dataset.position]*10)/10;input.disabled=locked;}
    popup.querySelectorAll('[data-place]').forEach(control=>control.disabled=locked);
    menu.querySelectorAll('[data-context="bring-front"],[data-context="send-back"]').forEach(control=>control.disabled=!!current.part||locked);
    schedule();
  }
  function changeFormat(key,value){host.format(key,value);refresh();}
  function click(event){
    const control=event.target.closest('button');if(!control)return;
    if(!control.dataset.format&&!control.dataset.sizeStep&&!control.dataset.place&&!control.dataset.context)return;
    event.stopPropagation();
    if(control.dataset.format){const current=selection(),key=control.dataset.format;changeFormat(key,key==='align'?control.dataset.value:!current.items.every(item=>item[key]));return;}
    if(control.dataset.sizeStep){const value=Number(format.querySelector('[data-format="fontSize"]').value)||selection().items[0]?.fontSize||12;format.querySelector('[data-format="fontSize"]').value=value+Number(control.dataset.sizeStep);changeFormat('fontSize',value+Number(control.dataset.sizeStep));return;}
    if(control.dataset.place){host.arrange(control.dataset.place);refresh();return;}
    const command=control.dataset.context;
    if(command==='position'||command==='more'){
      const target=command==='position'?popup:menu,open=target.hidden;closeMenus();target.hidden=!open;control.setAttribute('aria-expanded',String(open));refresh();return;
    }
    closeMenus();if(command)host.action(command);
  }
  function init(adapter){
    host=adapter;const model=root.ReportPrototypeModel;
    format=$('#element-format');format.innerHTML=`<select data-format="font" aria-label="Fuente del elemento"><option value="" disabled>Varias fuentes</option>${model.fontFamilies.map(font=>`<option value="${esc(font)}">${esc(font)}</option>`).join('')}</select><div class="selection-font-size"><button type="button" data-size-step="-1" aria-label="Reducir tamaño de letra">−</button><input type="number" data-format="fontSize" min="8" max="90" step="1" aria-label="Tamaño de letra del elemento"><button type="button" data-size-step="1" aria-label="Aumentar tamaño de letra">+</button></div><label class="selection-color" title="Color del texto"><span aria-hidden="true">A</span><input type="color" data-format="color" aria-label="Color del texto del elemento"></label>${[['bold','Negrita','<b>B</b>'],['italic','Cursiva','<i>I</i>'],['underline','Subrayado','<u>U</u>'],['strike','Tachado','<s>S</s>']].map(([key,label,html])=>`<button type="button" class="selection-format-button" data-format="${key}" aria-label="${label}" aria-pressed="false">${html}</button>`).join('')}<span class="toolbar-divider"></span>${[['left','Alinear texto a la izquierda'],['center','Centrar texto'],['right','Alinear texto a la derecha']].map(([value,label])=>`<button type="button" class="selection-format-button" data-format="align" data-value="${value}" aria-label="${label}"><i class="ki-outline ki-text-align-${value}" aria-hidden="true"></i></button>`).join('')}<button type="button" class="button light selection-details" data-context="properties">Más formato</button><button class="field-view-toggle" data-adv="toggle-selected-fields" aria-pressed="true">Ver datos de prueba</button>`;
    tools=document.createElement('div');tools.id='selection-tools';tools.className='selection-tools';tools.hidden=true;tools.setAttribute('role','toolbar');
    tools.innerHTML='<button type="button" class="selection-group" data-context="group" hidden>Agrupar</button><button type="button" class="selection-group" data-context="ungroup" hidden>Desagrupar</button>'+button('position','Posición','abstract-14')+button('lock','Bloquear','lock-3')+'<span class="selection-lock-label" hidden>Bloqueado</span>'+button('duplicate','Duplicar','copy')+button('delete','Eliminar','trash')+button('more','Más opciones del elemento','dots-horizontal')+
      `<div id="selection-position" class="selection-popover" role="dialog" aria-label="Posición del elemento" hidden><h3>Posición y tamaño</h3><div class="selection-coordinates">${[['x','X'],['y','Y'],['w','Ancho'],['h','Alto']].map(([key,label])=>`<label>${label}<input type="number" data-position="${key}" step="1" aria-label="${label} del elemento"></label>`).join('')}</div><h4>Alinear a la página</h4><div class="selection-align-grid">${[['left','Izquierda'],['center','Centro horizontal'],['right','Derecha'],['top','Arriba'],['middle','Centro vertical'],['bottom','Abajo']].map(([key,label])=>`<button type="button" data-place="${key}">${label}</button>`).join('')}</div></div>`+
      `<div id="selection-more" class="selection-popover selection-more" role="menu" aria-label="Opciones del elemento" hidden>${[['content','Editar contenido'],['properties','Propiedades del elemento'],['bring-front','Traer delante'],['send-back','Enviar detrás']].map(([key,label])=>`<button type="button" data-context="${key}" role="menuitem">${label}</button>`).join('')}</div>`;
    tools.querySelector('[data-context="position"]').innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>';
    $('#canvas-area').append(format,tools);popup=$('#selection-position');menu=$('#selection-more');
    for(const root of [format,tools]){
      root.addEventListener('click',click);
      root.addEventListener('pointerdown',event=>{if(event.target.closest('button'))event.preventDefault();event.stopPropagation();});
      root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenus();}else if(['INPUT','SELECT'].includes(event.target.tagName))event.stopPropagation();});
    }
    format.addEventListener('change',event=>{const key=event.target.dataset.format;if(key)changeFormat(key,event.target.type==='number'?Number(event.target.value):event.target.value);});
    format.addEventListener('input',event=>{
      const input=event.target,key=input.dataset.format;
      if(key==='color')changeFormat(key,input.value);
      if(key==='fontSize'&&input.value!==''&&Number(input.value)>=8&&Number(input.value)<=Number(input.max))changeFormat(key,Number(input.value));
    });
    popup.addEventListener('change',event=>{if(event.target.dataset.position){host.arrange({key:event.target.dataset.position,value:Number(event.target.value)});refresh();}});
    document.addEventListener('pointerdown',event=>{if(!event.target.closest('#selection-tools'))closeMenus();});
    $('#canvas-scroll').addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
    const resize=new ResizeObserver(schedule);
    for(const element of [$('#canvas-area'),$('#paper-wrap'),format])resize.observe(element);
  }
  const api={init,refresh,position,schedule,clear,toolbarPosition};root.ReportSelectionUI=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
