/* probe_pjq — быстрый просмотр из карточки проекта.

   Что проверяем и почему именно это:
   · карточка проекта — это витрина, и каждая её зона теперь ведёт куда-то.
     Молчаливая зона хуже отсутствующей: пользователь жмёт и ничего не
     происходит. Поэтому проверяем не «есть класс», а «есть обработчик и он
     зовёт нужную функцию с нужным id»;
   · клик по зоне не должен открывать проект — на всей карточке висит
     openProject, и без stopPropagation любой переход утонул бы в нём;
   · окно живёт на данных проекта, которых на списке ещё нет: обязан быть
     скелет и дорисовка;
   · счёт просрочек в окне обязан совпадать со счётом на плитке «Темп» —
     иначе два экрана рассказывают разное про один проект. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'probe' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.__toasts = []; window.toast = t => window.__toasts.push(t);
  window.LIVE = false;
  window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agCanSeeProject = () => true;
  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  window.__day = day;

  TEAM = [
    { _id: 'm1', name: 'Пётр Смирнов',  role: 'Проект-менеджер', role_title: 'Проект-менеджер', dept: 'Аккаунтинг', color: '#37E6C8', avatar: null },
    { _id: 'm2', name: 'Азиз Каримов',  role: 'Монтажёр',        role_title: 'Монтажёр',        dept: 'Продакшн',   color: '#F0785C', avatar: null },
    { _id: 'm3', name: 'Нилуфар Ким',   role: 'Дизайнер',        role_title: 'Дизайнер',        dept: 'Дизайн',     color: '#8A8FFF', avatar: null },
    { _id: 'm4', name: 'Олим Тошев',    role: 'Таргетолог',      role_title: 'Таргетолог',      dept: 'Трафик',     color: '#E3B567', avatar: null },
    { _id: 'm5', name: 'Дилноза Юсуп',  role: 'Копирайтер',      role_title: 'Копирайтер',      dept: 'Контент',    color: '#43D88C', avatar: null },
    { _id: 'm6', name: 'Санжар Рахим',  role: 'Оператор',        role_title: 'Оператор',        dept: 'Продакшн',   color: '#6AA9FF', avatar: null },
    { _id: 'm7', name: 'Мадина Салим',  role: 'SMM',             role_title: 'SMM',             dept: 'Контент',    color: '#FF9F6A', avatar: null }
  ];
  window.TEAM_ARCHIVED = [];

  /* Этапы: один просрочен, один сегодня, один впереди, два готовы */
  const stages = [
    { id: 's1', idx: 0, name: 'Бриф и стратегия',  status: 'done',   due_date: day(-20), due_time: null },
    { id: 's2', idx: 1, name: 'Съёмка контента',   status: 'active', due_date: day(-3),  due_time: null },
    { id: 's3', idx: 2, name: 'Монтаж и графика',  status: 'wait',   due_date: day(0),   due_time: null },
    { id: 's4', idx: 3, name: 'Публикации',        status: 'wait',   due_date: day(9),   due_time: null },
    { id: 's5', idx: 4, name: 'Отчёт клиенту',     status: 'wait',   due_date: null,     due_time: null },
    { id: 's6', idx: 5, name: 'Резерв',            status: 'wait',   due_date: null,     due_time: null }
  ];
  /* Задачи: три сложности + одна без метки; одна просрочена */
  const tasks = [
    { id: 't1', idx: 0, title: 'Собрать референсы',  stage_id: 's1', status: 'done',   due_date: day(-21), difficulty: 'easy',   assignee_id: 'm3' },
    { id: 't2', idx: 1, title: 'Смонтировать Reels', stage_id: 's2', status: 'active', due_date: day(-2),  difficulty: 'hard',   assignee_id: 'm2' },
    { id: 't3', idx: 2, title: 'Написать сценарии',  stage_id: 's2', status: 'active', due_date: day(1),   difficulty: 'medium', assignee_id: 'm5' },
    { id: 't4', idx: 3, title: 'Отрисовать обложки', stage_id: 's3', status: 'wait',   due_date: day(4),   difficulty: 'medium', assignee_id: 'm3' },
    { id: 't5', idx: 4, title: 'Настроить кампанию', stage_id: 's4', status: 'wait',   due_date: day(12),  difficulty: 'hard',   assignee_id: null },
    { id: 't6', idx: 5, title: 'Свести аналитику',   stage_id: 's5', status: 'wait',   due_date: null,     difficulty: '',       assignee_id: 'm4' },
    { id: 't7', idx: 6, title: 'Согласовать план',   stage_id: 's1', status: 'done',   due_date: day(-18), difficulty: 'easy',   assignee_id: 'm1' },
    { id: 't8', idx: 7, title: 'Собрать архив',      stage_id: 's1', status: 'done',   due_date: day(-30), difficulty: 'hard',   assignee_id: 'm2' }
  ];

  const P = (id, name, extra) => Object.assign({
    id, name, logo: name[0], logoUrl: null, cat: 'IT компания', svc: 'PROD', pct: 40,
    stages: '1 / 5', status: 'active', mrr: 6000000, cost: 3000000, lead_id: 'm1',
    _stages: stages, _tasks: tasks, _reports: [],
    _team: [...TEAM.slice(1), TEAM[0]].map(m => ({ name: m.name, color: m.color, avatar: null, _id: m._id })),
    _pipeline: { done: 1, active: 1, wait: 3, total: 5 },
    _overdue: true, _overdueAll: 2, _overdueStages: 1, _overdueTasks: 1, _overdueN: 1,
    _taskAgg: { done: 2, total: 7 }, _nextDue: day(-3),
    _lead: { name: 'Пётр Смирнов', color: '#37E6C8', avatar: null, _id: 'm1' },
    _contract: { start: day(-13), end: day(18) }
  }, extra || {});

  PROJECTS = [
    P('p1', 'Artel'),
    P('p2', 'Малая команда', { _team: TEAM.slice(0, 3).map(m => ({ name: m.name, color: m.color, avatar: null, _id: m._id })) }),
    P('p3', 'Без команды',   { _team: [], lead_id: null, _lead: null }),
    P('p4', 'Не загружен',   { _stages: undefined, _tasks: undefined })
  ];

  /* SMM-сводка: один отчёт с данными */
  _smmLbAll = [{ reportId: 'r-last', proj: { id: 'p1', name: 'Artel' },
    m: { er: 8.8, subscribers_current: 178438, total_reach: 1134533, total_views: 1953985, content_total: 95 } }];

  /* журналируем переходы вместо настоящих */
  window.__calls = [];
  window.dlGoto = (pid, type, id) => window.__calls.push(['dlGoto', pid, type, String(id)]);
  window.pmCardOpen = id => window.__calls.push(['pmCardOpen', String(id)]);
  window.openProject = i => window.__calls.push(['openProject', i]);
  window.smmOpenFromLb = async id => { window.__calls.push(['smmOpenFromLb', String(id)]); };
  window.tLoadProjectWork = async pid => {
    window.__calls.push(['tLoadProjectWork', String(pid)]);
    const p = PROJECTS.find(x => x.id === pid); if (p) { p._stages = stages; p._tasks = tasks; }
  };

  [...document.body.children].forEach(e => { if (e.id !== 'app-ag' && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName)) e.style.display = 'none'; });
  document.getElementById('app-ag').classList.add('on');
  agNav('projects');
  paintProjList();
  /* карточки на экране могут идти не в порядке PROJECTS — сортировка и
     закрепление их переставляют, поэтому ищем по имени, а не по индексу */
  window.__card = n => [...document.querySelectorAll('#pj-list .pjh')].find(c => (c.querySelector('.pjh-name-t') || {}).textContent === n);
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(350);

  /* ═════════ A. зоны карточки ═════════ */
  console.log('\n[A] кликабельные зоны карточки');
  const cards = await page.evaluate(() => document.querySelectorAll('#pj-list .pjh').length);
  ok('карточки отрисованы', cards === 4, cards);

  const team = await page.evaluate(() => {
    const c = window.__card('Artel');
    const blk = [...c.querySelectorAll('.pjh-mblk')].find(x => (x.querySelector('.mk') || {}).textContent === 'Команда');
    return { avb: blk.querySelectorAll('.pjh-avb').length,
      chip: blk.querySelectorAll('.pjh-teamx-n').length,
      more: (blk.querySelector('.pjh-av-more') || {}).textContent || '',
      first: (blk.querySelector('.pjh-avb') || {}).getAttribute('onclick') || '',
      moreClick: ([...blk.querySelectorAll('.pjh-avb')].pop() || {}).getAttribute('onclick') || '',
      title: (blk.querySelector('.pjh-avb') || {}).getAttribute('title') || '' };
  });
  ok('подпись команды убрана', team.chip === 0, team);
  ok('пять аватарок + «ещё»', team.avb === 6, team.avb);
  ok('счётчик «+2»', team.more === '+2', team.more);
  ok('аватарка ведёт в паспорт', /pjqPerson\('m2'\)/.test(team.first), team.first);
  ok('клик по аватарке не всплывает', /event\.stopPropagation\(\)/.test(team.first), team.first);
  ok('подсказка с именем', /Азиз Каримов/.test(team.title), team.title);
  ok('«+2» открывает состав', /pjqOpen\('p1','team'\)/.test(team.moreClick), team.moreClick);

  const lead = await page.evaluate(() => {
    const c = window.__card('Artel');
    const el = c.querySelector('.pjh-person');
    return { tag: el.tagName, cls: el.className, click: el.getAttribute('onclick') || '', go: !!el.querySelector('.pjh-go') };
  });
  ok('ответственный — кнопка', lead.tag === 'BUTTON' && /pjh-clk/.test(lead.cls), lead);
  ok('ответственный ведёт в паспорт', /pjqPerson\('m1'\)/.test(lead.click), lead.click);
  ok('у ответственного есть шеврон', lead.go);

  const zones = await page.evaluate(() => {
    const c = window.__card('Artel');
    const byLbl = t => [...c.querySelectorAll('.pjh-card')].find(x => (x.querySelector('.pjh-lbl') || {}).textContent === t);
    const dl = byLbl('Дедлайн'), pace = byLbl('Темп'), life = byLbl('Срок жизни'), cx = byLbl('Сложность');
    const smm = c.querySelector('.pjh-smm'), smmGo = c.querySelector('.pjh-smm-go');
    const pills = [...c.querySelectorAll('.pjh-pill')].map(x => x.getAttribute('onclick') || '');
    return { dl: { tag: dl.tagName, click: dl.getAttribute('onclick') || '', go: !!dl.querySelector('.pjh-go-c') },
      pace: { tag: pace.tagName, click: pace.getAttribute('onclick') || '' },
      life: life.tagName, cx: cx.tagName, cxClick: cx.getAttribute('onclick') || '',
      smm: { tag: (smmGo || {}).tagName, click: (smmGo ? smmGo.getAttribute('onclick') : '') || '', go: !!smm.querySelector('.pjh-smm-cfg'), wrap: smm.tagName },
      pills };
  });
  ok('«Дедлайн» — кнопка', zones.dl.tag === 'BUTTON', zones.dl.tag);
  ok('«Дедлайн» открывает сроки на просрочках', /pjqOpen\('p1','due','overdue'\)/.test(zones.dl.click), zones.dl.click);
  ok('у «Дедлайна» шеврон', zones.dl.go);
  ok('«Темп» — кнопка', zones.pace.tag === 'BUTTON', zones.pace.tag);
  ok('«Темп» открывает те же сроки', /pjqOpen\('p1','due','overdue'\)/.test(zones.pace.click), zones.pace.click);
  ok('«Срок жизни» кнопкой не стал', zones.life === 'DIV', zones.life);
  ok('«Сложность» открывает справочник', zones.cx === 'BUTTON' && /pjcxOpen\('p1'\)/.test(zones.cxClick), zones);
  ok('SMM-сводка — кнопка внутри обёртки', zones.smm.tag === 'BUTTON' && zones.smm.wrap === 'DIV', zones.smm);
  ok('SMM ведёт в последний отчёт', /pjhSmmGo\('p1'\)/.test(zones.smm.click), zones.smm.click);
  ok('у SMM шестерёнка настройки', zones.smm.go);
  ok('плитка этапов открывает этапы', /pjqOpen\('p1','stages'\)/.test(zones.pills[0]), zones.pills[0]);
  ok('плитка задач открывает задачи', /pjqOpen\('p1','tasks'\)/.test(zones.pills[1]), zones.pills[1]);

  /* «Нет SMM-отчёта» остаётся неактивной плашкой, а не мёртвой кнопкой */
  const smmNone = await page.evaluate(() => {
    const c = window.__card('Малая команда');
    const s = c.querySelector('.pjh-smm');
    return { tag: s.tagName, cls: s.className, txt: (s.textContent || '').trim() };
  });
  ok('без отчёта SMM не кнопка', smmNone.tag === 'DIV' && !/pjh-clk/.test(smmNone.cls), smmNone);
  ok('без отчёта честная надпись', /Нет SMM-отчёта/.test(smmNone.txt), smmNone.txt);

  const noTeam = await page.evaluate(() => {
    const c = window.__card('Без команды');
    const blk = [...c.querySelectorAll('.pjh-mblk')].find(x => (x.querySelector('.mk') || {}).textContent === 'Команда');
    const pers = c.querySelector('.pjh-person');
    return { txt: (blk.textContent || '').replace(/\s+/g, ' ').trim(), avb: blk.querySelectorAll('.pjh-avb').length,
      persTag: pers.tagName, persCls: pers.className };
  });
  ok('без команды — надпись, без кнопок', /Без команды/.test(noTeam.txt) && noTeam.avb === 0, noTeam);
  ok('без ответственного не кликается', !/pjh-clk/.test(noTeam.persCls), noTeam);

  /* ═════════ B. окно сроков ═════════ */
  console.log('\n[B] окно сроков');
  await page.evaluate(() => pjqOpen('p1', 'due', 'overdue'));
  await page.waitForTimeout(260);
  const B = await page.evaluate(() => {
    const ov = document.getElementById('ov-pjq');
    const st = [...ov.querySelectorAll('.pjq-stc')].map(x => [x.querySelector('.k').textContent, x.querySelector('.v').textContent]);
    const seg = [...ov.querySelectorAll('.pjq-seg button')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    const on = (ov.querySelector('.pjq-seg button.on') || {}).textContent || '';
    const rows = [...ov.querySelectorAll('.pjq-b .pjq-r')].map(x => ({
      t: x.querySelector('.pjq-rt b').textContent, s: x.querySelector('.pjq-rt span').textContent,
      cls: x.className, click: x.getAttribute('onclick') }));
    return { open: ov.classList.contains('on'), title: ov.querySelector('.pjq-ht h3').textContent,
      sub: ov.querySelector('.pjq-ht p').textContent, st, seg, on, rows,
      nav: [...ov.querySelectorAll('.pjq-nav button')].map(x => x.textContent.trim()) };
  });
  ok('окно открыто', B.open);
  ok('в шапке имя проекта', B.title === 'Artel', B.title);
  ok('подзаголовок называет причину', /нарушен/.test(B.sub), B.sub);
  ok('четыре разреза в навигации', B.nav.length === 4 && B.nav[0] === 'Сроки' && B.nav[3] === 'Состав', B.nav);
  ok('сегмент «Просрочены» активен', /Просрочены/.test(B.on), B.on);
  ok('просрочено две штуки', B.rows.length === 2, B.rows.map(r => r.t));
  ok('счёт в шапке совпадает с плиткой «Темп»', (B.st.find(x => x[0] === 'Просрочено') || [])[1] === '2', B.st);
  ok('обе строки красные', B.rows.every(r => /st-neg/.test(r.cls)), B.rows.map(r => r.cls));
  ok('в строке видно, на сколько просрочено', B.rows.every(r => /просрочен \d+ (день|дня|дней)/.test(r.s)), B.rows.map(r => r.s));
  ok('этап ведёт в этап', B.rows.some(r => /dlGoto|pjqGo\('stage','s2'\)/.test(r.click)), B.rows.map(r => r.click));
  ok('задача ведёт в задачу', B.rows.some(r => /pjqGo\('task','t2'\)/.test(r.click)), B.rows.map(r => r.click));
  ok('у задачи назван этап-родитель', B.rows.some(r => /этап «Съёмка контента»/.test(r.s)), B.rows.map(r => r.s));

  const who = await page.evaluate(() => [...document.querySelectorAll('#ov-pjq .pjq-r .pjq-rp .nm')].map(x => x.textContent));
  ok('у задачи виден исполнитель', who.indexOf('Азиз Каримов') >= 0, who);
  ok('у этапа вместо исполнителя — его статус', who.indexOf('в работе') >= 0, who);

  await page.evaluate(() => pjqSeg('all'));
  await page.waitForTimeout(150);
  const Ball = await page.evaluate(() => ({
    heads: [...document.querySelectorAll('#ov-pjq .pjq-gh')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
    rows: [...document.querySelectorAll('#ov-pjq .pjq-r')].length,
    firstHead: (document.querySelector('#ov-pjq .pjq-b > *') || {}).className }));
  ok('в «Все» появились группы', Ball.heads.length >= 3, Ball.heads);
  ok('просроченные — первой группой', /Просрочены/.test(Ball.heads[0] || ''), Ball.heads);
  ok('готовые в общий список не лезут', Ball.rows === 10, Ball.rows);

  await page.evaluate(() => pjqSeg('done'));
  await page.waitForTimeout(150);
  const Bdone = await page.evaluate(() => [...document.querySelectorAll('#ov-pjq .pjq-r')].map(x => x.querySelector('.pjq-rt span').textContent));
  ok('в «Готово» только выполненные', Bdone.length === 4 && Bdone.every(s => /выполнено/.test(s)), Bdone);

  /* ═════════ C. этапы ═════════ */
  console.log('\n[C] этапы');
  await page.evaluate(() => pjqView('stages'));
  await page.waitForTimeout(180);
  const C = await page.evaluate(() => {
    const ov = document.getElementById('ov-pjq');
    return { rows: [...ov.querySelectorAll('.pjq-r')].map(x => ({ t: x.querySelector('.pjq-rt b').textContent, click: x.getAttribute('onclick') })),
      mini: [...ov.querySelectorAll('.pjq-mini .lb')].map(x => x.textContent),
      st: [...ov.querySelectorAll('.pjq-stc')].map(x => x.querySelector('.k').textContent + '=' + x.querySelector('.v').textContent),
      seg: [...ov.querySelectorAll('.pjq-seg button')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) };
  });
  ok('все шесть этапов', C.rows.length === 6, C.rows.length);
  ok('порядок как в проекте', C.rows[0].t === 'Бриф и стратегия' && C.rows[5].t === 'Резерв', C.rows.map(r => r.t));
  ok('этап ведёт в этап', /pjqGo\('stage','s2'\)/.test(C.rows[1].click), C.rows[1].click);
  ok('видно задачи внутри этапа', C.mini[0] === '3/3' && C.mini[1] === '0/2', C.mini);
  ok('этап без задач честно ставит прочерк', C.mini[5] === '—', C.mini);
  ok('в шапке «Готово 1/5»', C.st.some(s => /Готово=1/.test(s)), C.st);
  ok('сегменты по статусу', C.seg.some(s => /В работе/.test(s)) && C.seg.some(s => /Просрочены/.test(s)), C.seg);

  await page.evaluate(() => pjqSeg('overdue'));
  await page.waitForTimeout(150);
  const Cov = await page.evaluate(() => [...document.querySelectorAll('#ov-pjq .pjq-r .pjq-rt b')].map(x => x.textContent));
  ok('просрочен ровно один этап', Cov.length === 1 && Cov[0] === 'Съёмка контента', Cov);

  /* ═════════ D. задачи по сложности ═════════ */
  console.log('\n[D] задачи по сложности');
  await page.evaluate(() => pjqView('tasks'));
  await page.waitForTimeout(180);
  const D = await page.evaluate(() => {
    const ov = document.getElementById('ov-pjq');
    return { heads: [...ov.querySelectorAll('.pjq-gh')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
      rows: [...ov.querySelectorAll('.pjq-r')].map(x => ({ t: x.querySelector('.pjq-rt b').textContent, click: x.getAttribute('onclick') })),
      seg: [...ov.querySelectorAll('.pjq-seg button')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
      st: [...ov.querySelectorAll('.pjq-stc')].map(x => x.querySelector('.k').textContent + '=' + x.querySelector('.v').textContent),
      sub: ov.querySelector('.pjq-ht p').textContent };
  });
  ok('три группы сложности', /Лёгкие/.test(D.heads[0]) && /Средние/.test(D.heads[1]) && /Сложные/.test(D.heads[2]), D.heads);
  ok('задачи без метки не теряются', D.heads.some(h => /Без метки/.test(h)), D.heads);
  ok('все восемь задач на месте', D.rows.length === 8, D.rows.length);
  ok('задача ведёт в задачу', /pjqGo\('task','t2'\)/.test((D.rows.find(r => r.t === 'Смонтировать Reels') || {}).click || ''), D.rows);
  ok('сегменты сложности', D.seg.length === 5 && /Сложные/.test(D.seg[3]), D.seg);
  ok('в шапке «Сложных 3»', D.st.some(s => /Сложных=3/.test(s)), D.st);
  ok('подзаголовок называет три группы', /лёгкие · средние · сложные/.test(D.sub), D.sub);

  await page.evaluate(() => pjqSeg('hard'));
  await page.waitForTimeout(150);
  const Dh = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('#ov-pjq .pjq-r .pjq-rt b')].map(x => x.textContent),
    tags: [...document.querySelectorAll('#ov-pjq .pjq-tag')].map(x => x.textContent),
    order: [...document.querySelectorAll('#ov-pjq .pjq-r')].map(x => x.className) }));
  ok('в «Сложные» только сложные', Dh.rows.length === 3, Dh.rows);
  /* порядок внутри группы — по срочности, а не по дате: выполненная задача с
     самым ранним сроком обязана уйти в хвост, а не встать первой */
  ok('порядок внутри группы — по срочности', /st-neg/.test(Dh.order[0] || '') && /st-mut/.test(Dh.order[1] || '') && /st-pos/.test(Dh.order[2] || ''), Dh.order);
  ok('метка сложности на строке', Dh.tags.length === 3, Dh.tags);

  /* ═════════ E. состав команды ═════════ */
  console.log('\n[E] состав');
  await page.evaluate(() => pjqView('team'));
  await page.waitForTimeout(180);
  const E = await page.evaluate(() => {
    const ov = document.getElementById('ov-pjq');
    return { rows: [...ov.querySelectorAll('.pjq-r')].map(x => ({ t: x.querySelector('.pjq-rt b').textContent,
        s: x.querySelector('.pjq-rt span').textContent, click: x.getAttribute('onclick'), cls: x.className })),
      pm: [...ov.querySelectorAll('.pjq-tag')].map(x => x.textContent),
      st: [...ov.querySelectorAll('.pjq-stc')].map(x => x.querySelector('.k').textContent + '=' + x.querySelector('.v').textContent) };
  });
  ok('все семеро в списке', E.rows.length === 7, E.rows.length);
  ok('ответственный первым', E.rows[0].t === 'Пётр Смирнов', E.rows.map(r => r.t));
  ok('он помечен PM', E.pm.length === 1 && E.pm[0] === 'PM', E.pm);
  ok('строка ведёт в паспорт', /pjqPerson\('m2'\)/.test((E.rows.find(r => r.t === 'Азиз Каримов') || {}).click || ''), E.rows);
  ok('видна нагрузка человека', /задач/.test((E.rows.find(r => r.t === 'Азиз Каримов') || {}).s || ''), E.rows.map(r => r.s));
  ok('просрочка красит строку', /st-neg/.test((E.rows.find(r => r.t === 'Азиз Каримов') || {}).cls || ''), E.rows.map(r => r.cls));
  ok('без задач — честная подпись', E.rows.some(r => /задач в проекте нет/.test(r.s)), E.rows.map(r => r.s));
  ok('в шапке «Отделов 5»', E.st.some(s => /Отделов=5/.test(s)), E.st);
  ok('в шапке видно бесхозные задачи', E.st.some(s => /Без исполнителя=1/.test(s)), E.st);
  /* аватар в «Составе» стоит в колонке даты, а не в слоте исполнителя: без
     собственного правила он схлопывался в цветную полоску */
  const Eav = await page.evaluate(() => [...document.querySelectorAll('#ov-pjq .pjq-ra .av')]
    .map(x => { const r = x.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }));
  ok('аватар в составе — квадрат 32', Eav.length === 7 && Eav.every(v => v === '32x32'), Eav);

  /* ═════════ F. переходы наружу ═════════ */
  console.log('\n[F] переходы');
  await page.evaluate(() => { window.__calls.length = 0; });
  await page.evaluate(() => pjqView('due'));
  await page.waitForTimeout(150);
  await page.evaluate(() => { const r = [...document.querySelectorAll('#ov-pjq .pjq-r')].find(x => /t2/.test(x.getAttribute('onclick'))); r.click(); });
  await page.waitForTimeout(220);
  const F = await page.evaluate(() => ({ calls: window.__calls, open: document.getElementById('ov-pjq').classList.contains('on') }));
  ok('клик по задаче зовёт dlGoto', JSON.stringify(F.calls[0]) === JSON.stringify(['dlGoto', 'p1', 'task', 't2']), F.calls);
  ok('окно при этом закрывается', !F.open);

  await page.evaluate(() => { window.__calls.length = 0; pjqOpen('p1', 'stages'); });
  await page.waitForTimeout(230);
  await page.evaluate(() => { const r = [...document.querySelectorAll('#ov-pjq .pjq-r')].find(x => /'s3'/.test(x.getAttribute('onclick'))); r.click(); });
  await page.waitForTimeout(200);
  const F2 = await page.evaluate(() => window.__calls.filter(c => c[0] === 'dlGoto'));
  ok('клик по этапу зовёт dlGoto с типом stage', JSON.stringify(F2[0]) === JSON.stringify(['dlGoto', 'p1', 'stage', 's3']), F2);

  await page.evaluate(() => { window.__calls.length = 0; pjqOpen('p1', 'team'); });
  await page.waitForTimeout(230);
  await page.evaluate(() => { [...document.querySelectorAll('#ov-pjq .pjq-r')][1].click(); });
  await page.waitForTimeout(150);
  const F3 = await page.evaluate(() => ({ calls: window.__calls, open: document.getElementById('ov-pjq').classList.contains('on') }));
  ok('клик по человеку открывает паспорт', F3.calls.some(c => c[0] === 'pmCardOpen'), F3.calls);
  ok('окно состава остаётся под паспортом', F3.open);

  await page.evaluate(() => { window.__calls.length = 0; pjhSmmGo('p1'); });
  await page.waitForTimeout(220);
  const F4 = await page.evaluate(() => window.__calls);
  ok('SMM-плитка зовёт нужный отчёт', JSON.stringify(F4[0]) === JSON.stringify(['smmOpenFromLb', 'r-last']), F4);
  /* отчёт мог открыться на форме ввода — клик по цифрам обязан довести до показа */
  await page.evaluate(() => { window.__calls.length = 0; window.__smmTabs = [];
    window.smmTab = async t => { window.__smmTabs.push(t); };
    window.smmOpenFromLb = async id => { window.__calls.push(['smmOpenFromLb', String(id)]); _smmTab = 'data'; }; });
  await page.evaluate(() => pjhSmmGo('p1'));
  await page.waitForTimeout(220);
  ok('отчёт открывается на презентации', await page.evaluate(() => JSON.stringify(window.__smmTabs)) === '["preview"]',
    await page.evaluate(() => window.__smmTabs));

  await page.evaluate(() => { window.__calls.length = 0; window.__toasts.length = 0; pjhSmmGo('p2'); });
  await page.waitForTimeout(200);
  const F5 = await page.evaluate(() => ({ calls: window.__calls, toasts: window.__toasts }));
  ok('без отчёта — объяснение, а не тишина', F5.calls.length === 0 && /нет SMM-отчёта/i.test(F5.toasts[0] || ''), F5);

  await page.evaluate(() => { pjqOpen('p1', 'due'); });
  await page.waitForTimeout(220);
  await page.evaluate(() => { window.__calls.length = 0; document.querySelector('#ov-pjq .pjq-fb .pri').click(); });
  await page.waitForTimeout(200);
  const F6 = await page.evaluate(() => ({ calls: window.__calls, open: document.getElementById('ov-pjq').classList.contains('on') }));
  ok('«Открыть проект» открывает проект', F6.calls.some(c => c[0] === 'openProject' && c[1] === 0), F6.calls);
  ok('и закрывает окно', !F6.open);

  /* ═════════ G. загрузка и закрытие ═════════ */
  console.log('\n[G] загрузка, закрытие, всплытие');
  await page.evaluate(() => { PROJECTS[3]._stages = undefined; PROJECTS[3]._tasks = undefined; window.__calls.length = 0;
    window.tLoadProjectWork = pid => new Promise(r => setTimeout(() => { const p = PROJECTS.find(x => x.id === pid); p._stages = []; p._tasks = []; r(); }, 400)); });
  await page.evaluate(() => pjqOpen('p4', 'due'));
  await page.waitForTimeout(120);
  const G1 = await page.evaluate(() => ({ sk: document.querySelectorAll('#ov-pjq .pjq-sk').length, sub: document.querySelector('#ov-pjq .pjq-ht p').textContent }));
  ok('пока грузится — скелет, а не «пусто»', G1.sk === 4, G1);
  ok('и честная подпись', /Загружаю/.test(G1.sub), G1.sub);
  await page.waitForTimeout(600);
  const G2 = await page.evaluate(() => ({ sk: document.querySelectorAll('#ov-pjq .pjq-sk').length, empty: document.querySelectorAll('#ov-pjq .pjq-empty').length }));
  ok('после загрузки скелет уходит', G2.sk === 0, G2);
  ok('пустой проект объясняет пустоту', G2.empty === 1, G2);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  ok('Escape закрывает', await page.evaluate(() => !document.getElementById('ov-pjq').classList.contains('on')));

  await page.evaluate(() => pjqOpen('p1', 'due'));
  await page.waitForTimeout(220);
  await page.evaluate(() => { const ov = document.getElementById('ov-pjq'); ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(250);
  ok('клик по фону закрывает', await page.evaluate(() => !document.getElementById('ov-pjq').classList.contains('on')));

  /* карточка целиком ведёт в проект — но не через новые зоны */
  await page.evaluate(() => { window.__calls.length = 0;
    const c = window.__card('Artel');
    [...c.querySelectorAll('.pjh-card')].find(x => (x.querySelector('.pjh-lbl') || {}).textContent === 'Дедлайн').click(); });
  await page.waitForTimeout(300);
  const G3 = await page.evaluate(() => ({ calls: window.__calls, open: document.getElementById('ov-pjq').classList.contains('on') }));
  ok('клик по «Дедлайну» не открывает проект', !G3.calls.some(c => c[0] === 'openProject'), G3.calls);
  ok('а открывает окно сроков', G3.open);
  await page.evaluate(() => pjqClose());
  await page.waitForTimeout(200);

  await page.evaluate(() => { window.__calls.length = 0;
    window.__card('Artel').querySelector('.pjh-teamx .pjh-avb').click(); });
  await page.waitForTimeout(200);
  const G4 = await page.evaluate(() => window.__calls);
  ok('клик по аватарке не открывает проект', !G4.some(c => c[0] === 'openProject'), G4);
  ok('а открывает паспорт', G4.some(c => c[0] === 'pmCardOpen' && c[1] === 'm2'), G4);

  /* ═════════ H. вёрстка ═════════ */
  console.log('\n[H] вёрстка');
  await page.evaluate(() => pjqOpen('p1', 'due', 'all'));
  await page.waitForTimeout(300);
  const H = await page.evaluate(() => {
    const m = document.querySelector('#ov-pjq .pjq'), b = m.querySelector('.pjq-b');
    const cells = [...m.querySelectorAll('.pjq-stc')].map(x => Math.round(x.getBoundingClientRect().width));
    const rows = [...m.querySelectorAll('.pjq-r')].map(x => Math.round(x.getBoundingClientRect().width));
    const over = [...m.querySelectorAll('.pjq-r')].some(x => x.scrollWidth > x.clientWidth + 1);
    return { w: Math.round(m.getBoundingClientRect().width), h: Math.round(m.getBoundingClientRect().height),
      vh: window.innerHeight, cells, rowsSame: new Set(rows).size, over,
      scroll: b.scrollHeight > b.clientHeight };
  });
  ok('окно не шире 780', H.w <= 780, H.w);
  ok('окно влезает в экран', H.h <= H.vh - 40, H);
  ok('ячейки статистики равной ширины', new Set(H.cells).size === 1, H.cells);
  ok('строки одной ширины', H.rowsSame === 1, H.rowsSame);
  ok('строки не переполняются', !H.over);
  ok('длинный список скроллится внутри', H.scroll);

  const H2 = await page.evaluate(() => {
    const c = window.__card('Artel');
    const box = s => { const e = c.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : -1; };
    const blks = [...c.querySelectorAll('.pjh-mrow .pjh-mblk, .pjh-mgrid > .pjh-mblk')].map(x => Math.round(x.getBoundingClientRect().height));
    const av = [...c.querySelectorAll('.pjh-teamx .pjh-av')].map(x => Math.round(x.getBoundingClientRect().width));
    const teamW = Math.round(c.querySelector('.pjh-teamx .pjh-avs').getBoundingClientRect().width);
    const blkW = Math.round([...c.querySelectorAll('.pjh-mblk')].find(x => (x.querySelector('.mk') || {}).textContent === 'Команда').getBoundingClientRect().width);
    return { blks, av, teamW, blkW, person: box('.pjh-person') };
  });
  ok('аватарки команды 38px — вровень с ответственным', H2.av.every(w => w === 38), H2.av);
  ok('ряд аватарок помещается в блок', H2.teamW <= H2.blkW - 24, H2);

  await page.setViewportSize({ width: 560, height: 900 });
  await page.waitForTimeout(280);
  const H3 = await page.evaluate(() => {
    const m = document.querySelector('#ov-pjq .pjq');
    return { w: Math.round(m.getBoundingClientRect().width), vw: window.innerWidth,
      cells: [...m.querySelectorAll('.pjq-stc')].map(x => Math.round(x.getBoundingClientRect().width)),
      rowsOfStats: new Set([...m.querySelectorAll('.pjq-stc')].map(x => Math.round(x.getBoundingClientRect().top))).size,
      who: getComputedStyle(m.querySelector('.pjq-rp')).display };
  });
  ok('на узком экране окно не вылезает', H3.w <= H3.vw, H3);
  ok('статистика перестраивается в две колонки', H3.rowsOfStats === 2 && new Set(H3.cells).size === 1, H3);
  ok('исполнитель прячется, чтобы не рвать строку', H3.who === 'none', H3.who);
  await page.setViewportSize({ width: 1600, height: 1000 });

  console.log('\n[I] ошибок страницы');
  ok('нет ошибок JS', errs.length === 0, errs.slice(0, 4));

  console.log('\n' + (fail ? '✗' : '✓') + ' probe_pjq: ' + pass + ' пройдено, ' + fail + ' провалено');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
