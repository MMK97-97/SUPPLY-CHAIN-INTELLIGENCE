(() => {
  "use strict";

  if (window.__STARK_OPERATIONS_SUITE__) return;
  window.__STARK_OPERATIONS_SUITE__ = true;

  const root = document.getElementById("operations-root");
  const moduleKey = document.body.dataset.opsModule;
  if (!root || !moduleKey) return;

  const esc = value => String(value == null ? "" : value).replace(/[&<>\"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[character]));
  const clean = value => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const uuid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const dateValue = value => value ? String(value).slice(0, 10) : "";
  const dateTimeValue = value => value ? new Date(value).toISOString().slice(0, 16) : "";
  const regionNames = { US: "United States", EU: "European Union", CA: "Canada" };
  const icons = {
    network: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="m7 7 3 3m4 0 3-3m-7 7-3 3m7-3 3 3"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    money: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v12"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6M14 11v6"/></svg>',
    activity: '<svg viewBox="0 0 24 24"><path d="M4 12h4l2-6 4 12 2-6h4"/></svg>'
  };

  const configs = {
    crm: {
      table: "crm_accounts", title: "Customer Relationship Management", shortTitle: "CRM",
      eyebrow: "CUSTOMER OPERATIONS", noun: "account", plural: "accounts", prefix: "ACC",
      description: "Manage customer and prospect relationships, commercial terms, balances, contacts and follow-up commitments in one regional workspace.",
      filterLabel: "Account status", filterOptions: [["", "All accounts"], ["active", "Active"], ["prospect", "Prospects"], ["on_hold", "On hold"], ["inactive", "Inactive"]],
      filter: (row, value) => !value || row.account_status === value,
      fields: [
        { section: "Account identity" },
        { name: "account_name", label: "Account name", required: true },
        { name: "account_code", label: "Account code", placeholder: "Generated if blank" },
        { name: "account_type", label: "Relationship", type: "select", options: [["customer","Customer"],["prospect","Prospect"],["partner","Partner"]], default: "customer" },
        { name: "account_status", label: "Status", type: "select", options: [["active","Active"],["prospect","Prospect"],["on_hold","On hold"],["inactive","Inactive"]], default: "active" },
        { name: "segment", label: "Segment", placeholder: "Enterprise, gifting, wholesale…" },
        { section: "Primary contact" },
        { name: "primary_contact_name", label: "Contact name" },
        { name: "primary_contact_email", label: "Email", type: "email" },
        { name: "primary_contact_phone", label: "Phone", type: "tel" },
        { section: "Commercial controls" },
        { name: "currency", label: "Currency", type: "select", options: [["USD","USD"],["EUR","EUR"],["CAD","CAD"],["GBP","GBP"]], default: "USD" },
        { name: "payment_terms", label: "Payment terms", placeholder: "Net 30" },
        { name: "credit_limit", label: "Credit limit", type: "number", min: 0, step: ".01", default: 0 },
        { name: "open_balance", label: "Open balance", type: "number", min: 0, step: ".01", default: 0 },
        { name: "next_follow_up_at", label: "Next follow-up", type: "datetime-local" },
        { name: "shipping_address_text", label: "Primary shipping address", wide: true, jsonTarget: "shipping_address" },
        { name: "notes", label: "Relationship notes", type: "textarea", wide: true }
      ],
      columns: [
        { key: "account_code", label: "Account", main: true, width: 120 },
        { key: "account_name", label: "Customer / prospect", width: 210 },
        { key: "account_type", label: "Type", badge: true, width: 105 },
        { key: "primary_contact_name", label: "Primary contact", width: 155 },
        { key: "primary_contact_email", label: "Email", width: 190 },
        { key: "account_status", label: "Status", badge: true, width: 105 },
        { key: "open_balance", label: "Open balance", currency: true, width: 120 },
        { key: "next_follow_up_at", label: "Next follow-up", date: true, width: 125 },
        { key: "activity_count", label: "Activities", number: true, width: 85, value: row => row.activities?.length || 0 }
      ],
      hasActivities: true
    },
    orders: {
      table: "sales_orders", lineTable: "sales_order_lines", lineForeignKey: "order_id", title: "Order Management", shortTitle: "Orders",
      eyebrow: "CUSTOMER FULFILLMENT", noun: "order", plural: "orders", prefix: "SO",
      description: "Control event and regular orders from confirmation through allocation, shipment and delivery with complete item-level visibility.",
      filterLabel: "Order view", filterOptions: [["", "All orders"], ["type:event", "Event orders"], ["type:regular", "Regular orders"], ["confirmed", "Confirmed"], ["allocated", "Allocated"], ["on_hold", "On hold"], ["shipped", "Shipped"], ["delivered", "Delivered"]],
      filter: (row, value) => !value || (value.startsWith("type:") ? row.order_type === value.split(":")[1] : row.order_status === value),
      fields: [
        { section: "Order identity" },
        { name: "order_number", label: "Order number", placeholder: "Generated if blank" },
        { name: "order_type", label: "Order type", type: "select", options: [["regular","Regular order"],["event","Event order"]], default: "regular" },
        { name: "account_id", label: "CRM account", type: "relation", relation: "accounts", optional: true },
        { name: "customer_name", label: "Customer name", required: true },
        { name: "external_reference", label: "Customer PO / reference" },
        { name: "event_name", label: "Event name", showWhen: ["order_type", "event"] },
        { name: "event_date", label: "Event date", type: "date", showWhen: ["order_type", "event"] },
        { section: "Planning and fulfillment" },
        { name: "order_date", label: "Order date", type: "date", required: true, default: today },
        { name: "required_date", label: "Required date", type: "date" },
        { name: "order_status", label: "Status", type: "select", options: [["draft","Draft"],["confirmed","Confirmed"],["allocated","Allocated"],["partially_shipped","Partially shipped"],["shipped","Shipped"],["delivered","Delivered"],["on_hold","On hold"],["cancelled","Cancelled"]], default: "draft" },
        { name: "priority", label: "Priority", type: "select", options: [["low","Low"],["normal","Normal"],["high","High"],["critical","Critical"]], default: "normal" },
        { name: "fulfillment_mode", label: "Fulfillment", type: "select", options: [["warehouse","Warehouse"],["dropship","Dropship"],["mixed","Mixed"]], default: "warehouse" },
        { name: "shipping_method", label: "Shipping method" },
        { name: "currency", label: "Currency", type: "select", options: [["USD","USD"],["EUR","EUR"],["CAD","CAD"],["GBP","GBP"]], default: "USD" },
        { name: "shipping_amount", label: "Shipping amount", type: "number", min: 0, step: ".01", default: 0 },
        { name: "tax_amount", label: "Tax amount", type: "number", min: 0, step: ".01", default: 0 },
        { name: "discount_amount", label: "Discount", type: "number", min: 0, step: ".01", default: 0 },
        { name: "shipping_address_text", label: "Ship-to address", wide: true, jsonTarget: "shipping_address" },
        { name: "notes", label: "Order notes", type: "textarea", wide: true }
      ],
      lines: { priceKey: "unit_price", priceLabel: "Unit price", status: "open" },
      columns: [
        { key: "order_number", label: "Order #", main: true, width: 130 },
        { key: "order_type", label: "Type", badge: true, width: 95 },
        { key: "customer_name", label: "Customer", width: 185 },
        { key: "external_reference", label: "Reference", width: 130 },
        { key: "event_name", label: "Event", width: 155 },
        { key: "required_date", label: "Required", date: true, width: 110 },
        { key: "order_status", label: "Status", badge: true, width: 125 },
        { key: "units", label: "Units", number: true, width: 80, value: row => sumLines(row, "quantity_ordered") },
        { key: "total_amount", label: "Order value", currency: true, width: 120, value: row => orderTotal(row) }
      ]
    },
    vendors: {
      table: "vendors", title: "Vendor Management", shortTitle: "Vendors",
      eyebrow: "SUPPLIER GOVERNANCE", noun: "vendor", plural: "vendors", prefix: "VEN",
      description: "Maintain vendor contacts, commercial terms, fulfillment capabilities, compliance and delivery performance for every regional supplier.",
      filterLabel: "Vendor view", filterOptions: [["", "All vendors"], ["active", "Active"], ["pending", "Pending"], ["on_hold", "On hold"], ["compliance:expired", "Compliance expired"], ["dropship:true", "Dropship capable"]],
      filter: (row, value) => !value || (value.startsWith("compliance:") ? row.compliance_status === value.split(":")[1] : value === "dropship:true" ? row.supports_dropship : row.vendor_status === value),
      fields: [
        { section: "Vendor identity" },
        { name: "vendor_name", label: "Vendor name", required: true },
        { name: "vendor_code", label: "Vendor code", placeholder: "Generated if blank" },
        { name: "vendor_status", label: "Status", type: "select", options: [["active","Active"],["pending","Pending"],["on_hold","On hold"],["inactive","Inactive"]], default: "active" },
        { section: "Contacts" },
        { name: "primary_contact_name", label: "Primary contact" },
        { name: "primary_contact_email", label: "Contact email", type: "email" },
        { name: "primary_contact_phone", label: "Phone", type: "tel" },
        { name: "ordering_email", label: "Ordering email", type: "email" },
        { name: "address_text", label: "Vendor address", wide: true, jsonTarget: "address" },
        { section: "Commercial and logistics" },
        { name: "currency", label: "Currency", type: "select", options: [["USD","USD"],["EUR","EUR"],["CAD","CAD"],["GBP","GBP"]], default: "USD" },
        { name: "payment_terms", label: "Payment terms", placeholder: "Net 30" },
        { name: "incoterm", label: "Incoterm", placeholder: "FOB, DDP, EXW…" },
        { name: "lead_time_days", label: "Lead time (days)", type: "number", min: 0, step: "1", default: 0 },
        { name: "minimum_order_value", label: "Minimum order value", type: "number", min: 0, step: ".01", default: 0 },
        { name: "shipping_cost_responsibility", label: "Shipping cost responsibility", type: "select", options: [["unknown","Not confirmed"],["us","Us"],["vendor","Vendor"],["shared","Shared"]], default: "unknown" },
        { name: "supports_dropship", label: "Supports dropship", type: "checkbox" },
        { name: "supports_pallet", label: "Supports pallet shipping", type: "checkbox" },
        { section: "Compliance and performance" },
        { name: "compliance_status", label: "Compliance", type: "select", options: [["pending","Pending"],["approved","Approved"],["expired","Expired"],["blocked","Blocked"]], default: "pending" },
        { name: "compliance_expiry", label: "Compliance expiry", type: "date" },
        { name: "on_time_delivery_pct", label: "On-time delivery %", type: "number", min: 0, max: 100, step: ".01" },
        { name: "quality_score", label: "Quality score %", type: "number", min: 0, max: 100, step: ".01" },
        { name: "notes", label: "Vendor notes", type: "textarea", wide: true }
      ],
      columns: [
        { key: "vendor_code", label: "Vendor", main: true, width: 115 },
        { key: "vendor_name", label: "Vendor name", width: 190 },
        { key: "primary_contact_name", label: "Contact", width: 145 },
        { key: "lead_time_days", label: "Lead time", number: true, suffix: " days", width: 90 },
        { key: "shipping_cost_responsibility", label: "Freight", badge: true, width: 100 },
        { key: "supports_dropship", label: "Dropship", boolean: true, width: 80 },
        { key: "compliance_status", label: "Compliance", badge: true, width: 110 },
        { key: "on_time_delivery_pct", label: "OTD", percent: true, width: 80 },
        { key: "vendor_status", label: "Status", badge: true, width: 95 }
      ]
    },
    "vendor-pos": {
      table: "vendor_purchase_orders", lineTable: "vendor_po_lines", lineForeignKey: "purchase_order_id", title: "Vendor PO Management", shortTitle: "Vendor POs",
      eyebrow: "PROCUREMENT EXECUTION", noun: "purchase order", plural: "purchase orders", prefix: "PO",
      description: "Control event, inventory and dropship purchase orders from draft through vendor confirmation, shipment and receipt.",
      filterLabel: "PO view", filterOptions: [["", "All purchase orders"], ["type:event", "Event POs"], ["type:inventory", "Inventory POs"], ["type:dropship", "Dropship POs"], ["submitted", "Submitted"], ["acknowledged", "Acknowledged"], ["shipped", "Shipped"], ["received", "Received"], ["on_hold", "On hold"]],
      filter: (row, value) => !value || (value.startsWith("type:") ? row.po_type === value.split(":")[1] : row.po_status === value),
      fields: [
        { section: "Purchase order identity" },
        { name: "po_number", label: "PO number", placeholder: "Generated if blank" },
        { name: "po_type", label: "PO type", type: "select", options: [["inventory","Inventory"],["event","Event"],["dropship","Dropship"]], default: "inventory" },
        { name: "vendor_id", label: "Vendor", type: "relation", relation: "vendors", required: true },
        { name: "sales_order_id", label: "Linked customer order", type: "relation", relation: "orders", optional: true },
        { name: "event_reference", label: "Event reference", showWhen: ["po_type", "event"] },
        { section: "Dates and fulfillment" },
        { name: "order_date", label: "PO date", type: "date", required: true, default: today },
        { name: "expected_date", label: "Expected date", type: "date" },
        { name: "po_status", label: "Status", type: "select", options: [["draft","Draft"],["submitted","Submitted"],["acknowledged","Acknowledged"],["partial","Partially received"],["shipped","Shipped"],["received","Received"],["on_hold","On hold"],["cancelled","Cancelled"]], default: "draft" },
        { name: "ship_to_type", label: "Ship to", type: "select", options: [["warehouse","Warehouse"],["customer","Customer"],["event_venue","Event venue"]], default: "warehouse" },
        { name: "ship_to_address_text", label: "Ship-to address", wide: true, jsonTarget: "ship_to_address" },
        { section: "Cost and tracking" },
        { name: "currency", label: "Currency", type: "select", options: [["USD","USD"],["EUR","EUR"],["CAD","CAD"],["GBP","GBP"]], default: "USD" },
        { name: "freight_amount", label: "Freight", type: "number", min: 0, step: ".01", default: 0 },
        { name: "duty_amount", label: "Duty", type: "number", min: 0, step: ".01", default: 0 },
        { name: "tax_amount", label: "Tax", type: "number", min: 0, step: ".01", default: 0 },
        { name: "carrier", label: "Carrier" },
        { name: "tracking_number", label: "Tracking number" },
        { name: "vendor_confirmation", label: "Vendor confirmation" },
        { name: "notes", label: "PO notes", type: "textarea", wide: true }
      ],
      lines: { priceKey: "unit_cost", priceLabel: "Unit cost", status: "open" },
      columns: [
        { key: "po_number", label: "PO #", main: true, width: 125 },
        { key: "po_type", label: "Type", badge: true, width: 95 },
        { key: "vendor_name", label: "Vendor", width: 175, value: row => relatedName("vendors", row.vendor_id) },
        { key: "linked_order", label: "Linked order", width: 125, value: row => relatedName("orders", row.sales_order_id) },
        { key: "expected_date", label: "Expected", date: true, width: 110 },
        { key: "po_status", label: "Status", badge: true, width: 120 },
        { key: "units", label: "Units", number: true, width: 75, value: row => sumLines(row, "quantity_ordered") },
        { key: "total_amount", label: "PO value", currency: true, width: 115, value: row => poTotal(row) },
        { key: "tracking_number", label: "Tracking", width: 145 }
      ]
    }
  };

  const config = configs[moduleKey];
  if (!config) return;

  const state = {
    region: regionCode(), organizationId: "", userId: "", role: "viewer", mode: "checking",
    records: [], activities: [], related: { accounts: [], vendors: [], orders: [] },
    query: "", filter: "", page: 1, pageSize: 10, editingId: "", realtime: null,
    channel: "BroadcastChannel" in window ? new BroadcastChannel("stark-operations-suite-v1") : null
  };

  function regionCode() {
    const query = new URLSearchParams(location.search).get("region");
    const stored = localStorage.getItem("stark-selected-region");
    const value = clean(query || stored || "US").toUpperCase();
    const region = value === "EU" ? "EU" : value === "CA" || value === "CANADA" ? "CA" : "US";
    try { localStorage.setItem("stark-selected-region", region); } catch (_) {}
    document.body.dataset.region = region;
    return region;
  }

  function localKey(entity = moduleKey) {
    return `stark-operations-v1:${state.organizationId || "local"}:${state.region}:${entity}`;
  }

  function readLocal(entity = moduleKey) {
    try {
      const value = JSON.parse(localStorage.getItem(localKey(entity)) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function writeLocal(rows, entity = moduleKey) {
    try { localStorage.setItem(localKey(entity), JSON.stringify(rows)); } catch (_) {}
  }

  function currency(value, code = "USD") {
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: clean(code) || "USD", maximumFractionDigits: 0 }).format(finite(value)); }
    catch (_) { return `$${finite(value).toLocaleString()}`; }
  }

  function displayDate(value, includeTime = false) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return esc(value);
    return new Intl.DateTimeFormat("en-US", includeTime ? { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" } : { month:"short", day:"numeric", year:"numeric" }).format(parsed);
  }

  function sumLines(row, key) { return (row.lines || []).reduce((total, line) => total + finite(line[key]), 0); }
  function lineSubtotal(row, priceKey) { return (row.lines || []).reduce((total, line) => total + finite(line.quantity_ordered) * finite(line[priceKey]), 0); }
  function orderTotal(row) { return lineSubtotal(row, "unit_price") + finite(row.shipping_amount) + finite(row.tax_amount) - finite(row.discount_amount); }
  function poTotal(row) { return lineSubtotal(row, "unit_cost") + finite(row.freight_amount) + finite(row.duty_amount) + finite(row.tax_amount); }

  function relatedName(type, id) {
    if (!id) return "—";
    const row = state.related[type]?.find(item => item.id === id);
    if (!row) return "—";
    return type === "accounts" ? row.account_name : type === "vendors" ? row.vendor_name : row.order_number;
  }

  function canEdit() { return ["owner", "admin", "planner"].includes(state.role); }

  function recordCode(prefix) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function renderShell() {
    const links = [
      ["crm", "CRM", "crm.html"], ["orders", "Orders", "order-management.html"],
      ["vendors", "Vendors", "vendor-management.html"], ["vendor-pos", "Vendor POs", "vendor-po-management.html"]
    ].filter(([key]) => key !== moduleKey);
    root.innerHTML = `
      <section class="ops-hero">
        <div class="ops-hero-copy"><p class="ops-eyebrow">${esc(config.eyebrow)} • ${esc(regionNames[state.region])}</p><h1>${esc(config.title)}</h1><p>${esc(config.description)}</p></div>
        <div class="ops-hero-status" id="ops-sync-status" data-state="checking"><i></i><strong>Connecting secure data</strong><small>Verifying organization and regional access…</small></div>
      </section>
      <section class="ops-context-bar">
        <div class="ops-context-copy"><span class="ops-context-icon">${icons.network}</span><div><strong>Connected operations workspace</strong><small>Customer, order, vendor and PO records share the same organization and regional security boundary.</small></div></div>
        <div class="ops-context-links">${links.map(([key,label,href]) => `<a href="${href}?region=${state.region}" data-module-link="${key}">${label}</a>`).join("")}</div>
      </section>
      <section class="ops-kpis" id="ops-kpis" aria-label="Operational summary"></section>
      <section class="ops-command-bar" aria-label="${esc(config.title)} controls">
        <label class="ops-field"><span>Search</span><input id="ops-search" type="search" placeholder="Search ${esc(config.plural)}, contacts, references or status…"></label>
        <label class="ops-field"><span>${esc(config.filterLabel)}</span><select id="ops-filter">${config.filterOptions.map(([value,label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("")}</select></label>
        <div class="ops-command-actions"><button class="ops-button" id="ops-export" type="button">${icons.download} Export CSV</button><button class="ops-button primary" id="ops-new" type="button">${icons.plus} New ${esc(config.noun)}</button></div>
      </section>
      <section class="ops-panel">
        <header class="ops-panel-head"><div><h2>${esc(config.shortTitle)} control center</h2><p>Search, review, update and export the current ${esc(regionNames[state.region])} records.</p></div><span class="ops-record-count" id="ops-record-count">0 ${esc(config.plural)}</span></header>
        <div class="ops-table-wrap"><table class="ops-table"><thead><tr>${config.columns.map(column => `<th style="width:${column.width || 130}px" class="${column.number || column.currency || column.percent ? "num" : ""}">${esc(column.label)}</th>`).join("")}<th style="width:128px;text-align:right">Actions</th></tr></thead><tbody id="ops-rows"></tbody></table></div>
        <div class="ops-pagination"><small id="ops-page-summary"></small><div class="ops-page-controls" id="ops-pages"></div></div>
      </section>
      ${renderRecordDialog()}
      ${config.hasActivities ? renderActivityDialog() : ""}
      <div class="ops-toast-stack" id="ops-toasts" aria-live="polite"></div>`;
    bindShell();
  }

  function renderRecordDialog() {
    const fields = config.fields.map(field => {
      if (field.section) return `<h3 class="ops-section-title">${esc(field.section)}</h3>`;
      const classes = `ops-field${field.wide ? " wide" : ""}`;
      const conditional = field.showWhen ? ` data-show-field="${esc(field.showWhen[0])}" data-show-value="${esc(field.showWhen[1])}"` : "";
      if (field.type === "checkbox") return `<label class="ops-check-field${field.wide ? " wide" : ""}"${conditional}><input name="${esc(field.name)}" type="checkbox"><span>${esc(field.label)}</span></label>`;
      let control = "";
      if (field.type === "select" || field.type === "relation") {
        control = `<select name="${esc(field.name)}" ${field.required ? "required" : ""}>${field.type === "relation" || field.optional ? '<option value="">None selected</option>' : ""}${(field.options || []).map(([value,label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("")}</select>`;
      } else if (field.type === "textarea") {
        control = `<textarea name="${esc(field.name)}" ${field.required ? "required" : ""}></textarea>`;
      } else {
        control = `<input name="${esc(field.name)}" type="${esc(field.type || "text")}" ${field.required ? "required" : ""} ${field.min != null ? `min="${esc(field.min)}"` : ""} ${field.max != null ? `max="${esc(field.max)}"` : ""} ${field.step ? `step="${esc(field.step)}"` : ""} ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ""}>`;
      }
      return `<label class="${classes}"${conditional}><span>${esc(field.label)}${field.required ? " *" : ""}</span>${control}</label>`;
    }).join("");
    return `<dialog class="ops-dialog" id="ops-dialog"><form class="ops-dialog-form" id="ops-form" novalidate><header class="ops-dialog-head"><div><h2 id="ops-dialog-title">New ${esc(config.noun)}</h2><p>Fields marked * are required. Changes are recorded in the operations audit trail.</p></div><button class="ops-dialog-close" type="button" aria-label="Close">×</button></header><div class="ops-dialog-body"><div class="ops-form-grid">${fields}${config.lines ? renderLineEditor() : ""}</div></div><footer class="ops-dialog-footer"><p class="ops-form-error" id="ops-form-error" role="alert"></p><button class="ops-button" type="button" data-cancel>Cancel</button><button class="ops-button primary" type="submit">Save ${esc(config.noun)}</button></footer></form></dialog>`;
  }

  function renderLineEditor() {
    return `<section class="ops-lines"><div class="ops-lines-head"><strong>Item lines</strong><button class="ops-button" type="button" id="ops-add-line">${icons.plus} Add line</button></div><div class="ops-lines-wrap"><table class="ops-lines-table"><thead><tr><th style="width:150px">Model / SKU</th><th>Description *</th><th style="width:100px">Quantity *</th><th style="width:110px">${esc(config.lines.priceLabel)}</th><th style="width:44px"></th></tr></thead><tbody id="ops-line-rows"></tbody></table></div><div class="ops-lines-total" id="ops-lines-total">0 units • ${currency(0)}</div></section>`;
  }

  function renderActivityDialog() {
    return `<dialog class="ops-dialog" id="ops-activity-dialog"><form class="ops-dialog-form" id="ops-activity-form"><header class="ops-dialog-head"><div><h2>Log CRM activity</h2><p id="ops-activity-account">Record a call, email, meeting, note or follow-up task.</p></div><button class="ops-dialog-close" type="button" aria-label="Close">×</button></header><div class="ops-dialog-body"><div class="ops-form-grid"><label class="ops-field"><span>Activity type *</span><select name="activity_type" required><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="note">Note</option><option value="task">Task</option></select></label><label class="ops-field"><span>Priority</span><select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option><option value="low">Low</option></select></label><label class="ops-field wide"><span>Subject *</span><input name="subject" required maxlength="220"></label><label class="ops-field"><span>Due date</span><input name="due_at" type="datetime-local"></label><label class="ops-field"><span>Status</span><select name="activity_status"><option value="open">Open</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label class="ops-field wide"><span>Details</span><textarea name="details"></textarea></label></div></div><footer class="ops-dialog-footer"><p class="ops-form-error" id="ops-activity-error"></p><button class="ops-button" type="button" data-cancel>Cancel</button><button class="ops-button primary" type="submit">Save activity</button></footer></form></dialog>`;
  }

  function bindShell() {
    const search = document.getElementById("ops-search");
    const filter = document.getElementById("ops-filter");
    search.addEventListener("input", () => { state.query = clean(search.value).toLowerCase(); state.page = 1; renderRecords(); });
    filter.addEventListener("change", () => { state.filter = filter.value; state.page = 1; renderRecords(); });
    document.getElementById("ops-new").addEventListener("click", () => openRecord());
    document.getElementById("ops-export").addEventListener("click", exportCsv);
    const dialog = document.getElementById("ops-dialog");
    dialog.querySelector(".ops-dialog-close").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    document.getElementById("ops-form").addEventListener("submit", saveRecord);
    config.fields.filter(field => field.showWhen).forEach(field => document.querySelector(`[name="${field.showWhen[0]}"]`)?.addEventListener("change", syncConditionalFields));
    if (config.lines) document.getElementById("ops-add-line").addEventListener("click", () => addLine());
    if (config.hasActivities) bindActivityDialog();
  }

  function bindActivityDialog() {
    const dialog = document.getElementById("ops-activity-dialog");
    dialog.querySelector(".ops-dialog-close").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    document.getElementById("ops-activity-form").addEventListener("submit", saveActivity);
  }

  function setSyncStatus(stateName, title, detail) {
    state.mode = stateName;
    const node = document.getElementById("ops-sync-status");
    if (!node) return;
    node.dataset.state = stateName;
    node.querySelector("strong").textContent = title;
    node.querySelector("small").textContent = detail;
  }

  function kpis() {
    const rows = state.records;
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 86400000);
    if (moduleKey === "crm") return [
      [rows.length, "Total accounts", "Customers, prospects and partners", icons.users],
      [rows.filter(row => row.account_status === "active").length, "Active accounts", "Available for new business", icons.network],
      [rows.filter(row => row.next_follow_up_at && new Date(row.next_follow_up_at) <= inSevenDays && row.account_status !== "inactive").length, "Follow-ups due", "Due within seven days", icons.clock],
      [currency(rows.reduce((sum,row) => sum + finite(row.open_balance), 0), rows[0]?.currency), "Open balance", "Across the regional portfolio", icons.money]
    ];
    if (moduleKey === "orders") return [
      [rows.filter(row => !["delivered","cancelled"].includes(row.order_status)).length, "Open orders", "Not delivered or cancelled", icons.box],
      [rows.filter(row => row.order_type === "event").length, "Event orders", "Event-linked fulfillment", icons.network],
      [rows.filter(row => row.required_date && new Date(`${row.required_date}T23:59:59`) <= inSevenDays && !["delivered","cancelled"].includes(row.order_status)).length, "Due soon", "Required within seven days", icons.clock],
      [currency(rows.reduce((sum,row) => sum + orderTotal(row), 0), rows[0]?.currency), "Order value", "Current regional portfolio", icons.money]
    ];
    if (moduleKey === "vendors") {
      const scored = rows.filter(row => row.on_time_delivery_pct != null && row.on_time_delivery_pct !== "");
      return [
        [rows.filter(row => row.vendor_status === "active").length, "Active vendors", "Approved for procurement", icons.users],
        [rows.filter(row => row.compliance_status !== "approved").length, "Compliance actions", "Pending, expired or blocked", icons.clock],
        [rows.filter(row => row.supports_dropship).length, "Dropship capable", "Direct customer fulfillment", icons.box],
        [`${scored.length ? Math.round(scored.reduce((sum,row) => sum + finite(row.on_time_delivery_pct), 0) / scored.length) : 0}%`, "Average OTD", "Vendor delivery performance", icons.network]
      ];
    }
    return [
      [rows.filter(row => !["received","cancelled"].includes(row.po_status)).length, "Open POs", "Active supplier commitments", icons.box],
      [rows.filter(row => row.expected_date && new Date(`${row.expected_date}T23:59:59`) < now && !["received","cancelled"].includes(row.po_status)).length, "Overdue POs", "Expected date has passed", icons.clock],
      [rows.filter(row => row.po_type === "dropship").length, "Dropship POs", "Direct customer shipments", icons.network],
      [currency(rows.reduce((sum,row) => sum + poTotal(row), 0), rows[0]?.currency), "Committed value", "PO value including landed costs", icons.money]
    ];
  }

  function renderKpis() {
    document.getElementById("ops-kpis").innerHTML = kpis().map(([value,label,detail,icon]) => `<article class="ops-kpi"><span class="ops-kpi-icon">${icon}</span><div><strong>${esc(value)}</strong><b>${esc(label)}</b><small>${esc(detail)}</small></div></article>`).join("");
  }

  function filteredRows() {
    return state.records.filter(row => {
      if (!config.filter(row, state.filter)) return false;
      if (!state.query) return true;
      const haystack = [row, row.lines, row.activities].flatMap(value => value ? JSON.stringify(value) : "").join(" ").toLowerCase();
      return haystack.includes(state.query);
    }).sort((a,b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
  }

  function badgeClass(value) {
    const normalized = clean(value).toLowerCase();
    if (/active|approved|delivered|received|completed|acknowledged/.test(normalized)) return "good";
    if (/hold|pending|draft|partial|prospect|shared|unknown/.test(normalized)) return "warn";
    if (/cancel|inactive|expired|blocked|critical/.test(normalized)) return "risk";
    return "info";
  }

  function cellValue(row, column) {
    const value = column.value ? column.value(row) : row[column.key];
    if (column.currency) return esc(currency(value, row.currency));
    if (column.date) return esc(displayDate(value));
    if (column.boolean) return value ? '<span class="ops-badge good">Yes</span>' : '<span class="ops-badge">No</span>';
    if (column.percent) return value == null || value === "" ? "—" : `${finite(value).toFixed(1)}%`;
    if (column.badge) return value ? `<span class="ops-badge ${badgeClass(value)}">${esc(String(value).replace(/_/g," "))}</span>` : "—";
    if (column.main) return `<button type="button" class="record-link" data-edit="${esc(row.id)}">${esc(value || "Open")}</button>`;
    if (column.number) return esc(`${finite(value).toLocaleString()}${column.suffix || ""}`);
    return esc(value || "—");
  }

  function renderRecords() {
    const rows = filteredRows();
    const pageCount = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);
    const body = document.getElementById("ops-rows");
    body.innerHTML = pageRows.length ? pageRows.map(row => `<tr>${config.columns.map(column => `<td class="${column.number || column.currency || column.percent ? "num" : ""}">${cellValue(row,column)}</td>`).join("")}<td><div class="ops-row-actions">${config.hasActivities ? `<button class="ops-icon-action" type="button" data-activity="${esc(row.id)}" title="Log activity" aria-label="Log activity">${icons.activity}</button>` : ""}<button class="ops-icon-action" type="button" data-edit="${esc(row.id)}" title="Edit" aria-label="Edit">${icons.edit}</button><button class="ops-icon-action" type="button" data-copy="${esc(row.id)}" title="Duplicate" aria-label="Duplicate">${icons.copy}</button><button class="ops-icon-action" type="button" data-delete="${esc(row.id)}" title="Delete" aria-label="Delete">${icons.trash}</button></div></td></tr>`).join("") : `<tr><td colspan="${config.columns.length + 1}"><div class="ops-empty"><strong>No ${esc(config.plural)} found</strong>${state.query || state.filter ? "Clear the search or filter to see more records." : `Create the first ${esc(config.noun)} for this region.`}</div></td></tr>`;
    body.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => openRecord(button.dataset.edit)));
    body.querySelectorAll("[data-copy]").forEach(button => button.addEventListener("click", () => duplicateRecord(button.dataset.copy)));
    body.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => deleteRecord(button.dataset.delete)));
    body.querySelectorAll("[data-activity]").forEach(button => button.addEventListener("click", () => openActivity(button.dataset.activity)));
    document.getElementById("ops-record-count").textContent = `${rows.length.toLocaleString()} ${rows.length === 1 ? config.noun : config.plural}`;
    document.getElementById("ops-page-summary").textContent = rows.length ? `Showing ${start + 1}–${Math.min(start + state.pageSize, rows.length)} of ${rows.length}` : "No records";
    document.getElementById("ops-pages").innerHTML = Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0,state.page - 3), Math.max(5,state.page + 2)).map(page => `<button type="button" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`).join("");
    document.querySelectorAll("#ops-pages [data-page]").forEach(button => button.addEventListener("click", () => { state.page = Number(button.dataset.page); renderRecords(); }));
    renderKpis();
  }

  function relationOptions(field) {
    const rows = state.related[field.relation] || [];
    return rows.map(row => field.relation === "accounts" ? [row.id, `${row.account_code} — ${row.account_name}`] : field.relation === "vendors" ? [row.id, `${row.vendor_code} — ${row.vendor_name}`] : [row.id, `${row.order_number} — ${row.customer_name}`]);
  }

  function populateRelations() {
    config.fields.filter(field => field.type === "relation").forEach(field => {
      const select = document.querySelector(`[name="${field.name}"]`);
      if (!select) return;
      const selected = select.value;
      select.innerHTML = `<option value="">${field.required ? "Select one" : "None selected"}</option>${relationOptions(field).map(([value,label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("")}`;
      select.value = selected;
    });
  }

  function defaultValue(field) { return typeof field.default === "function" ? field.default() : field.default ?? ""; }

  function openRecord(id = "", clone = null) {
    if (!canEdit()) return toast("Your workspace role has read-only access.", true);
    const record = clone || state.records.find(row => row.id === id) || null;
    state.editingId = clone ? "" : record?.id || "";
    const form = document.getElementById("ops-form");
    form.reset();
    populateRelations();
    config.fields.filter(field => field.name).forEach(field => {
      const input = form.elements[field.name];
      if (!input) return;
      let value = record ? record[field.name] : defaultValue(field);
      if (field.jsonTarget) value = record?.[field.jsonTarget]?.formatted || "";
      if (field.type === "checkbox") input.checked = Boolean(value);
      else if (field.type === "date") input.value = dateValue(value);
      else if (field.type === "datetime-local") input.value = dateTimeValue(value);
      else input.value = value == null ? "" : value;
      input.removeAttribute("aria-invalid");
    });
    if (config.lines) {
      document.getElementById("ops-line-rows").innerHTML = "";
      const lines = record?.lines?.length ? record.lines : [null];
      lines.forEach(line => addLine(line));
    }
    document.getElementById("ops-dialog-title").textContent = record && !clone ? `Edit ${config.noun}` : `New ${config.noun}`;
    document.getElementById("ops-form-error").textContent = "";
    syncConditionalFields();
    document.getElementById("ops-dialog").showModal();
    form.querySelector("input:not([type=hidden]),select")?.focus();
  }

  function duplicateRecord(id) {
    const source = state.records.find(row => row.id === id);
    if (!source) return;
    const clone = structuredClone(source);
    clone.id = "";
    delete clone.created_at;
    delete clone.updated_at;
    if (moduleKey === "crm") clone.account_code = "";
    if (moduleKey === "vendors") clone.vendor_code = "";
    if (moduleKey === "orders") clone.order_number = "";
    if (moduleKey === "vendor-pos") clone.po_number = "";
    clone.lines = (clone.lines || []).map(line => ({ ...line, id: "" }));
    openRecord("", clone);
  }

  function syncConditionalFields() {
    document.querySelectorAll("[data-show-field]").forEach(node => {
      const input = document.querySelector(`[name="${node.dataset.showField}"]`);
      const visible = input?.value === node.dataset.showValue;
      node.hidden = !visible;
      node.querySelectorAll("input,select,textarea").forEach(control => control.disabled = !visible);
    });
  }

  function addLine(line = null) {
    const tbody = document.getElementById("ops-line-rows");
    const row = document.createElement("tr");
    row.dataset.lineId = line?.id || "";
    row.innerHTML = `<td><input data-line="model_number" value="${esc(line?.model_number || "")}" placeholder="Model / SKU"></td><td><input data-line="item_description" value="${esc(line?.item_description || "")}" placeholder="Item description" required></td><td><input data-line="quantity_ordered" type="number" min=".001" step=".001" value="${esc(line?.quantity_ordered || 1)}" required></td><td><input data-line="${esc(config.lines.priceKey)}" type="number" min="0" step=".0001" value="${esc(line?.[config.lines.priceKey] || 0)}"></td><td><button class="ops-line-remove" type="button" aria-label="Remove line">×</button></td>`;
    row.querySelectorAll("input").forEach(input => input.addEventListener("input", updateLineTotal));
    row.querySelector("button").addEventListener("click", () => { row.remove(); if (!tbody.children.length) addLine(); updateLineTotal(); });
    tbody.appendChild(row);
    updateLineTotal();
  }

  function collectLines() {
    return Array.from(document.querySelectorAll("#ops-line-rows tr")).map((row,index) => {
      const value = key => row.querySelector(`[data-line="${key}"]`)?.value || "";
      return {
        id: row.dataset.lineId || uuid(), line_number: index + 1,
        model_number: clean(value("model_number")) || null,
        item_description: clean(value("item_description")),
        quantity_ordered: finite(value("quantity_ordered")),
        [config.lines.priceKey]: finite(value(config.lines.priceKey)),
        line_status: config.lines.status
      };
    }).filter(line => line.item_description || line.model_number);
  }

  function updateLineTotal() {
    if (!config.lines) return;
    const lines = collectLines();
    const units = lines.reduce((sum,line) => sum + finite(line.quantity_ordered), 0);
    const amount = lines.reduce((sum,line) => sum + finite(line.quantity_ordered) * finite(line[config.lines.priceKey]), 0);
    document.getElementById("ops-lines-total").textContent = `${units.toLocaleString()} units • ${currency(amount, document.querySelector('[name="currency"]')?.value || "USD")}`;
  }

  function serializeForm(existing) {
    const form = document.getElementById("ops-form");
    const row = { ...(existing || {}) };
    config.fields.filter(field => field.name).forEach(field => {
      const input = form.elements[field.name];
      if (!input || input.disabled) {
        if (field.showWhen) row[field.name] = null;
        return;
      }
      const value = field.type === "checkbox" ? input.checked : input.value;
      if (field.jsonTarget) row[field.jsonTarget] = { formatted: clean(value) };
      else if (field.type === "number") row[field.name] = value === "" ? null : finite(value);
      else row[field.name] = typeof value === "string" ? clean(value) || null : value;
    });
    row.id = existing?.id || uuid();
    row.organization_id = state.organizationId;
    row.region = state.region;
    row.updated_by = state.userId;
    row.created_by = existing?.created_by || state.userId;
    row.updated_at = new Date().toISOString();
    row.created_at = existing?.created_at || row.updated_at;
    if (moduleKey === "crm") row.account_code ||= recordCode(config.prefix);
    if (moduleKey === "vendors") row.vendor_code ||= recordCode(config.prefix);
    if (moduleKey === "orders") row.order_number ||= recordCode(config.prefix);
    if (moduleKey === "vendor-pos") row.po_number ||= recordCode(config.prefix);
    if (moduleKey === "orders" && row.account_id && !row.customer_name) row.customer_name = relatedName("accounts", row.account_id);
    if (config.lines) {
      row.lines = collectLines();
      row.metadata = { ...(existing?.metadata || {}), line_items: row.lines };
      if (moduleKey === "orders") row.subtotal = lineSubtotal(row, "unit_price");
      else row.item_subtotal = lineSubtotal(row, "unit_cost");
    }
    return row;
  }

  function validateRow(row) {
    const form = document.getElementById("ops-form");
    if (!form.reportValidity()) return "Complete all required fields.";
    if (config.lines && !row.lines.length) return "Add at least one valid item line.";
    if (config.lines && row.lines.some(line => !line.item_description || line.quantity_ordered <= 0)) return "Every item line needs a description and quantity greater than zero.";
    if (moduleKey === "orders" && row.order_type === "event" && !row.event_name) return "Event orders require an event name.";
    if (moduleKey === "orders" && row.required_date && row.order_date && row.required_date < row.order_date) return "Required date cannot be earlier than the order date.";
    if (moduleKey === "vendor-pos" && row.expected_date && row.order_date && row.expected_date < row.order_date) return "Expected date cannot be earlier than the PO date.";
    if (moduleKey === "vendor-pos" && row.po_type === "event" && !row.event_reference && !row.sales_order_id) return "Event POs require an event reference or linked customer order.";
    if (moduleKey === "vendor-pos" && row.po_type === "dropship" && !row.sales_order_id) return "Dropship POs require a linked customer order.";
    if (moduleKey === "vendor-pos" && row.po_type === "dropship" && row.ship_to_type !== "customer") return "Dropship POs must ship directly to the customer.";
    return "";
  }

  function remoteParentRow(row) {
    const result = { ...row };
    delete result.lines;
    delete result.activities;
    delete result._pending;
    delete result.total_amount;
    delete result.activity_count;
    delete result.account_name_key;
    delete result.vendor_name_key;
    return result;
  }

  async function saveRecord(event) {
    event.preventDefault();
    const existing = state.records.find(row => row.id === state.editingId) || null;
    const row = serializeForm(existing);
    const errorNode = document.getElementById("ops-form-error");
    const validation = validateRow(row);
    if (validation) { errorNode.textContent = validation; return; }
    errorNode.textContent = "Saving…";
    const submit = event.submitter;
    if (submit) submit.disabled = true;
    try {
      if (state.mode === "cloud") await saveRemote(row);
      upsertLocal(row);
      document.getElementById("ops-dialog").close();
      toast(`${config.shortTitle}: ${mainIdentifier(row)} saved.`);
      state.channel?.postMessage({ module: moduleKey, region: state.region, organizationId: state.organizationId });
      await loadData(false);
    } catch (error) {
      row._pending = true;
      upsertLocal(row);
      setSyncStatus("local", "Continuity mode", "Saved locally; cloud synchronization can be retried after the database migration or connection is restored.");
      document.getElementById("ops-dialog").close();
      toast(`Saved locally. ${clean(error?.message || "Cloud synchronization is unavailable.")}`, true);
      renderRecords();
    } finally { if (submit) submit.disabled = false; }
  }

  async function saveRemote(row) {
    const client = window.StarkAuth.client;
    const { data, error } = await client.from(config.table).upsert(remoteParentRow(row), { onConflict: "id" }).select().single();
    if (error) throw error;
    if (!config.lines) return data;
    const { data: existingLines, error: existingError } = await client.from(config.lineTable).select("id").eq(config.lineForeignKey, row.id);
    if (existingError) throw existingError;
    const retainedIds = new Set(row.lines.map(line => line.id));
    const removedIds = (existingLines || []).map(line => line.id).filter(id => !retainedIds.has(id));
    if (removedIds.length) {
      const { error: deleteError } = await client.from(config.lineTable).delete().in("id", removedIds).eq(config.lineForeignKey, row.id);
      if (deleteError) throw deleteError;
    }
    if (row.lines.length) {
      const payload = row.lines.map((line,index) => ({
        ...line, id: line.id || uuid(), [config.lineForeignKey]: row.id,
        organization_id: state.organizationId, region: state.region, line_number: index + 1
      }));
      const { error: lineError } = await client.from(config.lineTable).upsert(payload, { onConflict: "id" });
      if (lineError) throw lineError;
    }
    return data;
  }

  function upsertLocal(row) {
    const index = state.records.findIndex(item => item.id === row.id);
    if (index >= 0) state.records[index] = row;
    else state.records.unshift(row);
    writeLocal(state.records);
  }

  function mainIdentifier(row) { return row.account_code || row.order_number || row.vendor_code || row.po_number || row.id; }

  async function deleteRecord(id) {
    if (!canEdit()) return toast("Your workspace role has read-only access.", true);
    const row = state.records.find(item => item.id === id);
    if (!row || !confirm(`Delete ${config.noun} ${mainIdentifier(row)}? This cannot be undone.`)) return;
    try {
      if (state.mode === "cloud") {
        const { error } = await window.StarkAuth.client.from(config.table).delete().eq("id", id).eq("organization_id", state.organizationId).eq("region", state.region);
        if (error) throw error;
      }
      state.records = state.records.filter(item => item.id !== id);
      writeLocal(state.records);
      toast(`${mainIdentifier(row)} deleted.`);
      renderRecords();
    } catch (error) { toast(clean(error?.message || "The record could not be deleted."), true); }
  }

  function openActivity(accountId) {
    if (!canEdit()) return toast("Your workspace role has read-only access.", true);
    const account = state.records.find(row => row.id === accountId);
    if (!account) return;
    const form = document.getElementById("ops-activity-form");
    form.reset();
    form.dataset.accountId = accountId;
    document.getElementById("ops-activity-account").textContent = `${account.account_code} • ${account.account_name}`;
    document.getElementById("ops-activity-error").textContent = "";
    document.getElementById("ops-activity-dialog").showModal();
  }

  async function saveActivity(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const row = {
      id: uuid(), account_id: form.dataset.accountId, organization_id: state.organizationId, region: state.region,
      activity_type: form.elements.activity_type.value, subject: clean(form.elements.subject.value), details: clean(form.elements.details.value) || null,
      activity_status: form.elements.activity_status.value, priority: form.elements.priority.value,
      due_at: form.elements.due_at.value ? new Date(form.elements.due_at.value).toISOString() : null,
      completed_at: form.elements.activity_status.value === "completed" ? new Date().toISOString() : null,
      created_by: state.userId, updated_by: state.userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    try {
      if (state.mode === "cloud") {
        const { error } = await window.StarkAuth.client.from("crm_activities").insert(row);
        if (error) throw error;
        if (row.due_at) await window.StarkAuth.client.from("crm_accounts").update({ next_follow_up_at: row.due_at, updated_by: state.userId }).eq("id", row.account_id);
      }
      state.activities.unshift(row);
      writeLocal(state.activities, "crm-activities");
      document.getElementById("ops-activity-dialog").close();
      toast("CRM activity saved.");
      await loadData(false);
    } catch (error) {
      state.activities.unshift({ ...row, _pending: true });
      writeLocal(state.activities, "crm-activities");
      document.getElementById("ops-activity-dialog").close();
      toast(`Activity saved locally. ${clean(error?.message || "Cloud synchronization unavailable.")}`, true);
      attachActivities();
      renderRecords();
    }
  }

  function attachActivities() {
    const groups = new Map();
    state.activities.forEach(activity => {
      if (!groups.has(activity.account_id)) groups.set(activity.account_id, []);
      groups.get(activity.account_id).push(activity);
    });
    state.records.forEach(record => record.activities = groups.get(record.id) || []);
  }

  async function loadRelatedRemote() {
    const client = window.StarkAuth.client;
    const queries = [
      ["accounts", "crm_accounts", "account_name"], ["vendors", "vendors", "vendor_name"], ["orders", "sales_orders", "order_number"]
    ];
    for (const [key, table, order] of queries) {
      const { data, error } = await client.from(table).select("*").eq("organization_id", state.organizationId).eq("region", state.region).order(order);
      if (error) {
        state.related[key] = readLocal(key === "accounts" ? "crm" : key);
      } else state.related[key] = data || [];
    }
  }

  async function loadRemote() {
    const client = window.StarkAuth.client;
    const { data, error } = await client.from(config.table).select("*").eq("organization_id", state.organizationId).eq("region", state.region).order("updated_at", { ascending: false });
    if (error) throw error;
    state.records = data || [];
    if (config.lines && state.records.length) {
      const ids = state.records.map(row => row.id);
      const { data: lines, error: lineError } = await client.from(config.lineTable).select("*").in(config.lineForeignKey, ids).order("line_number");
      if (lineError) throw lineError;
      const grouped = new Map();
      (lines || []).forEach(line => {
        const key = line[config.lineForeignKey];
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(line);
      });
      state.records.forEach(row => row.lines = grouped.get(row.id) || row.metadata?.line_items || []);
    }
    if (config.hasActivities) {
      const { data: activities, error: activityError } = await client.from("crm_activities").select("*").eq("organization_id", state.organizationId).eq("region", state.region).order("created_at", { ascending: false });
      if (activityError) throw activityError;
      state.activities = activities || [];
      attachActivities();
      writeLocal(state.activities, "crm-activities");
    }
    await loadRelatedRemote();
    writeLocal(state.records);
  }

  function loadLocal() {
    state.records = readLocal();
    if (config.hasActivities) { state.activities = readLocal("crm-activities"); attachActivities(); }
    state.related.accounts = readLocal("crm");
    state.related.vendors = readLocal("vendors");
    state.related.orders = readLocal("orders");
  }

  async function loadData(showStatus = true) {
    if (showStatus) setSyncStatus("checking", "Synchronizing operations", "Loading organization and regional records…");
    try {
      await loadRemote();
      setSyncStatus("cloud", "Live data synchronized", `${state.records.length.toLocaleString()} ${config.plural} • ${regionNames[state.region]} • realtime ready`);
      setupRealtime();
    } catch (error) {
      loadLocal();
      setSyncStatus("local", "Continuity mode", `Local records available • ${clean(error?.message || "Cloud tables require the operations migration")}`);
    }
    populateRelations();
    renderRecords();
    document.getElementById("ops-new").disabled = !canEdit();
  }

  function setupRealtime() {
    if (state.realtime || !window.StarkAuth?.client?.channel) return;
    state.realtime = window.StarkAuth.client.channel(`ops-${moduleKey}-${state.organizationId}-${state.region}`)
      .on("postgres_changes", { event: "*", schema: "public", table: config.table, filter: `organization_id=eq.${state.organizationId}` }, payload => {
        const row = payload.new || payload.old;
        if (row?.region !== state.region) return;
        window.clearTimeout(setupRealtime.timer);
        setupRealtime.timer = window.setTimeout(() => loadData(false), 250);
      }).subscribe();
  }

  function exportCsv() {
    const rows = filteredRows();
    if (!rows.length) return toast("There are no filtered records to export.", true);
    const exportFields = config.fields.filter(field => field.name).map(field => ({
      label: field.label,
      value: row => {
        if (field.jsonTarget) return row[field.jsonTarget]?.formatted || "";
        if (field.type === "relation") return relatedName(field.relation, row[field.name]);
        return row[field.name];
      }
    }));
    exportFields.push({ label: "Region", value: row => row.region });
    if (config.lines) {
      exportFields.push(
        { label: "Total units", value: row => sumLines(row, "quantity_ordered") },
        { label: "Total amount", value: row => moduleKey === "orders" ? orderTotal(row) : poTotal(row) },
        { label: "Line items", value: row => (row.lines || []).map(line => `${line.model_number || ""} | ${line.item_description} | ${line.quantity_ordered} | ${line[config.lines.priceKey]}`).join("; ") }
      );
    }
    if (config.hasActivities) exportFields.push({ label: "Activity count", value: row => row.activities?.length || 0 });
    exportFields.push(
      { label: "Created at", value: row => row.created_at },
      { label: "Updated at", value: row => row.updated_at }
    );
    const quote = value => {
      const primitive = value == null ? "" : value;
      const text = typeof primitive === "string" && /^[=+\-@]/.test(primitive) ? `'${primitive}` : String(primitive);
      return `"${text.replace(/"/g,'""')}"`;
    };
    const csv = [
      exportFields.map(field => quote(field.label)).join(","),
      ...rows.map(row => exportFields.map(field => quote(field.value(row))).join(","))
    ].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${moduleKey}-${state.region}-${today()}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast(`${rows.length} ${config.plural} exported.`);
  }

  function toast(message, error = false) {
    const node = document.createElement("div");
    node.className = `ops-toast${error ? " error" : ""}`;
    node.textContent = message;
    document.getElementById("ops-toasts")?.appendChild(node);
    window.setTimeout(() => node.remove(), 5200);
  }

  function waitForAuth() {
    if (window.StarkAuth?.state?.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Secure workspace initialization timed out")), 18000);
      window.addEventListener("stark:auth-ready", () => { window.clearTimeout(timer); resolve(); }, { once: true });
    });
  }

  async function initialize() {
    renderShell();
    try {
      await waitForAuth();
      state.organizationId = window.StarkAuth.getOrganizationId();
      state.userId = window.StarkAuth.state.user?.id || "";
      state.role = window.StarkAuth.state.role || "viewer";
      await loadData();
    } catch (error) {
      loadLocal();
      setSyncStatus("local", "Continuity mode", clean(error?.message || "Secure cloud data is unavailable"));
      renderRecords();
    }
    state.channel?.addEventListener("message", event => {
      if (event.data?.module === moduleKey && event.data.region === state.region && event.data.organizationId === state.organizationId) loadData(false);
    });
  }

  initialize();
})();
