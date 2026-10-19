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
  let viewMode=localStorage.getItem('stark-overview-view')||'modules';
  const seriesVisible={orders:true,shipments:true,delivered:true};

  function snapshot(state,region,days=30,now=new Date()){
    days=days==='all'?'all':[30,90].includes(Number(days))?Number(days):30;
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
    const credit={};e.accounts.forEach(a=>{const c=a.currency||'USD';credit[c]=(credit[c]||0)+n(a.creditUsed);});
    const digital=e.vaultTokens.filter(t=>t.state==='DISPATCHED'&&itemRegion(bySku.get(t.sku))===region).length;
    const issues=S.issues().filter(issue=>{const o=e.orders.find(o=>issue.title.startsWith(o.po+':'));if(o)return matches(o);const p=e.purchaseOrders.find(p=>issue.title.startsWith(p.po+':'));if(p)return supplierPOs.some(x=>x.id===p.id);const i=e.inventory.find(i=>issue.title.startsWith(i.sku+':'));return !i||itemRegion(i)===region;});
    return {state,region,regionName:names[region],orders,open,purchase,supplierPOs,physical,health,healthGroups,report,shipments,recentOrders,deliveries,onTime,points,credit,digital,issues,span,inPeriod,available:physical.reduce((v,i)=>v+i.available,0)};
  }

  const icon=name=>window.StarkSystemUI?.glyph(name)||'';
  const empty=text=>'<div class="tower-empty">'+esc(text)+'</div>';
  const badge=status=>'<span class="tower-badge" data-status="'+esc(status)+'">'+esc(String(status).replaceAll('_',' '))+'</span>';
  function kpi(id,label,value,foot,path,glyph,color){return `<a class="tower-kpi" data-kpi="${id}" href="${S.url(path)}" style="--tower-accent:${color}"><span class="tower-kpi-icon">${icon(glyph)}</span><span class="tower-kpi-label">${esc(label)}</span><strong data-kpi-value>${esc(value)}</strong><small>${esc(foot)}</small></a>`;}

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
      <div class="workspace-overview-header">
        <div class="workspace-overview-meta">
          <span class="workspace-overview-badge"><i></i>Connected Operational Workspace</span>
          <h1>Supply Chain Intelligence</h1>
          <p>Integrated operational modules for global replenishment, orders, warehousing, partner 3PL and transportation.</p>
        </div>
        <div class="workspace-view-switch" role="tablist" aria-label="Workspace View">
          <button type="button" class="workspace-view-tab ${viewMode==='modules'?'active':''}" data-view="modules" role="tab" aria-selected="${viewMode==='modules'}">
            ▦ Operational Modules
          </button>
          <button type="button" class="workspace-view-tab ${viewMode==='telemetry'?'active':''}" data-view="telemetry" role="tab" aria-selected="${viewMode==='telemetry'}">
            📊 Telemetry &amp; KPIs
          </button>
        </div>
      </div>

      <div class="module-overview-grid">
        ${allGroups.map(([id, label, subtitle, color, items, primaryUrl, quickAction]) => `
          <article class="module-overview-card" style="--card-accent:${color}">
            <header class="module-card-head">
              <span class="module-card-icon" style="background:${color}">${icon(id)}</span>
              <div class="module-card-titles">
                <h2>${esc(label)}</h2>
                <small>${esc(subtitle)}</small>
              </div>
            </header>
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
          </article>
        `).join('')}
      </div>
    `;
  }

  function trend(model){
    const width=600,height=220,left=44,right=18,top=18,bottom=38,w=width-left-right,h=height-top-bottom;
    const values=model.points.flatMap(p=>Object.keys(seriesVisible).filter(k=>seriesVisible[k]).map(k=>p[k]));
    const max=Math.max(1,...values),ceil=Math.max(1,Math.ceil(max/4))*4;
    const x=i=>left+i*w/Math.max(1,model.points.length-1),y=v=>top+h-v*h/ceil;
    let shapes=Array.from({length:5},(_,i)=>{const v=i*ceil/4;return `<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" class="tower-chart-grid"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;}).join('');
    const colors={orders:'#0875ed',shipments:'#00a6a6',delivered:'#8752e8'};
    for(const key of Object.keys(seriesVisible))if(seriesVisible[key])shapes+=`<polyline points="${model.points.map((p,i)=>x(i)+','+y(p[key])).join(' ')}" fill="none" stroke="${colors[key]}" stroke-width="2.5"/>`+model.points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p[key])}" r="3" fill="${colors[key]}"><title>${esc(p.date)}: ${p[key]} ${key}</title></circle>`).join('');
    const ticks=[0,Math.floor((model.points.length-1)/3),Math.floor(2*(model.points.length-1)/3),model.points.length-1];
    shapes+=Array.from(new Set(ticks)).map(i=>`<text x="${x(i)}" y="${height-12}" text-anchor="${i===0?'start':i===model.points.length-1?'end':'middle'}">${esc(when(model.points[i].date+'T00:00:00'))}</text>`).join('');
    return `<div class="tower-chart-key">${[['orders','Orders'],['shipments','Shipments'],['delivered','Delivered']].map(([key,label])=>`<button type="button" id="tower-series-${key}" data-series="${key}" aria-pressed="${seriesVisible[key]}" style="--series-color:${colors[key]}"><i></i>${label}</button>`).join('')}</div><figure class="tower-chart" aria-label="Dated orders, shipment dispatches and deliveries for the selected period"><svg viewBox="0 0 ${width} ${height}" role="img"><title>Activity in ${esc(model.regionName)}. ${model.recentOrders.length} dated orders in this period.</title>${shapes}</svg><figcaption>Recorded dates · ${model.span>30?'Grouped into 30 time buckets':'Daily counts'}</figcaption></figure>`;
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
    const model=snapshot(S.getState(),S.getRegion(),period);
    const e=model.state.enterprise,l=model.state.logistics;
    const currencies=Object.entries(model.credit);
    const credit=currencies.length===1?money(currencies[0][1],currencies[0][0]):currencies.length?currencies.length+' currencies':'—';

    host.classList.add('tower-page');

    const allGroups = window.StarkModuleNavigation?.groups ? window.StarkModuleNavigation.groups() : [];

    if (viewMode === 'modules') {
      if (allGroups.length) {
        host.innerHTML = renderModuleGrid(allGroups);
      } else {
        requestAnimationFrame(() => {
          const retry = window.StarkModuleNavigation?.groups ? window.StarkModuleNavigation.groups() : [];
          if (retry.length && viewMode === 'modules') host.innerHTML = renderModuleGrid(retry);
        });
        return;
      }
    } else {
      host.innerHTML = `
        <div class="workspace-overview-header">
          <div class="workspace-overview-meta">
            <span class="workspace-overview-badge"><i></i>Live Operations Control Tower</span>
            <h1>Fulfillment &amp; Demand Telemetry</h1>
            <p>Real-time analytics across ${esc(model.regionName)} orders, stock allocations, supplier commitments and fulfillment.</p>
          </div>
          <div class="workspace-view-switch" role="tablist" aria-label="Workspace View">
            <button type="button" class="workspace-view-tab ${viewMode==='modules'?'active':''}" data-view="modules" role="tab" aria-selected="${viewMode==='modules'}">
              ▦ Operational Modules
            </button>
            <button type="button" class="workspace-view-tab ${viewMode==='telemetry'?'active':''}" data-view="telemetry" role="tab" aria-selected="${viewMode==='telemetry'}">
              📊 Telemetry &amp; KPIs
            </button>
          </div>
        </div>

        <section class="tower-hero">
          <div class="tower-hero-top">
            <span class="tower-live"><i></i>${window.StarkWorkspace?.isDemo?'Portfolio demo':model.state.mode==='sample'?'Sample workspace':'Current workspace'}</span>
            <span>${esc(model.regionName)} · Enterprise control tower</span>
            <label class="tower-period" hidden style="display:none!important">
              <span class="visually-hidden">Dashboard activity period</span>
              <select id="tower-period">
                <option value="30" ${period===30?'selected':''}>Last 30 days</option>
                <option value="90" ${period===90?'selected':''}>Last 90 days</option>
                <option value="all" ${period==='all'?'selected':''}>All recorded activity</option>
              </select>
            </label>
          </div>
          <h1>Global supply chain.<br>Total visibility. Smarter decisions.</h1>
          <p>Orders, inventory, suppliers and fulfillment, connected in one workspace.</p>
        </section>

        <div class="tower-kpis">
          ${kpi('orders','Total orders',fmt(model.recentOrders.length),model.open.length+' open commitments','order-management/index.html','orders','#0875ed')}
          ${kpi('delivery','On-time delivery',model.onTime===null?'—':model.onTime+'%',model.deliveries.length?'Dated deliveries in this period':'No dated delivery records','shipping/daily-report.html','shipping','#ee9700')}
          ${kpi('inventory','Available inventory',fmt(model.available),model.report?.items.length?(model.physical.some(i=>i.linkedStock)?'Connected stock · ':'Regional report · ')+model.region:'Operations stock · '+model.region,'inventory-dashboard-'+model.region.toLowerCase()+'.html','warehouse','#00a49c')}
          ${kpi('digital','Digital keys allocated',fmt(model.digital),'Dispatched token references','vendor-management/digital-vault.html','data','#e34770')}
          ${kpi('purchase','Open purchase orders',fmt(model.purchase.length),'All open supplier commitments','procurement/index.html','procurement','#8752e8')}
          ${kpi('credit','Credit exposure',credit,'All CRM accounts · own currencies','crm/accounts.html','crm','#ec8326')}
        </div>

        <div class="tower-analysis-grid">
          ${network(model)}
          <section class="tower-panel">
            <div class="tower-panel-head"><h2>Orders &amp; shipments trend</h2><span>${period==='all'?'All activity':'Last '+period+' days'}</span></div>
            ${trend(model)}
          </section>
        </div>

        <div class="tower-detail-grid">
          ${inventory(model)}
          ${vendorBars(model)}
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

    if(focused){const target=document.getElementById(focused);if(target&&host.contains(target))target.focus();}
    window.dispatchEvent(new CustomEvent('stark:tower-rendered'));
  }

  window.StarkControlTower={render,snapshot,queues};
  window.addEventListener('stark:region-change', render);
  window.addEventListener('stark:system-change', render);
})();
