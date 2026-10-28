(function () {
  'use strict';
  const S=window.StarkSystem, C=window.StarkScanning;
  if(!S || !C || window.MK97Scanner)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const $=selector=>document.querySelector(selector), promises=new Map();
  function library(file,ready){if(ready())return Promise.resolve();if(promises.has(file))return promises.get(file);const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=S.url(file);const timer=setTimeout(()=>{promises.delete(file);reject(new Error('The barcode reader could not load. Check the connection and reload.'));},15000);script.onload=()=>{clearTimeout(timer);if(ready())resolve();else{promises.delete(file);reject(new Error('The barcode reader is unavailable.'));}};script.onerror=()=>{clearTimeout(timer);promises.delete(file);script.remove();reject(new Error('The barcode reader could not load. Reload to try again.'));};document.head.append(script);});promises.set(file,promise);return promise;}
  const encoder=()=>library('assets/vendor/JsBarcode-code128-3.12.1.min.js',()=>!!window.JsBarcode);
  async function loadZXing(){await library('assets/vendor/zxing-browser-0.1.5.min.js',()=>!!window.ZXingBrowser);return window.ZXingBrowser;}
  const url=(kind,id)=>S.url('scan.html?kind='+kind.toLowerCase()+(id?'&id='+encodeURIComponent(id):''));
  function notify(message,error=false){window.StarkSystemUI?.notice(message,error);}
  async function draw(svg,value){await encoder();if(!svg.isConnected)return;window.JsBarcode(svg,value,{format:'CODE128',width:2,height:84,displayValue:false,margin:22,lineColor:'#111111',background:'#ffffff'});svg.setAttribute('role','img');svg.setAttribute('aria-label','Scannable barcode for '+value);}
  async function printLabel(kind,id,sku){
    const report=C.view(kind,id),item=report.items.find(item=>item.sku===sku);
    await encoder();$('#scan-print-sheet')?.remove();
    const sheet=document.createElement('section');sheet.id='scan-print-sheet';sheet.className='scan-print-sheet';
    sheet.innerHTML=`<h1>MK97 · ${sku?'Item label':kind==='VENDOR'?'Vendor PO receiving':'Customer order picking'}</h1><h2>${esc(sku?item?.model:report.po)}</h2><p>${esc(sku?item?.title:report.party)}</p><svg></svg><p>${esc(sku || report.barcode)}</p>${sku?'':`<table><thead><tr><th>Item / Model</th><th>Description</th><th>Quantity</th></tr></thead><tbody>${report.items.map(item=>`<tr><td>${esc(item.model)}<br><small>${esc(item.sku)}</small></td><td>${esc(item.title)}</td><td>${item.qty}</td></tr>`).join('')}</tbody></table>`}`;
    document.body.append(sheet);await draw(sheet.querySelector('svg'),sku || report.barcode);
    document.body.classList.add('scan-printing');
    window.addEventListener('afterprint',()=>{sheet.remove();document.body.classList.remove('scan-printing');},{once:true});window.print();
  }
  function labelDialog(kind,id){
    const report=C.view(kind,id),dialog=window.StarkSystemUI.dialog('PO barcode · '+report.po,`<p>${esc(report.party)} · ${kind==='VENDOR'?'Vendor PO':'Customer order'}</p><div class="scan-label-preview"><svg id="scan-dialog-barcode"></svg></div><p class="scan-help">Scan this label in the website’s ${kind==='VENDOR'?'vendor receiving':'customer picking'} screen.</p><a class="btn primary" href="${esc(url(kind,id))}">Open item scanning</a>`,()=>{printLabel(kind,id).catch(error=>notify(error.message,true));return false;},'Print barcode');
    draw(dialog.querySelector('svg'),report.barcode).catch(error=>notify(error.message,true));
  }
  function augment(){
    const header=$('.system-header-right');if(header&&!header.querySelector('.scan-global-link')){const a=document.createElement('a');a.className='scan-global-link';a.href=url('CUSTOMER');a.setAttribute('aria-label','Open barcode scanning');a.title='Scan customer orders and vendor POs';a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 7v10M10 7v10M14 7v10M17 7v10"/></svg><span>Scan</span>';header.prepend(a);}
    const panel=$('#oo-detail-panel'),id=panel?.dataset.scanOrderId;
    const pane=$('#oo-pane-items') || $('#oo-panel-content-items');
    if(id && pane && pane.querySelector('.scan-order-entry')?.dataset.id!==id){pane.querySelector('.scan-order-entry')?.remove();const block=document.createElement('div');block.className='scan-order-entry';block.dataset.id=id;block.innerHTML=`<a class="btn primary" href="${esc(url('CUSTOMER',id))}">Scan order items</a><button type="button" class="btn" data-scan-label="CUSTOMER" data-scan-id="${esc(id)}">PO barcode</button>`;pane.prepend(block);}
    document.querySelectorAll('button[data-op="po-detail"]').forEach(button=>{const cell=button.closest('tr')?.cells[0];if(!cell||cell.querySelector('.scan-po-entry'))return;const box=document.createElement('div');box.className='scan-po-entry';box.innerHTML=`<a href="${esc(url('VENDOR',button.dataset.id))}">Scan receiving</a><button type="button" data-scan-label="VENDOR" data-scan-id="${esc(button.dataset.id)}">Barcode</button>`;cell.append(box);});
    mobileEnhancements();
    if(['wms-receiving','wms-waves','vendor-procurement'].includes(document.body.dataset.page)){
      const host=$('.hero-actions') || $('main .hero') || $('main');if(host&&!document.querySelector('.scan-workflow-entry')){const a=document.createElement('a');a.className='btn primary scan-workflow-entry';a.href=url(document.body.dataset.page==='wms-waves'?'CUSTOMER':'VENDOR');a.textContent=document.body.dataset.page==='wms-waves'?'Scan customer order':'Scan vendor PO';host.append(a);}
    }
  }
  function mobileEnhancements(){
    const header=$('.system-header'),search=$('#system-search-input');
    if(header&&search&&!header.querySelector('.phone-search-toggle')){const button=document.createElement('button');button.type='button';button.className='phone-search-toggle';button.setAttribute('aria-label','Search workspace');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','system-search-input');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg>';header.insertBefore(button,$('.system-header-right'));button.onclick=()=>{const open=document.body.classList.toggle('phone-search-open');button.setAttribute('aria-expanded',String(open));if(open)search.focus();};}
    if(innerWidth<=1100)document.querySelectorAll('main table').forEach(table=>{if(table.closest('.phone-table-wrap,.table-wrap,.sys-table-wrap,.table-scroll,.vpo-table-responsive,.co-table-responsive,.eim-table-wrap,.eim-table-container,.oo-table-scroll'))return;const wrap=document.createElement('div');wrap.className='phone-table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Records table; scroll for all columns');table.before(wrap);wrap.append(table);});
    const mail=$('#stark-mail-content'),panes=mail?.querySelectorAll('.mail-col-sidebar,.mail-col-list,.mail-col-detail,.mail-col-intel');
    if(panes?.length===4){
      const parent=panes[0].parentElement;if(!parent.classList.contains('phone-mail-layout'))parent.classList.add('phone-mail-layout');
      if(!mail.querySelector('.phone-mail-tabs')){const tabs=document.createElement('div');tabs.className='phone-mail-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Mobile mail view');tabs.innerHTML=[['folders','Folders'],['messages','Messages'],['message','Read'],['related','Related']].map(([value,label])=>`<button type="button" data-phone-mail="${value}" aria-pressed="false">${label}</button>`).join('');parent.before(tabs);}
      document.body.dataset.phoneMailView ||= 'messages';
      mail.querySelectorAll('[data-phone-mail]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.phoneMail===document.body.dataset.phoneMailView));button.onclick=()=>{document.body.dataset.phoneMailView=button.dataset.phoneMail;mobileEnhancements();};});
    }
  }
  document.addEventListener('keydown',event=>{if(innerWidth<=820&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopImmediatePropagation();document.body.classList.add('phone-search-open');$('.phone-search-toggle')?.setAttribute('aria-expanded','true');$('#system-search-input')?.focus();}else if(event.key==='Escape'&&document.body.classList.contains('phone-search-open')){document.body.classList.remove('phone-search-open');$('.phone-search-toggle')?.setAttribute('aria-expanded','false');$('.phone-search-toggle')?.focus();}},true);
  document.addEventListener('click',event=>{if(innerWidth>1100)return;if(innerWidth<=820&&!event.target.closest('.system-header')){document.body.classList.remove('phone-search-open');$('.phone-search-toggle')?.setAttribute('aria-expanded','false');}if(event.target.closest('.mail-thread-item')&&!event.target.closest('input,button,a')){document.body.dataset.phoneMailView='message';schedule();}else if(event.target.closest('.mail-col-sidebar .mail-nav-item')){document.body.dataset.phoneMailView='messages';schedule();}});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-scan-label]');if(!button)return;event.preventDefault();event.stopPropagation();try{labelDialog(button.dataset.scanLabel,button.dataset.scanId);}catch(error){notify(error.message,true);}});
  let queued=false,frame=0,observer=null;const schedule=()=>{if(queued)return;queued=true;frame=requestAnimationFrame(()=>{queued=false;augment();});};
  function init(){
    augment();observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-scan-order-id']});
    if($('#scan-workspace'))initPage();
    window.addEventListener('resize',schedule);
    window.addEventListener('pagehide',()=>{observer.disconnect();cancelAnimationFrame(frame);queued=false;});
    window.addEventListener('pageshow',event=>{if(event.persisted){observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-scan-order-id']});schedule();}});
  }
  function initPage(){
    const params=new URLSearchParams(location.search);let kind=params.get('kind')?.toUpperCase()==='VENDOR'?'VENDOR':'CUSTOMER',id='',selected='',report=null;const bins={};
    $('#scan-mode').value=kind;
    const camera=new window.MK97ScanCamera($('#scan-video'),(message,error)=>{ $('#scan-camera-status').textContent=message;$('#scan-camera-status').classList.toggle('scan-error-text',!!error);$('#scan-camera-frame').hidden=!camera.running&&!camera.starting;$('#scan-stop-camera').disabled=!camera.running&&!camera.starting;$('#scan-switch-camera').disabled=!camera.running;$('#scan-torch').hidden=!camera.canTorch(); },{loadZXing});
    const feedback=(message,error=false)=>{const box=$('#scan-feedback');box.textContent=message;box.className='scan-feedback '+(error?'error':'success');box.setAttribute('role',error?'alert':'status');box.hidden=false;};
    const activeReceipts=()=>S.getState().logistics.receipts.filter(receipt=>receipt.po===report?.po && receipt.scanVerified && receipt.status==='ARRIVED' && receipt.lines.some(line=>Number(line.received)>0));
    function listDocuments(){const state=S.getState(),documents=kind==='VENDOR'?state.enterprise.purchaseOrders:state.enterprise.orders;const select=$('#scan-doc-select'),previous=select.value;select.innerHTML='<option value="">Choose an existing '+(kind==='VENDOR'?'vendor PO':'customer order')+'</option>'+documents.map(record=>`<option value="${esc(record.id)}">${esc(record.po)} · ${esc(record.status.replaceAll('_',' '))}</option>`).join('');select.value=documents.some(record=>record.id===id)?id:previous;}
    function render(){
      listDocuments();$('#scan-mode-description').textContent=kind==='VENDOR'?'Scan the vendor PO, select an item, and scan the units received.':'Scan the customer PO, select an item, and verify the units picked.';
      if(!id){$('#scan-document').hidden=true;$('#scan-item-form').hidden=true;$('#scan-arm-item').disabled=true;return;}
      try{report=C.view(kind,id);}catch(error){id='';selected='';feedback(error.message,true);render();return;}
      $('#scan-document').hidden=false;$('#scan-doc-title').textContent=report.po;$('#scan-doc-party').textContent=report.party+' · '+report.status.replaceAll('_',' ');$('#scan-reason').textContent=report.reason;$('#scan-reason').hidden=!report.reason;
      $('#scan-item-list').innerHTML=report.items.map(item=>`<li><button type="button" data-scan-item="${esc(item.sku)}" aria-pressed="${selected===item.sku}" ${!report.canScan?'disabled':''}><span class="scan-item-name"><strong>${esc(item.model)}</strong><span>${esc(item.title)}</span><small>${esc(item.sku)}</small></span><span class="scan-item-progress">${kind==='VENDOR'?`${item.received} received · ${item.pending} awaiting putaway`:`${item.verified} / ${item.qty} verified`}<strong>${item.remaining?item.remaining+' left to scan':'✓ Item complete'}</strong></span></button></li>`).join('');
      const item=report.items.find(item=>item.sku===selected);$('#scan-item-form').hidden=!item;$('#scan-arm-item').disabled=!item || !report.canScan || item.remaining===0;
      $('#scan-selected-label').textContent=item?item.model+' · '+item.title:'Select an item on the PO';$('#scan-selected-codes').textContent=item?'Accepted codes: '+item.codes.join(' · '):'';
      if(item){$('#scan-quantity').max=item.remaining;$('#scan-item-code').disabled=!report.canScan||!item.remaining;$('#scan-verify-item').disabled=!report.canScan||!item.remaining;$('#scan-print-item').disabled=false;$('#scan-manage-codes').disabled=false;}
      $('#scan-finish').textContent=kind==='VENDOR'?'Finish delivery · create putaway':'Finish picking';$('#scan-finish').disabled=!report.canScan || (kind==='VENDOR'?!activeReceipts().length:!report.complete || !!S.getState().enterprise.orders.find(record=>record.id===id)?.scanVerification?.completedAt);
      const state=S.getState(),destinations=state.logistics.bins.filter(bin=>bin.active&&!['RECEIVING','DAMAGED'].includes(bin.zone));
      const scannedSKUs=new Set(activeReceipts().flatMap(receipt=>receipt.lines.filter(line=>Number(line.received)>0).map(line=>line.sku)));
      $('#scan-putaway-fields').hidden=kind!=='VENDOR'||!scannedSKUs.size;
      $('#scan-putaway-fields').innerHTML=kind==='VENDOR'?[...scannedSKUs].map(sku=>{const item=report.items.find(item=>item.sku===sku);const preferred=state.logistics.inventory.find(row=>row.sku===sku&&destinations.some(bin=>bin.id===row.binId))?.binId;bins[sku] ||= preferred || destinations[0]?.id;return `<label>Putaway bin · ${esc(item?.model || sku)}<select data-scan-bin="${esc(sku)}">${destinations.map(bin=>`<option value="${esc(bin.id)}" ${bins[sku]===bin.id?'selected':''}>${esc(bin.id)} · ${Math.max(0,bin.capacity-bin.used)} free</option>`).join('')}</select></label>`;}).join(''):'';
      $('#scan-print-po').onclick=()=>printLabel(kind,id).catch(error=>feedback(error.message,true));
      $('#scan-label-toggle').onclick=()=>{$('#scan-inline-label').hidden=!$('#scan-inline-label').hidden;if(!$('#scan-inline-label').hidden)draw($('#scan-inline-barcode'),report.barcode).catch(error=>feedback(error.message,true));};
      $('#scan-item-list').querySelectorAll('[data-scan-item]').forEach(button=>button.onclick=()=>{camera.disarm();selected=button.dataset.scanItem;$('#scan-quantity').value=1;render();$('#scan-selected-label').focus();if(innerWidth<800)$('#scan-camera-card').scrollIntoView({behavior:'smooth',block:'start'});});
      $('#scan-putaway-fields').querySelectorAll('[data-scan-bin]').forEach(select=>select.onchange=()=>{bins[select.dataset.scanBin]=select.value;});
    }
    function load(value,fromCamera=false){try{const record=C.resolve(value,kind);if(!fromCamera)camera.stop();id=record.id;selected='';$('#scan-document-code').value='';$('#scan-inline-label').hidden=true;history.replaceState(null,'',url(kind,id));render();feedback('PO loaded. Select the item you want to scan.');}catch(error){feedback(error.message,true);}}
    function verify(value,snapshot){
      if(!textValue(value))return;
      try{const result=C.scan({...snapshot,value});render();const item=result.view.items.find(item=>item.sku===snapshot.sku);feedback('✓ Correct item · '+snapshot.quantity+' unit'+(snapshot.quantity===1?'':'s')+' verified. '+item.remaining+' left to scan.');navigator.vibrate?.(70);$('#scan-item-code').value='';$('#scan-item-code').focus();}
      catch(error){feedback(error.code==='WRONG_ITEM'?'Wrong item — expected '+(report?.items.find(item=>item.sku===snapshot.sku)?.model || 'the selected item')+'. No quantity was recorded.':error.message,true);navigator.vibrate?.([80,40,80]);$('#scan-item-code').select();}
    }
    function snapshot(){if(!selected)throw new Error('Select an item on the PO first.');const quantity=Number($('#scan-quantity').value),fresh=C.view(kind,id);const item=fresh.items.find(item=>item.sku===selected);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>item.remaining)throw new Error('Use a whole quantity within the remaining item balance.');return{kind,id,sku:selected,quantity,revision:fresh.revision,requestId:S.uid('scan')};}
    async function arm(target){
      try{
        const snap=target==='ITEM'?snapshot():null;
        $('#scan-po-camera').disabled=true;$('#scan-arm-item').disabled=true;
        if(!camera.running)await camera.start();
        if(!camera.running)return;
        camera.arm(value=>{if(target==='DOCUMENT')load(value,true);else if(snap.kind===kind&&snap.id===id&&snap.sku===selected)verify(value,snap);});
        $('#scan-camera-status').textContent=target==='DOCUMENT'?'Point the camera at the PO barcode':'Ready · scan '+snap.quantity+' unit'+(snap.quantity===1?'':'s')+' of '+report.items.find(item=>item.sku===selected).model;
      }catch(error){feedback(error.message,true);}finally{$('#scan-po-camera').disabled=false;render();}
    }
    $('#scan-mode').onchange=()=>{camera.stop();kind=$('#scan-mode').value;id='';selected='';report=null;$('#scan-feedback').hidden=true;history.replaceState(null,'',url(kind));render();};
    $('#scan-document-form').onsubmit=event=>{event.preventDefault();load($('#scan-document-code').value);};
    $('#scan-load-selected').onclick=()=>{const value=$('#scan-doc-select').value;if(value)load(C.barcode(kind,{id:value}));else feedback('Choose a PO from the list.',true);};
    $('#scan-po-camera').onclick=()=>arm('DOCUMENT');$('#scan-arm-item').onclick=()=>arm('ITEM');
    $('#scan-stop-camera').onclick=()=>camera.stop();$('#scan-switch-camera').onclick=async()=>{try{camera.disarm();await camera.switchCamera();}catch(error){feedback(error.message,true);}};
    $('#scan-torch').onclick=async()=>{try{$('#scan-torch').setAttribute('aria-pressed',String(await camera.toggleTorch()));}catch(error){feedback(error.message,true);}};
    $('#scan-item-form').onsubmit=event=>{event.preventDefault();if(!$('#scan-item-code').value.trim())return;try{camera.disarm();verify($('#scan-item-code').value,snapshot());}catch(error){feedback(error.message,true);}};
    $('#scan-finish').onclick=()=>{try{camera.stop();if(kind==='VENDOR'){const result=C.finishReceiving(id,bins,S.getState().revision);feedback('Delivery saved. '+result.receiptIds.length+' receiving batch recorded. Complete putaway to make these units available in inventory.');}else{C.finishPicking(id,S.getState().revision);feedback('All items verified. Picking is complete; the order is ready for packing.');}render();}catch(error){feedback(error.message,true);}};
    $('#scan-print-item').onclick=()=>printLabel(kind,id,selected).catch(error=>feedback(error.message,true));
    $('#scan-manage-codes').onclick=()=>{try{camera.disarm();const state=S.getState(),item=state.enterprise.inventory.find(item=>item.sku===selected),sku=selected,revision=state.revision;const dialog=window.StarkSystemUI.dialog('Item barcodes · '+item.model,`<p>Save the manufacturer UPC, EAN or warehouse item codes for this exact item. Its SKU and model remain accepted.</p><label class="scan-code-editor">Additional item barcodes (one per line)<textarea id="scan-code-editor" rows="6" maxlength="4500">${esc((item.barcodes || []).join('\n'))}</textarea></label>`,wrap=>{C.saveCodes(sku,wrap.querySelector('textarea').value.split(/\n/),revision);render();feedback('Item barcodes saved.');return true;},'Save item barcodes');dialog.querySelector('textarea').focus();}catch(error){feedback(error.message,true);}};
    window.addEventListener('stark:system-change',()=>{if(id)render();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)camera.stop();});window.addEventListener('pagehide',()=>camera.stop(false));
    render();if(params.get('id'))load(C.barcode(kind,{id:params.get('id')}));
    window.MK97Scanner.page={load,render,camera,getContext:()=>({kind,id,selected})};
  }
  function textValue(value){return String(value??'').trim();}
  window.MK97Scanner={url,draw,printLabel,labelDialog,augment};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
