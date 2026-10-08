// Pure handler with injected authentication/database/network adapters for tests.
// Provider endpoints and credentials come only from server configuration.
const states=new Set(['QUEUED','SENDING','ACKNOWLEDGED','REJECTED','UNKNOWN']);
export function canonicalJSON(value) {
  if(value===null || typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJSON(value[key])).join(',')+'}';
}
export async function limitedText(response,maxBytes) {
  if(!response.body)return '';
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,body='';
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new Error('body_limit');body+=decoder.decode(value,{stream:true});}return body+decoder.decode();}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function dispatchPayload(document,request) {
  const order=document.enterprise?.orders?.find(o=>o.id===request.customerOrderId),account=document.enterprise?.accounts?.find(a=>a.id===order?.accountId);
  if(document.mode!=='working' || !order || !['PICKING','ALLOCATED'].includes(order.status) || order.validation?.state!=='VALIDATED' || order.fulfillment?.kind!=='3PL' || order.fulfillment?.requestId!==request.id || order.fulfillment?.nodeId!==request.nodeId || request.status==='CANCELLED')throw new Error('invalid_linked_order');
  if(!account || account.status!=='ACTIVE' || !order.address?.line1 || !order.address?.city || !order.address?.state || !order.address?.zip || !order.inHandsDate || !order.shipping?.method || !Array.isArray(order.lines) || !order.lines.length || order.lines.length>100)throw new Error('incomplete_order');
  const node=document.logistics?.tplNodes?.find(n=>n.id===request.nodeId && n.status==='ACTIVE');if(!node)throw new Error('inactive_partner');
  const lines=order.lines.map(line=>{
    const item=document.enterprise.inventory.find(i=>i.sku===line.sku),stock=document.logistics.tplInventory.find(i=>i.sku===line.sku&&i.nodeId===node.id),shipments=document.logistics.tplShipments.filter(s=>s.customerOrderId===order.id&&s.requestId===request.id&&s.sku===line.sku&&s.status!=='CANCELLED');
    if(!item || item.nature!=='PHYSICAL' || !stock || stock.variation===false || stock.qty<line.qty || stock.reserved<line.qty || !Number.isInteger(line.qty) || line.qty<1 || Number(line.shipped || 0)>0 || shipments.reduce((n,s)=>n+s.qty,0)!==line.qty)throw new Error('invalid_partner_allocation');
    if(/discontinued|feeds?\s*only|internal\s*use|out\s*of\s*stock/i.test(String(item.status||'').replaceAll('_',' ')))throw new Error('ineligible_item');
    return {sku:line.sku,model:line.model || item.model,quantity:line.qty};
  });
  return {schema_version:'stark.3pl.order.v1',request_id:request.id,order_number:order.orderNumber || order.id,customer_po:order.po,partner_id:request.nodeId,customer:account.name,address:order.address,instructions:order.instructions || '',in_hands_date:order.inHandsDate,shipping:{method:order.shipping.method,third_party_account:order.shipping.thirdPartyAccount || '',third_party_zip:order.shipping.thirdPartyZip || ''},lines};
}
export function safeEndpoint(endpoint) {
  let url;try{url=new URL(endpoint);}catch(_){throw new Error('invalid_connector');}
  if(url.protocol!=='https:' || url.username || url.password || url.hash || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') || /(?:^|\.)(localhost|local|internal|test|example|invalid)(?:\.|$)/i.test(url.hostname))throw new Error('invalid_connector');
  return url.href;
}
function result(record){return {ok:true,state:states.has(record?.state)?record.state:'QUEUED',remote_order_id:record?.remote_order_id || '',sent_at:record?.sent_at || null,error:record?.error || ''};}
export function createHandler(deps) {
  return async function handler(request) {
    const origin=request.headers.get('origin'),allowed=!origin || deps.allowedOrigins.includes(origin),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(origin && allowed)headers['Access-Control-Allow-Origin']=origin;
    const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(!allowed)return respond({ok:false,state:'QUEUED',error:'Origin is not allowed.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'authorization,apikey,content-type'}});
    if(request.method!=='POST')return respond({ok:false,state:'QUEUED',error:'Use POST.'},405);
    if(!/^Bearer\s+\S+$/i.test(request.headers.get('authorization') || ''))return respond({ok:false,state:'QUEUED',error:'Sign-in is required.'},401);
    let body;
    try{body=JSON.parse(await limitedText(request,16384));}catch(_){return respond({ok:false,state:'QUEUED',error:'Use a valid, bounded JSON request.'},400);}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.organization_id || '') || !/^3plreq_[a-z0-9_-]{1,120}$/i.test(body?.request_id || '') || !['process','status'].includes(body.action))return respond({ok:false,state:'QUEUED',error:'Invalid organization, request ID or action.'},400);
    const org=body.organization_id,id=body.request_id;
    try {
      const user=await deps.authenticate(request,org);if(!user)return respond({ok:false,state:'QUEUED',error:'Organization editor access is required.'},403);
      const existing=await deps.getDelivery(org,id);
      if(body.action==='status')return respond(result(existing));
      if(existing && ['ACKNOWLEDGED','SENDING','UNKNOWN'].includes(existing.state))return respond(result(existing));
      const document=await deps.readWorkspace(user,org),stored=document?.logistics?.tplRequests?.find(r=>r.id===id);
      if(!stored)return respond({ok:false,state:'QUEUED',error:'Sync this shipment request to the shared workspace first.'},409);
      let payload;try{payload=dispatchPayload(document,stored);}catch(_){return respond({ok:false,state:'QUEUED',error:'The shared order or partner allocation is not eligible for processing.'},409);}
      if(canonicalJSON(payload)!==canonicalJSON(stored.payload))return respond({ok:false,state:'QUEUED',error:'The order changed after this shipment request was created. Reconcile the request before sending.'},409);
      const config=deps.connector(org,stored.nodeId);if(!config?.endpoint || !config?.token)return respond({ok:false,state:'QUEUED',error:'No server connector is configured for this organization and partner.'},503);
      const endpoint=safeEndpoint(config.endpoint),hash=await deps.hash(canonicalJSON(payload)),claim=await deps.claim(org,id,hash);
      if(!claim.claimed)return respond(result(claim));
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),deps.timeoutMs || 25000);
      let final;
      try {
        const response=await deps.partnerFetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':'Bearer '+config.token,'Idempotency-Key':org+':'+id},body:JSON.stringify(payload),signal:controller.signal});
        const responseText=await limitedText(response,32768);
        let ack;try{ack=JSON.parse(responseText);}catch(_){}
        if(response.ok && ack?.accepted===true && ack.request_id===id && typeof ack.order_id==='string' && ack.order_id.trim() && ack.order_id.length<=150){final={state:'ACKNOWLEDGED',remote_order_id:ack.order_id.trim(),sent_at:new Date().toISOString(),error:''};}
        else if(response.status>=400 && response.status<500 && ![408,409].includes(response.status) && ack?.accepted!==true && !ack?.order_id){final={state:'REJECTED',error:'Partner API rejected the request (HTTP '+response.status+').'};}
        else{final={state:'UNKNOWN',error:'Partner delivery could not be confirmed. Reconcile before resending.'};}
      }catch(_){final={state:'UNKNOWN',error:'Partner delivery could not be confirmed. Reconcile before resending.'};}
      finally{clearTimeout(timer);}
      await deps.finish(org,id,hash,final);return respond(result(final));
    }catch(_){return respond({ok:false,state:'UNKNOWN',error:'The connector could not confirm delivery. Refresh API status and reconcile before resending.'},503);}
  };
}
