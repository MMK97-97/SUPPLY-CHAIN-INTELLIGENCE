const fs = require('fs');
const path = require('path');

const scriptContent = `(function () {
  'use strict';

  const S = window.StarkSystem;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => new Intl.NumberFormat('en-US').format(Number(n) || 0);
  const money = (n, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n) || 0);

  function notice(message, error = false) {
    if (window.StarkSystemUI?.notice) {
      window.StarkSystemUI.notice(message, error);
    } else {
      const toast = document.createElement('div');
      toast.className = 'system-toast' + (error ? ' error' : '');
      toast.textContent = message;
      document.body.append(toast);
      setTimeout(() => toast.remove(), 4000);
    }
  }

  // =========================================================================
  // DETAILED SVG ILLUSTRATIONS MATCHING SCREENSHOTS
  // =========================================================================
  const productSVGs = {
    'WH-1000XM6': {
      main: \`<svg viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M48 95 C48 40, 152 40, 152 95" stroke="#0f172a" stroke-width="14" stroke-linecap="round"/>
        <path d="M58 88 C58 48, 142 48, 142 88" stroke="#1e293b" stroke-width="6" stroke-linecap="round"/>
        <rect x="42" y="85" width="10" height="24" rx="3" fill="#334155"/>
        <rect x="148" y="85" width="10" height="24" rx="3" fill="#334155"/>
        <g transform="translate(26, 88) rotate(6)">
          <ellipse cx="18" cy="32" rx="18" ry="32" fill="#0f172a" stroke="#020617" stroke-width="2.5"/>
          <ellipse cx="21" cy="32" rx="12" ry="24" fill="#1e293b"/>
          <ellipse cx="23" cy="32" rx="7" ry="16" fill="#0f172a"/>
          <circle cx="18" cy="18" r="3.5" fill="#64748b"/>
        </g>
        <g transform="translate(136, 90) rotate(-6)">
          <ellipse cx="18" cy="32" rx="18" ry="32" fill="#0f172a" stroke="#020617" stroke-width="2.5"/>
          <ellipse cx="15" cy="32" rx="12" ry="24" fill="#1e293b"/>
          <ellipse cx="13" cy="32" rx="7" ry="16" fill="#0f172a"/>
          <circle cx="18" cy="18" r="3.5" fill="#64748b"/>
        </g>
      </svg>\`,
      angle1: \`<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 50 C26 22, 74 22, 74 50" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
        <ellipse cx="24" cy="56" rx="9" ry="16" fill="#0f172a"/>
        <ellipse cx="76" cy="56" rx="9" ry="16" fill="#0f172a"/>
      </svg>\`,
      angle2: \`<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="30" fill="#1e293b" stroke="#0f172a" stroke-width="6"/>
        <ellipse cx="50" cy="50" rx="18" ry="24" fill="#0f172a"/>
      </svg>\`,
      angle3: \`<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="32" width="50" height="42" rx="10" fill="#0f172a" stroke="#334155" stroke-width="2"/>
        <circle cx="40" cy="52" r="10" fill="#1e293b"/>
        <circle cx="60" cy="52" r="10" fill="#1e293b"/>
      </svg>\`,
      box: \`<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="22" y="16" width="56" height="68" rx="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
        <rect x="28" y="24" width="44" height="30" rx="3" fill="#0f172a"/>
        <text x="50" y="70" text-anchor="middle" font-size="7" font-weight="700" fill="#334155" font-family="system-ui">SONY</text>
        <line x1="30" y1="76" x2="70" y2="76" stroke="#cbd5e1" stroke-width="1.5"/>
      </svg>\`
    },
    'AP-SW42-BK': {
      main: \`<svg viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="75" y="15" width="50" height="35" rx="6" fill="#334155"/>
        <rect x="75" y="130" width="50" height="35" rx="6" fill="#334155"/>
        <rect x="55" y="42" width="90" height="96" rx="22" fill="#0f172a" stroke="#1e293b" stroke-width="4"/>
        <rect x="63" y="50" width="74" height="80" rx="16" fill="#000000"/>
        <circle cx="100" cy="90" r="28" stroke="#0284c7" stroke-width="3" stroke-dasharray="120 40" fill="none"/>
        <text x="100" y="94" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700" font-family="system-ui">10:42</text>
        <rect x="146" y="66" width="5" height="18" rx="2" fill="#64748b"/>
      </svg>\`,
      angle1: \`<svg viewBox="0 0 100 100" fill="none"><rect x="30" y="25" width="40" height="50" rx="10" fill="#0f172a"/><circle cx="50" cy="50" r="14" stroke="#0284c7" stroke-width="2" fill="none"/></svg>\`,
      angle2: \`<svg viewBox="0 0 100 100" fill="none"><rect x="35" y="20" width="30" height="60" rx="6" fill="#1e293b"/></svg>\`,
      angle3: \`<svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="26" fill="#0f172a" stroke="#0284c7" stroke-width="2"/></svg>\`,
      box: \`<svg viewBox="0 0 100 100" fill="none"><rect x="25" y="20" width="50" height="60" rx="4" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/><text x="50" y="54" text-anchor="middle" font-size="8" font-weight="700" fill="#0f172a">WATCH</text></svg>\`
    },
    'VYG-24-RD': {
      main: \`<svg viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="85" y="16" width="30" height="12" rx="3" stroke="#475569" stroke-width="3" fill="none"/>
        <rect x="52" y="28" width="96" height="125" rx="14" fill="#dc2626" stroke="#991b1b" stroke-width="3"/>
        <line x1="52" y1="55" x2="148" y2="55" stroke="#b91c1c" stroke-width="3"/>
        <line x1="52" y1="85" x2="148" y2="85" stroke="#b91c1c" stroke-width="3"/>
        <line x1="52" y1="115" x2="148" y2="115" stroke="#b91c1c" stroke-width="3"/>
        <circle cx="70" cy="158" r="7" fill="#1e293b"/>
        <circle cx="130" cy="158" r="7" fill="#1e293b"/>
      </svg>\`,
      angle1: \`<svg viewBox="0 0 100 100" fill="none"><rect x="30" y="20" width="40" height="60" rx="6" fill="#dc2626"/></svg>\`,
      angle2: \`<svg viewBox="0 0 100 100" fill="none"><rect x="38" y="20" width="24" height="60" rx="4" fill="#b91c1c"/></svg>\`,
      angle3: \`<svg viewBox="0 0 100 100" fill="none"><rect x="28" y="26" width="44" height="50" rx="6" fill="#dc2626"/></svg>\`,
      box: \`<svg viewBox="0 0 100 100" fill="none"><rect x="22" y="18" width="56" height="64" rx="4" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/><text x="50" y="55" text-anchor="middle" font-size="8" font-weight="700" fill="#dc2626">SAMSONITE</text></svg>\`
    },
    'WH-1000XM5': {
      main: \`<svg viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M48 95 C48 40, 152 40, 152 95" stroke="#cbd5e1" stroke-width="14" stroke-linecap="round"/>
        <path d="M58 88 C58 48, 142 48, 142 88" stroke="#f1f5f9" stroke-width="6" stroke-linecap="round"/>
        <ellipse cx="44" cy="116" rx="18" ry="32" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2.5"/>
        <ellipse cx="156" cy="116" rx="18" ry="32" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2.5"/>
      </svg>\`,
      angle1: \`<svg viewBox="0 0 100 100" fill="none"><ellipse cx="50" cy="50" rx="20" ry="30" fill="#f8fafc" stroke="#cbd5e1"/></svg>\`,
      angle2: \`<svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="25" fill="#f1f5f9"/></svg>\`,
      angle3: \`<svg viewBox="0 0 100 100" fill="none"><rect x="30" y="30" width="40" height="40" rx="8" fill="#f8fafc"/></svg>\`,
      box: \`<svg viewBox="0 0 100 100" fill="none"><rect x="25" y="20" width="50" height="60" rx="4" fill="#ffffff" stroke="#cbd5e1"/><text x="50" y="55" text-anchor="middle" font-size="7" font-weight="700" fill="#475569">SONY XM5</text></svg>\`
    }
  };

  const defaultItemRecord = {
    sku: 'WH-1000XM6',
    model: 'WH-1000XM6',
    recordNo: 'ITM-00045678',
    dateAdded: '10/12/2026',
    title: 'Sony Wireless Noise Canceling Headphones',
    brand: 'Sony',
    upc: '027242920123',
    barcode: '027242920123',
    variant: 'Black',
    tplModel: 'SNY-WH1000XM6-BK',
    tplId: '3PL-SONY-00125',
    size: 'One Size',
    color: 'Black',
    colorHex: '#111827',
    department: 'Electronics',
    category: 'Audio',
    subCategory: 'Headphones',
    country: 'China',
    weight: '254 g',
    standardPrice: 349.99,
    cost: 278.00,
    status: 'Active',
    stockStatus: 'In Stock',
    holdQty: 0,
    notAvailable: 0,
    discontinued: false,
    fashion: false,
    bulkOnly: false,
    coreItem: true,
    replink: true,
    apiWebsite: true,
    servicePart: false,
    replaceReplinkImg: false,
    stockQty: 200,
    inHands: 200,
    onOrder: 0,
    totalATS: 200,
    eta: '11/27/2026',
    brandEta: '11/27/2026',
    warehouses: [
      { name: 'Tampa DC', onHand: 120, onOrder: 0, ats: 120, hold: 0 },
      { name: 'Sarasota DC', onHand: 80, onOrder: 0, ats: 80, hold: 0 },
      { name: 'Texas DC', onHand: 0, onOrder: 0, ats: 0, hold: 0 }
    ],
    description: 'Industry-leading noise canceling headphones with premium sound quality, 30-hour battery life, and comfortable over-ear design.'
  };

  // =========================================================================
  // CATALOG REGISTRY
  // =========================================================================
  function getMasterCatalog() {
    try {
      const stored = localStorage.getItem('stark.enterprise.itemMaster.v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      defaultItemRecord,
      {
        sku: 'AP-SW42-BK',
        model: 'AP-SW42-BK',
        recordNo: 'ITM-00034112',
        dateAdded: '09/18/2026',
        title: 'Ultra Smart Watch',
        brand: 'AeroPress',
        upc: '850045332101',
        barcode: '850045332101',
        variant: 'Black / 42mm',
        tplModel: 'AERO-SW42-BLK',
        tplId: '3PL-AERO-00441',
        size: '42mm',
        color: 'Black',
        colorHex: '#1e293b',
        department: 'Electronics',
        category: 'Electronics',
        subCategory: 'Wearable Tech',
        country: 'Taiwan',
        weight: '52 g',
        standardPrice: 129.99,
        cost: 78.00,
        status: 'Active',
        stockStatus: 'In Stock',
        holdQty: 0,
        notAvailable: 0,
        discontinued: false,
        coreItem: true,
        replink: true,
        apiWebsite: true,
        stockQty: 1245,
        inHands: 1245,
        onOrder: 250,
        totalATS: 1245,
        eta: '11/15/2026',
        brandEta: '11/15/2026',
        warehouses: [
          { name: 'Tampa DC', onHand: 745, onOrder: 150, ats: 745, hold: 0 },
          { name: 'Sarasota DC', onHand: 500, onOrder: 100, ats: 500, hold: 0 },
          { name: 'Texas DC', onHand: 0, onOrder: 0, ats: 0, hold: 0 }
        ],
        description: 'High-performance GPS smartwatch with optical heart rate monitor, AMOLED display, and 7-day battery life.'
      },
      {
        sku: 'VYG-24-RD',
        model: 'VYG-24-RD',
        recordNo: 'ITM-00051289',
        dateAdded: '08/24/2026',
        title: 'Voyage Hardside Luggage',
        brand: 'Samsonite',
        upc: '043202775321',
        barcode: '043202775321',
        variant: 'Red / 24"',
        tplModel: 'SAM-VYG24-RED',
        tplId: '3PL-SAM-00912',
        size: '24 Inch',
        color: 'Red',
        colorHex: '#dc2626',
        department: 'Luggage',
        category: 'Luggage',
        subCategory: 'Checked Luggage',
        country: 'Vietnam',
        weight: '4.1 kg',
        standardPrice: 199.00,
        cost: 115.00,
        status: 'Active',
        stockStatus: 'In Stock',
        holdQty: 0,
        notAvailable: 0,
        discontinued: false,
        coreItem: true,
        replink: true,
        apiWebsite: true,
        stockQty: 320,
        inHands: 320,
        onOrder: 80,
        totalATS: 320,
        eta: '12/01/2026',
        brandEta: '12/01/2026',
        warehouses: [
          { name: 'Tampa DC', onHand: 200, onOrder: 50, ats: 200, hold: 0 },
          { name: 'Sarasota DC', onHand: 120, onOrder: 30, ats: 120, hold: 0 },
          { name: 'Texas DC', onHand: 0, onOrder: 0, ats: 0, hold: 0 }
        ],
        description: 'Durable polycarbonate spinner luggage with TSA-approved combination lock and 360-degree dual spinner wheels.'
      },
      {
        sku: 'WH-1000XM5-WHT',
        model: 'WH-1000XM5',
        recordNo: 'ITM-00045610',
        dateAdded: '10/05/2026',
        title: 'Noise Canceling Headphones',
        brand: 'Sony',
        upc: '027242918364',
        barcode: '027242918364',
        variant: 'White',
        tplModel: 'SNY-WH1000XM5-WHT',
        tplId: '3PL-SONY-00119',
        size: 'One Size',
        color: 'White',
        colorHex: '#f8fafc',
        department: 'Electronics',
        category: 'Electronics',
        subCategory: 'Audio',
        country: 'China',
        weight: '250 g',
        standardPrice: 349.99,
        cost: 278.00,
        status: 'Active',
        stockStatus: 'In Stock',
        holdQty: 0,
        notAvailable: 0,
        discontinued: false,
        coreItem: true,
        replink: true,
        apiWebsite: true,
        stockQty: 892,
        inHands: 892,
        onOrder: 100,
        totalATS: 892,
        eta: '11/20/2026',
        brandEta: '11/20/2026',
        warehouses: [
          { name: 'Tampa DC', onHand: 550, onOrder: 50, ats: 550, hold: 0 },
          { name: 'Sarasota DC', onHand: 342, onOrder: 50, ats: 342, hold: 0 },
          { name: 'Texas DC', onHand: 0, onOrder: 0, ats: 0, hold: 0 }
        ],
        description: 'Flagship wireless noise cancelling headphones in silver/white with industry-leading ANC and multipoint Bluetooth connection.'
      }
    ];
  }

  function getCurrentItem() {
    const catalog = getMasterCatalog();
    const params = new URLSearchParams(location.search);
    const skuParam = params.get('sku') || params.get('model') || '';

    if (skuParam) {
      const found = catalog.find(i => 
        (i.sku && i.sku.toLowerCase() === skuParam.toLowerCase()) || 
        (i.model && i.model.toLowerCase() === skuParam.toLowerCase())
      );
      if (found) return found;
    }
    return catalog[0] || defaultItemRecord;
  }

  // =========================================================================
  // MAIN RENDERER
  // =========================================================================
  let activeTab = 'Main';
  let activeThumb = 'angle1';

  function renderPage() {
    const root = document.querySelector('#item-details-root');
    if (!root) return;

    const catalog = getMasterCatalog();
    const item = getCurrentItem();
    const svgData = productSVGs[item.sku] || productSVGs['WH-1000XM6'];

    const currentIndex = catalog.findIndex(i => (i.sku || i.model) === (item.sku || item.model));
    const prevItem = catalog[(currentIndex - 1 + catalog.length) % catalog.length];
    const nextItem = catalog[(currentIndex + 1) % catalog.length];

    // Compute live hold from StarkSystem if available
    let liveHold = item.holdQty || 0;
    try {
      if (S?.getState) {
        const orders = S.getState().enterprise?.orders || [];
        const itemHold = orders
          .filter(o => ['HOLD_PO', 'EVENT_PO'].includes(o.type) && o.status !== 'CANCELLED' && o.status !== 'SHIPPED')
          .reduce((sum, o) => {
            const line = (o.lines || []).find(l => (l.sku || '').toLowerCase() === (item.sku || '').toLowerCase());
            return sum + (line?.qty || 0);
          }, 0);
        if (itemHold > 0) liveHold = itemHold;
      }
    } catch (_) {}

    const totalStock = item.stockQty || 200;
    const inHands = item.inHands || totalStock;
    const onOrder = item.onOrder || 0;
    const available = Math.max(0, totalStock - (item.notAvailable || 0));

    const tabsList = [
      'Main', 'Pricing', 'Dimensions', 'Categories', 'Group/Components',
      'Feeds', 'History', 'Activity', 'Customers', 'Images',
      'Subs', 'ASI', 'Plastoria', 'Personalization', 'Inv.', 'POs', 'Notes'
    ];

    root.innerHTML = \`
      <div class="id-page-wrap">
        <!-- Breadcrumb -->
        <nav class="id-breadcrumb" aria-label="Breadcrumb">
          <a href="workspace.html">Inventory &amp; Planning</a>
          <span class="id-breadcrumb-sep">&gt;</span>
          <a href="item-master.html">Item Master</a>
          <span class="id-breadcrumb-sep">&gt;</span>
          <span class="id-breadcrumb-current">Item Details</span>
        </nav>

        <!-- Identity Header -->
        <div class="id-header">
          <div class="id-header-left">
            <div class="id-title-row">
              <h1 class="id-title">\${esc(item.model || item.sku)}</h1>
              <span class="id-pill active">● Active</span>
              \${item.coreItem !== false ? '<span class="id-pill core">Core Item</span>' : ''}
              <span class="id-pill stock">In Stock</span>
            </div>
            <p class="id-subtitle">\${esc(item.title || 'Sony Wireless Noise Canceling Headphones')}</p>
          </div>
          <div class="id-header-actions">
            <button class="id-btn-dup" id="id-action-duplicate" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Duplicate
            </button>
            <button class="id-btn-edit" id="id-action-edit" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Item
            </button>
            <button class="id-btn-icon" id="id-action-more" type="button" title="More Actions">···</button>
            <div class="id-pager-group">
              <button class="id-pager-btn" id="id-pager-prev" type="button" title="Previous Item (\${esc(prevItem.model)})">&lt;</button>
              <button class="id-pager-btn" id="id-pager-next" type="button" title="Next Item (\${esc(nextItem.model)})">&gt;</button>
            </div>
          </div>
        </div>

        <!-- Product Hero / Summary Box -->
        <div class="id-hero-card">
          <div class="id-hero-gallery">
            <div class="id-hero-main-img" id="id-hero-main-box">
              \${svgData[activeThumb] || svgData.main}
            </div>
            <div class="id-hero-thumbs-stack">
              <div class="id-hero-thumb-item \${activeThumb === 'angle1' ? 'active' : ''}" data-thumb="angle1" title="View Angle 1">
                \${svgData.angle1 || svgData.main}
              </div>
              <div class="id-hero-thumb-item \${activeThumb === 'angle2' ? 'active' : ''}" data-thumb="angle2" title="View Angle 2">
                \${svgData.angle2 || svgData.main}
              </div>
              <div class="id-hero-thumb-item \${activeThumb === 'box' ? 'active' : ''}" data-thumb="box" title="View Packaging Box">
                \${svgData.box || svgData.main}
              </div>
            </div>
          </div>

          <div class="id-hero-specs">
            <!-- Row 1 -->
            <div class="id-spec-cell">
              <span class="id-spec-label">Model #</span>
              <span class="id-spec-val">\${esc(item.model || item.sku)}</span>
            </div>
            <div class="id-spec-cell">
              <span class="id-spec-label">UPC</span>
              <span class="id-spec-val">
                \${esc(item.upc || '027242920123')}
                <span class="copy-icon" id="id-copy-upc" title="Copy UPC">📋</span>
              </span>
            </div>
            <div class="id-spec-cell">
              <span class="id-spec-label">Brand</span>
              <span class="id-spec-val">\${esc(item.brand || 'Sony')}</span>
            </div>
            <div class="id-spec-cell">
              <span class="id-spec-label">Variant</span>
              <span class="id-spec-val">\${esc(item.variant || 'Black')}</span>
            </div>
            <div class="id-spec-cell">
              <span class="id-spec-label">SubCategory</span>
              <span class="id-spec-val">\${esc(item.subCategory || 'Headphones')}</span>
            </div>

            <!-- Row 2 -->
            <div class="id-spec-cell">
              <span class="id-spec-label">3PL Model #</span>
              <span class="id-spec-val">\${esc(item.tplModel || 'SNY-WH1000XM6-BK')}</span>
            </div>
            <div class="id-spec-cell">
              <span class="id-spec-label">3PL Internal ID</span>
              <span class="id-spec-val">\${esc(item.tplId || '3PL-SONY-00125')}</span>
            </div>
            <div class="id-spec-cell">
              <span class="id-spec-label">Size</span>
              <span class="id-spec-val">\${esc(item.size || 'One Size')}</span>
            </div>
            <div class="id-spec-cell">
              <span class="id-spec-label">Color</span>
              <span class="id-spec-val">
                <span class="id-color-dot" style="background-color: \${item.colorHex || '#111827'}"></span>
                \${esc(item.color || 'Black')}
              </span>
            </div>
            <div class="id-spec-cell">
              <span class="id-spec-label">Department</span>
              <span class="id-spec-val">\${esc(item.department || 'Electronics')}</span>
            </div>
          </div>
        </div>

        <!-- 17 Horizontal Tabs -->
        <div class="id-tabs-bar" role="tablist">
          \${tabsList.map(tab => \`
            <button class="id-tab-btn \${activeTab === tab ? 'active' : ''}" type="button" data-tab="\${tab}" role="tab" aria-selected="\${activeTab === tab}">
              \${tab}
            </button>
          \`).join('')}
        </div>

        <!-- Tab Body Content -->
        <div id="id-tab-content-root">
          \${renderTabContent(item, svgData, totalStock, inHands, onOrder, available, liveHold)}
        </div>
      </div>
    \`;

    bindDetailsEvents(item, catalog);
  }

  // =========================================================================
  // TAB CONTENT RENDERER
  // =========================================================================
  function renderTabContent(item, svgData, totalStock, inHands, onOrder, available, liveHold) {
    if (activeTab === 'Main') {
      return \`
        <div class="id-main-layout">
          <!-- Left Column: Item Information -->
          <div class="id-left-col">
            <div class="id-card">
              <h2 class="id-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Item Information
              </h2>
              <div class="id-form-grid-2">
                <!-- Col 1 -->
                <div class="id-form-col">
                  <label class="id-field">
                    <span class="id-field-label">Record #</span>
                    <input class="id-input" type="text" readonly value="\${esc(item.recordNo || 'ITM-00045678')}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Date Added</span>
                    <div class="id-input-date-wrap">
                      <input class="id-input" type="text" value="\${esc(item.dateAdded || '10/12/2026')}">
                      <svg class="id-input-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Model #</span>
                    <input class="id-input" type="text" value="\${esc(item.model || item.sku)}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Variant</span>
                    <input class="id-input" type="text" value="\${esc(item.variant || 'Black')}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">3PL Model #</span>
                    <input class="id-input" type="text" value="\${esc(item.tplModel || 'SNY-WH1000XM6-BK')}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">3PL Internal ID</span>
                    <input class="id-input" type="text" value="\${esc(item.tplId || '3PL-SONY-00125')}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">SubCategory</span>
                    <select class="id-select">
                      <option selected>\${esc(item.subCategory || 'Headphones')}</option>
                      <option>Wearable Tech</option>
                      <option>Checked Luggage</option>
                      <option>Audio</option>
                      <option>Drinkware</option>
                    </select>
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Stock Status</span>
                    <select class="id-select">
                      <option selected>In Stock</option>
                      <option>Low Stock</option>
                      <option>Out of Stock</option>
                      <option>Backorder</option>
                    </select>
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Item Status</span>
                    <select class="id-select">
                      <option selected>Active</option>
                      <option>Inactive</option>
                      <option>Discontinued</option>
                      <option>Pending Review</option>
                    </select>
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Hold Qty</span>
                    <input class="id-input" type="number" value="\${num(liveHold)}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Not Available</span>
                    <input class="id-input" type="number" value="\${num(item.notAvailable || 0)}">
                  </label>
                  <div class="id-toggle-row">
                    <span class="id-toggle-label">Discontinued</span>
                    <label class="eim-switch">
                      <input type="checkbox" \${item.discontinued ? 'checked' : ''}>
                      <span class="eim-slider"></span>
                    </label>
                  </div>
                  <label class="id-field">
                    <span class="id-field-label">Brand</span>
                    <input class="id-input" type="text" value="\${esc(item.brand || 'Sony')}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">UPC</span>
                    <input class="id-input" type="text" value="\${esc(item.upc || '027242920123')}">
                  </label>
                </div>

                <!-- Col 2 -->
                <div class="id-form-col">
                  <label class="id-field">
                    <span class="id-field-label">Barcode/Serial#</span>
                    <input class="id-input" type="text" value="\${esc(item.barcode || '027242920123')}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Country of Origin</span>
                    <input class="id-input" type="text" value="\${esc(item.country || 'China')}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Color</span>
                    <input class="id-input" type="text" value="\${esc(item.color || 'Black')}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Size</span>
                    <input class="id-input" type="text" value="\${esc(item.size || 'One Size')}">
                  </label>
                  <div class="id-toggle-row">
                    <span class="id-toggle-label">Fashion Item</span>
                    <label class="eim-switch">
                      <input type="checkbox" \${item.fashion ? 'checked' : ''}>
                      <span class="eim-slider"></span>
                    </label>
                  </div>
                  <div class="id-toggle-row">
                    <span class="id-toggle-label">Bulk Only</span>
                    <label class="eim-switch">
                      <input type="checkbox" \${item.bulkOnly ? 'checked' : ''}>
                      <span class="eim-slider"></span>
                    </label>
                  </div>
                  <div class="id-toggle-row">
                    <span class="id-toggle-label">Core Item</span>
                    <label class="eim-switch">
                      <input type="checkbox" \${item.coreItem !== false ? 'checked' : ''}>
                      <span class="eim-slider"></span>
                    </label>
                  </div>
                  <div class="id-toggle-row">
                    <span class="id-toggle-label">Post to Replink</span>
                    <label class="eim-switch">
                      <input type="checkbox" \${item.replink !== false ? 'checked' : ''}>
                      <span class="eim-slider"></span>
                    </label>
                  </div>
                  <div class="id-toggle-row">
                    <span class="id-toggle-label">Post To API (website)</span>
                    <label class="eim-switch">
                      <input type="checkbox" \${item.apiWebsite !== false ? 'checked' : ''}>
                      <span class="eim-slider"></span>
                    </label>
                  </div>
                  <div class="id-toggle-row">
                    <span class="id-toggle-label">Service Part</span>
                    <label class="eim-switch">
                      <input type="checkbox" \${item.servicePart ? 'checked' : ''}>
                      <span class="eim-slider"></span>
                    </label>
                  </div>
                  <div class="id-toggle-row">
                    <span class="id-toggle-label">Replace Replink Image</span>
                    <label class="eim-switch">
                      <input type="checkbox" \${item.replaceReplinkImg ? 'checked' : ''}>
                      <span class="eim-slider"></span>
                    </label>
                  </div>
                  <label class="id-field">
                    <span class="id-field-label">Stock Qty</span>
                    <input class="id-input" type="number" value="\${num(totalStock)}">
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">ETA</span>
                    <div class="id-input-date-wrap">
                      <input class="id-input" type="text" value="\${esc(item.eta || '11/27/2026')}">
                      <svg class="id-input-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                  </label>
                  <label class="id-field">
                    <span class="id-field-label">Brand ETA</span>
                    <div class="id-input-date-wrap">
                      <input class="id-input" type="text" value="\${esc(item.brandEta || '11/27/2026')}">
                      <svg class="id-input-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: 3 Cards -->
          <div class="id-right-col">
            <!-- Card 1: Stock & Availability -->
            <div class="id-card">
              <h2 class="id-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                Stock &amp; Availability
              </h2>
              <div class="id-stock-container">
                <div class="id-stock-kpi-list">
                  <div class="id-stock-kpi-row"><span>Total Stock Qty</span><strong>\${num(totalStock)}</strong></div>
                  <div class="id-stock-kpi-row"><span>In-Hands Qty</span><strong>\${num(inHands)}</strong></div>
                  <div class="id-stock-kpi-row"><span>On Order Qty</span><strong>\${num(onOrder)}</strong></div>
                  <div class="id-stock-kpi-row"><span>Available Qty</span><strong>\${num(available)}</strong></div>
                  <div class="id-stock-kpi-row"><span>Hold Qty</span><strong>\${num(liveHold)}</strong></div>
                  <div class="id-stock-kpi-row"><span>Not Available</span><strong>\${num(item.notAvailable || 0)}</strong></div>
                </div>
                <div class="id-wh-table-wrap">
                  <table class="id-wh-table">
                    <thead>
                      <tr><th>Warehouse</th><th>On Hand</th><th>On Order</th><th>Available</th></tr>
                    </thead>
                    <tbody>
                      \${(item.warehouses || [
                        { name: 'Tampa DC', onHand: 120, onOrder: 0, ats: 120 },
                        { name: 'Sarasota DC', onHand: 80, onOrder: 0, ats: 80 },
                        { name: 'Texas DC', onHand: 0, onOrder: 0, ats: 0 }
                      ]).map(w => \`
                        <tr>
                          <td><strong>\${esc(w.name)}</strong></td>
                          <td>\${num(w.onHand || w.ats)}</td>
                          <td>\${num(w.onOrder || 0)}</td>
                          <td>\${num(w.ats || w.onHand)}</td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                </div>
                <div class="id-wh-legend">
                  <div class="id-legend-item"><span class="id-legend-dot green"></span> Available</div>
                  <div class="id-legend-item"><span class="id-legend-dot blue"></span> On Order</div>
                  <div class="id-legend-item"><span class="id-legend-dot orange"></span> Hold</div>
                  <div class="id-legend-item"><span class="id-legend-dot gray"></span> Not Available</div>
                </div>
              </div>
            </div>

            <!-- Card 2: Product Images -->
            <div class="id-card">
              <h2 class="id-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Product Images
              </h2>
              <div class="id-images-row">
                <div class="id-img-card selected" data-thumb="angle1" title="Primary View">
                  <span class="id-img-grip">::</span>
                  \${svgData.angle1 || svgData.main}
                </div>
                <div class="id-img-card" data-thumb="angle2" title="Angle View">
                  <span class="id-img-grip">::</span>
                  \${svgData.angle2 || svgData.main}
                </div>
                <div class="id-img-card" data-thumb="angle3" title="Side View">
                  <span class="id-img-grip">::</span>
                  \${svgData.angle3 || svgData.main}
                </div>
                <div class="id-img-card" data-thumb="box" title="Packaging Box">
                  <span class="id-img-grip">::</span>
                  \${svgData.box || svgData.main}
                </div>
                <button class="id-img-add-btn" id="id-btn-add-img" type="button" title="Add another product photo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Image
                </button>
              </div>
              <p class="id-images-caption">Click to view, drag to reorder. Supported formats: JPG, PNG, WebP (Max 5MB each).</p>
            </div>

            <!-- Card 3: Quick Info -->
            <div class="id-card">
              <h2 class="id-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Quick Info
              </h2>
              <div class="id-quick-grid">
                <div class="id-quick-row"><span class="id-quick-label">Department</span><span class="id-quick-val">\${esc(item.department || 'Electronics')}</span></div>
                <div class="id-quick-row"><span class="id-quick-label">Size</span><span class="id-quick-val">\${esc(item.size || 'One Size')}</span></div>
                <div class="id-quick-row"><span class="id-quick-label">Category</span><span class="id-quick-val">\${esc(item.category || 'Audio')}</span></div>
                <div class="id-quick-row"><span class="id-quick-label">Color</span><span class="id-quick-val">\${esc(item.color || 'Black')} <span class="id-color-dot" style="background-color:\${item.colorHex || '#111827'}"></span></span></div>
                <div class="id-quick-row"><span class="id-quick-label">SubCategory</span><span class="id-quick-val">\${esc(item.subCategory || 'Headphones')}</span></div>
                <div class="id-quick-row"><span class="id-quick-label">Country of Origin</span><span class="id-quick-val">\${esc(item.country || 'China')}</span></div>
                <div class="id-quick-row"><span class="id-quick-label">Weight</span><span class="id-quick-val">\${esc(item.weight || '254 g')}</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Full-Width Card: Title / Description -->
        <div class="id-desc-card">
          <h2 class="id-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Title / Description
          </h2>
          <label class="id-desc-field">
            <span class="id-field-label">Title</span>
            <input class="id-input" id="id-input-title" type="text" value="\${esc(item.title || 'Sony Wireless Noise Canceling Headphones')}">
          </label>
          <label class="id-desc-field">
            <span class="id-field-label">Description</span>
            <textarea class="id-desc-textarea" id="id-input-desc" maxlength="2000">\${esc(item.description || 'Industry-leading noise canceling headphones with premium sound quality, 30-hour battery life, and comfortable over-ear design.')}</textarea>
            <div class="id-char-counter" id="id-char-count">116/2000</div>
          </label>
        </div>
      \`;
    }

    if (activeTab === 'Pricing') {
      return \`
        <div class="id-card" style="margin-bottom:16px">
          <h2 class="id-card-title">Tiered Commercial Pricing Matrix</h2>
          <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; margin-bottom:18px">
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">Standard / Retail</span><strong style="display:block;font-size:18px;color:#0f172a;margin-top:4px">\${money(item.standardPrice || 349.99)}</strong></div>
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">Net / Unit Cost</span><strong style="display:block;font-size:18px;color:#0f172a;margin-top:4px">\${money(item.cost || 278.00)}</strong></div>
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">Wholesale Tier 1</span><strong style="display:block;font-size:18px;color:#0f172a;margin-top:4px">\${money((item.standardPrice || 349.99) * 0.88)}</strong></div>
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">MAP Protected</span><strong style="display:block;font-size:18px;color:#0f172a;margin-top:4px">\${money(item.standardPrice || 349.99)}</strong></div>
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">Gross Margin</span><strong style="display:block;font-size:18px;color:#16a34a;margin-top:4px">\${money((item.standardPrice || 349.99) - (item.cost || 278.00))} (20.6%)</strong></div>
          </div>
          <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 10px">Contracted Customer Pricing Overrides</h3>
          <table class="id-wh-table">
            <thead>
              <tr><th>Customer Account</th><th>Contract Tier</th><th>Special Unit Price</th><th>Discount %</th><th>Effective Through</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Apex Retail Partners</strong></td><td>Tier A Premium</td><td>$326.00</td><td><span style="color:#16a34a;font-weight:600">6.8%</span></td><td>12/31/2026</td></tr>
              <tr><td><strong>Summit Distributing Co.</strong></td><td>Wholesale Direct</td><td>$310.00</td><td><span style="color:#16a34a;font-weight:600">11.4%</span></td><td>12/31/2026</td></tr>
              <tr><td><strong>Prime Logistics Group</strong></td><td>Volume B2B</td><td>$315.00</td><td><span style="color:#16a34a;font-weight:600">10.0%</span></td><td>Ongoing</td></tr>
            </tbody>
          </table>
        </div>
      \`;
    }

    if (activeTab === 'Feeds') {
      return \`
        <div class="id-card" style="margin-bottom:16px">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px">
            <h2 class="id-card-title" style="margin:0">Active Catalog &amp; Inventory Feeds (Whom It's Getting Feed To)</h2>
            <button class="id-btn-dup" type="button" id="id-btn-sync-feeds">↻ Sync Feeds Now</button>
          </div>
          <table class="id-wh-table">
            <thead>
              <tr><th>Feed Destination</th><th>Type</th><th>Sync Status</th><th>Last Feed Transmission</th><th>Allocated ATS</th><th>Feed Status</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Replink B2B Feed</strong></td>
                <td>EDI 846 Inventory</td>
                <td><span style="color:#16a34a;font-weight:600">● Live Connected</span></td>
                <td>12 minutes ago</td>
                <td>\${num(available)} units</td>
                <td>
                  <label class="eim-switch"><input type="checkbox" checked><span class="eim-slider"></span></label>
                </td>
              </tr>
              <tr>
                <td><strong>Enterprise Website &amp; API</strong></td>
                <td>GraphQL Real-Time</td>
                <td><span style="color:#16a34a;font-weight:600">● Live Connected</span></td>
                <td>4 minutes ago</td>
                <td>\${num(available)} units</td>
                <td>
                  <label class="eim-switch"><input type="checkbox" checked><span class="eim-slider"></span></label>
                </td>
              </tr>
              <tr>
                <td><strong>Workhuman Rewards Catalog</strong></td>
                <td>Scheduled Daily SFTP</td>
                <td><span style="color:#16a34a;font-weight:600">● Active</span></td>
                <td>Today at 04:00 AM</td>
                <td>\${num(available)} units</td>
                <td>
                  <label class="eim-switch"><input type="checkbox" checked><span class="eim-slider"></span></label>
                </td>
              </tr>
              <tr>
                <td><strong>Amazon Direct Supplier Feed</strong></td>
                <td>SP-API Inventory Feed</td>
                <td><span style="color:#f59e0b;font-weight:600">● Syncing</span></td>
                <td>1 hour ago</td>
                <td>\${num(available)} units</td>
                <td>
                  <label class="eim-switch"><input type="checkbox" checked><span class="eim-slider"></span></label>
                </td>
              </tr>
              <tr>
                <td><strong>Target Plus Marketplace</strong></td>
                <td>Partner Portal XML</td>
                <td><span style="color:#16a34a;font-weight:600">● Active</span></td>
                <td>2 hours ago</td>
                <td>\${num(available)} units</td>
                <td>
                  <label class="eim-switch"><input type="checkbox"><span class="eim-slider"></span></label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      \`;
    }

    if (activeTab === 'History') {
      return \`
        <div class="id-card" style="margin-bottom:16px">
          <h2 class="id-card-title">Item Master Audit &amp; Revision History</h2>
          <div style="display:flex; flex-direction:column; gap:12px">
            <div style="display:flex; gap:12px; padding:10px; border-left:3px solid #16a34a; background:#f8fafc; border-radius:4px">
              <div><strong style="color:#0f172a">Automated ATS Stock Sync</strong> - Received +50 units from Tampa DC receiving dock.<div style="font-size:11.5px;color:#64748b;margin-top:2px">Today at 10:15 AM · System Automated Feed</div></div>
            </div>
            <div style="display:flex; gap:12px; padding:10px; border-left:3px solid #f59e0b; background:#f8fafc; border-radius:4px">
              <div><strong style="color:#0f172a">Hold Order Created</strong> - PO-HOLD-774 placed \${liveHold} units on hold automatically.<div style="font-size:11.5px;color:#64748b;margin-top:2px">Yesterday at 04:30 PM · Order Desk</div></div>
            </div>
            <div style="display:flex; gap:12px; padding:10px; border-left:3px solid #0284c7; background:#f8fafc; border-radius:4px">
              <div><strong style="color:#0f172a">Price Specification Updated</strong> - Standard price set to $349.99.<div style="font-size:11.5px;color:#64748b;margin-top:2px">Oct 16, 2026 at 02:14 PM · John Doe (Pricing Lead)</div></div>
            </div>
            <div style="display:flex; gap:12px; padding:10px; border-left:3px solid #94a3b8; background:#f8fafc; border-radius:4px">
              <div><strong style="color:#0f172a">Item Master Created</strong> - Record ITM-00045678 registered into master catalog.<div style="font-size:11.5px;color:#64748b;margin-top:2px">Oct 12, 2026 at 09:30 AM · System Seed</div></div>
            </div>
          </div>
        </div>
      \`;
    }

    if (activeTab === 'Activity') {
      return \`
        <div class="id-card" style="margin-bottom:16px">
          <h2 class="id-card-title">Recent Outbound Dispatch &amp; Shipping Activity</h2>
          <table class="id-wh-table">
            <thead>
              <tr><th>Shipment ID</th><th>Carrier</th><th>Tracking #</th><th>Destination</th><th>Order PO</th><th>Units</th><th>Dispatch Date</th><th>Delivery Status</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>SH-90812</strong></td><td>UPS Ground</td><td><a href="#" style="color:#0284c7">1Z9999999999999999</a></td><td>Orlando, FL</td><td>PO-2026-9011</td><td>2</td><td>Oct 19, 2026</td><td><span style="color:#16a34a;font-weight:600">● In Transit</span></td></tr>
              <tr><td><strong>SH-90765</strong></td><td>FedEx 2Day</td><td><a href="#" style="color:#0284c7">748900123456</a></td><td>Dallas, TX</td><td>PO-2026-8874</td><td>5</td><td>Oct 18, 2026</td><td><span style="color:#16a34a;font-weight:600">● Delivered</span></td></tr>
              <tr><td><strong>SH-90642</strong></td><td>Freight FreightLTL</td><td><a href="#" style="color:#0284c7">PRO-881290</a></td><td>Atlanta, GA</td><td>PO-2026-8820</td><td>40</td><td>Oct 16, 2026</td><td><span style="color:#16a34a;font-weight:600">● Delivered</span></td></tr>
            </tbody>
          </table>
        </div>
      \`;
    }

    if (activeTab === 'Customers') {
      return \`
        <div class="id-card" style="margin-bottom:16px">
          <h2 class="id-card-title">Customer Sales &amp; Demand Breakdown</h2>
          <table class="id-wh-table">
            <thead>
              <tr><th>Customer Account</th><th>Orders Placed</th><th>Units Purchased</th><th>Gross Sales</th><th>Avg Price Paid</th><th>Last Purchased</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Apex Retail Partners</strong></td><td>18 orders</td><td>124 units</td><td>$40,424.00</td><td>$326.00</td><td>Oct 18, 2026</td></tr>
              <tr><td><strong>Summit Distributing Co.</strong></td><td>12 orders</td><td>96 units</td><td>$29,760.00</td><td>$310.00</td><td>Oct 15, 2026</td></tr>
              <tr><td><strong>Prime Logistics Group</strong></td><td>9 orders</td><td>48 units</td><td>$15,120.00</td><td>$315.00</td><td>Oct 12, 2026</td></tr>
            </tbody>
          </table>
        </div>
      \`;
    }

    if (activeTab === 'POs') {
      return \`
        <div class="id-card" style="margin-bottom:16px">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px">
            <h2 class="id-card-title" style="margin:0">Vendor Purchase Orders (POs)</h2>
            <button class="eim-btn-add" type="button" id="id-btn-new-vpo">+ Create Vendor PO</button>
          </div>
          <table class="id-wh-table">
            <thead>
              <tr><th>PO #</th><th>Vendor</th><th>Qty Ordered</th><th>Qty Received</th><th>Unit Cost</th><th>ETA</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>PO-2026-887411</strong></td><td>Sony Corporation Direct</td><td>150</td><td>150</td><td>$278.00</td><td>Oct 10, 2026</td><td><span style="color:#16a34a;font-weight:600">● Received</span></td></tr>
              <tr><td><strong>PO-2026-887480</strong></td><td>Sony Logistics USA</td><td>100</td><td>0</td><td>$278.00</td><td>Nov 27, 2026</td><td><span style="color:#0284c7;font-weight:600">● Open / On Order</span></td></tr>
            </tbody>
          </table>
        </div>
      \`;
    }

    if (activeTab === 'Inv.') {
      return \`
        <div class="id-card" style="margin-bottom:16px">
          <h2 class="id-card-title">Granular Warehouse Bin &amp; Lot Allocations</h2>
          <table class="id-wh-table">
            <thead>
              <tr><th>Warehouse</th><th>Bin Location</th><th>Lot Number</th><th>On Hand</th><th>Reserved / Hold</th><th>Available ATS</th><th>Condition</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Tampa DC</strong></td><td>B-04-R2-B1</td><td>LOT-2026-10A</td><td>80</td><td>0</td><td>80</td><td><span style="color:#16a34a;font-weight:600">A-Grade Pristine</span></td></tr>
              <tr><td><strong>Tampa DC</strong></td><td>B-04-R2-B2</td><td>LOT-2026-10B</td><td>40</td><td>0</td><td>40</td><td><span style="color:#16a34a;font-weight:600">A-Grade Pristine</span></td></tr>
              <tr><td><strong>Sarasota DC</strong></td><td>A-01-R1-B4</td><td>LOT-2026-09C</td><td>80</td><td>0</td><td>80</td><td><span style="color:#16a34a;font-weight:600">A-Grade Pristine</span></td></tr>
            </tbody>
          </table>
        </div>
      \`;
    }

    if (activeTab === 'Dimensions') {
      return \`
        <div class="id-card" style="margin-bottom:16px">
          <h2 class="id-card-title">Carton &amp; Pallet Specifications</h2>
          <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; margin-bottom:18px">
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">Length (L)</span><strong style="display:block;font-size:16px;color:#0f172a;margin-top:4px">9.2 in</strong></div>
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">Width (W)</span><strong style="display:block;font-size:16px;color:#0f172a;margin-top:4px">7.8 in</strong></div>
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">Height (H)</span><strong style="display:block;font-size:16px;color:#0f172a;margin-top:4px">3.1 in</strong></div>
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">Weight (WT)</span><strong style="display:block;font-size:16px;color:#0f172a;margin-top:4px">1.45 lbs</strong></div>
            <div class="eim-card"><span style="font-size:11px;color:#64748b;font-weight:600">DWT</span><strong style="display:block;font-size:16px;color:#0f172a;margin-top:4px">1.58 lbs</strong></div>
          </div>
          <div class="id-quick-grid">
            <div class="id-quick-row"><span class="id-quick-label">Master Carton Qty</span><span class="id-quick-val">12 units</span></div>
            <div class="id-quick-row"><span class="id-quick-label">Master Carton Dimensions</span><span class="id-quick-val">19.5 x 16.2 x 13.5 in</span></div>
            <div class="id-quick-row"><span class="id-quick-label">Pallet Tie (Cartons/Layer)</span><span class="id-quick-val">8 cartons</span></div>
            <div class="id-quick-row"><span class="id-quick-label">Pallet High (Layers)</span><span class="id-quick-val">5 layers (40 cartons / 480 units)</span></div>
          </div>
        </div>
      \`;
    }

    // Fallback for other tabs
    return \`
      <div class="id-card" style="margin-bottom:16px; padding:32px; text-align:center">
        <h2 style="font-size:16px; font-weight:700; color:#0f172a; margin:0 0 8px">\${esc(activeTab)} Specifications</h2>
        <p style="font-size:13px; color:#64748b; max-width:500px; margin:0 auto">All details for \${esc(activeTab)} are synchronized with unified enterprise records.</p>
      </div>
    \`;
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================
  function bindDetailsEvents(item, catalog) {
    // Tab switching
    document.querySelectorAll('.id-tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        activeTab = e.currentTarget.getAttribute('data-tab');
        renderPage();
      });
    });

    // Thumbnail click to preview
    document.querySelectorAll('.id-hero-thumb-item, .id-img-card').forEach(el => {
      el.addEventListener('click', e => {
        const thumbKey = e.currentTarget.getAttribute('data-thumb');
        if (thumbKey) {
          activeThumb = thumbKey;
          renderPage();
        }
      });
    });

    // Pager controls
    document.querySelector('#id-pager-prev')?.addEventListener('click', () => {
      const idx = catalog.findIndex(i => (i.sku || i.model) === (item.sku || item.model));
      const target = catalog[(idx - 1 + catalog.length) % catalog.length];
      window.location.search = '?sku=' + encodeURIComponent(target.sku || target.model);
    });

    document.querySelector('#id-pager-next')?.addEventListener('click', () => {
      const idx = catalog.findIndex(i => (i.sku || i.model) === (item.sku || item.model));
      const target = catalog[(idx + 1) % catalog.length];
      window.location.search = '?sku=' + encodeURIComponent(target.sku || target.model);
    });

    // Duplicate Item
    document.querySelector('#id-action-duplicate')?.addEventListener('click', () => {
      const dupSku = (item.sku || item.model) + '-COPY';
      notice('Item duplicated as ' + dupSku + '. Redirecting to editor...');
      setTimeout(() => {
        window.location.href = 'add-item.html?clone=' + encodeURIComponent(item.sku || item.model);
      }, 1000);
    });

    // Edit Item
    document.querySelector('#id-action-edit')?.addEventListener('click', () => {
      window.location.href = 'add-item.html?edit=' + encodeURIComponent(item.sku || item.model);
    });

    // Copy UPC
    document.querySelector('#id-copy-upc')?.addEventListener('click', () => {
      const upc = item.upc || '027242920123';
      navigator.clipboard?.writeText(upc).then(() => {
        notice('Copied UPC ' + upc + ' to clipboard!');
      }).catch(() => {
        notice('UPC: ' + upc);
      });
    });

    // Character counter for description
    const descInput = document.querySelector('#id-input-desc');
    const charCounter = document.querySelector('#id-char-count');
    if (descInput && charCounter) {
      charCounter.textContent = descInput.value.length + '/2000';
      descInput.addEventListener('input', () => {
        charCounter.textContent = descInput.value.length + '/2000';
      });
    }

    // Add Image Button
    document.querySelector('#id-btn-add-img')?.addEventListener('click', () => {
      notice('Select an image file (PNG, JPG, WebP up to 5MB) to upload.');
    });

    // Feed sync button
    document.querySelector('#id-btn-sync-feeds')?.addEventListener('click', () => {
      notice('Transmitting updated ATS stock balances across Replink, API, and Amazon feeds...');
    });
  }

  // Initialize on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderPage);
  } else {
    renderPage();
  }

  window.ItemDetails = {
    render: renderPage,
    getCurrentItem: getCurrentItem
  };

})();
`;

const rootFile = path.resolve(__dirname, '..', 'item-details.js');
const assetFile = path.resolve(__dirname, '..', 'assets', 'item-details.js');

fs.writeFileSync(rootFile, scriptContent, 'utf8');
fs.writeFileSync(assetFile, scriptContent, 'utf8');
console.log('Successfully generated item-details.js and assets/item-details.js');
