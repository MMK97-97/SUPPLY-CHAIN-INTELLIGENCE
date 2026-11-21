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
  },
  {
    id: 'thread-6',
    senderName: 'Vince Inc.',
    senderEmail: 'vince.support@vinceinc.com',
    subject: '3PL Orders – Priority',
    folder: 'inbox',
    direction: 'inbound',
    unread: true,
    snippet: 'Please find the 3PL order file. Need tracking by EOD.',
    body: 'Need tracking by EOD to finalize customer dispatch slots.',
    related: { poNumber: '#VI-PRIORITY-91', tracking: 'Need EOD' }
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

console.log('Running MK v6.0 Autonomous Command & Live ERP Intelligence Verification...');

test('getLivePulse accurately summarizes low stock, 3PL delays, dock arrivals, vendor alerts & tracking requests', () => {
  const state = loadSeedState();
  Core.reconcileAutonomousTasks(state, sampleMails);
  const pulse = Core.getLivePulse(state, sampleMails);
  assert.strictEqual(pulse.lowStockCount, 1);
  assert.strictEqual(pulse.delayedTplCount, 1);
  assert.strictEqual(pulse.pendingTrackingCount, 2);
  assert.strictEqual(pulse.arrivedReceiptsCount, 1);
  assert.strictEqual(pulse.vendorWarningsCount, 1);
  assert.strictEqual(pulse.activeTasks, 4);
});

test('buildExecutiveBriefing produces cross-ERP summary, live metrics, and 1-click PO & reminder actions', () => {
  const state = loadSeedState();
  Core.reconcileAutonomousTasks(state, sampleMails);
  const brief = Core.buildExecutiveBriefing(state, sampleMails);
  assert.ok(brief.markdown.includes('AF-200'), 'Should flag AF-200 low stock');
  assert.ok(brief.markdown.includes('TPL-SHP-77492'), 'Should flag delayed 3PL');
  assert.ok(brief.markdown.includes('Kendra Scott'), 'Should flag Kendra Scott compliance warning');
  assert.ok(brief.markdown.includes('Meridian Recognition'), 'Should flag credit review account');
  assert.ok(brief.metrics.length >= 4);
  assert.ok(brief.actions.some(a => a.prompt && a.prompt.includes('AF-200')), 'Should include 1-click PO action for AF-200');
});

test('queryLiveInventory fuzzy-matches WH-1000XM6 to live WH1000XM5 and computes AF-200 deficit without CSV', () => {
  const state = loadSeedState();
  const xm = Core.queryLiveInventory('Check inventory for WH-1000XM6', state);
  assert.ok(xm.markdown.includes('WH1000XM5'), 'Should fuzzy-match Sony WH1000XM5');
  assert.ok(xm.markdown.includes('PO-2026-887411'), 'Should show inbound PO-2026-887411');
  assert.ok(xm.markdown.includes('EAST: 84'), 'Should show 3PL network stock split');

  const low = Core.queryLiveInventory('Check low stock radar', state);
  assert.ok(low.markdown.includes('AF-200') && low.markdown.includes('SHORT 13'));
  assert.ok(low.actions.some(a => a.prompt && a.prompt.includes('Place a vendor PO')));
});

test('queryLiveOrders filters by brand (Sony), order number (SO-89108) & exposes CRM credit alerts', () => {
  const state = loadSeedState();
  const sony = Core.queryLiveOrders('Show open orders for Sony', state);
  assert.ok(sony.markdown.includes('#87366-HOLD') && sony.markdown.includes('#PO-2026-89108'));
  const credit = Core.queryLiveOrders('Check customer credit review accounts', state);
  assert.ok(credit.markdown.includes('Meridian Recognition') && credit.markdown.includes('91%'));
});

test('queryLiveVendors ranks supplier SLAs and inspects specific PO-2026-887411 with dock receipt & putaway', () => {
  const state = loadSeedState();
  const perf = Core.queryLiveVendors('Summarize vendor performance', state);
  assert.ok(perf.markdown.includes('Kendra Scott Wholesale') && perf.markdown.includes('88.5%'));
  const po = Core.queryLiveVendors('Analyze PO-2026-887411', state);
  assert.ok(po.markdown.includes('rcv_887411') && po.markdown.includes('put_1'));
});

test('queryLiveLogistics3PL reports delayed 3PL shipments, dock arrivals, open putaway & cycle counts', () => {
  const state = loadSeedState();
  const res = Core.queryLiveLogistics3PL('Show 3PL delays and warehouse status', state);
  assert.ok(res.markdown.includes('West Coast 3PL') && res.markdown.includes('TPL-SHP-77492') && res.markdown.includes('put_1'));
});

test('parseNaturalTaskCommand extracts title, multiple named assignees, external email & due date', () => {
  const parsed = Core.parseNaturalTaskCommand('Create task for PO-2026-887411 escalation with Elena and Marcus and ops@partner.com due tomorrow');
  assert.ok(parsed.title.includes('PO-2026-887411 escalation'), `Got title: ${parsed.title}`);
  assert.ok(parsed.assignees.some(a => a.name === 'Elena Rostova'));
  assert.ok(parsed.assignees.some(a => a.name === 'Marcus Vance'));
  assert.ok(parsed.assignees.some(a => a.email === 'ops@partner.com'));
  assert.strictEqual(parsed.assignees.length, 3);
  assert.ok(Date.parse(parsed.dueAt) > Date.now());
  assert.ok(Date.parse(parsed.reminderAt) <= Date.parse(parsed.dueAt));
});

test('parseVendorPOCommand parses SKU, quantity, vendor & pronoun follow-up', () => {
  const state = loadSeedState();
  const cmd = Core.parseVendorPOCommand('Place a vendor PO for AF-200 for 45 units', state);
  assert.strictEqual(cmd.item.sku, 'PHYS-AURA-CARVER');
  assert.strictEqual(cmd.qty, 45);
  assert.strictEqual(cmd.totalCost, 45 * 126);

  const follow = Core.parseVendorPOCommand('Order 60 units of it', state, { type: 'SKU', id: 'PHYS-AURA-CARVER' });
  assert.strictEqual(follow.item.sku, 'PHYS-AURA-CARVER');
  assert.strictEqual(follow.qty, 60);
});

test('parseTrackingUpdateCommand resolves Mail threads, 3PL shipments & Customer Orders cleanly', () => {
  const state = loadSeedState();
  const m = Core.parseTrackingUpdateCommand('Provide tracking DHL9988776 for #3PL-GP-918', state, sampleMails);
  assert.strictEqual(m.targetType, 'MAIL');
  assert.strictEqual(m.targetId, 'thread-2');
  assert.strictEqual(m.tracking, 'DHL9988776');

  const shp = Core.parseTrackingUpdateCommand('Update tracking FDX774920011 for TPL-SHP-77492', state, sampleMails);
  assert.strictEqual(shp.targetType, '3PL');
  assert.strictEqual(shp.targetId, 'TPL-SHP-77492');
  assert.strictEqual(shp.tracking, 'FDX774920011');

  const ord = Core.parseTrackingUpdateCommand('Set tracking 1Z999AA10123456784 on SO-89108', state, sampleMails);
  assert.strictEqual(ord.targetType, 'ORDER');
  assert.strictEqual(ord.targetId, 'ord_firm_89108');
  assert.strictEqual(ord.tracking, '1Z999AA10123456784');
});

test('simulateLiveInventoryScenario computes demand increase impact without CSV upload', () => {
  const state = loadSeedState();
  const sim = Core.simulateLiveInventoryScenario('What if demand increases 50% for AF-200?', state);
  assert.ok(sim && sim.markdown.includes('AF-200') && sim.markdown.includes('safety 42'));
});

console.log(`\n${passed} passed, ${process.exitCode ? 'with failures' : '0 failed'}.`);
