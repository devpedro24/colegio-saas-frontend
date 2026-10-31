(function () {
  'use strict';
  const O=window.ReportCanvasObjects,X=window.ReportSelectionUI,E=window.ReportSheetEditor,C=window.ReportCanvasEngine,D=window.ReportPageLayout,S=window.ReportSheetUI,R=window.ReportPrototypeEngine, U=window.ReportPrototypeUI, L=window.ReportDesignLibrary, P=window.ReportProposalUI, F=window.ReportFieldGuide;
  const createDesign=(kind,scope)=>{const spec=L.byKey(kind);if(spec)return L.build(spec,P.profile());const doc=kind?.startsWith('reference-')?R.reference(kind):M.documentDesign(kind,scope);doc.institution=P.profile();doc.school=doc.institution.name;return doc;};
  const Q=window.ReportStudioDialogs;Q.init();
  const M=window.ReportPrototypeModel, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=(name)=>`<i class="ki-outline ki-${name}" aria-hidden="true"></i>`;
  const palette=['#6A23FF','#183C67','#1B84FF','#0E695B','#923E4F','#9A5C17'];
  const state={doc:null,page:0,selected:[],panel:'blocks',inspectorTab:'style',libraryOpen:false,inspectorOpen:false,zoom:.6,autoFit:true,undo:[],redo:[],baseline:'',filter:'all',saved:new Map(),catalogLoaded:false,device:'desktop',drag:null,finalEnabled:true,editing:null,fieldMode:false,previewModes:{},marquee:null,generated:null,layoutError:''};
  const presets=[{kind:'reference-preschool',label:'Asignaturas agrupadas · Valoración visual',description:'Indicadores por materia y valoración con caritas',scope:'periodo'},
    {kind:'reference-primary',label:'Asignaturas · I.H. y desempeño',description:'Columnas configurables y datos del período',scope:'periodo'},
    {kind:'reference-final',label:'Anual · Campos automáticos',description:'Texto automático, períodos y nota final',scope:'final'},{kind:'blank',label:'En blanco',description:'Diseña desde cero',scope:'periodo'},
    {kind:'institutional',label:'Institucional',description:'Identidad y claridad en cada período',scope:'periodo'},
    {kind:'minimal',label:'Esencial',description:'Un diseño limpio, con lo importante',scope:'periodo'},
    {kind:'visual',label:'Valoración con caritas',description:'Caritas configurables, sin limitar el grado',scope:'periodo'},
    {kind:'annual',label:'Cierre anual',description:'Períodos, definitiva y promoción',scope:'final'},
    {kind:'institutional',label:'Mi diseño · Copia',description:'Un punto de partida para personalizar',scope:'periodo'}];
  presets.unshift(...presets.splice(presets.findIndex(p=>p.kind==='blank'),1));
  presets.push(...L.catalog.map(spec=>({...spec,kind:spec.key})));
  const samples={student:'Valentina Martínez · Muestra',group:'Cuarto · 04A',year:'2026',period:'Segundo período',teacher:'Docente de muestra'};
  const subjects=['Matemáticas','Lengua Castellana','Ciencias Naturales','Ciencias Sociales','Inglés'];
  const values=['4,3','4,1','4,5','3,9','4,2'];
  const periodValues=[['4,0','4,2','4,3','4,5','4,2'],['4,1','4,3','4,0','4,4','4,2'],['4,5','4,2','4,6','4,5','4,4'],['3,8','3,9','4,0','4,3','4,0'],['4,1','4,0','4,4','4,3','4,2']];
  const viewWidth=()=>$('#app').clientWidth, small=()=>viewWidth()<=780, tablet=()=>viewWidth()<=1200;
  const allNodes=()=>state.doc.pages.flatMap(p=>p.blocks);
  const currentPage=()=>state.doc.pages[state.doc.pagination?.enabled?(state.generated?.[state.page]?.sourceIndex??0):state.page]||state.doc.pages[0];
  const activeDoc=()=>M.pageView(state.doc,currentPage());
  const pageLocked=()=>!!state.doc&&!!currentPage()?.locked;
  const selectedNodes=()=>allNodes().filter(n=>state.selected.includes(n.id));
  const firstSelected=()=>selectedNodes()[0];
  const dirty=()=>state.doc && JSON.stringify(state.doc)!==state.baseline;
  const snapshot=()=>JSON.stringify(state.doc);
  function pushHistory(before){if(before===snapshot())return;state.undo.push(before);state.redo=[];while(state.undo.length>40||(state.undo.length>2&&state.undo.reduce((a,b)=>a+b.length,0)>8000000))state.undo.shift();}
  function commit(action,options={}){if(pageLocked()&&!options.pageAction){toast('Desbloquea la página para editarla.','info');return false;}finishTextEdit();const before=snapshot();action();pushHistory(before);renderEditor(options);}
  function toast(text,type='ok'){const n=document.createElement('div');n.className='toast';n.innerHTML=icon(type==='ok'?'check-circle':'information-2')+`<span>${esc(text)}</span>`;$('#toast-region').append(n);setTimeout(()=>n.remove(),4200);}
  function dialog(title,html,actions){const box=$('#app-dialog');if(box.open)box.close();$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=html;const footer=$('#dialog-actions');footer.replaceChildren();for(const action of actions){const b=document.createElement('button');b.type='button';b.className='button '+(action.style||'light');b.textContent=action.label;b.disabled=!!action.disabled;b.addEventListener('click',async()=>{if(box.getAttribute('aria-busy')==='true')return;let finish;try{const result=action.run?.();if(result&&typeof result.then==='function')finish=Q.busy(box,b,action.loadingLabel||'Procesando…');if(await result!==false)box.close();}finally{finish?.();}});footer.append(b);}box.showModal();setTimeout(()=>$('#dialog-body input, #dialog-body textarea')?.focus(),30);}
  const cancelAction=()=>({label:'Cancelar',run:()=>true});
  function askLeave(then){if(!dirty()){then();return;}dialog('Tienes cambios sin guardar','<p>Puedes guardar este diseño antes de salir o continuar editándolo.</p>',[{label:'Seguir editando',run:()=>true},{label:'Descartar cambios',style:'danger',run:()=>{window.SchoolBulletinEditor.discarded();then();}}, {label:'Guardar y salir',style:'green',run:async()=>{if(await saveDocument())then();else return false;}}]);}
  async function readSaved(){try{const rows=await window.SchoolBulletinEditor.catalog();for(const row of rows)state.saved.set(row.id,row);state.catalogLoaded=true;if(!state.doc)renderGallery();}catch(error){toast(error.message,'info');}}
  let saving=false;
  async function saveDocument(publish=false){if(saving||!state.doc)return false;saving=true;document.body.classList.add('editor-saving');$('#editor-view').setAttribute('aria-busy','true');const pendingButton=$('[data-action="'+(publish?'publish':'save')+'"]'),pendingHTML=pendingButton.innerHTML;pendingButton.innerHTML='<span class="studio-spinner" aria-hidden="true"></span><span>'+(publish?'Publicando…':'Guardando…')+'</span>';$$('[data-action="save"],[data-action="publish"]').forEach(b=>b.disabled=true);finishTextEdit();try{const oldId=state.doc.id,row=await window.SchoolBulletinEditor.save(M.clone(state.doc),publish);state.saved.delete(oldId);state.saved.set(row.id,row);state.doc=row.doc;state.baseline=snapshot();renderEditor();toast(publish&&row.published?'Revisión publicada.':'Plantilla guardada.');return true;}catch(error){toast(error.message,'info');return false;}finally{saving=false;document.body.classList.remove('editor-saving');$('#editor-view').removeAttribute('aria-busy');pendingButton.innerHTML=pendingHTML;$$('[data-action="save"],[data-action="publish"]').forEach(b=>b.disabled=false);}}
  for(const name of ['pointerdown','keydown','input','change'])document.addEventListener(name,event=>{if(saving){if(name==='pointerdown'&&event.target.matches('dialog[open]')&&Q.outside(event,event.target))Q.feedback(event.target);event.preventDefault();event.stopImmediatePropagation();}},true);
  function renderBlockContent(n,doc,scale=doc.sampleScale,mode=state.fieldMode?'fields':'values'){
    if(n._html!==undefined)return n._html;
    return R.content(n,doc,R.context(doc,scale),mode);
  }
  function blockHTML(n,doc,selected=false,index=0,scale=doc.sampleScale,mode='values'){if(n.hidden)return '';return `<div class="canvas-block ${n._flow?'flow-block':''} ${n._designer?'designer-block':''} ${selected?'selected':''} ${n.locked?'locked':''}" data-node="${esc(n.id)}" style="--report-accent:${esc(n.accent)};left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;color:${esc(n.color)};font-family:'${esc(n.font)}';font-size:${n.fontSize}px;font-weight:${n.bold?700:400};font-style:${n.italic?'italic':'normal'};line-height:${n.lineHeight||1.5};letter-spacing:${n.letterSpacing||0}px;text-decoration:${[n.underline?'underline':'',n.strike?'line-through':''].filter(Boolean).join(' ')||'none'};text-align:${esc(n.align)};background:${['line','rectangle','circle'].includes(n.type)?'transparent':esc(n.fill)};border-radius:${n.radius}px;z-index:${index+2}"><div class="block-content" style="">${renderBlockContent(n,doc,scale,mode)}</div>${selected?`<div class="selection-tag">${esc(n.name)}${n.locked?' · Bloqueado':''}</div>${n.locked?'':['nw','n','ne','e','se','s','sw','w'].map(handle=>`<button class="block-handle ${handle}" data-resize="${handle}" tabindex="-1" aria-label="Cambiar tamaño"></button>`).join('')}`:''}</div>`;}
  function pageHTML(page,doc,index=0,editable=false,scale=doc.sampleScale,total=doc.pages.length){doc=M.pageView(doc,page);return page.blocks.map((n,i)=>blockHTML(n,doc,false,i,scale,editable&&state.fieldMode?'fields':'values')).join('')+D.render(doc,R.context(doc,scale),index,total,editable);}
  function renderGallery(){if(!state.doc)window.SchoolBulletinEditor.view('gallery');const term=L.fold($('#gallery-search').value).replace(/verde/g,'esmeralda'),words=term.split(' ').filter(w=>w&&!['boletin','plantilla','de','del'].includes(w)),cards=[];
    for(const row of [...state.saved.values()].sort((a,b)=>b.updated-a.updated)){if(!P.matches({...row.doc.design,orientation:row.doc.orientation})||(state.filter!=='all'&&state.filter!=='visual'&&row.doc.scope!==state.filter)||(state.filter==='visual'&&row.doc.sampleScale!=='visual')||!words.every(w=>L.fold(row.doc.name).includes(w)))continue;cards.push(cardHTML(row.doc,row.doc.name,row.published?`Publicado · Revisión ${row.published}`:'Borrador del colegio',`data-open="${esc(row.id)}"`,false,'Continuar'));}
    const page=P.page(cards);
    $('#catalog-pagination').hidden=cards.length<=12;
    $('#template-grid').innerHTML=!state.catalogLoaded?'<div class="empty-gallery" role="status">Cargando tus plantillas…</div>':page.join('')||(state.saved.size?'<div class="empty-gallery">No hay plantillas con estos filtros.</div>':'<div class="empty-gallery"><i class="ki-outline ki-document" aria-hidden="true"></i><h2>Aún no has creado plantillas</h2><p>Crea una desde cero o usa el asistente para preparar un diseño. Aparecerá aquí cuando lo guardes.</p><button class="button violet" data-action="new">Crear plantilla</button></div>');
  }
  function cardHTML(doc,name,description,attr,blank,action){
    const remove=state.saved.has(doc.id)&&window.SchoolBulletinEditor.canEdit()?`<button type="button" class="button danger template-delete" data-remove-template="${esc(doc.id)}" aria-label="Eliminar plantilla: ${esc(name)}" title="Eliminar plantilla">${icon('trash')}<span>Eliminar</span></button>`:'';
    const actions=`<div class="card-actions"><button class="button ${blank?'violet':'soft'}" ${attr}>${action}</button>${remove}</div>`;
    const body=`<div class="template-body"><h3>${esc(name)}</h3><p>${esc(description)}</p>${actions}</div>`;
    if(doc.design?.catalogKey)return `<article class="template-card"><button class="template-cover library-cover" ${attr} aria-label="Abrir ${esc(name)}">${L.thumbnail(doc)}</button><span class="card-badge ${doc.scope==='final'?'final':''}">${doc.orientation==='landscape'?'Horizontal':'Vertical'}</span>${body}</article>`;
    const size=M.pageSize(doc),preview=blank?'<div class="blank-paper">'+icon('plus')+'</div>':`<div class="paper mini-paper" style="width:${size.w}px;height:${size.h}px">${galleryPaperHTML(doc)}</div>`;
    return `<article class="template-card"><button class="template-cover" ${attr} aria-label="Abrir ${esc(name)}">${preview}</button>${blank?'':`<span class="card-badge ${doc.scope==='final'?'final':''}">${doc.scope==='final'?'Final':'Período'}</span>`}${body}</article>`;
  }
  let removing=false;
  function removeTemplate(id){
    const row=state.saved.get(id);if(!row||!window.SchoolBulletinEditor.canEdit())return;
    dialog('Eliminar plantilla',`<p>¿Quieres eliminar <strong>${esc(row.doc.name)}</strong>?</p><p>Dejará de estar disponible para nuevos boletines. Los boletines ya emitidos conservarán su diseño y contenido.</p>`,[cancelAction(),{label:'Eliminar plantilla',style:'danger',run:async()=>{
      if(removing)return false;removing=true;const buttons=$$('#dialog-actions button');buttons.forEach(button=>button.disabled=true);
      try{await window.SchoolBulletinEditor.remove(id);state.saved.delete(id);renderGallery();toast('Plantilla eliminada.');return true;}
      catch(error){toast(error.message,'info');return false;}
      finally{removing=false;buttons.forEach(button=>button.disabled=false);}
    }}]);
  }
  function openDocument(doc,existing=false){state.generated=null;state.fieldMode=true;state.previewModes={};state.doc=window.SchoolBulletinEditor.decorate(C.prepare(doc));if(!existing)state.doc.id=M.uid();state.page=0;state.selected=[];state.undo=[];state.redo=[];state.baseline=snapshot();state.libraryOpen=!tablet();state.inspectorOpen=false;state.autoFit=true;$('#gallery-view').hidden=true;$('#editor-view').hidden=false;window.SchoolBulletinEditor.view('editor');renderEditor();requestAnimationFrame(fitPage);}
  window.addEventListener('school-editor:preview',showPreview);
  window.addEventListener('school-editor:discard',()=>{$$('#preview-dialog,#app-dialog,#template-assistant').forEach(dialog=>{if(dialog.open)dialog.close();});state.undo=[];state.redo=[];showGallery();});
  function showGallery(){state.doc=null;state.generated=null;$('#gallery-view').hidden=false;$('#editor-view').hidden=true;window.SchoolBulletinEditor.view('gallery');renderGallery();}
  function renderHeader(){if(!state.doc)return;$('#document-name span').textContent=state.doc.name;const status=$('#save-status');status.textContent=dirty()?'Sin guardar':state.saved.has(state.doc.id)?'Guardado en el colegio':'Borrador';status.classList.toggle('dirty',!!dirty());$$('[data-action="undo"]').forEach(b=>b.disabled=!state.undo.length);$$('[data-action="redo"]').forEach(b=>b.disabled=!state.redo.length);$$('[data-scope]').forEach(b=>{b.classList.toggle('active',b.dataset.scope===state.doc.scope);b.disabled=b.dataset.scope==='final'&&!state.finalEnabled;b.title=b.disabled?'Habilita el final en los datos de muestra.':'';});$('#paper-format').value=activeDoc().format;$('#paper-orientation').value=activeDoc().orientation;$('#paper-format').disabled=pageLocked();$('#paper-orientation').disabled=pageLocked();E.renderToolbar(selectedNodes());X.refresh();window.SchoolBulletinEditor.changed(state.doc,dirty());}
  function galleryPaperHTML(doc){if(!doc.pagination?.enabled)return pageHTML(doc.pages[0],doc);try{const layout=R.paginate(doc);return pageHTML(layout.pages[0],doc,0,false,doc.sampleScale,layout.pages.length);}catch(error){return '<div class="pagination-error">'+esc(error.message)+'</div>';}}
  function pageTools(page,index){
    const source=state.doc.pages[page.sourceIndex??index],i=page.sourceIndex??index,label='Página '+(index+1);
    const button=(action,name,glyph,disabled=false)=>`<button type="button" class="icon-button" data-page-op="${action}" data-source-page="${i}" aria-label="${name}" title="${name}" ${disabled?'disabled':''}>${icon(glyph)}</button>`;
    return `<div class="page-caption"><strong>${label}</strong><input data-page-title="${i}" aria-label="Título de la página ${index+1}" maxlength="100" placeholder="Agregar título de página" value="${esc(source.title||'')}" ${source.locked?'disabled':''}>${source.hidden?'<span class="page-state">Oculta</span>':''}${source.locked?'<span class="page-state">Bloqueada</span>':''}</div><div class="page-tool-buttons">${button('up','Subir página','up',i===0)}${button('down','Bajar página','down',i===state.doc.pages.length-1)}${button('hide',source.hidden?'Mostrar página':'Ocultar página',source.hidden?'eye':'eye-slash')}${button('lock',source.locked?'Desbloquear página':'Bloquear página',source.locked?'lock-2':'lock')}${button('copy','Duplicar página','copy')}${button('delete','Eliminar página','trash',source.locked||state.doc.pages.length===1)}${button('add','Añadir página después','plus-square')}</div>`;
  }
  function renderPaper(){
    state.layoutError='';
    try{
      state.generated=C.design(state.doc,state.fieldMode?'fields':'values',R.browserMeasure,state.previewModes).pages;
      state.page=M.clamp(state.page,0,state.generated.length-1);const scroll=$('#canvas-scroll');
      let stack=$('#page-stack');if(!stack){scroll.innerHTML='<div id="page-stack"></div>';stack=$('#page-stack');}
      const keys=state.generated.map((p,i)=>(state.doc.pages[p.sourceIndex]?.id||i)+':'+i).join('|');
      if(stack.dataset.keys!==keys){stack.innerHTML=state.generated.map((p,i)=>`<section class="studio-page" data-stack-page="${i}"><div class="page-tools"></div><div class="stack-paper-wrap"><div class="paper stack-paper" data-page-view="${i}" tabindex="0"></div></div></section>`).join('');stack.dataset.keys=keys;}
      for(const [i,page] of state.generated.entries()){
        const item=stack.children[i],el=item.querySelector('.stack-paper'),wrap=item.querySelector('.stack-paper-wrap'),tools=item.querySelector('.page-tools');
        if(tools.querySelector('input')!==document.activeElement)tools.innerHTML=pageTools(page,i);
        const active=i===state.page;el.setAttribute('aria-label','Página del boletín '+(i+1));el.id=active?'paper':'';wrap.id=active?'paper-wrap':'';item.classList.toggle('active-page',active);item.classList.toggle('hidden-page',page.hidden);item.classList.toggle('locked-page',page.locked);
        el.classList.add('has-flow','designer-canvas');const html=pageHTML(page,state.doc,i,true,state.doc.sampleScale,state.generated.length);
        if(active||el.innerHTML!==html)el.innerHTML=html;
      }
      paper=$('#paper');paper.inert=pageLocked();E.decorate();renderSelection();applyZoom();renderPages();X.refresh();
      $('#inspector').inert=pageLocked();
    }catch(error){state.layoutError=error.message;$('#canvas-scroll').innerHTML='<div class="pagination-error">'+esc(error.message)+'</div>';}
  }
  function applyZoom(){if(!state.doc)return;
    for(const [i,page] of (state.generated||[]).entries()){
      const size=M.pageSize(M.pageView(state.doc,page)),item=$('#page-stack').children[i],el=item.querySelector('.stack-paper'),wrap=item.querySelector('.stack-paper-wrap');
      el.style.width=size.w+'px';el.style.height=size.h+'px';el.style.transform=`scale(${state.zoom})`;wrap.style.width=size.w*state.zoom+'px';wrap.style.height=size.h*state.zoom+'px';item.style.width=Math.max(320,size.w*state.zoom)+'px';
    }
    $('#zoom-label').textContent=Math.round(state.zoom*100)+' %';$('#zoom-range').value=state.zoom*100;const view=activeDoc();$('#canvas-context').textContent=(M.paperFormats[view.format]?.name||'Carta').toUpperCase()+' · '+(view.orientation==='portrait'?'VERTICAL':'HORIZONTAL');X.schedule();
  }
  function fitPage(){if(!state.doc)return;const area=$('#canvas-scroll'),size=M.pageSize(activeDoc());let width=area.clientWidth-55;if(tablet()&&!small()&&state.inspectorOpen)width-=290;state.zoom=M.clamp(Math.min(width/size.w,(area.clientHeight-100)/size.h),.22,1);applyZoom();}
  function renderPanels(){const editor=$('#editor-view');editor.classList.toggle('library-open',state.libraryOpen);editor.classList.toggle('templates-open',state.libraryOpen&&state.panel==='designs');editor.classList.toggle('inspector-open',state.inspectorOpen);$('#panel-scrim').hidden=!(state.libraryOpen&&tablet()||state.inspectorOpen&&small());$$('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===state.panel&&state.libraryOpen));}
  function renderPages(){const pages=state.generated||state.doc.pages;$('#page-tabs').innerHTML=pages.map((p,i)=>`<button class="page-tab ${i===state.page?'active':''} ${p.hidden?'page-is-hidden':''}" data-page="${i}" aria-label="Página ${i+1}" title="${esc(p.title||'Página '+(i+1))}"><span>${i+1}${p.hidden?' · ◌':''}${p.locked?' · 🔒':''}</span></button>`).join('');$('#page-count').textContent=`Página ${state.page+1} de ${pages.length} · Diseño`;}
  function activatePage(index,scroll=false){finishTextEdit();E.clear();state.page=index;state.selected=[];renderEditor();if(scroll)$('#page-stack').children[state.page]?.scrollIntoView({block:'start',behavior:'smooth'});}
  function pageAction(index,action,value){
    const run=()=>{try{const result=window.ReportTemplatePages.update(state.doc,index,action,value);commit(()=>{state.doc=result.doc;state.selected=[];E.clear();},{pageAction:true});state.page=Math.max(0,state.generated.findIndex(p=>p.sourceIndex===result.index));renderEditor();if(['add','copy','up','down'].includes(action))$('#page-stack').children[state.page]?.scrollIntoView({block:'start',behavior:'smooth'});}catch(error){toast(error.message,'info');}};
    if(action==='delete'){dialog('Eliminar página','<p>Se eliminará esta página del borrador. Puedes recuperar el cambio con Deshacer.</p>',[cancelAction(),{label:'Eliminar página',style:'danger',run}]);}else run();
  }
  function renderEditor(options={}){if(!state.doc)return;if(!state.doc.pagination?.enabled)state.page=M.clamp(state.page,0,state.doc.pages.length-1);state.selected=state.selected.filter(id=>allNodes().some(n=>n.id===id));renderPaper();renderHeader();if(!options.keepInspector)renderInspector();renderLibrary();renderPages();renderPanels();const fields=state.selected.length?selectedNodes().every(n=>(state.previewModes[n.id]||(state.fieldMode?'fields':'values'))==='fields'):state.fieldMode;$$('[data-adv="toggle-fields"]').forEach(b=>{b.classList.toggle('active',fields);b.setAttribute('aria-pressed',String(fields));b.textContent=fields?'Ver datos de prueba':'Ver campos';});}
  const tiles=(types)=>types.map(type=>`<button class="block-tile" draggable="true" data-add="${type}">${icon({header:'bank',student:'profile-circle',grades:'grid',indicators:'chart-simple',observation:'document',attendance:'calendar',signature:'pencil',promotion:'medal-star',title:'text',text:'text'}[type]||'document')}<span>${esc(M.titles[type])}</span><span class="tile-grip">⠿</span></button>`).join('');
  const thumbnailCache=new Map();let templateObserver;
  function templatePreview(index,host){
    const preset=presets[index];if(!preset)return;
    if(!thumbnailCache.has(index)){
      try{const doc=C.prepare(createDesign(preset.kind,preset.scope)),size=M.pageSize(doc),layout=C.design(doc,'values'),page=layout.pages[0];
        thumbnailCache.set(index,`<svg viewBox="0 0 ${size.w} ${size.h}" aria-hidden="true"><foreignObject width="${size.w}" height="${size.h}"><div xmlns="http://www.w3.org/1999/xhtml" class="paper" style="width:${size.w}px;height:${size.h}px">${pageHTML(page,doc,0,false,doc.sampleScale,layout.pages.length)}</div></foreignObject></svg>`);
      }catch{thumbnailCache.set(index,'<span class="preset-unavailable">Vista no disponible</span>');}
    }host.innerHTML=thumbnailCache.get(index);
  }
  function renderTemplateLibrary(content){
    if(content.querySelector('.preset-grid'))return;
    templateObserver?.disconnect();
    content.innerHTML='<p class="library-hint">Elige una plantilla para reemplazar esta página o añadirla como una página nueva.</p><div class="preset-grid">'+presets.map((p,i)=>`<button type="button" class="preset-card" data-preset="${i}" aria-label="${esc(p.label)}" title="${esc(p.description)}"><span class="preset-cover" data-template-preview="${i}"></span><span class="preset-name">${esc(p.label)}</span><span class="preset-kind">${p.scope==='final'?'Final / sumatorio':'Por período'}</span></button>`).join('')+'</div>';
    templateObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){templatePreview(Number(entry.target.dataset.templatePreview),entry.target);templateObserver.unobserve(entry.target);}},{root:$('#library'),rootMargin:'120px'});
    content.querySelectorAll('[data-template-preview]').forEach(host=>templateObserver.observe(host));
  }
  function chooseTemplate(index){
    const preset=presets[index];if(!preset)return;
    if(!state.doc){openDocument(createDesign(preset.kind,preset.scope));return;}
    finishTextEdit();
    const apply=replace=>{try{
      const sourceIndex=state.doc.pages.indexOf(currentPage()),result=window.ReportTemplatePages.insert(state.doc,createDesign(preset.kind,preset.scope),sourceIndex,replace);
      commit(()=>{state.doc=result.doc;state.page=result.index;state.selected=[];state.previewModes={};},{pageAction:true});
      state.page=Math.max(0,state.generated.findIndex(p=>p.sourceIndex===result.index));renderPaper();renderPages();
      state.inspectorOpen=false;if(tablet())state.libraryOpen=false;renderPanels();if(state.autoFit)requestAnimationFrame(fitPage);
      toast(replace?'Página reemplazada. Puedes deshacer el cambio.':'Plantilla añadida como página nueva.');return true;
    }catch(error){toast(error.message,'info');return false;}};
    dialog('¿Cómo quieres usar esta plantilla?',`<div class="template-choice"><button type="button" class="template-choice-preview" data-preview-template="${index}" aria-label="Ampliar vista previa">${thumbnailCache.get(index)||''}</button><div><strong>${esc(preset.label)}</strong><p>Añádela como página nueva para conservar lo que estás editando.</p><p>Se conservan el tamaño y la orientación de la plantilla. Puedes usar cualquier diseño para el boletín actual.</p><p>Los datos corresponden al tipo de boletín seleccionado.</p></div></div>`,[cancelAction(),{label:'Ver vista previa',run:()=>{previewTemplate(index);return false;}},{label:'Reemplazar la página actual',disabled:pageLocked(),run:()=>apply(true)},{label:'Agregar como página nueva',style:'violet',run:()=>apply(false)}]);
  }
  function renderLibrary(){const type=state.panel,content=$('#library-content'),head=$('#library-title');
    if(type==='sheet'){head.textContent='Hoja, marco y pie';content.innerHTML=S.panel(state.doc);}
    if(type==='blocks'){head.textContent='Bloques del boletín';content.innerHTML='<p class="library-hint">Arrastra un bloque a la hoja o toca para añadirlo.</p>'+tiles(['header','student','table','scale','pagebreak','grades','indicators','observation','attendance',...(state.doc.scope==='final'?['promotion']:[]),'signature'])+'<div class="library-subheading">Hazlo tuyo</div>'+tiles(['text']);}
    if(type==='text'){head.textContent='Texto';content.innerHTML='<p class="library-hint">Haz doble clic sobre el texto del lienzo para editarlo.</p><button class="text-tile" data-add="text" data-size="32"><strong style="font-size:23px">Añadir un título</strong></button><button class="text-tile" data-add="text" data-size="23"><strong style="font-size:17px">Añadir un subtítulo</strong></button><button class="text-tile" data-add="text" data-size="17">Añadir un texto libre</button><div class="library-subheading">Texto del boletín</div>'+tiles(['title','observation']);}
    if(type==='shapes'){head.textContent='Elementos';content.innerHTML='<p class="library-hint">Formas, líneas y acentos para dar identidad al diseño.</p><div class="shape-options">'+['rectangle','circle','line'].map(t=>`<button class="shape-option ${t}" data-add="${t}" draggable="true"><span class="shape-thumb"></span>${M.titles[t]}</button>`).join('')+'</div>';}
    if(type==='images'){head.textContent='Imágenes';content.innerHTML='<div class="upload-box">'+icon('picture')+'<strong>Tu identidad en cada boletín</strong><span>Añade un logo o una imagen desde tu equipo.</span><button class="button violet" data-action="upload">Elegir imagen</button><small>PNG, JPG o WebP · Hasta 2 MB</small></div><div class="library-subheading">Logo institucional</div>'+((state.doc.institution?.logo||P.profile().logo)?'<button type="button" class="mini-design" data-school-logo aria-label="Logo del colegio"><img src="'+esc(state.doc.institution?.logo||P.profile().logo)+'" alt="Logo del colegio">Logo del colegio</button>':'<p class="library-message">Sube el logo del colegio en Ajustes institucionales para utilizarlo aquí.</p>');}
    if(type==='data'){head.textContent='Datos y paginación';content.innerHTML=U.dataPanel(state.doc);}
    if(type==='layers'){head.textContent=state.doc.pagination?.enabled?'Orden de bloques':'Capas';content.innerHTML='<p class="library-hint">Selecciona un bloque. En modo paginado usa Subir / Bajar en propiedades para cambiar su orden.</p>'+(state.doc.pagination?.enabled?currentPage().blocks:[...currentPage().blocks].reverse()).map(n=>`<div class="layer-item ${state.selected.includes(n.id)?'selected':''}"><button class="layer-select" data-select="${n.id}">${icon(n.type==='text'?'text':n.type==='image'?'picture':'document')}<span>${esc(n.name)}</span></button><button class="icon-button" data-layer-lock="${n.id}" aria-label="${n.locked?'Desbloquear':'Bloquear'} ${esc(n.name)}">${icon(n.locked?'lock-2':'lock-3')}</button><button class="icon-button" data-layer-hide="${n.id}" aria-label="${n.hidden?'Mostrar':'Ocultar'} ${esc(n.name)}">${icon(n.hidden?'eye-slash':'eye')}</button></div>`).join('')+'<div class="layer-tools"><button class="button soft" data-action="bring-front">Traer delante</button><button class="button soft" data-action="send-back">Enviar detrás</button></div>';}
    if(type==='pages'){head.textContent='Páginas';const pages=state.generated||state.doc.pages;content.innerHTML=(state.generated?'<div class="auto-page-info">'+pages.length+' hojas de diseño. Vista previa completa las filas y genera las continuaciones.</div>':'')+pages.map((p,i)=>`<div class="page-list-item ${i===state.page?'active':''}"><button data-page="${i}">${icon('document')} Página ${i+1}</button></div>`).join('')+'<h3 class="page-source-title">Hojas de diseño</h3>'+state.doc.pages.map((p,i)=>`<div class="page-list-item"><span>Hoja ${i+1}</span><button class="icon-button" data-page-copy="${i}" aria-label="Duplicar hoja ${i+1}">${icon('copy')}</button><button class="icon-button danger" data-page-delete="${i}" aria-label="Eliminar hoja ${i+1}">${icon('trash')}</button></div>`).join('')+'<div class="page-actions"><button class="button soft" data-action="add-page">Añadir hoja</button><button class="button light" data-action="export">Exportar diseño</button></div>'; }
    if(type==='designs'){head.textContent='Plantillas';renderTemplateLibrary(content);}
  }
  const field=(label,key,value,type='number')=>`<label class="field"><span>${label}</span><input data-prop="${key}" type="${type}" value="${esc(value)}" ${type==='number'?'step="1"':''}></label>`;
  const toggle=(label,key,value)=>`<label class="toggle-label"><span>${label}</span><input type="checkbox" data-prop="${key}" ${value?'checked':''}><span class="switch"></span></label>`;
  function renderInspector(){if(E.inspector())return;const nodes=selectedNodes(),n=nodes[0],content=$('#inspector-content'),openDetails=[...content.querySelectorAll('details')].map(d=>d.open);$('#inspector-title').textContent=nodes.length>1?nodes.length+' elementos':n?n.name:'Tu diseño';
    if(!n){content.innerHTML='<div class="inspector-empty">'+icon('setting-2')+'<p>Selecciona un elemento del lienzo para editar su aspecto y posición.</p><button class="button soft" data-panel="blocks">'+icon('plus')+' Añadir elemento</button></div><hr><div class="inspector-note">'+icon('information-2')+'<span>Diseña la plantilla del colegio. Los datos de cada estudiante se completan al emitir su boletín.</span></div>';return;}
    content.innerHTML=`<div class="inspector-tabs"><button data-inspector-tab="style" class="${state.inspectorTab==='style'?'active':''}">Diseño</button><button data-inspector-tab="data" class="${state.inspectorTab==='data'?'active':''}">Datos</button>${n.type==='table'?`<button data-inspector-tab="table" class="table-tab ${state.inspectorTab==='table'?'active':''}">Tabla</button>`:''}</div>`;
    if(state.inspectorTab==='table'&&n.type==='table'){content.innerHTML+=U.tableInspector(n,state.doc);
    }else if(state.inspectorTab==='data'){
      const labels={header:'Información del colegio',title:'Período y año lectivo',student:'Matrícula del estudiante',grades:state.doc.scope==='final'?'Resultados anuales del SIEE':'Resultados de la asignatura',indicators:'Indicadores del grupo y período',observation:state.doc.scope==='final'?'Observación final (opcional)':'Observación del período',attendance:'Asistencia del estudiante',signature:'Firmas del colegio',promotion:'Promoción anual del SIEE',field:M.fields[n.field]};
      content.innerHTML+=`<span class="inspector-group-title">Contenido conectado</span><div class="data-chip">${esc(labels[n.type]||'Contenido libre')}</div><div class="inspector-note">${icon('information-2')}<span>Los datos se completan al emitir. Aquí personalizas su presentación.</span></div>`;
      if(n.type==='grades')content.innerHTML+=`<hr>${toggle('Mostrar nota / carita','showGrade',n.showGrade)}${toggle('Mostrar desempeño','showPerformance',n.showPerformance)}${state.doc.scope==='final'?toggle('Mostrar períodos','showPeriods',n.showPeriods):''}<label class="field"><span>Escala de la muestra</span><select id="sample-scale"><option value="numeric" ${state.doc.sampleScale==='numeric'?'selected':''}>Numérica</option><option value="visual" ${state.doc.sampleScale==='visual'?'selected':''}>Caritas</option></select></label>`;
      if(n.type==='field')content.innerHTML+=`<label class="field"><span>Campo</span><select data-prop="field">${Object.entries(M.fields).map(([k,v])=>`<option value="${k}" ${n.field===k?'selected':''}>${v}</option>`).join('')}</select></label>`;
    }else{
      content.innerHTML+=`<label class="field"><span>Nombre del elemento</span><input data-prop="name" value="${esc(n.name)}" maxlength="100"></label>`;
      if(['text','title','observation'].includes(n.type))content.innerHTML+=`<label class="field"><span>${n.type==='observation'?'Texto de muestra':'Texto'}</span><textarea data-prop="text" rows="3" placeholder="Escribe aquí…">${esc(F.humanize(n.text))}</textarea></label>`;
      content.innerHTML+=`<div class="font-preview" style="font-family:'${esc(n.font)}'">Aa · Tu colegio, tu estilo<small>${esc(n.font)}</small></div><div class="field-row"><label class="field"><span>Tipografía</span><select data-prop="font">${M.fontFamilies.map(f=>`<option ${n.font===f?'selected':''}>${f}</option>`).join('')}</select></label>${field('Tamaño','fontSize',n.fontSize)}</div><div class="control-row"><button class="icon-button ${n.bold?'active':''}" data-style="bold" aria-label="Negrita" aria-pressed="${n.bold}"><b>B</b></button><button class="icon-button ${n.italic?'active':''}" data-style="italic" aria-label="Cursiva" aria-pressed="${n.italic}"><i>I</i></button>${['left','center','right'].map(a=>`<button class="icon-button ${n.align===a?'active':''}" data-align="${a}" aria-label="Alinear ${a==='left'?'a la izquierda':a==='center'?'al centro':'a la derecha'}">${icon('text-align-'+a)}</button>`).join('')}</div><span class="inspector-group-title">${n.type==='grades'?'Color de encabezado':'Color de acento'}</span><div class="swatch-row">${palette.map(c=>`<button class="swatch ${n.accent.toLowerCase()===c.toLowerCase()?'active':''}" data-accent="${c}" style="background:${c}" aria-label="Acento ${c}"></button>`).join('')}<input type="color" data-prop="accent" value="${n.accent}" aria-label="Color personalizado"></div><div class="field-row"><label class="field"><span>Color del texto</span><input type="color" data-prop="color" value="${n.color}"></label><label class="field"><span>Fondo</span><input type="color" data-prop="fill" value="${n.fill==='transparent'?'#ffffff':n.fill}"></label></div><hr><span class="inspector-group-title">Posición y tamaño · px</span><div class="field-row">${field('X','x',Math.round(n.x))}${field('Y','y',Math.round(n.y))}</div><div class="field-row">${field('Ancho','w',Math.round(n.w))}${field('Alto','h',Math.round(n.h))}</div>${toggle('Bloquear elemento','locked',n.locked)}${toggle('Ocultar en el boletín','hidden',n.hidden)}<div class="control-row"><button class="button soft" data-action="duplicate">${icon('copy')} Duplicar</button><button class="button danger" data-action="delete">${icon('trash')} Eliminar</button></div>`;
    }
    if(state.inspectorTab==='style')content.innerHTML+=U.inlinePicker(n);
    content.innerHTML+=S.blockPanel(n,state.doc);content.innerHTML+=U.flowControls(n,state.doc);
    if(state.doc.pagination?.enabled&&state.doc.layout!=='canvas'){content.querySelector('[data-prop="y"]')?.closest('label')?.remove();if(!['image','rectangle','circle','line'].includes(n.type))content.querySelector('[data-prop="h"]')?.closest('label')?.remove();}
    content.innerHTML+='<button class="button violet properties-done" data-action="close-properties">Listo</button>';
    content.querySelectorAll('details').forEach((d,i)=>{if(openDetails[i])d.open=true;});
  }
  const handles=()=>['nw','n','ne','e','se','s','sw','w'].map(h=>`<button class="block-handle ${h}" data-resize="${h}" tabindex="-1" aria-label="Cambiar tamaño"></button>`).join('');
  function visibleNodes(){return (state.generated?.[state.page]||currentPage()).blocks;}
  function renderSelection(){
    $('#paper .selection-outline')?.remove();const multiple=state.selected.length>1;
    for(const el of $$('#paper [data-node]')){
      const node=allNodes().find(n=>n.id===el.dataset.node);if(!node)continue;
      const selected=state.selected.includes(node.id);el.classList.toggle('selected',selected);el.classList.toggle('multi-selected',selected&&multiple);
      el.querySelectorAll('.block-handle,.selection-tag').forEach(e=>e.remove());
      if(selected&&!multiple)el.insertAdjacentHTML('beforeend',`<div class="selection-tag">${esc(node.name)}${node.locked?' · Bloqueado':''}</div>${node.locked?'':handles()}`);
    }
    const box=multiple&&O.bounds(visibleNodes().filter(n=>state.selected.includes(n.id)));
    if(box)$('#paper').insertAdjacentHTML('beforeend',`<div class="selection-outline" data-selection-box data-studio-ui style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px"><span class="selection-tag">${O.canUngroup(selectedNodes())?'Grupo':'Selección múltiple'}</span>${selectedNodes().some(n=>n.locked)?'':handles()}</div>`);
  }
  function clearSelection(){
    finishTextEdit();E.clear();state.selected=[];state.inspectorOpen=false;
    renderPaper();renderInspector();renderHeader();renderPanels();X.clear();
  }
  function selectedBox(){
    if(E.selected())return E.box();return O.bounds(visibleNodes().filter(n=>state.selected.includes(n.id)));
  }
  function groupSelection(){commit(()=>O.group(selectedNodes(),M.uid()));}
  function ungroupSelection(){
    const nodes=selectedNodes();if(nodes.some(n=>n.locked))return;
    if(nodes.length>1){commit(()=>O.ungroup(nodes));return;}
    const node=nodes[0],element=$$('#paper [data-node]').find(el=>el.dataset.node===node?.id);if(!node||!element)return;
    finishTextEdit();const parts=O.split(node,state.doc,element,state.zoom);if(parts.length<2)return;
    if(currentPage().blocks.length+parts.length-1>100)return toast('La hoja admite hasta 100 elementos.','info');
    const mode=state.previewModes[node.id]||(state.fieldMode?'fields':'values');parts.forEach(part=>state.previewModes[part.id]=mode);
    commit(()=>{const page=currentPage(),index=page.blocks.indexOf(node);page.blocks.splice(index,1,...parts);state.selected=parts.map(part=>part.id);});
  }
  function selectionFormat(key,value){if(pageLocked())return;
    if(!['font','fontSize','color','bold','italic','underline','strike','align'].includes(key))return;
    if(key==='font'&&!M.fontFamilies.includes(value)||key==='color'&&!M.color(value)||key==='align'&&!['left','center','right'].includes(value))return;
    const part=E.selected();if(key==='fontSize'){if(!Number.isFinite(value))return;value=M.clamp(value,8,part?36:90);}
    commit(()=>{const items=part?[state.doc.sheet[part]]:selectedNodes();items.filter(item=>!item.locked).forEach(item=>{item[key]=value;if(!part)fitText(item,key);});if(part)state.doc.sheet=M.normalizeSheet(state.doc.sheet,!!state.doc.pagination?.enabled);});
  }
  function selectionArrange(command){
    const box=selectedBox();if(!box)return;const size=M.pageSize(activeDoc()),next={...box};
    if(typeof command==='object'){if(!Number.isFinite(command.value))return;next[command.key]=command.value;}
    else if(command==='left')next.x=0;else if(command==='right')next.x=size.w-box.w;else if(command==='center')next.x=(size.w-box.w)/2;
    else if(command==='top')next.y=0;else if(command==='bottom')next.y=size.h-box.h;else if(command==='middle')next.y=(size.h-box.h)/2;
    const part=E.selected();commit(()=>{
      if(part){E.place(state.doc,part,next);return;}
      next.w=Math.max(24,next.w);next.h=Math.max(12,next.h);
      for(const changed of O.transform(selectedNodes().filter(n=>!n.locked),box,next,size)){const node=allNodes().find(n=>n.id===changed.id);Object.assign(node,changed);M.constrain(node,size);}
    });
  }
  function selectionAction(command){
    if(command==='properties'||command==='content'){
      if(command==='content'&&E.selected()){E.edit();return;}
      if(command==='content'&&editBlock(firstSelected()))return;
      state.inspectorTab=command==='content'&&firstSelected()?.type==='table'?'table':'style';state.inspectorOpen=command==='properties'?!state.inspectorOpen:true;renderInspector();renderPanels();X.refresh();return;
    }
    const part=E.selected();if(part){const item=state.doc.sheet[part];if(command==='lock')commit(()=>item.locked=!item.locked);else if(command==='delete'&&!item.locked)commit(()=>{item.enabled=false;E.clear();});return;}
    actions[command]?.();
  }
  function selectNode(id,append=false){
    const wasEditing=!!state.inline;finishTextEdit();E.clear();
    if(!state.selected.includes(id))state.inspectorTab=allNodes().find(n=>n.id===id)?.type==='table'?'table':'style';
    state.selected=O.select(currentPage().blocks,state.selected,id,append);
    if(wasEditing)renderPaper();else renderSelection();renderInspector();renderHeader();if(state.panel==='layers')renderLibrary();renderPanels();
  }
  function addBlock(type,point,extra={}){if(pageLocked())return toast('Desbloquea la página para editarla.','info');if(!M.titles[type])return;E.clear();if(type==='pagebreak'){actions['add-page']();return;}const size=M.pageSize(activeDoc());const n=M.constrain(M.block(type,point?.x??54,point?.y??Math.min(170+currentPage().blocks.length*21,size.h-180),{accent:state.doc.accent,...extra}),size);if(type==='observation')n.text='{{observation}}';if(['table','grades'].includes(type)){n.w=Math.min(500,size.w-100);n.h=90;n.table=M.normalizeTable({...n.table,headerFill:state.doc.accent,borderColor:state.doc.accent,headerColor:state.doc.design?.headerInk||'#FFFFFF'});}C.fitText(n,activeDoc());M.constrain(n,size);commit(()=>{currentPage().blocks.push(n);state.selected=[n.id];if(['table','pagebreak'].includes(type)){state.doc.schema=2;state.doc.pagination={margin:44,gap:14,repeatHeader:true,...state.doc.pagination,enabled:true};}});if(state.generated){state.page=Math.max(0,state.generated.findIndex(p=>p.blocks.some(b=>b.id===n.id)));renderPaper();renderPages();}state.libraryOpen=false;state.inspectorOpen=false;renderPanels();if(state.autoFit)requestAnimationFrame(fitPage);toast(M.titles[type]+' añadido.');}
  function duplicate(){const nodes=selectedNodes();if(!nodes.length){toast('Selecciona un elemento para duplicarlo.','info');return;}commit(()=>{state.selected=[];const groups=new Map();for(const source of nodes){const n=M.clone(source);n.id=M.uid();if(state.previewModes[source.id])state.previewModes[n.id]=state.previewModes[source.id];if(n.groupKey){if(!groups.has(n.groupKey))groups.set(n.groupKey,M.uid());n.groupKey=groups.get(n.groupKey);}n.locked=false;n.x+=18;n.y+=18;M.constrain(n,M.pageSize(activeDoc()));currentPage().blocks.push(n);state.selected.push(n.id);}});}
  function removeSelected(){const nodes=selectedNodes().filter(n=>!n.locked);if(!nodes.length){toast('Selecciona un elemento desbloqueado.','info');return;}const ids=nodes.map(n=>n.id);commit(()=>{currentPage().blocks=currentPage().blocks.filter(n=>!ids.includes(n.id));state.selected=[];});}
  function undo(redo=false){finishTextEdit();const source=redo?state.redo:state.undo,target=redo?state.undo:state.redo;if(!source.length)return;target.push(snapshot());state.doc=JSON.parse(source.pop());state.selected=[];state.autoFit=true;renderEditor();requestAnimationFrame(fitPage);}
  const textProperties=new Set(['text','content','font','fontSize','bold','italic','captionBold','align','lineHeight','letterSpacing','padding','w']);
  function fitText(node,key){if(textProperties.has(key))C.fitText(node,state.doc);}
  function writeInline(item){
    const value=F.internalize(item.element.innerText).slice(0,item.contentKey?2500:10000);
    if(item.contentKey)item.node.content={...item.node.content,[item.contentKey]:value};else item.node.text=value;
    C.fitText(item.node,state.doc);
    const block=item.element.closest('[data-node]');if(block)block.style.height=item.node.h+'px';
    X.schedule();
  }
  function editBlock(node,target){
    if(!node||node.locked||pageLocked())return false;
    const block=$$('#paper [data-node]').find(el=>el.dataset.node===node.id);
    const slot=target?.closest('[data-edit-content],[data-edit-text]')||block?.querySelector('[data-edit-text],[data-edit-content]');
    if(!slot||!block?.contains(slot))return false;
    finishTextEdit();const contentKey=slot.dataset.editContent||'',before=snapshot();
    const value=contentKey?({...M.defaultContent(node,state.doc),...node.content})[contentKey]:node.text;
    slot.textContent=F.humanize(value??'');
    state.inline={node,element:slot,contentKey,before};slot.contentEditable='true';slot.classList.add('inline-edit');slot.focus();
    const range=document.createRange();range.selectNodeContents(slot);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    slot.addEventListener('blur',()=>{if(state.inline?.element===slot){finishTextEdit();renderEditor();}},{once:true});return true;
  }
  function finishTextEdit(){E.finish();if(state.inline){const item=state.inline;state.inline=null;writeInline(item);item.element.contentEditable='false';item.element.classList.remove('inline-edit');pushHistory(item.before);renderHeader();}if(state.editing){const before=state.editing;state.editing=null;pushHistory(before);renderHeader();}}
  function previewTemplate(index){const preset=presets[index];if(!preset)return;state.previewTemplate=C.prepare(createDesign(preset.kind,preset.scope));$('#preview-title').textContent='Vista previa de la plantilla';$('#preview-student').value='one';$('#preview-scale').value=state.previewTemplate.sampleScale;$('#preview-dialog').showModal();renderPreview();}
  function showPreview(){state.previewTemplate=null;$('#preview-title').textContent='Vista previa del boletín';finishTextEdit();$('#preview-student').value=state.doc.sample?.student||'one';$('#preview-scale').value=state.doc.sampleScale;$('#preview-dialog').showModal();renderPreview();}
  function previewDocument(){const doc=M.clone(state.previewTemplate||state.doc);doc.sample={...(doc.sample||{}),student:$('#preview-student').value};return doc;}
  function previewLayout(){const doc=previewDocument(),scale=$('#preview-scale').value;return {doc,scale,pages:doc.layout==='canvas'?C.emit(doc,scale,'values').pages:doc.pagination?.enabled?R.paginate(doc,scale,'values').pages:doc.pages};}
  function renderPreview(){try{
    const {doc,scale,pages}=previewLayout(),width=Math.min($('#preview-dialog').clientWidth-45,860);
    $('#preview-page-total').textContent=pages.length+' página'+(pages.length===1?'':'s')+' · '+R.context(doc,scale).year;
    $('#preview-pages').innerHTML=pages.map((p,i)=>{const size=M.pageSize(M.pageView(doc,p)),zoom=Math.min(width/size.w,.9);return `<div class="preview-page-wrap" style="width:${size.w*zoom}px;height:${size.h*zoom}px"><div class="paper has-flow" data-preview-page="${i+1}" style="width:${size.w}px;height:${size.h}px;transform:scale(${zoom})">${pageHTML(p,doc,i,false,scale,pages.length)}</div></div>`;}).join('');
  }catch(error){$('#preview-pages').innerHTML='<div class="pagination-error">'+esc(error.message)+'</div>';$('#preview-page-total').textContent='Revisa el diseño';}}
  async function printDocument(){try{
    await document.fonts.ready;const {doc,scale,pages}=previewLayout();let rules='@page{margin:0}';
    $('#print-root').innerHTML=pages.map((p,i)=>{const size=M.pageSize(M.pageView(doc,p));rules+=`@page report${i}{size:${size.w}px ${size.h}px;margin:0}`;return `<div class="print-page" style="page:report${i};width:${size.w}px;height:${size.h}px">${pageHTML(p,doc,i,false,scale,pages.length)}</div>`;}).join('');
    let style=$('#dynamic-print-style');if(!style){style=document.createElement('style');style.id='dynamic-print-style';document.head.append(style);}style.textContent=rules;await document.fonts.ready;window.print();
  }catch(error){toast(error.message,'info');}}
  function exportDesign(){const blob=new Blob([JSON.stringify(state.doc,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=state.doc.name.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Diseño exportado. Puedes importarlo de nuevo.');}
  function publish(){dialog('Publicar plantilla','<p>Esta revisión quedará disponible para emitir nuevos boletines. Los documentos ya emitidos conservan su diseño.</p>',[cancelAction(),{label:'Publicar revisión',style:'green',loadingLabel:'Publicando revisión…',run:async()=>await saveDocument(true)}]);}
  function rename(){dialog('Nombre de la plantilla','<label>¿Cómo quieres llamar a este diseño?<input id="rename-input" maxlength="100" value="'+esc(state.doc.name)+'"></label>',[cancelAction(),{label:'Cambiar nombre',style:'violet',run:()=>{const name=$('#rename-input').value.trim();if(!name)return false;commit(()=>state.doc.name=name);}}]);}
  async function versions(){try{const rows=await window.SchoolBulletinEditor.versions(state.doc.id);const current=state.saved.get(state.doc.id);if(current)current.revisions=rows;dialog('Historial de versiones',rows.length?rows.map((r,i)=>`<div class="version-row"><div><strong>Revisión ${r.revision}</strong><small>${new Date(r.at).toLocaleString()}</small></div><button type="button" class="button soft" data-restore-version="${i}">Usar como borrador</button></div>`).join(''):'<p>Aún no hay revisiones publicadas.</p>',[{label:'Cerrar'}]);}catch(error){toast(error.message,'info');}}
  function help(){dialog('Ayuda del editor','<p>Explora un diseño, arrastra los bloques de la biblioteca y personalízalos en el panel de propiedades. En móvil también puedes tocar para insertar.</p><ul class="key-list"><li>Mover un elemento<span>Arrastrar</span></li><li>Editar texto libre<span>Doble clic</span></li><li>Seleccionar varios<span><kbd>Mayús + clic</kbd></span></li><li>Ajustar posición<span><kbd>Flechas</kbd> / <kbd>Mayús</kbd></span></li><li>Deshacer / rehacer<span><kbd>Ctrl Z</kbd> / <kbd>Ctrl Mayús Z</kbd></span></li><li>Duplicar<span><kbd>Ctrl D</kbd></span></li><li>Guardar diseño<span><kbd>Ctrl S</kbd></span></li></ul><div class="notice">Guardar conserva el diseño en tu colegio; Publicar crea una revisión para futuras emisiones. Los ejemplos de diseño no modifican notas ni estudiantes.</div>',[{label:'Empezar a probar',style:'violet'}]);}
  function switchPanel(panel){finishTextEdit();if(tablet()){state.libraryOpen=!(state.libraryOpen&&state.panel===panel);state.inspectorOpen=false;}else state.libraryOpen=!(state.libraryOpen&&state.panel===panel);state.panel=panel;renderLibrary();renderPanels();}
  function ensureSample(){state.doc.sample={profile:state.doc.sampleScale==='visual'?'preschool':'primary',student:'one',year:'2026',periods:4,count:14,length:'normal',period:3,...state.doc.sample};return state.doc.sample;}
  function ensureTable(n){n.table=R.tableConfig(n,state.doc);return n.table;}
  function advancedClick(target){if(!state.doc)return;const action=target.dataset.adv,n=firstSelected();if(action==='toggle-selected-fields'||action==='toggle-fields'&&selectedNodes().length){finishTextEdit();const nodes=selectedNodes(),values=nodes.some(node=>(state.previewModes[node.id]||(state.fieldMode?'fields':'values'))==='fields');nodes.forEach(node=>state.previewModes[node.id]=values?'values':'fields');renderEditor();return;}if(action==='toggle-fields'){finishTextEdit();state.fieldMode=!state.fieldMode;state.previewModes={};renderEditor();return;}if(!n)return;if(n.locked)return toast('Desbloquea el elemento para modificarlo.','info');
    if(action==='insert-field'){const input=$('#inspector-content [data-prop="text"]'),key=$('#inline-field-key').value;if(!M.fields[key])return;const value=input?.value??F.humanize(n.text),start=input?.selectionStart??value.length,end=input?.selectionEnd??start;commit(()=>n.text=F.internalize(F.insert(value,start,end,key)));const replacement=$('#inspector-content [data-prop="text"]');replacement?.focus();replacement?.setSelectionRange(start+M.fields[key].length+2,start+M.fields[key].length+2);return;}
    if(action.startsWith('block-')){commit(()=>{const page=state.doc.pages.find(p=>p.blocks.includes(n)),i=page.blocks.indexOf(n),next=i+(action==='block-up'?-1:1);if(next>=0&&next<page.blocks.length)[page.blocks[i],page.blocks[next]]=[page.blocks[next],page.blocks[i]];});return;}
    const t=ensureTable(n),index=Number(target.dataset.index);if(action==='column-add'){const key=$('#column-key').value;if(!M.columnTypes[key]||t.columns.some(c=>c.key===key))return;commit(()=>t.columns.push({key,label:M.columnTypes[key],width:key==='subject'?40:20}));}
    if(action==='column-remove'&&t.columns.length>1)commit(()=>t.columns.splice(index,1));
    if(action==='column-up'||action==='column-down'){const next=index+(action==='column-up'?-1:1);if(next>=0&&next<t.columns.length)commit(()=>[t.columns[index],t.columns[next]]=[t.columns[next],t.columns[index]]);}
    if(action==='subjects-all')commit(()=>{t.filterSubjects=false;t.subjectKeys=[];});
  }
  function applyAdvanced(input){const n=firstSelected(),d=input.dataset;if(S.matches(input)){S.apply(input,state.doc,n);if(n&&d.content)fitText(n,'content');return;}if(d.sample){const s=ensureSample(),key=d.sample;let value=input.value;if(['periods','count','period'].includes(key))value=M.clamp(Number(value)||1,1,key==='count'?60:6);if(key==='year'){if(!/^\d{4}$/.test(value))return;s.year=value;}else s[key]=value;s.period=Math.min(Number(s.period)||1,Number(s.periods)||4);if(key==='profile'){s.grade=value==='preschool'?'Párvulos':'Primero';s.count=value==='preschool'?8:14;}state.doc.schema=2;return;}
    if(d.pagination){state.doc.schema=2;state.doc.pagination={enabled:true,margin:44,gap:14,repeatHeader:true,...state.doc.pagination};const key=d.pagination;state.doc.pagination[key]=input.type==='checkbox'?input.checked:M.clamp(Number(input.value)||14,key==='margin'?24:4,key==='margin'?90:40);return;}
    if(!n||n.locked)return;const t=ensureTable(n);if(d.table)t[d.table]=input.type==='checkbox'?input.checked:input.value;if(d.tableLabel!==undefined)t.columns[Number(d.tableLabel)].label=input.value.slice(0,60);if(d.tableWidth!==undefined)t.columns[Number(d.tableWidth)].width=M.clamp(Number(input.value)||5,5,90);
    if(d.subject){const all=R.context(state.doc).rows.map(r=>r.key);if(!t.filterSubjects){t.subjectKeys=[...all];t.filterSubjects=true;}t.subjectKeys=input.checked?[...new Set([...t.subjectKeys,d.subject])]:t.subjectKeys.filter(k=>k!==d.subject);if(t.subjectKeys.length===all.length){t.filterSubjects=false;t.subjectKeys=[];}}
  }
  function isAdvanced(input){return S.matches(input)||input.matches('[data-sample],[data-pagination],[data-table],[data-table-label],[data-table-width],[data-subject]');}
  function advancedLive(input){if(!state.doc||!isAdvanced(input)||!['INPUT','TEXTAREA'].includes(input.tagName)||input.type==='checkbox')return false;if(input.value==='')return true;if(!state.editing)state.editing=snapshot();applyAdvanced(input);renderPaper();renderHeader();return true;}
  function advancedChange(input){if(!isAdvanced(input))return false;commit(()=>applyAdvanced(input));if(input.dataset.sheetDoc){state.autoFit=true;requestAnimationFrame(fitPage);}return true;}

  const actions={group:groupSelection,ungroup:ungroupSelection,help,gallery:()=>askLeave(showGallery),new:()=>askLeave(()=>openDocument(M.documentDesign('blank'))),save:()=>saveDocument(),publish,rename,undo:()=>undo(),redo:()=>undo(true),duplicate,delete:removeSelected,preview:showPreview,'close-preview':()=>$('#preview-dialog').close(),'close-dialog':()=>$('#app-dialog').close(),export:exportDesign,import:()=>$('#design-input').click(),upload:()=>$('#image-input').click(),versions,
    'more':()=>{const hidden=!$('#more-menu').hidden;$('#more-menu').hidden=hidden;$$('[data-action="more"]').forEach(n=>n.setAttribute('aria-expanded',String(!hidden)));},
    'close-library':()=>{state.libraryOpen=false;renderPanels();if(state.autoFit)requestAnimationFrame(fitPage);},'open-properties':()=>{state.inspectorOpen=true;state.libraryOpen=false;renderInspector();$('#inspector').scrollTop=0;renderPanels();},'close-properties':()=>{state.inspectorOpen=false;renderPanels();if(state.autoFit)requestAnimationFrame(fitPage);},'close-panels':()=>{state.libraryOpen=false;state.inspectorOpen=false;renderPanels();},
    'lock':()=>{if(!selectedNodes().length)return toast('Selecciona primero un elemento.','info');commit(()=>{const lock=selectedNodes().some(n=>!n.locked);selectedNodes().forEach(n=>n.locked=lock);});},
    'align-center':()=>{if(!selectedNodes().length)return;commit(()=>selectedNodes().filter(n=>!n.locked).forEach(n=>n.x=(M.pageSize(activeDoc()).w-n.w)/2));},
    'bring-front':()=>{commit(()=>{const selected=selectedNodes();currentPage().blocks=[...currentPage().blocks.filter(n=>!state.selected.includes(n.id)),...selected];});},
    'send-back':()=>{commit(()=>{const selected=selectedNodes();currentPage().blocks=[...selected,...currentPage().blocks.filter(n=>!state.selected.includes(n.id))];});},
    'add-page':()=>pageAction(state.doc.pages.indexOf(currentPage()),'add'),
    'fit':()=>{state.autoFit=true;fitPage();},'zoom-in':()=>{state.autoFit=false;state.zoom=M.clamp(state.zoom+.1,.2,1.8);applyZoom();},'zoom-out':()=>{state.autoFit=false;state.zoom=M.clamp(state.zoom-.1,.2,1.8);applyZoom();},
    'print':printDocument
  };
  document.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;if(target.dataset.removeTemplate){event.preventDefault();removeTemplate(target.dataset.removeTemplate);return;}if(E.click(target))return;
    if(target.dataset.adv){advancedClick(target);return;}
    if(target.dataset.action){event.preventDefault();if(target.dataset.action!=='more')$('#more-menu').hidden=true;actions[target.dataset.action]?.();return;}
    if(target.dataset.device){state.device=target.dataset.device;$('#app').dataset.device=state.device;$$('[data-device]').filter(n=>n.tagName==='BUTTON').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.device===state.device)));state.libraryOpen=false;state.inspectorOpen=false;state.autoFit=true;if(state.doc){renderEditor();requestAnimationFrame(fitPage);}return;}
    if(target.dataset.preset!==undefined){chooseTemplate(Number(target.dataset.preset));return;}
    if(target.dataset.open){openDocument(state.saved.get(target.dataset.open).doc,true);return;}
    if(target.dataset.filter){P.resetPage();state.filter=target.dataset.filter;$$('[data-filter]').forEach(b=>b.classList.toggle('active',b===target));renderGallery();return;}
    if(!state.doc)return;
    if(target.dataset.panel){switchPanel(target.dataset.panel);return;}
    if(target.hasAttribute('data-school-logo')){addBlock('image',null,{source:'school-logo',name:'Logo del colegio'});return;}
    if(target.dataset.add){addBlock(target.dataset.add,null,target.dataset.size?{fontSize:Number(target.dataset.size),bold:Number(target.dataset.size)>25}:{});return;}
    if(target.dataset.field){addBlock('field',null,{field:target.dataset.field,name:M.fields[target.dataset.field]});return;}
    if(target.dataset.scope&&target.dataset.scope!==state.doc.scope){commit(()=>{state.doc.scope=target.dataset.scope;state.doc.name=state.doc.name.replace(/Boletín (de período|final)/,state.doc.scope==='final'?'Boletín final':'Boletín de período');});return;}
    if(target.dataset.previewTemplate!==undefined){previewTemplate(Number(target.dataset.previewTemplate));return;}
    if(target.dataset.pageOp){pageAction(Number(target.dataset.sourcePage),target.dataset.pageOp);return;}
    if(target.dataset.page!==undefined){activatePage(Number(target.dataset.page),true);return;}
    if(target.dataset.pageCopy!==undefined){pageAction(Number(target.dataset.pageCopy),'copy');return;}
    if(target.dataset.pageDelete!==undefined){pageAction(Number(target.dataset.pageDelete),'delete');return;}
    if(target.dataset.select){selectNode(target.dataset.select,event.shiftKey);return;}
    if(target.dataset.layerHide){commit(()=>{const n=currentPage().blocks.find(n=>n.id===target.dataset.layerHide);n.hidden=!n.hidden;});return;}
    if(target.dataset.layerLock){commit(()=>{const n=currentPage().blocks.find(n=>n.id===target.dataset.layerLock);n.locked=!n.locked;});return;}
    if(target.dataset.inspectorTab){state.inspectorTab=target.dataset.inspectorTab;renderInspector();return;}
    if(target.dataset.style){commit(()=>selectedNodes().filter(n=>!n.locked).forEach(n=>{n[target.dataset.style]=!n[target.dataset.style];fitText(n,target.dataset.style);}));return;}
    if(target.dataset.align){commit(()=>selectedNodes().filter(n=>!n.locked).forEach(n=>n.align=target.dataset.align));return;}
    if(target.dataset.accent){commit(()=>selectedNodes().filter(n=>!n.locked).forEach(n=>{n.accent=target.dataset.accent;if(['rectangle','circle','line'].includes(n.type))n.fill=target.dataset.accent;}));return;}
    if(target.dataset.restoreVersion!==undefined){const revision=state.saved.get(state.doc.id)?.revisions[Number(target.dataset.restoreVersion)];if(revision){const id=state.doc.id;commit(()=>{state.doc=M.clone(revision.design);state.doc.id=id;state.page=0;state.selected=[];});$('#app-dialog').close();toast('Revisión recuperada como borrador.');}}
  });
  $('#gallery-search').addEventListener('input',()=>{P.resetPage();renderGallery();});
  document.addEventListener('input',event=>{const input=event.target;if(pageLocked()&&input.matches('[data-prop],[data-format],[data-position]'))return;if(E.input(input))return;if(advancedLive(input))return;if(state.inline&&input.closest('[contenteditable=true]')){writeInline(state.inline);renderHeader();return;}if(input.dataset.prop&&input.tagName==='INPUT'&&input.type!=='checkbox'||input.dataset.prop==='text'){const key=input.dataset.prop;let value=input.value;if(['x','y','w','h','fontSize','lineHeight','letterSpacing'].includes(key)){if(value==='')return;value=Number(value);if(!Number.isFinite(value))return;if(key==='fontSize')value=M.clamp(value,8,90);}else value=value.slice(0,10000);if(!state.editing)state.editing=snapshot();selectedNodes().filter(n=>!n.locked).forEach(n=>{n[key]=key==='text'?F.internalize(value):value;fitText(n,key);M.constrain(n,M.pageSize(activeDoc()));});renderPaper();renderHeader();}if(input.id==='zoom-range'){state.autoFit=false;state.zoom=Number(input.value)/100;applyZoom();}});
  document.addEventListener('change',event=>{const input=event.target;if(!state.doc)return;if(input.dataset.pageTitle!==undefined){pageAction(Number(input.dataset.pageTitle),'rename',input.value);return;}if(pageLocked()&&input.matches('[data-prop],[data-format],[data-position]'))return;if(E.change(input))return;if(advancedChange(input))return;if(input.id==='preview-student'){renderPreview();return;}if(input.dataset.prop){if(input.dataset.prop==='text'){finishTextEdit();input.value=F.humanize(firstSelected()?.text||input.value);renderHeader();return;}commit(()=>selectedNodes().forEach(n=>{const key=input.dataset.prop;if(n.locked&&key!=='locked'&&key!=='hidden')return;let value=input.type==='checkbox'?input.checked:input.value;if(['x','y','w','h','fontSize','padding','radius','lineHeight','letterSpacing'].includes(key)){value=Number(value);if(!Number.isFinite(value))return;if(key==='fontSize')value=M.clamp(value,8,90);}n[key]=value;fitText(n,key);M.constrain(n,M.pageSize(activeDoc()));}));}else if(input.id==='sample-scale'){commit(()=>state.doc.sampleScale=input.value);}else if(input.id==='school-name'){commit(()=>{state.doc.school=input.value.slice(0,100);if(state.doc.institution)state.doc.institution.name=state.doc.school;});}else if(['paper-format','paper-orientation'].includes(input.id)){commit(()=>{M.resizePage(state.doc,state.doc.pages.indexOf(currentPage()),input.id==='paper-format'?input.value:activeDoc().format,input.id==='paper-orientation'?input.value:activeDoc().orientation);});state.autoFit=true;requestAnimationFrame(fitPage);}else if(input.id==='preview-scale')renderPreview();else if(input.id==='final-enabled'){state.finalEnabled=input.checked;if(!state.finalEnabled&&state.doc.scope==='final')commit(()=>state.doc.scope='periodo');renderHeader();}});
  let paper=$('#paper');
  function point(event){const rect=paper.getBoundingClientRect();return {x:(event.clientX-rect.left)/state.zoom,y:(event.clientY-rect.top)/state.zoom};}
  $('#canvas-scroll').addEventListener('pointerdown',event=>{
    const sheet=event.target.closest('[data-page-view]');if(!sheet)return;const pageIndex=Number(sheet.dataset.pageView);if(pageIndex!==state.page)activatePage(pageIndex);
    if(pageLocked()||event.button!==0||event.target.closest('[contenteditable=true]'))return;
    if(E.pointerDown(event))return;
    const furniture=event.target.closest('[data-sheet-target]');if(furniture){clearSelection();return;}
    event.preventDefault();
    const element=event.target.closest('[data-node]'),handle=event.target.closest('[data-resize]')?.dataset.resize;
    if(!element&&!event.target.closest('[data-selection-box]')){
      finishTextEdit();E.clear();const previous=event.shiftKey?[...state.selected]:[];state.selected=previous;
      state.marquee={start:point(event),previous,moved:false};paper.setPointerCapture(event.pointerId);renderSelection();renderHeader();return;
    }
    const id=element?.dataset.node||state.selected[0];
    if(event.shiftKey){selectNode(id,true);return;}
    if(!state.selected.includes(id))selectNode(id);
    const nodes=selectedNodes();if(!nodes.length||nodes.some(n=>n.locked))return;
    state.drag={id,handle,startX:event.clientX,startY:event.clientY,nodes:M.clone(nodes),box:O.bounds(nodes),before:snapshot(),moved:false};paper.setPointerCapture(event.pointerId);
  });
  $('#canvas-area').addEventListener('pointerdown',event=>{
    if(event.button!==0||event.composedPath().some(node=>node instanceof Element&&(node.id==='paper'||node.id==='selection-tools'||node.matches('button,input,select,textarea'))))return;
    if(state.doc)clearSelection();
  });
  $('#canvas-scroll').addEventListener('pointermove',event=>{
    if(state.marquee){const drag=state.marquee,now=point(event),rect={x:Math.min(drag.start.x,now.x),y:Math.min(drag.start.y,now.y),w:Math.abs(now.x-drag.start.x),h:Math.abs(now.y-drag.start.y)};
      if(rect.w+rect.h<3&&!drag.moved)return;drag.moved=true;state.selected=[...new Set([...drag.previous,...O.inRect(visibleNodes(),rect)])];renderSelection();$('#paper .selection-marquee')?.remove();paper.insertAdjacentHTML('beforeend',`<div class="selection-marquee" style="left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px"></div>`);renderHeader();return;}
    const drag=state.drag;if(!drag)return;const dx=(event.clientX-drag.startX)/state.zoom,dy=(event.clientY-drag.startY)/state.zoom;if(Math.abs(dx)+Math.abs(dy)<2&&!drag.moved)return;
    if(!drag.moved&&state.doc.layout==='canvas'){
      // Start a manual move from the rendered layout, so expanded samples do not jump.
      const page=currentPage(),shown=visibleNodes();
      for(const node of page.blocks){const visible=shown.find(n=>n.id===node.id);if(visible)Object.assign(node,{x:visible.x,y:visible.y,w:visible.w,h:visible.h});}
      drag.nodes=M.clone(selectedNodes());drag.box=O.bounds(drag.nodes);
    }
    drag.moved=true;if(!paper.hasPointerCapture(event.pointerId))paper.setPointerCapture(event.pointerId);
    const size=M.pageSize(activeDoc()),box={...drag.box};let guideX=null,guideY=null;
    if(drag.handle){if(drag.handle.includes('e'))box.w+=dx;if(drag.handle.includes('s'))box.h+=dy;if(drag.handle.includes('w')){box.x+=dx;box.w-=dx;}if(drag.handle.includes('n')){box.y+=dy;box.h-=dy;}box.w=Math.max(35,box.w);box.h=Math.max(12,box.h);}
    else{box.x+=dx;box.y+=dy;if($('#snap-toggle').checked){box.x=Math.round(box.x/4)*4;box.y=Math.round(box.y/4)*4;if(Math.abs(box.x+box.w/2-size.w/2)<8){box.x=(size.w-box.w)/2;guideX=size.w/2;}if(Math.abs(box.y+box.h/2-size.h/2)<8){box.y=(size.h-box.h)/2;guideY=size.h/2;}}box.x=M.clamp(box.x,0,Math.max(0,size.w-box.w));box.y=M.clamp(box.y,0,Math.max(0,size.h-box.h));}
    for(const changed of O.transform(drag.nodes,drag.box,box,size)){const node=currentPage().blocks.find(n=>n.id===changed.id);if(node){Object.assign(node,changed);M.constrain(node,size);}}
    renderPaper();if(guideX!==null)paper.insertAdjacentHTML('beforeend',`<div class="guide vertical" style="left:${guideX}px"></div>`);if(guideY!==null)paper.insertAdjacentHTML('beforeend',`<div class="guide horizontal" style="top:${guideY}px"></div>`);renderHeader();
  });
  const endDrag=()=>{
    if(state.marquee){state.marquee=null;$('#paper .selection-marquee')?.remove();renderSelection();renderInspector();renderHeader();return;}
    if(!state.drag)return;const drag=state.drag;state.drag=null;if(drag.moved){pushHistory(drag.before);renderPaper();renderInspector();renderHeader();}
  };$('#canvas-scroll').addEventListener('pointerup',endDrag);$('#canvas-scroll').addEventListener('pointercancel',endDrag);
  $('#canvas-scroll').addEventListener('dblclick',event=>{
    const block=event.target.closest('[data-node]'),node=block&&allNodes().find(n=>n.id===block.dataset.node);
    if(!node||node.locked||pageLocked())return;
    if(!editBlock(node,event.target)){state.inspectorOpen=true;renderInspector();renderPanels();X.refresh();}
  });
  document.addEventListener('dragstart',event=>{const tile=event.target.closest('[data-add],[data-field]');if(!tile)return;event.dataTransfer.setData('text/plain',JSON.stringify({type:tile.dataset.add||'field',field:tile.dataset.field}));event.dataTransfer.effectAllowed='copy';});
  $('#canvas-scroll').addEventListener('dragover',event=>{event.preventDefault();paper.classList.add('dragover');});paper.addEventListener('dragleave',()=>paper.classList.remove('dragover'));
  $('#canvas-scroll').addEventListener('drop',event=>{event.preventDefault();paper.classList.remove('dragover');try{const data=JSON.parse(event.dataTransfer.getData('text/plain'));if(!M.titles[data.type])return;const rect=paper.getBoundingClientRect();addBlock(data.type,{x:(event.clientX-rect.left)/state.zoom,y:(event.clientY-rect.top)/state.zoom},data.field?{field:data.field,name:M.fields[data.field]}:{});}catch{toast('Usa un elemento de la biblioteca.','info');}});
  document.addEventListener('keydown',event=>{if(!state.doc||$('#editor-view').hidden||$('#app-dialog').open||$('#preview-dialog').open)return;if(event.target.closest('input,textarea,select,[contenteditable=true]'))return;const mod=event.ctrlKey||event.metaKey;if(mod&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey);return;}if(mod&&event.key.toLowerCase()==='s'){event.preventDefault();saveDocument();return;}if(mod&&event.key.toLowerCase()==='d'){event.preventDefault();duplicate();return;}if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeSelected();return;}if(event.key==='Escape'){state.drag=null;state.marquee=null;E.clear();state.selected=[];state.inspectorOpen=false;state.libraryOpen=false;renderEditor();return;}const vectors={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(vectors[event.key]&&state.selected.length){event.preventDefault();if(state.doc.pagination?.enabled&&state.doc.layout!=='canvas'&&['ArrowUp','ArrowDown'].includes(event.key)){advancedClick({dataset:{adv:event.key==='ArrowUp'?'block-up':'block-down'}});return;}const [x,y]=vectors[event.key],step=event.shiftKey?10:1;const nodes=selectedNodes();if(nodes.some(n=>n.locked))return;const size=M.pageSize(activeDoc()),box=O.bounds(nodes);commit(()=>O.transform(nodes,box,{...box,x:M.clamp(box.x+x*step,0,Math.max(0,size.w-box.w)),y:M.clamp(box.y+y*step,0,Math.max(0,size.h-box.h))},size).forEach(n=>Object.assign(allNodes().find(old=>old.id===n.id),n)));}});
  $('#image-input').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){toast('Elige una imagen PNG, JPG o WebP de hasta 2 MB.','info');return;}const existing=Object.values(state.doc.assets).reduce((sum,data)=>sum+data.length,0);if(existing>6000000){toast('El diseño ya tiene varias imágenes. Usa una versión más ligera.','info');return;}const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const dimensions=await new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({w:image.width,h:image.height});image.onerror=()=>resolve({w:150,h:150});image.src=data;});const id=M.uid();commit(()=>{state.doc.assets[id]=data;const n=M.block('image',54,100,{asset:id,name:file.name.slice(0,80),w:180,h:M.clamp(180*dimensions.h/dimensions.w,40,400)});currentPage().blocks.push(n);state.selected=[n.id];});state.libraryOpen=false;state.inspectorOpen=false;renderPanels();toast('Imagen añadida al diseño.');});
  $('#design-input').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>10000000)return toast('El archivo supera el tamaño permitido.','info');try{const design=M.validate(JSON.parse(await file.text()));askLeave(()=>{openDocument(design);toast('Diseño importado.');});}catch(error){toast(error.message||'No se pudo abrir ese diseño.','info');}});
  document.addEventListener('click',event=>{if(!event.target.closest('.more-wrap'))$('#more-menu').hidden=true;});
  $('#dialog-form').addEventListener('submit',event=>event.preventDefault());
  window.ReportCanvasZoom.attach($('#editor-view'),{enabled:()=>!!state.doc&&!$('#editor-view').hidden&&!$('#app-dialog').open&&!$('#preview-dialog').open,zoom:()=>state.zoom,change:zoom=>{state.autoFit=false;state.zoom=zoom;applyZoom();}});
  const observer=new ResizeObserver(()=>{if(state.doc&&state.autoFit)requestAnimationFrame(fitPage);});observer.observe($('#app'));
  window.addEventListener('resize',()=>{if(state.doc){renderPanels();if(state.autoFit)fitPage();}if($('#preview-dialog').open)renderPreview();});
  async function proposalPreference(action,value){return window.SchoolBulletinEditor.preference(action,value);}
  X.init({selection:()=>{
    if(!state.doc||$('#editor-view').hidden)return {items:[],elements:[],part:'',key:''};
    const part=E.selected(),items=part?[state.doc.sheet[part]]:selectedNodes();
    const elements=part?[$('#paper [data-sheet-target="'+part+'"]')]:$$('#paper [data-node]').filter(el=>state.selected.includes(el.dataset.node));
    if(pageLocked())for(let i=0;i<items.length;i++)items[i]={...items[i],locked:true};
    return {part,items,elements:elements.filter(Boolean),key:part||items.map(item=>item.id).join(':')};
  },globalFields:()=>state.fieldMode,selectionFields:()=>selectedNodes().every(n=>(state.previewModes[n.id]||(state.fieldMode?'fields':'values'))==='fields'),grouping:()=>({group:selectedNodes().length>1&&!O.canUngroup(selectedNodes())&&!selectedNodes().some(n=>n.locked),ungroup:O.canUngroup(selectedNodes())&&!selectedNodes().some(n=>n.locked)}),propertiesOpen:()=>state.inspectorOpen,box:selectedBox,format:selectionFormat,arrange:selectionArrange,action:selectionAction});
  E.init({doc:()=>state.doc,view:activeDoc,locked:pageLocked,zoom:()=>state.zoom,snapshot,history:pushHistory,commit,toast,finish:finishTextEdit,paper:renderPaper,header:renderHeader,inspector:renderInspector,panels:renderPanels,refresh:renderEditor,clearNodes:()=>{state.selected=[];renderSelection();},openInspector:explicit=>{if(!tablet()||explicit){state.inspectorOpen=true;if(tablet())state.libraryOpen=false;}}});
  P.init({doc:()=>state.doc,gallery:renderGallery,refresh:()=>state.doc?renderEditor():renderGallery(),toast,edit:fn=>commit(()=>fn(state.doc)),preference:proposalPreference,create:(doc,done)=>askLeave(()=>{openDocument(doc);done?.();}),proposalHTML:(doc,width)=>{try{const pages=R.paginate(doc).pages,size=M.pageSize(doc),scale=Math.min(width/size.w,.85);return pages.map((page,i)=>`<div class="assistant-preview-page" style="width:${size.w*scale}px;height:${size.h*scale}px"><div class="paper has-flow" style="width:${size.w}px;height:${size.h}px;transform:scale(${scale})">${pageHTML(page,doc,i,false,doc.sampleScale,pages.length)}</div></div>`).join('');}catch(error){return '<div class="pagination-error">'+esc(error.message)+'</div>';}}});
  F.attach(()=>state.doc?R.context(state.doc):{fields:{school:P.profile().name}});
  document.fonts?.addEventListener('loadingdone',()=>{if(state.doc&&!state.inline&&!E.isEditing()){renderPaper();if($('#preview-dialog').open)renderPreview();}});
  document.fonts?.ready.then(()=>{if(state.doc)renderEditor();else renderGallery();});
  window.addEventListener('school-editor:restore',event=>{const doc=event.detail;openDocument(doc,true);state.baseline='';renderHeader();});
  window.addEventListener('school-editor:more',async()=>{try{for(const row of await window.SchoolBulletinEditor.more())state.saved.set(row.id,row);renderGallery();}catch(error){toast(error.message,'info');}finally{const button=document.querySelector('#load-saved-designs');if(button){button.disabled=false;button.hidden=!window.SchoolBulletinEditor.hasMore();}}});
  renderGallery();readSaved().then(()=>{const id=decodeURIComponent(location.hash.replace(/^#editor\/?/,''));if(location.hash.startsWith('#editor/')&&state.saved.has(id))openDocument(state.saved.get(id).doc,true);else if(location.hash==='#editor')openDocument(M.documentDesign());});
})();
