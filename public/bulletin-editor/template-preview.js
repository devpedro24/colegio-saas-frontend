/* Read-only design preview. Academic records and editor mutations are not available here. */
(function(){
  'use strict';
  const origin=new URL(document.baseURI).origin,channel='school-bulletin-preview-v1',M=window.ReportPrototypeModel,R=window.ReportPrototypeEngine,C=window.ReportCanvasEngine,D=window.ReportPageLayout;
  let current,epoch=0;
  async function render(payload){
    const version=++epoch;
    try{
      const source=structuredClone(payload.document);
      source.id=source.key||source.id;source.scope=payload.scope;
      for(const page of source.pages){page.id=page.key||page.id;for(const node of page.blocks)node.id=node.key||node.id;}
      source.assets=payload.assets||{};
      const doc=M.validate(source);doc.institution=M.normalizeInstitution(payload.institution);doc.school=doc.institution.name;
      doc.sampleScale=doc.design?.previewScale==='visual'?'visual':'numeric';
      doc.sample={profile:doc.sampleScale==='visual'?'preschool':'primary',student:'one',year:payload.institution.year||'2026',periods:payload.institution.periods||4,count:doc.sampleScale==='visual'?8:14};
      const fonts=[...new Set(doc.pages.flatMap(p=>p.blocks.map(n=>n.font)))];
      await Promise.all(fonts.flatMap(font=>[document.fonts.load('12px "'+font+'"'),document.fonts.load('700 12px "'+font+'"')]));
      if(version!==epoch)return;
      const layout=C.emit(doc,null,'values'),thumbnail=payload.mode==='thumbnail';
      document.documentElement.lang=payload.lang||'es';document.body.classList.toggle('thumbnail',thumbnail);
      document.body.replaceChildren();
      for(const [i,page] of layout.pages.entries()){
        if(thumbnail&&i>0)break;
        const view=M.pageView(doc,page),size=M.pageSize(view),zoom=Math.min((innerWidth-(thumbnail?16:32))/size.w,thumbnail?(innerHeight-16)/size.h:1);
        const wrap=document.createElement('div');wrap.className='preview-wrap';wrap.style.cssText=`width:${size.w*zoom}px;height:${size.h*zoom}px`;
        const paper=document.createElement('div');paper.className='paper has-flow';paper.style.cssText=`width:${size.w}px;height:${size.h}px;transform:scale(${zoom})`;
        paper.innerHTML=page.blocks.filter(n=>!n.hidden).map((n,index)=>`<div class="canvas-block ${n._flow?'flow-block':''} ${n._designer?'designer-block':''}" style="--report-accent:${R.escape(n.accent)};left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;color:${n.color};font-family:'${R.escape(n.font)}';font-size:${n.fontSize}px;font-weight:${n.bold?700:400};font-style:${n.italic?'italic':'normal'};line-height:${n.lineHeight||1.5};letter-spacing:${n.letterSpacing||0}px;text-decoration:${[n.underline?'underline':'',n.strike?'line-through':''].filter(Boolean).join(' ')||'none'};text-align:${n.align};background:${n.fill};border-radius:${n.radius}px;z-index:${index+2}"><div class="block-content">${n._html}</div></div>`).join('')+D.render(view,layout.ctx,i,layout.pages.length);
        wrap.append(paper);document.body.append(wrap);
      }
    }catch(error){document.body.replaceChildren();const message=document.createElement('p');message.className='preview-error';message.textContent=payload.lang?.startsWith('en')?'The design preview could not be loaded.':'No se pudo cargar la vista previa del diseño.';document.body.append(message);}
  }
  addEventListener('message',event=>{if(event.source!==parent||event.origin!==origin||event.data?.channel!==channel||event.data.action!=='render')return;current=event.data.payload;render(current);});
  let timer;addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(current)render(current);},100);});
  parent.postMessage({channel,action:'ready'},origin);
})();
