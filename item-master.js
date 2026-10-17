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

      // Upload date & time resolution
      let uploadedAt = item.updatedAt || reg?.updatedAt || s.updatedAt || new Date().toISOString();
      let uploadSource = item.uploadSource || (reg?.fileName ? reg.fileName : 'Live System Sync');

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

  // Spreadsheet Parser (SheetJS .xlsx/.xls + CSV Fallback)
  function parseCSVText(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) return [];

    function parseLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          if (inQuotes && line[i + 1] === char) {
            current += char;
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === '\t') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.every(v => !v)) continue;
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }
    return rows;
  }

  function parseSpreadsheet(file) {
    return new Promise((resolve, reject) => {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const reader = new FileReader();

      if (isExcel && window.XLSX) {
        reader.onload = e => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const rawRows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
            const normalized = rawRows.map(r => {
              const res = {};
              for (const [k, v] of Object.entries(r)) {
                res[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = String(v ?? '').trim();
              }
              return res;
            });
            resolve(normalized);
          } catch (err) {
            reject(new Error('Excel read error: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = e => {
          try {
            resolve(parseCSVText(e.target.result));
          } catch (err) {
            reject(new Error('CSV read error: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsText(file);
      }
    });
  }

  function downloadCsvFile(filename, csvText) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // =========================================================================
  // ATS UPLOAD BY THE BRAND (EXCEL / CSV FILE)
  // ATS is availability at the brand
  // =========================================================================
  function openAtsUploadModal(defaultBrand = '') {
    const allRecords = getItemMasterRecords();
    const brands = getBrandList(allRecords).map(([b]) => b);
    const activeBrand = defaultBrand || (selectedBrand !== 'all' ? selectedBrand : brands[0] || 'Sony');

    let parsedRows = [];
    let uploadedFileName = '';

    const body = `
      <div class="im-form" id="im-ats-upload-form">
        <div class="im-banner-desc">
          <strong>ATS is Availability at the Brand:</strong> Upload the latest Available-To-Sell stock file provided by brand partners (Excel .xlsx, .xls, or .csv) to update availability at the brand.
        </div>

        <div class="im-form-row">
          <label class="im-form-field">
            <span>Brand Partner *</span>
            <select id="ats-upload-brand" class="im-select">
              ${brands.map(b => `<option value="${esc(b)}" ${b.toLowerCase() === activeBrand.toLowerCase() ? 'selected' : ''}>${esc(b)}</option>`).join('')}
              <option value="__NEW__">+ Add / Upload for New Brand…</option>
            </select>
          </label>
          <label class="im-form-field" id="ats-custom-brand-wrap" style="display:none">
            <span>New Brand Name *</span>
            <input type="text" id="ats-custom-brand" placeholder="e.g. Bose, Sennheiser, Samsung">
          </label>
        </div>

        <!-- File Dropzone -->
        <div class="im-upload-zone" id="ats-dropzone">
          <input type="file" id="ats-file-input" accept=".xlsx,.xls,.csv,.tsv" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p id="ats-drop-title">Drop Brand ATS Excel / CSV File Here or Browse</p>
          <small>Accepts .xlsx, .xls, .csv · Auto-detects Model#, Brand, and ATS Quantity columns</small>
        </div>

        <div class="im-upload-templates">
          <button type="button" class="im-template-btn" id="ats-download-template">📥 Download ATS Excel Template (.csv)</button>
          <button type="button" class="im-template-btn" id="ats-load-sample">⚡ Load Sample Brand ATS Feed</button>
        </div>

        <!-- Live Parsed Preview Table -->
        <div id="ats-preview-wrap" class="im-upload-preview" style="display:none">
          <table class="im-preview-table">
            <thead>
              <tr>
                <th>Model #</th>
                <th>Brand</th>
                <th>Product Description</th>
                <th style="text-align:right">Current Master ATS</th>
                <th style="text-align:right">New Brand ATS</th>
                <th style="text-align:right">Change</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="ats-preview-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    const dialog = window.StarkSystemUI.dialog('ATS Upload · Brand Availability', body, () => {
      if (!parsedRows.length) {
        notice('Please upload or load a Brand ATS file first.', true);
        return false;
      }

      const brandSelect = document.querySelector('#ats-upload-brand');
      let brandName = brandSelect.value;
      if (brandName === '__NEW__') {
        brandName = document.querySelector('#ats-custom-brand').value.trim() || 'Brand';
      }

      const uploadTimestamp = new Date().toISOString();
      const sourceLabel = `${brandName} ATS File (${uploadedFileName || 'upload.xlsx'})`;

      let updatedCount = 0;
      let createdCount = 0;

      S.transaction('BRAND_ATS_UPLOADED', `${brandName}: ${parsedRows.length} items`, s => {
        const inv = s.enterprise.inventory;
        const logInv = s.logistics.inventory;

        parsedRows.forEach(row => {
          const m = String(row.model || '').trim();
          if (!m) return;
          const newAts = Math.max(0, Number(row.ats) || 0);

          let existing = inv.find(i => (i.model && i.model.toLowerCase() === m.toLowerCase()) || i.sku.toLowerCase() === m.toLowerCase());
          if (existing) {
            existing.onHand = newAts + (existing.reserved || 0);
            existing.updatedAt = uploadTimestamp;
            existing.uploadSource = sourceLabel;
            if (row.title && !existing.title) existing.title = row.title;

            // Also update local warehouse balance
            const local = logInv.find(l => l.sku === existing.sku);
            if (local) {
              local.onHand = existing.onHand;
              local.lastCount = uploadTimestamp;
            }
            updatedCount++;
          } else {
            // New catalog item created from brand feed
            const sku = 'PHYS-' + brandName.toUpperCase().replace(/[^A-Z0-9]/g, '') + '-' + m.toUpperCase().replace(/[^A-Z0-9]/g, '');
            inv.push({
              sku,
              model: m,
              brand: brandName,
              title: row.title || m,
              nature: 'PHYSICAL',
              onHand: newAts,
              reserved: 0,
              damaged: 0,
              safety: 10,
              standardPrice: Number(row.price) || 99,
              cost: Number(row.cost) || 60,
              status: 'Live',
              region: 'US',
              updatedAt: uploadTimestamp,
              uploadSource: sourceLabel
            });
            logInv.push({
              sku,
              brand: brandName,
              description: row.title || m,
              binId: 'A-01-R1-B1',
              onHand: newAts,
              reserved: 0,
              damaged: 0,
              serialized: false,
              lotControl: false,
              lastCount: uploadTimestamp
            });
            createdCount++;
          }
        });
      });

      notice(`Brand ATS applied: ${updatedCount} items updated, ${createdCount} new SKUs recorded from ${brandName}.`);
      render();
      return true;
    }, 'Apply Brand ATS Upload', { system: true });

    // Wire up events in dialog
    const brandSel = document.querySelector('#ats-upload-brand');
    const customBrandWrap = document.querySelector('#ats-custom-brand-wrap');
    if (brandSel) {
      brandSel.onchange = () => {
        customBrandWrap.style.display = brandSel.value === '__NEW__' ? '' : 'none';
      };
    }

    const dropzone = document.querySelector('#ats-dropzone');
    const fileInput = document.querySelector('#ats-file-input');
    const dropTitle = document.querySelector('#ats-drop-title');
    const previewWrap = document.querySelector('#ats-preview-wrap');
    const previewTbody = document.querySelector('#ats-preview-tbody');

    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();
      dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('dragover'); };
      dropzone.ondragleave = () => dropzone.classList.remove('dragover');
      dropzone.ondrop = e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = e => {
        if (e.target.files.length) handleFile(e.target.files[0]);
      };
    }

    async function handleFile(file) {
      uploadedFileName = file.name;
      dropTitle.innerHTML = `File Loaded: <b>${esc(file.name)}</b> (${(file.size / 1024).toFixed(1)} KB)`;
      try {
        const rawRows = await parseSpreadsheet(file);
        processAtsRows(rawRows);
      } catch (err) {
        notice(err.message, true);
      }
    }

    function processAtsRows(rows) {
      const all = getItemMasterRecords();
      let brandName = brandSel.value === '__NEW__' ? (document.querySelector('#ats-custom-brand').value.trim() || 'Brand') : brandSel.value;

      parsedRows = rows.map(r => {
        const model = r.model || r.modelnumber || r.modelnum || r.sku || r.item || r.itemcode || r.part || r.product || '';
        const ats = r.ats || r.available || r.availability || r.brandavailability || r.stock || r.qty || r.onhand || r.units || 0;
        const title = r.title || r.description || r.productname || '';
        const brand = r.brand || brandName;
        return {
          model: String(model).trim(),
          ats: Math.max(0, Number(ats) || 0),
          title: String(title).trim(),
          brand: String(brand).trim()
        };
      }).filter(r => r.model);

      if (!parsedRows.length) {
        notice('No recognizable Model# or ATS quantity columns found in file.', true);
        return;
      }

      previewWrap.style.display = '';
      previewTbody.innerHTML = parsedRows.slice(0, 50).map(row => {
        const existing = all.find(i => i.model.toLowerCase() === row.model.toLowerCase() || i.sku.toLowerCase() === row.model.toLowerCase());
        const currentAts = existing ? existing.totalATS : 0;
        const diff = row.ats - currentAts;
        const diffClass = diff > 0 ? 'im-delta-pos' : diff < 0 ? 'im-delta-neg' : 'im-delta-zero';
        const diffText = diff > 0 ? `+${diff}` : `${diff}`;

        return `
          <tr>
            <td><strong>${esc(row.model)}</strong></td>
            <td>${esc(row.brand || brandName)}</td>
            <td>${esc(row.title || existing?.title || '—')}</td>
            <td style="text-align:right">${num(currentAts)}</td>
            <td style="text-align:right"><strong>${num(row.ats)}</strong></td>
            <td style="text-align:right" class="${diffClass}">${diffText}</td>
            <td>${existing ? '<span class="sys-badge green">Matched SKU</span>' : '<span class="sys-badge orange">New SKU</span>'}</td>
          </tr>
        `;
      }).join('');

      notice(`Parsed ${parsedRows.length} brand ATS lines from file.`);
    }

    // Template download
    document.querySelector('#ats-download-template').onclick = () => {
      const template = 'Model#,Brand,Available_ATS,Product_Title,Notes\r\nWH1000XM5,Sony,195,Wireless Noise Canceling Headphones,Active Brand Stock\r\nMTJV3AM/A,Apple,240,AirPods Pro 2,Available at brand DC\r\n4217709208,Kendra Scott,85,Designer Jewelry Item,Brand inventory update\r\nAF-200,Aura Frames,45,Carver HD Digital Frame,Showroom & warehouse allocation';
      downloadCsvFile('Brand-ATS-Template.csv', template);
      notice('Brand ATS CSV template downloaded.');
    };

    // Load sample feed
    document.querySelector('#ats-load-sample').onclick = () => {
      uploadedFileName = `${activeBrand}_Live_ATS_Feed.xlsx`;
      dropTitle.innerHTML = `Loaded Sample Feed: <b>${esc(uploadedFileName)}</b>`;
      const sampleRows = [
        { model: 'WH1000XM5', ats: 220, title: 'Wireless Noise Canceling Headphones', brand: 'Sony' },
        { model: 'MTJV3AM/A', ats: 265, title: 'AirPods Pro 2', brand: 'Apple' },
        { model: '4217709208', ats: 98, title: 'Designer Jewelry Item', brand: 'Kendra Scott' },
        { model: 'AF-200', ats: 52, title: 'Carver HD Digital Frame', brand: 'Aura Frames' },
        { model: 'HCFB1', ats: 180, title: 'Orchard Orange Cooler', brand: 'FieldBar' },
        { model: 'ATH-M50X-QA', ats: 28, title: 'Studio Monitor Reference', brand: 'Audio-Technica' }
      ];
      processAtsRows(sampleRows);
    };
  }

  // =========================================================================
  // PRICE UPDATE BY THE BRAND (EXCEL / CSV FILE)
  // By the brand to upload any price changes
  // =========================================================================
  function openPriceUpdateModal(defaultBrand = '') {
    const allRecords = getItemMasterRecords();
    const brands = getBrandList(allRecords).map(([b]) => b);
    const activeBrand = defaultBrand || (selectedBrand !== 'all' ? selectedBrand : brands[0] || 'Sony');

    let parsedRows = [];
    let uploadedFileName = '';

    const body = `
      <div class="im-form" id="im-price-update-form">
        <div class="im-banner-desc">
          <strong>Price Update by Brand:</strong> Upload brand price sheets (Excel .xlsx, .xls, or .csv) to synchronize Standard Catalog Price and Unit Cost across product lines.
        </div>

        <div class="im-form-row">
          <label class="im-form-field">
            <span>Brand Partner *</span>
            <select id="price-upload-brand" class="im-select">
              ${brands.map(b => `<option value="${esc(b)}" ${b.toLowerCase() === activeBrand.toLowerCase() ? 'selected' : ''}>${esc(b)}</option>`).join('')}
              <option value="__ALL__">All Brands (Multi-brand price sheet)</option>
            </select>
          </label>
        </div>

        <!-- File Dropzone -->
        <div class="im-upload-zone" id="price-dropzone">
          <input type="file" id="price-file-input" accept=".xlsx,.xls,.csv,.tsv" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <p id="price-drop-title">Drop Brand Price Sheet (.xlsx / .csv) Here or Browse</p>
          <small>Accepts .xlsx, .xls, .csv · Auto-maps Model#, New Price, and Wholesale Cost</small>
        </div>

        <div class="im-upload-templates">
          <button type="button" class="im-template-btn" id="price-download-template">📥 Download Price Sheet Template (.csv)</button>
          <button type="button" class="im-template-btn" id="price-load-sample">⚡ Load Sample Brand Price Sheet</button>
        </div>

        <!-- Live Parsed Preview Table -->
        <div id="price-preview-wrap" class="im-upload-preview" style="display:none">
          <table class="im-preview-table">
            <thead>
              <tr>
                <th>Model #</th>
                <th>Brand</th>
                <th style="text-align:right">Current Price</th>
                <th style="text-align:right">New Price</th>
                <th style="text-align:right">% Change</th>
                <th style="text-align:right">New Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="price-preview-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    window.StarkSystemUI.dialog('Price Update · Upload by Brand', body, () => {
      if (!parsedRows.length) {
        notice('Please upload or load a Brand Price sheet first.', true);
        return false;
      }

      const brandSelect = document.querySelector('#price-upload-brand');
      const targetBrand = brandSelect.value;
      const uploadTimestamp = new Date().toISOString();

      let updatedCount = 0;

      S.transaction('BRAND_PRICES_UPDATED', `${targetBrand}: ${parsedRows.length} price changes`, s => {
        const inv = s.enterprise.inventory;

        parsedRows.forEach(row => {
          const m = String(row.model || '').trim();
          if (!m) return;
          const newPrice = Number(row.price);
          const newCost = Number(row.cost);

          const existing = inv.find(i => (i.model && i.model.toLowerCase() === m.toLowerCase()) || i.sku.toLowerCase() === m.toLowerCase());
          if (existing) {
            if (Number.isFinite(newPrice) && newPrice > 0) existing.standardPrice = newPrice;
            if (Number.isFinite(newCost) && newCost > 0) existing.cost = newCost;
            existing.updatedAt = uploadTimestamp;
            updatedCount++;
          }
        });
      });

      notice(`Brand Price Update applied: ${updatedCount} catalog items updated.`);
      render();
      return true;
    }, 'Apply Price Changes', { system: true });

    const dropzone = document.querySelector('#price-dropzone');
    const fileInput = document.querySelector('#price-file-input');
    const dropTitle = document.querySelector('#price-drop-title');
    const previewWrap = document.querySelector('#price-preview-wrap');
    const previewTbody = document.querySelector('#price-preview-tbody');

    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();
      dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('dragover'); };
      dropzone.ondragleave = () => dropzone.classList.remove('dragover');
      dropzone.ondrop = e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = e => {
        if (e.target.files.length) handleFile(e.target.files[0]);
      };
    }

    async function handleFile(file) {
      uploadedFileName = file.name;
      dropTitle.innerHTML = `Price File Loaded: <b>${esc(file.name)}</b> (${(file.size / 1024).toFixed(1)} KB)`;
      try {
        const rawRows = await parseSpreadsheet(file);
        processPriceRows(rawRows);
      } catch (err) {
        notice(err.message, true);
      }
    }

    function processPriceRows(rows) {
      const all = getItemMasterRecords();
      const brandVal = document.querySelector('#price-upload-brand').value;

      parsedRows = rows.map(r => {
        const model = r.model || r.modelnumber || r.sku || r.item || r.itemcode || r.part || '';
        const price = r.price || r.newprice || r.standardprice || r.msrp || r.retail || r.unitprice || r.listprice || 0;
        const cost = r.cost || r.unitcost || r.wholesale || r.dealerprice || 0;
        const brand = r.brand || brandVal;

        return {
          model: String(model).trim(),
          price: Number(price) || 0,
          cost: Number(cost) || 0,
          brand: String(brand).trim()
        };
      }).filter(r => r.model && r.price > 0);

      if (!parsedRows.length) {
        notice('No valid Model# or Price columns detected in file.', true);
        return;
      }

      previewWrap.style.display = '';
      previewTbody.innerHTML = parsedRows.slice(0, 50).map(row => {
        const existing = all.find(i => i.model.toLowerCase() === row.model.toLowerCase() || i.sku.toLowerCase() === row.model.toLowerCase());
        const currentPrice = existing ? existing.standardPrice : 0;
        const pct = currentPrice > 0 ? (((row.price - currentPrice) / currentPrice) * 100).toFixed(1) : '0.0';
        const pctClass = Number(pct) > 0 ? 'im-delta-pos' : Number(pct) < 0 ? 'im-delta-neg' : 'im-delta-zero';
        const pctText = Number(pct) > 0 ? `+${pct}%` : `${pct}%`;

        return `
          <tr>
            <td><strong>${esc(row.model)}</strong></td>
            <td>${esc(row.brand || brandVal)}</td>
            <td style="text-align:right">${money(currentPrice)}</td>
            <td style="text-align:right"><strong>${money(row.price)}</strong></td>
            <td style="text-align:right" class="${pctClass}">${pctText}</td>
            <td style="text-align:right">${row.cost > 0 ? money(row.cost) : '—'}</td>
            <td>${existing ? '<span class="sys-badge green">Price Update</span>' : '<span class="sys-badge red">SKU Not Found</span>'}</td>
          </tr>
        `;
      }).join('');

      notice(`Parsed ${parsedRows.length} price update records from file.`);
    }

    // Template download
    document.querySelector('#price-download-template').onclick = () => {
      const template = 'Model#,Brand,New_Standard_Price,Unit_Cost,Effective_Date\r\nWH1000XM5,Sony,359.00,285.00,2026-11-01\r\nMTJV3AM/A,Apple,249.00,185.00,2026-11-01\r\n4217709208,Kendra Scott,115.00,64.00,2026-11-01\r\nAF-200,Aura Frames,159.00,130.00,2026-11-01';
      downloadCsvFile('Brand-Price-Update-Template.csv', template);
      notice('Price Sheet CSV template downloaded.');
    };

    // Load sample price sheet
    document.querySelector('#price-load-sample').onclick = () => {
      uploadedFileName = `${activeBrand}_Price_Revision_Q4.xlsx`;
      dropTitle.innerHTML = `Loaded Sample Sheet: <b>${esc(uploadedFileName)}</b>`;
      const sampleRows = [
        { model: 'WH1000XM5', price: 359.00, cost: 282.00, brand: 'Sony' },
        { model: 'MTJV3AM/A', price: 239.00, cost: 180.00, brand: 'Apple' },
        { model: '4217709208', price: 115.00, cost: 65.00, brand: 'Kendra Scott' },
        { model: 'AF-200', price: 155.00, cost: 128.00, brand: 'Aura Frames' },
        { model: 'HCFB1', price: 229.00, cost: 145.00, brand: 'FieldBar' },
        { model: 'ATH-M50X-QA', price: 175.00, cost: 120.00, brand: 'Audio-Technica' }
      ];
      processPriceRows(sampleRows);
    };
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

    downloadCsvFile(`Item-Master-Catalog-${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
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

    // Counts for toolbar status chips
    const liveCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'live').length;
    const fashionCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'fashion').length;
    const internalCount = allRecords.filter(i => ['internal use', 'internal_use', 'internal'].includes((i.status || '').toLowerCase())).length;
    const presentationCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'presentation').length;

    let html = `
      <!-- Page Header with ATS Upload & Price Update Actions -->
      <div class="im-header">
        <div class="im-header-title-block">
          <div class="system-eyebrow">Master Item Catalog &amp; Control Tower</div>
          <h1 class="im-page-title">Enterprise Item Master</h1>
          <p class="im-page-subtitle">Central item catalog repository with Available-to-Sell (ATS) brand feeds, real-time multi-warehouse inventory breakdown, and brand price sheets.</p>
        </div>
        <div class="im-header-actions">
          <button class="sys-btn" id="im-btn-ats-upload" type="button" title="ATS is availability at the brand. Upload brand Excel file.">
            <svg class="im-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            ATS Upload (Brand)
          </button>
          <button class="sys-btn" id="im-btn-price-update" type="button" title="Upload brand price changes">
            <svg class="im-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Price Update (Brand)
          </button>
          <button class="sys-btn" id="im-btn-export" type="button" title="Export Master Catalog CSV">
            <svg class="im-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <button class="sys-btn primary" id="im-btn-add" type="button">
            <svg class="im-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add New Item
          </button>
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

    // ATS Upload button (Brand file)
    const atsUploadBtn = document.querySelector('#im-btn-ats-upload');
    if (atsUploadBtn) atsUploadBtn.onclick = () => openAtsUploadModal(selectedBrand !== 'all' ? selectedBrand : '');

    // Price Update button (By brand)
    const priceUpdateBtn = document.querySelector('#im-btn-price-update');
    if (priceUpdateBtn) priceUpdateBtn.onclick = () => openPriceUpdateModal(selectedBrand !== 'all' ? selectedBrand : '');

    // Export CSV button
    const exportBtn = document.querySelector('#im-btn-export');
    if (exportBtn) exportBtn.onclick = () => exportCSV(filtered);
  }

  // Initialization & URL action trigger
  document.addEventListener('DOMContentLoaded', () => {
    render();

    const action = params.get('action');
    if (action === 'new') {
      setTimeout(openAddItemModal, 300);
    } else if (action === 'ats-upload') {
      setTimeout(() => openAtsUploadModal(params.get('brand') || ''), 300);
    } else if (action === 'price-update') {
      setTimeout(() => openPriceUpdateModal(params.get('brand') || ''), 300);
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
    openAtsUploadModal,
    openPriceUpdateModal,
    exportCSV
  };
})();
