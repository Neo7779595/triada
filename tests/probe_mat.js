/* probe_mat — материалы задачи отдельным окном, кнопка «Добавить», поиск без свечения */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.__toast = ''; window.toast = t => { window.__toast = String(t); };
  window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true;
  window.agCanDocs = () => true; window.giEnsureStatus = async () => ({ status: 'inactive' });
  window.ctBadge = () => ''; window.tLoadProjectWork = null; window.tLoadProjectToday = null;
  window.__moved = [];
  window.tTaskMove = async (id, st) => { window.__moved.push({ id, st });
    const t = (PROJECTS[pdIdx]._tasks || []).find(x => x.id === id); if (t) t.status = st;
    if (typeof renderPd === 'function') renderPd(); return true; };
  window.__signed = [];
  window.tTaskSignedUrl = async (p, ttl) => { window.__signed.push({ p, ttl }); return 'https://signed.example/' + encodeURIComponent(p); };
  window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; };
  TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null, is_pm: true }];
  PROJECTS = [{ id: 'p1', name: 'Artel', logo: 'A', logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0, stages: '1 / 3',
    status: 'active', mrr: 0, cost: 0, tg_chat_id: '-100', client_id: 'cl1', contacts: null, ui: null, kb: null,
    leads: ['m1'], lead_id: 'm1', _appr: [{ id: 'ap1', task_id: 't1', title: 'Сценарий Reels', status: 'changes',
      comment: 'Первые 3 секунды слабые', round: 2, sent_at: '2026-07-30T10:00:00Z' }],
    _stages: [{ id: 's1', name: 'РАЗРАБОТКА КОНТЕНТ ПЛАНА', status: 'active' }],
    _tasks: [{ id: 't1', title: 'Дать ТЗ дизайнеру', status: 'review', assignee_id: 'm1', stage_id: 's1',
      due_date: null, due_time: null, time_spent: 600, review_spent: 60, review_started: new Date().toISOString(),
      review_kind: 'client', subtasks: [],
      attachments: [ { type: 'link', url: 'https://www.pinterest.com/pin/123', name: 'Референс 1' },
                     { type: 'file', path: 'AG/1_ref.png', name: 'Макет главной.png', size: 240000, mime: 'image/png' },
                     { type: 'file', path: 'AG/2_tz.pdf', name: 'ТЗ.pdf', size: 90000, mime: 'application/pdf' } ] },
      { id: 't2', title: 'Без материалов', status: 'wait', assignee_id: 'm1', stage_id: 's1', due_date: null, due_time: null,
        time_spent: 0, review_spent: 0, subtasks: [], attachments: [] }],
    _reports: [] }];
  PK_ZEN = false; openProject(0); pdTab('kanban');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(400);

  console.log('\n[A] кнопка просмотра на карточке');
  const card = await page.evaluate(() => {
    const c1 = document.querySelector('.pk-card[data-tkid="t1"]'), c2 = document.querySelector('.pk-card[data-tkid="t2"]');
    return { eye: !!c1.querySelector('.eye'), tag: !!c1.querySelector('button.pk-att-tag'),
      tagOn: (c1.querySelector('.pk-att-tag') || {}).getAttribute ? c1.querySelector('.pk-att-tag').getAttribute('onclick') : '',
      noEye: !!c2.querySelector('.eye'), noTag: !!c2.querySelector('.pk-att-tag') };
  });
  console.log('    ' + JSON.stringify(card));
  ok('на карточке с материалами есть кнопка просмотра', card.eye, card);
  ok('счётчик вложений тоже открывает материалы', card.tag && /pkMatOpen/.test(card.tagOn || ''), card);
  ok('на карточке без материалов кнопок нет', !card.noEye && !card.noTag, card);
  const size = await page.evaluate(() => {
    const c = document.querySelector('.pk-card[data-tkid="t1"]');
    const g = n => { const el = c.querySelector('.' + n); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { w: Math.round(r.width), h: Math.round(r.height), op: +cs.opacity, rad: parseFloat(cs.borderRadius),
        sv: Math.round(el.querySelector('svg').getBoundingClientRect().width) }; };
    return { eye: g('eye'), gear: g('gear'), del: g('del') };
  });
  console.log('    ' + JSON.stringify(size));
  ok('кнопки крупные — по ним удобно попасть', size.eye.w >= 28 && size.gear.w >= 28 && size.del.w >= 28
    && size.eye.h >= 28, size);
  ok('значки читаемые', size.eye.sv >= 15 && size.gear.sv >= 15 && size.del.sv >= 15, size);
  ok('видны и без наведения на карточку', size.eye.op >= 0.3 && size.gear.op >= 0.3 && size.del.op >= 0.3, size);
  ok('углы мягкие', size.eye.rad >= 8, size);

  console.log('\n[B] окно материалов');
  await page.evaluate(() => document.querySelector('.pk-card[data-tkid="t1"] .eye').click());
  await page.waitForTimeout(400);
  const mat = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.pkmat'); if (!m) return null;
    return { ttl: m.querySelector('.pkmat-ttl').textContent, sub: m.querySelector('.pkmat-sub').textContent,
      badge: (m.querySelector('.pkmat-badge') || {}).textContent || '',
      tiles: [...m.querySelectorAll('.pkmat-it')].map(x => ({ nm: x.querySelector('.pkmat-nm').textContent,
        meta: x.querySelector('.pkmat-meta').textContent, k: x.className.match(/k-\w+/)[0] })),
      note: (m.querySelector('.pkmat-note') || {}).textContent || '',
      acts: [...m.querySelectorAll('.pkmat-acts button')].map(x => x.textContent.trim()),
      w: Math.round(m.getBoundingClientRect().width),
      pvH: Math.round(m.querySelector('.pkmat-pv').getBoundingClientRect().height) };
  });
  console.log('    ' + JSON.stringify(mat));
  ok('окно открылось с названием задачи', mat && mat.ttl === 'Дать ТЗ дизайнеру', mat && mat.ttl);
  ok('в подзаголовке проект, этап и исполнитель', /Artel/.test(mat.sub) && /КОНТЕНТ ПЛАНА/.test(mat.sub) && /Худойберди/.test(mat.sub), mat.sub);
  ok('видно, что задача на утверждении у клиента', /Клиент/.test(mat.badge), mat.badge);
  ok('все три материала на месте', mat.tiles.length === 3, mat.tiles);
  ok('типы распознаны — ссылка, картинка, PDF', mat.tiles[0].k === 'k-link' && mat.tiles[1].k === 'k-img' && mat.tiles[2].k === 'k-pdf', mat.tiles.map(t => t.k));
  ok('у ссылки виден домен', /pinterest\.com/.test(mat.tiles[0].meta), mat.tiles[0].meta);
  ok('у файла — размер', /КБ|МБ/.test(mat.tiles[1].meta), mat.tiles[1].meta);
  ok('правки клиента показаны прямо в окне', /просит правки/.test(mat.note) && /Первые 3 секунды/.test(mat.note), mat.note);
  ok('решение принимается здесь же', mat.acts.length === 2 && /Принять/.test(mat.acts[1]) && /Вернуть/.test(mat.acts[0]), mat.acts);
  ok('окно крупное', mat.w >= 700 && mat.pvH >= 110, { w: mat.w, pv: mat.pvH });

  console.log('\n[C] превью картинок и открытие');
  const pv = await page.evaluate(() => ({ img: !!document.querySelector('.pkmat-it[data-i="1"] .pkmat-pv img'),
    signed: window.__signed.map(x => x.p) }));
  console.log('    ' + JSON.stringify(pv));
  ok('картинка показана превью, а не иконкой', pv.img, pv);
  ok('подписана только картинка, лишних запросов нет', pv.signed.length === 1 && /ref\.png/.test(pv.signed[0]), pv.signed);
  const opened = await page.evaluate(async () => { window.__opened = [];
    document.querySelector('.pkmat-it[data-i="0"]').click();
    document.querySelector('.pkmat-it[data-i="2"]').click();
    await new Promise(r => setTimeout(r, 250));
    return window.__opened; });
  console.log('    ' + JSON.stringify(opened));
  ok('ссылка открывается как есть', /pinterest\.com\/pin\/123/.test(opened[0] || ''), opened);
  ok('файл открывается подписанной ссылкой', /signed\.example/.test(opened[1] || ''), opened);

  console.log('\n[D] вердикт прямо из окна');
  const verdict = await page.evaluate(async () => { window.__moved = [];
    await pkMatVerdict('done');
    return { moved: window.__moved, closed: !document.querySelector('#ov-pd2 .modal.pkmat'), toast: window.__toast }; });
  console.log('    ' + JSON.stringify(verdict));
  ok('«Принять работу» двигает задачу в готово', verdict.moved.length === 1 && verdict.moved[0].st === 'done', verdict.moved);
  ok('окно закрывается и говорит о результате', verdict.closed && /принята/i.test(verdict.toast), verdict);
  const noAct = await page.evaluate(() => { PROJECTS[0]._tasks[0].status = 'active'; renderPd();
    pkMatOpen('t1'); const a = document.querySelectorAll('.pkmat-acts button').length; pd2Close(); return a; });
  ok('у задачи не на утверждении кнопок решения нет', noAct === 0, noAct);

  console.log('\n[E] строка добавления материала');
  await page.evaluate(() => { PROJECTS[0]._tasks[0].status = 'active'; pkAskReviewClient('t1'); });
  await page.waitForTimeout(250);
  const addRow = await page.evaluate(() => {
    const h = el => el ? Math.round(el.getBoundingClientRect().height) : 0;
    const btn = document.querySelector('.pkcl-add .sch-attbtn');
    return { nm: h(document.getElementById('pkcl-lname')), link: h(document.querySelector('.pkcl-add .sch-linkwrap')),
      btn: h(btn), w: btn ? Math.round(btn.getBoundingClientRect().width) : 0,
      r: btn ? getComputedStyle(btn).borderRadius : '' };
  });
  console.log('    ' + JSON.stringify(addRow));
  ok('кнопка «Добавить» одной высоты с полями', addRow.btn === addRow.nm && addRow.btn === addRow.link, addRow);
  ok('и стала крупнее', addRow.btn >= 40 && addRow.w >= 100, addRow);
  ok('углы мягкие, а не острые', parseFloat(addRow.r) >= 10, addRow.r);
  await page.evaluate(() => pd2Close());

  console.log('\n[F] поиск без свечения');
  const glow = await page.evaluate(async () => {
    const i = document.getElementById('pk-search'); i.focus();
    await new Promise(r => setTimeout(r, 120));
    const wrap = i.closest('.pk-search-wrap');
    const cw = getComputedStyle(wrap), ci = getComputedStyle(i);
    return { wrapShadow: cw.boxShadow, wrapOutline: cw.outlineStyle + ' ' + cw.outlineWidth,
      inpShadow: ci.boxShadow, border: ci.borderColor };
  });
  console.log('    ' + JSON.stringify(glow));
  ok('вокруг поля нет кольца', /none/.test(glow.wrapShadow) && /none/.test(glow.wrapOutline), glow);
  ok('и внутри тени нет', /none/.test(glow.inpShadow), glow);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[G] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
