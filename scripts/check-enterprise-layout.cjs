/* Portfolio-layout regressions: synthetic data, DOM/CSS inspection, no browser or services. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {boot,textContrast}=require('./check-interface.cjs');
const root=path.resolve(__dirname,'..'),passed=[],failures=[];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function test(name,fn){try{await fn();passed.push(name);console.log('PASS',name);}catch(error){failures.push({name,message:error.stack});console.error('FAIL',name,error.message);}}
async function page(file,fn,width=1536,options={}){const p=await boot(file,undefined,{...options,beforeScripts(w){Object.defineProperty(w,'innerWidth',{value:width,writable:true});}});try{await fn(p);assert.deepEqual(p.errors,[]);}finally{p.w.close();}}
function fresh(w){return w.StarkSystem.getState();}
async function main(){
  for(const file of ['workspace.html','business-operations.html'])await test(file+' renders the dashboard with real workspace values',()=>page(file,async({w,d})=>{
    assert.equal(d.querySelectorAll('.tower-kpi').length,6);assert.equal(d.querySelectorAll('#system-sidebar').length,0);assert.equal(d.querySelectorAll('.system-header').length,1);assert.equal(d.querySelectorAll('#system-page-content h1').length,1);
    const m=w.StarkControlTower.snapshot(fresh(w),'US');assert.equal(d.querySelector('[data-kpi="orders"] [data-kpi-value]').textContent,String(m.recentOrders.length));assert.equal(d.querySelector('[data-kpi="inventory"] [data-kpi-value]').textContent,new Intl.NumberFormat('en-US').format(m.available));
    assert.ok(!d.querySelector('#system-search-input'));assert.match(d.querySelector('.tower-live').textContent,/Sample/);assert.ok(!d.body.textContent.includes('Sarah ChenOperations Manager'));
  }));
  await test('dashboard values are scoped to the selected region and prefer its uploaded report',()=>page('workspace.html',async({w,d})=>{
    w.StarkSystem.recordRegional('EU',{fileName:'EU-fixture.csv',rows:[]},[{model:'EU-ONLY',brand:'EU fixture',product:'EU product',stockQty:12,available:7,recommended:5}]);
    const before=w.localStorage.getItem(w.StarkSystem.KEY),select=d.querySelector('#system-region-select');select.value='EU';select.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
    assert.equal(d.querySelector('[data-kpi="inventory"] [data-kpi-value]').textContent,'7');assert.equal(d.querySelector('[data-kpi="orders"] [data-kpi-value]').textContent,'0');assert.match(d.querySelector('.tower-hero-top').textContent,/European Union/);assert.equal(d.querySelector('#system-region-select').value,'EU');assert.equal(w.localStorage.getItem(w.StarkSystem.KEY),before);assert.equal(w.MKAI.getStatus().scope,'EU');
  }));
  await test('region map buttons synchronize the shared selector and analyst scope',()=>page('workspace.html',async({w,d})=>{
    d.querySelector('[data-tower-region="CA"]').click();await tick();assert.equal(d.querySelector('#system-region-select').value,'CA');assert.equal(w.StarkSystem.getRegion(),'CA');assert.equal(w.MKAI.getStatus().scope,'CA');assert.equal(d.querySelector('[data-tower-region="CA"]').getAttribute('aria-pressed'),'true');
  }));
  await test('imported regional stock cards track actual order reservations',()=>page('workspace.html',async({w,d})=>{
    const S=w.StarkSystem;S.recordRegional('EU',{fileName:'Linked-stock-fixture.csv',rows:[]},[{model:'EU-STOCK',brand:'Fixture',product:'Fixture product',stockQty:12,available:7,recommended:0,cost:1,standardPrice:25}]);S.importRegional('EU');d.querySelector('[data-tower-region="EU"]').click();await tick();assert.equal(d.querySelector('[data-kpi="inventory"] [data-kpi-value]').textContent,'7');
    S.createOrder({po:'EU-LINKED-STOCK',type:'FIRM_PO',accountId:'acct_apex',supplyMode:'STOCK',shipping:{destination:'Synthetic fixture address'},lines:[{sku:'EU::EU-STOCK',qty:2,price:25}]});assert.equal(S.getState().regional.EU.items[0].available,7);assert.equal(d.querySelector('[data-kpi="inventory"] [data-kpi-value]').textContent,'5');
  }));
  await test('direct EU links show EU data on the first dashboard render',()=>page('workspace.html',async({w,d})=>{
    assert.equal(w.StarkSystem.getRegion(),'EU');assert.equal(w.MKAI.getStatus().scope,'EU');assert.equal(d.querySelector('[data-kpi="inventory"] [data-kpi-value]').textContent,'0');assert.match(d.querySelector('.tower-hero-top').textContent,/European Union/);
  },1536,{search:'?region=EU',localStorage:{'stark-selected-region':'US'}}));
  await test('on-time delivery is unavailable without actual delivery timestamps',()=>page('workspace.html',async({w,d})=>{assert.equal(w.StarkControlTower.snapshot(fresh(w),'US').onTime,null);assert.equal(d.querySelector('[data-kpi="delivery"] [data-kpi-value]').textContent,'—');}));
  await test('delivery performance uses dated delivered orders and requested in-hands dates',()=>page('workspace.html',async({w})=>{
    const s=fresh(w),now=new w.Date(),day=now.toISOString().slice(0,10);s.enterprise.orders=s.enterprise.orders.slice(0,2).map((o,i)=>({...o,status:'DELIVERED',deliveredAt:now.toISOString(),inHandsDate:i===0?day:'2020-01-01'}));const m=w.StarkControlTower.snapshot(s,'US',30,now);assert.equal(m.deliveries.length,2);assert.equal(m.onTime,50);
  }));
  await test('credit exposures in different currencies are kept separate',()=>page('workspace.html',async({w,d})=>{
    w.StarkSystem.transaction('TEST','Synthetic currency',s=>{s.enterprise.accounts[0].currency='EUR';});assert.equal(d.querySelector('[data-kpi="credit"] [data-kpi-value]').textContent,'2 currencies');const m=w.StarkControlTower.snapshot(fresh(w),'US');assert.ok(m.credit.EUR>0&&m.credit.USD>0);
  }));
  await test('period changes filter dated orders while preserving open commitments',()=>page('workspace.html',async({w,d})=>{
    w.StarkSystem.transaction('TEST','Synthetic old order',s=>{s.enterprise.orders[0].createdAt=new w.Date(Date.now()-45*864e5).toISOString();});
    const before=w.localStorage.getItem(w.StarkSystem.KEY),short=d.querySelector('[data-kpi="orders"] [data-kpi-value]').textContent,poCount=d.querySelector('[data-kpi="purchase"] [data-kpi-value]').textContent;
    const select=d.querySelector('#tower-period');select.value='90';select.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(Number(d.querySelector('[data-kpi="orders"] [data-kpi-value]').textContent),Number(short)+1);assert.equal(d.querySelector('[data-kpi="purchase"] [data-kpi-value]').textContent,poCount);assert.equal(w.localStorage.getItem(w.StarkSystem.KEY),before);
  }));
  await test('trend totals are actual timestamp counts without invented shipment history',()=>page('workspace.html',async({w})=>{
    const m=w.StarkControlTower.snapshot(fresh(w),'US');assert.equal(m.points.reduce((v,p)=>v+p.orders,0),m.recentOrders.length);assert.equal(m.points.reduce((v,p)=>v+p.shipments,0),m.shipments.filter(p=>m.inPeriod(p.dispatchedAt)).length);
  }));
  await test('each chart series can be hidden and restored without changing records',()=>page('workspace.html',async({w,d})=>{
    const before=w.localStorage.getItem(w.StarkSystem.KEY);for(const name of ['orders','shipments','delivered']){d.querySelector('#tower-series-'+name).click();assert.equal(d.querySelector('#tower-series-'+name).getAttribute('aria-pressed'),'false');}assert.equal(d.querySelectorAll('.tower-chart polyline').length,0);d.querySelector('#tower-series-orders').click();assert.equal(d.querySelectorAll('.tower-chart polyline').length,1);assert.equal(w.localStorage.getItem(w.StarkSystem.KEY),before);
  }));
  await test('inventory health categories partition the physical SKU set',()=>page('workspace.html',async({w,d})=>{
    const m=w.StarkControlTower.snapshot(fresh(w),'US');assert.equal(m.healthGroups.reduce((v,g)=>v+g.count,0),m.physical.length);d.querySelector('[data-health="low"]').focus();d.querySelector('[data-health="low"]').click();assert.equal(d.querySelector('#tower-tab-inventory').getAttribute('aria-selected'),'true');assert.equal(d.querySelector('[data-health="low"]').getAttribute('aria-pressed'),'true');assert.equal(d.activeElement.id,'tower-health-low');
  }));
  await test('record tabs support keyboard movement and accessible panel associations',()=>page('workspace.html',async({w,d})=>{
    const first=d.querySelector('#tower-tab-orders');first.focus();first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(d.activeElement.id,'tower-tab-shipments');assert.equal(d.querySelector('#tower-ledger-content').getAttribute('aria-labelledby'),'tower-tab-shipments');
    d.querySelector('#tower-tab-shipments').dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));assert.equal(d.activeElement.id,'tower-tab-events');
  }));
  await test('order stage filters retain hold, picking, packing and dispatched views',()=>page('workspace.html',async({w,d})=>{
    const before=w.localStorage.getItem(w.StarkSystem.KEY);
    for(const stage of ['open','hold','pick','pack','ship']){const select=d.querySelector('#tower-order-stage');select.value=stage;select.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(d.querySelector('#tower-order-stage').value,stage);if(stage==='hold')assert.match(d.querySelector('#tower-ledger-content').textContent,/HOLD PO/);if(stage==='ship')assert.match(d.querySelector('#tower-ledger-content').textContent,/SHIPPED/);}
    assert.equal(w.localStorage.getItem(w.StarkSystem.KEY),before);
  }));
  await test('upcoming event POs keep their region and linked customer-order route',()=>page('workspace.html',async({w,d})=>{
    const tomorrow=new Date(Date.now()+864e5).toISOString().slice(0,10);w.StarkSystem.setEvents('EU',[{id:'event-layout-eu',poNumber:'EU-EVENT-FIXTURE',customer:'Fixture customer',inHandsDate:tomorrow,planning:'LTL',items:[]}]);
    d.querySelector('[data-tower-region="EU"]').click();await tick();d.querySelector('#tower-tab-events').click();const panel=d.querySelector('#tower-ledger-content');assert.ok(panel.textContent.includes('EU-EVENT-FIXTURE'));const link=[...panel.querySelectorAll('a')].find(a=>a.href.includes('/order-management/new-order.html'));assert.ok(link);const u=new URL(link.href);assert.equal(u.searchParams.get('event'),'event-layout-eu');assert.equal(u.searchParams.get('region'),'EU');
  }));
  await test('long or invalid period requests produce bounded chart buckets',()=>page('workspace.html',async({w})=>{
    const s=fresh(w);s.enterprise.orders[0].createdAt='2000-01-01T12:00:00Z';s.logistics.tplShipments[0].dispatchedAt='1990-01-01T12:00:00Z';const all=w.StarkControlTower.snapshot(s,'US','all');assert.equal(all.points.length,30);assert.ok(all.span>13000);assert.equal(all.points.reduce((v,p)=>v+p.shipments,0),all.shipments.filter(p=>all.inPeriod(p.dispatchedAt)).length);const invalid=w.StarkControlTower.snapshot(s,'US','invalid');assert.equal(invalid.span,30);assert.equal(invalid.points.length,30);
  }));
  await test('daily activity uses local calendar dates across daylight-saving changes',async()=>{
    const previous=process.env.TZ;process.env.TZ='America/New_York';
    try{await page('workspace.html',async({w})=>{const s=fresh(w),now=new w.Date('2026-03-11T12:00:00-04:00');s.enterprise.orders=[{...s.enterprise.orders[0],createdAt:'2026-03-09T00:30:00-04:00'}];const model=w.StarkControlTower.snapshot(s,'US',30,now);assert.equal(model.points.find(p=>p.date==='2026-03-09').orders,1);assert.equal(model.points.reduce((v,p)=>v+p.orders,0),1);});}
    finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
  });
  await test('all dashboard links resolve to existing nested modules',()=>page('workspace.html',async({d})=>{
    const site=new URL('https://example.test/SUPPLY-CHAIN-INTELLIGENCE/');for(const link of d.querySelectorAll('.tower-page a,.system-ai-dock a')){const u=new URL(link.href);assert.ok(u.href.startsWith(site.href));assert.ok(fs.existsSync(path.join(root,decodeURIComponent(u.pathname.slice(site.pathname.length)))));}
  }));
  await test('desktop modules use a top menu without a persistent side panel',()=>page('workspace.html',async({d})=>{
    assert.equal(d.querySelector('#system-sidebar'),null);assert.equal(d.querySelector('.system-ai-dock'),null);assert.ok(d.querySelector('#system-module-tabs'));assert.equal(d.querySelectorAll('.mk-brain-panel').length,1);assert.equal(d.querySelector('#system-ai-toggle').getAttribute('aria-expanded'),'false');
  }));
  await test('opening and closing the analyst preserves its conversation and keyboard focus',()=>page('workspace.html',async({w,d})=>{
    const feed=d.querySelector('.mk-brain-feed'),button=d.querySelector('#system-ai-toggle');button.focus();button.click();assert.equal(d.querySelector('.mk-brain-panel').getAttribute('role'),'dialog');assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(d.activeElement.tagName,'TEXTAREA');d.querySelector('.mk-close').click();assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(d.activeElement,button);assert.equal(d.querySelector('.mk-brain-feed'),feed);
  }));
  await test('dashboard refresh preserves the analyst and updates warehouse queues',()=>page('workspace.html',async({w,d})=>{
    const panel=d.querySelector('.mk-brain-panel');w.StarkSystem.transaction('TEST','Synthetic extra bin',s=>s.logistics.bins.push({id:'TEST-BIN',zone:'BULK',active:true,capacity:20,used:0}));assert.equal(d.querySelector('.mk-brain-panel'),panel);assert.equal(d.querySelectorAll('.tower-kpi').length,6);assert.ok(d.querySelector('.tower-queues'));
  }));
  await test('warehouse and 3PL queues remain separate from transportation',()=>page('workspace.html',async({d})=>{
    const host=d.querySelector('.tower-queues');host.querySelector('[data-tower-queue="3pl"]').click();assert.ok([...d.querySelector('.tower-queues').querySelectorAll('a')].every(a=>a.href.includes('/3pl-management/')));assert.ok(d.querySelector('details[data-nav-group="tpl"]'));assert.ok(d.querySelector('details[data-nav-group="transportation"]'));
  }));
  for(const width of [360,390,768,1024,1536])await test(width+'px viewport keeps one analyst and accessible module controls',()=>page('workspace.html',async({w,d})=>{
    assert.equal(d.querySelector('.system-ai-dock'),null);d.querySelector('#system-ai-toggle').click();assert.ok(d.querySelector('.mk-brain-panel').classList.contains('open'));d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.ok(!d.querySelector('.mk-brain-panel').classList.contains('open'));assert.equal(d.querySelector('#system-ai-toggle').getAttribute('aria-expanded'),'false');assert.ok(d.querySelector('.portfolio-mobile-nav button'));assert.ok(w.MKBrain);
  },width));
  await test('resize retains a single analyst and its conversation node',()=>page('workspace.html',async({w,d})=>{
    const panel=d.querySelector('.mk-brain-panel'),feed=d.querySelector('.mk-brain-feed');for(const width of [390,1536,768]){w.innerWidth=width;w.dispatchEvent(new w.Event('resize'));assert.equal(d.querySelector('.mk-brain-panel'),panel);assert.equal(d.querySelector('.mk-brain-feed'),feed);}assert.equal(d.querySelectorAll('.mk-brain-panel').length,1);
  }));
  await test('Escape dismisses a draft modal before the open analyst',()=>page('workspace.html',async({w,d})=>{
    d.querySelector('#system-ai-toggle').click();const modal=w.StarkSystemUI.dialog('Draft form','<label>Draft<input id="layout-test-draft" value="Keep draft"></label>',()=>false);d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.ok(!modal.isConnected);assert.ok(d.querySelector('.mk-brain-panel').classList.contains('open'));
  }));
  await test('nested order forms retain their original fields and scoped search',()=>page('order-management/new-order.html',async({d})=>{
    assert.ok(d.querySelector('#system-search-input'));assert.ok(d.querySelector('[name="accountId"]'));assert.ok(d.querySelector('[name="address-line1"]'));assert.equal(d.querySelector('#system-sidebar'),null);assert.ok(d.querySelector('#system-ai-panel'));
  }));
  await test('dashboard records render hostile labels as text without creating elements',()=>page('workspace.html',async({w,d})=>{
    w.StarkSystem.transaction('TEST','Synthetic escaping',s=>{s.enterprise.accounts.find(a=>a.id===s.enterprise.orders[0].accountId).name='Fixture <img data-layout-injection="customer" src=x>';s.enterprise.orders[0].po='PO"><img data-layout-injection="po" src=x>';});assert.equal(d.querySelectorAll('[data-layout-injection]').length,0);assert.ok(d.body.textContent.includes('Fixture <img'));
  }));
  await test('empty working data shows zeros and useful empty states',()=>page('workspace.html',async({w,d})=>{
    w.StarkSystem.clearWorkspace();assert.equal(d.querySelector('[data-kpi="orders"] [data-kpi-value]').textContent,'0');assert.equal(d.querySelector('[data-kpi="inventory"] [data-kpi-value]').textContent,'0');assert.equal(d.querySelector('[data-kpi="delivery"] [data-kpi-value]').textContent,'—');assert.match(d.querySelector('.tower-live').textContent,/Current/);assert.ok(d.querySelectorAll('.tower-empty').length>=2);
  }));
  await test('dashboard text, legends and top navigation have readable declared colors',()=>page('workspace.html',async({w,d})=>{
    for(const selector of ['.tower-kpi-label','.tower-kpi strong','.tower-kpi small','.tower-panel-head h2','.tower-health-key button','.tower-panel-note','.tower-ledger-head button','.tower-chart-key button','.system-home','#system-navigation summary','.system-brand b']){
      for(const node of d.querySelectorAll(selector))assert.ok(textContrast(w,node)>=4.5,selector+' contrast');
    }
  }));
  fs.writeFileSync(path.join(root,'docs/verification-enterprise-layout.json'),JSON.stringify({passed:passed.length,failed:failures.length,checks:passed,failures,method:'Node.js/jsdom with synthetic workspace/viewport fixtures and declared CSS contrast. No graphical browser, rendered screenshots, live service requests or deployment.'},null,2)+'\n');
  console.log(passed.length+' passed; '+failures.length+' failed.');if(failures.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
