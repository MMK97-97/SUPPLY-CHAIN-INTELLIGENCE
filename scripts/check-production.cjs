/* Node transport/DOM/build checks. No browser, rendering, or live services. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { JSDOM, VirtualConsole } = require('jsdom');
const { boot } = require('./check-interface.cjs');
const T = require('../assets/mk-analysis-tools.js');
const H = require('../assets/mk-space.js');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const passed = [], failures = [];
const tick = () => new Promise(resolve => setImmediate(resolve));
async function test(name, fn) {
  try { await fn(); passed.push(name); console.log('PASS', name); }
  catch (error) { failures.push({ name, message: error.stack }); console.error('FAIL', name, error.message); }
}
function sandbox(publicPage = false) {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', error => { if (!/navigation.*not implemented|Not implemented: navigation/i.test(error.message)) errors.push(error.message); });
  const dom = new JSDOM('<!doctype html><html ' + (publicPage ? 'data-auth-public="true"' : '') + '><head></head><body><main id="content"><input value="Keep this draft"></main><p id="auth-message" hidden></p></body></html>', { url: 'https://example.test/SUPPLY-CHAIN-INTELLIGENCE/index.html', runScripts: 'outside-only', virtualConsole: vc });
  const w = dom.window, d = w.document;
  let script = { src: 'https://example.test/SUPPLY-CHAIN-INTELLIGENCE/assets/page-navigation.js' };
  Object.defineProperty(d, 'currentScript', { get: () => script, configurable: true });
  const timers = [];
  w.setTimeout = (fn, ms) => { const timer = { fn, ms, active: true }; timers.push(timer); return timer; };
  w.clearTimeout = timer => { if (timer) timer.active = false; };
  const evaluate = file => { script = { src: new URL(file, w.location.href).href }; w.eval(read(file)); };
  const link = (href, attributes = {}) => {
    const node = d.createElement('a'); node.href = href; node.textContent = 'Page';
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    d.body.append(node); return node;
  };
  const click = (node, options = {}) => {
    const event = new w.MouseEvent('click', { button: 0, bubbles: true, cancelable: true, ...options });
    node.dispatchEvent(event); return event;
  };
  return { dom, w, d, evaluate, link, click, timers, errors };
}
function fixture() {
  return T.validateSnapshot({ capturedAt: '2026-10-07T18:00:00Z', scope: 'US', sales: [], workspace: { sampleData: true }, reports: [{ region: 'US', fileName: 'Synthetic-Cozy-Earth.csv', importedAt: '2026-10-07T18:00:00Z', settings: {}, summary: { rowCount: 3, eligibleItems: 2, stockoutRisks: 1, recommendedUnits: 26 }, items: [
    { model: 'TEST-COZY-001', brand: 'Cozy Earth', status: 'LIVE', eligible: true, onHand: 4, demand: 10, recommended: 26, stockoutRisk: true, confidence: 80, riskScore: 85 },
    { model: 'TEST-COZY-002', brand: 'Cozy Earth', status: 'LIVE', eligible: true, onHand: 300, demand: 10, recommended: 0, stockoutRisk: false, confidence: 80 },
    { model: 'TEST-COZY-EXCLUDED', brand: 'Cozy Earth', status: 'DISCONTINUED', eligible: false, onHand: 500, demand: 0, recommended: 0, stockoutRisk: false }
  ] }] });
}
async function main() {
  await test('native navigation starts immediately and keeps current content visible', async () => {
    const s = sandbox();
    try {
      s.evaluate('assets/page-navigation.js'); await tick();
      const current = s.d.querySelector('#content'), before = current.outerHTML;
      const event = s.click(s.link('crm/index.html')); await tick();
      assert.equal(event.defaultPrevented, false);
      assert.equal(current.outerHTML, before); assert.equal(current.style.opacity, '');
      assert.ok(s.d.documentElement.classList.contains('stark-navigation-pending'));
      assert.ok(!/leaving/.test(s.d.body.className));
      assert.equal(s.timers.filter(x => x.active).length, 1);
      assert.equal(s.timers.find(x => x.active).ms, 12000);
      assert.deepEqual(s.errors, []);
    } finally { s.w.close(); }
  });
  await test('modified, external, download, new-tab and same-document links keep native behavior', async () => {
    const s = sandbox();
    try {
      s.evaluate('assets/page-navigation.js');
      for (const [href, attr, option] of [
        ['crm/index.html', {}, { ctrlKey: true }], ['crm/index.html', {}, { metaKey: true }],
        ['crm/index.html', {}, { shiftKey: true }], ['crm/index.html', {}, { altKey: true }],
        ['crm/index.html', {}, { button: 1 }], ['https://external.test/index.html', {}, {}],
        ['crm/index.html', { download: '' }, {}], ['crm/index.html', { target: '_blank' }, {}],
        ['#section', {}, {}], ['index.html', {}, {}]
      ]) {
        const event = s.click(s.link(href, attr), option); await tick();
        assert.equal(event.defaultPrevented, false);
        assert.ok(!s.d.documentElement.classList.contains('stark-navigation-pending'), href);
      }
    } finally { s.w.close(); }
  });
  await test('cancelled actions never show navigation progress; stalled navigation remains usable', async () => {
    const s = sandbox();
    try {
      s.evaluate('assets/page-navigation.js');
      const cancelled = s.link('crm/index.html'); cancelled.addEventListener('click', event => event.preventDefault());
      s.click(cancelled); await tick(); assert.ok(!s.d.documentElement.classList.contains('stark-navigation-pending'));
      s.click(s.link('warehouse-management/index.html')); await tick();
      s.timers.find(x => x.active).fn();
      assert.ok(!s.d.documentElement.classList.contains('stark-navigation-pending'));
      assert.equal(s.d.querySelector('input').value, 'Keep this draft');
    } finally { s.w.close(); }
  });
  await test('back-forward restoration resets progress and preserves form drafts', async () => {
    const s = sandbox();
    try {
      s.evaluate('assets/page-navigation.js'); await tick();
      const input = s.d.querySelector('input'); input.value = 'Unsaved PO draft';
      s.click(s.link('crm/index.html')); await tick();
      assert.ok(s.d.documentElement.classList.contains('stark-navigation-pending'));
      s.w.dispatchEvent(new s.w.PageTransitionEvent('pageshow', { persisted: true }));
      assert.ok(!s.d.documentElement.classList.contains('stark-navigation-pending'));
      assert.equal(input.value, 'Unsaved PO draft');
      assert.equal(s.d.querySelector('#stark-navigation-status'), null);
    } finally { s.w.close(); }
  });
  await test('intent prefetch is bounded, deduplicated and excludes external or sensitive routes', () => {
    const s = sandbox();
    try {
      s.evaluate('assets/page-navigation.js');
      const intent = node => node.dispatchEvent(new s.w.Event('pointerover', { bubbles: true }));
      for (const [url, attr] of [
        ['https://external.test/index.html', {}], ['../outside.html', {}],
        ['auth-callback.html?code=private', {}], ['login.html', {}], ['cloud-agent.html', {}],
        ['crm/index.html?token=private', {}], ['assets/report.csv', {}],
        ['crm/index.html', { download: '' }], ['crm/index.html', { 'data-no-prefetch': '' }]
      ]) intent(s.link(url, attr));
      assert.equal(s.d.querySelectorAll('link[rel=prefetch]').length, 0);
      const focused = s.link('crm/index.html#details'); focused.dispatchEvent(new s.w.Event('focusin', { bubbles: true })); intent(focused);
      for (let i = 0; i < 9; i++) intent(s.link('inventory-dashboard-us.html?filter=' + i));
      const hints = [...s.d.querySelectorAll('link[rel=prefetch]')];
      assert.equal(hints.length, 6); assert.equal(new Set(hints.map(x => x.href)).size, 6);
      assert.ok(hints.every(x => x.as === 'document' && !x.href.includes('#')));
      assert.equal(s.d.querySelectorAll('script[type="speculationrules"], link[rel=prerender]').length, 0);
    } finally { s.w.close(); }
  });
  await test('data saver, slow connections and offline mode suppress speculative requests', () => {
    for (const config of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }, { offline: true }]) {
      const s = sandbox();
      try {
        Object.defineProperty(s.w.navigator, 'connection', { value: config });
        if (config.offline) Object.defineProperty(s.w.navigator, 'onLine', { value: false });
        s.evaluate('assets/page-navigation.js');
        s.link('crm/index.html').dispatchEvent(new s.w.Event('focusin', { bubbles: true }));
        assert.equal(s.d.querySelectorAll('link[rel=prefetch]').length, 0);
      } finally { s.w.close(); }
    }
  });
  await test('every shared page paints a loading surface before dependencies and defers shared data scripts', () => {
    let count = 0;
    function visit(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'dist') continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) { visit(file); continue; }
        if (!file.endsWith('.html')) continue;
        const html = fs.readFileSync(file, 'utf8');
        if (!html.includes('assets/system-core.js') && !html.includes('assets/auth-bootstrap.js')) continue;
        count++;
        assert.ok(html.indexOf('charset=') < 1024);
        assert.ok(html.indexOf('stark-navigation-critical') < html.indexOf('src='));
        assert.ok(html.includes('@view-transition{navigation:auto}'));
        const dom = new JSDOM(html), d = dom.window.document;
        for (const script of d.querySelectorAll('script[src*="system-seed.js"], script[src*="system-core.js"]')) assert.ok(script.defer, file);
        assert.equal(d.querySelectorAll('script[src*="page-navigation.js"]').length, 1);
        for (const font of d.querySelectorAll('link[href*="fonts.googleapis.com/css"]')) assert.equal(font.media, 'print');
        dom.window.close();
      }
    }
    visit(root); assert.equal(count, 88); // Former Regional Workspace is now a dependency-free redirect.
  });
  await test('legacy regional handlers cannot hide a page or delay its native navigation', () => {
    for (const file of ['assets/app.js', 'assets/premium-shell.js', 'assets/inventory-transitions.js', 'assets/inventory-pages-us.js', 'assets/inventory-pages-eu.js', 'assets/inventory-pages-ca.js', 'assets/inventory-ats-eu.js', 'events.html']) {
      assert.ok(!/classList\.add\(["'](?:page-leaving|premium-content-leaving|inventory-fallback-leaving)/.test(read(file)), file);
    }
    assert.ok(!read('assets/inventory-transitions.js').includes('navigation: none'));
    assert.match(read('assets/unified-system.css'), /prefers-reduced-motion/);
  });
  await test('Cloudflare fingerprint URLs match the actual asset bytes in root and nested pages', () => {
    const manifest = JSON.parse(read('dist/asset-manifest.json')).fingerprints;
    assert.ok(Object.keys(manifest).length >= 60);
    for (const [original, fingerprinted] of Object.entries(manifest)) {
      const bytes = fs.readFileSync(path.join(root, 'dist', original));
      const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
      assert.ok(fingerprinted.includes('.' + hash + '.'));
      assert.deepEqual(fs.readFileSync(path.join(root, 'dist', fingerprinted)), bytes);
      assert.deepEqual(fs.readFileSync(path.join(root, original)), bytes, original + ': build is current');
    }
    for (const page of ['index.html', 'mk-brain.html', 'crm/index.html', 'warehouse-management/index.html']) {
      const dom = new JSDOM(read('dist/' + page)), d = dom.window.document;
      for (const node of d.querySelectorAll('script[src],link[rel=stylesheet]')) {
        const url = node.getAttribute('src') || node.getAttribute('href');
        if (!url || /^(https?:)?\/\//.test(url)) continue;
        assert.ok(/\.[a-f0-9]{12}\.(js|css)$/.test(url), page + ' ' + url);
        assert.ok(fs.existsSync(path.resolve(root, 'dist', path.dirname(page), url)));
      }
      dom.window.close();
    }
  });
  await test('Cloudflare output contains release metadata and excludes backend source and QA artifacts', () => {
    assert.deepEqual(JSON.parse(read('dist/VERSION.json')), JSON.parse(read('VERSION.json')));
    assert.ok(read('dist/_headers').includes('X-Content-Type-Options: nosniff'));
    assert.ok(read('wrangler.jsonc').includes('"run_worker_first": ["/assets/*", "/api/*"]'));
    for (const name of ['server', 'supabase', 'scripts', 'docs', '.github', 'node_modules', 'worker.js']) assert.ok(!fs.existsSync(path.join(root, 'dist', name)));
    assert.ok(fs.existsSync(path.join(root, 'dist/assets/vendor/supabase-LICENSE.txt')));
  });
  const worker = (await import(pathToFileURL(path.join(root, 'worker.js')).href)).default;
  await test('Worker caches fingerprinted assets immutably while pages and mutable assets revalidate', async () => {
    const env = { ASSETS: { fetch: async request => new Response(request.method === 'HEAD' ? null : 'asset', { headers: { 'content-type': new URL(request.url).pathname.endsWith('.html') ? 'text/html' : 'text/javascript', etag: '"stable"', 'cache-control': 'public, max-age=0, must-revalidate' } }) } };
    for (const [url, expected] of [['/assets/system-core.012345abcdef.js', 'immutable'], ['/assets/system-core.js?v=20261008-3', 'must-revalidate'], ['/assets/supply-chain-logo.png', 'max-age=86400'], ['/index.html', 'must-revalidate'], ['/VERSION.json', 'must-revalidate']]) {
      const response = await worker.fetch(new Request('https://example.test' + url), env);
      assert.ok(response.headers.get('cache-control').includes(expected)); assert.equal(response.headers.get('etag'), '"stable"');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
    const head = await worker.fetch(new Request('https://example.test/assets/system-core.012345abcdef.js', { method: 'HEAD' }), env);
    assert.equal(await head.text(), '');
  });
  await test('Worker preserves private, partial, authenticated and error response caching', async () => {
    for (const option of [{ status: 404 }, { status: 206 }, { cache: 'private, max-age=0' }, { cache: 'no-store' }, { cookie: 'session=synthetic' }, { authorization: 'Bearer synthetic' }, { range: 'bytes=0-3' }, { vary: 'Cookie' }]) {
      const headers = { 'cache-control': option.cache || 'max-age=0', 'content-type': 'text/javascript' };
      if (option.cookie) headers['set-cookie'] = option.cookie;
      if (option.vary) headers.vary = option.vary;
      const reqHeaders = {};
      if (option.authorization) reqHeaders.authorization = option.authorization;
      if (option.range) reqHeaders.range = option.range;
      const env = { ASSETS: { fetch: async () => new Response('asset', { status: option.status || 200, headers }) } };
      const response = await worker.fetch(new Request('https://example.test/assets/system-core.012345abcdef.js', { headers: reqHeaders }), env);
      assert.equal(response.headers.get('cache-control'), headers['cache-control']);
    }
  });
  await test('Worker resolves root, nested and extensionless deep links without masking unknown routes', async () => {
    const names = new Set(['/index.html', '/crm/index.html', '/mk-brain.html']);
    const env = { ASSETS: { fetch: async request => new Response(request.method === 'HEAD' ? null : new URL(request.url).pathname, { status: names.has(new URL(request.url).pathname) ? 200 : 404 }) } };
    for (const [url, expected] of [['/', '/index.html'], ['/crm/', '/crm/index.html'], ['/crm', '/crm/index.html'], ['/mk-brain', '/mk-brain.html']]) {
      const response = await worker.fetch(new Request('https://example.test' + url), env);
      assert.equal(response.status, 200); assert.equal(await response.text(), expected);
    }
    assert.equal((await worker.fetch(new Request('https://example.test/crm', { method: 'HEAD' }), env)).status, 200);
    assert.equal((await worker.fetch(new Request('https://example.test/crm', { method: 'POST', body: 'unchanged' }), env)).status, 404);
    assert.equal((await worker.fetch(new Request('https://example.test/unknown'), env)).status, 404);
    assert.equal((await worker.fetch(new Request('https://example.test/assets/missing.js'), env)).status, 404);
  });
  await test('invalid AI API requests are rejected without inference and never cached', async () => {
    const response = await worker.fetch(new Request('https://example.test/api/supply-ai/chat', { method: 'POST', body: '{"payload":{}}', headers: { 'content-type': 'application/json' } }), {});
    assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  const contract = { named_endpoints: { '/website_chat': { parameters: [{ component: 'Json' }], returns: [{ component: 'Json' }] } } };
  const apiRequest = () => new Request('https://example.test/api/supply-ai/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload: { message: 'Synthetic brand analysis', context: '{}', history: [], mode: 'Fast' } }) });
  await test('Worker proxy uses the explicit JSON endpoint and a completed analysis envelope', async () => {
    const originalFetch = global.fetch, calls = [];
    try {
      global.fetch = async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith('/info')) return new Response(JSON.stringify(contract));
        if (options.method === 'POST') return new Response('{"event_id":"synthetic_event"}');
        return new Response('event: heartbeat\ndata: null\n\nevent: complete\ndata: [{"ok":true,"answer":"Synthetic verified analysis."}]\n\n');
      };
      const response = await worker.fetch(apiRequest(), {});
      assert.equal(response.status, 200);
      assert.equal((await response.json()).answer, 'Synthetic verified analysis.');
      assert.equal(calls.length, 3);
      assert.ok(calls[1].url.endsWith('/gradio_api/call/website_chat'));
      assert.equal(JSON.parse(calls[1].options.body).data.length, 1);
    } finally { global.fetch = originalFetch; }
  });
  await test('Worker cannot fall through to an unrelated Gradio UI endpoint', async () => {
    const originalFetch = global.fetch, calls = [];
    try {
      global.fetch = async url => { calls.push(url); return new Response(JSON.stringify({ named_endpoints: { '/chat_button': { parameters: [{ component: 'Textbox' }] } } })); };
      const response = await worker.fetch(apiRequest(), {});
      assert.equal(response.status, 503); assert.equal(calls.length, 1);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    } finally { global.fetch = originalFetch; }
  });
  await test('Worker rejects interface text, heartbeat-only output, errors and unfinished SSE frames', async () => {
    const originalFetch = global.fetch;
    try {
      for (const stream of ['event: complete\ndata: ["Enter a message."]\n\n', 'event: heartbeat\ndata: [{"ok":true,"answer":"Not complete."}]\n\n', 'event: error\ndata: {"error":"failed"}\n\n', 'event: complete\ndata: [{"ok":true,"answer":"Partial frame."}]']) {
        global.fetch = async (url, options) => url.endsWith('/info') ? new Response(JSON.stringify(contract)) : options.method === 'POST' ? new Response('{"event_id":"synthetic_event"}') : new Response(stream);
        const response = await worker.fetch(apiRequest(), {});
        assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
      }
    } finally { global.fetch = originalFetch; }
  });
  await test('auth dependencies load locally in parallel; timeout keeps protected contents hidden', async () => {
    const s = sandbox();
    try {
      s.evaluate('assets/auth-bootstrap.js');
      const scripts = [...s.d.querySelectorAll('script[src]')];
      assert.equal(scripts.length, 2);
      assert.ok(scripts.some(x => x.src.endsWith('/vendor/supabase-2.117.3.min.js')));
      assert.ok(scripts.every(x => x.src.startsWith(s.w.location.origin)));
      assert.equal(s.w.getComputedStyle(s.d.body).visibility, 'hidden');
      s.w.StarkAuth = { state: { ready: false } };
      s.timers.find(x => x.ms === 20000).fn();
      assert.ok(s.d.documentElement.classList.contains('stark-auth-failed'));
      assert.equal(s.w.getComputedStyle(s.d.querySelector('#content')).visibility, 'hidden');
      assert.equal(s.d.querySelector('.stark-auth-fatal').getAttribute('role'), 'alert');
    } finally { s.w.close(); }
  });
  await test('auth dependency failures show a useful error on the public sign-in page', async () => {
    const s = sandbox(true);
    try {
      s.evaluate('assets/auth-bootstrap.js');
      s.d.querySelector('script[src*="vendor/"]').dispatchEvent(new s.w.Event('error'));
      await tick();
      const message = s.d.querySelector('#auth-message');
      assert.equal(message.hidden, false); assert.equal(message.getAttribute('role'), 'alert');
      assert.ok(message.textContent.includes('Unable to load'));
      assert.equal(s.d.querySelector('.stark-auth-fatal'), null);
    } finally { s.w.close(); }
  });
  await test('sign-in and password forms cannot submit credentials while the client is loading', () => {
    for (const file of ['login.html', 'auth-callback.html']) {
      const dom = new JSDOM(read(file), { url: 'https://example.test/SUPPLY-CHAIN-INTELLIGENCE/' + file, runScripts: 'outside-only' });
      const w = dom.window, d = w.document;
      try {
        const form = d.querySelector('#login-form, #password-form');
        assert.equal(form.method, 'post');
        assert.equal(form.querySelector('[type=submit]').disabled, true);
        w.eval(read('assets/auth-bootstrap.js'));
        const event = new w.Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true);
        assert.equal(d.querySelector('#auth-message').hidden, false);
        assert.ok(!w.location.search.includes('password'));
      } finally { w.close(); }
    }
  });
  await test('auth reveals protected content only after membership resolves and clears a late failure panel', async () => {
    const s = sandbox(); let resolveMembership;
    try {
      s.evaluate('assets/auth-bootstrap.js');
      s.w.STARK_SUPABASE_CONFIG = { url: 'https://example.test', publishableKey: 'synthetic-public-key', organizationName: 'Synthetic' };
      const membership = new Promise(resolve => { resolveMembership = resolve; });
      const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'test' } } } }), onAuthStateChange() {} }, from(table) { return { select() { return this; }, order() { return this; }, limit() { return membership; }, eq() { return this; }, single: async () => ({ data: { id: 'synthetic-org', name: 'Synthetic' } }) }; } };
      s.w.supabase = { createClient: () => client };
      s.evaluate('assets/supabase-auth.js'); await tick();
      assert.ok(s.d.documentElement.classList.contains('stark-auth-pending'));
      s.timers.find(x => x.ms === 20000).fn();
      resolveMembership({ data: [{ organization_id: 'synthetic-org', role: 'viewer' }] }); await tick(); await tick();
      assert.equal(s.w.StarkAuth.state.ready, true);
      assert.equal(s.d.documentElement.dataset.authReady, 'true');
      assert.ok(!s.d.documentElement.classList.contains('stark-auth-pending'));
      assert.equal(s.d.querySelector('.stark-auth-fatal'), null);
      assert.equal(s.d.querySelector('input').value, 'Keep this draft');
    } finally { s.w.close(); }
  });
  await test('sign-in controls become available only after the session client finishes starting', async () => {
    const dom = new JSDOM(read('login.html'), { url: 'https://example.test/SUPPLY-CHAIN-INTELLIGENCE/login.html', runScripts: 'outside-only' });
    const w = dom.window, d = w.document; let resolveSession;
    try {
      Object.defineProperty(d, 'currentScript', { get: () => ({ src: 'https://example.test/SUPPLY-CHAIN-INTELLIGENCE/assets/supabase-auth.js' }) });
      w.STARK_SUPABASE_CONFIG = { url: 'https://example.test', publishableKey: 'synthetic' };
      const session = new Promise(resolve => { resolveSession = resolve; });
      w.supabase = { createClient: () => ({ auth: { getSession: () => session, onAuthStateChange() {} } }) };
      w.eval(read('assets/auth-bootstrap.js')); w.eval(read('assets/supabase-auth.js'));
      assert.equal(d.querySelector('#login-form [type=submit]').disabled, true);
      resolveSession({ data: { session: null } }); await tick();
      assert.equal(d.querySelector('#login-form [type=submit]').disabled, false);
      assert.equal(d.querySelector('#forgot-password').disabled, false);
      assert.equal(d.documentElement.dataset.authReady, 'true');
    } finally { w.close(); }
  });
  await test('pinned local spreadsheet reader preserves identifiers, quantities and dates', () => {
    const s = sandbox();
    try {
      s.evaluate('assets/vendor/sheetjs-0.20.3.min.js');
      const X = s.w.XLSX; assert.equal(X.version, '0.20.3');
      const workbook = X.utils.book_new();
      X.utils.book_append_sheet(workbook, X.utils.aoa_to_sheet([['Model', 'Quantity', 'Date'], ['00001', 12, '2026-10-07']]), 'Inventory');
      const bytes = X.write(workbook, { type: 'array', bookType: 'xlsx' });
      const rows = X.utils.sheet_to_json(X.read(bytes, { type: 'array' }).Sheets.Inventory);
      assert.equal(rows[0].Model, '00001'); assert.equal(rows[0].Quantity, 12); assert.equal(rows[0].Date, '2026-10-07');
      assert.equal(typeof X.SSF.parse_date_code, 'function');
      assert.ok(!/src="https?:\/\//.test(read('regional-workspace.html')));
    } finally { s.w.close(); }
  });
  await test('legacy analyst formatting removes active HTML, resource loads and unsafe links', () => {
    const s = sandbox();
    try {
      s.evaluate('assets/vendor/marked-12.0.1.min.js');
      s.evaluate('assets/vendor/purify-3.4.16.min.js');
      s.evaluate('assets/safe-output.js');
      const node = s.d.createElement('div'); s.d.body.append(node);
      s.w.StarkSafeOutput.render(node, '**Verified report**\n\n<img src="https://external.test/leak" onerror="window.injected=1"><script>window.injected=1</script><iframe src="https://external.test"></iframe><form id="login-form"><input name="password"></form><a href="javascript:alert(1)" onclick="alert(1)">Unsafe</a>\n\n[Source](https://example.test/source)');
      assert.ok(node.querySelector('strong'));
      assert.equal(node.querySelector('img,script,iframe,form,input,svg,style'), null);
      assert.ok([...node.querySelectorAll('*')].every(x => [...x.attributes].every(a => !/^on|style|id|name$/i.test(a.name))));
      assert.ok([...node.querySelectorAll('a[href]')].every(x => /^https?:/.test(x.href)));
      assert.equal(s.w.injected, undefined);
      s.w.DOMPurify = null;
      s.w.StarkSafeOutput.render(node, '<img src=x onerror=alert(1)>');
      assert.equal(node.querySelector('img'), null);
      assert.ok(node.textContent.includes('<img'));
    } finally { s.w.close(); }
  });
  await test('regional pages and built nested pages retain their full module startup lifecycle', async () => {
    for (const file of ['inventory-dashboard-us.html', 'inventory-analysis-report-eu.html', 'decision-intelligence-ca.html', 'raw-report-us.html', 'reorder-report-eu.html', 'active-brands-us.html', 'instructions-ca.html', 'ats-eu.html', 'sales-analysis.html', 'events.html', 'shipment-tracking.html', 'dist/index.html', 'dist/crm/index.html']) {
      const page = await boot(file);
      try {
        await tick();
        assert.deepEqual(page.errors, [], file);
        assert.equal(page.d.querySelectorAll('#system-sidebar').length, 1, file);
        assert.equal(page.d.querySelectorAll('.system-header').length, 1, file);
        assert.ok(!page.d.documentElement.classList.contains('stark-page-loading'), file);
        assert.ok(!/leaving/.test(page.d.body.className));
      } finally { page.w.close(); }
    }
  });
  await test('brand analysis distinguishes eligible stock, demand and at-risk models without modifying records', async () => {
    const page = await boot('mk-brain.html');
    try {
      page.w.MKAI.configure({ monitor: false, aiEnabled: false });
      const source = fixture(), before = JSON.stringify(source);
      const local = page.w.MKAI.localResult('Analyze Cozy Earth', source);
      assert.match(local.findings[0].explanation, /304 units on hand/);
      assert.match(local.findings[0].explanation, /20 demand units\/month/);
      assert.match(local.findings[0].explanation, /Models with stockout risk: 1/);
      assert.match(local.actions[0].reason, /26 suggested units/);
      assert.ok(local.actions.every(x => !x.title.includes('EXCLUDED')));
      const context = JSON.parse(H.buildContext(source, local).text);
      assert.equal(context.contract, 'MK verified website facts v2');
      assert.equal(context.completed_calculations[0].status, 'completed');
      assert.equal(context.completed_calculations[0].facts.brands[0].onHand, 304);
      assert.equal(context.completed_calculations[0].facts.brands[0].stockoutRisks, 1);
      assert.ok(!JSON.stringify(context).includes('compare_brands'));
      assert.equal(context.tool_results, undefined);
      assert.equal(JSON.stringify(source), before);
    } finally { page.w.close(); }
  });
  await test('Space receives completed-fact instructions and valid evidence despite an older tool complaint', async () => {
    const source = fixture(), local = { findings: [], actions: [], assumptions: [], tools: [{ name: 'compare_brands', arguments: { region: 'US', query: 'Cozy Earth' } }] };
    let request;
    const fetcher = async (url, options) => {
      if (options.method === 'POST') { request = JSON.parse(options.body).data[0]; return new Response('{"event_id":"synthetic"}'); }
      return new Response('event: complete\ndata: ' + JSON.stringify([{ ok: true, answer: 'Cozy Earth has 304 eligible units on hand and one at-risk model [US:brand:0].' }]) + '\n\n');
    };
    const result = await H.analyzeWithAI({ question: 'Analyze Cozy Earth', snapshot: source, localResult: local, history: [{ role: 'user', content: 'Analyze Cozy Earth' }, { role: 'assistant', content: 'I cannot use compare_brands.' }] }, null, { fetcher });
    assert.match(request.message, /website has already finished/);
    assert.match(request.message, /Prefer these current facts/);
    assert.ok(JSON.parse(request.context).completed_calculations.length);
    assert.equal(result.mode, 'ai'); assert.ok(result.evidence.some(x => x.id === 'US:brand:0'));
  });
  fs.writeFileSync(path.join(root, 'docs/verification-production.json'), JSON.stringify({ passed: passed.length, checks: passed, failed: failures.length, failures, method: 'Node.js, jsdom DOM simulations, Worker Request/Response stubs and build inspection. No browser, rendered navigation timing, deployment or real report upload.' }, null, 2) + '\n');
  if (failures.length) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { fixture };
