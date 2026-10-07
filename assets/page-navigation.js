/* Full-document navigation: preserve the current frame and each module's lifecycle. */
(function () {
  'use strict';
  if (window.StarkNavigation) return;
  const root = document.documentElement;
  const prefetched = new Set();
  const ownRoot = new URL('../', document.currentScript.src);
  let resetTimer;

  function reset() {
    clearTimeout(resetTimer);
    root.classList.remove('stark-navigation-pending');
    document.getElementById('stark-navigation-status')?.remove();
  }
  function indicate() {
    reset();
    root.classList.add('stark-navigation-pending');
    if (document.body) {
      const status = document.createElement('span');
      status.id = 'stark-navigation-status';
      status.className = 'visually-hidden';
      status.setAttribute('role', 'status');
      status.textContent = 'Opening the next page…';
      document.body.appendChild(status);
    }
    // A cancelled navigation or a beforeunload prompt must leave the page usable.
    resetTimer = setTimeout(reset, 12000);
  }
  function destination(link) {
    if (!link || link.hasAttribute('download') || link.hasAttribute('data-no-prefetch') ||
        (link.target && link.target !== '_self') || link.relList.contains('external')) return null;
    try {
      const url = new URL(link.href, location.href);
      if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin ||
          !url.pathname.startsWith(ownRoot.pathname) || !/\.html$/.test(url.pathname)) return null;
      if (url.pathname === location.pathname && url.search === location.search) return null;
      return url;
    } catch (_) { return null; }
  }
  function targetLink(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    return target?.closest('a[href]');
  }
  function prefetch(event) {
    const connection = navigator.connection;
    if (navigator.onLine === false || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
    const url = destination(targetLink(event));
    if (!url || /\/(login|auth-callback|cloud-agent)\.html$/.test(url.pathname) ||
        [...url.searchParams.keys()].some(key => /^(code|token|access_token|refresh_token|type|flow)$/i.test(key))) return;
    url.hash = '';
    if (prefetched.size >= 6 || prefetched.has(url.href)) return;
    prefetched.add(url.href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch'; hint.as = 'document'; hint.href = url.href;
    hint.dataset.starkPrefetch = 'true';
    document.head.appendChild(hint);
  }
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !destination(targetLink(event))) return;
    // Run after page-specific handlers; native navigation remains immediate.
    queueMicrotask(() => { if (!event.defaultPrevented) indicate(); });
  });
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('focusin', prefetch);
  window.addEventListener('pageshow', reset);
  window.addEventListener('pagehide', reset);
  window.addEventListener('pagereveal', reset);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reset(); });
  function ready() {
    // Modules and the shared shell finish their DOMContentLoaded listeners first.
    queueMicrotask(() => root.classList.remove('stark-page-loading'));
  }
  if (document.readyState === 'loading' || document.readyState === 'interactive') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
  window.StarkNavigation = Object.freeze({ navigate(url) { indicate(); location.assign(url); }, reset });
})();
