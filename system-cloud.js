(function(){
  'use strict';
  // Application data stays inside the selected workspace; auth storage is separate.
  const localStorage = window.StarkWorkspace?.localStorage || window.localStorage;

  const S=window.StarkSystem;if(!S)return;
  if(window.StarkWorkspace?.isDemo){
    const blocked=async()=>{throw new Error('Live organization connections are disabled in the portfolio demo. Sign in to a working workspace to connect.');};
    window.StarkSystemCloud={inspect:blocked,connect:blocked,sync:blocked,disconnect:()=>{},analyzeWithAI:blocked,send3PLRequest:blocked,getAccess:()=>({ready:true,userId:'DEMO_MANAGER',role:'manager',organizationId:''}),canCancelOrders:()=>true,notificationRecords:async()=>[],getStatus:()=>({active:false,status:'Isolated portfolio demo · no live business requests',notificationStatus:'Demo notifications remain in this browser.'})};
    return;
  }
  const LINK='stark.unifiedCloudLink.v1';
  let access = {ready:false,userId:'',organizationId:'',role:''};
  let notificationBusy=false,notificationStatus='Connect the organization workspace for automatic email delivery.';
  const publishAccess=()=>window.dispatchEvent(new CustomEvent('stark:access-change'));
  const getAccess=()=>({...access});
  const canCancelOrders=()=>access.ready && !!access.userId && ['owner','admin','manager'].includes(access.role);
  let client,organization,remoteRevision=0,syncedLocalRevision=-1,active=false,suppress=false,pending=false,timer,status='Local browser workspace',remoteDatasets=[];
  const update=message=>{status=message;window.dispatchEvent(new CustomEvent('stark:cloud-status',{detail:{status,active}}));};
  function loadScript(path,test){return new Promise((resolve,reject)=>{if(test())return resolve();const script=document.createElement('script');script.src=path;script.onload=resolve;script.onerror=()=>reject(new Error('Cloud connection could not load. Check your network.'));document.head.append(script);});}
  async function session(requireEditor = true){
    await loadScript(S.url('assets/supabase-config.js'),()=>!!window.STARK_SUPABASE_CONFIG);
    await loadScript(S.url('assets/vendor/supabase-2.117.3.min.js'),()=>!!window.supabase?.createClient);
    const config=window.STARK_SUPABASE_CONFIG;
    if(!client){
      client=window.supabase.createClient(config.url,config.publishableKey);
      client.auth.onAuthStateChange?.((event,current)=>{if(event==='SIGNED_OUT' || (event==='TOKEN_REFRESHED' && !current)){
        access={ready:true,userId:'',organizationId:'',role:''};active=false;clearTimeout(timer);publishAccess();update('Sign in again to resume organization access.');
      }});
    }
    const {data,error}=await client.auth.getSession();if(error)throw error;
    if(!data.session){access={ready:true,userId:'',organizationId:'',role:''};publishAccess();throw new Error('Sign in first, then return to Data Center to connect the shared workspace.');}
    const verified=await client.auth.getUser();if(verified.error || !verified.data?.user)throw new Error('Your sign-in could not be verified. Sign in again.');
    const membership=await client.from('organization_members').select('organization_id,role').eq('user_id',verified.data.user.id).order('created_at',{ascending:true}).limit(1).maybeSingle();
    if(membership.error)throw membership.error;if(!membership.data)throw new Error('An organization membership is required.');
    const selectedOrganization=membership.data.organization_id;
    if(active && organization && organization!==selectedOrganization){active=false;clearTimeout(timer);update('The signed-in organization changed. Reconnect in Data Center before sharing local data.');throw new Error(status);}
    organization=selectedOrganization;
    access={ready:true,userId:verified.data.user.id,organizationId:organization,role:String(membership.data.role).toLowerCase()};publishAccess();
    if(requireEditor && !['owner','admin','editor','manager'].includes(String(membership.data.role).toLowerCase()))throw new Error('Cloud editing requires an owner, admin, manager or editor role.');
    return organization;
  }
  async function refreshPermissions(){try{await session(false);}catch(_){access={ready:true,userId:'',organizationId:'',role:''};publishAccess();}return getAccess();}
  async function fetchRemote(){await session();const {data,error}=await client.from('stark_unified_workspaces').select('revision,document,updated_at').eq('organization_id',organization).maybeSingle();if(error)throw new Error('Shared data is not configured: '+error.message+'. Apply the included 20261005_unified_system.sql migration.');return data;}
  async function inspect(){const remote=await fetchRemote();return{remote,organizationId:organization};}
  async function sync(){
    if(!active)return;if(pending){clearTimeout(timer);timer=setTimeout(()=>sync().catch(()=>{}),600);return;}
    pending=true;update('Saving shared workspace…');
    try{const datasets=await S.collectRegional(), document=S.getState();document.regionalDatasets=datasets.filter(x=>document.regional[x.region]).map(x=>x.dataset?x:(remoteDatasets.find(y=>y.region===x.region)||x));const result=await client.rpc('stark_save_workspace',{p_organization_id:organization,p_expected_revision:remoteRevision,p_document:document});
      if(result.error){if(/workspace_conflict/i.test(result.error.message))throw new Error('Shared data changed on another device. Export your local backup, then load the shared version in Data Center.');throw result.error;}
      remoteRevision=Number(result.data);syncedLocalRevision=document.revision;remoteDatasets=document.regionalDatasets;localStorage.setItem(LINK,JSON.stringify({organizationId:organization,remoteRevision,localRevision:syncedLocalRevision}));update('Shared workspace saved · revision '+remoteRevision);
      flushNotifications().catch(()=>{});
    }catch(error){active=false;update('Cloud sync paused: '+error.message);throw error;}finally{pending=false;}
  }
  async function connect(choice){const remote=await fetchRemote();remoteRevision=remote?.revision||0;remoteDatasets=remote?.document?.regionalDatasets||[];let adopted=-1;
    if(remote&&choice==='shared'){suppress=true;try{const document={...remote.document};delete document.regionalDatasets;adopted=await S.adoptSharedState(document,remoteDatasets);}finally{suppress=false;}}
    else if(remote&&choice!=='local')throw new Error('Choose the shared workspace or upload the local workspace.');
    active=true;syncedLocalRevision=choice==='shared'?adopted:-1;localStorage.setItem(LINK,JSON.stringify({organizationId:organization,remoteRevision,localRevision:syncedLocalRevision}));
    if(choice==='shared'&&remote){update('Shared workspace loaded · revision '+remoteRevision);if(S.getState().revision!==syncedLocalRevision)await sync();}else await sync();
  }
  function disconnect(){active=false;clearTimeout(timer);localStorage.removeItem(LINK);update('Local browser workspace');}
  async function resume(){let saved;try{saved=JSON.parse(localStorage.getItem(LINK)||'null');}catch(_){}if(!saved)return;
    try{const remote=await fetchRemote();if(saved.organizationId!==organization)throw new Error('Cloud account organization changed. Reconnect from Data Center.');
      if(Number(remote?.revision||0)!==saved.remoteRevision){
        if(!remote || !Number.isInteger(saved.localRevision) || S.getState().revision!==saved.localRevision)throw new Error('The shared workspace has newer changes. Export local changes and load it from Data Center.');
        suppress=true;try{const document={...remote.document};delete document.regionalDatasets;syncedLocalRevision=await S.adoptSharedState(document,remote.document.regionalDatasets || []);}finally{suppress=false;}
        remoteRevision=Number(remote.revision);
      }else{remoteRevision=saved.remoteRevision;syncedLocalRevision=Number.isInteger(saved.localRevision)?saved.localRevision:-1;}
      remoteDatasets=remote?.document?.regionalDatasets||[];active=true;localStorage.setItem(LINK,JSON.stringify({organizationId:organization,remoteRevision,localRevision:syncedLocalRevision}));update('Shared workspace connected · revision '+remoteRevision);if(S.getState().revision!==syncedLocalRevision)await sync();
    }catch(error){update('Cloud sync paused: '+error.message);}
  }
  window.addEventListener('stark:system-change',()=>{if(!active||suppress)return;clearTimeout(timer);timer=setTimeout(()=>sync().catch(e=>window.StarkSystemUI?.notice(e.message,true)),700);});
  const initialize=()=>refreshPermissions().then(()=>resume());
  if(document.readyState==='complete')initialize();else document.addEventListener('DOMContentLoaded',initialize,{once:true});
  window.addEventListener('focus',()=>refreshPermissions());
  async function analyzeWithAI(payload, signal) {
    if (signal?.aborted) throw new DOMException('Analysis cancelled.', 'AbortError');
    await session(false);
    if (signal?.aborted) throw new DOMException('Analysis cancelled.', 'AbortError');
    const current = await client.auth.getSession();
    if (current.error || !current.data?.session?.access_token) throw new Error('Sign in to use AI analysis.');
    const config = window.STARK_SUPABASE_CONFIG;
    const response = await fetch(config.url.replace(/\/$/, '') + '/functions/v1/mk-brain', {
      method: 'POST', headers: { Authorization: 'Bearer ' + current.data.session.access_token, apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, organization_id: organization }), signal
    });
    let result; try { result = await response.json(); } catch (_) { throw new Error('AI service is not deployed or returned an invalid response.'); }
    if (!response.ok) throw new Error(result.error || 'The AI service is unavailable (' + response.status + ').');
    return result;
  }
  async function send3PLRequest(requestId,statusOnly=false) {
    let transmitted=false;const controller=new AbortController();let deadline;
    try {
      if(!active)throw new Error('Connect the shared organization workspace before sending partner orders.');
      await session(true);
      if(!statusOnly){await sync();if(pending)throw new Error('A workspace save is still running. Wait for it to finish, then send again.');if(!active)throw new Error('Cloud synchronization is paused. Reconnect before sending.');}
      const current=await client.auth.getSession();if(current.error || !current.data?.session?.access_token)throw new Error('Sign in before sending partner orders.');
      const config=window.STARK_SUPABASE_CONFIG;
      deadline=setTimeout(()=>controller.abort(),40000);transmitted=true;
      const response=await fetch(config.url.replace(/\/$/,'')+'/functions/v1/threepl-orders',{
        method:'POST',headers:{Authorization:'Bearer '+current.data.session.access_token,apikey:config.publishableKey,'Content-Type':'application/json'},
        body:JSON.stringify({organization_id:organization,request_id:requestId,action:statusOnly?'status':'process'}),signal:controller.signal
      });
      const body=await response.text();if(body.length>65536)throw new Error('The 3PL connector returned an oversized response.');
      let result;try{result=JSON.parse(body);}catch(_){throw new Error('The 3PL connector is unavailable or returned an invalid response.');}
      if(!['QUEUED','SENDING','ACKNOWLEDGED','REJECTED','UNKNOWN'].includes(result.state))throw new Error('The 3PL connector returned an unsupported delivery status.');
      if(!response.ok || result.ok!==true){const error=new Error(result.error || 'The 3PL connector rejected this request.');error.deliveryState=result.state;throw error;}
      return result;
    } catch(error) {
      if(!error.deliveryState)error.deliveryState=transmitted?'UNKNOWN':'QUEUED';
      if(controller.signal.aborted)error.message='The connector timed out. Delivery is unconfirmed; refresh API status before resending.';
      throw error;
    } finally {clearTimeout(deadline);}
  }
  async function flushNotifications() {
    if(!active || notificationBusy)return;
    notificationBusy=true;
    try {
      const current=await client.auth.getSession();
      if(!current.data?.session?.access_token)throw new Error('Sign in to deliver notices.');
      const config=window.STARK_SUPABASE_CONFIG;
      const response=await fetch(config.url.replace(/\/$/,'')+'/functions/v1/workspace-notifications',{
        method:'POST',headers:{Authorization:'Bearer '+current.data.session.access_token,apikey:config.publishableKey,'Content-Type':'application/json'},
        body:JSON.stringify({organization_id:organization}),signal:AbortSignal.timeout(20000)
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error || 'Email delivery is awaiting service configuration.');
      notificationStatus=result.sent ? result.sent+' notices accepted by the email service.' : 'Email queue checked; scheduled reminders continue in the background.';
    }catch(_){notificationStatus='Changes saved. Email delivery is pending; configure the notification service and scheduled job.';}
    finally{notificationBusy=false;window.dispatchEvent(new CustomEvent('stark:notification-status'));}
  }
  async function notificationRecords() {
    await session(false);
    const {data,error}=await client.from('stark_notification_outbox').select('id,kind,account_id,recipient,state,created_at,sent_at,last_error').eq('organization_id',organization).order('created_at',{ascending:false}).limit(50);
    if(error)throw new Error('Apply the notification database migration to view delivery status.');
    return data || [];
  }
  async function refreshCopilot() {
    if(!active || pending || S.getState().revision!==syncedLocalRevision)return {pendingLocal:true};
    const localRevision=S.getState().revision;
    await session(false);
    const {data,error}=await client.from('stark_unified_workspaces').select('revision,document,updated_at').eq('organization_id',organization).maybeSingle();
    if(error)throw error;
    if(!data || Number(data.revision)<=remoteRevision || pending || S.getState().revision!==localRevision)return {changed:false};
    suppress=true;
    try{const document={...data.document},datasets=document.regionalDatasets || [];delete document.regionalDatasets;const adopted=await S.adoptSharedState(document,datasets);remoteRevision=Number(data.revision);remoteDatasets=datasets;syncedLocalRevision=adopted;localStorage.setItem(LINK,JSON.stringify({organizationId:organization,remoteRevision,localRevision:syncedLocalRevision}));update('Shared workspace refreshed · revision '+remoteRevision);}
    finally{suppress=false;if(S.getState().revision!==syncedLocalRevision)sync().catch(()=>{});}
    return {changed:true};
  }
  async function copilotRequest(payload) {
    if(!active)throw new Error('Connect the shared organization workspace to use the Co-Pilot email service.');
    await session(true);
    const end=Date.now()+15000;
    while(pending && Date.now()<end)await new Promise(resolve=>setTimeout(resolve,60));
    if(pending)throw new Error('A workspace save is still running. Wait before recording communication.');
    await sync();if(!active || pending)throw new Error('Workspace synchronization is paused. Reconnect first.');
    const localRevision=S.getState().revision,current=await client.auth.getSession();
    if(!current.data?.session?.access_token)throw new Error('Sign in to use the Co-Pilot service.');
    const config=window.STARK_SUPABASE_CONFIG;
    const response=await fetch(config.url.replace(/\/$/,'')+'/functions/v1/mk-copilot',{method:'POST',headers:{Authorization:'Bearer '+current.data.session.access_token,apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({...payload,organization_id:organization}),signal:AbortSignal.timeout(40000)});
    const raw=await response.text();if(raw.length>16000000)throw new Error('The Co-Pilot service returned an oversized workspace.');
    let result;try{result=JSON.parse(raw);}catch(_){throw new Error('Deploy the Co-Pilot backend and database migration before using email capture.');}
    if(!response.ok)throw new Error(result.error || 'The Co-Pilot request could not complete.');
    if(result.document){
      if(S.getState().revision!==localRevision){active=false;update('Communication saved remotely. Local edits were preserved; reconnect and load the shared workspace to view the new timeline.');throw new Error(status);}
      suppress=true;
      try{const document={...result.document},datasets=document.regionalDatasets || [];delete document.regionalDatasets;const adopted=await S.adoptSharedState(document,datasets);remoteRevision=Number(result.revision);remoteDatasets=datasets;syncedLocalRevision=adopted;localStorage.setItem(LINK,JSON.stringify({organizationId:organization,remoteRevision,localRevision:syncedLocalRevision}));}
      finally{suppress=false;if(S.getState().revision!==syncedLocalRevision)sync().catch(()=>{});}
    }
    return result;
  }
  window.StarkSystemCloud={inspect,connect,sync,disconnect,analyzeWithAI,send3PLRequest,refreshPermissions,getAccess,canCancelOrders,flushNotifications,notificationRecords,copilotRequest,refreshCopilot,getStatus:()=>({status,active,notificationStatus})};
})();
