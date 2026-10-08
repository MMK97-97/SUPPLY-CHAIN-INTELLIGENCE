/* All-page source/DOM audit. Run normally and with the recovery argument. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {boot}=require('./check-interface.cjs');
const report=[];
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['dist','node_modules','.git'].includes(entry.name))continue;const target=path.join(dir,entry.name);if(entry.isDirectory())walk(target);else if(entry.name.endsWith('.html'))files.push(path.relative(root,target));}}
walk(root);
(async()=>{
 for(const file of files.sort()){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const kind=source.includes('assets/region-router.js')||/^inventory-(us|eu|ca)\.html$/.test(file)||/http-equiv=["']refresh/i.test(source)||!source.includes('assets/system-core.js')&&/location\.(replace|href|assign)/.test(source)&&!/assets\/auth-bootstrap/.test(source)?'redirect':/assets\/auth-bootstrap/.test(source)?'authentication':source.includes('tv-app')||file==='events-tv.html'?'tv':'application';
  if(kind==='redirect'){report.push({file,kind,boot:'static route inspection',errors:[]});continue;}
  let page;
  try{
   page=await boot(file,undefined,{localStorage:process.argv[2]==='recovery'&&source.includes('assets/system-core.js')?{'stark.unifiedSystem.v1':'{broken'}:{},beforeScripts(w){w.HTMLCanvasElement.prototype.getContext=()=>null;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});}});
   const {d,w}=page;await new Promise(resolve=>setImmediate(resolve));
   const ids=new Map();for(const node of d.querySelectorAll('[id]'))ids.set(node.id,(ids.get(node.id)||0)+1);
   const duplicates=[...ids].filter(([,count])=>count>1).map(([id,count])=>({id,count}));
   const unlabeled=[...d.querySelectorAll('input:not([type="hidden"]):not([type="submit"]),select,textarea')].filter(node=>!node.hidden&&!node.disabled&&!node.closest('[hidden]')&&!node.closest('.tv-app')).filter(node=>!node.closest('label')&&!node.getAttribute('aria-label')&&!node.getAttribute('aria-labelledby')&&!d.querySelector('label[for="'+node.id+'"]')).map(node=>({tag:node.tagName,id:node.id,name:node.name,placeholder:node.placeholder||''}));
   report.push({file,kind,errors:[...page.errors],headings:[...d.querySelectorAll('h1')].map(node=>node.textContent.trim()),shared_sidebar:d.querySelectorAll('#system-sidebar').length,shared_header:d.querySelectorAll('.system-header').length,duplicate_ids:duplicates,unlabeled_inputs:unlabeled,body_text_length:d.body.textContent.trim().length,recovery:!!d.querySelector('#system-recovery-export'),loading:w.document.documentElement.classList.contains('stark-page-loading')});
  }catch(error){report.push({file,kind,errors:[error.stack]});}
  finally{page?.w.close();}
 }
 const failed=report.filter(page=>page.errors.length||page.duplicate_ids?.length||page.unlabeled_inputs?.length||page.loading);
 fs.writeFileSync(path.join(root,'docs/verification-pages'+(process.argv[2]==='recovery'?'-recovery':'')+'.json'),JSON.stringify({pages:report.length,passed:report.length-failed.length,failed:failed.length,method:'Source-driven jsdom startup, duplicate-ID, active control label and loading-state checks; standard matchMedia and unavailable decorative canvas emulated. Redirects inspected separately by the static audit. No graphical rendering, authentication or live network.',checks:report},null,2)+'\n');
 if(failed.length)process.exitCode=1;
 console.log(JSON.stringify({pages:report.length,categories:report.reduce((totals,page)=>(totals[page.kind]=(totals[page.kind]||0)+1,totals),{}),runtime_failures:report.filter(page=>page.errors.length).map(page=>({file:page.file,errors:page.errors})),duplicate_ids:report.filter(page=>page.duplicate_ids?.length).map(page=>({file:page.file,ids:page.duplicate_ids})),unlabeled_inputs:report.filter(page=>page.unlabeled_inputs?.length).map(page=>({file:page.file,inputs:page.unlabeled_inputs}))},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
