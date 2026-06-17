// infrastructure.js — dashboard module
/* ---------------- ORIGINAL DASHBOARD LOGIC ---------------- */
const YEARS = ["2019","2020","2021","2022","2023","2024","2025","2026"];
const YEAR_INDEXES = [3,4,5,6,7,8,9,10];
const TOTAL_COLS = 5 + YEARS.length;

let raw = [];
let TYPES = [];
let sortCol = 2;
let sortDir = 1;
let charts = {};
let repeatedFollowUpsCountForSummary = 0;

const C = {
  blue:'rgba(59,130,246,.85)',
  green:'rgba(5,150,105,.85)',
  red:'rgba(220,38,38,.85)',
  yellow:'rgba(217,119,6,.85)',
  purple:'rgba(139,92,246,.85)',
  teal:'rgba(20,184,166,.85)',
  orange:'rgba(249,115,22,.85)'
};

const PIE_COLORS = [
  'rgba(59,130,246,.85)',
  'rgba(5,150,105,.85)',
  'rgba(217,119,6,.85)',
  'rgba(220,38,38,.85)',
  'rgba(139,92,246,.85)',
  'rgba(20,184,166,.85)',
  'rgba(249,115,22,.85)',
  'rgba(236,72,153,.85)'
];

Chart.defaults.color = '#6b7280';
Chart.defaults.font.family = "'Heebo',sans-serif";

const INFRA_CHART_IDS = ['cByType','cPieDone','cPieTodo','cPieLoaded','cTimeline'];
const CONVERSION_CHART_IDS = ['overviewWeeklyProjectsChart','expertsChart','avgDurationChart','qualityChart','workloadChart','projectTimelineChart','projectsByMonthChart','projectsByMonthTypeChart','geomsByMonthChart','pniyotChart'];
const INTERESTS_CHART_IDS = ['interestsTypePieChart','interestsYearChart'];


function renderEmptyState(message = 'לא נמצאו תוצאות', hint = 'נסה לשנות פילטרים או לנקות חיפוש.') {
  return `<div class="empty-state"><div class="empty-icon" aria-hidden="true">🔍</div><strong>${message}</strong><span>${hint}</span></div>`;
}

function renderSkeletonSummary() {
  return `
    <div class="skeleton-summary" aria-hidden="true">
      ${Array.from({ length: 4 }, () => `
        <div class="summary-item">
          <span class="skeleton-line big"></span>
          <span class="skeleton-line mid"></span>
        </div>
      `).join('')}
      <div class="summary-item">
        <span class="skeleton-line wide"></span>
        <span class="skeleton-line mid"></span>
        <span class="skeleton-line wide"></span>
      </div>
    </div>
  `;
}

function renderSkeletonCards(count = 4) {
  return Array.from({ length: count }, () => '<div class="skeleton-card" aria-hidden="true"></div>').join('');
}

function renderSkeletonTableRows(cols, rows = 8) {
  return Array.from({ length: rows }, () =>
    `<tr class="skeleton-row">${Array.from({ length: cols }, () => '<td></td>').join('')}</tr>`
  ).join('');
}

function setChartWidgetsLoading(ids, isLoading, message = 'טוען נתונים...') {
  ids.forEach(id => {
    const canvas = document.getElementById(id);
    const wrap = canvas?.closest('.chart-wrap');
    if (!wrap) return;
    wrap.classList.toggle('is-loading', Boolean(isLoading));
    if (isLoading) wrap.setAttribute('data-loading', message);
    else wrap.removeAttribute('data-loading');
  });
}

function setSummaryWidgetLoading(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = renderSkeletonSummary() + `<div class="loading-shell"><div class="spinner" aria-hidden="true"></div><div class="section-sub">${message}</div></div>`;
}

function setConversionLoadingState(message = 'טוען נתוני משימות והסבות...') {
  setSummaryWidgetLoading('expertsSummary', message);
  setSummaryWidgetLoading('workSummary', 'מחשב מדדי עומס, איכות וזמנים...');
  setSummaryWidgetLoading('pniyotSummary', 'טוען ומסכם פניות...');
  setChartWidgetsLoading(CONVERSION_CHART_IDS, true, message);
  const errorEl = document.getElementById('conversionError');
  if (errorEl) errorEl.innerHTML = `<div class="loading-shell"><div class="spinner" aria-hidden="true"></div><div>${message}</div></div>`;
}

function clearConversionLoadingState() {
  setChartWidgetsLoading(CONVERSION_CHART_IDS, false);
  const errorEl = document.getElementById('conversionError');
  if (errorEl) errorEl.textContent = '';
}

function debounce(fn, wait = 120) {
  let timeout;
  return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), wait); };
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
function normalizeStatus(value) {
  const v = normalizeValue(value);
  if (!v) return "";
  if (v === "טופל") return "טופל";
  if (v === "לא טופל") return "לא טופל";
  return "";
}
function normalizePriority(value) {
  const v = normalizeValue(value);
  if (v === "1" || v === "2") return v;
  return "";
}
function normalizeRow(item) {
  return [
    normalizeValue(item["סוג תשתית"]),
    normalizeValue(item["גוף תשתית"]),
    normalizePriority(item["רמת תעדוף"]),
    normalizeStatus(item["2019"]),
    normalizeStatus(item["2020"]),
    normalizeStatus(item["2021"]),
    normalizeStatus(item["2022"]),
    normalizeStatus(item["2023"]),
    normalizeStatus(item["2024"]),
    normalizeStatus(item["2025"]),
    normalizeStatus(item["2026"]),
    normalizeValue(item["טעינה למאגר"])
  ];
}
function isLoadedToRepository(row) { return !!normalizeValue(row[11]); }
function isDone(row, colIndex) { return row[colIndex] === "טופל"; }
function isTodo(row, colIndex) { return row[colIndex] === "לא טופל"; }
function everDone(row) { return YEAR_INDEXES.some(colIndex => isDone(row, colIndex)); }
function neverDone(row) { return YEAR_INDEXES.every(colIndex => !isDone(row, colIndex)); }

function setLoadingState(message = "טוען נתונים...") {
  document.getElementById("summaryBanner").innerHTML = renderSkeletonSummary() + `
    <div class="loading-shell">
      <div class="spinner" aria-hidden="true"></div>
      <div class="section-sub">${message}</div>
    </div>
  `;

  document.getElementById("kpiRow").innerHTML = renderSkeletonCards(4);

  document.getElementById("tBody").innerHTML = renderSkeletonTableRows(TOTAL_COLS, 8);
  document.getElementById("filterCount").textContent = "טוען...";
  setChartWidgetsLoading(INFRA_CHART_IDS, true, message);
}

function setErrorState(message) {
  document.getElementById("summaryBanner").innerHTML = `
    <div style="color:var(--red);font-weight:700;">שגיאה בטעינת הנתונים</div>
    <div class="section-sub">${message}</div>
  `;
  document.getElementById("kpiRow").innerHTML = "";
  document.getElementById("tBody").innerHTML = `<tr><td colspan="${TOTAL_COLS}" class="no-results">${renderEmptyState("שגיאה בטעינת הנתונים", message)}</td></tr>`;
  document.getElementById("filterCount").textContent = "";
}

function populateTypeFilter() {
  const select = document.getElementById("filterType");
  const current = select.value;
  select.innerHTML = `<option value="">כל הסוגים</option>`;
  TYPES.forEach(type => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });
  if ([...select.options].some(o => o.value === current)) {
    select.value = current;
  }
}

function renderSummary() {
  const total = raw.length;
  const prio1 = raw.filter(r => r[2] === "1").length;
  const doneEver = raw.filter(everDone).length;
  const neverD = raw.filter(r => neverDone(r) && YEAR_INDEXES.some(c => isTodo(r, c))).length;
  const done25 = raw.filter(r => isDone(r, 9)).length;
  const todo25 = raw.filter(r => isTodo(r, 9)).length;
  const loadedTotal = raw.filter(r => isLoadedToRepository(r)).length;
  const pct = total ? Math.round((doneEver / total) * 100) : 0;

  document.getElementById("summaryBanner").innerHTML = `
    <div class="s-stats">
      <div class="s-stat">
        <div class="s-val blue">${total}</div>
        <div class="s-label">סה"כ גופים ייחודיים</div>
      </div>
      <div class="s-stat clickable" data-conversion-filter="done" role="button" tabindex="0">
        <div class="s-val green">${doneEver}</div>
        <div class="s-label">גופים שעברו הסבה (לפחות שנה)</div>
      </div>
      <div class="s-stat clickable" data-conversion-filter="todo" role="button" tabindex="0">
        <div class="s-val red">${neverD}</div>
        <div class="s-label">גופים שלא עברו הסבה כלל</div>
        <div class="s-sub">מתבצעות פניות חוזרות ל-${repeatedFollowUpsCountForSummary.toLocaleString("he-IL")} גופים</div>
      </div>
      <div class="s-stat">
        <div class="s-val teal">${loadedTotal}</div>
        <div class="s-label">גופים שנטענו למאגר</div>
      </div>
    </div>
    <div class="s-bar-wrap">
      <div class="s-bar-label"><span>אחוז הסבה כולל</span><span>${doneEver} מתוך ${total}</span></div>
      <div class="s-bar-track"><div class="s-bar-fill" id="sf" style="width:0%"></div></div>
      <div class="s-pct">${pct}% מהגופים עברו הסבה</div>
    </div>
  `;

  document.getElementById("kpiRow").innerHTML = `
    <div class="kpi-card blue"><div class="kpi-label">סה"כ גופים</div><div class="kpi-value">${total}</div><div class="kpi-sub">גופי תשתית במאגר</div></div>
    <div class="kpi-card yellow"><div class="kpi-label">עדיפות 1</div><div class="kpi-value">${prio1}</div><div class="kpi-sub">גופים בעדיפות ראשונה</div></div>
    <div class="kpi-card green"><div class="kpi-label">עבר הסבה ב-2025</div><div class="kpi-value">${done25}</div><div class="kpi-sub">גופים שעברו הסבה</div></div>
    <div class="kpi-card red"><div class="kpi-label">לא עבר הסבה ב-2025</div><div class="kpi-value">${todo25}</div><div class="kpi-sub">גופים שממתינים להסבה</div></div>
  `;

  setTimeout(() => {
    const fill = document.getElementById("sf");
    if (fill) fill.style.width = pct + "%";
  }, 120);
}

function destroyCharts() {
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
  charts = {};
}

function chartOpts(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 14, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: 'rgba(15,23,42,0.055)' }, border: { display: false }, beginAtZero: true }
    },
    ...extra
  };
}

function renderCharts() {
  destroyCharts();
const doneByYear = YEARS.map((_, i) => raw.filter(r => isDone(r, YEAR_INDEXES[i])).length);
const todoByYear = YEARS.map((_, i) => raw.filter(r => isTodo(r, YEAR_INDEXES[i])).length);


  const typesAll = [...new Set(raw.map(r => r[0]).filter(Boolean))];
  const doneCnt = typesAll.map(t => raw.filter(r => r[0] === t && everDone(r)).length);
  const todoCnt = typesAll.map(t => raw.filter(r => r[0] === t && neverDone(r) && YEAR_INDEXES.some(c => isTodo(r, c))).length);
  const loadedCnt = typesAll.map(t => raw.filter(r => r[0] === t && isLoadedToRepository(r)).length);

  charts.byType = new Chart(document.getElementById("cByType"), {
    type: 'bar',
    data: {
      labels: typesAll,
      datasets: [
        { label: 'פרויקט עבר הסבה', data: doneCnt, backgroundColor: C.green, borderRadius: 4 },
        { label: 'פרויקט לא עבר הסבה', data: todoCnt, backgroundColor: C.red, borderRadius: 4 }
      ]
    },
    options: chartOpts()
  });

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 10, font: { size: 10 }, boxWidth: 12, usePointStyle: true, pointStyle: 'circle' }
      }
    },
    cutout: '58%'
  };

  charts.pieDone = new Chart(document.getElementById("cPieDone"), {
    type: 'doughnut',
    data: { labels: typesAll, datasets: [{ data: doneCnt, backgroundColor: PIE_COLORS, borderWidth: 2, borderColor: '#ffffff' }] },
    options: doughnutOpts
  });

  charts.pieTodo = new Chart(document.getElementById("cPieTodo"), {
    type: 'doughnut',
    data: { labels: typesAll, datasets: [{ data: todoCnt, backgroundColor: PIE_COLORS, borderWidth: 2, borderColor: '#ffffff' }] },
    options: doughnutOpts
  });

  charts.pieLoaded = new Chart(document.getElementById("cPieLoaded"), {
    type: 'doughnut',
    data: { labels: typesAll, datasets: [{ data: loadedCnt, backgroundColor: PIE_COLORS, borderWidth: 2, borderColor: '#ffffff' }] },
    options: doughnutOpts
  });
  setChartWidgetsLoading(['cByType','cPieDone','cPieTodo','cPieLoaded'], false);
}
function renderTimelineChart() {
  if (!document.getElementById("cTimeline")) return;

  const doneByYear = YEARS.map((_, i) =>
    raw.filter(r => isDone(r, YEAR_INDEXES[i])).length
  );

  const todoByYear = YEARS.map((_, i) =>
    raw.filter(r => isTodo(r, YEAR_INDEXES[i])).length
  );

  if (charts.timeline) charts.timeline.destroy();

  charts.timeline = new Chart(document.getElementById("cTimeline"), {
    type: 'bar',
    data: {
      labels: YEARS,
      datasets: [
        {
          label: 'פרויקט עבר הסבה',
          data: doneByYear,
          backgroundColor: C.green,
          borderRadius: 4
        },
        {
          label: 'פרויקט לא עבר הסבה',
          data: todoByYear,
          backgroundColor: C.red,
          borderRadius: 4
        }
      ]
    },
    options: chartOpts()
  });
  setChartWidgetsLoading(['cTimeline'], false);
}
const pH = value =>
  value === "טופל"
    ? '<span class="pill done">עבר הסבה</span>'
    : value === "לא טופל"
      ? '<span class="pill todo">לא עבר הסבה</span>'
      : '<span class="dash">—</span>';

function getFilteredSorted() {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const fType = document.getElementById("filterType").value;
  const fPrio = document.getElementById("filterPrio").value;
  const fSt25 = document.getElementById("filterStatus25").value;

  const rows = raw.filter(r => {
    if (search) {
      const name = (r[1] || "").toLowerCase();
      const type = (r[0] || "").toLowerCase();
      if (!name.includes(search) && !type.includes(search)) return false;
    }
    if (fType && r[0] !== fType) return false;
    if (fPrio === "1" && r[2] !== "1") return false;
    if (fPrio === "2" && r[2] !== "2") return false;
    if (fPrio === "none" && r[2] !== "") return false;
    const conversionStatus = overallConversionStatus(r);
    if (fSt25 === "done" && conversionStatus !== "טופל") return false;
    if (fSt25 === "todo" && conversionStatus !== "לא טופל") return false;
    return true;
  });

  rows.sort((a, b) => compareRows(a, b, sortCol, sortDir));

  return rows;
}

function parsePriority(val) {
  if (val === "1") return 0;
  if (val === "2") return 1;
  return Number.POSITIVE_INFINITY;
}

function getSortValue(row, col) {
  if (col === 2) {
    return parsePriority(String(row[2] || '').trim());
  }

  if (col === 11) {
    return normalizeValue(row[11]) ? 1 : 0;
  }

  if (col === "latestConversion") {
    const status = overallConversionStatus(row);
    if (status === "טופל") return 1;
    if (status === "לא טופל") return 0;
    return -1;
  }

  if (YEAR_INDEXES.includes(col)) {
    const status = normalizeStatus(row[col]);
    if (status === "טופל") return 1;
    if (status === "לא טופל") return 0;
    return -1;
  }

  return normalizeValue(row[col]).toLowerCase();
}

function compareRows(a, b, col, dir) {
  const va = getSortValue(a, col);
  const vb = getSortValue(b, col);

  if (typeof va === "number" && typeof vb === "number") {
    if (va !== vb) return (va - vb) * dir;
  } else {
    const cmp = String(va).localeCompare(String(vb), "he");
    if (cmp !== 0) return cmp * dir;
  }

  const typeCmp = normalizeValue(a[0]).localeCompare(normalizeValue(b[0]), "he");
  if (typeCmp !== 0) return typeCmp;

  return normalizeValue(a[1]).localeCompare(normalizeValue(b[1]), "he");
}

function priorityPill(val) {
  const n = Number(String(val || '').trim());
  if (n === 1) return '<span class="pill prio prio-1">עדיפות 1</span>';
  if (n === 2) return '<span class="pill prio prio-2">עדיפות 2</span>';
  if (String(val || '').trim()) return `<span class="pill prio">עדיפות ${String(val).trim()}</span>`;
  return '<span class="dash">—</span>';
}

function loadedMark(row) {
  return normalizeValue(row[11]) ? '<span class="pill done">✓</span>' : '';
}

function latestYearStatus(row) {
  for (let i = YEAR_INDEXES.length - 1; i >= 0; i--) {
    const value = normalizeStatus(row[YEAR_INDEXES[i]]);
    if (value) return value;
  }
  return "";
}

function overallConversionStatus(row) {
  if (everDone(row)) return "טופל";
  if (YEAR_INDEXES.some(colIndex => isTodo(row, colIndex))) return "לא טופל";
  return "";
}

function conversionMark(row) {
  const status = overallConversionStatus(row);
  if (status === "טופל") return '<span class="pill done">✓</span>';
  if (status === "לא טופל") return '<span class="pill todo">✕</span>';
  return "";
}

function renderTable() {
  const rows = getFilteredSorted();
  const tbody = document.getElementById("tBody");
  tbody.innerHTML = "";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${TOTAL_COLS}" class="no-results">${renderEmptyState()}</td></tr>`;
    document.getElementById("filterCount").textContent = "0 גופים";
    return;
  }

  const groupByType = sortCol === 0 || sortCol === 2;
  let currentType = null;

  rows.forEach(r => {
    if (groupByType && r[0] !== currentType) {
      currentType = r[0];
      const groupCount = rows.filter(x => x[0] === currentType).length;
      tbody.innerHTML += `<tr class="group-header"><td colspan="${TOTAL_COLS}">${currentType} — ${groupCount} גופים</td></tr>`;
    }

    tbody.innerHTML += `
      <tr>
        <td>${r[1] || '<span class="dash">—</span>'}</td>
        <td>${groupByType ? '' : `<span class="type-tag">${r[0] || '—'}</span>`}</td>
        <td>${priorityPill(r[2])}</td>
        <td>${loadedMark(r)}</td>
        <td>${conversionMark(r)}</td>
    ${YEAR_INDEXES.map(i => `<td>${pH(r[i])}</td>`).join("")}
      </tr>
    `;
  });

  document.getElementById("filterCount").textContent = rows.length + " גופים";
}

function renderAllOriginal() {
  TYPES = [...new Set(raw.map(r => r[0]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  renderTableHeader();
  const initialSortedHeader = document.querySelector(`#mainTable thead th[data-col="${sortCol}"]`);
  if (initialSortedHeader) {
    initialSortedHeader.classList.add("sorted");
    const icon = initialSortedHeader.querySelector(".sort-icon");
    if (icon) icon.textContent = sortDir === 1 ? "↑" : "↓";
  }
  populateTypeFilter();
  renderSummary();
  renderCharts();
  renderTable();
}

function bindOriginalEvents() {
  const mainTable = document.getElementById("mainTable");
  if (mainTable && !mainTable.dataset.sortBound) {
    mainTable.addEventListener("click", (event) => {
      const th = event.target.closest("th[data-col]");
      if (!th || !mainTable.contains(th)) return;

      const rawCol = th.dataset.col;
      const col = rawCol === "latestConversion" ? rawCol : parseInt(rawCol, 10);

      if (sortCol === col) {
        sortDir *= -1;
      } else {
        sortCol = col;
        sortDir = 1;
      }

      document.querySelectorAll("#mainTable thead th").forEach(h => {
        h.classList.remove("sorted");
        const icon = h.querySelector(".sort-icon");
        if (icon) icon.textContent = "↕";
      });

      th.classList.add("sorted");
      const icon = th.querySelector(".sort-icon");
      if (icon) icon.textContent = sortDir === 1 ? "↑" : "↓";

      renderTable();
    });
    mainTable.dataset.sortBound = "true";
  }

  ["searchInput","filterType","filterPrio","filterStatus25"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound) return;
    el.addEventListener("input", debounce(renderTable, 120));
    el.addEventListener("change", renderTable);
    el.dataset.bound = "true";
  });

  const clearBtn = document.getElementById("clearFilters");
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.addEventListener("click", () => {
      document.getElementById("searchInput").value = "";
      document.getElementById("filterType").value = "";
      document.getElementById("filterPrio").value = "";
      document.getElementById("filterStatus25").value = "";
      renderTable();
    });
    clearBtn.dataset.bound = "true";
  }

  const summaryBanner = document.getElementById("summaryBanner");
  if (summaryBanner && !summaryBanner.dataset.bound) {
    summaryBanner.addEventListener("click", event => {
      const target = event.target.closest("[data-conversion-filter]");
      if (target) goToTableWithConversionFilter(target.dataset.conversionFilter);
    });
    summaryBanner.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target.closest("[data-conversion-filter]");
      if (!target) return;
      event.preventDefault();
      goToTableWithConversionFilter(target.dataset.conversionFilter);
    });
    summaryBanner.dataset.bound = "true";
  }

}

function getSheetRows(payload, sheetName) {
  if (!payload) return [];
  if (Array.isArray(payload?.[sheetName])) return payload[sheetName];
  if (payload.data && Array.isArray(payload.data?.[sheetName])) return payload.data[sheetName];
  return [];
}

async function loadOriginalDataFromPayload(payload) {
  setLoadingState();

  try {
    const rows = getSheetRows(payload, INFRASTRUCTURE_SHEET_NAME);

    if (!Array.isArray(rows) || !rows.length) {
      throw new Error(`Sheet "${INFRASTRUCTURE_SHEET_NAME}" not found or empty.`);
    }

const fileLocatorRows = typeof normalizeApiRows === "function"
  ? normalizeApiRows(getSheetRows(payload, FILE_LOCATOR_SHEET_NAME))
  : getSheetRows(payload, FILE_LOCATOR_SHEET_NAME).map(trimRowKeys);

const normalizeKey = key => String(key).replace(/\s+/g, "").trim();

const filesCountKey = Object.keys(fileLocatorRows[0] || {}).find(
  key => normalizeKey(key) === "כמותקבצים"
);

repeatedFollowUpsCountForSummary = fileLocatorRows.filter(row => {
  const rawValue = row[filesCountKey];

  if (rawValue === null || rawValue === undefined) return false;

  const value = String(rawValue)
    .trim()
    .replace(/[^\d.-]/g, "");

  return value !== "" && Number(value) === 0;
}).length;

console.log("Key:", filesCountKey);
console.log("Count:", repeatedFollowUpsCountForSummary);

    raw = rows.map(trimRowKeys).map(normalizeRow).filter(row => row[0] || row[1]);
    renderAllOriginal();
    renderTimelineChart();
  } catch (error) {
    console.error("Failed to load infrastructure data:", error);
    setErrorState("לא ניתן לטעון נתוני הסבת תשתיות מתוך נתוני האינטרסים.");
  }
}

