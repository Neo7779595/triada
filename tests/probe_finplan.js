/* probe_finplan — планы платежей и число «Свободно».

   «Есть 27 миллионов» — не ответ на вопрос «можно ли сегодня взять миллион».
   Ответ даёт прогон остатка по дням: месяц может закрыться в плюсе и всё
   равно провалиться десятого числа, и по итоговой сумме этого не видно.

   ── Исходное ─────────────────────────────────────────────────────────
   Сегодня 1 августа. Оборотная карта 8 000 000, резерв 4 000 000.
   Планы: зарплаты 5-го 6 000 000, аренда 10-го 1 500 000, налог 25-го
   900 000, подписки 28-го 400 000; поступления — Qushbegi 12-го 4 000 000
   и разовое 20 августа 6 500 000.

   ── Прогон оборотных ────────────────────────────────────────────────
     01  старт                8 000 000
     05  −6 000 000           2 000 000
     10  −1 500 000             500 000  ← самая низкая точка
     12  +4 000 000           4 500 000
     20  +6 500 000          11 000 000
     25  −900 000            10 100 000
     28  −400 000             9 700 000

   Свободно сегодня = 500 000: больше взять нельзя, десятого не хватит.
   Без единого поступления: 8 000 000 −6 000 000 −1 500 000 −900 000
   −400 000 = −800 000, то есть свободно 0. Оба числа показываем.

   ── Февральская проверка ────────────────────────────────────────────
   Правило «31-го числа» в феврале даёт 28-е (или 29-е в високосном), а не
   пропускает месяц: платёж не исчезает оттого, что в месяце меньше дней. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  console.log('[A] правило раскладывается в даты');
  const D = await page.evaluate(() => {
    const mk = (o) => Object.assign({ id: 'x', flow: 'out', title: 'т', amount: 1, every: 'month' }, o);
    return {
      three: finPlanDates(mk({ day_of_month: 10 }), '2026-08-01', '2026-10-31'),
      feb: finPlanDates(mk({ day_of_month: 31 }), '2026-02-01', '2026-02-28'),
      febLeap: finPlanDates(mk({ day_of_month: 31 }), '2028-02-01', '2028-02-29'),
      once: finPlanDates(mk({ every: 'once', due_date: '2026-08-20' }), '2026-08-01', '2026-08-31'),
      onceOut: finPlanDates(mk({ every: 'once', due_date: '2026-09-20' }), '2026-08-01', '2026-08-31'),
      window: finPlanDates(mk({ day_of_month: 5, starts_on: '2026-09-01', ends_on: '2026-10-31' }), '2026-08-01', '2026-12-31'),
      arch: finPlanDates(mk({ day_of_month: 5, archived_at: '2026-01-01T00:00:00Z' }), '2026-08-01', '2026-08-31'),
      period: [finPlanPeriod(mk({ day_of_month: 10 }), '2026-08-10'),
               finPlanPeriod(mk({ every: 'once', due_date: '2026-08-20' }), '2026-08-20')],
    };
  });
  ok('за три месяца — три даты', D.three.join(',') === '2026-08-10,2026-09-10,2026-10-10', D.three);
  ok('31-е в феврале — это 28-е, а не пропуск месяца', D.feb.join(',') === '2026-02-28', D.feb);
  ok('в високосном — 29-е', D.febLeap.join(',') === '2028-02-29', D.febLeap);
  ok('разовый платёж попадает в горизонт один раз', D.once.join(',') === '2026-08-20', D.once);
  ok('разовый за горизонтом не попадает вовсе', D.onceOut.length === 0, D.onceOut);
  ok('окно действия правила соблюдается', D.window.join(',') === '2026-09-05,2026-10-05', D.window);
  ok('снятое с учёта правило дат не даёт', D.arch.length === 0, D.arch);
  ok('месячный платёж закрывается месяцем, разовый — своей датой',
    D.period.join(',') === '2026-08-01,2026-08-20', D.period);

  const seed = () => page.evaluate(() => {
    window._A = [
      { id: 'W', name: 'Карта', kind: 'card', opening_balance: 8000000, sort: 1 },
      { id: 'R', name: 'Резерв', kind: 'card', opening_balance: 4000000, sort: 2, is_reserve: true }];
    window._P = [
      { id: 'p1', flow: 'out', title: 'Зарплаты', amount: 6000000, every: 'month', day_of_month: 5 },
      { id: 'p2', flow: 'out', title: 'Аренда',   amount: 1500000, every: 'month', day_of_month: 10 },
      { id: 'p3', flow: 'out', title: 'Налог',    amount: 900000,  every: 'month', day_of_month: 25 },
      { id: 'p4', flow: 'out', title: 'Подписки', amount: 400000,  every: 'month', day_of_month: 28 },
      { id: 'p5', flow: 'in',  title: 'Qushbegi', amount: 4000000, every: 'month', day_of_month: 12 },
      { id: 'p6', flow: 'in',  title: 'Два клиента', amount: 6500000, every: 'once', due_date: '2026-08-20' }];
  });

  console.log('[B] «Свободно» — прогон по дням, а не вычитание итогов');
  await seed();
  const F = await page.evaluate(() => {
    const f = finFree(window._A, [], window._P, { today: '2026-08-01', to: '2026-08-31' });
    return { free: f.free, solo: f.freeSolo, end: f.end, min: f.min, minDate: f.minDate,
      gap: f.gapDate, out: f.outSum, in: f.inSum, dep: f.dependsOn.length,
      work: f.working, res: f.reserve, days: f.days.length };
  });
  ok('оборотные 8 000 000, резерв в них не входит', F.work === 8000000 && F.res === 4000000, F);
  ok('месяц закрывается на 9 700 000', F.end === 9700000, F.end);
  ok('и всё-таки свободно только 500 000 — из-за десятого числа',
    F.free === 500000 && F.minDate === '2026-08-10', [F.free, F.minDate]);
  ok('разрыва при плане нет', F.gap === null, F.gap);
  ok('если не заплатит никто — свободно ноль', F.solo === 0, F.solo);
  ok('обязательства 8 800 000, ожидания 10 500 000',
    F.out === 8800000 && F.in === 10500000, [F.out, F.in]);
  ok('поступления, на которых держится расчёт, названы', F.dep === 2, F.dep);
  ok('в прогоне шесть событий', F.days === 6, F.days);

  console.log('[C] взял миллион — разрыв десятого');
  const G = await page.evaluate(() => {
    const ops = [{ id: 'o', op_date: '2026-08-01', kind: 'owner_out', amount: 1000000, account_id: 'W' }];
    const f = finFree(window._A, ops, window._P, { today: '2026-08-01', to: '2026-08-31' });
    return { work: f.working, free: f.free, gap: f.gapDate, amt: f.gapAmt, end: f.end };
  });
  ok('оборотные упали до 7 000 000', G.work === 7000000, G.work);
  ok('разрыв 10 августа на 500 000', G.gap === '2026-08-10' && G.amt === 500000, G);
  ok('и «свободно» честно обнулилось', G.free === 0, G.free);
  ok('а месяц всё равно закрывается плюсом 8 700 000: по итогу разрыв не виден',
    G.end === 8700000, G.end);

  console.log('[D] оплата плана считается по журналу, а не по галочке');
  const P = await page.evaluate(() => {
    const paid = [{ id: 'o1', op_date: '2026-08-05', kind: 'expense', amount: 6000000, account_id: 'W',
      plan_id: 'p1', plan_period: '2026-08-01' }];
    const part = [{ id: 'o2', op_date: '2026-08-05', kind: 'expense', amount: 2000000, account_id: 'W',
      plan_id: 'p1', plan_period: '2026-08-01' }];
    const dead = [{ id: 'o3', op_date: '2026-08-05', kind: 'expense', amount: 6000000, account_id: 'W',
      plan_id: 'p1', plan_period: '2026-08-01', voided_at: '2026-08-06T00:00:00Z' }];
    const other = [{ id: 'o4', op_date: '2026-09-05', kind: 'expense', amount: 6000000, account_id: 'W',
      plan_id: 'p1', plan_period: '2026-09-01' }];
    const b = (o) => finPlanBoard(window._P, o, { from: '2026-08-01', to: '2026-08-31' })
      .items.filter(i => i.planId === 'p1')[0];
    return { none: b([]), paid: b(paid), part: b(part), dead: b(dead), other: b(other),
      freePaid: finFree(window._A, paid, window._P, { today: '2026-08-01', to: '2026-08-31' }) };
  });
  ok('неоплаченный план открыт и должен всю сумму',
    P.none.status === 'open' && P.none.left === 6000000, P.none);
  ok('проводка на всю сумму закрывает план', P.paid.status === 'done' && P.paid.left === 0, P.paid);
  ok('частичная оплата помечена частичной и должна остаток',
    P.part.status === 'part' && P.part.left === 4000000, P.part);
  ok('отменённая проводка план не закрывает', P.dead.status === 'open', P.dead);
  ok('оплата за другой месяц этот месяц не закрывает', P.other.status === 'open', P.other);
  /* Проводка датирована пятым числом, а «сегодня» — первое: в остаток она
     ещё не вошла, но деньги уже расписаны. Если её не учесть в прогоне,
     «свободно» вырастет ровно на её сумму — на пустом месте. */
  ok('платёж, записанный будущим днём, не раздувает «свободно»',
    P.freePaid.free === 500000 && P.freePaid.working === 8000000,
    [P.freePaid.free, P.freePaid.working]);

  console.log('[E] резерв в прогон не попадает');
  const R = await page.evaluate(() => {
    const toRes = [{ id: 'r1', op_date: '2026-08-15', kind: 'transfer', amount: 1000000, account_id: 'W', account_to: 'R' }];
    const inRes = [{ id: 'r2', op_date: '2026-08-15', kind: 'expense', amount: 1000000, account_id: 'R' }];
    const wToW = [{ id: 'r3', op_date: '2026-08-15', kind: 'transfer', amount: 1000000, account_id: 'W', account_to: 'W2' }];
    const A2 = window._A.concat([{ id: 'W2', name: 'Наличка', kind: 'cash', opening_balance: 0, sort: 3 }]);
    const f = (a, o) => finFree(a, o, window._P, { today: '2026-08-01', to: '2026-08-31' });
    return { base: f(window._A, []).end, toRes: f(window._A, toRes).end,
      inRes: f(window._A, inRes).end, wToW: f(A2, wToW).end };
  });
  ok('перевод в резерв уменьшает оборотные', R.toRes === R.base - 1000000, [R.base, R.toRes]);
  ok('расход с резервного счёта оборотных не касается', R.inRes === R.base, [R.base, R.inRes]);
  ok('перевод между двумя рабочими счетами не меняет ничего', R.wToW === R.base, [R.base, R.wToW]);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
