// admin/js/admin.js — NEU Library Admin v2

const API = '/api';

// ─── CHART DEFAULTS ───────────────────────────────────────────────────────────
Chart.defaults.color = 'rgba(255,255,255,0.3)';
Chart.defaults.font.family = "'Sora', sans-serif";
Chart.defaults.font.size = 12;

const COLORS = {
  blue:   'rgba(74,158,255,0.85)',
  gold:   'rgba(240,192,64,0.85)',
  green:  'rgba(74,222,128,0.85)',
  purple: 'rgba(167,139,250,0.85)',
  red:    'rgba(248,113,113,0.85)',
};
const PURPOSE_COLORS = [COLORS.blue, COLORS.gold, COLORS.green, COLORS.purple];

let chartByDay, chartByPurpose, chartByHour, chartByCollege;
let currentRange = 'today';
let customStart = null, customEnd = null;
let allLogs = [], allStudents = [];
let currentStatsCache = null;

// ─── DATE RANGE ───────────────────────────────────────────────────────────────
function getDateRange(range) {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  if (range === 'today')  return { start: fmt(today), end: fmt(today) };
  if (range === 'week')   { const s = new Date(today); s.setDate(today.getDate()-6); return { start: fmt(s), end: fmt(today) }; }
  if (range === 'month')  return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end: fmt(today) };
  if (range === 'custom') return { start: customStart, end: customEnd };
}

// ─── FETCH ────────────────────────────────────────────────────────────────────
const fetchStats       = (s, e) => fetch(`${API}/stats?start=${s}&end=${e}`).then(r => r.json());
const fetchLogs        = ()     => fetch(`${API}/logs?limit=500`).then(r => r.json());
const fetchTopVisitors = (s, e) => fetch(`${API}/top-visitors?start=${s}&end=${e}`).then(r => r.json());
const fetchStudents    = ()     => fetch(`${API}/students`).then(r => r.json());

// ─── CUSTOM SELECT / FILTERS ──────────────────────────────────────────────────
let activeFilters = { purpose: '', college: '', employee_type: '' };

function getFilterParams() {
  const params = new URLSearchParams();
  const { start, end } = getDateRange(currentRange);
  if (currentRange === 'today')       params.set('period', 'today');
  else if (currentRange === 'week')   params.set('period', 'week');
  else { params.set('start', start);  params.set('end', end); }
  if (activeFilters.purpose)          params.set('purpose', activeFilters.purpose);
  if (activeFilters.college)          params.set('college', activeFilters.college);
  if (activeFilters.employee_type)    params.set('employee_type', activeFilters.employee_type);
  return params.toString();
}

function isFiltered() {
  return activeFilters.purpose || activeFilters.college || activeFilters.employee_type;
}

function updateFilterClearBtn() {
  const btn = document.getElementById('filterClearBtn');
  if (btn) btn.style.display = isFiltered() ? 'inline-flex' : 'none';
}

function initCustomSelect(wrapperId, valueId, filterKey) {
  const wrapper  = document.getElementById(wrapperId);
  if (!wrapper) return;
  const trigger  = wrapper.querySelector('.cs-trigger');
  const dropdown = wrapper.querySelector('.cs-dropdown');
  const valueEl  = document.getElementById(valueId);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close all others
    document.querySelectorAll('.custom-select.open').forEach(el => {
      if (el !== wrapper) el.classList.remove('open');
    });
    wrapper.classList.toggle('open');
  });

  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.cs-option');
    if (!opt) return;
    const val = opt.dataset.value;

    // Update active state
    dropdown.querySelectorAll('.cs-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');

    // Update display
    valueEl.textContent = opt.textContent.replace(/^[^\w]*/, '').trim();
    activeFilters[filterKey] = val;
    wrapper.classList.toggle('has-value', !!val);
    wrapper.classList.remove('open');

    updateFilterClearBtn();
    loadOverview();
  });
}

async function populateCollegeFilter() {
  const students = await fetchStudents();
  const colleges = [...new Set(students.map(s => s.college).filter(Boolean))].sort();
  const list = document.getElementById('csCollegeList');
  if (!list) return;
  list.innerHTML = '<div class="cs-option active" data-value="">All Colleges</div>';
  colleges.forEach(c => {
    const div = document.createElement('div');
    div.className = 'cs-option';
    div.dataset.value = c;
    div.textContent = c;
    list.appendChild(div);
  });
}

function initFilters() {
  populateCollegeFilter();
  initCustomSelect('csPurpose',     'csPurposeVal',     'purpose');
  initCustomSelect('csCollege',     'csCollegeVal',     'college');
  initCustomSelect('csVisitorType', 'csVisitorTypeVal', 'employee_type');

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
  });

  // Clear all filters
  document.getElementById('filterClearBtn')?.addEventListener('click', () => {
    activeFilters = { purpose: '', college: '', employee_type: '' };
    [
      { id: 'csPurpose',     valId: 'csPurposeVal',     def: 'All Purposes' },
      { id: 'csCollege',     valId: 'csCollegeVal',     def: 'All Colleges' },
      { id: 'csVisitorType', valId: 'csVisitorTypeVal', def: 'All Visitors' },
    ].forEach(({ id, valId, def }) => {
      const w = document.getElementById(id);
      if (w) {
        w.classList.remove('has-value', 'open');
        w.querySelectorAll('.cs-option').forEach((o, i) => o.classList.toggle('active', i === 0));
      }
      const v = document.getElementById(valId);
      if (v) v.textContent = def;
    });
    updateFilterClearBtn();
    loadOverview();
  });
}

// ─── OVERVIEW ────────────────────────────────────────────────────────────────
async function loadOverview() {
  const { start, end } = getDateRange(currentRange);

  let stats;
  if (isFiltered()) {
    const res      = await fetch(`${API}/stats/filtered?${getFilterParams()}`);
    const filtered = await res.json();
    stats = {
      totalVisits:    filtered.totalVisits,
      uniqueVisitors: '—',
      byPurpose:      filtered.byPurpose,
      byCollege:      filtered.byCollege,
      byDay:          filtered.byDay.map(r => ({ visit_date: r.date, count: r.count })),
      byHour:         [],
    };
  } else {
    stats = await fetchStats(start, end);
  }

  currentStatsCache = { stats, start, end };

  document.getElementById('statTotal').textContent      = stats.totalVisits;
  document.getElementById('statUnique').textContent     = isFiltered() ? '—' : stats.uniqueVisitors;
  document.getElementById('statTopPurpose').textContent = stats.byPurpose[0]?.purpose || '—';
  document.getElementById('statTopCollege').textContent = abbr(stats.byCollege[0]?.college || '—');

  renderChartDay(stats.byDay, start, end);
  renderChartPurpose(stats.byPurpose);
  if (!isFiltered()) renderChartHour(stats.byHour);
  renderChartCollege(stats.byCollege);
}

function abbr(s) {
  return s.replace(/College of /i,'').replace(/Administration/i,'Admin').replace(/Informatics and Computing Studies/i,'Informatics');
}

// ─── CHARTS ──────────────────────────────────────────────────────────────────
const gridColor = 'rgba(255,255,255,0.04)';
const tickColor = 'rgba(255,255,255,0.25)';

function renderChartDay(data, start, end) {
  const dates = [], d = new Date(start), ed = new Date(end);
  while (d <= ed) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }
  const map = Object.fromEntries(data.map(r => [r.visit_date, r.count]));
  const labels = dates.map(d => new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}));

  if (chartByDay) chartByDay.destroy();
  chartByDay = new Chart(document.getElementById('chartByDay'), {
    type: 'bar',
    data: { labels, datasets: [{ label:'Visits', data: dates.map(d=>map[d]||0),
      backgroundColor: 'rgba(74,158,255,0.2)', borderColor: 'rgba(74,158,255,0.9)',
      borderWidth: 2, borderRadius: 6 }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend: { display:false } },
      scales: {
        x: { grid:{color:gridColor}, ticks:{color:tickColor} },
        y: { grid:{color:gridColor}, ticks:{color:tickColor, stepSize:1}, beginAtZero:true }
      }}
  });
}

function renderChartPurpose(data) {
  if (chartByPurpose) chartByPurpose.destroy();
  chartByPurpose = new Chart(document.getElementById('chartByPurpose'), {
    type: 'doughnut',
    data: { labels: data.map(d=>d.purpose), datasets:[{ data:data.map(d=>d.count),
      backgroundColor: PURPOSE_COLORS, borderWidth:0, hoverOffset:8 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins: { legend:{ position:'bottom', labels:{ padding:12, color:'rgba(255,255,255,0.4)', font:{size:11} } } }}
  });
}

function renderChartHour(data) {
  const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
  const map = Object.fromEntries(data.map(r=>[r.hour,r.count]));
  const labels = hours.map(h => { const n=parseInt(h); return n===0?'12am':n<12?`${n}am`:n===12?'12pm':`${n-12}pm`; });

  if (chartByHour) chartByHour.destroy();
  chartByHour = new Chart(document.getElementById('chartByHour'), {
    type: 'line',
    data: { labels, datasets:[{ label:'Visits', data:hours.map(h=>map[h]||0),
      borderColor:'rgba(167,139,250,0.9)', backgroundColor:'rgba(167,139,250,0.08)',
      borderWidth:2, fill:true, tension:0.4, pointRadius:2, pointHoverRadius:5 }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales: {
        x:{ grid:{color:gridColor}, ticks:{color:tickColor, maxTicksLimit:12} },
        y:{ grid:{color:gridColor}, ticks:{color:tickColor, stepSize:1}, beginAtZero:true }
      }}
  });
}

function renderChartCollege(data) {
  const top = data.slice(0,7);
  if (chartByCollege) chartByCollege.destroy();
  chartByCollege = new Chart(document.getElementById('chartByCollege'), {
    type: 'bar',
    data: { labels: top.map(d=>abbr(d.college)), datasets:[{ label:'Visits', data:top.map(d=>d.count),
      backgroundColor:'rgba(74,222,128,0.15)', borderColor:'rgba(74,222,128,0.8)',
      borderWidth:2, borderRadius:6 }] },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales: {
        x:{ grid:{color:gridColor}, ticks:{color:tickColor, stepSize:1}, beginAtZero:true },
        y:{ grid:{display:false}, ticks:{color:tickColor} }
      }}
  });
}

// ─── LOGS ─────────────────────────────────────────────────────────────────────
async function loadLogs() {
  allLogs = await fetchLogs();
  renderLogs(allLogs);
}

function renderLogs(logs) {
  document.getElementById('logCount').textContent = `${logs.length} entries`;
  const tbody = document.getElementById('logTableBody');
  if (!logs.length) { tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No records found.</td></tr>'; return; }

  tbody.innerHTML = logs.map((r,i) => {
    const typeClass = r.type?.toLowerCase() === 'faculty' ? 'badge-faculty' : 'badge-student';
    return `<tr>
      <td style="color:var(--text-3);font-family:var(--mono);font-size:11px">${i+1}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text-3)">${r.school_id}</td>
      <td style="font-weight:600">${r.name}</td>
      <td style="color:var(--text-2);max-width:200px;overflow:hidden;text-overflow:ellipsis">${r.college}</td>
      <td><span class="badge ${typeClass}">${r.type||'Student'}</span></td>
      <td style="color:var(--text-2)">${r.purpose}</td>
      <td style="font-family:var(--mono);font-size:11px">${r.visit_date}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text-3)">${r.visit_time}</td>
    </tr>`;
  }).join('');
}

document.getElementById('logSearch').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  renderLogs(allLogs.filter(r => r.name.toLowerCase().includes(q) || r.college.toLowerCase().includes(q) || r.purpose.toLowerCase().includes(q)));
});

// ─── TOP VISITORS ─────────────────────────────────────────────────────────────
async function loadTopVisitors() {
  const { start, end } = getDateRange(currentRange);
  const visitors = await fetchTopVisitors(start, end);
  const grid = document.getElementById('topVisitorsGrid');

  if (!visitors.length) { grid.innerHTML = '<div class="table-empty">No data for this period.</div>'; return; }

  const medals = ['🥇','🥈','🥉'];
  grid.innerHTML = visitors.map((v,i) => {
    const initials = v.name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('');
    return `<div class="visitor-card" style="animation-delay:${i*0.05}s">
      <div class="visitor-rank">${medals[i]||`#${i+1}`}</div>
      <div class="visitor-avatar">${initials}</div>
      <div class="visitor-info">
        <div class="visitor-name">${v.name}</div>
        <div class="visitor-college">${v.college}</div>
        ${v.current_streak>1?`<div class="visitor-streak">🔥 ${v.current_streak}-day streak</div>`:''}
      </div>
      <div class="visitor-stats">
        <div class="visitor-count-num">${v.visit_count}</div>
        <div class="visitor-count-label">visits</div>
      </div>
    </div>`;
  }).join('');
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
let studentFilter = 'all';

async function loadStudents() {
  allStudents = await fetchStudents();
  renderStudents(allStudents);
}

function renderStudents(students) {
  const filtered = students.filter(s => {
    if (studentFilter === 'blocked') return s.is_blocked;
    if (studentFilter === 'active')  return !s.is_blocked;
    return true;
  });

  document.getElementById('studentCount').textContent = `${filtered.length} students`;
  const tbody = document.getElementById('studentTableBody');

  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No records found.</td></tr>'; return; }

  tbody.innerHTML = filtered.map(s => {
    const typeClass  = s.type?.toLowerCase() === 'faculty' ? 'badge-faculty' : 'badge-student';
    const blocked    = s.is_blocked;
    const lastVisit  = s.last_visit_date ? new Date(s.last_visit_date).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—';
    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text-3)">${s.school_id}</td>
      <td style="font-weight:600">${s.name}</td>
      <td style="color:var(--text-2);max-width:200px;overflow:hidden;text-overflow:ellipsis">${s.college}</td>
      <td><span class="badge ${typeClass}">${s.type||'Student'}</span></td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text-3)">${s.email||'—'}</td>
      <td style="text-align:center;font-weight:700">${s.total_visits||0}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text-3)">${lastVisit}</td>
      <td><span class="badge ${blocked?'badge-blocked':'badge-active'}">${blocked?'Blocked':'Active'}</span></td>
      <td>
        ${blocked
          ? `<button class="btn-unblock" onclick="confirmBlock('${s.school_id}','${s.name}',false)">Unblock</button>`
          : `<button class="btn-block"   onclick="confirmBlock('${s.school_id}','${s.name}',true)">Block</button>`
        }
      </td>
    </tr>`;
  }).join('');
}

// Student search
document.getElementById('studentSearch').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  const filtered = allStudents.filter(s =>
    s.name.toLowerCase().includes(q) || s.school_id.toLowerCase().includes(q) || s.college.toLowerCase().includes(q)
  );
  renderStudents(filtered);
});

// Student filter pills
document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    studentFilter = btn.dataset.filter;
    renderStudents(allStudents);
  });
});

// ─── BLOCK / UNBLOCK ─────────────────────────────────────────────────────────
let pendingBlock = null;

function confirmBlock(schoolId, name, block) {
  pendingBlock = { schoolId, block };
  const overlay  = document.getElementById('blockModalOverlay');
  const icon     = document.getElementById('blockModalIcon');
  const title    = document.getElementById('blockModalTitle');
  const msg      = document.getElementById('blockModalMsg');
  const confirmBtn = document.getElementById('blockModalConfirm');

  if (block) {
    icon.textContent  = '🚫';
    title.textContent = 'Block Visitor';
    msg.textContent   = `Block ${name} from entering the library?`;
    confirmBtn.className = 'modal-btn confirm';
    confirmBtn.textContent = 'Block';
  } else {
    icon.textContent  = '✅';
    title.textContent = 'Unblock Visitor';
    msg.textContent   = `Allow ${name} to enter the library again?`;
    confirmBtn.className = 'modal-btn confirm unblock';
    confirmBtn.textContent = 'Unblock';
  }
  overlay.classList.remove('hidden');
}

document.getElementById('blockModalCancel').addEventListener('click', () => {
  document.getElementById('blockModalOverlay').classList.add('hidden');
  pendingBlock = null;
});

document.getElementById('blockModalConfirm').addEventListener('click', async () => {
  if (!pendingBlock) return;
  document.getElementById('blockModalOverlay').classList.add('hidden');

  await fetch(`${API}/student/${pendingBlock.schoolId}/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ block: pendingBlock.block })
  });

  pendingBlock = null;
  await loadStudents();
});

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
document.getElementById('pdfBtn')?.addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  const startEl = document.getElementById('pdfDateStart');
  const endEl   = document.getElementById('pdfDateEnd');
  const today   = new Date().toISOString().split('T')[0];
  const start   = startEl?.value || today;
  const end     = endEl?.value   || today;
  const stats = await fetchStats(start, end);
  const logs  = allLogs.length ? allLogs : await fetchLogs();

  // Header
  doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text('NEU Library — Visitor Report', 14, 18);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.text(`Period: ${start} to ${end}`, 14, 26);
  doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 32);

  // Summary
  doc.setFontSize(12); doc.setFont('helvetica','bold');
  doc.text('Summary', 14, 44);
  doc.autoTable({
    startY: 48,
    head: [['Metric','Value']],
    body: [
      ['Total Visits', stats.totalVisits],
      ['Unique Visitors', stats.uniqueVisitors],
      ['Top Purpose', stats.byPurpose[0]?.purpose || '—'],
      ['Top College', stats.byCollege[0]?.college || '—'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [30,60,120] },
    margin: { left: 14 },
    tableWidth: 120,
  });

  // Visit logs
  doc.addPage();
  doc.setFontSize(12); doc.setFont('helvetica','bold');
  doc.text('Visitor Logs', 14, 18);
  doc.autoTable({
    startY: 22,
    head: [['#','School ID','Name','College','Type','Purpose','Date','Time']],
    body: logs.map((r,i) => [i+1, r.school_id, r.name, abbr(r.college), r.type||'Student', r.purpose, r.visit_date, r.visit_time]),
    theme: 'striped',
    headStyles: { fillColor: [30,60,120] },
    styles: { fontSize: 9 },
    margin: { left: 14 },
  });

  doc.save(`NEU-Library-Report-${start}-to-${end}.pdf`);
});

// ─── TAB SWITCHING ────────────────────────────────────────────────────────────
const TAB_TITLES = { overview:'Overview', logs:'Visitor Logs', topvisitors:'Top Visitors', students:'Students', reports:'Reports & Settings' };

document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    const tab = item.dataset.tab;
    localStorage.setItem('neu_last_tab', tab);
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    const tabEl = document.getElementById(`tab${cap(tab)}`);
    if (tabEl) tabEl.classList.remove('hidden');
    else console.error('Tab not found:', `tab${cap(tab)}`);
    document.getElementById('pageTitle').textContent = TAB_TITLES[tab] || 'Dashboard';

    // Show/hide date filters
    const showFilters = ['overview','topvisitors'].includes(tab);
    document.getElementById('dateFilters').style.display = showFilters ? '' : 'none';

    if (tab === 'overview')    loadOverview();
    if (tab === 'logs')        loadLogs();
    if (tab === 'topvisitors') loadTopVisitors();
    if (tab === 'students')    loadStudents();
    if (tab === 'overview')    loadHeatmap();
    if (tab === 'reports') {
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('pdfDateStart').value = today;
      document.getElementById('pdfDateEnd').value   = today;
    }
  });
});

// ─── DATE FILTERS ─────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRange = btn.dataset.range;
    localStorage.setItem('neu_last_range', currentRange);
    document.getElementById('customRange').classList.toggle('hidden', currentRange !== 'custom');
    if (currentRange !== 'custom') {
      const tab = document.querySelector('.nav-item.active')?.dataset.tab;
      if (tab === 'overview')    loadOverview();
      if (tab === 'topvisitors') loadTopVisitors();
    }
  });
});

document.getElementById('applyRange').addEventListener('click', () => {
  customStart = document.getElementById('dateStart').value;
  customEnd   = document.getElementById('dateEnd').value;
  if (!customStart || !customEnd) return;
  localStorage.setItem('neu_last_custom_start', customStart);
  localStorage.setItem('neu_last_custom_end', customEnd);
  loadOverview();
});

// ─── SSE REAL-TIME ────────────────────────────────────────────────────────────
(function initRealtime() {
  const es = new EventSource('/api/events');
  es.addEventListener('new-visit', e => {
    const v = JSON.parse(e.data);
    showToast(v);
    document.dispatchEvent(new CustomEvent('neu-new-visit', { detail: v }));
    const tab = document.querySelector('.nav-item.active')?.dataset.tab;
    if (tab === 'overview')    { loadOverview(); loadHeatmap(); }
    if (tab === 'logs')        loadLogs();
    if (tab === 'topvisitors') loadTopVisitors();
  });
})();

function showToast(v) {
  const old = document.getElementById('liveToast');
  if (old) old.remove();
  const typeClass = v.type?.toLowerCase() === 'faculty' ? 'faculty' : '';
  const t = document.createElement('div');
  t.id = 'liveToast'; t.className = 'live-toast';
  t.innerHTML = `
    <div class="toast-dot"></div>
    <div class="toast-info">
      <div class="toast-name">${v.name}</div>
      <div class="toast-detail">${v.purpose} · ${v.visit_time}</div>
    </div>
    <span class="toast-badge ${typeClass}">${v.type}</span>`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast-hide'), 4500);
  setTimeout(() => t.remove(), 5000);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadOverview();

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── HEATMAP ──────────────────────────────────────────────────────────────────
async function loadHeatmap() {
  const today = new Date();
  const year  = today.getFullYear();
  const fmt   = d => d.toISOString().split('T')[0];

  // Fetch full year data
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;
  const { byDay } = await fetchStats(start, end);
  const map = Object.fromEntries(byDay.map(r => [r.visit_date, parseInt(r.count)]));
  const max = Math.max(...Object.values(map), 1);
  const todayStr = fmt(today);

  const wrap = document.getElementById('heatmapWrap');
  if (!wrap) return;

  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  let html = `<div style="display:flex;gap:20px;overflow-x:auto;padding-bottom:8px;">`;

  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const firstDay    = new Date(year, m, 1).getDay();
    const isCurrentMonth = m === today.getMonth();

    html += `<div style="flex-shrink:0;">`;
    // Month label
    html += `<div style="font-size:11px;font-weight:700;letter-spacing:0.5px;color:${isCurrentMonth ? 'var(--blue)' : 'var(--text-3)'};margin-bottom:6px;text-align:center">${monthNames[m]} ${year}</div>`;
    // Day headers
    html += `<div style="display:flex;gap:3px;margin-bottom:3px;">`;
    dayLabels.forEach(d => html += `<div style="width:28px;text-align:center;font-size:9px;color:var(--text-3);font-family:var(--mono)">${d}</div>`);
    html += `</div>`;

    // Weeks
    let dayNum = 1;
    while (dayNum <= daysInMonth) {
      html += `<div style="display:flex;gap:3px;margin-bottom:3px;">`;
      for (let col = 0; col < 7; col++) {
        if ((dayNum === 1 && col < firstDay) || dayNum > daysInMonth) {
          html += `<div style="width:28px;height:28px;"></div>`;
          if (dayNum > daysInMonth) dayNum++;
        } else {
          const dateStr = `${year}-${String(m+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
          const count   = map[dateStr] || 0;
          const isFuture = dateStr > todayStr;
          const lvl = isFuture ? 0 : count === 0 ? 0 : count <= max*0.2 ? 1 : count <= max*0.4 ? 2 : count <= max*0.6 ? 3 : count <= max*0.8 ? 4 : 5;
          const isToday = dateStr === todayStr ? ' today-marker' : '';
          const opacity = isFuture ? 'opacity:0.25;' : '';
          html += `<div class="hm-cell v${lvl}${isToday}" title="${dateStr}: ${count} visit${count!==1?'s':''}" style="width:28px;height:28px;${opacity};font-size:8px">${count > 0 && !isFuture ? count : ''}</div>`;
          dayNum++;
        }
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;

  // Auto scroll to current month
  wrap.innerHTML = html;
  const scrollEl = wrap.querySelector('div');
  if (scrollEl) {
    const monthWidth = 240;
    scrollEl.scrollLeft = today.getMonth() * (monthWidth + 20) - 20;
  }
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────
// ─── SETTINGS CSV ─────────────────────────────────────────────────────────────
async function downloadCSV(logs) {
  const headers = ['#','School ID','Name','College','Type','Purpose','Date','Time'];
  const rows = logs.map((r,i) => [i+1, r.school_id, `"${r.name}"`, `"${r.college}"`, r.type||'Student', r.purpose, r.visit_date, r.visit_time]);
  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `NEU-Library-Logs-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

document.getElementById('csvBtnSettings')?.addEventListener('click', async () => {
  const type = document.querySelector('input[name="csvType"]:checked')?.value || 'all';
  let logs;
  if (type === 'all') {
    logs = allLogs.length ? allLogs : await fetchLogs();
  } else {
    const { start, end } = getDateRange(type === 'today' ? 'today' : type === 'week' ? 'week' : 'month');
    const res = await fetch(`${API}/logs?limit=500`);
    logs = (await res.json()).filter(r => r.visit_date >= start && r.visit_date <= end);
  }
  downloadCSV(logs);
});

// Load heatmap on initial overview
loadHeatmap();

// ─── SETTINGS MODAL SYSTEM ───────────────────────────────────────────────────
const MODAL_TITLES = {
  modalPdf:     { icon: '📄', title: 'Export PDF Report' },
  modalCsv:     { icon: '📊', title: 'Export CSV Spreadsheet' },
  modalAdmin:   { icon: '👤', title: 'Admin Account Management' },
  modalHours:   { icon: '🕐', title: 'Library Hours' },
  modalAnnounce:{ icon: '📢', title: 'Announcements' },
  modalData:    { icon: '🗑️', title: 'Data Management' },
  modalTheme:   { icon: '🎨', title: 'Theme & Display' },
  modalDash:    { icon: '📈', title: 'Dashboard Preferences' },
  modalSys:     { icon: '🏛️', title: 'System Information' },
};

function openSettingsModal(modalId) {
  const overlay = document.getElementById('settingsModalOverlay');
  const content = document.getElementById('settingsModalContent');
  const icon    = document.getElementById('settingsModalIcon');
  const title   = document.getElementById('settingsModalTitle');
  const tmpl    = document.getElementById(modalId);
  if (!tmpl) return;

  const meta = MODAL_TITLES[modalId] || {};
  icon.textContent  = meta.icon  || '⚙️';
  title.textContent = meta.title || 'Settings';
  content.innerHTML = '';
  content.appendChild(tmpl.content.cloneNode(true));

  overlay.classList.remove('hidden');

  // Re-attach event listeners after clone
  wireSettingsListeners();
  loadSettingsValues();
}

function closeSettingsModal() {
  const overlay = document.getElementById('settingsModalOverlay');
  overlay.classList.add('hidden');
}

document.getElementById('settingsModalClose')?.addEventListener('click', closeSettingsModal);
document.getElementById('settingsModalOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('settingsModalOverlay')) closeSettingsModal();
});

// Open modal on card click
document.addEventListener('click', e => {
  const card = e.target.closest('.settings-card[data-modal]');
  if (card) openSettingsModal(card.dataset.modal);
});

// ── Feedback helper ──
function showFeedback(id, msg, type = 'success') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `settings-feedback ${type}`;
  setTimeout(() => el.className = 'settings-feedback hidden', 3000);
}

function loadSettingsValues() {
  // Hours
  const savedHours = JSON.parse(localStorage.getItem('neu_library_hours') || 'null');
  if (savedHours) {
    ['wdOpen','wdClose','satOpen','satClose'].forEach(id => {
      const el = document.getElementById(id);
      if (el && savedHours[id]) el.value = savedHours[id];
    });
    const sun = document.getElementById('sunClosed');
    if (sun) sun.checked = savedHours.sunClosed !== false;
  }

  // Theme
  const savedTheme = JSON.parse(localStorage.getItem('neu_theme') || 'null');
  if (savedTheme) {
    const op = document.getElementById('sidebarOpacity');
    const opVal = document.getElementById('sidebarOpacityVal');
    if (op && savedTheme.opacity) { op.value = savedTheme.opacity; if (opVal) opVal.textContent = savedTheme.opacity + '%'; }
    if (savedTheme.color) {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      const match = document.querySelector(`.color-swatch[data-color="${savedTheme.color}"]`);
      if (match) match.classList.add('active');
    }
  }

  // Dash prefs
  const savedPrefs = JSON.parse(localStorage.getItem('neu_dash_prefs') || 'null');
  if (savedPrefs?.defaultRange) {
    const radio = document.querySelector(`input[name="defRange"][value="${savedPrefs.defaultRange}"]`);
    if (radio) radio.checked = true;
  }

  // Announcement
  fetch('/api/announcement').then(r => r.json()).then(d => {
    const ta = document.getElementById('announcementText');
    const cb = document.getElementById('announcementEnabled');
    if (ta && d.text) ta.value = d.text;
    if (cb && d.enabled) cb.checked = d.enabled;
  }).catch(() => {});
}

function btnFeedback(btn, msg, type = 'success') {
  if (!btn) return;
  // Save original text before first call (loading state)
  if (!btn._origText) btn._origText = btn.textContent;
  btn.textContent = msg;
  btn.style.background = type === 'error'   ? 'rgba(248,113,113,0.85)' :
                         type === 'loading'  ? 'rgba(255,255,255,0.08)' :
                                               'rgba(74,222,128,0.85)';
  if (type !== 'loading') setTimeout(() => {
    btn.textContent = btn._origText;
    btn._origText = null;
    btn.style.background = '';
  }, 2500);
}

function wireSettingsListeners() {
  // PDF
  document.getElementById('pdfBtn')?.addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const startEl = document.getElementById('pdfDateStart');
    const endEl   = document.getElementById('pdfDateEnd');
    const today   = new Date().toISOString().split('T')[0];
    const start   = startEl?.value || today;
    const end     = endEl?.value   || today;
    const stats   = await fetchStats(start, end);
    const logs    = allLogs.length ? allLogs : await fetchLogs();
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('NEU Library — Visitor Report', 14, 18);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Period: ${start} to ${end}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 32);
    if (document.getElementById('inclSummary')?.checked) {
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Summary', 14, 44);
      doc.autoTable({ startY:48, head:[['Metric','Value']],
        body:[ ['Total Visits',stats.totalVisits],['Unique Visitors',stats.uniqueVisitors],
               ['Top Purpose',stats.byPurpose[0]?.purpose||'—'],['Top College',stats.byCollege[0]?.college||'—'] ],
        theme:'striped', headStyles:{fillColor:[30,60,120]}, margin:{left:14}, tableWidth:120 });
    }
    if (document.getElementById('inclLogs')?.checked) {
      doc.addPage();
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Visitor Logs', 14, 18);
      doc.autoTable({ startY:22, head:[['#','School ID','Name','College','Type','Purpose','Date','Time']],
        body:logs.map((r,i)=>[i+1,r.school_id,r.name,abbr(r.college),r.type||'Student',r.purpose,r.visit_date,r.visit_time]),
        theme:'striped', headStyles:{fillColor:[30,60,120]}, styles:{fontSize:9}, margin:{left:14} });
    }
    doc.save(`NEU-Library-Report-${start}-to-${end}.pdf`);
  });
  // PDF date defaults
  const today = new Date().toISOString().split('T')[0];
  const pdfS = document.getElementById('pdfDateStart');
  const pdfE = document.getElementById('pdfDateEnd');
  if (pdfS && !pdfS.value) pdfS.value = today;
  if (pdfE && !pdfE.value) pdfE.value = today;

  // CSV
  document.getElementById('csvBtnSettings')?.addEventListener('click', async () => {
    const type = document.querySelector('input[name="csvType"]:checked')?.value || 'all';
    let logs = allLogs.length ? allLogs : await fetchLogs();
    if (type !== 'all') {
      const { start, end } = getDateRange(type === 'today' ? 'today' : type === 'week' ? 'week' : 'month');
      logs = logs.filter(r => r.visit_date >= start && r.visit_date <= end);
    }
    const headers = ['#','School ID','Name','College','Type','Purpose','Date','Time'];
    const rows = logs.map((r,i) => [i+1, r.school_id, `"${r.name}"`, `"${r.college}"`, r.type||'Student', r.purpose, r.visit_date, r.visit_time]);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `NEU-Library-Logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  });

  // Change password
  document.getElementById('changePassBtn')?.addEventListener('click', async () => {
    const btn      = document.getElementById('changePassBtn');
    const username = document.getElementById('adminUsernameField')?.value.trim();
    const newPass  = document.getElementById('adminNewPass')?.value;
    const confirm  = document.getElementById('adminConfirmPass')?.value;
    if (!username || !newPass) { btnFeedback(btn,'⚠ Fill in all fields','error'); return; }
    if (newPass !== confirm)   { btnFeedback(btn,'⚠ Passwords do not match','error'); return; }
    btnFeedback(btn,'Updating...','loading');
    try {
      const res  = await fetch('/api/admin/change-password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, newPassword:newPass}) });
      const data = await res.json();
      btnFeedback(btn, res.ok ? '✓ Password Updated!' : '✗ ' + data.error, res.ok ? 'success' : 'error');
      if (res.ok) { document.getElementById('adminUsernameField').value=''; document.getElementById('adminNewPass').value=''; document.getElementById('adminConfirmPass').value=''; }
    } catch(e) { btnFeedback(btn, '✗ Connection error', 'error'); }
  });

  // Add admin
  document.getElementById('addAdminBtn')?.addEventListener('click', async () => {
    const btn      = document.getElementById('addAdminBtn');
    const username = document.getElementById('newAdminUser')?.value.trim();
    const fullName = document.getElementById('newAdminName')?.value.trim();
    const password = document.getElementById('newAdminPass')?.value;
    if (!username || !fullName || !password) { btnFeedback(btn,'⚠ Fill in all fields','error'); return; }
    btnFeedback(btn,'Adding...','loading');
    try {
      const res  = await fetch('/api/admin/add', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, full_name:fullName, password}) });
      const data = await res.json();
      btnFeedback(btn, res.ok ? `✓ Admin "${username}" Added!` : '✗ ' + data.error, res.ok ? 'success' : 'error');
      if (res.ok) { document.getElementById('newAdminUser').value=''; document.getElementById('newAdminName').value=''; document.getElementById('newAdminPass').value=''; }
    } catch(e) { btnFeedback(btn, '✗ Connection error', 'error'); }
  });

  // Library hours
  document.getElementById('saveHoursBtn')?.addEventListener('click', () => {
    const hours = { wdOpen:document.getElementById('wdOpen')?.value, wdClose:document.getElementById('wdClose')?.value,
      satOpen:document.getElementById('satOpen')?.value, satClose:document.getElementById('satClose')?.value,
      sunClosed:document.getElementById('sunClosed')?.checked };
    localStorage.setItem('neu_library_hours', JSON.stringify(hours));
    btnFeedback(document.getElementById('saveHoursBtn'), '✓ Hours Saved!');
  });

  // Announcement
  document.getElementById('saveAnnouncementBtn')?.addEventListener('click', async () => {
    const text    = document.getElementById('announcementText')?.value.trim();
    const enabled = document.getElementById('announcementEnabled')?.checked;
    const res = await fetch('/api/announcement', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, enabled}) });
    btnFeedback(document.getElementById('saveAnnouncementBtn'), res.ok ? '✓ Announcement Saved!' : '✗ Error saving', res.ok ? 'success' : 'error');
  });

  // Data management
  document.getElementById('clearLogsBtn')?.addEventListener('click', async () => {
    const type = document.querySelector('input[name="clearType"]:checked')?.value;
    if (!confirm('Clear selected logs? This cannot be undone.')) return;
    const res  = await fetch('/api/data/clear-logs', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type}) });
    const data = await res.json();
    alert(res.ok ? `✓ ${data.deleted} logs deleted.` : 'Error: ' + data.error);
    if (res.ok) loadLogs();
  });
  document.getElementById('resetStreaksBtn')?.addEventListener('click', async () => {
    if (!confirm('Reset all streaks to 0?')) return;
    const res = await fetch('/api/data/reset-streaks', { method:'POST' });
    alert(res.ok ? '✓ All streaks reset.' : 'Error resetting streaks.');
  });

  // Theme
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => applyAccentColor(sw.dataset.color));
  });
  document.getElementById('customColorPicker')?.addEventListener('input', function() {
    const val = this.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) applyAccentColor(val);
  });
  document.getElementById('customColorPicker')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const val = this.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) applyAccentColor(val);
    }
  });
  document.getElementById('sidebarOpacity')?.addEventListener('input', function() {
    const val = document.getElementById('sidebarOpacityVal');
    if (val) val.textContent = this.value + '%';
    document.querySelector('.sidebar').style.background = `rgba(6,10,22,${this.value/100})`;
  });
  document.getElementById('saveThemeBtn')?.addEventListener('click', () => {
    const color   = document.documentElement.style.getPropertyValue('--blue') || '#4a9eff';
    const opacity = document.getElementById('sidebarOpacity')?.value || 70;
    localStorage.setItem('neu_theme', JSON.stringify({ color, opacity }));
    const btn = document.getElementById('saveThemeBtn');
    if (btn) { btn.textContent = '✓ Theme Saved!'; setTimeout(() => btn.textContent = 'Apply & Save Theme', 2000); }
  });

  // Dashboard prefs
  document.getElementById('saveDashPrefsBtn')?.addEventListener('click', () => {
    const prefs = {
      defaultRange: document.querySelector('input[name="defRange"]:checked')?.value || 'today',
      charts: { day:document.getElementById('showChartDay')?.checked, purpose:document.getElementById('showChartPurpose')?.checked,
        hour:document.getElementById('showChartHour')?.checked, college:document.getElementById('showChartCollege')?.checked, heatmap:document.getElementById('showHeatmap')?.checked }
    };
    localStorage.setItem('neu_dash_prefs', JSON.stringify(prefs));
    const chartMap = { day:'chartByDay', purpose:'chartByPurpose', hour:'chartByHour', college:'chartByCollege' };
    Object.entries(prefs.charts).forEach(([key, show]) => {
      if (chartMap[key]) { const card = document.getElementById(chartMap[key])?.closest('.chart-card'); if (card) card.style.display = show ? '' : 'none'; }
      if (key === 'heatmap') { const hm = document.querySelector('.heatmap-card'); if (hm) hm.style.display = show ? '' : 'none'; }
    });
    currentRange = prefs.defaultRange;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.filter-btn[data-range="${prefs.defaultRange}"]`)?.classList.add('active');
    const btn2 = document.getElementById('saveDashPrefsBtn');
    if (btn2) { btn2.textContent = '✓ Saved!'; setTimeout(() => btn2.textContent = 'Save Preferences', 2000); }
  });
}

function applyAccentColor(color) {
  document.documentElement.style.setProperty('--blue', color);
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  const match = document.querySelector(`.color-swatch[data-color="${color}"]`);
  if (match) match.classList.add('active');
}

// Load saved theme on startup
(function loadTheme() {
  const saved = JSON.parse(localStorage.getItem('neu_theme') || 'null');
  if (!saved) return;
  if (saved.color) applyAccentColor(saved.color);
  if (saved.opacity) document.querySelector('.sidebar').style.background = `rgba(6,10,22,${saved.opacity/100})`;
})();

// Load last used range on startup
(function loadLastRange() {
  const lastRange  = localStorage.getItem('neu_last_range') || 'today';
  const lastStart  = localStorage.getItem('neu_last_custom_start');
  const lastEnd    = localStorage.getItem('neu_last_custom_end');
  currentRange = lastRange;
  if (lastRange === 'custom' && lastStart && lastEnd) {
    customStart = lastStart;
    customEnd   = lastEnd;
    document.getElementById('customRange')?.classList.remove('hidden');
    const s = document.getElementById('dateStart');
    const e = document.getElementById('dateEnd');
    if (s) s.value = lastStart;
    if (e) e.value = lastEnd;
  }
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.filter-btn[data-range="${lastRange}"]`)?.classList.add('active');

  // Restore last active tab
  const lastTab = localStorage.getItem('neu_last_tab') || 'overview';
  const allNavItems = document.querySelectorAll('.nav-item[data-tab]');
  allNavItems.forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-tab="${lastTab}"]`);
  if (activeNav) activeNav.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  const lastTabEl = document.getElementById(`tab${cap(lastTab)}`);
  if (lastTabEl) lastTabEl.classList.remove('hidden');
  document.getElementById('pageTitle').textContent = TAB_TITLES[lastTab] || 'Dashboard';

  // Show/hide date filters
  const showFilters = ['overview','topvisitors'].includes(lastTab);
  document.getElementById('dateFilters').style.display = showFilters ? '' : 'none';

  // Load the right data for the restored tab
  if (lastTab === 'overview')    { loadOverview(); loadHeatmap(); }
  else if (lastTab === 'logs')   loadLogs();
  else if (lastTab === 'topvisitors') loadTopVisitors();
  else if (lastTab === 'students')    loadStudents();
})();

// ─── FLATPICKR DATE PICKERS ───────────────────────────────────────────────────
function initDatePickers() {
  const fpConfig = {
    dateFormat: 'Y-m-d',
    disableMobile: true,
    animate: true,
  };

  // Main topbar date range
  const startEl = document.getElementById('dateStart');
  const endEl   = document.getElementById('dateEnd');
  if (startEl && !startEl._flatpickr) {
    flatpickr(startEl, { ...fpConfig, onChange: ([d]) => {
      if (d) customStart = d.toISOString().split('T')[0];
    }});
  }
  if (endEl && !endEl._flatpickr) {
    flatpickr(endEl, { ...fpConfig, onChange: ([d]) => {
      if (d) customEnd = d.toISOString().split('T')[0];
    }});
  }
}

// Re-init when settings modal opens (for PDF date pickers)
const _origOpenModal = openSettingsModal;
window.openSettingsModal = function(id) {
  _origOpenModal(id);
  setTimeout(() => {
    ['pdfDateStart','pdfDateEnd'].forEach(elId => {
      const el = document.getElementById(elId);
      if (el && !el._flatpickr) flatpickr(el, { dateFormat: 'Y-m-d', disableMobile: true });
    });
  }, 50);
};

document.addEventListener('DOMContentLoaded', initDatePickers);
document.addEventListener('DOMContentLoaded', initFilters);
setTimeout(initDatePickers, 300);
setTimeout(initFilters, 300);