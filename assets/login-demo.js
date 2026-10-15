(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const W = window.StarkWorkspace;
    const requested = new URLSearchParams(location.search).get('return');
    const target = (requested && W?.destination) ? W.destination(requested) : 'workspace.html';
    const demo = document.getElementById('explore-demo');
    if (demo && W?.modeURL) {
      demo.href = W.modeURL('demo', target).href;
    }
    demo?.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (window.StarkWorkspace) {
        event.preventDefault();
        window.StarkWorkspace.navigateMode('demo', target);
      }
    });

    document.querySelectorAll('[data-password-toggle]').forEach(button => {
      if (button.dataset.passwordToggleReady === 'true') return;
      button.dataset.passwordToggleReady = 'true';
      button.onclick = () => {
        const input = button.closest('.auth-input-wrap')?.querySelector('input');
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        button.setAttribute('aria-pressed', String(show));
        input.focus();
      };
    });
  }, { once: true });
})();
