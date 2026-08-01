/* probe_conc — «Концентрация выручки» одинаковая в сводке и в финансах */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* реальные цифры агентства: APOLO 45/13.978, DETROYD TEST 20/10.2335,
   Artel 20/0, TRIA 15/10.9, Level Studio 0/0, DeTroyd System — завершён.
   выручка 100 млн → доля APOLO 45%; прибыль 64.8885 млн → доля APOLO 47.8% → 48% */
const DATA = [
  { id: 'a', name: 'APOLO COFFEE', status: 'active', mrr: 45000000, cost: 13978000 },
  { id: 'b', name: 'DETROYD TEST', status: 'active', mrr: 20000000, cost: 10233500 },
  { id: 'c', name: 'Artel', status: 'active', mrr: 20000000, cost: 0 },
  { id: 'd', name: 'TRIA SMART CORP', status: 'active', mrr: 15000000, cost: 10900000 },
  { id: 'e', name: 'Level Studio', status: 'active', mrr: 0, cost: 0 },
  { id: 'f', name: 'DeTroyd System', status: 'done', mrr: 0, cost: 0 },
];

const show = () => { const c = document.getElementById('content-ag'); if (!c) return;
  document.body.appendChild(c);
  c.style.cssText = 'position:fixed;left:0;top:0;width:1560px;height:900px;overflow:auto;background:#0a0d0c;z-index:1;display:block;padding:20px'; };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  console.log('\n[A] сводка');
  const ov = await page.evaluate((D) => {
    window.__me = { id: 'u1', full_name: 'd', role: 'agency_owner', agency_id: 'AG' };
    window.tMe = () => window.__me; window.toast = () => {};
    PROJECTS = D.map(p => Object.assign({}, p, { pct: 30, cat: '—', svc: '—', logo: p.name[0], logoUrl: null,
      _stot: 2, _sdone: 1, _overdue: false, _lastActDays: 1, _nextDue: null, createdAt: '2026-06-01' }));
    OVERVIEW._loaded = true; OVERVIEW.stageLoad = [];
    renderOverview();
    const cells = [...document.querySelectorAll('#content-ag .ov-quick-item')].map(c => ({
      l: c.querySelector('.l').textContent.trim(), v: c.querySelector('.v').textContent.trim(),
      s: (c.querySelector('.s') || {}).textContent || '' }));
    return cells.find(c => /Концентрация/.test(c.l)) || { cells };
  }, DATA);
  console.log('    ' + JSON.stringify(ov));
  ok('в сводке — концентрация выручки', /Концентрация выручки/.test(ov.l || ''), ov);
  ok('45% на крупнейшем проекте', ov.v === '45%', ov.v);
  ok('назван сам проект', /APOLO COFFEE/.test(ov.s || ''), ov.s);

  console.log('\n[B] финансы');
  const fin = await page.evaluate((D) => {
    const rows = D.filter(p => p.status !== 'done').map(p => ({ id: p.id, name: p.name, service: '—', status: p.status,
      cat: '—', tariff: '—', logo: p.name[0], logoUrl: '', mrr: p.mrr, cost: p.cost, trackedSec: 0, hours: 0, finance: {} }));
    const totalMrr = rows.reduce((s, p) => s + p.mrr, 0), totalCost = rows.reduce((s, p) => s + p.cost, 0);
    const profit = totalMrr - totalCost;
    const top = [...rows].sort((a, b) => b.mrr - a.mrr)[0];
    const topP = rows.map(p => ({ name: p.name, prof: p.mrr - p.cost })).filter(x => x.prof > 0).sort((a, b) => b.prof - a.prof)[0];
    const pay = rows.filter(p => p.mrr > 0);
    window.FINANCE = { ready: true, rows, projects: rows.map(p => Object.assign({}, p, { margin: p.mrr > 0 ? Math.round(100 * (p.mrr - p.cost) / p.mrr) : null, profit: p.mrr - p.cost })), totalMrr, totalCost, profit,
      marginPct: Math.round(100 * profit / totalMrr), costPct: Math.round(100 * totalCost / totalMrr),
      totalHours: 0, profitPerHour: 0, paying: pay.length, total: rows.length,
      avgMrr: Math.round(totalMrr / pay.length), avgCost: 0, avgProfit: 0,
      concentrationPct: Math.round(100 * top.mrr / totalMrr), concentrationTop: top.name,
      profConcPct: Math.round(100 * topP.prof / profit), profConcTop: topP.name, profConcAmt: topP.prof,
      services: [], tariffs: [], snapshots: [], prevSnap: null, cats: [] };
    renderFinance();
    const gs = [...document.querySelectorAll('#content-ag .fin-grid .fg')].map(g => ({
      l: g.querySelector('.l').textContent.trim(), v: g.querySelector('.gv').textContent.trim(),
      s: g.querySelector('.gs').textContent.trim() }));
    return { gs, conc: gs.find(g => /Концентрация/.test(g.l)), avg: gs.find(g => /Средний чек/.test(g.l)),
      mrr: window.FINANCE.totalMrr, prof: window.FINANCE.profit,
      cp: window.FINANCE.concentrationPct, pp: window.FINANCE.profConcPct };
  }, DATA);
  console.log('    ' + JSON.stringify(fin.gs));
  ok('в финансах тоже концентрация выручки', /^Концентрация выручки$/.test((fin.conc || {}).l || ''), fin.conc);
  ok('число совпало со сводкой', (fin.conc || {}).v === ov.v, [ov.v, (fin.conc || {}).v]);
  ok('доля прибыли осталась подписью', /48% прибыли/.test((fin.conc || {}).s || ''), fin.conc);
  ok('в подписи назван тот же проект', /APOLO COFFEE/.test((fin.conc || {}).s || ''), fin.conc);
  ok('одной «концентрации» на экране, а не двух', fin.gs.filter(g => /Концентрация/.test(g.l)).length === 1, fin.gs.map(g => g.l));
  ok('у среднего чека своя подпись, а не чужая концентрация', !/конц\./.test((fin.avg || {}).s || '') && /на платящий проект/.test((fin.avg || {}).s || ''), fin.avg);
  ok('арифметика на месте: 45 из 100 млн', fin.mrr === 100000000 && fin.cp === 45, fin);
  ok('и 48% прибыли из 64,9 млн', fin.prof === 64888500 && fin.pp === 48, fin);
  await page.evaluate(show);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/work/shot_fin.png', clip: await page.evaluate(() => {
    const b = document.querySelector('#content-ag .fin-grid').getBoundingClientRect();
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, 1560), height: Math.min(b.height, 400) }; }) });

  console.log('\n[C] крупнейший по выручке и по прибыли — разные проекты');
  const diff = await page.evaluate(() => {
    const F = window.FINANCE;
    F.concentrationTop = 'APOLO COFFEE'; F.profConcTop = 'Artel'; F.profConcPct = 31;
    renderFinance();
    const g = [...document.querySelectorAll('#content-ag .fin-grid .fg')].find(x => /Концентрация/.test(x.querySelector('.l').textContent));
    return g.querySelector('.gs').textContent.trim();
  });
  console.log('    ' + JSON.stringify(diff));
  ok('подпись не приписывает чужую долю', /APOLO COFFEE/.test(diff) && /по прибыли — Artel 31%/.test(diff), diff);

  console.log('\n[D] бюджетов нет');
  const zero = await page.evaluate(() => {
    const F = window.FINANCE; F.totalMrr = 0; F.concentrationPct = 0; F.profConcPct = 0; F.profConcTop = '—'; F.paying = 0;
    renderFinance();
    const g = [...document.querySelectorAll('#content-ag .fin-grid .fg')].find(x => /Концентрация/.test(x.querySelector('.l').textContent));
    const a = [...document.querySelectorAll('#content-ag .fin-grid .fg')].find(x => /Средний чек/.test(x.querySelector('.l').textContent));
    return { v: g.querySelector('.gv').textContent.trim(), s: g.querySelector('.gs').textContent.trim(), a: a.querySelector('.gs').textContent.trim() };
  });
  console.log('    ' + JSON.stringify(zero));
  ok('без бюджетов не выдумываем процент', zero.v === '—' && /бюджеты не заданы/.test(zero.s), zero);
  ok('и про средний чек сказано честно', /платящих проектов нет/.test(zero.a), zero.a);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[E] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
