/* probe_asg — несколько исполнителей у задачи и этапа */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.__toast = ''; window.toast = t => { window.__toast = String(t); };
  window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agCanDocs = () => true;
  window.agIsPM = () => true;
  window.giEnsureStatus = async () => ({ status: 'inactive' }); window.ctBadge = () => '';
  window.tLoadProjectWork = null; window.tLoadProjectToday = null;
  window.__added = []; window.tTaskAdd = (pid, row) => { window.__added.push({ pid, row }); pd2Close(); return Promise.resolve(true); };
  window.__upd = []; window.tTaskUpdate = (id, patch) => { window.__upd.push({ id, patch }); pd2Close(); return Promise.resolve(true); };
  window.__st = []; window.tStageSave = (id, patch) => { window.__st.push({ id, patch }); pd2Close(); return Promise.resolve(true); };
  TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null },
          { _id: 'm2', name: 'Шахзод', color: '#8A8FFF', avatar: null },
          { _id: 'm3', name: 'Азиза', color: '#FFC454', avatar: null },
          { _id: 'm4', name: 'Рустам', color: '#FF6B6B', avatar: null }];
  PROJECTS = [{ id: 'p1', name: 'Artel', logo: 'A', logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0, stages: '1 / 2',
    status: 'active', mrr: 0, cost: 0, tg_chat_id: null, client_id: null, contacts: null, ui: null, kb: null,
    leads: ['m1'], lead_id: 'm1', _appr: [],
    _stages: [{ id: 's1', name: 'ПРОДАКШН', status: 'active', assignee_id: 'm1', assignees: ['m1', 'm2'] }],
    _tasks: [{ id: 't1', title: 'Снять ролик', status: 'active', assignee_id: 'm1', assignees: ['m1', 'm2', 'm3', 'm4'],
      stage_id: 's1', due_date: null, due_time: null, time_spent: 0, review_spent: 0, subtasks: [], attachments: [] },
      { id: 't2', title: 'Один исполнитель', status: 'active', assignee_id: 'm2', stage_id: 's1', due_date: null,
        due_time: null, time_spent: 0, review_spent: 0, subtasks: [], attachments: [] }],
    _reports: [] }];
  openProject(0); pdTab('kanban');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1050 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(400);

  console.log('\n[A] чтение состава');
  const read = await page.evaluate(() => ({
    multi: asgOf(PROJECTS[0]._tasks[0]), single: asgOf(PROJECTS[0]._tasks[1]), none: asgOf({}),
    legacy: asgOf({ assignee_id: 'm3' }), mixed: asgOf({ assignee_id: 'm4', assignees: ['m1'] }),
    names: asgNames(PROJECTS[0]._tasks[0]) }));
  console.log('    ' + JSON.stringify(read));
  ok('список читается', read.multi.length === 4 && read.multi[0] === 'm1', read.multi);
  ok('старая запись с одним исполнителем понимается', read.single.length === 1 && read.single[0] === 'm2', read.single);
  ok('без исполнителя — пусто', read.none.length === 0, read.none);
  ok('основной всегда первый', read.mixed[0] === 'm4' && read.mixed.length === 2, read.mixed);
  ok('подпись — имя и сколько ещё', /Худойберди \+3/.test(read.names), read.names);

  console.log('\n[B] карточка задачи');
  const card = await page.evaluate(() => {
    const c1 = document.querySelector('.pk-card[data-tkid="t1"]'), c2 = document.querySelector('.pk-card[data-tkid="t2"]');
    return { stack: c1.querySelectorAll('.asg-stack .asg-av').length, more: (c1.querySelector('.asg-av.more') || {}).textContent,
      who1: c1.querySelector('.pk-who').textContent, single: !!c2.querySelector('.pk-av'), who2: c2.querySelector('.pk-who').textContent };
  });
  console.log('    ' + JSON.stringify(card));
  ok('на карточке стопка аватарок', card.stack === 4, card);
  ok('четвёртый — «+N», а не лицо', card.more === '+1', card.more);
  ok('подпись сжата до «имя +N»', /\+3/.test(card.who1), card.who1);
  ok('у одиночной задачи всё как было', card.single && card.who2 === 'Шахзод', card);

  console.log('\n[C] форма задачи');
  await page.evaluate(async () => { await pdTaskEdit('t1'); });
  await page.waitForTimeout(400);
  const form = await page.evaluate(() => {
    const w = document.getElementById('cdd-pd2-asg');
    return { multi: w.classList.contains('cdd-multi'), val: document.getElementById('pd2-asg').value,
      chips: w.querySelectorAll('.cdd-lbl .asg-chip').length, more: (w.querySelector('.cdd-lbl .asg-more') || {}).textContent,
      on: w.querySelectorAll('.cdd-opt.on').length, clear: !!w.querySelector('.asg-clear'),
      lbl: [...document.querySelectorAll('.tskm-pl')].map(x => x.textContent.trim())[1] };
  });
  console.log('    ' + JSON.stringify(form));
  ok('поле стало множественным', form.multi && form.val === 'm1,m2,m3,m4', form);
  ok('в поле — чипы, лишние свёрнуты', form.chips === 3 && form.more === '+1', form);
  ok('в списке отмечены все выбранные', form.on === 4, form.on);
  ok('подпись поля во множественном числе', /Исполнител/.test(form.lbl || ''), form.lbl);
  const pick = await page.evaluate(() => {
    asgPick('pd2-asg', 'm2');                       // снять
    const afterOff = document.getElementById('pd2-asg').value;
    asgPick('pd2-asg', 'm2');                       // вернуть
    const afterOn = document.getElementById('pd2-asg').value;
    const w = document.getElementById('cdd-pd2-asg');
    return { afterOff, afterOn, chips: w.querySelectorAll('.cdd-lbl .asg-chip').length, on: w.querySelectorAll('.cdd-opt.on').length };
  });
  console.log('    ' + JSON.stringify(pick));
  ok('повторный клик снимает исполнителя', pick.afterOff === 'm1,m3,m4', pick.afterOff);
  ok('и добавляет обратно в конец', pick.afterOn === 'm1,m3,m4,m2', pick.afterOn);
  ok('поле перерисовалось', pick.chips === 3 && pick.on === 4, pick);
  const saved = await page.evaluate(async () => { pdSaveTask('t1'); await new Promise(r => setTimeout(r, 150)); return window.__upd[0]; });
  console.log('    ' + JSON.stringify(saved.patch.assignees) + ' / main ' + saved.patch.assignee_id);
  ok('сохраняется весь состав', Array.isArray(saved.patch.assignees) && saved.patch.assignees.length === 4, saved.patch.assignees);
  ok('основным остаётся первый', saved.patch.assignee_id === 'm1', saved.patch.assignee_id);

  console.log('\n[D] очистка и создание');
  await page.evaluate(async () => { await pdNewTask('wait'); });
  await page.waitForTimeout(400);
  const created = await page.evaluate(async () => {
    document.getElementById('pd2-ttl').value = 'Съёмка';
    asgPick('pd2-asg', 'm3'); asgPick('pd2-asg', 'm1');
    const before = document.getElementById('pd2-asg').value;
    asgClear('pd2-asg');
    const cleared = { v: document.getElementById('pd2-asg').value, none: !!document.querySelector('#cdd-pd2-asg .asg-none') };
    asgPick('pd2-asg', 'm2'); asgPick('pd2-asg', 'm4');
    pdAddTask(); await new Promise(r => setTimeout(r, 200));
    return { before, cleared, row: (window.__added[0] || {}).row };
  });
  console.log('    ' + JSON.stringify(created));
  ok('порядок выбора сохраняется', created.before === 'm3,m1', created.before);
  ok('«Очистить» снимает всех', created.cleared.v === '' && created.cleared.none, created.cleared);
  ok('новая задача уходит со списком', created.row.assignees.join(',') === 'm2,m4' && created.row.assignee_id === 'm2', created.row);

  console.log('\n[E] этап');
  await page.evaluate(() => { pdTab('stages'); pdEditStage('s1'); });
  await page.waitForTimeout(300);
  const st = await page.evaluate(async () => {
    const w = document.getElementById('cdd-pd2-stasg');
    const start = document.getElementById('pd2-stasg').value;
    asgPick('pd2-stasg', 'm3');
    pdSaveStage('s1'); await new Promise(r => setTimeout(r, 150));
    return { multi: !!w && w.classList.contains('cdd-multi'), start, patch: (window.__st[0] || {}).patch };
  });
  console.log('    ' + JSON.stringify(st));
  ok('у этапа тоже несколько ответственных', st.multi && st.start === 'm1,m2', st);
  ok('состав этапа сохраняется', st.patch.assignees.join(',') === 'm1,m2,m3' && st.patch.assignee_id === 'm1', st.patch);

  console.log('\n[F] фильтр по исполнителю');
  const filt = await page.evaluate(() => {
    pdTab('kanban'); pkSetResp('m3');
    const n = document.querySelectorAll('.pk-card').length;
    const ids = [...document.querySelectorAll('.pk-card')].map(c => c.dataset.tkid);
    pkSetResp('__none'); const none = document.querySelectorAll('.pk-card').length;
    pkSetResp('all');
    return { n, ids, none };
  });
  console.log('    ' + JSON.stringify(filt));
  ok('фильтр находит задачу по любому из исполнителей', filt.n === 1 && filt.ids[0] === 't1', filt);
  ok('«не назначен» не ловит задачи с составом', filt.none === 0, filt.none);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[G] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
