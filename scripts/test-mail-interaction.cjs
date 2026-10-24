const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Quick local HTTP static server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/mail.html';
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

server.listen(8099, '127.0.0.1', async () => {
  console.log('Static server listening on http://127.0.0.1:8099');

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

  const debugPort = 9224;
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + debugPort,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:8099/mail.html'
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
        const page = json.find(t => t.type === 'page' && t.url.includes('mail.html'));
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

    // Wait for page to finish rendering
    await new Promise(r => setTimeout(r, 1200));

    console.log('\n--- 1. Testing Default View ---');
    const defaultState = await evaluate(`(() => {
      const activeNav = document.querySelector('.mail-nav-item.active')?.dataset.folder;
      const threadCount = document.querySelectorAll('.mail-thread-item').length;
      const activeThreadId = document.querySelector('.mail-thread-item.selected')?.dataset.threadId;
      const detailSubject = document.querySelector('.mail-detail-subject')?.textContent;
      const detailSender = document.querySelector('.mail-meta-sender-name')?.textContent;
      return { activeNav, threadCount, activeThreadId, detailSubject, detailSender };
    })()`);
    console.log('Default State:', defaultState);

    console.log('\n--- 2. Testing Internal Ops Click ---');
    const internalState = await evaluate(`(() => {
      const internalBtn = document.querySelector('.mail-nav-item[data-folder="internal"]');
      if (!internalBtn) return { error: 'Internal Ops button not found' };
      internalBtn.click();
      return {
        clicked: true,
        activeNav: document.querySelector('.mail-nav-item.active')?.dataset.folder,
        threadCount: document.querySelectorAll('.mail-thread-item').length,
        activeThreadId: document.querySelector('.mail-thread-item.selected')?.dataset.threadId,
        detailSubject: document.querySelector('.mail-detail-subject')?.textContent,
        detailSender: document.querySelector('.mail-meta-sender-name')?.textContent,
        intelPo: document.querySelector('.intel-summary-item strong')?.textContent
      };
    })()`);
    console.log('Internal Ops State:', internalState);

    console.log('\n--- 3. Testing Tom Wilson (2nd internal thread) Click ---');
    const tomWilsonState = await evaluate(`(() => {
      const threads = document.querySelectorAll('.mail-thread-item');
      if (threads.length < 2) return { error: 'Expected 2 internal threads' };
      threads[1].click();
      return {
        activeThreadId: document.querySelector('.mail-thread-item.selected')?.dataset.threadId,
        detailSubject: document.querySelector('.mail-detail-subject')?.textContent,
        detailSender: document.querySelector('.mail-meta-sender-name')?.textContent
      };
    })()`);
    console.log('Tom Wilson State:', tomWilsonState);

    console.log('\n--- 4. Testing All Folder Navigation & Counts ---');
    const folderChecks = await evaluate(`(() => {
      const folders = [
        'inbox', 'starred', 'snoozed', 'drafts',
        'shared', 'vendor', 'customer', 'procurement', 'shipping', 'internal',
        'unread', 'flagged', 'attachments', 'orderRelated'
      ];
      const results = {};
      for (const f of folders) {
        const btn = document.querySelector('.mail-nav-item[data-folder="' + f + '"]');
        if (!btn) {
          results[f] = { error: 'Button not found' };
          continue;
        }
        btn.click();
        const countBadge = btn.querySelector('.mail-nav-count')?.textContent.trim();
        const threadsRendered = document.querySelectorAll('.mail-thread-item').length;
        const activeSender = document.querySelector('.mail-meta-sender-name')?.textContent;
        results[f] = { countBadge, threadsRendered, activeSender, match: String(threadsRendered) === countBadge };
      }
      return results;
    })()`);
    console.log('Folder Checks:');
    let allFolderOk = true;
    for (const [f, res] of Object.entries(folderChecks)) {
      const pass = res.match;
      console.log(`  Folder "${f}": Badge=${res.countBadge}, Rendered=${res.threadsRendered}, Selected="${res.activeSender}" -> ${pass ? 'PASS' : 'FAIL'}`);
      if (!pass) allFolderOk = false;
    }

    console.log('\n--- 5. Testing Interactive Actions ---');
    const actionChecks = await evaluate(`(() => {
      // Return to inbox
      document.querySelector('.mail-nav-item[data-folder="inbox"]')?.click();
      
      // Star toggle
      const starBtn = document.querySelector('#btn-toggle-star');
      const starBefore = starBtn?.classList.contains('is-starred');
      starBtn?.click();
      const starAfter = document.querySelector('#btn-toggle-star')?.classList.contains('is-starred');
      
      // Flag toggle
      const flagBtn = document.querySelector('#tool-flag');
      flagBtn?.click();

      // Reply focus
      const replyBtn = document.querySelector('#tool-reply');
      replyBtn?.click();
      const replyFocused = document.activeElement?.id === 'mail-reply-input';

      return {
        starToggled: starBefore !== starAfter,
        replyFocused
      };
    })()`);
    console.log('Action Checks:', actionChecks);

    const isSuccess = 
      defaultState.activeNav === 'inbox' &&
      defaultState.threadCount === 12 &&
      internalState.activeNav === 'internal' &&
      internalState.threadCount === 2 &&
      internalState.detailSender === 'Michael Khan' &&
      tomWilsonState.detailSender === 'Tom Wilson' &&
      allFolderOk &&
      actionChecks.starToggled &&
      actionChecks.replyFocused;

    console.log('\n========================================');
    console.log(isSuccess ? '>>> ALL CHECKS PASSED: 100% OPERATIONAL! <<<' : '>>> SOME CHECKS FAILED <<<');
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
