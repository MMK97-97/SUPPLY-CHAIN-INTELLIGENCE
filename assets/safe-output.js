/* Render the legacy cloud analyst's untrusted report text with a narrow HTML allow-list. */
(function () {
  'use strict';
  function render(node, value) {
    const text = String(value ?? '');
    if (!window.marked?.parse || !window.DOMPurify?.sanitize) {
      node.textContent = text; node.style.whiteSpace = 'pre-wrap'; return;
    }
    const clean = window.DOMPurify.sanitize(window.marked.parse(text), {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'],
      ALLOWED_ATTR: ['href', 'title', 'colspan', 'rowspan'],
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false
    });
    node.style.whiteSpace = '';
    node.innerHTML = clean;
    node.querySelectorAll('a[href]').forEach(link => {
      try {
        const url = new URL(link.getAttribute('href'), location.href);
        if (!/^https?:$/.test(url.protocol)) { link.removeAttribute('href'); return; }
        link.rel = 'noopener noreferrer';
        if (url.origin !== location.origin) link.target = '_blank';
      } catch (_) { link.removeAttribute('href'); }
    });
  }
  window.StarkSafeOutput = Object.freeze({ render });
})();
