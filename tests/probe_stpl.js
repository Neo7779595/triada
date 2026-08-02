/* probe_stpl — окно «Шаблоны агентства»: каркас, справочники, удаление, переименование */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me;
  window.__toasts = []; window.toast = t => { window.__toasts.push(String(t)); };
  window.LIVE = false;
  window.renderProjects = () => {};
  window.__save = [];
  window.tSaveStageTemplate = (service, stages, tariff) => {
    window.__save.push({ service, stages: stages.slice(), tariff });
    window.STAGE_TPL = window.STAGE_TPL || {};
    (window.STAGE_TPL[service] = window.STAGE_TPL[service] || {})[tariff || ''] = stages.slice();
  };
};

const seed = () => {
  PROJECTS = [
    { id: 'p1', name: 'A', cat: 'Ритейл', svc: 'PROD', tariff: 'GOLD' },
    { id: 'p2', name: 'B', cat: 'Ритейл', svc: 'SMM', tariff: '' },
    { id: 'p3', name: 'C', cat: 'Клиника', svc: 'PROD', tariff: 'GOLD' },
  ];
  PROJECT_TAGS.category = ['Ритейл', 'Клиника'];
  PROJECT_TAGS.service = ['PROD', 'SMM', 'DESIGN'];
  window.TARIFF_TPL = [
    { service: 'PROD', name: 'GOLD', price: 12000000, per: 'сум / мес', complexity: 'Высокая' },
    { service: 'PROD', name: 'SILVER', price: 6000000, per: 'сум / мес', complexity: '' },
    { service: 'SMM', name: 'BASE', price: 3000000, per: 'сум / мес', complexity: 'Низкая' },
    { service: '', name: 'СИРОТА', price: 1000, per: 'сум / мес', complexity: '' },
  ];
  window.STAGE_TPL = { PROD: { '': ['Предпродакшн', 'Продакшн', 'Постпродакшн'], GOLD: ['Бриф', 'Съёмка', 'Монтаж', 'Сдача'] } };
  window.SVC_COLORS = { PROD: '#8A8FFF', SMM: '#37E6C8' };
  window.__toasts = []; window.__save = [];
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.evaluate(setup);
  await page.evaluate('window.seed = ' + seed.toString());
  await page.addStyleTag({ content: '#ov-pd2 .npw-body{scroll-behavior:auto!important}' });
  const open = async () => { await page.evaluate(() => { if (typeof pd2Close === 'function') pd2Close(); seed(); openTemplatesSettings(); }); await page.waitForTimeout(300); };
  const txt = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);

  /* ——— A. права ——— */
  console.log('\n[A] права');
  let r = await page.evaluate(() => {
    window.__me.role = 'member'; window.__me.is_director = false; seed(); window.__toasts = [];
    openTemplatesSettings();
    return { open: !!document.querySelector('#ov-pd2 .modal.npw'), toast: window.__toasts[0] || null };
  });
  ok('сотрудник окна не видит', r.open === false, r);
  ok('и получает прежний ответ', r.toast === 'Настройки шаблонов доступны только владельцу', r.toast);
  await page.evaluate(() => { window.__me.role = 'agency_owner'; });
  await open();
  ok('владелец окно открывает', await page.evaluate(() => !!document.querySelector('#ov-pd2 .modal.npw')));

  /* ——— B. общий каркас ——— */
  console.log('\n[B] общий каркас');
  const shell = await page.evaluate(() => {
    const m = document.querySelector('#ov-pd2 .modal.npw');
    return { tpl: m.classList.contains('npw-tpl'),
      top: !!m.querySelector('.npw-top'), nav: !!document.getElementById('npw-nav'),
      pill: !!document.getElementById('npw-pill'), body: !!document.getElementById('npw-body'),
      foot: !!m.querySelector('.npw-foot'),
      secs: [...document.querySelectorAll('#npw-nav .npw-nav-i')].map(x => x.dataset.sec),
      cancel: [...m.querySelectorAll('.npw-foot button')].map(x => x.textContent.trim()),
      tabs: !!m.querySelector('.stpl-tabs') };
  });
  ok('окно собрано на общем каркасе', shell.tpl && shell.top && shell.nav && shell.pill && shell.body && shell.foot, shell);
  ok('три раздела в навигации', shell.secs.join(',') === 'tcat,tsvc,ttar', shell.secs);
  ok('прежних вкладок-сегмента больше нет', shell.tabs === false);
  ok('в подвале одна кнопка — «Готово»', shell.cancel.join(',') === 'Готово', shell.cancel);
  ok('шапка считает справочники', await txt('#npw-sub') === '2 категории · 3 услуги · 4 тарифа', await txt('#npw-sub'));
  ok('в шапке — сколько проектов держится на шаблонах', await txt('#npw-money') === '3', await txt('#npw-money'));
  ok('счётчики разделов совпадают со списками', await page.evaluate(() =>
    ['tcat', 'tsvc', 'ttar'].map(k => document.getElementById('npw-c-' + k).textContent).join(',')) === '2,3,4');
  ok('прокручивается только тело окна', await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#ov-pd2 .modal.npw *').forEach(el => {
      if (el.scrollHeight - el.clientHeight > 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) out.push(el.id || String(el.className));
    });
    return out.length <= 1 && out.every(x => x === 'npw-body');
  }));
  ok('высота окна не зависит от раздела', await page.evaluate(async () => {
    const h = () => document.querySelector('#ov-pd2 .modal.npw').getBoundingClientRect().height;
    const a = h(); stplGo('tsvc'); const bb = h(); stplGo('ttar'); const c = h(); stplGo('tcat');
    return Math.abs(a - bb) < 1 && Math.abs(a - c) < 1;
  }));

  /* ——— C. категории ——— */
  console.log('\n[C] категории');
  const cats = () => page.evaluate(() => [...document.querySelectorAll('#stpl-cat-list .stpl-item .stpl-nm')].map(x => x.textContent));
  ok('категории на месте', (await cats()).join(',') === 'Ритейл,Клиника', await cats());
  ok('счётчик проектов у используемой', await page.evaluate(() =>
    document.querySelector('#stpl-cat-list .stpl-item .stpl-use').textContent) === '2 проекта');
  await page.fill('#stpl-cat-new', 'Кофейня');
  await page.click('#stpl-cat-new + .btn-add, .stpl-add .btn-add');
  await page.waitForTimeout(200);
  ok('категория добавилась', (await cats()).join(',') === 'Ритейл,Клиника,Кофейня', await cats());
  ok('курсор остался в поле — заводят подряд', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'stpl-cat-new');
  await page.fill('#stpl-cat-new', 'Кофейня');
  await page.evaluate(() => { window.__toasts = []; stplCatAdd(); });
  await page.waitForTimeout(150);
  ok('дважды одну и ту же не заводит', (await cats()).length === 3 && (await page.evaluate(() => window.__toasts[0])) === 'Такая категория уже есть');
  await page.evaluate(() => { document.getElementById('stpl-cat-new').value = ''; });

  /* ——— D. удаление спрашивает по-человечески ——— */
  console.log('\n[D] удаление');
  await page.evaluate(() => stplCatDel('Ритейл'));
  await page.waitForTimeout(200);
  const ask = await page.evaluate(() => {
    const ov = document.getElementById('ov-stpldel');
    return { on: ov.classList.contains('on'), h: document.getElementById('stpl-ask-h').textContent,
      p: document.getElementById('stpl-ask-p').textContent, b: document.getElementById('stpl-ask-b').textContent,
      z: Number(getComputedStyle(ov).zIndex), zp: Number(getComputedStyle(document.getElementById('ov-pd2')).zIndex) };
  });
  ok('вопрос об удалении открылся', ask.on === true, ask);
  ok('и он поверх окна', ask.z > ask.zp, [ask.z, ask.zp]);
  ok('в вопросе — что удаляем', ask.p === 'Ритейл', ask.p);
  ok('и сколько проектов задето', /2 проекта/.test(ask.b), ask.b);
  ok('и что с ними будет', /сохранят своё значение/.test(ask.b), ask.b);
  await page.click('#ov-stpldel .btn-ghost');
  await page.waitForTimeout(200);
  ok('отмена ничего не удаляет', (await cats()).join(',') === 'Ритейл,Клиника,Кофейня', await cats());
  ok('и вопрос закрылся', await page.evaluate(() => !document.getElementById('ov-stpldel').classList.contains('on')));
  await page.evaluate(() => stplCatDel('Кофейня'));
  await page.waitForTimeout(150);
  await page.click('#ov-stpldel .btn-add');
  await page.waitForTimeout(200);
  ok('подтверждение удаляет', (await cats()).join(',') === 'Ритейл,Клиника', await cats());
  ok('никаких «нажмите ещё раз» в тостах', await page.evaluate(() => window.__toasts.every(t => !/ещё раз/.test(t))), await page.evaluate(() => window.__toasts));

  /* ——— E. переименование тянет за собой проекты ——— */
  console.log('\n[E] переименование');
  await page.evaluate(() => stplRenameOpen('cat', 'Ритейл'));
  await page.waitForTimeout(200);
  ok('строка превратилась в поле', await page.evaluate(() => !!document.getElementById('stpl-rn')));
  ok('сказано, скольких проектов коснётся', /переименуем в 2 проектах/.test(await txt('.tpl-rn .stpl-use') || ''), await txt('.tpl-rn .stpl-use'));
  await page.fill('#stpl-rn', 'Клиника');
  await page.evaluate(() => { window.__toasts = []; stplRenameSave(); });
  await page.waitForTimeout(150);
  ok('в занятое имя не переименовывает', await page.evaluate(() => window.__toasts[0]) === 'Такое название уже есть');
  await page.fill('#stpl-rn', 'Ритейл и опт');
  await page.evaluate(() => stplRenameSave());
  await page.waitForTimeout(250);
  ok('категория переименована', (await cats()).join(',') === 'Ритейл и опт,Клиника', await cats());
  ok('и проекты переехали вместе с ней', await page.evaluate(() =>
    PROJECTS.filter(p => p.cat === 'Ритейл и опт').length) === 2);
  await page.evaluate(() => { stplGo('tsvc'); stplRenameOpen('svc', 'PROD'); });
  await page.waitForTimeout(250);
  await page.fill('#stpl-rn', 'PRODUCTION');
  await page.evaluate(() => stplRenameSave());
  await page.waitForTimeout(250);
  const svcRen = await page.evaluate(() => ({
    tags: PROJECT_TAGS.service.slice(),
    tpl: Object.keys(window.STAGE_TPL),
    tar: window.TARIFF_TPL.filter(t => t.service === 'PRODUCTION').length,
    proj: PROJECTS.filter(p => p.svc === 'PRODUCTION').length,
    color: window.SVC_COLORS.PRODUCTION,
  }));
  ok('услуга переименована в списке', svcRen.tags.join(',') === 'PRODUCTION,SMM,DESIGN', svcRen.tags);
  ok('шаблон этапов уехал за новым именем', svcRen.tpl.indexOf('PRODUCTION') >= 0, svcRen.tpl);
  ok('тарифы услуги тоже', svcRen.tar === 2, svcRen.tar);
  ok('и проекты', svcRen.proj === 2, svcRen.proj);
  ok('цвет услуги не потерялся', svcRen.color === '#8A8FFF', svcRen.color);

  /* ——— F. услуги: список и карточка ——— */
  console.log('\n[F] услуги');
  await open();
  await page.evaluate(() => stplGo('tsvc'));
  await page.waitForTimeout(250);
  const svc = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.stpl-svc-row')].map(x => x.dataset.k),
    sel: (document.querySelector('.stpl-svc-row.on') || {}).dataset.k,
    chips: [...document.querySelectorAll('.stpl-tf-tab')].map(x => x.textContent.trim()),
    stages: [...document.querySelectorAll('#stpl-stages input')].map(x => x.value),
    tars: [...document.querySelectorAll('.tpl-col-r .stpl-item.tar .stpl-nm')].map(x => x.textContent),
    swatch: getComputedStyle(document.querySelector('.stpl-svc-row.on .stpl-svc-swatch')).backgroundColor,
  }));
  ok('услуги в списке', svc.rows.join(',') === 'PROD,SMM,DESIGN', svc.rows);
  ok('первая выбрана сама', svc.sel === 'PROD', svc.sel);
  ok('чипы — базовые плюс тарифы услуги', svc.chips.join(',') === 'Базовые этапы,GOLD,SILVER', svc.chips);
  ok('видны базовые этапы услуги', svc.stages.join(',') === 'Предпродакшн,Продакшн,Постпродакшн', svc.stages);
  ok('тарифы услуги здесь же, без перехода на другую вкладку', svc.tars.join(',') === 'GOLD,SILVER', svc.tars);
  ok('цвет услуги на метке', svc.swatch === 'rgb(138, 143, 255)', svc.swatch);
  await page.evaluate(() => stplPickTariff('GOLD'));
  await page.waitForTimeout(250);
  ok('у тарифа свои этапы', await page.evaluate(() =>
    [...document.querySelectorAll('#stpl-stages input')].map(x => x.value).join(',')) === 'Бриф,Съёмка,Монтаж,Сдача');

  /* ——— G. этапы не теряются ——— */
  console.log('\n[G] несохранённые этапы');
  await page.evaluate(() => { const i = document.querySelectorAll('#stpl-stages input')[0]; i.value = 'Бриф с клиентом'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150);
  ok('окно честно говорит «не сохранено»', await page.evaluate(() => !!document.querySelector('.tpl-unsaved')));
  await page.evaluate(() => stplPickTariff(''));
  await page.waitForTimeout(250);
  ok('уход на другой тариф не теряет правку', await page.evaluate(() =>
    (window.STAGE_TPL.PROD.GOLD || []).join(',')) === 'Бриф с клиентом,Съёмка,Монтаж,Сдача',
    await page.evaluate(() => (window.STAGE_TPL.PROD.GOLD || []).join(',')));
  ok('и метка «не сохранено» погасла', await page.evaluate(() => !document.querySelector('.tpl-unsaved')));
  await page.evaluate(() => { const i = document.querySelectorAll('#stpl-stages input')[0]; i.value = 'Смета'; i.dispatchEvent(new Event('input', { bubbles: true })); stplGo('ttar'); });
  await page.waitForTimeout(250);
  ok('уход в другой раздел тоже дописывает', await page.evaluate(() =>
    (window.STAGE_TPL.PROD[''] || []).join(',')) === 'Смета,Продакшн,Постпродакшн',
    await page.evaluate(() => (window.STAGE_TPL.PROD[''] || []).join(',')));
  await page.evaluate(() => { stplGo('tsvc'); const i = document.querySelectorAll('#stpl-stages input')[1]; i.value = 'Съёмочный день'; i.dispatchEvent(new Event('input', { bubbles: true })); npwTryClose(); });
  await page.waitForTimeout(250);
  ok('закрытие окна тоже дописывает', await page.evaluate(() =>
    (window.STAGE_TPL.PROD[''] || []).join(',')) === 'Смета,Съёмочный день,Постпродакшн',
    await page.evaluate(() => (window.STAGE_TPL.PROD[''] || []).join(',')));
  ok('и окно закрылось', await page.evaluate(() => !document.querySelector('#ov-pd2 .modal.npw')));

  /* ——— H. порядок этапов ——— */
  console.log('\n[H] порядок этапов');
  await open();
  await page.evaluate(() => { stplGo('tsvc'); stplPickSvc('PROD'); });
  await page.waitForTimeout(250);
  await page.evaluate(() => stplStageMove(2, -1));
  await page.waitForTimeout(200);
  ok('стрелка меняет соседние этапы местами', await page.evaluate(() =>
    [...document.querySelectorAll('#stpl-stages input')].map(x => x.value).join(',')) === 'Предпродакшн,Постпродакшн,Продакшн');
  ok('номера пересчитались', await page.evaluate(() =>
    [...document.querySelectorAll('#stpl-stages .stpl-stnum')].map(x => x.textContent).join(',')) === '1,2,3');
  await page.evaluate(() => { window.__save = []; stplStagesSave(); });
  await page.waitForTimeout(200);
  ok('в базу уходит тот же порядок, что на экране', await page.evaluate(() =>
    (window.STAGE_TPL.PROD[''] || []).join(',')) === 'Предпродакшн,Постпродакшн,Продакшн');

  /* ——— I. тарифы правятся на месте ——— */
  console.log('\n[I] тарифы');
  await open();
  await page.evaluate(() => stplGo('ttar'));
  await page.waitForTimeout(250);
  const tar = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('.tpl-grp .svc')].map(x => x.textContent),
    rows: [...document.querySelectorAll('.stpl-item.tar .stpl-nm')].map(x => x.textContent),
    warn: !!document.querySelector('.tpl-grp-warn'),
  }));
  ok('прайс сгруппирован по услугам', tar.groups.join(',') === 'PROD,SMM,Без услуги', tar.groups);
  ok('все тарифы на месте', tar.rows.join(',') === 'GOLD,SILVER,BASE,СИРОТА', tar.rows);
  ok('тариф без услуги помечен как нерабочий', tar.warn === true);
  await page.evaluate(() => stplTariffEdit(0));
  await page.waitForTimeout(250);
  const ed = await page.evaluate(() => ({
    open: !!document.getElementById('stpl-t-name'),
    others: [...document.querySelectorAll('.stpl-item.tar .stpl-nm')].map(x => x.textContent),
    name: document.getElementById('stpl-t-name').value,
    price: document.getElementById('stpl-t-price').value,
  }));
  ok('редактор раскрылся на месте строки', ed.open === true);
  ok('соседние тарифы при этом видны', ed.others.join(',') === 'SILVER,BASE,СИРОТА', ed.others);
  ok('поля заполнены из тарифа', ed.name === 'GOLD' && ed.price === '12000000', ed);
  await page.evaluate(() => { document.getElementById('stpl-t-price').value = '-5'; window.__toasts = []; stplTariffSave(); });
  await page.waitForTimeout(200);
  ok('отрицательная цена не сохраняется', await page.evaluate(() => window.__toasts[0]) === 'Цена — неотрицательное число');
  ok('поле подсвечено', await page.evaluate(() => document.getElementById('stpl-t-price').closest('.fld').classList.contains('err')));
  await page.evaluate(() => { document.getElementById('stpl-t-price').value = '15000000'; document.getElementById('stpl-t-name').value = 'PLATINUM'; stplTariffSave(); });
  await page.waitForTimeout(250);
  ok('тариф сохранился с новой ценой', await page.evaluate(() =>
    (window.TARIFF_TPL.find(t => t.name === 'PLATINUM') || {}).price) === 15000000);
  ok('редактор закрылся', await page.evaluate(() => !document.getElementById('stpl-t-name')));
  await page.evaluate(() => { window.__toasts = []; stplTariffEdit('new:'); });
  await page.waitForTimeout(250);
  await page.evaluate(() => { document.getElementById('stpl-t-name').value = 'BASE'; document.getElementById('stpl-t-svc').value = 'SMM'; stplTariffSave(); });
  await page.waitForTimeout(200);
  ok('два одинаковых тарифа у одной услуги не заводятся', await page.evaluate(() => window.__toasts[0]) === 'У этой услуги уже есть такой тариф');
  await page.evaluate(() => stplTariffCancel());
  await page.waitForTimeout(150);

  /* ——— J. цепочка услуга → тариф → этапы ——— */
  console.log('\n[J] переходы');
  await open();
  await page.evaluate(() => stplGo('ttar'));
  await page.waitForTimeout(250);
  await page.evaluate(() => stplToStages('PROD', 'GOLD'));
  await page.waitForTimeout(300);
  const jump = await page.evaluate(() => ({
    sec: document.querySelector('#npw-nav .npw-nav-i.on').dataset.sec,
    svc: (document.querySelector('.stpl-svc-row.on') || {}).dataset.k,
    tf: (document.querySelector('.stpl-tf-tab.on') || {}).textContent.trim(),
    stages: [...document.querySelectorAll('#stpl-stages input')].map(x => x.value),
  }));
  ok('из прайса попадаем в этапы этого тарифа', jump.sec === 'tsvc' && jump.svc === 'PROD' && jump.tf === 'GOLD', jump);
  ok('и видим именно его этапы', jump.stages.join(',') === 'Бриф,Съёмка,Монтаж,Сдача', jump.stages);

  /* ——— K. живой пример совпадает с тем, что подставится ——— */
  console.log('\n[K] живой пример');
  const demo = await page.evaluate(() => {
    const box = document.getElementById('tpl-demo');
    return { sts: [...box.querySelectorAll('.tpl-demo-st')].map(x => x.textContent.replace(/^\d+/, '')),
      real: stageSetFor('PROD', 'GOLD'),
      price: (box.querySelector('.tpl-demo-c .p') || {}).textContent,
      realPrice: svcTariffPrice('PROD', 'GOLD') };
  });
  ok('пример показывает те же этапы, что подставятся', demo.sts.join(',') === demo.real.join(','), demo);
  ok('и ту же цену', demo.price.replace(/\s| | /g, '') === (demo.realPrice.toLocaleString('ru-RU') + ' сум / мес').replace(/\s| | /g, ''), [demo.price, demo.realPrice]);
  await page.evaluate(() => { stplPickTariff(''); });
  await page.waitForTimeout(250);
  ok('смена тарифа перестраивает пример', await page.evaluate(() =>
    [...document.querySelectorAll('#tpl-demo .tpl-demo-st')].map(x => x.textContent.replace(/^\d+/, '')).join(',')) === 'Предпродакшн,Продакшн,Постпродакшн');

  /* ——— L. удаление услуги называет последствия ——— */
  console.log('\n[L] удаление услуги и тарифа');
  await open();
  await page.evaluate(() => { stplGo('tsvc'); stplSvcDel('PROD'); });
  await page.waitForTimeout(250);
  const askS = await txt('#stpl-ask-b');
  ok('сказано, сколько тарифов исчезнет', /тарифы \(2\)/.test(askS), askS);
  ok('и сколько шаблонов этапов', /шаблоны этапов \(2\)/.test(askS), askS);
  ok('и сколько проектов задето', /2 проекта/.test(askS), askS);
  await page.click('#ov-stpldel .btn-add');
  await page.waitForTimeout(250);
  const gone = await page.evaluate(() => ({ tags: PROJECT_TAGS.service.slice(), tar: window.TARIFF_TPL.length, tpl: Object.keys(window.STAGE_TPL) }));
  ok('услуга удалена вместе с тарифами и шаблонами', gone.tags.join(',') === 'SMM,DESIGN' && gone.tar === 2 && gone.tpl.indexOf('PROD') < 0, gone);
  await open();
  await page.evaluate(() => { stplGo('ttar'); stplTariffDel('PROD', 'GOLD'); });
  await page.waitForTimeout(250);
  const askT = await txt('#stpl-ask-b');
  ok('про тариф сказано, что цена перестанет подставляться', /цена перестанет подставляться/.test(askT), askT);
  ok('и что свои этапы останутся без дела', /Свои этапы тарифа \(4\)/.test(askT), askT);
  await page.click('#ov-stpldel .btn-ghost');
  await page.waitForTimeout(150);

  /* ——— M. поиск ——— */
  console.log('\n[M] поиск услуг');
  await page.evaluate(() => {
    pd2Close(); seed();
    PROJECT_TAGS.service = ['PROD', 'SMM', 'DESIGN', 'SEO', 'PPC', 'ORM', 'CRM', 'WEB', 'BRAND'];
    openTemplatesSettings(); stplGo('tsvc');
  });
  await page.waitForTimeout(300);
  ok('на длинном списке появляется поиск', await page.evaluate(() => !!document.getElementById('stpl-svc-q')));
  await page.fill('#stpl-svc-q', 'br');
  await page.waitForTimeout(200);
  ok('поиск оставляет только совпавшие', await page.evaluate(() =>
    [...document.querySelectorAll('.stpl-svc-row')].filter(r => r.style.display !== 'none').map(r => r.dataset.k).join(',')) === 'BRAND');
  ok('и не сбрасывает фокус при вводе', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'stpl-svc-q');
  await page.fill('#stpl-svc-q', 'ччч');
  await page.waitForTimeout(200);
  ok('если ничего не нашлось — так и написано', await page.evaluate(() => !!document.querySelector('.tpl-noq')));

  /* ——— N. раскладка ——— */
  console.log('\n[N] раскладка');
  for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await open();
    for (const sec of ['tcat', 'tsvc', 'ttar']) {
      await page.evaluate(s => stplGo(s), sec);
      await page.waitForTimeout(160);
      const g = await page.evaluate(() => {
        const de = document.documentElement, m = document.querySelector('#ov-pd2 .modal.npw');
        const s = document.getElementById('npw-save').getBoundingClientRect();
        return { hx: de.scrollWidth - de.clientWidth, fits: m.getBoundingClientRect().height <= innerHeight + 1,
          save: s.top >= 0 && s.bottom <= innerHeight + 1 && s.width > 0 };
      });
      ok(w + '×' + h + ' · ' + sec + ': нет горизонтальной прокрутки', g.hx === 0, g.hx);
      ok(w + '×' + h + ' · ' + sec + ': окно помещается и «Готово» видно', g.fits && g.save, g);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ——— O. движение ——— */
  console.log('\n[O] движение');
  await open();
  ok('окно въезжает анимацией', await page.evaluate(() =>
    getComputedStyle(document.querySelector('#ov-pd2 .modal.npw')).animationName) === 'npwPop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open();
  ok('при просьбе не двигать — без анимации', await page.evaluate(() =>
    getComputedStyle(document.querySelector('#ov-pd2 .modal.npw')).animationName) === 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  /* ——— P. чужие экраны ——— */
  console.log('\n[P] чужие экраны');
  await page.evaluate(() => pd2Close());
  ok('карточка нового проекта открывается как прежде', await page.evaluate(() => {
    window.__me.role = 'agency_owner'; window.agIsPM = () => true;
    openNewProject();
    const m = document.querySelector('#ov-pd2 .modal.npw');
    const okk = !!m && !m.classList.contains('npw-tpl') && !!document.getElementById('np-name');
    pd2Close(); return okk;
  }));

  /* ——— Q. ошибки ——— */
  console.log('\n[Q] ошибки');
  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read|TypeError/.test(e));
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
