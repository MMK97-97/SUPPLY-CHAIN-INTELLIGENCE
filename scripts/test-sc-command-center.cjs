const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8096;
const repoDir = path.join(__dirname, '..');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/mail.html';
  const filePath = path.join(repoDir, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`SC Command Center test static server listening on http://127.0.0.1:${PORT}`);

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgePath = edgePaths.find(p => fs.existsSync(p));
  if (!edgePath) {
    console.error('Edge binary not found');
    server.close();
    process.exit(1);
  }

  const debugPort = 9256;
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + debugPort,
    '--no-first-run',
    '--no-default-browser-check',
    `http://127.0.0.1:${PORT}/mail.html`
  ]);

  let killed = false;
  function cleanup() {
    if (!killed) {
      killed = true;
      try { edge.kill(); } catch (e) {}
      server.close();
    }
  }

  async function getWsUrl() {
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
        const json = await res.json();
        const page = json.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('CDP ws endpoint timeout');
  }

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = ev => {
      const data = JSON.parse(ev.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data);
        callbacks.delete(data.id);
      }
    };

    await new Promise(r => ws.onopen = r);

    const send = (method, params = {}) => new Promise(resolve => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Runtime.enable');
    const evaluate = async exp => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true });
      return r?.result?.result?.value;
    };

    await new Promise(r => setTimeout(r, 1500));

    // TEST 1: Global Telemetry Ribbon
    console.log('\n--- 1. Testing Global Telemetry Ribbon ---');
    const ribbonTest = await evaluate(`(() => {
      const ribbon = document.querySelector('.sc-telemetry-ribbon');
      const chips = document.querySelectorAll('.sc-kpi-chip');
      const pulseDots = document.querySelectorAll('.sc-pulse-dot');
      return {
        hasRibbon: !!ribbon,
        chipCount: chips.length,
        hasPulseDots: pulseDots.length > 0
      };
    })()`);
    console.log('Ribbon Test Result:', ribbonTest);

    // TEST 2: Autonomous AI Prescriptive Decision Deck & One-Click Execution
    console.log('\n--- 2. Testing AI Prescriptive Decision Deck & One-Click Reply Populator ---');
    const prescriptiveTest = await evaluate(`(() => {
      const deck = document.querySelector('.sc-prescriptive-deck');
      const cards = document.querySelectorAll('.sc-prescriptive-card');
      const firstExecBtn = document.querySelector('.sc-btn-execute-decision');
      const replyInput = document.querySelector('#mail-reply-input');

      const initialReplyVal = replyInput?.value || '';
      firstExecBtn?.click();
      const updatedReplyVal = replyInput?.value || '';

      return {
        hasDeck: !!deck,
        cardCount: cards.length,
        hasExecBtn: !!firstExecBtn,
        replyPopulated: updatedReplyVal.length > 0 && updatedReplyVal !== initialReplyVal,
        snippet: updatedReplyVal.slice(0, 60) + '...'
      };
    })()`);
    console.log('Prescriptive Deck Test Result:', prescriptiveTest);

    // TEST 3: Live Multi-Modal Route Stepper
    console.log('\n--- 3. Testing Live Route & Telemetry Stepper ---');
    const routeTest = await evaluate(`(() => {
      const card = document.querySelector('.sc-route-stepper-card');
      const nodes = document.querySelectorAll('.sc-route-node');
      const radarBtn = document.querySelector('.sc-btn-satellite-radar');
      const telemetryItems = document.querySelectorAll('.sc-route-telemetry-item');

      return {
        hasRouteCard: !!card,
        nodeCount: nodes.length,
        hasRadarBtn: !!radarBtn,
        telemetryItemCount: telemetryItems.length
      };
    })()`);
    console.log('Route Stepper Test Result:', routeTest);

    // TEST 4: ERP Line-Item Allocation & Inventory Health Matrix
    console.log('\n--- 4. Testing ERP Line-Item Allocation & Inventory Health Matrix ---');
    const matrixTest = await evaluate(`(() => {
      const card = document.querySelector('.sc-erp-matrix-card');
      const rows = document.querySelectorAll('.sc-matrix-table tbody tr');
      const healthBars = document.querySelectorAll('.sc-inv-health-bar');
      const dosPills = document.querySelectorAll('.sc-dos-pill');

      return {
        hasMatrixCard: !!card,
        rowCount: rows.length,
        healthBarCount: healthBars.length,
        dosPillCount: dosPills.length
      };
    })()`);
    console.log('ERP Matrix Test Result:', matrixTest);

    // TEST 5: Warehouse Staging Bay Digital Twin in Intelligence Panel
    console.log('\n--- 5. Testing Warehouse Staging Bay Digital Twin ---');
    const twinTest = await evaluate(`(() => {
      const twin = document.querySelector('.sc-staging-bay-twin');
      const bays = document.querySelectorAll('.sc-bay-cell');
      const reservedBay = document.querySelector('.sc-bay-cell.bay-reserved');

      return {
        hasTwin: !!twin,
        bayCount: bays.length,
        hasReservedBay: !!reservedBay,
        reservedBayNum: reservedBay?.querySelector('.sc-bay-num')?.textContent?.trim()
      };
    })()`);
    console.log('Staging Bay Twin Test Result:', twinTest);

    // TEST 6: Satellite Radar Maritime Modal
    console.log('\n--- 6. Testing Satellite Radar Modal ---');
    const radarModalTest = await evaluate(`(() => {
      const radarBtn = document.querySelector('#btn-satellite-radar');
      radarBtn?.click();

      const modal = document.querySelector('#sc-radar-modal-backdrop');
      const isVisible = modal && modal.style.display !== 'none';
      const hasSvgMap = !!modal?.querySelector('.sc-radar-map-canvas svg');

      // Close modal
      modal?.querySelector('#btn-close-radar-modal')?.click();
      const isClosed = modal && modal.style.display === 'none';

      return {
        hasModal: !!modal,
        openedSuccessfully: isVisible,
        hasSvgMap,
        closedSuccessfully: isClosed
      };
    })()`);
    console.log('Radar Modal Test Result:', radarModalTest);

    const allPassed =
      ribbonTest.hasRibbon &&
      ribbonTest.chipCount >= 5 &&
      prescriptiveTest.hasDeck &&
      prescriptiveTest.cardCount === 3 &&
      prescriptiveTest.replyPopulated &&
      routeTest.hasRouteCard &&
      routeTest.nodeCount === 4 &&
      matrixTest.hasMatrixCard &&
      matrixTest.rowCount >= 2 &&
      twinTest.hasTwin &&
      twinTest.bayCount === 6 &&
      radarModalTest.openedSuccessfully &&
      radarModalTest.closedSuccessfully;

    if (allPassed) {
      console.log('\n========================================');
      console.log('>>> ALL SC COMMAND CENTER TESTS PASSED (100%) <<<');
      console.log('========================================\n');
      cleanup();
      process.exit(0);
    } else {
      console.error('\n>>> SOME SC COMMAND CENTER TESTS FAILED <<<\n');
      cleanup();
      process.exit(1);
    }
  } catch (err) {
    console.error('Test runner failure:', err);
    cleanup();
    process.exit(1);
  }
});
