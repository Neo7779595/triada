/* probe_finres — резерв: правило пополнения и запас в месяцах.

   Резерв отвечает на один вопрос: сколько месяцев агентство проживёт, если
   завтра не заплатит никто. Поэтому запас меряется временем, а не процентом
   от выручки, а «отложить» — настоящий перевод между счетами, не пометка.

   ── Расклад ─────────────────────────────────────────────────────────
   Сегодня 15 августа. Резервная карта 2 000 000 на начало, рабочая — ноль.
     05.06  расход 4 000 000            (июнь — полный месяц)
     05.07  расход 6 000 000            (июль — полный месяц)
     03.08  оплата клиента 10 000 000
     04.08  аванс 5 000 000
     06.08  перевод в резерв 1 000 000
     10.08  расход 500 000 с резервной карты
     12.08  расход 2 000 000
   Правило: откладывать 10% с поступлений, цель — 3 месяца расходов.

   ── На бумаге ───────────────────────────────────────────────────────
   Резерв = 2 000 000 + 1 000 000 − 500 000 = 2 500 000.
   Поступления августа = 10 000 000 + 5 000 000 = 15 000 000.
   Отложить следовало 1 500 000, переведено 1 000 000 → не отложено 500 000.
   Из резерва за август ушло 500 000.

   Средний расход — по полным месяцам: (4 000 000 + 6 000 000) / 2 = 5 000 000.
   Август в среднее не идёт: он ещё не кончился, и включать его — занижать
   расход и завышать запас.
   Запас = 2 500 000 / 5 000 000 = 0,5 месяца.
   Цель = 5 000 000 × 3 = 15 000 000, набрано 17%, не хватает 12 500 000. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const base = await page.evaluate(() => {
    window._A = [
      { id: 'W', name: 'Карта',  kind: 'card', opening_balance: 0,       sort: 1 },
      { id: 'R', name: 'Резерв', kind: 'card', opening_balance: 2000000, sort: 2, is_reserve: true }];
    window._O = [
      { id: '1', op_date: '2026-06-05', kind: 'expense',  amount: 4000000,  account_id: 'W' },
      { id: '2', op_date: '2026-07-05', kind: 'expense',  amount: 6000000,  account_id: 'W' },
      { id: '3', op_date: '2026-08-03', kind: 'income',   amount: 10000000, account_id: 'W' },
      { id: '4', op_date: '2026-08-04', kind: 'prepay',   amount: 5000000,  account_id: 'W' },
      { id: '5', op_date: '2026-08-06', kind: 'transfer', amount: 1000000,  account_id: 'W', account_to: 'R' },
      { id: '6', op_date: '2026-08-10', kind: 'expense',  amount: 500000,   account_id: 'R' },
      { id: '7', op_date: '2026-08-12', kind: 'expense',  amount: 2000000,  account_id: 'W' }];
    window._C = { reserve_pct: 10, reserve_target_months: 3 };
    window._opt = { from: '2026-08-01', to: '2026-08-31', today: '2026-08-15' };
    return finReserveMath(window._A, window._O, window._C, window._opt);
  });

  console.log('[A] сколько отложено и сколько следовало');
  ok('в резерве 2 500 000', base.balance === 2500000, base.balance);
  ok('база отчислений — оплаты и авансы: 15 000 000', base.periodIn === 15000000, base.periodIn);
  ok('по правилу 10% отложить следовало 1 500 000', base.shouldSave === 1500000, base.shouldSave);
  ok('переведено 1 000 000', base.saved === 1000000, base.saved);
  ok('долг перед собственным резервом 500 000', base.owe === 500000, base.owe);
  ok('из резерва за месяц ушло 500 000 — и это видно отдельно', base.spent === 500000, base.spent);

  console.log('[B] запас в месяцах — по полным месяцам');
  ok('средний расход 5 000 000 по двум полным месяцам',
    base.avgExpense === 5000000 && base.monthsUsed === 2, [base.avgExpense, base.monthsUsed]);
  ok('запас — полмесяца расходов', base.covers === 0.5, base.covers);
  ok('цель на три месяца — 15 000 000', base.target === 15000000, base.target);
  ok('набрано 17%, не хватает 12 500 000',
    base.progress === 17 && base.gap === 12500000, [base.progress, base.gap]);

  console.log('[C] что в базу отчислений не идёт');
  const X = await page.evaluate(() => {
    const add = extra => finReserveMath(window._A, window._O.concat(extra), window._C, window._opt);
    return {
      loan:  add([{ id: 'l', op_date: '2026-08-07', kind: 'loan_in',  amount: 3000000, account_id: 'W' }]).periodIn,
      owner: add([{ id: 'o', op_date: '2026-08-07', kind: 'owner_in', amount: 3000000, account_id: 'W' }]).periodIn,
      lend:  add([{ id: 'd', op_date: '2026-08-07', kind: 'lend_in',  amount: 3000000, account_id: 'W' }]).periodIn,
      dead:  add([{ id: 'v', op_date: '2026-08-07', kind: 'income',   amount: 9000000, account_id: 'W',
        voided_at: '2026-08-08T00:00:00Z' }]).periodIn };
  });
  ok('заём в базу отчислений не идёт: откладывать с занятого — обманывать себя',
    X.loan === 15000000, X.loan);
  ok('вклад собственника тоже не идёт', X.owner === 15000000, X.owner);
  ok('возврат нашего долга — не поступление от клиента', X.lend === 15000000, X.lend);
  ok('отменённая оплата в базу не попадает', X.dead === 15000000, X.dead);

  console.log('[D] из резерва можно и уйти, и это должно быть видно');
  const S = await page.evaluate(() => {
    const back = window._O.concat([{ id: 'b', op_date: '2026-08-14', kind: 'transfer', amount: 700000,
      account_id: 'R', account_to: 'W' }]);
    const r = finReserveMath(window._A, back, window._C, window._opt);
    return { spent: r.spent, bal: r.balance, saved: r.saved };
  });
  ok('перевод из резерва обратно считается тратой резерва', S.spent === 1200000, S.spent);
  ok('и уменьшает его остаток', S.bal === 1800000, S.bal);
  ok('но не засчитывается как пополнение', S.saved === 1000000, S.saved);

  console.log('[E] когда считать не на чем — так и сказано');
  const N = await page.evaluate(() => {
    const only = [{ id: '1', op_date: '2026-08-03', kind: 'income', amount: 5000000, account_id: 'W' }];
    const r = finReserveMath(window._A, only, window._C, window._opt);
    const noRule = finReserveMath(window._A, window._O, { reserve_pct: 0, reserve_target_months: 3 }, window._opt);
    return { avg: r.avgExpense, covers: r.covers, target: r.target, progress: r.progress, gap: r.gap,
      should: noRule.shouldSave, owe: noRule.owe };
  });
  ok('без единого полного месяца запас не выдумывается',
    N.avg === null && N.covers === null && N.target === null, N);
  ok('и цель тоже: ни прогресса, ни разрыва', N.progress === null && N.gap === null, N);
  ok('без правила откладывать нечего и долга нет', N.should === 0 && N.owe === 0, N);

  console.log('[F] на экране');
  const V = await page.evaluate(() => {
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 5000000, sort: 1 }], ops: [] };
    window.FINS = {}; window.FINP = []; window.FINO = [];
    const noRes = finResBlock();
    /* Для экрана даты берём от сегодняшнего дня: блок считает по текущему
       месяцу и не засчитывает то, что записано будущим числом, — и правильно
       делает, но проверять на такой выборке нечего. */
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), first = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window.FINX.accounts = window._A;
    window.FINX.ops = [
      { id: 'a', op_date: '2026-06-05', kind: 'expense',  amount: 4000000,  account_id: 'W' },
      { id: 'b', op_date: '2026-07-05', kind: 'expense',  amount: 6000000,  account_id: 'W' },
      { id: 'c', op_date: first, kind: 'income',   amount: 10000000, account_id: 'W' },
      { id: 'd', op_date: first, kind: 'transfer', amount: 600000,   account_id: 'W', account_to: 'R' },
      { id: 'e', op_date: td,    kind: 'expense',  amount: 500000,   account_id: 'R' }];
    window.FINS = window._C;
    const d = document.createElement('div'); d.innerHTML = finResBlock();
    return { noRes: /Резерв не заведён/.test(noRes),
      txt: (d.textContent || '').replace(/\s+/g, ' '),
      bar: !!d.querySelector('.fnx-rs-bar i'),
      warn: !!d.querySelector('.fnx-rs-w') };
  });
  ok('без резервного счёта — объяснение, зачем он', V.noRes, V.noRes);
  ok('на экране запас в месяцах, а не только сумма', /месяц/.test(V.txt), V.txt.slice(0, 120));
  ok('видно, что правило не выполнено', /не отложено/.test(V.txt), V.txt.slice(0, 200));
  ok('и что из резерва в этом месяце тратили', V.warn, V.warn);
  ok('прогресс к цели нарисован полосой', V.bar, V.bar);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
