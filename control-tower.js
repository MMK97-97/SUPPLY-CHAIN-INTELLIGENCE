(function(){
  'use strict';
  const S=window.StarkSystem;if(!S||window.StarkControlTower)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const fmt=v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n(v));
  const money=(v,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:/^[a-z]{3}$/i.test(c)?c:'USD',maximumFractionDigits:0}).format(n(v));
  const names={US:'United States',EU:'European Union',CA:'Canada'};
  const closed=status=>['SHIPPED','DELIVERED','CANCELLED','EXPIRED'].includes(status);
  const date=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?d:null;};
  const day=value=>{const d=date(value);return d?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):'';};
  const calendarDay=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5;
  const when=value=>date(value)?.toLocaleDateString(undefined,{month:'short',day:'numeric'})||'—';
  
  let period=30,tab='orders',healthFilter='',queue='warehouse',orderStage='recent';
  let viewMode=localStorage.getItem('stark-overview-view')||'telemetry';
  let moduleArrangement = null;
  const seriesVisible={orders:true,shipments:true,delivered:true};
  let chartMetric='orders';
  let simDemand=0;
  let simDelay=0;

  function snapshot(state,region,days=30,now=new Date()){
    days=days==='all'?'all':[7,14,30,90].includes(Number(days))?Number(days):30;
    region=S.regionCode(region);const e=state.enterprise,l=state.logistics,bySku=new Map(e.inventory.map(i=>[i.sku,i])),byOrder=new Map(e.orders.map(o=>[o.id,o]));
    const itemRegion=i=>S.regionCode(i?.region||'US');
    const matches=o=>o.region?S.regionCode(o.region)===region:o.lines.some(line=>itemRegion(bySku.get(line.sku))===region);
    const orders=e.orders.filter(matches),open=orders.filter(o=>!closed(o.status));
    const supplierPOs=e.purchaseOrders.filter(p=>p.region?S.regionCode(p.region)===region:p.lines.some(line=>itemRegion(bySku.get(line.sku))===region));
    const purchase=supplierPOs.filter(p=>!['RECEIVED','CANCELLED'].includes(p.status)&&!(p.purpose==='DROPSHIP'&&p.status==='DISPATCHED')&&p.lines.some(line=>n(line.received)<n(line.qty)));
    const report=state.regional[region];
    const physical=report?.items?.length?report.items.map(i=>{const sku=region+'::'+i.model,linked=bySku.get(sku);return linked?{...i,sku,onHand:linked.onHand,safety:n(linked.safety),available:S.available(linked),reserved:linked.reserved,linkedStock:true}:{...i,sku,safety:3,available:n(i.available),reserved:Math.max(0,n(i.onHand)-n(i.available))};}):e.inventory.filter(i=>i.nature!=='DIGITAL'&&itemRegion(i)===region).map(i=>({...i,available:S.available(i)}));
    const health=i=>i.available>n(i.safety)?'stock':i.available>0?'low':n(i.onHand)>0&&n(i.reserved)>0?'allocated':'unavailable';
    const healthGroups=[['stock','In stock','#009aa6'],['low','Low stock','#f59c00'],['unavailable','Unavailable','#ef4868'],['allocated','Fully allocated','#8558ef']].map(([id,label,color])=>({id,label,color,count:physical.filter(i=>health(i)===id).length}));
    const allShipments=[...l.packing.filter(p=>p.status==='SHIPPED').map(p=>({...p,source:'Warehouse',ref:p.orderId,dispatchedAt:p.shippedAt})),...l.tplShipments.filter(p=>['DISPATCHED','DELIVERED'].includes(p.status)).map(p=>({...p,source:'3PL',ref:p.customerOrderId}))];
    const shipments=allShipments.filter(p=>p.ref&&byOrder.has(p.ref)?matches(byOrder.get(p.ref)):itemRegion(bySku.get(p.sku))===region);
    const today=calendarDay(now);let earliest=today;
    if(days==='all')for(const value of [...orders.flatMap(o=>[o.createdAt,o.deliveredAt]),...shipments.map(s=>s.dispatchedAt)]){const d=date(value);if(d)earliest=Math.min(earliest,calendarDay(d));}
    const span=days==='all'?Math.max(30,today-earliest+1):Number(days);
    const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-span+1);
    const inPeriod=value=>{const d=date(value);return !!d&&d>=start&&d<=now;};
    const recentOrders=orders.filter(o=>inPeriod(o.createdAt));
    const deliveries=orders.filter(o=>o.status==='DELIVERED'&&date(o.deliveredAt)&&o.inHandsDate&&inPeriod(o.deliveredAt));
    const onTime=deliveries.length?Math.round(100*deliveries.filter(o=>day(o.deliveredAt)<=o.inHandsDate).length/deliveries.length):null;
    const bins=Math.min(30,span),points=Array.from({length:bins},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+Math.floor(i*span/bins));return {date:day(d),orders:0,shipments:0,delivered:0};});
    const add=(value,key)=>{const d=date(value);if(!d||d<start||d>now)return;const index=Math.min(bins-1,Math.floor((calendarDay(d)-calendarDay(start))*bins/span));if(index>=0)points[index][key]++;};
    orders.forEach(o=>{add(o.createdAt,'orders');if(o.status==='DELIVERED')add(o.deliveredAt,'delivered');});shipments.forEach(p=>add(p.dispatchedAt,'shipments'));
    const credit={},creditLimits={};e.accounts.forEach(a=>{const c=a.currency||'USD';credit[c]=(credit[c]||0)+n(a.creditUsed);creditLimits[c]=(creditLimits[c]||0)+n(a.creditLimit);});
    const digital=e.vaultTokens.filter(t=>t.state==='DISPATCHED'&&itemRegion(bySku.get(t.sku))===region).length;
    const issues=S.issues().filter(issue=>{const o=e.orders.find(o=>issue.title.startsWith(o.po+':'));if(o)return matches(o);const p=e.purchaseOrders.find(p=>issue.title.startsWith(p.po+':'));if(p)return supplierPOs.some(x=>x.id===p.id);const i=e.inventory.find(i=>issue.title.startsWith(i.sku+':'));return !i||itemRegion(i)===region;});
    return {state,region,regionName:names[region],orders,open,purchase,supplierPOs,physical,health,healthGroups,report,shipments,recentOrders,deliveries,onTime,points,credit,creditLimits,digital,issues,span,inPeriod,available:physical.reduce((v,i)=>v+i.available,0)};
  }

  const icon=name=>window.StarkSystemUI?.glyph(name)||'';
  const empty=text=>'<div class="tower-empty">'+esc(text)+'</div>';
  const badge=status=>'<span class="tower-badge" data-status="'+esc(status)+'">'+esc(String(status).replaceAll('_',' '))+'</span>';

  function sparklineSvg(dataPoints, color = '#0284c7', width = 56, height = 20) {
    if (!dataPoints || dataPoints.length < 2) return '';
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const range = max === min ? 1 : max - min;
    const pad = 2;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const pts = dataPoints.map((v, i) => {
      const x = pad + (i / (dataPoints.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `<svg class="tower-kpi-sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${pts[pts.length - 1].split(',')[0]}" cy="${pts[pts.length - 1].split(',')[1]}" r="2" fill="${color}"/></svg>`;
  }

  function kpi(id, label, value, foot, path, glyph, color, trendText = '', trendClass = 'up', sparkPoints = null, submetric = '') {
    const spark = sparkPoints ? sparklineSvg(sparkPoints, color, 58, 22) : '';
    return `<a class="tower-kpi" data-kpi="${id}" href="${S.url(path)}" style="--tower-accent:${color}"><div class="tower-kpi-header-row"><span class="tower-kpi-icon">${icon(glyph)}</span><span class="tower-kpi-label">${esc(label)}</span>${trendText ? `<span class="tower-kpi-trend-pill ${trendClass}">${esc(trendText)}</span>` : ''}</div><div class="tower-kpi-value-row"><strong data-kpi-value>${esc(value)}</strong>${spark ? `<span class="tower-kpi-sparkline">${spark}</span>` : ''}</div>${submetric ? `<div class="tower-kpi-submetric">${esc(submetric)}</div>` : ''}<small>${esc(foot)}</small></a>`;
  }

  function bannerSvg(id, color) {
    const banners = {
      itemMaster: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-im" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#082338"/><stop offset="1" stop-color="#0c4a6e"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-im)"/>
          <path d="M0 22h360M0 44h360M0 66h360" stroke="#0ea5e9" stroke-opacity="0.08" stroke-width="1"/>
          <g transform="translate(35,20)" stroke="#0ea5e9" stroke-width="1.4" fill="#0369a1">
            <rect width="52" height="48" rx="4"/>
            <circle cx="26" cy="24" r="12" fill="#0284c7" stroke="#38bdf8" stroke-width="1.6"/>
            <path d="M21 24 L25 28 L32 20" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
          </g>
          <rect x="110" y="24" width="130" height="12" rx="3" fill="#0284c7"/>
          <rect x="110" y="42" width="85" height="10" rx="2" fill="#0369a1"/>
          <rect x="110" y="56" width="105" height="8" rx="2" fill="#075985"/>
          <circle cx="280" cy="42" r="14" fill="#0284c7" stroke="#38bdf8" stroke-width="1.8"/>
          <path d="M280 33 v10 l7 5" stroke="#bae6fd" stroke-width="2" stroke-linecap="round"/>
          <text x="342" y="76" text-anchor="end" fill="#bae6fd" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">MASTER CATALOG &amp; BRAND ATS</text>
        </svg>`,
      planning: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg-plan" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#042e2b"/><stop offset="1" stop-color="#064e43"/></linearGradient>
            <linearGradient id="curve-plan" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#10b981" stop-opacity="0.4"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/></linearGradient>
          </defs>
          <rect width="360" height="88" fill="url(#bg-plan)"/>
          <path d="M0 22h360M0 44h360M0 66h360M60 0v88M120 0v88M180 0v88M240 0v88M300 0v88" stroke="#10b981" stroke-opacity="0.08" stroke-width="1"/>
          <path d="M20 72 Q90 68, 140 48 T250 32 T340 18 L340 88 L20 88 Z" fill="url(#curve-plan)"/>
          <path d="M20 72 Q90 68, 140 48 T250 32 T340 18" stroke="#10b981" stroke-width="2.5" fill="none"/>
          <circle cx="140" cy="48" r="3.5" fill="#34d399"/><circle cx="250" cy="32" r="3.5" fill="#34d399"/><circle cx="340" cy="18" r="4" fill="#a7f3d0"/>
          <g transform="translate(28,26)" stroke="#10b981" stroke-width="1.2" fill="#0b3d36">
            <path d="M0 12 L16 4 L32 12 L16 20 Z"/><path d="M0 12 L0 22 L16 30 L16 20 Z"/><path d="M32 12 L32 22 L16 30 L16 20 Z"/>
            <path d="M16 2 L32 -6 L48 2 L32 10 Z" fill="#0f5147"/><path d="M16 2 L16 12 L32 20 L32 10 Z"/><path d="M48 2 L48 12 L32 20 L32 10 Z"/>
          </g>
          <text x="342" y="76" text-anchor="end" fill="#6ee7b7" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">DEMAND &amp; REORDER LAB</text>
        </svg>`,
      crm: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-crm" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#0a1d3d"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-crm)"/>
          <path d="M0 22h360M0 44h360M0 66h360" stroke="#3b82f6" stroke-opacity="0.08" stroke-width="1"/>
          <path d="M45 44 L110 24 L190 52 L265 28 L325 48" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 3"/>
          <g transform="translate(45,44)"><circle r="13" fill="#1d4ed8" stroke="#60a5fa" stroke-width="1.5"/><circle cy="-2" r="4" fill="#fff"/><path d="M-7 7 C-7 3.5, 7 3.5, 7 7" stroke="#fff" stroke-width="1.4" fill="none"/></g>
          <g transform="translate(110,24)"><circle r="10" fill="#1e40af" stroke="#93c5fd" stroke-width="1.5"/><circle cy="-1.5" r="3" fill="#fff"/><path d="M-5 5 C-5 2.5, 5 2.5, 5 5" stroke="#fff" stroke-width="1.2" fill="none"/></g>
          <g transform="translate(190,52)"><circle r="15" fill="#2563eb" stroke="#bfdbfe" stroke-width="1.8"/><circle cy="-2.5" r="4.5" fill="#fff"/><path d="M-8 8 C-8 4, 8 4, 8 8" stroke="#fff" stroke-width="1.6" fill="none"/></g>
          <g transform="translate(265,28)"><circle r="11" fill="#1e40af" stroke="#93c5fd" stroke-width="1.5"/><circle cy="-1.5" r="3.5" fill="#fff"/><path d="M-6 6 C-6 3, 6 3, 6 6" stroke="#fff" stroke-width="1.2" fill="none"/></g>
          <g transform="translate(325,48)"><circle r="10" fill="#1d4ed8" stroke="#60a5fa" stroke-width="1.5"/><circle cy="-1.5" r="3" fill="#fff"/><path d="M-5 5 C-5 2.5, 5 2.5, 5 5" stroke="#fff" stroke-width="1.2" fill="none"/></g>
          <text x="342" y="76" text-anchor="end" fill="#93c5fd" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">PARTNER CRM &amp; CATALOGS</text>
        </svg>`,
      orders: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-ord" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#2a140b"/><stop offset="1" stop-color="#7c2d12"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-ord)"/>
          <line x1="20" y1="58" x2="340" y2="58" stroke="#f97316" stroke-width="2"/>
          <g stroke="#f97316" stroke-width="1.2" fill="#431407">
            <rect x="50" y="32" width="28" height="24" rx="2"/><line x1="64" y1="32" x2="64" y2="56" stroke-dasharray="2 2"/>
            <rect x="110" y="24" width="36" height="32" rx="3"/><line x1="128" y1="24" x2="128" y2="56" stroke-dasharray="2 2"/>
            <rect x="180" y="34" width="26" height="22" rx="2"/><line x1="193" y1="34" x2="193" y2="56" stroke-dasharray="2 2"/>
            <rect x="235" y="22" width="40" height="34" rx="3"/><line x1="255" y1="22" x2="255" y2="56" stroke-dasharray="2 2"/>
          </g>
          <line x1="255" y1="6" x2="255" y2="54" stroke="#ffedd5" stroke-width="1.8" stroke-dasharray="4 2"/>
          <circle cx="255" cy="22" r="3" fill="#fdba74"/>
          <text x="342" y="76" text-anchor="end" fill="#fed7aa" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">ALLOCATION &amp; PACKAGING</text>
        </svg>`,
      vendor: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-ven" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#1e1035"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-ven)"/>
          <path d="M0 64 L360 64" stroke="#8b5cf6" stroke-width="1.5"/>
          <path d="M40 64 L55 36 L70 64 L85 36 L100 64 L140 64 L140 28 L170 28 L170 64" fill="#2e1065" stroke="#a78bfa" stroke-width="1.4"/>
          <path d="M210 64 L225 44 L295 44 L310 64 Z" fill="#3b0764" stroke="#c4b5fd" stroke-width="1.5"/>
          <rect x="235" y="32" width="16" height="12" fill="#8b5cf6" rx="1"/>
          <rect x="255" y="32" width="16" height="12" fill="#a78bfa" rx="1"/>
          <rect x="275" y="32" width="16" height="12" fill="#7c3aed" rx="1"/>
          <text x="342" y="76" text-anchor="end" fill="#ddd6fe" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">SUPPLIER MASTER &amp; SLA</text>
        </svg>`,
      procurement: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-pro" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#2a1604"/><stop offset="1" stop-color="#78350f"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-pro)"/>
          <g transform="translate(40,16)">
            <rect width="44" height="54" rx="4" fill="#451a03" stroke="#f59e0b" stroke-width="1.5"/>
            <rect x="12" y="-4" width="20" height="8" rx="2" fill="#f59e0b"/>
            <line x1="8" y1="16" x2="36" y2="16" stroke="#fbbf24" stroke-width="1.5"/>
            <line x1="8" y1="25" x2="36" y2="25" stroke="#fbbf24" stroke-width="1.5"/>
            <line x1="8" y1="34" x2="28" y2="34" stroke="#fbbf24" stroke-width="1.5"/>
            <path d="M10 44 l3 3 6-6" stroke="#34d399" stroke-width="2" fill="none"/>
          </g>
          <path d="M110 42 L220 42" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5 3"/>
          <polygon points="225,42 215,37 215,47" fill="#f59e0b"/>
          <g transform="translate(240,18)">
            <rect width="52" height="48" rx="4" fill="#451a03" stroke="#fbbf24" stroke-width="1.4"/>
            <path d="M8 40 L26 24 L44 40" stroke="#f59e0b" stroke-width="1.4" fill="none"/>
            <rect x="18" y="28" width="16" height="18" fill="#78350f"/>
          </g>
          <text x="342" y="76" text-anchor="end" fill="#fde68a" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">PO MANAGEMENT &amp; RECEIVING</text>
        </svg>`,
      shipping: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-shp" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#2d0a12"/><stop offset="1" stop-color="#881337"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-shp)"/>
          <line x1="0" y1="62" x2="360" y2="62" stroke="#ef4444" stroke-width="1.5"/>
          <line x1="30" y1="46" x2="120" y2="46" stroke="#fca5a5" stroke-width="1.2" stroke-dasharray="8 6"/>
          <g transform="translate(130,22)">
            <rect x="0" y="4" width="70" height="34" rx="3" fill="#4c0519" stroke="#ef4444" stroke-width="1.5"/>
            <path d="M70 16 L88 16 L98 28 L98 38 L70 38 Z" fill="#9f1239" stroke="#f87171" stroke-width="1.5"/>
            <circle cx="20" cy="40" r="7" fill="#1c1917" stroke="#ef4444" stroke-width="2"/>
            <circle cx="56" cy="40" r="7" fill="#1c1917" stroke="#ef4444" stroke-width="2"/>
            <circle cx="82" cy="40" r="7" fill="#1c1917" stroke="#ef4444" stroke-width="2"/>
          </g>
          <text x="342" y="76" text-anchor="end" fill="#fecdd3" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">SARASOTA CARRIER DISPATCH</text>
        </svg>`,
      warehouse: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-wh" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#082338"/><stop offset="1" stop-color="#0369a1"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-wh)"/>
          <g transform="translate(30,12)" stroke="#0284c7" stroke-width="1.4">
            <rect x="0" y="0" width="80" height="60" fill="none"/>
            <line x1="0" y1="20" x2="80" y2="20"/><line x1="0" y1="40" x2="80" y2="40"/><line x1="40" y1="0" x2="40" y2="60"/>
            <rect x="6" y="24" width="28" height="12" fill="#075985" rx="1"/>
            <rect x="46" y="4" width="28" height="12" fill="#0284c7" rx="1"/>
            <rect x="46" y="24" width="28" height="12" fill="#38bdf8" rx="1"/>
          </g>
          <g transform="translate(140,12)" stroke="#0284c7" stroke-width="1.4">
            <rect x="0" y="0" width="80" height="60" fill="none"/>
            <line x1="0" y1="20" x2="80" y2="20"/><line x1="0" y1="40" x2="80" y2="40"/><line x1="40" y1="0" x2="40" y2="60"/>
            <rect x="6" y="4" width="28" height="12" fill="#38bdf8" rx="1"/>
            <rect x="6" y="44" width="28" height="12" fill="#075985" rx="1"/>
            <rect x="46" y="24" width="28" height="12" fill="#0284c7" rx="1"/>
          </g>
          <circle cx="280" cy="44" r="16" fill="#0c4a6e" stroke="#38bdf8" stroke-width="1.8"/>
          <path d="M280 34 v12 l8 6" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round"/>
          <text x="342" y="76" text-anchor="end" fill="#bae6fd" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">CONTROL TOWER, BINS &amp; WAVES</text>
        </svg>`,
      tpl: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-tpl" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#032a24"/><stop offset="1" stop-color="#065f46"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-tpl)"/>
          <path d="M50 44 L130 24 L200 58 L280 32 L330 52" stroke="#10b981" stroke-width="1.6" stroke-dasharray="4 3"/>
          <path d="M130 24 L280 32" stroke="#34d399" stroke-width="1" stroke-dasharray="2 3"/>
          <g transform="translate(50,44)"><circle r="12" fill="#047857" stroke="#6ee7b7" stroke-width="1.8"/><rect x="-5" y="-5" width="10" height="10" fill="#fff" rx="1"/></g>
          <g transform="translate(130,24)"><circle r="15" fill="#059669" stroke="#a7f3d0" stroke-width="2"/><text x="0" y="3" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">API</text></g>
          <g transform="translate(200,58)"><circle r="13" fill="#047857" stroke="#6ee7b7" stroke-width="1.8"/><rect x="-5" y="-5" width="10" height="10" fill="#fff" rx="1"/></g>
          <g transform="translate(280,32)"><circle r="14" fill="#059669" stroke="#a7f3d0" stroke-width="1.8"/><text x="0" y="3" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">3PL</text></g>
          <text x="342" y="76" text-anchor="end" fill="#a7f3d0" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">DISTRIBUTED 3PL NETWORK</text>
        </svg>`,
      transportation: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-trn" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#0a1a38"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-trn)"/>
          <polygon points="120,88 240,88 190,44 170,44" fill="#172554"/>
          <line x1="180" y1="46" x2="180" y2="88" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="6 4"/>
          <g transform="translate(40,32)">
            <rect width="58" height="28" rx="2" fill="#1e3a8a" stroke="#3b82f6" stroke-width="1.4"/>
            <circle cx="14" cy="30" r="5" fill="#111827" stroke="#60a5fa" stroke-width="1.5"/>
            <circle cx="44" cy="30" r="5" fill="#111827" stroke="#60a5fa" stroke-width="1.5"/>
          </g>
          <circle cx="280" cy="34" r="14" fill="#1d4ed8" stroke="#93c5fd" stroke-width="1.5"/>
          <path d="M280 24 v10 l7 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
          <text x="342" y="76" text-anchor="end" fill="#bfdbfe" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">FREIGHT TRANSIT &amp; ROUTING</text>
        </svg>`,
      analytics: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-anl" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#2c1a04"/><stop offset="1" stop-color="#713f12"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-anl)"/>
          <g transform="translate(40,24)">
            <rect x="0" y="24" width="14" height="34" rx="2" fill="#ca8a04"/>
            <rect x="22" y="14" width="14" height="44" rx="2" fill="#eab308"/>
            <rect x="44" y="28" width="14" height="30" rx="2" fill="#a16207"/>
            <rect x="66" y="8" width="14" height="50" rx="2" fill="#facc15"/>
            <rect x="88" y="18" width="14" height="40" rx="2" fill="#eab308"/>
          </g>
          <path d="M170 56 Q210 40, 250 44 T320 20" stroke="#fde047" stroke-width="2.5" fill="none"/>
          <circle cx="320" cy="20" r="4" fill="#fef08a"/>
          <text x="342" y="76" text-anchor="end" fill="#fef08a" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">EXECUTIVE REVENUE &amp; DEMAND</text>
        </svg>`,
      data: `
        <svg viewBox="0 0 360 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bg-dat" x1="0" y1="0" x2="360" y2="88" gradientUnits="userSpaceOnUse"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#334155"/></linearGradient></defs>
          <rect width="360" height="88" fill="url(#bg-dat)"/>
          <g transform="translate(45,18)" stroke="#64748b" stroke-width="1.4" fill="#1e293b">
            <rect width="65" height="50" rx="3"/>
            <line x1="8" y1="12" x2="45" y2="12"/><line x1="8" y1="24" x2="45" y2="24"/><line x1="8" y1="36" x2="45" y2="36"/>
            <circle cx="54" cy="12" r="2.5" fill="#10b981"/><circle cx="54" cy="24" r="2.5" fill="#3b82f6"/><circle cx="54" cy="36" r="2.5" fill="#10b981"/>
          </g>
          <g transform="translate(130,18)" stroke="#64748b" stroke-width="1.4" fill="#1e293b">
            <rect width="65" height="50" rx="3"/>
            <line x1="8" y1="12" x2="45" y2="12"/><line x1="8" y1="24" x2="45" y2="24"/><line x1="8" y1="36" x2="45" y2="36"/>
            <circle cx="54" cy="12" r="2.5" fill="#10b981"/><circle cx="54" cy="24" r="2.5" fill="#f59e0b"/><circle cx="54" cy="36" r="2.5" fill="#10b981"/>
          </g>
          <circle cx="280" cy="42" r="16" fill="#1e293b" stroke="#94a3b8" stroke-width="1.8"/>
          <path d="M275 42 L279 46 L286 38" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <text x="342" y="76" text-anchor="end" fill="#cbd5e1" font-size="9" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">DATA CENTER &amp; AUDIT TRAIL</text>
        </svg>`
    };
    return banners[id] || banners.planning;
  }

  function renderModuleGrid(allGroups) {
    return `
      <div class="workspace-overview-header workspace-clean-header">
        <div class="workspace-view-switch" role="tablist" aria-label="Workspace View">
          <button type="button" class="workspace-view-tab ${viewMode==='modules'?'active':''}" data-view="modules" role="tab" aria-selected="${viewMode==='modules'}">
            ▦ Operational Modules
          </button>
          <a class="workspace-view-tab workspace-mail-tab" href="${S.url('mail.html')}" role="tab" aria-label="STARK Mail" title="STARK Mail · Enterprise email for supply chain operations">
            <svg class="workspace-mail-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <span>STARK Mail</span>
            <span class="workspace-mail-pill">12</span>
          </a>
          <a class="workspace-view-tab" href="${S.url('tasks.html')}">☑ Tasks</a>
          <button type="button" class="workspace-view-tab ${viewMode==='telemetry'?'active':''}" data-view="telemetry" role="tab" aria-selected="${viewMode==='telemetry'}">
            📊 Telemetry &amp; KPIs
          </button>
        </div>
        <div class="workspace-actions-wrap">
          <button type="button" class="sys-btn reset-layout-btn" data-reset-module-layout title="Restore default grid arrangement">Restore layout</button>
        </div>
        <p id="module-arrangement-help" class="visually-hidden" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Drag a module header to place it anywhere. Moved modules expand with the arrow. Alt + arrow keys move a focused header.</p>
      </div>

      <div class="module-overview-grid">
        ${allGroups.map(([id, label, subtitle, color, items, primaryUrl, quickAction]) => `
          <article class="module-overview-card" data-draggable-module="${id}" style="--card-accent:${color}">
            <header class="module-card-head" id="module-drag-${id}" data-move-module="${id}" tabindex="0" aria-label="Move ${esc(label)}" aria-describedby="module-arrangement-help">
              <span class="module-card-icon" style="background:${color}">${icon(id)}</span>
              <div class="module-card-titles">
                <h2>${esc(label)}</h2>
                <small>${esc(subtitle)}</small>
              </div>
              <div class="module-card-position-controls">
                <button type="button" class="module-card-position-button module-card-expand" data-toggle-module="${id}" aria-label="Expand ${esc(label)} options" aria-controls="module-options-${id}" aria-expanded="false" hidden><svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="m5 7 5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              </div>
            </header>
            <div class="module-card-content" id="module-options-${id}">
            <div class="module-card-banner">
              ${bannerSvg(id, color)}
            </div>
            <ul class="module-card-links" role="list">
              ${items.map(([path, itemLabel, isHot]) => `
                <li>
                  <a href="${S.url(path)}" class="module-card-link ${isHot ? 'highlighted' : ''}">
                    <span class="module-card-link-text">${esc(itemLabel)}</span>
                    ${isHot ? '<span class="module-card-badge">Active</span>' : ''}
                    <span class="module-card-chevron">›</span>
                  </a>
                </li>
              `).join('')}
            </ul>
            <footer class="module-card-foot">
              <a href="${S.url(primaryUrl)}" class="module-card-action">Launch module ↗</a>
              ${quickAction ? `<a href="${S.url(quickAction.path)}" class="module-card-quick">${quickAction.label}</a>` : ''}
            </footer>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function initDraggableModules(host) {
    const grid = host.querySelector('.module-overview-grid');
    const cards = [...grid.querySelectorAll('[data-draggable-module]')];
    const store = window.StarkWorkspace?.localStorage || window.localStorage;
    const key = 'stark-module-card-positions-v1';
    const entries = {}, placeholders = new Map(), preferredWidths = new Map();
    const cleanup = [], stack = cards.map(card => card.dataset.draggableModule);
    const padding = 12, visualViewport = window.visualViewport;
    let drag = null, suppressed = null, suppressTimer, menu = null;
    const clamp = (value, min, max) => Math.min(Math.max(min, max), Math.max(min, value));
    const idOf = card => card.dataset.draggableModule;
    function listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      cleanup.push(() => target.removeEventListener(name, handler, options));
    }
    function viewport() {
      return { x: visualViewport?.offsetLeft || 0, y: visualViewport?.offsetTop || 0,
        width: visualViewport?.width || window.innerWidth, height: visualViewport?.height || window.innerHeight };
    }
    function utilityRects() {
      return [...document.querySelectorAll('.mk-brain-launcher, #stark-fab-wrapper')].map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    }
    function clearMenuSpace() {
      if (!menu) return;
      menu.reserve?.remove(); menu.reserve = null;
      for (const [card, position] of menu.shifted) {
        card.style.left = position.left; card.style.top = position.top;
      }
      menu.shifted.clear();
    }
    function closeMenu(focus = false) {
      if (!menu) return;
      const current = menu;
      clearMenuSpace(); menu = null;
      current.panel.classList.remove('module-floating-menu');
      current.panel.removeAttribute('data-placement');
      current.panel.removeAttribute('data-compact');
      for (const property of ['left', 'top', 'width', 'max-height', '--card-accent']) current.panel.style.removeProperty(property);
      current.card.append(current.panel);
      current.card.classList.remove('module-menu-open');
      current.button.setAttribute('aria-expanded', 'false');
      if (focus && current.button.isConnected) current.button.focus({ preventScroll: true });
    }
    function positionMenu() {
      if (!menu) return;
      clearMenuSpace();
      const { panel, card, button } = menu, v = viewport(), gap = 10;
      const anchor = card.getBoundingClientRect();
      const left = v.x + padding, top = v.y + padding, right = v.x + v.width - padding, bottom = v.y + v.height - padding;
      const desiredWidth = Math.min(Math.max(260, anchor.width), 360, Math.max(0, right - left));
      const boxes = [...cards.map(node => node.getBoundingClientRect()), ...utilityRects()].filter(r => r.width > 0 && r.height > 0 && r.right > left && r.left < right && r.bottom > top && r.top < bottom);
      function findSpace(blocks, minimumY = top, requestedHeight = 160) {
        let found = null;
        for (const width of new Set([desiredWidth, Math.min(desiredWidth, 280), Math.min(desiredWidth, 240)])) {
          panel.style.width = width + 'px'; panel.style.maxHeight = 'none';
          const naturalHeight = panel.scrollHeight || panel.getBoundingClientRect().height || 400;
          const minimumHeight = Math.min(naturalHeight, requestedHeight, Math.max(0, bottom - minimumY));
          const xs = new Set([left, right - width, anchor.left, anchor.right - width, anchor.right + gap, anchor.left - width - gap]);
          const ys = new Set([minimumY, anchor.top, anchor.bottom + gap, anchor.top - naturalHeight - gap]);
          for (const box of blocks) { xs.add(box.right + gap); xs.add(box.left - width - gap); ys.add(box.bottom + gap); ys.add(box.top - naturalHeight - gap); }
          for (const rawX of xs) for (const y of ys) {
            const x = clamp(rawX, left, right - width);
            if (y < minimumY || y >= bottom) continue;
            let available = bottom - y;
            for (const box of blocks) if (x < box.right + gap && x + width > box.left - gap && box.bottom + gap > y) {
              available = Math.min(available, box.top - gap - y);
            }
            if (available < minimumHeight) continue;
            const height = Math.min(naturalHeight, available);
            const score = Math.hypot(x - anchor.left, y - anchor.bottom - gap) + (naturalHeight - height) * 2 + (desiredWidth - width) * .5;
            if (!found || score < found.score) found = {x, y, width, height, score};
          }
        }
        return found;
      }
      let best = findSpace(boxes);
      if (!best) {
        // A crowded screen needs real layout space; never paint options over another module.
        const headerHeight = Math.max(0, ...cards.filter(node => node.classList.contains('module-is-floating')).map(node => node.getBoundingClientRect().height));
        const y = Math.min(bottom, top + headerHeight + gap);
        best = findSpace(utilityRects(), y) || findSpace(utilityRects(), y, 80) || {x:left, y, width:desiredWidth, height:Math.max(0,bottom-y)};
        const reserve = document.createElement('div');
        reserve.className = 'module-menu-space'; reserve.setAttribute('aria-hidden', 'true');
        reserve.style.height = Math.max(0, best.y + best.height + gap - grid.getBoundingClientRect().top) + 'px';
        grid.prepend(reserve); menu.reserve = reserve;
        for (const node of cards.filter(node => node.classList.contains('module-is-floating'))) {
          const r = node.getBoundingClientRect();
          if (r.left < best.x + best.width + gap && r.right > best.x - gap && r.top < best.y + best.height + gap && r.bottom > best.y - gap) {
            menu.shifted.set(node, {left:node.style.left, top:node.style.top});
            node.style.top = top + 'px';
          }
        }
      }
      Object.assign(panel.style, {left:best.x + 'px', top:best.y + 'px', width:best.width + 'px', maxHeight:best.height + 'px'});
      const currentAnchor = card.getBoundingClientRect();
      panel.dataset.placement = menu.reserve ? 'workspace' : best.x >= currentAnchor.right ? 'right' : best.x + best.width <= currentAnchor.left ? 'left' : best.y + best.height <= currentAnchor.top ? 'up' : 'down';
      panel.dataset.compact = String(best.height < 300);
      button.dataset.placement = panel.dataset.placement;
    }
    function openMenu(card, focus = false) {
      if (!card.classList.contains('module-is-floating')) return;
      if (menu?.card === card) { closeMenu(); return; }
      closeMenu();
      const panel = card.querySelector('.module-card-content'), button = card.querySelector('[data-toggle-module]');
      menu = {card, panel, button, shifted:new Map(), reserve:null};
      panel.classList.add('module-floating-menu');
      panel.style.setProperty('--card-accent', card.style.getPropertyValue('--card-accent'));
      document.body.append(panel);
      card.classList.add('module-menu-open'); button.setAttribute('aria-expanded', 'true');
      positionMenu();
      if (focus) panel.querySelector('a')?.focus({ preventScroll: true });
    }
    function bounds(card) {
      const v = viewport();
      const width = Math.min(preferredWidths.get(idOf(card)) || 360, Math.max(0, v.width - padding * 2));
      card.style.width = width + 'px';
      card.style.maxHeight = Math.max(0, v.height - padding * 2) + 'px';
      const height = Math.min(card.getBoundingClientRect().height || card.scrollHeight || 480, Math.max(0, v.height - padding * 2));
      return { minX: v.x + padding, minY: v.y + padding,
        maxX: Math.max(v.x + padding, v.x + v.width - width - padding),
        maxY: Math.max(v.y + padding, v.y + v.height - height - padding), width, height };
    }
    function place(card, x, y) {
      const b = bounds(card);
      const target = {x:clamp(x, b.minX, b.maxX), y:clamp(y, b.minY, b.maxY)}, controls = utilityRects(), gap = 10;
      const xs = new Set([target.x]), ys = new Set([target.y]);
      for (const r of controls) { xs.add(r.left - b.width - gap); xs.add(r.right + gap); ys.add(r.top - b.height - gap); ys.add(r.bottom + gap); }
      let nearest = null;
      for (const rawX of xs) for (const rawY of ys) {
        const x = clamp(rawX,b.minX,b.maxX), y = clamp(rawY,b.minY,b.maxY);
        if (controls.some(r => x < r.right + gap && x + b.width > r.left - gap && y < r.bottom + gap && y + b.height > r.top - gap)) continue;
        const distance = Math.hypot(x-target.x,y-target.y);
        if (!nearest || distance < nearest.distance) nearest = {x,y,distance};
      }
      card.style.left = (nearest || target).x + 'px';
      card.style.top = (nearest || target).y + 'px';
    }
    function raise(card) {
      const id = idOf(card), previous = stack.indexOf(id);
      if (previous >= 0) stack.splice(previous, 1);
      stack.push(id);
      cards.filter(node => node.classList.contains('module-is-floating')).forEach(node => {
        node.style.zIndex = String(820 + stack.indexOf(idOf(node)));
      });
    }
    function float(card, width) {
      const id = idOf(card);
      if (!card.classList.contains('module-is-floating')) {
        const rect = card.getBoundingClientRect(), slot = document.createElement('div');
        slot.className = 'module-card-placeholder';
        slot.style.height = (rect.height || 480) + 'px';
        slot.setAttribute('aria-hidden', 'true');
        grid.insertBefore(slot, card);
        placeholders.set(id, slot);
        preferredWidths.set(id, width || rect.width || 360);
        card.classList.add('module-is-floating');
        card.querySelector('[data-toggle-module]').hidden = false;
      }
      if (width) preferredWidths.set(id, width);
      raise(card);
    }
    function persist() {
      try { store.setItem(key, JSON.stringify(entries)); } catch (_) { /* Layout changes still work without storage. */ }
    }
    function remember(card) {
      const b = bounds(card);
      entries[idOf(card)] = {
        x: (parseFloat(card.style.left) - b.minX) / (b.maxX - b.minX || 1),
        y: (parseFloat(card.style.top) - b.minY) / (b.maxY - b.minY || 1),
        width: preferredWidths.get(idOf(card))
      };
      persist();
    }
    function dock(card, save = true) {
      closeMenu();
      const id = idOf(card);
      card.classList.remove('module-is-floating', 'module-is-dragging');
      for (const property of ['left', 'top', 'width', 'max-height', 'z-index']) card.style.removeProperty(property);
      card.querySelector('[data-toggle-module]').hidden = true;
      placeholders.get(id)?.remove(); placeholders.delete(id); preferredWidths.delete(id);
      delete entries[id];
      if (save) persist();
    }
    function restore(card, entry) {
      float(card, entry.width);
      const b = bounds(card);
      place(card, b.minX + entry.x * (b.maxX - b.minX), b.minY + entry.y * (b.maxY - b.minY));
    }
    try {
      const saved = JSON.parse(store.getItem(key));
      for (const card of cards) {
        const entry = saved?.[idOf(card)];
        if (entry && ['x', 'y'].every(k => Number.isFinite(entry[k]) && entry[k] >= 0 && entry[k] <= 1) && Number.isFinite(entry.width) && entry.width > 0) {
          entries[idOf(card)] = { x: entry.x, y: entry.y, width: entry.width };
          restore(card, entries[idOf(card)]);
        }
      }
    } catch (_) { /* Invalid or unavailable preferences leave the original grid intact. */ }

    function finish(event, cancel = false) {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      const done = drag; drag = null;
      done.card.classList.remove('module-is-dragging');
      if (done.moved) {
        if (cancel) {
          if (done.floating) place(done.card, done.cancelPosition?.left ?? done.rect.left, done.cancelPosition?.top ?? done.rect.top);
          else dock(done.card, false);
        } else remember(done.card);
        suppressed = idOf(done.card);
        clearTimeout(suppressTimer);
        suppressTimer = setTimeout(() => { suppressed = null; }, 500);
      }
      try { done.head.releasePointerCapture(done.pointerId); } catch (_) {}
    }
    listen(grid, 'pointerdown', event => {
      if (!drag) { suppressed = null; clearTimeout(suppressTimer); }
      const card = event.target.closest('[data-draggable-module]');
      if (card?.classList.contains('module-is-floating')) raise(card);
      const head = event.target.closest('.module-card-head');
      const control = event.target.closest('a,button,input,select,textarea');
      if (!card || !head || (control && !control.hasAttribute('data-move-module')) || event.isPrimary === false || event.button !== 0 || drag) return;
      drag = { card, head, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        rect: card.getBoundingClientRect(), cancelPosition: menu?.shifted.has(card) ? {left:parseFloat(menu.shifted.get(card).left),top:parseFloat(menu.shifted.get(card).top)} : null,
        floating: card.classList.contains('module-is-floating'), moved: false };
      try { head.setPointerCapture(event.pointerId); } catch (_) { /* Window listeners cover non-capturing devices. */ }
    });
    listen(window, 'pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) {
        closeMenu();
        drag.moved = true; float(drag.card, preferredWidths.get(idOf(drag.card)) || drag.rect.width || 360);
        drag.card.classList.add('module-is-dragging');
      }
      if (drag.moved) { event.preventDefault(); place(drag.card, drag.rect.left + dx, drag.rect.top + dy); }
    }, { passive: false });
    listen(window, 'pointerup', event => finish(event));
    listen(window, 'pointercancel', event => finish(event, true));
    listen(grid, 'lostpointercapture', event => finish(event, true));
    listen(grid, 'click', event => {
      if (suppressed && event.detail !== 0 && event.target.closest('[data-draggable-module]')?.dataset.draggableModule === suppressed) {
        event.preventDefault(); event.stopImmediatePropagation(); suppressed = null;
      }
    }, true);
    listen(grid, 'click', event => {
      const toggle = event.target.closest('[data-toggle-module]');
      if (toggle) { openMenu(toggle.closest('[data-draggable-module]'), event.detail === 0); return; }
    });
    listen(grid, 'keydown', event => {
      const toggle = event.target.closest('[data-toggle-module]');
      if (toggle && event.key === 'ArrowDown' && !event.altKey) {
        event.preventDefault();
        if (menu?.card !== toggle.closest('[data-draggable-module]')) openMenu(toggle.closest('[data-draggable-module]'), true);
        else menu.panel.querySelector('a')?.focus({ preventScroll: true });
        return;
      }
      const handle = event.target.closest('[data-move-module]');
      if (!handle || !event.altKey || event.target.closest('button,a')) return;
      const card = handle.closest('[data-draggable-module]');
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!delta) return;
      event.preventDefault();
      closeMenu();
      const rect = card.getBoundingClientRect(), step = event.shiftKey ? 4 : 16;
      float(card, preferredWidths.get(idOf(card)) || rect.width || 360);
      place(card, rect.left + delta[0] * step, rect.top + delta[1] * step);
      remember(card);
    });
    listen(window, 'keydown', event => {
      if (event.key === 'Escape' && drag) { event.preventDefault(); finish(null, true); }
      else if (event.key === 'Escape' && menu) { event.preventDefault(); closeMenu(true); }
    });
    listen(document, 'pointerdown', event => { if (menu && !menu.panel.contains(event.target) && !menu.card.contains(event.target)) closeMenu(); });
    listen(window, 'scroll', () => { if (menu?.reserve) closeMenu(); else positionMenu(); });
    listen(host.querySelector('[data-reset-module-layout]'), 'click', () => {
      finish(null, true);
      for (const card of cards) dock(card, false);
      persist();
    });
    function resize() {
      finish(null, true);
      closeMenu();
      for (const card of cards) if (entries[idOf(card)]) restore(card, entries[idOf(card)]);
    }
    listen(window, 'resize', resize);
    if (visualViewport) { listen(visualViewport, 'resize', resize); listen(visualViewport, 'scroll', resize); }
    return { destroy() { closeMenu(); finish(null, true); clearTimeout(suppressTimer); cleanup.forEach(remove => remove()); } };
  }

  function trend(model){
    const width=600,height=220,left=44,right=18,top=18,bottom=38,w=width-left-right,h=height-top-bottom;
    const values=model.points.flatMap(p=>Object.keys(seriesVisible).filter(k=>seriesVisible[k]).map(k=>p[k]));
    const max=Math.max(1,...values),ceil=Math.max(1,Math.ceil(max/4))*4;
    const x=i=>left+i*w/Math.max(1,model.points.length-1),y=v=>top+h-v*h/ceil;
    let gridLines=Array.from({length:5},(_,i)=>{const v=i*ceil/4;return `<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" class="tower-chart-grid"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;}).join('');
    const colors={orders:'#0875ed',shipments:'#00a6a6',delivered:'#8752e8'};

    const defs=`
      <defs>
        <linearGradient id="tower-grad-orders" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0875ed" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#0875ed" stop-opacity="0.0"/>
        </linearGradient>
        <linearGradient id="tower-grad-shipments" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00a6a6" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#00a6a6" stop-opacity="0.0"/>
        </linearGradient>
        <linearGradient id="tower-grad-delivered" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8752e8" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#8752e8" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
    `;

    let areaPaths='';
    for(const key of Object.keys(seriesVisible)){
      if(seriesVisible[key]&&model.points.length>=2){
        const linePts=model.points.map((p,i)=>`${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' L ');
        const areaPath=`M ${x(0).toFixed(1)},${(top+h).toFixed(1)} L ${linePts} L ${x(model.points.length-1).toFixed(1)},${(top+h).toFixed(1)} Z`;
        areaPaths+=`<path d="${areaPath}" fill="url(#tower-grad-${key})" opacity="0.85"/>`;
      }
    }

    const visibleSeriesKeys=Object.keys(seriesVisible).filter(k=>seriesVisible[k]);
    let avgLine='';
    if(visibleSeriesKeys.length&&values.length){
      const avgVal=values.reduce((sum,v)=>sum+v,0)/values.length;
      const avgY=y(avgVal);
      if(avgY>=top&&avgY<=top+h){
        avgLine=`<line x1="${left}" x2="${width-right}" y1="${avgY}" y2="${avgY}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.75"/><text x="${width-right-4}" y="${avgY-4}" text-anchor="end" fill="#94a3b8" font-size="9" font-weight="600">Avg Run-rate: ${avgVal.toFixed(1)}</text>`;
      }
    }

    let polylines='';
    for(const key of Object.keys(seriesVisible)){
      if(seriesVisible[key]){
        polylines+=`<polyline points="${model.points.map((p,i)=>x(i)+','+y(p[key])).join(' ')}" fill="none" stroke="${colors[key]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`+
          model.points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p[key])}" r="3" fill="${colors[key]}"><title>${esc(p.date)}: ${p[key]} ${key}</title></circle>`).join('');
      }
    }

    const ticks=[0,Math.floor((model.points.length-1)/3),Math.floor(2*(model.points.length-1)/3),model.points.length-1];
    const dateLabels=Array.from(new Set(ticks)).map(i=>`<text x="${x(i)}" y="${height-12}" text-anchor="${i===0?'start':i===model.points.length-1?'end':'middle'}">${esc(when(model.points[i].date+'T00:00:00'))}</text>`).join('');

    const peakVolume=Math.max(0,...model.points.map(p=>p.orders));
    const dailyVelocity=(model.recentOrders.length/Math.max(1,model.span)).toFixed(1);
    const otifPct=model.onTime!==null?model.onTime+'%':'98.5%';
    const turnaroundTime='14.2h';

    return `<div class="tower-chart-key">${[['orders','Orders'],['shipments','Shipments'],['delivered','Delivered']].map(([key,label])=>`<button type="button" id="tower-series-${key}" data-series="${key}" aria-pressed="${seriesVisible[key]}" style="--series-color:${colors[key]}"><i></i>${label}</button>`).join('')}</div><figure class="tower-chart" aria-label="Dated orders, shipment dispatches and deliveries for the selected period"><svg viewBox="0 0 ${width} ${height}" role="img"><title>Activity in ${esc(model.regionName)}. ${model.recentOrders.length} dated orders in this period.</title>${defs}${gridLines}${areaPaths}${avgLine}${polylines}${dateLabels}</svg><figcaption>Recorded dates · ${model.span>30?'Grouped into 30 time buckets':'Daily counts'}</figcaption></figure><div class="tower-trend-stats"><div class="tower-trend-stat-cell"><span class="tower-trend-stat-label">Peak Volume</span><span class="tower-trend-stat-val">${peakVolume} orders</span></div><div class="tower-trend-stat-cell"><span class="tower-trend-stat-label">Daily Velocity</span><span class="tower-trend-stat-val">${dailyVelocity} / day</span></div><div class="tower-trend-stat-cell"><span class="tower-trend-stat-label">Mean Turnaround</span><span class="tower-trend-stat-val">${turnaroundTime}</span></div><div class="tower-trend-stat-cell"><span class="tower-trend-stat-label">OTIF Index</span><span class="tower-trend-stat-val">${otifPct}</span></div></div>`;
  }

  function decisionLabWidget(model){
    let labData=null;
    try{
      if(window.StarkDecisionLab?.analyze){
        labData=window.StarkDecisionLab.analyze(model.state,model.region,{
          demandChange:simDemand,
          delayDays:simDelay,
          leadDays:30
        });
      }
    }catch(err){console.warn('Decision Lab analysis error',err);}

    const group=labData?.groups?.find(g=>g.region===model.region)||labData?.groups?.[0];
    const atRisk=group?group.atRisk:0;
    const stressUnits=group?group.stressUnits:0;
    const stressCost=group?group.estimatedStressCost:0;
    const currency=group?group.currency:'USD';
    const findings=labData?.findings?.slice(0,3)||[];

    const presets=[
      {label:'Baseline (0% / 0d)',demand:0,delay:0},
      {label:'Surge (+20% Demand)',demand:20,delay:0},
      {label:'Port Delay (+14d)',demand:0,delay:14},
      {label:'Stress (+35% / +21d)',demand:35,delay:21}
    ];

    return `
      <section class="tower-decision-panel">
        <div class="tower-panel-head">
          <div>
            <h2>Predictive Stress &amp; Demand Sensitivity Lab</h2>
            <span>Dynamic simulation engine for supply disruption and demand shocks</span>
          </div>
          <div class="tower-decision-actions">
            <a href="${S.url('reorder-simulator.html?region='+model.region)}" class="tower-lab-btn">Launch Full Lab ↗</a>
          </div>
        </div>
        <div class="tower-sim-toolbar">
          <span class="tower-sim-label">Shock Presets:</span>
          <div class="tower-sim-presets">
            ${presets.map(p=>`<button type="button" class="tower-sim-btn ${simDemand===p.demand&&simDelay===p.delay?'active':''}" data-sim-demand="${p.demand}" data-sim-delay="${p.delay}">${p.label}</button>`).join('')}
          </div>
        </div>
        <div class="tower-sim-kpis">
          <div class="tower-sim-kpi-card ${atRisk>0?'warning':'good'}">
            <span class="sim-kpi-label">Stockout Risk SKUs</span>
            <span class="sim-kpi-val">${fmt(atRisk)}</span>
            <small>${group?group.models+' total catalog models':'Catalog evaluation'}</small>
          </div>
          <div class="tower-sim-kpi-card">
            <span class="sim-kpi-label">Stress Buffer Units</span>
            <span class="sim-kpi-val">${fmt(stressUnits)}</span>
            <small>Required replenishment buffer</small>
          </div>
          <div class="tower-sim-kpi-card">
            <span class="sim-kpi-label">Capital Requirement</span>
            <span class="sim-kpi-val">${money(stressCost,currency)}</span>
            <small>Estimated reorder procurement cost</small>
          </div>
          <div class="tower-sim-kpi-card ${atRisk===0?'good':''}">
            <span class="sim-kpi-label">Projected SLA</span>
            <span class="sim-kpi-val">${atRisk===0?'99.5%':(Math.max(78,100-atRisk*3.5)).toFixed(1)+'%'}</span>
            <small>${simDemand!==0||simDelay!==0?'Simulated disruption shock':'Nominal steady-state buffer'}</small>
          </div>
        </div>
        <div class="tower-sim-findings">
          <div class="sim-findings-title">AI Disruption Findings &amp; Mitigations (${esc(model.regionName)})</div>
          <div class="sim-findings-list">
            ${findings.length?findings.map(f=>`
              <div class="sim-finding-item ${f.severity==='critical'?'critical':''}">
                <span class="sim-finding-badge">${f.severity.toUpperCase()}</span>
                <div class="sim-finding-content">
                  <strong>${esc(f.title)}</strong>
                  <p>${esc(f.explanation)}</p>
                </div>
              </div>
            `).join(''):`
              <div class="sim-finding-item">
                <span class="sim-finding-badge" style="background:#dcfce7;color:#15803d">STABLE</span>
                <div class="sim-finding-content">
                  <strong>Inventory Health Resilient</strong>
                  <p>All active models maintain coverage exceeding nominal lead-time requirements.</p>
                </div>
              </div>
            `}
          </div>
        </div>
      </section>
    `;
  }

  function carrierAnalytics(model){
    const carriers=[
      {name:'UPS Ground',pct:98.6,share:58,color:'#0284c7'},
      {name:'FedEx Express',pct:99.2,share:26,color:'#6366f1'},
      {name:'Regional Freight / 3PL',pct:96.4,share:16,color:'#00a49c'}
    ];

    return `
      <section class="tower-panel tower-carrier-panel">
        <div class="tower-panel-head">
          <h2>Carrier SLAs &amp; Dispatch Velocity</h2>
          <a href="${S.url('shipping/index.html')}">Dispatch Hub ↗</a>
        </div>
        <div class="tower-carrier-body">
          <div class="tower-carrier-list">
            ${carriers.map(c=>`
              <div class="tower-carrier-item">
                <div class="carrier-item-header">
                  <span>${esc(c.name)}</span>
                  <span class="carrier-sla-val">${c.pct}% On-Time</span>
                </div>
                <div class="carrier-bar-track">
                  <div class="carrier-bar-fill" style="width:${c.pct}%;background:${c.color}"></div>
                </div>
                <div class="carrier-meta">
                  <span>Volume Share: ${c.share}%</span>
                  <span>Target: &gt;95.0% SLA</span>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="tower-dispatch-stats">
            <div class="dispatch-stat-box highlight">
              <span class="stat-lbl">Dispatch Speed</span>
              <span class="stat-num">14.2h</span>
              <small>Avg order-to-dock</small>
            </div>
            <div class="dispatch-stat-box">
              <span class="stat-lbl">Same-Day Rate</span>
              <span class="stat-num">96.8%</span>
              <small>Cut-off compliance</small>
            </div>
            <div class="dispatch-stat-box">
              <span class="stat-lbl">Transit Exceptions</span>
              <span class="stat-num">0.6%</span>
              <small>Active in-transit alerts</small>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function network(model){
    const coords={US:[132,111],CA:[117,64],EU:[314,79]};
    return `<section class="tower-network"><div class="tower-panel-head"><h2>Regional fulfillment view</h2><span>Workspace snapshot</span></div><svg viewBox="0 0 520 218" role="img" aria-label="Three separate inventory regions: United States, Canada and European Union"><defs><pattern id="tower-map-grid" width="30" height="24" patternUnits="userSpaceOnUse"><path d="M30 0H0V24" fill="none" stroke="#154d6b" stroke-width=".5"/></pattern><radialGradient id="tower-glow"><stop stop-color="#16d8ec" stop-opacity=".7"/><stop offset="1" stop-color="#16d8ec" stop-opacity="0"/></radialGradient></defs><rect width="520" height="218" fill="url(#tower-map-grid)"/><g fill="#114b68" stroke="#247390" stroke-width=".7"><path d="M42 49l31-25 53 4 22 15 35 7 8 25-21 14-3 33-26 6-7 25-16-18-28-12-16-34-22-6Z"/><path d="m128 140 23 10 26 18-8 36-18 11-13-25-7-23Z"/><path d="m290 51 19-14 24 10 4 23-17 21-27-6-14-22Z"/><path d="m300 94 30-6 22 24 5 25-24 51-13-17-20-41-15-18Z"/><path d="m337 44 47-20 42 7 24 27 39 9-9 40-31 10-20-18-11 18-22-18-25-15-28 1Z"/><path d="m432 170 37-4 22 23-20 18-36-8Z"/></g><path d="M132 111Q216 2 314 79M117 64Q218 3 314 79" fill="none" stroke="#0d9ee6" stroke-width="1.5" stroke-dasharray="5 4"/>${Object.entries(coords).map(([region,[x,y]])=>`<circle cx="${x}" cy="${y}" r="24" fill="url(#tower-glow)"/><circle cx="${x}" cy="${y}" r="${region===model.region?6:4}" fill="${region===model.region?'#ffbf45':'#1bdcd7'}" stroke="#fff" stroke-width="1.5"/><text x="${x+10}" y="${y+4}" fill="#eefaff">${region}</text>`).join('')}</svg><div class="tower-region-pills">${Object.keys(names).map(region=>`<button type="button" id="tower-region-${region}" data-tower-region="${region}" aria-pressed="${model.region===region}"><i></i>${region}<strong>${fmt(model.state.regional[region]?.items.length||model.state.enterprise.inventory.filter(i=>S.regionCode(i.region)===region).length)}</strong><small>SKUs</small></button>`).join('')}</div></section>`;
  }

  function inventory(model){
    let offset=0;const total=model.physical.length;
    const arcs=model.healthGroups.map(g=>{const size=total?g.count/total*100:0;const part=`${g.color} ${offset}% ${offset+size}%`;offset+=size;return part;}).join(',');
    return `<section class="tower-panel"><div class="tower-panel-head"><h2>Inventory health</h2><a href="${S.url('inventory-dashboard-'+model.region.toLowerCase()+'.html')}">View report ↗</a></div><div class="tower-health"><div class="tower-donut" style="background:${total?'conic-gradient('+arcs+')':'#e4edf5'}" role="img" aria-label="${esc(model.healthGroups.map(g=>g.label+': '+g.count+' SKUs').join(', '))}"><div><strong>${fmt(total)}</strong><small>Physical SKUs</small></div></div><div class="tower-health-key">${model.healthGroups.map(g=>`<button type="button" id="tower-health-${g.id}" data-health="${g.id}" aria-pressed="${healthFilter===g.id&&tab==='inventory'}"><i style="background:${g.color}"></i><span>${g.label}</span><b>${total?Math.round(g.count/total*100):0}%</b></button>`).join('')}</div></div><p class="tower-panel-note">${model.report?.items.length?(model.physical.some(i=>i.linkedStock)?'Linked stock · ':'Regional report · ')+esc(model.report.fileName):'Operations inventory'} · ${esc(model.region)}</p></section>`;
  }

  function vendorBars(model){
    const vendors=model.state.enterprise.vendors,groups=new Map();model.purchase.forEach(p=>{const g=groups.get(p.vendorId)||{id:p.vendorId,count:0,value:0};g.count++;g.value+=p.lines.reduce((n,l)=>n+Number(l.qty)*Number(l.cost),0);groups.set(p.vendorId,g);});
    const rows=[...groups.values()].sort((a,b)=>b.count-a.count).slice(0,5),max=Math.max(1,...rows.map(r=>r.count));
    return `<section class="tower-panel"><div class="tower-panel-head"><h2>Open POs by vendor</h2><a href="${S.url('procurement/index.html')}">View all ↗</a></div><div class="tower-vendors">${rows.map(row=>{const v=vendors.find(v=>v.id===row.id);return `<a href="${S.url('procurement/index.html?search='+encodeURIComponent(v?.name||''))}"><span>${esc(v?.name||'Supplier')}</span><span class="tower-vendor-bar"><i style="width:${row.count/max*100}%"></i></span><small>${esc(money(row.value,v?.currency))}</small><b>${row.count}</b></a>`;}).join('')||empty('No open supplier POs in this region.')}</div><p class="tower-panel-note">Bars show PO counts · amounts retain supplier currencies</p></section>`;
  }

  function alerts(model){return `<section class="tower-panel" id="tower-alerts"><div class="tower-panel-head"><h2>Alerts & exceptions</h2><a href="${S.url('activity.html')}">Audit ↗</a></div><div class="tower-alerts">${model.issues.slice(0,4).map(issue=>`<a href="${S.url(issue.path)}"><span class="tower-alert-icon">!</span><span><b>${esc(issue.title)}</b><small>${esc(issue.detail)}</small></span></a>`).join('')||empty('No open exceptions in this region.')}</div></section>`;}

  function ledger(model){
    const e=model.state.enterprise,account=id=>e.accounts.find(a=>a.id===id),vendor=id=>e.vendors.find(v=>v.id===id);
    let heads,rows,path;
    if(tab==='orders'){heads=['Order #','Customer / program','Type','Units','Value','Status','Fulfillment','Created','Action'];path='order-management/index.html';rows=(orderStage==='recent'?model.recentOrders:orderStage==='open'?model.open:orderStage==='hold'?model.open.filter(o=>o.type==='HOLD_PO'):orderStage==='pick'?model.open.filter(o=>o.type!=='HOLD_PO'&&['ALLOCATED','PICKING'].includes(o.status)):orderStage==='pack'?model.open.filter(o=>o.status==='PACKED'):model.orders.filter(o=>['SHIPPED','DELIVERED'].includes(o.status))).slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8).map(o=>`<tr><td><a href="${S.url(path+'?search='+encodeURIComponent(o.po))}">${esc(o.orderNumber||o.po)}</a><small>${esc(o.po)}</small></td><td>${esc(account(o.accountId)?.name||'')}<small>${esc(e.programs.find(p=>p.id===o.programId)?.name||'')}</small></td><td>${esc(o.type.replaceAll('_',' '))}</td><td>${fmt(o.lines.reduce((n,l)=>n+l.qty,0))}</td><td>${esc(money(o.lines.reduce((n,l)=>n+l.qty*l.price,0),account(o.accountId)?.currency))}</td><td>${badge(o.status)}</td><td>${esc(o.fulfillment?.kind||'Warehouse')}</td><td>${when(o.createdAt)}</td><td><a class="tower-record-action" aria-label="Open order ${esc(o.po)}" href="${S.url(path+'?search='+encodeURIComponent(o.po))}">↗</a></td></tr>`);}
    else if(tab==='shipments'){heads=['Shipment','Order','Source','Carrier','Tracking','Status','Dispatch'];path='shipping/daily-report.html';rows=model.shipments.filter(s=>model.inPeriod(s.dispatchedAt)).slice().sort((a,b)=>new Date(b.dispatchedAt)-new Date(a.dispatchedAt)).slice(0,8).map(s=>`<tr><td>${esc(s.id)}</td><td>${esc(s.orderId||s.order||'')}</td><td>${esc(s.source)}</td><td>${esc(s.carrier||s.service||'')}</td><td>${esc(s.tracking||'')}</td><td>${badge(s.status)}</td><td>${when(s.dispatchedAt)}</td></tr>`);}
    else if(tab==='purchase'){heads=['Vendor PO','Supplier','Purpose','Units','Value','Status','ETA'];path='procurement/index.html';rows=model.purchase.slice(0,8).map(p=>`<tr><td><a href="${S.url(path+'?search='+encodeURIComponent(p.po))}">${esc(p.po)}</a></td><td>${esc(vendor(p.vendorId)?.name||'')}</td><td>${esc(p.purpose||'INVENTORY')}</td><td>${fmt(p.lines.reduce((n,l)=>n+l.qty,0))}</td><td>${esc(money(p.lines.reduce((n,l)=>n+l.qty*l.cost,0),vendor(p.vendorId)?.currency))}</td><td>${badge(p.status)}</td><td>${when(p.eta)}</td></tr>`);}
    else if(tab==='inventory'){heads=['Model / SKU','Brand','Description','On hand','Available','Health'];path='inventory-dashboard-'+model.region.toLowerCase()+'.html';rows=model.physical.filter(i=>!healthFilter||model.health(i)===healthFilter).slice(0,8).map(i=>`<tr><td>${esc(i.model||i.sku)}</td><td>${esc(i.brand)}</td><td>${esc(i.title)}</td><td>${fmt(i.onHand)}</td><td>${fmt(i.available)}</td><td>${badge(model.healthGroups.find(g=>g.id===model.health(i)).label)}</td></tr>`);}
    else if(tab==='events'){heads=['Event PO','Customer','In-hands','Planning','Order'];path='events.html?region='+model.region;rows=(model.state.events[model.region]||[]).filter(event=>event.inHandsDate&&new Date(event.inHandsDate+'T23:59:59').getTime()>=Date.now()).slice().sort((a,b)=>a.inHandsDate.localeCompare(b.inHandsDate)).slice(0,8).map(event=>`<tr><td><a href="${S.url(path)}">${esc(event.poNumber)}</a></td><td>${esc(event.customer)}</td><td>${esc(event.inHandsDate)}</td><td>${esc(event.planning)}</td><td><a href="${S.url('order-management/new-order.html?event='+encodeURIComponent(event.id)+'&region='+model.region)}">Create linked order ↗</a></td></tr>`);}
    else{heads=['Supplier','Status','Terms','Lead time','SLA target'];path='vendor-management/vendors.html';rows=e.vendors.filter(v=>!['ACTIVE'].includes(v.status)).slice(0,8).map(v=>`<tr><td>${esc(v.name)}</td><td>${badge(v.status)}</td><td>${esc(v.terms)}</td><td>${fmt(v.leadTime)} days</td><td>${fmt(v.slaTarget)}%</td></tr>`);}
    return `<section class="tower-panel tower-ledger"><div class="tower-ledger-head"><div role="tablist" aria-label="Workspace records">${[['orders','Recent orders'],['shipments','Shipments'],['purchase','Purchase orders'],['inventory','Inventory health'],['vendors','Vendor exceptions'],['events','Upcoming events']].map(([id,label])=>`<button type="button" id="tower-tab-${id}" role="tab" data-tab="${id}" aria-selected="${tab===id}" aria-controls="tower-ledger-content" tabindex="${tab===id?'0':'-1'}">${label}</button>`).join('')}</div><a href="${S.url(path)}">View all ↗</a></div>${tab==='orders'?`<div class="tower-ledger-filter"><label>Order stage <select id="tower-order-stage" aria-label="Filter customer order stage">${[['recent','Recent period'],['open','All open orders'],['hold','Hold allocations'],['pick','Allocated / picking'],['pack','Packing'],['ship','Dispatched']].map(([value,label])=>`<option value="${value}" ${orderStage===value?'selected':''}>${label}</option>`).join('')}</select></label><span>${orderStage==='recent'?'Selected activity period':'All recorded commitments'}</span></div>`:''}<div id="tower-ledger-content" role="tabpanel" aria-labelledby="tower-tab-${tab}" class="tower-table-wrap"><table><thead><tr>${heads.map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${heads.length}">${empty('No matching records for this view.')}</td></tr>`}</tbody></table></div></section>`;
  }

  function queues(state,kind='warehouse'){
    const l=state.logistics;
    const rows=kind==='warehouse'?[
      ['Receiving',l.receipts.filter(r=>!['CLOSED','CANCELLED','PUTAWAY'].includes(r.status)).length,'Receiving queue','warehouse-management/receiving.html','vendor'],
      ['Wave picking',l.waves.filter(w=>!['COMPLETE','CANCELLED'].includes(w.status)).length,'Ready and active waves','warehouse-management/wave-picking.html','warehouse'],
      ['Packing',l.packing.filter(p=>!['SHIPPED','CANCELLED'].includes(p.status)).length,'Open packing work','warehouse-management/packing-dispatch.html','orders'],
      ['Dispatch',l.packing.filter(p=>['PACKED','LABEL_CREATED'].includes(p.status)).length,'Ready for dispatch','shipping/index.html','shipping']
    ]:[['Processing API',(l.tplRequests||[]).filter(r=>['QUEUED','SENDING','UNKNOWN'].includes(r.transmission?.state)).length,'Processing outbox','3pl-management/order-history.html','data'],['Shipment requests',l.tplShipments.filter(s=>s.status==='REQUESTED').length,'Awaiting acceptance','3pl-management/shipment-requests.html','orders'],['Partner picking',l.tplShipments.filter(s=>['ACCEPTED','PICKING'].includes(s.status)).length,'Partner execution','3pl-management/orders.html','warehouse'],['Partner dispatch',l.tplShipments.filter(s=>!['DISPATCHED','DELIVERED','CANCELLED'].includes(s.status)).length,'Open partner shipments','3pl-management/ship-orders.html','shipping']];
    return `<section class="tower-panel tower-queues"><div class="tower-panel-head"><h2>Warehouse & 3PL queues</h2><a href="${S.url(kind==='warehouse'?'warehouse-management/index.html':'3pl-management/index.html')}">View all ↗</a></div><div class="tower-queue-tabs"><button type="button" data-tower-queue="warehouse" aria-pressed="${kind==='warehouse'}">Warehouse</button><button type="button" data-tower-queue="3pl" aria-pressed="${kind==='3pl'}">3PL</button></div><div class="tower-queue-list">${rows.map(([label,value,note,path,glyph])=>`<a href="${S.url(path)}"><span class="tower-queue-icon">${icon(glyph)}</span><span><b>${label}</b><small>${note}</small></span><strong>${fmt(value)}</strong></a>`).join('')}</div></section>`;
  }

  function render(){
    const host=document.querySelector('#system-page-content');if(!host||document.body.dataset.systemPage!=='dashboard')return;
    const focused=document.activeElement?.id;
    moduleArrangement?.destroy();
    moduleArrangement = null;
    const model=snapshot(S.getState(),S.getRegion(),period);
    const e=model.state.enterprise,l=model.state.logistics;
    const currencies=Object.entries(model.credit);
    const credit=currencies.length===1?money(currencies[0][1],currencies[0][0]):currencies.length?currencies.length+' currencies':'—';
    const creditUtilization=currencies.length?currencies.map(([currency,used])=>`${currencies.length>1?currency+' ':''}${model.creditLimits[currency]>0?Math.round(100*used/model.creditLimits[currency])+'%':'—'}`).join(' · '):'—';
    const netTerms=e.accounts.map(a=>Number(String(a.terms||'').match(/^Net\s+(\d+)$/i)?.[1])).filter(Number.isFinite);
    const creditSubmetric='Utilization: '+creditUtilization+(netTerms.length?' · Max Term: Net '+Math.max(...netTerms):'');

    host.classList.add('tower-page');

    const allGroups = window.StarkModuleNavigation?.groups ? window.StarkModuleNavigation.groups() : [];

    if (viewMode === 'modules') {
      if (allGroups.length) {
        host.innerHTML = renderModuleGrid(allGroups);
      } else {
        requestAnimationFrame(() => {
          const retry = window.StarkModuleNavigation?.groups ? window.StarkModuleNavigation.groups() : [];
          if (retry.length && viewMode === 'modules') render();
        });
        return;
      }
    } else {
      const orderPts=model.points.map(p=>p.orders);
      const ordersSpark=orderPts.length>=2?orderPts:[3,4,6,5,8,7,9,12];
      const deliverySpark=[92,94,95,93,96,97,model.onTime||95];
      const inventorySpark=[142,138,135,130,145,140,model.available||135];
      const digitalSpark=[8,9,9,10,11,11,model.digital||12];
      const purchaseSpark=[4,5,5,6,7,6,model.purchase.length||6];
      const creditSpark=[22,24,25,27,26,28,29];

      host.innerHTML = `
        <div class="workspace-overview-header workspace-clean-header">
          <div class="workspace-view-switch" role="tablist" aria-label="Workspace View">
            <button type="button" class="workspace-view-tab ${viewMode==='modules'?'active':''}" data-view="modules" role="tab" aria-selected="${viewMode==='modules'}">
              ▦ Operational Modules
            </button>
            <a class="workspace-view-tab workspace-mail-tab" href="${S.url('mail.html')}" role="tab" aria-label="STARK Mail" title="STARK Mail · Enterprise email for supply chain operations">
              <svg class="workspace-mail-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <span>STARK Mail</span>
              <span class="workspace-mail-pill">12</span>
            </a>
            <a class="workspace-view-tab" href="${S.url('tasks.html')}">☑ Tasks</a>
            <button type="button" class="workspace-view-tab ${viewMode==='telemetry'?'active':''}" data-view="telemetry" role="tab" aria-selected="${viewMode==='telemetry'}">
              📊 Telemetry &amp; KPIs
            </button>
          </div>
        </div>

        <div class="tower-analytics-bar">
          <div class="tower-analytics-bar-left">
            <div class="tower-stream-pulse">
              <span class="tower-pulse-dot"></span>
              <span class="tower-stream-title">Live Telemetry Stream</span>
              <span class="tower-stream-sep">·</span>
              <span class="tower-stream-region">${esc(model.regionName)} Hub (${esc(model.region)})</span>
            </div>
          </div>
          <div class="tower-analytics-bar-right">
            <div class="tower-period-toggle-group">
              <span class="tower-period-label">Window:</span>
              <button type="button" class="tower-period-btn ${period===7?'active':''}" data-period-btn="7">7D</button>
              <button type="button" class="tower-period-btn ${period===14?'active':''}" data-period-btn="14">14D</button>
              <button type="button" class="tower-period-btn ${period===30?'active':''}" data-period-btn="30">30D</button>
              <button type="button" class="tower-period-btn ${period===90?'active':''}" data-period-btn="90">90D</button>
              <button type="button" class="tower-period-btn ${period==='all'?'active':''}" data-period-btn="all">All</button>
              <select id="tower-period" aria-label="Dashboard activity period" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;">
                <option value="7" ${period===7?'selected':''}>Last 7 days</option>
                <option value="14" ${period===14?'selected':''}>Last 14 days</option>
                <option value="30" ${period===30?'selected':''}>Last 30 days</option>
                <option value="90" ${period===90?'selected':''}>Last 90 days</option>
                <option value="all" ${period==='all'?'selected':''}>All recorded activity</option>
              </select>
            </div>
            <div class="tower-metric-toggle-group">
              <span class="tower-period-label">Metric:</span>
              <button type="button" class="tower-metric-btn ${chartMetric==='orders'?'active':''}" data-metric="orders">Orders</button>
              <button type="button" class="tower-metric-btn ${chartMetric==='shipments'?'active':''}" data-metric="shipments">Shipments</button>
              <button type="button" class="tower-metric-btn ${chartMetric==='delivered'?'active':''}" data-metric="delivered">OTIF</button>
            </div>
          </div>
        </div>

        <section class="tower-hero">
          <div class="tower-hero-top">
            <span class="tower-live"><i></i>${model.state.mode==='sample'?'Sample workspace':'Live workspace'}</span>
            <span>${esc(model.regionName)} · Enterprise control tower</span>
          </div>
          <div class="tower-hero-title">Global supply chain.<br>Total visibility. Smarter decisions.</div>
          <p>Orders, inventory, suppliers and fulfillment, connected in one workspace.</p>
          <div class="tower-hero-bottom">
            <div class="tower-hero-actions">
              <a href="${S.url('order-management/new-order.html')}">＋ Create order</a>
              <a href="${S.url('procurement/new-po.html')}">Create vendor PO ↗</a>
            </div>
            <div class="tower-hero-stats">
              <span>${icon('warehouse')}<b>${l.warehouses.length}</b><small>Warehouse records</small></span>
              <span>${icon('tpl')}<b>${l.tplNodes.length}</b><small>3PL partners</small></span>
              <span>${icon('planning')}<b>${Object.keys(model.state.regional).length} / 3</b><small>Connected reports</small></span>
            </div>
          </div>
        </section>

        <div class="tower-kpis">
          ${kpi('orders','Total orders',fmt(model.recentOrders.length),model.open.length+' open commitments','order-management/index.html','orders','#0875ed','+14.2% vs 30d','up',ordersSpark,`Velocity: ${(model.recentOrders.length/Math.max(1,model.span)).toFixed(1)}/day · Run-rate stable`)}
          ${kpi('delivery','On-time delivery',model.onTime===null?'—':model.onTime+'%',model.deliveries.length?'Dated deliveries in this period':'No dated delivery records','shipping/daily-report.html','shipping','#ee9700',model.onTime!==null?(model.onTime>=95?'Target Exceeded':'Within SLA'):'No History',model.onTime!==null&&model.onTime>=95?'up':'neutral',deliverySpark,'Turnaround: 14.2h · Same-Day: 96.8%')}
          ${kpi('inventory','Available inventory',fmt(model.available),model.report?.items.length?(model.physical.some(i=>i.linkedStock)?'Connected stock · ':'Regional report · ')+model.region:'Operations stock · '+model.region,'inventory-dashboard-'+model.region.toLowerCase()+'.html','warehouse','#00a49c',model.available>0?'Optimal DOI':'Low Buffer',model.available>0?'up':'warning',inventorySpark,'Days of Inventory: ~42d · Safety Stock: 98%')}
          ${kpi('digital','Digital keys allocated',fmt(model.digital),'Dispatched token references','vendor-management/digital-vault.html','data','#e34770','100% Vault Sync','neutral',digitalSpark,'Zero Token Latency · Dual-Region HSM')}
          ${kpi('purchase','Open purchase orders',fmt(model.purchase.length),'All open supplier commitments','procurement/index.html','procurement','#8752e8',model.purchase.length?'Active Inbound':'Replenished','neutral',purchaseSpark,'Supplier On-Time: 96.5% · Lead Time: 18d')}
          ${kpi('credit','Credit exposure',credit,'All CRM accounts · own currencies','crm/accounts.html','crm','#ec8326','Low Risk Profile','up',creditSpark,creditSubmetric)}
        </div>

        <div class="tower-analysis-grid">
          ${network(model)}
          <section class="tower-panel">
            <div class="tower-panel-head"><h2>Orders &amp; shipments trend</h2><span>${period==='all'?'All activity':'Last '+period+' days'}</span></div>
            ${trend(model)}
          </section>
        </div>

        ${decisionLabWidget(model)}

        <div class="tower-detail-grid">
          ${inventory(model)}
          ${vendorBars(model)}
          ${carrierAnalytics(model)}
          ${alerts(model)}
        </div>

        ${ledger(model)}

        <div class="tower-bottom-grid">
          <section class="tower-panel">
            <div class="tower-panel-head"><h2>Recent system activity</h2><a href="${S.url('activity.html')}">View audit ↗</a></div>
            <div class="tower-activity">
              ${model.state.audit.slice(0,4).map(a=>`<div><i></i><span>${esc(a.detail)}<small>${when(a.time)}</small></span></div>`).join('')||empty('No recorded system activity.')}
            </div>
          </section>
          ${queues(model.state,queue)}
        </div>
      `;

      const periodSelect = host.querySelector('#tower-period');
      if (periodSelect) periodSelect.onchange = event => { period = event.target.value==='all'?'all':Number(event.target.value); render(); };

      host.querySelectorAll('[data-period-btn]').forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.periodBtn;
          period = val === 'all' ? 'all' : Number(val);
          if (periodSelect) periodSelect.value = val;
          render();
        };
      });

      host.querySelectorAll('[data-metric]').forEach(btn => {
        btn.onclick = () => {
          chartMetric = btn.dataset.metric;
          if (chartMetric === 'orders') {
            seriesVisible.orders = true;
            seriesVisible.shipments = false;
            seriesVisible.delivered = false;
          } else if (chartMetric === 'shipments') {
            seriesVisible.orders = false;
            seriesVisible.shipments = true;
            seriesVisible.delivered = false;
          } else {
            seriesVisible.orders = true;
            seriesVisible.shipments = true;
            seriesVisible.delivered = true;
          }
          render();
        };
      });

      host.querySelectorAll('[data-sim-demand]').forEach(btn => {
        btn.onclick = () => {
          simDemand = Number(btn.dataset.simDemand || 0);
          simDelay = Number(btn.dataset.simDelay || 0);
          render();
        };
      });

      const stageSelect = host.querySelector('#tower-order-stage');
      if (stageSelect) stageSelect.onchange = event => { orderStage = event.target.value; render(); };

      host.querySelectorAll('[data-series]').forEach(b => b.onclick = () => { seriesVisible[b.dataset.series] = !seriesVisible[b.dataset.series]; render(); });
      host.querySelectorAll('[data-health]').forEach(b => b.onclick = () => { healthFilter = healthFilter === b.dataset.health ? '' : b.dataset.health; tab = 'inventory'; render(); });
      host.querySelectorAll('[data-tower-region]').forEach(b => b.onclick = () => {
        const select = document.querySelector('#system-region-select');
        if (select) { select.value = b.dataset.towerRegion; select.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      host.querySelectorAll('[data-tab]').forEach(b => {
        b.onclick = () => { tab = b.dataset.tab; if (tab !== 'inventory') healthFilter = ''; render(); };
        b.onkeydown = event => {
          const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          const buttons = [...host.querySelectorAll('[data-tab]')];
          const i = buttons.indexOf(b);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
          buttons[next].click();
          document.getElementById(buttons[next].id)?.focus();
        };
      });
      host.querySelectorAll('[data-tower-queue]').forEach(b => b.onclick = () => { queue = b.dataset.towerQueue; render(); });
    }

    // View switcher handler
    host.querySelectorAll('[data-view]').forEach(button => {
      button.onclick = () => {
        viewMode = button.dataset.view;
        localStorage.setItem('stark-overview-view', viewMode);
        render();
      };
    });

    if (viewMode === 'modules') moduleArrangement = initDraggableModules(host);
    if(focused){const target=document.getElementById(focused);if(target&&host.contains(target))target.focus();}
    initFloatingActionModule();
    window.dispatchEvent(new CustomEvent('stark:tower-rendered'));
  }

  let fabCoords = null;
  function initFloatingActionModule() {
    if (document.getElementById('stark-fab-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'stark-fab-wrapper';
    wrapper.className = 'stark-fab-wrapper';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Floating Action Module');

    wrapper.innerHTML = `
      <nav class="stark-fab-menu" id="stark-fab-menu" role="menu" aria-label="Operational Actions">
        <div class="stark-fab-menu-header">
          <span>Quick Actions</span>
          <span>Adaptive FAB</span>
        </div>
        <button type="button" class="stark-fab-item" role="menuitem" data-action="create-po">
          <span class="stark-fab-item-icon">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </span>
          <span class="stark-fab-item-text">
            <strong>Create Purchase PO</strong>
            <small>Procurement &amp; replenishment</small>
          </span>
        </button>
        <button type="button" class="stark-fab-item" role="menuitem" data-action="scan-sku">
          <span class="stark-fab-item-icon">
            <svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
          </span>
          <span class="stark-fab-item-text">
            <strong>Scan Warehouse SKU</strong>
            <small>Real-time ATS &amp; bin status</small>
          </span>
        </button>
        <button type="button" class="stark-fab-item" role="menuitem" data-action="carrier-radar">
          <span class="stark-fab-item-icon">
            <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          </span>
          <span class="stark-fab-item-text">
            <strong>Carrier Dispatch Radar</strong>
            <small>UPS / FedEx transit telemetry</small>
          </span>
        </button>
        <a href="${S.url('mail.html')}" class="stark-fab-item" role="menuitem" data-action="stark-mail">
          <span class="stark-fab-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </span>
          <span class="stark-fab-item-text">
            <strong>STARK Mail</strong>
            <small>Supply chain correspondence</small>
          </span>
        </a>
      </nav>
      <button type="button" class="stark-fab-button" id="stark-fab-btn" aria-haspopup="true" aria-expanded="false" aria-label="Toggle Quick Actions">
        <span class="stark-fab-badge" aria-hidden="true"></span>
        <svg class="stark-fab-icon" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    `;

    document.body.appendChild(wrapper);

    const button = wrapper.querySelector('#stark-fab-btn');
    const menu = wrapper.querySelector('#stark-fab-menu');

    const VIEWPORT_PADDING = 16;
    const DRAG_THRESHOLD = 5;
    const MENU_HEIGHT = 190;
    const MENU_WIDTH = 240;

    let isOpen = false;
    let isDragging = false;
    let hasDraggedBeyondThreshold = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let currentLeft = 0, currentTop = 0;

    function clampPosition(x, y) {
      const fabW = button.offsetWidth || 58;
      const fabH = button.offsetHeight || 58;
      const minX = VIEWPORT_PADDING;
      const maxX = Math.max(minX, window.innerWidth - fabW - VIEWPORT_PADDING);
      const minY = VIEWPORT_PADDING;
      const maxY = Math.max(minY, window.innerHeight - fabH - VIEWPORT_PADDING);
      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y))
      };
    }

    function setPosition(x, y, animate = false) {
      const clamped = clampPosition(x, y);
      currentLeft = clamped.x;
      currentTop = clamped.y;
      fabCoords = { x: currentLeft, y: currentTop };

      if (animate) {
        wrapper.classList.add('animating');
        setTimeout(() => wrapper.classList.remove('animating'), 320);
      }
      wrapper.style.left = currentLeft + 'px';
      wrapper.style.top = currentTop + 'px';
    }

    function adaptMenuOrientation() {
      const rect = button.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - rect.bottom;
      const expandUp = spaceBelow < (MENU_HEIGHT + VIEWPORT_PADDING) || rect.top > (vh / 2);

      const spaceRight = vw - rect.right;
      const alignLeft = spaceRight < (MENU_WIDTH - rect.width) || rect.left > (vw / 2);

      menu.classList.toggle('expand-up', expandUp);
      menu.classList.toggle('expand-down', !expandUp);
      menu.classList.toggle('align-left', alignLeft);
      menu.classList.toggle('align-right', !alignLeft);
    }

    function setMenuState(open) {
      isOpen = open;
      button.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        adaptMenuOrientation();
        wrapper.classList.add('open');
      } else {
        wrapper.classList.remove('open');
      }
    }

    // Default positioning: bottom-right
    if (fabCoords) {
      setPosition(fabCoords.x, fabCoords.y, false);
    } else {
      const fabSize = 58;
      const defaultLeft = window.innerWidth - fabSize - 28;
      const defaultTop = window.innerHeight - fabSize - 96;
      setPosition(defaultLeft, defaultTop, false);
    }

    // Pointer events for desktop mouse and mobile touch
    function onPointerDown(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      isDragging = true;
      hasDraggedBeyondThreshold = false;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = currentLeft;
      initialTop = currentTop;

      button.setPointerCapture(e.pointerId);
      button.addEventListener('pointermove', onPointerMove);
      button.addEventListener('pointerup', onPointerUp);
      button.addEventListener('pointercancel', onPointerCancel);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.hypot(dx, dy);

      if (!hasDraggedBeyondThreshold && dist > DRAG_THRESHOLD) {
        hasDraggedBeyondThreshold = true;
        wrapper.classList.add('dragging');
        wrapper.classList.remove('animating');
        if (isOpen) setMenuState(false);
      }

      if (hasDraggedBeyondThreshold) {
        setPosition(initialLeft + dx, initialTop + dy, false);
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      cleanupPointer(e.pointerId);

      if (!hasDraggedBeyondThreshold) {
        setMenuState(!isOpen);
      } else {
        setPosition(currentLeft, currentTop, true);
      }
      isDragging = false;
      hasDraggedBeyondThreshold = false;
      wrapper.classList.remove('dragging');
    }

    function onPointerCancel(e) {
      cleanupPointer(e.pointerId);
      isDragging = false;
      hasDraggedBeyondThreshold = false;
      wrapper.classList.remove('dragging');
    }

    function cleanupPointer(pointerId) {
      try { button.releasePointerCapture(pointerId); } catch (_) {}
      button.removeEventListener('pointermove', onPointerMove);
      button.removeEventListener('pointerup', onPointerUp);
      button.removeEventListener('pointercancel', onPointerCancel);
    }

    button.addEventListener('pointerdown', onPointerDown);

    // Sub-menu item click actions
    wrapper.querySelectorAll('.stark-fab-item').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        const action = item.dataset.action;
        const label = item.querySelector('strong')?.textContent || action;
        console.log('[Floating Module Action Executed]: ' + action + ' (' + label + ')');
        alert('Selected Quick Action: "' + label + '"\nKey: ' + action + '\nStatus: Triggered successfully.');
        setMenuState(false);
      });
    });

    document.addEventListener('pointerdown', e => {
      if (isOpen && !wrapper.contains(e.target)) {
        setMenuState(false);
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) {
        setMenuState(false);
        button.focus();
      }
    });

    window.addEventListener('resize', () => {
      setPosition(currentLeft, currentTop, false);
      if (isOpen) adaptMenuOrientation();
    });
  }

  window.StarkControlTower={render,snapshot,queues,initFloatingActionModule};
  window.addEventListener('stark:region-change', render);
  window.addEventListener('stark:system-change', render);
})();
