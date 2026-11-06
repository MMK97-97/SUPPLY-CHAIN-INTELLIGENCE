'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'platform-studio.html'),'utf8');
const engine=fs.readFileSync(path.join(root,'platform-studio.js'),'utf8');
function fixture() {
  const dom=new JSDOM(html,{url:'https://example.test/erp/platform-studio.html',runScripts:'outside-only'});
  dom.window.MK97SystemUI={notice(){}};
  dom.window.eval(engine);
  dom.window.eval([...dom.window.document.scripts].find(x=>x.textContent.includes('Render Industry Presets Grid')).textContent);
  return dom;
}
test('selecting a terminology preset and saving persists labels and visibility without changing data',()=>{
  const dom=fixture();
  try{
    const w=dom.window,d=w.document;
    d.querySelector('[data-industry-id="tpl_logistics"]').click();
    d.querySelector('[name="module_switch"][value="orders"]').checked=false;
    d.querySelector('[data-theme="dark"]').click();
    d.querySelector('#btn-studio-apply').click();
    const cfg=w.MK97Platform.getConfig();
    assert.equal(cfg.industry,'tpl_logistics');assert.equal(cfg.terms.location,'Cross-Dock / Staging Bay');
    assert.equal(cfg.themeMode,'dark');assert.equal(cfg.enabledModules.includes('orders'),false);
    assert.equal(JSON.parse(w.localStorage.getItem('sci.platform.config.v2')).themeMode,'dark');
    assert.equal(d.documentElement.getAttribute('data-sci-theme'),'dark');
    assert.equal(d.querySelectorAll('.industry-card-kpis').length,0);
  }finally{dom.window.close();}
});
test('settings preview and stored wordmark render as text and returned config is a copy',()=>{
  const dom=fixture();
  try{
    const w=dom.window,d=w.document,mark=d.querySelector('#inp-brand-wordmark');
    mark.value='<img src=x onerror=alert(1)>';mark.dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.equal(d.querySelector('#preview-wordmark img'),null);
    d.querySelector('#btn-studio-apply').click();
    const cfg=w.MK97Platform.getConfig();
    assert.match(cfg.brandWordmark,/^[\p{L}\p{N}]{1,3}$/u);
    cfg.terms.item='Mutated';cfg.enabledModules.length=0;
    assert.notEqual(w.MK97Platform.getConfig().terms.item,'Mutated');
    assert.ok(w.MK97Platform.getConfig().enabledModules.length);
  }finally{dom.window.close();}
});
test('old Enterprise Suite bookmark resolves to Operations, preserving region and demo mode',()=>{
  const script=fs.readFileSync(path.join(root,'integrations.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const href='https://example.test/erp/integrations.html?demo=1&region=CA&unrelated=1';let destination;
  vm.runInNewContext(script,{URL,URLSearchParams,location:{href,search:new URL(href).search,replace:v=>destination=v}});
  assert.equal(destination,'https://example.test/erp/workspace.html?demo=1&region=CA&view=operations');
});
