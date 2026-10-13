(function(){
"use strict";
const plusHours=h=>new Date(Date.now()+h*36e5).toISOString();
const plusDays=d=>new Date(Date.now()+d*864e5).toISOString();
function enterprise(){
 const today=new Date();
 const plus=d=>{const x=new Date(today);x.setDate(x.getDate()+d);return x.toISOString()};
 return {
  version:1,
  accounts:[
   {id:'acct_northstar',name:'Northstar Rewards Group',type:'PARENT',parentId:null,status:'ACTIVE',currency:'USD',terms:'Net 30',creditLimit:250000,creditUsed:131500,contact:'Sarah Chen',email:'ops@northstar.example'},
   {id:'acct_northstar_auto',name:'Northstar Auto Programs',type:'CHILD',parentId:'acct_northstar',status:'ACTIVE',currency:'USD',terms:'Net 30',creditLimit:125000,creditUsed:58700,contact:'Mike Lane',email:'auto@northstar.example'},
   {id:'acct_apex',name:'Apex Incentives',type:'PARENT',parentId:null,status:'ACTIVE',currency:'USD',terms:'Net 45',creditLimit:180000,creditUsed:42100,contact:'Priya Shah',email:'fulfillment@apex.example'},
   {id:'acct_meridian',name:'Meridian Recognition',type:'PARENT',parentId:null,status:'REVIEW',currency:'USD',terms:'Prepaid',creditLimit:90000,creditUsed:81750,contact:'James Ortiz',email:'buying@meridian.example'}
  ],
  programs:[
   {id:'prog_nsa_q4',accountId:'acct_northstar_auto',name:'Q4 Dealer Excellence',code:'NSA-Q4-2026',start:'2026-10-01',end:'2026-11-30',status:'LIVE'},
   {id:'prog_apex_holiday',accountId:'acct_apex',name:'Holiday Choice Awards',code:'APX-HOL-26',start:'2026-10-15',end:'2026-12-20',status:'LIVE'},
   {id:'prog_meridian_spot',accountId:'acct_meridian',name:'Spot Recognition',code:'MER-SPOT',start:'2026-09-01',end:'2027-02-28',status:'LIVE'}
  ],
  inventory:[
   {sku:'PHYS-SONY-WH1000XM5',model:'WH1000XM5',brand:'Sony',title:'Wireless Noise Canceling Headphones',nature:'PHYSICAL',onHand:168,reserved:32,safety:45,cost:278,standardPrice:349},
   {sku:'PHYS-APPLE-AIRPODS-PRO2',model:'MTJV3AM/A',brand:'Apple',title:'AirPods Pro 2',nature:'PHYSICAL',onHand:212,reserved:36,safety:60,cost:185,standardPrice:249},
   {sku:'PHYS-KS-4217709208',model:'4217709208',brand:'Kendra Scott',title:'Designer Jewelry Item',nature:'PHYSICAL',onHand:74,reserved:25,safety:30,cost:62,standardPrice:110},
   {sku:'PHYS-AURA-CARVER',model:'AF-200',brand:'Aura Frames',title:'Carver HD Digital Frame',nature:'PHYSICAL',onHand:31,reserved:16,safety:28,cost:126,standardPrice:149},
   {sku:'DIGI-AMZ-100',model:'AMZ-100',brand:'Amazon',title:'$100 Digital Reward Code',nature:'DIGITAL',onHand:560,reserved:80,safety:150,cost:98,standardPrice:100},
   {sku:'DIGI-VISA-50',model:'VISA-50',brand:'Visa',title:'$50 Digital Reward Token',nature:'DIGITAL',onHand:190,reserved:40,safety:120,cost:49.1,standardPrice:50}
  ],
  priceOverrides:[
   {id:'pb1',accountId:'acct_northstar',sku:'PHYS-SONY-WH1000XM5',price:326,minQty:25,effective:'2026-07-01'},
   {id:'pb2',accountId:'acct_apex',sku:'PHYS-APPLE-AIRPODS-PRO2',price:229,minQty:50,effective:'2026-08-15'},
   {id:'pb3',accountId:'acct_northstar_auto',sku:'DIGI-AMZ-100',price:99,minQty:100,effective:'2026-09-01'}
  ],
  orders:[
   {id:'ord_hold_87366',accountId:'acct_northstar_auto',programId:'prog_nsa_q4',type:'HOLD_PO',status:'ALLOCATED',po:'87366-HOLD',parentHoldId:null,creditCode:'AUTH-8J2K',holdUntil:plus(18),createdAt:plus(-11),updatedAt:plus(-1),shipping:null,lines:[{sku:'PHYS-SONY-WH1000XM5',qty:50,allocated:50,redeemed:18,price:326}]},
   {id:'ord_red_87366_01',accountId:'acct_northstar_auto',programId:'prog_nsa_q4',type:'REDEMPTION_PO',status:'SHIPPED',po:'87366-R001',parentHoldId:'ord_hold_87366',createdAt:plus(-6),updatedAt:plus(-4),shipping:{name:'A. Winner',city:'Tampa',state:'FL'},lines:[{sku:'PHYS-SONY-WH1000XM5',qty:8,allocated:8,price:326}]},
   {id:'ord_red_87366_02',accountId:'acct_northstar_auto',programId:'prog_nsa_q4',type:'REDEMPTION_PO',status:'PICKING',po:'87366-R002',parentHoldId:'ord_hold_87366',createdAt:plus(-2),updatedAt:plus(-1),shipping:{name:'Batch winners',city:'Orlando',state:'FL'},lines:[{sku:'PHYS-SONY-WH1000XM5',qty:10,allocated:10,price:326}]},
   {id:'ord_bulk_88211',accountId:'acct_apex',programId:'prog_apex_holiday',type:'BULK_PO',status:'PICKING',po:'88211',parentHoldId:null,createdAt:plus(-3),updatedAt:plus(-1),shipping:{warehouse:'Apex DC 03',city:'Dallas',state:'TX',marks:'APX-HOL / DC03 / PALLET 1-3'},lines:[{sku:'PHYS-APPLE-AIRPODS-PRO2',qty:120,allocated:120,price:229}]},
   {id:'ord_firm_88405',accountId:'acct_apex',programId:'prog_apex_holiday',type:'FIRM_PO',status:'ALLOCATED',po:'88405',parentHoldId:null,createdAt:plus(-1),updatedAt:plus(-1),shipping:{name:'Digital batch'},lines:[{sku:'DIGI-AMZ-100',qty:80,allocated:80,price:99}]}
  ],
  vendors:[
   {id:'vend_sony',name:'Sony Electronics',status:'ACTIVE',currency:'USD',terms:'Net 30',creditLine:500000,compliance:'VALID',contact:'Vendor Operations',email:'orders@sony.example',slaTarget:98.5,leadTime:7,warehouses:[{id:'wh_sony_east',name:'East Distribution Hub',region:'US East',city:'Atlanta',state:'GA'}]},
   {id:'vend_apple',name:'Apple Distribution',status:'ACTIVE',currency:'USD',terms:'Net 15',creditLine:750000,compliance:'VALID',contact:'B2B Supply',email:'b2b@apple.example',slaTarget:99,leadTime:5,warehouses:[{id:'wh_apple_sc',name:'Southeast Fulfillment',region:'US South',city:'Greenville',state:'SC'}]},
   {id:'vend_ks',name:'Kendra Scott Wholesale',status:'AUDIT_WARNING',currency:'USD',terms:'Net 30',creditLine:175000,compliance:'REVIEW',contact:'Wholesale Desk',email:'wholesale@ks.example',slaTarget:96,leadTime:10,warehouses:[{id:'wh_ks_tx',name:'Central Warehouse',region:'US Central',city:'Austin',state:'TX'}]},
   {id:'vend_codes',name:'Global Voucher Aggregator',status:'ACTIVE',currency:'USD',terms:'Prepaid',creditLine:300000,compliance:'VALID',contact:'API Support',email:'api@voucher.example',slaTarget:99.5,leadTime:0,warehouses:[{id:'srv_east',name:'US-East Token Gateway',region:'Digital',city:'',state:''}]}
  ],
  vendorPriceBooks:[
   {id:'vpb1',vendorId:'vend_sony',sku:'PHYS-SONY-WH1000XM5',cost:278,minQty:25,tier:'50+ units: $268',currency:'USD'},
   {id:'vpb2',vendorId:'vend_apple',sku:'PHYS-APPLE-AIRPODS-PRO2',cost:185,minQty:50,tier:'250+ units: $178',currency:'USD'},
   {id:'vpb3',vendorId:'vend_ks',sku:'PHYS-KS-4217709208',cost:62,minQty:20,tier:'100+ units: 55% off MSRP',currency:'USD'},
   {id:'vpb4',vendorId:'vend_codes',sku:'DIGI-AMZ-100',cost:98,minQty:100,tier:'1000+ codes: 2.5% discount',currency:'USD'}
  ],
  purchaseOrders:[
   {id:'vpo_887411',vendorId:'vend_sony',po:'PO-2026-887411',status:'DISPATCHED',issuedAt:plus(-8),eta:plus(1),warehouse:'East Distribution Hub',carrier:'FEDEX_PRIORITY_OVERNIGHT',tracking:'TRK772839410192',lines:[{sku:'PHYS-SONY-WH1000XM5',qty:50,received:0,cost:268}]},
   {id:'vpo_887480',vendorId:'vend_apple',po:'PO-2026-887480',status:'PENDING_ARRIVAL',issuedAt:plus(-4),eta:plus(3),warehouse:'Southeast Fulfillment',carrier:'UPS_GROUND',tracking:'1ZDEMO887480',lines:[{sku:'PHYS-APPLE-AIRPODS-PRO2',qty:150,received:0,cost:182}]},
   {id:'vpo_887522',vendorId:'vend_ks',po:'PO-2026-887522',status:'PO_ISSUED',issuedAt:plus(-1),eta:plus(9),warehouse:'Central Warehouse',carrier:'TBD',tracking:'',lines:[{sku:'PHYS-KS-4217709208',qty:100,received:0,cost:60}]}
  ],
  slaLogs:[
   {id:'sla1',vendorId:'vend_sony',period:'Sep 2026',targetDays:7,actualDays:6.8,onTimePct:99.2,apiLatencyMs:null},
   {id:'sla2',vendorId:'vend_apple',period:'Sep 2026',targetDays:5,actualDays:5.1,onTimePct:97.4,apiLatencyMs:null},
   {id:'sla3',vendorId:'vend_ks',period:'Sep 2026',targetDays:10,actualDays:12.7,onTimePct:88.5,apiLatencyMs:null},
   {id:'sla4',vendorId:'vend_codes',period:'Sep 2026',targetDays:0,actualDays:0,onTimePct:99.7,apiLatencyMs:386}
  ],
  vaultTokens:[
   ...Array.from({length:36},(_,i)=>({id:`tok_amz_${i+1}`,vendorId:'vend_codes',sku:'DIGI-AMZ-100',state:i<8?'DISPATCHED':'AVAILABLE',masked:`AMZ-••••-${String(7700+i).padStart(4,'0')}`,createdAt:plus(-8)})),
   ...Array.from({length:18},(_,i)=>({id:`tok_visa_${i+1}`,vendorId:'vend_codes',sku:'DIGI-VISA-50',state:i<4?'DISPATCHED':'AVAILABLE',masked:`V50-••••-${String(4300+i).padStart(4,'0')}`,createdAt:plus(-5)}))
  ],
  apiKeys:[{id:'key_1',accountId:'acct_northstar',label:'Production fulfillment',prefix:'sk_live_nst_••••93KQ',createdAt:plus(-91),lastUsed:plus(-1),status:'ACTIVE'},{id:'key_2',accountId:'acct_apex',label:'Sandbox integration',prefix:'sk_test_apx_••••4L2A',createdAt:plus(-35),lastUsed:plus(-3),status:'ACTIVE'}],
  webhookLogs:[{id:'wh1',accountId:'acct_northstar',event:'shipment.updated',status:200,time:plus(-1),endpoint:'https://api.northstar.example/hooks/stark'},{id:'wh2',accountId:'acct_apex',event:'order.accepted',status:200,time:plus(-2),endpoint:'https://integrations.apex.example/stark'},{id:'wh3',accountId:'acct_apex',event:'voucher.dispatched',status:500,time:plus(-2),endpoint:'https://integrations.apex.example/stark'}],
  activity:[{time:plus(-.04),text:'Redemption 87366-R002 moved to Picking',kind:'order'},{time:plus(-.08),text:'Sony PO-2026-887411 dispatch notice received',kind:'vendor'},{time:plus(-.12),text:'Apex contract price book synchronized',kind:'crm'}]
 };
}
function logistics(){
 return {version:2,
  warehouses:[
   {id:'wh_stark_se',name:'Stark Southeast Distribution Center',code:'SE-01',city:'Tampa',state:'FL',status:'ACTIVE',timezone:'America/New_York',dockDoors:6,cutoff:'16:30',manager:'Warehouse Operations'},
  ],
  bins:[
   {id:'RCV-01',zone:'RECEIVING',aisle:'RCV',rack:'01',level:'FLOOR',maxWeightKg:1800,capacity:240,used:74,active:true},
   {id:'A-01-R1-B1',zone:'FAST_PICK',aisle:'A-01',rack:'R1',level:'B1',maxWeightKg:450,capacity:120,used:82,active:true},
   {id:'A-01-R1-B2',zone:'FAST_PICK',aisle:'A-01',rack:'R1',level:'B2',maxWeightKg:450,capacity:120,used:58,active:true},
   {id:'B-04-R2-B1',zone:'BULK',aisle:'B-04',rack:'R2',level:'B1',maxWeightKg:1200,capacity:280,used:212,active:true},
   {id:'B-07-R1-B1',zone:'BULK',aisle:'B-07',rack:'R1',level:'B1',maxWeightKg:1200,capacity:320,used:134,active:true},
   {id:'SEC-01-R1-B1',zone:'SECURE',aisle:'SEC-01',rack:'R1',level:'B1',maxWeightKg:300,capacity:80,used:22,active:true},
   {id:'RTN-01',zone:'RETURNS',aisle:'RTN',rack:'01',level:'FLOOR',maxWeightKg:900,capacity:140,used:19,active:true},
   {id:'DMG-01',zone:'DAMAGED',aisle:'DMG',rack:'01',level:'FLOOR',maxWeightKg:900,capacity:100,used:9,active:true}
  ],
  inventory:[
   {sku:'PHYS-SONY-WH1000XM5',brand:'Sony',description:'Wireless Noise Canceling Headphones',binId:'A-01-R1-B1',onHand:168,reserved:32,damaged:2,serialized:true,lotControl:false,lastCount:plusDays(-12)},
   {sku:'PHYS-APPLE-AIRPODS-PRO2',brand:'Apple',description:'AirPods Pro 2',binId:'A-01-R1-B2',onHand:212,reserved:36,damaged:1,serialized:true,lotControl:false,lastCount:plusDays(-8)},
   {sku:'PHYS-KS-4217709208',brand:'Kendra Scott',description:'Designer Jewelry Item',binId:'SEC-01-R1-B1',onHand:74,reserved:25,damaged:0,serialized:false,lotControl:false,lastCount:plusDays(-14)},
   {sku:'PHYS-AURA-CARVER',brand:'Aura Frames',description:'Carver HD Digital Frame',binId:'B-04-R2-B1',onHand:31,reserved:16,damaged:1,serialized:true,lotControl:false,lastCount:plusDays(-18)},
   {sku:'PHYS-FIELDBAR-HCFB1',brand:'FieldBar',description:'Orchard Orange Cooler',binId:'B-07-R1-B1',onHand:150,reserved:110,damaged:3,serialized:false,lotControl:false,lastCount:plusDays(-5)}
  ],
  receipts:[
   {id:'rcv_887411',po:'PO-2026-887411',vendor:'Sony Electronics',asn:'ASN-SONY-887411',appointment:plusHours(3),dock:'D2',carrier:'FedEx Freight',status:'ARRIVED',invoice:'INV-887411',invoiceTotal:13400,poTotal:13400,lines:[{sku:'PHYS-SONY-WH1000XM5',expected:50,received:50,damaged:0,unitCost:268}]},
   {id:'rcv_887480',po:'PO-2026-887480',vendor:'Apple Distribution',asn:'ASN-APPLE-887480',appointment:plusDays(1),dock:'D4',carrier:'UPS Supply Chain',status:'SCHEDULED',invoice:'INV-887480',invoiceTotal:27300,poTotal:27300,lines:[{sku:'PHYS-APPLE-AIRPODS-PRO2',expected:150,received:0,damaged:0,unitCost:182}]},
   {id:'rcv_887522',po:'PO-2026-887522',vendor:'Kendra Scott Wholesale',asn:'ASN-KS-887522',appointment:plusDays(2),dock:'D1',carrier:'Vendor LTL',status:'SCHEDULED',invoice:'INV-887522',invoiceTotal:6000,poTotal:6000,lines:[{sku:'PHYS-KS-4217709208',expected:100,received:0,damaged:0,unitCost:60}]}
  ],
  putaway:[
   {id:'put_1',receiptId:'rcv_887411',sku:'PHYS-SONY-WH1000XM5',qty:50,fromBin:'RCV-01',toBin:'A-01-R1-B1',status:'OPEN',assignee:'Unassigned',priority:'HIGH'}
  ],
  waves:[
   {id:'WAVE-261002-01',status:'READY',priority:'HIGH',createdAt:plusHours(-1.2),orders:['87366-R002','87366-R003','87366-R004'],sku:'PHYS-SONY-WH1000XM5',qty:10,binId:'A-01-R1-B1',picker:'Unassigned',picked:0},
   {id:'WAVE-261002-02',status:'PICKING',priority:'NORMAL',createdAt:plusHours(-2.5),orders:['88211-01','88211-02'],sku:'PHYS-APPLE-AIRPODS-PRO2',qty:24,binId:'A-01-R1-B2',picker:'Jordan',picked:16}
  ],
  packing:[
   {id:'PK-61021',order:'87366-R001',agency:'Northstar Auto Programs',program:'Q4 Dealer Excellence',sku:'PHYS-SONY-WH1000XM5',qty:1,carton:'CTN-87366-001',carrier:'UPS',service:'Ground',status:'LABEL_CREATED',tracking:'1ZDEMO87366001',whiteLabel:true,packSlipBrand:'Northstar Rewards Group'},
   {id:'PK-61022',order:'88405',agency:'Apex Incentives',program:'Holiday Choice Awards',sku:'PHYS-AURA-CARVER',qty:4,carton:'CTN-88405-001',carrier:'FedEx',service:'Home Delivery',status:'PACKED',tracking:'',whiteLabel:true,packSlipBrand:'Apex Incentives'}
  ],
  cycleCounts:[
   {id:'cc_1',binId:'SEC-01-R1-B1',sku:'PHYS-KS-4217709208',systemQty:74,countedQty:null,status:'OPEN',reason:'High value secure-zone cadence',createdAt:plusHours(-4)},
   {id:'cc_2',binId:'B-04-R2-B1',sku:'PHYS-AURA-CARVER',systemQty:31,countedQty:30,status:'VARIANCE',reason:'Scheduled cycle count',createdAt:plusDays(-1)}
  ],
  movements:[
   {id:'mv1',time:plusHours(-5),type:'RECEIVING',sku:'PHYS-SONY-WH1000XM5',qty:50,from:'INBOUND',to:'RCV-01',ref:'PO-2026-887411',user:'Receiver 01'},
   {id:'mv2',time:plusHours(-3.1),type:'PICK',sku:'PHYS-APPLE-AIRPODS-PRO2',qty:-16,from:'A-01-R1-B2',to:'PACK',ref:'WAVE-261002-02',user:'Jordan'}
  ],
  tplNodes:[
   {id:'tpl_east',name:'East Coast 3PL',code:'TPL-EAST',city:'Edison',state:'NJ',region:'EAST',status:'ACTIVE',integrationKey:'tpl_east_••••0931',ackSlaMin:15,dispatchSlaHrs:24,onTime:98.7,inventoryAccuracy:99.4,baseHandling:3.25,zoneRate:1.05,lastSync:plusHours(-.3)},
   {id:'tpl_central',name:'Central 3PL',code:'TPL-CENTRAL',city:'Dallas',state:'TX',region:'CENTRAL',status:'ACTIVE',integrationKey:'tpl_central_••••7144',ackSlaMin:20,dispatchSlaHrs:24,onTime:97.8,inventoryAccuracy:98.9,baseHandling:2.95,zoneRate:.97,lastSync:plusHours(-.7)},
   {id:'tpl_west',name:'West Coast 3PL',code:'TPL-WEST',city:'Reno',state:'NV',region:'WEST',status:'WATCH',integrationKey:'tpl_west_••••1188',ackSlaMin:20,dispatchSlaHrs:24,onTime:93.6,inventoryAccuracy:97.2,baseHandling:3.1,zoneRate:1.12,lastSync:plusHours(-1.5)}
  ],
  tplInventory:[
   {nodeId:'tpl_east',sku:'PHYS-SONY-WH1000XM5',qty:84,reserved:13,registryQty:83,lastSync:plusHours(-.3),variation:true},
   {nodeId:'tpl_east',sku:'PHYS-APPLE-AIRPODS-PRO2',qty:112,reserved:22,registryQty:112,lastSync:plusHours(-.3),variation:true},
   {nodeId:'tpl_east',sku:'PHYS-AURA-CARVER',qty:18,reserved:4,registryQty:18,lastSync:plusHours(-.3),variation:true},
   {nodeId:'tpl_central',sku:'PHYS-SONY-WH1000XM5',qty:67,reserved:8,registryQty:67,lastSync:plusHours(-.7),variation:true},
   {nodeId:'tpl_central',sku:'PHYS-APPLE-AIRPODS-PRO2',qty:140,reserved:18,registryQty:138,lastSync:plusHours(-.7),variation:true},
   {nodeId:'tpl_central',sku:'PHYS-KS-4217709208',qty:56,reserved:11,registryQty:56,lastSync:plusHours(-.7),variation:true},
   {nodeId:'tpl_west',sku:'PHYS-SONY-WH1000XM5',qty:29,reserved:3,registryQty:29,lastSync:plusHours(-1.5),variation:true},
   {nodeId:'tpl_west',sku:'PHYS-APPLE-AIRPODS-PRO2',qty:78,reserved:9,registryQty:76,lastSync:plusHours(-1.5),variation:true},
   {nodeId:'tpl_west',sku:'PHYS-AURA-CARVER',qty:44,reserved:8,registryQty:44,lastSync:plusHours(-1.5),variation:false}
  ],
  tplShipments:[
   {id:'TPL-SHP-77491',orderId:'ORD-3PL-77491',nodeId:'tpl_east',sku:'PHYS-APPLE-AIRPODS-PRO2',qty:1,state:'FL',service:'UPS_GROUND',status:'DISPATCHED',createdAt:plusHours(-19),acceptedAt:plusHours(-18.8),dispatchedAt:plusHours(-6),tracking:'1Z3PL77491',cost:11.82},
   {id:'TPL-SHP-77492',orderId:'ORD-3PL-77492',nodeId:'tpl_west',sku:'PHYS-AURA-CARVER',qty:2,state:'CA',service:'FEDEX_GROUND',status:'DELAYED',createdAt:plusHours(-31),acceptedAt:plusHours(-30.5),dispatchedAt:null,tracking:'',cost:18.4},
   {id:'TPL-SHP-77493',orderId:'ORD-3PL-77493',nodeId:'tpl_central',sku:'PHYS-KS-4217709208',qty:3,state:'TX',service:'UPS_GROUND',status:'PICKING',createdAt:plusHours(-7),acceptedAt:plusHours(-6.7),dispatchedAt:null,tracking:'',cost:10.15}
  ],
  reconciliations:[
   {id:'rec_1',nodeId:'tpl_west',sku:'PHYS-APPLE-AIRPODS-PRO2',registryQty:76,nodeQty:78,variance:2,status:'OPEN',createdAt:plusHours(-7)},
   {id:'rec_2',nodeId:'tpl_east',sku:'PHYS-SONY-WH1000XM5',registryQty:83,nodeQty:84,variance:1,status:'REVIEW',createdAt:plusHours(-6)}
  ],
  activity:[
   {time:plusHours(-.3),text:'East Coast 3PL inventory sync completed',kind:'3pl'},
   {time:plusHours(-1),text:'WAVE-261002-01 released for Sony headphone redemptions',kind:'wms'},
   {time:plusHours(-3),text:'PO-2026-887411 checked in at Dock D2',kind:'wms'}
  ]
 };
}
window.StarkSystemSeeds={enterprise,logistics};
})();
