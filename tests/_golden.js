/* Снимает слепок расчётов в golden_calc.json с текущего ядра.
   Запускать осознанно: только когда формулы проверены и меняется оформление.
   Если правились сами формулы — пересобрать слепок и объяснить в коммите,
   что именно сдвинулось и почему. Набор конфигураций один и тот же с
   probe_calc.js: там он лежит в goldenCases(). */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
const BASE = {
  mode:'goal', buy:'click', price:5000, goal:100,
  stages:[{key:'impr',name:'Показы'},{key:'click',name:'Клики',cr:2},
          {key:'lead',name:'Лиды',cr:10},{key:'sale',name:'Продажи',cr:20}],
  aov:500000, cogsMode:'unit', unitCost:300000,
  varPct:5, fixed:2000000, salesCost:3000000,
  vatPct:0, vatIncluded:false, taxMode:'none',
  redeemPct:100, returnPct:0, repeatPct:0,
  adVatPct:0, agencyPct:0, agencyFix:0, prodCost:0, days:30,
};
const CASES = {
  base: BASE,
  budget: {...BASE, mode:'budget', budget:25000000},
  targetRoas: {...BASE, mode:'target', targetKind:'roas', targetValue:4, price:null},
  targetDrr: {...BASE, mode:'target', targetKind:'drr', targetValue:25, price:null},
  targetCpa: {...BASE, mode:'target', targetKind:'cpa', targetValue:125000, price:null},
  vat: {...BASE, vatPct:12, vatIncluded:true},
  markup: {...BASE, adVatPct:12, agencyPct:15, agencyFix:500000, prodCost:2000000},
  loss: {...BASE, redeemPct:80, returnPct:5},
  repeat: {...BASE, repeatPct:30},
  taxTurn: {...BASE, taxMode:'turnover', turnoverPct:4},
  taxProfit: {...BASE, aov:1500000, taxMode:'profit', profitTaxPct:15},
  margin: {...BASE, cogsMode:'margin', marginPct:40, unitCost:null},
  buyImpr: {...BASE, buy:'impr', price:100000},
  buyLead: {...BASE, buy:'lead', price:50000},
  reach: {...BASE, audience:400000, frequency:3},
  cash: {...BASE, payDelay:14, instalPct:30, instalMonths:6, instalFeePct:20},
  all: {...BASE, vatPct:12, vatIncluded:true, adVatPct:12, agencyPct:15, prodCost:2000000,
        redeemPct:85, returnPct:3, repeatPct:20, taxMode:'turnover', turnoverPct:4,
        audience:500000, frequency:2.5, payDelay:10, instalPct:20, instalMonths:3, instalFeePct:15},
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  const data = await p.evaluate(({ BASE, CASES }) => {
    const pick = r => ({
      ok:r.ok, why:r.why, media:r.media, mediaPaid:r.mediaPaid, agencyFee:r.agencyFee, marketing:r.marketing,
      orders:r.orders, paid:r.paid, newCust:r.newCust,
      revenueGross:r.revenueGross, revenue:r.revenue, cogs:r.cogs, varCosts:r.varCosts,
      grossProfit:r.grossProfit, contribution:r.contribution, ebitda:r.ebitda, tax:r.tax, netProfit:r.netProfit,
      grossMarginPct:r.grossMarginPct, marginPct:r.marginPct,
      stages:(r.stages||[]).map(s=>({key:s.key, n:s.n, cr:s.cr, unit:s.unit})),
      m:r.m ? Object.keys(r.m).filter(k=>typeof r.m[k]==='number'||r.m[k]===null).sort()
              .reduce((o,k)=>{o[k]=r.m[k];return o;},{}) : null,
      verdict:r.m&&r.m.verdictRoas?r.m.verdictRoas.level:null,
      reach:r.reach, reachShare:r.reachShare, freqNeeded:r.freqNeeded, reachWarn:r.reachWarn,
      perDay:r.perDay, cash:r.cash, target:r.target,
      narrow:r.narrow?{key:r.narrow.key, cr:r.narrow.cr}:null,
    });
    const out = { funnel:{}, scenarios:{}, fact:null, media:null, unit:null };
    Object.keys(CASES).forEach(k => { out.funnel[k] = pick(MKC.funnel(CASES[k])); });
    [10,20,35].forEach(sp => {
      const sc = MKC.scenarios(BASE, sp);
      out.scenarios['sp'+sp] = { low:pick(sc.low), base:pick(sc.base), high:pick(sc.high) };
    });
    out.fact = MKC.fact(MKC.funnel(BASE), { days:10, spent:8300000, buyQty:1400, orders:25 });
    out.media = MKC.media([
      {name:'A', buy:'click', budget:10000000, price:2000, cr1:10, cr2:20},
      {name:'B', buy:'lead',  budget:6000000,  price:60000, cr1:25},
      {name:'C', buy:'impr',  budget:4000000,  price:80000, cr1:1.5, cr2:12},
      {name:'D', buy:'click', budget:3000000,  price:1500, cr1:8},
    ], { aov:500000, marginPct:40, varPct:5 });
    out.unit = {
      ltvSimple:MKC.ltvSimple(500000,3), ltvMargin:MKC.ltvMargin(500000,40,20),
      life:MKC.lifetime(20), ratio:MKC.ltvCac(MKC.ltvMargin(500000,40,20),250000),
      payLin:MKC.payback(800000,500000,40), payCoh:MKC.payback(800000,500000,40,20),
      payNever:MKC.payback(1200000,500000,40,20),
    };
    return out;
  }, { BASE, CASES });
  fs.writeFileSync(__dirname + '/golden_calc.json', JSON.stringify(data, null, 1));
  console.log('слепок записан, случаев воронки: ' + Object.keys(data.funnel).length);
  await b.close();
})();
