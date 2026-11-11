import {LIMITS, METHODS, clean, handoffIssues, inspectionIssues, mergeSources, modelKey, over, quantity, safeName, short, trackingLabel, validDate} from './core.mjs';
import {checkArchive, checkFile, extract, fileFromArchive, finishOCR, imageFile, zipTool} from './io.mjs';
import {fileBase, listFiles, makePdf, makeWord, packet, prepare, prepareHandoff} from './export.mjs';

const root = document.querySelector('#receiving-inspection');
const form = root.querySelector('#rx-form');
const edit = root.querySelector('#rx-edit');
const $ = selector => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const infoFields = ['po','method','tracking','expected','receiver','date','time','zone','truck','pallet','arrival','reviewed'];
const title = {po:'Vendor PO',slip:'Packing slip',delivery:'Delivery proof',pallet:'Pallet photo',truck:'Truck photo'};
const infoLimit = k => ({tracking:150,zone:80,arrival:500})[k]||100;
const fileType = group => group==='po'||group==='slip'?'source':group==='delivery'?'delivery':'photo';
const photoAccept='.png,.jpg,.jpeg,.webp';
const makeFiles = () => ({po:null,slip:null,delivery:[],pallet:[],truck:[]});
let files = makeFiles(), lines = [], results = {}, autoInfo = {}, idCounter = 0, busy = false, lastExport = null, dirty = false;
const urls = new Map();
const timeNow=()=>{
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return {date:d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()),time:p(d.getHours())+':'+p(d.getMinutes()),zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Local device time'};
};
function msg(text='',error=false) {
  const el=$('#rx-message');el.hidden=!text;el.dataset.error=String(error);el.textContent=text;
}
function urlFor(file){
  if(!urls.has(file))urls.set(file,URL.createObjectURL(file));
  return urls.get(file);
}
function pruneURLs(){
  const active=new Set(listFiles(snapshot()).map(a=>a.file));
  for(const [file,url] of urls)if(!active.has(file)){URL.revokeObjectURL(url);urls.delete(file);}
}
function readInfo(){
  return Object.fromEntries(infoFields.map(k=>[k,k==='reviewed'?form.elements[k].checked:clean(form.elements[k].value,infoLimit(k))]));
}
function snapshot(){
  return {info:readInfo(),files:{...files,delivery:[...files.delivery],pallet:[...files.pallet],truck:[...files.truck]},lines:lines.map(line=>({...line,photos:[...line.photos]}))};
}
function lineFrom(raw={}){
  return {id:'line-'+(++idCounter),model:clean(raw.model,100),ordered:quantity(raw.ordered),packed:quantity(raw.packed),received:quantity(raw.received),damages:['yes','no'].includes(raw.damages)?raw.damages:'',notes:clean(raw.notes,500),origin:clean(raw.origin,60)||'Manual entry',photos:Array.isArray(raw.photos)?raw.photos:[]};
}
function applyInfo(info) {
  for(const k of infoFields) {
    const el=form.elements[k];
    if(k==='reviewed')el.checked=info[k]===true;
    else if(k==='method')el.value=Object.hasOwn(METHODS,info[k])?info[k]:'';
    else if(k==='pallet'||k==='truck')el.value=(k==='truck'?['yes','no','na']:['yes','no']).includes(info[k])?info[k]:'';
    else if(k==='date'||k==='expected')el.value=validDate(info[k]);
    else if(k==='time')el.value=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(info[k]||'')?info[k]:'';
    else el.value=clean(info[k],infoLimit(k));
  }
}
function preparationIssues(data) {
  const issues=handoffIssues(data);
  const references=new Set([...(results.po?.meta?.po||[]),...(results.slip?.meta?.po||[])].map(modelKey));
  if(references.size>1)issues.unshift('The uploaded documents refer to different POs. Upload documents for the same PO.');
  else if(references.size&&!references.has(modelKey(data.info.po)))issues.unshift('The entered PO number differs from the source documents.');
  return issues;
}
function updateSummary(){
  const shortages=lines.map(l=>short(l.packed,l.received)).filter(q=>q!==null);
  const shortageUnits=shortages.reduce((a,b)=>a+b,0);
  const counts=[[lines.length+' line'+(lines.length===1?'':'s'),''],[shortageUnits+' shortage unit'+(shortageUnits===1?'':'s')+' across '+shortages.length+' checked line'+(shortages.length===1?'':'s'),shortageUnits?'warn':''],[lines.filter(l=>l.damages==='yes').length+' damaged line'+(lines.filter(l=>l.damages==='yes').length===1?'':'s'),'']];
  $('#rx-metrics').innerHTML=counts.map(([name,tone])=>'<span class="rx-pill" data-tone="'+tone+'">'+esc(name)+'</span>').join('');
  const data=snapshot(),issues=inspectionIssues(data),sendIssues=preparationIssues(data);
  const ref=trackingLabel(data.info.method);
  $('#rx-tracking-label').textContent=ref;
  form.elements.tracking.placeholder='Enter '+ref.toLowerCase();
  const handoff=$('#rx-handoff-status'),handoffOpen=handoff.querySelector('details')?.open;
  handoff.innerHTML=sendIssues.length?'<details'+(handoffOpen?' open':'')+'><summary>Before download · '+sendIssues.length+' item'+(sendIssues.length===1?'':'s')+' to complete</summary><ul>'+sendIssues.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul></details>':'<p><strong>Ready to download</strong> · Receiving quantities, condition, and photos will be completed by the 3PL.</p>';
  for(const button of root.querySelectorAll('[data-handoff]'))button.disabled=sendIssues.length>0;
  const readiness=$('#rx-readiness');
  const opened=readiness.querySelector('details')?.open;
  readiness.innerHTML=issues.length?'<details'+(opened?' open':'')+'><summary>Draft report · '+issues.length+' item'+(issues.length===1?'':'s')+' to review</summary><p>Downloads are marked Draft until these items are complete.</p><ul>'+issues.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul></details>':'<p><strong>Ready to export</strong> · All required receiving details are complete.</p>';
  $('#rx-extract').disabled=!files.po&&!files.slip;
  $('#rx-add-line').disabled=lines.length>=LIMITS.lines;
}
function changed(resetReview=false) {
  dirty=true;
  if(resetReview)form.elements.reviewed.checked=false;
  lastExport=null;$('#rx-share').hidden=true;$('#rx-handoff-download').hidden=true;
  updateSummary();
}
function fileRows(group,arr,lineId=''){
  return arr.map((file,index)=>{
    const href=esc(urlFor(file)),label=esc(safeName(file.name));
    const image=imageFile(file)&&group!=='po'&&group!=='slip'?'<img src="'+href+'" alt="" loading="lazy">':'';
    return '<div class="rx-file-row">'+image+'<a download="'+label+'" href="'+href+'">'+label+'</a><button type="button" class="rx-remove" data-remove-file="'+esc(group)+'" data-index="'+index+'" data-line="'+esc(lineId)+'" aria-label="Remove '+label+'">Remove</button></div>';
  }).join('');
}
function renderFileGroups(){
  for(const group of ['po','slip','delivery','pallet','truck']){
    const arr=Array.isArray(files[group])?files[group]:files[group]?[files[group]]:[];
    $('#rx-'+group+'-files').innerHTML=fileRows(group,arr);
  }
}
function renderResult(group){
  const el=$('#rx-'+group+'-result'),result=results[group];
  if(!result){el.replaceChildren();return;}
  const head=result.error?result.error:result.mode+' · '+result.rows.length+' model'+(result.rows.length===1?'':'s')+' read';
  const warnings=result.warnings||[];
  el.innerHTML='<p><strong>'+esc(head)+'</strong></p>'+warnings.map(w=>'<p>'+esc(w)+'</p>').join('')+(result.preview?'<details><summary>View extracted text</summary><pre>'+esc(result.preview)+'</pre></details>':'');
}
const ninput=(label,field,value)=>'<label>'+label+'<input type="number" min="0" max="99999999" step="1" inputmode="numeric" data-field="'+field+'" value="'+esc(value??'')+'"></label>';
function lineStatus(l){
  const shortage=short(l.packed,l.received),extra=over(l.packed,l.received);
  if(shortage===null)return ['Shortage not calculated',''];
  if(shortage>0)return ['Shortage: Yes · '+shortage+' unit'+(shortage===1?'':'s'),'warn'];
  if(extra>0)return ['Shortage: No · '+extra+' extra unit'+(extra===1?'':'s'),'good'];
  return ['Shortage: No · 0 units','good'];
}
function renderLines(){
  const opened=new Set([...root.querySelectorAll('.rx-line details[open]')].map(e=>e.closest('.rx-line').dataset.lineId));
  const el=$('#rx-lines');
  if(!lines.length){el.innerHTML='<p class="rx-empty">Extract source documents or add a line to begin.</p>';return;}
  el.innerHTML=lines.map((l,i)=>{
    const [status,tone]=lineStatus(l), id=esc(l.id);
    return '<article class="rx-line" data-line-id="'+id+'" aria-label="Line item '+(i+1)+'"><div class="rx-line-head"><strong>Line '+(i+1)+' · '+esc(l.origin)+'</strong><span class="rx-pill" data-shortage data-tone="'+tone+'">'+esc(status)+'</span><button type="button" class="rx-remove" data-remove-line aria-label="Remove line '+(i+1)+'">Remove</button></div>'+
      '<div class="rx-line-fields"><label>Model #<input data-field="model" maxlength="100" value="'+esc(l.model)+'" placeholder="Enter model"></label>'+
      ninput('Actual ordered qty','ordered',l.ordered)+ninput('Packing slip qty','packed',l.packed)+ninput('Received qty','received',l.received)+
      '<label>Damages<select data-field="damages"><option value="">Choose</option><option value="no"'+(l.damages==='no'?' selected':'')+'>No</option><option value="yes"'+(l.damages==='yes'?' selected':'')+'>Yes</option></select></label></div>'+
      '<details'+(opened.has(l.id)||l.damages==='yes'||l.photos.length?' open':'')+'><summary>Line photos and notes'+(l.photos.length?' · '+l.photos.length+' attached':'')+'</summary><div class="rx-line-evidence"><div><label>Attach model photos<input type="file" data-upload="line" accept="'+photoAccept+'" multiple></label><p class="rx-hint">Attach proof when damages is Yes.</p><div class="rx-file-list">'+fileRows('line',l.photos,l.id)+'</div></div><label>Inspection notes<textarea rows="2" data-field="notes" maxlength="500" placeholder="Optional">'+esc(l.notes)+'</textarea></label></div></details></article>';
  }).join('');
}
function allFiles(){
  return listFiles(snapshot()).map(a=>a.file);
}
function capacity(incoming,remove=[]){
  const existing=allFiles().filter(f=>!remove.includes(f)),combined=[...existing,...incoming];
  if(combined.length>200||combined.reduce((n,f)=>n+f.size,0)>LIMITS.total)throw new Error('This report supports up to 200 files and 64 MB of originals. Remove files before adding more.');
}
const sameFile=(a,b)=>a.name===b.name&&a.size===b.size&&a.lastModified===b.lastModified;
function upload(group,incoming,line){
  incoming.forEach(f=>checkFile(f,fileType(group)));
  if(group==='po'||group==='slip'){
    capacity(incoming,files[group]?[files[group]]:[]);
    files[group]=incoming[0];delete results[group];
    renderResult(group);renderFileGroups();changed(true);
    msg(title[group]+' added. Extract the documents to refresh model quantities.');
  }else{
    const target=group==='line'?line.photos:files[group], additions=incoming.filter((f,i,a)=>!target.some(x=>sameFile(x,f))&&!a.slice(0,i).some(x=>sameFile(x,f)));
    if(target.length+additions.length>(group==='delivery'?LIMITS.proofs:LIMITS.photos))throw new Error('Too many files for this section.');
    capacity(additions);target.push(...additions);
    if(group==='line')renderLines();else renderFileGroups();
    changed();msg(additions.length?additions.length+' file'+(additions.length===1?'':'s')+' attached.':'Those files are already attached.');
  }
  pruneURLs();
}
async function task(label,fn){
  if(busy)return;
  busy=true;edit.disabled=true;root.setAttribute('aria-busy','true');msg(label);
  try{await fn();}
  catch(e){msg(clean(e?.message||'The operation failed.',400),true);}
  finally{busy=false;edit.disabled=false;root.removeAttribute('aria-busy');updateSummary();}
}
async function runExtraction(){
  await task('Reading source documents…',async()=>{
    const force=$('#rx-force-ocr').checked;
    const extracted={};
    try{
      for(const group of ['po','slip']){
        if(!files[group])continue;
        msg('Reading '+title[group].toLowerCase()+'…');
        try{extracted[group]=await extract(files[group],group,progress=>msg(title[group]+': '+progress),force);}
        catch(e){extracted[group]={error:clean(e?.message||'The file could not be read.',280)};}
      }
    }finally{await finishOCR();}
    results=extracted;renderResult('po');renderResult('slip');
    const po=results.po?.rows?results.po:null,slip=results.slip?.rows?results.slip:null;
    if(!po&&!slip){msg('No source could be read. Check the file messages above or enter lines manually.',true);return;}
    const merge=mergeSources(po,slip);
    if(merge.mismatch){
      changed(true);
      msg('PO references differ: '+merge.references.join(', ')+'. No lines were merged. Upload documents for the same PO, or enter the correct lines manually after review.',true);return;
    }
    if(merge.meta.po&&form.elements.po.value.trim()&&modelKey(merge.meta.po)!==modelKey(form.elements.po.value)&&autoInfo.po!==form.elements.po.value) {
      changed(true);msg('The uploaded PO reference '+merge.meta.po+' differs from the entered reference. Check the shipment, then update the PO number or upload the matching documents before extracting again.',true);return;
    }
    const existingModels=lines.filter(l=>l.model);
    const old=new Map(existingModels.map(l=>[modelKey(l.model),l]));
    if(old.size!==existingModels.length){msg('Resolve duplicate model numbers in the current lines before extracting. The current entries and photos are unchanged.',true);return;}
    const next=merge.lines.map(l=>{
      const previous=old.get(modelKey(l.model));
      old.delete(modelKey(l.model));
      const origin=l.ordered!==null&&l.packed!==null?'PO + packing slip':l.ordered!==null?'PO only':'Packing slip only';
      return lineFrom({...previous,...l,received:previous?.received??null,damages:previous?.damages||'',notes:previous?.notes||'',photos:previous?.photos||[],origin});
    });
    if(next.length+old.size+lines.filter(l=>!l.model).length>LIMITS.lines)throw new Error('Too many lines. Remove unused entries and try again.');
    // Keep entered receiving details and photos on any lines the new sources did not match.
    lines=[...next,...[...old.values()].map(l=>({...l,origin:'Existing entry · verify'})),...lines.filter(l=>!l.model)];
    for(const [k,v] of Object.entries(merge.meta)){
      const el=form.elements[k];
      if(!el.value||autoInfo[k]===el.value){el.value=v;autoInfo[k]=v;}
    }
    changed(true);renderLines();pruneURLs();
    msg((next.length?next.length+' model'+(next.length===1?'':'s')+' extracted. Confirm quantities and fill the received amounts.':'No lines were recognized. Review the extracted text or enter lines manually.')+(Object.values(results).some(r=>r.error)?' One source could not be read; check its file message.':''));
  });
}
function saveBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function exportHandoff(kind){
  await task('Preparing the prefilled 3PL form…',async()=>{
    const current=snapshot(),issues=preparationIssues(current);
    if(issues.length)throw new Error(issues[0]);
    const data=await prepareHandoff(current);
    const blob=kind==='pdf'?await makePdf(data):await makeWord(data);
    const name='Stark-3PL-Receiving-'+safeName(current.info.po).replaceAll(' ','-')+'.'+kind;
    saveBlob(blob,name);
    const status=$('#rx-handoff-download');
    status.textContent='Ready to email: '+name;status.hidden=false;
    msg('3PL template downloaded. Email it to your warehouse to complete after delivery.');
  });
}
async function exportReport(kind){
  await task('Preparing '+(kind==='zip'?'the receiving packet':kind==='pdf'?'the PDF':'the Word document')+'…',async()=>{
    const data=await prepare(snapshot()), base=fileBase(data.snapshot.info);
    let blob;
    if(kind==='pdf')blob=await makePdf(data);
    else if(kind==='docx')blob=await makeWord(data);
    else{
      const [pdf,word]=await Promise.all([makePdf({...data,attachOriginals:false}),makeWord(data)]);
      blob=await packet(data,pdf,word);
    }
    const name=base+'.'+kind;
    saveBlob(blob,name);
    const file=new File([blob],name,{type:blob.type});
    lastExport=file;try{$('#rx-share').hidden=!(navigator.canShare?.({files:[file]})&&navigator.share);}catch{$('#rx-share').hidden=true;}
    msg((data.issues.length?'Draft ':'')+'download prepared: '+name+'.');
  });
}
async function restore(file){
  if(!file||file.size>100*1024**2||!file.name.toLowerCase().endsWith('.zip'))throw new Error('Choose a receiving packet ZIP under 100 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),sizes=checkArchive(bytes,125*1024**2,850);
  if(!sizes.has('receiving-inspection.json')||sizes.get('receiving-inspection.json')>1024**2)throw new Error('This ZIP is not a receiving packet.');
  const JSZip=await zipTool(),zip=await JSZip.loadAsync(bytes);
  const draft=JSON.parse(await zip.file('receiving-inspection.json').async('text'));
  if(draft.format!=='stark-receiving-inspection'||draft.version!==1||!draft.info||!Array.isArray(draft.lines)||draft.lines.length>LIMITS.lines||!Array.isArray(draft.files)||draft.files.length>200)throw new Error('This receiving packet format is not supported.');
  const nextFiles=makeFiles(),nextLines=draft.lines.map(l=>lineFrom({...l,photos:[]}));
  const seen=new Set();let total=0;
  for(const item of draft.files){
    const group=item.group;
    if(!['po','slip','delivery','pallet','truck','line'].includes(group)||typeof item.path!=='string'||!item.path.startsWith('originals/')||seen.has(item.path)||!sizes.has(item.path))throw new Error('The receiving packet has an invalid attachment.');
    seen.add(item.path);
    const size=sizes.get(item.path);
    total+=size;
    if(total>LIMITS.total||size>LIMITS.file||size<1||typeof item.name!=='string')throw new Error('The receiving packet exceeds the attachment limits.');
    const f=checkFile(fileFromArchive(await zip.file(item.path).async('uint8array'),item.name),fileType(group));
    if(group==='line'){
      const row=Number.isInteger(item.index)?nextLines[item.index]:null;
      if(!row||row.photos.length>=LIMITS.photos)throw new Error('A line photo could not be matched to its model.');
      row.photos.push(f);
    }else if(group==='po'||group==='slip'){
      if(nextFiles[group])throw new Error('Duplicate source document in packet.');
      nextFiles[group]=f;
    }else{
      if(nextFiles[group].length>=(group==='delivery'?LIMITS.proofs:LIMITS.photos))throw new Error('The packet has too many proof files.');
      nextFiles[group].push(f);
    }
  }
  files=nextFiles;lines=nextLines;results={};autoInfo={};lastExport=null;dirty=false;
  applyInfo(draft.info);renderFileGroups();renderResult('po');renderResult('slip');renderLines();pruneURLs();
  $('#rx-share').hidden=true;$('#rx-handoff-download').hidden=true;msg('Receiving packet opened. Review the contents before downloading an updated report.');
}

form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',e=>{
  const field=e.target.dataset.field;
  if(field){
    const section=e.target.closest('.rx-line'),row=lines.find(l=>l.id===section?.dataset.lineId);
    if(!row)return;
    if(['ordered','packed','received'].includes(field))row[field]=quantity(e.target.value);
    else if(field==='damages'){row.damages=e.target.value;if(row.damages==='yes')section.querySelector('details').open=true;}
    else row[field]=clean(e.target.value,field==='notes'?500:100);
    const [status,tone]=lineStatus(row),el=section.querySelector('[data-shortage]');el.textContent=status;el.dataset.tone=tone;
    changed(['ordered','packed','model'].includes(field));
  }else if(infoFields.includes(e.target.name)){
    delete autoInfo[e.target.name];
    changed(e.target.name==='po');
  }
});
form.addEventListener('change',e=>{
  if(e.target.id==='rx-open-packet'){
    const file=e.target.files?.[0];e.target.value='';
    if(file&&(!dirty||window.confirm('Open this packet and replace the current inspection on this page?')))task('Opening receiving packet…',()=>restore(file));
    return;
  }
  const group=e.target.dataset.upload;
  if(!group||busy)return;
  const selected=[...e.target.files];e.target.value='';
  if(!selected.length)return;
  const row=lines.find(l=>l.id===e.target.closest('.rx-line')?.dataset.lineId);
  try{if(group!=='line'||row)upload(group,selected,row);}
  catch(e){msg(e.message,true);}
});
form.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||busy)return;
  if(b.id==='rx-add-line'){
    if(lines.length>=LIMITS.lines)return;
    const l=lineFrom();lines.push(l);renderLines();changed(true);
    root.querySelector('[data-line-id="'+l.id+'"] [data-field="model"]')?.focus();
  }else if(b.id==='rx-extract')runExtraction();
  else if(b.dataset.handoff)exportHandoff(b.dataset.handoff);
  else if(b.dataset.export)exportReport(b.dataset.export);
  else if(b.id==='rx-share'&&lastExport){
    navigator.share({files:[lastExport],title:'Stark receiving inspection'}).catch(error=>{if(error.name!=='AbortError')msg('Sharing is unavailable. Use the downloaded file.',true);});
  }else if(b.hasAttribute('data-remove-line')){
    const id=b.closest('.rx-line')?.dataset.lineId,row=lines.find(l=>l.id===id);
    if(row&&(row.photos.length||row.received!==null)&&!window.confirm('Remove this line and its receiving details?'))return;
    lines=lines.filter(l=>l.id!==id);renderLines();changed(true);pruneURLs();
    $('#rx-add-line').focus();
  }else if(b.dataset.removeFile){
    const group=b.dataset.removeFile,index=Number(b.dataset.index);
    if(group==='po'||group==='slip'){files[group]=null;delete results[group];renderResult(group);}
    else if(group==='line'){const row=lines.find(l=>l.id===b.dataset.line);if(row)row.photos.splice(index,1);}
    else files[group].splice(index,1);
    renderFileGroups();if(group==='line')renderLines();changed(group==='po'||group==='slip');pruneURLs();
  }
});
applyInfo(timeNow());renderFileGroups();renderLines();updateSummary();
