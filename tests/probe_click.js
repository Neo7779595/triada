/* probe_click — карточки задач и этапов кликабельны: дедлайны, сводка, циклы */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const base = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me;
  window.__toast = ''; window.toast = t => { window.__toast = String(t); };
  window.__go = null; window.dlGoto = (pid, kind, id) => { window.__go = [pid, kind, id]; };
  PROJECTS = [
    { id: 'p1', name: 'TRIA SMART CORP', status: 'active', logo: 'T', logoUrl: null, pct: 40 },
    { id: 'p2', name: 'APOLO COFFEE', status: 'active', logo: 'A', logoUrl: null, pct: 20 },
  ];
  TEAM = [{ _id: 'm1', name: 'DTR HUNTER', color: '#37E6C8', avatar: null }];
  window.tLoadTeam = async () => {};
};
const show = () => { const c = document.getElementById('content-ag'); if (!c) return;
  document.body.appendChild(c);
  c.style.cssText = 'position:fixed;left:0;top:0;width:1560px;height:900px;overflow:auto;background:#0a0d0c;z-index:1;display:block;padding:20px'; };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  console.log('\n[A] дедлайны — карточка ведёт в задачу и в этап');
  await page.evaluate(base);
  await page.evaluate(() => {
    DEADLINES.length = 0;
    DEADLINES.push({ stage: 'Разработать контент план', project: 'TRIA SMART CORP', plogo: 'T', plogoUrl: '',
      day: 5, mon: 'июл', dueTime: '', due: '2026-07-05', bucket: 'overdue', status: 'active', type: 'task',
      _id: 't-77', pid: 'p1', assignee: 'm1', done_at: null, spent: 0 });
    DEADLINES.push({ stage: 'Аудит профиля', project: 'APOLO COFFEE', plogo: 'A', plogoUrl: '',
      day: 17, mon: 'июл', dueTime: '', due: '2026-07-17', bucket: 'overdue', status: 'active', type: 'stage',
      _id: 's-12', pid: 'p2', assignee: null, done_at: null, spent: 0 });
    renderDeadlines();
  });
  await page.evaluate(show);
  await page.waitForTimeout(300);
  const dl = await page.evaluate(() => [...document.querySelectorAll('#content-ag .dlx')].map(r => ({
    go: r.classList.contains('dlx-go'), onclick: r.getAttribute('onclick'), role: r.getAttribute('role'),
    tab: r.getAttribute('tabindex'), title: r.getAttribute('title'), cur: getComputedStyle(r).cursor })));
  console.log('    ' + JSON.stringify(dl));
  ok('обе карточки на месте', dl.length === 2, dl.length);
  ok('обе кликабельны', dl.every(r => r.go && r.cur === 'pointer'), dl.map(r => [r.go, r.cur]));
  ok('задача ведёт в задачу', /dlGoto\('p1','task','t-77'\)/.test(dl[0].onclick || ''), dl[0].onclick);
  ok('этап ведёт в этап', /dlGoto\('p2','stage','s-12'\)/.test(dl[1].onclick || ''), dl[1].onclick);
  ok('доступно с клавиатуры', dl.every(r => r.role === 'button' && r.tab === '0'), dl.map(r => [r.role, r.tab]));
  await page.click('#content-ag .dlx');
  await page.waitForTimeout(120);
  ok('клик действительно уводит', JSON.stringify(await page.evaluate(() => window.__go)) === '["p1","task","t-77"]', await page.evaluate(() => window.__go));

  console.log('\n[B] сводка — «Загрузка по этапам»');
  await page.evaluate(() => {
    OVERVIEW._loaded = true;
    OVERVIEW.stageLoad = [
      { name: 'Бриф и доступы', done: 1, total: 2, items: [{ pid: 'p1', sid: 's-1', status: 'done' }, { pid: 'p2', sid: 's-2', status: 'active' }] },
      { name: 'Аудит профиля', done: 0, total: 1, items: [{ pid: 'p2', sid: 's-9', status: 'wait' }] },
    ];
    window.__go = null;
    renderOverview();
  });
  await page.evaluate(show);
  await page.waitForTimeout(300);
  const ld = await page.evaluate(() => [...document.querySelectorAll('#content-ag .ld-row')].map(r => ({
    go: r.classList.contains('ld-go'), nm: r.querySelector('.ld-name').textContent.trim(),
    title: r.getAttribute('title'), cur: getComputedStyle(r).cursor })));
  console.log('    ' + JSON.stringify(ld));
  ok('строки этапов кликабельны', ld.length === 2 && ld.every(r => r.go && r.cur === 'pointer'), ld);
  ok('у одиночного этапа обещаем сам этап', /Открыть этап/.test(ld[1].title || ''), ld[1].title);
  ok('у общего — список проектов', /Показать проекты/.test(ld[0].title || ''), ld[0].title);
  await page.evaluate(() => [...document.querySelectorAll('#content-ag .ld-row')][1].click());
  await page.waitForTimeout(150);
  ok('один проект — сразу в этап', JSON.stringify(await page.evaluate(() => window.__go)) === '["p2","stage","s-9"]', await page.evaluate(() => window.__go));
  await page.evaluate(() => { window.__go = null; [...document.querySelectorAll('#content-ag .ld-row')][0].click(); });
  await page.waitForTimeout(200);
  const md = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.wlxq');
    return m ? { ttl: m.querySelector('.wlxq-ttl').textContent, sub: m.querySelector('.wlxq-sub').textContent,
      cards: [...m.querySelectorAll('.wlxq-card')].map(c => ({ t: c.querySelector('.wlxq-t').textContent, st: c.querySelector('.wlxq-due').textContent, on: c.getAttribute('onclick') })) } : null;
  });
  console.log('    ' + JSON.stringify(md));
  ok('несколько проектов — сначала показываем какие', !!md && md.cards.length === 2, md);
  ok('в заголовке — название этапа', md && md.ttl === 'Бриф и доступы', md && md.ttl);
  ok('подпись объясняет, сколько и где', /2 проектах · завершён в 1/.test((md && md.sub) || ''), md && md.sub);
  ok('карточки названы проектами', md && md.cards.map(c => c.t).sort().join('|') === 'APOLO COFFEE|TRIA SMART CORP', md && md.cards.map(c => c.t));
  ok('состояние этапа подписано', md && md.cards.some(c => /Завершён/.test(c.st)) && md.cards.some(c => /В работе/.test(c.st)), md && md.cards.map(c => c.st));
  await page.click('#ov-pd2 .wlxq-card');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ go: window.__go, closed: !document.querySelector('#ov-pd2 .modal.wlxq') }));
  ok('карточка проекта ведёт в его этап', Array.isArray(after.go) && after.go[1] === 'stage', after.go);
  ok('модалка закрылась', after.closed, after);

  console.log('\n[C] циклы — задачи, застрявшие этапы, агрегаты');
  await page.evaluate(() => { pd2Close(); window.__go = null;
    const day = n => new Date(Date.now() + n * 86400000).toISOString();
    Object.assign(CYCLES, { _loaded: true, stages: [], chartStages: [], trend: { vals: [], labels: [] }, clients: [],
      agingRows: [{ pid: 'p1', sid: 's-55', client: 'TRIA SMART CORP', stage: 'ОПЕРАЦИОНКА', sinceMs: 9e8, startMs: Date.now() - 9e8, overPct: 140, byOwn: true, frozen: null }],
      reviewTasks: [{ title: 'мукаму', sec: 46800, stage: 'ГЕНЕРАЛЬНЫЙ КАБИНЕТ', project: 'TRIA SMART CORP', pid: 'p1', tid: 't-rev', sid: 's-gk', onReview: true, date: day(-1), asg: 'm1' }],
      reviewNow: 1, reviewCount: 1, reviewTotalSec: 46800, reviewAvgSec: 46800, reviewStages: [],
      workTopTasks: [
        /* «SMM ОТЧЕТ» есть у двух проектов — по клику должен спросить, в какой идти */
        { title: 'Дать ТЗ дизайнеру', sec: 164000, stage: 'SMM ОТЧЕТ', project: 'TRIA SMART CORP', pid: 'p1', tid: 't-w1', sid: 's-smm1', done: true, date: day(-2), asg: 'm1' },
        { title: 'Снять рилс', sec: 90000, stage: 'SMM ОТЧЕТ', project: 'APOLO COFFEE', pid: 'p2', tid: 't-w3', sid: 's-smm2', done: true, date: day(-2), asg: 'm1' },
        { title: 'Привести в порядок карточки', sec: 39600, stage: 'ПРОЕКТЫ', project: 'TRIA SMART CORP', pid: 'p1', tid: 't-w2', sid: 's-pr', done: false, date: day(-3), asg: 'm1' },
      ],
      workCount: 2, workTotalSec: 203600, workMedianSec: 101800, workMeanSec: 101800, workP90Sec: 164000,
      workDoneCount: 1, workDoneAvgSec: 164000, workStages: [], workByAsg: [], workParetoPct: 50 });
    REV_Q = ''; WORK_Q = '';
    renderCycles();
  });
  await page.evaluate(show);
  await page.waitForTimeout(300);
  const cyc = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#content-ag .cyc-r')].map(r => ({
      nm: (r.querySelector('.cyc-r-t') || {}).textContent, go: r.classList.contains('cyc-go'),
      onclick: r.getAttribute('onclick'), cur: getComputedStyle(r).cursor }));
    const stuck = [...document.querySelectorAll('#content-ag .cyc-stuck')].map(r => ({
      go: r.classList.contains('cyc-go'), onclick: r.getAttribute('onclick'), cur: getComputedStyle(r).cursor }));
    return { rows, stuck };
  });
  console.log('    ' + JSON.stringify(cyc.rows.map(r => [r.nm, r.go])));
  const tasks = cyc.rows.filter(r => /дизайнеру|карточки|мукаму/.test(r.nm || ''));
  const stages = cyc.rows.filter(r => /SMM ОТЧЕТ|ПРОЕКТЫ|ГЕНЕРАЛЬНЫЙ/.test(r.nm || ''));
  ok('строки задач кликабельны', tasks.length >= 3 && tasks.every(r => r.go && r.cur === 'pointer'), tasks);
  ok('задача ведёт в свою задачу', tasks.some(r => /dlGoto\('p1','task','t-w1'\)/.test(r.onclick || '')), tasks.map(r => r.onclick));
  ok('задача с утверждения — тоже', tasks.some(r => /dlGoto\('p1','task','t-rev'\)/.test(r.onclick || '')), tasks.map(r => r.onclick));
  ok('строки этапов ведут в этап', stages.length >= 3 && stages.every(r => /cycStageOpen/.test(r.onclick || '')), stages.map(r => r.onclick));
  ok('застрявший этап ведёт в этап', cyc.stuck.length === 1 && /dlGoto\('p1','stage','s-55'\)/.test(cyc.stuck[0].onclick || '') && cyc.stuck[0].cur === 'pointer', cyc.stuck);

  console.log('\n[D] клик по этапу ведёт в этап, а не фильтрует');
  await page.evaluate(() => { window.__go = null;
    [...document.querySelectorAll('#content-ag .cyc-r')].find(r => (r.dataset || {}).st === 'ПРОЕКТЫ').click(); });
  await page.waitForTimeout(200);
  const one = await page.evaluate(() => ({ go: window.__go, q: WORK_Q, modal: !!document.querySelector('#ov-pd2 .modal.wlxq') }));
  console.log('    ' + JSON.stringify(one));
  ok('этап одного проекта открывается сразу', JSON.stringify(one.go) === '["p1","stage","s-pr"]', one);
  ok('поиск при этом не трогаем', one.q === '', one.q);
  ok('лишнего окна не появилось', !one.modal, one);

  await page.evaluate(() => { window.__go = null;
    [...document.querySelectorAll('#content-ag .cyc-r')].find(r => (r.dataset || {}).st === 'SMM ОТЧЕТ').click(); });
  await page.waitForTimeout(220);
  const many = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.wlxq');
    return m ? { ttl: m.querySelector('.wlxq-ttl').textContent, sub: m.querySelector('.wlxq-sub').textContent,
      cards: [...m.querySelectorAll('.wlxq-card')].map(c => ({ t: c.querySelector('.wlxq-t').textContent, on: c.getAttribute('onclick') })) } : null;
  });
  console.log('    ' + JSON.stringify(many));
  ok('этап нескольких проектов — сначала выбор', !!many && many.cards.length === 2, many);
  ok('в выборе — оба проекта', many && many.cards.map(c => c.t).sort().join('|') === 'APOLO COFFEE|TRIA SMART CORP', many && many.cards.map(c => c.t));
  await page.click('#ov-pd2 .wlxq-card');
  await page.waitForTimeout(180);
  const pick = await page.evaluate(() => ({ go: window.__go, closed: !document.querySelector('#ov-pd2 .modal.wlxq') }));
  ok('выбор ведёт в этап именно этого проекта', Array.isArray(pick.go) && pick.go[1] === 'stage' && /^s-smm/.test(pick.go[2]), pick.go);
  ok('окно выбора закрылось', pick.closed, pick);

  console.log('\n[D2] в поиске можно писать');
  await page.evaluate(() => { pd2Close(); WORK_Q = ''; renderCycles(); });
  await page.evaluate(show);
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    document.getElementById('work-q').focus();
    /* считаем реальные пересборки списка, а не вызовы функции */
    window.__rebuilds = 0;
    window.__mo = new MutationObserver(() => { window.__rebuilds++; });
    window.__mo.observe(document.getElementById('content-ag'), { childList: true });
  });
  await page.type('#content-ag #work-q', 'дизайнеру', { delay: 45 });
  const typed = await page.evaluate(() => { const el = document.getElementById('work-q');
    return { v: el ? el.value : null, focused: document.activeElement === el, rebuilds: window.__rebuilds, caret: el ? el.selectionStart : null }; });
  console.log('    быстрый набор: ' + JSON.stringify(typed));
  ok('текст набрался целиком', typed.v === 'дизайнеру', typed.v);
  ok('поле не теряет фокус во время набора', typed.focused, typed);
  ok('экран не пересобирается на каждую букву', typed.rebuilds === 0, typed.rebuilds);

  /* набор медленнее паузы: между буквами список успевает пересобраться —
     именно тут раньше терялись фокус и каретка */
  await page.evaluate(() => { WORK_Q = ''; window._cntPause = 1; renderCycles(); window._cntPause = 0;
    const el = document.getElementById('work-q'); el.focus(); window.__rebuilds = 0;
    window.__mo.disconnect(); window.__mo.observe(document.getElementById('content-ag'), { childList: true }); });
  await page.evaluate(show);
  await page.evaluate(() => document.getElementById('work-q').focus());
  await page.type('#content-ag #work-q', 'диза', { delay: 320 });
  await page.waitForTimeout(400);
  const slow = await page.evaluate(() => { const el = document.getElementById('work-q');
    return { v: el ? el.value : null, focused: document.activeElement === el, rebuilds: window.__rebuilds, caret: el ? el.selectionStart : null, q: WORK_Q }; });
  console.log('    медленный набор: ' + JSON.stringify(slow));
  ok('при медленном наборе список успевает пересобраться', slow.rebuilds >= 2, slow.rebuilds);
  ok('и всё равно набирается целиком', slow.v === 'диза' && slow.q === 'диза', slow);
  ok('фокус остаётся в поле', slow.focused && slow.caret === 4, slow);
  await page.evaluate(() => { WORK_Q = 'дизайнеру'; renderCycles(); });
  await page.evaluate(show);
  await page.evaluate(() => { const el = document.getElementById('work-q'); el.focus(); el.setSelectionRange(9, 9); });
  await page.waitForTimeout(200);
  await page.waitForTimeout(500);
  const done2 = await page.evaluate(() => {
    const el = document.getElementById('work-q');
    return { v: el ? el.value : null, focused: document.activeElement === el, caret: el ? el.selectionStart : null,
      rows: [...document.querySelectorAll('#content-ag .cyc-r')].map(r => (r.querySelector('.cyc-r-t') || {}).textContent), q: WORK_Q };
  });
  console.log('    ' + JSON.stringify(done2));
  ok('после паузы список отфильтровался', done2.q === 'дизайнеру' && done2.rows.includes('Дать ТЗ дизайнеру') && !done2.rows.includes('Снять рилс'), done2);
  ok('фокус и каретка остались в поле', done2.focused && done2.caret === 9, done2);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[E] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
