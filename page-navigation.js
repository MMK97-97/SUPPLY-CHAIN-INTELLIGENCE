/* Smooth MPA navigation: Speculation Rules prerender/prefetch + delayed non-flashing progress + clean View Transitions. */
(function () {
  'use strict';
  if (window.StarkNavigation) return;
  const root = document.documentElement;
  const prefetched = new Set();
  const scriptEl = document.currentScript || document.querySelector('script[src*="page-navigation"]');
  const ownRoot = new URL('../', scriptEl ? scriptEl.src : new URL('assets/', location.href).href);
  let resetTimer;
  let pendingTimer;

  const isAuthOrSensitive = pathname => /\/(login|auth-callback|cloud-agent)\.html$/i.test(pathname);
  const canSpeculate = () => {
    const conn = navigator.connection;
    return navigator.onLine !== false && !conn?.saveData && !/(^|-)2g$/.test(conn?.effectiveType || '');
  };

  function reset() {
    clearTimeout(resetTimer);
    clearTimeout(pendingTimer);
    root.classList.remove('stark-navigation-pending', 'stark-page-loading');
    if (root.dataset.authPublic === 'true' || root.dataset.authEntry === 'true' || window.StarkWorkspace?.isDemo) {
      root.classList.remove('stark-auth-pending');
    }
    document.getElementById('stark-navigation-status')?.remove();
  }

  function indicate() {
    reset();
    // Delay the subtle top progress bar by 160ms so instant/prerendered/cached transitions never flash.
    pendingTimer = setTimeout(() => {
      root.classList.add('stark-navigation-pending');
      if (document.body && !document.getElementById('stark-navigation-status')) {
        const status = document.createElement('span');
        status.id = 'stark-navigation-status';
        status.className = 'visually-hidden';
        status.setAttribute('role', 'status');
        status.textContent = 'Opening the next page…';
        document.body.appendChild(status);
      }
    }, 160);
    // A cancelled navigation or beforeunload prompt must leave the page usable.
    resetTimer = setTimeout(reset, 8000);
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

  function appendPrefetchHint(href) {
    if (!href || prefetched.has(href) || prefetched.size >= 12) return;
    prefetched.add(href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.as = 'document';
    hint.href = href;
    hint.dataset.starkPrefetch = 'true';
    document.head.appendChild(hint);
  }

  function prefetch(event) {
    if (!canSpeculate()) return;
    const url = destination(targetLink(event));
    if (!url || isAuthOrSensitive(url.pathname) ||
        [...url.searchParams.keys()].some(key => /^(code|token|access_token|refresh_token|type|flow)$/i.test(key))) return;
    url.hash = '';
    appendPrefetchHint(url.href);
  }

  function installSpeculationRules() {
    if (!canSpeculate() || document.prerendering || document.querySelector('script[data-stark-speculation]')) return;
    if (isAuthOrSensitive(location.pathname)) return;
    const corePaths = ['workspace.html', 'mail.html', 'tasks.html', 'all-open-orders.html'];
    const coreUrls = corePaths
      .map(p => new URL(p, ownRoot).href)
      .filter(href => new URL(href).pathname !== location.pathname);

    if (typeof HTMLScriptElement !== 'undefined' && typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('speculationrules')) {
      try {
        const basePath = ownRoot.pathname.replace(/\/+$/, '');
        const rules = {
          prerender: [
            {
              where: {
                and: [
                  { href_matches: `${basePath}/*.html` },
                  { not: { href_matches: `${basePath}/login.html*` } },
                  { not: { href_matches: `${basePath}/auth-callback.html*` } },
                  { not: { href_matches: `${basePath}/cloud-agent.html*` } },
                  { not: { selector_matches: '[data-no-prefetch],[download],[target="_blank"]' } }
                ]
              },
              eagerness: 'moderate'
            }
          ],
          prefetch: [
            ...(coreUrls.length ? [{ source: 'list', urls: coreUrls, eagerness: 'eager' }] : []),
            {
              where: {
                and: [
                  { href_matches: `${basePath}/**/*.html` },
                  { not: { href_matches: `${basePath}/login.html*` } },
                  { not: { href_matches: `${basePath}/auth-callback.html*` } },
                  { not: { href_matches: `${basePath}/cloud-agent.html*` } },
                  { not: { selector_matches: '[data-no-prefetch],[download],[target="_blank"]' } }
                ]
              },
              eagerness: 'moderate'
            }
          ]
        };
        const spec = document.createElement('script');
        spec.type = 'speculationrules';
        spec.dataset.starkSpeculation = 'true';
        spec.textContent = JSON.stringify(rules);
        document.head.appendChild(spec);
        return;
      } catch (_) {}
    }

    // Fallback for browsers without Speculation Rules: idle prefetch the core workspace tabs.
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 450));
    idle(() => { coreUrls.forEach(appendPrefetchHint); });
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !destination(targetLink(event))) return;
    // Run after page-specific handlers; native navigation remains immediate.
    queueMicrotask(() => { if (!event.defaultPrevented) indicate(); });
  });
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('focusin', prefetch);
  window.addEventListener('pageshow', () => { reset(); ready(); });
  window.addEventListener('pagehide', reset);
  window.addEventListener('pagereveal', reset);
  window.addEventListener('popstate', () => { reset(); ready(); });
  document.addEventListener('prerenderingchange', () => { reset(); ready(); installSpeculationRules(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reset(); });
  window.addEventListener('pointerdown', ready, { capture: true, passive: true });

  function ready() {
    try { sessionStorage.setItem('stark-session-active', '1'); } catch (_) {}
    root.classList.remove('stark-page-loading', 'stark-navigation-pending');
    if (root.dataset.authPublic === 'true' || root.dataset.authEntry === 'true' || window.StarkWorkspace?.isDemo) {
      root.classList.remove('stark-auth-pending');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      queueMicrotask(ready);
      setTimeout(installSpeculationRules, 220);
    }, { once: true });
  } else {
    ready();
    setTimeout(installSpeculationRules, 220);
  }

  window.MK97Navigation = window.StarkNavigation = Object.freeze({ navigate(url) { indicate(); location.assign(url); }, reset });
})();
