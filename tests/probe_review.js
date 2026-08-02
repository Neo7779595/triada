/* probe_review — кто проверяет: выбор, уведомления, отражение в статистике */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'DTR HUNTER', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.__toast = ''; window.toast = t => { window.__toast = String(t); };
  window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true;
  window.agCanDocs = () => true; window.giEnsureStatus = async () => ({ status: 'inactive' });
  window.ctBadge = () => ''; window.tLoadProjectWork = null;
  window.__staff = []; window.tgStaffNotify = (id, ev, d) => { window.__staff.push({ id, ev, d }); };
  window.__cli = []; window.tgNotify = (pid, ev, d) => { window.__cli.push({ pid, ev, d }); };
  window.__moved = [];
  window.tTaskMove = async (id, st, extra) => {
    window.__moved.push({ id, st, extra });
    const t = (PROJECTS[pdIdx]._tasks || []).find(x => x.id === id);
    if (t) { t.status = st; if (extra) { t.review_kind = extra.review_kind || null; t.review_by = extra.review_by || null; } }
    if (typeof _pkRerender === 'function') _pkRerender();
    return true;
  };
  TEAM = [
    { _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null, is_pm: false, is_director: false },
    { _id: 'm2', name: 'Шахзод Курбонов', color: '#8A8FFF', avatar: null, is_pm: true, is_director: false },
    { _id: 'm3', name: 'Ирина Ли', color: '#F0785C', avatar: null, is_pm: false, is_director: true },
    { _id: 'u1', name: 'DTR HUNTER', color: '#E3B567', avatar: null, is_pm: false, is_director: false },
  ];
  PROJECTS = [{ id: 'p1', name: 'APOLO COFFEE', logo: 'A', logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0,
    stages: '1 / 3', status: 'active', mrr: 0, cost: 0, tg_chat_id: '-100777', contacts: null, ui: null,
    leads: ['m1'], lead_id: 'm1',
    _stages: [{ id: 's1', name: 'БРИФ', status: 'active' }],
    _tasks: [{ id: 't1', title: 'Смонтировать ролик', status: 'active', assignee_id: 'm1', stage_id: 's1',
      due_date: '2026-08-05', due_time: '18:00', time_spent: 3600, review_spent: 0, subtasks: [], attachments: [] }],
    _reports: [] }];
  localStorage.removeItem('triada_rv_p1');
  openProject(0);
  pdTab('kanban');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(300);

  console.log('\n[A] перевод на утверждение спрашивает, кто проверит');
  await page.evaluate(() => pkAdvance('t1', 'active'));
  await page.waitForTimeout(220);
  const ask = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.pkrv'); if (!m) return null;
    return { ttl: m.querySelector('.pkrv-ttl').textContent, sub: m.querySelector('.pkrv-sub').textContent,
      rows: [...m.querySelectorAll('.pkrv-row')].map(r => ({ nm: r.querySelector('.pkrv-nm').textContent.replace(/\s+/g, ' ').trim(),
        tag: (r.querySelector('.pkrv-tag') || {}).textContent || '', on: r.getAttribute('onclick') })),
      skip: !!m.querySelector('.pkrv-f .btn-ghost') };
  });
  console.log('    ' + JSON.stringify(ask, null, 1).slice(0, 900));
  ok('окно выбора открылось', !!ask);
  ok('задача сама пока не двинулась', await page.evaluate(() => window.__moved.length === 0));
  ok('первым — клиент', /Клиент/.test(ask.rows[0].nm) && /pkAskReviewClient/.test(ask.rows[0].on), ask.rows[0]);
  ok('сказано, что дальше спросим про материал', /материал/.test(ask.rows[0].nm), ask.rows[0].nm);
  ok('ведущий проекта — первым в команде', /Худойберди/.test(ask.rows[1].nm) && ask.rows[1].tag === 'ведёт проект', ask.rows[1]);
  ok('проект-менеджер в списке', ask.rows.some(r => /Шахзод/.test(r.nm) && r.tag === 'проект-менеджер'), ask.rows.map(r => [r.nm, r.tag]));
  ok('руководитель тоже', ask.rows.some(r => /Ирина/.test(r.nm) && r.tag === 'руководитель'), ask.rows.map(r => r.tag));
  ok('себя видно и подписано «вы»', ask.rows.some(r => /DTR HUNTER · вы/.test(r.nm)), ask.rows.map(r => r.nm));
  ok('есть выход без проверяющего', ask.skip, ask);

  console.log('\n[B] выбрали проект-менеджера');
  await page.evaluate(() => { const r = [...document.querySelectorAll('#ov-pd2 .pkrv-row')].find(x => /Шахзод/.test(x.textContent)); r.click(); });
  await page.waitForTimeout(300);
  const pm = await page.evaluate(() => ({ moved: window.__moved, staff: window.__staff, cli: window.__cli,
    toast: window.__toast, closed: !document.querySelector('#ov-pd2 .modal.pkrv'),
    task: (PROJECTS[0]._tasks[0]) }));
  console.log('    ' + JSON.stringify({ moved: pm.moved, staff: pm.staff, toast: pm.toast }, null, 1).slice(0, 900));
  ok('задача ушла на утверждение', pm.moved.length === 1 && pm.moved[0].st === 'review', pm.moved);
  ok('проверяющий записан в задачу', pm.moved[0].extra.review_kind === 'pm' && pm.moved[0].extra.review_by === 'm2', pm.moved[0].extra);
  ok('в телеграм ушло именно ему', pm.staff.length === 1 && pm.staff[0].id === 'm2' && pm.staff[0].ev === 'review_request', pm.staff);
  ok('в сообщении — ссылка на саму задачу', /\?p=p1&t=kanban&task=t1$/.test(pm.staff[0].d.link || ''), pm.staff[0].d.link);
  ok('и контекст: проект, этап, срок, кто отправил', pm.staff[0].d.project_name === 'APOLO COFFEE' && pm.staff[0].d.stage_name === 'БРИФ' && pm.staff[0].d.due === '2026-08-05' && !!pm.staff[0].d.task_id, pm.staff[0].d);
  ok('клиенту при этом ничего не ушло', pm.cli.length === 0, pm.cli);
  ok('сказали, кому отправили', /Шахзод/.test(pm.toast), pm.toast);
  ok('окно закрылось', pm.closed, pm);

  console.log('\n[B2] проверяющий — я сам');
  const self = await page.evaluate(async () => {
    window.__moved = []; window.__staff = []; window.__toast = '';
    PROJECTS[0]._tasks[0].status = 'active';
    await pkSendToReview('t1', 'pm', 'u1');
    return { staff: window.__staff, toast: window.__toast };
  });
  console.log('    ' + JSON.stringify(self.staff.map(x => x.id)) + ' · ' + JSON.stringify(self.toast));
  ok('себе уведомление тоже уходит', self.staff.length === 1 && self.staff[0].id === 'u1' && self.staff[0].ev === 'review_request', self.staff);

  console.log('\n[B3] бот не подключён — говорим честно');
  const off = await page.evaluate(async () => {
    window.__toast = ''; PROJECTS[0]._tasks[0].status = 'active';
    window.tgStaffNotify = async () => ({ ok: false, skipped: 'сотрудник не подключил Telegram' });
    await pkSendToReview('t1', 'pm', 'm2');
    const t = window.__toast;
    window.tgStaffNotify = (id, ev, d) => { window.__staff.push({ id, ev, d }); };
    return t;
  });
  console.log('    ' + JSON.stringify(off));
  ok('сказали, что в Telegram не ушло', /не подключил Telegram/.test(off) && /Шахзод/.test(off), off);

  console.log('\n[C] на карточке видно, кто проверяет');
  await page.evaluate(() => renderPd());          /* боевой tTaskMove делает это сам через _pkRerender */
  await page.waitForTimeout(150);
  const card = await page.evaluate(() => {
    const c = document.querySelector('.pk-card[data-tkid="t1"]');
    const el = c && c.querySelector('.pk-rvwho');
    return el ? el.textContent.replace(/\s+/g, ' ').trim()
      : ('DBG card=' + !!c + ' tab=' + pdTabCur + ' st=' + (PROJECTS[0]._tasks[0].status) + ' by=' + PROJECTS[0]._tasks[0].review_by + ' timer=' + !!(c && c.querySelector('.pk-timer.review')));
  });
  console.log('    ' + JSON.stringify(card));
  ok('имя проверяющего на карточке', /Шахзод/.test(card || ''), card);

  console.log('\n[D] выбрали клиента');
  await page.evaluate(() => { window.__moved = []; window.__staff = []; window.__cli = [];
    PROJECTS[0]._tasks[0].status = 'active'; pkAdvance('t1', 'active'); });
  await page.waitForTimeout(220);
  const lastMark = await page.evaluate(() => [...document.querySelectorAll('#ov-pd2 .pkrv-row')].filter(r => r.classList.contains('last')).map(r => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 20)));
  ok('прошлый выбор подсвечен', lastMark.some(s => /Шахзод/.test(s)), lastMark);
  await page.evaluate(() => document.querySelector('#ov-pd2 .pkrv-client').click());
  await page.waitForTimeout(300);
  /* клиенту уходит не задача, а материал: между выбором и отправкой стоит
     окно, где решают, что именно он увидит */
  const step = await page.evaluate(() => ({ modal: !!document.querySelector('#ov-pd2 .modal.pkcl'), moved: window.__moved.length }));
  ok('спрашиваем, какой материал показать', step.modal && step.moved === 0, step);
  await page.evaluate(async () => {
    const i = document.getElementById('pkcl-link'); i.value = 'https://docs.google.com/document/d/x'; pkClAddLink();
    document.getElementById('pkcl-t').value = 'Сценарий · сентябрь';
    await pkClSend();
  });
  await page.waitForTimeout(300);
  const cli = await page.evaluate(() => ({ moved: window.__moved, staff: window.__staff, cli: window.__cli, toast: window.__toast,
    who: (typeof pkReviewWho === 'function') ? pkReviewWho(PROJECTS[0]._tasks[0]) : null }));
  console.log('    ' + JSON.stringify(cli, null, 1).slice(0, 700));
  ok('в задаче — проверяет клиент', cli.moved[0].extra.review_kind === 'client' && !cli.moved[0].extra.review_by, cli.moved[0].extra);
  ok('сообщение ушло в группу проекта', cli.cli.length === 1 && cli.cli[0].ev === 'task_review' && cli.cli[0].pid === 'p1', cli.cli);
  ok('в сообщении материал, а не название задачи', cli.cli[0].d.title === 'Сценарий · сентябрь'
    && !JSON.stringify(cli.cli[0].d).includes('Смонтировать ролик'), cli.cli[0].d);
  ok('сотруднику ничего не слали', cli.staff.length === 0, cli.staff);
  ok('на карточке — «Клиент»', cli.who && cli.who.client === true, cli.who);

  console.log('\n[E] «без проверяющего» — только перевод');
  await page.evaluate(() => { window.__moved = []; window.__staff = []; window.__cli = [];
    PROJECTS[0]._tasks[0].status = 'active'; pkAdvance('t1', 'active'); });
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#ov-pd2 .pkrv-f .btn-ghost').click());
  await page.waitForTimeout(250);
  const skip = await page.evaluate(() => ({ moved: window.__moved, staff: window.__staff, cli: window.__cli }));
  ok('задача переведена', skip.moved.length === 1 && skip.moved[0].st === 'review', skip.moved);
  ok('проверяющий не назначен', !skip.moved[0].extra.review_kind && !skip.moved[0].extra.review_by, skip.moved[0].extra);
  ok('никому не писали', skip.staff.length === 0 && skip.cli.length === 0, skip);

  console.log('\n[F] перетаскивание в колонку тоже спрашивает');
  const drag = await page.evaluate(() => { window.__moved = []; PROJECTS[0]._tasks[0].status = 'active';
    _pkDrag = 't1'; pkDrop({ preventDefault() {}, target: { closest: () => null } }, 'review');
    return { asked: !!document.querySelector('#ov-pd2 .modal.pkrv'), moved: window.__moved.length }; });
  ok('спросили, а не двинули молча', drag.asked && drag.moved === 0, drag);
  await page.evaluate(() => pd2Close());

  console.log('\n[G] личное уведомление проверяющему');
  const ntf = await page.evaluate(() => {
    NTF = []; NTF_READ = {};
    _ntfTaskUpd({ new: { id: 't9', title: 'Снять рилс', status: 'review', review_by: 'u1', review_started: '2026-08-01T10:00:00Z',
      project_id: 'p1', assignee_id: 'm1' } });
    const mine = NTF.filter(n => /проверить/i.test(n.title || ''));
    NTF = []; NTF_READ = {};
    _ntfTaskUpd({ new: { id: 't8', title: 'Другая', status: 'review', review_by: 'm2', review_started: '2026-08-01T10:00:00Z',
      project_id: 'p1', assignee_id: 'm1' } });
    const alien = NTF.filter(n => /проверить/i.test(n.title || ''));
    return { mine: mine.map(n => ({ t: n.title, o: n.obj, sev: n.sev, ent: n.ent, tab: n.tab })), alien: alien.length };
  });
  console.log('    ' + JSON.stringify(ntf));
  ok('мне — заметное уведомление', ntf.mine.length === 1 && ntf.mine[0].sev === 'crit' && /Вас просят проверить/.test(ntf.mine[0].t), ntf.mine);
  ok('оно ведёт в саму задачу', ntf.mine[0].ent === 't9' && ntf.mine[0].tab === 'kanban', ntf.mine[0]);
  ok('чужое не показываем', ntf.alien === 0, ntf.alien);

  console.log('\n[H] статистика циклов');
  const cyc = await page.evaluate(() => {
    const day = n => new Date(Date.now() + n * 86400000).toISOString();
    Object.assign(CYCLES, { _loaded: true, stages: [], chartStages: [], trend: { vals: [], labels: [] }, clients: [], agingRows: [],
      reviewTasks: [
        { title: 'Ролик', sec: 40000, stage: 'БРИФ', project: 'APOLO COFFEE', pid: 'p1', tid: 't1', sid: 's1', onReview: true, date: day(-1), asg: 'm1', rvKind: 'pm', rvBy: 'm2' },
        { title: 'Пост', sec: 20000, stage: 'БРИФ', project: 'APOLO COFFEE', pid: 'p1', tid: 't2', sid: 's1', onReview: false, date: day(-2), asg: 'm1', rvKind: 'client', rvBy: null },
        { title: 'Сторис', sec: 10000, stage: 'БРИФ', project: 'APOLO COFFEE', pid: 'p1', tid: 't3', sid: 's1', onReview: false, date: day(-3), asg: 'm1', rvKind: null, rvBy: null },
      ],
      reviewStages: [], reviewByWho: [], reviewNow: 1, reviewCount: 3, reviewTotalSec: 70000, reviewAvgSec: 23333,
      workTopTasks: [], workCount: 0, workStages: [], workByAsg: [], workParetoPct: 0 });
    REV_Q = ''; renderCycles();
    const c = document.getElementById('content-ag'); document.body.appendChild(c);
    c.style.cssText = 'position:fixed;left:0;top:0;width:1460px;height:900px;overflow:auto;background:#0a0d0c;z-index:1;display:block;padding:20px';
    const chips = [...document.querySelectorAll('#content-ag .cyc-rv')].map(e => e.textContent.trim());
    const who = [...document.querySelectorAll('#content-ag .cyc-rvgrid .cyc-r')].map(r => ({
      nm: r.querySelector('.cyc-r-t').textContent, meta: r.querySelector('.cyc-r-m').textContent.replace(/\s+/g, ' ').trim(),
      val: r.querySelector('.cyc-r-val').textContent }));
    return { chips, who };
  });
  console.log('    ' + JSON.stringify(cyc, null, 1).slice(0, 800));
  ok('в строке задачи написано, кто проверяет', cyc.chips.some(s => /проверяет Шахзод/.test(s)) && cyc.chips.some(s => /проверяет клиент/.test(s)), cyc.chips);
  ok('появился разбор «кто держит»', cyc.who.length === 3, cyc.who.map(w => w.nm));
  ok('дольше всех — Шахзод', /Шахзод/.test(cyc.who[0].nm), cyc.who[0]);
  ok('клиент отдельной строкой', cyc.who.some(w => w.nm === 'Клиент'), cyc.who.map(w => w.nm));
  ok('без проверяющего — честная подпись', cyc.who.some(w => /не указан/.test(w.nm)), cyc.who.map(w => w.nm));
  ok('видно, сколько у него сейчас', /сейчас у него 1/.test(cyc.who[0].meta), cyc.who[0].meta);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[I] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
