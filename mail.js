(function () {
  'use strict';

  const S = window.StarkSystem;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 10 Detailed Threads matching the screenshot exactly
  const initialThreads = [
    {
      id: 'thread-1',
      senderName: 'James Smith',
      senderCompany: 'Global Parts Co.',
      senderEmail: 'james.smith@globalpartsco.com',
      to: 'supply.chain@stark.com',
      cc: 'procurement@stark.com, logistics@stark.com',
      subject: 'PO #87366 - Confirmed for Shipment',
      timestamp: '10:24 AM',
      fullDate: 'Mon, Apr 21, 2026 10:24 AM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'JS',
      avatarBg: '#0f766e',
      tags: [
        { name: 'PO', type: 'po' },
        { name: 'Vendor', type: 'vendor' },
        { name: 'Shipment', type: 'shipment' }
      ],
      snippet: 'Hi team, we have confirmed the shipment for PO...',
      body: 'Hi team,\n\nWe have confirmed the shipment for PO #87366. The goods were picked up today and are in transit to your main warehouse. Please find the tracking details and commercial invoice attached below.',
      shipmentDetails: {
        poNumber: '87366',
        trackingNumber: 'DHL4567823',
        carrier: 'DHL Express',
        estimatedDelivery: 'Apr 24, 2026',
        status: 'In Transit',
        statusClass: 'status-transit',
        trackingUrl: 'shipment-tracking.html?tracking=DHL4567823'
      },
      signOff: 'Thank you,\nJames Smith\nAccount Manager\nGlobal Parts Co.',
      attachments: [
        { name: 'Commercial_Invoice_87366.pdf', size: '245 KB', type: 'pdf' },
        { name: 'Packing_List_87366.xlsx', size: '128 KB', type: 'xls' }
      ],
      related: {
        poNumber: '#87366-HOLD',
        vendor: 'Global Parts Co.',
        tracking: 'DHL4567823',
        estimatedDelivery: 'Apr 24, 2026',
        orderUrl: 'order-management/hold-redemption.html'
      }
    },
    {
      id: 'thread-2',
      senderName: 'Rachel Lee',
      senderCompany: 'Northstar Auto',
      senderEmail: 'rachel.lee@northstarauto.com',
      to: 'supply.chain@stark.com',
      cc: 'sales@stark.com',
      subject: 'Re: Inventory Availability - Brake Pads',
      timestamp: '9:41 AM',
      fullDate: 'Mon, Apr 21, 2026 9:41 AM',
      unread: false,
      starred: true,
      flagged: true,
      folder: 'inbox',
      category: 'urgent',
      mentions: true,
      orderRelated: true,
      avatar: 'RL',
      avatarBg: '#475569',
      tags: [
        { name: 'Customer', type: 'customer' },
        { name: 'Urgent', type: 'urgent' }
      ],
      snippet: 'Thanks for the quick update. Can you also share...',
      body: 'Thanks for the quick update. Can you also share the anticipated ATS availability for the upcoming production run of Ceramic Brake Pads? We need to reserve 450 units for our East Coast fulfillment hub before Thursday.\n\nPlease confirm if this can be fulfilled from Tampa DC or if a bin transfer from Texas is required.',
      signOff: 'Best regards,\nRachel Lee\nProcurement Specialist\nNorthstar Auto',
      attachments: [],
      related: {
        poNumber: '#ORD-NSA-9921',
        vendor: 'Northstar Auto (Client)',
        tracking: 'Pending Dispatch',
        estimatedDelivery: 'Apr 26, 2026',
        orderUrl: 'all-open-orders.html'
      }
    },
    {
      id: 'thread-3',
      senderName: 'DHL Transportation',
      senderCompany: 'DHL Logistics Hub',
      senderEmail: 'notifications@dhl.com',
      to: 'supply.chain@stark.com',
      cc: 'logistics@stark.com',
      subject: 'Shipment Delivered - Tracking #DHL4567823',
      timestamp: '8:17 AM',
      fullDate: 'Mon, Apr 21, 2026 8:17 AM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'DT',
      avatarBg: '#1e293b',
      tags: [
        { name: 'Shipment', type: 'shipment' }
      ],
      snippet: 'Your shipment has been delivered to Northstar...',
      body: 'Your freight consignment has been successfully delivered and signed for by Northstar Receiving Staging Bay 3 at 08:14 AM local time.\n\nCarrier reference: DHL Express Priority Ground. Electronic Proof of Delivery (e-POD) is available in the telemetry tracking ledger.',
      shipmentDetails: {
        poNumber: '87366',
        trackingNumber: 'DHL4567823',
        carrier: 'DHL Express',
        estimatedDelivery: 'Delivered (Apr 21, 2026)',
        status: 'Delivered',
        statusClass: 'status-delivered',
        trackingUrl: 'shipment-tracking.html?tracking=DHL4567823'
      },
      signOff: 'DHL Express Telematics Division',
      attachments: [],
      related: {
        poNumber: '#87366',
        vendor: 'DHL Express',
        tracking: 'DHL4567823',
        estimatedDelivery: 'Delivered Today',
        orderUrl: 'shipment-tracking.html?tracking=DHL4567823'
      }
    },
    {
      id: 'thread-4',
      senderName: 'Michael Khan',
      senderCompany: 'Stark Internal',
      senderEmail: 'm.khan@stark.com',
      to: 'supply.chain@stark.com',
      cc: 'executive@stark.com',
      subject: 'Q3 Procurement Plan - Review',
      timestamp: 'Yesterday',
      fullDate: 'Sun, Apr 20, 2026 4:15 PM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'internal',
      mentions: true,
      orderRelated: false,
      avatar: 'MK',
      avatarBg: '#1d4ed8',
      tags: [
        { name: 'Internal', type: 'internal' }
      ],
      snippet: 'Attaching the updated Q3 plan. Please review th...',
      body: 'Attaching the updated Q3 procurement and reorder balancing plan. We have calibrated demand projections taking into account lead-time variations from our key European component suppliers.\n\nPlease review before our weekly planning session tomorrow at 2:00 PM.',
      signOff: 'Michael Khan\nDirector of Supply Chain Planning\nStark Premium Operations',
      attachments: [
        { name: 'Stark_Q3_Procurement_Plan.pdf', size: '1.2 MB', type: 'pdf' }
      ],
      related: {
        poNumber: 'PLAN-Q3-2026',
        vendor: 'Stark Planning Dept',
        tracking: 'Internal Strategy',
        estimatedDelivery: 'Q3 Rollout',
        orderUrl: 'procurement-planning.html'
      }
    },
    {
      id: 'thread-5',
      senderName: 'Sarah Patel',
      senderCompany: 'AutoTech Supplies',
      senderEmail: 's.patel@autotechsupplies.com',
      to: 'supply.chain@stark.com',
      cc: 'procurement@stark.com',
      subject: 'Invoice INV-77821 Available',
      timestamp: 'Yesterday',
      fullDate: 'Sun, Apr 20, 2026 2:10 PM',
      unread: true,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'invoice',
      mentions: false,
      orderRelated: true,
      avatar: 'SP',
      avatarBg: '#059669',
      tags: [
        { name: 'Invoice', type: 'invoice' },
        { name: 'Vendor', type: 'vendor' }
      ],
      snippet: 'Please find the invoice for last week\'s shipment...',
      body: 'Please find the invoice for last week\'s shipment of precision motor sensors under PO #87210. Billed amount: $48,250.00 with standard payment terms 2/10 Net 30 as stipulated in the master supplier contract.',
      signOff: 'Thank you,\nSarah Patel\nAutoTech Supplies Billing Department',
      attachments: [
        { name: 'Invoice_INV-77821.pdf', size: '312 KB', type: 'pdf' }
      ],
      related: {
        poNumber: '#87210-INV',
        vendor: 'AutoTech Supplies',
        tracking: 'INV-77821',
        estimatedDelivery: 'Net 30 Due May 20',
        orderUrl: 'vendor-management/vendors.html'
      }
    },
    {
      id: 'thread-6',
      senderName: 'John Lewis',
      senderCompany: 'Parts Distribution',
      senderEmail: 'j.lewis@partsdist.com',
      to: 'supply.chain@stark.com',
      cc: '',
      subject: 'Re: Price Update Request',
      timestamp: 'Yesterday',
      fullDate: 'Sun, Apr 20, 2026 11:32 AM',
      unread: false,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: false,
      avatar: 'JL',
      avatarBg: '#64748b',
      tags: [
        { name: 'Pricing', type: 'pricing' }
      ],
      snippet: 'We can offer a revised price starting next month...',
      body: 'Following up on your request regarding bulk volume pricing for heavy-duty suspension assemblies. We can offer a revised rate of $214.50/unit for orders exceeding 500 units, effective May 1st.\n\nLet us know if you would like us to update your enterprise catalog listing accordingly.',
      signOff: 'Best regards,\nJohn Lewis\nVP of Wholesale\nParts Distribution Network',
      attachments: [],
      related: {
        poNumber: 'PRICE-CAT-2026',
        vendor: 'Parts Distribution',
        tracking: 'Tier 2 Wholesale',
        estimatedDelivery: 'Valid thru Q4',
        orderUrl: 'crm/catalog.html'
      }
    },
    {
      id: 'thread-7',
      senderName: 'Amazon Carrier',
      senderCompany: 'Amazon Freight Logistics',
      senderEmail: 'carrier-linehaul@amazonfreight.com',
      to: 'supply.chain@stark.com',
      cc: 'warehouse@stark.com',
      subject: 'In Transit - PO #87366',
      timestamp: 'Apr 18',
      fullDate: 'Fri, Apr 18, 2026 3:20 PM',
      unread: false,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'AC',
      avatarBg: '#374151',
      tags: [
        { name: 'Shipment', type: 'shipment' }
      ],
      snippet: 'Your shipment is in transit and expected to deliv...',
      body: 'Your shipment is in transit and expected to deliver on schedule. Carrier linehaul driver has checked into the regional transit corridor. Real-time GPS coordinates are streaming into the Stark Control Tower.',
      shipmentDetails: {
        poNumber: '87366',
        trackingNumber: 'AF-87366-22X',
        carrier: 'Amazon Freight',
        estimatedDelivery: 'Apr 24, 2026',
        status: 'In Transit',
        statusClass: 'status-transit',
        trackingUrl: 'shipment-tracking.html'
      },
      signOff: 'Amazon Freight Operations Center',
      attachments: [],
      related: {
        poNumber: '#87366',
        vendor: 'Amazon Freight',
        tracking: 'AF-87366-22X',
        estimatedDelivery: 'Apr 24, 2026',
        orderUrl: 'shipment-tracking.html'
      }
    },
    {
      id: 'thread-8',
      senderName: 'Emily Rodriguez',
      senderCompany: 'Northstar Auto',
      senderEmail: 'e.rodriguez@northstarauto.com',
      to: 'supply.chain@stark.com',
      cc: 'planning@stark.com',
      subject: 'New Order Forecast - Q3',
      timestamp: 'Apr 18',
      fullDate: 'Fri, Apr 18, 2026 11:05 AM',
      unread: true,
      starred: true,
      flagged: false,
      folder: 'inbox',
      category: 'forecast',
      mentions: false,
      orderRelated: false,
      avatar: 'ER',
      avatarBg: '#0284c7',
      tags: [
        { name: 'Forecast', type: 'forecast' }
      ],
      snippet: 'Sharing the forecast for Q3. Let\'s sync this week...',
      body: 'Sharing our replenishment demand forecast for Q3. We are projecting a 22% increase in regional EV powertrain components. Let\'s sync this week to lock down inventory buffers and delivery allocations.',
      signOff: 'Warm regards,\nEmily Rodriguez\nDemand Planning Lead\nNorthstar Auto',
      attachments: [
        { name: 'Northstar_Q3_Forecast_Model.xlsx', size: '540 KB', type: 'xls' }
      ],
      related: {
        poNumber: 'FC-NSA-Q3',
        vendor: 'Northstar Auto',
        tracking: 'Demand Model',
        estimatedDelivery: 'Q3 Buffer',
        orderUrl: 'sales-analysis.html'
      }
    },
    {
      id: 'thread-9',
      senderName: 'Tom Wilson',
      senderCompany: 'Stark Internal',
      senderEmail: 't.wilson@stark.com',
      to: 'supply.chain@stark.com',
      cc: '',
      subject: 'Re: Warehouse Capacity',
      timestamp: 'Apr 17',
      fullDate: 'Thu, Apr 17, 2026 5:40 PM',
      unread: false,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'internal',
      mentions: false,
      orderRelated: false,
      avatar: 'TW',
      avatarBg: '#7c3aed',
      tags: [
        { name: 'Internal', type: 'internal' }
      ],
      snippet: 'Current capacity is at 78%. We should be good fo...',
      body: 'Current capacity at Sarasota DC is at 78%, and Tampa DC is at 64%. We should be good for the incoming container deliveries scheduled for next Tuesday without needing overflow rack reconfiguration.',
      signOff: 'Tom Wilson\nWarehouse General Operations Manager',
      attachments: [],
      related: {
        poNumber: 'WMS-CAP-SRQ',
        vendor: 'Sarasota DC Hub',
        tracking: 'Bin Utilization 78%',
        estimatedDelivery: 'Normal Operations',
        orderUrl: 'warehouse-management/index.html'
      }
    },
    {
      id: 'thread-10',
      senderName: 'Linda Scott',
      senderCompany: 'Metro Supply',
      senderEmail: 'l.scott@metrosupply.com',
      to: 'supply.chain@stark.com',
      cc: '',
      subject: 'PO #88112 - Acknowledgement',
      timestamp: 'Apr 17',
      fullDate: 'Thu, Apr 17, 2026 10:15 AM',
      unread: false,
      starred: false,
      flagged: false,
      folder: 'inbox',
      category: 'all',
      mentions: false,
      orderRelated: true,
      avatar: 'LS',
      avatarBg: '#ea580c',
      tags: [
        { name: 'PO', type: 'po' },
        { name: 'Vendor', type: 'vendor' }
      ],
      snippet: 'Confirmed. We will process this order today...',
      body: 'Confirmed receipt of PO #88112. We have placed the units in staging and dispatch will proceed on schedule via carrier freight tomorrow morning.',
      signOff: 'Linda Scott\nMetro Supply Co.',
      attachments: [],
      related: {
        poNumber: '#88112',
        vendor: 'Metro Supply Co.',
        tracking: 'Scheduled Dispatch',
        estimatedDelivery: 'Apr 25, 2026',
        orderUrl: 'vendor-management/procurement.html'
      }
    }
  ];

  let threads = [...initialThreads];
  let activeThreadId = 'thread-1';
  let activeFilterTab = 'all'; // all, unread, mentions, orderRelated
  let activeFolder = 'inbox'; // inbox, starred, snoozed, sent, drafts, archive, trash, shared, vendor, customer, procurement, shipping, internal
  let searchQuery = '';
  let mailboxFilter = 'all';
  let labelFilter = 'all';
  let timeFilter = 'all';

  function notice(msg, error = false) {
    if (window.StarkSystemUI?.notice) {
      window.StarkSystemUI.notice(msg, error);
    } else {
      const toast = document.createElement('div');
      toast.className = 'system-toast' + (error ? ' error' : '');
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }
  }

  function getFilteredThreads() {
    return threads.filter(t => {
      // Folder filtering
      if (activeFolder === 'starred' && !t.starred) return false;
      if (activeFolder === 'unread' && !t.unread) return false;
      if (activeFolder === 'flagged' && !t.flagged) return false;
      if (activeFolder === 'attachments' && (!t.attachments || t.attachments.length === 0)) return false;
      if (activeFolder === 'orderRelated' && !t.orderRelated) return false;

      // Tab filtering
      if (activeFilterTab === 'unread' && !t.unread) return false;
      if (activeFilterTab === 'mentions' && !t.mentions) return false;
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
  }

  function getActiveThread() {
    return threads.find(t => t.id === activeThreadId) || threads[0];
  }

  function renderSubHeader() {
    return `
      <div class="stark-mail-subheader">
        <div class="stark-mail-brand">
          <div class="stark-mail-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              <path d="M2 13l4-2.5"/>
              <path d="M22 13l-4-2.5"/>
            </svg>
          </div>
          <div>
            <h1 class="stark-mail-title">STARK Mail</h1>
            <p class="stark-mail-subtitle">Enterprise email for supply chain operations</p>
          </div>
        </div>

        <div class="stark-mail-search-bar" role="search">
          <div class="stark-mail-search-input-wrap">
            <svg class="mail-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="search" id="stark-mail-search" placeholder="Search emails, senders, subjects or order numbers..." value="${esc(searchQuery)}" aria-label="Search emails">
            <button type="button" class="mail-filter-btn" id="btn-toggle-filters" title="Filter settings" aria-label="Filter settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
            </button>
          </div>

          <div class="stark-mail-filter-dropdowns">
            <select id="mail-sel-mailbox" aria-label="Mailbox filter">
              <option value="all" ${mailboxFilter === 'all' ? 'selected' : ''}>All mailboxes</option>
              <option value="supply" ${mailboxFilter === 'supply' ? 'selected' : ''}>supply.chain@stark.com</option>
              <option value="procurement" ${mailboxFilter === 'procurement' ? 'selected' : ''}>procurement@stark.com</option>
              <option value="logistics" ${mailboxFilter === 'logistics' ? 'selected' : ''}>logistics@stark.com</option>
            </select>

            <select id="mail-sel-folder" aria-label="Folder filter">
              <option value="all">All folders</option>
              <option value="inbox">Inbox</option>
              <option value="starred">Starred</option>
              <option value="snoozed">Snoozed</option>
              <option value="sent">Sent</option>
              <option value="drafts">Drafts</option>
              <option value="archive">Archive</option>
            </select>

            <select id="mail-sel-label" aria-label="Label filter">
              <option value="all" ${labelFilter === 'all' ? 'selected' : ''}>All labels</option>
              <option value="po" ${labelFilter === 'po' ? 'selected' : ''}>PO</option>
              <option value="vendor" ${labelFilter === 'vendor' ? 'selected' : ''}>Vendor</option>
              <option value="shipment" ${labelFilter === 'shipment' ? 'selected' : ''}>Shipment</option>
              <option value="customer" ${labelFilter === 'customer' ? 'selected' : ''}>Customer</option>
              <option value="invoice" ${labelFilter === 'invoice' ? 'selected' : ''}>Invoice</option>
              <option value="internal" ${labelFilter === 'internal' ? 'selected' : ''}>Internal</option>
              <option value="urgent" ${labelFilter === 'urgent' ? 'selected' : ''}>Urgent</option>
              <option value="forecast" ${labelFilter === 'forecast' ? 'selected' : ''}>Forecast</option>
            </select>

            <select id="mail-sel-time" aria-label="Time period filter">
              <option value="all">Any time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
        </div>

        <div class="stark-mail-header-actions">
          <button type="button" class="stark-mail-action-btn" id="btn-mail-templates">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            <span>Email templates</span>
          </button>
          <button type="button" class="stark-mail-action-btn" id="btn-mail-signatures">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
              <circle cx="11" cy="11" r="2"/>
            </svg>
            <span>Signatures</span>
          </button>
          <button type="button" class="stark-mail-action-btn" id="btn-mail-settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Mail settings</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderSidebar() {
    return `
      <aside class="mail-col-sidebar" aria-label="Mailbox folders and categories">
        <button type="button" class="mail-compose-btn" id="btn-mail-compose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Compose</span>
        </button>

        <div class="mail-nav-section">
          <div class="mail-section-title">MAILBOX</div>
          <div class="mail-account-badge">
            <span class="mail-account-avatar">SC</span>
            <span class="mail-account-email">supply.chain@stark.com</span>
            <span class="mail-caret">▾</span>
          </div>

          <ul class="mail-nav-list" role="list">
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'inbox' ? 'active' : ''}" data-folder="inbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
                <span class="mail-nav-label">Inbox</span>
                <span class="mail-nav-count active-count">12</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'starred' ? 'active' : ''}" data-folder="starred">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span class="mail-nav-label">Starred</span>
                <span class="mail-nav-count">4</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'snoozed' ? 'active' : ''}" data-folder="snoozed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span class="mail-nav-label">Snoozed</span>
                <span class="mail-nav-count">2</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'sent' ? 'active' : ''}" data-folder="sent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                <span class="mail-nav-label">Sent</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'drafts' ? 'active' : ''}" data-folder="drafts">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="mail-nav-label">Drafts</span>
                <span class="mail-nav-count">3</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'archive' ? 'active' : ''}" data-folder="archive">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                <span class="mail-nav-label">Archive</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'trash' ? 'active' : ''}" data-folder="trash">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span class="mail-nav-label">Trash</span>
              </button>
            </li>
          </ul>
        </div>

        <div class="mail-nav-section">
          <div class="mail-section-title">SHARED &amp; TEAM MAILBOXES</div>
          <ul class="mail-nav-list" role="list">
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'shared' ? 'active' : ''}" data-folder="shared">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span class="mail-nav-label">Shared Mailbox</span>
                <span class="mail-nav-count">8</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'vendor' ? 'active' : ''}" data-folder="vendor">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6"/>
                </svg>
                <span class="mail-nav-label">Vendor Communications</span>
                <span class="mail-nav-count">4</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'customer' ? 'active' : ''}" data-folder="customer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <span class="mail-nav-label">Customer Orders</span>
                <span class="mail-nav-count">6</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'procurement' ? 'active' : ''}" data-folder="procurement">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                <span class="mail-nav-label">Procurement</span>
                <span class="mail-nav-count">3</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'shipping' ? 'active' : ''}" data-folder="shipping">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
                <span class="mail-nav-label">Shipping Updates</span>
                <span class="mail-nav-count">5</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'internal' ? 'active' : ''}" data-folder="internal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <span class="mail-nav-label">Internal Ops</span>
                <span class="mail-nav-count">2</span>
              </button>
            </li>
          </ul>
        </div>

        <div class="mail-nav-section">
          <div class="mail-section-title">QUICK VIEWS</div>
          <ul class="mail-nav-list" role="list">
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'unread' ? 'active' : ''}" data-folder="unread">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <span class="mail-nav-label">Unread</span>
                <span class="mail-nav-count">12</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'flagged' ? 'active' : ''}" data-folder="flagged">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                <span class="mail-nav-label">Flagged</span>
                <span class="mail-nav-count">4</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'attachments' ? 'active' : ''}" data-folder="attachments">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                <span class="mail-nav-label">With Attachments</span>
                <span class="mail-nav-count">7</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'orderRelated' ? 'active' : ''}" data-folder="orderRelated">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
                </svg>
                <span class="mail-nav-label">Order Related</span>
                <span class="mail-nav-count">10</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>
    `;
  }

  function renderThreadList() {
    const list = getFilteredThreads();
    const unreadCount = threads.filter(t => t.unread).length;
    const mentionsCount = threads.filter(t => t.mentions).length;

    return `
      <section class="mail-col-list" aria-label="Email conversation list">
        <div class="mail-list-header">
          <div class="mail-list-tabs" role="tablist">
            <button type="button" class="mail-list-tab ${activeFilterTab === 'all' ? 'active' : ''}" data-tab="all" role="tab" aria-selected="${activeFilterTab === 'all'}">
              All Mail
            </button>
            <button type="button" class="mail-list-tab ${activeFilterTab === 'unread' ? 'active' : ''}" data-tab="unread" role="tab" aria-selected="${activeFilterTab === 'unread'}">
              Unread <span class="tab-pill-badge">${unreadCount}</span>
            </button>
            <button type="button" class="mail-list-tab ${activeFilterTab === 'mentions' ? 'active' : ''}" data-tab="mentions" role="tab" aria-selected="${activeFilterTab === 'mentions'}">
              Mentions <span class="tab-pill-badge red-pill">${mentionsCount}</span>
            </button>
            <button type="button" class="mail-list-tab ${activeFilterTab === 'orderRelated' ? 'active' : ''}" data-tab="orderRelated" role="tab" aria-selected="${activeFilterTab === 'orderRelated'}">
              Order Related
            </button>
          </div>
          <button type="button" class="mail-list-sort-btn" id="btn-toggle-sort" title="Sort threads" aria-label="Sort threads">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>
            </svg>
          </button>
        </div>

        <div class="mail-thread-scroll" role="list">
          ${list.length === 0 ? `
            <div class="mail-empty-state">
              <p>No emails found in this view.</p>
              <button type="button" class="sys-btn small" id="btn-reset-filters">Reset filters</button>
            </div>
          ` : list.map(item => `
            <article class="mail-thread-item ${item.id === activeThreadId ? 'selected' : ''} ${item.unread ? 'is-unread' : ''}" data-thread-id="${item.id}" tabindex="0" role="listitem">
              <div class="mail-thread-left">
                ${item.unread ? '<span class="unread-dot" title="Unread"></span>' : '<span class="unread-placeholder"></span>'}
                <div class="mail-avatar" style="background:${item.avatarBg}">${esc(item.avatar)}</div>
              </div>

              <div class="mail-thread-main">
                <div class="mail-thread-top">
                  <div class="mail-thread-sender-wrap">
                    <strong class="mail-thread-sender">${esc(item.senderName)}</strong>
                    <span class="mail-thread-company">${esc(item.senderCompany)}</span>
                  </div>
                  <time class="mail-thread-time">${esc(item.timestamp)}</time>
                </div>

                <h3 class="mail-thread-subject">${esc(item.subject)}</h3>
                <p class="mail-thread-snippet">${esc(item.snippet)}</p>

                <div class="mail-thread-badges">
                  ${item.tags.map(tag => `<span class="mail-tag-pill tag-${tag.type}">${esc(tag.name)}</span>`).join('')}
                  ${item.attachments && item.attachments.length > 0 ? `
                    <span class="mail-has-attach" title="${item.attachments.length} attachment(s)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </span>
                  ` : ''}
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderDetailView() {
    const thread = getActiveThread();
    if (!thread) {
      return `<section class="mail-col-detail mail-empty-detail"><p>Select an email to view details.</p></section>`;
    }

    return `
      <section class="mail-col-detail" aria-label="Email message reading pane">
        <!-- Top Toolbar -->
        <div class="mail-detail-toolbar" role="toolbar" aria-label="Email actions">
          <button type="button" class="mail-tool-btn" id="tool-reply">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
            </svg>
            <span>Reply</span>
          </button>
          <button type="button" class="mail-tool-btn" id="tool-reply-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="7 17 2 12 7 7"/><polyline points="12 17 7 12 12 7"/><path d="M22 18v-2a4 4 0 0 0-4-4H7"/>
            </svg>
            <span>Reply all</span>
          </button>
          <button type="button" class="mail-tool-btn" id="tool-forward">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>
            </svg>
            <span>Forward</span>
          </button>
          <span class="mail-toolbar-sep"></span>
          <button type="button" class="mail-tool-btn" id="tool-archive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            <span>Archive</span>
          </button>
          <button type="button" class="mail-tool-btn" id="tool-flag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            <span>Flag</span>
          </button>
          <button type="button" class="mail-tool-btn" id="tool-assign">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>
            </svg>
            <span>Assign</span>
          </button>
          <button type="button" class="mail-tool-btn" id="tool-move">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Move</span>
          </button>
          <button type="button" class="mail-tool-btn icon-only" id="tool-more" title="More options" aria-label="More options">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
          </button>
        </div>

        <div class="mail-detail-scroll">
          <!-- Subject & Tags Header -->
          <div class="mail-detail-head">
            <div class="mail-detail-title-row">
              <h2 class="mail-detail-subject">${esc(thread.subject)}</h2>
              <div class="mail-detail-tags">
                ${thread.tags.map(tag => `<span class="mail-tag-pill tag-${tag.type}">${esc(tag.name)}</span>`).join('')}
              </div>
              <button type="button" class="mail-star-btn ${thread.starred ? 'is-starred' : ''}" id="btn-toggle-star" title="Star this email" aria-label="Star this email">
                <svg viewBox="0 0 24 24" fill="${thread.starred ? '#f59e0b' : 'none'}" stroke="${thread.starred ? '#f59e0b' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            </div>

            <!-- Sender & Recipient Metadata -->
            <div class="mail-meta-row">
              <div class="mail-meta-avatar" style="background:${thread.avatarBg}">${esc(thread.avatar)}</div>
              <div class="mail-meta-info">
                <div class="mail-meta-sender-line">
                  <span class="mail-meta-sender-name">${esc(thread.senderName)}</span>
                  <span class="mail-meta-sender-email">&lt;${esc(thread.senderEmail)}&gt;</span>
                </div>
                <div class="mail-meta-recipients">
                  <span>To: ${esc(thread.to)}</span>
                  ${thread.cc ? `<span class="mail-meta-sep">·</span><span>Cc: ${esc(thread.cc)}</span>` : ''}
                </div>
              </div>
              <div class="mail-meta-time-actions">
                <time class="mail-meta-time">${esc(thread.fullDate)}</time>
                <div class="mail-meta-quick-actions">
                  <button type="button" class="mail-meta-btn" id="btn-quick-reply" title="Reply" aria-label="Quick reply">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                    </svg>
                  </button>
                  <button type="button" class="mail-meta-btn" id="btn-meta-more" title="More" aria-label="More message options">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Email Body Content -->
          <div class="mail-body-content">
            <p class="mail-body-text">${esc(thread.body).replace(/\n\n/g, '</p><p class="mail-body-text">').replace(/\n/g, '<br>')}</p>

            ${thread.shipmentDetails ? `
              <div class="mail-shipment-card">
                <div class="mail-shipment-head">
                  <h4>Shipment Details</h4>
                </div>
                <div class="mail-shipment-grid">
                  <div class="mail-shipment-item">
                    <span class="shipment-item-lbl">PO Number</span>
                    <strong class="shipment-item-val">${esc(thread.shipmentDetails.poNumber)}</strong>
                  </div>
                  <div class="mail-shipment-item">
                    <span class="shipment-item-lbl">Tracking Number</span>
                    <strong class="shipment-item-val">${esc(thread.shipmentDetails.trackingNumber)}</strong>
                  </div>
                  <div class="mail-shipment-item">
                    <span class="shipment-item-lbl">Carrier</span>
                    <strong class="shipment-item-val">${esc(thread.shipmentDetails.carrier)}</strong>
                  </div>
                  <div class="mail-shipment-item">
                    <span class="shipment-item-lbl">Estimated Delivery</span>
                    <strong class="shipment-item-val">${esc(thread.shipmentDetails.estimatedDelivery)}</strong>
                  </div>
                </div>
                <div class="mail-shipment-footer">
                  <span class="shipment-status-pill ${thread.shipmentDetails.statusClass}">
                    <span class="status-dot"></span> ${esc(thread.shipmentDetails.status)}
                  </span>
                  <a href="${S.url(thread.shipmentDetails.trackingUrl)}" class="shipment-track-link">Track Shipment ↗</a>
                </div>
              </div>
            ` : ''}

            <div class="mail-signoff">
              ${esc(thread.signOff).replace(/\n/g, '<br>')}
            </div>
          </div>

          <!-- Attachments Section -->
          ${thread.attachments && thread.attachments.length > 0 ? `
            <div class="mail-attachments-card">
              <div class="mail-attachments-header">
                <strong>${thread.attachments.length} Attachments</strong>
                <button type="button" class="mail-download-all-btn" id="btn-download-all">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span>Download all</span>
                </button>
              </div>

              <div class="mail-attachments-grid">
                ${thread.attachments.map(att => `
                  <div class="mail-attach-item" data-filename="${esc(att.name)}">
                    <span class="mail-attach-badge badge-${att.type}">${att.type.toUpperCase()}</span>
                    <div class="mail-attach-info">
                      <span class="mail-attach-name" title="${esc(att.name)}">${esc(att.name)}</span>
                      <small class="mail-attach-size">${esc(att.size)}</small>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Quick Reply Composer -->
          <div class="mail-composer-card">
            <div class="mail-composer-tabs">
              <button type="button" class="composer-tab active" data-type="reply">Reply</button>
              <button type="button" class="composer-tab" data-type="replyAll">Reply all</button>
              <button type="button" class="composer-tab" data-type="forward">Forward</button>
            </div>

            <div class="mail-composer-body">
              <textarea id="mail-reply-input" placeholder="Write a reply..." aria-label="Write email reply" rows="3"></textarea>
            </div>

            <div class="mail-composer-foot">
              <div class="mail-composer-tools">
                <button type="button" class="composer-tool-btn" title="Text formatting" aria-label="Text formatting">
                  <b>Aa</b>
                </button>
                <button type="button" class="composer-tool-btn" title="Attach file" aria-label="Attach file">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
                <button type="button" class="composer-tool-btn" title="Insert link" aria-label="Insert link">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </button>
                <button type="button" class="composer-tool-btn" title="Emoji" aria-label="Insert emoji">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                </button>
                <button type="button" class="composer-tool-btn" title="Insert image" aria-label="Insert image">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>
              </div>

              <div class="mail-composer-send-group">
                <button type="button" class="mail-send-btn" id="btn-send-reply">
                  <span>Send</span>
                  <span class="mail-send-arrow">▾</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderIntelPanel() {
    const thread = getActiveThread();
    const rel = thread?.related || {
      poNumber: '#87366-HOLD',
      vendor: 'Global Parts Co.',
      tracking: 'DHL4567823',
      estimatedDelivery: 'Apr 24, 2026',
      orderUrl: 'order-management/hold-redemption.html'
    };

    return `
      <aside class="mail-col-intel" aria-label="Supply chain related intelligence">
        <!-- Section: Related Information -->
        <div class="mail-intel-card">
          <div class="mail-intel-head">
            <div class="intel-head-left">
              <span class="intel-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </span>
              <h3>Related Information</h3>
            </div>
            <a href="${S.url(rel.orderUrl)}" class="intel-head-action">View in Order Management ↗</a>
          </div>

          <div class="mail-intel-body">
            <!-- Purchase Order Card -->
            <div class="intel-meta-item">
              <span class="intel-item-icon icon-po">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="10" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="14" y2="16"/>
                </svg>
              </span>
              <div class="intel-item-content">
                <small class="intel-item-lbl">Purchase Order</small>
                <span class="intel-item-val font-code">${esc(rel.poNumber)}</span>
              </div>
              <a href="${S.url(rel.orderUrl)}" class="intel-item-btn">Open</a>
            </div>

            <!-- Vendor Card -->
            <div class="intel-meta-item">
              <span class="intel-item-icon icon-vendor">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6"/>
                </svg>
              </span>
              <div class="intel-item-content">
                <small class="intel-item-lbl">Vendor</small>
                <span class="intel-item-val font-strong">${esc(rel.vendor)}</span>
              </div>
            </div>

            <!-- Tracking Number Card -->
            <div class="intel-meta-item">
              <span class="intel-item-icon icon-tracking">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </span>
              <div class="intel-item-content">
                <small class="intel-item-lbl">Tracking Number</small>
                <span class="intel-item-val font-code">${esc(rel.tracking)}</span>
              </div>
              <button type="button" class="intel-copy-btn" id="btn-copy-tracking" data-tracking="${esc(rel.tracking)}" title="Copy tracking number" aria-label="Copy tracking number">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>

            <!-- Estimated Delivery Card -->
            <div class="intel-meta-item">
              <span class="intel-item-icon icon-delivery">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </span>
              <div class="intel-item-content">
                <small class="intel-item-lbl">Estimated Delivery</small>
                <span class="intel-item-val font-strong">${esc(rel.estimatedDelivery)}</span>
              </div>
            </div>

            <div class="intel-quick-links">
              <a href="${S.url(rel.orderUrl)}" class="intel-link">› View full order details</a>
              <a href="${S.url('shipment-tracking.html?tracking=' + encodeURIComponent(rel.tracking))}" class="intel-link">↗ Track shipment</a>
            </div>
          </div>
        </div>

        <!-- Section: Quick Actions -->
        <div class="mail-intel-card">
          <div class="mail-intel-head">
            <div class="intel-head-left">
              <span class="intel-icon-badge icon-bolt">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </span>
              <h3>Quick Actions</h3>
            </div>
          </div>

          <div class="mail-intel-actions">
            <a href="${S.url('create-order.html')}" class="intel-action-row">
              <span class="action-row-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </span>
              <span class="action-row-text">Create new order</span>
              <span class="action-row-arrow">›</span>
            </a>

            <a href="${S.url('vendor-management/vendors.html')}" class="intel-action-row">
              <span class="action-row-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </span>
              <span class="action-row-text">Create vendor record</span>
              <span class="action-row-arrow">›</span>
            </a>

            <a href="${S.url('procurement-planning.html')}" class="intel-action-row">
              <span class="action-row-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </span>
              <span class="action-row-text">Add to procurement plan</span>
              <span class="action-row-arrow">›</span>
            </a>

            <button type="button" class="intel-action-row btn-action-row" id="btn-quick-reminder">
              <span class="action-row-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </span>
              <span class="action-row-text">Set follow-up reminder</span>
              <span class="action-row-arrow">›</span>
            </button>

            <button type="button" class="intel-action-row btn-action-row" id="btn-quick-share">
              <span class="action-row-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </span>
              <span class="action-row-text">Share email internally</span>
              <span class="action-row-arrow">›</span>
            </button>
          </div>
        </div>

        <!-- Section: Email Tags -->
        <div class="mail-intel-card">
          <div class="mail-intel-head">
            <div class="intel-head-left">
              <span class="intel-icon-badge icon-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
              </span>
              <h3>Email Tags</h3>
            </div>
            <button type="button" class="intel-head-action-btn" id="btn-manage-tags">Manage tags</button>
          </div>

          <div class="mail-intel-tags-body">
            <div class="intel-tags-cloud">
              <span class="mail-tag-pill tag-po">PO</span>
              <span class="mail-tag-pill tag-vendor">Vendor</span>
              <span class="mail-tag-pill tag-shipment">Shipment</span>
              <span class="mail-tag-pill tag-invoice">Invoice</span>
            </div>
            <button type="button" class="add-tag-btn" id="btn-add-tag">+ Add tag</button>
          </div>
        </div>
      </aside>
    `;
  }

  function renderComposeModal() {
    return `
      <div class="sys-modal-backdrop mail-compose-backdrop" id="compose-modal-backdrop">
        <div class="sys-modal mail-compose-dialog" role="dialog" aria-labelledby="compose-modal-title">
          <div class="sys-modal-head">
            <h3 id="compose-modal-title">New Supply Chain Email</h3>
            <button type="button" class="sys-modal-close" id="btn-close-compose" aria-label="Close dialog">✕</button>
          </div>
          <div class="sys-modal-body">
            <div class="sys-form">
              <label>To (Recipient)
                <input id="compose-to" type="email" placeholder="e.g. james.smith@globalpartsco.com" value="procurement@globalpartsco.com">
              </label>
              <label>Cc (Operations &amp; Logistics)
                <input id="compose-cc" type="text" placeholder="e.g. logistics@stark.com" value="supply.chain@stark.com">
              </label>
              <label>Subject / PO Reference
                <input id="compose-subject" type="text" placeholder="e.g. PO #87366 - Delivery Schedule Confirmation" value="PO #87366 - Warehouse Staging Confirmation">
              </label>
              <label>Message Content
                <textarea id="compose-body" rows="6" placeholder="Type your supply chain correspondence...">Hi team,

We have verified staging slot allocations for incoming PO #87366 at the Sarasota DC hub. Please ensure the BOL and packing slips are transmitted prior to transit departure.

Best regards,
Stark Supply Chain Operations</textarea>
              </label>
            </div>
          </div>
          <div class="sys-modal-foot">
            <button type="button" class="sys-btn" id="btn-cancel-compose">Cancel</button>
            <button type="button" class="sys-btn primary" id="btn-submit-compose">Send Email ↗</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderTemplatesModal() {
    return `
      <div class="sys-modal-backdrop" id="templates-modal-backdrop">
        <div class="sys-modal mail-templates-dialog" role="dialog" aria-labelledby="templates-modal-title">
          <div class="sys-modal-head">
            <h3 id="templates-modal-title">Supply Chain Email Templates</h3>
            <button type="button" class="sys-modal-close" id="btn-close-templates" aria-label="Close dialog">✕</button>
          </div>
          <div class="sys-modal-body">
            <div class="templates-list">
              <article class="template-card" data-template="po-confirm">
                <h4>PO Shipment Confirmation</h4>
                <p>Standard carrier confirmation request with tracking and invoice requirements.</p>
                <button type="button" class="sys-btn small primary template-use-btn" data-tmpl="1">Use Template</button>
              </article>
              <article class="template-card" data-template="inventory-rfq">
                <h4>Inventory ATS &amp; Buffer Request</h4>
                <p>Formal inquiry regarding available-to-sell volume, lead-time and reorder thresholds.</p>
                <button type="button" class="sys-btn small primary template-use-btn" data-tmpl="2">Use Template</button>
              </article>
              <article class="template-card" data-template="carrier-dispatch">
                <h4>Carrier Dispatch &amp; Telemetry Notice</h4>
                <p>Delivery staging coordinates and dock appointment schedule for linehaul freight.</p>
                <button type="button" class="sys-btn small primary template-use-btn" data-tmpl="3">Use Template</button>
              </article>
            </div>
          </div>
          <div class="sys-modal-foot">
            <button type="button" class="sys-btn" id="btn-cancel-templates">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    const root = document.getElementById('stark-mail-content');
    if (!root) return;

    // Search input
    const searchInput = root.querySelector('#stark-mail-search');
    if (searchInput) {
      searchInput.oninput = e => {
        searchQuery = e.target.value.trim();
        updateThreadList();
      };
    }

    // Filter dropdowns
    const selFolder = root.querySelector('#mail-sel-folder');
    if (selFolder) {
      selFolder.onchange = e => {
        activeFolder = e.target.value;
        updateView();
      };
    }

    const selLabel = root.querySelector('#mail-sel-label');
    if (selLabel) {
      selLabel.onchange = e => {
        labelFilter = e.target.value;
        updateThreadList();
      };
    }

    const selBox = root.querySelector('#mail-sel-mailbox');
    if (selBox) {
      selBox.onchange = e => {
        mailboxFilter = e.target.value;
        notice(`Filtered mailbox: ${selBox.options[selBox.selectedIndex].text}`);
      };
    }

    // Sidebar navigation buttons
    root.querySelectorAll('.mail-nav-item').forEach(btn => {
      btn.onclick = () => {
        activeFolder = btn.dataset.folder;
        root.querySelectorAll('.mail-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateThreadList();
      };
    });

    // List header tabs
    root.querySelectorAll('.mail-list-tab').forEach(tab => {
      tab.onclick = () => {
        activeFilterTab = tab.dataset.tab;
        root.querySelectorAll('.mail-list-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        updateThreadList();
      };
    });

    // Select thread
    bindThreadClicks();

    // Compose button
    const composeBtn = root.querySelector('#btn-mail-compose');
    if (composeBtn) {
      composeBtn.onclick = () => {
        openComposeModal();
      };
    }

    // Templates button
    const tmplBtn = root.querySelector('#btn-mail-templates');
    if (tmplBtn) {
      tmplBtn.onclick = () => {
        openTemplatesModal();
      };
    }

    // Signatures button
    const sigBtn = root.querySelector('#btn-mail-signatures');
    if (sigBtn) {
      sigBtn.onclick = () => {
        notice('Signatures manager: Stark Operations standard HTML signature is active.');
      };
    }

    // Settings button
    const setBtn = root.querySelector('#btn-mail-settings');
    if (setBtn) {
      setBtn.onclick = () => {
        notice('Mail settings: IMAP/SMTP supply chain mail gateway is connected.');
      };
    }

    // Star toggle button
    const starBtn = root.querySelector('#btn-toggle-star');
    if (starBtn) {
      starBtn.onclick = () => {
        const thread = getActiveThread();
        if (thread) {
          thread.starred = !thread.starred;
          updateView();
          notice(thread.starred ? 'Email starred.' : 'Email unstarred.');
        }
      };
    }

    // Reply Send button
    const sendReplyBtn = root.querySelector('#btn-send-reply');
    if (sendReplyBtn) {
      sendReplyBtn.onclick = () => {
        const replyInput = root.querySelector('#mail-reply-input');
        const text = replyInput?.value.trim();
        if (!text) {
          notice('Please enter a reply before sending.', true);
          return;
        }
        notice('Reply sent successfully to ' + getActiveThread().senderEmail);
        replyInput.value = '';
      };
    }

    // Download attachments
    const downloadAllBtn = root.querySelector('#btn-download-all');
    if (downloadAllBtn) {
      downloadAllBtn.onclick = () => {
        notice('Downloading attachments: Commercial_Invoice_87366.pdf & Packing_List_87366.xlsx');
      };
    }

    root.querySelectorAll('.mail-attach-item').forEach(item => {
      item.onclick = () => {
        notice('Downloading ' + item.dataset.filename);
      };
    });

    // Copy tracking number
    const copyTrackingBtn = root.querySelector('#btn-copy-tracking');
    if (copyTrackingBtn) {
      copyTrackingBtn.onclick = () => {
        const trk = copyTrackingBtn.dataset.tracking;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(trk);
        }
        notice(`Tracking number ${trk} copied to clipboard!`);
      };
    }

    // Quick reminder button
    const reminderBtn = root.querySelector('#btn-quick-reminder');
    if (reminderBtn) {
      reminderBtn.onclick = () => {
        notice('Follow-up reminder set for PO #87366 (tomorrow at 9:00 AM).');
      };
    }

    // Quick share button
    const shareBtn = root.querySelector('#btn-quick-share');
    if (shareBtn) {
      shareBtn.onclick = () => {
        notice('Email thread shared to #operations-channel on internal messaging.');
      };
    }

    // Add tag button
    const addTagBtn = root.querySelector('#btn-add-tag');
    if (addTagBtn) {
      addTagBtn.onclick = () => {
        const tag = prompt('Enter tag name (e.g. Expedite, Review, Compliance):');
        if (tag && tag.trim()) {
          const thread = getActiveThread();
          if (thread) {
            thread.tags.push({ name: tag.trim(), type: 'po' });
            updateView();
            notice(`Tag "${tag.trim()}" added to email.`);
          }
        }
      };
    }

    // Action toolbar buttons
    const replyToolBtn = root.querySelector('#tool-reply');
    if (replyToolBtn) {
      replyToolBtn.onclick = () => {
        const input = root.querySelector('#mail-reply-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth' });
        }
      };
    }

    const archiveToolBtn = root.querySelector('#tool-archive');
    if (archiveToolBtn) {
      archiveToolBtn.onclick = () => {
        const thread = getActiveThread();
        if (thread) {
          thread.folder = 'archive';
          notice('Conversation archived.');
          updateView();
        }
      };
    }

    const flagToolBtn = root.querySelector('#tool-flag');
    if (flagToolBtn) {
      flagToolBtn.onclick = () => {
        const thread = getActiveThread();
        if (thread) {
          thread.flagged = !thread.flagged;
          notice(thread.flagged ? 'Email flagged.' : 'Flag removed.');
          updateView();
        }
      };
    }
  }

  function bindThreadClicks() {
    const root = document.getElementById('stark-mail-content');
    if (!root) return;

    root.querySelectorAll('.mail-thread-item').forEach(card => {
      card.onclick = () => {
        activeThreadId = card.dataset.threadId;
        const thread = getActiveThread();
        if (thread) thread.unread = false;
        updateView();
      };
    });
  }

  function openComposeModal() {
    const modalEl = document.createElement('div');
    modalEl.innerHTML = renderComposeModal();
    document.body.appendChild(modalEl.firstElementChild);

    const backdrop = document.getElementById('compose-modal-backdrop');
    const closeBtn = document.getElementById('btn-close-compose');
    const cancelBtn = document.getElementById('btn-cancel-compose');
    const sendBtn = document.getElementById('btn-submit-compose');

    function close() {
      backdrop?.remove();
    }

    closeBtn.onclick = close;
    cancelBtn.onclick = close;
    sendBtn.onclick = () => {
      const to = document.getElementById('compose-to').value.trim();
      const subject = document.getElementById('compose-subject').value.trim();
      const body = document.getElementById('compose-body').value.trim();

      if (!to || !subject) {
        notice('Please fill in both recipient and subject.', true);
        return;
      }

      // Add as sent email
      threads.unshift({
        id: 'thread-' + Date.now(),
        senderName: 'You (Supply Chain)',
        senderCompany: 'Stark Premium Operations',
        senderEmail: 'supply.chain@stark.com',
        to,
        cc: 'procurement@stark.com',
        subject,
        timestamp: 'Just now',
        fullDate: new Date().toLocaleString(),
        unread: false,
        starred: false,
        flagged: false,
        folder: 'inbox',
        category: 'all',
        mentions: false,
        orderRelated: true,
        avatar: 'SC',
        avatarBg: '#0f766e',
        tags: [{ name: 'PO', type: 'po' }, { name: 'Shipment', type: 'shipment' }],
        snippet: body.slice(0, 45) + '...',
        body,
        signOff: 'Stark Premium Unified Operations',
        attachments: [],
        related: {
          poNumber: subject.match(/#\d+/)?.[0] || 'PO-NEW',
          vendor: 'Global Parts Co.',
          tracking: 'Pending Booking',
          estimatedDelivery: 'TBD',
          orderUrl: 'all-open-orders.html'
        }
      });

      close();
      activeThreadId = threads[0].id;
      updateView();
      notice('Email sent successfully to ' + to);
    };
  }

  function openTemplatesModal() {
    const modalEl = document.createElement('div');
    modalEl.innerHTML = renderTemplatesModal();
    document.body.appendChild(modalEl.firstElementChild);

    const backdrop = document.getElementById('templates-modal-backdrop');
    const closeBtn = document.getElementById('btn-close-templates');
    const cancelBtn = document.getElementById('btn-cancel-templates');

    function close() {
      backdrop?.remove();
    }

    closeBtn.onclick = close;
    cancelBtn.onclick = close;

    document.querySelectorAll('.template-use-btn').forEach(btn => {
      btn.onclick = () => {
        close();
        openComposeModal();
      };
    });
  }

  function updateThreadList() {
    const root = document.getElementById('stark-mail-content');
    if (!root) return;
    const listContainer = root.querySelector('.mail-col-list');
    if (listContainer) {
      listContainer.outerHTML = renderThreadList();
      bindThreadClicks();
    }
  }

  function updateView() {
    const root = document.getElementById('stark-mail-content');
    if (!root) return;
    renderApp();
  }

  function renderApp() {
    const root = document.getElementById('stark-mail-content');
    if (!root) return;

    root.innerHTML = `
      <div class="stark-mail-container">
        ${renderSubHeader()}
        <div class="stark-mail-workspace">
          ${renderSidebar()}
          ${renderThreadList()}
          ${renderDetailView()}
          ${renderIntelPanel()}
        </div>
      </div>
    `;

    bindEvents();
  }

  function init() {
    if (document.body.dataset.systemPage === 'mail' || document.getElementById('stark-mail-content')) {
      renderApp();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.StarkMail = {
    render: renderApp,
    getThreads: () => threads,
    selectThread: id => {
      activeThreadId = id;
      updateView();
    }
  };
})();
