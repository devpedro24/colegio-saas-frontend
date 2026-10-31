/* Zoom shortcuts belong to the design canvas while the editor is open. */
(function(root){
  'use strict';
  const MIN=.2,MAX=1.8;
  function fromWheel(zoom,delta,mode=0){
    if(!Number.isFinite(delta))return zoom;
    const pixels=delta*(mode===1?16:mode===2?800:1);
    return Math.min(MAX,Math.max(MIN,zoom*Math.exp(-Math.max(-160,Math.min(160,pixels))*.002)));
  }
  function attach(element,host){
    const keyboardTarget=element.ownerDocument||element;
    const wheel=event=>{
      if(!event.ctrlKey||!host.enabled())return;
      // This must be non-passive so Chrome/Edge do not zoom the entire application.
      event.preventDefault();
      const current=host.zoom(),next=fromWheel(current,event.deltaY,event.deltaMode);
      if(next!==current)host.change(next);
    };
    const keydown=event=>{
      if(!event.ctrlKey||event.altKey||!host.enabled())return;
      const key=event.key,direction=key==='+'||key==='='||event.code==='NumpadAdd'?1:key==='-'||key==='_'||event.code==='NumpadSubtract'?-1:0;
      if(!direction)return;
      event.preventDefault();
      const current=host.zoom(),next=Math.min(MAX,Math.max(MIN,Math.round((current+direction*.1)*1000)/1000));
      if(next!==current)host.change(next);
    };
    element.addEventListener('wheel',wheel,{passive:false,capture:true});
    keyboardTarget.addEventListener('keydown',keydown,true);
    return ()=>{element.removeEventListener('wheel',wheel,true);keyboardTarget.removeEventListener('keydown',keydown,true);};
  }
  const api={fromWheel,attach};root.ReportCanvasZoom=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
