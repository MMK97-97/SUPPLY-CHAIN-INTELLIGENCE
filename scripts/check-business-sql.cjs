'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),B=require('../business-core.js');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
test('shared configuration permission and shape are enforced through the actual save RPC',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE public.organizations(id uuid PRIMARY KEY);
      CREATE TABLE public.organization_members(organization_id uuid,user_id uuid,role text);
    `);
    await db.exec(read('20261005_unified_system.sql'));
    await db.exec(read('20261104_business_configuration.sql'));
    const id=n=>'00000000-0000-0000-0000-00000000000'+n,org=id(1),org2=id(5),owner=id(2),editor=id(3),admin=id(4);
    for(const user of [owner,editor,admin])await db.query('INSERT INTO auth.users VALUES ($1)',[user]);
    for(const organization of [org,org2])await db.query('INSERT INTO public.organizations VALUES ($1)',[organization]);
    for(const [o,user,role] of [[org,owner,'owner'],[org,editor,'editor'],[org,admin,'admin'],[org2,editor,'editor']])await db.query('INSERT INTO organization_members VALUES ($1,$2,$3)',[o,user,role]);
    const as=user=>db.query("SELECT set_config('test.user',$1,false)",[user]);
    const save=async(o,rev,doc)=>Number((await db.query('SELECT public.stark_save_workspace($1,$2,$3::jsonb) revision',[o,rev,JSON.stringify(doc)])).rows[0].revision);
    const base={schemaVersion:1,enterprise:{orders:[],inventory:[],accounts:[]},logistics:{}};
    const p=B.template('distributor');p.regions.CA={horizon:21,shipCalendar:'calendar'};const profiled={...base,businessProfile:p};
    await as(editor);assert.equal(await save(org,0,base),1);
    await assert.rejects(save(org,1,profiled),/business_settings_owner_or_admin_required/);
    await assert.rejects(save(org2,0,profiled),/business_settings_owner_or_admin_required/);
    await as(owner);assert.equal(await save(org,1,profiled),2);
    await as(editor);assert.equal(await save(org,2,{...profiled,inventoryNote:'Unrelated edit'}),3);
    await assert.rejects(save(org,3,base),/business_settings_owner_or_admin_required/);
    await assert.rejects(save(org,3,{...base,businessProfile:{...p,name:'Changed'}}),/business_settings_owner_or_admin_required/);
    await as(admin);
    for(const change of [{name:123},{policies:{...p.policies,horizon:0}},{modules:['orders']},{modules:['data','orders','orders']},{regions:{EU:{shipCalendar:'often'}}},{regions:{MX:{horizon:60}}},{services:{returns:'true',invoices:true}}]){
      await assert.rejects(save(org,3,{...base,businessProfile:{...p,...change}}),/invalid_business_settings/);
    }
    assert.equal(await save(org,3,{...base,businessProfile:{...p,name:'Owner approved profile'}}),4);
    assert.equal(await save(org,4,base),5);
  }finally{await db.close();}
});
