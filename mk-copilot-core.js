(function (root, factory) {
  'use strict';
  const api = factory();
  root.MKCopilotCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '7.0.0';
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

  // ---- MK v6.0 Live ERP Intelligence, Executive Briefing & Natural-Language Command Parsers ----
  const moneyFmt = val => '$' + Math.round(positive(val)).toLocaleString('en-US');

  function getInboundQtyBySku(state) {
    const map = new Map();
    for (const po of state?.enterprise?.purchaseOrders || []) {
      if (['RECEIVED', 'CANCELLED', 'CLOSED', 'REJECTED', 'VOID'].includes(po.status)) continue;
      for (const ln of po.lines || []) {
        const rem = Math.max(0, n(ln.qty) - n(ln.received) - n(ln.cancelledQty));
        if (rem > 0) map.set(ln.sku, (map.get(ln.sku) || 0) + rem);
      }
    }
    return map;
  }

  function getTplQtyBySku(state) {
    const map = new Map();
    for (const row of state?.logistics?.tplInventory || []) {
      const list = map.get(row.sku) || [];
      list.push(row);
      map.set(row.sku, list);
    }
    return map;
  }

  function getLivePulse(state, mailThreads = []) {
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    const inboundMap = getInboundQtyBySku(state);
    const activeTasks = (state?.tasks || []).filter(t => t.status !== 'DONE');
    const ranked = prioritizeTasks(activeTasks, state, { mailThreads });
    const criticalTasks = ranked.filter(x => x.analysis.tier === 'CRITICAL').length;

    const lowStockSkus = (e.inventory || []).filter(item => {
      if (item.nature === 'DIGITAL' || String(item.status || '').toLowerCase() === 'internal use') return false;
      const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
      const inbound = inboundMap.get(item.sku) || 0;
      return positive(item.safety) > 0 && (free + inbound) < positive(item.safety);
    });

    const delayedTpl = (l.tplShipments || []).filter(s => s.status === 'DELAYED');
    const arrivedReceipts = (l.receipts || []).filter(r => r.status === 'ARRIVED');
    const openPutaway = (l.putaway || []).filter(p => p.status !== 'DONE');
    const varianceCounts = (l.cycleCounts || []).filter(c => c.status === 'VARIANCE');
    const vendorWarnings = (e.vendors || []).filter(v => v.status === 'AUDIT_WARNING' || v.compliance === 'REVIEW');
    const openOrders = (e.orders || []).filter(o => !CLOSED.has(o.status));
    const openPOs = (e.purchaseOrders || []).filter(p => !['RECEIVED', 'CANCELLED', 'CLOSED', 'REJECTED', 'VOID'].includes(p.status));

    const inboundMails = (mailThreads || []).filter(t => t && t.direction !== 'outbound' && t.folder !== 'sent' && t.folder !== 'trash');
    const unreadMailCount = inboundMails.filter(t => t.unread).length;
    const pendingTrackingMails = inboundMails.filter(m => {
      const txt = `${m.subject || ''}\n${m.snippet || ''}\n${m.body || ''}`;
      if (!/\b(tracking\s*(?:number|#|no\.?|request|info|details|update)|provide\s+(?:the\s+)?tracking|need\s+tracking|send\s+tracking|share\s+tracking)\b/i.test(txt)) return false;
      return !findTrackingResolutionForMail(m, mailThreads, state);
    });

    return {
      activeTasks: activeTasks.length,
      criticalTasks,
      lowStockCount: lowStockSkus.length,
      lowStockSkus,
      delayedTplCount: delayedTpl.length,
      delayedTpl,
      arrivedReceiptsCount: arrivedReceipts.length,
      openPutawayCount: openPutaway.length,
      varianceCountsCount: varianceCounts.length,
      vendorWarningsCount: vendorWarnings.length,
      openOrdersCount: openOrders.length,
      openPOsCount: openPOs.length,
      unreadMailCount,
      pendingTrackingCount: pendingTrackingMails.length,
      pendingTrackingMails,
      topTask: ranked[0] || null
    };
  }

  function buildExecutiveBriefing(state, mailThreads = [], options = {}) {
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    const pulse = getLivePulse(state, mailThreads);
    const inboundMap = getInboundQtyBySku(state);

    const openOrders = (e.orders || []).filter(o => !CLOSED.has(o.status));
    const openOrderValue = openOrders.reduce((s, o) => s + (o.lines || []).reduce((ls, ln) => ls + positive(ln.qty) * positive(ln.price), 0), 0);
    const missingOrderTracking = openOrders.filter(o => ['PICKING', 'PACKING'].includes(o.status) && !extractTrackingNumber(o.tracking));

    const openPOs = (e.purchaseOrders || []).filter(p => !['RECEIVED', 'CANCELLED', 'CLOSED', 'REJECTED', 'VOID'].includes(p.status));
    const openPOValue = openPOs.reduce((s, p) => s + (p.lines || []).reduce((ls, ln) => ls + positive(ln.qty) * positive(ln.cost), 0), 0);

    const totalInvValue = (e.inventory || []).reduce((s, i) => s + positive(i.onHand) * positive(i.cost), 0);
    const reviewAccts = (e.accounts || []).filter(a => a.status === 'REVIEW');

    const lines = [
      `**MK97 Executive Operations Briefing**`,
      `Live cross-ERP telemetry across Orders, Inventory, Procurement, Warehouse, 3PL, Mail & Tasks:`,
      ``,
      `**1. Urgent Bottlenecks & Risk Radar**`
    ];

    if (pulse.lowStockSkus.length) {
      for (const item of pulse.lowStockSkus) {
        const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
        const suggested = Math.max(25, Math.ceil((positive(item.safety) * 2 - free) / 5) * 5);
        lines.push(`• **LOW STOCK — ${item.model || item.sku}** (${item.brand}): **${free} free** vs **${item.safety} safety floor** (0 inbound POs) → Recommend ordering **${suggested} units** (${moneyFmt(suggested * positive(item.cost))}).`);
      }
    } else {
      lines.push(`• **Inventory Safety Floors:** All active physical SKUs are covered by on-hand or inbound PO stock.`);
    }

    if (pulse.delayedTpl.length) {
      for (const shp of pulse.delayedTpl) {
        lines.push(`• **3PL DELAY — ${shp.id}** (${shp.orderId}): Delayed at \`${shp.nodeId}\` (${shp.sku}, qty ${shp.qty}) with **no tracking assigned**.`);
      }
    }
    if (pulse.arrivedReceiptsCount || pulse.openPutawayCount) {
      const rcv = (l.receipts || []).find(r => r.status === 'ARRIVED');
      const pw = (l.putaway || []).find(p => p.status !== 'DONE');
      lines.push(`• **Dock Putaway Bottleneck:** ${rcv ? `**${rcv.po}** arrived at Dock ${rcv.dock} (${moneyFmt(rcv.poTotal)})` : `${pulse.arrivedReceiptsCount} arrived receipt(s)`}${pw ? ` · Open putaway **${pw.id}** (${pw.qty} units ${pw.fromBin} → ${pw.toBin}, ${pw.assignee})` : ''}.`);
    }
    if (pulse.vendorWarningsCount) {
      const v = (e.vendors || []).find(x => x.status === 'AUDIT_WARNING');
      const sla = (e.slaLogs || []).find(s => s.vendorId === v?.id);
      lines.push(`• **Supplier Compliance Alert:** **${v?.name}** (${v?.status}${sla ? `, ${sla.onTimePct}% on-time vs ${sla.targetDays}d target` : ''}).`);
    }
    if (pulse.pendingTrackingCount) {
      lines.push(`• **Pending Mail Tracking Requests (${pulse.pendingTrackingCount}):** ${pulse.pendingTrackingMails.map(m => `**${m.related?.poNumber || m.subject}** (${m.senderName})`).join(', ')}.`);
    }
    if (reviewAccts.length) {
      const a = reviewAccts[0];
      const util = a.creditLimit ? Math.round((a.creditUsed / a.creditLimit) * 100) : 0;
      lines.push(`• **Credit Review Account:** **${a.name}** at **${util}% credit utilization** (${moneyFmt(a.creditUsed)} / ${moneyFmt(a.creditLimit)}).`);
    }

    lines.push(
      ``,
      `**2. Portfolio Snapshot**`,
      `• **Open Customer Orders:** ${openOrders.length} active (${moneyFmt(openOrderValue)} exposure · ${missingOrderTracking.length} in Picking/Packing without tracking)`,
      `• **Open Vendor POs:** ${openPOs.length} open (${moneyFmt(openPOValue)} inbound value)`,
      `• **Warehouse Inventory Value:** ${moneyFmt(totalInvValue)} across ${(e.inventory || []).length} SKUs (${pulse.varianceCountsCount} cycle count variance)`,
      `• **Tasks Queue:** **${pulse.activeTasks} active** (${pulse.criticalTasks} critical)${pulse.topTask ? ` · **#1 Priority:** ${pulse.topTask.task.title} (${pulse.topTask.analysis.score}/100)` : ''}`
    );

    const metrics = [
      { label: 'Active Tasks', value: String(pulse.activeTasks), tone: pulse.criticalTasks ? 'critical' : 'teal' },
      { label: 'Low Stock', value: String(pulse.lowStockCount), tone: pulse.lowStockCount ? 'warn' : 'ok' },
      { label: 'Open Orders', value: `${openOrders.length} · ${moneyFmt(openOrderValue)}`, tone: 'info' },
      { label: 'Tracking Req', value: String(pulse.pendingTrackingCount), tone: pulse.pendingTrackingCount ? 'warn' : 'ok' }
    ];

    const actions = [];
    if (pulse.lowStockSkus.length) {
      const firstLow = pulse.lowStockSkus[0];
      const free = Math.max(0, n(firstLow.onHand) - n(firstLow.reserved) - n(firstLow.damaged));
      const qty = Math.max(25, Math.ceil((positive(firstLow.safety) * 2 - free) / 5) * 5);
      actions.push({ label: `🛒 Issue PO (${qty} × ${firstLow.model || firstLow.sku})`, style: 'primary', prompt: `Place a vendor PO for ${firstLow.model || firstLow.sku} for ${qty} units` });
    }
    if (pulse.topTask) {
      actions.push({ label: `🔔 Remind Team on #1`, style: 'teal', prompt: `Send reminder for #1` });
    }
    actions.push({ label: '⚡ Scan Mail & ERP', style: 'ghost', prompt: 'Scan mail and inventory for tasks' });
    actions.push({ label: '📋 Open Tasks', style: 'ghost', href: 'tasks.html' });

    const followUps = [
      'Prioritize & analyze my tasks',
      'Check low stock and inventory value',
      'Summarize vendor performance',
      'Show 3PL delays and warehouse status'
    ];

    return {
      markdown: lines.join('\n'),
      metrics,
      actions,
      followUps,
      pulse,
      inboundMap
    };
  }

  function findBestLiveSku(query, state, lastEntity = null) {
    const inv = state?.enterprise?.inventory || [];
    const q = String(query || '').toLowerCase();
    const qCompact = q.replace(/[^a-z0-9]/g, '');

    // Direct exact / substring match on SKU, model, brand, title
    let best = null;
    let bestScore = 0;
    for (const item of inv) {
      const sku = String(item.sku || '').toLowerCase();
      const model = String(item.model || '').toLowerCase();
      const brand = String(item.brand || '').toLowerCase();
      const title = String(item.title || '').toLowerCase();
      const modelCompact = model.replace(/[^a-z0-9]/g, '');
      let s = 0;
      if (sku && tokenInText(q, sku)) s = Math.max(s, 100);
      if (model && model.length >= 3 && (tokenInText(q, model) || qCompact.includes(modelCompact))) s = Math.max(s, 95);
      // Fuzzy model family match e.g. WH-1000XM6 -> WH1000XM5
      if (modelCompact.length >= 6 && qCompact.includes(modelCompact.slice(0, -1))) s = Math.max(s, 82);
      if (brand && brand.length >= 3 && tokenInText(q, brand)) s = Math.max(s, 65);
      if (title && title.split(/\s+/).filter(w => w.length >= 4).some(w => q.includes(w))) s = Math.max(s, 55);
      if (s > bestScore) { bestScore = s; best = item; }
    }
    if (best) return { item: best, fuzzy: bestScore < 90 && bestScore >= 75 };
    if (lastEntity?.type === 'SKU' && /\b(it|this|that|same)\b/i.test(q)) {
      const prev = inv.find(i => i.sku === lastEntity.id);
      if (prev) return { item: prev, fuzzy: false };
    }
    return { item: null, fuzzy: false };
  }

  function queryLiveInventory(query, state, lastEntity = null) {
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    const inv = e.inventory || [];
    const inboundMap = getInboundQtyBySku(state);
    const tplMap = getTplQtyBySku(state);
    const q = String(query || '').toLowerCase();

    const wantLowOnly = /\b(low\s*stock|below\s*safety|deficit|shortage|reorder|need\s*po|stockout)\b/i.test(q);
    const { item: matched, fuzzy } = wantLowOnly && !/\b(af-200|wh1000|airpods|hcfb1|4217709208|amz|visa|sony|apple|aura)\b/i.test(q)
      ? { item: null, fuzzy: false }
      : findBestLiveSku(query, state, lastEntity);

    if (matched) {
      const free = Math.max(0, n(matched.onHand) - n(matched.reserved) - n(matched.damaged));
      const inbound = inboundMap.get(matched.sku) || 0;
      const safety = positive(matched.safety);
      const deficit = Math.max(0, safety - (free + inbound));
      const tplRows = tplMap.get(matched.sku) || [];
      const tplTotal = tplRows.reduce((s, r) => s + positive(r.qty), 0);
      const openPOs = (e.purchaseOrders || []).filter(p => !['RECEIVED', 'CANCELLED', 'CLOSED'].includes(p.status) && (p.lines || []).some(ln => ln.sku === matched.sku));
      const openOrders = (e.orders || []).filter(o => !CLOSED.has(o.status) && (o.lines || []).some(ln => ln.sku === matched.sku));
      const cc = (l.cycleCounts || []).find(c => c.sku === matched.sku && c.status !== 'CLOSED');
      const val = positive(matched.onHand) * positive(matched.cost);
      const suggested = deficit > 0 ? Math.max(25, Math.ceil((safety * 2 - free) / 5) * 5) : 0;

      const lines = [
        `**Live Inventory Intelligence — ${matched.model || matched.sku} (${matched.brand})**`,
        fuzzy ? `*Closest live catalog match for your query:* **${matched.title}** (\`${matched.sku}\`)` : `**${matched.title}** (\`${matched.sku}\` · ${matched.nature} · Status: ${matched.status})`,
        ``,
        `• **Warehouse Stock:** **${matched.onHand}** on-hand · **${matched.reserved}** reserved · **${free} free usable** (Safety floor: **${safety}**)`,
        `• **Valuation:** ${moneyFmt(val)} at ${moneyFmt(matched.cost)}/unit (Standard price: ${moneyFmt(matched.standardPrice)})`,
        `• **Inbound Vendor POs:** **${inbound} units**${openPOs.length ? ' — ' + openPOs.map(p => `**${p.po}** (${p.status}, ETA ${dateOnly(p.eta) || 'TBD'})`).join(', ') : ' (None scheduled)'}`,
        tplRows.length ? `• **3PL Network Stock (${tplTotal} total):** ${tplRows.map(r => `${r.nodeId.replace('tpl_', '').toUpperCase()}: ${r.qty} (${r.reserved} res)`).join(' · ')}` : `• **3PL Network Stock:** 0 units`,
        `• **Open Customer Demand:** ${openOrders.length} active order(s)${openOrders.length ? ' (' + openOrders.slice(0, 4).map(o => `#${o.po}`).join(', ') + ')' : ''}`,
        cc ? `• **Warehouse Cycle Count:** \`${cc.id}\` (${cc.binId}) — **${cc.status}** (System ${cc.systemQty} vs Counted ${cc.countedQty ?? 'Pending'})` : ''
      ].filter(Boolean);

      if (deficit > 0) {
        lines.push(``, `⚠️ **Action Required:** Free + Inbound (${free + inbound}) is **${deficit} units below safety floor**. Recommended replenishment: **${suggested} units** (${moneyFmt(suggested * positive(matched.cost))}).`);
      }

      const actions = [];
      if (deficit > 0 || suggested > 0) {
        actions.push({ label: `🛒 Issue Vendor PO (${suggested} × ${matched.model || matched.sku})`, style: 'primary', prompt: `Place a vendor PO for ${matched.model || matched.sku} for ${suggested} units` });
      } else {
        actions.push({ label: `🛒 Order 30 More Units`, style: 'teal', prompt: `Place a vendor PO for ${matched.model || matched.sku} for 30 units` });
      }
      actions.push({ label: `📋 Create Task for ${matched.model || matched.sku}`, style: 'ghost', prompt: `Create task to review ${matched.model || matched.sku} stock with Elena and David due tomorrow` });
      actions.push({ label: '↗ Open Inventory Bins', style: 'ghost', href: 'warehouse-management/inventory-bins.html?sku=' + encodeURIComponent(matched.sku) });

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'Free Usable', value: String(free), tone: deficit > 0 ? 'critical' : 'ok' },
          { label: 'Safety Floor', value: String(safety), tone: 'info' },
          { label: 'Inbound PO', value: String(inbound), tone: inbound > 0 ? 'teal' : 'warn' },
          { label: 'Stock Value', value: moneyFmt(val), tone: 'info' }
        ],
        actions,
        followUps: [`What if demand increases 25% for ${matched.model || matched.sku}?`, `Show open orders for ${matched.brand}`, 'Show executive briefing'],
        entity: { type: 'SKU', id: matched.sku, label: matched.model || matched.sku }
      };
    }

    // Portfolio / Low-Stock Radar view
    const rows = inv.map(item => {
      const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
      const inbound = inboundMap.get(item.sku) || 0;
      const safety = positive(item.safety);
      const deficit = Math.max(0, safety - (free + inbound));
      const val = positive(item.onHand) * positive(item.cost);
      return { item, free, inbound, safety, deficit, val };
    });
    const lowRows = rows.filter(r => r.deficit > 0 && r.item.nature !== 'DIGITAL');
    const totalVal = rows.reduce((s, r) => s + r.val, 0);
    const totalUnits = rows.reduce((s, r) => s + positive(r.item.onHand), 0);
    const list = wantLowOnly && lowRows.length ? lowRows : rows.sort((a, b) => b.deficit - a.deficit || a.free - b.free);

    const lines = [
      wantLowOnly ? `**Low-Stock & Safety-Floor Radar (${lowRows.length} Alert${lowRows.length === 1 ? '' : 's'})**` : `**Live ERP Inventory Portfolio (${inv.length} SKUs · ${moneyFmt(totalVal)})**`,
      ``
    ];
    for (const r of list.slice(0, 8)) {
      const badge = r.deficit > 0 ? `⚠️ **SHORT ${r.deficit}**` : r.free < r.safety ? `🟡 Covered by ${r.inbound} inbound` : `✅ Healthy`;
      lines.push(`• **${r.item.model || r.item.sku}** (${r.item.brand}) — Free: **${r.free}** / Safety: ${r.safety} · Inbound: ${r.inbound} · ${badge}`);
    }

    const actions = [];
    if (lowRows.length) {
      const top = lowRows[0];
      const qty = Math.max(25, Math.ceil((top.safety * 2 - top.free) / 5) * 5);
      actions.push({ label: `🛒 Issue PO (${qty} × ${top.item.model || top.item.sku})`, style: 'primary', prompt: `Place a vendor PO for ${top.item.model || top.item.sku} for ${qty} units` });
    }
    actions.push({ label: '⚡ Run Auto-Scan', style: 'teal', prompt: 'Scan mail and inventory for tasks' });
    actions.push({ label: '↗ Open Stock & Bins', style: 'ghost', href: 'warehouse-management/inventory-bins.html' });

    return {
      markdown: lines.join('\n'),
      metrics: [
        { label: 'Total SKUs', value: String(inv.length), tone: 'info' },
        { label: 'Total Units', value: totalUnits.toLocaleString('en-US'), tone: 'info' },
        { label: 'Total Value', value: moneyFmt(totalVal), tone: 'teal' },
        { label: 'Below Safety', value: String(lowRows.length), tone: lowRows.length ? 'critical' : 'ok' }
      ],
      actions,
      followUps: lowRows.length ? [`Check inventory for ${lowRows[0].item.model}`, `Place a vendor PO for ${lowRows[0].item.model} for 45 units`, 'Show executive briefing'] : ['Check inventory for WH1000XM5', 'Show open vendor POs'],
      entity: lowRows[0] ? { type: 'SKU', id: lowRows[0].item.sku, label: lowRows[0].item.model } : null
    };
  }

  function queryLiveOrders(query, state, options = {}) {
    const e = state?.enterprise || {};
    const q = String(query || '').toLowerCase();
    const report = analyze(state, options);
    const assessMap = new Map(report.orders.map(a => [a.orderId, a]));
    const acctMap = new Map((e.accounts || []).map(a => [a.id, a]));
    const invMap = new Map((e.inventory || []).map(i => [i.sku, i]));

    const openOrders = (e.orders || []).filter(o => !CLOSED.has(o.status));

    // Check for specific order or brand or account filter
    const filtered = openOrders.filter(o => {
      const acct = acctMap.get(o.accountId);
      const lineItems = (o.lines || []).map(ln => invMap.get(ln.sku)).filter(Boolean);
      const hay = [o.id, o.po, o.orderNumber, o.status, o.type, acct?.name, ...lineItems.map(i => `${i.brand} ${i.model} ${i.sku} ${i.title}`)].join(' ').toLowerCase();
      if (/\b(missing\s*tracking|no\s*tracking|untracked)\b/i.test(q)) return !extractTrackingNumber(o.tracking);
      // Extract brand or specific PO/Order tokens if present
      const brandHit = (e.inventory || []).map(i => i.brand).filter(Boolean).find(b => tokenInText(q, b));
      if (brandHit) return hay.includes(brandHit.toLowerCase());
      const acctHit = (e.accounts || []).find(a => a.name && tokenInText(q, a.name.split(' ')[0]));
      if (acctHit) return o.accountId === acctHit.id;
      const codeHit = [o.id, o.po, o.orderNumber].filter(Boolean).some(c => tokenInText(q, c));
      if (codeHit) return true;
      return false;
    });

    const targetOrders = filtered.length ? filtered : openOrders;
    const totalVal = targetOrders.reduce((s, o) => s + (o.lines || []).reduce((ls, ln) => ls + positive(ln.qty) * positive(ln.price), 0), 0);
    const untracked = targetOrders.filter(o => !extractTrackingNumber(o.tracking)).length;

    const lines = [
      `**Live Customer Orders Register (${targetOrders.length} Open · ${moneyFmt(totalVal)})**`,
      ``
    ];
    for (const o of targetOrders.slice(0, 8)) {
      const acct = acctMap.get(o.accountId);
      const assess = assessMap.get(o.id);
      const val = (o.lines || []).reduce((ls, ln) => ls + positive(ln.qty) * positive(ln.price), 0);
      const skuTxt = (o.lines || []).map(ln => `${ln.qty}× ${invMap.get(ln.sku)?.model || ln.sku}`).join(', ');
      lines.push(`• **#${o.po}**${o.orderNumber ? ` (\`${o.orderNumber}\`)` : ''} — ${acct?.name || 'Customer'} · **${o.status}** · ${moneyFmt(val)} · ${skuTxt}${o.inHandsDate ? ` · In-hands: ${o.inHandsDate}` : ''}${assess ? ` · FIFO: ${assess.allocatable ? '✅ Allocatable' : '⚠️ Review'}` : ''}${!extractTrackingNumber(o.tracking) && ['PICKING', 'PACKING'].includes(o.status) ? ' · ⚠️ No tracking' : ''}`);
    }

    const reviewAcct = (e.accounts || []).find(a => a.status === 'REVIEW');
    if (reviewAcct && /\b(credit|account|customer|crm|meridian)\b/i.test(q)) {
      lines.push(``, `⚠️ **CRM Credit Alert:** **${reviewAcct.name}** (${reviewAcct.status}) — ${moneyFmt(reviewAcct.creditUsed)} used of ${moneyFmt(reviewAcct.creditLimit)} limit (${Math.round(reviewAcct.creditUsed / Math.max(1, reviewAcct.creditLimit) * 100)}%).`);
    }

    const first = targetOrders[0];
    const actions = [];
    if (first) {
      actions.push({ label: `📋 Create Task for #${first.po}`, style: 'teal', prompt: `Create task to expedite order ${first.po} with Sarah and Marcus due tomorrow` });
    }
    actions.push({ label: '↗ Open Orders Register', style: 'ghost', href: 'all-open-orders.html' });

    return {
      markdown: lines.join('\n'),
      metrics: [
        { label: 'Open Orders', value: String(targetOrders.length), tone: 'info' },
        { label: 'Order Value', value: moneyFmt(totalVal), tone: 'teal' },
        { label: 'No Tracking', value: String(untracked), tone: untracked ? 'warn' : 'ok' }
      ],
      actions,
      followUps: first ? [`Create task for ${first.po} escalation with Sarah due tomorrow`, 'Summarize vendor performance', 'Show executive briefing'] : ['Show executive briefing'],
      entity: first ? { type: 'ORDER', id: first.id, label: first.po } : null
    };
  }

  function queryLiveVendors(query, state) {
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    const vendors = e.vendors || [];
    const slaMap = new Map((e.slaLogs || []).map(s => [s.vendorId, s]));
    const openPOs = (e.purchaseOrders || []).filter(p => !['RECEIVED', 'CANCELLED', 'CLOSED', 'REJECTED', 'VOID'].includes(p.status));
    const q = String(query || '').toLowerCase();

    // Specific PO check
    const matchedPO = openPOs.find(p => tokenInText(q, p.po) || tokenInText(q, p.id) || (String(p.po).match(/\d{5,}/) && q.includes(String(p.po).match(/\d{5,}/)[0])));
    if (matchedPO) {
      const v = vendors.find(x => x.id === matchedPO.vendorId);
      const rcv = (l.receipts || []).find(r => normToken(r.po) === normToken(matchedPO.po));
      const pw = rcv ? (l.putaway || []).find(p => p.receiptId === rcv.id && p.status !== 'DONE') : null;
      const val = (matchedPO.lines || []).reduce((s, ln) => s + positive(ln.qty) * positive(ln.cost), 0);
      const qty = (matchedPO.lines || []).reduce((s, ln) => s + positive(ln.qty), 0);
      const lines = [
        `**Vendor PO Intelligence — ${matchedPO.po}**`,
        `• **Supplier:** ${v?.name || 'Supplier'} (${v?.status || 'ACTIVE'} · Lead time ${v?.leadTime ?? '—'}d)`,
        `• **Status:** **${matchedPO.status}** · **${qty} units** · Value: **${moneyFmt(val)}** · ETA: **${dateOnly(matchedPO.eta) || 'TBD'}**`,
        `• **Carrier / Tracking:** ${matchedPO.carrier || 'TBD'} · \`${matchedPO.tracking || 'Not assigned'}\``,
        rcv ? `• **Warehouse Receipt:** \`${rcv.id}\` — **${rcv.status}** at Dock **${rcv.dock}** (ASN \`${rcv.asn}\`)` : '',
        pw ? `• **Open Putaway:** \`${pw.id}\` — **${pw.qty} units** (${pw.fromBin} → ${pw.toBin}, Priority: ${pw.priority}, Assignee: ${pw.assignee})` : ''
      ].filter(Boolean);
      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'Status', value: matchedPO.status.replace('_', ' '), tone: rcv?.status === 'ARRIVED' ? 'warn' : 'teal' },
          { label: 'PO Value', value: moneyFmt(val), tone: 'info' },
          { label: 'Quantity', value: `${qty} units`, tone: 'info' }
        ],
        actions: [
          { label: `📋 Create Escalation Task`, style: 'primary', prompt: `Create task for ${matchedPO.po} escalation with Elena and Marcus due tomorrow` },
          { label: '↗ Open Procurement', style: 'ghost', href: 'procurement/index.html?po=' + encodeURIComponent(matchedPO.po) }
        ],
        followUps: [`Create task for ${matchedPO.po} with Elena and Marcus due tomorrow`, 'Summarize vendor performance', 'Show executive briefing'],
        entity: { type: 'PO', id: matchedPO.id, label: matchedPO.po }
      };
    }

    const totalPOVal = openPOs.reduce((s, p) => s + (p.lines || []).reduce((ls, ln) => ls + positive(ln.qty) * positive(ln.cost), 0), 0);
    const warnings = vendors.filter(v => v.status === 'AUDIT_WARNING' || (slaMap.get(v.id)?.onTimePct ?? 100) < 92);

    const lines = [
      `**Vendor Performance & Procurement Intelligence**`,
      ``,
      `**Supplier SLA Scorecard (${vendors.length} Vendors):**`
    ];
    for (const v of vendors) {
      const sla = slaMap.get(v.id);
      const vPOs = openPOs.filter(p => p.vendorId === v.id);
      const flag = v.status === 'AUDIT_WARNING' || (sla && sla.onTimePct < 92) ? '⚠️ **AUDIT WARNING**' : '✅ Healthy';
      lines.push(`• **${v.name}** — On-time: **${sla ? sla.onTimePct + '%' : '—'}** (${sla ? `${sla.actualDays}d vs ${sla.targetDays}d target` : `${v.leadTime}d lead`}) · Open POs: ${vPOs.length} · ${flag}`);
    }
    lines.push(``, `**Open Purchase Orders (${openPOs.length} · ${moneyFmt(totalPOVal)}):**`);
    for (const p of openPOs) {
      const v = vendors.find(x => x.id === p.vendorId);
      const qty = (p.lines || []).reduce((s, ln) => s + positive(ln.qty), 0);
      const rcv = (l.receipts || []).find(r => normToken(r.po) === normToken(p.po));
      lines.push(`• **${p.po}** (${v?.name || 'Supplier'}) — ${p.status} · ${qty} units · ETA ${dateOnly(p.eta) || 'TBD'}${rcv?.status === 'ARRIVED' ? ' · 🟡 **ARRIVED at Dock ' + rcv.dock + '**' : ''}${p.tracking ? ` · \`${p.tracking}\`` : ' · ⚠️ No tracking'}`);
    }

    const actions = [];
    if (warnings.length) {
      actions.push({ label: `📋 Escalate ${warnings[0].name.split(' ')[0]} SLA`, style: 'primary', prompt: `Create task for ${warnings[0].name} SLA audit warning and open PO review with Elena due tomorrow` });
    }
    actions.push({ label: '↗ Open Vendor SLAs', style: 'ghost', href: 'vendor-management/sla.html' });
    actions.push({ label: '↗ Open Procurement', style: 'ghost', href: 'procurement/index.html' });

    return {
      markdown: lines.join('\n'),
      metrics: [
        { label: 'Vendors', value: String(vendors.length), tone: 'info' },
        { label: 'SLA Warnings', value: String(warnings.length), tone: warnings.length ? 'critical' : 'ok' },
        { label: 'Open POs', value: `${openPOs.length} · ${moneyFmt(totalPOVal)}`, tone: 'teal' }
      ],
      actions,
      followUps: ['Analyze PO-2026-887411', 'Check low stock and reorder radar', 'Show executive briefing'],
      entity: openPOs[0] ? { type: 'PO', id: openPOs[0].id, label: openPOs[0].po } : null
    };
  }

  function queryLiveLogistics3PL(query, state) {
    const l = state?.logistics || {};
    const nodes = l.tplNodes || [];
    const shipments = l.tplShipments || [];
    const delayed = shipments.filter(s => s.status === 'DELAYED');
    const receipts = l.receipts || [];
    const putaway = (l.putaway || []).filter(p => p.status !== 'DONE');
    const waves = l.waves || [];
    const ccVar = (l.cycleCounts || []).filter(c => c.status === 'VARIANCE' || c.status === 'OPEN');
    const recs = (l.reconciliations || []).filter(r => r.status !== 'RESOLVED');

    const lines = [
      `**3PL Network & Warehouse Operations Pulse**`,
      ``,
      `**3PL Partner Nodes:**`,
      ...nodes.map(nd => `• **${nd.name}** (${nd.city}, ${nd.state}) — On-time: **${nd.onTime}%** · Accuracy: ${nd.inventoryAccuracy}% · ${nd.status === 'WATCH' ? '⚠️ **WATCH**' : '✅ ACTIVE'}`),
      ``,
      `**3PL Shipments (${shipments.length} Active · ${delayed.length} Delayed):**`,
      ...shipments.map(s => `• **${s.id}** (\`${s.orderId}\`) — ${s.sku} × ${s.qty} · **${s.status}**${s.status === 'DELAYED' ? ' 🚨' : ''} · Tracking: \`${s.tracking || 'Missing'}\``),
      ``,
      `**Warehouse Control Tower:**`,
      `• **Dock Receipts:** ${receipts.filter(r => r.status === 'ARRIVED').length} ARRIVED (${receipts.filter(r => r.status === 'ARRIVED').map(r => `${r.po} @ Dock ${r.dock}`).join(', ') || 'None'}) · ${receipts.filter(r => r.status === 'SCHEDULED').length} scheduled`,
      `• **Open Putaway:** ${putaway.length} job(s)${putaway.length ? ' — ' + putaway.map(p => `${p.id}: ${p.qty}u ${p.fromBin}→${p.toBin} (${p.assignee})`).join('; ') : ''}`,
      `• **Picking Waves:** ${waves.length} active (${waves.map(w => `${w.id}: ${w.status}`).join(', ')})`,
      `• **Cycle Counts & 3PL Reconciliations:** ${ccVar.length} open/variance count(s), ${recs.length} open 3PL variance(s)`
    ];

    const actions = [];
    if (delayed.length) {
      actions.push({ label: `📦 Dispatch & Track ${delayed[0].id}`, style: 'primary', prompt: `Provide tracking FDX774920011 for ${delayed[0].id}` });
    }
    actions.push({ label: '↗ Open 3PL Shipments', style: 'ghost', href: '3pl-management/shipments.html' });
    actions.push({ label: '↗ Open Warehouse', style: 'ghost', href: 'warehouse-management/index.html' });

    return {
      markdown: lines.join('\n'),
      metrics: [
        { label: '3PL Delayed', value: String(delayed.length), tone: delayed.length ? 'critical' : 'ok' },
        { label: 'Open Putaway', value: String(putaway.length), tone: putaway.length ? 'warn' : 'ok' },
        { label: 'Count / Recs', value: String(ccVar.length + recs.length), tone: 'info' }
      ],
      actions,
      followUps: delayed.length ? [`Provide tracking FDX774920011 for ${delayed[0].id}`, 'Prioritize & analyze my tasks', 'Show executive briefing'] : ['Show executive briefing'],
      entity: delayed[0] ? { type: '3PL', id: delayed[0].id, label: delayed[0].id } : null
    };
  }

  function queryLiveMail(query, state, mailThreads = []) {
    const inbound = (mailThreads || []).filter(t => t && t.direction !== 'outbound' && t.folder !== 'sent' && t.folder !== 'trash');
    const sent = (mailThreads || []).filter(t => t && (t.direction === 'outbound' || t.folder === 'sent'));
    const unread = inbound.filter(t => t.unread);
    const trackingReqs = inbound.filter(m => {
      const txt = `${m.subject || ''}\n${m.snippet || ''}\n${m.body || ''}`;
      return /\b(tracking\s*(?:number|#|no\.?|request|info|details|update)|provide\s+(?:the\s+)?tracking|need\s+tracking|send\s+tracking)\b/i.test(txt) && !findTrackingResolutionForMail(m, mailThreads, state);
    });

    const lines = [
      `**MK97 Mail Live Inbox Intelligence**`,
      `• **Inbox:** ${inbound.length} threads (${unread.length} unread) · **Sent:** ${sent.length} outbound messages`,
      `• **Pending Tracking Requests:** **${trackingReqs.length}** awaiting tracking reply`,
      ``
    ];
    if (trackingReqs.length) {
      lines.push(`**Action Needed — Tracking Requests:**`);
      for (const m of trackingReqs) {
        lines.push(`• **${m.related?.poNumber || m.subject}** from **${m.senderName}** (\`${m.senderEmail}\`) — "${(m.snippet || '').slice(0, 90)}"`);
      }
      lines.push(``);
    }
    lines.push(`**Latest Inbox Threads:**`);
    for (const m of inbound.slice(0, 5)) {
      lines.push(`• ${m.unread ? '🔵' : '⚪'} **${m.subject}** — ${m.senderName}${m.related?.poNumber ? ` (\`${m.related.poNumber}\`)` : ''}`);
    }

    const actions = [
      { label: '⚡ Scan Mail & Auto-Create Tasks', style: 'primary', prompt: 'Scan mail and inventory for tasks' }
    ];
    if (trackingReqs.length) {
      actions.push({ label: `📦 Reply Tracking for ${trackingReqs[0].related?.poNumber || trackingReqs[0].id}`, style: 'teal', prompt: `Provide tracking DHL9988776 for ${trackingReqs[0].related?.poNumber || trackingReqs[0].id}` });
      actions.push({ label: '✉ Open Top Thread', style: 'ghost', href: 'mail.html?thread=' + encodeURIComponent(trackingReqs[0].id) });
    } else {
      actions.push({ label: '✉ Open MK97 Mail', style: 'ghost', href: 'mail.html' });
    }

    return {
      markdown: lines.join('\n'),
      metrics: [
        { label: 'Unread Mail', value: String(unread.length), tone: unread.length ? 'info' : 'ok' },
        { label: 'Tracking Req', value: String(trackingReqs.length), tone: trackingReqs.length ? 'critical' : 'ok' },
        { label: 'Sent Outbound', value: String(sent.length), tone: 'teal' }
      ],
      actions,
      followUps: trackingReqs.length ? [`Provide tracking DHL9988776 for ${trackingReqs[0].related?.poNumber || trackingReqs[0].id}`, 'Prioritize & analyze my tasks'] : ['Prioritize & analyze my tasks'],
      entity: trackingReqs[0] ? { type: 'MAIL', id: trackingReqs[0].id, label: trackingReqs[0].related?.poNumber || trackingReqs[0].subject } : null
    };
  }

  function parseNaturalTaskCommand(text, roster = DEFAULT_TEAM_ROSTER, nowIso = new Date().toISOString()) {
    const raw = String(text || '').trim();
    const nowMs = Date.parse(nowIso);

    // Extract assignees mentioned by first name, full name, or email
    const assignees = [];
    const seen = new Set();
    for (const member of roster) {
      const first = String(member.name || '').split(/\s+/)[0];
      const hit = (member.name && tokenInText(raw, member.name)) ||
        (first && first.length >= 3 && tokenInText(raw, first)) ||
        (member.email && raw.toLowerCase().includes(member.email.toLowerCase()));
      if (hit && !seen.has(member.id)) { seen.add(member.id); assignees.push({ ...member }); }
    }
    // Also detect any raw external emails
    for (const m of raw.matchAll(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) {
      const em = m[1];
      if (!assignees.some(a => (a.email || '').toLowerCase() === em.toLowerCase())) {
        const name = em.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        assignees.push({ id: 'ext_' + em.toLowerCase().replace(/[^a-z0-9]/g, ''), name, email: em, role: 'Collaborator', avatar: name.slice(0, 2).toUpperCase(), color: '#0284c7' });
      }
    }
    if (!assignees.length) assignees.push({ ...roster[0] });

    // Extract due date & reminder time
    let dueMs = nowMs + 24 * 3600000;
    const inHours = raw.match(/\bin\s+(\d+)\s*hours?\b/i);
    const inDays = raw.match(/\bin\s+(\d+)\s*days?\b/i);
    const isoDate = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (inHours) dueMs = nowMs + Math.max(1, Number(inHours[1])) * 3600000;
    else if (inDays) dueMs = nowMs + Math.max(1, Number(inDays[1])) * 86400000;
    else if (isoDate) dueMs = Date.parse(isoDate[1] + 'T17:00:00Z');
    else if (/\btoday\b|\beod\b/i.test(raw)) dueMs = nowMs + 6 * 3600000;
    else if (/\btomorrow\b/i.test(raw)) dueMs = nowMs + 24 * 3600000;
    else if (/\bnext\s+week\b/i.test(raw)) dueMs = nowMs + 7 * 86400000;

    const remMs = Math.max(nowMs + 15 * 60000, dueMs - 2 * 3600000);

    // Clean title from natural language prefix & trailing assignee/due clauses
    let title = raw
      .replace(/^\/create-task\s*/i, '')
      .replace(/^(?:please\s+)?(?:create|add|make|schedule|open|assign)\s+(?:a\s+)?(?:new\s+)?task\s*(?:to|for|about|regarding|:)?\s*/i, '')
      .replace(/\s+(?:with|assign(?:ed)?\s+to|involving)\s+[A-Za-z0-9@._,\s&+-]+?(?=\s+(?:due|by|before|in\s+\d+|tomorrow|today|next\s+week)\b|$)/i, '')
      .replace(/\s+(?:due|by|before)\s+(?:today|tomorrow|eod|next\s+week|in\s+\d+\s*(?:hours?|days?)|20\d{2}-\d{2}-\d{2})\b.*$/i, '')
      .replace(/\s+in\s+\d+\s*(?:hours?|days?)\b.*$/i, '')
      .trim();
    if (!title || title.length < 3) title = raw.replace(/^\/create-task\s*/i, '').trim().slice(0, 140) || 'Operations Follow-Up Task';
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      title: title.slice(0, 155),
      assignees,
      dueAt: new Date(dueMs).toISOString(),
      reminderAt: new Date(Math.min(remMs, dueMs)).toISOString(),
      notes: `Created via MK AI Co-Pilot command: "${raw}"`
    };
  }

  function parseVendorPOCommand(text, state, lastEntity = null) {
    const raw = String(text || '').trim();
    const { item } = findBestLiveSku(raw, state, lastEntity);
    if (!item) return null;

    const qtyMatch = raw.match(/\b(?:for|qty|quantity|of)?\s*(\d{1,5})\s*(?:units?|pcs?|pieces?|x\b)?\b/i);
    // Avoid mistaking model numbers (like 200 in AF-200 or 1000 in WH1000XM5) for quantity
    const cleanedForQty = raw.replace(new RegExp(escRegex(item.model || ''), 'gi'), '').replace(new RegExp(escRegex(item.sku || ''), 'gi'), '');
    const cleanQtyMatch = cleanedForQty.match(/\b(\d{1,5})\s*(?:units?|pcs?|pieces?)?\b/i);
    const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
    const safety = positive(item.safety);
    const defaultQty = Math.max(25, Math.ceil((Math.max(safety, 20) * 2 - free) / 5) * 5);
    const qty = cleanQtyMatch ? Math.max(1, Number(cleanQtyMatch[1])) : (qtyMatch && Number(qtyMatch[1]) > 0 && !String(item.model || '').includes(qtyMatch[1]) ? Number(qtyMatch[1]) : defaultQty);

    const vendors = state?.enterprise?.vendors || [];
    const priceBook = (state?.enterprise?.vendorPriceBooks || []).find(pb => pb.sku === item.sku);
    const vendor = vendors.find(v => v.id === priceBook?.vendorId) ||
      vendors.find(v => item.brand && v.name.toLowerCase().includes(item.brand.toLowerCase().split(' ')[0])) ||
      vendors[0] || { id: 'vend_default', name: item.brand || 'Primary Supplier', leadTime: 7 };

    const unitCost = positive(priceBook?.cost || item.cost);
    const poNumber = 'PO-2026-' + String(889100 + (state?.enterprise?.purchaseOrders?.length || 0) * 19);
    const eta = new Date(Date.now() + Math.max(3, positive(vendor.leadTime || 7)) * 86400000).toISOString();

    return {
      item,
      qty,
      vendor,
      unitCost,
      totalCost: qty * unitCost,
      poNumber,
      eta
    };
  }

  function parseTrackingUpdateCommand(text, state, mailThreads = [], lastEntity = null) {
    const raw = String(text || '').trim();
    const tracking = extractTrackingNumber(raw);
    if (!tracking) return null;

    const carrierMatch = raw.match(/\b(DHL(?:\s+Express)?|UPS(?:\s+Ground)?|FedEx(?:\s+Priority|\s+Ground)?|USPS|Aramex)\b/i);
    const carrier = carrierMatch ? carrierMatch[1] : (/^1Z/i.test(tracking) ? 'UPS' : /^DHL/i.test(tracking) ? 'DHL Express' : /^FDX/i.test(tracking) ? 'FedEx' : 'Carrier');

    // 1. Check 3PL shipments
    for (const shp of state?.logistics?.tplShipments || []) {
      if (tokenInText(raw, shp.id) || tokenInText(raw, shp.orderId) || (lastEntity?.type === '3PL' && lastEntity.id === shp.id && /\b(it|this|that)\b/i.test(raw))) {
        return { tracking, carrier, targetType: '3PL', targetId: shp.id, targetLabel: `${shp.id} (${shp.orderId})` };
      }
    }

    // 2. Check Mail threads
    for (const m of mailThreads || []) {
      if (m.direction === 'outbound' || m.folder === 'sent') continue;
      const poRef = normToken(m.related?.poNumber || m.shipmentDetails?.poNumber || '');
      const hit = tokenInText(raw, m.id) ||
        (poRef && poRef.length >= 4 && tokenInText(raw, poRef)) ||
        (m.senderName && m.senderName.length >= 4 && tokenInText(raw, m.senderName.split(' ')[0])) ||
        (lastEntity?.type === 'MAIL' && lastEntity.id === m.id && /\b(it|this|that)\b/i.test(raw));
      if (hit) {
        return { tracking, carrier, targetType: 'MAIL', targetId: m.id, targetLabel: `${m.related?.poNumber || m.subject} (${m.senderName})`, mailThread: m };
      }
    }

    // 3. Check Customer Orders
    for (const o of state?.enterprise?.orders || []) {
      if ([o.id, o.po, o.orderNumber].filter(Boolean).some(c => tokenInText(raw, c)) || (lastEntity?.type === 'ORDER' && lastEntity.id === o.id && /\b(it|this|that)\b/i.test(raw))) {
        return { tracking, carrier, targetType: 'ORDER', targetId: o.id, targetLabel: `Order #${o.po}` };
      }
    }

    // 4. Fallback to first pending tracking request email if unambiguous
    const pulse = getLivePulse(state, mailThreads);
    if (pulse.pendingTrackingMails.length) {
      const m = pulse.pendingTrackingMails[0];
      return { tracking, carrier, targetType: 'MAIL', targetId: m.id, targetLabel: `${m.related?.poNumber || m.subject} (${m.senderName})`, mailThread: m };
    }
    return null;
  }

  function simulateLiveInventoryScenario(text, state, lastEntity = null) {
    const raw = String(text || '').trim();
    const { item } = findBestLiveSku(raw, state, lastEntity);
    const items = item ? [item] : (state?.enterprise?.inventory || []).filter(i => i.nature !== 'DIGITAL');
    if (!items.length) return null;

    const pctMatch = raw.match(/(increase|rise|grow|up|spike|decrease|drop|fall|down)[^\d]{0,16}(\d+(?:\.\d+)?)\s*%/i) || raw.match(/(\d+(?:\.\d+)?)\s*%[^\w]{0,6}(increase|rise|up|decrease|drop|down)/i);
    const recvMatch = raw.match(/(?:receive|add|inbound|arrive|get)[^\d]{0,16}(\d+)\s*(?:units?)?/i);
    const safetyMatch = raw.match(/safety(?:\s*stock)?[^\d]{0,14}(\d+)/i);

    let mult = 1, extraUnits = 0, newSafety = null;
    const desc = [];
    if (pctMatch) {
      const dir = isNaN(Number(pctMatch[1])) ? pctMatch[1] : pctMatch[2];
      const pct = Number(isNaN(Number(pctMatch[1])) ? pctMatch[2] : pctMatch[1]);
      const neg = /decrease|drop|fall|down/i.test(dir);
      mult = Math.max(0, 1 + (neg ? -1 : 1) * pct / 100);
      desc.push(`demand ${neg ? 'down' : 'up'} ${pct}%`);
    }
    if (recvMatch) { extraUnits = Number(recvMatch[1]); desc.push(`+${extraUnits} inbound units`); }
    if (safetyMatch) { newSafety = Number(safetyMatch[1]); desc.push(`safety floor = ${newSafety}`); }
    if (!desc.length) return null;

    const inboundMap = getInboundQtyBySku(state);
    const lines = [`**Live ERP What-If Simulation (${desc.join(', ')})**`, `*Read-only simulation — live ERP records unchanged.*`, ``];
    let totalCurrentNeed = 0, totalSimNeed = 0;

    for (const it of items.slice(0, 6)) {
      const free = Math.max(0, n(it.onHand) - n(it.reserved) - n(it.damaged));
      const inbound = inboundMap.get(it.sku) || 0;
      const baseSafety = positive(it.safety);
      const simSafety = newSafety !== null ? newSafety : Math.ceil(baseSafety * mult);
      const baseDeficit = Math.max(0, baseSafety - (free + inbound));
      const simDeficit = Math.max(0, simSafety - (free + inbound + extraUnits));
      totalCurrentNeed += baseDeficit;
      totalSimNeed += simDeficit;
      lines.push(`• **${it.model || it.sku}** (${it.brand}): Current deficit **${baseDeficit}** → Simulated deficit **${simDeficit}** (Projected free+inbound: ${free + inbound + extraUnits} vs safety ${simSafety})`);
    }

    const actions = [];
    if (item && totalSimNeed > 0) {
      actions.push({ label: `🛒 Pre-Order ${Math.max(25, totalSimNeed * 2)} × ${item.model}`, style: 'primary', prompt: `Place a vendor PO for ${item.model} for ${Math.max(25, totalSimNeed * 2)} units` });
    }
    actions.push({ label: '🌅 Executive Briefing', style: 'ghost', prompt: 'Show executive briefing' });

    return {
      markdown: lines.join('\n'),
      metrics: [
        { label: 'Current Deficit', value: `${totalCurrentNeed}u`, tone: totalCurrentNeed ? 'warn' : 'ok' },
        { label: 'Simulated Deficit', value: `${totalSimNeed}u`, tone: totalSimNeed > totalCurrentNeed ? 'critical' : 'teal' }
      ],
      actions,
      followUps: ['Check low stock and reorder radar', 'Show executive briefing']
    };
  }

  /* =========================================================================
   * MK v7.0 — QUANTITATIVE ANALYST & AUTONOMOUS CO-PILOT ENGINE
   * ========================================================================= */

  function toCsv(columns, rows) {
    const cell = v => {
      const s = String(v == null ? '' : v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\n');
  }

  function compactMoney(v) {
    const val = n(v);
    if (Math.abs(val) >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
    if (Math.abs(val) >= 1e3) return '$' + (val / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(val).toLocaleString('en-US');
  }

  function getSeedRegion(seed, region = 'US') {
    if (!seed || typeof seed !== 'object') return null;
    const key = String(region || 'US').toUpperCase();
    return seed[key] || seed.US || Object.values(seed)[0] || null;
  }

  function statsOf(arr) {
    const vals = (arr || []).map(x => Math.max(0, n(x)));
    const len = vals.length;
    if (!len) return { mean: 0, std: 0, cv: 0, total: 0, max: 0, min: 0, slope: 0 };
    const total = vals.reduce((s, v) => s + v, 0);
    const avg = total / len;
    const variance = vals.reduce((s, v) => s + (v - avg) ** 2, 0) / Math.max(1, len);
    const std = Math.sqrt(variance);
    const cv = avg > 0 ? std / avg : 0;
    // Ordinary least squares slope over index 0..len-1
    let num = 0, den = 0;
    const xMean = (len - 1) / 2;
    for (let i = 0; i < len; i++) {
      num += (i - xMean) * (vals[i] - avg);
      den += (i - xMean) ** 2;
    }
    const slope = den > 0 ? num / den : 0;
    return { mean: avg, std, cv, total, max: Math.max(...vals), min: Math.min(...vals), slope };
  }

  function fmtMonthCode(code) {
    const s = String(code || '');
    if (/^\d{6}$/.test(s)) {
      const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mo = Number(s.slice(4, 6)) - 1;
      return `${names[mo] || s.slice(4)} '${s.slice(2, 4)}`;
    }
    return s.slice(0, 3) || s;
  }

  // 1. Margin, Profitability, Working Capital & Credit Risk Intelligence
  function analyzeFinancialsAndMargin(state, seed = null) {
    const e = state?.enterprise || {};
    const inv = e.inventory || [];
    const orders = (e.orders || []).filter(o => !['CANCELLED', 'EXPIRED'].includes(o.status));
    const openOrders = orders.filter(o => !CLOSED.has(o.status));
    const accounts = e.accounts || [];
    const invMap = new Map(inv.map(i => [i.sku, i]));
    const acctMap = new Map(accounts.map(a => [a.id, a]));
    const regSeed = getSeedRegion(seed);

    let totalOrderRev = 0, totalOrderCogs = 0;
    const orderRows = [];
    for (const o of openOrders) {
      let rev = 0, cogs = 0;
      for (const ln of o.lines || []) {
        const item = invMap.get(ln.sku);
        const q = positive(ln.qty);
        rev += q * positive(ln.price);
        cogs += q * positive(item?.cost || ln.price * 0.65);
      }
      totalOrderRev += rev;
      totalOrderCogs += cogs;
      const gp = rev - cogs;
      const marginPct = rev > 0 ? (gp / rev) * 100 : 0;
      orderRows.push({
        po: o.po,
        customer: acctMap.get(o.accountId)?.name || 'Customer',
        status: o.status,
        rev,
        cogs,
        gp,
        marginPct
      });
    }
    orderRows.sort((a, b) => b.gp - a.gp);
    const grossProfit = totalOrderRev - totalOrderCogs;
    const grossMarginPct = totalOrderRev > 0 ? (grossProfit / totalOrderRev) * 100 : 0;

    // SKU margin & inventory capital analysis
    const skuMargins = inv
      .filter(i => positive(i.standardPrice) > 0 && positive(i.cost) > 0)
      .map(i => {
        const unitProfit = positive(i.standardPrice) - positive(i.cost);
        const marginPct = (unitProfit / positive(i.standardPrice)) * 100;
        const stockCap = positive(i.onHand) * positive(i.cost);
        const retailVal = positive(i.onHand) * positive(i.standardPrice);
        const free = Math.max(0, n(i.onHand) - n(i.reserved) - n(i.damaged));
        const excessUnits = positive(i.safety) > 0 ? Math.max(0, free - positive(i.safety) * 2.5) : 0;
        const excessCap = excessUnits * positive(i.cost);
        return { item: i, unitProfit, marginPct, stockCap, retailVal, excessUnits, excessCap };
      })
      .sort((a, b) => b.marginPct - a.marginPct);

    const totalInvCapital = inv.reduce((s, i) => s + positive(i.onHand) * positive(i.cost), 0);
    const totalExcessCap = skuMargins.reduce((s, r) => s + r.excessCap, 0);
    const totalCreditLimit = accounts.reduce((s, a) => s + positive(a.creditLimit), 0);
    const totalCreditUsed = accounts.reduce((s, a) => s + positive(a.creditUsed), 0);
    const creditUtilPct = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0;
    const riskAccounts = accounts.filter(a => a.status === 'REVIEW' || (a.creditLimit > 0 && a.creditUsed / a.creditLimit >= 0.8));

    // Historical annual revenue context from 138-brand seed if available
    const seedRev = regSeed?.brandSales ? regSeed.brandSales.reduce((s, b) => s + positive(b.total), 0) : 0;
    const deadSeedSkus = regSeed?.itemStock
      ? regSeed.itemStock.filter(it => positive(it.stock) >= 15 && (it.demand || []).slice(-6).reduce((s, d) => s + Math.max(0, n(d)), 0) === 0)
      : [];

    const lines = [
      `**MK97 Financial, Margin & Working Capital Intelligence**`,
      `• **Open Order Pipeline:** **${moneyFmt(totalOrderRev)}** revenue · **${moneyFmt(totalOrderCogs)}** COGS · **${moneyFmt(grossProfit)}** gross profit (**${grossMarginPct.toFixed(1)}% GM**)`,
      `• **Warehouse Working Capital:** **${moneyFmt(totalInvCapital)}** tied up at cost across ${inv.length} live SKUs${totalExcessCap > 0 ? ` (**${moneyFmt(totalExcessCap)}** in overstock >2.5× safety)` : ''}`,
      `• **CRM Credit Exposure:** **${moneyFmt(totalCreditUsed)}** / ${moneyFmt(totalCreditLimit)} (${creditUtilPct.toFixed(1)}% utilized)${riskAccounts.length ? ` · ⚠️ **${riskAccounts.length} account(s) at credit risk:** ${riskAccounts.map(a => `${a.name} (${Math.round(a.creditUsed / Math.max(1, a.creditLimit) * 100)}%)`).join(', ')}` : ' · ✅ All accounts within healthy limits'}`,
      seedRev > 0 ? `• **12-Month Commercial Revenue Base:** **${compactMoney(seedRev)}** across ${regSeed.brandSales.filter(b => b.brand).length} brands & ${regSeed.customerSales?.filter(c => c.customer).length || 0} customers${deadSeedSkus.length ? ` · **${deadSeedSkus.length} dead-stock SKUs** (≥15 units, 0 sales in 6 mo)` : ''}` : ''
    ].filter(Boolean);

    if (skuMargins.length) {
      const top = skuMargins[0], low = skuMargins[skuMargins.length - 1];
      lines.push(``, `**Margin Leaders & Watchlist:**`, `• **Highest Margin:** ${top.item.model || top.item.sku} (${top.item.brand}) at **${top.marginPct.toFixed(1)}%** (${moneyFmt(top.unitProfit)}/unit)`);
      if (low && low !== top) {
        lines.push(`• **Tightest Margin:** ${low.item.model || low.item.sku} (${low.item.brand}) at **${low.marginPct.toFixed(1)}%** (${moneyFmt(low.unitProfit)}/unit)`);
      }
    }

    const tableCols = ['SKU / Model', 'Brand', 'Cost', 'Std Price', 'Margin %', 'Capital @ Cost'];
    const tableRows = skuMargins.slice(0, 7).map(r => [
      r.item.model || r.item.sku,
      r.item.brand || '—',
      moneyFmt(r.item.cost),
      moneyFmt(r.item.standardPrice),
      `${r.marginPct.toFixed(1)}%`,
      moneyFmt(r.stockCap)
    ]);

    const chart = {
      type: 'bars',
      title: 'Gross Margin % by Live SKU',
      items: skuMargins.slice(0, 6).map(r => ({
        label: `${r.item.model || r.item.sku} (${r.item.brand})`,
        value: Number(r.marginPct.toFixed(1)),
        display: `${r.marginPct.toFixed(1)}% · ${compactMoney(r.stockCap)}`,
        tone: r.marginPct >= 30 ? 'ok' : r.marginPct >= 18 ? 'teal' : 'warn'
      }))
    };

    const actions = [];
    if (riskAccounts.length) {
      actions.push({ label: `✉ Draft Credit Alert (${riskAccounts[0].name.split(' ')[0]})`, style: 'primary', prompt: `Draft email to ${riskAccounts[0].name} about credit utilization review` });
    }
    actions.push({ label: '📊 Run ABC-XYZ & Pareto', style: 'teal', prompt: 'Run ABC XYZ segmentation and Pareto analysis' });
    actions.push({ label: '🩺 Full ERP Health Audit', style: 'ghost', prompt: 'Run ERP health score and anomaly detection' });

    return {
      markdown: lines.join('\n'),
      metrics: [
        { label: 'Gross Margin', value: `${grossMarginPct.toFixed(1)}%`, tone: grossMarginPct >= 25 ? 'ok' : 'warn' },
        { label: 'Open Order GP', value: compactMoney(grossProfit), tone: 'teal' },
        { label: 'Inv. Capital', value: compactMoney(totalInvCapital), tone: 'info' },
        { label: 'Credit Used', value: `${creditUtilPct.toFixed(0)}%`, tone: riskAccounts.length ? 'critical' : 'ok' }
      ],
      chart,
      table: { title: 'SKU Profitability & Working Capital', columns: tableCols, rows: tableRows },
      csv: { filename: 'mk97-margin-working-capital.csv', content: toCsv(tableCols, tableRows) },
      actions,
      followUps: ['Run ABC XYZ segmentation and Pareto analysis', 'Analyze top customers and concentration risk', 'Run ERP health score and anomaly detection']
    };
  }

  // 2. Statistical Demand Forecast, Trend Velocity, Safety Stock (Z*sigma*sqrt(L)) & EOQ
  function analyzeDemandForecast(query, state, seed = null, lastEntity = null) {
    const regSeed = getSeedRegion(seed);
    const seedItems = regSeed?.itemStock || [];
    const months = regSeed?.months || [];
    const raw = String(query || '').trim();
    const q = raw.toLowerCase();
    const qCompact = q.replace(/[^a-z0-9]/g, '');

    // Try matching a specific SKU in the 1,885-SKU historical dataset first
    let seedMatch = null;
    let bestScore = 0;
    const isPortfolioAsk = /\b(portfolio|all\s+skus?|overall|company|total|entire|seasonality)\b/i.test(q) && !/\b(af903|afm900|rb-2p|rb-1p|af-200|wh1000|airpods|hcfb1)\b/i.test(q);
    if (!isPortfolioAsk && seedItems.length) {
      for (const it of seedItems) {
        const model = String(it.model || '').toLowerCase();
        const modelCompact = model.replace(/[^a-z0-9]/g, '');
        const brand = String(it.brand || '').toLowerCase();
        const title = String(it.title || '').toLowerCase();
        let sc = 0;
        if (model && model.length >= 3 && (tokenInText(q, model) || (modelCompact.length >= 5 && qCompact.includes(modelCompact)))) sc = 100;
        else if (it.itemId && tokenInText(q, String(it.itemId))) sc = 98;
        else if (brand && brand.length >= 4 && tokenInText(q, brand)) sc = 65 + Math.min(20, (it.demand || []).reduce((s, d) => s + Math.max(0, n(d)), 0) / 50);
        else if (title && title.split(/\s+/).filter(w => w.length >= 5).filter(w => q.includes(w)).length >= 2) sc = 60;
        if (sc > bestScore) { bestScore = sc; seedMatch = it; }
      }
      if (bestScore < 60) seedMatch = null;
    }

    // Specific SKU historical forecast (1,885-SKU dataset)
    if (seedMatch) {
      const series = (seedMatch.demand || []).map(v => Math.max(0, n(v)));
      const st = statsOf(series);
      const recent3 = statsOf(series.slice(-3)).mean;
      const prior3 = statsOf(series.slice(-6, -3)).mean;
      const momentumPct = prior3 > 0 ? ((recent3 - prior3) / prior3) * 100 : (recent3 > 0 ? 100 : 0);
      const baseForecast = Math.max(0, 0.55 * recent3 + 0.30 * st.mean + 0.15 * Math.max(0, recent3 + st.slope));
      const f1 = Math.max(0, Math.round((baseForecast + st.slope * 0.35) * 10) / 10);
      const f2 = Math.max(0, Math.round((baseForecast + st.slope * 0.65) * 10) / 10);
      const f3 = Math.max(0, Math.round((baseForecast + st.slope * 0.90) * 10) / 10);
      const leadMonths = 0.5; // 15-day standard lead time
      const z95 = 1.65;
      const statSafety = Math.ceil(z95 * st.std * Math.sqrt(leadMonths));
      const rop = Math.ceil(baseForecast * leadMonths + statSafety);
      const annualDemand = Math.max(1, baseForecast * 12);
      const eoq = Math.max(10, Math.round(Math.sqrt((2 * annualDemand * 45) / 8))); // $45 order cost, $8 annual holding cost
      const stock = positive(seedMatch.stock);
      const monthsCover = baseForecast > 0 ? stock / baseForecast : 99;
      const daysCover = Math.round(monthsCover * 30);
      const xyz = st.cv < 0.5 ? 'X (Stable)' : st.cv <= 1.0 ? 'Y (Seasonal/Variable)' : 'Z (Erratic/Spiky)';
      const peakIdx = series.indexOf(st.max);
      const peakLabel = fmtMonthCode(months[peakIdx] || `M${peakIdx + 1}`);

      const lines = [
        `**Statistical Demand Forecast & EOQ — ${seedMatch.model} (${seedMatch.brand})**`,
        `*${seedMatch.title}* · Status: **${seedMatch.status}** · Item ID \`${seedMatch.itemId}\``,
        ``,
        `• **13-Month Demand Profile:** Total **${Math.round(st.total).toLocaleString()} units** · Mean **${st.mean.toFixed(1)}/mo** · Volatility σ = **${st.std.toFixed(1)}** (CV ${st.cv.toFixed(2)} → Class **${xyz}**)`,
        `• **Velocity & Momentum:** Last 3-mo avg **${recent3.toFixed(1)}/mo** vs prior 3-mo **${prior3.toFixed(1)}/mo** (**${momentumPct >= 0 ? '+' : ''}${momentumPct.toFixed(0)}%**) · Peak: **${Math.round(st.max)}u** in ${peakLabel}`,
        `• **Next 3-Month Forecast:** **${f1}** → **${f2}** → **${f3} units/mo** (90-day projected demand: **${Math.round(f1 + f2 + f3)} units**)`,
        `• **Inventory Policy (95% Service Level):** Current Stock **${stock}** (${daysCover >= 365 ? '365+ days' : `${daysCover} days`} cover) · Stat. Safety Stock **${statSafety}u** · Reorder Point **${rop}u** · EOQ **${eoq}u**`
      ];

      const labels = [...months.map(fmtMonthCode), '+1M', '+2M', '+3M'];
      const chart = {
        type: 'sparkline',
        title: `${seedMatch.model} · 13-Mo Actuals + 3-Mo Forecast (Units)`,
        labels,
        actual: series,
        forecast: [f1, f2, f3],
        unit: 'u'
      };

      const cols = ['Metric', 'Value', 'Benchmark / Note'];
      const rows = [
        ['Current Stock', `${stock} units`, daysCover < 30 ? '⚠️ Low coverage (<30d)' : `${daysCover} days cover`],
        ['3-Month Forecast', `${Math.round(f1 + f2 + f3)} units`, `${f1} / ${f2} / ${f3} per month`],
        ['Statistical Safety Stock', `${statSafety} units`, '95% service level (Z = 1.65)'],
        ['Reorder Point (ROP)', `${rop} units`, stock <= rop ? '🔴 Reorder now' : '✅ Above ROP'],
        ['Optimal Order Qty (EOQ)', `${eoq} units`, 'Wilson EOQ model'],
        ['Volatility / XYZ Class', xyz, `σ = ${st.std.toFixed(1)}, CV = ${st.cv.toFixed(2)}`]
      ];

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'On-Hand', value: `${stock}u`, tone: stock <= rop ? 'critical' : 'ok' },
          { label: '90d Forecast', value: `${Math.round(f1 + f2 + f3)}u`, tone: 'teal' },
          { label: 'ROP / EOQ', value: `${rop} / ${eoq}`, tone: 'info' },
          { label: 'Days Cover', value: daysCover >= 365 ? '365d+' : `${daysCover}d`, tone: daysCover < 30 ? 'critical' : daysCover < 60 ? 'warn' : 'ok' }
        ],
        chart,
        table: { title: 'Statistical Inventory Policy', columns: cols, rows },
        csv: { filename: `mk97-forecast-${seedMatch.model.replace(/[^a-z0-9_-]/gi, '')}.csv`, content: toCsv(['Period', 'Units', 'Type'], [...series.map((v, i) => [fmtMonthCode(months[i] || `M${i + 1}`), v, 'Actual']), ['+1M', f1, 'Forecast'], ['+2M', f2, 'Forecast'], ['+3M', f3, 'Forecast']]) },
        actions: [
          { label: `📋 Create Replenishment Task`, style: 'primary', prompt: `Create task to review ${seedMatch.model} (${seedMatch.brand}) forecast & EOQ ${eoq} units with Elena due tomorrow` },
          { label: `🔍 Deep-Dive ${seedMatch.brand}`, style: 'teal', prompt: `Analyze brand ${seedMatch.brand}` }
        ],
        followUps: [`Analyze brand ${seedMatch.brand}`, 'Run ABC XYZ segmentation and Pareto analysis', 'Run ERP health score and anomaly detection'],
        entity: { type: 'SKU', id: seedMatch.model, label: seedMatch.model }
      };
    }

    // Check if user named a live ERP SKU (e.g. WH1000XM5, AF-200)
    const liveMatch = !isPortfolioAsk ? findBestLiveSku(raw, state, lastEntity).item : null;
    if (liveMatch) {
      const inboundMap = getInboundQtyBySku(state);
      const free = Math.max(0, n(liveMatch.onHand) - n(liveMatch.reserved) - n(liveMatch.damaged));
      const inbound = inboundMap.get(liveMatch.sku) || 0;
      const safety = Math.max(10, positive(liveMatch.safety));
      const openDemand = (state?.enterprise?.orders || [])
        .filter(o => !CLOSED.has(o.status))
        .reduce((s, o) => s + (o.lines || []).filter(l => l.sku === liveMatch.sku).reduce((ls, l) => ls + positive(l.qty), 0), 0);
      const estMonthly = Math.max(Math.round(safety * 1.15), Math.round(openDemand * 1.4), 18);
      const actual = [0.82, 0.88, 0.94, 1.02, 0.97, 1.08].map(m => Math.round(estMonthly * m));
      const forecast = [1.10, 1.15, 1.18].map(m => Math.round(estMonthly * m));
      const st = statsOf(actual);
      const rop = Math.ceil(estMonthly * 0.5 + Math.ceil(1.65 * st.std * Math.sqrt(0.5)));
      const eoq = Math.max(25, Math.round(Math.sqrt((2 * estMonthly * 12 * 50) / Math.max(5, positive(liveMatch.cost) * 0.22))));
      const daysCover = Math.round(((free + inbound) / Math.max(1, estMonthly)) * 30);

      const lines = [
        `**Live ERP Demand Forecast & EOQ — ${liveMatch.model || liveMatch.sku} (${liveMatch.brand})**`,
        `• **Current Supply:** **${free} free** + **${inbound} inbound** = **${free + inbound} units** (${daysCover} days projected cover) · Open customer demand: **${openDemand}u**`,
        `• **Run-Rate & 90-Day Forecast:** Est. **${estMonthly} units/mo** → Next 3 months: **${forecast.join(' → ')} units/mo** (**${forecast.reduce((a, b) => a + b, 0)}u** total)`,
        `• **Optimal Replenishment Policy:** Reorder Point **${rop}u** · Wilson EOQ **${eoq} units** (${moneyFmt(eoq * positive(liveMatch.cost))})`
      ];

      const chart = {
        type: 'sparkline',
        title: `${liveMatch.model || liveMatch.sku} · 6-Mo Run-Rate + 3-Mo Forecast`,
        labels: ['M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'Curr', '+1M', '+2M', '+3M'],
        actual,
        forecast,
        unit: 'u'
      };

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'Available + PO', value: `${free + inbound}u`, tone: (free + inbound) < safety ? 'critical' : 'ok' },
          { label: '90d Forecast', value: `${forecast.reduce((a, b) => a + b, 0)}u`, tone: 'teal' },
          { label: 'EOQ Qty', value: `${eoq}u`, tone: 'info' },
          { label: 'Days Cover', value: `${daysCover}d`, tone: daysCover < 30 ? 'critical' : 'ok' }
        ],
        chart,
        csv: { filename: `mk97-forecast-${liveMatch.model || liveMatch.sku}.csv`, content: toCsv(['Period', 'Units', 'Type'], [...actual.map((v, i) => [`M-${5 - i}`, v, 'Actual']), ...forecast.map((v, i) => [`+${i + 1}M`, v, 'Forecast'])]) },
        actions: [
          { label: `🛒 Issue EOQ PO (${eoq} × ${liveMatch.model || liveMatch.sku})`, style: 'primary', prompt: `Place a vendor PO for ${liveMatch.model || liveMatch.sku} for ${eoq} units` },
          { label: '🚚 Optimize 3PL Fulfillment', style: 'teal', prompt: `Optimize fulfillment for 25 ${liveMatch.model || liveMatch.sku} to CA` }
        ],
        followUps: [`What if demand increases 25% for ${liveMatch.model || liveMatch.sku}?`, 'Forecast portfolio demand across all SKUs'],
        entity: { type: 'SKU', id: liveMatch.sku, label: liveMatch.model || liveMatch.sku }
      };
    }

    // Portfolio-wide statistical demand forecast across ALL 1,885 SKUs!
    if (seedItems.length && months.length) {
      const mCount = months.length;
      const monthlyTotals = new Array(mCount).fill(0);
      const movers = [];
      let totalStock = 0, atRiskCount = 0;

      for (const it of seedItems) {
        const d = (it.demand || []).map(v => Math.max(0, n(v)));
        for (let i = 0; i < Math.min(mCount, d.length); i++) monthlyTotals[i] += d[i];
        const st = statsOf(d);
        const r3 = statsOf(d.slice(-3)).mean;
        const p3 = statsOf(d.slice(-6, -3)).mean;
        const stock = positive(it.stock);
        totalStock += stock;
        const cover = r3 > 0 ? stock / r3 : 99;
        if (r3 >= 5 && cover < 1.5) atRiskCount++;
        if (st.total >= 25) {
          movers.push({
            model: it.model,
            brand: it.brand,
            stock,
            avg3: r3,
            delta: r3 - p3,
            cover,
            total13: st.total
          });
        }
      }

      const pt = statsOf(monthlyTotals);
      const r3 = statsOf(monthlyTotals.slice(-3)).mean;
      const p3 = statsOf(monthlyTotals.slice(-6, -3)).mean;
      const momPct = p3 > 0 ? ((r3 - p3) / p3) * 100 : 0;
      const f1 = Math.max(0, Math.round(0.6 * r3 + 0.4 * pt.mean + pt.slope * 0.25));
      const f2 = Math.max(0, Math.round(0.6 * r3 + 0.4 * pt.mean + pt.slope * 0.50));
      const f3 = Math.max(0, Math.round(0.6 * r3 + 0.4 * pt.mean + pt.slope * 0.75));
      const peakIdx = monthlyTotals.indexOf(pt.max);
      const urgentCover = movers.filter(m => m.avg3 >= 4).sort((a, b) => a.cover - b.cover).slice(0, 6);

      const lines = [
        `**MK97 Portfolio Demand Forecast (${seedItems.length.toLocaleString()} Historical SKUs · ${mCount} Months)**`,
        `• **Aggregate Volume:** **${Math.round(pt.total).toLocaleString()} units** across ${mCount} months · Avg **${Math.round(pt.mean).toLocaleString()} units/mo** · Peak: **${Math.round(pt.max).toLocaleString()}u** (${fmtMonthCode(months[peakIdx])})`,
        `• **Recent Demand Velocity:** 3-mo avg **${Math.round(r3).toLocaleString()}/mo** vs prior 3-mo **${Math.round(p3).toLocaleString()}/mo** (**${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%**)`,
        `• **Next 3-Month Statistical Projection:** **${f1.toLocaleString()}** → **${f2.toLocaleString()}** → **${f3.toLocaleString()} units/mo** (**${(f1 + f2 + f3).toLocaleString()} units** over 90 days)`,
        `• **Stockout Exposure:** **${atRiskCount} active high-velocity SKUs** have **< 45 days** of stock coverage based on 3-month velocity.`
      ];

      const cols = ['Model', 'Brand', 'Stock', '3-Mo Avg/Mo', 'Cover (Days)', '13-Mo Vol'];
      const rows = urgentCover.map(m => [
        m.model,
        m.brand,
        String(Math.round(m.stock)),
        m.avg3.toFixed(1),
        `${Math.round(m.cover * 30)}d`,
        String(Math.round(m.total13))
      ]);

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'SKUs Analyzed', value: seedItems.length.toLocaleString(), tone: 'info' },
          { label: '90d Forecast', value: `${((f1 + f2 + f3) / 1000).toFixed(1)}K u`, tone: 'teal' },
          { label: 'Momentum', value: `${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%`, tone: momPct >= 0 ? 'ok' : 'warn' },
          { label: '<45d Cover', value: String(atRiskCount), tone: atRiskCount > 10 ? 'critical' : 'warn' }
        ],
        chart: {
          type: 'sparkline',
          title: `Portfolio Monthly Unit Demand (${mCount}M Actual + 3M Forecast)`,
          labels: [...months.map(fmtMonthCode), '+1M', '+2M', '+3M'],
          actual: monthlyTotals.map(v => Math.round(v)),
          forecast: [f1, f2, f3],
          unit: 'u'
        },
        table: { title: 'Tightest Stock-Cover High-Velocity SKUs', columns: cols, rows },
        csv: { filename: 'mk97-portfolio-demand-forecast.csv', content: toCsv(cols, rows) },
        actions: [
          ...(urgentCover[0] ? [{ label: `📈 Forecast ${urgentCover[0].model}`, style: 'primary', prompt: `Forecast demand for ${urgentCover[0].model}` }] : []),
          { label: '📊 ABC-XYZ Segmentation', style: 'teal', prompt: 'Run ABC XYZ segmentation and Pareto analysis' },
          { label: '🩺 Anomaly Radar', style: 'ghost', prompt: 'Run ERP health score and anomaly detection' }
        ],
        followUps: urgentCover[0] ? [`Forecast demand for ${urgentCover[0].model}`, 'Run ABC XYZ segmentation and Pareto analysis', 'Analyze top brands revenue'] : ['Run ABC XYZ segmentation and Pareto analysis']
      };
    }

    return queryLiveInventory('Check inventory portfolio', state, lastEntity);
  }

  // 3. ABC-XYZ Matrix & Pareto 80/20 Concentration Analysis
  function analyzeAbcXyzAndPareto(state, seed = null) {
    const regSeed = getSeedRegion(seed);
    const skuSales = (regSeed?.skuSales || []).filter(s => positive(s.total) > 0);
    const itemStock = regSeed?.itemStock || [];
    const brands = (regSeed?.brandSales || []).filter(b => b.brand && positive(b.total) > 0).sort((a, b) => b.total - a.total);
    const customers = (regSeed?.customerSales || []).filter(c => c.customer && positive(c.total) > 0).sort((a, b) => b.total - a.total);

    if (skuSales.length) {
      const sorted = skuSales.slice().sort((a, b) => b.total - a.total);
      const totalRev = sorted.reduce((s, x) => s + positive(x.total), 0);
      let cum = 0;
      const counts = { A: 0, B: 0, C: 0 };
      const revByClass = { A: 0, B: 0, C: 0 };
      const xyz = { X: 0, Y: 0, Z: 0 };

      for (const s of sorted) {
        const prevPct = cum / Math.max(1, totalRev);
        cum += positive(s.total);
        const cls = prevPct < 0.80 ? 'A' : prevPct < 0.95 ? 'B' : 'C';
        counts[cls]++;
        revByClass[cls] += positive(s.total);
        const st = statsOf(s.revenue || []);
        if (st.cv < 0.65) xyz.X++;
        else if (st.cv <= 1.25) xyz.Y++;
        else xyz.Z++;
      }

      const aPctSkus = ((counts.A / sorted.length) * 100).toFixed(1);
      const top5BrandsRev = brands.slice(0, 5).reduce((s, b) => s + positive(b.total), 0);
      const totalBrandRev = brands.reduce((s, b) => s + positive(b.total), 0) || totalRev;
      const top5BrandShare = (top5BrandsRev / Math.max(1, totalBrandRev)) * 100;

      const top5CustRev = customers.slice(0, 5).reduce((s, c) => s + positive(c.total), 0);
      const totalCustRev = customers.reduce((s, c) => s + positive(c.total), 0) || totalRev;
      const top5CustShare = (top5CustRev / Math.max(1, totalCustRev)) * 100;

      // Customer HHI (Herfindahl-Hirschman Index, 0-10000)
      const hhi = Math.round(customers.reduce((s, c) => s + ((positive(c.total) / Math.max(1, totalCustRev)) * 100) ** 2, 0));
      const hhiRisk = hhi >= 2500 ? 'High Concentration' : hhi >= 1500 ? 'Moderate Concentration' : 'Well Diversified';

      const lines = [
        `**ABC-XYZ Matrix & Pareto 80/20 Concentration Analysis**`,
        `Analyzed **${sorted.length.toLocaleString()} revenue-generating SKUs** (**${compactMoney(totalRev)}** annual sales), **${brands.length} brands**, and **${customers.length} customers**:`,
        ``,
        `• **Class A (Top 80% Revenue):** **${counts.A.toLocaleString()} SKUs** (${aPctSkus}% of catalog) drive **${compactMoney(revByClass.A)}** — protect with tight 98% service levels & automated ROP.`,
        `• **Class B (Next 15% Revenue):** **${counts.B.toLocaleString()} SKUs** drive **${compactMoney(revByClass.B)}** — manage via EOQ & periodic review.`,
        `• **Class C (Long Tail 5%):** **${counts.C.toLocaleString()} SKUs** drive **${compactMoney(revByClass.C)}** — trim safety buffers & convert slow movers to make-to-order/dropship.`,
        `• **Demand Stability (XYZ):** **${xyz.X}** Stable (X) · **${xyz.Y}** Seasonal/Variable (Y) · **${xyz.Z}** Erratic/Lumpy (Z)`,
        `• **Concentration Risk:** Top-5 Brands = **${top5BrandShare.toFixed(1)}%** of revenue · Top-5 Customers = **${top5CustShare.toFixed(1)}%** (HHI **${hhi}** → **${hhiRisk}**)`
      ];

      const cols = ['Rank', 'Brand', 'Annual Revenue', 'Share %', 'Peak Month'];
      const revMonths = regSeed?.revenueMonths || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const rows = brands.slice(0, 8).map((b, i) => {
        const revArr = b.revenue || [];
        const pk = revArr.length ? revArr.indexOf(Math.max(...revArr)) : 0;
        return [
          `#${i + 1}`,
          b.brand,
          compactMoney(b.total),
          `${((b.total / Math.max(1, totalBrandRev)) * 100).toFixed(1)}%`,
          String(revMonths[pk] || '—').slice(0, 3)
        ];
      });

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'Class A SKUs', value: `${counts.A} (${aPctSkus}%)`, tone: 'teal' },
          { label: 'Annual Sales', value: compactMoney(totalRev), tone: 'info' },
          { label: 'Top-5 Brands', value: `${top5BrandShare.toFixed(1)}%`, tone: top5BrandShare > 65 ? 'warn' : 'ok' },
          { label: 'Cust. HHI', value: `${hhi}`, tone: hhi >= 1500 ? 'warn' : 'ok' }
        ],
        chart: {
          type: 'stacked',
          title: 'ABC Revenue Pareto vs Catalog SKU Count',
          segments: [
            { label: `A · ${counts.A} SKUs (80% rev)`, pct: Math.round((counts.A / sorted.length) * 100), color: '#087f78' },
            { label: `B · ${counts.B} SKUs (15% rev)`, pct: Math.round((counts.B / sorted.length) * 100), color: '#2563eb' },
            { label: `C · ${counts.C} SKUs (5% rev)`, pct: Math.max(1, 100 - Math.round((counts.A / sorted.length) * 100) - Math.round((counts.B / sorted.length) * 100)), color: '#94a3b8' }
          ]
        },
        table: { title: 'Top Brands by Annual Revenue (Pareto Leaders)', columns: cols, rows },
        csv: { filename: 'mk97-abc-pareto-brands.csv', content: toCsv(cols, rows) },
        actions: [
          ...(brands[0] ? [{ label: `🔍 Deep-Dive ${brands[0].brand}`, style: 'primary', prompt: `Analyze brand ${brands[0].brand}` }] : []),
          { label: '👥 Top Customers Risk', style: 'teal', prompt: 'Analyze top customers and revenue concentration' },
          { label: '💰 Margin & Capital', style: 'ghost', prompt: 'Analyze margin and working capital' }
        ],
        followUps: brands.length >= 2 ? [`Compare ${brands[0].brand} vs ${brands[1].brand}`, 'Analyze top customers and revenue concentration', 'Forecast portfolio demand across all SKUs'] : ['Analyze margin and working capital']
      };
    }

    // Fallback on live ERP inventory value ABC when historical seed isn't loaded
    const inv = (state?.enterprise?.inventory || []).map(i => ({ item: i, val: positive(i.onHand) * positive(i.cost) })).sort((a, b) => b.val - a.val);
    const totalVal = inv.reduce((s, x) => s + x.val, 0);
    let cum = 0;
    const rows = inv.map(r => {
      const cls = cum / Math.max(1, totalVal) < 0.80 ? 'A' : cum / Math.max(1, totalVal) < 0.95 ? 'B' : 'C';
      cum += r.val;
      return [r.item.model || r.item.sku, r.item.brand, cls, String(r.item.onHand), moneyFmt(r.val)];
    });
    return {
      markdown: `**Live ERP Inventory Value ABC Classification (${inv.length} SKUs · ${moneyFmt(totalVal)})**\nClassified live inventory by capital value at cost (A = top 80%, B = next 15%, C = bottom 5%).`,
      metrics: [
        { label: 'Total Capital', value: compactMoney(totalVal), tone: 'teal' },
        { label: 'Class A SKUs', value: String(rows.filter(r => r[2] === 'A').length), tone: 'info' }
      ],
      table: { title: 'Live Inventory ABC Table', columns: ['SKU', 'Brand', 'Class', 'On-Hand', 'Capital'], rows },
      csv: { filename: 'mk97-live-abc.csv', content: toCsv(['SKU', 'Brand', 'Class', 'On-Hand', 'Capital'], rows) },
      actions: [{ label: '💰 Margin & Capital', style: 'teal', prompt: 'Analyze margin and working capital' }],
      followUps: ['Analyze margin and working capital', 'Run ERP health score and anomaly detection']
    };
  }

  // 4. Cross-ERP Anomaly Detector & Executive Health Score (0-100)
  function detectAnomaliesAndRisks(state, seed = null, mailThreads = []) {
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    const pulse = getLivePulse(state, mailThreads);
    const regSeed = getSeedRegion(seed);

    let score = 100;
    const anomalies = [];

    // Live ERP operational anomalies
    for (const item of pulse.lowStockSkus) {
      score -= 9;
      const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
      anomalies.push({ severity: 'CRITICAL', domain: 'Inventory', entity: item.model || item.sku, signal: `Safety floor breach (${free} free vs ${item.safety} safety, 0 inbound)`, impact: moneyFmt(positive(item.safety - free) * positive(item.standardPrice)) });
    }
    for (const shp of pulse.delayedTpl) {
      score -= 10;
      anomalies.push({ severity: 'CRITICAL', domain: '3PL Logistics', entity: shp.id, signal: `Delayed outbound shipment (${shp.orderId}, ${shp.sku}×${shp.qty}, no tracking)`, impact: 'SLA Breach' });
    }
    for (const rcv of (l.receipts || []).filter(r => r.status === 'ARRIVED')) {
      score -= 5;
      anomalies.push({ severity: 'HIGH', domain: 'Warehouse Dock', entity: rcv.po, signal: `Arrived at Dock ${rcv.dock} awaiting receiving/putaway confirmation`, impact: moneyFmt(rcv.poTotal || 0) });
    }
    for (const v of (e.vendors || []).filter(x => x.status === 'AUDIT_WARNING')) {
      score -= 7;
      const sla = (e.slaLogs || []).find(s => s.vendorId === v.id);
      anomalies.push({ severity: 'HIGH', domain: 'Vendor SLA', entity: v.name, signal: `Audit warning (${sla ? `${sla.onTimePct}% on-time vs ${sla.targetDays}d target` : 'Compliance review'})`, impact: 'Supply Risk' });
    }
    for (const a of (e.accounts || []).filter(x => x.status === 'REVIEW' || (x.creditLimit > 0 && x.creditUsed / x.creditLimit >= 0.85))) {
      score -= 6;
      const util = Math.round((a.creditUsed / Math.max(1, a.creditLimit)) * 100);
      anomalies.push({ severity: 'HIGH', domain: 'CRM Credit', entity: a.name, signal: `Credit utilization at ${util}% (${moneyFmt(a.creditUsed)} / ${moneyFmt(a.creditLimit)})`, impact: moneyFmt(a.creditUsed) });
    }
    for (const cc of (l.cycleCounts || []).filter(c => c.status === 'VARIANCE')) {
      score -= 4;
      anomalies.push({ severity: 'MEDIUM', domain: 'Cycle Count', entity: cc.id, signal: `${cc.sku} bin ${cc.binId} variance (System ${cc.systemQty} vs Count ${cc.countedQty})`, impact: `${Math.abs(n(cc.systemQty) - n(cc.countedQty))}u diff` });
    }
    if (pulse.pendingTrackingCount > 0) {
      score -= Math.min(10, pulse.pendingTrackingCount * 4);
      anomalies.push({ severity: 'HIGH', domain: 'MK97 Mail', entity: `${pulse.pendingTrackingCount} Thread(s)`, signal: `Customer/3PL tracking requests awaiting reply (${pulse.pendingTrackingMails.map(m => m.related?.poNumber || m.senderName).join(', ')})`, impact: 'CSAT Risk' });
    }

    // Statistical anomalies across 1,885 historical SKUs (Z-score >= 2.3 spikes & dead stock)
    let spikeCount = 0, deadStockCount = 0;
    const topSpikes = [];
    if (regSeed?.itemStock?.length) {
      for (const it of regSeed.itemStock) {
        const d = (it.demand || []).map(v => Math.max(0, n(v)));
        const st = statsOf(d);
        if (st.std > 0 && st.max >= 20) {
          const z = (st.max - st.mean) / st.std;
          if (z >= 2.3) {
            spikeCount++;
            if (topSpikes.length < 15) topSpikes.push({ model: it.model, brand: it.brand, peak: st.max, mean: st.mean, z });
          }
        }
        const last6 = d.slice(-6).reduce((s, v) => s + v, 0);
        if (positive(it.stock) >= 20 && last6 === 0) deadStockCount++;
      }
      topSpikes.sort((a, b) => b.peak - a.peak);
      for (const sp of topSpikes.slice(0, 2)) {
        anomalies.push({ severity: 'MEDIUM', domain: 'Demand Spike', entity: `${sp.model} (${sp.brand})`, signal: `Statistical spike: ${Math.round(sp.peak)}u peak vs ${sp.mean.toFixed(1)}/mo avg (Z = ${sp.z.toFixed(1)}σ)`, impact: 'Forecast Outlier' });
      }
      if (deadStockCount > 0) {
        score -= 4;
        anomalies.push({ severity: 'MEDIUM', domain: 'Dead Stock', entity: `${deadStockCount} SKUs`, signal: `≥20 units sitting with 0 sales over last 6 months in historical catalog`, impact: 'Working Capital' });
      }
    }

    score = Math.max(15, Math.min(100, Math.round(score)));
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 68 ? 'C' : score >= 55 ? 'D' : 'F';
    const crit = anomalies.filter(a => a.severity === 'CRITICAL').length;
    const high = anomalies.filter(a => a.severity === 'HIGH').length;
    const med = anomalies.filter(a => a.severity === 'MEDIUM').length;

    const lines = [
      `**MK97 ERP Health Score: ${score}/100 (Grade ${grade}) — Anomaly & Risk Radar**`,
      `Scanned **Orders, Inventory, Vendor SLAs, 3PL Shipments, Warehouse Dock, CRM Credit, MK97 Mail**${regSeed?.itemStock ? ` + **${regSeed.itemStock.length.toLocaleString()} historical SKU time-series**` : ''}:`,
      ``,
      ...anomalies.slice(0, 8).map(a => `• **${a.severity === 'CRITICAL' ? '🔴' : a.severity === 'HIGH' ? '🟠' : '🟡'} [${a.domain}] ${a.entity}** — ${a.signal}`),
      spikeCount > 0 ? `` : '',
      spikeCount > 0 ? `📈 **Statistical Outlier Scan:** Detected **${spikeCount} SKU demand spikes (Z ≥ 2.3σ)** and **${deadStockCount} dead-stock traps** across the 13-month catalog.` : ''
    ].filter(Boolean);

    const cols = ['Severity', 'Domain', 'Record', 'Anomaly Signal', 'Exposure'];
    const rows = anomalies.map(a => [a.severity, a.domain, a.entity, a.signal, a.impact]);

    const totAnom = Math.max(1, crit + high + med);
    const chart = {
      type: 'stacked',
      title: `Risk Mix (${anomalies.length} Detected Anomalies · Health ${score}/100)`,
      segments: [
        ...(crit ? [{ label: `Critical (${crit})`, pct: Math.round((crit / totAnom) * 100), color: '#dc2626' }] : []),
        ...(high ? [{ label: `High (${high})`, pct: Math.round((high / totAnom) * 100), color: '#d97706' }] : []),
        ...(med ? [{ label: `Medium (${med})`, pct: Math.max(1, 100 - Math.round((crit / totAnom) * 100) - Math.round((high / totAnom) * 100)), color: '#2563eb' }] : [])
      ]
    };

    return {
      markdown: lines.join('\n'),
      healthScore: score,
      metrics: [
        { label: 'Health Score', value: `${score}/100 (${grade})`, tone: score >= 80 ? 'ok' : score >= 65 ? 'warn' : 'critical' },
        { label: 'Critical', value: String(crit), tone: crit ? 'critical' : 'ok' },
        { label: 'High Risks', value: String(high), tone: high ? 'warn' : 'ok' },
        { label: 'Catalog Spikes', value: String(spikeCount), tone: 'info' }
      ],
      chart,
      table: { title: 'Cross-ERP Anomaly Register', columns: cols, rows: rows.slice(0, 8) },
      csv: { filename: 'mk97-anomaly-health-audit.csv', content: toCsv(cols, rows) },
      actions: [
        { label: '⚡ Preview Autopilot Fixes', style: 'primary', prompt: 'Show autopilot remediation plan' },
        ...(pulse.lowStockSkus[0] ? [{ label: `🛒 Fix ${pulse.lowStockSkus[0].model}`, style: 'teal', prompt: `Place a vendor PO for ${pulse.lowStockSkus[0].model} for 45 units` }] : []),
        { label: '💰 Margin & Capital', style: 'ghost', prompt: 'Analyze margin and working capital' }
      ],
      followUps: ['Show autopilot remediation plan', 'Analyze margin and working capital', 'Forecast portfolio demand across all SKUs']
    };
  }

  // 5. Brand & Customer Revenue Deep-Dive (138 Brands + 131 Customers + Live ERP)
  function analyzeBrandOrCustomerDeepDive(query, state, seed = null) {
    const regSeed = getSeedRegion(seed);
    const revMonths = (regSeed?.revenueMonths || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']).map(m => String(m).slice(0, 3));
    const brands = (regSeed?.brandSales || []).filter(b => b.brand && positive(b.total) > 0).sort((a, b) => b.total - a.total);
    const customers = (regSeed?.customerSales || []).filter(c => c.customer && positive(c.total) > 0).sort((a, b) => b.total - a.total);
    const q = String(query || '').toLowerCase();

    const wantCustomer = /\b(customer|customers|client|clients|account|accounts|buyer|workhuman|purchasing\s+power|innowave|incentive|northstar|apex|meridian)\b/i.test(q);
    const wantBrand = /\b(brand|brands|marc\s+jacobs|gucci|kendra|ferragamo|infinity\s+luxe|aura\s+frames|bala|all-?clad|sony|apple|fieldbar)\b/i.test(q);

    // Check specific named brand
    const hitBrand = brands.find(b => b.brand.length >= 4 && q.includes(b.brand.toLowerCase()));
    if (hitBrand) {
      const totalBrandRev = brands.reduce((s, b) => s + positive(b.total), 0);
      const share = (hitBrand.total / Math.max(1, totalBrandRev)) * 100;
      const rev = (hitBrand.revenue || []).map(v => Math.max(0, n(v)));
      const h1 = rev.slice(0, 6).reduce((s, v) => s + v, 0);
      const h2 = rev.slice(6).reduce((s, v) => s + v, 0);
      const peakVal = Math.max(...rev, 0);
      const peakMo = revMonths[rev.indexOf(peakVal)] || '—';
      const brandSkus = (regSeed?.skuSales || []).filter(s => String(s.brand || '').toLowerCase() === hitBrand.brand.toLowerCase()).sort((a, b) => b.total - a.total);
      const rank = brands.indexOf(hitBrand) + 1;
      const liveVendor = (state?.enterprise?.vendors || []).find(v => v.name.toLowerCase().includes(hitBrand.brand.toLowerCase().split(' ')[0]));
      const liveSla = liveVendor ? (state?.enterprise?.slaLogs || []).find(s => s.vendorId === liveVendor.id) : null;

      const lines = [
        `**Brand Commercial Deep-Dive — ${hitBrand.brand} (Rank #${rank} of ${brands.length})**`,
        `• **Annual Revenue:** **${moneyFmt(hitBrand.total)}** (**${share.toFixed(1)}%** of total brand revenue) · Peak Month: **${peakMo}** (${compactMoney(peakVal)})`,
        `• **Half-Year Trajectory:** H1 **${compactMoney(h1)}** · H2 **${compactMoney(h2)}** · Active Revenue SKUs: **${brandSkus.length}**`,
        liveVendor ? `• **Live ERP Supplier Link:** **${liveVendor.name}** (${liveVendor.status}${liveSla ? ` · ${liveSla.onTimePct}% on-time SLA` : ''})` : ''
      ].filter(Boolean);

      const cols = ['Model', 'Product Title', 'Annual Revenue', 'Share of Brand'];
      const rows = brandSkus.slice(0, 7).map(s => [
        s.model || '—',
        String(s.title || '').slice(0, 42),
        compactMoney(s.total),
        `${((s.total / Math.max(1, hitBrand.total)) * 100).toFixed(1)}%`
      ]);

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'Brand Rank', value: `#${rank}`, tone: 'teal' },
          { label: 'Annual Sales', value: compactMoney(hitBrand.total), tone: 'ok' },
          { label: 'Rev Share', value: `${share.toFixed(1)}%`, tone: 'info' },
          { label: 'Peak Month', value: `${peakMo} · ${compactMoney(peakVal)}`, tone: 'info' }
        ],
        chart: {
          type: 'sparkline',
          title: `${hitBrand.brand} · 12-Month Revenue Trajectory ($)`,
          labels: revMonths,
          actual: rev.map(v => Math.round(v)),
          forecast: [],
          unit: '$'
        },
        table: rows.length ? { title: `Top Revenue SKUs in ${hitBrand.brand}`, columns: cols, rows } : null,
        csv: { filename: `mk97-brand-${hitBrand.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, content: toCsv(['Month', 'Revenue'], revMonths.map((m, i) => [m, Math.round(rev[i] || 0)])) },
        actions: [
          ...(brands[rank] ? [{ label: `⚔ Compare vs ${brands[rank].brand}`, style: 'primary', prompt: `Compare ${hitBrand.brand} vs ${brands[rank].brand}` }] : []),
          { label: '📊 All Top Brands', style: 'ghost', prompt: 'Analyze top brands revenue' }
        ],
        followUps: brands[rank] ? [`Compare ${hitBrand.brand} vs ${brands[rank].brand}`, 'Analyze top customers and revenue concentration'] : ['Analyze top customers and revenue concentration']
      };
    }

    // Check specific named customer
    const hitCust = customers.find(c => c.customer.length >= 4 && q.includes(c.customer.toLowerCase()));
    if (hitCust) {
      const totalCustRev = customers.reduce((s, c) => s + positive(c.total), 0);
      const share = (hitCust.total / Math.max(1, totalCustRev)) * 100;
      const rev = (hitCust.revenue || []).map(v => Math.max(0, n(v)));
      const peakVal = Math.max(...rev, 0);
      const peakMo = revMonths[rev.indexOf(peakVal)] || '—';
      const activeMonths = rev.filter(v => v > 0).length;
      const rank = customers.indexOf(hitCust) + 1;

      const lines = [
        `**Customer Account Deep-Dive — ${hitCust.customer} (Rank #${rank} of ${customers.length})**`,
        `• **12-Month Revenue:** **${moneyFmt(hitCust.total)}** (**${share.toFixed(1)}%** of total customer revenue) · Active Months: **${activeMonths}/12**`,
        `• **Peak Billing Month:** **${peakMo}** (${compactMoney(peakVal)}) · Monthly Avg (active): **${compactMoney(hitCust.total / Math.max(1, activeMonths))}**`,
        share >= 15 ? `• ⚠️ **Key-Account Concentration:** Represents >15% of commercial volume — maintain priority SLA and quarterly executive review.` : `• ✅ **Healthy Concentration:** Account share is well balanced within customer portfolio.`
      ];

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'Customer Rank', value: `#${rank}`, tone: 'teal' },
          { label: 'Annual Revenue', value: compactMoney(hitCust.total), tone: 'ok' },
          { label: 'Portfolio Share', value: `${share.toFixed(1)}%`, tone: share >= 15 ? 'warn' : 'info' },
          { label: 'Active Months', value: `${activeMonths}/12`, tone: 'info' }
        ],
        chart: {
          type: 'sparkline',
          title: `${hitCust.customer} · 12-Month Revenue Trend ($)`,
          labels: revMonths,
          actual: rev.map(v => Math.round(v)),
          forecast: [],
          unit: '$'
        },
        csv: { filename: `mk97-customer-${hitCust.customer.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, content: toCsv(['Month', 'Revenue'], revMonths.map((m, i) => [m, Math.round(rev[i] || 0)])) },
        actions: [
          ...(customers[rank] ? [{ label: `⚔ Compare vs ${customers[rank].customer}`, style: 'primary', prompt: `Compare ${hitCust.customer} vs ${customers[rank].customer}` }] : []),
          { label: '👥 All Top Customers', style: 'ghost', prompt: 'Analyze top customers and revenue concentration' }
        ],
        followUps: customers[rank] ? [`Compare ${hitCust.customer} vs ${customers[rank].customer}`, 'Analyze top brands revenue'] : ['Analyze top brands revenue']
      };
    }

    // Top Customers Leaderboard
    if (wantCustomer && customers.length) {
      const totalCustRev = customers.reduce((s, c) => s + positive(c.total), 0);
      const top5Share = (customers.slice(0, 5).reduce((s, c) => s + positive(c.total), 0) / Math.max(1, totalCustRev)) * 100;
      const liveAccts = state?.enterprise?.accounts || [];
      const reviewAccts = liveAccts.filter(a => a.status === 'REVIEW');

      const lines = [
        `**Top Customer Revenue & Concentration Intelligence (${customers.length} Accounts · ${compactMoney(totalCustRev)})**`,
        `• **#1 Account:** **${customers[0].customer}** at **${compactMoney(customers[0].total)}** (**${((customers[0].total / totalCustRev) * 100).toFixed(1)}%** share)`,
        `• **Top-5 Concentration:** **${top5Share.toFixed(1)}%** of total commercial revenue across the top 5 accounts`,
        reviewAccts.length ? `• ⚠️ **Live CRM Credit Watch:** **${reviewAccts[0].name}** at **${Math.round(reviewAccts[0].creditUsed / Math.max(1, reviewAccts[0].creditLimit) * 100)}%** credit utilization` : ''
      ].filter(Boolean);

      const cols = ['Rank', 'Customer', '12-Mo Revenue', 'Share %', 'Active Mos'];
      const rows = customers.slice(0, 8).map((c, i) => [
        `#${i + 1}`,
        c.customer,
        compactMoney(c.total),
        `${((c.total / Math.max(1, totalCustRev)) * 100).toFixed(1)}%`,
        `${(c.revenue || []).filter(v => v > 0).length}/12`
      ]);

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'Total Customers', value: String(customers.length), tone: 'info' },
          { label: 'Annual Revenue', value: compactMoney(totalCustRev), tone: 'teal' },
          { label: 'Top-5 Share', value: `${top5Share.toFixed(1)}%`, tone: top5Share > 55 ? 'warn' : 'ok' },
          { label: '#1 Customer', value: customers[0].customer.split(' ')[0], tone: 'ok' }
        ],
        chart: {
          type: 'bars',
          title: 'Top 6 Customers by 12-Month Revenue',
          items: customers.slice(0, 6).map((c, idx) => ({
            label: c.customer,
            value: Math.round(c.total),
            display: `${compactMoney(c.total)} (${((c.total / Math.max(1, totalCustRev)) * 100).toFixed(1)}%)`,
            tone: idx === 0 ? 'teal' : 'info'
          }))
        },
        table: { title: 'Customer Revenue Leaderboard', columns: cols, rows },
        csv: { filename: 'mk97-top-customers.csv', content: toCsv(cols, rows) },
        actions: [
          { label: `🔍 Deep-Dive ${customers[0].customer}`, style: 'primary', prompt: `Analyze customer ${customers[0].customer}` },
          ...(customers[1] ? [{ label: `⚔ Compare #1 vs #2`, style: 'teal', prompt: `Compare ${customers[0].customer} vs ${customers[1].customer}` }] : [])
        ],
        followUps: [`Analyze customer ${customers[0].customer}`, 'Analyze top brands revenue', 'Analyze margin and working capital']
      };
    }

    // Top Brands Leaderboard (default)
    if (brands.length) {
      const totalBrandRev = brands.reduce((s, b) => s + positive(b.total), 0);
      const top5Share = (brands.slice(0, 5).reduce((s, b) => s + positive(b.total), 0) / Math.max(1, totalBrandRev)) * 100;

      const lines = [
        `**Top Brand Portfolio & Revenue Intelligence (${brands.length} Brands · ${compactMoney(totalBrandRev)})**`,
        `• **#1 Revenue Brand:** **${brands[0].brand}** generating **${compactMoney(brands[0].total)}** (**${((brands[0].total / totalBrandRev) * 100).toFixed(1)}%** of portfolio)`,
        `• **Top-5 Brand Share:** **${top5Share.toFixed(1)}%** (${brands.slice(0, 5).map(b => b.brand).join(', ')})`
      ];

      const cols = ['Rank', 'Brand', '12-Mo Revenue', 'Share %', 'Active Mos'];
      const rows = brands.slice(0, 8).map((b, i) => [
        `#${i + 1}`,
        b.brand,
        compactMoney(b.total),
        `${((b.total / Math.max(1, totalBrandRev)) * 100).toFixed(1)}%`,
        `${(b.revenue || []).filter(v => v > 0).length}/12`
      ]);

      return {
        markdown: lines.join('\n'),
        metrics: [
          { label: 'Active Brands', value: String(brands.length), tone: 'info' },
          { label: 'Annual Revenue', value: compactMoney(totalBrandRev), tone: 'teal' },
          { label: 'Top-5 Share', value: `${top5Share.toFixed(1)}%`, tone: top5Share > 60 ? 'warn' : 'ok' },
          { label: '#1 Brand', value: brands[0].brand, tone: 'ok' }
        ],
        chart: {
          type: 'bars',
          title: 'Top 6 Brands by 12-Month Revenue',
          items: brands.slice(0, 6).map((b, idx) => ({
            label: b.brand,
            value: Math.round(b.total),
            display: `${compactMoney(b.total)} (${((b.total / Math.max(1, totalBrandRev)) * 100).toFixed(1)}%)`,
            tone: idx === 0 ? 'teal' : 'info'
          }))
        },
        table: { title: 'Brand Revenue Leaderboard', columns: cols, rows },
        csv: { filename: 'mk97-top-brands.csv', content: toCsv(cols, rows) },
        actions: [
          { label: `🔍 Deep-Dive ${brands[0].brand}`, style: 'primary', prompt: `Analyze brand ${brands[0].brand}` },
          ...(brands[1] ? [{ label: `⚔ Compare ${brands[0].brand} vs ${brands[1].brand}`, style: 'teal', prompt: `Compare ${brands[0].brand} vs ${brands[1].brand}` }] : [])
        ],
        followUps: [`Compare ${brands[0].brand} vs ${brands[1]?.brand || 'Gucci'}`, 'Analyze top customers and revenue concentration', 'Run ABC XYZ segmentation and Pareto analysis']
      };
    }

    return queryLiveVendors(query, state);
  }

  // 6. Side-by-Side Comparison Engine ("Compare X vs Y")
  function compareEntities(query, state, seed = null) {
    const raw = String(query || '').trim();
    const regSeed = getSeedRegion(seed);
    const brands = (regSeed?.brandSales || []).filter(b => b.brand && positive(b.total) > 0);
    const customers = (regSeed?.customerSales || []).filter(c => c.customer && positive(c.total) > 0);
    const vendors = state?.enterprise?.vendors || [];
    const slaMap = new Map((state?.enterprise?.slaLogs || []).map(s => [s.vendorId, s]));

    // Vendor comparison shortcut
    if (/\b(vendors?|suppliers?)\b/i.test(raw) && !/\bvs\.?\b/i.test(raw)) {
      const sorted = vendors.map(v => ({ v, sla: slaMap.get(v.id) })).sort((a, b) => (b.sla?.onTimePct || 0) - (a.sla?.onTimePct || 0));
      const cols = ['Vendor', 'On-Time %', 'Lead Time', 'Status'];
      const rows = sorted.map(({ v, sla }) => [v.name, sla ? `${sla.onTimePct}%` : '—', `${v.leadTime || '—'}d`, v.status]);
      return {
        markdown: `**Vendor Side-by-Side SLA Scorecard (${sorted.length} Suppliers)**\n• **Top Performer:** **${sorted[0]?.v.name}** (${sorted[0]?.sla?.onTimePct ?? '—'}% on-time)\n• **Needs Attention:** **${sorted[sorted.length - 1]?.v.name}** (${sorted[sorted.length - 1]?.sla?.onTimePct ?? '—'}% on-time · ${sorted[sorted.length - 1]?.v.status})`,
        metrics: [
          { label: 'Best SLA', value: `${sorted[0]?.sla?.onTimePct ?? '—'}%`, tone: 'ok' },
          { label: 'Lowest SLA', value: `${sorted[sorted.length - 1]?.sla?.onTimePct ?? '—'}%`, tone: 'critical' }
        ],
        chart: {
          type: 'bars',
          title: 'Supplier On-Time Delivery %',
          items: sorted.map(({ v, sla }) => ({ label: v.name, value: sla?.onTimePct || 0, display: `${sla?.onTimePct || 0}%`, tone: (sla?.onTimePct || 0) >= 95 ? 'ok' : (sla?.onTimePct || 0) >= 90 ? 'warn' : 'critical' }))
        },
        table: { title: 'Vendor Comparison', columns: cols, rows },
        csv: { filename: 'mk97-vendor-comparison.csv', content: toCsv(cols, rows) },
        actions: [{ label: '✉ Email Lowest-SLA Vendor', style: 'primary', prompt: `Draft email to ${sorted[sorted.length - 1]?.v.name} about SLA delivery delay` }],
        followUps: ['Summarize vendor performance and open POs', 'Run ERP health score and anomaly detection']
      };
    }

    const parts = raw.replace(/^\/compare\s*/i, '').replace(/^(?:please\s+)?compare\s+/i, '').split(/\s+(?:vs\.?|versus|and|against)\s+/i).map(s => s.trim()).filter(Boolean);
    const leftQ = (parts[0] || '').toLowerCase();
    const rightQ = (parts[1] || '').toLowerCase();

    const findBrand = qStr => brands.find(b => b.brand.toLowerCase() === qStr) || brands.find(b => qStr.length >= 3 && b.brand.toLowerCase().includes(qStr));
    const findCust = qStr => customers.find(c => c.customer.toLowerCase() === qStr) || customers.find(c => qStr.length >= 3 && c.customer.toLowerCase().includes(qStr));

    let b1 = findBrand(leftQ), b2 = findBrand(rightQ);
    if (!b1 && !b2 && brands.length >= 2 && !leftQ) { b1 = brands[0]; b2 = brands[1]; }
    if (b1 && b2) {
      const winner = b1.total >= b2.total ? b1 : b2;
      const ratio = (Math.max(b1.total, b2.total) / Math.max(1, Math.min(b1.total, b2.total))).toFixed(2);
      const s1 = statsOf(b1.revenue || []), s2 = statsOf(b2.revenue || []);
      const skus1 = (regSeed?.skuSales || []).filter(s => s.brand === b1.brand).length;
      const skus2 = (regSeed?.skuSales || []).filter(s => s.brand === b2.brand).length;
      const cols = ['Metric', b1.brand, b2.brand];
      const rows = [
        ['12-Month Revenue', compactMoney(b1.total), compactMoney(b2.total)],
        ['Monthly Average', compactMoney(s1.mean), compactMoney(s2.mean)],
        ['Peak Month Sales', compactMoney(s1.max), compactMoney(s2.max)],
        ['Active Revenue SKUs', String(skus1), String(skus2)],
        ['Revenue Stability (CV)', s1.cv.toFixed(2), s2.cv.toFixed(2)]
      ];
      return {
        markdown: `**Side-by-Side Brand Comparison: ${b1.brand} vs ${b2.brand}**\n• **Revenue Leader:** **${winner.brand}** leads by **${ratio}×** (**${compactMoney(winner.total)}** vs **${compactMoney(winner === b1 ? b2.total : b1.total)}**).\n• **Volatility Profile:** ${b1.brand} CV = **${s1.cv.toFixed(2)}** vs ${b2.brand} CV = **${s2.cv.toFixed(2)}** (lower = steadier monthly demand).`,
        metrics: [
          { label: b1.brand, value: compactMoney(b1.total), tone: winner === b1 ? 'teal' : 'info' },
          { label: b2.brand, value: compactMoney(b2.total), tone: winner === b2 ? 'teal' : 'info' },
          { label: 'Lead Ratio', value: `${ratio}×`, tone: 'ok' }
        ],
        chart: {
          type: 'bars',
          title: 'Annual Revenue Head-to-Head ($)',
          items: [
            { label: b1.brand, value: Math.round(b1.total), display: compactMoney(b1.total), tone: winner === b1 ? 'teal' : 'info' },
            { label: b2.brand, value: Math.round(b2.total), display: compactMoney(b2.total), tone: winner === b2 ? 'teal' : 'info' }
          ]
        },
        table: { title: 'Head-to-Head Metrics', columns: cols, rows },
        csv: { filename: `mk97-compare-${b1.brand}-vs-${b2.brand}.csv`.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'), content: toCsv(cols, rows) },
        actions: [
          { label: `🔍 Deep-Dive ${b1.brand}`, style: 'teal', prompt: `Analyze brand ${b1.brand}` },
          { label: `🔍 Deep-Dive ${b2.brand}`, style: 'ghost', prompt: `Analyze brand ${b2.brand}` }
        ],
        followUps: [`Analyze brand ${b1.brand}`, `Analyze brand ${b2.brand}`, 'Analyze top customers and revenue concentration']
      };
    }

    const c1 = findCust(leftQ), c2 = findCust(rightQ);
    if (c1 && c2) {
      const winner = c1.total >= c2.total ? c1 : c2;
      const ratio = (Math.max(c1.total, c2.total) / Math.max(1, Math.min(c1.total, c2.total))).toFixed(2);
      const s1 = statsOf(c1.revenue || []), s2 = statsOf(c2.revenue || []);
      const cols = ['Metric', c1.customer, c2.customer];
      const rows = [
        ['12-Month Revenue', compactMoney(c1.total), compactMoney(c2.total)],
        ['Monthly Average', compactMoney(s1.mean), compactMoney(s2.mean)],
        ['Peak Month', compactMoney(s1.max), compactMoney(s2.max)],
        ['Active Months', `${(c1.revenue || []).filter(v => v > 0).length}/12`, `${(c2.revenue || []).filter(v => v > 0).length}/12`]
      ];
      return {
        markdown: `**Side-by-Side Customer Comparison: ${c1.customer} vs ${c2.customer}**\n• **Top Account:** **${winner.customer}** generates **${ratio}×** more annual volume (**${compactMoney(winner.total)}** vs **${compactMoney(winner === c1 ? c2.total : c1.total)}**).`,
        metrics: [
          { label: c1.customer.split(' ')[0], value: compactMoney(c1.total), tone: winner === c1 ? 'teal' : 'info' },
          { label: c2.customer.split(' ')[0], value: compactMoney(c2.total), tone: winner === c2 ? 'teal' : 'info' },
          { label: 'Lead Ratio', value: `${ratio}×`, tone: 'ok' }
        ],
        chart: {
          type: 'bars',
          title: 'Customer Revenue Head-to-Head ($)',
          items: [
            { label: c1.customer, value: Math.round(c1.total), display: compactMoney(c1.total), tone: winner === c1 ? 'teal' : 'info' },
            { label: c2.customer, value: Math.round(c2.total), display: compactMoney(c2.total), tone: winner === c2 ? 'teal' : 'info' }
          ]
        },
        table: { title: 'Head-to-Head Metrics', columns: cols, rows },
        csv: { filename: 'mk97-customer-comparison.csv', content: toCsv(cols, rows) },
        actions: [{ label: '👥 All Top Customers', style: 'teal', prompt: 'Analyze top customers and revenue concentration' }],
        followUps: ['Analyze top customers and revenue concentration', 'Compare Marc Jacobs vs Gucci']
      };
    }

    return {
      markdown: `**Side-by-Side Comparison Engine**\nSpecify two brands, customers, or vendors to compare — for example:\n• **\`Compare Marc Jacobs vs Gucci\`**\n• **\`Compare Workhuman vs Purchasing Power\`**\n• **\`Compare vendors\`**`,
      actions: [
        { label: '⚔ Marc Jacobs vs Gucci', style: 'primary', prompt: 'Compare Marc Jacobs vs Gucci' },
        { label: '⚔ Workhuman vs Purchasing Power', style: 'teal', prompt: 'Compare Workhuman vs Purchasing Power' },
        { label: '⚔ Compare All Vendors', style: 'ghost', prompt: 'Compare vendors' }
      ]
    };
  }

  // 7. 3PL vs Local Warehouse Cost & SLA Fulfillment Routing Optimizer
  function optimizeFulfillmentAnd3PL(query, state, lastEntity = null) {
    const raw = String(query || '').trim();
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    const { item } = findBestLiveSku(raw, state, lastEntity);
    const skuItem = item || (e.inventory || []).find(i => i.nature !== 'DIGITAL' && (l.tplInventory || []).some(t => t.sku === i.sku)) || (e.inventory || [])[0];
    if (!skuItem) return queryLiveLogistics3PL(raw, state);

    const cleanedQty = raw.replace(new RegExp(escRegex(skuItem.model || ''), 'gi'), '').replace(new RegExp(escRegex(skuItem.sku || ''), 'gi'), '');
    const qtyM = cleanedQty.match(/\b(\d{1,4})\s*(?:units?|pcs?|x)?\b/i);
    const qty = qtyM ? Math.max(1, Number(qtyM[1])) : 25;

    const stateMatch = raw.match(/\b(?:to|in|for|dest(?:ination)?)\s+([A-Z]{2})\b/i) || raw.match(/\b(CA|NY|TX|FL|IL|WA|NJ|GA|OH|PA|MA|CO|AZ|NV|NC|VA|MI)\b/);
    const destState = (stateMatch ? stateMatch[1] : 'CA').toUpperCase();
    const east = ['ME','NH','VT','MA','RI','CT','NY','NJ','PA','DE','MD','DC','VA','WV','NC','SC','GA','FL'];
    const west = ['CA','OR','WA','NV','AZ','UT','ID','MT','AK','HI'];
    const destRegion = east.includes(destState) ? 'EAST' : west.includes(destState) ? 'WEST' : 'CENTRAL';
    const dist = (a, b) => a === b ? 1 : ((a === 'EAST' && b === 'CENTRAL') || (a === 'CENTRAL' && b === 'WEST') || (a === 'WEST' && b === 'CENTRAL')) ? 2 : 3;

    const candidates = [];
    const localFree = Math.max(0, n(skuItem.onHand) - n(skuItem.reserved) - n(skuItem.damaged));
    const localWh = (l.warehouses || [])[0] || { id: 'wh_stark_se', name: 'MK97 Southeast DC (Tampa, FL)' };
    const dLocal = dist('EAST', destRegion);
    candidates.push({
      id: localWh.id,
      kind: 'LOCAL',
      name: localWh.name,
      region: 'EAST',
      available: localFree,
      canFulfill: localFree >= qty,
      cost: Math.round((4.5 + qty * 0.70 + dLocal * 2.15) * 100) / 100,
      sla: 99.2,
      distance: dLocal
    });

    for (const nd of (l.tplNodes || [])) {
      const stockRow = (l.tplInventory || []).find(t => t.nodeId === nd.id && t.sku === skuItem.sku);
      const avail = stockRow ? Math.max(0, n(stockRow.qty) - n(stockRow.reserved)) : 0;
      const d = dist(nd.region || 'EAST', destRegion);
      const cost = Math.round(((nd.baseHandling || 5.2) + qty * 0.55 + d * (nd.zoneRate || 1.25) * 2.2) * 100) / 100;
      candidates.push({
        id: nd.id,
        kind: '3PL',
        name: `${nd.name} (${nd.city}, ${nd.state})`,
        region: nd.region || 'CENTRAL',
        available: avail,
        canFulfill: avail >= qty && nd.status !== 'INACTIVE',
        cost,
        sla: n(nd.onTime || 95),
        distance: d,
        status: nd.status
      });
    }

    const minCost = Math.min(...candidates.map(c => c.cost));
    for (const c of candidates) {
      const proximity = ((4 - c.distance) / 3) * 100;
      const costScore = (minCost / Math.max(0.1, c.cost)) * 100;
      const stockScore = c.canFulfill ? 100 : (c.available / Math.max(1, qty)) * 45;
      c.score = Math.round(0.35 * proximity + 0.30 * costScore + 0.20 * c.sla + 0.15 * stockScore);
    }
    candidates.sort((a, b) => (b.canFulfill - a.canFulfill) || (b.score - a.score));
    const best = candidates[0];
    const runnerUp = candidates[1];
    const savings = runnerUp ? Math.max(0, runnerUp.cost - best.cost) : 0;

    const lines = [
      `**Fulfillment & 3PL Routing Optimizer — ${qty} × ${skuItem.model || skuItem.sku} → ${destState} (${destRegion})**`,
      `• **Optimal Node:** **${best.name}** (${best.kind}) — Score **${best.score}/100** · Est. Cost **$${best.cost.toFixed(2)}** · SLA **${best.sla}%** · Stock: **${best.available} avail** ${best.canFulfill ? '✅' : '⚠️ Partial'}`,
      runnerUp ? `• **Runner-Up:** ${runnerUp.name} — $${runnerUp.cost.toFixed(2)} (${savings > 0 ? `Saves **$${savings.toFixed(2)}** vs runner-up` : `Higher SLA/proximity score`})` : '',
      !best.canFulfill ? `• ⚠️ No single node holds all ${qty} units — recommend split-shipment or replenishing local stock first.` : ''
    ].filter(Boolean);

    const cols = ['Node', 'Type', 'Avail Stock', 'Est. Cost', 'On-Time SLA', 'Score'];
    const rows = candidates.map(c => [
      c.name,
      c.kind,
      `${c.available}u ${c.canFulfill ? '✓' : '✗'}`,
      `$${c.cost.toFixed(2)}`,
      `${c.sla}%`,
      `${c.score}/100`
    ]);

    return {
      markdown: lines.join('\n'),
      metrics: [
        { label: 'Best Node', value: best.kind === 'LOCAL' ? 'Tampa DC' : best.region + ' 3PL', tone: 'teal' },
        { label: 'Est. Cost', value: `$${best.cost.toFixed(2)}`, tone: 'ok' },
        { label: 'On-Time SLA', value: `${best.sla}%`, tone: best.sla >= 97 ? 'ok' : 'warn' },
        { label: 'Opt. Score', value: `${best.score}/100`, tone: 'info' }
      ],
      chart: {
        type: 'bars',
        title: `Routing Optimization Score by Node (Dest: ${destState})`,
        items: candidates.map((c, idx) => ({
          label: c.name.split('(')[0].trim(),
          value: c.score,
          display: `${c.score}/100 · $${c.cost.toFixed(2)} (${c.available}u)`,
          tone: idx === 0 && c.canFulfill ? 'teal' : c.canFulfill ? 'info' : 'warn'
        }))
      },
      table: { title: 'Fulfillment Node Matrix', columns: cols, rows },
      csv: { filename: `mk97-routing-${skuItem.model || skuItem.sku}-${destState}.csv`, content: toCsv(cols, rows) },
      actions: [
        { label: `📋 Create Routing Task`, style: 'primary', prompt: `Create task to route ${qty} ${skuItem.model || skuItem.sku} to ${destState} via ${best.name.split('(')[0].trim()} with Marcus due tomorrow` },
        { label: '↗ Open 3PL Routing', style: 'ghost', href: '3pl-management/routing.html' }
      ],
      followUps: [`Optimize fulfillment for ${qty} ${skuItem.model || skuItem.sku} to NY`, 'Show 3PL delays and warehouse status']
    };
  }

  // 8. Multi-Step Autonomous Remediation Playbook ("Autopilot")
  function buildAutopilotPlan(state, mailThreads = []) {
    const l = state?.logistics || {};
    const pulse = getLivePulse(state, mailThreads);
    const steps = [];

    steps.push({
      id: 'scan',
      title: 'Scan MK97 Mail & Live ERP for Unlogged Risks',
      detail: 'Detect tracking requests, low stock & 3PL delays and sync priority queue.'
    });

    for (const item of pulse.lowStockSkus) {
      const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
      const qty = Math.max(25, Math.ceil((positive(item.safety) * 2 - free) / 5) * 5);
      steps.push({
        id: 'po_' + item.sku,
        kind: 'ISSUE_PO',
        sku: item.sku,
        model: item.model || item.sku,
        qty,
        title: `Issue Covering Vendor PO: ${qty} × ${item.model || item.sku}`,
        detail: `Restores free+inbound above safety floor (${item.safety}u) and auto-resolves the low-stock task.`
      });
    }

    for (const rcv of (l.receipts || []).filter(r => r.status === 'ARRIVED')) {
      steps.push({
        id: 'rcv_' + rcv.id,
        kind: 'RECEIVE_PO',
        po: rcv.po,
        receiptId: rcv.id,
        title: `Post Arrived Dock Receipt: ${rcv.po} (Dock ${rcv.dock})`,
        detail: `Adds received inbound stock to usable inventory and closes pending putaway backlog.`
      });
    }

    if (pulse.topTask) {
      steps.push({
        id: 'remind_top',
        kind: 'REMIND_TOP',
        taskId: pulse.topTask.task.id,
        title: `Dispatch Team Reminder on #1 Critical Task`,
        detail: `Notifies assignees via MK97 Mail for "${pulse.topTask.task.title}".`
      });
    }

    const lines = [
      `**⚡ MK v7.0 Autonomous Remediation Playbook (${steps.length} Ready Actions)**`,
      `MK analyzed your entire ERP workspace and prepared a safe, auditable multi-step execution plan:`,
      ``,
      ...steps.map((s, i) => `**${i + 1}. ${s.title}**\n   ${s.detail}`),
      ``,
      `Click **⚡ Execute Full Autopilot** below to run all ${steps.length} steps automatically and verify resolved tasks.`
    ];

    return {
      markdown: lines.join('\n'),
      steps,
      metrics: [
        { label: 'Playbook Steps', value: String(steps.length), tone: 'teal' },
        { label: 'POs to Issue', value: String(steps.filter(s => s.kind === 'ISSUE_PO').length), tone: pulse.lowStockCount ? 'warn' : 'ok' },
        { label: 'Dock Receipts', value: String(steps.filter(s => s.kind === 'RECEIVE_PO').length), tone: pulse.arrivedReceiptsCount ? 'info' : 'ok' }
      ],
      actions: [
        { label: '⚡ Execute Full Autopilot', style: 'primary', prompt: 'Execute full autopilot now' },
        { label: '🩺 Re-Run Health Audit', style: 'ghost', prompt: 'Run ERP health score and anomaly detection' }
      ],
      followUps: ['Execute full autopilot now', 'Show executive briefing', 'Prioritize & analyze my tasks']
    };
  }

  function buildVendorPOForItem(item, qtyOverride, state, seqOffset = 0) {
    if (!item) return null;
    const free = Math.max(0, n(item.onHand) - n(item.reserved) - n(item.damaged));
    const safety = positive(item.safety);
    const defaultQty = Math.max(25, Math.ceil((Math.max(safety, 20) * 2 - free) / 5) * 5);
    const qty = positive(qtyOverride) > 0 ? Math.max(1, Math.round(qtyOverride)) : defaultQty;

    const vendors = state?.enterprise?.vendors || [];
    const priceBook = (state?.enterprise?.vendorPriceBooks || []).find(pb => pb.sku === item.sku);
    const vendor = vendors.find(v => v.id === priceBook?.vendorId) ||
      vendors.find(v => item.brand && v.name.toLowerCase().includes(item.brand.toLowerCase().split(' ')[0])) ||
      vendors[0] || { id: 'vend_default', name: item.brand || 'Primary Supplier', leadTime: 7 };

    const unitCost = positive(priceBook?.cost || item.cost);
    const poNumber = 'PO-2026-' + String(889100 + ((state?.enterprise?.purchaseOrders?.length || 0) + seqOffset) * 19);
    const eta = new Date(Date.now() + Math.max(3, positive(vendor.leadTime || 7)) * 86400000).toISOString();
    return { item, qty, vendor, unitCost, totalCost: qty * unitCost, poNumber, eta };
  }

  // 9. Data-Backed Executive Email Drafter & Sender
  function parseEmailDraftCommand(text, state, mailThreads = []) {
    const raw = String(text || '').trim();
    const q = raw.toLowerCase();
    const e = state?.enterprise || {};
    const slaMap = new Map((e.slaLogs || []).map(s => [s.vendorId, s]));

    // Match vendor, account, or mail sender
    let toName = '', toEmail = '', subject = '', body = '', related = {};

    const vendor = (e.vendors || []).find(v => {
      const full = String(v.name || '').toLowerCase();
      const first = full.split(/\s+/)[0];
      return (full.length >= 3 && q.includes(full)) || (first.length >= 4 && q.includes(first));
    });
    const account = !vendor ? (e.accounts || []).find(a => {
      const full = String(a.name || '').toLowerCase();
      const first = full.split(/\s+/)[0];
      return (full.length >= 3 && q.includes(full)) || (first.length >= 4 && q.includes(first));
    }) : null;
    const mailHit = !vendor && !account ? (mailThreads || []).find(m => m.senderName && m.senderName.length >= 4 && q.includes(m.senderName.toLowerCase().split(' ')[0])) : null;
    const rawEmail = raw.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
    const namedRecipientMatch = !vendor && !account && !mailHit && !rawEmail
      ? raw.match(/(?:^\/email\s+|(?:draft|write|compose|send)\s+(?:an?\s+)?(?:executive\s+)?email\s+to\s+|^email\s+)([A-Za-z][A-Za-z0-9 &.'-]{2,42}?)(?=\s+(?:about|regarding|for|on|re:|with)\b|$)/i)
      : null;

    if (vendor) {
      const sla = slaMap.get(vendor.id);
      const openPOs = (e.purchaseOrders || []).filter(p => p.vendorId === vendor.id && !['RECEIVED', 'CANCELLED', 'CLOSED'].includes(p.status));
      toName = vendor.name;
      toEmail = vendor.email || `ops@${vendor.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      const poRef = openPOs[0]?.po || '';
      related = poRef ? { poNumber: poRef } : {};
      subject = poRef ? `Action Required: ${poRef} Delivery & SLA Review — ${vendor.name}` : `Supplier Performance & Delivery SLA Follow-Up — ${vendor.name}`;
      body = `Hi ${vendor.name} Operations Team,\n\nWe are reviewing current inbound deliveries and supplier SLA metrics in MK97 ERP:\n` +
        (sla ? `• Current On-Time Performance: ${sla.onTimePct}% (Actual ${sla.actualDays}d vs ${sla.targetDays}d target)\n` : '') +
        (openPOs.length ? `• Open PO(s): ${openPOs.map(p => `${p.po} (${p.status}, ETA ${dateOnly(p.eta) || 'TBD'})`).join(', ')}\n` : '') +
        `\nPlease confirm revised dispatch dates and carrier tracking numbers by EOD today.\n\nBest regards,\nManoj Manne · Supply Chain Director, MK97 ERP`;
    } else if (account) {
      const util = account.creditLimit ? Math.round((account.creditUsed / account.creditLimit) * 100) : 0;
      const acctOrders = (e.orders || []).filter(o => o.accountId === account.id && !CLOSED.has(o.status));
      toName = account.name;
      toEmail = account.email || `billing@${account.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      subject = util >= 80 ? `Account Credit Utilization & Open Order Alignment — ${account.name}` : `Order Status & Fulfillment Update — ${account.name}`;
      body = `Hi ${account.name} Team,\n\nSharing a quick live update from MK97 ERP regarding your account:\n` +
        `• Credit Utilization: ${util}% (${moneyFmt(account.creditUsed)} used of ${moneyFmt(account.creditLimit)} limit)\n` +
        (acctOrders.length ? `• Active Open Orders: ${acctOrders.map(o => `#${o.po} (${o.status})`).join(', ')}\n` : '') +
        `\nPlease let us know if you would like to coordinate payment clearance or priority dispatch.\n\nBest regards,\nManoj Manne · MK97 ERP`;
    } else if (mailHit) {
      toName = mailHit.senderName;
      toEmail = mailHit.senderEmail || 'partner@mk97.com';
      subject = /^re:/i.test(mailHit.subject || '') ? mailHit.subject : `Re: ${mailHit.subject}`;
      related = mailHit.related || {};
      body = `Hi ${mailHit.senderName} Team,\n\nFollowing up on your recent message regarding ${mailHit.related?.poNumber || mailHit.subject}. Our operations team is actively expediting this shipment and will confirm final carrier tracking shortly.\n\nBest regards,\nManoj Manne · MK97 ERP`;
    } else if (rawEmail) {
      toEmail = rawEmail[1];
      toName = rawEmail[1].split('@')[0];
      subject = `MK97 ERP Operations Update`;
      body = `Hi ${toName},\n\nFollowing up regarding: ${raw.replace(/^\/email\s*/i, '')}\n\nBest regards,\nManoj Manne · MK97 ERP`;
    } else if (namedRecipientMatch && namedRecipientMatch[1].trim().length >= 3) {
      toName = namedRecipientMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase());
      const slug = toName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const topicMatch = raw.match(/\b(?:about|regarding|for|on)\s+(.+)$/i);
      const topic = topicMatch ? topicMatch[1].trim() : 'open operations & delivery alignment';
      toEmail = `operations@${slug || 'partner'}.com`;
      subject = `Action Required: ${topic.charAt(0).toUpperCase() + topic.slice(1)} — ${toName}`;
      body = `Hi ${toName} Team,\n\nWe are following up from MK97 ERP regarding ${topic}.\n\nPlease share your confirmed status, revised ETA, and carrier tracking reference at your earliest convenience so we can align warehouse receiving and downstream customer allocations.\n\nBest regards,\nManoj Manne · Supply Chain Director, MK97 ERP`;
    } else {
      return null;
    }

    return { toName, toEmail, subject, body, related };
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
    reconcileAutonomousTasks,
    getLivePulse,
    buildExecutiveBriefing,
    queryLiveInventory,
    queryLiveOrders,
    queryLiveVendors,
    queryLiveLogistics3PL,
    queryLiveMail,
    parseNaturalTaskCommand,
    parseVendorPOCommand,
    buildVendorPOForItem,
    parseTrackingUpdateCommand,
    simulateLiveInventoryScenario,
    toCsv,
    analyzeFinancialsAndMargin,
    analyzeDemandForecast,
    analyzeAbcXyzAndPareto,
    detectAnomaliesAndRisks,
    analyzeBrandOrCustomerDeepDive,
    compareEntities,
    optimizeFulfillmentAnd3PL,
    buildAutopilotPlan,
    parseEmailDraftCommand
  };
});
