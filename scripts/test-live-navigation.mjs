import { spawn } from 'node:child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\Manne\\.gemini\antigravity\\scratch\\SUPPLY-CHAIN-INTELLIGENCE\\chrome-profile-test';

const chromeProcess = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  '--disable-gpu',
  '--no-sandbox',
  'about:blank'
]);

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (_) {}
    await wait(300);
  }
  throw new Error('Could not connect to Chrome debugger.');
}

async function run() {
  try {
    await getDebuggerUrl();
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?https://mmk97-97.github.io/SUPPLY-CHAIN-INTELLIGENCE/workspace.html', { method: 'PUT' });
    const pageData = await newPageRes.json();

    const ws = new WebSocket(pageData.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const callbacks = new Map();
    const errors = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.exceptionThrown') {
          errors.push({
            type: 'exception',
            text: msg.params?.exceptionDetails?.text,
            desc: msg.params?.exceptionDetails?.exception?.description
          });
        } else if (msg.method === 'Log.entryAdded') {
          if (msg.params?.entry?.level === 'error') {
            errors.push({ type: 'log-error', text: msg.params?.entry?.text });
          }
        }
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');

    console.log('Waiting for initial workspace.html...');
    await wait(3500);

    const navTabs = await send('Runtime.evaluate', {
      expression: `(() => {
        return Array.from(document.querySelectorAll('.system-module-tab, .system-subnav-item, .system-home')).map(a => ({
          label: a.textContent.trim().replace(/\\s+/g, ' '),
          href: a.href
        }));
      })()`,
      returnByValue: true
    });
    console.log('Found navigation links:', navTabs.result?.value?.length);

    const testLinks = (navTabs.result?.value || []).slice(0, 12);
    for (const link of testLinks) {
      console.log(`\nTesting click on: "${link.label}" (${link.href})`);
      errors.length = 0;

      await send('Runtime.evaluate', {
        expression: `(() => {
          const a = Array.from(document.querySelectorAll('a')).find(x => x.href === '${link.href}');
          if (a) a.click();
          else location.href = '${link.href}';
        })()`
      });

      await wait(1800);

      const pageState = await send('Runtime.evaluate', {
        expression: `(() => ({
          url: location.href,
          title: document.title,
          hasLoading: document.documentElement.classList.contains('stark-page-loading'),
          hasPending: document.documentElement.classList.contains('stark-navigation-pending'),
          contentLen: document.body?.innerHTML?.length || 0,
          h1: document.querySelector('h1')?.textContent?.trim() || 'none'
        }))()`,
        returnByValue: true
      });
      console.log('  State after 1.8s:', pageState.result?.value);
      if (errors.length) {
        console.log('  Errors during switch:', errors);
      }
    }

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chromeProcess.kill();
  }
}

run();
