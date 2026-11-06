(function () {
  'use strict';
  const S=window.StarkSystem,C=window.MK97Operations,B=window.MK97Business;
  if(!S||!C)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=(label,path,cls='')=>`<a class="${cls}" href="${esc(S.url(path))}">${esc(label)}</a>`;
  const units=v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(v);
  const price=v=>v===null?'—':new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}).format(v);
  const regionNames={US:'United States',EU:'European Union',CA:'Canada'};
  const sections={queue:'Work queue',supply:'Stock coverage',invoices:'Invoice matching'};
  const categories={orders:'Customer orders',supply:'Inventory & procurement',warehouse:'Warehouse',partners:'3PL',finance:'Invoice reviews'};
  const profiles={all:'All work',executive:'Executive',planner:'Planning',procurement:'Procurement',logistics:'Warehouse & 3PL'};
  const params=new URLSearchParams(location.search);
  let section=Object.hasOwn(sections,params.get('section'))?params.get('section'):'queue';
  let fixedSku=section==='supply'?params.get('sku')||'':'',horizon=null,category='all',profile=null,search=fixedSku,page=0,model=null,loaded=false,preview=null,review=null,message='';
  const blank=poId=>({poId:poId||'',number:'',date:C.businessDay(),currency:'',lines:[]});
  let draft=blank(params.get('po'));
  const user=()=>window.StarkSystemCloud?.getAccess?.().userId||'local';
  const reportState=()=>S.getState();
  const options=(values,selected)=>Object.entries(values).map(([id,label])=>`<option value="${esc(id)}"${id===String(selected)?' selected':''}>${esc(label)}</option>`).join('');
  function setSection(value) {
    if(!Object.hasOwn(sections,value))return;
    section=value;fixedSku='';search='';page=0;category='all';message='';
    const url=new URL(location.href);
    url.searchParams.set('view','operations');url.searchParams.set('section',section);
    url.searchParams.delete('po');url.searchParams.delete('review');url.searchParams.delete('sku');
    history.replaceState(null,'',url);
  }
  function badge(label,tone='neutral') {return `<span class="oc-badge oc-${tone}">${esc(label)}</span>`;}
  function metric(label,value,description) {
    return `<div class="oc-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(description)}</small></div>`;
  }
  function empty(text){return `<p class="oc-empty">${esc(text)}</p>`;}
  const pageSize=20;
  function paginate(rows,format) {
    if(!rows.length)return empty('No records match these filters.');
    const pages=Math.ceil(rows.length/pageSize);
    page=Math.max(0,Math.min(page,pages-1));
    return rows.slice(page*pageSize,(page+1)*pageSize).map(format).join('')+
      (pages===1?'':`<div class="oc-pager"><span>Page ${page+1} of ${pages} · ${units(rows.length)} records</span><button type="button" data-oc-page="-1" ${page===0?'disabled':''}>Previous</button><button type="button" data-oc-page="1" ${page+1===pages?'disabled':''}>Next</button></div>`);
  }
  const matches=(...values)=>values.join(' ').toLowerCase().includes(search.trim().toLowerCase());
  function resultList() {
    if(section==='queue') {
      const allowed=C.PROFILES[profile]||Object.keys(categories);
      const rows=model.issues.filter(i=>allowed.includes(i.category)&&(category==='all'||i.category===category)&&matches(i.title,i.detail,categories[i.category]));
      return paginate(rows,i=>`<article class="oc-exception">
        <div class="oc-record-meta">${badge(i.severity==='high'?'High priority':'Review',i.severity==='high'?'high':'medium')}<span>${esc(categories[i.category])}</span></div>
        <div class="oc-exception-copy"><h3>${esc(i.title)}</h3><p>${esc(i.detail)}</p></div>
        <div class="oc-row-actions">${link('Open record',i.path,'oc-text-link')}${i.taskId?link('Open follow-up','tasks.html?task='+encodeURIComponent(i.taskId),'oc-text-link'):`<button type="button" data-oc-task="${esc(i.key)}">Create follow-up</button>`}</div>
      </article>`);
    }
    return paginate(model.availability.filter(i=>(!fixedSku||i.sku===fixedSku)&&matches(i.model,i.sku,i.title)),i=>`<article class="oc-stock">
      <header><div><h3>${esc(i.model)}</h3><p>${esc(i.title||i.sku)}</p></div>${i.overcommitted?badge('Overcommitted','high'):i.available<i.safety?badge('Below buffer','medium'):badge('Within buffer','good')}</header>
      <dl class="oc-stock-numbers">${[['On hand',i.onHand],['Reserved',i.reserved],['Damaged',i.damaged],['Free now',i.available],['Dated inbound',i.confirmed],['Projected free',i.projected]].map(([k,v])=>`<div><dt>${k}</dt><dd>${units(v)}</dd></div>`).join('')}</dl>
      <div class="oc-replenishment"><span><strong>${i.replenishable?'Suggested buy: '+units(i.suggestedBuy):'No replenishment for this catalog status'}</strong>${i.planningDemand?' · includes '+units(i.planningDemand)+' dated unvalidated units':''}</span>${i.suggestedBuy>0&&model.modules.includes('procurement')?link('Prepare vendor PO','replenishment.html?sku='+encodeURIComponent(i.sku)+'&region='+model.region+'&horizon='+model.horizon,'oc-text-link'):''}</div>
      <details${fixedSku?' open':''}><summary>Supply and location evidence</summary><p>Safety buffer: ${units(i.safety)} · Pending putaway: ${units(i.staged)} · Draft demand: ${units(i.draftDemand)} · Inbound excluded from projection: ${units(i.excluded)}</p>
        ${i.sources.length?`<ul>${i.sources.map(p=>`<li>${link(p.reference,p.path,'oc-text-link')} · ${esc(p.vendor)} · ${units(p.qty)} units · ${esc(p.eta||'ETA missing')} · ${esc(p.status.replaceAll('_',' '))}</li>`).join('')}</ul>`:'<p>No open inbound sources for this SKU.</p>'}
        ${i.locations.length?`<h4>Posted warehouse balances</h4><ul>${i.locations.map(r=>`<li>${esc(r.bin)} · ${units(r.onHand)} on hand · ${units(r.reserved)} reserved · ${units(r.damaged)} damaged</li>`).join('')}</ul>`:''}
      </details>
    </article>`);
  }
  function workPanel() {
    const queue=section==='queue';
    const permitted=C.PROFILES[profile]||Object.keys(categories);
    const cats={all:'All categories',...Object.fromEntries(Object.entries(categories).filter(([key])=>permitted.includes(key)))};
    return `<section class="oc-panel" aria-label="${sections[section]}">
      <header class="oc-panel-head"><div><span class="oc-kicker">${queue?'PRIORITY AND OWNERSHIP':'INVENTORY AND INBOUND'}</span><h2>${queue?'Exceptions that need action':'Regional stock coverage'}</h2><p>${queue?'Open the source record or save a linked task for follow-up.':'Projected free stock uses on-hand less reservations and damage, plus confirmed dated inbound through '+esc(model.through)+'. It is a regional estimate, not a delivery promise.'}</p></div></header>
      <div class="oc-filters"><label>Search<input id="oc-search" value="${esc(search)}" type="search" placeholder="${queue?'Order, PO, issue or item':'Model or SKU'}"></label>
        ${queue?`<label>Perspective<select id="oc-profile">${options(profiles,profile)}</select></label><label>Category<select id="oc-category">${options(cats,category)}</select></label>`:`<label>Planning window<select id="oc-horizon">${options(Object.fromEntries([...new Set([7,14,30,60,90,model.defaultHorizon])].sort((a,b)=>a-b).map(days=>[days,days+' days'+(days===model.defaultHorizon?' · default':'')])),model.horizon)}</select></label>`}
      </div>
      ${!queue?'<p class="oc-note">Late, undated and unconfirmed inbound, pending putaway and dropship POs are excluded. Recommendations restore the safety buffer after reservations and eligible inbound. Unvalidated orders are included only when enabled in Business setup.</p>':''}
      <div id="oc-results">${resultList()}</div>
    </section>`;
  }

  function makeRow(sku,label,data,known) {
    return `<div class="oc-invoice-line" data-invoice-row data-sku="${esc(sku)}">
      ${known?`<div class="oc-line-item"><strong>${esc(label)}</strong><small>${esc(sku)}</small><small>PO ${units(known.ordered)} · Posted usable ${units(known.received)} · PO unit price ${price(known.unitRate==null?null:known.unitRate/10000)}</small></div>`:
        `<label>Unlisted invoice SKU<input data-line-sku maxlength="150" value="${esc(sku)}" placeholder="SKU as billed"></label>`}
      <label>Invoice quantity<input aria-label="Invoice quantity for ${esc(label||'unlisted SKU')}" data-line-qty type="number" step="1" min="1" max="1000000" inputmode="numeric" value="${esc(data?.qty??'')}"></label>
      <label>Invoice unit price<input aria-label="Invoice unit price for ${esc(label||'unlisted SKU')}" data-line-price type="text" inputmode="decimal" maxlength="14" value="${esc(data?.price??'')}"></label>
    </div>`;
  }
  function comparisonCard(result, historical=false) {
    if(!result)return '';
    const lines=result.lines||[],flags=result.flags||[];
    return `<section class="oc-comparison" aria-label="Matching evidence">
      <header><div>${badge(flags.length?'Exceptions found':'Matched',flags.length?'medium':'good')}<h3>${esc(result.number)} · ${esc(result.poReference)}</h3><p>${historical?'Saved evidence at review time':'Comparison of current purchase, receipt and invoice data'} · ${esc(result.currency)} ${price(result.total)} in item charges</p></div>
      ${!historical?`<button type="button" class="oc-primary" data-oc-save>Save review</button>`:''}</header>
      ${flags.length?`<ul class="oc-flags">${flags.map(flag=>`<li>${esc(flag)}</li>`).join('')}</ul>`:'<p class="oc-note">Billed SKUs, quantities, currency and unit prices match the PO and unbilled posted usable receipts.</p>'}
      <div class="oc-table-scroll" tabindex="0" role="region" aria-label="Invoice comparison lines"><table><thead><tr><th>SKU</th><th>Ordered</th><th>Posted usable</th><th>Prior matched</th><th>Invoice qty</th><th>PO price</th><th>Invoice price</th></tr></thead>
      <tbody>${lines.map(x=>`<tr><td>${esc(x.sku)}</td><td>${units(x.ordered)}</td><td>${units(x.received)}</td><td>${units(x.priorQty)}</td><td>${units(x.qty)}</td><td>${price(x.poPrice)}</td><td>${price(x.price)}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }
  function openReview(state,id) {
    const r=(state.invoiceReviews||[]).find(row=>row.id===id);
    if(!r)return;
    review=r;preview=null;message='';
    draft={poId:r.poId,number:r.number,date:r.date,currency:r.currency,lines:r.lines.map(line=>({...line}))};
  }
  function invoicePanel(state) {
    if(!loaded){loaded=true;if(params.get('review'))openReview(state,params.get('review'));}
    const p=state.enterprise.purchaseOrders.find(p=>p.id===draft.poId);
    const vendor=new Map(state.enterprise.vendors.map(v=>[v.id,v.name]));
    const model=p?C.invoiceLines(state,p.id):null,selectedCurrency=draft.currency||model?.currency||'';
    const readOnly=review?.status==='MATCHED',newDisabled=state.businessProfile?.services?.invoices===false;
    const storedComparison=readOnly?comparisonCard({...review,...review.evidence},true):'';
    const rows=model?.lines||[];
    const current=new Map(draft.lines.filter(x=>!x.extra).map(x=>[x.sku,x]));
    const extra=draft.lines.filter(x=>x.extra||!rows.some(r=>r.sku===x.sku));
    const poOptions={'':'Choose a vendor PO',...Object.fromEntries(state.enterprise.purchaseOrders.filter(p=>p.purpose!=='DROPSHIP'&&!['DRAFT','CANCELLED'].includes(p.status)).map(p=>[p.id,p.po+' · '+(vendor.get(p.vendorId)||'Supplier')]))};
    return `<section class="oc-panel" aria-label="Invoice matching">
      <header class="oc-panel-head"><div><span class="oc-kicker">PROCURE TO PAY</span><h2>Match a supplier invoice</h2><p>Compare one PO with its posted usable receipts and invoice lines. Reviews record evidence only; they do not post bills, taxes, payments or journal entries.</p></div>${link('Vendor POs','procurement/index.html','oc-text-link')}</header>
      ${readOnly?storedComparison:newDisabled&&!review?'<p class="oc-empty">New invoice reviews are disabled in Business setup. Select an existing review below.</p>':`<form id="oc-invoice-form">
        <label class="oc-select-po">Vendor PO<select id="oc-po" name="poId" required ${review?'disabled':''}>${options(poOptions,draft.poId)}</select></label>
        ${p?`<div class="oc-invoice-fields"><label>Invoice number<input name="number" required maxlength="80" value="${esc(draft.number)}"></label><label>Invoice date<input name="date" type="date" required value="${esc(draft.date)}"></label><label>Invoice currency<input name="currency" required maxlength="3" autocomplete="off" value="${esc(selectedCurrency)}"></label></div>
        <p class="oc-note">Enter only billed lines. Leave both fields blank for items absent from this invoice. Freight and tax are outside this item match.</p>
        <div id="oc-invoice-lines">${rows.map(x=>makeRow(x.sku,x.label,current.get(x.sku),x)).join('')}${extra.map(x=>makeRow(x.sku,'unlisted SKU',x,null)).join('')}</div>
        <div class="oc-actions"><button type="submit" class="oc-primary">Compare invoice</button><button type="button" data-oc-extra>Add unlisted line</button></div>`:'<p class="oc-empty">Select a PO to load its item and receipt balances.</p>'}
      </form>
      <div id="oc-comparison">${preview?comparisonCard(preview.result):''}</div>`}
      ${review&&!newDisabled?'<div class="oc-actions"><button type="button" data-oc-new>Start a new review</button></div>':''}
      <section class="oc-register"><h3>Invoice review register</h3>
        ${(state.invoiceReviews||[]).length?(state.invoiceReviews||[]).slice(0,100).map(r=>`<article><div><strong>${esc(r.number)}</strong><p>${esc(r.poReference)} · ${esc(r.date)} · ${esc(r.currency)} ${price(r.total)}</p></div>${badge(r.status==='MATCHED'?'Matched when saved':'Exception',r.status==='MATCHED'?'good':'medium')}<button type="button" data-oc-review="${esc(r.id)}">${r.status==='MATCHED'?'View evidence':'Open review'}</button></article>`).join(''):empty('No invoice reviews saved yet.')}
        ${(state.invoiceReviews||[]).length>100?'<p class="oc-note">Showing the 100 most recently added reviews. Older entries are retained in workspace backups.</p>':''}
      </section>
    </section>`;
  }
  function html() {
    const state=reportState();
    profile=profile||window.MK97Platform?.getConfig?.().activeRole||'all';
    if(preview&&preview.revision!==state.revision){preview=null;message='Workspace records changed. Compare the invoice again before saving.';}
    const business=B?.profile(state), config=window.MK97Platform?.getConfig?.();
    const modules=(business?.modules||Object.keys(B?.MODULES||{})).filter(id=>id==='data'||!Array.isArray(config?.enabledModules)||config.enabledModules.includes(id));
    const allowInvoice=business?.services.invoices!==false&&modules.includes('procurement');
    const showInvoice=allowInvoice||(state.invoiceReviews||[]).length>0||section==='invoices'&&params.has('review');
    if(section==='invoices'&&!showInvoice)section='queue';
    const allowSupply=modules.some(id=>['itemMaster','planning','warehouse','procurement'].includes(id));
    if(section==='supply'&&!allowSupply&&!fixedSku)section='queue';
    model={...C.snapshot(state,{region:S.getRegion(),horizon}),modules,defaultHorizon:B?.policy(state,S.getRegion()).horizon||30};
    const source=window.StarkWorkspace?.isDemo||state.mode==='sample'?'Sample records':window.StarkSystemCloud?.getStatus?.().active?'Organization workspace':'Browser workspace';
    return `<div class="ops-center" id="ops-center">
      <section class="oc-hero">
        <div><div class="oc-hero-meta"><span>${esc(business?.name||'MK97 OPERATIONS')}</span><span>${esc(regionNames[model.region])} · ${esc(source)}</span></div>
        <h1>Operations workspace</h1><p>One place to resolve exceptions, check stock coverage and reconcile supplier invoices.</p></div>
        <div class="oc-hero-actions">${modules.includes('orders')?link('Create customer order','create-order.html','oc-hero-primary'):''}${modules.includes('procurement')?link('Create vendor PO','create-vendor-po.html','oc-hero-secondary'):''}${modules.includes('warehouse')?link('Scan items','scan.html','oc-hero-secondary'):''}${modules.includes('orders')&&business?.services.returns!==false?link('Customer returns','returns.html','oc-hero-secondary'):''}${link('Business setup','business-setup.html','oc-hero-secondary')}</div>
      </section>
      <div class="oc-metrics">${metric('Needs attention',units(model.issues.length),'Exceptions in '+regionNames[model.region])}${metric('High priority',units(model.issues.filter(i=>i.severity==='high').length),'Requires prompt review')}${metric('Open customer orders',units(model.openOrders),'Includes holds and validation')}${metric('Open vendor POs',units(model.openPOs),'With an unposted balance')}</div>
      <div class="oc-tabs" role="group" aria-label="Operations views">${Object.entries(sections).filter(([id])=>id==='queue'||id==='supply'&&(allowSupply||fixedSku)||id==='invoices'&&showInvoice).map(([id,label])=>`<button type="button" data-oc-section="${id}" aria-pressed="${section===id}">${label}</button>`).join('')}</div>
      <p class="oc-feedback" id="oc-feedback" role="status"${message?'':' hidden'}>${esc(message)}</p>
      ${section==='invoices'?invoicePanel(state):workPanel()}
    </div>`;
  }
  function bind(host,refresh) {
    const panel=host.querySelector('#ops-center');
    if(!panel)return;
    const say=text=>{message=text;const feedback=panel.querySelector('#oc-feedback');feedback.textContent=text;feedback.hidden=!text;};
    const replaceResults=()=>{const r=panel.querySelector('#oc-results');if(r)r.innerHTML=resultList();};
    function readInvoice(form,includeBlanks=false) {
      const data=new FormData(form);
      const lines=[...form.querySelectorAll('[data-invoice-row]')].map(row=>({sku:row.querySelector('[data-line-sku]')?.value??row.dataset.sku,extra:!!row.querySelector('[data-line-sku]'),qty:row.querySelector('[data-line-qty]').value,price:row.querySelector('[data-line-price]').value}));
      return {poId:draft.poId,number:String(data.get('number')||''),date:String(data.get('date')||''),currency:String(data.get('currency')||''),lines:includeBlanks?lines:lines.filter(x=>x.qty!==''||x.price!=='')};
    }
    function replaceFocus(selector){refresh();host.querySelector(selector)?.focus();}
    panel.addEventListener('input',event=>{
      if(event.target.id==='oc-search'){if(fixedSku){fixedSku='';const url=new URL(location.href);url.searchParams.delete('sku');history.replaceState(null,'',url);}search=event.target.value;page=0;replaceResults();return;}
      const form=event.target.closest('#oc-invoice-form');
      if(form&&event.target.id!=='oc-po'){
        draft=readInvoice(form,true);preview=null;
        panel.querySelector('#oc-comparison').replaceChildren();
      }
    });
    panel.addEventListener('change',event=>{
      const t=event.target;
      if(t.id==='oc-profile'){profile=t.value;category='all';page=0;replaceFocus('#oc-profile');}
      if(t.id==='oc-category'){category=t.value;page=0;replaceResults();}
      if(t.id==='oc-horizon'){horizon=Number(t.value);page=0;replaceFocus('#oc-horizon');}
      if(t.id==='oc-po'){draft=blank(t.value);review=null;preview=null;message='';replaceFocus('#oc-po');}
    });
    panel.addEventListener('submit',event=>{
      if(event.target.id!=='oc-invoice-form')return;
      event.preventDefault();
      try{
        draft=readInvoice(event.target,true);
        const input=readInvoice(event.target);
        const state=reportState(),result=C.compareInvoice(state,input,review?.id||'');
        preview={result,input,revision:state.revision};
        panel.querySelector('#oc-comparison').innerHTML=comparisonCard(result);
        say(result.flags.length?'Comparison finished. Review the highlighted exceptions.':'Comparison finished. The item charges match.');
        panel.querySelector('[data-oc-save]').focus();
      }catch(error){preview=null;panel.querySelector('#oc-comparison').replaceChildren();say(error.message);}
    });
    panel.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b)return;
      try {
        if(b.dataset.ocSection){setSection(b.dataset.ocSection);replaceFocus('[data-oc-section="'+section+'"]');}
        else if(b.dataset.ocPage){page+=Number(b.dataset.ocPage);replaceResults();panel.querySelector('#oc-results article a')?.focus();}
        else if(b.dataset.ocTask){
          const issue=model.issues.find(i=>i.key===b.dataset.ocTask);
          if(!issue)return;
          const id=C.createFollowUp(S,issue.key,{region:model.region,horizon,user:user()});
          message='Follow-up saved to Tasks.';refresh();host.querySelector('a[href="'+S.url('tasks.html?task='+encodeURIComponent(id))+'"]')?.focus();
        }
        else if(b.hasAttribute('data-oc-extra')){
          const form=panel.querySelector('#oc-invoice-form');
          if(form.querySelectorAll('[data-line-sku]').length>=15){say('Enter up to 15 unlisted lines.');return;}
          panel.querySelector('#oc-invoice-lines').insertAdjacentHTML('beforeend',makeRow('','unlisted SKU',null,null));
          [...form.querySelectorAll('[data-line-sku]')].at(-1).focus();
        }
        else if(b.hasAttribute('data-oc-save')){
          if(!preview)throw new Error('Compare the invoice before saving.');
          const id=C.saveInvoice(S,preview.input,{id:review?.id||'',expectedRevision:preview.revision,user:user()});
          openReview(reportState(),id);message='Invoice review saved to the register.';refresh();
          host.querySelector('#oc-feedback')?.scrollIntoView({block:'nearest'});
        }
        else if(b.dataset.ocReview){openReview(reportState(),b.dataset.ocReview);refresh();host.querySelector('.oc-panel-head')?.scrollIntoView({block:'start'});}
        else if(b.hasAttribute('data-oc-new')){draft=blank();review=null;preview=null;message='';replaceFocus('#oc-po');}
      } catch(error){const visible=host.querySelector('#oc-feedback');if(visible){message=error.message;visible.hidden=false;visible.textContent=message;}}
    });
  }
  window.MK97WorkCenter={html,bind};
})();
