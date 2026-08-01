/* probe_wlx — вкладка «Нагрузка»: счётчики в один ряд, клик открывает список задач */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.toast = (t) => { window.__toast = t; };
  PROJECTS = [
    { id: 'p1', name: 'Artel', status: 'active' },
    { id: 'p2', name: 'Qushbegi', status: 'active' },
  ];
  /* у первого — настоящее фото: именно на нём ловится «фото на весь экран» */
  const PIC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  TEAM = [
    { _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: PIC, _wait: 1, _active: 2, _review: 1, _done: 4, _taskStat: [] },
    { _id: 'm2', name: 'Шахзод Курбонов', color: '#8A8FFF', avatar: null, _wait: 1, _active: 0, _review: 1, _done: 0, _taskStat: [] },
  ];
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  window._teamRaw = { tasks: [
    { id: 't1', title: 'Смонтировать ролик', status: 'review', assignee_id: 'm1', project_id: 'p1', due_date: day(-2) },
    { id: 't2', title: 'Снять три рилса',   status: 'review', assignee_id: 'm2', project_id: 'p2', due_date: day(0) },
    { id: 't3', title: 'Собрать отчёт',     status: 'wait',   assignee_id: 'm1', project_id: 'p1', due_date: day(3) },
    { id: 't4', title: 'Без исполнителя',   status: 'wait',   assignee_id: null, project_id: 'p2', due_date: null },
    { id: 't5', title: 'Правки макета',     status: 'active', assignee_id: 'm1', project_id: 'p1', due_date: day(10) },
    { id: 't6', title: 'Съёмка интервью',   status: 'active', assignee_id: 'm1', project_id: 'p2', due_date: null },
  ] };
  window._timeLogs = [];
  window.tLoadTeam = async () => {};   /* боевой загрузчик не должен затирать стенд */
  teamTab = 'workload';
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  const dbg = await page.evaluate(() => {
    const before = TEAM.map(m => [m._wait, m._active, m._review, m._done].join('/'));
    renderTeam();
    const after = TEAM.map(m => [m._wait, m._active, m._review, m._done].join('/'));
    /* модуль живёт в скрытом контейнере (мы не залогинены) — выносим на экран,
       чтобы мерить геометрию и кликать по-настоящему */
    const c = document.getElementById('content-ag');
    if (c) { document.body.appendChild(c);
      c.style.cssText = 'position:fixed;left:0;top:0;width:1560px;height:940px;overflow:auto;background:#0a0d0c;z-index:1;display:block;padding:20px'; }
    return { before, after, hasSum: !!document.querySelector('#content-ag .wlx-sum') };
  });
  console.log('    TEAM до/после renderTeam: ' + JSON.stringify(dbg));
  /* числа в счётчиках «накручиваются» с нуля (animateCounters) — читать их
     раньше бессмысленно: увидим промежуточный кадр. Ждём не по секундомеру
     (под нагрузкой всей сборки 1100 мс не хватало, и доли ловились как
     33/33/33 вместо 34/33/33), а пока картинка не перестанет меняться. */
  await page.waitForFunction(() => {
    const txt = [...document.querySelectorAll('#content-ag .wlx-sum .wlx-s')].map(s => s.textContent).join('|');
    const prev = window.__wlxPrev; window.__wlxPrev = txt;
    if (prev !== txt) { window.__wlxSame = 0; return false; }
    window.__wlxSame = (window.__wlxSame || 0) + 1;
    return window.__wlxSame >= 2;
  }, { timeout: 8000, polling: 150 });

  console.log('\n[A] полоса счётчиков');
  const sum = await page.evaluate(() => {
    const s = document.querySelector('#content-ag .wlx-sum');
    if (!s) return null;
    const kids = [...s.children].map(c => { const b = c.getBoundingClientRect();
      return { tag: c.tagName, cls: c.className, y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), txt: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 34) }; });
    return { cols: getComputedStyle(s).gridTemplateColumns, kids, h: Math.round(s.getBoundingClientRect().height) };
  });
  console.log('    ' + JSON.stringify(sum.kids.map(k => k.txt)));
  ok('пять плиток', sum.kids.length === 5, sum.kids.length);
  ok('все в одну строку', new Set(sum.kids.map(k => k.y)).size === 1, sum.kids.map(k => k.y));
  ok('пустой полосы снизу нет (одна строка)', sum.h <= 130, sum.h);
  ok('плитки заполняют колонки, а не схлопнуты', sum.kids.every(k => k.w >= 200), sum.kids.map(k => k.w));
  ok('высоты плиток равны', new Set(sum.kids.map(k => k.h)).size === 1, sum.kids.map(k => k.h));
  ok('ширины плиток равны', new Set(sum.kids.map(k => k.w)).size === 1, sum.kids.map(k => k.w));
  ok('четыре первых — кнопки', sum.kids.slice(0, 4).every(k => k.tag === 'BUTTON' && /wlx-act/.test(k.cls)), sum.kids.map(k => k.tag));
  ok('плитка времени не кликабельна', sum.kids[4].tag === 'DIV' && !/wlx-act/.test(sum.kids[4].cls), sum.kids[4]);

  /* W=2, I=2, R=2 при D=4: живых задач 6 → по 33,3% на статус.
     Со старой базой (10 задач) вышло бы по 20%. */
  const shares = await page.evaluate(() => [...document.querySelectorAll('#content-ag .wlx-sum .wlx-s')].map(s => {
    const sm = s.querySelector('.v small');
    return { lbl: s.querySelector('.l').textContent.trim(), pct: sm ? sm.textContent.trim() : null };
  }));
  console.log('    ' + JSON.stringify(shares));
  const nums = shares.slice(0, 3).map(s => parseInt(s.pct, 10));
  ok('проценты считаются без завершённых', nums.every(n => n >= 33 && n <= 34), shares);
  ok('три доли дают ровно 100%', nums.reduce((a, b) => a + b, 0) === 100, nums);
  ok('у «Завершено» процента нет', shares[3].pct === null, shares[3]);
  ok('подсказка объясняет базу', /% текущей нагрузки/.test(await page.evaluate(() => document.querySelector('#content-ag .wlx-sum .wlx-act').getAttribute('title'))), await page.evaluate(() => document.querySelector('#content-ag .wlx-sum .wlx-act').getAttribute('title')));
  await page.screenshot({ path: '/tmp/work/shot_wlx_sum.png', clip: await page.evaluate(() => { const b = document.querySelector('#content-ag .wlx-sum').getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height + 4 }; }) });

  console.log('\n[B] клик по «На утверждении»');
  await page.click('#content-ag .wlx-sum .wlx-s.wlx-act:nth-child(3)');
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    const md = document.querySelector('#ov-pd2 .modal.wlxq');
    if (!md) return null;
    const cards = [...md.querySelectorAll('.wlxq-card')].map(c => ({
      proj: c.querySelector('.wlxq-proj').textContent,
      task: c.querySelector('.wlxq-t').textContent,
      who: c.querySelector('.wlxq-who span:not(.wlxq-av)').textContent,
      due: c.querySelector('.wlxq-due').textContent,
      dueCls: c.querySelector('.wlxq-due').className,
      onclick: c.getAttribute('onclick'),
    }));
    return { title: md.querySelector('.wlxq-ttl').textContent, cards };
  });
  console.log('    ' + JSON.stringify(m, null, 1).slice(0, 600));
  ok('модалка открылась', !!m);
  ok('заголовок со счётчиком', /На утверждении · 2 задачи/.test(m.title), m.title);
  ok('две карточки', m.cards.length === 2, m.cards.length);
  ok('есть проект, задача, исполнитель, срок', m.cards.every(c => c.proj && c.task && c.who && c.due), m.cards);
  ok('просроченная — первой и помечена', /просрочен/.test(m.cards[0].due) && /over/.test(m.cards[0].dueCls), m.cards[0]);
  ok('сегодняшняя помечена как срочная', /сегодня/.test(m.cards[1].due) && /soon/.test(m.cards[1].dueCls), m.cards[1]);
  ok('карточка ведёт в задачу', /wlxGoTask\('p1','t1'\)/.test(m.cards[0].onclick), m.cards[0].onclick);

  /* Главный дефект: фото сотрудника лежит в аватарке абсолютом, и без
     position:relative у рамки оно растягивалось на весь оверлей. */
  const av = await page.evaluate(() => {
    const im = document.querySelector('#ov-pd2 .wlxq-av img');
    if (!im) return { none: true };
    const b = im.getBoundingClientRect(), box = im.parentElement.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), boxW: Math.round(box.width),
      pos: getComputedStyle(im.parentElement).position,
      inside: b.left >= box.left - 1 && b.right <= box.right + 1 && b.top >= box.top - 1 && b.bottom <= box.bottom + 1,
      vw: window.innerWidth, vh: window.innerHeight };
  });
  console.log('    ' + JSON.stringify(av));
  ok('фото аватарки отрисовано', !av.none, av);
  ok('у рамки аватарки своя точка отсчёта', av.pos === 'relative', av.pos);
  ok('фото размером с аватарку, а не с экран', av.w <= 24 && av.h <= 24, av);
  ok('фото не вылезает за рамку', av.inside, av);
  const covered = await page.evaluate(() => {
    /* что реально под курсором в середине экрана — окно, а не разлившееся фото */
    const el = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
    return el ? (el.tagName + '.' + String(el.className || '').split(' ')[0]) : null;
  });
  ok('центр экрана занят окном, а не фото', !/^IMG/.test(covered || ''), covered);
  await page.screenshot({ path: '/tmp/work/shot_wlx_modal.png', clip: await page.evaluate(() => { const b = document.querySelector('#ov-pd2 .modal.wlxq').getBoundingClientRect(); return { x: b.x, y: Math.max(0, b.y), width: b.width, height: Math.min(b.height, 700) }; }) });

  console.log('\n[C] «В ожидании» — задача без исполнителя и без срока');
  await page.evaluate(() => pd2Close());
  await page.click('#content-ag .wlx-sum .wlx-s.wlx-act:nth-child(1)');
  await page.waitForTimeout(180);
  const w = await page.evaluate(() => [...document.querySelectorAll('#ov-pd2 .wlxq-card')].map(c => ({
    who: c.querySelector('.wlxq-who span:not(.wlxq-av)').textContent, due: c.querySelector('.wlxq-due').textContent })));
  console.log('    ' + JSON.stringify(w));
  ok('две задачи в ожидании', w.length === 2, w.length);
  ok('без исполнителя подписано честно', w.some(x => /Не назначен/.test(x.who)), w);
  ok('без срока подписано честно', w.some(x => /без срока/.test(x.due)), w);

  console.log('\n[D] переход по карточке — на доску с подсветкой, а не в настройки задачи');
  await page.evaluate(() => {
    window.__opened = null; window.openProject = (i) => { window.__opened = i; };
    window.pdTab = () => {}; window.__edit = null; window.pdTaskEdit = (id) => { window.__edit = id; };
    /* карточка задачи на доске — её и должен найти переход */
    const b = document.createElement('div'); b.id = 'fake-board';
    b.style.cssText = 'position:fixed;left:0;bottom:0;z-index:0';
    b.innerHTML = '<div class="pk-card" data-tkid="t3">Собрать отчёт</div>';
    document.body.appendChild(b);
  });
  await page.click('#ov-pd2 .wlxq-card');
  await page.waitForTimeout(400);
  const nav = await page.evaluate(() => ({
    opened: window.__opened, modalClosed: !document.querySelector('#ov-pd2 .modal.wlxq'),
    edit: window.__edit, hl: document.querySelector('#fake-board .pk-card').classList.contains('dl-hl'),
    pend: window._dlPending ? { tab: window._dlPending.tab, sel: window._dlPending.sel } : null,
    toast: window.__toast,
  }));
  console.log('    ' + JSON.stringify(nav));
  ok('открылся проект по индексу', nav.opened === 0 || nav.opened === 1, nav);
  ok('модалка закрылась', nav.modalClosed, nav);
  ok('настройки задачи не открывались', nav.edit === null, nav);
  ok('ведём на доску проекта', nav.pend && nav.pend.tab === 'kanban' && /data-tkid="t3"/.test(nav.pend.sel), nav.pend);
  ok('карточка задачи подсвечена', nav.hl, nav);

  console.log('\n[E] пустой статус');
  await page.evaluate(() => { window._teamRaw.tasks = []; wlxOpenTasks('review'); });
  await page.waitForTimeout(150);
  const empty = await page.evaluate(() => (document.querySelector('#ov-pd2 .wlxq-empty') || {}).textContent);
  ok('пустое состояние объяснено', /Ни одной задачи/.test(empty || ''), empty);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[F] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
