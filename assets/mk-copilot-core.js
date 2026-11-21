(function (root, factory) {
  'use strict';
  const api = factory();
  root.MKCopilotCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '2026.10.23.1';
  const CLOSED = new Set(['SHIPPED','DELIVERED','CANCELLED','EXPIRED','CLOSED']);
  const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const positive = v => Math.max(0,n(v));
  const validTime = v => v && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null;
  const DAY = 86400000;
  const isoDay = d => new Date(d).toISOString().slice(0,10);
  function civilDay(value, timeZone = 'America/New_York') {
    const d = new Date(value); if (!Number.isFinite(d.getTime())) throw new Error('Invalid date.');
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function dateOnly(value) {
    const text=String(value || '').slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(text)) && isoDay(Date.parse(text))===text ? text : '';
  }
  function dueTime(day, zone) {
    let guess=Date.parse(day+'T09:00:00Z');
    const expected=guess;
    for(let i=0;i<4;i++) {
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
      const shown=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`),difference=expected-shown;
      guess+=difference; if(!difference) return new Date(guess).toISOString();
    }
    throw new Error('Follow-up time could not be resolved in this time zone.');
  }
  function parseFollowUp(text, receivedAt, timeZone='America/New_York') {
    const anchor=civilDay(receivedAt,timeZone),base=Date.parse(anchor),year=Number(anchor.slice(0,4));
    // Quoted mail history is retained in the timeline but never used to schedule a new task.
    const body=String(text || '').split(/\n\s*(?:On .{1,180}wrote:|From:\s|[-_]{3,}\s*(?:Original Message|Forwarded message))/i)[0].split('\n').filter(l=>!/^\s*>/.test(l)).join('\n');
    const candidates=[],weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    function add(date,match,index) {
      if(!dateOnly(date)) return;
      const before=body.slice(Math.max(0,index-30),index).toLowerCase();
      const negated=/\b(?:not|except|unavailable|cannot|can't|don't|do not)\s*(?:(?:call|contact|follow[ -]?up|meet|speak|deliver|ship|on|until|before)\s*){0,3}$/.test(before);
      candidates.push({date,text:match,index,negated,explicit:/\b(call|contact|follow[ -]?up|check[ -]?back|reach|remind|speak)\b[^.!?\n]{0,60}$/i.test(before)});
    }
    const reserved=[];
    for(const m of body.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)){add(m[1],m[0],m.index);reserved.push([m.index,m.index+m[0].length]);}
    const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    for(const m of body.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/gi)) {
      let y=m[3]?Number(m[3]):year; const mon=months[m[1].slice(0,3).toLowerCase()],day=Number(m[2]);
      let value=Date.UTC(y,mon,day);if(!m[3] && value<base) value=Date.UTC(++y,mon,day);
      if(new Date(value).getUTCMonth()===mon && new Date(value).getUTCDate()===day)add(isoDay(value),m[0],m.index);
    }
    for(const m of body.matchAll(/\b(today|tomorrow|next\s+week|(?:(?:next|this|last)\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))\b/gi)) {
      if(reserved.some(([a,b])=>m.index>=a && m.index<b))continue;
      const t=m[0].toLowerCase();let offset=0;
      if(t==='tomorrow')offset=1;
      else if(t==='next week')offset=7;
      else if(t!=='today') {
        const weekday=weekdays.findIndex(w=>t.endsWith(w));
        offset=t.startsWith('this ')?((weekday+6)%7-(new Date(base).getUTCDay()+6)%7):(weekday-new Date(base).getUTCDay()+7)%7;
        if(t.startsWith('last '))offset=offset ? offset-7:-7;
        // "Next Thursday" means the next occurrence, never the current day.
        if(!offset && !t.startsWith('this '))offset=7;
      }
      add(isoDay(base+offset*DAY),m[0],m.index);
    }
    let eligible=candidates.filter(c=>!c.negated);
    if(eligible.some(c=>c.explicit))eligible=eligible.filter(c=>c.explicit);
    const dates=[...new Set(eligible.map(c=>c.date))];
    if(dates.length===1 && !(candidates.some(c=>c.negated && c.date===dates[0])))return {status:'resolved',date:dates[0],dueAt:dueTime(dates[0],timeZone),timeZone,anchorDate:anchor,phrases:eligible.filter(c=>c.date===dates[0]).map(c=>c.text)};
    if(candidates.length || /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(body))return {status:'needs_review',date:'',timeZone,anchorDate:anchor,reason:'Multiple, excluded or ambiguous dates need review.',candidates};
    return {status:'none',date:'',timeZone,anchorDate:anchor};
  }
  function intent(text) {
    const t=String(text || '').split(/\n\s*(?:On .{1,180}wrote:|From:\s)/i)[0].toLowerCase();
    if(/\b(cancel|cancellation|do not ship|don't ship)\b/.test(t))return 'Cancellation request — authorization required';
    if(/\b(damaged|broken|wrong item|missing|short shipment)\b/.test(t))return 'Order issue';
    if(/\b(expedite|urgent|asap|rush)\b/.test(t))return 'Expedite request';
    if(/\b(change|update|different|increase|decrease)\b/.test(t))return 'Change request';
    if(/\b(call|follow[ -]?up|check back|contact|next |tomorrow)\b/.test(t))return 'Follow-up requested';
    if(/\b(confirm|confirmed|confirmation|approve|approved|agree|go ahead|yes)\b/.test(t) && !/\b(not|never|don't|do not)\s+(confirm|confirmed|approve|approved|agree)\b/.test(t))return 'Confirmation';
    if(/\b(where|when|eta|tracking|status|deliver|delivery|arrive|arrival)\b/.test(t))return 'Status enquiry';
    return 'Customer response — review';
  }
  function remaining(order,line) {
    return order.type==='HOLD_PO' ? Math.max(0,n(line.allocated ?? line.qty)-n(line.redeemed)) : Math.max(0,n(line.qty)-n(line.shipped)-n(line.cancelledQty));
  }
  const validated = o => !o.validation || o.validation.state==='VALIDATED';
  const channel = o => o.fulfillment?.kind==='DROPSHIP' || o.supplyMode==='DROPSHIP' ? 'DROPSHIP' : o.fulfillment?.kind==='3PL' ? '3PL:'+String(o.fulfillment.nodeId || o.fulfillment.partnerId || 'UNKNOWN') : 'WAREHOUSE';
  function analyze(state, options={}) {
    const e=state.enterprise || {},now=options.now || new Date().toISOString(),timeZone=options.timeZone || 'America/New_York',today=civilDay(now,timeZone);
    const logistics={handlingDays:1,transitDays:3,criticalDays:7,highDays:14,contactDays:3,...state.copilotSettings?.logistics,...options.logistics};
    for(const k of Object.keys(logistics))logistics[k]=Math.min(365,positive(logistics[k]));
    const inventory=new Map((e.inventory || []).map(i=>[i.sku,i])),orders=(e.orders || []).filter(o=>!CLOSED.has(o.status));
    const assessments=new Map(orders.map(o=>[o.id,{orderId:o.id,po:o.po,region:o.region || inventory.get(o.lines?.[0]?.sku)?.region || 'US',accountId:o.accountId,lines:[],dataWarnings:[]}])) ,pools=new Map();
    const sorted=orders.slice().sort((a,b)=>(validTime(a.createdAt) ?? -Infinity)-(validTime(b.createdAt) ?? -Infinity) || String(a.id).localeCompare(String(b.id)));
    const globalDemand={};for(const o of orders)for(const l of o.lines || [])globalDemand[l.sku]=(globalDemand[l.sku] || 0)+remaining(o,l);
    for(const o of sorted)for(const l of o.lines || []) {
      const item=inventory.get(l.sku),kind=item?.nature==='DIGITAL'?'DIGITAL':channel(o),region=item?.region || o.region || 'US',key=region+'|'+kind+'|'+l.sku;
      if(!pools.has(key))pools.set(key,{item,sku:l.sku,kind,region,rows:[]});
      pools.get(key).rows.push({order:o,line:l,quantity:remaining(o,l)});
    }
    for(const pool of pools.values()) {
      const {item,sku,kind,region}=pool;
      let free=0,securedBudget=0;
      if(item && kind==='WAREHOUSE') {
        free=Math.max(0,n(item.onHand)-n(item.damaged)-n(item.reserved));
        securedBudget=Math.max(0,Math.min(n(item.reserved),n(item.onHand)-n(item.damaged)-n(item.externalReserved)));
      } else if(kind.startsWith('3PL:')) {
        const node=kind.slice(4),rows=(state.logistics?.tplInventory || []).filter(i=>i.sku===sku && i.nodeId===node);
        free=rows.reduce((s,i)=>s+Math.max(0,n(i.onHand ?? i.qty)-n(i.reserved)-n(i.damaged)),0);
        securedBudget=rows.reduce((s,i)=>s+Math.min(positive(i.reserved),Math.max(0,n(i.onHand ?? i.qty)-n(i.damaged))),0);
      } else if(kind==='DIGITAL') {
        free=(e.vaultTokens || []).filter(t=>t.sku===sku && t.state==='AVAILABLE').length;
      }
      const lots=[];
      for(const po of e.purchaseOrders || []) {
        if(['CANCELLED','CLOSED','RECEIVED','REJECTED','VOID'].includes(po.status) || kind==='DIGITAL')continue;
        const dedicated=po.customerOrderId || po.orderId || po.linkedOrderId || '';
        if(kind==='DROPSHIP' && (po.purpose!=='DROPSHIP' || !dedicated))continue;
        if(kind!=='DROPSHIP' && po.purpose==='DROPSHIP')continue;
        if(kind.startsWith('3PL:') && po.nodeId!==kind.slice(4))continue;
        if(kind==='WAREHOUSE' && po.nodeId)continue;
        for(const line of po.lines || []) {
          if(line.sku!==sku || (po.region && po.region!==region))continue;
          const qty=Math.max(0,n(line.qty)-n(line.received)-n(line.cancelledQty));if(!qty)continue;
          const eta=dateOnly(line.eta || po.eta),original=dateOnly(po.originalEta || po.previousEta);
          lots.push({id:po.id,po:po.po,qty,left:qty,eta,originalEta:original,delayDays:eta && original?Math.max(0,(Date.parse(eta)-Date.parse(original))/DAY):0,dedicated:kind==='DROPSHIP'?dedicated:''});
        }
      }
      lots.sort((a,b)=>(a.eta?Date.parse(a.eta):Infinity)-(b.eta?Date.parse(b.eta):Infinity) || String(a.id).localeCompare(String(b.id)));
      let prior=0,index=0;
      for(const row of pool.rows) {
        const {order,line,quantity}=row,result=assessments.get(order.id);
        const requested=validated(order)?Math.min(quantity,positive(line.allocated)):0;
        const secured=kind==='DIGITAL'?Math.min(quantity,(e.vaultTokens || []).filter(t=>t.sku===sku && t.orderId===order.id && ['ALLOCATED','RESERVED'].includes(t.state)).length):Math.min(requested,securedBudget);securedBudget-=Math.min(secured,securedBudget);
        row.secured=secured;
        if(!validTime(order.createdAt))result.dataWarnings.push('Missing order timestamp: conservatively placed before dated demand.');
      }
      for(const row of pool.rows) {
        const {order,quantity}=row,result=assessments.get(order.id),secured=row.secured;
        const fromFree=Math.min(free,Math.max(0,quantity-secured));free-=fromFree;
        let needed=Math.max(0,quantity-secured-fromFree),fromPO=0;const allocatedLots=[];
        const matching=lots.filter(l=>!l.dedicated || l.dedicated===order.id),openPOQuantity=matching.reduce((s,l)=>s+l.qty,0);
        for(const lot of matching) {
          const take=Math.min(needed,lot.left);if(!take)continue;
          needed-=take;lot.left-=take;fromPO+=take;allocatedLots.push({...lot,quantity:take});
        }
        const allocatable=needed===0 && !!item && validated(order);
        result.lines.push({sku,model:item?.model || row.line.model || sku,region,channel:kind,quantity,globalOpenDemand:globalDemand[sku],queuePosition:++index,priorQueueQuantity:prior,securedQuantity:secured,onHandQuantity:secured+fromFree,openPOQuantity,fromPOQuantity:fromPO,shortfall:needed,allocatable,
          fulfillmentStatus:!item?'No - Unknown inventory item':!validated(order)?'No - Order validation required':allocatable?'Yes - Allocatable':kind==='DIGITAL'?'No - Insufficient available vault tokens':'No - Insufficient PO stock across queue',
          poLots:matching.map(l=>({po:l.po,id:l.id,quantity:l.qty,eta:l.eta,delayDays:l.delayDays})),allocatedLots:allocatedLots.map(({id,po,eta,quantity,delayDays})=>({id,po,eta,quantity,delayDays})),
          arrivalDate:allocatedLots.every(l=>l.eta)?allocatedLots.map(l=>l.eta).sort().at(-1) || today:'',
          etaUnknown:allocatedLots.some(l=>!l.eta),overduePO:allocatedLots.some(l=>l.eta && l.eta<today)});
        prior+=quantity;
      }
    }
    const alerts=[];
    for(const order of orders) {
      const a=assessments.get(order.id),deadline=dateOnly(order.inHandsDate),days=deadline?(Date.parse(deadline)-Date.parse(today))/DAY:null;
      const follow=dateOnly(order.followUpDate),contact=validTime(order.lastContactAt || order.communication?.lastContactAt),created=validTime(order.createdAt);
      const contactAge=contact===null?(created===null?null:Math.max(0,Math.floor((Date.parse(today)-Date.parse(civilDay(created,timeZone)))/DAY))):Math.max(0,Math.floor((Date.parse(today)-Date.parse(civilDay(contact,timeZone)))/DAY));
      const followOverdue=!!follow && follow<today && !(state.tasks || []).some(t=>t.orderId===order.id && t.followUpDate===follow && t.status==='DONE');
      const shortfall=a.lines.reduce((s,l)=>s+l.shortfall,0),depends=a.lines.some(l=>l.fromPOQuantity>0),unknown=a.lines.some(l=>l.etaUnknown),late=a.lines.some(l=>l.overduePO);
      const arrival=a.lines.map(l=>l.arrivalDate).filter(Boolean).sort().at(-1) || today;
      const delivery=isoDay(Date.parse(arrival)+(logistics.handlingDays+logistics.transitDays)*DAY);
      let tier='Low';const reasons=[];const promote=(value,reason)=>{if(['Low','Medium','High','Critical'].indexOf(value)>['Low','Medium','High','Critical'].indexOf(tier))tier=value;reasons.push(reason);};
      if(days!==null && days<0)promote('Critical','The in-hands date has passed and the order is still open.');
      if(days!==null && days<=logistics.criticalDays && (shortfall>0 || unknown || late || delivery>deadline))promote('Critical',`In-hands in ${days} days; ${shortfall?shortfall+' units remain uncovered after the FIFO queue':unknown?'a required PO has no confirmed ETA':late?'a required PO ETA is overdue':'supply plus the logistics buffer misses the deadline'}.`);
      else if(days!==null && days<=logistics.highDays && (shortfall>0 || depends || delivery>deadline))promote('High','The approaching in-hands date depends on constrained or incoming supply.');
      else if(shortfall>0 || unknown || late)promote('High',shortfall?'Incoming supply cannot cover all prior queue commitments.':unknown?'A required vendor PO has no confirmed ETA.':'A required vendor PO ETA is overdue.');
      else if(depends)promote('Medium','Fulfillment depends on an incoming vendor PO.');
      const delayed=[...new Map(a.lines.flatMap(l=>l.poLots).filter(p=>p.delayDays>0).map(p=>[p.id,p])).values()];
      if(delayed.length && (depends || shortfall>0))promote('Medium',delayed.map(p=>`Vendor PO ${p.po || p.id} was delayed by ${p.delayDays} day(s); its recorded ETA is ${p.eta}.`).join(' '));
      if(followOverdue)promote(days!==null && days<=7?'High':'Medium','The promised follow-up date has passed.');
      if(contactAge!==null && contactAge>=7)promote('High',`${contactAge} days have elapsed without recorded team contact.`);
      else if(contactAge!==null && contactAge>=logistics.contactDays)promote('Medium',`${contactAge} days have elapsed without recorded team contact.`);
      if(!reasons.length)reasons.push(deadline?'Supply and recorded communication are within the planning thresholds.':'No in-hands date is set; no deadline was invented.');
      Object.assign(a,{urgency:tier,reasons,deadline,daysToDeadline:days,followUpDate:follow,followUpOverdue:followOverdue,daysSinceContact:contactAge,shortfall,allocatable:a.lines.length>0 && a.lines.every(l=>l.allocatable),estimatedDeliveryDate:unknown || shortfall || late?'':delivery,assumptions:[`${logistics.handlingDays} handling day(s) + ${logistics.transitDays} transit day(s); calendar-day planning, not a carrier guarantee.`],contactStatus:order.contactStatus || 'Not contacted'});
      if(['Critical','High'].includes(tier))alerts.push({id:order.id,orderId:order.id,po:order.po,region:a.region,tier,message:`Order #${order.po}: ${reasons.join(' ')} Recommend ${shortfall?'alternative stock or supplier expediting':depends?'confirming the supplier ETA and expediting if needed':'reviewing the order and contacting the customer'}.`});
    }
    return {version:VERSION,capturedAt:now,timeZone,orders:[...assessments.values()],alerts,queuePolicy:'FIFO across all open customer orders for each regional SKU and fulfillment channel. Existing reservations and dedicated dropship POs are protected.'};
  }
  function demandSeries(state, sku, now=new Date().toISOString(),timeZone='America/New_York') {
    const today=Date.parse(civilDay(now,timeZone)),rows=(state.enterprise?.orders || []).filter(o=>!['CANCELLED','EXPIRED'].includes(o.status) && validTime(o.createdAt)!==null && (o.lines || []).some(l=>l.sku===sku));
    if(!rows.length)return {sku,days:[],observedDays:0,status:'Insufficient order history',basis:'Recorded customer-order demand, not shipped sales.'};
    const first=Math.min(...rows.map(o=>Date.parse(civilDay(o.createdAt,timeZone)))),start=Math.max(first,today-90*DAY),days=[];
    for(let t=start;t<today;t+=DAY)days.push({date:isoDay(t),units:0});
    const bins=new Map(days.map(d=>[d.date,d]));for(const order of rows){const bin=bins.get(civilDay(order.createdAt,timeZone));if(bin)bin.units+=order.lines.filter(l=>l.sku===sku).reduce((s,l)=>s+positive(l.qty),0);}
    const last7=days.slice(-7).reduce((s,d)=>s+d.units,0),previous7=days.slice(-14,-7).reduce((s,d)=>s+d.units,0);
    return {sku,days,observedDays:days.length,last7,previous7,changePercent:days.length>=14 && previous7>0?100*(last7-previous7)/previous7:null,status:days.length>=14?'Observed order-demand trend':'Insufficient completed-day history for a trend',basis:'Recorded customer-order demand. Today is excluded; missing earlier history is not backfilled as zero.'};
  }
  function applyCommunication(state,event,options={}) {
    const order=state.enterprise?.orders?.find(o=>o.id===event.orderId);if(!order)throw new Error('Order not found.');
    if(!event.id || typeof event.id!=='string' || event.id.length>200)throw new Error('A stable message ID is required.');
    if(!['INBOUND','OUTBOUND'].includes(event.direction))throw new Error('Choose an incoming response or confirmed outreach.');
    if(event.direction==='OUTBOUND' && event.confirmedSent!==true)throw new Error('Drafts do not mark a customer as contacted. Confirm the message was sent.');
    if(typeof event.text!=='string' || !event.text.trim() || event.text.length>10000 || /\u0000/.test(event.text))throw new Error('Message text must contain 1–10,000 characters.');
    if(validTime(event.occurredAt)===null || Date.parse(event.occurredAt)>Date.parse(options.now || new Date().toISOString())+5*60000)throw new Error('Use a valid message time.');
    const existing=(order.communicationLog || []).find(m=>m.id===event.id);if(existing)return {duplicate:true,message:existing,task:null};
    if((order.communicationLog || []).length>=1000)throw new Error('This order has 1,000 messages. Archive the order before adding more.');
    const timeZone=options.timeZone || state.copilotSettings?.timeZone || 'America/New_York',received=event.direction==='INBOUND';
    const parsed=received?parseFollowUp(event.text,event.occurredAt,timeZone):{status:'none',date:''};
    if(received && parsed.status==='resolved' && (state.tasks || []).length>=10000 && !(state.tasks || []).some(t=>t.id==='MK-FU-'+event.id))throw new Error('Task limit reached; this message has not been committed.');
    const message={id:event.id,direction:event.direction,text:event.text,subject:String(event.subject || '').slice(0,200),occurredAt:new Date(event.occurredAt).toISOString(),recordedAt:options.now || new Date().toISOString(),source:options.source || 'manual',verified:options.verified===true,actor:options.actor || 'local',intent:received?intent(event.text):'Internal outreach',followUp:parsed};
    order.communicationLog ||= [];order.communicationLog.push(message);
    order.communicationLog.sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
    const latest=order.communicationLog.at(-1);order.contactStatus=latest.direction==='INBOUND'?'Responded':'Contacted';
    if(!received)order.lastContactAt=order.communicationLog.filter(m=>m.direction==='OUTBOUND').at(-1).occurredAt;
    else order.lastResponseAt=order.communicationLog.filter(m=>m.direction==='INBOUND').at(-1).occurredAt;
    let task=null;
    if(received && parsed.status==='resolved' && order.lastResponseAt===message.occurredAt && !CLOSED.has(order.status)) {
      if(!order.followUpLocked){order.followUpDate=parsed.date;order.followUpSource='copilot';order.followUpMessageId=event.id;}
      const id='MK-FU-'+event.id;state.tasks ||= [];
      if(!state.tasks.some(t=>t.id===id)) {
        if(state.tasks.length>=10000)throw new Error('Task limit reached; this message has not been committed.');
        task={id,title:('Follow up: Order #'+order.po).slice(0,160),notes:`Customer response:\n${event.text}\n\nFollow-up phrase: ${parsed.phrases.join(', ')}. Time zone: ${timeZone}.`,orderId:order.id,followUpDate:parsed.date,messageId:event.id,source:'mk-copilot',status:'OPEN',priority:'HIGH',comments:[],ownerUserId:options.ownerUserId || options.actor || 'local',createdBy:options.actor || 'local',createdAt:message.recordedAt,updatedAt:message.recordedAt,dueAt:parsed.dueAt,reminderAt:parsed.dueAt,version:1,completedAt:''};state.tasks.push(task);
      }
    }
    const account=state.enterprise.accounts.find(a=>a.id===order.accountId);
    if(account && (!account.lastCommunicationAt || account.lastCommunicationAt<=message.occurredAt)){account.contactStatus=message.direction==='OUTBOUND'?'Contacted':'Responded';account.lastCommunicationAt=message.occurredAt;}
    return {duplicate:false,message,task,orderId:order.id,followUp:parsed};
  }

  // ---- Task Reference Analysis, Priority Ordering & Autonomous Mail/Inventory Reconciliation ----
  const DEFAULT_TEAM_ROSTER = [
    { id: 'usr_manoj', name: 'Manoj Manne', email: 'supply.chain@mk97.com', role: 'Supply Chain Director', avatar: 'MM', color: '#087f78' },
    { id: 'usr_elena', name: 'Elena Rostova', email: 'elena.rostova@mk97.com', role: 'Procurement Lead', avatar: 'ER', color: '#2563eb' },
    { id: 'usr_marcus', name: 'Marcus Vance', email: 'marcus.vance@mk97.com', role: 'Logistics & 3PL Manager', avatar: 'MV', color: '#7c3aed' },
    { id: 'usr_sarah', name: 'Sarah Jenkins', email: 'sarah.jenkins@mk97.com', role: 'Order Operations Lead', avatar: 'SJ', color: '#d97706' },
    { id: 'usr_david', name: 'David Kim', email: 'david.kim@mk97.com', role: 'Inventory & Planning Analyst', avatar: 'DK', color: '#0284c7' },
    { id: 'usr_priya', name: 'Priya Nair', email: 'priya.nair@mk97.com', role: 'Carrier & Dispatch Coordinator', avatar: 'PN', color: '#059669' }
  ];

  const NON_TRACKING_WORDS = new Set(['PENDING','NEEDED','REQUEST','REQUESTED','NUMBER','UPDATE','PROCESSING','DISPATCH','UNKNOWN','AVAILABLE','REQUIRED','CONFIRM','CONFIRMED','DELIVERED','SHIPPED','TRANSIT','DELAYED','READY','AUDIT','DAILY','CHECK','COMPLETED','PRIORITY','TRACKING','ORDER','ORDERS','VENDOR','CONSIGNMENT']);
  const escRegex = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normToken = s => String(s || '').trim().toUpperCase().replace(/^#+/, '');

  function extractTrackingNumber(text) {
    const raw = String(text || '');
    if (!raw.trim()) return '';
    const patterns = [
      /\b(1Z[A-Z0-9]{8,20})\b/i,
      /\b(DHL[-]?[A-Z0-9]{6,16})\b/i,
      /\b((?:TRK|FDX|ARX|AWB|LL-FRT)[-]?[A-Z0-9-]{4,20})\b/i,
      /\b(?:ups|fedex|dhl|usps|aramex|carrier)\s*(?:#|tracking(?:\s*(?:number|no\.?|#))?)?\s*[:=]?\s*([A-Z0-9][A-Z0-9-]{5,24})\b/i,
      /\btracking(?:\s*(?:number|no\.?|#|id|code))?\s*(?:is|:|=|#|-)?\s*([A-Z0-9][A-Z0-9-]{5,24})\b/i
    ];
    for (const re of patterns) {
      const m = raw.match(re);
      if (!m || !m[1]) continue;
      const cand = m[1].trim().replace(/[.,;:!?)]+$/, '');
      const upper = cand.toUpperCase();
      if (NON_TRACKING_WORDS.has(upper)) continue;
      if (/^(PO-|ORD-|SO-|3PL-|VI-|RPT-|INV-|CC_|WAVE-)/i.test(upper)) continue;
      const digits = (upper.match(/\d/g) || []).length;
      if (digits < 3) continue;
      return cand;
    }
    return '';
  }

  function tokenInText(haystack, token) {
    const t = String(token || '').trim();
    if (!t || t.length < 3) return false;
    const re = new RegExp('(^|[^A-Za-z0-9])' + escRegex(t) + '($|[^A-Za-z0-9])', 'i');
    return re.test(haystack);
  }

  function extractTaskReferences(task, state, mailThreads = []) {
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    const userComments = Array.isArray(task?.comments)
      ? task.comments.filter(c => c && !['Task Reminder', 'MK Co-Pilot'].includes(c.author)).slice(-5).map(c => c.text || '')
      : [];
    const hay = [
      task?.title || '',
      task?.notes || '',
      task?.sourceKey || '',
      task?.autoRef || '',
      task?.orderId || '',
      ...userComments
    ].join('\n');

    const signals = {
      isEscalation: /\b(escalat\w*|urgent|critical|asap|emergency|executive|vip|sla\s*breach|complaint|ceo|blocked|blocker|hold\s*release|dispute|chargeback|high\s*priority)\b/i.test(hay),
      isTrackingRequest: /\b(tracking\s*(?:number|#|no\.?|request|info|details|update)?|provide\s+(?:the\s+)?tracking|need\s+tracking|send\s+tracking|share\s+tracking|awb|waybill|consignment)\b/i.test(hay),
      isProcurementNeed: /\b(vendor\s*po|place\s*(?:a\s*)?(?:vendor\s*)?po|reorder|replenish\w*|low\s*stock|stockout|safety\s*stock|purchase\s*order|restock)\b/i.test(hay),
      isShortageOrDelay: /\b(shortage|shortfall|backorder|delay\w*|late|missed|overdue|variance|damaged|exception|discrepanc\w*)\b/i.test(hay)
    };

    const matchedOrders = [];
    const seenOrders = new Set();
    for (const o of e.orders || []) {
      const candidates = [o.id, o.po, o.orderNumber].filter(Boolean);
      const basePo = String(o.po || '').replace(/-(HOLD|R\d+)$/i, '');
      if (basePo && basePo.length >= 5) candidates.push(basePo);
      const hit = (task?.orderId && task.orderId === o.id) || candidates.some(c => tokenInText(hay, c));
      if (hit && !seenOrders.has(o.id)) { seenOrders.add(o.id); matchedOrders.push(o); }
    }

    const matchedPOs = [];
    const seenPOs = new Set();
    for (const p of e.purchaseOrders || []) {
      const numMatch = String(p.po || '').match(/(\d{5,})/);
      const numSuffix = numMatch ? numMatch[1] : '';
      const hit = tokenInText(hay, p.po) || tokenInText(hay, p.id) || (numSuffix && new RegExp('(?:po\\s*#?\\s*|#)' + escRegex(numSuffix) + '\\b', 'i').test(hay));
      if (hit && !seenPOs.has(p.id)) { seenPOs.add(p.id); matchedPOs.push(p); }
    }

    const matchedSkus = [];
    const seenSkus = new Set();
    const addSku = item => { if (item && !seenSkus.has(item.sku)) { seenSkus.add(item.sku); matchedSkus.push(item); } };
    for (const item of e.inventory || []) {
      const direct = tokenInText(hay, item.sku) || (item.model && item.model.length >= 4 && tokenInText(hay, item.model)) || (task?.autoEntityId && task.autoEntityId === item.sku);
      if (direct) addSku(item);
    }

    // Cross-link SKUs mentioned by matched POs and Orders
    const invMap = new Map((e.inventory || []).map(i => [i.sku, i]));
    const relatedSkus = new Set([...seenSkus]);
    for (const p of matchedPOs) for (const line of p.lines || []) if (invMap.has(line.sku)) relatedSkus.add(line.sku);
    for (const o of matchedOrders) for (const line of o.lines || []) if (invMap.has(line.sku)) relatedSkus.add(line.sku);

    // Cross-link Receipts & Putaway
    const matchedReceipts = [];
    const seenReceipts = new Set();
    for (const r of l.receipts || []) {
      const hit = tokenInText(hay, r.id) || tokenInText(hay, r.po) || tokenInText(hay, r.asn) || tokenInText(hay, r.invoice) || matchedPOs.some(p => normToken(p.po) === normToken(r.po));
      if (hit && !seenReceipts.has(r.id)) { seenReceipts.add(r.id); matchedReceipts.push(r); }
    }

    const matchedPutaway = (l.putaway || []).filter(pw => pw.status !== 'DONE' && (matchedReceipts.some(r => r.id === pw.receiptId) || seenSkus.has(pw.sku)));

    // Cross-link Cycle Counts
    const matchedCycleCounts = (l.cycleCounts || []).filter(cc =>
      tokenInText(hay, cc.id) || (cc.status === 'VARIANCE' && relatedSkus.has(cc.sku))
    );

    // Cross-link 3PL Shipments
    const matchedTplShipments = (l.tplShipments || []).filter(shp =>
      tokenInText(hay, shp.id) || tokenInText(hay, shp.orderId) || (task?.autoEntityId && task.autoEntityId === shp.id) || (shp.status === 'DELAYED' && seenSkus.has(shp.sku))
    );

    // Cross-link Reconciliations & Invoice Reviews & Returns
    const matchedReconciliations = (l.reconciliations || []).filter(rec => rec.status !== 'RESOLVED' && seenSkus.has(rec.sku));
    const matchedInvoices = (state?.invoiceReviews || []).filter(inv =>
      tokenInText(hay, inv.number) || tokenInText(hay, inv.poReference) || matchedPOs.some(p => p.id === inv.poId)
    );
    const matchedReturns = (state?.customerReturns || []).filter(ret =>
      tokenInText(hay, ret.id) || tokenInText(hay, ret.orderRef) || matchedOrders.some(o => normToken(o.po) === normToken(ret.orderRef))
    );

    // Downstream open customer orders impacted by matched Vendor POs
    const impactedOrders = [];
    if (matchedPOs.length) {
      const poSkus = new Set(matchedPOs.flatMap(p => (p.lines || []).map(ln => ln.sku)));
      for (const o of e.orders || []) {
        if (CLOSED.has(o.status) || seenOrders.has(o.id)) continue;
        if ((o.lines || []).some(ln => poSkus.has(ln.sku))) impactedOrders.push(o);
      }
    }

    // Match Mail Threads (prefer primary/inbound threads & deduplicate by reference code)
    const matchedMails = [];
    const seenMails = new Set();
    const seenMailRefs = new Set();
    const orderedMails = [...(mailThreads || [])].sort((a, b) => Number(a.direction === 'outbound' || a.folder === 'sent') - Number(b.direction === 'outbound' || b.folder === 'sent'));
    for (const t of orderedMails) {
      const poRef = normToken(t.related?.poNumber || t.shipmentDetails?.poNumber || '');
      const hit = (task?.linkedMailId && task.linkedMailId === t.id) ||
        (task?.autoEntityId && task.autoEntityId === t.id) ||
        (poRef && poRef.length >= 4 && tokenInText(hay, poRef)) ||
        (t.related?.poNumber && tokenInText(hay, t.related.poNumber));
      if (!hit || seenMails.has(t.id)) continue;
      if (poRef && seenMailRefs.has(poRef) && t.id !== task?.linkedMailId) continue;
      seenMails.add(t.id);
      if (poRef) seenMailRefs.add(poRef);
      matchedMails.push(t);
    }

    // Match Vendors & Accounts directly named
    const matchedVendors = (e.vendors || []).filter(v =>
      (v.name && v.name.length >= 4 && tokenInText(hay, v.name)) || matchedPOs.some(p => p.vendorId === v.id)
    );
    const matchedAccounts = (e.accounts || []).filter(a =>
      (a.name && a.name.length >= 5 && tokenInText(hay, a.name)) || matchedOrders.some(o => o.accountId === a.id)
    );

    return {
      signals,
      matchedOrders,
      impactedOrders,
      matchedPOs,
      matchedSkus,
      matchedReceipts,
      matchedPutaway,
      matchedCycleCounts,
      matchedTplShipments,
      matchedReconciliations,
      matchedInvoices,
      matchedReturns,
      matchedMails,
      matchedVendors,
      matchedAccounts
    };
  }

  function analyzeTaskImportance(task, state, options = {}) {
    const nowIso = options.now || new Date().toISOString();
    const nowMs = Date.parse(nowIso);
    const timeZone = options.timeZone || state?.copilotSettings?.timeZone || 'America/New_York';
    const today = civilDay(nowIso, timeZone);
    const copilotReport = options.copilotReport || analyze(state || { enterprise: {}, logistics: {} }, { now: nowIso, timeZone });
    const mailThreads = options.mailThreads || [];
    const e = state?.enterprise || {};

    const extracted = extractTaskReferences(task, state, mailThreads);
    const { signals } = extracted;

    let score = 18;
    const reasons = [];
    const references = [];
    const addRef = ref => {
      if (!references.some(r => r.type === ref.type && r.id === ref.id)) references.push(ref);
    };

    // 1. Semantic / Operational Signals
    if (signals.isEscalation) {
      score += 24;
      reasons.push('Escalation / urgent operational flag detected in task subject or notes.');
    }
    if (signals.isShortageOrDelay) {
      score += 11;
      reasons.push('Shortage, delay, or variance risk detected.');
    }
    if (signals.isTrackingRequest) {
      score += 11;
      reasons.push('Active tracking request requires timely dispatch confirmation.');
    }
    if (signals.isProcurementNeed) {
      score += 9;
    }

    // 2. Due Date / Overdue Urgency
    const dueMs = validTime(task?.dueAt);
    if (dueMs !== null) {
      const hoursLeft = (dueMs - nowMs) / 3600000;
      if (hoursLeft < 0) {
        score += 22;
        reasons.push(`Task is overdue by ${Math.max(1, Math.round(Math.abs(hoursLeft)))} hour(s).`);
      } else if (hoursLeft <= 24) {
        score += 12;
        reasons.push(`Due within ${Math.max(1, Math.round(hoursLeft))} hour(s).`);
      } else if (hoursLeft <= 72) {
        score += 7;
        reasons.push('Due within the next 3 days.');
      } else if (hoursLeft <= 168) {
        score += 3;
      }
    }

    // 3. Explicit Priority Hint & Multi-Person Team Coordination
    if (task?.priority === 'CRITICAL') score += 12;
    else if (task?.priority === 'HIGH') score += 7;
    else if (task?.priority === 'LOW') score -= 8;

    const assigneeCount = Array.isArray(task?.assignees) ? task.assignees.length : 0;
    if (assigneeCount >= 2) {
      score += 4;
      reasons.push(`Cross-team coordination task involving ${assigneeCount} people.`);
    }

    // 4. Deep Analysis of Matched Customer Orders
    const assessmentById = new Map((copilotReport.orders || []).map(a => [a.orderId, a]));
    const acctById = new Map((e.accounts || []).map(a => [a.id, a]));
    for (const order of extracted.matchedOrders) {
      const assess = assessmentById.get(order.id);
      const acct = acctById.get(order.accountId);
      const orderVal = (order.lines || []).reduce((sum, ln) => sum + positive(ln.qty) * positive(ln.price), 0);
      const code = order.po || order.orderNumber || order.id;
      const isOpen = !CLOSED.has(order.status);

      if (assess) {
        if (assess.urgency === 'Critical') { score += 32; reasons.push(`Linked Order #${code} is rated CRITICAL by MK Co-Pilot (${assess.reasons[0] || 'deadline at risk'}).`); }
        else if (assess.urgency === 'High') { score += 22; reasons.push(`Linked Order #${code} is HIGH urgency (${assess.reasons[0] || 'supply constrained'}).`); }
        else if (assess.urgency === 'Medium') { score += 13; reasons.push(`Linked Order #${code} is MEDIUM urgency (${order.status}).`); }
        else { score += 8; reasons.push(`Linked open Order #${code} (${order.status}${acct ? ' · ' + acct.name : ''}).`); }
        if (assess.shortfall > 0) {
          score += 15;
          reasons.push(`Order #${code} has ${assess.shortfall} uncovered shortfall unit(s) in the FIFO queue.`);
        }
      } else if (isOpen) {
        score += 12;
        reasons.push(`Linked open Order #${code} (${order.status}).`);
      }

      if (isOpen && ['PICKING', 'PACKING'].includes(order.status) && !extractTrackingNumber(order.tracking)) {
        score += 10;
        reasons.push(`Order #${code} is in ${order.status} stage without carrier tracking assigned.`);
      }
      if (acct?.status === 'REVIEW') {
        score += 8;
        reasons.push(`Customer account ${acct.name} is under credit REVIEW.`);
      }
      if (orderVal >= 10000) {
        score += 6;
        reasons.push(`High-value order exposure ($${Math.round(orderVal).toLocaleString()}).`);
      }

      addRef({
        type: 'ORDER',
        id: order.id,
        code: '#' + code,
        label: `Order #${code}${acct ? ' · ' + acct.name : ''}`,
        path: 'all-open-orders.html?search=' + encodeURIComponent(code),
        status: order.status,
        severity: assess?.urgency === 'Critical' ? 'critical' : assess?.urgency === 'High' ? 'high' : 'normal',
        detail: `${order.status}${order.inHandsDate ? ' · In-hands ' + order.inHandsDate : ''}${orderVal ? ' · $' + Math.round(orderVal).toLocaleString() : ''}${order.tracking ? ' · Trk ' + order.tracking : ' · No tracking'}`
      });
    }

    // 5. Deep Analysis of Matched Vendor Purchase Orders
    const vendorById = new Map((e.vendors || []).map(v => [v.id, v]));
    const slaByVendor = new Map((e.slaLogs || []).map(s => [s.vendorId, s]));
    for (const po of extracted.matchedPOs) {
      const vendor = vendorById.get(po.vendorId);
      const sla = slaByVendor.get(po.vendorId);
      const openQty = (po.lines || []).reduce((s, ln) => s + Math.max(0, n(ln.qty) - n(ln.received) - n(ln.cancelledQty)), 0);
      const poValue = (po.lines || []).reduce((s, ln) => s + positive(ln.qty) * positive(ln.cost), 0);
      const etaDay = dateOnly(po.eta);
      const daysToEta = etaDay ? Math.round((Date.parse(etaDay) - Date.parse(today)) / DAY) : null;
      const isOpenPO = !['RECEIVED', 'CANCELLED', 'CLOSED', 'VOID'].includes(po.status);

      if (isOpenPO) {
        score += 14;
        if (daysToEta !== null && daysToEta < 0) {
          score += 22;
          reasons.push(`Vendor PO ${po.po} (${vendor?.name || 'Supplier'}) ETA is overdue by ${Math.abs(daysToEta)} day(s).`);
        } else if (daysToEta !== null && daysToEta <= 3) {
          score += 14;
          reasons.push(`Vendor PO ${po.po} (${vendor?.name || 'Supplier'}) is arriving in ${daysToEta === 0 ? 'today' : daysToEta + ' day(s)'} (${openQty} units open, $${Math.round(poValue).toLocaleString()}).`);
        } else {
          reasons.push(`Open Vendor PO ${po.po} (${po.status}, ${openQty} units · ${vendor?.name || 'Supplier'}).`);
        }
        if (!extractTrackingNumber(po.tracking) && po.status !== 'DRAFT') {
          score += 8;
          reasons.push(`Vendor PO ${po.po} has no carrier tracking registered yet.`);
        }
      }
      if (vendor?.status === 'AUDIT_WARNING' || (sla && sla.onTimePct < 92)) {
        score += 12;
        reasons.push(`Supplier ${vendor?.name || po.vendorId} flagged for SLA/compliance risk (${sla ? sla.onTimePct + '% on-time' : vendor?.status}).`);
      }
      if (extracted.impactedOrders.length > 0) {
        score += 12;
        reasons.push(`${extracted.impactedOrders.length} open customer order(s) rely on SKU(s) carried by ${po.po} (${extracted.impactedOrders.slice(0, 3).map(o => '#' + o.po).join(', ')}).`);
      }

      addRef({
        type: 'VENDOR_PO',
        id: po.id,
        code: po.po,
        label: `${po.po} · ${vendor?.name || 'Vendor PO'}`,
        path: 'procurement/index.html?po=' + encodeURIComponent(po.po),
        status: po.status,
        severity: (daysToEta !== null && daysToEta <= 1) || vendor?.status === 'AUDIT_WARNING' ? 'high' : 'normal',
        detail: `${po.status} · ${openQty} open units · $${Math.round(poValue).toLocaleString()}${etaDay ? ' · ETA ' + etaDay : ''}${po.tracking ? ' · ' + po.tracking : ' · No tracking'}`
      });
    }

    // 6. Deep Analysis of Matched Inventory SKUs
    for (const item of extracted.matchedSkus) {
      const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
      const safety = positive(item.safety);
      const openInbound = (e.purchaseOrders || [])
        .filter(p => !['RECEIVED', 'CANCELLED', 'CLOSED', 'REJECTED', 'VOID'].includes(p.status))
        .reduce((sum, p) => sum + (p.lines || []).filter(ln => ln.sku === item.sku).reduce((s, ln) => s + Math.max(0, n(ln.qty) - n(ln.received) - n(ln.cancelledQty)), 0), 0);

      if (free <= 0 && openInbound === 0) {
        score += 28;
        reasons.push(`SKU ${item.model || item.sku} is OUT OF STOCK (0 free, 0 inbound PO units).`);
      } else if (safety > 0 && (free + openInbound) < safety) {
        score += 22;
        reasons.push(`SKU ${item.model || item.sku} is below safety stock (${free} free + ${openInbound} inbound vs ${safety} safety floor — deficit ${safety - (free + openInbound)} units).`);
      } else if (safety > 0 && free < safety) {
        score += 10;
        reasons.push(`SKU ${item.model || item.sku} free stock (${free}) is below safety (${safety}), covered by ${openInbound} inbound PO units.`);
      }

      addRef({
        type: 'SKU',
        id: item.sku,
        code: item.model || item.sku,
        label: `${item.model || item.sku} · ${item.brand || ''} ${item.title || ''}`.trim(),
        path: 'warehouse-management/inventory-bins.html?sku=' + encodeURIComponent(item.sku),
        status: (safety > 0 && free < safety) ? 'BELOW_SAFETY' : 'IN_STOCK',
        severity: (safety > 0 && (free + openInbound) < safety) ? 'high' : 'normal',
        detail: `Free: ${free} · On-hand: ${n(item.onHand)} · Reserved: ${n(item.reserved)} · Safety: ${safety} · Inbound PO: ${openInbound}`
      });
    }

    // 7. Linked Receipts, Putaway, Cycle Counts, 3PL Shipments, Invoices
    for (const r of extracted.matchedReceipts) {
      if (r.status === 'ARRIVED') {
        score += 14;
        reasons.push(`Inbound receipt ${r.id} (${r.po}) has ARRIVED at Dock ${r.dock || '—'} awaiting completion.`);
      }
      addRef({
        type: 'RECEIPT',
        id: r.id,
        code: r.asn || r.id,
        label: `Receipt ${r.po} · Dock ${r.dock || '—'}`,
        path: 'warehouse-management/receiving.html',
        status: r.status,
        severity: r.status === 'ARRIVED' ? 'high' : 'normal',
        detail: `${r.status} · ${r.vendor || ''} · $${Math.round(positive(r.poTotal)).toLocaleString()}`
      });
    }

    for (const pw of extracted.matchedPutaway) {
      score += 8;
      reasons.push(`Open warehouse putaway ${pw.id} (${pw.qty} units ${pw.fromBin} → ${pw.toBin}, ${pw.assignee}).`);
    }

    for (const cc of extracted.matchedCycleCounts) {
      if (cc.status === 'VARIANCE') {
        const diff = n(cc.countedQty) - n(cc.systemQty);
        score += 14;
        reasons.push(`Cycle count ${cc.id} (${cc.binId}) has an unresolved stock variance (${diff > 0 ? '+' : ''}${diff} units).`);
      }
      addRef({
        type: 'CYCLE_COUNT',
        id: cc.id,
        code: cc.id,
        label: `Cycle Count ${cc.id} · ${cc.binId}`,
        path: 'warehouse-management/cycle-counts.html',
        status: cc.status,
        severity: cc.status === 'VARIANCE' ? 'high' : 'normal',
        detail: `${cc.status} · System ${cc.systemQty} vs Counted ${cc.countedQty ?? 'Pending'}`
      });
    }

    for (const shp of extracted.matchedTplShipments) {
      if (shp.status === 'DELAYED') {
        score += 22;
        reasons.push(`3PL Shipment ${shp.id} (${shp.orderId}) is DELAYED with ${shp.tracking ? 'tracking ' + shp.tracking : 'no carrier tracking'}.`);
      } else if (!extractTrackingNumber(shp.tracking)) {
        score += 10;
        reasons.push(`3PL Shipment ${shp.id} (${shp.status}) has no tracking assigned yet.`);
      }
      addRef({
        type: '3PL',
        id: shp.id,
        code: shp.id,
        label: `3PL ${shp.id} · ${shp.orderId}`,
        path: '3pl-management/shipments.html',
        status: shp.status,
        severity: shp.status === 'DELAYED' ? 'critical' : 'normal',
        detail: `${shp.status} · ${shp.service} · ${shp.tracking || 'Tracking missing'}`
      });
    }

    for (const inv of extracted.matchedInvoices) {
      if (inv.status === 'EXCEPTION') {
        score += 15;
        reasons.push(`Invoice ${inv.number} (${inv.poReference}) has ${(inv.evidence?.flags || []).length} matching exception(s).`);
      }
      addRef({
        type: 'INVOICE',
        id: inv.id,
        code: inv.number,
        label: `Invoice ${inv.number}`,
        path: 'workspace.html?view=operations&section=invoices&review=' + encodeURIComponent(inv.id),
        status: inv.status,
        severity: inv.status === 'EXCEPTION' ? 'high' : 'normal',
        detail: `${inv.status} · ${inv.poReference}`
      });
    }

    // 8. Linked Mail Threads
    for (const mail of extracted.matchedMails) {
      const mText = `${mail.subject || ''} ${mail.snippet || ''} ${mail.body || ''}`;
      if (mail.unread && /eod|midday|urgent|priority|tracking request/i.test(mText)) {
        score += 15;
        reasons.push(`Linked unread email from ${mail.senderName} requests urgent/same-day response.`);
      } else if (mail.unread) {
        score += 7;
        reasons.push(`Linked unread email thread: "${mail.subject}".`);
      }
      addRef({
        type: 'MAIL',
        id: mail.id,
        code: mail.related?.poNumber || mail.senderName,
        label: `Mail: ${mail.subject}`,
        path: 'mail.html?thread=' + encodeURIComponent(mail.id),
        status: mail.unread ? 'UNREAD' : 'READ',
        severity: mail.unread ? 'high' : 'normal',
        detail: `From ${mail.senderName} (${mail.senderEmail}) · ${mail.related?.tracking ? 'Trk: ' + mail.related.tracking : mail.timestamp}`
      });
    }

    const boundedScore = Math.max(8, Math.min(99, Math.round(score)));
    const tier = boundedScore >= 80 ? 'CRITICAL' : boundedScore >= 60 ? 'HIGH' : boundedScore >= 38 ? 'MEDIUM' : 'LOW';

    let category = task?.category || '';
    if (!category || category === 'GENERAL') {
      if (signals.isEscalation) category = 'ESCALATION';
      else if (task?.autoTrigger === 'tracking_request' || signals.isTrackingRequest) category = 'TRACKING';
      else if (task?.autoTrigger === 'low_stock_po' || extracted.matchedPOs.length || signals.isProcurementNeed) category = 'PROCUREMENT';
      else if (extracted.matchedOrders.length) category = 'ORDER';
      else if (extracted.matchedTplShipments.length || extracted.matchedReceipts.length || extracted.matchedCycleCounts.length) category = 'WAREHOUSE';
      else if (extracted.matchedSkus.length) category = 'INVENTORY';
      else category = 'GENERAL';
    }

    if (!reasons.length) {
      reasons.push('Standard operational task — no critical ERP exceptions or tight deadlines linked yet.');
    }

    let recommendedAction = 'Review details, confirm owner assignments, and update status once complete.';
    if (task?.autoTrigger === 'tracking_request' || (signals.isTrackingRequest && extracted.matchedMails.length)) {
      recommendedAction = 'Reply to the linked email in MK97 Mail with the carrier tracking number — MK Co-Pilot will auto-verify and close this task.';
    } else if (task?.autoTrigger === 'low_stock_po' || (extracted.matchedSkus.length && signals.isProcurementNeed)) {
      recommendedAction = 'Issue a covering Vendor PO in Procurement — MK Co-Pilot will automatically resolve this task once inbound supply covers safety stock.';
    } else if (extracted.matchedPutaway.length) {
      recommendedAction = `Complete dock putaway for ${extracted.matchedReceipts[0]?.po || extracted.matchedPOs[0]?.po || 'arrived PO'} so stock is released to open customer orders.`;
    } else if (extracted.matchedTplShipments.some(s => s.status === 'DELAYED')) {
      recommendedAction = 'Contact the 3PL node immediately to obtain carrier tracking and clear the dispatch delay.';
    } else if (extracted.matchedOrders.length && signals.isEscalation) {
      recommendedAction = `Expedite Order #${extracted.matchedOrders[0].po} and send an immediate reminder/status check to all involved team members.`;
    } else if (extracted.matchedPOs.length) {
      recommendedAction = `Confirm supplier dispatch ETA & tracking for ${extracted.matchedPOs[0].po} and align warehouse receiving dock slot.`;
    } else if (dueMs !== null && dueMs < nowMs) {
      recommendedAction = 'Send an immediate team reminder and either complete or reschedule this overdue task.';
    }

    return {
      score: boundedScore,
      tier,
      category,
      references,
      reasons: [...new Set(reasons)].slice(0, 6),
      recommendedAction,
      signals,
      analyzedAt: nowIso,
      erpSummary: {
        matchedOrders: extracted.matchedOrders.length,
        impactedOrders: extracted.impactedOrders.length,
        matchedPOs: extracted.matchedPOs.length,
        matchedSkus: extracted.matchedSkus.length,
        matchedMails: extracted.matchedMails.length,
        matchedLogistics: extracted.matchedReceipts.length + extracted.matchedCycleCounts.length + extracted.matchedTplShipments.length
      }
    };
  }

  function prioritizeTasks(tasks, state, options = {}) {
    const nowIso = options.now || new Date().toISOString();
    const timeZone = options.timeZone || state?.copilotSettings?.timeZone || 'America/New_York';
    const copilotReport = options.copilotReport || analyze(state || { enterprise: {}, logistics: {} }, { now: nowIso, timeZone });
    const sharedOpts = { ...options, now: nowIso, timeZone, copilotReport };

    const enriched = (tasks || []).map(task => ({
      task,
      analysis: analyzeTaskImportance(task, state, sharedOpts)
    }));

    const active = enriched.filter(x => x.task.status !== 'DONE');
    const done = enriched.filter(x => x.task.status === 'DONE');

    active.sort((a, b) => {
      if (b.analysis.score !== a.analysis.score) return b.analysis.score - a.analysis.score;
      const aDue = validTime(a.task.dueAt) ?? Infinity;
      const bDue = validTime(b.task.dueAt) ?? Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return String(b.task.updatedAt || '').localeCompare(String(a.task.updatedAt || ''));
    });

    active.forEach((item, idx) => { item.analysis.rank = idx + 1; });
    done.sort((a, b) => String(b.task.completedAt || b.task.updatedAt || '').localeCompare(String(a.task.completedAt || a.task.updatedAt || '')));
    done.forEach(item => { item.analysis.rank = null; });

    return [...active, ...done];
  }

  function normalizeSubjectKey(subj) {
    return String(subj || '').toLowerCase().replace(/^(?:re|fwd|fw)\s*:\s*/gi, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function findTrackingResolutionForMail(inbound, allMails, state) {
    const directTrk = extractTrackingNumber(inbound.shipmentDetails?.trackingNumber || '') || extractTrackingNumber(inbound.related?.tracking || '');
    if (directTrk) return { tracking: directTrk, via: 'email record update' };

    const inboundPo = normToken(inbound.related?.poNumber || inbound.shipmentDetails?.poNumber || '');
    const inboundSubj = normalizeSubjectKey(inbound.subject);
    const senderEmail = String(inbound.senderEmail || '').toLowerCase();

    // Check outbound emails for a reply containing a tracking number
    for (const out of allMails || []) {
      const isOut = out.direction === 'outbound' || out.folder === 'sent';
      if (!isOut || out.id === inbound.id) continue;
      const outHay = `${out.subject || ''}\n${out.body || ''}\n${out.snippet || ''}\n${out.related?.tracking || ''}\n${out.shipmentDetails?.trackingNumber || ''}`;
      const trk = extractTrackingNumber(outHay);
      if (!trk) continue;

      const outTo = String(out.to || '').toLowerCase();
      const outSubj = normalizeSubjectKey(out.subject);
      const matchesThread = (out.replyToThreadId && out.replyToThreadId === inbound.id) ||
        (inboundPo && inboundPo.length >= 4 && tokenInText(outHay, inboundPo)) ||
        (inboundSubj && inboundSubj.length >= 6 && outSubj.includes(inboundSubj)) ||
        (senderEmail && outTo.includes(senderEmail));
      if (matchesThread) {
        return { tracking: trk, via: `MK97 Mail reply ("${out.subject || 'Outbound Reply'}")` };
      }
    }

    // Check ERP orders & 3PL shipments matching this email's PO ref
    if (inboundPo && inboundPo.length >= 4) {
      for (const o of state?.enterprise?.orders || []) {
        const codes = [o.po, o.orderNumber, o.id].map(normToken);
        if (codes.some(c => c && (c === inboundPo || c.includes(inboundPo) || inboundPo.includes(c)))) {
          const trk = extractTrackingNumber(o.tracking);
          if (trk) return { tracking: trk, via: `Order #${o.po} shipment update` };
        }
      }
      for (const shp of state?.logistics?.tplShipments || []) {
        const codes = [shp.id, shp.orderId].map(normToken);
        if (codes.some(c => c && (c === inboundPo || c.includes(inboundPo) || inboundPo.includes(c)))) {
          const trk = extractTrackingNumber(shp.tracking);
          if (trk) return { tracking: trk, via: `3PL Shipment ${shp.id}` };
        }
      }
    }
    return null;
  }

  function reconcileAutonomousTasks(state, mailThreads = [], options = {}) {
    const now = options.now || new Date().toISOString();
    const dryRun = options.dryRun === true;
    const resetDismissed = options.resetDismissed === true;
    const owner = options.actor || 'mk-copilot';
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    state.tasks ||= [];
    state.taskMeta ||= { dismissedAutoKeys: [] };
    if (resetDismissed) state.taskMeta.dismissedAutoKeys = [];
    const dismissed = new Set(state.taskMeta.dismissedAutoKeys || []);

    const created = [];
    const resolved = [];
    const desired = new Map();

    const pickTeam = ids => DEFAULT_TEAM_ROSTER.filter(m => ids.includes(m.id)).map(m => ({ ...m }));

    // RULE A: Inventory Level Analysis → Auto-Create Vendor PO Tasks
    for (const item of e.inventory || []) {
      if (item.nature === 'DIGITAL' || String(item.status || '').toLowerCase() === 'internal use') continue;
      const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
      const safety = positive(item.safety);
      if (!safety) continue;
      const openInbound = (e.purchaseOrders || [])
        .filter(p => !['RECEIVED', 'CANCELLED', 'CLOSED', 'REJECTED', 'VOID'].includes(p.status))
        .reduce((sum, p) => sum + (p.lines || []).filter(ln => ln.sku === item.sku).reduce((s, ln) => s + Math.max(0, n(ln.qty) - n(ln.received) - n(ln.cancelledQty)), 0), 0);

      const autoKey = 'auto:po:' + item.sku;
      if ((free + openInbound) < safety) {
        const deficit = safety - (free + openInbound);
        const suggestedQty = Math.max(25, Math.ceil((safety * 2 - free) / 5) * 5);
        desired.set(autoKey, {
          autoKey,
          autoTrigger: 'low_stock_po',
          autoEntityId: item.sku,
          autoRef: item.model || item.sku,
          title: `Place Vendor PO for ${item.model || item.sku} (${item.brand || ''} ${item.title || ''}) — Below Safety Stock`.replace(/\s+/g, ' ').trim().slice(0, 160),
          notes: `Auto-detected by MK Co-Pilot Inventory Monitor:\n• SKU: ${item.sku} (${item.model || '—'})\n• Free Usable Stock: ${free} units (On-hand ${n(item.onHand)}, Reserved ${n(item.reserved)})\n• Safety Stock Floor: ${safety} units (Deficit: ${deficit} units)\n• Open Inbound Vendor POs: ${openInbound} units\n• Recommended PO Quantity: ${suggestedQty} units\n\nOnce a covering Vendor PO is issued (or stock recovers above ${safety} units), MK Co-Pilot will automatically resolve and remove this task.`,
          category: 'PROCUREMENT',
          priority: free <= Math.floor(safety * 0.5) ? 'CRITICAL' : 'HIGH',
          assignees: pickTeam(['usr_elena', 'usr_david']),
          sourcePath: 'procurement/index.html?sku=' + encodeURIComponent(item.sku),
          dueAt: new Date(Date.parse(now) + 24 * 3600000).toISOString(),
          reminderAt: new Date(Date.parse(now) + 4 * 3600000).toISOString(),
          suggestedQty
        });
      }
    }

    // RULE B: Received Mail → Tracking Requests (Auto-Create & Auto-Resolve when Tracking Provided)
    const inboundMails = (mailThreads || []).filter(t => t && t.direction !== 'outbound' && t.folder !== 'sent' && t.folder !== 'trash');
    for (const mail of inboundMails) {
      const mText = `${mail.subject || ''}\n${mail.snippet || ''}\n${mail.body || ''}`;
      const asksTracking = /\b(tracking\s*(?:number|#|no\.?|request|info|details|update)|provide\s+(?:the\s+)?tracking|need\s+tracking|send\s+tracking|share\s+tracking|where\s+is\s+(?:my|the)\s+tracking)\b/i.test(mText);
      if (!asksTracking) continue;

      const resolution = findTrackingResolutionForMail(mail, mailThreads, state);
      const autoKey = 'auto:tracking:' + mail.id;
      if (!resolution) {
        const refCode = mail.related?.poNumber || mail.shipmentDetails?.poNumber || mail.subject;
        const urgent = /\b(eod|midday|priority|urgent|asap|today)\b/i.test(mText);
        desired.set(autoKey, {
          autoKey,
          autoTrigger: 'tracking_request',
          autoEntityId: mail.id,
          autoRef: refCode,
          linkedMailId: mail.id,
          title: `Provide Tracking for ${refCode} — ${mail.senderName}`.slice(0, 160),
          notes: `Auto-created by MK Co-Pilot from received email:\n• From: ${mail.senderName} <${mail.senderEmail || 'unknown'}>\n• Subject: ${mail.subject}\n• Reference: ${refCode}\n• Excerpt: "${(mail.snippet || mail.body || '').slice(0, 220)}"\n\nOnce tracking is provided via MK97 Mail reply or updated on the shipment/order, MK Co-Pilot will automatically analyze the update and remove this task from your active list.`,
          category: 'TRACKING',
          priority: urgent ? 'HIGH' : 'NORMAL',
          assignees: pickTeam(['usr_marcus', 'usr_priya']),
          sourcePath: 'mail.html?thread=' + encodeURIComponent(mail.id),
          dueAt: new Date(Date.parse(now) + (urgent ? 8 : 24) * 3600000).toISOString(),
          reminderAt: new Date(Date.parse(now) + (urgent ? 2 : 6) * 3600000).toISOString()
        });
      }
    }

    // RULE C: Delayed 3PL Shipments Missing Tracking
    for (const shp of l.tplShipments || []) {
      if (shp.status === 'DELAYED' && !extractTrackingNumber(shp.tracking)) {
        const autoKey = 'auto:3pl-delay:' + shp.id;
        desired.set(autoKey, {
          autoKey,
          autoTrigger: 'tpl_delay_tracking',
          autoEntityId: shp.id,
          autoRef: shp.orderId || shp.id,
          title: `Resolve Delayed 3PL Shipment ${shp.id} (${shp.orderId}) — Tracking Missing`.slice(0, 160),
          notes: `Auto-detected by MK Co-Pilot 3PL Monitor:\n• Shipment: ${shp.id} · Order: ${shp.orderId}\n• SKU: ${shp.sku} (Qty ${shp.qty}) · Carrier: ${shp.service}\n• Status: DELAYED without carrier tracking.\n\nThis task auto-resolves as soon as carrier tracking is recorded or the shipment dispatches.`,
          category: 'ESCALATION',
          priority: 'CRITICAL',
          assignees: pickTeam(['usr_marcus', 'usr_sarah']),
          sourcePath: '3pl-management/shipments.html',
          dueAt: new Date(Date.parse(now) + 12 * 3600000).toISOString(),
          reminderAt: new Date(Date.parse(now) + 2 * 3600000).toISOString()
        });
      }
    }

    // RULE D: Received Mail Escalations / Urgent Supply Issues (non-tracking)
    for (const mail of inboundMails) {
      if (desired.has('auto:tracking:' + mail.id)) continue;
      const mText = `${mail.subject || ''}\n${mail.snippet || ''}\n${mail.body || ''}`;
      const isEsc = /\b(escalat\w*|urgent|short\s*shipment|damaged|wrong\s*item|cancel\w*|sla\s*breach)\b/i.test(mText);
      if (!isEsc) continue;
      const hasOutboundReply = (mailThreads || []).some(out =>
        (out.direction === 'outbound' || out.folder === 'sent') &&
        ((out.replyToThreadId && out.replyToThreadId === mail.id) ||
          (mail.senderEmail && String(out.to || '').toLowerCase().includes(String(mail.senderEmail).toLowerCase()) && normalizeSubjectKey(out.subject).includes(normalizeSubjectKey(mail.subject))))
      );
      if (!hasOutboundReply) {
        const autoKey = 'auto:mail-esc:' + mail.id;
        const refCode = mail.related?.poNumber || mail.subject;
        desired.set(autoKey, {
          autoKey,
          autoTrigger: 'mail_escalation',
          autoEntityId: mail.id,
          autoRef: refCode,
          linkedMailId: mail.id,
          title: `Escalation Follow-Up: ${mail.subject} (${mail.senderName})`.slice(0, 160),
          notes: `Auto-created by MK Co-Pilot from urgent email:\n• From: ${mail.senderName} <${mail.senderEmail || ''}>\n• Excerpt: "${(mail.snippet || mail.body || '').slice(0, 220)}"\n\nAuto-resolves once an outbound resolution reply is sent.`,
          category: 'ESCALATION',
          priority: 'HIGH',
          assignees: pickTeam(['usr_manoj', 'usr_sarah']),
          sourcePath: 'mail.html?thread=' + encodeURIComponent(mail.id),
          dueAt: new Date(Date.parse(now) + 12 * 3600000).toISOString(),
          reminderAt: new Date(Date.parse(now) + 2 * 3600000).toISOString()
        });
      }
    }

    // 1. AUTO-RESOLVE active tasks whose condition is now satisfied!
    for (const task of state.tasks) {
      if (task.status === 'DONE') continue;
      let resolveReason = '';

      if (task.autoTrigger === 'low_stock_po' && task.autoEntityId) {
        const item = (e.inventory || []).find(i => i.sku === task.autoEntityId);
        if (item) {
          const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
          const safety = positive(item.safety);
          const openInbound = (e.purchaseOrders || [])
            .filter(p => !['RECEIVED', 'CANCELLED', 'CLOSED', 'REJECTED', 'VOID'].includes(p.status))
            .reduce((sum, p) => sum + (p.lines || []).filter(ln => ln.sku === item.sku).reduce((s, ln) => s + Math.max(0, n(ln.qty) - n(ln.received) - n(ln.cancelledQty)), 0), 0);
          if ((free + openInbound) >= safety) {
            resolveReason = openInbound > 0
              ? `Vendor PO placed covering ${openInbound} inbound unit(s) (free ${free} + inbound ${openInbound} ≥ safety ${safety}). Automatically resolved by MK Co-Pilot.`
              : `Free inventory (${free}) now meets safety stock (${safety}). Automatically resolved by MK Co-Pilot.`;
          }
        }
      } else if (task.autoTrigger === 'tracking_request' || (task.linkedMailId && /\btracking\b/i.test(task.title + ' ' + task.notes))) {
        const mail = (mailThreads || []).find(t => t.id === (task.linkedMailId || task.autoEntityId));
        if (mail) {
          const res = findTrackingResolutionForMail(mail, mailThreads, state);
          if (res) {
            resolveReason = `Tracking number ${res.tracking} provided via ${res.via}. Verified and automatically resolved by MK Co-Pilot.`;
          }
        }
      } else if (task.autoTrigger === 'tpl_delay_tracking' && task.autoEntityId) {
        const shp = (l.tplShipments || []).find(s => s.id === task.autoEntityId);
        if (shp && (extractTrackingNumber(shp.tracking) || ['DISPATCHED', 'DELIVERED'].includes(shp.status))) {
          resolveReason = `3PL Shipment ${shp.id} updated (${shp.status}${shp.tracking ? ', tracking ' + shp.tracking : ''}). Automatically resolved by MK Co-Pilot.`;
        }
      } else if (task.autoTrigger === 'mail_escalation' && task.linkedMailId) {
        const mail = (mailThreads || []).find(t => t.id === task.linkedMailId);
        if (mail && !desired.has(task.autoKey)) {
          resolveReason = `Outbound reply dispatched for "${mail.subject}". Automatically resolved by MK Co-Pilot.`;
        }
      }

      if (resolveReason) {
        resolved.push({ id: task.id, title: task.title, autoKey: task.autoKey || '', reason: resolveReason });
        if (!dryRun) {
          task.status = 'DONE';
          task.completedAt = now;
          task.updatedAt = now;
          task.version = (task.version || 0) + 1;
          task.autoResolved = true;
          task.autoResolvedAt = now;
          task.autoResolvedReason = resolveReason;
          task.comments ||= [];
          task.comments.push({
            id: 'mk-auto-res-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            text: '✨ MK Co-Pilot Auto-Resolved: ' + resolveReason,
            time: now,
            author: 'MK Co-Pilot'
          });
        }
      }
    }

    // 2. AUTO-CREATE missing autonomous tasks
    const existingActiveKeys = new Set(state.tasks.filter(t => t.status !== 'DONE' && t.autoKey).map(t => t.autoKey));
    const existingResolvedKeys = new Set(state.tasks.filter(t => t.status === 'DONE' && t.autoKey && !t.autoResolved).map(t => t.autoKey));
    for (const [key, spec] of desired.entries()) {
      if (existingActiveKeys.has(key) || dismissed.has(key) || existingResolvedKeys.has(key)) continue;
      const newTask = {
        id: 'mk-task-' + key.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + Math.random().toString(36).slice(2, 6),
        title: spec.title,
        notes: spec.notes,
        status: 'OPEN',
        priority: spec.priority,
        category: spec.category,
        assignees: spec.assignees,
        dueAt: spec.dueAt,
        reminderAt: spec.reminderAt,
        sourcePath: spec.sourcePath || '',
        sourceKey: key,
        linkedMailId: spec.linkedMailId || '',
        autoCreatedBy: 'mk-copilot',
        autoKey: key,
        autoTrigger: spec.autoTrigger,
        autoEntityId: spec.autoEntityId || '',
        autoRef: spec.autoRef || '',
        suggestedQty: spec.suggestedQty || 0,
        autoResolved: false,
        autoResolvedAt: '',
        autoResolvedReason: '',
        reminderLog: [],
        lastRemindedAt: '',
        comments: [{
          id: 'mk-auto-init-' + Math.random().toString(36).slice(2, 7),
          text: '✨ Autonomously created by MK Co-Pilot after analyzing live ERP & Mail signals.',
          time: now,
          author: 'MK Co-Pilot'
        }],
        createdAt: now,
        updatedAt: now,
        createdBy: owner,
        ownerUserId: 'local',
        completedAt: '',
        version: 1
      };
      created.push({ id: newTask.id, title: newTask.title, autoKey: key, trigger: spec.autoTrigger });
      if (!dryRun) state.tasks.push(newTask);
    }

    return {
      created,
      resolved,
      scannedAt: now,
      summary: `MK Co-Pilot scan complete: ${created.length} task(s) created, ${resolved.length} task(s) auto-resolved.`
    };
  }

  return {
    VERSION,
    DEFAULT_TEAM_ROSTER,
    civilDay,
    dateOnly,
    dueTime,
    parseFollowUp,
    intent,
    remaining,
    analyze,
    demandSeries,
    applyCommunication,
    extractTrackingNumber,
    extractTaskReferences,
    analyzeTaskImportance,
    prioritizeTasks,
    reconcileAutonomousTasks
  };
});
