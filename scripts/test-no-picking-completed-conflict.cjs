const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/all-open-orders.html';
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

server.listen(8097, '127.0.0.1', async () => {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgePath = edgePaths.find(p => fs.existsSync(p));
  const debugPort = 9227;
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + debugPort,
    'http://127.0.0.1:8097/all-open-orders.html'
  ]);

  async function getWs() {
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:' + debugPort + '/json');
        const json = await res.json();
        const p = json.find(t => t.type === 'page' && t.url.includes('all-open-orders.html'));
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

    const result = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('#oo-orders-tbody tr'));
      const checks = [];

      for (const row of rows) {
        row.click();
        const orderNum = document.querySelector('#oo-panel-order-num')?.textContent;
        const statusBadge = document.querySelector('#oo-panel-status')?.textContent;
        const stepper = Array.from(document.querySelectorAll('#oo-stepper-track .oo-stepper-step')).map(s => ({
          label: s.querySelector('.oo-stepper-label')?.textContent,
          status: s.className,
          dot: s.querySelector('.oo-stepper-dot')?.textContent
        }));
        const completedStep = stepper.find(s => s.label === 'Completed');
        const pickingStep = stepper.find(s => s.label === 'Picking');

        checks.push({
          orderNum,
          statusBadge,
          pickingDot: pickingStep?.dot,
          pickingStatus: pickingStep?.status,
          completedDot: completedStep?.dot,
          completedStatus: completedStep?.status,
          showsCompletedWhilePicking: statusBadge.toLowerCase() === 'picking' && completedStep?.dot === '✓'
        });
      }

      return checks;
    })()`);

    console.log('Fulfillment Timeline Checks across orders:');
    console.log(JSON.stringify(result, null, 2));

    const anyConflict = result.some(c => c.showsCompletedWhilePicking);
    console.log('Any conflict in table (Completed & Picking at the same time)?', anyConflict ? 'YES (FAIL)' : 'NO (PASSED!)');

    // Test row 1 (#87366-R002 which has status Picking)
    const pickingOrderCheck = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('#oo-orders-tbody tr'));
      rows[1].click();
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
      return { orderNum, statusBadge, stepper, flow };
    })()`);

    console.log('\nPicking Order (#87366-R002) Detailed Check:');
    console.log(JSON.stringify(pickingOrderCheck, null, 2));

    const pickCompletedStep = pickingOrderCheck.stepper.find(s => s.label === 'Completed');
    const pickingConflict = pickingOrderCheck.statusBadge.toLowerCase() === 'picking' && (pickCompletedStep?.dot === '✓' || pickCompletedStep?.status.includes('done'));
    console.log('Picking order has Completed step checked?', pickingConflict ? 'YES (FAIL)' : 'NO (PASSED!)');

    const totalFailed = anyConflict || pickingConflict;

    ws.close();
    edge.kill();
    server.close();
    process.exit(totalFailed ? 1 : 0);
  } catch (err) {
    console.error(err);
    edge.kill();
    server.close();
    process.exit(1);
  }
});
