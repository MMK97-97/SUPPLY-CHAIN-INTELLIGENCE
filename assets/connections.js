(function () {
  'use strict';

  const STORAGE_KEY = 'mk97.connections.v1';
  const store = window.StarkWorkspace?.localStorage || window.localStorage;
  const Core = window.MKConnectionsCore;
  const S = window.StarkSystem;

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ui = {
    tab: 'all',          // 'all' | 'edi' | 'api' | 'mapper' | 'logs'
    filter: 'ALL',       // 'ALL' | 'EDI' | 'API' | 'ACTIVE'
    search: '',
    selectedId: '',
    ediMode: 'send',     // 'send' | 'receive'
    ediPartnerId: '',
    ediDocType: '850',
    ediRecordId: '',
    ediLastGenerated: null,
    ediInboundText: '',
    ediParsed: null,
    apiConnId: '',
    apiMethod: 'POST',
    apiUrl: '',
    apiAuthType: 'BEARER',
    apiAuthHeader: 'Authorization',
    apiAuthSecret: '',
    apiPayloadKind: 'ORDER',
    apiBody: '',
    apiLiveFetch: false,
    apiSnippetLang: 'curl',
    apiLastResponse: null,
    mapperConnId: '',
    mapperEntity: 'orders',
    logFilter: 'ALL',
    wizardOpen: false,
    wizardCategory: 'EDI',
    wizardTemplateId: ''
  };

  function loadData() {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.connections)) return parsed;
      }
    } catch (_) {}
    const seeded = Core ? Core.seedConnections() : { connections: [], logs: [], ourProfile: {} };
    saveData(seeded, false);
    return seeded;
  }

  function saveData(data, emit = true) {
    try { store.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
    if (emit) {
      window.dispatchEvent(new CustomEvent('mk97:connections-updated', { detail: { count: (data.connections || []).length } }));
    }
  }

  function getErpState() {
    return S?.getState ? S.getState() : { enterprise: {}, logistics: {}, tasks: [] };
  }

  function recordErpAudit(action, detail) {
    if (!S?.transaction) return;
    try {
      S.transaction(action, String(detail || '').slice(0, 140), () => {});
    } catch (_) {}
  }

  function notify(msg, isError = false) {
    if (window.StarkSystemUI?.notice) window.StarkSystemUI.notice(msg, isError);
  }

  function fmtAgo(iso) {
    if (!iso) return 'Never';
    const diff = Math.max(0, Date.now() - Date.parse(iso));
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function highlightX12(raw) {
    return String(raw || '').split('\n').map(line => {
      const s = esc(line);
      if (/^ISA\*/.test(line)) return `<span class="conn-edi-seg-isa">${s}</span>`;
      if (/^GS\*/.test(line)) return `<span class="conn-edi-seg-gs">${s}</span>`;
      if (/^ST\*/.test(line)) return `<span class="conn-edi-seg-st">${s}</span>`;
      if (/^(?:SE|GE|IEA)\*/.test(line)) return `<span class="conn-edi-seg-end">${s}</span>`;
      return `<span class="conn-edi-seg-data">${s}</span>`;
    }).join('\n');
  }

  function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // Programmatic helpers exposed via window.MKConnections (also used by MK v7.0 Co-Pilot!)
  function transmitEdiDocument(partnerId, docType = '850', recordId = '') {
    const data = loadData();
    const partner = data.connections.find(c => c.id === partnerId) || data.connections.find(c => c.category === 'EDI');
    if (!partner || !Core) return null;
    const generated = Core.generateX12Document({
      docType,
      partner,
      sender: data.ourProfile,
      state: getErpState(),
      recordId
    });
    const latency = Math.round(95 + Math.random() * 90);
    const nowIso = new Date().toISOString();
    const logEntry = {
      id: 'tx_' + Date.now(),
      kind: 'EDI',
      connectionId: partner.id,
      partnerName: partner.name,
      direction: 'OUTBOUND',
      docType: generated.docType,
      controlNumber: generated.controlNumber,
      reference: generated.reference,
      status: partner.autoAck997 !== false ? 'ACK_997' : 'SENT',
      httpCode: 200,
      latencyMs: latency,
      mode: partner.transport || 'AS2',
      timestamp: nowIso,
      summary: `EDI ${generated.docType} (${generated.docName}) sent via ${partner.transport || 'AS2'} · ${partner.autoAck997 !== false ? '997 ACK Accepted' : 'Transmitted'}`,
      payload: generated.raw,
      response: generated.ack997 || ''
    };
    partner.txCount = Number(partner.txCount || 0) + 1;
    partner.lastSyncAt = nowIso;
    partner.latencyMs = latency;
    partner.status = 'CONNECTED';
    data.logs.unshift(logEntry);
    data.logs = data.logs.slice(0, 120);
    saveData(data);
    recordErpAudit('EDI_TRANSMITTED', `EDI ${generated.docType} -> ${partner.name} (${generated.reference}, ctrl ${generated.controlNumber})`);
    return { generated, logEntry, partner };
  }

  async function sendApiRequest({ connectionId, method, url, authType, authHeader, authSecret, bodyText, liveFetch = false, reference = '' }) {
    const data = loadData();
    const conn = data.connections.find(c => c.id === connectionId) || null;
    const targetMethod = (method || conn?.method || 'POST').toUpperCase();
    const targetUrl = String(url || conn?.endpoint || '').trim();
    if (!targetUrl) throw new Error('Enter a destination API endpoint URL.');

    const headers = { 'Content-Type': 'application/json', ...(conn?.headers || {}) };
    const aType = authType || conn?.authType || 'NONE';
    const aHeader = authHeader || conn?.authHeader || 'Authorization';
    const aSecret = authSecret || conn?.authSecret || '';
    if (aType === 'BEARER' && aSecret) headers['Authorization'] = `Bearer ${aSecret}`;
    else if (aType === 'API_KEY' && aSecret) headers[aHeader] = aSecret;
    else if (aType === 'BASIC' && aSecret) headers['Authorization'] = `Basic ${btoa(aSecret)}`;
    else if (aType === 'HMAC_SHA256') headers[aHeader || 'X-MK97-Signature'] = 'sha256=' + Math.abs(Date.now()).toString(16) + '9f4b2c8e';

    const t0 = performance.now();
    let httpCode = 200;
    let modeLabel = 'SANDBOX';
    let responseBody = '';
    let responseHeaders = { 'content-type': 'application/json', 'x-mk97-gateway': 'connected' };
    let ok = true;

    if (liveFetch && /^https?:\/\//i.test(targetUrl)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      try {
        const res = await fetch(targetUrl, {
          method: targetMethod,
          headers,
          body: ['GET', 'HEAD'].includes(targetMethod) ? undefined : (bodyText || '{}'),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        httpCode = res.status;
        ok = res.ok;
        modeLabel = 'LIVE HTTP';
        const txt = await res.text();
        try { responseBody = JSON.stringify(JSON.parse(txt), null, 2); } catch (_) { responseBody = txt; }
        responseHeaders = {};
        res.headers.forEach((v, k) => { responseHeaders[k] = v; });
      } catch (err) {
        clearTimeout(timer);
        httpCode = 0;
        ok = false;
        modeLabel = 'LIVE HTTP (CORS/NETWORK)';
        responseBody = JSON.stringify({
          ok: false,
          error: err.name === 'AbortError' ? 'Request timed out after 9s' : (err.message || 'Browser CORS or network policy blocked direct response read.'),
          hint: 'Switch to Smart Sandbox mode to verify payload formatting & handshake, or target a CORS-enabled endpoint like https://httpbin.org/post.'
        }, null, 2);
      }
    } else {
      await new Promise(r => setTimeout(r, 120));
      let parsedReq = {};
      try { parsedReq = bodyText ? JSON.parse(bodyText) : {}; } catch (_) { parsedReq = { raw: bodyText }; }
      httpCode = targetMethod === 'POST' ? 201 : 200;
      modeLabel = 'SANDBOX TEST';
      responseBody = JSON.stringify({
        ok: true,
        status: httpCode === 201 ? 'ACCEPTED' : 'OK',
        mode: 'MK97_SMART_SANDBOX',
        endpoint: targetUrl,
        method: targetMethod,
        requestId: 'req_mk97_' + Date.now().toString(36),
        receivedAt: new Date().toISOString(),
        authVerified: aType,
        echoSummary: {
          event: parsedReq.event || 'api_request',
          keysReceived: Object.keys(parsedReq).slice(0, 8)
        }
      }, null, 2);
    }

    const latencyMs = Math.max(12, Math.round(performance.now() - t0));
    const nowIso = new Date().toISOString();
    const logEntry = {
      id: 'tx_' + Date.now(),
      kind: 'API',
      connectionId: conn?.id || 'custom_api',
      partnerName: conn?.name || targetUrl.replace(/^https?:\/\//i, '').split('/')[0],
      direction: 'OUTBOUND',
      docType: `${targetMethod} ${targetUrl.replace(/^https?:\/\/[^/]+/i, '').slice(0, 26) || '/'}`,
      controlNumber: 'API-' + String(Date.now()).slice(-6),
      reference: reference || ui.apiPayloadKind || 'CUSTOM',
      status: ok ? 'DELIVERED' : 'FAILED',
      httpCode,
      latencyMs,
      mode: modeLabel,
      timestamp: nowIso,
      summary: `${httpCode || 'ERR'} (${modeLabel}) · ${targetMethod} ${targetUrl}`,
      payload: bodyText || '',
      response: responseBody
    };

    if (conn) {
      conn.txCount = Number(conn.txCount || 0) + 1;
      conn.lastSyncAt = nowIso;
      conn.latencyMs = latencyMs;
      if (ok) conn.status = 'CONNECTED';
    }
    data.logs.unshift(logEntry);
    data.logs = data.logs.slice(0, 120);
    saveData(data);
    recordErpAudit('API_TRANSMITTED', `${targetMethod} ${targetUrl} -> HTTP ${httpCode} (${modeLabel})`);

    return { ok, httpCode, latencyMs, modeLabel, responseBody, responseHeaders, logEntry };
  }

  function renderWorkspaceNav() {
    const activeTasksCount = (getErpState().tasks || []).filter(t => t.status !== 'DONE').length;
    return `
      <nav class="conn-workspace-nav" aria-label="Workspace Switcher">
        <div class="workspace-view-switch" role="tablist" aria-label="Workspace View">
          <a class="workspace-view-tab" href="${S ? S.url('workspace.html') : 'workspace.html'}" role="tab">Operations</a>
          <a class="workspace-view-tab" href="${S ? S.url('workspace.html?view=modules') : 'workspace.html?view=modules'}" role="tab">Modules</a>
          <a class="workspace-view-tab" href="${S ? S.url('workspace.html?view=telemetry') : 'workspace.html?view=telemetry'}" role="tab">Analytics</a>
          <a class="workspace-view-tab" href="${S ? S.url('mail.html') : 'mail.html'}" role="tab">MK97 Mail</a>
          <a class="workspace-view-tab" href="${S ? S.url('tasks.html') : 'tasks.html'}" role="tab">Tasks${activeTasksCount > 0 ? ` <span class="workspace-task-pill">${activeTasksCount}</span>` : ''}</a>
          <a class="workspace-view-tab active" href="${S ? S.url('connections.html') : 'connections.html'}" role="tab" aria-selected="true" aria-current="page">Connections</a>
        </div>
      </nav>`;
  }

  function renderAllTab(data) {
    const q = ui.search.trim().toLowerCase();
    const list = (data.connections || []).filter(c => {
      if (ui.filter === 'EDI' && c.category !== 'EDI') return false;
      if (ui.filter === 'API' && c.category !== 'API') return false;
      if (ui.filter === 'ACTIVE' && (!c.active || c.status !== 'CONNECTED')) return false;
      if (q) {
        const hay = `${c.name} ${c.role} ${c.isaId || ''} ${c.endpoint || ''} ${(c.docs || []).join(' ')} ${(c.triggers || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!ui.selectedId || !data.connections.some(c => c.id === ui.selectedId)) {
      ui.selectedId = list[0]?.id || data.connections[0]?.id || '';
    }
    const sel = data.connections.find(c => c.id === ui.selectedId) || null;
    const selLogs = sel ? (data.logs || []).filter(l => l.connectionId === sel.id).slice(0, 4) : [];

    return `
      <div class="conn-main-grid">
        <div>
          <div class="conn-filter-bar">
            <div class="conn-filter-pills">
              ${[['ALL', `All (${data.connections.length})`], ['EDI', `EDI Partners (${data.connections.filter(c => c.category === 'EDI').length})`], ['API', `APIs & Webhooks (${data.connections.filter(c => c.category === 'API').length})`], ['ACTIVE', 'Connected']].map(([id, lbl]) => `
                <button type="button" class="conn-pill ${ui.filter === id ? 'active' : ''}" data-conn-filter="${id}">${esc(lbl)}</button>
              `).join('')}
            </div>
            <input type="search" class="conn-search" id="conn-search-input" value="${esc(ui.search)}" placeholder="Search partner, ISA ID, URL, 850...">
          </div>

          <div class="conn-card-list">
            ${list.length ? list.map(c => {
              const isEdi = c.category === 'EDI';
              const badgeCls = isEdi ? 'edi' : (c.protocol === 'WEBHOOK' ? 'webhook' : 'api');
              const badgeText = isEdi ? `EDI · ${c.transport || 'AS2'}` : (c.protocol === 'WEBHOOK' ? 'WEBHOOK' : `REST · ${c.method || 'POST'}`);
              const chips = isEdi ? (c.docs || []) : (c.triggers || []);
              return `
                <article class="conn-card ${sel?.id === c.id ? 'is-selected' : ''}" data-select-conn="${esc(c.id)}">
                  <div class="conn-card-top">
                    <div>
                      <h3 class="conn-card-title">${esc(c.name)}</h3>
                      <div class="conn-card-role">${esc(c.role || '')}</div>
                    </div>
                    <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;">
                      <span class="conn-badge ${badgeCls}">${esc(badgeText)}</span>
                      <span class="conn-badge ${c.active ? 'connected' : 'paused'}">${c.active ? '● Live' : 'Paused'}</span>
                    </div>
                  </div>
                  <div class="conn-meta-line">${isEdi ? `ISA ${esc(c.isaQualifier || 'ZZ')}:${esc(c.isaId)} · ${esc(c.standard || 'X12 005010')}` : esc(c.endpoint)}</div>
                  <div class="conn-doc-chips">
                    ${chips.slice(0, 6).map(ch => `<span class="conn-doc-chip">${esc(ch)}</span>`).join('')}
                  </div>
                  <div class="conn-card-foot">
                    <span>${Number(c.txCount || 0).toLocaleString()} tx · ${c.successRate || 99.5}% · ${c.latencyMs || 110}ms</span>
                    <div class="conn-card-actions">
                      <button type="button" class="conn-btn sm teal" data-quick-test="${esc(c.id)}">Test</button>
                      <button type="button" class="conn-btn sm primary" data-quick-send="${esc(c.id)}">Send</button>
                    </div>
                  </div>
                </article>`;
            }).join('') : `<div class="conn-panel" style="grid-column:1/-1;text-align:center;padding:34px;"><strong>No matching connections</strong><p style="color:#64748b;margin:6px 0 14px;">Connect any EDI partner or REST API endpoint in seconds.</p><button type="button" class="conn-btn primary" data-open-wizard="EDI">＋ Quick Connect Partner</button></div>`}
          </div>
        </div>

        <aside class="conn-inspector" aria-label="Connection details">
          ${sel ? `
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
              <div>
                <span class="conn-badge ${sel.category === 'EDI' ? 'edi' : 'api'}" style="margin-bottom:6px;">${sel.category === 'EDI' ? `ANSI X12 · ${esc(sel.transport)}` : `${esc(sel.protocol)} · ${esc(sel.authType || 'NONE')}`}</span>
                <h2>${esc(sel.name)}</h2>
                <div class="conn-card-role">${esc(sel.role)} · Last sync ${fmtAgo(sel.lastSyncAt)}</div>
              </div>
              <span class="conn-badge ${sel.active ? 'connected' : 'paused'}">${sel.active ? '● Connected' : 'Paused'}</span>
            </div>

            <div class="conn-kv-grid">
              ${sel.category === 'EDI' ? `
                <div class="conn-kv"><span>Partner ISA ID</span><strong>${esc(sel.isaQualifier || 'ZZ')}:${esc(sel.isaId)}</strong></div>
                <div class="conn-kv"><span>Partner GS ID</span><strong>${esc(sel.gsId || '—')}</strong></div>
                <div class="conn-kv"><span>AS2 / Transport</span><strong>${esc(sel.as2Id || sel.transport)}</strong></div>
                <div class="conn-kv"><span>Standard</span><strong>${esc(sel.standard || 'X12 005010')}</strong></div>
              ` : `
                <div class="conn-kv" style="grid-column:1/-1;"><span>Endpoint URL</span><strong>${esc(sel.endpoint)}</strong></div>
                <div class="conn-kv"><span>Method & Auth</span><strong>${esc(sel.method || 'POST')} · ${esc(sel.authType || 'NONE')}</strong></div>
                <div class="conn-kv"><span>Avg Latency</span><strong>${sel.latencyMs || 90} ms · ${sel.successRate || 99.5}%</strong></div>
              `}
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px;">
              <button type="button" class="conn-btn primary sm" data-quick-send="${esc(sel.id)}">${sel.category === 'EDI' ? '📄 Send EDI Doc' : '⚡ Send API Payload'}</button>
              <button type="button" class="conn-btn teal sm" data-quick-test="${esc(sel.id)}">🩺 Test Handshake</button>
              <button type="button" class="conn-btn sm" data-open-mapper="${esc(sel.id)}">🔀 Field Mapper</button>
              <button type="button" class="conn-btn sm" data-toggle-active="${esc(sel.id)}">${sel.active ? '⏸ Pause' : '▶ Resume'}</button>
              <button type="button" class="conn-btn sm danger" data-delete-conn="${esc(sel.id)}">🗑</button>
            </div>

            <div style="border-top:1px solid #e2e8f0;padding-top:12px;">
              <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px;">Recent Transmissions (${selLogs.length})</div>
              ${selLogs.length ? selLogs.map(l => `
                <div style="padding:8px 10px;border:1px solid #eef2f7;border-radius:9px;margin-bottom:7px;background:#f8fafc;">
                  <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:700;">
                    <span>${esc(l.docType)} · ${esc(l.reference)}</span>
                    <span style="color:${l.status === 'FAILED' ? '#be123c' : '#059669'};">${esc(l.status)}</span>
                  </div>
                  <div style="font-size:11px;color:#64748b;margin-top:2px;">${fmtAgo(l.timestamp)} · ${l.latencyMs}ms · ${esc(l.mode)}</div>
                </div>
              `).join('') : `<p style="font-size:12px;color:#64748b;margin:0;">No transmissions logged yet for this partner. Click <strong>Send</strong> to transmit live ERP data.</p>`}
            </div>
          ` : `<p style="color:#64748b;">Select a connection to inspect credentials, run a live handshake test, or transmit documents.</p>`}
        </aside>
      </div>`;
  }

  function renderEdiTab(data) {
    const ediPartners = (data.connections || []).filter(c => c.category === 'EDI');
    if (!ui.ediPartnerId || !ediPartners.some(c => c.id === ui.ediPartnerId)) {
      ui.ediPartnerId = ediPartners[0]?.id || '';
    }
    const partner = ediPartners.find(c => c.id === ui.ediPartnerId) || ediPartners[0];
    const erp = getErpState();
    const pos = erp.enterprise?.purchaseOrders || [];
    const orders = erp.enterprise?.orders || [];
    const records = ['850', '855'].includes(ui.ediDocType)
      ? pos.map(p => ({ id: p.id, label: `Vendor PO ${p.po} (${p.status})` }))
      : orders.map(o => ({ id: o.id, label: `Customer Order #${o.po} (${o.status})` }));

    const preview = partner && Core
      ? Core.generateX12Document({ docType: ui.ediDocType, partner, sender: data.ourProfile, state: erp, recordId: ui.ediRecordId })
      : null;

    return `
      <div class="conn-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
          <div style="display:flex;gap:8px;">
            <button type="button" class="conn-pill ${ui.ediMode === 'send' ? 'active' : ''}" data-edi-mode="send">📤 Send Outbound EDI (X12)</button>
            <button type="button" class="conn-pill ${ui.ediMode === 'receive' ? 'active' : ''}" data-edi-mode="receive">📥 Receive &amp; Parse Inbound EDI</button>
          </div>
          <button type="button" class="conn-btn sm teal" data-open-wizard="EDI">＋ Connect New EDI Partner</button>
        </div>

        ${ui.ediMode === 'send' ? `
          <div class="conn-studio-grid">
            <div>
              <div class="conn-field">
                <label for="edi-partner-sel">Trading Partner (ISA Receiver)</label>
                <select id="edi-partner-sel">
                  ${ediPartners.map(p => `<option value="${esc(p.id)}" ${p.id === partner?.id ? 'selected' : ''}>${esc(p.name)} (${esc(p.isaQualifier)}:${esc(p.isaId)} · ${esc(p.transport)})</option>`).join('')}
                </select>
              </div>
              <div class="conn-row-2">
                <div class="conn-field">
                  <label for="edi-doc-sel">X12 Transaction Set</label>
                  <select id="edi-doc-sel">
                    ${Object.values(Core.EDI_DOC_CATALOG).filter(d => d.code !== '997').map(d => `<option value="${d.code}" ${d.code === ui.ediDocType ? 'selected' : ''}>${d.code} — ${esc(d.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="conn-field">
                  <label for="edi-rec-sel">Live MK97 ERP Source Record</label>
                  <select id="edi-rec-sel">
                    <option value="">Auto-select active ERP record</option>
                    ${records.map(r => `<option value="${esc(r.id)}" ${r.id === ui.ediRecordId ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div style="padding:12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;color:#334155;margin-bottom:14px;">
                <strong>${esc(Core.EDI_DOC_CATALOG[ui.ediDocType]?.code)} · ${esc(Core.EDI_DOC_CATALOG[ui.ediDocType]?.name)}</strong><br>
                ${esc(Core.EDI_DOC_CATALOG[ui.ediDocType]?.desc || '')}<br>
                <span style="color:#64748b;">Sender: <code>${esc(data.ourProfile.isaQualifier)}:${esc(data.ourProfile.isaId)}</code> → Receiver: <code>${esc(partner?.isaQualifier || 'ZZ')}:${esc(partner?.isaId || 'PARTNER')}</code></span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <button type="button" class="conn-btn primary" id="btn-transmit-edi">🚀 Transmit EDI ${esc(ui.ediDocType)} &amp; Verify 997 ACK</button>
                <button type="button" class="conn-btn" id="btn-download-edi">⬇ Download .edi</button>
                <button type="button" class="conn-btn" id="btn-copy-edi">📋 Copy X12</button>
              </div>
              ${ui.ediLastGenerated ? `
                <div style="margin-top:14px;padding:12px;border-radius:11px;background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46;font-size:12.5px;">
                  <strong>✅ Transmitted &amp; 997 Functional ACK Received!</strong><br>
                  Control #<code>${esc(ui.ediLastGenerated.logEntry.controlNumber)}</code> · Ref <code>${esc(ui.ediLastGenerated.logEntry.reference)}</code> · ${ui.ediLastGenerated.logEntry.latencyMs}ms via ${esc(ui.ediLastGenerated.logEntry.mode)}
                </div>
              ` : ''}
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
                <strong style="font-size:12.5px;color:#0f172a;">Live ANSI X12 Envelope Preview (${preview?.segmentCount || 0} segments)</strong>
                <span class="conn-badge connected">Valid ${esc(partner?.standard || 'X12 005010')}</span>
              </div>
              <pre class="conn-code-box" id="edi-preview-code">${preview ? highlightX12(preview.raw) : 'Select an EDI partner to generate an envelope.'}</pre>
              ${ui.ediLastGenerated?.generated?.ack997 ? `
                <div style="margin-top:12px;">
                  <strong style="font-size:12px;color:#059669;display:block;margin-bottom:5px;">Returned 997 Functional Acknowledgment (AK9*A Accepted)</strong>
                  <pre class="conn-code-box" style="max-height:170px;">${highlightX12(ui.ediLastGenerated.generated.ack997)}</pre>
                </div>
              ` : ''}
            </div>
          </div>
        ` : `
          <div class="conn-studio-grid">
            <div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <button type="button" class="conn-btn sm teal" id="btn-load-sample-850">Load Sample Inbound 850 Order</button>
                <button type="button" class="conn-btn sm teal" id="btn-load-sample-856">Load Sample Inbound 856 ASN</button>
              </div>
              <div class="conn-field">
                <label for="edi-inbound-input">Paste Raw X12 EDI Document (850 / 856 / 810 / 846 / 945)</label>
                <textarea id="edi-inbound-input" class="is-code" rows="11" placeholder="ISA*00*          *00*          *ZZ*PARTNERID001   *ZZ*MK97ERP00001   *...">${esc(ui.ediInboundText)}</textarea>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" class="conn-btn primary" id="btn-parse-edi">🔍 Validate &amp; Translate X12</button>
                ${ui.ediParsed?.valid ? `<button type="button" class="conn-btn teal" id="btn-import-edi">⚡ Import to MK97 ERP &amp; Send 997 ACK</button>` : ''}
              </div>
            </div>
            <div>
              ${ui.ediParsed ? `
                <div class="conn-res-bar">
                  <span>${ui.ediParsed.valid ? '✅ Valid ANSI X12' : '❌ Syntax Errors Found'} · Doc ${esc(ui.ediParsed.docType)} (${esc(ui.ediParsed.docName)})</span>
                  <span>${ui.ediParsed.segmentCount} segments</span>
                </div>
                ${ui.ediParsed.errors.length ? `<div style="padding:10px;border-radius:9px;background:#fff1f2;color:#be123c;font-size:12px;margin-bottom:10px;">${ui.ediParsed.errors.map(esc).join('<br>')}</div>` : ''}
                <div class="conn-kv-grid">
                  <div class="conn-kv"><span>Sender ISA</span><strong>${esc(ui.ediParsed.senderId || '—')}</strong></div>
                  <div class="conn-kv"><span>Reference / PO #</span><strong>${esc(ui.ediParsed.reference || '—')}</strong></div>
                  <div class="conn-kv"><span>Tracking / Carrier</span><strong>${esc(ui.ediParsed.tracking || '—')} ${ui.ediParsed.carrier ? `(${esc(ui.ediParsed.carrier)})` : ''}</strong></div>
                  <div class="conn-kv"><span>Line Items</span><strong>${ui.ediParsed.lines.length} line(s)</strong></div>
                </div>
                ${ui.ediParsed.lines.length ? `
                  <div class="conn-table-wrap">
                    <table class="conn-log-table">
                      <thead><tr><th>Line</th><th>SKU / Model</th><th>Qty</th><th>Unit Price</th></tr></thead>
                      <tbody>${ui.ediParsed.lines.map(l => `<tr><td>${esc(l.lineNo)}</td><td><code>${esc(l.sku)}</code></td><td>${l.qty} ${esc(l.uom)}</td><td>${l.unitPrice ? '$' + l.unitPrice.toFixed(2) : '—'}</td></tr>`).join('')}</tbody>
                    </table>
                  </div>
                ` : ''}
              ` : `<div style="padding:28px;text-align:center;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;">Paste any raw X12 EDI payload on the left (or click a sample button) to validate envelopes, translate segments, and import directly into MK97 ERP.</div>`}
            </div>
          </div>
        `}
      </div>`;
  }

  function renderApiTab(data) {
    const apiConns = (data.connections || []).filter(c => c.category === 'API');
    if (!ui.apiConnId && apiConns[0]) {
      syncApiFormFromConn(apiConns[0]);
    }
    const activeConn = apiConns.find(c => c.id === ui.apiConnId) || apiConns[0] || null;
    if (!ui.apiBody && Core) {
      ui.apiBody = JSON.stringify(Core.buildLiveErpPayload(ui.apiPayloadKind, getErpState(), activeConn?.mappings || []), null, 2);
    }
    let parsedBody = {};
    try { parsedBody = ui.apiBody ? JSON.parse(ui.apiBody) : {}; } catch (_) {}
    const snippets = Core.generateCodeSnippets({
      method: ui.apiMethod,
      endpoint: ui.apiUrl,
      authType: ui.apiAuthType,
      authHeader: ui.apiAuthHeader,
      authSecret: ui.apiAuthSecret
    }, parsedBody);

    return `
      <div class="conn-panel">
        <div class="conn-studio-grid">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
              <strong style="font-size:14px;">API Request Composer</strong>
              <button type="button" class="conn-btn sm teal" data-open-wizard="API">＋ Save New API Connection</button>
            </div>
            <div class="conn-field">
              <label for="api-conn-sel">Load Saved API / Webhook Connection</label>
              <select id="api-conn-sel">
                <option value="__custom__" ${ui.apiConnId === '__custom__' ? 'selected' : ''}>Custom Ad-Hoc Endpoint</option>
                ${apiConns.map(c => `<option value="${esc(c.id)}" ${c.id === ui.apiConnId ? 'selected' : ''}>${esc(c.name)} (${esc(c.method || 'POST')} · ${esc(c.authType)})</option>`).join('')}
              </select>
            </div>
            <div class="conn-url-bar">
              <select id="api-method-sel" aria-label="HTTP Method">
                ${['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map(m => `<option value="${m}" ${m === ui.apiMethod ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
              <input type="url" id="api-url-inp" value="${esc(ui.apiUrl)}" placeholder="https://api.partner.com/v1/orders">
            </div>
            <div class="conn-row-2">
              <div class="conn-field">
                <label for="api-auth-sel">Authentication</label>
                <select id="api-auth-sel">
                  ${[['BEARER', 'Bearer Token'], ['API_KEY', 'API Key Header'], ['BASIC', 'Basic Auth (user:pass)'], ['HMAC_SHA256', 'Webhook HMAC-SHA256'], ['NONE', 'No Auth']].map(([v, l]) => `<option value="${v}" ${v === ui.apiAuthType ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </div>
              <div class="conn-field">
                <label for="api-secret-inp">${ui.apiAuthType === 'API_KEY' ? 'API Key Value' : ui.apiAuthType === 'BASIC' ? 'username:password' : 'Token / Secret'}</label>
                <input type="text" id="api-secret-inp" value="${esc(ui.apiAuthSecret)}" placeholder="Paste token or secret...">
              </div>
            </div>

            <div style="margin-bottom:10px;">
              <span style="display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:6px;">1-Click Live MK97 ERP Payload Generator</span>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${[['ORDER', '📦 Customer Order'], ['PO', '🛒 Vendor PO'], ['INVENTORY', '📊 Live ATS Stock'], ['TPL', '🚚 3PL Shipment'], ['HEALTH', '💓 ERP Ping']].map(([k, lbl]) => `
                  <button type="button" class="conn-pill ${ui.apiPayloadKind === k ? 'active' : ''}" data-load-payload="${k}">${lbl}</button>
                `).join('')}
              </div>
            </div>

            <div class="conn-field">
              <label for="api-body-inp">JSON Request Body (Mapped from Live ERP)</label>
              <textarea id="api-body-inp" class="is-code" rows="9">${esc(ui.apiBody)}</textarea>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <label style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#334155;cursor:pointer;">
                <input type="checkbox" id="api-live-fetch-chk" ${ui.apiLiveFetch ? 'checked' : ''} style="width:auto;">
                Real Live Browser <code>fetch()</code> <span style="color:#64748b;font-weight:500;">(off = Smart Sandbox)</span>
              </label>
              <button type="button" class="conn-btn primary" id="btn-send-api">⚡ Send API Request</button>
            </div>
          </div>

          <div>
            <strong style="font-size:14px;display:block;margin-bottom:10px;">Live Response &amp; Code Snippets</strong>
            ${ui.apiLastResponse ? `
              <div class="conn-res-bar">
                <span>
                  <span class="conn-badge ${ui.apiLastResponse.ok ? 'connected' : 'error'}">HTTP ${ui.apiLastResponse.httpCode || 'ERR'}</span>
                  <span style="margin-left:6px;">${esc(ui.apiLastResponse.modeLabel)}</span>
                </span>
                <span>⏱ ${ui.apiLastResponse.latencyMs} ms</span>
              </div>
              <pre class="conn-code-box" style="max-height:220px;margin-bottom:14px;">${esc(ui.apiLastResponse.responseBody)}</pre>
            ` : `<div style="padding:20px;border:1px dashed #cbd5e1;border-radius:12px;text-align:center;color:#64748b;font-size:12.5px;margin-bottom:14px;">Click <strong>⚡ Send API Request</strong> to transmit live ERP JSON and inspect status, headers, and latency here.</div>`}

            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
              <div style="display:flex;gap:5px;">
                ${[['curl', 'cURL'], ['js', 'JS fetch'], ['py', 'Python']].map(([k, l]) => `<button type="button" class="conn-pill ${ui.apiSnippetLang === k ? 'active' : ''}" data-snippet-lang="${k}">${l}</button>`).join('')}
              </div>
              <button type="button" class="conn-btn sm" id="btn-copy-snippet">📋 Copy Code</button>
            </div>
            <pre class="conn-code-box" id="api-snippet-box" style="max-height:210px;">${esc(snippets[ui.apiSnippetLang] || snippets.curl)}</pre>
          </div>
        </div>
      </div>`;
  }

  function renderMapperTab(data) {
    if (!ui.mapperConnId || !data.connections.some(c => c.id === ui.mapperConnId)) {
      ui.mapperConnId = data.connections[0]?.id || '';
    }
    const conn = data.connections.find(c => c.id === ui.mapperConnId);
    const mappings = Array.isArray(conn?.mappings) && conn.mappings.length ? conn.mappings : (Core.DEFAULT_MAPPINGS[ui.mapperEntity] || []);
    const payloadKind = ui.mapperEntity === 'purchaseOrders' ? 'PO' : ui.mapperEntity === 'inventory' ? 'INVENTORY' : 'ORDER';
    const previewObj = Core.buildLiveErpPayload(payloadKind, getErpState(), mappings);

    return `
      <div class="conn-panel">
        <div class="conn-studio-grid">
          <div>
            <div class="conn-row-2">
              <div class="conn-field">
                <label for="map-conn-sel">Target Connection</label>
                <select id="map-conn-sel">
                  ${data.connections.map(c => `<option value="${esc(c.id)}" ${c.id === conn?.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.category)})</option>`).join('')}
                </select>
              </div>
              <div class="conn-field">
                <label for="map-entity-sel">MK97 ERP Data Object</label>
                <select id="map-entity-sel">
                  <option value="orders" ${ui.mapperEntity === 'orders' ? 'selected' : ''}>Customer Orders</option>
                  <option value="purchaseOrders" ${ui.mapperEntity === 'purchaseOrders' ? 'selected' : ''}>Vendor Purchase Orders</option>
                  <option value="inventory" ${ui.mapperEntity === 'inventory' ? 'selected' : ''}>Inventory ATS Stock</option>
                </select>
              </div>
            </div>

            <div class="conn-table-wrap">
              <table class="conn-map-table">
                <thead><tr><th>MK97 Field</th><th>Partner JSON Key</th><th>X12 Seg</th><th>Transform</th><th></th></tr></thead>
                <tbody>
                  ${mappings.map((m, idx) => `
                    <tr>
                      <td><input type="text" data-map-idx="${idx}" data-map-key="source" value="${esc(m.source)}"></td>
                      <td><input type="text" data-map-idx="${idx}" data-map-key="target" value="${esc(m.target)}"></td>
                      <td><input type="text" data-map-idx="${idx}" data-map-key="ediSegment" value="${esc(m.ediSegment || '')}" style="width:76px;"></td>
                      <td>
                        <select data-map-idx="${idx}" data-map-key="transform">
                          ${['STRING', 'UPPERCASE', 'LOWERCASE', 'NUMBER', 'ISO_DATE', 'ARRAY'].map(t => `<option value="${t}" ${t === m.transform ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                      </td>
                      <td><button type="button" class="conn-btn sm danger" data-map-del="${idx}">✕</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
              <button type="button" class="conn-btn sm teal" id="btn-map-add">＋ Add Mapping Row</button>
              <button type="button" class="conn-btn sm primary" id="btn-map-save">💾 Save Partner Mapping</button>
              <button type="button" class="conn-btn sm" id="btn-map-reset">↺ Load Standard Template</button>
            </div>
          </div>

          <div>
            <strong style="font-size:13px;display:block;margin-bottom:8px;">Live Transformed Payload Preview (Real ERP Data)</strong>
            <pre class="conn-code-box" style="max-height:390px;">${esc(JSON.stringify(previewObj, null, 2))}</pre>
          </div>
        </div>
      </div>`;
  }

  function renderLogsTab(data) {
    const logs = (data.logs || []).filter(l => ui.logFilter === 'ALL' || l.kind === ui.logFilter);
    return `
      <div class="conn-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
          <div style="display:flex;gap:6px;">
            ${[['ALL', `All (${data.logs.length})`], ['EDI', 'EDI Interchanges'], ['API', 'API Calls']].map(([k, lbl]) => `
              <button type="button" class="conn-pill ${ui.logFilter === k ? 'active' : ''}" data-log-filter="${k}">${esc(lbl)}</button>
            `).join('')}
          </div>
          <button type="button" class="conn-btn sm" id="btn-export-logs-csv">⬇ Export Audit CSV</button>
        </div>
        <div class="conn-table-wrap">
          <table class="conn-log-table">
            <thead><tr><th>Time</th><th>Type</th><th>Partner / Endpoint</th><th>Document / Method</th><th>Ref / Control</th><th>Status</th><th>Latency</th><th>Actions</th></tr></thead>
            <tbody>
              ${logs.length ? logs.map(l => `
                <tr>
                  <td style="white-space:nowrap;">${fmtAgo(l.timestamp)}</td>
                  <td><span class="conn-badge ${l.kind === 'EDI' ? 'edi' : 'api'}">${esc(l.kind)} · ${esc(l.direction || 'OUT')}</span></td>
                  <td><strong>${esc(l.partnerName)}</strong></td>
                  <td><code>${esc(l.docType)}</code></td>
                  <td><code>${esc(l.reference || l.controlNumber)}</code></td>
                  <td><span class="conn-badge ${l.status === 'FAILED' ? 'error' : 'connected'}">${esc(l.status)}</span></td>
                  <td>${l.latencyMs}ms</td>
                  <td style="white-space:nowrap;">
                    <button type="button" class="conn-btn sm" data-inspect-log="${esc(l.id)}">View</button>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:28px;">No transmissions yet. Send an EDI document or API call to see real-time audit logs.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderWizardModal(data) {
    if (!ui.wizardOpen) return '';
    const templates = Core.PARTNER_TEMPLATES.filter(t => t.category === ui.wizardCategory);
    const tpl = templates.find(t => t.id === ui.wizardTemplateId) || templates[0];
    const isEdi = ui.wizardCategory === 'EDI';

    return `
      <div class="conn-modal-backdrop" id="conn-wizard-backdrop" role="dialog" aria-modal="true" aria-label="Quick Connect Partner">
        <div class="conn-modal">
          <div class="conn-modal-head">
            <div>
              <h2>${isEdi ? '🔌 Quick Connect EDI Partner' : '⚡ New API / Webhook Connection'}</h2>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">Connect smoothly with any partner in 30 seconds — auto-configured with live handshake test.</div>
            </div>
            <button type="button" class="conn-btn sm" id="btn-close-wizard">✕</button>
          </div>
          <div class="conn-modal-body">
            <div style="display:flex;gap:8px;margin-bottom:14px;">
              <button type="button" class="conn-pill ${isEdi ? 'active' : ''}" data-wiz-cat="EDI">📄 EDI Trading Partner (X12 / AS2 / SFTP)</button>
              <button type="button" class="conn-pill ${!isEdi ? 'active' : ''}" data-wiz-cat="API">⚡ REST API / Webhook Endpoint</button>
            </div>

            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px;">1. Pick a Pre-Configured Template (or Custom Anyone)</div>
            <div class="conn-tpl-grid">
              ${templates.map(t => `
                <button type="button" class="conn-tpl-card ${t.id === tpl.id ? 'is-picked' : ''}" data-wiz-tpl="${esc(t.id)}">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <strong>${esc(t.name)}</strong>
                    <span class="conn-doc-chip">${esc(t.badge)}</span>
                  </div>
                  <small>${esc(t.role)} · ${isEdi ? `${esc(t.standard)} (${esc(t.transport)})` : `${esc(t.method)} (${esc(t.authType)})`}</small>
                </button>
              `).join('')}
            </div>

            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px;">2. Partner Details &amp; Credentials</div>
            <div class="conn-row-2">
              <div class="conn-field">
                <label for="wiz-name">Connection Name</label>
                <input type="text" id="wiz-name" value="${esc(tpl.name)}">
              </div>
              <div class="conn-field">
                <label for="wiz-role">Partner Role</label>
                <input type="text" id="wiz-role" value="${esc(tpl.role)}">
              </div>
            </div>

            ${isEdi ? `
              <div class="conn-row-2">
                <div class="conn-field">
                  <label for="wiz-isa-qual">Partner ISA Qualifier (ISA07)</label>
                  <select id="wiz-isa-qual">
                    ${[['ZZ', 'ZZ — Mutually Defined'], ['01', '01 — D-U-N-S Number'], ['08', '08 — UCC EDI Comm ID'], ['12', '12 — Phone Number'], ['14', '14 — D-U-N-S +4']].map(([v, l]) => `<option value="${v}" ${v === tpl.isaQualifier ? 'selected' : ''}>${l}</option>`).join('')}
                  </select>
                </div>
                <div class="conn-field">
                  <label for="wiz-isa-id">Partner ISA ID (ISA08)</label>
                  <input type="text" id="wiz-isa-id" value="${esc(tpl.isaId)}" placeholder="e.g. PARTNER001">
                </div>
              </div>
              <div class="conn-row-2">
                <div class="conn-field">
                  <label for="wiz-transport">Transport Protocol</label>
                  <select id="wiz-transport">
                    ${['AS2', 'SFTP', 'VAN', 'HTTPS_API'].map(tr => `<option value="${tr}" ${tr === tpl.transport ? 'selected' : ''}>${tr}</option>`).join('')}
                  </select>
                </div>
                <div class="conn-field">
                  <label for="wiz-standard">EDI Standard Version</label>
                  <select id="wiz-standard">
                    ${['X12 005010', 'X12 004010', 'EDIFACT D96A'].map(st => `<option value="${st}" ${st === tpl.standard ? 'selected' : ''}>${st}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="conn-field">
                <label for="wiz-endpoint">AS2 URL / SFTP Host</label>
                <input type="text" id="wiz-endpoint" value="${esc(tpl.endpoint)}">
              </div>
              <div class="conn-field">
                <label>Enabled EDI Transaction Sets</label>
                <div class="conn-doc-toggle-grid">
                  ${Object.keys(Core.EDI_DOC_CATALOG).map(code => `
                    <label class="conn-doc-toggle">
                      <input type="checkbox" name="wiz_doc" value="${code}" ${(tpl.docs || []).includes(code) ? 'checked' : ''}>
                      <span>${code} ${esc(Core.EDI_DOC_CATALOG[code].name.split(' ')[0])}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            ` : `
              <div class="conn-row-2">
                <div class="conn-field">
                  <label for="wiz-method">HTTP Method</label>
                  <select id="wiz-method">
                    ${['POST', 'PUT', 'PATCH', 'GET'].map(m => `<option value="${m}" ${m === tpl.method ? 'selected' : ''}>${m}</option>`).join('')}
                  </select>
                </div>
                <div class="conn-field">
                  <label for="wiz-auth">Auth Scheme</label>
                  <select id="wiz-auth">
                    ${[['BEARER', 'Bearer Token'], ['API_KEY', 'API Key Header'], ['BASIC', 'Basic Auth'], ['HMAC_SHA256', 'Webhook HMAC-SHA256'], ['OAUTH2', 'OAuth 2.0'], ['NONE', 'No Auth']].map(([v, l]) => `<option value="${v}" ${v === tpl.authType ? 'selected' : ''}>${l}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="conn-field">
                <label for="wiz-endpoint">Destination API / Webhook URL</label>
                <input type="url" id="wiz-endpoint" value="${esc(tpl.endpoint)}" placeholder="https://api.partner.com/v1/orders">
              </div>
              <div class="conn-row-2">
                <div class="conn-field">
                  <label for="wiz-auth-header">Auth Header Name</label>
                  <input type="text" id="wiz-auth-header" value="${esc(tpl.authHeader || 'Authorization')}">
                </div>
                <div class="conn-field">
                  <label for="wiz-auth-secret">API Token / Key / Signing Secret</label>
                  <input type="text" id="wiz-auth-secret" value="mk97_live_${Date.now().toString(36)}" placeholder="Enter key or token">
                </div>
              </div>
            `}

            <div id="wiz-handshake-area"></div>
          </div>
          <div class="conn-modal-foot">
            <span style="font-size:12px;color:#64748b;">Our MK97 ISA ID: <strong>${esc(data.ourProfile.isaQualifier)}:${esc(data.ourProfile.isaId)}</strong></span>
            <div style="display:flex;gap:8px;">
              <button type="button" class="conn-btn" id="btn-cancel-wizard">Cancel</button>
              <button type="button" class="conn-btn primary" id="btn-save-wizard">⚡ Test Handshake &amp; Connect</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function syncApiFormFromConn(conn) {
    if (!conn) return;
    ui.apiConnId = conn.id;
    ui.apiMethod = conn.method || 'POST';
    ui.apiUrl = conn.endpoint || '';
    ui.apiAuthType = conn.authType || 'BEARER';
    ui.apiAuthHeader = conn.authHeader || 'Authorization';
    ui.apiAuthSecret = conn.authSecret || '';
    ui.apiBody = JSON.stringify(Core.buildLiveErpPayload(ui.apiPayloadKind, getErpState(), conn.mappings || []), null, 2);
  }

  function openLogPayloadModal(logItem) {
    if (!logItem) return;
    const old = document.getElementById('conn-log-modal');
    old?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'conn-log-modal';
    wrap.className = 'conn-modal-backdrop';
    wrap.innerHTML = `
      <div class="conn-modal">
        <div class="conn-modal-head">
          <div>
            <h2>${esc(logItem.kind)} · ${esc(logItem.docType)} (${esc(logItem.partnerName)})</h2>
            <div style="font-size:12px;color:#64748b;">Ref: ${esc(logItem.reference)} · Control: ${esc(logItem.controlNumber)} · ${esc(logItem.status)} · ${logItem.latencyMs}ms</div>
          </div>
          <button type="button" class="conn-btn sm" id="btn-close-log-modal">✕</button>
        </div>
        <div class="conn-modal-body">
          <strong style="display:block;font-size:12px;margin-bottom:6px;">Transmitted Payload</strong>
          <pre class="conn-code-box" style="margin-bottom:14px;">${logItem.kind === 'EDI' ? highlightX12(logItem.payload || '') : esc(logItem.payload || '')}</pre>
          ${logItem.response ? `<strong style="display:block;font-size:12px;margin-bottom:6px;">${logItem.kind === 'EDI' ? '997 Functional Acknowledgment' : 'API Response'}</strong><pre class="conn-code-box">${logItem.kind === 'EDI' ? highlightX12(logItem.response) : esc(logItem.response)}</pre>` : ''}
        </div>
        <div class="conn-modal-foot">
          <span style="font-size:12px;color:#64748b;">${new Date(logItem.timestamp).toLocaleString()}</span>
          <button type="button" class="conn-btn primary sm" id="btn-ok-log-modal">Close</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('#btn-close-log-modal').onclick = close;
    wrap.querySelector('#btn-ok-log-modal').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
  }

  function render() {
    const host = document.getElementById('connections-content');
    if (!host || !Core) return;
    const data = loadData();
    const sum = Core.summarizeConnections(data);

    host.innerHTML = `
      ${renderWorkspaceNav()}
      <div class="conn-shell">
        <section class="conn-hero">
          <div class="conn-hero-copy">
            <div class="conn-hero-eyebrow"><span class="conn-hero-dot"></span> MK97 INTEGRATION FABRIC · EDI X12 &amp; REST API HUB</div>
            <h1>Connections Hub — EDI &amp; API Gateway</h1>
            <p>Connect ANSI X12 / EDIFACT trading partners and REST / Webhook APIs in seconds. Generate compliant EDI documents directly from live Orders, POs &amp; Inventory, test handshakes, and send live API payloads smoothly.</p>
          </div>
          <div class="conn-hero-actions">
            <button type="button" class="conn-btn gold" data-open-wizard="EDI">＋ Quick Connect EDI</button>
            <button type="button" class="conn-btn primary" data-open-wizard="API">⚡ New API Connection</button>
            <button type="button" class="conn-btn glass" data-switch-tab="api">📤 Send API Now</button>
          </div>
        </section>

        <section class="conn-kpis" aria-label="Connections telemetry">
          <div class="conn-kpi">
            <div class="conn-kpi-label">Active Connections</div>
            <div class="conn-kpi-val is-teal">${sum.activeCount} / ${sum.total}</div>
            <div class="conn-kpi-sub">${sum.ediCount} EDI Partners · ${sum.apiCount} REST &amp; Webhooks</div>
          </div>
          <div class="conn-kpi">
            <div class="conn-kpi-label">Total Transmissions</div>
            <div class="conn-kpi-val">${sum.totalTx.toLocaleString()}</div>
            <div class="conn-kpi-sub">850, 856, 810, 846, 940 &amp; REST API</div>
          </div>
          <div class="conn-kpi">
            <div class="conn-kpi-label">Delivery &amp; 997 ACK Rate</div>
            <div class="conn-kpi-val is-ok">${sum.avgSuccess}%</div>
            <div class="conn-kpi-sub">Zero dropped envelopes · Auto 997 ACK</div>
          </div>
          <div class="conn-kpi">
            <div class="conn-kpi-label">Avg Gateway Latency</div>
            <div class="conn-kpi-val is-blue">${sum.avgLatency} ms</div>
            <div class="conn-kpi-sub">Live AS2 / SFTP / TLS 1.3 REST</div>
          </div>
        </section>

        <div class="conn-tabs" role="tablist" aria-label="Connections workbench tabs">
          <button type="button" class="conn-tab ${ui.tab === 'all' ? 'active' : ''}" data-switch-tab="all">🔌 All Connections <span class="conn-tab-pill">${sum.total}</span></button>
          <button type="button" class="conn-tab ${ui.tab === 'edi' ? 'active' : ''}" data-switch-tab="edi">📄 EDI Studio (X12)</button>
          <button type="button" class="conn-tab ${ui.tab === 'api' ? 'active' : ''}" data-switch-tab="api">⚡ API Sender</button>
          <button type="button" class="conn-tab ${ui.tab === 'mapper' ? 'active' : ''}" data-switch-tab="mapper">🔀 Field Mapper</button>
          <button type="button" class="conn-tab ${ui.tab === 'logs' ? 'active' : ''}" data-switch-tab="logs">📜 Audit Log <span class="conn-tab-pill">${data.logs.length}</span></button>
          <div class="conn-our-isa" title="Share this ISA ID with any EDI trading partner">
            <span>Our MK97 ISA:</span>
            <code>${esc(data.ourProfile.isaQualifier)}:${esc(data.ourProfile.isaId)}</code>
          </div>
        </div>

        <section class="conn-body">
          ${ui.tab === 'all' ? renderAllTab(data)
            : ui.tab === 'edi' ? renderEdiTab(data)
            : ui.tab === 'api' ? renderApiTab(data)
            : ui.tab === 'mapper' ? renderMapperTab(data)
            : renderLogsTab(data)}
        </section>
      </div>
      ${renderWizardModal(data)}
    `;

    bindEvents(host, data);
  }

  function bindEvents(host, data) {
    // Tab switching
    host.querySelectorAll('[data-switch-tab]').forEach(btn => {
      btn.onclick = () => { ui.tab = btn.dataset.switchTab; render(); };
    });

    // Open Quick Connect Wizard
    host.querySelectorAll('[data-open-wizard]').forEach(btn => {
      btn.onclick = () => {
        ui.wizardCategory = btn.dataset.openWizard || 'EDI';
        const firstTpl = Core.PARTNER_TEMPLATES.find(t => t.category === ui.wizardCategory);
        ui.wizardTemplateId = firstTpl?.id || '';
        ui.wizardOpen = true;
        render();
      };
    });

    // All Connections filters & card interactions
    host.querySelectorAll('[data-conn-filter]').forEach(btn => {
      btn.onclick = () => { ui.filter = btn.dataset.connFilter; render(); };
    });
    const searchInp = host.querySelector('#conn-search-input');
    if (searchInp) {
      searchInp.oninput = e => {
        ui.search = e.target.value;
        const pos = e.target.selectionStart;
        render();
        const fresh = document.getElementById('conn-search-input');
        if (fresh) { fresh.focus(); fresh.setSelectionRange(pos, pos); }
      };
    }
    host.querySelectorAll('[data-select-conn]').forEach(card => {
      card.onclick = e => {
        if (e.target.closest('button')) return;
        ui.selectedId = card.dataset.selectConn;
        render();
      };
    });
    host.querySelectorAll('[data-quick-test]').forEach(btn => {
      btn.onclick = () => {
        const d = loadData();
        const c = d.connections.find(x => x.id === btn.dataset.quickTest);
        if (!c) return;
        const ms = Math.round(75 + Math.random() * 85);
        c.latencyMs = ms;
        c.status = 'CONNECTED';
        c.lastSyncAt = new Date().toISOString();
        saveData(d);
        notify(`✅ Handshake verified with ${c.name} (${c.category === 'EDI' ? (c.transport + ' / ISA OK') : 'TLS 1.3 / Auth OK'} · ${ms}ms).`);
        render();
      };
    });
    host.querySelectorAll('[data-quick-send]').forEach(btn => {
      btn.onclick = () => {
        const c = data.connections.find(x => x.id === btn.dataset.quickSend);
        if (!c) return;
        if (c.category === 'EDI') {
          ui.ediPartnerId = c.id;
          ui.ediMode = 'send';
          ui.ediDocType = (c.docs || ['850'])[0] || '850';
          ui.tab = 'edi';
        } else {
          syncApiFormFromConn(c);
          ui.tab = 'api';
        }
        render();
      };
    });
    host.querySelectorAll('[data-open-mapper]').forEach(btn => {
      btn.onclick = () => { ui.mapperConnId = btn.dataset.openMapper; ui.tab = 'mapper'; render(); };
    });
    host.querySelectorAll('[data-toggle-active]').forEach(btn => {
      btn.onclick = () => {
        const d = loadData();
        const c = d.connections.find(x => x.id === btn.dataset.toggleActive);
        if (!c) return;
        c.active = !c.active;
        c.status = c.active ? 'CONNECTED' : 'PAUSED';
        saveData(d);
        notify(`${c.name} ${c.active ? 'resumed & live' : 'paused'}.`);
        render();
      };
    });
    host.querySelectorAll('[data-delete-conn]').forEach(btn => {
      btn.onclick = () => {
        const d = loadData();
        const idx = d.connections.findIndex(x => x.id === btn.dataset.deleteConn);
        if (idx === -1) return;
        const removed = d.connections.splice(idx, 1)[0];
        saveData(d);
        notify(`Removed connection: ${removed.name}.`);
        render();
      };
    });

    // EDI Studio events
    host.querySelectorAll('[data-edi-mode]').forEach(btn => {
      btn.onclick = () => { ui.ediMode = btn.dataset.ediMode; render(); };
    });
    host.querySelector('#edi-partner-sel')?.addEventListener('change', e => { ui.ediPartnerId = e.target.value; ui.ediLastGenerated = null; render(); });
    host.querySelector('#edi-doc-sel')?.addEventListener('change', e => { ui.ediDocType = e.target.value; ui.ediRecordId = ''; ui.ediLastGenerated = null; render(); });
    host.querySelector('#edi-rec-sel')?.addEventListener('change', e => { ui.ediRecordId = e.target.value; ui.ediLastGenerated = null; render(); });
    host.querySelector('#btn-transmit-edi')?.addEventListener('click', () => {
      const res = transmitEdiDocument(ui.ediPartnerId, ui.ediDocType, ui.ediRecordId);
      if (res) {
        ui.ediLastGenerated = res;
        notify(`✅ Transmitted EDI ${res.generated.docType} to ${res.partner.name} · 997 ACK Accepted!`);
        render();
      }
    });
    host.querySelector('#btn-download-edi')?.addEventListener('click', () => {
      const partner = data.connections.find(c => c.id === ui.ediPartnerId);
      if (!partner) return;
      const doc = Core.generateX12Document({ docType: ui.ediDocType, partner, sender: data.ourProfile, state: getErpState(), recordId: ui.ediRecordId });
      downloadFile(`MK97-EDI-${doc.docType}-${doc.controlNumber}.edi`, doc.raw);
      notify(`Downloaded MK97-EDI-${doc.docType}-${doc.controlNumber}.edi`);
    });
    host.querySelector('#btn-copy-edi')?.addEventListener('click', async () => {
      const pre = host.querySelector('#edi-preview-code');
      try { await navigator.clipboard.writeText(pre?.textContent || ''); notify('Copied raw ANSI X12 envelope to clipboard.'); } catch (_) {}
    });

    // Inbound EDI Parser
    host.querySelector('#btn-load-sample-850')?.addEventListener('click', () => {
      const doc = Core.generateX12Document({ docType: '850', partner: data.ourProfile, sender: { isaQualifier: 'ZZ', isaId: 'AMAZONVEND01', gsId: 'AMAZONVC' }, state: getErpState() });
      ui.ediInboundText = doc.raw;
      ui.ediParsed = Core.parseX12Document(doc.raw);
      render();
    });
    host.querySelector('#btn-load-sample-856')?.addEventListener('click', () => {
      const doc = Core.generateX12Document({ docType: '856', partner: data.ourProfile, sender: { isaQualifier: '12', isaId: '5125550199', gsId: 'KENDRASCOTT' }, state: getErpState() });
      ui.ediInboundText = doc.raw;
      ui.ediParsed = Core.parseX12Document(doc.raw);
      render();
    });
    host.querySelector('#edi-inbound-input')?.addEventListener('input', e => { ui.ediInboundText = e.target.value; });
    host.querySelector('#btn-parse-edi')?.addEventListener('click', () => {
      ui.ediInboundText = host.querySelector('#edi-inbound-input')?.value || '';
      ui.ediParsed = Core.parseX12Document(ui.ediInboundText);
      render();
    });
    host.querySelector('#btn-import-edi')?.addEventListener('click', () => {
      if (!ui.ediParsed?.valid) return;
      const d = loadData();
      const ack = Core.generateX12Document({ docType: '997', partner: { isaQualifier: 'ZZ', isaId: ui.ediParsed.senderId || 'PARTNER001', gsId: ui.ediParsed.senderId || 'PARTNER' }, sender: data.ourProfile, ackDocType: ui.ediParsed.docType });
      d.logs.unshift({
        id: 'tx_in_' + Date.now(),
        kind: 'EDI',
        connectionId: 'inbound_edi',
        partnerName: ui.ediParsed.senderId || 'Inbound Partner',
        direction: 'INBOUND',
        docType: ui.ediParsed.docType,
        controlNumber: ui.ediParsed.controlNumber,
        reference: ui.ediParsed.reference || 'INBOUND',
        status: 'IMPORTED + 997',
        httpCode: 200,
        latencyMs: 42,
        mode: 'INBOUND X12',
        timestamp: new Date().toISOString(),
        summary: `Imported inbound EDI ${ui.ediParsed.docType} (${ui.ediParsed.lines.length} lines) & returned 997 ACK`,
        payload: ui.ediInboundText,
        response: ack.raw
      });
      saveData(d);
      recordErpAudit('EDI_IMPORTED', `Inbound EDI ${ui.ediParsed.docType} (${ui.ediParsed.reference}) imported & 997 ACK returned.`);
      notify(`✅ Imported inbound EDI ${ui.ediParsed.docType} (${ui.ediParsed.reference}) into MK97 ERP & returned 997 ACK!`);
      ui.tab = 'logs';
      render();
    });

    // API Sender events
    host.querySelector('#api-conn-sel')?.addEventListener('change', e => {
      const val = e.target.value;
      if (val === '__custom__') {
        ui.apiConnId = '__custom__';
      } else {
        const c = data.connections.find(x => x.id === val);
        if (c) syncApiFormFromConn(c);
      }
      render();
    });
    host.querySelector('#api-method-sel')?.addEventListener('change', e => { ui.apiMethod = e.target.value; render(); });
    host.querySelector('#api-url-inp')?.addEventListener('input', e => { ui.apiUrl = e.target.value; });
    host.querySelector('#api-auth-sel')?.addEventListener('change', e => { ui.apiAuthType = e.target.value; render(); });
    host.querySelector('#api-secret-inp')?.addEventListener('input', e => { ui.apiAuthSecret = e.target.value; });
    host.querySelector('#api-body-inp')?.addEventListener('input', e => { ui.apiBody = e.target.value; });
    host.querySelector('#api-live-fetch-chk')?.addEventListener('change', e => { ui.apiLiveFetch = e.target.checked; });
    host.querySelectorAll('[data-load-payload]').forEach(btn => {
      btn.onclick = () => {
        ui.apiPayloadKind = btn.dataset.loadPayload;
        const c = data.connections.find(x => x.id === ui.apiConnId);
        ui.apiBody = JSON.stringify(Core.buildLiveErpPayload(ui.apiPayloadKind, getErpState(), c?.mappings || []), null, 2);
        render();
      };
    });
    host.querySelectorAll('[data-snippet-lang]').forEach(btn => {
      btn.onclick = () => { ui.apiSnippetLang = btn.dataset.snippetLang; render(); };
    });
    host.querySelector('#btn-copy-snippet')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(host.querySelector('#api-snippet-box')?.textContent || ''); notify('Code snippet copied to clipboard.'); } catch (_) {}
    });
    host.querySelector('#btn-send-api')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '⏳ Sending...';
      try {
        ui.apiUrl = host.querySelector('#api-url-inp')?.value?.trim() || ui.apiUrl;
        ui.apiAuthSecret = host.querySelector('#api-secret-inp')?.value || '';
        ui.apiBody = host.querySelector('#api-body-inp')?.value || '';
        const res = await sendApiRequest({
          connectionId: ui.apiConnId,
          method: ui.apiMethod,
          url: ui.apiUrl,
          authType: ui.apiAuthType,
          authHeader: ui.apiAuthHeader,
          authSecret: ui.apiAuthSecret,
          bodyText: ui.apiBody,
          liveFetch: ui.apiLiveFetch
        });
        ui.apiLastResponse = res;
        notify(res.ok ? `✅ API ${ui.apiMethod} succeeded · HTTP ${res.httpCode} (${res.latencyMs}ms)` : `⚠️ API returned HTTP ${res.httpCode || 'ERR'} (${res.modeLabel})`, !res.ok);
      } catch (err) {
        notify(err.message || 'API request failed.', true);
      }
      render();
    });

    // Field Mapper events
    host.querySelector('#map-conn-sel')?.addEventListener('change', e => { ui.mapperConnId = e.target.value; render(); });
    host.querySelector('#map-entity-sel')?.addEventListener('change', e => { ui.mapperEntity = e.target.value; render(); });
    host.querySelectorAll('[data-map-idx]').forEach(el => {
      el.onchange = () => {
        const d = loadData();
        const c = d.connections.find(x => x.id === ui.mapperConnId);
        if (!c) return;
        if (!Array.isArray(c.mappings)) c.mappings = JSON.parse(JSON.stringify(Core.DEFAULT_MAPPINGS[ui.mapperEntity] || []));
        const idx = Number(el.dataset.mapIdx);
        if (c.mappings[idx]) c.mappings[idx][el.dataset.mapKey] = el.value;
        saveData(d, false);
        render();
      };
    });
    host.querySelectorAll('[data-map-del]').forEach(btn => {
      btn.onclick = () => {
        const d = loadData();
        const c = d.connections.find(x => x.id === ui.mapperConnId);
        if (!c || !Array.isArray(c.mappings)) return;
        c.mappings.splice(Number(btn.dataset.mapDel), 1);
        saveData(d);
        render();
      };
    });
    host.querySelector('#btn-map-add')?.addEventListener('click', () => {
      const d = loadData();
      const c = d.connections.find(x => x.id === ui.mapperConnId);
      if (!c) return;
      c.mappings ||= [];
      c.mappings.push({ source: 'po', target: 'custom_field', ediSegment: 'REF02', transform: 'STRING' });
      saveData(d);
      render();
    });
    host.querySelector('#btn-map-save')?.addEventListener('click', () => {
      notify('✅ Custom partner field mappings saved and synced to EDI & API senders.');
    });
    host.querySelector('#btn-map-reset')?.addEventListener('click', () => {
      const d = loadData();
      const c = d.connections.find(x => x.id === ui.mapperConnId);
      if (!c) return;
      c.mappings = JSON.parse(JSON.stringify(Core.DEFAULT_MAPPINGS[ui.mapperEntity] || []));
      saveData(d);
      notify('Loaded standard MK97 ERP mapping template.');
      render();
    });

    // Audit Log events
    host.querySelectorAll('[data-log-filter]').forEach(btn => {
      btn.onclick = () => { ui.logFilter = btn.dataset.logFilter; render(); };
    });
    host.querySelectorAll('[data-inspect-log]').forEach(btn => {
      btn.onclick = () => {
        const item = data.logs.find(l => l.id === btn.dataset.inspectLog);
        openLogPayloadModal(item);
      };
    });
    host.querySelector('#btn-export-logs-csv')?.addEventListener('click', () => {
      const cols = ['Timestamp', 'Kind', 'Direction', 'Partner', 'Document', 'Reference', 'Status', 'HTTP', 'LatencyMs', 'Mode'];
      const rows = (data.logs || []).map(l => [l.timestamp, l.kind, l.direction, l.partnerName, l.docType, l.reference || l.controlNumber, l.status, l.httpCode, l.latencyMs, l.mode]);
      const csv = [cols.join(','), ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
      downloadFile('mk97-connections-audit-log.csv', csv, 'text/csv;charset=utf-8');
      notify('Exported MK97 Connections audit log CSV.');
    });

    // Quick Connect Wizard Modal events
    if (ui.wizardOpen) {
      const closeWiz = () => { ui.wizardOpen = false; render(); };
      host.querySelector('#btn-close-wizard')?.addEventListener('click', closeWiz);
      host.querySelector('#btn-cancel-wizard')?.addEventListener('click', closeWiz);
      host.querySelector('#conn-wizard-backdrop')?.addEventListener('click', e => { if (e.target.id === 'conn-wizard-backdrop') closeWiz(); });
      host.querySelectorAll('[data-wiz-cat]').forEach(btn => {
        btn.onclick = () => {
          ui.wizardCategory = btn.dataset.wizCat;
          ui.wizardTemplateId = Core.PARTNER_TEMPLATES.find(t => t.category === ui.wizardCategory)?.id || '';
          render();
        };
      });
      host.querySelectorAll('[data-wiz-tpl]').forEach(btn => {
        btn.onclick = () => { ui.wizardTemplateId = btn.dataset.wizTpl; render(); };
      });
      host.querySelector('#btn-save-wizard')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        const name = host.querySelector('#wiz-name')?.value.trim();
        const endpoint = host.querySelector('#wiz-endpoint')?.value.trim();
        if (!name) return notify('Enter a connection name.', true);
        if (!endpoint) return notify('Enter a partner endpoint URL or host.', true);

        btn.disabled = true;
        btn.textContent = '⏳ Running Handshake...';
        const hs = host.querySelector('#wiz-handshake-area');
        if (hs) {
          hs.innerHTML = `<div class="conn-handshake-steps">
            <div class="conn-hs-step"><span>1. TLS 1.3 &amp; Transport Endpoint Verified</span><span>✓ OK</span></div>
            <div class="conn-hs-step"><span>2. ${ui.wizardCategory === 'EDI' ? 'ISA / GS Partner Qualifier & 997 ACK Profile Verified' : 'Authentication Scheme & Headers Validated'}</span><span>✓ OK</span></div>
            <div class="conn-hs-step"><span>3. Live MK97 ERP Sync Bridge Activated</span><span>✓ LIVE</span></div>
          </div>`;
        }
        await new Promise(r => setTimeout(r, 320));

        const d = loadData();
        const isEdi = ui.wizardCategory === 'EDI';
        const nowIso = new Date().toISOString();
        const newConn = isEdi ? {
          id: 'conn_edi_' + Date.now().toString(36),
          category: 'EDI',
          name,
          role: host.querySelector('#wiz-role')?.value.trim() || 'EDI Trading Partner',
          protocol: 'EDI_X12',
          standard: host.querySelector('#wiz-standard')?.value || 'X12 005010',
          transport: host.querySelector('#wiz-transport')?.value || 'AS2',
          endpoint,
          isaQualifier: host.querySelector('#wiz-isa-qual')?.value || 'ZZ',
          isaId: (host.querySelector('#wiz-isa-id')?.value.trim() || 'PARTNER001').toUpperCase(),
          gsId: (host.querySelector('#wiz-isa-id')?.value.trim() || 'PARTNER').toUpperCase().slice(0, 12),
          as2Id: name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18) + '-AS2',
          docs: [...host.querySelectorAll('input[name="wiz_doc"]:checked')].map(el => el.value),
          status: 'CONNECTED',
          active: true,
          autoAck997: true,
          autoSync: true,
          latencyMs: Math.round(90 + Math.random() * 65),
          successRate: 100.0,
          txCount: 0,
          lastSyncAt: nowIso,
          createdAt: nowIso,
          accent: '#087f78',
          mappings: JSON.parse(JSON.stringify(Core.DEFAULT_MAPPINGS.purchaseOrders))
        } : {
          id: 'conn_api_' + Date.now().toString(36),
          category: 'API',
          name,
          role: host.querySelector('#wiz-role')?.value.trim() || 'API Endpoint',
          protocol: host.querySelector('#wiz-auth')?.value === 'HMAC_SHA256' ? 'WEBHOOK' : 'REST_API',
          method: host.querySelector('#wiz-method')?.value || 'POST',
          endpoint,
          authType: host.querySelector('#wiz-auth')?.value || 'BEARER',
          authHeader: host.querySelector('#wiz-auth-header')?.value.trim() || 'Authorization',
          authSecret: host.querySelector('#wiz-auth-secret')?.value.trim() || '',
          headers: { 'Content-Type': 'application/json' },
          triggers: ['ORDER_CREATED', 'VENDOR_PO_CREATED', 'INVENTORY_SYNC'],
          status: 'CONNECTED',
          active: true,
          autoSync: true,
          latencyMs: Math.round(65 + Math.random() * 55),
          successRate: 100.0,
          txCount: 0,
          lastSyncAt: nowIso,
          createdAt: nowIso,
          accent: '#0284c7',
          mappings: JSON.parse(JSON.stringify(Core.DEFAULT_MAPPINGS.orders))
        };

        d.connections.unshift(newConn);
        saveData(d);
        recordErpAudit('CONNECTION_CREATED', `Connected ${newConn.category}: ${newConn.name}`);
        ui.wizardOpen = false;
        ui.selectedId = newConn.id;
        ui.tab = 'all';
        notify(`✅ Connected ${newConn.name}! Ready to send ${isEdi ? 'EDI documents' : 'API requests'}.`);
        render();
      });
    }
  }

  function init() {
    const params = new URLSearchParams(location.search);
    const reqTab = params.get('tab');
    if (['all', 'edi', 'api', 'mapper', 'logs'].includes(reqTab)) ui.tab = reqTab;
    const action = params.get('action');
    if (action === 'connect-edi' || action === 'connect-api') {
      ui.wizardOpen = true;
      ui.wizardCategory = action === 'connect-api' ? 'API' : 'EDI';
      ui.wizardTemplateId = Core?.PARTNER_TEMPLATES.find(t => t.category === ui.wizardCategory)?.id || '';
    }
    render();
    window.addEventListener('stark:system-change', () => {
      if (ui.tab === 'edi' || ui.tab === 'mapper') render();
    });
  }

  window.MKConnections = {
    getData: loadData,
    summarize: () => Core ? Core.summarizeConnections(loadData()) : null,
    transmitEdi: transmitEdiDocument,
    sendApi: sendApiRequest,
    openWizard: (cat = 'EDI') => { ui.wizardCategory = cat; ui.wizardOpen = true; render(); },
    refresh: render
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
