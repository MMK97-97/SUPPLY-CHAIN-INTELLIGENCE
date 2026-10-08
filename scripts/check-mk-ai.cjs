/* Read-only report/agent and DOM regression tests. No browser or live services. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { boot, checkNavigation } = require('./check-interface.cjs');
const T = require('../assets/mk-analysis-tools.js');
const root = path.resolve(__dirname, '..'), passed = [], failures = [];
const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', org = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fixture = () => T.validateSnapshot({ capturedAt: '2026-10-05T19:30:00Z', scope: 'ALL', workspace: { sampleData: true, openCustomerOrders: 2 }, reports: ['US', 'EU'].map((region, index) => ({ region, fileName: region + '-report.csv', importedAt: '2026-10-05T19:00:00Z', signature: region + '-v1', summary: { rowCount: 2, eligibleItems: 1, recommendedUnits: index ? 10 : 21, stockoutRisks: 1 }, settings: { critical: 3, coverage: 1 }, items: [{ model: 'CE-001', brand: 'Cozy Earth', title: 'Bamboo sheet', status: 'LIVE', eligible: true, onHand: 2, demand: 10, leadMonths: 1, openClient: 0, eligibleInbound: 0, recommended: 21, confidence: 58, riskScore: 84, stockoutRisk: true }, { model: 'EXCLUDED', brand: 'Cozy Earth', status: 'INTERNAL USE', eligible: false, onHand: 90, demand: 0, recommended: 0 }] })) });
const row = (model = 'CE-001', qty = 2) => ({ model, brand: 'Cozy Earth', product: 'Bamboo sheet', status: 'LIVE', stockQty: qty, openClient: 0, openSupplier: 0, avg3: 10, vol3: 30, last30: 12 });
function installReport(w, region = 'US', qty = 2) {
  w.MKAI.configure({ aiEnabled: false });
  const key = region === 'CA' ? 'Canada' : region;
  w.sessionStorage.setItem('stark-inventory-' + key, JSON.stringify({ fileName: region + '-fixture.csv', importedAt: '2026-10-05T19:30:00Z', rows: [row('CE-001', qty)] }));
  w.localStorage.setItem('stark-active-brands-' + key, JSON.stringify({ 'Cozy Earth': { active: true, leadTime: '1 month' } }));
}
async function test(name, fn) { try { await fn(); passed.push(name); console.log('PASS', name); } catch (error) { failures.push({ name, message: error.stack }); console.error('FAIL', name, error); } }
async function domTest(name, fn, file = 'mk-brain.html') { await test(name, async () => { const page = await boot(file); try { await fn(page); } finally { page.w.close(); } }); }
function agentAnswer(evidence = 'US:summary') { return { answer: 'Cozy Earth needs a supplier availability review.', findings: [{ title: 'Stock risk', severity: 'high', explanation: 'Observed stock is below protected demand.', evidence_ids: [evidence] }], actions: [{ title: 'Confirm supplier availability', priority: 'now', reason: 'Review the report before placing an order.', owner: 'Supply planning', evidence_ids: [evidence] }], assumptions: ['Report data is a browser snapshot.'], questions: [], evidence_ids: [evidence] }; }
function mockModel(final = agentAnswer(), steps = []) {
  const requests = [];
  const sequence = [{ type: 'function_call', name: 'report_overview', call_id: 'call_overview', arguments: '{"region":"ALL"}' }, ...steps];
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); requests.push(JSON.parse(options.body));
    assert.equal(options.headers.Authorization, 'Bearer server-test-key');
    const next = sequence.shift();
    return new Response(JSON.stringify({ id: 'response_test', status: 'completed', output: next ? [next] : [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(final) }] }], usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200 });
  };
  return { requests, fetcher };
}
function request(body, options = {}) { return new Request('https://service.test/functions/v1/mk-brain', { method: 'POST', headers: { Authorization: 'Bearer user-test-token', Origin: 'https://mmk97-97.github.io', 'Content-Type': 'application/json', ...options.headers }, body: JSON.stringify(body) }); }
async function main() {
  const { analyze, createAIHandler } = await import(pathToFileURL(path.join(root, 'supabase/functions/mk-brain/agent.mjs')).href);
  await test('tools isolate inventory regions and exclude restricted items from scenarios', () => {
    const source = fixture(), before = JSON.stringify(source);
    const result = T.run('simulate_scenario', { region: 'US', query: '', demand_change_pct: 20, lead_delay_days: 0, lead_months: null, coverage_months: null, exclude_inbound: false }, source);
    assert.equal(result.matchedItems, 1); assert.equal(result.baselineUnits, 21); assert.equal(result.simulatedUnits, 25); assert.equal(result.dataChanged, false); assert.equal(JSON.stringify(source), before);
    assert.equal(T.run('search_report_items', { region: 'EU', query: 'CE-001', risk: 'all', limit: 5 }, source).items[0].region, 'EU');
    assert.throws(() => T.run('delete_workspace', {}, source)); assert.throws(() => T.run('simulate_scenario', { region: 'US', demand_change_pct: 501 }, source));
  });
  await test('large report limits are explicit and invalid numeric data is rejected', () => {
    const source = fixture(); source.reports[0].summary.rowCount = 500;
    const validated = T.validateSnapshot(source); assert.equal(validated.reports[0].omittedRows, 498);
    assert.equal(T.run('search_report_items', { region: 'US', query: '', risk: 'all' }, validated).omittedSourceRows, 498);
    source.reports[0].items[0].demand = Infinity; assert.throws(() => T.validateSnapshot(source), /numeric/);
  });
  await test('brand evidence IDs cover lower-ranked brands and model searches preserve identifiers', () => {
    const source = fixture(); source.reports[0].items.push(...Array.from({length:45},(_,i)=>({ ...source.reports[0].items[0], model:'000'+i, brand:'Brand '+i })));
    const valid = T.validateSnapshot(source), lower = T.run('compare_brands', { region:'US', query:'Brand 9' }, valid).brands[0];
    assert.ok(T.evidence(valid).some(e => e.id === lower.evidence_id)); assert.equal(T.run('search_report_items',{region:'US',query:'0009',risk:'all'},valid).items[0].model,'0009');
  });
  await test('sales reports keep currencies separate and explain valuation estimates', () => {
    const source = fixture(); source.sales = [{region:'EU',fileName:'Sales.xlsx',items:[{model:'CE-001',brand:'Cozy Earth',units:10,price:20,cost:8,suggestedQty:5}],summary:{models:1,units:10,estimatedRevenue:200}}];
    const valid=T.validateSnapshot(source), result=T.run('sales_report',{region:'EU',query:'CE-001'},valid);
    assert.equal(result.reports[0].currency,'EUR'); assert.match(result.valuation,/not accounting totals/); assert.ok(T.evidence(valid).some(e=>e.id==='EU:sales:0'));
  });
  await test('agent selects read-only tools, preserves reasoning items and returns traceable evidence', async () => {
    const model = mockModel(agentAnswer('US:item:0'), [{ type:'function_call',name:'search_report_items',call_id:'call_search',arguments:'{"region":"US","query":"Cozy Earth","risk":"all","limit":5}' }]);
    const result = await analyze({question:'Analyze Cozy Earth',snapshot:fixture(),apiKey:'server-test-key',fetcher:model.fetcher,history:[{role:'user',content:'Only US'},{role:'assistant',content:'US selected'}]});
    assert.equal(result.mode,'ai'); assert.equal(result.tools.length,2); assert.equal(result.evidence[0].facts.model,'CE-001');
    assert.equal(model.requests[0].store,false); assert.equal(model.requests[0].input[0].content,'Only US'); assert.equal(model.requests[0].tool_choice.name,'report_overview');
    assert.ok(model.requests[1].input.some(item=>item.type==='function_call_output')); assert.ok(model.requests.every(r=>!JSON.stringify(r).includes('server-test-key')));
  });
  await test('invented or unread evidence references reject the AI answer', async () => {
    for (const id of ['OTHER:invented','US:item:0']) { const model=mockModel(agentAnswer(id)); await assert.rejects(()=>analyze({question:'Analyze',snapshot:fixture(),apiKey:'server-test-key',fetcher:model.fetcher}),/evidence/); }
  });
  await test('unknown model tools cannot mutate the workspace and incomplete output is rejected', async () => {
    const model=mockModel(agentAnswer(),[{type:'function_call',name:'cancel_order',call_id:'bad',arguments:'{}'}]);
    const result=await analyze({question:'Analyze',snapshot:fixture(),apiKey:'server-test-key',fetcher:model.fetcher}); assert.equal(result.tools[1].status,'error');
    await assert.rejects(()=>analyze({question:'Analyze',snapshot:fixture(),apiKey:'server-test-key',fetcher:async()=>new Response(JSON.stringify({status:'incomplete',output:[]}))}),/incomplete/);
  });
  await test('authorization, origin checks and missing configuration prevent provider calls', async () => {
    let calls=0; const args={authorize:async()=>null,claim:async()=>({ok:true}),finish:async()=>{},apiKey:'server-test-key',allowedOrigins:['https://mmk97-97.github.io'],fetcher:async()=>{calls++;throw Error('Should not call');}};
    let handler=createAIHandler(args); assert.equal((await handler(request({organization_id:org,mode:'status'}))).status,403);
    assert.equal((await handler(request({organization_id:org,mode:'status'},{headers:{Origin:'https://foreign.test'}}))).status,403);
    handler=createAIHandler({...args,authorize:async()=>({id:uuid}),apiKey:''}); assert.equal((await handler(request({organization_id:org,mode:'status'}))).status,503); assert.equal(calls,0);
  });
  await test('authenticated status check is free and duplicate/quota requests do not reach AI', async () => {
    let claims=0,calls=0; const args={authorize:async()=>({id:uuid}),claim:async()=>{claims++;return{ok:false,duplicate:true}},finish:async()=>{},apiKey:'server-test-key',allowedOrigins:['https://mmk97-97.github.io'],fetcher:async()=>{calls++;throw Error('Should not call')}};
    let handler=createAIHandler(args); assert.equal((await handler(request({organization_id:org,mode:'status'}))).status,200); assert.equal(claims,0);
    const body={organization_id:org,question:'Analyze',request_id:uuid,snapshot:fixture()}; assert.equal((await handler(request(body))).status,409);
    handler=createAIHandler({...args,claim:async()=>({ok:false})}); assert.equal((await handler(request(body))).status,429); assert.equal(calls,0);
  });
  await test('successful authenticated request records usage without storing report content', async () => {
    const model=mockModel(); let finished;
    const handler=createAIHandler({authorize:async()=>({id:uuid}),claim:async()=>({ok:true}),finish:async(...args)=>{finished=args},apiKey:'server-test-key',allowedOrigins:['https://mmk97-97.github.io'],fetcher:model.fetcher});
    const response=await handler(request({organization_id:org,question:'Analyze',request_id:uuid,snapshot:fixture()}));assert.equal(response.status,200);
    assert.equal(finished[1],'completed'); assert.deepEqual(Object.keys(finished[2]).sort(),['inputTokens','model','outputTokens','toolCalls']); assert.equal((await response.json()).mode,'ai');
  });
  await domTest('analyst workspace mounts one docked brain and shared navigation', async page => {
    checkNavigation(page,'mk-brain.html'); assert.equal(page.d.querySelectorAll('.mk-brain-panel').length,1); assert.ok(page.d.querySelector('.mk-docked.open'));
    assert.equal(page.w.MKAI.getStatus().aiEnabled,true); assert.ok(page.d.querySelector('#mk-report-file')); assert.ok(page.d.querySelector('#system-navigation a[href$="mk-brain.html"]'));
    assert.ok(!fs.readFileSync(path.join(root,'assets/mk-brain.js'),'utf8').includes('hf.space'));
  });
  await domTest('existing nested modules retain a usable floating analyst', async page => {
    checkNavigation(page,'order-management/index.html'); const panel=page.d.querySelector('.mk-brain-panel'); assert.equal(panel.getAttribute('aria-hidden'),'true');
    page.w.MKBrain.open();assert.equal(panel.getAttribute('aria-hidden'),'false');page.w.MKBrain.close();assert.equal(panel.inert,true);
  },'order-management/index.html');
  await domTest('local report analysis finds the requested brand and produces evidence', async ({w,d}) => {
    installReport(w); const source=await w.MKAI.snapshot('US');assert.equal(source.reports[0].items[0].recommended,21);
    await w.MKBrain.ask('Analyze Cozy Earth');assert.match(d.querySelector('.mk-brain-feed').textContent,/Cozy Earth analysis/);assert.ok(d.querySelector('.mk-evidence'));
    assert.equal(w.MKAI.getMessages().length,2);assert.equal(w.MKAI.getMessages()[1].result.mode,'local');
  });
  await domTest('region selection cannot reuse another region’s answer', async ({w,d}) => {
    installReport(w,'US',2);installReport(w,'EU',100);w.MKAI.configure({scope:'EU'});await w.MKBrain.ask('Analyze my current data');
    const result=w.MKAI.getMessages().at(-1).result;assert.match(result.answer,/European Union/);assert.ok(result.evidence.every(e=>e.id.startsWith('EU:')));assert.ok(!result.answer.includes('United States'));assert.match(d.querySelector('.mk-brain-state b').textContent,/European/);
  });
  await domTest('cross-region comparison and scenario preserve report and operational records', async ({w}) => {
    installReport(w,'US');installReport(w,'EU',100);const before=JSON.stringify(w.StarkSystem.getState());
    let result=await w.MKAI.answer('Compare all regions',null);assert.match(result.answer,/US:/);assert.match(result.answer,/EU:/);
    result=await w.MKAI.answer('What if demand increases 20%?',null,{scope:'US'});assert.match(result.answer,/25 simulated/);assert.equal(JSON.stringify(w.StarkSystem.getState()),before);
  });
  await domTest('AI failure yields clearly labeled verified local results', async ({w,d}) => {
    installReport(w);w.MKAI.configure({aiEnabled:true});w.MKSpace={...w.MKSpace,analyzeWithAI:async()=>{throw Error('AI service is not configured.')}};
    await w.MKBrain.ask('Analyze Cozy Earth');const result=w.MKAI.getMessages().at(-1).result;
    assert.equal(result.mode,'local');assert.match(result.connectionIssue,/not configured/);assert.ok(d.querySelector('.mk-connection-issue'));assert.ok(!d.querySelector('.mk-brain-feed').textContent.includes('Enter a message'));
  });
  await domTest('follow-up conversation is passed to AI and an in-flight question cannot duplicate', async ({w}) => {
    installReport(w);w.MKAI.configure({aiEnabled:true});let received;
    w.MKSpace={...w.MKSpace,analyzeWithAI:async payload=>{received=payload;return{...agentAnswer(),mode:'ai',model:'test-model',evidence:[],tools:[],capturedAt:payload.snapshot.capturedAt}}};
    await w.MKAI.answer('Analyze Cozy Earth',null);await w.MKAI.answer('Which should I review first?',null);assert.equal(received.history.length,2);assert.match(received.history[0].content,/Cozy Earth/);
    let release;w.MKSpace={...w.MKSpace,analyzeWithAI:()=>new Promise(resolve=>{release=resolve})};const first=w.MKAI.answer('Analyze',null);await new Promise(resolve=>setImmediate(resolve));await assert.rejects(()=>w.MKAI.answer('Again',null),/already running/);release({...agentAnswer(),mode:'ai',evidence:[],tools:[]});await first;
  });
  await domTest('cancelled AI analysis is stopped without saving an answer or changing records', async ({w,d}) => {
    installReport(w);w.MKAI.configure({aiEnabled:true});const before=JSON.stringify(w.StarkSystem.getState());
    let started=false;w.MKSpace={...w.MKSpace,analyzeWithAI:(payload,signal)=>new Promise((resolve,reject)=>{started=true;if(signal.aborted)return reject(new w.DOMException('Stopped','AbortError'));signal.addEventListener('abort',()=>reject(new w.DOMException('Stopped','AbortError')),{once:true});})};
    const flight=w.MKBrain.ask('Analyze Cozy Earth');for(let n=0;n<20&&!started;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(started,true);d.querySelector('.mk-stop').click();await flight;
    assert.equal(w.MKAI.getMessages().length,0);assert.equal(JSON.stringify(w.StarkSystem.getState()),before);assert.equal(d.querySelector('.mk-stop').hidden,true);assert.match(d.querySelector('.mk-brain-feed').textContent,/Analysis stopped/);
  });
  await domTest('monitoring deduplicates unchanged reports and detects changed reorder needs', async ({w}) => {
    installReport(w);await w.MKAI.monitor(true);const count=w.MKAI.getAlerts().length;assert.ok(count>0);await w.MKAI.monitor(true);assert.equal(w.MKAI.getAlerts().length,count);
    installReport(w,'US',100);await w.MKAI.monitor(true);assert.ok(w.MKAI.getAlerts().some(a=>a.title==='Reorder requirement changed'));w.MKAI.acknowledge('all');assert.equal(w.MKAI.getStatus().unread,0);
  });
  await domTest('report content and AI output render as text rather than executable markup', async ({w,d}) => {
    const div=d.createElement('div');d.body.append(div);w.MKAI.renderResult(div,{mode:'local',findings:[{title:'<img src=x onerror=alert(1)>',severity:'high',explanation:'<script>bad()</script>'}],actions:[],evidence:[],assumptions:[]});
    assert.equal(div.querySelectorAll('img,script').length,0);assert.match(div.textContent,/<img/);
  });
  await domTest('CSV upload uses the correct regional parser and rejects unrelated files before replacing reports', async ({w,d}) => {
    w.TextDecoder=TextDecoder;installReport(w,'US');w.MKAI.configure({scope:'EU',monitor:false});d.querySelector('#mk-scope').value='EU';
    const bytes=Buffer.from('Model#,Brand,Item Title,Status,Stock Qty,Avg Monthly Sales\n0007,Cozy Earth,Sheet,LIVE,4,2\n');
    Object.defineProperty(d.querySelector('#mk-report-file'),'files',{configurable:true,value:[{name:'EU.csv',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}]});
    d.querySelector('#mk-upload').click();for(let n=0;n<15&&d.querySelector('#mk-upload').disabled;n++)await new Promise(resolve=>setImmediate(resolve));
    const eu=JSON.parse(w.sessionStorage.getItem('stark-inventory-EU'));assert.equal(eu.rows[0].model,'0007');assert.equal(eu.fileName,'EU.csv');assert.equal(JSON.parse(w.sessionStorage.getItem('stark-inventory-US')).fileName,'US-fixture.csv');
    Object.defineProperty(d.querySelector('#mk-report-file'),'files',{configurable:true,value:[{name:'bad.csv',size:10,arrayBuffer:async()=>new TextEncoder().encode('Name,Value\nTest,1').buffer}]});
    d.querySelector('#mk-upload').click();for(let n=0;n<15&&d.querySelector('#mk-upload').disabled;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(JSON.parse(w.sessionStorage.getItem('stark-inventory-EU')).fileName,'EU.csv');
  });
  await domTest('XLSX upload reads local workbook bytes and preserves model leading zeros', async ({w,d}) => {
    w.TextDecoder=TextDecoder;w.MKAI.configure({scope:'CA',monitor:false});d.querySelector('#mk-scope').value='CA';
    const zip=new w.JSZip();
    zip.file('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Raw Report" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
    const cells=(values,r)=>'<row r="'+r+'">'+values.map((v,c)=>'<c r="'+String.fromCharCode(65+c)+r+'" t="inlineStr"><is><t>'+v+'</t></is></c>').join('')+'</row>';
    zip.file('xl/worksheets/sheet1.xml','<worksheet><sheetData>'+cells(['Model#','Brand','Status','Stock Qty','Avg Monthly Sales'],1)+cells(['00042','Cozy Earth','LIVE','4','2'],2)+'</sheetData></worksheet>');
    const bytes=await zip.generateAsync({type:'uint8array'});
    Object.defineProperty(d.querySelector('#mk-report-file'),'files',{configurable:true,value:[{name:'CA.xlsx',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}]});
    d.querySelector('#mk-upload').click();for(let n=0;n<35&&d.querySelector('#mk-upload').disabled;n++)await new Promise(resolve=>setImmediate(resolve));
    const ca=JSON.parse(w.sessionStorage.getItem('stark-inventory-Canada'));assert.ok(ca,d.querySelector('#mk-upload-status').textContent);assert.equal(ca.rows[0].model,'00042');assert.equal(ca.fileName,'CA.xlsx');
  });
  await domTest('scenario language cannot change live planning settings', async ({w}) => {
    installReport(w);const before=w.localStorage.getItem('stark-inventory-settings-US');await w.MKBrain.ask('Simulate set coverage to 2 months');assert.equal(w.localStorage.getItem('stark-inventory-settings-US'),before);
    assert.match(w.MKAI.getMessages().at(-1).result.answer,/Scenario/);
    const result=await w.MKAI.answer('What if on hand is 50 units for CE-001?',null);assert.match(result.answer,/0 simulated/);
  });
  await domTest('AI transport uses the signed-in token and allows read-only members without cloud sync', async ({w}) => {
    let sent;
    w.STARK_SUPABASE_CONFIG={url:'https://backend.test',publishableKey:'public-test-key'};
    w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'user-test-token',user:{id:uuid}}}})},from:()=>{const q={select(){return q},eq(){return q},order(){return q},limit(){return q},maybeSingle:async()=>({data:{organization_id:org,role:'viewer'}})};return q}})};
    w.fetch=async(url,options)=>{sent={url,...options};return new Response(JSON.stringify({configured:true,model:'test-model'}))};
    const result=await w.StarkSystemCloud.analyzeWithAI({mode:'status'});assert.equal(result.configured,true);assert.equal(sent.headers.Authorization,'Bearer user-test-token');assert.equal(JSON.parse(sent.body).organization_id,org);assert.equal(w.StarkSystemCloud.getStatus().active,false);
    await assert.rejects(()=>w.StarkSystemCloud.inspect(),/editing requires/);
  });
  fs.writeFileSync(path.join(root,'docs/verification-mk-ai.json'),JSON.stringify({passed:passed.length,checks:passed,failed:failures.length,failures,method:'Node.js pure-function and jsdom DOM simulations; no browser or live AI/database requests.'},null,2)+'\n');
  if(failures.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1});
