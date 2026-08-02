/* probe_npwin — окно нового проекта: раскладка, деньги, этапы, сроки, доступ клиента */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'detroyd' };
  window.tMe = () => window.__me;
  window.__toasts = []; window.toast = t => { window.__toasts.push(t); };
  window.LIVE = false;
  window.renderTeam = () => {};
  window.__prov = null;
  window.tProvisionClient = o => { window.__prov = o; };
  PROJECTS = [];
  TEAM = [
    { _id: 'm1', name: 'Пётр Смирнов', role: 'Монтажёр', color: '#8A8FFF' },
    { _id: 'm2', name: 'Аня Ким', role: 'Дизайнер', color: '#E3B567' },
  ];
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  /* В headless кадры рисуются только по запросу: без этого CSS-переход подложки
     стоит на месте, а requestAnimationFrame внутри страницы не срабатывает.
     Прокачиваем кадры перед замерами движения — это про стенд, не про продукт. */
  const frames = async (n = 4) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.evaluate(setup);

  /* ——— A. открытие ——— */
  console.log('\n[A] открытие');
  await page.evaluate(() => openNewProject());
  await page.waitForTimeout(320);
  const ids = ['np-name', 'np-logo', 'np-cat', 'np-lead', 'np-team', 'np-cstart', 'np-cend',
    'np-stages', 'np-st-new', 'np-st-hint', 'np-clogin', 'np-cpass', 'svc-list', 'svc-tot'];
  const missing = await page.evaluate(l => l.filter(i => !document.getElementById(i)), ids);
  ok('все поля прежней карточки на месте', missing.length === 0, missing);
  ok('окно открыто', await page.evaluate(() => !!document.querySelector('#ov-pd2 .modal.npw')));
  ok('пять пунктов навигации', await page.evaluate(() => document.querySelectorAll('#npw-nav .npw-nav-i').length) === 5);
  ok('фокус в поле названия', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'np-name');
  ok('первая услуга уже подставлена', await page.evaluate(() => document.querySelectorAll('#svc-list .svc-row').length) === 1);
  ok('этапы подобраны по услуге SMM', await page.evaluate(() =>
    document.querySelectorAll('#np-stages .np-st').length === stageSetFor('SMM', '').length));
  ok('кнопка «Создать проект» видна без прокрутки', await page.evaluate(() => {
    const r = document.getElementById('npw-save').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 1 && r.width > 0;
  }));

  /* ——— B. права ——— */
  console.log('\n[B] кто может создавать');
  await page.evaluate(() => { pd2Close(); window.__me.role = 'member'; window.__me.is_pm = false; window.__toasts = []; openNewProject(); });
  await page.waitForTimeout(150);
  ok('рядовой сотрудник окна не видит', await page.evaluate(() => !document.querySelector('#ov-pd2 .modal.npw')));
  ok('и получает прежний ответ', await page.evaluate(() => window.__toasts[0]) === 'Создавать проекты могут только PM');
  await page.evaluate(() => { window.__me.role = 'agency_owner'; openNewProject(); });
  await page.waitForTimeout(320);

  /* ——— C. шапка живая ——— */
  console.log('\n[C] шапка и превью');
  await page.fill('#np-name', 'Stella Coffee');
  await page.waitForTimeout(120);
  ok('название уехало в шапку', await page.evaluate(() => document.getElementById('npw-name').textContent) === 'Stella Coffee');
  ok('буква в логотипе', await page.evaluate(() => document.getElementById('npw-lg-v').textContent) === 'S');
  ok('карточка предпросмотра повторяет название', await page.evaluate(() => document.getElementById('npw-card-nm').textContent) === 'Stella Coffee');
  await page.evaluate(() => { document.getElementById('np-cat').value = 'Кофейня'; document.getElementById('np-lead').value = 'm1'; npwPreview(); });
  await page.waitForTimeout(80);
  const sub = await page.evaluate(() => document.getElementById('npw-sub').textContent);
  ok('под названием категория и ответственный', /Кофейня/.test(sub) && /Пётр/.test(sub), sub);

  /* ——— D. деньги ——— */
  console.log('\n[D] услуги и деньги');
  await page.evaluate(() => { window.NP_SVCS[0].mrr = 12000000; svcRender(); });
  await page.waitForTimeout(120);
  /* toLocaleString('ru-RU') разделяет разряды неразрывным пробелом — сравниваем по цифрам */
  const money = async () => (await page.evaluate(() => document.getElementById('npw-money').textContent)).replace(/\s|\u00a0|\u202f/g, '');
  ok('доход в шапке = 12 000 000', await money() === '12000000', await money());
  await page.evaluate(() => { svcAdd(); svcSet(1, 'service', 'PROD'); window.NP_SVCS[1].mrr = 4500000; svcRender(); });
  await page.waitForTimeout(150);
  ok('добавилась вторая строка услуги', await page.evaluate(() => document.querySelectorAll('#svc-list .svc-row').length) === 2);
  ok('доход стал 16 500 000', await money() === '16500000', await money());
  ok('счётчик услуг в навигации 2', await page.evaluate(() => document.getElementById('npw-c-svc').textContent) === '2');
  ok('в подвале тот же итог', /Доход 16500000 · услуг 2/.test((await page.evaluate(() => document.getElementById('npw-sum').textContent)).replace(/\s|\u00a0|\u202f/g, ' ').replace(/(\d) (?=\d)/g, '$1')));
  ok('основной считается услуга с большим доходом', await page.evaluate(() => svcPrimary(svcCollect()).service) === 'SMM');
  await page.evaluate(() => svcDel(1));
  await page.waitForTimeout(150);
  ok('после удаления доход вернулся к 12 000 000', await money() === '12000000', await money());
  ok('новая строка помечается для проявления', await page.evaluate(() => {
    svcAdd(); return !!document.querySelector('#svc-list .svc-row:last-child.npw-in');
  }));
  await page.evaluate(() => svcDel(1));
  await page.waitForTimeout(120);

  /* ——— E. этапы ——— */
  console.log('\n[E] этапы');
  const st0 = await page.evaluate(() => npSelectedStages());
  await page.evaluate(() => { document.getElementById('np-st-new').value = 'Отчёт клиенту'; npStageAdd(); });
  await page.waitForTimeout(150);
  ok('этап добавился в конец', await page.evaluate(() => npSelectedStages().pop()) === 'Отчёт клиенту');
  ok('счётчик этапов вырос', await page.evaluate(() => npSelectedStages().length) === st0.length + 1);
  ok('подсказка считает этапы', await page.evaluate(() => document.getElementById('np-st-hint').textContent) === 'Этапов в проекте: ' + (st0.length + 1));
  await page.evaluate(() => npStageMove(0, 1));
  await page.waitForTimeout(150);
  const st1 = await page.evaluate(() => npSelectedStages());
  ok('стрелка меняет соседние этапы местами', st1[0] === st0[1] && st1[1] === st0[0], st1.slice(0, 2));
  await page.evaluate(() => npStageRename(0, 'Бриф'));
  ok('переименование пишется в модель', await page.evaluate(() => npSelectedStages()[0]) === 'Бриф');
  await page.evaluate(() => npStageRemove(0));
  await page.waitForTimeout(150);
  ok('удаление убирает этап', await page.evaluate(() => npSelectedStages().length) === st0.length);
  ok('в подвале число этапов совпадает', new RegExp('этапов ' + st0.length + ' ').test(await page.evaluate(() => document.getElementById('npw-sum').textContent + ' ')));

  /* ——— F. смена услуги меняет этапы ——— */
  console.log('\n[F] услуга задаёт этапы');
  await page.evaluate(() => svcSet(0, 'service', 'PROD'));
  await page.waitForTimeout(200);
  ok('этапы пересобрались под PROD', await page.evaluate(() =>
    npSelectedStages().join('|') === stageSetFor('PROD', '').join('|')));
  await page.evaluate(() => svcSet(0, 'service', 'SMM'));
  await page.waitForTimeout(200);
  ok('и вернулись под SMM', await page.evaluate(() =>
    npSelectedStages().join('|') === stageSetFor('SMM', '').join('|')));

  /* ——— G. сроки ——— */
  console.log('\n[G] срок договора');
  ok('по умолчанию месяц от сегодня', await page.evaluate(() =>
    document.getElementById('np-cend').value === npAddMonths(document.getElementById('np-cstart').value, 1)));
  ok('подпись срока — 1 месяц', /1 месяц/.test(await page.evaluate(() => document.getElementById('npw-dur').textContent)));
  ok('подсвечен пресет «1 мес»', await page.evaluate(() =>
    document.querySelector('#npw-presets button[data-m="1"]').classList.contains('on')));
  await page.evaluate(() => npwPreset(6));
  await page.waitForTimeout(150);
  ok('пресет 6 мес двигает окончание', await page.evaluate(() =>
    document.getElementById('np-cend').value === npAddMonths(document.getElementById('np-cstart').value, 6)));
  ok('подсветка переехала на «6 мес»', await page.evaluate(() =>
    document.querySelector('#npw-presets button[data-m="6"]').classList.contains('on') &&
    !document.querySelector('#npw-presets button[data-m="1"]').classList.contains('on')));
  ok('в навигации срок «6 мес»', await page.evaluate(() => document.getElementById('npw-c-plan').textContent) === '6 мес');
  await page.evaluate(() => { const s = document.getElementById('np-cstart').value; dpPick('np-cend', npAddMonths(s, -1)); npwCounts(); });
  await page.waitForTimeout(120);
  ok('окончание раньше начала — видно ошибку', /раньше начала/.test(await page.evaluate(() => document.getElementById('npw-dur').textContent)));
  await page.evaluate(() => npwPreset(1));
  await page.waitForTimeout(120);

  /* ——— H. команда ——— */
  console.log('\n[H] команда');
  ok('пока никого — есть объяснение', await page.evaluate(() =>
    document.getElementById('npw-team-empty').style.display === '' && document.querySelectorAll('#np-team .np-chip').length === 0));
  await page.evaluate(() => { window.NP_TEAM = new Set(['m1', 'm2']); npRenderTeam(); });
  await page.waitForTimeout(150);
  ok('чипы появились', await page.evaluate(() => document.querySelectorAll('#np-team .np-chip').length) === 2);
  ok('счётчик в навигации 2', await page.evaluate(() => document.getElementById('npw-c-team').textContent) === '2');
  ok('пустое состояние спряталось', await page.evaluate(() => document.getElementById('npw-team-empty').style.display) === 'none');
  await page.evaluate(() => npChipRemove('m2'));
  await page.waitForTimeout(120);
  ok('крестик убирает человека', await page.evaluate(() => npSelectedTeam().join(',')) === 'm1');

  /* ——— I. доступ клиента ——— */
  console.log('\n[I] доступ клиента');
  /* логин собирается из названия сам — руками его набирать не нужно */
  ok('в поле сразу полный адрес входа', await page.evaluate(() => document.getElementById('np-clogin').value) === 'stella@detroyd.triada.app',
    await page.evaluate(() => document.getElementById('np-clogin').value));
  ok('подпись объясняет, а не повторяет адрес', await page.evaluate(() => document.getElementById('np-cemail').textContent) === 'Этот адрес клиент вводит при входе');
  await page.evaluate(() => { document.getElementById('np-name').value = 'Ресто Групп'; npwLoginTouched = false; npwLoginSync(); });
  await page.waitForTimeout(120);
  ok('кириллица переводится в латиницу', await page.evaluate(() => document.getElementById('np-clogin').value) === 'resto@detroyd.triada.app',
    await page.evaluate(() => document.getElementById('np-clogin').value));
  const vars = await page.evaluate(() => npwLoginVariants());
  ok('вариантов логина несколько', vars.length >= 3, vars);
  ok('все варианты годятся для адреса', vars.every(v => /^[a-z][a-z0-9]{2,23}$/.test(v)), vars);
  await page.click('#ov-pd2 .npw-gen .npw-pbtn');
  await page.waitForTimeout(120);
  ok('кнопка даёт следующий вариант', await page.evaluate(() => document.getElementById('np-clogin').value) === vars[1] + '@detroyd.triada.app', vars);
  await page.fill('#np-clogin', 'stella');
  await page.waitForTimeout(120);
  ok('набрали одно имя — подпись показывает готовый адрес', await page.evaluate(() => document.getElementById('np-cemail').textContent) === 'Адрес входа: stella@detroyd.triada.app');
  await page.evaluate(() => { document.getElementById('np-name').value = 'Совсем другое'; npwLoginSync(); });
  await page.waitForTimeout(120);
  ok('набранный руками логин название не перебивает', await page.evaluate(() => document.getElementById('np-clogin').value) === 'stella');
  await page.evaluate(() => { document.getElementById('np-name').value = 'Stella Coffee'; npwPreview(); npwCounts(); });
  ok('пароль скрыт по умолчанию', await page.evaluate(() => document.getElementById('np-cpass').type) === 'password');
  await page.evaluate(() => npwPassGen());
  await page.waitForTimeout(120);
  const pw = await page.evaluate(() => document.getElementById('np-cpass').value);
  ok('пароль из 12 знаков', pw.length === 12, pw);
  ok('есть регистр и цифра', /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[2-9]/.test(pw), pw);
  ok('без похожих символов 0 O 1 l I', !/[0O1lI]/.test(pw), pw);
  ok('после генерации пароль видно', await page.evaluate(() => document.getElementById('np-cpass').type) === 'text');
  ok('в демо-режиме об этом сказано', /Демо-режим/.test(await page.evaluate(() => document.getElementById('npw-client-note').textContent)));

  /* ——— J. навигация ——— */
  console.log('\n[J] навигация');
  await page.addStyleTag({ content: '#ov-pd2 .npw-body{scroll-behavior:auto!important}' });
  await page.evaluate(() => { document.getElementById('npw-body').scrollTop = 0; npwGo('team'); });
  await page.waitForTimeout(200);
  ok('клик по пункту ставит раздел под шапку', await page.evaluate(() => {
    const b = document.getElementById('npw-body'), s = document.getElementById('npw-s-team');
    return Math.abs(s.getBoundingClientRect().top - b.getBoundingClientRect().top - 8) < 24;
  }));
  ok('активный пункт — «Команда»', await page.evaluate(() => document.querySelector('#npw-nav .npw-nav-i.on').dataset.sec) === 'team');
  await page.waitForTimeout(700);   /* подложка переезжает 0.2s — даём ей доехать */
  await frames();
  ok('подложка легла ровно на активную кнопку', await page.evaluate(() => {
    const p = document.getElementById('npw-pill').getBoundingClientRect();
    const a = document.querySelector('#npw-nav .npw-nav-i.on').getBoundingClientRect();
    return Math.abs(p.top - a.top) <= 1.5 && Math.abs(p.bottom - a.bottom) <= 1.5
        && Math.abs(p.left - a.left) <= 1 && Math.abs(p.right - a.right) <= 1;
  }), await page.evaluate(() => {
    const p = document.getElementById('npw-pill').getBoundingClientRect();
    const a = document.querySelector('#npw-nav .npw-nav-i.on').getBoundingClientRect();
    return { dTop: +(p.top - a.top).toFixed(2), dBot: +(p.bottom - a.bottom).toFixed(2), dL: +(p.left - a.left).toFixed(2), dR: +(p.right - a.right).toFixed(2) };
  }));
  ok('подсветка не сбегает на «Основное» по дороге', await page.evaluate(() =>
    document.querySelector('#npw-nav .npw-nav-i.on').dataset.sec) === 'team');
  ok('кнопки навигации одной ширины и на одной вертикали', await page.evaluate(() => {
    const r = [...document.querySelectorAll('#npw-nav .npw-nav-i')].map(e => e.getBoundingClientRect());
    return r.every(x => Math.abs(x.left - r[0].left) < .5 && Math.abs(x.width - r[0].width) < .5 && Math.abs(x.height - r[0].height) < .5);
  }));
  ok('счётчики прижаты к одному краю', await page.evaluate(() => {
    const c = [...document.querySelectorAll('#npw-nav .npw-nav-c')].filter(e => e.textContent.trim());
    return c.length > 1 && c.every(x => Math.abs(x.getBoundingClientRect().right - c[0].getBoundingClientRect().right) < .5);
  }));
  await page.evaluate(() => { document.getElementById('npw-body').scrollTop = 0; });
  await page.waitForTimeout(250);
  await frames();
  ok('прокрутка наверх возвращает «Основное»', await page.evaluate(() => document.querySelector('#npw-nav .npw-nav-i.on').dataset.sec) === 'main');
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
  ok('по вертикали скроллится только тело окна', scrollers.filter(s => s !== 'npw-body').length === 0, scrollers);
  ok('шапка и подвал на месте', await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.npw').getBoundingClientRect();
    const t = document.querySelector('#ov-pd2 .npw-top').getBoundingClientRect();
    const f = document.querySelector('#ov-pd2 .npw-foot').getBoundingClientRect();
    return Math.abs(t.top - m.top) < 2 && Math.abs(f.bottom - m.bottom) < 2;
  }));

  /* ——— K. валидация ——— */
  console.log('\n[K] валидация');
  await page.evaluate(() => { document.getElementById('np-name').value = ''; window.__toasts = []; npSaveProject(); });
  await page.waitForTimeout(400);
  ok('без названия не сохраняет', await page.evaluate(() => window.__toasts[0]) === 'Введи название проекта');
  ok('поле подсвечено', await page.evaluate(() => document.getElementById('np-name').closest('.fld').classList.contains('err')));
  ok('увело к разделу «Основное»', await page.evaluate(() => document.querySelector('#npw-nav .npw-nav-i.on').dataset.sec) === 'main');
  ok('точка тревоги в навигации', await page.evaluate(() => document.getElementById('npw-c-main').classList.contains('bad')));
  ok('окно осталось открытым', await page.evaluate(() => !!document.querySelector('#ov-pd2 .modal.npw')));
  await page.fill('#np-name', 'Stella Coffee');
  await page.waitForTimeout(100);
  ok('ошибка гаснет при вводе', await page.evaluate(() => !document.getElementById('np-name').closest('.fld').classList.contains('err')));
  await page.evaluate(() => { svcReset([{ service: '', tariff: '', mrr: 0, cost: 0 }]); window.__toasts = []; npSaveProject(); });
  await page.waitForTimeout(400);
  ok('без услуг не сохраняет', await page.evaluate(() => window.__toasts[0]) === 'Добавь хотя бы одну услугу');
  ok('увело к разделу «Услуги и деньги»', await page.evaluate(() => document.querySelector('#npw-nav .npw-nav-i.on').dataset.sec) === 'svc');
  ok('объяснение под редактором видно', await page.evaluate(() => document.getElementById('err-np-svc').style.display) === 'block');

  /* ——— L. боевой режим: доступ клиента обязателен ——— */
  console.log('\n[L] боевой режим');
  await page.evaluate(() => {
    window.LIVE = true;
    svcReset([{ service: 'SMM', tariff: '', mrr: 9000000, cost: 0 }]);
    document.getElementById('np-clogin').value = '';
    document.getElementById('np-cpass').value = '';
    window.__toasts = []; npSaveProject();
  });
  await page.waitForTimeout(400);
  ok('без логина клиента не сохраняет', await page.evaluate(() => window.__toasts[0]) === 'Задай логин и пароль клиента');
  ok('увело к разделу «Доступ клиента»', await page.evaluate(() => document.querySelector('#npw-nav .npw-nav-i.on').dataset.sec) === 'client');
  /* чужой домен молча не обрезаем */
  await page.evaluate(() => {
    document.getElementById('np-clogin').value = 'stella@gmail.com';
    document.getElementById('np-cpass').value = 'Qwerty2345xz';
    window.__toasts = []; window.__prov = null; npSaveProject();
  });
  await page.waitForTimeout(300);
  ok('чужой домен не проходит', await page.evaluate(() => window.__prov) === null &&
    /должен заканчиваться на @detroyd\.triada\.app/.test(await page.evaluate(() => window.__toasts[0] || '')),
    await page.evaluate(() => window.__toasts[0]));
  await page.evaluate(() => {
    /* в поле полный адрес — наружу должно уйти только имя до собаки */
    document.getElementById('np-clogin').value = 'stella@detroyd.triada.app';
    document.getElementById('np-cpass').value = 'Qwerty2345xz';
    window.NP_TEAM = new Set(['m1']); npRenderTeam();
    window.__prov = null; npSaveProject();
  });
  await page.waitForTimeout(300);
  const prov = await page.evaluate(() => window.__prov);
  ok('провижининг вызван', !!prov);
  ok('наружу уходит имя до собаки, а не весь адрес', prov && prov.login === 'stella' && prov.full_name === 'Stella Coffee', prov && { l: prov.login, n: prov.full_name });
  ok('услуги переданы целиком', prov && prov.project && prov.project.services.length === 1 && prov.project.services[0].mrr === 9000000, prov && prov.project && prov.project.services);
  ok('доход проекта = сумме услуг', prov && prov.project.mrr === 9000000, prov && prov.project && prov.project.mrr);
  ok('основная услуга SMM', prov && prov.project.service === 'SMM');
  ok('этапы переданы', prov && Array.isArray(prov.stages) && prov.stages.length > 0, prov && prov.stages);
  ok('команда передана', prov && prov.team.join(',') === 'm1', prov && prov.team);
  ok('срок договора передан', prov && prov.contract && !!prov.contract.start && !!prov.contract.end, prov && prov.contract);
  ok('окно закрылось после сохранения', await page.evaluate(() => !document.querySelector('#ov-pd2 .modal.npw')));

  /* ——— M. демо-режим: проект уходит в список ——— */
  console.log('\n[M] демо-режим');
  await page.evaluate(() => {
    window.LIVE = false; PROJECTS = []; openNewProject();
  });
  await page.waitForTimeout(320);
  await page.evaluate(() => {
    document.getElementById('np-name').value = 'Ресто Групп';
    svcReset([{ service: 'SMM', tariff: '', mrr: 3000000, cost: 0 }]);
    npSaveProject();
  });
  await page.waitForTimeout(250);
  ok('проект добавился в список', await page.evaluate(() => PROJECTS.length) === 1);
  ok('с прежними полями', await page.evaluate(() => {
    const p = PROJECTS[0];
    return p.name === 'Ресто Групп' && p.svc === 'SMM' && p.mrr === 3000000 && p.status === 'active' && p.pct === 0;
  }), await page.evaluate(() => PROJECTS[0]));
  ok('окно закрылось', await page.evaluate(() => !document.querySelector('#ov-pd2 .modal.npw')));

  /* ——— N. закрытие с изменениями ——— */
  console.log('\n[N] закрытие');
  await page.evaluate(() => openNewProject());
  await page.waitForTimeout(320);
  await page.evaluate(() => pd2EscClose());
  await page.waitForTimeout(150);
  ok('нетронутую карточку закрывает сразу', await page.evaluate(() =>
    !document.querySelector('#ov-pd2 .modal.npw') && !document.getElementById('ov-npclose').classList.contains('on')));
  await page.evaluate(() => openNewProject());
  await page.waitForTimeout(320);
  await page.evaluate(() => { document.getElementById('np-name').value = 'Черновик'; pd2EscClose(); });
  await page.waitForTimeout(150);
  ok('заполненная — спрашивает', await page.evaluate(() => document.getElementById('ov-npclose').classList.contains('on')));
  ok('и окно ещё открыто', await page.evaluate(() => !!document.querySelector('#ov-pd2 .modal.npw')));
  /* у .ov по умолчанию z-index 50, у #ov-pd2 — 60: вопрос открывался ПОД окном
     проекта, и крестик выглядел сломанным */
  ok('вопрос виден поверх окна проекта', await page.evaluate(() => {
    const r = document.querySelector('#ov-npclose .modal').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(el && el.closest('#ov-npclose'));
  }), await page.evaluate(() => {
    const r = document.querySelector('#ov-npclose .modal').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el ? el.tagName + '.' + String(el.className).slice(0, 24) : null;
  }));
  await page.evaluate(() => npwCloseAsk(0));
  ok('«Вернуться» возвращает', await page.evaluate(() =>
    !document.getElementById('ov-npclose').classList.contains('on') && !!document.querySelector('#ov-pd2 .modal.npw')));
  /* настоящий клик мышью, а не вызов функции: так ловятся перекрытия */
  await page.click('#ov-pd2 .npw-x');
  await page.waitForTimeout(200);
  ok('крестик снова открывает вопрос', await page.evaluate(() => document.getElementById('ov-npclose').classList.contains('on')));
  await page.click('#ov-npclose .btn-add');
  await page.waitForTimeout(200);
  ok('«Закрыть» закрывает', await page.evaluate(() => !document.querySelector('#ov-pd2 .modal.npw')));
  ok('и вопрос убрался', await page.evaluate(() => !document.getElementById('ov-npclose').classList.contains('on')));

  /* ——— O. адаптив ——— */
  console.log('\n[O] раскладка на разных экранах');
  await page.evaluate(() => openNewProject());
  await page.waitForTimeout(320);
  for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(240);
    const r = await page.evaluate(() => {
      const m = document.querySelector('#ov-pd2 .modal.npw');
      const save = document.getElementById('npw-save').getBoundingClientRect();
      const rects = ['.npw-top', '#npw-nav', '#npw-body', '.npw-foot']
        .map(s => document.querySelector('#ov-pd2 ' + s).getBoundingClientRect());
      const gaps = []; for (let i = 1; i < rects.length; i++) gaps.push(Math.round(rects[i].top - rects[i - 1].bottom));
      return {
        hscroll: m.scrollWidth - m.clientWidth,
        fits: m.getBoundingClientRect().width <= innerWidth + 1 && m.getBoundingClientRect().height <= innerHeight + 1,
        saveVisible: save.top >= 0 && save.bottom <= innerHeight + 1 && save.width > 0,
        gaps,
      };
    });
    ok(vp.width + '×' + vp.height + ': нет горизонтальной прокрутки', r.hscroll <= 1, r);
    ok(vp.width + '×' + vp.height + ': окно помещается', r.fits, r);
    ok(vp.width + '×' + vp.height + ': «Создать проект» видна', r.saveVisible, r);
    if (vp.width <= 900) ok(vp.width + '×' + vp.height + ': блоки не наезжают', r.gaps.every(g => g >= -1), r.gaps);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);

  /* ——— P. чужая вёрстка ——— */
  console.log('\n[P] чужая вёрстка');
  await page.evaluate(() => pd2Close());
  const other = await page.evaluate(() => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="modal" id="__probe_modal"><div class="modal-h"><h3>x</h3></div></div>';
    document.body.appendChild(el);
    const cs = getComputedStyle(document.getElementById('__probe_modal'));
    const r = { maxWidth: cs.maxWidth, radius: cs.borderRadius, display: cs.display };
    el.remove(); return r;
  });
  ok('обычная .modal осталась прежней', other.maxWidth === '460px' && other.radius === '14px' && other.display === 'block', other);
  ok('редактор услуг вне окна проекта не изменился', await page.evaluate(() => {
    const el = document.createElement('div'); el.innerHTML = svcEditorHTML(true); document.body.appendChild(el);
    const cs = getComputedStyle(el.querySelector('.svc-head'));
    const r = { pos: cs.position }; el.remove(); return r.pos === 'static';
  }));

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read|TypeError/.test(e));
  console.log('\n[Q] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
