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
  return {VERSION,civilDay,dateOnly,dueTime,parseFollowUp,intent,remaining,analyze,demandSeries,applyCommunication};
});
