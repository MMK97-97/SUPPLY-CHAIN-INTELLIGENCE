const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Static file server
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://127.0.0.1:8093');
  let filePath = path.join(__dirname, '..', parsedUrl.pathname === '/' ? 'mail.html' : parsedUrl.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..', 'mail.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error: ' + err.code);
    } else {
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      res.end(content);
    }
  });
});

server.listen(8093, '127.0.0.1', async () => {
  console.log('Toolbar test server listening on http://127.0.0.1:8093');

  function cleanup() {
    server.close();
  }

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgePath = edgePaths.find(p => fs.existsSync(p));
  if (!edgePath) {
    console.error('Edge binary not found');
    cleanup();
    process.exit(1);
  }

  const debugPort = 9251;
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + debugPort,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:8093/mail.html'
  ]);

  let killed = false;
  function cleanup() {
    if (!killed) {
      killed = true;
      try { edge.kill(); } catch (e) {}
      try { server.close(); } catch (e) {}
    }
  }

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

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

  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();

  function sendCmd(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  try {
      console.log('Connected to Edge CDP. Navigating to mail.html...');
      await sendCmd('Page.navigate', { url: 'http://127.0.0.1:8093/mail.html' });
      await new Promise(r => setTimeout(r, 1500));

      async function evaluate(expression) {
        const res = await sendCmd('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true
        });
        if (res.exceptionDetails) {
          throw new Error('Eval error: ' + JSON.stringify(res.exceptionDetails));
        }
        return res.result?.value;
      }

      // Test 1: Verify all 8 toolbar buttons exist
      console.log('\n--- 1. Testing Toolbar Buttons Presence ---');
      const presence = await evaluate(`(() => {
        const toolbar = document.querySelector('.mail-detail-toolbar');
        return {
          hasToolbar: !!toolbar,
          hasReply: !!document.querySelector('#tool-reply'),
          hasReplyAll: !!document.querySelector('#tool-reply-all'),
          hasForward: !!document.querySelector('#tool-forward'),
          hasArchive: !!document.querySelector('#tool-archive'),
          hasFlag: !!document.querySelector('#tool-flag'),
          hasAssign: !!document.querySelector('#tool-assign'),
          hasMove: !!document.querySelector('#tool-move'),
          hasMore: !!document.querySelector('#tool-more')
        };
      })()`);
      console.log('Presence check:', presence);

      // Test 2: Test Reply button
      console.log('\n--- 2. Testing Reply Button ---');
      const replyTest = await evaluate(`(() => {
        const btn = document.querySelector('#tool-reply');
        btn.click();
        const activeTab = document.querySelector('.composer-tab.active')?.dataset.type;
        const input = document.querySelector('#mail-reply-input');
        return {
          clicked: true,
          activeTab,
          isFocused: document.activeElement === input,
          placeholder: input?.placeholder
        };
      })()`);
      console.log('Reply test result:', replyTest);

      // Test 3: Test Reply All button
      console.log('\n--- 3. Testing Reply All Button ---');
      const replyAllTest = await evaluate(`(() => {
        const btn = document.querySelector('#tool-reply-all');
        btn.click();
        const activeTab = document.querySelector('.composer-tab.active')?.dataset.type;
        const input = document.querySelector('#mail-reply-input');
        return {
          clicked: true,
          activeTab,
          placeholder: input?.placeholder
        };
      })()`);
      console.log('Reply all test result:', replyAllTest);

      // Test 4: Test Flag button toggle
      console.log('\n--- 4. Testing Flag Button Toggle ---');
      const flagTest = await evaluate(`(() => {
        const btn = document.querySelector('#tool-flag');
        const initialText = btn.textContent.trim();
        btn.click();
        const afterText = document.querySelector('#tool-flag').textContent.trim();
        return {
          initialText,
          afterText,
          toggled: initialText !== afterText
        };
      })()`);
      console.log('Flag test result:', flagTest);

      // Test 5: Test Assign modal
      console.log('\n--- 5. Testing Assign Button & Modal ---');
      const assignTest = await evaluate(`(() => {
        const btn = document.querySelector('#tool-assign');
        btn.click();
        const backdrop = document.querySelector('#assign-modal-backdrop');
        const hasBackdrop = !!backdrop;
        const assignItems = document.querySelectorAll('.assign-item').length;
        // Close modal
        document.querySelector('#btn-close-assign')?.click();
        const closed = !document.querySelector('#assign-modal-backdrop');
        return {
          hasBackdrop,
          assignItems,
          closed
        };
      })()`);
      console.log('Assign test result:', assignTest);

      // Test 6: Test Move modal
      console.log('\n--- 6. Testing Move Button & Modal ---');
      const moveTest = await evaluate(`(() => {
        const btn = document.querySelector('#tool-move');
        btn.click();
        const backdrop = document.querySelector('#move-modal-backdrop');
        const hasBackdrop = !!backdrop;
        const folderOptions = document.querySelectorAll('.move-folder-option').length;
        // Close modal
        document.querySelector('#btn-close-move')?.click();
        const closed = !document.querySelector('#move-modal-backdrop');
        return {
          hasBackdrop,
          folderOptions,
          closed
        };
      })()`);
      console.log('Move test result:', moveTest);

      // Test 7: Test More options popover
      console.log('\n--- 7. Testing More Options Menu ---');
      const moreTest = await evaluate(`(() => {
        const btn = document.querySelector('#tool-more');
        btn.click();
        const popover = document.querySelector('#mail-more-menu-popover');
        const hasPopover = !!popover;
        const items = document.querySelectorAll('.mail-menu-item').length;
        // Close popover
        popover?.remove();
        return {
          hasPopover,
          itemCount: items
        };
      })()`);
      console.log('More options test result:', moreTest);

      // Test 8: Test Forward modal
      console.log('\n--- 8. Testing Forward Button ---');
      const forwardTest = await evaluate(`(() => {
        const btn = document.querySelector('#tool-forward');
        btn.click();
        const backdrop = document.querySelector('#compose-modal-backdrop');
        const hasBackdrop = !!backdrop;
        const subjectVal = document.querySelector('#compose-subject')?.value;
        const bodyVal = document.querySelector('#compose-body')?.value;
        const isFwd = subjectVal?.startsWith('Fwd:') && bodyVal?.includes('Forwarded message');
        // Close modal
        document.querySelector('#btn-close-compose')?.click();
        return {
          hasBackdrop,
          subjectVal,
          isFwd
        };
      })()`);
      console.log('Forward test result:', forwardTest);

      const pass = 
        presence.hasToolbar && presence.hasReply && presence.hasReplyAll && presence.hasForward &&
        presence.hasArchive && presence.hasFlag && presence.hasAssign && presence.hasMove && presence.hasMore &&
        replyTest.activeTab === 'reply' &&
        replyAllTest.activeTab === 'replyAll' &&
        flagTest.toggled &&
        assignTest.hasBackdrop && assignTest.assignItems >= 5 &&
        moveTest.hasBackdrop && moveTest.folderOptions >= 5 &&
        moreTest.hasPopover && moreTest.itemCount >= 5 &&
        forwardTest.hasBackdrop && forwardTest.isFwd;

      console.log('\n========================================');
      console.log(pass ? '>>> ALL TOOLBAR BUTTON TESTS PASSED (100%) <<<' : '>>> SOME TOOLBAR TESTS FAILED <<<');
      console.log('========================================\n');

      ws.close();
      cleanup();
      process.exit(pass ? 0 : 1);
    } catch (err) {
      console.error('Test error:', err);
      ws.close();
      cleanup();
      process.exit(1);
    }
  });
