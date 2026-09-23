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

  function xml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[character]));
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

  async function createWorkbook(region, dataset, reorderItems, createdAt) {
    if (!global.JSZip) throw new Error("The Excel archive component is unavailable. Refresh the page and try again.");
    const headers = reportHeaders(region), rows = reportRows(region, reorderItems);
    const title = `Reorder Report - ${SI.regionName(region)} - Active Brands / Status: LIVE, FASHION, BACKORDER / Reorder Required Only`;
    const values = [[title], [formulaText(region)], headers, ...rows];
    const sheetRows = values.map((row, rowIndex) => {
      const excelRow = rowIndex + 1;
      const style = rowIndex === 0 ? 1 : rowIndex === 1 ? 3 : rowIndex === 2 ? 2 : 3;
      return `<row r="${excelRow}">${row.map((value, column) => cellXml(value, column, excelRow, style)).join("")}</row>`;
    }).join("");
    const lastColumn = columnName(headers.length - 1), lastRow = Math.max(3, values.length);
    const widths = headers.map((header, index) => `<col min="${index + 1}" max="${index + 1}" width="${index === 2 ? 48 : Math.max(12, Math.min(28, header.length + 3))}" customWidth="1"/>`).join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows}</sheetData><mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells><autoFilter ref="A3:${lastColumn}${lastRow}"/></worksheet>`;
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>Stark Supply Chain Intelligence</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xml(createdAt)}</dcterms:created></cp:coreProperties>`);
    zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Stark Supply Chain Intelligence</Application></Properties>`);
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="REORDER REPORT" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Aptos Display"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174F79"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFC9D8E5"/></left><right style="thin"><color rgb="FFC9D8E5"/></right><top style="thin"><color rgb="FFC9D8E5"/></top><bottom style="thin"><color rgb="FFC9D8E5"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    zip.file("xl/worksheets/sheet1.xml", sheet);
    return zip.generateAsync({ type: "blob", mimeType: XLSX_TYPE, compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  async function listReports(region) {
    const records = await dbRequest("readonly", store => store.getAll());
    return records.filter(record => record.region === regionCode(region)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function trimReports(region) {
    const records = await listReports(region);
    await Promise.all(records.slice(HISTORY_LIMIT).map(record => dbRequest("readwrite", store => store.delete(record.id))));
  }

  async function archiveDataset(region, dataset) {
    if (!dataset || !Array.isArray(dataset.rows) || !dataset.rows.length) return null;
    const createdAt = new Date().toISOString();
    const items = SI.analyze(dataset.rows, region).filter(item => item.reorderRequired).sort((a, b) => b.recommended - a.recommended || a.rawRow - b.rawRow);
    const blob = await createWorkbook(region, dataset, items, createdAt);
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
      workbook: blob
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

  function downloadReport(record) {
    if (!record?.workbook) return;
    const blob = record.workbook instanceof Blob ? record.workbook : new Blob([record.workbook], { type: XLSX_TYPE });
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
    panel.innerHTML = `<div class="reorder-history-heading"><div><p class="eyebrow">Browser-local archive</p><h2>Saved Reorder Reports</h2><span id="reorder-history-summary">Loading saved reports…</span></div><button class="button button-secondary" id="toggle-reorder-history" type="button" aria-expanded="false">View archive</button></div><div class="reorder-history-content" id="reorder-history-content" hidden><p class="reorder-history-note">The previous Reorder Report is saved automatically before a new Raw Report replaces it. The latest 30 reports for this market remain available in this browser.</p><div class="inventory-table-wrap"><table class="reorder-history-table"><thead><tr><th>Saved</th><th>Source Raw Report</th><th class="num">Reorder Items</th><th class="num">Recommended Units</th><th>Download</th></tr></thead><tbody id="reorder-history-rows"></tbody></table></div></div>`;
    heading.insertAdjacentElement("afterend", panel);
    const toggle = panel.querySelector("#toggle-reorder-history"), content = panel.querySelector("#reorder-history-content");
    toggle.addEventListener("click", () => { const open = content.hasAttribute("hidden"); content.toggleAttribute("hidden", !open); toggle.setAttribute("aria-expanded", String(open)); toggle.textContent = open ? "Close archive" : "View archive"; });
    try {
      const records = await listReports(SI.getRegion());
      panel.querySelector("#reorder-history-summary").textContent = records.length ? `${records.length} of 30 saved reports available` : "No archived reports yet";
      panel.querySelector("#reorder-history-rows").innerHTML = records.length
        ? records.map(record => `<tr><td><strong>${SI.escapeHtml(dateLabel(record.createdAt))}</strong><small>${SI.escapeHtml(record.fileName)}</small></td><td>${SI.escapeHtml(record.sourceFile)}</td><td class="num">${number.format(record.reorderItems || 0)}</td><td class="num">${number.format(record.recommendedUnits || 0)}</td><td><button class="button button-primary reorder-history-download" type="button" data-history-id="${SI.escapeHtml(record.id)}">Download Excel</button></td></tr>`).join("")
        : `<tr><td colspan="5"><div class="empty-state"><p>No archived reports yet. The current report will be saved automatically the next time a new Raw Report is uploaded.</p></div></td></tr>`;
      panel.querySelectorAll("[data-history-id]").forEach(button => button.addEventListener("click", () => downloadReport(records.find(record => record.id === button.dataset.historyId))));
    } catch (error) {
      panel.querySelector("#reorder-history-summary").textContent = "Saved reports are unavailable";
      panel.querySelector("#reorder-history-rows").innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>${SI.escapeHtml(error.message)}</p></div></td></tr>`;
    }
  }

  global.StarkReorderHistory = { archiveDataset, listReports, downloadReport, limit: HISTORY_LIMIT };
  document.addEventListener("DOMContentLoaded", renderHistoryPanel);
})(window);
