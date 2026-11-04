/**
 * Automated Test Suite for Platform Studio & ERP Integration Hub
 * Verifies Universal Industry Presets, Terminology Engine, ERP Hub Connectors & Workspace Parity.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8097;
const ROOT = path.resolve(__dirname, '..');

// 1. Static HTTP Server for test fixtures
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(ROOT, urlPath === '/' ? 'workspace.html' : urlPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found: ' + urlPath);
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Platform Studio test static server listening on http://127.0.0.1:${PORT}`);
  try {
    await runTests();
    console.log('\n========================================');
    console.log('>>> ALL PLATFORM STUDIO & INTEGRATION HUB TESTS PASSED (100%) <<<');
    console.log('========================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});

async function runTests() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const debugPort = 9257;
  const userDataDir = path.join(ROOT, '.tmp-edge-ps-profile');

  const browserProc = spawn(edgePath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    'about:blank'
  ], { detached: false });

  await new Promise(r => setTimeout(r, 2000));

  let targets;
  for (let i = 0; i < 10; i++) {
    try {
      const resp = await fetch(`http://127.0.0.1:${debugPort}/json`);
      targets = await resp.json();
      if (targets && targets.length) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!targets || !targets.length) {
    throw new Error('Could not connect to Edge remote debugging port');
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise(res => ws.onopen = res);

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  try {
    // ==========================================
    // 1. Platform Studio: Industry Presets & Config
    // ==========================================
    console.log('\n--- 1. Testing Platform Studio Workbench ---');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/platform-studio.html` });
    await new Promise(r => setTimeout(r, 1800));

    const studioCheck = await evaluate(`(() => {
      const cards = document.querySelectorAll('.industry-card');
      const roleInputs = document.querySelectorAll('input[name="studio_role"]');
      const moduleBoxes = document.querySelectorAll('input[name="module_switch"]');
      const applyBtn = document.querySelector('#btn-studio-apply');
      const inpName = document.querySelector('#inp-brand-name');
      const previewBanner = document.querySelector('.studio-preview-banner');

      return {
        hasStudioTitle: document.title.includes('Platform Studio'),
        industryCardsCount: cards.length,
        roleInputsCount: roleInputs.length,
        moduleBoxesCount: moduleBoxes.length,
        hasApplyBtn: !!applyBtn,
        hasInpName: !!inpName,
        hasPreviewBanner: !!previewBanner
      };
    })()`);

    console.log('Studio Initial Check:', studioCheck);
    if (studioCheck.industryCardsCount !== 7) throw new Error('Expected 7 industry cards, got ' + studioCheck.industryCardsCount);
    if (studioCheck.roleInputsCount !== 4) throw new Error('Expected 4 role options, got ' + studioCheck.roleInputsCount);
    if (studioCheck.moduleBoxesCount !== 12) throw new Error('Expected 12 operational module switches, got ' + studioCheck.moduleBoxesCount);

    // Test clicking an industry preset card (e.g. food_beverage)
    const selectIndustryResult = await evaluate(`(() => {
      const fbCard = document.querySelector('.industry-card[data-industry-id="food_beverage"]');
      if (fbCard) fbCard.click();
      
      const termItem = document.querySelector('#term-item')?.value;
      const termLoc = document.querySelector('#term-location')?.value;
      const activeCard = document.querySelector('.industry-card.active')?.getAttribute('data-industry-id');

      return {
        clicked: !!fbCard,
        activeCard,
        termItem,
        termLoc
      };
    })()`);

    console.log('Industry Selection Result:', selectIndustryResult);
    if (selectIndustryResult.activeCard !== 'food_beverage') throw new Error('Expected food_beverage to be active');
    if (!selectIndustryResult.termItem.includes('Batch') && !selectIndustryResult.termItem.includes('Lot')) throw new Error('Expected Batch or Lot in food_beverage termItem');

    // Test saving custom config and checking localStorage
    const saveResult = await evaluate(`(() => {
      const brandInput = document.querySelector('#inp-brand-name');
      if (brandInput) {
        brandInput.value = 'Apex Supply OS';
        brandInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      const applyBtn = document.querySelector('#btn-studio-apply');
      // Trigger save without redirecting page immediately
      const P = window.MK97Platform;
      P.saveConfig({
        brandName: 'Apex Supply OS',
        industry: 'food_beverage'
      });

      const stored = localStorage.getItem('sci.platform.config.v2');
      const parsed = stored ? JSON.parse(stored) : null;
      return {
        stored: !!stored,
        industry: parsed?.industry,
        brandName: parsed?.brandName
      };
    })()`);

    console.log('Save Config Result:', saveResult);
    if (saveResult.brandName !== 'Apex Supply OS') throw new Error('Config failed to save brandName');
    if (saveResult.industry !== 'food_beverage') throw new Error('Config failed to save industry');

    // ==========================================
    // 2. Native Enterprise Power Suite: AIS Radar, EDI Studio & 6 Engines
    // ==========================================
    console.log('\n--- 2. Testing Native Enterprise Power Suite ---');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/integrations.html` });
    await new Promise(r => setTimeout(r, 1800));

    const hubCheck = await evaluate(`(() => {
      const cards = document.querySelectorAll('.native-engine-card');
      const sapBtn = document.querySelector('.conn-ping-btn[data-conn="sap"]');
      const netsuiteBtn = document.querySelector('.conn-ping-btn[data-conn="netsuite"]');
      const d365Btn = document.querySelector('.conn-ping-btn[data-conn="d365"]');
      const shopifyBtn = document.querySelector('.conn-ping-btn[data-conn="shopify"]');
      const radarBtn = document.querySelector('.conn-ping-btn[data-conn="telemetry"]');
      const ediBtn = document.querySelector('.conn-ping-btn[data-conn="edi"]');

      const radarMap = document.querySelector('.live-radar-container');
      const radarSvg = document.querySelector('.radar-svg-canvas');
      const ediStudio = document.querySelector('#edi-studio-section');
      const ediTranslateBtn = document.querySelector('#btn-translate-edi');
      const ediValidateBtn = document.querySelector('#btn-validate-edi');

      const tabs = document.querySelectorAll('.map-tab');
      const mappingRows = document.querySelectorAll('.mapping-table tbody tr');
      const auditEntries = document.querySelectorAll('.audit-event-row');
      const testAllBtn = document.querySelector('#btn-test-all-connections');

      return {
        cardsCount: cards.length,
        hasSapBtn: !!sapBtn,
        hasNetsuiteBtn: !!netsuiteBtn,
        hasD365Btn: !!d365Btn,
        hasShopifyBtn: !!shopifyBtn,
        hasRadarBtn: !!radarBtn,
        hasEdiBtn: !!ediBtn,
        hasRadarMap: !!radarMap,
        hasRadarSvg: !!radarSvg,
        hasEdiStudio: !!ediStudio,
        hasEdiTranslateBtn: !!ediTranslateBtn,
        hasEdiValidateBtn: !!ediValidateBtn,
        tabsCount: tabs.length,
        mappingRowsCount: mappingRows.length,
        auditEntriesCount: auditEntries.length,
        hasTestAllBtn: !!testAllBtn
      };
    })()`);

    console.log('Native Power Suite Check Result:', hubCheck);
    if (hubCheck.cardsCount !== 6) throw new Error('Expected 6 native engine cards, got ' + hubCheck.cardsCount);
    if (!hubCheck.hasSapBtn || !hubCheck.hasNetsuiteBtn || !hubCheck.hasD365Btn || !hubCheck.hasShopifyBtn || !hubCheck.hasRadarBtn || !hubCheck.hasEdiBtn) {
      throw new Error('All 6 Native Engine Action Buttons must be present');
    }
    if (!hubCheck.hasRadarMap || !hubCheck.hasRadarSvg) throw new Error('Live Maritime AIS Radar must be present');
    if (!hubCheck.hasEdiStudio || !hubCheck.hasEdiTranslateBtn || !hubCheck.hasEdiValidateBtn) throw new Error('Native EDI Protocol Studio must be present');
    if (hubCheck.tabsCount < 4) throw new Error('Expected 4 canonical mapping tabs');
    if (hubCheck.mappingRowsCount < 4) throw new Error('Expected canonical mapping table rows');
    if (hubCheck.auditEntriesCount < 4) throw new Error('Expected audit log stream entries');

    // Test EDI translation action
    const ediResult = await evaluate(`(() => {
      const btn = document.querySelector('#btn-translate-edi');
      if (btn) btn.click();
      return {
        translateClicked: !!btn
      };
    })()`);

    console.log('EDI Translation Result:', ediResult);
    if (!ediResult.translateClicked) throw new Error('EDI Translate button not clicked');

    // ==========================================
    // 3. Workspace: Universal Shell & Control Tower
    // ==========================================
    console.log('\n--- 3. Testing Workspace Control Tower with Studio Engine ---');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/workspace.html` });
    await new Promise(r => setTimeout(r, 2200));

    const workspaceCheck = await evaluate(`(() => {
      const brandWordmark = document.querySelector('.system-wordmark')?.textContent;
      const brandTitle = document.querySelector('.system-brand-text b')?.textContent;
      const pillStudio = document.querySelector('.pill-studio');
      const pillIntegrations = document.querySelector('.pill-integrations');
      const roleStrip = document.querySelector('.workspace-role-erp-strip');
      const roleChips = document.querySelectorAll('.role-selector-chip');
      const erpStatusTicker = document.querySelector('.workspace-erp-status-ticker');
      const industryDeck = document.querySelector('.industry-kpi-deck');
      const honestyBadges = document.querySelectorAll('.tower-kpi-honesty-pill');

      return {
        brandWordmark,
        brandTitle,
        hasPillStudio: !!pillStudio,
        hasPillIntegrations: !!pillIntegrations,
        hasRoleStrip: !!roleStrip,
        roleChipsCount: roleChips.length,
        hasErpTicker: !!erpStatusTicker,
        hasIndustryDeck: !!industryDeck,
        honestyBadgesCount: honestyBadges.length
      };
    })()`);

    console.log('Workspace Check Result:', workspaceCheck);
    if (!workspaceCheck.hasPillStudio) throw new Error('Platform Studio pill missing from header');
    if (!workspaceCheck.hasPillIntegrations) throw new Error('Integrations pill missing from header');
    if (!workspaceCheck.hasRoleStrip) throw new Error('Perspective & ERP strip missing from control tower');
    if (workspaceCheck.roleChipsCount !== 4) throw new Error('Expected 4 role chips in perspective switcher');
    if (workspaceCheck.honestyBadgesCount < 6) throw new Error('Expected at least 6 honest data badges on KPI cards');

  } finally {
    ws.close();
    browserProc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }
}
