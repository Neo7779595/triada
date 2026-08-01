/* probe_mkc — калькулятор: цифры не округляются до вранья, а шапка стоит
   в одну линию. 300 ÷ 999 — это 0,30 $, а не «0 $»; кнопка выбора проекта
   больше не уезжает вверх из-за чужого класса. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
/* toLocaleString('ru-RU') разделяет тысячи узким неразрывным пробелом —
   глазом он неотличим от обычного, а сравнение строк на нём спотыкается. */
const sp = s => String(s == null ? '' : s).replace(/[\u00A0\u202F\u2009]/g, ' ');

const setup = () => {
  window.toast = () => {}; window.LIVE = false;
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.agIsOwner = () => true;
  window.agVisibleProjects = () => [{ id: 'p1', name: 'APOLO COFFEE' }, { id: 'p2', name: 'Qushbegi' }];
  PROJECTS = [{ id: 'p1', name: 'APOLO COFFEE', _tasks: [], _stages: [] }];
  window.PROJECTS = PROJECTS;
  document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
  document.getElementById('app-ag').classList.add('on');
  renderCalc();
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(setup);
  await page.waitForTimeout(700);
  await page.evaluate(() => { MK.cur = 'usd'; MK.rate = 12800; if (typeof mkTab === 'function') mkTab('quick'); });
  await page.waitForTimeout(500);

  console.log('\n[A] сколько знаков после запятой имеет смысл');
  const dec = await page.evaluate(() => ({
    round: _mkAutoDec(300), cents: _mkAutoDec(0.3003), tiny: _mkAutoDec(0.003125),
    micro: _mkAutoDec(0.0000034), big: _mkAutoDec(12800000), bigFrac: _mkAutoDec(1234.56),
    zero: _mkAutoDec(0), nul: _mkAutoDec(null), half: _mkAutoDec(2.5),
  }));
  ok('у ровного числа хвоста нет', dec.round === 0, dec);
  ok('у половины — один знак, а не два', dec.half === 1, dec);
  ok('копейки показываются', dec.cents === 2, dec);
  ok('мелочь не схлопывается в ноль', dec.tiny === 4 && dec.micro === 6, dec);
  ok('у крупной суммы копейки не мешаются', dec.big === 0 && dec.bigFrac === 2, dec);
  ok('ноль остаётся нулём', dec.zero === 0 && dec.nul === 0, dec);

  console.log('\n[B] деньги, проценты и разы');
  const fmt = await page.evaluate(() => ({
    cac: _mkMoney(300 / 999), round: _mkMoney(250), big: _mkMoney(12800000), frac: _mkMoney(1234.56),
    cpc: _mkMoney(12.5 / 4000), pctRound: _mkPct(50), pctFrac: _mkPct(33.4), pctTiny: _mkPct(0.0034),
    x: _mkX(1234.56 / 400), xRound: _mkX(3), dash: _mkMoney(null),
  }));
  ok('300 ÷ 999 = 0,30 $, а не «0 $»', sp(fmt.cac) === '0,30 $', fmt.cac);
  ok('ровная сумма — без «,00»', sp(fmt.round) === '250 $', fmt.round);
  ok('миллионы — без копеек', sp(fmt.big) === '12 800 000 $', fmt.big);
  ok('дробная сумма — с копейками', sp(fmt.frac) === '1 234,56 $', fmt.frac);
  ok('копеечный CPC виден целиком', sp(fmt.cpc) === '0,0031 $', fmt.cpc);
  ok('ровный процент без хвоста, дробный — с хвостом', sp(fmt.pctRound) === '50 %' && sp(fmt.pctFrac) === '33,4 %', fmt);
  ok('микропроцент не превращается в 0 %', sp(fmt.pctTiny) === '0,0034 %', fmt.pctTiny);
  ok('разы — минимум два знака', sp(fmt.x) === '3,09×' && sp(fmt.xRound) === '3,00×', fmt);
  ok('без данных остаётся прочерк', fmt.dash === '—', fmt.dash);

  console.log('\n[C] карточки быстрых расчётов считают то же, что видно');
  const cards = await page.evaluate(() => {
    MK.q = { cac: { mk: 200, sc: 100, cl: 999 }, cpc: { sp: 12.5, cl: 4000 }, ctr: { cl: 34, im: 1000000 },
      roas: { rev: 1234.56, sp: 400 }, cpl: { sp: 100, ld: 3 }, aov: { rev: 1000, or: 4 },
      margin: { rev: 1000, cg: 666 }, cpm: { sp: 3, im: 900000 } };
    Object.keys(MK.q).forEach(id => mkQPaint(id));
    const val = id => { const c = document.querySelector('.mk-qc[data-id="' + id + '"]'); return c ? c.querySelector('.mk-qc-v').textContent : null; };
    return { cac: val('cac'), cpc: val('cpc'), ctr: val('ctr'), roas: val('roas'),
      cpl: val('cpl'), aov: val('aov'), margin: val('margin'), cpm: val('cpm') };
  });
  ok('CAC — 0,30 $', sp(cards.cac) === '0,30 $', cards);
  ok('CPC — 0,0031 $', sp(cards.cpc) === '0,0031 $', cards);
  ok('CTR — 0,0034 %', sp(cards.ctr) === '0,0034 %', cards);
  ok('CPM — 0,0033 $', sp(cards.cpm) === '0,0033 $', cards);
  ok('ROAS — 3,09×', sp(cards.roas) === '3,09×', cards);
  ok('CPL — 33,33 $', sp(cards.cpl) === '33,33 $', cards);
  ok('средний чек ровный — 250 $', sp(cards.aov) === '250 $', cards);
  ok('маржинальность — 33,4 %', sp(cards.margin) === '33,4 %', cards);

  console.log('\n[D] пересчёт во вторую валюту тоже честный');
  const alt = await page.evaluate(() => ({ small: _mkAlt(0.3), round: _mkAlt(100), sum: (function () { MK.cur = 'sum'; const s = _mkAlt(12800); MK.cur = 'usd'; return s; })() }));
  ok('0,3 $ — это 3 840 сум, а не «0 сум»', sp(alt.small) === '3 840 сум', alt.small);
  ok('ровная сумма пересчитывается ровно', sp(alt.round) === '1 280 000 сум', alt.round);
  ok('обратный пересчёт показывает доллар', sp(alt.sum) === '≈ 1 $', alt.sum);

  console.log('\n[E] шапка расчёта стоит в одну линию');
  const bar = await page.evaluate(() => {
    const b = document.getElementById('mk-bar2');
    const items = [];
    [...b.children].forEach(c => {
      if (c.classList.contains('mk-b-sp')) return;
      const el = c.classList.contains('mk-sel') ? c.querySelector('.ddx-btn') : c;
      const r = el.getBoundingClientRect();
      items.push({ cls: String(el.className).slice(0, 20), top: Math.round(r.top), h: Math.round(r.height),
        mb: getComputedStyle(el).marginBottom, disp: getComputedStyle(el).display });
    });
    const btn = b.querySelector('.mk-sel .ddx-btn');
    return { items, tops: [...new Set(items.map(i => i.top))], hs: [...new Set(items.map(i => i.h))],
      isPh: btn.classList.contains('is-ph'), matchesPageHead: btn.matches('.ph'),
      lbl: btn.querySelector('.ddx-lbl').textContent.trim(),
      lblColor: getComputedStyle(btn.querySelector('.ddx-lbl')).color };
  });
  ok('все элементы шапки на одной линии', bar.tops.length === 1, bar.items);
  ok('и одной высоты', bar.hs.length === 1 && bar.hs[0] === 36, bar.items);
  ok('у кнопки выбора проекта нет чужого нижнего отступа',
    bar.items.every(i => i.mb === '0px'), bar.items.map(i => i.cls + ':' + i.mb));
  ok('пустой выбор помечен своим классом', bar.isPh, bar);
  ok('и этот класс больше не совпадает с шапкой страницы', !bar.matchesPageHead, bar);
  ok('подпись «Без проекта» приглушена', bar.lbl === 'Без проекта' && bar.lblColor === 'rgb(122, 130, 141)', bar);

  console.log('\n[F] выбор проекта работает');
  /* Смена значения перерисовывает всю шапку, и кнопку списка платформа
     строит заново — ждём, иначе меряем то, чего уже нет в документе. */
  await page.evaluate(() => {
    const sel = document.querySelector('#mk-bar2 select.mk-proj');
    sel.value = 'p1'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const pick = await page.evaluate(() => {
    const btn = document.querySelector('#mk-bar2 .mk-sel .ddx-btn');
    return { id: MK.projectId, lbl: btn ? btn.querySelector('.ddx-lbl').textContent.trim() : null,
      isPh: btn ? btn.classList.contains('is-ph') : null,
      top: btn ? Math.round(btn.getBoundingClientRect().top) : null,
      barTop: Math.round(document.querySelector('#mk-bar2 .mk-b').getBoundingClientRect().top) };
  });
  ok('выбранный проект попадает в расчёт', pick.id === 'p1', pick);
  ok('и на кнопке видно его имя', pick.lbl === 'APOLO COFFEE', pick);
  ok('метка пустого выбора снята', pick.isPh === false, pick);
  ok('кнопка осталась на своей линии', pick.top === pick.barTop, pick);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
