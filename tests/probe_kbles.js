/* probe_kbles — уроки агентства.

   Наблюдение живёт ровно столько, сколько держатся данные под ним. Урок —
   это решение человека «вот это знание»: формулировка, замороженный расчёт,
   автор и дата. Статус ему ставит не вкус, а счёт — правило, из которого он
   вырос, прогоняется заново по всем проектам, какие сейчас можно проверить.

   Фикстура — та же, что у наблюдателей, плюс поддельный SB, который
   запоминает всё, что уходит в базу. Числа посчитаны на бумаге:

     правило «маржа» — портфельное, проверяются все 4 активных проекта,
       срабатывает только на APOLO COFFEE (12% против 70/60/50)
       → «держится · видно на 1 из 4 проверенных проектов»
     правило «цена лида» — ему нужна сводка, а загружена она только у
       APOLO COFFEE → «держится · видно на 1 из 1 проверенного проекта»
     урок, снятый руками, перепроверке не подчиняется вовсе

   Потом маржа проекта чинится до 60% — правило перестаёт срабатывать
   где-либо, и урок обязан сняться сам, с пометкой почему и записью в базу. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'DTR Hunter', role: 'agency_owner', agency_id: 'AG', agencySlug: 'probe' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.toast = m => (window.__toasts = window.__toasts || []).push(m);
  window.LIVE = true;
  window.agIsOwner = () => true; window.agCanView = () => true; window.agCanEdit = () => true;
  window.agCanSeeProject = () => true;
  kbAutoEnsure = function () {}; window.kbPortEnsure = () => {};
  /* Числа в продукте докручиваются анимацией (animateCounters ловит .v),
     и проверка успевала снять их на середине. У продукта для этого есть
     собственный тормоз — им и пользуемся, чтобы читать готовые значения. */
  window._cntPause = true;

  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const ts = n => new Date(Date.now() + n * 86400000).toISOString();

  /* ── поддельный SB: отдаёт уроки и записывает всё, что в него пишут ── */
  const LOG = window.__sb = { ins: [], upd: [], del: [], n: 0 };
  const ROWS = window.__rows = [
    { id: 'L1', agency_id: 'AG', project_id: 'p1', rule_key: 'svc', kind: 'risk',
      title: 'Маржа проекта низкая', body: 'Проекты с себестоимостью выше 85% дохода не окупают выделенного менеджера.',
      math: [{ k: 'откуда маржа', l: [['доход ', { n: '25 000 000 сум' }, ' − расход ', { n: '22 000 000 сум' }, ' = ', { n: '3 000 000 сум' }]] }],
      facts: { by: 'DTR Hunter', project: 'APOLO COFFEE', tags: ['Паспорт'] },
      status: 'checking', status_note: '', checked_at: null, created_by: 'u1', created_at: ts(-6) },
    { id: 'L2', agency_id: 'AG', project_id: 'p1', rule_key: 'cpl', kind: 'risk',
      title: 'Лид дороже предельной цены', body: 'Держим CPL под предельной ценой из калькулятора, иначе объём только увеличивает убыток.',
      math: [{ k: 'фактическая цена лида', l: [['потрачено ', { n: '9 300 000 сум' }, ' ÷ лидов ', { n: '150' }, ' = ', { b: '62 000 сум' }]] }],
      facts: { by: 'Худойберди', project: 'APOLO COFFEE', tags: ['Калькулятор'] },
      status: 'checking', status_note: '', checked_at: null, created_by: 'u2', created_at: ts(-3) },
    { id: 'L3', agency_id: 'AG', project_id: 'p1', rule_key: 'er', kind: 'find',
      title: 'Вовлечённость выше цели', body: 'Публикации по вторникам собирают больше сохранений.',
      math: [], facts: { by: 'DTR Hunter', project: 'APOLO COFFEE', manual: true },
      status: 'refuted', status_note: 'снял DTR Hunter', checked_at: ts(-1), created_by: 'u1', created_at: ts(-40) } ];
  const q = res => { const o = {}; ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle', 'in'].forEach(m => o[m] = () => o);
    o.then = (a, b) => Promise.resolve(res()).then(a, b); o.catch = f => Promise.resolve(res()).catch(f); return o; };
  window.SB = { from: t => ({
    select: () => q(() => ({ data: ROWS.slice(), error: null })),
    insert: row => { LOG.ins.push(JSON.parse(JSON.stringify(row)));
      const r = Object.assign({ id: 'LN' + (++LOG.n), created_at: new Date().toISOString() }, row);
      ROWS.unshift(r); return q(() => ({ data: r, error: null })); },
    update: patch => ({ eq: (c, v) => { LOG.upd.push({ id: v, patch: JSON.parse(JSON.stringify(patch)) });
      const r = ROWS.find(x => x.id === v); if (r) Object.assign(r, patch); return q(() => ({ data: null, error: null })); } }),
    delete: () => ({ eq: (c, v) => { LOG.del.push(v); const i = ROWS.findIndex(x => x.id === v);
      if (i >= 0) ROWS.splice(i, 1); return q(() => ({ data: null, error: null })); } }) }) };

  /* ── проекты и сводка: та же расстановка, что у наблюдателей ── */
  const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#12281f"/></svg>');
  const P1 = { id: 'p1', name: 'APOLO COFFEE', logo: 'A', logoUrl: LOGO, st: 'active', status: 'active',
    svc: 'PROD', tariff: 'DeGold', pct: 25, stages: '2/8', mrr: 25000000, cost: 22000000,
    createdAt: day(-120), tg_chat_id: -100123, tg_settings: {} };
  const P2 = { id: 'p2', name: 'Artel', logo: 'A', st: 'active', status: 'active', pct: 40, stages: '2/5',
    mrr: 10000000, cost: 3000000, createdAt: day(-200) };
  const P3 = { id: 'p3', name: 'Level Studio', logo: 'L', st: 'active', status: 'active', pct: 70, stages: '7/10',
    mrr: 20000000, cost: 8000000, createdAt: day(-90) };
  const P4 = { id: 'p4', name: 'DeTroyd', logo: 'D', st: 'active', status: 'active', pct: 48, stages: '4/8',
    mrr: 12000000, cost: 6000000, createdAt: day(-60) };
  PROJECTS.length = 0; PROJECTS.push(P1, P2, P3, P4);
  window.agVisibleProjects = () => PROJECTS;
  KB_PROJECTS.length = 0;
  PROJECTS.forEach(p => KB_PROJECTS.push({ key: String(p.id), name: p.name, logo: p.logo, st: p.status }));
  KB_PORT = { _loading: 0, _loaded: 1, _at: Date.now(), _err: '', rows: {
    p1: { rep: [ts(-45)], smm: [], plan: [], ctEnd: day(9) },
    p2: { rep: [ts(-3)], smm: [], plan: [], ctEnd: day(5) },
    p3: { rep: [ts(-10)], smm: [], plan: [], ctEnd: day(200) },
    p4: { rep: [ts(-20)], smm: [], plan: [], ctEnd: '' } } };
  const CALC = { id: 'c9', name: 'Воронка · август', updated_at: ts(-2), cur: 'uzs', rate: null,
    data: { tab: 'funnel', f: {
      mode: 'budget', buy: 'lead', price: 50000, goal: 100, budget: 15000000,
      stages: [{ key: 'lead', name: 'Лиды', cr: null }, { key: 'sale', name: 'Продажи', cr: 25 }],
      aov: 400000, cogsMode: 'margin', unitCost: 0, marginPct: 50, varPct: 0, fixed: 0, salesCost: 0,
      vatPct: 0, vatIncluded: false, taxMode: 'none', turnoverPct: 0, profitTaxPct: 0,
      redeemPct: 100, returnPct: 0, repeatPct: 0, adVatPct: 0, agencyPct: 0, agencyFix: 0, prodCost: 0,
      days: 30, audience: null, frequency: null, spread: 20, targetKind: 'roas', targetValue: 4,
      payDelay: 0, instalPct: 0, instalMonths: 0, instalFeePct: 0,
      fact: { days: 15, spent: 9300000, buyQty: 150, orders: 35 } } } };
  const SMM = { id: 'r1', title: 'SMM-отчёт · август', kind: 'SMM', published_at: ts(-45),
    payload: { metrics: { total_reach: 200000, reels_reach: 140000, posts_reach: 60000,
      reels_count: 8, posts_count: 32, content_total: 40, er: 4.8 }, goals: { er: 3.5 } } };
  kbProj = 'p1';
  KB_AUTO['p1'] = { _loaded: 1, _at: Date.now(),
    contract: { start_date: day(-120), end_date: day(9) },
    services: [{ service: 'PROD', mrr: 25000000, cost: 22000000, status: 'active' }],
    members: [], lead: null, client: null, content: [], reports: [SMM],
    tasks: [{ status: 'active', created_at: ts(-70) }, { status: 'active', created_at: ts(-30) },
            { status: 'wait', created_at: ts(-25) }, { status: 'active', created_at: ts(-5) }],
    stages: [], briefs: [], briefAt: '', calc: CALC };

  [...document.body.children].forEach(e => { if (e.id !== 'app-ag' && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName)) e.style.display = 'none'; });
  document.getElementById('app-ag').classList.add('on');
  KB_BLOCK = ''; KB_VIEW = ''; KB_OBS_OPEN = {}; KB_LESS_OPEN = {};
  kbLessInvalidate();
  agNav('kb');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1360, height: 940 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  await page.evaluate(setup);
  await page.waitForTimeout(500);

  console.log('[A] вход в библиотеку стоит над проектами');
  const entry = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const e = c.querySelector('.kb-lentry'), first = c.querySelector('.kb-plist .kb-pi');
    return { nm: e.querySelector('.nm').textContent, ct: e.querySelector('.ct').textContent,
      above: e.getBoundingClientRect().top < first.getBoundingClientRect().top,
      gap: Math.round(e.getBoundingClientRect().top - c.querySelector('.search').getBoundingClientRect().bottom),
      on: e.classList.contains('on') };
  });
  ok('в левой колонке есть вход в уроки', entry.nm === 'Уроки агентства', entry);
  ok('и он стоит выше списка проектов', entry.above === true, entry);
  ok('на нём — сколько уроков в библиотеке', entry.ct === '3', entry.ct);
  ok('пока открыто досье, вход не подсвечен', entry.on === false, entry);
  ok('вход не прилипает к полю поиска', entry.gap >= 10, entry);

  console.log('[B] закрепить наблюдение уроком');
  const pin = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const card = [...c.querySelectorAll('.kb-obs')][1];        // второй — «Маржа проекта низкая»
    const btn = [...card.querySelectorAll('.acts .kb-act')].find(x => /Закрепить/.test(x.textContent));
    btn.click();
    const ov = document.getElementById('ov-pd2');
    return { open: ov.classList.contains('on'),
      head: (ov.querySelector('.modal-h h3') || {}).textContent,
      sub: (ov.querySelector('.modal-h p') || {}).textContent,
      body: (document.getElementById('kb-lsn-body') || {}).value || '',
      mathRows: ov.querySelectorAll('.kb-math .r').length,
      mathOpen: ov.querySelectorAll('.kb-math.on').length,
      hint: (ov.querySelector('.kb-lsn-hint') || {}).textContent || '' };
  });
  ok('кнопка «Закрепить уроком» открывает окно', pin.open && pin.head === 'Закрепить уроком', pin);
  ok('в шапке названо наблюдение и проект-источник',
    /Маржа проекта низкая/.test(pin.sub) && /APOLO COFFEE/.test(pin.sub), pin.sub);
  ok('формулировка подставлена из наблюдения и её можно править',
    /Доход 25/.test(pin.body) && /маржа 12%/.test(pin.body), pin.body);
  ok('расчёт показан целиком и сразу раскрыт', pin.mathRows === 3 && pin.mathOpen === 1, pin);
  ok('и сказано, на скольких проектах правило держится',
    /видно на 1 из 4 проверенных проектов/.test(pin.hint), pin.hint);

  const saved = await page.evaluate(() => {
    document.getElementById('kb-lsn-body').value = 'Проекты с маржой ниже 15% не окупают выделенного менеджера.';
    document.querySelector('#ov-pd2 .btn-add').click();
    return null;
  });
  await page.waitForTimeout(250);
  const ins = await page.evaluate(() => ({
    n: window.__sb.ins.length, row: window.__sb.ins[0] || null,
    closed: !document.getElementById('ov-pd2').classList.contains('on'),
    toast: (window.__toasts || []).slice(-1)[0] || '' }));
  ok('окно закрылось и урок ушёл в базу', ins.n === 1 && ins.closed, ins);
  ok('записана правленая формулировка, а не исходная',
    /ниже 15%/.test((ins.row || {}).body || ''), (ins.row || {}).body);
  ok('к уроку прикреплены правило, проект и вид наблюдения',
    ins.row.rule_key === 'svc' && ins.row.project_id === 'p1' && ins.row.kind === 'risk', ins.row);
  ok('расчёт заморожен вместе с уроком', (ins.row.math || []).length === 3, (ins.row.math || []).length);
  ok('автор и источник сохранены рядом с цифрами',
    ins.row.facts.by === 'DTR Hunter' && ins.row.facts.project === 'APOLO COFFEE', ins.row.facts);
  ok('статус выставлен по счёту, а не по умолчанию',
    ins.row.status === 'confirmed' && /1 из 4/.test(ins.row.status_note), ins.row);

  console.log('[C] библиотека: что держится, что проверяется, что снято');
  const lib = await page.evaluate(() => {
    kbOpenLessons();
    const c = document.getElementById('content-ag');
    const cards = [...c.querySelectorAll('.kb-lsn')];
    return { view: KB_VIEW, n: cards.length,
      entryOn: c.querySelector('.kb-lentry').classList.contains('on'),
      head: (c.querySelector('.kb-bhd .kb-b-meta') || {}).textContent || '',
      st: cards.map(x => x.className.replace('kb-lsn ', '')),
      notes: cards.map(x => [...x.querySelectorAll('.m .tag')].map(t => t.textContent).join(' / ')),
      who: cards.map(x => (x.querySelector('.m .who') || {}).textContent || ''),
      tiles: c.querySelectorAll('.kb-tile').length };
  });
  ok('библиотека открылась вместо досье', lib.view === 'les' && lib.tiles === 0, lib);
  ok('вход в левой колонке подсветился', lib.entryOn === true, lib);
  ok('в библиотеке все четыре урока', lib.n === 4, lib.n);
  ok('снятое лежит внизу, а держащееся сверху',
    lib.st[0] === 'st-confirmed' && lib.st[lib.st.length - 1] === 'st-refuted', lib.st);
  ok('в шапке — сколько держится, проверяется и снято',
    /3 держится/.test(lib.head) && /0 проверяется/.test(lib.head) && /1 снято/.test(lib.head), lib.head);
  ok('портфельное правило проверено по всем четырём проектам',
    lib.notes.some(x => /видно на 1 из 4 проверенных проектов/.test(x)), lib.notes);
  ok('правилу со сводкой засчитан только загруженный проект',
    lib.notes.some(x => /видно на 1 из 1 проверенного проекта/.test(x)), lib.notes);
  ok('у каждого урока подписан автор и дата',
    lib.who.every(w => /закрепил .+ · \d\d\.\d\d\.\d{4}/.test(w)), lib.who);
  ok('снятый руками остался при своей пометке',
    lib.notes[lib.notes.length - 1].indexOf('снял DTR Hunter') >= 0, lib.notes);

  const frozen = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const card = [...c.querySelectorAll('.kb-lsn')].find(x => /9 300 000/.test(x.textContent));
    const btn = [...card.querySelectorAll('.acts .kb-act')].find(x => /Показать расчёт/.test(x.textContent));
    const before = card.querySelector('.kb-math').getBoundingClientRect().height;
    btn.click();
    return { before, after: card.querySelector('.kb-math').getBoundingClientRect().height,
      label: btn.textContent, txt: card.querySelector('.kb-math').textContent.replace(/\s+/g, ' ') };
  });
  ok('расчёт урока по умолчанию свёрнут', frozen.before === 0, frozen.before);
  ok('«Показать расчёт» разворачивает замороженную арифметику',
    frozen.after > 0 && frozen.label === 'Скрыть расчёт', frozen);
  ok('и в ней те самые числа, что были в день закрепления',
    /9 300 000/.test(frozen.txt) && /150/.test(frozen.txt) && /62 000/.test(frozen.txt), frozen.txt);

  console.log('[D] система снимает урок сама, когда данные перестали его держать');
  const drop = await page.evaluate(() => {
    /* Себестоимость упала: маржа стала 60% и правило «маржа» больше не
       срабатывает ни на одном проекте портфеля. */
    const p1 = PROJECTS.find(x => x.id === 'p1');
    p1.cost = 10000000;
    KB_AUTO['p1'].services = [{ service: 'PROD', mrr: 25000000, cost: 10000000, status: 'active' }];
    window.__sb.upd.length = 0;
    renderKB();
    const c = document.getElementById('content-ag');
    const cards = [...c.querySelectorAll('.kb-lsn')];
    const svc = cards.filter(x => /менеджера/.test(x.textContent));
    return { st: svc.map(x => x.className.replace('kb-lsn ', '')),
      note: svc.map(x => [...x.querySelectorAll('.m .tag')].map(t => t.textContent).join(' / ')),
      upd: window.__sb.upd.map(u => ({ id: u.id, s: u.patch.status, n: u.patch.status_note })),
      head: (c.querySelector('.kb-bhd .kb-b-meta') || {}).textContent || '',
      back: !!c.querySelector('.kb-lsn.st-refuted .acts .kb-act') };
  });
  ok('оба урока про маржу сняты автоматически',
    drop.st.length === 2 && drop.st.every(x => x === 'st-refuted'), drop.st);
  ok('и написано, почему именно: ни на одном из четырёх',
    drop.note.every(x => /ни на одном из 4 проверенных проектов/.test(x)), drop.note);
  ok('смена статуса ушла в базу', drop.upd.length === 2 && drop.upd.every(u => u.s === 'refuted'), drop.upd);
  ok('счётчик в шапке пересчитался', /1 держится/.test(drop.head) && /3 снято/.test(drop.head), drop.head);

  const idle = await page.evaluate(() => {
    window.__sb.upd.length = 0; renderKB();
    return { upd: window.__sb.upd.length };
  });
  ok('повторный заход в библиотеку в базу ничего не пишет', idle.upd === 0, idle);

  /* «Вернуть в проверку» — это не новый статус, а отказ от ручного: урок
     снова отдают правилу, и вердикт выносит оно. Правило «ER выше цели»
     на APOLO COFFEE держится, поэтому урок сразу поднимается обратно. */
  const manual = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const card = [...c.querySelectorAll('.kb-lsn')].find(x => /вторникам/.test(x.textContent));
    const btn = [...card.querySelectorAll('.acts .kb-act')].find(x => /Вернуть/.test(x.textContent));
    window.__sb.upd.length = 0;
    btn.click();
    const after = [...document.querySelectorAll('#content-ag .kb-lsn')].find(x => /вторникам/.test(x.textContent));
    const stored = window.__rows.find(r => r.id === 'L3');
    return { upd: window.__sb.upd.map(u => ({ s: u.patch.status, m: u.patch.facts ? !!u.patch.facts.manual : null })),
      st: after.className.replace('kb-lsn ', ''),
      note: [...after.querySelectorAll('.m .tag')].map(t => t.textContent).join(' / '),
      manual: !!(stored.facts || {}).manual, status: stored.status };
  });
  ok('ручная пометка снята — урок снова принадлежит правилу',
    manual.manual === false && manual.upd.some(u => u.m === false), manual);
  ok('и правило тут же выносит вердикт вместо нас',
    manual.st === 'st-confirmed' && manual.status === 'confirmed' &&
    /видно на 1 из 1 проверенного проекта/.test(manual.note), manual);
  ok('за поле статуса не спорят два запроса',
    manual.upd.filter(u => u.s !== undefined).length === 1, manual.upd);

  const del = await page.evaluate(() => {
    window.confirm = () => true;                       // спрашивать некого — проверяем, что после согласия урок исчезает
    const c = document.getElementById('content-ag');
    const before = c.querySelectorAll('.kb-lsn').length;
    const card = [...c.querySelectorAll('.kb-lsn')].find(x => /ниже 15%/.test(x.textContent));
    [...card.querySelectorAll('.acts .kb-act')].find(x => /Удалить/.test(x.textContent)).click();
    return { before, after: document.querySelectorAll('#content-ag .kb-lsn').length,
      del: window.__sb.del.slice(), left: window.__rows.length };
  });
  ok('удалённый урок исчезает из библиотеки', del.after === del.before - 1, del);
  ok('и удаляется из базы, а не только с экрана', del.del.length === 1 && del.left === 3, del);

  console.log('[E] из урока видно, откуда он взялся');
  const src = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const lnk = c.querySelector('.kb-lsn .m .tag.lnk');
    const txt = lnk.textContent;
    lnk.click();
    const c2 = document.getElementById('content-ag');
    return { txt, view: KB_VIEW, proj: kbProj, tiles: c2.querySelectorAll('.kb-tile').length };
  });
  ok('на карточке есть ссылка на проект-источник', /источник — APOLO COFFEE/.test(src.txt), src.txt);
  ok('по ней открывается досье этого проекта',
    src.view === '' && src.proj === 'p1' && src.tiles === 4, src);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 4)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
