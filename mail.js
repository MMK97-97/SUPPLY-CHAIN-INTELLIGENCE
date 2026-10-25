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
      body: 'Hi James,\n\nPlease find the confirmation for PO #87366.\n\nThe staging bay #4 is allocated and ready for shipment.\n\nTracking will be shared by tomorrow.\n\nThanks,\nManoj',
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
      body: 'Hello Support,\n\nPlease provide the tracking number for the outbound 3PL transfer consignment. Staging bays require registration before midday.\n\nThank you,\nGlobal Parts Dispatch Team',
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
      body: 'Good morning,\n\nOrder confirmed for the Gucci luxury boutique fulfillment consignment. PO will be created shortly and forwarded to your procurement desk.\n\nBest,\nSaint Vendor Support',
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
      body: 'Hello Operations,\n\nDelivery availability update: All items confirmed and ready to ship from the regional consolidation yard. Freight booking ref is attached.',
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
      body: 'Hi Manoj,\n\nPlease find the 3PL order file attached. Need tracking by EOD to finalize customer dispatch slots.',
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
  ];

  let threads = [...initialThreads];
  let isComposeActive = false;
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
    body: 'Hi James,\n\nPlease find the confirmation for PO #87366.\n\nThe staging bay #4 is allocated and ready for shipment.\n\nTracking will be shared by tomorrow.\n\nThanks,\nManoj'
  };
  let activeThreadId = 'thread-1';
  let activeFilterTab = 'all'; // all, unread, mentions, orderRelated
  let activeFolder = 'inbox'; // inbox, starred, snoozed, sent, drafts, archive, trash, shared, vendor, customer, procurement, shipping, internal
  let searchQuery = '';
  let mailboxFilter = 'all';
  let labelFilter = 'all';
  let timeFilter = 'all';

  // Category & Folder helpers
  const isInternal = t => t.id === 'thread-4' || t.id === 'thread-9';
  const isVendor = t => ['thread-1', 'thread-5', 'thread-6', 'thread-10'].includes(t.id);
  const isCustomer = t => ['thread-2', 'thread-8', 'thread-12', 'thread-cust-3', 'thread-cust-4', 'thread-cust-5'].includes(t.id);
  const isProcurement = t => ['thread-1', 'thread-4', 'thread-5'].includes(t.id);
  const isShipping = t => ['thread-3', 'thread-7', 'thread-11', 'thread-snoozed-1', 'thread-snoozed-2'].includes(t.id);
  const isShared = t => ['thread-1', 'thread-2', 'thread-3', 'thread-5', 'thread-6', 'thread-7', 'thread-8', 'thread-10'].includes(t.id);

    function getSidebarCounts() {
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
  }

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

  // --- Supabase Client & Environment Configuration ---
  function getSupabaseConfig() {
    const url = window.ENV?.SUPABASE_URL ||
                (window.MK97_SUPABASE_CONFIG?.url || window.STARK_SUPABASE_CONFIG?.url) ||
                'https://cbvkxqokqsuwywkpzvuq.supabase.co';
    const anonKey = window.ENV?.SUPABASE_ANON_KEY ||
                    window.ENV?.SUPABASE_PUBLISHABLE_KEY ||
                    (window.MK97_SUPABASE_CONFIG?.anonKey || window.STARK_SUPABASE_CONFIG?.anonKey) ||
                    (window.MK97_SUPABASE_CONFIG?.publishableKey || window.STARK_SUPABASE_CONFIG?.publishableKey) ||
                    'sb_publishable_N1k0kUllTRgzc0lWXYbopQ_LTUrswsT';
    return { url, anonKey };
  }

  let supabaseClient = null;
  function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase?.createClient) {
      const cfg = getSupabaseConfig();
      supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      return supabaseClient;
    }
    return null;
  }

  function mapEmailRecordToThread(row) {
    const isOutbound = String(row.direction || '').toLowerCase() === 'outbound';
    const senderName = row.sender_name || row.sender || (isOutbound ? 'You (Supply Chain)' : (row.from || 'External Partner'));
    const senderCompany = row.sender_company || (isOutbound ? 'MK97 Operations' : (row.company || 'Enterprise Partner'));
    const senderEmail = row.sender_email || (isOutbound ? 'supply.chain@mk97.com' : (row.from || 'partner@example.com'));
    const subject = row.subject || '(No Subject)';
    const body = row.body || row.content || row.text || '';
    const snippet = row.snippet || (body ? body.slice(0, 85) + (body.length > 85 ? '…' : '') : '(No content)');

    const dateObj = row.created_at ? new Date(row.created_at) : new Date();
    const isToday = dateObj.toDateString() === new Date().toDateString();
    const timestamp = !isNaN(dateObj.getTime())
      ? (isToday
          ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      : 'Just now';
    const fullDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('en-US') : 'Just now';

    const initials = senderName.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'EM';
    const avatarBg = isOutbound ? '#0f766e' : '#1e3a8a';

    const tags = Array.isArray(row.tags) ? row.tags : [];
    if (tags.length === 0) {
      tags.push({ name: isOutbound ? 'Outbound' : 'Inbound', type: isOutbound ? 'shipment' : 'vendor' });
      if (subject.includes('87366') || subject.includes('PO')) {
        tags.push({ name: 'PO #87366', type: 'po' });
      }
    }

    return {
      id: String(row.id || ('email-' + Math.random().toString(36).slice(2, 9))),
      senderName,
      senderCompany,
      senderEmail,
      to: row.to || row.recipient || row.recipient_email || 'your-github-email@example.com',
      cc: row.cc || '',
      subject,
      snippet,
      body,
      timestamp,
      fullDate,
      unread: row.unread !== undefined ? !!row.unread : false,
      starred: !!row.starred,
      flagged: !!row.flagged,
      folder: 'inbox',
      category: 'all',
      direction: row.direction || (isOutbound ? 'outbound' : 'inbound'),
      avatar: initials,
      avatarBg,
      tags,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      raw: row
    };
  }

  function updateSidebarCounts() {
    const root = document.getElementById('stark-mail-content');
    if (!root) return;
    const counts = getSidebarCounts();
    root.querySelectorAll('.mail-nav-item').forEach(btn => {
      const folder = btn.dataset.folder;
      const badge = btn.querySelector('.mail-nav-count');
      if (badge && counts[folder] !== undefined) {
        badge.textContent = counts[folder];
      }
    });
  }

  let mailRealtimeChannel = null;
  async function initReactiveMailFeed() {
    const sb = getSupabase();
    if (!sb) {
      console.warn('Supabase client unavailable for reactive mail feed.');
      return;
    }

    // 1. Initial live data fetch query pulling historical records from 'emails' table, ordered by 'created_at' descending
    try {
      const { data: dbEmails, error } = await sb
        .from('emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Historical emails query notice:', error.message);
      } else if (Array.isArray(dbEmails) && dbEmails.length > 0) {
        const mappedRecords = dbEmails.map(mapEmailRecordToThread);
        const existingIds = new Set(threads.map(t => t.id));
        const newRecords = mappedRecords.filter(r => !existingIds.has(r.id));
        if (newRecords.length > 0) {
          threads.unshift(...newRecords);
          updateThreadList();
          updateSidebarCounts();
        }
      }
    } catch (e) {
      console.warn('Error fetching historical emails:', e);
    }

    // 2. Real-time reactive subscription utilizing .channel().on('postgres_changes') for new 'INSERT' events
    try {
      if (mailRealtimeChannel) {
        sb.removeChannel(mailRealtimeChannel);
      }
      mailRealtimeChannel = sb
        .channel('public:emails:feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'emails' },
          payload => {
            console.log('Realtime email INSERT event received:', payload);
            if (payload && payload.new) {
              const newThread = mapEmailRecordToThread(payload.new);
              if (!threads.some(t => t.id === newThread.id)) {
                threads.unshift(newThread);
                updateThreadList();
                updateSidebarCounts();
                notice('New email received: ' + newThread.subject);
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Supabase Realtime subscribed to public:emails');
          }
        });
    } catch (subErr) {
      console.warn('Realtime subscription error:', subErr);
    }
  }

    function getFilteredThreads() {
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
            <h1 class="stark-mail-title">MK97 Mail</h1>
            <p class="stark-mail-subtitle">Manage supply-chain communication, forwarding, dispatch, and thread history.</p>
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
              <option value="supply" ${mailboxFilter === 'supply' ? 'selected' : ''}>supply.chain@mk97.com</option>
              <option value="procurement" ${mailboxFilter === 'procurement' ? 'selected' : ''}>procurement@mk97.com</option>
              <option value="logistics" ${mailboxFilter === 'logistics' ? 'selected' : ''}>logistics@mk97.com</option>
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
    const c = getSidebarCounts();
    return `
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
              <button type="button" class="mail-nav-item ${activeFolder === 'inbox' ? 'active' : ''}" data-folder="inbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
                <span class="mail-nav-label">Inbox</span>
                <span class="mail-nav-count active-count">${c.inbox}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'starred' ? 'active' : ''}" data-folder="starred">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span class="mail-nav-label">Starred</span>
                <span class="mail-nav-count">${c.starred}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'snoozed' ? 'active' : ''}" data-folder="snoozed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span class="mail-nav-label">Snoozed</span>
                <span class="mail-nav-count">${c.snoozed}</span>
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
                <span class="mail-nav-count">${c.drafts}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'archive' ? 'active' : ''}" data-folder="archive">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                <span class="mail-nav-label">Archive</span>
                <span class="mail-nav-count">${c.archive}</span>
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
          <div class="mail-section-title" style="display:flex;justify-content:space-between;align-items:center;padding-right:4px;">
            <span>Shared Mailboxes</span>
            <button type="button" class="btn-add-shared" style="background:none;border:none;color:#64748b;font-size:16px;cursor:pointer;line-height:1;font-weight:700;" title="Add shared mailbox">+</button>
          </div>
          <ul class="mail-nav-list" role="list">
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'customers' ? 'active' : ''}" data-folder="customers">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#2563eb;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Customers</span>
                <span class="mail-nav-count">${c.customers}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'vendors' ? 'active' : ''}" data-folder="vendors">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#8b5cf6;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Vendors</span>
                <span class="mail-nav-count">${c.vendors}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'orders' ? 'active' : ''}" data-folder="orders">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#f97316;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Orders</span>
                <span class="mail-nav-count">${c.orders}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'shipping' ? 'active' : ''}" data-folder="shipping">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Shipping</span>
                <span class="mail-nav-count">${c.shipping}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'procurement' ? 'active' : ''}" data-folder="procurement">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Procurement</span>
                <span class="mail-nav-count">${c.procurement}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === '3pl' ? 'active' : ''}" data-folder="3pl">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#6b7280;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">3PL Partners</span>
                <span class="mail-nav-count">${c['3pl']}</span>
              </button>
            </li>
            <li>
              <button type="button" class="mail-nav-item ${activeFolder === 'internal' ? 'active' : ''}" data-folder="internal">
                <span class="mail-shared-dot" style="width:8px;height:8px;border-radius:50%;background:#eab308;display:inline-block;margin-right:10px;"></span>
                <span class="mail-nav-label">Internal</span>
                <span class="mail-nav-count">${c.internal}</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>
    `;
  }

    function renderThreadList() {
    const list = getFilteredThreads();

    return `
      <section class="mail-col-list" aria-label="Email conversation list">
        <div class="mail-list-header">
          <div class="mail-list-tabs" role="tablist">
            <button type="button" class="mail-list-tab ${activeFilterTab === 'all' ? 'active' : ''}" data-tab="all" role="tab" aria-selected="${activeFilterTab === 'all'}">All</button>
            <button type="button" class="mail-list-tab ${activeFilterTab === 'unread' ? 'active' : ''}" data-tab="unread" role="tab" aria-selected="${activeFilterTab === 'unread'}">Unread</button>
            <button type="button" class="mail-list-tab ${activeFilterTab === 'starred' ? 'active' : ''}" data-tab="starred" role="tab" aria-selected="${activeFilterTab === 'starred'}">Starred</button>
            <button type="button" class="mail-list-tab ${activeFilterTab === 'mentions' ? 'active' : ''}" data-tab="mentions" role="tab" aria-selected="${activeFilterTab === 'mentions'}">Mentions</button>
            <button type="button" class="mail-list-tab ${activeFilterTab === 'attachments' ? 'active' : ''}" data-tab="attachments" role="tab" aria-selected="${activeFilterTab === 'attachments'}">Attachments</button>
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
            <input type="text" class="mail-list-search-input" id="stark-mail-search" placeholder="Search in mailbox..." value="${esc(searchQuery)}">
            <button type="button" class="mail-filter-sliders-btn" id="btn-mail-sliders" title="Filter options">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="mail-thread-scroll" role="list">
          ${list.length === 0 ? `
            <div class="mail-empty-state">
              <p>No emails found in this view.</p>
              <button type="button" class="sys-btn small" id="btn-reset-filters">Reset filters</button>
            </div>
          ` : list.map(item => `
            <article class="mail-thread-item ${item.id === activeThreadId ? 'selected' : ''} ${item.unread ? 'is-unread' : ''}" data-thread-id="${item.id}" tabindex="0" role="listitem">
              <div class="mail-thread-select-box">
                <input type="checkbox" class="thread-checkbox" data-thread-id="${item.id}" onclick="event.stopPropagation()">
              </div>
              <div class="mail-avatar" style="background:${item.avatarBg};color:${item.avatarColor || '#ffffff'}">${esc(item.avatar)}</div>

              <div class="mail-thread-main">
                <div class="mail-thread-top">
                  <strong class="mail-thread-sender">${esc(item.senderName)}</strong>
                  <time class="mail-thread-time">${esc(item.timestamp)}</time>
                </div>

                <div class="mail-thread-subject-row">
                  <h3 class="mail-thread-subject">${esc(item.subject)}</h3>
                  <div class="mail-thread-icons">
                    ${item.attachments && item.attachments.length > 0 ? `
                      <span class="mail-attach-icon" title="Attachments">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                      </span>
                    ` : ''}
                    <button type="button" class="mail-star-btn ${item.starred ? 'is-starred' : ''}" data-thread-id="${item.id}" title="${item.starred ? 'Unstar' : 'Star'}" onclick="event.stopPropagation()">
                      <svg viewBox="0 0 24 24" fill="${item.starred ? '#eab308' : 'none'}" stroke="${item.starred ? '#eab308' : '#94a3b8'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <p class="mail-thread-snippet">${esc(item.snippet)}</p>

                ${item.tags && item.tags.length > 0 ? `
                  <div class="mail-thread-badges">
                    ${item.tags.map(tag => `<span class="mail-tag-pill tag-${tag.type}">${esc(tag.name)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

    function renderComposePane() {
    return `
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
              ${composeState.toRecipients.map((rec, i) => `
                <span class="compose-recipient-chip">
                  <span>${esc(rec)}</span>
                  <button type="button" class="chip-remove" data-type="to" data-idx="${i}" aria-label="Remove recipient">✕</button>
                </span>
              `).join('')}
              <input type="text" class="compose-chip-input" id="pane-compose-to-input" placeholder="${composeState.toRecipients.length === 0 ? 'Recipient email...' : ''}">
            </div>
            <div class="compose-field-actions">
              <button type="button" class="compose-toggle-btn" id="btn-toggle-cc">Cc</button>
              <button type="button" class="compose-toggle-btn" id="btn-toggle-bcc">Bcc</button>
            </div>
          </div>

          <!-- Cc -->
          <div class="compose-field-row" id="row-compose-cc" style="${composeState.showCc ? '' : 'display:none;'}">
            <span class="compose-field-lbl">Cc</span>
            <div class="compose-chips-wrap" id="compose-cc-chips">
              ${composeState.ccRecipients.map((rec, i) => `
                <span class="compose-recipient-chip">
                  <span>${esc(rec)}</span>
                  <button type="button" class="chip-remove" data-type="cc" data-idx="${i}" aria-label="Remove Cc">✕</button>
                </span>
              `).join('')}
              <input type="text" class="compose-chip-input" id="pane-compose-cc-input" placeholder="${composeState.ccRecipients.length === 0 ? 'Cc email...' : ''}">
            </div>
          </div>

          <!-- Bcc -->
          <div class="compose-field-row" id="row-compose-bcc" style="${composeState.showBcc ? '' : 'display:none;'}">
            <span class="compose-field-lbl">Bcc</span>
            <div class="compose-chips-wrap" id="compose-bcc-chips">
              ${composeState.bccRecipients.map((rec, i) => `
                <span class="compose-recipient-chip">
                  <span>${esc(rec)}</span>
                  <button type="button" class="chip-remove" data-type="bcc" data-idx="${i}" aria-label="Remove Bcc">✕</button>
                </span>
              `).join('')}
              <input type="text" class="compose-chip-input" id="pane-compose-bcc-input" placeholder="${composeState.bccRecipients.length === 0 ? 'Bcc email...' : ''}">
            </div>
          </div>

          <!-- Subject -->
          <div class="compose-field-row">
            <span class="compose-field-lbl">Subject</span>
            <input type="text" class="compose-subject-input" id="pane-compose-subject" value="${esc(composeState.subject)}" placeholder="Email subject line...">
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
          <textarea class="mail-compose-textarea" id="pane-compose-body" placeholder="Write supply chain email or notes...">${esc(composeState.body)}</textarea>
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
          <button type="button" class="mail-tool-btn ${thread.flagged ? 'active is-flagged' : ''}" id="tool-flag" style="${thread.flagged ? 'color:#d97706;background:#fef3c7;border-color:#fde68a;' : ''}">
            <svg viewBox="0 0 24 24" fill="${thread.flagged ? '#d97706' : 'none'}" stroke="${thread.flagged ? '#d97706' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            <span>${thread.flagged ? 'Flagged' : 'Flag'}</span>
          </button>
          <button type="button" class="mail-tool-btn ${thread.assignedTo ? 'active is-assigned' : ''}" id="tool-assign" style="${thread.assignedTo ? 'color:#0284c7;background:#e0f2fe;border-color:#bae6fd;' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>
            </svg>
            <span>${thread.assignedTo ? esc(thread.assignedTo.name.split(' ')[0]) : 'Assign'}</span>
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

  function renderComposeModal(opts = {}) {
    const thread = opts.thread;
    const isForward = opts.mode === 'forward';
    const title = opts.title || (isForward ? 'Forward Supply Chain Email' : 'New Supply Chain Email');
    const toVal = isForward ? '' : (opts.to !== undefined ? opts.to : 'procurement@globalpartsco.com');
    const ccVal = opts.cc !== undefined ? opts.cc : 'supply.chain@mk97.com';
    const subjectVal = isForward && thread
      ? `Fwd: ${thread.subject}`
      : (opts.subject !== undefined ? opts.subject : 'PO #87366 - Warehouse Staging Confirmation');
    const defaultForwardBody = thread
      ? `\n\n---------- Forwarded message ---------\nFrom: ${thread.senderName} <${thread.senderEmail}>\nDate: ${thread.fullDate || thread.timestamp}\nSubject: ${thread.subject}\nTo: ${thread.to || ''}\n\n${thread.body}`
      : '';
    const bodyVal = isForward
      ? defaultForwardBody
      : (opts.body !== undefined ? opts.body : `Hi team,\n\nWe have verified staging slot allocations for incoming PO #87366 at the Sarasota DC hub. Please ensure the BOL and packing slips are transmitted prior to transit departure.\n\nBest regards,\nMK97 Supply Chain Operations`);

    return `
      <div class="sys-modal-backdrop mail-compose-backdrop" id="compose-modal-backdrop">
        <div class="sys-modal mail-compose-dialog" role="dialog" aria-labelledby="compose-modal-title">
          <div class="sys-modal-head">
            <h3 id="compose-modal-title">${esc(title)}</h3>
            <button type="button" class="sys-modal-close" id="btn-close-compose" aria-label="Close dialog">✕</button>
          </div>
          <div class="sys-modal-body">
            <div class="sys-form">
              <label>To (Recipient)
                <input id="compose-to" type="email" placeholder="e.g. james.smith@globalpartsco.com" value="${esc(toVal)}">
              </label>
              <label>Cc (Operations &amp; Logistics)
                <input id="compose-cc" type="text" placeholder="e.g. logistics@mk97.com" value="${esc(ccVal)}">
              </label>
              <label>Subject / PO Reference
                <input id="compose-subject" type="text" placeholder="e.g. PO #87366 - Delivery Schedule Confirmation" value="${esc(subjectVal)}">
              </label>
              <label>Message Content
                <textarea id="compose-body" rows="6" placeholder="Type your supply chain correspondence...">${esc(bodyVal)}</textarea>
              </label>
            </div>
          </div>
          <div class="sys-modal-foot">
            <button type="button" class="sys-btn" id="btn-cancel-compose">Cancel</button>
            <button type="button" class="sys-btn primary" id="btn-submit-compose">${isForward ? 'Forward Email ↗' : 'Send Email ↗'}</button>
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

  function renderAssignModal(thread) {
    const teamMembers = [
      { name: "Elena Rostova", role: "Logistics Operations Lead", email: "elena.rostova@mk97.com", avatar: "ER", color: "#0f766e" },
      { name: "Marcus Vance", role: "Senior Procurement Specialist", email: "marcus.vance@mk97.com", avatar: "MV", color: "#1e40af" },
      { name: "Sarah Jenkins", role: "Quality Control & Compliance", email: "sarah.j@mk97.com", avatar: "SJ", color: "#7c2d12" },
      { name: "David Kim", role: "Warehouse Bay & Dock Dispatch", email: "david.k@mk97.com", avatar: "DK", color: "#166534" },
      { name: "Manoj Manne", role: "Supply Chain Administrator", email: "manoj.k.manne@gmail.com", avatar: "MM", color: "#0284c7" }
    ];

    return `
      <div class="sys-modal-backdrop" id="assign-modal-backdrop">
        <div class="sys-modal" style="max-width:520px;" role="dialog" aria-labelledby="assign-modal-title">
          <div class="sys-modal-head">
            <h3 id="assign-modal-title">Assign Conversation</h3>
            <button type="button" class="sys-modal-close" id="btn-close-assign" aria-label="Close dialog">✕</button>
          </div>
          <div class="sys-modal-body">
            <p style="margin:0 0 12px 0;font-size:13px;color:#64748b;">
              Assign <strong>${esc(thread.subject)}</strong> to an operations team member or workflow specialist:
            </p>
            <div class="assign-list" style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;padding-right:4px;">
              ${teamMembers.map((m, idx) => `
                <div class="assign-item" data-name="${esc(m.name)}" data-email="${esc(m.email)}" data-role="${esc(m.role)}" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.15s ease;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="width:34px;height:34px;border-radius:50%;background:${m.color};color:#ffffff;display:inline-grid;place-content:center;font-weight:700;font-size:12px;">${m.avatar}</span>
                    <div>
                      <div style="font-weight:600;font-size:13.5px;color:#0f172a;">${esc(m.name)}</div>
                      <div style="font-size:12px;color:#64748b;">${esc(m.role)} · ${esc(m.email)}</div>
                    </div>
                  </div>
                  <button type="button" class="sys-btn small primary btn-select-assignee" data-index="${idx}">Assign</button>
                </div>
              `).join('')}
            </div>
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
              <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">Or Assign to Custom Email:</label>
              <div style="display:flex;gap:8px;">
                <input type="email" id="custom-assign-email" placeholder="e.g. specialist@mk97.com" style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                <button type="button" class="sys-btn primary" id="btn-custom-assign">Assign</button>
              </div>
            </div>
          </div>
          <div class="sys-modal-foot">
            <button type="button" class="sys-btn" id="btn-cancel-assign">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderMoveModal(thread) {
    const folders = [
      { id: "inbox", name: "Inbox", icon: "📥", desc: "Main incoming operations correspondence" },
      { id: "archive", name: "Archive", icon: "📦", desc: "Completed orders and historical threads" },
      { id: "sent", name: "Sent", icon: "📤", desc: "Transmitted outbound emails" },
      { id: "drafts", name: "Drafts", icon: "📝", desc: "Unsent compositions and templates" },
      { id: "trash", name: "Trash", icon: "🗑️", desc: "Discarded and deleted messages" }
    ];

    return `
      <div class="sys-modal-backdrop" id="move-modal-backdrop">
        <div class="sys-modal" style="max-width:460px;" role="dialog" aria-labelledby="move-modal-title">
          <div class="sys-modal-head">
            <h3 id="move-modal-title">Move Conversation</h3>
            <button type="button" class="sys-modal-close" id="btn-close-move" aria-label="Close dialog">✕</button>
          </div>
          <div class="sys-modal-body">
            <p style="margin:0 0 12px 0;font-size:13px;color:#64748b;">
              Select destination folder for <strong>${esc(thread.subject)}</strong>:
            </p>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${folders.map(f => `
                <div class="move-folder-option" data-folder="${f.id}" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${thread.folder === f.id ? '#eff6ff' : '#f8fafc'};border:1px solid ${thread.folder === f.id ? '#3b82f6' : '#e2e8f0'};border-radius:8px;cursor:pointer;transition:all 0.15s ease;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:18px;">${f.icon}</span>
                    <div>
                      <strong style="font-size:13.5px;color:#0f172a;">${f.name}</strong>
                      <div style="font-size:12px;color:#64748b;">${f.desc}</div>
                    </div>
                  </div>
                  ${thread.folder === f.id ? '<span style="font-size:11px;font-weight:700;color:#2563eb;background:#dbeafe;padding:3px 8px;border-radius:12px;">Current</span>' : '<button type="button" class="sys-btn small">Move here</button>'}
                </div>
              `).join('')}
            </div>
          </div>
          <div class="sys-modal-foot">
            <button type="button" class="sys-btn" id="btn-cancel-move">Cancel</button>
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
        const filtered = getFilteredThreads();
        if (filtered.length > 0 && !filtered.some(t => t.id === activeThreadId)) {
          activeThreadId = filtered[0].id;
        }
        updateView();
      };
    });

    // Reset filters button
    const resetFiltersBtn = root.querySelector('#btn-reset-filters');
    if (resetFiltersBtn) {
      resetFiltersBtn.onclick = () => {
        activeFolder = 'inbox';
        activeFilterTab = 'all';
        searchQuery = '';
        labelFilter = 'all';
        mailboxFilter = 'all';
        updateView();
      };
    }

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

        // Compose button toggle
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
            textToInsert = '\n\n[Order Details]\nPO Number: #87366\nLine Items: 450x Ceramic Brake Pad Consignment\nStaging Bay: Bay #4 (Dock A)';
          } else if (action === 'tracking') {
            textToInsert = '\n\n[Tracking Telemetry]\nCarrier: DHL Express\nTracking Number: DHL4567823\nStatus: In Transit (ETA: Apr 24, 2026)';
          } else if (action === 'invoice') {
            textToInsert = '\n\n[Commercial Invoice]\nInvoice Number: INV-87366-C\nAmount: $18,450.00 USD\nPayment Terms: Net 30';
          } else if (action === 'address') {
            textToInsert = '\n\n[Shipping Destination]\nGlobal Parts Co. Distribution Hub\n1044 Logistics Pkwy, Suite B\nTampa, FL 33602';
          } else if (action === 'notes') {
            textToInsert = '\n\n[Internal Operations Note]\nConsignment cleared QA inspection at 09:30 AM. Ready for freight staging.';
          }
          if (bodyEl && textToInsert) {
            bodyEl.value += textToInsert;
            composeState.body = bodyEl.value;
            notice(`Inserted ${chip.textContent.trim()}`);
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
            textarea.value += '\n• Item 1\n• Item 2\n';
          } else if (cmd === 'insertOrderedList') {
            textarea.value += '\n1. First step\n2. Second step\n';
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
          if (statusEl) statusEl.textContent = `Draft saved at ${time}`;
          notice(`Draft saved at ${time}`);
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

            notice(`Email dispatched to ${toInput} successfully!`);
            isComposeActive = false;
            activeThreadId = newThread.id;
            updateView();
          } catch (err) {
            console.error('[MK97 Mail] Send failed:', err);
            notice('Failed to dispatch email.');
          } finally {
            if (sendEmailBtn) {
              sendEmailBtn.disabled = false;
              sendEmailBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
                </svg>
                <span>Send Email ▾</span>
              `;
            }
          }
        };
      }
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
        notice('Signatures manager: MK97 Operations standard HTML signature is active.');
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

    // Reply Send button (The green "Send" action button in the message reply panel)
    const sendReplyBtn = root.querySelector('#btn-send-reply');
    if (sendReplyBtn) {
      sendReplyBtn.onclick = async () => {
        const replyInput = root.querySelector('#mail-reply-input');
        const text = replyInput?.value.trim();
        if (!text) {
          notice('Please enter a reply before sending.', true);
          return;
        }

        const sb = getSupabase();
        if (!sb) {
          notice('Supabase client is not available. Please check configuration.', true);
          return;
        }

        const originalBtnHtml = sendReplyBtn.innerHTML;
        sendReplyBtn.disabled = true;
        sendReplyBtn.innerHTML = '<span>Sending…</span>';

        const payload = {
          to: "your-github-email@example.com",
          subject: "Re: Staging Bay Confirmation PO #87366",
          body: text
        };

        try {
          // 1. Invoke the Supabase Edge Function named 'send-sandbox-email' (with fallback to 'index-ts')
          let funcData = null;
          let funcError = null;

          const primaryInvoke = await sb.functions.invoke('send-sandbox-email', {
            body: payload
          });

          if (!primaryInvoke.error) {
            funcData = primaryInvoke.data;
          } else {
            const fallbackInvoke = await sb.functions.invoke('index-ts', {
              body: payload
            });
            if (!fallbackInvoke.error) {
              funcData = fallbackInvoke.data;
            } else {
              funcError = primaryInvoke.error;
              console.warn('Edge Function invoke warning:', primaryInvoke.error);
            }
          }

          // 2. On success: clear out the text input frame
          if (replyInput) replyInput.value = '';

          // 3. Log the outbound record into local Supabase 'emails' table with direction marked as 'outbound'
          const outboundRecord = {
            direction: 'outbound',
            to_email: payload.to,
            recipient: payload.to,
            recipient_email: payload.to,
            subject: payload.subject,
            body: payload.body,
            snippet: text.slice(0, 85) + (text.length > 85 ? '…' : ''),
            sender: 'You (Supply Chain)',
            sender_name: 'You (Supply Chain)',
            sender_email: 'supply.chain@mk97.com',
            sender_company: 'MK97 Operations',
            status: funcError ? 'logged_locally' : 'sent',
            created_at: new Date().toISOString()
          };

          try {
            const { error: insertError } = await sb
              .from('emails')
              .insert([outboundRecord]);
            if (insertError) {
              console.warn('Supabase emails table insert warning:', insertError.message);
            }
          } catch (insertErr) {
            console.warn('Supabase insert exception:', insertErr);
          }

          // Prepend locally so it is visible immediately without a hard browser reload
          const outboundThread = mapEmailRecordToThread(outboundRecord);
          if (!threads.some(t => t.id === outboundThread.id)) {
            threads.unshift(outboundThread);
            updateThreadList();
            updateSidebarCounts();
          }

          // 4. Show a clean toast notification confirming transmission or explaining cloud deployment state
          if (funcError) {
            notice(`Saved to emails table. Notice: Edge Function 'send-sandbox-email' is not deployed on Supabase cloud (404 Not Found). Deploy it in your Supabase project to dispatch live emails.`, true);
          } else {
            notice('Transmission confirmed: Outbound email sent successfully.');
          }
        } catch (err) {
          console.error('Error invoking send-sandbox-email:', err);
          notice('Transmission failed: ' + (err.message || 'Error sending email'), true);
        } finally {
          sendReplyBtn.disabled = false;
          sendReplyBtn.innerHTML = originalBtnHtml;
        }
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

    // Action toolbar buttons (Reply, Reply all, Forward, Archive, Flag, Assign, Move, More)
    const replyToolBtn = root.querySelector('#tool-reply');
    if (replyToolBtn) {
      replyToolBtn.onclick = () => {
        const input = root.querySelector('#mail-reply-input');
        const thread = getActiveThread();
        root.querySelectorAll('.composer-tab').forEach(t => t.classList.remove('active'));
        root.querySelector('.composer-tab[data-type="reply"]')?.classList.add('active');
        if (input) {
          input.placeholder = `Write a reply to ${thread?.senderName || 'sender'}...`;
          input.focus();
          input.scrollIntoView({ behavior: 'smooth' });
        }
        notice('Replying to ' + (thread?.senderName || thread?.senderEmail || 'conversation'));
      };
    }

    const replyAllToolBtn = root.querySelector('#tool-reply-all');
    if (replyAllToolBtn) {
      replyAllToolBtn.onclick = () => {
        const input = root.querySelector('#mail-reply-input');
        const thread = getActiveThread();
        root.querySelectorAll('.composer-tab').forEach(t => t.classList.remove('active'));
        root.querySelector('.composer-tab[data-type="replyAll"]')?.classList.add('active');
        if (input) {
          const allRecipients = [thread?.senderEmail, thread?.cc].filter(Boolean).join(', ');
          input.placeholder = `Write a reply all to ${allRecipients || 'all recipients'}...`;
          input.focus();
          input.scrollIntoView({ behavior: 'smooth' });
        }
        notice('Replying to all recipients (' + [thread?.senderEmail, thread?.cc].filter(Boolean).join(', ') + ')');
      };
    }

    const forwardToolBtn = root.querySelector('#tool-forward');
    if (forwardToolBtn) {
      forwardToolBtn.onclick = () => {
        const thread = getActiveThread();
        if (thread) {
          openComposeModal({ mode: 'forward', thread });
          notice('Forwarding: ' + thread.subject);
        }
      };
    }

    const archiveToolBtn = root.querySelector('#tool-archive');
    if (archiveToolBtn) {
      archiveToolBtn.onclick = () => {
        const thread = getActiveThread();
        if (thread) {
          thread.folder = 'archive';
          const remaining = getFilteredThreads();
          if (remaining.length > 0 && !remaining.some(t => t.id === activeThreadId)) {
            activeThreadId = remaining[0].id;
          }
          updateSidebarCounts();
          updateView();
          notice('Conversation archived.');
        }
      };
    }

    const flagToolBtn = root.querySelector('#tool-flag');
    if (flagToolBtn) {
      flagToolBtn.onclick = () => {
        const thread = getActiveThread();
        if (thread) {
          thread.flagged = !thread.flagged;
          updateSidebarCounts();
          updateView();
          notice(thread.flagged ? 'Email flagged for follow-up.' : 'Flag removed.');
        }
      };
    }

    const assignToolBtn = root.querySelector('#tool-assign');
    if (assignToolBtn) {
      assignToolBtn.onclick = () => {
        const thread = getActiveThread();
        if (thread) {
          openAssignModal(thread);
        }
      };
    }

    const moveToolBtn = root.querySelector('#tool-move');
    if (moveToolBtn) {
      moveToolBtn.onclick = () => {
        const thread = getActiveThread();
        if (thread) {
          openMoveModal(thread);
        }
      };
    }

    const moreToolBtn = root.querySelector('#tool-more');
    if (moreToolBtn) {
      moreToolBtn.onclick = (e) => {
        e.stopPropagation();
        const thread = getActiveThread();
        if (thread) {
          openMoreMenu(moreToolBtn, thread);
        }
      };
    }

    const quickReplyBtn = root.querySelector('#btn-quick-reply');
    if (quickReplyBtn) {
      quickReplyBtn.onclick = () => {
        if (replyToolBtn) replyToolBtn.click();
      };
    }

    const metaMoreBtn = root.querySelector('#btn-meta-more');
    if (metaMoreBtn) {
      metaMoreBtn.onclick = (e) => {
        e.stopPropagation();
        const thread = getActiveThread();
        if (thread) {
          openMoreMenu(metaMoreBtn, thread);
        }
      };
    }

    // Quick Composer Tabs (Reply, Reply all, Forward)
    root.querySelectorAll('.composer-tab').forEach(tab => {
      tab.onclick = () => {
        root.querySelectorAll('.composer-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const type = tab.dataset.type;
        const thread = getActiveThread();
        const input = root.querySelector('#mail-reply-input');
        if (type === 'reply') {
          if (input) {
            input.placeholder = `Write a reply to ${thread?.senderName || 'sender'}...`;
            input.focus();
          }
          notice('Switched to Reply mode.');
        } else if (type === 'replyAll') {
          if (input) {
            const allRecipients = [thread?.senderEmail, thread?.cc].filter(Boolean).join(', ');
            input.placeholder = `Write a reply to all (${allRecipients || 'all recipients'})...`;
            input.focus();
          }
          notice('Switched to Reply all mode.');
        } else if (type === 'forward') {
          if (thread) {
            openComposeModal({ mode: 'forward', thread });
          }
        }
      };
    });

    // Quick Composer Tools (Formatting, Attach, Link, Emoji, Image)
    const composerTools = root.querySelectorAll('.composer-tool-btn');
    if (composerTools.length >= 5) {
      // Aa - Formatting
      composerTools[0].onclick = () => {
        const input = root.querySelector('#mail-reply-input');
        if (!input) return;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const sel = input.value.substring(start, end);
        if (sel) {
          input.setRangeText(`**${sel}**`, start, end, 'select');
        } else {
          input.setRangeText('**bold text**', start, end, 'select');
        }
        input.focus();
      };
      // Attach File
      composerTools[1].onclick = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.onchange = (e) => {
          const file = e.target.files?.[0];
          if (file) {
            notice(`Attachment attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
            const input = root.querySelector('#mail-reply-input');
            if (input) input.value += `\n[Attachment: ${file.name}]`;
          }
        };
        fileInput.click();
      };
      // Insert Link
      composerTools[2].onclick = () => {
        const url = prompt('Enter link URL (e.g. https://tracking.carrier.com/123):', 'https://');
        if (url && url.trim() && url !== 'https://') {
          const input = root.querySelector('#mail-reply-input');
          if (input) {
            input.value += ` [Link](${url.trim()})`;
            input.focus();
          }
        }
      };
      // Insert Emoji
      composerTools[3].onclick = () => {
        const input = root.querySelector('#mail-reply-input');
        if (input) {
          input.value += ' 👍';
          input.focus();
        }
      };
      // Insert Image
      composerTools[4].onclick = () => {
        const input = root.querySelector('#mail-reply-input');
        if (input) {
          input.value += '\n[Image: Operational-Logistics-Manifest.png]';
          input.focus();
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
  }

  function openComposeModal(opts = {}) {
    const modalEl = document.createElement('div');
    modalEl.innerHTML = renderComposeModal(opts);
    document.body.appendChild(modalEl.firstElementChild);

    if (opts.mode === 'forward') {
      setTimeout(() => document.getElementById('compose-to')?.focus(), 50);
    }

    const backdrop = document.getElementById('compose-modal-backdrop');
    const closeBtn = document.getElementById('btn-close-compose');
    const cancelBtn = document.getElementById('btn-cancel-compose');
    const sendBtn = document.getElementById('btn-submit-compose');

    function close() {
      backdrop?.remove();
    }

    closeBtn.onclick = close;
    cancelBtn.onclick = close;
    sendBtn.onclick = async () => {
      const toInput = document.getElementById('compose-to');
      const subjectInput = document.getElementById('compose-subject');
      const bodyInput = document.getElementById('compose-body');

      const to = toInput ? toInput.value.trim() : '';
      const subject = subjectInput ? subjectInput.value.trim() : '';
      const body = bodyInput ? bodyInput.value.trim() : '';

      if (!to || !subject) {
        notice('Please fill in both recipient and subject.', true);
        return;
      }

      const originalBtnText = sendBtn.innerHTML;
      sendBtn.disabled = true;
      sendBtn.innerHTML = 'Sending…';

      const payload = {
        to: to || "manoj.k.manne@gmail.com",
        subject: subject,
        body: body
      };

      const sb = getSupabase();
      let funcError = null;

      try {
        if (sb) {
          // Invoke Supabase Edge Function (send-sandbox-email with fallback to index-ts)
          const primaryInvoke = await sb.functions.invoke('send-sandbox-email', {
            body: payload
          });

          if (!primaryInvoke.error) {
            // Success with primary function
          } else {
            const fallbackInvoke = await sb.functions.invoke('index-ts', {
              body: payload
            });
            if (fallbackInvoke.error) {
              funcError = primaryInvoke.error;
              console.warn('Edge Function invoke warning:', primaryInvoke.error);
            }
          }

          // Insert outbound record into public.emails table
          const outboundRecord = {
            direction: 'outbound',
            to_email: payload.to,
            recipient: payload.to,
            recipient_email: payload.to,
            subject: payload.subject,
            body: payload.body,
            snippet: body.slice(0, 85) + (body.length > 85 ? '…' : ''),
            sender: 'You (Supply Chain)',
            sender_name: 'You (Supply Chain)',
            sender_email: 'supply.chain@mk97.com',
            sender_company: 'MK97 Operations',
            status: funcError ? 'logged_locally' : 'sent',
            created_at: new Date().toISOString()
          };

          try {
            const { error: insertError } = await sb
              .from('emails')
              .insert([outboundRecord]);
            if (insertError) {
              console.warn('Supabase emails table insert warning:', insertError.message);
            }
          } catch (insertErr) {
            console.warn('Supabase insert exception:', insertErr);
          }

          const outboundThread = mapEmailRecordToThread(outboundRecord);
          if (!threads.some(t => t.id === outboundThread.id)) {
            threads.unshift(outboundThread);
            activeThreadId = outboundThread.id;
            updateThreadList();
            updateSidebarCounts();
            updateView();
          }
        } else {
          // Fallback local thread insertion if Supabase client not loaded
          threads.unshift({
            id: 'thread-' + Date.now(),
            senderName: 'You (Supply Chain)',
            senderCompany: 'MK97 Operations',
            senderEmail: 'supply.chain@mk97.com',
            to,
            cc: 'procurement@mk97.com',
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
            signOff: 'MK97 Unified Operations',
            attachments: [],
            related: {
              poNumber: subject.match(/#\d+/)?.[0] || 'PO-NEW',
              vendor: 'Global Parts Co.',
              tracking: 'Pending Booking',
              estimatedDelivery: 'TBD',
              orderUrl: 'all-open-orders.html'
            }
          });
          activeThreadId = threads[0].id;
          updateView();
        }
      } catch (err) {
        console.error('Compose send error:', err);
      } finally {
        close();
        if (funcError) {
          notice(`Saved to emails table. Notice: Edge Function dispatch error (${funcError.message || '404'}).`, true);
        } else {
          notice('Transmission confirmed: Outbound email sent successfully to ' + to);
        }
      }
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

  function openAssignModal(thread) {
    if (!thread) return;
    const modalEl = document.createElement('div');
    modalEl.innerHTML = renderAssignModal(thread);
    document.body.appendChild(modalEl.firstElementChild);

    const backdrop = document.getElementById('assign-modal-backdrop');
    const closeBtn = document.getElementById('btn-close-assign');
    const cancelBtn = document.getElementById('btn-cancel-assign');

    function close() {
      backdrop?.remove();
    }

    if (closeBtn) closeBtn.onclick = close;
    if (cancelBtn) cancelBtn.onclick = close;

    function doAssign(name, email) {
      if (!name && !email) return;
      const displayName = name || email;
      thread.assignedTo = { name: displayName, email: email || displayName };
      thread.tags = (thread.tags || []).filter(t => !t.name.startsWith('Assigned:'));
      thread.tags.push({ name: 'Assigned: ' + displayName, type: 'vendor' });
      close();
      updateView();
      notice(`Conversation assigned to ${displayName}.`);
    }

    backdrop.querySelectorAll('.assign-item').forEach(item => {
      item.onclick = () => {
        const name = item.dataset.name;
        const email = item.dataset.email;
        doAssign(name, email);
      };
    });

    const customAssignBtn = backdrop.querySelector('#btn-custom-assign');
    const customAssignInput = backdrop.querySelector('#custom-assign-email');
    if (customAssignBtn && customAssignInput) {
      customAssignBtn.onclick = () => {
        const val = customAssignInput.value.trim();
        if (val) {
          doAssign(val.split('@')[0], val);
        } else {
          notice('Please enter an email address or team member name.', true);
        }
      };
      customAssignInput.onkeydown = (e) => {
        if (e.key === 'Enter') customAssignBtn.click();
      };
    }
  }

  function openMoveModal(thread) {
    if (!thread) return;
    const modalEl = document.createElement('div');
    modalEl.innerHTML = renderMoveModal(thread);
    document.body.appendChild(modalEl.firstElementChild);

    const backdrop = document.getElementById('move-modal-backdrop');
    const closeBtn = document.getElementById('btn-close-move');
    const cancelBtn = document.getElementById('btn-cancel-move');

    function close() {
      backdrop?.remove();
    }

    if (closeBtn) closeBtn.onclick = close;
    if (cancelBtn) cancelBtn.onclick = close;

    backdrop.querySelectorAll('.move-folder-option').forEach(opt => {
      opt.onclick = () => {
        const targetFolder = opt.dataset.folder;
        if (targetFolder) {
          thread.folder = targetFolder;
          close();
          const remaining = getFilteredThreads();
          if (remaining.length > 0 && !remaining.some(t => t.id === activeThreadId)) {
            activeThreadId = remaining[0].id;
          }
          updateSidebarCounts();
          updateView();
          notice(`Conversation moved to ${targetFolder.charAt(0).toUpperCase() + targetFolder.slice(1)}.`);
        }
      };
    });
  }

  function openMoreMenu(triggerBtn, thread) {
    if (!thread || !triggerBtn) return;
    const existing = document.getElementById('mail-more-menu-popover');
    if (existing) {
      existing.remove();
      return;
    }

    const rect = triggerBtn.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.id = 'mail-more-menu-popover';
    popover.setAttribute('role', 'menu');
    popover.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 6}px;
      left: ${Math.max(10, Math.min(rect.left, window.innerWidth - 220))}px;
      width: 200px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08);
      z-index: 2147483640;
      display: flex;
      flex-direction: column;
      padding: 6px;
      font-size: 13px;
    `;

    popover.innerHTML = `
      <button type="button" class="mail-menu-item" id="menu-unread" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:none;border:none;border-radius:6px;cursor:pointer;text-align:left;color:#334155;font-size:13px;transition:background 0.1s;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <span>${thread.unread ? 'Mark as read' : 'Mark as unread'}</span>
      </button>
      <button type="button" class="mail-menu-item" id="menu-star" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:none;border:none;border-radius:6px;cursor:pointer;text-align:left;color:#334155;font-size:13px;transition:background 0.1s;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="${thread.starred ? '#f59e0b' : 'none'}" stroke="${thread.starred ? '#f59e0b' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>${thread.starred ? 'Remove star' : 'Star message'}</span>
      </button>
      <button type="button" class="mail-menu-item" id="menu-print" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:none;border:none;border-radius:6px;cursor:pointer;text-align:left;color:#334155;font-size:13px;transition:background 0.1s;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        <span>Print thread</span>
      </button>
      <button type="button" class="mail-menu-item" id="menu-download-eml" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:none;border:none;border-radius:6px;cursor:pointer;text-align:left;color:#334155;font-size:13px;transition:background 0.1s;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Download (.eml)</span>
      </button>
      <div style="height:1px;background:#e2e8f0;margin:4px 0;"></div>
      <button type="button" class="mail-menu-item" id="menu-trash" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:none;border:none;border-radius:6px;cursor:pointer;text-align:left;color:#ef4444;font-size:13px;transition:background 0.1s;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Delete conversation</span>
      </button>
    `;

    document.body.appendChild(popover);

    popover.querySelectorAll('.mail-menu-item').forEach(btn => {
      btn.onmouseenter = () => btn.style.background = '#f1f5f9';
      btn.onmouseleave = () => btn.style.background = 'none';
    });

    const onDocClick = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn && !triggerBtn.contains(e.target)) {
        popover.remove();
        document.removeEventListener('click', onDocClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onDocClick), 10);

    popover.querySelector('#menu-unread').onclick = () => {
      thread.unread = !thread.unread;
      updateView();
      updateSidebarCounts();
      notice(thread.unread ? 'Marked conversation as unread.' : 'Marked conversation as read.');
      popover.remove();
    };

    popover.querySelector('#menu-star').onclick = () => {
      thread.starred = !thread.starred;
      updateView();
      updateSidebarCounts();
      notice(thread.starred ? 'Conversation starred.' : 'Star removed.');
      popover.remove();
    };

    popover.querySelector('#menu-print').onclick = () => {
      popover.remove();
      window.print();
    };

    popover.querySelector('#menu-download-eml').onclick = () => {
      popover.remove();
      downloadThreadEml(thread);
    };

    popover.querySelector('#menu-trash').onclick = () => {
      thread.folder = 'trash';
      const remaining = getFilteredThreads();
      if (remaining.length > 0 && !remaining.some(t => t.id === activeThreadId)) {
        activeThreadId = remaining[0].id;
      }
      updateView();
      updateSidebarCounts();
      notice('Conversation moved to Trash.');
      popover.remove();
    };
  }

  function downloadThreadEml(thread) {
    if (!thread) return;
    const emlContent = [
      `From: "${thread.senderName || 'Sender'}" <${thread.senderEmail || 'unknown@mk97.com'}>`,
      `To: <${thread.to || ''}>`,
      thread.cc ? `Cc: <${thread.cc}>` : null,
      `Subject: ${thread.subject || '(No Subject)'}`,
      `Date: ${new Date(thread.fullDate || Date.now()).toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      thread.body || '',
      thread.signOff ? `\n-- \n${thread.signOff}` : ''
    ].filter(line => line !== null).join('\r\n');

    const blob = new Blob([emlContent], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(thread.subject || 'conversation').replace(/[^a-zA-Z0-9_-]/g, '_')}.eml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notice(`Downloaded ${a.download}`);
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
      <div class="mail-workspace-nav" role="navigation" aria-label="Workspace View">
        <div class="workspace-view-switch" role="tablist" aria-label="Workspace View">
          <a class="workspace-view-tab" href="${S ? S.url('workspace.html?view=modules') : 'workspace.html?view=modules'}" role="tab" aria-label="Operational Modules" title="Operational Modules">
            ▦ Operational Modules
          </a>
          <a class="workspace-view-tab workspace-mail-tab active" href="${S ? S.url('mail.html') : 'mail.html'}" role="tab" aria-selected="true" aria-current="page" aria-label="MK97 Mail" title="MK97 Mail · MK97 ERP Enterprise Mail">
            <svg class="workspace-mail-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <span>MK97 Mail</span>
            <span class="workspace-mail-pill">12</span>
          </a>
          <a class="workspace-view-tab" href="${S ? S.url('tasks.html') : 'tasks.html'}" role="tab" aria-label="Tasks workspace" title="Tasks &amp; Operational Reminders">
            ☑ Tasks
          </a>
          <a class="workspace-view-tab" href="${S ? S.url('workspace.html?view=telemetry') : 'workspace.html?view=telemetry'}" role="tab" aria-label="Telemetry &amp; KPIs" title="Fulfillment &amp; Demand Telemetry">
            📊 Telemetry &amp; KPIs
          </a>
        </div>
      </div>
      <div class="stark-mail-container">
        ${renderSubHeader()}
        <div class="stark-mail-workspace ${isComposeActive ? 'compose-active' : ''}">
          ${renderSidebar()}
          ${renderThreadList()}
          ${isComposeActive ? renderComposePane() : `${renderDetailView()}${renderIntelPanel()}`}
        </div>
      </div>
    `;

    bindEvents();
  }

  function init() {
    if (document.body.dataset.systemPage === 'mail' || document.getElementById('stark-mail-content')) {
      renderApp();
      initReactiveMailFeed();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.MK97Mail = window.StarkMail = {
    render: renderApp,
    getThreads: () => threads,
    selectThread: id => {
      activeThreadId = id;
      updateView();
    },
    getSupabase,
    initReactiveMailFeed,
    mapEmailRecordToThread,
    prependEmail: record => {
      const thread = mapEmailRecordToThread(record);
      if (!threads.some(t => t.id === thread.id)) {
        threads.unshift(thread);
        updateThreadList();
        updateSidebarCounts();
      }
      return thread;
    }
  };
})();
