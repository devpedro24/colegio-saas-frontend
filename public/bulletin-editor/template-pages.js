/* Page-only template insertion. Existing pages and saved academic data are never rewritten. */
(function(root){
  'use strict';
  const M=root.ReportPrototypeModel,C=root.ReportCanvasEngine;
  function insert(target,template,index=0,replace=false,measure){
    if(replace&&target.pages[index]?.locked)throw new Error('Desbloquea la página para reemplazarla.');
    const doc=M.clone(target),incoming=M.clone(template);
    const appearance=M.normalizeDesign({...incoming.design,signature:incoming.design?.signature||'ambos'});
    const prepared=C.prepare(incoming,measure),assets={...doc.assets},assetKeys=new Map(),groups=new Map();
    for(const [key,value] of Object.entries(prepared.assets||{})){
      let next=Object.keys(assets).find(k=>assets[k]===value);
      if(!next){next=M.uid();assets[next]=value;}assetKeys.set(key,next);
    }
    const pages=prepared.pages.map(p=>({...p,id:M.uid(),format:p.format||prepared.format,orientation:p.orientation||prepared.orientation,locked:false,hidden:false,blocks:p.blocks.map(original=>{
      const n=M.clone(original);n.id=M.uid();n.appearance={...appearance,...n.appearance};
      if(n.asset)n.asset=assetKeys.get(n.asset);
      if(n.groupKey){if(!groups.has(n.groupKey))groups.set(n.groupKey,M.uid());n.groupKey=groups.get(n.groupKey);}
      return n;
    })}));
    index=M.clamp(index,0,doc.pages.length-1);const at=replace?index:index+1;
    doc.pages.splice(at,replace?1:0,...pages);
    if(doc.pages.length>12)throw new Error('Puedes añadir hasta 12 páginas al diseño.');
    if(doc.pages.some(p=>p.blocks.length>100)||doc.pages.reduce((sum,p)=>sum+p.blocks.length,0)>160)throw new Error('El diseño supera el límite de elementos.');
    if(Object.keys(assets).length>12)throw new Error('El diseño tiene demasiadas imágenes.');
    doc.assets=assets;doc.layout='canvas';doc.schema=2;
    doc.pagination={enabled:true,margin:44,gap:14,repeatHeader:true,...doc.pagination};
    return {doc,index:at,pageId:pages[0].id};
  }
  function update(target,index,action,value){
    const doc=M.clone(target),page=doc.pages[index];if(!page)return {doc,index:0};
    if(page.locked&&['delete','rename'].includes(action))throw new Error('Desbloquea la página para modificarla o eliminarla.');
    let next=index;
    if(action==='rename')page.title=String(value||'').trim().slice(0,100);
    else if(action==='hide')page.hidden=!page.hidden;
    else if(action==='lock')page.locked=!page.locked;
    else if(action==='up'||action==='down'){const at=index+(action==='up'?-1:1);if(at>=0&&at<doc.pages.length){[doc.pages[index],doc.pages[at]]=[doc.pages[at],doc.pages[index]];next=at;}}
    else if(action==='delete'){if(doc.pages.length===1)throw new Error('El diseño necesita al menos una página.');doc.pages.splice(index,1);next=Math.min(index,doc.pages.length-1);}
    else if(action==='add'||action==='copy'){
      if(doc.pages.length>=12)throw new Error('Puedes añadir hasta 12 páginas al diseño.');
      const copy=action==='add'?{id:M.uid(),format:page.format||doc.format,orientation:page.orientation||doc.orientation,blocks:[]}:M.clone(page),groups=new Map();
      copy.id=M.uid();copy.locked=false;copy.hidden=false;if(action==='copy'&&copy.title)copy.title=copy.title.slice(0,92)+' · Copia';
      for(const node of copy.blocks){node.id=M.uid();if(node.groupKey){if(!groups.has(node.groupKey))groups.set(node.groupKey,M.uid());node.groupKey=groups.get(node.groupKey);}}
      doc.pages.splice(index+1,0,copy);next=index+1;
    }
    if(doc.pages.reduce((sum,p)=>sum+p.blocks.length,0)>160)throw new Error('El diseño supera el límite de elementos.');
    return {doc,index:next};
  }
  root.ReportTemplatePages={insert,update};
})(typeof window==='undefined'?globalThis:window);
