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
      '.css': 'text/css',
      '.png': 'image/png'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found: ' + reqPath);
  }
});

server.listen(8094, '127.0.0.1', async () => {
  console.log('Test Server on http://127.0.0.1:8094');

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgePath = edgePaths.find(p => fs.existsSync(p));

  const debugPort = 9229;
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + debugPort,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:8094/shipping/index.html'
  ]);

  let killed = false;
  function cleanup() {
    if (!killed) {
      killed = true;
      edge.kill();
      server.close();
    }
  }

  async function getWsUrl() {
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
        const json = await res.json();
        const p = json.find(t => t.type === 'page');
        if (p && p.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('Could not get WS debugger URL');
  }

  try {
    const wsUrl = await getWsUrl();
    const ws = new globalThis.WebSocket(wsUrl);

    let id = 1;
    const callbacks = new Map();
    ws.addEventListener('message', ev => {
      const data = JSON.parse(ev.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data);
        callbacks.delete(data.id);
      }
    });

    function send(method, params = {}) {
      return new Promise((res, rej) => {
        const msgId = id++;
        callbacks.set(msgId, resp => {
          if (resp.error) rej(resp.error);
          else res(resp.result);
        });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    await send('Runtime.enable');
    await send('Page.enable');

    await new Promise(r => setTimeout(r, 1500));

    // TEST 1: Shipping Header Image 2 Removal
    const test1 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const oldEyebrow = document.querySelector('.system-eyebrow');
          const oldSubnav = document.querySelector('#system-submodule-bar');
          const opTabs = document.querySelector('.op-tabs');
          const headingH1 = document.querySelector('.system-heading h1');
          
          return {
            oldEyebrowPresent: !!oldEyebrow && window.getComputedStyle(oldEyebrow).display !== 'none',
            oldSubnavVisible: !!oldSubnav && window.getComputedStyle(oldSubnav).display !== 'none',
            opTabsVisible: !!opTabs && window.getComputedStyle(opTabs).display !== 'none',
            headingH1Text: headingH1 ? headingH1.textContent : null,
            shipTitle: document.querySelector('.ship-title')?.textContent
          };
        })()
      `,
      returnByValue: true
    });
    console.log('TEST 1 (Image 2 removed):', test1.result.value);

    // TEST 2: Eligible orders list (orders that can ship with no issues)
    const test2 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const rows = Array.from(document.querySelectorAll('#ship-table-body tr'));
          return {
            rowCount: rows.length,
            rowsData: rows.map(r => ({
              po: r.querySelector('.ship-po-btn strong')?.textContent,
              suggestedDate: r.querySelector('.ship-suggested-pill')?.textContent,
              status: r.querySelector('.ship-status-badge')?.textContent,
              tracking: r.querySelector('.ship-trk-pill code')?.textContent || 'PENDING',
              hasCheckbox: !!r.querySelector('.ship-row-check')
            }))
          };
        })()
      `,
      returnByValue: true
    });
    console.log('TEST 2 (Orders queue):', JSON.stringify(test2.result.value, null, 2));

    // TEST 3: Multi-select orders and change status to PACKING
    const test3 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const selectAll = document.querySelector('#ship-select-all');
          if (selectAll) selectAll.click();

          const selCountBefore = document.querySelector('#ship-kpi-sel-num')?.textContent;
          const btnPacking = document.querySelector('#ship-btn-packing');
          if (btnPacking) btnPacking.click();

          const statusesAfter = Array.from(document.querySelectorAll('.ship-status-badge')).map(b => b.textContent);
          return {
            selCountBefore,
            statusesAfter
          };
        })()
      `,
      returnByValue: true
    });
    console.log('TEST 3 (Bulk status change to PACKING):', test3.result.value);

    // TEST 4: Print Shipping Labels -> verify tracking auto-population & customer notification
    const test4 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btnLabels = document.querySelector('#ship-btn-print-labels');
          if (btnLabels) btnLabels.click();

          const labelModal = document.querySelector('.ship-label-modal');
          const thermalLabels = document.querySelectorAll('.ship-thermal-label');
          const trackingTexts = Array.from(document.querySelectorAll('.ship-lbl-trk-num')).map(el => el.textContent);
          
          // Check state order records for populated tracking and communication log
          const state = window.StarkSystem?.getState();
          const liveOrders = state?.enterprise?.orders?.filter(o => o.status !== 'SHIPPED' && o.type !== 'HOLD_PO' && !['3PL','DROPSHIP'].includes(o.fulfillment?.kind)) || [];
          
          const orderTrackingStatus = liveOrders.map(o => ({
            po: o.po,
            tracking: o.tracking,
            hasCommLog: !!(o.communicationLog && o.communicationLog.length > 0),
            latestComm: o.communicationLog?.[0]?.text
          }));

          // Close modal
          document.querySelector('#ship-lbl-close-btn')?.click();

          // Check tracking in table
          const tableTrackings = Array.from(document.querySelectorAll('.ship-trk-pill code')).map(c => c.textContent);

          return {
            modalOpen: !!labelModal,
            thermalLabelsCount: thermalLabels.length,
            trackingTexts,
            orderTrackingStatus,
            tableTrackings
          };
        })()
      `,
      returnByValue: true
    });
    console.log('TEST 4 (Labels & Auto Tracking Population & Customer Notice):', JSON.stringify(test4.result.value, null, 2));

    // TEST 5: Packing Slips Modal
    const test5 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btnSlips = document.querySelector('#ship-btn-print-slips');
          if (btnSlips) btnSlips.click();

          const slipModal = document.querySelector('.ship-slip-modal');
          const slipsCount = document.querySelectorAll('.ship-packing-slip').length;
          
          document.querySelector('#ship-slip-close-btn')?.click();

          return {
            slipModalOpen: !!slipModal,
            slipsCount
          };
        })()
      `,
      returnByValue: true
    });
    console.log('TEST 5 (Packing Slips):', test5.result.value);

    // TEST 6: Navigate to all-open-orders.html to verify Image 1 (tabs bar) is removed
    await send('Page.navigate', { url: 'http://127.0.0.1:8094/all-open-orders.html' });
    await new Promise(r => setTimeout(r, 1500));

    const test6 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tabsBar = document.querySelector('.oo-tabs-bar');
          const pillTabs = document.querySelectorAll('.oo-pill-tab');
          const rowsCount = document.querySelectorAll('#oo-orders-tbody tr').length;
          return {
            tabsBarPresent: !!tabsBar,
            pillTabsCount: pillTabs.length,
            rowsCount
          };
        })()
      `,
      returnByValue: true
    });
    console.log('TEST 6 (all-open-orders Image 1 removed):', test6.result.value);

    ws.close();
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    cleanup();
    process.exit(1);
  }
});
