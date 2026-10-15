(() => {
  "use strict";

  if (window.__starkProductionRuntime) return;
  window.__starkProductionRuntime = true;

  const body = document.body;
  if (!body) return;
  let lastNoticeSignature = "";
  let lastNoticeAt = 0;

  const resetPageState = () => {
    body.classList.remove(
      "premium-content-leaving",
      "page-leaving",
      "inventory-fallback-leaving",
      "runtime-loading"
    );
    document.documentElement.classList.add("runtime-ready");
  };

  const announceRuntimeIssue = message => {
    const signature = String(message || "").trim();
    const now = Date.now();
    if (!signature || document.querySelector(".runtime-notice") || (signature === lastNoticeSignature && now - lastNoticeAt < 30000)) return;
    lastNoticeSignature = signature;
    lastNoticeAt = now;
    const notice = document.createElement("div");
    notice.className = "runtime-notice";
    notice.setAttribute("role", "alert");
    notice.innerHTML = `<strong>A page action needs attention.</strong><span>${signature}</span><button type="button" aria-label="Dismiss message">×</button>`;
    notice.querySelector("button").addEventListener("click", () => notice.remove());
    body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 9000);
  };

  window.addEventListener("pageshow", resetPageState);
  window.addEventListener("popstate", resetPageState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resetPageState();
  });

  window.addEventListener("error", event => {
    const source = String(event.filename || "");
    if (source && !source.startsWith(location.origin) && !source.startsWith("file:")) return;
    const message = String(event.error?.message || event.message || "").trim();
    if (isBenignRuntimeIssue(message)) return;
    console.error("Stark runtime error", event.error || event.message);
    announceRuntimeIssue(readableRuntimeMessage(message));
  });

  window.addEventListener("unhandledrejection", event => {
    const reason = event.reason;
    const message = String(reason?.message || (typeof reason === "string" ? reason : "")).trim();
    const stack = String(reason?.stack || "");
    if (isBenignRuntimeIssue(message)) return;
    /* Extension, browser and third-party promise rejections do not represent a
       failed dashboard action. Only surface errors traceable to this site. */
    if (!stack || (!stack.includes(location.origin) && !stack.includes("file:"))) {
      console.warn("Ignored external runtime rejection", reason);
      return;
    }
    console.error("Stark runtime rejection", reason);
    announceRuntimeIssue(readableRuntimeMessage(message));
  });

  function isBenignRuntimeIssue(message) {
    return !message || /abort(?:ed|error)?|cancel(?:led|ed)?|resizeobserver loop|the user aborted|load failed|networkerror|failed to fetch/i.test(message);
  }

  function readableRuntimeMessage(message) {
    const text = String(message || "").replace(/^uncaught\s+(?:error:\s*)?/i, "").trim();
    if (!text || text === "Script error.") return "The requested action did not finish. Please retry once.";
    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  }

  if ("scrollRestoration" in history) history.scrollRestoration = "auto";
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", resetPageState, { once: true });
  } else {
    resetPageState();
  }
})();
