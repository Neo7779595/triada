/* probe_period — у каждого показателя написан период.

   Число без периода — не показатель, а загадка. «On-time delivery 65%» за
   неделю и за всю историю требуют разных решений, а выглядят одинаково; и
   пока период не написан, человек достраивает его сам — обычно неверно.

   Отдельная ловушка: блок «Согласование с клиентом» лежит внутри карточки
   с переключателем периода, но фильтру не подчиняется. Без подписи это
   прямой обман: поставил «7 дней», а три плитки из семи считаются за всё
   время. Проверка стережёт именно такие места. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* Допустимые формулировки. Свободный текст здесь опаснее пустоты: «за месяц»,
   «30д» и «30 дней» на одном экране читаются как три разных окна. */
const СЛОВАРЬ = ['сейчас', 'всё время', '7 дней', '30 дней', '90 дней', '6 месяцев'];

const setup = () => {
  window.toast = () => {}; window.LIVE = false;
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.agIsOwner = () => true;
  document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
  document.getElementById('app-ag').classList.add('on');
};

/* Метки читаем вместе с названием блока: проверять надо не «есть ярлык», а
   «у этого показателя написан этот период». */
const собрать = () => [...document.querySelectorAll('#content-ag .per-tag')].map(t => {
  const box = t.parentElement;
  const имя = box.cloneNode(true);
  [...имя.querySelectorAll('.per-tag')].forEach(x => x.remove());
  return { имя: имя.textContent.replace(/\s+/g, ' ').trim(), период: t.textContent.trim() };
});

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(setup);

  console.log('\n[A] сводка');
  const SV = await page.evaluate((собратьSrc) => {
    OVERVIEW._loaded = true; OVERVIEW.stageLoad = [];
    OVERVIEW.onTime = 17; OVERVIEW.deadlineDone = 26; OVERVIEW.trans = 1000; OVERVIEW.rework = 318;
    OVERVIEW.v30 = 40; OVERVIEW.uniq30 = 38; OVERVIEW.uniq7 = 7;
    OVERVIEW.overdueItems = 16; OVERVIEW.overdueStages = 15; OVERVIEW.overdueTasks = 1;
    PROJECTS = [
      { id: 'p1', name: 'APOLO COFFEE', logo: 'A', logoUrl: null, pct: 30, cat: '—', svc: '—', mrr: 9000000, status: 'active', _stot: 4, _sdone: 2, _overdue: false, _lastActDays: 2, _nextDue: null, createdAt: '2026-06-01' },
      { id: 'p2', name: 'DETROYD', logo: 'D', logoUrl: null, pct: 60, cat: '—', svc: '—', mrr: 5000000, status: 'active', _stot: 5, _sdone: 3, _overdue: true, _lastActDays: 20, _nextDue: null, createdAt: '2026-05-01' }];
    renderOverview();
    return (0, eval)('(' + собратьSrc + ')')();
  }, собрать.toString());
  const наз = SV.map(x => x.имя);
  const пер = n => (SV.find(x => x.имя === n) || {}).период;
  console.log('    ' + JSON.stringify(SV));
  ok('здоровье портфеля — состояние на сейчас', пер('Здоровье портфеля') === 'сейчас', SV);
  ok('активные и средний прогресс — тоже сейчас',
    пер('Активные') === 'сейчас' && пер('Средний прогресс') === 'сейчас', SV);
  ok('просрочка — сейчас', пер('Просрочено') === 'сейчас', SV);
  /* on-time и откаты считаются по всему журналу переходов, без окна:
     tLoadOverview грузит stage_history целиком и нигде не режет по дате. */
  ok('on-time delivery честно назван «всё время», а не окном',
    пер('On-time delivery') === 'всё время', SV);
  ok('откаты — тоже за всё время', пер('Откаты') === 'всё время', SV);
  ok('velocity — за 30 дней', пер('Velocity') === '30 дней', SV);
  ok('риск оттока — состояние на сейчас', пер('Риск оттока') === 'сейчас', SV);
  ok('в сводке подписаны все восемь показателей', SV.length === 8, наз);
  ok('формулировки — из общего словаря, а не своими словами',
    SV.every(x => СЛОВАРЬ.indexOf(x.период) >= 0), SV.map(x => x.период));

  console.log('\n[B] циклы');
  const СЦЕНА = () => {
    CYCLES = Object.assign({}, CYCLES, {
      _loaded: true, projMedianMs: 86400000 * 9, projCount: 2,
      bottleneck: { name: 'Съёмка', p50Ms: 86400000 * 4, n: 6 },
      coverageDone: 8, coverageTotal: 10, coveragePct: 80, stuckNow: 1,
      agingRows: [{ pid: 'p1', sid: 's1', client: 'APOLO', stage: 'Съёмка', startMs: Date.now() - 86400000 * 7, sinceMs: 86400000 * 7, overPct: 40, byOwn: true, frozen: null }],
      stages: [{ name: 'Съёмка', n: 6, p50Ms: 86400000 * 4, p90Ms: 86400000 * 8, p85Ms: 86400000 * 7, actMedMs: 86400000, lossMs: 86400000 * 3, sharePct: 60, reworkPct: 12, lowSample: false, bn: true },
        { name: 'Монтаж', n: 5, p50Ms: 86400000 * 2, p90Ms: 86400000 * 5, p85Ms: 86400000 * 4, actMedMs: 86400000, lossMs: 86400000, sharePct: 40, reworkPct: 5, lowSample: false, bn: false }],
      chartStages: [{ name: 'Съёмка', p50Ms: 86400000 * 4, p90Ms: 86400000 * 8, bn: true }, { name: 'Монтаж', p50Ms: 86400000 * 2, p90Ms: 86400000 * 5, bn: false }],
      trend: { vals: [4, 5, 3, 6, 4, 5], labels: ['мар', 'апр', 'май', 'июн', 'июл', 'авг'] },
      clients: [{ pid: 'p1', client: 'APOLO', logo: 'A', logoUrl: null, n: 6, medianMs: 86400000 * 4, avgMs: 86400000 * 5, reworkPct: 12 }],
      reviewCount: 12, reviewTotalSec: 90000, reviewAvgSec: 7500, reviewNow: 2,
      reviewTasks: [{ tid: 't1', pid: 'p1', title: 'Сценарий', stage: 'Съёмка', project: 'APOLO', sec: 7200, onReview: true, done: false, date: '2026-08-01', asg: 'm1' }],
      reviewStages: [], reviewByWho: [],
      apr: { sent: 9, materials: 5, closed: 4, firstOk: 3, avgRounds: 1.8, replyAvgMs: 86400000, replyMaxMs: 86400000 * 3, pending: 2, pendOldestMs: 86400000 * 2, byProject: [{ client: 'APOLO', rounds: 3, materials: 2, avg: 1.5, fixes: 1 }] },
      workCount: 20, workTotalSec: 360000,
      workTopTasks: [{ tid: 't2', pid: 'p1', title: 'Монтаж ролика', stage: 'Монтаж', project: 'APOLO', sec: 10800, done: true, date: '2026-08-02', asg: 'm1' }],
      workStages: [], workByAsg: [], workParetoPct: 20,
    });
    window.CYCLES = CYCLES;
    renderCycles();
  };
  const CY = await page.evaluate(([сценаSrc, собратьSrc]) => {
    (0, eval)('(' + сценаSrc + ')')();
    return (0, eval)('(' + собратьSrc + ')')();
  }, [СЦЕНА.toString(), собрать.toString()]);
  const цп = n => (CY.find(x => x.имя === n) || {}).период;
  console.log('    ' + JSON.stringify(CY.map(x => x.имя + ' → ' + x.период)));
  ok('цикл проекта, узкое место и покрытие — за всё время',
    цп('Цикл проекта · медиана') === 'всё время' && цп('Узкое место') === 'всё время'
    && цп('Покрытие данными') === 'всё время', CY);
  ok('«застряло» и «застрявшие этапы» — состояние на сейчас',
    цп('Застряло') === 'сейчас' && цп('Застрявшие этапы дольше своего p85') === 'сейчас', CY);
  ok('график p50/p90 и детализация — за всё время',
    цп('Календарный срок этапа: медиана (p50) и худший случай (p90)') === 'всё время'
    && цп('Детализация по этапам') === 'всё время', CY);
  /* Тренд берёт шесть календарных месяцев до последнего с данными, а не до
     сегодня, — но окно всё равно шестимесячное, и назвать его надо. */
  ok('тренд подписан своим окном в шесть месяцев',
    цп('Тренд медианы цикла по месяцам') === '6 месяцев', CY);
  ok('бенчмарк по клиентам — за всё время',
    цп('Бенчмарк по клиентам средний цикл завершённого этапа') === 'всё время', CY);
  ok('формулировки те же, что в сводке', CY.every(x => СЛОВАРЬ.indexOf(x.период) >= 0), CY.map(x => x.период));
  ok('без подписи не остался ни один блок циклов', CY.length >= 16, CY.length);

  console.log('\n[C] метка идёт за переключателем периода');
  const ФИЛЬТР = await page.evaluate(([сценаSrc, собратьSrc]) => {
    const снять = () => (0, eval)('(' + собратьSrc + ')')();
    (0, eval)('(' + сценаSrc + ')')();
    const всё = снять();
    REV_PERIOD = '30'; WORK_PERIOD = '7'; renderCycles();
    const окно = снять();
    REV_PERIOD = 'all'; WORK_PERIOD = 'all'; renderCycles();
    return { всё, окно, назад: снять() };
  }, [СЦЕНА.toString(), собрать.toString()]);
  const пВсё = n => (ФИЛЬТР.всё.find(x => x.имя === n) || {}).период;
  const пОкно = n => (ФИЛЬТР.окно.find(x => x.имя === n) || {}).период;
  const пНазад = n => (ФИЛЬТР.назад.find(x => x.имя === n) || {}).период;
  const РЕВ = 'Время на утверждении сколько задачи ждут согласования';
  const РАБ = 'Трудозатраты по задачам сколько времени уходит на работу · из «В работе»';
  ok('по умолчанию оба блока считают за всё время',
    пВсё(РЕВ) === 'всё время' && пВсё(РАБ) === 'всё время', [пВсё(РЕВ), пВсё(РАБ)]);
  ok('поставили 30 дней на утверждении — метка стала «30 дней»', пОкно(РЕВ) === '30 дней', пОкно(РЕВ));
  ok('поставили 7 дней на трудозатратах — метка стала «7 дней»', пОкно(РАБ) === '7 дней', пОкно(РАБ));
  ok('плитки внутри блока слушают тот же фильтр',
    пОкно('Среднее время') === '30 дней' && пОкно('Суммарно') === '30 дней'
    && пОкно('Медиана на задачу') === '7 дней' && пОкно('Среднее на задачу') === '7 дней', ФИЛЬТР.окно);
  ok('«сейчас на утверждении» остаётся точечным', пОкно('Сейчас на утверждении') === 'сейчас', ФИЛЬТР.окно);
  ok('вернули «всё время» — метки вернулись',
    пНазад(РЕВ) === 'всё время' && пНазад(РАБ) === 'всё время', [пНазад(РЕВ), пНазад(РАБ)]);

  console.log('\n[D] блок, который фильтру не подчиняется, об этом и говорит');
  /* «Согласование с клиентом» нарисовано внутри карточки с переключателем
     периода, но считается по всей истории: _cycApprHTML получает C.apr
     напрямую, минуя _cycFilterTasks. Метка обязана остаться «всё время»
     даже когда в карточке выбрано окно — иначе она врёт. */
  const СОГЛ = await page.evaluate(([сценаSrc, собратьSrc]) => {
    (0, eval)('(' + сценаSrc + ')')();
    REV_PERIOD = '7'; renderCycles();
    const s = (0, eval)('(' + собратьSrc + ')')();
    REV_PERIOD = 'all';
    return s;
  }, [СЦЕНА.toString(), собрать.toString()]);
  const сп = n => (СОГЛ.find(x => x.имя === n) || {}).период;
  /* Метка стоит при самом названии, а не отдельным довеском справа: иначе
     она висит сама по себе и непонятно, к чему относится. */
  ok('заголовок «Согласование с клиентом» подписан «всё время»',
    сп('Согласование с клиентом') === 'всё время', СОГЛ.filter(x => /Согласование|^$/.test(x.имя)));
  ok('и его плитки — тоже, хотя рядом выбрано окно в 7 дней',
    сп('Кругов на материал') === 'всё время' && сп('С первого раза') === 'всё время'
    && сп('Клиент отвечает') === 'всё время', СОГЛ);
  ok('а «ждут ответа» — про сейчас, это не окно', сп('Ждут ответа') === 'сейчас', СОГЛ);

  console.log('\n[E] метка не должна ломать ряд');
  /* Пока период стоял в строку с названием, «Активные» влезали, а «On-time
     delivery» переносилось — и числа под ними вставали на разной высоте.
     Ряд из четырёх ячеек обязан читаться как ряд, а не как лесенка. */
  const РЯД = await page.evaluate(() => {
    renderOverview();
    const cells = [...document.querySelectorAll('.ov-hero-cell')];
    const y = el => Math.round(el.getBoundingClientRect().top);
    const h = el => Math.round(el.getBoundingClientRect().height);
    return { ячеек: cells.length,
      подписи: cells.map(c => h(c.querySelector('.l'))),
      верхПодписи: cells.map(c => y(c.querySelector('.l'))),
      числа: cells.map(c => y(c.querySelector('.v'))),
      расшифровки: cells.map(c => y(c.querySelector('.s'))),
      строк: cells.map(c => c.querySelectorAll('.l .per-tag').length) };
  });
  const один = a => new Set(a).size === 1;
  ok('во всех четырёх ячейках подпись одной высоты', РЯД.ячеек === 4 && один(РЯД.подписи), РЯД);
  ok('подписи начинаются на одном уровне', один(РЯД.верхПодписи), РЯД.верхПодписи);
  ok('числа стоят на одной линии', один(РЯД.числа), РЯД.числа);
  ok('и расшифровки под ними — тоже', один(РЯД.расшифровки), РЯД.расшифровки);
  ok('период у каждой ячейки ровно один', один(РЯД.строк) && РЯД.строк[0] === 1, РЯД.строк);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  process.exit(fail ? 1 : 0);
})();
