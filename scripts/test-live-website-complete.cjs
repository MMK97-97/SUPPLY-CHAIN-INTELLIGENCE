const { spawn } = require('child_process');
const fs = require('fs');

const LIVE_BASE = 'https://mmk97-97.github.io/SUPPLY-CHAIN-INTELLIGENCE';
const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const edgePath = edgePaths.find(p => fs.existsSync(p));

if (!edgePath) {
  console.error('Edge binary not found');
  process.exit(1);
}

const debugPort = 9245;
console.log(`Starting headless Edge on debug port ${debugPort}...`);
const edge = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=' + debugPort,
  '--no-first-run',
  '--no-default-browser-check',
  `${LIVE_BASE}/workspace.html?demo=1`
]);

let killed = false;
function cleanup() {
  if (!killed) {
    killed = true;
    try { edge.kill(); } catch (e) {}
  }
}

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const json = await res.json();
      const page = json.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('CDP ws endpoint timeout');
}

(async () => {
  try {
    const wsUrl = await getWsUrl();
    console.log('Connected to Edge CDP at', wsUrl);

    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const callbacks = new Map();
    const consoleErrors = [];
    const failedRequests = [];

    ws.onmessage = ev => {
      const data = JSON.parse(ev.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data);
        callbacks.delete(data.id);
      }
      if (data.method === 'Console.messageAdded') {
        const msg = data.params?.message;
        if (msg && msg.level === 'error' && !msg.text.includes('favicon')) {
          consoleErrors.push(msg.text);
        }
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        const type = data.params?.type;
        const text = data.params?.args?.map(a => a.value || a.description || '').join(' ');
        if (type === 'error' && !text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
      if (data.method === 'Network.responseReceived') {
        const resp = data.params?.response;
        if (resp && resp.status >= 400 && !resp.url.includes('favicon')) {
          failedRequests.push({ url: resp.url, status: resp.status });
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
    await send('Network.enable');

    const evaluate = async exp => {
      const res = await send('Runtime.evaluate', {
        expression: exp,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result?.result?.value;
    };

    const navigate = async (url, waitMs = 2500) => {
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, waitMs));
    };

    // ==========================================
    // 1. LIVE WORKSPACE DASHBOARD (workspace.html)
    // ==========================================
    console.log('\n==================================================');
    console.log('1. AUDITING LIVE WORKSPACE (workspace.html?demo=1)');
    console.log('==================================================');
    await new Promise(r => setTimeout(r, 3000));

    const workspaceResult = await evaluate(`(() => {
      const title = document.title;
      const shellNav = !!document.querySelector('.system-shell-nav, .system-shell, header');
      const modules = Array.from(document.querySelectorAll('.module-card, .drag-card, .ct-card, .system-card, .enterprise-kpi, .dashboard-kpi'));
      const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
      const text = document.body ? document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300) : '';

      return {
        url: window.location.href,
        title,
        hasShellNav: shellNav || links.length > 0,
        moduleCount: modules.length,
        totalLinks: links.length,
        linksSnippet: links.slice(0, 8),
        bodySnippet: text
      };
    })()`);
    console.log('Workspace Status:', JSON.stringify(workspaceResult, null, 2));

    // ==========================================
    // 2. LIVE ALL OPEN ORDERS & TIMELINE (all-open-orders.html)
    // ==========================================
    console.log('\n==================================================');
    console.log('2. AUDITING LIVE ALL OPEN ORDERS (all-open-orders.html)');
    console.log('==================================================');
    await navigate(`${LIVE_BASE}/all-open-orders.html`);

    const openOrdersResult = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('#oo-orders-tbody tr'));
      const simBtn = document.querySelector('#oo-btn-sim-toggle');
      const oldHeader = document.querySelector('.oo-header, .system-page-header, .breadcrumb');

      const orders = rows.map(r => {
        const cells = Array.from(r.querySelectorAll('td'));
        return {
          orderNum: cells[1]?.textContent?.trim(),
          custPo: cells[2]?.textContent?.trim(),
          customer: cells[3]?.textContent?.trim(),
          status: cells[4]?.textContent?.trim(),
          items: cells[6]?.textContent?.trim()
        };
      });

      return {
        url: window.location.href,
        title: document.title,
        rowCount: rows.length,
        hasSimBtn: !!simBtn,
        hasOldHeader: !!oldHeader,
        orders
      };
    })()`);
    console.log('Open Orders Grid:', JSON.stringify(openOrdersResult, null, 2));

    // Test timeline behavior across every single order
    console.log('\n--- Auditing Timeline Stepper & Status Logic for All Orders ---');
    const timelineDetails = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('#oo-orders-tbody tr'));
      const checks = [];

      for (let i = 0; i < rows.length; i++) {
        rows[i].click();
        const orderNum = document.querySelector('#oo-panel-order-num')?.textContent?.trim();
        const statusBadge = document.querySelector('#oo-panel-status')?.textContent?.trim();
        const rulePill = document.querySelector('#oo-timeline-rule-pill')?.textContent?.trim();

        const stepper = Array.from(document.querySelectorAll('#oo-stepper-track .oo-stepper-step')).map(s => ({
          label: s.querySelector('.oo-stepper-label')?.textContent?.trim(),
          status: s.className,
          dot: s.querySelector('.oo-stepper-dot')?.textContent?.trim()
        }));

        const flowSummary = Array.from(document.querySelectorAll('#oo-ptd-flow-summary .oo-ptd-item')).map(s => ({
          title: s.querySelector('.oo-ptd-step-title')?.textContent?.trim(),
          badge: s.querySelector('.oo-ptd-status-pill')?.textContent?.trim(),
          time: s.querySelector('.oo-ptd-time')?.textContent?.trim(),
          didBefore: !!s.querySelector('.oo-ptd-did-before')
        }));

        const stepCompleted = stepper.find(s => s.label === 'Completed');
        const stepPicking = stepper.find(s => s.label === 'Picking');
        const stepPacking = stepper.find(s => s.label === 'Changed to packing');
        const stepSlip = stepper.find(s => s.label === 'Packing slip printed');

        const isPacking = statusBadge.toLowerCase() === 'packing';
        const isPicking = statusBadge.toLowerCase() === 'picking';
        const isAllocated = statusBadge.toLowerCase() === 'allocated';

        checks.push({
          orderNum,
          statusBadge,
          rulePill,
          step5Dot: stepCompleted?.dot,
          step5Status: stepCompleted?.status,
          step5Badge: flowSummary.find(f => f.title === 'Completed')?.badge,
          // When order is Packing: Step 5 (Completed) MUST be pending (dot '5', Pending badge, not active, not done)
          packingCompletedPending: isPacking ? (stepCompleted?.dot === '5' && stepCompleted?.status.includes('pending') && !stepCompleted?.status.includes('active') && !stepCompleted?.status.includes('done')) : true,
          // When order is Picking: Step 2 (Picking) is active, Step 5 is pending
          pickingActiveAndCompletedPending: isPicking ? (stepPicking?.dot === '2' && stepPicking?.status.includes('active') && stepCompleted?.dot === '5' && stepCompleted?.status.includes('pending')) : true,
          // When order is Allocated: Step 2 and Step 5 are pending
          allocatedPending: isAllocated ? (stepPicking?.dot === '2' && stepCompleted?.dot === '5' && stepCompleted?.status.includes('pending')) : true
        });
      }

      return checks;
    })()`);
    console.log('Timeline Checks across all orders:', JSON.stringify(timelineDetails, null, 2));

    // Test Dedicated Timeline Tab in Drawer
    const dedicatedTabCheck = await evaluate(`(() => {
      const tab = document.querySelector('.oo-panel-tab[data-ptab="timeline"]');
      if (!tab) return { error: 'Timeline tab missing' };
      tab.click();
      const pane = document.querySelector('#oo-pane-timeline');
      const items = Array.from(document.querySelectorAll('#oo-ptd-flow-dedicated .oo-ptd-item')).map(s => ({
        title: s.querySelector('.oo-ptd-step-title')?.textContent?.trim(),
        badge: s.querySelector('.oo-ptd-status-pill')?.textContent?.trim()
      }));
      return {
        tabActive: tab.classList.contains('active'),
        paneActive: pane?.classList.contains('active'),
        dedicatedItemCount: items.length,
        items
      };
    })()`);
    console.log('Dedicated Timeline Tab in Drawer:', JSON.stringify(dedicatedTabCheck, null, 2));

    // ==========================================
    // 3. LIVE SHIP ORDERS (shipping/index.html)
    // ==========================================
    console.log('\n==================================================');
    console.log('3. AUDITING LIVE SHIP ORDERS (shipping/index.html)');
    console.log('==================================================');
    await navigate(`${LIVE_BASE}/shipping/index.html`);

    const shippingCheck = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('#ship-table-body tr'));
      const selectAll = document.querySelector('#ship-select-all');
      const btnLabels = document.querySelector('#ship-btn-print-labels');
      const btnSlips = document.querySelector('#ship-btn-print-slips');

      const initialQueue = rows.map(r => ({
        po: r.querySelector('.ship-po-btn strong')?.textContent?.trim(),
        suggestedDate: r.querySelector('.ship-suggested-pill')?.textContent?.trim(),
        status: r.querySelector('.ship-status-badge')?.textContent?.trim(),
        tracking: r.querySelector('.ship-trk-pill code')?.textContent?.trim() || 'PENDING'
      }));

      // Test Select All
      if (selectAll && !selectAll.checked) selectAll.click();
      const allSelected = Array.from(document.querySelectorAll('.ship-row-check')).every(c => c.checked);

      // Test Print Multiple Labels
      let labelsModalOpen = false;
      let labelCount = 0;
      let trackingNumbers = [];
      let commLogFound = false;

      if (btnLabels) {
        btnLabels.click();
        const modal = document.querySelector('.ship-thermal-modal, .ship-labels-modal');
        labelsModalOpen = !!modal;
        labelCount = document.querySelectorAll('.ship-thermal-label').length;

        // Close modal
        const closeBtn = document.querySelector('#ship-labels-close-btn');
        if (closeBtn) closeBtn.click();

        // Read newly populated tracking codes from table
        const updatedRows = Array.from(document.querySelectorAll('#ship-table-body tr'));
        trackingNumbers = updatedRows.map(r => r.querySelector('.ship-trk-pill code')?.textContent?.trim()).filter(Boolean);

        // Check order communication log
        const commRows = Array.from(document.querySelectorAll('.ship-comm-log-entry, .comm-log-item'));
        commLogFound = commRows.length > 0 || trackingNumbers.some(t => t.startsWith('1Z') || t.startsWith('79'));
      }

      // Test Print Multiple Packing Slips
      let slipsModalOpen = false;
      let slipsCount = 0;
      let statusesAfterSlips = [];

      if (btnSlips) {
        if (selectAll && !selectAll.checked) selectAll.click();
        btnSlips.click();
        const modal = document.querySelector('.ship-slip-modal');
        slipsModalOpen = !!modal;
        slipsCount = document.querySelectorAll('.ship-packing-slip').length;

        const closeBtn = document.querySelector('#ship-slip-close-btn');
        if (closeBtn) closeBtn.click();

        statusesAfterSlips = Array.from(document.querySelectorAll('#ship-table-body .ship-status-badge')).map(el => el.textContent.trim());
      }

      return {
        rowCount: rows.length,
        initialQueue,
        allSelected,
        labelsModalOpen,
        labelCount,
        trackingNumbers,
        commLogFound,
        slipsModalOpen,
        slipsCount,
        statusesAfterSlips
      };
    })()`);
    console.log('Shipping Module Live Audit:', JSON.stringify(shippingCheck, null, 2));

    // ==========================================
    // 4. LIVE HOME PAGE (index.html)
    // ==========================================
    console.log('\n==================================================');
    console.log('4. AUDITING LIVE HOME PAGE (index.html)');
    console.log('==================================================');
    await navigate(`${LIVE_BASE}/index.html`);

    const homeCheck = await evaluate(`(() => {
      const title = document.title;
      const demoBtn = document.querySelector('a[href*="workspace.html?demo=1"]');
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim());
      const bodyText = document.body ? document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300) : '';

      return {
        url: window.location.href,
        title,
        hasDemoBtn: !!demoBtn,
        headings,
        bodySnippet: bodyText
      };
    })()`);
    console.log('Home Page Live Audit:', JSON.stringify(homeCheck, null, 2));

    // ==========================================
    // 5. LIVE STARK MAIL (mail.html)
    // ==========================================
    console.log('\n==================================================');
    console.log('5. AUDITING LIVE STARK MAIL (mail.html)');
    console.log('==================================================');
    await navigate(`${LIVE_BASE}/mail.html`);

    const mailCheck = await evaluate(`(() => {
      const title = document.title;
      const threads = Array.from(document.querySelectorAll('.mail-thread-item'));
      const activeNav = document.querySelector('.mail-nav-item.active')?.dataset.folder;
      const selectedThread = document.querySelector('.mail-thread-item.selected');
      const subject = document.querySelector('.mail-detail-subject')?.textContent?.trim();
      const sender = document.querySelector('.mail-meta-sender-name')?.textContent?.trim();
      const intelPanel = !!document.querySelector('.stark-intel-panel, .intel-section');

      // Test clicking second thread
      let secondClicked = false;
      let newSubject = null;
      if (threads.length > 1) {
        threads[1].click();
        secondClicked = true;
        newSubject = document.querySelector('.mail-detail-subject')?.textContent?.trim();
      }

      // Test Folder Filter
      const internalBtn = document.querySelector('.mail-nav-item[data-folder="internal"]');
      let internalCount = 0;
      if (internalBtn) {
        internalBtn.click();
        internalCount = document.querySelectorAll('.mail-thread-item').length;
      }

      return {
        url: window.location.href,
        title,
        initialThreadCount: threads.length,
        activeNav,
        initialSubject: subject,
        initialSender: sender,
        hasIntelPanel: intelPanel,
        secondClicked,
        newSubject,
        internalFilteredCount: internalCount
      };
    })()`);
    console.log('Stark Mail Live Audit:', JSON.stringify(mailCheck, null, 2));

    // ==========================================
    // OVERALL AUDIT SUMMARY & VERIFICATION
    // ==========================================
    console.log('\n==================================================');
    console.log('FINAL LIVE SYSTEM INTEGRATION AUDIT SUMMARY');
    console.log('==================================================');

    const timelinePassed = timelineDetails.every(t => 
      t.packingCompletedPending && 
      t.pickingActiveAndCompletedPending && 
      t.allocatedPending
    );

    const shippingPassed = 
      shippingCheck.rowCount >= 4 &&
      shippingCheck.allSelected &&
      shippingCheck.labelCount >= 4 &&
      shippingCheck.trackingNumbers.length >= 4 &&
      shippingCheck.trackingNumbers.every(t => t.startsWith('1Z') || t.startsWith('79')) &&
      shippingCheck.slipsCount >= 4 &&
      shippingCheck.statusesAfterSlips.length >= 4 &&
      shippingCheck.statusesAfterSlips.every(s => s === 'PACKING');

    const openOrdersPassed = 
      openOrdersResult.rowCount >= 6 &&
      !openOrdersResult.hasSimBtn &&
      !openOrdersResult.hasOldHeader &&
      dedicatedTabCheck.tabActive &&
      dedicatedTabCheck.dedicatedItemCount === 5;

    const mailPassed = 
      mailCheck.initialThreadCount >= 10 &&
      mailCheck.secondClicked &&
      mailCheck.internalFilteredCount > 0;

    const homePassed = 
      homeCheck.hasDemoBtn &&
      homeCheck.headings.length > 0;

    const workspacePassed = 
      workspaceResult.hasShellNav &&
      workspaceResult.totalLinks > 0;

    const noCriticalErrors = consoleErrors.length === 0;
    const noFailedRequests = failedRequests.length === 0;

    console.log('1. Workspace Dashboard (workspace.html):', workspacePassed ? 'PASS ✓' : 'FAIL ✗');
    console.log('2. Open Orders & Order Details Grid (all-open-orders.html):', openOrdersPassed ? 'PASS ✓' : 'FAIL ✗');
    console.log('3. Timeline Logic (No premature Completed, Step 5 pending during Packing):', timelinePassed ? 'PASS ✓' : 'FAIL ✗');
    console.log('4. Shipping Fulfillment (Batch labels, auto tracking, batch slips, status PACKING):', shippingPassed ? 'PASS ✓' : 'FAIL ✗');
    console.log('5. Home Page (index.html):', homePassed ? 'PASS ✓' : 'FAIL ✗');
    console.log('6. Stark Mail (mail.html):', mailPassed ? 'PASS ✓' : 'FAIL ✗');
    console.log('7. Console Health (0 critical errors):', noCriticalErrors ? 'PASS ✓' : `FAIL ✗ (${consoleErrors.length} errors)`);
    console.log('8. Network Health (0 failed 404/500 requests):', noFailedRequests ? 'PASS ✓' : `FAIL ✗ (${failedRequests.length} failed)`);

    const overallPassed = 
      workspacePassed &&
      openOrdersPassed &&
      timelinePassed &&
      shippingPassed &&
      homePassed &&
      mailPassed &&
      noCriticalErrors &&
      noFailedRequests;

    console.log('\n==================================================');
    console.log(overallPassed ? '>>> ALL LIVE AUDITS PASSED: 100% OPERATIONAL & FLAWLESS! <<<' : '>>> SOME AUDITS FAILED <<<');
    console.log('==================================================\n');

    ws.close();
    cleanup();
    process.exit(overallPassed ? 0 : 1);
  } catch (err) {
    console.error('Fatal audit error:', err);
    cleanup();
    process.exit(1);
  }
})();
