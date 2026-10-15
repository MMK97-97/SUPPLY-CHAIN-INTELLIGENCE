/* Read-only analysis of connected operations. Currency and region boundaries are explicit. */
(function () {
  'use strict';
  const S=window.StarkSystem;if(!S)return;
  const n=x=>Number.isFinite(Number(x))?Number(x):0,round=x=>Math.round(x*100)/100;
  const final=x=>['SHIPPED','DELIVERED','CANCELLED','EXPIRED','RECEIVED','COMPLETE'].includes(x);
  const currencies={US:'USD',EU:'EUR',CA:'CAD'};
  function analyze(state,scope='US',options={}) {
    if(!['US','EU','CA','ALL'].includes(scope))throw new Error('Choose a valid analysis region.');
    const pct=Number(options.demandChange??0),delay=Number(options.delayDays??0),lead=Number(options.leadDays??30);
    if(!Number.isFinite(pct)||pct < -100||pct>500||!Number.isFinite(delay)||delay<0||delay>365||!Number.isFinite(lead)||lead<0||lead>730)throw new Error('Use demand −100% to 500%, delay 0–365 days and lead time 0–730 days.');
    const now=new Date(options.now||Date.now());if(!Number.isFinite(now.getTime()))throw new Error('Invalid analysis date.');
    const codes=scope==='ALL'?['US','EU','CA']:[scope],e=state.enterprise,bySku=new Map(e.inventory.map(i=>[i.sku,i])),rows=[],groups=[],evidence=[];
    const belongs=item=>codes.includes(S.regionCode(item?.region||'US'));
    const orders=e.orders.filter(o=>o.region?codes.includes(S.regionCode(o.region)):o.lines.some(l=>belongs(bySku.get(l.sku))));
    const pos=e.purchaseOrders.filter(p=>p.region?codes.includes(S.regionCode(p.region)):p.lines.some(l=>belongs(bySku.get(l.sku))));
    const openPOs=pos.filter(p=>!['RECEIVED','CANCELLED'].includes(p.status)&&!(p.purpose==='DROPSHIP'&&p.status==='DISPATCHED')&&p.lines.some(line=>n(line.received)<n(line.qty)));
    const overdue=openPOs.filter(p=>p.lines.some(l=>n(l.received)<n(l.qty))&&p.eta&&new Date(p.eta)<now);
    const commitments={};
    for(const p of openPOs){const c=p.currency||e.vendors.find(v=>v.id===p.vendorId)?.currency||currencies[S.regionCode(p.region||bySku.get(p.lines[0]?.sku)?.region)];commitments[c]=round((commitments[c]||0)+p.lines.reduce((v,l)=>v+Math.max(0,n(l.qty)-n(l.received))*n(l.cost),0));}
    for(const code of codes){
      const report=state.regional[code],source=report?.items?.length?report.items:e.inventory.filter(i=>i.nature!=='DIGITAL'&&S.regionCode(i.region)===code).map(i=>({...i,onHand:i.onHand,available:S.available(i),avgMonthly:i.avgMonthly}));
      const seen=new Set(),quality=[];
      source.forEach((r,index)=>{
        const model=String(r.model||''),item=bySku.get(code+'::'+model)||e.inventory.find(i=>S.regionCode(i.region)===code&&i.model===model),status=String(r.status||item?.status||'').toUpperCase().replace(/[^A-Z]/g,'');
        const demand=n(r.avgMonthly??r.avg3??item?.avgMonthly),free=item?S.available(item):Math.max(0,n(r.available??r.onHand)),cost=n(item?.cost??r.cost),eligible=['LIVE','FASHION','BACKORDER'].includes(status);
        const id=code+':connected:'+index,stock=item?n(item.onHand):n(r.onHand),inbound=item?openPOs.flatMap(p=>p.lines).filter(l=>l.sku===item.sku).reduce((v,l)=>v+Math.max(0,n(l.qty)-n(l.received)),0):Math.max(0,n(r.openSupplier));
        if(!model)quality.push('Missing model reference');if(seen.has(model))quality.push('Duplicate model '+model);seen.add(model);
        if(!(cost>0))quality.push('Missing cost: '+model);if(!(demand>0))quality.push('No positive demand: '+model);if(!status)quality.push('Missing item status: '+model);
        const scaled=demand*(1+pct/100),daily=scaled/30,cover=daily>0?free/daily:null;
        // Inbound dates are not guaranteed. Stress testing excludes inbound to avoid optimistic promises.
        const target=Math.ceil(scaled*((lead+delay)/30+1)),stress=eligible?Math.max(0,target-free):0;
        const risk=eligible&&daily>0&&(free===0||cover<lead+delay);
        const record={evidenceId:id,region:code,currency:currencies[code],model,brand:r.brand||item?.brand||'',status,eligible,stock,free,demand:round(demand),scaledDemand:round(scaled),daysCover:cover===null?null:round(cover),inbound,officialRecommendation:Math.max(0,n(r.recommended)),stressRecommendation:stress,cost,estimatedStressCost:round(stress*cost),risk,linked:!!item};rows.push(record);
        evidence.push({id,label:code+' · '+model+' · '+(item?'connected stock':'report stock'),kind:'connected-item',region:code,fileName:report?.fileName||'Operations catalog',facts:record});
      });
      if(!source.length)quality.push('No regional inventory source');
      const matching=rows.filter(r=>r.region===code),importDate=report?.updatedAt?new Date(report.updatedAt):null;
      const ageDays=importDate&&Number.isFinite(importDate.getTime())?Math.max(0,Math.floor((now-importDate)/864e5)):null;
      if(ageDays!==null&&ageDays>14)quality.push('Report snapshot is more than 14 days old');
      groups.push({region:code,currency:currencies[code],models:matching.length,eligible:matching.filter(r=>r.eligible).length,atRisk:matching.filter(r=>r.risk).length,freeUnits:matching.reduce((v,r)=>v+r.free,0),officialUnits:matching.reduce((v,r)=>v+r.officialRecommendation,0),stressUnits:matching.reduce((v,r)=>v+r.stressRecommendation,0),estimatedStressCost:round(matching.reduce((v,r)=>v+r.estimatedStressCost,0)),missingCosts:matching.filter(r=>r.stressRecommendation>0&&!r.cost).length,quality:[...new Set(quality)],ageDays,fileName:report?.fileName||'Operations catalog'});
    }
    rows.sort((a,b)=>Number(b.risk)-Number(a.risk)||(a.daysCover??Infinity)-(b.daysCover??Infinity)||b.stressRecommendation-a.stressRecommendation);
    const findings=rows.filter(r=>r.risk).slice(0,8).map(r=>({title:r.region+' · '+r.model, severity:r.free===0?'critical':'high',explanation:r.free+' available units; '+r.demand+' monthly demand; '+r.daysCover+' modeled days of cover against '+(lead+delay)+' assumed lead days. '+r.inbound+' inbound units excluded from the stress test because delivery is not guaranteed.',evidence_ids:[r.evidenceId]}));
    const actions=rows.filter(r=>r.eligible&&(r.risk||r.officialRecommendation>0)).slice(0,5).map(r=>({title:r.model+': review replenishment',priority:r.free===0?'now':'next',owner:'Supply planning',reason:'Official report recommendation '+r.officialRecommendation+' units; conservative stress scenario '+r.stressRecommendation+' units. Confirm supplier ETA and costs before creating a PO.',evidence_ids:[r.evidenceId]}));
    return {scope,capturedAt:now.toISOString(),scenario:{demandChange:pct,delayDays:delay,leadDays:lead},simulated:pct!==0||delay!==0,groups,rows,orders:orders.length,openOrders:orders.filter(o=>!final(o.status)).length,openPOs:openPOs.length,overduePOs:overdue.length,commitments,findings,actions,evidence,assumptions:['30-day demand month; average monthly demand is not a probabilistic forecast.','Scenario target = monthly demand × (assumed lead time + extra delay + 30-day coverage) / 30, less available stock; inbound is excluded.','The stress target does not change the official reorder formula or saved records.','Costs are estimates using current unit costs. Missing costs are flagged; currencies are never combined.']};
  }
  function briefResult(source) {
    const result=analyze(S.getState(),source.scope);
    return {answer:result.groups.map(g=>g.region+': '+g.atRisk+' models below assumed lead-time coverage; '+g.freeUnits+' available units; '+g.officialUnits+' official reorder units.').join('\n')+'\nOperations in this scope: '+result.openOrders+' open orders, '+result.openPOs+' open supplier POs and '+result.overduePOs+' overdue inbound POs.',findings:result.findings,actions:result.actions,assumptions:result.assumptions,questions:result.groups.some(g=>g.quality.length)?['Review the data-quality findings in the Decision Lab before committing purchasing decisions.']:[],evidence_ids:result.evidence.map(e=>e.id),evidence:result.evidence,tools:[{name:'connected_operations_brief',arguments:{region:source.scope},status:'complete'}],mode:'local',capturedAt:result.capturedAt};
  }
  window.StarkDecisionLab=Object.freeze({analyze,briefResult});
})();
