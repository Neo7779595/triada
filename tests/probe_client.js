/* probe_client — клиенту уходит материал, а не задача; решение возвращается на доску */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const TASK_TITLE = 'Продумать техническую часть — привязка бота';

const setup = (TASK_TITLE) => {
  window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.__toast = ''; window.__toasts = [];
  window.toast = t => { window.__toast = String(t); window.__toasts.push(String(t)); };
  window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true;
  window.agCanDocs = () => true; window.giEnsureStatus = async () => ({ status: 'inactive' });
  window.ctBadge = () => ''; window.tLoadProjectWork = null; window.tLoadProjectToday = null;
  window.__moved = [];
  window.__realMove = window.tTaskMove;                       // боевой перенос — для проверки вердикта
  window.tTaskMove = async (id, st, extra) => { window.__moved.push({ id, st, extra });
    const t = (PROJECTS[pdIdx]._tasks || []).find(x => x.id === id);
    if (t) { t.status = st; if (extra) { t.review_kind = extra.review_kind || null; t.review_by = extra.review_by || null; } }
    if (typeof renderPd === 'function') renderPd(); return true; };
  window.__tg = []; window.tgNotify = (pid, ev, data) => { window.__tg.push({ pid, ev, data }); return Promise.resolve({ ok: true }); };
  window.__tgs = []; window.tgStaffNotify = (id, ev, data) => { window.__tgs.push({ id, ev, data }); return Promise.resolve({ ok: true }); };
  window.tTaskSignedUrl = async (path) => 'https://signed.example/' + encodeURIComponent(path);
  /* мок базы: важно не «прошло без ошибки», а что именно улетело */
  window.__sb = { inserts: [], updates: [], rpcs: [] };
  window.SB = {
    from(t) { return {
      insert(row) { window.__sb.inserts.push({ t, row });
        const res = { data: Object.assign({ id: 'ap-1' }, row), error: null };
        return { select() { return { maybeSingle() { return Promise.resolve(res); } }; } }; },
      update(patch) { return { eq(col, val) { window.__sb.updates.push({ t, patch, col, val });
        /* база возвращает строку после триггеров — оттуда берём исполнителя */
        const res = { data: { sent_by: 'u1', task_assignee: 'm1' }, error: null };
        const p = Promise.resolve(res);
        p.select = () => ({ maybeSingle: () => Promise.resolve(res) });
        return p; } }; },
    }; },
    rpc(fn, args) { window.__sb.rpcs.push({ fn, args }); return Promise.resolve({ data: null, error: null }); },
  };
  TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null, is_pm: true }];
  PROJECTS = [{ id: 'p1', name: 'TRIA SMART CORP', logo: 'T', logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0,
    stages: '1 / 3', status: 'active', mrr: 0, cost: 0, tg_chat_id: '-100500', client_id: 'cl1', contacts: null, ui: null, kb: null,
    leads: ['m1'], lead_id: 'm1', _todaySec: 0,
    _stages: [{ id: 's1', name: 'СЦЕНАРИИ', status: 'active' }],
    _appr: [],
    _tasks: [{ id: 't1', title: TASK_TITLE, status: 'active', assignee_id: 'm1', stage_id: 's1',
      due_date: null, due_time: null, time_spent: 600, review_spent: 0, subtasks: [],
      attachments: [ { type: 'link', url: 'https://docs.google.com/document/d/scen', name: 'Сценарий Reels' },
                     { type: 'file', path: 'AG/123_tz.pdf', name: 'ТЗ внутреннее.pdf', size: 4096 } ] }],
    _reports: [] }];
  localStorage.removeItem('triada_pkzen'); localStorage.removeItem('triada_rv_p1');
  PK_ZEN = false;
  openProject(0); pdTab('kanban');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup, TASK_TITLE);
  await page.waitForTimeout(400);

  console.log('\n[A] выбор проверяющего → клиент');
  await page.evaluate(() => pkAskReview('t1'));
  await page.waitForTimeout(200);
  const step1 = await page.evaluate(() => {
    const cl = document.querySelector('.pkrv-client');
    return { has: !!cl, txt: cl ? cl.textContent.replace(/\s+/g, ' ').trim() : '', onclick: cl ? cl.getAttribute('onclick') : '' };
  });
  console.log('    ' + JSON.stringify(step1));
  ok('клиент в списке проверяющих', step1.has, step1);
  ok('клик по клиенту открывает выбор материала', /pkAskReviewClient/.test(step1.onclick || ''), step1.onclick);
  await page.evaluate(() => document.querySelector('.pkrv-client').click());
  await page.waitForTimeout(220);

  console.log('\n[B] что показать клиенту');
  const step2 = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.pkcl'); if (!m) return null;
    return { ttl: (m.querySelector('.pkcl-ttl') || {}).textContent,
      title: (document.getElementById('pkcl-t') || {}).value,
      items: [...m.querySelectorAll('.pkcl-it')].map(x => ({ nm: x.querySelector('.pkcl-nm').value, on: x.classList.contains('on') })),
      hint: (m.querySelector('.pkcl-hint') || {}).textContent,
      hasTaskTitle: m.textContent.indexOf('Продумать техническую часть') >= 0,
      moved: window.__moved.length };
  });
  console.log('    ' + JSON.stringify(step2));
  ok('окно материала открылось', !!step2 && /Что показать клиенту/.test(step2.ttl), step2);
  ok('название по умолчанию — из этапа, а не из задачи', step2.title === 'Сценарии', step2.title);
  ok('в окне нет названия задачи', !step2.hasTaskTitle, step2);
  ok('оба вложения предложены и отмечены', step2.items.length === 2 && step2.items.every(i => i.on), step2.items);
  ok('видно, куда уйдёт', /кабинет клиента/.test(step2.hint || '') && /Telegram/.test(step2.hint || ''), step2.hint);
  ok('и что ответ придёт не в бот, раз он не подключён', /не подключён Telegram/.test(step2.hint || ''), step2.hint);
  const withTg = await page.evaluate(() => { TEAM[0].tg_user_id = 555; TEAM.push({ _id: 'u1', name: 'DTR', tg_user_id: 777 });
    pd2Close(); pkAskReviewClient('t1');
    const h = (document.querySelector('.pkcl-hint') || {}).textContent; return h; });
  ok('подключённому Telegram лишнего не пишем', !/не подключён/.test(withTg || ''), withTg);
  ok('задача пока не сдвинулась', step2.moved === 0, step2.moved);

  const noneSel = await page.evaluate(() => { pkClToggle(0); pkClToggle(1);
    return { disabled: document.getElementById('pkcl-go').disabled }; });
  ok('без материала отправить нельзя', noneSel.disabled === true, noneSel);
  await page.evaluate(() => { pkClToggle(0); });      // вернули сценарий, ТЗ оставили внутри
  await page.evaluate(() => { const i = document.getElementById('pkcl-link'); i.value = 'drive.google.com/folders/x'; pkClAddLink(); });
  await page.waitForTimeout(120);
  const added = await page.evaluate(() => [...document.querySelectorAll('.pkcl-it')].map(x => x.querySelector('.pkcl-nm').value));
  console.log('    названия: ' + JSON.stringify(added));
  ok('вставленная ссылка добавилась в список', added.length === 3, added);
  ok('у ссылки человеческое имя, а не адрес', added[2] === 'Файл на Диске', added);
  ok('и у прежних вложений тоже', added[0] === 'Сценарий Reels' && added[1] === 'ТЗ внутреннее.pdf', added);
  const named = await page.evaluate(() => {
    const i = document.getElementById('pkcl-lname'), l = document.getElementById('pkcl-link');
    i.value = 'Референс 1'; l.value = 'https://www.youtube.com/watch?v=jcoMujWskB4&list=RDjcoMujW'; pkClAddLink();
    i.value = ''; l.value = 'https://youtu.be/HhHrkkw6xS8'; pkClAddLink();          // без имени — подставится своё
    l.value = 'https://youtu.be/second'; pkClAddLink();                              // такое же имя — с номером
    const nm = [...document.querySelectorAll('.pkcl-nm')].map(x => x.value);
    return { nm, focus: document.activeElement.id };
  });
  console.log('    после добавления: ' + JSON.stringify(named.nm));
  ok('своё название сохраняется как есть', named.nm[3] === 'Референс 1', named.nm);
  ok('без названия — «Видео на YouTube», а не адрес', named.nm[4] === 'Видео на YouTube', named.nm);
  ok('одинаковые имена нумеруются', named.nm[5] === 'Видео на YouTube 2', named.nm);
  ok('курсор остаётся в поле названия — можно добавлять подряд', named.focus === 'pkcl-lname', named.focus);
  const edited = await page.evaluate(() => {
    const inp = document.querySelectorAll('.pkcl-nm')[3];
    inp.value = 'Референс 1 · динамика'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    pkClToggle(4); pkClToggle(4);                                   // переключение не должно стирать правку
    return [...document.querySelectorAll('.pkcl-nm')].map(x => x.value)[3];
  });
  ok('правка названия переживает переключение галочек', edited === 'Референс 1 · динамика', edited);
  await page.evaluate(() => { for (let i = 5; i >= 3; i--) pkClDel(i); });   // убрали лишние, дальше сценарий прежний
  await page.evaluate(() => { document.getElementById('pkcl-t').value = 'Сценарий Reels · сентябрь';
    document.getElementById('pkcl-n').value = 'Посмотрите первые три секунды'; });
  await page.evaluate(() => pkClSend());
  await page.waitForTimeout(500);

  console.log('\n[C] что ушло');
  const sent = await page.evaluate(() => {
    const ins = window.__sb.inserts.find(x => x.t === 'task_approvals');
    return { moved: window.__moved[0] || null, ins: ins ? ins.row : null,
      tg: window.__tg[0] || null, rpc: window.__sb.rpcs.map(r => ({ fn: r.fn, keys: Object.keys(r.args.patch || {}) })),
      att: (PROJECTS[0]._tasks[0].attachments || []).length, closed: !document.querySelector('#ov-pd2 .modal.pkcl'),
      toast: window.__toast };
  });
  console.log('    запись: ' + JSON.stringify(sent.ins));
  console.log('    telegram: ' + JSON.stringify(sent.tg));
  ok('задача ушла на утверждение к клиенту', sent.moved && sent.moved.st === 'review' && sent.moved.extra.review_kind === 'client', sent.moved);
  ok('создана запись согласования', !!sent.ins && sent.ins.status === 'pending' && sent.ins.round === 1, sent.ins);
  ok('название — наше, не из задачи', sent.ins.title === 'Сценарий Reels · сентябрь', sent.ins.title);
  ok('ушли только отмеченные материалы', sent.ins.items.length === 2, sent.ins.items);
  ok('внутреннее ТЗ клиенту не ушло', !JSON.stringify(sent.ins.items).includes('ТЗ внутреннее'), sent.ins.items);
  ok('этап приложен — клиент видит этапы', sent.ins.stage_name === 'СЦЕНАРИИ', sent.ins.stage_name);
  ok('просьба сохранена', /первые три секунды/.test(sent.ins.note || ''), sent.ins.note);
  ok('новая ссылка осталась и в задаче', sent.att === 3 && sent.rpc.some(r => r.fn === 'update_project_task' && r.keys.indexOf('attachments') >= 0), sent);
  ok('в Telegram ушёл материал, а не задача', sent.tg && sent.tg.ev === 'task_review'
    && sent.tg.data.title === 'Сценарий Reels · сентябрь'
    && !JSON.stringify(sent.tg.data).includes('Продумать техническую'), sent.tg);
  ok('в сообщении есть ссылки на материалы', sent.tg && Array.isArray(sent.tg.data.items) && sent.tg.data.items.length === 2, sent.tg && sent.tg.data.items);
  ok('ссылки в платформу клиенту не шлём', !(sent.tg && sent.tg.data.link), sent.tg && sent.tg.data.link);
  ok('окно закрылось и сказали, что ушло', sent.closed && /согласование/i.test(sent.toast || ''), sent);

  console.log('\n[D] карточка на доске');
  const card = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.pk-card')].find(x => x.dataset.tkid === 't1');
    const col = c ? c.closest('.pk-col').dataset.st : null;
    return { col, appr: c ? (c.querySelector('.pk-appr') || {}).textContent : null,
      cls: c ? (c.querySelector('.pk-appr') || {}).className : null,
      who: c ? !!c.querySelector('.pk-rvwho') : false };
  });
  console.log('    ' + JSON.stringify(card));
  ok('задача стоит в «На утверждении»', card.col === 'review', card);
  ok('на карточке видно материал у клиента', /У клиента/.test(card.appr || '') && /Сценарий Reels/.test(card.appr || ''), card);

  console.log('\n[E] кабинет клиента');
  const cab = await page.evaluate(() => {
    window.CLP = { id: 'p1', name: 'TRIA SMART CORP', logo: 'T', logoUrl: '', svc: 'SMM', cat: 'IT', status: 'active',
      mrr: 0, createdAt: null, tgChat: null, cl_hidden: [], allProjects: [], stages: [{ id: 's1', name: 'СЦЕНАРИИ', status: 'active', taskTotal: 1, taskDone: 0 }],
      reports: [], history: [], feed: [], documents: [], board: null,
      approvals: [ { id: 'ap-1', task_id: 't1', stage_name: 'СЦЕНАРИИ', title: 'Сценарий Reels · сентябрь',
        note: 'Посмотрите первые три секунды', status: 'pending', comment: null, round: 1, sent_by: 'u1',
        items: [ { type: 'link', name: 'Сценарий Reels', url: 'https://docs.google.com/document/d/scen' },
                 { type: 'link', name: 'drive.google.com/folders/x', url: 'https://drive.google.com/folders/x' } ] } ] };
    renderClOverview();
    const el = document.getElementById('content-cl');
    return { block: !!el.querySelector('.clap-card'), ttl: (el.querySelector('.clap-t') || {}).textContent,
      stage: (el.querySelector('.clap-stg') || {}).textContent,
      items: [...el.querySelectorAll('.clap-it')].map(a => ({ nm: a.querySelector('.nm').textContent, href: a.getAttribute('href') })),
      note: (el.querySelector('.clap-note') || {}).textContent,
      acts: [...el.querySelectorAll('.clap-acts button')].map(x => x.textContent.trim()),
      leak: el.textContent.indexOf('Продумать техническую') >= 0 };
  });
  console.log('    ' + JSON.stringify(cab));
  ok('блок «ждём решения» появился', cab.block, cab);
  ok('клиент видит название материала', cab.ttl === 'Сценарий Reels · сентябрь', cab.ttl);
  ok('и этап, к которому он относится', /СЦЕНАРИИ/.test(cab.stage || ''), cab.stage);
  ok('ссылки на месте и открываются', cab.items.length === 2 && /^https/.test(cab.items[0].href), cab.items);
  ok('просьба команды видна', /первые три секунды/.test(cab.note || ''), cab.note);
  ok('две кнопки решения', cab.acts.length === 2 && /Согласовать/.test(cab.acts[0]) && /правки/.test(cab.acts[1]), cab.acts);
  ok('название задачи клиенту не протекло', !cab.leak, cab.leak);

  console.log('\n[F] «есть правки» без слов не уходят');
  await page.evaluate(() => clApFix('ap-1'));
  await page.waitForTimeout(120);
  const empty = await page.evaluate(async () => { window.__toast = '';
    await clApDecide('ap-1', 'changes');
    return { upd: window.__sb.updates.length, toast: window.__toast, still: !!document.getElementById('clapc-ap-1') }; });
  ok('пустой комментарий не отправляется', empty.upd === 0 && /Напишите, что поправить/.test(empty.toast || ''), empty);
  ok('поле осталось открытым', empty.still, empty);

  const fix = await page.evaluate(async () => {
    document.getElementById('clapc-ap-1').value = 'Первые 3 секунды слабые, переснимите';
    await clApDecide('ap-1', 'changes');
    const u = window.__sb.updates[0] || null;
    return { u, tgs: window.__tgs[0] || null, done: (document.querySelector('#clapa-ap-1 .clap-done') || {}).textContent,
      st: (window.CLP.approvals[0] || {}).status };
  });
  console.log('    ' + JSON.stringify(fix));
  ok('правки записаны в согласование', fix.u && fix.u.t === 'task_approvals' && fix.u.patch.status === 'changes'
    && /переснимите/.test(fix.u.patch.comment || ''), fix.u);
  ok('решение привязано к нужной записи', fix.u && fix.u.col === 'id' && fix.u.val === 'ap-1', fix.u);
  ok('автору отправки ушло в Telegram', fix.tgs && fix.tgs.ev === 'client_decision' && fix.tgs.id === 'u1'
    && fix.tgs.data.status === 'changes' && /переснимите/.test(fix.tgs.data.comment || ''), fix.tgs);
  ok('клиенту показали, что правки ушли', /Правки отправлены/.test(fix.done || ''), fix.done);
  const both = await page.evaluate(() => window.__tgs.map(x => x.id + ':' + x.ev));
  console.log('    кому ушло: ' + JSON.stringify(both));
  ok('исполнителю задачи — тоже', both.indexOf('m1:client_decision') >= 0, both);
  ok('двоим, а не одному и тому же дважды', both.length === 2, both);

  console.log('\n[G] согласование');
  const okDec = await page.evaluate(async () => {
    window.CLP.approvals[0].status = 'pending'; window.__sb.updates = []; window.__tgs = [];
    renderClOverview();
    await clApDecide('ap-1', 'approved');
    return { u: window.__sb.updates[0] || null, tgs: window.__tgs[0] || null,
      done: (document.querySelector('#clapa-ap-1 .clap-done') || {}).textContent };
  });
  console.log('    ' + JSON.stringify(okDec));
  ok('согласование записано', okDec.u && okDec.u.patch.status === 'approved', okDec.u);
  ok('и ушло команде', okDec.tgs && okDec.tgs.data.status === 'approved', okDec.tgs);
  ok('клиенту сказали спасибо, а не «ошибка»', /Согласовано/.test(okDec.done || ''), okDec.done);
  const gone = await page.evaluate(() => { renderClOverview(); return !document.querySelector('.clap-card'); });
  ok('решённое из блока уходит', gone, gone);

  console.log('\n[H] решение вернулось на доску');
  const back = await page.evaluate(() => {
    PROJECTS[0]._appr = [{ id: 'ap-1', task_id: 't1', title: 'Сценарий Reels · сентябрь', status: 'changes',
      comment: 'Первые 3 секунды слабые, переснимите', round: 1, sent_at: new Date(0).toISOString() }];
    PROJECTS[0]._tasks[0].status = 'active'; PROJECTS[0]._tasks[0].review_kind = null;
    renderPd();
    const c = [...document.querySelectorAll('.pk-card')].find(x => x.dataset.tkid === 't1');
    const a = c ? c.querySelector('.pk-appr') : null;
    return { col: c ? c.closest('.pk-col').dataset.st : null, cls: a ? a.className : '', txt: a ? a.textContent : '' };
  });
  console.log('    ' + JSON.stringify(back));
  ok('задача вернулась в работу', back.col === 'active', back);
  ok('правки клиента видны на карточке', /fix/.test(back.cls) && /переснимите/.test(back.txt), back);
  const round2 = await page.evaluate(() => {
    PROJECTS[0]._tasks[0].attachments = [{ type: 'link', url: 'https://docs.google.com/document/d/scen2', name: 'Сценарий v2' }];
    pkAskReviewClient('t1');
    const t = document.getElementById('pkcl-t');
    return { open: !!document.querySelector('.modal.pkcl'), items: document.querySelectorAll('.pkcl-it').length,
      round: (typeof pkApprList === 'function') ? (pkApprList(PROJECTS[0], 't1').length + 1) : 0 };
  });
  ok('второй круг считается', round2.round === 2, round2);
  await page.evaluate(() => pd2Close());

  console.log('\n[I] когда отправлять некуда');
  const nowhere = await page.evaluate(() => {
    PROJECTS[0].tg_chat_id = null; PROJECTS[0].client_id = null;
    pkAskReviewClient('t1');
    const h = (document.querySelector('.pkcl-hint') || {}).textContent;
    pd2Close(); PROJECTS[0].tg_chat_id = '-100500'; PROJECTS[0].client_id = 'cl1';
    return h; });
  ok('честно предупреждаем, что отправлять некуда', /некуда/.test(nowhere || ''), nowhere);

  console.log('\n[I2] файл уходит подписанной ссылкой');
  const fileCase = await page.evaluate(async () => {
    window.__sb.inserts = []; window.__tg = [];
    PROJECTS[0]._tasks[0].attachments = [{ type: 'file', path: 'AG/999_scen.pdf', name: 'Сценарий.pdf', size: 1024 }];
    PROJECTS[0]._tasks[0].status = 'active'; PROJECTS[0]._appr = [];
    pkAskReviewClient('t1');
    await new Promise(r => setTimeout(r, 60));
    await pkClSend();
    const ins = window.__sb.inserts.find(x => x.t === 'task_approvals');
    return { items: ins ? ins.row.items : null, tg: (window.__tg[0] || {}).data || null };
  });
  console.log('    ' + JSON.stringify(fileCase.items));
  ok('файл уходит подписанной ссылкой', fileCase.items && fileCase.items.length === 1 && /^https:\/\/signed\./.test(fileCase.items[0].url), fileCase.items);
  ok('путь к файлу сохранён — ссылку можно перевыпустить', fileCase.items && fileCase.items[0].path === 'AG/999_scen.pdf', fileCase.items);
  ok('в Telegram у файла человеческое имя', fileCase.tg && fileCase.tg.items[0].name === 'Сценарий.pdf', fileCase.tg);

  console.log('\n[K] история согласований в задаче');
  const hist = await page.evaluate(async () => {
    PROJECTS[0]._appr = [
      { id: 'a1', task_id: 't1', title: 'Сценарий Reels · сентябрь', status: 'changes', comment: 'Первые 3 секунды слабые',
        round: 1, sent_at: '2026-07-20T10:00:00Z', decided_at: '2026-07-21T09:00:00Z', items: [{ url: 'https://x', name: 'v1' }] },
      { id: 'a2', task_id: 't1', title: 'Сценарий Reels · сентябрь v2', status: 'approved', comment: null,
        round: 2, sent_at: '2026-07-22T10:00:00Z', decided_at: '2026-07-22T15:00:00Z', items: [{ url: 'https://y', name: 'v2' }] }];
    PROJECTS[0]._tasks[0].status = 'done';
    await pdTaskEdit('t1');
    const rows = [...document.querySelectorAll('.apph-row')].map(r => ({ cls: r.className, txt: r.textContent.replace(/\s+/g, ' ').trim() }));
    const lbl = [...document.querySelectorAll('#ov-pd2 label')].map(x => x.textContent).find(x => /Согласование с клиентом/.test(x || '')) || '';
    pd2Close();
    return { rows, lbl };
  });
  console.log('    ' + JSON.stringify(hist.rows.map(r => r.txt.slice(0, 70))));
  ok('история согласований видна в задаче', hist.rows.length === 2, hist.rows.length);
  ok('свежий круг сверху', /круг 2/.test(hist.rows[0].txt) && /круг 1/.test(hist.rows[1].txt), hist.rows.map(r => r.txt.slice(0, 20)));
  ok('видно, чем закончился каждый круг', /согласовано/.test(hist.rows[0].txt) && /правки/.test(hist.rows[1].txt), hist.rows);
  ok('комментарий клиента сохранён в истории', /Первые 3 секунды слабые/.test(hist.rows[1].txt), hist.rows[1].txt);
  ok('в заголовке — число кругов', /2 круга/.test(hist.lbl), hist.lbl);

  console.log('\n[L] ссылка из Telegram ведёт к материалу');
  const deep = await page.evaluate(async () => {
    window.CLP.approvals[0].status = 'pending'; window.CLP.approvals[0].decided_at = null;
    renderClOverview();
    history.replaceState(null, '', '/index.html?ap=ap-1');
    _clApDeepLink();
    await new Promise(r => setTimeout(r, 400));
    const el = document.getElementById('clap-ap-1');
    return { hl: !!el && el.classList.contains('clap-hl'), url: location.search };
  });
  ok('материал подсвечивается', deep.hl, deep);
  ok('адрес чистится, чтобы не срабатывать снова', deep.url === '', deep.url);
  const gone2 = await page.evaluate(async () => {
    window.__toast = '';
    history.replaceState(null, '', '/index.html?ap=нет-такого');
    _clApDeepLink();
    await new Promise(r => setTimeout(r, 400));
    return window.__toast; });
  ok('если материала нет — говорим прямо', /не найден|отозвали/.test(gone2 || ''), gone2);

  console.log('\n[M] кнопка в сообщении и настройки события');
  const btn = await page.evaluate(async () => {
    window.__tg = []; window.__sb.inserts = [];
    PROJECTS[0]._tasks[0].status = 'active'; PROJECTS[0]._appr = [];
    PROJECTS[0]._tasks[0].attachments = [{ type: 'link', url: 'https://docs.google.com/x', name: 'Сценарий' }];
    pkAskReviewClient('t1'); await new Promise(r => setTimeout(r, 60)); await pkClSend();
    const withCab = (window.__tg[0] || {}).data || null;
    // а теперь без кабинета
    window.__tg = []; PROJECTS[0].client_id = null; PROJECTS[0]._tasks[0].status = 'active';
    pkAskReviewClient('t1'); await new Promise(r => setTimeout(r, 60)); await pkClSend();
    const noCab = (window.__tg[0] || {}).data || null;
    PROJECTS[0].client_id = 'cl1';
    return { withCab: withCab && withCab.cab, noCab: noCab && noCab.cab };
  });
  console.log('    ' + JSON.stringify(btn));
  ok('кабинету — ссылка на сам материал', /\?ap=ap-1$/.test(btn.withCab || ''), btn.withCab);
  ok('без кабинета кнопку не обещаем', !btn.noCab, btn.noCab);
  const tgset = await page.evaluate(() => {
    PROJECTS[0].tg_chat_id = '-100500'; tgOpenModal();
    const evs = [...document.querySelectorAll('.tg-ev')].map(x => (x.getAttribute('onchange') || '') + '|' + x.textContent.trim());
    const one = evs.find(x => /task_review/.test(x)) || (document.querySelector('.tg-evs') ? document.querySelector('.tg-evs').innerHTML : '');
    pd2Close();
    return { has: /task_review/.test(document.body.innerHTML) || /task_review/.test(one || ''), one: String(one).slice(0, 120) };
  });
  ok('событие можно выключить в настройках Telegram', tgset.has, tgset);

  console.log('\n[N] круги в аналитике');
  const cyc = await page.evaluate(() => {
    const A = { sent: 7, materials: 3, closed: 2, firstOk: 1, avgRounds: 7 / 3, replyAvgMs: 5 * 3600e3,
      replyMaxMs: 26 * 3600e3, pending: 1, pendOldestMs: 50 * 3600e3,
      byProject: [{ pid: 'p1', client: 'TRIA SMART CORP', rounds: 5, fixes: 3, materials: 2, avg: 2.5 }] };
    const h = _cycApprHTML(A);
    const d = document.createElement('div'); d.innerHTML = h;
    return { empty: _cycApprHTML({ sent: 0 }), txt: d.textContent.replace(/\s+/g, ' ').trim(),
      cells: [...d.querySelectorAll('.px-ov-v')].map(x => x.textContent) };
  });
  console.log('    ' + JSON.stringify(cyc.cells) + ' ' + cyc.txt.slice(0, 120));
  ok('без согласований блока нет', cyc.empty === '', cyc.empty);
  ok('среднее число кругов', cyc.cells[0] === '2,3', cyc.cells);
  ok('доля с первого раза', cyc.cells[1] === '50%', cyc.cells);
  ok('скорость ответа клиента', /ч|мин|д/.test(cyc.cells[2] || ''), cyc.cells);
  ok('видно, что висит у клиента', cyc.cells[3] === '1' && /самый долгий/.test(cyc.txt), cyc.txt.slice(0, 200));
  ok('проекты с кругами перечислены', /TRIA SMART CORP/.test(cyc.txt) && /3 с правками/.test(cyc.txt), cyc.txt.slice(0, 300));

  console.log('\n[O] вердикт проверяющего — исполнителю');
  /* Боевой tTaskMove ходит в базу и в tg-staff своими средствами (модульная
     область — подмена window-функции его не касается). Поэтому слушаем сеть:
     так проверяется ровно тот payload, который уйдёт в продакшне. */
  const verdict = await page.evaluate(async () => {
    window.__fetch0 = window.fetch; window.__net = [];
    window.fetch = async (u, o) => { let b = null; try { b = JSON.parse((o && o.body) || 'null'); } catch (_) {}
      window.__net.push({ u: String(u), b });
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    const staff = () => window.__net.filter(x => /tg-staff/.test(x.u)).map(x => x.b);
    const T = PROJECTS[0]._tasks[0];
    T.assignee_id = 'm1'; T.status = 'review'; window.__net = [];
    await window.__realMove('t1', 'done');
    const okDone = staff()[0] || null;
    T.status = 'review'; window.__net = [];
    await window.__realMove('t1', 'active');
    const okBack = staff()[0] || null;
    return { okDone, okBack };
  });
  console.log('    приняли: ' + JSON.stringify(verdict.okDone));
  console.log('    вернули: ' + JSON.stringify(verdict.okBack && { to: verdict.okBack.profile_id, st: verdict.okBack.data.status }));
  ok('задачу приняли — исполнителю ушло', verdict.okDone && verdict.okDone.profile_id === 'm1'
    && verdict.okDone.event_type === 'review_verdict' && verdict.okDone.data.status === 'approved', verdict.okDone);
  ok('в сообщении есть проект, этап и ссылка на задачу', verdict.okDone && verdict.okDone.data.project_name === 'TRIA SMART CORP'
    && verdict.okDone.data.stage_name === 'СЦЕНАРИИ' && /task=t1/.test(verdict.okDone.data.link || ''), verdict.okDone && verdict.okDone.data);
  ok('задачу вернули — исполнителю ушло', verdict.okBack && verdict.okBack.profile_id === 'm1'
    && verdict.okBack.data.status === 'changes', verdict.okBack);
  const quiet = await page.evaluate(async () => {
    const staff = () => window.__net.filter(x => /tg-staff/.test(x.u)).length;
    const T = PROJECTS[0]._tasks[0];
    T.assignee_id = 'u1'; T.status = 'review'; window.__net = [];        // проверяю свою же задачу
    await window.__realMove('t1', 'done');
    const self = staff();
    T.assignee_id = 'm1'; T.status = 'active'; window.__net = [];        // обычный перенос, не с утверждения
    await window.__realMove('t1', 'done');
    const plain = staff();
    T.status = 'wait'; window.__net = [];
    await window.__realMove('t1', 'active');
    const other = staff();
    if (window.__fetch0) window.fetch = window.__fetch0;
    return { self, plain, other };
  });
  console.log('    ' + JSON.stringify(quiet));
  ok('себе о своём же решении не пишем', quiet.self === 0, quiet);
  ok('обычный перенос не шлёт вердикт', quiet.plain === 0 && quiet.other === 0, quiet);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[J] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
