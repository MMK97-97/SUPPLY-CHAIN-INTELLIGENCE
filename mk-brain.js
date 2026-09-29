(() => {
  "use strict";

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
  const esc = value => String(value == null ? "" : value).replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
  const REGION_NAMES = { US: "United States", EU: "European Union", CA: "Canada" };
  const DB_CONFIG = {
    US: { name: "stark-regional-inventory", key: "US" },
    EU: { name: "stark-regional-inventory-eu", key: "EU" },
    CA: { name: "stark-regional-inventory-ca", key: "Canada" }
  };
  const DEFAULT_SETTINGS = { critical: 3, coverage: 1, delay: 15, a: 80, b: 95 };
  const ROUTES = {
    "inventory dashboard": "inventory-dashboard", dashboard: "inventory-dashboard",
    "analysis report": "inventory-analysis-report", "inventory analysis": "inventory-analysis-report",
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
  let badge;
  let lastAnalysis = null;
  let recognition = null;
  let syncChannel = null;
  let busy = false;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  function init() {
    buildInterface();
    bindLiveData();
    selectVoice();
    window.speechSynthesis?.addEventListener?.("voiceschanged", selectVoice);
    window.setTimeout(() => inspectCurrentData(true), 650);
    window.MKBrain = {
      open: () => togglePanel(true),
      close: () => togglePanel(false),
      ask: question => execute(String(question || "")),
      analyze: () => inspectCurrentData(false),
      getLastAnalysis: () => lastAnalysis,
      getProfile: () => ({ ...profile })
    };
  }

  function loadProfile() {
    try {
      return {
        voiceEnabled: false,
        taskCounts: {},
        feedback: { useful: 0, correction: 0 },
        notes: [],
        lastAnalyzed: {},
        preferredVoice: "",
        ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}")
      };
    } catch (_) {
      return { voiceEnabled: false, taskCounts: {}, feedback: { useful: 0, correction: 0 }, notes: [], lastAnalyzed: {}, preferredVoice: "" };
    }
  }

  function saveProfile() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
  }

  function regionCode() {
    const suffix = location.pathname.match(/-(us|eu|ca)\.html$/i)?.[1];
    const query = new URLSearchParams(location.search).get("region") || new URLSearchParams(location.search).get("workspace");
    const stored = localStorage.getItem("stark-selected-region");
    return normalizeRegion(suffix || query || stored || "US");
  }

  function regionKey(code = regionCode()) { return DB_CONFIG[code].key; }

  function buildInterface() {
    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "mk-brain-launcher";
    launcher.setAttribute("aria-label", "Open MK Supply Chain Brain");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = 'MK<span class="mk-badge" hidden>1</span>';
    badge = launcher.querySelector(".mk-badge");

    panel = document.createElement("section");
    panel.className = "mk-brain-panel";
    panel.setAttribute("aria-label", "MK Supply Chain Brain");
    panel.innerHTML = `
      <header class="mk-brain-head">
        <div class="mk-brain-mark">MK</div>
        <div class="mk-brain-title"><strong>MK — Supply Chain Brain</strong><span>Decision engine ready</span></div>
        <button class="mk-icon-button mk-voice-toggle" type="button" aria-label="Enable voice" aria-pressed="false" title="Voice off">
          <svg viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="M17 9c1.3 1.7 1.3 4.3 0 6M19.5 6.5c3 3 3 8 0 11"/></svg>
        </button>
        <button class="mk-icon-button mk-close" type="button" aria-label="Close MK">
          <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <div class="mk-brain-state"><b>${esc(REGION_NAMES[regionCode()])}</b><span>Local data • explainable decisions • private learning</span></div>
      <div class="mk-brain-feed" role="log" aria-live="polite"></div>
      <div class="mk-quick-actions" aria-label="MK actions">
        <button type="button" data-mk-question="Analyze my current data">Analyze data</button>
        <button type="button" data-mk-question="Show top stockout risks">Stockout risks</button>
        <button type="button" data-mk-question="Show reorder summary">Reorder summary</button>
        <button type="button" data-mk-question="Explain demand">Explain demand</button>
        <button type="button" data-mk-question="Export this report">Export report</button>
      </div>
      <form class="mk-brain-compose">
        <textarea rows="1" aria-label="Ask MK or give MK a task" placeholder="Ask a question or give MK a task…"></textarea>
        <button class="mk-mic" type="button" aria-label="Speak to MK" title="Speak to MK">
          <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>
        </button>
        <button class="mk-send" type="submit" aria-label="Run task">
          <svg viewBox="0 0 24 24"><path d="m4 12 16-8-5 16-3-6-8-2Z"/><path d="m12 14 8-10"/></svg>
        </button>
      </form>`;

    document.body.append(panel, launcher);
    feed = panel.querySelector(".mk-brain-feed");
    input = panel.querySelector("textarea");
    stateNode = panel.querySelector(".mk-brain-state");
    voiceButton = panel.querySelector(".mk-voice-toggle");
    syncVoiceUi();

    addEntry("MK is ready. I analyze uploaded inventory and sales data, explain why action is needed, and execute supported dashboard tasks. Voice is off until you enable it.", "brain", false);
    launcher.addEventListener("click", () => togglePanel(!panel.classList.contains("open")));
    panel.querySelector(".mk-close").addEventListener("click", () => togglePanel(false));
    voiceButton.addEventListener("click", toggleVoice);
    panel.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      input.value = "";
      execute(question);
    });
    input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = `${Math.min(112, input.scrollHeight)}px`; });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); panel.querySelector("form").requestSubmit(); }
    });
    panel.querySelectorAll("[data-mk-question]").forEach(button => button.addEventListener("click", () => execute(button.dataset.mkQuestion)));
    panel.querySelector(".mk-mic").addEventListener("click", toggleListening);
    document.addEventListener("keydown", event => { if (event.key === "Escape" && panel.classList.contains("open")) togglePanel(false); });
  }

  function togglePanel(open) {
    panel.classList.toggle("open", open);
    launcher.classList.toggle("is-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("mk-brain-open", open);
    if (open) {
      badge.hidden = true;
      window.setTimeout(() => input.focus(), 120);
    }
  }

  function setState(text, running = false) {
    stateNode.classList.toggle("is-running", running);
    stateNode.innerHTML = `<b>${esc(REGION_NAMES[regionCode()])}</b><span>${esc(text)}</span>`;
  }

  function addEntry(message, role = "brain", speak = true, category = "answer") {
    const entry = document.createElement("div");
    entry.className = `mk-entry ${role === "user" ? "user" : "brain"}`;
    const controls = role === "brain" ? `<div class="mk-feedback"><button type="button" data-feedback="useful">Useful</button><button type="button" data-feedback="correction">Needs correction</button></div>` : "";
    entry.innerHTML = `<div class="mk-entry-card"><div class="mk-entry-meta">${role === "user" ? "You" : "MK • " + esc(category)}</div>${formatMessage(message)}${controls}</div>`;
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight;
    entry.querySelectorAll("[data-feedback]").forEach(button => button.addEventListener("click", () => recordFeedback(button, category)));
    if (role === "brain" && speak && profile.voiceEnabled) speakText(message);
    if (role === "brain" && !panel.classList.contains("open")) { badge.hidden = false; badge.textContent = "1"; }
    return entry;
  }

  function formatMessage(message) {
    return esc(message)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
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

  async function execute(question) {
    if (busy || !clean(question)) return;
    addEntry(question, "user", false);
    busy = true;
    setState("Thinking through current and historical signals…", true);
    try {
      const answer = await routeQuestion(question);
      addEntry(answer.message, "brain", true, answer.category || "decision");
      learnTask(answer.intent || "question");
    } catch (error) {
      addEntry(`I couldn’t complete that task: ${error.message || "unknown error"}. No data was changed.`, "brain", true, "control");
    } finally {
      busy = false;
      setState("Ready for the next decision or task");
    }
  }

  async function routeQuestion(question) {
    const raw = clean(question);
    const q = raw.toLowerCase();

    if (/^(voice on|enable voice|turn (the )?voice on)/.test(q)) {
      if (!profile.voiceEnabled) { profile.voiceEnabled = true; saveProfile(); syncVoiceUi(); }
      return { intent: "voice", category: "voice", message: "Voice is enabled." };
    }
    if (/^(voice off|disable voice|turn (the )?voice off)/.test(q)) {
      profile.voiceEnabled = false; saveProfile(); syncVoiceUi(); window.speechSynthesis?.cancel();
      return { intent: "voice", category: "voice", message: "Voice is disabled." };
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

    const analysis = await getInventoryAnalysis();
    if (!analysis) return { intent: "analysis", category: "data", message: `There is no ${REGION_NAMES[regionCode()]} inventory report available. Upload a Raw Report first; I will analyze it automatically as soon as it is stored.` };

    const matched = findItemInQuestion(q, analysis.items);
    if (matched) return explainItem(matched, analysis);
    if (/why.*stock.?out|stock.?out.*why|stock.?out risk/.test(q)) return stockoutAnswer(analysis);
    if (/why.*demand|explain demand|demand reason|demand analysis/.test(q)) return demandAnswer(analysis);
    if (/reorder|replenish|purchase|buy/.test(q)) return reorderAnswer(analysis);
    if (/excess|dead stock|no demand|overstock/.test(q)) return excessAnswer(analysis);
    if (/analy|summary|overview|what.*action|recommend|decision|current data/.test(q)) return portfolioAnswer(analysis);
    if (/what can you do|help|capabilit/.test(q)) return capabilityAnswer();

    return portfolioAnswer(analysis, `I interpreted this as a request for the current ${REGION_NAMES[regionCode()]} decision summary.`);
  }

  function updateSettingFromQuestion(q) {
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
      document.querySelector(".report-export-action:not([disabled])"),
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
      message: "I can analyze every uploaded inventory or sales report automatically; explain stockout, demand, excess and reorder reasons by model; recommend next actions; apply approved planning settings; open workspace pages; start available report exports; track a shipment; and learn from your feedback, corrections, repeated tasks and saved instructions. All learning and uploaded data remain in this browser."
    };
  }

  function learningSummary() {
    const tasks = Object.entries(profile.taskCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const taskText = tasks.length ? tasks.map(([name, count]) => `${name} (${count})`).join(", ") : "no repeated task pattern yet";
    return {
      intent: "learn",
      category: "learning",
      message: `I have learned ${profile.notes?.length || 0} saved instruction${profile.notes?.length === 1 ? "" : "s"}, ${finite(profile.feedback?.useful)} useful responses and ${finite(profile.feedback?.correction)} requested corrections. Most-used task patterns: ${taskText}. Forecast learning also uses the uploaded report history retained by Decision Intelligence.`
    };
  }

  async function getInventoryAnalysis() {
    const dataset = await loadInventoryDataset(regionCode());
    if (!dataset?.rows?.length) return null;
    const code = regionCode();
    const settings = loadSettings(code);
    const brands = loadBrands(code);
    const history = await loadHistory(code);
    const items = dataset.rows.map(row => analyzeRow(row, settings, brands, history));
    const scoped = items.filter(item => item.activeBrand && item.eligible && !item.excluded);
    const reorders = scoped.filter(item => item.recommended > 0);
    const stockouts = scoped.filter(item => item.stockoutRisk);
    const noDemand = scoped.filter(item => item.demand <= 0 && item.onHand > 0);
    const excess = scoped.filter(item => item.demand > 0 && item.monthsCover > Math.max(4, settings.coverage * 2));
    return {
      code, dataset, settings, items, scoped, reorders, stockouts, noDemand, excess,
      totalDemand: sum(scoped, item => item.demand),
      totalStock: sum(scoped, item => item.onHand),
      recommendedUnits: sum(reorders, item => item.recommended),
      activeBrands: new Set(scoped.map(item => item.brand)).size,
      historyFiles: history.fileCount
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
    return { ...row, brand, status, activeBrand, eligible, excluded, demand, last30, onHand, openClient, openSupplier, leadMonths, daysUntil, planningSupplier, recommended, netAvailable, monthsCover, daysToStockout, stockoutRisk, trend, learned, forecast };
  }

  function learnedForecast(current, history) {
    const values = history.map(row => Math.max(0, finite(row.avg3) || finite(row.vol3) / 3)).filter(Number.isFinite);
    if (!values.length) return { value: current.last30 || current.demand, method: current.last30 ? "latest 30-day demand" : "three-month rate", observations: 0 };
    const recent = values.slice(-3);
    const weighted = recent.reduce((total, value, index) => total + value * (index + 1), 0) / recent.reduce((total, _, index) => total + index + 1, 0);
    return { value: Math.max(0, .55 * (current.last30 || current.demand) + .45 * weighted), method: "history-weighted demand", observations: values.length };
  }

  function explainItem(item, analysis) {
    const supplyGap = Math.max(0, item.recommended);
    const demandDirection = item.trend > .15 ? "accelerating" : item.trend < -.15 ? "softening" : "stable";
    const supplierNote = item.openSupplier > item.planningSupplier ? "Some supplier units fall outside the configured arrival window and were not counted." : item.openSupplier ? "Eligible inbound supply was counted." : "No supplier quantity offsets the requirement.";
    const action = supplyGap > 0 ? `Place or review a purchase for ${number.format(supplyGap)} units` : item.demand <= 0 && item.onHand > 0 ? "Hold purchasing and review transfer, promotion or disposition" : "Maintain the plan and monitor weekly";
    return {
      intent: "item-analysis",
      category: "model decision",
      message: `**${clean(item.model || item.itemid)} — ${item.brand}**\nDecision: ${action}.\nBusiness reason: lead-time demand plus the coverage buffer requires ${number.format(item.demand * (item.leadMonths + analysis.settings.coverage) + analysis.settings.critical)} units before client commitments. Net usable supply is ${number.format(item.netAvailable)} units. ${supplierNote}\nWhy stockout could occur: ${item.stockoutRisk ? `current supply may last about ${decimal.format(item.daysToStockout)} days, while supplier lead time is ${decimal.format(item.leadMonths * 30.44)} days` : "current usable supply is not projected to expire before the replenishment point"}.\nWhy demand is expected: the three-month rate is ${decimal.format(item.demand)} units/month and the last 30 days show ${number.format(item.last30)} units, indicating ${demandDirection} demand. The learned forecast is ${decimal.format(item.forecast.value)} units/month using ${item.forecast.method}${item.forecast.observations ? ` across ${item.forecast.observations} prior observations` : ""}.`
    };
  }

  function portfolioAnswer(analysis, prefix = "") {
    const top = analysis.stockouts.slice().sort((a, b) => b.recommended - a.recommended)[0];
    const action = top ? `First action: review ${top.model || top.itemid} (${top.brand}); it needs ${number.format(top.recommended)} units and has about ${decimal.format(top.daysToStockout)} days of cover.` : "No immediate stockout exception is detected; monitor demand and supplier dates.";
    return {
      intent: "portfolio-analysis",
      category: "portfolio decision",
      message: `${prefix ? prefix + "\n" : ""}**${REGION_NAMES[analysis.code]} analysis complete**\n${number.format(analysis.scoped.length)} eligible items across ${number.format(analysis.activeBrands)} active brands. ${number.format(analysis.reorders.length)} items require reorder, totaling ${number.format(analysis.recommendedUnits)} units. ${number.format(analysis.stockouts.length)} items have lead-time stockout risk, ${number.format(analysis.excess.length)} are excess, and ${number.format(analysis.noDemand.length)} have stock with no demand. ${action} Analysis used ${number.format(analysis.historyFiles)} retained historical report${analysis.historyFiles === 1 ? "" : "s"}.`
    };
  }

  function stockoutAnswer(analysis) {
    const risks = analysis.stockouts.slice().sort((a, b) => a.daysToStockout - b.daysToStockout || b.recommended - a.recommended).slice(0, 5);
    if (!risks.length) return { intent: "stockout", category: "risk analysis", message: "No eligible item currently has usable supply expiring before its replenishment point. I will recalculate this automatically when new data arrives." };
    const lines = risks.map((item, index) => `${index + 1}. ${item.model || item.itemid} — ${item.brand}: ${decimal.format(item.daysToStockout)} days to stockout; ${number.format(item.recommended)} units recommended.`).join("\n");
    return { intent: "stockout", category: "risk analysis", message: `**Top stockout risks**\n${lines}\nWhy: demand consumes on-hand supply before the configured lead-time and coverage requirement can be protected. Client orders reduce usable stock, and only supplier units arriving inside the allowed window are counted.` };
  }

  function demandAnswer(analysis) {
    const leaders = analysis.scoped.filter(item => item.demand > 0).sort((a, b) => b.forecast.value - a.forecast.value).slice(0, 5);
    if (!leaders.length) return { intent: "demand", category: "demand analysis", message: "The uploaded report does not contain a positive supported demand signal for eligible active-brand items." };
    const lines = leaders.map((item, index) => `${index + 1}. ${item.model || item.itemid} — ${decimal.format(item.forecast.value)}/month: ${item.trend > .15 ? "recent acceleration" : item.trend < -.15 ? "recent slowdown" : "stable recent rate"}.`).join("\n");
    return { intent: "demand", category: "demand analysis", message: `**Why demand is expected**\n${lines}\nI compare the three-month run rate, latest 30-day units and retained upload history. A recent spike increases urgency but is not treated as permanent unless later uploads confirm it.` };
  }

  function reorderAnswer(analysis) {
    const items = analysis.reorders.slice().sort((a, b) => b.recommended - a.recommended).slice(0, 5);
    if (!items.length) return { intent: "reorder", category: "reorder decision", message: "No active eligible item currently has a positive reorder quantity under the configured formula." };
    const lines = items.map((item, index) => `${index + 1}. ${item.model || item.itemid} — ${item.brand}: ${number.format(item.recommended)} units.`).join("\n");
    return { intent: "reorder", category: "reorder decision", message: `**Recommended next purchases**\n${lines}\nFormula basis: monthly demand × (brand lead time + coverage months) + critical carrying units + client orders − on hand − eligible inbound supplier units. Positive results are rounded up.` };
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
    const currency = regionCode() === "EU" ? "EUR" : regionCode() === "CA" ? "CAD" : "USD";
    const money = value => new Intl.NumberFormat(regionCode() === "EU" ? "en-IE" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
    return { intent: "sales", category: "sales decision", message: `**${REGION_NAMES[regionCode()]} sales analysis**\n${number.format(items.length)} models generated ${number.format(units)} demand units, ${money(revenue)} revenue and ${money(margin)} gross margin in the analyzed scope. Suggested replenishment is ${number.format(replenishment)} units. Open Sales Analysis for model, seller-tier, forecast and data-quality detail.` };
  }

  function findItemInQuestion(q, items) {
    const matches = items.filter(item => {
      const values = [item.model, item.itemid, item.product].map(value => clean(value).toLowerCase()).filter(value => value.length >= 3);
      return values.some(value => q.includes(value));
    });
    return matches.sort((a, b) => clean(b.model).length - clean(a.model).length)[0] || null;
  }

  async function inspectCurrentData(silentExisting) {
    const code = regionCode();
    const dataset = await loadInventoryDataset(code);
    const sales = await loadIndexedValue("stark-sales-intelligence-v1", "regional-sales", code);
    const inventoryStamp = dataset?.importedAt || "";
    const salesStamp = sales?.sales?.importedAt || "";
    const signature = `${inventoryStamp}|${salesStamp}`;
    if (!signature.replace("|", "")) return;
    if (silentExisting && profile.lastAnalyzed?.[code] === signature) return;
    setState("Automatically analyzing the newly uploaded data…", true);
    const analysis = await getInventoryAnalysis();
    lastAnalysis = analysis;
    profile.lastAnalyzed = { ...(profile.lastAnalyzed || {}), [code]: signature };
    profile.lastAutomaticAnalysis = new Date().toISOString();
    saveProfile();
    if (analysis) {
      const answer = portfolioAnswer(analysis, "A new data source was detected and analyzed automatically.");
      addEntry(answer.message, "brain", true, "automatic analysis");
    } else if (sales?.analysis?.items?.length) {
      const answer = await salesAnswer();
      addEntry(`A new sales source was detected and analyzed automatically.\n${answer.message}`, "brain", true, "automatic analysis");
    }
    setState("Automatic analysis complete");
  }

  function bindLiveData() {
    const receive = message => {
      if (!message || !["inventory-data", "sales-data"].includes(message.type)) return;
      if (normalizeRegion(message.region) !== regionCode()) return;
      window.setTimeout(() => inspectCurrentData(false), 180);
    };
    try {
      if ("BroadcastChannel" in window) {
        syncChannel = new BroadcastChannel(SYNC_CHANNEL);
        syncChannel.addEventListener("message", event => receive(event.data));
      }
    } catch (_) {}
    window.addEventListener("storage", event => {
      if (event.key !== SYNC_PULSE_KEY || !event.newValue) return;
      try { receive(JSON.parse(event.newValue)); } catch (_) {}
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) inspectCurrentData(true); });
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
  window.MKDecisionEngine = Object.freeze({ analyzeRow, leadTimeMonths, learnedForecast, normalizeRegion });

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
