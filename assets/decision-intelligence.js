(() => {
  "use strict";

  const REGION = (location.pathname.match(/-(us|eu|ca)(?:\.html)?\/?$/i)?.[1] || "US").toUpperCase();
  const REGION_KEY = REGION === "CA" ? "Canada" : REGION;
  const REGION_NAME = { US: "United States", EU: "European Union", CA: "Canada" }[REGION];
  const HISTORY_DB = "stark-reorder-history-v1";
  const HISTORY_STORE = "reports";
  const FEEDBACK_KEY = `stark-decision-feedback-v1-${REGION}`;
  const SYNC_PULSE_KEY = "stark-analytics-sync-pulse";
  const MODEL_VERSION = "Explainable Brain 1.0";
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });
  const $ = id => document.getElementById(id);
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const esc = value => String(value == null ? "" : value).replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
  const keyOf = row => String(row.model || row.itemid || `${row.brand}|${row.product}`).trim().toUpperCase();
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const median = values => { const sorted = values.slice().sort((a, b) => a - b); return sorted.length ? sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : 0; };
  const variation = values => { const avg = mean(values); return avg ? Math.sqrt(mean(values.map(value => (value - avg) ** 2))) / avg : 0; };
  let SI;
  let dataset;
  let decisions = [];
  let filtered = [];
  let snapshots = [];
  let learning = { observations: 0, accuracy: null, methods: {}, snapshots: 0 };
  let modelSettings = { critical: 3, coverage: 1, delay: 15 };
  let plannerFeedback = loadPlannerFeedback();
  let feedbackSaveTimer = 0;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    removeLegacySummarySections();
    SI = window.StarkInventory;
    dataset = await SI.loadDataset(REGION_KEY);
    initProbabilityWorkspace();
    bind();
    renderRegulations();
    if (!dataset?.rows?.length) {
      renderEmpty();
      exposeExport();
      return;
    }
    snapshots = await loadSnapshots();
    buildModel();
    populateFilters();
    renderAll();
    exposeExport();
  }

  function removeLegacySummarySections() {
    document.querySelector(".brain-kpis")?.remove();
    const grid = document.querySelector(".brain-grid");
    if (!grid) return;
    grid.querySelectorAll(":scope > .brain-card").forEach(card => {
      if (/concepts, controls and regulations/i.test(card.textContent || "")) card.remove();
    });
    grid.classList.add("brain-grid-single");
  }

  function bind() {
    ["brain-search", "brain-risk", "brain-brand"].forEach(id => $(id)?.addEventListener(id === "brain-search" ? "input" : "change", applyFilters));
    $("brain-export")?.addEventListener("click", exportCsv);
    $("decision-close")?.addEventListener("click", () => $("decision-detail")?.classList.remove("open"));
    initAiBrief();
    window.addEventListener("focus", refreshIfChanged);
  }

  async function refreshIfChanged() {
    const latest = await SI.loadDataset(REGION_KEY);
    if (!latest?.rows?.length || latest.importedAt === dataset?.importedAt) return;
    dataset = latest;
    plannerFeedback = loadPlannerFeedback();
    snapshots = await loadSnapshots();
    buildModel();
    populateFilters();
    renderAll();
    exposeExport();
  }

  function openHistoryDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("History storage is unavailable."));
      const request = indexedDB.open(HISTORY_DB, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
      };
    });
  }

  async function loadSnapshots() {
    let records = [];
    try {
      const db = await openHistoryDb();
      records = await new Promise((resolve, reject) => {
        const transaction = db.transaction(HISTORY_STORE, "readonly");
        const request = transaction.objectStore(HISTORY_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      });
    } catch (_) {}
    const historical = records
      .filter(record => record.region === REGION && Array.isArray(record.trainingRows) && record.trainingRows.length)
      .sort((a, b) => String(a.sourceImportedAt || a.createdAt).localeCompare(String(b.sourceImportedAt || b.createdAt)))
      .slice(-29)
      .map(record => ({ importedAt: record.sourceImportedAt || record.createdAt, fileName: record.sourceFile, rows: record.trainingRows }));
    return [...historical, { importedAt: dataset.importedAt, fileName: dataset.fileName, rows: dataset.rows }];
  }

  function signalsByItem() {
    const map = new Map();
    snapshots.forEach((snapshot, snapshotIndex) => {
      snapshot.rows.forEach(row => {
        const key = keyOf(row);
        if (!key) return;
        const series = map.get(key) || [];
        series.push({
          snapshotIndex,
          importedAt: snapshot.importedAt,
          avg3: Math.max(0, finite(row.avg3) || finite(row.vol3) / 3),
          last30: Math.max(0, finite(row.last30)),
          vol3: Math.max(0, finite(row.vol3))
        });
        map.set(key, series);
      });
    });
    return map;
  }

  function candidate(signal, history, method) {
    if (method === "Last 30 days") return signal.last30 || signal.avg3;
    if (method === "Three-month rate") return signal.avg3;
    if (method === "Historical median") return median(history.map(row => row.avg3));
    const recent = history.slice(-3).map(row => row.avg3);
    const weights = [.55, .3, .15].slice(0, recent.length).reverse();
    const divisor = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    return recent.reduce((sum, value, index) => sum + value * weights[index], 0) / divisor;
  }

  function learnMethods(seriesMap) {
    const methods = ["Last 30 days", "Three-month rate", "Adaptive trend", "Historical median"];
    const portfolio = Object.fromEntries(methods.map(method => [method, { error: 0, actual: 0, tests: 0 }]));
    seriesMap.forEach(series => {
      for (let index = 1; index < series.length; index += 1) {
        const prior = series[index - 1], actual = series[index].last30 || series[index].avg3;
        methods.forEach(method => {
          const forecast = candidate(prior, series.slice(0, index), method);
          portfolio[method].error += Math.abs(actual - forecast);
          portfolio[method].actual += actual;
          portfolio[method].tests += 1;
        });
      }
    });
    const ranked = methods.map(method => ({ method, ...portfolio[method], wape: portfolio[method].actual ? portfolio[method].error / portfolio[method].actual : Infinity })).sort((a, b) => a.wape - b.wape || b.tests - a.tests);
    const best = ranked[0];
    return {
      defaultMethod: Number.isFinite(best.wape) ? best.method : "Adaptive trend",
      observations: ranked.reduce((sum, row) => sum + row.tests, 0) / methods.length,
      accuracy: Number.isFinite(best.wape) ? clamp(1 - best.wape, 0, 1) : null,
      methods: Object.fromEntries(ranked.map(row => [row.method, row.tests ? 1 / Math.max(.05, row.wape) : 0]))
    };
  }

  function bestMethodFor(series, portfolioDefault) {
    if (series.length < 4) return portfolioDefault;
    const methods = ["Last 30 days", "Three-month rate", "Adaptive trend", "Historical median"];
    return methods.map(method => {
      let error = 0, actual = 0;
      for (let index = 1; index < series.length; index += 1) {
        const outcome = series[index].last30 || series[index].avg3;
        error += Math.abs(outcome - candidate(series[index - 1], series.slice(0, index), method));
        actual += outcome;
      }
      return { method, wape: actual ? error / actual : Infinity };
    }).sort((a, b) => a.wape - b.wape)[0].method;
  }

  function buildModel() {
    const analyzed = SI.analyze(dataset.rows, REGION_KEY);
    const seriesMap = signalsByItem();
    const learned = learnMethods(seriesMap);
    const settings = SI.loadSettings(REGION_KEY);
    modelSettings = settings;
    const methodCounts = {};
    decisions = analyzed.map(item => {
      const series = seriesMap.get(keyOf(item)) || [{ avg3: item.avg3, last30: item.last30, vol3: item.vol3 }];
      const method = bestMethodFor(series, learned.defaultMethod);
      methodCounts[method] = (methodCounts[method] || 0) + 1;
      const currentSignal = series[series.length - 1];
      const forecast = Math.max(0, candidate(currentSignal, series, method));
      const historicalDemand = series.slice(0, -1).map(row => row.avg3);
      const historicalMean = mean(historicalDemand);
      const trend = historicalMean ? (forecast - historicalMean) / historicalMean : forecast > 0 ? 1 : 0;
      const variability = variation(series.map(row => row.avg3));
      const observations = series.length;
      const seasonalDefault = observations >= 6 && variability >= .35 && Math.abs(trend) >= .15;
      const leadMonths = Math.max(0, finite(item.leadTimeMonths));
      const inbound = Math.max(0, finite(item.planningSupplierQty));
      const netAvailable = Math.max(0, finite(item.stockQty) + inbound - finite(item.openClient));
      const target = forecast * (leadMonths + finite(settings.coverage)) + finite(settings.critical);
      const gap = item.activeBrand && item.eligible && !item.excluded ? Math.max(0, Math.ceil(target - netAvailable)) : 0;
      const dailyDemand = forecast / 30.44;
      const daysToStockout = dailyDemand > 0 ? netAvailable / dailyDemand : null;
      const leadDays = leadMonths * 30.44;
      const monthsCover = forecast > 0 ? netAvailable / forecast : null;
      const delayedInbound = finite(item.openSupplier) > 0 && (!Number.isFinite(item.daysUntil) || item.daysUntil > settings.delay);
      let risk = "HEALTHY", action = "Maintain plan", riskClass = "healthy";
      if (!item.activeBrand || !item.eligible || item.excluded) { risk = "DATA / SCOPE"; action = "Review eligibility and active-brand scope"; riskClass = "data"; }
      else if (forecast <= 0 && item.stockQty > 0) { risk = "NO DEMAND"; action = "Pause replenishment and review disposition"; riskClass = "excess"; }
      else if (forecast > 0 && (netAvailable <= settings.critical || daysToStockout <= leadDays)) { risk = "STOCKOUT RISK"; action = inbound > 0 ? "Expedite inbound supply and protect allocations" : "Place or expedite purchase order now"; riskClass = "urgent"; }
      else if (gap > 0) { risk = "REORDER"; action = "Release replenishment order"; riskClass = "reorder"; }
      else if (monthsCover != null && monthsCover > 4) { risk = "EXCESS"; action = "Hold purchasing and reduce excess exposure"; riskClass = "excess"; }
      else if (monthsCover != null && monthsCover < 2) { risk = "MONITOR"; action = "Monitor weekly and confirm supplier capacity"; riskClass = "monitor"; }
      const demandWhy = demandExplanation({ forecast, historicalMean, trend, currentSignal, variability, observations, item });
      const stockoutWhy = stockoutExplanation({ forecast, netAvailable, daysToStockout, leadDays, inbound, delayedInbound, item, settings });
      const tradeoff = prescriptiveTradeoff({ risk, gap, forecast, monthsCover, item, trend, delayedInbound, settings, inbound, netAvailable, daysToStockout, leadDays });
      const businessReason = tradeoff.reasonShort;
      const confidenceScore = clamp((observations >= 4 ? .38 : observations / 4 * .38) + (learned.accuracy == null ? .18 : learned.accuracy * .38) + (forecast > 0 ? .16 : .08) + (item.leadTime ? .08 : 0), 0, 1);
      const confidence = confidenceScore >= .75 ? "High" : confidenceScore >= .5 ? "Medium" : "Low";
      const priority = Math.round(clamp((riskClass === "urgent" ? 55 : riskClass === "reorder" ? 35 : riskClass === "monitor" ? 18 : 5) + Math.min(25, gap / Math.max(1, forecast) * 15) + (item.abc === "A" ? 12 : item.abc === "B" ? 6 : 2) + (delayedInbound ? 10 : 0), 0, 100));
      return {
        ...item, forecast, historicalMean, trend, variability, observations, seasonalDefault, method, netAvailable, target, gap,
        daysToStockout, leadDays, monthsCover, delayedInbound, risk, riskClass, action, demandWhy, stockoutWhy,
        businessReason, tradeoffAction: tradeoff.tradeoffAction, tradeoffDetail: tradeoff.tradeoffDetail,
        businessDetailHtml: tradeoff.detailHtml, confidence, confidenceScore, priority,
        calculation: `${decimal.format(forecast)} × (${decimal.format(leadMonths)} lead + ${decimal.format(settings.coverage)} coverage) + ${number.format(settings.critical)} minimum − ${number.format(netAvailable)} net available = ${number.format(gap)} units`
      };
    }).sort((a, b) => b.priority - a.priority || b.gap - a.gap || String(a.brand).localeCompare(String(b.brand)));
    learning = { observations: learned.observations, accuracy: learned.accuracy, methods: methodCounts, snapshots: snapshots.length };
    filtered = decisions.slice();
  }

  function demandExplanation(context) {
    const { forecast, historicalMean, trend, currentSignal, variability, observations, item } = context;
    if (forecast <= 0) return `No positive demand signal exists in the ${observations} available observation${observations === 1 ? "" : "s"}. Current 30-day units and the three-month monthly rate are both zero.`;
    const direction = trend > .15 ? `rising ${percent.format(trend)} above its prior observed average` : trend < -.15 ? `falling ${percent.format(Math.abs(trend))} below its prior observed average` : "stable versus its prior observed average";
    const recent = currentSignal.last30 > currentSignal.avg3 * 1.15 ? "The latest 30 days are running above the three-month rate, indicating acceleration." : currentSignal.last30 < currentSignal.avg3 * .85 ? "The latest 30 days are below the three-month rate, indicating moderation." : "The latest 30 days are consistent with the three-month rate.";
    return `Expected demand is ${decimal.format(forecast)} units/month because the model-level signal is ${direction}. ${recent} Variability is ${percent.format(clamp(variability, 0, 9))}; ABC ${item.abc} indicates its relative portfolio contribution.`;
  }

  function stockoutExplanation(context) {
    const { forecast, netAvailable, daysToStockout, leadDays, inbound, delayedInbound, item, settings } = context;
    if (forecast <= 0) return "A consumption-driven stockout is not projected because forecast demand is zero; the risk is excess or obsolete inventory instead.";
    const timing = daysToStockout == null ? "Stockout timing cannot be calculated" : `Net available supply covers about ${decimal.format(daysToStockout)} days`;
    const comparison = `${timing}, compared with ${decimal.format(leadDays)} lead-time days and a ${number.format(settings.critical)}-unit minimum.`;
    const supply = inbound > 0 ? `${number.format(inbound)} eligible inbound units were included.` : `No supplier quantity qualifies inside the ${number.format(settings.delay)}-day planning window.`;
    const delay = delayedInbound ? `Additional open supplier quantity exists but is outside the configured arrival window, so relying on it could create a gap.` : "No late-supply exception is currently detected.";
    return `${comparison} ${supply} ${delay} Open client commitments of ${number.format(item.openClient)} units reduce usable supply.`;
  }

  function prescriptiveTradeoff(context) {
    const { risk, gap, forecast, monthsCover, item, trend, delayedInbound, settings } = context;
    const leadMonths = Math.max(0, finite(item.leadTimeMonths));
    const leadDays = decimal.format(leadMonths * 30.44);
    const stockoutDays = item.daysToStockout != null ? decimal.format(item.daysToStockout) : "unknown";
    const inboundTotal = finite(item.openSupplier);
    const countedInbound = finite(item.planningSupplierQty || item.planningSupplier);
    const uncountedInbound = Math.max(0, inboundTotal - countedInbound);

    if (risk === "STOCKOUT RISK") {
      if (uncountedInbound > 0) {
        const action = "Expedite Inbound Supplier PO";
        const short = `Expedite ${number.format(uncountedInbound)} inbound units vs issuing new PO; protects ${stockoutDays}-day runway against ${leadDays}-day lead time.`;
        const detail = `• Recommended Action: Expedite existing supplier commitments (${number.format(uncountedInbound)} units arriving outside standard ${settings.delay}-day window).\n• Trade-off Analysis: Releasing a new PO takes full ${leadDays} days and duplicates working capital. Negotiating priority carrier expediting or split shipments closes the stockout gap at a fraction of double-order capital lockup.\n• Business Risk: Stockout directly exposes Class-${item.abc} customer orders, revenue, and service SLA.`;
        return {
          tradeoffAction: action,
          reasonShort: short,
          tradeoffDetail: detail,
          detailHtml: `<div class="tradeoff-callout"><span class="tradeoff-badge urgent">${esc(action)}</span><p><strong>Trade-off Rationale:</strong> Expediting existing inbound supplier orders (${number.format(uncountedInbound)} units) is financially superior to placing a duplicate purchase order. It restores coverage inside the ${stockoutDays}-day stockout window while avoiding double capital commitment.</p><p><strong>Business Impact:</strong> Prevents imminent Class-${item.abc} revenue loss and contractual backorder penalties.</p></div>`
        };
      }
      const action = "Emergency Replenishment PO";
      const short = `Release urgent PO for ${number.format(gap)} units; stockout in ~${stockoutDays} days vs ${leadDays} days lead time.`;
      const detail = `• Recommended Action: Issue expedited replenishment PO immediately for ${number.format(gap)} units.\n• Trade-off Analysis: Inaction guarantees a stockout gap of ~${leadDays} days. Priority factory slot or express logistics surcharge is financially justified by preserving Class-${item.abc} gross margin and client retention.\n• Business Risk: Available stock is insufficient to buffer lead-time demand.`;
      return {
        tradeoffAction: action,
        reasonShort: short,
        tradeoffDetail: detail,
        detailHtml: `<div class="tradeoff-callout"><span class="tradeoff-badge urgent">${esc(action)}</span><p><strong>Trade-off Rationale:</strong> Standard cycle reordering is too late; usable supply exhausts in ~${stockoutDays} days vs ${leadDays} days lead time. An immediate emergency replenishment order is required.</p><p><strong>Business Impact:</strong> The margin and customer retention protected far outweigh the operational cost of expedited order placement.</p></div>`
      };
    }

    if (risk === "REORDER") {
      const action = "Release Standard Cycle PO";
      const short = `Order ${number.format(gap)} units now to restore ${decimal.format(settings.coverage)} mo coverage and avoid emergency expedite freight fees.`;
      const detail = `• Recommended Action: Release cycle purchase order for ${number.format(gap)} units.\n• Trade-off Analysis: Placing PO within standard lead time (${leadDays} days) captures contractual pricing without emergency expedite premiums, while ordering exactly the ${number.format(gap)}-unit gap prevents excess holding cost.\n• Business Risk: Maintaining order discipline protects target service level without inventory bloat.`;
      return {
        tradeoffAction: action,
        reasonShort: short,
        tradeoffDetail: detail,
        detailHtml: `<div class="tradeoff-callout"><span class="tradeoff-badge reorder">${esc(action)}</span><p><strong>Trade-off Rationale:</strong> Inventory is ${number.format(gap)} units below protected target (${decimal.format(leadMonths)} mo lead + ${decimal.format(settings.coverage)} mo coverage). Reordering now locks in regular freight rates and standard vendor schedules.</p><p><strong>Business Impact:</strong> Restores equilibrium before stock depletes into the urgent risk zone.</p></div>`
      };
    }

    if (risk === "EXCESS") {
      const action = "Freeze Replenishment & Capital Preservation";
      const short = `Hold purchasing; ${monthsCover == null ? "high" : decimal.format(monthsCover)} months cover exceeds threshold. Halts ~20% annualized carrying cost.`;
      const detail = `• Recommended Action: Freeze all new purchase orders and monitor burn-down rate.\n• Trade-off Analysis: Holding excess inventory incurs ~18–24% annualized carrying costs (storage, insurance, cost of capital). Halting orders prevents compounding cash lockup and redeploys working capital toward Class-A reorders.\n• Business Risk: Aging inventory and markdown exposure.`;
      return {
        tradeoffAction: action,
        reasonShort: short,
        tradeoffDetail: detail,
        detailHtml: `<div class="tradeoff-callout"><span class="tradeoff-badge excess">${esc(action)}</span><p><strong>Trade-off Rationale:</strong> Current stock represents ${monthsCover == null ? "elevated" : decimal.format(monthsCover)} months of cover. Halting replenishment immediately stops working capital bleed and avoids costly warehouse holding fees.</p><p><strong>Business Impact:</strong> Preserves liquidity to fund fast-turning, high-return SKUs.</p></div>`
      };
    }

    if (risk === "NO DEMAND") {
      const action = "Active Disposition & Liquidation";
      const short = `Zero demand for ${number.format(item.stockQty)} units on hand; liquidate, transfer or return to avoid 100% write-off.`;
      const detail = `• Recommended Action: Initiate inventory disposition (channel transfer, promotional bundle, vendor return, or commercial clearance).\n• Trade-off Analysis: Inactive stock generates zero revenue while accumulating storage overhead. Proactive liquidation now recovers salvage value and frees physical space, outperforming passive holding until total write-off.\n• Business Risk: 100% salvage loss and dead storage fees.`;
      return {
        tradeoffAction: action,
        reasonShort: short,
        tradeoffDetail: detail,
        detailHtml: `<div class="tradeoff-callout"><span class="tradeoff-badge excess">${esc(action)}</span><p><strong>Trade-off Rationale:</strong> Zero demand signal observed across recent periods. Retaining dead stock burns warehouse overhead. Proactive liquidation or cross-warehouse transfer yields immediate capital recovery.</p><p><strong>Business Impact:</strong> Eliminates continuous carrying costs and prevents complete write-down.</p></div>`
      };
    }

    if (risk === "MONITOR") {
      const action = "Weekly Review / Avoid Bullwhip";
      const short = `Coverage is ${monthsCover == null ? "adequate" : decimal.format(monthsCover)} mo; withhold reorder to prevent bullwhip effect while tracking supplier timing.`;
      const detail = `• Recommended Action: Maintain weekly observation cadence; confirm supplier production capacity.\n• Trade-off Analysis: Prematurely ordering induces artificial demand amplification (bullwhip effect) and inflates holding cost. Existing buffer can absorb demand shifts until the safety threshold is breached.\n• Business Risk: Monitor lead-time creep or sudden demand acceleration.`;
      return {
        tradeoffAction: action,
        reasonShort: short,
        tradeoffDetail: detail,
        detailHtml: `<div class="tradeoff-callout"><span class="tradeoff-badge monitor">${esc(action)}</span><p><strong>Trade-off Rationale:</strong> Inventory coverage is within safe buffer parameters. Withholding orders avoids premature cash commitment and suppresses the bullwhip effect.</p><p><strong>Business Impact:</strong> Balances service reliability with working capital efficiency.</p></div>`
      };
    }

    if (risk === "DATA / SCOPE") {
      const action = "Master Data & Catalog Audit";
      const short = `Item status is excluded or brand is inactive; verify commercial eligibility before committing supplier funds.`;
      const detail = `• Recommended Action: Audit ERP master catalog, active-brand settings, and sales eligibility.\n• Trade-off Analysis: Reordering without verified eligibility risks procuring discontinued or unsellable stock.\n• Business Risk: Misallocated purchasing budget.`;
      return {
        tradeoffAction: action,
        reasonShort: short,
        tradeoffDetail: detail,
        detailHtml: `<div class="tradeoff-callout"><span class="tradeoff-badge data">${esc(action)}</span><p><strong>Trade-off Rationale:</strong> The SKU is excluded by current active-brand configuration or ERP lifecycle status. Master catalog reconciliation must precede any procurement action.</p><p><strong>Business Impact:</strong> Prevents purchasing stranded or obsolete product lines.</p></div>`
      };
    }

    const action = "Maintain Equilibrium Plan";
    const short = `Inventory and confirmed supply cover demand and safety buffer (${monthsCover == null ? "healthy" : decimal.format(monthsCover)} mo cover).`;
    const detail = `• Recommended Action: Maintain standard schedule and order cadence.\n• Trade-off Analysis: System is in equilibrium. No intervention needed; supply and demand remain aligned.\n• Business Risk: Negligible near-term disruption.`;
    return {
      tradeoffAction: action,
      reasonShort: short,
      tradeoffDetail: detail,
      detailHtml: `<div class="tradeoff-callout"><span class="tradeoff-badge healthy">${esc(action)}</span><p><strong>Trade-off Rationale:</strong> Stock and confirmed pipeline match demand velocity and safety parameters.</p><p><strong>Business Impact:</strong> Predictable cash flow and stable customer fill rate.</p></div>`
    };
  }

  function businessExplanation(context) {
    return prescriptiveTradeoff(context).reasonShort;
  }

  function populateFilters() {
    const brands = SI.unique(decisions.map(row => row.brand));
    $("brain-brand").innerHTML = `<option value="">All brands</option>${brands.map(brand => `<option>${esc(brand)}</option>`).join("")}`;
  }

  function applyFilters() {
    const search = $("brain-search").value.trim().toLowerCase();
    const risk = $("brain-risk").value;
    const brand = $("brain-brand").value;
    filtered = decisions.filter(row => (!search || `${row.model} ${row.product} ${row.brand} ${row.action} ${row.businessReason}`.toLowerCase().includes(search)) && (!risk || row.risk === risk) && (!brand || row.brand === brand));
    renderAll();
    exposeExport();
  }

  function renderAll() {
    renderStatus();
    renderKpis();
    renderLearning();
    renderProbabilityTable();
    renderTable();
  }

  function renderStatus() {
    $("brain-live-title").textContent = "Decision brain active";
    $("brain-live-detail").textContent = `${dataset.fileName} • ${snapshots.length} uploaded observation${snapshots.length === 1 ? "" : "s"} • ${number.format(decisions.length)} SKU decisions`;
  }

  function renderKpis() {
    if (!$("brain-kpi-1")) return;
    const risk = decisions.filter(row => row.risk === "STOCKOUT RISK").length;
    const reorder = decisions.filter(row => ["STOCKOUT RISK", "REORDER"].includes(row.risk)).reduce((sum, row) => sum + row.gap, 0);
    const excess = decisions.filter(row => row.risk === "EXCESS").length;
    const high = decisions.filter(row => row.confidence === "High").length;
    const values = [decisions.length, risk, reorder, excess, learning.snapshots, high];
    values.forEach((value, index) => $(`brain-kpi-${index + 1}`).textContent = number.format(value));
    $("brain-kpi-accuracy").textContent = learning.accuracy == null ? "Learning" : `${percent.format(learning.accuracy)} backtest accuracy`;
  }

  function renderLearning() {
    $("learning-metrics").innerHTML = `
      <div><small>Historical uploads</small><strong>${number.format(learning.snapshots)} / 30</strong></div>
      <div><small>Backtest observations</small><strong>${number.format(learning.observations)}</strong></div>
      <div><small>Portfolio accuracy</small><strong>${learning.accuracy == null ? "Learning" : percent.format(learning.accuracy)}</strong></div>
      <div><small>Model version</small><strong>${MODEL_VERSION}</strong></div>`;
    const total = Object.values(learning.methods).reduce((sum, value) => sum + value, 0) || 1;
    $("method-bars").innerHTML = Object.entries(learning.methods).sort((a, b) => b[1] - a[1]).map(([method, count]) => `<div class="method-bar"><span>${esc(method)}</span><div><i style="width:${count / total * 100}%"></i></div><b>${number.format(count)}</b></div>`).join("");
  }

  function initProbabilityWorkspace() {
    if ($("if-probability-workspace")) return;
    const anchor = document.querySelector(".decision-workspace");
    if (!anchor) return;
    const section = document.createElement("section");
    section.className = "decision-workspace probability-workspace";
    section.id = "if-probability-workspace";
    section.innerHTML = `
      <div class="decision-heading probability-heading">
        <div><p class="probability-eyebrow">Conditional order simulation</p><h2>IF Probability Model</h2><p>Adjust the proposed order quantity to see the projected Risk, Excess, or Confident outcome. Seasonal choices and planner reasons are retained for MK's future explanations.</p></div>
        <span class="decision-count" id="if-probability-count">0 scenarios</span>
      </div>
      <div class="probability-guidance"><strong>Planner learning:</strong> Your reason is saved as human decision context. It informs future MK responses but never silently overrides the official reorder formula.</div>
      <div class="decision-table-wrap probability-table-wrap">
        <table class="decision-table probability-table">
          <thead><tr><th>Brand</th><th>Model #</th><th class="num">Current Stock</th><th class="num">Avg/Month</th><th>Seasonal</th><th class="num">Reorder Qty</th><th>IF Ordered Qty</th><th>Reason: why I want to order this quantity</th><th>Status</th></tr></thead>
          <tbody id="if-probability-rows"></tbody>
        </table>
      </div>`;
    anchor.parentNode.insertBefore(section, anchor);
    const body = $("if-probability-rows");
    body.addEventListener("input", handleProbabilityInput);
    body.addEventListener("change", handleProbabilityInput);
  }

  function loadPlannerFeedback() {
    try {
      const value = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (_) {
      return {};
    }
  }

  function feedbackFor(row) {
    const saved = plannerFeedback[keyOf(row)] || {};
    return {
      seasonal: saved.seasonal === "yes" || saved.seasonal === "no" ? saved.seasonal : row.seasonalDefault ? "yes" : "no",
      orderedQty: Number.isFinite(Number(saved.orderedQty)) ? Math.max(0, Math.round(Number(saved.orderedQty))) : Math.max(0, Math.round(row.gap)),
      reason: String(saved.reason || "").slice(0, 500)
    };
  }

  function calculateIfScenario(row, feedback) {
    const orderedQty = Math.max(0, Math.round(finite(feedback.orderedQty)));
    const seasonal = feedback.seasonal === "yes";
    const forecast = Math.max(0, finite(row.forecast));
    const projectedSupply = Math.max(0, finite(row.netAvailable) + orderedQty);
    const protectedTarget = Math.max(0, finite(row.target));
    const tolerance = Math.max(3, forecast * (seasonal ? 1.5 : 1));
    const excessTarget = protectedTarget + tolerance;
    const evidence = clamp(finite(row.confidenceScore), 0, 1);
    let status = "CONFIDENT";
    let riskProbability = 0;
    let excessProbability = 0;
    let confidentProbability = 0;

    if (forecast <= 0 && projectedSupply > 0) {
      status = "EXCESS";
      excessProbability = clamp(78 + Math.min(18, projectedSupply / Math.max(1, tolerance) * 8), 78, 96);
      riskProbability = 2;
      confidentProbability = 100 - excessProbability - riskProbability;
    } else if (projectedSupply + 1e-9 < protectedTarget) {
      status = "RISK";
      const shortageRatio = clamp((protectedTarget - projectedSupply) / Math.max(1, protectedTarget), 0, 1);
      const orderFill = row.gap > 0 ? clamp(orderedQty / row.gap, 0, 1) : 1;
      riskProbability = clamp(62 + shortageRatio * 20 + (1 - orderFill) * 12 + (row.delayedInbound ? 4 : 0), 62, 96);
      excessProbability = 2;
      confidentProbability = 100 - riskProbability - excessProbability;
    } else if (projectedSupply - 1e-9 > excessTarget) {
      status = "EXCESS";
      const overageRatio = clamp((projectedSupply - excessTarget) / Math.max(1, tolerance), 0, 1);
      excessProbability = clamp(62 + overageRatio * 28 + (seasonal ? -4 : 2), 58, 94);
      riskProbability = 2;
      confidentProbability = 100 - excessProbability - riskProbability;
    } else {
      status = "CONFIDENT";
      confidentProbability = clamp(68 + evidence * 24 - (seasonal ? Math.min(8, row.variability * 8) : 0), 62, 94);
      const remaining = 100 - confidentProbability;
      const position = tolerance ? clamp((projectedSupply - protectedTarget) / tolerance, 0, 1) : .5;
      riskProbability = remaining * (1 - position);
      excessProbability = remaining - riskProbability;
    }

    const risk = Math.round(riskProbability);
    const excess = Math.round(excessProbability);
    const confident = Math.max(0, 100 - risk - excess);
    return { status, risk, excess, confident, projectedSupply, protectedTarget, excessTarget };
  }

  function probabilityStatusHtml(scenario) {
    const label = scenario.status === "RISK" ? "Risk" : scenario.status === "EXCESS" ? "Excess" : "Confident";
    const statusClass = scenario.status.toLowerCase();
    return `<span class="scenario-badge ${statusClass}">${label}</span><div class="scenario-probabilities"><span>Risk ${scenario.risk}%</span><span>Confident ${scenario.confident}%</span><span>Excess ${scenario.excess}%</span></div><small>After order: ${number.format(scenario.projectedSupply)} projected units</small>`;
  }

  function renderProbabilityTable() {
    const body = $("if-probability-rows");
    if (!body) return;
    $("if-probability-count").textContent = `${number.format(filtered.length)} of ${number.format(decisions.length)} scenarios`;
    body.innerHTML = filtered.length ? filtered.map(row => {
      const feedback = feedbackFor(row);
      const scenario = calculateIfScenario(row, feedback);
      return `<tr data-feedback-key="${esc(keyOf(row))}">
        <td>${esc(row.brand)}</td><td><strong>${esc(row.model || row.itemid)}</strong></td>
        <td class="num">${number.format(finite(row.stockQty))}</td><td class="num">${decimal.format(finite(row.avg3))}</td>
        <td><select class="scenario-seasonal" data-feedback-field="seasonal" aria-label="Seasonal status for ${esc(row.model || row.itemid)}"><option value="no"${feedback.seasonal === "no" ? " selected" : ""}>No</option><option value="yes"${feedback.seasonal === "yes" ? " selected" : ""}>Yes</option></select></td>
        <td class="num"><strong>${number.format(row.gap)}</strong></td>
        <td><input class="scenario-quantity" data-feedback-field="orderedQty" type="number" min="0" step="1" value="${feedback.orderedQty}" aria-label="IF ordered quantity for ${esc(row.model || row.itemid)}"></td>
        <td><textarea class="scenario-reason" data-feedback-field="reason" maxlength="500" rows="2" placeholder="Add the business reason, customer commitment, season, promotion, MOQ, or supplier context…" aria-label="Planner reason for ${esc(row.model || row.itemid)}">${esc(feedback.reason)}</textarea></td>
        <td class="scenario-status">${probabilityStatusHtml(scenario)}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="9"><div class="empty-brain"><strong>No scenarios match the filters</strong><span>Change the brand, risk, or search filter.</span></div></td></tr>`;
  }

  function handleProbabilityInput(event) {
    const control = event.target.closest("[data-feedback-field]");
    const tr = control?.closest("tr[data-feedback-key]");
    if (!control || !tr) return;
    const row = decisions.find(item => keyOf(item) === tr.dataset.feedbackKey);
    if (!row) return;
    const feedback = feedbackFor(row);
    if (control.dataset.feedbackField === "seasonal") feedback.seasonal = control.value === "yes" ? "yes" : "no";
    if (control.dataset.feedbackField === "orderedQty") feedback.orderedQty = clamp(Math.round(finite(control.value)), 0, 1_000_000_000);
    if (control.dataset.feedbackField === "reason") feedback.reason = control.value.slice(0, 500);
    const scenario = calculateIfScenario(row, feedback);
    plannerFeedback[keyOf(row)] = {
      model: String(row.model || row.itemid || ""), brand: String(row.brand || ""), seasonal: feedback.seasonal,
      orderedQty: feedback.orderedQty, recommendedQty: Math.max(0, Math.round(row.gap)), reason: feedback.reason,
      status: scenario.status, probabilities: { risk: scenario.risk, confident: scenario.confident, excess: scenario.excess },
      currentStock: finite(row.stockQty), averageMonthly: finite(row.avg3), updatedAt: new Date().toISOString()
    };
    tr.querySelector(".scenario-status").innerHTML = probabilityStatusHtml(scenario);
    scheduleFeedbackSave();
  }

  function scheduleFeedbackSave() {
    window.clearTimeout(feedbackSaveTimer);
    feedbackSaveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(FEEDBACK_KEY, JSON.stringify(plannerFeedback));
        localStorage.setItem(SYNC_PULSE_KEY, JSON.stringify({ type: "decision-feedback", region: REGION, at: new Date().toISOString() }));
      } catch (_) {}
      window.StarkDecisionFeedback = { region: REGION, records: plannerFeedback };
      window.dispatchEvent(new CustomEvent("stark-decision-feedback-change", { detail: { region: REGION } }));
      exposeExport();
    }, 350);
  }

  function renderTable() {
    $("decision-count").textContent = `${number.format(filtered.length)} of ${number.format(decisions.length)} decisions`;
    $("decision-rows").innerHTML = filtered.length ? filtered.map(row => `<tr>
      <td><button type="button" data-decision-key="${esc(keyOf(row))}">${esc(row.model || row.itemid)}</button></td>
      <td>${esc(row.brand)}</td><td><span class="risk-badge ${row.riskClass}">${esc(row.risk)}</span></td>
      <td class="num">${decimal.format(row.forecast)}</td><td class="num">${number.format(row.netAvailable)}</td>
      <td class="num">${row.daysToStockout == null ? "—" : decimal.format(row.daysToStockout)}</td><td class="num">${number.format(row.gap)}</td>
      <td>${esc(row.action)}</td>
      <td class="reason"><span class="tradeoff-pill ${row.riskClass}">${esc(row.tradeoffAction || row.action)}</span><div class="reason-text">${esc(row.businessReason)}</div></td>
      <td><span class="confidence-badge">${row.confidence}</span></td>
      <td class="num">${number.format(row.priority)}</td><td><button type="button" data-decision-key="${esc(keyOf(row))}">Why?</button></td>
    </tr>`).join("") : `<tr><td colspan="12"><div class="empty-brain"><strong>No decisions match the filters</strong><span>Change the brand, risk, or search filter.</span></div></td></tr>`;
    $("decision-rows").querySelectorAll("[data-decision-key]").forEach(button => button.addEventListener("click", () => showDetail(button.dataset.decisionKey)));
  }

  function showDetail(key) {
    const row = decisions.find(item => keyOf(item) === key);
    if (!row) return;
    $("decision-detail-title").textContent = `${row.model || row.itemid} • ${row.brand}`;
    $("decision-detail-subtitle").textContent = `${row.risk} • ${row.action} • Priority ${row.priority}/100`;
    $("detail-business").innerHTML = row.businessDetailHtml || `<p>${esc(row.businessReason)}</p>`;
    $("detail-stockout").textContent = row.stockoutWhy;
    $("detail-demand").textContent = row.demandWhy;
    $("detail-calculation").textContent = row.calculation;
    $("detail-learning").textContent = `${row.method} was selected from ${row.observations} available SKU observation${row.observations === 1 ? "" : "s"}. Confidence is ${row.confidence} (${percent.format(row.confidenceScore)} evidence score). Portfolio backtest accuracy is ${learning.accuracy == null ? "not yet available" : percent.format(learning.accuracy)}.`;
    $("detail-governance").textContent = regulationDecision(row);
    $("decision-detail").classList.add("open");
    $("decision-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function regulationDecision(row) {
    const inbound = row.openSupplier > 0 ? "Inbound supply is present, so confirm classification, country of origin, customs value, restricted-party screening, product-specific safety/labeling, and required import records before release." : "No inbound quantity is currently driving the decision; compliance checks become mandatory before a new international purchase or shipment is released.";
    return `${REGION_NAME}: ${inbound} This engine flags the control point but does not replace legal, customs-broker, tax, quality, or product-safety review.`;
  }

  function regulations() {
    const common = [
      ["Demand and inventory controls", "Use validated demand history, lead time, service level, safety stock, reorder point, ABC/XYZ segmentation, open commitments, inbound timing, shelf life, and obsolescence exposure."],
      ["Supplier and purchasing controls", "Confirm approved supplier status, price and MOQ, capacity, incoterms, payment terms, delivery commitment, quality requirements, and change/cancellation exposure before releasing a PO."],
      ["Trade and logistics controls", "Confirm tariff classification, origin, customs value, sanctions/restricted-party screening, dangerous-goods status, packaging, insurance, transport mode, and record retention."],
      ["Decision governance", "Review low-confidence recommendations, material master exceptions, unusual demand spikes, late supply, and high-value commitments with an authorized planner before execution."]
    ];
    const regional = {
      US: ["United States checkpoints", "Validate HTS classification, CBP entry data and valuation, country-of-origin marking, applicable FDA/CPSC/FTC or other product rules, sanctions screening, state requirements, and broker documentation."],
      EU: ["European Union checkpoints", "Validate CN/TARIC classification, EORI and customs value, VAT/import treatment, origin, CE/GPSR/REACH or other product obligations, sanctions, labeling, and importer/economic-operator records."],
      CA: ["Canada checkpoints", "Validate HS classification, CBSA valuation and origin, GST/HST treatment, importer records, sanctions, bilingual labeling where applicable, CCPSA or other product obligations, and broker documentation."]
    };
    return [regional[REGION], ...common];
  }

  function renderRegulations() {
    const list = $("regulation-list");
    if (!list) return;
    list.innerHTML = regulations().map(([title, description], index) => `<details ${index === 0 ? "open" : ""}><summary>${esc(title)}</summary><p>${esc(description)}</p></details>`).join("");
  }

  function renderEmpty() {
    $("brain-live-title").textContent = "Waiting for inventory history";
    $("brain-live-detail").textContent = "Upload a regional Raw Report to activate the decision brain";
    for (let index = 1; index <= 6; index += 1) {
      const metric = $(`brain-kpi-${index}`);
      if (metric) metric.textContent = "0";
    }
    if ($("brain-kpi-accuracy")) $("brain-kpi-accuracy").textContent = "No model data";
    $("learning-metrics").innerHTML = `<div><small>Historical uploads</small><strong>0 / 30</strong></div><div><small>Backtest observations</small><strong>0</strong></div><div><small>Portfolio accuracy</small><strong>Learning</strong></div><div><small>Model version</small><strong>${MODEL_VERSION}</strong></div>`;
    $("method-bars").innerHTML = "";
    if ($("if-probability-count")) $("if-probability-count").textContent = "0 scenarios";
    if ($("if-probability-rows")) $("if-probability-rows").innerHTML = `<tr><td colspan="9"><div class="empty-brain"><strong>No inventory report available</strong><span>Upload the Raw Report first to activate IF probability scenarios.</span></div></td></tr>`;
    $("decision-count").textContent = "0 decisions";
    $("decision-rows").innerHTML = `<tr><td colspan="12"><div class="empty-brain"><strong>No inventory report available</strong><span>Upload the Raw Report first. Each future upload becomes another learning observation.</span></div></td></tr>`;
  }

  function reportData() {
    return {
      headers: ["Model", "Brand", "Item", "Current Stock", "Average/Month", "Seasonal", "Recommended Reorder Qty", "IF Ordered Qty", "Planner Reason", "IF Status", "Risk Probability", "Confident Probability", "Excess Probability", "Risk", "Priority", "Recommended next action", "Prescriptive Trade-Off Action", "Business reason", "Prescriptive Trade-Off Detail", "Why stockout", "Why demand", "Forecast/month", "Net available", "Days to stockout", "Forecast method", "Confidence", "Calculation", "Regulatory control point"],
      rows: filtered.map(row => {
        const feedback = feedbackFor(row), scenario = calculateIfScenario(row, feedback);
        return [row.model, row.brand, row.product, finite(row.stockQty), finite(row.avg3), feedback.seasonal === "yes" ? "Yes" : "No", row.gap, feedback.orderedQty, feedback.reason, scenario.status, scenario.risk, scenario.confident, scenario.excess, row.risk, row.priority, row.action, row.tradeoffAction || row.action, row.businessReason, row.tradeoffDetail || "", row.stockoutWhy, row.demandWhy, row.forecast, row.netAvailable, row.daysToStockout == null ? "" : row.daysToStockout, row.method, row.confidence, row.calculation, regulationDecision(row)];
      })
    };
  }

  function exportCsv() {
    const report = reportData();
    SI.downloadCsv([report.headers, ...report.rows], `Decision Intelligence ${REGION} ${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exposeExport() {
    window.StarkDecisionReportData = reportData;
    window.dispatchEvent(new Event("stark-report-state-change"));
  }

  function initAiBrief() {
    const exportBtn = $("brain-export");
    if (exportBtn && !$("brain-ai-brief")) {
      const briefBtn = document.createElement("button");
      briefBtn.id = "brain-ai-brief";
      briefBtn.type = "button";
      briefBtn.className = "brain-ai-brief-btn";
      briefBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:6px;vertical-align:-2px"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>AI Strategic Brief';
      exportBtn.parentNode.insertBefore(briefBtn, exportBtn.nextSibling);
      briefBtn.addEventListener("click", toggleAiBrief);

      const panel = document.createElement("section");
      panel.id = "ai-brief-panel";
      panel.className = "ai-brief-panel";
      panel.setAttribute("aria-live", "polite");
      const toolbar = exportBtn.closest(".brain-toolbar");
      if (toolbar) toolbar.after(panel);
    }
  }

  function toggleAiBrief() {
    const panel = $("ai-brief-panel");
    if (!panel) return;
    if (panel.classList.contains("open")) {
      panel.classList.remove("open");
      return;
    }
    renderAiBrief();
    panel.classList.add("open");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function renderAiBrief(forceGemini = false) {
    const panel = $("ai-brief-panel");
    if (!panel) return;
    if (!decisions.length) {
      panel.innerHTML = `<div class="ai-brief-card"><div class="ai-brief-head"><h3>AI Executive Brief</h3><button type="button" class="ai-brief-close" id="ai-brief-close-btn" aria-label="Close brief">×</button></div><p style="padding:15px;color:#6b8097">No inventory dataset is loaded yet. Upload a Raw Report to generate strategic analysis.</p></div>`;
      $("ai-brief-close-btn")?.addEventListener("click", () => panel.classList.remove("open"));
      return;
    }

    const expediteItems = decisions.filter(row => row.tradeoffAction === "Expedite Inbound Supplier PO");
    const reorderItems = decisions.filter(row => row.risk === "REORDER" || row.tradeoffAction === "Emergency Replenishment PO");
    const excessItems = decisions.filter(row => row.risk === "EXCESS");
    const noDemandItems = decisions.filter(row => row.risk === "NO DEMAND");
    const totalReorderUnits = decisions.reduce((sum, row) => sum + row.gap, 0);
    const totalStockoutRisks = decisions.filter(row => row.risk === "STOCKOUT RISK").length;
    const apiKey = localStorage.getItem("mk-gemini-api-key") || "";

    let geminiContent = "";
    if (forceGemini && apiKey) {
      panel.innerHTML = `<div class="ai-brief-card"><div class="ai-brief-head"><h3>Consulting Gemini AI Strategic Intelligence…</h3><button type="button" class="ai-brief-close" id="ai-brief-close-btn" aria-label="Close brief">×</button></div><p style="padding:18px 20px;color:#0b5c78">Synthesizing SKU signals, stockout timings, supplier delay windows, and financial trade-offs into an executive memorandum…</p></div>`;
      $("ai-brief-close-btn")?.addEventListener("click", () => panel.classList.remove("open"));
      geminiContent = await callGeminiStrategicAnalysis(apiKey, { expediteItems, reorderItems, excessItems, noDemandItems, totalReorderUnits, totalStockoutRisks });
    }

    panel.innerHTML = `
      <div class="ai-brief-card">
        <div class="ai-brief-head">
          <div>
            <span class="ai-brief-tag">AI Decision Intelligence • ${esc(REGION_NAME)}</span>
            <h3>Prescriptive Strategic Supply Chain Brief</h3>
          </div>
          <button type="button" class="ai-brief-close" id="ai-brief-close-btn" aria-label="Close brief">×</button>
        </div>

        <div class="ai-brief-kpis">
          <div class="brief-kpi"><small>Expedite Inbound POs</small><strong>${number.format(expediteItems.length)}</strong><span>Priority logistics focus</span></div>
          <div class="brief-kpi"><small>Replenishment Orders</small><strong>${number.format(totalReorderUnits)} units</strong><span>Across ${number.format(reorderItems.length)} SKUs</span></div>
          <div class="brief-kpi"><small>Freeze Purchasing</small><strong>${number.format(excessItems.length)} SKUs</strong><span>Preserves working capital</span></div>
          <div class="brief-kpi"><small>Active Disposition</small><strong>${number.format(noDemandItems.length)} SKUs</strong><span>Avoids 100% write-off</span></div>
        </div>

        ${geminiContent ? `<div class="gemini-brief-box"><div class="gemini-brief-head"><span class="gemini-sparkle">✦</span><strong>Gemini Generative Strategic Assessment</strong></div><div class="gemini-text">${geminiContent}</div></div>` : ""}

        <div class="ai-brief-grid">
          <div class="brief-col">
            <h4>Prescriptive Decision Trade-Offs</h4>
            <div class="tradeoff-summary-item">
              <span class="tradeoff-badge urgent">Expedite Inbound (${number.format(expediteItems.length)} SKUs)</span>
              <p>Existing open supplier commitments are arriving outside the critical stockout window. <strong>Trade-off:</strong> Prioritizing split-shipments or carrier expediting closes stockout gaps within days while avoiding doubling capital lockup with new POs.</p>
            </div>
            <div class="tradeoff-summary-item">
              <span class="tradeoff-badge reorder">Standard Replenishment (${number.format(reorderItems.length)} SKUs)</span>
              <p>Reorder quantities restore exact buffer targets. <strong>Trade-off:</strong> Committing orders on standard vendor cycle avoids emergency freight penalties and smooths receiving capacity without exceeding demand velocity.</p>
            </div>
            <div class="tradeoff-summary-item">
              <span class="tradeoff-badge excess">Freeze / Preserve Capital (${number.format(excessItems.length)} SKUs)</span>
              <p>Current stock represents >4 months of cover. <strong>Trade-off:</strong> Halting purchase orders immediately eliminates compounding holding costs (~18-24% annualized) and frees liquidity to fund high-velocity Class-A reorders.</p>
            </div>
            <div class="tradeoff-summary-item">
              <span class="tradeoff-badge excess">Liquidate Dead Stock (${number.format(noDemandItems.length)} SKUs)</span>
              <p>Zero recent demand observed with inventory on hand. <strong>Trade-off:</strong> Initiating channel transfer, promotion, or vendor return yields immediate cash recovery, outperforming passive warehouse holding until total write-off.</p>
            </div>
          </div>

          <div class="brief-col">
            <h4>Executive Action Checklist</h4>
            <ol class="brief-action-list">
              <li><strong>Immediate (24–48h):</strong> Contact logistics and suppliers to expedite inbound shipments for top stockout risks (e.g. ${esc(decisions.find(r => r.risk === "STOCKOUT RISK")?.model || "top critical SKUs")}).</li>
              <li><strong>Procurement Release:</strong> Approve ${number.format(totalReorderUnits)} units for eligible active-brand items before lead-time thresholds decay.</li>
              <li><strong>Working Capital Freeze:</strong> Lock purchasing on ${number.format(excessItems.length)} excess models to preserve cash flow.</li>
              <li><strong>Dead Stock Recovery:</strong> Review ${number.format(noDemandItems.length)} zero-demand models for liquidation or regional transfer.</li>
            </ol>
            <div class="gemini-toggle-bar">
              ${apiKey
                ? `<button type="button" id="btn-call-gemini" class="button-gemini">✨ Generate Gemini AI Strategic Review</button>`
                : `<div class="gemini-key-prompt"><small>Connect Google Gemini API for generative strategic memos:</small><div class="gemini-input-row"><input type="password" id="gemini-key-input" placeholder="Paste Gemini API Key (AIza...)" autocomplete="off"><button type="button" id="btn-save-gemini-key">Connect</button></div></div>`}
            </div>
          </div>
        </div>
      </div>
    `;

    $("ai-brief-close-btn")?.addEventListener("click", () => panel.classList.remove("open"));
    $("btn-call-gemini")?.addEventListener("click", () => renderAiBrief(true));
    $("btn-save-gemini-key")?.addEventListener("click", () => {
      const val = $("gemini-key-input")?.value?.trim();
      if (val) {
        localStorage.setItem("mk-gemini-api-key", val);
        renderAiBrief(true);
      }
    });
  }

  async function callGeminiStrategicAnalysis(apiKey, data) {
    try {
      const topRisks = decisions.filter(r => r.risk === "STOCKOUT RISK").slice(0, 5).map(r => `- ${r.model} (${r.brand}): Stockout in ${decimal.format(r.daysToStockout)}d, Lead ${decimal.format(r.leadDays)}d, Recommended: ${r.gap} units, Action: ${r.tradeoffAction}`).join("\n");
      const topExcess = decisions.filter(r => r.risk === "EXCESS").slice(0, 4).map(r => `- ${r.model} (${r.brand}): ${decimal.format(r.monthsCover)} mo cover, Stock: ${r.stockQty}`).join("\n");
      const prompt = `As a Senior VP of Global Supply Chain and Inventory Strategy, deliver a concise, high-impact executive strategic brief for ${REGION_NAME}.
Key metrics:
- Total eligible SKUs analyzed: ${decisions.length}
- Imminent stockout risks: ${data.totalStockoutRisks}
- Total reorder requirement: ${data.totalReorderUnits} units
- Inbound expedite candidates: ${data.expediteItems.length}
- Working capital freeze items (excess): ${data.excessItems.length}
- Dead stock liquidation targets: ${data.noDemandItems.length}

Top Stockout Criticals:
${topRisks || "None"}

Top Excess Exposure:
${topExcess || "None"}

Provide a structured, executive memorandum covering:
1. Commercial Risk & Revenue Protection (prioritizing expedite vs reorder)
2. Working Capital Optimization (freezing excess vs liquidation trade-offs)
3. Operational Next-Best-Action Priorities for the commercial team. Keep it authoritative, clear, and actionable.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: "You are an elite enterprise supply chain AI advisor. Format output using clean HTML paragraphs and bullet points." }] }
        })
      });
      const res = await response.json();
      const text = res?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
      }
      return "Unable to parse Gemini response. Please verify API key.";
    } catch (e) {
      return `Gemini API notice: ${e.message || "Request could not be completed"}. Deterministic AI analysis remains fully active.`;
    }
  }
})();

