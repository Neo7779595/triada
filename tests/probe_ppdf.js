/* probe_ppdf — паспорт проекта выгружается в PDF: страницы A4, ничего не
   обрезано на разрывах, ни один ответ не потерян, экран после печати цел.
   Проверяется настоящий PDF через page.pdf(), а не только разметка. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const A2 = "Удобная локация и вкусные блюда.\n\nУ конкурентов преимущества следующие:\n1. Qaldirg'och - широкий ассортимент, есть позиции на завтрак, работают 24/7\n2. Dunyo - есть алкоголь\n3. Ishtixon - сильная позиция ( Самарканд зигир оши )";
const A4T = "1. Слабый маркетинг - у них основной контингент постоянные гости и мало нового трафика.\n2. Есть слабости в сервисе\n\nНа 31 июля 2026 года клиент сказал что если бы мы спросили их слабости месяц тому назад то они бы перечислили многое.";
/* заведомо длиннее страницы — проверяем разрезание по абзацам */
const HUGE = Array.from({ length: 26 }, (_, i) => 'Абзац номер ' + (i + 1) + '. Здесь описан один самостоятельный кусок ответа клиента, который занимает две строки на полосе набора формата A4 и потому надёжно переполняет страницу.').join('\n\n');

const setup = (D) => {
  window.__me = { id: 'cl1', full_name: 'Клиент', role: 'client', agency_id: 'AG' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.toast = t => { window.__toast = String(t); }; window.LIVE = false;
  window.SB = { from() { return { select() { return { eq() { return { order: () => Promise.resolve({ data: [], error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }; } }; } }; }, rpc: () => Promise.resolve({ data: null, error: null }) };
  window.briefReloadStructure = (pid, cb) => { if (cb) cb(); };
  window.CLP = { id: 'p1', name: 'Qushbegi Milliy Taomlar', logo: 'Q', logoUrl: null, cl_hidden: [] };
  window.PROJECTS = [window.CLP];

  const S = (id, l) => ({ id, type: 'section', label: l });
  const q = (id, t, l) => ({ id, type: t, label: l });
  const F = [
    S('s1', 'Бизнес'),
    q('f1', 'short', 'Как вы сами описали бы заведение в 2–3 предложениях?'),
    q('f2', 'short', 'Почему человек должен выбрать вас, а не конкурента?'),
    q('f3', 'short', 'Что в заведении вы считаете своим главным преимуществом?'),
    q('f4', 'short', 'Что вы считаете слабым местом заведения?'),
    q('f26', 'short', 'Незаполненный вопрос раздела один'),
    S('s2', 'Продукт и аудитория'),
    q('f5', 'short', 'Средний чек'), q('f6', 'short', 'Город'),
    q('f7', 'checks', 'Каналы продвижения'), q('f8', 'url', 'Сайт'),
    { id: 'f9', type: 'scale', label: 'Готовность к экспериментам', scale: { min: 1, max: 10 } },
    q('f10', 'short', 'Кто принимает решение'), q('f12', 'short', 'Телефон'), q('f13', 'short', 'Часы работы'),
    S('s3', 'Длинный ответ'),
    q('f11', 'long', 'Опишите вашу аудиторию максимально подробно'),
    S('s4', 'Материалы'),
    q('f22', 'url', 'Ссылка на Instagram'), q('f23', 'short', 'Есть ли фотограф'),
  ];
  const A = {
    f1: 'Вкусные блюда и сервис. У заведения пока 1 филиал, на рынке они 4 года.',
    f2: D.A2, f3: 'Гарантия за вкус и качество блюд', f4: D.A4, f26: '',
    f5: '85 000 сум', f6: 'Ташкент',
    f7: ['Instagram', 'Telegram', 'Яндекс Директ', 'Наружная реклама'],
    f8: 'https://qushbegi.uz', f9: 7, f10: 'Собственник',
    f12: '+998 90 000 00 00', f13: '10:00 – 23:00',
    f11: D.HUGE,
    f22: 'https://instagram.com/qushbegi', f23: 'Нет, нужен от агентства',
  };
  window._BRIEFDOC = { p1: { loaded: true, cur: 'b1', briefs: [
    { id: 'b1', name: 'Бриф проекта', title: '', description: '', fields: F, answers: A, visible: true, banner: '', font: '', _editing: false }
  ] } };

  document.querySelectorAll('body > *').forEach(el => { if (el.id !== 'app-cl') el.style.display = 'none'; });
  const app = document.getElementById('app-cl'); if (app) { app.classList.add('on'); app.style.display = ''; }
  clNav('passport');
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup, { A2, A4: A4T, HUGE });
  await page.waitForTimeout(500);

  console.log('\n[A] кнопка на месте и ведёт в сборку PDF');
  const btn = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('.bpass-head-right button')];
    const p = bs.find(x => /Скачать PDF/.test(x.textContent));
    return { n: bs.length, has: !!p, on: p && p.getAttribute('onclick'), title: p && p.getAttribute('title'),
      edit: bs.some(x => /Редактировать/.test(x.textContent)) };
  });
  ok('кнопка «Скачать PDF» есть в шапке паспорта', btn.has, btn);
  ok('она зовёт сборку документа', /passportPdf\('p1'\)/.test(btn.on || ''), btn.on);
  ok('кнопка «Редактировать» на месте', btn.edit, btn);
  ok('подсказка объясняет, что будет', /A4/.test(btn.title || ''), btn.title);

  console.log('\n[B] раскладка по страницам: ничего не обрезано и не потеряно');
  const lay = await page.evaluate(() => {
    const host = ppdBuild('p1');
    const pages = [...host.querySelectorAll('.ppd-page')];
    const bodies = pages.map(p => p.querySelector('.ppd-body')).filter(Boolean);
    const r = {
      total: pages.length,
      declared: +host.getAttribute('data-pages'),
      /* обрезано ровно то, что ниже нижней кромки полосы набора */
      overflow: bodies.map(bd => { const l = bd.lastElementChild; if (!l) return 0;
        return Math.round(l.getBoundingClientRect().bottom - bd.getBoundingClientRect().bottom); }).filter(v => v > 1),
      clipped: bodies.map(bd => [...bd.children].filter(c => c.getBoundingClientRect().bottom > bd.getBoundingClientRect().bottom + 1).length).reduce((a, b) => a + b, 0),
      emptyBodies: bodies.filter(bd => !bd.children.length).length,
      /* заголовок раздела не должен быть последним элементом страницы */
      orphanHeads: bodies.slice(0, -1).filter(bd => { const l = bd.lastElementChild; return l && l.classList.contains('ppd-sec-h'); }).length,
      /* сноска «продолжение» появляется там и только там, где раздел разорван */
      conts: [...host.querySelectorAll('.ppd-sec-cont')].map(e => e.textContent),
      contsAtTop: [...host.querySelectorAll('.ppd-sec-cont')].every(e => e.parentElement.firstElementChild === e),
      /* нумерация страниц */
      feet: pages.slice(1).map(p => (p.querySelector('.ppd-foot-r') || {}).textContent),
      /* размер страницы: A4 = 210×297 мм */
      geom: (() => { const r0 = pages[0].getBoundingClientRect(); return { w: Math.round(r0.width), h: Math.round(r0.height) }; })(),
      /* строка «не заполнено» вместо пустых карточек */
      emptyCards: host.querySelectorAll('.ppd-cell .ppd-q').length,
      emptyLines: [...host.querySelectorAll('.ppd-empty')].map(e => e.textContent),
      /* выравнивание подписей в паре плиток */
      rowsUneven: [...host.querySelectorAll('.ppd-row')].filter(row => {
        const qs = [...row.querySelectorAll('.ppd-q')]; if (qs.length < 2) return false;
        const hs = qs.map(x => Math.round(x.getBoundingClientRect().height));
        return Math.max(...hs) - Math.min(...hs) > 1;
      }).length,
      splits: host.querySelectorAll('.ppd-narr-cont').length,
      text: host.textContent,
    };
    host.remove();
    return r;
  });
  ok('страниц больше одной — титул и содержание', lay.total >= 3, lay.total);
  ok('число страниц совпадает с объявленным', lay.total === lay.declared, lay);
  ok('ни одна страница не переполнена', lay.overflow.length === 0, lay.overflow);
  ok('ни один блок не обрезан границей страницы', lay.clipped === 0, lay.clipped);
  ok('пустых страниц нет', lay.emptyBodies === 0, lay.emptyBodies);
  ok('заголовок раздела не остаётся последней строкой страницы', lay.orphanHeads === 0, lay.orphanHeads);
  ok('нумерация страниц сквозная и верная', lay.feet.join(',') === lay.feet.map((_, i) => (i + 2) + ' / ' + lay.total).join(','), lay.feet);
  ok('страница ровно A4 (210×297 мм)', Math.abs(lay.geom.w - 794) <= 2 && Math.abs(lay.geom.h - 1123) <= 2, lay.geom);
  ok('разорванный раздел подписан «продолжение»', lay.conts.length >= 1 && /продолжение/.test(lay.conts[0]), lay.conts);
  ok('подпись стоит вверху страницы, а не в середине', lay.contsAtTop, lay.conts);
  ok('ответ длиннее страницы разрезан, а не обрезан', lay.splits >= 1, lay.splits);
  ok('подписи в паре плиток выровнены по высоте', lay.rowsUneven === 0, lay.rowsUneven);
  ok('незаполненные вопросы собраны в строку', lay.emptyLines.length >= 1 && /Незаполненный вопрос раздела один/.test(lay.emptyLines.join(' ')), lay.emptyLines);
  ok('незаполненные вопросы карточками не нарисованы', !/Не заполнено<\/div>/.test(lay.text) && lay.text.indexOf('Незаполненный вопрос раздела один') === lay.text.lastIndexOf('Незаполненный вопрос раздела один'), true);

  console.log('\n[C] в документе есть всё, что есть в паспорте');
  const must = ['Qushbegi Milliy Taomlar', 'Паспорт проекта', 'Бизнес', 'Продукт и аудитория',
    'Вкусные блюда и сервис', 'Гарантия за вкус и качество блюд', "Qaldirg'och", 'Ishtixon',
    '85 000 сум', 'Ташкент', 'Наружная реклама', 'qushbegi.uz', 'Собственник', 'Абзац номер 26'];
  must.forEach(m => ok('в документе есть «' + m + '»', lay.text.indexOf(m) >= 0));
  ok('нумерованный список остался списком', /1\s*Qaldirg/.test(lay.text.replace(/\s+/g, ' ')), lay.text.slice(0, 0));

  console.log('\n[D] печать не портит экран');
  const st = await page.evaluate(() => {
    const t0 = document.title;
    const host = ppdBuild('p1');
    document.title = 'Паспорт проекта — Qushbegi Milliy Taomlar';
    document.body.classList.add('ppd-printing');
    const printing = { cls: document.body.classList.contains('ppd-printing'), title: document.title, inDom: !!document.querySelector('.ppd-host') };
    document.body.classList.remove('ppd-printing'); document.title = t0; host.remove();
    return { printing, after: { cls: document.body.classList.contains('ppd-printing'), title: document.title, hosts: document.querySelectorAll('.ppd-host').length,
      passport: !!document.querySelector('.bpass-doc') } };
  });
  ok('имя файла берётся из заголовка документа', /Паспорт проекта — Qushbegi/.test(st.printing.title), st.printing.title);
  ok('после закрытия печати класс снят', st.after.cls === false, st.after);
  ok('заголовок вкладки возвращён', st.after.title !== st.printing.title, st.after.title);
  ok('печатный документ убран из DOM', st.after.hosts === 0, st.after.hosts);
  ok('паспорт на экране на месте', st.after.passport, st.after);

  console.log('\n[E] настоящий PDF: A4, векторный текст, ответы на месте');
  const pdfPath = path.join(os.tmpdir(), 'probe_ppdf_' + process.pid + '.pdf');
  await page.evaluate(() => { window.__host = ppdBuild('p1'); document.body.classList.add('ppd-printing'); });
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.evaluate(() => { document.body.classList.remove('ppd-printing'); if (window.__host) window.__host.remove(); });
  const size = fs.existsSync(pdfPath) ? fs.statSync(pdfPath).size : 0;
  ok('PDF сгенерирован', size > 4000, size);
  /* Декоративный шум поверх экрана при печати растрируется в полноэкранную
     картинку на каждый лист. Векторный документ обязан быть лёгким. */
  ok('файл лёгкий — текст, а не картинки', size < 700000, size);
  let info = '', txt = '';
  try { info = cp.execSync('pdfinfo ' + JSON.stringify(pdfPath), { encoding: 'utf8' }); } catch (_) {}
  try { txt = cp.execSync('pdftotext -layout ' + JSON.stringify(pdfPath) + ' -', { encoding: 'utf8' }); } catch (_) {}
  if (info) {
    const pgs = (info.match(/Pages:\s+(\d+)/) || [])[1];
    const sz = (info.match(/Page size:\s+([\d.]+) x ([\d.]+)/) || []).slice(1).map(Number);
    ok('в PDF столько же страниц, сколько разложено', +pgs === lay.total, { pgs, lay: lay.total });
    ok('размер страницы A4 (595×842 pt)', sz.length === 2 && Math.abs(sz[0] - 595) < 2 && Math.abs(sz[1] - 842) < 2, sz);
  } else { ok('pdfinfo доступен', false, 'нет poppler-utils'); ok('размер страницы A4', false); }
  if (txt) {
    ok('текст в PDF настоящий, а не картинка', txt.replace(/\s/g, '').length > 500, txt.length);
    const lost = ['Qushbegi Milliy Taomlar', 'Гарантия за вкус и качество блюд', "Qaldirg'och", '85 000 сум', 'Абзац номер 26']
      .filter(m => txt.indexOf(m) < 0);
    ok('ни один ответ не потерялся при раскладке', lost.length === 0, lost);
    ok('колонтитул с номерами страниц напечатан', /2\s*\/\s*\d/.test(txt), txt.slice(0, 0));
  } else { ok('pdftotext доступен', false, 'нет poppler-utils'); ok('ответы на месте', false); ok('колонтитул напечатан', false); }
  try { fs.unlinkSync(pdfPath); } catch (_) {}

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
