(function () {
  'use strict';
  const W = window.StarkWorkspace, M = window.StarkReorderModel;
  const REGION = (document.body.dataset.region || 'US').toUpperCase();
  const REGION_KEY = REGION === 'CA' ? 'Canada' : REGION;
  const $ = id => document.getElementById(id);
  const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const percent = n => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(n);
  const controls = ['quantity', 'demand', 'target', 'lead', 'buffer'];
  const key = item => [item.model, item.itemid, item.brand].map(s => String(s ?? '').trim().toUpperCase()).join('|');
  const norm = s => String(s ?? '').trim().toUpperCase();
  let items = [], dataset = null, sales = null, historyError = '', selected = '', epoch = 0, timer = 0, channel;
  const drafts = new Map();

  document.addEventListener('DOMContentLoaded', init);
  function init() {
    if (!$('reorder-simulator') || !M) return;
    $('sim-form').addEventListener('submit', event => { event.preventDefault(); render(); });
    $('sim-model').addEventListener('change', () => { selected = $('sim-model').value; applyDraft(); render(); });
    controls.forEach(name => $('sim-' + name).addEventListener('input', () => { remember(); render(); }));
    $('sim-inbound').addEventListener('change', () => { remember(); render(); });
    $('sim-report-quantity').addEventListener('click', () => { $('sim-quantity').value = item()?.recommended || 0; remember(); render(); });
    $('sim-reset').addEventListener('click', () => { drafts.delete(selected); applyDraft(); render(); });
    $('sim-refresh').addEventListener('click', refresh);
    window.addEventListener('stark:system-change', () => { if (dataset) render(); });
    window.addEventListener('stark-report-state-change', scheduleRefresh);
    window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('pageshow', scheduleRefresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRefresh(); });
    window.addEventListener('storage', event => { if (event.key === (W?.storageKey('stark-analytics-sync-pulse') || 'stark-analytics-sync-pulse')) scheduleRefresh(); });
    try {
      const Channel = W?.BroadcastChannel || window.BroadcastChannel;
      if (Channel) { channel = new Channel('stark-analytics-sync-v1'); channel.onmessage = event => { if (norm(event.data?.region) === REGION) scheduleRefresh(); }; }
    } catch (_) {}
    window.addEventListener('pagehide', () => { clearTimeout(timer); }, { once: true });
    window.StarkReorderSimulator = Object.freeze({ region: REGION, refresh });
    refresh();
  }
  function scheduleRefresh() { clearTimeout(timer); timer = setTimeout(refresh, 120); }
  const item = () => items.find(row => key(row) === selected);
  function busy(loading) {
    $('reorder-simulator').setAttribute('aria-busy', String(loading));
    $('sim-fields').disabled = loading || !items.length;
    $('sim-report-quantity').disabled = loading || !items.length;
    $('sim-reset').disabled = loading || !items.length;
    $('sim-refresh').disabled = loading;
    if (loading) { $('sim-results').hidden = true; $('sim-summary').textContent = ''; $('sim-source').textContent = 'Reading saved ' + REGION + ' data…'; }
  }
  async function readSales() {
    const cached = W?.getDataset('stark-sales-intelligence-v1', 'regional-sales', REGION);
    if (W?.isDemo || cached !== undefined) return cached || null;
    const dbAPI = W?.indexedDB || window.indexedDB;
    if (!dbAPI) return null;
    return new Promise((resolve, reject) => {
      let settled = false, db;
      const finish = (result, error) => { if (settled) return; settled = true; clearTimeout(timeout); db?.close(); error ? reject(error) : resolve(result); };
      const timeout = setTimeout(() => finish(null, new Error('Monthly sales storage did not respond.')), 2500);
      const request = dbAPI.open('stark-sales-intelligence-v1', 1);
      request.onupgradeneeded = () => { request.transaction.abort(); finish(null); }; // Read only; do not create a report database.
      request.onblocked = () => finish(null, new Error('Monthly sales storage is busy.'));
      request.onerror = () => finish(null, request.error || new Error('Monthly sales storage could not be read.'));
      request.onsuccess = () => {
        db = request.result;
        if (settled) { db.close(); return; }
        if (!db.objectStoreNames.contains('regional-sales')) { finish(null); return; }
        try {
          const tx = db.transaction('regional-sales', 'readonly'), get = tx.objectStore('regional-sales').get(REGION);
          get.onsuccess = () => finish(get.result || null);
          get.onerror = () => finish(null, get.error || new Error('Monthly sales storage could not be read.'));
          tx.onabort = () => finish(null, tx.error || new Error('Monthly sales read was interrupted.'));
        } catch (error) { finish(null, error); }
      };
    });
  }
  async function refresh() {
    const currentEpoch = ++epoch;
    busy(true); $('sim-error').hidden = true;
    try {
      const [report, monthly] = await Promise.allSettled([window.StarkInventory.loadDataset(REGION_KEY), readSales()]);
      if (currentEpoch !== epoch) return;
      if (report.status === 'rejected') throw report.reason;
      dataset = report.value;
      sales = monthly.status === 'fulfilled' ? monthly.value : null;
      historyError = monthly.status === 'rejected' ? 'Monthly sales history could not be loaded. Use Reload source to retry.' : '';
      items = dataset?.rows?.length ? window.StarkInventory.analyze(dataset.rows, REGION_KEY) : [];
      const select = $('sim-model'), fragment = document.createDocumentFragment(), seen = new Set();
      for (const row of [...items].sort((a, b) => String(a.model).localeCompare(String(b.model), undefined, { numeric: true }))) {
        const id = key(row);
        if (seen.has(id)) continue;
        seen.add(id);
        const option = document.createElement('option'); option.value = id; option.textContent = (row.model || row.itemid || 'Unnamed model') + ' · ' + (row.brand || 'Unassigned brand'); fragment.append(option);
      }
      select.replaceChildren(fragment);
      if (!items.length) { clearDisplay(); dataset = null; selected = ''; $('sim-source').textContent = 'No ' + REGION + ' inventory report. Upload a Raw Report to try a quantity.'; $('sim-results').hidden = true; }
      else {
        if (!seen.has(selected)) selected = key(items.find(row => row.recommended > 0) || items[0]);
        select.value = selected; applyDraft();
        $('sim-source').textContent = REGION + ' · ' + (dataset.fileName || 'Saved regional inventory') + (W?.isDemo ? ' · Fictional demo data' : '');
      }
      busy(false); if (items.length) render();
    } catch (_) {
      if (currentEpoch !== epoch) return;
      clearDisplay(); dataset = null; items = []; selected = ''; sales = null;
      $('sim-model').replaceChildren(); busy(false); $('sim-results').hidden = true;
      $('sim-source').textContent = 'The saved ' + REGION + ' report could not be read.';
      error('Reload the source or replace the report on Raw Report. Previous scenario results have been cleared.');
    }
  }
  function defaults(row) {
    const settings = window.StarkInventory.loadSettings(REGION_KEY);
    return { quantity: Math.min(1e9, Math.max(0, row.recommended || 0)), demand: row.avg3 || 0,
      target: Math.min(24, Math.max(.1, Number(settings.coverage) || 3)), lead: Math.min(730, Math.max(0, (row.leadTimeMonths || 0) * 30)),
      buffer: Math.min(1e9, Math.max(0, Math.round(Number(settings.critical) || 0))), inbound: false };
  }
  function applyDraft() {
    const row = item(); if (!row) return;
    const draft = drafts.get(selected) || defaults(row);
    controls.forEach(name => { $('sim-' + name).value = draft[name]; $('sim-' + name).setCustomValidity(''); });
    $('sim-inbound').checked = draft.inbound;
    $('sim-report-quantity').textContent = 'Use report quantity (' + integer.format(row.recommended || 0) + ')';
  }
  function remember() { drafts.set(selected, Object.fromEntries([...controls.map(name => [name, $('sim-' + name).value]), ['inbound', $('sim-inbound').checked]])); }
  function stock(row) {
    const records = window.StarkSystem?.getState().enterprise.inventory || [];
    const matching = records.filter(record => record.region === REGION && norm(record.model) === norm(row.model) && record.nature !== 'DIGITAL');
    const canonical = matching.find(record => record.sku === REGION + '::' + row.model);
    const linked = canonical || (matching.length === 1 ? matching[0] : null);
    if (linked) {
      const onHand = Number(linked.onHand), commitments = Number(linked.reserved) + Number(linked.damaged || 0);
      return { onHand, commitments, netStock: onHand - commitments, source: 'Connected inventory: on hand − reserved − damaged. Report commitments are not subtracted a second time.' };
    }
    const onHand = Number(row.stockQty), commitments = Number(row.openClient);
    return { onHand, commitments, netStock: onHand - commitments, source: 'Regional report: Stock Qty − open client orders. ATS and undated supplier orders are excluded.' + (matching.length > 1 ? ' Multiple catalog matches prevent using connected stock.' : '') };
  }
  function error(message) { $('sim-error').textContent = message; $('sim-error').hidden = false; }
  function clearDisplay() {
    ['stock', 'commitments', 'free', 'inbound-units'].forEach(name => { $('sim-' + name).textContent = '—'; });
    ['item-detail', 'stock-basis', 'summary'].forEach(name => { $('sim-' + name).textContent = ''; });
  }
  function render() {
    const row = item(); if (!row || $('sim-fields').disabled) return;
    $('sim-error').hidden = true; controls.forEach(name => $('sim-' + name).setCustomValidity(''));
    if (items.filter(record => key(record) === selected).length > 1) {
      clearDisplay(); $('sim-results').hidden = true;
      error('Multiple inventory rows have this model, brand and item ID. Resolve the duplicate report rows before using this scenario.'); return;
    }
    try {
      for (const name of controls) {
        const input = $('sim-' + name);
        if (!input.validity.valid || input.value === '') { input.setCustomValidity('Enter a valid ' + input.getAttribute('data-name') + '.'); error(input.validationMessage); $('sim-results').hidden = true; $('sim-summary').textContent = ''; return; }
      }
      const balance = stock(row), includeInbound = $('sim-inbound').checked;
      const inbound = includeInbound ? Math.max(0, Number(row.planningSupplierQty) || 0) : 0;
      const input = { netStock: balance.netStock, quantity: $('sim-quantity').value, demand: $('sim-demand').value, targetMonths: $('sim-target').value, leadDays: $('sim-lead').value, buffer: $('sim-buffer').value, inbound };
      const c = M.coverage(input), h = historyError ? { ready: false, reason: historyError } : M.history(sales, row.model, REGION);
      const p = M.probability(input, h, { seed: REGION + '|' + norm(row.model) });
      $('sim-item-detail').textContent = (row.product || row.model || '') + (row.eligible && row.activeBrand && !row.excluded ? '' : ' · Outside the active reorder scope; scenario only.');
      $('sim-stock').textContent = decimal.format(balance.onHand);
      $('sim-commitments').textContent = decimal.format(balance.commitments);
      $('sim-free').textContent = decimal.format(balance.netStock);
      $('sim-inbound-units').textContent = decimal.format(Math.max(0, Number(row.planningSupplierQty) || 0));
      $('sim-stock-basis').textContent = balance.source;
      $('sim-current-cover').textContent = c.currentCoverage == null ? 'Not defined' : decimal.format(c.currentCoverage) + ' months';
      $('sim-new-cover').textContent = c.coverageMonths == null ? 'Not defined' : decimal.format(c.coverageMonths) + ' months';
      $('sim-usable-cover').textContent = c.usableCoverage == null ? 'No positive monthly demand entered.' : decimal.format(c.usableCoverage) + ' months above the ' + integer.format(c.buffer) + '-unit buffer.';
      $('sim-required').textContent = integer.format(c.requiredQuantity) + ' units';
      $('sim-target-result').textContent = (c.targetMet ? 'Target met' : 'Below target') + ' · ' + decimal.format(c.targetMonths) + ' months + buffer';
      $('sim-target-result').dataset.state = c.targetMet ? 'met' : 'short';
      $('sim-progress').value = c.usableCoverage == null ? 0 : Math.min(100, c.usableCoverage / c.targetMonths * 100);
      $('sim-progress').setAttribute('aria-valuetext', c.usableCoverage == null ? 'Coverage undefined without positive demand' : decimal.format(c.usableCoverage) + ' months above buffer; target ' + decimal.format(c.targetMonths));
      $('sim-lead-warning').hidden = c.preArrivalGap <= 1e-8;
      $('sim-lead-warning').textContent = 'Expected stockout before arrival: ' + decimal.format(c.preArrivalGap) + ' units short at the entered demand. A larger quantity arriving on the same date does not prevent this earlier shortage.';
      $('sim-equation').textContent = 'Stock at receipt = ' + decimal.format(c.netStock) + ' net stock − ' + decimal.format(c.leadDemand) + ' lead-time demand + ' + integer.format(c.quantity) + ' reorder' + (includeInbound ? ' + ' + decimal.format(c.inbound) + ' assumed inbound' : '') + ' = ' + decimal.format(c.receiptNet) + ' units. Coverage = ' + decimal.format(c.atReceipt) + ' ÷ ' + decimal.format(c.demand) + (c.coverageMonths == null ? ' (undefined at zero demand).' : ' = ' + decimal.format(c.coverageMonths) + ' months.') + (c.backlogAtReceipt > 0 ? ' Remaining backlog: ' + decimal.format(c.backlogAtReceipt) + ' units.' : '');
      $('sim-probability').textContent = p.ready ? percent(p.success) : 'Not estimated';
      $('sim-prearrival-risk').textContent = p.ready ? percent(p.preArrivalRisk) : 'Not estimated';
      $('sim-probability-evidence').textContent = p.ready ? integer.format(p.successes) + ' of ' + integer.format(p.paths) + ' sampled paths meet the target without an earlier stockout. ' + p.months + ' complete ' + REGION + ' sales months (' + h.months[0] + '–' + h.months[h.months.length - 1] + '); ' + h.fileName + '.' : p.reason;
      $('sim-probability-notes').textContent = p.ready ? p.assumption + (h.warnings.length ? ' ' + h.warnings.join(' ') : '') : 'Coverage still uses the entered demand. Inventory report snapshots and decision confidence scores are not treated as sales-history probabilities.';
      $('sim-demand-range').hidden = !p.ready;
      $('sim-demand-range').textContent = p.ready ? 'Demand over lead time + target: median ' + decimal.format(p.medianDemand) + ' units; 90th percentile ' + decimal.format(p.p90Demand) + ' units.' : '';
      $('sim-results').hidden = false;
      $('sim-summary').textContent = 'For ' + row.model + ', ' + integer.format(c.quantity) + ' reorder units give ' + (c.coverageMonths == null ? 'undefined coverage at zero demand.' : decimal.format(c.coverageMonths) + ' months of coverage after arrival. ' + (c.targetMet ? 'Target met.' : 'Below target.'));
    } catch (_) { clearDisplay(); $('sim-results').hidden = true; error('The scenario contains invalid quantities or stock balances. Review the source and the entered values.'); }
  }
})();
