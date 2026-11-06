(function(){
  'use strict';
  const B=window.MK97Business,S=window.StarkSystem,root=document.querySelector('#customer-returns');
  if(!B||!S||!root)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const params=new URLSearchParams(location.search);
  let selected=params.get('case')||'',orderId=params.get('order')||'',search='',filter='all',matches=[],message='',error=false;
  const cloud=()=>window.StarkSystemCloud;
  const state=()=>S.getState();
  const zone=()=>S.getRegion();
  const writable=()=>{
    const access=cloud()?.getAccess?.();
    return !(cloud()?.getStatus?.().active||access?.userId)||['owner','admin','manager','editor'].includes(access?.role);
  };
  const statuses={AUTHORIZED:'Awaiting receipt',RECEIVED:'Received',CANCELLED:'Cancelled'};
  const link=(url,label)=>`<a href="${esc(S.url(url))}">${esc(label)}</a>`;
  const list=(rows,key)=>rows.find(x=>x.id===key);
  const orderLink=r=>link('all-open-orders.html?order='+encodeURIComponent(r.orderId)+'&region='+r.region,'View customer order');
  function feedback(text='',bad=false){
    message=text;error=bad;
    const p=root.querySelector('#rma-feedback');if(p){p.textContent=text;p.hidden=!text;p.classList.toggle('bs-error',bad);}
  }
  function orderCard(s){
    if(!orderId)return '';
    const d=B.returnOrder(s,orderId);
    if(!d||d.code!==zone())return '<p>No returnable shipped items in this region for that order and return window.</p>';
    const lines=d.lines.filter(l=>l.remaining>0);
    if(!lines.length)return '<p>All shipped units on this order are already covered by returns.</p>';
    return `<h3>${esc(d.order.po)}</h3><p>Authorize by ${esc(d.expires)}. One authorization tracks one SKU; enter the units the customer will send back.</p>
      <form id="rma-create"><div class="bs-grid">
        <label>Shipped SKU<select name="sku" required>${lines.map(l=>`<option value="${esc(l.sku)}" data-limit="${l.remaining}">${esc(l.model)} · up to ${l.remaining} units</option>`).join('')}</select></label>
        <label>Units<input name="qty" type="number" min="1" max="${lines[0].remaining}" value="1" required></label>
        <label>Return reason<input name="reason" maxlength="500" required></label>
      </div><button type="submit">Authorize return</button></form>`;
  }
  function caseCard(s,r){
    if(!r)return '';
    const bins=s.logistics.inventory.filter(i=>i.sku===r.sku&&B.region(i.region||r.region)===r.region).map(i=>i.binId);
    const active=s.logistics.bins.filter(b=>bins.includes(b.id)&&b.active!==false);
    return `<section class="bs-card" id="rma-case">
      <p class="bs-kicker">${esc(statuses[r.status])}</p><h2>${esc(r.orderRef)} · ${esc(r.sku)}</h2>
      <p class="rma-ref">${esc(r.id)} · ${r.qty} authorized units · ${orderLink(r)}</p><p><strong>Reason:</strong> ${esc(r.reason)}</p>
      ${r.status==='AUTHORIZED'&&writable()?`<form id="rma-receive">
        <p>Inspect all ${r.qty} units. Restocked units become available; quarantined units count as damaged stock. Discarded units do not enter inventory.</p>
        <div class="bs-grid">${[['restock','Restock'],['quarantine','Quarantine'],['discard','Discard']].map(([key,label])=>`<label>${label}<input name="${key}" type="number" min="0" max="${r.qty}" value="0" required></label>`).join('')}
        <label>Stock location<select name="binId"><option value="">Choose if posting stock</option>${active.map(b=>`<option value="${esc(b.id)}">${esc(b.id)}</option>`).join('')}</select></label>
        <label>Inspection notes<input name="inspection" maxlength="500" required></label></div>
        <div class="bs-inline"><button type="submit">Post receipt &amp; inspection</button><button type="button" class="bs-secondary" data-rma-cancel>Cancel authorization</button></div>
      </form>`:r.status==='RECEIVED'?`<dl class="rma-results"><div><dt>Restocked</dt><dd>${r.restock}</dd></div><div><dt>Quarantined</dt><dd>${r.quarantine}</dd></div><div><dt>Discarded</dt><dd>${r.discard}</dd></div></dl><p><strong>Inspection:</strong> ${esc(r.inspection)} ${r.binId?'· Location: '+esc(r.binId):''}</p><p>Posted ${esc(new Date(r.closedAt).toLocaleString())}</p>`:''}
    </section>`;
  }
  function register(s){
    const rows=(s.customerReturns||[]).filter(r=>r.region===zone()&&(filter==='all'||r.status===filter));
    return `<section class="bs-card"><div class="bs-policy-head"><h2>Return register</h2><label>Status<select id="rma-filter"><option value="all">All statuses</option>${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${filter===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
      ${rows.length?`<ul class="rma-records">${rows.slice(0,100).map(r=>`<li><button type="button" class="bs-secondary" data-rma-case="${esc(r.id)}" ${r.id===selected?'aria-current="true"':''}>${esc(r.orderRef)} · ${esc(r.sku)}</button><span>${r.qty} units · ${esc(statuses[r.status])}</span></li>`).join('')}</ul>`:'<p>No returns match this region and status.</p>'}
      ${rows.length>100?'<p>Showing the 100 most recent records for this filter. All records are retained in workspace backups.</p>':''}</section>`;
  }
  function render(focus){
    const s=state(),current=list((s.customerReturns||[]).filter(r=>r.region===zone()),selected);
    root.innerHTML=`<header class="bs-head"><div><p class="bs-kicker">ORDER MANAGEMENT</p><h1>Customer returns</h1><p>Authorize a return against shipped units, inspect what came back, and record its disposition.</p></div>${link('workspace.html?view=operations','Open Operations →')}</header>
      <p class="bs-status" id="rma-feedback" role="status" hidden></p>
      <section class="bs-card rma-start"><h2>New authorization · ${esc(zone())}</h2>
      ${!B.profile(s).services.returns?'<p>New returns are disabled in Business setup. Open authorizations can still be completed.</p>':!writable()?'<p>This shared workspace is read only for your account.</p>':`
        <form id="rma-find"><label>Search shipped orders by customer PO, order number or customer<input type="search" name="search" value="${esc(search)}" maxlength="150" required></label><button type="submit">Find order</button></form>
        ${search?`<ul class="rma-records">${matches.length?matches.map(o=>`<li><button type="button" class="bs-secondary" data-rma-order="${esc(o.id)}">${esc(o.po)}</button><span>${esc(o.customer)}</span></li>`).join(''):'<li>No matching orders in the current return window.</li>'}</ul>`:''}
        ${orderCard(s)}`}
      </section>
      ${current?caseCard(s,current):selected?'<p>This return is unavailable in the selected region.</p>':''}
      ${register(s)}
      <p class="rma-note">Returns update warehouse balances after inspection. Refunds and accounting entries are handled separately.</p>`;
    feedback(message,error);
    root.querySelector(focus||'#rma-unset')?.focus();
  }
  function searchOrders(s,query){
    const accounts=new Map(s.enterprise.accounts.map(a=>[a.id,a.name]));
    const q=query.toLowerCase();
    const results=[],region=zone();
    for(const o of s.enterprise.orders){
      if(o.region&&B.region(o.region)!==region||!o.lines.some(l=>l.shipped>0)||![o.po,o.orderNumber,accounts.get(o.accountId)].some(v=>String(v||'').toLowerCase().includes(q)))continue;
      const d=B.returnOrder(s,o.id);
      if(d?.code!==region||!d.lines.some(l=>l.remaining>0))continue;
      results.push({id:o.id,po:o.po,customer:accounts.get(o.accountId)||''});
      if(results.length>=20)break;
    }
    return results;
  }
  function selectCase(id){
    selected=id;const u=new URL(location.href);u.searchParams.set('case',id);history.replaceState(null,'',u);
  }
  root.addEventListener('change',event=>{
    if(event.target.id==='rma-filter'){filter=event.target.value;render('#rma-filter');}
    if(event.target.name==='sku'){const qty=root.querySelector('#rma-create [name="qty"]');qty.max=event.target.selectedOptions[0].dataset.limit;if(Number(qty.value)>Number(qty.max))qty.value=qty.max;}
  });
  root.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    try{
      if(b.dataset.rmaOrder){orderId=b.dataset.rmaOrder;feedback();render('#rma-create [name="sku"]');}
      if(b.dataset.rmaCase){selectCase(b.dataset.rmaCase);feedback();render();root.querySelector('#rma-case')?.scrollIntoView({block:'nearest'});}
      if(b.hasAttribute('data-rma-cancel')&&writable()&&window.confirm('Cancel this return authorization?')){
        B.cancelReturn(S,selected,{cloud:cloud()});feedback('Return authorization cancelled. No stock was changed.');render();
      }
    }catch(e){feedback(e.message,true);}
  });
  root.addEventListener('submit',event=>{
    event.preventDefault();
    const data=new FormData(event.target),opts={cloud:cloud()};
    try{
      if(event.target.id==='rma-find'){
        search=String(data.get('search')).trim();matches=search?searchOrders(state(),search):[];orderId='';feedback();render('[data-rma-order]');return;
      }
      if(!writable())throw new Error('You cannot write to this shared workspace.');
      if(event.target.id==='rma-create'){
        const id=B.createReturn(S,{orderId,sku:data.get('sku'),qty:Number(data.get('qty')),reason:data.get('reason')},opts);
        selectCase(id);orderId='';matches=search?searchOrders(state(),search):[];feedback('Return authorized. Inspect the items when they arrive.');render();
      }
      if(event.target.id==='rma-receive'){
        B.receiveReturn(S,selected,{restock:Number(data.get('restock')),quarantine:Number(data.get('quarantine')),discard:Number(data.get('discard')),binId:data.get('binId'),inspection:data.get('inspection')},opts);
        feedback('Return inspection posted.');render();
      }
    }catch(e){feedback(e.message,true);}
  });
  window.addEventListener('stark:region-change',()=>{orderId='';search='';matches=[];filter='all';feedback();render();});
  function accessChanged(){const available=writable();if(available!==lastWritable){lastWritable=available;render();}}
  window.addEventListener('stark:cloud-status',accessChanged);
  window.addEventListener('stark:access-change',accessChanged);
  let lastWritable=writable();
  render();
})();
