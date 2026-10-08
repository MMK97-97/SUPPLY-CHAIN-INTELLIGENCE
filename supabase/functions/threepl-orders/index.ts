import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createHandler } from './service.mjs';

const env=(key:string)=>Deno.env.get(key) || '';
const dictionary=(value:string)=>{try{return JSON.parse(value);}catch(_){return {};}};
const url=env('SUPABASE_URL');
const publishable=env('SUPABASE_PUBLISHABLE_KEY') || dictionary(env('SUPABASE_PUBLISHABLE_KEYS')).default || env('SUPABASE_ANON_KEY');
const secret=env('SUPABASE_SECRET_KEY') || dictionary(env('SUPABASE_SECRET_KEYS')).default || env('SUPABASE_SERVICE_ROLE_KEY');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const connectors=dictionary(env('STARK_3PL_CONNECTORS'));
const origins=(env('STARK_ALLOWED_ORIGINS') || 'https://supply-chain-intelligence.manoj-k-manne.workers.dev,https://mmk97-97.github.io').split(',').map(v=>v.trim()).filter(Boolean);

Deno.serve(createHandler({
  allowedOrigins:origins,
  async authenticate(request:Request,organization:string){
    const client=createClient(url,publishable,{global:{headers:{Authorization:request.headers.get('authorization')!}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.auth.getUser();if(error || !data.user)return null;
    const membership=await client.from('organization_members').select('role').eq('organization_id',organization).eq('user_id',data.user.id).maybeSingle();
    if(membership.error || !['owner','admin','editor','manager'].includes(String(membership.data?.role).toLowerCase()))return null;
    return {client,userId:data.user.id};
  },
  async readWorkspace(user:{client:ReturnType<typeof createClient>},organization:string){
    const {data,error}=await user.client.from('stark_unified_workspaces').select('document').eq('organization_id',organization).maybeSingle();if(error)throw error;return data?.document;
  },
  connector(organization:string,node:string){return connectors[organization+':'+node];},
  async hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');},
  async getDelivery(organization:string,id:string){const {data,error}=await admin.from('stark_3pl_deliveries').select('state,remote_order_id,sent_at,error').eq('organization_id',organization).eq('request_id',id).maybeSingle();if(error)throw error;return data;},
  async claim(organization:string,id:string,hash:string){const {data,error}=await admin.rpc('stark_claim_3pl_delivery',{p_organization_id:organization,p_request_id:id,p_payload_hash:hash});if(error)throw error;return data;},
  async finish(organization:string,id:string,hash:string,record:Record<string,unknown>){const {error}=await admin.from('stark_3pl_deliveries').update({...record,updated_at:new Date().toISOString()}).eq('organization_id',organization).eq('request_id',id).eq('payload_hash',hash).eq('state','SENDING');if(error)throw error;},
  partnerFetch:(endpoint:string,options:RequestInit)=>fetch(endpoint,options)
}));
