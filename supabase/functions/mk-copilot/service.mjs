import './core.js';
const C=globalThis.MKCopilotCore;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const email=value=>String(value || '').trim().match(/(?:^|<)([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>?$/)?.[1]?.toLowerCase() || '';
const text=value=>typeof value==='string'?value:'';
const clone=value=>JSON.parse(JSON.stringify(value));
const orderFields=['contactStatus','lastContactAt','lastResponseAt','followUpDate','followUpSource','followUpMessageId'];
const pick=(object,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(object,k)).map(k=>[k,object[k]]));

export async function verifySvix(raw,headers,secret,now=Date.now()) {
  const id=headers.get('svix-id'),stamp=headers.get('svix-timestamp'),signatures=headers.get('svix-signature') || '';
  if(!id || id.length>200 || !/^\d{1,12}$/.test(stamp || '') || Math.abs(now/1000-Number(stamp))>300 || !secret?.startsWith('whsec_'))throw new Error('Invalid webhook signature.');
  let key;try{key=Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0));}catch(_){throw new Error('Invalid signing configuration.');}
  if(key.length<24)throw new Error('Invalid signing configuration.');
  const hmac=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const message=new TextEncoder().encode(id+'.'+stamp+'.'+raw);
  for(const signature of signatures.split(' ')) {
    if(!signature.startsWith('v1,'))continue;
    try{if(await crypto.subtle.verify('HMAC',hmac,Uint8Array.from(atob(signature.slice(3)),c=>c.charCodeAt(0)),message))return JSON.parse(raw);}catch(_){}
  }
  throw new Error('Invalid webhook signature.');
}
export function createHandler(deps) {
  const now=()=>deps.now?.() || new Date().toISOString();
  async function commit(org,key,event,actor,owner,source,verified=true) {
    for(let attempt=0;attempt<4;attempt++) {
      const current=await deps.loadWorkspace(org);if(!current)throw new Error('Workspace not found.');
      const next=clone(current.document),result=C.applyCommunication(next,event,{now:now(),timeZone:next.copilotSettings?.timeZone || 'America/New_York',actor,ownerUserId:owner,source,verified});
      if(result.duplicate)return {duplicate:true,revision:current.revision,document:current.document};
      const order=next.enterprise.orders.find(o=>o.id===event.orderId),account=next.enterprise.accounts.find(a=>a.id===order.accountId);
      try{return await deps.commitMessage(org,current.revision,event.orderId,key,{message:result.message,orderPatch:pick(order,orderFields),accountPatch:pick(account,['contactStatus','lastCommunicationAt']),task:result.task});}
      catch(error){if(!/workspace_conflict/.test(error.message) || attempt===3)throw error;}
    }
  }
  async function finalize(job,providerId) {
    return commit(job.organization_id,'outreach:'+job.id,{id:'outreach:'+job.id,orderId:job.order_id,direction:'OUTBOUND',confirmedSent:true,text:job.body,subject:job.subject,occurredAt:job.accepted_at || now()},job.actor_user_id,job.actor_user_id,'resend');
  }
  async function send(org,user,input) {
    if(!deps.mailConfigured?.())throw new Error('Configure the verified sender, reply domain and email API before sending.');
    const current=await deps.loadWorkspace(org),order=current?.document.enterprise.orders.find(o=>o.id===input.orderId);
    if(!order)throw new Error('Order not found.');
    if(input.confirmedSent!==true)throw new Error('Review and confirm the outbound message before sending.');
    if(!text(input.id) || input.id.length>200 || !text(input.text).trim() || input.text.length>10000 || !text(input.subject).trim() || input.subject.length>200 || /[\r\n]/.test(input.subject))throw new Error('Enter a valid request ID, subject and message.');
    const account=current.document.enterprise.accounts.find(a=>a.id===order.accountId),recipient=email(account?.email);
    if(!recipient || /[\r\n]/.test(account.email))throw new Error('Set a valid customer email in CRM first.');
    const thread=await deps.ensureThread(org,order.id,user.userId);
    let job=await deps.prepareOutreach({organization_id:org,order_id:order.id,request_key:input.id,actor_user_id:user.userId,recipient,subject:input.subject,body:input.text,thread_id:thread.id});
    if(job.body!==input.text || job.subject!==input.subject || job.recipient!==recipient || job.order_id!==order.id)throw new Error('This request ID belongs to different message content. Start a new message.');
    job=await deps.claimOutreach(job.id);
    if(job.state==='ACCEPTED')return {...await finalize(job,job.provider_id),delivery:'ACCEPTED'};
    if(!job.claimed)throw new Error(job.state==='FAILED'?'The email provider rejected this message. Review the delivery record.':'Delivery is in progress or unconfirmed. Retry this same request after the lease; do not create a duplicate message.');
    let response;
    try{response=await deps.sendMail({from:deps.from,to:[recipient],reply_to:[`mk+${thread.reply_token}@${deps.replyDomain}`],subject:job.subject,text:job.body,tags:[{name:'outreach_id',value:job.id}]},'mk-outreach-'+job.id);}
    catch(error){await deps.finishOutreach(job,{state:'UNKNOWN',last_error:'Email delivery is unconfirmed. Retry the same request within the provider idempotency window.'});throw new Error('Delivery is unconfirmed. Keep this request ID and check again before sending another message.');}
    if(!response.ok || !response.id){await deps.finishOutreach(job,{state:response.status>=400 && response.status<500 && response.status!==429?'FAILED':'UNKNOWN',last_error:'Email provider did not confirm acceptance.'});throw new Error('Email acceptance was not confirmed; the customer was not marked Contacted.');}
    await deps.finishOutreach(job,{state:'ACCEPTED',provider_id:response.id,accepted_at:now(),last_error:null});
    job={...job,state:'ACCEPTED',provider_id:response.id,accepted_at:now()};
    return {...await finalize(job,response.id),delivery:'ACCEPTED'};
  }
  async function webhook(request,raw) {
    const event=await deps.verifyWebhook(raw,request.headers);
    if(event.type==='email.sent') {
      const jobId=event.data?.tags?.outreach_id || (Array.isArray(event.data?.tags)?event.data.tags.find(t=>t.name==='outreach_id')?.value:'');
      if(!UUID.test(jobId || '') || !UUID.test(event.data?.email_id || ''))return {ignored:true};
      let job=await deps.getOutreach(jobId);if(!job)return {ignored:true};
      if(job.provider_id && job.provider_id!==event.data.email_id)throw new Error('Provider message does not match its outreach record.');
      job=await deps.confirmOutreach(job.id,event.data.email_id,event.created_at || now());
      return finalize(job,event.data.email_id);
    }
    if(event.type!=='email.received')return {ignored:true};
    if(!UUID.test(event.data?.email_id || ''))throw new Error('Invalid receiving email ID.');
    const mail=await deps.receiveMail(event.data.email_id);
    const tokens=(mail.to || []).map(address=>email(address).match(/^mk\+([0-9a-f-]{36})@(.+)$/i)).filter(m=>m && m[2]===deps.replyDomain?.toLowerCase()).map(m=>m[1]).filter(t=>UUID.test(t || ''));
    if(new Set(tokens).size!==1)throw new Error('Incoming mail must have one unambiguous order reply address.');
    const thread=await deps.lookupThread(tokens[0]);if(!thread)throw new Error('Unknown order reply address.');
    const current=await deps.loadWorkspace(thread.organization_id),order=current?.document.enterprise.orders.find(o=>o.id===thread.order_id),account=current?.document.enterprise.accounts.find(a=>a.id===order?.accountId);
    const sender=email(mail.from),allowed=[account?.email,...(account?.contacts || []).map(c=>c.email)].map(email).filter(Boolean);
    if(!sender || !allowed.includes(sender))throw new Error('Sender is not a recorded contact for this customer. Review the provider inbox manually.');
    if(!text(mail.text).trim())throw new Error('This email has no plain-text body. Review the provider inbox manually.');
    // Never infer organization or order IDs from a subject or instructions inside customer text.
    return commit(thread.organization_id,'resend-received:'+event.data.email_id,{id:'received:'+event.data.email_id,orderId:thread.order_id,direction:'INBOUND',text:mail.text,subject:mail.subject || '',occurredAt:mail.created_at || event.created_at},'email:'+sender,thread.owner_user_id,'resend');
  }
  async function scan() {
    const organizations=await deps.claimScans(25);let scanned=0;const failed=[];
    for(const org of organizations)try{const current=await deps.loadWorkspace(org);if(!current)continue;const report=C.analyze(current.document,{now:now(),timeZone:current.document.copilotSettings?.timeZone || 'America/New_York'});await deps.storeAlerts(org,current.revision,report.alerts);scanned++;}catch(_){failed.push(org);}
    return {scanned,failed};
  }
  return async function handler(request) {
    const origin=request.headers.get('origin'),allowed=!origin || (deps.allowedOrigins || []).includes(origin);
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    if(origin && allowed){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization,apikey,content-type';headers['Access-Control-Allow-Methods']='POST,OPTIONS';}
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(!allowed)return reply({error:'Origin is not allowed.'},403);
    if(request.method==='OPTIONS')return reply({},200);
    if(request.method!=='POST')return reply({error:'Use POST.'},405);
    try {
      if(Number(request.headers.get('content-length') || 0)>65536)return reply({error:'Request is too large.'},413);
      const raw=await request.text();if(new TextEncoder().encode(raw).length>65536)return reply({error:'Request is too large.'},413);
      if(new URL(request.url).pathname.endsWith('/webhook')){const result=await webhook(request,raw);return reply({ok:true,duplicate:result.duplicate===true,ignored:result.ignored===true});}
      let input;try{input=JSON.parse(raw);}catch(_){return reply({error:'Invalid JSON.'},400);}
      if(input.action==='scan'){if(!await deps.isCron(request))return reply({error:'Scheduled monitoring requires its server credential.'},403);return reply(await scan());}
      if(!UUID.test(input.organization_id || ''))return reply({error:'Choose an organization.'},400);
      const user=await deps.authenticate(request,input.organization_id);
      if(!user || !['owner','admin','manager','editor'].includes(user.role))return reply({error:'An authorized organization editor is required.'},403);
      if(input.action==='send')return reply(await send(input.organization_id,user,input.event || {}));
      if(input.action==='status')return reply({emailConfigured:deps.mailConfigured?.()===true,replyDomain:deps.replyDomain || '',version:C.VERSION});
      if(input.action==='thread'){if(!deps.mailConfigured?.())throw new Error('Configure the email sender and receiving reply domain first.');const current=await deps.loadWorkspace(input.organization_id);if(!current?.document.enterprise.orders.some(o=>o.id===input.orderId))throw new Error('Order not found.');const thread=await deps.ensureThread(input.organization_id,input.orderId,user.userId);return reply({replyAddress:`mk+${thread.reply_token}@${deps.replyDomain}`,orderId:input.orderId});}
      if(input.action!=='record')return reply({error:'Unsupported Co-Pilot action.'},400);
      const event={...(input.event || {}),id:'manual:'+String(input.event?.id || '')};
      if(!input.event?.id)throw new Error('A stable message ID is required.');
      return reply(await commit(input.organization_id,'manual:'+event.id,event,user.userId,user.userId,'manual',false));
    }catch(error){const message=String(error.message || 'Co-Pilot request failed.');return reply({error:message},/signature|webhook/i.test(message)?401:/workspace_conflict|unconfirmed|in progress/i.test(message)?409:400);}
  };
}
