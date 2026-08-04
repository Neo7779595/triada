/* probe_finnext — следующий месяц: что повторится, а что изменится.

   Повторяемость — это и есть агентство: те же проекты, те же зарплаты, тот
   же круг. Вопрос не «что случится», а «что изменится». Всё остальное
   повторяется само, и переспрашивать про него значит тратить внимание там,
   где ответ известен заранее.

   ── Расклад ─────────────────────────────────────────────────────────
   Правила платежей (повторяются каждый месяц):
     приход  APOLO      45 000 000  · 12 число
     приход  QUSHBEGI   20 000 000  · 15 число
     расход  Зарплаты   30 000 000  · 5 число
     расход  Аренда      3 000 000  · 10 число
   Плюс разовый расход 9 000 000 на прошлой неделе — он не повторяется.
   За этот месяц по факту: пришло 65 000 000, ушло 33 000 000.

   ── На бумаге ───────────────────────────────────────────────────────
   Следующий месяц по правилам: приход 65 000 000, расход 33 000 000,
   останется 32 000 000. Разовый платёж в следующий месяц не переносится —
   на то он и разовый.
   Этот месяц по факту: 65 000 000 − 33 000 000 = 32 000 000. Падения нет.

   Если убрать QUSHBEGI: приход 45 000 000, останется 12 000 000 — это
   меньше нынешних 32 000 000 больше чем на пятую часть, и модуль обязан
   сказать об этом до конца месяца, а не после. */
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
    const n = new Date();
    const d = k => { const x = new Date(); x.setDate(x.getDate() + k);
      return x.getFullYear() + '-' + z(x.getMonth() + 1) + '-' + z(x.getDate()); };
    /* Первое число месяца: операции ставим на него, чтобы проверка не
       зависела от того, какое сегодня число. */
    const first = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    window._FINOFF = 0;
    window.__me = { id: 'u1', role: 'agency_owner' }; window.tMe = () => window.__me;
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'a', name: 'APOLO', status: 'active', mrr: 45000000, cost: 0 });
    PROJECTS.push({ id: 'q', name: 'QUSHBEGI', status: 'active', mrr: 20000000, cost: 0 });
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: 'i1', op_date: first, kind: 'income', amount: 45000000, account_id: 'W', project_id: 'a' },
             { id: 'i2', op_date: first, kind: 'income', amount: 20000000, account_id: 'W', project_id: 'q' },
             { id: 'e1', op_date: first, kind: 'expense', amount: 30000000, account_id: 'W', category: 'Зарплаты' },
             { id: 'e2', op_date: first, kind: 'expense', amount: 3000000,  account_id: 'W', category: 'Аренда' } ] };
    window.FINP = [
      { id: 'p1', flow: 'in',  title: 'APOLO',    amount: 45000000, every: 'month', day_of_month: 12,
        category: 'Оплата клиента', project_id: 'a' },
      { id: 'p2', flow: 'in',  title: 'QUSHBEGI', amount: 20000000, every: 'month', day_of_month: 15,
        category: 'Оплата клиента', project_id: 'q' },
      { id: 'p3', flow: 'out', title: 'Зарплаты', amount: 30000000, every: 'month', day_of_month: 5,
        category: 'Зарплаты' },
      { id: 'p4', flow: 'out', title: 'Аренда',   amount: 3000000,  every: 'month', day_of_month: 10,
        category: 'Аренда' },
      { id: 'p5', flow: 'out', title: 'Разовый подряд', amount: 9000000, every: 'once', due_date: d(-7),
        category: 'Подрядчики' } ];
    window.FINO = []; window.FINS = {}; window.FINM = [];
    window.FINANCE = { ready: true, projects: PROJECTS, totalMrr: 65000000, totalCost: 0, profit: 65000000,
      marginPct: 100, costPct: 0, paying: 2, total: 2, avgMrr: 32500000, totalHours: 0,
      services: [], tariffs: [], snapshots: [] };
    return true;
  });
  await seed();

  console.log('[A] чего ждать в следующем месяце');
  const N = await page.evaluate(() => {
    const n = finNextNow();
    const d = document.createElement('div'); d.innerHTML = finStepNext();
    const c = [...d.querySelectorAll('.fst-3 .fst-c')].map(e => ({
      l: e.querySelector('.l').textContent, v: e.querySelector('.v').textContent.replace(/\s/g, ''),
      s: e.querySelector('.s').textContent }));
    return { inSum: n.inSum, outSum: n.outSum, rest: n.rest, c,
      note: (d.querySelector('.fst-note') || {}).textContent || '',
      warn: !!d.querySelector('.fst-note.warn'),
      btn: (d.querySelector('.fst-a .fnx-btn') || {}).textContent || '' };
  });
  ok('приход следующего месяца — 65 000 000 по двум правилам', N.inSum === 65000000, N.inSum);
  ok('разовый платёж в следующий месяц не переносится: расход 33 000 000',
    N.outSum === 33000000, N.outSum);
  ok('останется 32 000 000', N.rest === 32000000, N.rest);
  ok('и рядом стоит нынешний остаток, иначе число не с чем сравнить',
    /32 000 000/.test(N.c[2].s) && /в этом месяце/.test(N.c[2].s), N.c[2]);
  ok('падения нет — предупреждения тоже нет', N.warn === false, N.note.slice(0, 80));
  ok('в кнопке назван месяц, который проверяем', /Проверить/.test(N.btn), N.btn);

  console.log('[B] уходит клиент — модуль говорит об этом заранее');
  const D = await page.evaluate(() => {
    window.FINP = window.FINP.filter(p => p.id !== 'p2');
    const n = finNextNow();
    const d = document.createElement('div'); d.innerHTML = finStepNext();
    return { rest: n.rest, warn: (d.querySelector('.fst-note.warn') || {}).textContent || '' };
  });
  ok('останется 12 000 000 вместо 32 000 000', D.rest === 12000000, D.rest);
  ok('и сказано, на сколько меньше и о чём это может говорить',
    /меньше нынешнего на 20 000 000/.test(D.warn) && /все ли оплаты/.test(D.warn), D.warn);

  console.log('[C] месяц в минус — это не «меньше», это отдельный разговор');
  const M = await page.evaluate(() => {
    window.FINP = window.FINP.map(p => p.id === 'p1' ? Object.assign({}, p, { amount: 10000000 }) : p);
    const n = finNextNow();
    const d = document.createElement('div'); d.innerHTML = finStepNext();
    return { rest: n.rest, warn: (d.querySelector('.fst-note.warn') || {}).textContent || '' };
  });
  ok('минус 23 000 000 назван минусом', M.rest === -23000000, M.rest);
  ok('и сказано, что резать расходы нужно сейчас, а не в конце месяца',
    /закрывается в минус на 23 000 000/.test(M.warn) && /сейчас, а не в конце/.test(M.warn), M.warn);

  console.log('[D] окно: три ответа на строку и один — на всё сразу');
  await seed();
  const W = await page.evaluate(() => {
    finNextOpen();
    const rows = [...document.querySelectorAll('#ov-fin .fnx-nx:not(.sum)')].map(e => ({
      t: e.querySelector('.fnx-nx-t').firstChild.textContent,
      v: e.querySelector('.fnx-nx-v').textContent.replace(/\s/g, ''),
      chips: [...e.querySelectorAll('.fnx-nx-c')].map(c => c.textContent),
      on: (e.querySelector('.fnx-nx-c.on') || {}).textContent }));
    const sum = document.querySelector('#ov-fin .fnx-nx.sum .fnx-nx-v').textContent.replace(/\s/g, '');
    return { n: rows.length, rows, sum,
      heads: [...document.querySelectorAll('#ov-fin .fnx-nx-h')].map(e => e.textContent) };
  });
  ok('разовое правило в окно не идёт — переспрашивать про него нечего', W.n === 4, W.rows.map(r => r.t));
  ok('поступления и расходы разделены', W.heads.join('|') === 'Поступления|Расходы', W.heads);
  ok('на каждой строке три ответа и по умолчанию «Так же»',
    W.rows.every(r => r.chips.length === 3 && r.on === 'Так же'), W.rows[0]);
  ok('итог сразу считает, что получится: +32 000 000', W.sum === '+32000000', W.sum);

  console.log('[E] правки пересчитывают итог на месте');
  const E = await page.evaluate(() => {
    finNextMode(2, 'change');                       // Зарплаты → другая сумма
    document.getElementById('fnx-nx-a2').value = '36 000 000';
    finNextMode(3, 'drop');                          // Аренду убрали
    const sum = document.querySelector('#ov-fin .fnx-nx.sum .fnx-nx-v').textContent.replace(/\s/g, '');
    const off = document.querySelectorAll('#ov-fin .fnx-nx.off').length;
    return { sum, off };
  });
  /* 65 000 000 − 36 000 000 = 29 000 000: аренда убрана, зарплаты выросли. */
  ok('после правок итог 29 000 000, а не старые 32 000 000', E.sum === '+29000000', E.sum);
  ok('убранная строка видна приглушённой, а не исчезает', E.off === 1, E.off);

  console.log('[F] сохраняется только изменённое');
  const S = await page.evaluate(async () => {
    const sent = []; window.tFinSavePlan = async r => { sent.push(r); };
    window._finReload = () => {}; window.toast = m => { window.__t = m; };
    finNextSave();
    await new Promise(r => setTimeout(r, 200));
    return { sent, said: window.__t };
  });
  ok('уходит две правки, а не все четыре правила', S.sent.length === 2, S.sent);
  ok('зарплаты правятся суммой', S.sent[0].id === 'p3' && S.sent[0].amount === 36000000, S.sent[0]);
  ok('аренда уходит в архив, а не удаляется',
    S.sent[1].id === 'p4' && !!S.sent[1].archived_at && Object.keys(S.sent[1]).length === 2, S.sent[1]);

  console.log('[G] «всё как в этом месяце» — одно нажатие и ничего не пишется');
  const A = await page.evaluate(async () => {
    finNextOpen(); finNextMode(0, 'drop'); finNextAllSame();
    const on = [...document.querySelectorAll('#ov-fin .fnx-nx:not(.sum)')]
      .map(e => (e.querySelector('.fnx-nx-c.on') || {}).textContent);
    const sent = []; window.tFinSavePlan = async r => { sent.push(r); };
    let said = ''; window.toast = m => { said = m; };
    finNextSave();
    await new Promise(r => setTimeout(r, 150));
    return { on, sent, said };
  });
  ok('одна кнопка возвращает все строки в «Так же»',
    A.on.every(x => x === 'Так же'), A.on);
  ok('и тогда в базу не уходит ничего', A.sent.length === 0, A.sent);
  ok('а человеку сказано, что следующий месяц повторит этот',
    /повторит этот/.test(A.said), A.said);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
