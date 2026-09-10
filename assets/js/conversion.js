// conversion.js — dashboard module
/* ---------------- CONVERSION DASHBOARD ---------------- */

const CONVERSION_API_URL = "https://script.googleusercontent.com/a/macros/mapi.gov.il/echo?user_content_key=AUkAhnRE4jrX6IS_bMAJqimbc_tU25fLLdBqjkULoxBpeh-0NlmB6SCS-XXS9mDhkggcUMYhvfMySXoQhWjYkf3BxQJOluKbrNUgVJEzs4GSleo7WanIDQgeLkxBLmJtN2IDAOqOIMaPLKCoEQqYbpchPwaNoVLHmtZu1Nrpg0xpfTtBsBPOVRmY_CQVDGu3-HrFtycSY17So6D9p9fWvWn9a8GzqOdBE3eWvdIH5MRdfmx30ENDAw97q3JDtGlN9ztvKqaGIdRemKEatP2MDJTr-bmGecXi5SHj9oKmxFTu&lib=M7891kwSt8bJi1zhnUcTkqY-MNonZQ_sT"
const INTERESTS_API_URL = "https://script.googleusercontent.com/a/macros/mapi.gov.il/echo?user_content_key=AUkAhnTwaAY3bpkQBKXthlgDPOe1jfNXYwscJ5JPk_OUbkpwIYLiopyZmaAwNuZUG5oC5AnJtSlU0OljLCRLD8f4D3VGQkTgxxiTff7qh6UIm50eBUCOcXNz4UVk6Psi07883bHdqqRFSKk_a9P6OuHnb-sVyBZvo8wCV_MS_7gLJ57GHbDa2sf1eDXD7qzqrJ5BNM5Un3DvvEtJL8DEgkDZK-XhFCUK8in-3K1xxZJj1lbVmw8Z-5Q1mMMyo6Hj5Qa0-Nu1VO_deHCMFPpTYPLf9VjwyTRRtSA_wZa0-JO6ZDGX4C37oQY&lib=MGciPZN8uiL6VBPzX9GJbWd_p82Qk_FaP";
const INFRASTRUCTURE_SHEET_NAME = "תמונת מצב הסבת תשתיות";
const INTERESTS_SHEET_NAME = "תמונת מצב אינטרסים";
const FILE_LOCATOR_SHEET_NAME = "איתור קבצים ה-30";
const FILE_LOCATOR_COLUMN_O_NAME = "ניתוב לתיקייה";
const INTERESTS_KPI_LABELS = Object.freeze([
  "סך שכבות אינטרסים גופי תשתית",
  "סך גבולות שיפוט רשויות משרד הפנים",
  "סך אינטרסים כללי במערכת תת\"ל"
]);

let interestsRows = [];
let interestsColumns = ["עמודה A", "עמודה B", "עמודה C", "עמודה D"];
let interestsTypePieChart = null, interestsYearChart = null;

let chart1 = null, chart2 = null, chart3 = null, expertsChart = null, pniyotChart = null, overviewWeeklyProjectsChart = null;

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function getFirstDefinedValue(row, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        return value;
      }
    }
  }
  return "";
}
function getRowDate(row, ...keys) {
  return parseDate(getFirstDefinedValue(row, ...keys));
}
function getMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split("-");
  return `${m}-${y}`;
}
function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}
function trimRowKeys(row) {
  return Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [String(key).trim(), value])
  );
}

function isEmptyCell(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function rowHasAnyValue(row) {
  return Object.values(row || {}).some(value => !isEmptyCell(value));
}

function getColumnOValue(row) {
  if (!row) return "";
  if (Object.prototype.hasOwnProperty.call(row, FILE_LOCATOR_COLUMN_O_NAME)) {
    return row[FILE_LOCATOR_COLUMN_O_NAME];
  }
  const keys = Object.keys(row);
  return keys.length >= 15 ? row[keys[14]] : "";
}

function countEmptyColumnORows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(rowHasAnyValue)
    .filter(row => isEmptyCell(getColumnOValue(row)))
    .length;
}
function getGeomSourceRows(originalPayload, conversionRows) {
  const originalRows = (Array.isArray(originalPayload)
    ? originalPayload
    : Array.isArray(originalPayload?.data)
      ? originalPayload.data
      : []
  ).map(trimRowKeys);

  const candidates = [originalRows, conversionRows];
  return candidates.find(rows => rows.some(row => row["תאריך סיום"] && (
    "נקודות (כמות)" in row ||
    "קווים (כמות)" in row ||
    'קווים (אורך בק"מ)' in row ||
    "מצולעים (כמות)" in row
  ))) || [];
}
function normalizeType2(value) {
  const v = String(value || "").trim();
  return v || "ללא סוג";
}
function destroyConversionCharts() {
  [chart1, chart2, chart3, expertsChart, pniyotChart, overviewWeeklyProjectsChart].forEach(c => { if (c) c.destroy(); });
}

function normalizeExpertName(value) {
  const v = String(value || "").trim();
  return v || "ללא שם";
}

function renderExpertsDashboard(rows, convertedLayerRows = []) {
  const summaryEl = document.getElementById("expertsSummary");
  if (!summaryEl) return;

  const counts = {};
  const cutoffDate = new Date("2026-01-01T00:00:00");

  for (const row of rows) {
    const endDate = getRowDate(row, "תאריך סיום", "תאריך סיום ");
    if (!endDate || endDate < cutoffDate) continue;

    const expert = normalizeExpertName(
      getFirstDefinedValue(row, "שם מידען", "שם המידען", "מבצע המשימה")
    );
    counts[expert] = (counts[expert] || 0) + 1;
  }

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he"));

  const totalLayers = entries.reduce((sum, [, count]) => sum + count, 0);
  const totalExperts = entries.length;
  const avgLayersPerExpert = totalExperts ? totalLayers / totalExperts : 0;

  const convertedSinceCutoff = (Array.isArray(convertedLayerRows) ? convertedLayerRows : [])
    .map(row => ({ row, endDate: getFinishedDate(row) }))
    .filter(({ endDate }) => endDate && endDate >= cutoffDate);

  const totalConvertedLayersSince2026 = convertedSinceCutoff.reduce(
    (sum, { row }) => sum + getLayerCount(row),
    0
  );

  const layerEndDates = convertedSinceCutoff.map(({ endDate }) => endDate);
  const taskEndDates = (Array.isArray(rows) ? rows : [])
    .map(row => getRowDate(row, "תאריך סיום", "תאריך סיום "))
    .filter(date => date && date >= cutoffDate);
  const endDates = [...taskEndDates, ...layerEndDates];
  const latestEndDate = endDates.length
    ? new Date(Math.max(...endDates.map(date => date.getTime())))
    : cutoffDate;
  const elapsedDays = Math.max(1, Math.ceil((latestEndDate - cutoffDate) / (1000 * 60 * 60 * 24)) + 1);
  const elapsedWeeks = Math.max(1, elapsedDays / 7);
  const elapsedMonths = Math.max(1, elapsedDays / 30.4375);
  const weeklyAvgLayersPerExpert = avgLayersPerExpert / elapsedWeeks;
  const monthlyAvgLayersPerExpert = avgLayersPerExpert / elapsedMonths;
  const avgConvertedLayersPerMonthSince2026 = totalConvertedLayersSince2026 / elapsedMonths;

  summaryEl.innerHTML = `
    <div class="s-stats">
      <div class="s-stat">
        <div class="s-val blue">${totalLayers.toLocaleString("he-IL")}</div>
        <div class="s-label">גופים שהוסבו מאז 01/01/2026</div>
      </div>
      <div class="s-stat">
        <div class="s-val teal">${totalExperts.toLocaleString("he-IL")}</div>
        <div class="s-label">מידענים פעילים מאז 01/01/2026</div>
      </div>
      <div class="s-stat">
        <div class="s-val purple">${totalConvertedLayersSince2026.toLocaleString("he-IL")}</div>
        <div class="s-label">סה״כ שכבות שהוסבו מאז 01/01/2026</div>
      </div>
      <div class="s-stat">
        <div class="s-val purple">${avgConvertedLayersPerMonthSince2026.toFixed(1)}</div>
        <div class="s-label">ממוצע חודשי שכבות שהוסבו מאז 01/01/2026</div>
      </div>
      <div class="s-stat">
        <div class="s-val green">${avgLayersPerExpert.toFixed(1)}</div>
        <div class="s-label">ממוצע שכבות למידען</div>
      </div>
      <div class="s-stat">
        <div class="s-val green">${weeklyAvgLayersPerExpert.toFixed(1)}</div>
        <div class="s-label">ממוצע שבועי שכבות למידען</div>
      </div>
      <div class="s-stat">
        <div class="s-val green">${monthlyAvgLayersPerExpert.toFixed(1)}</div>
        <div class="s-label">ממוצע חודשי שכבות למידען</div>
      </div>

    </div>
  `;

  if (expertsChart) expertsChart.destroy();
  expertsChart = new Chart(document.getElementById("expertsChart"), {
    type: "bar",
    data: {
      labels: entries.map(([name]) => name),
      datasets: [{
        label: "שכבות שהוסבו מאז 1/1/2026",
        data: entries.map(([, count]) => count),
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 42
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw.toLocaleString("he-IL")} שכבות`
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { ticks: { autoSkip: false } }
      }
    }
  });
}

function isPniyaOrgName(value) {
  if (value === null || value === undefined) return false;
  return /^\d+$/.test(String(value).trim());
}

function pniyaMonthKey(value) {
  const d = parseDate(value);
  if (!d) return null;
  const minDate = new Date("2026-01-01T00:00:00");
  if (d < minDate) return null;
  return getMonthKey(d);
}

function normalizePniyaStatus(value) {
  const v = String(value || "").trim();
  return v || "אחר";
}

function renderPniyotDashboard(rows) {
  const summaryEl = document.getElementById("pniyotSummary");
  if (!summaryEl) return;

  const pniyotRows = (Array.isArray(rows) ? rows : []).filter(row => isPniyaOrgName(row["שם הארגון"]));
  const filteredRows = pniyotRows.filter(row => pniyaMonthKey(getFirstDefinedValue(row, "תאריך תחילה", "תאריך תחילה ")));

  const byMonthStatus = {};
  const statusesSet = new Set();

  filteredRows.forEach(row => {
    const month = pniyaMonthKey(getFirstDefinedValue(row, "תאריך תחילה", "תאריך תחילה "));
    if (!month) return;

    const status = normalizePniyaStatus(row["סטטוס"]);
    statusesSet.add(status);

    if (!byMonthStatus[month]) byMonthStatus[month] = {};
    byMonthStatus[month][status] = (byMonthStatus[month][status] || 0) + 1;
  });

  const months = Object.keys(byMonthStatus).sort();
  const statuses = Array.from(statusesSet).sort((a, b) => a.localeCompare(b, "he"));
  const totalPniyot = pniyotRows.length;

  const topStatusEntry = statuses
    .map(status => [status, filteredRows.filter(r => normalizePniyaStatus(r["סטטוס"]) === status).length])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he"))[0] || ["—", 0];

  summaryEl.innerHTML = `
    <div class="s-stats">
      <div class="s-stat">
        <div class="s-val blue">${filteredRows.length.toLocaleString("he-IL")}</div>
        <div class="s-label">פניות מאז 2026</div>
      </div>
      <div class="s-stat">
        <div class="s-val green">${months.length.toLocaleString("he-IL")}</div>
        <div class="s-label">חודשים עם פעילות</div>
      </div>
    
    </div>
  `;

  const statusColors = {
    "הסתיימה": "rgba(5,150,105,.85)",
    "פעילה": "rgba(59,130,246,.85)",
    "השהייה": "rgba(217,119,6,.85)",
    "אחר": "rgba(107,114,128,.85)"
  };
  const fallbackColors = [
    "rgba(139,92,246,.85)",
    "rgba(20,184,166,.85)",
    "rgba(249,115,22,.85)",
    "rgba(236,72,153,.85)",
    "rgba(34,197,94,.85)",
    "rgba(239,68,68,.85)"
  ];

  const datasets = statuses.map((status, idx) => ({
    label: status,
    data: months.map(month => byMonthStatus[month]?.[status] || 0),
    backgroundColor: statusColors[status] || fallbackColors[idx % fallbackColors.length],
    borderRadius: 6,
    maxBarThickness: 44
  }));

  if (pniyotChart) pniyotChart.destroy();

  pniyotChart = new Chart(document.getElementById("pniyotChart"), {
    type: "bar",
    data: {
      labels: months.map(formatMonthLabel),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 14 } }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}


const TASK_SHEET_NAME = "מסך ניהול משימות";
const Q2_SHEET_NAME = "רישום תשתיות לפי יישויות - Q2";

function normalizeApiRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(trimRowKeys);
}

function getFinishedDate(row) {
  return getRowDate(row, "תאריך סיום", "תאריך יצירה", "תאריך", "חודש");
}

function getLayerCount(row) {
  return toNumber(getFirstDefinedValue(
    row,
    "כמות שכבות בקובץ",
    "כמות שכבות",
    "count"
  )) || 1;
}

function getGeomSum(row) {
  return (
    toNumber(getFirstDefinedValue(row, "נקודות (כמות)", "נקודות")) +
    toNumber(getFirstDefinedValue(row, "קווים (כמות)", "קווים")) +
    toNumber(getFirstDefinedValue(row, 'קווים (אורך בק"מ)', 'קווים (אורך בקמ)', "אורך קווים")) +
    toNumber(getFirstDefinedValue(row, "מצולעים (כמות)", "מצולעים"))
  );
}

function getTaskDate(row, ...keys) {
  return parseTaskDate(getTaskField(row, ...keys));
}

function getSundayWeekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function formatShortDate(date) {
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

function formatWeekLabel(weekStart, cutoffDate) {
  const labelStart = weekStart < cutoffDate ? cutoffDate : weekStart;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `${formatShortDate(weekEnd)}–${formatShortDate(labelStart)}`;
}

function addWeek(map, date, cutoffDate) {
  if (!date || date < cutoffDate) return null;
  const weekStart = getSundayWeekStart(date);
  const key = weekStart.toISOString().slice(0, 10);
  map[key] = (map[key] || 0) + 1;
  return weekStart;
}

function renderOverviewWeeklyProjectsChart(rows) {
  const canvas = document.getElementById('overviewWeeklyProjectsChart');
  if (!canvas || !window.Chart) return;

  if (overviewWeeklyProjectsChart) overviewWeeklyProjectsChart.destroy();

  const cutoffDate = new Date(2026, 0, 1);
  const incomingByWeek = {};
  const completedByWeek = {};
  let maxDate = cutoffDate;

  for (const row of (Array.isArray(rows) ? rows : [])) {
    const startDate = getTaskDate(row, 'תאריך התחלה', 'תאריך התחלה ', 'תאריך תחילה', 'תאריך תחילה ');
    const endDate = getTaskDate(row, 'תאריך סיום', 'תאריך סיום ');

    if (addWeek(incomingByWeek, startDate, cutoffDate) && startDate > maxDate) maxDate = startDate;
    if (addWeek(completedByWeek, endDate, cutoffDate) && endDate > maxDate) maxDate = endDate;
  }

  const firstWeek = getSundayWeekStart(cutoffDate);
  const lastWeek = getSundayWeekStart(maxDate);
  const weekStarts = [];
  for (let d = new Date(firstWeek); d <= lastWeek; d.setDate(d.getDate() + 7)) {
    weekStarts.push(new Date(d));
  }
const ctx = canvas.getContext('2d');

// subtle gradient fill
const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

  overviewWeeklyProjectsChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: weekStarts.map(d => formatWeekLabel(d, cutoffDate)),
    datasets: [
  {
    label: 'פרויקטים שהושלמו',
    data: weekStarts.map(d => completedByWeek[d.toISOString().slice(0, 10)] || 0),

    borderColor: C.green,
    backgroundColor: gradient,

    borderWidth: 3,
    tension: 0.35,              // smoother curve
    fill: true,                 // enables gradient

    pointRadius: 3,
    pointHoverRadius: 6,
    pointBackgroundColor: C.green,
    pointBorderWidth: 2,
    pointBorderColor: '#fff',

    hitRadius: 12               // easier hover
  }
]
    },
 options: {
  responsive: true,
  maintainAspectRatio: false,

  interaction: {
    mode: 'index',
    intersect: false
  },

  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 14
      }
    },
    tooltip: {
      backgroundColor: '#111827',
      titleColor: '#fff',
      bodyColor: '#e5e7eb',
      padding: 10,
      displayColors: false,
      callbacks: {
        label: ctx => `${ctx.dataset.label}: ${Number(ctx.raw || 0).toLocaleString('he-IL')}`
      }
    }
  },

  scales: {
    x: {
      grid: { display: false },
      ticks: {
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 8
      }
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0 },
      grid: {
        color: 'rgba(0,0,0,0.05)'
      }
    }
  }
}
  });
}


async function loadConversionDashboard() {
  const errorEl = document.getElementById("conversionError");
  setConversionLoadingState();

  try {
    const res = await fetch(CONVERSION_API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    const taskRows = normalizeApiRows(json[TASK_SHEET_NAME]);
    const q2Rows = normalizeApiRows(json[Q2_SHEET_NAME]);
    if (!taskRows.length) {
      throw new Error(`Sheet "${TASK_SHEET_NAME}" not found or empty.`);
    }
    if (!q2Rows.length) {
      throw new Error(`Sheet "${Q2_SHEET_NAME}" not found or empty.`);
    }

    const finishedTaskRows = taskRows.filter(row => getRowDate(row, "תאריך סיום", "תאריך סיום "));
    const finishedQ2Rows = q2Rows.filter(row => getFinishedDate(row));

    const byMonthProjects = {};
    const byMonthGeoms = {};
    const byTypeAndMonth = {};
    const monthsSet = new Set();

    for (const row of finishedQ2Rows) {
      const endDate = getFinishedDate(row);
      if (!endDate) continue;

      const month = getMonthKey(endDate);
      const type = normalizeType2(getFirstDefinedValue(row, "סוג תשתית"));
      const layerCount = getLayerCount(row);
      const geomSum = getGeomSum(row);

      monthsSet.add(month);
      byMonthProjects[month] = (byMonthProjects[month] || 0) + layerCount;

      if (!byTypeAndMonth[type]) byTypeAndMonth[type] = {};
      byTypeAndMonth[type][month] = (byTypeAndMonth[type][month] || 0) + layerCount;

      byMonthGeoms[month] = (byMonthGeoms[month] || 0) + geomSum;
    }

    const months = Array.from(monthsSet).sort();
    const labels = months.map(formatMonthLabel);

    destroyConversionCharts();

    chart1 = new Chart(document.getElementById("projectsByMonthChart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "שכבות",
          data: months.map(m => byMonthProjects[m] || 0),
          borderWidth: 3,
          tension: 0.25,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 14 } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    chart2 = new Chart(document.getElementById("projectsByMonthTypeChart"), {
      type: "bar",
      data: {
        labels,
        datasets: Object.keys(byTypeAndMonth)
          .sort((a, b) => a.localeCompare(b, "he"))
          .map(type => ({
            label: type,
            data: months.map(m => byTypeAndMonth[type][m] || 0),
            borderWidth: 1
          }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 14 } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    chart3 = new Chart(document.getElementById("geomsByMonthChart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: 'סה"כ יחידות גיאומטריות',
          data: months.map(m => byMonthGeoms[m] || 0),
          borderWidth: 3,
          tension: 0.25,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 14 } } },
        scales: { y: { beginAtZero: true } }
      }
    });

    renderOverviewWeeklyProjectsChart(taskRows);
    renderExpertsDashboard(finishedTaskRows, finishedQ2Rows);
    renderPniyotDashboard(taskRows);
    renderWorkDashboard(taskRows);
    clearConversionLoadingState();
  } catch (err) {
    setChartWidgetsLoading(CONVERSION_CHART_IDS, false);
    if (errorEl) errorEl.textContent = "שגיאה בטעינת הנתונים: " + err.message;
    console.error(err);
  }
}


let avgDurationChart = null, qualityChart = null, workloadChart = null, projectTimelineChart = null;

function getTaskField(row, ...keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}
function normalizeTaskExpert(value) {
  const v = String(value || '').trim();
  return v || 'ללא שם';
}
function normalizeTaskStatus(value) {
  return String(value || '').trim();
}
function parseTaskDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;

  // Excel serial date, e.g. 45847
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (!Number.isFinite(serial) || serial <= 0) return null;
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + serial * 86400000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // d/m/y or d\m\y
  const normalized = s.replace(/\\/g, '/');
  const dmy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }

  // ISO / yyyy-mm-dd
  const iso = new Date(s);
  if (Number.isNaN(iso.getTime())) return null;
  if (iso.getFullYear() < 2000 || iso.getFullYear() > 2100) return null;
  return iso;
}
function diffDays(start, end) {
  return (end - start) / (1000 * 60 * 60 * 24);
}
function isReasonableDuration(days) {
  return Number.isFinite(days) && days >= 0 && days <= 365;
}
function normalizeProjectKind(value) {
  const v = String(value || '').trim();
  if (v.includes('תמיכה')) return 'תמיכה טכנית';
  if (v.includes('תשת')) return 'תשתיות';
  return '';
}
function isRelevantQualityStatus(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  if (v === 'תמיכה טכנית - לא רלוונטי') return false;
  if (v === 'טרם נבדק') return false;
  return true;
}
function isValidQualityStatus(value) {
  return String(value || '').includes('נבדק ותקין');
}
function destroyWorkCharts() {
  [avgDurationChart, qualityChart, workloadChart, projectTimelineChart].forEach(c => { if (c) c.destroy(); });
}
function renderWorkDashboard(rows) {
  const summaryEl = document.getElementById('workSummary');
  if (!summaryEl) return;

  const durationByExpert = {};
  const qualityByExpert = {};
  const workloadByExpert = {};
  const projectByMonth = { 'תשתיות': {}, 'תמיכה טכנית': {} };
  const allMonths = new Set();

  let totalDuration = 0;
  let totalDurationCount = 0;
  let totalRelevantQuality = 0;
  let totalValidQuality = 0;
  let totalOpenTasks = 0;

  for (const row of (Array.isArray(rows) ? rows : [])) {
    const expert = normalizeTaskExpert(getTaskField(row, 'מבצע המשימה'));
    const startDate = parseTaskDate(getTaskField(row, 'תאריך תחילה', 'תאריך תחילה '));
    const endDate = parseTaskDate(getTaskField(row, 'תאריך סיום', 'תאריך סיום '));
    const taskStatus = normalizeTaskStatus(getTaskField(row, 'סטטוס'));
    const qaStatus = normalizeTaskStatus(getTaskField(row, 'סטטוס לבדיקה'));
    const projectKind = normalizeProjectKind(getTaskField(row, 'פרויקט משימה'));

    if (startDate && endDate) {
      const days = diffDays(startDate, endDate);
      if (isReasonableDuration(days)) {
        if (!durationByExpert[expert]) durationByExpert[expert] = { total: 0, count: 0 };
        durationByExpert[expert].total += days;
        durationByExpert[expert].count += 1;
        totalDuration += days;
        totalDurationCount += 1;
      }
    }

    if (isRelevantQualityStatus(qaStatus)) {
      if (!qualityByExpert[expert]) qualityByExpert[expert] = { valid: 0, total: 0 };
      qualityByExpert[expert].total += 1;
      totalRelevantQuality += 1;
      if (isValidQualityStatus(qaStatus)) {
        qualityByExpert[expert].valid += 1;
        totalValidQuality += 1;
      }
    }

    if (!workloadByExpert[expert]) workloadByExpert[expert] = { active: 0, paused: 0, broken: 0 };
    if (taskStatus === 'פעילה') {
      workloadByExpert[expert].active += 1;
      totalOpenTasks += 1;
    } else if (taskStatus === 'השהייה') {
      workloadByExpert[expert].paused += 1;
      totalOpenTasks += 1;
    } else if (taskStatus === 'תקול') {
      workloadByExpert[expert].broken += 1;
      totalOpenTasks += 1;
    }

    if (endDate && projectKind) {
      const month = getMonthKey(endDate);
      allMonths.add(month);
      projectByMonth[projectKind][month] = (projectByMonth[projectKind][month] || 0) + 1;
    }
  }

  const avgDuration = totalDurationCount ? totalDuration / totalDurationCount : 0;
  const validPct = totalRelevantQuality ? (totalValidQuality / totalRelevantQuality) * 100 : 0;
  const totalExpertOpenLoad = Object.values(workloadByExpert)
    .reduce((sum, obj) => sum + (obj.active || 0) + (obj.paused || 0) + (obj.broken || 0), 0);

  summaryEl.innerHTML = `
    <div class="s-stats">
      <div class="s-stat">
        <div class="s-val blue">${avgDuration.toFixed(1)}</div>
        <div class="s-label">ימי הסבה ממוצעים למשימה</div>
      </div>
      <div class="s-stat">
        <div class="s-val green">${validPct.toFixed(0)}%</div>
        <div class="s-label">משימות שעבר בדיקת תקינות מתוך משימות שנבדקו</div>
      </div>
      
      <div class="s-stat">
        <div class="s-val teal">${totalExpertOpenLoad.toLocaleString('he-IL')}</div>
        <div class="s-label">עומס פתוח אצל המידענים</div>
      </div>
    </div>`;

  destroyWorkCharts();

  const durationEntries = Object.entries(durationByExpert)
    .map(([name, obj]) => ([name, obj.count ? obj.total / obj.count : 0]))
    .filter(([, value]) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'));

  avgDurationChart = new Chart(document.getElementById('avgDurationChart'), {
    type: 'bar',
    data: {
      labels: durationEntries.map(([name]) => name),
      datasets: [{
        label: 'ימי הסבה ממוצעים',
        data: durationEntries.map(([, value]) => value > 0 ? Number(value.toFixed(2)) : 0.1),
        rawDurations: durationEntries.map(([, value]) => Number(value.toFixed(2))),
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 42
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const raw = ctx.dataset.rawDurations?.[ctx.dataIndex] ?? ctx.raw;
              return `ימי הסבה ממוצעים: ${raw.toLocaleString('he-IL')}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0.1,
          ticks: {
            callback(value) {
              if (value === 0.1) return '0';
              return Number(value).toLocaleString('he-IL');
            }
          }
        }
      }
    }
  });

  const qualityEntries = Object.entries(qualityByExpert)
    .filter(([, obj]) => obj.total > 0)
    .map(([name, obj]) => ([name, (obj.valid / obj.total) * 100]))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'));

  qualityChart = new Chart(document.getElementById('qualityChart'), {
    type: 'bar',
    data: {
      labels: qualityEntries.map(([name]) => name),
      datasets: [{
        label: '% תקין',
        data: qualityEntries.map(([, value]) => Number(value.toFixed(1))),
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 42
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw.toFixed(1)}% תקין` } }
      },
      scales: { x: { beginAtZero: true, max: 100 } }
    }
  });

  const workloadEntries = Object.entries(workloadByExpert)
    .map(([name, obj]) => ([name, obj]))
    .filter(([, obj]) => obj.active > 0 || obj.paused > 0 || obj.broken > 0)
    .sort((a, b) => (b[1].active + b[1].paused + b[1].broken) - (a[1].active + a[1].paused + a[1].broken) || a[0].localeCompare(b[0], 'he'));

  workloadChart = new Chart(document.getElementById('workloadChart'), {
    type: 'bar',
    data: {
      labels: workloadEntries.map(([name]) => name),
   datasets: [
  {
    label: 'פעילה',
    data: Object.values(workloadByExpert).map(x => x.active),
    backgroundColor: 'rgba(59,130,246,.85)', // blue
    borderRadius: 6
  },
  {
    label: 'השהייה',
    data: Object.values(workloadByExpert).map(x => x.paused),
    backgroundColor: 'rgba(217,119,6,.85)', // 🔴 red (switched)
    borderRadius: 6
    
  },
  {
    label: 'תקול',
    data: Object.values(workloadByExpert).map(x => x.broken),
    backgroundColor: 'rgba(220,38,38,.85)', // 🟠 orange (switched)
    borderRadius: 6
  }
]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true, stacked: true, ticks: { precision: 0 } }, y: { stacked: true } },
      plugins: { legend: { display: true, position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 14 } } }
    }
  });

  const months = Array.from(allMonths).sort();
  projectTimelineChart = new Chart(document.getElementById('projectTimelineChart'), {
    type: 'line',
    data: {
      labels: months.map(formatMonthLabel),
      datasets: [
        { label: 'תשתיות', data: months.map(m => projectByMonth['תשתיות'][m] || 0), borderWidth: 3, tension: 0.25, fill: false },
        { label: 'תמיכה טכנית', data: months.map(m => projectByMonth['תמיכה טכנית'][m] || 0), borderWidth: 3, tension: 0.25, fill: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: true, position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 14 } } }
    }
  });
}
