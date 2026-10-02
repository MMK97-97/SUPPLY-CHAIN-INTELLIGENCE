(function(){
  'use strict';
  function add(){
    var actions=document.querySelector('.header-actions');
    if(actions&&!document.getElementById('enterprise-ops-link')){
      var a=document.createElement('a');a.id='enterprise-ops-link';a.href='business-operations.html';a.className='button button-secondary';a.textContent='Business Operations';actions.insertBefore(a,actions.firstChild);
    }
    var grid=document.querySelector('.module-grid');
    if(!grid||grid.querySelector('[data-enterprise-suite]')) return;
    var mods=[
      ['CRM','◈','CRM','Accounts, programs, credit, contract pricing and partner integrations','crm.html','#46d7ff'],
      ['ORD','⇢','Order Management','Hold, redemption, bulk and firm PO execution','order-management.html','#a77cff'],
      ['VEN','⎔','Vendor Management','Vendor master, procurement, digital vault and SLA','vendor-management.html','#35d07f']
    ];
    mods.forEach(function(m){
      var b=document.createElement('button');b.type='button';b.className='module-button';b.setAttribute('data-enterprise-suite','true');
      b.style.setProperty('--suite-accent',m[5]);b.style.borderColor='color-mix(in srgb, var(--suite-accent) 32%, transparent)';
      b.innerHTML='<span class="module-code">'+m[0]+'</span><span class="module-icon" aria-hidden="true">'+m[1]+'</span><strong>'+m[2]+'</strong><small>'+m[3]+'</small><i aria-hidden="true">→</i>';
      b.addEventListener('click',function(){location.href=m[4]});grid.appendChild(b);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();
})();
