(function () {
  'use strict';
  // Application data stays inside the selected workspace; auth storage is separate.
  const localStorage = window.StarkWorkspace?.localStorage || window.localStorage;

  const S = window.StarkSystem;
  if (!S) return;
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const glyph = name => {
    const paths = {
      home:'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
      planning:'M4 19V9m5 10V5m5 14v-7m5 7V3',
      crm:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M16 4a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-3 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
      orders:'M6 3h12v18H6z M9 8h6m-6 4h6m-6 4h4',
      vendor:'M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6 M8 10h1m6 0h1',
      warehouse:'M3 21V8l9-5 9 5v13M7 21V11h10v10M7 15h10m-10 3h10',
      logistics:'M3 6h11v12H3z M14 10h4l3 4v4h-7 M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
      data:'M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3 M4 6v12c0 2 4 3 8 3s8-1 8-3V6 M4 12c0 2 4 3 8 3s8-1 8-3',
      search:'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[({tpl:'warehouse',shipping:'logistics',transportation:'logistics',procurement:'vendor'})[name] || name] || paths.data}"/></svg>`;
  };
  function groups() {
    const region = S.getRegion(), suffix = region.toLowerCase();
    return [
      ['planning','Inventory & planning',[
        [`inventory-dashboard-${suffix}.html`,'Inventory dashboard'],
        [`decision-intelligence-${suffix}.html`,'Decision intelligence'],
        [`raw-report-${suffix}.html`,'Raw report & upload'],
        [`reorder-report-${suffix}.html`,'Reorder report'],
        [`active-brands-${suffix}.html`,'Active brands'],
        ...(region==='EU'?[['ats-eu.html','Available to sell']]:[]),
        ['sales-analysis.html?region='+region,'Sales analysis'],
        ['procurement-planning.html','Reorder to purchase order']
      ]],
      ['crm','Customers & CRM', [['crm/index.html','CRM dashboard'],['crm/accounts.html','Accounts & programs'],['crm/catalog.html','Catalog & pricing'],['crm/partner-portal.html','Partner portal']]],
      ['orders','Order management',[['order-management/index.html','All open orders'],['order-management/new-order.html','Create customer order'],['order-management/issues.html','Order issues'],['order-management/unvalidated.html','Unvalidated orders'],['order-management/cancelled.html','Cancelled orders'],['order-management/hold-redemption.html','Hold & redemption'],['order-management/bulk-firm.html','Bulk & firm orders'],['events.html?region='+region,'Event planning'],['events-tv.html?region='+region,'Events display']]],
      ['vendor','Vendor management',[['vendor-management/index.html','Vendor dashboard'],['vendor-management/vendors.html','Vendor master'],['vendor-management/sla.html','Supplier performance'],['vendor-management/digital-vault.html','Digital rewards']]],
      ['procurement','Procurement',[['procurement/index.html','Open vendor PO management'],['procurement/new-po.html','Create vendor PO'],['vendor-po-management.html','Event / dropship POs'],['vendor-management/procurement.html','Procurement & receiving']]],
      ['shipping','Shipping',[['shipping/index.html','Ship orders · Sarasota'],['shipping/daily-report.html','Daily shipment report']]],
      ['warehouse','Warehouse management',[['warehouse-management/index.html','Warehouse control tower'],['warehouse-management/inventory-bins.html','Stock & locations'],['warehouse-management/receiving.html','Receiving & putaway'],['warehouse-management/wave-picking.html','Wave picking'],['warehouse-management/packing-dispatch.html','Packing & dispatch'],['warehouse-management/cycle-counts.html','Cycle counts']]],
      ['tpl','3PL management',[['3pl-management/index.html','3PL overview'],['3pl-management/order-history.html','Order history & processing API'],['3pl-management/shipment-requests.html','Shipment requests'],['3pl-management/orders.html','Manage 3PL orders'],['3pl-management/ship-orders.html','Ship 3PL orders'],['3pl-management/upload-shipments.html','Upload 3PL shipments'],['3pl-management/network.html','Partner network & stock'],['3pl-management/routing.html','Routing workbench'],['3pl-management/shipments.html','Partner shipment register'],['3pl-management/reconciliation.html','Reconciliation & SLA'],['3pl-management/integrations.html','API connection']]],
      ['transportation','Transportation',[['transportation/index.html','Transportation overview'],['freight-estimator.html','Freight estimator'],['freight-consolidate.html','Freight consolidation'],['shipment-tracking.html','Shipment tracking']]],
      ['data','System & data',[['data-center.html','Data center & backups'],['activity.html','Audit activity'],[`instructions-${suffix}.html`,'Regional instructions']]]
    ];
  }
  const currentPath = location.pathname;
  // Resolve route-selected regions before any module's DOMContentLoaded renderer.
  const initialQuery=new URLSearchParams(location.search),initialRegion=currentPath.match(/-(us|eu|ca)\.html$/)?.[1]||initialQuery.get('region')||initialQuery.get('workspace');
  if(initialRegion)localStorage.setItem('stark-selected-region',S.regionCode(initialRegion));
  const relativePath = currentPath.slice(S.rootURL.pathname.length);
  const searchEnabled = /^(order-management|vendor-management|procurement)\//.test(relativePath) || ['order-management.html','vendor-management.html','vendor-po-management.html'].includes(relativePath);
  const navigationPath = currentPath.replace(/\/warehouse-management\/cycle-count\.html$/, '/warehouse-management/cycle-counts.html');
  const active = path => new URL(path,S.rootURL).pathname === navigationPath;
  function links(items, top=false) { if(top)items=items.filter(([path])=>!/(?:mk-brain|decision-intelligence-(?:us|eu|ca))\.html/i.test(path)); return items.map(([path,label])=>`<a href="${S.url(path)}" ${active(path)?'class="active" aria-current="page"':''}>${escape(label)}</a>`).join(''); }
  function renderNavigation() {
    const nav = document.querySelector('#system-navigation'); if (!nav) return;
    const homeActive = active('workspace.html') || active('business-operations.html');
    nav.innerHTML = `<a class="system-home ${homeActive?'active':''}" ${homeActive?'aria-current="page"':''} href="${S.url('workspace.html')}">${glyph('home')}<span>Overview</span></a>` + groups().map(([id,label,items])=>`<details data-nav-group="${id}" ${items.some(([path])=>active(path))?'open':''}><summary>${glyph(id)}<span>${label}</span><span class="system-chevron">⌄</span></summary><div class="system-subnav">${links(items)}</div></details>`).join('');
    const tabs=document.querySelector('#system-module-tabs');if(tabs){const group=groups().find(([,label,items])=>items.some(([path])=>active(path)));tabs.innerHTML=group?`<span class="system-module-name">${escape(group[1])}</span>`+links(group[2],true):`<span class="system-module-name">Workspace</span>`+links([['workspace.html','Overview'],['order-management/index.html','Orders'],['crm/index.html','Customers'],['procurement/index.html','Procurement'],['warehouse-management/index.html','Warehouse'],['3pl-management/index.html','3PL'],['transportation/index.html','Transportation'],['mk-brain.html','AI analyst']],true);}

  }
  function notice(message,error=false) {
    const node = document.createElement('div'); node.className='system-toast'+(error?' error':''); node.setAttribute('role',error?'alert':'status'); node.textContent=message; document.body.append(node); setTimeout(()=>node.remove(),5000);
  }
  function search(query) {
    const q = query.toLowerCase().trim(), s = S.getState(); if (!q) return [];
    const routeMatches = groups().flatMap(([,group,items])=>items.map(([path,label])=>({label,kind:group,path}))).filter(x=>x.label.toLowerCase().includes(q));
    const records = [
      ...s.enterprise.accounts.map(x=>({label:x.name,kind:'Customer',path:'crm/accounts.html',hay:x.name+' '+x.email})),
      ...s.enterprise.vendors.map(x=>({label:x.name,kind:'Vendor',path:'vendor-management/vendors.html',hay:x.name+' '+x.email})),
      ...s.enterprise.orders.map(x=>({label:x.po,kind:'Customer order · '+x.status.replaceAll('_',' '),path:'order-management/index.html?search='+encodeURIComponent(x.po),hay:[x.po,x.id,x.orderNumber,x.tracking,x.createdAt,x.inHandsDate,...x.lines.flatMap(l=>[l.model,l.sku]),...s.logistics.tplShipments.filter(p=>p.customerOrderId===x.id).map(p=>p.tracking),...s.logistics.packing.filter(p=>p.orderId===x.id).map(p=>p.tracking)].filter(Boolean).join(' ')})),
      ...s.enterprise.purchaseOrders.map(x=>({label:x.po,kind:'Vendor PO · '+x.status,path:'vendor-management/procurement.html',hay:x.po})),
      ...s.enterprise.inventory.map(x=>({label:x.model+' · '+x.brand,kind:'SKU · '+x.region,path:'crm/catalog.html',hay:x.sku+' '+x.model+' '+x.brand+' '+x.title}))
    ].filter(x=>String(x.hay).toLowerCase().includes(q));
    return [...routeMatches,...records].slice(0,12);
  }
  function start() {
    if (document.body.classList.contains('tv-view') || document.querySelector('.tv-app') || /\/(login|auth-callback|cloud-agent)\.html$/.test(currentPath)) return;
    if (document.querySelector('.system-header')) return;
    const W=window.StarkWorkspace;
    const header=document.createElement('header');header.className='system-header';
    header.innerHTML=`<a class="system-brand" href="${S.url('workspace.html')}" aria-label="Supply Chain Intelligence home"><span class="system-wordmark">MK<span>◆</span></span><span><b>Supply Chain</b><small>Intelligence</small></span></a><button class="system-menu" type="button" aria-label="Open module menu" aria-controls="system-modules" aria-expanded="false">${glyph('data')}<span>Modules</span><span>⌄</span></button><span class="system-header-spacer"></span>${searchEnabled?`<div class="system-search"><label class="visually-hidden" for="system-search-input">Search orders, purchase orders and vendors</label>${glyph('search')}<input id="system-search-input" placeholder="PO, order, tracking or model…" autocomplete="off"><div class="system-search-results" hidden></div></div>`:''}<label class="system-region"><span>Analysis region</span><select id="system-region-select" aria-label="Analysis region"><option value="US">US · USD</option><option value="EU">EU · EUR</option><option value="CA">CA · CAD</option></select></label><button id="system-workspace-button" class="system-mode-button" type="button">${W?.isDemo?'Demo workspace':'Working workspace'}</button><a class="system-icon-action system-header-alert" href="${S.url('activity.html')}" aria-label="View workspace activity">${glyph('orders')}<span class="system-header-alert-count" id="system-alert-count" hidden></span></a><a class="system-account" href="${S.url('login.html?workspaceMode=working&from='+(W?.isDemo?'demo':'working')+'&return='+encodeURIComponent(W?.destination()||relativePath+location.search))}" aria-label="Organization sign in">${W?.isDemo?'D':'↗'}</a>`;
    const modules=document.createElement('section');modules.id='system-modules';modules.className='system-modules';modules.hidden=true;modules.setAttribute('role','dialog');modules.setAttribute('aria-modal','true');modules.setAttribute('aria-label','Choose a module');
    modules.innerHTML='<div class="system-modules-heading"><div><p>ONE CONNECTED WORKSPACE</p><h2>Choose a module</h2></div><button type="button" id="system-modules-close" aria-label="Close module menu">×</button></div><nav id="system-navigation" aria-label="All application modules"></nav>';
    const rail=document.createElement('nav');rail.id='system-module-tabs';rail.className='system-module-tabs';rail.setAttribute('aria-label','Current module pages');
    const scrim=document.createElement('button');scrim.className='system-scrim';scrim.setAttribute('aria-label','Close module menu');scrim.hidden=true;
    const skip=document.createElement('a');skip.className='system-layout-skip';skip.textContent='Skip to workspace';
    const main=document.querySelector('main');if(main){main.id||='workspace-main';main.setAttribute('tabindex','-1');skip.href='#'+main.id;}
    document.body.prepend(skip,header,rail,scrim,modules);document.body.classList.add('stark-system');document.body.dataset.systemSearch=String(searchEnabled);
    const footer=document.createElement('footer');footer.className='system-workspace-footer';footer.innerHTML='<span id="system-data-status"></span><span>Supply Chain Intelligence · Portfolio edition</span>';document.body.append(footer);
    if(!searchEnabled){const restrictSearch=()=>document.querySelectorAll('input[type="search"],input[id*="search" i],input[placeholder^="Search" i]').forEach(input=>{input.disabled=true;const wrapper=input.closest('label,.search,.search-field,.op-search');(wrapper||input).hidden=true;});restrictSearch();new MutationObserver(restrictSearch).observe(document.body,{childList:true,subtree:true});}
    renderNavigation();
    const select=header.querySelector('select');select.value=S.getRegion();
    select.addEventListener('change',()=>{localStorage.setItem('stark-selected-region',select.value);renderNavigation();window.dispatchEvent(new CustomEvent('stark:region-change',{detail:{region:select.value}}));const relative=currentPath.slice(S.rootURL.pathname.length);const navigate=url=>window.StarkNavigation?window.StarkNavigation.navigate(url):location.assign(url);if(/-(us|eu|ca)\.html$/.test(relative))navigate(S.url(relative.replace(/-(us|eu|ca)\.html$/,`-${select.value.toLowerCase()}.html`)));else if(['events.html','sales-analysis.html'].includes(relative))navigate(S.url(relative+'?region='+select.value));});
    window.addEventListener('stark:region-change',()=>{select.value=S.getRegion();renderNavigation();});
    const toggle=header.querySelector('.system-menu');let menuOrigin=toggle;
    const expanded=value=>document.querySelectorAll('[aria-controls="system-modules"]').forEach(button=>button.setAttribute('aria-expanded',String(value)));
    const close=()=>{if(modules.hidden)return;modules.hidden=true;scrim.hidden=true;document.body.classList.remove('system-nav-open');expanded(false);(menuOrigin?.isConnected?menuOrigin:toggle).focus();};
    const open=(origin=toggle)=>{menuOrigin=origin;modules.hidden=false;scrim.hidden=false;document.body.classList.add('system-nav-open');expanded(true);modules.querySelector('a,summary,button')?.focus();};
    toggle.onclick=()=>modules.hidden?open():close();scrim.onclick=close;modules.querySelector('#system-modules-close').onclick=close;
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('.modal-backdrop,.sys-modal-backdrop'))close();if(event.key==='Tab'&&!modules.hidden){const nodes=[...modules.querySelectorAll('button,a,summary')].filter(n=>!n.closest('details:not([open]) .system-subnav'));const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
    const input=header.querySelector('input'),results=header.querySelector('.system-search-results');
    if(input&&results){input.addEventListener('input',()=>{const rows=search(input.value);results.hidden=!input.value.trim();results.innerHTML=rows.length?rows.map(x=>`<a href="${S.url(x.path)}"><b>${escape(x.label)}</b><small>${escape(x.kind)}</small></a>`).join(''):'<p>No matching records</p>';});document.addEventListener('click',e=>{if(!e.target.closest('.system-search'))results.hidden=true;});input.addEventListener('keydown',e=>{if(e.key==='Escape')results.hidden=true;if(e.key==='Enter'&&results.querySelector('a'))window.StarkNavigation?window.StarkNavigation.navigate(results.querySelector('a').href):location.assign(results.querySelector('a').href);});}
    const status=()=>{const state=S.getState(),cloud=window.StarkSystemCloud?.getStatus(),count=S.issues().length;document.querySelector('#system-data-status').textContent=W?.isDemo?'DEMO · Fictional records · Saved in this browser':cloud?.active?cloud.status:'Browser records · Connect organization data in Data Center';const badge=document.querySelector('#system-alert-count');badge.hidden=!count;badge.textContent=String(count);};status();window.addEventListener('stark:system-change',status);window.addEventListener('stark:region-change',status);window.addEventListener('stark:cloud-status',status);
    header.querySelector('#system-workspace-button').onclick=()=>window.StarkPortfolio?.workspaceMenu();
    window.StarkModuleNavigation={open,close,groups};
    window.addEventListener('error',e=>{if(/storage|newer changes/i.test(e.message||''))notice(e.message,true);});
  }

  let dialogSequence=0;
  function dialog(title,body,onSave,saveLabel='Save',options={}) {
    const former=document.activeElement, wrap=document.createElement('div'), titleId='system-dialog-title-'+(++dialogSequence);
    wrap.className='modal-backdrop';
    wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}"><div class="modal-head"><h3 id="${titleId}">${escape(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Close dialog">×</button></div><div class="modal-body">${body}<p data-dialog-error class="notice danger" role="alert" hidden></p></div><div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" data-save>${escape(saveLabel)}</button></div></div>`;
    if(options.system){wrap.className='sys-modal-backdrop';wrap.querySelector('.modal').className='sys-modal';wrap.querySelector('.modal-actions').className='sys-modal-footer';wrap.querySelectorAll('button').forEach(button=>button.className=button.hasAttribute('data-save')?'sys-btn primary':'sys-btn');}
    document.body.append(wrap);
    const box=wrap.querySelector('[role="dialog"]'), saveButton=wrap.querySelector('[data-save]'), errorBox=wrap.querySelector('[data-dialog-error]');
    let busy=false;
    const focusables=()=>[...wrap.querySelectorAll('button,input:not([type="hidden"]),select,textarea,a[href],[tabindex]')].filter(node=>!node.disabled&&!node.hidden&&!node.closest('[hidden]')&&node.tabIndex>=0);
    function close() {
      if(busy)return;
      wrap.remove();document.removeEventListener('keydown',keys);
      const target=former?.isConnected?former:former?.id?document.getElementById(former.id):null;
      target?.focus();
    }
    function keys(event) {
      if(!wrap.isConnected){document.removeEventListener('keydown',keys);return;}
      if([...document.querySelectorAll('.modal-backdrop,.sys-modal-backdrop,.op-modal-backdrop')].at(-1)!==wrap)return;
      if(event.key==='Escape'){event.preventDefault();close();}
      if(event.key==='Tab'){
        const nodes=focusables(), first=nodes[0], last=nodes.at(-1);
        if(!first){event.preventDefault();box.focus();}
        else if(event.shiftKey&&(document.activeElement===first||!wrap.contains(document.activeElement))){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!wrap.contains(document.activeElement))){event.preventDefault();first.focus();}
      }
    }
    const fail=error=>{errorBox.hidden=false;errorBox.textContent=error?.message||'The change could not be saved. Review the form and try again.';};
    wrap.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
    wrap.addEventListener('click',event=>{if(event.target===wrap)close();});
    saveButton.onclick=()=>{
      if(busy)return;
      errorBox.hidden=true;errorBox.textContent='';
      const invalid=[...wrap.querySelectorAll('input,select,textarea')].find(node=>!node.disabled&&node.type!=='hidden'&&!node.closest('[hidden]')&&!node.checkValidity());
      if(invalid){invalid.reportValidity();invalid.focus();fail(new Error(invalid.validationMessage));return;}
      try{
        const result=onSave?.(wrap);
        if(result&&typeof result.then==='function'){
          busy=true;box.setAttribute('aria-busy','true');
          const controls=[...wrap.querySelectorAll('button,input,select,textarea')], disabled=controls.map(node=>node.disabled);
          controls.forEach(node=>node.disabled=true);
          Promise.resolve(result).then(ok=>{busy=false;if(ok!==false)close();},fail).finally(()=>{busy=false;box.removeAttribute('aria-busy');controls.forEach((node,index)=>node.disabled=disabled[index]);});
        }else if(result!==false)close();
      }catch(error){fail(error);}
    };
    box.tabIndex=-1;document.addEventListener('keydown',keys);
    (wrap.querySelector('input:not([type="hidden"]),select,textarea')||saveButton).focus();
    return wrap;
  }
  window.addEventListener('stark:storage-error',event=>notice(event.detail.message,true));
  window.StarkSystemUI={notice,escape,glyph,dialog};
  // Deferred scripts run at "interactive" before DOMContentLoaded. Module listeners
  // build their page body at that event, so mount the shared chrome after them.
  if(document.readyState==='complete')start();
  else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
