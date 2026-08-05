/* probe_mkquick — «Быстрые расчёты»: карточка, блокнот, поиск и сброс.

   Раньше пояснение к метрике печаталось прямо на карточке и появлялось даже
   у пустой: соседние карточки получали разную высоту, а человек читал абзац
   там, где ждал число. Теперь пояснения лежат в блокноте карточки. Отсюда
   две главные проверки этого файла: на лицевой стороне прозы нет, а две
   карточки с одинаковым числом полей имеют одинаковую высоту.

   Вторая тема — обратимость. Кнопка сброса есть у карточки и у экрана, и
   очистка всех карточек разом обязана возвращаться: человек вводил эти
   числа руками. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
/* toLocaleString('ru-RU') разделяет тысячи узким неразрывным пробелом —
   глазом он неотличим от обычного, а сравнение строк на нём спотыкается. */
const sp = s => String(s == null ? '' : s).replace(/[   ]/g, ' ');

const setup = () => {
  window.toast = () => {}; window.LIVE = false;
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.agIsOwner = () => true;
  window.agVisibleProjects = () => [{ id: 'p1', name: 'APOLO COFFEE' }];
  PROJECTS = [{ id: 'p1', name: 'APOLO COFFEE', _tasks: [], _stages: [] }];
  window.PROJECTS = PROJECTS;
  document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
  document.getElementById('app-ag').classList.add('on');
  MK.cur = 'usd'; MK.rate = 12800; MK.q = {}; MK.qv = null;
  renderCalc();
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(setup);
  await page.waitForTimeout(400);

  /* Движение проверяем один раз и по объявлению, а не по секундомеру.
     В безголовом браузере кадры выдаются лениво, и переход длиной 0,28 с
     по настенным часам может идти вдвое дольше: замер «сколько сейчас
     прозрачность» ловил бы не поведение, а расписание кадров. */
  console.log('\n[0] экран анимирован, а не дёргается');
  const M = await page.evaluate(() => {
    const nb = getComputedStyle(document.querySelector('.mk-qc-nb'));
    const dot = getComputedStyle(document.querySelector('.mk-qc-dot'));
    const card = getComputedStyle(document.querySelector('.mk-qc'));
    return { блокнот: nb.transitionProperty, точка: dot.transitionProperty,
      карточка: card.transitionProperty, появление: card.animationName };
  });
  ok('блокнот раскрывается высотой, а не появлением',
    M.блокнот.indexOf('grid-template-rows') >= 0, M.блокнот);
  ok('точка на кнопке проявляется, а не выскакивает',
    M.точка.indexOf('opacity') >= 0 && M.точка.indexOf('transform') >= 0, M.точка);
  ok('карточка отвечает на наведение движением', M.карточка.indexOf('transform') >= 0, M.карточка);
  ok('и появляется на экране анимацией, а не рывком', M.появление === 'mkqIn', M.появление);

  /* Дальше движение выключаем: проверяем итоговое состояние, а не кадр
     посередине перехода. */
  await page.addStyleTag({ content: '.mk-wrap *{transition:none!important;animation:none!important}' });
  await page.waitForTimeout(120);

  console.log('\n[A] экран собран целиком');
  const A = await page.evaluate(() => {
    const h = document.getElementById('content-ag');
    return {
      карточек: h.querySelectorAll('.mk-qc').length,
      всего: MK_QUICK.length,
      блокнотов: h.querySelectorAll('.mk-qc-nb').length,
      сбросов: h.querySelectorAll('.mk-qc-x').length,
      поиск: !!h.querySelector('#mk-qfind'),
      очистить: !!h.querySelector('#mk-qall'),
      чипов: h.querySelectorAll('.mk-qchip').length,
      групп: MK_QGROUPS.length,
      полос: h.querySelectorAll('.mk-bar').length,
      валюта: [...h.querySelectorAll('.mk-qchips .mk-cur button')].map(b => b.textContent.trim()),
      курс: !!h.querySelector('.mk-qchips .mk-rate input'),
      видно: h.querySelector('.mk-qc').getBoundingClientRect().height,
    };
  });
  ok('нарисованы все карточки списка, а не часть', A.карточек === A.всего && A.всего >= 28, A);
  ok('у каждой карточки свой блокнот и своя кнопка сброса',
    A.блокнотов === A.всего && A.сбросов === A.всего, A);
  ok('на экране есть поиск и «очистить всё»', A.поиск && A.очистить, A);
  ok('кнопок групп на одну больше, чем групп: первая — «Все»',
    A.чипов === A.групп + 1, A);
  /* Полоса наверху существовала ради вкладок. Вкладка осталась одна, и
     строка в 58 пикселей держала три кнопки выбора валюты — эту высоту
     забрали карточки, а валюта переехала в ряд фильтров. */
  ok('верхней полосы нет вовсе — вся высота отдана карточкам', A.полос === 0, A.полос);
  ok('выбор валюты и курс стоят в ряду фильтров',
    A.валюта.join('/') === 'сум/$' && A.курс === true, A);
  ok('экран правда отрисован, а не измеряется скрытым', A.видно > 100, A.видно);

  console.log('\n[B] у каждой метрики есть ответ на «зачем»');
  const B = await page.evaluate(() => {
    const груп = MK_QGROUPS.map(g => g[0]);
    return {
      безЗачем: MK_QUICK.filter(c => !c.why || String(c.why).length < 40).map(c => c.id),
      безЧтения: MK_QUICK.filter(c => !c.read || String(c.read).length < 40).map(c => c.id),
      безГруппы: MK_QUICK.filter(c => груп.indexOf(c.g) < 0).map(c => c.id),
      безКогда: MK_QUICK.filter(c => !c.w).map(c => c.id),
      дубли: (() => { const s = {}, d = []; MK_QUICK.forEach(c => { if (s[c.id]) d.push(c.id); s[c.id] = 1; }); return d; })(),
      пустыеГруппы: груп.filter(g => !MK_QUICK.some(c => c.g === g)),
    };
  });
  ok('ни одна метрика не осталась без объяснения, зачем её считают', B.безЗачем.length === 0, B.безЗачем);
  ok('и без объяснения, как читать полученное число', B.безЧтения.length === 0, B.безЧтения);
  ok('каждая карточка приписана к существующей группе', B.безГруппы.length === 0, B.безГруппы);
  ok('и у каждой есть строка «когда нужна» для инструкции', B.безКогда.length === 0, B.безКогда);
  /* Ключ карточки — это ключ сохранённых чисел. Совпали два — и человек,
     открыв старый расчёт, увидит в одной карточке цифры из другой. */
  ok('ключи карточек не повторяются', B.дубли.length === 0, B.дубли);
  ok('пустых групп нет: кнопка, за которой ничего нет, — не фильтр', B.пустыеГруппы.length === 0, B.пустыеГруппы);

  console.log('\n[C] на лицевой стороне карточки прозы нет');
  const C = await page.evaluate(() => {
    /* Собираем текст карточки без блокнота: остаться должны только название,
       формула, подписи полей и ответ. Абзац здесь — это ошибка. */
    const длинные = [];
    document.querySelectorAll('.mk-qc').forEach(card => {
      const clone = card.cloneNode(true);
      const nb = clone.querySelector('.mk-qc-nb'); if (nb) nb.remove();
      const w = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.textContent.trim();
        if (t.length > 60) длинные.push([card.dataset.id, t.slice(0, 50)]);
      }
    });
    /* И наоборот: текст пояснения обязан быть ровно в блокноте и больше
       нигде. Проверяем по самой строке, а не по её длине. */
    const наружу = [];
    MK_QUICK.forEach(c => {
      const card = document.querySelector('.mk-qc[data-id="' + c.id + '"]');
      const clone = card.cloneNode(true);
      const nb = clone.querySelector('.mk-qc-nb'); if (nb) nb.remove();
      const t = clone.textContent;
      [c.why, c.read, c.care].forEach(x => { if (x && t.indexOf(String(x).slice(0, 40)) >= 0) наружу.push(c.id); });
    });
    const внутри = MK_QUICK.filter(c => {
      const nb = document.querySelector('.mk-qc[data-id="' + c.id + '"] .mk-qc-nb');
      return !nb || nb.textContent.indexOf(String(c.why).slice(0, 40)) < 0;
    }).map(c => c.id);
    const h = id => document.querySelector('.mk-qc[data-id="' + id + '"]').getBoundingClientRect().height;
    return {
      длинные, наружу, внутри,
      /* Ряды собираем по фактическому положению, а не по списку: колонок
         может быть три или четыре, а правило одно — в ряду одна высота.
         Заодно убеждаемся, что в каком-то ряду стоят карточки с разным
         числом полей: иначе проверка ничего не проверяет. */
      ряды: (() => {
        const g = {};
        document.querySelectorAll('.mk-qc').forEach(c => {
          const t = Math.round(c.getBoundingClientRect().top / 4) * 4;
          (g[t] = g[t] || []).push([c.dataset.id, Math.round(c.getBoundingClientRect().height),
            (MK_QUICK.find(x => x.id === c.dataset.id) || { in: [] }).in.length]);
        });
        return Object.keys(g).map(k => g[k]);
      })(),
      закрытый: Math.round(document.querySelector('.mk-qc .mk-qc-nb').getBoundingClientRect().height),
    };
  });
  ok('в карточке не осталось текста длиннее подписи поля', C.длинные.length === 0, C.длинные.slice(0, 3));
  /* Раньше mer и cac печатали оговорку прямо на карточке. Проверяем по самому
     тексту: он должен быть в блокноте и только там. */
  ok('пояснения не вылезли обратно на лицевую сторону', C.наружу.length === 0, C.наружу.slice(0, 3));
  ok('и при этом они там есть — блокнот не пустой', C.внутри.length === 0, C.внутри.slice(0, 3));
  const рваные = C.ряды.filter(r => new Set(r.map(x => x[1])).size !== 1);
  const смешанный = C.ряды.some(r => new Set(r.map(x => x[2])).size > 1);
  ok('карточки одного ряда одной высоты — ответы стоят на одной линии',
    рваные.length === 0, рваные.slice(0, 2));
  ok('и проверять есть что: в ряду встречаются карточки с разным числом полей',
    смешанный === true, C.ряды.map(r => r.map(x => x[2])));
  ok('закрытый блокнот не занимает высоты', C.закрытый === 0, C.закрытый);

  console.log('\n[D] блокнот открывается и закрывается');
  await page.evaluate(() => mkQNote('cac'));
  await page.waitForTimeout(80);
  const D1 = await page.evaluate(() => {
    const c = document.querySelector('.mk-qc[data-id="cac"]');
    return {
      h: Math.round(c.querySelector('.mk-qc-nb').getBoundingClientRect().height),
      класс: c.classList.contains('nb-on'),
      aria: c.querySelector('.mk-qc-nbb').getAttribute('aria-expanded'),
      секций: c.querySelectorAll('.mk-qc-s:not([hidden])').length,
      текст: c.querySelector('.mk-qc-nb').textContent.replace(/\s+/g, ' ').trim().length,
      соседЗакрыт: Math.round(document.querySelector('.mk-qc[data-id="cpl"] .mk-qc-nb').getBoundingClientRect().height),
    };
  });
  await page.evaluate(() => mkQNote('cac'));
  await page.waitForTimeout(80);
  const D2 = await page.evaluate(() => {
    const c = document.querySelector('.mk-qc[data-id="cac"]');
    return { h: Math.round(c.querySelector('.mk-qc-nb').getBoundingClientRect().height),
      класс: c.classList.contains('nb-on'),
      aria: c.querySelector('.mk-qc-nbb').getAttribute('aria-expanded') };
  });
  ok('открытый блокнот занимает высоту и полон текста', D1.h > 80 && D1.текст > 150, D1);
  ok('у CAC в блокноте три раздела: зачем, как читать, что перепутать', D1.секций === 3, D1);
  ok('раскрытие помечено для чтения с экрана', D1.класс === true && D1.aria === 'true', D1);
  ok('открывается только своя карточка, соседняя остаётся закрытой', D1.соседЗакрыт === 0, D1);
  ok('повторное нажатие закрывает', D2.h === 0 && D2.класс === false && D2.aria === 'false', D2);

  console.log('\n[E] живая подпись прячется в блокнот, но о ней предупреждают');
  await page.evaluate(() => { MK.q = { roas: { rev: 1234.56, sp: 400 } }; mkQPaint('roas'); });
  await page.waitForTimeout(80);
  const E1 = await page.evaluate(() => {
    const c = document.querySelector('.mk-qc[data-id="roas"]');
    const пуст = document.querySelector('.mk-qc[data-id="cpm"]');
    return { точка: getComputedStyle(c.querySelector('.mk-qc-dot')).opacity,
      скрыта: c.querySelector('.mk-qc-live').hidden,
      текст: c.querySelector('.mk-qc-n').textContent.length,
      пустаяТочка: getComputedStyle(пуст.querySelector('.mk-qc-dot')).opacity,
      пустаяСкрыта: пуст.querySelector('.mk-qc-live').hidden };
  });
  await page.evaluate(() => mkQNote('roas'));
  await page.waitForTimeout(80);
  const E2 = await page.evaluate(() => {
    const c = document.querySelector('.mk-qc[data-id="roas"]');
    return getComputedStyle(c.querySelector('.mk-qc-dot')).opacity;
  });
  await page.evaluate(() => mkQNote('roas'));
  ok('есть что сказать по результату — на кнопке блокнота горит точка',
    E1.точка === '1' && E1.скрыта === false && E1.текст > 20, E1);
  ok('блокнот открыли — точка гаснет, она больше ни о чём не напоминает', E2 === '0', E2);
  ok('у пустой карточки ни точки, ни живой строки',
    E1.пустаяТочка === '0' && E1.пустаяСкрыта === true, E1);

  console.log('\n[F] сброс карточки');
  const F = await page.evaluate(() => {
    MK.q = { cac: { mk: 200, sc: 100, cl: 999 } }; renderCalc();
    const c = () => document.querySelector('.mk-qc[data-id="cac"]');
    const до = { кнопка: c().querySelector('.mk-qc-x').disabled,
      значение: c().querySelector('.mk-qc-v').textContent,
      пустая: document.querySelector('.mk-qc[data-id="cpm"] .mk-qc-x').disabled,
      пустаяВидна: getComputedStyle(document.querySelector('.mk-qc[data-id="cpm"] .mk-qc-x')).opacity };
    mkQReset('cac');
    return { до, поля: [...c().querySelectorAll('input')].map(i => i.value).join(''),
      память: JSON.stringify(MK.q.cac === undefined ? null : MK.q.cac),
      значение: c().querySelector('.mk-qc-v').textContent,
      кнопка: c().querySelector('.mk-qc-x').disabled };
  });
  ok('кнопка сброса работает только там, где есть что сбрасывать',
    F.до.кнопка === false && F.до.пустая === true, F.до);
  /* Платформа гасит выключенные кнопки до 55 % — на пустой карточке оставалась
     бледная кнопка, которой нечего сбрасывать. Её не должно быть видно. */
  ok('и у пустой карточки её не видно вовсе', F.до.пустаяВидна === '0', F.до);
  ok('сброс очищает и поля на экране, и числа в памяти',
    F.поля === '' && F.память === 'null', F);
  ok('ответ возвращается в прочерк, а кнопка гаснет',
    F.значение === '—' && F.кнопка === true, F);

  console.log('\n[G] очистка всех карточек обратима');
  const G = await page.evaluate(() => {
    MK.q = { cpc: { sp: 12.5, cl: 4000 }, roas: { rev: 1234.56, sp: 400 } }; renderCalc();
    const b = () => document.getElementById('mk-qall');
    const было = JSON.stringify(MK.q);
    const доКнопка = b().disabled;
    mkQResetAll();
    const после = { память: JSON.stringify(MK.q), режим: b().dataset.mode,
      подпись: b().textContent.trim(), поле: document.querySelector('.mk-qc[data-id="cpc"] input').value,
      значение: document.querySelector('.mk-qc[data-id="cpc"] .mk-qc-v').textContent };
    mkQUndo();
    return { было, доКнопка, после, вернули: JSON.stringify(MK.q), режим: b().dataset.mode,
      поле: document.querySelector('.mk-qc[data-id="cpc"] input').value,
      значение: document.querySelector('.mk-qc[data-id="cpc"] .mk-qc-v').textContent };
  });
  ok('«очистить всё» доступно, пока есть что чистить', G.доКнопка === false, G.доКнопка);
  ok('очистка убирает и числа, и то, что нарисовано',
    G.после.память === '{}' && G.после.поле === '' && G.после.значение === '—', G.после);
  ok('кнопка сразу превращается в «Вернуть»',
    G.после.режим === 'undo' && G.после.подпись === 'Вернуть', G.после);
  ok('возврат восстанавливает ровно то, что было',
    G.вернули === G.было && G.поле !== '' && G.значение !== '—', G);
  ok('и кнопка возвращается к обычному виду', G.режим === '', G.режим);
  const G2 = await page.evaluate(() => {
    MK.q = {}; renderCalc();
    return { кнопка: document.getElementById('mk-qall').disabled,
      прочерков: [...document.querySelectorAll('.mk-qc-v')].filter(v => v.textContent === '—').length,
      всего: MK_QUICK.length };
  });
  ok('на пустом экране «очистить всё» выключено — чистить нечего', G2.кнопка === true, G2);
  ok('и все ответы стоят прочерками', G2.прочерков === G2.всего, G2);

  console.log('\n[H] поиск');
  const H = await page.evaluate(() => {
    const вид = () => [...document.querySelectorAll('.mk-qc')].filter(c => !c.classList.contains('off')).map(c => c.dataset.id);
    mkQFind('отток'); const отток = вид();
    mkQFind('CAC'); const регистр = вид();
    mkQFind('показы'); const поПолю = вид();
    mkQFind('ъъъ');
    const пусто = { сколько: вид().length, объяснение: !document.getElementById('mk-qnone').hidden,
      запрос: document.querySelector('#mk-qnone b').textContent };
    const счётПустой = document.querySelector('.mk-qchip[data-g="all"] i').textContent;
    mkQFind('клик');
    const счёт = [...document.querySelectorAll('.mk-qchip')].map(b => [b.dataset.g, b.querySelector('i').textContent]);
    const виднокликов = вид().length;
    mkQFind('');
    return { отток, регистр, поПолю, пусто, счётПустой, счёт, виднокликов, всё: вид().length,
      всего: MK_QUICK.length, крестик: document.getElementById('mk-qfx').hidden };
  });
  ok('поиск находит по смыслу, а не только по названию',
    H.отток.indexOf('churn') >= 0 && H.отток.indexOf('life') >= 0 && H.отток.length < 12, H.отток);
  ok('регистр запроса не имеет значения', H.регистр.indexOf('cac') >= 0, H.регистр);
  ok('ищется и по подписям полей, а не только по заголовку',
    H.поПолю.indexOf('cpm') >= 0 && H.поПолю.indexOf('ctr') >= 0, H.поПолю);
  ok('пустой результат объясняется словами и повторяет сам запрос',
    H.пусто.сколько === 0 && H.пусто.объяснение === true && H.пусто.запрос === 'ъъъ', H.пусто);
  ok('счётчик «Все» на пустом поиске показывает ноль, а не общее число',
    H.счётПустой === '0', H.счётПустой);
  /* Счётчик обязан считать по тому же поиску, что и сетка: иначе кнопка
     обещает семь карточек, а показывает одну. */
  ok('сумма счётчиков по группам равна числу видимых карточек',
    H.счёт.filter(x => x[0] !== 'all').reduce((s, x) => s + Number(x[1]), 0) === H.виднокликов, H.счёт);
  ok('счётчик «Все» равен числу видимых',
    Number((H.счёт.find(x => x[0] === 'all') || [])[1]) === H.виднокликов, H.счёт);
  ok('очистка поиска возвращает все карточки', H.всё === H.всего, H);
  ok('крестик очистки прячется, когда искать нечего', H.крестик === true, H.крестик);

  console.log('\n[I] группы');
  const I = await page.evaluate(() => {
    const вид = () => [...document.querySelectorAll('.mk-qc')].filter(c => !c.classList.contains('off'));
    const по = {};
    MK_QGROUPS.forEach(([g]) => { mkQGroup(g); по[g] = { сколько: вид().length, свои: вид().every(c => c.dataset.g === g) }; });
    const чип = document.querySelector('.mk-qchip[data-g="client"]').classList.contains('on');
    mkQGroup('all');
    const все = вид().length;
    /* Поиск и группа складываются, а не заменяют друг друга. */
    mkQGroup('client'); mkQFind('ltv');
    const вместе = вид().map(c => c.dataset.id);
    mkQFind(''); mkQGroup('all');
    return { по, чип, все, всего: MK_QUICK.length,
      вместе, вместеСвои: вместе.every(id => MK_QUICK.find(c => c.id === id).g === 'client') };
  });
  ok('фильтр по группе показывает только её карточки',
    Object.keys(I.по).every(g => I.по[g].свои && I.по[g].сколько > 0), I.по);
  ok('сумма групп равна всему списку — ни одна карточка не выпала',
    Object.keys(I.по).reduce((s, g) => s + I.по[g].сколько, 0) === I.всего, I.по);
  ok('выбранная группа подсвечена', I.чип === true, I.чип);
  ok('«Все» возвращает весь список', I.все === I.всего, I.все);
  ok('поиск и группа работают вместе, а не отменяют друг друга',
    I.вместе.length > 0 && I.вместеСвои && I.вместе.indexOf('ltvm') >= 0, I.вместе);

  console.log('\n[J] инструкция берёт «когда нужна» из тех же карточек');
  const J = await page.evaluate(() => ({
    ключей: Object.keys(MKG_QWHEN).length, карточек: MK_QUICK.length,
    расхождение: MK_QUICK.filter(c => MKG_QWHEN[c.id] !== c.w).map(c => c.id),
  }));
  ok('в инструкции описаны ровно те карточки, что есть в калькуляторе',
    J.ключей === J.карточек && J.расхождение.length === 0, J);

  console.log('\n[K] новые метрики считают то, что обещают');
  const K = await page.evaluate(() => {
    MK.q = {
      cpa: { sp: 300, ac: 12 }, gp: { rev: 1000, cg: 400 }, revplan: { sl: 20, aov: 250 },
      romirev: { rev: 900, mk: 300 }, arpu: { rev: 1000, cl: 8 }, churn: { ls: 5, st: 100 },
      life: { ch: 5 }, ltv: { aov: 250, pu: 4 }, ltvm: { arpu: 100, mg: 40, ch: 5 },
      ltvc: { rev: 900, cl: 6 }, ltvcac: { ltv: 900, cac: 300 }, troas: { drr: 20 },
    };
    Object.keys(MK.q).forEach(id => mkQPaint(id));
    const v = id => document.querySelector('.mk-qc[data-id="' + id + '"] .mk-qc-v').textContent;
    const o = {}; Object.keys(MK.q).forEach(id => { o[id] = v(id); });
    return o;
  });
  ok('CPA — 300 ÷ 12 = 25 $', sp(K.cpa) === '25 $', K.cpa);
  ok('валовая прибыль — 1000 − 400 = 600 $', sp(K.gp) === '600 $', K.gp);
  ok('прогноз выручки — 20 × 250 = 5 000 $', sp(K.revplan) === '5 000 $', K.revplan);
  ok('ROMI по выручке — (900 − 300) ÷ 300 = 200 %', sp(K.romirev) === '200 %', K.romirev);
  ok('ARPU — 1000 ÷ 8 = 125 $', sp(K.arpu) === '125 $', K.arpu);
  ok('отток — 5 из 100 = 5 %', sp(K.churn) === '5 %', K.churn);
  ok('срок жизни при оттоке 5 % — 20 периодов', sp(K.life) === '20,00', K.life);
  ok('LTV простой — 250 × 4 = 1 000 $', sp(K.ltv) === '1 000 $', K.ltv);
  ok('LTV с маржой — 100 × 0,4 ÷ 0,05 = 800 $', sp(K.ltvm) === '800 $', K.ltvm);
  ok('LTV когортный — 900 ÷ 6 = 150 $', sp(K.ltvc) === '150 $', K.ltvc);
  ok('LTV : CAC — 900 ÷ 300 = 3,00×', sp(K.ltvcac) === '3,00×', K.ltvcac);
  ok('целевой ROAS при ДРР 20 % — 5,00×', sp(K.troas) === '5,00×', K.troas);

  console.log('\n[L] смена валюты пересчитывает деньги новых карточек тоже');
  const L = await page.evaluate(() => {
    MK.q = { arpu: { rev: 100, cl: 8 }, churn: { ls: 5, st: 100 }, troas: { drr: 20 } };
    MK.cur = 'usd'; MK.rate = 12800; renderCalc();
    mkCur('uzs');
    const после = JSON.parse(JSON.stringify(MK.q));
    mkCur('usd');
    return { после, обратно: JSON.parse(JSON.stringify(MK.q)) };
  });
  ok('денежное поле новой карточки пересчиталось', L.после.arpu.rev === 1280000, L.после);
  ok('а штуки и проценты остались как были',
    L.после.arpu.cl === 8 && L.после.churn.ls === 5 && L.после.troas.drr === 20, L.после);
  ok('двойное переключение валюты возвращает ровно исходные числа',
    L.обратно.arpu.rev === 100, L.обратно);

  console.log('\n[M] ' + (errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : 'страница молчала'));
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));

  await b.close();
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  process.exit(fail ? 1 : 0);
})();
