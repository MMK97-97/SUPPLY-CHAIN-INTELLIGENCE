/* Production failure-path checks with synthetic local data. No browser or live services. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {boot}=require('./check-interface.cjs');
const root=path.resolve(__dirname,'..'),KEY='stark.unifiedSystem.v1',passed=[],failures=[];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function test(name,fn){try{await fn();passed.push(name);console.log('PASS',name);}catch(error){failures.push({name,message:error.stack});console.error('FAIL',name,error.message);}}
async function page(file,options,fn){const p=await boot(file,undefined,options||{});try{await fn(p);assert.deepEqual(p.errors,[]);}finally{p.w.close();}}
function failWrites(w){const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(key,value){if(key===KEY){const error=new Error('Storage quota exceeded');error.name='QuotaExceededError';throw error;}return original.call(this,key,value);};return()=>w.Storage.prototype.setItem=original;}
async function main(){
  for(const c of [
    {file:'crm/accounts.html',open:'#new-account',field:'#m-name',value:'Retry customer',group:'enterprise',list:'accounts',key:'name'},
    {file:'vendor-management/vendors.html',open:'#new-vendor',field:'#v-name',value:'Retry vendor',group:'enterprise',list:'vendors',key:'name'},
    {file:'warehouse-management/inventory-bins.html',open:'#add-bin',field:'#b-id',value:'RETRY-BIN',group:'logistics',list:'bins',key:'id'}
  ])await test(c.list+' failed storage save preserves records and retries exactly once',()=>page(c.file,{},async({w,d})=>{
    d.querySelector(c.open).click();d.querySelector(c.field).value=c.value;
    const before=w.localStorage.getItem(KEY),restore=failWrites(w);
    d.querySelector('.modal-backdrop [data-save]').click();
    assert.equal(w.localStorage.getItem(KEY),before);assert.match(d.querySelector('[data-dialog-error]').textContent,/quota/i);assert.equal(d.querySelector(c.field).value,c.value);
    restore();d.querySelector('.modal-backdrop [data-save]').click();
    assert.equal(w.StarkSystem.getState()[c.group][c.list].filter(x=>x[c.key]===c.value).length,1);assert.equal(d.querySelector('.modal-backdrop'),null);
  }));
  await test('stale CRM save reports conflict and retry retains concurrent changes',()=>page('crm/accounts.html',{},async({w,d})=>{
    d.querySelector('#new-account').click();d.querySelector('#m-name').value='Stale retry customer';
    w.StarkSystem.transaction('TEST_CONCURRENT','Synthetic update',s=>{s.enterprise.accounts[0].contact='Concurrent edit';});
    d.querySelector('[data-save]').click();assert.match(d.querySelector('[data-dialog-error]').textContent,/newer changes/);
    assert.equal(w.StarkSystem.getState().enterprise.accounts.filter(x=>x.name==='Stale retry customer').length,0);
    d.querySelector('[data-save]').click();const state=w.StarkSystem.getState();assert.equal(state.enterprise.accounts[0].contact,'Concurrent edit');assert.equal(state.enterprise.accounts.filter(x=>x.name==='Stale retry customer').length,1);
  }));
  let validRecords;
  await page('index.html',{},async({w})=>{validRecords=w.StarkSystem.getState();});
  for(const [kind,change] of [
    ['non-text order status',s=>s.enterprise.orders[0].status=42],
    ['invalid currency',s=>s.enterprise.accounts[0].currency='INVALID'],
    ['invalid regional report rows',s=>s.regional.EU={fileName:'Fixture',items:null}],
    ['invalid event group',s=>s.events.EU={invalid:true}],
    ['invalid supplier PO lines',s=>s.enterprise.purchaseOrders[0].lines=null]
  ])await test('invalid stored '+kind+' opens recovery before dashboard rendering',async()=>{
    const invalid=JSON.parse(JSON.stringify(validRecords));change(invalid);const raw=JSON.stringify(invalid);
    await page('index.html',{localStorage:{[KEY]:raw}},async({w,d})=>{assert.ok(d.querySelector('#system-recovery-panel'));assert.equal(w.localStorage.getItem(KEY),raw);assert.equal(w.StarkSystem,undefined);});
  });
  const malformed=[['broken JSON','{broken'],['missing record arrays',JSON.stringify({schemaVersion:1,revision:0,enterprise:{},logistics:{}})],['null records','null'],['array records','[]'],['empty records','']];
  for(const [kind,value] of malformed)for(const file of ['index.html','crm/accounts.html','shipping/index.html'])await test(file+' safely recovers '+kind,()=>page(file,{localStorage:{[KEY]:value}},async({w,d})=>{
    assert.ok(d.querySelector('#system-recovery-export'));assert.match(d.body.textContent,/preserved/);assert.equal(w.localStorage.getItem(KEY),value);assert.equal(w.StarkSystem,undefined);
  }));
  await test('recovery export contains original unreadable records',()=>page('index.html',{localStorage:{[KEY]:'{broken','stark-report-fixture':'Original report'},beforeScripts(w){w.HTMLAnchorElement.prototype.click=function(){};}},async({w,d})=>{
    let blob;w.URL.createObjectURL=value=>{blob=value;return 'blob:recovery-fixture';};w.URL.revokeObjectURL=()=>{};
    d.querySelector('#system-recovery-export').click();assert.ok(blob);
    const raw=await new Promise((resolve,reject)=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsText(blob);});
    const exported=JSON.parse(raw);assert.equal(exported.format,'stark-storage-recovery');assert.equal(exported.records[KEY],'{broken');assert.equal(exported.records['stark-report-fixture'],'Original report');
  }));
  await test('failed recovery downloads show an error and preserve stored records',()=>page('index.html',{localStorage:{[KEY]:'{broken'}},async({w,d})=>{
    w.URL.createObjectURL=()=>{throw new Error('Downloads blocked');};d.querySelector('#system-recovery-export').click();assert.match(d.querySelector('#system-recovery-error').textContent,/Downloads blocked/);assert.ok(!d.querySelector('#system-recovery-error').hidden);assert.equal(w.localStorage.getItem(KEY),'{broken');
  }));
  for(const file of ['raw-report-eu.html','reorder-report-eu.html','active-brands-ca.html'])await test(file+' recovery preserves nodes used by asynchronous report startup',()=>page(file,{localStorage:{[KEY]:'{broken'}},async({d})=>{
    await tick();assert.ok(d.querySelector('#system-recovery-panel'));assert.ok(d.querySelector('body > [inert][hidden]'));assert.ok(d.body.classList.contains('stark-storage-recovery'));
  }));
  await test('malformed cross-tab updates are reported and cannot be committed',()=>page('crm/accounts.html',{},async({w,d})=>{
    const valid=w.localStorage.getItem(KEY);d.querySelector('#new-account').click();d.querySelector('#m-name').value='Unsaved draft';
    const invalid=JSON.stringify({schemaVersion:1,revision:999});w.localStorage.setItem(KEY,invalid);w.dispatchEvent(new w.StorageEvent('storage',{key:KEY,newValue:invalid}));
    assert.match(d.querySelector('.system-toast.error').textContent,/could not be read/);assert.equal(d.querySelector('#m-name').value,'Unsaved draft');
    let mutated=false;assert.throws(()=>w.StarkSystem.transaction('TEST','',()=>{mutated=true;}));assert.equal(mutated,false);assert.equal(w.localStorage.getItem(KEY),invalid);
    w.localStorage.setItem(KEY,valid);assert.ok(w.StarkSystem.getState().enterprise.accounts.length);
  }));
  const attack='TEST"><img data-audit-injection="sku" src="invalid">';let stored;
  await page('index.html',{},async({w})=>{w.StarkSystem.transaction('TEST','Synthetic SKU',s=>{s.enterprise.inventory.push({sku:attack,model:'TEST',brand:'Fixture',title:'Fixture',region:'US',nature:'PHYSICAL',onHand:1,reserved:0,damaged:0,safety:0,cost:1,standardPrice:1});s.enterprise.accounts.push({...s.enterprise.accounts[0],id:attack,name:'Fixture account'});});stored=w.localStorage.getItem(KEY);});
  await test('catalog action attributes preserve literal SKU without creating HTML',()=>page('crm/catalog.html',{localStorage:{[KEY]:stored}},async({d})=>{
    assert.equal(d.querySelectorAll('[data-audit-injection]').length,0);assert.ok([...d.querySelectorAll('[data-price]')].some(x=>x.dataset.price===attack));
  }));
  await test('pricing selectors preserve literal SKU without creating HTML',()=>page('crm/catalog.html',{localStorage:{[KEY]:stored}},async({d})=>{
    [...d.querySelectorAll('[data-price]')].find(x=>x.dataset.price===attack).click();assert.equal(d.querySelectorAll('[data-audit-injection]').length,0);assert.equal(d.querySelector('#x-sku').value,attack);assert.ok([...d.querySelectorAll('.modal-backdrop option')].some(x=>x.value===attack));
  }));
  await test('warehouse action attributes preserve literal SKU without creating HTML',()=>page('warehouse-management/inventory-bins.html',{localStorage:{[KEY]:stored}},async({d})=>{
    assert.equal(d.querySelectorAll('[data-audit-injection]').length,0);assert.ok([...d.querySelectorAll('[data-move]')].some(x=>x.dataset.move===attack));
  }));
  await test('dialogs have an accessible title, contain keyboard focus and restore it',()=>page('crm/accounts.html',{},async({w,d})=>{
    const opener=d.querySelector('#new-account');opener.focus();opener.click();const wrap=d.querySelector('.modal-backdrop'),box=wrap.querySelector('[role="dialog"]');
    assert.equal(d.getElementById(box.getAttribute('aria-labelledby')).textContent,'Add agency account');assert.equal(d.activeElement.id,'m-name');
    const first=wrap.querySelector('button'),last=wrap.querySelector('[data-save]');last.focus();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(d.activeElement,first);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(d.activeElement,last);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(d.querySelector('.modal-backdrop'),null);assert.equal(d.activeElement,opener);
  }));
  await test('invalid required fields and email cannot save a CRM account',()=>page('crm/accounts.html',{},async({w,d})=>{
    const before=w.localStorage.getItem(KEY);d.querySelector('#new-account').click();d.querySelector('[data-save]').click();assert.equal(w.localStorage.getItem(KEY),before);assert.equal(d.activeElement.id,'m-name');
    d.querySelector('#m-name').value='Invalid email fixture';d.querySelector('#m-email').value='invalid-email';d.querySelector('[data-save]').click();assert.equal(w.localStorage.getItem(KEY),before);assert.equal(d.activeElement.id,'m-email');assert.ok(!d.querySelector('[data-dialog-error]').hidden);
  }));
  await test('pending dialog saves block duplicate submissions, edits and dismissal',()=>page('index.html',{},async({w,d})=>{
    let resolve,calls=0;const pending=new Promise(done=>resolve=done),wrap=w.StarkSystemUI.dialog('Pending save','<label>Draft<input id="pending-draft" value="Keep draft"></label>',()=>{calls++;return pending;},'Save',{system:true});
    wrap.querySelector('[data-save]').click();wrap.querySelector('[data-save]').click();assert.equal(calls,1);assert.ok(wrap.querySelector('input').disabled);assert.equal(wrap.querySelector('[role="dialog"]').getAttribute('aria-busy'),'true');
    d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.ok(wrap.isConnected);resolve(true);await tick();assert.ok(!wrap.isConnected);
  }));
  await test('rejected asynchronous saves keep drafts and enable a single retry',()=>page('index.html',{},async({w,d})=>{
    let reject,calls=0;const pending=new Promise((_,fail)=>reject=fail),wrap=w.StarkSystemUI.dialog('Failed save','<label>Draft<input id="retry-draft" value="Keep draft"></label>',()=>{calls++;return calls===1?pending:true;},'Save',{system:true});
    wrap.querySelector('[data-save]').click();reject(new Error('Synthetic connection failed'));await tick();assert.ok(wrap.isConnected);assert.match(wrap.querySelector('[data-dialog-error]').textContent,/connection failed/);assert.equal(wrap.querySelector('input').value,'Keep draft');assert.ok(!wrap.querySelector('input').disabled);
    wrap.querySelector('[data-save]').click();assert.equal(calls,2);assert.ok(!wrap.isConnected);
  }));
  await test('nested dialogs close in order without dismissing their parent',()=>page('index.html',{},async({w,d})=>{
    const parent=w.StarkSystemUI.dialog('Parent','<label>Draft<input id="parent-draft"></label>',()=>false),child=w.StarkSystemUI.dialog('Child','<p>Child details</p>',()=>true);
    d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.ok(!child.isConnected);assert.ok(parent.isConnected);assert.ok(parent.contains(d.activeElement));
    d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.ok(!parent.isConnected);
  }));
  await test('AI agent starts without a decorative canvas context',()=>page('cloud-agent.html',{beforeScripts(w){w.HTMLCanvasElement.prototype.getContext=()=>null;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});}},async({d})=>{
    assert.equal(d.querySelector('#prompt').getAttribute('aria-label'),'AI analysis request');assert.ok(d.querySelector('#neural-canvas'));
  }));
  await test('3PL routing buttons use the shared order transaction and reserve once',()=>page('3pl-management/routing.html',{},async({w,d})=>{
    const S=w.StarkSystem,po='UI-ROUTE-FIXTURE',sku='PHYS-SONY-WH1000XM5';
    const id=S.createOrder({po,type:'FIRM_PO',accountId:'acct_apex',programId:null,supplyMode:'STOCK',shipping:{destination:'Synthetic test address'},lines:[{sku,qty:2,price:350}]});
    w.StarkLogistics.refresh();d.querySelector('#rt-order').value=po;d.querySelector('#rt-sku').value=sku;d.querySelector('#rt-qty').value='2';d.querySelector('#evaluate-route').click();
    const before=S.getState().logistics.tplInventory.find(x=>x.nodeId==='tpl_east'&&x.sku===sku).reserved;
    d.querySelector('[data-route="tpl_east"]').click();const after=S.getState();assert.equal(after.logistics.tplShipments.filter(x=>x.customerOrderId===id).length,1);assert.equal(after.logistics.tplInventory.find(x=>x.nodeId==='tpl_east'&&x.sku===sku).reserved,before+2);assert.equal(after.enterprise.orders.find(x=>x.id===id).fulfillment.kind,'3PL');
  }));
  await test('warehouse receiving failure keeps scan values for a successful retry',()=>page('warehouse-management/receiving.html',{},async({w,d})=>{
    d.querySelector('[data-receive]').click();const wrap=d.querySelector('.sys-modal-backdrop'),before=w.localStorage.getItem(KEY),restore=failWrites(w);assert.ok(wrap.querySelector('[data-good]'));
    wrap.querySelector('[data-save]').click();assert.equal(w.localStorage.getItem(KEY),before);assert.match(wrap.querySelector('[data-dialog-error]').textContent,/quota/);assert.ok(wrap.isConnected);
    restore();wrap.querySelector('[data-save]').click();assert.ok(!wrap.isConnected);assert.notEqual(w.localStorage.getItem(KEY),before);
  }));
  fs.writeFileSync(path.join(root,'docs/verification-resilience.json'),JSON.stringify({passed:passed.length,failed:failures.length,checks:passed,failures,method:'Node.js/jsdom failure-path checks with synthetic records; no graphical browser, network calls, production credentials or deployment.'},null,2)+'\n');
  console.log(`${passed.length} passed; ${failures.length} failed.`);if(failures.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
