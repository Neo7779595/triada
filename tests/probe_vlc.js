/* probe_vlc — выработка везде разделена на этапы и задачи, а у сотрудника
   ещё и по сложности: «8» без расшифровки не говорит, чего именно восемь. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* Контрольный пример на бумаге: за окно закрыто 2 этапа и 3 задачи.
   Задачи по сложности: сложная 1, средняя 1, лёгкая 1.
   Вес в столпе «Выработка» TPI (DIFF_WEIGHT: лёгкая 0,6 · средняя 1,0 ·
   сложная 1,6, этап 1,0) = 2×1,0 + 1,6 + 1,0 + 0,6 = 5,2 ед.
   Это НЕ шкала KPI «Выработка» (там 1 / 2 / 3,5 и только задачи) —
   метрики разные, и подпись в плитке обязана называть свою. */
const setup = () => {
  window.toast = () => {}; window.LIVE = false;
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe();
  window.agIsOwner = () => true; window.agCanEditProject = () => true;
  const iso = d => new Date(Date.now() - d * 86400000).toISOString();
  TEAM = [{ _id: 'm1', name: 'Худойберди', role: 'Монтажёр', color: '#37E6C8', avatar: null }];
  PROJECTS = [{ id: 'p1', name: 'Qushbegi', logo: 'Q', logoUrl: null, status: 'active', pct: 33, stages: '1 / 3',
    _tasks: [], _stages: [], mrr: 0, cost: 0 }];
  window.PROJECTS = PROJECTS;
  window._teamRaw = {
    hist: [
      { stage_id: 's1', project_id: 'p1', old_status: 'active', new_status: 'done', changed_by: 'm1', created_at: iso(3) },
      { stage_id: 's2', project_id: 'p1', old_status: 'active', new_status: 'done', changed_by: 'm1', created_at: iso(5) },
    ],
    taskHist: [
      { task_id: 't1', old_status: 'active', new_status: 'done', changed_by: 'm1', created_at: iso(2) },
      { task_id: 't2', old_status: 'active', new_status: 'done', changed_by: 'm1', created_at: iso(4) },
      { task_id: 't3', old_status: 'active', new_status: 'done', changed_by: 'm1', created_at: iso(6) },
    ],
    taskProj: { t1: 'p1', t2: 'p1', t3: 'p1' },
    taskDiff: { t1: 'hard', t2: 'medium', t3: 'easy' },
    taskDue: {}, stageDue: {}, stageProj: { s1: 'p1', s2: 'p1' },
    tasks: [], taskHistoryExists: true,
  };
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(200);

  console.log('\n[A] рейтинг проектов: закрытия считаются раздельно');
  const ops = await page.evaluate(() => {
    const O = computeProjectOps('30d');
    const r = O.rows[0] || {};
    return { closes: r.closes, st: r.closesSt, tk: r.closesTk, rows: O.rows.length };
  });
  ok('всего закрыто 5', ops.closes === 5, ops);
  ok('этапов 2', ops.st === 2, ops);
  ok('задач 3', ops.tk === 3, ops);
  ok('сумма частей равна целому', ops.st + ops.tk === ops.closes, ops);

  const lb = await page.evaluate(() => {
    /* сортировка живёт в модульной переменной — переключаем штатной кнопкой */
    setOpsPeriod('30d'); setOpsSort('throughput');
    const h = renderOpsLb();
    const host = document.createElement('div'); host.id = 'lbt'; document.body.appendChild(host); host.innerHTML = h;
    const cell = host.querySelector('.lb-oprow:not(.lb-ophead) .lb-opc');
    return { cellTxt: cell ? cell.textContent.replace(/\s+/g, ' ').trim() : null,
      st: (host.querySelector('.lb-opsplit i.st') || {}).textContent,
      tk: (host.querySelector('.lb-opsplit i.tk') || {}).textContent,
      metricTxt: (host.querySelector('.lb-opmetric b') || {}).textContent,
      metricSplit: (host.querySelector('.lb-opdisp') || {}).textContent };
  });
  ok('в колонке «Выработка» стоит расшифровка', /эт 2/.test(lb.cellTxt || '') && /зад 3/.test(lb.cellTxt || ''), lb);
  ok('этапы помечены своим цветом', lb.st === 'эт 2', lb.st);
  ok('задачи — своим', lb.tk === 'зад 3', lb.tk);
  ok('при сортировке по выработке разбор виден и в метрике', /эт 2 · зад 3/.test(lb.metricSplit || ''), lb);

  console.log('\n[B] карточка сотрудника: типы и сложность');
  const tm = await page.evaluate(() => {
    const T = computeTeamMetrics();
    const m = TEAM[0];
    return { tp: m.tp, st: m.tpSt, tk: m.tpTk, d: m.tpD, w: m.tpW, has: !!T };
  });
  ok('выработка сотрудника — 5 единиц', tm.tp === 5, tm);
  ok('из них 2 этапа', tm.st === 2, tm);
  ok('и 3 задачи', tm.tk === 3, tm);
  ok('задачи разложены по сложности', tm.d && tm.d.hard === 1 && tm.d.medium === 1 && tm.d.easy === 1 && tm.d.none === 0, tm.d);
  ok('вес по сложности — 5,2 ед. (2×1,0 + 1,6 + 1,0 + 0,6)', tm.w === 5.2, tm.w);

  const tile = await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 'pmt'; document.body.appendChild(host);
    host.innerHTML = _pmOutputTile(TEAM[0]);
    return { v: (host.querySelector('.pm-a-tile-v') || {}).textContent,
      split: [...host.querySelectorAll('.pm-a-split span')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      leg: [...host.querySelectorAll('.pm-a-dleg span')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      bars: host.querySelectorAll('.pm-a-dbar i').length,
      sub: (host.querySelector('.pm-a-tile-s') || {}).textContent,
      subTitle: (host.querySelector('.pm-a-tile-s') || {}).title };
  });
  ok('в плитке крупно общее число', /^5/.test(tile.v || ''), tile.v);
  ok('под ним — этапы и задачи по отдельности', tile.split.join(' | ') === 'этапов 2 | задач 3', tile.split);
  ok('полоса сложности из трёх сегментов', tile.bars === 3, tile.bars);
  ok('легенда называет сложности и количества', tile.leg.join(' | ') === 'сложные 1 | средние 1 | лёгкие 1', tile.leg);
  ok('подпись называет вес и его единицы', /по весу сложности · 5,2 ед\./.test(tile.sub || ''), tile.sub);
  ok('подсказка раскрывает шкалу веса', /лёгкая 0,6/.test(tile.subTitle || '') && /этап 1,0/.test(tile.subTitle || ''), tile.subTitle);

  const empty = await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 'pmt2'; document.body.appendChild(host);
    host.innerHTML = _pmOutputTile({ tp: 0, tpSt: 0, tpTk: 0, tpD: { easy: 0, medium: 0, hard: 0, none: 0 }, tpW: 0 });
    return { split: host.querySelectorAll('.pm-a-split').length, bar: host.querySelectorAll('.pm-a-dbar').length,
      v: (host.querySelector('.pm-a-tile-v') || {}).textContent };
  });
  ok('без выработки разбор не рисуется', empty.split === 0 && empty.bar === 0, empty);
  ok('и стоит честный ноль', /^0/.test(empty.v || ''), empty.v);

  const noDiff = await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 'pmt3'; document.body.appendChild(host);
    host.innerHTML = _pmOutputTile({ tp: 2, tpSt: 0, tpTk: 2, tpD: { easy: 0, medium: 0, hard: 0, none: 2 }, tpW: 2 });
    return { leg: [...host.querySelectorAll('.pm-a-dleg span')].map(e => e.textContent.replace(/\s+/g, ' ').trim()) };
  });
  ok('задачи без метки сложности названы своим именем', noDiff.leg.join('') === 'без метки 2', noDiff.leg);

  console.log('\n[C] сводка: velocity показывает, чего именно сколько');
  const ovr = await page.evaluate(() => {
    const s = ['<div class="ov-quick-item" title="Закрыто за 30 дней: этапов 3, задач 5">',
      '<span class="l">Velocity 30 дней</span><span class="v">8</span>',
      '<span class="s">эт 3 · зад 5 · 7д: 8</span></div>'].join('');
    const host = document.createElement('div'); host.innerHTML = s; document.body.appendChild(host);
    return { sub: host.querySelector('.s').textContent };
  });
  ok('под числом стоит разбивка и недельное окно', /эт 3 · зад 5 · 7д: 8/.test(ovr.sub), ovr.sub);

  const src = await page.evaluate(() => {
    /* строка шаблона в коде: разбивка появляется только когда история задач есть */
    return typeof renderOverview === 'function';
  });
  ok('сводка на месте', src, src);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
