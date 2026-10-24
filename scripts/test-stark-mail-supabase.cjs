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

const PORT = 8092;
server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Test static server listening on http://127.0.0.1:${PORT}`);

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

  const debugPort = 9250;
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
    console.log('Connected to Edge CDP at', wsUrl);

    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const callbacks = new Map();
    const consoleLogs = [];
    const consoleErrors = [];

    ws.onmessage = ev => {
      const data = JSON.parse(ev.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data);
        callbacks.delete(data.id);
      }
      if (data.method === 'Console.messageAdded') {
        const msg = data.params?.message;
        if (msg) {
          if (msg.level === 'error') consoleErrors.push(msg.text);
          else consoleLogs.push(msg.text);
        }
      }
    };

    await new Promise(r => ws.onopen = r);

    const send = (method, params = {}) => new Promise(resolve => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Console.enable');
    await send('Runtime.enable');

    const evaluate = async exp => {
      const res = await send('Runtime.evaluate', {
        expression: exp,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result?.result?.value;
    };

    // Wait for STARK Mail to mount
    await new Promise(r => setTimeout(r, 2000));

    // TEST 1: Environment Configuration Blocks
    console.log('\n--- 1. Testing Supabase Environment Configuration Blocks ---');
    const envCheck = await evaluate(`(() => {
      return {
        hasEnv: !!window.ENV,
        envUrl: window.ENV?.SUPABASE_URL,
        envAnonKey: window.ENV?.SUPABASE_ANON_KEY ? window.ENV.SUPABASE_ANON_KEY.slice(0, 15) + '...' : null,
        hasStarkConfig: !!window.STARK_SUPABASE_CONFIG,
        configUrl: window.STARK_SUPABASE_CONFIG?.url,
        configAnonKey: window.STARK_SUPABASE_CONFIG?.anonKey ? window.STARK_SUPABASE_CONFIG.anonKey.slice(0, 15) + '...' : null,
        hasSupabaseClient: !!window.supabase?.createClient
      };
    })()`);
    console.log('Environment Config Result:', envCheck);

    // TEST 2: Verify Supabase Client Instance in STARK Mail
    console.log('\n--- 2. Testing Supabase Client Initialization in STARK Mail ---');
    const sbClientCheck = await evaluate(`(() => {
      const sb = window.StarkMail?.getSupabase ? window.StarkMail.getSupabase() : null;
      return {
        hasStarkMail: !!window.StarkMail,
        hasClient: !!sb,
        hasFunctions: typeof sb?.functions?.invoke === 'function',
        hasFrom: typeof sb?.from === 'function',
        hasChannel: typeof sb?.channel === 'function'
      };
    })()`);
    console.log('Supabase Client Check:', sbClientCheck);

    // TEST 3: Outgoing Mail Integration (The "Send" Button in Reply Panel)
    console.log('\n--- 3. Testing Outgoing Mail Integration (Green Send Button) ---');
    const sendButtonTest = await evaluate(`(async () => {
      const sb = window.StarkMail?.getSupabase();
      if (!sb) return { error: 'No supabase client' };

      // Spy on sb.functions.invoke and sb.from('emails').insert
      let capturedFunctionInvocation = null;
      let capturedDbInsert = null;

      const mockFunctions = {
        invoke: async (fnName, options) => {
          capturedFunctionInvocation = { fnName, options };
          return { data: { success: true, message: 'Sandbox email sent' }, error: null };
        }
      };
      Object.defineProperty(sb, 'functions', {
        get: () => mockFunctions,
        configurable: true
      });

      const origFrom = sb.from.bind(sb);
      sb.from = (table) => {
        const query = origFrom(table);
        if (table === 'emails') {
          const origInsert = query.insert.bind(query);
          query.insert = (records) => {
            capturedDbInsert = records;
            return origInsert(records);
          };
        }
        return query;
      };

      // Locate Reply Panel elements
      const replyInput = document.querySelector('#mail-reply-input');
      const sendBtn = document.querySelector('#btn-send-reply');

      if (!replyInput) return { error: 'Reply input textarea #mail-reply-input not found' };
      if (!sendBtn) return { error: 'Green send button #btn-send-reply not found' };

      const isGreen = window.getComputedStyle(sendBtn).backgroundColor;

      // Type test input text
      const testText = "Confirmed! Staging bay #4 is allocated for PO #87366 consignment.";
      replyInput.value = testText;

      // Click Send button
      sendBtn.click();

      // Wait for async processing
      await new Promise(r => setTimeout(r, 600));

      const inputCleared = replyInput.value === '';
      const toastEl = document.querySelector('.system-toast');
      const toastText = toastEl ? toastEl.textContent : '';

      // Check if outbound thread prepended
      const firstThread = document.querySelector('.mail-thread-item');
      const firstSubject = firstThread?.querySelector('.mail-thread-subject')?.textContent;
      const firstSnippet = firstThread?.querySelector('.mail-thread-snippet')?.textContent;

      return {
        sendButtonFound: true,
        sendButtonColor: isGreen,
        capturedFunctionInvocation,
        capturedDbInsert,
        inputCleared,
        toastShown: !!toastEl,
        toastText,
        firstThreadSubject: firstSubject,
        firstThreadSnippet: firstSnippet
      };
    })()`);
    console.log('Send Button Integration Result:', JSON.stringify(sendButtonTest, null, 2));

    // TEST 4: Reactive Mail Feed (Realtime INSERT and instant prepend)
    console.log('\n--- 4. Testing Reactive Mail Feed (Realtime INSERT and instant prepend) ---');
    const realtimeTest = await evaluate(`(async () => {
      const initialThreadCount = document.querySelectorAll('.mail-thread-item').length;
      const initialFirstSubject = document.querySelector('.mail-thread-item .mail-thread-subject')?.textContent;

      // Simulate a live Postgres INSERT event hitting public.emails
      const incomingRecord = {
        id: 'realtime-test-' + Date.now(),
        direction: 'inbound',
        sender: 'Global Logistics Dispatch',
        sender_name: 'Elena Rostova',
        sender_company: 'EuroTrans Freight GmbH',
        sender_email: 'elena.rostova@eurotrans.de',
        to: 'supply.chain@stark.com',
        subject: 'Customs Clearance Expedited: Container #EU-9921',
        body: 'Customs clearance for container #EU-9921 has been cleared through Rotterdam hub. Consignment ready for collection.',
        snippet: 'Customs clearance for container #EU-9921 has been cleared through Rotterdam hub...',
        created_at: new Date().toISOString()
      };

      // Prepend via StarkMail realtime handler
      window.StarkMail.prependEmail(incomingRecord);

      await new Promise(r => setTimeout(r, 200));

      const updatedThreadCount = document.querySelectorAll('.mail-thread-item').length;
      const newFirstThread = document.querySelector('.mail-thread-item');
      const newFirstSender = newFirstThread?.querySelector('.mail-thread-sender')?.textContent;
      const newFirstSubject = newFirstThread?.querySelector('.mail-thread-subject')?.textContent;
      const newFirstSnippet = newFirstThread?.querySelector('.mail-thread-snippet')?.textContent;

      return {
        initialThreadCount,
        updatedThreadCount,
        prependedInstantly: updatedThreadCount === initialThreadCount + 1,
        newFirstSender,
        newFirstSubject,
        newFirstSnippet,
        matchesIncoming: newFirstSubject === incomingRecord.subject && newFirstSender === incomingRecord.sender_name
      };
    })()`);
    console.log('Reactive Mail Feed Result:', JSON.stringify(realtimeTest, null, 2));

    // Verification evaluation
    const pass1 = envCheck.hasEnv && envCheck.hasStarkConfig && !!envCheck.envUrl && !!envCheck.envAnonKey;
    const pass2 = sbClientCheck.hasClient && sbClientCheck.hasFunctions && sbClientCheck.hasFrom && sbClientCheck.hasChannel;
    const pass3 = 
      sendButtonTest.sendButtonFound &&
      sendButtonTest.capturedFunctionInvocation?.fnName === 'send-sandbox-email' &&
      sendButtonTest.capturedFunctionInvocation?.options?.body?.to === 'your-github-email@example.com' &&
      sendButtonTest.capturedFunctionInvocation?.options?.body?.subject === 'Re: Staging Bay Confirmation PO #87366' &&
      sendButtonTest.inputCleared &&
      sendButtonTest.capturedDbInsert?.[0]?.direction === 'outbound' &&
      sendButtonTest.toastShown;
    const pass4 = realtimeTest.prependedInstantly && realtimeTest.matchesIncoming;

    const overall = pass1 && pass2 && pass3 && pass4;

    console.log('\n========================================');
    console.log(`1. Environment Config: ${pass1 ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log(`2. Supabase Client: ${pass2 ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log(`3. Outgoing Send Button Integration: ${pass3 ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log(`4. Reactive Mail Feed Integration: ${pass4 ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log('========================================');
    console.log(overall ? '>>> ALL SUPABASE MAIL TESTS PASSED (100%) <<<' : '>>> SOME TESTS FAILED <<<');
    console.log('========================================\n');

    ws.close();
    cleanup();
    process.exit(overall ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    cleanup();
    process.exit(1);
  }
});
