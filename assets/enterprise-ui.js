(function () {
  'use strict';
  if(!window.StarkSystem)return;
  let panel,former;
  function sync(){const open=!!panel?.classList.contains('open');document.querySelector('#system-ai-toggle')?.setAttribute('aria-expanded',String(open));if(panel&&!panel.classList.contains('mk-docked')){panel.setAttribute('role',open?'dialog':'region');if(open)panel.setAttribute('aria-modal','true');else panel.removeAttribute('aria-modal');}}
  function toggle(){
    if(!panel)return;
    if(panel.classList.contains('mk-docked')){panel.scrollIntoView?.({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth'});panel.querySelector('textarea')?.focus();return;}
    if(panel.classList.contains('open')){window.MKBrain.close();former?.focus();}else{former=document.activeElement;window.MKBrain.open();panel.querySelector('textarea')?.focus();}sync();
  }
  function ready(){panel=document.querySelector('.mk-brain-panel');if(!panel)return;panel.id='system-ai-panel';panel.querySelector('.mk-close')?.addEventListener('click',()=>{sync();former?.focus();});new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});sync();}
  function init(){document.querySelector('#system-ai-toggle')?.addEventListener('click',toggle);if(window.MKBrain)ready();window.addEventListener('mk:ready',ready);window.addEventListener('mk:visibility-change',event=>{sync();if(!event.detail.open)former?.focus();});document.addEventListener('keydown',event=>{if(!panel?.classList.contains('open')||panel.classList.contains('mk-docked')||document.querySelector('.modal-backdrop,.sys-modal-backdrop'))return;if(event.key==='Escape'){window.MKBrain.close();sync();former?.focus();}if(event.key==='Tab'){const nodes=[...panel.querySelectorAll('a,button,textarea,input,select')].filter(n=>!n.disabled&&!n.hidden&&!n.closest('[hidden]'));const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});}
  window.StarkEnterpriseLayout={toggleAI:toggle,syncDock:sync,refresh:sync};
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
