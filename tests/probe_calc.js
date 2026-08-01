/* probe_calc — маркетинговый калькулятор.
   Две части. Первая: контрольные примеры, посчитанные на бумаге и вписанные
   числами — они охраняют смысл формул. Вторая: сверка со слепком golden_calc.json
   по семнадцати конфигурациям — она охраняет от того, что правка оформления
   молча сдвинет цифру. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const golden = require('./golden_calc.json');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const near = (a, b, eps) => a !== null && a !== undefined && Math.abs(a - b) < (eps === undefined ? 1e-6 : eps);

const CFG = {
  mode: 'goal', buy: 'click', price: 5000, goal: 100,
  stages: [{ key: 'impr', name: 'Показы' }, { key: 'click', name: 'Клики', cr: 2 },
  { key: 'lead', name: 'Лиды', cr: 10 }, { key: 'sale', name: 'Продажи', cr: 20 }],
  aov: 500000, cogsMode: 'unit', unitCost: 300000,
  varPct: 5, fixed: 2000000, salesCost: 3000000,
  vatPct: 0, vatIncluded: false, taxMode: 'none',
  redeemPct: 100, returnPct: 0, repeatPct: 0,
  adVatPct: 0, agencyPct: 0, agencyFix: 0, prodCost: 0, days: 30,
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  console.log('\n[A] «не посчитать» — это прочерк, а не ноль');
  const A = await page.evaluate(() => ({
    n: [MKC.num('1 200 000'), MKC.num('12,5'), MKC.num(''), MKC.num('абв'), MKC.num(0)],
    z: [MKC.div(5, 0), MKC.cpm(1000, 0), MKC.roas(100, 0), MKC.beRoas(0), MKC.ltvMargin(100, 40, 0), MKC.cac(1e6, 0, 0)],
    d: MKC.div(5, 2), s: MKC.share(25, 100), f: MKC.frac(35),
  }));
  ok('число с пробелами и запятой читается', A.n[0] === 1200000 && A.n[1] === 12.5, A.n);
  ok('пустое и мусор — прочерк, настоящий ноль — ноль', A.n[2] === null && A.n[3] === null && A.n[4] === 0, A.n);
  ok('всё, что делится на ноль, даёт прочерк, а не бесконечность', A.z.every(x => x === null), A.z);
  ok('обычные вычисления считаются', A.d === 2.5 && A.s === 25 && A.f === 0.35, A);

  console.log('\n[B] метрики на контрольном примере');
  const B = await page.evaluate(() => ({
    cpm: MKC.cpm(1e6, 5e5), cpc: MKC.cpc(1e6, 2e4), ctr: MKC.ctr(2e4, 5e5), cpl: MKC.cpl(1e6, 500),
    cac: MKC.cac(1e6, 50, 25e4), cr: MKC.cr(50, 500), aov: MKC.aov(15e6, 50),
    margin: MKC.marginPct(15e6, 9e6), roas: MKC.roas(15e6, 1e6), drr: MKC.drr(1e6, 15e6), mer: MKC.mer(20e6, 2e6),
    romiRev: MKC.romiRevenue(15e6, 1e6), romiGp: MKC.romiProfit(6e6, 1e6), roi: MKC.roi(5e6, 10e6),
    beRoas: MKC.beRoas(40), beCpl: MKC.beCpl(12e4, 10),
    ltvS: MKC.ltvSimple(3e5, 3), ltvM: MKC.ltvMargin(3e5, 40, 20), life: MKC.lifetime(20),
    ratio: MKC.ltvCac(6e5, 25e3), payLin: MKC.payback(8e5, 5e5, 40), payCoh: MKC.payback(8e5, 5e5, 40, 20),
    payNever: MKC.payback(12e5, 5e5, 40, 20),
  }));
  ok('CPM 2 000 · CPC 50 · CTR 4 % · CPL 2 000', near(B.cpm, 2000) && near(B.cpc, 50) && near(B.ctr, 4) && near(B.cpl, 2000), B);
  ok('CAC с расходами на продажи 25 000', near(B.cac, 25000), B.cac);
  ok('конверсия 10 % · средний чек 300 000 · маржа 40 %', near(B.cr, 10) && near(B.aov, 3e5) && near(B.margin, 40), B);
  ok('ROAS 15× · ДРР 6,67 % · MER 10×', near(B.roas, 15) && near(B.drr, 100 / 15, 1e-9) && near(B.mer, 10), B);
  ok('ROMI по выручке 1400 %, по прибыли 500 % — это разные числа', near(B.romiRev, 1400) && near(B.romiGp, 500), B);
  ok('ROI 50 % · безубыточный ROAS 2,5× · предельный лид 12 000', near(B.roi, 50) && near(B.beRoas, 2.5) && near(B.beCpl, 12000), B);
  ok('LTV простой 900 000, с маржой 600 000 — на треть меньше', near(B.ltvS, 9e5) && near(B.ltvM, 6e5), B);
  ok('срок жизни 5 периодов, LTV:CAC 24', near(B.life, 5) && near(B.ratio, 24), B);
  ok('окупаемость без оттока 4 периода, с оттоком 7,21 — линейно считать нельзя',
    near(B.payLin, 4) && near(B.payCoh, Math.log(0.2) / Math.log(0.8), 1e-6), B);
  ok('когда CAC больше LTV — окупаемости нет, срок не печатается', B.payNever === null, B.payNever);

  console.log('\n[C] вердикты — пороги там, где заявлено');
  const C = await page.evaluate(() => ({
    v: [0.8, 1.5, 2.4, 3.5, 5, 7].map(x => MKC.verdictLtvCac(x).level),
    vn: MKC.verdictLtvCac(null),
    r: [MKC.verdictRoas(2, 2.5).level, MKC.verdictRoas(2.6, 2.5).level, MKC.verdictRoas(4, 2.5).level],
    rNoMargin: MKC.verdictRoas(3, null),
  }));
  ok('LTV:CAC — плохо, плохо, слабо, норма, норма, недоинвестируем',
    JSON.stringify(C.v) === JSON.stringify(['bad', 'bad', 'warn', 'good', 'good', 'warn']), C.v);
  ok('без числа вердикта нет', C.vn === null, C.vn);
  ok('ROAS ниже порога — в минус, чуть выше — у нуля, заметно выше — в плюс',
    JSON.stringify(C.r) === JSON.stringify(['bad', 'warn', 'good']), C.r);
  ok('без маржи ROAS ничего не значит — так и написано',
    C.rNoMargin.level === 'warn' && /маржинальност/.test(C.rNoMargin.text), C.rNoMargin);

  console.log('\n[D] воронка: расчёт на бумаге и обратимость');
  const D = await page.evaluate((cfg) => {
    const a = MKC.funnel(cfg);
    const bck = MKC.funnel({ ...cfg, mode: 'budget', budget: a.media, goal: null });
    const same = (x, y) => (x === null && y === null) || (x !== null && y !== null && Math.abs(x - y) < 1e-6);
    return {
      n: a.stages.map(s => s.n), media: a.media, revenue: a.revenue, cogs: a.cogs, varCosts: a.varCosts,
      gp: a.grossProfit, cm: a.contribution, ebitda: a.ebitda, net: a.netProfit,
      gm: a.grossMarginPct, cmPct: a.marginPct, m: a.m, narrow: a.narrow && a.narrow.key,
      backSame: a.stages.every((s, i) => same(s.n, bck.stages[i].n)) &&
        Object.keys(a.m).filter(k => typeof a.m[k] === 'number' || a.m[k] === null).every(k => same(a.m[k], bck.m[k])),
      byImpr: MKC.funnel({ ...cfg, buy: 'impr', price: 100000, mode: 'budget', budget: 25e6 }).orders,
      byLead: MKC.funnel({ ...cfg, buy: 'lead', price: 50000 }).media,
      byMargin: MKC.funnel({ ...cfg, cogsMode: 'margin', marginPct: 40, unitCost: null }).contribution,
    };
  }, CFG);
  ok('показы 250 000 · клики 5 000 · лиды 500 · продажи 100',
    near(D.n[0], 250000, 1e-6) && near(D.n[1], 5000, 1e-9) && near(D.n[2], 500, 1e-9) && near(D.n[3], 100, 1e-9), D.n);
  ok('бюджет 25 000 000 · выручка 50 000 000 · себестоимость 30 000 000',
    near(D.media, 25e6, 1e-6) && near(D.revenue, 50e6) && near(D.cogs, 30e6), D);
  ok('валовая 20 000 000, маржинальный доход 17 500 000 — это разные строки',
    near(D.gp, 20e6) && near(D.cm, 17.5e6), D);
  ok('валовая маржа 40 %, маржа после переменных 35 %', near(D.gm, 40) && near(D.cmPct, 35), D);
  ok('EBITDA и чистая −12 500 000', near(D.ebitda, -12.5e6, 1e-6) && near(D.net, -12.5e6, 1e-6), D);
  ok('ROAS 2× · ДРР 50 % · ROMI по прибыли −30 % · ROI −20 %',
    near(D.m.roas, 2) && near(D.m.drr, 50) && near(D.m.romiGp, -30) && near(D.m.roi, -20), D.m);
  ok('CAC 280 000 · CPO 250 000 — под одним именем жили два числа',
    near(D.m.cac, 280000) && near(D.m.cpo, 250000), D.m);
  ok('безубыточный ROAS 2,857× — от маржи после переменных, а не от валовой',
    near(D.m.beRoas, 1 / 0.35, 1e-9), D.m.beRoas);
  ok('порог с покрытием постоянных 3,43× · предельный CAC 175 000 и 125 000',
    near(D.m.beRoasFull, 30e6 / 0.35 / 25e6, 1e-9) && near(D.m.maxCac, 175000) && near(D.m.maxCacFull, 125000), D.m);
  ok('предельная цена лида 35 000, а платим 50 000', near(D.m.beCpl, 35000) && near(D.m.cpl, 50000, 1e-9), D.m);
  ok('вердикт «в минус» — и чистая прибыль правда отрицательная', D.m.verdictRoas.level === 'bad' && D.net < 0, D.m.verdictRoas);
  ok('самая узкая конверсия — переход в клики', D.narrow === 'click', D.narrow);
  ok('обратный ход «от бюджета» даёт те же числа до знака', D.backSame === true, D.backSame);
  ok('точка закупки не меняет результат: показы и лиды дают то же самое',
    near(D.byImpr, 100, 1e-9) && near(D.byLead, 25e6, 1e-6), D);
  ok('себестоимость через маржу — то же, что через цену единицы', near(D.byMargin, 17.5e6, 1e-6), D.byMargin);

  console.log('\n[E] НДС, надбавки, потери, повторные, налоги');
  const E = await page.evaluate((cfg) => ({
    vat: MKC.funnel({ ...cfg, vatPct: 12, vatIncluded: true }),
    up: MKC.funnel({ ...cfg, adVatPct: 12, agencyPct: 15, prodCost: 2000000 }),
    loss: MKC.funnel({ ...cfg, redeemPct: 80, returnPct: 5 }),
    rep: MKC.funnel({ ...cfg, repeatPct: 30 }),
    turn: MKC.funnel({ ...cfg, taxMode: 'turnover', turnoverPct: 4 }),
    prof: MKC.funnel({ ...cfg, aov: 1500000, taxMode: 'profit', profitTaxPct: 15 }),
    lossTax: MKC.funnel({ ...cfg, taxMode: 'profit', profitTaxPct: 15 }),
  }), CFG);
  ok('НДС: выручка очищена 44 642 857, маржинальный доход 15 625 000',
    near(E.vat.revenue, 50e6 / 1.12, 1e-6) && near(E.vat.contribution, 15625000, 1e-6), E.vat);
  ok('НДС: маржа осталась 35 %, порог вырос до 3,2×', near(E.vat.marginPct, 35, 1e-9) && near(E.vat.m.beRoas, 1.12 / 0.35, 1e-9), E.vat);
  ok('надбавки: в кабинет 25 млн, к оплате 28 млн, комиссия 3,75 млн, всего 33,75 млн',
    near(E.up.media, 25e6, 1e-6) && near(E.up.mediaPaid, 28e6, 1e-6) && near(E.up.agencyFee, 3.75e6) && near(E.up.marketing, 33.75e6, 1e-6), E.up);
  ok('надбавки: ROAS в кабинете не изменился, CAC вырос до 367 500',
    near(E.up.m.roas, 2, 1e-9) && near(E.up.m.cac, 367500, 1e-6), E.up.m);
  ok('надбавки: порог поднялся до 3,63×, предельный лид упал до 24 409',
    near(E.up.m.beRoas, 1.27 / 0.35, 1e-9) && near(E.up.m.beCpl, 15.5e6 / 1.27 / 500, 1e-6), E.up.m);
  ok('выкуп 80 % и возвраты 5 %: заказов 100, оплачено 76, выручка 38 млн',
    near(E.loss.orders, 100, 1e-9) && near(E.loss.paid, 76, 1e-9) && near(E.loss.revenue, 38e6, 1e-6), E.loss);
  ok('повторные 30 %: новых клиентов 70, CAC 400 000 вместо 280 000',
    near(E.rep.newCust, 70, 1e-9) && near(E.rep.m.cac, 400000, 1e-6), E.rep);
  ok('налог с оборота 4 % = 2 000 000, чистая −14 500 000',
    near(E.turn.tax, 2e6) && near(E.turn.netProfit, -14.5e6, 1e-6), E.turn);
  ok('налог на прибыль 15 % от EBITDA 82,5 млн = 12,375 млн',
    near(E.prof.ebitda, 82.5e6, 1e-6) && near(E.prof.tax, 12.375e6, 1e-6), E.prof);
  ok('на убытке налог на прибыль не начисляется', near(E.lossTax.tax, 0) && E.lossTax.ebitda < 0, E.lossTax);

  console.log('\n[F] целевой показатель, сценарии, охват, касса, план-факт');
  const F = await page.evaluate((cfg) => ({
    tr: MKC.funnel({ ...cfg, mode: 'target', targetKind: 'roas', targetValue: 4, price: null }),
    td: MKC.funnel({ ...cfg, mode: 'target', targetKind: 'drr', targetValue: 25, price: null }),
    tc: MKC.funnel({ ...cfg, mode: 'target', targetKind: 'cpa', targetValue: 125000, price: null }),
    tl: MKC.funnel({ ...cfg, mode: 'target', targetKind: 'roas', targetValue: 4, price: null, redeemPct: 80 }),
    tn: MKC.funnel({ ...cfg, mode: 'target', targetValue: null, price: null }),
    sc: MKC.scenarios(cfg, 20), sc0: MKC.scenarios(cfg, 0),
    r1: MKC.funnel({ ...cfg, audience: 400000, frequency: 3 }),
    r2: MKC.funnel({ ...cfg, audience: 100000, frequency: 3 }),
    r3: MKC.funnel({ ...cfg, audience: 50000, frequency: 1 }),
    cash: MKC.funnel({ ...cfg, payDelay: 14, instalPct: 30, instalMonths: 6, instalFeePct: 20 }),
    fact: MKC.fact(MKC.funnel(cfg), { days: 10, spent: 8300000, buyQty: 1400, orders: 25 }),
    factNo: MKC.fact(MKC.funnel(cfg), {}),
    factOver: MKC.fact(MKC.funnel(cfg), { days: 40, spent: 1, buyQty: 1, orders: 1 }),
  }), CFG);
  ok('целевой ROAS 4× → цена клика 2 500, бюджет 12,5 млн, фактический ROAS ровно 4×',
    near(F.tr.target.price, 2500, 1e-9) && near(F.tr.media, 12.5e6, 1e-6) && near(F.tr.m.roas, 4, 1e-9), F.tr.target);
  ok('целевая ДРР 25 % и цена заказа 125 000 дают тот же бюджет',
    near(F.td.media, 12.5e6, 1e-6) && near(F.tc.media, 12.5e6, 1e-6), [F.td.media, F.tc.media]);
  ok('выкуп 80 % снижает допустимую цену ровно на пятую часть', near(F.tl.target.price, 2000, 1e-9), F.tl.target);
  ok('без целевого показателя расчёт честно останавливается', F.tn.ok === false && /целев/i.test(F.tn.why), F.tn.why);
  ok('сценарии ±20 %: пессимистичный 46 875 000, оптимистичный 13 888 889',
    near(F.sc.low.media, 46875000, 1e-6) && near(F.sc.high.media, 100 / 0.0288 * 4000, 1e-6), [F.sc.low.media, F.sc.high.media]);
  ok('конверсии сдвинуты ровно на разброс, базовый не тронут',
    near(F.sc.low.stages[1].cr, 1.6, 1e-9) && near(F.sc.high.stages[1].cr, 2.4, 1e-9) && near(F.sc.base.media, 25e6, 1e-6), F.sc.base.media);
  ok('при нулевом разбросе вилку не выдумываем', F.sc0.low === null, F.sc0.low);
  ok('охват 83 333, доля аудитории 20,8 % — предупреждения нет',
    near(F.r1.reach, 250000 / 3, 1e-6) && F.r1.reachWarn === false, F.r1.reachShare);
  ok('на тесной аудитории и на частоте 5× предупреждение есть',
    F.r2.reachWarn === true && near(F.r3.freqNeeded, 5, 1e-9) && F.r3.reachWarn === true, [F.r2.reachShare, F.r3.freqNeeded]);
  ok('дневной бюджет 833 333, заказов в день 3,33',
    near(F.r1.perDay.media, 25e6 / 30, 1e-6) && near(F.r1.perDay.orders, 100 / 30, 1e-9), F.r1.perDay);
  ok('касса: средняя отсрочка 41 день, заморожено 68 333 333, дисконт 3 000 000',
    near(F.cash.cash.delayDays, 41, 1e-9) && near(F.cash.cash.frozen, 50e6 * 41 / 30, 1e-6) && near(F.cash.cash.fee, 3e6, 1e-6), F.cash.cash);
  ok('касса: разрыв 80 833 333 при «прибыли» на бумаге',
    near(F.cash.cash.gap, 62.5e6 - (50e6 - 50e6 * 41 / 30), 1e-6), F.cash.cash.gap);
  ok('план-факт: цена клика 5 000 → 5 929, отклонение +18,6 %',
    near(F.fact.unitPlan, 5000) && near(F.fact.unitFact, 8300000 / 1400, 1e-9) && near(F.fact.unitDelta, (8300000 / 1400 / 5000 - 1) * 100, 1e-9), F.fact);
  ok('план-факт: по темпу выйдет 75 из 100, удержать цель стоит 29 642 857',
    near(F.fact.foreOrders, 75, 1e-9) && near(F.fact.needBudget, 8300000 + 3600 * (8300000 / 1400), 1e-6), F.fact);
  ok('без факта и при переполнении дней блок молчит, а не делит на отрицательное',
    F.factNo === null && F.factOver === null, [F.factNo, F.factOver]);

  console.log('\n[G] медиаплан');
  const G = await page.evaluate(() => MKC.media([
    { name: 'Instagram', buy: 'click', budget: 10e6, price: 2000, cr1: 10, cr2: 20 },
    { name: 'Google', buy: 'lead', budget: 6e6, price: 60000, cr1: 25 },
    { name: 'Пустой', buy: 'click', budget: 5e6, price: 2000, cr1: 10, cr2: null },
  ], { aov: 500000, marginPct: 40, varPct: 0 }));
  ok('Instagram: 5 000 кликов → 100 продаж, выручка 50 млн, ROAS 5×',
    near(G.rows[0].qty, 5000) && near(G.rows[0].sales, 100, 1e-9) && near(G.rows[0].roas, 5), G.rows[0]);
  ok('Google по лидам: одной конверсии достаточно, строка не помечена',
    G.rows[1].miss === false && near(G.rows[1].sales, 25, 1e-9), G.rows[1]);
  ok('канал с пустой обязательной конверсией помечен и не считается',
    G.rows[2].miss === true && G.rows[2].sales === null, G.rows[2]);
  ok('и он не попал в итог: 125 продаж, а не 625',
    near(G.total.sales, 125, 1e-9) && G.total.missing === 1, G.total);
  ok('итог: бюджет 16 млн, выручка 62,5 млн, ROAS 3,906×, CPO 128 000',
    near(G.total.budget, 16e6) && near(G.total.revenue, 62.5e6) && near(G.total.roas, 62.5 / 16) && near(G.total.cpo, 128000), G.total);
  ok('сводный ROAS выше порога, но один канал в минусе — потому и показываем разбивку',
    G.total.roas > G.total.beRoas && G.rows[1].profit < 0, { roas: G.total.roas, be: G.total.beRoas });

  console.log('\n[H] сверка со слепком: оформление не сдвинуло ни одной цифры');
  const live = await page.evaluate((g) => {
    const BASE = g.__base;
    const CASES = g.__cases;
    const pick = r => ({
      ok: r.ok, why: r.why, media: r.media, mediaPaid: r.mediaPaid, agencyFee: r.agencyFee, marketing: r.marketing,
      orders: r.orders, paid: r.paid, newCust: r.newCust,
      revenueGross: r.revenueGross, revenue: r.revenue, cogs: r.cogs, varCosts: r.varCosts,
      grossProfit: r.grossProfit, contribution: r.contribution, ebitda: r.ebitda, tax: r.tax, netProfit: r.netProfit,
      grossMarginPct: r.grossMarginPct, marginPct: r.marginPct,
      stages: (r.stages || []).map(s => ({ key: s.key, n: s.n, cr: s.cr, unit: s.unit })),
      m: r.m ? Object.keys(r.m).filter(k => typeof r.m[k] === 'number' || r.m[k] === null).sort()
        .reduce((o, k) => { o[k] = r.m[k]; return o; }, {}) : null,
      verdict: r.m && r.m.verdictRoas ? r.m.verdictRoas.level : null,
      reach: r.reach, reachShare: r.reachShare, freqNeeded: r.freqNeeded, reachWarn: r.reachWarn,
      perDay: r.perDay, cash: r.cash, target: r.target,
      narrow: r.narrow ? { key: r.narrow.key, cr: r.narrow.cr } : null,
    });
    const out = { funnel: {}, scenarios: {}, fact: null, media: null, unit: null };
    Object.keys(CASES).forEach(k => { out.funnel[k] = pick(MKC.funnel(CASES[k])); });
    [10, 20, 35].forEach(sp => {
      const sc = MKC.scenarios(BASE, sp);
      out.scenarios['sp' + sp] = { low: pick(sc.low), base: pick(sc.base), high: pick(sc.high) };
    });
    out.fact = MKC.fact(MKC.funnel(BASE), { days: 10, spent: 8300000, buyQty: 1400, orders: 25 });
    out.media = MKC.media([
      { name: 'A', buy: 'click', budget: 10000000, price: 2000, cr1: 10, cr2: 20 },
      { name: 'B', buy: 'lead', budget: 6000000, price: 60000, cr1: 25 },
      { name: 'C', buy: 'impr', budget: 4000000, price: 80000, cr1: 1.5, cr2: 12 },
      { name: 'D', buy: 'click', budget: 3000000, price: 1500, cr1: 8 },
    ], { aov: 500000, marginPct: 40, varPct: 5 });
    out.unit = {
      ltvSimple: MKC.ltvSimple(500000, 3), ltvMargin: MKC.ltvMargin(500000, 40, 20),
      life: MKC.lifetime(20), ratio: MKC.ltvCac(MKC.ltvMargin(500000, 40, 20), 250000),
      payLin: MKC.payback(800000, 500000, 40), payCoh: MKC.payback(800000, 500000, 40, 20),
      payNever: MKC.payback(1200000, 500000, 40, 20),
    };
    return out;
  }, { __base: CFG, __cases: goldenCases() });

  const diffs = [];
  const walk = (a, b, path) => {
    if (a === b) return;
    if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-6) diffs.push([path, b, a]); return; }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (String(a) !== String(b)) diffs.push([path, b, a]); return; }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach(k => walk(a[k], b[k], path + '.' + k));
  };
  walk(live, golden, '');
  console.log('    сверено ключей: ' + JSON.stringify(live).length + ' байт, расхождений: ' + diffs.length);
  if (diffs.length) console.log('    ' + JSON.stringify(diffs.slice(0, 8)));
  ok('семнадцать конфигураций воронки совпали со слепком', diffs.filter(d => d[0].startsWith('.funnel')).length === 0, diffs.filter(d => d[0].startsWith('.funnel')).slice(0, 5));
  ok('сценарии совпали', diffs.filter(d => d[0].startsWith('.scenarios')).length === 0, diffs.filter(d => d[0].startsWith('.scenarios')).slice(0, 5));
  ok('план-факт, медиаплан и юнит-экономика совпали',
    diffs.filter(d => /^\.(fact|media|unit)/.test(d[0])).length === 0, diffs.filter(d => /^\.(fact|media|unit)/.test(d[0])).slice(0, 5));

  const bad = errs.filter(x => /SyntaxError|is not defined|Cannot read|Cannot set/.test(x));
  console.log('\n[I] ошибки страницы');
  ok('нет ошибок исполнения', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();

function goldenCases() {
  const BASE = CFG;
  return {
    base: BASE,
    budget: { ...BASE, mode: 'budget', budget: 25000000 },
    targetRoas: { ...BASE, mode: 'target', targetKind: 'roas', targetValue: 4, price: null },
    targetDrr: { ...BASE, mode: 'target', targetKind: 'drr', targetValue: 25, price: null },
    targetCpa: { ...BASE, mode: 'target', targetKind: 'cpa', targetValue: 125000, price: null },
    vat: { ...BASE, vatPct: 12, vatIncluded: true },
    markup: { ...BASE, adVatPct: 12, agencyPct: 15, agencyFix: 500000, prodCost: 2000000 },
    loss: { ...BASE, redeemPct: 80, returnPct: 5 },
    repeat: { ...BASE, repeatPct: 30 },
    taxTurn: { ...BASE, taxMode: 'turnover', turnoverPct: 4 },
    taxProfit: { ...BASE, aov: 1500000, taxMode: 'profit', profitTaxPct: 15 },
    margin: { ...BASE, cogsMode: 'margin', marginPct: 40, unitCost: null },
    buyImpr: { ...BASE, buy: 'impr', price: 100000 },
    buyLead: { ...BASE, buy: 'lead', price: 50000 },
    reach: { ...BASE, audience: 400000, frequency: 3 },
    cash: { ...BASE, payDelay: 14, instalPct: 30, instalMonths: 6, instalFeePct: 20 },
    all: {
      ...BASE, vatPct: 12, vatIncluded: true, adVatPct: 12, agencyPct: 15, prodCost: 2000000,
      redeemPct: 85, returnPct: 3, repeatPct: 20, taxMode: 'turnover', turnoverPct: 4,
      audience: 500000, frequency: 2.5, payDelay: 10, instalPct: 20, instalMonths: 3, instalFeePct: 15
    },
  };
}
