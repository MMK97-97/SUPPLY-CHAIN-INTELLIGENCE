#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const Core = require(path.join(root, 'mk-copilot-core.js'));

function loadSeedState() {
  const code = fs.readFileSync(path.join(root, 'system-seed.js'), 'utf8');
  const ctx = { window: {}, Date, Math, Array, Number, String, Object };
  vm.runInNewContext(code, ctx);
  const seeds = ctx.window.StarkSystemSeeds;
  return {
    revision: 1,
    enterprise: seeds.enterprise(),
    logistics: seeds.logistics(),
    invoiceReviews: [],
    customerReturns: [],
    tasks: [],
    taskMeta: { dismissedAutoKeys: [] }
  };
}

function loadAnalyticsSeed() {
  const code = fs.readFileSync(path.join(root, 'inventory-analysis-seed.js'), 'utf8');
  const ctx = { window: {} };
  vm.runInNewContext(code, ctx);
  return ctx.window.STARK_INVENTORY_ANALYSIS_SEED;
}

const sampleMails = [
  {
    id: 'thread-2',
    senderName: 'Global Parts Co.',
    senderEmail: 'orders@globalpartsco.com',
    subject: 'Re: 3PL Order – Tracking Request',
    folder: 'inbox',
    direction: 'inbound',
    unread: true,
    snippet: 'Please provide the tracking number for the outbound 3PL transfer consignment.',
    body: 'Hello Support, Please provide the tracking number for the outbound 3PL transfer consignment.',
    related: { poNumber: '#3PL-GP-918', tracking: 'Pending Dispatch' }
  }
];

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

console.log('Running MK v7.0 Quantitative Analyst & Autonomous Co-Pilot Verification...');
const analyticsSeed = loadAnalyticsSeed();

test('analyzeFinancialsAndMargin computes gross margin %, profit, working capital, credit risk & CSV', () => {
  const state = loadSeedState();
  const res = Core.analyzeFinancialsAndMargin(state, analyticsSeed);
  assert.ok(res.markdown.includes('Gross Margin') || res.markdown.includes('GM'));
  assert.ok(res.markdown.includes('Meridian Recognition'), 'Should flag Meridian credit risk');
  assert.strictEqual(res.chart.type, 'bars');
  assert.ok(res.chart.items.length >= 4);
  assert.ok(res.table.rows.length >= 4);
  assert.ok(res.csv.content.includes('SKU / Model'));
  assert.strictEqual(res.metrics.length, 4);
});

test('analyzeDemandForecast forecasts specific 1,885-SKU historical model (AF903-MBLK) with ROP, EOQ & SVG sparkline', () => {
  const state = loadSeedState();
  const res = Core.analyzeDemandForecast('Forecast demand for AF903-MBLK', state, analyticsSeed);
  assert.ok(res.markdown.includes('AF903-MBLK'), 'Should match AF903-MBLK');
  assert.ok(res.markdown.includes('EOQ') && res.markdown.includes('Reorder Point'));
  assert.strictEqual(res.chart.type, 'sparkline');
  assert.strictEqual(res.chart.actual.length, 13);
  assert.strictEqual(res.chart.forecast.length, 3);
  assert.ok(res.csv.content.includes('Forecast'));
});

test('analyzeDemandForecast forecasts live ERP SKU (WH1000XM5) and aggregates 1,885-SKU portfolio curve', () => {
  const state = loadSeedState();
  const live = Core.analyzeDemandForecast('Forecast WH1000XM5', state, analyticsSeed);
  assert.ok(live.markdown.includes('WH1000XM5') && live.chart.type === 'sparkline');
  const port = Core.analyzeDemandForecast('Forecast portfolio demand across all SKUs', state, analyticsSeed);
  assert.ok(port.markdown.includes('1,885'), 'Should aggregate all 1,885 historical SKUs');
  assert.strictEqual(port.chart.actual.length, 13);
  assert.strictEqual(port.chart.forecast.length, 3);
  assert.ok(port.table.rows.length >= 5);
});

test('analyzeAbcXyzAndPareto classifies 3,955 SKU sales into ABC-XYZ & computes Top-5 Brand / Customer HHI', () => {
  const state = loadSeedState();
  const res = Core.analyzeAbcXyzAndPareto(state, analyticsSeed);
  assert.ok(res.markdown.includes('Class A') && res.markdown.includes('HHI'));
  assert.strictEqual(res.chart.type, 'stacked');
  assert.strictEqual(res.chart.segments.length, 3);
  assert.ok(res.table.rows[0][1] === 'Marc Jacobs', 'Marc Jacobs should be #1 Pareto brand');
  assert.ok(res.csv.filename.endsWith('.csv'));
});

test('detectAnomaliesAndRisks computes 0-100 ERP Health Score, live ERP bottlenecks & Z-score catalog spikes', () => {
  const state = loadSeedState();
  Core.reconcileAutonomousTasks(state, sampleMails);
  const res = Core.detectAnomaliesAndRisks(state, analyticsSeed, sampleMails);
  assert.ok(res.healthScore >= 15 && res.healthScore <= 100);
  assert.ok(res.markdown.includes('AF-200') && res.markdown.includes('TPL-SHP-77492'));
  assert.ok(res.markdown.includes('Kendra Scott') && res.markdown.includes('Meridian Recognition'));
  assert.ok(res.markdown.includes('Z ≥ 2.3σ') || res.markdown.includes('Statistical Outlier'));
  assert.strictEqual(res.chart.type, 'stacked');
  assert.ok(res.table.rows.length >= 5);
});

test('analyzeBrandOrCustomerDeepDive inspects Marc Jacobs, Workhuman & Top Leaderboards with charts', () => {
  const state = loadSeedState();
  const mj = Core.analyzeBrandOrCustomerDeepDive('Analyze brand Marc Jacobs', state, analyticsSeed);
  assert.ok(mj.markdown.includes('Marc Jacobs') && mj.markdown.includes('#1'));
  assert.strictEqual(mj.chart.type, 'sparkline');
  assert.strictEqual(mj.chart.actual.length, 12);

  const wh = Core.analyzeBrandOrCustomerDeepDive('Analyze customer Workhuman', state, analyticsSeed);
  assert.ok(wh.markdown.includes('Workhuman') && wh.markdown.includes('#1'));
  assert.strictEqual(wh.chart.type, 'sparkline');

  const topC = Core.analyzeBrandOrCustomerDeepDive('Analyze top customers', state, analyticsSeed);
  assert.strictEqual(topC.chart.type, 'bars');
  assert.ok(topC.table.rows[0][1] === 'Workhuman');
});

test('compareEntities runs head-to-head Brand, Customer & Vendor SLA comparisons', () => {
  const state = loadSeedState();
  const bCmp = Core.compareEntities('Compare Marc Jacobs vs Gucci', state, analyticsSeed);
  assert.ok(bCmp.markdown.includes('Marc Jacobs') && bCmp.markdown.includes('Gucci'));
  assert.strictEqual(bCmp.chart.items.length, 2);

  const cCmp = Core.compareEntities('Compare Workhuman vs Purchasing Power', state, analyticsSeed);
  assert.ok(cCmp.markdown.includes('Workhuman') && cCmp.markdown.includes('Purchasing Power'));

  const vCmp = Core.compareEntities('Compare vendors', state, analyticsSeed);
  assert.ok(vCmp.markdown.includes('Kendra Scott') && vCmp.chart.type === 'bars');
});

test('optimizeFulfillmentAnd3PL scores Local DC vs 3PL nodes by landed cost, zone & SLA', () => {
  const state = loadSeedState();
  const res = Core.optimizeFulfillmentAnd3PL('Optimize fulfillment for 25 WH1000XM5 to CA', state);
  assert.ok(res.markdown.includes('WH1000XM5') && res.markdown.includes('CA (WEST)'));
  assert.strictEqual(res.chart.type, 'bars');
  assert.ok(res.table.rows.length >= 3);
  assert.ok(res.metrics[1].value.startsWith('$'));
});

test('buildAutopilotPlan prepares multi-step remediation (scan + covering PO + dock receipt + reminder)', () => {
  const state = loadSeedState();
  Core.reconcileAutonomousTasks(state, sampleMails);
  const plan = Core.buildAutopilotPlan(state, sampleMails);
  assert.ok(plan.steps.some(s => s.kind === 'ISSUE_PO' && s.model === 'AF-200'));
  assert.ok(plan.steps.some(s => s.kind === 'RECEIVE_PO' && s.po === 'PO-2026-887411'));
  assert.ok(plan.steps.some(s => s.kind === 'REMIND_TOP'));
  assert.ok(plan.actions.some(a => a.prompt === 'Execute full autopilot now'));
});

test('parseEmailDraftCommand drafts data-backed vendor SLA, customer credit, and fallback named emails', () => {
  const state = loadSeedState();
  const vDraft = Core.parseEmailDraftCommand('Draft email to Kendra Scott about late PO delivery', state, sampleMails);
  assert.ok(vDraft && vDraft.toName.includes('Kendra Scott') && vDraft.body.includes('88.5%'));
  const cDraft = Core.parseEmailDraftCommand('Draft email to Meridian about credit review', state, sampleMails);
  assert.ok(cDraft && cDraft.toName.includes('Meridian') && cDraft.body.includes('91%'));
  // Fallback in Demo mode when named recipient is outside fictional vendor list
  const demoState = { enterprise: { vendors: [], accounts: [], orders: [], purchaseOrders: [], slaLogs: [] } };
  const fDraft = Core.parseEmailDraftCommand('Draft email to Kendra Scott about late PO delivery', demoState, []);
  assert.ok(fDraft && fDraft.toName === 'Kendra Scott' && fDraft.subject.includes('Late PO delivery'));
});

test('buildVendorPOForItem creates distinct covering POs for distinct SKUs', () => {
  const state = loadSeedState();
  const inv = state.enterprise.inventory.slice(0, 2);
  const p1 = Core.buildVendorPOForItem(inv[0], 0, state, 0);
  const p2 = Core.buildVendorPOForItem(inv[1], 0, state, 1);
  assert.notStrictEqual(p1.item.sku, p2.item.sku);
  assert.notStrictEqual(p1.poNumber, p2.poNumber);
});

if (process.exitCode) {
  console.error(`\nFailed! (${passed} passed)`);
} else {
  console.log(`\n${passed} passed, 0 failed.`);
}
