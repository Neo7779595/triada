/* probe_mail — почта внутри платформы.
   Ящики раньше стояли колонкой слева: 230 пикселей на семь слов, которые не
   меняются, и на них же уходило место у списка и у чтения. Проверяем то,
   ради чего каркас переделан: ящики — строкой сверху и того же вида, что
   вкладки проекта; ширину делят список и письмо; действия над ящиком стоят
   рядом с самим ящиком, а не среди мест, куда можно перейти. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const seed = () => {
  const now = Date.now();
  const mk = (i, from, subj, snip, unread, star) => ({
    id: 'm' + i, threadId: 't' + i, from, to: 'me@x.ru', subject: subj, snippet: snip,
    date: new Date(now - i * 3600000 * 9).toISOString(), unread: !!unread, starred: !!star, body: '<p>' + snip + '</p>',
  });
  ML.booted = true; ML.connected = true; ML.account = 'nurislamkholmirzayev@gmail.com';
  ML.box = 'inbox'; ML.unread = 128; ML.loading = false; ML.error = ''; ML.q = '';
  ML.threadId = null; ML.thread = null; ML.next = null; ML.busy = '';
  ML.items = [
    mk(1, 'Miro <no-reply@miro.com>', 'Quick-start with sample apps', 'Build your first app fast', 1),
    mk(2, 'Google <no-reply@accounts.google.com>', 'Оповещение системы безопасности', 'У приложения есть доступ', 0),
    mk(3, 'Vercel <n@vercel.com>', 'Weekly Usage Summary', 'Weekly Usage Summary', 0),
    mk(4, 'Dreamstime <blog@dreamstime.com>', 'Emotionally creative work', 'See our stories', 0, 1),
    mk(5, 'Abdurauf Parpiyev <ap@gmail.com>', 'Запрос доступа к файлу', 'Предоставить доступ?', 1),
  ];
  renderMail();
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
    document.getElementById('app-ag').classList.add('on');
    document.querySelectorAll('body > *').forEach(el => {
      if (el.id !== 'app-ag' && !/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)) el.style.display = 'none';
    });
    window.LIVE = false; window.toast = t => { window.__toast = String(t); };
    window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
    window.ME = window.tMe();
    /* mlLoad ходит в сеть и сам перерисовывает экран — подменяем только
       поход, отрисовку оставляем настоящую. */
    window.__loads = 0;
    window.mlBoot = () => {}; window.mlLoad = () => { window.__loads++; renderMail(); };
  });
  await page.evaluate(seed);
  await page.waitForTimeout(350);

  console.log('\n[A] ящики стоят строкой сверху, а не колонкой сбоку');
  const A = await page.evaluate(() => {
    const tabs = document.querySelector('.ml-tabs');
    const boxes = [...document.querySelectorAll('.ml-tabs .ml-box')];
    const r0 = boxes[0].getBoundingClientRect();
    return { rail: !!document.querySelector('.ml-rail'), tabs: !!tabs,
      n: boxes.length, keys: boxes.map(x => x.dataset.box),
      oneRow: boxes.every(x => Math.round(x.getBoundingClientRect().top) === Math.round(r0.top)),
      belowBar: tabs.getBoundingClientRect().top >= document.querySelector('.ml-bar').getBoundingClientRect().bottom - 1 };
  });
  ok('колонки ящиков слева больше нет', A.rail === false, A);
  ok('все семь ящиков — в одной строке над списком',
    A.n === 7 && A.oneRow === true && A.belowBar === true, A);
  ok('порядок ящиков прежний',
    A.keys.join(',') === 'inbox,unread,starred,sent,drafts,all,trash', A.keys);

  console.log('\n[B] вид — тот же, что у вкладок проекта');
  const B = await page.evaluate(() => {
    const pick = x => { const c = getComputedStyle(x);
      return { fs: c.fontSize, fw: c.fontWeight, tt: c.textTransform, col: c.color,
        bg: c.backgroundColor, bb: c.borderBottomWidth, bbc: c.borderBottomColor, br: c.borderRadius }; };
    const boxes = [...document.querySelectorAll('.ml-tabs .ml-box')];
    const on = boxes.find(x => x.classList.contains('on'));
    const off = boxes.find(x => !x.classList.contains('on'));
    const cnt = document.querySelector('.ml-tabs .ml-cnt');
    return { on: pick(on), off: pick(off), onKey: on.dataset.box,
      cnt: cnt ? { t: cnt.textContent.trim(), bg: getComputedStyle(cnt).backgroundColor } : null,
      icons: document.querySelectorAll('.ml-tabs .ml-box > svg').length,
      iconsShown: [...document.querySelectorAll('.ml-tabs .ml-box > svg')].filter(s => getComputedStyle(s).display !== 'none').length };
  });
  ok('ящики набраны прописными, одного кегля и веса',
    B.off.fs === '13px' && B.off.fw === '600' && B.off.tt === 'uppercase', B.off);
  ok('невыбранный — спокойным цветом и без плашки',
    /rgba\(0, 0, 0, 0\)|transparent/.test(B.off.bg) && B.off.br === '0px'
    && /rgba\(0, 0, 0, 0\)|transparent/.test(B.off.bbc), B.off);
  ok('выбранный — акцентом и подчёркиванием, как вкладка',
    B.onKey === 'inbox' && B.on.bb === '2px' && B.on.col === B.on.bbc
    && /rgba\(0, 0, 0, 0\)|transparent/.test(B.on.bg), B.on);
  ok('значки не спорят с подписями — в ряду только слова',
    B.icons > 0 && B.iconsShown === 0, B);
  ok('счётчик непрочитанных — тот же вид, что счётчик на вкладке',
    B.cnt && B.cnt.t === '99+' && !/rgba\(0, 0, 0, 0\)/.test(B.cnt.bg), B.cnt);

  console.log('\n[C] ширину делят список и письмо');
  const C = await page.evaluate(() => {
    const g = document.querySelector('.ml-grid');
    const cols = getComputedStyle(g).gridTemplateColumns.split(' ').map(x => Math.round(parseFloat(x)));
    return { cols, list: Math.round(document.querySelector('.ml-list').getBoundingClientRect().width),
      read: Math.round(document.querySelector('.ml-reader').getBoundingClientRect().width) };
  });
  ok('колонок стало две, а не три', C.cols.length === 2, C.cols);
  ok('чтение шире списка — место ушло письму, а не меню', C.read > C.list, C);

  console.log('\n[D] действия над ящиком — рядом с ящиком, а не среди мест');
  const D = await page.evaluate(() => {
    const bar = document.querySelector('.ml-bar');
    const t = [...bar.querySelectorAll('button')].map(x => x.title || x.textContent.trim());
    return { bar: t, inTabs: document.querySelectorAll('.ml-tabs .ml-mini, .ml-tabs .ml-new').length,
      newInBar: !!bar.querySelector('.ml-new') };
  });
  ok('«Написать» стоит в строке поиска', D.newInBar === true, D.bar);
  ok('«Открыть в Gmail» и «Отключить ящик» — там же',
    /Gmail/.test(D.bar.join('|')) && /Отключить/.test(D.bar.join('|')), D.bar);
  ok('среди ящиков нет ни одного действия', D.inTabs === 0, D.inTabs);

  console.log('\n[E] переключение ящика работает');
  const E = await page.evaluate(() => {
    window.__loads = 0;
    document.querySelector('.ml-tabs .ml-box[data-box="starred"]').click();
    const boxes = [...document.querySelectorAll('.ml-tabs .ml-box')];
    return { box: ML.box, on: (boxes.find(x => x.classList.contains('on')) || {}).dataset,
      loads: window.__loads, cnt: document.querySelectorAll('.ml-tabs .ml-box.on').length };
  });
  ok('нажатие переключает ящик и запрашивает письма',
    E.box === 'starred' && E.loads >= 1, E);
  ok('подсвечен ровно один ящик', E.cnt === 1 && E.on && E.on.box === 'starred', E);

  console.log('\n[F] на ноутбуке ряд помещается без прокрутки');
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.evaluate(() => { ML.box = 'inbox'; renderMail(); });
  await page.waitForTimeout(300);
  const F = await page.evaluate(() => {
    const t = document.querySelector('.ml-tabs');
    const bar = document.querySelector('.ml-bar');
    const kids = [...bar.children].map(c => c.getBoundingClientRect());
    return { over: t.scrollWidth - t.clientWidth,
      barH: Math.round(bar.getBoundingClientRect().height),
      tallest: Math.round(Math.max(...kids.map(k => k.height))),
      cols: getComputedStyle(document.querySelector('.ml-grid')).gridTemplateColumns.split(' ').length };
  });
  ok('все семь ящиков видны сразу, без прокрутки вбок', F.over <= 0, F);
  ok('строка поиска тоже не рвётся на две', F.barH <= F.tallest + 20, F);
  ok('и колонок по-прежнему две', F.cols === 2, F);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read|Cannot set/.test(e));
  console.log('\n[G] ошибки страницы');
  ok('нет ошибок исполнения', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
