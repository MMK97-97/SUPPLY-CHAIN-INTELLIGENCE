import {LIMITS, clean, parseRecords, safeName} from './core.mjs';

const base = import.meta.url;
export const asset = file => new URL(file, base).href;
const loaded = new Map();
export async function loadScript(url, name) {
  if (globalThis[name]) return globalThis[name];
  if (!loaded.has(url)) loaded.set(url, new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=url;
    script.onload=()=>globalThis[name] ? resolve(globalThis[name]) : reject(new Error('A document tool did not initialize.'));
    script.onerror=()=>reject(new Error('A local document tool could not load. Reload the page and try again.'));
    document.head.append(script);
  }).catch(e=>{loaded.delete(url);throw e;}));
  return loaded.get(url);
}
export const zipTool = () => loadScript(asset('../../assets/jszip.min.js'),'JSZip');
const sheets = () => loadScript(asset('../../assets/vendor/sheetjs-0.20.3.min.js'),'XLSX');
export const extension = name => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() || '';
const imageExts = ['png','jpg','jpeg','webp'];
const sourceExts = ['pdf','xlsx','xls','csv','tsv','txt','docx',...imageExts];
const mime = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',csv:'text/csv',tsv:'text/tab-separated-values',txt:'text/plain'};
export const imageFile = file => imageExts.includes(extension(file.name));
export function checkFile(file, type) {
  const ext=extension(file.name);
  const allowed=type==='source'?sourceExts:type==='delivery'?['pdf',...imageExts]:imageExts;
  if (!allowed.includes(ext)) throw new Error('Unsupported file type: '+safeName(file.name)+'.');
  if (file.size < 1 || file.size > LIMITS.file) throw new Error('Files must be nonempty and at most 20 MB: '+safeName(file.name)+'.');
  return file;
}

// Inspect declared archive sizes before asking a ZIP reader to decompress anything.
export function checkArchive(bytes, max = 96 * 1024 ** 2, count = 1200) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 22) throw new Error('Invalid ZIP-based document.');
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;
  for(let i=d.byteLength-22;i>=Math.max(0,d.byteLength-65557);i--) {
    if(d.getUint32(i,true)===0x06054b50&&i+22+d.getUint16(i+20,true)===d.byteLength){end=i;break;}
  }
  if(end<0||d.getUint16(end+4,true)||d.getUint16(end+6,true))throw new Error('Unsupported ZIP-based document.');
  const entries=d.getUint16(end+10,true),start=d.getUint32(end+16,true),size=d.getUint32(end+12,true);
  if(entries>count||entries!==d.getUint16(end+8,true)||start+size>end)throw new Error('The archive exceeds the supported size.');
  let p=start,sum=0;
  const sizes=new Map();
  for(let i=0;i<entries;i++){
    if(p+46>end||d.getUint32(p,true)!==0x02014b50||d.getUint16(p+8,true)&1)throw new Error('Invalid or encrypted archive.');
    const length=d.getUint16(p+28,true), extra=d.getUint16(p+30,true),comment=d.getUint16(p+32,true),raw=d.getUint32(p+24,true);
    const next=p+46+length+extra+comment;
    if(next>start+size)throw new Error('Invalid archive entry.');
    const name=new TextDecoder().decode(bytes.subarray(p+46,p+46+length));
    if(sizes.has(name)||name.includes('\\')||name.startsWith('/')||name.split('/').includes('..'))throw new Error('Invalid archive path.');
    sum+=raw;
    if(sum>max)throw new Error('The expanded archive is too large.');
    sizes.set(name,raw);
    p=next;
  }
  if(p!==start+size)throw new Error('Invalid archive directory.');
  return sizes;
}
async function readDocx(file) {
  const bytes=new Uint8Array(await file.arrayBuffer()),sizes=checkArchive(bytes,48*1024**2);
  if(!sizes.has('word/document.xml')||sizes.get('word/document.xml')>6*1024**2)throw new Error('No supported Word document body was found.');
  const JSZip=await zipTool();
  const z=await JSZip.loadAsync(bytes),xml=await z.file('word/document.xml').async('text');
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('This Word document contains unsupported XML.');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('The Word document body could not be read.');
  const body=doc.getElementsByTagNameNS('*','body')[0];
  const content=node=>Array.from(node.getElementsByTagNameNS('*','t')).map(x=>x.textContent).join('');
  const tableCell=node=>Array.from(node.getElementsByTagNameNS('*','p')).map(content).join(' ');
  const records=[];
  for(const child of body?.children||[]){
    if(child.localName==='p') records.push(content(child).split(/\t| {2,}/));
    if(child.localName==='tbl'){
      for(const row of child.children)if(row.localName==='tr')records.push(Array.from(row.children).filter(c=>c.localName==='tc').map(tableCell));
    }
  }
  return records;
}
async function readSpreadsheet(file, ext) {
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(ext==='xlsx')checkArchive(bytes,64*1024**2);
  const XLSX=await sheets();
  const workbook=XLSX.read(bytes,{type:'array',sheetRows:12001,cellFormula:false,cellHTML:false,bookVBA:false,cellDates:false,raw:ext==='csv'||ext==='tsv'});
  if(workbook.SheetNames.length>30)throw new Error('Too many worksheets. Upload only the pages for this shipment.');
  const records=[];
  for(const [index,sheet] of workbook.SheetNames.entries()){
    const ws=workbook.Sheets[sheet];
    if(!ws?.['!ref'])continue;
    const range=XLSX.utils.decode_range(ws['!ref']);
    if(range.e.c-range.s.c>100||range.e.r-range.s.r>=12000)throw new Error('The worksheet is too large. Upload only the shipment table.');
    for(const row of XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',blankrows:false}))records.push({page:index,cells:row.map(text=>({text:clean(text,400)}))});
    if(records.length>12000)throw new Error('The workbook has too many rows.');
  }
  return records;
}
export function boxRecords(boxes, page = 0) {
  // Keep text positions so a missing description cannot shift the quantity column,
  // and copy before sorting so caller arrays stay intact.
  const groups = [];
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const b of sorted) {
    const tolerance = Math.max(2, Math.min(12, (b.h || 10) * 0.46));
    let group = groups.at(-1);
    if (!group || Math.abs(group.y - b.y) > tolerance) {
      group = { y: b.y, items: [] };
      groups.push(group);
    }
    group.items.push(b);
  }
  return groups.map(g => {
    const cells = [];
    let right = -Infinity;
    for (const b of g.items.sort((a, b) => a.x - b.x)) {
      const text = clean(b.text, 400);
      if (!text) continue;
      const previous = cells.at(-1);
      if (previous && b.x - right < Math.max(5, Math.min(16, (b.h || 10) * 0.92))) previous.text += ' ' + text;
      else cells.push({ text, x: b.x });
      right = Math.max(right, b.x + b.w);
    }
    return { page, cells };
  }).filter(r => r.cells.length);
}
let pdfModule;
async function getPdf(bytes) {
  pdfModule ||= import(asset('vendor/pdf.min.mjs'));
  const pdf=await pdfModule;
  pdf.GlobalWorkerOptions.workerSrc=asset('vendor/pdf.worker.min.mjs');
  return pdf.getDocument({data:bytes,isEvalSupported:false,disableFontFace:true,useSystemFonts:true,cMapUrl:asset('vendor/cmaps/'),cMapPacked:true,standardFontDataUrl:asset('vendor/standard_fonts/'),maxImageSize:24e6,verbosity:0}).promise;
}
const previewCache = new WeakMap();
async function buildPreview(file, max) {
  const canvas = document.createElement('canvas');
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 45e6) throw new Error('This photo is too large. Resize it and try again.');
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('The photo could not be prepared.');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height, blob };
  } finally {
    image.close();
    canvas.width = canvas.height = 0;
  }
}
export function makePreview(file, max = 1450) {
  if (!file || typeof file !== 'object') return buildPreview(file, max);
  let bySize = previewCache.get(file);
  if (!bySize) {
    bySize = new Map();
    previewCache.set(file, bySize);
  }
  if (!bySize.has(max)) {
    const pending = buildPreview(file, max).catch(err => {
      bySize.delete(max);
      throw err;
    });
    bySize.set(max, pending);
  }
  return bySize.get(max);
}
export async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
function tsvBoxes(tsv) {
  const out=[];
  for(const line of (tsv||'').split('\n')){
    const c=line.split('\t');
    if(c[0]!=='5'||!clean(c[11]))continue;
    const [x,y,w,h]=c.slice(6,10).map(Number);
    if([x,y,w,h].every(Number.isFinite))out.push({x,y,w,h,text:c.slice(11).join(' ')});
  }
  return out;
}
let ocrWorker, ocrStarting, progressListener, ocrIdleTimer;
function scheduleOcrIdleCleanup() {
  clearTimeout(ocrIdleTimer);
  ocrIdleTimer = setTimeout(() => { finishOCR().catch(() => {}); }, 20000);
}
async function runOCR(image, page, progress) {
  clearTimeout(ocrIdleTimer);
  progressListener = progress;
  if (!ocrWorker && !ocrStarting) {
    ocrStarting = (async () => {
      const t = await loadScript(asset('vendor/tesseract.min.js'), 'Tesseract');
      return t.createWorker('eng', 1, {
        workerPath: asset('vendor/tesseract-worker.min.js'),
        corePath: asset('vendor/tesseract-core-lstm.wasm.js'),
        langPath: asset('vendor/').slice(0, -1),
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: m => {
          if (m.status === 'recognizing text') {
            progressListener?.('Reading scanned text… ' + Math.round((m.progress || 0) * 100) + '%');
          }
        }
      });
    })();
    try { ocrWorker = await ocrStarting; } finally { ocrStarting = null; }
  } else if (!ocrWorker) {
    ocrWorker = await ocrStarting;
  }
  await ocrWorker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
  const result = await ocrWorker.recognize(image, {}, { text: true, tsv: true });
  scheduleOcrIdleCleanup();
  const boxes = tsvBoxes(result.data.tsv);
  return boxes.length
    ? boxRecords(boxes, page)
    : String(result.data.text || '').split('\n').map(line => ({ page, cells: line.split(/\t| {2,}/).map(text => ({ text })) }));
}
export async function finishOCR() {
  clearTimeout(ocrIdleTimer);
  ocrIdleTimer = null;
  if (ocrWorker) {
    const worker = ocrWorker;
    ocrWorker = null;
    await worker.terminate();
  }
  progressListener = null;
}
async function extractPDF(file, kind, progress, forceOcr = false) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await getPdf(bytes);
  try {
    if (doc.numPages > LIMITS.pages) throw new Error('The PDF has more than 80 pages. Upload only the shipment pages.');
    const records = [], warnings = [];
    let ocrPages = 0;
    const pageNumbers = Array.from({ length: doc.numPages }, (_, i) => i + 1);
    const pageRecords = new Array(doc.numPages);
    const sparsePages = [];
    if (!forceOcr) {
      let readDone = 0;
      await mapPool(pageNumbers, 4, async n => {
        const page = await doc.getPage(n);
        try {
          const content = await page.getTextContent();
          const boxes = content.items
            .filter(i => i.str?.trim())
            .map(i => ({ text: i.str, x: i.transform[4], y: -i.transform[5], w: i.width || 0, h: i.height || 8 }));
          if (boxes.map(b => b.text).join('').trim().length >= 24) {
            pageRecords[n - 1] = boxRecords(boxes, n);
          } else {
            sparsePages.push(n);
          }
          readDone++;
          progress?.('Reading PDF text… ' + readDone + ' of ' + doc.numPages);
        } finally {
          page.cleanup();
        }
      });
      sparsePages.sort((a, b) => a - b);
    } else {
      sparsePages.push(...pageNumbers);
    }
    for (const n of sparsePages) {
      if (ocrPages >= LIMITS.ocrPages) throw new Error('This scan has more than 18 pages that need OCR. Split the file and try again.');
      progress?.('OCR scanning PDF page ' + n + ' of ' + doc.numPages + '…');
      const page = await doc.getPage(n);
      const canvas = document.createElement('canvas');
      try {
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(3, 2350 / Math.max(original.width, original.height)) });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport }).promise;
        ocrPages++;
        pageRecords[n - 1] = await runOCR(canvas, n, progress);
      } finally {
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    }
    for (const pr of pageRecords) {
      if (pr?.length) records.push(...pr);
    }
    if(ocrPages)warnings.push('OCR was used on '+ocrPages+' page'+(ocrPages===1?'':'s')+'. Check all model numbers and quantities.');
    const result=parseRecords(records,kind,{mode:ocrPages?'PDF + OCR':'PDF text'});
    return {...result,warnings:[...warnings,...result.warnings]};
  }finally{await doc.destroy();}
}
export async function extract(file, kind, progress, forceOcr=false) {
  checkFile(file,'source');
  const ext=extension(file.name);
  if(ext==='pdf')return extractPDF(file,kind,progress,forceOcr);
  if(ext==='docx')return parseRecords(await readDocx(file),kind,{mode:'Word'});
  if(['xlsx','xls','csv','tsv'].includes(ext))return parseRecords(await readSpreadsheet(file,ext),kind,{resetColumns:true,mode:'Spreadsheet'});
  if(ext==='txt')return parseRecords((await file.text()).split(/\r?\n/).map(s=>s.split(/\t| {2,}/)),kind,{mode:'Text'});
  const preview=await makePreview(file,2350);
  const result=parseRecords(await runOCR(preview.blob,1,progress),kind,{mode:'Image OCR'});
  return {...result,warnings:['Check all model numbers and quantities read from the photo.',...result.warnings]};
}
export function fileFromArchive(bytes, name) {
  return new File([bytes],safeName(name),{type:mime[extension(name)]||'application/octet-stream'});
}
