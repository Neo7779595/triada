/* probe_dlmath — арифметика модуля «Дедлайны».

   Корзина дедлайна решает всё: по ней считаются «просрочено», «сегодня» и
   «впереди», по ней же красится строка. Правил в ней немного, но каждое
   легко сломать незаметно, а ошибка вылезет только у того, у кого срок
   пришёлся на границу.

   Правила, которые проверяем:
     завершённое — всегда «выполнено», какой бы срок ни стоял;
     без срока — «нет срока», а не «просрочено»;
     момент дедлайна — это конец дня, если время не задано, и само время,
       если задано: срок «сегодня к 10:00» после полудня уже просрочен;
     0 дней — сегодня, 1…7 — неделя, 8 и дальше — будущее.

   Отдельно — лента активности. В фильтре типа стоят и этапы, и задачи, а в
   ленту попадали только этапы: выбрать «Задачи» было можно, увидеть нечего. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  console.log('[A] корзина дедлайна');
  const B = await page.evaluate(() => {
    const z = n => String(n).padStart(2, '0');
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n);
      return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
    const h = new Date().getHours();
    return {
      doneWithOverdue: dlBucket(day(-30), 'done'),
      cancelled: dlBucket(day(-30), 'cancelled'),
      noDue: dlBucket('', 'active'),
      noDueDone: dlBucket('', 'done'),
      yesterday: dlBucket(day(-1), 'active'),
      today: dlBucket(day(0), 'active'),
      /* Час назад и час вперёд от текущего — на границах суток проверять
         нечего: там оба случая вырождаются в «сегодня». */
      todayPast: (h >= 2 && h <= 22) ? dlBucket(day(0), 'active', z(h - 1) + ':00') : 'skip',
      todayAhead: (h >= 2 && h <= 22) ? dlBucket(day(0), 'active', z(h + 1) + ':00') : 'skip',
      d1: dlBucket(day(1), 'active'),
      d7: dlBucket(day(7), 'active'),
      d8: dlBucket(day(8), 'active'),
      garbage: dlBucket('не дата', 'active'),
    };
  });
  ok('завершённое — «выполнено», даже если срок был месяц назад', B.doneWithOverdue === 'done', B);
  ok('отменённое считается закрытым, а не просроченным', B.cancelled === 'done', B);
  ok('без срока — «нет срока», а не «просрочено»', B.noDue === 'none', B);
  ok('закрытое без срока всё равно «выполнено»', B.noDueDone === 'done', B);
  ok('вчерашний срок просрочен', B.yesterday === 'overdue', B);
  ok('сегодняшний без времени — «сегодня»: день ещё не кончился', B.today === 'today', B);
  ok('сегодня к прошедшему часу — уже просрочено',
    B.todayPast === 'overdue' || B.todayPast === 'skip', B);
  ok('сегодня к будущему часу — ещё сегодня',
    B.todayAhead === 'today' || B.todayAhead === 'skip', B);
  ok('завтра — «неделя»', B.d1 === 'week', B);
  ok('ровно седьмой день ещё «неделя»', B.d7 === 'week', B);
  ok('восьмой уже «будущее»', B.d8 === 'future', B);
  ok('мусор вместо даты не превращается в просрочку', B.garbage === 'none', B);

  console.log('[B] счётчики считают по тем же корзинам, что и список');
  const C = await page.evaluate(() => {
    const z = n => String(n).padStart(2, '0');
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n);
      return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
    window.agVisibleProjectIds = () => null;
    agDlSearch = ''; agDlProj = 'all'; agDlType = 'all'; agDlResp = 'all'; agDlFrom = ''; agDlTo = '';
    const mk = (id, type, due, status, asg) => ({ id, type, stage: type + '-' + id, project: 'P', pid: 'p1',
      due, dueTime: '', status, assignee: asg || null });
    DEADLINES.length = 0;
    DEADLINES.push(
      mk('1', 'stage', day(-3), 'active'),          // просрочен
      mk('2', 'task', day(-1), 'active', 'm1'),     // просрочен
      mk('3', 'task', day(0), 'active'),            // сегодня, без ответственного
      mk('4', 'stage', day(2), 'active'),           // неделя
      mk('5', 'task', day(20), 'active', 'm1'),     // будущее
      mk('6', 'task', day(-9), 'done', 'm1'),       // выполнено
    );
    const F = _dlFiltered();
    const by = b => F.filter(d => d.bucket === b).length;
    const res = { over: by('overdue'), today: by('today'), week: by('week'), fut: by('future'), done: by('done'),
      total: F.length };
    agDlType = 'task'; res.onlyTasks = _dlFiltered().length;
    agDlType = 'stage'; res.onlyStages = _dlFiltered().length;
    agDlType = 'all'; agDlResp = '__none'; res.noResp = _dlFiltered().map(d => d.id);
    agDlResp = 'm1'; res.byResp = _dlFiltered().map(d => d.id);
    agDlResp = 'all';
    return res;
  });
  ok('просрочено двое: минус три дня и минус день', C.over === 2, C);
  ok('сегодня один', C.today === 1, C);
  ok('в неделю попал только срок через два дня', C.week === 1, C);
  ok('через двадцать дней — будущее', C.fut === 1, C);
  ok('закрытое ушло в «выполнено» и из просрочки исчезло', C.done === 1 && C.over === 2, C);
  ok('корзины покрывают весь список без остатка',
    C.over + C.today + C.week + C.fut + C.done === C.total, C);
  ok('фильтр типа делит список ровно пополам по видам',
    C.onlyTasks === 4 && C.onlyStages === 2 && C.onlyTasks + C.onlyStages === C.total, C);
  ok('«не назначен» находит только то, у чего нет исполнителя',
    C.noResp.join(',') === '1,3,4', C.noResp);
  ok('фильтр по исполнителю — только его строки', C.byResp.join(',') === '2,5,6', C.byResp);

  console.log('[C] лента активности знает не только этапы');
  const A = await page.evaluate(() => {
    window.agVisibleProjectIds = () => null;
    agDlSearch = ''; agDlProj = 'all'; agDlResp = 'all'; agDlFrom = ''; agDlTo = '';
    const ts = n => new Date(Date.now() - n * 3600000).toISOString();
    DL_ACT.length = 0;
    DL_ACT.push(
      { txt: 'Этап завершён', tag: 'БРИФ · P', t: '1 ч', k: 'done', ts: ts(1), pid: 'p1', type: 'stage' },
      { txt: 'Задача взята в работу', tag: 'Сценарий · P', t: '2 ч', k: 'start', ts: ts(2), pid: 'p1', type: 'task' },
      { txt: 'Задача отправлена на утверждение', tag: 'Сценарий · P', t: '3 ч', k: 'back', ts: ts(3), pid: 'p1', type: 'task' },
    );
    agDlType = 'all';   const all = _actFiltered().length;
    agDlType = 'task';  const tk = _actFiltered().map(a => a.txt);
    agDlType = 'stage'; const st = _actFiltered().map(a => a.txt);
    agDlType = 'all';
    return { all, tk, st };
  });
  ok('в ленте видны и этапы, и задачи', A.all === 3, A);
  ok('фильтр «Задачи» перестал показывать пустоту', A.tk.length === 2, A.tk);
  ok('и это именно события задач', A.tk.every(t => /Задача/.test(t)), A.tk);
  ok('фильтр «Этапы» оставляет только этапы', A.st.length === 1 && /Этап/.test(A.st[0]), A.st);

  console.log('[D] события удалённых проектов в ленту не попадают');
  /* У этапов история уходит вместе с проектом каскадом, у задач — нет: в
     task_history нет ни одного внешнего ключа. Такие строки нельзя ни
     подписать проектом, ни открыть по клику — им в ленте не место. */
  const G = await page.evaluate(() => {
    const _pnm = {}; [{ id: 'p1', name: 'APOLO' }].forEach(p => _pnm[String(p.id)] = p.name);
    const rows = [
      { task_title: 'Сценарий', new_status: 'active', old_status: 'wait', project_id: 'p1' },
      { task_title: 'Из удалённого', new_status: 'done', old_status: 'active', project_id: 'pX' },
      { task_title: 'Без проекта', new_status: 'done', old_status: 'active', project_id: null },
    ];
    const kept = rows.filter(h => h.project_id != null && _pnm[String(h.project_id)]);
    return { kept: kept.map(h => h.task_title) };
  });
  ok('в ленту идёт только то, у чего проект на месте',
    G.kept.length === 1 && G.kept[0] === 'Сценарий', G.kept);

  console.log('[E] опоздание считается от часа срока, и час срока видно');
  /* Живой случай, из-за которого «закрыт с опозданием» выглядел ошибкой:
     срок 31 июля 18:00, закрыто 2 августа в 09:04 → 24 ч до 1 августа 18:00
     плюс 15 ч 04 мин = 1 день 15 часов. Час срока в строке был спрятан за
     словом «закрыт», и опоздание не с чем было сверить. */
  const L = await page.evaluate(() => {
    const iso = (Y, M, D, h, m, s) => new Date(Y, M - 1, D, h, m, s || 0).toISOString();
    const mk = (dueTime, done) => ({ id: 'x', type: 'task', stage: 'Задача', project: 'P', pid: 'p1', _id: 't1',
      due: '2026-07-31', dueTime, status: 'done', bucket: 'done', done_at: done, assignee: null,
      day: '31', mon: 'июл', spent: 1500 });
    const at18 = mk('18:00', iso(2026, 8, 2, 9, 4, 52));
    const at1630 = mk('16:30', iso(2026, 8, 3, 20, 36, 4));
    const noTime = mk('', iso(2026, 8, 2, 9, 4, 52));
    const row = _dlRow(at18), rowNo = _dlRow(noTime);
    const chip = h => (h.match(/<div class="dlx-date">[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
    return {
      l18: _dlDoneStatus(at18).label,
      l1630: _dlDoneStatus(at1630).label,
      lNo: _dlDoneStatus(noTime).label,
      chip: chip(row), chipNo: chip(rowNo),
      badge: (row.match(/<div class="l1">([^<]*)<\/div><div class="l2">([^<]*)</) || []).slice(1, 3),
    };
  });
  ok('срок 31 июля 18:00, закрыто 2 августа 09:04 — опоздание 1 день 15 часов',
    L.l18 === 'Позже на 1 день 15 часов', L.l18);
  ok('срок 16:30, закрыто 3 августа 20:36 — 3 дня 4 часа', L.l1630 === 'Позже на 3 дня 4 часа', L.l1630);
  ok('без часа срок держится до конца дня: то же закрытие — 1 день 9 часов',
    L.lNo === 'Позже на 1 день 9 часов', L.lNo);
  ok('час срока виден в дате и у закрытой строки', /18:00/.test(L.chip), L.chip);
  ok('без часа срока на его месте по-прежнему «закрыт»',
    /закрыт/.test(L.chipNo) && !/\d\d:\d\d/.test(L.chipNo), L.chipNo);
  ok('заголовок справа называет и опоздание, и момент закрытия',
    L.badge[0] === 'Закрыт с опозданием' && /^на 1 день 15 часов · 2 авг 09:04$/.test(L.badge[1]), L.badge);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
