/* Supply AI Chain Hub: the explicit website_chat contract, never Gradio UI events. */
(function (root) {
  'use strict';
  const SPACE = 'MMK97/supply-ai-chain-hub';
  const ORIGIN = 'https://mmk97-supply-ai-chain-hub.hf.space';
  const ENDPOINT = ORIGIN + '/gradio_api/call/website_chat';
  const MODEL_LABEL = 'Supply AI Chain Hub';
  const MAX_CONTEXT = 16000;
  const guidance = '\n\nUse the supplied verified website facts when relevant. Cite source IDs in square brackets. Keep regions and currencies separate. State missing data and excerpt limits. Distinguish calculated facts from suggestions; do not claim actions were executed.';
  const abortError = () => new DOMException('Analysis cancelled.', 'AbortError');
  const checkAbort = signal => { if (signal?.aborted) throw abortError(); };
  const tools = () => root.MKAnalysisTools;
  function pairedHistory(messages = []) {
    const pairs = []; let pending;
    for (const item of messages) {
      if (item.role === 'user' && typeof item.content === 'string') pending = item.content;
      else if (item.role === 'assistant' && typeof item.content === 'string' && pending) {
        pairs.push({ user: pending.slice(0, 6000), assistant: item.content.slice(0, 8000) }); pending = null;
      }
    }
    // Bound complete turns rather than cutting an individual JSON history object.
    while (pairs.length > 6 || JSON.stringify(pairs).length > 24000) pairs.shift();
    return pairs;
  }
  function collectIds(value, ids = new Set()) {
    if (Array.isArray(value)) value.forEach(item => collectIds(item, ids));
    else if (value && typeof value === 'object') {
      if (typeof value.evidence_id === 'string') ids.add(value.evidence_id);
      if (Array.isArray(value.evidence_ids)) value.evidence_ids.forEach(id => ids.add(id));
      Object.values(value).forEach(item => { if (item && typeof item === 'object') collectIds(item, ids); });
    }
    return ids;
  }
  function bound(value, limit, path, limits) {
    if (Array.isArray(value)) {
      const count = /\.(items|brands|records)$/.test(path) ? limit : Math.min(12, value.length);
      if (value.length > count) limits.push({ collection: path, available: value.length, included: count });
      return value.slice(0, count).map((item, index) => bound(item, limit, path + '[' + index + ']', limits));
    }
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, bound(item, limit, path + '.' + key, limits)]));
    return typeof value === 'string' ? value.slice(0, 500) : value;
  }
  function buildContext(source, local, notes = []) {
    const T = tools(); if (!T) throw new Error('Verified report tools are still loading.');
    const calls = (local.tools || []).filter(call => call.name !== 'report_overview').slice(0, 3);
    const results = calls.map(call => ({ name: call.name, arguments: call.arguments, result: T.run(call.name, call.arguments, source) }));
    const registry = T.evidence(source);
    // Rebuild smaller valid JSON documents, never slice serialized JSON at the Space limit.
    for (const limit of [20, 12, 8, 4, 2, 1, 0]) {
      const excerpts = [];
      const context = {
        contract: 'MK verified website facts v1', capturedAt: source.capturedAt, scope: source.scope,
        reports: source.reports.map(report => ({ evidence_id: report.evidence_id, region: report.region, fileName: report.fileName, importedAt: report.importedAt, settings: report.settings, summary: report.summary, rowsAvailableToWebsite: report.items.length, omittedSourceRows: report.omittedRows })),
        sales: source.sales.map(report => ({ evidence_id: report.evidence_id, region: report.region, currency: report.currency, fileName: report.fileName, importedAt: report.importedAt, summary: report.summary, rowsAvailableToWebsite: report.items.length, omittedSourceRows: report.omittedRows })),
        workspace: { evidence_id: 'workspace:summary', ...source.workspace },
        verified_observations: bound((local.findings || []).slice(0, 8), limit, 'observations', excerpts),
        local_planning_suggestions: bound((local.actions || []).slice(0, 3), limit, 'suggestions', excerpts),
        assumptions: (local.assumptions || []).slice(0, 12).map(value => String(value).slice(0, 300)),
        tool_results: results.map(result => ({ ...result, result: bound(result.result, limit, result.name, excerpts) })),
        explicitly_remembered_notes: limit > 1 ? notes.slice(-8).map(value => String(value).slice(0, 300)) : [],
        coverage: {
          explanation: 'Report totals describe the full imported website reports. Tool records are bounded excerpts. Brand/scenario totals may be partial when source rows are omitted. Sales valuations use historical units and current price/cost; they are estimates, not accounting totals. Missing records are unknown, not zero.',
          contextExcerpts: excerpts,
        },
      };
      const ids = collectIds(context);
      context.source_labels = registry.filter(item => ids.has(item.id)).map(item => ({ id: item.id, label: item.label.slice(0, 200) }));
      const encoded = JSON.stringify(context);
      if (encoded.length <= MAX_CONTEXT) return { text: encoded, ids, excerpts, evidence: registry.filter(item => ids.has(item.id)) };
    }
    throw new Error('The verified report context is too large. Ask about one region or model.');
  }
  function parseEnvelope(data) {
    if (!Array.isArray(data) || data.length !== 1) throw new Error('The Space returned an unexpected website_chat output.');
    let result = data[0];
    if (typeof result === 'string') { try { result = JSON.parse(result); } catch { throw new Error('The Space returned interface text instead of an analysis.'); } }
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The Space returned an invalid analysis.');
    if (result.ok === false) throw new Error(String(result.error || 'The Space could not complete this analysis.').slice(0, 1000));
    if (result.ok !== true || typeof result.answer !== 'string' || !result.answer.trim() || /^enter a message\.?$/i.test(result.answer.trim())) throw new Error('The Space returned no usable analysis.');
    if (result.answer.length > 48000) throw new Error('The Space response exceeded the website output limit.');
    return result;
  }
  async function readResult(response, signal) {
    let buffer = '', size = 0;
    function event(block) {
      let kind = '', values = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) kind = line.slice(6).trim();
        else if (line.startsWith('data:')) values.push(line.slice(5).trimStart());
      }
      if (kind !== 'complete' && kind !== 'error') return;
      let data; try { data = JSON.parse(values.join('\n')); } catch { throw new Error('The Space returned malformed event data.'); }
      if (kind === 'error') throw new Error(typeof data === 'string' ? data.slice(0, 1000) : 'The Space request failed. Check the Space status and try again.');
      return parseEnvelope(data);
    }
    function append(chunk, final = false) {
      size += chunk.length; if (size > 1048576) throw new Error('The Space response is too large.');
      buffer += chunk;
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length);
        const result = event(block); if (result) return result;
      }
      if (final && buffer.trim()) return event(buffer);
    }
    if (!response.body?.getReader) { checkAbort(signal); const result = append(await response.text(), true); checkAbort(signal); if (result) return result; }
    else {
      const reader = response.body.getReader(), decoder = new TextDecoder();
      try {
        while (true) {
          checkAbort(signal); const { value, done } = await reader.read(); checkAbort(signal);
          const result = append(done ? decoder.decode() : decoder.decode(value, { stream: true }), done);
          if (result) return result;
          if (done) break;
        }
      } finally { reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    throw new Error('The Space closed the connection without a completed analysis.');
  }
  async function checkedFetch(fetcher, url, options) {
    const response = await fetcher(url, { credentials: 'omit', cache: 'no-store', ...options });
    if (response.ok) return response;
    if ([401, 403].includes(response.status)) throw new Error('Space access is restricted. A private Space needs a server connection; keep access tokens out of this website.');
    if (response.status === 429) throw new Error('The Space is busy or rate-limiting requests. Try again shortly.');
    if ([502, 503, 504].includes(response.status)) throw new Error('The Space is starting or unavailable. Try again shortly.');
    throw new Error('Space request failed (HTTP ' + response.status + ').');
  }
  async function timedRequest(signal, milliseconds, work) {
    checkAbort(signal);
    const controller = new AbortController(); let timedOut = false;
    const stop = () => controller.abort(); signal?.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, milliseconds);
    try { const result = await work(controller.signal); checkAbort(signal); return result; }
    catch (error) { if (signal?.aborted) throw abortError(); if (timedOut) throw new Error('The Space timed out. Try a narrower question or Fast mode.'); throw error; }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
  }
  async function analyzeWithAI(payload, signal, options = {}) {
    const question = String(payload.question || '').trim();
    if (!question || question.length + guidance.length > 12000) throw new Error('Enter a question of up to ' + (12000 - guidance.length) + ' characters.');
    checkAbort(signal);
    const depth = ['Fast', 'Auto', 'Deep'].includes(payload.depth) ? payload.depth : 'Auto';
    const local = payload.localResult || { findings: [], actions: [], assumptions: [], tools: [] };
    const context = buildContext(payload.snapshot, local, payload.notes || []);
    const request = { message: question + guidance, context: context.text, history: pairedHistory(payload.history), mode: depth };
    const fetcher = options.fetcher || root.fetch.bind(root);
    const result = await timedRequest(signal, options.timeoutMs || (depth === 'Deep' ? 300000 : depth === 'Fast' ? 120000 : 180000), async innerSignal => {
      const response = await checkedFetch(fetcher, ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [request] }), signal: innerSignal });
      const queued = await response.json(); checkAbort(innerSignal);
      if (typeof queued.event_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(queued.event_id)) throw new Error('The Space did not return a valid request ID.');
      const stream = await checkedFetch(fetcher, ENDPOINT + '/' + encodeURIComponent(queued.event_id), { headers: { Accept: 'text/event-stream' }, signal: innerSignal });
      return readResult(stream, innerSignal);
    });
    const citations = [...new Set([
      ...[...result.answer.matchAll(/\b(?:US|EU|CA|workspace):[A-Za-z0-9:_-]+/g)].map(match => match[0]),
      ...[...result.answer.matchAll(/\[((?:[A-Z]{2,10}|workspace):[^\]\s]+)\]/g)].map(match => match[1]),
    ])];
    if (citations.some(id => !context.ids.has(id))) throw new Error('The Space cited evidence outside the report context. Verified local analysis is available.');
    const activity = Array.isArray(result.activity) ? result.activity.slice(0, 20).map(item => ({ name: String(item?.tool || 'Space analysis').slice(0, 100), status: item?.success === true ? 'complete' : 'needs review', origin: 'Space' })) : [];
    return {
      ...local, answer: result.answer.trim(), mode: 'ai', provider: 'huggingface', model: MODEL_LABEL, depth,
      capturedAt: payload.snapshot.capturedAt, evidence: context.evidence,
      findingsLabel: 'Verified website facts', actionsLabel: 'Local planning suggestions', evidenceLabel: 'Report evidence sent to the Space',
      assumptions: [...(local.assumptions || []), 'The Space explanation is model-generated. Calculated website facts and planning suggestions are shown separately for review.', ...(context.excerpts.length ? ['The Space received bounded record excerpts; full regional report totals were retained.'] : [])],
      tools: [...(local.tools || []).map(item => ({ ...item, origin: 'Website' })), ...activity],
    };
  }
  async function testConnection(signal, options = {}) {
    const fetcher = options.fetcher || root.fetch.bind(root);
    return timedRequest(signal, options.timeoutMs || 30000, async innerSignal => {
      const response = await checkedFetch(fetcher, ORIGIN + '/gradio_api/info', { signal: innerSignal });
      const info = await response.json(), endpoint = info.named_endpoints?.['/website_chat'];
      if (!endpoint || endpoint.parameters?.length !== 1 || endpoint.parameters[0].component !== 'Json' || endpoint.returns?.length !== 1 || endpoint.returns[0].component !== 'Json') throw new Error('The Space website_chat contract is unavailable. Check its deployment.');
      return { configured: true, provider: 'huggingface', model: MODEL_LABEL, message: 'Space endpoint ready. Ask a question to check model access.' };
    });
  }
  const api = Object.freeze({ space: SPACE, origin: ORIGIN, endpoint: ENDPOINT, analyzeWithAI, testConnection, buildContext, pairedHistory, parseEnvelope, readResult });
  root.MKSpace = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
