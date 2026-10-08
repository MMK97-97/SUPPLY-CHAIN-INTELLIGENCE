(function () {
  'use strict';
  const S = window.StarkSystem;
  if (!S || window.StarkFulfillment) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const text = value => String(value ?? '').trim();
  const num = value => Number(value) || 0;
  const norm = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const final = order => ['SHIPPED','DELIVERED','CANCELLED','EXPIRED'].includes(order.status);
  const pending = order => order.validation && order.validation.state !== 'VALIDATED';
  const WAREHOUSES = [{id:'SARASOTA',name:'Sarasota'},{id:'FARMERS_BRANCH',name:'Farmers Branch'}];
  const ISSUES = {NO_INVENTORY:'No inventory',DISCONTINUED:'Discontinued',FEEDS_ONLY:'Feeds only',INTERNAL_USE:'Internal use',OUT_OF_STOCK:'Out of stock',CUSTOMER:'Customer account',ADDRESS:'Delivery address',IN_HANDS:'In-hands date',SHIPPING:'Shipping method',THIRD_PARTY:'Third-party billing',WAREHOUSE:'Warehouse',HOLD_EXPIRY:'Hold expiry',CREDIT:'Credit limit',DIGITAL:'Digital fulfillment',REGION:'Region'};
  const total = order => order.lines.reduce((sum, line) => sum + Math.round(line.price * 100) * line.qty, 0) / 100;
  function warehouseId(order) {
    const raw = order.warehouseId || order.shipping?.warehouseId || order.fulfillment?.nodeId || order.shipping?.warehouse;
    const key = norm(raw);
    if (['sarasota','whsarasota','sarasotafl','sarasotawarehouse'].includes(key)) return 'SARASOTA';
    if (['farmersbranch','farmersbranchwarehouse','whfarmersbranch','texas','whtexas'].includes(key)) return 'FARMERS_BRANCH';
    return '';
  }
  const warehouseName = order => WAREHOUSES.find(w => w.id === warehouseId(order))?.name || 'Unassigned';
  function resolveItem(state, model, region) {
    const q = text(model);
    return state.enterprise.inventory.find(i => i.sku.toLowerCase() === q.toLowerCase()) ||
      state.enterprise.inventory.find(i => S.regionCode(i.region) === region && text(i.model).toLowerCase() === q.toLowerCase());
  }
  function cleanInput(input, state) {
    const region = S.regionCode(input.region);
    if (!['HOLD_PO','BULK_PO','FIRM_PO'].includes(input.type)) throw new Error('Choose Hold PO, Bulk PO or Firm PO.');
    if (!text(input.po) || text(input.po).length > 100) throw new Error('Enter a customer PO reference, up to 100 characters.');
    if (!state.enterprise.accounts.some(a => a.id === input.accountId)) throw new Error('Choose a customer account from CRM.');
    if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) throw new Error('Add between 1 and 100 order lines.');
    const seen = new Set();
    const lines = input.lines.map(line => {
      const model = text(line.model || line.sku), item = resolveItem(state, model, region);
      const sku = item?.sku || 'UNLISTED::' + region + '::' + model;
      if (!model || model.length > 150 || seen.has(sku.toLowerCase())) throw new Error('Enter a model number and combine duplicate models into one line.');
      seen.add(sku.toLowerCase());
      const qty = Number(line.qty), price = Number(line.price);
      if (!Number.isInteger(qty) || qty < 1 || qty > 1000000 || !Number.isFinite(price) || price <= 0 || price > 1000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) throw new Error('Use positive whole quantities and unit prices with at most two decimals.');
      return {sku,model:item?.model || model,title:item?.title || '',qty,price,allocated:0,redeemed:0,shipped:0};
    });
    const address = Object.fromEntries(['line1','line2','line3','city','state','zip'].map(k => [k,text(input.address?.[k]).slice(0,250)]));
    return {po:text(input.po),accountId:input.accountId,region,type:input.type,purpose:input.purpose === 'EVENT' ? 'EVENT' : 'REGULAR',eventId:input.eventId || null,programId:input.programId || null,
      address,inHandsDate:text(input.inHandsDate),holdUntil:input.type === 'HOLD_PO' && input.holdUntil ? new Date(input.holdUntil + 'T23:59:59Z').toISOString() : null,
      instructions:text(input.instructions).slice(0,5000),warehouseId:text(input.warehouseId),
      shipping:{warehouseId:text(input.warehouseId),warehouse:WAREHOUSES.find(w => w.id === input.warehouseId)?.name || '',destination:Object.values(address).filter(Boolean).join(', '),city:address.city,state:address.state,zip:address.zip,method:text(input.shippingMethod).slice(0,100),thirdPartyAccount:text(input.thirdPartyAccount).slice(0,100),thirdPartyZip:text(input.thirdPartyZip).slice(0,30)},lines};
  }
  function assess(state, order, partnerId) {
    const issues = [], e = state.enterprise, account = e.accounts.find(a => a.id === order.accountId);
    const add = (code, detail, model = '') => issues.push({code,label:ISSUES[code],detail,model});
    if (!account || account.status !== 'ACTIVE') add('CUSTOMER','Select an active customer account.');
    if (!order.address?.line1 || !order.address?.city || !order.address?.state || !order.address?.zip) add('ADDRESS','Line 1, city, state and ZIP are required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(order.inHandsDate || '') || !Number.isFinite(new Date(order.inHandsDate).getTime())) add('IN_HANDS','Enter a valid in-hands date.');
    if (!text(order.shipping?.method)) add('SHIPPING','Choose a shipping method.');
    if (!!text(order.shipping?.thirdPartyAccount) !== !!text(order.shipping?.thirdPartyZip)) add('THIRD_PARTY','Provide both the third-party account and its billing ZIP.');
    if (!WAREHOUSES.some(w => w.id === warehouseId(order))) add('WAREHOUSE','Assign Sarasota or Farmers Branch.');
    if (order.type === 'HOLD_PO' && (!order.holdUntil || new Date(order.holdUntil).getTime() <= Date.now())) add('HOLD_EXPIRY','Choose a future hold expiry date.');
    if (order.programId && !e.programs.some(p => p.id === order.programId && p.accountId === order.accountId && p.status === 'LIVE')) add('CUSTOMER','The selected program must be live and belong to this customer.');
    if (account && pending(order) && total(order) > num(account.creditLimit) - num(account.creditUsed)) add('CREDIT','Order value exceeds the customer’s remaining credit.');
    for (const line of order.lines) {
      const item = e.inventory.find(i => i.sku === line.sku);
      if (!item) { add('NO_INVENTORY','This model has no catalog inventory record.',line.model); continue; }
      const status = norm(item.status || item.itemStatus || '');
      if (/discontinued/.test(status)) add('DISCONTINUED','This item is discontinued.',line.model || item.model);
      else if (/feedsonly|feedonly/.test(status)) add('FEEDS_ONLY','This item is available for feeds only.',line.model || item.model);
      else if (/internaluse/.test(status)) add('INTERNAL_USE','This item is restricted to internal use.',line.model || item.model);
      else if (/outofstock/.test(status)) add('OUT_OF_STOCK','The item is marked out of stock.',line.model || item.model);
      if (item.nature === 'DIGITAL') add('DIGITAL','Use the existing digital order workflow for this model.',line.model || item.model);
      if (S.regionCode(item.region) !== S.regionCode(order.region)) add('REGION','The model belongs to another region.',line.model || item.model);
      const own = pending(order) || order.fulfillment?.kind === '3PL' ? 0 : Math.max(0, line.qty - num(line.shipped));
      const stock = partnerId ? state.logistics.tplInventory.find(i => i.nodeId === partnerId && i.sku === line.sku) : item;
      const free = partnerId ? Math.max(0,num(stock?.qty) - num(stock?.reserved)) : S.available(item) + own;
      if (partnerId && (!stock || stock.variation === false)) add('NO_INVENTORY','The selected 3PL does not have eligible stock for this model.',line.model || item.model);
      else if (free === 0) add('OUT_OF_STOCK',partnerId ? 'No available partner stock.' : 'No unreserved, undamaged stock.',line.model || item.model);
      else if (line.qty - num(line.shipped) > free) add('NO_INVENTORY','Only ' + free + ' units are available for this order.',line.model || item.model);
    }
    return issues;
  }
  function createDraft(input) {
    return S.transaction('CUSTOMER_ORDER_STAGED','Customer PO ' + text(input.po), state => {
      const clean = cleanInput(input,state);
      if (state.enterprise.orders.some(o => o.po.toLowerCase() === clean.po.toLowerCase())) throw new Error('This customer PO already exists.');
      const id = S.uid('ord'), timestamp = now();
      const order = {...clean,id,orderNumber:'SO-' + timestamp.slice(0,10).replaceAll('-','') + '-' + id.slice(-8).toUpperCase(),status:'UNVALIDATED',recordRevision:0,validation:{state:'UNVALIDATED',issues:[],checkedAt:null},createdAt:timestamp,updatedAt:timestamp};
      state.enterprise.orders.push(order); return id;
    });
  }
  function editDraft(id, input, expectedUpdatedAt, expectedVersion) {
    return S.transaction('CUSTOMER_ORDER_UPDATED','Customer order ' + id, state => {
      const order = state.enterprise.orders.find(o => o.id === id);
      if (!order || !pending(order) || final(order)) throw new Error('Only unvalidated orders and orders with issues can be edited.');
      if (expectedVersion !== undefined && num(order.recordRevision) !== expectedVersion) throw new Error('This order changed in another tab. Reload before editing.');
      if (expectedUpdatedAt && order.updatedAt !== expectedUpdatedAt) throw new Error('This order changed in another tab. Reload before editing.');
      const clean = cleanInput(input,state);
      if (state.enterprise.orders.some(o => o.id !== id && o.po.toLowerCase() === clean.po.toLowerCase())) throw new Error('This customer PO already exists.');
      Object.assign(order,clean,{recordRevision:num(order.recordRevision)+1,status:'UNVALIDATED',validation:{state:'UNVALIDATED',issues:[],checkedAt:null},updatedAt:now()}); return id;
    });
  }
  function validateDraft(id) {
    return S.transaction('CUSTOMER_ORDER_VALIDATED',id,state => {
      const order = state.enterprise.orders.find(o => o.id === id);
      if (!order || final(order)) throw new Error('Choose an open customer order.');
      if (!pending(order)) return {ok:true,issues:[]};
      const issues = assess(state,order);
      order.validation = {state:issues.length ? 'ISSUES' : 'VALIDATED',issues,checkedAt:now()};
      order.updatedAt = now(); order.recordRevision=num(order.recordRevision)+1; order.status = issues.length ? 'ISSUES' : order.type === 'HOLD_PO' ? 'ALLOCATED' : 'PICKING';
      if (!issues.length) { order.lines.forEach(line => line.allocated = line.qty); state.enterprise.accounts.find(a => a.id === order.accountId).creditUsed += total(order); }
      return {ok:!issues.length,issues};
    });
  }
  function orderSearch(state, order, query) {
    if (!text(query)) return true;
    const related = [...state.logistics.packing.filter(p => p.orderId === order.id),...state.logistics.tplShipments.filter(p => p.customerOrderId === order.id)];
    const values = [order.po,order.id,order.orderNumber,order.tracking,order.createdAt,order.updatedAt,order.inHandsDate,order.holdUntil,...order.lines.flatMap(l => [l.model,l.sku]),...related.map(r => r.tracking),state.enterprise.accounts.find(a => a.id === order.accountId)?.name];
    const hay = values.filter(Boolean).join(' ').toLowerCase();
    return text(query).toLowerCase().split(/\s+/).every(term => hay.includes(term));
  }
  function updateDelivery(id,input,expectedVersion) {
    return S.transaction('CUSTOMER_DELIVERY_UPDATED',id,state=>{
      const order=state.enterprise.orders.find(o=>o.id===id);
      if(!order || final(order) || pending(order) || ['3PL','DROPSHIP'].includes(order.fulfillment?.kind))throw new Error('Update delivery details before external fulfillment or dispatch.');
      if(expectedVersion!==undefined && num(order.recordRevision)!==expectedVersion)throw new Error('This order changed in another tab. Reload before saving.');
      const candidate={...order,address:Object.fromEntries(['line1','line2','line3','city','state','zip'].map(k=>[k,text(input.address?.[k]).slice(0,250)])),inHandsDate:text(input.inHandsDate),instructions:text(input.instructions).slice(0,5000),warehouseId:input.warehouseId,
        shipping:{...order.shipping,warehouseId:input.warehouseId,warehouse:WAREHOUSES.find(w=>w.id===input.warehouseId)?.name || '',method:text(input.shippingMethod),thirdPartyAccount:text(input.thirdPartyAccount),thirdPartyZip:text(input.thirdPartyZip)},validation:{state:'VALIDATED',checkedAt:now(),issues:[]}};
      candidate.shipping.destination=Object.values(candidate.address).filter(Boolean).join(', ');
      const issues=assess(state,candidate);if(issues.length)throw new Error(issues[0].label+': '+issues[0].detail);
      Object.assign(order,candidate,{recordRevision:num(order.recordRevision)+1,updatedAt:now()});
    });
  }
  function shipWarehouse(id, input) {
    return S.transaction('WAREHOUSE_ORDER_DISPATCHED',id,state => {
      const order = state.enterprise.orders.find(o => o.id === id);
      if (!order || final(order) || pending(order) || order.type === 'HOLD_PO' || ['3PL','DROPSHIP'].includes(order.fulfillment?.kind) || warehouseId(order) !== 'SARASOTA') throw new Error('Choose a validated, open Sarasota warehouse order.');
      if (!input.packed || !text(input.tracking) || !text(input.carrier)) throw new Error('Confirm picking/packing and enter the carrier and tracking number.');
      const issues = assess(state,order); if (issues.length) throw new Error(issues[0].label + ': ' + issues[0].detail);
      const timestamp = now();
      for (const line of order.lines) {
        const remaining = line.qty - num(line.shipped); if (remaining <= 0) continue;
        const item = state.enterprise.inventory.find(i => i.sku === line.sku);
        if (!item || item.onHand - num(item.damaged) < remaining) throw new Error('Insufficient usable stock for ' + line.model);
        item.onHand -= remaining; line.shipped = line.qty;
        let pack = state.logistics.packing.find(p => p.orderId === id && p.sku === line.sku && !['SHIPPED','CANCELLED'].includes(p.status));
        if (!pack) { pack = {id:S.uid('PK'),orderId:id,order:order.po,sku:line.sku}; state.logistics.packing.push(pack); }
        Object.assign(pack,{qty:remaining,status:'SHIPPED',tracking:text(input.tracking),carrier:text(input.carrier),service:text(input.service || order.shipping.method),shippedAt:timestamp,warehouseId:'SARASOTA',carton:text(input.carton),notes:text(input.notes)});
        state.logistics.movements.unshift({id:S.uid('mv'),time:timestamp,type:'SHIP',sku:line.sku,qty:-remaining,from:'SARASOTA',to:pack.carrier,ref:order.po,user:'Shipping'});
      }
      state.logistics.waves.filter(w => w.orderIds?.includes(id)).forEach(w => {w.status='COMPLETE';w.picked=w.qty;});
      order.status='SHIPPED';order.tracking=text(input.tracking);order.updatedAt=timestamp;order.fulfillment={kind:'LOCAL',nodeId:'SARASOTA'};
    });
  }
  function request3PL(id, nodeId) {
    return S.transaction('3PL_SHIPMENT_REQUESTED',id,state => {
      const order=state.enterprise.orders.find(o=>o.id===id), node=state.logistics.tplNodes.find(n=>n.id===nodeId && n.status==='ACTIVE');
      if (!order || final(order) || order.type === 'HOLD_PO' || !node || order.fulfillment?.kind === '3PL' || order.fulfillment?.kind === 'DROPSHIP') throw new Error('Choose an open physical order and an active 3PL partner.');
      if (order.lines.some(l=>num(l.shipped)>0) || state.logistics.packing.some(p=>p.orderId===id) || state.logistics.waves.some(w=>w.orderIds?.includes(id) && (w.status==='PICKING' || num(w.picked)>0))) throw new Error('Warehouse execution has started. Reconcile it before routing to a 3PL.');
      if(!order.address || !order.validation)throw new Error('Complete this order’s delivery and warehouse details before creating a 3PL request.');
      const issues=assess(state,order,nodeId); if(issues.length) throw new Error(issues.map(i=>i.label+': '+i.detail).join(' '));
      if (pending(order)) {state.enterprise.accounts.find(a=>a.id===order.accountId).creditUsed+=total(order);order.lines.forEach(l=>l.allocated=l.qty);order.validation={state:'VALIDATED',checkedAt:now(),issues:[]};}
      const requestId=S.uid('3plreq'),timestamp=now(); const shipments=[];
      for (const line of order.lines) {
        const stock=state.logistics.tplInventory.find(i=>i.nodeId===nodeId && i.sku===line.sku);stock.reserved+=line.qty;
        const shipment={id:S.uid('TPL'),requestId,customerOrderId:id,orderId:order.po,nodeId,sku:line.sku,model:line.model || state.enterprise.inventory.find(i=>i.sku===line.sku)?.model,qty:line.qty,state:order.address.state,service:order.shipping.method,status:'REQUESTED',createdAt:timestamp,acceptedAt:null,dispatchedAt:null,tracking:'',cost:0};
        state.logistics.tplShipments.push(shipment);shipments.push(shipment.id);
      }
      state.logistics.tplRequests ||= [];
      state.logistics.tplRequests.push({id:requestId,customerOrderId:id,nodeId,shipmentIds:shipments,status:'REQUESTED',createdAt:timestamp,updatedAt:timestamp,transmission:{state:'QUEUED',attempts:0},payload:{schema_version:'stark.3pl.order.v1',request_id:requestId,order_number:order.orderNumber || order.id,customer_po:order.po,partner_id:nodeId,customer:state.enterprise.accounts.find(a=>a.id===order.accountId).name,address:clone(order.address),instructions:order.instructions || '',in_hands_date:order.inHandsDate,shipping:{method:order.shipping.method,third_party_account:order.shipping.thirdPartyAccount || '',third_party_zip:order.shipping.thirdPartyZip || ''},lines:order.lines.map(l=>({sku:l.sku,model:l.model || state.enterprise.inventory.find(i=>i.sku===l.sku)?.model,quantity:l.qty}))}});
      order.fulfillment={kind:'3PL',nodeId,requestId,shipmentId:shipments[0]};order.status='PICKING';order.updatedAt=timestamp;
      state.logistics.waves.filter(w=>w.orderIds?.includes(id)).forEach(w=>{w.status='COMPLETE';w.cancelledFor3PL=true;});
      return requestId;
    });
  }
  function dispatchRow(state, row) {
    const shipment=state.logistics.tplShipments.find(s=>s.id===row.shipmentId);
    if(!shipment || shipment.status==='CANCELLED') throw new Error('Choose an active partner shipment.');
    if(['DISPATCHED','DELIVERED'].includes(shipment.status)) {
      if(shipment.tracking===text(row.tracking) && shipment.qty===Number(row.qty)) return 'duplicate';
      throw new Error('A dispatched shipment cannot be overwritten.');
    }
    const order=state.enterprise.orders.find(o=>o.id===shipment.customerOrderId);
    if(!order || pending(order) || final(order) || order.fulfillment?.kind!=='3PL') throw new Error('The shipment must link to a validated open 3PL order.');
    if(Number(row.qty)!==shipment.qty || !text(row.tracking) || text(row.tracking).length>200 || !text(row.carrier)) throw new Error('Use the exact shipment quantity, carrier and tracking number.');
    const date=new Date(row.shippedAt || now());if(!Number.isFinite(date.getTime()) || date.getTime()>Date.now()+300000) throw new Error('Use a valid shipment date that is not in the future.');
    const stock=state.logistics.tplInventory.find(i=>i.nodeId===shipment.nodeId && i.sku===shipment.sku),line=order.lines.find(l=>l.sku===shipment.sku);
    if(!stock || stock.qty<shipment.qty || !line || shipment.qty>line.qty-num(line.shipped)) throw new Error('Shipment exceeds partner stock or the remaining order balance.');
    stock.qty-=shipment.qty;stock.reserved=Math.max(0,stock.reserved-shipment.qty);line.shipped=num(line.shipped)+shipment.qty;
    Object.assign(shipment,{status:'DISPATCHED',tracking:text(row.tracking),carrier:text(row.carrier),dispatchedAt:date.toISOString(),updatedAt:now()});
    order.status=order.lines.every(l=>num(l.shipped)>=l.qty)?'SHIPPED':'PICKING';order.tracking=shipment.tracking;order.updatedAt=now();
    const request=(state.logistics.tplRequests||[]).find(r=>r.id===shipment.requestId);if(request){request.status=order.status==='SHIPPED'?'DISPATCHED':'PARTIALLY_DISPATCHED';request.updatedAt=now();}
    return 'imported';
  }
  const rowValue=(row,...keys)=>{const values=Object.fromEntries(Object.entries(row).map(([k,v])=>[norm(k),v]));return keys.map(k=>values[norm(k)]).find(v=>v!==undefined && v!=='') ?? '';};
  function importPlan(rows) {
    if(!Array.isArray(rows) || !rows.length || rows.length>2000) throw new Error('Upload between 1 and 2,000 shipment rows.');
    const state=S.getState(),simulation=clone(state),seen=new Set();
    return {revision:state.revision,rows:rows.map((raw,index)=>{
      try {
        let shipmentId=text(rowValue(raw,'shipmentId','shipment_id','3pl shipment#'));
        const ref=text(rowValue(raw,'orderRef','order#','order number','customer po','po#')),model=text(rowValue(raw,'model#','model','sku'));
        if(!shipmentId){const matches=simulation.logistics.tplShipments.filter(s=>[s.orderId,s.customerOrderId,simulation.enterprise.orders.find(o=>o.id===s.customerOrderId)?.orderNumber].includes(ref) && [s.sku,s.model,simulation.enterprise.inventory.find(i=>i.sku===s.sku)?.model].includes(model));if(matches.length!==1)throw new Error('Use a unique shipment ID, or an exact order reference and model.');shipmentId=matches[0].id;}
        if(seen.has(shipmentId))throw new Error('Duplicate shipment row in this upload.');seen.add(shipmentId);
        const row={shipmentId,qty:Number(rowValue(raw,'quantity','qty')),tracking:text(rowValue(raw,'tracking#','tracking','tracking number')),carrier:text(rowValue(raw,'carrier')),shippedAt:text(rowValue(raw,'shippedDate','ship date','shipped at'))};
        if(!row.shippedAt)throw new Error('Enter the shipment date.');
        const result=dispatchRow(simulation,row);return {...row,line:index+2,result,error:''};
      }catch(error){return {line:index+2,result:'error',error:error.message,shipmentId:text(rowValue(raw,'shipmentId','shipment_id'))};}
    })};
  }
  function applyImport(plan) {
    if(!plan?.rows?.length || plan.rows.some(r=>r.error)) throw new Error('Fix every invalid row before importing.');
    return S.transaction('3PL_SHIPMENTS_IMPORTED',plan.rows.length+' shipment rows',state=>{
      if(state.revision!==plan.revision)throw new Error('The workspace changed after preview. Preview the file again before importing.');
      const result={imported:0,duplicates:0};
      for(const row of plan.rows){const status=dispatchRow(state,row);if(status==='duplicate')result.duplicates++;else result.imported++;}return result;
    });
  }
  function ship3PL(shipmentId,input) {
    const shipment=S.getState().logistics.tplShipments.find(s=>s.id===shipmentId);
    if(!shipment || shipment.status!=='PICKING')throw new Error('Move this partner shipment to Picking before dispatch.');
    return S.transaction('3PL_SHIPMENT_DISPATCHED',shipmentId,state=>dispatchRow(state,{...input,shipmentId,qty:shipment.qty,shippedAt:now()}));
  }
  function dailyShipments(day, warehouse='SARASOTA') {
    const state=S.getState(),dateKey=value=>{
      const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
      const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
      const get=k=>parts.find(p=>p.type===k)?.value;return get('year')+'-'+get('month')+'-'+get('day');
    };
    return state.logistics.packing.filter(p=>p.status==='SHIPPED' && dateKey(p.shippedAt)===day).map(p=>{
      const order=state.enterprise.orders.find(o=>o.id===p.orderId || o.po===p.order),item=state.enterprise.inventory.find(i=>i.sku===p.sku);
      return {...p,po:order?.po || p.order,orderNumber:order?.orderNumber || order?.id,model:item?.model || p.sku,customer:state.enterprise.accounts.find(a=>a.id===order?.accountId)?.name || p.agency || '',warehouseId:p.warehouseId || (order?warehouseId(order):'')};
    }).filter(p=>p.warehouseId===warehouse);
  }
  function createPO(input) {
    if(!Array.isArray(input.lines) || !input.lines.length || new Set(input.lines.map(l=>l.sku)).size!==input.lines.length)throw new Error('Add catalog models and combine duplicate lines.');
    const state=S.getState();
    const lines=input.lines.map(line=>{const item=state.enterprise.inventory.find(i=>i.sku===line.sku);if(!item || !text(line.vendorItem) || !text(line.title) || !text(line.description))throw new Error('Each vendor PO line needs a catalog model, vendor item number, title and description.');return {...line,model:item.model,vendorItem:text(line.vendorItem),title:text(line.title),description:text(line.description)};});
    return S.createPurchaseOrder({...input,recordRevision:0,notes:text(input.notes).slice(0,5000),lines});
  }
  function updatePO(id,input,expectedUpdatedAt,expectedVersion) {
    return S.transaction('VENDOR_PO_UPDATED',id,state=>{
      const po=state.enterprise.purchaseOrders.find(p=>p.id===id);if(!po || ['RECEIVED','CANCELLED'].includes(po.status))throw new Error('Choose an open vendor PO.');
      if(expectedVersion !== undefined && num(po.recordRevision)!==expectedVersion)throw new Error('This vendor PO changed in another tab. Reload before saving.');
      if(expectedUpdatedAt && (po.updatedAt || po.issuedAt)!==expectedUpdatedAt)throw new Error('This vendor PO changed in another tab. Reload before saving.');
      const tracking=text(input.tracking).slice(0,200),notes=text(input.notes).slice(0,5000);
      Object.assign(po,{tracking,carrier:text(input.carrier).slice(0,100),notes,recordRevision:num(po.recordRevision)+1,updatedAt:now()});
      if(tracking && po.status==='PO_ISSUED')po.status='DISPATCHED';
    });
  }
  async function attachmentFromFile(file) {
    if(!file || file.size<1 || file.size>1024*1024)throw new Error('Choose a PDF, PNG or JPEG packing slip up to 1 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const isPDF=String.fromCharCode(...bytes.slice(0,5))==='%PDF-',isPNG=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),isJPG=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    const mime=isPDF?'application/pdf':isPNG?'image/png':isJPG?'image/jpeg':'';if(!mime)throw new Error('The file must contain a valid PDF, PNG or JPEG header.');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const filename=text(file.name).replace(/[\/\\\u0000-\u001f]/g,'_').replace(/\.[^.]*$/,'').slice(0,140)+(isPDF?'.pdf':isPNG?'.png':'.jpg');
    return {id:S.uid('slip'),name:filename,mime,size:bytes.length,data:btoa(binary),createdAt:now()};
  }
  function attachPO(id,attachment) {
    return S.transaction('VENDOR_PACKING_SLIP_ATTACHED',id,state=>{
      const po=state.enterprise.purchaseOrders.find(p=>p.id===id);if(!po)throw new Error('Vendor PO not found.');
      if(!attachment || !['application/pdf','image/png','image/jpeg'].includes(attachment.mime) || !Number.isInteger(attachment.size) || attachment.size<1 || attachment.size>1024*1024 || typeof attachment.data!=='string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.data) || atob(attachment.data).length!==attachment.size)throw new Error('Invalid packing slip.');
      po.attachments ||= [];if(po.attachments.length>=5 || po.attachments.reduce((n,a)=>n+a.size,0)+attachment.size>2*1024*1024)throw new Error('Keep at most five packing slips, totaling 2 MB per PO.');
      po.attachments.push(clone(attachment));po.recordRevision=num(po.recordRevision)+1;po.updatedAt=now();
    });
  }
  function removeAttachment(id,attachmentId){S.transaction('VENDOR_PACKING_SLIP_REMOVED',id,state=>{const po=state.enterprise.purchaseOrders.find(p=>p.id===id);if(!po)throw new Error('Vendor PO not found.');po.attachments=(po.attachments||[]).filter(a=>a.id!==attachmentId);po.recordRevision=num(po.recordRevision)+1;po.updatedAt=now();});}
  function markTransmission(id,state,fields={}) {
    S.transaction('3PL_API_STATUS_UPDATED',id,s=>{
      const request=(s.logistics.tplRequests||[]).find(r=>r.id===id);if(!request || request.status==='CANCELLED')throw new Error('Choose an active shipment request.');
      if(!['QUEUED','SENDING','ACKNOWLEDGED','REJECTED','UNKNOWN'].includes(state))throw new Error('Invalid API delivery state.');
      const events=[{time:now(),state,error:fields.error || ''},...(request.transmission.events || [])].slice(0,50);
      request.transmission={...request.transmission,...fields,state,events,updatedAt:now()};request.updatedAt=now();
    });
  }
  async function sendForProcessing(id,statusOnly=false) {
    const request=(S.getState().logistics.tplRequests||[]).find(r=>r.id===id);
    if(!request || request.status==='CANCELLED')throw new Error('Choose an active shipment request.');
    if(!statusOnly && (!S.getState().mode || S.getState().mode==='sample'))throw new Error('Start a working workspace before sending real partner orders.');
    if(!window.StarkSystemCloud?.getStatus().active)throw new Error('Connect the shared organization workspace in Data Center before sending partner orders.');
    if(!statusOnly && !['QUEUED','REJECTED'].includes(request.transmission.state))throw new Error('Refresh API status before attempting another send.');
    if(!statusOnly)markTransmission(id,'SENDING',{attempts:num(request.transmission.attempts)+1,error:''});
    try{
      const result=await window.StarkSystemCloud.send3PLRequest(id,statusOnly);
      markTransmission(id,result.state,{remoteOrderId:result.remote_order_id || '',error:result.error || '',sentAt:result.sent_at || request.transmission.sentAt || null});
      return result;
    }catch(error){if(!statusOnly)markTransmission(id,error.deliveryState || 'UNKNOWN',{error:error.message});throw error;}
  }
  window.StarkFulfillment={WAREHOUSES,ISSUES,final,pending,total,warehouseId,warehouseName,resolveItem,cleanInput,assess,createDraft,editDraft,validateDraft,orderSearch,updateDelivery,shipWarehouse,request3PL,ship3PL,importPlan,applyImport,dailyShipments,createPO,updatePO,attachmentFromFile,attachPO,removeAttachment,sendForProcessing};
})();
