/* DOM regression checks; no browser, rendering, network requests, or live services.
 * Install the test dependency separately: npm install --no-save --package-lock=false jsdom@26
 * Run: node scripts/check-interface.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const site = 'https://example.test/SUPPLY-CHAIN-INTELLIGENCE/';

async function boot(file, shellSource, options = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const pageURL = new URL(file, site);
  if (options.search) pageURL.search = options.search;
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), {
    url: pageURL.href, runScripts: 'outside-only', virtualConsole
  });
  const w = dom.window, d = w.document;
  for (const [key, value] of Object.entries(options.localStorage || {})) w.localStorage.setItem(key, value);
  for (const [key, value] of Object.entries(options.sessionStorage || {})) w.sessionStorage.setItem(key, value);
  // Browser postMessage scheduling is not emulated by jsdom's isolated VM.
  // Supply Node scheduling for the local ZIP parser, plus standard file decoding.
  w.setImmediate = setImmediate; w.clearImmediate = clearImmediate;
  w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder;
  w.addEventListener('error', event => errors.push(event.error?.stack || event.message));
  w.fetch = () => { throw new Error('Network is disabled in interface checks.'); };
  // Optional standard-API emulation for wider audits; this does not render a browser.
  if (options.beforeScripts) options.beforeScripts(w, d);
  let ready = 'loading', script = null;
  Object.defineProperty(d, 'readyState', { configurable: true, get: () => ready });
  Object.defineProperty(d, 'currentScript', { configurable: true, get: () => script });
  const readyEvent = new Promise(resolve => d.addEventListener('DOMContentLoaded', resolve, { once: true }));
  // Only explicitly read local source files. jsdom never fetches any resources.
  for (const link of d.querySelectorAll('link[rel="stylesheet"]')) {
    const url = new URL(link.href);
    if (!url.href.startsWith(site)) continue;
    const style = d.createElement('style');
    style.textContent = fs.readFileSync(path.join(root, decodeURIComponent(url.pathname.slice(new URL(site).pathname.length))), 'utf8');
    d.head.append(style);
  }
  const scripts = [...d.querySelectorAll('script')];
  const evaluate = node => {
    script = node;
    if (!node.src) { if (node.textContent.trim()) w.eval(node.textContent); return; }
    const url = new URL(node.src);
    if (!url.href.startsWith(site)) return;
    const name = decodeURIComponent(url.pathname.slice(new URL(site).pathname.length));
    w.eval(name === 'assets/system-shell.js' && shellSource ? shellSource : fs.readFileSync(path.join(root, name), 'utf8'));
  };
  try {
    scripts.filter(node => !node.defer).forEach(evaluate);
    ready = 'interactive';
    scripts.filter(node => node.defer).forEach(evaluate);
    const mountedBeforeModules = !!d.querySelector('#system-sidebar');
    script = null;
    await readyEvent;
    ready = 'complete';
    // Drain callbacks from optional regional-source discovery without a timer delay.
    await new Promise(resolve => setImmediate(resolve));
    return { dom, w, d, errors, mountedBeforeModules };
  } catch (error) { w.close(); throw error; }
}

function checkNavigation(page, file) {
  const { d, w, errors } = page;
  assert.deepEqual(errors, [], file + ': runtime errors');
  assert.equal(d.querySelectorAll('#system-sidebar').length, 1, file + ': shared sidebar');
  assert.equal(d.querySelectorAll('.system-header').length, 1, file + ': shared header');
  assert.ok(d.body.classList.contains('stark-system'));
  assert.equal(page.mountedBeforeModules, false, file + ': wait for module initialization');
  assert.ok(d.querySelector('#page-content h1, #system-page-content h1, #fulfillment-content h1'), file + ': rendered page');
  const links = [...d.querySelectorAll('#system-navigation a')];
  assert.ok(links.length > 35);
  for (const link of links) {
    assert.ok(link.href.startsWith(site), link.href + ': deployment root');
    const name = new URL(link.href).pathname.slice(new URL(site).pathname.length);
    assert.ok(fs.existsSync(path.join(root, name)), name + ': existing route');
  }
  const active = links.filter(link => link.classList.contains('active'));
  assert.equal(active.length, 1, file + ': one selected page');
  assert.equal(active[0].getAttribute('aria-current'), 'page');
  if (file.includes('/')) {
    assert.ok(active[0].closest('details').open, file + ': active navigation group is open');
    assert.ok(!d.querySelector('.system-home').classList.contains('active'));
  }
  const menu = d.querySelector('.system-menu');
  menu.click();
  assert.ok(d.body.classList.contains('system-nav-open'));
  assert.equal(menu.getAttribute('aria-expanded'), 'true');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.ok(!d.body.classList.contains('system-nav-open'));
  assert.equal(menu.getAttribute('aria-expanded'), 'false');
}

// jsdom preserves CSS variables in computed values. Resolve the declared palette
// through ancestors, then compare the text against its nearest painted surface.
function textContrast(w, node) {
  function resolve(element, property) {
    const value = w.getComputedStyle(element).getPropertyValue(property);
    return value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
      for (let parent = element; parent; parent = parent.parentElement) {
        const declared = w.getComputedStyle(parent).getPropertyValue(name);
        if (declared) return declared.trim();
      }
      throw new Error('Undeclared color token: ' + name);
    });
  }
  function rgb(color) {
    const hex = color.match(/^#([\da-f]{6})$/i);
    if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
    const short = color.match(/^#([\da-f]{3})$/i);
    if (short) return [...short[1]].map(x => parseInt(x + x, 16)).concat(1);
    const channels = color.match(/^rgba?\(([^)]+)\)$/);
    if (!channels) throw new Error('Unsupported declared color: ' + color);
    const result = channels[1].split(',').map(Number);
    if (result.length === 3) result.push(1);
    return result;
  }
  function surface(element) {
    if (!element) return [255, 255, 255];
    const color = rgb(resolve(element, 'background-color'));
    if (color[3] === 1) return color.slice(0, 3);
    const behind = surface(element.parentElement);
    return color.slice(0, 3).map((channel, i) => channel * color[3] + behind[i] * (1 - color[3]));
  }
  function luminance(channels) {
    const linear = channels.map(x => { const s = x / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  }
  const fg = luminance(rgb(resolve(node, 'color')).slice(0, 3));
  const bg = luminance(surface(node));
  return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
}

async function main() {
  const passed = [];
  async function test(name, callback) {
    try { await callback(); passed.push(name); console.log('PASS', name); }
    catch (error) { console.error('FAIL', name, error); process.exitCode = 1; }
  }
  const files = ['index.html', 'business-operations.html', 'mk-brain.html', 'data-center.html', 'activity.html', 'procurement-planning.html', 'vendor-po-management.html'];
  for (const dir of ['crm', 'order-management', 'vendor-management', 'warehouse-management', '3pl-management', 'shipping', 'procurement', 'transportation']) {
    files.push(...fs.readdirSync(path.join(root, dir)).filter(file => file.endsWith('.html')).map(file => dir + '/' + file));
  }
  for (const file of files) await test(file + ' retains shared navigation after module startup', async () => {
    const page = await boot(file);
    try { checkNavigation(page, file); } finally { page.w.close(); }
  });
  await test('search and region selection work after nested module startup', async () => {
    const page = await boot('vendor-management/index.html');
    const { d, w } = page;
    try {
      const input = d.querySelector('#system-search-input');
      input.value = 'Northstar';
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
      const results = d.querySelector('.system-search-results');
      assert.equal(results.hidden, false);
      assert.ok(results.textContent.includes('Northstar'));
      assert.ok(results.querySelector('a').href.startsWith(site + 'crm/'));
      const region = d.querySelector('#system-region-select');
      region.value = 'EU';
      region.dispatchEvent(new w.Event('change', { bubbles: true }));
      assert.equal(w.StarkSystem.getRegion(), 'EU');
      assert.ok(d.querySelector('#system-navigation a[href$="inventory-dashboard-eu.html"]'));
      assert.deepEqual(page.errors, []);
    } finally { w.close(); }
  });
  await test('module refresh and repeated shell loading keep one shared navigation', async () => {
    for (const file of ['vendor-management/vendors.html', 'warehouse-management/receiving.html']) {
      const page = await boot(file);
      try {
        (page.w.StarkEnterprise || page.w.StarkLogistics).refresh();
        page.w.eval(fs.readFileSync(path.join(root, 'assets/system-shell.js'), 'utf8'));
        checkNavigation(page, file);
      } finally { page.w.close(); }
    }
  });
  await test('legacy cards, tables and ghost buttons use readable light surfaces', async () => {
    const page = await boot('warehouse-management/receiving.html');
    try {
      const { d, w } = page;
      const style = selector => w.getComputedStyle(d.querySelector(selector));
      assert.equal(style('.card').backgroundColor, 'rgb(255, 255, 255)');
      assert.ok(['', 'none'].includes(style('.card').backgroundImage));
      assert.equal(style('.data-table th').backgroundColor, 'rgb(244, 247, 252)');
      assert.equal(style('.data-table td').color, 'var(--system-ink)');
      assert.equal(style('.hero .btn:not(.primary)').color, 'rgb(48, 75, 110)');
      assert.equal(style('.hero .btn:not(.primary)').backgroundColor, 'rgb(255, 255, 255)');
      assert.equal(style('.suite-sidebar').display, 'none');
      assert.equal(style('.system-sidebar').display, 'flex');
      assert.equal(style('.system-header').display, 'flex');
    } finally { page.w.close(); }
  });
  await test('vendor creation dialog retains a readable form and shared header', async () => {
    const page = await boot('vendor-management/vendors.html');
    try {
      const { d, w } = page;
      d.querySelector('#new-vendor').click();
      const modal = d.querySelector('.modal');
      assert.ok(modal);
      assert.equal(w.getComputedStyle(modal).backgroundColor, 'rgb(255, 255, 255)');
      assert.ok(modal.querySelector('input'));
      assert.equal(w.getComputedStyle(modal.querySelector('input')).backgroundColor, 'rgb(255, 255, 255)');
      modal.querySelector('[data-close]').click();
      assert.equal(d.querySelector('.modal'), null);
      assert.ok(d.querySelector('.system-header'));
      assert.deepEqual(page.errors, []);
    } finally { page.w.close(); }
  });
  await test('text on the eight reported page types has at least 4.5:1 contrast', async () => {
    const cases = {
      'warehouse-management/index.html': ['.hero p', '.kpi-value', '.kpi-top', '.card-header h2', '.rack b', '.rack small', '.flow-node b', '.flow-node small'],
      'warehouse-management/inventory-bins.html': ['.hero .btn:not(.primary)', '.data-table th', '.data-table td', '.data-table .sub'],
      'warehouse-management/receiving.html': ['.match-card b', '.match-card span', '.data-table th', '.data-table td', '.badge'],
      'vendor-management/index.html': ['.kpi-value', '.card-header h2', '.timeline-item b', '.timeline-item small'],
      'vendor-management/vendors.html': ['.data-table th', '.data-table td', '.badge'],
      'vendor-management/procurement.html': ['.card-header h2', '.card-header p', '.data-table th', '.data-table td'],
      'vendor-management/sla.html': ['.notice', '.hero .btn', '.kpi-value', '.data-table th'],
      'vendor-management/digital-vault.html': ['.notice.warning', '.hero .btn:not(.primary)', '.kpi-value', '.card-header h2']
    };
    const failures = [];
    for (const [file, selectors] of Object.entries(cases)) {
      const page = await boot(file);
      try {
        for (const selector of selectors) {
          const nodes = [...page.d.querySelectorAll(selector)];
          assert.ok(nodes.length, file + ': ' + selector);
          for (const node of nodes) {
            const contrast = textContrast(page.w, node);
            if (contrast < 4.5) failures.push(file + ': ' + selector + ' = ' + contrast.toFixed(2) + ':1');
          }
        }
      } finally { page.w.close(); }
    }
    assert.deepEqual(failures, []);
  });
  fs.writeFileSync(path.join(root, 'docs/verification-interface.json'), JSON.stringify({
    runtime: 'Node.js with jsdom 26; local source only, no browser rendering or network',
    module_pages: files.length, passed: passed.length, checks: passed, failed: !!process.exitCode
  }, null, 2) + '\n');
}
module.exports = { boot, checkNavigation, textContrast };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
