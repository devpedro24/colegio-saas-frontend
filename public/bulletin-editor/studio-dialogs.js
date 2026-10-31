/* Shared dialog feedback and pending actions for the template studio. */
(function(root){
  'use strict';
  const bound=new WeakSet();
  function outside(event,dialog){
    const r=dialog.getBoundingClientRect();
    return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);
  }
  function feedback(dialog){
    if(!dialog.open)return;
    dialog.classList.remove('studio-dialog-pulse');void dialog.offsetWidth;
    dialog.classList.add('studio-dialog-pulse');
  }
  function bind(dialog){
    if(bound.has(dialog))return;bound.add(dialog);let start=false;
    dialog.addEventListener('pointerdown',event=>{start=event.button===0&&outside(event,dialog);});
    dialog.addEventListener('pointerup',event=>{if(start&&outside(event,dialog))feedback(dialog);start=false;});
    dialog.addEventListener('pointercancel',()=>{start=false;});
    dialog.addEventListener('animationend',event=>{if(event.target===dialog&&event.animationName.startsWith('studio-dialog-feedback'))dialog.classList.remove('studio-dialog-pulse');});
    dialog.addEventListener('cancel',event=>{if(dialog.getAttribute('aria-busy')==='true'){event.preventDefault();feedback(dialog);}});
  }
  function busy(dialog,button,label='Procesando…'){
    const controls=[...dialog.querySelectorAll('button,input,select,textarea')].map(el=>({el,disabled:el.disabled}));
    const nodes=[...button.childNodes];dialog.setAttribute('aria-busy','true');
    controls.forEach(({el})=>el.disabled=true);
    const spinner=document.createElement('span');spinner.className='studio-spinner';spinner.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.textContent=label;button.replaceChildren(spinner,text);
    return ()=>{dialog.removeAttribute('aria-busy');button.replaceChildren(...nodes);controls.forEach(({el,disabled})=>el.disabled=disabled);};
  }
  function init(){
    const scan=()=>document.querySelectorAll('dialog').forEach(bind);scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  }
  root.ReportStudioDialogs={outside,feedback,bind,busy,init};
})(typeof window==='undefined'?globalThis:window);
