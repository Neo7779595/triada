/* probe_kbpdf — бриф в базе знаний показывается готовым документом, а не
   стеной ответов: те же страницы, что уходят клиенту в PDF, и та же кнопка
   «Скачать PDF». Список ответов остаётся только как запасной путь. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const FIELDS = [{ id: 's1', type: 'section', label: 'Бизнес' },
  { id: 'q1', type: 'long', label: 'Как вы сами описали бы заведение в 2–3 предложениях?' },
  { id: 'q2', type: 'long', label: 'Почему человек должен выбрать вас, а не конкурента?' },
  { id: 'q3', type: 'short', label: 'Что в заведении вы считаете своим главным преимуществом?' },
  { id: 's2', type: 'section', label: 'Продукт' },
  { id: 'q4', type: 'short', label: 'Есть ли условия для съёмок внутри кухни?' }];
for (let i = 5; i <= 24; i++) FIELDS.push({ id: 'q' + i, type: i % 4 ? 'short' : 'long', label: 'Вопрос номер ' + i + ' про работу заведения?' });
const ANS = { q1: 'Вкусные блюда и сервис. У заведения пока 1 филиал, на рынке они 4 года.',
  q2: 'Удобная локация и вкусные блюда.\n1. Qaldirg’och — широкий ассортимент\n2. Dunyo — есть алкоголь',
  q3: 'Гарантия за вкус и качество блюд', q4: 'Съёмки можно без проблем проводить на кухне' };
for (let i = 5; i <= 24; i++) ANS['q' + i] = 'Ответ на вопрос ' + i + '. Развёрнутый текст клиента про кухню, гостей и сервис заведения.';

const setup = (D) => {
  window.toast = t => { window.__t = String(t); }; window.LIVE = true;
  window.SB = { from: function () { return { select: function () { return { eq: function () { return { order: function () { return Promise.resolve({ data: [], error: null }); } }; } }; } }; } };
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.agIsOwner = () => true; window.agCanView = () => true; window.agCanEdit = () => true;
  PROJECTS = [{ id: 'p1', name: 'Qushbegi Milliy Taomlar', logo: 'Q', logoUrl: null, status: 'active', _tasks: [], _stages: [] }];
  window.PROJECTS = PROJECTS;
  KB_PROJECTS.length = 0;
  KB_PROJECTS.push({ id: 'p1', key: 'p1', name: 'Qushbegi Milliy Taomlar', st: 'active', logo: 'Q' });
  kbProj = 'p1';
  kbAutoEnsure = function () {};                    /* сводка иначе пойдёт в базу и упрётся в заглушку */
  KB_AUTO['p1'] = { _loaded: true, services: [], members: [], contract: null, lead: null,
    _full: { briefs: [{ id: 'b1', name: 'Бриф проекта', fields: D.FIELDS, answers: D.ANS }], briefAt: '2026-08-01' } };
  document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
  document.getElementById('app-ag').classList.add('on');
  renderKB();
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(setup, { FIELDS, ANS });
  await page.waitForTimeout(1400);

  console.log('\n[A] вместо ответов — документ');
  const doc = await page.evaluate(() => {
    const box = document.querySelector('.kb-pdf');
    const host = box && box.querySelector('.ppd-host');
    return { box: !!box, done: box && box.getAttribute('data-done') === '1',
      pages: host ? host.querySelectorAll('.ppd-page').length : 0,
      cover: host ? (host.querySelector('.ppd-cv-h1') || {}).textContent : null,
      eyebrow: host ? (host.querySelector('.ppd-cv-eyebrow') || {}).textContent : null,
      preview: host ? host.classList.contains('is-preview') : null,
      inBody: host ? host.parentElement === document.body : null,
      bar: box ? (box.querySelector('.kb-pdf-t') || {}).textContent : null,
      list: document.querySelectorAll('.kb-bgrid').length,
      more: document.querySelectorAll('.kb-more').length,
      head: (document.querySelector('.kb-subh-row .kb-b-meta') || {}).textContent };
  });
  ok('бриф отдан документом', doc.box && doc.done, doc);
  ok('в документе несколько страниц', doc.pages >= 2, doc.pages);
  ok('на титуле — имя проекта', doc.cover === 'Qushbegi Milliy Taomlar', doc.cover);
  ok('и что это за документ', doc.eyebrow === 'Паспорт проекта', doc.eyebrow);
  ok('стены ответов больше нет', doc.list === 0 && doc.more === 0, doc);
  ok('шапка по-прежнему говорит, сколько заполнено', /заполнено\s*24\s*из\s*24/i.test((doc.head || '').replace(/\s+/g, ' ')), doc.head);
  ok('в подписи — число страниц', /^PDF · \d+ страниц/.test(doc.bar || ''), doc.bar);
  ok('документ живёт в разделе, а не подкинут в body', doc.preview === true && doc.inBody === false, doc);

  console.log('\n[B] лист вписан в панель');
  const fit = await page.evaluate(() => {
    const box = document.querySelector('.kb-pdf'), d = box.querySelector('.kb-pdf-doc');
    const bb = box.getBoundingClientRect(), db = d.getBoundingClientRect();
    return { zoom: Number(d.style.zoom), overflowX: Math.round(db.right - bb.right),
      scrolls: d.scrollHeight - d.clientHeight > 10, h: Math.round(d.clientHeight),
      vh: Math.round(window.innerHeight * 0.78), pw: Number(box.getAttribute('data-pw')) };
  });
  ok('масштаб подобран, а не оставлен единицей', fit.zoom > 0.2 && fit.zoom <= 1.6, fit);
  ok('лист не вылезает вбок', fit.overflowX <= 0, fit);
  ok('высота ограничена, документ прокручивается внутри', fit.scrolls && fit.h <= fit.vh + 4, fit);

  const resize = await page.evaluate(async () => {
    const box = document.querySelector('.kb-pdf'), d = box.querySelector('.kb-pdf-doc');
    const before = Number(d.style.zoom);
    box.style.maxWidth = '420px'; kbPdfFitAll();
    await new Promise(r => setTimeout(r, 50));
    const after = Number(d.style.zoom);
    const bb = box.getBoundingClientRect(), db = d.getBoundingClientRect();
    box.style.maxWidth = ''; kbPdfFitAll();
    return { before, after, over: Math.round(db.right - bb.right) };
  });
  ok('на узкой панели документ уменьшается, а не режется', resize.after < resize.before && resize.over <= 0, resize);

  console.log('\n[C] кнопка «Скачать PDF» отдаёт тот же документ');
  const dl = await page.evaluate(() => {
    const calls = []; const orig = window.passportPdf;
    window.passportPdf = function (pid, brief) { calls.push({ pid: pid, fields: (brief && brief.fields || []).length, ans: Object.keys((brief && brief.answers) || {}).length, title: brief && brief.title }); };
    const btn = document.querySelector('.kb-pdf-dl');
    const label = btn ? btn.textContent.trim() : null;
    if (btn) btn.click();
    window.passportPdf = orig;
    return { label: label, calls: calls };
  });
  ok('кнопка на месте', /Скачать PDF/.test(dl.label || ''), dl.label);
  ok('и просит собрать документ по данным базы знаний',
    dl.calls.length === 1 && dl.calls[0].pid === 'p1' && dl.calls[0].fields === 26 && dl.calls[0].ans === 24, dl.calls);
  ok('с именем проекта в заголовке', dl.calls[0] && dl.calls[0].title === 'Qushbegi Milliy Taomlar', dl.calls);

  console.log('\n[D] сборщик берёт переданный бриф, не заглядывая в кабинет клиента');
  const ext = await page.evaluate(() => {
    let touched = false; const orig = window.briefGet;
    window.briefGet = function () { touched = true; return orig.apply(this, arguments); };
    const host = ppdBuild('p1', { title: 'Свой бриф', fields: [{ id: 'a', type: 'short', label: 'Вопрос?' }], answers: { a: 'Ответ' } });
    window.briefGet = orig;
    const txt = host.textContent;
    host.remove();
    return { touched: touched, hasQ: /Вопрос\?/.test(txt), hasA: /Ответ/.test(txt) };
  });
  ok('к чужим данным сборщик не ходит', ext.touched === false, ext);
  ok('и печатает ровно то, что дали', ext.hasQ && ext.hasA, ext);

  console.log('\n[E] если документ собрать не удалось — ответы списком');
  const fb = await page.evaluate(async () => {
    const orig = window.ppdBuild;
    window.ppdBuild = function () { throw new Error('проверка'); };
    document.querySelectorAll('.kb-pdf').forEach(b => { b.removeAttribute('data-done'); b.innerHTML = ''; });
    kbPdfPaint();
    window.ppdBuild = orig;
    await new Promise(r => setTimeout(r, 50));
    return { fail: !!document.querySelector('.kb-pdf-fail'), grid: document.querySelectorAll('.kb-bgrid').length,
      cards: document.querySelectorAll('.kb-bq').length, note: (document.querySelector('.kb-pdf-fail') || {}).textContent };
  });
  ok('о сбое сказано прямо', fb.fail && /списком/i.test(fb.note || ''), fb);
  ok('и ответы всё равно показаны', fb.grid > 0 && fb.cards > 0, fb);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
