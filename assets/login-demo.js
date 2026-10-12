(function(){
 'use strict';
 document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('explore-demo')?.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;if(window.StarkWorkspace){event.preventDefault();window.StarkWorkspace.navigateMode('demo');}});
  document.querySelectorAll('[data-password-toggle]').forEach(button=>{if(button.dataset.passwordToggleReady==='true')return;button.dataset.passwordToggleReady='true';button.onclick=()=>{const input=button.closest('.auth-input-wrap').querySelector('input'),show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?'Hide password':'Show password');button.setAttribute('aria-pressed',String(show));input.focus();};});
 },{once:true});
})();
