// Delivery is server-only. Tests inject a transport; the browser never supplies recipients.
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function money(value,currency){if(value==null)return '—';return new Intl.NumberFormat('en-US',{style:'currency',currency:/^[A-Z]{3}$/.test(currency)?currency:'USD'}).format(Number(value));}
export function emailContent(record,from){
  const p=record.payload;
  if(record.kind==='TASK_REMINDER'){
    const due=p.dueAt?new Date(p.dueAt).toUTCString():'No due date';
    return {from,to:[record.recipient],subject:'Task reminder: '+String(p.title).replace(/[\r\n]/g,' ').slice(0,160),
      text:`Task reminder\n${p.title}\nDue: ${due}\n\n${p.notes || ''}`,
      html:`<h2>Task reminder</h2><p><strong>${escape(p.title)}</strong></p><p>Due: ${escape(due)}</p><p style="white-space:pre-wrap">${escape(p.notes || '')}</p>`};
  }
  const rows=p.changes.map(change=>{
    const currency=change.currency || p.currency;
    return {item:[change.brand,change.model || change.sku].filter(Boolean).join(' · '),kind:change.kind==='CONTRACT_REMOVED'?'Contract removed':change.kind==='CONTRACT'?'Contract':'Catalog',
      net:money(change.netPrice,currency),retail:money(change.retailPrice,currency),terms:change.kind==='CONTRACT_REMOVED'?'Contract override removed; review current catalog pricing.':change.kind==='CONTRACT'?`Minimum quantity ${change.minQty || 1}; effective ${change.effective || 'immediately'}`:''};
  });
  const heading=`Price update for ${p.customerName}`;
  const footer='Catalog prices and customer contract prices are labeled separately. Existing orders retain their agreed prices.';
  return {from,to:[record.recipient],subject:'Product price update',text:heading+'\n\n'+rows.map(row=>`${row.item}\n${row.kind} net: ${row.net}; retail: ${row.retail}\n${row.terms}`).join('\n\n')+'\n\n'+footer,
    html:`<h2>${escape(heading)}</h2><table cellpadding="10" style="border-collapse:collapse"><thead><tr><th>Item</th><th>Price type</th><th>Net</th><th>Retail</th><th>Terms</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escape(row.item)}</td><td>${row.kind}</td><td>${escape(row.net)}</td><td>${escape(row.retail)}</td><td>${escape(row.terms)}</td></tr>`).join('')}</tbody></table><p>${footer}</p>`};
}
export function createHandler(deps){
  return async request=>{
    const origin=request.headers.get('origin');
    const cors={'Content-Type':'application/json','Vary':'Origin'};
    if(origin && !deps.allowedOrigins.includes(origin))return new Response(JSON.stringify({error:'Origin not allowed.'}),{status:403,headers:cors});
    if(origin){cors['Access-Control-Allow-Origin']=origin;cors['Access-Control-Allow-Headers']='authorization,apikey,content-type';cors['Access-Control-Allow-Methods']='POST,OPTIONS';}
    const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:cors});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.method!=='POST')return reply(405,{error:'POST required.'});
    try{
      const raw=await request.text();if(raw.length>2048)return reply(413,{error:'Request too large.'});
      let body;try{body=JSON.parse(raw || '{}');}catch(_){return reply(400,{error:'Invalid JSON.'});}
      if(!body || typeof body!=='object' || Array.isArray(body))return reply(400,{error:'Invalid request.'});
      const cron=await deps.isCron(request);
      const organization=body.organization_id || null;
      if(organization && !uuid.test(organization))return reply(400,{error:'Invalid organization.'});
      if(!cron && (!organization || !await deps.authenticate(request,organization)))return reply(403,{error:'An authorized organization session is required.'});
      if(!deps.configured())return reply(503,{error:'Configure the server email key and verified sender before delivery.'});
      const records=await deps.claim(organization,5);
      let sent=0,failed=0,retrying=0;
      for(const record of records){
        let result;
        try{
          const response=await deps.send(emailContent(record,deps.from),'stark-notice-'+record.id);
          if(response.ok && response.id){result={state:'ACCEPTED',provider_id:response.id,sent_at:new Date().toISOString(),last_error:null};sent++;}
          else if(response.status===429 || response.status>=500 || response.status===408 || response.status===409){result={state:'RETRY',last_error:'Email service temporarily unavailable; delivery will retry with the same idempotency key.'};retrying++;}
          else if(response.ok){result={state:'RETRY',last_error:'Email service returned no receipt; delivery is unconfirmed.'};retrying++;}
          else {result={state:'FAILED',last_error:'Email service rejected the recipient or sender configuration ('+response.status+').'};failed++;}
        }catch(_){result={state:'RETRY',last_error:'Delivery unconfirmed; retrying with the same provider idempotency key.'};retrying++;}
        // A failed finish is deliberately surfaced. Its lease will expire and retry
        // using the same provider key, rather than inventing a successful receipt.
        const delay=Math.min(3600,60*2**Math.min(record.attempts,6));
        await deps.finish(record,{...result,lease_until:null,next_attempt_at:new Date(Date.now()+delay*1000).toISOString()});
      }
      return reply(200,{ok:true,sent,failed,retrying});
    }catch(_){return reply(503,{error:'Notification processing is temporarily unavailable. Saved changes remain queued.'});}
  };
}
