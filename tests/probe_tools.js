/* probe_tools — модуль «Инструменты»: карточка собрана по смыслу (кто это →
   что это → что с этим делать), действия живут в подвале и ничего не
   перекрывают, а «Калькулятор» переехал в «Ресурсы» под «Инструменты». */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const overlap = (a, b) => !(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1);

const setup = () => {
  window.toast = t => { window.__t = String(t); }; window.LIVE = false;
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.agIsOwner = () => true; window.agCanView = () => true; window.agCanEdit = () => true;
  TOOLS_DATA.length = 0;
  TOOLS_DATA.push({ cat: 'Аналитика', color: '#37E6C8', items: [
    { name: 'Анализ эффективности', url: 'https://dtr-analytics.vercel.app/dashboard', ty: 'Sheets', created_at: '2026-04-12T10:00:00Z' },
    { name: '324', url: '', ty: 'Miro' },
    { name: 'Доска без схемы', url: 'miro.com/app/board/z', ty: 'Miro' } ] });
  TOOLS_DATA.push({ cat: 'Рабочие доски', color: '#8A8FFF', items: [
    { name: 'Figma · дизайн-система', url: 'https://figma.com/file/y', ty: 'Figma' } ] });
  document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
  document.getElementById('app-ag').classList.add('on');
  renderTools();
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);

  console.log('\n[A] калькулятор переехал под инструменты');
  const nav = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#app-ag .nav .nav-i[data-m]')].map(e => e.dataset.m);
    const grp = [...document.querySelectorAll('#app-ag .nav .nav-group')].map(g => ({
      h: (g.querySelector('.nav-gh') || {}).textContent || '',
      keys: [...g.querySelectorAll('.nav-i[data-m]')].map(e => e.dataset.m) }));
    return { items, grp };
  });
  const res = nav.grp.find(g => /Ресурсы/i.test(g.h)) || { keys: [] };
  const ana = nav.grp.find(g => /Аналитика/i.test(g.h)) || { keys: [] };
  ok('калькулятор стоит сразу после инструментов',
    res.keys.indexOf('calc') === res.keys.indexOf('tools') + 1 && res.keys.indexOf('tools') >= 0, res.keys);
  ok('и больше не числится в аналитике', ana.keys.indexOf('calc') < 0, ana.keys);
  ok('пункт в списке ровно один', nav.items.filter(k => k === 'calc').length === 1, nav.items);

  await page.evaluate(setup);
  await page.waitForTimeout(500);

  console.log('\n[B] карточка инструмента');
  const card = await page.evaluate(() => {
    const c = document.querySelector('.tool-card');
    const g = q => c.querySelector(q);
    const cs = getComputedStyle(c);
    const art = g('.tc-art');
    return { cls: c.className, tab: c.getAttribute('tabindex'), role: c.getAttribute('role'),
      icSvg: !!g('.tc-ic svg'), icColor: g('.tc-ic') ? getComputedStyle(g('.tc-ic')).color : null,
      markColor: g('.tc-mark') ? getComputedStyle(g('.tc-mark')).color : null,
      badge: (g('.tc-badge') || {}).textContent, name: (g('.tc-name') || {}).textContent,
      url: (g('.tc-url span') || {}).textContent,
      open: (g('.tc-open') || {}).getAttribute('title'),
      acts: c.querySelectorAll('.tc-act').length,
      order: [...c.children].map(x => x.className),
      bar: !!g('.tc-bar'), ratio: art ? +(art.getBoundingClientRect().width / art.getBoundingClientRect().height).toFixed(2) : null,
      overflow: cs.overflow, nameColor: g('.tc-name') ? getComputedStyle(g('.tc-name')).color : null,
      topBorder: g('.tc-top') ? getComputedStyle(g('.tc-top')).borderBottomWidth : null };
  });
  ok('карточка собрана из двух частей: окно и подпись',
    card.order.join(' → ') === 'tc-shot → tc-foot', card.order);
  ok('у окна есть адресная строка', card.bar === true);
  ok('обложка держит 16:9 — под тот же размер, что просим при загрузке', Math.abs(card.ratio - 16 / 9) < 0.03, card.ratio);
  ok('знак сервиса нарисован, а не набран буквами', card.icSvg === true);
  ok('цвет типа стоит на знаке', card.icColor === 'rgb(67, 216, 140)', card.icColor);
  /* Браузер отдаёт color-mix как color(srgb …) — сравниваем каналами, а не строкой */
  ok('и на подложке вместо обложки', (function(){
    const m = String(card.markColor || '').match(/([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
    if (!m) return false;
    const ch = [+m[1], +m[2], +m[3]].map(v => v <= 1 ? Math.round(v * 255) : Math.round(v));
    return ch.join(',') === '67,216,140';
  })(), card.markColor);
  ok('название набрано нейтральным, а не цветом типа', card.nameColor === 'rgb(234, 236, 239)', card.nameColor);
  ok('в карточке видно тип, имя и адрес',
    /^Sheets/.test(card.badge) && /Анализ эффективности/.test(card.name) && /dtr-analytics\.vercel\.app/.test(card.url), card);
  ok('и когда добавили', /\d/.test(card.badge.split('·')[1] || ''), card.badge);
  ok('стрелка объясняет, что будет по клику', /Открыть/i.test(card.open || ''), card.open);
  ok('три действия: копировать, править, удалить', card.acts === 3, card.acts);
  ok('карточку видно с клавиатуры', card.tab === '0' && card.role === 'button', card);
  ok('чужая шапка карточки сотрудника сюда не прилетает', card.topBorder === null, card.topBorder);

  console.log('\n[C] действия никого не перекрывают');
  const geo = await page.evaluate(() => {
    const c = document.querySelector('.tool-card');
    const r = e => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
    return { badge: r(c.querySelector('.tc-badge')), acts: r(c.querySelector('.tc-acts')),
      name: r(c.querySelector('.tc-name')), foot: r(c.querySelector('.tc-foot')),
      shot: r(c.querySelector('.tc-shot')), bar: r(c.querySelector('.tc-bar')), card: r(c) };
  });
  ok('кнопки не наезжают на метку типа', !overlap(geo.acts, geo.badge), geo);
  ok('и не закрывают название', !overlap(geo.acts, geo.name), geo);
  ok('действия живут поверх обложки, а не в подписи', geo.acts.top >= geo.shot.top - 1 && geo.acts.bottom <= geo.shot.bottom + 1, geo);
  ok('и не закрывают адресную строку', !overlap(geo.acts, geo.bar), geo);
  ok('подпись прижата к низу карточки', Math.abs(geo.foot.bottom - geo.card.bottom) <= 2, geo);

  console.log('\n[D] карточка без ссылки честно об этом говорит');
  const nolink = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.tool-card')].find(x => x.dataset.nm === '324');
    return { cls: c.className, url: c.querySelector('.tc-url span').textContent,
      dim: c.querySelector('.tc-url').classList.contains('is-none'),
      open: c.querySelector('.tc-open').getAttribute('title'), acts: c.querySelectorAll('.tc-act').length,
      cursor: getComputedStyle(c).cursor };
  });
  ok('карточка помечена как «без ссылки»', /is-nolink/.test(nolink.cls), nolink.cls);
  ok('вместо прочерка — понятная строка', /ссылка не указана/.test(nolink.url) && nolink.dim, nolink);
  ok('стрелка не обещает открыть', /Нет ссылки/i.test(nolink.open), nolink.open);
  ok('копировать нечего — кнопки нет', nolink.acts === 2, nolink.acts);
  ok('и курсор не изображает ссылку', nolink.cursor === 'default', nolink.cursor);

  console.log('\n[E] клик, клавиатура и копирование');
  const act = await page.evaluate(async () => {
    const calls = { open: [], copy: [] };
    const oOpen = window.toolOpen, oCopy = window.kbCopy;
    window.toolOpen = (si, ii) => calls.open.push([si, ii]);
    window.kbCopy = (v) => calls.copy.push(v);
    const c = document.querySelector('.tool-card');
    c.focus();
    const focused = document.activeElement === c;
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const afterKey = calls.open.length;
    c.click();
    const afterClick = calls.open.length;
    c.querySelector('.tc-act').click();
    /* адрес без схемы должен уехать в буфер полным */
    const noScheme = [...document.querySelectorAll('.tool-card')].find(x => x.dataset.nm === 'Доска без схемы');
    noScheme.querySelector('.tc-act').click();
    const afterCopy = calls.open.length;
    window.toolOpen = oOpen; window.kbCopy = oCopy;
    return { focused, calls, afterKey, afterClick, afterCopy };
  });
  ok('карточка принимает фокус', act.focused, act);
  ok('Enter открывает инструмент', act.afterKey === 1 && act.calls.open[0][0] === 0 && act.calls.open[0][1] === 0, act);
  ok('клик по карточке — тоже', act.afterClick === 2, act);
  ok('кнопка копирования не открывает карточку', act.afterCopy === act.afterClick && act.calls.copy.length === 2, act);
  ok('копируется полный адрес', act.calls.copy[0] === 'https://dtr-analytics.vercel.app/dashboard', act.calls.copy);
  ok('адресу без схемы её подставляют', act.calls.copy[1] === 'https://miro.com/app/board/z', act.calls.copy);

  console.log('\n[F] сетка подстраивается под ширину');
  const grid = await page.evaluate(async () => {
    const g = document.querySelector('.tool-grid');
    const wide = getComputedStyle(g).gridTemplateColumns.split(' ').length;
    const host = document.getElementById('content-ag');
    host.style.maxWidth = '640px';
    await new Promise(r => setTimeout(r, 60));
    const narrow = getComputedStyle(g).gridTemplateColumns.split(' ').length;
    host.style.maxWidth = '';
    return { wide, narrow };
  });
  ok('на широком экране колонок больше', grid.wide >= 3, grid);
  ok('на узком — меньше, а не каша', grid.narrow < grid.wide && grid.narrow >= 1, grid);

  console.log('\n[G] категория держит свой цвет');
  const cat = await page.evaluate(() => {
    const c = document.querySelector('.tools-cat');
    return { v: c.style.getPropertyValue('--cc').trim(),
      ct: getComputedStyle(c.querySelector('.kb-cat-h .ct')).color,
      cards: c.querySelectorAll('.tool-card').length, add: c.querySelectorAll('.tool-add').length };
  });
  ok('цвет категории проброшен в разметку', cat.v === '#37E6C8', cat);
  ok('счётчик носит цвет категории', cat.ct === 'rgb(55, 230, 200)', cat.ct);
  ok('в категории карточки и плитка добавления', cat.cards === 3 && cat.add === 1, cat);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
