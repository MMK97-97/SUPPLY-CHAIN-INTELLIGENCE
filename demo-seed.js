/* Fictional portfolio fixtures. No customer records or services are copied into this workspace. */
(function () {
  'use strict';
  const W=window.StarkWorkspace, base=window.StarkSystemSeeds;
  if(!W?.isDemo || !base)return;
  const iso=d=>new Date(Date.now()+d*86400000).toISOString();
  const address=(name,line1,city,state,zip,country)=>({name,line1,line2:'',line3:'',city,state,zip,country});
  const models=[['AUDIO-01','Northline','Wireless studio headphones',144,28,89,129],['FRAME-02','Luma','Connected photo frame',18,22,64,109],['TRAVEL-03','Waypoint','Cabin travel case',210,16,76,139],['HOME-04','Luma','Desk lamp',0,19,25,49],['ACTIVE-05','Northline','Fitness tracker',92,34,48,89],['RETIRE-06','Waypoint','Travel accessory',62,0,12,25]];
  const regional={};
  for(const [index,code] of ['US','EU','CA'].entries()) {
    const key=code==='CA'?'Canada':code, db=code==='US'?'stark-regional-inventory':'stark-regional-inventory-'+code.toLowerCase();
    const rows=models.map(([model,brand,title,stock,demand,cost,price],i)=>({model,brand,product:title,status:i===5?'Discontinued':'Live',stockQty:Math.max(0,stock-index*(i+2)),available:Math.max(0,stock-index*(i+2)),openClient:0,openSupplier:i===1?30:0,avg3:demand+index*3,vol3:(demand+index*3)*3,last30:demand+index*4,leadTime:30,leadTimeMonths:1,ats:0,cost,standardPrice:price,supplierStart:iso(10).slice(0,10),supplierEnd:iso(10).slice(0,10),supplierDueQty:i===1?30:0,recommended:i===5?0:Math.max(0,Math.ceil((demand+index*3)*2+3-Math.max(0,stock-index*(i+2))-(i===1?30:0))),notes:'Fictional portfolio data'}));
    regional[code]={fileName:'DEMO-'+code+'-inventory.csv',importedAt:iso(0),rows};
    if(W.getDataset(db,'datasets',key)===undefined)W.setDataset(db,'datasets',key,regional[code]);
    if(!W.localStorage.getItem('stark-active-brands-'+key))W.localStorage.setItem('stark-active-brands-'+key,JSON.stringify({Northline:{active:true,leadTime:'30 days'},Luma:{active:true,leadTime:'30 days'},Waypoint:{active:true,leadTime:'30 days'}}));
  }
  function enterprise() {
    const e=base.enterprise();
    for(const k of Object.keys(e))if(Array.isArray(e[k]))e[k]=[];
    e.accounts=[
      {id:'demo_customer_us',name:'Atlas Recognition (Demo)',status:'ACTIVE',type:'PARENT',currency:'USD',terms:'Net 30',creditLimit:250000,creditUsed:1240,contact:'Demo customer',email:'atlas@example.invalid',customerAddress:address('Atlas Recognition','100 Demo Avenue','Sarasota','FL','34236','US'),shipToAddresses:[]},
      {id:'demo_customer_eu',name:'Orion Rewards (Demo)',status:'ACTIVE',type:'PARENT',currency:'EUR',terms:'Net 30',creditLimit:180000,creditUsed:850,contact:'Demo customer',email:'orion@example.invalid',customerAddress:address('Orion Rewards','10 Example Street','Berlin','BE','10115','DE'),shipToAddresses:[]},
      {id:'demo_customer_ca',name:'Maple Programs (Demo)',status:'ACTIVE',type:'PARENT',currency:'CAD',terms:'Net 30',creditLimit:160000,creditUsed:620,contact:'Demo customer',email:'maple@example.invalid',customerAddress:address('Maple Programs','20 Sample Road','Toronto','ON','M5V 1A1','CA'),shipToAddresses:[]}
    ];
    e.vendors=[{id:'demo_vendor',name:'Northline Distribution (Demo)',status:'ACTIVE',currency:'USD',terms:'Net 30',creditLine:500000,compliance:'VALID',contact:'Demo supplier',email:'supplier@example.invalid',slaTarget:97,leadTime:30,warehouses:[]}];
    e.inventory=Object.entries(regional).flatMap(([region,data])=>data.rows.map(r=>({sku:region+'::'+r.model,model:r.model,brand:r.brand,title:r.product,description:r.product,status:r.status,nature:'PHYSICAL',region,onHand:r.stockQty,reserved:0,externalReserved:0,damaged:0,safety:20,cost:r.cost,standardPrice:r.standardPrice,avgMonthly:r.avg3,warehouseId:'SARASOTA'})));
    for(const [index,region] of ['US','EU','CA'].entries())for(let n=0;n<12;n++){
      const account=e.accounts[index], item=e.inventory.find(i=>i.region===region&&i.model==='AUDIO-01'),shipped=n<7,delivered=n<5;
      e.orders.push({id:'demo_order_'+region+'_'+n,po:'DEMO-'+region+'-'+String(1000+n),orderNumber:'SO-DEMO-'+region+'-'+String(1000+n),region,accountId:account.id,type:n===11?'HOLD_PO':'FIRM_PO',status:delivered?'DELIVERED':shipped?'SHIPPED':n===11?'ALLOCATED':'PICKING',createdAt:iso(-n*2-1),updatedAt:iso(-n),inHandsDate:iso(shipped?-n+1:6).slice(0,10),holdUntil:n===11?iso(18):null,warehouseId:'SARASOTA',address:account.customerAddress,customerAddress:account.customerAddress,shipping:{method:'UPS_GROUND',carrier:'UPS',warehouseId:'SARASOTA',thirdParty:false},validation:{state:'VALIDATED',issues:[],checkedAt:iso(-n*2)},lines:[{sku:item.sku,model:item.model,title:item.title,description:item.description,qty:2,allocated:2,redeemed:0,shipped:shipped?2:0,price:item.standardPrice}],tracking:shipped?'DEMO-TRACK-'+region+'-'+n:'',deliveredAt:delivered?iso(-n):null});
    }
    e.purchaseOrders=['US','EU','CA'].map((region,index)=>({id:'demo_po_'+region,vendorId:'demo_vendor',po:'PO-DEMO-'+region+'-2001',region,purpose:'INVENTORY',status:'PO_ISSUED',issuedAt:iso(-4),eta:iso(index===0?-1:10),currency:region==='EU'?'EUR':region==='CA'?'CAD':'USD',carrier:'TBD',tracking:'',warehouse:'Sarasota',notes:'Fictional replenishment PO. Try adding tracking or receiving stock.',lines:[{sku:region+'::FRAME-02',model:'FRAME-02',vendorItem:'NL-FRAME',title:'Connected photo frame',description:'Demo frame',qty:30,received:0,cost:64}]}));
    e.inventory.push({sku:'US::DEMO-REWARD',model:'DEMO-REWARD',brand:'Northline',title:'$25 fictional digital reward',nature:'DIGITAL',region:'US',onHand:14,reserved:0,externalReserved:0,damaged:0,safety:4,cost:24,standardPrice:25,status:'Live'});
    e.vaultTokens=Array.from({length:14},(_,i)=>({id:'demo_token_'+i,sku:'US::DEMO-REWARD',vendorId:'demo_vendor',state:'AVAILABLE',masked:'DEMO-••••-'+(1000+i),createdAt:iso(-2)}));
    e.orders.push({id:'demo_digital_order',po:'DEMO-DIGITAL-1001',region:'US',accountId:'demo_customer_us',type:'FIRM_PO',status:'ALLOCATED',createdAt:iso(-1),updatedAt:iso(-1),lines:[{sku:'US::DEMO-REWARD',qty:2,allocated:2,redeemed:0,price:25}]});
    e.programs=[{id:'demo_program',accountId:'demo_customer_us',name:'Demo Recognition Program',code:'DEMO-Q4',start:iso(-20).slice(0,10),end:iso(60).slice(0,10),status:'LIVE'}];
    e.priceOverrides=[{id:'demo_price',accountId:'demo_customer_us',sku:'US::AUDIO-01',price:119,minQty:5,effective:iso(-20).slice(0,10)}];
    e.vendorPriceBooks=e.inventory.filter(i=>i.region==='US').map((i,n)=>({id:'demo_vprice_'+n,vendorId:'demo_vendor',sku:i.sku,cost:i.cost,minQty:1,tier:'Demo base price',currency:'USD'}));
    e.slaLogs=[{id:'demo_sla',vendorId:'demo_vendor',period:new Date().toISOString().slice(0,7),targetDays:30,actualDays:32,onTimePct:94,apiLatencyMs:null}];
    e.activity=[{time:iso(0),text:'Portfolio demo opened with fictional regional inventory',kind:'system'}];
    return e;
  }
  function logistics() {
    const l=base.logistics();
    for(const k of Object.keys(l))if(Array.isArray(l[k])&&!['warehouses','bins'].includes(k))l[k]=[];
    l.warehouses=[{id:'SARASOTA',name:'Sarasota',code:'SRQ',city:'Sarasota',state:'FL',status:'ACTIVE',timezone:'America/New_York',dockDoors:6,cutoff:'16:30',manager:'Demo operations'},{id:'FARMERS_BRANCH',name:'Farmers Branch',code:'DFW',city:'Farmers Branch',state:'TX',status:'ACTIVE',timezone:'America/Chicago',dockDoors:4,cutoff:'16:00',manager:'Demo operations'}];
    l.bins.forEach(b=>{b.capacity=3000;b.used=0;});
    l.inventory=enterprise().inventory.filter(i=>i.nature!=='DIGITAL').map(i=>({sku:i.sku,brand:i.brand,description:i.title,binId:'A-01-R1-B1',warehouseId:'SARASOTA',onHand:i.onHand,reserved:0,damaged:0,serialized:false,lotControl:false,lastCount:iso(-5)}));
    l.waves=[{id:'DEMO-WAVE-US-1007',status:'READY',priority:'NORMAL',createdAt:iso(-.2),orders:['DEMO-US-1007'],orderIds:['demo_order_US_7'],sku:'US::AUDIO-01',qty:2,binId:'A-01-R1-B1',picker:'Unassigned',picked:0}];
    l.tplNodes=[{id:'demo_3pl',name:'Demo Partner Fulfillment',status:'ACTIVE',region:'US',state:'TX',cutoff:'17:00',handlingCost:2,shipCost:8,slaHours:24,apiStatus:'SIMULATED'}];
    l.tplInventory=enterprise().inventory.filter(i=>i.region==='US').map(i=>({nodeId:'demo_3pl',sku:i.sku,qty:120,reserved:0,variation:true,updatedAt:iso(0)}));
    l.packing=enterprise().orders.filter(o=>['SHIPPED','DELIVERED'].includes(o.status)).map(o=>({id:'demo_pack_'+o.id,orderId:o.id,order:o.po,sku:o.lines[0].sku,qty:2,status:'SHIPPED',carrier:'UPS',service:'UPS_GROUND',tracking:o.tracking,shippedAt:iso(-Number(o.id.split('_').at(-1))),warehouseId:'SARASOTA'}));
    return l;
  }
  window.StarkSystemSeeds={enterprise,logistics};
  window.StarkDemoFixtures={regional};
  // Seed local analyst preferences; demo analysis works without a remote AI request.
  if(!W.localStorage.getItem('mk-analyst-v4'))W.localStorage.setItem('mk-analyst-v4',JSON.stringify({aiEnabled:false,monitor:true,autoAI:false,depth:'Deep'}));
})();
