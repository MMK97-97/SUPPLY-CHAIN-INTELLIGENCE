(function(){
  'use strict';
  const S=window.StarkSystem;if(!S)return;
  function init(){
    if(!document.querySelector('.system-header')||document.querySelector('.portfolio-mobile-nav'))return;
    const nav=document.createElement('nav');nav.className='portfolio-mobile-nav';nav.setAttribute('aria-label','Mobile workspace navigation');
    const routes=[['workspace.html','Overview','home'],['order-management/index.html','Orders','orders'],['warehouse-management/index.html','Stock','warehouse'],['mk-brain.html','Analyst','data']];
    nav.innerHTML=routes.map(([route,label,icon])=>`<a href="${S.url(route)}" ${location.pathname===new URL(route,S.rootURL).pathname?'aria-current="page"':''}>${window.StarkSystemUI.glyph(icon)}<span>${label}</span></a>`).join('')+'<button type="button" aria-label="Open all modules" aria-controls="system-modules" aria-expanded="false">'+window.StarkSystemUI.glyph('data')+'<span>More</span></button>';
    document.body.append(nav);const more=nav.querySelector('button');more.onclick=()=>window.StarkModuleNavigation.open(more);
    const menu=document.querySelector('.system-menu');new MutationObserver(()=>more.setAttribute('aria-expanded',menu.getAttribute('aria-expanded'))).observe(menu,{attributes:true,attributeFilter:['aria-expanded']});
    // Tables keep every field; keyboard and touch users get an explicit scroll region.
    function tables(){document.querySelectorAll('.table-wrap,.sys-table-wrap,.tower-table-wrap,.table-scroll').forEach(el=>{if(el.dataset.mobileTableReady)return;el.dataset.mobileTableReady='true';el.setAttribute('role','region');el.setAttribute('aria-label','Records table; scroll horizontally for all columns');el.tabIndex=0;});}
    tables();new MutationObserver(tables).observe(document.body,{childList:true,subtree:true});
    document.querySelector('#system-module-tabs a.active')?.scrollIntoView?.({block:'nearest',inline:'center'});
  }
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
