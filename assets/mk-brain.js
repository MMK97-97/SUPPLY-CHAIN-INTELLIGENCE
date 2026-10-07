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
  const ENGINE_VERSION = "MK Intelligence 4.1";
  const LOCAL_ONLY_INTENTS = new Set(["voice", "space", "settings", "navigation", "export", "tracking", "learn", "help"]);
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
  let spaceButton;
  let badge;
  let lastAnalysis = null;
  let recognition = null;
  let syncChannel = null;
  let busy = false;
  let activeController = null;
  const conversation = { lastIntent: "", lastItemKey: "", lastQuestion: "", lastAnswer: "", turns: [] };

  if (document.readyState !== "complete") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  function init() {
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
    panel.setAttribute("role", "region");
    panel.innerHTML = `
      <header class="mk-brain-head">
        <div class="mk-brain-mark">MK</div>
        <div class="mk-brain-title"><strong>MK — Supply Chain Brain</strong><span>${ENGINE_VERSION}</span></div>
        <button class="mk-icon-button mk-space-toggle" type="button" aria-label="Enable AI analysis" aria-pressed="false" data-state="local" title="Local analyst ready">
          <svg viewBox="0 0 24 24"><path d="M8 17H6a4 4 0 0 1-.4-8A6.5 6.5 0 0 1 18 8a4.5 4.5 0 0 1 0 9h-2"/><path d="m9 14 3-3 3 3M12 11v9"/></svg>
        </button>
        <button class="mk-icon-button mk-voice-toggle" type="button" aria-label="Enable voice" aria-pressed="false" title="Voice off">
          <svg viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="M17 9c1.3 1.7 1.3 4.3 0 6M19.5 6.5c3 3 3 8 0 11"/></svg>
        </button>
        <button class="mk-icon-button mk-close" type="button" aria-label="Close MK">
          <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <div class="mk-brain-state"><b>${esc(REGION_NAMES[regionCode()])}</b><span>Verified report analysis · AI available after setup</span></div>
      <div class="mk-brain-feed" role="log" aria-live="polite"></div>
      <div class="mk-quick-actions" aria-label="MK actions">
        <button type="button" data-mk-question="Analyze my current data">Analyze data</button>
        <button type="button" data-mk-question="Show top stockout risks">Stockout risks</button>
        <button type="button" data-mk-question="Show reorder summary">Reorder summary</button>
        <button type="button" data-mk-question="Explain demand">Explain demand</button>
        <button type="button" data-mk-question="Build my action plan">Action plan</button>
        <button type="button" data-mk-question="Audit data quality">Data quality</button>
        <button type="button" data-mk-question="Compare all regions">Compare regions</button>
        <a class="mk-workspace-link" href="${esc(window.StarkSystem?.url('mk-brain.html') || 'mk-brain.html')}">Open analyst workspace</a>
      </div>
      <form class="mk-brain-compose">
        <textarea rows="1" aria-label="Ask MK or give MK a task" placeholder="Ask a question or give MK a task…"></textarea>
        <button class="mk-mic" type="button" aria-label="Speak to MK" title="Speak to MK">
          <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>
        </button>
        <button class="mk-stop" type="button" hidden>Stop</button>
        <button class="mk-send" type="submit" aria-label="Run task">
          <svg viewBox="0 0 24 24"><path d="m4 12 16-8-5 16-3-6-8-2Z"/><path d="m12 14 8-10"/></svg>
        </button>
      </form>`;

    const anchor = document.getElementById("mk-chat-anchor");
    if (anchor) { anchor.append(panel); panel.classList.add("mk-docked", "open"); launcher.hidden = true; }
    else { panel.inert = true; panel.setAttribute("aria-hidden", "true"); document.body.append(panel); }
    document.body.append(launcher);
    feed = panel.querySelector(".mk-brain-feed");
    input = panel.querySelector("textarea");
    stateNode = panel.querySelector(".mk-brain-state");
    voiceButton = panel.querySelector(".mk-voice-toggle");
    spaceButton = panel.querySelector(".mk-space-toggle");
    syncVoiceUi();
    syncSpaceUi();

    addEntry("MK is ready. Ask about a model, brand, region or report. I can investigate risks, compare regions, simulate changes and propose actions with report evidence. Local monitoring checks new reports while this website is open. Your Supply AI Chain Hub provides deeper conversational analysis when AI is enabled.", "brain", false);
    launcher.addEventListener("click", () => togglePanel(!panel.classList.contains("open")));
    panel.querySelector(".mk-close").addEventListener("click", () => togglePanel(false));
    voiceButton.addEventListener("click", toggleVoice);
    spaceButton.addEventListener("click", () => setSpaceEnabled(!window.MKAI?.getStatus().aiEnabled, true));
    panel.querySelector(".mk-stop").addEventListener("click", () => activeController?.abort());
    window.addEventListener("mk:analyst-change", syncSpaceUi);
    window.addEventListener("mk:conversation-clear", () => { feed.innerHTML = ""; addEntry("New conversation started. Ask MK about your reports.", "brain", false); });
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
    if (panel.classList.contains("mk-docked")) return;
    panel.inert = !open;
    panel.setAttribute("aria-hidden", String(!open));
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
    const selected = window.MKAI?.getStatus().scope || regionCode();
    stateNode.innerHTML = `<b>${esc(selected === "ALL" ? "All regions" : REGION_NAMES[selected])}</b><span>${esc(text)}</span>`;
  }

  function addEntry(message, role = "brain", speak = true, category = "answer", result = null) {
    const entry = document.createElement("div");
    entry.className = `mk-entry ${role === "user" ? "user" : "brain"}`;
    const controls = role === "brain" ? `<div class="mk-feedback"><button type="button" data-feedback="useful">Useful</button><button type="button" data-feedback="correction">Needs correction</button></div>` : "";
    entry.innerHTML = `<div class="mk-entry-card"><div class="mk-entry-meta">${role === "user" ? "You" : "MK • " + esc(category)}</div>${formatMessage(message)}${controls}</div>`;
    if (result) window.MKAI?.renderResult(entry.querySelector(".mk-entry-card"), result);
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
    if (LOCAL_ONLY_INTENTS.has(localAnswer.intent) || ["control", "action completed", "action started"].includes(localAnswer.category)) return localAnswer;
    if (!window.MKAI) return localAnswer;
    const result = await window.MKAI.answer(question, localAnswer, { signal: activeController?.signal });
    return { ...localAnswer, category: result.mode === 'ai' ? 'AI analyst' : 'verified local analyst', message: result.answer, result };
  }
  function restoreConversation() {
    if (!feed) return;
    feed.querySelectorAll('.mk-restored').forEach(entry => entry.remove());
    for (const item of window.MKAI?.getMessages() || []) {
      const entry = addEntry(item.role === 'user' ? item.content : item.result.answer, item.role === 'user' ? 'user' : 'brain', false, item.role === 'user' ? 'question' : `${item.scope} · saved analysis`, item.result);
      entry.classList.add('mk-restored');
    }
  }

  async function execute(question) {
    if (busy || !clean(question)) return;
    addEntry(question, "user", false);
    conversation.lastQuestion = clean(question);
    busy = true;
    activeController = new AbortController();
    panel.querySelector(".mk-stop").hidden = false;
    panel.querySelector(".mk-send").disabled = true;
    setState("Thinking through current and historical signals…", true);
    try {
      const localAnswer = await routeQuestion(question);
      const answer = await enhanceWithSupplyAI(question, localAnswer);
      addEntry(answer.message, "brain", true, answer.category || "decision", answer.result);
      learnTask(answer.intent || "question");
      conversation.lastIntent = answer.intent || "question";
      conversation.lastItemKey = answer.itemKey || conversation.lastItemKey;
      conversation.lastAnswer = answer.message;
      conversation.turns.push({ question: clean(question), intent: conversation.lastIntent, itemKey: answer.itemKey || "", at: Date.now() });
      conversation.turns = conversation.turns.slice(-12);
    } catch (error) {
      addEntry(error.name === "AbortError" ? "Analysis stopped." : `I couldn’t complete that task: ${error.message || "unknown error"}.`, "brain", false, "status");
    } finally {
      busy = false;
      activeController = null;
      panel.querySelector(".mk-stop").hidden = true;
      panel.querySelector(".mk-send").disabled = false;
      syncSpaceUi();
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

    const knowledge = supplyChainKnowledge(q);
    if (knowledge) return knowledge;

    const analysis = await getInventoryAnalysis();
    if (!analysis) return { intent: "analysis", category: "data", message: `There is no ${REGION_NAMES[regionCode()]} inventory report available. Upload a Raw Report first; I will analyze it automatically as soon as it is stored.` };
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
    if (scenario.coverage == null) scenario.coverage = settings.coverage;
    return scenario;
  }

  function simulateItem(item, settings, scenario) {
    const demand = item.demand * (scenario.demandMultiplier ?? 1);
    const leadMonths = scenario.leadMonths ?? item.leadMonths;
    const coverage = scenario.coverage ?? settings.coverage;
    const onHand = scenario.onHand ?? item.onHand;
    const planningSupplier = scenario.planningSupplier ?? item.planningSupplier;
    const need = demand * (leadMonths + coverage) + settings.critical + item.openClient;
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
