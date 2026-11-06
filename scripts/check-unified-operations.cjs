'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),C=require('../operations-core.js');
const today='2026-11-04',sku='PHYS-SONY-WH1000XM5';
const copy=x=>JSON.parse(JSON.stringify(x));
function system(saved) {
  const storage=new Map(saved||[]);
  const context={document:{currentScript:{src:'https://example.test/erp/assets/system-core.js'}},URL,Date,Intl,crypto:crypto.webcrypto,CustomEvent:class{},addEventListener(){},dispatchEvent(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
  context.window=context;
  context.StarkWorkspace={isDemo:true,rootURL:new URL('https://example.test/erp/'),localStorage:context.localStorage};
  vm.createContext(context);
  for(const file of ['system-seed.js','system-core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  return {S:context.StarkSystem,storage};
}
function po(id,changes={}) {
  return {id,po:id,region:'US',vendorId:'vend_sony',currency:'USD',status:'DISPATCHED',eta:'2026-11-07',purpose:'INVENTORY',lines:[{sku,qty:10,cost:12.3456,received:0}],...changes};
}
function fixture() {
  const {S,storage}=system();
  S.transaction('TEST_FIXTURE','Isolated synthetic operations records',s=>{
    s.enterprise.orders=[];
    s.enterprise.purchaseOrders=[po('OPS-PO-01',{lines:[{sku,qty:20,cost:12.3456,received:10}]})];
    s.logistics.receipts=[];s.logistics.putaway=[];s.logistics.cycleCounts=[];s.logistics.tplRequests=[];
    const i=s.enterprise.inventory.find(i=>i.sku===sku);Object.assign(i,{onHand:30,externalReserved:8,damaged:2,safety:25});
  });
  return {S,storage,state:copy(S.getState())};
}
const bill=(changes={})=>({poId:'OPS-PO-01',number:'BILL-001',date:today,currency:'USD',lines:[{sku,qty:4,price:'12.3456'}],...changes});
const stock=(state,opts)=>C.snapshot(state,{region:'US',today,horizon:7,...opts}).availability.find(row=>row.sku===sku);
const save=(S,input,opts)=>C.saveInvoice(S,input,{expectedRevision:S.getState().revision,...opts});
test('stock projects from net inventory without subtracting committed demand twice',()=>{
  const {state}=fixture();
  assert.equal(stock(state).available,20);
  assert.equal(stock(state).confirmed,10);
  assert.equal(stock(state).projected,30);
});
test('inbound must be confirmed, dated and within the selected region and horizon',()=>{
  const {state}=fixture();
  state.enterprise.purchaseOrders.push(po('DRAFT',{status:'DRAFT'}),po('UNCERTAIN',{status:'PO_ISSUED'}),po('CROSS-REGION',{region:'CA'}),po('DROP',{purpose:'DROPSHIP'}),po('FAR',{eta:'2026-11-20'}),po('OVERDUE',{eta:'2026-11-03'}),po('INVALID-ETA',{eta:'2026-11-31'}));
  assert.equal(stock(state).confirmed,10);
  assert.equal(stock(state).excluded,40);
  assert.equal(stock(state,{horizon:30}).confirmed,20);
});
test('recorded putaway units are excluded from inbound only once across repeated SKU lines',()=>{
  const {state}=fixture();const p=state.enterprise.purchaseOrders[0];
  p.lines=[{sku,qty:8,cost:1,received:0},{sku,qty:12,cost:1,received:3}];
  state.logistics.receipts=[{id:'receipt',po:p.po,status:'PUTAWAY',lines:[{sku,received:6,damaged:1,damagePosted:0}]}];
  state.logistics.putaway=[{receiptId:'receipt',sku,qty:3,status:'COMPLETE'}];
  const row=stock(state);assert.equal(row.staged,4);assert.equal(row.confirmed,13);assert.equal(row.projected,33);
});
test('open but unvalidated demand is shown separately and uncertain stock is not committed',()=>{
  const {state}=fixture();
  state.enterprise.orders.push({id:'draft',po:'Draft 33',region:'US',status:'ISSUES',type:'FIRM_PO',validation:{state:'ISSUES',issues:[{code:'NO_INVENTORY',label:'No inventory'}]},lines:[{sku,qty:9}]});
  const model=C.snapshot(state,{region:'US',today});
  assert.equal(stock(state).draftDemand,9);assert.equal(stock(state).available,20);
  assert.equal(model.issues.find(x=>x.key==='validation:draft').path,'order-management/unvalidated.html?search=Draft%2033');
});
test('inbound first covers a reservation deficit before projecting free stock',()=>{
  const {state}=fixture();
  state.enterprise.inventory.find(i=>i.sku===sku).reserved=34;
  const row=stock(state);assert.equal(row.overcommitted,6);assert.equal(row.available,0);assert.equal(row.projected,4);
});
test('invoice evidence uses posted usable receipts, not pre-entered staging',()=>{
  const {state}=fixture();
  state.logistics.receipts=[{id:'receipt',po:'OPS-PO-01',status:'ARRIVED',lines:[{sku,received:7,damaged:2,damagePosted:2}]}];
  const result=C.compareInvoice(state,bill({lines:[{sku,qty:9,price:12.3456}]}));
  assert.equal(result.lines[0].received,8);assert.equal(result.status,'EXCEPTION');assert.match(result.flags.join(' '),/unbilled posted receipts/);
});
test('matches retain exact four-decimal unit prices and do not change operational balances',()=>{
  const {S,storage}=fixture(),before=S.getState();
  const id=save(S,bill());
  const after=S.getState(),row=after.invoiceReviews.find(r=>r.id===id);
  assert.equal(row.status,'MATCHED');assert.equal(row.total,49.3824);
  assert.deepEqual(copy(after.enterprise),copy(before.enterprise));assert.deepEqual(copy(after.logistics),copy(before.logistics));
  assert.equal(system([...storage]).S.getState().invoiceReviews[0].number,'BILL-001');
  assert.equal(after.audit[0].action,'INVOICE_REVIEW_SAVED');
});
test('partial matches cannot reuse receipt units or duplicate a supplier reference',()=>{
  const {S}=fixture();
  save(S,bill({lines:[{sku,qty:6,price:12.3456}]}));
  const current=S.getState();
  const second=C.compareInvoice(current,bill({number:'BILL-002',lines:[{sku,qty:5,price:12.3456}]}));
  assert.equal(second.status,'EXCEPTION');assert.equal(second.lines[0].priorQty,6);assert.equal(second.lines[0].unbilled,4);
  assert.throws(()=>save(S,bill({number:' bill-001 '})),/already/);assert.deepEqual(S.getState(),current);
});
test('comparison flags wrong currency, price, off-PO SKU and ambiguous mixed prices',()=>{
  const {state}=fixture();
  state.enterprise.purchaseOrders[0].lines.push({sku,qty:1,cost:24,received:1});
  const x=C.compareInvoice(state,bill({currency:'EUR',lines:[{sku,qty:1,price:1},{sku:'UNKNOWN',qty:1,price:1}]}));
  assert.equal(x.status,'EXCEPTION');assert.match(x.flags.join(' '),/Currency mismatch.*differs across lines.*not on this PO/);
});
test('receipt matching refuses cancelled, draft and dropship PO evidence',()=>{
  const {state}=fixture();
  for(const changes of [{status:'CANCELLED'},{status:'DRAFT'},{purpose:'DROPSHIP'}]){
    const sample=copy(state);Object.assign(sample.enterprise.purchaseOrders[0],changes);
    assert.equal(C.compareInvoice(sample,bill()).status,'EXCEPTION');
  }
});
test('duplicate PO references are excluded from estimates and cannot match a bill',()=>{
  const {state}=fixture();
  state.enterprise.purchaseOrders.push(po('different-id',{po:'OPS-PO-01'}));
  assert.equal(stock(state).confirmed,0);
  assert.match(C.compareInvoice(state,bill()).flags.join(' '),/duplicated/);
});
test('stale comparison refuses a save after another receipt or invoice changed',()=>{
  const {S}=fixture(),revision=S.getState().revision;
  save(S,bill({number:'NEWER-BILL'}));const before=S.getState();
  assert.throws(()=>C.saveInvoice(S,bill(),{expectedRevision:revision}),/changed/);
  assert.deepEqual(S.getState(),before);
});
test('exception can be rechecked, keeps its ID and freezes once matched',()=>{
  const {S}=fixture();
  const id=save(S,bill({lines:[{sku,qty:1,price:'13'}]}));
  assert.equal(S.getState().invoiceReviews[0].status,'EXCEPTION');
  assert.equal(save(S,bill(),{id}),id);
  assert.equal(S.getState().invoiceReviews.length,1);
  assert.throws(()=>save(S,bill(),{id}),/already matched/);
});
test('exceptions create one linked active task in the existing workspace',()=>{
  const {S}=fixture(),model=C.snapshot(S.getState(),{region:'US',today});
  const issue=model.issues.find(i=>i.key==='stock-buffer:'+sku);
  const id=C.createFollowUp(S,issue.key,{region:'US',today,user:'test-user'});
  const task=S.getState().tasks.find(t=>t.id===id);
  assert.equal(task.ownerUserId,'test-user');assert.equal(task.sourcePath,issue.path);
  assert.equal(C.snapshot(S.getState(),{region:'US',today}).issues.find(i=>i.key===issue.key).taskId,id);
  assert.throws(()=>C.createFollowUp(S,issue.key,{region:'US',today}),/already exists/);
});
test('workspace reset clears the invoice register together with purchasing records',()=>{
  const {S}=fixture();save(S,bill());S.clearWorkspace();
  assert.equal(S.getState().invoiceReviews.length,0);
});
test('calendar uses New York operations day and rejects impossible invoice dates',()=>{
  assert.equal(C.businessDay(new Date('2026-11-04T03:00:00Z')),'2026-11-03');
  assert.throws(()=>C.compareInvoice(fixture().state,bill({date:'2026-02-30'})),/valid invoice date/);
});
