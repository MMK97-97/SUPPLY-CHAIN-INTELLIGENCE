(function () {
  'use strict';
  if (window.StarkSystem) return;
  const script = document.currentScript;
  const rootURL = new URL('../', script.src);
  const KEY = 'stark.unifiedSystem.v1';
  const CHANNEL = 'stark-unified-system';
  const clone = value => JSON.parse(JSON.stringify(value));
  const stamp = () => new Date().toISOString();
  const uid = p => `${p}_${globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
  const final = status => ['SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED'].includes(status);
  const awaitingValidation = o => o.validation && o.validation.state !== 'VALIDATED';
  const requireValidated = o => { if (awaitingValidation(o)) throw new Error('Validate this customer order before fulfillment.'); };
  const number = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const read = key => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; };
  const regionCode = r => /^(CA|CANADA)$/i.test(r) ? 'CA' : /^EU$/i.test(r) ? 'EU' : 'US';
  let channel;
  try { channel = new BroadcastChannel(CHANNEL); } catch (_) {}

  function activeReservations(e) {
    const totals = {};
    for (const o of e.orders) {
      if (final(o.status) || awaitingValidation(o) || ['3PL','DROPSHIP'].includes(o.fulfillment?.kind)) continue;
      for (const l of o.lines) {
        const q = o.type === 'HOLD_PO' ? Math.max(0, l.allocated - number(l.redeemed)) : Math.max(0, l.qty - number(l.shipped));
        totals[l.sku] = (totals[l.sku] || 0) + q;
      }
    }
    return totals;
  }
  function initialize() {
    const oldE = read('stark.enterpriseSuite.v1');
    const oldL = read('stark.logisticsSuite.v2');
    const e = oldE || window.StarkSystemSeeds.enterprise();
    const l = oldL || window.StarkSystemSeeds.logistics();
    const s = { schemaVersion: 1, revision: 0, createdAt: stamp(), updatedAt: stamp(), mode: oldE || oldL ? 'working' : 'sample', enterprise: e, logistics: l, regional: {}, events: {}, audit: [] };
    const reservations = activeReservations(e);
    for (const wi of l.inventory) {
      let i = e.inventory.find(x => x.sku === wi.sku);
      if (!i) { i = { ...wi, model: wi.sku, title: wi.description, nature: 'PHYSICAL', safety: 10, cost: 0, standardPrice: 0 }; e.inventory.push(i); }
      // Preserve existing warehouse stock when a prior logistics workspace exists.
      if (oldL) i.onHand = wi.onHand;
      i.damaged = Math.max(number(i.damaged), number(wi.damaged));
    }
    for (const i of e.inventory) {
      i.region ||= 'US';
      i.damaged = number(i.damaged);
      i.externalReserved = Math.max(0, number(i.reserved) - (reservations[i.sku] || 0));
    }
    if (!oldL) { l.waves = []; l.packing = []; l.bins.forEach(b => { const used=l.inventory.filter(i=>i.binId===b.id).reduce((n,i)=>n+i.onHand,0); b.capacity=Math.max(b.capacity,used*2); }); }
    // Existing untouched seeds carry inconsistent demonstration wave/pack references.
    l.waves.forEach(w => { w.orderIds ||= w.orders.map(po => e.orders.find(o => o.po === po)?.id).filter(Boolean); });
    s.audit.push({ id: uid('audit'), time: stamp(), action: 'SYSTEM_CONNECTED', detail: oldE || oldL ? 'Existing operations and logistics records migrated.' : 'Sample workspace initialized. Use Data Center to start an empty workspace.' });
    reconcile(s);
    persist(s);
    return s;
  }
  function persist(s) {
    // The complete state is committed with one storage write; failed quota writes abort.
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  let state;
  try { state = read(KEY) || initialize(); }
  catch (error) {
    window.StarkSystemFailure = error;
    document.addEventListener('DOMContentLoaded',()=>{
      delete document.body.dataset.systemPage;
      document.body.innerHTML='<main style="max-width:640px;margin:10vh auto;padding:28px;font:16px/1.6 Arial,sans-serif"><h1>Workspace could not open</h1><p>The saved workspace could not be read. Your stored records have been preserved. Export them before clearing this site’s browser data, then restore your last valid backup.</p><button id="system-recovery-export" style="padding:12px 18px;font:inherit">Export stored records</button></main>';
      document.querySelector('#system-recovery-export').onclick=()=>{const records={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('stark'))records[key]=localStorage.getItem(key);}const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({format:'stark-storage-recovery',records},null,2)],{type:'application/json'}));a.href=url;a.download='Supply-Chain-Intelligence-storage-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    });
    return;
  }

  function notify() {
    window.dispatchEvent(new CustomEvent('stark:system-change', { detail: { revision: state.revision } }));
    channel?.postMessage({ revision: state.revision });
  }
  function refresh() {
    const latest = read(KEY);
    if (latest && latest.revision !== state.revision) { state = latest; notify(); }
  }
  window.addEventListener('storage', e => { if (e.key === KEY) refresh(); });
  if (channel) channel.onmessage = () => refresh();

  function reconcile(s) {
    const e = s.enterprise, l = s.logistics;
    const reservations = activeReservations(e);
    e.inventory.forEach(i => {
      i.reserved = number(i.externalReserved) + (reservations[i.sku] || 0);
      i.damaged = number(i.damaged);
      if (i.nature === 'DIGITAL') return;
      let rows = l.inventory.filter(x => x.sku === i.sku);
      if (!rows.length) {
        const binId = `UNASSIGNED-${i.region || 'US'}`;
        if (!l.bins.some(b => b.id === binId)) l.bins.push({ id: binId, zone: 'UNASSIGNED', aisle: i.region || 'US', rack: '', level: '', capacity: 10000, maxWeightKg: 10000, used: 0, active: true });
        const wi = { sku: i.sku, brand: i.brand, description: i.title, binId, region: i.region || 'US', onHand: i.onHand, reserved: i.reserved, damaged: i.damaged, serialized: false, lastCount: '' };
        l.inventory.push(wi); rows = [wi];
      }
      // Location rows always sum to the canonical physical stock balance.
      const total = rows.reduce((a, x) => a + number(x.onHand), 0);
      if (total < i.onHand) rows[0].onHand += i.onHand - total;
      else if (total > i.onHand) { let excess=total-i.onHand; for(const wi of rows){const q=Math.min(excess,Math.max(0,wi.onHand-number(wi.damaged)));wi.onHand-=q;excess-=q;} }
      const knownDamage=rows.reduce((n,x)=>n+number(x.damaged),0);
      if(knownDamage<i.damaged)rows[0].damaged=number(rows[0].damaged)+i.damaged-knownDamage;
      else if(knownDamage>i.damaged){let excess=knownDamage-i.damaged;for(const wi of rows){const q=Math.min(excess,number(wi.damaged));wi.damaged=number(wi.damaged)-q;excess-=q;}}
      let reserve = i.reserved;
      for (const wi of rows) { wi.reserved = Math.min(Math.max(0,wi.onHand-number(wi.damaged)), reserve); reserve -= wi.reserved; }
    });
    l.bins.forEach(b => { b.used = l.inventory.filter(i => i.binId === b.id).reduce((a, i) => a + number(i.onHand), 0); });
    for (const p of e.purchaseOrders) {
      if (p.purpose === 'DROPSHIP' || p.status === 'CANCELLED' || p.lines.every(x => number(x.received) >= x.qty)) continue;
      if (!l.receipts.some(r => r.po === p.po && !['CLOSED','CANCELLED'].includes(r.status))) l.receipts.push({ id: uid('rcv'), po: p.po, vendor: e.vendors.find(v => v.id === p.vendorId)?.name || '', asn: `ASN-${p.po}`, appointment: p.eta, dock: 'D1', carrier: p.carrier || 'TBD', status: 'SCHEDULED', invoice: 'Pending', invoiceTotal: 0, poTotal: p.lines.reduce((a, x) => a + x.qty * x.cost, 0), lines: p.lines.map(x => ({ sku: x.sku, expected: x.qty - number(x.received), received: 0, damaged: 0, unitCost: x.cost })) });
    }
    for (const o of e.orders) {
      if (final(o.status) || awaitingValidation(o) || o.type === 'HOLD_PO' || ['3PL','DROPSHIP'].includes(o.fulfillment?.kind)) continue;
      for (const line of o.lines) {
        const i = e.inventory.find(x => x.sku === line.sku);
        if (!i || i.nature === 'DIGITAL' || !['ALLOCATED', 'PICKING'].includes(o.status)) continue;
        if (l.waves.some(w => w.orderIds?.includes(o.id) && w.sku === line.sku)) continue;
        l.waves.push({ id: uid('WAVE'), orderIds: [o.id], orders: [o.po], sku: line.sku, qty: line.qty, binId: l.inventory.find(x => x.sku === line.sku)?.binId || 'UNASSIGNED', status: 'READY', picked: 0, picker: 'Unassigned', priority: o.shipping?.priority === 'Expedite' ? 'HIGH' : 'NORMAL', createdAt: stamp() });
      }
    }
  }
  function validateState(s) {
    if (s.schemaVersion !== 1 || !s.enterprise || !s.logistics) throw new Error('Unsupported workspace format.');
    const e = s.enterprise, l = s.logistics;
    const arrays = ['accounts','programs','inventory','orders','vendors','purchaseOrders','priceOverrides','vendorPriceBooks','vaultTokens','apiKeys','webhookLogs','slaLogs','activity'];
    for (const k of arrays) if (!Array.isArray(e[k])) throw new Error(`Invalid ${k} records.`);
    for (const k of ['warehouses','bins','inventory','receipts','putaway','waves','packing','cycleCounts','movements','tplNodes','tplInventory','tplShipments','reconciliations','activity']) if (!Array.isArray(l[k])) throw new Error(`Invalid ${k} records.`);
    if (l.tplRequests !== undefined) {
      if (!Array.isArray(l.tplRequests)) throw new Error('Invalid 3PL processing requests.');
      const requestIds = new Set();
      for (const request of l.tplRequests) {
        if (!request.id || requestIds.has(request.id) || !e.orders.some(o => o.id === request.customerOrderId) || !Array.isArray(request.shipmentIds) || !request.payload || !['QUEUED','SENDING','ACKNOWLEDGED','REJECTED','UNKNOWN'].includes(request.transmission?.state)) throw new Error('Invalid linked 3PL processing request.');
        requestIds.add(request.id);
      }
    }
    for (const k of ['accounts','programs','orders','vendors','purchaseOrders']) {
      const ids = new Set();
      for (const x of e[k]) { if (!x.id || ids.has(x.id)) throw new Error(`Duplicate or missing ${k} identifier.`); ids.add(x.id); }
    }
    const skus = new Set();
    for (const i of e.inventory) {
      if (!i.sku || skus.has(i.sku)) throw new Error('Duplicate or missing inventory SKU.'); skus.add(i.sku);
      for (const field of ['onHand','reserved','damaged']) if (!Number.isFinite(i[field]) || i[field] < 0) throw new Error(`Invalid ${field} for ${i.sku}.`);
    }
    for (const o of e.orders) {
      if (!e.accounts.some(a => a.id === o.accountId) || !Array.isArray(o.lines)) throw new Error(`Order ${o.po} has an invalid account or line list.`);
      if (o.validation && !['UNVALIDATED','ISSUES','VALIDATED'].includes(o.validation.state)) throw new Error(`Order ${o.po} has an invalid validation state.`);
      if (o.lines.some(x => (!skus.has(x.sku) && !(awaitingValidation(o) && typeof x.model === 'string' && x.model.trim() && typeof x.sku === 'string' && x.sku.startsWith('UNLISTED::'))) || !Number.isInteger(x.qty) || x.qty <= 0)) throw new Error(`Order ${o.po} has an invalid SKU or quantity.`);
      if (awaitingValidation(o) && !['UNVALIDATED','ISSUES','CANCELLED','EXPIRED'].includes(o.status)) throw new Error(`Order ${o.po} cannot execute before validation.`);
    }
  }
  function transaction(action, detail, fn) {
    const latest = read(KEY) || state;
    const next = clone(latest);
    const result = fn(next);
    reconcile(next); validateState(next);
    next.revision = latest.revision + 1; next.updatedAt = stamp();
    next.audit.unshift({ id: uid('audit'), time: next.updatedAt, action, detail }); next.audit = next.audit.slice(0, 400);
    persist(next); state = next; notify();
    return result;
  }
  function moduleData(name) { refresh(); const d = clone(state[name]); d.__systemRevision = state.revision; return d; }
  function saveModule(name, data) {
    return transaction('RECORDS_UPDATED', `${name} records saved.`, s => {
      if (data.__systemRevision !== s.revision) throw new Error('This page has newer changes in another tab. Reload before saving.');
      const value = clone(data); delete value.__systemRevision;
      if (name === 'logistics') {
        for (const item of s.enterprise.inventory.filter(x => x.nature !== 'DIGITAL')) {
          const rows = value.inventory.filter(x => x.sku === item.sku);
          if (rows.length) { item.onHand = rows.reduce((a, x) => a + number(x.onHand), 0); item.damaged = rows.reduce((a, x) => a + number(x.damaged), 0); }
        }
      }
      s[name] = value;
    });
  }
  const inventoryItem = (s, sku) => { const i = s.enterprise.inventory.find(x => x.sku === sku); if (!i) throw new Error('SKU was not found.'); return i; };
  const available = i => Math.max(0, i.onHand - i.reserved - number(i.damaged));
  function checkOrder(s, o) {
    const e = s.enterprise, a = e.accounts.find(x => x.id === o.accountId);
    if (!a || a.status !== 'ACTIVE') throw new Error('Select an active customer account.');
    if (!['HOLD_PO','REDEMPTION_PO','BULK_PO','FIRM_PO'].includes(o.type)) throw new Error('Choose a valid order type.');
    if (!o.po?.trim() || e.orders.some(x => x.po.toLowerCase() === o.po.trim().toLowerCase())) throw new Error('A unique PO reference is required.');
    if (o.programId && !e.programs.some(p => p.id === o.programId && p.accountId === a.id && p.status === 'LIVE')) throw new Error('Select a live program belonging to the customer account.');
    if (!Array.isArray(o.lines) || !o.lines.length) throw new Error('At least one line is required.');
    const totals = new Map();
    for (const line of o.lines) {
      if (!Number.isInteger(line.qty) || line.qty <= 0 || !Number.isFinite(line.price) || line.price <= 0) throw new Error('Use positive whole quantities and a positive unit price.');
      const i = inventoryItem(s, line.sku); if(totals.has(line.sku))throw new Error('Combine duplicate SKUs into one order line.'); totals.set(line.sku, line.qty);
      if (o.supplyMode !== 'DROPSHIP' && o.type !== 'REDEMPTION_PO' && totals.get(line.sku) > available(i)) throw new Error(`Only ${available(i)} unreserved, undamaged units of ${line.sku} are available.`);
    }
    const value = o.lines.reduce((n, x) => n + x.qty * x.price, 0);
    if (o.type !== 'REDEMPTION_PO' && value > a.creditLimit - a.creditUsed) throw new Error('This order exceeds the customer credit limit.');
    if (o.type === 'BULK_PO' && (!o.shipping?.warehouse?.trim() || !o.shipping?.marks?.trim())) throw new Error('Bulk orders require delivery location and shipping marks.');
    if(['FIRM_PO','REDEMPTION_PO'].includes(o.type)&&o.lines.some(x=>inventoryItem(s,x.sku).nature==='PHYSICAL')&&!o.shipping?.destination?.trim())throw new Error('A delivery address is required for a physical customer order.');
    if (o.type === 'HOLD_PO' && (!o.holdUntil || new Date(o.holdUntil).getTime() <= Date.now())) throw new Error('Choose a future hold expiry date.');
    if(o.supplyMode==='DROPSHIP' && (!['BULK_PO','FIRM_PO'].includes(o.type) || o.lines.some(x=>inventoryItem(s,x.sku).nature!=='PHYSICAL') || !o.shipping?.destination?.trim())) throw new Error('Supplier dropship requires a physical Bulk/Firm order and a delivery address.');
    if (o.type === 'REDEMPTION_PO') {
      const h = e.orders.find(x => x.id === o.parentHoldId);
      if (!h || h.type !== 'HOLD_PO' || final(h.status) || new Date(h.holdUntil).getTime() <= Date.now()) throw new Error('An active, unexpired parent hold is required.');
      if (h.accountId !== a.id || (h.programId || null) !== (o.programId || null)) throw new Error('Redemption customer and program must match the parent hold.');
      for (const [sku, qty] of totals) { const hl = h.lines.find(x => x.sku === sku); if (!hl || qty > hl.allocated - number(hl.redeemed)) throw new Error('Redemption exceeds the remaining hold allocation.'); }
    }
    return value;
  }
  function createOrder(o) {
    return transaction('ORDER_CREATED', `${o.po} entered as ${o.type}.`, s => {
      const value = checkOrder(s, o); const e = s.enterprise;
      const order = { ...clone(o), id: uid('ord'), createdAt: stamp(), updatedAt: stamp(), status: o.type === 'HOLD_PO' ? 'ALLOCATED' : 'PICKING', region: inventoryItem(s, o.lines[0].sku).region || 'US', lines: o.lines.map(x => ({ ...x, allocated: x.qty, redeemed: 0, shipped: 0 })) };
      if (o.type === 'REDEMPTION_PO') { const h = e.orders.find(x => x.id === o.parentHoldId); o.lines.forEach(x => { h.lines.find(y => y.sku === x.sku).redeemed += x.qty; }); }
      else e.accounts.find(x => x.id === o.accountId).creditUsed += value;
      if (o.type === 'REDEMPTION_PO') { const parent = e.orders.find(x => x.id === o.parentHoldId); if (parent.warehouseId && !order.warehouseId) { order.warehouseId = parent.warehouseId; order.shipping = {...order.shipping,warehouseId:parent.warehouseId}; } }
      if (o.lines.every(x => inventoryItem(s, x.sku).nature === 'DIGITAL')) order.status = 'ALLOCATED';
      if(o.supplyMode==='DROPSHIP'){order.fulfillment={kind:'DROPSHIP'};order.status='ALLOCATED';}
      e.orders.push(order); e.activity.unshift({ time: stamp(), kind: 'order', text: `${o.po} allocated; stock remains on hand until dispatch.` });
      return order.id;
    });
  }
  function expireHolds() {
    let count = 0;
    if(!state.enterprise.orders.some(o=>o.type==='HOLD_PO'&&!awaitingValidation(o)&&!final(o.status)&&new Date(o.holdUntil).getTime()<=Date.now()))return 0;
    transaction('HOLDS_CHECKED', 'Expired holds released.', s => {
      for (const h of s.enterprise.orders.filter(o => o.type === 'HOLD_PO' && !awaitingValidation(o) && !final(o.status) && new Date(o.holdUntil).getTime() <= Date.now())) {
        const amount = h.lines.reduce((n, x) => n + Math.max(0, x.allocated - number(x.redeemed)) * x.price, 0);
        const a = s.enterprise.accounts.find(x => x.id === h.accountId); a.creditUsed = Math.max(0, a.creditUsed - amount); h.status = 'EXPIRED'; count++;
      }
    }); return count;
  }
  function cancelOrder(id) {
    transaction('ORDER_CANCELLED', id, s => {
      const o = s.enterprise.orders.find(x => x.id === id); if (!o || final(o.status)) throw new Error('Only open orders can be cancelled.');
      if ((s.logistics.tplRequests || []).some(r => r.customerOrderId === id && ['SENDING','ACKNOWLEDGED','UNKNOWN'].includes(r.transmission?.state))) throw new Error('Reconcile or cancel this order with the 3PL before releasing its reservation.');
      if (o.lines.some(x => number(x.shipped) > 0)) throw new Error('A partially shipped order requires a return or remaining-balance reconciliation.');
      if (s.logistics.packing.some(x => x.orderId === id && x.status === 'SHIPPED')) throw new Error('A dispatched order must be handled through a return.');
      if (o.type === 'HOLD_PO' && s.enterprise.orders.some(x => x.parentHoldId === id && !['CANCELLED','EXPIRED'].includes(x.status))) throw new Error('Cancel or fulfill linked redemptions before cancelling the hold.');
      if (o.type === 'REDEMPTION_PO') { const h = s.enterprise.orders.find(x => x.id === o.parentHoldId); o.lines.forEach(x => { const hl = h.lines.find(y => y.sku === x.sku); hl.redeemed = Math.max(0, hl.redeemed - x.qty); }); }
      else if (!awaitingValidation(o)) { const a = s.enterprise.accounts.find(x => x.id === o.accountId); a.creditUsed = Math.max(0, a.creditUsed - o.lines.reduce((n, x) => n + x.qty * x.price, 0)); }
      o.status = 'CANCELLED'; o.updatedAt = stamp();
      for (const r of (s.logistics.tplRequests || []).filter(r => r.customerOrderId === id)) { r.status = 'CANCELLED'; r.updatedAt = stamp(); }
      s.logistics.waves.filter(w => w.orderIds?.includes(id)).forEach(w => w.status = 'COMPLETE');
      s.logistics.packing.filter(x=>x.orderId===id).forEach(x=>x.status='CANCELLED');
      for(const sh of s.logistics.tplShipments.filter(x=>x.customerOrderId===id&&!['DELIVERED','DISPATCHED','CANCELLED'].includes(x.status))){const stock=s.logistics.tplInventory.find(x=>x.nodeId===sh.nodeId&&x.sku===sh.sku);if(stock)stock.reserved=Math.max(0,stock.reserved-sh.qty);sh.status='CANCELLED';}
    });
  }
  function receivePO(id) {
    transaction('PO_RECEIVED', id, s => {
      const p = s.enterprise.purchaseOrders.find(x => x.id === id); if (!p || p.status === 'CANCELLED' || p.purpose==='DROPSHIP') throw new Error('Use supplier dispatch for a dropship PO.');
      for (const x of p.lines) { const remaining = x.qty - number(x.received); if (remaining > 0) inventoryItem(s, x.sku).onHand += remaining; x.received = x.qty; }
      p.status = 'RECEIVED';
      s.logistics.receipts.filter(r => r.po === p.po).forEach(r => { r.status = 'CLOSED'; r.lines.forEach(x => { x.received = x.expected; }); });
      s.logistics.putaway.filter(t => s.logistics.receipts.some(r => r.id === t.receiptId && r.po === p.po)).forEach(t => t.status = 'COMPLETE');
    });
  }
  function scanReceipt(id, quantities) {
    transaction('RECEIPT_SCANNED', id, s => {
      const r = s.logistics.receipts.find(x => x.id === id); if (!r || r.status !== 'ARRIVED' || !r.lines.length) throw new Error('An arrived ASN with PO lines is required.');
      r.lines.forEach((l, idx) => { const q = quantities?.[idx] || { received: l.expected - number(l.damaged), damaged: number(l.damaged) }; if (!Number.isInteger(q.received) || !Number.isInteger(q.damaged) || q.received < 0 || q.damaged < 0 || q.received + q.damaged > l.expected) throw new Error('Scanned quantities must be whole numbers within the expected receipt.'); Object.assign(l, q); });
      r.status = 'RECEIVED';
    });
  }
  function completePutaway(id) {
    transaction('PUTAWAY_COMPLETED', id, s => {
      const l = s.logistics, t = l.putaway.find(x => x.id === id); if (!t || t.status === 'COMPLETE') return;
      const r = l.receipts.find(x => x.id === t.receiptId); const p = s.enterprise.purchaseOrders.find(x => x.po === r?.po);
      if (!r) throw new Error('Receiving document was not found.');
      const target = l.bins.find(x => x.id === t.toBin && x.active); if (!target || target.used + t.qty > target.capacity) throw new Error('The destination bin does not have enough capacity. Choose another bin.');
      const item = inventoryItem(s, t.sku); const line = p?.lines.find(x => x.sku === t.sku);
      const q = line ? Math.min(t.qty, line.qty - number(line.received)) : t.qty;
      if (q > 0) {
        item.onHand += q;
        let targetStock=l.inventory.find(x=>x.sku===t.sku&&x.binId===t.toBin);
        if(!targetStock){targetStock={sku:t.sku,brand:item.brand,description:item.title,binId:t.toBin,region:item.region,onHand:0,reserved:0,damaged:0};l.inventory.push(targetStock);}
        targetStock.onHand+=q;
        if (line) line.received = number(line.received) + q;
      }
      t.status = 'COMPLETE';
      if (l.putaway.filter(x => x.receiptId === r.id).every(x => x.status === 'COMPLETE')) {
        r.status = 'CLOSED';
        for(const receivedLine of r.lines){
          const damage=number(receivedLine.damaged)-number(receivedLine.damagePosted);
          if(damage>0){
            const damagedItem=inventoryItem(s,receivedLine.sku);const poLine=p?.lines.find(x=>x.sku===receivedLine.sku);const posted=poLine?Math.min(damage,poLine.qty-number(poLine.received)):damage;
            damagedItem.onHand+=posted;damagedItem.damaged+=posted;receivedLine.damagePosted=number(receivedLine.damagePosted)+posted;if(poLine)poLine.received=number(poLine.received)+posted;
            let damagedRow=l.inventory.find(x=>x.sku===receivedLine.sku&&x.binId==='DMG-01');if(!damagedRow){damagedRow={sku:receivedLine.sku,brand:damagedItem.brand,description:damagedItem.title,region:damagedItem.region,binId:'DMG-01',onHand:0,reserved:0,damaged:0};l.inventory.push(damagedRow);}damagedRow.onHand+=posted;damagedRow.damaged+=posted;
          }
        }
      }
      if (p && p.lines.every(x => number(x.received) >= x.qty)) p.status = 'RECEIVED';
      else if(p)p.status='PARTIALLY_RECEIVED';
      l.movements.unshift({ id: uid('mv'), time: stamp(), type: 'PUTAWAY', sku: t.sku, qty: q, from: t.fromBin, to: t.toBin, ref: r.po, user: 'Warehouse user' });
    });
  }
  function transferStock(sku, from, to, qty) {
    transaction('STOCK_TRANSFERRED', `${sku}: ${from} to ${to}`, s => {
      const l = s.logistics, source = l.inventory.find(x => x.sku === sku && x.binId === from), targetBin = l.bins.find(x => x.id === to && x.active);
      if (!source || !targetBin || from === to || !Number.isInteger(qty) || qty <= 0 || qty > source.onHand - source.reserved - source.damaged) throw new Error('Transfer a positive whole quantity of unreserved, undamaged stock to a different active bin.');
      if (targetBin.used + qty > targetBin.capacity) throw new Error('Destination bin capacity would be exceeded.');
      let destination = l.inventory.find(x => x.sku === sku && x.binId === to);
      if (!destination) { destination = { ...source, binId: to, onHand: 0, reserved: 0, damaged: 0 }; l.inventory.push(destination); }
      source.onHand -= qty; destination.onHand += qty;
      l.movements.unshift({ id: uid('mv'), time: stamp(), type: 'TRANSFER', sku, qty, from, to, ref: 'Internal transfer', user: 'Warehouse user' });
    });
  }
  function startWave(id) { transaction('WAVE_STARTED', id, s => { const w = s.logistics.waves.find(x => x.id === id); if (!w || w.status !== 'READY') throw new Error('Select a ready wave.'); w.status = 'PICKING'; w.picker = 'Warehouse User'; }); }
  function finishWave(id) {
    transaction('WAVE_PICKED', id, s => {
      const w = s.logistics.waves.find(x => x.id === id); if (!w || w.status !== 'PICKING') throw new Error('Start the wave before completing it.');
      const orders = s.enterprise.orders.filter(o => w.orderIds?.includes(o.id)); orders.forEach(requireValidated); if (!orders.length) throw new Error('Link the wave to a valid allocated customer order.');
      w.status = 'COMPLETE'; w.picked = w.qty;
      for (const o of orders) {
        const line = o.lines.find(x => x.sku === w.sku); if (!line || final(o.status)) continue;
        if (!s.logistics.packing.some(x => x.orderId === o.id && x.sku === line.sku)) {
          const a = s.enterprise.accounts.find(x => x.id === o.accountId), parent = s.enterprise.accounts.find(x => x.id === a.parentId) || a;
          s.logistics.packing.push({ id: uid('PK'), orderId: o.id, order: o.po, sku: line.sku, qty: line.qty, agency: a.name, program: s.enterprise.programs.find(x => x.id === o.programId)?.name || '', carton: `CTN-${o.po}`, carrier: 'UPS', service: 'Ground', status: 'PACKED', tracking: '', whiteLabel: true, packSlipBrand: parent.name });
        }
        o.status = 'PACKED';
      }
    });
  }
  function shipPacking(id, tracking) {
    transaction('ORDER_DISPATCHED', id, s => {
      const p = s.logistics.packing.find(x => x.id === id); if (!p || p.status === 'SHIPPED') return;
      const o = s.enterprise.orders.find(x => x.id === p.orderId || x.po === p.order);
      if (!o || final(o.status) || o.type === 'HOLD_PO' || o.fulfillment?.kind === '3PL') throw new Error('Link this packing job to an open warehouse order.');
      requireValidated(o);
      if (o.fulfillment?.kind === 'DROPSHIP') throw new Error('Use supplier dispatch for a dropship order.');
      const line = o.lines.find(x => x.sku === p.sku); if (!line || p.qty > line.qty - number(line.shipped)) throw new Error('Packing quantity exceeds the unshipped order balance.');
      const i = inventoryItem(s, p.sku); if (i.onHand - i.damaged < p.qty) throw new Error('Insufficient undamaged stock for dispatch.');
      if (!tracking?.trim()) throw new Error('Enter the carrier tracking number before dispatch.');
      i.onHand -= p.qty; line.shipped = number(line.shipped) + p.qty; p.status = 'SHIPPED'; p.tracking = tracking.trim(); p.shippedAt = stamp();
      o.status = o.lines.every(x => number(x.shipped) >= x.qty) ? 'SHIPPED' : 'PACKED'; o.updatedAt = stamp(); o.tracking = p.tracking;
      s.logistics.movements.unshift({ id: uid('mv'), time: stamp(), type: 'SHIP', sku: p.sku, qty: -p.qty, from: 'PACK', to: p.carrier, ref: o.po, user: 'Pack station' });
    });
  }
  function routeOrder(ref, nodeId, sku, qty, destination, service, cost) {
    transaction('ORDER_ROUTED', `${ref} to ${nodeId}`, s => {
      const o = s.enterprise.orders.find(x => x.id === ref || x.po === ref);
      if (!o || final(o.status) || o.type === 'HOLD_PO' || !['ALLOCATED','PICKING'].includes(o.status)) throw new Error('Use an open allocated customer order reference.');
      requireValidated(o);
      if (o.fulfillment || s.logistics.packing.some(x => x.orderId === o.id)) throw new Error('This order already has an execution route.');
      if (o.lines.length !== 1 || o.lines[0].sku !== sku || o.lines[0].qty !== qty) throw new Error('Route the exact SKU and whole quantity from the selected order.');
      if (s.logistics.warehouses.some(x => x.id === nodeId)) { o.fulfillment = { kind: 'LOCAL', nodeId }; return; }
      const node = s.logistics.tplNodes.find(x => x.id === nodeId && x.status === 'ACTIVE'); const stock = s.logistics.tplInventory.find(x => x.nodeId === nodeId && x.sku === sku);
      if (!node || !stock?.variation || stock.qty - stock.reserved < qty) throw new Error('The 3PL node lacks eligible available inventory.');
      const id = uid('TPL'); stock.reserved += qty; o.fulfillment = { kind: '3PL', nodeId, shipmentId: id }; o.status = 'PICKING';
      s.logistics.waves.filter(w => w.orderIds?.includes(o.id)).forEach(w => w.status = 'COMPLETE');
      s.logistics.tplShipments.push({ id, orderId: o.po, customerOrderId: o.id, nodeId, sku, qty, state: destination, service, status: 'REQUESTED', createdAt: stamp(), acceptedAt: null, dispatchedAt: null, tracking: '', cost });
    });
  }
  function advanceShipment(id, tracking) {
    transaction('3PL_STATUS_UPDATED', id, s => {
      const sh = s.logistics.tplShipments.find(x => x.id === id);
      if (!sh || sh.status === 'DELIVERED') return;
      if (sh.status === 'CANCELLED') throw new Error('This shipment was cancelled.');
      const o = s.enterprise.orders.find(x => x.id === sh.customerOrderId);
      if (o) { requireValidated(o); if (o.status === 'CANCELLED') throw new Error('This customer order was cancelled.'); }
      const seq = ['REQUESTED','ACCEPTED','PICKING','DISPATCHED','DELIVERED'];
      const next = seq[Math.max(0, seq.indexOf(sh.status === 'DELAYED' ? 'ACCEPTED' : sh.status)) + 1];
      if (!next) throw new Error('This shipment has an unsupported status.');
      if (next === 'DISPATCHED') {
        if (!tracking?.trim()) throw new Error('Enter the partner tracking number to dispatch.');
        const i = s.logistics.tplInventory.find(x => x.nodeId === sh.nodeId && x.sku === sh.sku);
        if (!i || i.qty < sh.qty) throw new Error('Partner inventory is insufficient.');
        if (o) {
          const line = o.lines.find(x => x.sku === sh.sku);
          if (!line || sh.qty > line.qty - number(line.shipped)) throw new Error('Partner shipment exceeds the remaining customer order.');
          line.shipped = number(line.shipped) + sh.qty;
        }
        i.qty -= sh.qty; i.reserved = Math.max(0, i.reserved - sh.qty);
        sh.dispatchedAt = stamp(); sh.tracking = tracking.trim();
      }
      sh.status = next; if (next === 'ACCEPTED') sh.acceptedAt = stamp();
      if (o) {
        const complete = o.lines.every(x => number(x.shipped) >= x.qty);
        const linked = s.logistics.tplShipments.filter(x => x.customerOrderId === o.id && x.status !== 'CANCELLED');
        o.status = complete && linked.every(x => x.status === 'DELIVERED') ? 'DELIVERED' : complete ? 'SHIPPED' : 'PICKING';
        if (sh.tracking) o.tracking = sh.tracking;
        o.updatedAt = stamp();
        const request = (s.logistics.tplRequests || []).find(x => x.id === sh.requestId);
        if (request) { request.status = o.status === 'DELIVERED' ? 'DELIVERED' : complete ? 'DISPATCHED' : linked.some(x => x.status === 'DISPATCHED') ? 'PARTIALLY_DISPATCHED' : next; request.updatedAt = stamp(); }
      }
    });
  }
  function regionalItems(rows) {
    return rows.map(r => {
      const by = Object.fromEntries(Object.keys(r).map(k => [k.toLowerCase().replace(/[^a-z0-9]/g,''), r[k]]));
      const get = (...names) => names.map(n => by[n]).find(v => v !== undefined && v !== '');
      const model = String(r.model || get('model','modelnumber','sku','model') || r['Model#'] || '').trim();
      const onHand = Math.max(0, number(r.stockQty ?? get('stockqty','onhand','stockquantity')));
      return { model, brand: String(r.brand || get('brand') || '').trim(), title: String(r.product || get('itemtitle','description','itemname') || model), status: String(r.status || get('status') || ''), onHand, available: Math.max(0, number(r.available ?? get('stockavailable','available','ats') ?? onHand)), avgMonthly: Math.max(0, number(r.avg3 ?? get('avgpermpast3m','avgmonthly','avgmonthly sales'))), openSupplier: number(r.openSupplier ?? get('totalopensupplierqty','opensupplierqty')), recommended: Math.max(0, number(r.recommended)), cost: Math.max(0, number(r.cost ?? get('unitcost','cost'))), price: Math.max(0, number(r.standardPrice ?? get('netprice','price'))) };
    }).filter(i => i.model);
  }
  function recordRegional(region, dataset, analyzed) {
    const code=regionCode(region), items=regionalItems(analyzed || dataset.rows || []), fileName=dataset.fileName||'Inventory report';
    const prior=state.regional[code];if(prior?.fileName===fileName&&JSON.stringify(prior.items)===JSON.stringify(items))return;
    transaction('REPORT_CONNECTED', `${code}: ${fileName}`, s => { s.regional[code] = { fileName, updatedAt: stamp(), items }; });
  }
  const REGIONAL_DBS = [['US','stark-regional-inventory','US'], ['EU','stark-regional-inventory-eu','EU'], ['CA','stark-regional-inventory-ca','Canada']];
  function getDataset(name, key) {
    return new Promise(resolve => {
      const req = indexedDB.open(name, 1);
      req.onerror = () => resolve(null);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('datasets'))req.result.createObjectStore('datasets');};
      req.onsuccess = () => { const db = req.result; if (!db.objectStoreNames.contains('datasets')) { db.close(); resolve(null); return; } const r = db.transaction('datasets','readonly').objectStore('datasets').get(key); r.onsuccess = () => { resolve(r.result || null); db.close(); }; r.onerror = () => { resolve(null); db.close(); }; };
    });
  }
  async function collectRegional() {
    const data = await Promise.all(REGIONAL_DBS.map(async ([region, db, key]) => ({ region, dataset: await getDataset(db, key) })));
    for (const entry of data) if (entry.dataset) {const analyst=window.StarkRegionalAnalysts?.[entry.region==='CA'?'Canada':entry.region];recordRegional(entry.region,entry.dataset,analyst?.analyze(entry.dataset.rows,entry.region==='CA'?'Canada':entry.region));}
    return data;
  }
  function importRegional(region) {
    const code = regionCode(region);
    return transaction('REGIONAL_INVENTORY_IMPORTED', code, s => {
      const report = s.regional[code]; if (!report?.items.length) throw new Error('Upload a regional Raw Report first.');
      for (const x of report.items) {
        const sku = `${code}::${x.model}`; const existing = s.enterprise.inventory.find(i => i.sku === sku);
        if (existing) { existing.title = x.title; existing.brand = x.brand; existing.avgMonthly = x.avgMonthly; existing.status = x.status; continue; }
        s.enterprise.inventory.push({ sku, model: x.model, brand: x.brand, title: x.title, nature: 'PHYSICAL', region: code, onHand: x.onHand, reserved: Math.max(0,x.onHand - x.available), externalReserved: Math.max(0,x.onHand - x.available), damaged: 0, safety: 3, cost: x.cost, standardPrice: x.price, avgMonthly: x.avgMonthly, source: report.fileName, status: x.status });
      }
    });
  }
  function fulfillDigitalOrder(id){transaction('DIGITAL_ORDER_DISPATCHED',id,s=>{const o=s.enterprise.orders.find(x=>x.id===id);if(!o||final(o.status)||awaitingValidation(o)||o.type==='HOLD_PO'||o.lines.some(x=>inventoryItem(s,x.sku).nature!=='DIGITAL'))throw new Error('Choose an open digital customer order.');for(const line of o.lines){const tokens=s.enterprise.vaultTokens.filter(t=>t.sku===line.sku&&t.state==='AVAILABLE');if(tokens.length<line.qty)throw new Error('The masked demonstration vault does not contain enough token records. Replenish its demo capacity first.');tokens.slice(0,line.qty).forEach(t=>{t.state='DISPATCHED';t.orderId=o.id;t.dispatchedAt=stamp();});inventoryItem(s,line.sku).onHand-=line.qty;line.shipped=line.qty;}o.status='SHIPPED';o.updatedAt=stamp();o.digitalDispatch={mode:'MASKED_DEMO',time:stamp()};});}
  function setEvents(region,events){const code=regionCode(region);if(!Array.isArray(events))throw new Error('Invalid event records.');if(JSON.stringify(state.events?.[code]||[])===JSON.stringify(events))return;transaction('EVENTS_UPDATED',`${code}: ${events.length} event POs saved.`,s=>{s.events||={};s.events[code]=clone(events);});}
  function clearRegional(region){transaction('REPORT_DISCONNECTED',regionCode(region),s=>{delete s.regional[regionCode(region)];});}
  function adoptSharedState(document){validateState(document);transaction('CLOUD_STATE_LOADED','The shared organization workspace was loaded.',s=>{const revision=s.revision;Object.assign(s,clone(document));s.revision=revision;});}
  function draftRegionalPO(region, model, vendorId, cost, qty) {
    return transaction('VENDOR_PO_CREATED', `${model}: ${qty} units`, s => {
      const item = inventoryItem(s, `${regionCode(region)}::${model}`); const v = s.enterprise.vendors.find(x => x.id === vendorId);
      if (!v || v.status !== 'ACTIVE' || !Number.isInteger(qty) || qty <= 0 || !Number.isFinite(cost) || cost <= 0) throw new Error('Choose an active vendor, whole quantity and positive cost.');
      if (s.enterprise.purchaseOrders.some(p => p.status !== 'RECEIVED' && p.status !== 'CANCELLED' && p.lines.some(l => l.sku === item.sku))) throw new Error('This SKU already has an open purchase order.');
      const po = { id: uid('vpo'), vendorId, po: `PO-${Date.now()}`, status: 'PO_ISSUED', issuedAt: stamp(), eta: new Date(Date.now() + number(v.leadTime) * 864e5).toISOString(), warehouse: v.warehouses?.[0]?.name || '', carrier: 'TBD', tracking: '', region: item.region, lines: [{ sku: item.sku, qty, received: 0, cost }] };
      s.enterprise.purchaseOrders.push(po); return po.id;
    });
  }
  function createPurchaseOrder(input) {
    return transaction('VENDOR_PO_CREATED', input.po, s=>{
      const e=s.enterprise,v=e.vendors.find(x=>x.id===input.vendorId&&x.status==='ACTIVE');
      if(!v||!input.po?.trim()||e.purchaseOrders.some(x=>x.po.toLowerCase()===input.po.trim().toLowerCase()))throw new Error('Choose an active vendor and a unique vendor PO reference.');
      if(!['INVENTORY','EVENT','DROPSHIP'].includes(input.purpose))throw new Error('Choose Inventory, Event, or Dropship procurement.');
      if(!Array.isArray(input.lines)||!input.lines.length||input.lines.some(x=>!e.inventory.some(i=>i.sku===x.sku)||!Number.isInteger(x.qty)||x.qty<=0||!Number.isFinite(x.cost)||x.cost<=0))throw new Error('Choose a catalog SKU, positive whole quantity and positive unit cost.');
      if(!input.eta||!Number.isFinite(new Date(input.eta).getTime()))throw new Error('Choose a supplier delivery date.');
      if(input.purpose==='DROPSHIP'){
        const o=e.orders.find(x=>x.id===input.customerOrderId&&!final(x.status)&&x.fulfillment?.kind==='DROPSHIP');
        if(!o||o.lines.length!==input.lines.length||input.lines.some(x=>!o.lines.some(y=>y.sku===x.sku&&y.qty===x.qty)))throw new Error('Dropship PO must match an open supplier-fulfilled customer order.');
        if(e.purchaseOrders.some(x=>x.customerOrderId===o.id&&x.status!=='CANCELLED'))throw new Error('This customer order already has a vendor PO.');
      }
      const p={...clone(input),id:uid('vpo'),status:'PO_ISSUED',issuedAt:stamp(),carrier:input.carrier||'TBD',tracking:'',lines:input.lines.map(x=>({...x,received:0}))};e.purchaseOrders.push(p);return p.id;
    });
  }
  function shipDropshipPO(id,tracking){transaction('DROPSHIP_DISPATCHED',id,s=>{const p=s.enterprise.purchaseOrders.find(x=>x.id===id&&x.purpose==='DROPSHIP');if(!p||p.status==='CANCELLED'||p.status==='DISPATCHED')throw new Error('Select an open dropship PO.');if(!tracking?.trim())throw new Error('Supplier tracking is required.');const o=s.enterprise.orders.find(x=>x.id===p.customerOrderId);if(!o||final(o.status))throw new Error('Linked customer order is closed.');p.status='DISPATCHED';p.tracking=tracking.trim();p.dispatchedAt=stamp();o.status='SHIPPED';o.tracking=p.tracking;o.updatedAt=stamp();o.lines.forEach(x=>x.shipped=x.qty);});}
  async function exportBackup() {
    const regionalDatasets = await collectRegional(); const extras = {};
    for (let i=0; i<localStorage.length; i++) { const key = localStorage.key(i); if (/^(stark-active-brands-|stark-inventory-settings-|stark.*events)/.test(key)) extras[key] = localStorage.getItem(key); }
    return { format: 'stark-unified-backup', exportedAt: stamp(), state: clone(state), regionalDatasets, extras };
  }
  function importBackup(backup) {
    if (backup.format !== 'stark-unified-backup') throw new Error('Choose a Supply Chain Intelligence backup.');
    validateState(backup.state);
    transaction('BACKUP_RESTORED', `Backup from ${backup.exportedAt}`, s => { const revision = s.revision; Object.assign(s, clone(backup.state)); s.revision = revision; });
    for (const [key, value] of Object.entries(backup.extras || {})) if (/^(stark-active-brands-|stark-inventory-settings-|stark.*events)/.test(key) && typeof value === 'string') localStorage.setItem(key,value);
    return restoreRegional(backup.regionalDatasets || []);
  }
  async function restoreRegional(entries) {
    for (const [code, name, key] of REGIONAL_DBS) {
      const dataset = entries.find(x => x.region === code)?.dataset; if (!dataset?.rows || !Array.isArray(dataset.rows)) continue;
      await new Promise((resolve, reject) => { const req = indexedDB.open(name, 1); req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('datasets')) req.result.createObjectStore('datasets'); }; req.onerror = () => reject(req.error); req.onsuccess = () => { const db = req.result, tx = db.transaction('datasets','readwrite'); tx.objectStore('datasets').put(dataset,key); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }; });
    }
  }
  function clearWorkspace() {
    transaction('WORKSPACE_EMPTIED','A new empty operations workspace was created.',s => { Object.values(s.enterprise).forEach(v => { if (Array.isArray(v)) v.length = 0; }); for (const k of ['inventory','receipts','putaway','waves','packing','cycleCounts','movements','tplNodes','tplInventory','tplShipments','tplRequests','reconciliations','activity']) s.logistics[k] = []; s.mode = 'working'; });
  }
  function issues() {
    const e = state.enterprise, l = state.logistics, rows = [];
    for (const i of e.inventory) if (i.reserved + i.damaged > i.onHand) rows.push({ level:'critical', title:`${i.sku}: commitments exceed usable stock`, detail:`${i.reserved} reserved / ${i.onHand-i.damaged} usable`, path:'warehouse-management/inventory-bins.html' });
    for (const o of e.orders) if (!final(o.status) && o.validation?.state === 'ISSUES') rows.push({level:'warning',title:`${o.po}: order validation issues`,detail:[...new Set((o.validation.issues || []).map(i => i.label))].join(', '),path:'order-management/issues.html?search='+encodeURIComponent(o.po)});
    for (const p of e.purchaseOrders) if (!['RECEIVED','CANCELLED'].includes(p.status) && new Date(p.eta).getTime() < Date.now()) rows.push({ level:'warning', title:`${p.po}: inbound is overdue`, detail:'Review the supplier ETA.', path:'vendor-management/procurement.html' });
    for (const r of l.reconciliations) if (r.status !== 'RESOLVED') rows.push({ level:'warning', title:`${r.sku}: 3PL stock variance`, detail:`${r.variance} units at ${l.tplNodes.find(x=>x.id===r.nodeId)?.name || r.nodeId}`, path:'3pl-management/reconciliation.html' });
    for (const o of e.orders) if (o.type === 'HOLD_PO' && !final(o.status) && new Date(o.holdUntil).getTime() < Date.now()) rows.push({level:'warning',title:`${o.po}: hold expired`,detail:'Release the remaining allocation.',path:'order-management/hold-redemption.html'});
    return rows;
  }
  window.StarkSystem = { KEY, rootURL, url:path=>new URL(path,rootURL).href, getState:()=>{refresh(); return clone(state);}, getModule:moduleData, saveModule, transaction, available, validateOrder:o=>checkOrder(state,o), createOrder, expireHolds, cancelOrder, receivePO, scanReceipt, completePutaway, transferStock, startWave, finishWave, shipPacking, routeOrder, advanceShipment, fulfillDigitalOrder, recordRegional, clearRegional, collectRegional, importRegional, draftRegionalPO, createPurchaseOrder, shipDropshipPO, exportBackup, importBackup, clearWorkspace, issues, uid, regionCode, setEvents, adoptSharedState, getRegion:()=>regionCode(localStorage.getItem('stark-selected-region')||'US') };
  expireHolds();
})();
