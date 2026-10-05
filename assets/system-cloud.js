(function(){
  'use strict';
  const S=window.StarkSystem;if(!S)return;
  const LINK='stark.unifiedCloudLink.v1';
  let client,organization,remoteRevision=0,active=false,suppress=false,pending=false,timer,status='Local browser workspace',remoteDatasets=[];
  const update=message=>{status=message;window.dispatchEvent(new CustomEvent('stark:cloud-status',{detail:{status,active}}));};
  function loadScript(path,test){return new Promise((resolve,reject)=>{if(test())return resolve();const script=document.createElement('script');script.src=path;script.onload=resolve;script.onerror=()=>reject(new Error('Cloud connection could not load. Check your network.'));document.head.append(script);});}
  async function session(){
    await loadScript(S.url('assets/supabase-config.js'),()=>!!window.STARK_SUPABASE_CONFIG);
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',()=>!!window.supabase?.createClient);
    const config=window.STARK_SUPABASE_CONFIG;
    client ||= window.supabase.createClient(config.url,config.publishableKey);
    const {data,error}=await client.auth.getSession();if(error)throw error;
    if(!data.session)throw new Error('Sign in first, then return to Data Center to connect the shared workspace.');
    const membership=await client.from('organization_members').select('organization_id,role').eq('user_id',data.session.user.id).order('created_at',{ascending:true}).limit(1).maybeSingle();
    if(membership.error)throw membership.error;if(!membership.data)throw new Error('An organization membership is required.');
    organization=membership.data.organization_id;
    if(!['owner','admin','editor','manager'].includes(String(membership.data.role).toLowerCase()))throw new Error('Cloud editing requires an owner, admin, manager or editor role.');
    return organization;
  }
  async function fetchRemote(){await session();const {data,error}=await client.from('stark_unified_workspaces').select('revision,document,updated_at').eq('organization_id',organization).maybeSingle();if(error)throw new Error('Shared data is not configured: '+error.message+'. Apply the included 20261005_unified_system.sql migration.');return data;}
  async function inspect(){const remote=await fetchRemote();return{remote,organizationId:organization};}
  async function sync(){
    if(!active)return;if(pending){clearTimeout(timer);timer=setTimeout(()=>sync().catch(()=>{}),600);return;}
    pending=true;update('Saving shared workspace…');
    try{const datasets=await S.collectRegional(), document=S.getState();document.regionalDatasets=datasets.filter(x=>document.regional[x.region]).map(x=>x.dataset?x:(remoteDatasets.find(y=>y.region===x.region)||x));const result=await client.rpc('stark_save_workspace',{p_organization_id:organization,p_expected_revision:remoteRevision,p_document:document});
      if(result.error){if(/workspace_conflict/i.test(result.error.message))throw new Error('Shared data changed on another device. Export your local backup, then load the shared version in Data Center.');throw result.error;}
      remoteRevision=Number(result.data);remoteDatasets=document.regionalDatasets;localStorage.setItem(LINK,JSON.stringify({organizationId:organization,remoteRevision}));update('Shared workspace saved · revision '+remoteRevision);
    }catch(error){active=false;update('Cloud sync paused: '+error.message);throw error;}finally{pending=false;}
  }
  async function connect(choice){const remote=await fetchRemote();remoteRevision=remote?.revision||0;remoteDatasets=remote?.document?.regionalDatasets||[];
    if(remote&&choice==='shared'){suppress=true;try{const document={...remote.document};delete document.regionalDatasets;await S.importBackup({format:'stark-unified-backup',exportedAt:remote.updated_at,state:document,regionalDatasets:remoteDatasets});}finally{suppress=false;}}
    else if(remote&&choice!=='local')throw new Error('Choose the shared workspace or upload the local workspace.');
    active=true;localStorage.setItem(LINK,JSON.stringify({organizationId:organization,remoteRevision}));
    if(choice==='shared'&&remote)update('Shared workspace loaded · revision '+remoteRevision);else await sync();
  }
  function disconnect(){active=false;clearTimeout(timer);localStorage.removeItem(LINK);update('Local browser workspace');}
  async function resume(){let saved;try{saved=JSON.parse(localStorage.getItem(LINK)||'null');}catch(_){}if(!saved)return;
    try{const remote=await fetchRemote();if(saved.organizationId!==organization)throw new Error('Cloud account organization changed. Reconnect from Data Center.');
      if(Number(remote?.revision||0)!==saved.remoteRevision)throw new Error('The shared workspace has newer changes. Export local changes and load it from Data Center.');
      remoteRevision=saved.remoteRevision;remoteDatasets=remote?.document?.regionalDatasets||[];active=true;update('Shared workspace connected · revision '+remoteRevision);
    }catch(error){update('Cloud sync paused: '+error.message);}
  }
  window.addEventListener('stark:system-change',()=>{if(!active||suppress)return;clearTimeout(timer);timer=setTimeout(()=>sync().catch(e=>window.StarkSystemUI?.notice(e.message,true)),700);});
  document.addEventListener('DOMContentLoaded',()=>{resume();});
  window.StarkSystemCloud={inspect,connect,sync,disconnect,getStatus:()=>({status,active})};
})();
