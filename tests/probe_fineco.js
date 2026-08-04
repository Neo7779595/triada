/* probe_fineco — экономика проекта: кому мы платим с этого дохода.

   Проект, по которому не заведено ни одного правила платежа, в таблице
   выглядит идеальным: «пришло» есть, «потрачено» пусто, маржа 100%. Это
   самая дорогая неправда в модуле, и чинится она вопросом, заданным
   вовремя, а не предупреждением внизу экрана.

   ── Расклад ─────────────────────────────────────────────────────────
   APOLO: договор 45 000 000, смета — зарплаты 18 000 000 (Абдурауф),
          подряд 7 000 000. Правил платежей ещё нет.
   QUSHBEGI: договор 20 000 000, правило прихода уже заведено.

   ── На бумаге ───────────────────────────────────────────────────────
   Мастер предзаполняет приход 45 000 000 и две строки расхода на
   18 000 000 и 7 000 000 из сметы — переспрашивать то, что человек уже
   вводил, значит получить брошенную на середине настройку.
   Проверка: 45 000 000 − 25 000 000 = 20 000 000, маржа 44% — «нормальная».
   После сохранения уходит три правила: одно на приход и два на расход,
   все с project_id и пометкой auto_src=eco. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const seed = () => page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window._FINOFF = 0;
    window.__me = { id: 'u1', role: 'agency_owner' }; window.tMe = () => window.__me;
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'a', name: 'APOLO', status: 'active', mrr: 45000000, cost: 25000000,
      finance: { salaries: [{ name: 'SMM', staffName: 'Абдурауф', amount: 18000000 }],
                 projex: [{ name: 'Подряд', amount: 7000000 }] } });
    PROJECTS.push({ id: 'q', name: 'QUSHBEGI', status: 'active', mrr: 20000000, cost: 0 });
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [{ id: 'i', op_date: td, kind: 'income', amount: 45000000, account_id: 'W', project_id: 'a' }] };
    window.FINP = [{ id: 'pq', flow: 'in', title: 'QUSHBEGI', amount: 20000000, every: 'month',
      day_of_month: 12, category: 'Оплата клиента', project_id: 'q', auto_src: 'eco' }];
    window.FINO = []; window.FINS = {}; window.FINM = [];
    window.FINANCE = { ready: true, projects: PROJECTS, totalMrr: 65000000, totalCost: 25000000,
      profit: 40000000, marginPct: 62, costPct: 38, paying: 2, total: 2, avgMrr: 32500000,
      totalHours: 0, services: [], tariffs: [], snapshots: [] };
    return true;
  });
  await seed();

  console.log('[A] модуль сам спрашивает про ненастроенные проекты');
  const B = await page.evaluate(() => {
    const d = document.createElement('div'); d.innerHTML = finStepProjects();
    const w = d.querySelector('.fst-warn');
    return { txt: (w || {}).textContent || '', btn: (w && w.querySelector('button') || {}).getAttribute
      ? w.querySelector('button').getAttribute('onclick') : '' };
  });
  ok('сказано, что по одному проекту не задано, кому мы платим',
    /У 1 проекта не задано/.test(B.txt), B.txt);
  ok('и что из-за этого маржа завышена, а не просто «настройте»',
    /маржа по ним завышена/.test(B.txt), B.txt);
  ok('кнопка ведёт в мастер экономики именно этого проекта',
    /finEcoOpen\('a'\)/.test(B.btn), B.btn);

  console.log('[B] шаг 1 — сколько платит клиент');
  const S1 = await page.evaluate(() => {
    finEcoOpen('a');
    const E = window._FINECO;
    return { step: E.step, amount: E.inc.amount, rows: E.rows.length,
      field: (document.getElementById('fnx-ec-am') || {}).value,
      dots: [...document.querySelectorAll('.fnx-eco-dots span')].map(e => e.className),
      title: (document.querySelector('#ov-fin .modal-h h3') || {}).textContent || '' };
  });
  ok('окно открылось на проекте APOLO', /APOLO/.test(S1.title), S1.title);
  ok('сумма договора подставлена, а не спрошена заново',
    S1.amount === 45000000 && S1.field === '45 000 000', [S1.amount, S1.field]);
  ok('шагов три и первый подсвечен', S1.dots.length === 3 && S1.dots[0] === 'on', S1.dots);

  console.log('[C] шаг 2 — строки расхода берутся из сметы');
  const S2 = await page.evaluate(() => {
    document.getElementById('fnx-ec-am').value = '45 000 000';
    finEcoStep(2);
    const rows = [...document.querySelectorAll('.fnx-eco-r')].map((r, i) => ({
      t: (document.getElementById('fnx-ec-t' + i) || {}).value,
      w: (document.getElementById('fnx-ec-w' + i) || {}).value,
      a: (document.getElementById('fnx-ec-a' + i) || {}).value }));
    return { rows, n: rows.length, native: document.querySelectorAll('#ov-fin select, #ov-fin input[type=date]').length };
  });
  ok('две строки из сметы: зарплата и подряд', S2.n === 2, S2.rows);
  ok('суммы и исполнитель подставлены', S2.rows[0].a === '18 000 000'
    && /Абдурауф/.test(S2.rows[0].w) && S2.rows[1].a === '7 000 000', S2.rows);
  ok('в окне нет ни одного системного списка и календаря', S2.native === 0, S2.native);

  console.log('[D] шаг 3 — что из этого получается');
  const S3 = await page.evaluate(() => {
    finEcoStep(3);
    const c = [...document.querySelectorAll('#ov-fin .fst-c')].map(e => ({
      l: e.querySelector('.l').textContent, v: e.querySelector('.v').textContent.replace(/\s/g, ''),
      s: e.querySelector('.s').textContent }));
    return { c, hint: (document.querySelector('#ov-fin .fnx-hint') || {}).textContent || '' };
  });
  ok('клиент платит 45 000 000', S3.c[0].v === '+45000000', S3.c[0]);
  ok('мы платим 25 000 000', S3.c[1].v === '−25000000', S3.c[1]);
  ok('остаётся 20 000 000 при марже 44%',
    S3.c[2].v === '+20000000' && /44%/.test(S3.c[2].s), S3.c[2]);
  ok('и сказано словами, хороша ли такая маржа', /Нормальная маржа/.test(S3.hint), S3.hint.slice(0, 90));

  console.log('[E] сохранение превращает ввод в правила платежей');
  const SV = await page.evaluate(async () => {
    const sent = []; window.tFinSavePlan = async r => { sent.push(r); };
    window._finReload = () => {}; window.toast = m => { window.__t = m; };
    finEcoSave();
    await new Promise(r => setTimeout(r, 200));
    return sent;
  });
  ok('уходит три правила: приход и два расхода', SV.length === 3, SV.map(r => r.flow));
  ok('приход — ежемесячное правило с днём и категорией',
    SV[0].flow === 'in' && SV[0].amount === 45000000 && SV[0].every === 'month'
    && SV[0].day_of_month === 5 && SV[0].category === 'Оплата клиента', SV[0]);
  ok('все три привязаны к проекту и помечены источником',
    SV.every(r => r.project_id === 'a' && r.auto_src === 'eco'), SV.map(r => [r.project_id, r.auto_src]));
  ok('в расходе сохранено, кому платим',
    SV[1].flow === 'out' && SV[1].counterparty === 'Абдурауф' && SV[1].amount === 18000000, SV[1]);

  console.log('[F] повторный вход правит то же, а не заводит второе');
  const RE = await page.evaluate(async () => {
    window.FINP = window.FINP.concat([
      { id: 'x1', flow: 'in',  title: 'APOLO', amount: 45000000, every: 'month', day_of_month: 5,
        category: 'Оплата клиента', project_id: 'a', auto_src: 'eco' },
      { id: 'x2', flow: 'out', title: 'SMM', amount: 18000000, every: 'month', day_of_month: 10,
        category: 'Зарплаты', counterparty: 'Абдурауф', project_id: 'a', auto_src: 'eco' }]);
    finEcoOpen('a');
    const loaded = { amount: window._FINECO.inc.amount, incId: window._FINECO.inc.id,
      rows: window._FINECO.rows.map(r => [r.id, r.amount]) };
    finEcoDel(0);                                  // убрали единственную строку расхода
    const sent = []; window.tFinSavePlan = async r => { sent.push(r); };
    finEcoStep(3); finEcoSave();
    await new Promise(r => setTimeout(r, 200));
    return { loaded, sent };
  });
  ok('мастер подтянул уже заведённые правила, а не смету',
    RE.loaded.incId === 'x1' && RE.loaded.rows.length === 1 && RE.loaded.rows[0][0] === 'x2', RE.loaded);
  ok('приход правится по id, а не создаётся вторым', RE.sent[0].id === 'x1', RE.sent[0]);
  /* Удалённое правило не стирается: по нему могли пройти платежи, и
     операция, потерявшая пару, перестала бы находить свой план. */
  ok('убранная строка уходит в архив с датой, а не удаляется',
    RE.sent.length === 2 && RE.sent[1].id === 'x2' && !!RE.sent[1].archived_at
    && Object.keys(RE.sent[1]).length === 2, RE.sent[1]);

  console.log('[G] настроили один — предлагаем следующий');
  const NX = await page.evaluate(() => {
    window.FINP = [{ id: 'x1', flow: 'in', title: 'APOLO', amount: 45000000, every: 'month',
      day_of_month: 5, project_id: 'a', auto_src: 'eco' }];
    let said = ''; window.toast = m => { said = m; };
    finEcoNext();
    return said;
  });
  ok('модуль сам говорит, сколько проектов осталось', /Осталось настроить: 1/.test(NX), NX);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
