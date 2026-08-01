/* probe_tariff — при смене тарифа честно предупреждаем, что остаток срока сгорает */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const OPTS = [
  { key: 'dtr_core',   name: 'DTR CORE',   price: 249000, quarterly_price: 498000, projects_limit: 10, kind: 'current',  allowed: true, sort: 4, feats: [] },
  { key: 'dtr_pro',    name: 'DTR PRO',    price: 299000, quarterly_price: 598000, projects_limit: 15, kind: 'upgrade',  allowed: true, sort: 5, feats: [[1, 'Больше проектов']] },
  { key: 'dtr_studio', name: 'DTR STUDIO', price: 349000, quarterly_price: 698000, projects_limit: 20, kind: 'upgrade',  allowed: true, sort: 6, feats: [] },
  { key: 'dtr_team',   name: 'DTR TEAM',   price: 149000, quarterly_price: 298000, projects_limit: 5,  kind: 'downgrade', allowed: true, sort: 2, feats: [] },
];

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.evaluate((opts) => {
    const until = new Date(Date.now() + 412 * 86400000).toISOString().slice(0, 10);
    window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG',
                    agencyPlan: 'dtr_core', agencyPaidUntil: until };
    window.tMe = () => window.__me; window.ME = window.__me; window.toast = m => { window.__toast = m; };
    window.LIVE = false; window.agIsOwner = () => true; window.agIsPayViewer = () => true;
    window.agProjUsed = () => 5;
    window.__T = opts.map(o => ({ ...o, limits: { projects: o.projects_limit } }));
    try { TARIFFS.length = 0; window.__T.forEach(t => TARIFFS.push(t)); } catch (_) {}
    window.__optsFixture = opts;
  }, OPTS);

  console.log('\n[A] витрина тарифов — предупреждение о сбросе срока');
  const page1 = await page.evaluate(() => {
    _agShowTariffsPage(window.__optsFixture);
    const n = document.querySelector('.tf-reset-note');
    if (!n) return { found: false };
    const cs = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    const tog = document.querySelector('.tf-tog-row').getBoundingClientRect();
    const sec = document.querySelector('.tf-sec');
    return { found: true, txt: n.textContent.replace(/\s+/g, ' ').trim(),
      days: (n.querySelector('b') || {}).textContent,
      display: cs.display, w: Math.round(r.width), h: Math.round(r.height),
      belowToggle: r.top >= tog.bottom - 2,
      aboveCards: sec ? r.bottom <= sec.getBoundingClientRect().top + 2 : null,
      icon: !!n.querySelector('svg') };
  });
  console.log('    ' + JSON.stringify(page1));
  ok('предупреждение есть на витрине', page1.found, page1);
  ok('в нём указан остаток текущего тарифа', /412 дней/.test(page1.days || ''), page1.days);
  ok('сказано что срок не переносится', /не переносятся/.test(page1.txt || ''), page1.txt);
  ok('сказано что продление того же тарифа прибавляется', /прибавляется к сроку/.test(page1.txt || ''), page1.txt);
  ok('стоит между переключателем и карточками', page1.belowToggle && page1.aboveCards !== false, page1);
  ok('видно и не схлопнуто', page1.display !== 'none' && page1.h > 20 && page1.w > 300, page1);

  console.log('\n[B] модалка перехода на другой тариф');
  const up = await page.evaluate(() => {
    _agCloseTariffsPage(true);
    _agPickPlanSpy = true;
    const cur = window.__T.find(t => t.key === 'dtr_core');
    const tgt = window.__T.find(t => t.key === 'dtr_pro');
    _agShowUpgradeModal(cur, tgt, { code: 'abc1234567', id: 'i1', months: 1 }, { reason: 'upgrade', months: 1 });
    const n = document.querySelector('.ag-up-reset');
    if (!n) return { found: false, html: (document.querySelector('#ov-pd2 .modal-b') || {}).innerHTML };
    const r = n.getBoundingClientRect();
    const note = document.querySelector('.ag-up-note').getBoundingClientRect();
    return { found: true, txt: n.textContent.replace(/\s+/g, ' ').trim(),
      days: (n.querySelector('b') || {}).textContent,
      h: Math.round(r.height), beforeNote: r.bottom <= note.top + 2,
      cta: (document.querySelector('#ov-pd2 .modal-f .btn-add') || {}).textContent };
  });
  console.log('    ' + JSON.stringify(up));
  ok('предупреждение есть в модалке апгрейда', up.found, up);
  ok('и там тот же остаток дней', /412 дней/.test(up.days || ''), up.days);
  ok('текст про сегодняшний отсчёт', /считается с сегодня/.test(up.txt || ''), up.txt);
  ok('стоит выше блока про оплату в боте', up.beforeNote, up);
  ok('кнопка оплаты на месте', /Оплатить в боте/.test(up.cta || ''), up.cta);

  console.log('\n[C] модалка понижения тарифа');
  const dn = await page.evaluate(() => {
    pd2Close();
    const cur = window.__T.find(t => t.key === 'dtr_core');
    const tgt = window.__T.find(t => t.key === 'dtr_team');
    _agShowUpgradeModal(cur, tgt, { code: 'abc1234567', id: 'i2', months: 1 }, { reason: 'downgrade', months: 1 });
    const n = document.querySelector('.ag-up-reset');
    return { found: !!n, title: (document.querySelector('#ov-pd2 .modal-h h3') || {}).textContent };
  });
  console.log('    ' + JSON.stringify(dn));
  ok('при понижении предупреждение тоже показывается', dn.found, dn);
  ok('заголовок про понижение', /Снизить/.test(dn.title || ''), dn.title);

  console.log('\n[D] продление того же тарифа — предупреждения быть не должно');
  const rn = await page.evaluate(() => {
    pd2Close();
    const cur = window.__T.find(t => t.key === 'dtr_core');
    _agShowRenewModal(cur, { code: 'abc1234567', id: 'i3', months: 1 }, 1);
    return { reset: !!document.querySelector('.ag-up-reset'),
      sub: (document.querySelector('#ov-pd2 .modal-h p') || {}).textContent };
  });
  console.log('    ' + JSON.stringify(rn));
  ok('в продлении сброса срока не обещаем', rn.reset === false, rn);
  ok('и показываем сколько осталось', /осталось 412/.test(rn.sub || ''), rn.sub);

  console.log('\n[E] нет срока (админ/безлимит) — молчим');
  const noDate = await page.evaluate(() => {
    pd2Close();
    window.__me.agencyPaidUntil = null;
    _agShowTariffsPage(window.__optsFixture);
    const onPage = !!document.querySelector('.tf-reset-note');
    _agCloseTariffsPage(true);
    const cur = window.__T.find(t => t.key === 'dtr_core');
    const tgt = window.__T.find(t => t.key === 'dtr_pro');
    _agShowUpgradeModal(cur, tgt, { code: 'abc1234567', id: 'i4', months: 1 }, { reason: 'upgrade', months: 1 });
    const inModal = !!document.querySelector('.ag-up-reset');
    pd2Close();
    return { onPage, inModal };
  });
  console.log('    ' + JSON.stringify(noDate));
  ok('без paid_until витрина не пугает клиента', noDate.onPage === false, noDate);
  ok('и модалка тоже', noDate.inModal === false, noDate);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[F] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
