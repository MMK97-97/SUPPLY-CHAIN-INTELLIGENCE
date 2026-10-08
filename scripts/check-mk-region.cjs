/* Regional AI regression checks. Synthetic reports and jsdom; no browser or live inference. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { boot } = require('./check-interface.cjs');
const root = path.resolve(__dirname, '..'), passed = [], failures = [];
const tick = () => new Promise(resolve => setImmediate(resolve));
const oldReply = region => ({ answer: region + ' saved answer', mode: 'local', findings: [], actions: [], assumptions: [], questions: [], evidence: [], tools: [], capturedAt: '2026-10-08T12:00:00Z' });
function options(region = 'US', savedScope = 'US', search = '') {
  const localStorage = { 'stark-selected-region': region, 'mk-analyst-v4': JSON.stringify({ aiEnabled: false, monitor: false, scope: savedScope, messages: ['US', 'EU', 'CA'].flatMap(scope => [{ role: 'user', content: scope + ' previous question', scope }, { role: 'assistant', result: oldReply(scope), scope }]) }), 'mk-supply-chain-brain-v1': JSON.stringify({ notes: [{ region: 'US', text: 'US-only remembered note' }, { region: 'EU', text: 'EU-only remembered note' }] }) };
  const sessionStorage = {};
  for (const code of ['US', 'EU', 'CA']) {
    const key = code === 'CA' ? 'Canada' : code;
    localStorage['stark-active-brands-' + key] = JSON.stringify({ 'Fixture brand': { active: true, leadTime: '1 month' } });
    sessionStorage['stark-inventory-' + key] = JSON.stringify({ fileName: code + '-inventory.csv', importedAt: '2026-10-08T12:00:00Z', rows: [{ model: code + '-ONLY-001', brand: 'Fixture brand', product: code + ' test item', status: 'LIVE', stockQty: code === 'EU' ? 40 : 1, openClient: 0, openSupplier: 0, avg3: 10, vol3: 30, last30: 12 }] });
  }
  return { localStorage, sessionStorage, search };
}
async function test(name, fn) { try { await fn(); passed.push(name); console.log('PASS', name); } catch (error) { failures.push({ name, message: error.stack }); console.error('FAIL', name, error.message); } }
async function pageTest(name, file, opts, fn) { await test(name, async () => { const page = await boot(file, undefined, opts); try { await fn(page); } finally { page.w.close(); } }); }
function changeHeader({ w, d }, region) { const node = d.querySelector('#system-region-select'); node.value = region; node.dispatchEvent(new w.Event('change', { bubbles: true })); }
async function main() {
  for (const [region, saved] of [['EU', 'US'], ['CA', 'EU'], ['US', 'CA']]) {
    await pageTest(region + ' report route overrides a persisted ' + saved + ' AI scope', 'reorder-report-' + region.toLowerCase() + '.html', options(saved, saved), async ({ w, d, errors }) => {
      assert.deepEqual(errors, []); assert.equal(w.MKAI.getStatus().scope, region); assert.equal(w.MKVerifiedEngine.currentRegion(), region); assert.equal(d.querySelector('#system-region-select').value, region);
      const source = await w.MKAI.snapshot(); assert.deepEqual(Array.from(source.reports, r => r.region), [region]); assert.equal(source.reports[0].items[0].model, region + '-ONLY-001');
      await w.MKBrain.ask('Analyze my current data'); const messages = w.MKAI.getMessages(); assert.equal(messages.at(-1).scope, region); assert.ok(messages.at(-1).result.evidence.every(e => e.id.startsWith(region + ':')));
      const text = d.querySelector('.mk-brain-feed').textContent; assert.ok(!text.includes(saved + ' saved answer')); assert.ok(!text.includes(saved + '-ONLY-001')); assert.equal(JSON.parse(w.localStorage.getItem('mk-analyst-v4')).scope, '');
    });
  }
  for (const [file, search, region] of [['sales-analysis.html', '?region=EU', 'EU'], ['sales-analysis.html', '?region=CA', 'CA']]) {
    await pageTest(file + ' query selects ' + region + ' before analyst startup', file, options('US', 'US', search), async ({ w, d }) => {
      assert.equal(w.MKAI.getStatus().scope, region); assert.equal(w.MKVerifiedEngine.currentRegion(), region); assert.equal(d.querySelector('#system-region-select').value, region);
      assert.deepEqual(Array.from((await w.MKAI.snapshot()).reports, r => r.region), [region]);
    });
  }
  await pageTest('nested generic modules inherit the shared EU selection', 'order-management/index.html', options('EU', 'US'), async ({ w }) => { assert.equal(w.MKAI.getStatus().scope, 'EU'); assert.equal((await w.MKAI.snapshot()).reports[0].items[0].model, 'EU-ONLY-001'); });
  await pageTest('header region change clears an explicit scope and switches visible conversation', 'mk-brain.html', options(), async page => {
    const { w, d } = page; w.MKAI.configure({ scope: 'US' }); changeHeader(page, 'EU'); for (let i = 0; i < 4; i++) await tick();
    assert.equal(w.MKAI.getStatus().scope, 'EU'); assert.equal(w.MKVerifiedEngine.currentRegion(), 'EU'); assert.equal(d.querySelector('#mk-scope').value, 'EU'); assert.match(d.querySelector('.mk-brain-state b').textContent, /European Union/);
    assert.ok(!d.querySelector('.mk-brain-feed').textContent.includes('US saved answer')); assert.ok(d.querySelector('.mk-brain-feed').textContent.includes('EU saved answer'));
    await w.MKBrain.ask('Analyze my current data'); assert.equal(w.MKAI.getMessages().at(-1).scope, 'EU'); assert.ok(w.MKAI.getMessages().some(m => m.scope === 'US'));
  });
  await pageTest('explicit analyst scope affects local calculations and remembered notes without becoming a saved pin', 'mk-brain.html', options(), async ({ w, d }) => {
    w.MKAI.configure({ scope: 'EU' }); assert.equal(w.MKVerifiedEngine.currentRegion(), 'EU'); await w.MKBrain.ask('Remember prioritize the EU supplier');
    assert.equal(w.MKBrain.getProfile().notes.at(-1).region, 'EU'); await w.MKBrain.ask('Analyze my current data'); assert.match(w.MKAI.getMessages().at(-1).result.answer, /European Union/); assert.equal(JSON.parse(w.localStorage.getItem('mk-analyst-v4')).scope, '');
    assert.ok(!d.querySelector('.mk-brain-feed').textContent.includes('US saved answer'));
  });
  await pageTest('EU transport sends only EU facts, history and notes through the real Space connector', 'reorder-report-eu.html', options(), async ({ w }) => {
    let sent; w.MKAI.configure({ aiEnabled: true });
    w.fetch = async (url, request) => {
      if (request.method === 'POST') { sent = JSON.parse(request.body).data[0]; return new Response(JSON.stringify({ event_id: 'regional_test' }), { status: 200 }); }
      return new Response('event: complete\ndata: ' + JSON.stringify([{ ok: true, answer: 'EU report confirmed [EU:summary]', history: [] }]) + '\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    };
    await w.MKBrain.ask('Analyze my current data'); const context = JSON.parse(sent.context); assert.equal(context.scope, 'EU'); assert.deepEqual(context.reports.map(r => r.region), ['EU']);
    const entire = JSON.stringify(sent); assert.ok(entire.includes('EU-ONLY-001')); assert.ok(entire.includes('EU-only remembered note')); assert.ok(entire.includes('EU previous question')); assert.ok(!entire.includes('US-ONLY-001')); assert.ok(!entire.includes('US-only remembered note')); assert.ok(!entire.includes('US previous question'));
    assert.equal(w.MKAI.getMessages().at(-1).result.mode, 'ai');
  });
  await pageTest('Space failure retains EU local analysis without substituting US reports', 'reorder-report-eu.html', options(), async ({ w }) => {
    w.MKAI.configure({ aiEnabled: true }); w.MKSpace = { ...w.MKSpace, analyzeWithAI: async () => { throw Error('Synthetic provider outage'); } };
    await w.MKBrain.ask('Analyze my current data'); const r = w.MKAI.getMessages().at(-1); assert.equal(r.scope, 'EU'); assert.equal(r.result.mode, 'local'); assert.match(r.result.connectionIssue, /outage/); assert.ok(JSON.stringify(r.result).includes('EU-ONLY-001')); assert.ok(!JSON.stringify(r.result).includes('US-ONLY-001'));
  });
  await pageTest('missing EU data produces an EU missing-report result even when US data exists', 'reorder-report-eu.html', (() => { const o = options(); delete o.sessionStorage['stark-inventory-EU']; return o; })(), async ({ w }) => {
    const source = await w.MKAI.snapshot(); assert.equal(source.scope, 'EU'); assert.equal(source.reports.length, 0);
    await w.MKBrain.ask('Analyze my current data'); const r = w.MKAI.getMessages().at(-1); assert.equal(r.scope, 'EU'); assert.match(r.result.answer, /No inventory report/); assert.ok(!JSON.stringify(r).includes('US-ONLY-001'));
  });
  await pageTest('cross-region analysis requires an explicit request and does not replace the EU default', 'reorder-report-eu.html', options(), async ({ w }) => {
    await w.MKAI.answer('Compare all regions', null); const comparison = w.MKAI.getMessages().at(-1); assert.equal(comparison.scope, 'ALL'); for (const code of ['US', 'EU', 'CA']) assert.ok(comparison.result.evidence.some(e => e.id.startsWith(code + ':')));
    assert.equal(w.MKAI.getStatus().scope, 'EU'); await w.MKBrain.ask('Analyze my current data'); assert.equal(w.MKAI.getMessages().at(-1).scope, 'EU'); assert.ok(w.MKAI.getMessages().at(-1).result.evidence.every(e => e.id.startsWith('EU:')));
  });
  await pageTest('a region switch discards an in-flight response even if a provider ignores cancellation', 'mk-brain.html', options(), async page => {
    const { w, d } = page; w.MKAI.clearConversation(); w.MKAI.configure({ aiEnabled: true }); let release;
    w.MKSpace = { ...w.MKSpace, analyzeWithAI: () => new Promise(resolve => { release = resolve; }) };
    const flight = w.MKBrain.ask('Analyze my current data'); for (let i = 0; i < 30 && !release; i++) await tick(); assert.equal(typeof release, 'function');
    changeHeader(page, 'EU'); release({ ...oldReply('US'), answer: 'LATE US ANSWER', mode: 'ai', model: 'synthetic' }); await flight;
    assert.equal(w.MKAI.getMessages().length, 0); assert.ok(!d.querySelector('.mk-brain-feed').textContent.includes('LATE US ANSWER')); assert.equal(w.MKAI.getStatus().scope, 'EU');
  });
  await pageTest('cross-tab shared-region changes update generic pages but cannot override an explicit EU route', 'mk-brain.html', options(), async ({ w }) => {
    w.localStorage.setItem('stark-selected-region', 'CA'); w.dispatchEvent(new w.StorageEvent('storage', { key: 'stark-selected-region', newValue: 'CA' })); assert.equal(w.MKAI.getStatus().scope, 'CA'); assert.equal(w.MKVerifiedEngine.currentRegion(), 'CA');
  });
  await pageTest('an explicit EU route stays EU when another tab selects US', 'reorder-report-eu.html', options('EU', 'ALL'), async ({ w, d }) => {
    w.localStorage.setItem('stark-selected-region', 'US'); w.dispatchEvent(new w.StorageEvent('storage', { key: 'stark-selected-region', newValue: 'US' })); assert.equal(w.MKAI.getStatus().scope, 'EU'); assert.match(d.querySelector('.mk-brain-state b').textContent, /European Union/);
  });
  fs.writeFileSync(path.join(root, 'docs/verification-mk-region.json'), JSON.stringify({ passed: passed.length, failed: failures.length, checks: passed, failures, method: 'Node.js/jsdom startup with pre-existing local storage, synthetic regional reports and mocked real Space POST/SSE transport. No graphical browser, real reports or live inference.' }, null, 2) + '\n');
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
