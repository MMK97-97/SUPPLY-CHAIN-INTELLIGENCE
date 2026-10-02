(() => {
  "use strict";

  const REGION = (location.pathname.match(/-(us|eu|ca)\.html$/i)?.[1] || "US").toUpperCase();
  const REGION_KEY = REGION === "CA" ? "Canada" : REGION;
  const REGION_NAME = { US: "United States", EU: "European Union", CA: "Canada" }[REGION];
  const HISTORY_DB = "stark-reorder-history-v1";
  const HISTORY_STORE = "reports";
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

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    SI = window.StarkInventory;
    dataset = await SI.loadDataset(REGION_KEY);
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

  function bind() {
    ["brain-search", "brain-risk", "brain-brand"].forEach(id => $(id)?.addEventListener(id === "brain-search" ? "input" : "change", applyFilters));
    $("brain-export")?.addEventListener("click", exportCsv);
    $("decision-close")?.addEventListener("click", () => $("decision-detail")?.classList.remove("open"));
    window.addEventListener("focus", refreshIfChanged);
  }

  async function refreshIfChanged() {
    const latest = await SI.loadDataset(REGION_KEY);
    if (!latest?.rows?.length || latest.importedAt === dataset?.importedAt) return;
    dataset = latest;
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
      const businessReason = businessExplanation({ risk, gap, forecast, monthsCover, item, trend, delayedInbound });
      const confidenceScore = clamp((observations >= 4 ? .38 : observations / 4 * .38) + (learned.accuracy == null ? .18 : learned.accuracy * .38) + (forecast > 0 ? .16 : .08) + (item.leadTime ? .08 : 0), 0, 1);
      const confidence = confidenceScore >= .75 ? "High" : confidenceScore >= .5 ? "Medium" : "Low";
      const priority = Math.round(clamp((riskClass === "urgent" ? 55 : riskClass === "reorder" ? 35 : riskClass === "monitor" ? 18 : 5) + Math.min(25, gap / Math.max(1, forecast) * 15) + (item.abc === "A" ? 12 : item.abc === "B" ? 6 : 2) + (delayedInbound ? 10 : 0), 0, 100));
      return {
        ...item, forecast, historicalMean, trend, variability, observations, method, netAvailable, target, gap,
        daysToStockout, leadDays, monthsCover, delayedInbound, risk, riskClass, action, demandWhy, stockoutWhy,
        businessReason, confidence, confidenceScore, priority,
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

  function businessExplanation(context) {
    const { risk, gap, forecast, monthsCover, item, trend, delayedInbound } = context;
    if (risk === "STOCKOUT RISK") return `Service level and revenue are exposed because supply may run out before replenishment can arrive. Acting now protects customer commitments and ABC ${item.abc} contribution.`;
    if (risk === "REORDER") return `The inventory position is ${number.format(gap)} units below lead-time demand plus the configured coverage buffer. Replenishment restores target service without ordering beyond the calculated gap.`;
    if (risk === "EXCESS") return `Inventory represents ${monthsCover == null ? "unknown" : decimal.format(monthsCover)} months of cover while demand is ${forecast ? (trend < 0 ? "softening" : "below the excess threshold") : "absent"}. Holding purchases reduces carrying cost, aging, and markdown risk.`;
    if (risk === "MONITOR") return `Coverage is below two months but remains above the immediate reorder trigger. Weekly review is appropriate because ${delayedInbound ? "supplier timing is uncertain" : "the current buffer can absorb near-term demand"}.`;
    if (risk === "NO DEMAND") return "Stock exists without a supported demand signal. The next decision should focus on disposition, transfer, promotion, or validation rather than replenishment.";
    if (risk === "DATA / SCOPE") return "The item is outside the active reorder scope or lacks an eligible status. Confirm master data before committing inventory or supplier capacity.";
    return "Available and inbound supply cover forecast demand, lead time, and the configured safety buffer. Maintain the plan and continue monitoring changes.";
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
    renderTable();
  }

  function renderStatus() {
    $("brain-live-title").textContent = "Decision brain active";
    $("brain-live-detail").textContent = `${dataset.fileName} • ${snapshots.length} uploaded observation${snapshots.length === 1 ? "" : "s"} • ${number.format(decisions.length)} SKU decisions`;
  }

  function renderKpis() {
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

  function renderTable() {
    $("decision-count").textContent = `${number.format(filtered.length)} of ${number.format(decisions.length)} decisions`;
    $("decision-rows").innerHTML = filtered.length ? filtered.map(row => `<tr>
      <td><button type="button" data-decision-key="${esc(keyOf(row))}">${esc(row.model || row.itemid)}</button></td>
      <td>${esc(row.brand)}</td><td><span class="risk-badge ${row.riskClass}">${esc(row.risk)}</span></td>
      <td class="num">${decimal.format(row.forecast)}</td><td class="num">${number.format(row.netAvailable)}</td>
      <td class="num">${row.daysToStockout == null ? "—" : decimal.format(row.daysToStockout)}</td><td class="num">${number.format(row.gap)}</td>
      <td>${esc(row.action)}</td><td class="reason">${esc(row.businessReason)}</td><td><span class="confidence-badge">${row.confidence}</span></td>
      <td class="num">${number.format(row.priority)}</td><td><button type="button" data-decision-key="${esc(keyOf(row))}">Why?</button></td>
    </tr>`).join("") : `<tr><td colspan="12"><div class="empty-brain"><strong>No decisions match the filters</strong><span>Change the brand, risk, or search filter.</span></div></td></tr>`;
    $("decision-rows").querySelectorAll("[data-decision-key]").forEach(button => button.addEventListener("click", () => showDetail(button.dataset.decisionKey)));
  }

  function showDetail(key) {
    const row = decisions.find(item => keyOf(item) === key);
    if (!row) return;
    $("decision-detail-title").textContent = `${row.model || row.itemid} • ${row.brand}`;
    $("decision-detail-subtitle").textContent = `${row.risk} • ${row.action} • Priority ${row.priority}/100`;
    $("detail-business").textContent = row.businessReason;
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
    $("regulation-list").innerHTML = regulations().map(([title, description], index) => `<details ${index === 0 ? "open" : ""}><summary>${esc(title)}</summary><p>${esc(description)}</p></details>`).join("");
  }

  function renderEmpty() {
    $("brain-live-title").textContent = "Waiting for inventory history";
    $("brain-live-detail").textContent = "Upload a regional Raw Report to activate the decision brain";
    for (let index = 1; index <= 6; index += 1) $(`brain-kpi-${index}`).textContent = "0";
    $("brain-kpi-accuracy").textContent = "No model data";
    $("learning-metrics").innerHTML = `<div><small>Historical uploads</small><strong>0 / 30</strong></div><div><small>Backtest observations</small><strong>0</strong></div><div><small>Portfolio accuracy</small><strong>Learning</strong></div><div><small>Model version</small><strong>${MODEL_VERSION}</strong></div>`;
    $("method-bars").innerHTML = "";
    $("decision-count").textContent = "0 decisions";
    $("decision-rows").innerHTML = `<tr><td colspan="12"><div class="empty-brain"><strong>No inventory report available</strong><span>Upload the Raw Report first. Each future upload becomes another learning observation.</span></div></td></tr>`;
  }

  function reportData() {
    return {
      headers: ["Model", "Brand", "Item", "Risk", "Priority", "Recommended next action", "Business reason", "Why stockout", "Why demand", "Forecast/month", "Net available", "Days to stockout", "Recommended units", "Forecast method", "Confidence", "Calculation", "Regulatory control point"],
      rows: filtered.map(row => [row.model, row.brand, row.product, row.risk, row.priority, row.action, row.businessReason, row.stockoutWhy, row.demandWhy, row.forecast, row.netAvailable, row.daysToStockout == null ? "" : row.daysToStockout, row.gap, row.method, row.confidence, row.calculation, regulationDecision(row)])
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
})();
