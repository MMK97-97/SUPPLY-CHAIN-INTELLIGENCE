/* Regional tab state; shared page-navigation.js owns navigation feedback. */
(function () {
  "use strict";
  if (window.__starkInventoryTransitionsLoaded) return;
  window.__starkInventoryTransitionsLoaded = true;
  function currentPageKey() {
    const bodyPage = document.body && document.body.dataset.page;
    if (bodyPage) return bodyPage;
    const filename = window.location.pathname.split("/").pop() || "";
    if (filename.includes("dashboard")) return "dashboard";
    if (filename.includes("decision-intelligence")) return "decision";
    if (filename.includes("raw-report")) return "raw";
    if (filename.includes("reorder-report")) return "reorder";
    if (filename.includes("active-brands")) return "brands";
    if (filename.includes("instructions")) return "instructions";
    if (filename.includes("ats")) return "ats";
    return "";
  }

  function normalizeActiveTab() {
    const page = currentPageKey();
    if (!page) return;
    document.querySelectorAll(".inventory-nav [data-inventory-page]").forEach(function (link) {
      const active = link.dataset.inventoryPage === page;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  window.addEventListener("pageshow", normalizeActiveTab);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", normalizeActiveTab, { once: true });
  else normalizeActiveTab();
})();
