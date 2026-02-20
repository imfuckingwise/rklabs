const DB_NAME = "AiKOLTrackerDB";
const DB_VERSION = 2;
const RECORD_STORE_NAME = "records";
const CONTENT_STORE_NAME = "contentItems";
const PDF_CHINESE_FONT_URL =
  "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansTC/NotoSansTC-Regular.ttf";

const state = {
  records: [],
  contentItems: [],
  range: loadRangeState(),
  showNoteLines: loadNoteLineSetting(),
  sortOrder: loadSortOrder(),
  roleId: loadRoleId(),
  lastEditedAt: loadLastEditedAt(),
  lastSavedAt: loadLastSavedAt(),
  recordSearch: loadRecordSearch(),
  contentSearch: loadContentSearch(),
  editingId: null,
  contentEditingId: null,
  contentViewingId: null,
};

const els = {
  pageTitle: document.getElementById("pageTitle"),
  appPages: document.querySelectorAll(".app-page"),
  navButtons: document.querySelectorAll(".nav-btn"),
  routeTriggers: document.querySelectorAll("[data-route]"),
  recordForm: document.getElementById("recordForm"),
  datetimeInput: document.getElementById("datetimeInput"),
  threadsInput: document.getElementById("threadsInput"),
  lineInput: document.getElementById("lineInput"),
  noteInput: document.getElementById("noteInput"),
  formTitle: document.getElementById("formTitle"),
  saveRecordBtn: document.getElementById("saveRecordBtn"),
  resetFormBtn: document.getElementById("resetFormBtn"),
  rangeSelect: document.getElementById("rangeSelect"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  applyRangeBtn: document.getElementById("applyRangeBtn"),
  latestConversion: document.getElementById("latestConversion"),
  avgConversion: document.getElementById("avgConversion"),
  threadsGrowth: document.getElementById("threadsGrowth"),
  lineGrowth: document.getElementById("lineGrowth"),
  trendCanvas: document.getElementById("trendCanvas"),
  showNoteLines: document.getElementById("showNoteLines"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  resetZoomBtn: document.getElementById("resetZoomBtn"),
  sortOrderSelect: document.getElementById("sortOrderSelect"),
  roleIdInput: document.getElementById("roleIdInput"),
  lastEditedAt: document.getElementById("lastEditedAt"),
  recordSearchInput: document.getElementById("recordSearchInput"),
  clearAllRecordsBtn: document.getElementById("clearAllRecordsBtn"),
  recordTableBody: document.getElementById("recordTableBody"),
  rowTemplate: document.getElementById("rowTemplate"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  clearCacheBtn: document.getElementById("clearCacheBtn"),
  storageStatus: document.getElementById("storageStatus"),
  contentForm: document.getElementById("contentForm"),
  contentFormTitle: document.getElementById("contentFormTitle"),
  contentTitleInput: document.getElementById("contentTitleInput"),
  contentTypeInput: document.getElementById("contentTypeInput"),
  contentTagsInput: document.getElementById("contentTagsInput"),
  contentRefInput: document.getElementById("contentRefInput"),
  contentBodyInput: document.getElementById("contentBodyInput"),
  saveContentBtn: document.getElementById("saveContentBtn"),
  resetContentBtn: document.getElementById("resetContentBtn"),
  contentTableBody: document.getElementById("contentTableBody"),
  contentRowTemplate: document.getElementById("contentRowTemplate"),
  contentViewerTitle: document.getElementById("contentViewerTitle"),
  contentViewerMeta: document.getElementById("contentViewerMeta"),
  contentViewerTags: document.getElementById("contentViewerTags"),
  contentViewerRefLink: document.getElementById("contentViewerRefLink"),
  contentViewerRefEmpty: document.getElementById("contentViewerRefEmpty"),
  contentViewerBody: document.getElementById("contentViewerBody"),
  contentSearchInput: document.getElementById("contentSearchInput"),
  clearAllContentBtn: document.getElementById("clearAllContentBtn"),
};

let db;
let trendChart;
let pdfChineseFontBase64 = "";

init();

async function init() {
  registerChartZoomPlugin();
  registerServiceWorker();
  setDefaultDateTime();
  wireEvents();
  syncRouteFromHash();
  applyRangeStateToUi();
  applyNoteLineStateToUi();
  applySortOrderStateToUi();
  applyRoleIdStateToUi();
  applySearchStateToUi();

  db = await openDb();
  state.records = ensureRecordDefaults(await getAllRecords());
  state.contentItems = await getAllContentItems();
  if (!state.lastEditedAt) {
    state.lastEditedAt = computeLastEditedAtFromData(state.records, state.contentItems);
  }
  render();
  setStorageStatus("");
}

function wireEvents() {
  window.addEventListener("hashchange", syncRouteFromHash);
  els.routeTriggers.forEach((node) => {
    node.addEventListener("click", () => {
      const route = node.dataset.route || "home";
      goToPage(route);
    });
  });

  els.recordForm.addEventListener("submit", onSaveRecord);
  els.resetFormBtn.addEventListener("click", resetFormMode);
  els.contentForm.addEventListener("submit", onSaveContentItem);
  els.resetContentBtn.addEventListener("click", resetContentFormMode);

  els.rangeSelect.addEventListener("change", () => {
    const custom = els.rangeSelect.value === "custom";
    els.startDate.disabled = !custom;
    els.endDate.disabled = !custom;
  });

  els.applyRangeBtn.addEventListener("click", () => {
    state.range = {
      type: els.rangeSelect.value,
      start: els.startDate.value,
      end: els.endDate.value,
    };
    persistRangeState(state.range);
    render();
  });

  els.recordTableBody.addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const action = target.dataset.action;
    if (action === "edit") {
      const id = Number(target.dataset.id);
      startEdit(id);
      return;
    }
    if (action === "delete") {
      const id = Number(target.dataset.id);
      await deleteRecord(id);
      state.records = ensureRecordDefaults(await getAllRecords());
      if (state.editingId === id) resetFormMode();
      markDataEdited();
      render();
    }
  });

  els.recordTableBody.addEventListener("change", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.action !== "toggle-note-line") return;
    const id = Number(target.dataset.id);
    const record = state.records.find((r) => r.id === id);
    if (!record) return;
    const updated = {
      ...record,
      noteLineEnabled: target.checked,
      updatedAt: new Date().toISOString(),
    };
    await putRecord(updated);
    state.records = ensureRecordDefaults(await getAllRecords());
    markDataEdited();
    render();
  });

  els.contentTableBody.addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = Number(target.dataset.id);
    if (!Number.isFinite(id)) return;
    const action = target.dataset.action;
    if (action === "edit-content") {
      startEditContent(id);
      return;
    }
    if (action === "view-content") {
      state.contentViewingId = id;
      render();
      return;
    }
    if (action === "delete-content") {
      await deleteContentItem(id);
      state.contentItems = await getAllContentItems();
      if (state.contentEditingId === id) resetContentFormMode();
      if (state.contentViewingId === id) state.contentViewingId = null;
      markDataEdited();
      render();
    }
  });

  els.contentTableBody.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("button")) return;
    const row = target.closest("tr[data-content-id]");
    if (!row) return;
    const id = Number(row.dataset.contentId);
    if (!Number.isFinite(id)) return;
    state.contentViewingId = id;
    render();
  });

  els.exportBtn.addEventListener("click", onExport);
  els.importInput.addEventListener("change", onImport);
  els.clearCacheBtn.addEventListener("click", onClearCache);
  els.showNoteLines.addEventListener("change", () => {
    state.showNoteLines = els.showNoteLines.checked;
    persistNoteLineSetting(state.showNoteLines);
    render();
  });
  els.exportPdfBtn.addEventListener("click", onExportPdfReport);
  els.sortOrderSelect.addEventListener("change", () => {
    state.sortOrder = els.sortOrderSelect.value;
    persistSortOrder(state.sortOrder);
    render();
  });
  els.roleIdInput.addEventListener("input", () => {
    state.roleId = sanitizeRoleId(els.roleIdInput.value);
    persistRoleId(state.roleId);
  });
  els.recordSearchInput.addEventListener("input", () => {
    state.recordSearch = els.recordSearchInput.value.trim();
    persistRecordSearch(state.recordSearch);
    render();
  });
  els.contentSearchInput.addEventListener("input", () => {
    state.contentSearch = els.contentSearchInput.value.trim();
    persistContentSearch(state.contentSearch);
    render();
  });
  els.clearAllRecordsBtn.addEventListener("click", async () => {
    const ok = confirmTwice(
      "將刪除所有增長儀表板紀錄，確定要繼續嗎？",
      "最後確認：確定刪除全部增長儀表板紀錄？"
    );
    if (!ok) return;
    await clearAllRecordsOnly();
    state.records = [];
    resetFormMode();
    markDataEdited();
    render();
  });
  els.clearAllContentBtn.addEventListener("click", async () => {
    const ok = confirmTwice("將刪除所有素材內容，確定要繼續嗎？", "最後確認：確定刪除全部素材？");
    if (!ok) return;
    await clearAllContentOnly();
    state.contentItems = [];
    state.contentViewingId = null;
    resetContentFormMode();
    markDataEdited();
    render();
  });
  els.resetZoomBtn.addEventListener("click", () => {
    if (trendChart && typeof trendChart.resetZoom === "function") {
      trendChart.resetZoom();
    }
  });
}

async function onSaveRecord(event) {
  event.preventDefault();
  const parsed = parseDateTimeLocalInput(els.datetimeInput.value);
  const threads = Math.floor(Number(els.threadsInput.value));
  const lineRaw = els.lineInput.value.trim();
  const line = lineRaw === "" ? null : Math.floor(Number(lineRaw));

  if (!parsed) {
    alert("請透過月曆時間選擇正確的日期與時間");
    return;
  }
  if (!Number.isFinite(threads) || threads < 0) {
    alert("Threads 人數需為 0 或正整數");
    return;
  }
  if (line !== null && (!Number.isFinite(line) || line < 0)) {
    alert("LINE 人數需為空值或正整數");
    return;
  }

  const existing = state.editingId ? state.records.find((r) => r.id === state.editingId) : null;
  const note = els.noteInput.value.trim();
  const noteLineEnabled = note ? (existing ? existing.noteLineEnabled !== false : true) : false;

  const record = {
    id: existing ? existing.id : Date.now() + Math.floor(Math.random() * 1000),
    timestamp: parsed.getTime(),
    datetime: formatDisplayDateTime(parsed),
    threads,
    line,
    note,
    noteLineEnabled,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await putRecord(record);
  state.records = ensureRecordDefaults(await getAllRecords());
  markDataEdited();
  render();
  resetFormMode();
}

function onExport() {
  const roleId = sanitizeRoleId(state.roleId);
  if (!roleId) {
    alert("請先填寫角色編號，才能存檔匯出。");
    els.roleIdInput.focus();
    return false;
  }

  const dashboardRecords = [...state.records]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({
      ts: formatTsWithSpace(new Date(r.timestamp)),
      threads: r.threads,
      line: Number.isFinite(r.line) ? r.line : null,
      note: (r.note || "").toString().slice(0, 24),
      note_line_enabled: !!r.note && r.noteLineEnabled !== false,
    }));

  const payload = {
    platform: {
      name: "AI Influencer Toolkit",
      version: 1,
      exported_at: new Date().toISOString(),
    },
    meta: {
      date: formatDateYYYYMMDD(new Date()),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei",
      note_rule: "notes shortened for charts",
      role_id: roleId,
    },
    modules: {
      dashboard: {
        records: dashboardRecords,
      },
      content_library: {
        items: state.contentItems.map((x) => ({
          title: x.title,
          type: x.type || "",
          tags: x.tags || "",
          ref: x.ref || "",
          body: x.body,
          created_at: x.createdAt || "",
          updated_at: x.updatedAt || "",
        })),
      },
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildJsonExportFilename(roleId, new Date());
  a.click();
  URL.revokeObjectURL(url);
  markDataSaved();
  return true;
}

async function onExportPdfReport() {
  const roleId = sanitizeRoleId(state.roleId);
  if (!roleId) {
    alert("請先填寫角色編號，才能匯出 PDF 報告。");
    els.roleIdInput.focus();
    return;
  }

  const JsPdf = window.jspdf?.jsPDF;
  if (!JsPdf) {
    alert("PDF 匯出元件未載入，請重新整理頁面後再試。");
    return;
  }

  const visible = filterByRange(state.records, state.range).sort((a, b) => a.timestamp - b.timestamp);
  if (!visible.length) {
    alert("目前區間沒有資料，無法產生 PDF 報告。");
    return;
  }

  const kpi = computeKpiForReport(visible);
  const rangeLabel = buildRangeLabel(visible);

  const doc = new JsPdf({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const fontReady = await ensurePdfChineseFont(doc);
  const fileName = buildPdfReportFilename(roleId, new Date());
  if (!fontReady) {
    const imagePages = await buildCanvasReportPages({
      roleId,
      rangeLabel,
      kpi,
      records: visible,
      chartDataUrl: getChartDataUrl(),
    });
    if (!imagePages.length) {
      alert("PDF 匯出失敗，請稍後再試。");
      return;
    }
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    imagePages.forEach((img, index) => {
      if (index > 0) doc.addPage();
      doc.addImage(img, "PNG", 0, 0, pageW, pageH);
    });
    doc.save(fileName);
    return;
  }
  doc.setFont("NotoSansTC", "normal");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = margin;

  doc.setFontSize(16);
  doc.text("跨平台增長 PDF 報告", margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.text(`角色編號：${roleId}`, margin, y);
  y += 5;
  doc.text(`產生時間：${formatDisplayWithSeconds(new Date())}`, margin, y);
  y += 5;
  doc.text(`統計區間：${rangeLabel}`, margin, y);
  y += 7;

  doc.setFontSize(11);
  doc.text("績效摘要", margin, y);
  y += 5;
  doc.text(`最新轉換率：${formatPercent(kpi.latestConversion)}`, margin, y);
  y += 5;
  doc.text(`區間平均轉換率：${formatPercent(kpi.avgConversion)}`, margin, y);
  y += 5;
  doc.text(`Threads 增長率：${formatSignedPercent(kpi.threadsGrowth)}`, margin, y);
  y += 5;
  doc.text(`LINE 增長率：${formatSignedPercent(kpi.lineGrowth)}`, margin, y);
  y += 7;

  const chartDataUrl = getChartDataUrl();
  if (chartDataUrl) {
    doc.text("趨勢圖", margin, y);
    y += 4;
    const chartW = pageW - margin * 2;
    const chartH = 86;
    doc.addImage(chartDataUrl, "PNG", margin, y, chartW, chartH);
    y += chartH + 7;
  }

  doc.text("紀錄", margin, y);
  y += 4;
  drawPdfRecordsTable(doc, {
    records: [...visible].reverse(),
    startY: y,
    margin,
    pageW,
    pageH,
  });

  doc.save(fileName);
}

async function onImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (hasUnsavedChanges()) {
    const shouldSaveFirst = window.confirm(
      "偵測到你有尚未存檔的變更。按「確定」會先匯出存檔，再載入新檔案。"
    );
    if (shouldSaveFirst) {
      const saved = onExport();
      if (!saved) {
        event.target.value = "";
        return;
      }
    } else {
      const continueWithoutSave = window.confirm("不先存檔就載入，未保存內容會遺失。確定繼續嗎？");
      if (!continueWithoutSave) {
        event.target.value = "";
        return;
      }
    }
  }

  const shouldOverwrite = window.confirm("載入存檔會先清空目前資料，再匯入新資料。是否繼續？");
  if (!shouldOverwrite) {
    event.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const hasAnyModuleData =
      Array.isArray(data?.modules?.dashboard?.records) ||
      Array.isArray(data?.records) ||
      Array.isArray(data?.modules?.content_library?.items);
    if (!hasAnyModuleData) {
      throw new Error("格式不正確，缺少可用的模組資料");
    }
    const dashboardRows = extractDashboardRowsFromPayload(data);
    const contentRows = extractContentRowsFromPayload(data);
    const valid = normalizeImportedRecords(dashboardRows);
    const validContent = normalizeImportedContentItems(contentRows || []);
    const importedRoleId = extractRoleIdFromPayload(data);
    if (importedRoleId) {
      state.roleId = importedRoleId;
      persistRoleId(importedRoleId);
      applyRoleIdStateToUi();
    }

    await clearAllData();
    for (const record of valid) {
      await putRecord(record);
    }
    for (const item of validContent) {
      await putContentItem(item);
    }

    state.records = ensureRecordDefaults(await getAllRecords());
    state.contentItems = await getAllContentItems();
    markDataEdited();
    render();
    alert(`已匯入：儀表板 ${valid.length} 筆、素材 ${validContent.length} 筆`);
  } catch (err) {
    alert(`匯入失敗: ${err.message}`);
  } finally {
    event.target.value = "";
  }
}

async function onClearCache() {
  const ok = confirmTwice(
    "將清除本機緩存與資料（包含紀錄、素材、篩選與離線快取），確定要繼續嗎？",
    "最後確認：確定清除全部緩存？此操作無法復原。"
  );
  if (!ok) return;

  try {
    await clearAllData();
    clearAppLocalStorage();
    await clearBrowserCaches();
    await unregisterAllServiceWorkers();
    alert("已清除緩存，頁面將重新整理。");
    window.location.reload();
  } catch (err) {
    const reason = err instanceof Error ? err.message : "未知錯誤";
    alert(`清除緩存失敗：${reason}`);
  }
}

function render() {
  const visible = filterByRange(state.records, state.range);
  renderKpi(visible);
  renderTable(filterRecordsByKeyword(visible, state.recordSearch));
  renderChart(visible);
  const filteredContentItems = filterContentByKeyword(state.contentItems, state.contentSearch);
  renderContentTable(filteredContentItems);
  renderContentViewer(filteredContentItems);
  renderSaveMeta();
}

function goToPage(route) {
  const normalized = normalizeRoute(route);
  const targetHash = `#${normalized}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
    return;
  }
  setActivePage(normalized);
}

function syncRouteFromHash() {
  const route = normalizeRoute(window.location.hash.replace("#", ""));
  setActivePage(route);
}

function normalizeRoute(route) {
  if (route === "dashboard") return "dashboard";
  if (route === "content") return "content";
  return "home";
}

function setActivePage(route) {
  els.appPages.forEach((section) => {
    section.classList.toggle("active", section.dataset.page === route);
  });

  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });

  if (route === "dashboard") {
    els.pageTitle.textContent = "跨平台增長儀表板";
    render();
    if (trendChart) trendChart.resize();
    return;
  }

  if (route === "content") {
    els.pageTitle.textContent = "內容素材庫";
    render();
    return;
  }

  els.pageTitle.textContent = "工具總覽";
}

function renderTable(records) {
  els.recordTableBody.innerHTML = "";
  const sorted = sortRecordsForTable(records, state.sortOrder);

  for (const record of sorted) {
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
    row.classList.add("record-row");
    row.dataset.recordId = String(record.id);
    const dtCell = row.querySelector('[data-col="dt"]');
    const threadsCell = row.querySelector('[data-col="threads"]');
    const lineCell = row.querySelector('[data-col="line"]');
    const conversionCell = row.querySelector('[data-col="conversion"]');
    const noteCell = row.querySelector('[data-col="note"]');
    dtCell.textContent = record.datetime;
    threadsCell.textContent = String(record.threads);
    lineCell.textContent = Number.isFinite(record.line) ? String(record.line) : "-";
    conversionCell.textContent = formatPercent(safeRatio(record.line, record.threads));
    noteCell.textContent = record.note || "-";
    dtCell.dataset.label = "時間";
    threadsCell.dataset.label = "Threads";
    lineCell.dataset.label = "LINE";
    conversionCell.dataset.label = "轉換率";
    noteCell.dataset.label = "備註";
    const noteLineCell = row.querySelector('[data-col="noteLine"]');
    noteLineCell.dataset.label = "事件線";
    if ((record.note || "").trim().length > 0) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = record.noteLineEnabled !== false;
      checkbox.dataset.action = "toggle-note-line";
      checkbox.dataset.id = String(record.id);
      checkbox.className = "note-line-check";
      noteLineCell.appendChild(checkbox);
    } else {
      noteLineCell.textContent = "-";
    }
    const actionCell = row.querySelector(".row-actions");
    actionCell.dataset.label = "操作";
    row.querySelector('[data-action="edit"]').dataset.id = String(record.id);
    row.querySelector('[data-action="delete"]').dataset.id = String(record.id);
    els.recordTableBody.appendChild(row);
  }

  if (sorted.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="7">目前區間沒有資料</td>';
    els.recordTableBody.appendChild(tr);
  }
}

function renderKpi(records) {
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const conversions = sorted
    .map((r) => safeRatio(r.line, r.threads))
    .filter((v) => Number.isFinite(v));
  const latestConvertible = [...sorted].reverse().find((r) => Number.isFinite(safeRatio(r.line, r.threads)));

  const avgConversion = conversions.length
    ? conversions.reduce((sum, val) => sum + val, 0) / conversions.length
    : NaN;
  const latestConversion = latestConvertible ? safeRatio(latestConvertible.line, latestConvertible.threads) : NaN;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstLine = sorted.find((r) => Number.isFinite(r.line));
  const lastLine = [...sorted].reverse().find((r) => Number.isFinite(r.line));

  const threadsGrowth = first && last ? computeGrowthRateWithFloor(first.threads, last.threads, 1) : NaN;
  const lineGrowth = firstLine && lastLine ? computeGrowthRate(firstLine.line, lastLine.line) : NaN;

  els.latestConversion.textContent = formatPercent(latestConversion);
  els.avgConversion.textContent = formatPercent(avgConversion);
  els.threadsGrowth.textContent = formatSignedPercent(threadsGrowth);
  els.lineGrowth.textContent = formatSignedPercent(lineGrowth);
}

function renderChart(records) {
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);

  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }

  if (sorted.length === 0) {
    const ctx = els.trendCanvas.getContext("2d");
    ctx.clearRect(0, 0, els.trendCanvas.width, els.trendCanvas.height);
    ctx.fillStyle = "#90a0c5";
    ctx.font = "15px Manrope, sans-serif";
    ctx.fillText("目前區間沒有資料", 24, 40);
    return;
  }

  const labels = sorted.map((r) => formatChartTime(r.timestamp));
  const recordIds = sorted.map((r) => r.id);
  const threadsData = sorted.map((r) => r.threads);
  const lineData = sorted.map((r) => r.line);

  const eventMarkers = state.showNoteLines ? buildNoteMarkers(sorted) : [];
  let hoveredMarkerIndex = -1;
  const markerPlugin = {
    id: "eventMarkers",
    afterEvent(chart, args) {
      const { chartArea, scales } = chart;
      if (!chartArea || !eventMarkers.length) {
        chart.$hoverEventMarker = false;
        return;
      }

      const event = args.event;
      if (!event) return;

      if (event.type === "mouseout") {
        if (hoveredMarkerIndex !== -1) {
          hoveredMarkerIndex = -1;
          chart.$hoverEventMarker = false;
          chart.draw();
        }
        return;
      }

      if (event.type !== "mousemove") return;
      const xScale = scales.x;
      const mx = event.x;
      const my = event.y;
      const inVerticalBand = my >= chartArea.top - 8 && my <= chartArea.bottom;
      let nearest = -1;
      let bestDist = Number.POSITIVE_INFINITY;
      if (inVerticalBand) {
        eventMarkers.forEach((m, i) => {
          const px = xScale.getPixelForValue(m.index);
          const dist = Math.abs(px - mx);
          if (dist < bestDist) {
            bestDist = dist;
            nearest = i;
          }
        });
      }
      const nextIndex = bestDist <= 10 ? nearest : -1;
      if (nextIndex !== hoveredMarkerIndex) {
        hoveredMarkerIndex = nextIndex;
        chart.$hoverEventMarker = hoveredMarkerIndex >= 0;
        chart.draw();
      }
    },
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const xScale = scales.x;
      const focused = hoveredMarkerIndex >= 0 ? eventMarkers[hoveredMarkerIndex] : null;
      const overlayTop = chartArea.top - 10;

      ctx.save();
      if (focused) {
        ctx.fillStyle = "rgba(6, 9, 17, 0.62)";
        ctx.fillRect(chartArea.left, overlayTop, chartArea.right - chartArea.left, chartArea.bottom - overlayTop);
      }

      eventMarkers.forEach((m, i) => {
        if (focused && i !== hoveredMarkerIndex) return;
        const x = xScale.getPixelForValue(m.index);
        if (!Number.isFinite(x)) return;

        ctx.strokeStyle = m.color;
        ctx.setLineDash([7, 7]);
        ctx.lineWidth = focused ? 2.1 : 1.2;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top + 8);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = m.fill;
        ctx.strokeStyle = m.color;
        ctx.lineWidth = focused ? 1.6 : 1;
        ctx.font = "12px Manrope, sans-serif";
        const labelText = focused ? m.fullLabel : m.label;
        const w = ctx.measureText(labelText).width + 18;
        const h = 24;
        const left = Math.max(chartArea.left, Math.min(x - w / 2, chartArea.right - w));
        const top = chartArea.top - 4;
        roundRect(ctx, left, top, w, h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = m.color;
        ctx.fillText(labelText, left + 9, top + 16);
      });
      ctx.restore();
    },
  };

  trendChart = new Chart(els.trendCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Threads",
          yAxisID: "yThreads",
          data: threadsData,
          borderColor: "#64a7ff",
          backgroundColor: "rgba(100, 167, 255, 0.2)",
          pointBackgroundColor: "#64a7ff",
          pointRadius: 2.6,
          pointHoverRadius: 5,
          pointHitRadius: 14,
          tension: 0.34,
          borderWidth: 3,
        },
        {
          label: "LINE",
          yAxisID: "yLine",
          data: lineData,
          borderColor: "#ff3c7d",
          backgroundColor: "rgba(255, 60, 125, 0.2)",
          pointBackgroundColor: "#ff3c7d",
          pointRadius: 2.6,
          pointHoverRadius: 5,
          pointHitRadius: 14,
          tension: 0.34,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      onClick(event, _elements, chart) {
        const points = chart.getElementsAtEventForMode(event, "nearest", { intersect: false }, true);
        if (!points.length) return;
        const index = points[0].index;
        const recordId = recordIds[index];
        if (!Number.isFinite(recordId)) return;
        focusRecordRow(recordId);
      },
      onHover(event, _elements, chart) {
        const points = chart.getElementsAtEventForMode(event, "nearest", { intersect: false }, true);
        chart.canvas.style.cursor = points.length || chart.$hoverEventMarker ? "pointer" : "default";
      },
      animation: {
        duration: 760,
        easing: "easeOutQuart",
      },
      plugins: {
        zoom: {
          limits: {
            x: { minRange: 1 },
            yThreads: { minRange: 5 },
            yLine: { minRange: 5 },
          },
          pan: {
            enabled: true,
            mode: "xy",
            modifierKey: "shift",
          },
          zoom: {
            wheel: { enabled: true },
            drag: {
              enabled: true,
              backgroundColor: "rgba(94, 161, 255, 0.15)",
              borderColor: "rgba(94, 161, 255, 0.8)",
              borderWidth: 1,
            },
            pinch: { enabled: true },
            mode: "xy",
          },
        },
        legend: {
          position: "top",
          labels: {
            color: "#d4dbf2",
            usePointStyle: true,
            pointStyle: "line",
            boxWidth: 26,
            font: { family: "Manrope", size: 13, weight: "700" },
          },
        },
        tooltip: {
          backgroundColor: "rgba(13, 18, 31, 0.95)",
          borderColor: "#334066",
          borderWidth: 1,
          titleColor: "#e8edff",
          bodyColor: "#cfd8f7",
          padding: 12,
          callbacks: {
            title(items) {
              const index = items[0].dataIndex;
              return formatDisplayDateTime(new Date(sorted[index].timestamp));
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(65, 75, 104, 0.34)" },
          ticks: {
            color: "#9aa7ce",
            maxRotation: 0,
            autoSkip: true,
            font: { family: "Manrope", size: 12 },
          },
        },
        yThreads: {
          position: "left",
          beginAtZero: true,
          title: { display: true, text: "Threads", color: "#9ec6ff" },
          grid: { color: "rgba(65, 75, 104, 0.34)" },
          ticks: {
            color: "#9ec6ff",
            callback(value) {
              return Number(value).toLocaleString();
            },
          },
        },
        yLine: {
          position: "right",
          beginAtZero: true,
          title: { display: true, text: "LINE", color: "#ff8db3" },
          grid: { drawOnChartArea: false },
          ticks: {
            color: "#ff8db3",
            callback(value) {
              return Number(value).toLocaleString();
            },
          },
        },
      },
    },
    plugins: [markerPlugin],
  });
}

function buildNoteMarkers(sorted) {
  const palette = [
    { color: "#f2a531", fill: "rgba(242, 165, 49, 0.12)" },
    { color: "#6bcf7d", fill: "rgba(107, 207, 125, 0.12)" },
    { color: "#d27fff", fill: "rgba(210, 127, 255, 0.12)" },
    { color: "#ff7f7f", fill: "rgba(255, 127, 127, 0.12)" },
  ];

  return sorted
    .map((record, index) => ({ record, index }))
    .filter((x) => (x.record.note || "").trim().length > 0 && x.record.noteLineEnabled !== false)
    .map((x, idx) => {
      const color = palette[idx % palette.length];
      return {
        index: x.index,
        label: shortenText(x.record.note.trim(), 12),
        fullLabel: shortenText(x.record.note.trim(), 44),
        color: color.color,
        fill: color.fill,
      };
    });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function filterByRange(records, range) {
  const now = new Date();
  let start = null;
  let end = null;

  if (range.type === "today") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
  }

  if (range.type === "7d") {
    end = new Date(now);
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (range.type === "30d") {
    end = new Date(now);
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (range.type === "custom") {
    start = range.start ? new Date(range.start) : null;
    end = range.end ? new Date(range.end) : null;
  }

  return records.filter((record) => {
    if (start && record.timestamp < start.getTime()) return false;
    if (end && record.timestamp > end.getTime()) return false;
    return true;
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(RECORD_STORE_NAME)) {
        const store = database.createObjectStore(RECORD_STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!database.objectStoreNames.contains(CONTENT_STORE_NAME)) {
        const store = database.createObjectStore(CONTENT_STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function putRecord(record) {
  return new Promise((resolve, reject) => {
    const req = tx(RECORD_STORE_NAME, "readwrite").put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteRecord(id) {
  return new Promise((resolve, reject) => {
    const req = tx(RECORD_STORE_NAME, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function clearAllData() {
  return new Promise((resolve, reject) => {
    const txDb = db.transaction([RECORD_STORE_NAME, CONTENT_STORE_NAME], "readwrite");
    txDb.objectStore(RECORD_STORE_NAME).clear();
    txDb.objectStore(CONTENT_STORE_NAME).clear();
    txDb.oncomplete = () => resolve();
    txDb.onerror = () => reject(txDb.error);
  });
}

function clearAppLocalStorage() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith("ai-kol-")) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore storage access errors.
  }
}

async function clearBrowserCaches() {
  if (!("caches" in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch {
    // Ignore cache deletion errors.
  }
}

async function unregisterAllServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  } catch {
    // Ignore unregister errors.
  }
}

function clearAllRecordsOnly() {
  return new Promise((resolve, reject) => {
    const req = tx(RECORD_STORE_NAME, "readwrite").clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function clearAllContentOnly() {
  return new Promise((resolve, reject) => {
    const req = tx(CONTENT_STORE_NAME, "readwrite").clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getAllRecords() {
  return new Promise((resolve, reject) => {
    const req = tx(RECORD_STORE_NAME, "readonly").getAll();
    req.onsuccess = () => {
      const data = req.result || [];
      data.sort((a, b) => a.timestamp - b.timestamp);
      resolve(data);
    };
    req.onerror = () => reject(req.error);
  });
}

function putContentItem(item) {
  return new Promise((resolve, reject) => {
    const req = tx(CONTENT_STORE_NAME, "readwrite").put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteContentItem(id) {
  return new Promise((resolve, reject) => {
    const req = tx(CONTENT_STORE_NAME, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getAllContentItems() {
  return new Promise((resolve, reject) => {
    const req = tx(CONTENT_STORE_NAME, "readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function parseDateTimeLocalInput(value) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDisplayDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${mo}/${d} ${h}:${mi}`;
}

function formatDateTimeLocalValue(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

function formatChartTime(timestamp) {
  const d = new Date(timestamp);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}

function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function formatDisplayWithSeconds(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}/${mo}/${d} ${h}:${mi}:${s}`;
}

function formatTsWithSpace(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

function formatFileDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${mo}${d}-${h}${mi}${s}`;
}

function formatReadableFileDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d}_${h}-${mi}-${s}`;
}

function parseTsWithSpace(ts) {
  if (typeof ts !== "string") return null;
  const match = ts.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function shortenText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function normalizeImportedRecords(rows) {
  return rows
    .map((row) => {
      // New format: { ts, threads, line, note }
      if (typeof row?.ts === "string") {
        const dt = parseTsWithSpace(row.ts);
        const threads = Math.floor(Number(row.threads));
        const line = row.line == null || row.line === "" ? null : Math.floor(Number(row.line));
        if (!dt || !Number.isFinite(threads) || threads < 0) return null;
        if (line !== null && (!Number.isFinite(line) || line < 0)) return null;
        return {
          id: Date.now() + Math.floor(Math.random() * 100000),
          timestamp: dt.getTime(),
          datetime: formatDisplayDateTime(dt),
          threads,
          line,
          note: (row.note || "").toString().slice(0, 120),
          noteLineEnabled:
            typeof row.note_line_enabled === "boolean"
              ? row.note_line_enabled
              : (row.note || "").toString().trim().length > 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // Legacy format: { timestamp, threads, line, ... }
      if (Number.isFinite(row?.timestamp) && Number.isFinite(row?.threads)) {
        const ts = Number(row.timestamp);
        const line = row.line == null || row.line === "" ? null : Math.floor(Number(row.line));
        if (line !== null && (!Number.isFinite(line) || line < 0)) return null;
        return {
          id: Number.isFinite(row.id) ? row.id : Date.now() + Math.floor(Math.random() * 100000),
          timestamp: ts,
          datetime: row.datetime || formatDisplayDateTime(new Date(ts)),
          threads: Math.max(0, Math.floor(Number(row.threads))),
          line,
          note: (row.note || "").toString().slice(0, 120),
          noteLineEnabled:
            typeof row.noteLineEnabled === "boolean"
              ? row.noteLineEnabled
              : (row.note || "").toString().trim().length > 0,
          createdAt: row.createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || new Date().toISOString(),
        };
      }

      return null;
    })
    .filter(Boolean);
}

function extractDashboardRowsFromPayload(data) {
  if (Array.isArray(data?.modules?.dashboard?.records)) {
    return data.modules.dashboard.records;
  }
  if (Array.isArray(data?.records)) {
    return data.records;
  }
  return [];
}

function extractContentRowsFromPayload(data) {
  if (Array.isArray(data?.modules?.content_library?.items)) {
    return data.modules.content_library.items;
  }
  return [];
}

function extractRoleIdFromPayload(data) {
  const raw = data?.meta?.role_id;
  if (!raw) return "";
  return sanitizeRoleId(raw);
}

function filterRecordsByKeyword(records, keyword) {
  const q = (keyword || "").trim().toLowerCase();
  if (!q) return records;
  return records.filter((r) => {
    const bag = [r.datetime, String(r.threads), String(Number.isFinite(r.line) ? r.line : ""), r.note || ""]
      .join(" ")
      .toLowerCase();
    return bag.includes(q);
  });
}

function filterContentByKeyword(items, keyword) {
  const q = (keyword || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((x) => {
    const bag = [x.title || "", x.type || "", x.tags || "", x.body || "", x.ref || ""].join(" ").toLowerCase();
    return bag.includes(q);
  });
}

function normalizeImportedContentItems(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const title = (row?.title || "").toString().trim();
      const body = (row?.body || "").toString().trim();
      if (!title || !body) return null;
      return {
        id: Date.now() + Math.floor(Math.random() * 100000),
        title: title.slice(0, 80),
        type: (row?.type || "").toString().slice(0, 50),
        tags: (row?.tags || "").toString().slice(0, 80),
        ref: (row?.ref || "").toString().slice(0, 160),
        body: body.slice(0, 6000),
        createdAt: row?.created_at || new Date().toISOString(),
        updatedAt: row?.updated_at || new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function safeRatio(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return NaN;
  return num / den;
}

function computeGrowthRate(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return NaN;
  if (start === 0) {
    if (end > 0) return Infinity;
    if (end < 0) return -Infinity;
    return 0;
  }
  return (end - start) / start;
}

function computeGrowthRateWithFloor(start, end, floor) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return NaN;
  const base = Math.max(start, floor);
  return (end - start) / base;
}

function computeKpiForReport(records) {
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const conversions = sorted
    .map((r) => safeRatio(r.line, r.threads))
    .filter((v) => Number.isFinite(v));
  const latestConvertible = [...sorted].reverse().find((r) => Number.isFinite(safeRatio(r.line, r.threads)));
  const avgConversion = conversions.length
    ? conversions.reduce((sum, val) => sum + val, 0) / conversions.length
    : NaN;
  const latestConversion = latestConvertible ? safeRatio(latestConvertible.line, latestConvertible.threads) : NaN;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstLine = sorted.find((r) => Number.isFinite(r.line));
  const lastLine = [...sorted].reverse().find((r) => Number.isFinite(r.line));
  const threadsGrowth = first && last ? computeGrowthRateWithFloor(first.threads, last.threads, 1) : NaN;
  const lineGrowth = firstLine && lastLine ? computeGrowthRate(firstLine.line, lastLine.line) : NaN;
  return { latestConversion, avgConversion, threadsGrowth, lineGrowth };
}

function buildRangeLabel(records) {
  if (!records.length) return "-";
  const first = records[0];
  const last = records[records.length - 1];
  return `${first.datetime} ~ ${last.datetime}`;
}

function getChartDataUrl() {
  if (!els.trendCanvas) return "";
  if (trendChart && typeof trendChart.toBase64Image === "function") {
    return trendChart.toBase64Image("image/png", 1);
  }
  try {
    return els.trendCanvas.toDataURL("image/png", 1);
  } catch {
    return "";
  }
}

async function ensurePdfChineseFont(doc) {
  try {
    if (!pdfChineseFontBase64) {
      const resp = await fetch(PDF_CHINESE_FONT_URL);
      if (!resp.ok) return false;
      const buf = await resp.arrayBuffer();
      pdfChineseFontBase64 = arrayBufferToBase64(buf);
    }
    doc.addFileToVFS("NotoSansTC-Regular.ttf", pdfChineseFontBase64);
    doc.addFont("NotoSansTC-Regular.ttf", "NotoSansTC", "normal");
    return true;
  } catch {
    return false;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

async function buildCanvasReportPages({ roleId, rangeLabel, kpi, records, chartDataUrl }) {
  try {
    const pages = [];
    const remaining = [...records].reverse();
    const chartImg = chartDataUrl ? await loadImage(chartDataUrl) : null;
    let pageIndex = 0;

    while (remaining.length > 0 || pageIndex === 0) {
      const canvas = document.createElement("canvas");
      canvas.width = 1240;
      canvas.height = 1754;
      const ctx = canvas.getContext("2d");
      if (!ctx) return [];

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f172a";

      let y = 0;
      if (pageIndex === 0) {
        ctx.font = "bold 44px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillText("跨平台增長 PDF 報告", 52, 76);

        ctx.font = "24px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillStyle = "#334155";
        ctx.fillText(`角色編號：${roleId}`, 52, 124);
        ctx.fillText(`產生時間：${formatDisplayWithSeconds(new Date())}`, 52, 160);
        ctx.fillText(`統計區間：${rangeLabel}`, 52, 196);

        ctx.fillStyle = "#111827";
        ctx.font = "bold 30px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillText("績效摘要", 52, 252);
        ctx.font = "24px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillText(`最新轉換率：${formatPercent(kpi.latestConversion)}`, 52, 294);
        ctx.fillText(`區間平均轉換率：${formatPercent(kpi.avgConversion)}`, 52, 328);
        ctx.fillText(`Threads 增長率：${formatSignedPercent(kpi.threadsGrowth)}`, 52, 362);
        ctx.fillText(`LINE 增長率：${formatSignedPercent(kpi.lineGrowth)}`, 52, 396);

        y = 430;
        if (chartImg) {
          ctx.fillStyle = "#111827";
          ctx.font = "bold 30px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
          ctx.fillText("趨勢圖", 52, y);
          y += 14;
          const chartX = 52;
          const chartY = y;
          const chartW = canvas.width - 104;
          const chartH = 520;
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(chartX, chartY, chartW, chartH);
          ctx.strokeStyle = "#cbd5e1";
          ctx.strokeRect(chartX, chartY, chartW, chartH);
          ctx.drawImage(chartImg, chartX, chartY, chartW, chartH);
          y += chartH + 54;
        }
        ctx.fillStyle = "#111827";
        ctx.font = "bold 30px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillText("紀錄", 52, y);
        y += 20;
      } else {
        ctx.font = "bold 36px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillText("紀錄（續）", 52, 76);
        y = 96;
      }

      const drawn = drawCanvasRecordsTable(ctx, {
        x: 52,
        y,
        width: canvas.width - 104,
        records: remaining,
        canvasHeight: canvas.height,
      });
      remaining.splice(0, drawn);
      pages.push(canvas.toDataURL("image/png", 1));
      if (drawn <= 0) break;
      pageIndex += 1;
    }

    return pages;
  } catch {
    return [];
  }
}

async function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawPdfRecordsTable(doc, { records, startY, margin, pageW, pageH }) {
  const headers = ["時間", "Threads", "LINE", "轉換率", "備註"];
  const colWidths = [38, 22, 20, 24, pageW - margin * 2 - 104];
  const rowH = 7;
  let y = startY;

  const drawHeader = () => {
    doc.setFillColor(238, 243, 255);
    doc.rect(margin, y, pageW - margin * 2, rowH, "F");
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, y, pageW - margin * 2, rowH);
    doc.setFontSize(9);
    let x = margin;
    for (let i = 0; i < headers.length; i += 1) {
      doc.text(headers[i], x + 2, y + 4.8);
      x += colWidths[i];
      if (i < headers.length - 1) {
        doc.line(x, y, x, y + rowH);
      }
    }
    y += rowH;
  };

  drawHeader();
  doc.setFontSize(8.5);
  doc.setDrawColor(203, 213, 225);
  for (const record of records) {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
      doc.setFont("NotoSansTC", "normal");
      drawHeader();
      doc.setFontSize(8.5);
      doc.setDrawColor(203, 213, 225);
    }
    const note = (record.note || "").trim() ? shortenText(record.note.trim(), 18) : "-";
    const cells = [
      record.datetime,
      String(record.threads),
      Number.isFinite(record.line) ? String(record.line) : "-",
      formatPercent(safeRatio(record.line, record.threads)),
      note,
    ];
    let x = margin;
    for (let i = 0; i < cells.length; i += 1) {
      const text = shortenText(cells[i], i === 0 ? 16 : i === 4 ? 18 : 10);
      doc.text(text, x + 2, y + 4.8);
      x += colWidths[i];
      if (i < cells.length - 1) {
        doc.line(x, y, x, y + rowH);
      }
    }
    doc.rect(margin, y, pageW - margin * 2, rowH);
    y += rowH;
  }
}

function drawCanvasRecordsTable(ctx, { x, y, width, records, canvasHeight }) {
  const headers = ["時間", "Threads", "LINE", "轉換率", "備註"];
  const colRatios = [0.28, 0.13, 0.1, 0.14, 0.35];
  const colWidths = colRatios.map((r) => Math.floor(width * r));
  colWidths[colWidths.length - 1] = width - colWidths.slice(0, -1).reduce((a, b) => a + b, 0);
  const rowH = 34;

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(x, y, width, rowH);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, rowH);
  ctx.font = "bold 20px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
  ctx.fillStyle = "#0f172a";

  let cx = x;
  for (let i = 0; i < headers.length; i += 1) {
    ctx.fillText(headers[i], cx + 10, y + 23);
    cx += colWidths[i];
    if (i < headers.length - 1) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + rowH);
      ctx.stroke();
    }
  }

  const maxRows = Math.max(0, Math.floor((canvasHeight - (y + rowH) - 20) / rowH));
  const rows = records.slice(0, maxRows);
  ctx.font = "18px 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
  rows.forEach((record, idx) => {
    const rowY = y + rowH * (idx + 1);
    ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    ctx.fillRect(x, rowY, width, rowH);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(x, rowY, width, rowH);

    const cells = [
      record.datetime,
      String(record.threads),
      Number.isFinite(record.line) ? String(record.line) : "-",
      formatPercent(safeRatio(record.line, record.threads)),
      (record.note || "").trim() ? shortenText(record.note.trim(), 18) : "-",
    ];
    let cellX = x;
    ctx.fillStyle = "#1e293b";
    for (let i = 0; i < cells.length; i += 1) {
      const maxChars = i === 0 ? 16 : i === 4 ? 18 : 10;
      ctx.fillText(shortenText(cells[i], maxChars), cellX + 10, rowY + 22);
      cellX += colWidths[i];
      if (i < cells.length - 1) {
        ctx.beginPath();
        ctx.moveTo(cellX, rowY);
        ctx.lineTo(cellX, rowY + rowH);
        ctx.stroke();
      }
    }
  });
  return rows.length;
}

function sortRecordsForTable(records, sortOrder) {
  const sorted = [...records];
  if (sortOrder === "time_asc") {
    sorted.sort((a, b) => a.timestamp - b.timestamp);
    return sorted;
  }
  sorted.sort((a, b) => b.timestamp - a.timestamp);
  return sorted;
}

function buildExportPrefix(roleId) {
  const safe = sanitizeRoleId(roleId);
  return safe ? `${safe}-records` : "records";
}

function buildJsonExportFilename(roleId, date) {
  const safe = sanitizeRoleId(roleId) || "Amy";
  return `${safe}_全平台存檔_${formatReadableFileDateTime(date)}.json`;
}

function buildPdfReportFilename(roleId, date) {
  const safe = sanitizeRoleId(roleId) || "Amy";
  return `${safe}_跨平台增長報告_${formatReadableFileDateTime(date)}.pdf`;
}

function sanitizeRoleId(value) {
  return (value || "").toString().trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function formatPercent(val) {
  if (!Number.isFinite(val)) return "--";
  return `${(val * 100).toFixed(2)}%`;
}

function formatSignedPercent(val) {
  if (val === Infinity) return "+∞";
  if (val === -Infinity) return "-∞";
  if (!Number.isFinite(val)) return "--";
  const x = (val * 100).toFixed(2);
  return `${val > 0 ? "+" : ""}${x}%`;
}

function setDefaultDateTime() {
  els.datetimeInput.value = formatDateTimeLocalValue(new Date());
}

function registerChartZoomPlugin() {
  if (typeof Chart === "undefined") return;
  const maybePlugin = window.ChartZoom || window.chartjsPluginZoom;
  if (!maybePlugin) return;
  try {
    Chart.register(maybePlugin);
  } catch {
    // Ignore duplicate registration.
  }
}

function resetFormMode() {
  state.editingId = null;
  els.formTitle.textContent = "新增紀錄";
  els.saveRecordBtn.textContent = "儲存紀錄";
  els.resetFormBtn.textContent = "清空";
  els.recordForm.reset();
  setDefaultDateTime();
}

function startEdit(id) {
  const record = state.records.find((r) => r.id === id);
  if (!record) return;
  state.editingId = id;
  els.formTitle.textContent = "編輯紀錄";
  els.saveRecordBtn.textContent = "更新紀錄";
  els.resetFormBtn.textContent = "取消編輯";
  els.datetimeInput.value = formatDateTimeLocalValue(new Date(record.timestamp));
  els.threadsInput.value = String(record.threads);
  els.lineInput.value = Number.isFinite(record.line) ? String(record.line) : "";
  els.noteInput.value = record.note || "";
  els.datetimeInput.focus();
}

async function onSaveContentItem(event) {
  event.preventDefault();
  const title = els.contentTitleInput.value.trim();
  const type = els.contentTypeInput.value.trim();
  const tags = els.contentTagsInput.value.trim();
  const ref = els.contentRefInput.value.trim();
  const body = els.contentBodyInput.value.trim();
  if (!title) {
    alert("素材名稱不能為空");
    return;
  }
  if (!body) {
    alert("素材內容不能為空");
    return;
  }

  const existing = state.contentEditingId
    ? state.contentItems.find((x) => x.id === state.contentEditingId)
    : null;
  const item = {
    id: existing ? existing.id : Date.now() + Math.floor(Math.random() * 1000),
    title: title.slice(0, 80),
    type: type.slice(0, 50),
    tags: tags.slice(0, 80),
    ref: ref.slice(0, 160),
    body: body.slice(0, 6000),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await putContentItem(item);
  state.contentItems = await getAllContentItems();
  state.contentViewingId = item.id;
  markDataEdited();
  render();
  resetContentFormMode();
}

function startEditContent(id) {
  const item = state.contentItems.find((x) => x.id === id);
  if (!item) return;
  state.contentViewingId = id;
  state.contentEditingId = id;
  els.contentFormTitle.textContent = "編輯素材";
  els.saveContentBtn.textContent = "更新素材";
  els.resetContentBtn.textContent = "取消編輯";
  els.contentTitleInput.value = item.title || "";
  els.contentTypeInput.value = item.type || "";
  els.contentTagsInput.value = item.tags || "";
  els.contentRefInput.value = item.ref || "";
  els.contentBodyInput.value = item.body || "";
  els.contentTitleInput.focus();
}

function resetContentFormMode() {
  state.contentEditingId = null;
  els.contentFormTitle.textContent = "新增素材";
  els.saveContentBtn.textContent = "儲存素材";
  els.resetContentBtn.textContent = "清空";
  els.contentForm.reset();
}

function renderContentTable(items) {
  els.contentTableBody.innerHTML = "";
  const sorted = [...items].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  if (!state.contentViewingId && sorted.length) {
    state.contentViewingId = sorted[0].id;
  }
  for (const item of sorted) {
    const row = els.contentRowTemplate.content.firstElementChild.cloneNode(true);
    row.classList.add("record-row");
    row.dataset.contentId = String(item.id);
    if (item.id === state.contentViewingId) {
      row.classList.add("is-focused");
    }
    const titleCell = row.querySelector('[data-col="title"]');
    const typeCell = row.querySelector('[data-col="type"]');
    const tagsCell = row.querySelector('[data-col="tags"]');
    const updatedCell = row.querySelector('[data-col="updated"]');
    titleCell.textContent = item.title || "-";
    typeCell.textContent = item.type || "-";
    tagsCell.textContent = item.tags || "-";
    updatedCell.textContent = item.updatedAt
      ? formatDisplayDateTime(new Date(item.updatedAt))
      : "-";
    titleCell.dataset.label = "名稱";
    typeCell.dataset.label = "類型";
    tagsCell.dataset.label = "標籤";
    updatedCell.dataset.label = "更新時間";
    const actionCell = row.querySelector(".row-actions");
    actionCell.dataset.label = "操作";
    row.querySelector('[data-action="view-content"]').dataset.id = String(item.id);
    row.querySelector('[data-action="edit-content"]').dataset.id = String(item.id);
    row.querySelector('[data-action="delete-content"]').dataset.id = String(item.id);
    els.contentTableBody.appendChild(row);
  }
  if (!sorted.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="5">目前沒有素材內容</td>';
    els.contentTableBody.appendChild(tr);
  }
}

function renderContentViewer(items) {
  const selected =
    items.find((x) => x.id === state.contentViewingId) || (items.length ? items[0] : null);
  if (!selected) {
    els.contentViewerTitle.textContent = "請先選擇素材";
    els.contentViewerMeta.textContent = "-";
    els.contentViewerTags.textContent = "-";
    els.contentViewerRefLink.textContent = "";
    els.contentViewerRefLink.removeAttribute("href");
    els.contentViewerRefEmpty.textContent = "-";
    els.contentViewerBody.textContent = "尚未選擇任何素材。";
    return;
  }

  state.contentViewingId = selected.id;
  els.contentViewerTitle.textContent = selected.title || "未命名素材";
  els.contentViewerMeta.textContent = `類型：${selected.type || "-"}｜更新：${
    selected.updatedAt ? formatDisplayDateTime(new Date(selected.updatedAt)) : "-"
  }`;
  els.contentViewerTags.textContent = `標籤：${selected.tags || "-"}`;
  const safeRef = normalizeExternalUrl(selected.ref || "");
  if (safeRef) {
    els.contentViewerRefLink.href = safeRef;
    els.contentViewerRefLink.textContent = safeRef;
    els.contentViewerRefEmpty.textContent = "";
  } else {
    els.contentViewerRefLink.textContent = "";
    els.contentViewerRefLink.removeAttribute("href");
    els.contentViewerRefEmpty.textContent = "-";
  }
  els.contentViewerBody.textContent = selected.body || "";
}

function normalizeExternalUrl(raw) {
  const text = (raw || "").trim();
  if (!text) return "";
  try {
    const u = new URL(text);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return "";
  } catch {
    return "";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    setStorageStatus("");
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      await navigator.serviceWorker.ready;
      if (registration.active || registration.waiting || registration.installing) {
        setStorageStatus("");
        return;
      }
      setStorageStatus("");
    } catch (err) {
      const reason = err && err.message ? err.message : String(err || "");
      setStorageStatus(`Service Worker 註冊失敗: ${reason || "未知原因"}`);
    }
  });
}

function loadRangeState() {
  try {
    const raw = localStorage.getItem("ai-kol-range");
    if (!raw) return { type: "30d", start: "", end: "" };
    const parsed = JSON.parse(raw);
    return {
      type: parsed.type || "30d",
      start: parsed.start || "",
      end: parsed.end || "",
    };
  } catch {
    return { type: "30d", start: "", end: "" };
  }
}

function loadNoteLineSetting() {
  try {
    const raw = localStorage.getItem("ai-kol-show-note-lines");
    if (raw == null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

function loadSortOrder() {
  try {
    const raw = localStorage.getItem("ai-kol-sort-order");
    if (raw === "time_asc" || raw === "time_desc") return raw;
    return "time_desc";
  } catch {
    return "time_desc";
  }
}

function loadRoleId() {
  try {
    return sanitizeRoleId(localStorage.getItem("ai-kol-role-id") || "");
  } catch {
    return "";
  }
}

function loadLastEditedAt() {
  try {
    return localStorage.getItem("ai-kol-last-edited-at") || "";
  } catch {
    return "";
  }
}

function loadLastSavedAt() {
  try {
    return localStorage.getItem("ai-kol-last-saved-at") || "";
  } catch {
    return "";
  }
}

function loadRecordSearch() {
  try {
    return localStorage.getItem("ai-kol-record-search") || "";
  } catch {
    return "";
  }
}

function loadContentSearch() {
  try {
    return localStorage.getItem("ai-kol-content-search") || "";
  } catch {
    return "";
  }
}

function ensureRecordDefaults(records) {
  return records.map((record) => ({
    ...record,
    noteLineEnabled:
      typeof record.noteLineEnabled === "boolean"
        ? record.noteLineEnabled
        : (record.note || "").toString().trim().length > 0,
  }));
}

function persistRangeState(range) {
  localStorage.setItem("ai-kol-range", JSON.stringify(range));
}

function persistNoteLineSetting(enabled) {
  localStorage.setItem("ai-kol-show-note-lines", enabled ? "1" : "0");
}

function persistSortOrder(sortOrder) {
  localStorage.setItem("ai-kol-sort-order", sortOrder);
}

function persistRoleId(roleId) {
  localStorage.setItem("ai-kol-role-id", sanitizeRoleId(roleId));
}

function persistLastEditedAt(iso) {
  localStorage.setItem("ai-kol-last-edited-at", iso);
}

function persistLastSavedAt(iso) {
  localStorage.setItem("ai-kol-last-saved-at", iso);
}

function persistRecordSearch(keyword) {
  localStorage.setItem("ai-kol-record-search", keyword || "");
}

function persistContentSearch(keyword) {
  localStorage.setItem("ai-kol-content-search", keyword || "");
}

function applyRangeStateToUi() {
  els.rangeSelect.value = state.range.type;
  els.startDate.value = state.range.start;
  els.endDate.value = state.range.end;

  const custom = state.range.type === "custom";
  els.startDate.disabled = !custom;
  els.endDate.disabled = !custom;
}

function applyNoteLineStateToUi() {
  els.showNoteLines.checked = state.showNoteLines;
}

function applySortOrderStateToUi() {
  els.sortOrderSelect.value = state.sortOrder;
}

function applyRoleIdStateToUi() {
  els.roleIdInput.value = state.roleId;
}

function applySearchStateToUi() {
  els.recordSearchInput.value = state.recordSearch;
  els.contentSearchInput.value = state.contentSearch;
}

function renderSaveMeta() {
  if (!state.lastEditedAt) {
    els.lastEditedAt.textContent = "--";
    return;
  }
  const dt = new Date(state.lastEditedAt);
  if (Number.isNaN(dt.getTime())) {
    els.lastEditedAt.textContent = "--";
    return;
  }
  els.lastEditedAt.textContent = formatDisplayWithSeconds(dt);
}

function markDataEdited() {
  const nowIso = new Date().toISOString();
  state.lastEditedAt = nowIso;
  persistLastEditedAt(nowIso);
}

function markDataSaved() {
  const nowIso = new Date().toISOString();
  state.lastSavedAt = nowIso;
  persistLastSavedAt(nowIso);
}

function hasUnsavedChanges() {
  if (!state.records.length && !state.contentItems.length) return false;
  if (!state.lastEditedAt) return false;
  if (!state.lastSavedAt) return true;
  return state.lastEditedAt > state.lastSavedAt;
}

function confirmTwice(message1, message2) {
  if (!window.confirm(message1)) return false;
  if (!window.confirm(message2)) return false;
  return true;
}

function computeLastEditedAtFromData(records, contentItems) {
  let maxIso = "";
  for (const r of records) {
    const iso = r.updatedAt || r.createdAt || "";
    if (!iso) continue;
    if (!maxIso || iso > maxIso) maxIso = iso;
  }
  for (const x of contentItems) {
    const iso = x.updatedAt || x.createdAt || "";
    if (!iso) continue;
    if (!maxIso || iso > maxIso) maxIso = iso;
  }
  return maxIso;
}

function focusRecordRow(recordId) {
  const row = els.recordTableBody.querySelector(`tr[data-record-id="${recordId}"]`);
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.add("is-focused");
  window.setTimeout(() => row.classList.remove("is-focused"), 1300);
}

function setStorageStatus(text) {
  void text;
}
