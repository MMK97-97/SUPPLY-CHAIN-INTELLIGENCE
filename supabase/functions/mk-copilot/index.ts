import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {createHandler,verifySvix} from './service.mjs';
const env=(key:string)=>Deno.env.get(key) || '';
const dictionary=(value:string)=>{try{return JSON.parse(value);}catch(_){return {};}};
const url=env('SUPABASE_URL'),publishable=env('SUPABASE_PUBLISHABLE_KEY') || dictionary(env('SUPABASE_PUBLISHABLE_KEYS')).default || env('SUPABASE_ANON_KEY');
const service=env('SUPABASE_SECRET_KEY') || dictionary(env('SUPABASE_SECRET_KEYS')).default || env('SUPABASE_SERVICE_ROLE_KEY');
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const from=env('STARK_NOTIFICATION_FROM'),apiKey=env('RESEND_API_KEY'),replyDomain=env('STARK_COPILOT_REPLY_DOMAIN').toLowerCase();
const signingSecret=env('RESEND_COPILOT_WEBHOOK_SECRET'),cronSecret=env('STARK_COPILOT_CRON_SECRET');
const allowedOrigins=(env('STARK_ALLOWED_ORIGINS') || 'https://mmk97-97.github.io,https://supply-chain-intelligence.manoj-k-manne.workers.dev').split(',').map(v=>v.trim()).filter(Boolean);
function unwrap(result:any){if(result.error)throw result.error;return result.data;}
async function sameSecret(a:string,b:string){if(!a || b.length<32)return false;const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const x=await hash(a),y=await hash(b);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;}
async function getOutreach(id:string){return unwrap(await admin.from('stark_copilot_outreach').select('*').eq('id',id).maybeSingle());}
async function provider(path:string,init:RequestInit={}) {
 const response=await fetch('https://api.resend.com'+path,{...init,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(10000)});
 const raw=await response.text();if(raw.length>2000000)throw new Error('Email provider response is too large.');
 let data:any;try{data=JSON.parse(raw);}catch(_){throw new Error('Email provider returned an invalid response.');}
 return {ok:response.ok,status:response.status,data};
}
Deno.serve(createHandler({
 from,replyDomain,allowedOrigins,
 mailConfigured:()=>!!apiKey && !!from && !/[\r\n]/.test(from) && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(replyDomain),
 verifyWebhook:(raw:string,headers:Headers)=>verifySvix(raw,headers,signingSecret),
 isCron:(request:Request)=>sameSecret(request.headers.get('authorization')?.replace(/^Bearer /i,'') || '',cronSecret),
 async authenticate(request:Request,organization:string){
  const authorization=request.headers.get('authorization');if(!authorization)return null;
  const client=createClient(url,publishable,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser();if(error || !data.user)return null;
  const member=await client.from('organization_members').select('role').eq('organization_id',organization).eq('user_id',data.user.id).maybeSingle();
  return member.error || !member.data?null:{userId:data.user.id,role:String(member.data.role).toLowerCase()};
 },
 async loadWorkspace(org:string){return unwrap(await admin.from('stark_unified_workspaces').select('document,revision').eq('organization_id',org).maybeSingle());},
 async commitMessage(org:string,revision:number,orderId:string,key:string,delta:any){return unwrap(await admin.rpc('stark_commit_copilot_message',{p_organization_id:org,p_expected_revision:revision,p_order_id:orderId,p_event_key:key,p_delta:delta}));},
 async ensureThread(org:string,orderId:string,userId:string){
  unwrap(await admin.from('stark_copilot_threads').upsert({organization_id:org,order_id:orderId,owner_user_id:userId},{onConflict:'organization_id,order_id',ignoreDuplicates:true}));
  return unwrap(await admin.from('stark_copilot_threads').select('*').eq('organization_id',org).eq('order_id',orderId).single());
 },
 async lookupThread(token:string){
  const thread=unwrap(await admin.from('stark_copilot_threads').select('*').eq('reply_token',token).maybeSingle());if(!thread)return null;
  const current=unwrap(await admin.from('organization_members').select('user_id').eq('organization_id',thread.organization_id).eq('user_id',thread.owner_user_id).maybeSingle());
  if(!current){const next=unwrap(await admin.from('organization_members').select('user_id').eq('organization_id',thread.organization_id).in('role',['owner','admin','manager','editor']).order('created_at',{ascending:true}).limit(1).maybeSingle());if(!next)throw new Error('Assign an internal owner to this email thread.');thread.owner_user_id=next.user_id;unwrap(await admin.from('stark_copilot_threads').update({owner_user_id:next.user_id}).eq('id',thread.id));}
  return thread;
 },
 async prepareOutreach(row:any){unwrap(await admin.from('stark_copilot_outreach').upsert(row,{onConflict:'organization_id,request_key',ignoreDuplicates:true}));return unwrap(await admin.from('stark_copilot_outreach').select('*').eq('organization_id',row.organization_id).eq('request_key',row.request_key).single());},
 claimOutreach:async(id:string)=>unwrap(await admin.rpc('stark_claim_copilot_outreach',{p_id:id})),getOutreach,
 async finishOutreach(job:any,patch:any){const rows=unwrap(await admin.from('stark_copilot_outreach').update(patch).eq('id',job.id).eq('claim_token',job.claim_token).eq('state','SENDING').select('id'));if(rows.length!==1){const latest=await getOutreach(job.id);if(!(patch.state==='ACCEPTED' && latest?.state==='ACCEPTED' && latest.provider_id===patch.provider_id))throw new Error('Outreach delivery lease changed.');}},
 async confirmOutreach(id:string,providerId:string,acceptedAt:string){return unwrap(await admin.from('stark_copilot_outreach').update({state:'ACCEPTED',provider_id:providerId,accepted_at:acceptedAt}).eq('id',id).or('provider_id.is.null,provider_id.eq.'+providerId).select('*').single());},
 async sendMail(message:any,key:string){const r=await provider('/emails',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(message)});return {ok:r.ok,status:r.status,id:r.data.id};},
 async receiveMail(id:string){const r=await provider('/emails/receiving/'+encodeURIComponent(id));if(!r.ok)throw new Error('The received email body could not be fetched.');return r.data;},
 async claimScans(limit:number){return unwrap(await admin.rpc('stark_claim_copilot_scans',{p_limit:limit}));},
 async storeAlerts(org:string,revision:number,alerts:any[]){unwrap(await admin.rpc('stark_store_copilot_alerts',{p_organization_id:org,p_revision:revision,p_alerts:alerts}));}
}));
