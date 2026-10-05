(function () {
  'use strict';
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
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.data}"/></svg>`;
  };
  function groups() {
    const region = S.getRegion(), suffix = region.toLowerCase();
    return [
      ['planning','Inventory & planning',[
        ['regional-workspace.html?workspace='+region,'Regional workspace'],
        [`inventory-dashboard-${suffix}.html`,'Inventory dashboard'],
        [`inventory-analysis-report-${suffix}.html`,'Analysis report'],
        [`decision-intelligence-${suffix}.html`,'Decision intelligence'],
        [`raw-report-${suffix}.html`,'Raw report & upload'],
        [`reorder-report-${suffix}.html`,'Reorder report'],
        [`active-brands-${suffix}.html`,'Active brands'],
        ...(region==='EU'?[['ats-eu.html','Available to sell']]:[]),
        ['sales-analysis.html?region='+region,'Sales analysis'],
        ['procurement-planning.html','Reorder to purchase order']
      ]],
      ['crm','Customers & CRM', [['crm/index.html','CRM dashboard'],['crm/accounts.html','Accounts & programs'],['crm/catalog.html','Catalog & pricing'],['crm/partner-portal.html','Partner portal']]],
      ['orders','Order management',[['order-management/index.html','Order control tower'],['order-management/new-order.html','Create customer order'],['order-management/hold-redemption.html','Hold & redemption'],['order-management/bulk-firm.html','Bulk & firm orders'],['events.html?region='+region,'Event planning'],['events-tv.html?region='+region,'Events display']]],
      ['vendor','Vendors & purchasing',[['vendor-management/index.html','Vendor dashboard'],['vendor-management/vendors.html','Vendor master'],['vendor-po-management.html','Vendor purchase orders'],['vendor-management/procurement.html','Procurement & receiving'],['vendor-management/sla.html','Supplier performance'],['vendor-management/digital-vault.html','Digital rewards']]],
      ['warehouse','Warehouse management',[['warehouse-management/index.html','Warehouse control tower'],['warehouse-management/inventory-bins.html','Stock & locations'],['warehouse-management/receiving.html','Receiving & putaway'],['warehouse-management/wave-picking.html','Wave picking'],['warehouse-management/packing-dispatch.html','Packing & dispatch'],['warehouse-management/cycle-counts.html','Cycle counts']]],
      ['logistics','3PL & transportation',[['3pl-management/index.html','3PL control tower'],['3pl-management/network.html','Partner network & stock'],['3pl-management/routing.html','Order routing'],['3pl-management/shipments.html','Partner shipments'],['3pl-management/reconciliation.html','Reconciliation & SLA'],['3pl-management/integrations.html','Integration contracts'],['freight-estimator.html','Freight estimator'],['freight-consolidate.html','Freight consolidation'],['shipment-tracking.html','Shipment tracking']]],
      ['data','System & data',[['data-center.html','Data center & backups'],['activity.html','Audit activity'],[`instructions-${suffix}.html`,'Regional instructions']]]
    ];
  }
  const currentPath = location.pathname;
  const navigationPath = currentPath.replace(/\/warehouse-management\/cycle-count\.html$/, '/warehouse-management/cycle-counts.html');
  const active = path => new URL(path,S.rootURL).pathname === navigationPath;
  function links(items) { return items.map(([path,label])=>`<a href="${S.url(path)}" ${active(path)?'class="active" aria-current="page"':''}>${escape(label)}</a>`).join(''); }
  function renderNavigation() {
    const nav = document.querySelector('#system-navigation'); if (!nav) return;
    const homeActive = active('index.html') || active('business-operations.html');
    nav.innerHTML = `<a class="system-home ${homeActive?'active':''}" ${homeActive?'aria-current="page"':''} href="${S.url('index.html')}">${glyph('home')}<span>Enterprise control tower</span></a>` + groups().map(([id,label,items])=>`<details data-nav-group="${id}" ${items.some(([path])=>active(path))?'open':''}><summary>${glyph(id)}<span>${label}</span><span class="system-chevron">⌄</span></summary><div class="system-subnav">${links(items)}</div></details>`).join('');
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
      ...s.enterprise.orders.map(x=>({label:x.po,kind:'Customer order · '+x.status.replaceAll('_',' '),path:'order-management/index.html?search='+encodeURIComponent(x.po),hay:x.po})),
      ...s.enterprise.purchaseOrders.map(x=>({label:x.po,kind:'Vendor PO · '+x.status,path:'vendor-management/procurement.html',hay:x.po})),
      ...s.enterprise.inventory.map(x=>({label:x.model+' · '+x.brand,kind:'SKU · '+x.region,path:'crm/catalog.html',hay:x.sku+' '+x.model+' '+x.brand+' '+x.title}))
    ].filter(x=>String(x.hay).toLowerCase().includes(q));
    return [...routeMatches,...records].slice(0,12);
  }
  function start() {
    if (document.body.classList.contains('tv-view') || document.querySelector('.tv-app') || /\/(login|auth-callback|cloud-agent)\.html$/.test(currentPath)) return;
    if (document.querySelector('#system-sidebar')) return;
    const sidebar = document.createElement('aside'); sidebar.className='system-sidebar'; sidebar.id='system-sidebar'; sidebar.setAttribute('aria-label','Enterprise navigation');
    sidebar.innerHTML=`<a class="system-brand" href="${S.url('index.html')}"><img src="${S.url('assets/supply-chain-logo.png')}" alt=""><span><small>STARK PREMIUM</small><strong>Supply Chain<br>Intelligence</strong></span></a><div class="system-workspace-label">ENTERPRISE WORKSPACE</div><nav id="system-navigation"></nav><div class="system-sidebar-footer"><span id="system-data-status"></span><a href="${S.url('data-center.html')}">Manage workspace</a></div>`;
    const header = document.createElement('header'); header.className='system-header';
    header.innerHTML=`<button class="system-menu" aria-label="Open navigation" aria-controls="system-sidebar" aria-expanded="false">☰</button><div class="system-breadcrumb"><b>${escape(document.title.split(/[·|]/)[0].trim())}</b></div><div class="system-search"><label class="visually-hidden" for="system-search-input">Search pages and records</label>${glyph('search')}<input id="system-search-input" placeholder="Search customers, orders, SKUs…" autocomplete="off"><div class="system-search-results" hidden></div></div><label class="system-region"><span>Analysis region</span><select id="system-region-select" aria-label="Analysis region"><option value="US">US</option><option value="EU">EU</option><option value="CA">Canada</option></select></label><a class="system-account" href="${S.url('login.html?return='+encodeURIComponent(currentPath.slice(S.rootURL.pathname.length)+location.search))}" aria-label="Sign in to workspace">S</a>`;
    const scrim = document.createElement('button'); scrim.className='system-scrim'; scrim.setAttribute('aria-label','Close navigation');
    document.body.prepend(scrim, sidebar, header);
    document.body.classList.add('stark-system');
    renderNavigation();
    const select = header.querySelector('select'); select.value=S.getRegion();
    select.addEventListener('change',()=>{
      localStorage.setItem('stark-selected-region',select.value); renderNavigation(); window.dispatchEvent(new CustomEvent('stark:region-change',{detail:{region:select.value}}));
      const relative = currentPath.slice(S.rootURL.pathname.length);
      if (/-((us)|(eu)|(ca))\.html$/.test(relative)) location.href=S.url(relative.replace(/-(us|eu|ca)\.html$/,`-${select.value.toLowerCase()}.html`));
      else if (relative==='events.html') location.href=S.url('events.html?region='+select.value);
      else if (relative==='sales-analysis.html' || relative==='regional-workspace.html') location.href=S.url(relative+'?'+(relative==='sales-analysis.html'?'region=':'workspace=')+select.value);
    });
    window.addEventListener('stark:region-change',()=>{select.value=S.getRegion();renderNavigation();});
    const toggle = header.querySelector('.system-menu');
    const close = () => {document.body.classList.remove('system-nav-open'); toggle.setAttribute('aria-expanded','false');};
    toggle.onclick=()=>{const open=document.body.classList.toggle('system-nav-open');toggle.setAttribute('aria-expanded',String(open));}; scrim.onclick=close;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();header.querySelector('.system-search-results').hidden=true;}});
    const input=header.querySelector('input'), results=header.querySelector('.system-search-results');
    input.addEventListener('input',()=>{const rows=search(input.value);results.hidden=!input.value.trim();results.innerHTML=rows.length?rows.map(x=>`<a href="${S.url(x.path)}"><b>${escape(x.label)}</b><small>${escape(x.kind)}</small></a>`).join(''):'<p>No matching pages or records</p>';});
    document.addEventListener('click',e=>{if(!e.target.closest('.system-search'))results.hidden=true;});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&results.querySelector('a'))location.href=results.querySelector('a').href;});
    const status=()=>{const s=S.getState();document.querySelector('#system-data-status').textContent=s.mode==='sample'?'Sample workspace · saved in this browser':'Working workspace · saved in this browser';};status();window.addEventListener('stark:system-change',status);
    window.addEventListener('error',e=>{if(/storage|newer changes/i.test(e.message||''))notice(e.message,true);});
    // Query-region links select the matching analysis region without changing operations.
    const suffix=currentPath.match(/-(us|eu|ca)\.html$/), query=new URLSearchParams(location.search), wanted=suffix?.[1]||query.get('region')||query.get('workspace');
    if(wanted){localStorage.setItem('stark-selected-region',S.regionCode(wanted));select.value=S.getRegion();renderNavigation();}
  }
  window.StarkSystemUI={notice,escape,glyph};
  // Deferred scripts run at "interactive" before DOMContentLoaded. Module listeners
  // build their page body at that event, so mount the shared chrome after them.
  if(document.readyState==='complete')start();
  else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
