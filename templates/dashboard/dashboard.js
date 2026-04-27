const STATE = {
  decisions: JSON.parse(localStorage.getItem('books-decisions-v1') || '{}'),
  recDecisions: JSON.parse(localStorage.getItem('books-rec-decisions-v1') || '{}'),
  filters: { lib: { search: '', status: '', cluster: '', availability: '', cat: '' },
             wl:  { search: '', cluster: '', length: '', cat: '' },
             recs: { cluster: '', cat: '', hideDecided: true } },
  sort: { lib: { key: 'score', dir: 'desc' }, wl: { key: 'score', dir: 'desc' } },
};

const COLORS = {
  paper: '#f4ebd9', ink: '#ede4d4', inkSoft: '#beb09a', muted: '#8b7e6f',
  rule: '#2a221d', ruleStrong: '#3a2f27', surface: '#1a1612',
  gold: '#d6a85e', goldSoft: '#e8c98e',
  sage: '#8aaa86', amber: '#d49649', rust: '#c5664a',
};

function saveDecisions() { localStorage.setItem('books-decisions-v1', JSON.stringify(STATE.decisions)); }
function saveRecDecisions() { localStorage.setItem('books-rec-decisions-v1', JSON.stringify(STATE.recDecisions)); }
function decide(asin, decision, scope = 'main') {
  if (scope === 'rec') {
    if (!decision) delete STATE.recDecisions[asin];
    else STATE.recDecisions[asin] = { decision, decidedAt: new Date().toISOString() };
    saveRecDecisions();
    return;
  }
  if (!decision) delete STATE.decisions[asin];
  else STATE.decisions[asin] = { decision, decidedAt: new Date().toISOString() };
  saveDecisions(); rerender();
}
function effectiveCat(b) { const d = STATE.decisions[b.asin]; return d ? d.decision : b.category; }
function effectiveRecCat(b) { const d = STATE.recDecisions[b.asin]; return d ? d.decision : b.category; }
function fmtLen(min) { if (!min) return ''; const h = Math.floor(min/60), m = min%60; return h ? (m? `${h}h ${m}m` : `${h}h`) : `${m}m`; }
function pillClass(s) { return (s||'').replace(/\s+/g,'-'); }
function decodeEntities(s) {
  if (s == null || typeof s !== 'string' || !s.includes('&')) return s;
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…').replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”').replace(/&ldquo;/g, '“')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
function clean(b) {
  ['title','subtitle','author','narrator','description'].forEach(k => { if (b[k]) b[k] = decodeEntities(b[k]); });
  return b;
}

let LIB = [], WL = [], RECS = [];
let recIdx = 0;
const recHistory = [];

function setText(el, text) { el.textContent = text == null ? '' : String(text); }
function makeEl(tag, attrs={}, ...children) {
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('data-')) el.setAttribute(k, v);
    else if (k === 'href') el.setAttribute('href', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el[k] = v;
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
    else el.appendChild(c);
  }
  return el;
}
function pill(cls, text) { return makeEl('span', { class: 'pill ' + cls }, text); }
function scoreEl(s) {
  const cls = s > 0 ? 'pos' : s < 0 ? 'neg' : 'zero';
  return makeEl('span', { class: cls }, (s>=0?'+':'') + s);
}
function coverEl(b, cls) {
  const url = b.cover_url;
  if (!url) return makeEl('div', { class: cls });
  const img = makeEl('img', { class: cls, src: url, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
  return img;
}

function makeRow(b, src) {
  const cat = effectiveCat(b);
  const decided = STATE.decisions[b.asin];
  const tr = makeEl('tr');
  tr.dataset.asin = b.asin || '';
  tr.dataset.src = src;

  const titleBlock = makeEl('div', { class: 'title-block' });
  titleBlock.appendChild(makeEl('span', { class: 'title-text' }, b.title || '(untitled)'));
  if (b.subtitle) titleBlock.appendChild(makeEl('span', { class: 'subtitle' }, b.subtitle));
  if (decided) {
    titleBlock.appendChild(makeEl('span', {
      style: 'display:inline-block;margin-left:8px;font-size:10px;font-family:JetBrains Mono,monospace;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;'
    }, '· decided'));
  }
  const titleCell = makeEl('td', { class: 'title' },
    makeEl('div', { class: 'title-cell' }, coverEl(b, 'row-cover'), titleBlock)
  );

  if (src === 'lib') {
    tr.appendChild(makeEl('td', { class: 'score' }, scoreEl(b.score)));
    tr.appendChild(makeEl('td', {}, cat ? pill(cat, cat) : ''));
    tr.appendChild(titleCell);
    tr.appendChild(makeEl('td', { class: 'author' }, b.author || ''));
    const lenTd = makeEl('td', { class: 'length' }, fmtLen(b.lengthMin));
    if (b.remaining) {
      lenTd.appendChild(document.createTextNode(' · '));
      lenTd.appendChild(makeEl('span', { style: 'color:var(--amber)' }, `${b.remaining} left`));
    }
    tr.appendChild(lenTd);
    const statusTd = makeEl('td', {}, pill(pillClass(b.listeningStatus), b.listeningStatus));
    if (b.availability === 'Unavailable') {
      statusTd.appendChild(document.createTextNode(' '));
      statusTd.appendChild(pill('Unavailable', 'unavail'));
    }
    tr.appendChild(statusTd);
    tr.appendChild(makeEl('td', { class: 'cluster' }, b.cluster ? makeEl('span', { class: 'cluster-tag' }, b.cluster) : ''));
  } else {
    tr.appendChild(makeEl('td', { class: 'score' }, scoreEl(b.score)));
    tr.appendChild(makeEl('td', {}, cat ? pill(cat, cat) : ''));
    tr.appendChild(titleCell);
    tr.appendChild(makeEl('td', { class: 'author' }, b.author || ''));
    tr.appendChild(makeEl('td', { class: 'length' }, fmtLen(b.lengthMin)));
    tr.appendChild(makeEl('td', { class: 'length' }, b.ratingsCount || ''));
    tr.appendChild(makeEl('td', { class: 'cluster' }, b.cluster ? makeEl('span', { class: 'cluster-tag' }, b.cluster) : ''));
  }
  tr.addEventListener('click', () => toggleExpand(tr, b, src));
  return tr;
}

function toggleExpand(tr, b, src) {
  const next = tr.nextSibling;
  if (next && next.classList && next.classList.contains('expanded-row')) {
    next.remove(); tr.classList.remove('expanded'); return;
  }
  document.querySelectorAll('.expanded-row').forEach(e => e.remove());
  document.querySelectorAll('tbody tr.expanded').forEach(e => e.classList.remove('expanded'));
  const decisions = src === 'lib' ? ['KEEP','LATER','PASS'] : ['KEEP','MAYBE','CUT'];
  const current = STATE.decisions[b.asin]?.decision;
  const reasonsBox = makeEl('div', { class: 'reasons' });
  (b.reasons || []).forEach(r => reasonsBox.appendChild(makeEl('span', {}, r)));
  const actions = makeEl('div', { class: 'actions' });
  decisions.forEach(d => {
    const btn = makeEl('button', { 'data-decide': d }, d);
    if (current === d) btn.className = 'cur';
    btn.addEventListener('click', e => { e.stopPropagation(); decide(b.asin, d); });
    actions.appendChild(btn);
  });
  const clearBtn = makeEl('button', { 'data-decide': '' }, 'Clear');
  clearBtn.addEventListener('click', e => { e.stopPropagation(); decide(b.asin, ''); });
  actions.appendChild(clearBtn);
  if (b.url) actions.appendChild(makeEl('a', { href: b.url, target: '_blank', rel: 'noopener' }, 'Audible →'));
  const inner = makeEl('div', { style: 'flex:1;min-width:300px' });
  inner.appendChild(reasonsBox);
  if (b.description) inner.appendChild(makeEl('div', { class: 'desc' }, b.description));
  inner.appendChild(actions);
  const flex = makeEl('div', { style: 'display:flex;gap:24px;flex-wrap:wrap' }, inner);
  const td = makeEl('td', { colSpan: '7' }, flex);
  const exp = makeEl('tr', { class: 'expanded-row' }, td);
  tr.classList.add('expanded');
  tr.parentNode.insertBefore(exp, tr.nextSibling);
}

function applyFilters(items, src) {
  const f = STATE.filters[src];
  return items.filter(b => {
    if (f.search) {
      const blob = `${b.title||''} ${b.author||''} ${b.description||''} ${b.subtitle||''}`.toLowerCase();
      if (!blob.includes(f.search.toLowerCase())) return false;
    }
    if (f.status && b.listeningStatus !== f.status) return false;
    if (f.cluster && b.cluster !== f.cluster) return false;
    if (f.availability && b.availability !== f.availability) return false;
    if (f.cat && effectiveCat(b) !== f.cat) return false;
    if (f.length) {
      const h = (b.lengthMin || 0) / 60;
      if (f.length === 'lt5' && !(h && h < 5)) return false;
      if (f.length === '5to9' && !(h >= 5 && h < 9)) return false;
      if (f.length === '9to14' && !(h >= 9 && h < 14)) return false;
      if (f.length === '14plus' && !(h >= 14)) return false;
    }
    return true;
  });
}

function applySort(items, src) {
  const { key, dir } = STATE.sort[src];
  const mul = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = a[key] ?? '', bv = b[key] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  });
}

function updateSortArrows(tableId, sort) {
  document.querySelectorAll(`#${tableId} thead th`).forEach(th => {
    th.querySelector('.sort-arrow')?.remove();
    if (th.dataset.sort === sort.key) {
      const span = makeEl('span', { class: 'sort-arrow' }, sort.dir === 'asc' ? '▲' : '▼');
      th.appendChild(span);
    }
  });
}

function renderLibrary() {
  const items = applyFilters(LIB, 'lib');
  const sorted = applySort(items, 'lib');
  const tbody = document.getElementById('lib-tbody');
  tbody.replaceChildren(...sorted.map(b => makeRow(b, 'lib')));
  setText(document.getElementById('lib-count'), `${sorted.length} of ${LIB.length} shown`);
  updateSortArrows('lib-table', STATE.sort.lib);
}
function renderWishlist() {
  const items = applyFilters(WL, 'wl');
  const sorted = applySort(items, 'wl');
  const tbody = document.getElementById('wl-tbody');
  tbody.replaceChildren(...sorted.map(b => makeRow(b, 'wl')));
  setText(document.getElementById('wl-count'), `${sorted.length} of ${WL.length} shown`);
  updateSortArrows('wl-table', STATE.sort.wl);
}

function bookListenedMin(b) {
  // Use percent_complete directly — it tracks actual playback position, which
  // matches Audible's "listening time" stat. The is_finished flag is a separate
  // user-facing marker and is unreliable for hours math: many books are flagged
  // finished with percent_complete = 0 (listened pre-tracking, or never re-played
  // on this device) and others sit at 99% because the end credits got skipped.
  const total = b.lengthMin || 0;
  if (!total) return 0;
  const pc = typeof b.percent_complete === 'number' ? b.percent_complete : 0;
  return Math.round(total * pc / 100);
}

function bookRemainingMin(b) {
  // Finished books contribute 0 to backlog regardless of percent_complete:
  // the user has explicitly moved on, even if Audible's playback position
  // didn't reach 100%.
  if (b.listeningStatus === 'Finished') return 0;
  const total = b.lengthMin || 0;
  return Math.max(0, total - bookListenedMin(b));
}

function fmtHours(min) {
  const h = Math.round(min / 60);
  return h.toLocaleString();
}

function renderOverview() {
  const lib = LIB;
  const counts = {
    fin: lib.filter(b => b.listeningStatus === 'Finished').length,
    inProg: lib.filter(b => b.listeningStatus === 'In progress').length,
    notStarted: lib.filter(b => b.listeningStatus === 'Not started').length,
    unav: lib.filter(b => b.availability === 'Unavailable').length,
  };
  const triageTargets = lib.filter(b => b.category);
  const passLib = triageTargets.filter(b => effectiveCat(b) === 'PASS').length;
  const laterLib = triageTargets.filter(b => effectiveCat(b) === 'LATER').length;
  const keepLib = triageTargets.filter(b => effectiveCat(b) === 'KEEP').length;
  const cutWl = WL.filter(b => effectiveCat(b) === 'CUT').length;
  const maybeWl = WL.filter(b => effectiveCat(b) === 'MAYBE').length;
  const keepWl = WL.filter(b => effectiveCat(b) === 'KEEP').length;
  const decisionsCount = Object.keys(STATE.decisions).length;

  const totalMin = lib.reduce((s, b) => s + (b.lengthMin || 0), 0);
  const listenedMin = lib.reduce((s, b) => s + bookListenedMin(b), 0);
  const remainingMin = lib.reduce((s, b) => s + bookRemainingMin(b), 0);
  const wlMin = WL.reduce((s, b) => s + (b.lengthMin || 0), 0);
  const yearsAtOneHourPerDay = remainingMin / 60 / 365;

  const primaryKpis = [
    { label: 'Library', value: lib.length, sub: `${counts.unav ? counts.unav + ' unavailable' : 'all available'}` },
    { label: 'Finished', value: counts.fin, sub: `${Math.round(counts.fin*100/lib.length)}% of total` },
    { label: 'Hours listened', value: `${fmtHours(listenedMin)}h`, sub: `${Math.round(listenedMin*100/Math.max(totalMin,1))}% of library` },
    { label: 'Library hours', value: `${fmtHours(totalMin)}h`, sub: `avg ${fmtHours(totalMin/Math.max(lib.length,1))}h per title` },
    { label: 'Backlog', value: `${fmtHours(remainingMin)}h`, sub: `${yearsAtOneHourPerDay.toFixed(1)} yrs at 1h/day` },
    { label: 'Wishlist', value: WL.length, sub: `${fmtHours(wlMin)}h if you bought all` },
  ];
  const secondaryKpis = [
    { label: 'In progress', value: counts.inProg, sub: 'open threads' },
    { label: 'Not started', value: counts.notStarted, sub: 'shelved' },
    { label: 'Pass · Cut', value: passLib + cutWl, sub: `lib ${passLib} · wl ${cutWl}` },
    { label: 'Later · Maybe', value: laterLib + maybeWl, sub: `lib ${laterLib} · wl ${maybeWl}` },
    { label: 'Keep', value: keepLib + keepWl, sub: `lib ${keepLib} · wl ${keepWl}` },
    { label: 'Decisions', value: decisionsCount, sub: decisionsCount ? 'override saved' : 'awaiting' },
  ];
  const renderKpis = (id, items, baseDelay = 0) => {
    document.getElementById(id).replaceChildren(...items.map((k, i) => makeEl('div',
      { class: 'kpi', style: `--i:${baseDelay + i}` },
      makeEl('div', { class: 'label' }, k.label),
      makeEl('div', { class: 'value' }, String(k.value)),
      makeEl('div', { class: 'sub' }, k.sub)
    )));
  };
  renderKpis('kpi-grid', primaryKpis, 0);
  renderKpis('kpi-grid-secondary', secondaryKpis, primaryKpis.length);
  drawCharts();
  drawTopKeep();
}

function drawTopKeep() {
  const candidates = LIB.filter(b => effectiveCat(b) === 'KEEP').sort((a,b) => b.score - a.score).slice(0, 12);
  const container = document.getElementById('top-keep');
  container.replaceChildren(...candidates.map(b => {
    const titleEl = makeEl('div', { class: 'spot-title' }, b.title || '(untitled)');
    titleEl.appendChild(document.createTextNode(' '));
    titleEl.appendChild(scoreEl(b.score));
    const meta = makeEl('div', { class: 'spot-meta' });
    if (b.author) meta.appendChild(makeEl('span', { class: 'name' }, b.author));
    if (b.lengthMin) meta.appendChild(makeEl('span', {}, fmtLen(b.lengthMin)));
    if (b.remaining) meta.appendChild(makeEl('span', { style: 'color:var(--amber)' }, `${b.remaining} left`));
    if (b.cluster) meta.appendChild(makeEl('span', { class: 'cluster-tag' }, b.cluster));
    if (b.listeningStatus) meta.appendChild(pill(pillClass(b.listeningStatus), b.listeningStatus));
    const content = makeEl('div', { class: 'spot-content' }, titleEl, meta);
    return makeEl('div', { class: 'spot-card' }, coverEl(b, 'cover'), content);
  }));
}

let charts = {};
function drawCharts() {
  Object.values(charts).forEach(c => c.destroy());
  charts = {};
  const baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: COLORS.ink, font: { family: 'Geist' } } } },
    scales: {
      x: { ticks: { color: COLORS.muted, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: COLORS.rule } },
      y: { ticks: { color: COLORS.muted, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: COLORS.rule } }
    }
  };

  const statusCounts = { Finished: 0, 'In progress': 0, 'Not started': 0 };
  LIB.forEach(b => statusCounts[b.listeningStatus]++);
  charts.status = new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: { labels: Object.keys(statusCounts), datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: [COLORS.sage, COLORS.amber, COLORS.muted],
      borderColor: COLORS.bg || '#0e0b09', borderWidth: 2
    }] },
    options: { responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { color: COLORS.ink, font: { family: 'Geist' }, padding: 14, boxWidth: 12 } } }
    }
  });

  const buckets = ['<3h','3–5h','5–9h','9–14h','14h+'];
  const hist = items => { const c=[0,0,0,0,0]; items.forEach(b=>{ const h=(b.lengthMin||0)/60; if(!h)return; c[h<3?0:h<5?1:h<9?2:h<14?3:4]++;}); return c; };
  charts.length = new Chart(document.getElementById('chart-length'), {
    type: 'bar',
    data: { labels: buckets, datasets: [
      { label: 'Library', data: hist(LIB.filter(b => b.lengthMin)), backgroundColor: COLORS.gold, borderRadius: 2 },
      { label: 'Wishlist', data: hist(WL), backgroundColor: COLORS.amber, borderRadius: 2 },
    ] }, options: baseOpts
  });

  const clusters = {};
  LIB.forEach(b => { const c = b.cluster || 'other'; clusters[c] = (clusters[c]||0)+1; });
  const clusterEntries = Object.entries(clusters).sort((a, b) => b[1] - a[1]);
  const prettyCluster = c => c.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
  const tickStyle = { color: COLORS.muted, font: { family: 'JetBrains Mono', size: 10 } };
  charts.cluster = new Chart(document.getElementById('chart-cluster'), {
    type: 'bar',
    data: { labels: clusterEntries.map(([c]) => prettyCluster(c)), datasets: [{
      data: clusterEntries.map(([, n]) => n),
      backgroundColor: COLORS.gold, borderRadius: 2
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { ...tickStyle, precision: 0 }, grid: { color: COLORS.rule } },
        y: { ticks: tickStyle, grid: { color: 'transparent' } }
      }
    }
  });

  const scoreBuckets = {};
  WL.forEach(b => { scoreBuckets[b.score] = (scoreBuckets[b.score]||0)+1; });
  const sortedScores = Object.keys(scoreBuckets).map(Number).sort((a,b)=>a-b);
  charts.wlScore = new Chart(document.getElementById('chart-wishlist-score'), {
    type: 'bar',
    data: { labels: sortedScores.map(String), datasets: [{
      data: sortedScores.map(s=>scoreBuckets[s]),
      backgroundColor: sortedScores.map(s => s<0?COLORS.rust : s>=4?COLORS.sage : COLORS.amber),
      borderRadius: 2
    }] },
    options: { ...baseOpts, plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => `score ${items[0].label}` } } } }
  });

  // Hours by cluster — stacked listened vs remaining, sorted by total desc.
  // "Remaining" excludes finished books (the user has moved on regardless of pct).
  const hoursByCluster = {};
  LIB.forEach(b => {
    const c = b.cluster || 'other';
    if (!hoursByCluster[c]) hoursByCluster[c] = { listened: 0, remaining: 0 };
    hoursByCluster[c].listened += bookListenedMin(b);
    hoursByCluster[c].remaining += bookRemainingMin(b);
  });
  const hoursEntries = Object.entries(hoursByCluster)
    .map(([k, v]) => [k, v, v.listened + v.remaining])
    .filter(([, , total]) => total > 0)
    .sort((a, b) => b[2] - a[2]);
  charts.hoursCluster = new Chart(document.getElementById('chart-hours-cluster'), {
    type: 'bar',
    data: {
      labels: hoursEntries.map(([c]) => prettyCluster(c)),
      datasets: [
        {
          label: 'Listened',
          data: hoursEntries.map(([, v]) => +(v.listened / 60).toFixed(1)),
          backgroundColor: COLORS.sage,
          borderRadius: 2,
        },
        {
          label: 'Remaining',
          data: hoursEntries.map(([, v]) => +(v.remaining / 60).toFixed(1)),
          backgroundColor: COLORS.gold,
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { position: 'bottom', labels: { color: COLORS.ink, font: { family: 'Geist' }, padding: 14, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x}h` } },
      },
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { ...tickStyle, callback: v => `${v}h` }, grid: { color: COLORS.rule } },
        y: { stacked: true, ticks: tickStyle, grid: { color: 'transparent' } },
      },
    },
  });
}

function buildTriageList() {
  const sel = document.getElementById('triage-source').value;
  if (sel === 'library-pass') return LIB.filter(b => b.category === 'PASS' && !STATE.decisions[b.asin]);
  if (sel === 'library-later') return LIB.filter(b => b.category === 'LATER' && !STATE.decisions[b.asin]);
  if (sel === 'wishlist-cut') return WL.filter(b => b.category === 'CUT' && !STATE.decisions[b.asin]);
  if (sel === 'wishlist-maybe') return WL.filter(b => b.category === 'MAYBE' && !STATE.decisions[b.asin]);
  if (sel === 'library-stalled') return LIB.filter(b => b.listeningStatus === 'In progress' && (b.remainingMin||0) >= 300 && !STATE.decisions[b.asin]);
  return [];
}
let triageIdx = 0;

function buildTriageCard(b, items, isLib) {
  const decisions = isLib ? ['KEEP','LATER','PASS'] : ['KEEP','MAYBE','CUT'];
  const labels = isLib ? ['keep', 'later', 'pass'] : ['keep', 'maybe', 'cut'];
  const card = makeEl('div', { class: 'triage-card' });

  // Strip
  const strip = makeEl('div', { class: 'card-strip' });
  const left = makeEl('span', {}, makeEl('span', { class: 'serial' }, `№ ${String(triageIdx + 1).padStart(3, '0')}`),
    ` / ${String(items.length).padStart(3, '0')}`);
  const right = makeEl('span', { class: 'proposed' },
    'Proposed: ', pill(b.category, b.category), '  ', scoreEl(b.score)
  );
  strip.appendChild(left);
  strip.appendChild(right);
  card.appendChild(strip);

  // Body — content column + cover
  const content = makeEl('div', { class: 'card-content' });
  if (b.cluster) content.appendChild(makeEl('div', { class: 'card-cluster' }, b.cluster.replace(/_/g, ' ')));
  content.appendChild(makeEl('h2', { class: 'card-title' }, b.title || '(untitled)'));
  if (b.subtitle) content.appendChild(makeEl('div', { class: 'card-subtitle' }, b.subtitle));
  if (b.author) {
    const auth = makeEl('div', { class: 'card-author' }, 'By ', makeEl('span', { class: 'name' }, b.author));
    if (b.narrator) {
      auth.appendChild(document.createTextNode(' · narrated by '));
      auth.appendChild(makeEl('span', { class: 'name' }, b.narrator));
    }
    content.appendChild(auth);
  }

  const tags = makeEl('div', { class: 'card-tags' });
  if (b.listeningStatus) tags.appendChild(pill(pillClass(b.listeningStatus), b.listeningStatus));
  if (b.availability === 'Unavailable') tags.appendChild(pill('Unavailable', 'unavail'));
  if (b.lengthMin) tags.appendChild(makeEl('span', { class: 'meta-text' }, fmtLen(b.lengthMin)));
  if (b.remaining) tags.appendChild(makeEl('span', { class: 'meta-text', style: 'color:var(--amber)' }, `${b.remaining} left`));
  content.appendChild(tags);

  if (b.reasons && b.reasons.length) {
    content.appendChild(makeEl('div', { class: 'card-reasons-head' }, 'Why this score'));
    const reasonsEl = makeEl('div', { class: 'card-reasons' });
    b.reasons.forEach(r => reasonsEl.appendChild(makeEl('span', {}, r)));
    content.appendChild(reasonsEl);
  }

  if (b.description) content.appendChild(makeEl('div', { class: 'card-desc' }, b.description));

  const body = makeEl('div', { class: 'card-body' }, content);
  if (b.cover_url) body.appendChild(coverEl(b, 'card-cover'));
  card.appendChild(body);

  // Actions — slim, label first, kbd badge after
  const actions = makeEl('div', { class: 'card-actions' });
  decisions.forEach((d, i) => {
    const btn = makeEl('button', { 'data-decide': d },
      labels[i],
      makeEl('span', { class: 'key' }, labels[i].charAt(0).toUpperCase())
    );
    btn.addEventListener('click', () => { decide(b.asin, d); renderTriage(); });
    actions.appendChild(btn);
  });
  const skipBtn = makeEl('button', { class: 'card-skip' },
    'skip',
    makeEl('span', { class: 'key' }, 'S')
  );
  skipBtn.addEventListener('click', () => { triageIdx = Math.min(triageIdx + 1, items.length - 1); renderTriage(); });
  actions.appendChild(skipBtn);
  card.appendChild(actions);

  // Extra strip
  const extra = makeEl('div', { class: 'card-extra' });
  extra.appendChild(makeEl('span', {}, b.asin ? `ASIN ${b.asin}` : ''));
  if (b.url) extra.appendChild(makeEl('a', { href: b.url, target: '_blank', rel: 'noopener' }, 'Open on Audible →'));
  card.appendChild(extra);

  return card;
}

function renderTriage() {
  const items = buildTriageList();
  if (triageIdx >= items.length) triageIdx = 0;
  const wrap = document.getElementById('triage-card-wrap');
  if (!items.length) {
    wrap.replaceChildren(makeEl('div', { class: 'empty' }, 'All decided. Switch source above.'));
    setText(document.getElementById('triage-progress-text'), '0 left');
    document.getElementById('triage-progress-bar').style.width = '100%';
    return;
  }
  const b = items[triageIdx];
  const sel = document.getElementById('triage-source').value;
  const isLib = sel.startsWith('library');
  setText(document.getElementById('triage-progress-text'), `${triageIdx + 1} / ${items.length}`);
  document.getElementById('triage-progress-bar').style.width = `${((triageIdx + 1)/items.length)*100}%`;

  wrap.replaceChildren(buildTriageCard(b, items, isLib));
}

// === Recommendations swipe deck ===========================================
function applyRecFilters(items) {
  const f = STATE.filters.recs;
  return items.filter(b => {
    if (f.cluster && b.cluster !== f.cluster) return false;
    if (f.cat && effectiveRecCat(b) !== f.cat) return false;
    if (f.hideDecided && STATE.recDecisions[b.asin]) return false;
    return true;
  });
}

function buildRecsList() {
  return applyRecFilters(RECS).slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.seed_count || 0) - (a.seed_count || 0);
  });
}

function recScoreClass(s) { return s > 0 ? '' : s < 0 ? 'neg' : 'zero'; }

function buildRecCard(b, depth) {
  const card = makeEl('div', { class: 'swipe-card', 'data-asin': b.asin || '', 'data-depth': String(depth) });

  const cover = makeEl('div', { class: 'swipe-cover' });
  if (b.cover_url) {
    const img = makeEl('img', { src: b.cover_url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
    cover.appendChild(img);
  }
  cover.appendChild(makeEl('div', { class: `swipe-score ${recScoreClass(b.score)}` }, (b.score >= 0 ? '+' : '') + b.score));
  if (b.seed_count) {
    const seedTitle = (b.seed_titles || []).slice(0, 5).join(' · ');
    cover.appendChild(makeEl('div', { class: 'swipe-seed', title: seedTitle }, `${b.seed_count}× linked`));
  }
  card.appendChild(cover);

  card.appendChild(makeEl('div', { class: 'swipe-overlay overlay-keep' }, makeEl('span', {}, 'KEEP')));
  card.appendChild(makeEl('div', { class: 'swipe-overlay overlay-cut' }, makeEl('span', {}, 'PASS')));
  card.appendChild(makeEl('div', { class: 'swipe-overlay overlay-maybe' }, makeEl('span', {}, 'MAYBE')));

  const meta = makeEl('div', { class: 'swipe-meta' });
  if (b.cluster) meta.appendChild(makeEl('div', { class: 'swipe-cluster' }, b.cluster.replace(/_/g, ' ')));
  meta.appendChild(makeEl('h3', { class: 'swipe-title' }, b.title || '(untitled)'));
  if (b.subtitle) meta.appendChild(makeEl('div', { class: 'swipe-subtitle' }, b.subtitle));
  if (b.author) {
    const byline = makeEl('div', { class: 'swipe-byline' }, 'By ', makeEl('span', { class: 'name' }, b.author));
    if (b.narrator) {
      byline.appendChild(document.createTextNode(' · narrated by '));
      byline.appendChild(makeEl('span', { class: 'name' }, b.narrator));
    }
    meta.appendChild(byline);
  }

  const chips = makeEl('div', { class: 'swipe-chips' });
  if (b.category) chips.appendChild(pill(b.category, b.category));
  if (b.lengthMin) chips.appendChild(makeEl('span', { class: 'meta' }, fmtLen(b.lengthMin)));
  if (b.rating && b.rating !== '-') {
    const ratings = b.ratingsCount ? ` · ${Number(b.ratingsCount).toLocaleString()}` : '';
    chips.appendChild(makeEl('span', { class: 'meta' }, `★ ${b.rating}${ratings}`));
  }
  if (chips.childNodes.length) meta.appendChild(chips);

  if (b.reasons && b.reasons.length) {
    const reasonsEl = makeEl('div', { class: 'swipe-reasons' });
    b.reasons.slice(0, 6).forEach(r => reasonsEl.appendChild(makeEl('span', {}, r)));
    meta.appendChild(reasonsEl);
  }

  if (b.description) {
    const txt = b.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const trimmed = txt.length > 320 ? txt.slice(0, 320).replace(/\s\S*$/, '') + '…' : txt;
    if (trimmed) meta.appendChild(makeEl('div', { class: 'swipe-blurb' }, trimmed));
  }

  if (b.url) meta.appendChild(makeEl('a', { class: 'swipe-link', href: b.url, target: '_blank', rel: 'noopener' }, 'Open on Audible →'));

  card.appendChild(meta);
  if (depth === 0) attachDrag(card, b);
  return card;
}

function resetRecDecisions() {
  const n = Object.keys(STATE.recDecisions).length;
  if (!n) return;
  if (confirm(`Clear ${n} recommendation decision(s)?`)) {
    STATE.recDecisions = {};
    saveRecDecisions();
    recHistory.length = 0;
    renderRecs();
  }
}

function renderDecidedStrip() {
  const container = document.getElementById('recs-decided-log');
  if (!container) return;
  const decisions = Object.entries(STATE.recDecisions);
  if (!decisions.length) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  container.hidden = false;
  decisions.sort((a, b) => (b[1].decidedAt || '').localeCompare(a[1].decidedAt || ''));
  const byAsin = new Map(RECS.map(r => [r.asin, r]));
  const rows = decisions.map(([asin, info]) => {
    const b = byAsin.get(asin);
    if (!b) return null;
    const card = makeEl('div', { class: 'decided-card', 'data-asin': asin });
    const cover = b.cover_url
      ? makeEl('img', { class: 'cover', src: b.cover_url, alt: '', loading: 'lazy', decoding: 'async' })
      : makeEl('div', { class: 'cover' });
    const body = makeEl('div', { class: 'body' });
    body.appendChild(makeEl('div', { class: 't', title: b.title || '' }, b.title || '(untitled)'));
    const undoBtn = makeEl('button', { class: 'undo' }, 'undo');
    undoBtn.addEventListener('click', () => {
      decide(asin, '', 'rec');
      renderRecs();
    });
    body.appendChild(makeEl('div', { class: 'row' }, pill(info.decision, info.decision), undoBtn));
    card.appendChild(cover); card.appendChild(body);
    return card;
  }).filter(Boolean);
  const resetBtn = makeEl('button', { class: 'reset-recs' }, 'reset all');
  resetBtn.addEventListener('click', resetRecDecisions);
  const head = makeEl('div', { class: 'head' },
    makeEl('h3', {}, `Decided · ${decisions.length}`),
    resetBtn,
  );
  container.replaceChildren(head, makeEl('div', { class: 'decided-grid' }, ...rows));
}

function setRecActionsEnabled(on) {
  ['rec-cut','rec-maybe','rec-keep','rec-skip'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !on;
  });
  const undo = document.getElementById('rec-undo');
  if (undo) undo.disabled = recHistory.length === 0;
}

function renderRecs() {
  const items = buildRecsList();
  const decided = Object.keys(STATE.recDecisions).length;
  const total = RECS.length;

  const progressText = document.getElementById('recs-progress-text');
  if (progressText) {
    setText(progressText, total
      ? `${decided} decided · ${items.length} remaining of ${total}`
      : 'no recommendations');
  }
  const progressBar = document.getElementById('recs-progress-bar');
  if (progressBar) progressBar.style.width = total ? `${Math.min(100, decided/total*100)}%` : '0%';

  const deck = document.getElementById('recs-deck');
  if (!deck) return;
  if (!total) {
    deck.replaceChildren(makeEl('div', { class: 'swipe-empty' },
      'No recommendations yet.',
      makeEl('span', { class: 'hint' }, 'run python3 _recommend.py && python3 _score.py')
    ));
    setRecActionsEnabled(false);
    renderDecidedStrip();
    return;
  }
  if (!items.length) {
    deck.replaceChildren(makeEl('div', { class: 'swipe-empty' },
      'All decided in this filter.',
      makeEl('span', { class: 'hint' }, `${decided} of ${total} decided · loosen filters or undo`)
    ));
    setRecActionsEnabled(false);
    renderDecidedStrip();
    return;
  }

  if (recIdx >= items.length) recIdx = 0;
  const stack = items.slice(recIdx, recIdx + 3);
  // Render bottom-up so the active card (depth 0) is appended last → on top of the stack.
  deck.replaceChildren(...stack.map((b, i) => buildRecCard(b, i)).reverse());
  setRecActionsEnabled(true);
  renderDecidedStrip();
}

function commitRecDecision(asin, decision) {
  recHistory.push({ asin, prev: STATE.recDecisions[asin]?.decision || null });
  if (recHistory.length > 20) recHistory.shift();
  decide(asin, decision, 'rec');
  const card = document.querySelector('#recs-deck .swipe-card[data-depth="0"]:not(.exiting)');
  if (card) animateExit(card, decision, () => renderRecs());
  else renderRecs();
}

function skipRec() {
  if (!buildRecsList().length) return;
  const card = document.querySelector('#recs-deck .swipe-card[data-depth="0"]:not(.exiting)');
  if (card) {
    card.classList.add('exiting');
    card.style.transition = 'transform .25s ease, opacity .25s';
    card.style.transform = 'translateY(-32px)';
    card.style.opacity = '0';
    setTimeout(() => { recIdx++; renderRecs(); }, 220);
  } else {
    recIdx++; renderRecs();
  }
}

function undoRec() {
  const last = recHistory.pop();
  if (!last) return;
  decide(last.asin, last.prev || '', 'rec');
  recIdx = Math.max(0, recIdx - 1);
  renderRecs();
}

function animateExit(card, decision, done) {
  card.classList.add('exiting');
  let tx = 0, ty = 0, rot = 0;
  if (decision === 'KEEP') { tx = window.innerWidth; rot = 18; }
  else if (decision === 'CUT') { tx = -window.innerWidth; rot = -18; }
  else { ty = -window.innerHeight * 0.7; }
  const overlaySel = decision === 'KEEP' ? '.overlay-keep'
                   : decision === 'CUT' ? '.overlay-cut' : '.overlay-maybe';
  const overlay = card.querySelector(overlaySel);
  if (overlay) overlay.style.opacity = '1';
  card.style.transition = 'transform .3s cubic-bezier(0.4,0,0.2,1), opacity .3s';
  card.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
  card.style.opacity = '0';
  setTimeout(done, 290);
}

function attachDrag(card, b) {
  let startX = 0, startY = 0, dx = 0, dy = 0, lastT = 0, lastX = 0, vel = 0;
  let pointerId = null;
  const overKeep = card.querySelector('.overlay-keep');
  const overCut = card.querySelector('.overlay-cut');
  const overMaybe = card.querySelector('.overlay-maybe');

  function clearOverlays() {
    [overKeep, overCut, overMaybe].forEach(o => { if (o) o.style.opacity = '0'; });
  }
  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('a')) return;
    pointerId = e.pointerId;
    try { card.setPointerCapture(pointerId); } catch (_) {}
    startX = e.clientX; startY = e.clientY;
    dx = 0; dy = 0;
    lastT = performance.now(); lastX = startX; vel = 0;
    card.classList.add('dragging');
  }
  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    dx = e.clientX - startX; dy = e.clientY - startY;
    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) { vel = (e.clientX - lastX) / dt; lastT = now; lastX = e.clientX; }
    const w = card.offsetWidth || 360;
    const h = card.offsetHeight || 600;
    const rot = Math.max(-15, Math.min(15, dx * 0.06));
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    if (Math.abs(dx) > Math.abs(dy)) {
      const horiz = Math.min(1, Math.abs(dx) / (w * 0.25));
      if (overKeep) overKeep.style.opacity = dx > 0 ? horiz : 0;
      if (overCut) overCut.style.opacity = dx < 0 ? horiz : 0;
      if (overMaybe) overMaybe.style.opacity = 0;
    } else if (dy < 0) {
      const vert = Math.min(1, Math.abs(dy) / (h * 0.20));
      if (overKeep) overKeep.style.opacity = 0;
      if (overCut) overCut.style.opacity = 0;
      if (overMaybe) overMaybe.style.opacity = vert;
    } else {
      clearOverlays();
    }
  }
  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    card.classList.remove('dragging');
    try { card.releasePointerCapture(pointerId); } catch (_) {}
    const w = card.offsetWidth || 360;
    const h = card.offsetHeight || 600;
    const horizPass = Math.abs(dx) > w * 0.25 || Math.abs(vel) > 0.5;
    const vertPass = -dy > h * 0.20;
    let decision = null;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (horizPass) decision = dx > 0 ? 'KEEP' : 'CUT';
    } else if (vertPass && dy < 0) {
      decision = 'MAYBE';
    }
    if (decision) {
      commitRecDecision(b.asin, decision);
    } else {
      card.style.transition = 'transform .25s cubic-bezier(0.18,0.89,0.32,1.28)';
      card.style.transform = '';
      [overKeep, overCut, overMaybe].forEach(o => { if (o) { o.style.transition = 'opacity .2s'; o.style.opacity = '0'; } });
      setTimeout(() => {
        card.style.transition = '';
        [overKeep, overCut, overMaybe].forEach(o => { if (o) o.style.transition = ''; });
      }, 260);
    }
    dx = dy = 0; pointerId = null;
  }

  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
  card.addEventListener('pointercancel', onUp);
}

function rerender() {
  renderOverview();
  renderLibrary();
  renderWishlist();
  if (!document.getElementById('tab-triage').hidden) renderTriage();
}

document.querySelectorAll('nav button').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'tab-' + btn.dataset.tab);
  if (btn.dataset.tab === 'triage') renderTriage();
  else if (btn.dataset.tab === 'recs') renderRecs();
}));

const wireFilter = (id, panel, key) => {
  document.getElementById(id).addEventListener('input', () => {
    STATE.filters[panel][key] = document.getElementById(id).value;
    panel === 'lib' ? renderLibrary() : renderWishlist();
  });
};
wireFilter('lib-search','lib','search');
wireFilter('lib-status','lib','status');
wireFilter('lib-cluster','lib','cluster');
wireFilter('lib-availability','lib','availability');
wireFilter('wl-search','wl','search');
wireFilter('wl-cluster','wl','cluster');
wireFilter('wl-length','wl','length');

document.querySelectorAll('[data-filter="lib"]').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('[data-filter="lib"]').forEach(o => o.classList.remove('active'));
  c.classList.add('active');
  STATE.filters.lib.cat = c.dataset.cat;
  renderLibrary();
}));
document.querySelectorAll('[data-filter="wl"]').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('[data-filter="wl"]').forEach(o => o.classList.remove('active'));
  c.classList.add('active');
  STATE.filters.wl.cat = c.dataset.cat;
  renderWishlist();
}));

document.getElementById('recs-cluster').addEventListener('change', () => {
  STATE.filters.recs.cluster = document.getElementById('recs-cluster').value;
  recIdx = 0;
  renderRecs();
});
document.querySelectorAll('[data-filter="recs"]').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('[data-filter="recs"]').forEach(o => o.classList.remove('active'));
  c.classList.add('active');
  STATE.filters.recs.cat = c.dataset.cat;
  recIdx = 0;
  renderRecs();
}));
function topRec() { const items = buildRecsList(); return items[recIdx]; }
document.getElementById('rec-cut').addEventListener('click', () => { const b = topRec(); if (b) commitRecDecision(b.asin, 'CUT'); });
document.getElementById('rec-maybe').addEventListener('click', () => { const b = topRec(); if (b) commitRecDecision(b.asin, 'MAYBE'); });
document.getElementById('rec-keep').addEventListener('click', () => { const b = topRec(); if (b) commitRecDecision(b.asin, 'KEEP'); });
document.getElementById('rec-skip').addEventListener('click', skipRec);
document.getElementById('rec-undo').addEventListener('click', undoRec);

function bindSort(tableId, src) {
  document.querySelectorAll(`#${tableId} thead th`).forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.sort;
    if (STATE.sort[src].key === k) STATE.sort[src].dir = STATE.sort[src].dir === 'asc' ? 'desc' : 'asc';
    else { STATE.sort[src].key = k; STATE.sort[src].dir = 'desc'; }
    src === 'lib' ? renderLibrary() : renderWishlist();
  }));
}
bindSort('lib-table', 'lib');
bindSort('wl-table', 'wl');

document.getElementById('triage-source').addEventListener('change', () => { triageIdx = 0; renderTriage(); });

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const triageActive = !document.getElementById('tab-triage').hidden;
  const recsActive = !document.getElementById('tab-recs').hidden;
  if (!triageActive && !recsActive) return;

  if (triageActive) {
    const items = buildTriageList();
    if (!items.length) return;
    const sel = document.getElementById('triage-source').value;
    const isLib = sel.startsWith('library');
    const b = items[triageIdx]; if (!b) return;
    if (e.key === 'k') { decide(b.asin, 'KEEP'); renderTriage(); }
    else if (e.key === 'l') { decide(b.asin, isLib ? 'LATER' : 'MAYBE'); renderTriage(); }
    else if (e.key === 'p') { decide(b.asin, isLib ? 'PASS' : 'CUT'); renderTriage(); }
    else if (e.key === 's') { triageIdx = Math.min(triageIdx + 1, items.length - 1); renderTriage(); }
    else if (e.key === 'j' || e.key === 'ArrowDown') { triageIdx = Math.min(triageIdx + 1, items.length - 1); renderTriage(); }
    else if (e.key === 'K' || e.key === 'ArrowUp') { triageIdx = Math.max(triageIdx - 1, 0); renderTriage(); }
    return;
  }

  // recs tab
  const items = buildRecsList();
  if (!items.length && e.key !== 'u' && e.key !== 'U') return;
  const b = items[recIdx];
  if (e.key === 'k' && b) commitRecDecision(b.asin, 'KEEP');
  else if (e.key === 'l' && b) commitRecDecision(b.asin, 'MAYBE');
  else if (e.key === 'p' && b) commitRecDecision(b.asin, 'CUT');
  else if (e.key === 's') skipRec();
  else if (e.key === 'u' || e.key === 'U') undoRec();
});

document.getElementById('reset-decisions').addEventListener('click', () => {
  const main = Object.keys(STATE.decisions).length;
  const rec = Object.keys(STATE.recDecisions).length;
  const total = main + rec;
  if (!total) return;
  const breakdown = main && rec ? ` (${main} triage · ${rec} recommendations)` : '';
  if (confirm(`Clear ${total} decision(s)?${breakdown}`)) {
    STATE.decisions = {}; STATE.recDecisions = {};
    saveDecisions(); saveRecDecisions();
    recHistory.length = 0;
    rerender();
    renderRecs();
  }
});

Promise.all([
  fetch('library.scored.json').then(r => r.json()),
  fetch('wishlist.scored.json').then(r => r.json()),
  fetch('recommendations.scored.json').then(r => r.ok ? r.json() : []).catch(() => []),
]).then(([lib, wl, recs]) => {
  LIB = lib.map(clean); WL = wl.map(clean); RECS = recs.map(clean);
  const clusters = [...new Set([...LIB, ...WL, ...RECS].map(b => b.cluster).filter(Boolean))].sort();
  ['lib-cluster','wl-cluster','recs-cluster'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    clusters.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c.replace(/_/g, ' ');
      sel.appendChild(o);
    });
  });
  rerender();
  renderRecs();
}).catch(err => {
  document.body.replaceChildren(makeEl('div', { style: 'padding:48px;text-align:center;color:var(--ink)' },
    makeEl('h2', {}, 'Failed to load data'),
    makeEl('p', {}, 'Open this page through the local server. Run: ', makeEl('code', {}, 'python3 -m http.server 8888'), ' then visit ', makeEl('code', {}, 'http://localhost:8888/dashboard.html')),
    makeEl('pre', {}, String(err))
  ));
});
