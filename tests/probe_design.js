/* probe_design — дизайн-система калькулятора.
   Проверяет не «стало красивее», а выполнимые условия: шкалы, фокус,
   движение, иерархия, раскладка. И главное — что оформление не сдвинуло
   ни одной цифры (это отдельно и подробно проверяет probe_calc). */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const cssStart = html.indexOf('Маркетинговый калькулятор ═');
const css = html.slice(cssStart, html.indexOf('Почта сотрудника ═', cssStart));

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  /* В продукте из калькулятора оставлены «Быстрые расчёты»: остальные вкладки
     и строка расчёта выключены. Проверки на них не выкинуты — они охраняют
     то, что вернётся, как только вкладки включат обратно. */
  await page.evaluate(() => { if (window.MK_UI) { MK_UI.tabs = MK_TABS.map(t => t[0]); MK_UI.bar = true; } });

  console.log('\n[A] шкала, а не значения «на глаз»');
  const sizes = [...new Set((css.match(/font-size:([\d.]+)px/g) || []))];
  const radii = [...new Set((css.match(/border-radius:([\d.]+)px/g) || []))];
  const tSizes = [...new Set((css.match(/--t-[a-z]+:/g) || []))];
  const tRadii = [...new Set((css.match(/--r-[a-z]:/g) || []))];
  console.log('    токены: ' + tSizes.join(' ') + ' | ' + tRadii.join(' '));
  ok('размеров шрифта в шкале не больше шести', tSizes.length <= 6 && tSizes.length >= 4, tSizes);
  ok('радиусов не больше трёх', tRadii.length <= 3, tRadii);
  ok('в правилах не осталось размеров мимо шкалы', sizes.length === 0, sizes);
  ok('и радиусов мимо шкалы', radii.length === 0, radii);

  console.log('\n[B] клавиатура и движение');
  ok('кольцо фокуса задано и только для клавиатуры',
    /:focus-visible\{outline:2px solid var\(--accent\)/.test(css) && css.includes('.mk-wrap :focus{outline:none}'), '');
  ok('есть блок prefers-reduced-motion', /@media \(prefers-reduced-motion: reduce\)/.test(css), '');
  ok('и он глушит анимации и переходы',
    /prefers-reduced-motion[\s\S]{0,400}animation-duration:\.001ms!important[\s\S]{0,200}transition-duration:\.001ms!important/.test(css), '');
  const kf = (css.match(/@keyframes/g) || []).length;
  ok('анимации появились — их было ноль', kf >= 4, kf);
  const tr = (css.match(/transition:/g) || []).length;
  ok('переходов стало заметно больше восьми', tr >= 25, tr);

  const setup = async () => page.evaluate(async () => {
    document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
    document.getElementById('app-ag').classList.add('on');
    document.querySelectorAll('body > *').forEach(el => {
      if (el.id !== 'app-ag' && !/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)) el.style.display = 'none';
    });
    const st = document.createElement('style');
    st.textContent = '#content-ag>*{animation:none!important}.mk-fade>*{animation:none!important}';
    document.head.appendChild(st);
    window.toast = m => { window.__t = m; };
    MK.open = null; MK._prev = null;
    mkTab('funnel');
    await new Promise(r => setTimeout(r, 400));
  });
  await setup();

  console.log('\n[C] иерархия: решение видно, подробности по требованию');
  const C = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.mk-tile')];
    const hero = document.querySelector('.mk-tile.is-hero');
    const rest = tiles.filter(t => t !== hero);
    const fs = el => parseFloat(getComputedStyle(el.querySelector('.mk-tile-v')).fontSize);
    const out = document.getElementById('mk-out');
    const v = document.querySelector('.mk-verdict');
    const vTop = v ? v.getBoundingClientRect().top : null;
    const last = tiles[tiles.length - 1];
    return {
      heroLabel: hero ? hero.querySelector('.mk-tile-l').textContent : null,
      heroSize: hero ? fs(hero) : null, restSize: rest.length ? fs(rest[0]) : null,
      spread: !!document.querySelector('.mk-tile.is-hero .mk-spread-bar'),
      verdictBeforeBlocks: v && document.querySelector('.mk-block') ? vTop < document.querySelector('.mk-block').getBoundingClientRect().top : null,
      tilesFit: last ? last.getBoundingClientRect().bottom <= out.getBoundingClientRect().bottom : null,
      verdictFit: v ? vTop >= out.getBoundingClientRect().top && v.getBoundingClientRect().bottom <= out.getBoundingClientRect().bottom : null,
      openBlocks: [...document.querySelectorAll('.mk-block')].map(x => x.dataset.open),
      numFieldsOpen: document.querySelectorAll('.mk-grp[data-open="1"] input[inputmode="decimal"]').length,
      allFields: document.querySelectorAll('.mk-side input').length,
      grpsClosed: [...document.querySelectorAll('.mk-grp')].filter(g => g.dataset.open !== '1').length,
    };
  });
  console.log('    ' + JSON.stringify(C));
  ok('главная плитка — чистая прибыль', C.heroLabel === 'Чистая прибыль', C.heroLabel);
  ok('она заметно крупнее остальных', C.heroSize >= C.restSize * 1.5, [C.heroSize, C.restSize]);
  ok('вилка сценариев показана прямо на ней', C.spread === true, C.spread);
  ok('вердикт стоит выше разборов', C.verdictBeforeBlocks === true, C.verdictBeforeBlocks);
  ok('на экране 1440×900 вердикт и все плитки видны без прокрутки', C.verdictFit && C.tilesFit, C);
  ok('часть блоков разбора свёрнута — стены из семнадцати карточек больше нет',
    C.openBlocks.filter(x => x !== '1').length >= 4, C.openBlocks);
  ok('в открытых группах не больше восьми числовых полей — было сорок два',
    C.numFieldsOpen <= 8 && C.allFields > 20, { open: C.numFieldsOpen, всего: C.allFields });
  ok('остальные группы свёрнуты', C.grpsClosed >= 6, C.grpsClosed);

  console.log('\n[D] раскрытие живёт своей жизнью и переживает пересчёт');
  const D = await page.evaluate(async () => {
    const blk = [...document.querySelectorAll('.mk-block')].find(x => x.dataset.open !== '1');
    const id = blk.dataset.mkid;
    const btn = blk.querySelector('.mk-block-h');
    const sumBefore = (blk.querySelector('.mk-block-sum') || {}).textContent;
    btn.click(); await new Promise(r => setTimeout(r, 320));
    const opened = document.querySelector('[data-mkid="' + id + '"]').dataset.open;
    const aria = document.querySelector('[data-mkid="' + id + '"] .mk-block-h').getAttribute('aria-expanded');
    /* пересчёт */
    const f = [...document.querySelectorAll('.mk-side input[inputmode="decimal"]')][0];
    f.value = String((Number(f.value) || 100) + 1); f.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const afterPaint = document.querySelector('[data-mkid="' + id + '"]').dataset.open;
    mkTab('unit'); await new Promise(r => setTimeout(r, 200));
    mkTab('funnel'); await new Promise(r => setTimeout(r, 300));
    const afterTab = document.querySelector('[data-mkid="' + id + '"]').dataset.open;
    return { opened, aria, afterPaint, afterTab, sumBefore, hasSum: !!sumBefore && sumBefore.length > 3 };
  });
  console.log('    ' + JSON.stringify(D));
  ok('блок раскрывается по клику', D.opened === '1' && D.aria === 'true', D);
  ok('свёрнутая шапка показывает главную цифру блока', D.hasSum === true, D.sumBefore);
  ok('раскрытие переживает пересчёт', D.afterPaint === '1', D.afterPaint);
  ok('и переключение вкладок', D.afterTab === '1', D.afterTab);

  console.log('\n[E] воронка показывает, где сужается');
  const E = await page.evaluate(async () => {
    MK.f.stages = [{ key: 'impr', name: 'Показы' }, { key: 'click', name: 'Клики', cr: 2 },
    { key: 'lead', name: 'Лиды', cr: 10 }, { key: 'sale', name: 'Продажи', cr: 20 }];
    MK.f.buy = 'lead'; MK.f.price = 50000; MK.f.mode = 'goal'; MK.f.goal = 100;
    mkRender(); await new Promise(r => setTimeout(r, 350));
    const bars = [...document.querySelectorAll('.mk-fn-bar i')].map(i => i.style.getPropertyValue('--w'));
    const narrow = document.querySelectorAll('.mk-fn.is-narrow').length;
    const narrowIdx = [...document.querySelectorAll('.mk-fn')].findIndex(x => x.classList.contains('is-narrow'));
    return { bars, narrow, narrowIdx };
  });
  console.log('    ' + JSON.stringify(E));
  ok('полоса равна конверсии перехода, а не доле от первого этапа',
    E.bars[1] === '2%' && E.bars[2] === '10%' && E.bars[3] === '20%', E.bars);
  ok('первый этап — полная ширина', E.bars[0] === '100%', E.bars[0]);
  ok('самый узкий переход подсвечен ровно один и это переход в клики',
    E.narrow === 1 && E.narrowIdx === 1, E);

  console.log('\n[F] числа: столбцом и с обратной связью');
  const F = await page.evaluate(async () => {
    const num = getComputedStyle(document.querySelector('.mk-tile-v')).fontVariantNumeric;
    const row = document.querySelector('.mk-mrow-v');
    const rowNum = row ? getComputedStyle(row).fontVariantNumeric : null;
    const align = row ? getComputedStyle(row).textAlign : null;
    /* меняем чек вдвое — главная плитка обязана вспыхнуть */
    const f = [...document.querySelectorAll('.mk-side input[inputmode="decimal"]')].find(i => (i.getAttribute('oninput') || '').includes("'f.goal'"));
    f.value = '200'; f.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    const flashed = !!document.querySelector('.mk-tile.is-changed');
    await new Promise(r => setTimeout(r, 500));
    f.value = '100'; f.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    return { num, rowNum, align, flashed };
  });
  console.log('    ' + JSON.stringify(F));
  ok('цифры выстраиваются по разряду', /tabular-nums/.test(F.num) && /tabular-nums/.test(F.rowNum), F);
  ok('значения в таблицах прижаты вправо', F.align === 'right', F.align);
  ok('изменившееся число вспыхивает — иначе правку не заметить', F.flashed === true, F.flashed);

  console.log('\n[G] переключение вкладок');
  const G = await page.evaluate(async () => {
    const out = document.getElementById('mk-out');
    out.scrollTop = 200; await new Promise(r => setTimeout(r, 80));
    const before = out.scrollTop;
    const f = [...document.querySelectorAll('.mk-side input[inputmode="decimal"]')][0];
    f.value = String((Number(f.value) || 100) + 1); f.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    const afterPaint = document.getElementById('mk-out').scrollTop;
    const ind = document.querySelector('.mk-tabs-ind');
    const w1 = ind ? ind.style.width : null;
    mkTab('meth'); await new Promise(r => setTimeout(r, 320));
    const ind2 = document.querySelector('.mk-tabs-ind');
    const w2 = ind2 ? ind2.style.width : null;
    const fade = !!document.querySelector('.mk-fade');
    mkTab('funnel'); await new Promise(r => setTimeout(r, 300));
    return { before, afterPaint, w1, w2, fade, moved: w1 !== w2 };
  });
  console.log('    ' + JSON.stringify(G));
  ok('пересчёт не дёргает прокрутку', G.before === G.afterPaint, G);
  ok('индикатор вкладки едет за выбором', G.moved === true, [G.w1, G.w2]);
  ok('содержимое вкладки появляется каскадом, а не рывком', G.fade === true, G.fade);

  console.log('\n[H] печать');
  ok('светлая тема задана переменными, а не «покрасить всё»',
    /body\.mk-printing \.mk-wrap\{[\s\S]{0,80}--bg:#fff/.test(css) && !/body\.mk-printing \*\{color:#111/.test(css), '');
  ok('на бумагу уходит и свёрнутое', /mk-printing \.mk-block-b[\s\S]{0,60}grid-template-rows:1fr!important/.test(css), '');
  ok('блоки не рвутся между страницами', /break-inside:avoid/.test(css), '');

  console.log('\n[I] цифры не тронуты');
  const I = await page.evaluate(() => {
    const r = MKC.funnel({
      mode: 'goal', buy: 'click', price: 5000, goal: 100,
      stages: [{ key: 'impr', name: 'Показы' }, { key: 'click', name: 'Клики', cr: 2 },
      { key: 'lead', name: 'Лиды', cr: 10 }, { key: 'sale', name: 'Продажи', cr: 20 }],
      aov: 500000, cogsMode: 'unit', unitCost: 300000, varPct: 5, fixed: 2000000, salesCost: 3000000,
      vatPct: 0, vatIncluded: false, taxMode: 'none', redeemPct: 100, returnPct: 0, repeatPct: 0,
      adVatPct: 0, agencyPct: 0, agencyFix: 0, prodCost: 0, days: 30,
    });
    return { media: r.media, cm: r.contribution, net: r.netProfit, be: r.m.beRoas, cac: r.m.cac };
  });
  console.log('    ' + JSON.stringify(I));
  ok('контрольный расчёт совпадает до знака: 25 млн · 17,5 млн · −12,5 млн · 2,857× · 280 000',
    Math.abs(I.media - 25e6) < 1e-6 && Math.abs(I.cm - 17.5e6) < 1e-6 && Math.abs(I.net + 12.5e6) < 1e-6 &&
    Math.abs(I.be - 1 / 0.35) < 1e-9 && Math.abs(I.cac - 280000) < 1e-6, I);

  const bad = errs.filter(x => /SyntaxError|is not defined|Cannot read|Cannot set/.test(x));
  console.log('\n[J] ошибки страницы');
  ok('нет ошибок исполнения', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
