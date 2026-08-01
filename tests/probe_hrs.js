/* probe_hrs — журнал отработанных часов: строки «на что · сколько · когда»,
   сумма попадает в finance.hours, ручные часы складываются с таймером задач
   и всюду показываются одной цифрой. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* Контрольный пример считаем на бумаге:
   таймер   t1 90 мин, t2 60 мин                             → 150 мин = 2 ч 30 м
   проверка t1 10 мин — показываем, но в часы проекта не кладём (так же
            считают финансы, иначе две цифры разошлись бы)
   вручную  6 + 1,5 + 2 + 3                                  → 12,5 ч = 12 ч 30 м
   всего                                                     → 15 ч 00 м            */
const HLOG = [
  { id: 'h1', label: 'Съёмка', h: 6, date: '2026-07-28', note: 'смена на объекте' },
  { id: 'h2', label: 'Проезд', h: 1.5, date: '2026-07-28', note: '' },
  { id: 'h3', label: 'Переговоры', h: 2, date: '2026-07-30', note: 'встреча с шефом' },
  { id: 'h4', label: 'Кастинг', h: 3, date: '2026-07-25', note: '' },
];

const setup = (D) => {
  window.__t = ''; window.toast = t => { window.__t = String(t); };
  window.LIVE = false; window.__upd = [];
  window.SB = { from(t) { return {
    update(patch) { return { eq() { window.__upd.push({ t, patch }); return Promise.resolve({ error: null }); } }; },
    select() { return { eq() { return { order: () => Promise.resolve({ data: [], error: null }) }; } }; },
    delete() { return { eq: () => Promise.resolve({ error: null }) }; },
    insert() { return Promise.resolve({ error: null }); } }; } };
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe();
  window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agIsPM = () => true;
  window.giEnsureStatus = async () => ({ status: 'inactive' });
  window.tLoadProjectWork = null; window.tLoadProjectToday = null;
  TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null }];
  PROJECTS = [{ id: 'p1', name: 'Qushbegi Milliy Taomlar', logo: 'Q', logoUrl: null, status: 'active', mrr: 6600000, cost: 700000,
    _stages: [], _appr: [], _reports: [],
    _tasks: [{ id: 't1', title: 'Сценарии Reels', status: 'done', assignee_id: 'm1', time_spent: 5400, review_spent: 600, subtasks: [], attachments: [] },
             { id: 't2', title: 'Монтаж', status: 'active', assignee_id: 'm1', time_spent: 3600, subtasks: [], attachments: [] }],
    finance: { salaries: [{ name: 'Проект-менеджер', unit: 'month', rate: 700000, amount: 700000, manual: false }], opex: [], projex: [],
      hlog: D.HLOG, hours: 12.5 } }];
  window.PROJECTS = PROJECTS;
  FINANCE = { ready: true, projects: [{ id: 'p1', name: 'Qushbegi Milliy Taomlar', logo: 'Q', logoUrl: null, mrr: 6600000,
    finance: PROJECTS[0].finance, _svcs: null }] };
  window.FINANCE = FINANCE;
  openProject(0);
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup, { HLOG });
  await page.waitForTimeout(400);

  console.log('\n[A] арифметика журнала');
  const m = await page.evaluate(() => ({
    sum: pfHSum(PROJECTS[0].finance.hlog),
    kinds: pfHByKind(PROJECTS[0].finance.hlog).map(k => k.label + ':' + k.h),
    fmt: [pfHFmt(6), pfHFmt(1.5), pfHFmt(0.25), pfHFmt(0)],
    comma: pfHSum([{ h: '1,5' }, { h: '2.25' }]),
    junk: pfHSum([{ h: 'абв' }, { h: -4 }, { h: null }, { h: 3 }]),
    manualSec: pkProjManual(PROJECTS[0]), trkSec: pkProjTotal(), spent: pkProjSpent(PROJECTS[0]),
  }));
  ok('сумма журнала — 12,5 ч', m.sum === 12.5, m.sum);
  ok('одинаковые виды работ складываются и идут по убыванию',
    m.kinds.join(' ') === 'Съёмка:6 Кастинг:3 Переговоры:2 Проезд:1.5', m.kinds);
  ok('часы читаются по-человечески', m.fmt.join(' | ') === '6 ч | 1 ч 30 мин | 15 мин | 0 ч', m.fmt);
  ok('запятая в вводе — то же, что точка', m.comma === 3.75, m.comma);
  ok('мусор и отрицательные часы не портят сумму', m.junk === 3, m.junk);
  ok('ручные часы в секундах — 12,5 × 3600', m.manualSec === 45000, m.manualSec);
  ok('таймер задач — 2 ч 40 м', m.trkSec === 9000, m.trkSec);
  ok('потрачено всего = таймер + журнал', m.spent === 54000, m.spent);

  console.log('\n[B] кнопка в шапке проекта показывает общее время и ведёт в разбор');
  const btn = await page.evaluate(() => {
    const el = document.getElementById('pd-hdr-time');
    return { tag: el && el.tagName, on: el && el.getAttribute('onclick'),
      txt: (document.getElementById('pk-total') || {}).textContent };
  });
  ok('виджет времени — кнопка', btn.tag === 'BUTTON', btn);
  ok('по клику открывается разбор', /pdTimeOpen\(\)/.test(btn.on || ''), btn.on);
  ok('в шапке стоит общая цифра 15ч 00м', btn.txt === '15ч 00м', btn.txt);

  console.log('\n[C] модалка «Потраченное время»');
  await page.evaluate(() => pdTimeOpen());
  await page.waitForTimeout(350);
  const md = await page.evaluate(() => ({
    tiles: [...document.querySelectorAll('.pdt-tile-v')].map(e => e.textContent),
    kinds: [...document.querySelectorAll('.pdt-kind')].map(e => e.querySelector('.pdt-kind-nm').textContent),
    barTop: document.querySelector('.pdt-kind-bar > i').style.width,
    shares: [...document.querySelectorAll('.pdt-kind-v em')].map(e => e.textContent),
    log: [...document.querySelectorAll('.pdt-tbl:not(.pdt-tbl-tasks) .pdt-tr:not(.pdt-th)')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    tasks: [...document.querySelectorAll('.pdt-tbl-tasks .pdt-tr:not(.pdt-th)')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    addBtn: !!document.querySelector('.pdt-modal .pf-cat-btn'),
    tileSub: (document.querySelector('.pdt-tile-s') || {}).textContent,
    focus: document.activeElement ? (document.activeElement.tagName + '.' + (document.activeElement.className || '')) : null,
  }));
  ok('три плитки: таймер, вручную, всего', md.tiles.join(' | ') === '2ч 30м | 12ч 30м | 15ч 00м', md.tiles);
  ok('плитка таймера совпадает с цифрой в шапке проекта', md.tiles[2] === btn.txt, [md.tiles[2], btn.txt]);
  ok('время проверки показано, но в итог не подмешано', /проверка 10:00 сверх/.test(md.tileSub || ''), md.tileSub);
  ok('разбивка «на что ушло» по видам работ', md.kinds.join(',') === 'Съёмка,Кастинг,Переговоры,Проезд', md.kinds);
  ok('полоса — доля от всех ручных часов: 6 из 12,5 это 48%', md.barTop === '48%', md.barTop);
  ok('доля подписана числом', md.shares.join(' ') === '48% 24% 16% 12%', md.shares);
  ok('все ручные записи на месте', md.log.length === 4, md.log);
  ok('записи отсортированы по дате, свежие сверху', /Переговоры/.test(md.log[0]) && /Кастинг/.test(md.log[3]), md.log);
  ok('в записи видно дату и комментарий', /30 июл 2026/.test(md.log[0]) && /встреча с шефом/.test(md.log[0]), md.log[0]);
  ok('задачи с временем перечислены', md.tasks.length === 2 && /Сценарии Reels/.test(md.tasks[0]), md.tasks);
  ok('время проверки показано отдельно', /проверка/.test(md.tasks[0]), md.tasks[0]);
  ok('из разбора можно уйти добавлять часы', md.addBtn, md.addBtn);
  ok('окно открывается без подсвеченной кнопки', !/BUTTON/.test(md.focus || ''), md.focus);

  console.log('\n[D] редактор журнала в «Финансах проекта»');
  await page.evaluate(() => { pd2Close(); openProjFinance('p1'); });
  await page.waitForTimeout(350);
  const ed = await page.evaluate(() => ({
    rows: document.querySelectorAll('.pf-row-h').length,
    sum: (document.getElementById('pfsecsum-hlog') || {}).textContent,
    dates: [...document.querySelectorAll('.pf-h-date .dp-val')].map(e => e.textContent),
    other: document.querySelectorAll('.pf-h-other').length,
    notes: [...document.querySelectorAll('.pf-h-note input')].map(e => e.value),
    presets: window.PF_HKINDS,
  }));
  ok('строк столько же, сколько записей', ed.rows === 4, ed.rows);
  ok('итог секции — сумма часов', ed.sum === '12 ч 30 мин', ed.sum);
  ok('дата в человеческом формате, а не американском', ed.dates[0] === '28.07.2026', ed.dates);
  ok('своё название получает отдельное поле', ed.other === 1, ed.other);
  ok('комментарии подхватились', ed.notes.filter(Boolean).length === 2, ed.notes);
  ok('в пресетах есть съёмка, переговоры и проезд',
    ['Съёмка', 'Переговоры', 'Проезд'].every(k => ed.presets.indexOf(k) >= 0), ed.presets);

  const add = await page.evaluate(() => {
    pfHAdd();
    const n = PFIN.hlog.length;
    pfHSetH(n - 1, '2,5'); pfHPick(n - 1, '__other__'); pfHSetLabel(n - 1, 'Кастинг');
    return { n, last: PFIN.hlog[n - 1], hours: PFIN.hours, sum: (document.getElementById('pfsecsum-hlog') || {}).textContent,
      dateFilled: !!PFIN.hlog[n - 1].date };
  });
  ok('новая строка добавляется', add.n === 5, add.n);
  ok('дата новой строки — сегодня, а не пусто', add.dateFilled, add.last);
  ok('часы принимают запятую', add.last.h === 2.5, add.last);
  ok('«Другое» открывает своё название и не попадает в данные', add.last.label === 'Кастинг', add.last);
  ok('итог секции пересчитался на лету', add.sum === '15 ч', add.sum);

  const del = await page.evaluate(() => { pfHDel(0); return { n: PFIN.hlog.length, hours: PFIN.hours }; });
  ok('строка удаляется и сумма пересчитывается', del.n === 4 && del.hours === 9, del);

  console.log('\n[E] сохранение и синхронизация');
  const saved = await page.evaluate(async () => {
    window.LIVE = true;
    await saveProjFinance();
    const patch = (window.__upd.find(u => u.t === 'projects') || {}).patch || {};
    return { patch: patch.finance, toast: window.__t };
  });
  ok('журнал ушёл в базу', Array.isArray(saved.patch && saved.patch.hlog) && saved.patch.hlog.length === 4, saved.patch);
  ok('finance.hours = сумма журнала', saved.patch && saved.patch.hours === 9, saved.patch && saved.patch.hours);
  ok('пустые строки не сохраняются', (saved.patch.hlog || []).every(r => r.h > 0 || r.label), saved.patch.hlog);
  ok('строка без названия получает подпись, а не пустоту', (saved.patch.hlog || []).every(r => !!r.label), saved.patch.hlog);

  console.log('\n[F] старое одно число не теряется');
  const legacy = await page.evaluate(() => {
    window.LIVE = false;
    FINANCE = { ready: true, projects: [{ id: 'p1', name: 'Q', logo: 'Q', logoUrl: null, mrr: 6600000, _svcs: null,
      finance: { salaries: [], opex: [], projex: [], hours: 7 } }] };
    window.FINANCE = FINANCE;
    openProjFinance('p1');
    return { n: PFIN.hlog.length, first: PFIN.hlog[0], hours: PFIN.hours };
  });
  ok('число часов становится строкой журнала', legacy.n === 1 && legacy.first.h === 7, legacy);
  ok('сумма не изменилась', legacy.hours === 7, legacy.hours);

  console.log('\n[G] часы проекта в финансах = таймер + журнал');
  const agg = await page.evaluate(() => {
    /* та же формула, что в tLoadFinance: сумма секунд таймера плюс ручные часы */
    const tsec = 9000, f = { hours: 12.5 };
    return { hours: tsec / 3600 + (Number(f.hours) || 0) };
  });
  ok('2,5 ч таймера + 12,5 ч журнала = 15 ч', agg.hours === 15, agg.hours);

  console.log('\n[H] разбор времени: данные не слипаются, окно прокручивается');
  /* Экран пользователя: 1300×845. Записей больше, чем влезает, — как в жизни. */
  await page.setViewportSize({ width: 1300, height: 845 });
  const LONG = []; const KIND = ['Съёмка', 'Проезд', 'Переговоры', 'Кастинг', 'Монтаж'];
  for (let i = 0; i < 9; i++) LONG.push({ id: 'L' + i, label: KIND[i % 5], h: 1 + (i % 4), date: '2026-07-' + (10 + i), note: i % 2 ? 'комментарий ' + i : '' });
  await page.evaluate(setup, { HLOG: LONG });
  await page.evaluate(() => {
    PROJECTS[0]._tasks = Array.from({ length: 6 }, (_, i) => ({ id: 'x' + i, title: 'Задача номер ' + (i + 1),
      status: ['done', 'active', 'review'][i % 3], assignee_id: 'm1', time_spent: 1800 * (i + 1),
      review_spent: i % 3 === 2 ? 600 : 0, subtasks: [], attachments: [] }));
    pd2Close(); openProject(0); pdTimeOpen();
  });
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => {
    const mb = document.querySelector('.pdt-modal .modal-b');
    const rows = [...document.querySelectorAll('.pdt-tbl:not(.pdt-tbl-tasks) .pdt-tr:not(.pdt-th)')];
    return { scrolls: mb.scrollHeight - mb.clientHeight > 2, bodyH: mb.clientHeight, bodyS: mb.scrollHeight,
      squashed: [...mb.children].filter(c => c.scrollHeight - c.clientHeight > 2).map(c => String(c.className).slice(0, 24)),
      rows: rows.length, minRow: Math.min.apply(null, rows.map(r => Math.round(r.getBoundingClientRect().height))),
      overlap: rows.slice(1).filter((r, i) => r.getBoundingClientRect().top < rows[i].getBoundingClientRect().bottom - 1).length,
      ring: getComputedStyle(mb).outlineStyle };
  });
  ok('окно прокручивается, когда записей больше, чем влезает', fit.scrolls, fit);
  ok('ни один блок не сдавлен — данные видно целиком', fit.squashed.length === 0, fit.squashed);
  ok('все девять записей на месте', fit.rows === 9, fit.rows);
  ok('строка не схлопывается в полоску', fit.minRow >= 36, fit.minRow);
  ok('строки не налезают друг на друга', fit.overlap === 0, fit.overlap);
  ok('тело окна не обведено рамкой фокуса', fit.ring === 'none', fit.ring);

  const stick = await page.evaluate(() => {
    const mb = document.querySelector('.pdt-modal .modal-b');
    mb.scrollTop = 560;
    const th = document.querySelector('.pdt-tbl:not(.pdt-tbl-tasks) .pdt-th');
    const tb = document.querySelector('.pdt-tbl:not(.pdt-tbl-tasks)');
    return { pos: getComputedStyle(th).position, gap: Math.round(th.getBoundingClientRect().top - mb.getBoundingClientRect().top),
      scrolledPast: tb.getBoundingClientRect().top < mb.getBoundingClientRect().top,
      head: th.textContent.replace(/\s+/g, ' ').trim() };
  });
  ok('шапка таблицы прилипает к верху при прокрутке', stick.pos === 'sticky' && stick.scrolledPast, stick);
  ok('и стоит вплотную — в щель не подглядывает уехавшая строка', Math.abs(stick.gap) <= 1, stick.gap);
  ok('видно, что за колонки перед глазами', /ВИД РАБОТ|Вид работ/i.test(stick.head), stick.head);

  console.log('\n[I] на телефоне окно поверх карточки проекта, а не под ней');
  await page.setViewportSize({ width: 390, height: 780 });
  await page.evaluate(() => { pd2Close(); pdTimeOpen(); });
  await page.waitForTimeout(400);
  const mob = await page.evaluate(() => {
    const m = document.querySelector('.pdt-modal');
    const mb = m.querySelector('.modal-b');
    const zi = el => Number(getComputedStyle(el).zIndex) || 0;
    const at = document.elementFromPoint(195, 420);
    return { over: zi(document.getElementById('ov-pd2')) > zi(document.getElementById('ov-proj')),
      hit: !!(at && m.contains(at)), inner: mb.scrollHeight - mb.clientHeight > 2,
      btnRow: (function(){ const b = m.querySelector('.pf-cat-btn'), h = m.querySelector('.modal-h h3');
        return b && h ? Math.round(b.getBoundingClientRect().top - h.getBoundingClientRect().bottom) : null; })(),
      titleLines: (function(){ const h = m.querySelector('.modal-h h3');
        return h ? Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).fontSize) / 1.25) : null; })() };
  });
  ok('шторка лежит поверх карточки проекта', mob.over, mob);
  ok('и принимает нажатия, а не проваливает их вниз', mob.hit, mob);
  ok('внутри шторки нет второго скролла — тянется вся целиком', !mob.inner, mob);
  ok('заголовок помещается в одну строку', mob.titleLines === 1, mob.titleLines);
  ok('кнопка «Добавить часы» ушла на свою строку', mob.btnRow !== null && mob.btnRow > 0, mob.btnRow);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
