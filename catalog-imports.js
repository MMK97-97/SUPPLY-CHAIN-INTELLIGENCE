(function () {
  'use strict';
  if (window.StarkCatalogImports || !window.StarkSystem) return;
  const S = window.StarkSystem;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value ?? '').trim().toUpperCase();
  const modelKey = value => norm(value).replace(/[-\s]/g, '');
  const column = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fields = ['brandATS','availableQty','totalATS','atsUpdatedAt','atsSourceFile','priceNet','standardPrice','currency','priceUpdatedAt','priceSourceFile'];
  const catalog = () => window.ItemMasterEnterprise?.getCatalog() || [];
  const currency = region => ({US:'USD',EU:'EUR',CA:'CAD'}[region] || 'USD');
  let activeDialog = null;

  function overlay(records) {
    const region = S.getRegion(), updates = S.getState().enterprise.catalogUpdates || [];
    return records.map(item => {
      const candidates = updates.filter(u => u.region === region && norm(u.brand) === norm(item.brand));
      const update = candidates.find(u => norm(u.sku) === norm(item.sku || item.model)) || candidates.find(u => u.upc && norm(u.upc) === norm(item.upc) && modelKey(u.model) === modelKey(item.model));
      return update ? {...item, ...Object.fromEntries(fields.filter(key => Object.hasOwn(update.patch || {}, key)).map(key => [key, update.patch[key]]))} : item;
    });
  }
  function amount(value, integer = false) {
    let text = String(value ?? '').trim().replace(/^[\$€£]\s*/, '');
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '');
    else if (/^\d+,\d{1,2}$/.test(text)) text = text.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Use a non-negative number.');
    const valueNumber = Number(text);
    if (!Number.isFinite(valueNumber) || (integer && !Number.isSafeInteger(valueNumber))) throw new Error(integer ? 'ATS must be a whole number.' : 'Invalid price.');
    return valueNumber;
  }
  const aliases = {
    sku:['sku','itemsku','itemnumber'], model:['model','modelnumber','manufacturermodelnumber','manufacturermodel','mfrmodel'],
    upc:['upc','upccode','barcode'], brand:['brand','manufacturer'], ats:['ats','availabletosell','availableqty','availablequantity','stockavailable','quantity','qty'],
    net:['netprice','pricenet','net','price','unitprice','sellingprice'], retail:['retailprice','retail','msrp','standardprice'], currency:['currency','currencycode']
  };
  function prepare(action, rows, brand, fileName) {
    if (!['ats-upload','price-update'].includes(action)) throw new Error('Choose ATS upload or price update.');
    if (!brand) throw new Error('Select a brand.');
    if (!Array.isArray(rows) || !rows.length) throw new Error('The file has no data rows.');
    if (rows.length > 10000) throw new Error('Upload up to 10,000 rows at a time.');
    const source = catalog(), state = S.getState(), region = S.getRegion();
    const selected = source.filter(item => norm(item.brand) === norm(brand));
    if (!selected.length) throw new Error('The selected brand has no catalog items.');
    const headers = new Map();
    for (const key of Object.keys(rows[0])) {
      if (headers.has(column(key))) throw new Error('The file has duplicate column names.');
      headers.set(column(key), key);
    }
    const keys = Object.fromEntries(Object.entries(aliases).map(([name, names]) => [name, names.map(n => headers.get(n)).find(Boolean)]));
    if (!keys.sku && !keys.model && !keys.upc) throw new Error('Include a SKU, Model #, or UPC column.');
    if (action === 'ats-upload' && !keys.ats) throw new Error('Include an ATS or Available Qty column.');
    if (action === 'price-update' && !keys.net && !keys.retail) throw new Error('Include Net Price and/or Retail Price columns.');
    const seen = new Set(), entries = [], errors = [], preview = [];
    const indices = Object.fromEntries(['sku','model','upc'].map(name => [name, new Map()]));
    for (const item of selected) for (const name of ['sku','model','upc']) {
      const identity = (name === 'model' ? modelKey : norm)(item[name] || (name === 'sku' || name === 'model' ? item.model || item.sku : ''));
      if (!identity) continue;
      const matches = indices[name].get(identity) || []; matches.push(item); indices[name].set(identity, matches);
    }
    rows.forEach((row, index) => {
      const value = name => keys[name] ? String(row[keys[name]] ?? '').trim() : '';
      const identity = value('sku') || value('model') || value('upc');
      if (!Object.values(row).some(v => String(v ?? '').trim())) return;
      try {
        if (value('brand') && norm(value('brand')) !== norm(brand)) throw new Error('Brand differs from the selected brand.');
        if (!identity) throw new Error('Missing SKU, model or UPC.');
        const kind = value('sku') ? 'sku' : value('model') ? 'model' : 'upc';
        const matches = indices[kind].get((kind === 'model' ? modelKey : norm)(identity)) || [];
        if (matches.length !== 1) throw new Error(matches.length ? 'Identifier matches more than one item; use its SKU.' : 'Item not found in this brand.');
        const item = matches[0], sku = item.sku || item.model;
        if (value('model') && modelKey(value('model')) !== modelKey(item.model || item.sku)) throw new Error('Model does not match this SKU.');
        if (seen.has(norm(sku))) throw new Error('Duplicate item in this file.');
        seen.add(norm(sku));
        const expectedCurrency = item.currency || currency(region);
        if (action === 'price-update' && value('currency') && norm(value('currency')) !== norm(expectedCurrency)) throw new Error('Currency differs from this catalog region.');
        const patch = {};
        if (action === 'ats-upload') {
          patch.brandATS = patch.availableQty = patch.totalATS = amount(value('ats'), true);
        } else {
          if (value('net')) patch.priceNet = amount(value('net'));
          if (value('retail')) patch.standardPrice = amount(value('retail'));
          if (!Object.keys(patch).length) throw new Error('This row has no price to update.');
          patch.currency = norm(expectedCurrency);
        }
        const exact = state.enterprise.inventory.filter(i => norm(i.sku) === norm(sku) && S.regionCode(i.region) === region && norm(i.brand) === norm(brand));
        const linked = exact.length ? exact : state.enterprise.inventory.filter(i => modelKey(i.model) === modelKey(item.model || sku) && norm(i.brand) === norm(brand) && S.regionCode(i.region) === region);
        if (linked.length > 1) throw new Error('More than one operational SKU matches this model.');
        entries.push({sku, model:item.model || sku, upc:item.upc || '', brand:item.brand, patch, coreSku:linked[0]?.sku || ''});
        const changes = action === 'ats-upload' ? `ATS ${item.brandATS ?? item.availableQty ?? item.totalATS ?? 0} → ${patch.brandATS}` : [
          patch.priceNet !== undefined ? `Net ${item.priceNet ?? item.standardPrice ?? 0} → ${patch.priceNet}` : '',
          patch.standardPrice !== undefined ? `Retail ${item.standardPrice ?? item.priceNet ?? 0} → ${patch.standardPrice}` : ''
        ].filter(Boolean).join(' · ');
        preview.push({row:index + 2, identity, changes});
      } catch (error) { errors.push({row:index + 2, identity, message:error.message}); }
    });
    if (!entries.length && !errors.length) throw new Error('The file has no data rows.');
    return {action, brand, fileName:String(fileName || ''), region, revision:state.revision, catalogSnapshot:JSON.stringify(source), entries, errors, preview};
  }
  function commit(plan) {
    if (!plan || plan.errors.length || !plan.entries.length) throw new Error('Preview a valid file before saving.');
    if (S.getRegion() !== plan.region || JSON.stringify(catalog()) !== plan.catalogSnapshot) throw new Error('The catalog or region changed. Preview the file again.');
    const time = new Date().toISOString();
    S.transaction(plan.action === 'ats-upload' ? 'BRAND_ATS_IMPORTED' : 'BRAND_PRICES_IMPORTED', `${plan.brand}: ${plan.entries.length} items from ${plan.fileName}`, state => {
      if (state.revision !== plan.revision) throw new Error('The workspace changed after preview. Preview the file again.');
      const updates = state.enterprise.catalogUpdates ||= [];
      for (const entry of plan.entries) {
        let update = updates.find(u => u.region === plan.region && norm(u.sku) === norm(entry.sku) && norm(u.brand) === norm(entry.brand));
        if (!update) { update = {sku:entry.sku, model:entry.model, upc:entry.upc, brand:entry.brand, region:plan.region, patch:{}}; updates.push(update); }
        const metadata = plan.action === 'ats-upload' ? {atsUpdatedAt:time, atsSourceFile:plan.fileName} : {priceUpdatedAt:time, priceSourceFile:plan.fileName};
        Object.assign(update.patch, entry.patch, metadata);
        if (entry.coreSku) {
          const item = state.enterprise.inventory.find(i => i.sku === entry.coreSku);
          if (!item) throw new Error('A linked item changed. Preview the file again.');
          if (plan.action === 'ats-upload') Object.assign(item, {brandATS:entry.patch.brandATS, brandATSUpdatedAt:time, brandATSFile:plan.fileName});
          else {
            if (entry.patch.priceNet !== undefined) item.priceNet = item.standardPrice = entry.patch.priceNet;
            if (entry.patch.standardPrice !== undefined) item.retailPrice = entry.patch.standardPrice;
          }
          item.updatedAt = time;
        }
      }
    });
    window.ItemMasterEnterprise?.render();
    window.StarkSystemUI?.notice(`${plan.action === 'ats-upload' ? 'ATS' : 'Prices'} updated for ${plan.entries.length} ${plan.brand} items.`);
    return plan.entries.length;
  }
  async function readFile(file) {
    if (!file) throw new Error('Choose a CSV or Excel file.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.');
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error('Choose a CSV, XLSX or XLS file.');
    if (!window.XLSX) throw new Error('The file reader has not loaded. Reload the page and try again.');
    const bytes = file.arrayBuffer ? await file.arrayBuffer() : await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('The selected file could not be read.')); reader.readAsArrayBuffer(file);
    });
    const workbook = window.XLSX.read(bytes, {type:'array'});
    for (const name of workbook.SheetNames) {
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[name], {defval:'', raw:false});
      if (rows.length) return rows;
    }
    throw new Error('The file has no data rows.');
  }
  function template(action, brand) {
    const item = catalog().find(i => norm(i.brand) === norm(brand));
    if (!item) throw new Error('Select a brand first.');
    const rows = action === 'ats-upload' ? [['Brand','Model #','ATS'],[brand,item.model || item.sku,item.brandATS ?? item.availableQty ?? 0]] :
      [['Brand','Model #','Net Price','Retail Price','Currency'],[brand,item.model || item.sku,item.priceNet ?? item.standardPrice ?? 0,item.standardPrice ?? item.priceNet ?? 0,item.currency || currency(S.getRegion())]];
    const safe = value => { let text = String(value ?? ''); if (/^[=+@\t\r-]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(safe).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${action}-${brand.replace(/[^a-z0-9_-]/gi,'-')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function open(action) {
    if (!['ats-upload','price-update'].includes(action) || !window.ItemMasterEnterprise) return;
    activeDialog?.querySelector('[data-close]')?.click();
    const brands = [...new Set(catalog().map(i => i.brand).filter(Boolean))].sort();
    let plan = null, request = 0;
    const isATS = action === 'ats-upload';
    const dialog = window.StarkSystemUI.dialog(isATS ? 'ATS upload (Brand)' : 'Price update (Brand)', `
      <p>${isATS ? 'Import a brand availability feed. Warehouse balances continue to follow receiving and dispatch.' : 'Update net and retail prices for existing items. Each price column is optional when the other is supplied. Customer notices are queued after organization synchronization; CRM shows delivery status.'}</p>
      <p><strong>Region: ${esc(S.getRegion())}</strong> · CSV / XLSX / XLS · Maximum 10 MB</p>
      <div class="form-grid"><label>Brand<select id="catalog-import-brand" required><option value="">Select brand</option>${brands.map(brand => `<option>${esc(brand)}</option>`).join('')}</select></label>
      <label>File<input id="catalog-import-file" type="file" accept=".csv,.xlsx,.xls" required></label></div>
      <p>${isATS ? 'Required columns: SKU, Model # or UPC; ATS or Available Qty.' : 'Required columns: SKU, Model # or UPC; Net Price and/or Retail Price. Currency is optional.'}</p>
      <div class="system-actions"><button type="button" class="sys-btn" id="catalog-import-template">Download template</button><button type="button" class="sys-btn primary" id="catalog-import-preview">Preview file</button></div>
      <div id="catalog-import-result" role="status" aria-live="polite" style="margin-top:16px"></div>`, () => commit(plan), isATS ? 'Apply ATS' : 'Apply prices', {system:true});
    activeDialog = dialog;
    dialog.querySelector('.sys-modal').style.width = 'min(900px, 100%)';
    const save = dialog.querySelector('[data-save]'), preview = dialog.querySelector('#catalog-import-preview');
    const brand = dialog.querySelector('#catalog-import-brand'), file = dialog.querySelector('#catalog-import-file'), result = dialog.querySelector('#catalog-import-result');
    save.disabled = true;
    const reset = () => { request++; plan = null; save.disabled = true; result.textContent = ''; preview.disabled = false; };
    brand.addEventListener('change', reset); file.addEventListener('change', reset);
    dialog.querySelector('#catalog-import-template').onclick = () => {
      try { template(action, brand.value); } catch (error) { result.textContent = error.message; }
    };
    preview.onclick = async () => {
      const currentRequest = ++request;
      plan = null; save.disabled = true; preview.disabled = true; result.textContent = 'Reading file…';
      try {
        if (!brand.value) throw new Error('Select a brand.');
        const selectedFile = file.files[0], rows = await readFile(selectedFile);
        if (!dialog.isConnected || currentRequest !== request) return;
        plan = prepare(action, rows, brand.value, selectedFile.name);
        result.innerHTML = `<p><strong>${plan.entries.length} matched items</strong> · ${plan.errors.length} errors${plan.errors.length ? ' — correct the file before applying.' : ' — ready to apply.'}</p>
          <div style="max-height:280px;overflow:auto"><table class="sys-table"><thead><tr><th>Row</th><th>Item</th><th>Change / issue</th></tr></thead><tbody>${[...plan.errors.map(e => ({...e,changes:e.message})),...plan.preview].slice(0,100).map(row => `<tr><td>${row.row}</td><td>${esc(row.identity)}</td><td>${esc(row.changes)}</td></tr>`).join('')}</tbody></table></div>`;
        save.disabled = Boolean(plan.errors.length || !plan.entries.length);
      } catch (error) { if (currentRequest === request && dialog.isConnected) result.textContent = error.message || 'The file could not be read.'; }
      finally { if (currentRequest === request) preview.disabled = false; }
    };
    return dialog;
  }
  function requestedAction() { return new URLSearchParams(location.search).get('action'); }
  function initialize() {
    if (!document.querySelector('#item-master-content')) return;
    window.ItemMasterEnterprise?.render();
    open(requestedAction());
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]'); if (!link) return;
      const url = new URL(link.href, location.href), action = url.searchParams.get('action');
      if (url.origin !== location.origin || url.pathname !== new URL('item-master.html', S.rootURL).pathname || !['ats-upload','price-update'].includes(action)) return;
      event.preventDefault(); history.replaceState({}, '', url.href); open(action);
    });
  }
  window.StarkCatalogImports = {overlay, prepare, commit, readFile, open};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
