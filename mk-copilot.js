(function () {
  'use strict';
  const S=window.StarkSystem,C=window.MKCopilotCore;
  if(!S || !C || window.MKCopilot)return;
  const store=window.StarkWorkspace?.sessionStorage || window.sessionStorage;
  const KEY='mk.copilot.context.v1',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selected='',context={},cache=null,signature='',timer,refreshTimer,paintQueued=false,cloudBusy=false;
  const access=()=>window.StarkSystemCloud?.getAccess?.() || {};
  const identity=()=>[window.StarkWorkspace?.isDemo?'demo':'working',access().organizationId || 'local',access().userId || 'local',S.getRegion()].join('|');
  const timeZone=()=>S.getState().copilotSettings?.timeZone || 'America/New_York';
  const itemKey=value=>String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
  function resolveItem(value) {
    const inventory=S.getState().enterprise.inventory.filter(i=>S.regionCode(i.region)===S.getRegion());
    const exact=inventory.filter(i=>String(i.sku).toLowerCase()===String(value).toLowerCase());
    const matches=exact.length?exact:inventory.filter(i=>itemKey(i.model)===itemKey(value));
    return matches.length===1?matches[0]:null;
  }
  function readContext() {
    let saved;try{saved=JSON.parse(store.getItem(KEY)||'null');}catch(_){}
    context=saved?.identity===identity()?saved:{identity:identity(),orderId:'',sku:'',intent:'',turns:[]};
    if(context.orderId && !S.getState().enterprise.orders.some(o=>o.id===context.orderId))context.orderId='';
    return context;
  }
  function persist(){context.identity=identity();try{store.setItem(KEY,JSON.stringify(context));}catch(_) {}}
  function setContext(input={}) {
    readContext();const state=S.getState();
    if(input.orderId!==undefined){const order=state.enterprise.orders.find(o=>o.id===input.orderId);if(input.orderId && !order)throw new Error('Order not found.');const changed=context.orderId!==(order?.id || '');context.orderId=order?.id || '';if(changed || !context.sku)context.sku=order?.lines[0]?.sku || '';}
    if(input.sku!==undefined)context.sku=resolveItem(input.sku)?.sku || String(input.sku).slice(0,200);
    if(input.intent!==undefined)context.intent=String(input.intent).slice(0,300);
    persist();paint();return {...context};
  }
  function report() {
    const state=S.getState(),key=[state.revision,Math.floor(Date.now()/60000),timeZone()].join('|');
    if(cache?.key===key)return cache.value;
    const value=C.analyze(state,{timeZone:timeZone()});cache={key,value};return value;
  }
  function remember(question,answer){readContext();context.turns ||= [];context.turns.push({question:String(question).slice(0,1000),answer:String(answer).slice(0,12000),at:new Date().toISOString()});context.turns=context.turns.slice(-12);persist();}
  function messages(){readContext();return (context.turns || []).flatMap(t=>[{role:'user',text:t.question},{role:'brain',text:t.answer}]);}
  function pickOrder(value) {
    const matches=S.getState().enterprise.orders.filter(o=>[o.id,o.po,o.orderNumber].some(v=>String(v || '').toLowerCase()===String(value).toLowerCase()));return matches.length===1?matches[0]:null;
  }
  function capturePage() {
    readContext();const params=new URLSearchParams(location.search);
    for(const key of ['order','orderId','id','search','edit']){const found=pickOrder(params.get(key));if(found){context.orderId=found.id;context.sku=found.lines[0]?.sku || '';break;}}
    if(params.get('sku'))context.sku=resolveItem(params.get('sku'))?.sku || params.get('sku').slice(0,200);persist();
  }
  function captureInventoryParameters() {
    const fields=[...document.querySelectorAll('[id^="eim-filter-"],#eim-word-search-input,#eim-sort-select')].filter(el=>/^(INPUT|SELECT)$/.test(el.tagName));
    if(!fields.length)return;readContext();context.inventoryParameters={region:S.getRegion(),filters:Object.fromEntries(fields.slice(0,24).map(el=>[el.id,el.type==='checkbox'?el.checked:String(el.value || '').slice(0,200)]))};persist();
  }
  function itemSummary(value) {
    const item=resolveItem(value);if(!item)return `No unique operational inventory record matches ${value} in ${S.getRegion()}. Link the catalog model to its operational SKU before using it for allocation.`;
    const state=S.getState(),lines=report().orders.flatMap(o=>o.lines).filter(l=>l.sku===item.sku),demand=lines[0]?.globalOpenDemand || 0;
    const pos=state.enterprise.purchaseOrders.filter(p=>!['RECEIVED','CANCELLED','CLOSED','REJECTED','VOID'].includes(p.status) && (!p.region || p.region===item.region)).flatMap(p=>p.lines.filter(l=>l.sku===item.sku).map(l=>({po:p.po,purpose:p.purpose || 'INVENTORY',quantity:Math.max(0,Number(l.qty || 0)-Number(l.received || 0)-Number(l.cancelledQty || 0)),eta:C.dateOnly(l.eta || p.eta)}))).filter(p=>p.quantity>0);
    const filters=Object.entries(context.inventoryParameters?.filters || {}).filter(([,v])=>v!=='' && v!==false).map(([k,v])=>k.replace(/^eim-filter-|^eim-/g,'')+'='+v).join(', ');
    return `${item.model} (${item.sku}) · ${item.region}\nWarehouse on hand: ${item.onHand || 0}. Reserved: ${item.reserved || 0}. Unreserved usable: ${Math.max(0,Number(item.onHand || 0)-Number(item.reserved || 0)-Number(item.damaged || 0))}.\nGlobal open customer-order demand: ${demand}.\nOpen PO Quantity (all matching channels): ${pos.reduce((sum,p)=>sum+p.quantity,0)}. ${pos.map(p=>p.po+': '+p.quantity+' · '+p.purpose+' · ETA '+(p.eta || 'unknown')).join('; ')}\nSelect an order to test its allocation after prior FIFO commitments; dedicated dropship and 3PL supply stay in their own pools.${filters?'\nInventory filters carried from the catalog: '+filters:''}`;
  }
  function orderSummary(id) {
    const a=report().orders.find(o=>o.orderId===id);if(!a)return 'This order is closed or unavailable in the active workspace.';
    return [`Order #${a.po} · ${a.region} · ${a.urgency} urgency`,...a.reasons,`Contact status: ${a.contactStatus}. Follow-up Date: ${a.followUpDate || 'Not set'}.`,
      ...a.lines.map(l=>`${l.model} (${l.sku}): ${l.globalOpenDemand} units across all open orders; FIFO position ${l.queuePosition}, ${l.priorQueueQuantity} units ahead in its supply pool. Open PO Quantity: ${l.openPOQuantity}. Secured/on-hand: ${l.onHandQuantity}. Incoming assigned to this order: ${l.fromPOQuantity}. Fulfillment Status: ${l.fulfillmentStatus}. ${l.poLots.map(p=>p.po+': '+p.quantity+' open, ETA '+(p.eta || 'unknown')+(p.delayDays?' ('+p.delayDays+' days later than the recorded prior ETA)':'')).join('; ')}`),
      `Estimated delivery: ${a.estimatedDeliveryDate || 'Unconfirmed'}.`,...a.assumptions,report().queuePolicy].join('\n');
  }
  function handle(question) {
    readContext();const explicit=question.match(/\border\s*#?\s*([A-Za-z0-9_./-]+)/i),found=explicit?pickOrder(explicit[1]):null;
    if(found)setContext({orderId:found.id});
    const operational=/\b(urgency|urgent|critical|follow[ -]?up|contacted|customer repl|customer response|fifo|allocat|fulfill|this order|order status|order #|order file|co[ -]?pilot|coverage|queue|incoming|vendor po)\b/i.test(question);
    if(context.sku && !/\b(order|fifo|queue|fulfill)\b/i.test(question) && /\b(inventory|stock|on.hand|available|availability|this item)\b/i.test(question)){setContext({intent:question});return {intent:'copilot',category:'Co-Pilot',message:itemSummary(context.sku)};}
    if(/\b(demand trend|time.series|trend for)\b/i.test(question)) {
      const sku=S.getState().enterprise.inventory.find(i=>question.toLowerCase().includes(i.sku.toLowerCase()) || (i.model && question.toLowerCase().includes(i.model.toLowerCase())))?.sku || resolveItem(context.sku)?.sku || context.sku;
      if(!sku)return {intent:'copilot',category:'Co-Pilot',message:'Select an order or item first so I can inspect its recorded demand history.'};
      const trend=C.demandSeries(S.getState(),sku,undefined,timeZone());
      return {intent:'copilot',category:'Co-Pilot',message:`${sku}: ${trend.status}. ${trend.observedDays} completed days observed. Last 7 days: ${trend.last7 ?? '—'} units; previous 7: ${trend.previous7 ?? '—'}.${trend.changePercent===null || trend.changePercent===undefined?'':` Change: ${trend.changePercent.toFixed(1)}%.`} ${trend.basis}`};
    }
    if(!operational && !found)return null;
    if(/\b(log|record|send|write)\b.*\b(reply|response|message|outreach|customer)\b/i.test(question)) {
      if(context.orderId)communicationDialog(context.orderId);
      return {intent:'copilot',category:'Co-Pilot',message:context.orderId?'Review the order communication form. Drafts do not change contact status; only a sent-message record or an authenticated incoming response does.':'Select an order before recording a communication.'};
    }
    if(/urgent orders|critical orders|proactive|anomal|priorities|what needs attention/i.test(question) || (!context.orderId && /urgency|urgent|critical|co[ -]?pilot/.test(question.toLowerCase()))) {
      const rows=report().alerts;return {intent:'copilot',category:'Co-Pilot',message:rows.length?rows.slice(0,10).map(a=>a.tier+': '+a.message).join('\n'):'No High or Critical urgency conditions are present in the recorded open orders.'};
    }
    setContext({intent:question});return {intent:'copilot',category:'Co-Pilot',message:context.orderId?orderSummary(context.orderId):'Choose an order in the Co-Pilot selector or name its exact PO number. I will use all open orders for its FIFO queue, not just the rows on this page.'};
  }
  async function record(input) {
    const event={id:input.id || S.uid('msg'),orderId:input.orderId,direction:input.direction,text:input.text,subject:input.subject || '',occurredAt:input.occurredAt || new Date().toISOString(),confirmedSent:input.confirmedSent===true};
    let result;
    if(window.StarkSystemCloud?.getStatus().active) {
      if(!['owner','admin','manager','editor'].includes(access().role))throw new Error('An authorized organization editor must record this communication.');
      result=await window.StarkSystemCloud.copilotRequest({action:'record',event});
    } else {
      S.transaction('COPILOT_COMMUNICATION',event.orderId,state=>{result=C.applyCommunication(state,event,{timeZone:timeZone(),actor:access().userId || 'local',source:'manual',verified:false});});
    }
    cache=null;paint();return result;
  }
  function communicationDialog(orderId) {
    const order=S.getState().enterprise.orders.find(o=>o.id===orderId);if(!order)return;
    const account=S.getState().enterprise.accounts.find(a=>a.id===order.accountId);
    const dialog=window.StarkSystemUI.dialog('Order #'+order.po+' · Communication',`
      <p>Record an actual customer response or a message your team has already sent. Email capture is automatic only after the receiving connector is configured.</p>
      <label>Message type<select id="copilot-message-direction" aria-label="Message type"><option value="INBOUND">Record a customer response</option><option value="OUTBOUND">Record already-sent outreach</option><option value="SEND" ${window.StarkSystemCloud?.getStatus().active?'':'disabled'}>Send customer email through Co-Pilot</option></select></label>
      <p>Customer recipient from CRM: <strong>${esc(account?.email || 'Set a customer email in CRM first')}</strong></p>
      <label>Subject<input id="copilot-message-subject" maxlength="200" value="${esc('Order #'+order.po+' update')}"></label>
      <label>Original message text<textarea id="copilot-message-text" rows="7" maxlength="10000" required></textarea></label>
      <label>Message date and time<input id="copilot-message-time" type="datetime-local" required></label>
      <label><input id="copilot-sent-confirmed" type="checkbox"> I confirm already-sent outreach, or approve sending this exact text to the CRM recipient when Send is selected.</label>
      <p id="copilot-date-preview" role="status"></p>`,async wrap=>{
        const mode=wrap.querySelector('select').value,input={id:wrap.dataset.eventId,orderId,direction:mode==='SEND'?'OUTBOUND':mode,text:wrap.querySelector('textarea').value,subject:wrap.querySelector('#copilot-message-subject').value,occurredAt:new Date(wrap.querySelector('input[type=datetime-local]').value).toISOString(),confirmedSent:wrap.querySelector('input[type=checkbox]').checked};
        const result=mode==='SEND'?await window.StarkSystemCloud.copilotRequest({action:'send',event:input}):await record(input);cache=null;paint();window.StarkSystemUI.notice(result.delivery==='ACCEPTED'?'Email accepted and outreach recorded.':result.duplicate?'This message was already recorded.':result.task?'Response logged and follow-up task created.':'Communication saved.');
      },'Save communication',{system:true});
    dialog.dataset.eventId=S.uid('msg');
    dialog.querySelector('select').addEventListener('change',()=>{dialog.querySelector('[data-save]').textContent=dialog.querySelector('select').value==='SEND'?'Send customer email':'Save communication';});
    const d=new Date();dialog.querySelector('input[type=datetime-local]').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    const preview=()=>{try{const parsed=C.parseFollowUp(dialog.querySelector('textarea').value,new Date(dialog.querySelector('input[type=datetime-local]').value).toISOString(),timeZone());dialog.querySelector('#copilot-date-preview').textContent=parsed.status==='resolved'?`Follow-up: ${parsed.date} · ${parsed.timeZone}. A linked task will be created for an open order.`:parsed.status==='needs_review'?'Date is ambiguous or excluded. Review it and create a task manually; no automatic date will be assumed.':'No clear follow-up date found.';}catch(_){dialog.querySelector('#copilot-date-preview').textContent='Choose a valid message time.';}};
    dialog.querySelector('textarea').addEventListener('input',preview);dialog.querySelector('input[type=datetime-local]').addEventListener('change',preview);
    return dialog;
  }
  function details(orderId) {
    setContext({orderId});const state=S.getState(),order=state.enterprise.orders.find(o=>o.id===orderId),a=report().orders.find(o=>o.orderId===orderId);
    const dialog=window.StarkSystemUI.dialog('Order #'+order.po+' · Co-Pilot file',orderHTML(order,a),()=>communicationDialog(orderId),'Record communication',{system:true});
    dialog.querySelector('.sys-modal').style.width='min(1000px,100%)';return dialog;
  }
  function orderHTML(order,a) {
    const account=S.getState().enterprise.accounts.find(x=>x.id===order.accountId);
    return `<div class="mk-copilot-file"><div class="mk-copilot-file-meta"><span class="mk-copilot-tier ${a?.urgency.toLowerCase() || 'low'}">${esc(a?.urgency || 'Closed')}</span><strong>${esc(account?.name || '')}</strong><span>Customer contact: ${esc(order.contactStatus || 'Not contacted')}</span></div>
      <label>Follow-up Date<input type="date" value="${esc(order.followUpDate || '')}" readonly aria-label="Follow-up Date"></label>
      ${a?`<p>${a.reasons.map(esc).join(' ')}</p><div class="mk-copilot-table-wrap"><table class="sys-table"><thead><tr><th>Item</th><th>FIFO / prior units</th><th>Open PO Quantity</th><th>This order</th><th>Fulfillment Status</th></tr></thead><tbody>${a.lines.map(l=>`<tr><td>${esc(l.model)}<small>${esc(l.sku)} · ${esc(l.region)}</small></td><td>${l.queuePosition} / ${l.priorQueueQuantity}</td><td>${l.openPOQuantity}<small>${l.poLots.map(p=>esc(p.po)+' · '+(p.eta || 'ETA unknown')).join('<br>')}</small></td><td>${l.quantity} requested<small>${l.onHandQuantity} secured/on hand · ${l.fromPOQuantity} incoming · ${l.shortfall} uncovered</small></td><td>${esc(l.fulfillmentStatus)}</td></tr>`).join('')}</tbody></table></div><p class="mk-copilot-muted">${a.assumptions.map(esc).join(' ')} ${esc(report().queuePolicy)}</p>`:'<p>This order is closed. Its recorded communication history remains available.</p>'}
      <h3>Order communication timeline</h3><div class="mk-copilot-timeline">${(order.communicationLog || []).slice().sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt) || b.id.localeCompare(a.id)).map(m=>`<article><strong>${m.direction==='OUTBOUND'?'Team outreach':'Customer response'} · ${esc(m.intent)}</strong><small>${esc(new Date(m.occurredAt).toLocaleString())} · ${m.verified?'Connector record':'Manually recorded'}</small><p>${esc(m.text)}</p>${m.followUp?.status==='resolved'?`<small>Follow-up: ${esc(m.followUp.date)} · ${esc(m.followUp.timeZone)}</small>`:m.followUp?.status==='needs_review'?'<small>Date needs review; no automatic follow-up date assumed.</small>':''}</article>`).join('') || '<p>No communications recorded for this order.</p>'}</div>
      <p><a href="${S.url('tasks.html')}">Open Tasks &amp; reminders</a></p></div>`;
  }
  function planningSettings() {
    if(window.StarkSystemCloud?.getStatus().active && !['owner','admin','manager','editor'].includes(access().role))throw new Error('An organization editor must change planning settings.');
    const settings=S.getState().copilotSettings || {},days={handlingDays:1,transitDays:3,criticalDays:7,highDays:14,contactDays:3,...settings.logistics};
    return window.StarkSystemUI.dialog('Co-Pilot planning settings',`<label>Organization time zone<input id="copilot-zone" value="${esc(settings.timeZone || 'America/New_York')}" placeholder="America/New_York" required></label><p>Follow-up dates use the message receipt time in this zone. Tasks are due at 9:00 AM.</p>${[['handlingDays','Warehouse handling days'],['transitDays','Transit days'],['criticalDays','Critical deadline window (days)'],['highDays','High deadline window (days)'],['contactDays','Contact review after (days)']].map(([key,label])=>`<label>${label}<input type="number" min="${['handlingDays','transitDays'].includes(key)?0:1}" max="365" step="1" data-planning-key="${key}" value="${esc(days[key])}" required></label>`).join('')}<p>These are calendar-day planning assumptions. Changing them updates urgency and new follow-ups; existing task dates remain recorded.</p>`,wrap=>{
      const zone=wrap.querySelector('#copilot-zone').value.trim();try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format();}catch(_){throw new Error('Enter a valid IANA time zone, such as America/New_York.');}
      const logistics=Object.fromEntries([...wrap.querySelectorAll('[data-planning-key]')].map(input=>[input.dataset.planningKey,Number(input.value)]));
      if(Object.entries(logistics).some(([key,value])=>!Number.isInteger(value) || value<(['handlingDays','transitDays'].includes(key)?0:1) || value>365) || logistics.highDays<logistics.criticalDays)throw new Error('Use whole days from 0–365 for handling/transit and 1–365 for review windows. High must be at least Critical.');
      S.transaction('COPILOT_SETTINGS_UPDATED','Planning calendar and logistics',state=>{state.copilotSettings={...state.copilotSettings,timeZone:zone,logistics};});cache=null;signature='';paint();
    },'Save planning settings',{system:true});
  }
  function bindBrain() {
    const panel=document.querySelector('.mk-brain-panel');if(!panel || panel.querySelector('.mk-copilot-context'))return;
    const bar=document.createElement('section');bar.className='mk-copilot-context';bar.setAttribute('aria-label','Co-Pilot order context');
    bar.innerHTML='<div><label for="mk-copilot-order">Order context</label><select id="mk-copilot-order"><option value="">Select an order</option></select><button type="button" class="sys-btn" id="mk-copilot-open-order">Order file</button><a href="'+S.url('mk-copilot.html')+'">Co-Pilot workspace ↗</a></div><p id="mk-copilot-context-status" role="status"></p>';
    panel.querySelector('.mk-brain-state').after(bar);
    panel.querySelector('.mk-brain-title strong').textContent='MK — AI Co-Pilot';
    panel.querySelector('.mk-brain-title span').textContent='Orders · Inventory · Customers · Tasks';
    document.querySelector('.mk-brain-launcher')?.setAttribute('aria-label','Open MK AI Co-Pilot');
    panel.setAttribute('aria-label','MK AI Co-Pilot');
    bar.querySelector('select').onchange=e=>setContext({orderId:e.target.value});
    bar.querySelector('button').onclick=()=>{if(context.orderId)details(context.orderId);else window.StarkSystemUI.notice('Select an order first.');};
    for(const question of ['Review urgent orders','Can this order be fulfilled?','Show demand trend']){const button=document.createElement('button');button.type='button';button.textContent=question;button.onclick=()=>window.MKBrain.ask(question);panel.querySelector('.mk-quick-actions').prepend(button);}
    window.MKBrain?.restoreConversation?.();
  }
  function paint() {
    if(!document.body)return;readContext();bindBrain();const r=report(),state=S.getState();
    const select=document.querySelector('#mk-copilot-order');
    if(select){const value=select.value,items=state.enterprise.orders.filter(o=>!['CANCELLED','EXPIRED'].includes(o.status));const sig=items.map(o=>o.id+o.po).join('|');if(select.dataset.items!==sig){select.innerHTML='<option value="">Select an order</option>'+items.map(o=>`<option value="${esc(o.id)}">${esc(o.po)} · ${esc(state.enterprise.accounts.find(a=>a.id===o.accountId)?.name || '')}</option>`).join('');select.dataset.items=sig;}select.value=context.orderId || '';const a=r.orders.find(o=>o.orderId===context.orderId);document.querySelector('#mk-copilot-context-status').textContent=a?`${a.urgency} · ${a.allocatable?'Quantity covered':'Review supply / validation'} · ${a.followUpDate?'Follow-up '+a.followUpDate:'No follow-up date'}${context.intent?' · '+context.intent.slice(0,70):''}`:'Choose an order, or ask about urgency across all open orders.';}
    const main=document.querySelector('#system-page-content,#item-master-content,#item-details-content,#tasks-content,#mk-copilot-content,main');
    let alert=document.querySelector('#mk-copilot-alert');
    if(r.alerts.length && main){if(!alert){alert=document.createElement('aside');alert.id='mk-copilot-alert';alert.className='mk-copilot-alert';alert.setAttribute('aria-label','Proactive Co-Pilot alerts');main.prepend(alert);}const row=r.alerts.slice().sort((a,b)=>Number(b.tier==='Critical')-Number(a.tier==='Critical'))[0],text=r.alerts.length+' orders need attention. '+row.message;if(alert.dataset.text!==text){alert.dataset.text=text;alert.innerHTML='<span class="mk-copilot-tier '+row.tier.toLowerCase()+'">'+esc(row.tier)+'</span><p>'+esc(text)+'</p><a href="'+S.url('mk-copilot.html')+'">Review orders ↗</a>';}}
    else alert?.remove();
    renderWorkbench();
  }
  function renderWorkbench() {
    const host=document.querySelector('#mk-copilot-content');if(!host)return;
    const state=S.getState(),r=report(),sig=state.revision+'|'+r.capturedAt.slice(0,16)+'|'+selected;
    if(signature===sig && host.querySelector('.mk-copilot-workbench'))return;signature=sig;
    const rows=r.orders.slice().sort((a,b)=>['Critical','High','Medium','Low'].indexOf(a.urgency)-['Critical','High','Medium','Low'].indexOf(b.urgency));
    host.innerHTML=`<section class="mk-copilot-workbench"><header><span class="mk-copilot-eyebrow">MK CO-PILOT</span><h1>Every order, one operational view</h1><p>FIFO supply coverage, customer communication and follow-ups in the same order file.</p><p class="mk-copilot-muted">${esc(window.StarkSystemCloud?.getStatus().active?'Connected organization workspace. Incoming email capture requires the deployed Co-Pilot receiving connector.':'Browser workspace. Record communications here; automatic inbox capture requires an organization connection and the receiving connector.')}</p></header>
      <p><button class="sys-btn" type="button" id="copilot-planning-settings" ${window.StarkSystemCloud?.getStatus().active && !['owner','admin','manager','editor'].includes(access().role)?'disabled':''}>Planning settings</button> <span class="mk-copilot-muted">${esc(timeZone())} · ${state.copilotSettings?.logistics?.handlingDays ?? 1} handling + ${state.copilotSettings?.logistics?.transitDays ?? 3} transit days</span></p><div class="mk-copilot-stats">${['Critical','High','Medium','Low'].map(t=>`<div><strong>${rows.filter(r=>r.urgency===t).length}</strong><span>${t}</span></div>`).join('')}</div>
      <div class="mk-copilot-table-wrap"><table class="sys-table"><thead><tr><th>Order</th><th>Customer</th><th>Urgency</th><th>Contact status</th><th>Follow-up Date</th><th>Supply after FIFO</th><th>Order file</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${esc(a.po)}<small>${esc(a.region)}</small></td><td>${esc(state.enterprise.accounts.find(x=>x.id===a.accountId)?.name || '')}</td><td><span class="mk-copilot-tier ${a.urgency.toLowerCase()}">${a.urgency}</span><small>${a.reasons.map(esc).join(' ')}</small></td><td>${esc(a.contactStatus)}</td><td>${a.followUpDate || 'Not set'}</td><td>${a.allocatable?'Yes - Allocatable':'Review'}<small>${a.shortfall} units uncovered</small></td><td><button type="button" class="sys-btn" data-copilot-order="${esc(a.orderId)}">Open file</button></td></tr>`).join('') || '<tr><td colspan="7">No open customer orders in this workspace.</td></tr>'}</tbody></table></div>
      <p class="mk-copilot-muted">${esc(r.queuePolicy)} Alerts update when data changes and at least once per minute. They do not reserve stock, cancel orders or change fulfillment states.</p></section>`;
    host.querySelectorAll('[data-copilot-order]').forEach(b=>b.onclick=()=>details(b.dataset.copilotOrder));
    host.querySelector('#copilot-planning-settings').onclick=planningSettings;
  }
  function schedulePaint(){if(paintQueued)return;paintQueued=true;queueMicrotask(()=>{paintQueued=false;try{paint();}catch(error){console.error('MK Co-Pilot:',error.message);}});}
  async function refreshShared(){if(cloudBusy || !window.StarkSystemCloud?.getStatus().active || document.hidden)return;cloudBusy=true;try{await window.StarkSystemCloud.refreshCopilot?.();}catch(_){}finally{cloudBusy=false;}}
  window.MKCopilot={version:C.VERSION,getContext:()=>({...readContext()}),setContext,report,orderSummary,itemSummary,handle,remember,messages,record,details,communicationDialog,planningSettings,refresh:()=>{cache=null;paint();}};
  function initialize(){capturePage();paint();timer=setInterval(()=>{cache=null;schedulePaint();},60000);refreshTimer=setInterval(refreshShared,30000);const main=document.querySelector('main');if(main)new MutationObserver(()=>{if(!document.querySelector('#mk-copilot-alert') && report().alerts.length)schedulePaint();}).observe(main,{childList:true});}
  window.addEventListener('mk:ready',schedulePaint);
  window.addEventListener('stark:system-change',()=>{cache=null;schedulePaint();});
  for(const type of ['stark:region-change','stark:access-change'])window.addEventListener(type,()=>{cache=null;readContext();signature='';schedulePaint();});
  window.addEventListener('focus',refreshShared);
  document.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(!a)return;try{const url=new URL(a.href,location.href);if(url.origin!==location.origin)return;for(const key of ['order','orderId','search','edit']){const o=pickOrder(url.searchParams.get(key));if(o){setContext({orderId:o.id});return;}}if(url.searchParams.get('sku'))setContext({sku:url.searchParams.get('sku')});}catch(_){}});
  document.addEventListener('change',event=>{if(event.target.matches('[id^="eim-filter-"],#eim-word-search-input,#eim-sort-select'))captureInventoryParameters();});
  window.addEventListener('pagehide',()=>{captureInventoryParameters();clearInterval(timer);clearInterval(refreshTimer);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
