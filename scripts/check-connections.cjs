#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const Conn = require(path.join(root, 'connections-core.js'));

function loadSeedState() {
  const code = fs.readFileSync(path.join(root, 'system-seed.js'), 'utf8');
  const ctx = { window: {}, Date, Math, Array, Number, String, Object };
  vm.runInNewContext(code, ctx);
  const seeds = ctx.window.StarkSystemSeeds;
  return {
    region: 'US',
    enterprise: seeds.enterprise(),
    logistics: seeds.logistics(),
    tasks: []
  };
}

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

console.log('Running MK97 Connections Module (EDI X12 & API Gateway) Verification...');

test('seedConnections provides pre-configured EDI & API connections and audit logs', () => {
  const data = Conn.seedConnections();
  assert.ok(data.connections.length >= 6);
  assert.ok(data.connections.some(c => c.category === 'EDI'));
  assert.ok(data.connections.some(c => c.category === 'API'));
  const sum = Conn.summarizeConnections(data);
  assert.strictEqual(sum.total, data.connections.length);
  assert.ok(sum.ediCount >= 3 && sum.apiCount >= 3);
});

test('PARTNER_TEMPLATES covers universal EDI (Amazon, Walmart, SPS, 3PL, Custom) and REST/Webhook APIs', () => {
  const ediT = Conn.PARTNER_TEMPLATES.filter(t => t.category === 'EDI');
  const apiT = Conn.PARTNER_TEMPLATES.filter(t => t.category === 'API');
  assert.ok(ediT.length >= 5);
  assert.ok(apiT.length >= 5);
  assert.ok(ediT.some(t => t.id === 'tpl_custom_edi'));
  assert.ok(apiT.some(t => t.id === 'tpl_custom_api'));
});

test('generateX12Document builds valid standards-compliant 850, 855, 856, 810, 846, 940, 945 & 997 ACK', () => {
  const state = loadSeedState();
  const data = Conn.seedConnections();
  const partner = data.connections.find(c => c.category === 'EDI');

  for (const docType of ['850', '855', '856', '810', '846', '940', '945']) {
    const doc = Conn.generateX12Document({ docType, partner, sender: data.ourProfile, state });
    assert.ok(doc.raw.startsWith('ISA*00*'), `${docType} should start with ISA header`);
    assert.ok(doc.raw.includes(`ST*${docType}*0001~`), `${docType} should include ST header`);
    assert.ok(doc.raw.includes(`IEA*1*${doc.controlNumber}~`), `${docType} should close with matching IEA`);
    assert.ok(doc.ack997 && doc.ack997.includes('ST*997*0001~') && doc.ack997.includes('AK9*A*1*1*1~'), `${docType} should generate 997 Accepted ACK`);
    const parsed = Conn.parseX12Document(doc.raw);
    assert.strictEqual(parsed.valid, true, `${docType} should round-trip validate cleanly`);
    assert.strictEqual(parsed.docType, docType);
  }
});

test('parseX12Document translates inbound 850 PO & 856 ASN segments and catches invalid envelopes', () => {
  const state = loadSeedState();
  const data = Conn.seedConnections();
  const asn = Conn.generateX12Document({ docType: '856', partner: data.ourProfile, sender: { isaQualifier: '12', isaId: '5125550199', gsId: 'KENDRASCOTT' }, state });
  const pAsn = Conn.parseX12Document(asn.raw);
  assert.strictEqual(pAsn.valid, true);
  assert.strictEqual(pAsn.docType, '856');
  assert.ok(pAsn.lines.length >= 1);
  assert.ok(pAsn.tracking.length >= 4);

  const bad = Conn.parseX12Document('BROKEN*DATA~');
  assert.strictEqual(bad.valid, false);
  assert.ok(bad.errors.length >= 1);
});

test('applyFieldMapping transforms MK97 ERP records into nested custom partner JSON with transforms', () => {
  const mapped = Conn.applyFieldMapping(
    { po: 'po-2026-991', customerName: 'Northstar', inHandsDate: '2026-12-01T15:00:00Z', available: '42' },
    [
      { source: 'po', target: 'order_ref', transform: 'UPPERCASE' },
      { source: 'customerName', target: 'buyer.company', transform: 'STRING' },
      { source: 'inHandsDate', target: 'ship_by', transform: 'ISO_DATE' },
      { source: 'available', target: 'stock.qty', transform: 'NUMBER' }
    ]
  );
  assert.strictEqual(mapped.order_ref, 'PO-2026-991');
  assert.strictEqual(mapped.buyer.company, 'Northstar');
  assert.strictEqual(mapped.ship_by, '2026-12-01');
  assert.strictEqual(mapped.stock.qty, 42);
});

test('buildLiveErpPayload builds live ORDER, PO, INVENTORY, TPL & HEALTH payloads from ERP state', () => {
  const state = loadSeedState();
  for (const kind of ['ORDER', 'PO', 'INVENTORY', 'TPL', 'HEALTH']) {
    const p = Conn.buildLiveErpPayload(kind, state);
    assert.ok(p && p.event && p.sentAt, `${kind} payload should include event and sentAt`);
  }
  const inv = Conn.buildLiveErpPayload('INVENTORY', state);
  assert.ok(inv.inventory.length >= 3);
});

test('generateCodeSnippets generates valid cURL, JS fetch & Python requests snippets', () => {
  const s = Conn.generateCodeSnippets(
    { method: 'POST', endpoint: 'https://api.example.com/v1/orders', authType: 'BEARER', authSecret: 'tok_123' },
    { event: 'mk97.order.sync' }
  );
  assert.ok(s.curl.includes('curl -X POST') && s.curl.includes('Bearer tok_123'));
  assert.ok(s.js.includes('await fetch("https://api.example.com/v1/orders"'));
  assert.ok(s.py.includes('requests.post('));
});

if (process.exitCode) {
  console.error(`\nFailed! (${passed} passed)`);
} else {
  console.log(`\n${passed} passed, 0 failed.`);
}
