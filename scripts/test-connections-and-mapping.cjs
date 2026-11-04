const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
      '.png': 'image/png',
      '.json': 'application/json'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 8095;
server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Connections test static server listening on http://127.0.0.1:${PORT}`);

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

  const debugPort = 9253;
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
      const res = await send('Runtime.evaluate', {
        expression: exp,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result?.result?.value;
    };

    await new Promise(r => setTimeout(r, 1500));

    // TEST 1: Attachment Download Verification
    console.log('\n--- 1. Testing Attachment Downloads & Handlers ---');
    const attachTest = await evaluate(`(() => {
      const attachCard = document.querySelector('.mail-attachments-card');
      const attachItems = document.querySelectorAll('.mail-attach-item');
      const downloadAll = document.querySelector('#btn-download-all');

      let downloadTriggered = false;
      const origCreateElement = document.createElement.bind(document);
      document.createElement = function(tag) {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          const origClick = el.click.bind(el);
          el.click = function() {
            downloadTriggered = true;
            return origClick();
          };
        }
        return el;
      };

      if (attachItems[0]) {
        attachItems[0].click();
      }

      document.createElement = origCreateElement;

      return {
        hasAttachmentCard: !!attachCard,
        attachmentCount: attachItems.length,
        hasDownloadAllBtn: !!downloadAll,
        downloadTriggered
      };
    })()`);
    console.log('Attachment Test Result:', attachTest);

    // TEST 2: Shared Mailboxes Mapping Verification
    console.log('\n--- 2. Testing Shared Mailboxes Dynamic Filtering ---');
    const mailboxTest = await evaluate(`(() => {
      const results = {};
      const mailboxes = ['customers', 'vendors', 'orders', 'shipping', 'procurement', '3pl', 'internal'];
      
      for (const mb of mailboxes) {
        const btn = document.querySelector(\`.mail-nav-item[data-folder="\${mb}"]\`);
        if (btn) {
          btn.click();
          const items = document.querySelectorAll('.mail-thread-item');
          results[mb] = {
            found: true,
            threadCount: items.length
          };
        }
      }

      // Reset to inbox
      document.querySelector('.mail-nav-item[data-folder="inbox"]')?.click();

      return results;
    })()`);
    console.log('Shared Mailbox Mapping Result:', mailboxTest);

    // TEST 3: Compose Window Controls & Attachment Upload
    console.log('\n--- 3. Testing Compose Window Controls & Attachments ---');
    const composeControlsTest = await evaluate(`(() => {
      document.querySelector('#btn-mail-compose')?.click();

      const expandBtn = document.querySelector('#btn-compose-expand');
      expandBtn?.click();
      const isExpanded = document.querySelector('.stark-mail-workspace')?.classList.contains('compose-expanded');

      document.querySelector('#btn-compose-expand')?.click();
      const isRestored = !document.querySelector('.stark-mail-workspace')?.classList.contains('compose-expanded');

      const fileInput = document.querySelector('#pane-compose-file-input');
      const attachBtn = document.querySelector('#btn-pane-attach');

      return {
        isExpanded,
        isRestored,
        hasFileInput: !!fileInput,
        hasAttachBtn: !!attachBtn
      };
    })()`);
    console.log('Compose Controls Result:', composeControlsTest);

    // TEST 4: Outbound Database Schema Mapping Parity
    console.log('\n--- 4. Testing Outbound Schema Mapping (No folder/unread rejection) ---');
    const schemaTest = await evaluate(`(async () => {
      const sb = window.StarkMail?.getSupabase();
      if (!sb) return { error: 'No supabase client' };

      let capturedInsert = null;
      sb.functions.invoke = async () => ({ data: { status: 'mock_sent' }, error: null });
      const origFrom = sb.from.bind(sb);
      sb.from = (table) => {
        const q = origFrom(table);
        if (table === 'emails') {
          q.insert = (records) => {
            capturedInsert = records;
            return Promise.resolve({ error: null });
          };
        }
        return q;
      };

      const sendBtn = document.querySelector('#btn-pane-send-email');
      sendBtn?.click();

      await new Promise(r => setTimeout(r, 600));

      const record = capturedInsert?.[0] || {};
      const hasInvalidFolder = 'folder' in record;
      const hasInvalidUnread = 'unread' in record;
      const hasValidToEmail = 'to_email' in record;
      const hasValidDirection = record.direction === 'outbound';

      return {
        sendBtnFound: !!sendBtn,
        sendBtnDisabled: sendBtn?.disabled,
        captured: !!capturedInsert,
        hasInvalidFolder,
        hasInvalidUnread,
        hasValidToEmail,
        hasValidDirection
      };
    })()`);
    console.log('Schema Mapping Result:', schemaTest);

    const allPassed =
      attachTest.hasAttachmentCard &&
      attachTest.downloadTriggered &&
      mailboxTest.customers?.threadCount > 0 &&
      mailboxTest.vendors?.threadCount > 0 &&
      composeControlsTest.isExpanded &&
      composeControlsTest.isRestored &&
      composeControlsTest.hasFileInput &&
      schemaTest.captured &&
      !schemaTest.hasInvalidFolder &&
      !schemaTest.hasInvalidUnread &&
      schemaTest.hasValidToEmail;

    if (allPassed) {
      console.log('\n========================================');
      console.log('>>> ALL CONNECTIONS & MAPPING TESTS PASSED (100%) <<<');
      console.log('========================================\n');
      cleanup();
      process.exit(0);
    } else {
      console.error('\n>>> SOME TESTS FAILED <<<');
      cleanup();
      process.exit(1);
    }
  } catch (err) {
    console.error('Test error:', err);
    cleanup();
    process.exit(1);
  }
});
