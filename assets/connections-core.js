(function (root, factory) {
  'use strict';
  const api = factory();
  root.MKConnectionsCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const MK_ISA_QUAL = 'ZZ';
  const MK_ISA_ID = 'MK97ERP00001';
  const MK_GS_ID = 'MK97ERP';

  const EDI_DOC_CATALOG = {
    '850': { code: '850', name: 'Purchase Order', dir: 'OUTBOUND', desc: 'Send Vendor PO lines, pricing, ship-to & delivery dates' },
    '855': { code: '855', name: 'PO Acknowledgment', dir: 'INBOUND', desc: 'Confirm accepted, changed, or backordered PO lines' },
    '856': { code: '856', name: 'Advance Ship Notice (ASN)', dir: 'OUTBOUND', desc: 'Shipment hierarchy, carrier SCAC, SSCC-18 & tracking' },
    '810': { code: '810', name: 'Commercial Invoice', dir: 'OUTBOUND', desc: 'Invoiced line totals, tax, freight & Net payment terms' },
    '846': { code: '846', name: 'Inventory Advice (ATS)', dir: 'OUTBOUND', desc: 'Broadcast real-time warehouse & 3PL available-to-sell stock' },
    '940': { code: '940', name: 'Warehouse Ship Order', dir: 'OUTBOUND', desc: 'Instruct 3PL warehouse to pick, pack & ship customer order' },
    '945': { code: '945', name: 'Warehouse Ship Advice', dir: 'INBOUND', desc: 'Receive 3PL shipment confirmation & carrier tracking' },
    '997': { code: '997', name: 'Functional Acknowledgment', dir: 'BOTH', desc: 'Automated X12 syntax receipt & acceptance confirmation' }
  };

  const PARTNER_TEMPLATES = [
    // EDI Templates
    {
      id: 'tpl_amazon_edi',
      category: 'EDI',
      name: 'Amazon Vendor Central',
      role: 'Retailer / Buyer',
      protocol: 'EDI_X12',
      standard: 'X12 005010',
      transport: 'AS2',
      endpoint: 'https://as2.vendorcentral.amazon.com/edi/receive',
      isaQualifier: 'ZZ',
      isaId: 'AMAZONVEND01',
      gsId: 'AMAZONVC',
      as2Id: 'AMAZON-US-AS2',
      docs: ['850', '855', '856', '810', '846', '997'],
      badge: 'Retail Giant',
      accent: '#f59e0b'
    },
    {
      id: 'tpl_walmart_edi',
      category: 'EDI',
      name: 'Walmart / Target Retail EDI',
      role: 'Big-Box Retailer',
      protocol: 'EDI_X12',
      standard: 'X12 004010',
      transport: 'AS2',
      endpoint: 'https://as2.walmart.com/as2/inbound',
      isaQualifier: '08',
      isaId: '925485US00',
      gsId: 'WALMARTUS',
      as2Id: 'WALMART-AS2-PROD',
      docs: ['850', '856', '810', '846', '997'],
      badge: 'Big-Box',
      accent: '#2563eb'
    },
    {
      id: 'tpl_sps_van',
      category: 'EDI',
      name: 'SPS Commerce / OpenText VAN',
      role: 'Universal EDI Network',
      protocol: 'EDI_X12',
      standard: 'X12 005010',
      transport: 'SFTP',
      endpoint: 'sftp://edi.spscommerce.com:22/outbound',
      isaQualifier: 'ZZ',
      isaId: 'SPSCOMMERCE1',
      gsId: 'SPSVAN',
      as2Id: 'SPS-VAN-HUB',
      docs: ['850', '855', '856', '810', '846', '940', '945', '997'],
      badge: 'Any Retailer',
      accent: '#0d9488'
    },
    {
      id: 'tpl_3pl_edi',
      category: 'EDI',
      name: '3PL Warehouse EDI (940/945)',
      role: '3PL Fulfillment Partner',
      protocol: 'EDI_X12',
      standard: 'X12 005010',
      transport: 'SFTP',
      endpoint: 'sftp://edi.partner3pl.io:22/inbound/940',
      isaQualifier: 'ZZ',
      isaId: 'PARTNER3PL01',
      gsId: 'P3PLOPS',
      as2Id: 'P3PL-AS2',
      docs: ['940', '945', '846', '997'],
      badge: '3PL Ops',
      accent: '#10b981'
    },
    {
      id: 'tpl_supplier_edi',
      category: 'EDI',
      name: 'Brand Supplier Direct EDI',
      role: 'Vendor / Manufacturer',
      protocol: 'EDI_X12',
      standard: 'X12 005010',
      transport: 'AS2',
      endpoint: 'https://edi.supplier-direct.com/as2',
      isaQualifier: '12',
      isaId: 'SUPPLIER0097',
      gsId: 'SUPPDIR',
      as2Id: 'SUPPLIER-AS2',
      docs: ['850', '855', '856', '810', '846', '997'],
      badge: 'Supplier',
      accent: '#8b5cf6'
    },
    {
      id: 'tpl_custom_edi',
      category: 'EDI',
      name: 'Custom Any EDI Partner',
      role: 'Any X12 / EDIFACT Partner',
      protocol: 'EDI_X12',
      standard: 'X12 005010',
      transport: 'AS2',
      endpoint: 'https://as2.partner-domain.com/edi',
      isaQualifier: 'ZZ',
      isaId: 'PARTNERID001',
      gsId: 'PARTNERGS',
      as2Id: 'PARTNER-AS2',
      docs: ['850', '856', '810', '846', '997'],
      badge: 'Universal',
      accent: '#087f78'
    },

    // API Templates
    {
      id: 'tpl_shopify_api',
      category: 'API',
      name: 'Shopify Admin REST API',
      role: 'E-Commerce Storefront',
      protocol: 'REST_API',
      method: 'POST',
      endpoint: 'https://your-store.myshopify.com/admin/api/2026-01/orders.json',
      authType: 'API_KEY',
      authHeader: 'X-Shopify-Access-Token',
      triggers: ['ORDER_CREATED', 'INVENTORY_SYNC', 'ORDER_SHIPPED'],
      badge: 'Commerce',
      accent: '#16a34a'
    },
    {
      id: 'tpl_3pl_rest',
      category: 'API',
      name: '3PL Fulfillment REST API',
      role: 'Warehouse / 3PL API',
      protocol: 'REST_API',
      method: 'POST',
      endpoint: 'https://api.partner3pl.io/v2/shipments/dispatch',
      authType: 'BEARER',
      authHeader: 'Authorization',
      triggers: ['ORDER_ALLOCATED', 'TPL_DISPATCH', 'TRACKING_UPDATE'],
      badge: '3PL API',
      accent: '#0284c7'
    },
    {
      id: 'tpl_shipstation_api',
      category: 'API',
      name: 'ShipStation / EasyPost Carrier API',
      role: 'Shipping & Labels',
      protocol: 'REST_API',
      method: 'POST',
      endpoint: 'https://ssapi.shipstation.com/orders/createorder',
      authType: 'BASIC',
      authHeader: 'Authorization',
      triggers: ['ORDER_SHIPPED', 'TRACKING_UPDATE'],
      badge: 'Carriers',
      accent: '#0ea5e9'
    },
    {
      id: 'tpl_erp_webhook',
      category: 'API',
      name: 'Slack / Teams / Ops Webhook',
      role: 'Real-Time Alerts',
      protocol: 'WEBHOOK',
      method: 'POST',
      endpoint: 'https://hooks.slack.com/services/T000/B000/MK97WEBHOOK',
      authType: 'HMAC_SHA256',
      authHeader: 'X-MK97-Signature',
      triggers: ['LOW_STOCK_ALERT', 'VENDOR_PO_CREATED', 'DELAY_ESCALATION'],
      badge: 'Webhook',
      accent: '#7c3aed'
    },
    {
      id: 'tpl_netsuite_api',
      category: 'API',
      name: 'NetSuite / SAP Finance API',
      role: 'Accounting & ERP Sync',
      protocol: 'REST_API',
      method: 'POST',
      endpoint: 'https://api.erp-finance.example.com/v1/purchase-orders',
      authType: 'OAUTH2',
      authHeader: 'Authorization',
      triggers: ['VENDOR_PO_CREATED', 'INVOICE_MATCHED'],
      badge: 'Finance',
      accent: '#1d4ed8'
    },
    {
      id: 'tpl_custom_api',
      category: 'API',
      name: 'Custom Any REST / Webhook API',
      role: 'Universal HTTP Endpoint',
      protocol: 'REST_API',
      method: 'POST',
      endpoint: 'https://httpbin.org/post',
      authType: 'BEARER',
      authHeader: 'Authorization',
      triggers: ['ORDER_CREATED', 'VENDOR_PO_CREATED', 'INVENTORY_SYNC'],
      badge: 'Universal',
      accent: '#087f78'
    }
  ];

  const DEFAULT_MAPPINGS = {
    orders: [
      { source: 'po', target: 'external_order_ref', ediSegment: 'BEG03', transform: 'UPPERCASE' },
      { source: 'orderNumber', target: 'erp_order_id', ediSegment: 'REF02', transform: 'STRING' },
      { source: 'status', target: 'fulfillment_status', ediSegment: 'BEG02', transform: 'UPPERCASE' },
      { source: 'customerName', target: 'buyer.company_name', ediSegment: 'N102', transform: 'STRING' },
      { source: 'inHandsDate', target: 'requested_delivery_date', ediSegment: 'DTM02', transform: 'ISO_DATE' },
      { source: 'tracking', target: 'shipment.tracking_number', ediSegment: 'REF02_CN', transform: 'UPPERCASE' },
      { source: 'lines', target: 'line_items', ediSegment: 'PO1', transform: 'ARRAY' }
    ],
    purchaseOrders: [
      { source: 'po', target: 'purchase_order_number', ediSegment: 'BEG03', transform: 'UPPERCASE' },
      { source: 'vendorName', target: 'supplier.name', ediSegment: 'N102', transform: 'STRING' },
      { source: 'status', target: 'po_status', ediSegment: 'BEG01', transform: 'UPPERCASE' },
      { source: 'eta', target: 'expected_arrival_date', ediSegment: 'DTM02', transform: 'ISO_DATE' },
      { source: 'warehouse', target: 'ship_to.warehouse', ediSegment: 'N102_ST', transform: 'STRING' },
      { source: 'lines', target: 'items', ediSegment: 'PO1', transform: 'ARRAY' }
    ],
    inventory: [
      { source: 'sku', target: 'item_sku', ediSegment: 'LIN03', transform: 'UPPERCASE' },
      { source: 'model', target: 'manufacturer_part_no', ediSegment: 'LIN05', transform: 'UPPERCASE' },
      { source: 'brand', target: 'brand_name', ediSegment: 'PID05', transform: 'STRING' },
      { source: 'available', target: 'available_to_sell', ediSegment: 'QTY02', transform: 'NUMBER' },
      { source: 'onHand', target: 'physical_on_hand', ediSegment: 'QTY02_OH', transform: 'NUMBER' },
      { source: 'cost', target: 'unit_cost_usd', ediSegment: 'CTP03', transform: 'NUMBER' }
    ]
  };

  function seedConnections() {
    const now = Date.now();
    const isoAgo = mins => new Date(now - mins * 60000).toISOString();
    return {
      version: VERSION,
      ourProfile: {
        companyName: 'MK97 ERP Supply Chain',
        isaQualifier: MK_ISA_QUAL,
        isaId: MK_ISA_ID,
        gsId: MK_GS_ID,
        as2Id: 'MK97-ERP-AS2-PROD',
        webhookSecret: 'whsec_mk97_live_9f4b2c8e1a7d'
      },
      connections: [
        {
          id: 'conn_edi_kendra',
          category: 'EDI',
          name: 'Kendra Scott Wholesale EDI',
          role: 'Brand Supplier',
          protocol: 'EDI_X12',
          standard: 'X12 005010',
          transport: 'AS2',
          endpoint: 'https://as2.kendrascott-edi.com/receive',
          isaQualifier: '12',
          isaId: '5125550199',
          gsId: 'KENDRASCOTT',
          as2Id: 'KS-WHOLESALE-AS2',
          docs: ['850', '855', '856', '810', '846', '997'],
          status: 'CONNECTED',
          active: true,
          autoAck997: true,
          autoSync: true,
          latencyMs: 142,
          successRate: 99.4,
          txCount: 184,
          lastSyncAt: isoAgo(14),
          createdAt: isoAgo(14400),
          accent: '#8b5cf6',
          mappings: JSON.parse(JSON.stringify(DEFAULT_MAPPINGS.purchaseOrders))
        },
        {
          id: 'conn_edi_workhuman',
          category: 'EDI',
          name: 'Workhuman Corporate EDI',
          role: 'Enterprise Buyer',
          protocol: 'EDI_X12',
          standard: 'X12 005010',
          transport: 'AS2',
          endpoint: 'https://edi.workhuman.com/as2/inbound',
          isaQualifier: 'ZZ',
          isaId: 'WORKHUMAN001',
          gsId: 'WORKHUMAN',
          as2Id: 'WH-GLOBAL-AS2',
          docs: ['850', '855', '856', '810', '846', '997'],
          status: 'CONNECTED',
          active: true,
          autoAck997: true,
          autoSync: true,
          latencyMs: 118,
          successRate: 99.8,
          txCount: 412,
          lastSyncAt: isoAgo(6),
          createdAt: isoAgo(28800),
          accent: '#087f78',
          mappings: JSON.parse(JSON.stringify(DEFAULT_MAPPINGS.orders))
        },
        {
          id: 'conn_edi_3pl_east',
          category: 'EDI',
          name: 'East Coast 3PL Hub (940/945)',
          role: '3PL Warehouse',
          protocol: 'EDI_X12',
          standard: 'X12 005010',
          transport: 'SFTP',
          endpoint: 'sftp://edi.east3pl-logistics.com:22/mk97',
          isaQualifier: 'ZZ',
          isaId: 'EAST3PLHUB01',
          gsId: 'EAST3PL',
          as2Id: 'EAST3PL-SFTP',
          docs: ['940', '945', '846', '997'],
          status: 'CONNECTED',
          active: true,
          autoAck997: true,
          autoSync: true,
          latencyMs: 196,
          successRate: 98.9,
          txCount: 279,
          lastSyncAt: isoAgo(22),
          createdAt: isoAgo(21600),
          accent: '#10b981',
          mappings: JSON.parse(JSON.stringify(DEFAULT_MAPPINGS.inventory))
        },
        {
          id: 'conn_api_3pl_dispatch',
          category: 'API',
          name: '3PL Real-Time Dispatch API',
          role: 'Fulfillment REST API',
          protocol: 'REST_API',
          method: 'POST',
          endpoint: 'https://api.partner3pl.io/v2/shipments/dispatch',
          authType: 'BEARER',
          authHeader: 'Authorization',
          authSecret: 'mk97_live_3pl_token_88a4f2c1',
          headers: { 'Content-Type': 'application/json', 'X-MK97-Region': 'US' },
          triggers: ['ORDER_ALLOCATED', 'TPL_DISPATCH', 'TRACKING_UPDATE'],
          status: 'CONNECTED',
          active: true,
          autoSync: true,
          latencyMs: 84,
          successRate: 99.6,
          txCount: 628,
          lastSyncAt: isoAgo(4),
          createdAt: isoAgo(19200),
          accent: '#0284c7',
          mappings: JSON.parse(JSON.stringify(DEFAULT_MAPPINGS.orders))
        },
        {
          id: 'conn_api_shopify',
          category: 'API',
          name: 'Shopify Omnichannel ATS Sync',
          role: 'Commerce REST API',
          protocol: 'REST_API',
          method: 'POST',
          endpoint: 'https://mk97-store.myshopify.com/admin/api/2026-01/inventory_levels/set.json',
          authType: 'API_KEY',
          authHeader: 'X-Shopify-Access-Token',
          authSecret: 'shpat_mk97_live_71e9b4a0',
          headers: { 'Content-Type': 'application/json' },
          triggers: ['INVENTORY_SYNC', 'ORDER_CREATED'],
          status: 'CONNECTED',
          active: true,
          autoSync: true,
          latencyMs: 112,
          successRate: 99.9,
          txCount: 1245,
          lastSyncAt: isoAgo(9),
          createdAt: isoAgo(36000),
          accent: '#16a34a',
          mappings: JSON.parse(JSON.stringify(DEFAULT_MAPPINGS.inventory))
        },
        {
          id: 'conn_api_webhook_ops',
          category: 'API',
          name: 'Executive Ops Alert Webhook',
          role: 'Event Webhook',
          protocol: 'WEBHOOK',
          method: 'POST',
          endpoint: 'https://httpbin.org/post',
          authType: 'HMAC_SHA256',
          authHeader: 'X-MK97-Signature',
          authSecret: 'whsec_mk97_ops_33c9d1',
          headers: { 'Content-Type': 'application/json' },
          triggers: ['LOW_STOCK_ALERT', 'VENDOR_PO_CREATED', 'DELAY_ESCALATION'],
          status: 'CONNECTED',
          active: true,
          autoSync: true,
          latencyMs: 95,
          successRate: 100.0,
          txCount: 93,
          lastSyncAt: isoAgo(31),
          createdAt: isoAgo(10800),
          accent: '#7c3aed',
          mappings: JSON.parse(JSON.stringify(DEFAULT_MAPPINGS.purchaseOrders))
        }
      ],
      logs: [
        {
          id: 'tx_seed_1',
          kind: 'EDI',
          connectionId: 'conn_edi_kendra',
          partnerName: 'Kendra Scott Wholesale EDI',
          direction: 'OUTBOUND',
          docType: '850',
          controlNumber: '000004821',
          reference: 'PO-2026-887411',
          status: 'ACK_997',
          httpCode: 200,
          latencyMs: 138,
          mode: 'AS2',
          timestamp: isoAgo(14),
          summary: 'EDI 850 Purchase Order transmitted · 997 Functional ACK Accepted',
          payload: 'ISA*00*          *00*          *ZZ*MK97ERP00001   *12*5125550199     *261121*1030*^*00501*000004821*0*P*:~\nGS*PO*MK97ERP*KENDRASCOTT*20261121*1030*4821*X*005010~\nST*850*0001~\nBEG*00*NE*PO-2026-887411**20261121~\nN1*ST*MK97 Southeast DC*92*SE01~\nPO1*1*40*EA*245.00**VP*WH1000XM5~\nCTT*1*40~\nSE*6*0001~\nGE*1*4821~\nIEA*1*000004821~'
        },
        {
          id: 'tx_seed_2',
          kind: 'API',
          connectionId: 'conn_api_3pl_dispatch',
          partnerName: '3PL Real-Time Dispatch API',
          direction: 'OUTBOUND',
          docType: 'POST /dispatch',
          controlNumber: 'REQ-89108',
          reference: 'PO-2026-89108',
          status: 'DELIVERED',
          httpCode: 201,
          latencyMs: 81,
          mode: 'REST',
          timestamp: isoAgo(4),
          summary: '201 Created · Dispatched fulfillment order payload to 3PL partner',
          payload: JSON.stringify({ event: 'TPL_DISPATCH', order_ref: 'PO-2026-89108', warehouse: 'EAST-3PL', lines: [{ sku: 'SONY-XM5', qty: 12 }] }, null, 2),
          response: JSON.stringify({ ok: true, shipmentId: 'TPL-SHP-77492', status: 'ACCEPTED', receivedAt: isoAgo(4) }, null, 2)
        },
        {
          id: 'tx_seed_3',
          kind: 'EDI',
          connectionId: 'conn_edi_workhuman',
          partnerName: 'Workhuman Corporate EDI',
          direction: 'OUTBOUND',
          docType: '846',
          controlNumber: '000004820',
          reference: 'ATS-SNAPSHOT-US',
          status: 'ACK_997',
          httpCode: 200,
          latencyMs: 114,
          mode: 'AS2',
          timestamp: isoAgo(6),
          summary: 'EDI 846 Inventory ATS broadcast · 997 Functional ACK Accepted',
          payload: 'ISA*00*          *00*          *ZZ*MK97ERP00001   *ZZ*WORKHUMAN001   *261121*1022*^*00501*000004820*0*P*:~\nGS*IB*MK97ERP*WORKHUMAN*20261121*1022*4820*X*005010~\nST*846*0001~\nBIA*00*MB*ATS-SNAPSHOT-US*20261121~\nLIN*1*VP*WH1000XM5~\nQTY*33*84*EA~\nCTT*1~\nSE*6*0001~\nGE*1*4820~\nIEA*1*000004820~'
        }
      ]
    };
  }

  function pad(str, len, ch = ' ', left = false) {
    const s = String(str == null ? '' : str);
    if (s.length >= len) return s.slice(0, len);
    const fill = ch.repeat(len - s.length);
    return left ? fill + s : s + fill;
  }

  function cleanEdiText(v, max = 45) {
    return String(v == null ? '' : v).replace(/[*~:\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function makeControlNum(seq = 1) {
    return pad(String(Math.abs(Math.floor(seq || Date.now() % 999999999))), 9, '0', true);
  }

  function yymmdd(d = new Date()) {
    const iso = d.toISOString();
    return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  }

  function ccyymmdd(d = new Date()) {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  function hhmm(d = new Date()) {
    return d.toISOString().slice(11, 16).replace(':', '');
  }

  // Generate standards-compliant ANSI X12 document from live MK97 ERP records
  function generateX12Document(options = {}) {
    const docType = String(options.docType || '850');
    const partner = options.partner || { name: 'Trading Partner', isaQualifier: 'ZZ', isaId: 'PARTNERID001', gsId: 'PARTNERGS', standard: 'X12 005010' };
    const sender = options.sender || { isaQualifier: MK_ISA_QUAL, isaId: MK_ISA_ID, gsId: MK_GS_ID };
    const state = options.state || {};
    const e = state.enterprise || {};
    const now = options.now ? new Date(options.now) : new Date();
    const ctrl = makeControlNum(options.controlSeq || ((Date.now() % 899999) + 100000));
    const gsCtrl = String(Number(ctrl) % 99999 || 1001);
    const stdVer = /4010/.test(partner.standard || '') ? '00401' : '00501';
    const gsVer = stdVer === '00401' ? '004010' : '005010';
    const invMap = new Map((e.inventory || []).map(i => [i.sku, i]));

    const gsCodes = { '850': 'PO', '855': 'PR', '856': 'SH', '810': 'IN', '846': 'IB', '940': 'OW', '945': 'SW', '997': 'FA' };
    const gsFunc = gsCodes[docType] || 'PO';

    const isa = [
      'ISA', '00', pad('', 10), '00', pad('', 10),
      pad(sender.isaQualifier || 'ZZ', 2), pad(sender.isaId || MK_ISA_ID, 15),
      pad(partner.isaQualifier || 'ZZ', 2), pad(partner.isaId || 'PARTNER001', 15),
      yymmdd(now), hhmm(now), stdVer === '00501' ? '^' : 'U', stdVer, ctrl, '0', 'P', ':'
    ].join('*') + '~';

    const gs = ['GS', gsFunc, cleanEdiText(sender.gsId || MK_GS_ID, 15), cleanEdiText(partner.gsId || partner.isaId || 'PARTNER', 15), ccyymmdd(now), hhmm(now), gsCtrl, 'X', gsVer].join('*') + '~';

    const body = [`ST*${docType}*0001~`];
    let reference = '';

    // Pick live record by id or default first record
    const poRec = options.record?.kind === 'PO'
      ? options.record.data
      : (e.purchaseOrders || []).find(p => p.id === options.recordId || p.po === options.recordId) || (e.purchaseOrders || [])[0];
    const ordRec = options.record?.kind === 'ORDER'
      ? options.record.data
      : (e.orders || []).find(o => o.id === options.recordId || o.po === options.recordId) || (e.orders || [])[0];

    if (docType === '850' || docType === '855') {
      const src = poRec || ordRec || { po: 'PO-2026-887411', warehouse: 'MK97 Southeast DC', lines: [{ sku: 'AF-200', qty: 45, cost: 89.50 }] };
      reference = src.po || 'PO-2026-NEW';
      if (docType === '850') {
        body.push(`BEG*00*NE*${cleanEdiText(reference, 22)}**${ccyymmdd(now)}~`);
      } else {
        body.push(`BAK*00*AC*${cleanEdiText(reference, 22)}*${ccyymmdd(now)}~`);
      }
      body.push(`REF*DP*SUPPLYCHAIN~`);
      body.push(`DTM*002*${ccyymmdd(new Date(now.getTime() + 7 * 86400000))}~`);
      body.push(`N1*BY*MK97 ERP Operations*92*MK97HQ~`);
      body.push(`N1*ST*${cleanEdiText(src.warehouse || 'MK97 Southeast DC', 35)}*92*SE01~`);
      const lines = (src.lines && src.lines.length) ? src.lines : [{ sku: 'SKU-001', qty: 25, cost: 45 }];
      let totalQty = 0;
      lines.forEach((ln, idx) => {
        const it = invMap.get(ln.sku);
        const qty = Math.max(1, Number(ln.qty || 1));
        const unitPrice = Number(ln.cost || ln.price || it?.cost || 50).toFixed(2);
        const model = cleanEdiText(it?.model || ln.sku || `ITEM-${idx + 1}`, 24);
        totalQty += qty;
        body.push(`PO1*${idx + 1}*${qty}*EA*${unitPrice}**VP*${model}*SK*${cleanEdiText(ln.sku || model, 24)}~`);
        if (it?.title) body.push(`PID*F****${cleanEdiText(it.title, 48)}~`);
        if (docType === '855') body.push(`ACK*IA*${qty}*EA*068*${ccyymmdd(new Date(now.getTime() + 5 * 86400000))}~`);
      });
      body.push(`CTT*${lines.length}*${totalQty}~`);
    } else if (docType === '856') {
      const src = ordRec || poRec || { po: 'PO-2026-89108', tracking: '1Z999AA10123456784', carrier: 'UPSN', lines: [{ sku: 'WH1000XM5', qty: 12 }] };
      reference = src.po || 'ASN-2026-001';
      const tracking = cleanEdiText(src.tracking || '1Z999AA10123456784', 30);
      const scac = /fedex|fdx/i.test(src.carrier || '') ? 'FDEG' : /dhl/i.test(src.carrier || '') ? 'DHLC' : 'UPSN';
      body.push(`BSN*00*ASN-${cleanEdiText(reference, 18)}*${ccyymmdd(now)}*${hhmm(now)}*0001~`);
      body.push(`HL*1**S~`);
      body.push(`TD5*B*2*${scac}*M~`);
      body.push(`REF*BM*BOL-${ctrl.slice(-6)}~`);
      body.push(`REF*CN*${tracking}~`);
      body.push(`DTM*011*${ccyymmdd(now)}~`);
      body.push(`N1*SF*MK97 Southeast DC*92*SE01~`);
      body.push(`HL*2*1*O~`);
      body.push(`PRF*${cleanEdiText(reference, 22)}***${ccyymmdd(now)}~`);
      let hl = 3;
      const lines = (src.lines && src.lines.length) ? src.lines : [{ sku: 'WH1000XM5', qty: 10 }];
      lines.forEach((ln, idx) => {
        const it = invMap.get(ln.sku);
        const model = cleanEdiText(it?.model || ln.sku, 24);
        body.push(`HL*${hl++}*2*P~`);
        body.push(`MAN*GM*0000849100${pad(String(idx + 1), 8, '0', true)}~`);
        body.push(`HL*${hl++}*${hl - 2}*I~`);
        body.push(`LIN*${idx + 1}*VP*${model}~`);
        body.push(`SN1*${idx + 1}*${Math.max(1, Number(ln.qty || 1))}*EA~`);
      });
      body.push(`CTT*${hl - 1}~`);
    } else if (docType === '810') {
      const src = ordRec || poRec || { po: 'PO-2026-89108', lines: [{ sku: 'WH1000XM5', qty: 12, price: 329.00 }] };
      reference = src.po || 'INV-2026-001';
      const invNo = `INV-${ctrl.slice(-6)}`;
      body.push(`BIG*${ccyymmdd(now)}*${invNo}*${ccyymmdd(now)}*${cleanEdiText(reference, 22)}~`);
      body.push(`ITD*01*3*****30~`);
      body.push(`N1*RE*MK97 ERP Operations*92*MK97HQ~`);
      const lines = (src.lines && src.lines.length) ? src.lines : [{ sku: 'WH1000XM5', qty: 10, price: 299 }];
      let totalCents = 0;
      lines.forEach((ln, idx) => {
        const it = invMap.get(ln.sku);
        const qty = Math.max(1, Number(ln.qty || 1));
        const unit = Number(ln.price || ln.cost || it?.standardPrice || 100);
        totalCents += Math.round(qty * unit * 100);
        body.push(`IT1*${idx + 1}*${qty}*EA*${unit.toFixed(2)}**VP*${cleanEdiText(it?.model || ln.sku, 24)}~`);
      });
      body.push(`TDS*${totalCents}~`);
      body.push(`CTT*${lines.length}~`);
    } else if (docType === '846') {
      reference = `ATS-${ccyymmdd(now)}`;
      body.push(`BIA*00*MB*${reference}*${ccyymmdd(now)}~`);
      body.push(`N1*WH*MK97 Unified Inventory*92*MK97ALL~`);
      const items = (e.inventory || []).filter(i => i.nature !== 'DIGITAL').slice(0, 8);
      const list = items.length ? items : [{ sku: 'WH1000XM5', model: 'WH1000XM5', onHand: 80, reserved: 12, damaged: 0 }];
      list.forEach((it, idx) => {
        const free = Math.max(0, Number(it.onHand || 0) - Number(it.reserved || 0) - Number(it.damaged || 0));
        body.push(`LIN*${idx + 1}*VP*${cleanEdiText(it.model || it.sku, 24)}*SK*${cleanEdiText(it.sku, 24)}~`);
        body.push(`QTY*33*${free}*EA~`);
      });
      body.push(`CTT*${list.length}~`);
    } else if (docType === '940' || docType === '945') {
      const src = ordRec || { po: 'PO-2026-89108', lines: [{ sku: 'WH1000XM5', qty: 12 }], shipping: { destination: 'Austin, TX' } };
      reference = src.po || 'WHS-2026-001';
      if (docType === '940') {
        body.push(`W05*N*${cleanEdiText(reference, 22)}*${cleanEdiText(src.orderNumber || reference, 22)}~`);
      } else {
        body.push(`W06*F*${cleanEdiText(reference, 22)}*${ccyymmdd(now)}*${cleanEdiText(src.tracking || 'FDX774920011', 24)}~`);
      }
      body.push(`N1*ST*${cleanEdiText(src.shipping?.destination || 'Customer Fulfillment Destination', 35)}~`);
      body.push(`G62*10*${ccyymmdd(new Date(now.getTime() + 2 * 86400000))}~`);
      const lines = (src.lines && src.lines.length) ? src.lines : [{ sku: 'WH1000XM5', qty: 10 }];
      let totalQty = 0;
      lines.forEach((ln, idx) => {
        const it = invMap.get(ln.sku);
        const qty = Math.max(1, Number(ln.qty || 1));
        totalQty += qty;
        body.push(`LX*${idx + 1}~`);
        body.push(docType === '940'
          ? `W01*${qty}*EA**VN*${cleanEdiText(it?.model || ln.sku, 24)}~`
          : `W12*CC*${qty}*${qty}*0*EA**VN*${cleanEdiText(it?.model || ln.sku, 24)}~`);
      });
      body.push(`W76*${totalQty}~`);
    } else if (docType === '997') {
      const origDoc = options.ackDocType || '850';
      const origGs = options.ackGsCtrl || gsCtrl;
      reference = `ACK-${origDoc}-${origGs}`;
      body.push(`AK1*${gsCodes[origDoc] || 'PO'}*${origGs}~`);
      body.push(`AK2*${origDoc}*0001~`);
      body.push(`AK5*A~`);
      body.push(`AK9*A*1*1*1~`);
    }

    const segCount = body.length + 1; // ST through SE inclusive
    body.push(`SE*${segCount}*0001~`);

    const ge = `GE*1*${gsCtrl}~`;
    const iea = `IEA*1*${ctrl}~`;
    const raw = [isa, gs, ...body, ge, iea].join('\n');

    return {
      docType,
      docName: EDI_DOC_CATALOG[docType]?.name || `X12 ${docType}`,
      controlNumber: ctrl,
      gsControlNumber: gsCtrl,
      reference,
      segmentCount: segCount + 4,
      raw,
      ack997: docType === '997' ? null : generateX12Document({
        docType: '997',
        partner: sender,
        sender: partner,
        ackDocType: docType,
        ackGsCtrl: gsCtrl,
        controlSeq: Number(ctrl) + 1,
        now
      }).raw
    };
  }

  // Parse & validate any inbound ANSI X12 EDI text into structured JSON + human summary
  function parseX12Document(rawText) {
    const clean = String(rawText || '').trim();
    if (!clean) return { valid: false, errors: ['Empty EDI payload.'], segments: [], summary: null };

    // Detect element separator (4th char after ISA) and segment terminator
    const elemSep = clean.startsWith('ISA') && clean.length > 3 ? clean[3] : '*';
    const segTerm = clean.includes('~') ? '~' : (clean.includes('\n') ? '\n' : '~');
    const rawSegs = clean.split(segTerm).map(s => s.replace(/^[\r\n\s]+|[\r\n\s]+$/g, '')).filter(Boolean);

    const segments = rawSegs.map(line => {
      const parts = line.split(elemSep);
      return { id: (parts[0] || '').trim().toUpperCase(), elements: parts.slice(1), raw: line };
    });

    const errors = [];
    const warnings = [];
    const byId = id => segments.filter(s => s.id === id);
    const first = id => segments.find(s => s.id === id);

    const isa = first('ISA');
    const gs = first('GS');
    const st = first('ST');
    const se = first('SE');
    const ge = first('GE');
    const iea = first('IEA');

    if (!isa) errors.push('Missing ISA Interchange Control Header.');
    if (!st) errors.push('Missing ST Transaction Set Header.');
    if (!se) errors.push('Missing SE Transaction Set Trailer.');
    if (!iea) warnings.push('Missing IEA Interchange Trailer.');

    if (st && se) {
      const stIdx = segments.indexOf(st);
      const seIdx = segments.indexOf(se);
      const actualCount = seIdx - stIdx + 1;
      const declared = Number(se.elements[0] || 0);
      if (declared && declared !== actualCount) {
        warnings.push(`SE01 declared ${declared} segments, parsed ${actualCount}.`);
      }
    }
    if (isa && iea && isa.elements[12] && iea.elements[1] && isa.elements[12].trim() !== iea.elements[1].trim()) {
      warnings.push(`ISA13 (${isa.elements[12].trim()}) does not match IEA02 (${iea.elements[1].trim()}).`);
    }

    const docType = st?.elements[0] || 'UNKNOWN';
    const senderId = (isa?.elements[5] || gs?.elements[1] || '').trim();
    const receiverId = (isa?.elements[7] || gs?.elements[2] || '').trim();
    const controlNumber = (isa?.elements[12] || '000000001').trim();

    // Extract business fields depending on docType
    const beg = first('BEG') || first('BAK') || first('BSN') || first('BIG') || first('BIA') || first('W05') || first('W06');
    const refOrder = beg ? (docType === '810' ? beg.elements[3] : docType === '856' ? beg.elements[1] : docType === '940' || docType === '945' ? beg.elements[1] : beg.elements[2]) : '';
    const trackingSeg = byId('REF').find(s => ['CN', '2I', 'BM'].includes(s.elements[0]));
    const tracking = trackingSeg?.elements[1] || (docType === '945' ? first('W06')?.elements[3] : '') || '';
    const carrier = first('TD5')?.elements[2] || '';
    const parties = byId('N1').map(s => ({ qualifier: s.elements[0], name: s.elements[1] || '', code: s.elements[3] || '' }));

    const lines = [];
    for (const po1 of byId('PO1')) {
      const vpIdx = po1.elements.indexOf('VP');
      const skIdx = po1.elements.indexOf('SK');
      const sku = (vpIdx >= 0 ? po1.elements[vpIdx + 1] : '') || (skIdx >= 0 ? po1.elements[skIdx + 1] : '') || po1.elements[6] || 'SKU';
      lines.push({ lineNo: po1.elements[0], qty: Number(po1.elements[1] || 0), uom: po1.elements[2] || 'EA', unitPrice: Number(po1.elements[3] || 0), sku });
    }
    if (!lines.length) {
      const lins = byId('LIN');
      const qtys = byId('QTY');
      const sn1s = byId('SN1');
      lins.forEach((ln, i) => {
        const sku = ln.elements[2] || ln.elements[4] || `ITEM-${i + 1}`;
        const qty = Number(qtys[i]?.elements[1] || sn1s[i]?.elements[1] || 0);
        lines.push({ lineNo: String(i + 1), qty, uom: 'EA', unitPrice: 0, sku });
      });
    }
    if (!lines.length) {
      for (const w of [...byId('W01'), ...byId('W12')]) {
        const vnIdx = w.elements.indexOf('VN');
        lines.push({ lineNo: String(lines.length + 1), qty: Number(w.elements[0] || w.elements[1] || 0), uom: 'EA', unitPrice: 0, sku: vnIdx >= 0 ? w.elements[vnIdx + 1] : 'SKU' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      docType,
      docName: EDI_DOC_CATALOG[docType]?.name || `X12 ${docType}`,
      senderId,
      receiverId,
      controlNumber,
      reference: refOrder || first('PRF')?.elements[0] || '',
      tracking,
      carrier,
      parties,
      lines,
      segmentCount: segments.length,
      segments
    };
  }

  // Apply custom field mappings to transform an MK97 ERP object into a partner's exact JSON shape
  function applyFieldMapping(record, mappings = []) {
    if (!record || typeof record !== 'object') return {};
    if (!Array.isArray(mappings) || !mappings.length) return { ...record };

    const out = {};
    const setNested = (obj, path, val) => {
      const keys = String(path || '').split('.').filter(Boolean);
      if (!keys.length) return;
      let cur = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = val;
    };

    for (const m of mappings) {
      if (!m?.source || !m?.target) continue;
      let val = record[m.source];
      if (val === undefined) continue;
      if (m.transform === 'UPPERCASE' && typeof val === 'string') val = val.toUpperCase();
      else if (m.transform === 'LOWERCASE' && typeof val === 'string') val = val.toLowerCase();
      else if (m.transform === 'NUMBER') val = Number(val) || 0;
      else if (m.transform === 'ISO_DATE' && val) val = String(val).slice(0, 10);
      else if (m.transform === 'STRING' && typeof val !== 'object') val = String(val);
      setNested(out, m.target, val);
    }
    return out;
  }

  // Build ready-to-send live ERP JSON payload for API connections
  function buildLiveErpPayload(kind, state, mappings = []) {
    const e = state?.enterprise || {};
    const l = state?.logistics || {};
    const now = new Date().toISOString();

    if (kind === 'ORDER') {
      const o = (e.orders || []).find(x => !['SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED'].includes(x.status)) || (e.orders || [])[0];
      if (!o) return { event: 'ORDER_SYNC', timestamp: now, orders: [] };
      const acct = (e.accounts || []).find(a => a.id === o.accountId);
      const base = {
        po: o.po,
        orderNumber: o.orderNumber || o.id,
        status: o.status,
        customerName: acct?.name || 'Customer',
        inHandsDate: o.inHandsDate || '',
        tracking: o.tracking || '',
        lines: (o.lines || []).map(ln => ({ sku: ln.sku, qty: ln.qty, price: ln.price }))
      };
      return {
        event: 'mk97.order.sync',
        sentAt: now,
        source: 'MK97 ERP',
        data: mappings.length ? applyFieldMapping(base, mappings) : base
      };
    }

    if (kind === 'PO') {
      const p = (e.purchaseOrders || []).find(x => !['RECEIVED', 'CANCELLED', 'CLOSED'].includes(x.status)) || (e.purchaseOrders || [])[0];
      if (!p) return { event: 'VENDOR_PO_SYNC', timestamp: now, purchaseOrders: [] };
      const v = (e.vendors || []).find(x => x.id === p.vendorId);
      const base = {
        po: p.po,
        vendorName: v?.name || 'Supplier',
        status: p.status,
        eta: p.eta || '',
        warehouse: p.warehouse || 'MK97 Southeast DC',
        lines: (p.lines || []).map(ln => ({ sku: ln.sku, qty: ln.qty, cost: ln.cost }))
      };
      return {
        event: 'mk97.purchase_order.dispatched',
        sentAt: now,
        source: 'MK97 ERP',
        data: mappings.length ? applyFieldMapping(base, mappings) : base
      };
    }

    if (kind === 'INVENTORY') {
      const items = (e.inventory || []).filter(i => i.nature !== 'DIGITAL').slice(0, 8).map(i => {
        const base = {
          sku: i.sku,
          model: i.model || i.sku,
          brand: i.brand || '',
          onHand: Number(i.onHand || 0),
          reserved: Number(i.reserved || 0),
          available: Math.max(0, Number(i.onHand || 0) - Number(i.reserved || 0) - Number(i.damaged || 0)),
          cost: Number(i.cost || 0)
        };
        return mappings.length ? applyFieldMapping(base, mappings) : base;
      });
      return {
        event: 'mk97.inventory.ats_snapshot',
        sentAt: now,
        region: state?.region || 'US',
        skuCount: items.length,
        inventory: items
      };
    }

    if (kind === 'TPL') {
      const s = (l.tplShipments || [])[0] || { id: 'TPL-SHP-77492', orderId: 'PO-2026-89108', nodeId: 'tpl_east', sku: 'WH1000XM5', qty: 12, status: 'DELAYED' };
      return {
        event: 'mk97.3pl.shipment_dispatch',
        sentAt: now,
        shipment: s
      };
    }

    // Default: Executive Alert / Webhook Ping
    return {
      event: 'mk97.erp.health_ping',
      sentAt: now,
      source: 'MK97 ERP Connections Hub',
      summary: {
        openOrders: (e.orders || []).filter(o => !['SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED'].includes(o.status)).length,
        openPOs: (e.purchaseOrders || []).filter(p => !['RECEIVED', 'CANCELLED', 'CLOSED'].includes(p.status)).length,
        activeSkus: (e.inventory || []).length
      }
    };
  }

  // Generate clean copy-ready cURL, JS fetch, and Python snippets for any API connection
  function generateCodeSnippets(conn, payloadObj) {
    const method = (conn?.method || 'POST').toUpperCase();
    const url = conn?.endpoint || 'https://api.partner.com/v1/webhook';
    const headers = { 'Content-Type': 'application/json', ...(conn?.headers || {}) };
    if (conn?.authType === 'BEARER') headers['Authorization'] = `Bearer ${conn.authSecret || '<YOUR_TOKEN>'}`;
    else if (conn?.authType === 'API_KEY') headers[conn.authHeader || 'X-API-Key'] = conn.authSecret || '<YOUR_API_KEY>';
    else if (conn?.authType === 'BASIC') headers['Authorization'] = `Basic <BASE64_CREDENTIALS>`;
    else if (conn?.authType === 'HMAC_SHA256') headers[conn.authHeader || 'X-MK97-Signature'] = 'sha256=<HMAC_DIGEST>';

    const bodyJson = JSON.stringify(payloadObj || { ping: 'mk97' }, null, 2);
    const curlHeaders = Object.entries(headers).map(([k, v]) => `  -H "${k}: ${v}"`).join(' \\\n');
    const curl = method === 'GET'
      ? `curl -X GET "${url}" \\\n${curlHeaders}`
      : `curl -X ${method} "${url}" \\\n${curlHeaders} \\\n  -d '${bodyJson.replace(/'/g, "\\'")}'`;

    const js = `const res = await fetch("${url}", {\n  method: "${method}",\n  headers: ${JSON.stringify(headers, null, 2)}${method === 'GET' ? '' : `,\n  body: JSON.stringify(${bodyJson})`}\n});\nconst data = await res.json();\nconsole.log(res.status, data);`;

    const py = `import requests\n\nres = requests.${method.toLowerCase()}(\n    "${url}",\n    headers=${JSON.stringify(headers, null, 4)}${method === 'GET' ? '' : `,\n    json=${bodyJson}`}\n)\nprint(res.status_code, res.json())`;

    return { curl, js, py };
  }

  // Summarize live connections health for dashboard KPIs & MK Co-Pilot
  function summarizeConnections(storeData) {
    const list = storeData?.connections || [];
    const logs = storeData?.logs || [];
    const edi = list.filter(c => c.category === 'EDI');
    const api = list.filter(c => c.category === 'API');
    const active = list.filter(c => c.active !== false && c.status === 'CONNECTED');
    const totalTx = list.reduce((s, c) => s + Number(c.txCount || 0), 0);
    const avgSuccess = list.length ? list.reduce((s, c) => s + Number(c.successRate || 100), 0) / list.length : 100;
    const avgLatency = list.length ? Math.round(list.reduce((s, c) => s + Number(c.latencyMs || 100), 0) / list.length) : 0;
    const ediTx = logs.filter(l => l.kind === 'EDI').length;
    const apiTx = logs.filter(l => l.kind === 'API').length;
    return {
      total: list.length,
      activeCount: active.length,
      ediCount: edi.length,
      apiCount: api.length,
      totalTx,
      avgSuccess: Number(avgSuccess.toFixed(1)),
      avgLatency,
      recentEdiLogs: ediTx,
      recentApiLogs: apiTx
    };
  }

  return {
    VERSION,
    MK_ISA_QUAL,
    MK_ISA_ID,
    MK_GS_ID,
    EDI_DOC_CATALOG,
    PARTNER_TEMPLATES,
    DEFAULT_MAPPINGS,
    seedConnections,
    generateX12Document,
    parseX12Document,
    applyFieldMapping,
    buildLiveErpPayload,
    generateCodeSnippets,
    summarizeConnections
  };
});
