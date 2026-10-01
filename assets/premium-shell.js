(() => {
  "use strict";

  const body = document.body;
  if (!body) return;

  /* Load STARK Copilot AI Agent early so it is available across all pages */
  const loadAiCopilot = () => {
    if (!document.querySelector('link[data-ai-copilot-style]')) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = "assets/mk-brain.css?v=20261001-1";
      style.dataset.aiCopilotStyle = "true";
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-ai-copilot-script]')) {
      const script = document.createElement("script");
      script.src = "assets/mk-brain.js?v=20261001-2";
      script.defer = true;
      script.dataset.aiCopilotScript = "true";
      document.head.appendChild(script);
    }
  };
  loadAiCopilot();

  if (body.querySelector(".tv-app") || document.documentElement.dataset.route) return;

  const requestedPath = location.pathname.split("/").filter(Boolean).pop() || "index.html";
  const path = requestedPath === "index"
    ? "index.html"
    : requestedPath.includes(".")
      ? requestedPath
      : `${requestedPath}.html`;
  if (path === "index.html") return;
  const suffixMatch = path.match(/-(us|eu|ca)\.html$/i);
  const queryRegion = new URLSearchParams(location.search).get("region") || new URLSearchParams(location.search).get("workspace");
  const storedRegion = localStorage.getItem("stark-selected-region");
  const region = suffixMatch
    ? suffixMatch[1].toLowerCase()
    : String(queryRegion || storedRegion || "US").toLowerCase().replace("canada", "ca");

  const normalizeRegionCode = value => {
    const normalized = String(value || "").trim().toUpperCase();
    return normalized === "EU" ? "EU" : normalized === "CA" || normalized === "CANADA" ? "CA" : "US";
  };
  const regionCode = normalizeRegionCode(region);

  const REGION_META = {
    US: { name: "United States", flag: "🇺🇸", slug: "us" },
    EU: { name: "European Union", flag: "🇪🇺", slug: "eu" },
    CA: { name: "Canada", flag: "🇨🇦", slug: "ca" }
  };

  if (suffixMatch || queryRegion) {
    try { localStorage.setItem("stark-selected-region", regionCode); } catch (_) {}
  }

  /* Restore sidebar collapse preference immediately */
  const storedSidebar = localStorage.getItem("stark-sidebar-collapsed");
  const isSidebarCollapsed = storedSidebar === "true";
  if (isSidebarCollapsed) {
    body.classList.add("sidebar-collapsed");
    document.documentElement.classList.add("sidebar-collapsed");
  }

  /* Copilot always starts closed and opens as an overlay so page width stays stable. */
  body.classList.remove("copilot-docked", "copilot-modal-open");
  try { localStorage.removeItem("stark-copilot-docked"); } catch (_) {}

  const icon = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const icons = {
    dashboard: icon('<path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-4H4zM14 8h6V4h-6z"/>'),
    analysis: icon('<path d="M4 19V9M10 19V5M16 19v-7M3 19h18"/><path d="m14 9 3-3 3 3"/>'),
    decision: icon('<path d="M9 4a3 3 0 0 1 6 0 3 3 0 0 1 3 5 3 3 0 0 1-1 5v3a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3v-3a3 3 0 0 1-1-5 3 3 0 0 1 3-5Z"/><path d="M9 9h6M10 13h4M12 4v16"/>'),
    raw: icon('<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h8"/>'),
    reorder: icon('<path d="M4 7h16M4 12h16M4 17h10"/><path d="m17 15 3 3-3 3"/>'),
    brands: icon('<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/>'),
    ats: icon('<path d="M5 4h14v16H5zM8 8h8M8 12h5M8 16h4"/><path d="m15 15 2 2 3-4"/>'),
    sales: icon('<path d="M4 19V9M10 19V5M16 19v-7M3 19h18"/><path d="m15 7 3-3 3 3"/>'),
    events: icon('<path d="M5 5h14v15H5zM8 3v4M16 3v4M5 10h14"/><path d="m9 15 2 2 4-4"/>'),
    freight: icon('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>'),
    consolidate: icon('<path d="M4 5h6v6H4zM14 5h6v6h-6zM9 16h6v4H9zM7 11v2.5h10V11M12 13.5V16"/>'),
    tracking: icon('<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>'),
    instructions: icon('<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>'),
    ai: icon('<path d="M12 2a2 2 0 0 1 2 2v1h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v4a2 2 0 0 1-2 2h-4v1a2 2 0 0 1-4 0v-1H5a2 2 0 0 1-2-2v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4V4a2 2 0 0 1 2-2zM9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-6 5a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2H9z"/>')
  };

  const inventoryPages = new Set([
    "inventory-dashboard-us.html", "inventory-dashboard-eu.html", "inventory-dashboard-ca.html",
    "inventory-analysis-report-us.html", "inventory-analysis-report-eu.html", "inventory-analysis-report-ca.html",
    "decision-intelligence-us.html", "decision-intelligence-eu.html", "decision-intelligence-ca.html",
    "raw-report-us.html", "raw-report-eu.html", "raw-report-ca.html",
    "reorder-report-us.html", "reorder-report-eu.html", "reorder-report-ca.html",
    "active-brands-us.html", "active-brands-eu.html", "active-brands-ca.html",
    "instructions-us.html", "instructions-eu.html", "instructions-ca.html", "ats-eu.html"
  ]);

  const supported = inventoryPages.has(path) || [
    "sales-analysis.html", "events.html", "freight-estimator.html", "freight-consolidate.html", "shipment-tracking.html", "inventory-dashboard.html", "raw-report.html", "reorder-report.html", "active-brands.html", "instructions.html", "inventory.html"
  ].includes(path);
  if (!supported) return;

  /* Note: Floating export excel button completely removed per user request */

  const loadSharedAsset = file => {
    if (document.querySelector(`script[data-shared-asset="${file}"]`)) return;
    const script = document.createElement("script");
    script.src = `assets/${file}?v=20260930-3`;
    script.async = false;
    script.dataset.sharedAsset = file;
    document.head.appendChild(script);
  };
  loadSharedAsset("production-runtime.js");
  loadSharedAsset("report-export.js");

  const activeKey = path.startsWith("inventory-dashboard") ? "dashboard"
    : path.startsWith("inventory-analysis-report") ? "analysis"
    : path.startsWith("decision-intelligence") ? "decision"
    : path.startsWith("raw-report") ? "raw"
      : path.startsWith("reorder-report") ? "reorder"
        : path.startsWith("active-brands") ? "brands"
          : path === "ats-eu.html" ? "ats"
            : path.startsWith("instructions") ? "instructions"
            : path === "sales-analysis.html" ? "sales"
              : path === "events.html" ? "events"
                : path === "freight-consolidate.html" ? "consolidate"
                  : path === "freight-estimator.html" ? "freight"
                    : path === "shipment-tracking.html" ? "tracking"
                      : "";

  const navLink = ([key, label, href, glyph], submenu = false) =>
    `<a href="${href}" data-premium-nav="${key}" title="${label}" class="${submenu ? "premium-nav-subitem " : ""}${key === activeKey ? "active" : ""}" ${key === activeKey ? 'aria-current="page"' : ""}>${glyph}<span>${label}</span></a>`;

  /* Helper to convert current page to target region */
  const resolveRegionalUrl = targetCode => {
    const targetSlug = targetCode.toLowerCase();
    if (suffixMatch) {
      return path.replace(/-(us|eu|ca)\.html$/i, `-${targetSlug}.html`);
    }
    if (path === "sales-analysis.html") {
      return `sales-analysis.html?region=${targetCode}`;
    }
    if (path === "events.html") {
      return `events.html?region=${targetCode}`;
    }
    if (path.startsWith("inventory-dashboard")) {
      return `inventory-dashboard-${targetSlug}.html`;
    }
    if (path.startsWith("raw-report")) {
      return `raw-report-${targetSlug}.html`;
    }
    if (path.startsWith("reorder-report")) {
      return `reorder-report-${targetSlug}.html`;
    }
    if (path.startsWith("active-brands")) {
      return `active-brands-${targetSlug}.html`;
    }
    if (path.startsWith("decision-intelligence")) {
      return `decision-intelligence-${targetSlug}.html`;
    }
    if (path.startsWith("inventory-analysis-report")) {
      return `inventory-analysis-report-${targetSlug}.html`;
    }
    if (path.startsWith("instructions")) {
      return `instructions-${targetSlug}.html`;
    }
    return `inventory-dashboard-${targetSlug}.html`;
  };

  /* -------------------------------------------------------------
     1. LEFT SIDEBAR (TOGGLE BAR)
     ------------------------------------------------------------- */
  const rail = document.createElement("aside");
  rail.className = "premium-side-rail";
  rail.id = "app-sidebar";
  rail.setAttribute("aria-label", "Primary workspace navigation");

  let currentRegionCode = "";
  const renderRail = value => {
    const nextRegionCode = normalizeRegionCode(value);
    const meta = REGION_META[nextRegionCode] || REGION_META.US;
    const regionSlug = meta.slug;
    const regional = name => `${name}-${regionSlug}.html`;

    const inventoryItems = [
      ["dashboard", "Inventory Dashboard", regional("inventory-dashboard"), icons.dashboard],
      ["analysis", "Analysis Report", regional("inventory-analysis-report"), icons.analysis],
      ["decision", "Decision Intelligence", regional("decision-intelligence"), icons.decision],
      ["raw", "Raw Report", regional("raw-report"), icons.raw],
      ["reorder", "Reorder Report", regional("reorder-report"), icons.reorder],
      ["brands", "Active Brands", regional("active-brands"), icons.brands],
      ...(nextRegionCode === "EU" ? [["ats", "ATS", "ats-eu.html", icons.ats]] : []),
      ["instructions", "Instructions", regional("instructions"), icons.instructions]
    ];

    const primaryItems = [
      ["sales", "Sales Analysis", `sales-analysis.html?region=${nextRegionCode}`, icons.sales],
      ["events", "Events", `events.html?region=${nextRegionCode}`, icons.events],
      ["freight", "Freight Estimator", "freight-estimator.html", icons.freight],
      ["consolidate", "Freight Consolidate", "freight-consolidate.html", icons.consolidate],
      ["tracking", "Tracking", "shipment-tracking.html", icons.tracking]
    ];

    rail.innerHTML = `
      <div class="premium-rail-head">
        <a class="premium-rail-brand" href="index.html" aria-label="Stark Premium home" title="Stark Premium Home">
          <img src="assets/supply-chain-logo.png?v=20260918-2" alt="Stark Premium">
          <div class="premium-rail-brand-copy">
            <small>STARK PREMIUM</small>
            <strong>Supply Chain Intelligence</strong>
          </div>
        </a>
        <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" type="button" aria-label="Toggle sidebar collapse" title="Toggle sidebar">
          <svg viewBox="0 0 24 24" class="toggle-icon-svg" aria-hidden="true">
            <path d="m11 17 5-5-5-5M18 17l5-5-5-5"/>
          </svg>
        </button>
      </div>

      <div class="premium-rail-region-wrapper">
        <div class="premium-rail-region" id="sidebar-region-trigger" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" title="Switch regional workspace">
          <span class="region-badge-pill">${nextRegionCode}</span>
          <div class="region-copy">
            <small>REGIONAL WORKSPACE</small>
            <strong>${meta.name} <svg class="chevron-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></strong>
          </div>
        </div>
        <div class="sidebar-region-dropdown" id="sidebar-region-dropdown" hidden>
          <a href="${resolveRegionalUrl("US")}" class="sidebar-region-opt ${nextRegionCode === "US" ? "active" : ""}"><span>🇺🇸</span> <strong>United States (US)</strong></a>
          <a href="${resolveRegionalUrl("EU")}" class="sidebar-region-opt ${nextRegionCode === "EU" ? "active" : ""}"><span>🇪🇺</span> <strong>European Union (EU)</strong></a>
          <a href="${resolveRegionalUrl("CA")}" class="sidebar-region-opt ${nextRegionCode === "CA" ? "active" : ""}"><span>🇨🇦</span> <strong>Canada (CA)</strong></a>
        </div>
      </div>

      <nav>
        <section class="premium-nav-group" aria-label="Inventory analysis">
          <div class="premium-nav-parent" title="Inventory Analysis">
            ${icons.dashboard}
            <span>Inventory Analysis</span>
          </div>
          <div class="premium-nav-submenu">
            ${inventoryItems.map(item => navLink(item, true)).join("")}
          </div>
        </section>
        <div class="premium-nav-separator" aria-hidden="true"></div>
        ${primaryItems.map(item => navLink(item)).join("")}
      </nav>`;

    currentRegionCode = nextRegionCode;

    // Toggle button event
    rail.querySelector("#sidebar-toggle-btn")?.addEventListener("click", () => {
      const isCollapsedNow = body.classList.toggle("sidebar-collapsed");
      document.documentElement.classList.toggle("sidebar-collapsed", isCollapsedNow);
      try { localStorage.setItem("stark-sidebar-collapsed", String(isCollapsedNow)); } catch (_) {}
    });

    // Region dropdown trigger
    const regionTrigger = rail.querySelector("#sidebar-region-trigger");
    const regionDropdown = rail.querySelector("#sidebar-region-dropdown");
    if (regionTrigger && regionDropdown) {
      regionTrigger.addEventListener("click", e => {
        e.stopPropagation();
        const isCurrentlyOpen = !regionDropdown.hidden && !regionDropdown.hasAttribute("hidden");
        if (isCurrentlyOpen) {
          regionDropdown.hidden = true;
          regionDropdown.setAttribute("hidden", "");
          regionTrigger.setAttribute("aria-expanded", "false");
        } else {
          regionDropdown.hidden = false;
          regionDropdown.removeAttribute("hidden");
          regionTrigger.setAttribute("aria-expanded", "true");
        }
      });
      document.addEventListener("click", () => {
        regionDropdown.hidden = true;
        regionDropdown.setAttribute("hidden", "");
        regionTrigger.setAttribute("aria-expanded", "false");
      });
    }
  };
  renderRail(regionCode);

  window.addEventListener("stark:region-change", event => {
    const nextRegionCode = normalizeRegionCode(event.detail?.region);
    if (nextRegionCode !== currentRegionCode) {
      renderRail(nextRegionCode);
      renderTopbar(nextRegionCode);
    }
  });

  /* Mobile menu button */
  const toggle = document.createElement("button");
  toggle.className = "premium-rail-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open workspace navigation");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = '<span></span><span></span><span></span>';

  body.prepend(rail);
  body.prepend(toggle);

  const closeRail = () => {
    body.classList.remove("premium-rail-open");
    toggle.setAttribute("aria-expanded", "false");
  };
  toggle.addEventListener("click", () => {
    const open = body.classList.toggle("premium-rail-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  rail.addEventListener("click", event => {
    if (event.target.closest("a")) closeRail();
  });

  /* -------------------------------------------------------------
     2. TOP APPLICATION BAR
     ------------------------------------------------------------- */
  let topbar = document.getElementById("app-topbar");
  if (!topbar) {
    topbar = document.createElement("header");
    topbar.className = "app-topbar";
    topbar.id = "app-topbar";
    body.prepend(topbar);
  }

  const renderTopbar = value => {
    const nextRegionCode = normalizeRegionCode(value);
    const meta = REGION_META[nextRegionCode] || REGION_META.US;

    topbar.innerHTML = `
      <div class="topbar-actions">
        <div class="topbar-dropdown-wrap">
          <button class="topbar-icon-btn topbar-bell-btn" id="topbar-bell-btn" type="button" aria-label="Supply chain intelligence notifications" title="Supply Chain Alerts">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="topbar-badge-dot"></span>
          </button>
          <div class="topbar-dropdown topbar-notifications-menu" id="topbar-notifications-menu" hidden>
            <div class="notif-header">
              <strong>Intelligence Alerts</strong>
              <small>Live Signals • ${nextRegionCode}</small>
            </div>
            <div class="notif-list">
              <div class="notif-item notif-alert">
                <span class="notif-badge">STOCK</span>
                <div class="notif-text">
                  <strong>Critical Stock Warning</strong>
                  <p>Models reaching low thresholds in ${meta.name}. Review recommended reorders.</p>
                </div>
              </div>
              <div class="notif-item">
                <span class="notif-badge notif-badge-blue">TRADE</span>
                <div class="notif-text">
                  <strong>USTR &amp; WTO Regulatory Notice</strong>
                  <p>Import compliance and customs reporting rules updated for active trade corridors.</p>
                </div>
              </div>
              <div class="notif-item">
                <span class="notif-badge notif-badge-teal">PO</span>
                <div class="notif-text">
                  <strong>MK Intelligence Ready</strong>
                  <p>MK and the connected Supply AI engine are active for this workspace.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const bellBtn = topbar.querySelector("#topbar-bell-btn");
    const bellMenu = topbar.querySelector("#topbar-notifications-menu");
    if (bellBtn && bellMenu) {
      bellBtn.addEventListener("click", e => {
        e.stopPropagation();
        const isCurrentlyOpen = !bellMenu.hidden && !bellMenu.hasAttribute("hidden");
        topbar.querySelectorAll(".topbar-dropdown").forEach(d => {
          d.hidden = true;
          d.setAttribute("hidden", "");
        });
        if (!isCurrentlyOpen) {
          bellMenu.hidden = false;
          bellMenu.removeAttribute("hidden");
        }
      });
    }

    document.addEventListener("click", () => {
      topbar.querySelectorAll(".topbar-dropdown").forEach(d => {
        d.hidden = true;
        d.setAttribute("hidden", "");
      });
    });
  };
  renderTopbar(regionCode);

  /* -------------------------------------------------------------
     3. PAGE TRANSITIONS & NAVIGATION
     ------------------------------------------------------------- */
  let navigationInProgress = false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const resetTransitionState = () => {
    navigationInProgress = false;
    body.classList.remove("premium-content-leaving", "page-leaving", "inventory-fallback-leaving");
  };

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const link = target?.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || destination.protocol !== location.protocol) return;
    const sameDocument = destination.pathname === location.pathname && destination.search === location.search;
    if (sameDocument && destination.hash !== location.hash) return;
    if (destination.href === location.href || navigationInProgress) {
      if (destination.href === location.href) event.preventDefault();
      return;
    }
    event.preventDefault();
    navigationInProgress = true;
    closeRail();
    if (reducedMotion.matches) {
      location.assign(destination.href);
      return;
    }
    body.classList.add("premium-content-leaving");
    window.setTimeout(() => location.assign(destination.href), 135);
  }, true);

  window.addEventListener("pageshow", resetTransitionState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resetTransitionState();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeRail();
  });

  const syncIndexMode = () => {
    body.classList.add("premium-shell-active");
    if (path !== "index.html") return;

    const visibleRegion = document.documentElement.dataset.region
      || document.getElementById("module-region-pill")?.textContent
      || localStorage.getItem("stark-selected-region")
      || regionCode;
    const nextRegionCode = normalizeRegionCode(visibleRegion);
    if (nextRegionCode !== currentRegionCode) {
      renderRail(nextRegionCode);
      renderTopbar(nextRegionCode);
    }
  };
  syncIndexMode();

  if (path === "index.html") {
    const observer = new MutationObserver(syncIndexMode);
    [document.getElementById("module-screen"), document.getElementById("regional-app")].filter(Boolean).forEach(node =>
      observer.observe(node, { attributes: true, attributeFilter: ["class"] })
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-region"] });
  }
})();
