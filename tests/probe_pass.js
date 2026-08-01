/* probe_pass — паспорт проекта у клиента: макет во всю ширину, разделы —
   блоки с таблицей внутри, ничего не обрезано, текст разобран на абзацы
   и списки, развёрнутый ответ занимает строку целиком. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* Реальный случай: клиент пишет абзацами и списками в поле «короткий ответ» —
   у него там растущая textarea, а тип поля остаётся short. */
const A_LIST = "Удобная локация и вкусные блюда.\n\nУ конкурентов преимущества следующие:\n1. Qaldirg'och - широкий ассортимент, есть завтрак, работают 24/7\n2. Dunyo - есть алкоголь\n3. Ishtixon - сильная позиция ( Самарканд )";
const A_MIX = "1. Слабый маркетинг - мало нового трафика.\n2. Есть слабости в сервисе\n\nНа 31 июля клиент сказал, что спросили их слабости месяц тому назад и перечислили многое из этого списка подробно.";
const A_BUL = "- завтраки с 8 утра\n- своя пекарня\n- парковка на 20 мест";
const A_SHORT = 'Гарантия за вкус и качество блюд';
const A_NOSPACE = 'ОченьДлинноеСловоБезПробеловКотороеРаньшеРастягивалоКолонкуИЛомалоВсюСетку';

const setup = (D) => {
  window.__me = { id: 'cl1', full_name: 'Клиент', role: 'client', agency_id: 'AG' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.toast = () => {}; window.LIVE = false;
  window.SB = { from() { return { select() { return { eq() { return { order: () => Promise.resolve({ data: [], error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }; } }; } }; }, rpc: () => Promise.resolve({ data: null, error: null }) };
  window.briefReloadStructure = (pid, cb) => { if (cb) cb(); };
  window.CLP = { id: 'p1', name: 'Qushbegi Milliy Taomlar', logo: 'Q', logoUrl: null, cl_hidden: [] };
  window.PROJECTS = [window.CLP];

  const F = [
    { id: 's1', type: 'section', label: 'Бизнес' },
    { id: 'f1', type: 'short', label: 'Что в заведении вы считаете своим главным преимуществом?' },
    { id: 'f2', type: 'short', label: 'Почему человек должен выбрать именно вас, а не конкурента рядом?' },
    { id: 'f3', type: 'short', label: 'Что вы считаете слабым местом конкурентов?' },
    { id: 'f4', type: 'long', label: 'Чем вы отличаетесь?' },
    { id: 'f5', type: 'long', label: 'Опишите вашу аудиторию' },
    { id: 's2', type: 'section', label: 'Данные' },
    { id: 'f6', type: 'short', label: 'Город' },
    { id: 'f7', type: 'short', label: 'Тег без пробелов' },
    { id: 'f8', type: 'url', label: 'Сайт' },
    { id: 'f9', type: 'short', label: 'Не отвеченный вопрос' },
  ];
  const A = { f1: D.SHORT, f2: D.LIST, f3: D.MIX, f4: D.BUL, f5: 'Семьи с детьми 28–45.', f6: 'Ташкент', f7: D.NOSPACE, f8: 'https://qushbegi.uz', f9: '' };
  window._BRIEFDOC = { p1: { loaded: true, cur: 'b1', briefs: [{ id: 'b1', name: 'Бриф проекта', title: '', description: '', fields: F, answers: A, visible: true, banner: '', font: '', _editing: false }] } };

  document.querySelectorAll('body > *').forEach(el => { if (el.id !== 'app-cl') el.style.display = 'none'; });
  const app = document.getElementById('app-cl'); if (app) { app.classList.add('on'); app.style.display = ''; }
  clNav('passport');
};
const DATA = { LIST: A_LIST, MIX: A_MIX, BUL: A_BUL, SHORT: A_SHORT, NOSPACE: A_NOSPACE };

/* ширина документа минус его горизонтальные отступы */
const geom = () => {
  const doc = document.querySelector('.bpass-doc');
  const cont = document.getElementById('content-cl');
  const grid = document.querySelector('.bpass-tbl');
  const dr = doc.getBoundingClientRect(), cr = cont.getBoundingClientRect();
  let outside = [];
  doc.querySelectorAll('*').forEach(el => { const r = el.getBoundingClientRect();
    /* таблица намеренно уходит на 1px под рамку блока: иначе линия ячейки удваивает рамку */
    if (r.width && (r.right > dr.right + 1.5 || r.left < dr.left - 0.5)) outside.push(el.className.toString().slice(0, 30)); });
  const cols = s => s ? getComputedStyle(s).gridTemplateColumns.trim().split(/\s+/).length : 0;
  return {
    docW: Math.round(dr.width), contW: Math.round(cr.width),
    docOver: doc.scrollWidth - doc.clientWidth,
    gridCols: cols(grid), secs: document.querySelectorAll('.bpass-sec').length,
    outside: [...new Set(outside)],
    pageOver: document.body.scrollWidth - document.documentElement.clientWidth,
  };
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1720, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup, DATA);
  await page.waitForTimeout(500);

  console.log('\n[A] макет занимает всю ширину раздела и ничего не обрезает');
  const g = await page.evaluate(geom);
  ok('документ шире прежних 920px', g.docW > 1200, g.docW);
  ok('документ занимает почти всю ширину раздела', g.contW - g.docW < 80, g);
  ok('внутри документа нет горизонтальной прокрутки', g.docOver === 0, g.docOver);
  ok('ни один элемент не вылезает за края документа', g.outside.length === 0, g.outside);
  ok('страница не едет вбок', g.pageOver === 0, g.pageOver);
  ok('на 1720px таблица раздела в 2 колонки — как на листе PDF', g.gridCols === 2, g.gridCols);
  ok('каждый раздел — отдельный блок', g.secs === 2, g.secs);

  console.log('\n[B] короткий ответ — ячейка, развёрнутый — строка целиком');
  const split = await page.evaluate(() => {
    const lbl = e => (e.querySelector('.bpass-lbl') || {}).textContent || '';
    return {
      facts: [...document.querySelectorAll('.bpass-c:not(.full)')].map(lbl),
      narr: [...document.querySelectorAll('.bpass-c.full')].map(lbl),
      narrHasRich: [...document.querySelectorAll('.bpass-c.full')].every(c => c.querySelector('.bpass-rich')),
      factsHaveRich: [...document.querySelectorAll('.bpass-c:not(.full) .bpass-rich')].length,
      /* развёрнутый ответ обязан занимать всю ширину таблицы */
      fullWide: [...document.querySelectorAll('.bpass-c.full')].every(c =>
        Math.abs(c.getBoundingClientRect().width - c.parentElement.getBoundingClientRect().width) < 3),
    };
  });
  ok('развёрнутый ответ занимает строку целиком', split.narr.some(t => /Почему человек/.test(t)) && split.fullWide, split);
  ok('однострочный ответ остался плиткой данных', split.facts.some(t => /главным преимуществом/.test(t)), split.facts);
  ok('короткий ответ в поле «абзац» тоже плитка, а не полупустая карточка', split.facts.some(t => /Опишите вашу аудиторию/.test(t)), split.facts);
  ok('незаполненный вопрос строку целиком не занимает', !split.narr.some(t => /Не отвеченный/.test(t)), split.narr);
  ok('в каждой такой строке — разобранный текст', split.narrHasRich, split.narr);
  ok('в обычных ячейках разобранного текста нет', split.factsHaveRich === 0, split.factsHaveRich);

  console.log('\n[C] текст разобран на абзацы и списки, а не склеен в простыню');
  const rich = await page.evaluate(() => {
    const find = re => [...document.querySelectorAll('.bpass-c')].find(c => re.test((c.querySelector('.bpass-lbl') || {}).textContent || ''));
    const dump = c => { const r = c.querySelector('.bpass-rich'); if (!r) return null;
      return { html: r.innerHTML, p: [...r.querySelectorAll(':scope>p')].map(x => x.textContent),
        ol: [...r.querySelectorAll(':scope>ol>li')].map(x => ({ n: (x.querySelector('.bpass-n') || {}).textContent, t: (x.querySelector('span') || {}).textContent })),
        ul: [...r.querySelectorAll(':scope>ul>li')].map(x => (x.querySelector('span') || {}).textContent),
        order: [...r.children].map(x => x.tagName) }; };
    return { list: dump(find(/Почему человек/)), mix: dump(find(/слабым местом/)), bul: dump(find(/Чем вы отличаетесь/)) };
  });
  ok('нумерованный список стал <ol> из 3 пунктов', rich.list && rich.list.ol.length === 3, rich.list && rich.list.ol);
  ok('номера пунктов сохранены как 1 · 2 · 3', rich.list && rich.list.ol.map(x => x.n).join('') === '123', rich.list && rich.list.ol.map(x => x.n));
  ok('текст пункта без ведущего «1.»', rich.list && /^Qaldirg/.test(rich.list.ol[0].t), rich.list && rich.list.ol[0]);
  ok('подводка перед списком осталась абзацем, а не пунктом', rich.list && rich.list.p.some(t => /преимущества следующие/.test(t)), rich.list && rich.list.p);
  ok('первый абзац отделён от подводки', rich.list && rich.list.p.length === 2, rich.list && rich.list.p);
  ok('порядок блоков: абзац, абзац, список', rich.list && rich.list.order.join(',') === 'P,P,OL', rich.list && rich.list.order);
  ok('список без ведущего абзаца тоже собирается', rich.mix && rich.mix.ol.length === 2, rich.mix && rich.mix.ol);
  ok('абзац после списка не потерялся', rich.mix && rich.mix.p.length === 1 && /31 июля/.test(rich.mix.p[0]), rich.mix && rich.mix.p);
  ok('порядок сохранён: сначала список, потом абзац', rich.mix && rich.mix.order.join(',') === 'OL,P', rich.mix && rich.mix.order);
  ok('маркированный список стал <ul> из 3 пунктов', rich.bul && rich.bul.ul.length === 3, rich.bul && rich.bul.ul);
  ok('маркер «-» убран из текста пункта', rich.bul && rich.bul.ul[0] === 'завтраки с 8 утра', rich.bul && rich.bul.ul[0]);
  ok('в разборе нет <br>-простыни', rich.list && rich.list.html.indexOf('<br>') < 0, rich.list && rich.list.html.slice(0, 120));

  console.log('\n[D] длинное слово без пробелов не ломает сетку');
  const nb = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.bpass-c')].find(x => /Тег без пробелов/.test((x.querySelector('.bpass-lbl') || {}).textContent || ''));
    const grid = c.parentElement;
    const cs = [...grid.children].map(x => Math.round(x.getBoundingClientRect().width));
    return { w: Math.round(c.getBoundingClientRect().width), gridW: Math.round(grid.getBoundingClientRect().width), cs, over: c.scrollWidth - c.clientWidth };
  });
  ok('карточка не шире своей колонки', nb.w <= nb.gridW, nb);
  ok('карточка не прокручивается вбок', nb.over <= 0, nb.over);
  ok('колонки остались равными', new Set(nb.cs.filter(w => w < nb.gridW * 0.9)).size <= 1, nb.cs);

  console.log('\n[E] вопрос читается целиком, а не обрезается многоточием');
  const lbl = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.bpass-c')].find(x => /Почему человек/.test((x.querySelector('.bpass-lbl') || {}).textContent || ''));
    const l = c.querySelector('.bpass-lbl'); const cs = getComputedStyle(l);
    return { ws: cs.whiteSpace, clipped: l.scrollWidth - l.clientWidth, text: l.textContent };
  });
  ok('заголовок вопроса переносится по словам', lbl.ws !== 'nowrap', lbl.ws);
  ok('заголовок вопроса не обрезан', lbl.clipped <= 0, lbl);
  ok('текст вопроса на месте целиком', /а не конкурента рядом\?$/.test(lbl.text), lbl.text);

  console.log('\n[F] число колонок отвечает ширине, и на любой ширине ничего не вылезает');
  for (const W of [2200, 1280, 1024, 900, 430]) {
    if (W <= 768) await page.evaluate(() => document.body.classList.add('m-app'));
    await page.setViewportSize({ width: W, height: 950 });
    await page.waitForTimeout(250);
    const gg = await page.evaluate(geom);
    ok(W + 'px · ничего не вылезает за документ', gg.outside.length === 0 && gg.docOver === 0, gg);
    ok(W + 'px · страница не едет вбок', gg.pageOver === 0, gg.pageOver);
    if (W === 2200) ok('2200px · только на сверхширокой третья колонка', gg.gridCols === 3, gg.gridCols);
    if (W === 1280) ok('1280px · таблица в 2 колонки', gg.gridCols === 2, gg.gridCols);
    if (W === 1024) ok('1024px · узкий раздел — одна колонка', gg.gridCols === 1, gg.gridCols);
    if (W === 900) ok('900px · одна колонка', gg.gridCols === 1, gg.gridCols);
    if (W === 430) ok('430px · всё в одну колонку', gg.gridCols === 1, gg);
  }

  console.log('\n[G] композиция повторяет PDF: обложка, содержание, выровненные подписи');
  await page.setViewportSize({ width: 1720, height: 1000 });
  await page.waitForTimeout(250);
  const pdfLike = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const toc = [...document.querySelectorAll('.bpass-toc-i')];
    /* подписи в паре плиток обязаны стоять на одной высоте, значения — тоже */
    const rows = [];
    document.querySelectorAll('.bpass-tbl').forEach(t => {
      const cs = [...t.querySelectorAll(':scope>.bpass-c')];
      for (let i = 0; i + 1 < cs.length; i += 2) {
        const a = cs[i].querySelector('.bpass-lbl'), b = cs[i + 1].querySelector('.bpass-lbl');
        if (!a || !b) continue;
        const va = cs[i].children[1], vb = cs[i + 1].children[1];
        rows.push({
          lbl: Math.abs(a.getBoundingClientRect().height - b.getBoundingClientRect().height),
          val: (va && vb) ? Math.abs(va.getBoundingClientRect().top - vb.getBoundingClientRect().top) : 0,
          h: Math.abs(cs[i].getBoundingClientRect().height - cs[i + 1].getBoundingClientRect().height),
        });
      }
    });
    return {
      rule: !!q('.bpass-rule'), bar: !!q('.bpass-prog2-bar'), ring: !!q('.bpass-ring'),
      tocN: toc.length, tocHref: toc[0] && toc[0].getAttribute('href'),
      secFramed: q('.bpass-sec') ? getComputedStyle(q('.bpass-sec')).borderTopWidth : null,
      cardBorder: q('.bpass-c') ? getComputedStyle(q('.bpass-c')).borderTopWidth : null,
      narrSep: (() => { const l = q('.bpass-narr .bpass-lbl'); return l ? getComputedStyle(l).borderBottomWidth : null; })(),
      nofill: !!q('.bpass-nofill'),
      lblMark: (() => { const l = q('.bpass-c .bpass-lbl'); if (!l) return false;
        const cs = getComputedStyle(l, '::before'); return cs.content !== 'none' && parseFloat(cs.width) >= 2; })(),
      lblSep: (() => { const l = q('.bpass-c .bpass-lbl'); return l ? getComputedStyle(l).borderBottomWidth : null; })(),
      badSep: (() => { let bad = 0;
        document.querySelectorAll('.bpass-tbl').forEach(t => { const cs = [...t.querySelectorAll(':scope>.bpass-c')];
          for (let i = 0; i + 1 < cs.length; i += 2) { const a = cs[i].querySelector('.bpass-lbl'), b = cs[i + 1].querySelector('.bpass-lbl');
            if (a && b && Math.abs(a.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom) > 1) bad++; } });
        return bad; })(),
      facts: document.querySelectorAll('.bpass-fact').length,
      factsWide: (() => { const f = q('.bpass-facts'), d = q('.bpass-doc');
        return !!f && !!d && Math.abs(f.getBoundingClientRect().width - d.getBoundingClientRect().width) < 3; })(),
      progFull: (() => { const b2 = q('.bpass-prog2-bar'), d = q('.bpass-doc');
        return !!b2 && !!d && Math.abs(b2.getBoundingClientRect().width - d.getBoundingClientRect().width) < 3; })(),
      badLbl: rows.filter(r => r.lbl > 1).length,
      badVal: rows.filter(r => r.val > 1).length,
      badH: rows.filter(r => r.h > 1).length,
      rows: rows.length,
    };
  });
  ok('на титуле акцентная черта, как в PDF', pdfLike.rule, pdfLike);
  ok('заполнение показано полосой, а не кольцом', pdfLike.bar && !pdfLike.ring, pdfLike);
  ok('содержание собрано и ведёт к разделам', pdfLike.tocN === 2 && /#bpsec-/.test(pdfLike.tocHref || ''), pdfLike);
  ok('раздел без рамки — вес держат карточки', pdfLike.secFramed === '0px' && pdfLike.cardBorder === '1px', pdfLike);
  ok('в развёрнутом ответе вопрос отбит линейкой', pdfLike.narrSep === '1px', pdfLike.narrSep);
  ok('у каждого вопроса акцентная метка и линейка', pdfLike.lblMark && pdfLike.lblSep === '1px', pdfLike);
  ok('линейки под подписями пары совпадают', pdfLike.badSep === 0, pdfLike);
  ok('полоса фактов — четыре ячейки во всю ширину', pdfLike.facts === 4 && pdfLike.factsWide, pdfLike);
  ok('готовность — линия по нижней кромке шапки', pdfLike.progFull, pdfLike);
  ok('незаполненные вопросы одной строкой', pdfLike.nofill, pdfLike);
  ok('в паре плиток подписи одной высоты', pdfLike.rows > 0 && pdfLike.badLbl === 0, pdfLike);
  ok('значения в паре плиток на одной линии', pdfLike.badVal === 0, pdfLike);
  ok('плитки ряда одной высоты', pdfLike.badH === 0, pdfLike);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
