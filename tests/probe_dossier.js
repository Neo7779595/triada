/* probe_dossier — досье проекта: бланк, редактор, очистка разметки, сохранение */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'DTR HUNTER', role: 'agency_owner', agency_id: 'AG', agencySlug: 'detroyd' };
  window.tMe = () => window.__me;
  window.__toasts = []; window.toast = t => { window.__toasts.push(t); };
  window.LIVE = false;
  localStorage.removeItem('triada_pin_AG_u1');
  const P = (id, name, o) => Object.assign({ id, name, status: 'active', pct: 30, cat: 'Кофейня', svc: 'SMM', tariff: 'Gold',
    mrr: 0, cost: 0, lead_id: 'm1', _overdue: false, _overdueAll: 0, _lastActDays: 1, _nextDue: null,
    createdAt: '2026-06-01', logo: name[0], logoUrl: null, _stages: [], _tasks: [], _team: [], dossier: null,
    _contract: { start: '2026-06-01', end: '2026-12-01' } }, o || {});
  PROJECTS = [P('p1', 'Stella Coffee'), P('p2', 'Ресто Групп', { dossier: { html: '<p>Есть записи</p>', font: 'Manrope', updated_at: '2026-07-30T10:00:00Z', updated_by: 'Аня' } })];
  TEAM = [{ _id: 'm1', name: 'DTR HUNTER', role: 'PM', color: '#37E6C8', is_pm: true }];
  window._teamRaw = { tasks: [] }; window._timeLogs = []; window.tLoadTeam = async () => {};
  window._pjAggFallback = true;
  agFilter = 'all';
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(setup);
  await page.evaluate(() => {
    renderProjects();
    const c = document.getElementById('content-ag');
    document.body.appendChild(c);
    c.style.cssText = 'position:fixed;left:0;top:0;width:1420px;height:880px;overflow:auto;background:#0a0d0c;z-index:1;display:block;padding:16px';
  });
  await page.waitForTimeout(300);

  /* ——— A. кнопка в карточке ——— */
  console.log('\n[A] кнопка в карточке');
  const btns = await page.evaluate(() => {
    const o = {};
    document.querySelectorAll('.pjh-mgrid .dsr-open').forEach(b => { o[b.id] = { on: b.classList.contains('on'), dot: !!b.querySelector('.dot') }; });
    return o;
  });
  ok('кнопка есть у каждого проекта', Object.keys(btns).length === 2, btns);
  ok('стоит внутри блока «Ответственный»', await page.evaluate(() => {
    const b = document.querySelector('.dsr-open');
    const blk = b && b.closest('.pjh-mblk');
    return !!blk && /Ответственный/.test(blk.querySelector('.mk').textContent);
  }));
  ok('пустое досье — приглушённая иконка', btns['dsr-b-p1'].on === false && btns['dsr-b-p1'].dot === false, btns['dsr-b-p1']);
  ok('заполненное — акцентная с точкой', btns['dsr-b-p2'].on === true && btns['dsr-b-p2'].dot === true, btns['dsr-b-p2']);
  ok('у кнопки есть внятная подпись для чтения с экрана', await page.evaluate(() =>
    /Досье проекта/.test(document.querySelector('.dsr-open').getAttribute('aria-label') || '')));
  const fit = await page.evaluate(() => {
    const b = document.getElementById('dsr-b-p1').getBoundingClientRect();
    const blk = document.getElementById('dsr-b-p1').closest('.pjh-mblk').getBoundingClientRect();
    const person = document.getElementById('dsr-b-p1').closest('.pjh-leadrow').querySelector('.pjh-person').getBoundingClientRect();
    return { over: Math.round(Math.max(0, b.bottom - blk.bottom, blk.top - b.top)),
      right: Math.round(blk.right - b.right), sameRow: Math.abs((b.top + b.height / 2) - (person.top + person.height / 2)) < 3 };
  });
  ok('кнопка помещается в блок и не растягивает его', fit.over === 0, fit);
  ok('стоит справа, в одну строку с ответственным', fit.right >= 10 && fit.right <= 20 && fit.sameRow, fit);

  /* ——— B. открытие ——— */
  console.log('\n[B] открытие');
  await page.evaluate(() => { window.__opened = 0; const o = window.openProject; window.openProject = function () { window.__opened++; }; });
  await page.click('#dsr-b-p1');
  await page.waitForTimeout(400);
  ok('окно открылось', await page.evaluate(() => !!document.querySelector('#ov-pd2 .modal.dsr')));
  ok('карточка проекта при этом не открылась', await page.evaluate(() => window.__opened) === 0);
  ok('шапка бланка берёт данные из карточки', await page.evaluate(() => {
    const t = document.querySelector('.dsr-sh-m').textContent.replace(/\s+/g, ' ');
    return /SMM/.test(t) && /Gold/.test(t) && /DTR HUNTER/.test(t) && /01\.06\.2026/.test(t) && /01\.12\.2026/.test(t);
  }), await page.evaluate(() => document.querySelector('.dsr-sh-m').textContent.replace(/\s+/g, ' ')));
  ok('в подвале сказано, что документ внутренний', /не для передачи клиенту/.test(await page.evaluate(() => document.querySelector('.dsr-sh-f').textContent)));

  /* ——— C. пустое досье ——— */
  console.log('\n[C] пустое досье');
  ok('вместо пустого листа — приглашение', await page.evaluate(() => !!document.querySelector('.dsr-seed-t')));
  ok('пять заготовок', await page.evaluate(() => document.querySelectorAll('.dsr-seed-b').length) === 5);
  await page.click('.dsr-seed-b');
  await page.waitForTimeout(300);
  ok('клик по заготовке открывает редактор с заголовком', await page.evaluate(() =>
    DSR.mode === 'edit' && /<h2>Что клиент любит и не любит<\/h2>/.test(document.getElementById('dsr-ed').innerHTML)));
  ok('курсор сразу в тексте', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'dsr-ed');

  /* ——— D. панель ——— */
  console.log('\n[D] панель инструментов');
  ok('панель появилась только в правке', await page.evaluate(() => !!document.getElementById('dsr-tools')));
  await page.evaluate(() => { const ed = document.getElementById('dsr-ed'); ed.innerHTML = '<p>Первый абзац.</p>'; dsrFocusEnd(); });
  await page.keyboard.press('End');
  await page.click('.dsr-t[data-k="b:h3"]');
  await page.waitForTimeout(150);
  ok('«Заголовок 3» превращает абзац в h3', await page.evaluate(() => /<h3>Первый абзац\.<\/h3>/.test(document.getElementById('dsr-ed').innerHTML)));
  ok('и подсвечивается в панели', await page.evaluate(() => document.querySelector('.dsr-t[data-k="b:h3"]').classList.contains('on')));
  ok('жирный в заголовке не подсвечен — он там не вручную', await page.evaluate(() => !document.querySelector('.dsr-t[data-k="c:bold"]').classList.contains('on')));
  await page.click('.dsr-t[data-k="b:h3"]');
  await page.waitForTimeout(150);
  ok('повторное нажатие возвращает обычный текст', await page.evaluate(() => /<p>Первый абзац\.<\/p>/.test(document.getElementById('dsr-ed').innerHTML)));
  await page.click('.dsr-t[data-k="b:blockquote"]');
  await page.waitForTimeout(150);
  ok('цитата ставится', await page.evaluate(() => !!document.querySelector('#dsr-ed blockquote')));
  await page.click('.dsr-t[data-k="b:p"]');
  await page.waitForTimeout(150);

  /* ——— E. списки ——— */
  console.log('\n[E] списки');
  await page.evaluate(() => { const ed = document.getElementById('dsr-ed'); ed.innerHTML = '<p><br></p>'; dsrFocusEnd(); });
  await page.click('.dsr-t[data-k="c:insertUnorderedList"]');
  await page.waitForTimeout(150);
  await page.keyboard.type('раз'); await page.keyboard.press('Enter');
  await page.keyboard.type('два'); await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('обычный абзац');
  await page.waitForTimeout(200);
  const list = await page.evaluate(() => document.getElementById('dsr-ed').innerHTML);
  ok('два пункта набрались', await page.evaluate(() => document.querySelectorAll('#dsr-ed li').length) === 2, list);
  ok('Enter на пустом пункте выводит из списка абзацем', /<\/ul><p>обычный абзац<\/p>/.test(list), list);
  ok('список не завёрнут в абзац', !/<p>\s*<ul/.test(list), list);
  await page.evaluate(() => { const ed = document.getElementById('dsr-ed'); ed.innerHTML = '<ul><li>раз</li><li>два</li></ul>'; dsrFocusEnd(); });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  ok('Tab делает пункт вложенным', await page.evaluate(() => !!document.querySelector('#dsr-ed ul ul, #dsr-ed ul > ul')));
  ok('и не уводит фокус из редактора', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'dsr-ed');
  ok('вложенный список после очистки лежит внутри пункта', await page.evaluate(() =>
    dsrClean('<ul><li>раз</li><ul><li>два</li></ul></ul>')) === '<ul><li>раз<ul><li>два</li></ul></li></ul>',
    await page.evaluate(() => dsrClean('<ul><li>раз</li><ul><li>два</li></ul></ul>')));

  /* ——— F. Backspace в начале заголовка ——— */
  console.log('\n[F] заголовок и Backspace');
  await page.evaluate(() => { const ed = document.getElementById('dsr-ed'); ed.innerHTML = '<h2>Заголовок</h2>'; dsrFocusEnd(); });
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
  ok('Backspace в начале заголовка делает абзац, а не съедает текст', await page.evaluate(() =>
    /<p>Заголовок<\/p>/.test(document.getElementById('dsr-ed').innerHTML)), await page.evaluate(() => document.getElementById('dsr-ed').innerHTML));

  /* ——— G. очистка разметки ——— */
  console.log('\n[G] чужая разметка');
  const dirty = '<div style="a" class="b"><script>alert(1)<\/script><p onclick="x()">Текст <img src=x onerror=y> <a href="javascript:evil()">зло</a> <a href="https://ok.ru">ок</a> <b>жир</b></p><table><tr><td>таблица</td></tr></table><iframe src="//evil"></iframe></div>';
  const clean = await page.evaluate(d => dsrClean(d), dirty);
  ok('скрипт вырезан', !/script/i.test(clean), clean);
  ok('картинка с onerror вырезана', !/img|onerror/i.test(clean), clean);
  ok('обработчики событий вырезаны', !/onclick/i.test(clean), clean);
  ok('style и class вырезаны', !/style=|class=/i.test(clean), clean);
  ok('ссылка на javascript: не осталась ссылкой', !/javascript:/i.test(clean), clean);
  ok('но текст не потерян', /Текст/.test(clean) && /зло/.test(clean) && /жир/.test(clean), clean);
  ok('нормальная ссылка уцелела и стала безопасной', /<a href="https:\/\/ok\.ru" rel="noopener noreferrer" target="_blank">ок<\/a>/.test(clean), clean);
  ok('жирный сохранился тегом', /<b>жир<\/b>/.test(clean), clean);
  ok('пустой документ считается пустым', await page.evaluate(() => dsrClean('<p><br></p><p>&nbsp;</p>')) === '');

  /* ——— H. шрифты ——— */
  console.log('\n[H] шрифты');
  const fonts = await page.evaluate(() => [...document.querySelectorAll('.dsr-f')].map(e => e.textContent));
  ok('ровно пять шрифтов', fonts.length === 5, fonts);
  ok('Nunito среди них', fonts.indexOf('Nunito') >= 0, fonts);
  ok('Nunito есть и в общем справочнике шрифтов', await page.evaluate(() => BRIEF_FONTS.some(f => f.k === 'Nunito')));
  await page.evaluate(() => { document.querySelectorAll('link[id^="bffont-"]').forEach(l => l.remove()); });
  await page.click('.dsr-f:nth-child(4)');
  await page.waitForTimeout(250);
  ok('выбор шрифта применяется к листу сразу', await page.evaluate(() =>
    /Playfair/.test(getComputedStyle(document.getElementById('dsr-ed')).fontFamily)),
    await page.evaluate(() => getComputedStyle(document.getElementById('dsr-ed')).fontFamily));
  ok('семейство подтягивается по требованию, а не при запуске', await page.evaluate(() =>
    !!document.getElementById('bffont-Playfair-Display')));
  await page.click('.dsr-f:nth-child(1)');
  await page.waitForTimeout(200);

  /* ——— I. сохранение ——— */
  console.log('\n[I] сохранение');
  await page.evaluate(() => { const ed = document.getElementById('dsr-ed'); ed.innerHTML = '<h2>Итог</h2><p>Клиент любит цифры.</p>'; dsrTouch(); });
  await page.evaluate(() => dsrDone());
  await page.waitForTimeout(400);
  ok('«Готово» возвращает бланк', await page.evaluate(() => DSR.mode === 'read' && !!document.getElementById('dsr-doc') && !document.getElementById('dsr-tools')));
  ok('текст сохранён в проект', await page.evaluate(() => (PROJECTS[0].dossier || {}).html) === '<h2>Итог</h2><p>Клиент любит цифры.</p>');
  ok('шрифт сохранён', await page.evaluate(() => (PROJECTS[0].dossier || {}).font) === 'Nunito');
  ok('автор записан', await page.evaluate(() => (PROJECTS[0].dossier || {}).updated_by) === 'DTR HUNTER');
  ok('в шапке появилось «обновлено»', /обновлено/.test(await page.evaluate(() => document.getElementById('dsr-meta').textContent)));
  ok('иконка в карточке стала акцентной', await page.evaluate(() => {
    const b = document.getElementById('dsr-b-p1');
    return !!b && b.classList.contains('on') && !!b.querySelector('.dot');
  }));
  await page.evaluate(() => dsrClose());
  await page.waitForTimeout(250);
  ok('окно закрылось', await page.evaluate(() => !document.querySelector('#ov-pd2 .modal.dsr')));
  await page.evaluate(() => dsrOpen('p1'));
  await page.waitForTimeout(400);
  ok('при повторном открытии текст на месте', await page.evaluate(() =>
    document.getElementById('dsr-doc').innerHTML) === '<h2>Итог</h2><p>Клиент любит цифры.</p>');

  /* ——— J. Esc в два шага ——— */
  console.log('\n[J] выход');
  await page.evaluate(() => dsrEdit());
  await page.waitForTimeout(300);
  await page.evaluate(() => { const ed = document.getElementById('dsr-ed'); ed.innerHTML = '<p>Дописал на бегу</p>'; dsrTouch(); });
  await page.evaluate(() => pd2EscClose());
  await page.waitForTimeout(300);
  ok('Esc из редактора возвращает бланк, а не закрывает окно', await page.evaluate(() =>
    DSR.mode === 'read' && !!document.querySelector('#ov-pd2 .modal.dsr')));
  ok('и молча сохраняет', await page.evaluate(() => (PROJECTS[0].dossier || {}).html) === '<p>Дописал на бегу</p>');
  await page.evaluate(() => pd2EscClose());
  await page.waitForTimeout(250);
  ok('второй Esc закрывает окно', await page.evaluate(() => !document.querySelector('#ov-pd2 .modal.dsr')));

  /* ——— K. права ——— */
  console.log('\n[K] кто может править');
  await page.evaluate(() => { window.__me.role = 'member'; window.__me.is_pm = false; window.__me.id = 'u9'; dsrOpen('p1'); });
  await page.waitForTimeout(400);
  ok('сотрудник досье видит', await page.evaluate(() => !!document.querySelector('#ov-pd2 .modal.dsr')));
  ok('но кнопки «Редактировать» у него нет', await page.evaluate(() => !document.getElementById('dsr-edit')));
  ok('и правка не откроется даже вызовом напрямую', await page.evaluate(() => { dsrEdit(); return DSR.mode === 'read'; }));
  await page.evaluate(() => { pd2Close(); window.__me.role = 'agency_owner'; window.__me.id = 'u1'; });

  /* ——— L. прокрутка и липкость ——— */
  console.log('\n[L] прокрутка');
  await page.evaluate(() => { dsrOpen('p1'); dsrEdit(); });
  await page.waitForTimeout(400);
  const sticky = await page.evaluate(() => [...document.querySelectorAll('#ov-pd2 .modal.dsr *')]
    .filter(el => getComputedStyle(el).position === 'sticky').map(el => String(el.className)));
  ok('липкая только панель инструментов', sticky.length === 1 && /dsr-tools/.test(sticky[0]), sticky);
  const scrollers = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#ov-pd2 .modal.dsr *').forEach(el => {
      if (el.scrollHeight - el.clientHeight > 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) out.push(el.id || String(el.className));
    });
    return out;
  });
  ok('по вертикали скроллится только тело окна', scrollers.filter(s => s !== 'dsr-body').length === 0, scrollers);

  /* ——— M. адаптив ——— */
  console.log('\n[M] раскладка на разных экранах');
  for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(240);
    const r = await page.evaluate(() => {
      const m = document.querySelector('#ov-pd2 .modal.dsr');
      const done = document.getElementById('dsr-done').getBoundingClientRect();
      const rects = ['.dsr-top', '#dsr-body', '.dsr-foot'].map(s => document.querySelector('#ov-pd2 ' + s).getBoundingClientRect());
      const gaps = []; for (let i = 1; i < rects.length; i++) gaps.push(Math.round(rects[i].top - rects[i - 1].bottom));
      return {
        hscroll: m.scrollWidth - m.clientWidth,
        fits: m.getBoundingClientRect().width <= innerWidth + 1 && m.getBoundingClientRect().height <= innerHeight + 1,
        doneVisible: done.top >= 0 && done.bottom <= innerHeight + 1 && done.width > 0,
        gaps,
      };
    });
    ok(vp.width + '×' + vp.height + ': нет горизонтальной прокрутки', r.hscroll <= 1, r);
    ok(vp.width + '×' + vp.height + ': окно помещается', r.fits, r);
    ok(vp.width + '×' + vp.height + ': кнопка выхода видна', r.doneVisible, r);
    ok(vp.width + '×' + vp.height + ': блоки не наезжают', r.gaps.every(g => g >= -1), r.gaps);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);

  /* ——— N. чужая вёрстка ——— */
  console.log('\n[N] чужая вёрстка');
  await page.evaluate(() => pd2Close());
  const other = await page.evaluate(() => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="modal" id="__probe_modal"><div class="modal-h"><h3>x</h3></div></div>';
    document.body.appendChild(el);
    const cs = getComputedStyle(document.getElementById('__probe_modal'));
    const r = { maxWidth: cs.maxWidth, radius: cs.borderRadius, display: cs.display };
    el.remove(); return r;
  });
  ok('обычная .modal осталась прежней', other.maxWidth === '460px' && other.radius === '14px' && other.display === 'block', other);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read|TypeError/.test(e));
  console.log('\n[O] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
