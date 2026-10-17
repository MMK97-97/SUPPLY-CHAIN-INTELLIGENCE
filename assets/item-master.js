(function () {
  'use strict';

  const S = window.StarkSystem;
  if (!S) return;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => new Intl.NumberFormat('en-US').format(Number(n) || 0);
  const money = (n, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n) || 0);

  function formatDate(iso) {
    if (!iso) return 'Today at ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const params = new URLSearchParams(location.search);
  let query = params.get('search') || '';
  let selectedBrand = params.get('brand') || 'all';
  let selectedStatus = params.get('status') || 'all';
  let selectedWarehouse = params.get('warehouse') || 'all';
  let minPrice = params.get('minPrice') || '';
  let maxPrice = params.get('maxPrice') || '';
  let priceTier = params.get('tier') || 'all';
  let sortBy = params.get('sort') || 'model-asc';
  let viewMode = params.get('view') || 'table';

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

  function getItemMasterRecords() {
    const s = S.getState();
    const e = s.enterprise || {};
    const l = s.logistics || {};
    const regional = s.regional || {};

    const rawItems = e.inventory || [];
    const whRecords = l.inventory || [];
    const tplRecords = l.tplInventory || [];
    const tplNodes = l.tplNodes || [];

    return rawItems.map(item => {
      // Status resolution
      let status = item.status;
      if (!status) {
        if (/fashion|jewelry|cooler|accessory|apparel/i.test(item.title + ' ' + item.brand)) status = 'fashion';
        else if (/display|frame|showroom|presentation|demo/i.test(item.title + ' ' + item.model)) status = 'presentation';
        else if (/internal|test|lab|qa|sample|employee/i.test(item.title + ' ' + item.model)) status = 'internal use';
        else status = 'Live';
      }

      // 1. Primary Sarasota / Southeast DC inventory
      const localRows = whRecords.filter(w => w.sku === item.sku);
      const localOnHand = localRows.reduce((acc, r) => acc + (Number(r.onHand) || 0), 0);
      const localReserved = localRows.reduce((acc, r) => acc + (Number(r.reserved) || 0), 0);
      const localDamaged = localRows.reduce((acc, r) => acc + (Number(r.damaged) || 0), 0);
      const localATS = Math.max(0, localOnHand - localReserved - localDamaged);
      const localBins = [...new Set(localRows.map(r => r.binId).filter(Boolean))].join(', ') || 'A-01-R1-B1';

      // 2. 3PL Distributed Partner Nodes
      const tplDetails = {};
      let tplTotalOnHand = 0;
      let tplTotalATS = 0;

      tplNodes.forEach(node => {
        const row = tplRecords.find(t => t.nodeId === node.id && t.sku === item.sku);
        const q = Number(row?.qty) || 0;
        const res = Number(row?.reserved) || 0;
        const ats = Math.max(0, q - res);
        tplDetails[node.id] = {
          nodeId: node.id,
          name: node.name,
          city: node.city || '',
          state: node.state || '',
          code: node.code || node.id,
          onHand: q,
          reserved: res,
          ats: ats,
          lastSync: row?.lastSync || node.lastSync || null
        };
        tplTotalOnHand += q;
        tplTotalATS += ats;
      });

      // 3. Regional report sync data
      const reg = regional[item.region || 'US'];
      const regItem = reg?.items?.find(x => x.model === item.model);

      // Upload date & time resolution
      let uploadedAt = item.updatedAt || reg?.updatedAt || s.updatedAt || new Date().toISOString();
      let uploadSource = reg?.fileName ? reg.fileName : 'Live System Sync';

      // ATS calculation
      let totalOnHand = localOnHand + tplTotalOnHand;
      let totalReserved = localReserved + (item.reserved || 0);
      let totalDamaged = localDamaged + (item.damaged || 0);
      let totalATS = localATS + tplTotalATS;

      if (totalATS === 0 && Number(item.onHand) > 0) {
        totalOnHand = Number(item.onHand);
        totalATS = Math.max(0, totalOnHand - Number(item.reserved || 0) - Number(item.damaged || 0));
      }

      return {
        sku: item.sku,
        model: item.model || item.sku,
        brand: item.brand || 'General',
        title: item.title || item.description || item.model || item.sku,
        status: status,
        nature: item.nature || 'PHYSICAL',
        standardPrice: Number(item.standardPrice || item.price || 0),
        cost: Number(item.cost || 0),
        region: item.region || 'US',
        totalOnHand,
        totalReserved,
        totalDamaged,
        totalATS,
        uploadedAt,
        uploadSource,
        warehouses: {
          primary: {
            name: 'Sarasota DC',
            fullName: 'Sarasota Distribution Center (FL)',
            onHand: localOnHand || (item.nature === 'PHYSICAL' ? totalOnHand : 0),
            reserved: localReserved,
            damaged: localDamaged,
            ats: localATS || (item.nature === 'PHYSICAL' ? totalATS : 0),
            bins: localBins
          },
          tpl: tplDetails
        }
      };
    });
  }

  function getBrandList(items) {
    const map = {};
    items.forEach(i => {
      const b = (i.brand || '').trim();
      if (b) map[b] = (map[b] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function filterItems(items) {
    return items.filter(item => {
      // 1. Text Search
      if (query) {
        const q = query.toLowerCase().trim();
        const haystack = [
          item.model,
          item.sku,
          item.brand,
          item.title,
          item.status,
          item.region,
          item.warehouses.primary.bins
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // 2. Brand Filter
      if (selectedBrand !== 'all' && item.brand.toLowerCase() !== selectedBrand.toLowerCase()) {
        return false;
      }

      // 3. Status Filter (Live / fashion / internal use / presentation)
      if (selectedStatus !== 'all' && item.status.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      // 4. Warehouse Filter
      if (selectedWarehouse !== 'all') {
        if (selectedWarehouse === 'primary' || selectedWarehouse === 'sarasota') {
          if (item.warehouses.primary.onHand <= 0 && item.warehouses.primary.ats <= 0) return false;
        } else if (item.warehouses.tpl[selectedWarehouse]) {
          const tpl = item.warehouses.tpl[selectedWarehouse];
          if (tpl.onHand <= 0 && tpl.ats <= 0) return false;
        }
      }

      // 5. Price Filter
      const price = item.standardPrice;
      if (minPrice !== '' && price < Number(minPrice)) return false;
      if (maxPrice !== '' && price > Number(maxPrice)) return false;

      // Price Tier Pills
      if (priceTier === 'under50' && price >= 50) return false;
      if (priceTier === '50-150' && (price < 50 || price > 150)) return false;
      if (priceTier === '150-300' && (price < 150 || price > 300)) return false;
      if (priceTier === '300plus' && price < 300) return false;

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'model-asc': return a.model.localeCompare(b.model);
        case 'model-desc': return b.model.localeCompare(a.model);
        case 'brand-asc': return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);
        case 'price-low': return a.standardPrice - b.standardPrice;
        case 'price-high': return b.standardPrice - a.standardPrice;
        case 'ats-high': return b.totalATS - a.totalATS;
        case 'ats-low': return a.totalATS - b.totalATS;
        case 'date-desc': return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        default: return a.model.localeCompare(b.model);
      }
    });
  }

  function statusBadge(status) {
    const s = String(status || 'Live').toLowerCase();
    let badgeClass = 'im-status-live';
    let icon = '●';
    let display = 'Live';

    if (s === 'fashion') {
      badgeClass = 'im-status-fashion';
      display = 'Fashion';
    } else if (s === 'internal use' || s === 'internal_use' || s === 'internal') {
      badgeClass = 'im-status-internal';
      display = 'Internal Use';
    } else if (s === 'presentation') {
      badgeClass = 'im-status-presentation';
      display = 'Presentation';
    }

    return `<span class="im-status-badge ${badgeClass}" title="Status: ${esc(display)}"><span class="im-status-dot">${icon}</span> ${esc(display)}</span>`;
  }

  function atsPill(ats, uploadedAt, uploadSource) {
    const healthClass = ats > 20 ? 'ats-healthy' : ats > 0 ? 'ats-warning' : 'ats-danger';
    const dateFormatted = formatDate(uploadedAt);

    return `
      <div class="im-ats-cell">
        <div class="im-ats-metric ${healthClass}">
          <strong>${num(ats)}</strong>
          <span>units ATS</span>
        </div>
        <div class="im-ats-upload-stamp" title="Upload source: ${esc(uploadSource)}">
          <svg class="im-icon-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div class="im-stamp-text">
            <span class="im-stamp-date">Uploaded: ${esc(dateFormatted)}</span>
            <small class="im-stamp-source">${esc(uploadSource)}</small>
          </div>
        </div>
      </div>
    `;
  }

  function warehouseBreakdown(wh) {
    const p = wh.primary;
    const tpls = Object.values(wh.tpl || {});

    let html = `
      <div class="im-wh-matrix">
        <div class="im-wh-pill primary-wh" title="Sarasota DC / Southeast Hub · Bins: ${esc(p.bins)}">
          <span class="im-wh-tag">Sarasota DC</span>
          <span class="im-wh-stat"><b>${num(p.ats)}</b> ATS</span>
          <small class="im-wh-detail">(${num(p.onHand)} on hand)</small>
        </div>
    `;

    tpls.forEach(t => {
      const isPositive = t.ats > 0;
      html += `
        <div class="im-wh-pill ${isPositive ? 'tpl-active' : 'tpl-zero'}" title="${esc(t.name)} (${esc(t.city)}, ${esc(t.state)})">
          <span class="im-wh-tag">${esc(t.code)}</span>
          <span class="im-wh-stat"><b>${num(t.ats)}</b> ATS</span>
          <small class="im-wh-detail">(${num(t.onHand)} OH)</small>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  function exportCSV(items) {
    const headers = [
      'Model#',
      'SKU',
      'Brand',
      'Title',
      'Status',
      'Standard Price ($)',
      'Cost ($)',
      'Total On Hand',
      'Total Reserved',
      'Total Damaged',
      'Total ATS',
      'Uploaded Date & Time',
      'Upload Source',
      'Sarasota DC On Hand',
      'Sarasota DC ATS',
      'Sarasota Bins',
      'East Coast 3PL ATS',
      'Central 3PL ATS',
      'West Coast 3PL ATS'
    ];

    const rows = items.map(item => {
      const p = item.warehouses.primary;
      const t = item.warehouses.tpl;
      return [
        item.model,
        item.sku,
        item.brand,
        item.title,
        item.status,
        item.standardPrice.toFixed(2),
        item.cost.toFixed(2),
        item.totalOnHand,
        item.totalReserved,
        item.totalDamaged,
        item.totalATS,
        formatDate(item.uploadedAt),
        item.uploadSource,
        p.onHand,
        p.ats,
        p.bins,
        t.tpl_east?.ats || 0,
        t.tpl_central?.ats || 0,
        t.tpl_west?.ats || 0
      ];
    });

    const csvContent = [headers, ...rows].map(row =>
      row.map(cell => {
        let str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Item-Master-Catalog-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    notice('Item Master exported successfully.');
  }

  function openAddItemModal() {
    const brands = getBrandList(getItemMasterRecords()).map(([b]) => b);
    const body = `
      <form class="im-form" id="im-add-form">
        <div class="im-form-row">
          <label class="im-form-field">
            <span>Model # (SKU identifier) *</span>
            <input type="text" id="add-model" required placeholder="e.g. WH1000XM6, AF-300, KB-88">
          </label>
          <label class="im-form-field">
            <span>Brand *</span>
            <input type="text" id="add-brand" list="add-brand-list" required placeholder="e.g. Sony, Apple, Bose">
            <datalist id="add-brand-list">
              ${brands.map(b => `<option value="${esc(b)}">`).join('')}
            </datalist>
          </label>
        </div>

        <label class="im-form-field full">
          <span>Product Title / Description *</span>
          <input type="text" id="add-title" required placeholder="e.g. Premium Noise Canceling Wireless Headphones">
        </label>

        <div class="im-form-row three">
          <label class="im-form-field">
            <span>Catalog Status *</span>
            <select id="add-status">
              <option value="Live">Live (Commercial Catalog)</option>
              <option value="fashion">Fashion (Seasonal line / Designer)</option>
              <option value="internal use">Internal Use (Marketing / R&D QA)</option>
              <option value="presentation">Presentation (Showroom / Display)</option>
            </select>
          </label>
          <label class="im-form-field">
            <span>Standard Price ($) *</span>
            <input type="number" id="add-price" step="0.01" min="0" value="199.00" required>
          </label>
          <label class="im-form-field">
            <span>Unit Cost ($)</span>
            <input type="number" id="add-cost" step="0.01" min="0" value="120.00">
          </label>
        </div>

        <div class="im-form-row three">
          <label class="im-form-field">
            <span>Initial On Hand Units</span>
            <input type="number" id="add-onhand" min="0" step="1" value="50">
          </label>
          <label class="im-form-field">
            <span>Warehouse Destination</span>
            <select id="add-warehouse">
              <option value="sarasota">Sarasota DC (SE-01 Tampa)</option>
              <option value="tpl_east">East Coast 3PL (Edison, NJ)</option>
              <option value="tpl_central">Central 3PL (Dallas, TX)</option>
              <option value="tpl_west">West Coast 3PL (Reno, NV)</option>
            </select>
          </label>
          <label class="im-form-field">
            <span>Bin Location</span>
            <input type="text" id="add-bin" value="A-01-R1-B1" placeholder="e.g. A-01-R1-B1">
          </label>
        </div>
      </form>
    `;

    window.StarkSystemUI.dialog('Add New Catalog Item to Master', body, () => {
      const form = document.querySelector('#im-add-form');
      if (!form.reportValidity()) return false;

      const model = document.querySelector('#add-model').value.trim();
      const brand = document.querySelector('#add-brand').value.trim();
      const title = document.querySelector('#add-title').value.trim();
      const status = document.querySelector('#add-status').value;
      const price = Number(document.querySelector('#add-price').value) || 0;
      const cost = Number(document.querySelector('#add-cost').value) || 0;
      const onHand = Number(document.querySelector('#add-onhand').value) || 0;
      const binId = document.querySelector('#add-bin').value.trim() || 'A-01-R1-B1';

      if (!model || !brand || !title) {
        notice('Please fill in all required fields.', true);
        return false;
      }

      if (S.createItem) {
        S.createItem({
          model,
          brand,
          title,
          status,
          standardPrice: price,
          cost,
          onHand,
          binId
        });
      } else {
        S.transaction('ITEM_MASTER_CREATED', model, s => {
          const sku = 'PHYS-' + brand.toUpperCase().replace(/[^A-Z0-9]/g, '') + '-' + model.toUpperCase().replace(/[^A-Z0-9]/g, '');
          s.enterprise.inventory.push({
            sku,
            model,
            brand,
            title,
            status,
            nature: 'PHYSICAL',
            onHand,
            reserved: 0,
            damaged: 0,
            standardPrice: price,
            cost,
            safety: 10,
            updatedAt: new Date().toISOString()
          });
          s.logistics.inventory.push({
            sku,
            brand,
            description: title,
            binId,
            onHand,
            reserved: 0,
            damaged: 0,
            serialized: false,
            lotControl: false,
            lastCount: new Date().toISOString()
          });
        });
      }

      notice(`Item ${model} (${brand}) added to Item Master.`);
      render();
      return true;
    }, 'Create Item', { system: true });
  }

  function openEditItemModal(item) {
    const body = `
      <form class="im-form" id="im-edit-form">
        <div class="im-form-row">
          <label class="im-form-field">
            <span>Model #</span>
            <input type="text" id="edit-model" value="${esc(item.model)}" required>
          </label>
          <label class="im-form-field">
            <span>Brand</span>
            <input type="text" id="edit-brand" value="${esc(item.brand)}" required>
          </label>
        </div>

        <label class="im-form-field full">
          <span>Product Title / Description</span>
          <input type="text" id="edit-title" value="${esc(item.title)}" required>
        </label>

        <div class="im-form-row three">
          <label class="im-form-field">
            <span>Status</span>
            <select id="edit-status">
              <option value="Live" ${item.status === 'Live' ? 'selected' : ''}>Live</option>
              <option value="fashion" ${item.status === 'fashion' ? 'selected' : ''}>Fashion</option>
              <option value="internal use" ${item.status === 'internal use' ? 'selected' : ''}>Internal Use</option>
              <option value="presentation" ${item.status === 'presentation' ? 'selected' : ''}>Presentation</option>
            </select>
          </label>
          <label class="im-form-field">
            <span>Standard Price ($)</span>
            <input type="number" id="edit-price" step="0.01" min="0" value="${item.standardPrice}">
          </label>
          <label class="im-form-field">
            <span>Unit Cost ($)</span>
            <input type="number" id="edit-cost" step="0.01" min="0" value="${item.cost}">
          </label>
        </div>

        <div class="im-form-info-box">
          <div class="im-info-item"><small>Total On Hand</small><strong>${num(item.totalOnHand)} units</strong></div>
          <div class="im-info-item"><small>Available To Sell (ATS)</small><strong>${num(item.totalATS)} units</strong></div>
          <div class="im-info-item"><small>Last Uploaded / Sync</small><span>${esc(formatDate(item.uploadedAt))}</span></div>
        </div>
      </form>
    `;

    window.StarkSystemUI.dialog('Edit Item · ' + item.model, body, () => {
      const model = document.querySelector('#edit-model').value.trim();
      const brand = document.querySelector('#edit-brand').value.trim();
      const title = document.querySelector('#edit-title').value.trim();
      const status = document.querySelector('#edit-status').value;
      const standardPrice = Number(document.querySelector('#edit-price').value) || 0;
      const cost = Number(document.querySelector('#edit-cost').value) || 0;

      if (S.updateItem) {
        S.updateItem(item.sku, { model, brand, title, status, standardPrice, cost });
      } else {
        S.transaction('ITEM_MASTER_UPDATED', item.sku, s => {
          const inv = s.enterprise.inventory.find(x => x.sku === item.sku);
          if (inv) {
            inv.model = model;
            inv.brand = brand;
            inv.title = title;
            inv.status = status;
            inv.standardPrice = standardPrice;
            inv.cost = cost;
            inv.updatedAt = new Date().toISOString();
          }
        });
      }

      notice(`Updated item ${model} (${brand}).`);
      render();
      return true;
    }, 'Save Changes', { system: true });
  }

  function changeStatusQuickly(sku, newStatus) {
    if (S.updateItem) {
      S.updateItem(sku, { status: newStatus });
    } else {
      S.transaction('ITEM_STATUS_UPDATED', sku, s => {
        const inv = s.enterprise.inventory.find(x => x.sku === sku);
        if (inv) {
          inv.status = newStatus;
          inv.updatedAt = new Date().toISOString();
        }
      });
    }
    notice(`Status updated to ${newStatus}.`);
    render();
  }

  function render() {
    const root = document.querySelector('#item-master-content');
    if (!root) return;

    const allRecords = getItemMasterRecords();
    const brands = getBrandList(allRecords);
    const filtered = filterItems(allRecords);

    // KPI Aggregates
    const totalSKUs = allRecords.length;
    const totalATS = allRecords.reduce((acc, i) => acc + i.totalATS, 0);
    const liveCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'live').length;
    const fashionCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'fashion').length;
    const internalCount = allRecords.filter(i => ['internal use', 'internal_use', 'internal'].includes((i.status || '').toLowerCase())).length;
    const presentationCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'presentation').length;

    let html = `
      <!-- Page Header -->
      <div class="im-header">
        <div class="im-header-title-block">
          <div class="system-eyebrow">Inventory &amp; Planning · Master Catalog Control</div>
          <h1 class="im-page-title">Enterprise Item Master</h1>
          <p class="im-page-subtitle">Search, filter, and track catalog SKUs with multi-warehouse inventory breakdown, real-time Available-to-Sell (ATS), upload timestamps, and lifecycle status classification.</p>
        </div>
        <div class="im-header-actions">
          <button class="sys-btn" id="im-btn-export" type="button">
            <svg class="im-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Item Master
          </button>
          <button class="sys-btn primary" id="im-btn-add" type="button">
            <svg class="im-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add New Item
          </button>
        </div>
      </div>

      <!-- KPI Metrics Overview -->
      <div class="im-kpis">
        <div class="im-kpi-card">
          <div class="im-kpi-header">
            <span class="im-kpi-label">Master Catalog</span>
            <span class="im-kpi-icon" style="--kpi-accent:#0284c7">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </span>
          </div>
          <strong class="im-kpi-value">${num(totalSKUs)}</strong>
          <small class="im-kpi-sub">Total active SKUs</small>
        </div>

        <div class="im-kpi-card">
          <div class="im-kpi-header">
            <span class="im-kpi-label">Available To Sell (ATS)</span>
            <span class="im-kpi-icon" style="--kpi-accent:#10b981">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </div>
          <strong class="im-kpi-value">${num(totalATS)}</strong>
          <small class="im-kpi-sub">Units across all nodes</small>
        </div>

        <div class="im-kpi-card" data-filter-status="Live" role="button" tabindex="0" title="Click to filter by Live items">
          <div class="im-kpi-header">
            <span class="im-kpi-label">Live Commercial</span>
            <span class="im-kpi-icon" style="--kpi-accent:#059669">
              <span class="im-kpi-dot">●</span>
            </span>
          </div>
          <strong class="im-kpi-value">${num(liveCount)}</strong>
          <small class="im-kpi-sub">Active catalog</small>
        </div>

        <div class="im-kpi-card" data-filter-status="fashion" role="button" tabindex="0" title="Click to filter by Fashion items">
          <div class="im-kpi-header">
            <span class="im-kpi-label">Fashion Line</span>
            <span class="im-kpi-icon" style="--kpi-accent:#c026d3">
              <span class="im-kpi-dot">●</span>
            </span>
          </div>
          <strong class="im-kpi-value">${num(fashionCount)}</strong>
          <small class="im-kpi-sub">Designer / Seasonal</small>
        </div>

        <div class="im-kpi-card" data-filter-status="internal use" role="button" tabindex="0" title="Click to filter by Internal Use items">
          <div class="im-kpi-header">
            <span class="im-kpi-label">Internal Use</span>
            <span class="im-kpi-icon" style="--kpi-accent:#d97706">
              <span class="im-kpi-dot">●</span>
            </span>
          </div>
          <strong class="im-kpi-value">${num(internalCount)}</strong>
          <small class="im-kpi-sub">Marketing / Samples</small>
        </div>

        <div class="im-kpi-card" data-filter-status="presentation" role="button" tabindex="0" title="Click to filter by Presentation items">
          <div class="im-kpi-header">
            <span class="im-kpi-label">Presentation</span>
            <span class="im-kpi-icon" style="--kpi-accent:#2563eb">
              <span class="im-kpi-dot">●</span>
            </span>
          </div>
          <strong class="im-kpi-value">${num(presentationCount)}</strong>
          <small class="im-kpi-sub">Showroom / Display</small>
        </div>
      </div>

      <!-- Search & 4-Dimension Filter Control Tower -->
      <div class="im-toolbar-panel">
        <div class="im-toolbar-top">
          <!-- Text Search Box -->
          <div class="im-search-box">
            <svg class="im-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="im-search-input" placeholder="Search by model#, brand, title, SKU, bin..." value="${esc(query)}" autocomplete="off" aria-label="Search catalog items">
            ${query ? `<button type="button" class="im-clear-search" id="im-clear-search-btn" title="Clear search">✕</button>` : ''}
          </div>

          <!-- Dimension 1: Brand Filter -->
          <div class="im-filter-group">
            <label class="im-filter-label" for="im-brand-select">Brand</label>
            <select id="im-brand-select" class="im-select">
              <option value="all">All Brands (${brands.reduce((acc, [, c]) => acc + c, 0)})</option>
              ${brands.map(([b, count]) => `<option value="${esc(b)}" ${selectedBrand.toLowerCase() === b.toLowerCase() ? 'selected' : ''}>${esc(b)} (${count})</option>`).join('')}
            </select>
          </div>

          <!-- Dimension 3: Warehouse Filter -->
          <div class="im-filter-group">
            <label class="im-filter-label" for="im-warehouse-select">Warehouse</label>
            <select id="im-warehouse-select" class="im-select">
              <option value="all" ${selectedWarehouse === 'all' ? 'selected' : ''}>All Warehouses</option>
              <option value="primary" ${selectedWarehouse === 'primary' ? 'selected' : ''}>Sarasota DC (Tampa, FL)</option>
              <option value="tpl_east" ${selectedWarehouse === 'tpl_east' ? 'selected' : ''}>East Coast 3PL (Edison, NJ)</option>
              <option value="tpl_central" ${selectedWarehouse === 'tpl_central' ? 'selected' : ''}>Central 3PL (Dallas, TX)</option>
              <option value="tpl_west" ${selectedWarehouse === 'tpl_west' ? 'selected' : ''}>West Coast 3PL (Reno, NV)</option>
            </select>
          </div>

          <!-- Sort Selector -->
          <div class="im-filter-group">
            <label class="im-filter-label" for="im-sort-select">Sort by</label>
            <select id="im-sort-select" class="im-select">
              <option value="model-asc" ${sortBy === 'model-asc' ? 'selected' : ''}>Model # (A → Z)</option>
              <option value="model-desc" ${sortBy === 'model-desc' ? 'selected' : ''}>Model # (Z → A)</option>
              <option value="brand-asc" ${sortBy === 'brand-asc' ? 'selected' : ''}>Brand (A → Z)</option>
              <option value="price-high" ${sortBy === 'price-high' ? 'selected' : ''}>Price (High → Low)</option>
              <option value="price-low" ${sortBy === 'price-low' ? 'selected' : ''}>Price (Low → High)</option>
              <option value="ats-high" ${sortBy === 'ats-high' ? 'selected' : ''}>ATS Available (High → Low)</option>
              <option value="ats-low" ${sortBy === 'ats-low' ? 'selected' : ''}>ATS Available (Low → High)</option>
              <option value="date-desc" ${sortBy === 'date-desc' ? 'selected' : ''}>Upload Date (Newest)</option>
            </select>
          </div>

          <!-- View Mode Toggle -->
          <div class="im-view-toggles">
            <button class="im-view-btn ${viewMode === 'table' ? 'active' : ''}" id="im-toggle-table" type="button" title="Dense Table View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <button class="im-view-btn ${viewMode === 'cards' ? 'active' : ''}" id="im-toggle-cards" type="button" title="Card Grid View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
          </div>
        </div>

        <!-- Filter Sub-Row: Dimension 4 Status Segmented Tabs + Dimension 2 Price Range -->
        <div class="im-toolbar-bottom">
          <!-- Dimension 4: Status Segmented Control -->
          <div class="im-status-tabs" role="tablist" aria-label="Item Status">
            <button class="im-status-tab ${selectedStatus === 'all' ? 'active' : ''}" data-status="all" type="button">
              All Items (${allRecords.length})
            </button>
            <button class="im-status-tab live-tab ${selectedStatus.toLowerCase() === 'live' ? 'active' : ''}" data-status="Live" type="button">
              <span class="im-dot live">●</span> Live (${liveCount})
            </button>
            <button class="im-status-tab fashion-tab ${selectedStatus.toLowerCase() === 'fashion' ? 'active' : ''}" data-status="fashion" type="button">
              <span class="im-dot fashion">●</span> Fashion (${fashionCount})
            </button>
            <button class="im-status-tab internal-tab ${selectedStatus.toLowerCase() === 'internal use' ? 'active' : ''}" data-status="internal use" type="button">
              <span class="im-dot internal">●</span> Internal Use (${internalCount})
            </button>
            <button class="im-status-tab presentation-tab ${selectedStatus.toLowerCase() === 'presentation' ? 'active' : ''}" data-status="presentation" type="button">
              <span class="im-dot presentation">●</span> Presentation (${presentationCount})
            </button>
          </div>

          <!-- Dimension 2: Price Filter Tier Pills + Range Inputs -->
          <div class="im-price-toolbar">
            <span class="im-price-label">Price:</span>
            <div class="im-price-chips">
              <button class="im-price-chip ${priceTier === 'all' ? 'active' : ''}" data-tier="all" type="button">All</button>
              <button class="im-price-chip ${priceTier === 'under50' ? 'active' : ''}" data-tier="under50" type="button">&lt; $50</button>
              <button class="im-price-chip ${priceTier === '50-150' ? 'active' : ''}" data-tier="50-150" type="button">$50–$150</button>
              <button class="im-price-chip ${priceTier === '150-300' ? 'active' : ''}" data-tier="150-300" type="button">$150–$300</button>
              <button class="im-price-chip ${priceTier === '300plus' ? 'active' : ''}" data-tier="300plus" type="button">$300+</button>
            </div>

            <div class="im-price-inputs">
              <span class="im-currency-symbol">$</span>
              <input type="number" id="im-min-price" placeholder="Min" value="${esc(minPrice)}" min="0" step="10">
              <span class="im-price-divider">–</span>
              <span class="im-currency-symbol">$</span>
              <input type="number" id="im-max-price" placeholder="Max" value="${esc(maxPrice)}" min="0" step="10">
              <button class="sys-btn small" id="im-apply-price" type="button">Apply</button>
            </div>

            ${(selectedBrand !== 'all' || selectedStatus !== 'all' || selectedWarehouse !== 'all' || query || minPrice || maxPrice || priceTier !== 'all') ? `
              <button class="im-reset-btn" id="im-reset-filters" type="button">Reset Filters</button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Result Count Bar -->
      <div class="im-result-bar">
        <div class="im-result-text">
          Showing <b>${num(filtered.length)}</b> of <b>${num(allRecords.length)}</b> catalog items
          ${selectedBrand !== 'all' ? ` · Brand: <b>${esc(selectedBrand)}</b>` : ''}
          ${selectedStatus !== 'all' ? ` · Status: <b>${esc(selectedStatus)}</b>` : ''}
          ${selectedWarehouse !== 'all' ? ` · Warehouse: <b>${esc(selectedWarehouse === 'primary' ? 'Sarasota DC' : selectedWarehouse)}</b>` : ''}
          ${query ? ` · Matching "<b>${esc(query)}</b>"` : ''}
        </div>
      </div>
    `;

    // Render Table or Cards view
    if (viewMode === 'table') {
      html += `
        <div class="im-table-wrapper">
          <table class="im-data-table" id="im-main-table">
            <thead>
              <tr>
                <th style="width:160px">Model # / SKU</th>
                <th style="width:120px">Brand</th>
                <th style="min-width:220px">Title / Product Description</th>
                <th style="width:130px">Status</th>
                <th style="width:110px">Standard Price</th>
                <th style="width:230px">ATS (Available to Sell)</th>
                <th style="min-width:280px">Inventory by Warehouse</th>
                <th style="width:110px;text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="8" class="im-empty-row">
                    <div class="im-empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <h3>No catalog items found</h3>
                      <p>No items matched your current search and filter combination.</p>
                      <button class="sys-btn" id="im-empty-reset" type="button">Clear All Filters</button>
                    </div>
                  </td>
                </tr>
              ` : filtered.map(item => `
                <tr data-sku="${esc(item.sku)}">
                  <!-- Model # -->
                  <td class="im-model-cell">
                    <strong class="im-model-badge">${esc(item.model)}</strong>
                    <code class="im-sku-code">${esc(item.sku)}</code>
                  </td>

                  <!-- Brand -->
                  <td class="im-brand-cell">
                    <span class="im-brand-badge">${esc(item.brand)}</span>
                  </td>

                  <!-- Title -->
                  <td class="im-title-cell">
                    <div class="im-product-title">${esc(item.title)}</div>
                    <small class="im-product-meta">Nature: <b>${esc(item.nature)}</b> · Region: <b>${esc(item.region)}</b></small>
                  </td>

                  <!-- Status with Inline Changer -->
                  <td class="im-status-cell">
                    <div class="im-status-select-wrap">
                      <select class="im-inline-status-select" data-sku="${esc(item.sku)}" aria-label="Change status for ${esc(item.model)}">
                        <option value="Live" ${item.status === 'Live' ? 'selected' : ''}>● Live</option>
                        <option value="fashion" ${item.status === 'fashion' ? 'selected' : ''}>● Fashion</option>
                        <option value="internal use" ${item.status === 'internal use' ? 'selected' : ''}>● Internal Use</option>
                        <option value="presentation" ${item.status === 'presentation' ? 'selected' : ''}>● Presentation</option>
                      </select>
                    </div>
                  </td>

                  <!-- Price -->
                  <td class="im-price-cell">
                    <strong>${money(item.standardPrice)}</strong>
                    ${item.cost > 0 ? `<small class="im-cost-sub">Cost: ${money(item.cost)}</small>` : ''}
                  </td>

                  <!-- ATS with Uploaded Date and Time -->
                  <td class="im-ats-column">
                    ${atsPill(item.totalATS, item.uploadedAt, item.uploadSource)}
                  </td>

                  <!-- Inventory by Warehouse -->
                  <td class="im-wh-column">
                    ${warehouseBreakdown(item.warehouses)}
                  </td>

                  <!-- Row Actions -->
                  <td class="im-actions-cell">
                    <div class="im-row-actions">
                      <button class="sys-btn small" data-edit-item="${esc(item.sku)}" type="button" title="Edit Item Details">✏️ Edit</button>
                      <a class="sys-btn small" href="${S.url('warehouse-management/inventory-bins.html')}" title="View Warehouse Bins">📦 Bins</a>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Cards Grid View
      html += `
        <div class="im-cards-grid">
          ${filtered.length === 0 ? `
            <div class="im-empty-card">
              <h3>No items matched your search</h3>
              <p>Adjust your filters or query to see catalog products.</p>
              <button class="sys-btn" id="im-empty-reset" type="button">Reset Filters</button>
            </div>
          ` : filtered.map(item => `
            <div class="im-item-card" data-sku="${esc(item.sku)}">
              <div class="im-card-top">
                <div class="im-card-model-block">
                  <span class="im-brand-badge">${esc(item.brand)}</span>
                  <h3 class="im-card-model">${esc(item.model)}</h3>
                  <code class="im-sku-code">${esc(item.sku)}</code>
                </div>
                <div class="im-card-status-block">
                  ${statusBadge(item.status)}
                  <strong class="im-card-price">${money(item.standardPrice)}</strong>
                </div>
              </div>

              <div class="im-card-title">${esc(item.title)}</div>

              <!-- ATS with Upload Date/Time -->
              <div class="im-card-ats-box">
                <div class="im-card-ats-val">
                  <span class="im-ats-num">${num(item.totalATS)}</span>
                  <span class="im-ats-sub">Available To Sell (ATS)</span>
                </div>
                <div class="im-card-upload-stamp">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Uploaded: ${esc(formatDate(item.uploadedAt))}</span>
                </div>
              </div>

              <!-- Warehouse Breakdown -->
              <div class="im-card-wh-section">
                <div class="im-card-wh-heading">Inventory by Warehouse:</div>
                ${warehouseBreakdown(item.warehouses)}
              </div>

              <!-- Card Footer Actions -->
              <div class="im-card-footer">
                <select class="im-inline-status-select card-select" data-sku="${esc(item.sku)}" aria-label="Quick status">
                  <option value="Live" ${item.status === 'Live' ? 'selected' : ''}>Status: Live</option>
                  <option value="fashion" ${item.status === 'fashion' ? 'selected' : ''}>Status: Fashion</option>
                  <option value="internal use" ${item.status === 'internal use' ? 'selected' : ''}>Status: Internal Use</option>
                  <option value="presentation" ${item.status === 'presentation' ? 'selected' : ''}>Status: Presentation</option>
                </select>
                <button class="sys-btn small primary" data-edit-item="${esc(item.sku)}" type="button">Edit Item</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    root.innerHTML = html;
    bindEvents(allRecords, filtered);
  }

  function bindEvents(allRecords, filtered) {
    // Search input
    const searchInput = document.querySelector('#im-search-input');
    if (searchInput) {
      searchInput.oninput = e => {
        query = e.target.value;
        render();
        // Keep focus
        const next = document.querySelector('#im-search-input');
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      };
    }

    const clearSearch = document.querySelector('#im-clear-search-btn');
    if (clearSearch) {
      clearSearch.onclick = () => {
        query = '';
        render();
      };
    }

    // Brand filter
    const brandSelect = document.querySelector('#im-brand-select');
    if (brandSelect) {
      brandSelect.onchange = e => {
        selectedBrand = e.target.value;
        render();
      };
    }

    // Warehouse filter
    const whSelect = document.querySelector('#im-warehouse-select');
    if (whSelect) {
      whSelect.onchange = e => {
        selectedWarehouse = e.target.value;
        render();
      };
    }

    // Sort select
    const sortSelect = document.querySelector('#im-sort-select');
    if (sortSelect) {
      sortSelect.onchange = e => {
        sortBy = e.target.value;
        render();
      };
    }

    // Status segmented tabs
    document.querySelectorAll('.im-status-tab').forEach(tab => {
      tab.onclick = () => {
        selectedStatus = tab.dataset.status;
        render();
      };
    });

    // KPI card status shortcuts
    document.querySelectorAll('[data-filter-status]').forEach(card => {
      card.onclick = () => {
        selectedStatus = card.dataset.filterStatus;
        render();
      };
    });

    // Price tier chips
    document.querySelectorAll('.im-price-chip').forEach(chip => {
      chip.onclick = () => {
        priceTier = chip.dataset.tier;
        minPrice = '';
        maxPrice = '';
        render();
      };
    });

    // Price range inputs
    const applyPriceBtn = document.querySelector('#im-apply-price');
    if (applyPriceBtn) {
      applyPriceBtn.onclick = () => {
        minPrice = document.querySelector('#im-min-price').value.trim();
        maxPrice = document.querySelector('#im-max-price').value.trim();
        priceTier = 'all';
        render();
      };
    }

    // Reset filters
    const resetBtn = document.querySelector('#im-reset-filters') || document.querySelector('#im-empty-reset');
    if (resetBtn) {
      resetBtn.onclick = () => {
        query = '';
        selectedBrand = 'all';
        selectedStatus = 'all';
        selectedWarehouse = 'all';
        minPrice = '';
        maxPrice = '';
        priceTier = 'all';
        sortBy = 'model-asc';
        render();
      };
    }

    // View toggles
    const toggleTable = document.querySelector('#im-toggle-table');
    const toggleCards = document.querySelector('#im-toggle-cards');
    if (toggleTable) {
      toggleTable.onclick = () => {
        viewMode = 'table';
        render();
      };
    }
    if (toggleCards) {
      toggleCards.onclick = () => {
        viewMode = 'cards';
        render();
      };
    }

    // Inline status selects
    document.querySelectorAll('.im-inline-status-select').forEach(sel => {
      sel.onchange = e => {
        const sku = sel.dataset.sku;
        const newStatus = e.target.value;
        changeStatusQuickly(sku, newStatus);
      };
    });

    // Edit item buttons
    document.querySelectorAll('[data-edit-item]').forEach(btn => {
      btn.onclick = () => {
        const sku = btn.dataset.editItem;
        const item = allRecords.find(x => x.sku === sku);
        if (item) openEditItemModal(item);
      };
    });

    // Add item button
    const addBtn = document.querySelector('#im-btn-add');
    if (addBtn) addBtn.onclick = openAddItemModal;

    // Export CSV button
    const exportBtn = document.querySelector('#im-btn-export');
    if (exportBtn) exportBtn.onclick = () => exportCSV(filtered);
  }

  // Initialization & reactive listeners
  document.addEventListener('DOMContentLoaded', () => {
    render();
    if (params.get('action') === 'new') {
      setTimeout(openAddItemModal, 300);
    }
  });

  window.addEventListener('stark:system-change', () => {
    if (!document.querySelector('.sys-modal-backdrop')) {
      render();
    }
  });

  window.addEventListener('stark:region-change', render);

  // Global export
  window.StarkItemMaster = {
    render,
    openAddItemModal,
    exportCSV
  };
})();
