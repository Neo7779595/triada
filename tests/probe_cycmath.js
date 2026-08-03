/* probe_cycmath — арифметика модуля «Циклы».

   Раньше эта математика жила внутри загрузчика, рядом с запросами в базу, и
   проверить её было нечем: probe_cyc подставляет уже готовые числа и смотрит
   на списки. А ровно здесь считается то, из-за чего в модуле спорят: сколько
   на самом деле шёл этап.

   Три величины, которые нельзя путать:
     lead   — от первого «В работе» до «Завершён». Календарное время: ночь,
              выходные и возврат на доработку входят.
     active — сколько из этого этап реально стоял в «В работе».
     idle   — lead − active.

   История ниже собрана руками, все ожидания посчитаны на бумаге.

   БРИФ (этап s1, проект p1) — один инстанс с возвратом:
     10:00 active · 11:00 wait · 09:00 следующего дня active · 10:00 done
     lead = 24 ч, active = 1 ч + 1 ч = 2 ч, idle = 22 ч, возвратов 1.
   СЦЕНАРИИ (s2, p1) — два инстанса без возвратов:
     инстанс 1: 2 ч lead, 2 ч active
     инстанс 2: 6 ч lead, 6 ч active
     медиана lead = 4 ч, медиана active = 4 ч, idle = 0, возвратов 0%.
   СЪЁМКА (s3, p1) — открыт и не закрыт: в инстансы не идёт, попадает в WIP.
   МОНТАЖ (s4, p2) — закрыт без единого «В работе»: инстанса нет,
     в покрытие данными идёт как этап с историей, но без замера.

   Отсюда:
     инстансов 3, этапов с замером 2 из 4 → покрытие 50%
     узкое место — БРИФ (24 ч против 4 ч)
     доля p50 БРИФА = 24 / (24 + 4) = 86%
     цикл проекта p1 = от старта БРИФА до финиша последнего этапа прохода
     p90 не показывается ни у кого: у обоих n < 5. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const H = 3600000, D = 24 * H;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const R = await page.evaluate(({ H, D }) => {
    /* Точка отсчёта фиксированная: иначе «сейчас» уедет между прогонами и
       WIP-часы будут каждый раз другими. */
    const T0 = Date.parse('2026-06-01T10:00:00Z');
    const now = T0 + 3 * D;
    const e = (sid, pid, name, st, at) => ({ stage_id: sid, project_id: pid, stage_name: name, new_status: st, created_at: new Date(at).toISOString() });
    const hist = [
      e('s1', 'p1', 'БРИФ', 'active', T0),
      e('s1', 'p1', 'БРИФ', 'wait', T0 + H),
      e('s1', 'p1', 'БРИФ', 'active', T0 + 23 * H),
      e('s1', 'p1', 'БРИФ', 'done', T0 + 24 * H),
      e('s2', 'p1', 'СЦЕНАРИИ', 'active', T0 + 24 * H),
      e('s2', 'p1', 'СЦЕНАРИИ', 'done', T0 + 26 * H),
      e('s2', 'p1', 'СЦЕНАРИИ', 'active', T0 + 30 * H),
      e('s2', 'p1', 'СЦЕНАРИИ', 'done', T0 + 36 * H),
      e('s3', 'p1', 'СЪЁМКА', 'active', T0 + 40 * H),
      e('s4', 'p2', 'МОНТАЖ', 'done', T0 + 5 * H),
    ];
    const r = cycStageMath(hist, now);
    const row = n => r.stageRows.filter(x => x.name === n)[0] || null;
    return {
      inst: r.instances.length,
      brief: row('БРИФ'), scen: row('СЦЕНАРИИ'),
      bn: r.bottleneck, cov: { d: r.coverageDone, t: r.coverageTotal, p: r.coveragePct },
      wip: r.wips.map(w => ({ n: w.name, since: Math.round(w.sinceMs / H) })),
      proj: { ms: r.projMedianMs, n: r.projCount },
      names: r.stageRows.map(x => x.name),
    };
  }, { H, D });

  console.log('[A] инстанс собирается из пары «старт → финиш»');
  ok('незакрытый этап в замеры не идёт, а становится WIP',
    R.inst === 3 && R.wip.length === 1 && R.wip[0].n === 'СЪЁМКА', { inst: R.inst, wip: R.wip });
  ok('этап, закрытый без единого «в работе», замера не даёт',
    R.names.indexOf('МОНТАЖ') < 0, R.names);
  ok('WIP считает часы от старта, а не от начала истории', R.wip[0].since === 32, R.wip);

  console.log('[B] БРИФ: возврат удлиняет цикл, но не работу');
  ok('цикл этапа — сутки: от первого «в работе» до «завершён»',
    R.brief.p50Ms === 24 * H, R.brief.p50Ms / H);
  ok('в работе он был два часа из этих суток', R.brief.actMedMs === 2 * H, R.brief.actMedMs / H);
  ok('простой — ровно разница, 22 часа', R.brief.lossMs === 22 * H, R.brief.lossMs / H);
  ok('возврат засчитан один, но процент не показывается: замер один',
    R.brief.n === 1 && R.brief.reworkPct === null, R.brief);
  ok('p90 по одному замеру не выдумывается', R.brief.p90Ms === null, R.brief.p90Ms);
  ok('и сам замер помечен как ненадёжный', R.brief.lowSample === true, R.brief.lowSample);

  console.log('[C] СЦЕНАРИИ: два инстанса, медиана между ними');
  ok('медиана цикла 4 часа — середина между 2 и 6', R.scen.p50Ms === 4 * H, R.scen.p50Ms / H);
  ok('работа равна циклу: этап не откладывали', R.scen.actMedMs === 4 * H, R.scen.actMedMs / H);
  ok('простоя нет', R.scen.lossMs === 0, R.scen.lossMs);
  ok('возвратов ноль процентов, а не «нет данных»', R.scen.reworkPct === 0, R.scen.reworkPct);
  ok('два замера — уже не «мало данных»? нет, порог три', R.scen.lowSample === true, R.scen);

  console.log('[D] сводные числа');
  ok('узкое место — БРИФ, он же самый долгий',
    R.bn && R.bn.name === 'БРИФ' && R.bn.p50Ms === 24 * H, R.bn);
  ok('покрытие: замер есть у двух этапов из четырёх с историей',
    R.cov.d === 2 && R.cov.t === 4 && R.cov.p === 50, R.cov);
  ok('доля p50 БРИФА — 86% от суммы медиан', R.brief.sharePct === 86, R.brief.sharePct);
  ok('доля СЦЕНАРИЕВ — оставшиеся 14%', R.scen.sharePct === 14, R.scen.sharePct);
  ok('доли складываются в сотню', R.brief.sharePct + R.scen.sharePct === 100,
    [R.brief.sharePct, R.scen.sharePct]);
  /* Цикл проекта — от старта первого этапа последнего прохода до финиша
     последнего. БРИФ стартовал в T0, СЦЕНАРИИ закрылись в T0+36ч, причём
     СЦЕНАРИИ шли дважды: повтор этапа не должен выкидывать проект из замера. */
  ok('цикл проекта — 36 часов по одному проекту',
    R.proj.ms === 36 * H && R.proj.n === 1, R.proj);

  console.log('[E] правила, на которых модуль легко соврал бы');
  const E = await page.evaluate(({ H, D }) => {
    const T0 = Date.parse('2026-06-01T10:00:00Z'), now = T0 + 10 * D;
    const e = (sid, pid, name, st, at) => ({ stage_id: sid, project_id: pid, stage_name: name, new_status: st, created_at: new Date(at).toISOString() });
    /* Продление договора переводит все этапы в wait одним пакетом. Это граница
       нового цикла, а не возврат: иначе открытый инстанс тянулся бы через
       продление и завышал все медианы. */
    const bulk = [];
    ['a', 'b', 'c'].forEach((k, i) => { bulk.push(e('r' + k, 'p9', 'ЭТАП ' + k, 'active', T0)); });
    ['a', 'b', 'c'].forEach((k, i) => { bulk.push(e('r' + k, 'p9', 'ЭТАП ' + k, 'wait', T0 + 5 * H + i)); });
    ['a', 'b', 'c'].forEach((k, i) => { bulk.push(e('r' + k, 'p9', 'ЭТАП ' + k, 'active', T0 + 6 * H)); });
    ['a', 'b', 'c'].forEach((k, i) => { bulk.push(e('r' + k, 'p9', 'ЭТАП ' + k, 'done', T0 + 8 * H)); });
    const withBulk = cycStageMath(bulk, now);
    /* Пять замеров одного этапа — здесь p90 уже честен. */
    const many = [];
    for (let i = 0; i < 5; i++) {
      many.push(e('m1', 'p8', 'МНОГО', 'active', T0 + i * D));
      many.push(e('m1', 'p8', 'МНОГО', 'done', T0 + i * D + (i + 1) * H));   // 1,2,3,4,5 часов
    }
    const withMany = cycStageMath(many, now);
    const mrow = withMany.stageRows[0];
    return {
      bulkRow: withBulk.stageRows[0],
      bulkInst: withBulk.instances.map(x => ({ n: x.name, lead: x.leadMs / H, ret: x.returns })),
      p90: mrow.p90Ms, p50: mrow.p50Ms, n: mrow.n, low: mrow.lowSample,
    };
  }, { H, D });
  ok('массовый сброс при продлении не оставляет за собой возвратов',
    E.bulkInst.length === 3 && E.bulkInst.every(x => x.ret === 0), E.bulkInst);
  ok('и цикл после сброса меряется от нового старта: 2 часа, а не 8',
    E.bulkRow.p50Ms === 2 * H, E.bulkRow.p50Ms / H);
  ok('на пяти замерах медиана — третий по величине, 3 часа', E.p50 === 3 * H, E.p50 / H);
  ok('и p90 наконец показывается: 4,6 часа', Math.round(E.p90 / H * 100) === 460, E.p90 / H);
  ok('пять замеров — уже не «мало данных»', E.low === false, E.low);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
