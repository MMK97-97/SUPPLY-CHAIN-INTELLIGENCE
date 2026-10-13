(function(){
 'use strict';
 document.addEventListener('DOMContentLoaded',()=>{
  const W=window.StarkWorkspace,requested=new URLSearchParams(location.search).get('return');
  const target=requested && W?.destination(requested);
  const demo=document.getElementById('explore-demo');
  if(demo && target)demo.href=W.modeURL('demo',target).href;
  demo?.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;const workspace=window.StarkWorkspace;if(workspace){event.preventDefault();if(target)workspace.navigateMode('demo',target);else workspace.navigateMode('demo');}});
  document.querySelectorAll('[data-password-toggle]').forEach(button=>{if(button.dataset.passwordToggleReady==='true')return;button.dataset.passwordToggleReady='true';button.onclick=()=>{const input=button.closest('.auth-input-wrap').querySelector('input'),show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?'Hide password':'Show password');button.setAttribute('aria-pressed',String(show));input.focus();};});
 },{once:true});
})();
