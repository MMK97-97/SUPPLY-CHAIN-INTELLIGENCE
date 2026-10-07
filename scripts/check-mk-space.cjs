/* Offline Hugging Face transport and DOM checks; no browser or live model requests. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const T = require('../assets/mk-analysis-tools.js'), H = require('../assets/mk-space.js');
const { boot } = require('./check-interface.cjs');
const root = path.resolve(__dirname, '..'), passed = [], failures = [];
const source = () => T.validateSnapshot({ capturedAt: '2026-10-05T21:00:00Z', scope: 'US', reports: [{ region: 'US', fileName: 'Synthetic.csv', importedAt: '2026-10-05T20:30:00Z', summary: { rowCount: 1, recommendedUnits: 21 }, settings: { critical: 3, coverage: 1 }, items: [{ model: '00001', brand: 'Test Brand', status: 'LIVE', eligible: true, onHand: 2, demand: 10, leadMonths: 1, recommended: 21, stockoutRisk: true }] }], sales: [], workspace: { openCustomerOrders: 2, email: 'private@example.test', address: 'Private address', sampleData: true } });
const local = () => ({ findings: [{ title: '00001', severity: 'high', explanation: '2 on hand; 21 recommended units.', evidence_ids: ['US:item:0'] }], actions: [], assumptions: [], tools: [{ name: 'report_overview', arguments: { region: 'ALL' }, status: 'complete' }, { name: 'search_report_items', arguments: { region: 'US', query: '00001', risk: 'all', limit: 5 }, status: 'complete' }] });
const payload = () => ({ question: 'Analyze model 00001', snapshot: source(), localResult: local(), notes: ['Only suggestions, no order creation'], depth: 'Auto', history: [] });
const envelope = (answer = 'Review 21 suggested units for model 00001 [US:item:0].') => ({ ok: true, answer, mode: 'Auto', history: [], activity: [{ tool: 'calculator', success: true }] });
const sse = result => 'event: heartbeat\ndata: null\n\nevent: complete\ndata: ' + JSON.stringify([result]) + '\n\n';
function mock(result = envelope(), streamFactory) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') return new Response('{"event_id":"test_event"}');
    return streamFactory ? streamFactory(sse(result), options.signal) : new Response(sse(result), { headers: { 'Content-Type': 'text/event-stream' } });
  };
  return { calls, fetcher };
}
async function test(name, fn) { try { await fn(); passed.push(name); console.log('PASS', name); } catch (error) { failures.push({ name, message: error.stack }); console.error('FAIL', name, error); } }
async function domTest(name, fn) { await test(name, async () => { const page = await boot('mk-brain.html'); try { await fn(page); } finally { page.w.close(); } }); }
function install(w) {
  w.MKAI.configure({ monitor: false });
  w.sessionStorage.setItem('stark-inventory-US', JSON.stringify({ fileName: 'Synthetic.csv', importedAt: '2026-10-05T20:30:00Z', rows: [{ model: '00001', brand: 'Test Brand', product: 'Test product', status: 'LIVE', stockQty: 2, openClient: 0, openSupplier: 0, avg3: 10, vol3: 30, last30: 12 }] }));
  w.localStorage.setItem('stark-active-brands-US', JSON.stringify({ 'Test Brand': { active: true, leadTime: '1 month' } }));
}
async function main() {
  await test('the explicit website_chat API receives one JSON payload without credentials or UI events', async () => {
    const transport = mock(), request = payload(); request.depth = 'Deep';
    const result = await H.analyzeWithAI(request, null, transport);
    assert.equal(result.provider, 'huggingface'); assert.equal(result.depth, 'Deep'); assert.equal(transport.calls.length, 2);
    assert.equal(transport.calls[0].url, 'https://mmk97-supply-ai-chain-hub.hf.space/gradio_api/call/website_chat');
    const body = JSON.parse(transport.calls[0].options.body); assert.equal(body.data.length, 1); assert.equal(body.data[0].mode, 'Deep'); assert.match(body.data[0].message, /model 00001/);
    assert.equal(transport.calls[0].options.credentials, 'omit'); assert.equal(transport.calls[0].options.headers.Authorization, undefined);
    assert.equal(result.tools.at(-1).origin, 'Space'); assert.equal(result.findingsLabel, 'Verified website facts');
  });
  await test('verified context preserves model identifiers and omits customer contact records', () => {
    const context = H.buildContext(source(), local(), ['Remembered note']);
    const facts = JSON.parse(context.text); assert.equal(facts.completed_calculations[0].facts.items[0].model, '00001');
    assert.equal(facts.completed_calculations[0].facts.items[0].recommended, 21); assert.equal(facts.workspace.sampleData, true);
    assert.ok(!context.text.includes('private@example.test')); assert.ok(!context.text.includes('Private address')); assert.ok(context.ids.has('US:item:0'));
    assert.equal(facts.explicitly_remembered_notes[0], 'Remembered note');
  });
  await test('large multi-region context stays valid JSON below 16000 characters with full totals and excerpt limits', () => {
    const raw = source(); raw.scope = 'ALL';
    raw.reports = ['US','EU','CA'].map(region => ({ ...raw.reports[0], region, fileName: region + '-large.csv', summary: { ...raw.reports[0].summary, rowCount: 3000, recommendedUnits: 100000 }, items: Array.from({ length: 2000 }, (_, n) => ({ ...raw.reports[0].items[0], model: 'MODEL-' + n, brand: 'Brand ' + n, title: 'Product ' + 'x'.repeat(230), riskScore: 90 })) }));
    raw.sales = ['US','EU','CA'].map(region => ({ region, fileName: region + '-sales.xlsx', summary: { models: 800, estimatedRevenue: 1234567 }, items: Array.from({ length: 500 }, (_, n) => ({ model: 'MODEL-' + n, brand: 'Test', price: 50, units: 3, revenueAtRisk: 150 })) }));
    const valid = T.validateSnapshot(raw), selected = local();
    selected.tools = [{ name: 'search_report_items', arguments: { region: 'ALL', risk: 'all', query: '', limit: 50 } }, { name: 'compare_brands', arguments: { region: 'ALL', query: '' } }, { name: 'sales_report', arguments: { region: 'ALL', query: '' } }];
    const result = H.buildContext(valid, selected), facts = JSON.parse(result.text);
    assert.ok(result.text.length <= 16000); assert.equal(facts.reports.length, 3); assert.equal(facts.reports[2].summary.recommendedUnits, 100000); assert.equal(facts.reports[0].omittedSourceRows, 1000);
    assert.deepEqual(facts.sales.map(r => r.currency), ['USD','EUR','CAD']); assert.ok(result.excerpts.length); assert.equal(facts.sales[1].summary.estimatedRevenue, 1234567);
  });
  await test('website scenario results reach the Space without changing regional planning records', () => {
    const snapshot = source(), before = JSON.stringify(snapshot), result = local();
    result.tools = [{ name: 'simulate_scenario', arguments: { region: 'US', query: '00001', demand_change_pct: 20, lead_delay_days: 0, lead_months: null, coverage_months: null, on_hand: null, inbound_units: null, exclude_inbound: false } }];
    const context = JSON.parse(H.buildContext(snapshot, result).text), scenario = context.completed_calculations[0].facts;
    assert.equal(scenario.baselineUnits, 21); assert.equal(scenario.simulatedUnits, 25); assert.equal(scenario.dataChanged, false); assert.equal(JSON.stringify(snapshot), before);
  });
  await test('conversation history contains complete recent user/assistant pairs only', () => {
    const messages = [{ role: 'assistant', content: 'Orphan' }, ...Array.from({ length: 10 }, (_, n) => [{ role: 'user', content: 'Question ' + n }, { role: 'assistant', content: 'Answer ' + n }]).flat(), { role: 'user', content: 'Pending' }];
    const pairs = H.pairedHistory(messages); assert.equal(pairs.length, 6); assert.equal(pairs[0].user, 'Question 4'); assert.equal(pairs.at(-1).assistant, 'Answer 9');
    assert.deepEqual(H.pairedHistory([{role:'user',content:'Old'},{role:'user',content:'New'},{role:'assistant',content:'Reply'}]),[{user:'New',assistant:'Reply'}]);
  });
  await test('SSE parsing handles heartbeat, CRLF, Unicode and split response frames', async () => {
    const transport = mock(envelope('Réorder model 00001 — 21 units [US:item:0].'), content => {
      const bytes = new TextEncoder().encode(content.replace(/\n/g, '\r\n')); let n = 0;
      return new Response(new ReadableStream({ pull(controller) { if (n >= bytes.length) return controller.close(); controller.enqueue(bytes.slice(n, n + 3)); n += 3; } }));
    });
    const result = await H.analyzeWithAI(payload(), null, transport); assert.match(result.answer, /Réorder/); assert.match(result.answer, /— 21/);
  });
  await test('interface text, empty answers, incompatible shapes and explicit provider errors are rejected', () => {
    for (const data of [[], ['Enter a message.'], [{ok:true,answer:'Enter a message.'}], [{ok:true,answer:''}], [{answer:'Not the contract'}], [{ok:false,error:'HF_TOKEN is missing.'}]]) assert.throws(() => H.parseEnvelope(data));
    assert.equal(H.parseEnvelope([JSON.stringify(envelope())]).ok, true);
  });
  await test('error events, malformed SSE and premature stream completion cannot become AI answers', async () => {
    for (const text of ['event: error\ndata: null\n\n', 'event: complete\ndata: invalid JSON\n\n', 'event: heartbeat\ndata: null\n\n']) await assert.rejects(() => H.readResult(new Response(text)), /Space/);
  });
  await test('fabricated report references cause a clear local-fallback error', async () => {
    for (const answer of ['Use [US:item:9999].', 'Evidence US:item:9999.', 'Use [OTHER:invented].']) await assert.rejects(() => H.analyzeWithAI(payload(), null, mock(envelope(answer))), /outside the report context/);
    const result = await H.analyzeWithAI(payload(), null, mock(envelope('Review [US:item:0, US:summary].'))); assert.equal(result.mode,'ai');
  });
  await test('access restrictions, sleeping Space and rate limits return useful connection messages', async () => {
    for (const [status, pattern] of [[403,/server connection/],[429,/rate-limiting/],[503,/starting or unavailable/]]) await assert.rejects(() => H.analyzeWithAI(payload(), null, {fetcher:async()=>new Response('',{status})}), pattern);
  });
  await test('connection testing checks the actual JSON contract without consuming model inference', async () => {
    const calls = [], info = JSON.parse(fs.readFileSync(path.join(root,'docs/mk-space-contract.json'),'utf8'));
    const result = await H.testConnection(null,{fetcher:async(url)=>{calls.push(url);return new Response(JSON.stringify(info));}});
    assert.equal(calls.length,1); assert.match(calls[0], /gradio_api\/info$/); assert.match(result.message,/Ask a question/);
    await assert.rejects(() => H.testConnection(null,{fetcher:async()=>new Response('{"named_endpoints":{"/lambda":{"parameters":[],"returns":[]}}}')}), /contract is unavailable/);
  });
  await test('stopped and timed-out requests cancel transport without submitting another analysis', async () => {
    const controller = new AbortController(); controller.abort(); const noCall = mock();
    await assert.rejects(() => H.analyzeWithAI(payload(), controller.signal, noCall), { name: 'AbortError' }); assert.equal(noCall.calls.length,0);
    const active = new AbortController(); let started, count = 0;
    const ready = new Promise(resolve => { started = resolve; });
    const fetcher = (url, options) => new Promise((resolve, reject) => { count++; started(); options.signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}); });
    const flight = H.analyzeWithAI(payload(),active.signal,{fetcher}); await ready; active.abort(); await assert.rejects(() => flight,{name:'AbortError'}); assert.equal(count,1);
    await assert.rejects(() => H.analyzeWithAI(payload(),null,{fetcher,timeoutMs:5}), /timed out/);
  });
  await domTest('MK uses the Space through the chat UI and includes regional facts plus follow-up history', async ({w,d}) => {
    install(w); const transport = mock(); w.fetch = transport.fetcher;
    w.StarkSystemCloud.analyzeWithAI = () => { throw Error('The legacy service must not be called.'); };
    await w.MKBrain.ask('Analyze model 00001'); await w.MKBrain.ask('Which should I review first?');
    const calls = transport.calls.filter(c => c.options.method === 'POST'), second = JSON.parse(calls[1].options.body).data[0];
    assert.equal(calls.length,2); assert.equal(second.history.length,1); assert.match(second.history[0].user,/00001/); assert.match(second.history[0].assistant,/21/);
    assert.equal(JSON.parse(second.context).scope,'US'); assert.equal(w.MKAI.getMessages().at(-1).result.mode,'ai');
    assert.match(d.querySelector('.mk-brain-feed').textContent,/Supply AI Chain Hub/); assert.match(d.querySelector('.mk-brain-feed').textContent,/Verified website facts/);
    d.querySelector('#mk-analysis-depth').value = 'Fast'; d.querySelector('#mk-analysis-depth').dispatchEvent(new w.Event('change')); assert.equal(w.MKAI.getStatus().depth,'Fast');
  });
  await domTest('Space failure falls back to actual local data and AI output is escaped', async ({w,d}) => {
    install(w); w.fetch = mock({ok:false,error:'Inference credits are required.'}).fetcher; await w.MKBrain.ask('Analyze model 00001');
    let result = w.MKAI.getMessages().at(-1).result; assert.equal(result.mode,'local'); assert.match(result.connectionIssue,/credits/); assert.ok(result.evidence.some(e=>e.id==='US:item:0'));
    w.fetch = mock(envelope('<img src=x onerror=alert(1)> 21 units [US:item:0].')).fetcher; await w.MKBrain.ask('Analyze model 00001');
    result = w.MKAI.getMessages().at(-1).result; assert.equal(result.mode,'ai'); assert.equal(d.querySelectorAll('.mk-brain-feed img, .mk-brain-feed script').length,0); assert.match(d.querySelector('.mk-brain-feed').textContent, /<img/);
  });
  fs.writeFileSync(path.join(root,'docs/verification-mk-space.json'),JSON.stringify({passed:passed.length,checks:passed,failed:failures.length,failures,method:'Offline Node.js transport tests and jsdom DOM simulations; no browser or live inference in this script.'},null,2)+'\n');
  if(failures.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1});
