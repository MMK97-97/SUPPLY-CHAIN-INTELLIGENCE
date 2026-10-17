(function () {
  'use strict';
  // Application data stays inside the selected workspace; auth storage is separate.
  const localStorage = window.StarkWorkspace?.localStorage || window.localStorage;

  const S = window.StarkSystem;
  if (!S) return;
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const glyph = name => {
    const paths = {
      home: '<path d="M3 10l9-7 9 7v10H3z M9 20v-7h6v7"/>',
      itemMaster: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      planning: '<path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/>',
      crm: '<path d="M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M16 4a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-3 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"/>',
      orders: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      vendor: '<path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6 M8 10h1m6 0h1"/>',
      procurement: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6m-6 6l2 2 4-4"/>',
      shipping: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>',
      warehouse: '<path d="M3 21V8l9-5 9 5v13M7 21V11h10v10M7 15h10m-10 3h10"/>',
      tpl: '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2.5"/><circle cx="20" cy="6" r="2.5"/><circle cx="4" cy="18" r="2.5"/><circle cx="20" cy="18" r="2.5"/><line x1="6.5" y1="7" x2="9.5" y2="10"/><line x1="17.5" y1="7" x2="14.5" y2="10"/><line x1="6.5" y1="17" x2="9.5" y2="14"/><line x1="17.5" y1="17" x2="14.5" y2="14"/>',
      transportation: '<path d="M2 17h2m16 0h2M4 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm12 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM4 17H2V6a2 2 0 0 1 2-2h11v13M15 8h4l3 4v5h-2"/>',
      analytics: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
      data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
      bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      chevron: '<polyline points="6 9 12 15 18 9"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.data}</svg>`;
  };

  function bannerSvg(id, color) {
    const banners = {
      itemMaster: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#042738"/><path d="M40 20h280M40 40h280M40 60h280" stroke="#0ea5e9" stroke-opacity="0.1"/><circle cx="50" cy="40" r="12" fill="#0369a1"/><circle cx="120" cy="40" r="12" fill="#0284c7"/><circle cx="190" cy="40" r="12" fill="#0ea5e9"/><circle cx="260" cy="40" r="12" fill="#38bdf8"/><text x="342" y="70" text-anchor="end" fill="#bae6fd" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">ENTERPRISE ITEM MASTER &amp; ATS</text></svg>',
      planning: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#042e2b"/><path d="M0 20h360M0 40h360M0 60h360" stroke="#10b981" stroke-opacity="0.08"/><path d="M20 68 Q100 64, 150 44 T260 28 T340 16 L340 80 L20 80 Z" fill="#10b981" fill-opacity="0.2"/><path d="M20 68 Q100 64, 150 44 T260 28 T340 16" stroke="#10b981" stroke-width="2.5"/><circle cx="150" cy="44" r="3.5" fill="#34d399"/><circle cx="260" cy="28" r="3.5" fill="#34d399"/><circle cx="340" cy="16" r="4" fill="#a7f3d0"/><text x="342" y="70" text-anchor="end" fill="#6ee7b7" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">DEMAND &amp; REORDER LAB</text></svg>',
      crm: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#0a1d3d"/><path d="M45 40 L110 22 L190 48 L265 26 L325 44" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="45" cy="40" r="11" fill="#1d4ed8"/><circle cx="110" cy="22" r="9" fill="#1e40af"/><circle cx="190" cy="48" r="13" fill="#2563eb"/><circle cx="265" cy="26" r="10" fill="#1e40af"/><circle cx="325" cy="44" r="9" fill="#1d4ed8"/><text x="342" y="70" text-anchor="end" fill="#93c5fd" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">PARTNER CRM &amp; CATALOGS</text></svg>',
      orders: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#2a140b"/><line x1="20" y1="54" x2="340" y2="54" stroke="#f97316" stroke-width="2"/><rect x="50" y="30" width="26" height="22" rx="2" fill="#431407" stroke="#f97316"/><rect x="110" y="22" width="34" height="30" rx="3" fill="#431407" stroke="#f97316"/><rect x="180" y="32" width="24" height="20" rx="2" fill="#431407" stroke="#f97316"/><rect x="235" y="20" width="38" height="32" rx="3" fill="#431407" stroke="#f97316"/><line x1="254" y1="4" x2="254" y2="52" stroke="#ffedd5" stroke-width="1.8" stroke-dasharray="4 2"/><text x="342" y="70" text-anchor="end" fill="#fed7aa" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">ALLOCATION &amp; PACKAGING</text></svg>',
      vendor: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#1e1035"/><line x1="0" y1="58" x2="360" y2="58" stroke="#8b5cf6" stroke-width="1.5"/><path d="M40 58 L55 34 L70 58 L85 34 L100 58 L140 58 L140 26 L170 26 L170 58" fill="#2e1065" stroke="#a78bfa" stroke-width="1.4"/><path d="M210 58 L225 38 L295 38 L310 58 Z" fill="#3b0764" stroke="#c4b5fd" stroke-width="1.5"/><text x="342" y="70" text-anchor="end" fill="#ddd6fe" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">SUPPLIER MASTER &amp; SLA</text></svg>',
      procurement: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#2a1604"/><rect x="40" y="14" width="40" height="50" rx="4" fill="#451a03" stroke="#f59e0b" stroke-width="1.5"/><line x1="48" y1="28" x2="72" y2="28" stroke="#fbbf24" stroke-width="1.5"/><line x1="48" y1="38" x2="72" y2="38" stroke="#fbbf24" stroke-width="1.5"/><path d="M110 38 L220 38" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5 3"/><polygon points="225,38 215,33 215,43" fill="#f59e0b"/><rect x="240" y="16" width="48" height="44" rx="4" fill="#451a03" stroke="#fbbf24" stroke-width="1.4"/><text x="342" y="70" text-anchor="end" fill="#fde68a" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">PO MANAGEMENT &amp; RECEIVING</text></svg>',
      shipping: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#2d0a12"/><line x1="0" y1="56" x2="360" y2="56" stroke="#ef4444" stroke-width="1.5"/><line x1="30" y1="42" x2="120" y2="42" stroke="#fca5a5" stroke-width="1.2" stroke-dasharray="8 6"/><rect x="130" y="24" width="65" height="30" rx="3" fill="#4c0519" stroke="#ef4444" stroke-width="1.5"/><path d="M195 34 L210 34 L218 44 L218 54 L195 54 Z" fill="#9f1239" stroke="#f87171" stroke-width="1.5"/><circle cx="150" cy="56" r="6" fill="#1c1917" stroke="#ef4444" stroke-width="2"/><circle cx="180" cy="56" r="6" fill="#1c1917" stroke="#ef4444" stroke-width="2"/><circle cx="204" cy="56" r="6" fill="#1c1917" stroke="#ef4444" stroke-width="2"/><text x="342" y="70" text-anchor="end" fill="#fecdd3" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">SARASOTA CARRIER DISPATCH</text></svg>',
      warehouse: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#082338"/><g transform="translate(30,10)" stroke="#0284c7" stroke-width="1.4"><rect x="0" y="0" width="70" height="54" fill="none"/><line x1="0" y1="18" x2="70" y2="18"/><line x1="0" y1="36" x2="70" y2="36"/><line x1="35" y1="0" x2="35" y2="54"/><rect x="5" y="22" width="24" height="10" fill="#075985" rx="1"/><rect x="40" y="4" width="24" height="10" fill="#0284c7" rx="1"/></g><g transform="translate(130,10)" stroke="#0284c7" stroke-width="1.4"><rect x="0" y="0" width="70" height="54" fill="none"/><line x1="0" y1="18" x2="70" y2="18"/><line x1="0" y1="36" x2="70" y2="36"/><line x1="35" y1="0" x2="35" y2="54"/><rect x="5" y="4" width="24" height="10" fill="#38bdf8" rx="1"/><rect x="40" y="22" width="24" height="10" fill="#0284c7" rx="1"/></g><circle cx="270" cy="38" r="14" fill="#0c4a6e" stroke="#38bdf8" stroke-width="1.8"/><path d="M270 29 v10 l7 5" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round"/><text x="342" y="70" text-anchor="end" fill="#bae6fd" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">CONTROL TOWER, BINS &amp; WAVES</text></svg>',
      tpl: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#032a24"/><path d="M50 40 L130 22 L200 52 L280 28 L330 46" stroke="#10b981" stroke-width="1.6" stroke-dasharray="4 3"/><circle cx="50" cy="40" r="11" fill="#047857" stroke="#6ee7b7" stroke-width="1.8"/><circle cx="130" cy="22" r="14" fill="#059669" stroke="#a7f3d0" stroke-width="2"/><text x="130" y="26" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">API</text><circle cx="200" cy="52" r="12" fill="#047857" stroke="#6ee7b7" stroke-width="1.8"/><circle cx="280" cy="28" r="13" fill="#059669" stroke="#a7f3d0" stroke-width="1.8"/><text x="280" y="32" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">3PL</text><text x="342" y="70" text-anchor="end" fill="#a7f3d0" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">DISTRIBUTED 3PL NETWORK</text></svg>',
      transportation: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#0a1a38"/><polygon points="120,80 240,80 190,40 170,40" fill="#172554"/><line x1="180" y1="42" x2="180" y2="80" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="6 4"/><rect x="40" y="28" width="52" height="24" rx="2" fill="#1e3a8a" stroke="#3b82f6" stroke-width="1.4"/><circle cx="52" cy="52" r="4.5" fill="#111827" stroke="#60a5fa" stroke-width="1.5"/><circle cx="80" cy="52" r="4.5" fill="#111827" stroke="#60a5fa" stroke-width="1.5"/><circle cx="280" cy="30" r="12" fill="#1d4ed8" stroke="#93c5fd" stroke-width="1.5"/><text x="342" y="70" text-anchor="end" fill="#bfdbfe" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">FREIGHT TRANSIT &amp; ROUTING</text></svg>',
      analytics: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#2c1a04"/><rect x="40" y="42" width="12" height="28" rx="2" fill="#ca8a04"/><rect x="60" y="32" width="12" height="38" rx="2" fill="#eab308"/><rect x="80" y="44" width="12" height="26" rx="2" fill="#a16207"/><rect x="100" y="26" width="12" height="44" rx="2" fill="#facc15"/><rect x="120" y="36" width="12" height="34" rx="2" fill="#eab308"/><path d="M160 50 Q200 36, 240 40 T310 18" stroke="#fde047" stroke-width="2.5" fill="none"/><circle cx="310" cy="18" r="3.5" fill="#fef08a"/><text x="342" y="70" text-anchor="end" fill="#fef08a" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">EXECUTIVE REVENUE &amp; DEMAND</text></svg>',
      data: '<svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="80" fill="#0f172a"/><g transform="translate(45,14)" stroke="#64748b" stroke-width="1.4" fill="#1e293b"><rect width="60" height="46" rx="3"/><line x1="8" y1="12" x2="42" y2="12"/><line x1="8" y1="23" x2="42" y2="23"/><line x1="8" y1="34" x2="42" y2="34"/><circle cx="50" cy="12" r="2.5" fill="#10b981"/><circle cx="50" cy="23" r="2.5" fill="#3b82f6"/><circle cx="50" cy="34" r="2.5" fill="#10b981"/></g><g transform="translate(125,14)" stroke="#64748b" stroke-width="1.4" fill="#1e293b"><rect width="60" height="46" rx="3"/><line x1="8" y1="12" x2="42" y2="12"/><line x1="8" y1="23" x2="42" y2="23"/><line x1="8" y1="34" x2="42" y2="34"/><circle cx="50" cy="12" r="2.5" fill="#10b981"/><circle cx="50" cy="23" r="2.5" fill="#f59e0b"/><circle cx="50" cy="34" r="2.5" fill="#10b981"/></g><circle cx="265" cy="37" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="1.8"/><path d="M260 37 L264 41 L271 33" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" fill="none"/><text x="342" y="70" text-anchor="end" fill="#cbd5e1" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">DATA CENTER &amp; AUDIT TRAIL</text></svg>'
    };
    return banners[id] || banners.planning;
  }

  function groups() {
    const region = S.getRegion(), suffix = region.toLowerCase();
    return [
      ['itemMaster','Item Master','Master Catalog · ATS Feeds · Price Updates','#0284c7',[
        ['item-master.html','Item master catalog'],
        ['add-item.html','Add new item'],
        ['item-master.html?action=ats-upload','ATS upload (Brand)'],
        ['item-master.html?action=price-update','Price update (Brand)']
      ],'item-master.html',{label:'+ Add item',path:'add-item.html'}],

      ['planning','Inventory & Planning','Replenishment · Reorder · Demand','#10b981',[
        [`inventory-dashboard-${suffix}.html`,'Inventory dashboard'],
        [`decision-intelligence-${suffix}.html`,'Decision intelligence'],
        [`raw-report-${suffix}.html`,'Raw report & upload'],
        [`reorder-report-${suffix}.html`,'Reorder report',true],
        [`active-brands-${suffix}.html`,'Active brands'],
        ...(region==='EU'?[['ats-eu.html','Available to sell']]:[]),
        ['sales-analysis.html?region='+region,'Sales analysis'],
        ['procurement-planning.html','Reorder to purchase order']
      ],`inventory-dashboard-${suffix}.html`,{label:'+ Reorder report',path:`reorder-report-${suffix}.html`}],

      ['crm','Customers & CRM','Accounts · Programs · Catalogs','#3b82f6',[
        ['crm/index.html','CRM dashboard'],
        ['crm/accounts.html','Accounts & programs'],
        ['crm/catalog.html','Catalog & pricing'],
        ['crm/partner-portal.html','Partner portal']
      ],'crm/index.html',{label:'+ Add account',path:'crm/accounts.html'}],

      ['orders','Order Management','Orders · Allocation · Exceptions','#f97316',[
        ['all-open-orders.html','All open orders'],
        ['create-order.html','Create customer order'],
        ['order-management/issues.html','Order issues'],
        ['order-management/unvalidated.html','Unvalidated orders'],
        ['order-management/cancelled.html','Cancelled orders'],
        ['order-management/hold-redemption.html','Hold & redemption'],
        ['order-management/bulk-firm.html','Bulk & firm orders'],
        ['events.html?region='+region,'Event planning'],
        ['events-tv.html?region='+region,'Events display']
      ],'all-open-orders.html',{label:'+ Create customer order',path:'create-order.html'}],

      ['vendor','Vendor Management','Suppliers · Contracts · Performance','#8b5cf6',[
        ['vendor-management/index.html','Vendor dashboard'],
        ['vendor-management/vendors.html','Vendor master'],
        ['vendor-management/sla.html','Supplier performance'],
        ['vendor-management/digital-vault.html','Digital rewards']
      ],'vendor-management/index.html',{label:'+ Vendor master',path:'vendor-management/vendors.html'}],

      ['procurement','Procurement','Purchase Orders · Receiving · PO Lifecycle','#f59e0b',[
        ['procurement/index.html','Open vendor PO management'],
        ['create-vendor-po.html','Create vendor PO'],
        ['vendor-po-management.html','Event / dropship POs'],
        ['vendor-management/procurement.html','Procurement & receiving']
      ],'procurement/index.html',{label:'+ Create vendor PO',path:'create-vendor-po.html'}],

      ['shipping','Shipping','Dispatch · Sarasota Operations','#ef4444',[
        ['shipping/index.html','Ship orders · Sarasota'],
        ['shipping/daily-report.html','Daily shipment report']
      ],'shipping/index.html',{label:'+ Sarasota dispatch',path:'shipping/index.html'}],

      ['warehouse','Warehouse Management','Control Tower · Putaway · Waves · Picking','#0284c7',[
        ['warehouse-management/index.html','Warehouse control tower'],
        ['warehouse-management/inventory-bins.html','Stock & locations'],
        ['warehouse-management/receiving.html','Receiving & putaway'],
        ['warehouse-management/wave-picking.html','Wave picking'],
        ['warehouse-management/packing-dispatch.html','Packing & dispatch'],
        ['warehouse-management/cycle-counts.html','Cycle counts']
      ],'warehouse-management/index.html',{label:'+ Inbound receiving',path:'warehouse-management/receiving.html'}],

      ['tpl','3PL Management','Partners · API Transmission · Routing','#10b981',[
        ['3pl-management/index.html','3PL overview'],
        ['3pl-management/order-history.html','Order history & processing API'],
        ['3pl-management/shipment-requests.html','Shipment requests'],
        ['3pl-management/orders.html','Manage 3PL orders'],
        ['3pl-management/ship-orders.html','Ship 3PL orders'],
        ['3pl-management/upload-shipments.html','Upload 3PL shipments'],
        ['3pl-management/network.html','Partner network & stock'],
        ['3pl-management/routing.html','Routing workbench'],
        ['3pl-management/shipments.html','Partner shipment register'],
        ['3pl-management/reconciliation.html','Reconciliation & SLA'],
        ['3pl-management/integrations.html','API connection']
      ],'3pl-management/index.html',{label:'+ 3PL dispatch',path:'3pl-management/ship-orders.html'}],

      ['transportation','Transportation','Freight · Consolidation · Tracking','#2563eb',[
        ['transportation/index.html','Transportation overview'],
        ['freight-estimator.html','Freight estimator'],
        ['freight-consolidate.html','Freight consolidation'],
        ['shipment-tracking.html','Shipment tracking']
      ],'transportation/index.html',{label:'+ Estimate freight',path:'freight-estimator.html'}],

      ['analytics','Analytics & Reports','Intelligence · Reports · Forecasts','#eab308',[
        ['business-operations.html','Executive dashboard'],
        ['sales-analysis.html','Sales & demand analysis'],
        [`decision-intelligence-${suffix}.html`,'Inventory analytics'],
        ['vendor-management/sla.html','Supplier performance'],
        ['freight-estimator.html','Freight spend analysis'],
        [`raw-report-${suffix}.html`,'Custom reports'],
        ['data-center.html','Data export & automation']
      ],'business-operations.html',{label:'+ Executive report',path:'business-operations.html'}],

      ['data','System & Data','Data Center · Backups · Audit Activity','#475569',[
        ['data-center.html','Data center & backups'],
        ['activity.html','Audit activity'],
        [`instructions-${suffix}.html`,'Regional instructions']
      ],'data-center.html',{label:'+ Audit activity',path:'activity.html'}]
    ];
  }

  const currentPath = location.pathname;
  const initialQuery = new URLSearchParams(location.search);
  const initialRegion = currentPath.match(/-(us|eu|ca)\.html$/)?.[1] || initialQuery.get('region') || initialQuery.get('workspace');
  if (initialRegion) localStorage.setItem('stark-selected-region', S.regionCode(initialRegion));
  const relativePath = currentPath.slice(S.rootURL.pathname.length);
  const navigationPath = currentPath.replace(/\/warehouse-management\/cycle-count\.html$/, '/warehouse-management/cycle-counts.html');
  const active = path => new URL(path, S.rootURL).pathname === navigationPath;

  function regionFlag(code) {
    const flags = { US: '🇺🇸', EU: '🇪🇺', CA: '🇨🇦' };
    return flags[code] || '🇺🇸';
  }

  function regionName(code) {
    const names = { US: 'United States', EU: 'European Union', CA: 'Canada' };
    return names[code] || 'United States';
  }

  let currentActiveModuleId = 'home';

  function renderSubnav(targetId) {
    const subBar = document.querySelector('#system-submodule-bar');
    if (!subBar) return;

    const isHome = active('workspace.html') || active('index.html') || targetId === 'home';
    if (isHome) {
      subBar.hidden = true;
      subBar.style.display = 'none';
      subBar.innerHTML = '';
      document.body.classList.add('is-home');
      return;
    }

    const all = groups();
    let group = all.find(([id]) => id === targetId);
    if (!group) {
      subBar.hidden = true;
      subBar.style.display = 'none';
      subBar.innerHTML = '';
      document.body.classList.add('is-home');
      return;
    }

    document.body.classList.remove('is-home');
    subBar.hidden = false;
    subBar.style.display = '';

    const [id, label, subtitle, color, items, primaryUrl, quickAction] = group;
    subBar.innerHTML = `
      <div class="system-subnav-badge" style="--mod-accent:${color}">
        <span class="system-tab-icon" style="--tab-color:${color}">${glyph(id)}</span>
        <span>${escape(label)}</span>
      </div>
      <span class="system-subnav-divider"></span>
      <div class="system-subnav-list">
        ${items.map(([path, itemLabel, isHot]) => `
          <a href="${S.url(path)}" class="system-subnav-item ${active(path) ? 'active' : ''}" ${active(path) ? 'aria-current="page"' : ''}>
            <span>${escape(itemLabel)}</span>
            ${isHot ? '<span class="system-subnav-pill">Active</span>' : ''}
          </a>
        `).join('')}
      </div>
    `;
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.system-region-menu, .system-account-menu').forEach(el => el.hidden = true);
    document.querySelectorAll('.system-region-btn, .system-account-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  }

  function renderNavigation() {
    const nav = document.querySelector('#system-navigation');
    const homeActive = active('workspace.html') || active('index.html');
    if (nav) {
      nav.innerHTML = `<a class="system-home ${homeActive?'active':''}" ${homeActive?'aria-current="page"':''} href="${S.url('workspace.html')}">${glyph('home')}<span>Overview</span></a>` +
        groups().map(([id, label, , , items]) => `<details data-nav-group="${id}" ${items.some(([path])=>active(path))?'open':''}><summary>${glyph(id)}<span>${label}</span><span class="system-chevron">⌄</span></summary><div class="system-subnav">${items.map(([path,l])=>`<a href="${S.url(path)}" ${active(path)?'class="active" aria-current="page"':''}>${escape(l)}</a>`).join('')}</div></details>`).join('');
    }

    const tabs = document.querySelector('#system-module-tabs');
    if (tabs) {
      const allGroups = groups();
      let html = `
        <div class="system-module-item">
          <a class="system-module-tab home-tab ${homeActive ? 'active' : ''}" href="${S.url('workspace.html')}" aria-label="Home Overview">
            <span class="system-tab-icon" style="--tab-color:#0d9488">${glyph('home')}</span>
            <span class="system-tab-label">Home</span>
          </a>
        </div>
      `;

      allGroups.forEach(([id, label, subtitle, color, items, primaryUrl]) => {
        const isGroupActive = items.some(([path]) => active(path)) || active(primaryUrl);
        html += `
          <div class="system-module-item" data-module-id="${id}">
            <a class="system-module-tab ${isGroupActive ? 'active' : ''}" href="${S.url(primaryUrl)}" aria-label="${escape(label)}">
              <span class="system-tab-icon" style="--tab-color:${color}">${glyph(id)}</span>
              <span class="system-tab-label">${escape(label)}</span>
            </a>
          </div>
        `;
      });

      tabs.innerHTML = html;

      const activeGroup = allGroups.find(([id, label, subtitle, color, items, primaryUrl]) =>
        items.some(([path]) => active(path)) || active(primaryUrl)
      );
      currentActiveModuleId = activeGroup ? activeGroup[0] : (homeActive ? 'home' : (allGroups[0] ? allGroups[0][0] : 'planning'));
      renderSubnav(currentActiveModuleId);
    }
  }

  function notice(message, error = false) {
    const node = document.createElement('div');
    node.className = 'system-toast' + (error ? ' error' : '');
    node.setAttribute('role', error ? 'alert' : 'status');
    node.textContent = message;
    document.body.append(node);
    setTimeout(() => node.remove(), 5000);
  }

  function search(query) {
    const q = query.toLowerCase().trim(), s = S.getState();
    if (!q) return [];
    const routeMatches = groups().flatMap(([, group, , , items]) => items.map(([path, label]) => ({ label, kind: group, path }))).filter(x => x.label.toLowerCase().includes(q));
    const records = [
      ...s.enterprise.accounts.map(x => ({ label: x.name, kind: 'Customer Account', path: 'crm/accounts.html', hay: x.name + ' ' + x.email })),
      ...s.enterprise.vendors.map(x => ({ label: x.name, kind: 'Vendor', path: 'vendor-management/vendors.html', hay: x.name + ' ' + x.email })),
      ...s.enterprise.orders.map(x => ({ label: (x.po || x.orderNumber || 'Order') + ' · ' + (x.status || '').replaceAll('_', ' '), kind: 'Customer Order', path: 'order-management/index.html?search=' + encodeURIComponent(x.po), hay: [x.po, x.id, x.orderNumber, x.tracking, x.createdAt, x.inHandsDate, ...x.lines.flatMap(l => [l.model, l.sku])].filter(Boolean).join(' ') })),
      ...s.enterprise.purchaseOrders.map(x => ({ label: x.po + ' · ' + (x.status || ''), kind: 'Vendor PO', path: 'vendor-management/procurement.html', hay: x.po })),
      ...s.enterprise.inventory.map(x => ({ label: x.model + ' · ' + x.brand, kind: 'SKU · ' + x.region, path: 'item-master.html?search=' + encodeURIComponent(x.model || x.sku), hay: x.sku + ' ' + x.model + ' ' + x.brand + ' ' + x.title }))
    ].filter(x => String(x.hay).toLowerCase().includes(q));
    return [...routeMatches, ...records].slice(0, 14);
  }

  function start() {
    if (document.body.classList.contains('tv-view') || document.querySelector('.tv-app') || /\/(login|auth-callback|cloud-agent)\.html$/.test(currentPath)) return;
    if (document.querySelector('.system-header')) return;

    const W = window.StarkWorkspace;
    const currentRegion = S.getRegion();
    const allGroups = groups();

    const header = document.createElement('header');
    header.className = 'system-header';
    header.innerHTML = `
      <!-- Brand Block -->
      <a class="system-brand" href="${S.url('workspace.html')}" aria-label="STARK Premium Supply Chain Intelligence Home">
        <span class="system-wordmark">SK<span>◆</span></span>
        <div class="system-brand-text">
          <b>STARK PREMIUM</b>
          <small>Supply Chain Intelligence</small>
        </div>
      </a>

      <!-- Center Global Search Pill -->
      <div class="system-search" role="search">
        <span class="system-search-icon">${glyph('search')}</span>
        <input id="system-search-input" placeholder="Search accounts, orders, products, vendors, shipments..." autocomplete="off" aria-label="Global system search">
        <kbd class="system-search-kbd">Ctrl K</kbd>
        <div class="system-search-results" id="system-search-results" hidden></div>
      </div>

      <!-- Right Header Actions -->
      <div class="system-header-right">
        <!-- Region Selector -->
        <div class="system-region-picker" id="system-region-picker">
          <button type="button" class="system-region-btn" id="system-region-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="Analysis Region">
            <span class="system-region-flag" id="system-region-flag">${regionFlag(currentRegion)}</span>
            <span class="system-region-name" id="system-region-name">${regionName(currentRegion)}</span>
            <span class="system-caret">▾</span>
          </button>
          <ul class="system-region-menu" id="system-region-menu" hidden role="listbox">
            <li role="option" data-region="US" ${currentRegion==='US'?'aria-selected="true" class="selected"':''}>
              <span>🇺🇸</span><strong>United States</strong><small>USD ($)</small>
            </li>
            <li role="option" data-region="EU" ${currentRegion==='EU'?'aria-selected="true" class="selected"':''}>
              <span>🇪🇺</span><strong>European Union</strong><small>EUR (€)</small>
            </li>
            <li role="option" data-region="CA" ${currentRegion==='CA'?'aria-selected="true" class="selected"':''}>
              <span>🇨🇦</span><strong>Canada</strong><small>CAD ($)</small>
            </li>
          </ul>
          <select id="system-region-select" aria-label="Analysis Region" style="display:none">
            <option value="US" ${currentRegion==='US'?'selected':''}>US</option>
            <option value="EU" ${currentRegion==='EU'?'selected':''}>EU</option>
            <option value="CA" ${currentRegion==='CA'?'selected':''}>CA</option>
          </select>
        </div>

        <!-- Notification Bell -->
        <a class="system-icon-action system-alert-btn" href="${S.url('activity.html')}" aria-label="View activity alerts and exceptions" title="12 open alerts and exceptions">
          ${glyph('bell')}
          <span class="system-alert-count" id="system-alert-count">12</span>
        </a>

        <!-- User Avatar Circle -->
        <div class="system-account-picker" id="system-account-picker">
          <button type="button" class="system-account-btn" id="system-account-btn" aria-haspopup="menu" aria-expanded="false" aria-label="User Profile &amp; Workspace">
            <span>SC</span>
          </button>
          <div class="system-account-menu" id="system-account-menu" hidden role="menu">
            <div class="system-account-header">
              <strong>Supply Chain Director</strong>
              <small>${W?.isDemo ? 'Demo Workspace · Fictional Data' : 'Working Workspace · Connected'}</small>
            </div>
            <button type="button" class="system-account-item" id="system-workspace-button">
              🔄 Switch Workspace (${W?.isDemo ? 'Working Mode' : 'Demo Mode'})
            </button>
            <a href="${S.url('data-center.html')}" class="system-account-item">⚙️ Data Center &amp; Backups</a>
            <a href="${S.url('activity.html')}" class="system-account-item">📋 Audit Log &amp; Exceptions</a>
            <button type="button" class="system-account-item danger" id="system-signout-btn">🚪 Sign Out</button>
          </div>
        </div>
      </div>
    `;

    const rail = document.createElement('nav');
    rail.id = 'system-module-tabs';
    rail.className = 'system-module-tabs';
    rail.setAttribute('aria-label', 'Enterprise Operations Modules');

    const subnav = document.createElement('nav');
    subnav.id = 'system-submodule-bar';
    subnav.className = 'system-submodule-bar';
    subnav.setAttribute('aria-label', 'Active Module Navigation');

    const isHomePage = active('workspace.html') || active('index.html');
    if (isHomePage) {
      subnav.hidden = true;
      subnav.style.display = 'none';
      document.body.classList.add('is-home');
    }

    const scrim = document.createElement('button');
    scrim.className = 'system-scrim';
    scrim.setAttribute('aria-label', 'Close menu');
    scrim.hidden = true;

    const skip = document.createElement('a');
    skip.className = 'system-layout-skip';
    skip.textContent = 'Skip to workspace';
    const main = document.querySelector('main');
    if (main) {
      main.id ||= 'workspace-main';
      main.setAttribute('tabindex', '-1');
      skip.href = '#' + main.id;
    }

    // Mount header, top module buttons rail, and sub-options banner
    document.body.prepend(skip, header, rail, subnav, scrim);
    document.body.classList.add('stark-system');

    const footer = document.createElement('footer');
    footer.className = 'system-workspace-footer';
    footer.innerHTML = '<span id="system-data-status"></span><span>STARK Premium Supply Chain Intelligence · Portfolio Edition</span>';
    document.body.append(footer);

    renderNavigation();

    // Setup Region Picker Interactive Menu
    const regionBtn = header.querySelector('#system-region-btn');
    const regionMenu = header.querySelector('#system-region-menu');
    const select = header.querySelector('#system-region-select');

    if (regionBtn && regionMenu) {
      regionBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = regionMenu.hidden;
        closeAllDropdowns();
        if (open) {
          regionMenu.hidden = false;
          regionBtn.setAttribute('aria-expanded', 'true');
        }
      };

      regionMenu.querySelectorAll('[data-region]').forEach(opt => {
        opt.onclick = () => {
          const newRegion = opt.dataset.region;
          select.value = newRegion;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          closeAllDropdowns();
        };
      });
    }

    // Setup Account Menu
    const accountBtn = header.querySelector('#system-account-btn');
    const accountMenu = header.querySelector('#system-account-menu');
    if (accountBtn && accountMenu) {
      accountBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = accountMenu.hidden;
        closeAllDropdowns();
        if (open) {
          accountMenu.hidden = false;
          accountBtn.setAttribute('aria-expanded', 'true');
        }
      };
    }

    // Close all menus on outside click or Escape
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.system-region-picker, .system-account-picker, .system-search')) {
        closeAllDropdowns();
        const searchResults = header.querySelector('#system-search-results');
        if (searchResults) searchResults.hidden = true;
      }
    });

    // Intercept navigation links for ATS upload and Price update
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href*="action=ats-upload"], a[href*="action=price-update"]');
      if (link) {
        const href = link.getAttribute('href') || '';
        const isAts = href.includes('action=ats-upload');
        const isPrice = href.includes('action=price-update');
        const isItemMasterPage = location.pathname.endsWith('item-master.html') || document.body.dataset.systemPage === 'item-master';

        if (isItemMasterPage && window.StarkItemMaster) {
          e.preventDefault();
          if (isAts && window.StarkItemMaster.openAtsUploadModal) {
            window.StarkItemMaster.openAtsUploadModal();
          } else if (isPrice && window.StarkItemMaster.openPriceUpdateModal) {
            window.StarkItemMaster.openPriceUpdateModal();
          }
          return;
        }

        try {
          sessionStorage.setItem('stark-action-intent', isAts ? 'ats-upload' : 'price-update');
        } catch(err) {}
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllDropdowns();
        const searchResults = header.querySelector('#system-search-results');
        if (searchResults) searchResults.hidden = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const input = header.querySelector('#system-search-input');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    });

    // Handle Region Change
    select.addEventListener('change', () => {
      const val = select.value;
      localStorage.setItem('stark-selected-region', val);
      document.querySelector('#system-region-flag').textContent = regionFlag(val);
      document.querySelector('#system-region-name').textContent = regionName(val);
      regionMenu.querySelectorAll('[data-region]').forEach(el => {
        const sel = el.dataset.region === val;
        el.setAttribute('aria-selected', String(sel));
        el.classList.toggle('selected', sel);
      });
      renderNavigation();
      window.dispatchEvent(new CustomEvent('stark:region-change', { detail: { region: val } }));
      const relative = currentPath.slice(S.rootURL.pathname.length);
      const navigate = url => window.StarkNavigation ? window.StarkNavigation.navigate(url) : location.assign(url);
      if (/-(us|eu|ca)\.html$/.test(relative)) {
        navigate(S.url(relative.replace(/-(us|eu|ca)\.html$/, `-${val.toLowerCase()}.html`)));
      } else if (['events.html', 'sales-analysis.html'].includes(relative)) {
        navigate(S.url(relative + '?region=' + val));
      }
    });

    window.addEventListener('stark:region-change', () => {
      select.value = S.getRegion();
      document.querySelector('#system-region-flag').textContent = regionFlag(select.value);
      document.querySelector('#system-region-name').textContent = regionName(select.value);
      renderNavigation();
    });

    // Search Input Realtime Results
    const searchInput = header.querySelector('#system-search-input');
    const searchResults = header.querySelector('#system-search-results');
    if (searchInput && searchResults) {
      searchInput.addEventListener('input', () => {
        const rows = search(searchInput.value);
        searchResults.hidden = !searchInput.value.trim();
        searchResults.innerHTML = rows.length ? rows.map(x => `
          <a href="${S.url(x.path)}" class="system-search-item">
            <span class="system-search-badge">${escape(x.kind)}</span>
            <b class="system-search-title">${escape(x.label)}</b>
            <span class="system-search-arrow">↗</span>
          </a>
        `).join('') : '<p class="system-search-empty">No matching records found</p>';
      });

      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') searchResults.hidden = true;
        if (e.key === 'Enter') {
          const first = searchResults.querySelector('a');
          if (first) {
            window.StarkNavigation ? window.StarkNavigation.navigate(first.href) : location.assign(first.href);
          }
        }
      });
    }

    // Live status updates
    const status = () => {
      const state = S.getState(), cloud = window.StarkSystemCloud?.getStatus(), count = S.issues().length;
      const statusEl = document.querySelector('#system-data-status');
      if (statusEl) {
        statusEl.textContent = W?.isDemo ? 'DEMO · Fictional records · Saved in this browser' : cloud?.active ? cloud.status : 'Browser records · Connect organization data in Data Center';
      }
      const badge = document.querySelector('#system-alert-count');
      if (badge) {
        badge.hidden = !count;
        badge.textContent = String(count || 12);
      }
    };
    status();
    window.addEventListener('stark:system-change', status);
    window.addEventListener('stark:region-change', status);
    window.addEventListener('stark:cloud-status', status);

    const wsBtn = header.querySelector('#system-workspace-button');
    if (wsBtn) wsBtn.onclick = () => window.StarkPortfolio?.workspaceMenu();

    const signoutBtn = header.querySelector('#system-signout-btn');
    if (signoutBtn) {
      signoutBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeAllDropdowns();
        signoutBtn.disabled = true;
        signoutBtn.textContent = '🚪 Signing out…';

        try {
          if (window.StarkSystemCloud?.disconnect) window.StarkSystemCloud.disconnect();
        } catch (_) {}

        try {
          if (window.StarkAuth && typeof window.StarkAuth.signOut === 'function') {
            await window.StarkAuth.signOut();
            return;
          }
        } catch (err) {
          console.warn('StarkAuth signOut warning:', err);
        }

        try {
          if (window.supabaseAuth && typeof window.supabaseAuth.signOut === 'function') {
            await window.supabaseAuth.signOut();
            return;
          }
        } catch (_) {}

        try {
          localStorage.removeItem('stark-organization-id');
          localStorage.removeItem('stark-organization-role');
          localStorage.removeItem('stark.unifiedCloudLink.v1');
          sessionStorage.removeItem('sci.workspace.mode.v1');
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && (/^sb-.*-auth-token$|^stark-auth|^stark-session|^stark-organization/.test(k))) {
              localStorage.removeItem(k);
            }
          }
        } catch (_) {}

        const loginUrl = S.url('login.html?signedOut=1');
        if (window.StarkNavigation && typeof window.StarkNavigation.navigate === 'function') {
          window.StarkNavigation.navigate(loginUrl);
        } else {
          location.replace(loginUrl);
        }
      };
    }

    window.StarkModuleNavigation = {
      open: (id) => {
        const btn = document.querySelector(`.system-module-item[data-module-id="${id}"] .system-module-tab`);
        if (btn) btn.click();
      },
      close: closeAllDropdowns,
      groups
    };

    window.addEventListener('error', e => {
      if (/storage|newer changes/i.test(e.message || '')) notice(e.message, true);
    });
  }

  let dialogSequence = 0;
  function dialog(title, body, onSave, saveLabel = 'Save', options = {}) {
    const former = document.activeElement, wrap = document.createElement('div'), titleId = 'system-dialog-title-' + (++dialogSequence);
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}"><div class="modal-head"><h3 id="${titleId}">${escape(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Close dialog">×</button></div><div class="modal-body">${body}<p data-dialog-error class="notice danger" role="alert" hidden></p></div><div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" data-save>${escape(saveLabel)}</button></div></div>`;
    if (options.system) {
      wrap.className = 'sys-modal-backdrop';
      wrap.querySelector('.modal').className = 'sys-modal';
      wrap.querySelector('.modal-actions').className = 'sys-modal-footer';
      wrap.querySelectorAll('button').forEach(button => button.className = button.hasAttribute('data-save') ? 'sys-btn primary' : 'sys-btn');
    }
    document.body.append(wrap);
    const box = wrap.querySelector('[role="dialog"]'), saveButton = wrap.querySelector('[data-save]'), errorBox = wrap.querySelector('[data-dialog-error]');
    let busy = false;
    const focusables = () => [...wrap.querySelectorAll('button,input:not([type="hidden"]),select,textarea,a[href],[tabindex]')].filter(node => !node.disabled && !node.hidden && !node.closest('[hidden]') && node.tabIndex >= 0);

    function close() {
      if (busy) return;
      wrap.remove();
      document.removeEventListener('keydown', keys);
      const target = former?.isConnected ? former : former?.id ? document.getElementById(former.id) : null;
      target?.focus();
    }

    function keys(event) {
      if (!wrap.isConnected) { document.removeEventListener('keydown', keys); return; }
      if ([...document.querySelectorAll('.modal-backdrop,.sys-modal-backdrop,.op-modal-backdrop')].at(-1) !== wrap) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const nodes = focusables(), first = nodes[0], last = nodes.at(-1);
        if (!first) { event.preventDefault(); box.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !wrap.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !wrap.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }

    const fail = error => {
      errorBox.hidden = false;
      errorBox.textContent = error?.message || 'The change could not be saved. Review the form and try again.';
    };

    wrap.querySelectorAll('[data-close]').forEach(button => button.onclick = close);
    wrap.addEventListener('click', event => { if (event.target === wrap) close(); });
    saveButton.onclick = () => {
      if (busy) return;
      errorBox.hidden = true;
      errorBox.textContent = '';
      const invalid = [...wrap.querySelectorAll('input,select,textarea')].find(node => !node.disabled && node.type !== 'hidden' && !node.closest('[hidden]') && !node.checkValidity());
      if (invalid) { invalid.reportValidity(); invalid.focus(); fail(new Error(invalid.validationMessage)); return; }
      try {
        const result = onSave?.(wrap);
        if (result && typeof result.then === 'function') {
          busy = true; box.setAttribute('aria-busy', 'true');
          const controls = [...wrap.querySelectorAll('button,input,select,textarea')], disabled = controls.map(node => node.disabled);
          controls.forEach(node => node.disabled = true);
          Promise.resolve(result).then(ok => { busy = false; if (ok !== false) close(); }, fail).finally(() => { busy = false; box.removeAttribute('aria-busy'); controls.forEach((node, index) => node.disabled = disabled[index]); });
        } else if (result !== false) close();
      } catch (error) { fail(error); }
    };
    box.tabIndex = -1;
    document.addEventListener('keydown', keys);
    (wrap.querySelector('input:not([type="hidden"]),select,textarea') || saveButton).focus();
    return wrap;
  }

  window.addEventListener('stark:storage-error', event => notice(event.detail.message, true));
  window.StarkSystemUI = { notice, escape, glyph, dialog };

  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
