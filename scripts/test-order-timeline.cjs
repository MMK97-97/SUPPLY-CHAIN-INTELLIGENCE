const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Quick local HTTP static server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/all-open-orders.html';
  const filePath = path.join(__dirname, '..', reqPath.replace(/^\//, ''));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8098, '127.0.0.1', async () => {
  console.log('Static server listening on http://127.0.0.1:8098');

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

  const debugPort = 9225;
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + debugPort,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:8098/all-open-orders.html'
  ]);

  let killed = false;
  function cleanup() {
    if (!killed) {
      killed = true;
      edge.kill();
      server.close();
    }
  }

  // Poll for CDP endpoint
  async function getWsUrl() {
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
        const json = await res.json();
        const page = json.find(t => t.type === 'page' && t.url.includes('all-open-orders.html'));
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      } catch (e) {
        // wait
      }
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('CDP ws endpoint timeout');
  }

  try {
    const wsUrl = await getWsUrl();
    console.log('Connected to Edge CDP WebSocket');

    const ws = new globalThis.WebSocket(wsUrl);
    let msgId = 1;
    const callbacks = new Map();

    ws.addEventListener('message', ev => {
      const data = JSON.parse(ev.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data);
        callbacks.delete(data.id);
      }
    });

    await new Promise(r => ws.addEventListener('open', r, { once: true }));

    function send(method, params = {}) {
      return new Promise(resolve => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result?.result?.value;
    }

    // Wait for page to initialize
    await new Promise(r => setTimeout(r, 1500));

    console.log('\n--- 1. Testing Submodule Bar for Removed Tabs ---');
    const submodulesCheck = await evaluate(`(() => {
      const subBar = document.querySelector('#system-submodule-bar');
      const text = subBar ? subBar.textContent : '';
      const hasHold = text.includes('Hold & redemption');
      const hasBulk = text.includes('Bulk & firm orders');
      return { hasSubBar: !!subBar, hasHold, hasBulk, textSnippet: text.slice(0, 150) };
    })()`);
    console.log('Submodules Check:', submodulesCheck);

    console.log('\n--- 2. Testing Order Selection & Timeline Rendering ---');
    const timelineCheck = await evaluate(`(() => {
      const rows = document.querySelectorAll('#oo-orders-tbody tr');
      if (rows.length === 0) return { error: 'No order rows found' };

      // Click first order row
      rows[0].click();

      const orderNum = document.querySelector('#oo-panel-order-num')?.textContent;
      const rulePill = document.querySelector('#oo-timeline-rule-pill')?.textContent;
      const stepperSteps = Array.from(document.querySelectorAll('#oo-stepper-track .oo-stepper-step')).map(s => ({
        label: s.querySelector('.oo-stepper-label')?.textContent,
        status: s.className
      }));

      const flowSteps = Array.from(document.querySelectorAll('#oo-ptd-flow-summary .oo-ptd-item')).map(s => ({
        title: s.querySelector('.oo-ptd-step-title')?.textContent,
        time: s.querySelector('.oo-ptd-time')?.textContent,
        badge: s.querySelector('.oo-ptd-status-pill')?.textContent,
        didBefore: !!s.querySelector('.oo-ptd-did-before'),
        desc: s.querySelector('.oo-ptd-desc')?.textContent
      }));

      return {
        orderNum,
        rulePill,
        stepperCount: stepperSteps.length,
        flowCount: flowSteps.length,
        stepperSteps,
        flowSteps
      };
    })()`);
    console.log('Timeline Initial State:', JSON.stringify(timelineCheck, null, 2));

    console.log('\n--- 3. Testing Item Tiers (Single, 2-5, 5-10+) ---');
    const tierChecks = await evaluate(`(() => {
      // Find orders with different item counts in the table or dataset
      const allRows = document.querySelectorAll('#oo-orders-tbody tr');
      const results = [];

      allRows.forEach(r => {
        r.click();
        const itemCountTxt = document.querySelector('#oo-tab-items-count')?.textContent;
        const itemCount = Number(itemCountTxt) || 1;
        const rulePill = document.querySelector('#oo-timeline-rule-pill')?.textContent;
        const flowTitles = Array.from(document.querySelectorAll('#oo-ptd-flow-summary .oo-ptd-step-title')).map(el => el.textContent);
        const didBeforeCount = document.querySelectorAll('#oo-ptd-flow-summary .oo-ptd-did-before').length;

        results.push({
          orderNum: document.querySelector('#oo-panel-order-num')?.textContent,
          itemCount,
          rulePill,
          flowTitles,
          didBeforeCount
        });
      });

      return results.slice(0, 5);
    })()`);
    console.log('Tier Checks for Orders:', JSON.stringify(tierChecks, null, 2));

    console.log('\n--- 4. Testing Removal of Time Logic & Sim Button & Packing Timeline Status ---');
    const simCheck = await evaluate(`(() => {
      const simBtn = document.querySelector('#oo-btn-sim-toggle');
      const allRows = Array.from(document.querySelectorAll('#oo-orders-tbody tr'));
      const packingRow = allRows.find(r => r.textContent.includes('Packing') || r.textContent.includes('1007'));
      if (packingRow) packingRow.click();

      const stepperSteps = Array.from(document.querySelectorAll('#oo-stepper-track .oo-stepper-step')).map(s => ({
        label: s.querySelector('.oo-stepper-label')?.textContent,
        status: s.className,
        dot: s.querySelector('.oo-stepper-dot')?.textContent
      }));
      const step5 = stepperSteps.find(s => s.label === 'Completed');

      return {
        hasSimBtn: !!simBtn,
        step5Dot: step5?.dot,
        step5Status: step5?.status,
        step5IsPending: step5?.dot === '5' && step5?.status.includes('pending') && !step5?.status.includes('active') && !step5?.status.includes('done')
      };
    })()`);
    console.log('Time Logic & Sim Removal State:', JSON.stringify(simCheck, null, 2));

    console.log('\n--- 5. Testing Dedicated Timeline Tab Switch ---');
    const tabSwitchCheck = await evaluate(`(() => {
      const timelineTab = document.querySelector('.oo-panel-tab[data-ptab="timeline"]');
      if (!timelineTab) return { error: 'Timeline tab not found' };
      timelineTab.click();

      const paneActive = document.querySelector('#oo-pane-timeline')?.classList.contains('active');
      const dedicatedFlowCount = document.querySelectorAll('#oo-ptd-flow-dedicated .oo-ptd-item').length;

      return {
        tabActive: timelineTab.classList.contains('active'),
        paneActive,
        dedicatedFlowCount
      };
    })()`);
    console.log('Tab Switch Check:', tabSwitchCheck);

    const isSuccess =
      !submodulesCheck.hasHold &&
      !submodulesCheck.hasBulk &&
      timelineCheck.stepperCount === 5 &&
      timelineCheck.flowCount === 5 &&
      timelineCheck.flowSteps[0].title === 'Label printed' &&
      timelineCheck.flowSteps[1].title === 'Picking' &&
      timelineCheck.flowSteps[2].title === 'Changed to packing' &&
      timelineCheck.flowSteps[3].title === 'Packing slip printed' &&
      timelineCheck.flowSteps[4].title === 'Completed' &&
      !simCheck.hasSimBtn &&
      simCheck.step5IsPending &&
      tabSwitchCheck.paneActive &&
      tabSwitchCheck.dedicatedFlowCount === 5;

    console.log('\n========================================');
    console.log(isSuccess ? '>>> ALL VERIFICATIONS PASSED: 100% OPERATIONAL! <<<' : '>>> SOME CHECKS FAILED <<<');
    console.log('========================================\n');

    ws.close();
    cleanup();
    process.exit(isSuccess ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    cleanup();
    process.exit(1);
  }
});
