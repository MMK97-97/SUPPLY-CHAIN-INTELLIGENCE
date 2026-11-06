(function (root, factory) {
  'use strict';
  const api = factory(typeof module === 'object' && module.exports ? require('./business-core.js') : root.MK97Business);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MK97Operations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B) {
  'use strict';
  const SALES_CLOSED = new Set(['SHIPPED','DELIVERED','CANCELLED','EXPIRED']);
  const PO_CLOSED = new Set(['RECEIVED','CANCELLED','DRAFT','CLOSED']);
  const RECEIPT_CLOSED = new Set(['CLOSED','CANCELLED']);
  const EXPECTED_SUPPLY = new Set(['CONFIRMED','DISPATCHED','IN_TRANSIT','PARTIALLY_RECEIVED']);
  const PROFILES = {
    executive: ['orders','supply','warehouse','partners','finance'],
    planner: ['supply','orders'], procurement: ['supply','finance','warehouse'], logistics: ['warehouse','partners','orders']
  };
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const positive = value => Math.max(0, n(value));
  const norm = value => String(value ?? '').trim().normalize('NFKC').toUpperCase();
  const regionOf = value => ['CA','CANADA'].includes(norm(value)) ? 'CA' : ['EU','EUROPEAN UNION'].includes(norm(value)) ? 'EU' : 'US';
  const statusText = value => String(value ?? '').toLowerCase().replaceAll('_',' ');
  const day = value => {
    const match = /^\d{4}-\d{2}-\d{2}/.exec(String(value ?? ''));
    if (!match) return '';
    const t = Date.parse(match[0]+'T00:00:00Z');
    return Number.isFinite(t) && new Date(t).toISOString().slice(0,10)===match[0] ? match[0] : '';
  };
  const plus = (iso, days) => new Date(Date.parse(iso+'T00:00:00Z') + days*86400000).toISOString().slice(0,10);
  function businessDay(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
    const get = type => parts.find(p=>p.type===type).value;
    return get('year')+'-'+get('month')+'-'+get('day');
  }
  const poPath = po => 'procurement/index.html?search='+encodeURIComponent(po.po);
  const orderPath = order => 'all-open-orders.html?search='+encodeURIComponent(order.po);
  const countPath = count => 'scan.html?kind=cycle&id='+encodeURIComponent(count.id);
  const receiptPath = po => 'scan.html?kind=vendor&id='+encodeURIComponent(po.id);
  function uniquePOReferences(orders) {
    const totals = new Map();
    for (const p of orders) totals.set(norm(p.po),(totals.get(norm(p.po))||0)+1);
    return totals;
  }
  const pendingByLine = (l, receipt, sku) => {
    const lines = (receipt.lines || []).filter(x=>x.sku===sku);
    const posted = l.putaway.filter(x=>x.receiptId===receipt.id&&x.sku===sku&&x.status==='COMPLETE').reduce((sum,x)=>sum+positive(x.qty),0);
    return Math.max(0,lines.reduce((sum,x)=>sum+positive(x.received),0)-posted) +
      lines.reduce((sum,x)=>sum+Math.max(0,n(x.damaged)-n(x.damagePosted)),0);
  };
  function snapshot(state, options = {}) {
    const e=state.enterprise,l=state.logistics,region=regionOf(options.region);
    const policy=B?.policy(state,region)||{horizon:30,orderAlertDays:3,safetyFloor:0,includeDraftDemand:'no'};
    const requested=Number(options.horizon);
    const today=day(options.today)||(B?B.businessDay(new Date(),policy.timeZone):businessDay());
    const horizon=Number.isInteger(requested)&&requested>=1&&requested<=365?requested:policy.horizon;
    const through=plus(today,horizon),soon=plus(today,policy.orderAlertDays);
    const catalog=new Map(e.inventory.map(i=>[i.sku,i]));
    const vendors=new Map(e.vendors.map(v=>[v.id,v]));
    const poRefs=uniquePOReferences(e.purchaseOrders);
    const matchSku=sku=>catalog.has(sku)&&regionOf(catalog.get(sku).region)===region;
    const matchRecord=record=>record.region ? regionOf(record.region)===region : (record.lines || []).some(line=>matchSku(line.sku));
    const inbound=new Map(), pendingReceipts=new Map(), awaitingPutaway=new Map(), locations=new Map();
    const issues=[];
    function add(type,id,category,severity,title,detail,path,due='') {
      issues.push({key:type+':'+id,type,category,severity,title,detail,path,due});
    }
    function collect(map, key, value) { if (!map.has(key)) map.set(key,[]); map.get(key).push(value); }
    for(const row of l.inventory)if(matchSku(row.sku))collect(locations,row.sku,{bin:row.binId,onHand:positive(row.onHand),reserved:positive(row.reserved),damaged:positive(row.damaged)});
    for(const receipt of l.receipts) if(!RECEIPT_CLOSED.has(receipt.status)) {
      collect(pendingReceipts,norm(receipt.po),receipt);
    }
    const openOrders=e.orders.filter(o=>!SALES_CLOSED.has(o.status)&&matchRecord(o));
    const draftOrders=openOrders.filter(o=>o.validation?.state==='UNVALIDATED'||o.validation?.state==='ISSUES'||['UNVALIDATED','ISSUES','DRAFT'].includes(o.status));
    const draftIds=new Set(draftOrders.map(o=>o.id));
    for(const order of openOrders) {
      const due=day(order.inHandsDate);
      const unvalidated=draftIds.has(order.id);
      if(unvalidated) {
        const detail=(order.validation?.issues||[]).map(x=>x.label||x.message||x.code).filter(Boolean).join(' · ');
        add('validation',order.id,'orders',order.validation?.state==='ISSUES'?'high':'medium',order.po+' needs validation',detail||'Review this order before stock is committed.','order-management/unvalidated.html?search='+encodeURIComponent(order.po),due);
      }
      if(order.type==='HOLD_PO') {
        const expiry=day(order.holdUntil);
        if(expiry&&expiry<=soon) add('hold',order.id,'orders',expiry<today?'high':'medium',order.po+' hold '+(expiry<today?'expired':'expires soon'),'Check the held quantity and next release before '+expiry+'.',orderPath(order),expiry);
      } else if(due&&due<=soon) {
        add('due-order',order.id,'orders',due<=today?'high':'medium',order.po+(due<today?' is past its in-hands date':' is due soon'),'In hands '+due+' · '+statusText(order.status)+'.',orderPath(order),due);
      }
    }
    const openPOs=[];
    for(const p of e.purchaseOrders) {
      if(PO_CLOSED.has(p.status)||!matchRecord(p))continue;
      const lines=p.lines.filter(line=>n(line.qty)>n(line.received)&&(!catalog.has(line.sku)||matchSku(line.sku)));
      if(!lines.length)continue;
      if(p.purpose==='DROPSHIP'&&p.status==='DISPATCHED')continue;
      openPOs.push(p);
      const eta=day(p.eta),vendor=vendors.get(p.vendorId)?.name||'Supplier';
      const units=lines.reduce((sum,line)=>sum+Math.max(0,n(line.qty)-n(line.received)),0);
      const pending=poRefs.get(norm(p.po))===1 ? pendingReceipts.get(norm(p.po))||[] : [];
      if(poRefs.get(norm(p.po))!==1) {
        add('duplicate-po',p.id,'supply','high',p.po+' has a duplicate reference','Confirm which PO owns the receiving records before using this supply.',poPath(p));
        continue;
      }
      if(!eta||eta<today) add('inbound',p.id,'supply',eta?'high':'medium',p.po+(eta?' is overdue':' needs an ETA'),vendor+' · '+units+' unposted units'+(eta?' · ETA '+eta:''),poPath(p),eta);
      const pendingUnits=lines.reduce((sum,line)=>sum+pending.reduce((qty,r)=>qty+pendingByLine(l,r,line.sku),0),0);
      if(pendingUnits>0) add('receipt',p.id,'warehouse','high',p.po+' has a receipt to finish',vendor+' · Verify the entered items and complete putaway to make stock available.',receiptPath(p));
      if(p.purpose==='DROPSHIP')continue;
      // Group SKU rows first, so one receipt is not subtracted once per PO line.
      const bySku=new Map();
      for(const line of lines) bySku.set(line.sku,(bySku.get(line.sku)||0)+Math.max(0,n(line.qty)-n(line.received)));
      for(const [sku,ordered] of bySku) if(matchSku(sku)) {
        const staged=Math.min(ordered,pending.reduce((qty,r)=>qty+pendingByLine(l,r,sku),0));
        awaitingPutaway.set(sku,(awaitingPutaway.get(sku)||0)+staged);
        if(ordered>staged) collect(inbound,sku,{id:p.id,reference:p.po,vendor,qty:ordered-staged,eta,status:p.status,confirmed:EXPECTED_SUPPLY.has(p.status),path:poPath(p)});
      }
    }
    const draftDemand=new Map(),draftInWindow=new Map();
    for(const order of draftOrders) for(const line of order.lines) {
      if(!matchSku(line.sku)||order.type==='HOLD_PO'||['3PL','DROPSHIP'].includes(order.fulfillment?.kind))continue;
      const qty=Math.max(0,n(line.qty)-n(line.shipped)-n(line.cancelledQty)),due=day(order.inHandsDate);
      draftDemand.set(line.sku,(draftDemand.get(line.sku)||0)+qty);
      if(due&&due<=through)draftInWindow.set(line.sku,(draftInWindow.get(line.sku)||0)+qty);
    }
    const availability=e.inventory.filter(i=>matchSku(i.sku)&&i.nature!=='DIGITAL').map(i=>{
      const onHand=positive(i.onHand),reserved=positive(i.reserved),damaged=positive(i.damaged),safety=Math.max(positive(i.safety),policy.safetyFloor);
      const net=onHand-reserved-damaged,available=Math.max(0,net),sources=inbound.get(i.sku)||[];
      const confirmed=sources.filter(p=>p.confirmed&&p.eta>=today&&p.eta<=through).reduce((sum,p)=>sum+p.qty,0);
      const projected=Math.max(0,net+confirmed),overcommitted=Math.max(0,-net);
      const staged=awaitingPutaway.get(i.sku)||0;
      const excluded=sources.reduce((sum,p)=>sum+p.qty,0)-confirmed;
      const path='workspace.html?view=operations&section=supply&region='+region+'&sku='+encodeURIComponent(i.sku);
      if(overcommitted) add('stock-deficit',i.sku,'supply','high',(i.model||i.sku)+' is overcommitted',overcommitted+' units short of current reservations after damage.',path);
      else if(available<safety) add('stock-buffer',i.sku,'supply',available===0?'high':'medium',(i.model||i.sku)+' is below safety stock',available+' free now · safety stock '+safety+' · '+confirmed+' dated inbound by '+through+'.',path);
      const planningDemand=policy.includeDraftDemand==='yes'?(draftInWindow.get(i.sku)||0):0;
      const replenishable=!['DISCONTINUED','INACTIVE','OBSOLETE','ARCHIVED','END_OF_LIFE','EOL'].includes(norm(i.status).replace(/[ -]+/g,'_'));
      const suggestedBuy=replenishable?Math.max(0,Math.ceil(safety+planningDemand-net-confirmed)):0;
      return {suggestedBuy,replenishable,planningDemand,sku:i.sku,model:i.model||i.sku,title:i.title||'',onHand,reserved,damaged,available,safety,overcommitted,confirmed,staged,excluded,projected,draftDemand:draftDemand.get(i.sku)||0,sources,path,locations:locations.get(i.sku)||[]};
    }).sort((a,b)=>(b.overcommitted-a.overcommitted)||(a.available-a.safety)-(b.available-b.safety)||a.model.localeCompare(b.model));
    for(const count of l.cycleCounts||[]) if(count.status==='VARIANCE'&&matchSku(count.sku)) {
      const variance=n(count.countedQty)-n(count.systemQty);
      add('count',count.id,'warehouse','medium',count.id+' has a count variance',count.sku+' · '+count.binId+' · '+(variance>0?'+':'')+variance+' units.',countPath(count));
    }
    const ordersById=new Map(e.orders.map(o=>[o.id,o]));
    for(const req of l.tplRequests||[]) if(req.transmission?.state==='UNKNOWN'&&ordersById.has(req.customerOrderId||req.orderId)&&matchRecord(ordersById.get(req.customerOrderId||req.orderId))) {
      add('3pl',req.id,'partners','high',ordersById.get(req.customerOrderId||req.orderId).po+' · 3PL status unknown','Check the partner’s acknowledgment before retrying.','3pl-management/order-history.html');
    }
    for(const r of state.invoiceReviews||[]) if(r.status==='EXCEPTION'&&openOrClosedPOInRegion(r.poId)) {
      add('invoice',r.id,'finance','medium',r.number+' needs invoice review',r.poReference+' · '+r.evidence.flags.length+' matching exception(s).','workspace.html?view=operations&section=invoices&review='+encodeURIComponent(r.id));
    }
    for(const r of state.customerReturns||[]) if(r.region===region&&r.status==='AUTHORIZED'){
      add('return',r.id,'orders','medium',r.orderRef+' has an open return',r.sku+' · '+r.qty+' units awaiting receipt and inspection.','returns.html?case='+encodeURIComponent(r.id)+'&region='+region);
    }
    function openOrClosedPOInRegion(id) { const p=e.purchaseOrders.find(p=>p.id===id);return !!p&&matchRecord(p); }
    const taskMap=new Map((state.tasks||[]).filter(t=>t.status!=='DONE'&&t.sourceKey).map(t=>[t.sourceKey,t.id]));
    issues.forEach(issue=>{issue.taskId=taskMap.get(issue.key)||'';});
    issues.sort((a,b)=>Number(b.severity==='high')-Number(a.severity==='high')||(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title));
    return {region,today,through,horizon,openOrders:openOrders.length,openPOs:openPOs.length,availability,issues};
  }

  function poCurrency(state, po) {
    const value=norm(po.currency||state.enterprise.vendors.find(v=>v.id===po.vendorId)?.currency);
    return /^[A-Z]{3}$/.test(value)?value:'';
  }
  const rate = value => {
    const raw=String(value??'').trim();
    if (!/^\d{1,8}(?:\.\d{1,4})?$/.test(raw)) return null;
    return Math.round(Number(raw)*10000);
  };
  function invoiceLines(state, poId) {
    const po=state.enterprise.purchaseOrders.find(p=>p.id===poId);
    if(!po)throw new Error('Choose an existing vendor PO.');
    const l=state.logistics,refs=uniquePOReferences(state.enterprise.purchaseOrders);
    const receipts=refs.get(norm(po.po))===1 ? l.receipts.filter(r=>norm(r.po)===norm(po.po)&&r.status!=='CANCELLED') : [];
    const data=new Map();
    for(const line of po.lines) {
      const item=state.enterprise.inventory.find(i=>i.sku===line.sku);
      const row=data.get(line.sku)||{sku:line.sku,label:item?.model||line.model||line.sku,ordered:0,received:0,rates:new Set()};
      row.ordered+=positive(line.qty);
      row.received+=Math.min(positive(line.received),positive(line.qty));
      row.rates.add(rate(line.cost)); data.set(line.sku,row);
    }
    return {po,currency:poCurrency(state,po),duplicateReference:refs.get(norm(po.po))!==1,lines:[...data.values()].map(row=>{
      const damaged=receipts.reduce((sum,r)=>sum+(r.lines||[]).filter(x=>x.sku===row.sku).reduce((qty,x)=>qty+positive(x.damagePosted),0),0);
      return {sku:row.sku,label:row.label,ordered:row.ordered,received:Math.max(0,row.received-damaged),unitRate:row.rates.size===1?[...row.rates][0]:null};
    })};
  }
  function compareInvoice(state, input, editingId = '') {
    const model=invoiceLines(state,String(input.poId||''));
    const {po,currency}=model, number=String(input.number??'').trim().normalize('NFKC');
    const currencyInput=norm(input.currency),date=day(input.date);
    if(!number||number.length>80||/[\u0000-\u001f\u007f]/.test(number))throw new Error('Enter a supplier invoice number of 1–80 characters.');
    if(!date||date!==input.date)throw new Error('Enter a valid invoice date.');
    if(!/^[A-Z]{3}$/.test(currencyInput))throw new Error('Enter a three-letter invoice currency.');
    if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>250)throw new Error('Enter 1–250 invoice lines.');
    const saved=(state.invoiceReviews||[]);
    if(saved.some(r=>r.id!==editingId&&r.vendorId===String(po.vendorId||'')&&norm(r.number)===norm(number)))throw new Error('This supplier invoice number is already in the review register.');
    const existing=new Map(model.lines.map(line=>[line.sku,line])), seen=new Set();
    const billed=new Map();
    for(const r of saved) if(r.poId===po.id&&r.id!==editingId&&r.status==='MATCHED') {
      for(const line of r.lines) billed.set(line.sku,(billed.get(line.sku)||0)+line.qty);
    }
    const flags=[];
    if(!po.vendorId||!state.enterprise.vendors.some(v=>v.id===po.vendorId)) flags.push('The PO does not have a recognized supplier.');
    if(model.duplicateReference) flags.push('This PO reference is duplicated; receiving evidence is ambiguous.');
    if(['CANCELLED','DRAFT'].includes(po.status)||po.purpose==='DROPSHIP') flags.push('This workflow requires a warehouse PO that was issued and is not cancelled.');
    if(!currency) flags.push('The PO and supplier do not specify a currency.');
    else if(currency!==currencyInput)flags.push('Currency mismatch: PO '+currency+', invoice '+currencyInput+'.');
    let total=0;
    const lines=input.lines.map(line=>{
      const sku=String(line.sku??'').trim(),qty=Number(line.qty),unitRate=rate(line.price);
      if(!sku||sku.length>150||seen.has(sku))throw new Error('Enter each invoice SKU only once.');
      if(!Number.isSafeInteger(qty)||qty<1||qty>1000000||unitRate===null)throw new Error('Enter positive whole quantities and nonnegative unit prices with up to four decimal places.');
      seen.add(sku);
      total+=qty*unitRate;
      if(!Number.isSafeInteger(total))throw new Error('Invoice total exceeds the supported range.');
      const row=existing.get(sku),priorQty=billed.get(sku)||0;
      const ordered=row?.ordered||0,received=row?.received||0,unbilled=Math.max(0,Math.min(ordered,received)-priorQty);
      const notes=[];
      if(!row)notes.push('SKU is not on this PO.');
      else {
        if(qty+priorQty>ordered)notes.push('Quantity exceeds the ordered balance.');
        if(qty>unbilled)notes.push('Quantity exceeds unbilled posted receipts.');
        if(row.unitRate===null)notes.push('PO unit price is missing or differs across lines for this SKU.');
        else if(row.unitRate!==unitRate)notes.push('Unit price differs from the PO.');
      }
      for(const note of notes)flags.push(sku+': '+note);
      return {sku,qty,price:unitRate/10000,ordered,received,priorQty,unbilled,poPrice:row?.unitRate==null?null:row.unitRate/10000,notes};
    });
    return {poId:po.id,poReference:po.po,vendorId:String(po.vendorId||''),number,currency:currencyInput,date,total:total/10000,lines,flags,status:flags.length?'EXCEPTION':'MATCHED'};
  }
  function saveInvoice(S, input, {expectedRevision, id = '', user = 'local'} = {}) {
    return S.transaction('INVOICE_REVIEW_SAVED',String(input.number||'').slice(0,80),state=>{
      if(state.revision!==expectedRevision)throw new Error('Workspace records changed. Compare the invoice again before saving.');
      state.invoiceReviews ||= [];
      const prior=id?state.invoiceReviews.find(r=>r.id===id):null;
      if(id&&(!prior||prior.status==='MATCHED'))throw new Error('This review is missing or was already matched.');
      if(prior&&prior.poId!==input.poId)throw new Error('Start a new review to select a different PO.');
      if(!prior&&state.businessProfile?.services?.invoices===false)throw new Error('New invoice reviews are disabled in Business setup.');
      if(!prior&&state.invoiceReviews.length>=5000)throw new Error('The invoice review register is full.');
      const result=compareInvoice(state,input,id),now=new Date().toISOString();
      const row={id:prior?.id||S.uid('inv-review'),poId:result.poId,poReference:result.poReference,vendorId:result.vendorId,number:result.number,currency:result.currency,date:result.date,total:result.total,status:result.status,
        lines:result.lines.map(({sku,qty,price})=>({sku,qty,price})),evidence:{flags:result.flags,lines:result.lines},createdAt:prior?.createdAt||now,reviewedAt:now,reviewedBy:String(user||'local').slice(0,150)};
      if(prior)state.invoiceReviews[state.invoiceReviews.indexOf(prior)]=row;
      else state.invoiceReviews.unshift(row);
      return row.id;
    });
  }
  function createFollowUp(S, key, options = {}) {
    return S.transaction('OPERATIONS_FOLLOW_UP_CREATED',key,state=>{
      const issue=snapshot(state,options).issues.find(x=>x.key===key);
      if(!issue)throw new Error('This exception is no longer open. Refresh the queue.');
      if(issue.taskId)throw new Error('A follow-up task already exists for this exception.');
      const owner=String(options.user||'local').slice(0,150),now=new Date().toISOString(),id=S.uid('task');
      state.tasks ||= [];
      state.tasks.push({id,title:issue.title.slice(0,160),notes:issue.detail.slice(0,20000),sourcePath:issue.path.length<=2048?issue.path:'',status:'OPEN',priority:issue.severity==='high'?'HIGH':'NORMAL',sourceKey:issue.key,createdAt:now,updatedAt:now,createdBy:owner,ownerUserId:owner,comments:[],dueAt:'',reminderAt:'',completedAt:'',version:1});
      return id;
    });
  }
  return {snapshot,businessDay,invoiceLines,compareInvoice,saveInvoice,createFollowUp,PROFILES,poPath,regionOf};
});
