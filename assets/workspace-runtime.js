/* Explicit per-tab workspace routing. Application stores are scoped; auth stays native. */
(function () {
  'use strict';
  if (window.StarkWorkspace) return;
  const rootURL = new URL('../', document.currentScript.src);
  const nativeLocal = window.localStorage, nativeSession = window.sessionStorage;
  const choiceKey = 'sci.workspace.mode.v1', basePrefix = 'sci.demo.v49.';
  const query = new URLSearchParams(location.search);
  const read = (store, key) => { try { return store.getItem(key); } catch (_) { return null; } };
  const prefix=basePrefix+'g'+(Number(read(nativeLocal,basePrefix+'generation.meta'))||0)+'.';
  // Existing records always retain their workspace. First-time portfolio visitors get a demo.
  const requested = query.get('demo') === '1' ? 'demo' : query.get('workspaceMode') === 'working' ? 'working' : '';
  const mode = requested || read(nativeSession, choiceKey) || (read(nativeLocal, 'stark.unifiedSystem.v1') || read(nativeLocal, 'stark.enterpriseSuite.v1') || read(nativeLocal, 'stark.logisticsSuite.v2') ? 'working' : 'demo');
  const demo = mode === 'demo';
  try { nativeSession.setItem(choiceKey, mode); } catch (_) {}
  const keyFor = key => demo ? prefix + String(key) : String(key);
  function scoped(store) {
    if (!demo) return store;
    const keys = () => { const out = []; for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key?.startsWith(prefix)) out.push(key.slice(prefix.length)); } return out; };
    return Object.freeze({ getItem:key=>store.getItem(keyFor(key)), setItem:(key,value)=>store.setItem(keyFor(key),String(value)), removeItem:key=>store.removeItem(keyFor(key)), key:i=>keys()[i] ?? null, get length(){return keys().length;}, clear(){for(const key of keys())store.removeItem(keyFor(key));} });
  }
  const local = scoped(nativeLocal), session = scoped(nativeSession);
  const cacheKey = (database, store, key) => 'demo.dataset.' + JSON.stringify([database,store,String(key)]);
  const getDataset = (database,store,key) => { if (!demo) return undefined; const raw=local.getItem(cacheKey(database,store,key)); return raw === null ? undefined : JSON.parse(raw); };
  const setDataset = (database,store,key,value) => { if (demo) local.setItem(cacheKey(database,store,key),JSON.stringify(value)); };
  const scopedDB = window.indexedDB && Object.freeze({ open:(name,...args)=>window.indexedDB.open(demo ? prefix+name : name,...args), deleteDatabase:name=>window.indexedDB.deleteDatabase(demo ? prefix+name : name), cmp:(a,b)=>window.indexedDB.cmp(a,b) });
  const ScopedChannel = window.BroadcastChannel && function (name) { return new window.BroadcastChannel(demo ? prefix+name : name); };
  function navigateMode(next, target = 'index.html') {
    if (!['working','demo'].includes(next)) throw new Error('Choose a valid workspace.');
    const url = new URL(target,rootURL);
    if (url.origin !== rootURL.origin || !url.pathname.startsWith(rootURL.pathname)) throw new Error('Invalid workspace destination.');
    nativeSession.setItem(choiceKey,next);
    url.searchParams.delete('demo'); url.searchParams.delete('workspaceMode');
    if(next==='demo')url.searchParams.set('demo','1');else url.searchParams.set('workspaceMode','working');
    location.assign(url.href);
  }
  function resetDemo() {
    if (!demo) throw new Error('Only the demo workspace can be reset here.');
    // A new generation makes all demo databases unreachable without touching working data.
    const generation=(Number(read(nativeLocal,basePrefix+'generation.meta'))||0)+1;
    local.clear();session.clear();nativeLocal.setItem(basePrefix+'generation.meta',String(generation));
    location.assign(new URL('index.html?demo=1',rootURL).href);
  }
  window.StarkWorkspace=Object.freeze({mode,isDemo:demo,rootURL,prefix,localStorage:local,sessionStorage:session,indexedDB:scopedDB,BroadcastChannel:ScopedChannel,storageKey:keyFor,getDataset,setDataset,navigateMode,resetDemo});
  document.documentElement.dataset.workspaceMode=mode;
})();
