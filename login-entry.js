/* Keep old recruiter links working; the plain main URL displays the sign-in page. */
(function () {
  'use strict';
  const query=new URLSearchParams(location.search);
  if(query.get('demo')!=='1')return;
  const root=window.StarkWorkspace?.rootURL || new URL('../',document.currentScript.src);
  const target=new URL('workspace.html?demo=1',root);
  const region=String(query.get('region')||query.get('workspace')||'').toUpperCase();
  if(['US','EU','CA','CANADA'].includes(region))target.searchParams.set('region',region==='CANADA'?'CA':region);
  window.__STARK_ENTRY_REDIRECT__=true;
  location.replace(target.href);
})();
