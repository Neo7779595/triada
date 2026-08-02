/* probe_ads — рекламные факты из выгрузки.
   Колонки в выгрузке Meta не стандартизованы: экспортируется тот набор,
   который включён в кабинете, и называется он по-разному в двух локалях.
   Поэтому проверяем не «парсер работает», а «настоящие заголовки всех
   площадок разбираются правильно», и отдельно — что в базу уходят числа,
   а не строки. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const near = (a, b, e) => a !== null && a !== undefined && Math.abs(a - b) < (e === undefined ? 1e-6 : e);

/* Заголовки взяты из настоящих выгрузок, а не выдуманы: две локали Meta,
   две Google и Яндекс. Если площадка переименует столбец — падает здесь,
   а не у пользователя на живых данных. */
const HEADS = {
  'Meta · английская': ['Reporting starts', 'Reporting ends', 'Campaign name', 'Ad set name', 'Amount spent (USD)',
    'Impressions', 'Reach', 'Frequency', 'Link clicks', 'CPC (cost per link click) (USD)',
    'CTR (link click-through rate)', 'Results', 'Cost per result', 'Purchases', 'Purchase conversion value'],
  'Meta · русская': ['Начало отчётного периода', 'Конец отчётного периода', 'Название кампании',
    'Название группы объявлений', 'Потраченная сумма (UZS)', 'Показы', 'Охват', 'Частота',
    'Клики на ссылку', 'Цена за клик (UZS)', 'CTR', 'Результаты', 'Цена за результат',
    'Покупки на сайте', 'Ценность конверсии покупки с сайта'],
  'Google Ads · русская': ['День', 'Кампания', 'Показы', 'Клики', 'Цена', 'Ср. цена за клик', 'CTR',
    'Конверсии', 'Цена/конв.', 'Ценность конверсии'],
  'Google Ads · английская': ['Day', 'Campaign', 'Impr.', 'Clicks', 'Cost', 'Avg. CPC', 'CTR',
    'Conversions', 'Cost / conv.', 'Conv. value'],
  'Яндекс.Директ': ['Дата', 'Кампания', 'Показы', 'Клики', 'CTR (%)', 'Расход всего (руб.)',
    'Ср. цена клика (руб.)', 'Конверсии (Цель)', 'Цена цели (руб.)'],
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  console.log('\n[A] числа приходят как угодно — читаются одинаково');
  const A = await page.evaluate(() => ({
    ru: adsNum('1 234,56'), en: adsNum('1,234.56'), cur: adsNum('12 800 UZS'),
    thousands: adsNum('1,234'), neg: adsNum('(1 234)'), dash: adsNum('—'), empty: adsNum(''),
    small: adsNum('0,05'), plain: adsNum(1234.5), pct: adsNum('6,00%'),
  }));
  ok('русский формат «1 234,56» и английский «1,234.56» дают одно число',
    near(A.ru, 1234.56) && near(A.en, 1234.56), A);
  ok('валюта в ячейке не мешает', near(A.cur, 12800), A.cur);
  ok('«1,234» — это тысяча двести тридцать четыре, а не 1,234', near(A.thousands, 1234), A.thousands);
  ok('скобки означают минус', near(A.neg, -1234), A.neg);
  ok('прочерк и пустое — это «нет данных», а не ноль', A.dash === null && A.empty === null, A);
  ok('дробь меньше единицы не теряется', near(A.small, 0.05), A.small);

  console.log('\n[B] даты во всех видах, включая серийный номер Excel');
  const B = await page.evaluate(() => ({
    iso: adsDate('2026-07-01'), dots: adsDate('01.07.2026'), slash: adsDate('01/07/2026'),
    ru: adsDate('1 июля 2026'), en: adsDate('Jul 1, 2026'), serial: adsDate(46204),
    junk: adsDate('итого'), empty: adsDate(''),
  }));
  ok('ISO, точки и слэши — одна и та же дата',
    B.iso === '2026-07-01' && B.dots === '2026-07-01' && B.slash === '2026-07-01', B);
  ok('словесный месяц читается на двух языках', B.ru === '2026-07-01' && B.en === '2026-07-01', B);
  ok('серийный номер Excel разворачивается в дату', B.serial === '2026-07-01', B.serial);
  ok('строка «итого» датой не притворяется', B.junk === null && B.empty === null, B);

  console.log('\n[C] заголовки настоящих выгрузок сопоставляются сами');
  const C = await page.evaluate((H) => {
    const out = {};
    Object.keys(H).forEach(k => {
      const m = adsGuessMap(H[k]);
      out[k] = {};
      Object.keys(m).forEach(f => { out[k][f] = H[k][m[f]]; });
    });
    return out;
  }, HEADS);
  Object.keys(HEADS).forEach(k => {
    const m = C[k];
    ok(k + ': найдены дата, расход и кампания',
      !!m.date && !!m.spend && !!m.entity, m);
    ok(k + ': расход не перепутан с ценой за результат',
      !!m.spend && !/цена за результат|цена за клик|cost per|цена\/конв|cost \/ conv|ср\. цена/i.test(m.spend), m.spend);
  });
  ok('Meta: клики берутся по ссылке, а не «все»', /Link clicks/.test(C['Meta · английская'].clicks || ''), C['Meta · английская'].clicks);
  ok('Google: «Цена» — это расход, «Цена/конв.» в импорт не идёт',
    C['Google Ads · русская'].spend === 'Цена', C['Google Ads · русская']);
  ok('Яндекс: «Расход всего» найден, «Цена цели» пропущена',
    /Расход всего/.test(C['Яндекс.Директ'].spend || ''), C['Яндекс.Директ']);
  ok('производные метрики не импортируются ни у кого',
    Object.keys(C).every(k => !Object.keys(C[k]).some(f => /^(cpm|cpc|ctr)$/i.test(String(C[k][f]).trim()))), C);

  console.log('\n[D] CSV из русского Excel: точка с запятой, BOM, запятые в дробях');
  const D = await page.evaluate(async () => {
    const t = await (await fetch('/tests/fixtures/meta_ru.csv')).text();
    const rows = adsParseCSV(t);
    const map = adsGuessMap(rows[0]);
    const b = adsBuild(rows, map);
    return { cols: rows[0].length, rows: rows.length, facts: b.facts.length, ent: b.entities,
      from: b.from, to: b.to, t: adsTotals(b.facts), bad: b.bad };
  });
  ok('разделитель «точка с запятой» распознан', D.cols === 12, D.cols);
  ok('пять строк данных стали пятью фактами', D.rows === 6 && D.facts === 5, D);
  ok('период и число кампаний посчитаны', D.from === '2026-07-01' && D.to === '2026-07-03' && D.ent === 2, D);
  ok('расход сложился до копейки: 5 390 000,50', near(D.t.spend, 5390000.5, 0.01), D.t.spend);
  ok('показы, клики, охват и результаты сложились',
    D.t.impressions === 493700 && D.t.clicks === 7345 && D.t.reach === 198400 && D.t.results === 155, D.t);
  ok('выручки в файле не было — и в фактах её нет, а не ноль', D.t.revenue === null, D.t.revenue);

  console.log('\n[E] XLSX читается без внешней библиотеки');
  const E = await page.evaluate(async () => {
    const buf = await (await fetch('/tests/fixtures/google_en.xlsx')).arrayBuffer();
    const rows = await adsParseXLSX(buf);
    const map = adsGuessMap(rows[0]);
    const b = adsBuild(rows, map);
    return { cols: rows[0].length, rows: rows.length, head: rows[0][0], facts: b.facts.length,
      t: adsTotals(b.facts), first: b.facts[0] };
  });
  ok('xlsx распакован и разобран', E.cols === 10 && E.rows === 5 && E.head === 'Day', E);
  ok('числа из xlsx пришли числами, а не строками',
    near(E.t.spend, 4660000) && E.t.impressions === 26150 && E.t.clicks === 1946, E.t);
  ok('выручка в этом файле есть — и она посчитана', near(E.t.revenue, 20000000), E.t.revenue);

  console.log('\n[F] один день одной кампании — одна строка');
  const F = await page.evaluate(() => {
    /* Выгрузка по объявлениям: на кампанию и день приходится несколько
       строк, а факт должен быть один — иначе повторная загрузка
       наплодит дублей и расход удвоится. */
    const rows = [
      ['Дата', 'Кампания', 'Расход', 'Показы', 'Клики'],
      ['01.07.2026', 'A', '100', '10', '1'],
      ['01.07.2026', 'A', '200', '20', '2'],
      ['01.07.2026', 'B', '300', '30', '3'],
      ['02.07.2026', 'A', '400', '40', '4'],
      ['', 'Итого', '1000', '100', '10'],
    ];
    const b = adsBuild(rows, adsGuessMap(rows[0]));
    const a1 = b.facts.find(f => f.entity_name === 'A' && f.date === '2026-07-01');
    return { n: b.facts.length, a1: a1 ? a1.spend : null, bad: b.bad, total: adsTotals(b.facts).spend };
  });
  ok('четыре строки по трём парам «кампания + день» дали три факта', F.n === 3, F);
  ok('строки одного дня сложились: 100 + 200 = 300', F.a1 === 300, F.a1);
  ok('итоговая строка без даты отброшена, а не удвоила расход',
    F.bad.noDate === 1 && F.total === 1000, F);

  console.log('\n[G] производные считаются, а не хранятся');
  const G = await page.evaluate(() => {
    const t = { spend: 1000000, impressions: 500000, clicks: 5000, reach: 200000, results: 50, revenue: 4000000 };
    const d = adsDerive(t);
    const empty = adsDerive({ spend: 1000, impressions: 0, clicks: 0, reach: null, results: null, revenue: null });
    return { d, empty };
  });
  ok('CPM, CPC, CTR, цена результата и ROAS выводятся из расхода и количеств',
    near(G.d.cpm, 2000) && near(G.d.cpc, 200) && near(G.d.ctr, 1) && near(G.d.cpr, 20000) && near(G.d.roas, 4), G.d);
  ok('частота — это показы на охват, а не отдельное число', near(G.d.freq, 2.5), G.d.freq);
  ok('деления на ноль дают прочерк, а не бесконечность',
    G.empty.cpm === null && G.empty.cpc === null && G.empty.cpr === null && G.empty.roas === null, G.empty);

  console.log('\n[H] экран');
  const H = await page.evaluate(async () => {
    window.toast = t => { window.__t = String(t) }; window.LIVE = false;
    window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
    window.ME = window.tMe(); window.TEAM = [];
    window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agIsPM = () => true;
    window.giEnsureStatus = async () => ({ status: 'inactive' });
    window.tLoadProjectWork = null; window.tLoadProjectToday = null;
    PROJECTS = [{ id: 'p1', name: 'Qushbegi', status: 'active', _stages: [], _tasks: [], _appr: [], _reports: [] }];
    window.PROJECTS = PROJECTS; openProject(0);
    let err = null;
    try { pdTab('ads'); } catch (e) { err = String(e); }
    const empty = !!document.querySelector('.ads-empty');
    const t = await (await fetch('/tests/fixtures/meta_ru.csv')).text();
    const rows = adsParseCSV(t), map = adsGuessMap(rows[0]), bd = adsBuild(rows, map);
    PROJECTS[0]._ads = {
      accounts: [{ id: 'a1', project_id: 'p1', provider: 'meta', name: 'Meta · Qushbegi', currency: 'сум', last_fact_at: bd.to }],
      facts: bd.facts.map(f => Object.assign({ account_id: 'a1', level: 'campaign' }, f)),
      imports: [{ file_name: 'meta_ru.csv', date_from: bd.from, date_to: bd.to, rows_written: bd.facts.length }],
    };
    ADS_ST.acc = 'a1'; ADS_ST.from = null; ADS_ST.to = null;
    renderPd();
    const tiles = [...document.querySelectorAll('.ads-tile')].map(x => ({
      l: x.querySelector('.ads-tile-l').textContent.trim(),
      v: x.querySelector('.ads-tile-v').textContent.trim(),
      over: Math.round(x.querySelector('.ads-tile-v').scrollWidth - x.querySelector('.ads-tile-v').clientWidth),
    }));
    const rowsN = document.querySelectorAll('.ads-block .ads-r').length;
    const chart = document.querySelectorAll('.ads-plot .ads-bar-i').length;
    return { err, empty, tiles, rowsN, chart,
      tabs: [...document.querySelectorAll('#pd-tabbar [data-k]')].map(x => x.dataset.k) };
  });
  ok('вкладка «Реклама» есть и стоит перед SMM-отчётом',
    H.tabs.indexOf('ads') > 0 && H.tabs.indexOf('ads') < H.tabs.indexOf('smm'), H.tabs);
  ok('без данных экран объясняет, что делать, а не показывает нули', H.empty === true, H.empty);
  ok('вкладка открывается без ошибок', H.err === null, H.err);
  ok('четыре плитки посчитаны из фактов', H.tiles.length === 4, H.tiles);
  ok('расход на плитке совпадает с суммой выгрузки',
    /5\s?390\s?001/.test((H.tiles[0] || {}).v || ''), (H.tiles[0] || {}).v);
  ok('цена результата посчитана, а не взята из файла',
    /34\s?774/.test((H.tiles[2] || {}).v || ''), (H.tiles[2] || {}).v);
  ok('ни одна крупная цифра не обрезана', H.tiles.every(t => t.over <= 1), H.tiles);
  ok('в таблице шапка, две кампании и итог', H.rowsN === 4, H.rowsN);
  ok('в графике по столбцу на каждый день', H.chart === 3, H.chart);

  console.log('\n[I] окно загрузки');
  const I = await page.evaluate(async () => {
    adsImportOpen();
    const t = await (await fetch('/tests/fixtures/meta_ru.csv')).text();
    ADS_IMP = { file: 'meta_ru.csv', rows: adsParseCSV(t), map: null };
    ADS_IMP.map = adsGuessMap(ADS_IMP.rows[0]);
    _adsImpStep();
    /* Приложение подменяет select своей кнопкой не сразу, а следующим
       кадром — ждём его, иначе меряем ещё не заменённую разметку. */
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sels = [...document.querySelectorAll('.ads-map-r .ads-in.ddx-btn')];
    const rect = sels.length ? sels[0].getBoundingClientRect() : null;
    const btn = document.querySelector('#ads-imp-f .btn-add');
    const before = btn ? btn.disabled : null;
    /* Снимаем обязательную колонку — кнопка обязана погаснуть. */
    adsMapSet('spend', '');
    const afterOff = document.querySelector('#ads-imp-f .btn-add').disabled;
    const bad = document.querySelectorAll('.ads-map-r.is-bad').length;
    adsMapSet('spend', String(ADS_IMP.rows[0].indexOf('Потраченная сумма (UZS)')));
    const afterOn = document.querySelector('#ads-imp-f .btn-add').disabled;
    return { n: sels.length, w: rect ? Math.round(rect.width) : 0, h: rect ? Math.round(rect.height) : 0,
      before, afterOff, afterOn, bad, txt: document.getElementById('ads-imp-b').textContent };
  });
  ok('сопоставление показано для всех восьми полей', I.n === 8, I.n);
  ok('списки видны и имеют размер — стилизована кнопка, а не скрытый select',
    I.w > 200 && I.h > 24, { w: I.w, h: I.h });
  ok('пока обе обязательные колонки на месте — кнопка активна', I.before === false, I.before);
  ok('снял обязательную колонку — кнопка погасла и строка помечена',
    I.afterOff === true && I.bad === 1, I);
  ok('вернул — снова можно грузить', I.afterOn === false, I.afterOn);
  ok('предпросмотр называет период и расход',
    /01\.07\.2026/.test(I.txt) && /5\s?390\s?001/.test(I.txt), I.txt.slice(0, 200));

  console.log('\n[J] что принесли на самом деле — решают байты, а не имя файла');
  const J = await page.evaluate(async () => {
    /* Проверяем настоящий путь загрузки: собираем File и отдаём его в
       adsFile — так же, как это делает перетаскивание в окно. */
    const put = async (bytes, name) => {
      adsImportOpen();
      await adsFile(new File([bytes], name));
      const box = document.getElementById('ads-imp-b');
      return { txt: box.textContent.trim(), maps: document.querySelectorAll('.ads-map-r').length,
        drop: !!document.querySelector('.ads-drop'), rows: ADS_IMP ? ADS_IMP.rows.length : 0 };
    };
    const bin = a => new Uint8Array(a);
    const utf8 = s => new TextEncoder().encode(s);
    /* windows-1251: так CSV сохраняет Excel в русской локали. */
    const cp1251 = s => new Uint8Array([...s].map(c => {
      const k = c.charCodeAt(0);
      if (k < 128) return k;
      if (k === 0x401) return 0xA8; if (k === 0x451) return 0xB8;
      if (k >= 0x410 && k <= 0x44F) return k - 0x410 + 0xC0;
      return 63;
    }));
    const utf16le = s => { const o = [0xFF, 0xFE];
      for (const c of s) { const k = c.charCodeAt(0); o.push(k & 255, k >> 8); } return new Uint8Array(o); };

    const pdf = await put(bin([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3]), 'отчёт.pdf');
    const png = await put(bin([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), 'screenshot.png');
    const xls = await put(bin([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0]), 'старый.xls');
    const junk = await put(bin([1, 2, 3, 0, 7, 9, 200, 0, 55, 4, 0, 8]), 'что-то.csv');
    const empty = await put(bin([]), 'пусто.csv');
    const only = await put(utf8('Дата;Кампания;Расход\n'), 'только-шапка.csv');

    /* xlsx, названный csv: имя врёт, подпись zip — нет. */
    const buf = await (await fetch('/tests/fixtures/google_en.xlsx')).arrayBuffer();
    const zip = await put(new Uint8Array(buf), 'выгрузка.csv');

    const win = await put(cp1251('Дата;Кампания;Расход\n01.07.2026;Лето;1000\n'), 'excel-ru.csv');
    const winHead = ADS_IMP ? String(ADS_IMP.rows[0][0]) : null;
    const winMap = ADS_IMP ? ADS_IMP.map : null;

    const u16 = await put(utf16le('Дата\tКампания\tРасход\n01.07.2026\tЛето\t1000\n'), 'google.csv');
    const u16Head = ADS_IMP ? String(ADS_IMP.rows[0][0]) : null;

    return { pdf, png, xls, junk, empty, only, zip, win, winHead, winMap, u16, u16Head };
  });
  ok('PDF не притворяется таблицей: разбор остановлен и сказано, где взять выгрузку',
    /PDF/.test(J.pdf.txt) && /CSV/.test(J.pdf.txt) && J.pdf.maps === 0 && J.pdf.drop === true, J.pdf);
  ok('со снимка экрана цифры не берутся — об этом написано прямо',
    /картинк/i.test(J.png.txt) && J.png.maps === 0, J.png);
  ok('старый .xls назван старым .xls, а не «не удалось прочитать»',
    /старый формат Excel/i.test(J.xls.txt) && J.xls.maps === 0, J.xls);
  ok('двоичный мусор с расширением .csv отклонён', /не похож/i.test(J.junk.txt) && J.junk.maps === 0, J.junk);
  ok('пустой файл назван пустым', /пуст/i.test(J.empty.txt), J.empty);
  ok('файл из одной шапки: сказано, что строк с данными нет',
    /только заголовок/i.test(J.only.txt) && J.only.maps === 0, J.only);
  ok('xlsx, переименованный в .csv, всё равно читается как xlsx',
    J.zip.maps === 8 && J.zip.rows === 5, J.zip);
  ok('CSV из русского Excel в windows-1251 читается без кракозябр',
    J.winHead === 'Дата' && J.winMap && J.winMap.date === 0 && J.winMap.spend === 2, { h: J.winHead, m: J.winMap });
  ok('CSV в UTF-16 от Google Ads читается, а не отбраковывается как двоичный',
    J.u16Head === 'Дата' && J.u16.maps === 8, { h: J.u16Head, m: J.u16.maps });

  console.log('\n[K] пропущенные строки: когда это норма, а когда беда');
  const K = await page.evaluate(async () => {
    const load = async text => {
      adsImportOpen();
      await adsFile(new File([new TextEncoder().encode(text)], 'x.csv'));
      const n = document.querySelector('.ads-note');
      const btn = document.querySelector('#ads-imp-f .btn-add');
      return { note: n ? n.textContent.trim() : null, bad: n ? n.classList.contains('is-bad') : null,
        off: btn ? btn.disabled : null,
        /* наверху окна или в предпросмотре внизу */
        top: !!document.querySelector('#ads-imp-b > .ads-note') };
    };
    const head = 'Дата;Кампания;Расход\n';
    const good = 'Дата;Кампания;Расход\n01.07.2026;A;100\n02.07.2026;A;200\n03.07.2026;A;300\n04.07.2026;A;400\n05.07.2026;A;500\n';
    return {
      none:  await load(good),
      tail:  await load(good + 'Итого;;1500\n'),
      half:  await load(head + '01.07.2026;A;100\n02.07.2026;A;200\nИтого;;300\nВсего за период;;300\n'),
      nodate: await load(head + 'Итого;A;100\nВсего;A;200\n'),
    };
  });
  ok('когда пропущенных нет — оговорки нет', K.none.note === null, K.none);
  ok('одна итоговая строка внизу отчёта — это норма, и так и написано',
    /итоговая строка/i.test(K.tail.note || '') && K.tail.bad === false && K.tail.off === false, K.tail);
  ok('пропущена половина файла — это уже повод проверить колонки',
    K.half.bad === true && /колонк/i.test(K.half.note || ''), K.half);
  ok('не разобралась ни одна строка — сказано про дату, а не «так и должно быть»',
    K.nodate.bad === true && /не нашлось даты/i.test(K.nodate.note || '')
    && !/так и должно быть/.test(K.nodate.note || '') && K.nodate.off === true, K.nodate);
  ok('когда грузить нечего — причина наверху окна, а не под прокруткой',
    K.nodate.top === true && K.half.top === false && K.tail.top === false,
    { nodate: K.nodate.top, half: K.half.top, tail: K.tail.top });

  const bad = errs.filter(x => /SyntaxError|is not defined|Cannot read|Cannot set/.test(x));
  console.log('\n[L] ошибки страницы');
  ok('нет ошибок исполнения', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
