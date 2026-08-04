/* probe_finfact — план против факта по проектам.

   В карточке проекта записано, сколько он приносит и сколько стоит. Это
   план: он не знает, заплатил ли клиент. Здесь план встречается с журналом.

   ── Расклад за август ───────────────────────────────────────────────
   APOLO   договор 10 000 000, план расходов 6 000 000
           пришло 10 000 000, потрачено 4 000 000
   RESTO   договор  6 000 000, план расходов 3 000 000
           пришло  2 000 000, потрачено 2 500 000
   ZAKAZ   договор  4 000 000 — не платил вовсе
   Закрытый проект в таблицу не идёт.
   Плюс расход 1 500 000 без проекта (аренда) и оплата 500 000 без проекта.

   ── На бумаге ───────────────────────────────────────────────────────
   APOLO: прибыль 6 000 000, маржа факт 60%, план (10−6)/10 = 40%.
   RESTO: прибыль −500 000, маржа факт −25%, план 50%. Не пришло 4 000 000.
   ZAKAZ: не пришло 4 000 000, маржи нет — делить не на что.
   Итого по договорам 20 000 000, пришло 12 000 000, не пришло 8 000 000.
   Потрачено на проекты 6 500 000, прибыль 5 500 000, маржа 46%.

   Покрытие считается по всем деньгам, а не только по живым проектам:
   поступлений привязано 19 000 000 из 19 500 000 = 97% (в том числе
   7 000 000 закрытого проекта — они привязаны, просто проект уже закрыт);
   расходов 6 500 000 из 8 000 000 = 81%. Аренда к проекту не относится и не
   должна — но сказать об этом обязаны, иначе «маржа факт» выглядит полной
   картиной, не будучи ею. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const F = await page.evaluate(() => {
    window._P = [
      { id: 'a', name: 'APOLO', mrr: 10000000, cost: 6000000, status: 'active' },
      { id: 'r', name: 'RESTO', mrr: 6000000,  cost: 3000000, status: 'active' },
      { id: 'z', name: 'ZAKAZ', mrr: 4000000,  cost: 0,       status: 'active' },
      { id: 'x', name: 'Закрыт', mrr: 9000000, cost: 0,       status: 'done' }];
    window._O = [
      { id: '1', op_date: '2026-08-03', kind: 'income',  amount: 10000000, account_id: 'W', project_id: 'a' },
      { id: '2', op_date: '2026-08-04', kind: 'expense', amount: 4000000,  account_id: 'W', project_id: 'a' },
      { id: '3', op_date: '2026-08-05', kind: 'income',  amount: 2000000,  account_id: 'W', project_id: 'r' },
      { id: '4', op_date: '2026-08-06', kind: 'expense', amount: 2500000,  account_id: 'W', project_id: 'r' },
      { id: '5', op_date: '2026-08-07', kind: 'expense', amount: 1500000,  account_id: 'W' },
      { id: '6', op_date: '2026-08-08', kind: 'income',  amount: 500000,   account_id: 'W' },
      { id: '7', op_date: '2026-08-09', kind: 'income',  amount: 7000000,  account_id: 'W', project_id: 'x' }];
    window._opt = { from: '2026-08-01', to: '2026-08-31', today: '2026-08-31' };
    const f = finFactMath(window._P, window._O, window._opt);
    const g = n => f.rows.filter(r => r.name === n)[0];
    return { f, a: g('APOLO'), r: g('RESTO'), z: g('ZAKAZ'), names: f.rows.map(r => r.name) };
  });

  console.log('[A] каждый проект — план рядом с фактом');
  ok('закрытый проект в таблицу не идёт', F.names.join(',') === 'APOLO,RESTO,ZAKAZ', F.names);
  ok('APOLO: пришло всё, потрачено меньше плана — маржа факт 60% против плановых 40%',
    F.a.got === 10000000 && F.a.spent === 4000000 && F.a.factMargin === 60 && F.a.planMargin === 40, F.a);
  ok('RESTO: пришла треть, потратили больше — маржа факт минус 25% против плановых 50%',
    F.r.got === 2000000 && F.r.spent === 2500000 && F.r.factMargin === -25 && F.r.planMargin === 50, F.r);
  ok('и это долг клиента 4 000 000, а не «недовыполнение плана»', F.r.debt === 4000000, F.r.debt);
  ok('ZAKAZ не платил — маржи нет, делить не на что', F.z.factMargin === null && F.z.debt === 4000000, F.z);

  console.log('[B] свод');
  ok('по договорам 20 000 000, пришло 12 000 000',
    F.f.plan === 20000000 && F.f.got === 12000000, [F.f.plan, F.f.got]);
  ok('не пришло 8 000 000', F.f.debt === 8000000, F.f.debt);
  ok('потрачено на проекты 6 500 000, прибыль 5 500 000',
    F.f.spent === 6500000 && F.f.profit === 5500000, [F.f.spent, F.f.profit]);
  ok('маржа факт по портфелю 46%', F.f.factMargin === 46, F.f.factMargin);

  console.log('[C] покрытие названо честно');
  ok('поступлений привязано 97%', F.f.cover.inPct === 97, F.f.cover);
  ok('расходов — 81%: аренда к проекту не относится', F.f.cover.outPct === 81, F.f.cover);
  ok('деньги закрытого проекта считаются привязанными — они и привязаны',
    F.f.cover.inLinked === 19000000 && F.f.cover.inTotal === 19500000, F.f.cover);

  console.log('[D] чего таблица не считает');
  const E = await page.evaluate(() => {
    const add = extra => finFactMath(window._P, window._O.concat(extra), window._opt);
    const back = add([{ id: 'b', op_date: '2026-08-10', kind: 'refund_out', amount: 1000000, account_id: 'W', project_id: 'a' }]);
    const dead = add([{ id: 'v', op_date: '2026-08-10', kind: 'income', amount: 5000000, account_id: 'W', project_id: 'r',
      voided_at: '2026-08-11T00:00:00Z' }]);
    const own = add([{ id: 'o', op_date: '2026-08-10', kind: 'owner_out', amount: 3000000, account_id: 'W', project_id: 'a' }]);
    const late = add([{ id: 'l', op_date: '2026-09-10', kind: 'income', amount: 3000000, account_id: 'W', project_id: 'z' }]);
    const g = (f, n) => f.rows.filter(r => r.name === n)[0];
    return { back: g(back, 'APOLO').got, dead: g(dead, 'RESTO').got,
      own: g(own, 'APOLO').spent, late: g(late, 'ZAKAZ').got };
  });
  ok('возврат клиенту уменьшает пришедшее, а не увеличивает расход', E.back === 9000000, E.back);
  ok('отменённая оплата в факт не попадает', E.dead === 2000000, E.dead);
  ok('изъятие собственника расходом проекта не становится', E.own === 4000000, E.own);
  ok('оплата за пределами периода в этот месяц не считается', E.late === 0, E.late);

  console.log('[E] на экране');
  const V = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    /* PROJECTS объявлен через let: присвоение window.PROJECTS создаст второе
       поле, а модуль продолжит читать первое. Правим сам массив. */
    PROJECTS.length = 0; window._P.forEach(p => PROJECTS.push(p));
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: window._O.map(o => Object.assign({}, o, { op_date: td })) };
    window.FINP = []; window.FINO = []; window.FINS = {};
    const d = document.createElement('div'); d.innerHTML = finFactBlock();
    return { rows: d.querySelectorAll('.fnx-fc:not(.hd):not(.tot)').length,
      tot: (d.querySelector('.fnx-fc.tot') || {}).textContent || '',
      head: (d.querySelector('.fnx-fc.hd') || {}).textContent || '',
      cov: (d.querySelector('.fnx-fc-cov') || {}).textContent || '',
      thin: !!d.querySelector('.fnx-fc-cov.thin'),
      txt: (d.textContent || '').replace(/\s+/g, ' ') };
  });
  ok('на экране три строки — по числу живых проектов', V.rows === 3, V.rows);
  ok('и итоговая строка, в которой живут бывшие «MRR» и «плановая прибыль»',
    V.tot && /20 000 000/.test(V.tot) && /12 000 000/.test(V.tot), V.tot);
  ok('смета расходов стоит в той же строке, что и факт',
    /СМЕТА/i.test(V.head) && /ПОТРАЧЕНО/i.test(V.head), V.head);
  ok('план по марже стоит рядом с фактом', /план 40%/.test(V.txt), V.txt.slice(0, 200));
  ok('покрытие названо в процентах', /привязано поступлений 97% и расходов 81%/.test(V.cov), V.cov);
  ok('привязано больше семидесяти процентов — таблица не помечена неполной',
    V.thin === false, V.thin);
  /* А вот когда привязана только часть, «маржа факт» обязана сказать о себе
     правду: это маржа тех расходов, что к проектам привязали. */
  const THIN = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window.FINX.ops = window.FINX.ops.concat([
      { id: 'big', op_date: td, kind: 'expense', amount: 9000000, account_id: 'W' }]);
    const d = document.createElement('div'); d.innerHTML = finFactBlock();
    return { thin: !!d.querySelector('.fnx-fc-cov.thin'),
      cov: (d.querySelector('.fnx-fc-cov') || {}).textContent || '' };
  });
  ok('крупный расход мимо проектов помечает таблицу неполной',
    THIN.thin === true && /не вся картина/.test(THIN.cov), THIN);

  console.log('[F] шаг 2: таблица живёт внутри шага, а не рядом с тремя копиями себя');
  /* Раньше на экране стояли четыре ответа на один вопрос: столбики маржи по
     сметам, карточки P&L по сметам, эта таблица по журналу и полоса
     портфеля. Остался один — таблица. Всё, что было полезного в остальных,
     переехало внутрь шага: месяц в шапку, оценки портфеля — под «Подробно». */
  const ST = await page.evaluate(() => {
    window.FINANCE = { ready: true, totalMrr: 13500000, totalCost: 6600000, profit: 6900000,
      marginPct: 51, costPct: 49, paying: 3, total: 3, avgMrr: 4500000, profitPerHour: 168240,
      totalHours: 120, concentrationPct: 48, concentrationTop: 'RESTO',
      newMrr: 3000000, churnMrr: 500000, services: [], tariffs: [] };
    window.FINP = [];                       // правил платежей нет ни по одному проекту
    const d = document.createElement('div'); d.innerHTML = finStepProjects();
    return { n: (d.querySelector('.fst-n') || {}).textContent || '',
      title: (d.querySelector('.fst-t') || {}).textContent || '',
      mon: !!d.querySelector('.fst-mon'),
      warn: (d.querySelector('.fst-warn') || {}).textContent || '',
      rows: d.querySelectorAll('.fnx-fc:not(.hd):not(.tot)').length,
      charts: d.querySelectorAll('.fin-chart, .pl-row, .fnx-pts').length,
      deep: (d.querySelector('.fst-more summary') || {}).textContent || '',
      conc: (() => { const c = Array.from(d.querySelectorAll('.fst-more .fst-c'))
        .filter(e => /Концентрация/.test((e.querySelector('.l') || {}).textContent || ''))[0];
        return c ? (c.querySelector('.v') || {}).textContent : ''; })() };
  });
  ok('это шаг 2 и он называется «Проекты»', ST.n === '2' && ST.title === 'Проекты', ST);
  ok('месяц переключается прямо в шапке шага', ST.mon === true, ST.mon);
  ok('таблица план-факт осталась одна: три строки живых проектов', ST.rows === 3, ST.rows);
  ok('столбиков маржи, карточек P&L и полосы портфеля больше нет', ST.charts === 0, ST.charts);
  ok('про проекты без правил платежей сказано, что маржа по ним завышена',
    /маржа по ним завышена/.test(ST.warn), ST.warn);
  ok('оценки портфеля убраны под «Подробно», а не стоят шестью плитками',
    /ПОДРОБНО/i.test(ST.deep), ST.deep);
  /* Концентрация раньше стояла на двух экранах разными числами: 48% от суммы
     договоров и 45% от прибыли под одной подписью. Теперь она одна и считается
     от факта — от денег, которые действительно пришли за месяц. */
  ok('концентрация считается от прихода, а не от суммы договоров: 10 из 19,5 млн — 51%',
    ST.conc === '51%', ST.conc);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
