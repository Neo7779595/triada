/* probe_kbobs — наблюдатели в Базе знаний.

   Досье показывало числа, но число ничего не требует: 25% прогресса —
   это много или мало, и что с этим делать? Наблюдатели — правила, которые
   смотрят на факты и пишут предложение, а под каждым предложением лежит
   арифметика: какие числа взяты, откуда и какой формулой сведены.

   Фикстура собрана так, чтобы сработали все восемь правил, и все ожидаемые
   числа посчитаны здесь на бумаге, а не сняты с экрана:

     договор     · кончается через 9 дней          → риск
     маржа       · 25 000 000 − 22 000 000 = 12%   → риск   (у остальных 70/60/50 → медиана 60)
     задачи      · 3 из 4 открытых старше 21 дня, самой старой 70 дней → риск
     цена лида   · 9 300 000 ÷ 150 = 62 000 при пределе 50 000 → риск
                   потери: (62 000 − 50 000) × 300 = 3 600 000
     формат      · Reels 140 000/200 000 = 70% охвата при 8/40 = 20% объёма → 3,5× → находка
     ER          · 4,8 при цели 3,5 → +37%          → находка
     отчётность  · последний 45 дней назад, медиана по 4 проектам [3,10,20,45] = 15 → наблюдение
     бриф        · не заполнен, проект идёт 120 дней → наблюдение

   Итого 8 наблюдений: 4 риска, 2 находки, 2 наблюдения. Порядок — риски,
   находки, наблюдения, внутри вида — порядок правил: ct, svc, task, cpl,
   smmfmt, er, rep, brief.

   Треугольники в списке: у APOLO COFFEE 4 риска, у Artel — 1 (договор через
   5 дней), у Level Studio и DeTroyd рисков нет.

   Отдельно проверяется то, на чём сравнение молча ломалось: в жизни строка
   списка проектов — это {key,name,logo,st}, без id, прогресса и денег.
   Фикстура повторяет именно этот вид, а не удобный. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'probe' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.toast = () => {}; window.LIVE = true; window.SB = window.SB || { from: () => ({}) };
  window.agIsOwner = () => true; window.agCanView = () => true; window.agCanEdit = () => true;
  window.agCanSeeProject = () => true;
  kbAutoEnsure = function () {};
  window.kbPortEnsure = () => {};
  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const ts = n => new Date(Date.now() + n * 86400000).toISOString();
  const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#12281f"/><circle cx="24" cy="20" r="9" fill="#37E6C8"/></svg>');

  const P1 = { id: 'p1', name: 'APOLO COFFEE', logo: 'A', logoUrl: LOGO, st: 'active', status: 'active',
    svc: 'PROD', tariff: 'DeGold', cat: 'Кофейни', pct: 25, stages: '2/8',
    mrr: 25000000, cost: 22000000, createdAt: day(-120), tg_chat_id: -100123, tg_settings: {} };
  const P2 = { id: 'p2', name: 'Artel', logo: 'A', st: 'active', status: 'active', pct: 40, stages: '2/5',
    mrr: 10000000, cost: 3000000, createdAt: day(-200) };
  const P3 = { id: 'p3', name: 'Level Studio', logo: 'L', st: 'active', status: 'active', pct: 70, stages: '7/10',
    mrr: 20000000, cost: 8000000, createdAt: day(-90) };
  const P4 = { id: 'p4', name: 'DeTroyd', logo: 'D', st: 'active', status: 'active', pct: 48, stages: '4/8',
    mrr: 12000000, cost: 6000000, createdAt: day(-60) };
  PROJECTS.length = 0; PROJECTS.push(P1, P2, P3, P4);
  window.agVisibleProjects = () => PROJECTS;
  /* Строка списка ровно та, что собирает tLoadKB: ключ, имя, буква, состояние.
     Ни id, ни денег, ни логотипа в ней нет — и всё, что сравнивает проекты,
     обязано ходить за самим проектом. */
  KB_PROJECTS.length = 0;
  PROJECTS.forEach(p => KB_PROJECTS.push({ key: String(p.id), name: p.name, logo: p.logo, st: p.status }));

  KB_PORT = { _loading: 0, _loaded: 1, _at: Date.now(), _err: '', rows: {
    p1: { rep: [ts(-45)], smm: [], plan: [], ctEnd: day(9) },
    p2: { rep: [ts(-3)],  smm: [], plan: [], ctEnd: day(5) },
    p3: { rep: [ts(-10)], smm: [], plan: [], ctEnd: day(200) },
    p4: { rep: [ts(-20)], smm: [], plan: [], ctEnd: '' } } };

  /* Расчёт калькулятора. Воронка: бюджет 15 000 000 по 50 000 за лид = 300
     лидов, конверсия в продажу 25% = 75 продаж по 400 000 с маржой 50%.
     Маржинальный доход 15 000 000, предельная цена лида — ровно 50 000.
     Факт: половина срока, потрачено 9 300 000 на 150 лидов → 62 000. */
  const CALC = { id: 'c9', name: 'Воронка · август', updated_at: ts(-2), cur: 'uzs', rate: null,
    data: { tab: 'funnel', f: {
      mode: 'budget', buy: 'lead', price: 50000, goal: 100, budget: 15000000,
      stages: [{ key: 'lead', name: 'Лиды', cr: null }, { key: 'sale', name: 'Продажи', cr: 25 }],
      aov: 400000, cogsMode: 'margin', unitCost: 0, marginPct: 50,
      varPct: 0, fixed: 0, salesCost: 0,
      vatPct: 0, vatIncluded: false, taxMode: 'none', turnoverPct: 0, profitTaxPct: 0,
      redeemPct: 100, returnPct: 0, repeatPct: 0,
      adVatPct: 0, agencyPct: 0, agencyFix: 0, prodCost: 0,
      days: 30, audience: null, frequency: null, spread: 20,
      targetKind: 'roas', targetValue: 4, payDelay: 0, instalPct: 0, instalMonths: 0, instalFeePct: 0,
      fact: { days: 15, spent: 9300000, buyQty: 150, orders: 35 } } } };

  /* SMM-отчёт: Reels 140 000 охвата на 8 единиц, посты 60 000 на 32.
     Всего 200 000 охвата и 40 единиц контента. ER 4,8 при цели 3,5. */
  const SMM = { id: 'r1', title: 'SMM-отчёт · август', kind: 'SMM', published_at: ts(-45),
    payload: { period: 'август 2026',
      metrics: { total_reach: 200000, reels_reach: 140000, posts_reach: 60000,
        reels_count: 8, posts_count: 32, content_total: 40, er: 4.8, subscribers_current: 12000 },
      goals: { er: 3.5 } } };

  kbProj = 'p1';
  KB_DATA['p1'] = { 'Контент-стратегия': [{ t: 'Рубрикатор', ty: 'Miro', url: '', at: day(-6), _id: 'm1' }] };
  KB_AUTO['p1'] = { _loaded: 1, _at: Date.now() - 4 * 60000,
    contract: { start_date: day(-120), end_date: day(9) },
    services: [{ service: 'PROD', tariff: 'DeGold', mrr: 25000000, cost: 22000000, status: 'active' }],
    members: [], lead: null, client: null,
    content: [], reports: [SMM],
    tasks: [{ status: 'active', created_at: ts(-70), time_spent: 0 },
            { status: 'active', created_at: ts(-30), time_spent: 0 },
            { status: 'wait',   created_at: ts(-25), time_spent: 0 },
            { status: 'active', created_at: ts(-5),  time_spent: 0 },
            { status: 'done',   created_at: ts(-40), completed_at: ts(-38), time_spent: 3600 }],
    stages: [], briefs: [], briefAt: '', calc: CALC };

  [...document.body.children].forEach(e => { if (e.id !== 'app-ag' && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName)) e.style.display = 'none'; });
  document.getElementById('app-ag').classList.add('on');
  KB_BLOCK = ''; KB_OBS_OPEN = {};
  agNav('kb');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1360, height: 940 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  await page.evaluate(setup);
  await page.waitForTimeout(400);

  console.log('[A] правила видят проект и говорят по делу');
  const board = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const cards = [...c.querySelectorAll('.kb-obs')];
    return {
      n: cards.length,
      kinds: cards.map(x => x.className.replace(/^kb-obs /, '').replace(/ hid$/, '')),
      kn: cards.map(x => x.querySelector('.kn').textContent),
      txt: cards.map(x => x.querySelector('.t').textContent),
      head: (c.querySelector('.kb-sub-h .kb-b-meta') || {}).textContent || '',
      firstSub: (c.querySelector('.kb-sub-h span') || {}).textContent || '',
      hid: cards.filter(x => x.classList.contains('hid')).length,
      more: (c.querySelector('.kb-obs-more') || {}).textContent || '',
      mathOpen: c.querySelectorAll('.kb-math.on').length,
    };
  });
  ok('сработали все восемь правил', board.n === 8, board.n);
  ok('порядок: сначала риски, потом находки, потом наблюдения',
    board.kinds.join(',') === 'risk,risk,risk,risk,find,find,note,note', board.kinds);
  ok('видов ровно три и они подписаны словами',
    board.kn.filter(x => /^Риск/.test(x)).length === 4 &&
    board.kn.filter(x => /^Находка/.test(x)).length === 2 &&
    board.kn.filter(x => /^Наблюдение/.test(x)).length === 2, board.kn);
  ok('первым идёт договор — он кончается через 9 дней',
    /Договор заканчивается через 9 дней/.test(board.txt[0]), board.txt[0]);
  ok('маржа посчитана из дохода и себестоимости: 25 000 000 и 22 000 000 → 12%',
    /25\s*000\s*000/.test(board.txt[1]) && /22\s*000\s*000/.test(board.txt[1]) && /12%/.test(board.txt[1]), board.txt[1]);
  ok('маржа сравнивается со своим портфелем: медиана 60%',
    /медиана — 60%/.test(board.txt[1]), board.txt[1]);
  ok('зависшие задачи: 3 из 4 открытых, самой старой 70 дней',
    /3 задачи/.test(board.txt[2]) && /70 дней/.test(board.txt[2]) && /всего 4/.test(board.txt[2]), board.txt[2]);
  ok('цена лида 62 000 против предельной 50 000',
    /62\s*000/.test(board.txt[3]) && /50\s*000/.test(board.txt[3]), board.txt[3]);
  ok('потери на плановом объёме — 3 600 000', /3\s*600\s*000/.test(board.txt[3]), board.txt[3]);
  ok('формат: Reels 70% охвата при 20% объёма, отдача 3,5×',
    /70% охвата/.test(board.txt[4]) && /20% объёма/.test(board.txt[4]) && /3,5×/.test(board.txt[4]), board.txt[4]);
  ok('вовлечённость 4,8 при цели 3,5 — выше на 37%',
    /4,8%/.test(board.txt[5]) && /3,5%/.test(board.txt[5]) && /37%/.test(board.txt[5]), board.txt[5]);
  ok('отчёта нет 45 дней при медиане портфеля 15 дней',
    /45 дней назад/.test(board.txt[6]) && /Медиана по портфелю — 15 дней/.test(board.txt[6]), board.txt[6]);
  ok('бриф не заполнен, а проект идёт 120 дней',
    /Бриф не заполнен/.test(board.txt[7]) && /120 дней/.test(board.txt[7]), board.txt[7]);

  console.log('[B] наблюдения не заслоняют витрину');
  ok('секция называется «Что видно»', board.firstSub === 'Что видно', board.firstSub);
  ok('в шапке — сколько наблюдений и когда обновлялись данные',
    /8 наблюдений/.test(board.head) && /4 минуты назад/.test(board.head), board.head);
  ok('сразу показаны три, остальные свёрнуты', board.hid === 5, board.hid);
  ok('свёрнутое живёт за кнопкой «Ещё 5»', /Ещё 5 наблюдений/.test(board.more), board.more);
  ok('расчёты по умолчанию закрыты', board.mathOpen === 0, board.mathOpen);

  const geo = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const obs = c.querySelector('.kb-obs'), tile = c.querySelector('.kb-tile');
    const hidden = [...c.querySelectorAll('.kb-obs.hid')][0];
    return { obsY: obs.getBoundingClientRect().top, tileY: tile.getBoundingClientRect().top,
      hiddenShown: hidden.getBoundingClientRect().height > 0,
      tiles: c.querySelectorAll('.kb-tile').length };
  });
  ok('наблюдения стоят над плитками, а не под ними', geo.obsY < geo.tileY, geo);
  ok('свёрнутое действительно не занимает места', geo.hiddenShown === false, geo);
  ok('витрина на месте — все десять блоков', geo.tiles === 10, geo.tiles);

  console.log('[C] под каждой фразой — арифметика');
  const math = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const cards = [...c.querySelectorAll('.kb-obs')];
    return cards.map(x => ({
      rows: x.querySelectorAll('.kb-math .r').length,
      keys: [...x.querySelectorAll('.kb-math .k')].map(k => k.textContent),
      body: [...x.querySelectorAll('.kb-math .l')].map(l => l.textContent).join(' | ')
    }));
  });
  ok('расчёт есть у каждого наблюдения без исключения',
    math.every(m => m.rows >= 2), math.map(m => m.rows));
  ok('в расчёте цены лида видно и деление, и предел, и источник',
    /9\s*300\s*000[^|]*÷[^|]*150[^|]*62\s*000/.test(math[3].body) &&
    /Воронка · август/.test(math[3].body), math[3].body);
  ok('в расчёте маржи видно вычитание и долю',
    /25\s*000\s*000[^|]*−[^|]*22\s*000\s*000[^|]*3\s*000\s*000/.test(math[1].body) &&
    /12%/.test(math[1].body), math[1].body);
  ok('в расчёте отдачи формата видно и охват, и объём, и деление',
    /Reels 140\s000 из 200\s000 = 70%/.test(math[4].body) &&
    /Reels 8 из 40 = 20%/.test(math[4].body) &&
    /70% ÷ 20% = 3,5×/.test(math[4].body), math[4].body);
  ok('в расчёте отчётности видно медиану по портфелю',
    /4 активным проектам[^|]*15 дней/.test(math[6].body), math[6].body);

  const toggle = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const card = c.querySelector('.kb-obs'), btn = card.querySelector('.acts .kb-act');
    const before = { label: btn.textContent, h: card.querySelector('.kb-math').getBoundingClientRect().height };
    const body = c.querySelector('.kb-body'); body.scrollTop = 40;
    const pre = body.scrollTop;
    btn.click();
    const after = { label: btn.textContent, h: card.querySelector('.kb-math').getBoundingClientRect().height,
      scroll: body.scrollTop, cards: c.querySelectorAll('.kb-obs').length };
    btn.click();
    return { before, after, pre, closed: card.querySelector('.kb-math').getBoundingClientRect().height };
  });
  ok('«Показать расчёт» раскрывает арифметику', toggle.after.h > 0 && toggle.before.h === 0, toggle);
  ok('кнопка меняет подпись на «Скрыть расчёт»', toggle.after.label === 'Скрыть расчёт', toggle.after.label);
  ok('раскрытие не перерисовывает страницу и не сбрасывает прокрутку',
    toggle.after.scroll === toggle.pre && toggle.after.cards === 8, toggle);
  ok('повторное нажатие закрывает расчёт', toggle.closed === 0, toggle.closed);

  console.log('[D] где горит — видно из списка проектов');
  const marks = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    return [...c.querySelectorAll('.kb-plist .kb-pi')].map(p => ({
      nm: p.querySelector('.nm').textContent,
      warn: (p.querySelector('.kb-warn') || {}).textContent || '',
      ct: (p.querySelector('.ct') || {}).textContent || '',
      logo: !!p.querySelector('.lg img')
    }));
  });
  ok('у открытого проекта четыре риска', (marks[0] || {}).warn === '▲4', marks[0]);
  ok('у Artel — один: договор кончается через 5 дней', (marks[1] || {}).warn === '▲1', marks[1]);
  ok('где рисков нет, треугольника тоже нет',
    marks.slice(2).every(m => m.warn === ''), marks.slice(2));
  ok('треугольник занимает место счётчика, а не встаёт рядом',
    marks[0].ct === '' && marks[2].ct !== '', marks.map(m => m.nm + ':' + m.ct));
  ok('логотип проекта берётся у проекта, а не у строки списка',
    marks.every(m => m.logo === (m.nm === 'APOLO COFFEE')), marks.map(m => m.nm + ':' + m.logo));

  console.log('[E] сравнение с портфелем считает по проектам, а не по строкам списка');
  const bench = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    return { bars: c.querySelectorAll('.kb-tile .kb-bm').length,
      pass: (c.querySelector('.kb-tile .kb-bm .cap') || {}).textContent || '',
      ids: _kbPortIds().join(','), mine: (_kbBench('pass') || {}).mine };
  });
  ok('портфель собран по id проектов', bench.ids === 'p1,p2,p3,p4', bench.ids);
  ok('своё значение в сравнении найдено', bench.mine === 25, bench.mine);
  ok('прогресс 25 при медиане 44 — четвёртое из четырёх',
    /медиана 44% · 4-е из 4/.test(bench.pass), bench.pass);
  ok('полосы сравнения появились на плитках', bench.bars >= 4, bench.bars);

  console.log('[F] правило молчит, когда данных нет');
  /* Level Studio: договор до day(200), отчёт 10 дней назад, маржа 60%,
     бриф заполнен. Придраться правилам не к чему — и они молчат. */
  const quiet = await page.evaluate(() => {
    const ts = n => new Date(Date.now() + n * 86400000).toISOString();
    KB_AUTO['p3'] = { _loaded: 1, _at: Date.now(), contract: null, services: [], members: [], lead: null,
      client: null, content: [], reports: [], tasks: [], stages: [], briefs: [], briefAt: ts(-30), calc: null };
    setKbProj('p3');
    const c = document.getElementById('content-ag');
    return { n: c.querySelectorAll('.kb-obs').length,
      none: !!c.querySelector('.kb-obs-none'),
      txt: (c.querySelector('.kb-obs-none') || {}).textContent || '' };
  });
  ok('у проекта без поводов не выдумано ни одного наблюдения', quiet.n === 0, quiet.n);
  ok('вместо пустоты — строка о том, на что правила смотрят',
    quiet.none && /договор/.test(quiet.txt) && /калькулятор/.test(quiet.txt), quiet.txt);

  /* У Artel в сводке пусто: договора в ней нет, услуг нет. Дату окончания
     знает только портфельный срез, а деньги — карточка проекта. Правило
     обязано собрать наблюдение из того и другого. */
  const halfdata = await page.evaluate(() => {
    const ts = n => new Date(Date.now() + n * 86400000).toISOString();
    KB_AUTO['p2'] = { _loaded: 1, _at: Date.now(), contract: null, services: [], members: [], lead: null,
      client: null, content: [], reports: [], tasks: [], stages: [], briefs: [], briefAt: ts(-10), calc: null };
    setKbProj('p2');
    const c = document.getElementById('content-ag');
    const cards = [...c.querySelectorAll('.kb-obs')];
    return { n: cards.length,
      kind: cards.length ? cards[0].className.replace(/^kb-obs /, '') : '',
      txt: cards.length ? cards[0].querySelector('.t').textContent : '',
      math: cards.length ? [...cards[0].querySelectorAll('.kb-math .l')].map(l => l.textContent).join(' | ') : '' };
  });
  ok('срок договора найден в портфельном срезе, хотя в сводке его нет',
    halfdata.n === 1 && halfdata.kind === 'risk' && /через 5 дней/.test(halfdata.txt), halfdata);
  ok('деньги под договором взяты из карточки проекта: 10 000 000 сум',
    /10\s000\s000 сум/.test(halfdata.txt) && /карточка проекта/.test(halfdata.math), halfdata.math);

  console.log('[G] завершённому проекту наблюдения не нужны');
  /* У DeTroyd договор кончился 40 дней назад — по правилам это риск.
     Но проект завершён: «договор закончился» у архива не событие, а его
     состояние по определению, и вся секция должна исчезнуть целиком. */
  const arch = await page.evaluate(() => {
    const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    KB_PORT.rows.p4.ctEnd = day(-40);
    const p4 = PROJECTS.find(x => x.id === 'p4');
    _KB_OBS_MEMO = {};                        // правила кешируются на отрисовку, а срез мы только что подменили
    const live = { risks: kbObsRisks(p4) };
    p4.status = 'done';
    KB_PROJECTS.find(x => x.key === 'p4').st = 'done';
    KB_AUTO['p4'] = { _loaded: 1, _at: Date.now(), contract: null, services: [], members: [], lead: null,
      client: null, content: [], reports: [], tasks: [], stages: [], briefs: [], briefAt: '', calc: null };
    setKbProj('p4');
    const c = document.getElementById('content-ag');
    return { live: live.risks,
      obs: c.querySelectorAll('.kb-obs').length,
      none: c.querySelectorAll('.kb-obs-none').length,
      heads: [...c.querySelectorAll('.kb-sub-h')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      archRows: c.querySelectorAll('.kb-arch-list .kb-pi').length,
      warn: c.querySelectorAll('.kb-arch-list .kb-warn').length,
      tiles: c.querySelectorAll('.kb-tile').length };
  });
  ok('пока проект активен, просроченный договор — риск', arch.live === 1, arch.live);
  ok('у завершённого проекта наблюдений нет', arch.obs === 0 && arch.none === 0, arch);
  ok('и самой секции «Что видно» тоже нет',
    !arch.heads.some(h => /Что видно/.test(h)), arch.heads);
  ok('витрина при этом на месте', arch.tiles === 10, arch.tiles);
  ok('завершённый проект действительно уехал в архив списка', arch.archRows === 1, arch);
  ok('треугольник у завершённого проекта не рисуется', arch.warn === 0, arch);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 4)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
