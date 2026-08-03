/* probe_agrid — единая сетка модулей агентства: где начинается первый блок,
   какой шаг между блоками, одна ли строка у панели управления.

   Числа взяты с бумаги, а не с экрана:
   · 26 — поле контейнера `.content` (padding:26px), значит первый блок
     стоит ровно на нём, без собственного отступа сверху;
   · 16 — единый шаг между блоками верхнего уровня;
   · 40 — рост органов управления в строке (поиск, «Фильтры», выпадающие,
     сегмент): раньше поле поиска было 42, и строка читалась кривой.
   «Калькулятор» и «Почта» в список не входят: они намеренно во всю
   площадь, с полем −26. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const PAD = 26, STEP = 16, CTRL = 40;
const MODS = ['projects', 'deadlines', 'calendar', 'overview', 'cycles', 'finance',
              'team', 'kpi', 'leaderboard', 'kb', 'tools', 'integrations'];
const FULL = ['calc', 'mail'];

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'probe' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.toast = () => {}; window.LIVE = false;
  window.agIsOwner = () => true; window.agIsPM = () => true; window.agIsDirector = () => true;
  window.agCanView = () => true; window.agCanEdit = () => true; window.agCanEditProject = () => true;
  window.giEnsureStatus = async () => ({ status: 'active' });
  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  TEAM = [{ _id: 'm1', name: 'Худойберди', role: 'Оператор', color: '#37E6C8', avatar: null },
          { _id: 'm2', name: 'Азиз', role: 'Монтажёр', color: '#F5C542', avatar: null }];
  const P = (id, name, st) => ({ id, name, logo: name[0], logoUrl: null, cat: 'IT компания', svc: 'SMM',
    pct: 30, stages: '2 / 6', status: st, mrr: 6000000, cost: 3000000, tg_chat_id: null, contacts: null, ui: null,
    lead_id: 'm1', cl_hidden: [], _stages: [], _tasks: [], _reports: [], _team: TEAM,
    _pipeline: { done: 2, active: 1, wait: 3, total: 6 }, _overdue: 1, _overdueAll: 3,
    _contract: { end: day(78) } });
  PROJECTS = [P('p1', 'TRIA SMART CORP', 'active'), P('p2', 'APOLO COFFEE', 'active'),
              P('p3', 'Artel', 'active'), P('p4', 'Chorsu', 'done')];
  if (typeof DEADLINES !== 'undefined') {
    DEADLINES.length = 0;
    [['Съёмка', -3], ['Монтаж', 0], ['Публикация', 2], ['Отчёт', 9]].forEach((x, i) => DEADLINES.push({
      _id: 'd' + i, pid: 'p1', project: 'TRIA SMART CORP', stage: x[0], type: i % 2 ? 'task' : 'stage',
      due: day(x[1]), day: String(new Date(Date.now() + x[1] * 86400000).getDate()),
      mon: 'авг', status: 'active', assignee_id: 'm1' }));
  }
  [...document.body.children].forEach(e => { if (e.id !== 'app-ag' && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName)) e.style.display = 'none'; });
  document.getElementById('app-ag').classList.add('on');
};

/* Раскладку меряем в покое: у `.content` анимация появления, и первый
   кадр даёт не ту геометрию, что установившееся состояние. */
const measure = (m) => {
  agNav(m);
  const c = document.getElementById('content-ag');
  const cb = c.getBoundingClientRect();
  const vis = [...c.children].filter(e => getComputedStyle(e).display !== 'none');
  if (!vis.length) return { m, empty: true };
  const box = e => e.getBoundingClientRect();
  const first = box(vis[0]);
  return { m,
    top: Math.round(first.top - cb.top),
    left: Math.round(first.left - cb.left),
    right: Math.round(cb.right - first.right),
    gaps: vis.slice(1).map((e, i) => Math.round(box(e).top - box(vis[i]).bottom)),
    firstCls: (vis[0].className || vis[0].tagName).toString().slice(0, 30) };
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.evaluate(setup);
  await page.waitForTimeout(350);

  console.log('\n[A] первый блок каждого модуля стоит на одном месте');
  const seen = [];
  for (const m of MODS) {
    const r = await page.evaluate(measure, m);
    await page.waitForTimeout(140);
    seen.push(r);
  }
  const badTop = seen.filter(r => !r.empty && r.top !== PAD);
  ok('первый блок начинается ровно на поле контейнера — 26 px, во всех модулях',
    badTop.length === 0, badTop.map(r => [r.m, r.top, r.firstCls]));
  const badSide = seen.filter(r => !r.empty && (r.left !== PAD || r.right < 0));
  ok('левый край первого блока тоже на поле — 26 px', badSide.length === 0,
    badSide.map(r => [r.m, r.left, r.right]));
  ok('модули отрисовались все', seen.filter(r => r.empty).length === 0, seen.filter(r => r.empty).map(r => r.m));

  console.log('\n[B] шаг между блоками верхнего уровня один на весь кабинет');
  const badGap = seen.flatMap(r => (r.gaps || []).map((g, i) => g === STEP ? null : [r.m, i, g]).filter(Boolean));
  ok('между соседними блоками ровно 16 px — без 22, 14, 12 и −4', badGap.length === 0, badGap);

  console.log('\n[C] калькулятор и почта — во всю площадь, это исключение');
  for (const m of FULL) {
    const r = await page.evaluate(measure, m);
    await page.waitForTimeout(140);
    ok('«' + m + '» занимает всю площадь без полей контейнера', r.top === 0 && r.left === 0, r);
  }

  console.log('\n[D] панель управления — одна строка, органы одного роста');
  for (const m of ['projects', 'deadlines']) {
    const r = await page.evaluate((mm) => {
      agNav(mm);
      const t = document.querySelector('#content-ag .toolbar');
      const kids = [...t.children].filter(e => getComputedStyle(e).display !== 'none'
        && e.getBoundingClientRect().height > 0 && !/tb-adv/.test(e.className));
      return { h: Math.round(t.getBoundingClientRect().height),
        tops: [...new Set(kids.map(e => Math.round(e.getBoundingClientRect().top)))],
        hs: [...new Set(kids.map(e => Math.round(e.getBoundingClientRect().height)))],
        n: kids.length,
        bars: document.querySelectorAll('#content-ag .toolbar').length };
    }, m);
    await page.waitForTimeout(180);
    ok('«' + m + '»: фильтры не уходят на второй ряд — панель ровно 40 px', r.h === CTRL, r);
    ok('«' + m + '»: всё в строке стоит на одной линии', r.tops.length === 1, r.tops);
    ok('«' + m + '»: поиск, «Фильтры» и сегмент одного роста — 40 px', r.hs.length === 1 && r.hs[0] === CTRL, r.hs);
    ok('«' + m + '»: панель управления одна, а не две', r.bars === 1, r.bars);
  }

  console.log('\n[E] расширенные фильтры открываются поповером');
  const pop = await page.evaluate(() => {
    agNav('projects');
    const closed = getComputedStyle(document.querySelector('#content-ag .tb-adv')).display;
    window._tbAdvSet(true);
    const a = document.querySelector('#content-ag .tb-adv');
    const t = document.querySelector('#content-ag .toolbar');
    const btn = document.querySelector('#content-ag .tb-fbtn');
    const ab = a.getBoundingClientRect(), tb = t.getBoundingClientRect();
    const r = { closed, open: getComputedStyle(a).display, pos: getComputedStyle(a).position,
      belowBar: Math.round(ab.top - tb.bottom), inBar: a.parentElement === t,
      btnOn: btn.classList.contains('on'), barH: Math.round(tb.height),
      btnShown: getComputedStyle(btn).display !== 'none' };
    window._tbAdvSet(false);
    r.closedAgain = getComputedStyle(a).display;
    return r;
  });
  console.log('    ' + JSON.stringify(pop));
  ok('кнопка «Фильтры» на десктопе видна', pop.btnShown, pop);
  ok('в покое расширенные фильтры свёрнуты', pop.closed === 'none', pop.closed);
  ok('по кнопке они раскрываются поповером, а не втискиваются в строку',
    pop.open === 'grid' && pop.pos === 'absolute', pop);
  ok('поповер висит под панелью и не растягивает её', pop.belowBar === 8 && pop.barH === CTRL, pop);
  ok('кнопка подсвечена, пока фильтры открыты', pop.btnOn === true, pop);
  ok('повторное нажатие закрывает', pop.closedAgain === 'none', pop.closedAgain);

  console.log('\n[F] в «Дедлайнах» нет полосы-вердикта');
  const dl = await page.evaluate(() => { agNav('deadlines');
    const c = document.getElementById('content-ag');
    return { insight: !!c.querySelector('.dl-insight'),
      first: (c.children[0].className || c.children[0].tagName).toString(),
      firstVisible: (([...c.children].find(e => getComputedStyle(e).display !== 'none') || {}).className || '').toString() };
  });
  ok('полоса «просрочено · сегодня · впереди» словами убрана — рядом те же числа плитками',
    dl.insight === false, dl);
  ok('первым видимым блоком идут плитки', /px-ov/.test(dl.firstVisible), dl.firstVisible);

  if (errs.length) ok('страница не сыпала ошибок', false, errs.slice(0, 4));
  console.log(`\n──────── ${pass} ok · ${fail} fail ────────`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
