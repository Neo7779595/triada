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
  /* Плитка про выручку живёт вместе с разделом «Финансы». Раздел агентству
     не показывают — и доля крупнейшего клиента в сводке становится цифрой
     ниоткуда: денег в интерфейсе нет, а процент от них есть. Проверяем оба
     состояния: с включённым разделом плитка на месте, с выключенным её нет. */
  const свод = async (модули) => page.evaluate(([D, m]) => {
    window.__me = { id: 'u1', full_name: 'd', role: 'agency_owner', agency_id: 'AG' };
    if (m) window.__me.agencyModules = m;
    window.tMe = () => window.__me; window.toast = () => {};
    PROJECTS = D.map(p => Object.assign({}, p, { pct: 30, cat: '—', svc: '—', logo: p.name[0], logoUrl: null,
      _stot: 2, _sdone: 1, _overdue: false, _lastActDays: 1, _nextDue: null, createdAt: '2026-06-01' }));
    OVERVIEW._loaded = true; OVERVIEW.stageLoad = [];
    renderOverview();
    const cells = [...document.querySelectorAll('#content-ag .ov-quick-item')].map(c => ({
      l: c.querySelector('.l').textContent.trim(), v: c.querySelector('.v').textContent.trim(),
      s: (c.querySelector('.s') || {}).textContent || '' }));
    return { плитка: cells.find(c => /Концентрация/.test(c.l)) || null, всего: cells.length };
  }, [DATA, модули]);
  const ovOn = await свод({ finance: true });
  const ovOff = await свод(null);
  const ov = ovOn.плитка || {};
  console.log('    ' + JSON.stringify(ovOn));
  ok('в сводке — концентрация выручки', /Концентрация выручки/.test(ov.l || ''), ovOn);
  ok('45% на крупнейшем проекте', ov.v === '45%', ov.v);
  ok('назван сам проект', /APOLO COFFEE/.test(ov.s || ''), ov.s);
  ok('раздел «Финансы» выключен — плитки про выручку нет вовсе',
    ovOff.плитка === null && ovOff.всего === ovOn.всего - 1, [ovOff, ovOn.всего]);

  console.log('\n[B] финансы: концентрация теперь считается по деньгам и названа иначе');
  /* Раньше на двух экранах стояли два числа под одним названием
     «Концентрация выручки»: в сводке — доля крупнейшего в сумме договоров,
     в финансах — доля в прибыли. Числа расходились (45% против 48%), и по
     названию нельзя было понять, какое из них про что.

     Теперь в финансах вопрос другой: какую долю денег, реально пришедших
     за месяц, принёс один клиент. Это другая база — значит, и название
     другое: «Концентрация прихода». Одинаково назвать разное — та же
     ошибка, что и по-разному назвать одинаковое.

     ── На бумаге ─────────────────────────────────────────────────────
     APOLO заплатил 45 000 000, DETROYD 20 000 000, ещё 5 000 000 пришло
     без проекта. Всего пришло 70 000 000, доля APOLO = 45/70 = 64,3% → 64%. */
  const fin = await page.evaluate((D) => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    const rows = D.filter(p => p.status !== 'done').map(p => ({ id: p.id, name: p.name, service: '—', status: p.status,
      cat: '—', tariff: '—', logo: p.name[0], logoUrl: '', mrr: p.mrr, cost: p.cost, trackedSec: 0, hours: 0, finance: {} }));
    const totalMrr = rows.reduce((s, p) => s + p.mrr, 0), totalCost = rows.reduce((s, p) => s + p.cost, 0);
    const pay = rows.filter(p => p.mrr > 0);
    window.FINANCE = { ready: true, rows, projects: rows, totalMrr, totalCost, profit: totalMrr - totalCost,
      marginPct: 65, costPct: 35, totalHours: 0, profitPerHour: 0, paying: pay.length, total: rows.length,
      avgMrr: Math.round(totalMrr / pay.length), services: [], tariffs: [], snapshots: [], prevSnap: null, cats: [] };
    window._FINOFF = 0;
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: '1', op_date: td, kind: 'income', amount: 45000000, account_id: 'W', project_id: 'a' },
             { id: '2', op_date: td, kind: 'income', amount: 20000000, account_id: 'W', project_id: 'b' },
             { id: '3', op_date: td, kind: 'income', amount: 5000000,  account_id: 'W' } ] };
    window.FINP = []; window.FINO = []; window.FINS = {};
    renderFinance();
    const root = document.getElementById('content-ag');
    const tile = lbl => { const c = [...root.querySelectorAll('.fst-c')]
      .find(e => new RegExp(lbl).test((e.querySelector('.l') || {}).textContent || ''));
      return c ? { l: c.querySelector('.l').textContent.trim(),
                   v: c.querySelector('.v').textContent.trim(),
                   s: (c.querySelector('.s') || {}).textContent.trim() } : null; };
    return { conc: tile('Концентрация'), avg: tile('Средний чек'),
      txt: (root.textContent || '').replace(/\s+/g, ' '),
      concCount: [...root.querySelectorAll('.fst-c .l')].filter(e => /Концентрация/.test(e.textContent)).length };
  }, DATA);
  console.log('    ' + JSON.stringify(fin.conc));
  ok('в финансах концентрация названа по своей базе — прихода, а не выручки',
    /^Концентрация прихода$/.test((fin.conc || {}).l || ''), fin.conc);
  ok('и не выдаёт себя за число из сводки: 45 из 70 млн — 64%',
    (fin.conc || {}).v === '64%' && fin.conc.v !== ov.v, [(fin.conc || {}).v, ov.v]);
  ok('назван тот же проект и сказано, что это доля в приходе',
    /APOLO COFFEE/.test((fin.conc || {}).s || '') && /доля в приходе/.test((fin.conc || {}).s || ''), fin.conc);
  ok('одной «концентрации» на экране, а не двух', fin.concCount === 1, fin.concCount);
  ok('у среднего чека своя подпись, а не чужая концентрация',
    !/конц\./.test((fin.avg || {}).s || '') && /по договорам/.test((fin.avg || {}).s || ''), fin.avg);
  ok('и сказано, что средний чек — про договоры, а приход — про деньги',
    /не по деньгам/.test(fin.txt), fin.txt.slice(0, 40));
  await page.evaluate(show);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/work/shot_fin.png', clip: await page.evaluate(() => {
    const b = document.querySelector('#content-ag .fst').getBoundingClientRect();
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, 1560), height: Math.min(b.height, 400) }; }) });

  console.log('\n[C] оплат за месяц не было');
  /* Ноль в проценте — это утверждение «зависимости нет», и оно неверно, когда
     считать просто не из чего. Прочерк и объяснение честнее. */
  const zero = await page.evaluate(() => {
    window.FINX.ops = [];
    renderFinance();
    const root = document.getElementById('content-ag');
    const c = [...root.querySelectorAll('.fst-c')]
      .find(e => /Концентрация/.test((e.querySelector('.l') || {}).textContent || ''));
    return c ? { v: c.querySelector('.v').textContent.trim(), s: c.querySelector('.s').textContent.trim() } : null;
  });
  console.log('    ' + JSON.stringify(zero));
  ok('без оплат не выдумываем процент', zero && zero.v === '—', zero);
  ok('и сказано, почему прочерк', zero && /оплат за месяц не было/.test(zero.s), zero);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[E] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
