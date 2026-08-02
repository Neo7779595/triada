/* probe_stord — порядок этапов проекта меняется мышью и с клавиатуры,
   уходит в базу одной транзакцией и откатывается при отказе. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.toast = t => { window.__toast = String(t); (window.__toasts = window.__toasts || []).push(String(t)); };
  window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true;
  window.agIsPM = () => true; window.agCanDocs = () => true;
  window.giEnsureStatus = async () => ({ status: 'inactive' });
  window.ctBadge = () => ''; window.tLoadProjectWork = null; window.tLoadProjectToday = null;

  /* мок базы: важно не «прошло без ошибки», а что именно улетело в RPC */
  window.__rpc = []; window.__rpcFail = false;
  window.SB = {
    from() { return { select() { return { eq() { return { order: () => Promise.resolve({ data: [], error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }; } }; }, update() { return { eq: () => Promise.resolve({ data: null, error: null }) }; } }; },
    rpc(fn, args) { window.__rpc.push({ fn, args }); return Promise.resolve(window.__rpcFail ? { data: null, error: { message: 'no_edit_permission' } } : { data: null, error: null }); },
  };
  window._pkRerender = () => { if (typeof renderPd === 'function') renderPd(); };
  window._pwReload = async () => {};

  TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null, is_pm: true }];
  const st = (id, name, idx, status) => ({ id, name, idx, status: status || 'wait', project_id: 'p1', due_date: null, due_time: null, assignee_id: null });
  PROJECTS = [{
    id: 'p1', name: 'APOLO COFFEE', logo: 'A', logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0,
    stages: '0 / 4', status: 'active', mrr: 0, cost: 0, tg_chat_id: null, client_id: null, contacts: null, ui: null, kb: null,
    leads: ['m1'], lead_id: 'm1', _todaySec: 0, _appr: [], _reports: [], _tasks: [],
    _stages: [st('s1', 'БРИФ', 0, 'done'), st('s2', 'СЦЕНАРИИ', 1, 'active'), st('s3', 'СЪЁМКА', 2), st('s4', 'МОНТАЖ', 3)],
  }];
  openProject(0); pdTab('stages');
};

const names = () => [...document.querySelectorAll('.pd-stages .pd-st .pd-st-nm')].map(e => e.textContent.trim());
const ids = () => [...document.querySelectorAll('.pd-stages .pd-st')].map(e => e.getAttribute('data-stid'));

/* Перетаскивание руками: dragstart на ручке, dragover над списком, dragend */
const dragTo = (A) => {
  const fromId = A.fromId, toIdx = A.toIdx;
  const box = document.querySelector('.pd-stages');
  const row = box.querySelector('.pd-st[data-stid="' + fromId + '"]');
  const grip = row.querySelector('.pd-grip');
  grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const dt = { effectAllowed: '', dropEffect: '', setData() {}, getData() { return fromId; } };
  row.dispatchEvent(Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer: dt }));
  const others = [...box.querySelectorAll('.pd-st')];
  const target = others[toIdx];
  const r = target.getBoundingClientRect();
  /* целимся чуть выше середины строки-цели — значит встаём перед ней */
  const y = (toIdx > others.indexOf(row)) ? r.top + r.height * 0.9 : r.top + r.height * 0.1;
  box.dispatchEvent(Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), { dataTransfer: dt, clientY: y }));
  row.dispatchEvent(new Event('dragend', { bubbles: true }));
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(400);

  console.log('\n[A] ручка есть у каждого этапа и объясняет себя');
  const grips = await page.evaluate(() => {
    const g = [...document.querySelectorAll('.pd-stages .pd-grip')];
    return { n: g.length, rows: document.querySelectorAll('.pd-stages .pd-st').length,
      title: g[0] && g[0].getAttribute('title'), aria: g[0] && g[0].getAttribute('aria-label'),
      tag: g[0] && g[0].tagName, drag: document.querySelector('.pd-st').getAttribute('draggable') };
  });
  ok('ручка у каждого этапа', grips.n === 4 && grips.rows === 4, grips);
  ok('ручка — кнопка, а не div: доступна с клавиатуры', grips.tag === 'BUTTON', grips.tag);
  ok('подсказка называет оба способа', /Перетащите/.test(grips.title || '') && /↑/.test(grips.title || ''), grips.title);
  ok('экранный диктор слышит номер этапа', /1 из 4/.test(grips.aria || ''), grips.aria);
  ok('строка не draggable, пока ручку не взяли', grips.drag === null, grips.drag);

  console.log('\n[B] перетаскивание меняет порядок и уходит в базу');
  const before = await page.evaluate(names);
  ok('исходный порядок', before.join(',') === 'БРИФ,СЦЕНАРИИ,СЪЁМКА,МОНТАЖ', before);
  await page.evaluate(dragTo, { fromId: 's4', toIdx: 1 });
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    names: [...document.querySelectorAll('.pd-stages .pd-st .pd-st-nm')].map(e => e.textContent.trim()),
    idx: PROJECTS[0]._stages.map(s => s.name + '#' + s.idx),
    rpc: window.__rpc, toast: window.__toast,
    dragging: document.querySelectorAll('.pd-st.dragging').length,
    reordering: document.querySelectorAll('.pd-stages.reordering').length,
    drag: document.querySelector('.pd-st[data-stid="s4"]').getAttribute('draggable'),
  }));
  ok('МОНТАЖ встал вторым', after.names.join(',') === 'БРИФ,МОНТАЖ,СЦЕНАРИИ,СЪЁМКА', after.names);
  ok('idx пересчитан подряд с нуля', after.idx.join(',') === 'БРИФ#0,МОНТАЖ#1,СЦЕНАРИИ#2,СЪЁМКА#3', after.idx);
  ok('вызвана одна RPC перестановки', after.rpc.length === 1 && after.rpc[0].fn === 'reorder_project_stages', after.rpc);
  ok('в RPC ушёл проект и полный порядок', after.rpc[0] && after.rpc[0].args.p_project === 'p1' && after.rpc[0].args.p_ids.join(',') === 's1,s4,s2,s3', after.rpc[0]);
  ok('пользователю сказали, что сохранили', /Порядок этапов сохранён/.test(after.toast || ''), after.toast);
  ok('классы перетаскивания сняты', after.dragging === 0 && after.reordering === 0, after);
  ok('draggable снят после броска', after.drag === null, after.drag);

  console.log('\n[C] перетаскивание на прежнее место в базу не ходит');
  await page.evaluate(() => { window.__rpc = []; });
  await page.evaluate(dragTo, { fromId: 's4', toIdx: 1 });
  await page.waitForTimeout(200);
  const same = await page.evaluate(() => ({ rpc: window.__rpc.length, names: [...document.querySelectorAll('.pd-st .pd-st-nm')].map(e => e.textContent.trim()) }));
  ok('порядок не изменился — запроса нет', same.rpc === 0, same);

  console.log('\n[D] стрелки на ручке делают то же без мыши');
  await page.evaluate(() => { window.__rpc = []; });
  await page.evaluate(() => {
    const g = document.querySelector('.pd-st[data-stid="s2"] .pd-grip'); g.focus();
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(400);
  const kb = await page.evaluate(() => ({
    names: [...document.querySelectorAll('.pd-st .pd-st-nm')].map(e => e.textContent.trim()),
    rpc: window.__rpc, focus: document.activeElement && document.activeElement.closest('.pd-st') && document.activeElement.closest('.pd-st').getAttribute('data-stid'),
    focusIsGrip: document.activeElement && document.activeElement.classList.contains('pd-grip'),
  }));
  ok('стрелка вверх подняла СЦЕНАРИИ', kb.names.join(',') === 'БРИФ,СЦЕНАРИИ,МОНТАЖ,СЪЁМКА', kb.names);
  ok('порядок ушёл в базу', kb.rpc.length === 1 && kb.rpc[0].args.p_ids.join(',') === 's1,s2,s4,s3', kb.rpc);
  ok('фокус остался на той же ручке — можно жать ещё раз', kb.focusIsGrip && kb.focus === 's2', kb);

  console.log('\n[E] на краю списка стрелка ничего не ломает');
  await page.evaluate(() => { window.__rpc = []; });
  await page.evaluate(() => {
    const g = document.querySelector('.pd-st[data-stid="s1"] .pd-grip');
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(150);
  const edge = await page.evaluate(() => ({ rpc: window.__rpc.length, names: [...document.querySelectorAll('.pd-st .pd-st-nm')].map(e => e.textContent.trim()) }));
  ok('первый этап выше не поднимается и запроса не шлёт', edge.rpc === 0 && edge.names[0] === 'БРИФ', edge);

  console.log('\n[F] отказ базы возвращает прежний порядок');
  const revert = await page.evaluate(async () => {
    window.__rpc = []; window.__rpcFail = true;
    const was = PROJECTS[0]._stages.map(s => s.id);
    await window.tStageReorder('p1', ['s4', 's3', 's2', 's1']);
    return { was, now: PROJECTS[0]._stages.map(s => s.id),
      names: [...document.querySelectorAll('.pd-st .pd-st-nm')].map(e => e.textContent.trim()),
      toast: window.__toast };
  });
  ok('порядок откатился к прежнему', revert.now.join(',') === revert.was.join(','), revert);
  ok('на экране тоже прежний порядок', revert.names.join(',') === 'БРИФ,СЦЕНАРИИ,МОНТАЖ,СЪЁМКА', revert.names);
  ok('об ошибке сказали', /Ошибка/.test(revert.toast || ''), revert.toast);

  console.log('\n[G] несохранённый этап не даёт переставлять');
  const tmp = await page.evaluate(async () => {
    window.__rpc = []; window.__rpcFail = false;
    const r = await window.tStageReorder('p1', ['tmp_abc', 's1', 's2', 's3']);
    return { r, rpc: window.__rpc.length, toast: window.__toast };
  });
  ok('запроса нет, пока этап не записан', tmp.rpc === 0 && tmp.r === false, tmp);
  ok('человеку объяснили, почему', /ещё сохраняется/.test(tmp.toast || ''), tmp.toast);

  console.log('\n[H] где переставлять нельзя — ручки нет');
  const off = await page.evaluate(() => {
    PROJECTS[0].status = 'done'; renderPd();
    const doneN = document.querySelectorAll('.pd-grip').length;
    PROJECTS[0].status = 'active';
    const keep = PROJECTS[0]._stages.slice(); PROJECTS[0]._stages = [keep[0]]; renderPd();
    const oneN = document.querySelectorAll('.pd-grip').length;
    PROJECTS[0]._stages = keep;
    window.agCanEditProject = () => false; renderPd();
    const noRightN = document.querySelectorAll('.pd-grip').length;
    window.agCanEditProject = () => true; renderPd();
    return { doneN, oneN, noRightN, backN: document.querySelectorAll('.pd-grip').length };
  });
  ok('в завершённом проекте ручек нет', off.doneN === 0, off.doneN);
  ok('у единственного этапа ручки нет', off.oneN === 0, off.oneN);
  ok('без права на правку ручек нет', off.noRightN === 0, off.noRightN);
  ok('право вернули — ручки вернулись', off.backN === 4, off.backN);

  console.log('\n[I] шаблон этапов услуги переставляется так же');
  const tpl = await page.evaluate(() => {
    window.tplServices = () => ['SMM'];
    window.tariffsForSvc = () => [];
    window.stageSetFor = () => ['БРИФ', 'СЦЕНАРИИ', 'СЪЁМКА', 'МОНТАЖ'];
    document.body.insertAdjacentHTML('beforeend', '<div id="tplw-body"></div>');
    _stplTab = 'tsvc'; _stplSvc = null; _stplStages = [];
    _stplRefresh();
    const vals = () => [...document.querySelectorAll('#stpl-stages .stpl-stage:not(.tpl-newst) input')].map(e => e.value);
    const rows = () => [...document.querySelectorAll('#stpl-stages .stpl-stage:not(.tpl-newst)')];
    const out = { grips: document.querySelectorAll('#stpl-stages .stpl-grip:not(.empty)').length, before: vals() };

    /* стрелка вниз на первом */
    document.querySelectorAll('#stpl-stages .stpl-grip:not(.empty)')[0]
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    out.afterKey = vals();
    out.focusIdx = [...document.querySelectorAll('#stpl-stages .stpl-grip:not(.empty)')].indexOf(document.activeElement);

    /* правка текста, затем перетаскивание последнего наверх: текст обязан уехать вместе со строкой */
    const inps = () => [...document.querySelectorAll('#stpl-stages .stpl-stage:not(.tpl-newst) input')];
    inps()[3].value = 'МОНТАЖ 4K'; inps()[3].dispatchEvent(new Event('input', { bubbles: true }));
    const last = rows()[3];
    last.querySelector('.stpl-grip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const dt = { effectAllowed: '', dropEffect: '', setData() {}, getData: () => '3' };
    last.dispatchEvent(Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer: dt }));
    const t = rows()[0].getBoundingClientRect();
    document.getElementById('stpl-stages').dispatchEvent(
      Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), { dataTransfer: dt, clientY: t.top + 2 }));
    last.dispatchEvent(new Event('dragend', { bubbles: true }));
    out.afterDrag = vals(); out.arr = _stplStages.slice();
    out.nums = [...document.querySelectorAll('#stpl-stages .stpl-stnum:not(.plus)')].map(e => e.textContent);
    out.draggable = rows().map(e => e.getAttribute('draggable'));

    /* один этап — переставлять не с чем */
    _stplStages = ['ЕДИНСТВЕННЫЙ']; _stplRefresh();
    out.oneGrip = document.querySelectorAll('#stpl-stages .stpl-grip:not(.empty)').length;
    return out;
  });
  ok('ручка у каждой строки шаблона', tpl.grips === 4, tpl.grips);
  ok('стрелка вниз опустила первый этап', tpl.afterKey.join(',') === 'СЦЕНАРИИ,БРИФ,СЪЁМКА,МОНТАЖ', tpl.afterKey);
  ok('фокус поехал за этапом', tpl.focusIdx === 1, tpl.focusIdx);
  ok('перетаскивание подняло последний наверх', tpl.afterDrag.join(',') === 'МОНТАЖ 4K,СЦЕНАРИИ,БРИФ,СЪЁМКА', tpl.afterDrag);
  ok('несохранённая правка текста уехала вместе со строкой', tpl.arr.join(',') === 'МОНТАЖ 4K,СЦЕНАРИИ,БРИФ,СЪЁМКА', tpl.arr);
  ok('номера пересчитаны', tpl.nums.join(',') === '1,2,3,4', tpl.nums);
  ok('draggable снят после броска', tpl.draggable.every(v => v === null), tpl.draggable);
  ok('у единственного этапа ручки нет', tpl.oneGrip === 0, tpl.oneGrip);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
