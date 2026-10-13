/* Read-only report tools shared by the browser analyst and authenticated AI service. */
(function (root) {
  'use strict';
  const text = (v, max = 180) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const numeric = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const round = v => Math.round(numeric(v) * 100) / 100;
  const sum = (items, field) => round(items.reduce((n, item) => n + numeric(item[field]), 0));
  const regions = new Set(['US', 'EU', 'CA']);
  function validateSnapshot(value) {
    if (!value || !Array.isArray(value.reports) || value.reports.length > 3) throw new Error('Invalid report snapshot.');
    const seen = new Set(); let count = 0;
    const reports = value.reports.map(report => {
      if (!regions.has(report.region) || seen.has(report.region) || !Array.isArray(report.items)) throw new Error('Invalid report region.');
      seen.add(report.region); count += report.items.length;
      if (count > 6000) throw new Error('The analysis snapshot exceeds 6,000 item rows.');
      const items = report.items.map((item, index) => {
        const result = { evidence_id: `${report.region}:item:${index}`, model: text(item.model), brand: text(item.brand), title: text(item.title, 240), status: text(item.status, 40), eligible: item.eligible === true, priority: text(item.priority, 30), nextAction: text(item.nextAction, 240), forecastMethod: text(item.forecastMethod, 80) };
        for (const key of ['onHand', 'openClient', 'openSupplier', 'eligibleInbound', 'demand', 'last30', 'leadMonths', 'recommended', 'riskScore', 'confidence', 'forecast', 'forecastLow', 'forecastHigh']) {
          if (item[key] !== undefined && (!Number.isFinite(item[key]) || item[key] < 0 || item[key] > 1e12)) throw new Error('A report contains an invalid numeric value.');
          result[key] = round(item[key]);
        }
        result.stockoutRisk = item.stockoutRisk === true;
        result.daysToStockout = item.daysToStockout === null || item.daysToStockout === undefined ? null : round(item.daysToStockout);
        return result;
      });
      const summary = {};
      for (const key of ['rowCount', 'eligibleItems', 'reorderItems', 'recommendedUnits', 'stockoutRisks', 'criticalRisks', 'excessItems', 'noDemandItems', 'dataQuality', 'confidence', 'historyReports']) summary[key] = Math.max(0, round(report.summary?.[key]));
      summary.rowCount = Math.max(items.length, summary.rowCount);
      return { region: report.region, fileName: text(report.fileName, 180), importedAt: text(report.importedAt, 40), signature: text(report.signature, 100), summary, settings: { critical: Math.max(0, numeric(report.settings?.critical, 3)), coverage: Math.min(120, Math.max(0, numeric(report.settings?.coverage, 1))), delay: Math.min(3650, Math.max(0, numeric(report.settings?.delay, 15))) }, items, evidence_id: `${report.region}:summary`, omittedRows: Math.max(0, summary.rowCount - items.length) };
    });
    const workspace = {};
    for (const key of ['customerOrders', 'openCustomerOrders', 'purchaseOrders', 'openPurchaseOrders', 'latePurchaseOrders', 'pendingPickWaves', 'pendingPacking', 'partnerShipments', 'unresolvedIssues']) workspace[key] = Math.max(0, round(value.workspace?.[key]));
    workspace.sampleData = value.workspace?.sampleData === true;
    const sales = [], salesSeen = new Set(); let salesCount = 0;
    for (const report of value.sales || []) {
      if (!regions.has(report.region) || salesSeen.has(report.region) || !Array.isArray(report.items)) throw new Error('Invalid sales report region.');
      salesSeen.add(report.region); salesCount += report.items.length;
      if (salesCount > 1500) throw new Error('Sales analysis exceeds 1,500 model rows.');
      const items = report.items.map((item, index) => {
        const result = { evidence_id: `${report.region}:sales:${index}`, model: text(item.model), brand: text(item.brand), planningSignal: text(item.planningSignal), priceSource: text(item.priceSource) };
        for (const key of ['units', 'price', 'cost', 'suggestedQty', 'revenueAtRisk', 'excessCost', 'deadStockCost', 'stockoutProbability', 'forecast']) {
          if (item[key] !== undefined && (!Number.isFinite(item[key]) || item[key] < 0 || item[key] > 1e12)) throw new Error('Invalid sales numeric value.');
          result[key] = round(item[key]);
        }
        return result;
      });
      const summary = {};
      for (const key of ['models', 'units', 'estimatedRevenue', 'estimatedMargin', 'revenueAtRisk', 'suggestedQty', 'excessCost', 'deadStockCost', 'missingPrices']) summary[key] = Math.max(0, round(report.summary?.[key]));
      sales.push({ region: report.region, currency: report.region === 'EU' ? 'EUR' : report.region === 'CA' ? 'CAD' : 'USD', fileName: text(report.fileName), importedAt: text(report.importedAt, 40), signature: text(report.signature, 100), evidence_id: `${report.region}:sales:summary`, summary, items, omittedRows: Math.max(0, summary.models - items.length) });
    }
    return { capturedAt: text(value.capturedAt, 40), scope: text(value.scope, 10), reports, sales, workspace, workspaceEvidenceId: 'workspace:summary' };
  }
  function selected(snapshot, region = 'ALL') {
    if (region !== 'ALL' && !regions.has(region)) throw new Error('Choose US, EU, CA or ALL.');
    return snapshot.reports.filter(report => region === 'ALL' || report.region === region);
  }
  function matches(item, query) {
    const tokens = text(query, 200).toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = [item.model, item.brand, item.title, item.status].join(' ').toLowerCase();
    return tokens.every(token => haystack.includes(token));
  }
  function overview(snapshot, args) {
    return { capturedAt: snapshot.capturedAt, reports: selected(snapshot, args.region).map(report => ({ evidence_id: report.evidence_id, region: report.region, fileName: report.fileName, importedAt: report.importedAt, ...report.summary, omittedRows: report.omittedRows, settings: report.settings })), sales: salesReports(snapshot, args).reports.map(report => ({ ...report, items: undefined })) };
  }
  function search(snapshot, args) {
    const filtered = selected(snapshot, args.region).flatMap(report => report.items.map(item => ({ region: report.region, fileName: report.fileName, ...item }))).filter(item => matches(item, args.query));
    const list = filtered.filter(item => args.risk === 'stockout' ? item.stockoutRisk : args.risk === 'reorder' ? item.recommended > 0 : args.risk === 'excess' ? item.demand > 0 && item.onHand / item.demand > 4 : args.risk === 'no_demand' ? item.demand === 0 && item.onHand > 0 : true);
    list.sort((a, b) => b.riskScore - a.riskScore || b.recommended - a.recommended);
    const limit = Math.min(50, Math.max(1, Math.floor(numeric(args.limit, 10))));
    return { matchedRows: list.length, returnedRows: Math.min(list.length, limit), omittedSourceRows: selected(snapshot, args.region).reduce((n, r) => n + r.omittedRows, 0), items: list.slice(0, limit) };
  }
  function brands(snapshot, args) {
    const result = [];
    for (const report of selected(snapshot, args.region)) {
      const names = [...new Set(report.items.filter(item => item.eligible).map(item => item.brand))].sort();
      names.forEach((brand, index) => {
        if (args.query && !brand.toLowerCase().includes(text(args.query).toLowerCase())) return;
        const items = report.items.filter(item => item.eligible && item.brand === brand);
        result.push({ evidence_id: `${report.region}:brand:${index}`, region: report.region, brand, eligibleItems: items.length, onHand: sum(items, 'onHand'), demand: sum(items, 'demand'), recommendedUnits: sum(items, 'recommended'), stockoutRisks: items.filter(item => item.stockoutRisk).length, openSupplier: sum(items, 'openSupplier'), eligibleInbound: sum(items, 'eligibleInbound'), confidence: round(items.reduce((n, item) => n + item.confidence, 0) / items.length), partialSource: report.omittedRows > 0 });
      });
    }
    return { brands: result.sort((a, b) => b.recommendedUnits - a.recommendedUnits).slice(0, 40) };
  }
  function scenario(snapshot, args) {
    const demandChange = numeric(args.demand_change_pct);
    const delayDays = numeric(args.lead_delay_days);
    const coverage = args.coverage_months === null || args.coverage_months === undefined ? null : numeric(args.coverage_months);
    const absoluteLead = args.lead_months === null || args.lead_months === undefined ? null : numeric(args.lead_months);
    const onHand = args.on_hand === null || args.on_hand === undefined ? null : numeric(args.on_hand);
    const inbound = args.inbound_units === null || args.inbound_units === undefined ? null : numeric(args.inbound_units);
    for (const key of ['demand_change_pct', 'lead_delay_days', 'coverage_months', 'lead_months', 'on_hand', 'inbound_units']) if (args[key] !== null && args[key] !== undefined && !Number.isFinite(args[key])) throw new Error('Scenario inputs must be finite numbers.');
    if ((onHand !== null && (onHand < 0 || onHand > 1e8)) || (inbound !== null && (inbound < 0 || inbound > 1e8))) throw new Error('Scenario stock and inbound quantities are outside the supported range.');
    if (demandChange < -100 || demandChange > 500 || delayDays < 0 || delayDays > 365 || (coverage !== null && (coverage < 0 || coverage > 24)) || (absoluteLead !== null && (absoluteLead < 0 || absoluteLead > 24))) throw new Error('Scenario exceeds supported demand, lead-time or coverage bounds.');
    const rows = [];
    for (const report of selected(snapshot, args.region)) for (const item of report.items) {
      if (!item.eligible || !matches(item, args.query)) continue;
      const demand = item.demand * (1 + demandChange / 100), leadMonths = (absoluteLead ?? item.leadMonths) + delayDays / 30.44;
      const recommended = Math.max(0, Math.ceil(demand * (leadMonths + (coverage ?? report.settings.coverage)) + report.settings.critical + item.openClient - (onHand ?? item.onHand) - (args.exclude_inbound ? 0 : inbound ?? item.eligibleInbound) - 1e-9));
      rows.push({ evidence_id: item.evidence_id, region: report.region, model: item.model, brand: item.brand, baseline: item.recommended, simulated: recommended, change: recommended - item.recommended });
    }
    return { simulated: true, dataChanged: false, assumptions: { demand_change_pct: demandChange, lead_delay_days: delayDays, lead_months: absoluteLead, coverage_months: coverage, on_hand: onHand, inbound_units: inbound, exclude_inbound: args.exclude_inbound === true }, matchedItems: rows.length, baselineUnits: sum(rows, 'baseline'), simulatedUnits: sum(rows, 'simulated'), change: sum(rows, 'change'), partialSource: selected(snapshot, args.region).some(r => r.omittedRows), items: rows.sort((a, b) => b.change - a.change).slice(0, 20) };
  }
  function workspace(snapshot) { return { evidence_id: snapshot.workspaceEvidenceId, ...snapshot.workspace, capturedAt: snapshot.capturedAt }; }
  function salesReports(snapshot, args) {
    if (args.region && args.region !== 'ALL' && !regions.has(args.region)) throw new Error('Invalid sales region.');
    return { valuation: 'Estimated revenue and margin use historical units times the current price/cost snapshot; these are not accounting totals.', reports: (snapshot.sales || []).filter(r => !args.region || args.region === 'ALL' || args.region === r.region).map(report => ({ evidence_id: report.evidence_id, region: report.region, currency: report.currency, fileName: report.fileName, importedAt: report.importedAt, ...report.summary, omittedRows: report.omittedRows, items: report.items.filter(item => matches(item, args.query || '')).sort((a, b) => b.revenueAtRisk - a.revenueAtRisk || b.units - a.units).slice(0, 20) })) };
  }
  const handlers = { report_overview: overview, search_report_items: search, compare_brands: brands, simulate_scenario: scenario, workspace_health: workspace, sales_report: salesReports };
  function run(name, args, snapshot) {
    if (!Object.hasOwn(handlers, name)) throw new Error('This analysis tool is not available.');
    return handlers[name](snapshot, args || {});
  }
  function evidence(snapshot) {
    const result = [{ id: 'workspace:summary', label: snapshot.workspace.sampleData ? 'Operations workspace · includes sample records' : 'Operations workspace', kind: 'workspace', region: 'ALL' }];
    for (const report of snapshot.reports) {
      result.push({ id: report.evidence_id, label: `${report.region} · ${report.fileName}`, kind: 'report', region: report.region, fileName: report.fileName, importedAt: report.importedAt });
      report.items.forEach(item => result.push({ id: item.evidence_id, label: `${report.region} · ${item.model || item.title} · ${report.fileName}`, kind: 'item', region: report.region, model: item.model, fileName: report.fileName, facts: item }));
      [...new Set(report.items.filter(item => item.eligible).map(item => item.brand))].sort().forEach((brand, index) => result.push({ id: `${report.region}:brand:${index}`, label: `${report.region} · ${brand} · ${report.fileName}`, kind: 'brand', region: report.region }));
    }
    for (const report of snapshot.sales || []) {
      result.push({ id: report.evidence_id, label: `${report.region} · sales · ${report.fileName}`, kind: 'sales', region: report.region, fileName: report.fileName, importedAt: report.importedAt });
      report.items.forEach(item => result.push({ id: item.evidence_id, label: `${report.region} · ${item.model} · sales · ${report.fileName}`, kind: 'sales-item', region: report.region, facts: item }));
    }
    return result;
  }
  const regionProperty = { type: 'string', enum: ['US', 'EU', 'CA', 'ALL'] };
  const queryProperty = { type: 'string', description: 'Exact model, brand or title keywords; empty for all items.' };
  const specs = [
    ['report_overview', 'Read complete report totals, planning settings, timestamps and missing-row limits.', { region: regionProperty }],
    ['search_report_items', 'Find models and brands with verified stock, demand, inbound, confidence and reorder quantities.', { region: regionProperty, query: queryProperty, risk: { type: 'string', enum: ['all', 'stockout', 'reorder', 'excess', 'no_demand'] }, limit: { type: 'integer', minimum: 1, maximum: 50 } }],
    ['compare_brands', 'Compare each brand separately in each region. Never merge currencies or inventory regions.', { region: regionProperty, query: queryProperty }],
    ['simulate_scenario', 'Calculate a what-if scenario without changing live data or planning settings. Nullable stock/inbound overrides apply to each matched model, not a shared aggregate.', { region: regionProperty, query: queryProperty, demand_change_pct: { type: 'number', minimum: -100, maximum: 500 }, lead_delay_days: { type: 'number', minimum: 0, maximum: 365 }, lead_months: { type: ['number', 'null'], minimum: 0, maximum: 24 }, coverage_months: { type: ['number', 'null'], minimum: 0, maximum: 24 }, on_hand: { type: ['number', 'null'], minimum: 0, maximum: 1e8 }, inbound_units: { type: ['number', 'null'], minimum: 0, maximum: 1e8 }, exclude_inbound: { type: 'boolean' } }],
    ['sales_report', 'Read sales-model demand, prices, forecast, stock risk and valuation separately by region/currency.', { region: regionProperty, query: queryProperty }],
    ['workspace_health', 'Read operational counts and whether they include sample data. No customer contact information is available.', {}]
  ];
  const definitions = specs.map(([name, description, properties]) => ({ type: 'function', name, description, strict: true, parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } }));
  const api = { validateSnapshot, run, evidence, definitions, matches };
  root.MKAnalysisTools = Object.freeze(api);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
