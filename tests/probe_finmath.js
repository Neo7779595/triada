/* probe_finmath — арифметика денег в модуле «Финансы».

   Здесь считается то, ради чего модуль вообще переписывается: сколько денег
   есть, где они лежат и сколько из них можно тратить. Ошибка тут не «кривая
   вёрстка», а неверное решение владельца — поэтому все ожидания посчитаны на
   бумаге и записаны числами, а не формулой из того же кода.

   ── Счета на 1 августа ───────────────────────────────────────────────
     A Наличка      800 000
     B Карта      5 200 000
     C Расчётный  1 500 000
     D Payme        500 000
     R Резерв     4 000 000   (не входит в оборотные)
                 ──────────
     всего       12 000 000, из них оборотных 8 000 000

   ── Август, 15 операций (одна отменена) ──────────────────────────────
     02  расход зарплата      B −6 000 000
     03  оплата клиента       C +4 000 000
     05  аванс за 3 месяца    C +9 000 000
     07  перевод в резерв     C → R 1 000 000
     09  изъятие собственника A −1 000 000
     11  заём получен         B +5 000 000
     13  платёж по займу      B −1 200 000  (из них проценты 200 000)
     15  возврат клиенту      C −500 000
     17  вклад партнёра       B +3 000 000
     19  дали в долг          A −700 000
     21  недостача при сверке A −50 000
     23  фрилансер            B −950 000
     25  оплата клиента       C +6 500 000
     27  расход 2 000 000     ОТМЕНЁН — не считается нигде
     29  перевод              B → A 300 000

   ── Остатки на бумаге ────────────────────────────────────────────────
     A = 800 000 −1 000 000 −700 000 −50 000 +300 000        = −650 000
     B = 5 200 000 −6 000 000 +5 000 000 −1 200 000
         +3 000 000 −950 000 −300 000                        = 4 750 000
     C = 1 500 000 +4 000 000 +9 000 000 −1 000 000
         −500 000 +6 500 000                                 = 19 500 000
     D = 500 000 (операций нет)                              = 500 000
     R = 4 000 000 +1 000 000                                = 5 000 000
     всего 29 100 000 · резерв 5 000 000 · оборотных 24 100 000

     Сходится и вторым путём: 12 000 000 начальных
       + приход 27 500 000 (10 500 000 оплаты + 9 000 000 аванс
                            + 5 000 000 заём + 3 000 000 вклад)
       − уход  10 400 000 (6 950 000 расходы + 1 200 000 займ
                            + 500 000 возврат + 1 000 000 изъятие
                            + 700 000 в долг + 50 000 недостача)
       = 29 100 000. Переводы в этой сумме не участвуют вовсе.

   ── Прибыль за август ────────────────────────────────────────────────
     выручка = 4 000 000 + 6 500 000 − 500 000 возврат        = 10 000 000
     расход  = 6 000 000 + 950 000 + 200 000 проценты         =  7 150 000
     прочее  = −50 000 недостача
     прибыль = 10 000 000 − 7 150 000 − 50 000                =  2 800 000
     маржа   = 28%

     Аванс 9 000 000 в выручку не идёт: он ещё не отработан.
     Вклад 3 000 000 и заём 5 000 000 — не доход. Изъятие 1 000 000 —
     не расход. Тело займа 1 000 000 — не расход, проценты 200 000 — да. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const R = await page.evaluate(() => {
    const A = [
      { id: 'A', name: 'Наличка',   kind: 'cash',   opening_balance: 800000,  sort: 1 },
      { id: 'B', name: 'Карта',     kind: 'card',   opening_balance: 5200000, sort: 2 },
      { id: 'C', name: 'Расчётный', kind: 'bank',   opening_balance: 1500000, sort: 3 },
      { id: 'D', name: 'Payme',     kind: 'wallet', opening_balance: 500000,  sort: 4 },
      { id: 'R', name: 'Резерв',    kind: 'card',   opening_balance: 4000000, sort: 5, is_reserve: true },
    ];
    const d = n => '2026-08-' + String(n).padStart(2, '0');
    const O = [
      { op_date: d(2),  kind: 'expense',    amount: 6000000, account_id: 'B', category: 'Зарплаты' },
      { op_date: d(3),  kind: 'income',     amount: 4000000, account_id: 'C' },
      { op_date: d(5),  kind: 'prepay',     amount: 9000000, account_id: 'C' },
      { op_date: d(7),  kind: 'transfer',   amount: 1000000, account_id: 'C', account_to: 'R' },
      { op_date: d(9),  kind: 'owner_out',  amount: 1000000, account_id: 'A' },
      { op_date: d(11), kind: 'loan_in',    amount: 5000000, account_id: 'B' },
      { op_date: d(13), kind: 'loan_repay', amount: 1200000, account_id: 'B', interest: 200000 },
      { op_date: d(15), kind: 'refund_out', amount: 500000,  account_id: 'C' },
      { op_date: d(17), kind: 'owner_in',   amount: 3000000, account_id: 'B' },
      { op_date: d(19), kind: 'lend_out',   amount: 700000,  account_id: 'A' },
      { op_date: d(21), kind: 'adjust_out', amount: 50000,   account_id: 'A' },
      { op_date: d(23), kind: 'expense',    amount: 950000,  account_id: 'B', category: 'Подрядчики' },
      { op_date: d(25), kind: 'income',     amount: 6500000, account_id: 'C' },
      { op_date: d(27), kind: 'expense',    amount: 2000000, account_id: 'B', voided_at: '2026-08-27T10:00:00Z' },
      { op_date: d(29), kind: 'transfer',   amount: 300000,  account_id: 'B', account_to: 'A' },
    ];
    const full = finMath(A, O, { from: '2026-08-01', to: '2026-08-31' });
    const mid  = finMath(A, O, { asOf: '2026-08-10' });
    const bal = m => ({ A: m.byId.A.bal, B: m.byId.B.bal, C: m.byId.C.bal, D: m.byId.D.bal, R: m.byId.R.bal });
    return {
      bal: bal(full), tot: full.total, work: full.working, res: full.reserve,
      rev: full.revenue, exp: full.expense, oth: full.other, prof: full.profit, mg: full.marginPct,
      pre: full.prepaid, oin: full.ownerIn, oout: full.ownerOut, int: full.interest,
      owed: full.debtOwed, due: full.debtDue,
      n: full.opsCount, v: full.voidedCount, orph: full.orphan.length,
      inB: full.byId.B.inSum, outB: full.byId.B.outSum, nB: full.byId.B.n, nD: full.byId.D.n,
      midBal: bal(mid), midTot: mid.total, midWork: mid.working,
    };
  });

  console.log('[A] остатки по счетам');
  ok('наличка ушла в минус и это видно, а не спрятано', R.bal.A === -650000, R.bal.A);
  ok('карта: заём и вклад плюсуются, займ и расходы вычитаются', R.bal.B === 4750000, R.bal.B);
  ok('расчётный: аванс лежит на счету наравне с оплатами', R.bal.C === 19500000, R.bal.C);
  ok('счёт без операций держит начальный остаток', R.bal.D === 500000 && R.nD === 0, [R.bal.D, R.nD]);
  ok('резерв вырос ровно на перевод', R.bal.R === 5000000, R.bal.R);
  ok('всего денег 29 100 000', R.tot === 29100000, R.tot);
  ok('резерв в оборотные не входит: 24 100 000', R.work === 24100000 && R.res === 5000000, [R.work, R.res]);
  ok('приход и расход по карте посчитаны раздельно',
    R.inB === 8000000 && R.outB === 8450000, [R.inB, R.outB]);
  ok('остаток карты сходится с приходом и расходом',
    5200000 + R.inB - R.outB === R.bal.B, [R.inB, R.outB, R.bal.B]);

  console.log('[B] отменённое и ничьё');
  ok('отменённая операция не двигает деньги', R.v === 1 && R.nB === 6, [R.v, R.nB]);
  ok('живых операций четырнадцать из пятнадцати', R.n === 14, R.n);
  ok('операций на несуществующем счету нет', R.orph === 0, R.orph);

  console.log('[C] прибыль: что доход, а что просто деньги');
  ok('выручка 10 000 000 — возврат вычтен, аванс не добавлен', R.rev === 10000000, R.rev);
  ok('расход 7 150 000 — с процентами по займу, без его тела', R.exp === 7150000, R.exp);
  ok('проценты по займу выделены отдельно: 200 000', R.int === 200000, R.int);
  ok('недостача при сверке уменьшила прибыль на 50 000', R.oth === -50000, R.oth);
  ok('прибыль 2 800 000', R.prof === 2800000, R.prof);
  ok('маржа 28%', R.mg === 28, R.mg);
  ok('аванс 9 000 000 виден отдельно и в выручку не попал',
    R.pre === 9000000 && R.rev === 10000000, [R.pre, R.rev]);
  ok('вклад и изъятие собственника прибыли не касаются',
    R.oin === 3000000 && R.oout === 1000000, [R.oin, R.oout]);

  console.log('[D] долги считаются за всё время, а не за месяц');
  ok('должны по займу 4 000 000: тело минус погашенное без процентов',
    R.owed === 4000000, R.owed);
  ok('нам должны 700 000', R.due === 700000, R.due);

  console.log('[E] остаток на дату');
  ok('на 10 августа всего 18 000 000', R.midTot === 18000000, R.midTot);
  ok('и оборотных 13 000 000', R.midWork === 13000000, R.midWork);
  ok('операции после этой даты в остаток не входят',
    R.midBal.B === -800000 && R.midBal.C === 13500000, R.midBal);

  console.log('[F] архивный счёт с деньгами не исчезает');
  const AR = await page.evaluate(() => {
    const base = [{ id: 'X', name: 'Рабочая', opening_balance: 1000000 }];
    const zero = base.concat([{ id: 'Z', name: 'Закрытая', opening_balance: 0, archived_at: '2026-01-01T00:00:00Z' }]);
    const rich = base.concat([{ id: 'Z', name: 'Закрытая', opening_balance: 250000, archived_at: '2026-01-01T00:00:00Z' }]);
    return { zero: finMath(zero, []).total, zeroN: finMath(zero, []).accounts.length,
             rich: finMath(rich, []).total, richN: finMath(rich, []).accounts.length };
  });
  ok('пустой архивный счёт из списка убран', AR.zero === 1000000 && AR.zeroN === 1, AR);
  ok('архивный с остатком остаётся в сводах: деньги не исчезают от архивации',
    AR.rich === 1250000 && AR.richN === 2, AR);

  console.log('[G] прогон остатка по дням — кассовый разрыв виден заранее');
  /* Тот самый август из разговора: месяц закрывается на 9 700 000, а десятого
     числа на счетах 500 000. По итогу месяца разрыв не виден вовсе. */
  const G = await page.evaluate(() => {
    const ev = [
      { date: '2026-08-05', delta: -6000000, label: 'зарплаты' },
      { date: '2026-08-10', delta: -1500000, label: 'аренда' },
      { date: '2026-08-12', delta: +4000000, label: 'Qushbegi' },
      { date: '2026-08-20', delta: +6500000, label: 'два клиента' },
      { date: '2026-08-25', delta: -900000,  label: 'налог' },
      { date: '2026-08-28', delta: -400000,  label: 'подписки' },
    ];
    const calm = finRunway(8000000, ev);
    const took = finRunway(8000000, [{ date: '2026-08-01', delta: -1000000, label: 'аванс себе' }].concat(ev));
    return { calm, took };
  });
  ok('месяц закрывается на 9 700 000', G.calm.end === 9700000, G.calm.end);
  ok('и при этом самый низкий остаток — 500 000 десятого августа',
    G.calm.min === 500000 && G.calm.minDate === '2026-08-10', [G.calm.min, G.calm.minDate]);
  ok('разрыва нет, взять сегодня можно 500 000',
    G.calm.gapDate === null && G.calm.safeNow === 500000, [G.calm.gapDate, G.calm.safeNow]);
  ok('взял миллион первого — разрыв десятого на 500 000',
    G.took.gapDate === '2026-08-10' && G.took.gapAmt === 500000, [G.took.gapDate, G.took.gapAmt]);
  ok('и месяц всё равно закрывается плюсом: по итогу разрыв не виден',
    G.took.end === 8700000, G.took.end);
  ok('когда разрыв есть, брать нельзя ничего', G.took.safeNow === 0, G.took.safeNow);

  console.log('[H] справочник типов операций');
  const K = await page.evaluate(() => {
    const K = FIN_KINDS, ks = Object.keys(K);
    return {
      n: ks.length,
      badRev: ks.filter(k => K[k].rev !== 0 && k !== 'income' && k !== 'refund_out'),
      neutral: ['prepay', 'loan_in', 'owner_in', 'owner_out', 'lend_out', 'lend_in', 'loan_repay', 'transfer']
        .filter(k => K[k].rev !== 0 || K[k].exp !== 0),
      transfer: K.transfer.money,
      grps: Array.from(new Set(ks.map(k => K[k].grp))).sort().join(','),
    };
  });
  ok('выручку двигают только оплата клиента и возврат ему', K.badRev.length === 0, K.badRev);
  ok('деньги собственников, займы и переводы прибыли не касаются',
    K.neutral.length === 0, K.neutral);
  ok('перевод между счетами не приход и не расход', K.transfer === 0, K.transfer);
  ok('типы разложены на четыре группы для кнопок', K.grps === 'fix,in,mv,out', K.grps);
  ok('типов ровно тринадцать', K.n === 13, K.n);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
