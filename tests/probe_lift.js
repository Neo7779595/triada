/* probe_lift — объём вместо свечения: часы в сайдбаре и основная кнопка */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* тень считается «свечением», если её цвет не чёрный и не белый:
   премиальная глубина — это чёрная тень и белый блик, а не цветной ореол */
const TINTED = sh => (String(sh).match(/rgba?\([^)]*\)|color\([^)]*\)/g) || [])
  .filter(c => !/^rgba?\(\s*0,\s*0,\s*0/.test(c) && !/^rgba?\(\s*255,\s*255,\s*255/.test(c));

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'detroyd' };
    window.tMe = () => window.__me; window.toast = () => {};
    if (typeof enterAgency === 'function') enterAgency();
  });
  await page.waitForTimeout(700);

  const read = sel => page.evaluate(s => {
    const el = document.querySelector(s); if (!el) return null;
    const c = getComputedStyle(el);
    return { shadow: c.boxShadow, border: c.borderTopColor, transform: c.transform, bg: c.backgroundImage || c.backgroundColor };
  }, sel);
  const alpha = col => {
    const m = String(col).match(/\/\s*([\d.]+)\s*\)/) || String(col).match(/rgba\([^)]*,\s*([\d.]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  };

  console.log('\n[A] карточка часов');
  const c0 = await read('.clockw');
  ok('карточка на месте', !!c0);
  ok('в покое не светится', TINTED(c0.shadow).length === 0, c0.shadow);
  await page.hover('.clockw'); await page.waitForTimeout(400);
  const c1 = await read('.clockw');
  ok('при наведении тоже не светится', TINTED(c1.shadow).length === 0, c1.shadow);
  ok('тень при наведении чёрная и глубокая', /rgba\(0, 0, 0/.test(c1.shadow) && /px/.test(c1.shadow), c1.shadow);
  ok('есть волосяной блик по верхней кромке', /inset/.test(c1.shadow) && /255, 255, 255/.test(c1.shadow), c1.shadow);
  ok('карточка не подпрыгивает', c1.transform === 'none' || c1.transform === 'matrix(1, 0, 0, 1, 0, 0)', c1.transform);
  ok('наведение заметно: рамка светлеет', alpha(c1.border) > alpha(c0.border) + .05, { покой: alpha(c0.border), навёл: alpha(c1.border) });
  ok('и подложка чуть светлеет', c1.bg !== c0.bg);
  ok('полоса года без ореола', await page.evaluate(() => {
    const i = document.querySelector('.clockw-bar i');
    return !i || getComputedStyle(i).boxShadow === 'none';
  }), await page.evaluate(() => { const i = document.querySelector('.clockw-bar i'); return i ? getComputedStyle(i).boxShadow : null; }));

  console.log('\n[B] основная кнопка');
  await page.hover('.ph h1, .content').catch(() => {});
  await page.waitForTimeout(300);
  const b0 = await read('.side-new-proj');
  ok('кнопка на месте', !!b0);
  ok('в покое не светится', TINTED(b0.shadow).length === 0, b0.shadow);
  await page.hover('.side-new-proj'); await page.waitForTimeout(400);
  const b1 = await read('.side-new-proj');
  ok('при наведении не светится', TINTED(b1.shadow).length === 0, b1.shadow);
  ok('тень чёрная', /rgba\(0, 0, 0/.test(b1.shadow), b1.shadow);
  ok('кнопка не подпрыгивает', b1.transform === 'none' || b1.transform === 'matrix(1, 0, 0, 1, 0, 0)', b1.transform);
  ok('наведение всё же читается — тень глубже', b1.shadow !== b0.shadow, { покой: b0.shadow, навёл: b1.shadow });

  console.log('\n[B2] цвет въезжает слева');
  const parts = await page.evaluate(() => {
    const b = document.querySelector('.side-new-proj');
    const d = b.querySelector('.sw-decor'), i = b.querySelector('.sw-ic'), t = b.querySelector('.sw-tx');
    if (!d || !i || !t) return null;
    const cd = getComputedStyle(d), ci = getComputedStyle(i), ct = getComputedStyle(t);
    return { decor: cd.transform, icBg: ci.backgroundColor, txColor: ct.color, txt: t.textContent.trim(),
      w: b.getBoundingClientRect().width };
  });
  ok('все три части на месте', !!parts && parts.txt === 'Новый проект', parts);
  const accent = await page.evaluate(() => {
    const p = document.createElement('i'); p.style.color = 'var(--accent)'; document.body.appendChild(p);
    const c = getComputedStyle(p).color; p.remove(); return c;
  });
  ok('квадрат с плюсом — акцентный', parts.icBg === accent, { квадрат: parts.icBg, акцент: accent });
  /* Утверждение про «встала на место», а не про «ровно ноль»: переход по
     transform затухает плавно, и в момент замера остаётся хвост в сотые доли
     пикселя. Требовать точного нуля значит проверять точность таймера, а не
     поведение кнопки — тест падал через раз на −0,01 пикселя. */
  const decorX = (m => { const n = /matrix\(([^)]*)\)/.exec(m); return n ? Math.abs(parseFloat(n[1].split(',')[4])) : 0; })(parts.decor);
  ok('при наведении заливка встала на место', parts.decor === 'none' || decorX < 0.5, parts.decor);
  ok('подпись перевернулась в тёмную', parts.txColor !== (await page.evaluate(() => {
    const p = document.createElement('i'); p.style.color = 'var(--txt)'; document.body.appendChild(p);
    const c = getComputedStyle(p).color; p.remove(); return c;
  })), parts.txColor);
  await page.hover('.clockw'); await page.waitForTimeout(600);
  const off = await page.evaluate(() => {
    const b = document.querySelector('.side-new-proj');
    return { decor: getComputedStyle(b.querySelector('.sw-decor')).transform, w: b.getBoundingClientRect().width };
  });
  const dx = parseFloat((String(off.decor).match(/matrix\([^)]*?,\s*([-\d.]+),\s*[-\d.]+\)$/) || [])[1] || '0');
  ok('без наведения заливка убрана за левый край', dx <= -(off.w - 2), { сдвиг: dx, ширина: off.w });

  console.log('\n[C] нигде не осталось мятного ореола');
  const left = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.clockw,.btn-add,.btn-primary').forEach(el => {
      const sh = getComputedStyle(el).boxShadow;
      if (/55, 230, 200|0\.215686 0\.901961/.test(sh)) out.push({ cls: String(el.className).slice(0, 30), sh });
    });
    return out;
  });
  ok('ни у одной кнопки и карточки нет акцентной тени', left.length === 0, left.slice(0, 3));

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read|TypeError/.test(e));
  console.log('\n[D] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
