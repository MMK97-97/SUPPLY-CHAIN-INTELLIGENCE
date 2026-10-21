/* Regression checks for the eight October 21 browser findings.
 * Requires jsdom@26. Uses synthetic local records; no network or live services.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {boot}=require('./check-interface.cjs');
const root=path.resolve(__dirname,'..');
const passed=[],failures=[];
const plain=x=>JSON.parse(JSON.stringify(x));
const change=(w,node,value,event='input')=>{node.value=value;node.dispatchEvent(new w.Event(event,{bubbles:true}));};
async function test(name,run){try{await run();passed.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:error.stack});console.error('FAIL',name,error.message);}}
async function pageTest(name,file,run,options={}){await test(name,async()=>{const p=await boot(file,null,options);try{await run(p);assert.deepEqual(p.errors,[]);}finally{p.w.close();}});}
async function fixtureStorage(count=1){
  const p=await boot('workspace.html');
  try{
    const S=p.w.StarkSystem;
    S.transaction('REGRESSION_FIXTURES','Synthetic records only',state=>{
      const items=state.enterprise.inventory.filter(i=>i.nature==='PHYSICAL').slice(0,3);
      for(let i=0;i<count;i++)state.enterprise.orders.push({
        id:'ord_fixture_'+i,orderNumber:i?'PAGE_SO_'+String(i).padStart(3,'0'):'315980',po:i?'PAGE_PO_'+i:'90080',
        accountId:'acct_apex',type:'FIRM_PO',region:'US',purpose:'REGULAR',status:'UNVALIDATED',recordRevision:0,
        validation:{state:'UNVALIDATED',issues:[]},warehouseId:'SARASOTA',fulfillmentMode:'MANUAL',
        inHandsDate:'2026-12-15',instructions:'Call receiving',internalNotes:'Retain internal note',
        address:{name:'Fixture Company',line1:'100 Fixture Street',line2:'Suite 5',city:'Tampa',state:'FL',zip:'33601',country:'US'},
        shipping:{carrier:'UPS',method:'UPS Ground',billingType:'THIRD_PARTY',thirdPartyAccount:'TEST-ACCOUNT',thirdPartyZip:'33601'},
        lines:items.map((item,j)=>({sku:item.sku,model:item.model,title:item.title,description:j?'Fixture item':'Saved "quoted" description <intact>',qty:[50,50,20][j],price:[349,110,45][j],allocated:0,redeemed:0,shipped:0})),
        createdAt:'2026-10-20T12:00:00Z',updatedAt:'2026-10-20T12:00:00Z'
      });
    });
    return {[S.KEY]:p.w.localStorage.getItem(S.KEY)};
  }finally{p.w.close();}
}
async function main(){
  await pageTest('dashboard order deep link finds the same shared order','all-open-orders.html',({w,d})=>{
    const state=w.StarkSystem.getState(),rows=[...d.querySelectorAll('#oo-orders-tbody tr')];
    const order=state.enterprise.orders.find(o=>o.po==='88405');assert.ok(order);
    assert.equal(rows.length,1);assert.ok(rows[0].textContent.includes('88405'));assert.ok(rows[0].textContent.includes('Apex Incentives'));
    assert.equal(new URL(rows[0].querySelector('.oo-order-link').href).searchParams.get('id'),order.id);
    assert.ok(!d.querySelector('#oo-orders-tbody').textContent.includes('ABC Company'));
    assert.ok(d.querySelector('#oo-panel-order-num').textContent.includes('88405'));
  },{search:'?search=88405'});
  await pageTest('open order register excludes closed orders and filters actual statuses','all-open-orders.html',({w,d})=>{
    const state=w.StarkSystem.getState(),closed=['SHIPPED','DELIVERED','CANCELLED','EXPIRED'];
    assert.equal(d.querySelectorAll('#oo-orders-tbody tr').length,state.enterprise.orders.filter(o=>!closed.includes(o.status)).length);
    change(w,d.querySelector('#oo-filter-status'),'Allocated','change');
    assert.equal(d.querySelectorAll('#oo-orders-tbody tr').length,state.enterprise.orders.filter(o=>o.status==='ALLOCATED').length);
    change(w,d.querySelector('#oo-filter-status'),'all','change');
    assert.equal(d.querySelectorAll('#oo-orders-tbody tr').length,state.enterprise.orders.length);
  });
  await pageTest('empty shared workspace never adds prototype orders','all-open-orders.html',({w,d})=>{
    w.StarkSystem.transaction('REGRESSION_EMPTY','',s=>{s.enterprise.orders=[];s.logistics.waves=[];s.logistics.packing=[];s.logistics.tplRequests=[];s.logistics.tplShipments=[];});
    assert.equal(d.querySelector('#oo-pag-total').textContent,'0');assert.ok(d.querySelector('#oo-orders-tbody').textContent.includes('No open orders'));
    assert.equal(d.querySelector('#oo-detail-panel').style.display,'none');
  });
  const storage=await fixtureStorage(26);
  await pageTest('pagination advances, clamps, and respects page size and search','all-open-orders.html',({w,d})=>{
    const total=w.StarkSystem.getState().enterprise.orders.filter(o=>!['SHIPPED','DELIVERED','CANCELLED','EXPIRED'].includes(o.status)).length;
    const rowText=()=>d.querySelector('#oo-orders-tbody').textContent;
    assert.equal(d.querySelectorAll('#oo-orders-tbody tr').length,10);assert.equal(d.querySelector('#oo-pag-total').textContent,String(total));
    const first=rowText();d.querySelector('[aria-label="Next page"]').click();
    assert.notEqual(rowText(),first);assert.equal(d.querySelector('#oo-pag-start').textContent,'11');assert.equal(d.querySelector('#oo-page-buttons [aria-current="page"]').textContent,'2');
    d.querySelector('[aria-label="Last page"]').click();assert.ok(d.querySelector('[aria-label="Next page"]').disabled);
    change(w,d.querySelector('#oo-filter-search'),'PAGE_PO_');assert.equal(d.querySelector('#oo-pag-start').textContent,'1');assert.equal(d.querySelector('#oo-pag-total').textContent,'25');
    change(w,d.querySelector('#oo-page-size'),'25','change');assert.equal(d.querySelectorAll('#oo-orders-tbody tr').length,25);assert.ok(d.querySelector('[aria-label="Next page"]').disabled);
    change(w,d.querySelector('#oo-filter-search'),'NO-SUCH-ORDER');assert.equal(d.querySelector('#oo-pag-total').textContent,'0');assert.ok(d.querySelector('[aria-label="Last page"]').disabled);
  },{localStorage:storage});
  await pageTest('edit form displays saved PO, quantities, prices, address and billing','create-order.html',({d})=>{
    assert.equal(d.querySelector('#co-customer-po').value,'90080');assert.equal(d.querySelector('#co-sales-order').value,'315980');
    assert.deepEqual([...d.querySelectorAll('.co-row-qty')].map(n=>Number(n.value)),[50,50,20]);
    assert.deepEqual([...d.querySelectorAll('.co-row-price')].map(n=>Number(n.value)),[349,110,45]);
    assert.equal(d.querySelector('.co-row-desc').value,'Saved "quoted" description <intact>');
    assert.equal(d.querySelector('#co-address-line1').value,'100 Fixture Street');assert.equal(d.querySelector('#co-3rdparty-acct').value,'TEST-ACCOUNT');
    assert.equal(d.querySelector('#co-internal-notes').value,'Retain internal note');assert.equal(d.querySelector('#sum-total').textContent,'$23,850.00');
    assert.equal(d.querySelector('#co-hdr-create-order').disabled,false);
  },{localStorage:storage,search:'?id=315980'});
  await pageTest('saving an edited draft updates one ID without changing stock or credit','create-order.html',({w,d})=>{
    const S=w.StarkSystem,before=S.getState();let destination='';w.StarkNavigation={navigate:value=>destination=value};
    change(w,d.querySelector('#co-customer-po'),'90080-REVISED');change(w,d.querySelector('.co-row-qty'),'51');
    d.querySelector('#co-btn-save-unvalidated').click();
    const after=S.getState(),saved=after.enterprise.orders.find(o=>o.id==='ord_fixture_0');
    assert.equal(saved.po,'90080-REVISED');assert.equal(saved.orderNumber,'315980');assert.equal(saved.lines[0].qty,51);
    assert.equal(saved.address.line1,'100 Fixture Street');assert.equal(saved.shipping.thirdPartyAccount,'TEST-ACCOUNT');assert.equal(saved.internalNotes,'Retain internal note');
    assert.equal(after.enterprise.orders.length,before.enterprise.orders.length);assert.deepEqual(plain(after.enterprise.inventory),plain(before.enterprise.inventory));
    assert.deepEqual(after.enterprise.accounts.map(a=>a.creditUsed),before.enterprise.accounts.map(a=>a.creditUsed));assert.ok(destination.includes('search=90080-REVISED'));
  },{localStorage:storage,search:'?id=ord_fixture_0'});
  await pageTest('stale draft edit reports failure without success navigation or overwrite','create-order.html',({w,d})=>{
    const S=w.StarkSystem;let destination='';w.StarkNavigation={navigate:value=>destination=value};
    S.transaction('REGRESSION_CONCURRENT','',s=>{const o=s.enterprise.orders.find(o=>o.id==='ord_fixture_0');o.recordRevision++;o.po='CHANGED-ELSEWHERE';});
    const committed=plain(S.getState());d.querySelector('#co-btn-save-unvalidated').click();
    assert.deepEqual(plain(S.getState()),committed);assert.equal(destination,'');assert.ok(d.body.textContent.includes('another tab'));
  },{localStorage:storage,search:'?id=ord_fixture_0'});
  await pageTest('allocated orders display their recorded values without enabling draft overwrite','create-order.html',({w,d})=>{
    const order=w.StarkSystem.getState().enterprise.orders.find(o=>o.po==='88405');
    assert.equal(d.querySelector('#co-customer-po').value,order.po);assert.equal(Number(d.querySelector('.co-row-qty').value),order.lines[0].qty);
    assert.ok(d.querySelector('#co-hdr-create-order').disabled);assert.ok(d.querySelector('#co-btn-save-unvalidated').disabled);
  },{search:'?id=88405'});
  await pageTest('unknown order IDs cannot create a default replacement','create-order.html',({d})=>{
    assert.equal(d.querySelector('#co-customer-po').value,'');assert.equal(d.querySelectorAll('.co-row-model').length,0);
    assert.ok(d.querySelector('#co-hdr-create-order').disabled);assert.ok(d.body.textContent.includes('order was not found'));
  },{search:'?id=not-an-order'});
  await pageTest('new order entry starts empty','create-order.html',({d})=>{
    assert.equal(d.querySelector('#co-customer-po').value,'');assert.equal(d.querySelector('#co-customer').value,'');
    assert.deepEqual([...d.querySelectorAll('.co-row-model')].map(n=>n.value),['']);assert.equal(d.querySelector('#sum-total').textContent,'$0.00');
  });
  await pageTest('insufficient stock saves an issue record without inventing stock or consuming credit','create-order.html',({w,d})=>{
    const S=w.StarkSystem,before=S.getState();let destination='';w.StarkNavigation={navigate:value=>destination=value};
    for(const [id,value] of Object.entries({'co-customer':'Apex Incentives','co-customer-po':'REGRESSION-SHORTAGE','co-ship-company':'Fixture','co-address-line1':'100 Fixture Street','co-city':'Tampa','co-state':'FL','co-zip':'33601','co-inhands-date':'2026-12-15'}))d.getElementById(id).value=value;
    d.querySelector('.co-row-model').value=before.enterprise.inventory.find(i=>i.nature==='PHYSICAL').model;
    d.querySelector('.co-row-qty').value='1000000';d.querySelector('.co-row-price').value='1';
    d.querySelector('#co-hdr-create-order').click();
    const after=S.getState(),order=after.enterprise.orders.find(o=>o.po==='REGRESSION-SHORTAGE');
    assert.ok(order);assert.equal(order.status,'ISSUES');assert.ok(destination.includes('order-management/issues.html'));
    assert.deepEqual(after.enterprise.inventory.map(i=>[i.sku,i.onHand,i.reserved]),before.enterprise.inventory.map(i=>[i.sku,i.onHand,i.reserved]));
    assert.deepEqual(after.enterprise.accounts.map(a=>a.creditUsed),before.enterprise.accounts.map(a=>a.creditUsed));
  });
  await pageTest('vendor PO search reacts to each input and retains focus','procurement/index.html',({w,d})=>{
    assert.equal(d.querySelectorAll('.sys-table tbody tr').length,1);
    const input=d.querySelector('#op-search');change(w,input,'Apple');
    assert.equal(d.querySelector('#op-search').value,'Apple');assert.equal(d.activeElement,d.querySelector('#op-search'));
    assert.ok(d.querySelector('.sys-table tbody').textContent.includes('Apple Distribution'));assert.ok(!d.querySelector('.sys-table tbody').textContent.includes('Sony Electronics'));
    change(w,d.querySelector('#op-search'),'NO-MATCH');assert.ok(d.querySelector('.sys-table tbody').textContent.includes('No records'));
    change(w,d.querySelector('#op-search'),'');assert.equal(d.querySelectorAll('.sys-table tbody tr').length,3);
  },{search:'?search=Sony Electronics'});
  await pageTest('7D and 14D change the actual date bins, count, and selected period','workspace.html',({w,d})=>{
    for(const days of [7,14,30,90]){
      d.querySelector('[data-period-btn="'+days+'"]').click();assert.equal(d.querySelector('#tower-period').value,String(days));
      const snapshot=w.StarkControlTower.snapshot(w.StarkSystem.getState(),'US',days);
      assert.equal(snapshot.span,days);assert.equal(snapshot.points.length,Math.min(days,30));
      assert.equal(d.querySelector('[data-kpi="orders"] [data-kpi-value]').textContent,String(snapshot.recentOrders.length));
      const chart=d.querySelector('.tower-chart svg');assert.ok(chart.textContent.includes(snapshot.points[0].date));
    }
    change(w,d.querySelector('#tower-period'),'7','change');assert.ok(d.querySelector('[data-period-btn="7"]').classList.contains('active'));
  });
  await pageTest('workspace credit utilization matches CRM balances and handles zero limits','workspace.html',({w,d})=>{
    const S=w.StarkSystem,accounts=S.getState().enterprise.accounts,used=accounts.reduce((n,a)=>n+a.creditUsed,0),limit=accounts.reduce((n,a)=>n+a.creditLimit,0);
    assert.ok(d.querySelector('[data-kpi="credit"] .tower-kpi-submetric').textContent.includes('Utilization: '+Math.round(100*used/limit)+'%'));
    S.transaction('REGRESSION_ZERO','',s=>s.enterprise.accounts.forEach(a=>{a.creditLimit=0;a.creditUsed=0;}));
    const text=d.querySelector('[data-kpi="credit"] .tower-kpi-submetric').textContent;assert.ok(text.includes('Utilization: —'));assert.ok(!/NaN|Infinity/.test(text));
  });
  await pageTest('credit ratios remain separated by currency','workspace.html',({w,d})=>{
    w.StarkSystem.transaction('REGRESSION_CURRENCY','',s=>s.enterprise.accounts.push({id:'test-eur',name:'Euro fixture',status:'ACTIVE',type:'PARENT',currency:'EUR',creditLimit:200,creditUsed:100,terms:'Net 15'}));
    const text=d.querySelector('[data-kpi="credit"] .tower-kpi-submetric').textContent;assert.ok(text.includes('USD 49%'));assert.ok(text.includes('EUR 50%'));
  });
  const customCatalog=JSON.stringify([{sku:'WH-1000XM5',model:'WH-1000XM5',title:'Pricing fixture',brand:'Sony',status:'Active',priceNet:326,standardPrice:349.99,cost:278,availableQty:50}]);
  await pageTest('catalog Net/Retail toggle changes displayed and filtered price','item-master.html',({w,d})=>{
    assert.ok(d.querySelector('tbody').textContent.includes('$326'));
    d.querySelector('[data-ptype="Retail"]').click();assert.ok(d.querySelector('tbody').textContent.includes('$349.99'));
    d.querySelector('[data-ptype="Net"]').click();assert.ok(d.querySelector('tbody').textContent.includes('$326'));
  },{localStorage:{'stark.enterprise.itemMaster.v2':customCatalog}});
  await pageTest('detail Net Price and Unit Cost are distinct, with matching catalog values','item-details.html',({d})=>{
    [...d.querySelectorAll('[role="tab"]')].find(n=>n.textContent.trim()==='Pricing').click();
    assert.equal(d.querySelector('[data-price-net]').textContent,'$326.00');assert.equal(d.querySelector('[data-unit-cost]').textContent,'$278.00');
    assert.ok(d.querySelector('#id-tab-content-root').textContent.includes('$48.00 (14.7%)'));
  },{search:'?sku=WH-1000XM5',localStorage:{'stark.enterprise.itemMaster.v2':customCatalog}});
  await pageTest('default Sony net price agrees with the item master and does not relabel cost as net','item-details.html',({d})=>{
    [...d.querySelectorAll('[role="tab"]')].find(n=>n.textContent.trim()==='Pricing').click();
    assert.equal(d.querySelector('[data-price-net]').textContent,'$349.99');assert.equal(d.querySelector('[data-unit-cost]').textContent,'$278.00');
  },{search:'?sku=WH-1000XM5'});
  await pageTest('KPI amount uses an unbroken number and a wrapping sparkline row','workspace.html',({w,d})=>{
    const amount=d.querySelector('[data-kpi="credit"] [data-kpi-value]');
    assert.equal(w.getComputedStyle(amount).whiteSpace,'nowrap');assert.equal(w.getComputedStyle(amount.parentElement).flexWrap,'wrap');
    assert.equal(amount.textContent,'$314,050');
  });
  const result={date:'2026-10-21',passed:passed.length,failed:failures.length,checks:passed,failures,method:'Node.js with jsdom@26; local synthetic state, actual source script/defer order, DOM interactions and core workflows. No live services. Cloud browser preview was blocked with ERR_BLOCKED_BY_CLIENT; graphical desktop/mobile layout and deployment remain unverified.'};
  fs.writeFileSync(path.join(root,'docs/verification-browser-fixes-20261021.json'),JSON.stringify(result,null,2)+'\n');
  if(failures.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
