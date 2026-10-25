const fs = require('fs');
const path = require('path');

const mailJsPath = path.join(__dirname, '..', 'mail.js');
let content = fs.readFileSync(mailJsPath, 'utf8');

// 1. Define the 10 screenshot threads
const newInitialThreads = `  // 10 Detailed Threads matching the screenshot exactly
  const initialThreads = [
    {
      id: 'thread-1',
      senderName: 'James Smith',
      senderCompany: 'Global Parts Co.',
      senderEmail: 'james.smith@globalpartsco.com',
      to: 'supply.chain@mk97.com',
      cc: 'procurement@mk97.com, ops@mk97.com',
      subject: 'PO #87366 - Confirmed for Shipment',
      timestamp: '10:24 AM',
      fullDate: 'Mon, Apr 21, 2026 10:24 AM',
      unread: true,
      starred: true,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'JS',
      avatarBg: '#f1f5f9',
      avatarColor: '#334155',
      tags: [
        { name: 'PO #87366', type: 'po' },
        { name: 'Shipment', type: 'shipment' },
        { name: 'Follow-up', type: 'invoice' }
      ],
      snippet: 'The staging bay #4 is allocated and ready...',
      body: 'Hi James,\\n\\nPlease find the confirmation for PO #87366.\\n\\nThe staging bay #4 is allocated and ready for shipment.\\n\\nTracking will be shared by tomorrow.\\n\\nThanks,\\nManoj',
      shipmentDetails: {
        poNumber: '87366',
        trackingNumber: 'DHL4567823',
        carrier: 'DHL Express',
        estimatedDelivery: 'Apr 24, 2026',
        status: 'In Transit',
        statusClass: 'status-transit',
        trackingUrl: 'shipment-tracking.html?tracking=DHL4567823'
      },
      signOff: 'Thank you,\\nJames Smith\\nAccount Manager\\nGlobal Parts Co.',
      attachments: [
        { name: 'Commercial_Invoice_87366.pdf', size: '245 KB', type: 'pdf' },
        { name: 'Packing_List_87366.xlsx', size: '128 KB', type: 'xls' }
      ],
      related: {
        poNumber: '#87366',
        vendor: 'Global Parts Co.',
        tracking: 'DHL4567823',
        estimatedDelivery: 'Apr 24, 2026',
        orderUrl: 'order-management/hold-redemption.html'
      }
    },
    {
      id: 'thread-2',
      senderName: 'Global Parts Co.',
      senderCompany: 'Global Parts Co.',
      senderEmail: 'orders@globalpartsco.com',
      to: 'supply.chain@mk97.com',
      cc: 'logistics@mk97.com',
      subject: 'Re: 3PL Order – Tracking Request',
      timestamp: '9:18 AM',
      fullDate: 'Mon, Apr 21, 2026 9:18 AM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'GP',
      avatarBg: '#dbeafe',
      avatarColor: '#1e40af',
      tags: [
        { name: 'Tracking', type: 'internal' },
        { name: 'Outbound', type: 'po' }
      ],
      snippet: 'Please provide the tracking number for...',
      body: 'Hello Support,\\n\\nPlease provide the tracking number for the outbound 3PL transfer consignment. Staging bays require registration before midday.\\n\\nThank you,\\nGlobal Parts Dispatch Team',
      attachments: [
        { name: 'Transfer_Manifest_3PL.pdf', size: '150 KB', type: 'pdf' }
      ],
      related: {
        poNumber: '#3PL-GP-918',
        vendor: 'Global Parts Co.',
        tracking: 'Pending Dispatch',
        estimatedDelivery: 'Apr 25, 2026',
        orderUrl: 'all-open-orders.html'
      }
    },
    {
      id: 'thread-3',
      senderName: 'Saint Vendor',
      senderCompany: 'Saint Vendor Solutions',
      senderEmail: 'orders@saintvendor.com',
      to: 'supply.chain@mk97.com',
      cc: '',
      subject: 'Order Confirmation – Gucci',
      timestamp: '8:05 AM',
      fullDate: 'Mon, Apr 21, 2026 8:05 AM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'SV',
      avatarBg: '#f3e8ff',
      avatarColor: '#7e22ce',
      tags: [
        { name: 'Confirmation', type: 'shipment' },
        { name: 'Customer', type: 'po' }
      ],
      snippet: 'Order confirmed. PO will be created shortly.',
      body: 'Good morning,\\n\\nOrder confirmed for the Gucci luxury boutique fulfillment consignment. PO will be created shortly and forwarded to your procurement desk.\\n\\nBest,\\nSaint Vendor Support',
      attachments: [],
      related: {
        poNumber: '#ORD-GUCCI-884',
        vendor: 'Saint Vendor Solutions',
        tracking: 'In Processing',
        estimatedDelivery: 'Apr 28, 2026',
        orderUrl: 'all-open-orders.html'
      }
    },
    {
      id: 'thread-4',
      senderName: 'Lighthouse Logistics',
      senderCompany: 'Lighthouse Logistics Hub',
      senderEmail: 'dispatch@lighthouselogistics.com',
      to: 'supply.chain@mk97.com',
      cc: '',
      subject: 'Delivery Availability Update',
      timestamp: 'Yesterday',
      fullDate: 'Sun, Apr 20, 2026 4:30 PM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'LL',
      avatarBg: '#ffedd5',
      avatarColor: '#c2410c',
      tags: [
        { name: 'Shipment', type: 'shipment' },
        { name: 'Inventory', type: 'po' }
      ],
      snippet: 'Items confirmed and ready to ship.',
      body: 'Hello Operations,\\n\\nDelivery availability update: All items confirmed and ready to ship from the regional consolidation yard. Freight booking ref is attached.',
      attachments: [
        { name: 'Availability_Manifest.xlsx', size: '210 KB', type: 'xls' }
      ],
      related: {
        poNumber: '#LL-AVAIL-402',
        vendor: 'Lighthouse Logistics',
        tracking: 'LL-FRT-992',
        estimatedDelivery: 'Apr 26, 2026',
        orderUrl: 'shipment-tracking.html'
      }
    },
    {
      id: 'thread-5',
      senderName: 'Aramex EU',
      senderCompany: 'Aramex Freight Europe',
      senderEmail: 'tracking@aramex.eu',
      to: 'supply.chain@mk97.com',
      cc: '',
      subject: 'Shipment Delivered – EU',
      timestamp: 'Yesterday',
      fullDate: 'Sun, Apr 20, 2026 2:15 PM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'AE',
      avatarBg: '#fee2e2',
      avatarColor: '#b91c1c',
      tags: [
        { name: 'Delivered', type: 'shipment' },
        { name: '3PL', type: 'internal' },
        { name: 'Customer', type: 'po' }
      ],
      snippet: 'Your shipment has been delivered successfully.',
      body: 'Your shipment has been delivered successfully to the European distribution hub in Rotterdam. Proof of delivery signature captured at dock 12.',
      attachments: [],
      related: {
        poNumber: '#EU-ARX-4421',
        vendor: 'Aramex EU',
        tracking: 'ARX-EU-88210',
        estimatedDelivery: 'Delivered',
        orderUrl: 'shipment-tracking.html'
      }
    },
    {
      id: 'thread-6',
      senderName: 'Vince Inc.',
      senderCompany: 'Vince Inc.',
      senderEmail: 'vince.support@vinceinc.com',
      to: 'supply.chain@mk97.com',
      cc: '',
      subject: '3PL Orders – Priority',
      timestamp: 'Yesterday',
      fullDate: 'Sun, Apr 20, 2026 11:45 AM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'VI',
      avatarBg: '#f3e8ff',
      avatarColor: '#7e22ce',
      tags: [],
      snippet: 'Please find the 3PL order file. Need tracking by EOD.',
      body: 'Hi Manoj,\\n\\nPlease find the 3PL order file attached. Need tracking by EOD to finalize customer dispatch slots.',
      attachments: [
        { name: '3PL_Priority_Orders.csv', size: '94 KB', type: 'csv' }
      ],
      related: {
        poNumber: '#VI-PRIORITY-91',
        vendor: 'Vince Inc.',
        tracking: 'Need EOD',
        estimatedDelivery: 'Apr 26, 2026',
        orderUrl: 'all-open-orders.html'
      }
    },
    {
      id: 'thread-7',
      senderName: 'Sarasota Warehouse',
      senderCompany: 'MK97 Sarasota DC',
      senderEmail: 'sarasota.dc@mk97.com',
      to: 'supply.chain@mk97.com',
      cc: '',
      subject: 'Daily Shipment Report',
      timestamp: 'Oct 21',
      fullDate: 'Tue, Oct 21, 2026 5:00 PM',
      unread: true,
      starred: true,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'SW',
      avatarBg: '#dbeafe',
      avatarColor: '#1d4ed8',
      tags: [
        { name: 'Report', type: 'po' },
        { name: 'Warehouse', type: 'po' }
      ],
      snippet: 'Daily shipment summary report for Sarasota fulfillment...',
      body: 'Attached is the daily shipment throughput and pallet staging audit report for Sarasota Facility A.',
      attachments: [
        { name: 'Sarasota_Daily_Shipment_Oct21.pdf', size: '420 KB', type: 'pdf' }
      ],
      related: {
        poNumber: 'RPT-SRQ-1021',
        vendor: 'Sarasota DC Hub',
        tracking: 'Daily Audit',
        estimatedDelivery: 'Completed',
        orderUrl: 'warehouse-management/index.html'
      }
    },
    {
      id: 'thread-8',
      senderName: 'Customer - Nordhstar',
      senderCompany: 'Nordhstar Automotive',
      senderEmail: 'procurement@nordhstar.com',
      to: 'supply.chain@mk97.com',
      cc: '',
      subject: 'Inventory Request',
      timestamp: 'Oct 21',
      fullDate: 'Tue, Oct 21, 2026 1:10 PM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'CN',
      avatarBg: '#ccfbf1',
      avatarColor: '#0f766e',
      tags: [
        { name: 'Inventory', type: 'shipment' },
        { name: 'Customer', type: 'po' }
      ],
      snippet: 'Can you check availability for model #2S6H9D...',
      body: 'Can you check availability for model #2S6H9D powertrain subassemblies? We are requesting 150 additional units for delivery next week.',
      attachments: [],
      related: {
        poNumber: 'ORD-NS-2S6H9D',
        vendor: 'Nordhstar Auto (Client)',
        tracking: 'Availability Check',
        estimatedDelivery: 'Oct 29, 2026',
        orderUrl: 'all-open-orders.html'
      }
    },
    {
      id: 'thread-9',
      senderName: 'Lux Lab',
      senderCompany: 'Lux Lab Supply Co.',
      senderEmail: 'dispatch@luxlab.com',
      to: 'supply.chain@mk97.com',
      cc: '',
      subject: 'Order Ready',
      timestamp: 'Oct 20',
      fullDate: 'Mon, Oct 20, 2026 4:15 PM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'LL',
      avatarBg: '#e2e8f0',
      avatarColor: '#475569',
      tags: [],
      snippet: 'Order is ready for pickup.',
      body: 'Order #LL-9921 is packed, weighed, and ready for carrier pickup at bay 2.',
      attachments: [],
      related: {
        poNumber: '#LL-9921',
        vendor: 'Lux Lab Supply Co.',
        tracking: 'Ready at Bay 2',
        estimatedDelivery: 'Oct 24, 2026',
        orderUrl: 'all-open-orders.html'
      }
    },
    {
      id: 'thread-10',
      senderName: 'Excello 3PL',
      senderCompany: 'Excello 3PL Logistics',
      senderEmail: 'receiving@excello3pl.com',
      to: 'supply.chain@mk97.com',
      cc: '',
      subject: 'Items received and putaway completed.',
      timestamp: 'Oct 20',
      fullDate: 'Mon, Oct 20, 2026 10:30 AM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'E3',
      avatarBg: '#f3e8ff',
      avatarColor: '#6b21a8',
      tags: [],
      snippet: 'Items received and putaway completed.',
      body: 'All pallet items for consignment EX-482 have been received and putaway is completed in warehouse zone C.',
      attachments: [],
      related: {
        poNumber: '#EX-482',
        vendor: 'Excello 3PL Logistics',
        tracking: 'Putaway Completed',
        estimatedDelivery: 'Completed',
        orderUrl: 'all-open-orders.html'
      }
    }
  ];`;

// Replace initialThreads block
content = content.replace(
  /\/\/\s*10 Detailed Threads matching the screenshot exactly[\s\S]*?let threads = \[\.\.\.initialThreads\];/,
  newInitialThreads + '\n\n  let threads = [...initialThreads];'
);

// 2. Add isComposeActive & composeState variables right after threads initialization
const stateVars = `  let isComposeActive = false;
  if (typeof window !== 'undefined' && window.location && window.location.search && (window.location.search.includes('compose=true') || window.location.search.includes('compose=1'))) {
    isComposeActive = true;
  }

  const composeState = {
    toRecipients: ['james.smith@globalpartsco.com'],
    ccRecipients: ['supply.chain@mk97.com', 'ops@mk97.com'],
    bccRecipients: [],
    showCc: true,
    showBcc: false,
    subject: 'PO #87366 - Confirmed for Shipment',
    body: 'Hi James,\\n\\nPlease find the confirmation for PO #87366.\\n\\nThe staging bay #4 is allocated and ready for shipment.\\n\\nTracking will be shared by tomorrow.\\n\\nThanks,\\nManoj'
  };`;

content = content.replace(
  /let threads = \[\.\.\.initialThreads\];/,
  'let threads = [...initialThreads];\n' + stateVars
);

// 3. Update getSidebarCounts() to match screenshot counts
const newSidebarCounts = `  function getSidebarCounts() {
    return {
      inbox: 24,
      starred: 5,
      snoozed: 3,
      sent: 0,
      drafts: 7,
      archive: 12,
      trash: 0,
      customers: 8,
      vendors: 6,
      orders: 10,
      shipping: 4,
      procurement: 3,
      '3pl': 2,
      internal: 8,
      unread: threads.filter(t => t.unread).length,
      flagged: threads.filter(t => t.flagged).length,
      attachments: threads.filter(t => t.attachments && t.attachments.length > 0).length,
      orderRelated: threads.filter(t => t.orderRelated).length
    };
  }`;

content = content.replace(/function getSidebarCounts\(\) \{[\s\S]*?\n  \}/, newSidebarCounts);

// 4. Update getFilteredThreads() to support new tabs and shared folders
const newGetFilteredThreads = `  function getFilteredThreads() {
    return threads.filter(t => {
      // Folder filtering
      if (activeFolder === 'inbox' && t.folder !== 'inbox') return false;
      if (activeFolder === 'starred' && !t.starred) return false;
      if (activeFolder === 'snoozed' && !(t.snoozed || t.folder === 'snoozed')) return false;
      if (activeFolder === 'sent' && t.folder !== 'sent' && t.direction !== 'outbound') return false;
      if (activeFolder === 'drafts' && t.folder !== 'drafts') return false;
      if (activeFolder === 'archive' && t.folder !== 'archive') return false;
      if (activeFolder === 'trash' && t.folder !== 'trash') return false;
      if (activeFolder === 'customers' && !(t.folder === 'customers' || isCustomer(t))) return false;
      if (activeFolder === 'vendors' && !(t.folder === 'vendors' || isVendor(t))) return false;
      if (activeFolder === 'orders' && !(t.folder === 'orders' || t.orderRelated)) return false;
      if (activeFolder === 'shipping' && !(t.folder === 'shipping' || isShipping(t))) return false;
      if (activeFolder === 'procurement' && !(t.folder === 'procurement' || isProcurement(t))) return false;
      if (activeFolder === '3pl' && !(t.folder === '3pl' || t.id === 'thread-2' || t.id === 'thread-5' || t.id === 'thread-6' || t.id === 'thread-10')) return false;
      if (activeFolder === 'internal' && !(t.folder === 'internal' || isInternal(t))) return false;
      if (activeFolder === 'unread' && !t.unread) return false;
      if (activeFolder === 'flagged' && !t.flagged) return false;
      if (activeFolder === 'attachments' && (!t.attachments || t.attachments.length === 0)) return false;
      if (activeFolder === 'orderRelated' && !(t.orderRelated && t.folder === 'inbox')) return false;

      // Tab filtering
      if (activeFilterTab === 'unread' && !t.unread) return false;
      if (activeFilterTab === 'starred' && !t.starred) return false;
      if (activeFilterTab === 'mentions' && !t.mentions) return false;
      if (activeFilterTab === 'attachments' && (!t.attachments || t.attachments.length === 0)) return false;
      if (activeFilterTab === 'orderRelated' && !t.orderRelated) return false;

      // Label filter
      if (labelFilter !== 'all') {
        const hasLabel = t.tags.some(tag => tag.name.toLowerCase() === labelFilter.toLowerCase());
        if (!hasLabel) return false;
      }

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          t.senderName.toLowerCase().includes(q) ||
          t.senderCompany.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.snippet.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q) ||
          t.tags.some(tag => tag.name.toLowerCase().includes(q)) ||
          (t.shipmentDetails?.poNumber && t.shipmentDetails.poNumber.includes(q)) ||
          (t.shipmentDetails?.trackingNumber && t.shipmentDetails.trackingNumber.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }`;

content = content.replace(/function getFilteredThreads\(\) \{[\s\S]*?\n  \}/, newGetFilteredThreads);

// 5. Update renderSidebar() to match screenshot exactly
const newRenderSidebar = `  function renderSidebar() {
    const c = getSidebarCounts();
    return \`
      <aside class="mail-col-sidebar" aria-label="Mailbox folders and categories">
        <button type="button" class="mail-compose-btn" id="btn-mail-compose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span>Compose</span>
        </button>

        <div class="mail-nav-section">
          <ul class="mail-nav-list" role="list">
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'inbox' ? 'active' : ''}" data-folder="inbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
                <span class="mail-nav-label">Inbox</span>
                <span class="mail-nav-count active-count">\${c.inbox}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'starred' ? 'active' : ''}" data-folder="starred">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span class="mail-nav-label">Starred</span>
                <span class="mail-nav-count">\${c.starred}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'snoozed' ? 'active' : ''}" data-folder="snoozed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span class="mail-nav-label">Snoozed</span>
                <span class="mail-nav-count">\${c.snoozed}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'sent' ? 'active' : ''}" data-folder="sent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                <span class="mail-nav-label">Sent</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'drafts' ? 'active' : ''}" data-folder="drafts">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="mail-nav-label">Drafts</span>
                <span class="mail-nav-count">\${c.drafts}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'archive' ? 'active' : ''}" data-folder="archive">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                <span class="mail-nav-label">Archive</span>
                <span class="mail-nav-count">\${c.archive}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'trash' ? 'active' : ''}" data-folder="trash">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span class="mail-nav-label">Trash</span>
              </button>
            </li>
          </ul>
        </div>

        <div class="mail-nav-section">
          <div class="mail-section-title" style="display:flex;justify-content:space-between;align-items:center;padding-right:4px;">
            <span>Shared Mailboxes</span>
            <button type="button" class="btn-add-shared" style="background:none;border:none;color:#64748b;font-size:16px;cursor:pointer;line-height:1;font-weight:700;" title="Add shared mailbox">+</button>
          </div>
          <ul class="mail-nav-list" role="list">
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'customers' ? 'active' : ''}" data-folder="customers">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#2563eb;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Customers</span>
                <span class="mail-nav-count">\${c.customers}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'vendors' ? 'active' : ''}" data-folder="vendors">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#8b5cf6;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Vendors</span>
                <span class="mail-nav-count">\${c.vendors}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'orders' ? 'active' : ''}" data-folder="orders">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#f97316;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Orders</span>
                <span class="mail-nav-count">\${c.orders}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'shipping' ? 'active' : ''}" data-folder="shipping">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Shipping</span>
                <span class="mail-nav-count">\${c.shipping}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'procurement' ? 'active' : ''}" data-folder="procurement">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Procurement</span>
                <span class="mail-nav-count">\${c.procurement}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === '3pl' ? 'active' : ''}" data-folder="3pl">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#6b7280;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">3PL Partners</span>
                <span class="mail-nav-count">\${c['3pl']}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item \${activeFolder === 'internal' ? 'active' : ''}" data-folder="internal">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#eab308;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Internal</span>
                <span class="mail-nav-count">\${c.internal}</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>
    \`;
  }`;

content = content.replace(/function renderSidebar\(\) \{[\s\S]*?<\/aside>\s*`;\s*\}/, newRenderSidebar);

// 6. Update renderThreadList()
const newRenderThreadList = `  function renderThreadList() {
    const list = getFilteredThreads();

    return \`
      <section class="mail-col-list" aria-label="Email conversation list">
        <div class="mail-list-header">
          <div class="mail-list-tabs" role="tablist">
            <button type="button" class="mail-list-tab \${activeFilterTab === 'all' ? 'active' : ''}" data-tab="all" role="tab" aria-selected="\${activeFilterTab === 'all'}">All</button>
            <button type="button" class="mail-list-tab \${activeFilterTab === 'unread' ? 'active' : ''}" data-tab="unread" role="tab" aria-selected="\${activeFilterTab === 'unread'}">Unread</button>
            <button type="button" class="mail-list-tab \${activeFilterTab === 'starred' ? 'active' : ''}" data-tab="starred" role="tab" aria-selected="\${activeFilterTab === 'starred'}">Starred</button>
            <button type="button" class="mail-list-tab \${activeFilterTab === 'mentions' ? 'active' : ''}" data-tab="mentions" role="tab" aria-selected="\${activeFilterTab === 'mentions'}">Mentions</button>
            <button type="button" class="mail-list-tab \${activeFilterTab === 'attachments' ? 'active' : ''}" data-tab="attachments" role="tab" aria-selected="\${activeFilterTab === 'attachments'}">Attachments</button>
          </div>
          <button type="button" class="mail-list-filter-btn" id="btn-toggle-filter" title="Filter" aria-label="Filter threads">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          </button>
        </div>
        <div class="mail-list-search-row">
          <div class="mail-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;color:#94a3b8;flex-shrink:0;">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input type="text" class="mail-list-search-input" id="stark-mail-search" placeholder="Search in mailbox..." value="\${esc(searchQuery)}">
            <button type="button" class="mail-filter-sliders-btn" id="btn-mail-sliders" title="Filter options">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="mail-thread-scroll" role="list">
          \${list.length === 0 ? \`
            <div class="mail-empty-state">
              <p>No emails found in this view.</p>
              <button type="button" class="sys-btn small" id="btn-reset-filters">Reset filters</button>
            </div>
          \` : list.map(item => \`
            <article class="mail-thread-item \${item.id === activeThreadId ? 'selected' : ''} \${item.unread ? 'is-unread' : ''}" data-thread-id="\${item.id}" tabindex="0" role="listitem">
              <div class="mail-thread-select-box">
                <input type="checkbox" class="thread-checkbox" data-thread-id="\${item.id}" onclick="event.stopPropagation()">
              </div>
              <div class="mail-avatar" style="background:\${item.avatarBg};color:\${item.avatarColor || '#ffffff'}">\${esc(item.avatar)}</div>

              <div class="mail-thread-main">
                <div class="mail-thread-top">
                  <strong class="mail-thread-sender">\${esc(item.senderName)}</strong>
                  <time class="mail-thread-time">\${esc(item.timestamp)}</time>
                </div>

                <div class="mail-thread-subject-row">
                  <h3 class="mail-thread-subject">\${esc(item.subject)}</h3>
                  <div class="mail-thread-icons">
                    \${item.attachments && item.attachments.length > 0 ? \`
                      <span class="mail-attach-icon" title="Attachments">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                      </span>
                    \` : ''}
                    <button type="button" class="mail-star-btn \${item.starred ? 'is-starred' : ''}" data-thread-id="\${item.id}" title="\${item.starred ? 'Unstar' : 'Star'}" onclick="event.stopPropagation()">
                      <svg viewBox="0 0 24 24" fill="\${item.starred ? '#eab308' : 'none'}" stroke="\${item.starred ? '#eab308' : '#94a3b8'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <p class="mail-thread-snippet">\${esc(item.snippet)}</p>

                \${item.tags && item.tags.length > 0 ? \`
                  <div class="mail-thread-badges">
                    \${item.tags.map(tag => \`<span class="mail-tag-pill tag-\${tag.type}">\${esc(tag.name)}</span>\`).join('')}
                  </div>
                \` : ''}
              </div>
            </article>
          \`).join('')}
        </div>
      </section>
    \`;
  }`;

content = content.replace(/function renderThreadList\(\) \{[\s\S]*?<\/section>\s*`;\s*\}/, newRenderThreadList);

// 7. Add renderComposePane() function before renderDetailView
const renderComposePaneCode = `  function renderComposePane() {
    return \`
      <section class="mail-compose-pane" aria-label="Compose Supply Chain Email">
        <!-- Header -->
        <div class="mail-compose-pane-head">
          <h2 class="mail-compose-title">Compose Supply Chain Email</h2>
          <div class="mail-compose-win-controls">
            <button type="button" class="mail-win-btn" id="btn-compose-min" title="Minimize">─</button>
            <button type="button" class="mail-win-btn" id="btn-compose-expand" title="Maximize">⤢</button>
            <button type="button" class="mail-win-btn" id="btn-compose-close" title="Close">✕</button>
          </div>
        </div>

        <!-- ERP Action Chips Bar -->
        <div class="mail-compose-chips-bar" role="toolbar" aria-label="ERP Quick Actions">
          <button type="button" class="compose-action-chip" data-action="order">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <span>Insert Order Data</span>
          </button>
          <button type="button" class="compose-action-chip" data-action="tracking">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <span>Insert Tracking</span>
          </button>
          <button type="button" class="compose-action-chip" data-action="invoice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            <span>Insert Invoice</span>
          </button>
          <button type="button" class="compose-action-chip" data-action="address">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Customer Address</span>
          </button>
          <button type="button" class="compose-action-chip" data-action="notes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>Insert Notes</span>
          </button>
        </div>

        <!-- Recipients & Subject -->
        <div class="mail-compose-fields">
          <!-- To -->
          <div class="compose-field-row">
            <span class="compose-field-lbl">To</span>
            <div class="compose-chips-wrap" id="compose-to-chips">
              \${composeState.toRecipients.map((rec, i) => \`
                <span class="compose-recipient-chip">
                  <span>\${esc(rec)}</span>
                  <button type="button" class="chip-remove" data-type="to" data-idx="\${i}" aria-label="Remove recipient">✕</button>
                </span>
              \`).join('')}
              <input type="text" class="compose-chip-input" id="pane-compose-to-input" placeholder="\${composeState.toRecipients.length === 0 ? 'Recipient email...' : ''}">
            </div>
            <div class="compose-field-actions">
              <button type="button" class="compose-toggle-btn" id="btn-toggle-cc">Cc</button>
              <button type="button" class="compose-toggle-btn" id="btn-toggle-bcc">Bcc</button>
            </div>
          </div>

          <!-- Cc -->
          <div class="compose-field-row" id="row-compose-cc" style="\${composeState.showCc ? '' : 'display:none;'}">
            <span class="compose-field-lbl">Cc</span>
            <div class="compose-chips-wrap" id="compose-cc-chips">
              \${composeState.ccRecipients.map((rec, i) => \`
                <span class="compose-recipient-chip">
                  <span>\${esc(rec)}</span>
                  <button type="button" class="chip-remove" data-type="cc" data-idx="\${i}" aria-label="Remove Cc">✕</button>
                </span>
              \`).join('')}
              <input type="text" class="compose-chip-input" id="pane-compose-cc-input" placeholder="\${composeState.ccRecipients.length === 0 ? 'Cc email...' : ''}">
            </div>
          </div>

          <!-- Bcc -->
          <div class="compose-field-row" id="row-compose-bcc" style="\${composeState.showBcc ? '' : 'display:none;'}">
            <span class="compose-field-lbl">Bcc</span>
            <div class="compose-chips-wrap" id="compose-bcc-chips">
              \${composeState.bccRecipients.map((rec, i) => \`
                <span class="compose-recipient-chip">
                  <span>\${esc(rec)}</span>
                  <button type="button" class="chip-remove" data-type="bcc" data-idx="\${i}" aria-label="Remove Bcc">✕</button>
                </span>
              \`).join('')}
              <input type="text" class="compose-chip-input" id="pane-compose-bcc-input" placeholder="\${composeState.bccRecipients.length === 0 ? 'Bcc email...' : ''}">
            </div>
          </div>

          <!-- Subject -->
          <div class="compose-field-row">
            <span class="compose-field-lbl">Subject</span>
            <input type="text" class="compose-subject-input" id="pane-compose-subject" value="\${esc(composeState.subject)}" placeholder="Email subject line...">
          </div>
        </div>

        <!-- Rich Toolbar -->
        <div class="mail-compose-toolbar" role="toolbar" aria-label="Formatting options">
          <select class="compose-format-select" id="pane-format-block" aria-label="Text format">
            <option value="p">Paragraph ▾</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
          <span class="toolbar-divider"></span>
          <button type="button" class="compose-toolbar-btn" data-cmd="bold" title="Bold"><b>B</b></button>
          <button type="button" class="compose-toolbar-btn" data-cmd="italic" title="Italic"><i>I</i></button>
          <button type="button" class="compose-toolbar-btn" data-cmd="underline" title="Underline"><u>U</u></button>
          <span class="toolbar-divider"></span>
          <button type="button" class="compose-toolbar-btn" data-cmd="insertUnorderedList" title="Bulleted list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          <button type="button" class="compose-toolbar-btn" data-cmd="insertOrderedList" title="Numbered list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
            </svg>
          </button>
          <button type="button" class="compose-toolbar-btn" data-cmd="strikeThrough" title="Strikethrough">
            <s>S</s>
          </button>
          <span class="toolbar-divider"></span>
          <button type="button" class="compose-toolbar-btn" data-cmd="createLink" title="Insert link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </button>
          <button type="button" class="compose-toolbar-btn" data-cmd="insertImage" title="Insert image">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <button type="button" class="compose-toolbar-btn" data-cmd="schedule" title="Schedule appointment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </button>
          <button type="button" class="compose-toolbar-btn" data-cmd="emoji" title="Insert emoji">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </button>
          <button type="button" class="compose-toolbar-btn" data-cmd="more" title="More options">•••</button>
        </div>

        <!-- Body Editor Area -->
        <div class="mail-compose-editor-wrap">
          <textarea class="mail-compose-textarea" id="pane-compose-body" placeholder="Write supply chain email or notes...">\${esc(composeState.body)}</textarea>
        </div>

        <!-- Footer Bar -->
        <div class="mail-compose-footer">
          <button type="button" class="compose-attach-btn" id="btn-pane-attach">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            <span>Attach files ▾</span>
          </button>

          <div class="compose-footer-right">
            <div class="compose-draft-status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
              </svg>
              <span>Draft saved at 10:24 AM</span>
            </div>
            <button type="button" class="compose-action-link-btn" id="btn-pane-schedule">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Schedule Send</span>
            </button>
            <button type="button" class="compose-action-link-btn" id="btn-pane-save-draft">Save Draft</button>
            <button type="button" class="compose-send-primary-btn" id="btn-pane-send-email">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
              </svg>
              <span>Send Email ▾</span>
            </button>
          </div>
        </div>
      </section>
    \`;
  }\n\n`;

content = content.replace(/function renderDetailView\(\) \{/, renderComposePaneCode + 'function renderDetailView() {');

// 8. Update renderApp() to render compose pane when isComposeActive
content = content.replace(
  /<div class="stark-mail-workspace">[\s\S]*?<\/div>\s*<\/div>\s*`;\s*bindEvents\(\);/,
  `<div class="stark-mail-workspace \${isComposeActive ? 'compose-active' : ''}">
          \${renderSidebar()}
          \${renderThreadList()}
          \${isComposeActive ? renderComposePane() : \`\${renderDetailView()}\${renderIntelPanel()}\`}
        </div>
      </div>
    \`;

    bindEvents();`
);

// 9. Update bindThreadClicks()
const newBindThreadClicks = `  function bindThreadClicks() {
    const root = document.getElementById('stark-mail-content');
    if (!root) return;

    root.querySelectorAll('.mail-thread-item').forEach(card => {
      card.onclick = () => {
        activeThreadId = card.dataset.threadId;
        const thread = getActiveThread();
        if (thread) thread.unread = false;
        if (isComposeActive) isComposeActive = false;
        updateView();
      };
    });

    root.querySelectorAll('.mail-star-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const tid = btn.dataset.threadId;
        const thread = threads.find(t => t.id === tid);
        if (thread) {
          thread.starred = !thread.starred;
          updateView();
          updateSidebarCounts();
          notice(thread.starred ? 'Conversation starred.' : 'Star removed.');
        }
      };
    });
  }`;

content = content.replace(/function bindThreadClicks\(\) \{[\s\S]*?\n  \}/, newBindThreadClicks);

// 10. Update compose button in bindEvents and add handlePaneSend logic
const composeWiring = `    // Compose button toggle
    const composeBtn = root.querySelector('#btn-mail-compose');
    if (composeBtn) {
      composeBtn.onclick = () => {
        isComposeActive = !isComposeActive;
        updateView();
      };
    }

    if (isComposeActive) {
      const closeBtn = root.querySelector('#btn-compose-close');
      if (closeBtn) {
        closeBtn.onclick = () => {
          isComposeActive = false;
          updateView();
        };
      }

      const minBtn = root.querySelector('#btn-compose-min');
      if (minBtn) {
        minBtn.onclick = () => {
          isComposeActive = false;
          updateView();
        };
      }

      // ERP Action Chips
      root.querySelectorAll('.compose-action-chip').forEach(chip => {
        chip.onclick = () => {
          const action = chip.dataset.action;
          const bodyEl = root.querySelector('#pane-compose-body');
          let textToInsert = '';
          if (action === 'order') {
            textToInsert = '\\n\\n[Order Details]\\nPO Number: #87366\\nLine Items: 450x Ceramic Brake Pad Consignment\\nStaging Bay: Bay #4 (Dock A)';
          } else if (action === 'tracking') {
            textToInsert = '\\n\\n[Tracking Telemetry]\\nCarrier: DHL Express\\nTracking Number: DHL4567823\\nStatus: In Transit (ETA: Apr 24, 2026)';
          } else if (action === 'invoice') {
            textToInsert = '\\n\\n[Commercial Invoice]\\nInvoice Number: INV-87366-C\\nAmount: $18,450.00 USD\\nPayment Terms: Net 30';
          } else if (action === 'address') {
            textToInsert = '\\n\\n[Shipping Destination]\\nGlobal Parts Co. Distribution Hub\\n1044 Logistics Pkwy, Suite B\\nTampa, FL 33602';
          } else if (action === 'notes') {
            textToInsert = '\\n\\n[Internal Operations Note]\\nConsignment cleared QA inspection at 09:30 AM. Ready for freight staging.';
          }
          if (bodyEl && textToInsert) {
            bodyEl.value += textToInsert;
            composeState.body = bodyEl.value;
            notice(\`Inserted \${chip.textContent.trim()}\`);
          }
        };
      });

      // Cc / Bcc toggles
      const btnToggleCc = root.querySelector('#btn-toggle-cc');
      if (btnToggleCc) {
        btnToggleCc.onclick = () => {
          composeState.showCc = !composeState.showCc;
          const ccRow = root.querySelector('#row-compose-cc');
          if (ccRow) ccRow.style.display = composeState.showCc ? '' : 'none';
        };
      }

      const btnToggleBcc = root.querySelector('#btn-toggle-bcc');
      if (btnToggleBcc) {
        btnToggleBcc.onclick = () => {
          composeState.showBcc = !composeState.showBcc;
          const bccRow = root.querySelector('#row-compose-bcc');
          if (bccRow) bccRow.style.display = composeState.showBcc ? '' : 'none';
        };
      }

      // Recipient chip removal
      root.querySelectorAll('.chip-remove').forEach(btn => {
        btn.onclick = () => {
          const type = btn.dataset.type;
          const idx = parseInt(btn.dataset.idx, 10);
          if (type === 'to') composeState.toRecipients.splice(idx, 1);
          else if (type === 'cc') composeState.ccRecipients.splice(idx, 1);
          else if (type === 'bcc') composeState.bccRecipients.splice(idx, 1);
          updateView();
        };
      });

      // Recipient chip add on Enter or comma
      const toInput = root.querySelector('#pane-compose-to-input');
      if (toInput) {
        toInput.onkeydown = e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = toInput.value.replace(/,/g, '').trim();
            if (val && !composeState.toRecipients.includes(val)) {
              composeState.toRecipients.push(val);
              updateView();
            }
          }
        };
      }

      const ccInput = root.querySelector('#pane-compose-cc-input');
      if (ccInput) {
        ccInput.onkeydown = e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = ccInput.value.replace(/,/g, '').trim();
            if (val && !composeState.ccRecipients.includes(val)) {
              composeState.ccRecipients.push(val);
              updateView();
            }
          }
        };
      }

      // Subject & Body state retention
      const subjInput = root.querySelector('#pane-compose-subject');
      if (subjInput) {
        subjInput.oninput = e => {
          composeState.subject = e.target.value;
        };
      }

      const bodyInput = root.querySelector('#pane-compose-body');
      if (bodyInput) {
        bodyInput.oninput = e => {
          composeState.body = e.target.value;
        };
      }

      // Toolbar buttons
      root.querySelectorAll('.compose-toolbar-btn').forEach(btn => {
        btn.onclick = () => {
          const cmd = btn.dataset.cmd;
          const textarea = root.querySelector('#pane-compose-body');
          if (!textarea) return;
          if (cmd === 'bold') {
            textarea.value += ' **bold text** ';
          } else if (cmd === 'italic') {
            textarea.value += ' *italic text* ';
          } else if (cmd === 'underline') {
            textarea.value += ' _underlined text_ ';
          } else if (cmd === 'insertUnorderedList') {
            textarea.value += '\\n• Item 1\\n• Item 2\\n';
          } else if (cmd === 'insertOrderedList') {
            textarea.value += '\\n1. First step\\n2. Second step\\n';
          } else if (cmd === 'strikeThrough') {
            textarea.value += ' ~~strikethrough~~ ';
          } else if (cmd === 'createLink') {
            textarea.value += ' [link text](https://mk97.com) ';
          } else if (cmd === 'insertImage') {
            notice('Insert Image: drag and drop image into composer.');
          } else if (cmd === 'schedule') {
            notice('Schedule: Select dispatch date/time slot.');
          } else if (cmd === 'emoji') {
            textarea.value += ' 📦 ';
          } else if (cmd === 'more') {
            notice('More options: Additional formatting options available.');
          }
          composeState.body = textarea.value;
        };
      });

      // Bottom bar actions
      const attachBtn = root.querySelector('#btn-pane-attach');
      if (attachBtn) {
        attachBtn.onclick = () => {
          notice('Attach files: PDF, XLSX, and CSV file attachments ready for upload.');
        };
      }

      const draftBtn = root.querySelector('#btn-pane-save-draft');
      if (draftBtn) {
        draftBtn.onclick = () => {
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const statusEl = root.querySelector('.compose-draft-status span');
          if (statusEl) statusEl.textContent = \`Draft saved at \${time}\`;
          notice(\`Draft saved at \${time}\`);
        };
      }

      const schedBtn = root.querySelector('#btn-pane-schedule');
      if (schedBtn) {
        schedBtn.onclick = () => {
          notice('Scheduled email: queued for tomorrow 09:00 AM dispatch.');
        };
      }

      // Send Email
      const sendEmailBtn = root.querySelector('#btn-pane-send-email');
      if (sendEmailBtn) {
        sendEmailBtn.onclick = async () => {
          const toInput = composeState.toRecipients.join(', ');
          const subjectInput = (root.querySelector('#pane-compose-subject')?.value || composeState.subject).trim();
          const bodyInput = (root.querySelector('#pane-compose-body')?.value || composeState.body).trim();

          if (!toInput) {
            notice('Please specify at least one recipient.');
            return;
          }
          if (!bodyInput) {
            notice('Please enter an email body.');
            return;
          }

          sendEmailBtn.disabled = true;
          sendEmailBtn.innerHTML = 'Sending...';

          try {
            const sb = getSupabase();
            if (sb && sb.functions) {
              try {
                await sb.functions.invoke('send-sandbox-email', {
                  body: {
                    to: toInput || 'manoj.k.manne@gmail.com',
                    subject: subjectInput || 'PO #87366 - Confirmed for Shipment',
                    body: bodyInput
                  }
                });
              } catch (fnErr) {
                console.warn('[MK97 Mail] Function invoke note:', fnErr);
              }
            }

            if (sb && sb.from) {
              try {
                await sb.from('emails').insert([{
                  sender_name: 'Manoj Manne',
                  sender_company: 'MK97 Supply Chain',
                  sender_email: 'supply.chain@mk97.com',
                  to_email: toInput || 'james.smith@globalpartsco.com',
                  subject: subjectInput,
                  body: bodyInput,
                  folder: 'sent',
                  unread: false
                }]);
              } catch (dbErr) {
                console.warn('[MK97 Mail] Database insert note:', dbErr);
              }
            }

            const newThread = {
              id: 'sent-' + Date.now(),
              senderName: 'Manoj Manne',
              senderCompany: 'MK97 Supply Chain',
              senderEmail: 'supply.chain@mk97.com',
              to: toInput,
              subject: subjectInput,
              timestamp: 'Just now',
              fullDate: new Date().toLocaleString(),
              unread: false,
              starred: false,
              flagged: false,
              folder: 'sent',
              category: 'all',
              avatar: 'MM',
              avatarBg: '#0f766e',
              tags: [{ name: 'Outbound', type: 'shipment' }],
              snippet: bodyInput.slice(0, 70) + '...',
              body: bodyInput
            };
            threads.unshift(newThread);

            notice(\`Email dispatched to \${toInput} successfully!\`);
            isComposeActive = false;
            activeThreadId = newThread.id;
            updateView();
          } catch (err) {
            console.error('[MK97 Mail] Send failed:', err);
            notice('Failed to dispatch email.');
          } finally {
            if (sendEmailBtn) {
              sendEmailBtn.disabled = false;
              sendEmailBtn.innerHTML = \`
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
                </svg>
                <span>Send Email ▾</span>
              \`;
            }
          }
        };
      }
    }`;

content = content.replace(
  /\/\/ Compose button[\s\S]*?composeBtn\.onclick = \(\) => \{\s*openComposeModal\(\);\s*\};\s*\}/,
  composeWiring
);

fs.writeFileSync(mailJsPath, content, 'utf8');
console.log('Successfully updated mail.js with Compose pane and Screenshot Thread Layout!');
