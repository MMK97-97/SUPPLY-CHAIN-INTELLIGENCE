import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {createHandler} from './service.mjs';
const env=(key:string)=>Deno.env.get(key) || '';
const dictionary=(value:string)=>{try{return JSON.parse(value);}catch(_){return {};}};
const url=env('SUPABASE_URL');
const publishable=env('SUPABASE_PUBLISHABLE_KEY') || dictionary(env('SUPABASE_PUBLISHABLE_KEYS')).default || env('SUPABASE_ANON_KEY');
const secret=env('SUPABASE_SECRET_KEY') || dictionary(env('SUPABASE_SECRET_KEYS')).default || env('SUPABASE_SERVICE_ROLE_KEY');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const from=env('STARK_NOTIFICATION_FROM'),key=env('RESEND_API_KEY'),cronSecret=env('STARK_NOTIFICATION_CRON_SECRET');
const allowedOrigins=(env('STARK_ALLOWED_ORIGINS') || 'https://mmk97-97.github.io,https://supply-chain-intelligence.manoj-k-manne.workers.dev').split(',').map(s=>s.trim()).filter(Boolean);
async function sameSecret(a:string,b:string){
  if(!a || b.length<32)return false;
  const hash=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const x=await hash(a),y=await hash(b);let difference=0;for(let i=0;i<x.length;i++)difference|=x[i]^y[i];return difference===0;
}
Deno.serve(createHandler({
 from,allowedOrigins,configured:()=>!!key && !!from,
 isCron:(request:Request)=>sameSecret(request.headers.get('authorization')?.replace(/^Bearer /i,'') || '',cronSecret),
 async authenticate(request:Request,organization:string){
  const authorization=request.headers.get('authorization');if(!authorization)return false;
  const client=createClient(url,publishable,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser();if(error || !data.user)return false;
  const membership=await client.from('organization_members').select('role').eq('organization_id',organization).eq('user_id',data.user.id).maybeSingle();
  return !membership.error && ['owner','admin','manager','editor'].includes(String(membership.data?.role).toLowerCase());
 },
 async claim(organization:string|null,limit:number){
  const {data,error}=await admin.rpc('stark_claim_notifications',{p_organization_id:organization,p_limit:limit});if(error)throw error;return data || [];
 },
 async finish(record:{id:string;claim_token:string},result:Record<string,unknown>){
  const {data,error}=await admin.from('stark_notification_outbox').update(result).eq('id',record.id).eq('claim_token',record.claim_token).eq('state','SENDING').select('id');
  if(error || data?.length!==1)throw error || new Error('Delivery lease changed.');
 },
 async send(message:Record<string,unknown>,idempotencyKey:string){
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(message),signal:AbortSignal.timeout(8000)});
  let result;try{result=await response.json();}catch(_){result={};}
  return {ok:response.ok,status:response.status,id:result.id};
 }
}));
