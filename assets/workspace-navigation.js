/* Keep retired controls out of navigation after any legacy or regional refresh. */
(function(){
  'use strict';
  function clean(){
    document.querySelectorAll('#system-navigation a,#system-module-tabs a,.premium-side-rail a').forEach(link=>{
      if(/inventory-analysis-report-(us|eu|ca)\.html/i.test(link.getAttribute('href')||''))link.remove();
    });
    document.querySelectorAll('#system-header #system-ai-toggle,.system-header #system-ai-toggle').forEach(node=>node.remove());
    document.querySelectorAll('#system-module-tabs a').forEach(link=>{if(/(?:mk-brain|decision-intelligence-(?:us|eu|ca))\.html/i.test(link.getAttribute('href')||''))link.remove();});
  }
  document.addEventListener('DOMContentLoaded',()=>{clean();for(const node of document.querySelectorAll('.system-header,#system-navigation,#system-module-tabs'))new MutationObserver(clean).observe(node,{childList:true,subtree:true});},{once:true});
})();
