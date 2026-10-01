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
  const normalizeLookup = value => normalize(value).replace(/[^A-Z0-9]/g, "");
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
  const ENGINE_VERSION = "MK Hybrid Intelligence 3.3";
  const SPACE_ID = "MMK97/supply-ai-chain-hub";
  const SPACE_ORIGIN = clean(window.MK_SUPPLY_AI_ORIGIN || "https://mmk97-supply-ai-chain-hub.hf.space").replace(/\/+$/, "");
  const SPACE_API_NAME = "website_chat";
  const SPACE_TIMEOUT = 65000;
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
  let spaceStatus;
  let badge;
  let lastAnalysis = null;
  let recognition = null;
  let syncChannel = null;
  let busy = false;
  let spaceDiscoveryPromise = null;
  const spaceConnection = { state: "checking", type: "", endpoint: "", lastError: "", fallbackNotified: false };
  const conversation = { lastIntent: "", lastItemKey: "", lastQuestion: "", lastAnswer: "", turns: [] };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  function init() {
    buildInterface();
    document.body.classList.remove("copilot-docked", "copilot-modal-open");
    panel?.classList.remove("open");
    [document.getElementById("topbar-ai-btn"), document.getElementById("home-ai-button")].filter(Boolean).forEach(aiBtn => {
      aiBtn.classList.remove("active");
      aiBtn.setAttribute("aria-expanded", "false");
    });
    bindLiveData();
    purgeLegacyBrowserTokens();
    selectVoice();
    window.setTimeout(() => warmSpaceConnection(), 180);
    window.speechSynthesis?.addEventListener?.("voiceschanged", selectVoice);
    window.setTimeout(() => inspectCurrentData(true), 650);
    window.MKBrain = {
      open: () => togglePanel(true),
      close: () => togglePanel(false),
      openSpace: () => {
        togglePanel(true);
        addEntry(spaceStatusMessage(), "brain", false, "AI connection");
      },
      ask: question => execute(String(question || "")),
      analyze: () => inspectCurrentData(false),
      getLastAnalysis: () => lastAnalysis,
      getProfile: () => ({ ...profile }),
      getSpaceStatus: () => ({ id: SPACE_ID, state: spaceConnection.state, type: spaceConnection.type, endpoint: spaceConnection.endpoint, error: spaceConnection.lastError }),
      setSpaceEnabled: enabled => setSpaceEnabled(Boolean(enabled), false),
      downloadPO: () => downloadPoCsv(lastAnalysis),
      setPersona: name => {
        const chip = panel?.querySelector(`[data-persona="${name}"]`);
        if (chip) chip.click();
      },
      controlTable: action => controlDashboardTable(action),
      version: ENGINE_VERSION
    };
    window.StarkCopilot = window.MKBrain;
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

  function purgeLegacyBrowserTokens() {
    // Inference credentials belong in the Space secret store, never in public
    // GitHub Pages JavaScript or persistent browser storage.
    ["mk-hf-inference-token", "hf_inference_token", "hf_token"].forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }

  function regionCode() {
    const suffix = location.pathname.match(/-(us|eu|ca)(?:\.html)?\/?$/i)?.[1];
    const query = new URLSearchParams(location.search).get("region") || new URLSearchParams(location.search).get("workspace");
    const stored = localStorage.getItem("stark-selected-region");
    return normalizeRegion(suffix || query || stored || "US");
  }

  function regionKey(code = regionCode()) { return DB_CONFIG[code].key; }

  function buildInterface() {
    document.querySelectorAll(".mk-brain-launcher, .mk-brain-panel").forEach(node => node.remove());
    launcher = document.createElement("button");
    launcher.className = "mk-brain-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open MK Intelligence");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = `
      <span class="mk-launcher-avatar" aria-hidden="true">MK</span>
      <span class="mk-launcher-label">MK</span>
      <svg class="mk-launcher-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5"/></svg>`;
    document.body.append(launcher);

    panel = document.createElement("section");
    panel.className = "mk-brain-panel";
    panel.setAttribute("aria-label", "MK Supply Chain Intelligence");
    panel.innerHTML = `
      <header class="mk-copilot-head">
        <div class="mk-copilot-brand">
          <div class="mk-copilot-avatar">MK</div>
          <div class="mk-copilot-title">
            <strong>MK Intelligence</strong>
            <span>Your supply chain analyst</span>
          </div>
        </div>
        <div class="mk-copilot-controls">
          <button class="mk-icon-button mk-min-toggle" type="button" aria-label="Minimize Copilot" title="Minimize">−</button>
          <button class="mk-icon-button mk-close" type="button" aria-label="Close Copilot" title="Close">✕</button>
        </div>
      </header>

      <div class="mk-native-ai-status" data-state="checking" role="status" aria-live="polite">
        <span class="mk-native-ai-dot" aria-hidden="true"></span>
        <div class="mk-native-ai-copy">
          <strong>MK + Supply AI</strong>
          <small>Connecting to ${esc(SPACE_ID)}…</small>
        </div>
        <button type="button" class="mk-space-toggle" aria-label="Disable Supply AI link" aria-pressed="true">On</button>
      </div>

      <div class="mk-brain-feed" role="log" aria-live="polite"></div>

      <div class="mk-suggested-wrap" id="mk-suggested-wrap">
        <div class="mk-suggested-head">
          <span>Suggested questions</span>
          <button type="button" class="mk-suggested-refresh-btn" id="mk-suggested-refresh" title="Refresh suggestions">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>
          </button>
        </div>
        <div class="mk-suggested-list">
          <button type="button" class="mk-suggested-pill" data-mk-question="What are the top stockout risks?">
            <span>What are the top stockout risks?</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <button type="button" class="mk-suggested-pill" data-mk-question="Show inventory coverage by brand.">
            <span>Show inventory coverage by brand.</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <button type="button" class="mk-suggested-pill" data-mk-question="Which items should we reorder now?">
            <span>Which items should we reorder now?</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      <form class="mk-copilot-compose">
        <input type="text" class="mk-compose-input" placeholder="Ask a question or request an analysis..." aria-label="Ask MK Intelligence" />
        <button class="mk-mic" type="button" aria-label="Voice input" title="Voice input">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/></svg>
        </button>
        <button class="mk-send" type="submit" aria-label="Send analysis request" title="Send">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      </form>`;

    document.body.append(panel);
    feed = panel.querySelector(".mk-brain-feed");
    input = panel.querySelector(".mk-compose-input");
    spaceButton = panel.querySelector(".mk-space-toggle");
    spaceStatus = panel.querySelector(".mk-native-ai-status");
    syncVoiceUi();
    syncSpaceUi();

    // Inject the MK welcome card.
    const regName = REGION_NAMES[regionCode()] || "United States";
    const welcomeEntry = document.createElement("div");
    welcomeEntry.className = "mk-entry brain mk-welcome-entry";
    welcomeEntry.innerHTML = `
      <div class="mk-entry-card">
        <div class="mk-entry-top">
          <div class="mk-agent-badge">MK</div>
          <div class="mk-agent-meta">
            <strong>MK</strong>
            <small>Today, 10:24 AM</small>
          </div>
        </div>
        <div class="mk-agent-body">
          <p>I combine the website's verified calculations with the connected Supply AI reasoning engine to analyze inventory, identify risks, and recommend actions.</p>
          <p>Once you upload the Item Sales Report, I'll generate a summary of inventory health, stockout risks, and key recommendations for the ${esc(regName)} region.</p>
          <p>Your raw report remains in this browser. Only your question and a compact verified decision summary are sent to Supply AI when the link is enabled.</p>
          <div class="mk-agent-capabilities">
            <strong>Here's what I can do:</strong>
            <ul>
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> <span>Analyze uploaded inventory data</span></li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> <span>Identify stockout and excess risks</span></li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 18v3h14v-3"/></svg> <span>Recommend reorder actions</span></li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l8-4 6 3v15M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/></svg> <span>Provide brand and category insights</span></li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> <span>Answer your supply chain questions</span></li>
            </ul>
          </div>
        </div>
      </div>`;
    feed.appendChild(welcomeEntry);

    panel.querySelector(".mk-close").addEventListener("click", () => togglePanel(false));
    panel.querySelector(".mk-min-toggle")?.addEventListener("click", () => togglePanel(false));
    launcher.addEventListener("click", event => {
      event.stopPropagation();
      togglePanel(!panel.classList.contains("open"));
    });
    spaceButton?.addEventListener("click", () => setSpaceEnabled(profile.spaceEnabled === false, true));

    panel.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      input.value = "";
      execute(question);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        panel.querySelector("form").requestSubmit();
      }
    });

    // Suggested questions click handlers
    panel.querySelectorAll("[data-mk-question]").forEach(button => {
      button.addEventListener("click", () => execute(button.dataset.mkQuestion));
    });

    // Refresh suggested questions
    const questionSets = [
      ["What are the top stockout risks?", "Show inventory coverage by brand.", "Which items should we reorder now?"],
      ["Show ABC classification distribution", "Simulate +14 day supplier delay", "Which models have zero stock?"],
      ["Audit regional data quality", "Compare supplier lead times", "Generate strategic action plan"]
    ];
    let qSetIdx = 0;
    panel.querySelector("#mk-suggested-refresh")?.addEventListener("click", () => {
      qSetIdx = (qSetIdx + 1) % questionSets.length;
      const set = questionSets[qSetIdx];
      const list = panel.querySelector(".mk-suggested-list");
      if (list) {
        list.innerHTML = set.map(q => `
          <button type="button" class="mk-suggested-pill" data-mk-question="${esc(q)}">
            <span>${esc(q)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>`).join("");
        list.querySelectorAll("[data-mk-question]").forEach(b => b.addEventListener("click", () => execute(b.dataset.mkQuestion)));
      }
    });

    panel.querySelector(".mk-mic")?.addEventListener("click", toggleListening);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && panel.classList.contains("open")) togglePanel(false);
    });

    // Close when clicking outside in overlay/drawer mode
    document.addEventListener("click", event => {
      if (document.body.classList.contains("copilot-modal-open") && panel?.classList.contains("open")) {
        const topbarAiBtn = document.getElementById("topbar-ai-btn");
        const homeAiBtn = document.getElementById("home-ai-button");
        if (!panel.contains(event.target) && !topbarAiBtn?.contains(event.target) && !homeAiBtn?.contains(event.target)) {
          togglePanel(false);
        }
      }
    });

    const homeAiBtn = document.getElementById("home-ai-button");
    homeAiBtn?.addEventListener("click", () => togglePanel(!panel.classList.contains("open")));

    // Keep every page stable: Copilot starts closed and opens only on request.
    togglePanel(false);
  }

  function togglePanel(open) {
    panel.classList.toggle("open", open);
    launcher?.classList.toggle("active", open);
    launcher?.setAttribute("aria-expanded", String(open));
    launcher?.setAttribute("aria-label", open ? "Close MK Intelligence" : "Open MK Intelligence");
    if (open) {
      document.body.classList.add("copilot-modal-open");
      document.body.classList.remove("copilot-docked");
    } else {
      document.body.classList.remove("copilot-docked");
      document.body.classList.remove("copilot-modal-open");
    }
    [document.getElementById("topbar-ai-btn"), document.getElementById("home-ai-button")].filter(Boolean).forEach(aiBtn => {
      aiBtn.classList.toggle("active", open);
      aiBtn.setAttribute("aria-expanded", String(open));
    });
    try { localStorage.removeItem("stark-copilot-docked"); } catch (_) {}
    if (open) {
      window.setTimeout(() => input?.focus(), 120);
    }
  }

  function setState(text, running = false) {
    const titleSpan = panel?.querySelector(".mk-copilot-title span");
    if (titleSpan) {
      titleSpan.textContent = running ? "Analyzing supply chain data..." : "Your supply chain analyst";
    }
  }

  function addEntry(message, role = "brain", speak = true, category = "Analysis", htmlExtra = "") {
    const entry = document.createElement("div");
    entry.className = `mk-entry ${role === "user" ? "user" : "brain"}`;
    entry.innerHTML = `
      <div class="mk-entry-card">
        <div class="mk-entry-top">
          <div class="mk-agent-badge">${role === "user" ? "YOU" : "MK"}</div>
          <div class="mk-agent-meta">
            <strong>${role === "user" ? "You" : "MK"}</strong>
            <small>${role === "user" ? "Direct query" : esc(category)}</small>
          </div>
        </div>
        <div class="mk-entry-content">
          ${formatMessage(message)}
          ${htmlExtra}
        </div>
      </div>`;
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight;
    entry.querySelectorAll("[data-mk-run]").forEach(button => button.addEventListener("click", () => execute(button.dataset.mkRun)));
    entry.querySelectorAll("[data-po-download]").forEach(button => button.addEventListener("click", () => downloadPoCsv(lastAnalysis)));
    entry.querySelectorAll("[data-control-action]").forEach(button => button.addEventListener("click", () => {
      const res = controlDashboardTable(button.dataset.controlAction);
      if (res?.message) addEntry(res.message, "brain", false, "Control");
    }));
    if (role === "brain" && speak && profile.voiceEnabled) speakText(message);
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

  function setSpaceEnabled(enabled, announce = true) {
    profile.spaceEnabled = Boolean(enabled);
    saveProfile();
    if (!enabled) {
      spaceConnection.state = "disabled";
      syncSpaceUi();
      if (announce) addEntry("Supply AI is disabled. MK will keep every question and calculation inside this browser.", "brain", false, "AI connection");
      return { intent: "space", category: "AI connection", message: "Supply AI is disabled. MK is using the verified local engine only." };
    }
    spaceConnection.state = "checking";
    spaceDiscoveryPromise = null;
    syncSpaceUi();
    warmSpaceConnection();
    if (announce) addEntry("Supply AI is enabled. MK uses the connected specialist logic natively; neural requests send only your question and a compact verified decision summary. Raw report files remain local.", "brain", false, "AI connection");
    return { intent: "space", category: "AI connection", message: "Supply AI is enabled and the connection is being verified." };
  }

  function spaceStatusMessage() {
    const state = profile.spaceEnabled === false ? "disabled" : spaceConnection.state;
    const mode = spaceConnection.type === "gradio" ? `Space reasoning through ${spaceConnection.endpoint}` : "native specialist reasoning";
    return `Supply AI is **${state}** for ${SPACE_ID}${spaceConnection.endpoint ? ` using ${mode}` : ""}.${spaceConnection.lastError ? ` Last issue: ${spaceConnection.lastError}.` : ""} MK’s verified local analysis remains available.`;
  }

  function syncSpaceUi() {
    if (!spaceButton || !spaceStatus) return;
    const enabled = profile.spaceEnabled !== false;
    const state = enabled ? spaceConnection.state : "disabled";
    const messages = {
      checking: `Connecting to ${SPACE_ID}…`,
      ready: spaceConnection.type === "gradio" ? `Supply AI connected — ${spaceConnection.endpoint}` : "Native specialist logic active",
      offline: "Supply AI unavailable — verified local engine active",
      disabled: "Supply AI disabled — verified local engine only"
    };
    spaceStatus.dataset.state = state;
    const detail = spaceStatus.querySelector("small");
    if (detail) detail.textContent = messages[state] || messages.checking;
    spaceButton.textContent = enabled ? "On" : "Off";
    spaceButton.dataset.state = state;
    spaceButton.setAttribute("aria-pressed", String(enabled));
    spaceButton.setAttribute("aria-label", enabled ? "Disable Supply AI link" : "Enable Supply AI link");
    spaceButton.title = messages[state] || messages.checking;
  }

  async function warmSpaceConnection() {
    if (profile.spaceEnabled === false) {
      spaceConnection.state = "disabled";
      syncSpaceUi();
      return null;
    }
    try { return await discoverSpace(); }
    catch (_) { return null; }
  }

  async function discoverSpace(force = false) {
    if (profile.spaceEnabled === false) throw new Error("Supply AI is disabled");
    if (!force && spaceConnection.state === "ready" && spaceConnection.endpoint) return spaceConnection;
    if (!force && spaceDiscoveryPromise) return spaceDiscoveryPromise;
    spaceConnection.state = "checking";
    syncSpaceUi();
    spaceDiscoveryPromise = (async () => {
      const configText = await fetchText(`${SPACE_ORIGIN}/config`, 18000);
      let config;
      try { config = JSON.parse(configText); }
      catch (_) { throw new Error("Supply AI returned an invalid service description"); }
      const dependency = Array.isArray(config?.dependencies)
        ? config.dependencies.find(item => item?.api_name === SPACE_API_NAME)
        : null;
      if (!dependency) throw new Error(`Supply AI endpoint '${SPACE_API_NAME}' is not published yet`);
      spaceConnection.state = "ready";
      spaceConnection.type = "gradio";
      spaceConnection.endpoint = SPACE_API_NAME;
      spaceConnection.lastError = "";
      syncSpaceUi();
      return spaceConnection;
    })();
    try { return await spaceDiscoveryPromise; }
    catch (error) {
      spaceConnection.state = "offline";
      spaceConnection.lastError = clean(error?.message || "Supply AI connection failed");
      syncSpaceUi();
      throw error;
    } finally {
      if (spaceConnection.state !== "ready") spaceDiscoveryPromise = null;
    }
  }

  async function fetchText(url, timeout = SPACE_TIMEOUT, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { credentials: "omit", cache: "no-store", ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`Supply AI returned HTTP ${response.status}`);
      return await response.text();
    } finally { window.clearTimeout(timer); }
  }

  async function enhanceWithSupplyAI(question, localAnswer) {
    if (profile.spaceEnabled === false) return localAnswer;
    setState("Combining verified calculations with Supply AI reasoning…", true);
    try {
      const connection = await discoverSpace(spaceConnection.state === "offline");
      if (connection.type !== "gradio") return localAnswer;
      const reasoning = await invokeSupplyAI(question, localAnswer, connection);
      if (!reasoning) throw new Error("The Space returned an empty response");
      profile.spaceSuccesses = finite(profile.spaceSuccesses) + 1;
      profile.lastSpaceSuccess = new Date().toISOString();
      saveProfile();
      spaceConnection.fallbackNotified = false;
      return { ...localAnswer, category: "MK Intelligence · Supply AI", message: reasoning };
    } catch (error) {
      spaceConnection.state = "offline";
      spaceConnection.lastError = clean(error?.message || "Supply AI connection failed");
      profile.spaceFailures = finite(profile.spaceFailures) + 1;
      saveProfile();
      syncSpaceUi();
      if (localAnswer.intent === "ai-direct") {
        return { ...localAnswer, category: "AI connection", message: "I couldn’t reach Supply AI just now. Please try again in a moment; no dashboard data was changed." };
      }
      if (spaceConnection.fallbackNotified) return localAnswer;
      spaceConnection.fallbackNotified = true;
      return { ...localAnswer, message: `${localAnswer.message}\n\nSupply AI is temporarily unavailable, so this response uses MK’s verified local engine. No calculation or dashboard task was interrupted.` };
    }
  }

  async function invokeSupplyAI(question, localAnswer, connection) {
    const context = await buildUnifiedDecisionContext(question, localAnswer);
    if (connection.type !== "gradio") return "";
    const payload = {
      version: 1,
      message: clean(question).slice(0, 12_000),
      mode: "Auto",
      history: conversation.turns.slice(-12).map(turn => ({
        user: clean(turn.user || turn.question).slice(0, 6_000),
        assistant: clean(turn.assistant).slice(0, 8_000)
      })).filter(turn => turn.user && turn.assistant),
      context: JSON.stringify({
        instruction: localAnswer.intent === "ai-direct"
          ? "Respond naturally and directly to the user. Do not force a supply-chain report, dashboard summary, numbered framework or executive analysis unless the user asks for one."
          : localAnswer.category === "action completed"
            ? "Respond naturally and confirm only the exact action stated in the verified website result. Do not invent additional actions or outcomes."
            : localAnswer.category === "action started"
              ? "Respond naturally and briefly describe the exact verified action that is about to occur. Do not claim it is complete yet."
              : "Give a complete, natural, standalone answer. Treat every non-null connected report in decisionContext as available website evidence. Never say you cannot access a report when its connected flag is true. If requestedScope exists, use its items as the authoritative requested brand/SKU dataset and address every included item individually when asked. Reconcile Raw Report, Active Brands, Reorder Report, Analysis Report and Sales Analysis, explain the business reason and next action when relevant, and state material uncertainty. Do not mention internal engines or claim an unverified action was executed.",
        verifiedLocalAnswer: localAnswer.intent === "ai-direct" ? "" : clean(localAnswer.message).slice(0, 3_500),
        decisionContext: context
      }).slice(0, 100_000)
    };
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SPACE_TIMEOUT);
    try {
      const callUrl = `${SPACE_ORIGIN}/gradio_api/call/${SPACE_API_NAME}`;
      const queued = await fetch(callUrl, {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [payload] })
      });
      if (!queued.ok) throw new Error(`Supply AI returned HTTP ${queued.status}`);
      const queueResult = await queued.json();
      if (!queueResult?.event_id) throw new Error("Supply AI did not create a response event");
      const resultResponse = await fetch(`${callUrl}/${encodeURIComponent(queueResult.event_id)}`, {
        credentials: "omit", cache: "no-store", signal: controller.signal,
        headers: { Accept: "text/event-stream" }
      });
      if (!resultResponse.ok) throw new Error(`Supply AI result returned HTTP ${resultResponse.status}`);
      const result = parseGradioResult(await resultResponse.text());
      if (!result?.ok) throw new Error(clean(result?.error || "Supply AI could not complete the request"));
      return clean(result.answer).slice(0, 8_000);
    } finally { window.clearTimeout(timer); }
  }

  function parseGradioResult(streamText) {
    const dataLines = String(streamText || "").split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .filter(Boolean);
    for (let index = dataLines.length - 1; index >= 0; index -= 1) {
      try {
        const decoded = JSON.parse(dataLines[index]);
        const value = Array.isArray(decoded) ? decoded[0] : decoded;
        if (value && typeof value === "object") return value;
      } catch (_) {}
    }
    throw new Error("Supply AI returned an unreadable response");
  }

  async function buildUnifiedDecisionContext(question, localAnswer) {
    const code = regionCode();
    const [dataset, sales, reportSnapshot] = await Promise.all([
      loadInventoryDataset(code),
      loadIndexedValue("stark-sales-intelligence-v1", "regional-sales", code),
      loadIndexedValue("stark-inventory-analysis-v1", "reports", `${code}:computed`)
    ]);
    const analysis = lastAnalysis || await getInventoryAnalysis();
    if (analysis) lastAnalysis = analysis;
    const brandSettings = loadBrands(code);
    const brandEntries = Object.entries(brandSettings || {});
    const activeEntries = brandEntries.filter(([, value]) => value?.active !== false);
    const query = clean(question).toLowerCase();
    const queryKey = normalizeLookup(query);
    const queryMatches = item => {
      const values = [item?.model, item?.itemid, item?.itemId, item?.brand, item?.product, item?.title]
        .map(value => clean(value).toLowerCase()).filter(value => value.length >= 2);
      return values.some(value => query.includes(value) || (normalizeLookup(value).length >= 2 && queryKey.includes(normalizeLookup(value))));
    };
    const prioritize = (items, score) => {
      const relevant = (items || []).filter(queryMatches);
      const ranked = (items || []).slice().sort(score);
      return [...relevant, ...ranked].filter((item, index, rows) => rows.indexOf(item) === index).slice(0, 5);
    };
    const salesItems = salesItemsFromSnapshot(sales);
    const inventoryTop = analysis ? prioritize(analysis.scoped, (a, b) => b.riskScore - a.riskScore || b.recommended - a.recommended) : [];
    const salesTop = prioritize(salesItems, (a, b) => finite(b.revenueAtRisk) - finite(a.revenueAtRisk) || finite(b.suggestedQty) - finite(a.suggestedQty));
    const requestedBrand = analysis ? findBrandInQuestion(query, analysis.items) : null;
    const requestedInventoryItems = requestedBrand && analysis
      ? analysis.items.filter(item => normalizeLookup(item.brand) === normalizeLookup(requestedBrand))
        .sort((a, b) => b.riskScore - a.riskScore || b.recommended - a.recommended || clean(a.model || a.itemid).localeCompare(clean(b.model || b.itemid)))
      : [];
    const activeBrandDetails = activeEntries
      .filter(([brand]) => query.includes(clean(brand).toLowerCase()))
      .concat(activeEntries.filter(([brand]) => !query.includes(clean(brand).toLowerCase())))
      .slice(0, 8)
      .map(([brand, value]) => ({
        brand,
        leadTime: clean(value?.leadTime) || "not set",
        shippingCostResponsibility: clean(value?.shippingCostResponsibility) || "not set",
        shippingInformation: clean(value?.shippingInfoAvailable) || "not set",
        palletOption: clean(value?.palletOption) || "not set"
      }));
    const context = {
      region: REGION_NAMES[code],
      page: location.pathname.split("/").pop(),
      localIntent: localAnswer.intent,
      connection: {
        rawReport: Boolean(dataset?.rows?.length),
        analysisReport: Boolean(reportSnapshot?.rows?.length),
        reorderReport: Boolean(analysis?.scoped?.length),
        activeBrands: brandEntries.length > 0,
        salesAnalysis: salesItems.length > 0,
        rule: "All values belong to the same regional browser workspace. Raw Report is the inventory source; Active Brands controls eligibility and lead time; Reorder Report is recalculated from both; Analysis Report consumes the connected source and publishes its computed snapshot."
      },
      formula: "monthly demand × (lead time + coverage) + minimum carrying units + client orders − on hand − eligible inbound; positive quantities are rounded up",
      rawReport: dataset?.rows?.length ? {
        fileName: clean(dataset.fileName), importedAt: dataset.importedAt || "", rows: dataset.rows.length,
        brands: new Set(dataset.rows.map(row => clean(row.brand)).filter(Boolean)).size
      } : null,
      activeBrands: {
        configured: brandEntries.length,
        active: activeEntries.length,
        inactive: brandEntries.length - activeEntries.length,
        missingLeadTime: activeEntries.filter(([, value]) => !clean(value?.leadTime)).length,
        relevantSettings: activeBrandDetails
      },
      reorderReport: analysis ? {
        eligibleItems: analysis.scoped.length,
        reorderItems: analysis.reorders.length,
        recommendedUnits: analysis.recommendedUnits,
        stockoutRisks: analysis.stockouts.length,
        criticalRisks: analysis.criticalRisks,
        excessItems: analysis.excess.length,
        noDemandItems: analysis.noDemand.length,
        averageConfidence: Math.round(analysis.averageConfidence),
        dataQuality: analysis.dataQuality?.score,
        retainedReports: analysis.historyFiles,
        priorities: inventoryTop.map(item => ({
          model: clean(item.model || item.itemid), brand: item.brand, item: clean(item.product), status: clean(item.status),
          priority: item.priority, riskScore: item.riskScore, recommended: item.recommended,
          demandPerMonth: Number(item.demand.toFixed(2)), onHand: item.onHand, openClient: item.openClient,
          openSupplier: item.openSupplier, eligibleInbound: item.planningSupplier,
          leadTimeDays: Number((item.leadMonths * 30.44).toFixed(1)),
          daysToStockout: item.daysToStockout == null ? null : Number(item.daysToStockout.toFixed(1)),
          confidence: Math.round(item.confidence.score), nextAction: item.nextAction,
          businessReason: item.tradeoff?.reasonShort || shortReason(item)
        }))
      } : null,
      analysisReport: reportSnapshot?.rows?.length ? {
        generatedAt: reportSnapshot.generatedAt || "",
        sourceFile: clean(reportSnapshot.sourceFile),
        sourceMode: clean(reportSnapshot.sourceMode),
        kpis: reportSnapshot.kpis || {},
        exceptions: (reportSnapshot.rows || []).slice(0, 5)
      } : null,
      requestedScope: requestedBrand ? {
        request: clean(question),
        brand: requestedBrand,
        totalItems: requestedInventoryItems.length,
        includedItems: Math.min(requestedInventoryItems.length, 150),
        complete: requestedInventoryItems.length <= 150,
        instruction: "Analyze every included SKU individually. Do not claim the brand or SKU data is unavailable. Explain the calculation evidence, business reason, risk and next action for every requested item.",
        items: requestedInventoryItems.slice(0, 150).map(item => ({
          model: clean(item.model || item.itemid), itemId: clean(item.itemid), item: clean(item.product),
          status: clean(item.status), activeBrand: item.activeBrand, eligible: item.eligible, excluded: item.excluded,
          abc: item.abc, demandPerMonth: Number(item.demand.toFixed(2)), last30: item.last30,
          onHand: item.onHand, openClient: item.openClient, openSupplier: item.openSupplier,
          eligibleInbound: item.planningSupplier, leadTimeDays: Number((item.leadMonths * 30.44).toFixed(1)),
          monthsCover: Number.isFinite(item.monthsCover) ? Number(item.monthsCover.toFixed(2)) : null,
          daysToStockout: item.daysToStockout == null ? null : Number(item.daysToStockout.toFixed(1)),
          forecast: Number(item.forecast.value.toFixed(2)), forecastLow: Number(item.forecast.low.toFixed(2)), forecastHigh: Number(item.forecast.high.toFixed(2)),
          reorderQty: item.recommended, priority: item.priority, riskScore: item.riskScore,
          confidence: Math.round(item.confidence.score), nextAction: item.nextAction,
          businessReason: item.tradeoff?.reasonShort || shortReason(item)
        }))
      } : null,
      salesAnalysis: salesItems.length ? {
        sourceFile: clean(sales?.sales?.fileName),
        generatedAt: sales?.analysis?.generatedAt || "",
        models: salesItems.length,
        units: sum(salesItems, item => finite(item.demand9)),
        revenue: sum(salesItems, item => finite(item.demand9) * finite(item.price)),
        grossMargin: sum(salesItems, item => finite(item.demand9) * Math.max(0, finite(item.price) - finite(item.cost))),
        suggestedUnits: sum(salesItems, item => finite(item.suggestedQty)),
        urgentModels: salesItems.filter(item => finite(item.stockoutProbability) >= .65 || item.planningSignal === "Replenish now").length,
        relevantModels: salesTop.map(item => ({
          model: clean(item.model || item.itemId), brand: clean(item.brand), item: clean(item.title),
          demand9: finite(item.demand9), averageMonthly: Number(finite(item.avg9).toFixed(2)), currentStock: finite(item.stock),
          forecastNext: Number(finite(item.forecast?.next).toFixed(2)), suggestedUnits: Math.ceil(finite(item.suggestedQty)),
          stockoutProbability: Number(finite(item.stockoutProbability).toFixed(3)), revenueAtRisk: finite(item.revenueAtRisk),
          planningSignal: clean(item.planningSignal)
        }))
      } : null
    };
    return context;
  }

  async function execute(question) {
    if (busy || !clean(question)) return;
    const sanitizedQuestion = /^(?:set|save|update)\s+(?:(?:hf|hugging\s*face)\s+token|gemini\s+key)\s+/i.test(clean(question)) ? "Configure private AI access" : question;
    addEntry(sanitizedQuestion, "user", false);
    conversation.lastQuestion = clean(sanitizedQuestion);
    busy = true;
    setState("Thinking through current and historical signals…", true);
    try {
      const localAnswer = await routeQuestion(question);
      const answer = await enhanceWithSupplyAI(sanitizedQuestion, localAnswer);
      addEntry(answer.message, "brain", true, answer.category || "decision", answer.htmlExtra || "");
      learnTask(answer.intent || "question");
      conversation.lastIntent = answer.intent || "question";
      conversation.lastItemKey = answer.itemKey || conversation.lastItemKey;
      conversation.lastAnswer = answer.message;
      conversation.turns.push({
        user: clean(sanitizedQuestion),
        assistant: clean(answer.message),
        intent: conversation.lastIntent,
        itemKey: answer.itemKey || "",
        at: Date.now()
      });
      conversation.turns = conversation.turns.slice(-12);
      performDeferredAction(answer);
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

    const hfTokenSet = raw.match(/^(?:set|save|update)\s+(?:hf|hugging\s*face)\s+token\s+([^\s]+)/i);
    if (hfTokenSet) {
      purgeLegacyBrowserTokens();
      return { intent: "hf-space", category: "AI security", message: "For security, MK does not store Hugging Face tokens in this browser. Keep HF_TOKEN in the Space’s private Secrets settings; the website connects through the published Supply AI endpoint." };
    }
    if (/^(?:clear|remove|delete)\s+(?:hf|hugging\s*face)\s+token/i.test(q)) {
      purgeLegacyBrowserTokens();
      return { intent: "hf-space", category: "AI security", message: "Any legacy browser-stored Hugging Face token has been removed. The private Space secret is not exposed to this website." };
    }
    if (/^(?:hf|hugging\s*face)\s+(?:status|token|config)/i.test(q)) {
      return { intent: "hf-space", category: "AI status", message: `${spaceStatusMessage()} Inference credentials are managed privately by the Space.` };
    }

    const geminiSet = raw.match(/^(?:set|save|update)\s+gemini\s+key\s+([A-Za-z0-9_\-]+)/i) || raw.match(/^gemini\s+key\s+([A-Za-z0-9_\-]+)/i);
    if (geminiSet) {
      const key = geminiSet[1].trim();
      localStorage.setItem("mk-gemini-api-key", key);
      return { intent: "gemini", category: "AI configuration", message: "Gemini API key saved locally in this browser. Generative strategic analysis and deep narrative business briefs are now active!" };
    }
    if (/^(?:clear|remove|delete)\s+gemini\s+key/i.test(q)) {
      localStorage.removeItem("mk-gemini-api-key");
      return { intent: "gemini", category: "AI configuration", message: "Gemini API key removed. Built-in deterministic prescriptive reasoning remains fully active." };
    }
    if (/^(?:gemini|ai)\s+(?:status|key|config)/i.test(q)) {
      const hasKey = Boolean(localStorage.getItem("mk-gemini-api-key"));
      return {
        intent: "gemini", category: "AI status",
        message: hasKey
          ? "Gemini API key is configured and active. Generative strategic reasoning and executive briefs are enabled. Type `clear gemini key` to disconnect."
          : "Gemini API key is not configured. Built-in deterministic AI business reasoning is fully active. To connect Gemini for generative C-level memos, type: `set gemini key YOUR_KEY`."
      };
    }

    if (/^(?:supply\s*)?ai(?:\s+link)?\s+(?:on|enable|connect)|^(?:enable|connect)\s+(?:the\s+)?(?:supply\s*)?ai/.test(q)) return setSpaceEnabled(true, false);
    if (/^(?:supply\s*)?ai(?:\s+link)?\s+(?:off|disable|disconnect)|^(?:disable|disconnect)\s+(?:the\s+)?(?:supply\s*)?ai/.test(q)) return setSpaceEnabled(false, false);
    if (/supply ai status|ai connection status|hugging face status|cloud agent status/.test(q)) {
      return { intent: "space", category: "AI connection", message: spaceStatusMessage() };
    }
    if (/^(?:open|show|view|launch)\s+(?:the\s+)?(?:hf|hugging\s*face|cloud\s*ai|supply\s*ai)?\s*(?:space|agent)/.test(q) || q === "huggingface" || q === "hugging face" || q === "hf space" || q === "cloud agent") {
      return { intent: "space", category: "AI connection", message: `Supply AI is integrated directly into this MK panel; there is no detached embedded frame. ${spaceStatusMessage()}` };
    }

    if (/^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|how are you|what'?s up|thank you|thanks)[\s!?.]*$/i.test(q)) {
      return { intent: "ai-direct", category: "MK Intelligence", message: "Supply AI is unavailable right now. Please try again shortly." };
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

    if (/\b(export|download)\b/.test(q) && !/po|purchase order/i.test(q)) return exportCurrentReport();

    const route = Object.keys(ROUTES).sort((a, b) => b.length - a.length).find(name => q.includes(name));
    if (route && /\b(open|go|navigate|show|take me)\b/.test(q)) return navigateTo(route);

    if (/sales|revenue|margin|seller/.test(q) && !/stock|reorder/.test(q)) return salesAnswer(q);

    const knowledge = supplyChainKnowledge(q);
    if (knowledge) return knowledge;

    const needsInventoryContext = /\b(?:inventory|stock|sku|model|item|reorder|replenish|purchase|buy|supplier|vendor|lead\s*time|demand|forecast|coverage|excess|overstock|dead\s*stock|shortage|stockout|service\s*level|otif|fill\s*rate|working\s*capital|carrying\s*cost|holding\s*cost|runout|abc|available|on\s*hand|ats|data\s*quality|current\s*data|portfolio)\b|what[- ]?if|scenario|simulate|action plan|executive brief|strategic brief|c-suite/i.test(q);
    if (!needsInventoryContext) {
      return { intent: "ai-direct", category: "MK Intelligence", message: "Supply AI is unavailable right now. Please try again shortly." };
    }

    const analysis = await getInventoryAnalysis();
    if (!analysis) return { intent: "analysis", category: "data", message: `There is no ${REGION_NAMES[regionCode()]} inventory report available. Upload a Raw Report first; I will analyze it automatically as soon as it is stored.` };
    lastAnalysis = analysis;

    let matched = findItemInQuestion(q, analysis.items);
    if (!matched && /^(why|explain|how confident|what next|what should|and why|tell me more)/.test(q) && conversation.lastItemKey) {
      matched = analysis.items.find(item => item.key === conversation.lastItemKey) || null;
    }

    // Persona-based executive queries
    if (/cfo|working capital|carrying cost|holding cost|burn rate|cash flow|tied[- ]up|salvage|turnover/i.test(q)) return cfoAnswer(analysis);
    if (/coo|operations|service level|98%|otif|fill rate|bottleneck|operational risk|runout horizon/i.test(q)) return cooAnswer(analysis);
    if (/procurement|sourcing|purchase order|draft po|generate po|create po|download po|po draft|vendor order|supplier order/i.test(q)) {
      const brand = findBrandInQuestion(q, analysis.items);
      return procurementAnswer(analysis, brand);
    }

    // Table controls
    if (/(?:filter|show)\s+(?:only\s+)?critical/i.test(q)) return controlDashboardTable("critical");
    if (/(?:filter|show)\s+(?:only\s+)?expedite/i.test(q)) return controlDashboardTable("expedite");
    if (/(?:clear|reset)\s+(?:all\s+)?filters?|show all/i.test(q)) return controlDashboardTable("reset");

    if (/executive brief|strategic brief|executive memo|ai brief|c-suite brief/i.test(q)) return executiveBriefAnswer(analysis);
    if (/\b(trade[- ]?offs?|prescriptive|why expedite|why reorder|why hold|why liquidate|business reason|decision logic)\b/i.test(q)) return tradeoffsAnswer(analysis, matched);
    if (/what[- ]?if|scenario|simulate|if demand|if lead|if supplier|if stock|if coverage|lead time (?:increase|plus|\+)|port delay/i.test(q)) return scenarioAnswer(q, analysis, matched);
    if (/data quality|audit (the )?data|validate data|missing data|bad data|anomal/.test(q)) return dataQualityAnswer(analysis);
    if (/action plan|prioriti[sz]e|what should (i|we) do|next actions?/.test(q)) return actionPlanAnswer(analysis);
    if (/confidence|how certain|accuracy|reliab/.test(q)) return confidenceAnswer(analysis, matched);
    const brand = findBrandInQuestion(q, analysis.items);
    if (brand && /brand|supplier|vendor|lead time|analy|performance|how is/.test(q)) return brandSupplierAnswer(brand, analysis);
    if (matched) return explainItem(matched, analysis);
    if (/^(why|explain|tell me more)/.test(q)) return followUpAnswer(analysis);
    if (/why.*stock.?out|stock.?out.*why|stock.?out risk/.test(q)) return stockoutAnswer(analysis);
    if (/why.*demand|explain demand|demand reason|demand analysis/.test(q)) return demandAnswer(analysis);
    if (/reorder|replenish|purchase|buy/.test(q)) return reorderAnswer(analysis);
    if (/excess|dead stock|no demand|overstock/.test(q)) return excessAnswer(analysis);

    // Connected Supply AI handles open-ended reasoning; deterministic analysis
    // remains the authoritative fallback if the hosted model is unavailable.
    const apiKey = localStorage.getItem("mk-gemini-api-key");
    if (apiKey) {
      const geminiRes = await queryGeminiAdvisor(apiKey, raw, analysis);
      if (geminiRes) return { intent: "gemini-strategic", category: "Gemini Strategic AI", message: geminiRes };
    }
    const nativeAiRes = await queryBrowserNativeAi(raw, analysis);
    if (nativeAiRes) return { intent: "native-ai", category: "Browser Native AI", message: nativeAiRes };

    if (/analy|summary|overview|what.*action|recommend|decision|current data/.test(q)) return portfolioAnswer(analysis);

    return { ...completeAiConsultation(raw, analysis), intent: "ai-grounded" };
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
    return {
      intent: "navigation",
      category: "action started",
      message: `Opening ${name} for ${REGION_NAMES[code]}.`,
      deferredAction: { type: "navigate", url }
    };
  }

  function performDeferredAction(answer) {
    const action = answer?.deferredAction;
    if (!action) return;
    if (action.type === "navigate" && action.url) {
      window.setTimeout(() => location.assign(action.url), 550);
      return;
    }
    if (action.type === "export") {
      window.setTimeout(() => findExportButton()?.click(), 250);
      return;
    }
    if (action.type === "tracking-submit" && action.trackingNumber) {
      const field = document.getElementById("tracking-number");
      const form = document.getElementById("tracking-form");
      if (!field || !form) return;
      field.value = action.trackingNumber;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      window.setTimeout(() => form.requestSubmit(), 200);
    }
  }

  function findExportButton() {
    return [
      document.querySelector(".report-export-action:not([disabled])"),
      document.querySelector("#export-workbook:not([disabled])"),
      document.querySelector("#export-reorder-xlsx:not([disabled])"),
      document.querySelector("#export-active-brands:not([disabled])"),
      document.querySelector("[data-export]:not([disabled])")
    ].find(Boolean) || null;
  }

  function exportCurrentReport() {
    const button = findExportButton();
    if (!button) return { intent: "export", category: "control", message: "There is no exportable report on this page yet. Upload or generate the report first; I will keep export disabled to prevent an empty file." };
    return {
      intent: "export",
      category: "action started",
      message: "The current report export is ready to start. The workbook will include the report data and supported visual charts.",
      deferredAction: { type: "export" }
    };
  }

  function executeTracking(trackingNumber) {
    if (!/shipment-tracking(?:\.html)?\/?$/i.test(location.pathname)) {
      try { sessionStorage.setItem("mk-pending-tracking", trackingNumber); } catch (_) {}
      return {
        intent: "tracking",
        category: "action started",
        message: `Opening Tracking for ${trackingNumber}.`,
        deferredAction: { type: "navigate", url: "shipment-tracking.html" }
      };
    }
    const field = document.getElementById("tracking-number");
    const form = document.getElementById("tracking-form");
    if (!field || !form) return { intent: "tracking", category: "control", message: "The tracking control is unavailable on this page." };
    return {
      intent: "tracking",
      category: "action started",
      message: `Tracking ${trackingNumber} is ready to start.`,
      deferredAction: { type: "tracking-submit", trackingNumber }
    };
  }

  function capabilityAnswer() {
    return {
      intent: "help",
      category: "capabilities",
      message: `**${ENGINE_VERSION} capabilities**\nI combine auditable website calculations with the ${SPACE_ID} reasoning engine. I automatically analyze every uploaded inventory and sales report; backtest multiple demand methods against retained history; score forecast confidence, data quality and model-level risk; explain stockout, demand, excess and reorder reasons; rank next actions; compare brands and supplier timing; and run non-destructive what-if scenarios. I can also apply approved planning settings, open regional pages, start valid exports and track shipments. Raw report files, retained history and learning stay in this browser. When Supply AI is enabled, only your question and a compact verified decision summary are sent to the Space; the local result remains authoritative.`
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

  async function getInventoryAnalysis() {
    const dataset = await loadInventoryDataset(regionCode());
    if (!dataset?.rows?.length) return null;
    const code = regionCode();
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
    item.tradeoff = computePrescriptiveTradeoff(item, settings);
  }

  function computePrescriptiveTradeoff(item, settings) {
    const leadMonths = Math.max(0, finite(item.leadMonths));
    const leadDays = decimal.format(leadMonths * 30.44);
    const stockoutDays = item.daysToStockout != null ? decimal.format(item.daysToStockout) : "unknown";
    const inboundTotal = finite(item.openSupplier);
    const countedInbound = finite(item.planningSupplier);
    const uncountedInbound = Math.max(0, inboundTotal - countedInbound);

    if (item.stockoutRisk) {
      if (uncountedInbound > 0) {
        return {
          tradeoffAction: "Expedite Inbound Supplier PO",
          reasonShort: `Expedite ${number.format(uncountedInbound)} inbound units vs issuing new PO; protects ${stockoutDays}-day runway against ${leadDays}-day lead time.`,
          tradeoffDetail: `• Recommended Action: Expedite existing supplier commitments (${number.format(uncountedInbound)} units arriving outside standard ${settings.delay}-day window).\n• Trade-off Analysis: Releasing a new PO takes full ${leadDays} days and duplicates working capital. Negotiating priority carrier expediting or split shipments closes the stockout gap at a fraction of double-order capital lockup.\n• Business Risk: Stockout directly exposes Class-${item.abc} customer orders, revenue, and service SLA.`
        };
      }
      return {
        tradeoffAction: "Emergency Replenishment PO",
        reasonShort: `Release urgent PO for ${number.format(item.recommended)} units; stockout in ~${stockoutDays} days vs ${leadDays} days lead time.`,
        tradeoffDetail: `• Recommended Action: Issue expedited replenishment PO immediately for ${number.format(item.recommended)} units.\n• Trade-off Analysis: Inaction guarantees a stockout gap of ~${leadDays} days. Priority factory slot or express logistics surcharge is financially justified by preserving Class-${item.abc} gross margin and client retention.\n• Business Risk: Available stock is insufficient to buffer lead-time demand.`
      };
    }

    if (item.recommended > 0) {
      return {
        tradeoffAction: "Release Standard Cycle PO",
        reasonShort: `Order ${number.format(item.recommended)} units now to restore ${decimal.format(settings.coverage)} mo coverage and avoid emergency expedite freight fees.`,
        tradeoffDetail: `• Recommended Action: Release cycle purchase order for ${number.format(item.recommended)} units.\n• Trade-off Analysis: Placing PO within standard lead time (${leadDays} days) captures contractual pricing without emergency expedite premiums, while ordering exactly the ${number.format(item.recommended)}-unit gap prevents excess holding cost.\n• Business Risk: Maintaining order discipline protects target service level without inventory bloat.`
      };
    }

    if (item.monthsCover > Math.max(4, settings.coverage * 2)) {
      return {
        tradeoffAction: "Freeze Replenishment & Capital Preservation",
        reasonShort: `Hold purchasing; ${item.monthsCover == null ? "high" : decimal.format(item.monthsCover)} months cover exceeds threshold. Halts ~20% annualized carrying cost.`,
        tradeoffDetail: `• Recommended Action: Freeze all new purchase orders and monitor burn-down rate.\n• Trade-off Analysis: Holding excess inventory incurs ~18–24% annualized carrying costs (storage, insurance, cost of capital). Halting orders prevents compounding cash lockup and redeploys working capital toward Class-A reorders.\n• Business Risk: Aging inventory and markdown exposure.`
      };
    }

    if (item.demand <= 0 && item.onHand > 0) {
      return {
        tradeoffAction: "Active Disposition & Liquidation",
        reasonShort: `Zero demand for ${number.format(item.onHand)} units on hand; liquidate, transfer or return to avoid 100% write-off.`,
        tradeoffDetail: `• Recommended Action: Initiate inventory disposition (channel transfer, promotional bundle, vendor return, or commercial clearance).\n• Trade-off Analysis: Inactive stock generates zero revenue while accumulating storage overhead. Proactive liquidation now recovers salvage value and frees physical space, outperforming passive holding until total write-off.\n• Business Risk: 100% salvage loss and dead storage fees.`
      };
    }

    if (item.monthsCover < 2) {
      return {
        tradeoffAction: "Weekly Review / Avoid Bullwhip",
        reasonShort: `Coverage is ${item.monthsCover == null ? "adequate" : decimal.format(item.monthsCover)} mo; withhold reorder to prevent bullwhip effect while tracking supplier timing.`,
        tradeoffDetail: `• Recommended Action: Maintain weekly observation cadence; confirm supplier production capacity.\n• Trade-off Analysis: Prematurely ordering induces artificial demand amplification (bullwhip effect) and inflates holding cost. Existing buffer can absorb demand shifts until the safety threshold is breached.\n• Business Risk: Monitor lead-time creep or sudden demand acceleration.`
      };
    }

    if (!item.activeBrand || !item.eligible || item.excluded) {
      return {
        tradeoffAction: "Master Data & Catalog Audit",
        reasonShort: `Item status is excluded or brand is inactive; verify commercial eligibility before committing supplier funds.`,
        tradeoffDetail: `• Recommended Action: Audit ERP master catalog, active-brand settings, and sales eligibility.\n• Trade-off Analysis: Reordering without verified eligibility risks procuring discontinued or unsellable stock.\n• Business Risk: Misallocated purchasing budget.`
      };
    }

    return {
      tradeoffAction: "Maintain Equilibrium Plan",
      reasonShort: `Inventory and confirmed supply cover demand and safety buffer (${item.monthsCover == null ? "healthy" : decimal.format(item.monthsCover)} mo cover).`,
      tradeoffDetail: `• Recommended Action: Maintain standard schedule and order cadence.\n• Trade-off Analysis: System is in equilibrium. No intervention needed; supply and demand remain aligned.\n• Business Risk: Negligible near-term disruption.`
    };
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
      return { intent: "scenario", category: "scenario", message: "Give me a measurable scenario, for example: “What if demand increases 20%?”, “Simulate a +14 day lead time delay”, “What if 100 supplier units arrive?”, or “Set on hand to 50 for MODEL#”. I will compare it with the current plan without changing stored data." };
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
    const html = `<div class="mk-inline-actions">
      <button type="button" class="mk-inline-btn primary" data-mk-run="What if demand increases 30%?">Demand +30%</button>
      <button type="button" class="mk-inline-btn" data-mk-run="Simulate +14 day lead time">Lead Time +14d</button>
      <button type="button" class="mk-inline-btn" data-mk-run="What if demand decreases 20%?">Demand -20%</button>
    </div>`;
    return {
      intent: "scenario", category: "what-if analysis", itemKey: matchedItem?.key || "",
      message: `**Scenario result — ${scenario.description.join(", ")}**\nScope: ${matchedItem ? `${matchedItem.model || matchedItem.itemid} — ${matchedItem.brand}` : `${number.format(scope.length)} eligible items`}. Recommended units change from ${number.format(currentUnits)} to ${number.format(scenarioUnits)} (${signedNumber(delta)}). Lead-time stockout risks change from ${number.format(currentRisks)} to ${number.format(scenarioRisks)}.\nLargest effects:\n${lines || "No item-level change."}\nThis is a simulation only; stored settings and reports were not changed.`,
      htmlExtra: html
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
    const leadDelta = q.match(/(?:lead\s*time|port|supplier|inbound).{0,20}?(?:increase|increases|rise|up|delay|delayed|longer|plus|\+)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*(business\s*days?|working\s*days?|days?|weeks?|months?)/) ||
      q.match(/(\+?\d+(?:\.\d+)?)\s*(?:days?|weeks?|months?)\s*(?:lead\s*time|port\s*delay|supplier\s*delay)/);
    if (leadDelta) {
      const unit = leadDelta[2] || (leadDelta[0].includes("week") ? "weeks" : leadDelta[0].includes("month") ? "months" : "days");
      const addedMonths = leadTimeMonths(`${leadDelta[1]} ${unit}`);
      scenario.leadMonthsDelta = addedMonths;
      scenario.description.push(`lead time +${decimal.format(Number(leadDelta[1]))} ${unit}`);
      scenario.changed = true;
    } else {
      const lead = q.match(/lead\s*time.{0,18}?(?:to|at|is|of)\s*(\d+(?:\.\d+)?)\s*(business\s*days?|working\s*days?|days?|weeks?|months?)/);
      if (lead) {
        scenario.leadMonths = leadTimeMonths(`${lead[1]} ${lead[2]}`);
        scenario.description.push(`lead time ${decimal.format(Number(lead[1]))} ${lead[2]}`);
        scenario.changed = true;
      }
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
    let leadMonths = item.leadMonths;
    if (scenario.leadMonthsDelta != null) leadMonths = Math.max(0, leadMonths + scenario.leadMonthsDelta);
    else if (scenario.leadMonths != null) leadMonths = scenario.leadMonths;
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
    const actions = risks.map((item, index) => `${index + 1}. [${item.priority} ${item.riskScore}/100] ${item.model || item.itemid} — ${item.brand}: **${item.tradeoff?.tradeoffAction || item.nextAction}**${item.recommended ? `; ${number.format(item.recommended)} units` : ""}.\n   • Business reason: ${item.tradeoff?.reasonShort || shortReason(item)}`).join("\n");
    const qualityAction = analysis.dataQuality.score < 85 ? `\nControl action: resolve the highest data-quality exceptions before approving low-confidence orders (current grade ${analysis.dataQuality.grade}).` : "";
    return { intent: "action-plan", category: "ranked actions", message: `**Prescriptive Ranked Next-Action Plan**\n${actions || "No eligible action is required."}${qualityAction}\nPriorities combine stockout timing, shortage size, demand acceleration, client commitments, inbound timing, ABC importance, trade-offs and evidence confidence. They do not replace an approval decision.` };
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
    const tradeoff = item.tradeoff || computePrescriptiveTradeoff(item, analysis.settings);
    const supplyGap = Math.max(0, item.recommended);
    const demandDirection = item.trend > .15 ? "accelerating" : item.trend < -.15 ? "softening" : "stable";
    const supplierNote = item.openSupplier > item.planningSupplier ? `Inbound note: ${number.format(item.openSupplier - item.planningSupplier)} supplier units are outside the arrival window.` : item.openSupplier ? "Eligible inbound supply is counted." : "No supplier quantity offsets the requirement.";
    const protectedNeed = item.demand * (item.leadMonths + analysis.settings.coverage) + analysis.settings.critical + item.openClient;
    const limitations = item.confidence.limitations.length ? ` Limits: ${item.confidence.limitations.join("; ")}.` : "";
    return {
      intent: "item-analysis",
      category: "model decision",
      itemKey: item.key,
      message: `**${clean(item.model || item.itemid)} — ${item.brand}**\n` +
        `**Prescriptive Action:** ${tradeoff.tradeoffAction} (${item.priority} priority • ${item.riskScore}/100 risk • ${item.confidence.level.toLowerCase()} confidence ${number.format(item.confidence.score)}/100).\n\n` +
        `**Business Reason & Trade-Off:**\n${tradeoff.tradeoffDetail}\n\n` +
        `**Calculation & Inventory Position:** Protected need is ${number.format(protectedNeed)} units [demand × (${decimal.format(item.leadMonths)} lead + ${decimal.format(analysis.settings.coverage)} coverage) + ${number.format(analysis.settings.critical)} min + ${number.format(item.openClient)} client]. On hand is ${number.format(item.onHand)} and counted inbound is ${number.format(item.planningSupplier)}. ${supplierNote}\n\n` +
        `**Stockout Risk Analysis:** ${item.stockoutRisk ? `Usable supply may last about ${decimal.format(item.daysToStockout)} days, while supplier lead time is ${decimal.format(item.leadMonths * 30.44)} days.` : "Usable supply is not projected to expire before the replenishment point."}\n\n` +
        `**Demand Evidence:** Three-month rate is ${decimal.format(item.demand)} units/month and the last 30 days show ${number.format(item.last30)} units, indicating ${demandDirection} demand. MK forecasts ${decimal.format(item.forecast.value)} units/month (range ${decimal.format(item.forecast.low)}–${decimal.format(item.forecast.high)}) using ${item.forecast.method}, selected by ${item.forecast.selectedBy}.${limitations}`
    };
  }

  function tradeoffsAnswer(analysis, matchedItem) {
    if (matchedItem) {
      const tradeoff = matchedItem.tradeoff || computePrescriptiveTradeoff(matchedItem, analysis.settings);
      const html = `<div class="mk-inline-actions">
        <button type="button" class="mk-inline-btn primary" data-mk-run="Explain ${clean(matchedItem.model || matchedItem.itemid)}">Full Explanation</button>
        <button type="button" class="mk-inline-btn" data-mk-run="Draft purchase order">Draft PO</button>
      </div>`;
      return {
        intent: "tradeoffs",
        category: "decision trade-off",
        itemKey: matchedItem.key,
        message: `**Decision Trade-Off: ${clean(matchedItem.model || matchedItem.itemid)} — ${matchedItem.brand}**\n` +
          `**Prescriptive Action:** ${tradeoff.tradeoffAction}\n` +
          `**Trade-Off Breakdown:**\n${tradeoff.tradeoffDetail}\n\n` +
          `**Financial & Service Position:** On hand: ${number.format(matchedItem.onHand)} units | Usable runway: ${matchedItem.daysToStockout != null ? decimal.format(matchedItem.daysToStockout) + " days" : "stable"} | Lead time: ${decimal.format(matchedItem.leadMonths * 30.44)} days | Gap: ${number.format(matchedItem.recommended)} units.`,
        htmlExtra: html
      };
    }

    const expediteItems = analysis.scoped.filter(item => item.tradeoff?.tradeoffAction === "Expedite Inbound Supplier PO");
    const emergencyItems = analysis.scoped.filter(item => item.tradeoff?.tradeoffAction === "Emergency Replenishment PO");
    const cycleItems = analysis.scoped.filter(item => item.tradeoff?.tradeoffAction === "Release Standard Cycle PO");
    const excessItems = analysis.scoped.filter(item => item.tradeoff?.tradeoffAction === "Freeze Replenishment & Capital Preservation");
    const noDemandItems = analysis.scoped.filter(item => item.tradeoff?.tradeoffAction === "Active Disposition & Liquidation");

    const html = `<div class="mk-inline-actions">
      <button type="button" class="mk-inline-btn primary" data-mk-run="Generate executive brief">Executive Brief</button>
      <button type="button" class="mk-inline-btn" data-mk-run="CFO working capital analysis">CFO View</button>
      <button type="button" class="mk-inline-btn" data-mk-run="COO operational risk review">COO View</button>
      <button type="button" class="mk-inline-btn" data-mk-run="Draft purchase order">Draft PO</button>
    </div>`;

    return {
      intent: "tradeoffs",
      category: "prescriptive trade-offs",
      message: `**Prescriptive Supply Chain Trade-Offs — ${REGION_NAMES[analysis.code]}**\n` +
        `Every inventory decision balances service reliability against working capital:\n\n` +
        `1. **Expedite Inbound (${number.format(expediteItems.length)} SKUs):** Priority carrier expediting on already-placed POs delivers inventory faster than new POs and prevents double capital lockup.\n` +
        `2. **Emergency PO (${number.format(emergencyItems.length)} SKUs):** Immediate factory allocation is financially justified to protect high-margin Class-A customers against imminent stockout.\n` +
        `3. **Standard Cycle Reorder (${number.format(cycleItems.length)} SKUs, ${number.format(analysis.recommendedUnits)} units):** Restores target safety stock while avoiding emergency freight surcharges.\n` +
        `4. **Freeze Purchasing (${number.format(excessItems.length)} SKUs):** Withholding orders prevents compounding 18-24% annual carrying costs and protects cash flow.\n` +
        `5. **Active Disposition (${number.format(noDemandItems.length)} SKUs):** Liquidating dead stock frees warehouse space and recovers capital before 100% write-off.\n\n` +
        `Ask for any model name to inspect its SKU-specific trade-off analysis.`,
      htmlExtra: html
    };
  }

  async function executiveBriefAnswer(analysis) {
    const apiKey = localStorage.getItem("mk-gemini-api-key");
    if (apiKey) {
      const geminiRes = await queryGeminiAdvisor(apiKey, "Provide an executive strategic supply chain brief and decision trade-offs for executive leadership.", analysis);
      if (geminiRes) return { intent: "executive-brief", category: "Gemini Executive Brief", message: geminiRes };
    }

    const expediteItems = analysis.scoped.filter(item => item.tradeoff?.tradeoffAction === "Expedite Inbound Supplier PO");
    const reorderItems = analysis.scoped.filter(item => item.recommended > 0);
    const excessItems = analysis.excess;
    const noDemandItems = analysis.noDemand;
    const totalReorders = analysis.recommendedUnits;
    const topStockout = analysis.stockouts[0];
    const topExcess = analysis.excess[0];

    const html = `<div class="mk-inline-actions">
      <button type="button" class="mk-inline-btn primary" data-mk-run="Show decision trade-offs">Decision Trade-Offs</button>
      <button type="button" class="mk-inline-btn" data-mk-run="CFO working capital analysis">CFO Analysis</button>
      <button type="button" class="mk-inline-btn" data-mk-run="Draft purchase order">Draft PO</button>
      <button type="button" class="mk-inline-btn" data-mk-run="Simulate +14 day lead time">What-If (+14d)</button>
    </div>`;

    return {
      intent: "executive-brief",
      category: "Executive AI Brief",
      message: `**Executive Supply Chain Brief — ${REGION_NAMES[analysis.code]}**\n` +
        `**1. Executive Summary:** ${number.format(analysis.scoped.length)} active SKUs audited across ${number.format(analysis.activeBrands)} brands. Total replenishment requirement is ${number.format(totalReorders)} units across ${number.format(reorderItems.length)} items. Imminent stockout risk detected on ${number.format(analysis.stockouts.length)} items (${number.format(analysis.criticalRisks)} critical).\n\n` +
        `**2. Prescriptive Decision Trade-Offs:**\n` +
        `• **Expedite Inbound (${number.format(expediteItems.length)} SKUs):** Prioritize expediting open supplier commitments arriving outside the planning window over issuing duplicate purchase orders. Protects lead-time stockout window at a fraction of capital lockup.\n` +
        `• **Release Replenishment POs (${number.format(reorderItems.length)} SKUs):** Release ${number.format(totalReorders)} units now to restore ${decimal.format(analysis.settings.coverage)} mo coverage without incurring emergency freight surcharges.\n` +
        `• **Freeze Purchasing & Capital Preservation (${number.format(excessItems.length)} SKUs):** Halting new POs on excess inventory eliminates ~18-24% annual carrying costs and protects working capital liquidity.\n` +
        `• **Active Disposition (${number.format(noDemandItems.length)} SKUs):** Initiate promotional bundles, transfers or supplier returns on zero-demand inventory to recover salvage value before 100% write-off.\n\n` +
        `**3. Immediate Next Steps:**\n` +
        `1. Expedite inbound for ${topStockout ? `${topStockout.model || topStockout.itemid} (${topStockout.brand})` : "top stockout criticals"}.\n` +
        `2. Release procurement authorization for ${number.format(totalReorders)} units.\n` +
        `3. Freeze vendor purchase orders on ${topExcess ? `${topExcess.model || topExcess.itemid}` : "excess SKUs"}.\n\n` +
        `*(Note: To enable generative Gemini strategic briefings, type \`set gemini key YOUR_KEY\`)*`,
      htmlExtra: html
    };
  }

  async function queryGeminiAdvisor(apiKey, userQuestion, analysis) {
    try {
      const topStockout = analysis.stockouts.slice(0, 4).map(i => `${i.model} (${i.brand}): stockout in ${decimal.format(i.daysToStockout)}d, lead ${decimal.format(i.leadMonths * 30.44)}d, action: ${i.tradeoff?.tradeoffAction || i.nextAction}`).join("; ");
      const topExcess = analysis.excess.slice(0, 3).map(i => `${i.model}: ${decimal.format(i.monthsCover)} mo cover`).join("; ");
      const context = `Supply Chain Real-Time Context for ${REGION_NAMES[analysis.code]}:
- Scope: ${analysis.scoped.length} active SKUs, ${analysis.activeBrands} brands.
- Monthly Demand: ${decimal.format(analysis.totalDemand)} units. On Hand: ${number.format(analysis.totalStock)} units.
- Reorder Demand: ${number.format(analysis.recommendedUnits)} units across ${analysis.reorders.length} SKUs.
- Stockout Risks: ${analysis.stockouts.length} SKUs (${topStockout || "None"}).
- Excess Inventory: ${analysis.excess.length} SKUs (${topExcess || "None"}).
- Dead Stock: ${analysis.noDemand.length} SKUs.
- Planning Policy: ${analysis.settings.coverage} mo coverage, ${analysis.settings.critical} units critical buffer, ${analysis.settings.delay} days delay window.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Question: ${userQuestion}\n\n${context}` }] }],
          systemInstruction: { parts: [{ text: "You are MK, an executive AI supply chain and decision advisor. Provide structured, authoritative, and actionable business reasoning with clear trade-offs (capital impact, service level, supplier risks). Use concise bullet points and bold headers." }] }
        })
      });
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (_) {
      return null;
    }
  }

  function cfoAnswer(analysis) {
    const currency = analysis.code === "EU" ? "EUR" : analysis.code === "CA" ? "CAD" : "USD";
    const money = val => new Intl.NumberFormat(analysis.code === "EU" ? "en-IE" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
    const unitVal = item => finite(item.cost) || finite(item.price) * 0.6 || 25;

    const excessValue = sum(analysis.excess, item => item.onHand * unitVal(item));
    const annualHoldingBurn = excessValue * 0.22;
    const monthlyHoldingBurn = annualHoldingBurn / 12;

    const deadStockValue = sum(analysis.noDemand, item => item.onHand * unitVal(item));
    const salvageRecovery = deadStockValue * 0.45;

    const reorderValue = sum(analysis.reorders, item => item.recommended * unitVal(item));
    const turnoverRate = analysis.totalStock > 0 ? (analysis.totalDemand * 12) / analysis.totalStock : 0;
    const topExcess = analysis.excess.slice().sort((a,b) => (b.onHand * unitVal(b)) - (a.onHand * unitVal(a)))[0];

    const msg = `**CFO Financial & Working Capital Brief — ${REGION_NAMES[analysis.code]}**\n\n` +
      `• **Trapped Capital in Excess:** ~${money(excessValue)} locked across ${number.format(analysis.excess.length)} SKUs (>4 mo cover).\n` +
      `• **Carrying Cost Burn Rate:** Burning ~${money(monthlyHoldingBurn)}/month (~${money(annualHoldingBurn)}/year) in warehouse carrying costs (22% annual cost of capital, insurance, and obsolescence).\n` +
      `• **Replenishment Budget Required:** ~${money(reorderValue)} needed to fund ${number.format(analysis.recommendedUnits)} recommended units across ${number.format(analysis.reorders.length)} SKUs.\n` +
      `• **Dead Stock Salvage Opportunity:** ~${money(deadStockValue)} at risk of 100% write-off. Prompt liquidation/bundling could unlock ~${money(salvageRecovery)} in liquid cash.\n` +
      `• **Portfolio Velocity:** Annualized inventory turns: **${decimal.format(turnoverRate)}x**.\n\n` +
      `**CFO Strategic Recommendation:** Freeze purchasing immediately on overstocked SKUs${topExcess ? ` (e.g. ${topExcess.model})` : ""}, channel salvage capital toward Class-A reorder gaps, and halt compounding cash drag.`;

    const html = `<div class="mk-inline-actions">
      <button type="button" class="mk-inline-btn primary" data-mk-run="Show decision trade-offs">Decision Trade-Offs</button>
      <button type="button" class="mk-inline-btn" data-mk-run="Draft purchase order">Draft Reorder PO</button>
      <button type="button" class="mk-inline-btn" data-mk-run="What if demand decreases 20%?">Simulate Downturn (-20%)</button>
    </div>`;

    return { intent: "cfo", category: "CFO Capital Intelligence", message: msg, htmlExtra: html };
  }

  function cooAnswer(analysis) {
    const urgentRunouts = analysis.stockouts.filter(i => i.daysToStockout != null && i.daysToStockout <= 7);
    const mediumRunouts = analysis.stockouts.filter(i => i.daysToStockout != null && i.daysToStockout > 7 && i.daysToStockout <= 14);
    const lateInbound = analysis.scoped.filter(i => i.openSupplier > i.planningSupplier);
    const uncountedUnits = sum(lateInbound, i => i.openSupplier - i.planningSupplier);

    const otifThreat = analysis.stockouts.filter(i => i.abc === "A" || i.abc === "B").length;
    const avgLeadDays = mean(analysis.scoped.map(i => i.leadMonths * 30.44));

    const msg = `**COO Operational Reliability & Service Level Review — ${REGION_NAMES[analysis.code]}**\n\n` +
      `• **Service Level Threat (98% SLA at Risk):** ${number.format(otifThreat)} Class-A/B revenue-driving SKUs face imminent stockout before replenishment arrives.\n` +
      `• **Stockout Horizon:**\n` +
      `   - **≤ 7 Days (Critical Stockout):** ${number.format(urgentRunouts.length)} SKUs\n` +
      `   - **8–14 Days (Severe Runway Risk):** ${number.format(mediumRunouts.length)} SKUs\n` +
      `   - **Total Lead-Time Deficits:** ${number.format(analysis.stockouts.length)} SKUs\n` +
      `• **Inbound Supply Disruption:** ${number.format(lateInbound.length)} SKUs have ${number.format(uncountedUnits)} inbound units arriving outside the standard delivery window (${analysis.settings.delay} days).\n` +
      `• **Supply Chain Vulnerability:** Portfolio average lead time is ${decimal.format(avgLeadDays)} days. High lead time variance requires active expediting.\n\n` +
      `**COO Operational Action:** Coordinate immediate carrier split-shipments for the top ${number.format(urgentRunouts.length)} critical SKUs to protect client OTIF fulfillment without waiting for bulk sea freight.`;

    const html = `<div class="mk-inline-actions">
      <button type="button" class="mk-inline-btn primary" data-mk-run="Show top stockout risks">Stockout SKUs</button>
      <button type="button" class="mk-inline-btn" data-mk-run="Simulate +14 day lead time">Simulate Port Delay (+14d)</button>
      <button type="button" class="mk-inline-btn" data-control-action="critical">Filter Table to Critical</button>
    </div>`;

    return { intent: "coo", category: "COO Operations Review", message: msg, htmlExtra: html };
  }

  function procurementAnswer(analysis, brandFilter = null) {
    let reorders = analysis.reorders;
    if (brandFilter) {
      reorders = reorders.filter(i => normalize(i.brand) === normalize(brandFilter));
    }
    reorders = reorders.slice().sort((a,b) => b.riskScore - a.riskScore || b.recommended - a.recommended);

    const totalUnits = sum(reorders, i => i.recommended);
    const brands = [...new Set(reorders.map(i => i.brand))];
    const expediteCount = reorders.filter(i => i.tradeoff?.tradeoffAction === "Expedite Inbound Supplier PO").length;

    const topPreview = reorders.slice(0, 5);
    const tableHtml = topPreview.length ? `
      <div class="mk-po-preview">
        <table>
          <thead>
            <tr><th>SKU / Model</th><th>Brand</th><th class="num">Order Qty</th><th class="num">Lead Days</th><th>Priority</th></tr>
          </thead>
          <tbody>
            ${topPreview.map(i => `<tr><td>${esc(i.model || i.itemid)}</td><td>${esc(i.brand)}</td><td class="num"><strong>${number.format(i.recommended)}</strong></td><td class="num">${decimal.format(i.leadMonths * 30.44)}</td><td>${esc(i.priority)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>` : "";

    const msg = `**Procurement & Sourcing Action Plan — ${REGION_NAMES[analysis.code]}**\n\n` +
      `• **Purchase Order Scope:** ${number.format(reorders.length)} line items across ${number.format(brands.length)} vendors.\n` +
      `• **Total Procurement Quantity:** **${number.format(totalUnits)} units**.\n` +
      `• **Inbound Expedite Opportunities:** ${number.format(expediteCount)} SKUs have open commitments that should be expedited rather than duplicating orders.\n` +
      `• **Batching Optimization:** Consolidate PO releases by supplier to meet container fill rates and capture volume tier discounts.\n\n` +
      `Click below to download the complete Purchase Order CSV ready for ERP or vendor submission.`;

    const html = `${tableHtml}
      <div class="mk-inline-actions">
        <button type="button" class="mk-inline-btn primary" data-po-download="true">📥 Download PO CSV (${number.format(reorders.length)} SKUs)</button>
        <button type="button" class="mk-inline-btn" data-mk-run="Show decision trade-offs">Trade-Off Analysis</button>
      </div>`;

    return { intent: "procurement", category: "Procurement Intelligence", message: msg, htmlExtra: html };
  }

  async function downloadPoCsv(analysis) {
    const data = analysis || lastAnalysis || await getInventoryAnalysis();
    if (!data?.reorders?.length) {
      addEntry("There are no recommended replenishment items in the current scope to export.", "brain", true, "control");
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const headers = [
      "PO Line", "Model / Item ID", "Brand", "Product Description", "ABC Class",
      "Priority", "Recommended Order Qty", "Lead Time (Days)", "On Hand",
      "Counted Inbound", "Open Client", "Monthly Demand", "Runway Days",
      "Prescriptive Action", "Business Reason"
    ];
    const rows = data.reorders.map((item, idx) => [
      idx + 1,
      `"${clean(item.model || item.itemid).replace(/"/g, '""')}"`,
      `"${clean(item.brand).replace(/"/g, '""')}"`,
      `"${clean(item.product).replace(/"/g, '""')}"`,
      item.abc,
      item.priority,
      item.recommended,
      Math.round(item.leadMonths * 30.44),
      item.onHand,
      item.planningSupplier,
      item.openClient,
      decimal.format(item.demand),
      item.daysToStockout != null ? decimal.format(item.daysToStockout) : "N/A",
      `"${clean(item.tradeoff?.tradeoffAction || item.nextAction).replace(/"/g, '""')}"`,
      `"${clean(item.tradeoff?.reasonShort || shortReason(item)).replace(/"/g, '""')}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Purchase-Order-Replenishment-${data.code}-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    addEntry(`Generated and downloaded **Purchase-Order-Replenishment-${data.code}-${dateStr}.csv** with ${number.format(data.reorders.length)} replenishment line items.`, "brain", true, "automation");
  }

  function controlDashboardTable(action) {
    const riskFilter = document.getElementById("brain-risk");
    const searchFilter = document.getElementById("brain-search");
    if (riskFilter && searchFilter) {
      if (action === "critical" || action === "filter-critical") {
        riskFilter.value = "Critical";
        riskFilter.dispatchEvent(new Event("change", { bubbles: true }));
        return { intent: "table-control", category: "dashboard automation", message: "Filtered Decision Matrix to **Critical** risk items." };
      }
      if (action === "expedite" || action === "filter-expedite") {
        searchFilter.value = "Expedite";
        searchFilter.dispatchEvent(new Event("input", { bubbles: true }));
        return { intent: "table-control", category: "dashboard automation", message: "Filtered Decision Matrix to items requiring **Inbound Supplier Expediting**." };
      }
      if (action === "reset") {
        riskFilter.value = "all";
        searchFilter.value = "";
        riskFilter.dispatchEvent(new Event("change", { bubbles: true }));
        searchFilter.dispatchEvent(new Event("input", { bubbles: true }));
        return { intent: "table-control", category: "dashboard automation", message: "Reset all table filters to show all active items." };
      }
    }
    return { intent: "table-control", category: "dashboard automation", message: `Filter action '${action}' applied to the active view.` };
  }

  async function queryBrowserNativeAi(userQuestion, analysis) {
    try {
      const ai = window.ai;
      if (!ai?.languageModel) return null;
      const topStockout = analysis.stockouts.slice(0, 3).map(i => `${i.model} (${decimal.format(i.daysToStockout)}d runway)`).join(", ");
      const topExcess = analysis.excess.slice(0, 3).map(i => `${i.model} (${decimal.format(i.monthsCover)} mo)`).join(", ");
      const systemInstruction = "You are MK, an executive autonomous AI supply chain advisor. Provide authoritative, concise, bulleted C-level advice balancing service level, working capital, and supplier risks.";
      const prompt = `Context for ${REGION_NAMES[analysis.code]}:
- Scope: ${analysis.scoped.length} active SKUs, ${analysis.activeBrands} brands.
- Stockout Risks: ${analysis.stockouts.length} SKUs (${topStockout || "None"}).
- Excess Inventory: ${analysis.excess.length} SKUs (${topExcess || "None"}).
- Reorder Demand: ${number.format(analysis.recommendedUnits)} units across ${analysis.reorders.length} SKUs.
User Question: ${userQuestion}`;

      const session = await ai.languageModel.create({ systemPrompt: systemInstruction });
      const result = await session.prompt(prompt);
      session.destroy();
      return result;
    } catch (_) {
      return null;
    }
  }

  function completeAiConsultation(question, analysis) {
    const topStockout = analysis.stockouts[0];
    const topExcess = analysis.excess[0];
    const urgentExpedite = analysis.scoped.filter(i => i.tradeoff?.tradeoffAction === "Expedite Inbound Supplier PO");

    const currency = analysis.code === "EU" ? "EUR" : analysis.code === "CA" ? "CAD" : "USD";
    const money = val => new Intl.NumberFormat(analysis.code === "EU" ? "en-IE" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
    const unitVal = item => finite(item.cost) || finite(item.price) * 0.6 || 25;
    const tiedUpCapital = sum(analysis.excess, item => item.onHand * unitVal(item));
    const reorderCapital = sum(analysis.reorders, item => item.recommended * unitVal(item));

    const msg = `**MK Autonomous Strategic AI — ${REGION_NAMES[analysis.code]}**\n\n` +
      `Regarding: *“${clean(question)}”*\n\n` +
      `**1. Executive Supply Chain Situation:**\n` +
      `Network active scope is ${number.format(analysis.scoped.length)} SKUs across ${number.format(analysis.activeBrands)} brands. ` +
      `Operating health exhibits **${number.format(analysis.stockouts.length)} SKUs at stockout risk** (${number.format(analysis.criticalRisks)} critical), balanced against **${number.format(analysis.excess.length)} SKUs in excess** representing ~${money(tiedUpCapital)} in trapped capital.\n\n` +
      `**2. Cross-Functional Trade-Off Analysis:**\n` +
      `• **Operations & OTIF:** Prioritize expediting inbound shipments for ${urgentExpedite.length ? `${number.format(urgentExpedite.length)} SKUs (e.g. ${urgentExpedite[0].model})` : "critical items"} to prevent service failures without placing duplicate rush orders.\n` +
      `• **Finance & Working Capital:** Release ~${money(reorderCapital)} in replenishment capital strictly for high-velocity Class-A lines, while enforcing an immediate purchase freeze on ${topExcess ? `${topExcess.model} and ` : ""}other excess items to halt holding cost drag.\n` +
      `• **Procurement Execution:** Standard lead time averages ${decimal.format(mean(analysis.scoped.map(i => i.leadMonths * 30.44)))} days. Reordering now locks contractual terms and avoids air freight expedite penalties.\n\n` +
      `**3. Prescriptive Next Steps:**\n` +
      `Review executive trade-offs, draft supplier purchase orders, or run what-if simulations using the action buttons below.`;

    const html = `<div class="mk-inline-actions">
      <button type="button" class="mk-inline-btn primary" data-mk-run="Generate executive brief">Executive Brief</button>
      <button type="button" class="mk-inline-btn" data-mk-run="CFO working capital analysis">CFO Analysis</button>
      <button type="button" class="mk-inline-btn" data-mk-run="COO operational risk review">COO Review</button>
      <button type="button" class="mk-inline-btn" data-mk-run="Draft purchase order">Draft PO</button>
      <button type="button" class="mk-inline-btn" data-mk-run="Simulate +14 day lead time">What-If (+14d)</button>
    </div>`;

    return { intent: "ai-consult", category: "Complete AI Advisory", message: msg, htmlExtra: html };
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
    const lines = risks.map((item, index) => `${index + 1}. [${item.priority} ${item.riskScore}/100] ${item.model || item.itemid} — ${item.brand}: ${decimal.format(item.daysToStockout)} days to stockout; ${number.format(item.recommended)} units; action: **${item.tradeoff?.tradeoffAction || item.nextAction}**.\n   • Business reason: ${item.tradeoff?.reasonShort || shortReason(item)}`).join("\n");
    return { intent: "stockout", category: "risk analysis", itemKey: risks[0]?.key || "", message: `**Top stockout risks & Prescriptive Trade-Offs**\n${lines}\n\nPrescriptive rationale: Demand consumes usable supply before replenishment arrives. When open supplier POs exist outside the window, expediting them is prioritized over issuing new orders to close the stockout gap without doubling capital commitment.` };
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
    const lines = items.map((item, index) => `${index + 1}. [${item.priority}] ${item.model || item.itemid} — ${item.brand}: ${number.format(item.recommended)} units. **${item.tradeoff?.tradeoffAction || "Release Order"}**.\n   • Business reason: ${item.tradeoff?.reasonShort || shortReason(item)}`).join("\n");
    return { intent: "reorder", category: "reorder decision", itemKey: items[0]?.key || "", message: `**Recommended next purchases & Trade-Offs**\n${lines}\n\nFormula basis: monthly demand × (brand lead time + coverage months) + critical carrying units + client orders − on hand − eligible inbound supplier units. Ordering now within standard vendor cycle captures contractual terms and avoids emergency freight surcharges.` };
  }

  function excessAnswer(analysis) {
    const items = [...analysis.noDemand, ...analysis.excess].filter((item, index, rows) => rows.indexOf(item) === index).sort((a, b) => b.onHand - a.onHand).slice(0, 5);
    if (!items.length) return { intent: "excess", category: "inventory health", message: "No material excess or no-demand inventory exception is detected in the current active-brand scope." };
    const lines = items.map((item, index) => `${index + 1}. ${item.model || item.itemid} — ${item.brand}: ${number.format(item.onHand)} on hand; ${item.demand ? decimal.format(item.monthsCover) + " months cover" : "no supported demand"}. **${item.tradeoff?.tradeoffAction || "Review"}**.\n   • Trade-off: ${item.tradeoff?.reasonShort || "Preserve working capital"}`).join("\n");
    return { intent: "excess", category: "inventory health", message: `**Excess and no-demand prescriptive trade-offs**\n${lines}\n\nPrescriptive trade-off: Freezing new purchase orders immediately halts ~18–24% annualized carrying costs. Proactively liquidating or transferring dead stock recovers salvage liquidity, outperforming passive warehouse holding until total write-off.` };
  }

  function salesItemsFromSnapshot(snapshot) {
    if (snapshot?.analysis?.items?.length) return snapshot.analysis.items;
    const rows=snapshot?.sales?.rows||[],periods=(snapshot?.sales?.periods||[]).slice().sort().slice(-9),priceRows=snapshot?.prices?.rows||[];
    if(!rows.length)return [];
    const priceMap=new Map();priceRows.forEach(row=>{if(row.model)priceMap.set(`M:${normalize(row.model)}`,row);if(row.itemId)priceMap.set(`I:${normalize(row.itemId)}`,row);});
    return rows.map(row=>{const match=priceMap.get(`I:${normalize(row.itemId)}`)||priceMap.get(`M:${normalize(row.model)}`)||{},history=periods.map(period=>Math.max(0,finite(row.monthly?.[period]))),demand9=history.reduce((total,value)=>total+value,0),avg9=history.length?demand9/history.length:0,currentStock=Math.max(0,finite(row.stock)),suggestedQty=Math.max(0,avg9-currentStock),price=finite(match.price||row.embeddedPrice),cost=finite(match.cost);return{...row,demand9,avg9,price,cost,stock:currentStock,suggestedQty,revenueAtRisk:suggestedQty*price,excessCost:Math.max(0,currentStock-avg9*2)*cost,deadStockCost:demand9<=0?currentStock*cost:0,stockoutProbability:avg9>0&&currentStock<avg9?1:0,planningSignal:suggestedQty>0?"Replenish":"Review",forecast:{next:avg9,backtestTests:0}};});
  }

  async function salesAnswer() {
    const snapshot = await loadIndexedValue("stark-sales-intelligence-v1", "regional-sales", regionCode());
    const items = salesItemsFromSnapshot(snapshot);
    if (!items.length) return { intent: "sales", category: "data", message: `No ${REGION_NAMES[regionCode()]} sales analysis is available. Upload the sales report; I will analyze it automatically.` };
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
    const queryKey = normalizeLookup(q);
    const matches = items.filter(item => {
      const values = [item.model, item.itemid, item.product].map(value => clean(value).toLowerCase()).filter(value => value.length >= 3);
      return values.some(value => q.includes(value) || (normalizeLookup(value).length >= 3 && queryKey.includes(normalizeLookup(value))));
    });
    return matches.sort((a, b) => clean(b.model).length - clean(a.model).length)[0] || null;
  }

  function findBrandInQuestion(q, items) {
    const queryKey = normalizeLookup(q);
    return [...new Set(items.map(item => item.brand))]
      .filter(brand => clean(brand).length >= 2 && (q.includes(clean(brand).toLowerCase()) || queryKey.includes(normalizeLookup(brand))))
      .sort((a, b) => normalizeLookup(b).length - normalizeLookup(a).length)[0] || null;
  }

  async function inspectCurrentData(silentExisting) {
    const code = regionCode();
    const dataset = await loadInventoryDataset(code);
    const [sales, reportSnapshot] = await Promise.all([
      loadIndexedValue("stark-sales-intelligence-v1", "regional-sales", code),
      loadIndexedValue("stark-inventory-analysis-v1", "reports", `${code}:computed`)
    ]);
    const inventoryStamp = dataset?.importedAt || "";
    const salesStamp = sales?.sales?.importedAt || "";
    const analysisStamp = reportSnapshot?.generatedAt || "";
    let controlStamp = "";
    try {
      controlStamp = `${localStorage.getItem(`stark-active-brands-${regionKey(code)}`) || ""}|${localStorage.getItem(`stark-inventory-settings-${regionKey(code)}`) || ""}`;
    } catch (_) {}
    const signature = `${inventoryStamp}|${salesStamp}|${analysisStamp}|${controlStamp}`;
    if (!inventoryStamp && !salesStamp && !analysisStamp) return;
    if (silentExisting && profile.lastAnalyzed?.[code] === signature) return;
    setState("Automatically analyzing the newly uploaded data…", true);
    const analysis = await getInventoryAnalysis();
    lastAnalysis = analysis;
    profile.lastAnalyzed = { ...(profile.lastAnalyzed || {}), [code]: signature };
    profile.lastAutomaticAnalysis = new Date().toISOString();
    if (analysis) {
      const methodCounts = analysis.scoped.reduce((counts, item) => {
        counts[item.forecast.method] = (counts[item.forecast.method] || 0) + 1;
        return counts;
      }, {});
      const primaryMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "limited-history fallback";
      profile.modelState = {
        ...(profile.modelState || {}),
        [code]: {
          trainedAt: new Date().toISOString(),
          historyFiles: analysis.historyFiles,
          eligibleItems: analysis.scoped.length,
          averageConfidence: Math.round(analysis.averageConfidence),
          dataGrade: analysis.dataQuality.grade,
          primaryMethod
        }
      };
    }
    saveProfile();
    if (analysis) {
      const localAnswer = portfolioAnswer(analysis, "A new data source was detected and analyzed automatically.");
      const answer = await enhanceWithSupplyAI(`Analyze the newly uploaded ${REGION_NAMES[code]} inventory report and recommend the most important next action.`, localAnswer);
      addEntry(answer.message, "brain", true, "automatic analysis");
    } else if (salesItemsFromSnapshot(sales).length) {
      const localAnswer = await salesAnswer();
      const answer = await enhanceWithSupplyAI(`Analyze the newly uploaded ${REGION_NAMES[code]} sales report and recommend the most important next action.`, localAnswer);
      addEntry(`A new sales source was detected and analyzed automatically.\n${answer.message}`, "brain", true, "automatic analysis");
    }
    setState("Automatic analysis complete");
  }

  function bindLiveData() {
    const receive = message => {
      if (!message || !["inventory-data", "sales-data", "analysis-data", "brand-settings", "inventory-settings"].includes(message.type)) return;
      if (normalizeRegion(message.region) !== regionCode()) return;
      lastAnalysis = null;
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

  try {
    const pending = sessionStorage.getItem("mk-pending-tracking");
    if (pending && /shipment-tracking(?:\.html)?\/?$/i.test(location.pathname)) {
      sessionStorage.removeItem("mk-pending-tracking");
      window.setTimeout(() => {
        const field = document.getElementById("tracking-number"), form = document.getElementById("tracking-form");
        if (field && form) { field.value = pending; field.dispatchEvent(new Event("input", { bubbles: true })); form.requestSubmit(); }
      }, 700);
    }
  } catch (_) {}
})();
