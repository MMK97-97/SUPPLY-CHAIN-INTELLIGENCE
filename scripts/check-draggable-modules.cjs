/* Actual source/DOM interactions with simulated geometry; no network or rendering. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./check-interface.cjs');
const root = path.resolve(__dirname, '..');
const key = 'stark-module-card-positions-v1';
const passed = [], failures = [];
const ids = ['itemMaster', 'planning', 'crm', 'orders', 'vendor', 'procurement', 'shipping', 'warehouse', 'tpl', 'transportation', 'analytics', 'data'];
const card = (d, id) => d.querySelector(`[data-draggable-module=${id}]`);
const pos = node => ({ x: parseFloat(node.style.left), y: parseFloat(node.style.top) });
const links = node => [...node.querySelectorAll('a')].map(a => [a.href, a.textContent.replace(/\s+/g, ' ').trim()]);
const closeTo = (a, b) => assert.ok(Math.abs(a - b) < .01, `${a} != ${b}`);
function viewport(w, width, height) {
  Object.defineProperties(w, { innerWidth: { value: width, configurable: true }, innerHeight: { value: height, configurable: true } });
}
function geometry(w) {
  viewport(w, 1440, 1000);
  const original = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (!this.matches('[data-draggable-module]')) return original.call(this);
    const i = ids.indexOf(this.dataset.draggableModule), floating = this.classList.contains('module-is-floating');
    const width = floating ? parseFloat(this.style.width) || 360 : 360;
    const height = floating ? Math.min(480, parseFloat(this.style.maxHeight) || 480) : 480;
    const left = floating ? parseFloat(this.style.left) || 0 : 40 + i % 3 * 380;
    const top = floating ? parseFloat(this.style.top) || 0 : 240 + Math.floor(i / 3) * 500;
    return { left, top, right: left + width, bottom: top + height, x: left, y: top, width, height };
  };
}
function pointer(w, target, type, x, y, extra = {}) {
  const event = new w.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: extra.button || 0 });
  for (const [name, value] of Object.entries({ pointerId: 1, pointerType: 'mouse', isPrimary: true, ...extra })) Object.defineProperty(event, name, { value });
  target.dispatchEvent(event);
}
function move(p, id, x, y, extra = {}, ending = 'pointerup') {
  const node = card(p.d, id), rect = node.getBoundingClientRect();
  pointer(p.w, node.querySelector('.module-card-head'), 'pointerdown', rect.left + 20, rect.top + 20, extra);
  pointer(p.w, p.w, 'pointermove', x + 20, y + 20, extra);
  pointer(p.w, p.w, ending, x + 20, y + 20, extra);
}
async function test(name, run) {
  try { await run(); passed.push(name); console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.stack }); console.error('FAIL', name, error.message); }
}
async function pageTest(name, run, options = {}) {
  await test(name, async () => {
    const p = await boot('workspace.html', null, { ...options, localStorage: { 'stark-overview-view': 'modules', ...options.localStorage }, beforeScripts: options.beforeScripts || geometry });
    try { await run(p); assert.deepEqual(p.errors, []); } finally { p.w.close(); }
  });
}
function within(p, node, width = p.w.innerWidth, height = p.w.innerHeight, x = 0, y = 0) {
  const rect = node.getBoundingClientRect();
  assert.ok(rect.left >= x + 12 && rect.right <= x + width - 12 + .01, JSON.stringify(rect));
  assert.ok(rect.top >= y + 12 && rect.bottom <= y + height - 12 + .01, JSON.stringify(rect));
}
async function main() {
  await pageTest('original twelve module cards, banners, links and quick actions remain in the grid', ({ w, d }) => {
    const groups = w.StarkModuleNavigation.groups();
    assert.equal(d.querySelectorAll('[data-draggable-module]').length, groups.length);
    assert.equal(d.querySelectorAll('[data-move-module]').length, groups.length);
    assert.equal(d.querySelectorAll('.module-is-floating').length, 0);
    assert.equal(d.querySelectorAll('.module-card-placeholder').length, 0);
    assert.equal(w.StarkModuleNavigation.initFloatingActionModule, undefined);
    for (const [id, label, , , items, primary, quick] of groups) {
      const node = card(d, id);
      assert.equal(node.querySelector('h2').textContent, label);
      assert.ok(node.querySelector('.module-card-banner svg'));
      assert.deepEqual([...node.querySelectorAll('.module-card-link')].map(a => a.href), Array.from(items, ([url]) => w.StarkSystem.url(url)));
      assert.equal(node.querySelector('.module-card-action').href, w.StarkSystem.url(primary));
      assert.equal(node.querySelector('.module-card-quick').href, w.StarkSystem.url(quick.path));
    }
  });
  await pageTest('every module moves independently and retains all its destinations', p => {
    const { w, d } = p, before = new Map(ids.map(id => [id, links(card(d, id))]));
    const state = JSON.stringify(w.StarkSystem.getState());
    for (const [i, id] of ids.entries()) {
      const previous = new Map(ids.filter(other => card(d, other).classList.contains('module-is-floating')).map(other => [other, pos(card(d, other))]));
      move(p, id, 100 + i * 13, 80 + i * 7);
      assert.deepEqual(pos(card(d, id)), { x: 100 + i * 13, y: 80 + i * 7 });
      for (const [other, at] of previous) assert.deepEqual(pos(card(d, other)), at);
      assert.deepEqual(links(card(d, id)), before.get(id));
    }
    assert.equal(d.querySelectorAll('.module-is-floating').length, 12);
    assert.equal(d.querySelectorAll('.module-card-placeholder').length, 12);
    assert.equal(JSON.stringify(w.StarkSystem.getState()), state);
  });
  await pageTest('touch movement works and dragging does not execute a link', p => {
    const { w, d } = p, node = card(d, 'orders'), original = links(node);
    move(p, 'orders', 300, 180, { pointerType: 'touch' });
    assert.deepEqual(pos(node), { x: 300, y: 180 });
    let allowed;
    node.addEventListener('click', event => { allowed = !event.defaultPrevented; event.preventDefault(); });
    node.querySelector('.module-card-head').dispatchEvent(new w.MouseEvent('click', { detail: 1, bubbles: true, cancelable: true }));
    assert.equal(allowed, undefined); assert.deepEqual(links(node), original);
    assert.equal(node.classList.contains('module-is-dragging'), false);
  });
  await pageTest('clicks, small tap movement and interactive links do not move a card', p => {
    const { w, d } = p, node = card(d, 'itemMaster'), head = node.querySelector('.module-card-head');
    pointer(w, head, 'pointerdown', 60, 260); pointer(w, w, 'pointermove', 62, 262); pointer(w, w, 'pointerup', 62, 262);
    assert.equal(node.classList.contains('module-is-floating'), false);
    const link = node.querySelector('a');
    pointer(w, link, 'pointerdown', 60, 400); pointer(w, w, 'pointermove', 300, 500); pointer(w, w, 'pointerup', 300, 500);
    assert.equal(node.classList.contains('module-is-floating'), false);
  });
  await pageTest('each position persists through a fresh homepage load', async p => {
    move(p, 'itemMaster', 400, 140); move(p, 'shipping', 700, 210);
    const saved = p.w.localStorage.getItem(key);
    const next = await boot('workspace.html', null, { localStorage: { 'stark-overview-view': 'modules', [key]: saved }, beforeScripts: geometry });
    try {
      for (const id of ['itemMaster', 'shipping']) {
        closeTo(pos(card(next.d, id)).x, pos(card(p.d, id)).x); closeTo(pos(card(next.d, id)).y, pos(card(p.d, id)).y);
      }
      assert.equal(next.d.querySelectorAll('.module-is-floating').length, 2); assert.deepEqual(next.errors, []);
    } finally { next.w.close(); }
  });
  await pageTest('dragging beyond every screen edge keeps the full card reachable', p => {
    move(p, 'itemMaster', -10000, -10000); within(p, card(p.d, 'itemMaster'));
    move(p, 'itemMaster', 10000, 10000); within(p, card(p.d, 'itemMaster'));
    assert.deepEqual(pos(card(p.d, 'itemMaster')), { x: 1068, y: 508 });
  });
  await pageTest('resize and orientation changes adapt all panels without losing their contents', p => {
    move(p, 'itemMaster', 1000, 400); move(p, 'tpl', 500, 300);
    viewport(p.w, 320, 568); p.w.dispatchEvent(new p.w.Event('resize'));
    for (const id of ['itemMaster', 'tpl']) { within(p, card(p.d, id)); assert.equal(parseFloat(card(p.d, id).style.width), 296); }
    viewport(p.w, 844, 390); p.w.dispatchEvent(new p.w.Event('resize'));
    for (const id of ['itemMaster', 'tpl']) { within(p, card(p.d, id)); assert.ok(card(p.d, id).querySelectorAll('a').length > 1); }
    assert.equal(p.w.getComputedStyle(card(p.d, 'tpl').querySelector('.module-card-links')).overflowY, 'auto');
  });
  await pageTest('keyboard positioning and individual reset affect only the selected module', p => {
    const { w, d } = p, handle = d.querySelector('#module-drag-itemMaster');
    handle.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
    assert.deepEqual(pos(card(d, 'itemMaster')), { x: 56, y: 240 });
    handle.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, shiftKey: true, bubbles: true }));
    assert.deepEqual(pos(card(d, 'itemMaster')), { x: 56, y: 236 });
    move(p, 'shipping', 600, 100);
    handle.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Home', altKey: true, bubbles: true }));
    assert.equal(card(d, 'itemMaster').classList.contains('module-is-floating'), false);
    assert.deepEqual(pos(card(d, 'shipping')), { x: 600, y: 100 });
  });
  await pageTest('card, placeholder and full-layout resets restore the original card order', p => {
    const { d } = p;
    move(p, 'itemMaster', 400, 140); move(p, 'shipping', 700, 210);
    card(d, 'itemMaster').querySelector('[data-dock-module]').click();
    assert.equal(card(d, 'itemMaster').classList.contains('module-is-floating'), false);
    d.querySelector('.module-card-placeholder [data-dock-module=shipping]').click();
    assert.equal(d.querySelectorAll('.module-card-placeholder').length, 0);
    for (const [i, id] of ids.entries()) move(p, id, 100 + i * 10, 100);
    d.querySelector('[data-reset-module-layout]').click();
    assert.equal(d.querySelectorAll('.module-is-floating').length, 0);
    assert.deepEqual([...d.querySelectorAll('.module-overview-grid > article')].map(n => n.dataset.draggableModule), ids);
    assert.deepEqual(JSON.parse(p.w.localStorage.getItem(key)), {});
  });
  await pageTest('pointer cancellation and Escape undo unfinished moves without changing saved positions', p => {
    const { w, d } = p;
    move(p, 'itemMaster', 400, 100, {}, 'pointercancel');
    assert.equal(card(d, 'itemMaster').classList.contains('module-is-floating'), false);
    move(p, 'shipping', 600, 100); const saved = w.localStorage.getItem(key);
    const head = card(d, 'shipping').querySelector('.module-card-head');
    pointer(w, head, 'pointerdown', 620, 120); pointer(w, w, 'pointermove', 300, 300);
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.deepEqual(pos(card(d, 'shipping')), { x: 600, y: 100 }); assert.equal(w.localStorage.getItem(key), saved);
  });
  await pageTest('another pointer or a secondary mouse button cannot take over a drag', p => {
    const { w, d } = p, head = card(d, 'itemMaster').querySelector('.module-card-head');
    pointer(w, head, 'pointerdown', 60, 260); pointer(w, w, 'pointermove', 200, 200, { pointerId: 99 });
    assert.equal(d.querySelectorAll('.module-is-floating').length, 0); pointer(w, w, 'pointercancel', 60, 260);
    move(p, 'shipping', 600, 100, { button: 2 }); assert.equal(d.querySelectorAll('.module-is-floating').length, 0);
  });
  await pageTest('overlapping panels come forward on interaction without changing module links', p => {
    const { w, d } = p;
    move(p, 'itemMaster', 200, 100); move(p, 'shipping', 200, 100);
    assert.ok(Number(card(d, 'shipping').style.zIndex) > Number(card(d, 'itemMaster').style.zIndex));
    const link = card(d, 'itemMaster').querySelector('a'); pointer(w, link, 'pointerdown', 230, 300);
    assert.ok(Number(card(d, 'itemMaster').style.zIndex) > Number(card(d, 'shipping').style.zIndex));
    assert.ok(Number(card(d, 'itemMaster').style.zIndex) < 1200);
  });
  await pageTest('normal and modified link clicks retain native navigation after dragging', p => {
    move(p, 'orders', 300, 100);
    const { w, d } = p, link = card(d, 'orders').querySelector('.module-card-link');
    for (const ctrlKey of [false, true]) {
      pointer(w, link, 'pointerdown', 330, 300); pointer(w, w, 'pointerup', 330, 300);
      let prevented;
      d.addEventListener('click', event => { prevented = event.defaultPrevented; event.preventDefault(); }, { once: true });
      link.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ctrlKey }));
      assert.equal(prevented, false);
    }
  });
  await pageTest('region changes refresh original links and retain the arrangement', p => {
    move(p, 'planning', 500, 120);
    for (const region of ['EU', 'CA', 'US']) {
      p.w.StarkWorkspace.localStorage.setItem('stark-selected-region', region);
      p.w.dispatchEvent(new p.w.CustomEvent('stark:region-change', { detail: { region } }));
      closeTo(pos(card(p.d, 'planning')).x, 500); closeTo(pos(card(p.d, 'planning')).y, 120);
      assert.ok(card(p.d, 'planning').querySelector('.module-card-action').href.endsWith(`inventory-dashboard-${region.toLowerCase()}.html`));
      assert.equal(p.d.querySelectorAll('[data-draggable-module]').length, 12);
    }
  });
  await pageTest('switching to telemetry restores the previous dashboard and returning restores cards', p => {
    const { w, d } = p; move(p, 'shipping', 600, 100);
    d.querySelector('[data-view=telemetry]').click();
    assert.equal(d.querySelectorAll('[data-draggable-module]').length, 0);
    assert.ok(d.querySelector('[data-kpi=orders]')); assert.ok(d.querySelector('[data-kpi=credit]'));
    d.querySelector('[data-view=modules]').click(); assert.deepEqual(pos(card(d, 'shipping')), { x: 600, y: 100 });
    // Repeated dashboard refreshes must not accumulate active window drag handlers.
    for (let i = 0; i < 4; i++) w.StarkControlTower.render();
    move(p, 'shipping', 700, 200); assert.deepEqual(pos(card(d, 'shipping')), { x: 700, y: 200 });
    assert.equal(d.querySelectorAll('.module-card-placeholder').length, 1);
  });
  await pageTest('invalid preferences and storage errors keep the modules functional', p => {
    assert.equal(p.d.querySelectorAll('.module-is-floating').length, 0);
    const original = p.w.Storage.prototype.setItem;
    p.w.Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
    try { move(p, 'itemMaster', 400, 100); assert.deepEqual(pos(card(p.d, 'itemMaster')), { x: 400, y: 100 }); }
    finally { p.w.Storage.prototype.setItem = original; }
  }, { localStorage: { [key]: '{"itemMaster":{"x":-1,"y":0,"width":360}}' } });
  await pageTest('demo layout stays separate from working layout and operational data', p => {
    const before = JSON.stringify(p.w.StarkSystem.getState()); move(p, 'itemMaster', 400, 100);
    assert.equal(p.w.localStorage.getItem(key), '{"working":"unchanged"}');
    assert.ok(p.w.localStorage.getItem(p.w.StarkWorkspace.storageKey(key)));
    assert.equal(JSON.stringify(p.w.StarkSystem.getState()), before);
  }, { demo: true, search: '?demo=1', localStorage: { [key]: '{"working":"unchanged"}' } });
  await pageTest('visual viewport resize and pan keep each card inside the visible screen', p => {
    move(p, 'itemMaster', 500, 200);
    Object.assign(p.w.visualViewport, { width: 320, height: 400, offsetLeft: 100, offsetTop: 200 });
    p.w.visualViewport.dispatchEvent(new p.w.Event('resize')); within(p, card(p.d, 'itemMaster'), 320, 400, 100, 200);
    Object.assign(p.w.visualViewport, { offsetLeft: 180, offsetTop: 350 });
    p.w.visualViewport.dispatchEvent(new p.w.Event('scroll')); within(p, card(p.d, 'itemMaster'), 320, 400, 180, 350);
  }, { beforeScripts: w => {
    geometry(w); const visual = new w.EventTarget(); Object.assign(visual, { width: 1440, height: 1000, offsetLeft: 0, offsetTop: 0 });
    Object.defineProperty(w, 'visualViewport', { value: visual, configurable: true });
  } });
  const report = { date: '2026-10-21', passed: passed.length, failed: failures.length, modules: ids, checks: passed, failures,
    method: 'Actual source/defer order in jsdom@26, synthetic pointer/keyboard events and simulated geometry. No network or graphical rendering.',
    graphical_verification: 'Unverified: the cloud browser connection timed out during the preceding preview attempt. No live deployment was made.' };
  fs.writeFileSync(path.join(root, 'docs/verification-draggable-modules-20261021.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${passed.length} passed, ${failures.length} failed`); if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
