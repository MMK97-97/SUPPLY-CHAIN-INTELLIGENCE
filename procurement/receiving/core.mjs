/* Document and inspection rules, independent of browser APIs. */
export const LIMITS = Object.freeze({file: 20 * 1024 ** 2, total: 64 * 1024 ** 2, proofs: 12, photos: 8, lines: 250, pages: 80, ocrPages: 18});
export const clean = (value, limit = 160) => String(value ?? '').normalize('NFKC').replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const key = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
export const modelKey = value => clean(value, 100).toUpperCase();
export const short = (packed, received) => !Number.isFinite(packed) || !Number.isFinite(received) ? null : Math.max(0, packed - received);
export const over = (packed, received) => !Number.isFinite(packed) || !Number.isFinite(received) ? null : Math.max(0, received - packed);

export function quantity(value) {
  const str = clean(value, 64).replace(/\s+(?:EA|PCS?|UNITS?)$/i, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?$/.test(str)) return null;
  const n = Number(str.replaceAll(',', ''));
  return Number.isSafeInteger(n) && n <= 99999999 ? n : null;
}
export function validDate(value) {
  const s = clean(value, 30);
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) [y, m, d] = s.split('-').map(Number);
  else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) [m, d, y] = s.split('/').map(Number);
  else return '';
  if (y < 1900 || y > 2199 || !m || !d || m > 12 || d > 31) return '';
  const iso = [y, m, d].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-');
  const date = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === iso ? iso : '';
}

const aliases = {
  model: ['model', 'modelnumber', 'modelno', 'modelcode', 'modelid', 'sku', 'item', 'itemnumber', 'itemno', 'itemcode', 'part', 'partnumber', 'partno', 'productcode', 'vendoritem', 'vendoritemnumber', 'mfrpartnumber', 'manufacturerpartnumber', 'material', 'materialnumber', 'style', 'stylenumber'],
  ordered: ['actualorderedquantity', 'actualorderedqty', 'orderedquantity', 'qtyordered', 'orderedqty', 'quantityordered', 'orderqty', 'orderquantity', 'ordered', 'poqty', 'poquantity', 'quantityrequested'],
  packed: ['packingslipqty', 'packingslipquantity', 'packedqty', 'qtypacked', 'packedquantity', 'quantitypacked', 'packed', 'shippedqty', 'qtyshipped', 'shippedquantity', 'quantityshipped', 'shipped', 'units shipped', 'shipqty', 'shipquantity', 'dispatchqty', 'deliveredqty', 'qtydelivered'],
  generic: ['qty', 'quantity', 'units', 'qtyea', 'qtyeach', 'quantityea', 'qtyorderedunits', 'quantityunits']
};
function headerScore(text, group) {
  const k = key(text);
  return aliases[group].some(v => key(v) === k) ? (group === 'generic' ? 1 : 3) : 0;
}
const toCells = record => Array.isArray(record) ? record.map(text => ({text:clean(text, 400)})) : record.cells || [];
function columns(cells, kind) {
  const target = kind === 'po' ? 'ordered' : 'packed';
  const model = cells.map((c, index) => ({index, score:headerScore(c.text, 'model') + (/^(?:model|sku|part)/i.test(c.text) ? 1 : 0)})).filter((c,i) => headerScore(cells[i].text,'model')).sort((a,b)=>b.score-a.score);
  const qty = cells.map((c, index) => ({index, score:headerScore(c.text, target) || headerScore(c.text, 'generic')})).filter(c=>c.score).sort((a,b)=>b.score-a.score);
  if (!model.length || !qty.length || model[0].index === qty[0].index) return null;
  if ((model[1]?.score === model[0].score) || (qty[1]?.score === qty[0].score)) return {ambiguous:true};
  return {model:model[0].index, qty:qty[0].index, cells};
}
const labelRules = {
  po: /^(?:(?:vendor|supplier|customer)\s+)?(?:purchase\s+order|p\s*\/?\s*o)(?=\s|[:#-]|$)(?:\s*(?:number|no\.?|ref(?:erence)?|#))?\s*[:#-]?\s*/i,
  tracking: /^(?:(?:usps|ups|fedex|ltl)\s+)?(?:tracking|pro)(?=\s|[:#-]|$)(?:\s*(?:number|no\.?|id|#))?\s*[:#-]?\s*/i,
  expected: /^(?:expected\s+(?:delivery|arrival)(?:\s+date)?|delivery\s+eta|eta)\s*[:#-]?\s*/i,
  method: /^(?:shipping\s+method|ship\s+via|ship\s+method|carrier|service\s+level)\s*[:#-]?\s*/i
};
export const METHODS = Object.freeze({LTL:'LTL', FEDEX:'FedEx', UPS:'UPS', USPS:'USPS'});
export const trackingLabel = method => method==='LTL' ? 'PRO number' : Object.hasOwn(METHODS,method) ? 'Tracking number' : 'Tracking / PRO number';
function metadataValue(type, value) {
  const s = clean(value);
  if (type === 'expected') return validDate(s.match(/^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{4}/)?.[0]);
  if (type === 'method') {
    if (/\b(?:LTL|less.than.truckload)\b/i.test(s)) return 'LTL';
    if (/\bfed\s*ex\b/i.test(s)) return 'FEDEX';
    if (/\b(?:USPS|United States Postal Service)\b/i.test(s)) return 'USPS';
    if (/\bUPS\b/i.test(s)) return 'UPS';
    return '';
  }
  if (type === 'po') return /^[a-z\d][a-z\d._/#-]{0,79}$/i.test(s) && /\d/.test(s) ? s : '';
  return /^[\w][\w .\/-]{2,119}$/.test(s) && /\d/.test(s) ? s : '';
}
function readMetadata(cells, values) {
  for (let i=0; i<cells.length; i++) {
    const text = clean(cells[i].text, 400);
    for (const [type, re] of Object.entries(labelRules)) {
      const match = text.match(re);
      if (!match) continue;
      // A token with a label only uses the immediately following cell.
      const rest = text.slice(match[0].length).trim();
      const v = metadataValue(type, rest || cells[i+1]?.text);
      if (v) values[type].add(v);
    }
  }
}
function atColumn(cells, head, index) {
  const x = head.cells[index]?.x;
  if (!Number.isFinite(x) || !cells.some(c=>Number.isFinite(c.x))) return cells[index]?.text ?? '';
  const end = head.cells[index+1]?.x ?? Infinity;
  return cells.filter(c=>c.x >= x-8 && c.x < end-6).map(c=>c.text).join(' ');
}
const validModel = value => {
  const s = clean(value, 100);
  return /^[\p{L}\p{N}][\p{L}\p{N} ._:/#&+\-]{0,99}$/u.test(s) &&
    s.split(' ').length <= 8 && !/^(?:total|sub ?total|grand total|summary|tax|freight|shipping|notes?|page|amount due|signature|received by|prepared by|date|description|line items?)\b/i.test(s) &&
    !headerScore(s,'model');
};
export function parseRecords(records, kind, options = {}) {
  if (kind !== 'po' && kind !== 'slip') throw new Error('Unknown document type.');
  let header, page, skipped = 0, ambiguous = false, headers = 0;
  const values = {po:new Set(), method:new Set(), tracking:new Set(), expected:new Set()};
  const rows = new Map(), preview = [];
  for (const record of records.slice(0, 12000)) {
    const cells = toCells(record);
    if (!cells.length || !cells.some(c=>c.text)) continue;
    if (record.page !== undefined && page !== undefined && record.page !== page && options.resetColumns) header = null;
    page = record.page;
    if (preview.length < 170) preview.push(cells.map(c=>clean(c.text,200)).join('  |  '));
    const head = columns(cells, kind);
    if (head) {
      if (head.ambiguous) { ambiguous = true; header = null; }
      else {header=head; headers++;}
      continue;
    }
    const joined = cells.map(c=>c.text).join(' ');
    if (!header || /^(?:po\s*(?:#|number|no)|purchase order|shipping method|ship via|tracking|expected delivery|carrier|pro\s*#)/i.test(joined)) readMetadata(cells, values);
    if (/^\s*(?:sub ?total|grand total|total (?:ordered|packed|shipped|quantity|due)|amount due|end of order)\b/i.test(joined)) { header=null; continue; }
    if (!header) continue;
    const model = clean(atColumn(cells, header, header.model), 100);
    const qty = quantity(atColumn(cells, header, header.qty));
    if (!validModel(model)) { if (qty !== null && model) skipped++; continue; }
    if (qty === null) { skipped++; continue; }
    const id = modelKey(model);
    const prior = rows.get(id);
    if (prior) { prior.qty += qty; prior.occurrences++; }
    else rows.set(id, {model,qty,occurrences:1});
    if (rows.size > LIMITS.lines || rows.get(id).qty > 99999999) throw new Error('The file exceeds the supported line or quantity limit. Split it by shipment and try again.');
  }
  const meta = Object.fromEntries(Object.entries(values).map(([k,set])=>[k,[...set]]));
  const warnings = [];
  if (!headers) warnings.push('No recognizable model and quantity columns. Review the extracted text or enter lines manually.');
  else if (!rows.size) warnings.push('A table header was found, but no model quantities could be read.');
  if (ambiguous) warnings.push('An ambiguous table header was skipped.');
  if (skipped) warnings.push(skipped+' possible line'+(skipped===1?' was':'s were')+' skipped. Check the source for missing items.');
  if (Object.values(meta).some(items=>items.length>1)) warnings.push('Some shipment details have multiple values. Confirm them manually.');
  return {rows:[...rows.values()],meta,warnings,preview:preview.join('\n'),mode:options.mode || 'Text'};
}
export function mergeSources(po, slip) {
  const ref = [...(po?.meta.po || []), ...(slip?.meta.po || [])];
  const references = [...new Map(ref.map(v=>[modelKey(v),v])).values()];
  const lines = new Map();
  for (const [kind,doc] of [['ordered',po],['packed',slip]]) {
    for (const row of doc?.rows || []) {
      const id = modelKey(row.model);
      const line = lines.get(id) || {model:row.model,ordered:null,packed:null,received:null,damages:'',notes:''};
      line[kind]=row.qty;
      lines.set(id,line);
    }
  }
  if (lines.size > LIMITS.lines) throw new Error('This shipment exceeds the supported line limit.');
  const meta = {po:references.length===1 ? references[0] : ''};
  for (const k of ['method','tracking','expected']) {
    const values = [...new Set([...(po?.meta[k] || []),...(slip?.meta[k] || [])])];
    meta[k] = values.length===1 ? values[0] : '';
  }
  return {lines:[...lines.values()], meta, references, mismatch:references.length>1};
}
export function handoffIssues(snapshot) {
  const {info,lines,files} = snapshot;
  const issues = [];
  if (!clean(info.po)) issues.push('Enter the vendor PO number.');
  if (!Object.hasOwn(METHODS, info.method)) issues.push('Choose LTL, FedEx, UPS, or USPS.');
  if (!clean(info.tracking)) issues.push('Enter the '+trackingLabel(info.method).toLowerCase()+'.');
  if (!files.po||!files.slip) issues.push('Upload the vendor PO and packing slip.');
  if (!info.reviewed) issues.push('Confirm the PO references and quantities were reviewed.');
  if (!lines.length) issues.push('Add at least one line item.');
  const seen=new Set();
  lines.forEach((row,i)=>{
    const k=modelKey(row.model);
    if(!k||seen.has(k)||[row.ordered,row.packed].some(n=>quantity(n)===null))issues.push('Line '+(i+1)+': confirm a unique model and both source quantities.');
    seen.add(k);
  });
  return issues;
}
export function inspectionIssues(snapshot) {
  const {info,lines,files} = snapshot;
  const issues = [];
  if (!clean(info.po)) issues.push('Enter the vendor PO number.');
  if (!Object.hasOwn(METHODS, info.method)) issues.push('Choose LTL, FedEx, UPS, or USPS.');
  if (!clean(info.tracking)) issues.push('Enter the '+trackingLabel(info.method).toLowerCase()+'.');
  if (!clean(info.receiver)) issues.push('Enter who received the shipment.');
  if (!validDate(info.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(info.time)) issues.push('Enter the receiving date and time.');
  if (!files.delivery.length) issues.push('Upload a signed BOL or proof of delivery.');
  if (!['yes','no','na'].includes(info.truck)) issues.push('Confirm truck or trailer condition on arrival.');
  if (info.truck==='yes' && !files.truck?.length) issues.push('Attach proof of truck or trailer damage or tampering.');
  if (!['yes','no'].includes(info.pallet)) issues.push('Confirm pallet damage or tampering.');
  if (info.pallet==='yes' && !files.pallet.length) issues.push('Attach proof of pallet damage or tampering.');
  if (!info.reviewed) issues.push('Confirm the PO references and quantities were reviewed.');
  if (!lines.length) issues.push('Add at least one line item.');
  const ids = new Set();
  lines.forEach((line,index)=>{
    const label = 'Line '+(index+1);
    if (!line.model) issues.push(label+': enter a model number.');
    else if (ids.has(modelKey(line.model))) issues.push(label+': merge or correct the duplicate model number.');
    ids.add(modelKey(line.model));
    if ([line.ordered,line.packed,line.received].some(n=>quantity(n) === null)) issues.push(label+': confirm ordered, packing slip and received quantities.');
    if (!['yes','no'].includes(line.damages)) issues.push(label+': confirm whether it was damaged.');
    if (line.damages==='yes' && !line.photos.length) issues.push(label+': attach damage proof.');
  });
  return issues;
}
export const displayQty = value => value === null || value === undefined ? 'Not entered' : String(value);
export const yesNo = value => value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value === 'na' ? 'Not applicable' : 'Not entered';
export const safeName = name => clean(name, 160).replace(/[\/:*?"<>|\\]/g, '_').replace(/^[.\s]+|[.\s]+$/g,'') || 'attachment';
