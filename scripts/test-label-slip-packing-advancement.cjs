const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/shipping/index.html';
  const filePath = path.join(__dirname, '..', reqPath.replace(/^\//, ''));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css'
    }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8095, '127.0.0.1', async () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const debugPort = 9229;
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + debugPort,
    'http://127.0.0.1:8095/shipping/index.html'
  ]);

  async function getWs() {
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:' + debugPort + '/json');
        const json = await res.json();
        const p = json.find(t => t.type === 'page');
        if (p && p.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('CDP ws endpoint not found');
  }

  try {
    const wsUrl = await getWs();
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const cbs = new Map();
    ws.onmessage = ev => {
      const d = JSON.parse(ev.data);
      if (d.id && cbs.has(d.id)) { cbs.get(d.id)(d); cbs.delete(d.id); }
    };
    await new Promise(r => ws.onopen = r);
    const send = (method, params = {}) => new Promise(r => {
      const i = id++;
      cbs.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evaluate = async exp => {
      const res = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true });
      return res.result?.result?.value;
    };

    await new Promise(r => setTimeout(r, 1500));

    console.log('\n--- 1. Testing Ship Orders: Click Slip Action on Picking Order ---');
    const slipClickTest = await evaluate(`(() => {
      // Find a row with slip button
      const slipBtn = document.querySelector('button[data-ship-act="slip"]');
      if (!slipBtn) return { error: 'No slip button found' };
      const row = slipBtn.closest('tr');
      const poBefore = row.querySelector('.ship-order-po')?.textContent;
      const statusBefore = row.querySelector('.ship-status-badge')?.textContent;

      slipBtn.click();

      // Check modal opened
      const modalOpen = !!document.querySelector('.ship-slip-modal');
      const closeBtn = document.querySelector('#ship-slip-close-btn');
      if (closeBtn) closeBtn.click();

      // Check status after slip print from freshly rendered DOM
      const statusAfter = document.querySelector('.ship-status-badge')?.textContent;

      return {
        poBefore,
        statusBefore,
        modalOpen,
        statusAfter
      };
    })()`);
    console.log('Slip Click Test Result:', slipClickTest);

    console.log('\n--- 2. Testing Batch Print Packing Slips Advancement ---');
    const batchSlipTest = await evaluate(`(() => {
      const selectAll = document.querySelector('#ship-select-all');
      if (selectAll && !selectAll.checked) selectAll.click();

      const btnSlips = document.querySelector('#ship-btn-print-slips');
      if (!btnSlips) return { error: 'No batch slips button found' };
      btnSlips.click();

      const modalOpen = !!document.querySelector('.ship-slip-modal');
      const closeBtn = document.querySelector('#ship-slip-close-btn');
      if (closeBtn) closeBtn.click();

      const allStatuses = Array.from(document.querySelectorAll('.ship-status-badge')).map(el => el.textContent);
      return {
        modalOpen,
        allStatuses
      };
    })()`);
    console.log('Batch Slip Test Result:', batchSlipTest);

    console.log('\n--- 3. Testing all-open-orders.html Order Details for Packing Order ---');
    // Navigate to all-open-orders.html
    await send('Page.navigate', { url: 'http://127.0.0.1:8095/all-open-orders.html' });
    await new Promise(r => setTimeout(r, 2000));

    const openOrdersCheck = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('#oo-orders-tbody tr'));
      // Find SO-89108 or an order in packing
      const packingRow = rows.find(r => r.textContent.includes('SO-89108') || r.textContent.includes('Packing'));
      if (packingRow) packingRow.click();
      else if (rows.length > 0) rows[0].click();

      const orderNum = document.querySelector('#oo-panel-order-num')?.textContent;
      const statusBadge = document.querySelector('#oo-panel-status')?.textContent;
      const stepper = Array.from(document.querySelectorAll('#oo-stepper-track .oo-stepper-step')).map(s => ({
        label: s.querySelector('.oo-stepper-label')?.textContent,
        status: s.className,
        dot: s.querySelector('.oo-stepper-dot')?.textContent
      }));
      const flow = Array.from(document.querySelectorAll('#oo-ptd-flow-summary .oo-ptd-item')).map(s => ({
        title: s.querySelector('.oo-ptd-step-title')?.textContent,
        badge: s.querySelector('.oo-ptd-status-pill')?.textContent,
        didBefore: !!s.querySelector('.oo-ptd-did-before')
      }));

      return {
        orderNum,
        statusBadge,
        stepper,
        flow
      };
    })()`);
    console.log('Open Orders Packing Check:', JSON.stringify(openOrdersCheck, null, 2));

    const passed =
      slipClickTest.modalOpen &&
      slipClickTest.statusAfter === 'PACKING' &&
      batchSlipTest.modalOpen &&
      batchSlipTest.allStatuses.every(s => s === 'PACKING') &&
      openOrdersCheck.statusBadge === 'Packing' &&
      openOrdersCheck.stepper[0].dot === '✓' && // Label printed done
      openOrdersCheck.stepper[1].dot === '✓' && // Picking done
      openOrdersCheck.stepper[2].dot === '✓' && // Changed to packing done
      openOrdersCheck.stepper[3].dot === '✓' && // Packing slip printed done
      openOrdersCheck.stepper[4].status.includes('pending') && // Completed is pending while order is Packing
      openOrdersCheck.stepper[4].dot === '5';

    console.log('\n========================================');
    console.log(passed ? '>>> VERIFICATION PASSED: 100% OPERATIONAL! <<<' : '>>> SOME VERIFICATIONS FAILED <<<');
    console.log('========================================\n');

    ws.close();
    edge.kill();
    server.close();
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error(err);
    edge.kill();
    server.close();
    process.exit(1);
  }
});
