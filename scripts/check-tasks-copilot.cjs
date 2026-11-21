#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const Core = require(path.join(root, 'mk-copilot-core.js'));

// Load system-seed.js in sandbox to get real ERP seed data
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
    id: 'thread-1',
    senderName: 'James Smith',
    senderEmail: 'james.smith@globalpartsco.com',
    subject: 'PO #87366 - Confirmed for Shipment',
    folder: 'inbox',
    direction: 'inbound',
    unread: true,
    snippet: 'The staging bay #4 is allocated and ready...',
    body: 'Please find the confirmation for PO #87366.',
    shipmentDetails: { poNumber: '87366', trackingNumber: 'DHL4567823' },
    related: { poNumber: '#87366', tracking: 'DHL4567823' }
  },
  {
    id: 'thread-2',
    senderName: 'Global Parts Co.',
    senderEmail: 'orders@globalpartsco.com',
    subject: 'Re: 3PL Order – Tracking Request',
    folder: 'inbox',
    direction: 'inbound',
    unread: true,
    snippet: 'Please provide the tracking number for the outbound 3PL transfer consignment.',
    body: 'Hello Support, Please provide the tracking number for the outbound 3PL transfer consignment. Staging bays require registration before midday.',
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
    body: 'Hi Manoj, Please find the 3PL order file attached. Need tracking by EOD to finalize customer dispatch slots.',
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

console.log('Running MK97 Tasks & Autonomous Co-Pilot Verification...');

test('extractTrackingNumber detects real carrier tracking numbers and rejects placeholders', () => {
  assert.strictEqual(Core.extractTrackingNumber('DHL4567823'), 'DHL4567823');
  assert.strictEqual(Core.extractTrackingNumber('Tracking is 1Z999AA10123456784 via UPS'), '1Z999AA10123456784');
  assert.strictEqual(Core.extractTrackingNumber('Carrier TRK772839410192 confirmed'), 'TRK772839410192');
  assert.strictEqual(Core.extractTrackingNumber('FedEx 784512349012'), '784512349012');
  assert.strictEqual(Core.extractTrackingNumber('Pending Dispatch'), '');
  assert.strictEqual(Core.extractTrackingNumber('Need EOD'), '');
  assert.strictEqual(Core.extractTrackingNumber('Please provide tracking number for PO-2026-887411'), '');
});

test('analyzeTaskImportance cross-references PO-2026-887411 across POs, Receipts, Putaway & Orders', () => {
  const state = loadSeedState();
  const task = {
    id: 't_po_esc',
    title: 'Escalation: expedite PO-2026-887411 receiving & release to customer orders',
    notes: 'Sony delivery arrived at Dock D2, coordinate with warehouse & ops.',
    status: 'OPEN',
    priority: 'NORMAL',
    assignees: [Core.DEFAULT_TEAM_ROSTER[1], Core.DEFAULT_TEAM_ROSTER[2]]
  };
  const res = Core.analyzeTaskImportance(task, state, { mailThreads: sampleMails });
  assert.strictEqual(res.tier, 'CRITICAL', `Expected CRITICAL, got ${res.tier} (${res.score})`);
  assert.ok(res.score >= 80, `Expected score >= 80, got ${res.score}`);
  assert.ok(res.references.some(r => r.type === 'VENDOR_PO' && r.code === 'PO-2026-887411'), 'Should link PO-2026-887411');
  assert.ok(res.references.some(r => r.type === 'RECEIPT' && r.id === 'rcv_887411'), 'Should link arrived receipt rcv_887411');
  assert.ok(res.erpSummary.impactedOrders >= 1, 'Should detect downstream impacted Sony customer orders');
});

test('analyzeTaskImportance cross-references AF-200 across Inventory, Cycle Count Variance & Delayed 3PL', () => {
  const state = loadSeedState();
  const task = {
    id: 't_sku',
    title: 'Place vendor PO for AF-200 replenishment',
    notes: 'Check Aura Frames safety stock.',
    status: 'OPEN',
    priority: 'NORMAL',
    assignees: [Core.DEFAULT_TEAM_ROSTER[1], Core.DEFAULT_TEAM_ROSTER[4]]
  };
  const res = Core.analyzeTaskImportance(task, state, { mailThreads: sampleMails });
  assert.ok(res.score >= 65, `Expected high score for low-stock AF-200, got ${res.score}`);
  assert.ok(res.references.some(r => r.type === 'SKU' && r.id === 'PHYS-AURA-CARVER'), 'Should link PHYS-AURA-CARVER');
  assert.ok(res.references.some(r => r.type === 'CYCLE_COUNT' && r.id === 'cc_2'), 'Should link cycle count variance cc_2');
  assert.ok(res.references.some(r => r.type === '3PL' && r.id === 'TPL-SHP-77492'), 'Should link delayed 3PL shipment');
});

test('prioritizeTasks creates accurate ranked priority order (#1 Critical > High > Medium > Low)', () => {
  const state = loadSeedState();
  const list = [
    { id: 't_low', title: 'Organize binder labels in supply closet', notes: '', status: 'OPEN', priority: 'LOW', assignees: [] },
    { id: 't_ord', title: 'Confirm dispatch slot for SO-89108', notes: 'Apex order in packing', status: 'OPEN', priority: 'NORMAL', assignees: [Core.DEFAULT_TEAM_ROSTER[3]] },
    { id: 't_crit', title: 'Urgent escalation on PO-2026-887411 dock hold', notes: 'Blocked Sony units needed for open orders', status: 'OPEN', priority: 'HIGH', assignees: [Core.DEFAULT_TEAM_ROSTER[0], Core.DEFAULT_TEAM_ROSTER[1], Core.DEFAULT_TEAM_ROSTER[2]] },
    { id: 't_done', title: 'Completed archive check', notes: '', status: 'DONE', priority: 'NORMAL', completedAt: new Date().toISOString() }
  ];
  const ranked = Core.prioritizeTasks(list, state, { mailThreads: sampleMails });
  const active = ranked.filter(x => x.task.status !== 'DONE');
  assert.strictEqual(active[0].task.id, 't_crit');
  assert.strictEqual(active[0].analysis.rank, 1);
  assert.strictEqual(active[active.length - 1].task.id, 't_low');
  assert.strictEqual(active[active.length - 1].analysis.rank, 3);
  assert.ok(active[0].analysis.score > active[1].analysis.score && active[1].analysis.score > active[2].analysis.score);
  assert.strictEqual(ranked.find(x => x.task.id === 't_done').analysis.rank, null);
});

test('reconcileAutonomousTasks auto-creates low-stock Vendor PO task & auto-resolves once Vendor PO is placed', () => {
  const state = loadSeedState();
  const scan1 = Core.reconcileAutonomousTasks(state, []);
  const poTask = state.tasks.find(t => t.autoKey === 'auto:po:PHYS-AURA-CARVER');
  assert.ok(poTask, 'Should auto-create Vendor PO task for low-stock PHYS-AURA-CARVER (AF-200)');
  assert.strictEqual(poTask.status, 'OPEN');
  assert.ok(poTask.assignees.length >= 2, 'Should auto-assign 2+ procurement/planning team members');

  // Idempotency check
  const scan1b = Core.reconcileAutonomousTasks(state, []);
  assert.strictEqual(scan1b.created.length, 0, 'Second scan must not duplicate tasks');

  // Now place a covering Vendor PO for PHYS-AURA-CARVER (45 units)
  state.enterprise.purchaseOrders.push({
    id: 'vpo_test_af200',
    vendorId: 'vend_sony',
    po: 'PO-2026-990001',
    status: 'PO_ISSUED',
    issuedAt: new Date().toISOString(),
    eta: new Date(Date.now() + 5 * 86400000).toISOString(),
    lines: [{ sku: 'PHYS-AURA-CARVER', qty: 45, received: 0, cost: 126 }]
  });

  const scan2 = Core.reconcileAutonomousTasks(state, []);
  assert.ok(scan2.resolved.some(r => r.autoKey === 'auto:po:PHYS-AURA-CARVER'), 'Should auto-resolve low-stock task once PO placed');
  assert.strictEqual(poTask.status, 'DONE');
  assert.strictEqual(poTask.autoResolved, true);
  assert.ok(poTask.autoResolvedReason.includes('45'), 'Auto-resolve reason should cite inbound PO coverage');

  // Must not respawn on subsequent scan
  const scan3 = Core.reconcileAutonomousTasks(state, []);
  assert.strictEqual(scan3.created.filter(c => c.autoKey === 'auto:po:PHYS-AURA-CARVER').length, 0);
});

test('reconcileAutonomousTasks auto-creates Tracking Request tasks from received Mail & auto-disappears when tracking replied', () => {
  const state = loadSeedState();
  const mails = sampleMails.map(m => ({ ...m, related: { ...m.related }, shipmentDetails: m.shipmentDetails ? { ...m.shipmentDetails } : undefined }));
  const scan1 = Core.reconcileAutonomousTasks(state, mails);

  // thread-2 & thread-6 request tracking; thread-1 already has DHL4567823
  const trk2 = state.tasks.find(t => t.autoKey === 'auto:tracking:thread-2');
  const trk6 = state.tasks.find(t => t.autoKey === 'auto:tracking:thread-6');
  const trk1 = state.tasks.find(t => t.autoKey === 'auto:tracking:thread-1');
  assert.ok(trk2 && trk2.status === 'OPEN', 'Should create tracking task for thread-2');
  assert.ok(trk6 && trk6.status === 'OPEN', 'Should create tracking task for thread-6');
  assert.strictEqual(trk1, undefined, 'Must NOT create tracking task for thread-1 (already has tracking DHL4567823)');
  assert.ok(trk2.assignees.length >= 2, 'Should involve 2+ logistics people');

  // Simulate sending an outbound Mail reply to thread-2 with tracking number DHL9988776
  mails.unshift({
    id: 'reply-test-1',
    senderName: 'Manoj Manne',
    senderEmail: 'supply.chain@mk97.com',
    to: 'orders@globalpartsco.com',
    subject: 'Re: 3PL Order – Tracking Request',
    folder: 'sent',
    direction: 'outbound',
    replyToThreadId: 'thread-2',
    body: 'Hi team, tracking number for #3PL-GP-918 is DHL9988776 via DHL Express.'
  });

  const scan2 = Core.reconcileAutonomousTasks(state, mails);
  assert.ok(scan2.resolved.some(r => r.autoKey === 'auto:tracking:thread-2'), 'Should auto-resolve thread-2 task when tracking reply is sent');
  assert.strictEqual(trk2.status, 'DONE', 'thread-2 task must disappear from Active (marked DONE)');
  assert.strictEqual(trk2.autoResolved, true);
  assert.ok(trk2.autoResolvedReason.includes('DHL9988776'), 'Auto-resolved reason should include verified tracking number');
  assert.strictEqual(trk6.status, 'OPEN', 'Unrelated thread-6 tracking task must remain OPEN until its tracking is provided');

  // Verify it stays disappeared on next scan
  const scan3 = Core.reconcileAutonomousTasks(state, mails);
  assert.strictEqual(state.tasks.filter(t => t.autoKey === 'auto:tracking:thread-2' && t.status !== 'DONE').length, 0);
});

test('reconcileAutonomousTasks auto-creates Delayed 3PL Shipment task & auto-resolves when tracking populated', () => {
  const state = loadSeedState();
  Core.reconcileAutonomousTasks(state, []);
  const tplTask = state.tasks.find(t => t.autoKey === 'auto:3pl-delay:TPL-SHP-77492');
  assert.ok(tplTask && tplTask.status === 'OPEN', 'Should create task for delayed 3PL shipment TPL-SHP-77492');

  const shp = state.logistics.tplShipments.find(s => s.id === 'TPL-SHP-77492');
  shp.tracking = 'FDX774920011';
  shp.status = 'DISPATCHED';

  const scan2 = Core.reconcileAutonomousTasks(state, []);
  assert.ok(scan2.resolved.some(r => r.autoKey === 'auto:3pl-delay:TPL-SHP-77492'));
  assert.strictEqual(tplTask.status, 'DONE');
  assert.strictEqual(tplTask.autoResolved, true);
});

test('reconcileAutonomousTasks honors dismissedAutoKeys until reset', () => {
  const state = loadSeedState();
  state.taskMeta.dismissedAutoKeys.push('auto:po:PHYS-AURA-CARVER');
  Core.reconcileAutonomousTasks(state, []);
  assert.strictEqual(state.tasks.find(t => t.autoKey === 'auto:po:PHYS-AURA-CARVER'), undefined, 'Dismissed auto-task must not respawn');

  Core.reconcileAutonomousTasks(state, [], { resetDismissed: true });
  assert.ok(state.tasks.find(t => t.autoKey === 'auto:po:PHYS-AURA-CARVER'), 'resetDismissed should allow recreation');
});

console.log(`\n${passed} passed, ${process.exitCode ? 'with failures' : '0 failed'}.`);
