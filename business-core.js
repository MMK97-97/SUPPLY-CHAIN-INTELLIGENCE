(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MK97Business=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const REGIONS=['US','CA','EU'];
  const MODULES={itemMaster:'Item master',planning:'Planning',crm:'Customer accounts',orders:'Order management',vendor:'Suppliers',procurement:'Procurement',shipping:'Shipping',warehouse:'Warehouse',tpl:'3PL',transportation:'Transportation',analytics:'Analytics',data:'System & data'};
  const FIELDS={
    horizon:{label:'Planning horizon',min:1,max:365,help:'Days of confirmed inbound included by default.'},
    orderAlertDays:{label:'Order and hold warning',min:0,max:90,help:'Calendar days before a delivery or hold deadline appears in the work queue.'},
    shipLeadDays:{label:'Shipping lead time',min:0,max:90,help:'Days to work backward from the requested in-hands date.'},
    shipCalendar:{label:'Shipping calendar',choices:{calendar:'Every day',weekdays:'Monday to Friday'},help:'In the weekday calendar, weekends are excluded. Holidays are not excluded.'},
    safetyFloor:{label:'Minimum safety stock',min:0,max:1000000,help:'A regional floor in units. Higher item-specific safety stock still applies.'},
    includeDraftDemand:{label:'Include unvalidated orders in recommendations',choices:{no:'No — show separately',yes:'Yes — dated orders due by the horizon'},help:'Adds eligible, unreserved demand to suggested buys. It never allocates stock.'},
    returnsWindowDays:{label:'Return authorization window',min:0,max:365,help:'Calendar days from recorded delivery, or shipment if delivery is unknown. Zero permits same-day authorizations only.'},
    timeZone:{label:'Business time zone',choices:{'America/New_York':'Eastern (New York)','America/Toronto':'Eastern (Toronto)','America/Chicago':'Central (Chicago)','America/Denver':'Mountain (Denver)','America/Los_Angeles':'Pacific (Los Angeles)','Europe/London':'London','Europe/Brussels':'Central Europe (Brussels)','Asia/Dubai':'Dubai','Asia/Kolkata':'India (Kolkata)','Asia/Singapore':'Singapore','Asia/Tokyo':'Tokyo','Australia/Sydney':'Sydney','UTC':'UTC'},help:'Controls the business date used for regional alerts and return eligibility.'}
  };
  const BASE={horizon:30,orderAlertDays:3,shipLeadDays:8,shipCalendar:'calendar',safetyFloor:0,includeDraftDemand:'no',returnsWindowDays:30,timeZone:'America/New_York'};
  const DEFAULTS={version:1,name:'',template:'custom',modules:Object.keys(MODULES),services:{returns:true,invoices:true},policies:{...BASE},regions:{}};
  const PRESETS={
    custom:{label:'All modules',note:'Start with the full workspace and adjust it to your business.',hide:[],policy:{}},
    distributor:{label:'Wholesale & distribution',note:'Plan inbound stock, wholesale orders and warehouse fulfillment.',hide:['tpl'],policy:{horizon:60,orderAlertDays:5,shipCalendar:'weekdays',shipLeadDays:5}},
    commerce:{label:'Retail & e-commerce',note:'Prioritize fast shipping and customer returns.',hide:['tpl','transportation'],policy:{horizon:30,orderAlertDays:2,shipLeadDays:2}},
    outsourced:{label:'Outsourced fulfillment',note:'Focus on 3PL inventory, partner requests and delivery.',hide:['warehouse'],policy:{horizon:30,orderAlertDays:5,shipLeadDays:4},services:{returns:false}},
    industrial:{label:'Industrial supply',note:'Use a longer purchasing horizon and weekday shipping.',hide:['tpl'],policy:{horizon:90,orderAlertDays:10,shipCalendar:'weekdays',shipLeadDays:10,includeDraftDemand:'yes'}}
  };
  const copy=value=>JSON.parse(JSON.stringify(value));
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const obj=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
  const region=v=>['CA','CANADA'].includes(String(v).toUpperCase())?'CA':['EU','EUROPEAN UNION'].includes(String(v).toUpperCase())?'EU':'US';
  const validPolicy=(value,partial)=>obj(value)&&Object.keys(value).every(k=>own(FIELDS,k))&&(partial||Object.keys(value).length===Object.keys(FIELDS).length)&&Object.entries(value).every(([key,val])=>{
    const f=FIELDS[key];return f.choices?typeof val==='string'&&own(f.choices,val):Number.isInteger(val)&&val>=f.min&&val<=f.max;
  });
  function validate(value){
    if(!obj(value)||Object.keys(value).length!==7||value.version!==1||typeof value.name!=='string'||value.name!==clean(value.name,64)||!own(PRESETS,value.template)||
      !Array.isArray(value.modules)||!value.modules.includes('data')||new Set(value.modules).size!==value.modules.length||value.modules.some(id=>!own(MODULES,id))||
      !obj(value.services)||Object.keys(value.services).length!==2||typeof value.services.returns!=='boolean'||typeof value.services.invoices!=='boolean'||
      !validPolicy(value.policies,false)||!obj(value.regions)||Object.entries(value.regions).some(([code,policy])=>!REGIONS.includes(code)||!validPolicy(policy,true)))throw new Error('Invalid business settings. Check the allowed ranges and choices.');
    return value;
  }
  function profile(state){return copy(state?.businessProfile||DEFAULTS);}
  function policy(state,code){const p=profile(state);return {...p.policies,...p.regions[region(code)]};}
  function template(id,current){
    if(!own(PRESETS,id))throw new Error('Choose a business template.');
    const d=PRESETS[id];
    return {...copy(DEFAULTS),name:current?.name||'',template:id,modules:Object.keys(MODULES).filter(key=>!d.hide.includes(key)),services:{...DEFAULTS.services,...d.services},policies:{...BASE,...d.policy},regions:copy(current?.regions||{})};
  }
  const enabled=(state,id)=>!state?.businessProfile||state.businessProfile.modules.includes(id);
  function canEdit(workspace,cloud){
    if(workspace?.isDemo)return true;
    const access=cloud?.getAccess?.();
    return !!access?.ready&&!!access.userId&&!!access.organizationId&&['owner','admin'].includes(access.role);
  }
  function save(S,settings,{expected,workspace,cloud}={}){
    if(!canEdit(workspace,cloud))throw new Error('Only organization owners and admins can change business settings.');
    const cleanSettings=copy(validate(settings));
    return S.transaction('BUSINESS_SETTINGS_UPDATED','Business configuration saved.',state=>{
      if(JSON.stringify(state.businessProfile||null)!==expected)throw new Error('Business settings changed in another tab. Reload the current settings before saving.');
      state.businessProfile=cleanSettings;
    });
  }
  const DAY=86400000;
  function dateOnly(value){
    const match=/^\d{4}-\d{2}-\d{2}/.exec(String(value??''));
    if(!match)return '';
    const t=Date.parse(match[0]+'T00:00:00Z');
    return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===match[0]?match[0]:'';
  }
  const addDays=(day,delta)=>new Date(Date.parse(day+'T00:00:00Z')+delta*DAY).toISOString().slice(0,10);
  function businessDay(now=new Date(),timeZone=BASE.timeZone){
    const p=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const v=type=>p.find(i=>i.type===type).value;
    return v('year')+'-'+v('month')+'-'+v('day');
  }
  function eventDay(value,zone){
    if(!dateOnly(value))return '';
    if(value.length===10)return value;
    const now=new Date(value);return Number.isFinite(now.getTime())?businessDay(now,zone):'';
  }
  function shipDate(state,code,value){
    let day=dateOnly(value);if(!day)return '';
    const p=policy(state,code);
    if(p.shipCalendar==='calendar')return addDays(day,-p.shipLeadDays);
    const weekend=d=>[0,6].includes(new Date(d+'T00:00:00Z').getUTCDay());
    for(let remaining=p.shipLeadDays;remaining>0;){day=addDays(day,-1);if(!weekend(day))remaining--;}
    while(weekend(day))day=addDays(day,-1);
    return day;
  }

  const whole=(v,min=0)=>Number.isSafeInteger(v)&&v>=min&&v<=1000000;
  const count=v=>whole(v)?v:0;
  const validText=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||!!v.trim());
  const actor=cloud=>cloud?.getAccess?.().userId||'local';
  function orderRegion(state,order){
    return region(order.region||state.enterprise.inventory.find(i=>i.sku===order.lines?.[0]?.sku)?.region);
  }
  function returnOrder(state,orderId,{now=new Date(),ignoreWindow=false}={}){
    const order=state.enterprise.orders.find(o=>o.id===orderId);
    if(!order||order.type==='HOLD_PO'||order.fulfillment?.kind==='DIGITAL')return null;
    const code=orderRegion(state,order),p=policy(state,code);
    const movement=[
      ...state.logistics.packing.filter(r=>r.orderId===orderId&&r.status==='SHIPPED').map(r=>r.shippedAt),
      ...state.logistics.tplShipments.filter(r=>r.customerOrderId===orderId&&['DISPATCHED','DELIVERED'].includes(r.status)).map(r=>r.dispatchedAt),
      ...state.enterprise.purchaseOrders.filter(r=>r.customerOrderId===orderId&&r.purpose==='DROPSHIP'&&r.status==='DISPATCHED').map(r=>r.dispatchedAt)
    ].map(v=>eventDay(v,p.timeZone)).sort().at(-1);
    const delivery=eventDay(order.deliveredAt||order.shipping?.deliveredAt,p.timeZone);
    const anchor=delivery||eventDay(order.shippedAt||order.shipping?.shippedAt,p.timeZone)||movement;
    const today=businessDay(now,p.timeZone);
    if(!ignoreWindow&&(!anchor||anchor>today||today>addDays(anchor,p.returnsWindowDays)))return null;
    const known=new Map(state.enterprise.inventory.filter(i=>i.nature!=='DIGITAL').map(i=>[i.sku,i]));
    const lines=new Map();
    for(const l of order.lines){
      const i=known.get(l.sku);if(!i||region(i.region)!==code)continue;
      const q=Math.min(count(l.qty),count(l.shipped));if(!q)continue;
      const row=lines.get(l.sku)||{sku:l.sku,model:i.model||l.sku,shipped:0,remaining:0};
      row.shipped+=q;lines.set(l.sku,row);
    }
    for(const row of lines.values())row.remaining=Math.max(0,row.shipped-(state.customerReturns||[]).filter(r=>r.orderId===orderId&&r.sku===row.sku&&r.status!=='CANCELLED').reduce((sum,r)=>sum+r.qty,0));
    if(!lines.size)return null;
    return {order,code,anchor,expires:anchor?addDays(anchor,p.returnsWindowDays):'',lines:[...lines.values()]};
  }
  function validateReturns(rows){
    if(!Array.isArray(rows)||rows.length>5000)throw new Error('Invalid customer returns register.');
    const ids=new Set();
    for(const r of rows){
      if(!obj(r)||!validText(r.id,100,true)||ids.has(r.id)||!validText(r.orderId,150,true)||!validText(r.orderRef,150,true)||!validText(r.sku,150,true)||
        !REGIONS.includes(r.region)||!whole(r.qty,1)||!validText(r.reason,500,true)||!validText(r.createdBy,150,true)||!Number.isFinite(Date.parse(r.createdAt))||
        !['AUTHORIZED','RECEIVED','CANCELLED'].includes(r.status))throw new Error('Invalid customer return record.');
      ids.add(r.id);
      if(r.status!=='AUTHORIZED'&&(!Number.isFinite(Date.parse(r.closedAt))||!validText(r.closedBy,150,true)))throw new Error('Invalid return completion evidence.');
      if(r.status==='RECEIVED'&&(!whole(r.restock)||!whole(r.quarantine)||!whole(r.discard)||r.restock+r.quarantine+r.discard!==r.qty||
         !validText(r.binId,150)||((r.restock+r.quarantine>0)!==!!r.binId)||!validText(r.inspection,500,true)))throw new Error('Invalid return inspection.');
    }
  }
  function createReturn(S,input,{now=new Date(),cloud}={}){
    return S.transaction('RETURN_AUTHORIZED',String(input.orderId??'').slice(0,150),s=>{
      if(!profile(s).services.returns)throw new Error('Customer returns are disabled in Business setup.');
      const details=returnOrder(s,input.orderId,{now});
      const line=details?.lines.find(l=>l.sku===input.sku),reason=clean(input.reason,500);
      if(!line||!whole(input.qty,1)||input.qty>line.remaining||!reason)throw new Error('Choose a returnable order line, a quantity within its remaining shipped units and a reason.');
      s.customerReturns||=[];
      const id=S.uid('RMA');
      s.customerReturns.unshift({id,orderId:details.order.id,orderRef:details.order.po,sku:line.sku,region:details.code,qty:input.qty,reason,status:'AUTHORIZED',createdAt:now.toISOString(),createdBy:actor(cloud)});
      return id;
    });
  }
  function receiveReturn(S,id,input,{now=new Date(),cloud}={}){
    return S.transaction('RETURN_RECEIVED',id,s=>{
      const r=(s.customerReturns||[]).find(x=>x.id===id&&x.status==='AUTHORIZED');
      if(!r)throw new Error('This return is no longer awaiting inspection.');
      const {restock,quarantine,discard}=input,inspection=clean(input.inspection,500);
      if(![restock,quarantine,discard].every(v=>whole(v))||restock+quarantine+discard!==r.qty||!inspection)throw new Error('Account for every authorized unit and enter inspection notes.');
      const put=restock+quarantine,binId=put?input.binId:'';
      if(put){
        const i=s.enterprise.inventory.find(x=>x.sku===r.sku&&x.nature!=='DIGITAL'&&region(x.region)===r.region);
        const l=s.logistics,bin=l.bins.find(b=>b.id===binId&&b.active!==false);
        // Use a location already associated with this SKU and region; never post to an arbitrary bin.
        const wi=l.inventory.find(x=>x.sku===r.sku&&x.binId===binId&&region(x.region||i?.region)===r.region);
        const used=l.inventory.filter(x=>x.binId===binId).reduce((sum,x)=>sum+x.onHand,0);
        if(!i||!bin||!wi||!Number.isFinite(bin.capacity)||used+put>bin.capacity)throw new Error('Choose an active stock location for this SKU with enough capacity.');
        wi.onHand+=put;wi.damaged=(wi.damaged||0)+quarantine;i.onHand+=put;i.damaged+=quarantine;
        for(const [type,qty] of [['RETURN_RESTOCK',restock],['RETURN_QUARANTINE',quarantine]])if(qty)l.movements.unshift({id:S.uid('mv'),time:now.toISOString(),type,sku:r.sku,qty,from:'Customer return',to:binId,ref:r.id,user:actor(cloud)});
      }
      Object.assign(r,{status:'RECEIVED',restock,quarantine,discard,binId,inspection,closedAt:now.toISOString(),closedBy:actor(cloud)});
    });
  }
  function cancelReturn(S,id,{now=new Date(),cloud}={}){
    return S.transaction('RETURN_CANCELLED',id,s=>{
      const r=(s.customerReturns||[]).find(x=>x.id===id&&x.status==='AUTHORIZED');
      if(!r)throw new Error('Only a return awaiting inspection can be cancelled.');
      Object.assign(r,{status:'CANCELLED',closedAt:now.toISOString(),closedBy:actor(cloud)});
    });
  }
  return {REGIONS,MODULES,FIELDS,PRESETS,BASE,validate,profile,policy,template,enabled,canEdit,save,region,dateOnly,businessDay,shipDate,returnOrder,validateReturns,createReturn,receiveReturn,cancelReturn};
});
