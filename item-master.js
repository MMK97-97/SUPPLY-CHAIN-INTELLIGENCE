(function () {
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
  // VECTOR PRODUCT ILLUSTRATIONS
  // =========================================================================
  const productSVGs = {
    'AP-SW42-BK': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="35" y="8" width="30" height="20" rx="4" fill="#334155"/>
      <rect x="35" y="72" width="30" height="20" rx="4" fill="#334155"/>
      <rect x="25" y="24" width="50" height="52" rx="12" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
      <circle cx="50" cy="50" r="16" stroke="#0284c7" stroke-width="2" stroke-dasharray="60 20" fill="none"/>
    </svg>`,
    'VYG-24-RD': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="42" y="10" width="16" height="8" rx="2" stroke="#475569" stroke-width="2" fill="none"/>
      <rect x="26" y="16" width="48" height="68" rx="8" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
      <line x1="26" y1="36" x2="74" y2="36" stroke="#b91c1c" stroke-width="2"/>
      <line x1="26" y1="52" x2="74" y2="52" stroke="#b91c1c" stroke-width="2"/>
      <line x1="26" y1="68" x2="74" y2="68" stroke="#b91c1c" stroke-width="2"/>
      <circle cx="36" cy="86" r="4" fill="#1e293b"/>
      <circle cx="64" cy="86" r="4" fill="#1e293b"/>
    </svg>`,
    'WH-1000XM5': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 50 C25 22, 75 22, 75 50" stroke="#cbd5e1" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="23" cy="58" rx="10" ry="17" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
      <ellipse cx="77" cy="58" rx="10" ry="17" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
    </svg>`,
    'WH-1000XM6': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 50 C25 22, 75 22, 75 50" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="23" cy="58" rx="10" ry="17" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
      <ellipse cx="77" cy="58" rx="10" ry="17" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
    </svg>`,
    'NB-550': `<svg viewBox="0 0 100 100" fill="none"><path d="M15 65 C20 70, 80 70, 85 64 L80 50 L60 45 L40 50 L18 55 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/><circle cx="50" cy="56" r="6" fill="#94a3b8"/></svg>`,
    'YETI-40': `<svg viewBox="0 0 100 100" fill="none"><rect x="36" y="25" width="28" height="55" rx="3" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/><rect x="34" y="20" width="32" height="6" rx="2" fill="#cbd5e1"/></svg>`,
    'BOSE-FLEX': `<svg viewBox="0 0 100 100" fill="none"><rect x="20" y="32" width="60" height="34" rx="16" fill="#0f172a" stroke="#334155" stroke-width="2"/><circle cx="50" cy="49" r="6" fill="#334155"/></svg>`,
    'RB-2140': `<svg viewBox="0 0 100 100" fill="none"><path d="M20 40 L80 40 L72 60 L54 60 L50 48 L46 60 L28 60 Z" fill="#0f172a"/></svg>`,
    'AP-PRO2': `<svg viewBox="0 0 100 100" fill="none"><rect x="30" y="36" width="40" height="34" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><circle cx="50" cy="52" r="2" fill="#10b981"/></svg>`,
    'NK-BRAS': `<svg viewBox="0 0 100 100" fill="none"><rect x="30" y="26" width="40" height="52" rx="10" fill="#0f172a" stroke="#334155" stroke-width="2"/><path d="M38 52 C46 56, 56 46, 62 40" stroke="#ffffff" stroke-width="2" fill="none"/></svg>`,
    'STAN-40': `<svg viewBox="0 0 100 100" fill="none"><rect x="36" y="22" width="28" height="60" rx="3" fill="#fce7f3" stroke="#f472b6" stroke-width="2"/><rect x="64" y="35" width="10" height="24" rx="3" stroke="#f472b6" stroke-width="2" fill="none"/></svg>`,
    'BOGG-ORIG': `<svg viewBox="0 0 100 100" fill="none"><path d="M24 35 L30 75 L70 75 L76 35 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="2"/><circle cx="40" cy="50" r="3" fill="#ffffff"/><circle cx="50" cy="50" r="3" fill="#ffffff"/><circle cx="60" cy="50" r="3" fill="#ffffff"/></svg>`
  };

  const fallbackThumbSVG = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="25" y="25" width="50" height="50" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
    <circle cx="50" cy="50" r="12" fill="#cbd5e1"/>
  </svg>`;

  // =========================================================================
  // MASTER CATALOG REPOSITORY
  // =========================================================================
  const defaultMasterCatalog = [
    {
      sku: 'AP-SW42-BK',
      model: 'AP-SW42-BK',
      recordNo: 'ITM-00034112',
      dateAdded: '09/18/2026',
      title: 'Ultra Smart Watch',
      subtitle: 'Black / 42mm',
      brand: 'AeroPress',
      upc: '850045332101',
      variant: 'Black / 42mm',
      category: 'Electronics',
      subCategory: 'Wearable Tech',
      priceNet: 129.99,
      standardPrice: 129.99,
      status: 'Active',
      availableQty: 1245,
      totalATS: 1245,
      coreItem: true,
      onHold: 0,
      description: 'High-performance GPS smartwatch with optical heart rate monitor, AMOLED display, and 7-day battery life.'
    },
    {
      sku: 'VYG-24-RD',
      model: 'VYG-24-RD',
      recordNo: 'ITM-00051289',
      dateAdded: '08/24/2026',
      title: 'Voyage Hardside Luggage',
      subtitle: 'Red / 24"',
      brand: 'Samsonite',
      upc: '043202775321',
      variant: 'Red / 24"',
      category: 'Luggage',
      subCategory: 'Checked Luggage',
      priceNet: 199.00,
      standardPrice: 199.00,
      status: 'Active',
      availableQty: 320,
      totalATS: 320,
      coreItem: true,
      onHold: 0,
      description: 'Durable polycarbonate spinner luggage with TSA-approved combination lock and 360-degree dual spinner wheels.'
    },
    {
      sku: 'WH-1000XM5',
      model: 'WH-1000XM5',
      recordNo: 'ITM-00045610',
      dateAdded: '10/05/2026',
      title: 'Noise Canceling Headphones',
      subtitle: 'White',
      brand: 'Sony',
      upc: '027242918364',
      variant: 'White',
      category: 'Electronics',
      subCategory: 'Audio',
      priceNet: 349.99,
      standardPrice: 349.99,
      status: 'Active',
      availableQty: 892,
      totalATS: 892,
      coreItem: true,
      onHold: 0,
      description: 'Flagship wireless noise cancelling headphones in silver/white with industry-leading ANC and multipoint Bluetooth connection.'
    },
    {
      sku: 'WH-1000XM6',
      model: 'WH-1000XM6',
      recordNo: 'ITM-00045678',
      dateAdded: '10/12/2026',
      title: 'Sony Wireless Noise Canceling Headphones',
      subtitle: 'Black',
      brand: 'Sony',
      upc: '027242920123',
      variant: 'Black',
      category: 'Electronics',
      subCategory: 'Headphones',
      priceNet: 349.99,
      standardPrice: 349.99,
      status: 'Active',
      availableQty: 200,
      totalATS: 200,
      coreItem: true,
      onHold: 0,
      description: 'Industry-leading noise canceling headphones with premium sound quality, 30-hour battery life, and comfortable over-ear design.'
    },
    {
      sku: 'NB-550',
      model: 'NB-550',
      recordNo: 'ITM-00028114',
      dateAdded: '07/11/2026',
      title: 'New Balance 550 Retro Sneakers',
      subtitle: 'White / Grey',
      brand: 'New Balance',
      upc: '195907456789',
      variant: 'White / Grey',
      category: 'Footwear',
      subCategory: 'Lifestyle Shoes',
      priceNet: 110.00,
      standardPrice: 110.00,
      status: 'Active',
      availableQty: 86,
      totalATS: 86,
      coreItem: true,
      onHold: 8,
      description: 'Classic 1989 basketball heritage low-top silhouette with premium leather upper.'
    },
    {
      sku: 'YETI-40',
      model: 'TMBLR-40',
      recordNo: 'ITM-00031945',
      dateAdded: '09/01/2026',
      title: 'YETI Rambler 40oz Tumbler',
      subtitle: 'Stainless Steel',
      brand: 'YETI',
      upc: '888830123456',
      variant: 'Stainless',
      category: 'Drinkware',
      subCategory: 'Tumblers',
      priceNet: 45.00,
      standardPrice: 45.00,
      status: 'Active',
      availableQty: 142,
      totalATS: 142,
      coreItem: true,
      onHold: 20,
      description: 'Double-wall vacuum-insulated stainless steel tumbler with MagSlider lid.'
    },
    {
      sku: 'BOSE-FLEX',
      model: 'SL-FLEX',
      recordNo: 'ITM-00041829',
      dateAdded: '09/20/2026',
      title: 'Bose SoundLink Flex Bluetooth Speaker',
      subtitle: 'Black',
      brand: 'Bose',
      upc: '017817835123',
      variant: 'Black',
      category: 'Electronics',
      subCategory: 'Bluetooth Speakers',
      priceNet: 129.00,
      standardPrice: 129.00,
      status: 'Active',
      availableQty: 56,
      totalATS: 56,
      coreItem: false,
      onHold: 5,
      description: 'Rugged waterproof portable Bluetooth speaker with PositionIQ technology.'
    },
    {
      sku: 'RB-2140',
      model: 'RB-2140',
      recordNo: 'ITM-00019240',
      dateAdded: '06/15/2026',
      title: 'Ray-Ban Original Wayfarer Classic',
      subtitle: 'Black / G-15 Green',
      brand: 'Ray-Ban',
      upc: '805289126577',
      variant: 'Black',
      category: 'Accessories',
      subCategory: 'Sunglasses',
      priceNet: 155.00,
      standardPrice: 155.00,
      status: 'Active',
      availableQty: 12,
      totalATS: 12,
      coreItem: false,
      onHold: 10,
      description: 'Timeless style statement with signature acetate frames and crystal green lenses.'
    },
    {
      sku: 'AP-PRO2',
      model: 'AP-PRO2',
      recordNo: 'ITM-00048190',
      dateAdded: '10/01/2026',
      title: 'Apple AirPods Pro 2 with USB-C',
      subtitle: 'White',
      brand: 'Apple',
      upc: '194253397168',
      variant: 'White',
      category: 'Electronics',
      subCategory: 'True Wireless',
      priceNet: 249.00,
      standardPrice: 249.00,
      status: 'Active',
      availableQty: 62,
      totalATS: 62,
      coreItem: true,
      onHold: 6,
      description: 'Up to 2x more Active Noise Cancellation with Transparency mode and Personalized Spatial Audio.'
    },
    {
      sku: 'NK-BRAS',
      model: 'NK-BRAS',
      recordNo: 'ITM-00037119',
      dateAdded: '08/19/2026',
      title: 'Nike Brasilia Training Backpack',
      subtitle: 'Black / 30L',
      brand: 'Nike',
      upc: '194956789012',
      variant: 'Black',
      category: 'Accessories',
      subCategory: 'Backpacks',
      priceNet: 60.00,
      standardPrice: 60.00,
      status: 'Active',
      availableQty: 48,
      totalATS: 48,
      coreItem: false,
      onHold: 4,
      description: 'Heavyweight polyester training backpack with padded laptop sleeve and multiple zip pockets.'
    },
    {
      sku: 'STAN-40',
      model: 'STAN-40',
      recordNo: 'ITM-00049102',
      dateAdded: '10/08/2026',
      title: 'Stanley The Quencher H2.0 FlowState 40oz',
      subtitle: 'Rose Quartz',
      brand: 'Stanley',
      upc: '041604389012',
      variant: 'Rose Quartz',
      category: 'Drinkware',
      subCategory: 'Tumblers',
      priceNet: 45.00,
      standardPrice: 45.00,
      status: 'Active',
      availableQty: 78,
      totalATS: 78,
      coreItem: true,
      onHold: 15,
      description: 'Recycled stainless steel travel tumbler with comfort-grip handle and 3-position FlowState lid.'
    },
    {
      sku: 'BOGG-ORIG',
      model: 'BOGG-ORIG',
      recordNo: 'ITM-00029410',
      dateAdded: '07/28/2026',
      title: 'Bogg Bag Original Large Tote',
      subtitle: 'Turquoise Blue',
      brand: 'Bogg Bag',
      upc: '850012345678',
      variant: 'Turquoise',
      category: 'Bags',
      subCategory: 'Tote Bags',
      priceNet: 90.00,
      standardPrice: 90.00,
      status: 'Active',
      availableQty: 104,
      totalATS: 104,
      coreItem: false,
      onHold: 0,
      description: 'Tip-proof, washable, durable EVA waterproof outdoor tote.'
    }
  ];

  const brandDirectory = [
    'AeroPress', 'Alex and Ani', 'All American 1930', 'All-Clad', 'Anchor', 'Andover Audio',
    'Aura Frames', 'Babish', 'Baby Jogger', 'Bala Bangles', 'Balenciaga', 'Balmain',
    'BaubleBar', 'BCBGeneration', 'Belle Etoile', 'BerghOFF', 'Bose', 'Apple', 'Nike',
    'Samsonite', 'Sony', 'Stanley', 'YETI', 'New Balance', 'Ray-Ban', 'Kendra Scott',
    'Coach', 'Bogg Bag', 'Dyson', 'Garmin', 'Therabody', 'Under Armour', 'Audio-Technica'
  ];

  function getCatalog() {
    try {
      const stored = localStorage.getItem('stark.enterprise.itemMaster.v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return defaultMasterCatalog;
  }

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  let wordSearchQuery = '';
  let selectedBrands = new Set();
  let brandSearchQuery = '';
  let priceType = 'Net'; // 'Net' or 'Retail'
  let filterUPC = '';
  let filterModel = '';
  let filterVariant = '';
  let filterSubCategory = '';
  let filterTitle = '';
  let filterPriceFrom = '';
  let filterPriceTo = '';
  let filterStatus = 'All';
  let filterSort = '';
  let coreOnly = false;
  let itemsPerPage = 50;
  let currentPage = 1;

  // Sync hold quantities dynamically with StarkSystem
  function getLiveItemHold(sku) {
    try {
      if (S?.getState) {
        const orders = S.getState().enterprise?.orders || [];
        return orders
          .filter(o => ['HOLD_PO', 'EVENT_PO'].includes(o.type) && o.status !== 'CANCELLED' && o.status !== 'SHIPPED')
          .reduce((sum, o) => {
            const line = (o.lines || []).find(l => (l.sku || '').toLowerCase() === (sku || '').toLowerCase());
            return sum + (line?.qty || 0);
          }, 0);
      }
    } catch (_) {}
    return 0;
  }

  // =========================================================================
  // FILTERING LOGIC
  // =========================================================================
  function filterRecords(records) {
    return records.filter(item => {
      // Word Search
      if (wordSearchQuery) {
        const q = wordSearchQuery.toLowerCase().trim();
        const str = [item.title, item.model, item.sku, item.upc, item.brand, item.category, item.subCategory, item.variant]
          .filter(Boolean).join(' ').toLowerCase();
        if (!str.includes(q)) return false;
      }

      // Brand checkboxes
      if (selectedBrands.size > 0 && !selectedBrands.has(item.brand)) {
        return false;
      }

      // Product Details Card
      if (filterUPC && !(item.upc || '').toLowerCase().includes(filterUPC.toLowerCase().trim())) return false;
      if (filterModel && !(item.model || item.sku || '').toLowerCase().includes(filterModel.toLowerCase().trim())) return false;
      if (filterVariant && !(item.variant || '').toLowerCase().includes(filterVariant.toLowerCase().trim())) return false;
      if (filterSubCategory && filterSubCategory !== 'All Sub Categories' && (item.subCategory || '').toLowerCase() !== filterSubCategory.toLowerCase()) return false;
      if (filterTitle && !(item.title || '').toLowerCase().includes(filterTitle.toLowerCase().trim())) return false;

      // Pricing Card
      const p = Number(item.priceNet || item.standardPrice || 0);
      if (filterPriceFrom && p < Number(filterPriceFrom)) return false;
      if (filterPriceTo && p > Number(filterPriceTo)) return false;

      // Status
      if (filterStatus && filterStatus !== 'All' && (item.status || '').toLowerCase() !== filterStatus.toLowerCase()) return false;

      // Core items toggle
      if (coreOnly && !item.coreItem) return false;

      return true;
    });
  }

  // =========================================================================
  // MAIN RENDERER
  // =========================================================================
  function render() {
    const root = document.querySelector('#item-master-content');
    if (!root) return;

    const allRecords = getCatalog();
    const filtered = filterRecords(allRecords);

    // Dynamic metrics
    const totalItemsCount = 124893;
    const activeBrandsCount = 482;
    const coreItemsCount = 12458;
    const itemsOnHoldCount = 1204;

    // Filter brand list based on brand search input
    const visibleBrands = brandDirectory.filter(b => 
      !brandSearchQuery || b.toLowerCase().includes(brandSearchQuery.toLowerCase().trim())
    );

    root.innerHTML = `
      <!-- SupplyChainPro Top Navigation Bar -->
      <header class="system-header scp-top-nav" role="banner">
        <div class="scp-left-group">
          <a class="scp-brand" href="workspace.html" title="SupplyChainPro Dashboard">
            <svg class="scp-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <span class="scp-brand-text">SupplyChainPro</span>
          </a>
          <ul class="scp-nav-links">
            <li><a class="scp-nav-link" href="workspace.html">Home</a></li>
            <li><a class="scp-nav-link" href="control-tower.html">Inventory</a></li>
            <li><a class="scp-nav-link" href="all-open-orders.html">Orders</a></li>
            <li><a class="scp-nav-link active" href="item-master.html">Item Master</a></li>
            <li><a class="scp-nav-link" href="vendors.html">Vendors</a></li>
            <li><a class="scp-nav-link" href="crm.html">Customers</a></li>
            <li><a class="scp-nav-link" href="demand-lab.html">Reports</a></li>
          </ul>
        </div>
        <div class="scp-right-controls">
          <div class="scp-search-box">
            <svg class="scp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="scp-search-input" placeholder="Search items, orders, customers..." autocomplete="off">
          </div>
          <button class="scp-icon-btn" title="Notifications" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="scp-badge-dot"></span>
          </button>
          <button class="scp-icon-btn" title="Settings" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <div class="scp-user-pill">
            <div class="scp-user-avatar">JD</div>
            <div class="scp-user-info">
              <span class="scp-user-name">John Doe</span>
              <span class="scp-user-role">Supply Chain</span>
            </div>
          </div>
        </div>
      </header>

      <div class="eim-page-wrap">
        <!-- Page Header -->
        <div class="eim-header">
          <div class="eim-header-left">
            <div class="eim-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div>
              <h1 class="eim-title">Enterprise Item Master</h1>
              <p class="eim-subtitle">Search and manage product records, pricing, specifications, and brand data across your supply chain.</p>
            </div>
          </div>
          <a class="eim-btn-add" href="add-item.html" id="eim-btn-add-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            + Add New Item
          </a>
        </div>

        <!-- Word Search Card -->
        <div class="eim-word-search-card">
          <div class="eim-ws-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Word Search
          </div>
          <input class="eim-ws-input" id="eim-word-search-input" type="text" value="${esc(wordSearchQuery)}" placeholder="Search by model #, UPC, variant, color, category, etc. (e.g. bear charm, black watch, red luggage...)">
          <button class="eim-ws-btn-reset" id="eim-btn-reset-all" type="button">Reset All</button>
          <button class="eim-ws-btn-search" id="eim-btn-do-search" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Search Items
          </button>
        </div>

        <!-- Filters Section & Brands Sidebar Layout -->
        <div class="eim-filter-layout">
          <!-- Left Column: 6 Filter Cards -->
          <div class="eim-filter-left">
            <!-- Card 1: Product Details -->
            <div class="eim-card" id="eim-card-prod">
              <div class="eim-card-head" data-toggle="collapse">
                <div class="eim-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  Product Details
                </div>
                <span class="eim-card-chevron">▲</span>
              </div>
              <div class="eim-card-body">
                <div class="eim-form-row-4">
                  <label class="eim-field">
                    <span class="eim-field-label">UPC #</span>
                    <input class="eim-input" id="eim-filter-upc" type="text" value="${esc(filterUPC)}" placeholder="Enter UPC #">
                  </label>
                  <label class="eim-field">
                    <span class="eim-field-label">Model #</span>
                    <input class="eim-input" id="eim-filter-model" type="text" value="${esc(filterModel)}" placeholder="Enter model #">
                  </label>
                  <label class="eim-field">
                    <span class="eim-field-label">Variant</span>
                    <input class="eim-input" id="eim-filter-variant" type="text" value="${esc(filterVariant)}" placeholder="Enter variant">
                  </label>
                  <label class="eim-field">
                    <span class="eim-field-label">Sub Category</span>
                    <select class="eim-select" id="eim-filter-subcat">
                      <option value="">Select sub category</option>
                      <option ${filterSubCategory === 'Wearable Tech' ? 'selected' : ''}>Wearable Tech</option>
                      <option ${filterSubCategory === 'Checked Luggage' ? 'selected' : ''}>Checked Luggage</option>
                      <option ${filterSubCategory === 'Headphones' ? 'selected' : ''}>Headphones</option>
                      <option ${filterSubCategory === 'Audio' ? 'selected' : ''}>Audio</option>
                      <option ${filterSubCategory === 'Drinkware' ? 'selected' : ''}>Drinkware</option>
                    </select>
                  </label>
                </div>
                <label class="eim-field">
                  <span class="eim-field-label">Title</span>
                  <input class="eim-input" id="eim-filter-title" type="text" value="${esc(filterTitle)}" placeholder="Enter item title">
                </label>
              </div>
            </div>

            <!-- Card 2: Pricing -->
            <div class="eim-card" id="eim-card-pricing">
              <div class="eim-card-head" data-toggle="collapse">
                <div class="eim-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  Pricing
                </div>
                <span class="eim-card-chevron">▲</span>
              </div>
              <div class="eim-card-body">
                <div class="eim-form-row-3">
                  <label class="eim-field">
                    <span class="eim-field-label">Price From</span>
                    <div class="eim-input-prefix-wrap">
                      <span class="eim-input-prefix">$</span>
                      <input id="eim-filter-pfrom" type="number" step="0.01" value="${esc(filterPriceFrom)}" placeholder="0.00">
                    </div>
                  </label>
                  <label class="eim-field">
                    <span class="eim-field-label">Price To</span>
                    <div class="eim-input-prefix-wrap">
                      <span class="eim-input-prefix">$</span>
                      <input id="eim-filter-pto" type="number" step="0.01" value="${esc(filterPriceTo)}" placeholder="0.00">
                    </div>
                  </label>
                  <div class="eim-field">
                    <span class="eim-field-label">Price Type ⓘ</span>
                    <div class="eim-price-toggle-group">
                      <button class="eim-price-toggle-btn ${priceType === 'Net' ? 'active' : ''}" type="button" data-ptype="Net">Net</button>
                      <button class="eim-price-toggle-btn ${priceType === 'Retail' ? 'active' : ''}" type="button" data-ptype="Retail">Retail</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Card 3: Carton Specifications -->
            <div class="eim-card" id="eim-card-carton">
              <div class="eim-card-head" data-toggle="collapse">
                <div class="eim-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  Carton Specifications
                </div>
                <span class="eim-card-chevron">▲</span>
              </div>
              <div class="eim-card-body">
                <div class="eim-form-row-5">
                  <label class="eim-field"><span class="eim-field-label">Length (L)</span><input class="eim-input" type="text" placeholder="0.00"></label>
                  <label class="eim-field"><span class="eim-field-label">Width (W)</span><input class="eim-input" type="text" placeholder="0.00"></label>
                  <label class="eim-field"><span class="eim-field-label">Height (H)</span><input class="eim-input" type="text" placeholder="0.00"></label>
                  <label class="eim-field"><span class="eim-field-label">Weight (WT)</span><input class="eim-input" type="text" placeholder="0.00"></label>
                  <label class="eim-field"><span class="eim-field-label">DWT</span><input class="eim-input" type="text" placeholder="0.00"></label>
                </div>
              </div>
            </div>

            <!-- Card 4: Visibility & Status -->
            <div class="eim-card" id="eim-card-vis">
              <div class="eim-card-head" data-toggle="collapse">
                <div class="eim-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Visibility &amp; Status
                </div>
                <span class="eim-card-chevron">▲</span>
              </div>
              <div class="eim-card-body">
                <div class="eim-vis-grid">
                  <label class="eim-field">
                    <span class="eim-field-label">Show Status</span>
                    <select class="eim-select" id="eim-filter-status">
                      <option value="All">All</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Discontinued">Discontinued</option>
                    </select>
                  </label>
                  <div class="eim-toggles-col">
                    <label class="eim-toggle-label">
                      <span class="eim-switch"><input type="checkbox" id="eim-toggle-core" ${coreOnly ? 'checked' : ''}><span class="eim-slider"></span></span>
                      Core Items Only
                    </label>
                    <label class="eim-toggle-label">
                      <span class="eim-switch"><input type="checkbox"><span class="eim-slider"></span></span>
                      Include Discontinued Items
                    </label>
                  </div>
                  <div class="eim-toggles-col">
                    <label class="eim-toggle-label">
                      <span class="eim-switch"><input type="checkbox"><span class="eim-slider"></span></span>
                      Include Non-active Brands
                    </label>
                    <label class="eim-toggle-label">
                      <span class="eim-switch"><input type="checkbox" checked><span class="eim-slider"></span></span>
                      Items in Replink
                    </label>
                    <label class="eim-toggle-label">
                      <span class="eim-switch"><input type="checkbox" checked><span class="eim-slider"></span></span>
                      Items in BI
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Card 5: Customer & Event Filters -->
            <div class="eim-card" id="eim-card-events">
              <div class="eim-card-head" data-toggle="collapse">
                <div class="eim-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Customer &amp; Event Filters
                </div>
                <span class="eim-card-chevron">▲</span>
              </div>
              <div class="eim-card-body">
                <div class="eim-cust-filters-grid">
                  <div class="eim-cust-selects-row">
                    <label class="eim-field">
                      <span class="eim-field-label">Customers with Special Pricing</span>
                      <select class="eim-select"><option>Select...</option><option>Apex Retail Partners</option><option>Summit Distributing</option></select>
                    </label>
                    <label class="eim-field">
                      <span class="eim-field-label">Customers</span>
                      <select class="eim-select"><option>Select...</option><option>All Customers</option></select>
                    </label>
                    <label class="eim-field">
                      <span class="eim-field-label">Events</span>
                      <select class="eim-select"><option>Select...</option><option>All Events</option></select>
                    </label>
                  </div>
                  <div class="eim-toggles-col">
                    <label class="eim-toggle-label">
                      <span class="eim-switch"><input type="checkbox"><span class="eim-slider"></span></span>
                      Has ETA
                    </label>
                    <label class="eim-toggle-label">
                      <span class="eim-switch"><input type="checkbox"><span class="eim-slider"></span></span>
                      Items with Hold Qty Only
                    </label>
                    <label class="eim-toggle-label">
                      <span class="eim-switch"><input type="checkbox"><span class="eim-slider"></span></span>
                      Items Not in Workhuman Only
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Card 6: Sort -->
            <div class="eim-card" id="eim-card-sort">
              <div class="eim-card-head" data-toggle="collapse">
                <div class="eim-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
                  Sort
                </div>
                <span class="eim-card-chevron">▲</span>
              </div>
              <div class="eim-card-body">
                <label class="eim-field" style="max-width:300px">
                  <span class="eim-field-label">Sort By</span>
                  <select class="eim-select" id="eim-sort-select">
                    <option value="">Select...</option>
                    <option value="brand-asc">Brand (A - Z)</option>
                    <option value="model-asc">Model # (A - Z)</option>
                    <option value="price-asc">Price (Low to High)</option>
                    <option value="price-desc">Price (High to Low)</option>
                    <option value="avail-desc">Available Qty (High to Low)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <!-- Right Column: Brands Sidebar -->
          <div class="eim-brands-card">
            <div class="eim-brands-head">
              <div class="eim-brands-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                Brands
              </div>
              <a class="eim-brands-select-all" id="eim-btn-select-all-brands" href="#">Select All</a>
            </div>
            <div class="eim-brands-search">
              <svg class="eim-brands-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="eim-brands-filter-input" value="${esc(brandSearchQuery)}" placeholder="Search brands...">
            </div>
            <div class="eim-brands-list">
              ${visibleBrands.map(b => `
                <label class="eim-brand-item">
                  <input type="checkbox" value="${esc(b)}" ${selectedBrands.has(b) ? 'checked' : ''}>
                  <span>${esc(b)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Metrics Summary Row (4 KPI Cards) -->
        <div class="eim-metrics-grid">
          <div class="eim-metric-card">
            <div class="eim-metric-left">
              <div class="eim-metric-icon-wrap blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              </div>
              <div>
                <span class="eim-metric-label">Total Items</span>
                <div class="eim-metric-val">${num(totalItemsCount)}</div>
              </div>
            </div>
            <div class="eim-metric-right">
              <div class="eim-metric-trend">↑ 12%</div>
              <div class="eim-metric-trend-sub">vs. last month</div>
            </div>
          </div>

          <div class="eim-metric-card">
            <div class="eim-metric-left">
              <div class="eim-metric-icon-wrap green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </div>
              <div>
                <span class="eim-metric-label">Active Brands</span>
                <div class="eim-metric-val">${num(activeBrandsCount)}</div>
              </div>
            </div>
            <div class="eim-metric-right">
              <div class="eim-metric-trend">↑ 3%</div>
              <div class="eim-metric-trend-sub">vs. last month</div>
            </div>
          </div>

          <div class="eim-metric-card">
            <div class="eim-metric-left">
              <div class="eim-metric-icon-wrap purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div>
                <span class="eim-metric-label">Core Items</span>
                <div class="eim-metric-val">${num(coreItemsCount)}</div>
              </div>
            </div>
            <div class="eim-metric-right">
              <div class="eim-metric-trend">↑ 8%</div>
              <div class="eim-metric-trend-sub">vs. last month</div>
            </div>
          </div>

          <div class="eim-metric-card">
            <div class="eim-metric-left">
              <div class="eim-metric-icon-wrap yellow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <span class="eim-metric-label">Items on Hold</span>
                <div class="eim-metric-val">${num(itemsOnHoldCount)}</div>
              </div>
            </div>
            <div class="eim-metric-right">
              <div class="eim-metric-trend">↑ 24%</div>
              <div class="eim-metric-trend-sub">vs. last month</div>
            </div>
          </div>
        </div>

        <!-- Search Results Card & Table -->
        <div class="eim-results-card">
          <div class="eim-results-head">
            <div class="eim-results-title">
              Search Results (1 - ${Math.min(filtered.length, itemsPerPage)} of ${num(totalItemsCount)} items)
            </div>
            <div class="eim-results-controls">
              <div class="eim-per-page-wrap">
                <span>Show</span>
                <select class="eim-per-page-select" id="eim-select-per-page">
                  <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                  <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                  <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                </select>
                <span>per page</span>
              </div>
              <div class="eim-pagination">
                <button class="eim-page-btn" type="button" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>
                <button class="eim-page-btn active" type="button">1</button>
                <button class="eim-page-btn" type="button">2</button>
                <button class="eim-page-btn" type="button">3</button>
                <button class="eim-page-btn" type="button">4</button>
                <button class="eim-page-btn" type="button">5</button>
                <button class="eim-page-btn" type="button">&gt;</button>
              </div>
            </div>
          </div>

          <div class="eim-table-wrap">
            <table class="eim-table">
              <thead>
                <tr>
                  <th style="width:36px"><input type="checkbox" id="eim-check-all-rows"></th>
                  <th style="width:50px">Image</th>
                  <th>Item</th>
                  <th>Brand</th>
                  <th>UPC #</th>
                  <th>Model #</th>
                  <th>Category</th>
                  <th>Sub Category</th>
                  <th>Price (${priceType})</th>
                  <th>Status</th>
                  <th>Available Qty</th>
                  <th style="width:36px">···</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(item => {
                  const svg = productSVGs[item.sku] || productSVGs[item.model] || fallbackThumbSVG;
                  const itemHold = getLiveItemHold(item.sku);
                  return `
                    <tr data-sku="${esc(item.sku || item.model)}">
                      <td><input type="checkbox" class="eim-row-checkbox"></td>
                      <td>
                        <div class="eim-table-thumb">
                          ${svg}
                        </div>
                      </td>
                      <td>
                        <div class="eim-item-cell">
                          <a class="eim-item-title-link" href="item-details.html?sku=${encodeURIComponent(item.sku || item.model)}">
                            ${esc(item.title)}
                          </a>
                          <span class="eim-item-subtitle">${esc(item.subtitle || item.variant || '')}</span>
                        </div>
                      </td>
                      <td>${esc(item.brand)}</td>
                      <td>${esc(item.upc || '—')}</td>
                      <td>${esc(item.model || item.sku)}</td>
                      <td>${esc(item.category || '—')}</td>
                      <td>${esc(item.subCategory || '—')}</td>
                      <td><strong>${money(item.priceNet || item.standardPrice || 0)}</strong></td>
                      <td>
                        <span class="eim-status-badge">
                          <span class="eim-status-dot"></span>
                          ${esc(item.status || 'Active')}
                        </span>
                      </td>
                      <td><strong>${num(item.availableQty || item.totalATS || 0)}</strong></td>
                      <td>
                        <button class="eim-action-menu-btn" type="button" title="Actions" data-sku="${esc(item.sku || item.model)}">···</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindMasterEvents();
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================
  function bindMasterEvents() {
    // Word Search input
    const wsInput = document.querySelector('#eim-word-search-input');
    wsInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        wordSearchQuery = wsInput.value;
        render();
      }
    });

    document.querySelector('#eim-btn-do-search')?.addEventListener('click', () => {
      wordSearchQuery = wsInput ? wsInput.value : '';
      render();
    });

    // Reset All button
    document.querySelector('#eim-btn-reset-all')?.addEventListener('click', () => {
      wordSearchQuery = '';
      selectedBrands.clear();
      brandSearchQuery = '';
      filterUPC = '';
      filterModel = '';
      filterVariant = '';
      filterSubCategory = '';
      filterTitle = '';
      filterPriceFrom = '';
      filterPriceTo = '';
      filterStatus = 'All';
      filterSort = '';
      coreOnly = false;
      notice('All catalog filters reset to default.');
      render();
    });

    // Card Collapsing
    document.querySelectorAll('.eim-card-head').forEach(head => {
      head.addEventListener('click', () => {
        const card = head.closest('.eim-card');
        card?.classList.toggle('collapsed');
      });
    });

    // Price Type Toggle (Net / Retail)
    document.querySelectorAll('.eim-price-toggle-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        priceType = e.currentTarget.getAttribute('data-ptype') || 'Net';
        render();
      });
    });

    // Product Details filters
    document.querySelector('#eim-filter-upc')?.addEventListener('input', e => { filterUPC = e.target.value; render(); });
    document.querySelector('#eim-filter-model')?.addEventListener('input', e => { filterModel = e.target.value; render(); });
    document.querySelector('#eim-filter-variant')?.addEventListener('input', e => { filterVariant = e.target.value; render(); });
    document.querySelector('#eim-filter-subcat')?.addEventListener('change', e => { filterSubCategory = e.target.value; render(); });
    document.querySelector('#eim-filter-title')?.addEventListener('input', e => { filterTitle = e.target.value; render(); });

    // Pricing filters
    document.querySelector('#eim-filter-pfrom')?.addEventListener('change', e => { filterPriceFrom = e.target.value; render(); });
    document.querySelector('#eim-filter-pto')?.addEventListener('change', e => { filterPriceTo = e.target.value; render(); });

    // Status filter
    document.querySelector('#eim-filter-status')?.addEventListener('change', e => { filterStatus = e.target.value; render(); });

    // Core Items toggle
    document.querySelector('#eim-toggle-core')?.addEventListener('change', e => { coreOnly = e.target.checked; render(); });

    // Brands Search in Sidebar
    const brandSearchInput = document.querySelector('#eim-brands-filter-input');
    brandSearchInput?.addEventListener('input', e => {
      brandSearchQuery = e.target.value;
      const visible = brandDirectory.filter(b => !brandSearchQuery || b.toLowerCase().includes(brandSearchQuery.toLowerCase().trim()));
      const listEl = document.querySelector('.eim-brands-list');
      if (listEl) {
        listEl.innerHTML = visible.map(b => `
          <label class="eim-brand-item">
            <input type="checkbox" value="${esc(b)}" ${selectedBrands.has(b) ? 'checked' : ''}>
            <span>${esc(b)}</span>
          </label>
        `).join('');
        bindBrandCheckboxEvents();
      }
    });

    function bindBrandCheckboxEvents() {
      document.querySelectorAll('.eim-brand-item input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', e => {
          const val = e.target.value;
          if (e.target.checked) selectedBrands.add(val);
          else selectedBrands.delete(val);
          render();
        });
      });
    }
    bindBrandCheckboxEvents();

    // Select All Brands
    document.querySelector('#eim-btn-select-all-brands')?.addEventListener('click', e => {
      e.preventDefault();
      if (selectedBrands.size === brandDirectory.length) {
        selectedBrands.clear();
      } else {
        brandDirectory.forEach(b => selectedBrands.add(b));
      }
      render();
    });

    // Check All Rows
    document.querySelector('#eim-check-all-rows')?.addEventListener('change', e => {
      const checked = e.target.checked;
      document.querySelectorAll('.eim-row-checkbox').forEach(c => c.checked = checked);
    });

    // Clicking table row navigates to item-details.html
    document.querySelectorAll('.eim-table tbody tr').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('a')) return;
        const sku = row.getAttribute('data-sku');
        if (sku) {
          window.location.href = 'item-details.html?sku=' + encodeURIComponent(sku);
        }
      });
    });

    // Row action button menu
    document.querySelectorAll('.eim-action-menu-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const sku = btn.getAttribute('data-sku');
        window.location.href = 'item-details.html?sku=' + encodeURIComponent(sku);
      });
    });

    // Per Page Select
    document.querySelector('#eim-select-per-page')?.addEventListener('change', e => {
      itemsPerPage = Number(e.target.value) || 50;
      render();
    });
  }

  // Initialize on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  window.ItemMasterEnterprise = {
    render: render,
    getCatalog: getCatalog
  };

})();
