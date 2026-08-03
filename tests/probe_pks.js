/* probe_pks — статистика проекта: точность Lead/Cycle/выработки и само окно */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const D = 86400000;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  /* Фикстура: сроки заданы целыми сутками назад от «сейчас» — тогда и окна
     выработки (они считаются от полуночи), и медианы предсказуемы до милли-
     секунды, независимо от времени запуска прогона. */
  await page.evaluate(() => {
    const D = 86400000, now = Date.now();
    const iso = n => new Date(now - n * D).toISOString();
    window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' };
    window.tMe = () => window.__me; window.ME = window.__me; window.toast = m => { window.__toast = m; };
    window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agCanDocs = () => true;
    window.giEnsureStatus = async () => ({ status: 'inactive' }); window.ctBadge = () => '';
    window.tLoadProjectWork = null; window.tLoadProjectToday = null;
    TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null },
            { _id: 'm2', name: 'Азиз', color: '#F5C542', avatar: null }];
    PROJECTS = [{ id: 'p1', name: 'Artel', logo: 'A', logoUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%2337E6C8%22/%3E%3C/svg%3E', cat: 'IT', svc: 'SMM', pct: 0, stages: '1 / 2',
      status: 'active', mrr: 0, cost: 0, tg_chat_id: null, client_id: null, contacts: null, ui: null, kb: null,
      leads: ['m1'], lead_id: 'm1', _appr: [],
      _stages: [{ id: 's1', name: 'ПРОДАКШН', status: 'active' }, { id: 's2', name: 'БРИФИНГ', status: 'done' }],
      _tasks: [], _reports: [] }];

    const H = (task_id, o, n, days) => ({ task_id, old_status: o, new_status: n, changed_by: 'm1', created_at: iso(days) });
    window.__PKS_FIXTURE = {
      tasks: [
        { id: 't1', title: 'Съёмка', status: 'done',   created_at: iso(10), completed_at: iso(5),  assignee_id: 'm1', stage_id: 's1', difficulty: 'medium' },
        { id: 't2', title: 'Монтаж', status: 'done',   created_at: iso(4),  completed_at: iso(2),  assignee_id: 'm2', stage_id: 's1', difficulty: 'easy' },
        { id: 't3', title: 'Правка', status: 'done',   created_at: iso(3),  completed_at: iso(1),  assignee_id: 'm2', stage_id: 's2', difficulty: 'easy' },
        { id: 't4', title: 'Вернули', status: 'wait',  created_at: iso(20), completed_at: null,    assignee_id: 'm1', stage_id: 's1', difficulty: 'hard' },
        { id: 't5', title: 'Сценарий', status: 'done', created_at: iso(30), completed_at: iso(20), assignee_id: 'm1', stage_id: 's2', difficulty: 'hard' },
        { id: 't6', title: 'Старая',  status: 'done',  created_at: iso(9),  completed_at: iso(6),  assignee_id: null, stage_id: null, difficulty: null },
        { id: 't7', title: 'В работе', status: 'active', created_at: iso(2), completed_at: null,   assignee_id: 'm2', stage_id: 's1', difficulty: 'medium' },
      ],
      hist: [
        H('t1', null, 'wait', 10), H('t1', 'wait', 'active', 8), H('t1', 'active', 'done', 5),
        H('t2', null, 'wait', 4),  H('t2', 'wait', 'active', 4), H('t2', 'active', 'done', 2),
        H('t3', null, 'wait', 3),  H('t3', 'wait', 'done', 1),
        H('t4', null, 'wait', 20), H('t4', 'wait', 'active', 18), H('t4', 'active', 'done', 15), H('t4', 'done', 'wait', 14),
        H('t5', null, 'wait', 30), H('t5', 'wait', 'active', 29), H('t5', 'active', 'done', 25),
        H('t5', 'done', 'wait', 24), H('t5', 'wait', 'active', 23), H('t5', 'active', 'done', 20),
        /* t6 — без журнала вовсе: закрыта до того, как журнал завели */
        H('t7', null, 'wait', 2), H('t7', 'wait', 'active', 2),
      ],
    };
  });

  console.log('\n[A] расчёт по задачам');
  const a = await page.evaluate(() => {
    const F = window.__PKS_FIXTURE;
    const rows = pkStatsBuild(F.tasks, F.hist);
    const by = {}; rows.forEach(r => by[r.id] = r);
    const d = ms => ms == null ? null : Math.round(ms / 86400000 * 100) / 100;
    return {
      t1: { lead: d(by.t1.leadMs), cyc: d(by.t1.cycleMs), backs: by.t1.backs },
      t3: { lead: d(by.t3.leadMs), cyc: by.t3.cycleMs, backs: by.t3.backs },
      t4: { done: by.t4.doneAt, backs: by.t4.backs },
      t5: { lead: d(by.t5.leadMs), cyc: d(by.t5.cycleMs), backs: by.t5.backs },
      t6: { lead: d(by.t6.leadMs), cyc: by.t6.cycleMs, evt: by.t6.evt },
      t7: { done: by.t7.doneAt },
      n: rows.length,
    };
  });
  console.log('    ' + JSON.stringify(a));
  ok('обычная задача: lead 5 д, цикл 3 д', a.t1.lead === 5 && a.t1.cyc === 3, a.t1);
  ok('закрытая из очереди: lead есть, цикла нет', a.t3.lead === 2 && a.t3.cyc === null, a.t3);
  ok('возвращённая и не сданная — не завершена', a.t4.done === null && a.t4.backs === 1, a.t4);
  ok('переоткрытая считается по последнему закрытию: lead 10 д, цикл 9 д', a.t5.lead === 10 && a.t5.cyc === 9, a.t5);
  ok('и её возврат посчитан один раз', a.t5.backs === 1, a.t5);
  ok('задача без журнала берёт срок из completed_at', a.t6.lead === 3 && a.t6.cyc === null && a.t6.evt === 0, a.t6);
  ok('задача в работе не считается завершённой', a.t7.done === null, a.t7);
  ok('строк ровно по числу задач', a.n === 7, a.n);

  console.log('\n[B] окно открывается');
  await page.evaluate(async () => { openProject(0); pdTab('kanban'); await pkStatsOpen(); });
  await page.waitForTimeout(400);
  const bOpen = await page.evaluate(() => {
    const ov = document.getElementById('ov-pks');
    return { found: !!ov, on: ov ? ov.classList.contains('on') : false,
      title: (document.querySelector('.pks-hd h2') || {}).textContent,
      proj: (document.querySelector('.pks-hd p') || {}).textContent,
      heroes: document.querySelectorAll('.pks-card').length,
      chips: [...document.querySelectorAll('.pks-chip')].map(x => x.textContent),
      active: (document.querySelector('.pks-chip.on') || {}).textContent };
  });
  console.log('    ' + JSON.stringify(bOpen));
  ok('окно статистики открылось', bOpen.found && bOpen.on, bOpen);
  ok('заголовок и проект на месте', /Статистика проекта/.test(bOpen.title || '') && /Artel/.test(bOpen.proj || ''), bOpen);
  ok('карточки сроков — Lead и Cycle', bOpen.heroes === 2, bOpen.heroes);
  ok('переключатели периода', (bOpen.chips || []).join('|') === '7 дней|30 дней|90 дней|Всё время', bOpen.chips);
  ok('по умолчанию 30 дней', bOpen.active === '30 дней', bOpen.active);

  console.log('\n[C] цифры за 30 дней');
  const c = await page.evaluate(() => {
    const H = [...document.querySelectorAll('.pks-card')];
    const val = i => H[i].querySelector('.pks-card-v').textContent.trim();
    const n = i => H[i].querySelector('.pks-card-n').textContent.trim();
    const dist = i => [...H[i].querySelectorAll('.pks-dist tr')].map(tr => tr.children[0].textContent + '=' + tr.children[1].textContent);
    const tiles = sel => [...document.querySelectorAll(sel + ' .pks-tile')].map(t => t.querySelector('.pks-tk').textContent + '=' + t.querySelector('.pks-tv').textContent);
    return { lead: val(0), leadN: n(0), leadMinis: dist(0),
      cyc: val(1), cycN: n(1), warn: (H[1].querySelector('.pks-card-warn') || {}).textContent,
      doneN: (document.querySelector('.pks-g5 .pks-tile.is-key .pks-tv') || {}).textContent,
      doneMinis: tiles('.pks-g4'),
      wins: tiles('.pks-g5').slice(1) };
  });
  console.log('    ' + JSON.stringify(c));
  ok('медиана Lead Time — 3 д', c.lead === '3 д', c.lead);
  ok('выборка Lead — 5 задач', /^5 задач/.test(c.leadN), c.leadN);
  ok('медиана Cycle Time — 3 д', c.cyc === '3 д', c.cyc);
  ok('выборка Cycle — 3 задачи', /^3 задачи/.test(c.cycN), c.cycN);
  ok('честно сказано про 2 задачи без отметки «в работе»', /^2 задачи закрыты/.test((c.warn || '').trim()), c.warn);
  ok('завершено за период — 5', c.doneN === '5', c.doneN);
  ok('среднее Lead — 4 д 9 ч', c.leadMinis.some(x => x === 'среднее=4 д 9 ч'), c.leadMinis);
  ok('85% Lead — 10 д', c.leadMinis.some(x => x === '85% укладываются в=10 д'), c.leadMinis);
  ok('мин и макс Lead — 2 д и 10 д', c.leadMinis.some(x => x === 'самая быстрая=2 д') && c.leadMinis.some(x => x === 'самая долгая=10 д'), c.leadMinis);
  ok('текущая загрузка: 1 в очереди, 1 в работе, 0 на утверждении, всего 7',
     c.doneMinis.join('|') === 'В очереди=1|В работе=1|На утверждении=0|Всего задач=7', c.doneMinis);
  ok('окна выработки 3/7/15/30 → 2/4/4/5',
     c.wins.join('|') === '3 дня=2|7 дней=4|15 дней=4|30 дней=5', c.wins);

  console.log('\n[D] период 7 дней');
  const d7 = await page.evaluate(() => {
    pkStatsSetPeriod('7');
    const H = [...document.querySelectorAll('.pks-card')];
    return { done: document.querySelector('.pks-g5 .pks-tile.is-key .pks-tv').textContent.trim(),
      lead: H[0].querySelector('.pks-card-v').textContent.trim(),
      leadN: H[0].querySelector('.pks-card-n').textContent.trim(),
      cyc: H[1].querySelector('.pks-card-v').textContent.trim(),
      wins: [...document.querySelectorAll('.pks-g5 .pks-tile')].slice(1).map(t => t.querySelector('.pks-tv').textContent) };
  });
  console.log('    ' + JSON.stringify(d7));
  ok('за 7 дней завершено 4', d7.done === '4', d7.done);
  ok('медиана Lead за 7 дней — 2 д 12 ч', d7.lead === '2 д 12 ч', d7.lead);
  ok('выборка — 4 задачи', /^4 задачи/.test(d7.leadN), d7.leadN);
  ok('медиана Cycle за 7 дней — 2 д 12 ч', d7.cyc === '2 д 12 ч', d7.cyc);
  ok('окна выработки от периода не зависят', d7.wins.join('|') === '2|4|4|5', d7.wins);

  console.log('\n[E] «Всё время» и таблица сверки');
  const eAll = await page.evaluate(() => {
    pkStatsSetPeriod('all');
    const rows = [...document.querySelectorAll('.pks-t tbody tr')].map(tr =>
      [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));
    return { done: document.querySelector('.pks-g5 .pks-tile.is-key .pks-tv').textContent.trim(), rows,
      headers: [...document.querySelectorAll('.pks-t thead th')].map(t => t.textContent.trim()) };
  });
  console.log('    ' + JSON.stringify({ done: eAll.done, n: eAll.rows.length, first: eAll.rows[0], headers: eAll.headers }));
  ok('за всё время завершено 5', eAll.done === '5', eAll.done);
  ok('в таблице ровно эти 5 задач', eAll.rows.length === 5, eAll.rows.length);
  ok('таблица отсортирована — сверху последняя закрытая', (eAll.rows[0] || [])[0] === 'Правка', eAll.rows[0]);
  ok('у задачи из очереди в колонке Cycle прочерк', (eAll.rows[0] || [])[4] === '—', eAll.rows[0]);
  ok('колонки те, по которым можно пересчитать руками',
     eAll.headers.join('|') === 'Задача|Создана|Завершена|Lead|Cycle|Возвраты', eAll.headers);
  ok('у переоткрытой задачи виден возврат', eAll.rows.some(r => r[0] === 'Сценарий' && r[5] === '1'), eAll.rows);

  console.log('\n[F] разрезы по людям и этапам');
  const f = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('.pks-sec')];
    const who = secs.find(s => /По исполнителям/.test(s.textContent));
    const stg = secs.find(s => /По этапам/.test(s.textContent));
    const rd = s => [...s.querySelectorAll('tbody tr')].map(r => (r.querySelector('.pks-nm')||{textContent:''}).textContent + '=' + r.children[2].textContent);
    return { who: rd(who), stage: rd(stg) };
  });
  console.log('    ' + JSON.stringify(f));
  ok('по людям: Худойберди 2, Азиз 2, без исполнителя 1',
     f.who.includes('Худойберди=2') && f.who.includes('Азиз=2') && f.who.includes('Без исполнителя=1'), f.who);
  ok('по этапам: ПРОДАКШН 2, БРИФИНГ 2, без этапа 1',
     f.stage.includes('ПРОДАКШН=2') && f.stage.includes('БРИФИНГ=2') && f.stage.includes('Без этапа=1'), f.stage);

  console.log('\n[G] панель периодов и выравнивание таблиц');
  const g = await page.evaluate(() => {
    pkStatsSetPeriod('all');
    const tools = document.querySelector('.pks-tools');
    const btns = [...tools.querySelectorAll('button')].map(x => x.textContent.trim());
    const cols = t => {
      const th = [...t.querySelectorAll('thead th')], td = [...t.querySelectorAll('tbody tr td')];
      return th.map((x, i) => {
        const a = x.getBoundingClientRect(), b = td[i] ? td[i].getBoundingClientRect() : null;
        return { col: x.textContent.trim(), dx: b ? Math.round(b.left - a.left) : null,
          dw: b ? Math.round(b.width - a.width) : null,
          same: !!td[i] && getComputedStyle(x).textAlign === getComputedStyle(td[i]).textAlign };
      });
    };
    const secs = [...document.querySelectorAll('.pks-sec')];
    const who = secs.find(x => /По исполнителям/.test(x.textContent));
    return { btns, sel: !!document.querySelector('.pks-msel') || !!document.querySelector('.ddx-btn.pks-msel'),
      tasks: cols(document.querySelector('.pks-t')), who: cols(who.querySelector('.pks-b')) };
  });
  console.log('    ' + JSON.stringify(g));
  ok('в панели только четыре периода — «Месяца» нет', g.btns.join('|') === '7 дней|30 дней|90 дней|Всё время' && g.sel === false, g.btns);
  ok('в таблице задач каждое значение стоит под своим заголовком',
     g.tasks.every(c => c.dx === 0 && c.dw === 0 && c.same), g.tasks);
  ok('в разрезах — то же самое', g.who.every(c => c.dx === 0 && c.dw === 0 && c.same), g.who);

  console.log('\n[H] график и методика');
  const h = await page.evaluate(() => {
    pkStatsSetPeriod('7');
    const bars = [...document.querySelectorAll('.pks-chart .pks-bar')];
    const nums = bars.map(x => x.querySelector('span').textContent.trim());
    return { bars: bars.length, nums, sum: nums.reduce((s, x) => s + (Number(x) || 0), 0),
      meth: document.querySelectorAll('.pks-meth li').length };
  });
  console.log('    ' + JSON.stringify(h));
  ok('на графике 7 столбцов — по дню', h.bars === 7, h.bars);
  ok('сумма по столбцам равна завершённым за период', h.sum === 4, h);
  ok('методика расчёта расписана', h.meth >= 5, h.meth);

  console.log('\n[I] кнопка на доске и закрытие');
  const i = await page.evaluate(async () => {
    pkStatsClose();
    await new Promise(r => setTimeout(r, 300));
    const closed = !document.getElementById('ov-pks');
    pkZen(true);
    const zenBtns = [...document.querySelectorAll('.pk-zen-acts button')].map(x => x.textContent.trim());
    pkZen(false);
    const normBtns = [...document.querySelectorAll('.pk-mode button')].map(x => x.textContent.trim());
    return { closed, zenBtns, normBtns, scroll: document.body.style.overflow };
  });
  console.log('    ' + JSON.stringify(i));
  ok('окно закрывается и страница снова скроллится', i.closed && i.scroll === '', i);
  ok('в полноэкранном режиме «Статистика» стоит перед «Доска»',
     i.zenBtns[0] === 'Статистика' && i.zenBtns[1] === 'Доска', i.zenBtns);
  /* В обычном режиме «Статистика» живёт в шапке карточки, а не в ряду:
     в шапке она одна на все вкладки, а ряд отдан доске. */
  ok('в обычном режиме ряд отдан доске и полному экрану',
     i.normBtns[0] === 'Доска' && i.normBtns[1] === 'Во весь экран', i.normBtns);

  console.log('\n[K] вёрстка: логотип, ряд периодов, ширина');
  const k = await page.evaluate(async () => {
    await pkStatsOpen(); await new Promise(r => setTimeout(r, 400));
    const lg = document.querySelector('.pks-lg');
    const img = lg ? lg.querySelector('img') : null;
    const ir = img ? img.getBoundingClientRect() : null;
    const chip = document.querySelector('.pks-chip');
    /* Платформа подменяет нативные <select> своей кнопкой (.ddx-btn), а сам
       select прячет в 1px. Меряем то, что реально видит человек. */
    const msel = chip.parentNode.lastElementChild;
    const cr = chip.getBoundingClientRect(), mr = msel.getBoundingClientRect();
    const wrap = document.querySelector('.pks-wrap').getBoundingClientRect();
    return { lgPos: lg ? getComputedStyle(lg).position : null,
      img: ir ? { w: Math.round(ir.width), h: Math.round(ir.height) } : null,
      chipH: Math.round(cr.height), mselH: Math.round(mr.height),
      dTop: Math.round(mr.top - cr.top), wrapW: Math.round(wrap.width), vw: innerWidth };
  });
  console.log('    ' + JSON.stringify(k));
  ok('логотип спозиционирован — картинка не разъезжается по экрану', k.lgPos === 'relative', k.lgPos);
  ok('логотип размером с иконку, а не во всю ширину', k.img && k.img.w <= 44 && k.img.h <= 44, k.img);
  ok('кнопки периода одной высоты', k.chipH === k.mselH, k);
  ok('и стоят в одну линию', Math.abs(k.dTop) <= 1, k.dTop);
  ok('окно занимает всю ширину экрана', k.vw - k.wrapW <= 4, k);

  /* Лишняя скобка в CSS роняет ВСЕ правила ниже по блоку — молча, без единой
     ошибки в консоли. Проверяем баланс и то, что правило после нашего блока
     действительно доехало до браузера. */
  const css = await page.evaluate(() => {
    const bad = [];
    [...document.querySelectorAll('style')].forEach((st, i) => {
      const t = st.textContent || '';
      const o = (t.match(/{/g) || []).length, c = (t.match(/}/g) || []).length;
      if (o !== c) bad.push({ i, open: o, close: c });
    });
    const probe = document.createElement('div'); probe.className = 'pk-zen-x';
    document.body.appendChild(probe);
    const h = getComputedStyle(probe).height; probe.remove();
    return { bad, zenX: h };
  });
  console.log('    ' + JSON.stringify(css));
  ok('скобки во всех блоках стилей сходятся', css.bad.length === 0, css.bad);
  ok('правила после блока статистики не потерялись', css.zenX === '36px', css.zenX);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[J] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
