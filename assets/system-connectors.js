(function(){
  'use strict';
  const S=window.StarkSystem;if(!S)return;
  const esc=v=>window.StarkSystemUI.escape(v);
  const notify=(m,error=false)=>window.StarkSystemUI.notice(m,error);
  const refresh=()=>{window.StarkEnterprise?.refresh();window.StarkLogistics?.refresh();};
  function action(fn,message){try{fn();refresh();notify(message);}catch(error){notify(error.message,true);}}
  function modal(title,body,save,label='Save'){
    if(window.StarkSystemPages)return window.StarkSystemPages.modal(title,body,save,label);
    const w=window.StarkSystemUI.dialog(title,body,save,label,{system:true});w.querySelector('[data-save]').setAttribute('data-confirm','');return w;
  }
  const tracking=(title,submit)=>modal(title,'<label>Carrier tracking number<input id="system-tracking" placeholder="Enter the actual shipment tracking number" autocomplete="off"></label>',w=>{submit(w.querySelector('input').value);refresh();notify('Dispatch recorded.');},'Confirm dispatch');
  function capture(event){
    const b=event.target.closest('button');if(!b)return;
    const page=document.body.dataset.page||'';
    const e=S.getModule('enterprise'),l=S.getModule('logistics');
    let handler;
    if(b.matches('[data-receive]')&&page==='vendor-procurement')handler=()=>modal('Receive vendor PO','<p>This posts the remaining PO quantity once and closes its linked receiving tasks. For scans, damaged stock and putaway, use Receiving & Putaway.</p>',()=>{S.receivePO(b.dataset.receive);refresh();notify('PO received and warehouse stock updated.');},'Post receipt');
    else if(b.matches('[data-receive]')&&page==='wms-receiving')handler=()=>{
      const r=l.receipts.find(x=>x.id===b.dataset.receive);if(!r)return;
      modal('Scan receipt · '+r.po,`<p>Record the actual good and damaged quantities. Stock becomes available after putaway.</p><div class="sys-form">${r.lines.map((x,i)=>`<label>Good units · ${esc(x.sku)}<input type="number" min="0" max="${x.expected}" data-good="${i}" value="${x.expected-(x.damaged||0)}"></label><label>Damaged units<input type="number" min="0" max="${x.expected}" data-damaged="${i}" value="${x.damaged||0}"></label>`).join('')}</div>`,w=>{S.scanReceipt(r.id,r.lines.map((x,i)=>({received:Number(w.querySelector(`[data-good="${i}"]`).value),damaged:Number(w.querySelector(`[data-damaged="${i}"]`).value)})));refresh();notify('Receiving scan recorded.');},'Post scan');
    };
    else if(b.matches('[data-complete-put]'))handler=()=>action(()=>S.completePutaway(b.dataset.completePut),'Putaway completed; vendor and warehouse balances synchronized.');
    else if(b.matches('[data-start-wave]'))handler=()=>action(()=>S.startWave(b.dataset.startWave),'Wave started.');
    else if(b.matches('[data-finish-wave]'))handler=()=>action(()=>S.finishWave(b.dataset.finishWave),'Picking completed and packing work created.');
    else if(b.matches('[data-ship]'))handler=()=>tracking('Warehouse dispatch',t=>S.shipPacking(b.dataset.ship,t));
    else if(b.matches('[data-advance]'))handler=()=>{const sh=l.tplShipments.find(x=>x.id===b.dataset.advance);if(sh?.status==='PICKING')tracking('3PL dispatch',t=>S.advanceShipment(sh.id,t));else action(()=>S.advanceShipment(b.dataset.advance),'Partner shipment advanced.');};
    else if(b.matches('[data-route]'))handler=()=>{const route=window.StarkLogistics.routes().find(x=>x.id===b.dataset.route);if(!route)return;action(()=>S.routeOrder(document.querySelector('#rt-order').value,route.id,document.querySelector('#rt-sku').value,Number(document.querySelector('#rt-qty').value),document.querySelector('#rt-state').value,document.querySelector('#rt-service').value,route.cost),'Customer order linked to its fulfillment route.');};
    else if(b.matches('[data-move]'))handler=()=>{
      const sku=b.dataset.move,from=b.closest('tr').cells[2].textContent.trim(),i=l.inventory.find(x=>x.sku===sku&&x.binId===from);if(!i)return;
      modal('Transfer warehouse stock',`<p>${esc(sku)} · ${esc(from)} · ${S.available(i)} available units</p><div class="sys-form"><label>Destination bin<select id="transfer-bin">${l.bins.filter(x=>x.active&&x.id!==from&&!['RECEIVING','DAMAGED'].includes(x.zone)).map(x=>`<option value="${esc(x.id)}">${esc(x.id)} · ${x.capacity-x.used} free</option>`).join('')}</select></label><label>Quantity<input id="transfer-qty" type="number" min="1" value="1"></label></div>`,w=>{S.transferStock(sku,from,w.querySelector('select').value,Number(w.querySelector('input').value));refresh();notify('Location balances and movement ledger updated.');});
    };
    else if(b.id==='expire-holds')handler=()=>action(()=>S.expireHolds(),'Expired holds checked; remaining allocation and credit released.');
    else if(b.id==='reset-demo')handler=()=>location.href=S.url('data-center.html');
    else if(b.id==='generate-wave')handler=()=>modal('Linked picking work','<p>Picking waves are created automatically from allocated physical customer orders. Open Order Entry to create a customer order, or use the ready waves in this console.</p>',()=>true,'Close');
    else if(b.id==='new-pack')handler=()=>modal('Linked packing work','<p>Complete a customer order’s picking wave to create its packing job. Packing quantity, customer and program come from the shared order record.</p>',()=>true,'Close');
    else if(b.id==='new-receipt')handler=()=>location.href=S.url('vendor-po-management.html');
    else if(b.id==='draft-po')handler=()=>location.href=S.url('vendor-po-management.html');
    else if(b.id==='assign-token')handler=()=>{
      const orders=e.orders.filter(o=>o.type!=='HOLD_PO'&&!['SHIPPED','DELIVERED','CANCELLED','EXPIRED'].includes(o.status)&&o.lines.every(x=>e.inventory.find(i=>i.sku===x.sku)?.nature==='DIGITAL'));
      modal('Dispatch masked digital order',`<p>This demonstration assigns masked token references to the customer order. Production voucher delivery requires the server-side vendor integration.</p><label>Digital customer order<select>${orders.map(o=>`<option value="${esc(o.id)}">${esc(o.po)} · ${o.lines.reduce((n,x)=>n+x.qty,0)} tokens</option>`).join('')}</select></label>`,w=>{S.fulfillDigitalOrder(w.querySelector('select').value);refresh();notify('Masked demo references assigned to the customer order.');},'Dispatch demo references');
    };
    else if(b.id==='verify-scan')handler=()=>action(()=>S.transaction('PICK_SCANNED','Warehouse SKU and bin verified.',s=>{const id=document.querySelector('#scan-wave').value,w=s.logistics.waves.find(x=>x.id===id),qty=Number(document.querySelector('#scan-qty').value);if(!w||w.status!=='PICKING'||!Number.isInteger(qty)||qty<=0||qty>w.qty-(w.picked||0)||document.querySelector('#scan-sku').value.trim().toUpperCase()!==w.sku.toUpperCase()||document.querySelector('#scan-bin').value.trim().toUpperCase()!==w.binId.toUpperCase())throw new Error('Confirm the exact wave SKU and bin, and a whole quantity within the remaining pick balance.');w.picked=(w.picked||0)+qty;}),'Pick scan recorded.');
    if(handler){event.preventDefault();event.stopImmediatePropagation();handler();}
  }
  document.addEventListener('click',capture,true);
  function start(){
    const eventParams=new URLSearchParams(location.search),eventId=eventParams.get('event');
    if(eventId&&document.querySelector('#o-po')){
      const s=S.getState(),event=Object.values(s.events||{}).flat().find(x=>x.id===eventId);
      if(event){
        const field=(id,value)=>{const node=document.querySelector('#'+id);if(node)node.value=value;};
        field('o-po',event.poNumber);field('o-purpose','EVENT');field('o-inhands',event.inHandsDate);
        const account=s.enterprise.accounts.find(x=>x.name.toLowerCase()===String(event.customer).toLowerCase());
        if(account)field('o-account',account.id);else{const select=document.querySelector('#o-account');select.insertAdjacentHTML('afterbegin','<option value="">Choose the event customer account</option>');select.value='';}
        if(event.items?.[0]){const item=s.enterprise.inventory.find(i=>i.model===event.items[0].model&&i.region===S.regionCode(eventParams.get('region')));if(item)field('o-sku',item.sku);field('o-qty',event.items[0].quantity);}
        document.querySelector('#o-sku')?.onchange?.();
        for(const line of (event.items||[]).slice(1)){document.querySelector('#system-add-line')?.click();const row=[...document.querySelectorAll('.system-extra-line')].at(-1);if(!row)continue;const item=s.enterprise.inventory.find(i=>i.model===line.model&&i.region===S.regionCode(eventParams.get('region')));if(item)row.querySelector('[data-extra-sku]').value=item.sku;row.querySelector('[data-extra-qty]').value=line.quantity;row.querySelector('[data-extra-sku]').onchange?.();}
      }
    }
    if(document.body.dataset.page==='events'){const region=new URLSearchParams(location.search).get('region')||'US';try{const events=JSON.parse(localStorage.getItem('stark_events_v6_'+region)||'null');if(Array.isArray(events)&&!S.getState().events?.[S.regionCode(region)])S.setEvents(region,events);}catch(_){}}
    const order=document.querySelector('#rt-order');
    if(order){const populate=()=>{const o=S.getModule('enterprise').orders.find(x=>x.po===order.value||x.id===order.value);if(o?.lines[0]){document.querySelector('#rt-sku').value=o.lines[0].sku;document.querySelector('#rt-qty').value=o.lines[0].qty;}};order.addEventListener('change',populate);populate();}
    const dataPage=document.body.dataset.page;
    if(dataPage==='order-dashboard'){
      const box=document.createElement('section');box.className='card';box.style.marginTop='18px';const query=new URLSearchParams(location.search).get('search')||'';
      box.innerHTML=`<div class="card-header"><div><h2>Order execution & cancellations</h2><p>Warehouse, partner and supplier execution stay linked to customer orders.</p></div></div><div class="sys-table-wrap"><table class="sys-table"><thead><tr><th>Customer PO</th><th>Purpose / source</th><th>In-hands</th><th>Tracking</th><th>Execution</th></tr></thead><tbody>${S.getModule('enterprise').orders.filter(o=>!query||o.po.toLowerCase().includes(query.toLowerCase())).map(o=>`<tr><td>${esc(o.po)}</td><td>${esc(o.purpose||'REGULAR')} · ${esc(o.fulfillment?.kind||'WAREHOUSE')}</td><td>${o.inHandsDate?esc(o.inHandsDate):'—'}</td><td>${esc(o.tracking||'—')}</td><td><a class="sys-btn" href="${S.url(o.fulfillment?.kind==='DROPSHIP'?'vendor-po-management.html':o.fulfillment?.kind==='3PL'?'3pl-management/shipments.html':'warehouse-management/wave-picking.html')}">Open execution</a>${!['SHIPPED','DELIVERED','CANCELLED','EXPIRED'].includes(o.status)?` <button class="sys-btn danger" data-cancel-order="${esc(o.id)}">Cancel</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
      document.querySelector('#page-content').append(box);box.querySelectorAll('[data-cancel-order]').forEach(b=>b.onclick=()=>modal('Cancel customer order','<p>Release the unfulfilled allocation and update the linked customer credit or parent hold.</p>',()=>{S.cancelOrder(b.dataset.cancelOrder);location.reload();},'Cancel order'));
    }
    if(window.StarkInventory){const SI=window.StarkInventory;SI.loadDataset(SI.getRegion()).then(dataset=>{if(dataset)S.recordRegional(SI.getRegion(),dataset,SI.analyze(dataset.rows,SI.getRegion()));}).catch(()=>{});}
  }
  document.addEventListener('DOMContentLoaded',start);
  window.addEventListener('stark:cloud-status',()=>{const node=document.querySelector('#system-data-status');if(node&&window.StarkSystemCloud.getStatus().active)node.textContent=window.StarkSystemCloud.getStatus().status;});
  try{const channel=new BroadcastChannel('stark-analytics-sync-v1');channel.onmessage=async event=>{const SI=window.StarkInventory;if(SI&&S.regionCode(SI.getRegion())===event.data.region){const dataset=await SI.loadDataset(SI.getRegion());if(dataset)S.recordRegional(SI.getRegion(),dataset,SI.analyze(dataset.rows,SI.getRegion()));}};}catch(_){}
})();
