'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const B=require('../business-core.js'),C=require('../operations-core.js');
const src=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const sku='PHYS-SONY-WH1000XM5',now=new Date('2026-11-04T15:00:00Z'),today='2026-11-04';
const json=value=>JSON.stringify(value);
function fixture({role='owner',demo=true,saved}={}){
  const memory=saved||new Map();
  const context={document:{currentScript:{src:'https://example.test/erp/assets/system-core.js'}},URL,Date,Intl,crypto:crypto.webcrypto,CustomEvent:class{},addEventListener(){},dispatchEvent(){},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
  context.window=context;
  const workspace=context.StarkWorkspace={isDemo:demo,rootURL:new URL('https://example.test/erp/'),localStorage:context.localStorage};
  const cloud=context.StarkSystemCloud={getAccess:()=>({ready:true,userId:'user-1',organizationId:'organization-1',role}),canCancelOrders:()=>true};
  vm.createContext(context);
  for(const f of ['business-core.js','system-seed.js','system-core.js'])vm.runInContext(src(f),context,{filename:f});
  const S=context.StarkSystem;
  if(!saved)S.transaction('FIXTURE','Synthetic inventory and sales',s=>{
    const item=s.enterprise.inventory.find(i=>i.sku===sku);
    Object.assign(item,{onHand:20,damaged:2,externalReserved:3,safety:2,status:'ACTIVE'});
    s.enterprise.orders=[{id:'sold',po:'SOLD-1',region:'US',type:'FIRM_PO',status:'DELIVERED',accountId:s.enterprise.accounts[0].id,deliveredAt:'2026-11-01T16:00:00Z',lines:[{sku,qty:5,shipped:4,price:10},{sku,qty:2,shipped:2,price:10}]}];
    s.enterprise.purchaseOrders=[];
    s.logistics.inventory=s.logistics.inventory.filter(i=>i.sku!==sku);
    s.logistics.inventory.push({sku,region:'US',binId:'RETURN-BIN',onHand:20,damaged:2,reserved:3});
    s.logistics.bins.push({id:'RETURN-BIN',capacity:40,active:true});
    s.logistics.receipts=[];s.logistics.putaway=[];s.logistics.tplShipments=[];s.logistics.packing=[];
  });
  return {S,memory,workspace,cloud};
}
function save(f,settings,expected=json(f.S.getState().businessProfile||null)){
  return B.save(f.S,settings,{expected,workspace:f.workspace,cloud:f.cloud});
}
const sale=(f,qty=3)=>B.createReturn(f.S,{orderId:'sold',sku,qty,reason:'Broken seal'},{now,cloud:f.cloud});
const report=S=>C.snapshot(S.getState(),{region:'US',today});
const stock=S=>report(S).availability.find(i=>i.sku===sku);
const location=S=>S.getState().logistics.inventory.find(i=>i.sku===sku&&i.binId==='RETURN-BIN');
test('business defaults preserve existing shipping lead and regional overrides inherit individually',()=>{
  const f=fixture();
  assert.equal(B.shipDate(f.S.getState(),'US','2026-11-09'),'2026-11-01');
  const p=B.template('industrial');p.regions.CA={shipLeadDays:3,horizon:21};
  save(f,p);
  assert.equal(B.shipDate(f.S.getState(),'CA','2026-11-09'),'2026-11-04');
  assert.equal(B.policy(f.S.getState(),'CA').shipCalendar,'weekdays');
  assert.equal(B.policy(f.S.getState(),'US').horizon,90);
  assert.equal(B.shipDate(f.S.getState(),'CA','2026-02-30'),'');
  assert.equal(B.shipDate({businessProfile:{...p,regions:{CA:{shipLeadDays:0}}}},'CA','2026-11-08'),'2026-11-06');
});
test('policy persists across reload and profile changes cannot overwrite another save',()=>{
  const f=fixture(),p=B.template('commerce');p.name='Test Business';save(f,p);
  const reloaded=fixture({saved:f.memory});
  assert.equal(reloaded.S.getBusinessProfile().name,p.name);
  assert.equal(B.enabled(reloaded.S.getState(),'tpl'),false);
  assert.throws(()=>save(f,B.template('custom'),'null'),/another tab/);
  assert.equal(f.S.getState().audit[0].action,'BUSINESS_SETTINGS_UPDATED');
});
test('rejects malformed profiles and unauthorized writes through both APIs',()=>{
  const f=fixture({role:'editor',demo:false});
  const p=B.template('custom');
  assert.throws(()=>save(f,p),/owners and admins/);
  assert.throws(()=>f.S.transaction('SET','',s=>{s.businessProfile=p;}),/owners and admins/);
  const g=fixture({demo:false,role:'admin'});save(g,p);
  for(const patch of [{policies:{...p.policies,horizon:0}},{modules:['orders']},{regions:{XX:{horizon:21}}},{services:{returns:'false',invoices:true}}]){
    assert.throws(()=>save(g,{...p,...patch}),/Invalid business settings/);
  }
});
test('planning uses the regional floor and window; draft demand is explicit and does not reserve stock',()=>{
  const f=fixture(),p=B.template('custom');
  p.regions.US={horizon:14,safetyFloor:20,includeDraftDemand:'yes',orderAlertDays:5};save(f,p);
  f.S.transaction('FIXTURE','',s=>{
    const draft=(id,due,qty,extra={})=>({id,po:id,region:'US',type:'FIRM_PO',status:'ISSUES',accountId:s.enterprise.accounts[0].id,inHandsDate:due,validation:{state:'ISSUES'},lines:[{sku,qty,price:10}],...extra});
    s.enterprise.orders.push(draft('eligible','2026-11-08',8),draft('far','2026-11-25',3),draft('undated','',1),draft('external','2026-11-06',20,{fulfillment:{kind:'3PL'}}));
    s.enterprise.purchaseOrders.push({id:'near-po',po:'near-po',region:'US',vendorId:s.enterprise.vendors[0].id,status:'CONFIRMED',eta:'2026-11-14',lines:[{sku,qty:4,cost:10}]},{id:'far-po',po:'far-po',region:'US',vendorId:s.enterprise.vendors[0].id,status:'CONFIRMED',eta:'2026-11-30',lines:[{sku,qty:99,cost:10}]});
  });
  const row=stock(f.S);
  assert.equal(report(f.S).horizon,14);assert.equal(row.available,15);assert.equal(row.draftDemand,12);assert.equal(row.planningDemand,8);assert.equal(row.suggestedBuy,9);
  assert.ok(report(f.S).issues.some(x=>x.key==='due-order:eligible'));
  f.S.transaction('FIXTURE','',s=>{s.enterprise.inventory.find(i=>i.sku===sku).status='Discontinued';});
  assert.equal(stock(f.S).suggestedBuy,0);
});
test('a stale procurement proposal cannot create a purchase or receipt',()=>{
  const f=fixture(),s=f.S.getState();
  const input={po:'NEW-PO',purpose:'INVENTORY',vendorId:s.enterprise.vendors.find(v=>v.status==='ACTIVE').id,region:'US',eta:'2026-11-21',warehouse:'Warehouse',lines:[{sku,qty:7,cost:10}]};
  const revision=s.revision;save(f,B.template('distributor'));
  assert.throws(()=>f.S.createPurchaseOrder(input,revision),/changed/);
  const id=f.S.createPurchaseOrder(input,f.S.getState().revision);
  const after=f.S.getState();
  assert.equal(after.enterprise.purchaseOrders.find(p=>p.id===id).lines[0].qty,7);
  assert.equal(after.logistics.receipts.find(r=>r.po==='NEW-PO').status,'SCHEDULED');
  assert.throws(()=>f.S.createPurchaseOrder(input),/unique/);
});
test('authorizations reserve shipped quantity across repeat lines and reject excess, expired and duplicate claims',()=>{
  const f=fixture(),p=B.template('custom');p.regions.US={returnsWindowDays:7};save(f,p);
  assert.equal(B.returnOrder(f.S.getState(),'sold',{now}).lines[0].remaining,6);
  const first=sale(f,4);assert.throws(()=>sale(f,3),/remaining shipped/);
  assert.ok(report(f.S).issues.some(x=>x.key==='return:'+first));
  B.cancelReturn(f.S,first,{now});assert.equal(B.returnOrder(f.S.getState(),'sold',{now}).lines[0].remaining,6);
  assert.equal(B.returnOrder(f.S.getState(),'sold',{now:new Date('2026-11-10T12:00:00Z')}),null);
});
test('receipt posts to the exact bin once, quarantines units and never reverses the original sale',()=>{
  const f=fixture(),id=sale(f,3),s0=f.S.getState(),before=location(f.S);
  const request={restock:1,quarantine:1,discard:1,binId:'RETURN-BIN',inspection:'Inspected 3'};
  assert.throws(()=>B.receiveReturn(f.S,id,{...request,binId:'another-bin'},{now}),/stock location/);
  assert.throws(()=>B.receiveReturn(f.S,id,{...request,discard:2},{now}),/every authorized unit/);
  B.receiveReturn(f.S,id,request,{now,cloud:f.cloud});
  const after=f.S.getState(),bin=location(f.S);
  assert.equal(bin.onHand,before.onHand+2);assert.equal(bin.damaged,before.damaged+1);
  assert.equal(stock(f.S).available,16);
  assert.equal(json(after.enterprise.orders),json(s0.enterprise.orders));
  assert.equal(after.logistics.movements.filter(m=>m.ref===id).length,2);
  assert.equal(after.customerReturns[0].status,'RECEIVED');
  assert.equal(report(f.S).issues.some(x=>x.key==='return:'+id),false);
  assert.throws(()=>B.receiveReturn(f.S,id,request,{now}),/no longer awaiting/);
  assert.equal(location(f.S).onHand,22);
});
test('disablement blocks new authorizations and invoices while letting open returns finish',()=>{
  const f=fixture(),id=sale(f,1),p=B.template('custom');
  p.services={returns:false,invoices:false};save(f,p);
  assert.throws(()=>sale(f,1),/disabled/);
  assert.throws(()=>C.saveInvoice(f.S,{number:'BILL'},{expectedRevision:f.S.getState().revision}),/disabled/);
  B.receiveReturn(f.S,id,{restock:0,quarantine:0,discard:1,inspection:'Discarded'},{now});
  assert.equal(location(f.S).onHand,20);
});
test('a returns case cannot post into a full location or erase from a rejected commit',()=>{
  const f=fixture(),id=sale(f,3);
  f.S.transaction('FIXTURE','',s=>{s.logistics.bins.find(b=>b.id==='RETURN-BIN').capacity=21;});
  assert.throws(()=>B.receiveReturn(f.S,id,{restock:2,quarantine:0,discard:1,binId:'RETURN-BIN',inspection:'Inspected'},{now}),/capacity/);
  assert.equal(f.S.getState().customerReturns[0].status,'AUTHORIZED');
  assert.equal(location(f.S).onHand,20);
});
