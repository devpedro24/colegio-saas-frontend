/* Same-origin editor bridge. No credentials, API transport or browser persistence in this frame. */
(function(){
  'use strict';
  const channel='school-bulletin-editor-v1',pending=new Map(),items=new Map(),images=new Map(),uploads=new Map();
  let initial,notified='',timer,restored,changeEpoch=0;
  function request(action,payload={}){
    if(parent===window)return Promise.reject(new Error('Abre el editor desde Plantillas de boletín.'));
    const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('No se pudo completar la solicitud. Intenta nuevamente.'));},60000);
      pending.set(id,{resolve,reject,timeout});parent.postMessage({channel,id,action,payload},new URL(document.baseURI).origin);
    });
  }
  window.addEventListener('message',event=>{
    if(event.origin!==new URL(document.baseURI).origin||event.source!==parent||event.data?.channel!==channel)return;
    const message=event.data;
    if(message.action==='preview'){window.dispatchEvent(new Event('school-editor:preview'));return;}
    if(message.action==='discard'){changeEpoch++;clearTimeout(timer);window.dispatchEvent(new Event('school-editor:discard'));return;}
    if(message.action==='restore'){restored=message.payload;hydrate(message.payload).then(doc=>window.dispatchEvent(new CustomEvent('school-editor:restore',{detail:doc}))).catch(()=>{});return;}
    const entry=pending.get(message.id);if(!entry)return;pending.delete(message.id);clearTimeout(entry.timeout);
    if(message.error)entry.reject(new Error(message.error));else entry.resolve(message.payload);
  });
  const ready=request('catalog').then(value=>{initial=value;document.documentElement.lang=value.lang;return value;});
  function profile(){return initial?.institution||{name:initial?.school||''};}
  function decorate(doc){
    doc.sampleScale=['numeric','visual'].includes(doc.sampleScale)?doc.sampleScale:doc.design?.previewScale==='visual'?'visual':'numeric';
    doc.institution=window.ReportPrototypeModel.normalizeInstitution(profile());doc.school=profile().name||'';
    doc.sample={...doc.sample,year:profile().year||String(new Date().getFullYear()),periods:profile().periods||4};
    doc.sheet=window.ReportPrototypeModel.normalizeSheet(doc.sheet,true);
    if(doc.sheet?.footer?.text==='Datos de muestra · [Nombre del colegio]')doc.sheet.footer.text='{{school}}';
    return doc;
  }
  function legacy(item){
    const M=window.ReportPrototypeModel,design=item.configuracion,doc=M.documentDesign('blank',item.ambito);
    const types={student:'student',areas:'table',subjects:'table',indicators:'indicators',observations:'observation',attendance:'attendance',signature:'signature'};
    let y=44;doc.pages[0].blocks=[M.block('header',44,y,{w:708,h:120,accent:design.accent})];y+=134;
    for(const section of design.sections){if(!section.visible)continue;const node=M.block(types[section.key],44,y,{w:708,accent:design.accent});if(section.key==='areas')node.table={...M.tableDefaults(),rowMode:'areas'};if(node.type==='observation')node.text='{{observation}}';doc.pages[0].blocks.push(node);y+=Math.min(node.h,110)+14;}
    doc.accent=design.accent;doc.layout='flow';doc.pagination={enabled:true,margin:44,gap:14,repeatHeader:true};return doc;
  }
  async function hydrate(source){
    const doc=structuredClone(source);if(doc.key){doc.id=doc.key;delete doc.key;}for(const page of doc.pages){if(page.key){page.id=page.key;delete page.key;}for(const node of page.blocks)if(node.key){node.id=node.key;delete node.key;}}doc.assets=doc.assets||{};
    for(const [key,value] of Object.entries(doc.assets)){
      if(typeof value==='string'&&/^[A-Za-z0-9_-]{24}$/.test(value)){
        if(!images.has(value))images.set(value,request('asset',{token:value}).then(result=>result.content));
        const data=await images.get(value);uploads.set(data,Promise.resolve(value));doc.assets[key]=data;
      }
    }
    return decorate(doc);
  }
  async function documentFor(item){
    const doc=await hydrate(item.configuracion.canvas||legacy(item));doc.id=item.token;doc.name=item.nombre;doc.scope=item.ambito;items.set(item.token,item);return doc;
  }
  async function catalog(){
    const value=await ready;const list=[];
    for(const item of value.items){const doc=await documentFor(item);list.push({id:item.token,doc,updated:Date.parse(item.actualizado_en)||Date.now(),revisions:[],published:item.revision_publicada});}
    return list;
  }
  async function more(){
    await ready;if(initial.nextPage>initial.lastPage)return [];
    const page=initial.nextPage,rows=await request('catalog-more',{page});initial.nextPage++;const result=[];
    for(const item of rows)result.push({id:item.token,doc:await documentFor(item),updated:Date.parse(item.actualizado_en)||Date.now(),revisions:[],published:item.revision_publicada});
    return result;
  }
  function clean(doc){
    const result=structuredClone(doc);delete result.runtime;delete result.institution;delete result.school;delete result.sample;
    result.design={...result.design,previewScale:doc.sampleScale==='visual'?'visual':'numeric'};
    delete result.sampleScale;for(const page of result.pages)for(const node of page.blocks){if(typeof node.text==='string')node.text=window.ReportFieldGuide.internalize(node.text);for(const key of Object.keys(node.content||{}))node.content[key]=window.ReportFieldGuide.internalize(node.content[key]);}for(const key of ['footer','numbering'])if(result.sheet?.[key])result.sheet[key].text=window.ReportFieldGuide.internalize(result.sheet[key].text);return result;
  }
  async function prepare(doc){
    const result=clean(doc);result.assets=result.assets||{};
    for(const [key,value] of Object.entries(result.assets)){
      if(typeof value!=='string')throw new Error('Imagen no válida.');
      if(/^[A-Za-z0-9_-]{24}$/.test(value))continue;
      if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))throw new Error('Usa una imagen PNG, JPG o WebP.');
      if(!uploads.has(value))uploads.set(value,request('upload',{content:value}).then(row=>row.token).catch(error=>{uploads.delete(value);throw error;}));
      result.assets[key]=await uploads.get(value);
    }
    return result;
  }
  async function save(doc,publish){
    changeEpoch++;clearTimeout(timer);
    const canvas=await prepare(doc);canvas.key=canvas.id;delete canvas.id;for(const page of canvas.pages){page.key=page.id;delete page.id;for(const node of page.blocks){node.key=node.id;delete node.id;}}const old=items.get(doc.id),saved=await request('save',{id:old?.token,version:old?.version,publish,
      input:{nombre:doc.name,ambito:doc.scope,configuracion:{accent:doc.accent||'#6A23FF',font:'sans',density:'comfortable',heading:doc.scope==='final'?'Informe académico final':'Informe académico',subheading:'',
        sections:['student','areas','subjects','indicators','observations','attendance','signature'].map(key=>({key,visible:['student','subjects'].includes(key)})),canvas}}});
    items.delete(doc.id);const next=await documentFor(saved);notified=JSON.stringify(clean(next));parent.postMessage({channel,action:'saved',payload:{doc:clean(next),version:saved.version}},new URL(document.baseURI).origin);
    return {id:saved.token,doc:next,updated:Date.parse(saved.actualizado_en)||Date.now(),revisions:[],published:saved.revision_publicada};
  }
  function changed(doc,dirty){
    if(!initial||!doc)return;
    const raw=clean(doc),signature=JSON.stringify(raw);
    if(signature===notified)return;notified=signature;clearTimeout(timer);
    const epoch=++changeEpoch;timer=setTimeout(async()=>{
      try{const canvas=await prepare(raw);if(epoch!==changeEpoch)return;parent.postMessage({channel,action:'changed',payload:{doc:canvas,dirty,version:items.get(doc.id)?.version||0}},new URL(document.baseURI).origin);}catch(error){parent.postMessage({channel,action:'warning',payload:{message:error.message}},new URL(document.baseURI).origin);}
    },400);
  }
  async function versions(id){
    if(!items.has(id))return [];
    const rows=await request('versions',{token:id});return Promise.all(rows.map(async row=>({revision:row.revision,at:row.publicado_en,design:await documentFor({...items.get(id),...row,token:id,nombre:row.nombre})})));
  }
  async function remove(id){
    const item=items.get(id);if(!item)throw new Error('La plantilla ya no está disponible.');
    await request('delete',{token:item.token,version:item.version});
    items.delete(id);initial.items=initial.items.filter(row=>row.token!==id);
  }
  function discarded(){changeEpoch++;clearTimeout(timer);parent.postMessage({channel,action:'discarded'},new URL(document.baseURI).origin);}
  const ui=new MutationObserver(()=>{
    if(!initial)return;
    document.querySelectorAll('.prototype-bar,.device-switcher,[data-device],.gallery-header .avatar').forEach(el=>{if(el.id!=='app')el.hidden=true;});
    document.querySelectorAll('[data-assist="school"],[data-assist="school-logo"],[data-assist="school-example"],[data-assist="save-school"]').forEach(el=>el.hidden=true);
    const gallery=document.querySelector('.gallery-main');if(gallery&&!document.querySelector('#load-saved-designs')&&initial.nextPage<=initial.lastPage){const button=document.createElement('button');button.id='load-saved-designs';button.className='button violet';button.textContent='Cargar más plantillas guardadas';button.onclick=async()=>{button.disabled=true;window.dispatchEvent(new Event('school-editor:more'));};gallery.append(button);}
    if(initial.canEdit===false){document.body.classList.add('editor-readonly');document.querySelectorAll('[data-action="save"],[data-action="publish"],[data-action="upload"]').forEach(el=>el.disabled=true);}
  });
  ui.observe(document.body,{childList:true,subtree:true});
  function view(mode){parent.postMessage({channel,action:'view',payload:{mode}},new URL(document.baseURI).origin);}
  window.SchoolBulletinEditor={view,ready,profile,decorate,catalog,more,hasMore:()=>initial&&initial.nextPage<=initial.lastPage,save,changed,versions,remove,discarded,canEdit:()=>initial?.canEdit===true,
    preference:async action=>{await ready;if(action!=='read')throw new Error('Edita los datos del colegio en Ajustes institucionales.');return profile();}};
})();
