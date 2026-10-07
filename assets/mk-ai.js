(function () {
  'use strict';
  if (window.MKAI) return;
  const T = window.MKAnalysisTools;
  const KEY = 'mk-analyst-v4', enc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value || 0);
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* use defaults */ }
  data = { aiEnabled: true, depth: 'Auto', monitor: true, autoAI: false, scope: '', messages: [], alerts: [], baselines: {}, ...data };
  if (!['Fast', 'Auto', 'Deep'].includes(data.depth)) data.depth = 'Auto';
  if (!Array.isArray(data.messages)) data.messages = [];
  if (!Array.isArray(data.alerts)) data.alerts = [];
  let status = { mode: data.aiEnabled ? 'ready' : 'local', message: data.aiEnabled ? 'Supply AI Chain Hub selected' : 'Local analyst ready', model: '' }, monitorFlight, monitorTimer, analysisFlight, queuedMonitor = false, lastAutoAI = 0;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* current session remains usable */ } };
  const emit = type => window.dispatchEvent(new CustomEvent(type || 'mk:analyst-change', { detail: getStatus() }));
  const setStatus = (message, mode = 'local', model = '') => { status = { message, mode, model }; emit(); };
  function scope() { return ['US', 'EU', 'CA', 'ALL'].includes(data.scope) ? data.scope : window.StarkSystem?.getRegion() || 'US'; }
  function hash(value) { let n = 2166136261; for (const c of JSON.stringify(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(16); }
  function workspace() {
    const state = window.StarkSystem?.getState(), e = state?.enterprise || {}, l = state?.logistics || {};
    const open = item => !['SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED', 'RECEIVED', 'COMPLETE'].includes(item.status);
    return { customerOrders: e.orders?.length || 0, openCustomerOrders: e.orders?.filter(open).length || 0, purchaseOrders: e.purchaseOrders?.length || 0, openPurchaseOrders: e.purchaseOrders?.filter(open).length || 0, latePurchaseOrders: e.purchaseOrders?.filter(item => open(item) && item.eta && new Date(item.eta) < new Date()).length || 0, pendingPickWaves: l.pickWaves?.filter(open).length || 0, pendingPacking: l.packing?.filter(open).length || 0, partnerShipments: l.tplShipments?.filter(open).length || 0, unresolvedIssues: window.StarkSystem?.issues().length || 0, sampleData: state?.mode === 'sample' || state?.sampleData === true || state?.demo === true || e.accounts?.some(item => String(item.email || '').endsWith('.example')) || false };
  }
  function makeReport(analysis) {
    const fields = analysis.items.map(item => ({ model: String(item.model || item.itemid || ''), brand: item.brand, title: item.product, status: item.status, eligible: item.activeBrand && item.eligible && !item.excluded, priority: item.priority, nextAction: item.nextAction, onHand: item.onHand, openClient: item.openClient, openSupplier: item.openSupplier, eligibleInbound: item.planningSupplier, demand: item.demand, last30: item.last30, leadMonths: item.leadMonths, recommended: item.recommended, riskScore: item.riskScore, confidence: item.confidence.score, forecast: item.forecast.value, forecastLow: item.forecast.low, forecastHigh: item.forecast.high, forecastMethod: item.forecast.method, stockoutRisk: item.stockoutRisk, daysToStockout: item.daysToStockout }));
    return { region: analysis.code, fileName: analysis.dataset.fileName || 'Inventory report', importedAt: analysis.dataset.importedAt || '', signature: hash([analysis.dataset.fileName, analysis.dataset.importedAt, analysis.dataset.rows, analysis.settings, fields, analysis.dataset.importedAt ? Date.now() - new Date(analysis.dataset.importedAt).getTime() > 14 * 864e5 : false]), settings: analysis.settings, summary: { rowCount: fields.length, eligibleItems: analysis.scoped.length, reorderItems: analysis.reorders.length, recommendedUnits: analysis.recommendedUnits, stockoutRisks: analysis.stockouts.length, criticalRisks: analysis.criticalRisks, excessItems: analysis.excess.length, noDemandItems: analysis.noDemand.length, dataQuality: analysis.dataQuality.score, confidence: analysis.averageConfidence, historyReports: analysis.historyFiles }, items: fields };
  }
  function makeSalesReport(report, code) {
    const n = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    const all = report.analysis.items.map(item => ({ model: String(item.model || item.itemId || ''), brand: item.brand || '', units: n(item.demand9), price: n(item.price), priceSource: item.priceSource || '', cost: n(item.cost), suggestedQty: n(item.suggestedQty), revenueAtRisk: n(item.revenueAtRisk), excessCost: n(item.excessCost), deadStockCost: n(item.deadStockCost), stockoutProbability: n(item.stockoutProbability), forecast: n(item.forecast?.next), planningSignal: item.planningSignal || '' }));
    const total = field => all.reduce((sum, item) => sum + item[field], 0);
    return { region: code, fileName: report.sales?.fileName || 'Sales report', importedAt: report.sales?.importedAt || '', signature: hash([all, report.sales?.importedAt]), items: all.slice().sort((a,b) => b.revenueAtRisk - a.revenueAtRisk).slice(0,500), summary: { models: all.length, units: total('units'), estimatedRevenue: all.reduce((sum,item) => sum + item.units * item.price,0), estimatedMargin: all.reduce((sum,item) => sum + (item.cost > 0 ? item.units * Math.max(0,item.price-item.cost) : 0),0), revenueAtRisk: total('revenueAtRisk'), suggestedQty: total('suggestedQty'), excessCost: total('excessCost'), deadStockCost: total('deadStockCost'), missingPrices: all.filter(item => !item.price).length } };
  }
  async function snapshot(selected = scope(), question = '') {
    if (!window.MKVerifiedEngine) throw new Error('The verified report engine is still loading.');
    const codes = selected === 'ALL' ? ['US', 'EU', 'CA'] : [selected], reports = [], sales = [];
    for (const code of codes) { const analysis = await window.MKVerifiedEngine.analyze(code); if (analysis) reports.push(makeReport(analysis)); const report = await window.MKVerifiedEngine.loadSales(code); if (report?.analysis?.items?.length) sales.push(makeSalesReport(report, code)); }
    // Exact queried models/brands and priority rows are retained when a large report exceeds the server limit.
    let remaining = 6000;
    reports.forEach((report, index) => {
      const limit = Math.floor(remaining / (reports.length - index));
      if (report.items.length > limit) report.items = report.items.map((item, position) => ({ item, position, match: [item.model, item.brand].some(v => String(v).length > 2 && question.toLowerCase().includes(String(v).toLowerCase())) })).sort((a, b) => Number(b.match) - Number(a.match) || b.item.riskScore - a.item.riskScore || a.position - b.position).slice(0, limit).sort((a, b) => a.position - b.position).map(entry => entry.item);
      remaining -= report.items.length;
    });
    return T.validateSnapshot({ capturedAt: new Date().toISOString(), scope: selected, reports, sales, workspace: workspace() });
  }
  function localResult(question, source, localAnswer) {
    const reports = source.reports, ids = reports.map(report => report.evidence_id), tools = [];
    const query = question.toLowerCase(), names = [...new Set([...reports, ...source.sales].flatMap(r => r.items.map(i => i.brand)))].filter(Boolean).sort((a, b) => b.length - a.length);
    const models = [...reports, ...source.sales].flatMap(r => r.items.map(i => i.model)).filter(v => v.length > 2).sort((a, b) => b.length - a.length);
    const named = models.find(name => query.includes(name.toLowerCase())) || names.find(name => query.includes(name.toLowerCase())) || '';
    const call = (name, args) => { tools.push({ name, arguments: args, status: 'complete' }); return T.run(name, args, source); };
    call('report_overview', { region: 'ALL' });
    let answer = source.scope === window.MKVerifiedEngine.currentRegion() ? localAnswer?.message || '' : reports.map(r => `${r.region}: ${r.summary.eligibleItems} eligible models, ${fmt(r.summary.recommendedUnits)} recommended units and ${r.summary.stockoutRisks} stockout risks.`).join('\n'), findings = [], actions = [], assumptions = [], questions = [];
    if (!reports.length && !source.sales.length) { answer = 'No inventory report is available in this scope. Upload a CSV, TSV or XLSX Raw Report, or select a region with a report.'; questions.push('Which regional report should I analyze?'); }
    else if (/sales|revenue|margin|seller/.test(query)) {
      const result = call('sales_report', { region: 'ALL', query: named });
      answer = result.reports.length ? result.reports.map(r => `${r.region} (${r.currency}): ${fmt(r.units)} historical demand units, ${fmt(r.estimatedRevenue)} estimated revenue, ${fmt(r.suggestedQty)} suggested replenishment units.`).join('\n') : 'No analyzed sales report is available in this scope. Upload and generate Sales Analysis first.';
      ids.push(...result.reports.map(r => r.evidence_id));
      findings = result.reports.flatMap(r => r.items.slice(0,2).map(item => ({ title: `${r.region} · ${item.model}`, severity: item.stockoutProbability >= .65 ? 'high' : 'low', explanation: `${fmt(item.units)} historical units; ${fmt(item.suggestedQty)} suggested units; ${fmt(item.revenueAtRisk)} ${r.currency} estimated opportunity at risk.`, evidence_ids: [item.evidence_id] })));
      assumptions.push(result.valuation);
      source.sales.forEach(r => { if(r.omittedRows) assumptions.push(`${r.region}: sales totals cover ${r.summary.models} models; queries include ${r.items.length}.`); if(r.summary.missingPrices) assumptions.push(`${r.region}: ${r.summary.missingPrices} sales models have no usable price.`); });
    } else if (!reports.length) { answer = 'Inventory evidence is unavailable in this scope. Use a sales question for the connected sales report, or upload an inventory report.'; }
    else if (/what.?if|scenario|simulate/.test(query)) {
      const parsed = window.MKVerifiedEngine.parseScenario(query, reports[0].settings);
      const leadDelay = Math.max(0, Number(query.match(/(?:delay|late).*?(\d+(?:\.\d+)?)\s*days?/)?.[1] || 0));
      const args = { region: 'ALL', query: named, demand_change_pct: ((parsed.demandMultiplier ?? 1) - 1) * 100, lead_delay_days: leadDelay, lead_months: parsed.leadMonths ?? null, coverage_months: parsed.coverage ?? null, on_hand: parsed.onHand ?? null, inbound_units: parsed.planningSupplier ?? null, exclude_inbound: /exclude.*inbound|no inbound|without inbound/.test(query) };
      const result = call('simulate_scenario', args);
      answer = `Scenario across ${result.matchedItems} eligible models: ${fmt(result.baselineUnits)} baseline reorder units → ${fmt(result.simulatedUnits)} simulated units (${fmt(result.change)} change).`;
      findings = result.items.slice(0, 4).map(item => ({ title: `${item.region} · ${item.model}`, severity: item.change > 0 ? 'high' : 'low', explanation: `Scenario: ${fmt(item.baseline)} baseline units → ${fmt(item.simulated)} simulated units.`, evidence_ids: [item.evidence_id] }));
      assumptions.push(`Demand change ${fmt(args.demand_change_pct)}%; additional supplier delay ${fmt(leadDelay)} days; ${args.exclude_inbound ? 'inbound excluded' : 'eligible inbound retained'}. Planning records were unchanged.`);
      if (args.lead_months !== null) assumptions.push(`Scenario lead time is ${fmt(args.lead_months)} months.`);
      if (args.on_hand !== null || args.inbound_units !== null) assumptions.push(`Per matched model: ${args.on_hand !== null ? fmt(args.on_hand) + ' on-hand units' : 'current on-hand units'}; ${args.inbound_units !== null ? fmt(args.inbound_units) + ' eligible inbound units' : 'current eligible inbound'}.`);
      if (!parsed.changed && !leadDelay && !args.exclude_inbound) { answer = 'Give a measurable scenario, for example demand increasing 20%, supplier delivery delayed 10 days, or lead time set to 8 weeks.'; findings = []; questions.push('Which assumption should change, and by how much?'); }
    } else if (named && names.includes(named) && !models.includes(named)) {
      const result = call('compare_brands', { region: 'ALL', query: named });
      answer = `${named} analysis\n` + result.brands.map(b => `${b.region}: ${b.eligibleItems} eligible models; ${fmt(b.recommendedUnits)} recommended units; ${b.stockoutRisks} stockout risks; ${fmt(b.confidence)}/100 confidence.`).join('\n');
      findings = result.brands.map(b => ({ title: `${b.region} · ${b.brand}`, severity: b.stockoutRisks ? 'high' : 'low', explanation: `${b.eligibleItems} eligible models: ${fmt(b.onHand)} units on hand; ${fmt(b.demand)} demand units/month; ${fmt(b.openSupplier)} open supplier units; ${fmt(b.eligibleInbound)} eligible inbound; ${fmt(b.recommendedUnits)} recommended units. Models with stockout risk: ${b.stockoutRisks}. Forecast confidence ${fmt(b.confidence)}/100.`, evidence_ids: [b.evidence_id] }));
      const detail = call('search_report_items', { region: 'ALL', query: named, risk: 'all', limit: 8 });
      const priorities = detail.items.filter(item => item.eligible && (item.recommended > 0 || item.stockoutRisk)).slice(0, 3);
      findings.push(...priorities.map(item => ({ title: `${item.region} · ${item.model}`, severity: item.stockoutRisk ? 'high' : 'medium', explanation: `${fmt(item.onHand)} on hand; ${fmt(item.demand)} demand units/month; ${fmt(item.eligibleInbound)} eligible inbound; ${fmt(item.recommended)} recommended units.`, evidence_ids: [item.evidence_id] })));
      actions = priorities.map(item => ({ title: `${item.model}: review replenishment`, priority: item.stockoutRisk ? 'now' : 'next', reason: `Confirm supplier availability and timing for ${fmt(item.recommended)} suggested units; stockout flag ${item.stockoutRisk ? 'present' : 'absent'}.`, owner: 'Supply planning', evidence_ids: [item.evidence_id] }));
    } else if (/compare.*(regions?|\bus\b|\beu\b|canada)|cross.region/.test(query)) {
      answer = 'Regional comparison\n' + reports.map(r => `${r.region}: ${r.summary.eligibleItems} eligible models, ${fmt(r.summary.recommendedUnits)} recommended units, ${r.summary.stockoutRisks} stockout risks, ${fmt(r.summary.dataQuality)}/100 data quality.`).join('\n');
      assumptions.push('Regional inventory remains separate. These totals do not imply stock can transfer between regions.');
    } else if (/orders?|warehouse|fulfillment|operational|purchase orders?/.test(query) && !/reorder|stock/.test(query)) {
      const result = call('workspace_health', {});
      answer = `Operations: ${result.openCustomerOrders} open customer orders, ${result.openPurchaseOrders} open purchase orders, ${result.pendingPickWaves} pending picking waves and ${result.unresolvedIssues} unresolved issues.`;
      ids.push('workspace:summary');
    } else {
      const risk = /stock.?out/.test(query) ? 'stockout' : /excess|overstock/.test(query) ? 'excess' : /no demand|dead stock/.test(query) ? 'no_demand' : /reorder|replenish/.test(query) ? 'reorder' : 'all';
      const result = call('search_report_items', { region: 'ALL', query: named, risk, limit: 5 });
      if (source.scope === 'ALL') answer = reports.map(r => `${r.region}: ${fmt(r.summary.recommendedUnits)} recommended units across ${r.summary.reorderItems} models; ${r.summary.stockoutRisks} stockout risks.`).join('\n');
      findings = result.items.slice(0, 5).map(item => ({ title: `${item.region} · ${item.model || item.title}`, severity: item.riskScore >= 75 ? 'critical' : item.stockoutRisk ? 'high' : 'low', explanation: `${fmt(item.onHand)} on hand; ${fmt(item.demand)} demand units/month; ${fmt(item.eligibleInbound)} eligible inbound; ${fmt(item.recommended)} recommended units. Forecast confidence ${fmt(item.confidence)}/100.`, evidence_ids: [item.evidence_id] }));
      actions = result.items.filter(item => item.eligible && (item.recommended > 0 || item.stockoutRisk)).slice(0, 3).map(item => ({ title: `${item.model}: ${item.nextAction || 'Review replenishment'}`, priority: item.stockoutRisk ? 'now' : 'next', reason: `Review ${fmt(item.recommended)} suggested units with purchasing and confirm supplier availability.`, owner: 'Supply planning', evidence_ids: [item.evidence_id] }));
    }
    reports.forEach(r => {
      if (r.omittedRows) assumptions.push(`${r.region}: totals cover ${r.summary.rowCount} rows, but item queries include ${r.items.length}; ${r.omittedRows} source rows are omitted from this analysis snapshot.`);
      if (r.summary.historyReports < 3) assumptions.push(`${r.region}: only ${r.summary.historyReports} retained history reports support forecast learning.`);
      if (r.importedAt && Date.now() - new Date(r.importedAt).getTime() > 14 * 864e5) assumptions.push(`${r.region}: the source report is more than 14 days old.`);
    });
    if (source.workspace.sampleData && ids.includes('workspace:summary')) assumptions.push('Operations counts include sample records.');
    const used = new Set([...ids, ...findings.flatMap(f => f.evidence_ids), ...actions.flatMap(a => a.evidence_ids)]);
    return { answer, findings: findings.slice(0, 8), actions, assumptions, questions, evidence_ids: ids, evidence: T.evidence(source).filter(e => used.has(e.id)), tools, mode: 'local', capturedAt: source.capturedAt };
  }
  function inferredScope(question) {
    if (/all regions|across regions|cross.region|compare.*regions|compare.*\b(us|united states)\b.*\b(eu|europe|canada|ca)\b|compare.*\b(eu|europe|canada|ca)\b.*\b(us|united states)\b/i.test(question)) return 'ALL';
    return scope();
  }
  async function answer(question, localAnswer, options = {}) {
    if (analysisFlight) throw new Error('An analysis is already running.');
    const run = async () => {
      const selected = options.scope || inferredScope(question), source = await snapshot(selected, question), fallback = localResult(question, source, localAnswer);
      if (options.signal?.aborted) throw new DOMException('Analysis cancelled.', 'AbortError');
      let result = fallback;
      if (data.aiEnabled) {
        setStatus('AI is investigating the report…', 'running');
        try {
          const history = data.messages.filter(item => item.scope === selected).slice(-8).map(item => ({ role: item.role, content: item.role === 'assistant' ? item.result.answer : item.content }));
          const notes = window.MKBrain?.getProfile()?.notes?.filter(note => selected === 'ALL' || note.region === selected).map(note => note.text) || [];
          result = await window.MKSpace.analyzeWithAI({ question, snapshot: source, localResult: fallback, history, notes, depth: data.depth }, options.signal);
          if (!result || result.mode !== 'ai' || typeof result.answer !== 'string' || !Array.isArray(result.evidence)) throw new Error('The AI service returned an invalid analysis.');
          setStatus('Hugging Face analysis complete', 'ai', result.model);
        } catch (error) {
          if (options.signal?.aborted || error.name === 'AbortError') throw error;
          result = { ...fallback, connectionIssue: error.message || 'The AI service is unavailable.' };
          setStatus('AI unavailable · local analysis ready', 'error');
        }
      } else setStatus('Local analysis complete', 'local');
      if (options.signal?.aborted) throw new DOMException('Analysis cancelled.', 'AbortError');
      if (!options.proactive) {
        data.messages.push({ id: crypto.randomUUID(), role: 'user', content: question, scope: selected, at: new Date().toISOString() }, { id: crypto.randomUUID(), role: 'assistant', result, scope: selected, at: new Date().toISOString() });
        data.messages = data.messages.slice(-40);
      }
      save(); emit(); return result;
    };
    analysisFlight = run(); try { return await analysisFlight; } finally { analysisFlight = null; emit(); }
  }
  function createAlerts(source) {
    const alerts = [];
    for (const report of source.sales || []) {
      const key = report.region + ':sales', prior = data.baselines[key];
      if(prior?.signature === report.signature) continue;
      alerts.push({ id: hash([key,report.signature]), region: report.region, title: 'Sales analysis updated', severity: report.summary.revenueAtRisk > 0 ? 'high' : 'low', explanation: `${report.summary.models} sales models; ${fmt(report.summary.suggestedQty)} suggested replenishment units. Estimated revenue exposure is valued in ${report.currency}.`, evidence_id: report.evidence_id, at: new Date().toISOString(), fileName: report.fileName, read: false });
      data.baselines[key] = { signature: report.signature, summary: report.summary, checkedAt: new Date().toISOString() };
    }
    for (const report of source.reports) {
      const prior = data.baselines[report.region];
      if (prior?.signature === report.signature) continue;
      const add = (title, severity, explanation, evidenceId = report.evidence_id) => alerts.push({ id: hash([report.region, report.signature, title]), region: report.region, title, severity, explanation, evidence_id: evidenceId, at: new Date().toISOString(), fileName: report.fileName, read: false });
      if (report.summary.stockoutRisks) add(`${report.summary.stockoutRisks} stockout risks`, 'high', `${report.region}: ${report.summary.criticalRisks} critical items. Review supplier timing and priority replenishment.`);
      if (report.summary.dataQuality < 85) add('Report data needs review', 'medium', `${report.region}: data-quality score ${fmt(report.summary.dataQuality)}/100. Verify missing demand, model IDs and supplier dates.`);
      if (prior && prior.summary.recommendedUnits !== report.summary.recommendedUnits) add('Reorder requirement changed', 'medium', `${fmt(prior.summary.recommendedUnits)} → ${fmt(report.summary.recommendedUnits)} units since the previous analyzed upload.`);
      if (report.importedAt && Date.now() - new Date(report.importedAt).getTime() > 14 * 864e5) add('Report may be stale', 'medium', `Imported ${report.importedAt.slice(0, 10)}. Upload a current report before making a purchasing decision.`);
      const low = report.items.filter(item => item.eligible && item.confidence < 60).length;
      if (low) add('Low-confidence forecast evidence', 'medium', `${low} eligible models have forecast confidence below 60/100.`);
      if (!alerts.some(a => a.region === report.region)) add('New report analyzed', 'low', `${report.summary.rowCount} models inspected; ${fmt(report.summary.recommendedUnits)} suggested reorder units.`);
      data.baselines[report.region] = { signature: report.signature, summary: report.summary, fileName: report.fileName, checkedAt: new Date().toISOString() };
    }
    return alerts;
  }
  async function monitor(force = false) {
    if ((!data.monitor && !force) || !window.MKVerifiedEngine) return;
    if (monitorFlight) { queuedMonitor = true; return monitorFlight; }
    monitorFlight = (async () => {
      const source = await snapshot('ALL'), alerts = createAlerts(source);
      const existing = new Set(data.alerts.map(a => a.id));
      data.alerts = [...alerts.filter(a => !existing.has(a.id)), ...data.alerts].slice(0, 80);
      save(); emit();
      if (alerts.length && data.autoAI && data.aiEnabled && !analysisFlight && Date.now() - lastAutoAI > 600000) {
        lastAutoAI = Date.now();
        try { const result = await answer('Investigate the newly changed reports across all regions. Explain the highest risks and propose the next actions with evidence.', null, { scope: 'ALL', proactive: true }); data.lastBriefing = result; save(); emit(); } catch { /* local alerts remain available */ }
      }
      return alerts;
    })();
    try { return await monitorFlight; } finally { monitorFlight = null; if (queuedMonitor) { queuedMonitor = false; scheduleMonitor(); } }
  }
  function scheduleMonitor() { clearTimeout(monitorTimer); if (data.monitor) monitorTimer = setTimeout(() => monitor().catch(error => setStatus(error.message, 'error')), 450); }
  function startMonitoring() {
    if (window.__MK_MONITOR_STARTED__) return; window.__MK_MONITOR_STARTED__ = true;
    window.addEventListener('stark:system-change', scheduleMonitor);
    window.addEventListener('storage', event => { if (event.key === 'stark-analytics-sync-pulse' || event.key?.startsWith('stark-active-brands') || event.key?.startsWith('stark-settings')) scheduleMonitor(); });
    window.addEventListener('stark:system-region', () => { if (!data.scope) emit(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleMonitor(); });
    try { const channel = new BroadcastChannel('stark-analytics-sync-v1'); channel.onmessage = scheduleMonitor; } catch { /* same-tab system event is also supported */ }
    setInterval(() => { if (!document.hidden) scheduleMonitor(); }, 60000);
    scheduleMonitor();
  }
  function getStatus() { return { ...status, provider: 'huggingface', depth: data.depth, aiEnabled: data.aiEnabled, monitor: data.monitor, autoAI: data.autoAI, scope: scope(), unread: data.alerts.filter(a => !a.read).length, running: !!analysisFlight }; }
  function configure(values) {
    for (const key of ['aiEnabled', 'monitor', 'autoAI']) if (typeof values[key] === 'boolean') data[key] = values[key];
    if (Object.hasOwn(values, 'scope')) data.scope = ['US', 'EU', 'CA', 'ALL'].includes(values.scope) ? values.scope : '';
    if (['Fast', 'Auto', 'Deep'].includes(values.depth)) data.depth = values.depth;
    if (!data.aiEnabled) setStatus('Local analyst ready', 'local');
    else if (values.aiEnabled === true && status.mode === 'local') setStatus('Supply AI Chain Hub selected', 'ready');
    save(); emit(); scheduleMonitor();
  }
  async function testConnection() {
    setStatus('Checking AI connection…', 'running');
    try { const result = await window.MKSpace.testConnection(); setStatus(result.message, 'ready', result.model); return result; }
    catch (error) { setStatus(error.message, 'error'); throw error; }
  }
  function renderResult(container, result) {
    const old = container.querySelector('.mk-analysis-detail'); old?.remove();
    const detail = document.createElement('div'); detail.className = 'mk-analysis-detail';
    const findings = result.findings?.length ? `<div class="mk-result-section"><strong>${enc(result.findingsLabel || 'Findings')}</strong>${result.findings.map(f => `<div class="mk-finding" data-severity="${enc(f.severity)}"><b>${enc(f.title)}</b><p>${enc(f.explanation)}</p><small>Evidence: ${enc((f.evidence_ids || []).join(', '))}</small></div>`).join('')}</div>` : '';
    const actions = result.actions?.length ? `<div class="mk-result-section"><strong>${enc(result.actionsLabel || 'Suggested actions')}</strong><ol>${result.actions.map(a => `<li><b>${enc(a.title)}</b><span>${enc(a.priority)} · ${enc(a.owner)}</span><p>${enc(a.reason)}</p><small>Evidence: ${enc((a.evidence_ids || []).join(', '))}</small></li>`).join('')}</ol></div>` : '';
    const assumptions = result.assumptions?.length ? `<details class="mk-result-section"><summary>Assumptions and limits (${result.assumptions.length})</summary><ul>${result.assumptions.map(a => `<li>${enc(a)}</li>`).join('')}</ul></details>` : '';
    const questions = result.questions?.length ? `<div class="mk-result-section"><strong>To investigate further</strong>${result.questions.map(q => `<p>${enc(q)}</p>`).join('')}</div>` : '';
    const evidence = result.evidence?.length ? `<details class="mk-result-section"><summary>${enc(result.evidenceLabel || 'Report evidence')} (${result.evidence.length})</summary>${result.evidence.map(e => `<div class="mk-evidence"><b>${enc(e.label)}</b><small>${enc(e.id)}${e.importedAt ? ' · ' + enc(e.importedAt.slice(0, 10)) : ''}</small>${e.facts ? `<dl>${['onHand','demand','eligibleInbound','recommended','confidence'].filter(k => e.facts[k] !== undefined).map(k => `<dt>${enc(k.replace(/([A-Z])/g,' $1'))}</dt><dd>${fmt(e.facts[k])}</dd>`).join('')}</dl>` : ''}</div>`).join('')}</details>` : '';
    const tools = result.tools?.length ? `<details class="mk-result-section"><summary>Analysis steps (${result.tools.length})</summary><ol>${result.tools.map(t => `<li>${t.origin ? enc(t.origin) + ': ' : ''}${enc(t.name.replace(/_/g, ' '))} · ${enc(t.status)}</li>`).join('')}</ol></details>` : '';
    detail.innerHTML = `<div class="mk-result-mode">${result.mode === 'ai' ? 'AI analysis · ' + enc(result.model || '') + (result.depth ? ' · ' + enc(result.depth) : '') : 'Verified local analysis'} · ${enc((result.capturedAt || '').slice(0, 16).replace('T',' '))} UTC</div>${result.connectionIssue ? `<p class="mk-connection-issue">${enc(result.connectionIssue)} <a href="${enc(window.StarkSystem.url('mk-brain.html#connection'))}">AI connection</a></p>` : ''}${findings}${actions}${assumptions}${questions}${evidence}${tools}`;
    container.append(detail);
  }
  window.MKAI = { answer, snapshot, localResult, makeReport, configure, getStatus, testConnection, monitor, startMonitoring, renderResult, getMessages: () => data.messages.slice(), getAlerts: () => data.alerts.slice(), getBriefing: () => data.lastBriefing, acknowledge: id => { data.alerts = data.alerts.map(a => id === 'all' || a.id === id ? { ...a, read: true } : a); save(); emit(); }, clearConversation: () => { data.messages = []; save(); emit('mk:conversation-clear'); }, scheduleMonitor };
})();
