/* probe_cpsend — отправка листа клиенту.
   Отправляют не только контент-план: тем же экраном уходит конкурентный
   анализ, медиаплан и что угодно ещё. Значит название спрашивают, а не
   подставляют из внутреннего имени листа — и одно и то же название должно
   оказаться в кабинете клиента, в снимке и в уведомлении. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* Онлайн-режим подделан целиком: настоящая база в пробе недоступна, а вся
   проверка — про то, какое имя куда уходит. */
const setup = () => {
  window.__t = ''; window.toast = t => { window.__t = String(t); };
  window.__ups = []; window.__ntf = [];
  window.LIVE = true;
  window.SB = {
    from(t) {
      return {
        upsert(row) { window.__ups.push({ t, row }); return Promise.resolve({ error: null }); },
        select() { return { eq() { return { maybeSingle: () => Promise.resolve({ data: null }), then: r => r({ data: [] }) }; } }; },
      };
    },
  };
  window.tgNotify = (pid, ev, data) => { window.__ntf.push({ pid, ev, data }); };
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.TEAM = [];
  window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agIsPM = () => true;
  window.giEnsureStatus = async () => ({ status: 'inactive' });
  window.tLoadProjectWork = null; window.tLoadProjectToday = null; window.cpLoadServer = async () => { };
  window.cpPersist = () => { };
  PROJECTS = [{
    id: 'p1', name: 'Qushbegi Milliy Taomlar', status: 'active', _stages: [], _tasks: [], _appr: [], _reports: [],
    _cp: {
      books: [{ id: 'bk1', name: 'Контент-план' }],
      activeBook: 'bk1', active: 'sh1',
      sheets: [{
        id: 'sh1', book: 'bk1', name: 'ИЮЛЬ', color: 'teal', hidden: false,
        cols: [{ id: 'c1', name: 'Дата', type: 'date' }, { id: 'c2', name: 'Тема', type: 'text' }],
        rows: [{ id: 'r1', c: { c1: '2026-07-01', c2: 'Плов' } }],
      }],
    },
  }];
  window.PROJECTS = PROJECTS;
  openProject(0);
  pdTab('content');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(300);

  console.log('\n[A] кнопка спрашивает название, а не отправляет молча');
  const A = await page.evaluate(() => {
    const btn = document.querySelector('.cp-send');
    const before = window.__ups.length;
    btn.click();
    const i = document.getElementById('cp-send-name');
    return {
      onclick: btn.getAttribute('onclick'),
      opened: !!i, value: i ? i.value : null,
      sentImmediately: window.__ups.length > before,
      title: (document.querySelector('#ov-pd2 .modal-h h3') || {}).textContent,
      hint: (document.getElementById('ov-pd2') || {}).textContent || '',
    };
  });
  ok('кнопка «Отправить на согласование» открывает окно, а не шлёт сразу',
    /cpSendAsk/.test(A.onclick) && A.opened && !A.sentImmediately, A);
  ok('поле подставлено именем листа', A.value === 'ИЮЛЬ', A.value);
  ok('окно объясняет, где это название увидят',
    /кабинете клиента/.test(A.hint) && /Telegram/.test(A.hint), A.hint.slice(0, 120));
  ok('сказано, что внутреннее имя листа не меняется',
    /внутри агентства/i.test(A.hint) && A.hint.indexOf('ИЮЛЬ') >= 0, A.hint.slice(0, 200));

  console.log('\n[B] набранное название уходит во все три места разом');
  const B = await page.evaluate(async () => {
    const i = document.getElementById('cp-send-name');
    i.value = 'Конкурентный анализ';
    cpSendGo();
    await new Promise(r => setTimeout(r, 250));
    const up = window.__ups.filter(x => x.t === 'content_shares').pop();
    const nt = window.__ntf.filter(x => x.ev === 'content_ready').pop();
    const sh = PROJECTS[0]._cp.sheets[0];
    return {
      closed: !document.getElementById('cp-send-name'),
      shareName: up ? up.row.name : null,
      snapName: up ? up.row.data.name : null,
      notify: nt ? nt.data.title : null,
      sheetName: sh.name, clTitle: sh.clTitle,
      toast: window.__t,
    };
  });
  ok('окно закрывается после отправки', B.closed, B);
  ok('в кабинет клиента лист уходит под набранным названием', B.shareName === 'Конкурентный анализ', B.shareName);
  ok('и снимок подписан так же', B.snapName === 'Конкурентный анализ', B.snapName);
  ok('и в Telegram уходит оно же', B.notify === 'Конкурентный анализ', B.notify);
  ok('внутреннее имя листа не тронуто', B.sheetName === 'ИЮЛЬ', B.sheetName);
  ok('название запомнено на листе', B.clTitle === 'Конкурентный анализ', B.clTitle);
  ok('подтверждение называет то, что отправили', /Конкурентный анализ/.test(B.toast), B.toast);

  console.log('\n[C] расхождение имён не живёт молча');
  const C = await page.evaluate(() => {
    cpRerender();
    const chip = document.querySelector('.cp-id-cl');
    return { has: !!chip, txt: chip ? chip.textContent.trim() : null,
      name: (document.querySelector('.cp-id-name') || {}).textContent };
  });
  ok('в шапке листа видно, под каким названием он у клиента',
    C.has && /Конкурентный анализ/.test(C.txt), C);
  ok('внутреннее имя при этом на месте', C.name === 'ИЮЛЬ', C.name);

  console.log('\n[D] повторная отправка помнит название');
  const D = await page.evaluate(() => {
    document.querySelector('.cp-send').click();
    const i = document.getElementById('cp-send-name');
    return { value: i ? i.value : null, btn: (document.querySelector('#ov-pd2 .btn-add') || {}).textContent,
      head: (document.querySelector('#ov-pd2 .modal-h h3') || {}).textContent };
  });
  ok('поле подставлено прежним названием, а не именем листа', D.value === 'Конкурентный анализ', D.value);
  ok('окно говорит «обновить», раз лист уже у клиента',
    /Обновить/i.test(D.head) && /Обновить/i.test(D.btn), D);

  console.log('\n[E] пустое поле не стирает название');
  const E = await page.evaluate(async () => {
    const i = document.getElementById('cp-send-name');
    i.value = '   ';
    cpSendGo();
    await new Promise(r => setTimeout(r, 250));
    const up = window.__ups.filter(x => x.t === 'content_shares').pop();
    return { name: up ? up.row.name : null, clTitle: PROJECTS[0]._cp.sheets[0].clTitle };
  });
  ok('пустое поле оставляет прежнее название, а не «undefined»',
    E.name === 'Конкурентный анализ' && E.clTitle === 'Конкурентный анализ', E);

  console.log('\n[F] лист без названия для клиента уходит под своим именем');
  const F = await page.evaluate(async () => {
    const sh = PROJECTS[0]._cp.sheets[0];
    delete sh.clTitle;
    cpRerender();
    const chip = document.querySelector('.cp-id-cl');
    document.querySelector('.cp-send').click();
    const i = document.getElementById('cp-send-name');
    const v = i.value;
    cpSendGo();
    await new Promise(r => setTimeout(r, 250));
    const up = window.__ups.filter(x => x.t === 'content_shares').pop();
    return { chip: !!chip, prefill: v, name: up ? up.row.name : null };
  });
  ok('пока названия нет, лишней плашки в шапке тоже нет', F.chip === false, F);
  ok('поле подставлено именем листа', F.prefill === 'ИЮЛЬ', F.prefill);
  ok('и клиенту уходит имя листа', F.name === 'ИЮЛЬ', F.name);

  console.log('\n[G] длинное название обрезается по разумной границе');
  const G = await page.evaluate(async () => {
    document.querySelector('.cp-send').click();
    const i = document.getElementById('cp-send-name');
    const max = i.getAttribute('maxlength');
    i.value = 'я'.repeat(200);
    cpSendGo();
    await new Promise(r => setTimeout(r, 250));
    return { max, len: (PROJECTS[0]._cp.sheets[0].clTitle || '').length };
  });
  ok('поле ограничено по длине и значение не растёт бесконечно',
    G.max === '80' && G.len === 80, G);

  const bad = errs.filter(x => /SyntaxError|is not defined|Cannot read|Cannot set/.test(x));
  console.log('\n[H] ошибки страницы');
  ok('нет ошибок исполнения', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
