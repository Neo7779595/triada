/* probe_finown — лицевые счета совладельцев.

   Вопрос, из-за которого через год разваливаются партнёрства: «я вложил
   больше, а взял меньше». Модуль обязан отвечать на него числом, а не
   воспоминаниями.

   ── Расклад ─────────────────────────────────────────────────────────
   Прибыль, накопленная с начала учёта: 18 000 000. Доли 50 / 50.
     Нурислам  внёс 5 000 000, взял 3 500 000
     Партнёр   внёс 3 000 000, взял 6 000 000

   Причитается каждому: 18 000 000 × 50% = 9 000 000.

   Сальдо — сколько агентство должно человеку:
     Нурислам  5 000 000 + 9 000 000 − 3 500 000 = 10 500 000
     Партнёр   3 000 000 + 9 000 000 − 6 000 000 =  6 000 000

   Перекос — отклонение от справедливой доли изъятий. Всего изъято
   9 500 000, по 50% это 4 750 000 на каждого:
     Нурислам  3 500 000 − 4 750 000 = −1 250 000 (взял меньше)
     Партнёр   6 000 000 − 4 750 000 = +1 250 000 (взял больше)
   Сумма перекосов всегда ноль — поэтому спорить можно только о долях,
   а не об арифметике.

   ── Неравные доли ───────────────────────────────────────────────────
   70 / 30 при изъятиях 10 000 000: справедливо 7 000 000 и 3 000 000.
   Тот, у кого доля больше, имеет право и брать больше — иначе показатель
   наказывал бы за размер доли. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  console.log('[A] три числа на владельца и сальдо');
  const R = await page.evaluate(() => {
    const O = [
      { id: 'n', name: 'Нурислам', share_pct: 50, sort: 1 },
      { id: 'p', name: 'Партнёр',  share_pct: 50, sort: 2 }];
    const op = (kind, amount, owner_id) => ({ id: kind + amount, op_date: '2026-08-01', kind, amount, account_id: 'W', owner_id });
    const ops = [op('owner_in', 5000000, 'n'), op('owner_in', 3000000, 'p'),
                 op('owner_out', 3500000, 'n'), op('owner_out', 6000000, 'p')];
    const b = finOwnerBoard(O, ops, 18000000);
    const g = k => b.byId[k];
    return { n: g('n'), p: g('p'), pctOk: b.pctOk, totalOut: b.totalOut, totalIn: b.totalIn,
      skewTop: b.skewTop && { over: b.skewTop.over.name, under: b.skewTop.under.name, amount: b.skewTop.amount },
      lost: [b.lostIn, b.lostOut] };
  });
  ok('причитается по 9 000 000 каждому', R.n.due === 9000000 && R.p.due === 9000000, [R.n.due, R.p.due]);
  ok('внесённое и взятое разложено по людям, а не свалено в кучу',
    R.n.inSum === 5000000 && R.n.outSum === 3500000 && R.p.inSum === 3000000 && R.p.outSum === 6000000, R);
  ok('агентство должно Нурисламу 10 500 000', R.n.saldo === 10500000, R.n.saldo);
  ok('и партнёру 6 000 000', R.p.saldo === 6000000, R.p.saldo);
  ok('справедливая доля изъятий по 4 750 000', R.n.fair === 4750000 && R.p.fair === 4750000, [R.n.fair, R.p.fair]);
  ok('перекос: партнёр взял на 1 250 000 больше, Нурислам — на столько же меньше',
    R.p.skew === 1250000 && R.n.skew === -1250000, [R.p.skew, R.n.skew]);
  ok('сумма перекосов ноль — спорить можно только о долях', R.n.skew + R.p.skew === 0, [R.n.skew, R.p.skew]);
  ok('перекос назван по именам, а не оставлен считать в уме',
    R.skewTop && R.skewTop.over === 'Партнёр' && R.skewTop.under === 'Нурислам' && R.skewTop.amount === 1250000, R.skewTop);
  ok('доли сходятся в сотню', R.pctOk === true, R.pctOk);
  ok('ничего не потеряно', R.lost.join(',') === '0,0', R.lost);

  console.log('[B] неравные доли');
  const U = await page.evaluate(() => {
    const O = [{ id: 'a', name: 'А', share_pct: 70 }, { id: 'b', name: 'Б', share_pct: 30 }];
    const ops = [{ id: '1', kind: 'owner_out', amount: 7000000, op_date: '2026-08-01', owner_id: 'a' },
                 { id: '2', kind: 'owner_out', amount: 3000000, op_date: '2026-08-01', owner_id: 'b' }];
    const b = finOwnerBoard(O, ops, 10000000);
    return { a: b.byId.a, b: b.byId.b, skewTop: b.skewTop };
  });
  ok('при 70/30 справедливо 7 000 000 и 3 000 000',
    U.a.fair === 7000000 && U.b.fair === 3000000, [U.a.fair, U.b.fair]);
  ok('взяли ровно по долям — перекоса нет', U.a.skew === 0 && U.b.skew === 0, [U.a.skew, U.b.skew]);
  ok('и предупреждать не о чем', U.skewTop === null, U.skewTop);
  ok('причитается тоже по долям: 7 000 000 и 3 000 000',
    U.a.due === 7000000 && U.b.due === 3000000, [U.a.due, U.b.due]);

  console.log('[C] чего модуль не проглатывает молча');
  const E = await page.evaluate(() => {
    const O = [{ id: 'a', name: 'А', share_pct: 60 }, { id: 'b', name: 'Б', share_pct: 30 }];
    const dead = [{ id: '1', kind: 'owner_out', amount: 1000000, op_date: '2026-08-01', owner_id: 'a',
      voided_at: '2026-08-02T00:00:00Z' }];
    const nobody = [{ id: '2', kind: 'owner_out', amount: 800000, op_date: '2026-08-01' },
                    { id: '3', kind: 'owner_in',  amount: 500000, op_date: '2026-08-01', owner_id: 'ghost' }];
    const arch = [{ id: 'a', name: 'А', share_pct: 100 },
                  { id: 'z', name: 'Вышел', share_pct: 0, archived_at: '2026-01-01T00:00:00Z' }];
    return {
      pct: finOwnerBoard(O, [], 0).pctOk,
      dead: finOwnerBoard(O, dead, 0).byId.a.outSum,
      lost: (() => { const b = finOwnerBoard(O, nobody, 0); return [b.lostOut, b.lostIn, b.totalOut, b.totalIn]; })(),
      arch: finOwnerBoard(arch, [], 0).rows.length,
      noOwners: finOwnerBoard([], [], 5000000).rows.length };
  });
  ok('доли, не дающие сотню, помечены как расхождение', E.pct === false, E.pct);
  ok('отменённое изъятие на лицевой счёт не ложится', E.dead === 0, E.dead);
  ok('деньги без владельца видны отдельной строкой, а не растворяются',
    E.lost.join(',') === '800000,500000,800000,500000', E.lost);
  ok('вышедший из состава в карточки не идёт', E.arch === 1, E.arch);
  ok('без совладельцев считать нечего и падать не на чем', E.noOwners === 0, E.noOwners);

  console.log('[D] на экране');
  const V = await page.evaluate(() => {
    window.FINX = { ready: true,
      accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 30000000, sort: 1 }],
      ops: [{ id: '1', op_date: '2026-08-01', kind: 'owner_in',  amount: 5000000, account_id: 'W', owner_id: 'n' },
            { id: '2', op_date: '2026-08-01', kind: 'owner_out', amount: 6000000, account_id: 'W', owner_id: 'p' }] };
    window.FINP = [];
    window.FINO = [];
    const empty = finOwnersBlock();
    window.FINO = [{ id: 'n', name: 'Нурислам', share_pct: 50, sort: 1 },
                   { id: 'p', name: 'Партнёр',  share_pct: 50, sort: 2 }];
    const d = document.createElement('div'); d.innerHTML = finOwnersBlock();
    return { empty: /Совладельцы не заведены/.test(empty),
      cards: d.querySelectorAll('.fnx-ow').length,
      warn: (d.querySelector('.fnx-ow-w') || {}).textContent || '',
      pct: Array.from(d.querySelectorAll('.fnx-ow-pct')).map(e => e.textContent) };
  });
  ok('пока совладельцев нет — объяснение, зачем они', V.empty, V.empty);
  ok('на каждого своя карточка с долей', V.cards === 2 && V.pct.join(',') === '50%,50%', V);
  ok('перекос вынесен предупреждением с именами',
    /Партнёр взял на/.test(V.warn) && /Нурислам/.test(V.warn), V.warn);

  console.log('[E] право на расчёты владельцев отдельное');
  const P = await page.evaluate(() => {
    const _me = window.tMe;
    const as = m => { window.tMe = () => m; return finCanOwners(); };
    const r = {
      owner:    as({ role: 'agency_owner' }),
      director: as({ role: 'member', is_director: true }),
      plain:    as({ role: 'member', permissions: { finance: { view: true, edit: true } } }),
      granted:  as({ role: 'member', permissions: { finance: { view: true, edit: true, partners: true } } }),
      noFin:    as({ role: 'member', permissions: {} }) };
    window.tMe = _me; return r;
  });
  ok('владелец агентства видит всегда', P.owner === true, P.owner);
  ok('директор тоже', P.director === true, P.director);
  ok('финансист с полным доступом к финансам — нет', P.plain === false, P.plain);
  ok('только с явно выданным правом', P.granted === true, P.granted);
  ok('без финансов вообще — тем более нет', P.noFin === false, P.noFin);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
