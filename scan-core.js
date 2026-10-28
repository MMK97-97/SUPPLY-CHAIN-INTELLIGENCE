(function () {
  'use strict';
  const S = window.StarkSystem;
  if (!S || window.StarkScanning) return;
  const text = value => String(value ?? '').normalize('NFKC').trim();
  const norm = value => text(value).toUpperCase();
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const now = () => new Date().toISOString();
  const closed = record => ['SHIPPED','DELIVERED','CANCELLED','EXPIRED'].includes(record.status);
  class ScanError extends Error { constructor(code, message) { super(message); this.name = 'ScanError'; this.code = code; } }
  const fail = (code, message) => { throw new ScanError(code, message); };
  const kindOf = kind => kind === 'VENDOR' ? 'VENDOR' : kind === 'CUSTOMER' ? 'CUSTOMER' : fail('MODE', 'Choose customer picking or vendor receiving.');
  const records = (state, kind) => kind === 'VENDOR' ? state.enterprise.purchaseOrders : state.enterprise.orders;
  function barcode(kind, record) { return 'SCI-' + (kindOf(kind) === 'VENDOR' ? 'VPO:' : 'CO:') + record.id; }
  function recordFor(state, kind, id) {
    const record = records(state, kindOf(kind)).find(record => record.id === id);
    if (!record) fail('NOT_FOUND', 'This PO was not found in the current workspace.');
    return record;
  }
  function resolve(value, kind, state = S.getState()) {
    kindOf(kind);
    const code = text(value);
    if (!code || code.length > 300) fail('NOT_FOUND', 'Scan a PO barcode or enter its exact reference.');
    const match = /^SCI-(CO|VPO):(.+)$/i.exec(code);
    if (match) {
      if ((match[1].toUpperCase() === 'VPO' ? 'VENDOR' : 'CUSTOMER') !== kind) fail('WRONG_PO_TYPE', 'This is a ' + (match[1].toUpperCase() === 'VPO' ? 'vendor PO. Switch to vendor receiving.' : 'customer order. Switch to customer picking.'));
      return recordFor(state, kind, match[2]);
    }
    // Exact references only. A scanned URL is never opened or executed.
    const found = records(state, kind).filter(record => [record.id, record.po, record.orderNumber].some(value => norm(value) === norm(code)));
    if (found.length !== 1) fail(found.length ? 'AMBIGUOUS_PO' : 'NOT_FOUND', found.length ? 'More than one order uses this reference. Scan its generated barcode or choose the exact order.' : 'PO not found in this workspace. Check the reference and scanning mode.');
    return found[0];
  }
  function gtin(value) {
    const code = text(value);
    if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return '';
    let sum = 0, weight = 3;
    for (let i = code.length - 2; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(code[i]) * weight;
    return (10 - sum % 10) % 10 === Number(code.at(-1)) ? code.padStart(14, '0') : '';
  }
  function codeValue(value) {
    const code = text(value);
    const gs1 = /^(?:\]C1|\]d2)?01(\d{14})(?:[^\d]|$)/.exec(code) || /^\(01\)(\d{14})/.exec(code);
    return gs1 && gtin(gs1[1]) ? gs1[1] : code;
  }
  function equalCode(a, b) { return norm(a) === norm(b) || !!(gtin(a) && gtin(a) === gtin(b)); }
  function identifiers(item, lines = []) {
    const values = [item, ...lines].filter(Boolean).flatMap(record => [record.sku, record.model, record.upc, record.ean, record.gtin, record.barcode, ...(Array.isArray(record.barcodes) ? record.barcodes : [])]);
    return [...new Set(values.filter(value => typeof value === 'string').map(text).filter(Boolean))];
  }
  function assertItem(state, record, sku, value) {
    const item = state.enterprise.inventory.find(item => item.sku === sku);
    const lines = record.lines.filter(line => line.sku === sku);
    if (!item || !lines.length) fail('STALE_LINE', 'The selected item is no longer on this PO. Reload the order.');
    const code = codeValue(value);
    if (!code || code.length > 250 || /^SCI-(CO|VPO):/i.test(code) || !identifiers(item, lines).some(candidate => equalCode(candidate, code))) fail('WRONG_ITEM', 'Wrong item');
    const conflicts = state.enterprise.inventory.filter(other => other.sku !== sku && S.regionCode(other.region) === S.regionCode(item.region) && identifiers(other).some(candidate => equalCode(candidate, code)));
    const lineConflict = groups(record).some(group=>group.sku!==sku && identifiers(state.enterprise.inventory.find(other=>other.sku===group.sku),group.lines).some(candidate=>equalCode(candidate,code)));
    if (conflicts.length || lineConflict) fail('AMBIGUOUS_ITEM', 'This barcode is assigned to more than one item. Correct the item barcode records before scanning.');
    return item;
  }
  function groups(record) {
    const map = new Map();
    for (const line of record.lines) { const entry = map.get(line.sku) || {sku:line.sku, qty:0, lines:[]}; entry.qty += number(line.qty); entry.lines.push(line); map.set(line.sku, entry); }
    return [...map.values()];
  }
  function pendingReceipt(state, record, sku) {
    return state.logistics.receipts.filter(receipt => receipt.po === record.po && !['CLOSED','CANCELLED'].includes(receipt.status)).reduce((sum, receipt) => {
      const scanned = receipt.lines.filter(line => line.sku === sku).reduce((sum, line) => sum + number(line.received) + number(line.damaged) - number(line.damagePosted), 0);
      const posted = state.logistics.putaway.filter(task => task.receiptId === receipt.id && task.sku === sku && task.status === 'COMPLETE').reduce((sum, task) => sum + number(task.qty), 0);
      return sum + Math.max(0, scanned - posted);
    }, 0);
  }
  function picked(state, record, group) {
    const counters = group.lines.reduce((sum, line) => sum + Math.max(number(line.scanPicked), number(line.shipped)), 0);
    const waves = state.logistics.waves.filter(wave => wave.sku === group.sku && wave.orderIds?.includes(record.id));
    const waveCount = waves.reduce((sum, wave) => sum + (wave.orderIds.length === 1 ? number(wave.picked) : number(wave.pickedByOrder?.[record.id])), 0);
    const packed = state.logistics.packing.filter(job => job.orderId === record.id && job.sku === group.sku && !['CANCELLED'].includes(job.status)).reduce((sum, job) => sum + number(job.qty), 0);
    return Math.min(group.qty, Math.max(counters, waveCount, packed));
  }
  function eligibility(state, kind, record) {
    if (kind === 'VENDOR') {
      if (record.purpose === 'DROPSHIP') return 'Supplier dropship POs use supplier dispatch, not warehouse receiving.';
      if (['CANCELLED','RECEIVED'].includes(record.status)) return 'This vendor PO is closed for receiving.';
    } else {
      if (closed(record)) return 'This customer order is closed for picking.';
      if (record.type === 'HOLD_PO') return 'A hold reserves inventory. Scan the linked release or redemption order for picking.';
      if (record.validation && record.validation.state !== 'VALIDATED') return 'Validate this customer order before picking.';
      if (['3PL','DROPSHIP'].includes(record.fulfillment?.kind)) return 'This order is fulfilled outside the warehouse. Use its partner or supplier workflow.';
    }
    if (record.lines.some(line => state.enterprise.inventory.find(item => item.sku === line.sku)?.nature === 'DIGITAL')) return 'Orders containing digital rewards use digital fulfillment rather than physical item scanning.';
    return '';
  }
  function view(kind, id, state = S.getState()) {
    const record = recordFor(state, kind, id), reason = eligibility(state, kind, record);
    const items = groups(record).map(group => {
      const item = state.enterprise.inventory.find(item => item.sku === group.sku);
      const received = group.lines.reduce((sum, line) => sum + number(line.received), 0);
      const pending = kind === 'VENDOR' ? pendingReceipt(state, record, group.sku) : 0;
      const verified = kind === 'CUSTOMER' ? picked(state, record, group) : received + pending;
      return {sku:group.sku, model:item?.model || group.lines[0].model || group.sku, title:item?.title || group.lines[0].title || '', qty:group.qty,
        verified, received, pending, remaining:Math.max(0, group.qty - verified), codes:identifiers(item, group.lines), physical:item?.nature !== 'DIGITAL'};
    });
    return {kind, id, po:record.po, orderNumber:record.orderNumber || '', status:record.status, barcode:barcode(kind,record), revision:state.revision, reason,
      canScan:!reason, items, events:record.scanVerification?.events || [], complete:items.length > 0 && items.every(item => item.remaining === 0),
      party:kind === 'VENDOR' ? state.enterprise.vendors.find(vendor => vendor.id === record.vendorId)?.name || '' : state.enterprise.accounts.find(account => account.id === record.accountId)?.name || ''};
  }
  function quantity(value) { const qty = Number(value); if (!Number.isSafeInteger(qty) || qty < 1 || qty > 1000000) fail('QUANTITY', 'Use a positive whole scan quantity.'); return qty; }
  function actor() { const access = window.StarkSystemCloud?.getAccess?.() || {}; return {id:access.userId || '',name:access.displayName || access.userId || 'Local workspace'}; }
  function requestId(value) { const id = text(value); if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) fail('REQUEST_ID', 'Start a new scan and try again.'); return id; }
  function seen(record, id) { return record.scanVerification?.events?.find(event => event.id === id); }
  function recordEvent(record, input) {
    record.scanVerification ||= {version:1, startedAt:now(), events:[]};
    const who = actor(), event = {id:input.requestId, sku:input.sku, quantity:input.quantity, action:input.kind === 'VENDOR' ? 'RECEIVE' : 'PICK', at:now(), actorId:who.id, actor:who.name};
    record.scanVerification.events.push(event); record.updatedAt = event.at;
    return event;
  }
  function receiveLine(state, record, group, qty) {
    const receipts = state.logistics.receipts.filter(receipt => receipt.po === record.po && !['CLOSED','CANCELLED'].includes(receipt.status));
    let receipt = receipts.find(receipt => ['SCHEDULED','ARRIVED'].includes(receipt.status));
    if (!receipt) fail('PUTAWAY_PENDING', 'Complete the pending receiving / putaway batch before scanning another delivery for this PO.');
    const targets = receipt.lines.filter(line => line.sku === group.sku);
    if (!targets.length) fail('RECEIPT_LINE', 'This item is not in the open receiving document. Reconcile the ASN before scanning.');
    const capacity = targets.reduce((sum, line) => sum + Math.max(0, number(line.expected) - number(line.received) - number(line.damaged)), 0);
    if (qty > capacity) fail('OVER_QUANTITY', 'This scan exceeds the remaining ASN quantity.');
    let remaining = qty;
    for (const line of targets) { const amount = Math.min(remaining, Math.max(0, number(line.expected) - number(line.received) - number(line.damaged))); line.received = number(line.received) + amount; remaining -= amount; }
    receipt.status = 'ARRIVED'; receipt.scanVerified = true; receipt.lastScannedAt = now();
    return receipt.id;
  }
  function scan(input) {
    const kind = kindOf(input.kind), id = input.id, rid = requestId(input.requestId), qty = quantity(input.quantity ?? 1);
    const existing = seen(recordFor(S.getState(),kind,id),rid);
    if (existing) { if (existing.sku !== input.sku || existing.quantity !== qty) fail('REPLAY', 'This scan request was already used for a different item or quantity.'); return {duplicate:true,event:existing,view:view(kind,id)}; }
    let event;
    S.transaction(kind === 'VENDOR' ? 'VENDOR_ITEM_SCAN' : 'CUSTOMER_ITEM_SCAN', id + ' · ' + input.sku, state => {
      const record = recordFor(state,kind,id), replay = seen(record,rid);
      if (replay) { if (replay.sku !== input.sku || replay.quantity !== qty) fail('REPLAY', 'This scan request was already used.'); event = replay; return; }
      if (input.revision !== undefined && input.revision !== state.revision) fail('STALE', 'The workspace changed. Refresh the order and scan again.');
      const reason = eligibility(state,kind,record); if (reason) fail('INELIGIBLE',reason);
      assertItem(state,record,input.sku,input.value);
      const current = view(kind,id,state).items.find(item => item.sku === input.sku);
      if (!current || qty > current.remaining) fail('OVER_QUANTITY', current?.remaining ? 'This scan exceeds the remaining order quantity.' : 'All required units of this item have already been scanned.');
      const group = groups(record).find(group => group.sku === input.sku);
      if (kind === 'VENDOR') receiveLine(state,record,group,qty);
      else {
        const waves = state.logistics.waves.filter(wave => wave.sku === input.sku && wave.orderIds?.includes(id));
        if (waves.some(wave => wave.orderIds.length > 1 && number(wave.picked) > Object.values(wave.pickedByOrder || {}).reduce((sum,value)=>sum+number(value),0))) fail('GROUPED_WAVE','This grouped wave has unassigned prior picks. Reconcile them before scanning individual orders.');
        let total = current.verified + qty;
        for (const line of group.lines) { line.scanPicked = Math.min(line.qty,total); total -= line.scanPicked; }
        for (const wave of waves) {
          wave.pickedByOrder ||= {}; wave.pickedByOrder[id] = current.verified + qty;
          wave.picked = Math.min(wave.qty, wave.orderIds.length === 1 ? current.verified + qty : Object.values(wave.pickedByOrder).reduce((sum,value)=>sum+number(value),0));
          if (wave.status !== 'COMPLETE') wave.status = 'PICKING'; wave.picker = actor().name;
        }
      }
      event = recordEvent(record,{...input,kind,quantity:qty,requestId:rid});
    });
    return {duplicate:false,event,view:view(kind,id)};
  }
  function finishPicking(id, expectedRevision) {
    const before = recordFor(S.getState(),'CUSTOMER',id);
    if (before.scanVerification?.completedAt) return {duplicate:true,view:view('CUSTOMER',id)};
    S.transaction('CUSTOMER_SCAN_PICK_COMPLETE',id,state=>{
      if (expectedRevision !== undefined && state.revision !== expectedRevision) fail('STALE','The workspace changed. Refresh before finishing picking.');
      const record = recordFor(state,'CUSTOMER',id), report = view('CUSTOMER',id,state);
      if (!report.canScan) fail('INELIGIBLE',report.reason);
      if (!report.complete) fail('INCOMPLETE','Scan every remaining item before finishing picking.');
      const customer = state.enterprise.accounts.find(account=>account.id===record.accountId);
      for (const item of report.items) {
        const unshipped = groups(record).find(group=>group.sku===item.sku).lines.reduce((sum,line)=>sum+line.qty-number(line.shipped),0);
        if (unshipped > 0 && !state.logistics.packing.some(job=>job.orderId===id && job.sku===item.sku && job.status!=='CANCELLED')) state.logistics.packing.push({id:S.uid('PK'),orderId:id,order:record.po,sku:item.sku,qty:unshipped,agency:customer?.name || '',program:record.programId || '',carton:'CTN-'+record.po,carrier:record.shipping?.carrier || 'UPS',service:record.shipping?.method || 'Ground',status:'READY',tracking:'',whiteLabel:true,packSlipBrand:customer?.name || '',warehouseId:record.warehouseId || record.shipping?.warehouseId || '',scanVerified:true});
      }
      for (const wave of state.logistics.waves.filter(wave=>wave.orderIds?.includes(id))) {
        if (wave.orderIds.every(orderId=>{const other=state.enterprise.orders.find(order=>order.id===orderId);return other && groups(other).filter(group=>group.sku===wave.sku).every(group=>picked(state,other,group)>=group.qty);})) {wave.status='COMPLETE';wave.picked=wave.qty;}
      }
      record.scanVerification ||= {version:1,startedAt:now(),events:[]}; record.scanVerification.completedAt=now(); record.scanVerification.completedBy=actor().name;
      record.status='PACKING'; record.updatedAt=now();
    });
    return {duplicate:false,view:view('CUSTOMER',id)};
  }
  function finishReceiving(id, bins, expectedRevision) {
    return S.transaction('VENDOR_SCAN_RECEIPT_COMPLETE',id,state=>{
      if (expectedRevision !== undefined && state.revision !== expectedRevision) fail('STALE','The workspace changed. Refresh before finishing receiving.');
      const record=recordFor(state,'VENDOR',id),reason=eligibility(state,'VENDOR',record); if(reason)fail('INELIGIBLE',reason);
      const receipts=state.logistics.receipts.filter(receipt=>receipt.po===record.po && receipt.scanVerified && receipt.status==='ARRIVED');
      if (!receipts.length) fail('NO_SCANS','Scan received items before finishing this delivery.');
      const capacity = new Map();
      const receivedGroups = receipt => [...new Set(receipt.lines.map(line=>line.sku))].map(sku=>({sku,received:receipt.lines.filter(line=>line.sku===sku).reduce((sum,line)=>sum+number(line.received),0)})).filter(line=>line.received>0);
      for(const receipt of receipts) for(const line of receivedGroups(receipt)) {
        const bin=state.logistics.bins.find(bin=>bin.id===bins?.[line.sku] && bin.active && !['RECEIVING','DAMAGED'].includes(bin.zone));
        if(!bin)fail('BIN','Choose an active putaway bin for each received item.');
        capacity.set(bin.id,(capacity.get(bin.id)||0)+number(line.received));
      }
      for(const [binId,qty] of capacity){const bin=state.logistics.bins.find(bin=>bin.id===binId);const queued=state.logistics.putaway.filter(task=>task.toBin===binId&&task.status!=='COMPLETE').reduce((sum,task)=>sum+number(task.qty),0);if(number(bin.used)+queued+qty>number(bin.capacity))fail('BIN_CAPACITY','The selected bin does not have enough uncommitted capacity. Choose another bin.');}
      for(const receipt of receipts) {
        if(!receipt.lines.some(line=>number(line.received)>0))fail('NO_SCANS','Scan received items before finishing this delivery.');
        for(const line of receivedGroups(receipt)) {
          if(state.logistics.putaway.some(task=>task.receiptId===receipt.id && task.sku===line.sku))fail('PUTAWAY_EXISTS','Putaway already exists for this receiving line. Refresh the receiving page.');
          state.logistics.putaway.push({id:S.uid('put'),receiptId:receipt.id,sku:line.sku,qty:line.received,fromBin:'RCV-01',toBin:bins[line.sku],status:'OPEN',assignee:actor().name,priority:'NORMAL',scanVerified:true});
        }
        receipt.status='PUTAWAY';receipt.scanCompletedAt=now();receipt.scanCompletedBy=actor().name;
      }
      return {receiptIds:receipts.map(receipt=>receipt.id)};
    });
  }
  function saveCodes(sku, values, expectedRevision) {
    const codes=[...new Set(values.map(text).filter(Boolean))];
    if(codes.length>30 || codes.some(code=>code.length>150 || /[\x00-\x1f\x7f]/.test(code) || /^SCI-(CO|VPO):/i.test(code)))fail('BARCODE','Use up to 30 item barcodes, without PO barcodes or control characters.');
    return S.transaction('ITEM_BARCODES_UPDATED',sku,state=>{
      if(expectedRevision!==undefined && state.revision!==expectedRevision)fail('STALE','The workspace changed. Reopen item barcodes and try again.');
      const item=state.enterprise.inventory.find(item=>item.sku===sku);if(!item)fail('NOT_FOUND','Item not found.');
      for(const code of codes)if(state.enterprise.inventory.some(other=>other.sku!==sku && S.regionCode(other.region)===S.regionCode(item.region) && identifiers(other).some(alias=>equalCode(alias,code))))fail('AMBIGUOUS_ITEM','A barcode is already assigned to another item in this region.');
      item.barcodes=codes;item.barcodeUpdatedAt=now();
    });
  }
  window.StarkScanning={ScanError,barcode,resolve,view,scan,finishPicking,finishReceiving,identifiers,equalCode,gtin,saveCodes};
})();
