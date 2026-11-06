(function(){
  'use strict';
  const B=window.MK97Business,C=window.MK97Operations,S=window.StarkSystem,root=document.querySelector('#purchase-planning');
  if(!B||!C||!S||!root)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const params=new URLSearchParams(location.search),sku=params.get('sku')||'';
  let snapshotRevision;
  const options=(values,selected)=>values.map(([id,label])=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(label)}</option>`).join('');
  const path=()=>S.url('workspace.html?view=operations&section=supply&region='+S.getRegion()+'&sku='+encodeURIComponent(sku));
  function render(){
    const state=S.getState(),region=S.getRegion(),model=C.snapshot(state,{region,horizon:params.get('horizon')});
    const row=model.availability.find(i=>i.sku===sku),item=state.enterprise.inventory.find(i=>i.sku===sku);
    const vendors=state.enterprise.vendors.filter(v=>v.status==='ACTIVE').map(v=>[v.id,v.name]);
    const warehouses=(state.logistics.warehouses||[]).filter(w=>w.active!==false&&(!w.region||B.region(w.region)===region)).map(w=>w.name||w.id);
    const currency={US:'USD',CA:'CAD',EU:'EUR'}[region];
    snapshotRevision=state.revision;
    root.innerHTML=`<header class="bs-head"><div><p class="bs-kicker">PROCUREMENT · ${esc(region)}</p><h1>Prepare replenishment PO</h1><p>Review the latest stock calculation before creating a vendor PO.</p></div><a href="${esc(path())}">Back to stock coverage →</a></header>
    <p id="pp-feedback" class="bs-status" role="status" hidden></p>
    <section class="bs-card">
      ${!row?'<h2>SKU unavailable</h2><p>Open a stock coverage record in the current region to prepare a PO.</p>':`
      <h2>${esc(row.model)} · ${esc(row.sku)}</h2>
      <p>${row.suggestedBuy} units suggested · ${row.safety} safety stock · ${row.confirmed} confirmed inbound through ${esc(model.through)} · ${row.planningDemand} dated unvalidated units included.</p>
      ${row.excluded||row.staged?`<p>Review existing supply before ordering: ${row.excluded} inbound units were excluded and ${row.staged} units are awaiting putaway. <a href="${esc(path())}">See the source POs and balances</a>.</p>`:''}
      ${!row.suggestedBuy?'<p>Current coverage no longer suggests a purchase for this SKU.</p>':!vendors.length?`<p>Add an active supplier in <a href="${esc(S.url('vendor-management/vendors.html'))}">Vendor management</a> first.</p>`:`
      <form id="pp-form"><div class="bs-grid">
        <label>PO reference<input name="po" maxlength="100" value="${esc('PO-'+S.uid('plan').slice(-8).toUpperCase())}" required></label>
        <label>Supplier<select name="vendorId" required>${options([['','Choose active supplier'],...vendors],'')}</select></label>
        <label>Receiving location<input name="warehouse" list="pp-locations" maxlength="150" required><datalist id="pp-locations">${warehouses.map(w=>`<option value="${esc(w)}"></option>`).join('')}</datalist></label>
        <label>Expected arrival<input type="date" name="eta" min="${esc(model.today)}" required></label>
        <label>Quantity<input type="number" name="qty" min="1" max="1000000" step="1" value="${Math.min(1000000,row.suggestedBuy)}" required></label>
        <label>Unit cost<input type="number" name="cost" min="0.0001" step="0.0001" value="${item.cost>0?esc(item.cost):''}" required></label>
        <label>Currency<input name="currency" maxlength="3" pattern="[A-Za-z]{3}" value="${currency}" required></label>
        <label>Vendor item number<input name="vendorItem" maxlength="100" required></label>
        <label>Notes<input name="notes" maxlength="500"></label>
      </div><p>Creating this PO records it in procurement and schedules receiving. Send it to your supplier through your usual channel.</p>
      <div class="bs-inline"><button type="submit">Create vendor PO</button><button type="button" class="bs-secondary" id="pp-reload">Recalculate coverage</button></div></form>`}
      `}</section>`;
  }
  function say(message){
    const p=root.querySelector('#pp-feedback');p.textContent=message;p.hidden=false;p.classList.add('bs-error');
  }
  root.addEventListener('click',e=>{
    if(e.target.id==='pp-reload'&&window.confirm('Recalculate coverage and clear the current PO form?'))render();
  });
  root.addEventListener('submit',e=>{
    if(e.target.id!=='pp-form')return;
    e.preventDefault();
    try{
      const d=new FormData(e.target),read=k=>String(d.get(k)||'').trim();
      const state=S.getState(),region=S.getRegion();
      const cloud=window.StarkSystemCloud;
      if((cloud?.getStatus?.().active||cloud?.getAccess?.().userId)&&!['owner','admin','manager','editor'].includes(cloud?.getAccess?.().role))throw new Error('You cannot write to this shared workspace.');
      if(state.revision!==snapshotRevision)throw new Error('Workspace records changed. Recalculate coverage before creating the PO.');
      const item=state.enterprise.inventory.find(i=>i.sku===sku&&B.region(i.region)===region&&i.nature!=='DIGITAL');
      const eta=read('eta'),currency=read('currency').toUpperCase(),po=read('po');
      if(!item||(!eta||B.dateOnly(eta)!==eta||eta<B.businessDay(new Date(),B.policy(state,region).timeZone))||!/^[A-Z]{3}$/.test(currency)||!read('warehouse')||!read('vendorItem'))throw new Error('Confirm the SKU, date, currency, receiving location and vendor item number.');
      S.createPurchaseOrder({po,vendorId:read('vendorId'),purpose:'INVENTORY',region,currency,eta,warehouse:read('warehouse'),notes:read('notes'),lines:[{sku,model:item.model,vendorItem:read('vendorItem'),title:item.title||item.model,qty:Number(read('qty')),cost:Number(read('cost'))}]},snapshotRevision);
      location.assign(S.url('procurement/index.html?search='+encodeURIComponent(po)));
    }catch(error){say(error.message);}
  });
  window.addEventListener('stark:region-change',render);
  render();
})();
