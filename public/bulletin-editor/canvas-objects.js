/* Selection and grouping are presentation metadata; academic bindings remain live. */
(function(root){
  'use strict';
  const splitTypes=['header','student','scale','observation','signature'];
  function bounds(nodes){
    if(!nodes.length)return null;
    const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));
    return {x,y,w:Math.max(...nodes.map(n=>n.x+n.w))-x,h:Math.max(...nodes.map(n=>n.y+n.h))-y};
  }
  function members(nodes,ids){
    const groups=new Set(nodes.filter(n=>ids.includes(n.id)&&n.groupKey).map(n=>n.groupKey));
    return nodes.filter(n=>!n.hidden&&(ids.includes(n.id)||groups.has(n.groupKey))).map(n=>n.id);
  }
  function select(nodes,ids,id,append){
    const cluster=members(nodes,[id]);
    return append?(cluster.every(key=>ids.includes(key))?ids.filter(key=>!cluster.includes(key)):[...new Set([...ids,...cluster])]):cluster;
  }
  function inRect(nodes,rect){
    return members(nodes,nodes.filter(n=>!n.hidden&&n.x<rect.x+rect.w&&n.x+n.w>rect.x&&n.y<rect.y+rect.h&&n.y+n.h>rect.y).map(n=>n.id));
  }
  function canUngroup(nodes){return nodes.length>1&&!!nodes[0].groupKey&&nodes.every(n=>n.groupKey===nodes[0].groupKey)||nodes.length===1&&splitTypes.includes(nodes[0].type)&&!(nodes[0].type==='student'&&typeof nodes[0].content?.student==='string'&&!nodes[0].content.student.includes('\n'));}
  function group(nodes,key){if(nodes.length<2||nodes.some(n=>n.locked))return false;nodes.forEach(n=>n.groupKey=key);return true;}
  function ungroup(nodes){nodes.forEach(n=>delete n.groupKey);}
  function transform(nodes,original,next,size){
    const sx=next.w/original.w,sy=next.h/original.h;
    return nodes.map(n=>({...n,x:Math.max(0,Math.min(size.w-24,next.x+(n.x-original.x)*sx)),y:Math.max(0,Math.min(size.h-12,next.y+(n.y-original.y)*sy)),w:Math.max(24,n.w*sx),h:Math.max(12,n.h*sy),fontSize:nodes.length>1?Math.max(8,Math.min(90,n.fontSize*Math.min(sx,sy))):n.fontSize}));
  }
  function split(node,doc,element,zoom){
    if(!splitTypes.includes(node.type)||node.locked)return [];
    const M=root.ReportPrototypeModel,R=root.ReportPrototypeEngine,ctx=R.context(doc),c={...M.defaultContent(node,doc),...node.content},base=element.getBoundingClientRect(),parts=[];
    const add=(el,text,options={},bounds)=>{
      if(!el)return;const rect=bounds||el.getBoundingClientRect(),css=getComputedStyle(el);
      if(!rect.width||!rect.height)return;
      const rgb=css.color.match(/\d+/g),color=rgb?'#'+rgb.slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join(''):node.color;
      const part=M.block(options.type||'text',node.x+(rect.left-base.left)/zoom,node.y+(rect.top-base.top)/zoom,{
        font:node.font,fontSize:parseFloat(css.fontSize),bold:Number(css.fontWeight)>=600,italic:css.fontStyle==='italic',underline:node.underline,strike:node.strike,
        color,accent:node.accent,align:css.textAlign,lineHeight:parseFloat(css.lineHeight)/parseFloat(css.fontSize)||node.lineHeight,
        letterSpacing:node.letterSpacing,w:rect.width/zoom,h:rect.height/zoom+2,padding:0,fill:'transparent',text,
        headerPart:node.type==='header'||node.headerPart,repeat:node.type==='header'?node.repeat:!!node.repeat,...options,
      });parts.push(part);return part;
    };
    if(node.type==='header'){
      const masthead=element.querySelector('.flow-masthead'),css=getComputedStyle(masthead),rect=masthead.getBoundingClientRect();
      const channels=css.backgroundColor.match(/\d+(?:\.\d+)?/g);
      if(channels&&(channels.length<4||Number(channels[3])>0))parts.push(M.block('rectangle',node.x+(rect.left-base.left)/zoom,node.y+(rect.top-base.top)/zoom,{w:rect.width/zoom,h:rect.height/zoom,fill:'#'+channels.slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join(''),radius:parseFloat(css.borderRadius)||0,rule:M.normalizeRule({enabled:false}),headerPart:true,repeat:node.repeat}));
      add(element.querySelector('.flow-masthead img'),'',{type:'image',source:'school-logo',name:'Logo del colegio'});
      add(element.querySelector('[data-edit-content="headerTitle"]'),c.headerTitle,{name:'Nombre del colegio'});
      const lines=R.headerLines(node,doc,ctx);
      element.querySelectorAll('[data-split-line]').forEach(el=>add(el,lines[Number(el.dataset.splitLine)],{name:'Información del colegio'}));
      if(parseFloat(css.borderTopWidth)>0)parts.push(M.block('line',node.x+(rect.left-base.left)/zoom,node.y+(rect.top-base.top)/zoom,{w:rect.width/zoom,h:4,rule:M.clone(node.rule),repeat:node.repeat,headerPart:true}));
      if(parseFloat(css.borderBottomWidth)>0){const line=M.block('line',node.x+(rect.left-base.left)/zoom,node.y+(rect.bottom-base.top)/zoom-2,{w:rect.width/zoom,h:4,rule:M.clone(node.rule||M.normalizeRule({},node.accent)),repeat:node.repeat,headerPart:true});parts.push(line);}
    }else if(node.type==='student'){
      const slot=element.querySelector('[data-edit-content="student"]'),lines=[[]];
      for(const child of slot.childNodes){if(child.nodeName==='BR')lines.push([]);else lines[lines.length-1].push(child);}
      c.student.split('\n').forEach((line,index)=>{const children=lines[index];if(!children?.length)return;const range=document.createRange();range.setStartBefore(children[0]);range.setEndAfter(children[children.length-1]);const rect=range.getBoundingClientRect();add(slot,line,{name:node.name+' · '+(index+1)},{left:slot.getBoundingClientRect().left,top:rect.top,width:slot.getBoundingClientRect().width,height:rect.height});});
    }else{
      element.querySelectorAll('[data-edit-content],[data-edit-text]').forEach(el=>{
        const key=el.dataset.editContent,source=key?c[key]:node.text;
        const part=add(el,source,{name:key?M.fields[key]||el.textContent.slice(0,50):node.name});
        if(part&&node.type==='signature'){const rule=el.querySelector('.signature-line');if(rule){const r=rule.getBoundingClientRect(),gap=(r.bottom+parseFloat(getComputedStyle(rule).marginBottom)-el.getBoundingClientRect().top)/zoom;part.y+=gap;part.h=Math.max(12,part.h-gap);parts.push(M.block('line',node.x+(r.left-base.left)/zoom,node.y+(r.top-base.top)/zoom,{w:r.width/zoom,h:4,rule:M.clone(node.rule)}));}}
      });
    }
    return parts;
  }
  root.ReportCanvasObjects={bounds,members,select,inRect,canUngroup,group,ungroup,transform,split};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ReportCanvasObjects;
})(typeof window==='undefined'?globalThis:window);
