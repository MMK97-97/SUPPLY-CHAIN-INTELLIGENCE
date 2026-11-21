(() => {
  "use strict";
  // Application data stays inside the selected workspace; auth storage is separate.
  const localStorage = window.StarkWorkspace?.localStorage || window.localStorage;
  const sessionStorage = window.StarkWorkspace?.sessionStorage || window.sessionStorage;
  const indexedDB = window.StarkWorkspace?.indexedDB || window.indexedDB;


  if (window.MKBrain) return;

  const PROFILE_KEY = "mk-supply-chain-brain-v1";
  const SYNC_CHANNEL = "stark-analytics-sync-v1";
  const SYNC_PULSE_KEY = "stark-analytics-sync-pulse";
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clean = value => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const normalize = value => clean(value).toUpperCase();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mean = values => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  const median = values => {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const deviation = values => {
    if (values.length < 2) return 0;
    const average = mean(values);
    return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
  };
  const hasValue = value => value !== null && value !== undefined && clean(value) !== "";
  const esc = value => String(value == null ? "" : value).replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
  const REGION_NAMES = { US: "United States", EU: "European Union", CA: "Canada" };
  const DB_CONFIG = {
    US: { name: "stark-regional-inventory", key: "US" },
    EU: { name: "stark-regional-inventory-eu", key: "EU" },
    CA: { name: "stark-regional-inventory-ca", key: "Canada" }
  };
  const DEFAULT_SETTINGS = { critical: 3, coverage: 1, delay: 15, a: 80, b: 95 };
  const ENGINE_VERSION = "MK Intelligence 7.0 · AI Analyst & Autonomous Co-Pilot";
  const LOCAL_ONLY_INTENTS = new Set(["voice", "space", "settings", "navigation", "export", "tracking", "learn", "help", "mk-power", "copilot"]);
  const SLASH_COMMANDS = [
    { cmd: "/brief", label: "Executive Briefing", desc: "Live ERP pulse across Orders, Stock, POs, 3PL, Mail & Tasks", run: "Show executive briefing" },
    { cmd: "/health", label: "ERP Health & Anomalies", desc: "0–100 Health Score, statistical Z-score spikes & risk radar", run: "Run ERP health score and anomaly detection" },
    { cmd: "/forecast", label: "Demand Forecast & EOQ", desc: "13-month trend forecast, ROP & Wilson EOQ across 1,885 SKUs", run: "Forecast portfolio demand across all SKUs" },
    { cmd: "/abc", label: "ABC-XYZ & Pareto 80/20", desc: "Revenue segmentation, demand volatility & HHI concentration", run: "Run ABC XYZ segmentation and Pareto analysis" },
    { cmd: "/margin", label: "Margin & Working Capital", desc: "Gross profit %, inventory capital & CRM credit exposure", run: "Analyze margin and working capital" },
    { cmd: "/brands", label: "Top Brands Intelligence", desc: "12-month revenue rankings & trends across 138 brands", run: "Analyze top brands revenue" },
    { cmd: "/customers", label: "Top Customers & Risk", desc: "131 commercial accounts, revenue share & credit alerts", run: "Analyze top customers and revenue concentration" },
    { cmd: "/compare", label: "Side-by-Side Comparison", desc: "Compare any two brands, customers, or vendor SLAs", template: "Compare Marc Jacobs vs Gucci" },
    { cmd: "/optimize", label: "3PL Fulfillment Optimizer", desc: "Find lowest-cost & highest-SLA node by SKU & state", template: "Optimize fulfillment for 25 WH1000XM5 to CA" },
    { cmd: "/autopilot", label: "Autonomous Fix Playbook", desc: "Preview & execute multi-step ERP remediation in 1 click", run: "Show autopilot remediation plan" },
    { cmd: "/tasks", label: "AI Task Priority Order", desc: "Rank all tasks by website-wide ERP impact score", run: "Prioritize & analyze my tasks" },
    { cmd: "/scan", label: "Autonomous Mail & ERP Scan", desc: "Auto-create PO/tracking tasks & clear resolved ones", run: "Scan mail and inventory for tasks" },
    { cmd: "/inventory", label: "Live Inventory & Low Stock", desc: "Safety-stock deficits, 3PL stock & valuation", run: "Check low stock and inventory value" },
    { cmd: "/orders", label: "Open Customer Orders", desc: "FIFO coverage, untracked orders & credit alerts", run: "Show all open customer orders" },
    { cmd: "/po", label: "Vendor SLAs & Open POs", desc: "Supplier scorecard, ETAs & arrived dock receipts", run: "Summarize vendor performance and open POs" },
    { cmd: "/3pl", label: "3PL & Warehouse Ops", desc: "Delayed shipments, putaway, waves & cycle counts", run: "Show 3PL delays and warehouse status" },
    { cmd: "/mail", label: "MK97 Mail Intelligence", desc: "Unread inbox & pending tracking requests", run: "Summarize unread mail and tracking requests" },
    { cmd: "/create-task", label: "Create & Assign Task", desc: "Create a multi-person task with live AI ranking", template: "Create task for PO-2026-887411 escalation with Elena and Marcus due tomorrow" },
    { cmd: "/order-po", label: "Issue Vendor PO", desc: "Place a covering Vendor PO & auto-resolve low stock", template: "Place a vendor PO for AF-200 for 45 units" },
    { cmd: "/receive-po", label: "Post Arrived Dock PO", desc: "Receive arrived dock PO stock into usable inventory", template: "Receive PO-2026-887411" },
    { cmd: "/provide-tracking", label: "Provide Tracking", desc: "Reply with tracking & auto-resolve tracking task", template: "Provide tracking DHL9988776 for #3PL-GP-918" },
    { cmd: "/email", label: "Draft Executive Email", desc: "Compose & send data-backed vendor/customer email", template: "Draft email to Kendra Scott about late PO delivery" },
    { cmd: "/remind", label: "Send Team Reminder", desc: "Notify everyone involved on a task via MK97 Mail", template: "Send reminder for #1" }
  ];
  const ROUTES = {
    "inventory dashboard": "inventory-dashboard", dashboard: "inventory-dashboard",
    "analysis report": "decision-intelligence", "inventory analysis": "decision-intelligence",
    "decision intelligence": "decision-intelligence", "decision brain": "decision-intelligence",
    "raw report": "raw-report", "reorder report": "reorder-report", reorder: "reorder-report",
    "active brands": "active-brands", brands: "active-brands", instructions: "instructions",
    "sales analysis": "sales-analysis.html", sales: "sales-analysis.html",
    events: "events.html", "freight estimator": "freight-estimator.html",
    "freight consolidate": "freight-consolidate.html", consolidate: "freight-consolidate.html",
    tracking: "shipment-tracking.html"
  };

  let profile = loadProfile();
  let panel;
  let launcher;
  let feed;
  let input;
  let stateNode;
  let voiceButton;
  let spaceButton;
  let badge;
  let pulseBar;
  let slashMenu;
  let slashIndex = 0;
  let lastAnalysis = null;
  let recognition = null;
  let syncChannel = null;
  let busy = false;
  let activeController = null;
  const conversation = { scope: "", lastIntent: "", lastItemKey: "", lastEntity: null, pendingEmail: null, lastQuestion: "", lastAnswer: "", turns: [] };
  let seedLoadPromise = null;

  function ensureAnalyticsSeed() {
    if (window.STARK_INVENTORY_ANALYSIS_SEED) return Promise.resolve(window.STARK_INVENTORY_ANALYSIS_SEED);
    if (seedLoadPromise) return seedLoadPromise;
    seedLoadPromise = new Promise(resolve => {
      try {
        const src = window.StarkSystem?.url
          ? window.StarkSystem.url("assets/inventory-analysis-seed.js?v=20261121-mk7")
          : "assets/inventory-analysis-seed.js?v=20261121-mk7";
        const sc = document.createElement("script");
        sc.src = src;
        sc.async = true;
        sc.onload = () => resolve(window.STARK_INVENTORY_ANALYSIS_SEED || null);
        sc.onerror = () => resolve(null);
        document.head.appendChild(sc);
      } catch (_) {
        resolve(null);
      }
    });
    return seedLoadPromise;
  }

  function getPageContextChip() {
    const p = (location.pathname || "").toLowerCase();
    if (p.includes("mail.html")) return { label: "✉ Audit Inbox", prompt: "Summarize unread mail and tracking requests" };
    if (p.includes("tasks.html")) return { label: "⚡ Autopilot", prompt: "Show autopilot remediation plan" };
    if (p.includes("order")) return { label: "💰 Order Margins", prompt: "Analyze margin and working capital" };
    if (p.includes("vendor") || p.includes("procurement")) return { label: "⚔ Vendor SLAs", prompt: "Compare vendors" };
    if (p.includes("3pl") || p.includes("warehouse") || p.includes("transport")) return { label: "🧭 3PL Optimizer", prompt: "Optimize fulfillment for 25 WH1000XM5 to CA" };
    if (p.includes("crm") || p.includes("sales")) return { label: "👥 Top Customers", prompt: "Analyze top customers and revenue concentration" };
    if (p.includes("inventory") || p.includes("reorder") || p.includes("item-master")) return { label: "📈 1.8K Forecast", prompt: "Forecast portfolio demand across all SKUs" };
    return { label: "🩺 Health Audit", prompt: "Run ERP health score and anomaly detection" };
  }

  if (document.readyState !== "complete") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  function init() {
    conversation.scope = window.MKAI?.getStatus().scope || regionCode();
    buildInterface();
    selectVoice();
    window.MKAI?.startMonitoring();
    window.speechSynthesis?.addEventListener?.("voiceschanged", selectVoice);

    window.MKBrain = {
      open: () => togglePanel(true),
      close: () => togglePanel(false),
      ask: question => execute(String(question || "")),
      analyze: () => execute("Analyze my current data"),
      getLastAnalysis: () => lastAnalysis,
      getProfile: () => ({ ...profile }),
      getAIStatus: () => window.MKAI?.getStatus(),
      getSpaceStatus: () => window.MKAI?.getStatus(),
      stop: () => activeController?.abort(),
      restoreConversation,
      setSpaceEnabled: enabled => setSpaceEnabled(Boolean(enabled), false),
      version: ENGINE_VERSION
    };
    restoreConversation();
    window.dispatchEvent(new CustomEvent("mk:ready"));
  }

  function loadProfile() {
    try {
      return {
        voiceEnabled: false,
        spaceEnabled: true,
        taskCounts: {},
        feedback: { useful: 0, correction: 0 },
        notes: [],
        lastAnalyzed: {},
        preferredVoice: "",
        ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}")
      };
    } catch (_) {
      return { voiceEnabled: false, spaceEnabled: true, taskCounts: {}, feedback: { useful: 0, correction: 0 }, notes: [], lastAnalyzed: {}, preferredVoice: "" };
    }
  }

  function saveProfile() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
  }

  function regionCode() {
    const selected = window.MKAI?.getStatus().scope;
    if (["US", "EU", "CA"].includes(selected)) return selected;
    const suffix = location.pathname.match(/-(us|eu|ca)\.html$/i)?.[1];
    const query = new URLSearchParams(location.search).get("region") || new URLSearchParams(location.search).get("workspace");
    const stored = localStorage.getItem("stark-selected-region");
    return normalizeRegion(suffix || query || stored || "US");
  }

  function regionKey(code = regionCode()) { return DB_CONFIG[code].key; }

  function renderPulseBar() {
    if (!pulseBar) return;
    const S = window.StarkSystem, Core = window.MKCopilotCore;
    if (!S || !Core?.getLivePulse) { pulseBar.hidden = true; return; }
    const mails = window.StarkTasks?.getMailThreads ? window.StarkTasks.getMailThreads() : (window.StarkMail?.getThreads ? window.StarkMail.getThreads() : []);
    const p = Core.getLivePulse(S.getState(), mails);
    const ctxChip = getPageContextChip();
    pulseBar.hidden = false;
    pulseBar.innerHTML = `
      <button type="button" class="mk-pulse-chip tone-ctx" data-pulse-prompt="${esc(ctxChip.prompt)}" title="Context-aware AI Analyst action">${esc(ctxChip.label)}</button>
      <button type="button" class="mk-pulse-chip tone-teal" data-pulse-prompt="Show executive briefing" title="Run full executive briefing">🌅 Brief</button>
      <button type="button" class="mk-pulse-chip ${p.criticalTasks ? 'tone-crit' : 'tone-info'}" data-pulse-prompt="Prioritize & analyze my tasks" title="View AI priority task queue">🎯 ${p.activeTasks} Tasks</button>
      <button type="button" class="mk-pulse-chip ${p.lowStockCount ? 'tone-warn' : 'tone-ok'}" data-pulse-prompt="Check low stock and reorder radar" title="Inspect low-stock alerts">📦 ${p.lowStockCount} Low</button>
      <button type="button" class="mk-pulse-chip ${p.delayedTplCount ? 'tone-crit' : 'tone-ok'}" data-pulse-prompt="Show 3PL delays and warehouse status" title="Inspect 3PL delays & warehouse">🚚 ${p.delayedTplCount} Delay</button>
      <button type="button" class="mk-pulse-chip ${p.pendingTrackingCount ? 'tone-warn' : 'tone-ok'}" data-pulse-prompt="Summarize unread mail and tracking requests" title="Inspect pending tracking emails">✉ ${p.pendingTrackingCount} Track</button>`;
    pulseBar.querySelectorAll('[data-pulse-prompt]').forEach(btn => {
      btn.onclick = () => execute(btn.dataset.pulsePrompt);
    });
    const urgentTotal = p.criticalTasks + p.lowStockCount + p.delayedTplCount;
    if (badge && !panel.classList.contains("open") && urgentTotal > 0) {
      badge.hidden = false;
      badge.textContent = String(Math.min(9, urgentTotal));
    }
  }

  function renderSlashMenu(filterText = "") {
    if (!slashMenu) return;
    const q = filterText.replace(/^\//, "").trim().toLowerCase();
    const matches = SLASH_COMMANDS.filter(item => !q || item.cmd.toLowerCase().includes(q) || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q));
    if (!matches.length) { slashMenu.hidden = true; return; }
    slashIndex = clamp(slashIndex, 0, matches.length - 1);
    slashMenu.hidden = false;
    slashMenu.innerHTML = `
      <div class="mk-slash-head"><span>⚡ MK Command Palette</span><small>↑↓ navigate · Enter select</small></div>
      <div class="mk-slash-list">
        ${matches.map((item, idx) => `
          <button type="button" class="mk-slash-item ${idx === slashIndex ? 'is-active' : ''}" data-slash-idx="${idx}">
            <span class="mk-slash-cmd">${esc(item.cmd)}</span>
            <span class="mk-slash-meta"><strong>${esc(item.label)}</strong><small>${esc(item.desc)}</small></span>
          </button>`).join('')}
      </div>`;
    slashMenu.querySelectorAll('.mk-slash-item').forEach(btn => {
      btn.onmousedown = e => {
        e.preventDefault();
        applySlashItem(matches[Number(btn.dataset.slashIdx)]);
      };
    });
  }

  function applySlashItem(item) {
    if (!item) return;
    if (slashMenu) slashMenu.hidden = true;
    if (item.run) {
      input.value = "";
      input.style.height = "auto";
      execute(item.run);
    } else if (item.template) {
      input.value = item.template;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function renderWelcomeView() {
    if (!feed) return;
    feed.innerHTML = `
      <div class="mk-copilot-welcome">
        <div class="mk-copilot-sparkle-circle">
          <svg viewBox="0 0 24 24">
            <defs>
              <linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#087f78" />
                <stop offset="50%" stop-color="#2563eb" />
                <stop offset="100%" stop-color="#7c3aed" />
              </linearGradient>
            </defs>
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="url(#sparkle-grad)" />
          </svg>
        </div>
        <h2>Hi, I'm MK ⚡</h2>
        <p>Executive Supply Chain Analyst &amp; Autonomous ERP Co-Pilot. Run statistical forecasts, margin &amp; anomaly audits, 3PL optimization, or execute live POs, emails &amp; autopilot fixes. Type <code>/</code> for 23 commands.</p>
      </div>
      <div class="mk-copilot-cards-list">
        <button type="button" class="mk-copilot-action-card" data-prompt="Run ERP health score and anomaly detection">
          <span class="mk-card-icon-wrap mk-card-icon-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </span>
          <span class="mk-card-text"><strong>ERP Health Score &amp; Anomaly Radar</strong><small>0–100 audit, Z-score spikes &amp; live bottlenecks</small></span>
          <span class="mk-card-chevron">&gt;</span>
        </button>
        <button type="button" class="mk-copilot-action-card" data-prompt="Forecast portfolio demand across all SKUs">
          <span class="mk-card-icon-wrap mk-card-icon-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          </span>
          <span class="mk-card-text"><strong>Demand Forecast &amp; EOQ (1,885 SKUs)</strong><small>13-mo trend chart, 90-day projection &amp; ROP</small></span>
          <span class="mk-card-chevron">&gt;</span>
        </button>
        <button type="button" class="mk-copilot-action-card" data-prompt="Analyze margin and working capital">
          <span class="mk-card-icon-wrap mk-card-icon-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </span>
          <span class="mk-card-text"><strong>Margin, Profit &amp; Working Capital</strong><small>Gross margin %, SKU capital &amp; credit exposure</small></span>
          <span class="mk-card-chevron">&gt;</span>
        </button>
        <button type="button" class="mk-copilot-action-card" data-prompt="Run ABC XYZ segmentation and Pareto analysis">
          <span class="mk-card-icon-wrap mk-card-icon-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </span>
          <span class="mk-card-text"><strong>ABC-XYZ Matrix &amp; Brand Pareto 80/20</strong><small>138 brands, 131 customers &amp; HHI risk index</small></span>
          <span class="mk-card-chevron">&gt;</span>
        </button>
        <button type="button" class="mk-copilot-action-card" data-prompt="Show autopilot remediation plan">
          <span class="mk-card-icon-wrap mk-card-icon-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </span>
          <span class="mk-card-text"><strong>Autonomous Fix Playbook (Autopilot)</strong><small>Issue POs, post dock receipts &amp; remind team</small></span>
          <span class="mk-card-chevron">&gt;</span>
        </button>
        <button type="button" class="mk-copilot-action-card" data-prompt="Prioritize &amp; analyze my tasks">
          <span class="mk-card-icon-wrap mk-card-icon-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </span>
          <span class="mk-card-text"><strong>Prioritize Tasks &amp; Mail Tracking</strong><small>AI-ranked order with linked POs &amp; 1-click reply</small></span>
          <span class="mk-card-chevron">&gt;</span>
        </button>
      </div>`;
    feed.querySelectorAll('[data-prompt]').forEach(card => {
      card.onclick = () => execute(card.dataset.prompt);
    });
  }

  function buildInterface() {
    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "mk-brain-launcher";
    launcher.setAttribute("aria-label", "Open MK AI Co-Pilot (Alt+M)");
    launcher.setAttribute("aria-expanded", "false");
    launcher.title = "Open MK AI Co-Pilot (Alt+M)";
    launcher.innerHTML = 'MK<span class="mk-badge" hidden>1</span>';
    badge = launcher.querySelector(".mk-badge");

    panel = document.createElement("section");
    panel.className = "mk-brain-panel";
    panel.setAttribute("aria-label", "MK AI Co-Pilot");
    panel.setAttribute("role", "region");
    panel.innerHTML = `
      <header class="mk-copilot-header-white">
        <div class="mk-avatar-badge mk-avatar-logo"><img src="${esc(safeHref("assets/mk97-logo.png?v=20261121-logo1") || "assets/mk97-logo.png?v=20261121-logo1")}" alt="MK97"></div>
        <div class="mk-header-titles">
          <h3>MK — AI Analyst &amp; Co-Pilot</h3>
          <div class="mk-status-line">
            <span class="dot"></span>
            <span>v7.0 · Analyst &amp; Autopilot</span>
          </div>
        </div>
        <div class="mk-header-controls">
          <button class="mk-header-control-btn mk-voice-toggle" type="button" aria-pressed="false" aria-label="Enable voice" title="Toggle voice output">🔊</button>
          <button class="mk-header-control-btn mk-minimize" type="button" aria-label="Minimize MK" title="Minimize">—</button>
          <button class="mk-header-control-btn mk-expand" type="button" aria-label="Expand MK" title="Expand / restore">⤢</button>
          <button class="mk-header-control-btn mk-close" type="button" aria-label="Close MK" title="Close (Esc)">✕</button>
        </div>
      </header>
      <div class="mk-pulse-bar" aria-label="Live ERP status signals"></div>
      <div class="mk-brain-state" style="display:none;"><b>${esc(REGION_NAMES[regionCode()])}</b><span>Autonomous ERP Command AI ready</span></div>
      <div class="mk-brain-feed" role="log" aria-live="polite"></div>
      <div class="mk-slash-menu" hidden role="listbox" aria-label="MK Slash Commands"></div>
      <form class="mk-brain-compose" style="padding: 10px 14px 4px 14px; background: #fff; border-top: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px;">
        <div class="mk-compose-pill" style="display: flex; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 4px 6px 4px 12px; flex: 1; gap: 4px;">
          <textarea rows="1" aria-label="Ask MK anything or type / for commands" placeholder="Ask MK or type / for commands..." style="border: none; background: transparent; resize: none; font-size: 13px; color: #1e293b; outline: none; flex: 1; padding: 6px 0; font-family: inherit;"></textarea>
          <button class="mk-mic mk-mic-inline" type="button" aria-label="Voice command" title="Speak a command">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          </button>
          <button class="mk-send" type="submit" aria-label="Send" style="width: 32px; height: 32px; border-radius: 50%; background: #0f4c47; border: none; color: #ffffff; display: grid; place-items: center; cursor: pointer; flex-shrink: 0;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <button class="mk-stop" type="button" hidden>Stop</button>
      </form>
      <div class="mk-copilot-bottom-actions">
        <button type="button" class="mk-copilot-sub-btn mk-cmd-trigger" id="mk-btn-commands" title="Browse slash commands (/)" aria-label="Slash commands" style="width:auto;min-width:max-content;height:30px;padding:0 11px;white-space:nowrap;flex:0 0 auto;">/ Commands</button>
        <button type="button" class="mk-copilot-sub-btn" id="mk-btn-paperclip" title="Attach file or report" aria-label="Attach file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <button type="button" class="mk-copilot-sub-btn" id="mk-btn-search" title="Executive Briefing" aria-label="Executive Briefing">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </button>
        <button type="button" class="mk-copilot-sub-btn" id="mk-btn-plus" title="New Co-Pilot session" aria-label="New session">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span class="mk-shortcut-hint">Alt+M</span>
      </div>`;

    const anchor = document.getElementById("mk-chat-anchor");
    if (anchor) { anchor.append(panel); panel.classList.add("mk-docked", "open"); launcher.hidden = true; }
    else { panel.inert = true; panel.setAttribute("aria-hidden", "true"); document.body.append(panel); }
    document.body.append(launcher);
    feed = panel.querySelector(".mk-brain-feed");
    input = panel.querySelector("textarea");
    stateNode = panel.querySelector(".mk-brain-state");
    pulseBar = panel.querySelector(".mk-pulse-bar");
    slashMenu = panel.querySelector(".mk-slash-menu");
    voiceButton = panel.querySelector(".mk-voice-toggle");
    spaceButton = panel.querySelector(".mk-space-toggle");
    syncVoiceUi();
    syncSpaceUi();

    renderWelcomeView();
    renderPulseBar();
    window.addEventListener("stark:system-change", renderPulseBar);
    window.addEventListener("mk97:mail-updated", renderPulseBar);
    launcher.addEventListener("click", () => togglePanel(!panel.classList.contains("open")));
    panel.querySelector(".mk-close").addEventListener("click", () => togglePanel(false));
    panel.querySelector(".mk-minimize")?.addEventListener("click", () => togglePanel(false));
    panel.querySelector(".mk-expand")?.addEventListener("click", () => panel.classList.toggle("expanded"));
    voiceButton?.addEventListener("click", toggleVoice);
    panel.querySelector("#mk-btn-commands")?.addEventListener("click", () => {
      if (slashMenu && !slashMenu.hidden) { slashMenu.hidden = true; return; }
      slashIndex = 0;
      renderSlashMenu("");
      input.focus();
    });
    panel.querySelector("#mk-btn-paperclip")?.addEventListener("click", () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".csv,.xlsx,.json";
      fileInput.onchange = e => {
        const file = e.target.files[0];
        if (file) execute(`Upload and analyze report: ${file.name}`);
      };
      fileInput.click();
    });
    panel.querySelector("#mk-btn-search")?.addEventListener("click", () => execute("Show executive briefing"));
    panel.querySelector("#mk-btn-plus")?.addEventListener("click", () => {
      resetConversation(window.MKAI?.getStatus().scope || regionCode());
      renderWelcomeView();
    });
    panel.querySelector(".mk-stop").addEventListener("click", () => activeController?.abort());
    window.addEventListener("mk:analyst-change", () => {
      syncSpaceUi();
      const selected = window.MKAI?.getStatus().scope || regionCode();
      if (selected === conversation.scope) return;
      activeController?.abort();
      resetConversation(selected); feed.innerHTML = ""; restoreConversation();
      if (!feed.children.length) renderWelcomeView();
    });
    window.addEventListener("mk:conversation-clear", () => { resetConversation(window.MKAI?.getStatus().scope || regionCode()); feed.innerHTML = ""; renderWelcomeView(); });
    panel.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      if (slashMenu) slashMenu.hidden = true;
      const question = input.value.trim();
      if (!question) return;
      input.value = "";
      input.style.height = "auto";
      execute(question);
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(112, input.scrollHeight)}px`;
      if (input.value.startsWith("/")) { slashIndex = 0; renderSlashMenu(input.value); }
      else if (slashMenu) slashMenu.hidden = true;
    });
    input.addEventListener("keydown", event => {
      if (slashMenu && !slashMenu.hidden) {
        const items = [...slashMenu.querySelectorAll(".mk-slash-item")];
        if (event.key === "ArrowDown") { event.preventDefault(); slashIndex = (slashIndex + 1) % Math.max(1, items.length); renderSlashMenu(input.value); return; }
        if (event.key === "ArrowUp") { event.preventDefault(); slashIndex = (slashIndex - 1 + Math.max(1, items.length)) % Math.max(1, items.length); renderSlashMenu(input.value); return; }
        if (event.key === "Escape") { event.preventDefault(); slashMenu.hidden = true; return; }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const q = input.value.replace(/^\//, "").trim().toLowerCase();
          const matches = SLASH_COMMANDS.filter(item => !q || item.cmd.toLowerCase().includes(q) || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q));
          if (matches[slashIndex]) { applySlashItem(matches[slashIndex]); return; }
        }
      }
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); panel.querySelector("form").requestSubmit(); }
    });
    panel.querySelectorAll("[data-mk-question]").forEach(button => button.addEventListener("click", () => execute(button.dataset.mkQuestion)));
    panel.querySelector(".mk-mic")?.addEventListener("click", toggleListening);
    document.addEventListener("keydown", event => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        togglePanel(!panel.classList.contains("open"));
        return;
      }
      if (event.key === "Escape" && panel.classList.contains("open") && !document.querySelector(".modal-backdrop,.sys-modal-backdrop,.op-modal-backdrop")) togglePanel(false);
    });
  }

  function togglePanel(open) {
    if (panel.classList.contains("mk-docked")) return;
    panel.inert = !open;
    panel.setAttribute("aria-hidden", String(!open));
    panel.classList.toggle("open", open);
    launcher.classList.toggle("is-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("mk-brain-open", open);
    window.dispatchEvent(new CustomEvent("mk:visibility-change",{detail:{open}}));
    if (open) {
      badge.hidden = true;
      window.setTimeout(() => input.focus(), 120);
    }
  }

  function setState(text, running = false) {
    stateNode.classList.toggle("is-running", running);
    const selected = window.MKAI?.getStatus().scope || regionCode();
    stateNode.innerHTML = `<b>${esc(selected === "ALL" ? "All regions" : REGION_NAMES[selected])}</b><span>${esc(text)}</span>`;
  }

  function safeHref(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^(?:javascript|data|vbscript):/i.test(raw)) return "";
    if (window.StarkSystem?.url && !/^https?:\/\//i.test(raw)) return window.StarkSystem.url(raw);
    return raw;
  }

  function renderAnalystChart(chart) {
    if (!chart || !chart.type) return "";
    if (chart.type === "bars" && Array.isArray(chart.items) && chart.items.length) {
      const maxVal = Math.max(...chart.items.map(it => Math.abs(finite(it.value))), 1);
      return `<div class="mk-chart-box">
        <div class="mk-chart-title"><span>${esc(chart.title || "Chart")}</span></div>
        <div class="mk-bar-list">${chart.items.map(it => {
          const pct = clamp(Math.round((Math.abs(finite(it.value)) / maxVal) * 100), 4, 100);
          return `<div class="mk-bar-row">
            <div class="mk-bar-head"><span class="mk-bar-label">${esc(it.label)}</span><span class="mk-bar-val">${esc(it.display ?? String(it.value))}</span></div>
            <div class="mk-bar-track"><div class="mk-bar-fill tone-${esc(it.tone || "teal")}" style="width:${pct}%"></div></div>
          </div>`;
        }).join("")}</div>
      </div>`;
    }
    if (chart.type === "stacked" && Array.isArray(chart.segments) && chart.segments.length) {
      return `<div class="mk-chart-box">
        <div class="mk-chart-title"><span>${esc(chart.title || "Distribution")}</span></div>
        <div class="mk-stack-bar">${chart.segments.map(seg => `<div class="mk-stack-seg" style="width:${clamp(finite(seg.pct), 2, 100)}%;background:${esc(seg.color || "#087f78")}" title="${esc(seg.label)}"></div>`).join("")}</div>
        <div class="mk-stack-legend">${chart.segments.map(seg => `<span class="mk-stack-item"><span class="mk-stack-dot" style="background:${esc(seg.color || "#087f78")}"></span>${esc(seg.label)}</span>`).join("")}</div>
      </div>`;
    }
    if (chart.type === "sparkline" && Array.isArray(chart.actual) && chart.actual.length >= 2) {
      const actual = chart.actual.map(finite);
      const forecast = Array.isArray(chart.forecast) ? chart.forecast.map(finite) : [];
      const all = [...actual, ...forecast];
      const maxV = Math.max(...all, 1);
      const minV = Math.min(...all, 0);
      const span = Math.max(1, maxV - minV);
      const W = 560, H = 128, padX = 12, padY = 14;
      const stepX = (W - padX * 2) / Math.max(1, all.length - 1);
      const ptY = v => Math.round((H - padY - ((v - minV) / span) * (H - padY * 2)) * 10) / 10;
      const ptX = i => Math.round((padX + i * stepX) * 10) / 10;
      const actPts = actual.map((v, i) => `${ptX(i)},${ptY(v)}`).join(" ");
      const areaPts = `${ptX(0)},${H - padY} ${actPts} ${ptX(actual.length - 1)},${H - padY}`;
      const fcPts = forecast.length
        ? [`${ptX(actual.length - 1)},${ptY(actual[actual.length - 1])}`, ...forecast.map((v, j) => `${ptX(actual.length + j)},${ptY(v)}`)].join(" ")
        : "";
      const labels = Array.isArray(chart.labels) && chart.labels.length ? chart.labels : all.map((_, i) => `P${i + 1}`);
      const fmtVal = v => chart.unit === "$"
        ? (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${Math.round(v)}`)
        : `${Math.round(v).toLocaleString()}${chart.unit || ""}`;
      const peakIdx = all.indexOf(maxV);
      return `<div class="mk-chart-box">
        <div class="mk-chart-title">
          <span>${esc(chart.title || "Trend")}</span>
          <span class="mk-chart-legend"><span><i style="background:#087f78"></i>Actual</span>${forecast.length ? `<span><i style="background:#6366f1"></i>Forecast</span>` : ""}</span>
        </div>
        <svg class="mk-spark-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(chart.title || "Trend chart")}">
          <line x1="${padX}" y1="${padY}" x2="${W - padX}" y2="${padY}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4"/>
          <line x1="${padX}" y1="${Math.round(H / 2)}" x2="${W - padX}" y2="${Math.round(H / 2)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4"/>
          <line x1="${padX}" y1="${H - padY}" x2="${W - padX}" y2="${H - padY}" stroke="#cbd5e1" stroke-width="1"/>
          <polygon points="${areaPts}" fill="rgba(8, 127, 120, 0.13)"/>
          <polyline points="${actPts}" fill="none" stroke="#087f78" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          ${fcPts ? `<polyline points="${fcPts}" fill="none" stroke="#6366f1" stroke-width="2.6" stroke-dasharray="6 4" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
          ${actual.map((v, i) => `<circle cx="${ptX(i)}" cy="${ptY(v)}" r="${i === peakIdx ? 4.8 : 3.2}" fill="${i === peakIdx ? "#0f4c47" : "#087f78"}"><title>${esc(labels[i] || "")}: ${esc(fmtVal(v))}</title></circle>`).join("")}
          ${forecast.map((v, j) => `<circle cx="${ptX(actual.length + j)}" cy="${ptY(v)}" r="3.8" fill="#6366f1"><title>${esc(labels[actual.length + j] || "")}: ${esc(fmtVal(v))} (Forecast)</title></circle>`).join("")}
        </svg>
        <div class="mk-spark-axis"><span>${esc(labels[0] || "")}</span><span>Peak: ${esc(fmtVal(maxV))} (${esc(labels[peakIdx] || "")})</span><span>${esc(labels[labels.length - 1] || "")}</span></div>
      </div>`;
    }
    return "";
  }

  function renderAnalystTable(table) {
    if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows) || !table.rows.length) return "";
    return `<div class="mk-data-table-box">
      ${table.title ? `<div class="mk-data-table-title">${esc(table.title)}</div>` : ""}
      <div class="mk-data-table-wrap">
        <table class="mk-data-table">
          <thead><tr>${table.columns.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>
          <tbody>${table.rows.map(r => `<tr>${r.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </div>`;
  }

  function downloadCsvFile(csvObj) {
    if (!csvObj?.content) return;
    try {
      const blob = new Blob([csvObj.content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = csvObj.filename || "mk97-analyst-report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (_) {}
  }

  function addEntry(message, role = "brain", speak = true, category = "answer", result = null, meta = null) {
    const welcome = feed.querySelector(".mk-copilot-welcome");
    if (welcome) feed.innerHTML = "";
    const entry = document.createElement("div");
    entry.className = `mk-entry ${role === "user" ? "user" : "brain"}`;

    const metricsHtml = role === "brain" && Array.isArray(meta?.metrics) && meta.metrics.length
      ? `<div class="mk-metrics-strip">${meta.metrics.map(m => `<div class="mk-metric-pill tone-${esc(m.tone || "info")}"><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join("")}</div>`
      : "";

    const chartHtml = role === "brain" && meta?.chart ? renderAnalystChart(meta.chart) : "";
    const tableHtml = role === "brain" && meta?.table ? renderAnalystTable(meta.table) : "";

    const exportBarHtml = role === "brain" && (meta?.csv || (meta?.metrics && meta.metrics.length))
      ? `<div class="mk-export-bar">${meta?.csv ? `<button type="button" class="mk-util-btn mk-btn-csv">⬇ Export CSV</button>` : ""}<button type="button" class="mk-util-btn mk-btn-copy">📋 Copy Memo</button></div>`
      : "";

    const actionsHtml = role === "brain" && Array.isArray(meta?.actions) && meta.actions.length
      ? `<div class="mk-action-row">${meta.actions.map((a, idx) => a.href
          ? `<a class="mk-act-btn style-${esc(a.style || "ghost")}" href="${esc(safeHref(a.href))}">${esc(a.label)}</a>`
          : `<button type="button" class="mk-act-btn style-${esc(a.style || "teal")}" data-mk-exec-idx="${idx}">${esc(a.label)}</button>`).join("")}</div>`
      : "";

    const followUpsHtml = role === "brain" && Array.isArray(meta?.followUps) && meta.followUps.length
      ? `<div class="mk-followup-row">${meta.followUps.slice(0, 3).map(f => `<button type="button" class="mk-followup-chip" data-mk-followup="${esc(f)}">${esc(f)}</button>`).join("")}</div>`
      : "";

    const controls = role === "brain" ? `<div class="mk-feedback"><button type="button" data-feedback="useful">Useful</button><button type="button" data-feedback="correction">Needs correction</button></div>` : "";
    entry.innerHTML = `<div class="mk-entry-card"><div class="mk-entry-meta">${role === "user" ? "You" : "MK • " + esc(category)}</div>${metricsHtml}<div class="mk-entry-body">${formatMessage(message)}</div>${chartHtml}${tableHtml}${exportBarHtml}${actionsHtml}${followUpsHtml}${controls}</div>`;
    if (result) window.MKAI?.renderResult(entry.querySelector(".mk-entry-card"), result);
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight;

    entry.querySelector(".mk-btn-csv")?.addEventListener("click", e => {
      downloadCsvFile(meta.csv);
      e.currentTarget.classList.add("is-done");
      e.currentTarget.textContent = "✓ CSV Downloaded";
    });
    entry.querySelector(".mk-btn-copy")?.addEventListener("click", async e => {
      const btn = e.currentTarget;
      const plain = String(message || "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
      try { await navigator.clipboard.writeText(plain); } catch (_) {}
      btn.classList.add("is-done");
      btn.textContent = "✓ Copied";
      window.setTimeout(() => { btn.classList.remove("is-done"); btn.textContent = "📋 Copy Memo"; }, 1800);
    });
    entry.querySelectorAll("[data-feedback]").forEach(button => button.addEventListener("click", () => recordFeedback(button, category)));
    entry.querySelectorAll("[data-mk-exec-idx]").forEach(btn => {
      const act = meta.actions[Number(btn.dataset.mkExecIdx)];
      btn.addEventListener("click", () => {
        if (!act) return;
        if (typeof act.onClick === "function") act.onClick();
        else if (act.prompt) execute(act.prompt);
      });
    });
    entry.querySelectorAll("[data-mk-followup]").forEach(btn => {
      btn.addEventListener("click", () => execute(btn.dataset.mkFollowup));
    });

    if (role === "brain" && speak && profile.voiceEnabled) speakText(message);
    if (role === "brain" && !panel.classList.contains("open")) { badge.hidden = false; badge.textContent = "1"; }
    return entry;
  }

  function formatMessage(message) {
    return esc(message)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
        const href = safeHref(url);
        return href ? `<a class="mk-inline-link" href="${esc(href)}">${label}</a>` : label;
      })
      .replace(/`([^`]+)`/g, '<code class="mk-inline-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)<]|$)/g, "$1<em>$2</em>")
      .replace(/\n/g, "<br>");
  }

  function recordFeedback(button, category) {
    const kind = button.dataset.feedback;
    profile.feedback = profile.feedback || { useful: 0, correction: 0 };
    profile.feedback[kind] = finite(profile.feedback[kind]) + 1;
    profile.lastFeedbackCategory = category;
    saveProfile();
    button.parentElement.querySelectorAll("button").forEach(node => node.classList.toggle("selected", node === button));
    if (kind === "correction") {
      input.value = "Correction: ";
      input.focus();
    }
  }

  function learnTask(intent) {
    profile.taskCounts = profile.taskCounts || {};
    profile.taskCounts[intent] = finite(profile.taskCounts[intent]) + 1;
    profile.lastIntent = intent;
    profile.lastRegion = regionCode();
    saveProfile();
  }

  function toggleVoice() {
    profile.voiceEnabled = !profile.voiceEnabled;
    saveProfile();
    syncVoiceUi();
    if (!profile.voiceEnabled) window.speechSynthesis?.cancel();
    addEntry(profile.voiceEnabled ? "Voice enabled. I’ll use the best available English male-style system voice." : "Voice disabled. I’ll continue responding silently.", "brain", profile.voiceEnabled, "voice");
  }

  function syncVoiceUi() {
    if (!voiceButton) return;
    voiceButton.setAttribute("aria-pressed", String(Boolean(profile.voiceEnabled)));
    voiceButton.setAttribute("aria-label", profile.voiceEnabled ? "Disable voice" : "Enable voice");
    voiceButton.title = profile.voiceEnabled ? "Voice on" : "Voice off";
  }

  function setSpaceEnabled(enabled, announce = true) {
    window.MKAI?.configure({ aiEnabled: enabled });
    syncSpaceUi();
    const message = enabled ? "AI analysis enabled. Questions, recent conversation, remembered notes and selected report facts will use your Hugging Face Supply AI Chain Hub. Verified local analysis remains available if the Space cannot answer. Open the analyst workspace to test availability or choose Fast, Auto or Deep mode." : "AI analysis disabled. MK will use verified local analysis.";
    if (announce) addEntry(message, "brain", false, "AI connection");
    return { intent: "space", category: "AI connection", message };
  }
  function syncSpaceUi() {
    if (!spaceButton) return;
    const ai = window.MKAI?.getStatus() || { aiEnabled: false, mode: 'local', message: 'Local analyst ready' };
    spaceButton.dataset.state = ai.mode === 'ai' ? 'ready' : ai.mode === 'error' ? 'offline' : 'disabled';
    spaceButton.setAttribute('aria-pressed', String(ai.aiEnabled));
    spaceButton.setAttribute('aria-label', ai.aiEnabled ? 'Disable AI analysis' : 'Enable AI analysis');
    spaceButton.title = ai.message;
    if (badge && ai.unread && !panel.classList.contains('open')) { badge.hidden = false; badge.textContent = String(ai.unread); }
    if (stateNode && !busy) setState(ai.message);
  }

  function selectVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (!voices.length) return null;
    const preferredNames = ["Microsoft Guy", "Microsoft David", "Google UK English Male", "Daniel", "Alex", "George", "Mark", "Guy"];
    const saved = voices.find(voice => voice.name === profile.preferredVoice);
    const selected = saved || preferredNames.map(name => voices.find(voice => voice.name.includes(name))).find(Boolean) || voices.find(voice => /^en[-_]/i.test(voice.lang)) || voices[0];
    if (selected && profile.preferredVoice !== selected.name) { profile.preferredVoice = selected.name; saveProfile(); }
    return selected;
  }

  function speakText(text) {
    if (!profile.voiceEnabled || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const utterance = new SpeechSynthesisUtterance(clean(text.replace(/\*+/g, "")));
    utterance.voice = selectVoice();
    utterance.lang = utterance.voice?.lang || "en-US";
    utterance.rate = .96;
    utterance.pitch = .86;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const button = panel.querySelector(".mk-mic");
    if (!Recognition) return addEntry("Voice input is not supported by this browser. You can still type the task, and voice output can remain enabled.", "brain", true, "voice");
    if (recognition) { recognition.stop(); return; }
    recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => button.classList.add("listening");
    recognition.onend = () => { button.classList.remove("listening"); recognition = null; };
    recognition.onerror = () => addEntry("I couldn’t hear that clearly. Please try again or type the task.", "brain", true, "voice");
    recognition.onresult = event => { input.value = event.results[0][0].transcript; panel.querySelector("form").requestSubmit(); };
    recognition.start();
  }

  async function enhanceWithSupplyAI(question, localAnswer) {
    if (localAnswer.intent === 'copilot') return localAnswer;
    if (LOCAL_ONLY_INTENTS.has(localAnswer.intent) || ["control", "action completed", "action started"].includes(localAnswer.category)) return localAnswer;
    if (!window.MKAI) return localAnswer;
    const result = await window.MKAI.answer(question, localAnswer, { signal: activeController?.signal });
    return { ...localAnswer, category: result.mode === 'ai' ? 'AI analyst' : 'verified local analyst', message: result.answer, result };
  }
  function restoreConversation() {
    if (!feed) return;
    feed.querySelectorAll('.mk-restored').forEach(entry => entry.remove());
    for (const item of window.MKAI?.getMessages(window.MKAI.getStatus().scope) || []) {
      const entry = addEntry(item.role === 'user' ? item.content : item.result.answer, item.role === 'user' ? 'user' : 'brain', false, item.role === 'user' ? 'question' : `${item.scope} · saved analysis`, item.result);
      entry.classList.add('mk-restored');
    }
    for (const item of window.MKCopilot?.messages?.() || []) {
      const entry = addEntry(item.text, item.role, false, 'saved Co-Pilot context');
      entry.classList.add('mk-restored');
    }
  }

  function resetConversation(scope) {
    Object.assign(conversation, { scope, lastIntent: "", lastItemKey: "", lastEntity: null, lastQuestion: "", lastAnswer: "", turns: [] });
    lastAnalysis = null;
  }

  async function execute(question) {
    if (busy || !clean(question)) return;
    const initialScope = window.MKAI?.getStatus().scope || regionCode();
    addEntry(question, "user", false);
    conversation.lastQuestion = clean(question);
    busy = true;
    activeController = new AbortController();
    panel.querySelector(".mk-stop").hidden = false;
    panel.querySelector(".mk-send").disabled = true;
    setState("Executing live ERP intelligence…", true);
    try {
      const localAnswer = await routeQuestion(question);
      const answer = await enhanceWithSupplyAI(question, localAnswer);
      if (activeController?.signal.aborted) throw new DOMException('Analysis stopped.', 'AbortError');
      addEntry(answer.message, "brain", true, answer.category || "decision", answer.result, answer.meta || null);
      if (answer.entity) conversation.lastEntity = answer.entity;
      if (answer.intent === 'copilot') window.MKCopilot?.remember(question, answer.message);
      learnTask(answer.intent || "question");
      conversation.lastIntent = answer.intent || "question";
      conversation.lastItemKey = answer.itemKey || conversation.lastItemKey;
      conversation.lastAnswer = answer.message;
      conversation.turns.push({ question: clean(question), intent: conversation.lastIntent, itemKey: answer.itemKey || "", at: Date.now() });
      conversation.turns = conversation.turns.slice(-12);
      renderPulseBar();
    } catch (error) {
      if (initialScope === (window.MKAI?.getStatus().scope || regionCode())) addEntry(error.name === "AbortError" ? "Analysis stopped." : `I couldn’t complete that task: ${error.message || "unknown error"}.`, "brain", false, "status");
    } finally {
      busy = false;
      activeController = null;
      panel.querySelector(".mk-stop").hidden = true;
      panel.querySelector(".mk-send").disabled = false;
      syncSpaceUi();
    }
  }

  function getLiveMails() {
    if (window.StarkTasks?.getMailThreads) return window.StarkTasks.getMailThreads();
    if (window.StarkMail?.getThreads) return window.StarkMail.getThreads();
    try { return JSON.parse(localStorage.getItem("mk97.mail.threads.v1") || "[]") || []; } catch (_) { return []; }
  }

  function resolveTaskFromPrompt(raw, ranked) {
    const q = raw.toLowerCase();
    const rankMatch = raw.match(/(?:#|task\s*#?\s*)(\d{1,2})\b/i);
    if (rankMatch) {
      const idx = Number(rankMatch[1]) - 1;
      if (ranked[idx]) return ranked[idx];
    }
    if (/\b(top|first|highest|#1)\b/i.test(q) && ranked[0]) return ranked[0];
    // Match by PO/Order/SKU/Ref or title token
    for (const item of ranked) {
      const hay = `${item.task.title} ${item.task.autoRef || ""} ${(item.analysis.references || []).map(r => r.code).join(" ")}`.toLowerCase();
      const tokens = q.replace(/[^a-z0-9#-]+/g, " ").split(/\s+/).filter(w => w.length >= 4 && !["send", "remind", "reminder", "task", "complete", "mark", "done", "close", "finish", "everyone", "team", "about", "please"].includes(w));
      if (tokens.some(tok => hay.includes(tok))) return item;
    }
    if (conversation.lastEntity?.type === "TASK") {
      const prev = ranked.find(x => x.task.id === conversation.lastEntity.id);
      if (prev) return prev;
    }
    return ranked[0] || null;
  }

  async function handlePowerCommand(raw) {
    const S = window.StarkSystem, Core = window.MKCopilotCore, T = window.StarkTasks;
    if (!S || !Core) return null;
    const state = S.getState();
    const mails = getLiveMails();
    const q = raw.toLowerCase().trim();
    const wrapAnalyst = (res, category) => ({
      intent: "mk-power",
      category,
      entity: res.entity || null,
      message: res.markdown,
      meta: {
        metrics: res.metrics,
        chart: res.chart,
        table: res.table,
        csv: res.csv,
        actions: res.actions,
        followUps: res.followUps
      }
    });

    // 0. Direct Slash Commands
    if (q === "/clear" || q === "/reset") {
      resetConversation(window.MKAI?.getStatus().scope || regionCode());
      renderWelcomeView();
      return { intent: "mk-power", category: "Command", message: "Started a fresh MK Co-Pilot command session." };
    }
    if (q === "/help" || /^what can you do\b/i.test(q)) {
      return {
        intent: "mk-power",
        category: "MK 7.0 Capabilities",
        message: `**MK 7.0 · AI Supply Chain Analyst & Autonomous Co-Pilot**\nI combine **quantitative financial & statistical analytics** (with live SVG charts, executive tables & 1-click CSV exports across **1,885 SKUs, 138 brands & 131 customers**) with **autonomous ERP execution**:\n\n**📊 AI Supply Chain Analyst:**\n• \`/health\` — 0–100 ERP Health Score, Z-score demand spikes & dead-stock radar\n• \`/forecast\` — 13-month statistical demand forecast, ROP & Wilson EOQ\n• \`/abc\` — ABC-XYZ segmentation, Pareto 80/20 & customer HHI concentration\n• \`/margin\` — Gross margin %, profit leaders, working capital & credit risk\n• \`/brands\` & \`/customers\` — Deep-dives & 12-month revenue trends\n• \`/compare\` — Side-by-side Brand, Customer & Vendor comparisons\n• \`/optimize\` — 3PL vs Local Warehouse landed cost & SLA routing optimizer\n\n**⚡ Autonomous Co-Pilot Actions:**\n• \`/autopilot\` — Multi-step remediation playbook (scan + POs + dock receiving + reminders)\n• \`/order-po\`, \`/receive-po\`, \`/provide-tracking\`, \`/create-task\`, \`/email\`, \`/remind\``,
        meta: {
          actions: [
            { label: "🩺 ERP Health Audit", style: "primary", prompt: "Run ERP health score and anomaly detection" },
            { label: "📈 1.8K SKU Forecast", style: "teal", prompt: "Forecast portfolio demand across all SKUs" },
            { label: "⚡ Autopilot Playbook", style: "ghost", prompt: "Show autopilot remediation plan" }
          ]
        }
      };
    }

    // 0A. ACTION: Execute Full Autonomous Remediation Playbook
    if (/^(?:execute|run)\s+(?:full\s+)?autopilot\b|^\/autopilot\s+--run\b/i.test(raw)) {
      const seed = await ensureAnalyticsSeed();
      const beforeHealth = Core.detectAnomaliesAndRisks(S.getState(), seed, mails).healthScore;
      const beforeAutoResolved = new Set((S.getState().tasks || []).filter(t => t.autoResolved).map(t => t.id));
      const logLines = [];

      // Step 1: Scan mail & ERP
      const scanRes = T?.runCopilotSync ? T.runCopilotSync({ silent: true, force: true }) : { created: [], resolved: [] };
      logLines.push(`• **1. Mail & ERP Scan:** Synced queue (${scanRes.created?.length || 0} created, ${scanRes.resolved?.length || 0} cleared).`);

      // Step 2: Issue covering Vendor POs for every distinct low-stock SKU
      const pulseNow = Core.getLivePulse(S.getState(), mails);
      let posIssued = 0;
      const seenLowSkus = new Set();
      for (const item of pulseNow.lowStockSkus) {
        if (!item?.sku || seenLowSkus.has(item.sku)) continue;
        seenLowSkus.add(item.sku);
        const poCmd = Core.buildVendorPOForItem
          ? Core.buildVendorPOForItem(item, 0, S.getState(), posIssued)
          : Core.parseVendorPOCommand(`Place a vendor PO for ${item.model || item.sku}`, S.getState(), null);
        if (poCmd) {
          S.transaction("VENDOR_PO_CREATED", `${poCmd.poNumber} (${poCmd.qty} × ${poCmd.item.model || poCmd.item.sku})`, draft => {
            draft.enterprise.purchaseOrders ||= [];
            draft.enterprise.purchaseOrders.unshift({
              id: S.uid("vpo"),
              vendorId: poCmd.vendor.id,
              po: poCmd.poNumber,
              status: "PO_ISSUED",
              issuedAt: new Date().toISOString(),
              eta: poCmd.eta,
              warehouse: "MK97 Southeast Distribution Center",
              carrier: "TBD",
              tracking: "",
              lines: [{ sku: poCmd.item.sku, qty: poCmd.qty, received: 0, cost: poCmd.unitCost }]
            });
          });
          posIssued++;
          const regSuffix = poCmd.item.region ? ` [${poCmd.item.region}]` : "";
          logLines.push(`• **2. Covering PO Issued:** **${poCmd.poNumber}** (${poCmd.qty} × ${poCmd.item.model || poCmd.item.sku}${regSuffix}, $${Math.round(poCmd.totalCost).toLocaleString()}).`);
        }
      }

      // Step 3: Receive arrived dock PO receipts cleanly
      let receivedCount = 0;
      const arrivedRcvs = (S.getState().logistics?.receipts || []).filter(r => r.status === "ARRIVED");
      for (const rcv of arrivedRcvs) {
        const matchPo = (S.getState().enterprise?.purchaseOrders || []).find(p => p.po === rcv.po && !["RECEIVED", "CANCELLED"].includes(p.status));
        if (matchPo && S.receivePO) {
          try {
            S.receivePO(matchPo.id);
            receivedCount++;
            logLines.push(`• **3. Dock Receipt Posted:** **${matchPo.po}** received into usable stock & putaway closed.`);
          } catch (err) {
            logLines.push(`• **3. Dock Receipt Skipped (${matchPo.po}):** ${err.message}`);
          }
        }
      }

      // Step 4: Final sync & remind team on #1 remaining priority task
      if (T?.runCopilotSync) { try { T.runCopilotSync({ silent: true, force: true }); } catch (_) {} }
      const rankedAfter = (T?.analyzeAll ? T.analyzeAll() : Core.prioritizeTasks(S.getState().tasks || [], S.getState(), { mailThreads: mails })).filter(x => x.task.status !== "DONE");
      let reminded = 0;
      if (rankedAfter[0] && T?.sendReminder) {
        const remLog = T.sendReminder(rankedAfter[0].task.id);
        reminded = (remLog?.recipients || rankedAfter[0].task.assignees || [1]).length;
        logLines.push(`• **4. Team Reminder Dispatched:** Notified **${reminded} assignee(s)** via MK97 Mail for **${rankedAfter[0].task.title}**.`);
      }

      const newlyResolved = (S.getState().tasks || []).filter(t => t.autoResolved && !beforeAutoResolved.has(t.id));
      const afterHealth = Core.detectAnomaliesAndRisks(S.getState(), seed, mails).healthScore;
      const delta = afterHealth - beforeHealth;

      return {
        intent: "mk-power",
        category: "Autopilot Executed",
        message: `**⚡ MK v7.0 Full Autopilot Complete**\nERP Health Score improved **${beforeHealth}/100 → ${afterHealth}/100** (${delta >= 0 ? "+" : ""}${delta} pts)${newlyResolved.length ? ` · **${newlyResolved.length} task(s) auto-resolved & cleared**` : ""}:\n\n${logLines.join("\n")}`,
        meta: {
          metrics: [
            { label: "Health Score", value: `${afterHealth}/100 (${delta >= 0 ? "+" : ""}${delta})`, tone: "ok" },
            { label: "POs Issued", value: String(posIssued), tone: "teal" },
            { label: "POs Received", value: String(receivedCount), tone: "info" },
            { label: "Auto-Resolved", value: String(newlyResolved.length), tone: "ok" }
          ],
          actions: [
            { label: "🩺 View Updated Health", style: "teal", prompt: "Run ERP health score and anomaly detection" },
            { label: "🎯 View Tasks Queue", style: "ghost", prompt: "Prioritize & analyze my tasks" }
          ],
          followUps: ["Run ERP health score and anomaly detection", "Show executive briefing"]
        }
      };
    }

    // 0B. PREVIEW: Autonomous Fix Playbook (/autopilot)
    if (/^\/autopilot\b|\b(autopilot|auto[- ]?fix\s+(?:all|erp|issues)|remediation\s+plan|fix\s+everything)\b/i.test(raw)) {
      const plan = Core.buildAutopilotPlan(state, mails);
      return wrapAnalyst(plan, "Autopilot Remediation Plan");
    }

    // 0C. ACTION: Send Drafted Executive Email
    if (/^send\s+draft(?:ed)?\s+email\b/i.test(raw) && conversation.pendingEmail) {
      const draft = conversation.pendingEmail;
      const outMsg = {
        id: "mk-email-" + Date.now(),
        senderName: "Manoj Manne",
        senderCompany: "MK97 Operations (via MK AI)",
        senderEmail: "supply.chain@mk97.com",
        to: draft.toEmail,
        cc: "",
        subject: draft.subject,
        timestamp: "Just now",
        fullDate: new Date().toLocaleString(),
        unread: false,
        starred: false,
        flagged: false,
        folder: "sent",
        direction: "outbound",
        category: "operations",
        avatar: "MK",
        avatarBg: "#087f78",
        avatarColor: "#ffffff",
        tags: [{ name: "MK AI Sent", type: "order" }],
        snippet: draft.body.slice(0, 110),
        body: draft.body,
        related: draft.related || {},
        attachments: []
      };
      if (window.StarkMail?.prependEmail) {
        window.StarkMail.prependEmail(outMsg);
      } else {
        const list = getLiveMails();
        list.unshift(outMsg);
        try { localStorage.setItem("mk97.mail.threads.v1", JSON.stringify(list.slice(0, 80))); window.dispatchEvent(new CustomEvent("mk97:mail-updated")); } catch (_) {}
      }
      conversation.pendingEmail = null;
      return {
        intent: "mk-power",
        category: "Action Executed · Email Sent",
        message: `**✉ Executive Email Sent via MK97 Mail**\n• **To:** ${draft.toName} (\`${draft.toEmail}\`)\n• **Subject:** ${draft.subject}\n• Logged in [MK97 Mail (Sent)](mail.html).`,
        meta: {
          metrics: [{ label: "Status", value: "Sent", tone: "ok" }, { label: "Recipient", value: draft.toName.split(" ")[0], tone: "teal" }],
          actions: [{ label: "✉ Open MK97 Mail", style: "teal", href: "mail.html" }]
        }
      };
    }

    // 0D. ACTION: Draft Data-Backed Executive Email (/email)
    if (/^\/email\b|^(?:please\s+)?(?:draft|write|compose|send)\s+(?:an?\s+)?(?:executive\s+)?email\b|^email\s+[a-z]/i.test(raw)) {
      const draft = Core.parseEmailDraftCommand(raw, state, mails);
      if (!draft) {
        const firstVend = state.enterprise?.vendors?.[0]?.name || "Kendra Scott";
        const firstAcct = state.enterprise?.accounts?.[0]?.name || "Meridian";
        return {
          intent: "mk-power",
          category: "Email Composer",
          message: `Tell me who to email — for example:\n• **\`Draft email to ${firstVend} about late PO delivery\`**\n• **\`Draft email to ${firstAcct} about account status\`**`,
          meta: {
            actions: [
              { label: `✉ Draft to ${firstVend.split(" ")[0]}`, style: "primary", prompt: `Draft email to ${firstVend} about late PO delivery` },
              { label: `✉ Draft to ${firstAcct.split(" ")[0]}`, style: "teal", prompt: `Draft email to ${firstAcct} about account status` }
            ]
          }
        };
      }
      conversation.pendingEmail = draft;
      return {
        intent: "mk-power",
        category: "Executive Email Draft",
        message: `**✉ Data-Backed Email Draft Ready**\n• **To:** ${draft.toName} (\`${draft.toEmail}\`)\n• **Subject:** ${draft.subject}\n\n${draft.body}`,
        meta: {
          metrics: [{ label: "Recipient", value: draft.toName.split(" ")[0], tone: "teal" }, { label: "Status", value: "Ready to Send", tone: "info" }],
          actions: [
            { label: "✉ Send Now via MK97 Mail", style: "primary", prompt: "Send drafted email" },
            { label: "↗ Open MK97 Mail", style: "ghost", href: "mail.html" }
          ]
        }
      };
    }

    // 0E. ACTION: Receive / Post Arrived Vendor PO Dock Receipt (/receive-po)
    if (/^\/receive-po\b|^(?:please\s+)?(?:receive|post\s+(?:dock\s+)?receipt(?:\s+for)?)\s+(?:po|vendor\s+po|arrived)/i.test(raw)) {
      const openPOs = (state.enterprise?.purchaseOrders || []).filter(p => !["RECEIVED", "CANCELLED", "CLOSED"].includes(p.status));
      const matched = openPOs.find(p => q.includes(p.po.toLowerCase()) || q.includes(p.id.toLowerCase())) ||
        openPOs.find(p => (state.logistics?.receipts || []).some(r => r.po === p.po && r.status === "ARRIVED")) ||
        openPOs[0];
      if (!matched) {
        return { intent: "mk-power", category: "Warehouse Receiving", message: "There are no open Vendor POs awaiting dock receiving right now." };
      }
      try {
        if (S.receivePO) S.receivePO(matched.id);
        if (T?.runCopilotSync) { try { T.runCopilotSync({ silent: true, force: true }); } catch (_) {} }
        const units = (matched.lines || []).reduce((s, l) => s + Number(l.qty || 0), 0);
        return {
          intent: "mk-power",
          category: "Action Executed · PO Received",
          message: `**📦 Dock Receipt Posted & Stock Added: ${matched.po}**\n• Added **${units} units** into usable warehouse inventory.\n• Closed linked dock receipt & putaway task.`,
          meta: {
            metrics: [
              { label: "PO", value: matched.po, tone: "teal" },
              { label: "Units Posted", value: `+${units}u`, tone: "ok" }
            ],
            actions: [
              { label: "📦 Check Inventory", style: "teal", prompt: "Check low stock and inventory value" },
              { label: "🩺 Re-Check Health", style: "ghost", prompt: "Run ERP health score and anomaly detection" }
            ]
          }
        };
      } catch (err) {
        return { intent: "mk-power", category: "Warehouse Receiving", message: `Could not post **${matched.po}**: ${err.message}` };
      }
    }

    // 1. ACTION: Create & Assign Task from Natural Language
    if (/^\/create-task\b|^(?:please\s+)?(?:create|add|make|schedule|open|assign)\s+(?:a\s+)?(?:new\s+)?task\b/i.test(raw)) {
      const roster = T?.getTeamRoster ? T.getTeamRoster() : Core.DEFAULT_TEAM_ROSTER;
      const parsed = Core.parseNaturalTaskCommand(raw, roster);
      let taskId = "";
      if (T?.save) {
        taskId = T.save({
          title: parsed.title,
          notes: parsed.notes,
          assignees: parsed.assignees,
          dueAt: parsed.dueAt,
          reminderAt: parsed.reminderAt,
          priority: "AUTO",
          status: "OPEN"
        });
      }
      const savedTask = (S.getState().tasks || []).find(t => t.id === taskId) || { ...parsed, id: taskId, status: "OPEN" };
      const ranked = Core.prioritizeTasks(S.getState().tasks || [], S.getState(), { mailThreads: mails });
      const entry = ranked.find(x => x.task.id === taskId) || { task: savedTask, analysis: Core.analyzeTaskImportance(savedTask, S.getState(), { mailThreads: mails }) };
      const a = entry.analysis;
      const teamNames = (savedTask.assignees || []).map(p => p.name).join(", ");

      return {
        intent: "mk-power",
        category: "Action Executed · Task Created",
        entity: { type: "TASK", id: savedTask.id, label: savedTask.title },
        message: `**✅ Task Created & Ranked by MK Co-Pilot**\n• **Subject:** ${savedTask.title}\n• **AI Priority:** **#${a.rank || 1} · ${a.tier} (${a.score}/100)**\n• **Assigned To (${(savedTask.assignees || []).length}):** ${teamNames}\n• **Matched ERP Records:** ${a.references.length ? a.references.map(r => `\`${r.code}\` (${r.status})`).join(", ") : "General operational task"}\n• **MK Insight:** ${a.reasons[0] || "Tracked in live queue."}`,
        meta: {
          metrics: [
            { label: "Priority Rank", value: `#${a.rank || 1}`, tone: a.tier === "CRITICAL" ? "critical" : "teal" },
            { label: "AI Score", value: `${a.score}/100`, tone: a.tier === "CRITICAL" ? "critical" : "warn" },
            { label: "Team", value: `${(savedTask.assignees || []).length} people`, tone: "info" }
          ],
          actions: [
            { label: `🔔 Send Reminder to ${teamNames.split(",")[0]}${(savedTask.assignees || []).length > 1 ? ` +${(savedTask.assignees || []).length - 1}` : ""}`, style: "primary", prompt: `Send reminder for #${a.rank || 1}` },
            { label: "↗ Open in Tasks", style: "ghost", href: `tasks.html?task=${encodeURIComponent(savedTask.id)}` }
          ],
          followUps: ["Prioritize & analyze my tasks", "Show executive briefing"]
        }
      };
    }

    // 2. ACTION: Send Team Reminder from Chat
    if (/^\/remind\b|^(?:please\s+)?(?:send\s+(?:a\s+)?reminder|remind\s+(?:everyone|all|team|people|elena|marcus|sarah|david|priya|manoj|them)|notify\s+(?:the\s+)?team)/i.test(raw)) {
      const ranked = (T?.analyzeAll ? T.analyzeAll() : Core.prioritizeTasks(state.tasks || [], state, { mailThreads: mails })).filter(x => x.task.status !== "DONE");
      const target = resolveTaskFromPrompt(raw, ranked);
      if (!target) {
        return { intent: "mk-power", category: "Reminder", message: "There are no active tasks to send a reminder for. Ask me to **Scan mail and inventory for tasks** or **Create a task** first." };
      }
      const log = T?.sendReminder ? T.sendReminder(target.task.id) : null;
      const names = (log?.recipients || target.task.assignees || []).map(r => r.name).join(", ") || "Assigned Team";
      return {
        intent: "mk-power",
        category: "Action Executed · Reminder Sent",
        entity: { type: "TASK", id: target.task.id, label: target.task.title },
        message: `**🔔 Team Reminder Dispatched via MK97 Mail & Workspace**\n• **Task (#${target.analysis.rank}):** ${target.task.title}\n• **Recipients:** ${names}\n• **Logged:** Recorded in Task Reminder History & delivered to [MK97 Mail (Sent)](mail.html).`,
        meta: {
          metrics: [
            { label: "Notified", value: `${(log?.recipients || target.task.assignees || [1]).length} people`, tone: "teal" },
            { label: "Channel", value: "Mail + ERP", tone: "ok" }
          ],
          actions: [
            { label: "✉ Open MK97 Mail", style: "teal", href: "mail.html" },
            { label: "↗ Open Task", style: "ghost", href: `tasks.html?task=${encodeURIComponent(target.task.id)}` }
          ],
          followUps: ["Prioritize & analyze my tasks", "Show executive briefing"]
        }
      };
    }

    // 3. ACTION: Place / Issue Vendor Purchase Order from Chat
    if (/^\/order-po\b|^(?:please\s+)?(?:place|issue|create|submit|raise|order|buy|reorder)\s+(?:a\s+)?(?:covering\s+)?(?:vendor\s+)?(?:po|purchase\s*order)\b|^(?:please\s+)?(?:reorder|order|buy)\s+(?:\d+\s+(?:units?\s+(?:of\s+)?)?)?(?:af-?200|wh-?1000|airpods|mtjv|4217709208|hcfb1|amz|visa|aura|sony|apple|fieldbar|kendra|it\b)/i.test(raw)) {
      const poCmd = Core.parseVendorPOCommand(raw, state, conversation.lastEntity);
      if (!poCmd) {
        return {
          intent: "mk-power",
          category: "Procurement Action",
          message: "Specify which SKU or model to order — for example: **`Place a vendor PO for AF-200 for 45 units`** or **`Reorder WH1000XM5 for 30 units`**.",
          meta: { actions: [{ label: "📦 Check Low Stock Radar", style: "teal", prompt: "Check low stock and reorder radar" }] }
        };
      }
      const beforeAutoResolved = new Set((S.getState().tasks || []).filter(t => t.autoResolved).map(t => t.id));
      S.transaction("VENDOR_PO_CREATED", `${poCmd.poNumber} (${poCmd.qty} × ${poCmd.item.model || poCmd.item.sku})`, draft => {
        draft.enterprise.purchaseOrders ||= [];
        draft.enterprise.purchaseOrders.unshift({
          id: S.uid("vpo"),
          vendorId: poCmd.vendor.id,
          po: poCmd.poNumber,
          status: "PO_ISSUED",
          issuedAt: new Date().toISOString(),
          eta: poCmd.eta,
          warehouse: "MK97 Southeast Distribution Center",
          carrier: "TBD",
          tracking: "",
          lines: [{ sku: poCmd.item.sku, qty: poCmd.qty, received: 0, cost: poCmd.unitCost }]
        });
      });
      if (T?.runCopilotSync) { try { T.runCopilotSync({ silent: true, force: true }); } catch (_) {} }
      const newlyResolved = (S.getState().tasks || []).filter(t => t.autoResolved && !beforeAutoResolved.has(t.id));
      const autoMsg = newlyResolved.length
        ? `\n• **✨ Auto-Resolved Task (${newlyResolved.length}):** MK Co-Pilot verified safety-stock coverage and automatically removed **${newlyResolved.map(r => r.title).join(", ")}** from your Active queue!`
        : "";
      return {
        intent: "mk-power",
        category: "Action Executed · Vendor PO Issued",
        entity: { type: "PO", id: poCmd.poNumber, label: poCmd.poNumber },
        message: `**🛒 Vendor Purchase Order Issued: ${poCmd.poNumber}**\n• **Item:** ${poCmd.item.model || poCmd.item.sku} — ${poCmd.item.brand} ${poCmd.item.title}\n• **Quantity:** **${poCmd.qty} units** @ $${poCmd.unitCost}/unit (**$${Math.round(poCmd.totalCost).toLocaleString()} total**)\n• **Supplier:** ${poCmd.vendor.name} · Expected Arrival: **${poCmd.eta.slice(0, 10)}**${autoMsg}`,
        meta: {
          metrics: [
            { label: "PO Number", value: poCmd.poNumber, tone: "teal" },
            { label: "Ordered", value: `${poCmd.qty} units`, tone: "ok" },
            { label: "Auto-Resolved", value: `${newlyResolved.length} task${newlyResolved.length === 1 ? "" : "s"}`, tone: newlyResolved.length ? "ok" : "info" }
          ],
          actions: [
            { label: "↗ Open Procurement", style: "teal", href: `procurement/index.html?po=${encodeURIComponent(poCmd.poNumber)}` },
            { label: "🎯 View Updated Tasks", style: "ghost", prompt: "Prioritize & analyze my tasks" }
          ],
          followUps: [`Check inventory for ${poCmd.item.model || poCmd.item.sku}`, "Show executive briefing"]
        }
      };
    }

    // 4. ACTION: Provide Tracking & Auto-Resolve from Chat
    if (/^\/provide-tracking\b|^(?:please\s+)?(?:provide|send|update|add|set|reply(?:\s+with)?|share)\s+(?:the\s+)?tracking\b/i.test(raw)) {
      const trkCmd = Core.parseTrackingUpdateCommand(raw, state, mails, conversation.lastEntity);
      if (!trkCmd) {
        return {
          intent: "mk-power",
          category: "Tracking Action",
          message: "Include a carrier tracking number and target reference — for example:\n• **`Provide tracking DHL9988776 for #3PL-GP-918`**\n• **`Update tracking FDX774920011 for TPL-SHP-77492`**\n• **`Set tracking 1Z999AA10123456784 on SO-89108`**"
        };
      }
      const beforeAutoResolved = new Set((S.getState().tasks || []).filter(t => t.autoResolved).map(t => t.id));
      if (trkCmd.targetType === "3PL") {
        S.transaction("TPL_TRACKING_UPDATED", `${trkCmd.targetId}: ${trkCmd.tracking}`, draft => {
          const shp = (draft.logistics?.tplShipments || []).find(s => s.id === trkCmd.targetId);
          if (shp) { shp.tracking = trkCmd.tracking; shp.status = "DISPATCHED"; shp.dispatchedAt = new Date().toISOString(); }
        });
      } else if (trkCmd.targetType === "ORDER") {
        S.transaction("ORDER_TRACKING_UPDATED", `${trkCmd.targetId}: ${trkCmd.tracking}`, draft => {
          const ord = (draft.enterprise?.orders || []).find(o => o.id === trkCmd.targetId);
          if (ord) { ord.tracking = trkCmd.tracking; ord.status = "SHIPPED"; ord.updatedAt = new Date().toISOString(); }
        });
      } else if (trkCmd.targetType === "MAIL" && trkCmd.mailThread) {
        const list = getLiveMails();
        const target = list.find(m => m.id === trkCmd.mailThread.id);
        if (target) {
          target.related = { ...(target.related || {}), tracking: trkCmd.tracking };
          target.shipmentDetails = { ...(target.shipmentDetails || {}), trackingNumber: trkCmd.tracking, carrier: trkCmd.carrier, status: "Tracking Provided" };
        }
        const reply = {
          id: "mk-reply-" + Date.now(),
          senderName: "Manoj Manne",
          senderCompany: "MK97 Operations (via MK AI)",
          senderEmail: "supply.chain@mk97.com",
          to: trkCmd.mailThread.senderEmail || "orders@globalpartsco.com",
          cc: "",
          subject: /^re:/i.test(trkCmd.mailThread.subject || "") ? trkCmd.mailThread.subject : `Re: ${trkCmd.mailThread.subject || "Tracking Update"}`,
          timestamp: "Just now",
          fullDate: new Date().toLocaleString(),
          unread: false,
          starred: false,
          flagged: false,
          folder: "sent",
          direction: "outbound",
          replyToThreadId: trkCmd.mailThread.id,
          category: "shipping",
          avatar: "MK",
          avatarBg: "#087f78",
          avatarColor: "#ffffff",
          tags: [{ name: "Tracking Sent", type: "shipment" }],
          snippet: `${trkCmd.carrier} Tracking: ${trkCmd.tracking}`,
          body: `Hi team,\n\nPlease find the confirmed tracking number below:\nCarrier: ${trkCmd.carrier}\nTracking Number: ${trkCmd.tracking}\nReference: ${trkCmd.targetLabel}\n\nBest regards,\nManoj Manne · MK97 ERP`,
          related: { ...(trkCmd.mailThread.related || {}), tracking: trkCmd.tracking },
          attachments: []
        };
        if (window.StarkMail?.prependEmail) {
          window.StarkMail.prependEmail(reply);
        } else {
          list.unshift(reply);
          try { localStorage.setItem("mk97.mail.threads.v1", JSON.stringify(list.slice(0, 80))); window.dispatchEvent(new CustomEvent("mk97:mail-updated")); } catch (_) {}
        }
      }
      if (T?.runCopilotSync) { try { T.runCopilotSync({ silent: true, force: true }); } catch (_) {} }
      const newlyResolved = (S.getState().tasks || []).filter(t => t.autoResolved && !beforeAutoResolved.has(t.id));
      const autoMsg = newlyResolved.length
        ? `\n• **✨ Task Auto-Resolved (${newlyResolved.length}):** MK Co-Pilot verified tracking \`${trkCmd.tracking}\` and automatically removed **${newlyResolved.map(r => r.title).join(", ")}** from Active Tasks!`
        : "";
      return {
        intent: "mk-power",
        category: "Action Executed · Tracking Dispatched",
        message: `**📦 Tracking Recorded & Verified: \`${trkCmd.tracking}\`**\n• **Target:** ${trkCmd.targetLabel} (${trkCmd.targetType})\n• **Carrier:** ${trkCmd.carrier}${trkCmd.targetType === "MAIL" ? "\n• **MK97 Mail:** Outbound tracking reply logged in Sent." : ""}${autoMsg}`,
        meta: {
          metrics: [
            { label: "Tracking #", value: trkCmd.tracking, tone: "ok" },
            { label: "Auto-Resolved", value: `${newlyResolved.length} task${newlyResolved.length === 1 ? "" : "s"}`, tone: newlyResolved.length ? "teal" : "info" }
          ],
          actions: [
            { label: "🎯 View Tasks Queue", style: "teal", prompt: "Prioritize & analyze my tasks" },
            { label: "✉ Open MK97 Mail", style: "ghost", href: "mail.html" }
          ],
          followUps: ["Summarize unread mail and tracking requests", "Show executive briefing"]
        }
      };
    }

    // 5. ACTION: Complete / Start / Reopen Task
    if (/^(?:please\s+)?(?:complete|finish|close|mark|reopen|start)\s+(?:the\s+)?(?:task\b|#\d+)/i.test(raw)) {
      const reopen = /\breopen\b/i.test(raw);
      const start = /\bstart\b|\bin\s*progress\b/i.test(raw);
      const newStatus = reopen ? "OPEN" : start ? "IN_PROGRESS" : "DONE";
      const allRanked = T?.analyzeAll ? T.analyzeAll() : Core.prioritizeTasks(state.tasks || [], state, { mailThreads: mails });
      const pool = reopen ? allRanked.filter(x => x.task.status === "DONE") : allRanked.filter(x => x.task.status !== "DONE");
      const target = resolveTaskFromPrompt(raw, pool);
      if (!target) return { intent: "mk-power", category: "Task Status", message: "No matching task found to update." };
      if (T?.setStatus) T.setStatus(target.task.id, newStatus);
      return {
        intent: "mk-power",
        category: "Action Executed · Task Updated",
        message: `**✅ Task Status Updated to ${newStatus.replace("_", " ")}**\n• ${target.task.title}`,
        meta: {
          actions: [{ label: "🎯 View Priority Tasks", style: "teal", prompt: "Prioritize & analyze my tasks" }]
        }
      };
    }

    // 5A. ANALYST: Side-by-Side Comparison Engine (/compare, "X vs Y")
    if (/^\/compare\b|\bcompare\b|\bvs\.?\b|\bversus\b/i.test(raw) && !/\bwhat[- ]?if\b/i.test(raw)) {
      const seed = await ensureAnalyticsSeed();
      return wrapAnalyst(Core.compareEntities(raw, state, seed), "Side-by-Side Comparison");
    }

    // 5B. ANALYST: 3PL & Local Warehouse Cost / SLA Fulfillment Optimizer (/optimize)
    if (/^\/optimize\b|\b(optimi[sz]e\s+(?:fulfillment|3pl|routing|shipping)|best\s+(?:3pl|warehouse|node|fulfillment)|cheapest\s+(?:3pl|node|fulfillment)|routing\s+optimi[sz])/i.test(raw)) {
      return wrapAnalyst(Core.optimizeFulfillmentAnd3PL(raw, state, conversation.lastEntity), "Fulfillment Routing Optimizer");
    }

    // 5C. ANALYST: Cross-ERP Health Score & Statistical Anomaly Detector (/health)
    if (/^\/health\b|\b(health\s*score|erp\s*health|anomal(?:y|ies)|risk\s*(?:audit|radar|score)|dead\s*stock|demand\s*spikes?|outliers?)\b/i.test(raw)) {
      const seed = await ensureAnalyticsSeed();
      return wrapAnalyst(Core.detectAnomaliesAndRisks(state, seed, mails), "ERP Health & Anomaly Radar");
    }

    // 5D. ANALYST: Statistical Demand Forecast, Volatility & Wilson EOQ (/forecast)
    if (/^\/forecast\b|\b(forecast\w*|eoq|economic\s+order\s+quantit|reorder\s+point|rop\b|seasonality|days\s+of\s+cover|demand\s+velocity|demand\s+trend)\b/i.test(raw) && !/\bwhat[- ]?if\b/i.test(raw)) {
      const seed = await ensureAnalyticsSeed();
      return wrapAnalyst(Core.analyzeDemandForecast(raw, state, seed, conversation.lastEntity), "Statistical Demand Forecast");
    }

    // 5E. ANALYST: ABC-XYZ Matrix & Pareto 80/20 Concentration (/abc)
    if (/^\/abc\b|\b(abc\s*[-/]?\s*xyz|abc\s+(?:analysis|matrix|segmentation|class)|pareto|80\s*\/\s*20|concentration\s+risk|hhi\b)\b/i.test(raw)) {
      const seed = await ensureAnalyticsSeed();
      return wrapAnalyst(Core.analyzeAbcXyzAndPareto(state, seed), "ABC-XYZ & Pareto Intelligence");
    }

    // 5F. ANALYST: Financial Margin, Gross Profit & Working Capital (/margin)
    if (/^\/margin\b|\b(gross\s*margin|profit\s*margin|margins?|profitabilit\w*|gross\s*profit|working\s*capital|cogs\b|cash\s*tied|financial\s*(?:summary|analysis|overview|pulse))\b/i.test(raw)) {
      const seed = await ensureAnalyticsSeed();
      return wrapAnalyst(Core.analyzeFinancialsAndMargin(state, seed), "Financial & Margin Analyst");
    }

    // 5G. ANALYST: Brand & Customer Revenue Deep-Dive (/brands, /customers)
    if (/^\/brands?\b|^\/customers?\b|\b(top\s+brands?|brand\s+(?:revenue|analytics|performance|deep[- ]?dive|ranking)|analy[sz]e\s+brand|top\s+customers?|customer\s+(?:revenue|analytics|concentration|deep[- ]?dive|ranking)|analy[sz]e\s+customer|marc\s+jacobs|gucci|ferragamo|infinity\s+luxe|workhuman|purchasing\s+power|innowave)\b/i.test(raw)) {
      const seed = await ensureAnalyticsSeed();
      return wrapAnalyst(Core.analyzeBrandOrCustomerDeepDive(raw, state, seed), "Commercial Revenue Analyst");
    }

    // 6. QUERY: Executive Operations Briefing
    if (/^\/brief\b|\b(executive\s*brief\w*|morning\s*brief\w*|daily\s*brief\w*|command\s*brief\w*|what\s+needs\s+attention|erp\s*status|workspace\s*overview|health\s*check|give\s+me\s+(?:a\s+)?(?:brief|summary|status|update))\b/i.test(raw)) {
      const brief = Core.buildExecutiveBriefing(state, mails);
      return {
        intent: "mk-power",
        category: "Executive Briefing",
        message: brief.markdown,
        meta: { metrics: brief.metrics, actions: brief.actions, followUps: brief.followUps }
      };
    }

    // 7. QUERY: Tasks Priority / Scan / Reference Importance
    if (/^\/tasks\b|^\/scan\b/.test(q) || /\b(task|tasks|reminder|reminders)\b/.test(q) || /\b(priority\s*(?:list|order)|prioriti[sz]e.*task|scan\s*(?:mail|inbox|emails?).*(?:task|tracking|inventory)|auto[- ]?create\s*task)\b/.test(q)) {
      return handleTaskCopilotQuestion(q === "/scan" ? "Scan mail and inventory for tasks" : q === "/tasks" ? "Prioritize & analyze my tasks" : raw);
    }

    // 8. QUERY: Live MK97 Mail Intelligence
    if (/^\/mail\b|\b(mail|inbox|emails?|unread\s+mail|tracking\s+requests?)\b/i.test(q) && !/\b(po-2026|vendor\s*po)\b/i.test(q)) {
      const res = Core.queryLiveMail(raw, state, mails);
      return { intent: "mk-power", category: "MK97 Mail Intelligence", message: res.markdown, entity: res.entity, meta: { metrics: res.metrics, actions: res.actions, followUps: res.followUps } };
    }

    // 9. QUERY: Live 3PL & Warehouse Control Tower
    if (/^\/3pl\b|\b(3pl|delayed\s*shipments?|warehouse|putaway|cycle\s*count|pick(?:ing)?\s*waves?|dock|receiving|reconciliation|tpl-shp)\b/i.test(q)) {
      const res = Core.queryLiveLogistics3PL(raw, state);
      return { intent: "mk-power", category: "3PL & Warehouse Pulse", message: res.markdown, entity: res.entity, meta: { metrics: res.metrics, actions: res.actions, followUps: res.followUps } };
    }

    // 10. QUERY: Live Vendor Performance, SLAs & Open Vendor POs
    if (/^\/po\b|\b(vendor\s*performance|supplier\s*(?:sla|performance)|kendra\s*scott|open\s*vendor\s*po|open\s*pos|vendor\s*po|po-2026-\d{5,}|vpo_\d+|procurement)\b/i.test(q)) {
      const res = Core.queryLiveVendors(raw, state);
      return { intent: "mk-power", category: "Vendor & PO Intelligence", message: res.markdown, entity: res.entity, meta: { metrics: res.metrics, actions: res.actions, followUps: res.followUps } };
    }

    // 11. QUERY: Live Customer Orders & CRM Accounts
    if (/^\/orders\b|\b(open\s*orders?|orders?\s+for\b|customer\s*orders?|credit\s*(?:limit|review|risk)|accounts?|northstar|apex\s*incentives|meridian|so-89\d+|87366|88211|88405)\b/i.test(q)) {
      const res = Core.queryLiveOrders(raw, state);
      return { intent: "mk-power", category: "Live Orders & CRM", message: res.markdown, entity: res.entity, meta: { metrics: res.metrics, actions: res.actions, followUps: res.followUps } };
    }

    // 12. QUERY: Live Inventory / Low Stock / SKU Lookup / Reorder Radar (zero CSV required!)
    if (/^\/inventory\b|\b(check\s+inventory|live\s+inventory|inventory\s+value|low\s*stock|below\s*safety|safety\s*stock|reorder\s*radar|generate\s+reorder\s+report|stock\s+for|af-?200|wh-?1000|airpods|hcfb1|4217709208|amz-100|visa-50|aura\s*frames|fieldbar)\b/i.test(q) && !/\bwhat[- ]?if|simulate\b/i.test(q)) {
      const res = Core.queryLiveInventory(raw, state, conversation.lastEntity);
      return { intent: "mk-power", category: "Live Inventory Intelligence", message: res.markdown, entity: res.entity, meta: { metrics: res.metrics, actions: res.actions, followUps: res.followUps } };
    }

    return null;
  }

  function handleTaskCopilotQuestion(raw) {
    const q = raw.toLowerCase();
    const S = window.StarkSystem, Core = window.MKCopilotCore, T = window.StarkTasks;
    if (!S || !Core) return null;
    const mails = getLiveMails();

    // 1. Autonomous Mail + Inventory + 3PL Scan command
    if (/\b(scan|sync|auto[- ]?create|check\s*(?:mail|inbox|emails?|inventory)|tracking\s*request)\b/.test(q)) {
      const res = T?.runCopilotSync ? T.runCopilotSync({ silent: true, force: true }) : { created: [], resolved: [], summary: 'Synced.' };
      const ranked = (T?.analyzeAll ? T.analyzeAll() : Core.prioritizeTasks(S.getState().tasks || [], S.getState(), { mailThreads: mails })).filter(x => x.task.status !== 'DONE');
      const lines = [
        `**MK Co-Pilot Autonomous Task Scan**`,
        `• Created: **${res.created.length}** new task(s)${res.created.length ? ' — ' + res.created.map(c => c.title).join('; ') : ''}`,
        `• Auto-Resolved & Cleared: **${res.resolved.length}** task(s)${res.resolved.length ? ' — ' + res.resolved.map(r => `${r.title} (${r.reason})`).join('; ') : ''}`,
        `• Active Priority Queue: **${ranked.length}** open task(s)`
      ];
      if (ranked.length) {
        lines.push('', '**Top Priority Order:**');
        ranked.slice(0, 5).forEach(({ task, analysis }) => {
          const refs = analysis.references.length ? ` [${analysis.references.slice(0, 2).map(r => r.code).join(', ')}]` : '';
          lines.push(`**#${analysis.rank}** (${analysis.score}/100 · ${analysis.tier}) — ${task.title}${refs}`);
        });
      }
      return {
        intent: 'copilot',
        category: 'MK Task Intelligence',
        message: lines.join('\n'),
        meta: {
          metrics: [
            { label: 'Created', value: String(res.created.length), tone: res.created.length ? 'teal' : 'info' },
            { label: 'Auto-Resolved', value: String(res.resolved.length), tone: res.resolved.length ? 'ok' : 'info' },
            { label: 'Active Queue', value: String(ranked.length), tone: 'warn' }
          ],
          actions: [
            ...(ranked[0] ? [{ label: '🔔 Remind Team on #1', style: 'primary', prompt: 'Send reminder for #1' }] : []),
            { label: '↗ Open Tasks', style: 'ghost', href: 'tasks.html' }
          ]
        }
      };
    }

    // 2. Analyze a specific task / PO / Order / SKU reference importance
    const analyzeMatch = raw.match(/(?:analy[sz]e|importance\s+of|score|evaluate|check)\s+(?:task\s+)?(.+)/i);
    if (analyzeMatch && !/\b(my\s+tasks|all\s+tasks|tasks)\b/i.test(analyzeMatch[1].trim())) {
      const probeText = analyzeMatch[1].trim();
      const res = Core.analyzeTaskImportance({ title: probeText, notes: '' }, S.getState(), { mailThreads: mails });
      const lines = [
        `**MK Co-Pilot Task Importance Analysis**`,
        `Subject: **${probeText}**`,
        `Priority Tier: **${res.tier}** · Importance Score: **${res.score}/100** · Category: **${res.category}**`,
        res.references.length ? `Matched Website Records: ${res.references.map(r => `**${r.type.replace('_', ' ')} ${r.code}** (${r.status})`).join(', ')}` : 'Matched Website Records: None directly referenced yet.',
        '',
        '**Evidence & Signals:**',
        ...res.reasons.map(r => `• ${r}`),
        '',
        `**Recommended Action:** ${res.recommendedAction}`
      ];
      return {
        intent: 'copilot',
        category: 'MK Task Intelligence',
        message: lines.join('\n'),
        meta: {
          metrics: [
            { label: 'AI Score', value: `${res.score}/100`, tone: res.tier === 'CRITICAL' ? 'critical' : 'teal' },
            { label: 'Tier', value: res.tier, tone: res.tier === 'CRITICAL' ? 'critical' : 'warn' },
            { label: 'ERP Matches', value: String(res.references.length), tone: 'info' }
          ],
          actions: [
            { label: '＋ Create This Task Now', style: 'primary', prompt: `Create task for ${probeText} with Elena and Marcus due tomorrow` }
          ]
        }
      };
    }

    // 3. Default: Full Priority Order across all active tasks
    if (T?.runCopilotSync) { try { T.runCopilotSync({ silent: true }); } catch (_) {} }
    const ranked = (T?.analyzeAll ? T.analyzeAll() : Core.prioritizeTasks(S.getState().tasks || [], S.getState(), { mailThreads: mails })).filter(x => x.task.status !== 'DONE');
    const autoResolvedCount = (S.getState().tasks || []).filter(t => t.status === 'DONE' && t.autoResolved).length;
    if (!ranked.length) {
      return {
        intent: 'copilot',
        category: 'MK Task Intelligence',
        message: `**MK Task Priority Queue**\nYou have **0 active tasks** (${autoResolvedCount} auto-resolved by MK Co-Pilot). Ask me to **“Scan mail and inventory for tasks”** or create a task with a PO #, Order #, or SKU.`,
        meta: {
          actions: [{ label: '⚡ Scan Mail & Inventory', style: 'primary', prompt: 'Scan mail and inventory for tasks' }]
        }
      };
    }
    const lines = [
      `**MK Co-Pilot Priority Order (${ranked.length} Active · ${autoResolvedCount} Auto-Resolved)**`
    ];
    ranked.slice(0, 7).forEach(({ task, analysis }) => {
      const team = (task.assignees || []).map(a => a.name).join(', ');
      const refs = analysis.references.slice(0, 2).map(r => r.code).join(', ');
      lines.push(
        `**#${analysis.rank} · ${analysis.tier} (${analysis.score}/100)** — ${task.title}${task.autoCreatedBy === 'mk-copilot' ? ' ✨' : ''}\n` +
        `   ${refs ? `Refs: \`${refs}\` · ` : ''}${team ? `Team: ${team} · ` : ''}${analysis.reasons[0] || ''}`
      );
    });
    const critCount = ranked.filter(x => x.analysis.tier === 'CRITICAL').length;
    return {
      intent: 'copilot',
      category: 'MK Task Intelligence',
      entity: ranked[0] ? { type: 'TASK', id: ranked[0].task.id, label: ranked[0].task.title } : null,
      message: lines.join('\n'),
      meta: {
        metrics: [
          { label: 'Active', value: String(ranked.length), tone: 'info' },
          { label: 'Critical', value: String(critCount), tone: critCount ? 'critical' : 'ok' },
          { label: 'Auto-Resolved', value: String(autoResolvedCount), tone: 'teal' }
        ],
        actions: [
          { label: '🔔 Remind Team on #1', style: 'primary', prompt: 'Send reminder for #1' },
          { label: '⚡ Re-Scan Mail & ERP', style: 'teal', prompt: 'Scan mail and inventory for tasks' },
          { label: '↗ Open Tasks', style: 'ghost', href: 'tasks.html' }
        ],
        followUps: ['Create task for PO-2026-887411 escalation with Elena and Marcus due tomorrow', 'Show executive briefing']
      }
    };
  }

  async function routeQuestion(question) {
    const raw = clean(question);
    const powerAnswer = await handlePowerCommand(raw);
    if (powerAnswer) return powerAnswer;
    const copilot = window.MKCopilot?.handle(raw);
    if (copilot) return copilot;
    const q = raw.toLowerCase();

    if (/^(voice on|enable voice|turn (the )?voice on)/.test(q)) {
      if (!profile.voiceEnabled) { profile.voiceEnabled = true; saveProfile(); syncVoiceUi(); }
      return { intent: "voice", category: "voice", message: "Voice is enabled." };
    }
    if (/^(voice off|disable voice|turn (the )?voice off)/.test(q)) {
      profile.voiceEnabled = false; saveProfile(); syncVoiceUi(); window.speechSynthesis?.cancel();
      return { intent: "voice", category: "voice", message: "Voice is disabled." };
    }
    if (/^(?:supply\s*)?ai(?:\s+link)?\s+(?:on|enable|connect)|^(?:enable|connect)\s+(?:the\s+)?(?:supply\s*)?ai/.test(q)) return setSpaceEnabled(true, false);
    if (/^(?:supply\s*)?ai(?:\s+link)?\s+(?:off|disable|disconnect)|^(?:disable|disconnect)\s+(?:the\s+)?(?:supply\s*)?ai/.test(q)) return setSpaceEnabled(false, false);
    if (/supply ai status|ai connection status|hugging face status/.test(q)) {
      return { intent: "space", category: "AI connection", message: window.MKAI?.getStatus().message || "Verified local analyst ready." };
    }

    const remember = raw.match(/^remember(?: that)?\s+(.+)/i);
    if (remember) {
      profile.notes = Array.isArray(profile.notes) ? profile.notes : [];
      profile.notes.push({ text: remember[1], createdAt: new Date().toISOString(), region: regionCode() });
      profile.notes = profile.notes.slice(-100);
      saveProfile();
      return { intent: "learn", category: "learning", message: `Learned and stored locally: “${remember[1]}”. I’ll retain it for future decisions in this browser.` };
    }
    if (/what (have|did) you learn|show (your )?learning|learning status/.test(q)) return learningSummary();
    if (/what can you do|help|capabilit|how do you work/.test(q)) return capabilityAnswer();

    const settingResult = updateSettingFromQuestion(q);
    if (settingResult) return settingResult;

    if (/\b(track|tracking)\b/.test(q)) {
      const candidate = raw.match(/\b(1Z[A-Z0-9]{10,}|\d{10,35}|[A-Z]{2,5}\d{8,30})\b/i)?.[1];
      if (candidate) return executeTracking(candidate);
      if (/open|go to|show/.test(q)) return navigateTo("tracking");
    }

    if (/\b(export|download)\b/.test(q)) return exportCurrentReport();

    const route = Object.keys(ROUTES).sort((a, b) => b.length - a.length).find(name => q.includes(name));
    if (route && /\b(open|go|navigate|show|take me)\b/.test(q)) return navigateTo(route);

    if (/sales|revenue|margin|seller/.test(q) && !/stock|reorder/.test(q)) return salesAnswer(q);
    if (/vendor.*po|open.*(vendor|po)|purchase order|shipping window|shipped.*quantit|ordered.*quantit|tracking.*update|supplier.*shipment|procurement/i.test(q)) return vendorPOAnswer(q);

    const knowledge = supplyChainKnowledge(q);
    if (knowledge) return knowledge;

    const analysis = await getInventoryAnalysis();
    if (!analysis) {
      const S = window.StarkSystem, Core = window.MKCopilotCore;
      if (S && Core) {
        if (/what[- ]?if|scenario|simulate|if demand|if lead|if supplier|if stock|if safety/i.test(q)) {
          const sim = Core.simulateLiveInventoryScenario(raw, S.getState(), conversation.lastEntity);
          if (sim) return { intent: "mk-power", category: "Live What-If Simulation", message: sim.markdown, meta: { metrics: sim.metrics, actions: sim.actions, followUps: sim.followUps } };
        }
        const brief = Core.buildExecutiveBriefing(S.getState(), getLiveMails());
        return {
          intent: "mk-power",
          category: "Executive Briefing",
          message: `Here is your live MK97 ERP operational pulse *(type \`/\` to browse all commands & actions)*:\n\n${brief.markdown}`,
          meta: { metrics: brief.metrics, actions: brief.actions, followUps: brief.followUps }
        };
      }
      return { intent: "analysis", category: "data", message: `There is no ${REGION_NAMES[regionCode()]} inventory report available. Upload a Raw Report first; I will analyze it automatically as soon as it is stored.` };
    }
    lastAnalysis = analysis;

    let matched = findItemInQuestion(q, analysis.items);
    if (!matched && /^(why|explain|how confident|what next|what should|and why|tell me more)/.test(q) && conversation.lastItemKey) {
      matched = analysis.items.find(item => item.key === conversation.lastItemKey) || null;
    }
    if (/what[- ]?if|scenario|simulate|if demand|if lead|if supplier|if stock|if coverage/.test(q)) return scenarioAnswer(q, analysis, matched);
    if (/data quality|audit (the )?data|validate data|missing data|bad data|anomal/.test(q)) return dataQualityAnswer(analysis);
    if (/action plan|prioriti[sz]e|what should (i|we) do|next actions?/.test(q)) return actionPlanAnswer(analysis);
    if (/confidence|how certain|accuracy|reliab/.test(q)) return confidenceAnswer(analysis, matched);
    const brand = findBrandInQuestion(q, analysis.scoped);
    if (brand && /brand|supplier|vendor|lead time|analy|performance|how is/.test(q)) return brandSupplierAnswer(brand, analysis);
    if (matched) return explainItem(matched, analysis);
    if (/^(why|explain|tell me more)/.test(q)) return followUpAnswer(analysis);
    if (/why.*stock.?out|stock.?out.*why|stock.?out risk/.test(q)) return stockoutAnswer(analysis);
    if (/why.*demand|explain demand|demand reason|demand analysis/.test(q)) return demandAnswer(analysis);
    if (/reorder|replenish|purchase|buy/.test(q)) return reorderAnswer(analysis);
    if (/excess|dead stock|no demand|overstock/.test(q)) return excessAnswer(analysis);
    if (/analy|summary|overview|what.*action|recommend|decision|current data/.test(q)) return portfolioAnswer(analysis);

    return portfolioAnswer(analysis, `I interpreted this as a request for the current ${REGION_NAMES[regionCode()]} decision summary.`);
  }

  function updateSettingFromQuestion(q) {
    if (/what.?if|scenario|simulate/.test(q)) return null;
    const patterns = [
      { key: "critical", label: "critical stock", regex: /(?:set|change|make)\s+(?:the\s+)?(?:critical stock|minimum carrying(?: quantity| units)?)\s+(?:to\s+)?(\d+(?:\.\d+)?)/ },
      { key: "coverage", label: "coverage months", regex: /(?:set|change|make)\s+(?:the\s+)?(?:coverage|coverage months|demand buffer)\s+(?:to\s+)?(\d+(?:\.\d+)?)/ },
      { key: "delay", label: "supplier delay days", regex: /(?:set|change|make)\s+(?:the\s+)?(?:supplier delay|supplier delay days|supplier window)\s+(?:to\s+)?(\d+(?:\.\d+)?)/ }
    ];
    const match = patterns.map(pattern => ({ pattern, match: q.match(pattern.regex) })).find(item => item.match);
    if (!match) return null;
    const value = Number(match.match[1]);
    const limits = match.pattern.key === "delay" ? [0, 3650] : [0, 120];
    if (!Number.isFinite(value) || value < limits[0] || value > limits[1]) return { intent: "settings", category: "control", message: `${match.pattern.label} must be between ${limits[0]} and ${limits[1]}. No setting was changed.` };
    const key = `stark-inventory-settings-${regionKey()}`;
    let settings = { ...DEFAULT_SETTINGS };
    try { settings = { ...settings, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch (_) {}
    settings[match.pattern.key] = value;
    localStorage.setItem(key, JSON.stringify(settings));
    publishPulse("inventory-settings");
    const field = document.getElementById(`setting-${match.pattern.key}`);
    if (field) field.value = String(value);
    return { intent: "settings", category: "action completed", message: `${match.pattern.label} is now ${decimal.format(value)} for ${REGION_NAMES[regionCode()]}. Reorder decisions will use the updated setting.` };
  }

  function navigateTo(name) {
    const route = ROUTES[name];
    if (!route) return { intent: "navigation", category: "control", message: "That page is not available in the current workspace." };
    const code = regionCode();
    const url = route.endsWith(".html")
      ? `${route}${route === "sales-analysis.html" || route === "events.html" ? `?region=${code}` : ""}`
      : `${route}-${code.toLowerCase()}.html`;
    window.setTimeout(() => location.assign(url), 550);
    return { intent: "navigation", category: "action started", message: `Opening ${name} for ${REGION_NAMES[code]}.` };
  }

  function exportCurrentReport() {
    const candidates = [
      document.querySelector("#export-workbook:not([disabled])"),
      document.querySelector("#export-reorder-xlsx:not([disabled])"),
      document.querySelector("#export-active-brands:not([disabled])"),
      document.querySelector("[data-export]:not([disabled])")
    ].filter(Boolean);
    const button = candidates[0];
    if (!button) return { intent: "export", category: "control", message: "There is no exportable report on this page yet. Upload or generate the report first; I will keep export disabled to prevent an empty file." };
    window.setTimeout(() => button.click(), 250);
    return { intent: "export", category: "action completed", message: "The current report export has started. The workbook will include the report data and supported visual charts." };
  }

  function executeTracking(trackingNumber) {
    if (!/shipment-tracking\.html$/i.test(location.pathname)) {
      try { sessionStorage.setItem("mk-pending-tracking", trackingNumber); } catch (_) {}
      window.setTimeout(() => location.assign("shipment-tracking.html"), 550);
      return { intent: "tracking", category: "action started", message: `Opening Tracking for ${trackingNumber}.` };
    }
    const field = document.getElementById("tracking-number");
    const form = document.getElementById("tracking-form");
    if (!field || !form) return { intent: "tracking", category: "control", message: "The tracking control is unavailable on this page." };
    field.value = trackingNumber;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    window.setTimeout(() => form.requestSubmit(), 200);
    return { intent: "tracking", category: "action completed", message: `Tracking ${trackingNumber}.` };
  }

  function capabilityAnswer() {
    return {
      intent: "help",
      category: "capabilities",
      message: `**${ENGINE_VERSION} capabilities**\nI analyze inventory and sales reports; investigate stockout, demand, supplier timing and data quality; compare regions and brands; calculate what-if scenarios; and propose actions with source evidence. With your Hugging Face AI enabled, I use conversational context, verified website facts and the read-only tools available in your Supply AI Chain Hub. Local monitoring detects report changes while this website is open. Use the analyst workspace for report uploads, alerts, conversations and AI connection settings.`
    };
  }

  function learningSummary() {
    const tasks = Object.entries(profile.taskCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const taskText = tasks.length ? tasks.map(([name, count]) => `${name} (${count})`).join(", ") : "no repeated task pattern yet";
    const modelState = profile.modelState?.[regionCode()];
    const modelText = modelState ? ` Latest ${REGION_NAMES[regionCode()]} training state: ${modelState.historyFiles} retained reports, ${modelState.averageConfidence}/100 mean confidence, data grade ${modelState.dataGrade}, most-selected method ${modelState.primaryMethod}.` : "";
    return {
      intent: "learn",
      category: "learning",
      message: `I have learned ${profile.notes?.length || 0} saved instruction${profile.notes?.length === 1 ? "" : "s"}, ${finite(profile.feedback?.useful)} useful responses and ${finite(profile.feedback?.correction)} requested corrections. Most-used task patterns: ${taskText}.${modelText} Forecast selection is re-backtested whenever report history changes; it does not alter the official reorder formula or invent unsupported demand.`
    };
  }

  function supplyChainKnowledge(q) {
    const entries = [
      {
        match: /safety stock|buffer stock/,
        title: "Safety stock",
        answer: "Safety stock protects against demand and lead-time uncertainty. A statistical design commonly uses service factor × demand deviation × √lead time; a simpler operational buffer uses demand during an agreed protection period. MK keeps your configured three-unit carrying minimum separate from demand coverage so the official reorder quantity remains auditable."
      },
      {
        match: /economic order quantity|\beoq\b/,
        title: "Economic order quantity",
        answer: "EOQ balances ordering and annual holding cost: √(2 × annual demand × order cost ÷ annual holding cost per unit). It is useful only when demand, cost and replenishment assumptions are sufficiently stable; capacity, minimum-order quantities, cash, shelf life and service targets still constrain the result."
      },
      {
        match: /reorder point|\brop\b/,
        title: "Reorder point",
        answer: "A reorder point is expected demand during replenishment lead time plus safety stock. Your dashboard goes further by protecting configured coverage and carrying units, adding client commitments, then subtracting on-hand and only eligible inbound supply."
      },
      {
        match: /abc class|abc analysis|pareto/,
        title: "ABC analysis",
        answer: "ABC analysis ranks items by cumulative demand contribution: A items receive the tightest control, B items routine control, and C items simplified control. MK recalculates class from the current eligible scope using your A and B thresholds and uses class only to prioritize risk—not to inflate reorder quantity."
      },
      {
        match: /inventory turn|turnover|days inventory/,
        title: "Inventory productivity",
        answer: "Inventory turns equal annualized cost of goods sold divided by average inventory value; days inventory is roughly 365 ÷ turns. High turns can indicate efficiency or insufficient buffer, while low turns can indicate excess, slow demand or deliberate service protection. Interpret both with service level and stockout rate."
      },
      {
        match: /otif|on time in full|fill rate|service level/,
        title: "Service performance",
        answer: "OTIF measures orders delivered on the promised date and in the complete quantity. Fill rate measures demand satisfied immediately from available stock. Service level measures the probability or frequency of avoiding a stockout. They answer different questions and should not be used interchangeably."
      },
      {
        match: /incoterm|shipping responsibility|freight responsibility/,
        title: "Trade responsibility",
        answer: "Incoterms allocate delivery tasks, cost and risk between seller and buyer, but they do not determine title, payment terms or every customs obligation. Confirm the named place, edition, insurance requirement, importer/exporter of record and contract terms before relying on a freight decision."
      },
      {
        match: /regulation|compliance|customs|tariff|duty|hs code|sanction|restricted part|forced labor|country of origin/,
        title: "Compliance checkpoint",
        answer: `For ${REGION_NAMES[regionCode()]}, validate product classification, country of origin, customs value, importer/exporter responsibility, sanctions and restricted-party screening, forced-labor controls, product-specific safety or labeling, environmental obligations and record retention before execution. Rules change; MK can flag missing evidence but the current official requirement must be confirmed with the responsible compliance professional or authority before shipment.`
      }
    ];
    const entry = entries.find(item => item.match.test(q));
    return entry ? { intent: "knowledge", category: "supply chain knowledge", message: `**${entry.title}**\n${entry.answer}` } : null;
  }

  async function getInventoryAnalysis(requestedCode = regionCode()) {
    const code = normalizeRegion(requestedCode);
    const dataset = await loadInventoryDataset(code);
    if (!dataset?.rows?.length) return null;
    const settings = loadSettings(code);
    const brands = loadBrands(code);
    const history = await loadHistory(code);
    const items = dataset.rows.map(row => analyzeRow(row, settings, brands, history));
    const scoped = items.filter(item => item.activeBrand && item.eligible && !item.excluded);
    assignAbcClasses(scoped, settings);
    scoped.forEach(item => applyDecisionIntelligence(item, settings));
    const reorders = scoped.filter(item => item.recommended > 0);
    const stockouts = scoped.filter(item => item.stockoutRisk);
    const noDemand = scoped.filter(item => item.demand <= 0 && item.onHand > 0);
    const excess = scoped.filter(item => item.demand > 0 && item.monthsCover > Math.max(4, settings.coverage * 2));
    const dataQuality = buildDataQualityReport(dataset.rows, items);
    const brandSummaries = buildBrandSummaries(scoped);
    return {
      code, dataset, settings, items, scoped, reorders, stockouts, noDemand, excess, dataQuality, brandSummaries,
      totalDemand: sum(scoped, item => item.demand),
      totalStock: sum(scoped, item => item.onHand),
      recommendedUnits: sum(reorders, item => item.recommended),
      activeBrands: new Set(scoped.map(item => item.brand)).size,
      historyFiles: history.fileCount,
      averageConfidence: scoped.length ? mean(scoped.map(item => item.confidence.score)) : 0,
      criticalRisks: scoped.filter(item => item.priority === "Critical").length
    };
  }

  function analyzeRow(row, settings, brands, history) {
    const brand = clean(row.brand) || "Unspecified";
    const status = normalize(row.status);
    const brandSetting = brands[brand] || brands[Object.keys(brands).find(name => normalize(name) === normalize(brand))] || {};
    const eligible = ["LIVE", "FASHION", "BACKORDER"].includes(status);
    const excluded = ["FEEDS ONLY", "INTERNAL USE", "PRESENTATION"].some(value => status.includes(value));
    const activeBrand = brandSetting.active !== false;
    const demand = Math.max(0, finite(row.avg3) || finite(row.vol3) / 3);
    const last30 = Math.max(0, finite(row.last30));
    const onHand = Math.max(0, finite(row.stockQty));
    const openClient = Math.max(0, finite(row.openClient));
    const openSupplier = Math.max(0, finite(row.openSupplier));
    const leadMonths = leadTimeMonths(brandSetting.leadTime);
    const supplierDate = parseDate(row.supplierEnd || row.supplierStart);
    const daysUntil = supplierDate ? Math.ceil((supplierDate - startOfToday()) / 86400000) : null;
    const supplierEligible = Number.isFinite(daysUntil) ? daysUntil >= 0 && daysUntil <= settings.delay : Math.max(0, finite(row.supplierDueQty)) > 0;
    const planningSupplier = supplierEligible ? (Number.isFinite(finite(row.supplierDueQty)) && finite(row.supplierDueQty) > 0 ? Math.min(openSupplier, finite(row.supplierDueQty)) : openSupplier) : 0;
    const need = demand * (leadMonths + settings.coverage) + settings.critical + openClient;
    const recommended = activeBrand && eligible && !excluded ? Math.max(0, Math.ceil(need - onHand - planningSupplier - 1e-9)) : 0;
    const netAvailable = onHand + planningSupplier - openClient;
    const monthsCover = demand > 0 ? Math.max(0, onHand - openClient) / demand : onHand > 0 ? Infinity : 0;
    const daysToStockout = demand > 0 ? Math.max(0, onHand - openClient) / demand * 30.44 : null;
    const stockoutRisk = demand > 0 && netAvailable < demand * Math.max(leadMonths, 1 / 30.44);
    const trend = demand > 0 ? (last30 - demand) / demand : last30 > 0 ? 1 : 0;
    const key = normalize(row.model || row.itemid || `${brand}|${row.product}`);
    const learned = history.byItem.get(key) || [];
    const forecast = learnedForecast({ demand, last30 }, learned);
    const confidence = decisionConfidence(row, { demand, last30, leadMonths, learned, forecast, supplierDate });
    return { ...row, key, brand, status, activeBrand, eligible, excluded, demand, last30, onHand, openClient, openSupplier, leadMonths, daysUntil, planningSupplier, recommended, netAvailable, monthsCover, daysToStockout, stockoutRisk, trend, learned, forecast, confidence, abc: "C", riskScore: 0, priority: "Monitor", nextAction: "Monitor" };
  }

  function learnedForecast(current, history) {
    const values = history.map(historicalDemand).filter(Number.isFinite).map(value => Math.max(0, value));
    const currentSignal = Math.max(0, current.last30 || current.demand);
    if (!values.length) {
      const base = current.last30 && current.demand ? .65 * current.last30 + .35 * current.demand : currentSignal;
      const spread = Math.max(1, Math.abs(current.last30 - current.demand));
      return { value: base, method: current.last30 ? "recent-demand blend" : "three-month rate", observations: 0, wape: null, bias: 0, accuracy: 55, low: Math.max(0, base - spread), high: base + spread, selectedBy: "limited-history fallback" };
    }

    const methods = {
      "latest observation": series => series.at(-1) || 0,
      "three-period average": series => mean(series.slice(-3)),
      "recency-weighted average": series => {
        const recent = series.slice(-4), weights = recent.map((_, index) => index + 1);
        return recent.reduce((total, value, index) => total + value * weights[index], 0) / weights.reduce((total, value) => total + value, 0);
      },
      "three-period median": series => median(series.slice(-3)),
      "damped trend": series => {
        const recent = series.slice(-4), latest = recent.at(-1) || 0;
        if (recent.length < 2) return latest;
        return Math.max(0, latest + .55 * (latest - recent[0]) / (recent.length - 1));
      }
    };
    const scored = Object.entries(methods).map(([name, method]) => {
      const errors = [], actuals = [], signed = [];
      for (let index = 2; index < values.length; index += 1) {
        const prediction = Math.max(0, finite(method(values.slice(0, index))));
        const actual = values[index];
        errors.push(Math.abs(actual - prediction));
        signed.push(prediction - actual);
        actuals.push(actual);
      }
      const mae = mean(errors);
      const denominator = actuals.reduce((total, value) => total + Math.abs(value), 0);
      const wape = errors.length ? (denominator > 0 ? errors.reduce((total, value) => total + value, 0) / denominator : mae / Math.max(1, mean(actuals))) : null;
      return { name, method, mae, wape, bias: mean(signed), tests: errors.length };
    }).sort((a, b) => (a.wape ?? 1) - (b.wape ?? 1) || a.mae - b.mae);
    const selected = scored[0];
    const fullSeries = [...values, currentSignal];
    const value = Math.max(0, finite(selected.method(fullSeries)));
    const residual = selected.tests ? Math.max(selected.mae, value * (selected.wape || 0)) : Math.max(deviation(fullSeries.slice(-4)), value * .2);
    const accuracy = selected.wape == null ? clamp(58 + values.length * 4, 58, 76) : clamp((1 - selected.wape) * 100, 20, 96);
    return {
      value, method: selected.name, observations: values.length, wape: selected.wape, bias: selected.bias,
      accuracy, low: Math.max(0, value - residual), high: value + residual,
      selectedBy: selected.tests ? `lowest backtest error across ${selected.tests} holdout${selected.tests === 1 ? "" : "s"}` : "best fit with limited history"
    };
  }

  function historicalDemand(row) {
    if (hasValue(row.avg3)) return Math.max(0, finite(row.avg3));
    if (hasValue(row.vol3)) return Math.max(0, finite(row.vol3) / 3);
    if (hasValue(row.last30)) return Math.max(0, finite(row.last30));
    return NaN;
  }

  function decisionConfidence(row, signals) {
    const required = [row.model || row.itemid, row.brand, row.status];
    const completeness = (required.filter(hasValue).length + (hasValue(row.avg3) || hasValue(row.vol3) || hasValue(row.last30) ? 1 : 0) + (hasValue(row.stockQty) ? 1 : 0)) / 5 * 100;
    const series = signals.learned.map(historicalDemand).filter(Number.isFinite);
    const stability = series.length > 1 ? clamp(100 - deviation(series) / Math.max(1, mean(series)) * 65, 25, 100) : 55;
    const historyDepth = clamp(series.length / 8 * 100, 0, 100);
    const forecastAccuracy = finite(signals.forecast.accuracy) || 55;
    let score = completeness * .38 + forecastAccuracy * .32 + stability * .15 + historyDepth * .15;
    if (!signals.leadMonths) score -= 8;
    if (signals.last30 <= 0 && signals.demand > 0) score -= 4;
    score = clamp(score, 20, series.length ? 96 : 72);
    return {
      score, level: score >= 80 ? "High" : score >= 60 ? "Moderate" : "Low",
      completeness, stability, historyDepth, forecastAccuracy,
      limitations: [
        !signals.leadMonths ? "brand lead time is missing" : "",
        !series.length ? "no prior retained observation is available" : "",
        completeness < 100 ? "one or more core fields are incomplete" : ""
      ].filter(Boolean)
    };
  }

  function assignAbcClasses(items, settings) {
    const ranked = items.slice().sort((a, b) => b.demand - a.demand), total = sum(ranked, item => item.demand);
    let cumulative = 0;
    ranked.forEach(item => {
      const openingShare = total > 0 ? cumulative / total * 100 : 100;
      cumulative += item.demand;
      item.abc = openingShare < settings.a ? "A" : openingShare < settings.b ? "B" : "C";
    });
  }

  function applyDecisionIntelligence(item, settings) {
    const leadDays = Math.max(item.leadMonths * 30.44, 1);
    const shortageRatio = item.demand > 0 ? item.recommended / Math.max(1, item.demand * (item.leadMonths + settings.coverage)) : 0;
    let score = 0;
    if (item.stockoutRisk) score += 36;
    if (item.daysToStockout != null && item.daysToStockout <= leadDays) score += 12;
    score += clamp(shortageRatio * 22, 0, 22);
    if (item.trend > .15) score += clamp(item.trend * 12, 0, 12);
    if (item.openClient > 0) score += 7;
    if (item.openSupplier > item.planningSupplier) score += 6;
    if (item.abc === "A") score += 8; else if (item.abc === "B") score += 4;
    if (item.confidence.score < 60) score += 4;
    item.riskScore = clamp(Math.round(score), 0, 100);
    item.priority = item.riskScore >= 75 ? "Critical" : item.riskScore >= 55 ? "High" : item.riskScore >= 30 ? "Medium" : "Monitor";
    item.nextAction = item.recommended > 0
      ? item.openSupplier > item.planningSupplier && item.stockoutRisk ? "Expedite eligible inbound and review purchase quantity" : "Review and release replenishment"
      : item.demand <= 0 && item.onHand > 0 ? "Stop replenishment and review excess disposition"
      : item.monthsCover > Math.max(4, settings.coverage * 2) ? "Freeze purchasing and rebalance excess stock"
      : "Monitor demand and supplier timing";
  }

  function buildDataQualityReport(rows, items) {
    const keys = new Map();
    items.forEach(item => keys.set(item.key, (keys.get(item.key) || 0) + 1));
    const issues = {
      missingModel: rows.filter(row => !hasValue(row.model) && !hasValue(row.itemid)).length,
      missingBrand: rows.filter(row => !hasValue(row.brand)).length,
      missingStatus: rows.filter(row => !hasValue(row.status)).length,
      missingDemand: rows.filter(row => !hasValue(row.avg3) && !hasValue(row.vol3) && !hasValue(row.last30)).length,
      missingStock: rows.filter(row => !hasValue(row.stockQty)).length,
      negativeValues: rows.filter(row => [row.avg3, row.vol3, row.last30, row.stockQty, row.openClient, row.openSupplier].some(value => hasValue(value) && finite(value) < 0)).length,
      duplicateItems: [...keys.values()].reduce((total, count) => total + Math.max(0, count - 1), 0),
      invalidSupplierDates: rows.filter(row => [row.supplierStart, row.supplierEnd].some(value => hasValue(value) && !parseDate(value))).length,
      inboundWithoutDate: rows.filter(row => finite(row.openSupplier) > 0 && !parseDate(row.supplierStart) && !parseDate(row.supplierEnd) && finite(row.supplierDueQty) <= 0).length,
      missingLeadTime: items.filter(item => item.activeBrand && item.eligible && !item.leadMonths).length
    };
    const total = Math.max(1, rows.length);
    const critical = issues.missingModel + issues.missingBrand + issues.missingDemand + issues.missingStock + issues.negativeValues;
    const advisory = issues.duplicateItems + issues.invalidSupplierDates + issues.inboundWithoutDate + issues.missingLeadTime;
    const score = clamp(Math.round(100 - critical / total * 65 - advisory / total * 25), 0, 100);
    return { score, grade: score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F", issues, totalRows: rows.length, issueCount: critical + advisory + issues.missingStatus };
  }

  function buildBrandSummaries(items) {
    const grouped = new Map();
    items.forEach(item => {
      if (!grouped.has(item.brand)) grouped.set(item.brand, { brand: item.brand, items: [], demand: 0, stock: 0, recommended: 0, openSupplier: 0, atRisk: 0 });
      const group = grouped.get(item.brand);
      group.items.push(item);
      group.demand += item.demand;
      group.stock += item.onHand;
      group.recommended += item.recommended;
      group.openSupplier += item.openSupplier;
      if (item.stockoutRisk) group.atRisk += 1;
    });
    return [...grouped.values()].map(group => ({
      ...group,
      coverage: group.demand > 0 ? group.stock / group.demand : group.stock > 0 ? Infinity : 0,
      averageConfidence: mean(group.items.map(item => item.confidence.score)),
      averageLeadMonths: mean(group.items.map(item => item.leadMonths))
    }));
  }

  function scenarioAnswer(question, analysis, matchedItem) {
    const scenario = parseScenario(question, analysis.settings);
    if (!scenario.changed) {
      return { intent: "scenario", category: "scenario", message: "Give me a measurable scenario, for example: “What if demand increases 20%?”, “Simulate an 8-week lead time”, “What if 100 supplier units arrive?”, or “Set on hand to 50 for MODEL#”. I will compare it with the current plan without changing stored data." };
    }
    const scope = matchedItem ? [matchedItem] : analysis.scoped;
    const results = scope.map(item => simulateItem(item, analysis.settings, scenario));
    const currentUnits = sum(scope, item => item.recommended);
    const scenarioUnits = sum(results, result => result.recommended);
    const currentRisks = scope.filter(item => item.stockoutRisk).length;
    const scenarioRisks = results.filter(result => result.stockoutRisk).length;
    const delta = scenarioUnits - currentUnits;
    const top = results.slice().sort((a, b) => Math.abs(b.recommended - b.item.recommended) - Math.abs(a.recommended - a.item.recommended)).slice(0, matchedItem ? 1 : 3);
    const lines = top.map(result => `${result.item.model || result.item.itemid}: ${number.format(result.item.recommended)} → ${number.format(result.recommended)} units (${signedNumber(result.recommended - result.item.recommended)})`).join("\n");
    return {
      intent: "scenario", category: "what-if analysis", itemKey: matchedItem?.key || "",
      message: `**Scenario result — ${scenario.description.join(", ")}**\nScope: ${matchedItem ? `${matchedItem.model || matchedItem.itemid} — ${matchedItem.brand}` : `${number.format(scope.length)} eligible items`}. Recommended units change from ${number.format(currentUnits)} to ${number.format(scenarioUnits)} (${signedNumber(delta)}). Lead-time stockout risks change from ${number.format(currentRisks)} to ${number.format(scenarioRisks)}.\nLargest effects:\n${lines || "No item-level change."}\nThis is a simulation only; stored settings and reports were not changed.`
    };
  }

  function parseScenario(question, settings) {
    const q = clean(question).toLowerCase(), scenario = { changed: false, description: [] };
    const percentAfter = q.match(/demand.{0,24}?(increase|rise|grow|up|decrease|fall|drop|down)(?:s|d)?(?:\s+by)?\s+(\d+(?:\.\d+)?)\s*%/);
    const percentBefore = q.match(/(\d+(?:\.\d+)?)\s*%\s+(increase|rise|growth|up|decrease|fall|drop|down).{0,12}?demand/);
    const percent = percentAfter ? { amount: Number(percentAfter[2]), direction: percentAfter[1] } : percentBefore ? { amount: Number(percentBefore[1]), direction: percentBefore[2] } : null;
    if (percent) {
      const negative = /decrease|fall|drop|down/.test(percent.direction);
      scenario.demandMultiplier = Math.max(0, 1 + (negative ? -1 : 1) * percent.amount / 100);
      scenario.description.push(`demand ${negative ? "down" : "up"} ${decimal.format(percent.amount)}%`);
      scenario.changed = true;
    }
    const lead = q.match(/lead\s*time.{0,18}?(?:to|at|is|of)\s*(\d+(?:\.\d+)?)\s*(business\s*days?|working\s*days?|days?|weeks?|months?)/);
    if (lead) {
      scenario.leadMonths = leadTimeMonths(`${lead[1]} ${lead[2]}`);
      scenario.description.push(`lead time ${decimal.format(Number(lead[1]))} ${lead[2]}`);
      scenario.changed = true;
    }
    const coverage = q.match(/coverage.{0,14}?(?:to|at|is|of)\s*(\d+(?:\.\d+)?)\s*months?/);
    if (coverage) {
      scenario.coverage = Math.max(0, Number(coverage[1]));
      scenario.description.push(`coverage ${decimal.format(scenario.coverage)} months`);
      scenario.changed = true;
    }
    const inbound = q.match(/(?:supplier|inbound).{0,22}?(?:units?|qty|quantity|arriv\w*)?.{0,10}?(\d+(?:\.\d+)?)\s*units?/) || q.match(/(\d+(?:\.\d+)?)\s*(?:supplier|inbound)\s*units?/);
    if (inbound) {
      scenario.planningSupplier = Math.max(0, Number(inbound[1]));
      scenario.description.push(`${number.format(scenario.planningSupplier)} eligible inbound units`);
      scenario.changed = true;
    }
    const onHand = q.match(/(?:on[ -]?hand|stock).{0,16}?(?:to|at|is|of)\s*(\d+(?:\.\d+)?)\s*(?:units?)?/);
    if (onHand) {
      scenario.onHand = Math.max(0, Number(onHand[1]));
      scenario.description.push(`on hand ${number.format(scenario.onHand)}`);
      scenario.changed = true;
    }
    const buffer = q.match(/(?:buffer|safety\s*stock|safety).{0,16}?(?:to|at|is|of)?\s*(\d+(?:\.\d+)?)\s*(?:units?)?/);
    if (buffer) {
      scenario.buffer = Math.max(0, Number(buffer[1]));
      scenario.description.push(`buffer ${number.format(scenario.buffer)} units`);
      scenario.changed = true;
    }
    if (scenario.coverage == null) scenario.coverage = settings.coverage;
    return scenario;
  }

  function simulateItem(item, settings, scenario) {
    const demand = item.demand * (scenario.demandMultiplier ?? 1);
    const leadMonths = scenario.leadMonths ?? item.leadMonths;
    const coverage = scenario.coverage ?? settings.coverage;
    const onHand = scenario.onHand ?? item.onHand;
    const planningSupplier = scenario.planningSupplier ?? item.planningSupplier;
    const critical = scenario.buffer ?? settings.critical;
    const need = demand * (leadMonths + coverage) + critical + item.openClient;
    const recommended = item.activeBrand && item.eligible && !item.excluded ? Math.max(0, Math.ceil(need - onHand - planningSupplier - 1e-9)) : 0;
    const netAvailable = onHand + planningSupplier - item.openClient;
    return { item, demand, leadMonths, coverage, onHand, planningSupplier, recommended, stockoutRisk: demand > 0 && netAvailable < demand * Math.max(leadMonths, 1 / 30.44) };
  }

  function dataQualityAnswer(analysis) {
    const quality = analysis.dataQuality;
    const labels = {
      missingModel: "missing model/item IDs", missingBrand: "missing brands", missingStatus: "missing statuses",
      missingDemand: "missing demand signals", missingStock: "missing stock values", negativeValues: "negative numeric rows",
      duplicateItems: "duplicate item keys", invalidSupplierDates: "invalid supplier dates",
      inboundWithoutDate: "inbound quantities without usable arrival dates", missingLeadTime: "eligible items without brand lead time"
    };
    const ranked = Object.entries(quality.issues).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
    const lines = ranked.slice(0, 6).map(([key, count], index) => `${index + 1}. ${number.format(count)} ${labels[key]}`).join("\n");
    return {
      intent: "data-quality", category: "data audit",
      message: `**Data quality: ${quality.score}/100 (grade ${quality.grade})**\nAudited ${number.format(quality.totalRows)} source rows. ${quality.issueCount ? `${number.format(quality.issueCount)} validation exception${quality.issueCount === 1 ? "" : "s"} require review.` : "No material structural exception was detected."}${lines ? `\nTop exceptions:\n${lines}` : ""}\nRecommendations with missing lead time or thin history are automatically assigned lower confidence; questionable values are never silently treated as high-confidence evidence.`
    };
  }

  function actionPlanAnswer(analysis) {
    const risks = analysis.scoped.slice().sort((a, b) => b.riskScore - a.riskScore || b.recommended - a.recommended).slice(0, 5);
    const actions = risks.map((item, index) => `${index + 1}. [${item.priority} ${item.riskScore}/100] ${item.model || item.itemid} — ${item.brand}: ${item.nextAction}${item.recommended ? `; ${number.format(item.recommended)} units` : ""}. Why: ${shortReason(item)}.`).join("\n");
    const qualityAction = analysis.dataQuality.score < 85 ? `\nControl action: resolve the highest data-quality exceptions before approving low-confidence orders (current grade ${analysis.dataQuality.grade}).` : "";
    return { intent: "action-plan", category: "ranked actions", message: `**Ranked next-action plan**\n${actions || "No eligible action is required."}${qualityAction}\nPriorities combine stockout timing, shortage size, demand acceleration, client commitments, inbound timing, ABC importance and evidence confidence. They do not replace an approval decision.` };
  }

  function confidenceAnswer(analysis, item) {
    if (item) {
      const limitations = item.confidence.limitations.length ? item.confidence.limitations.join("; ") : "no material limitation detected";
      return { intent: "confidence", category: "decision confidence", itemKey: item.key, message: `**${item.model || item.itemid} confidence: ${number.format(item.confidence.score)}/100 (${item.confidence.level})**\nForecast backtest accuracy: ${number.format(item.forecast.accuracy)}%. Expected demand range: ${decimal.format(item.forecast.low)}–${decimal.format(item.forecast.high)} units/month. Method: ${item.forecast.method}, selected by ${item.forecast.selectedBy}. Evidence limits: ${limitations}.` };
    }
    const low = analysis.scoped.filter(row => row.confidence.score < 60).length;
    return { intent: "confidence", category: "decision confidence", message: `**Portfolio confidence: ${number.format(analysis.averageConfidence)}/100**\n${number.format(low)} of ${number.format(analysis.scoped.length)} eligible items have low-confidence evidence. Data quality is ${analysis.dataQuality.score}/100 (grade ${analysis.dataQuality.grade}); ${number.format(analysis.historyFiles)} retained report${analysis.historyFiles === 1 ? "" : "s"} support learning. Ask for a model number to see its forecast range, backtest accuracy and limitations.` };
  }

  function brandSupplierAnswer(brand, analysis) {
    const group = analysis.brandSummaries.find(item => item.brand === brand);
    if (!group) return portfolioAnswer(analysis);
    const lateOrUncounted = group.items.filter(item => item.openSupplier > item.planningSupplier).length;
    const top = group.items.slice().sort((a, b) => b.riskScore - a.riskScore)[0];
    return {
      intent: "brand-analysis", category: "brand and supplier", itemKey: top?.key || "",
      message: `**${brand} analysis**\n${number.format(group.items.length)} eligible items; ${number.format(group.atRisk)} lead-time stockout risks; ${number.format(group.recommended)} recommended units; ${decimal.format(group.coverage)} months aggregate cover. Open supplier quantity is ${number.format(group.openSupplier)} units, and ${number.format(lateOrUncounted)} item${lateOrUncounted === 1 ? "" : "s"} have inbound that is late, outside the planning window or not sufficiently dated. Average lead time is ${decimal.format(group.averageLeadMonths * 30.44)} days and evidence confidence is ${number.format(group.averageConfidence)}/100.${top ? ` First review ${top.model || top.itemid}: ${top.nextAction.toLowerCase()}.` : ""}`
    };
  }

  function followUpAnswer(analysis) {
    if (conversation.lastIntent === "stockout") return stockoutAnswer(analysis);
    if (conversation.lastIntent === "demand") return demandAnswer(analysis);
    if (conversation.lastIntent === "reorder") return reorderAnswer(analysis);
    if (conversation.lastIntent === "action-plan") return actionPlanAnswer(analysis);
    if (conversation.lastIntent === "data-quality") return dataQualityAnswer(analysis);
    return portfolioAnswer(analysis, "Here is the evidence behind the current recommendation.");
  }

  function shortReason(item) {
    if (item.stockoutRisk) return `usable supply may last ${decimal.format(item.daysToStockout)} days versus ${decimal.format(item.leadMonths * 30.44)} lead-time days`;
    if (item.openSupplier > item.planningSupplier) return "some inbound supply is outside the counted planning window";
    if (item.trend > .15) return `latest demand is ${number.format(item.trend * 100)}% above the three-month rate`;
    if (item.demand <= 0 && item.onHand > 0) return "stock remains without a supported demand signal";
    if (item.monthsCover > 4) return `${decimal.format(item.monthsCover)} months of stock cover exceeds the review threshold`;
    return "the current stock, demand, lead-time and commitment balance warrants monitoring";
  }

  function signedNumber(value) { return `${value >= 0 ? "+" : "−"}${number.format(Math.abs(value))}`; }

  function explainItem(item, analysis) {
    const supplyGap = Math.max(0, item.recommended);
    const demandDirection = item.trend > .15 ? "accelerating" : item.trend < -.15 ? "softening" : "stable";
    const supplierNote = item.openSupplier > item.planningSupplier ? "Some supplier units fall outside the configured arrival window and were not counted." : item.openSupplier ? "Eligible inbound supply was counted." : "No supplier quantity offsets the requirement.";
    const action = supplyGap > 0 ? `Place or review a purchase for ${number.format(supplyGap)} units` : item.demand <= 0 && item.onHand > 0 ? "Hold purchasing and review transfer, promotion or disposition" : "Maintain the plan and monitor weekly";
    const protectedNeed = item.demand * (item.leadMonths + analysis.settings.coverage) + analysis.settings.critical + item.openClient;
    const limitations = item.confidence.limitations.length ? ` Limits: ${item.confidence.limitations.join("; ")}.` : "";
    return {
      intent: "item-analysis",
      category: "model decision",
      itemKey: item.key,
      message: `**${clean(item.model || item.itemid)} — ${item.brand}**\nDecision: ${action}. Priority is ${item.priority} (${item.riskScore}/100 risk), with ${item.confidence.level.toLowerCase()} confidence (${number.format(item.confidence.score)}/100).\nBusiness reason: protected need is ${number.format(protectedNeed)} units: monthly demand × (lead time + coverage) + ${number.format(analysis.settings.critical)} carrying units + ${number.format(item.openClient)} client commitments. On hand is ${number.format(item.onHand)} and counted inbound is ${number.format(item.planningSupplier)}. ${supplierNote}\nWhy stockout could occur: ${item.stockoutRisk ? `usable supply may last about ${decimal.format(item.daysToStockout)} days, while supplier lead time is ${decimal.format(item.leadMonths * 30.44)} days` : "usable supply is not projected to expire before the replenishment point"}.\nWhy demand is expected: the three-month rate is ${decimal.format(item.demand)} units/month and the last 30 days show ${number.format(item.last30)} units, indicating ${demandDirection} demand. MK forecasts ${decimal.format(item.forecast.value)} units/month (range ${decimal.format(item.forecast.low)}–${decimal.format(item.forecast.high)}) using ${item.forecast.method}, selected by ${item.forecast.selectedBy}.${limitations}`
    };
  }

  function portfolioAnswer(analysis, prefix = "") {
    const top = analysis.scoped.slice().sort((a, b) => b.riskScore - a.riskScore || b.recommended - a.recommended)[0];
    const action = top ? `First action: review ${top.model || top.itemid} (${top.brand}) — ${top.nextAction.toLowerCase()}; ${number.format(top.recommended)} recommended units and ${top.riskScore}/100 risk.` : "No eligible inventory item is available for prioritization.";
    return {
      intent: "portfolio-analysis",
      category: "portfolio decision",
      itemKey: top?.key || "",
      message: `${prefix ? prefix + "\n" : ""}**${REGION_NAMES[analysis.code]} analysis complete**\n${number.format(analysis.scoped.length)} eligible items across ${number.format(analysis.activeBrands)} active brands. ${number.format(analysis.reorders.length)} items require reorder, totaling ${number.format(analysis.recommendedUnits)} units. ${number.format(analysis.stockouts.length)} items have lead-time stockout risk, ${number.format(analysis.criticalRisks)} are critical, ${number.format(analysis.excess.length)} are excess, and ${number.format(analysis.noDemand.length)} have stock with no demand. ${action}\nDecision confidence is ${number.format(analysis.averageConfidence)}/100; data quality is ${analysis.dataQuality.score}/100 (grade ${analysis.dataQuality.grade}). Forecast selection used up to ${number.format(analysis.historyFiles)} retained historical report${analysis.historyFiles === 1 ? "" : "s"}.`
    };
  }

  function stockoutAnswer(analysis) {
    const risks = analysis.stockouts.slice().sort((a, b) => a.daysToStockout - b.daysToStockout || b.recommended - a.recommended).slice(0, 5);
    if (!risks.length) return { intent: "stockout", category: "risk analysis", message: "No eligible item currently has usable supply expiring before its replenishment point. I will recalculate this automatically when new data arrives." };
    const lines = risks.map((item, index) => `${index + 1}. [${item.priority} ${item.riskScore}/100] ${item.model || item.itemid} — ${item.brand}: ${decimal.format(item.daysToStockout)} days to stockout; ${number.format(item.recommended)} units; confidence ${number.format(item.confidence.score)}/100.`).join("\n");
    return { intent: "stockout", category: "risk analysis", itemKey: risks[0]?.key || "", message: `**Top stockout risks**\n${lines}\nWhy: demand consumes usable supply before replenishment can protect the lead-time requirement. Client orders reduce available stock, and only supplier units arriving inside the configured window are counted. The ranking also considers demand acceleration and ABC importance.` };
  }

  function demandAnswer(analysis) {
    const leaders = analysis.scoped.filter(item => item.demand > 0).sort((a, b) => b.forecast.value - a.forecast.value).slice(0, 5);
    if (!leaders.length) return { intent: "demand", category: "demand analysis", message: "The uploaded report does not contain a positive supported demand signal for eligible active-brand items." };
    const lines = leaders.map((item, index) => `${index + 1}. ${item.model || item.itemid} — ${decimal.format(item.forecast.value)}/month (${decimal.format(item.forecast.low)}–${decimal.format(item.forecast.high)}): ${item.trend > .15 ? "recent acceleration" : item.trend < -.15 ? "recent slowdown" : "stable recent rate"}; ${number.format(item.forecast.accuracy)}% backtest accuracy.`).join("\n");
    return { intent: "demand", category: "demand analysis", itemKey: leaders[0]?.key || "", message: `**Why demand is expected**\n${lines}\nMK tests latest-observation, rolling average, weighted average, median and damped-trend methods against retained uploads. It selects the lowest-error method per item. A recent spike raises urgency but is not treated as permanent unless history confirms it.` };
  }

  function reorderAnswer(analysis) {
    const items = analysis.reorders.slice().sort((a, b) => b.recommended - a.recommended).slice(0, 5);
    if (!items.length) return { intent: "reorder", category: "reorder decision", message: "No active eligible item currently has a positive reorder quantity under the configured formula." };
    const lines = items.map((item, index) => `${index + 1}. [${item.priority}] ${item.model || item.itemid} — ${item.brand}: ${number.format(item.recommended)} units. ${shortReason(item)}.`).join("\n");
    return { intent: "reorder", category: "reorder decision", itemKey: items[0]?.key || "", message: `**Recommended next purchases**\n${lines}\nFormula basis remains: monthly demand × (brand lead time + coverage months) + critical carrying units + client orders − on hand − eligible inbound supplier units. Positive results are rounded up. Risk and confidence scores explain priority; they do not change the quantity formula.` };
  }

  function excessAnswer(analysis) {
    const items = [...analysis.noDemand, ...analysis.excess].filter((item, index, rows) => rows.indexOf(item) === index).sort((a, b) => b.onHand - a.onHand).slice(0, 5);
    if (!items.length) return { intent: "excess", category: "inventory health", message: "No material excess or no-demand inventory exception is detected in the current active-brand scope." };
    const lines = items.map((item, index) => `${index + 1}. ${item.model || item.itemid} — ${item.brand}: ${number.format(item.onHand)} on hand; ${item.demand ? decimal.format(item.monthsCover) + " months cover" : "no supported demand"}.`).join("\n");
    return { intent: "excess", category: "inventory health", message: `**Excess and no-demand priorities**\n${lines}\nNext actions: stop replenishment, validate demand and item status, then evaluate transfer, promotion, return, cancellation or controlled disposition.` };
  }

  async function salesAnswer() {
    const snapshot = await loadIndexedValue("stark-sales-intelligence-v1", "regional-sales", regionCode());
    const analysis = snapshot?.analysis;
    if (!analysis?.items?.length) return { intent: "sales", category: "data", message: `No ${REGION_NAMES[regionCode()]} sales analysis is available. Upload the sales report; I will analyze it automatically.` };
    const items = analysis.items;
    const units = sum(items, item => finite(item.demand9));
    const revenue = sum(items, item => finite(item.demand9) * finite(item.price));
    const margin = sum(items, item => item.price > 0 && item.cost > 0 ? finite(item.demand9) * Math.max(0, finite(item.price) - finite(item.cost)) : 0);
    const replenishment = sum(items, item => finite(item.suggestedQty));
    const atRisk = items.filter(item => finite(item.stockoutProbability) >= .65 || item.planningSignal === "Replenish now").sort((a, b) => finite(b.revenueAtRisk) - finite(a.revenueAtRisk));
    const excessCost = sum(items, item => finite(item.excessCost));
    const deadStockCost = sum(items, item => finite(item.deadStockCost));
    const forecastBacktested = items.filter(item => finite(item.forecast?.backtestTests) > 0).length;
    const top = atRisk[0];
    const currency = regionCode() === "EU" ? "EUR" : regionCode() === "CA" ? "CAD" : "USD";
    const money = value => new Intl.NumberFormat(regionCode() === "EU" ? "en-IE" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
    return { intent: "sales", category: "sales decision", message: `**${REGION_NAMES[regionCode()]} sales analysis**\n${number.format(items.length)} models generated ${number.format(units)} demand units, ${money(revenue)} revenue and ${money(margin)} gross margin in the analyzed scope. Suggested replenishment is ${number.format(replenishment)} units across ${number.format(atRisk.length)} urgent stock-risk models. Excess exposure is ${money(excessCost)} and dead-stock exposure is ${money(deadStockCost)}.${top ? ` First protect ${top.model} — ${top.brand}: ${number.format(top.suggestedQty)} suggested units and ${money(top.revenueAtRisk)} revenue at risk.` : " No immediate high-probability stockout signal is present."}\nForecasts were backtested for ${number.format(forecastBacktested)} models. Open Sales Analysis for seller-tier, model contribution, forecast ranges and data-quality evidence.` };
  }

  function vendorPOAnswer(q) {
    const state = window.StarkSystem?.getState(), e = state?.enterprise || {};
    const pos = e.purchaseOrders || [], vendors = e.vendors || [];
    const open = pos.filter(p => !['RECEIVED', 'CANCELLED'].includes(p.status));
    if (!open.length) {
      return {
        intent: "vendor-po",
        category: "procurement",
        message: "No open vendor purchase orders found in the current workspace. You can create a new vendor PO in the Procurement workspace."
      };
    }
    const totalOrdered = open.reduce((s, p) => s + (p.lines || []).reduce((n, l) => n + (Number(l.qty) || 0), 0), 0);
    const totalShipped = open.reduce((s, p) => s + (p.lines || []).reduce((n, l) => n + (Number(l.received || l.shipped) || 0), 0), 0);
    const overdue = open.filter(p => p.eta && new Date(p.eta).getTime() < Date.now() && (p.lines || []).reduce((n, l) => n + (Number(l.received || l.shipped) || 0), 0) < (p.lines || []).reduce((n, l) => n + (Number(l.qty) || 0), 0));
    const missingTracking = open.filter(p => !p.tracking || !p.tracking.trim());
    const pct = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;

    let msg = `**Open Vendor Purchase Order Register (${open.length} active)**\n\n` +
      `• **Total Units Ordered:** ${number.format(totalOrdered)}\n` +
      `• **Total Units Shipped:** ${number.format(totalShipped)} (${pct}% fulfillment)\n` +
      `• **Remaining Balance:** ${number.format(Math.max(0, totalOrdered - totalShipped))} units\n` +
      `• **Overdue Shipping Windows:** ${overdue.length}\n` +
      `• **Missing Tracking:** ${missingTracking.length}\n\n` +
      `**Active PO Breakdown:**\n`;

    open.forEach(p => {
      const v = vendors.find(x => x.id === p.vendorId);
      const ord = (p.lines || []).reduce((n, l) => n + (Number(l.qty) || 0), 0);
      const shp = (p.lines || []).reduce((n, l) => n + (Number(l.received || l.shipped) || 0), 0);
      const win = p.shippingWindow || (p.eta ? `ETA: ${p.eta.slice(0, 10)}` : 'TBD');
      const isLate = p.eta && new Date(p.eta).getTime() < Date.now() && shp < ord;
      const trk = p.tracking ? (p.carrier ? p.carrier + ': ' : '') + p.tracking : 'No tracking';
      const lineSummary = (p.lines || []).map(l => `${l.model || l.sku} (Ordered: ${l.qty}, Shipped: ${l.received || l.shipped || 0})`).join(', ');

      msg += `\n**${p.po}** — *${v?.name || 'Supplier'}* (${p.status.replace(/_/g, ' ')})\n` +
        `  • Ordered Qty: **${number.format(ord)}** | Shipped Qty: **${number.format(shp)}** (${ord > 0 ? Math.round(shp / ord * 100) : 0}%)\n` +
        `  • Shipping Window: **${win}** ${isLate ? '⚠️ *(OVERDUE)*' : ''}\n` +
        `  • Carrier / Tracking: \`${trk}\`\n` +
        `  • Notes: ${p.notes ? `“${p.notes}”` : '—'}\n` +
        `  • Line Items: ${lineSummary}\n`;
    });

    msg += `\n*You can update the shipping window, notes, tracking, and shipped quantities directly in [Open Vendor PO Management](${window.StarkSystem?.url('vendor-po-management.html') || 'vendor-po-management.html'}) or [Procurement](${window.StarkSystem?.url('procurement/index.html') || 'procurement/index.html'}).*`;

    return {
      intent: "vendor-po",
      category: "procurement",
      message: msg
    };
  }

  function findItemInQuestion(q, items) {
    const matches = items.filter(item => {
      const values = [item.model, item.itemid, item.product].map(value => clean(value).toLowerCase()).filter(value => value.length >= 3);
      return values.some(value => q.includes(value));
    });
    return matches.sort((a, b) => clean(b.model).length - clean(a.model).length)[0] || null;
  }

  function findBrandInQuestion(q, items) {
    return [...new Set(items.map(item => item.brand))].filter(brand => clean(brand).length >= 2 && q.includes(clean(brand).toLowerCase())).sort((a, b) => b.length - a.length)[0] || null;
  }

  function publishPulse(type) {
    const message = { source: "mk", type, region: regionCode(), timestamp: Date.now(), nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    try { syncChannel?.postMessage(message); } catch (_) {}
    try { localStorage.setItem(SYNC_PULSE_KEY, JSON.stringify(message)); } catch (_) {}
  }

  async function loadInventoryDataset(code) {
    const config = DB_CONFIG[code];
    const value = await loadIndexedValue(config.name, "datasets", config.key);
    if (value) return value;
    try { return JSON.parse(sessionStorage.getItem(`stark-inventory-${config.key}`) || "null"); } catch (_) { return null; }
  }

  function loadIndexedValue(databaseName, storeName, key) {
    const demo=window.StarkWorkspace?.getDataset(databaseName,storeName,key);if(demo!==undefined)return Promise.resolve(demo);
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise(resolve => {
      const request = indexedDB.open(databaseName, 1);
      request.onerror = () => resolve(null);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName); };
      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(storeName, "readonly");
          const get = tx.objectStore(storeName).get(key);
          get.onsuccess = () => { resolve(get.result || null); db.close(); };
          get.onerror = () => { resolve(null); db.close(); };
        } catch (_) { resolve(null); db.close(); }
      };
    });
  }

  function loadSettings(code) {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(`stark-inventory-settings-${regionKey(code)}`) || "{}") }; }
    catch (_) { return { ...DEFAULT_SETTINGS }; }
  }

  function loadBrands(code) {
    try { return JSON.parse(localStorage.getItem(`stark-active-brands-${regionKey(code)}`) || "{}"); }
    catch (_) { return {}; }
  }

  async function loadHistory(code) {
    const result = { fileCount: 0, byItem: new Map() };
    if (!window.indexedDB) return result;
    const records = await new Promise(resolve => {
      const request = indexedDB.open("stark-reorder-history-v1", 1);
      request.onerror = () => resolve([]);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("reports")) request.result.createObjectStore("reports", { keyPath: "id" }); };
      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction("reports", "readonly"), get = tx.objectStore("reports").getAll();
          get.onsuccess = () => { resolve(get.result || []); db.close(); };
          get.onerror = () => { resolve([]); db.close(); };
        } catch (_) { resolve([]); db.close(); }
      };
    });
    const relevant = records.filter(record => normalizeRegion(record.region) === code && Array.isArray(record.trainingRows) && record.trainingRows.length).sort((a, b) => String(a.sourceImportedAt || a.createdAt).localeCompare(String(b.sourceImportedAt || b.createdAt))).slice(-30);
    result.fileCount = relevant.length;
    relevant.forEach(record => record.trainingRows.forEach(row => {
      const key = normalize(row.model || row.itemid || `${row.brand}|${row.product}`);
      if (!key) return;
      if (!result.byItem.has(key)) result.byItem.set(key, []);
      result.byItem.get(key).push(row);
    }));
    return result;
  }

  function leadTimeMonths(value) {
    const text = clean(value).toLowerCase().replace(/[–—]/g, "-");
    const values = Array.from(text.matchAll(/\d+(?:\.\d+)?/g), match => Number(match[0])).filter(Number.isFinite);
    if (!values.length) return 0;
    const amount = Math.max(...values.slice(0, 2));
    if (/business\s*day|working\s*day/.test(text)) return amount / 21.74;
    if (/day|\bd\b/.test(text)) return amount / 30.44;
    if (/week|\bwk/.test(text)) return amount / 4.348;
    if (/quarter|qtr/.test(text)) return amount * 3;
    if (/year|\byr\b/.test(text)) return amount * 12;
    return amount;
  }

  function parseDate(value) { const date = value ? new Date(value) : null; return date && !isNaN(date) ? date : null; }
  function startOfToday() { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }
  function sum(rows, getter) { return rows.reduce((total, row) => total + finite(getter(row)), 0); }
  function normalizeRegion(value) {
    const code = normalize(value);
    return code === "EU" || code === "EUROPEAN UNION" ? "EU" : code === "CA" || code === "CANADA" ? "CA" : "US";
  }

  /* A small, read-only test surface keeps the planning math independently
     verifiable without exposing mutation or storage controls. */
  window.MKDecisionEngine = Object.freeze({
    version: ENGINE_VERSION,
    analyzeRow,
    leadTimeMonths,
    learnedForecast,
    normalizeRegion,
    simulateItem,
    parseScenario,
    buildDataQualityReport,
    assignAbcClasses,
    applyDecisionIntelligence
  });
  window.MKVerifiedEngine = Object.freeze({ currentRegion: regionCode, analyze: getInventoryAnalysis, parseScenario, loadSales: code => loadIndexedValue("stark-sales-intelligence-v1", "regional-sales", normalizeRegion(code)), normalizeRegion });

  try {
    const pending = sessionStorage.getItem("mk-pending-tracking");
    if (pending && /shipment-tracking\.html$/i.test(location.pathname)) {
      sessionStorage.removeItem("mk-pending-tracking");
      window.setTimeout(() => {
        const field = document.getElementById("tracking-number"), form = document.getElementById("tracking-form");
        if (field && form) { field.value = pending; field.dispatchEvent(new Event("input", { bubbles: true })); form.requestSubmit(); }
      }, 700);
    }
  } catch (_) {}
})();
