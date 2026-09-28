(function (global) {
  "use strict";

  const SI = global.StarkInventory;
  if (!SI || SI.__reorderHistoryEnabled) return;
  SI.__reorderHistoryEnabled = true;

  const DB_NAME = "stark-reorder-history-v1";
  const STORE_NAME = "reports";
  const DB_VERSION = 1;
  const HISTORY_LIMIT = 30;
  const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const originalSaveDataset = SI.saveDataset.bind(SI);
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) return reject(new Error("Report history requires browser storage (IndexedDB)."));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("region", "region", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Saved report storage could not be opened."));
    });
  }

  async function dbRequest(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Saved report storage failed."));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Saved report storage failed.")); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Saved report storage was cancelled.")); };
    });
  }

  function regionCode(region) { return SI.regionCode(region); }
  function reportHeaders(region) {
    return region === "EU"
      ? ["Model#", "Brand", "Item Title", "Status", "Avg Sales/Month (3M)", "Open Orders From Client", "On Hand", "ATS", "Actual Available", "Upcoming Availability", "Open Supplier Qty in Window", "Total Open Supplier Qty", "Supplier Delivery Window", "Days Until Supplier Delivery", "Recommended Reorder Qty", "Reorder Status", "PO#"]
      : ["Model#", "Brand", "Item Title", "Status", "Open Orders From Client", "On Hand", "Stock Available", "Open Supplier Qty", "Supplier Delivery Window", "Days Until Supplier Delivery", "Recommended Reorder Qty", "Reorder Status"];
  }

  function reportRows(region, items) {
    return items.map(item => region === "EU"
      ? [item.model, item.brand, item.product, item.status, item.avg3, item.openClient, item.stockQty, item.ats, item.actualAvailable, item.upcomingAvailability, item.planningSupplierQty, item.openSupplier, item.supplierWindow, item.daysUntil == null ? "" : item.daysUntil, item.recommended, "REORDER", item.supplierPOs]
      : [item.model, item.brand, item.product, item.status, item.openClient, item.stockQty, item.available, item.openSupplier, item.supplierWindow, item.daysUntil == null ? "" : item.daysUntil, item.recommended, "REORDER"]);
  }

  function formulaText(region) {
    const settings = SI.loadSettings(region);
    return `Recommended quantity = (Avg/Month × (Lead Time from Active Brands + ${settings.coverage} coverage month${settings.coverage === 1 ? "" : "s"})) + ${settings.critical} critical/minimum carrying units + Open Orders From Client − On Hand − eligible Open Supplier Qty arriving within ${settings.delay} days. Results at or below zero are set to zero and positive quantities are rounded up.`;
  }

  function reportSnapshot(region, reorderItems) {
    return {
      title: `Reorder Report - ${SI.regionName(region)} - Active Brands / Status: LIVE, FASHION, BACKORDER / Reorder Required Only`,
      formula: formulaText(region),
      headers: reportHeaders(region),
      rows: reportRows(region, reorderItems)
    };
  }

  function xml(value) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[character]));
  }

  function columnName(index) {
    let value = index + 1, result = "";
    while (value) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
    return result;
  }

  function cellXml(value, column, row, style) {
    const reference = `${columnName(column)}${row}`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
    return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }

  async function createWorkbook(snapshot, createdAt) {
    const { title, formula, headers, rows } = snapshot;
    const values = [[title], [formula], headers, ...rows];
    if (global.XLSX) {
      const workbook = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet(values), lastColumn = XLSX.utils.encode_col(headers.length - 1);
      sheet["!cols"] = headers.map((header, index) => ({ wch: index === 2 ? 48 : Math.max(12, Math.min(28, String(header).length + 3)) }));
      sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }];
      sheet["!autofilter"] = { ref: `A3:${lastColumn}${Math.max(3, values.length)}` };
      XLSX.utils.book_append_sheet(workbook, sheet, "REORDER REPORT");
      return XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
    }
    if (!global.JSZip) throw new Error("The Excel archive component is unavailable. Refresh the page and try again.");
    const sheetRows = values.map((row, rowIndex) => {
      const excelRow = rowIndex + 1;
      const style = rowIndex === 0 ? 1 : rowIndex === 1 ? 3 : rowIndex === 2 ? 2 : 3;
      return `<row r="${excelRow}">${row.map((value, column) => cellXml(value, column, excelRow, style)).join("")}</row>`;
    }).join("");
    const lastColumn = columnName(headers.length - 1), lastRow = Math.max(3, values.length);
    const widths = headers.map((header, index) => `<col min="${index + 1}" max="${index + 1}" width="${index === 2 ? 48 : Math.max(12, Math.min(28, header.length + 3))}" customWidth="1"/>`).join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths}</cols><sheetData>${sheetRows}</sheetData><mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells><autoFilter ref="A3:${lastColumn}${lastRow}"/></worksheet>`;
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>Stark Supply Chain Intelligence</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xml(createdAt)}</dcterms:created></cp:coreProperties>`);
    zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Stark Supply Chain Intelligence</Application></Properties>`);
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="REORDER REPORT" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Aptos Display"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174F79"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFC9D8E5"/></left><right style="thin"><color rgb="FFC9D8E5"/></right><top style="thin"><color rgb="FFC9D8E5"/></top><bottom style="thin"><color rgb="FFC9D8E5"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    zip.file("xl/worksheets/sheet1.xml", sheet);
    return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  async function listReports(region) {
    const records = await dbRequest("readonly", store => store.getAll());
    return records.filter(record => record.region === regionCode(region)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function trimReports(region) {
    const records = await listReports(region);
    await Promise.all(records.slice(HISTORY_LIMIT).map(record => dbRequest("readwrite", store => store.delete(record.id))));
  }

  async function deleteReport(id) {
    await dbRequest("readwrite", store => store.delete(id));
  }

  async function archiveDataset(region, dataset) {
    if (!dataset || !Array.isArray(dataset.rows) || !dataset.rows.length) return null;
    const createdAt = new Date().toISOString();
    const items = SI.analyze(dataset.rows, region).filter(item => item.reorderRequired).sort((a, b) => b.recommended - a.recommended || a.rawRow - b.rawRow);
    const snapshot = reportSnapshot(region, items);
    const workbook = await createWorkbook(snapshot, createdAt);
    const stamp = createdAt.replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const record = {
      id: `${regionCode(region)}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      region: regionCode(region),
      createdAt,
      sourceFile: dataset.fileName || "Previous Raw Report",
      sourceImportedAt: dataset.importedAt || "",
      rawItems: dataset.rows.length,
      reorderItems: items.length,
      recommendedUnits: items.reduce((total, item) => total + (Number(item.recommended) || 0), 0),
      fileName: `Reorder Report ${regionCode(region)} ${stamp}.xlsx`,
      snapshot,
      workbook
    };
    await dbRequest("readwrite", store => store.put(record));
    await trimReports(region);
    return record;
  }

  SI.saveDataset = async function saveDatasetWithHistory(region, nextDataset) {
    const existing = await SI.loadDataset(region);
    if (existing && Array.isArray(existing.rows) && existing.rows.length) {
      try { await archiveDataset(region, existing); }
      catch (error) { throw new Error(`The previous Reorder Report could not be archived, so the new upload was not applied. ${error.message}`); }
    }
    return originalSaveDataset(region, nextDataset);
  };

  async function snapshotFromWorkbook(record) {
    if (!record?.workbook || !global.XLSX) return null;
    const bytes = record.workbook instanceof Blob ? await record.workbook.arrayBuffer() : record.workbook;
    const workbook = XLSX.read(bytes, { type: "array" }), sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return null;
    const values = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    if (values.length < 3 || !Array.isArray(values[2]) || !values[2].length) return null;
    return {
      title: values[0]?.[0] || `Reorder Report - ${record.region}`,
      formula: values[1]?.[0] || "",
      headers: values[2],
      rows: values.slice(3).filter(row => Array.isArray(row) && row.some(value => value !== "" && value != null))
    };
  }

  async function downloadReport(record) {
    if (!record?.workbook && !record?.snapshot) return;
    let workbook = record.workbook;
    try {
      const snapshot = record.snapshot || await snapshotFromWorkbook(record);
      if (snapshot?.headers?.length) workbook = await createWorkbook(snapshot, record.createdAt || new Date().toISOString());
    } catch (error) { if (!workbook) throw error; }
    if (!workbook) throw new Error("This saved report does not contain a workbook.");
    const blob = workbook instanceof Blob ? workbook : new Blob([workbook], { type: XLSX_TYPE });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = record.fileName || `Reorder Report ${record.region}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1200);
  }

  function dateLabel(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Saved report";
  }

  async function renderHistoryPanel() {
    if (document.body.dataset.page !== "reorder") return;
    const main = document.querySelector(".inventory-main"), heading = document.querySelector(".inventory-page-heading");
    if (!main || !heading || document.getElementById("reorder-history-panel")) return;
    const panel = document.createElement("section");
    panel.className = "inventory-panel reorder-history-panel";
    panel.id = "reorder-history-panel";
    panel.innerHTML = `<div class="reorder-history-heading"><div class="reorder-history-title"><span class="reorder-history-title-icon" aria-hidden="true">▣</span><div><h2>Saved Reorder Reports</h2><p>Access previously generated reorder reports. Reports are saved automatically when a new Raw Report is uploaded.</p></div></div><button class="button button-secondary reorder-history-toggle" id="toggle-reorder-history" type="button" aria-expanded="false">View all (0) <span aria-hidden="true">›</span></button></div><div class="reorder-history-content" id="reorder-history-content"><div class="reorder-history-grid" id="reorder-history-rows"></div></div>`;
    heading.insertAdjacentElement("afterend", panel);
    const toggle = panel.querySelector("#toggle-reorder-history");
    let showAll = false;
    const refresh = async () => {
      try {
        const records = await listReports(SI.getRegion());
        if (records.length <= 3) showAll = false;
        toggle.setAttribute("aria-expanded", String(showAll));
        toggle.innerHTML = `${showAll ? "Show latest" : "View all"} (${records.length}) <span aria-hidden="true">${showAll ? "‹" : "›"}</span>`;
        const visibleRecords = showAll ? records : records.slice(0, 3);
        panel.querySelector("#reorder-history-rows").innerHTML = records.length
          ? visibleRecords.map(record => `<article class="reorder-history-card"><span class="reorder-history-file-icon" aria-hidden="true">X</span><div class="reorder-history-file-copy"><strong title="${SI.escapeHtml(record.fileName)}">${SI.escapeHtml(record.fileName)}</strong><small>${SI.escapeHtml(dateLabel(record.createdAt))} · ${number.format(record.reorderItems || 0)} items · ${number.format(record.recommendedUnits || 0)} units</small></div><div class="reorder-history-actions"><button class="reorder-history-icon-button reorder-history-download" type="button" data-history-download="${SI.escapeHtml(record.id)}" aria-label="Download ${SI.escapeHtml(record.fileName)}" title="Download Excel"><span aria-hidden="true">↓</span></button><button class="reorder-history-icon-button reorder-history-delete" type="button" data-history-delete="${SI.escapeHtml(record.id)}" aria-label="Delete ${SI.escapeHtml(record.fileName)}" title="Delete saved report"><span aria-hidden="true">⌫</span></button></div></article>`).join("")
          : `<div class="reorder-history-empty"><strong>No saved reports yet</strong><p>The current Reorder Report will be saved automatically the next time a new Raw Report is uploaded.</p></div>`;
        panel.querySelectorAll("[data-history-download]").forEach(button => button.addEventListener("click", async () => {
          const record = records.find(item => item.id === button.dataset.historyDownload);
          button.disabled = true;
          try { await downloadReport(record); }
          catch (error) { alert(`Saved Reorder Report: ${error.message}`); }
          finally { button.disabled = false; }
        }));
        panel.querySelectorAll("[data-history-delete]").forEach(button => button.addEventListener("click", async () => {
          const record = records.find(item => item.id === button.dataset.historyDelete);
          if (!record || !confirm(`Delete the saved Reorder Report from ${dateLabel(record.createdAt)}? This cannot be undone.`)) return;
          button.disabled = true;
          try { await deleteReport(record.id); await refresh(); }
          catch (error) { button.disabled = false; alert(`Saved Reorder Report: ${error.message}`); }
        }));
      } catch (error) {
        toggle.innerHTML = `Archive unavailable <span aria-hidden="true">!</span>`;
        panel.querySelector("#reorder-history-rows").innerHTML = `<div class="reorder-history-empty"><strong>Saved reports are unavailable</strong><p>${SI.escapeHtml(error.message)}</p></div>`;
      }
    };
    toggle.addEventListener("click", async () => { showAll = !showAll; await refresh(); });
    await refresh();
  }

  global.StarkReorderHistory = { archiveDataset, listReports, downloadReport, deleteReport, limit: HISTORY_LIMIT };
  document.addEventListener("DOMContentLoaded", renderHistoryPanel);
})(window);
