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
  const kindOf = kind => ['VENDOR','CUSTOMER','CYCLE'].includes(kind) ? kind : fail('MODE', 'Choose customer picking, vendor receiving or cycle count.');
  const codeKinds = {CO:'CUSTOMER',VPO:'VENDOR',CC:'CYCLE'};
  const records = (state, kind) => kind === 'CYCLE' ? state.logistics.cycleCounts : kind === 'VENDOR' ? state.enterprise.purchaseOrders : state.enterprise.orders;
  const recordLines = record => record.lines || [{sku:record.sku,qty:record.systemQty}];
  function barcode(kind, record) { return 'SCI-' + ({VENDOR:'VPO:',CUSTOMER:'CO:',CYCLE:'CC:'}[kindOf(kind)]) + record.id; }
  function recordFor(state, kind, id) {
    const found = records(state, kindOf(kind)).filter(record => record.id === id);
    if (found.length !== 1) fail(found.length ? 'AMBIGUOUS_PO' : 'NOT_FOUND', found.length ? 'More than one document uses this identifier. Reconcile the duplicate records before scanning.' : 'This document was not found in the current workspace.');
    return found[0];
  }
  function resolve(value, kind, state = S.getState()) {
    kindOf(kind);
    const code = text(value);
    if (!code || code.length > 300) fail('NOT_FOUND', 'Scan a PO barcode or enter its exact reference.');
    const match = /^SCI-(CO|VPO|CC):(.+)$/i.exec(code);
    if (match) {
      if (codeKinds[match[1].toUpperCase()] !== kind) fail('WRONG_PO_TYPE', 'This is a ' + ({VPO:'vendor PO. Switch to vendor receiving.',CO:'customer order. Switch to customer picking.',CC:'cycle count. Switch to cycle count scanning.'}[match[1].toUpperCase()]));
      return recordFor(state, kind, match[2]);
    }
    // Exact references only. A scanned URL is never opened or executed.
    const found = records(state, kind).filter(record => [record.id, record.po, record.orderNumber, record.reference, record.countNumber].some(value => norm(value) === norm(code)));
    if (found.length !== 1) fail(found.length ? 'AMBIGUOUS_PO' : 'NOT_FOUND', found.length ? 'More than one order uses this reference. Scan its generated barcode or choose the exact order.' : 'PO not found in this workspace. Check the exact reference or choose an existing PO.');
    return found[0];
  }
  function resolveDocument(value, preferredKind, state = S.getState()) {
    kindOf(preferredKind);
    const match = /^SCI-(CO|VPO|CC):(.+)$/i.exec(text(value));
    if (match) {
      const kind = codeKinds[match[1].toUpperCase()];
      return {kind, record:resolve(value,kind,state)};
    }
    // A human reference may belong to either workflow. Honor the selected
    // workflow when it matches; only a missing reference permits switching.
    // Ambiguous references must never select an arbitrary record or PO type.
    try { return {kind:preferredKind, record:resolve(value,preferredKind,state)}; }
    catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    const found=[];
    for(const kind of ['CUSTOMER','VENDOR','CYCLE'].filter(kind=>kind!==preferredKind)){
      try{found.push({kind,record:resolve(value,kind,state)});}catch(error){if(error.code!=='NOT_FOUND')throw error;}
    }
    if(found.length>1)fail('AMBIGUOUS_PO','More than one document uses this reference. Choose the correct workflow or scan its generated barcode.');
    if(!found.length)fail('NOT_FOUND','PO or cycle count not found in this workspace. Check the exact reference or choose an existing document.');
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
    const lines = recordLines(record).filter(line => line.sku === sku);
    if (!item || !lines.length) fail('STALE_LINE', 'The selected item is no longer on this PO. Reload the order.');
    const code = codeValue(value);
    if (!code || code.length > 250 || /^SCI-(CO|VPO|CC):/i.test(code) || !identifiers(item, lines).some(candidate => equalCode(candidate, code))) fail('WRONG_ITEM', 'Wrong item');
    const conflicts = state.enterprise.inventory.filter(other => other.sku !== sku && S.regionCode(other.region) === S.regionCode(item.region) && identifiers(other).some(candidate => equalCode(candidate, code)));
    const lineConflict = groups(record).some(group=>group.sku!==sku && identifiers(state.enterprise.inventory.find(other=>other.sku===group.sku),group.lines).some(candidate=>equalCode(candidate,code)));
    if (conflicts.length || lineConflict) fail('AMBIGUOUS_ITEM', 'This barcode is assigned to more than one item. Correct the item barcode records before scanning.');
    return item;
  }
  function groups(record) {
    const map = new Map();
    for (const line of recordLines(record)) { const entry = map.get(line.sku) || {sku:line.sku, qty:0, lines:[]}; entry.qty += number(line.qty); entry.lines.push(line); map.set(line.sku, entry); }
    return [...map.values()];
  }
  function receiptProgress(state, receipt, sku) {
    const lines = receipt.lines.filter(line => line.sku === sku);
    const received = lines.reduce((sum,line)=>sum+number(line.received),0);
    const posted = state.logistics.putaway.filter(task=>task.receiptId===receipt.id && task.sku===sku && task.status==='COMPLETE').reduce((sum,task)=>sum+number(task.qty),0);
    // Older barcode batches used scanVerified without per-line counters.
    // A manual/pre-filled receipt has no barcode verification until it is scanned.
    const scanned = lines.reduce((sum,line)=>sum+(line.scanReceived===undefined ? receipt.scanVerified ? number(line.received) : 0 : number(line.scanReceived)),0);
    const pending = Math.max(0,received-posted), verified = Math.max(0,Math.min(received,scanned)-posted);
    const damaged = lines.reduce((sum,line)=>sum+Math.max(0,number(line.damaged)-number(line.damagePosted)),0);
    return {pending,verified,unverified:Math.max(0,pending-verified),damaged};
  }
  function pendingReceipt(state, record, sku) {
    return state.logistics.receipts.filter(receipt=>receipt.po===record.po && !['CLOSED','CANCELLED'].includes(receipt.status)).reduce((sum,receipt)=>{
      const progress=receiptProgress(state,receipt,sku);
      for(const key of Object.keys(sum))sum[key]+=progress[key];
      return sum;
    },{pending:0,verified:0,unverified:0,damaged:0});
  }
  function openScanReceipts(state, record) {
    return state.logistics.receipts.filter(receipt=>receipt.po===record.po && receipt.scanVerified && !receipt.scanCompletedAt && !['CLOSED','CANCELLED'].includes(receipt.status) && receipt.lines.some(line=>receiptProgress(state,receipt,line.sku).pending>0));
  }
  function picked(state, record, group) {
    const counters = group.lines.reduce((sum, line) => sum + Math.max(number(line.scanPicked), number(line.shipped)), 0);
    const waves = state.logistics.waves.filter(wave => wave.sku === group.sku && wave.orderIds?.includes(record.id));
    const waveCount = waves.reduce((sum, wave) => sum + (wave.orderIds.length === 1 ? number(wave.picked) : number(wave.pickedByOrder?.[record.id])), 0);
    const packed = state.logistics.packing.filter(job => job.orderId === record.id && job.sku === group.sku && !['CANCELLED'].includes(job.status)).reduce((sum, job) => sum + number(job.qty), 0);
    return Math.min(group.qty, Math.max(counters, waveCount, packed));
  }
  function eligibility(state, kind, record) {
    if (kind === 'CYCLE') {
      if(['COMPLETE','CANCELLED'].includes(record.status) || record.scanVerification?.completedAt)return 'This cycle count is already recorded. Schedule a new count for a recount.';
      const item=state.enterprise.inventory.find(item=>item.sku===record.sku);
      if(!item || item.nature==='DIGITAL')return 'Cycle count scanning requires a physical inventory item.';
      if(!state.logistics.bins.some(bin=>bin.id===record.binId && bin.active))return 'This cycle count needs an active warehouse bin.';
      return '';
    }
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
    if(kind==='CYCLE'){
      const item=state.enterprise.inventory.find(item=>item.sku===record.sku),verified=cycleTotal(record);
      return {kind,id,po:record.reference || record.countNumber || record.id,status:record.status,barcode:barcode(kind,record),revision:state.revision,reason,canScan:!reason,events:record.scanVerification?.events || [],complete:!!record.scanVerification?.completedAt,party:'Bin '+record.binId,binId:record.binId,countedQty:record.countedQty,variance:verified-number(record.systemQty),items:[{sku:record.sku,model:item?.model || record.sku,title:item?.title || '',qty:number(record.systemQty),verified,received:0,pending:0,unverified:0,remaining:null,codes:identifiers(item),physical:true}]};
    }
    const items = groups(record).map(group => {
      const item = state.enterprise.inventory.find(item => item.sku === group.sku);
      const received = group.lines.reduce((sum, line) => sum + number(line.received), 0);
      const progress = kind === 'VENDOR' ? pendingReceipt(state, record, group.sku) : {pending:0,verified:0,unverified:0,damaged:0};
      const pending = progress.pending + progress.damaged;
      const verified = kind === 'CUSTOMER' ? picked(state, record, group) : received + progress.verified + progress.damaged;
      return {sku:group.sku, model:item?.model || group.lines[0].model || group.sku, title:item?.title || group.lines[0].title || '', qty:group.qty,
        verified, received, pending, barcodeVerified:progress.verified, unverified:progress.unverified, remaining:Math.max(0, group.qty - verified), codes:identifiers(item, group.lines), physical:item?.nature !== 'DIGITAL'};
    });
    const receipts=kind==='VENDOR'?openScanReceipts(state,record):[];
    const unverifiedReceiptUnits=receipts.reduce((sum,receipt)=>sum+[...new Set(receipt.lines.map(line=>line.sku))].reduce((total,sku)=>total+receiptProgress(state,receipt,sku).unverified,0),0);
    return {kind, id, po:record.po, orderNumber:record.orderNumber || '', status:record.status, barcode:barcode(kind,record), revision:state.revision, reason,
      canScan:!reason, items, events:record.scanVerification?.events || [], complete:items.length > 0 && items.every(item => item.remaining === 0),
      canFinishReceiving:receipts.length>0 && unverifiedReceiptUnits===0,
      receivingWarning:unverifiedReceiptUnits?'Verify the '+unverifiedReceiptUnits+' units already entered on this receipt before finishing delivery.':'',
      party:kind === 'VENDOR' ? state.enterprise.vendors.find(vendor => vendor.id === record.vendorId)?.name || '' : state.enterprise.accounts.find(account => account.id === record.accountId)?.name || ''};
  }
  function quantity(value) { const qty = Number(value); if (!Number.isSafeInteger(qty) || qty < 1 || qty > 1000000) fail('QUANTITY', 'Use a positive whole scan quantity.'); return qty; }
  function actor() { const access = window.StarkSystemCloud?.getAccess?.() || {}; return {id:access.userId || '',name:access.displayName || access.userId || 'Local workspace'}; }
  function requestId(value) { const id = text(value); if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) fail('REQUEST_ID', 'Start a new scan and try again.'); return id; }
  function seen(record, id) { return record.scanVerification?.events?.find(event => event.id === id); }
  function recordEvent(record, input) {
    record.scanVerification ||= {version:1, startedAt:now(), events:[]};
    const who = actor(), event = {id:input.requestId, sku:input.sku, quantity:input.quantity, action:input.kind === 'CYCLE' ? 'COUNT' : input.kind === 'VENDOR' ? 'RECEIVE' : 'PICK', at:now(), actorId:who.id, actor:who.name};
    if(input.kind==='CYCLE')event.binId=record.binId;
    record.scanVerification.events.push(event); record.updatedAt = event.at;
    return event;
  }
  function receiveLine(state, record, group, qty) {
    const receipts = state.logistics.receipts.filter(receipt => receipt.po === record.po && !receipt.scanCompletedAt && !['CLOSED','CANCELLED'].includes(receipt.status));
    // Verify quantities that were entered manually before adding new receipt units.
    let receipt = receipts.find(receipt=>receiptProgress(state,receipt,group.sku).unverified>0) || receipts.find(receipt=>['SCHEDULED','ARRIVED','RECEIVED'].includes(receipt.status) && receipt.lines.some(line=>line.sku===group.sku && number(line.expected)>number(line.received)+number(line.damaged)));
    if (!receipt) fail('PUTAWAY_PENDING', 'Complete the pending receiving / putaway batch before scanning another delivery for this PO.');
    const inPutaway=receipt.status==='PUTAWAY',wasScanned=!!receipt.scanVerified,postedBySKU=new Map();
    for(const task of state.logistics.putaway.filter(task=>task.receiptId===receipt.id && task.status==='COMPLETE'))postedBySKU.set(task.sku,(postedBySKU.get(task.sku)||0)+number(task.qty));
    for(const line of receipt.lines){const posted=Math.min(number(line.received),postedBySKU.get(line.sku)||0);postedBySKU.set(line.sku,(postedBySKU.get(line.sku)||0)-posted);if(line.scanReceived===undefined)line.scanReceived=wasScanned?number(line.received):posted;}
    const targets = receipt.lines.filter(line => line.sku === group.sku);
    if (!targets.length) fail('RECEIPT_LINE', 'This item is not in the open receiving document. Reconcile the ASN before scanning.');
    const capacity = targets.reduce((sum, line) => sum + Math.max(0,number(line.received)-number(line.scanReceived)) + (inPutaway?0:Math.max(0, number(line.expected) - number(line.received) - number(line.damaged))), 0);
    if (qty > capacity) fail('OVER_QUANTITY', 'This scan exceeds the remaining ASN quantity.');
    let remaining = qty;
    for (const line of targets) { const amount=Math.min(remaining,Math.max(0,number(line.received)-number(line.scanReceived)));line.scanReceived+=amount;remaining-=amount; }
    for (const line of targets) { const amount = Math.min(remaining, Math.max(0, number(line.expected) - number(line.received) - number(line.damaged))); line.received = number(line.received) + amount;line.scanReceived+=amount; remaining -= amount; }
    receipt.status = inPutaway?'PUTAWAY':'ARRIVED'; receipt.scanVerified = true; receipt.scanVerificationRequired=true; receipt.lastScannedAt = now();
    return receipt.id;
  }
  function scan(input) {
    const kind = kindOf(input.kind), id = input.id, rid = requestId(input.requestId), qty = quantity(input.quantity ?? 1);
    const existing = seen(recordFor(S.getState(),kind,id),rid);
    if (existing) { if (existing.sku !== input.sku || existing.quantity !== qty) fail('REPLAY', 'This scan request was already used for a different item or quantity.'); return {duplicate:true,event:existing,view:view(kind,id)}; }
    let event;
    S.transaction(kind === 'CYCLE' ? 'CYCLE_COUNT_ITEM_SCAN' : kind === 'VENDOR' ? 'VENDOR_ITEM_SCAN' : 'CUSTOMER_ITEM_SCAN', id + ' · ' + input.sku, state => {
      const record = recordFor(state,kind,id), replay = seen(record,rid);
      if (replay) { if (replay.sku !== input.sku || replay.quantity !== qty) fail('REPLAY', 'This scan request was already used.'); event = replay; return; }
      if (input.revision !== undefined && input.revision !== state.revision) fail('STALE', 'The workspace changed. Refresh the order and scan again.');
      const reason = eligibility(state,kind,record); if (reason) fail('INELIGIBLE',reason);
      assertItem(state,record,input.sku,input.value);
      const current = view(kind,id,state).items.find(item => item.sku === input.sku);
      if (!current || kind!=='CYCLE' && qty > current.remaining) fail('OVER_QUANTITY', current?.remaining ? 'This scan exceeds the remaining order quantity.' : 'All required units of this item have already been scanned.');
      if(kind==='CYCLE' && !Number.isSafeInteger(current.verified+qty))fail('QUANTITY','The physical count exceeds the supported whole-unit range.');
      const group = groups(record).find(group => group.sku === input.sku);
      if (kind === 'VENDOR') receiveLine(state,record,group,qty);
      else if(kind==='CUSTOMER') {
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
  function cycleTotal(record) { return (record.scanVerification?.events || []).filter(event=>event.action==='COUNT').reduce((sum,event)=>sum+number(event.quantity),0); }
  function finishCycleCount(id, options = {}) {
    const before=recordFor(S.getState(),'CYCLE',id);
    if(before.scanVerification?.completedAt)return {duplicate:true,view:view('CYCLE',id)};
    S.transaction('CYCLE_COUNT_RECORDED',id,state=>{
      if(options.revision!==undefined && options.revision!==state.revision)fail('STALE','The workspace changed. Refresh before saving this cycle count.');
      const record=recordFor(state,'CYCLE',id),reason=eligibility(state,'CYCLE',record);if(reason)fail('INELIGIBLE',reason);
      const qty=cycleTotal(record);
      if(!qty && options.confirmEmpty!==true)fail('EMPTY_COUNT','Scan the physical items, or explicitly confirm that this bin has zero units of the selected item.');
      record.scanVerification ||= {version:1,startedAt:now(),events:[]};
      record.scanVerification.completedAt=now();record.scanVerification.completedBy=actor().name;record.scanVerification.emptyConfirmed=qty===0;
      record.countedQty=qty;record.countedAt=now();record.status=qty===number(record.systemQty)?'COMPLETE':'VARIANCE';
    });
    return {duplicate:false,view:view('CYCLE',id)};
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
      const receipts=openScanReceipts(state,record);
      if (!receipts.length) fail('NO_SCANS','Scan received items before finishing this delivery.');
      const capacity = new Map();
      const reusedTaskIds = new Set();
      const receivedGroups = receipt => [...new Set(receipt.lines.map(line=>line.sku))].map(sku=>({sku,...receiptProgress(state,receipt,sku)})).filter(line=>line.pending>0);
      for(const receipt of receipts) for(const line of receivedGroups(receipt)) {
        if(line.unverified)fail('INCOMPLETE_RECEIPT','Verify every unit already entered on this receipt before finishing delivery.');
        const existing=state.logistics.putaway.filter(task=>task.receiptId===receipt.id && task.sku===line.sku && task.status!=='COMPLETE');
        if(existing.reduce((sum,task)=>sum+number(task.qty),0)>line.pending)fail('PUTAWAY_QUANTITY','The existing putaway quantity exceeds the pending receipt. Reconcile this task before finishing delivery.');
        existing.forEach(task=>reusedTaskIds.add(task.id));
        const bin=state.logistics.bins.find(bin=>bin.id===bins?.[line.sku] && bin.active && !['RECEIVING','DAMAGED'].includes(bin.zone));
        if(!bin)fail('BIN','Choose an active putaway bin for each received item.');
        capacity.set(bin.id,(capacity.get(bin.id)||0)+line.pending);
      }
      for(const [binId,qty] of capacity){const bin=state.logistics.bins.find(bin=>bin.id===binId);const queued=state.logistics.putaway.filter(task=>task.toBin===binId&&task.status!=='COMPLETE'&&!reusedTaskIds.has(task.id)).reduce((sum,task)=>sum+number(task.qty),0);if(number(bin.used)+queued+qty>number(bin.capacity))fail('BIN_CAPACITY','The selected bin does not have enough uncommitted capacity. Choose another bin.');}
      for(const receipt of receipts) {
        if(!receipt.lines.some(line=>number(line.received)>0))fail('NO_SCANS','Scan received items before finishing this delivery.');
        for(const line of receivedGroups(receipt)) {
          const existing=state.logistics.putaway.filter(task=>task.receiptId===receipt.id && task.sku===line.sku && task.status!=='COMPLETE');
          for(const task of existing){task.toBin=bins[line.sku];task.scanVerified=true;}
          const extra=line.pending-existing.reduce((sum,task)=>sum+number(task.qty),0);
          if(extra>0)state.logistics.putaway.push({id:S.uid('put'),receiptId:receipt.id,sku:line.sku,qty:extra,fromBin:'RCV-01',toBin:bins[line.sku],status:'OPEN',assignee:actor().name,priority:'NORMAL',scanVerified:true});
        }
        receipt.status='PUTAWAY';receipt.scanCompletedAt=now();receipt.scanCompletedBy=actor().name;
      }
      return {receiptIds:receipts.map(receipt=>receipt.id)};
    });
  }
  function saveCodes(sku, values, expectedRevision) {
    const codes=[...new Set(values.map(text).filter(Boolean))];
    if(codes.length>30 || codes.some(code=>code.length>150 || /[\x00-\x1f\x7f]/.test(code) || /^SCI-(CO|VPO|CC):/i.test(code)))fail('BARCODE','Use up to 30 item barcodes, without document barcodes or control characters.');
    return S.transaction('ITEM_BARCODES_UPDATED',sku,state=>{
      if(expectedRevision!==undefined && state.revision!==expectedRevision)fail('STALE','The workspace changed. Reopen item barcodes and try again.');
      const item=state.enterprise.inventory.find(item=>item.sku===sku);if(!item)fail('NOT_FOUND','Item not found.');
      for(const code of codes)if(state.enterprise.inventory.some(other=>other.sku!==sku && S.regionCode(other.region)===S.regionCode(item.region) && identifiers(other).some(alias=>equalCode(alias,code))))fail('AMBIGUOUS_ITEM','A barcode is already assigned to another item in this region.');
      item.barcodes=codes;item.barcodeUpdatedAt=now();
    });
  }
  window.StarkScanning={ScanError,barcode,resolve,resolveDocument,view,scan,finishPicking,finishReceiving,finishCycleCount,identifiers,equalCode,gtin,saveCodes};
})();
