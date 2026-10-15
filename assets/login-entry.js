/* Keep old recruiter links working; the plain main URL displays the sign-in page or workspace. */
(function () {
  'use strict';
  const query = new URLSearchParams(location.search);
  const scriptEl = document.currentScript || document.querySelector('script[src*="login-entry"]');
  const root = window.StarkWorkspace?.rootURL || (scriptEl ? new URL('../', scriptEl.src) : new URL('./', location.href));

  if (query.get('demo') === '1') {
    const target = new URL('workspace.html?demo=1', root);
    const region = String(query.get('region') || query.get('workspace') || '').toUpperCase();
    if (['US', 'EU', 'CA', 'CANADA'].includes(region)) target.searchParams.set('region', region === 'CANADA' ? 'CA' : region);
    window.__STARK_ENTRY_REDIRECT__ = true;
    location.replace(target.href);
    return;
  }
})();
