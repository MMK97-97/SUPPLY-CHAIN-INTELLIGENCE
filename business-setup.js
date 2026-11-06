(function(){
  'use strict';
  const B=window.MK97Business,S=window.StarkSystem,root=document.querySelector('#business-setup');
  if(!B||!S||!root)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const regions={all:'Business defaults',US:'United States',CA:'Canada',EU:'European Union'};
  let draft,expected,scope='all',dirty=false,message='',error=false;
  const cloud=()=>window.StarkSystemCloud;
  const canEdit=()=>B.canEdit(window.StarkWorkspace,cloud());
  function read(){
    const s=S.getState();draft=B.profile(s);expected=JSON.stringify(s.businessProfile||null);dirty=false;
  }
  function options(values,selected){return Object.entries(values).map(([k,v])=>`<option value="${esc(k)}" ${selected===k?'selected':''}>${esc(v)}</option>`).join('');}
  function capture(){
    if(!canEdit()||!root.querySelector('form'))return;
    const fd=new FormData(root.querySelector('form'));
    draft.name=String(fd.get('name')||'').trim();
    draft.modules=Object.keys(B.MODULES).filter(key=>key==='data'||fd.has('module-'+key));
    draft.services={returns:fd.has('returns'),invoices:fd.has('invoices')};
    const values={};
    for(const [key,def] of Object.entries(B.FIELDS)){
      const raw=fd.get(key);
      if(scope!=='all'&&raw==='')continue;
      values[key]=def.choices?raw:raw===''?null:Number(raw);
    }
    if(scope==='all')draft.policies=values;
    else if(Object.keys(values).length)draft.regions[scope]=values;
    else delete draft.regions[scope];
  }
  function status(){
    const e=root.querySelector('#bs-status'),access=cloud()?.getAccess?.();
    if(!e)return;
    const demo=window.StarkWorkspace?.isDemo, active=cloud()?.getStatus?.().active;
    e.textContent=message||(!canEdit()?(access?.ready?'Business settings are read only. An organization owner or admin can edit them.':'Checking organization access…'):demo?'Sample workspace. Changes apply only to this demo.':active?'Connected to the shared workspace. Saved changes sync through Data Center.':'This workspace is not connected. Changes are stored on this device until shared sync is connected.');
    const syncStatus=cloud()?.getStatus?.().status||'';
    if(!demo&&syncStatus.startsWith('Cloud sync paused:'))e.textContent+=' '+syncStatus;
    e.classList.toggle('bs-error',error||syncStatus.startsWith('Cloud sync paused:'));
  }
  function render(focus){
    const all=scope==='all', current=all?draft.policies:draft.regions[scope]||{},editable=canEdit();
    root.innerHTML=`
      <header class="bs-head"><div><p class="bs-kicker">SYSTEM &amp; DATA</p><h1>Business setup</h1><p>Configure the modules and operating rules your team uses. Use regional overrides where policies differ.</p></div><a href="${esc(S.url('workspace.html?view=operations'))}">Open Operations →</a></header>
      <p id="bs-status" role="status" class="bs-status"></p>
      <form>
        <fieldset class="bs-card" ${editable?'':'disabled'}>
          <legend>1. Business profile</legend>
          <div class="bs-grid"><label>Business name<input name="name" maxlength="64" value="${esc(draft.name)}" placeholder="Shown in Operations"></label>
          <label>Starting template<select id="bs-template">${options(Object.fromEntries(Object.entries(B.PRESETS).map(([k,v])=>[k,v.label])),draft.template)}</select></label></div>
          <div class="bs-inline"><button class="bs-secondary" type="button" id="bs-apply">Use template</button><p id="bs-template-note">${esc(B.PRESETS[draft.template].note)} This replaces the draft default rules and module choices. Regional overrides are kept.</p></div>
        </fieldset>
        <fieldset class="bs-card" ${editable?'':'disabled'}>
          <legend>2. Modules &amp; workflows</legend>
          <p>Choose what appears in the shared navigation and Operations. Links and records remain available to authorized users.</p>
          <div class="bs-modules">${Object.entries(B.MODULES).map(([key,label])=>`<label><input type="checkbox" name="module-${key}" ${draft.modules.includes(key)?'checked':''} ${key==='data'?'disabled':''}> ${esc(label)}</label>`).join('')}</div>
          <div class="bs-inline bs-services"><label><input type="checkbox" name="returns" ${draft.services.returns?'checked':''}> New customer returns</label><label><input type="checkbox" name="invoices" ${draft.services.invoices?'checked':''}> New invoice reviews</label></div>
          <p>Turning off a workflow stops new records. Existing returns and invoice reviews can still be completed.</p>
        </fieldset>
        <section class="bs-card bs-policy">
          <div class="bs-policy-head"><h2>3. Operating rules</h2><label>Policy scope<select id="bs-scope">${options(regions,scope)}</select></label></div>
          <p>${all?'These defaults apply wherever a regional override is not set.':'Leave a field blank or select “Use business default” to inherit it.'}</p>
          <fieldset ${editable?'':'disabled'} aria-label="Operating rules"><div class="bs-grid">
            ${Object.entries(B.FIELDS).map(([key,f])=>{
              const value=current[key];
              const inherited=f.choices?.[draft.policies[key]]??draft.policies[key];
              return `<label for="bs-${key}">${esc(f.label)}${f.choices?`<select id="bs-${key}" name="${key}">${options(all?f.choices:{'':'Use business default · '+inherited,...f.choices},value??'')}</select>`:`<input id="bs-${key}" name="${key}" type="number" min="${f.min}" max="${f.max}" step="1" ${all?'required':''} placeholder="${all?'':'Default: '+inherited}" value="${esc(value??'')}" />`}<small>${esc(f.help)}</small></label>`;
            }).join('')}
          </div></fieldset>
        </section>
        <div class="bs-actions"><button type="button" class="bs-secondary" id="bs-reload">Reload saved settings</button><button type="submit" ${editable?'':'disabled'}>Save business settings</button></div>
      </form>`;
    status();
    if(focus)root.querySelector(focus)?.focus();
  }
  read();render();
  root.addEventListener('input',event=>{
    if(event.target.id==='bs-template'){root.querySelector('#bs-template-note').textContent=B.PRESETS[event.target.value].note+' This replaces the draft default rules and module choices. Regional overrides are kept.';return;}
    if(event.target.id!=='bs-scope'){dirty=true;message='Unsaved changes.';error=false;status();}
  });
  root.addEventListener('change',event=>{
    if(event.target.id!=='bs-scope')return;
    capture();scope=event.target.value;render('#bs-scope');
  });
  root.addEventListener('click',event=>{
    if(event.target.id==='bs-apply'){
      capture();draft=B.template(root.querySelector('#bs-template').value,draft);
      dirty=true;message='Template loaded. Review its defaults and save to apply them.';error=false;render('#bs-apply');
    }
    if(event.target.id==='bs-reload'){
      if(dirty&&!window.confirm('Discard your unsaved business settings?'))return;
      read();message='Saved settings loaded.';error=false;render('#bs-reload');
    }
  });
  root.addEventListener('submit',event=>{
    event.preventDefault();
    try{
      capture();B.save(S,draft,{expected,workspace:window.StarkWorkspace,cloud:cloud()});
      read();message='Business settings saved.';error=false;render('#bs-status');
    }catch(e){message=e.message;error=true;status();}
  });
  window.addEventListener('stark:system-change',()=>{
    if(dirty)return;
    if(JSON.stringify(S.getState().businessProfile||null)!==expected){read();render();}
  });
  window.addEventListener('stark:access-change',()=>{
    const disabled=root.querySelector('fieldset')?.disabled;
    if(disabled===canEdit())render();
    else status();
  });
  window.addEventListener('stark:cloud-status',status);
})();
