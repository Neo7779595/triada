/* probe_pdui — конструктор шапки проекта: порядок, скрытие, сохранение */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me;
  window.__toast = ''; window.toast = t => { window.__toast = String(t); };
  window.LIVE = false;                       // без сети: раскладка живёт в объекте проекта
  window.agIsOwner = () => true;
  window.agCanEditProject = () => true;
  window.agCanDocs = () => true;
  window.giEnsureStatus = async () => ({ status: 'active' });
  window.ctBadge = () => '';
  window.tLoadProjectWork = null;
  const P = (id, name) => ({ id, name, logo: name[0], logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0,
    stages: '0 / 3', status: 'active', mrr: 0, cost: 0, tg_chat_id: null, contacts: null, ui: null,
    _stages: [], _tasks: [], _reports: [] });
  PROJECTS = [P('p1', 'APOLO COFFEE'), P('p2', 'Artel')];
  TEAM = [];
  openProject(0);
};
const bar = () => ({
  tabs: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k),
  acts: [...document.querySelectorAll('#pd-tabbar .pd-tabact .pd-chip')].map(t => t.dataset.k || 'gear'),
  top: ['pd-hdr-cal', 'pd-hdr-drive', 'pd-hdr-time'].map(id => { const e = document.getElementById(id); return e && e.style.display !== 'none' ? id.replace('pd-hdr-', '') : null; }).filter(Boolean),
  cur: pdTabCur,
});

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(350);

  console.log('\n[A] по умолчанию — как было');
  const d = await page.evaluate(bar);
  console.log('    ' + JSON.stringify(d));
  ok('вкладки в исходном порядке', d.tabs.join(',') === 'stages,kanban,deadlines,board,content,smm,history', d.tabs);
  ok('кнопки панели на месте', d.acts.join(',') === 'brief,docs,contacts,telegram,gear', d.acts);
  ok('кнопки шапки на месте', d.top.join(',') === 'cal,drive,time', d.top);
  ok('раскладка не выдумана — в проекте по-прежнему null', await page.evaluate(() => PROJECTS[0].ui === null));

  console.log('\n[B] конструктор открывается');
  await page.evaluate(() => pdUiOpen());
  await page.waitForTimeout(200);
  const panel = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.pdui-modal'); if (!m) return null;
    return { ttl: m.querySelector('.pdui-ttl').textContent, sub: m.querySelector('.pdui-sub').textContent,
      groups: [...m.querySelectorAll('.pdui-list')].map(l => ({ g: l.dataset.g, rows: [...l.querySelectorAll('.pdui-row')].map(r => r.dataset.k) })) };
  });
  console.log('    ' + JSON.stringify(panel));
  ok('панель открылась', !!panel);
  ok('три группы', panel.groups.length === 3, panel.groups.map(g => g.g));
  ok('вкладки, кнопки панели и кнопки шапки — все', panel.groups.map(g => g.rows.length).join(',') === '7,4,3', panel.groups);
  ok('в заголовке — имя проекта', /APOLO COFFEE/.test(panel.sub), panel.sub);

  console.log('\n[C] скрыть вкладку');
  await page.evaluate(() => pduiToggle('board'));
  await page.waitForTimeout(150);
  const hid = await page.evaluate(() => ({ bar: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k), ui: PROJECTS[0].ui }));
  console.log('    ' + JSON.stringify(hid));
  ok('вкладка исчезла из панели', hid.bar.indexOf('board') < 0 && hid.bar.length === 6, hid.bar);
  ok('и записана в скрытые', (hid.ui.hidden || []).join(',') === 'board', hid.ui);
  ok('порядок сохранён целиком', (hid.ui.order || []).length === 14, hid.ui.order);

  console.log('\n[D] скрыли ту вкладку, на которой стоим');
  await page.evaluate(() => { pdTab('kanban'); pduiToggle('kanban'); });
  await page.waitForTimeout(200);
  const moved = await page.evaluate(() => ({ cur: pdTabCur, bar: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k) }));
  console.log('    ' + JSON.stringify(moved));
  ok('перекинуло на первую видимую', moved.cur === 'stages', moved);
  ok('панель без скрытых', moved.bar.indexOf('kanban') < 0 && moved.bar.indexOf('board') < 0, moved.bar);

  console.log('\n[E] последнюю вкладку скрыть нельзя');
  const last = await page.evaluate(() => {
    ['deadlines', 'content', 'smm', 'history'].forEach(k => pduiToggle(k));
    const before = [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k);
    window.__toast = '';
    pduiToggle('stages');
    return { before, after: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k), toast: window.__toast };
  });
  console.log('    ' + JSON.stringify(last));
  ok('осталась одна вкладка', last.before.join(',') === 'stages', last.before);
  ok('скрыть её не дали', last.after.join(',') === 'stages', last.after);
  ok('объяснили почему', /Хотя бы одна вкладка/.test(last.toast), last.toast);

  console.log('\n[F] сброс');
  await page.evaluate(() => pduiReset());
  await page.waitForTimeout(200);
  const reset = await page.evaluate(() => ({ ui: PROJECTS[0].ui, bar: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k) }));
  ok('раскладка снова по умолчанию', reset.ui === null && reset.bar.length === 7, reset);

  console.log('\n[G] порядок стрелками');
  await page.evaluate(() => { pduiMove('tab', 6, 0); });
  await page.waitForTimeout(150);
  const ord = await page.evaluate(() => ({ bar: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k), order: PROJECTS[0].ui.order.slice(0, 7) }));
  console.log('    ' + JSON.stringify(ord));
  ok('история встала первой', ord.bar[0] === 'history' && ord.bar.length === 7, ord.bar);
  ok('порядок записан', ord.order[0] === 'history', ord.order);
  ok('группы не перемешались', await page.evaluate(() => { const o = PROJECTS[0].ui.order; return o.slice(0, 7).every(k => ['stages', 'kanban', 'deadlines', 'board', 'content', 'smm', 'history'].indexOf(k) >= 0); }));

  console.log('\n[H] перетаскивание мышью');
  await page.evaluate(() => { pduiReset(); pdUiOpen(); });
  await page.waitForTimeout(250);
  const box = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.pdui-list[data-g="tab"] .pdui-row')];
    const a = rows[0].querySelector('.pdui-grip').getBoundingClientRect(), z = rows[2].getBoundingClientRect();
    return { x: a.x + a.width / 2, y: a.y + a.height / 2, ty: z.y + z.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x, box.y + 12, { steps: 3 });
  await page.mouse.move(box.x, box.ty, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const drag = await page.evaluate(() => ({ bar: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k),
    rows: [...document.querySelectorAll('.pdui-list[data-g="tab"] .pdui-row')].map(r => r.dataset.k) }));
  console.log('    ' + JSON.stringify(drag));
  ok('перетащенная вкладка встала на третье место', drag.bar[2] === 'stages', drag.bar);
  ok('в панели тот же порядок, что в конструкторе', drag.bar.join(',') === drag.rows.join(','), drag);
  ok('ни одна вкладка не потерялась', drag.bar.length === 7 && new Set(drag.bar).size === 7, drag.bar);

  console.log('\n[I] кнопки шапки и панели');
  await page.evaluate(() => { pduiToggle('drive'); pduiToggle('telegram'); });
  await page.waitForTimeout(200);
  const btns = await page.evaluate(bar);
  console.log('    ' + JSON.stringify(btns));
  ok('кнопка «Диск» ушла из шапки', btns.top.join(',') === 'cal,time', btns.top);
  ok('Telegram ушёл из панели', btns.acts.join(',') === 'brief,docs,contacts,gear', btns.acts);
  const noG = await page.evaluate(() => { window._pdGoogleOn = false; pduiApplyTop(PROJECTS[0]);
    return ['pd-hdr-cal', 'pd-hdr-drive', 'pd-hdr-time'].map(id => document.getElementById(id).style.display); });
  ok('без Google кнопки Google скрыты, время остаётся', noG[0] === 'none' && noG[1] === 'none' && noG[2] === '', noG);
  await page.evaluate(() => { window._pdGoogleOn = true; pduiApplyTop(PROJECTS[0]); });
  const back = await page.evaluate(() => document.getElementById('pd-hdr-drive').style.display);
  ok('скрытая кнопка не всплывает после подключения Google', back === 'none', back);

  console.log('\n[J] применить ко всем проектам');
  await page.evaluate(async () => { await pduiApplyAll(); });
  await page.waitForTimeout(200);
  const all = await page.evaluate(() => ({ p1: PROJECTS[0].ui, p2: PROJECTS[1].ui, toast: window.__toast }));
  ok('второй проект получил ту же раскладку', JSON.stringify(all.p1) === JSON.stringify(all.p2), all);
  ok('это копия, а не общий объект', await page.evaluate(() => { PROJECTS[1].ui.hidden.push('smm'); return PROJECTS[0].ui.hidden.indexOf('smm') < 0; }));
  ok('сказали, скольким применили', /1 проекту/.test(all.toast), all.toast);

  console.log('\n[K] чужая раскладка из будущей версии');
  const fut = await page.evaluate(() => {
    PROJECTS[0].ui = { order: ['history', 'stages', 'выдуманный-ключ'], hidden: ['ещё-один'] };
    openProject(0);
    return { bar: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k),
      acts: [...document.querySelectorAll('#pd-tabbar .pd-tabact .pd-chip')].map(t => t.dataset.k || 'gear') };
  });
  console.log('    ' + JSON.stringify(fut));
  ok('незнакомые ключи не ломают панель', fut.bar.length === 7 && fut.acts.length === 5, fut);
  ok('сохранённый порядок соблюдён', fut.bar[0] === 'history' && fut.bar[1] === 'stages', fut.bar);
  ok('остальные вкладки не пропали', ['kanban', 'deadlines', 'board', 'content', 'smm'].every(k => fut.bar.indexOf(k) >= 0), fut.bar);

  console.log('\n[L] без права на правку');
  const ro = await page.evaluate(() => { pd2Close(); window.agCanEditProject = () => false; openProject(0); window.__toast = ''; pdUiOpen();
    return { gear: !!document.querySelector('#pd-tabbar .pd-ui-btn'), toast: window.__toast, panel: !!document.querySelector('#ov-pd2 .modal.pdui-modal') }; });
  ok('кнопки настройки нет', !ro.gear, ro);
  ok('и панель не открыть', !ro.panel && /может тот, кто ведёт проект/.test(ro.toast), ro);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[M] база отказала — экран возвращается к сохранённому');
  const rej = await page.evaluate(async () => {
    pd2Close(); window.agCanEditProject = () => true; PROJECTS[0].ui = null; openProject(0);
    window.LIVE = true;
    window.SB = { from() { return { update() { return { eq: async () => ({ error: { message: 'нет прав' } }) }; } }; } };
    window.__toast = '';
    await pduiToggle('smm');
    await new Promise(r => setTimeout(r, 60));
    const out = { ui: PROJECTS[0].ui, bar: [...document.querySelectorAll('#pd-tabbar .pd-tab')].map(t => t.dataset.k), toast: window.__toast };
    window.LIVE = false; window.SB = null;
    return out;
  });
  console.log('    ' + JSON.stringify(rej));
  ok('раскладка не осталась применённой', rej.ui === null, rej.ui);
  ok('вкладка вернулась в панель', rej.bar.indexOf('smm') >= 0 && rej.bar.length === 7, rej.bar);
  ok('о сбое сказали', /не сохранилась/.test(rej.toast), rej.toast);

  console.log('\n[N] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
