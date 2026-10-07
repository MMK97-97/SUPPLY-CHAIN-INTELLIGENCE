(function () {
  'use strict';
  const A = window.MKAI, S = window.StarkSystem;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let rendering = false, rerender = false, uploading = false;
  const $ = id => window.document?.getElementById(id);
  async function render() {
    if (!$('mk-scope')) return;
    if (rendering) { rerender = true; return; } rendering = true;
    try {
      const status = A.getStatus();
      $('mk-service-status').textContent = status.message + (status.model ? ' · ' + status.model : '');
      $('mk-service-status').dataset.mode = status.mode;
      $('mk-scope').value = status.scope;
      $('mk-enable-ai').checked = status.aiEnabled; $('mk-monitor').checked = status.monitor; $('mk-auto-ai').checked = status.autoAI;
      $('mk-analysis-depth').value = status.depth;
      $('mk-analysis-depth').disabled = !status.aiEnabled;
      $('mk-auto-ai').disabled = !status.aiEnabled;
      $('mk-sales-link').href = S.url('sales-analysis.html?region=' + (status.scope === 'ALL' ? S.getRegion() : status.scope));
      const source = await A.snapshot(status.scope);
      if (!$('mk-report-sources')) return;
      $('mk-report-sources').innerHTML = (source.reports.length || source.sales.length) ? [...source.reports, ...source.sales].map(r => `<article class="mk-source"><b>${esc(r.region)} · ${esc(r.fileName)}</b><small>${r.summary.rowCount ?? r.summary.models} models · ${r.summary.reorderItems ?? 'Sales'} ${r.summary.reorderItems !== undefined ? 'reorder items' : 'analysis'}</small><small>${r.importedAt ? 'Imported ' + esc(r.importedAt.slice(0,16).replace('T',' ')) + ' UTC' : 'Import date not recorded'}</small><a href="${esc(S.url(r.evidence_id.includes(':sales:') ? 'sales-analysis.html?region=' + r.region : 'raw-report-' + r.region.toLowerCase() + '.html'))}">Open source report</a></article>`).join('') : '<p>No inventory report in this scope. Upload one to start.</p>';
      const alerts = A.getAlerts().filter(a => status.scope === 'ALL' || a.region === status.scope).slice(0, 12);
      $('mk-alerts').innerHTML = alerts.length ? alerts.map(a => `<article class="mk-alert ${a.read ? 'is-read' : ''}" data-severity="${esc(a.severity)}"><b>${esc(a.region)} · ${esc(a.title)}</b><p>${esc(a.explanation)}</p><small>${esc(a.fileName)} · ${esc(a.at.slice(0,16).replace('T',' '))} UTC</small><button type="button" data-investigate="${esc(a.id)}">Investigate</button></article>`).join('') : '<p>No new report findings.</p>';
      $('mk-alerts').querySelectorAll('[data-investigate]').forEach(button => button.addEventListener('click', () => {
        const alert = A.getAlerts().find(a => a.id === button.dataset.investigate);
        A.configure({ scope: alert.region }); A.acknowledge(alert.id);
        window.MKBrain.ask(`Investigate ${alert.title} in ${alert.region}. Explain the report evidence and next actions.`);
      }));
      const briefing = A.getBriefing(); $('mk-auto-briefing').innerHTML = '';
      if (briefing) { const details = document.createElement('details'); details.innerHTML = '<summary>Latest automatic briefing</summary><p></p>'; details.querySelector('p').textContent = briefing.answer; A.renderResult(details, briefing); $('mk-auto-briefing').append(details); }
    } catch (error) { if ($('mk-report-sources')) $('mk-report-sources').textContent = error.message; }
    finally { rendering = false; if (rerender && $('mk-scope')) { rerender = false; render(); } }
  }
  async function upload() {
    if (uploading) return;
    const file = $('mk-report-file').files?.[0], region = $('mk-scope').value;
    if (!file) { $('mk-upload-status').textContent = 'Choose a report file first.'; return; }
    if (region === 'ALL') { $('mk-upload-status').textContent = 'Select US, EU or Canada for this report, then upload it.'; return; }
    if (!/\.(csv|tsv|xlsx)$/i.test(file.name) || file.size > 20 * 1024 * 1024) { $('mk-upload-status').textContent = 'Choose a CSV, TSV or XLSX report up to 20 MB.'; return; }
    uploading = true; $('mk-upload').disabled = true; $('mk-report-file').disabled = true; $('mk-scope').disabled = true;
    $('mk-upload-status').textContent = 'Reading and checking the report…';
    try {
      const key = region === 'CA' ? 'Canada' : region, reader = window.StarkRegionalAnalysts[key];
      const rows = await reader.readReportFile(file, key);
      const headers = [...new Set(rows.flatMap(row => Object.keys(row)))].map(reader.normalizeHeader);
      if (!headers.some(header => /^(model#?|model number|sku|itemid|item id)$/.test(header))) throw new Error('The report needs a Model#, Model, SKU or ItemID column.');
      const normalized = reader.normalizeItemRows(rows, key);
      if (!normalized.length || normalized.length > 100000 || !normalized.some(row => row.model || row.itemid)) throw new Error('No valid inventory models were found. Use the Raw Report column layout.');
      // Finish parsing and validation before replacing the selected region's current report.
      await reader.saveDataset(key, { fileName: file.name, importedAt: new Date().toISOString(), rows: normalized });
      reader.ensureBrandSettings(key, normalized);
      A.configure({ scope: region });
      $('mk-upload-status').textContent = `${normalized.length} models saved to ${region}. Generating report findings…`;
      await A.monitor(); await window.MKBrain.ask('Analyze my current data and recommend the next actions.');
      $('mk-upload-status').textContent = `${file.name} · ${normalized.length} models analyzed in ${region}.`;
      $('mk-report-file').value = '';
    } catch (error) { $('mk-upload-status').textContent = 'Upload could not finish: ' + error.message; }
    finally { uploading = false; $('mk-upload').disabled = false; $('mk-report-file').disabled = false; $('mk-scope').disabled = false; render(); }
  }
  function download() {
    const records = A.getMessages(), lines = ['# MK Supply Chain Analysis', '', 'Exported ' + new Date().toISOString(), ''];
    for (const record of records) {
      lines.push(`## ${record.role === 'user' ? 'Question' : 'MK analysis'} · ${record.scope}`, '', record.role === 'user' ? record.content : record.result.answer, '');
      if (record.result) { const r = record.result; lines.push(`Mode: ${r.mode}${r.model ? ' · ' + r.model : ''}`, ''); for (const f of r.findings || []) lines.push('- ' + f.title + ': ' + f.explanation + ' [' + f.evidence_ids.join(', ') + ']'); for (const a of r.actions || []) lines.push('- Action (' + a.priority + '): ' + a.title + ' — ' + a.reason); if (r.assumptions?.length) lines.push('', 'Assumptions: ' + r.assumptions.join('; ')); if (r.evidence?.length) lines.push('', 'Evidence:', ...r.evidence.map(e => '- ' + e.id + ': ' + e.label)); lines.push(''); }
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'MK-analysis-' + new Date().toISOString().slice(0,10) + '.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function init() {
    if (!$('mk-scope')) return;
    $('mk-scope').addEventListener('change', event => A.configure({ scope: event.target.value }));
    $('mk-enable-ai').addEventListener('change', event => A.configure({ aiEnabled: event.target.checked }));
    $('mk-analysis-depth').addEventListener('change', event => A.configure({ depth: event.target.value }));
    $('mk-monitor').addEventListener('change', event => A.configure({ monitor: event.target.checked }));
    $('mk-auto-ai').addEventListener('change', event => A.configure({ autoAI: event.target.checked }));
    $('mk-read-alerts').addEventListener('click', () => A.acknowledge('all'));
    $('mk-monitor-now').addEventListener('click', async () => { try { await A.monitor(true); $('mk-upload-status').textContent = 'Report monitoring complete.'; } catch (error) { $('mk-upload-status').textContent = error.message; } });
    $('mk-new-chat').addEventListener('click', () => { window.MKBrain.stop(); A.clearConversation(); });
    $('mk-export-chat').addEventListener('click', download); $('mk-upload').addEventListener('click', upload);
    $('mk-test-connection').addEventListener('click', async () => { const button = $('mk-test-connection'); button.disabled = true; try { const result = await A.testConnection(); $('mk-connection-status').textContent = result.message; } catch (error) { $('mk-connection-status').textContent = error.message; } finally { button.disabled = false; } });
    window.addEventListener('mk:analyst-change', render);
    render();
  }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
