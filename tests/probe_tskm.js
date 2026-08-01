/* probe_tskm — форма задачи: раскладка, поля, сохранение, drag&drop */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.__toast = ''; window.toast = t => { window.__toast = String(t); };
  window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agCanDocs = () => true;
  window.giEnsureStatus = async () => ({ status: 'inactive' }); window.ctBadge = () => '';
  window.tLoadProjectWork = null; window.tLoadProjectToday = null;
  window.__added = []; window.tTaskAdd = (pid, row) => { window.__added.push({ pid, row }); pd2Close(); return Promise.resolve(true); };
  window.__upd = []; window.tTaskUpdate = (id, patch) => { window.__upd.push({ id, patch }); pd2Close(); return Promise.resolve(true); };
  TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null, is_pm: true }];
  PROJECTS = [{ id: 'p1', name: 'Artel', logo: 'A', logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0, stages: '1 / 2',
    status: 'active', mrr: 0, cost: 0, tg_chat_id: null, client_id: null, contacts: null, ui: null, kb: null,
    leads: ['m1'], lead_id: 'm1', _appr: [],
    _stages: [{ id: 's1', name: 'ПРОДАКШН', status: 'active' }, { id: 's2', name: 'СЦЕНАРИИ', status: 'wait' }],
    _tasks: [{ id: 't1', title: 'Смонтировать ролик', status: 'active', assignee_id: 'm1', stage_id: 's1',
      due_date: '2026-08-05', due_time: '18:00', time_spent: 600, review_spent: 0, difficulty: 'medium', priority: 'important',
      subtasks: [{ id: 'a', title: 'Черновик', done: true }, { id: 'b', title: 'Цветокор', done: false }],
      attachments: [{ type: 'link', url: 'https://www.figma.com/file/x', name: 'Макет Figma' }] }],
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
  await page.waitForTimeout(300);

  console.log('\n[A] новая задача — раскладка');
  await page.evaluate(async () => { await pdNewTask('review'); });
  await page.waitForTimeout(400);
  const lay = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.tskm'); if (!m) return null;
    const r = el => el.getBoundingClientRect();
    const main = m.querySelector('.tskm-main'), side = m.querySelector('.tskm-side');
    const ttl = document.getElementById('pd2-ttl');
    return { w: Math.round(r(m).width), crumb: m.querySelector('.tskm-eyebrow').textContent.replace(/\s+/g, ' ').trim(),
      ttlFont: Math.round(parseFloat(getComputedStyle(ttl).fontSize)),
      sideRight: Math.round(r(side).left) > Math.round(r(main).left),
      sameRow: Math.abs(r(side).top - r(main).top) < 3,
      props: [...m.querySelectorAll('.tskm-side .tskm-pl')].map(x => x.textContent.trim()),
      inMain: [...m.querySelectorAll('.tskm-main .fld > label')].map(x => x.textContent.trim()),
      btn: m.querySelector('.tskm-fb .btn-add').textContent.trim(),
      focused: document.activeElement && document.activeElement.id,
      ids: ['pd2-ttl','pd2-stg','pd2-asg','pd2-tdate','pd2-ttime','pd2-diff-v','pd2-prio-v','pd2-sub','pd2-att-link','pd2-att-name'].filter(i => !document.getElementById(i)) };
  });
  console.log('    ' + JSON.stringify(lay));
  ok('форма открылась и стала широкой', lay && lay.w >= 820, lay && lay.w);
  ok('в хлебных крошках проект, вкладка и колонка', /ARTEL/i.test(lay.crumb) && /ОПЕРАЦИОНКА/i.test(lay.crumb) && /УТВЕРЖДЕНИИ/i.test(lay.crumb), lay.crumb);
  ok('название — крупной строкой', lay.ttlFont >= 20, lay.ttlFont);
  ok('свойства отдельной колонкой справа', lay.sideRight && lay.sameRow, lay);
  ok('в колонке свойств — этап, исполнитель, срок, сложность, приоритет', lay.props.length === 5 && /Этап/.test(lay.props[0]) && /Исполнител/.test(lay.props[1]) && /Срок/.test(lay.props[2]), lay.props);
  ok('слева — подзадачи и материалы', lay.inMain.length === 2 && /Подзадачи/.test(lay.inMain[0]) && /Материалы/.test(lay.inMain[1]), lay.inMain);
  ok('ни одно поле не потерялось', lay.ids.length === 0, lay.ids);
  ok('курсор сразу в названии', lay.focused === 'pd2-ttl', lay.focused);
  ok('кнопка называет действие', /Создать задачу/.test(lay.btn), lay.btn);

  console.log('\n[B] создание работает целиком');
  const created = await page.evaluate(async () => {
    document.getElementById('pd2-ttl').value = 'Снять рилс про кофе';
    _qtDiffPick('pd2-diff', 'hard'); _qtEisenPick('pd2-prio', 'urgent_important');
    document.getElementById('pd2-subnew').value = 'Найти локацию'; pdSubAdd();
    const i = document.getElementById('pd2-att-name'), l = document.getElementById('pd2-att-link');
    i.value = 'Референс 1'; l.value = 'https://youtu.be/abc'; _pdTaskAttAddLink();
    document.getElementById('pd2-tdate').value = '2026-08-09';
    pdAddTask();
    await new Promise(r => setTimeout(r, 200));
    return window.__added[0] || null;
  });
  console.log('    ' + JSON.stringify(created));
  ok('задача ушла в базу с названием и этапом', created && created.row.title === 'Снять рилс про кофе' && created.row.stage_id === 's1', created);
  ok('колонка сохранена — создавали из «на утверждении»', created.row.status === 'review', created.row.status);
  ok('сложность и приоритет записаны', created.row.difficulty === 'hard' && created.row.priority === 'urgent_important', created.row);
  ok('подзадача записана', created.row.subtasks.length === 1 && /локацию/.test(created.row.subtasks[0].title), created.row.subtasks);
  ok('материал записан с именем', created.row.attachments.length === 1 && created.row.attachments[0].name === 'Референс 1', created.row.attachments);
  ok('срок записан', created.row.due_date === '2026-08-09', created.row.due_date);

  console.log('\n[C] правка задачи — та же форма');
  await page.evaluate(async () => { await pdTaskEdit('t1'); });
  await page.waitForTimeout(400);
  const ed = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.tskm');
    return { has: !!m, ttl: document.getElementById('pd2-ttl').value,
      badge: m.querySelector('.tskm-eyebrow span').textContent,
      diff: document.getElementById('pd2-diff-v').value, prio: document.getElementById('pd2-prio-v').value,
      subs: m.querySelectorAll('.subrow').length, atts: m.querySelectorAll('.sch-attitem').length,
      btn: m.querySelector('.tskm-fb .btn-add').textContent.trim(),
      drop: !!document.querySelector('#ov-pd2 .tskm-cols.pd-task-drop') };
  });
  console.log('    ' + JSON.stringify(ed));
  ok('правка открывается в той же форме', ed.has && /правка/i.test(ed.badge), ed);
  ok('поля заполнены значениями задачи', ed.ttl === 'Смонтировать ролик' && ed.diff === 'medium' && ed.prio === 'important', ed);
  ok('подзадачи и материалы на месте', ed.subs === 2 && ed.atts === 1, ed);
  ok('кнопка — «Сохранить»', /Сохранить/.test(ed.btn), ed.btn);
  ok('файл можно бросить на форму', ed.drop, ed);
  const saved = await page.evaluate(async () => {
    document.getElementById('pd2-ttl').value = 'Смонтировать ролик v2';
    pdSaveTask('t1'); await new Promise(r => setTimeout(r, 150));
    return window.__upd[0] || null;
  });
  ok('правка сохраняется', saved && saved.patch.title === 'Смонтировать ролик v2' && saved.patch.subtasks.length === 2, saved);

  console.log('\n[D] узкий экран');
  await page.setViewportSize({ width: 700, height: 900 });
  await page.evaluate(async () => { await pdNewTask('wait'); });
  await page.waitForTimeout(400);
  const narrow = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.tskm');
    const main = m.querySelector('.tskm-main').getBoundingClientRect(), side = m.querySelector('.tskm-side').getBoundingClientRect();
    return { stacked: Math.abs(side.left - main.left) < 3, w: Math.round(m.getBoundingClientRect().width),
      fits: Math.round(m.getBoundingClientRect().width) <= 700 };
  });
  console.log('    ' + JSON.stringify(narrow));
  ok('на узком экране колонки встают друг под друга', narrow.stacked, narrow);
  ok('и форма не вылезает за экран', narrow.fits, narrow);
  await page.evaluate(() => pd2Close());

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[E] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
