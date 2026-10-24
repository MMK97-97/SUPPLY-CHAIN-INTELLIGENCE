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

server.listen(8093, '127.0.0.1', async () => {
  console.log('Test Server on http://127.0.0.1:8093');

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgePath = edgePaths.find(p => fs.existsSync(p));

  const debugPort = 9230;
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + debugPort,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:8093/all-open-orders.html'
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

    await new Promise(r => setTimeout(r, 1500));

    const evalResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const breadcrumb = document.querySelector('.oo-breadcrumb');
          const header = document.querySelector('.oo-header');
          const pageTitle = document.querySelector('.oo-page-title');
          const exportBtn = document.querySelector('#oo-btn-export');
          const columnsBtn = document.querySelector('#oo-btn-columns');
          const container = document.querySelector('.oo-page-container');
          const filterCard = document.querySelector('.oo-filter-card');
          const rowsCount = document.querySelectorAll('#oo-orders-tbody tr').length;

          const containerStyle = container ? window.getComputedStyle(container) : null;
          const filterStyle = filterCard ? window.getComputedStyle(filterCard) : null;

          return {
            breadcrumbPresent: !!breadcrumb,
            headerPresent: !!header,
            pageTitlePresent: !!pageTitle,
            exportBtnPresent: !!exportBtn,
            columnsBtnPresent: !!columnsBtn,
            containerPadding: containerStyle ? containerStyle.padding : null,
            filterMarginTop: filterStyle ? filterStyle.marginTop : null,
            filterMarginBottom: filterStyle ? filterStyle.marginBottom : null,
            rowsCount
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Verification Result:', evalResult.result.value);

    ws.close();
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    cleanup();
    process.exit(1);
  }
});
