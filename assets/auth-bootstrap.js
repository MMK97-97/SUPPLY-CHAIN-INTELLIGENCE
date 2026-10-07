(() => {
  "use strict";

  if (window.__STARK_AUTH_BOOTSTRAPPED__) return;
  window.__STARK_AUTH_BOOTSTRAPPED__ = true;

  const root = document.documentElement;
  const isPublicPage = root.dataset.authPublic === "true";
  const scriptUrl = document.currentScript?.src || new URL("assets/auth-bootstrap.js", location.href).href;
  const assetUrl = file => new URL(file, scriptUrl).href;
  // Prevent native form navigation while the client is starting, including Enter.
  // The authenticated form handlers still receive and process the submit event.
  document.addEventListener("submit", event => {
    if (!event.target.matches?.("#login-form, #password-form")) return;
    event.preventDefault();
    if (root.dataset.authReady !== "true") {
      const node = document.getElementById("auth-message");
      if (node) { node.textContent = root.classList.contains("stark-auth-failed") ? "Secure sign in is unavailable. Reload this page to try again." : "Secure sign in is still loading. Please wait or reload the page."; node.hidden = false; }
    }
  }, true);

  if (!isPublicPage) {
    root.classList.add("stark-auth-pending");
    const style = document.createElement("style");
    style.id = "stark-auth-gate-style";
    style.textContent = `
      html.stark-auth-pending body{visibility:hidden!important}
      html.stark-auth-failed body{visibility:visible!important}
      html.stark-auth-failed body>*:not(.stark-auth-fatal){visibility:hidden!important}
      .stark-auth-fatal{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:28px;background:#eef6f9;font-family:DM Sans,Arial,sans-serif;color:#102c53}
      .stark-auth-fatal>div{width:min(520px,100%);padding:28px;border:1px solid #bfd6e2;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(9,50,78,.18)}
      .stark-auth-fatal h1{margin:0 0 10px;font-size:1.35rem}.stark-auth-fatal p{margin:0;color:#60758c;line-height:1.55}.stark-auth-fatal a{display:inline-flex;margin-top:18px;padding:11px 16px;border-radius:9px;color:#fff;background:#087f78;text-decoration:none;font-weight:800}`;
    document.head.appendChild(style);
  }

  const loadScript = (src, test) => new Promise((resolve, reject) => {
    if (test?.()) return resolve();
    const prior = Array.from(document.scripts).find(node => node.src === src);
    if (prior) {
      prior.addEventListener("load", resolve, { once: true });
      prior.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  const showFailure = message => {
    if (root.classList.contains("stark-auth-failed")) return;
    root.classList.remove("stark-auth-pending");
    root.classList.add("stark-auth-failed");
    if (isPublicPage) {
      const mount = () => {
        const messageNode = document.getElementById("auth-message");
        if (messageNode) {
          messageNode.textContent = message || "Secure sign in could not be initialized. Reload the page.";
          messageNode.hidden = false;
          messageNode.classList.add("error");
          messageNode.setAttribute("role", "alert");
        }
      };
      if (document.body) mount();
      else document.addEventListener("DOMContentLoaded", mount, { once: true });
      return;
    }
    const panel = document.createElement("div");
    panel.className = "stark-auth-fatal";
    panel.setAttribute("role", "alert");
    panel.innerHTML = `<div><h1>Secure connection unavailable</h1><p>${String(message || "Authentication could not be initialized.").replace(/[&<>\"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[character]))}</p><a href="login.html">Return to secure sign in</a></div>`;
    const mount = () => document.body?.appendChild(panel);
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
  };

  Promise.all([
      loadScript(assetUrl("supabase-config.js?v=20261007-1"), () => Boolean(window.STARK_SUPABASE_CONFIG)),
      loadScript(assetUrl("vendor/supabase-2.117.3.min.js"), () => Boolean(window.supabase?.createClient))
    ])
    .then(() => loadScript(assetUrl("supabase-auth.js?v=20261007-1"), () => Boolean(window.StarkAuth)))
    .catch(error => showFailure(error.message));

  window.setTimeout(() => {
    if (!window.StarkAuth || root.classList.contains("stark-auth-pending") || (isPublicPage && root.dataset.authReady !== "true")) showFailure("The authentication service did not respond. Check the network connection and reload the page.");
  }, 20000);
})();
