/* probe_guide — вкладка «Инструкция».
   Главная проверка здесь одна: в разделе объяснена каждая возможность
   калькулятора. Опись снимается со страницы, а не переписывается руками, —
   иначе она разойдётся с продуктом на первой же правке. И снимается во всех
   состояниях экрана: половина полей и блоков рисуется по условию и в
   состоянии по умолчанию просто отсутствует. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = html.slice(html.indexOf('Маркетинговый калькулятор ═'), html.indexOf('Почта сотрудника ═'));

/* Один нормализатор на весь тест: неразрывные пробелы, ёлочки, минусы и
   регистр не должны решать, засчитан термин или нет. */
const norm = s => String(s == null ? '' : s)
  .replace(/[   ]/g, ' ')
  .replace(/[«»"„“”]/g, '')
  .replace(/[−–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim().toLowerCase();
const stripMinus = s => norm(s).replace(/^-\s*/, '');

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  const frames = async (n = 4) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };

  await page.evaluate(() => {
    window.__me = { id: 'u1', full_name: 'd', role: 'agency_owner', agency_id: 'AG' };
    window.tMe = () => window.__me; window.toast = m => { window.__t = m; }; window.LIVE = false;
    document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
    document.getElementById('app-ag').classList.add('on');
    document.querySelectorAll('body > *').forEach(el => {
      if (el.id !== 'app-ag' && !/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)) el.style.display = 'none';
    });
  });

  console.log('\n[A] вкладка есть и стоит после «Методики»');
  const A = await page.evaluate(() => {
    MK.tab = 'guide';
    let err = null;
    try { renderCalc(); } catch (e) { err = String(e); }
    const tabs = [...document.querySelectorAll('.mk-tab')].map(x => x.textContent.trim());
    return { err, tabs, hasNav: !!document.getElementById('mkg-nav'), hasBody: !!document.getElementById('mkg-body'),
      items: document.querySelectorAll('.mkg-i').length, secs: document.querySelectorAll('.mkg-s').length,
      hasBar2: !!document.getElementById('mk-bar2') };
  });
  ok('раздел открывается без ошибок', A.err === null, A.err);
  ok('«Инструкция» — последняя вкладка, сразу за «Методикой»',
    A.tabs[A.tabs.length - 1] === 'Инструкция' && A.tabs[A.tabs.length - 2] === 'Методика', A.tabs);
  ok('есть оглавление и содержание', A.hasNav && A.hasBody, A);
  ok('каждому разделу соответствует пункт оглавления', A.items === A.secs && A.secs >= 20, A);
  ok('панели расчёта здесь нет — сохранять и печатать нечего', A.hasBar2 === false, A.hasBar2);

  /* ── Опись во всех состояниях экрана ──────────────────────────────────── */
  const INV = await page.evaluate(() => {
    const out = { fields: [], secs: [], blocks: [], tiles: [], rows: [], segs: [], quick: [], tabs: [], bar: [] };
    const add = (arr, v) => { v = (v || '').trim(); if (v && arr.indexOf(v) < 0) arr.push(v); };
    /* Имя поля — только первый текстовый узел .mk-fld-l: дальше идут единица
       измерения и подсказка, и они к описи не относятся. */
    const fldName = el => {
      const n = [...el.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('');
      return n.trim();
    };
    const grab = () => {
      document.querySelectorAll('.mk-side .mk-fld-l').forEach(x => add(out.fields, fldName(x)));
      document.querySelectorAll('.mk-ch-grid label > span, .mk-ch-conv label > span').forEach(x => add(out.fields, x.textContent));
      document.querySelectorAll('.mk-sec-h, .mk-grp-h').forEach(x => add(out.secs, (x.childNodes[0] || {}).textContent || ''));
      document.querySelectorAll('.mk-block-h').forEach(x => add(out.blocks, ((x.childNodes[0] || {}).textContent || '').split('·')[0]));
      document.querySelectorAll('.mk-tile-l').forEach(x => add(out.tiles, x.textContent));
      document.querySelectorAll('.mk-mrow-l').forEach(x => add(out.rows, x.textContent));
      document.querySelectorAll('.mk-side .mk-seg button, .mk-ch-buy .mk-seg button').forEach(x => add(out.segs, x.textContent));
    };
    const F = () => JSON.parse(JSON.stringify(MK_DEF.f));
    const base = () => Object.assign(F(), {
      mode: 'goal', goal: 100, days: 30, buy: 'lead', price: 50000,
      stages: [{ key: 'lead', name: 'Лиды' }, { key: 'sale', name: 'Продажи', cr: 25 }],
      aov: 500000, cogsMode: 'unit', unitCost: 300000, varPct: 5, vatPct: 12, vatIncluded: true,
      adVatPct: 12, agencyPct: 10, agencyFix: 400000, prodCost: 200000, fixed: 3000000, salesCost: 2000000,
    });
    /* Каждое состояние — отдельная отрисовка: поля и блоки условные. */
    const states = [
      f => f,
      f => Object.assign(f, { mode: 'budget', budget: 8000000 }),
      f => Object.assign(f, { mode: 'target', targetKind: 'roas', targetValue: 5, price: null }),
      f => Object.assign(f, { mode: 'target', targetKind: 'drr', targetValue: 15, price: null }),
      f => Object.assign(f, { mode: 'target', targetKind: 'cpa', targetValue: 80000, price: null }),
      f => Object.assign(f, { cogsMode: 'margin', marginPct: 40 }),
      f => Object.assign(f, { vatIncluded: false }),
      f => Object.assign(f, { taxMode: 'profit', profitTaxPct: 15 }),
      f => Object.assign(f, { taxMode: 'turnover', turnoverPct: 4 }),
      f => Object.assign(f, { audience: 500000, frequency: 3 }),
      f => Object.assign(f, { fact: { days: 10, spent: 7000000, buyQty: 120, orders: 28 } }),
      f => Object.assign(f, { payDelay: 30, instalPct: 40, instalMonths: 6, instalFeePct: 15 }),
      f => Object.assign(f, { redeemPct: 80, returnPct: 5, repeatPct: 20 }),
      f => Object.assign(f, { buy: 'impr', price: 20000, audience: 500000, frequency: 3,
        stages: [{ key: 'impr', name: 'Показы' }, { key: 'click', name: 'Клики', cr: 2 },
        { key: 'lead', name: 'Лиды', cr: 10 }, { key: 'sale', name: 'Продажи', cr: 25 }] }),
      f => Object.assign(f, { buy: 'click', price: 2000,
        stages: [{ key: 'impr', name: 'Показы' }, { key: 'click', name: 'Клики', cr: 2 },
        { key: 'lead', name: 'Лиды', cr: 10 }, { key: 'sale', name: 'Продажи', cr: 25 }] }),
    ];
    MK.tab = 'funnel';
    states.forEach(fn => { MK.f = fn(base()); renderCalc(); grab(); });
    /* Каналы: у каждой точки закупки свой набор полей конверсии. */
    MK.tab = 'media';
    ['impr', 'click', 'lead'].forEach(buy => {
      MK.m = { aov: 500000, marginPct: 40, varPct: 5,
        rows: [{ name: 'A', buy, budget: 10000000, price: 2000, cr1: 10, cr2: 20, cr3: 25 }] };
      renderCalc(); grab();
    });
    document.querySelectorAll('.mk-add').forEach(x => add(out.bar, x.textContent));
    MK.tab = 'unit';
    MK.u = { aov: 500000, purchases: 3, arpu: 500000, marginPct: 40, churnPct: 20, cac: 250000 };
    renderCalc(); grab();
    MK.tab = 'funnel'; MK.f = base(); renderCalc();
    document.querySelectorAll('.mk-bar2 .mk-b, .mk-bar2 .mk-b-p').forEach(x => add(out.bar, x.textContent));
    document.querySelectorAll('.mk-name').forEach(x => add(out.bar, x.placeholder));
    document.querySelectorAll('.mk-add').forEach(x => add(out.bar, x.textContent));
    out.quick = MK_QUICK.map(c => c.t);
    out.tabs = MK_TABS.map(t => t[1]);
    MK.tab = 'guide'; renderCalc();
    return out;
  });

  const TEXT = await page.evaluate(() => document.getElementById('mkg-body').textContent);
  const T = norm(TEXT);
  const has = s => T.indexOf(stripMinus(s)) >= 0;

  console.log('\n[B] полнота: объяснена каждая возможность калькулятора');
  console.log('    опись со страницы: полей ' + INV.fields.length + ', секций ' + INV.secs.length +
    ', блоков ' + INV.blocks.length + ', плиток ' + INV.tiles.length + ', строк ' + INV.rows.length +
    ', переключателей ' + INV.segs.length);
  const missing = (arr) => arr.filter(x => !has(x));
  const mF = missing(INV.fields), mS = missing(INV.secs), mB = missing(INV.blocks),
    mT = missing(INV.tiles), mR = missing(INV.rows), mG = missing(INV.segs),
    mQ = missing(INV.quick), mBar = missing(INV.bar), mTab = missing(INV.tabs.filter(x => x !== 'Инструкция'));
  ok('описано каждое поле ввода — все ' + INV.fields.length, mF.length === 0, mF);
  ok('названа каждая секция ввода — все ' + INV.secs.length, mS.length === 0, mS);
  ok('разобран каждый блок ответа — все ' + INV.blocks.length, mB.length === 0, mB);
  ok('объяснена каждая плитка — все ' + INV.tiles.length, mT.length === 0, mT);
  ok('объяснена каждая строка вывода — все ' + INV.rows.length, mR.length === 0, mR);
  ok('назван каждый переключатель — все ' + INV.segs.length, mG.length === 0, mG);
  ok('перечислены все шестнадцать быстрых расчётов', mQ.length === 0 && INV.quick.length === 16, mQ);
  ok('разобраны кнопки панели расчёта и добавления строк', mBar.length === 0, mBar);
  ok('названы все остальные вкладки калькулятора', mTab.length === 0, mTab);
  ok('упомянуты валюта, курс и знак этапа закупки',
    has('сум') && has('курс') && has('₮') && has('изменено'), '');

  console.log('\n[C] честность: оговорки на месте');
  ok('сказано, что «Каналы» считают по упрощённой модели и расходятся с воронкой',
    /упрощённ/i.test(TEXT) && has('прибыль считается на вкладке') || /упрощённ[\s\S]{0,600}воронк/i.test(TEXT), '');
  ok('сказано, что расходы на продажи уже внутри CAC и второй раз не вычитаются',
    /второй раз не вычитаются|уже сидят внутри самого cac/i.test(TEXT), '');
  ok('сказано, что прочерк у окупаемости — нехватка данных, а не приговор',
    /прочерк[\s\S]{0,400}не окупается|не окупается[\s\S]{0,400}прочерк/i.test(TEXT), '');
  ok('сказано, что пустая конверсия — это «нет данных», а не сто процентов',
    /пустое поле[\s\S]{0,200}нет данных|нет данных[\s\S]{0,200}не «всё прошло»/i.test(TEXT), '');
  ok('сказано, что расчёт линейный и удвоение бюджета не удваивает результат',
    /линейн/i.test(TEXT) && /удвоив бюджет|удвоения результата/i.test(TEXT), '');
  ok('предупреждение о замене несохранённого расчёта стоит рядом с первой кнопкой',
    /подстановка заменяет текущие цифры/i.test(TEXT), '');

  console.log('\n[D] числа в примерах сходятся с ядром');
  const D = await page.evaluate(() => {
    const f = MKC.funnel(MKG_BASE);
    const good = MKC.funnel({ ...MKG_BASE, price: 15000 });
    const tgt = MKC.funnel({ ...MKG_BASE, mode: 'target', targetKind: 'roas', targetValue: 5, price: null });
    const loss = MKC.funnel({ ...MKG_BASE, redeemPct: 80, returnPct: 5, repeatPct: 20 });
    const full = MKC.funnel(MKG_FULL);
    const media = MKC.media(MKG_MEDIA.rows, MKG_MEDIA);
    const ltvM = MKC.ltvMargin(MKG_UNIT.arpu, MKG_UNIT.marginPct, MKG_UNIT.churnPct);
    return {
      leads: _mkF(f.stages[0].n, 0), budget: _mkF(f.budget, 0), rev: _mkF(f.revenue, 0),
      net: _mkF(f.netProfit, 0), roas: _mkF(f.m.roas, 2), beRoas: _mkF(f.m.beRoas, 2),
      beCpl: _mkF(f.m.beCpl, 0), cac: _mkF(f.m.cac, 0), cpo: _mkF(f.m.cpo, 0),
      contribution: _mkF(f.contribution, 0), marketing: _mkF(f.marketing, 0),
      roasNet: _mkF(f.m.roasNet, 2), maxCacFull: _mkF(f.m.maxCacFull, 0),
      lossCac: _mkF(loss.m.cac, 0), tgtCpl: _mkF(tgt.m.cpl, 0), tgtNet: _mkF(tgt.netProfit, 0),
      goodNet: _mkF(good.netProfit, 0), impr: _mkF(full.stages[0].n, 0),
      mediaRoas: _mkF(media.total.roas, 2), mediaBe: _mkF(media.total.beRoas, 2),
      ltvM: _mkF(ltvM, 0), ltvS: _mkF(MKC.ltvSimple(MKG_UNIT.aov, MKG_UNIT.purchases), 0),
    };
  });
  const num = (name, v) => ok('«' + name + '» в тексте совпадает с ядром: ' + v, has(v), v);
  num('нужно лидов', D.leads);
  num('бюджет', D.budget);
  num('выручка без НДС', D.rev);
  num('чистая прибыль', D.net);
  num('ROAS в кабинете', D.roas);
  num('безубыточный ROAS', D.beRoas);
  num('предельная цена лида', D.beCpl);
  num('CAC', D.cac);
  num('маржинальный доход', D.contribution);
  num('предельный CAC с постоянными', D.maxCacFull);
  num('CAC при потерях и повторных', D.lossCac);
  num('цена лида при целевом ROAS 5×', D.tgtCpl);
  num('убыток при целевом ROAS 5×', D.tgtNet);
  num('показов в полной воронке', D.impr);
  num('сводный ROAS каналов', D.mediaRoas);
  num('порог по каналам', D.mediaBe);
  num('LTV с маржой', D.ltvM);
  num('LTV простой', D.ltvS);
  ok('пример остаётся в сумах и не зависит от переключателя валюты',
    await page.evaluate(() => { const before = document.getElementById('mkg-body').textContent;
      mkCur('usd'); const after = document.getElementById('mkg-body').textContent; mkCur('uzs');
      return before === after; }), '');

  console.log('\n[E] дизайн и раскладка');
  const E = await page.evaluate(() => {
    const body = document.getElementById('mkg-body'), nav = document.getElementById('mkg-nav');
    const secs = [...document.querySelectorAll('.mkg-s')];
    const p = document.querySelector('.mkg-p');
    const over = secs.filter(s => s.scrollWidth > s.clientWidth + 1).map(s => s.id);
    const clipped = [...document.querySelectorAll('.mkg-t td, .mkg-res dd, .mkg-note span')]
      .filter(x => x.scrollWidth > x.clientWidth + 1).length;
    return { bodyScroll: getComputedStyle(body).overflowY, navScroll: getComputedStyle(nav).overflowY,
      colW: p ? p.getBoundingClientRect().width : null, over, clipped,
      figs: document.querySelectorAll('.mkg-fig').length,
      svg: document.querySelectorAll('.mkg-svg').length,
      img: document.querySelectorAll('.mkg-body img').length,
      ext: [...document.querySelectorAll('.mkg-body [src], .mkg-body [href]')].length };
  });
  const gcss = css.slice(css.indexOf('── Инструкция ─'));
  const sizes = [...new Set((gcss.match(/font-size:([\d.]+)px/g) || []))];
  const radii = [...new Set((gcss.match(/border-radius:([\d.]+)px/g) || []))];
  ok('ни одного размера шрифта мимо шкалы токенов', sizes.length === 0, sizes);
  ok('ни одного радиуса мимо шкалы', radii.length === 0, radii);
  ok('оглавление и содержание прокручиваются каждый сам по себе',
    E.bodyScroll === 'auto' && E.navScroll === 'auto', E);
  ok('колонка текста не шире 74 символов', E.colW !== null && E.colW <= 700, E.colW);
  ok('ни один раздел не вылезает за свой контейнер', E.over.length === 0, E.over);
  ok('ничего не обрезано по ширине', E.clipped === 0, E.clipped);
  ok('демонстраций не меньше двенадцати', E.figs >= 12, E.figs);
  ok('схемы нарисованы SVG, растровых картинок нет', E.svg >= 2 && E.img === 0, E);
  ok('ни одного внешнего запроса из раздела', E.ext === 0, E.ext);

  console.log('\n[F] навигация: подсветка идёт за прокруткой');
  const N = await page.evaluate(() => {
    const b = document.getElementById('mkg-body');
    b.scrollTop = 0; return { first: document.querySelector('.mkg-i.on').dataset.k };
  });
  await frames(4);
  ok('наверху подсвечен первый пункт', N.first === 'start', N);
  await page.evaluate(() => mkgGo('cheat'));
  await page.waitForTimeout(500); await frames(6);
  const N2 = await page.evaluate(() => ({ k: document.querySelector('.mkg-i.on').dataset.k,
    top: Math.round(document.getElementById('mkg-cheat').getBoundingClientRect().top -
      document.getElementById('mkg-body').getBoundingClientRect().top) }));
  ok('клик по последнему пункту приводит к нему и подсветка остаётся на нём',
    N2.k === 'cheat' && Math.abs(N2.top) < 40, N2);
  await page.evaluate(() => { document.getElementById('mkg-body').scrollTo({ top: 0, behavior: 'auto' }); });
  await page.waitForTimeout(450); await frames(8);
  ok('прокрутка наверх возвращает подсветку на первый пункт',
    await page.evaluate(() => document.querySelector('.mkg-i.on').dataset.k) === 'start',
    await page.evaluate(() => document.querySelector('.mkg-i.on').dataset.k));
  const nav = await page.evaluate(() => {
    const n = document.getElementById('mkg-nav');
    const before = n.getBoundingClientRect().top;
    document.getElementById('mkg-body').scrollTop = 4000;
    return { before, after: n.getBoundingClientRect().top };
  });
  ok('оглавление не уезжает вместе с содержанием', nav.before === nav.after, nav);
  await page.evaluate(() => { document.getElementById('mkg-body').scrollTop = 0; });
  await frames(4);

  console.log('\n[G] движение и клавиатура');
  ok('раздел попадает под общий выключатель анимаций',
    /prefers-reduced-motion[\s\S]{0,300}\.mk-wrap \*/.test(css), '');
  ok('у раздела есть собственная анимация появления и рисования схем',
    /@keyframes mkgGrow/.test(css) && /@keyframes mkgDraw/.test(css), '');
  const K = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.mkg-i, .mkg-go, .mkg-find, .mkg-sl input')];
    return { n: els.length, noTabindexTrap: els.every(e => e.tabIndex >= 0),
      labelled: [...document.querySelectorAll('.mkg-sl input')].every(e => e.getAttribute('aria-label')),
      navRole: document.getElementById('mkg-nav').getAttribute('aria-label') };
  });
  ok('по всем управляющим элементам можно пройти табом', K.noTabindexTrap && K.n >= 20, K);
  ok('у ползунков есть подписи для чтения с экрана', K.labelled, K);
  ok('оглавление подписано как навигация', !!K.navRole, K.navRole);

  console.log('\n[H] живые демонстрации считают настоящим ядром');
  const H = await page.evaluate(() => {
    const read = id => document.getElementById(id).textContent;
    const out = {};
    mkgSet('cr', 25);
    const r = MKC.funnel({ ...MKG_FULL, buy: 'click', price: 1000,
      stages: [{ key: 'click', name: 'Клики' }, { key: 'lead', name: 'Лиды', cr: 25 }, { key: 'sale', name: 'Продажи', cr: 25 }] });
    out.funnel = read('mkg-w-funnel').indexOf(_mkF(r.budget, 0)) >= 0;
    mkgSet('cr', 10);
    mkgSet('cpl', 15000);
    const g = MKC.funnel({ ...MKG_BASE, price: 15000 });
    out.scale = read('mkg-w-scale').indexOf(_mkF(g.netProfit, 0)) >= 0;
    mkgSet('cpl', 50000);
    mkgSet('spread', 35);
    const sc = MKC.scenarios({ ...MKG_BASE, price: 15000 }, 35);
    out.scen = read('mkg-w-scen').indexOf(_mkF(sc.low.netProfit, 0)) >= 0;
    mkgSet('spread', 0);
    out.scenZero = /сценариев нет/i.test(read('mkg-w-scen'));
    mkgSet('spread', 20);
    mkgSet('vat', 20);
    const v = MKC.funnel({ ...MKG_BASE, vatPct: 20, vatIncluded: true });
    out.vat = read('mkg-w-vat').indexOf(_mkF(v.contribution, 0)) >= 0;
    mkgSet('vat', 12);
    mkgSet('churn', 40);
    const l = MKC.ltvMargin(MKG_UNIT.arpu, MKG_UNIT.marginPct, 40);
    out.cohort = read('mkg-w-cohort').indexOf(_mkF(l, 0)) >= 0;
    mkgSet('churn', 20);
    const all = read('mkg-w-cheat');
    mkgSet('find', 'отток');
    out.findWorks = read('mkg-w-cheat').length < all.length && /отток/i.test(read('mkg-w-cheat'));
    mkgSet('find', 'щщщ');
    out.findEmpty = /ничего не нашлось/i.test(read('mkg-w-cheat'));
    mkgSet('find', '');
    out.findBack = read('mkg-w-cheat').length === all.length;
    return out;
  });
  ok('воронка пересчитывается тем же ядром', H.funnel, H);
  ok('шкала порога пересчитывается тем же ядром', H.scale, H);
  ok('сценарии пересчитываются тем же ядром', H.scen, H);
  ok('при разбросе 0 % раздел честно говорит, что сценариев нет', H.scenZero, H);
  ok('демонстрация НДС пересчитывается тем же ядром', H.vat, H);
  ok('когорта LTV пересчитывается тем же ядром', H.cohort, H);
  ok('поиск по шпаргалке фильтрует, пустой результат объясняет, сброс возвращает всё',
    H.findWorks && H.findEmpty && H.findBack, H);

  console.log('\n[I] «подставить в калькулятор» действительно подставляет');
  const P = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.mkg-go')].map(x => x.getAttribute('onclick').match(/'([^']+)'/)[1]);
    const res = [];
    btns.forEach(k => {
      let err = null;
      try { mkgApply(k); } catch (e) { err = String(e); }
      res.push({ k, err, tab: MK.tab, ok: !err });
      MK.tab = 'guide'; renderCalc();
    });
    return { btns, res, bad: res.filter(x => !x.ok) };
  });
  ok('кнопок подстановки не меньше восьми', P.btns.length >= 8, P.btns);
  ok('каждая подстановка отрабатывает без ошибки', P.bad.length === 0, P.bad);
  const P2 = await page.evaluate(() => {
    mkgApply('base');
    const f = MK.f, r = MKC.funnel(f);
    const tab = MK.tab;
    MK.tab = 'guide'; renderCalc();
    return { tab, price: MKC.num(f.price), goal: MKC.num(f.goal), aov: MKC.num(f.aov),
      cur: MK.cur, net: r.netProfit, toast: window.__t || '' };
  });
  ok('подстановка открывает нужную вкладку и заполняет поля',
    P2.tab === 'funnel' && P2.price === 50000 && P2.goal === 100 && P2.aov === 500000, P2);
  ok('и калькулятор после неё считает', Math.abs(P2.net + 14375000) < 1, P2.net);
  ok('пользователь получает подтверждение', /подставлен/i.test(P2.toast), P2.toast);

  console.log('\n[J] узкий экран');
  await page.setViewportSize({ width: 900, height: 900 });
  await page.evaluate(() => renderCalc());
  await frames(4);
  const W = await page.evaluate(() => {
    const nav = document.getElementById('mkg-nav'), body = document.getElementById('mkg-body');
    const over = [...document.querySelectorAll('.mkg-s')].filter(s => s.scrollWidth > s.clientWidth + 1).map(s => s.id);
    return { navRow: getComputedStyle(nav).display === 'flex', over,
      bodyW: body.clientWidth, navBottom: Math.round(nav.getBoundingClientRect().bottom) };
  });
  ok('оглавление превращается в ленту над содержанием', W.navRow, W);
  ok('на узком экране ничего не вылезает', W.over.length === 0, W.over);
  await page.setViewportSize({ width: 1600, height: 1000 });

  console.log('\n[K] соседние вкладки не сдвинулись');
  const S = await page.evaluate(() => {
    const out = {};
    ['funnel', 'quick', 'media', 'unit', 'meth'].forEach(t => {
      MK.tab = t; let err = null;
      try { renderCalc(); } catch (e) { err = String(e); }
      out[t] = { err, w: document.querySelector('.mk-wrap') ? document.querySelector('.mk-wrap').clientWidth : null,
        grid: document.querySelector('.mk-grid') ? getComputedStyle(document.querySelector('.mk-grid')).gridTemplateColumns : null };
    });
    MK.tab = 'guide'; renderCalc();
    return out;
  });
  ok('все прежние вкладки открываются без ошибок',
    Object.keys(S).every(k => S[k].err === null), S);
  ok('раскладка воронки не изменилась', /^412px/.test(S.funnel.grid || ''), S.funnel.grid);

  const bad = errs.filter(x => /SyntaxError|is not defined|Cannot read|Cannot set/.test(x));
  console.log('\n[L] ошибки страницы');
  ok('нет ошибок исполнения', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
