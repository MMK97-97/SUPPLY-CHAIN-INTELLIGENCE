/* Read-only planning calculations. No storage, inventory mutation or network. */
(function (root, factory) {
  'use strict';
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.StarkReorderModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const EPS = 1e-8, MIN_MONTHS = 6;
  function value(input, name, min, max, integer = false) {
    const n = Number(input);
    if (input == null || String(input).trim() === '' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
      throw new RangeError(name + ' must be ' + (integer ? 'a whole number' : 'a number') + ' from ' + min + ' to ' + max + '.');
    }
    return n;
  }
  const ceil = n => Math.max(0, Math.ceil(n - EPS));
  function coverage(input) {
    const netStock = value(input.netStock, 'Net stock', -1e12, 1e12);
    const quantity = value(input.quantity, 'Reorder quantity', 0, 1e9, true);
    const demand = value(input.demand, 'Monthly demand', 0, 1e9);
    const leadDays = value(input.leadDays, 'Arrival lead time', 0, 730);
    const targetMonths = value(input.targetMonths, 'Target coverage', .1, 24);
    const buffer = value(input.buffer, 'Minimum stock buffer', 0, 1e9, true);
    const inbound = value(input.inbound ?? 0, 'Included inbound', 0, 1e12);
    const leadMonths = leadDays / 30, leadDemand = demand * leadMonths;
    const receiptNet = netStock - leadDemand + quantity + inbound;
    const atReceipt = Math.max(0, receiptNet);
    const targetUnits = demand * targetMonths + buffer;
    return Object.freeze({ netStock, quantity, demand, leadDays, leadMonths, targetMonths, buffer, inbound, leadDemand,
      receiptNet, atReceipt, backlogAtReceipt: Math.max(0, -receiptNet),
      currentCoverage: demand > 0 ? Math.max(0, netStock) / demand : null,
      coverageMonths: demand > 0 ? atReceipt / demand : null,
      usableCoverage: demand > 0 ? Math.max(0, atReceipt - buffer) / demand : null,
      preArrivalGap: leadDays > 0 ? Math.max(0, leadDemand - netStock) : 0,
      targetUnits, targetMet: receiptNet + EPS >= targetUnits,
      requiredQuantity: ceil(targetUnits + leadDemand - netStock - inbound)
    });
  }
  const key = model => String(model ?? '').trim().toUpperCase();
  function history(saved, model, region, now = new Date()) {
    const unavailable = (reason, months = []) => ({ ready: false, reason, months, values: [] });
    if (saved?.region && key(saved.region) !== key(region)) return unavailable('Sales history belongs to another region.');
    const sales = saved?.sales;
    if (!Array.isArray(sales?.rows)) return unavailable('Upload monthly sales history for this region in Sales Analysis.');
    const matches = sales.rows.filter(row => key(row.model) === key(model));
    if (matches.length !== 1) return unavailable(matches.length ? 'More than one sales record matches this model. Resolve the duplicate first.' : 'No matching monthly sales history for this model.');
    const today = new Date(now);
    if (!Number.isFinite(today.getTime())) throw new RangeError('Use a valid observation date.');
    const currentMonth = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0');
    const monthly = matches[0].monthly || {};
    const months = Object.keys(monthly).filter(period => /^\d{4}(0[1-9]|1[0-2])$/.test(period) && period < currentMonth).sort().slice(-24);
    const values = months.map(period => monthly[period]);
    if (values.some(n => n == null || String(n).trim() === '' || !Number.isFinite(Number(n)) || Number(n) < 0 || Number(n) > 1e9)) return unavailable('Monthly sales contain missing, negative or invalid units. Correct the source report.', months);
    if (months.length < MIN_MONTHS) return unavailable('Need at least six complete sales months; ' + months.length + ' available. Current and future months are excluded.', months);
    const numbers = values.map(Number), mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    if (mean <= 0) return unavailable('No positive demand in the complete sales history. A probability is not estimated.', months);
    const warnings = [];
    const monthIndex = p => Number(p.slice(0, 4)) * 12 + Number(p.slice(4, 6)) - 1;
    if (months.some((p, i) => i > 0 && monthIndex(p) - monthIndex(months[i - 1]) !== 1)) warnings.push('There are gaps between recorded months.');
    if (monthIndex(currentMonth) - monthIndex(months[months.length - 1]) > 3) warnings.push('The latest complete sales month is more than three months old.');
    return { ready: true, reason: '', months, values: numbers, mean, warnings, fileName: sales.fileName || 'Monthly sales report' };
  }
  function random(seed) {
    let state = 2166136261;
    for (const c of String(seed)) { state ^= c.charCodeAt(0); state = Math.imul(state, 16777619); }
    return () => { state += 0x6D2B79F5; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function probability(input, evidence, options = {}) {
    const c = coverage(input);
    if (!evidence?.ready) return { ready: false, reason: evidence?.reason || 'Need at least six complete sales months.' };
    if (c.demand <= 0) return { ready: false, reason: 'Enter positive monthly demand to estimate a coverage probability.' };
    const values = evidence.values;
    if (!Array.isArray(values) || values.length < MIN_MONTHS || values.length > 24 || values.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e9)) return { ready: false, reason: 'Complete monthly sales history is invalid.' };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean <= 0) return { ready: false, reason: 'No positive sales demand to sample.' };
    const paths = value(options.paths ?? 2000, 'Simulation paths', 500, 10000, true);
    // Common sampled paths for every quantity: a larger reorder cannot reduce success.
    const draw = random(JSON.stringify([options.seed || '', evidence.months, values, c.demand, c.leadMonths, c.targetMonths]));
    const scale = c.demand / mean, horizon = c.leadMonths + c.targetMonths;
    const horizonDemands = [], capacity = c.netStock + c.quantity + c.inbound - c.buffer;
    let successes = 0, preArrivalStockouts = 0;
    for (let path = 0; path < paths; path++) {
      let total = 0, beforeArrival = 0;
      for (let month = 0; month < Math.ceil(horizon); month++) {
        const units = values[Math.floor(draw() * values.length)] * scale;
        total += units * Math.max(0, Math.min(1, horizon - month));
        beforeArrival += units * Math.max(0, Math.min(1, c.leadMonths - month));
      }
      const leadStockout = c.leadDays > 0 && beforeArrival > c.netStock + EPS;
      if (leadStockout) preArrivalStockouts++;
      if (!leadStockout && total <= capacity + EPS) successes++;
      horizonDemands.push(total);
    }
    horizonDemands.sort((a, b) => a - b);
    const quantile = q => horizonDemands[Math.min(paths - 1, Math.ceil(q * paths) - 1)];
    return Object.freeze({ ready: true, paths, successes, success: successes / paths, preArrivalRisk: preArrivalStockouts / paths,
      medianDemand: quantile(.5), p90Demand: quantile(.9), months: values.length, scale,
      assumption: 'Independent monthly draws from complete sales history, scaled to the entered monthly demand. Demand is spread evenly within each 30-day planning month. Reorder and selected inbound arrive together at the entered lead time. Success requires no stockout before arrival and the minimum stock buffer after the target horizon. This conditional estimate is not a calibrated forecast.'
    });
  }
  return Object.freeze({ coverage, history, probability, MIN_MONTHS });
});
