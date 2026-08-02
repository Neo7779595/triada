/* probe_pjset — окно настроек проекта: тот же каркас, права, поздние ответы, patch */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* Единственная дверь наружу — клиент Supabase. Подменяем его целиком: цепочка
   .select().eq().order().maybeSingle() и .delete()/.insert()/.upsert() ведут
   себя как настоящие, но отвечают из памяти и с заданной задержкой. */
const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'detroyd' };
  window.tMe = () => window.__me;
  window.__toasts = []; window.toast = t => { window.__toasts.push(t); };
  window.LIVE = false;
  window.renderTeam = () => {};
  window.renderProjects = () => {};
  window.__upd = null;
  window.tProjectUpdate = (id, patch) => { window.__upd = { id, patch }; if (typeof pd2Close === 'function') pd2Close(); };
  window.__renew = null;
  window.tProjectRenew = (id, s, e, nm) => { window.__renew = { id, s, e, nm }; };
  window.__db = { members: [], services: [], contract: null, delay: 0, ops: [] };

  window.SB = { from(table) {
    const st = { table, op: 'select', payload: null, single: false };
    const wait = () => new Promise(r => setTimeout(r, window.__db.delay || 0));
    const run = () => {
      window.__db.ops.push({ table: st.table, op: st.op, payload: st.payload });
      if (st.op !== 'select') return Promise.resolve({ data: null, error: null });
      return wait().then(() => {
        if (st.table === 'project_members') return { data: window.__db.members.slice(), error: null };
        if (st.table === 'project_services') return { data: window.__db.services.slice(), error: null };
        if (st.table === 'project_contracts') return { data: window.__db.contract, error: null };
        return { data: null, error: null };
      });
    };
    const q = {
      select() { st.op = 'select'; return q; },
      eq() { return q; }, order() { return q; },
      maybeSingle() { st.single = true; return q; },
      delete() { st.op = 'delete'; return q; },
      insert(rows) { st.op = 'insert'; st.payload = rows; return q; },
      upsert(row) { st.op = 'upsert'; st.payload = row; return q; },
      update(row) { st.op = 'update'; st.payload = row; return q; },
      then(res, rej) { return run().then(res, rej); },
    };
    return q;
  } };

  TEAM = [
    { _id: 'm1', name: 'Пётр Смирнов', role: 'Проект-менеджер', color: '#8A8FFF', dept: 'Продакшн', is_pm: true },
    { _id: 'm2', name: 'Аня Ким', role: 'Дизайнер', color: '#E3B567', dept: 'Дизайн' },
    { _id: 'm3', name: 'Игорь Лу', role: 'Таргетолог', color: '#5CC8F0', dept: 'Трафик' },
  ];
};

const mkProj = () => {
  PROJECTS = [{
    id: 'p1', name: 'APOLO COFFEE', logo: 'A', logoUrl: '', cat: 'Кофейня',
    svc: 'SMM', tariff: 'Gold', mrr: 12000000, cost: 3000000, status: 'active',
    note: 'Отчёты по понедельникам', leads: ['m1', 'm3'], lead_id: 'm1',
    cl_hidden: ['board'], createdAt: '2026-04-12T10:00:00Z',
    _team: [{ _id: 'm2', name: 'Аня Ким', color: '#E3B567' }],
    _svcs: [{ service: 'SMM', tariff: 'Gold', mrr: 12000000, cost: 3000000, status: 'active' }],
    _contract: { start: '2026-05-01', end: '2026-08-01' },
  }];
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  /* В headless кадры рисуются только по запросу — переходы и rAF стоят на месте,
     пока их не попросишь. Это про стенд, не про продукт. */
  const frames = async (n = 4) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  const open = async () => { await page.evaluate(() => { if (typeof pd2Close === 'function') pd2Close(); mkProj(); projSettings(0); }); await page.waitForTimeout(300); };
  const sec = () => page.evaluate(() => { const e = document.querySelector('#npw-nav .npw-nav-i.on'); return e ? e.dataset.sec : null; });

  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.evaluate(setup);
  await page.evaluate('window.mkProj = ' + mkProj.toString());
  await page.addStyleTag({ content: '#ov-pd2 .npw-body{scroll-behavior:auto!important}' });

  /* ——— A. кто может открыть и кто может удалить ——— */
  console.log('\n[A] права');
  const tryOpen = who => page.evaluate(w => {
    if (typeof pd2Close === 'function') pd2Close();
    window.__me = Object.assign({ id: 'u1', full_name: 'X', agency_id: 'AG' }, w);
    mkProj(); window.__toasts = []; projSettings(0);
    return { open: !!document.querySelector('#ov-pd2 .modal.npw'), toast: window.__toasts[0] || null,
      del: !!document.querySelector('.npw-danger-b'), foot: !!document.querySelector('.npw-foot-del') };
  }, who);
  let r = await tryOpen({ role: 'agency_owner' });
  ok('владелец агентства открывает окно', r.open === true, r);
  ok('и видит удаление проекта', r.del && r.foot, r);
  r = await tryOpen({ role: 'member', is_director: true });
  ok('директор открывает окно', r.open === true, r);
  ok('и тоже видит удаление', r.del === true, r);
  r = await tryOpen({ id: 'm1', role: 'member', is_pm: true });
  ok('ответственный PM открывает окно', r.open === true, r);
  ok('но удаление ему не показано', r.del === false && r.foot === false, r);
  r = await tryOpen({ id: 'm3', role: 'member', is_pm: true });
  ok('чужой PM окна не видит', r.open === false, r);
  ok('и получает прежний ответ', r.toast === 'Редактировать могут владелец агентства и ответственный проект-менеджер', r.toast);
  r = await tryOpen({ id: 'm2', role: 'member' });
  ok('рядовой сотрудник окна не видит', r.open === false && r.toast === 'Редактировать могут владелец агентства и ответственный проект-менеджер', r);
  await page.evaluate(() => { window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'detroyd' }; });

  /* ——— B. окно заполнено из проекта ——— */
  console.log('\n[B] окно заполнено из проекта');
  await open();
  const f = await page.evaluate(() => ({
    name: document.getElementById('pj-name').value,
    cat: document.getElementById('pj-cat').value,
    note: document.getElementById('pj-note').value,
    leads: [...document.querySelectorAll('#pj-leads .np-chip')].map(c => c.dataset.lid),
    team: npSelectedTeam(),
    svcs: (window.NP_SVCS || []).map(s => s.service + '/' + s.tariff + '/' + s.mrr),
    ct: [document.getElementById('np-cstart').value, document.getElementById('np-cend').value],
    hidden: [...document.querySelectorAll('#pj-clvis .cl-vis-tog')].filter(x => !x.classList.contains('on')).map(x => x.dataset.mk),
    status: document.querySelector('#pj-stseg button.on').dataset.st,
  }));
  ok('название на месте', f.name === 'APOLO COFFEE', f.name);
  ok('категория на месте', f.cat === 'Кофейня', f.cat);
  ok('заметка на месте', f.note === 'Отчёты по понедельникам', f.note);
  ok('ответственные в прежнем порядке', f.leads.join(',') === 'm1,m3', f.leads);
  ok('команда проекта на месте', f.team.join(',') === 'm2', f.team);
  ok('услуги на месте', f.svcs.join(',') === 'SMM/Gold/12000000', f.svcs);
  ok('срок договора на месте', f.ct.join('→') === '2026-05-01→2026-08-01', f.ct);
  ok('скрытые от клиента разделы на месте', f.hidden.join(',') === 'board', f.hidden);
  ok('статус на месте', f.status === 'active', f.status);
  ok('логотип берётся из проекта', await page.evaluate(() => document.getElementById('pj-logo').value) === '');

  /* ——— C. один каркас с окном создания ——— */
  console.log('\n[C] тот же каркас, что у создания');
  const shell = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.npw');
    return { npw: !!m, edit: m.classList.contains('npw-edit'),
      top: !!document.querySelector('.npw-top'), nav: !!document.getElementById('npw-nav'),
      pill: !!document.getElementById('npw-pill'), body: !!document.getElementById('npw-body'),
      foot: !!document.querySelector('.npw-foot'), save: document.getElementById('npw-save').textContent,
      secs: [...document.querySelectorAll('#npw-nav .npw-nav-i')].map(x => x.dataset.sec) };
  });
  ok('окно собрано на общем каркасе .npw', shell.npw && shell.edit, shell);
  ok('шапка, навигация, тело и подвал те же', shell.top && shell.nav && shell.pill && shell.body && shell.foot, shell);
  ok('шесть разделов в навигации', shell.secs.join(',') === 'main,svc,team,plan,client,status', shell.secs);
  ok('кнопка сохранения подписана «Сохранить»', shell.save === 'Сохранить', shell.save);
  /* каркас один на два окна: сравниваем не исходник, а то, что получилось —
     скелет шапки, навигации и подвала должен совпасть до класса */
  const skel = sel => page.evaluate(s => {
    const m = document.querySelector('#ov-pd2 .modal.npw'); if (!m) return null;
    const pick = el => el ? [...el.children].map(c => c.tagName.toLowerCase() + '.' + (c.className || '') + '#' + (c.id || '')).join('|') : '';
    return { top: pick(m.querySelector('.npw-top')), nav: pick(m.querySelector('.npw-nav')).replace(/button\.npw-nav-i#/g, 'i'),
      main: pick(m.querySelector('.npw-main')), foot: pick(m.querySelector('.npw-foot')).replace(/^button\.btn-ghost npw-foot-del#\|/, '') };
  }, sel);
  const sSet = await skel();
  await page.evaluate(() => { pd2Close(); openNewProject(); });
  await page.waitForTimeout(320);
  const sNew = await skel();
  ok('шапка у обоих окон собрана одинаково', sSet.top.replace(/\|span\.npw-badge#npw-badge/, '') === sNew.top, [sSet.top, sNew.top]);
  ok('каркас «навигация + тело» одинаков', sSet.main === sNew.main, [sSet.main, sNew.main]);
  ok('подвал одинаков', sSet.foot === sNew.foot, [sSet.foot, sNew.foot]);
  const navShape = x => x.replace(/(i\|)+/, 'i*');
  ok('навигация построена одним генератором', navShape(sSet.nav) === navShape(sNew.nav), [sSet.nav, sNew.nav]);
  ok('в настройках на один пункт больше — «Статус и заметка»',
    (sSet.nav.match(/\bi\b/g) || []).length === (sNew.nav.match(/\bi\b/g) || []).length + 1,
    [sSet.nav, sNew.nav]);
  await open();

  /* ——— D. шапка живая ——— */
  console.log('\n[D] шапка');
  const money = async () => (await page.evaluate(() => document.getElementById('npw-money').textContent)).replace(/\s| | /g, '');
  ok('доход в шапке = 12 000 000', await money() === '12000000', await money());
  ok('имя проекта в шапке', await page.evaluate(() => document.getElementById('npw-name').textContent) === 'APOLO COFFEE');
  ok('под именем категория и главный ответственный',
    await page.evaluate(() => document.getElementById('npw-sub').textContent) === 'Кофейня · Пётр Смирнов',
    await page.evaluate(() => document.getElementById('npw-sub').textContent));
  ok('чип состояния — «В работе»', await page.evaluate(() => document.getElementById('pj-hchip').textContent) === 'В работе');
  ok('рядом написано, с какого дня живёт проект',
    /^с 12 апр 2026 · /.test(await page.evaluate(() => document.querySelector('.npw-age').textContent)),
    await page.evaluate(() => document.querySelector('.npw-age').textContent));
  await page.fill('#pj-name', 'APOLO COFFEE BAR');
  await page.waitForTimeout(120);
  ok('правка названия уезжает в шапку', await page.evaluate(() => document.getElementById('npw-name').textContent) === 'APOLO COFFEE BAR');
  ok('и в карточку предпросмотра', await page.evaluate(() => document.getElementById('npw-card-nm').textContent) === 'APOLO COFFEE BAR');

  /* ——— E. услуги и деньги ——— */
  console.log('\n[E] услуги и деньги');
  await page.evaluate(() => { svcAdd(); svcSet(1, 'service', 'PROD'); window.NP_SVCS[1].mrr = 4500000; svcRender(); });
  await page.waitForTimeout(150);
  ok('вторая услуга добавилась', await page.evaluate(() => document.querySelectorAll('#svc-list .svc-row').length) === 2);
  ok('доход в шапке стал 16 500 000', await money() === '16500000', await money());
  ok('счётчик услуг в навигации 2', await page.evaluate(() => document.getElementById('npw-c-svc').textContent) === '2');
  ok('в подвале тот же итог',
    /Доход 16500000 · услуг 2/.test((await page.evaluate(() => document.getElementById('npw-sum').textContent)).replace(/\s| | /g, ' ').replace(/(\d) (?=\d)/g, '$1')),
    await page.evaluate(() => document.getElementById('npw-sum').textContent));
  ok('основной становится услуга с наибольшим доходом', await page.evaluate(() => svcPrimary(svcCollect()).service) === 'SMM');
  await page.evaluate(() => { window.NP_SVCS[1].mrr = 20000000; svcRender(); });
  await page.waitForTimeout(120);
  ok('перевес дохода меняет основную услугу', await page.evaluate(() => svcPrimary(svcCollect()).service) === 'PROD');
  await page.evaluate(() => svcDel(1));
  await page.waitForTimeout(150);
  ok('удаление строки возвращает доход к 12 000 000', await money() === '12000000', await money());

  /* ——— F. ответственные ——— */
  console.log('\n[F] ответственные');
  ok('первый в списке помечен звездой', await page.evaluate(() =>
    !!document.querySelector('#pj-leads .np-chip[data-main="1"] .np-chip-main')));
  ok('у остальных звезда кликабельная', await page.evaluate(() =>
    document.querySelectorAll('#pj-leads .np-chip-star').length) === 1);
  await page.evaluate(() => pjLeadMakePrimary('m3'));
  await page.waitForTimeout(250);
  ok('«сделать главным» ставит чип первым', await page.evaluate(() => (window.NP_LEADS || []).join(',')) === 'm3,m1');
  ok('и шапка называет нового главного',
    await page.evaluate(() => document.getElementById('npw-sub').textContent) === 'Кофейня · Игорь Лу',
    await page.evaluate(() => document.getElementById('npw-sub').textContent));
  ok('счётчик людей = ответственные + команда', await page.evaluate(() => document.getElementById('npw-c-team').textContent) === '3');
  await page.evaluate(() => pjLeadRemove('m1'));
  await page.waitForTimeout(150);
  ok('крестик убирает ответственного', await page.evaluate(() => (window.NP_LEADS || []).join(',')) === 'm3');
  await page.evaluate(() => { window.NP_LEADS = []; pjRenderLeads(); });
  await page.waitForTimeout(120);
  ok('без ответственных окно об этом предупреждает', await page.evaluate(() =>
    getComputedStyle(document.getElementById('pj-leads-empty')).display) !== 'none');
  await page.evaluate(() => { window.NP_LEADS = ['m1', 'm3']; pjRenderLeads(); });
  await page.waitForTimeout(120);

  /* ——— G. видимость для клиента ——— */
  console.log('\n[G] видимость для клиента');
  ok('семь разделов', await page.evaluate(() => document.querySelectorAll('#pj-clvis .cl-vis-tog').length) === 7);
  ok('сводки в списке нет — её скрыть нельзя', await page.evaluate(() =>
    [...document.querySelectorAll('#pj-clvis .cl-vis-tog')].every(x => x.dataset.mk !== 'overview')));
  ok('счётчик показывает 6 из 7', await page.evaluate(() => document.getElementById('pj-clvis-cnt').textContent) === 'Клиенту открыто 6 из 7');
  ok('и он же стоит в навигации', await page.evaluate(() => document.getElementById('npw-c-client').textContent) === '6/7');
  await page.click('#pj-clvis .cl-vis-tog[data-mk="content"]');
  await page.waitForTimeout(150);
  ok('переключатель гасит раздел', await page.evaluate(() => pjClHidden().sort().join(',')) === 'board,content');
  ok('счётчик пересчитался', await page.evaluate(() => document.getElementById('pj-clvis-cnt').textContent) === 'Клиенту открыто 5 из 7');
  await page.click('.npw-vis-h button:nth-of-type(2)');
  await page.waitForTimeout(200);
  ok('«Только отчёты» оставляет один раздел', await page.evaluate(() => pjClVisOpen()) === 1);
  ok('и открыт именно «Отчёты»', await page.evaluate(() =>
    document.querySelector('#pj-clvis .cl-vis-tog.on').dataset.mk) === 'reports');
  await page.click('.npw-vis-h button:nth-of-type(1)');
  await page.waitForTimeout(200);
  ok('«Открыть всё» включает все семь', await page.evaluate(() => pjClVisOpen()) === 7);
  ok('и скрытых не остаётся', await page.evaluate(() => pjClHidden().length) === 0);
  await page.click('#pj-clvis .cl-vis-tog[data-mk="board"]');
  await page.waitForTimeout(150);

  /* ——— H. сроки ——— */
  console.log('\n[H] сроки');
  ok('длительность посчитана словами', /3 месяца · 92 дня/.test(await page.evaluate(() => document.getElementById('npw-dur').textContent)),
    await page.evaluate(() => document.getElementById('npw-dur').textContent));
  ok('подсвечен пресет «3 мес»', await page.evaluate(() =>
    document.querySelector('#npw-presets button.on').dataset.m) === '3');
  await page.evaluate(() => npwPreset(6));
  await page.waitForTimeout(180);
  ok('пресет 6 мес двигает окончание от начала', await page.evaluate(() => document.getElementById('np-cend').value) === '2026-11-01');
  ok('счётчик срока в навигации обновился', await page.evaluate(() => document.getElementById('npw-c-plan').textContent) === '6 мес');
  await page.evaluate(() => dpPick('np-cend', '2026-04-01'));
  await page.waitForTimeout(180);
  ok('окончание раньше начала названо ошибкой',
    await page.evaluate(() => document.getElementById('npw-dur').textContent) === 'Окончание раньше начала',
    await page.evaluate(() => document.getElementById('npw-dur').textContent));
  await page.evaluate(() => dpPick('np-cend', '2026-08-01'));
  await page.waitForTimeout(150);

  /* ——— I. статус ——— */
  console.log('\n[I] статус');
  await page.click('#pj-stseg button[data-st="done"]');
  await page.waitForTimeout(180);
  ok('чип в шапке стал «Завершён»', await page.evaluate(() => document.getElementById('pj-hchip').textContent) === 'Завершён');
  ok('и окно предупреждает про архив', await page.evaluate(() =>
    document.getElementById('pj-st-warn').classList.contains('on') && /архив/.test(document.getElementById('pj-st-warn').textContent)));
  await page.click('#pj-stseg button[data-st="active"]');
  await page.waitForTimeout(180);
  ok('возврат к прежнему статусу убирает предупреждение', await page.evaluate(() =>
    !document.getElementById('pj-st-warn').classList.contains('on')));

  /* ——— J. навигация ——— */
  console.log('\n[J] навигация');
  await page.evaluate(() => { document.getElementById('npw-body').scrollTop = 0; npwGo('client'); });
  await page.waitForTimeout(200);
  ok('клик по пункту ставит раздел под шапку', await page.evaluate(() => {
    const b = document.getElementById('npw-body'), s = document.getElementById('npw-s-client');
    return Math.abs(s.getBoundingClientRect().top - b.getBoundingClientRect().top - 8) < 24;
  }));
  ok('активен пункт «Доступ клиента»', await sec() === 'client');
  await page.waitForTimeout(600); await frames();
  ok('подложка легла ровно на активную кнопку', await page.evaluate(() => {
    const p = document.getElementById('npw-pill').getBoundingClientRect();
    const a = document.querySelector('#npw-nav .npw-nav-i.on').getBoundingClientRect();
    return Math.abs(p.top - a.top) <= 1.5 && Math.abs(p.bottom - a.bottom) <= 1.5;
  }), await page.evaluate(() => {
    const p = document.getElementById('npw-pill').getBoundingClientRect();
    const a = document.querySelector('#npw-nav .npw-nav-i.on').getBoundingClientRect();
    return { dTop: +(p.top - a.top).toFixed(2), dBot: +(p.bottom - a.bottom).toFixed(2) };
  }));
  await page.evaluate(() => { document.getElementById('npw-body').scrollTop = 0; });
  await page.waitForTimeout(250); await frames();
  ok('прокрутка наверх возвращает «Основное»', await sec() === 'main');
  const sticky = await page.evaluate(() => [...document.querySelectorAll('#npw-body *')]
    .filter(el => getComputedStyle(el).position === 'sticky').map(el => String(el.className)));
  ok('липкая только шапка таблицы услуг', sticky.length === 1 && /svc-head/.test(sticky[0]), sticky);
  const scrollers = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#ov-pd2 .modal.npw *').forEach(el => {
      if (el.scrollHeight - el.clientHeight > 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) out.push(el.id || String(el.className));
    });
    return out;
  });
  ok('по вертикали скроллится только тело окна', scrollers.length === 1 && scrollers[0] === 'npw-body', scrollers);

  /* ——— K. валидация ——— */
  console.log('\n[K] валидация');
  await open();
  await page.evaluate(() => { document.getElementById('pj-name').value = ''; window.__toasts = []; pjSaveSettings(0); });
  await page.waitForTimeout(350);
  ok('без названия не сохраняет', await page.evaluate(() => window.__toasts[0]) === 'Введи название проекта');
  ok('увело к разделу «Основное»', await sec() === 'main');
  ok('поле подсвечено', await page.evaluate(() => document.getElementById('pj-name').closest('.fld').classList.contains('err')));
  ok('точка тревоги в навигации', await page.evaluate(() => document.getElementById('npw-c-main').classList.contains('bad')));
  ok('окно осталось открытым', await page.evaluate(() => !!document.querySelector('#ov-pd2 .modal.npw')));
  await page.fill('#pj-name', 'APOLO COFFEE');
  await page.waitForTimeout(120);
  ok('ошибка гаснет при вводе', await page.evaluate(() => !document.getElementById('pj-name').closest('.fld').classList.contains('err')));
  await page.evaluate(() => { svcReset([{ service: '', tariff: '', mrr: 0, cost: 0 }]); window.__toasts = []; pjSaveSettings(0); });
  await page.waitForTimeout(350);
  ok('без услуг не сохраняет', await page.evaluate(() => window.__toasts[0]) === 'Оставь хотя бы одну услугу');
  ok('увело к разделу «Услуги и деньги»', await sec() === 'svc');
  ok('объяснение под редактором видно', await page.evaluate(() => document.getElementById('err-np-svc').style.display) === 'block');
  await page.evaluate(() => {
    svcReset([{ service: 'SMM', tariff: 'Gold', mrr: 12000000, cost: 3000000 }]);
    dpPick('np-cend', '2026-01-01'); window.__toasts = []; pjSaveSettings(0);
  });
  await page.waitForTimeout(350);
  ok('окончание раньше начала не сохраняет', await page.evaluate(() => window.__toasts[0]) === 'Окончание договора раньше начала');
  ok('увело к разделу «Сроки»', await sec() === 'plan');
  ok('поле окончания подсвечено', await page.evaluate(() =>
    document.getElementById('np-cend').closest('.fld').classList.contains('err')));

  /* ——— L. поздние ответы не затирают правку ——— */
  console.log('\n[L] поздние ответы');
  await page.evaluate(() => {
    window.LIVE = true; window.__db.delay = 600; window.__db.ops = [];
    window.__db.members = [{ member_id: 'm3' }];
    window.__db.services = [{ id: 's9', service: 'DESIGN', tariff: 'Silver', mrr: 999, cost: 0, status: 'active', sort: 0 }];
    window.__db.contract = { start_date: '2027-01-01', end_date: '2027-06-01' };
    if (typeof pd2Close === 'function') pd2Close(); mkProj(); projSettings(0);
  });
  await page.waitForTimeout(120);
  ok('пока ответы в пути, видно загрузку услуг', await page.evaluate(() =>
    document.getElementById('pj-load-svc').classList.contains('on')));
  ok('и загрузку команды', await page.evaluate(() => document.getElementById('pj-load-team').classList.contains('on')));
  ok('и загрузку срока', await page.evaluate(() => document.getElementById('pj-load-ct').classList.contains('on')));
  /* правим все три блока ДО ответа сервера */
  await page.evaluate(() => {
    svcSet(0, 'service', 'SMM'); window.NP_SVCS[0].mrr = 7000000; svcRender();
    npChipRemove('m2');
    dpPick('np-cend', '2026-09-15');
  });
  await page.waitForTimeout(900);
  const kept = await page.evaluate(() => ({
    svc: svcCollect().map(s => s.service + '/' + s.mrr).join(','),
    team: npSelectedTeam().join(','),
    end: document.getElementById('np-cend').value,
    loadOff: !document.getElementById('pj-load-svc').classList.contains('on'),
  }));
  ok('правка услуг пережила ответ сервера', kept.svc === 'SMM/7000000', kept.svc);
  ok('снятый из команды не вернулся', kept.team === '', kept.team);
  ok('правка срока пережила ответ сервера', kept.end === '2026-09-15', kept.end);
  ok('загрузка погасла', kept.loadOff === true);
  /* а в нетронутое окно поздние данные ложатся */
  await page.evaluate(() => { if (typeof pd2Close === 'function') pd2Close(); mkProj(); projSettings(0); });
  await page.waitForTimeout(1000);
  const landed = await page.evaluate(() => ({
    svc: svcCollect().map(s => s.service + '/' + s.mrr).join(','),
    team: npSelectedTeam().join(','),
    ct: [document.getElementById('np-cstart').value, document.getElementById('np-cend').value].join('→'),
  }));
  ok('в нетронутое окно услуги приезжают с сервера', landed.svc === 'DESIGN/999', landed.svc);
  ok('и состав команды тоже', landed.team === 'm3', landed.team);
  ok('и срок договора тоже', landed.ct === '2027-01-01→2027-06-01', landed.ct);
  ok('приехавшее не считается правкой человека', await page.evaluate(() => {
    npwTryClose();
    const asked = document.getElementById('ov-npclose').classList.contains('on');
    if (asked) npwCloseAsk(0);
    return !asked;
  }));
  await page.evaluate(() => { window.__db.delay = 0; });

  /* ——— M. сохранение в бою ——— */
  console.log('\n[M] сохранение в бою');
  await page.evaluate(() => {
    window.LIVE = true; window.__db.members = []; window.__db.services = []; window.__db.contract = null;
    if (typeof pd2Close === 'function') pd2Close(); mkProj(); projSettings(0);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__db.ops = []; window.__upd = null;
    document.getElementById('pj-name').value = 'APOLO BAR';
    document.getElementById('pj-note').value = 'новая заметка';
    window.NP_LEADS = ['m3', 'm1']; pjRenderLeads();
    window.NP_TEAM = new Set(['m2', 'm3']); npRenderTeam();
    svcReset([{ service: 'SMM', tariff: 'Gold', mrr: 12000000, cost: 3000000 },
              { service: 'PROD', tariff: 'Silver', mrr: 4500000, cost: 1000000 }]);
    document.querySelector('#pj-clvis .cl-vis-tog[data-mk="passport"]').click();
    pjSaveSettings(0);
  });
  await page.waitForTimeout(500);
  const upd = await page.evaluate(() => window.__upd);
  const ops = await page.evaluate(() => window.__db.ops);
  ok('tProjectUpdate вызван с id проекта', upd && upd.id === 'p1', upd && upd.id);
  ok('в patch те же ключи и в том же порядке',
    upd && Object.keys(upd.patch).slice(0, 12).join(',') === 'name,logo_url,category,service,tariff,mrr,cost,lead_id,leads,status,cl_hidden,note',
    upd && Object.keys(upd.patch));
  ok('и статус «в работе» по-прежнему обнуляет closed_at', upd && upd.patch.closed_at === null, upd && upd.patch.closed_at);
  ok('главный ответственный уходит в lead_id', upd && upd.patch.lead_id === 'm3', upd && upd.patch.lead_id);
  ok('весь список — в leads', upd && upd.patch.leads.join(',') === 'm3,m1', upd && upd.patch.leads);
  ok('основная услуга и её тариф — с наибольшего дохода',
    upd && upd.patch.service === 'SMM' && upd.patch.tariff === 'Gold', upd && [upd.patch.service, upd.patch.tariff]);
  ok('доход = сумме услуг', upd && upd.patch.mrr === 16500000, upd && upd.patch.mrr);
  ok('расход = сумме расходов', upd && upd.patch.cost === 4000000, upd && upd.patch.cost);
  ok('выключенные разделы уходят в cl_hidden',
    upd && upd.patch.cl_hidden.slice().sort().join(',') === 'board,passport', upd && upd.patch.cl_hidden);
  ok('заметка сохраняется вместе с карточкой', upd && upd.patch.note === 'новая заметка', upd && upd.patch.note);
  ok('состав команды переписывается: сначала delete, потом insert',
    ops.filter(o => o.table === 'project_members').map(o => o.op).join(',') === 'delete,insert',
    ops.filter(o => o.table === 'project_members').map(o => o.op));
  ok('услуги переписываются так же', ops.filter(o => o.table === 'project_services').map(o => o.op).join(',') === 'delete,insert',
    ops.filter(o => o.table === 'project_services').map(o => o.op));
  ok('у услуг проставлен порядок', (() => {
    const ins = ops.find(o => o.table === 'project_services' && o.op === 'insert');
    return ins && ins.payload.map(x => x.sort).join(',') === '0,1';
  })(), ops.find(o => o.table === 'project_services' && o.op === 'insert'));
  ok('срок договора кладётся upsert-ом', ops.some(o => o.table === 'project_contracts' && o.op === 'upsert'),
    ops.filter(o => o.table === 'project_contracts'));
  ok('окно закрылось после сохранения', await page.evaluate(() => !document.querySelector('#ov-pd2 .modal.npw')));

  /* ——— N. возврат из архива сверх лимита ——— */
  console.log('\n[N] возврат из архива');
  await page.evaluate(() => {
    window.agPlanLimit = () => ({ limit: 3, name: 'Gold', key: 'gold' });
    window.agProjUsed = () => 3;
    window.agReloadProjCount = async () => {};
    window.LIVE = true;
    if (typeof pd2Close === 'function') pd2Close();
    mkProj(); PROJECTS[0].status = 'done'; projSettings(0);
  });
  await page.waitForTimeout(300);
  ok('у завершённого проекта чип «Завершён»', await page.evaluate(() => document.getElementById('pj-hchip').textContent) === 'Завершён');
  await page.evaluate(() => { window.__db.ops = []; window.__upd = null; window.__renew = null; });
  await page.click('#pj-stseg button[data-st="active"]');
  await page.waitForTimeout(150);
  await page.evaluate(() => pjSaveSettings(0));
  await page.waitForTimeout(400);
  ok('открылась прежняя модалка лимита',
    /Не влезает в лимит тарифа/.test(await page.evaluate(() => (document.querySelector('#ov-pd2 .modal h3') || {}).textContent || '')),
    await page.evaluate(() => (document.querySelector('#ov-pd2 .modal h3') || {}).textContent));
  ok('и ничего не сохранилось', await page.evaluate(() => window.__upd) === null);
  ok('и ни одной записи в базу не ушло', (await page.evaluate(() => window.__db.ops)).length === 0);
  await page.evaluate(() => { window.agProjUsed = () => 1; if (typeof pd2Close === 'function') pd2Close(); mkProj(); PROJECTS[0].status = 'done'; projSettings(0); });
  await page.waitForTimeout(300);
  await page.click('#pj-stseg button[data-st="active"]');
  await page.waitForTimeout(120);
  await page.evaluate(() => pjSaveSettings(0));
  await page.waitForTimeout(350);
  ok('в лимит влезаем — спрашивают про новый цикл',
    /Вернуть проект в работу/.test(await page.evaluate(() => (document.querySelector('#ov-pd2 .modal h3') || {}).textContent || '')),
    await page.evaluate(() => (document.querySelector('#ov-pd2 .modal h3') || {}).textContent));
  await page.evaluate(() => pjDoReactivate());
  await page.waitForTimeout(350);
  ok('подтверждение запускает новый цикл', await page.evaluate(() => !!window.__renew));

  /* ——— O. демо-режим ——— */
  console.log('\n[O] демо-режим');
  await page.evaluate(() => {
    window.LIVE = false; if (typeof pd2Close === 'function') pd2Close();
    mkProj(); projSettings(0);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.getElementById('pj-name').value = 'APOLO DEMO';
    document.getElementById('pj-note').value = 'заметка демо';
    window.__toasts = []; pjSaveSettings(0);
  });
  await page.waitForTimeout(350);
  const demo = await page.evaluate(() => ({ name: PROJECTS[0].name, note: PROJECTS[0].note,
    toast: window.__toasts[0], open: !!document.querySelector('#ov-pd2 .modal.npw') }));
  ok('проект обновился в памяти', demo.name === 'APOLO DEMO', demo.name);
  ok('заметка тоже', demo.note === 'заметка демо', demo.note);
  ok('прежний тост на месте', demo.toast === 'Проект обновлён', demo.toast);
  ok('окно закрылось', demo.open === false);

  /* ——— P. закрытие ——— */
  console.log('\n[P] закрытие');
  await open();
  await page.evaluate(() => npwTryClose());
  await page.waitForTimeout(200);
  ok('нетронутую карточку закрывает сразу', await page.evaluate(() =>
    !document.querySelector('#ov-pd2 .modal.npw') && !document.getElementById('ov-npclose').classList.contains('on')));
  await open();
  await page.fill('#pj-name', 'APOLO 2');
  await page.waitForTimeout(120);
  await page.click('.npw-x');
  await page.waitForTimeout(250);
  ok('изменённая — спрашивает', await page.evaluate(() => document.getElementById('ov-npclose').classList.contains('on')));
  ok('и окно ещё открыто', await page.evaluate(() => !!document.querySelector('#ov-pd2 .modal.npw')));
  ok('текст вопроса — про правки, а не про заполнение',
    await page.evaluate(() => document.getElementById('npclose-sub').textContent) === 'Правки в карточке проекта не сохранятся.',
    await page.evaluate(() => document.getElementById('npclose-sub').textContent));
  ok('вопрос виден поверх окна проекта', await page.evaluate(() => {
    const a = getComputedStyle(document.getElementById('ov-npclose')).zIndex;
    const b = getComputedStyle(document.getElementById('ov-pd2')).zIndex;
    return Number(a) > Number(b);
  }), await page.evaluate(() => [getComputedStyle(document.getElementById('ov-npclose')).zIndex, getComputedStyle(document.getElementById('ov-pd2')).zIndex]));
  await page.click('#ov-npclose .btn-ghost');
  await page.waitForTimeout(200);
  ok('«Вернуться» возвращает', await page.evaluate(() =>
    !!document.querySelector('#ov-pd2 .modal.npw') && !document.getElementById('ov-npclose').classList.contains('on')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  ok('Esc тоже спрашивает', await page.evaluate(() => document.getElementById('ov-npclose').classList.contains('on')));
  await page.click('#ov-npclose .btn-add');
  await page.waitForTimeout(250);
  ok('«Закрыть» закрывает', await page.evaluate(() =>
    !document.querySelector('#ov-pd2 .modal.npw') && !document.getElementById('ov-npclose').classList.contains('on')));

  /* ——— Q. раскладка на разных экранах ——— */
  console.log('\n[Q] раскладка');
  for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await open();
    await page.waitForTimeout(220);
    const g = await page.evaluate(() => {
      const de = document.documentElement, m = document.querySelector('#ov-pd2 .modal.npw');
      const s = document.getElementById('npw-save').getBoundingClientRect();
      const secs = [...document.querySelectorAll('#npw-body .npw-sec')].map(e => e.getBoundingClientRect());
      let over = 0; for (let i = 1; i < secs.length; i++) if (secs[i].top < secs[i - 1].bottom - 1) over++;
      return { hx: de.scrollWidth - de.clientWidth, fits: m.getBoundingClientRect().height <= innerHeight + 1,
        save: s.top >= 0 && s.bottom <= innerHeight + 1 && s.width > 0, over };
    });
    ok(w + '×' + h + ': нет горизонтальной прокрутки', g.hx === 0, g.hx);
    ok(w + '×' + h + ': окно помещается', g.fits === true);
    ok(w + '×' + h + ': «Сохранить» видно', g.save === true);
    ok(w + '×' + h + ': блоки не наезжают', g.over === 0, g.over);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ——— R. движение выключается по просьбе системы ——— */
  console.log('\n[R] движение');
  await open();
  ok('окно въезжает анимацией', await page.evaluate(() =>
    getComputedStyle(document.querySelector('#ov-pd2 .modal.npw')).animationName) === 'npwPop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open();
  const rm = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.npw');
    return { anim: getComputedStyle(m).animationName, scroll: getComputedStyle(document.getElementById('npw-body')).scrollBehavior };
  });
  ok('при просьбе не двигать — окно без анимации', rm.anim === 'none', rm.anim);
  ok('и прокрутка мгновенная', rm.scroll === 'auto', rm.scroll);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  /* ——— S. чужая вёрстка не сдвинулась ——— */
  console.log('\n[S] чужие экраны');
  const outside = await page.evaluate(() => {
    if (typeof pd2Close === 'function') pd2Close();
    const d = document.createElement('div');
    d.innerHTML = '<div class="cl-vis"><button class="cl-vis-tog on"><span class="cvt-ic"></span>x</button></div>'
      + '<div class="st-seg"><button class="on">a</button><button>b</button></div>';
    document.body.appendChild(d);
    const v = getComputedStyle(d.querySelector('.cl-vis')), t = getComputedStyle(d.querySelector('.cl-vis-tog'));
    const g = getComputedStyle(d.querySelector('.st-seg'));
    const out = { visGrid: v.display, togPad: t.padding, togRad: t.borderRadius, segCols: g.gridTemplateColumns.split(' ').length };
    d.remove(); return out;
  });
  ok('общий .cl-vis остался сеткой', outside.visGrid === 'grid', outside.visGrid);
  ok('общая .cl-vis-tog не изменила отступы', outside.togPad === '9px 12px' && outside.togRad === '10px', outside);
  ok('общий .st-seg остался на три колонки', outside.segCols === 3, outside.segCols);

  /* ——— T. ошибки ——— */
  console.log('\n[T] ошибки');
  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read|TypeError/.test(e));
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
