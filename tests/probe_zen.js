/* probe_zen — сегодняшнее время, полноэкранный канбан и WIP-лимиты */
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
  window.tTaskMove = async (id, st, extra) => { window.__moved.push({ id, st, extra });
    const t = (PROJECTS[pdIdx]._tasks || []).find(x => x.id === id);
    if (t) { t.status = st; } if (typeof renderPd === 'function') renderPd(); return true; };
  TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null, is_pm: true }];
  const mk = (id, title, st, extra) => Object.assign({ id, title, status: st, assignee_id: 'm1', stage_id: 's1',
    due_date: null, due_time: null, time_spent: 600, review_spent: 0, subtasks: [], attachments: [] }, extra || {});
  PROJECTS = [{ id: 'p1', name: 'TRIA SMART CORP', logo: 'T', logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0,
    stages: '1 / 3', status: 'active', mrr: 0, cost: 0, tg_chat_id: null, contacts: null, ui: null, kb: null,
    leads: ['m1'], lead_id: 'm1', _todaySec: 3720,
    _stages: [{ id: 's1', name: 'БРИФ', status: 'active' }],
    _tasks: [mk('t1', 'Ожидает', 'wait'), mk('t2', 'В работе 1', 'active'), mk('t3', 'В работе 2', 'active'),
             mk('t4', 'На проверке', 'review'), mk('t5', 'Готово', 'done')],
    _reports: [] }];
  localStorage.removeItem('triada_pkzen');
  PK_ZEN = false; PK_SET_OPEN = false;
  openProject(0); pdTab('kanban');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  /* цифры в полосе 850 мс накручиваются с нуля (animateCounters) — читаем после */
  await page.waitForTimeout(1200);

  console.log('\n[A] первый счётчик — сегодня');
  const strip = await page.evaluate(() => [...document.querySelectorAll('.pk-strip .pk-mx')].map(x => ({
    l: x.querySelector('.l').textContent, v: x.querySelector('.v').textContent, s: (x.querySelector('.s') || {}).textContent || '',
    html: x.querySelector('.v').outerHTML, dbg: (typeof PROJECTS!=='undefined'? PROJECTS[0]._todaySec : null) })));
  console.log('    ' + JSON.stringify(strip[0]));
  ok('заголовок «Сегодня»', strip[0].l === 'Сегодня', strip[0].l);
  ok('показано сегодняшнее время', strip[0].v === '1ч 02м', strip[0].v);
  ok('общее время не потеряно', /всего/.test(strip[0].s), strip[0].s);
  const live = await page.evaluate(() => {
    /* таймер, запущенный ВЧЕРА вечером: в «сегодня» должна попасть только часть
       после полуночи, а не все три часа до неё */
    const y = new Date(); y.setHours(0, 0, 0, 0);
    const start = new Date(y.getTime() - 3 * 3600e3).toISOString();
    PROJECTS[0]._tasks[1].timer_started = start;
    window._cntPause = 1; renderPd();
    const v = document.querySelector('.pk-strip .pk-mx .v').textContent;
    PROJECTS[0]._tasks[1].timer_started = null; renderPd(); window._cntPause = 0;
    const sinceMidnight = Math.round((Date.now() - y.getTime()) / 1000);
    const expect = 3720 + sinceMidnight;                 // журнал + сегодняшняя часть таймера
    const wrong = 3720 + sinceMidnight + 3 * 3600;       // если бы вчерашние часы посчитались
    const fmt = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return h > 0 ? (h + 'ч ' + String(m).padStart(2, '0') + 'м') : (m + ':' + String(s % 60).padStart(2, '0')); };
    return { v, expect: fmt(expect), wrong: fmt(wrong) };
  });
  console.log('    вчерашний таймер: ' + JSON.stringify(live));
  ok('в «сегодня» — только часть после полуночи', live.v === live.expect, live);
  ok('вчерашние часы не приплюсовались', live.v !== live.wrong, live);

  console.log('\n[B] кнопки режима');
  const mode = await page.evaluate(() => [...document.querySelectorAll('.pk-mode .pk-modebtn')].map(b => b.textContent.trim()));
  console.log('    ' + JSON.stringify(mode));
  ok('есть статистика, настройки доски и полный экран', mode.length === 3 && /Статистика/.test(mode[0]) && /Доска/.test(mode[1]) && /весь экран/.test(mode[2]), mode);
  const sizeN = await page.evaluate(() => {
    const r = el => Math.round(el.getBoundingClientRect().height);
    return { s: r(document.getElementById('pk-search')), d: [...document.querySelectorAll('.pk-filters .dd-btn')].map(r) };
  });
  console.log('    высоты (обычный режим): ' + JSON.stringify(sizeN));
  ok('поиск одной высоты с фильтрами', sizeN.d.every(h => h === sizeN.s), sizeN);

  console.log('\n[C] полный экран');
  await page.evaluate(() => pkZen(true));
  await page.waitForTimeout(200);
  const zen = await page.evaluate(() => {
    const m = document.querySelector('#ov-proj .modal');
    const cs = el => el ? getComputedStyle(el).display : null;
    return { cls: m.classList.contains('pk-zen'), body: document.body.classList.contains('pk-zen-on'),
      top: cs(document.querySelector('#ov-proj .pd-top')), tabs: cs(document.getElementById('pd-tabbar')),
      strip: !!document.querySelector('.pk-strip'), zenbar: !!document.querySelector('.pk-zenbar'),
      board: !!document.querySelector('.pk-board'), filters: !!document.querySelector('.pk-filters'),
      name: (document.querySelector('.pk-zen-id b') || {}).textContent,
      moderow: !!document.querySelector('.pk-moderow'), modebar: !!document.querySelector('.pk-mode'),
      collapse: [...document.querySelectorAll('#ov-proj .pk-modebtn')].some(b => /Свернуть|весь экран/.test(b.textContent)),
      saved: localStorage.getItem('triada_pkzen') };
  });
  console.log('    ' + JSON.stringify(zen));
  ok('шапка проекта и вкладки скрыты', zen.top === 'none' && zen.tabs === 'none', zen);
  ok('полоса метрик уступила место доске', !zen.strip && zen.zenbar, zen);
  ok('доска и фильтры на месте', zen.board && zen.filters, zen);
  ok('в шапке режима — имя проекта', /TRIA SMART CORP/.test(zen.name || ''), zen.name);
  ok('строки кнопок под фильтрами больше нет', !zen.moderow && !zen.modebar, zen);
  ok('«Свернуть» под фильтрами не осталась', !zen.collapse, zen);
  ok('режим запомнен', zen.saved === '1', zen.saved);
  const acts = await page.evaluate(() => {
    const bar = document.querySelector('.pk-zenbar'), set = document.getElementById('pk-setbtn'), x = document.querySelector('.pk-zen-x');
    if (!bar || !set || !x) return { set: !!set, x: !!x };
    const br = bar.getBoundingClientRect(), sr = set.getBoundingClientRect(), xr = x.getBoundingClientRect();
    return { set: true, x: true, inBar: bar.contains(set), leftOfX: sr.right <= xr.left + 1,
      sameRow: Math.abs(sr.top - xr.top) < 3, rightEdge: Math.round(br.right - xr.right),
      gap: Math.round(xr.left - sr.right), h: [Math.round(sr.height), Math.round(xr.height)] };
  });
  console.log('    шапка режима: ' + JSON.stringify(acts));
  ok('«Доска» переехала в шапку режима', acts.inBar === true, acts);
  ok('и стоит слева от выхода, в одной строке', acts.leftOfX && acts.sameRow, acts);
  ok('обе кнопки прижаты к правому краю', acts.rightEdge <= 2, acts);
  ok('и одинаковой высоты', acts.h[0] === acts.h[1], acts.h);
  const sizeZ = await page.evaluate(() => {
    const r = el => Math.round(el.getBoundingClientRect().height);
    return { s: r(document.getElementById('pk-search')), d: [...document.querySelectorAll('.pk-filters .dd-btn')].map(r) };
  });
  console.log('    высоты (полный экран): ' + JSON.stringify(sizeZ));
  ok('поиск одной высоты с фильтрами и в полном экране', sizeZ.d.every(h => h === sizeZ.s), sizeZ);
  const setZ = await page.evaluate(() => { document.getElementById('pk-setbtn').click();
    return !!document.querySelector('#ov-pd2 .modal.pksetm'); });
  ok('из шапки открываются настройки доски', setZ, setZ);
  await page.evaluate(() => pd2Close());
  await page.waitForTimeout(150);
  await page.screenshot({ path: '/tmp/work/shot_zen.png', clip: { x: 0, y: 0, width: 1600, height: 900 } });

  console.log('\n[C2] режим не выносится за пределы доски');
  const other = await page.evaluate(() => {
    pdTab('stages');
    const m = document.querySelector('#ov-proj .modal');
    const cs = el => el ? getComputedStyle(el).display : null;
    return { zenCls: m.classList.contains('pk-zen'), body: document.body.classList.contains('pk-zen-on'),
      top: cs(document.querySelector('#ov-proj .pd-top')), tabs: cs(document.getElementById('pd-tabbar')),
      remembered: PK_ZEN, saved: localStorage.getItem('triada_pkzen') };
  });
  console.log('    другая вкладка: ' + JSON.stringify(other));
  ok('на других вкладках шапка и вкладки на месте', other.top !== 'none' && other.tabs !== 'none', other);
  ok('и класс режима снят', !other.zenCls && !other.body, other);
  ok('но сам режим не забыт', other.remembered === true && other.saved === '1', other);
  const backTab = await page.evaluate(() => {
    pdTab('kanban');
    const m = document.querySelector('#ov-proj .modal');
    return { zenCls: m.classList.contains('pk-zen'), body: document.body.classList.contains('pk-zen-on'),
      zenbar: !!document.querySelector('.pk-zenbar') };
  });
  ok('на доске режим возвращается', backTab.zenCls && backTab.body && backTab.zenbar, backTab);
  const reopen = await page.evaluate(() => {
    closeProject();
    const afterClose = document.body.classList.contains('pk-zen-on');
    pdTabCur = 'stages'; openProject(0);
    const m = document.querySelector('#ov-proj .modal');
    const cs = el => el ? getComputedStyle(el).display : null;
    return { afterClose, zenCls: m.classList.contains('pk-zen'),
      top: cs(document.querySelector('#ov-proj .pd-top')), tabs: cs(document.getElementById('pd-tabbar')) };
  });
  await page.waitForTimeout(200);
  console.log('    переоткрытие: ' + JSON.stringify(reopen));
  ok('после закрытия проекта режим не держит страницу', reopen.afterClose === false, reopen);
  ok('проект открывается с шапкой, а не пустым экраном', !reopen.zenCls && reopen.top !== 'none' && reopen.tabs !== 'none', reopen);
  await page.evaluate(() => { pdTab('kanban'); });
  await page.waitForTimeout(250);

  console.log('\n[D] выход из режима');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => ({ cls: document.querySelector('#ov-proj .modal').classList.contains('pk-zen'),
    strip: !!document.querySelector('.pk-strip'), zenbar: !!document.querySelector('.pk-zenbar'), saved: localStorage.getItem('triada_pkzen') }));
  ok('Esc возвращает обычный вид', !back.cls && back.strip && !back.zenbar, back);
  ok('и это тоже запомнено', back.saved === '0', back.saved);
  await page.evaluate(() => { document.body.click(); });
  await page.keyboard.press('f');
  await page.waitForTimeout(200);
  ok('клавиша F включает полный экран', await page.evaluate(() => PK_ZEN === true));
  await page.evaluate(() => pkZen(false));
  await page.waitForTimeout(150);

  console.log('\n[E] настройки доски и WIP-лимиты');
  await page.evaluate(() => document.querySelector('#pk-setbtn').click());
  await page.waitForTimeout(220);
  const set0 = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.pksetm'); if (!m) return null;
    const el = document.getElementById('pk-setbody');
    return { modal: true, ttl: m.querySelector('.pksetm-ttl').textContent,
      togs: [...el.querySelectorAll('.pkset-tog b')].map(b => b.textContent),
      folded: !document.querySelector('.pkset-fold.on'),
      rows: el.querySelectorAll('.pkset-row').length };
  });
  console.log('    ' + JSON.stringify(set0));
  ok('настройки открылись отдельным окном', !!set0 && /Настройки доски/.test(set0.ttl), set0);
  ok('лимиты выключены — блок свёрнут', set0.folded && /WIP-лимиты/.test(set0.togs[0]), set0);
  await page.evaluate(() => pkWipToggle());
  await page.waitForTimeout(350);
  const set1 = await page.evaluate(() => {
    const el = document.getElementById('pk-setbody');
    return { rows: [...el.querySelectorAll('.pkset-row')].map(r => ({ l: r.querySelector('.pkset-l').textContent,
        v: r.querySelector('input').value, now: r.querySelector('.pkset-now').textContent })),
      cfg: PROJECTS[0].kb, open: !!document.querySelector('#ov-pd2 .modal.pksetm'),
      folded: !document.querySelector('.pkset-fold.on') };
  });
  console.log('    ' + JSON.stringify(set1));
  ok('окно не закрылось от переключения', set1.open, set1);
  ok('блок лимитов раскрылся', !set1.folded, set1);
  ok('три колонки с лимитами', set1.rows.length === 3, set1.rows);
  ok('«Готово» лимитом не ограничиваем', !set1.rows.some(r => /Готово/.test(r.l)), set1.rows.map(r => r.l));
  ok('лимит сохранён в проект', set1.cfg && set1.cfg.wip && set1.cfg.wip.on === true, set1.cfg);
  ok('видно текущую занятость', /сейчас 2 из 3/.test(set1.rows[1].now), set1.rows[1]);

  await page.evaluate(() => { pd2Close(); pkZen(true); });
  await page.waitForTimeout(250);
  const geo = await page.evaluate(() => {
    const f = document.querySelector('.pk-filters'), bd = document.querySelector('.pk-board');
    const fr = f.getBoundingClientRect(), br = bd.getBoundingClientRect();
    const kids = [...f.children].map(c => Math.round(c.getBoundingClientRect().y));
    return { rows: new Set(kids).size, boardBelow: br.top >= fr.bottom - 1, gap: Math.round(br.top - fr.bottom),
      moderow: !!document.querySelector('.pk-moderow'), h: Math.round(fr.height),
      boardTop: Math.round(br.top), vh: window.innerHeight };
  });
  console.log('    геометрия панели: ' + JSON.stringify(geo));
  ok('фильтры в один ряд', geo.rows === 1, geo);
  ok('доска идёт сразу за фильтрами', geo.boardBelow && !geo.moderow && geo.gap <= 24, geo);
  ok('доске досталась почти вся высота', (geo.vh - geo.boardTop) / geo.vh > 0.86, geo);
  const geoN = await page.evaluate(() => { pkZen(false);
    const mr = document.querySelector('.pk-moderow'), f = document.querySelector('.pk-filters');
    if (!mr) return { moderow: false };
    const fr = f.getBoundingClientRect(), mb = mr.getBoundingClientRect();
    return { moderow: true, below: mb.top >= fr.bottom - 1, left: Math.abs(mb.left - fr.left) < 2,
      btns: [...mr.querySelectorAll('.pk-modebtn')].map(b => b.textContent.trim()) };
  });
  console.log('    обычный режим: ' + JSON.stringify(geoN));
  ok('в обычном режиме кнопки на месте — под фильтрами слева', geoN.moderow && geoN.below && geoN.left, geoN);
  ok('и это «Статистика», «Доска» и вход в полный экран', geoN.btns.length === 3 && /Статистика/.test(geoN.btns[0]) && /весь экран/.test(geoN.btns[2]), geoN.btns);
  await page.evaluate(() => pkZen(true));
  await page.waitForTimeout(200);

  console.log('\n[F] счётчик колонки и превышение');
  const ct0 = await page.evaluate(() => [...document.querySelectorAll('.pk-col')].map(c => ({
    st: c.dataset.st, ct: c.querySelector('.ct').textContent, over: c.classList.contains('wip-over'),
    cls: c.querySelector('.ct').className })));
  console.log('    ' + JSON.stringify(ct0));
  ok('в колонке видно «занято / лимит»', ct0.find(c => c.st === 'active').ct === '2/3', ct0);
  ok('превышения пока нет', !ct0.some(c => c.over), ct0);
  await page.evaluate(() => pkWipSet('active', 2));
  await page.waitForTimeout(200);
  const ct1 = await page.evaluate(() => { const c = [...document.querySelectorAll('.pk-col')].find(x => x.dataset.st === 'active');
    return { ct: c.querySelector('.ct').textContent, cls: c.querySelector('.ct').className, over: c.classList.contains('wip-over') }; });
  ok('колонка заполнена — предупреждающий цвет', /full/.test(ct1.cls) && ct1.ct === '2/2', ct1);

  console.log('\n[G] мягкий и жёсткий лимит');
  const soft = await page.evaluate(async () => { window.__moved = []; window.__toast = '';
    await pkAdvance('t1', 'wait'); return { moved: window.__moved.length, toast: window.__toast }; });
  console.log('    мягкий: ' + JSON.stringify(soft));
  ok('мягкий лимит предупреждает, но пускает', soft.moved === 1 && /Сверх лимита/.test(soft.toast), soft);
  const hard = await page.evaluate(async () => {
    PROJECTS[0]._tasks[0].status = 'wait'; renderPd();
    pkWipHard(); window.__moved = []; window.__toast = '';
    await pkAdvance('t1', 'wait');
    return { moved: window.__moved.length, toast: window.__toast, hard: PROJECTS[0].kb.wip.hard };
  });
  console.log('    жёсткий: ' + JSON.stringify(hard));
  ok('жёсткий лимит не пускает', hard.moved === 0 && hard.hard === true, hard);
  ok('и объясняет, что делать', /Сначала закройте или передвиньте/.test(hard.toast), hard.toast);
  const dropTest = await page.evaluate(() => { window.__moved = []; window.__toast = '';
    _pkDrag = 't1'; pkDrop({ preventDefault() {}, target: { closest: () => null } }, 'active');
    return { moved: window.__moved.length, toast: window.__toast }; });
  ok('перетаскивание подчиняется тому же лимиту', dropTest.moved === 0 && /Лимит колонки/.test(dropTest.toast), dropTest);
  const doneOk = await page.evaluate(async () => { window.__moved = [];
    PROJECTS[0]._tasks[3].status = 'review'; await pkAdvance('t4', 'review'); return window.__moved; });
  ok('в «Готово» пускает всегда', doneOk.length === 1 && doneOk[0].st === 'done', doneOk);

  console.log('\n[H] плотные карточки');
  await page.evaluate(() => pkDense());
  await page.waitForTimeout(200);
  const dense = await page.evaluate(() => ({ cls: !!document.querySelector('.pk-board.dense'), cfg: PROJECTS[0].kb.dense,
    pad: getComputedStyle(document.querySelector('.pk-card')).paddingTop }));
  ok('режим плотных карточек включился', dense.cls && dense.cfg === true, dense);
  ok('карточки действительно компактнее', parseFloat(dense.pad) <= 11, dense.pad);

  console.log('\n[I] лимит считается по всем задачам, а не по видимым');
  await page.evaluate(() => pkSearch('нетакойзадачи'));
  await page.waitForTimeout(450);
  const filt = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.pk-col')].find(x => x.dataset.st === 'active');
    return { ct: c.querySelector('.ct').textContent, cards: c.querySelectorAll('.pk-card').length };
  });
  await page.evaluate(() => pkSearch(''));
  console.log('    ' + JSON.stringify(filt));
  ok('фильтр не обнуляет лимит', filt.ct === '2/2' && filt.cards === 0, filt);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[J] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
