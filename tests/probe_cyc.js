/* probe_cyc — рейтинги модуля «Циклы».
   Семь списков в модуле говорят об одном: что дольше всего. Проверяем не
   «строка отрисовалась», а те правила, ради которых блок переделан: одна
   высота строки во всех списках, доля показана один раз и считается от
   суммы, повтор не тиражируется по строкам, список не режется посередине. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* Данные под боевой случай: один проект, шесть этапов, девять задач —
   ровно тот набор, на котором блок и разъезжался. */
const seed = (multi) => {
  const H = 3600, M = 60;
  const day = n => new Date(Date.now() + n * 86400000).toISOString();
  const A = 'Qushbegi Milliy Taomla', B = 'APOLO COFFEE';
  TEAM = [{ _id: 'm1', name: 'Nurislam Aliyev', color: '#37E6C8', avatar: null },
          { _id: 'm2', name: 'Abdurauf Parpiyev', color: '#8A8FFF', avatar: null }];
  window.TEAM = TEAM; window.TEAM_ARCHIVED = [];
  const t = (title, sec, stage, tid, sid, done, prj) =>
    ({ title, sec, stage, project: prj || A, pid: 'p1', tid, sid, done, date: day(-2), asg: 'm1' });
  Object.assign(CYCLES, {
    _loaded: true, stages: [], chartStages: [], trend: { vals: [], labels: [] }, clients: [],
    agingRows: [], projMedianMs: null, projCount: 0, bottleneck: null,
    coverageDone: 0, coverageTotal: 0, coveragePct: 0, stuckNow: 0,
    reviewTasks: [t('Настроить клиентский кабинет', 2, 'ОПЕРАЦИОНКА', 'r1', 's1', false)],
    reviewNow: 0, reviewCount: 1, reviewTotalSec: 2, reviewAvgSec: 2, reviewStages: [], reviewByWho: [],
    apr: null,
    workTopTasks: [
      t('Заполнить паспорт проекта', 1.5 * H, 'ФОРМУЛИРОВАНИЕ ПАСПОРТА', 'w1', 'sa', true),
      t('Анализ конкурентов', 1.3 * H, 'АНАЛИЗ КОНКУРЕНТОВ', 'w2', 'sb', true),
      t('Разработать бриф', 1 * H, 'БРИФИНГ', 'w3', 'sc', true),
      t('Провести брифинг', 57 * M, 'БРИФИНГ', 'w4', 'sc', true),
      t('Написание сценариев для 10 reels', 41 * M, 'НАПИСАНИЕ СЦЕНАРИЕВ', 'w5', 'sd', false),
      t('Просмотреть паспорт проекта взять ключевые данные', 35 * M, 'ПОДБОР РЕФЕРЕНСОВ', 'w6', 'se', true),
      t('Подбор референсов и идей', 26 * M, 'ПОДБОР РЕФЕРЕНСОВ', 'w7', 'se', true),
      t('Настроить клиентскую группу', 25 * M, 'ОПЕРАЦИОНКА', 'w8', 's1', true),
      t('Настроить клиентский кабинет', 23 * M, 'ОПЕРАЦИОНКА', 'w9', 's1', true, multi ? B : A),
    ],
    workCount: 9, workTotalSec: 7.3 * H, workMedianSec: 41 * M, workMeanSec: 49 * M, workP90Sec: 1.4 * H,
    workDoneCount: 8, workDoneAvgSec: 50 * M, workStages: [], workByAsg: [], workParetoPct: 67,
  });
  REV_Q = ''; WORK_Q = ''; REV_PERIOD = 'all'; WORK_PERIOD = 'all';
  REV_SORT = 'desc'; WORK_SORT = 'desc'; REV_ASG = 'all'; WORK_ASG = 'all';
  REV_PROJ = 'all'; WORK_PROJ = 'all';
  renderCycles();
};
const show = () => { const c = document.getElementById('content-ag'); if (!c) return;
  document.body.appendChild(c);
  c.style.cssText = 'position:fixed;left:0;top:0;width:1560px;height:1000px;overflow:auto;background:#0a0d0c;z-index:9;display:block;padding:20px'; };

/* Второй список в блоке трудозатрат — «самые трудоёмкие задачи». */
const workGrid = () => document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div');

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1050 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    window.LIVE = false;
    window.tMe = () => ({ id: 'u1', full_name: 'Nurislam Aliyev', role: 'agency_owner', agency_id: 'AG' });
    window.ME = window.tMe(); window.toast = t => { window.__toast = String(t); };
    window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agIsPM = () => true;
    PROJECTS = [{ id: 'p1', name: 'Qushbegi Milliy Taomla', status: 'active', _stages: [], _tasks: [] }];
    window.PROJECTS = PROJECTS;
  });
  await page.evaluate(seed, false);
  await page.evaluate(show);
  await page.waitForTimeout(400);

  console.log('\n[A] строка одной высоты — иначе колонки разъезжаются');
  const A = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#content-ag .cyc-r')]
      .filter(r => r.offsetParent !== null);
    return { h: [...new Set(rows.map(r => Math.round(r.getBoundingClientRect().height)))], n: rows.length };
  });
  ok('у всех строк во всех списках одна высота', A.h.length === 1 && A.h[0] === 64, A);

  const B = await page.evaluate(() => {
    const g = [...document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div')];
    const top = c => [...c.querySelectorAll('.cyc-r')].filter(r => r.offsetParent !== null)
      .map(r => Math.round(r.querySelector('.cyc-r-val').getBoundingClientRect().top));
    return { l: top(g[0]), r: top(g[1]) };
  });
  ok('числа в левой и правой колонке стоят на одной высоте',
    B.l.length >= 6 && B.l.slice(0, 6).every((v, i) => Math.abs(v - B.r[i]) <= 1), B);

  console.log('\n[B] список не режется посередине');
  const C = await page.evaluate(() => {
    /* «Не режется» — это не про то, сколько строк влезло, а про то, что резать
       нечем: ни своей прокрутки, ни потолка высоты у списка нет. */
    const out = [];
    document.querySelectorAll('#content-ag .cyc-rows').forEach(l => {
      const cs = getComputedStyle(l);
      out.push({ ov: cs.overflowY, max: cs.maxHeight, disp: cs.display });
    });
    const g = [...document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div')][1];
    const rows = [...g.querySelectorAll('.cyc-r')];
    return { lists: out, total: rows.length,
      shown: rows.filter(r => r.offsetParent !== null).length,
      more: (g.querySelector('.cyc-more') || {}).textContent };
  });
  ok('резать нечем: ни своей прокрутки, ни потолка высоты',
    C.lists.length === 4 && C.lists.every(l => l.ov === 'visible' && l.max === 'none' && l.disp === 'block'), C.lists);
  ok('видно восемь строк из девяти', C.total === 9 && C.shown === 8, C);
  ok('под списком написано, сколько осталось', /Ещё\s*1/.test(C.more || ''), C.more);

  const D = await page.evaluate(() => {
    const g = [...document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div')][1];
    g.querySelector('.cyc-more').click();
    const rows = [...g.querySelectorAll('.cyc-r')];
    return { shown: rows.filter(r => r.offsetParent !== null).length, more: !!g.querySelector('.cyc-more') };
  });
  ok('«Ещё» раскрывает список целиком и исчезает', D.shown === 9 && D.more === false, D);

  console.log('\n[C] доля показана один раз и считается от суммы списка');
  const E = await page.evaluate(() => {
    const g = [...document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div')];
    const sh = c => [...c.querySelectorAll('.cyc-r')]
      .map(r => parseFloat(getComputedStyle(r).getPropertyValue('--cyc-sh')) || 0);
    const bars = c => [...c.querySelectorAll('.cyc-r')].filter(r => r.querySelector('.cyc-bar, .cyc-body .cyc-bar')).length;
    const st = sh(g[0]), tk = sh(g[1]);
    return { st, tk, sumSt: Math.round(st.reduce((a, x) => a + x, 0)), sumTk: Math.round(tk.reduce((a, x) => a + x, 0)),
      oldBars: bars(g[0]) + bars(g[1]),
      firstTk: tk[0] };
  });
  ok('доли этапов складываются в сто процентов', Math.abs(E.sumSt - 100) <= 1, E.sumSt);
  ok('доли задач тоже складываются в сто, а не считаются от максимума',
    Math.abs(E.sumTk - 100) <= 1 && E.firstTk < 40, { sum: E.sumTk, first: E.firstTk });
  ok('отдельной полосы в теле строки больше нет — доля живёт в основании', E.oldBars === 0, E.oldBars);

  const F = await page.evaluate(() => {
    const r = document.querySelector('#content-ag .cyc-card--work .rev-grid .cyc-r');
    const after = getComputedStyle(r, '::after');
    return { sh: getComputedStyle(r).getPropertyValue('--cyc-sh').trim(),
      bg: after.backgroundImage, h: after.height,
      anim: getComputedStyle(r).animationName };
  });
  ok('полоса нарисована без анимации: доля видна сразу, а не после кадров',
    parseFloat(F.sh) > 0 && /linear-gradient/.test(F.bg) && !/cycFill/.test(F.anim), F);

  console.log('\n[D] в строке не осталось двойного сигнала');
  const G = await page.evaluate(() => {
    const g = [...document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div')];
    const cell = c => [...c.querySelectorAll('.cyc-r')].map(r => (r.querySelector('.cyc-r-s') || {}).textContent.trim());
    const rk = [...document.querySelectorAll('#content-ag .cyc-r-n')].map(n => ({
      t: n.textContent.trim(), bg: getComputedStyle(n).backgroundColor, w: Math.round(n.getBoundingClientRect().width) }));
    return { st: cell(g[0]), tk: cell(g[1]), rk: rk.slice(0, 4) };
  });
  ok('у этапов вторая строка — доля, и только она', G.st.every(x => /^\d+%$/.test(x)), G.st);
  ok('у задач вторая строка — состояние, а не второй процент',
    G.tk.every(x => /^(готово|в работе)$/.test(x)), G.tk);
  ok('номер строки — порядок, а не медаль: без плашек',
    G.rk.every(r => /^0\d$/.test(r.t) && /rgba\(0, 0, 0, 0\)|transparent/.test(r.bg)), G.rk);

  console.log('\n[E] повтор не тиражируется по строкам');
  const H = await page.evaluate(() => {
    const g = [...document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div')][1];
    return { head: (g.querySelector('.cyc-lh-x') || {}).textContent || '',
      inRows: g.querySelectorAll('.cyc-r .cyc-pchip').length };
  });
  ok('один проект на весь список — его имя написано в заголовке один раз',
    /Qushbegi/.test(H.head) && H.inRows === 0, H);

  await page.evaluate(seed, true);
  await page.waitForTimeout(200);
  const I = await page.evaluate(() => {
    const g = [...document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div')][1];
    return { head: (g.querySelector('.cyc-lh-x') || {}).textContent || '',
      inRows: g.querySelectorAll('.cyc-r .cyc-pchip').length };
  });
  ok('проектов несколько — метка возвращается в строки, из заголовка уходит',
    I.head === '' && I.inRows === 9, I);

  console.log('\n[F] переход по строке остался');
  const J = await page.evaluate(() => {
    window.__go = null; window.dlGoto = (...a) => { window.__go = a; };
    const g = [...document.querySelectorAll('#content-ag .cyc-card--work .rev-grid > div')];
    const task = g[1].querySelector('.cyc-r.cyc-go');
    const stage = g[0].querySelector('.cyc-r.cyc-go');
    const cur = getComputedStyle(task).cursor;
    task.click();
    return { go: window.__go, cur, stageHasData: !!(stage && stage.dataset.st) };
  });
  ok('строка задачи по-прежнему ведёт на доску', Array.isArray(J.go) && J.go[1] === 'task', J.go);
  ok('и выглядит нажимаемой', J.cur === 'pointer', J.cur);
  ok('строка этапа помнит, какой этап открыть', J.stageHasData === true, J);

  console.log('\n[G] фильтры стоят одной строкой');
  const K = await page.evaluate(() => {
    const f = document.querySelector('#content-ag .cyc-card--work .cyc-filters');
    const kids = [...f.children].map(c => c.getBoundingClientRect());
    return { h: Math.round(f.getBoundingClientRect().height), n: kids.length,
      tall: Math.round(Math.max(...kids.map(k => k.height))) };
  });
  ok('пять полей помещаются в одну строку, а не рвутся на 4 + 1',
    K.n === 5 && K.h <= K.tall + 2, K);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read|Cannot set/.test(e));
  console.log('\n[H] ошибки страницы');
  ok('нет ошибок исполнения', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
