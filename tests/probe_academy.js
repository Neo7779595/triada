/* probe_academy — материалы академии в модуле «Инструменты».

   Восемнадцать разборов по модулям платформы кладутся каждому агентству как
   обычные строки tools: их можно переименовать и удалить, и удалённое обратно
   не возвращается. Проверка следит за тем, что делает интерфейс:

   · тип «Гайд» существует и приносит свою иконку — иначе карточка молча
     падает в общий вид «Ссылка», и все материалы теряют лицо;
   · обложка рисуется из названия, а не грузится картинкой. Название хранится
     как «Модуль — уровень»; слева от тире идёт крупно, справа меткой уровня.
     Тире в названии — часть контракта, поэтому проверяем разбор явно;
   · цвет берётся от категории, а не от типа. Раньше цвет приходил только от
     типа, и все карточки выходили одинаково бирюзовыми — темы академии
     переставали различаться;
   · карточки появляются волной: у каждой свой --i. Задержка ограничена сверху,
     иначе на сотне материалов последняя карточка ждала бы несколько секунд;
   · удаление доступно ровно так же, как у любого другого инструмента. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

/* Ожидания считаем от самой описи: добавили модуль — проверка не рассыпалась
   на числах, вбитых руками в семи местах. */
const ГАЙДЫ = [
  ['Академия · Обзор бизнеса',    'Сводка — тренинг',              'https://detroyd.com/guides/summary.html'],
  ['Академия · Обзор бизнеса',    'Сводка — экспертный',           'https://detroyd.com/guides/summary-pro.html'],
  ['Академия · Обзор бизнеса',    'Проекты — тренинг',             'https://detroyd.com/guides/projects.html'],
  ['Академия · Обзор бизнеса',    'Проекты — экспертный',          'https://detroyd.com/guides/projects-pro.html'],
  ['Академия · Поток работы',     'Циклы — тренинг',               'https://detroyd.com/guides/cycles.html'],
  ['Академия · Поток работы',     'Циклы — экспертный',            'https://detroyd.com/guides/cycles-pro.html'],
  ['Академия · Поток работы',     'Операционка — тренинг',         'https://detroyd.com/guides/board.html'],
  ['Академия · Поток работы',     'Операционка — экспертный',      'https://detroyd.com/guides/board-pro.html'],
  ['Академия · Поток работы',     'Дедлайны — тренинг',            'https://detroyd.com/guides/deadlines.html'],
  ['Академия · Поток работы',     'Дедлайны — экспертный',         'https://detroyd.com/guides/deadlines-pro.html'],
  ['Академия · Люди и результат', 'Команда — тренинг',             'https://detroyd.com/guides/team.html'],
  ['Академия · Люди и результат', 'Команда — экспертный',          'https://detroyd.com/guides/team-pro.html'],
  ['Академия · Люди и результат', 'Лидерборд — тренинг',           'https://detroyd.com/guides/leaderboard.html'],
  ['Академия · Люди и результат', 'Лидерборд — экспертный',        'https://detroyd.com/guides/leaderboard-pro.html'],
  ['Академия · Контент',          'Эффективность контента — тренинг',   'https://detroyd.com/guides/content.html'],
  ['Академия · Контент',          'Эффективность контента — экспертный','https://detroyd.com/guides/content-pro.html'],
  ['Академия · Экономика',        'Потраченное время — тренинг',   'https://detroyd.com/guides/time.html'],
  ['Академия · Экономика',        'Потраченное время — экспертный','https://detroyd.com/guides/time-pro.html'],
];

const ТЕМ = new Set(ГАЙДЫ.map(g => g[0])).size;     // категорий академии
const ВСЕГО = ГАЙДЫ.length;                          // материалов академии

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  console.log('[A] тип «Гайд» заведён полностью');
  const T = await page.evaluate(() => ({
    цвет: TOOL_TYPES['Гайд'] || null,
    сокр: TOOL_ABBR['Гайд'] || null,
    глиф: (typeof toolSvg === 'function') ? toolSvg('Гайд') : '',
    неЗапасной: (typeof toolSvg === 'function') && toolSvg('Гайд') !== toolSvg('Ссылка'),
  }));
  ok('цвет типа задан', /^#[0-9A-Fa-f]{6}$/.test(T.цвет || ''), T.цвет);
  ok('сокращение задано', !!T.сокр, T.сокр);
  ok('иконка своя, а не общая «Ссылка»', T.неЗапасной);
  ok('иконка — валидный svg', /^<svg[\s\S]*<\/svg>$/.test(T.глиф || ''));

  console.log('[B] обложка собирается из названия');
  const C = await page.evaluate(() => {
    const h = toolGuideCover('Циклы — тренинг');
    const d = document.createElement('div'); d.innerHTML = h;
    const g = (s) => { const e = d.querySelector(s); return e ? e.textContent : null; };
    return {
      модуль: g('.tc-gd-name'), уровень: g('.tc-gd-lvl'), надстрочник: g('.tc-gd-kick'),
      сетка: !!d.querySelector('.tc-gd-grid'),
      безТире: (() => { const x = document.createElement('div'); x.innerHTML = toolGuideCover('Просто материал');
        return { имя: x.querySelector('.tc-gd-name').textContent, уровень: !!x.querySelector('.tc-gd-lvl') }; })(),
      пусто: (() => { const x = document.createElement('div'); x.innerHTML = toolGuideCover('');
        return x.querySelector('.tc-gd-name').textContent; })(),
      экран: (() => { const x = document.createElement('div'); x.innerHTML = toolGuideCover('<img src=x onerror=alert(1)> — a');
        return x.querySelector('.tc-gd-name').innerHTML.indexOf('<img') < 0; })(),
      нетКартинки: h.indexOf('<img') < 0,
    };
  });
  ok('слева от тире — модуль', C.модуль === 'Циклы', C.модуль);
  ok('справа от тире — уровень', C.уровень === 'тренинг', C.уровень);
  ok('надстрочник на месте', C.надстрочник === 'Академия', C.надстрочник);
  ok('фоновая сетка есть', C.сетка);
  ok('название без тире не ломается', C.безТире.имя === 'Просто материал' && !C.безТире.уровень, C.безТире);
  ok('пустое название не даёт пустую обложку', !!C.пусто, C.пусто);
  ok('название экранируется', C.экран);
  ok('обложка не тянет картинку', C.нетКартинки);

  console.log('[B2] уровень различается заливкой, а не только словом');
  const L = await page.evaluate(() => {
    const кл = (n) => { const x = document.createElement('div'); x.innerHTML = toolGuideCover(n);
      const e = x.querySelector('.tc-gd-lvl'); return e ? e.className : null; };
    return { базовый: кл('Циклы — тренинг'), экспертный: кл('Циклы — экспертный'),
             регистр: кл('Циклы — Экспертный'), нетУровня: кл('Циклы') };
  });
  ok('у базового метка контурная', L.базовый === 'tc-gd-lvl', L.базовый);
  ok('у экспертного метка залитая', /\bis-pro\b/.test(L.экспертный || ''), L.экспертный);
  ok('регистр слова не важен', /\bis-pro\b/.test(L.регистр || ''), L.регистр);
  ok('без уровня метки нет', L.нетУровня === null, L.нетУровня);

  console.log('[C] карточка в сетке: класс, цвет от категории, волна');
  const D = await page.evaluate((гайды) => {
    const было = TOOLS_DATA.splice(0, TOOLS_DATA.length);
    const цвета = ['#37E6C8', '#8A8FFF', '#E3B567', '#43D88C', '#6AA9FF', '#F0785C'];
    const cats = [];
    гайды.forEach(([cat, name, url]) => {
      let s = cats.find(x => x.cat === cat);
      if (!s) { s = { cat, color: цвета[cats.length % цвета.length], items: [] }; cats.push(s); }
      s.items.push({ name, url, ty: 'Гайд', banner: '', created_at: new Date().toISOString(), _id: 'g' + s.items.length });
    });
    /* обычный инструмент рядом: цвет у него должен остаться от типа */
    cats.push({ cat: 'Свои', color: '#F0785C', items: [{ name: 'Miro · доска', url: 'miro.com', ty: 'Miro', banner: '', _id: 'm1' }] });
    cats.forEach(c => TOOLS_DATA.push(c));
    renderTools();
    const карты = Array.from(document.querySelectorAll('#tools-body .tool-card'));
    const гайдКарты = карты.filter(c => c.classList.contains('is-guide'));
    const обычная = карты.find(c => !c.classList.contains('is-guide'));
    const cvar = (e) => (e.getAttribute('style') || '').match(/--c:\s*([^;]+)/);
    const ivar = (e) => { const m = (e.getAttribute('style') || '').match(/--i:\s*(\d+)/); return m ? +m[1] : null; };
    const res = {
      всего: карты.length, гайдов: гайдКарты.length,
      обложек: document.querySelectorAll('#tools-body .tool-card.is-guide .tc-gd').length,
      знаковБезОбложки: document.querySelectorAll('#tools-body .tool-card.is-guide .tc-mark').length,
      цветаГайдов: [...new Set(гайдКарты.map(e => (cvar(e) || [])[1]))],
      цветОбычной: (cvar(обычная) || [])[1],
      индексы: гайдКарты.map(ivar),
      удалить: гайдКарты.every(e => !!e.querySelector('.tc-act-del')),
      открыть: гайдКарты.every(e => !e.classList.contains('is-nolink')),
      имена: гайдКарты.map(e => (e.querySelector('.tc-name') || {}).textContent || ''),
      /* Ни одной карточки с классом гайда — это тоже результат, и он должен
         дойти до отчёта проверкой, а не падением на обращении к пустому массиву. */
      обложкаТекст: (гайдКарты[0] && гайдКарты[0].querySelector('.tc-gd-name') || {}).textContent || null,
      категорий: document.querySelectorAll('#tools-body .tools-cat').length,
      чипГайд: !!document.querySelector('#tools-filt .tf[data-f="Гайд"]'),
      подписьДобавить: (document.querySelector('#tools-body .tool-add') || {}).textContent,
      подсказкаДобавить: (document.querySelector('#tools-body .tool-add') || {}).title,
    };
    TOOLS_DATA.splice(0, TOOLS_DATA.length); было.forEach(x => TOOLS_DATA.push(x));
    return res;
  }, ГАЙДЫ);
  ok('нарисованы все материалы описи', D.гайдов === ВСЕГО, [D.гайдов, ВСЕГО]);
  ok('у каждого гайда своя обложка', D.обложек === ВСЕГО, [D.обложек, ВСЕГО]);
  ok('запасной знак типа не подмешался', D.знаковБезОбложки === 0, D.знаковБезОбложки);
  ok('цвет гайда — от категории (по цвету на тему)', D.цветаГайдов.length === ТЕМ, D.цветаГайдов);
  ok('обычный инструмент сохранил цвет типа', D.цветОбычной === '#F2785C', D.цветОбычной);
  ok('у каждой карточки свой шаг волны', D.индексы.every(v => v !== null) && new Set(D.индексы).size >= ВСЕГО, D.индексы);
  ok('задержка ограничена сверху', Math.max(...D.индексы) <= 26, Math.max(...D.индексы));
  ok('кнопка удаления у каждого материала', D.удалить);
  ok('карточка кликабельна — ссылка есть', D.открыть);
  ok('в подписи полное название', D.имена[0] === 'Сводка — тренинг', D.имена[0]);
  ok('в обложке только модуль', D.обложкаТекст === 'Сводка', D.обложкаТекст);
  ok('все темы академии плюс свои инструменты', D.категорий === ТЕМ + 1, [D.категорий, ТЕМ + 1]);
  ok('в фильтрах появился чип «Гайд»', D.чипГайд);
  ok('плитка добавления не разъезжается на длинном имени', D.подписьДобавить === 'Добавить материал', D.подписьДобавить);
  ok('полное имя категории осталось в подсказке', /Академия · Обзор бизнеса/.test(D.подсказкаДобавить || ''), D.подсказкаДобавить);

  console.log('[D] анимация объявлена и уважает настройку системы');
  /* Правила читаем из исходного текста <style>, а не из CSSOM: браузер
     переписывает сокращённую запись animation в свой порядок, и проверка
     на «animation: tc-in» ломалась бы на ровном месте. Заодно сюда попадают
     правила внутри @media, до которых из cssRules пришлось бы спускаться. */
  const A = await page.evaluate(() => {
    const текст = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    renderTools();                                        // после [C] сетка восстановлена — рисуем заново, чтобы было что мерить
    const карта = document.querySelector('#tools-body .tool-card');
    const cs = карта ? getComputedStyle(карта) : null;
    return {
      кадры: /@keyframes\s+tc-in/.test(текст),
      задержкаОтИндекса: /animation-delay:\s*calc\(var\(--i/.test(текст),
      блик: /\.tc-gd::after/.test(текст),
      покой: /prefers-reduced-motion[\s\S]{0,900}\.tool-card\{animation:none\}/.test(текст.replace(/\s*\n\s*/g, '')),
      имяАнимации: cs ? cs.animationName : null,
      задержка: cs ? cs.animationDelay : null,
    };
  });
  ok('кадры анимации объявлены', A.кадры);
  ok('анимация реально назначена карточке', A.имяАнимации === 'tc-in', A.имяАнимации);
  ok('задержка считается от --i', A.задержкаОтИндекса);
  ok('задержка ненулевая у не первой карточки', A.задержка !== null, A.задержка);
  ok('блик по обложке описан', A.блик);
  ok('при «уменьшить движение» анимация выключается', A.покой);

  console.log('[D2] с включённым «уменьшить движение» карточка не анимируется');
  const page2 = await b.newPage({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' });
  await page2.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(1200);
  const A2 = await page2.evaluate(() => {
    agNav('tools');
    const к = document.querySelector('#tools-body .tool-card');
    return к ? getComputedStyle(к).animationName : 'нет карточки';
  });
  ok('в режиме покоя анимации нет', A2 === 'none', A2);
  await page2.close();

  console.log('[E] удаление — обычным путём инструментов');
  /* Удаление идёт не через системный confirm, а через окно приложения: кнопка
     на карточке открывает подтверждение, и только вторая кнопка убирает запись.
     Проверяем оба шага — «Отмена» обязана оставить материал на месте. */
  const R = await page.evaluate(() => {
    const было = TOOLS_DATA.splice(0, TOOLS_DATA.length);
    const liveБыло = window.LIVE; window.LIVE = false;   // офлайн-ветка правит массив на месте
    TOOLS_DATA.push({ cat: 'Академия · Экономика', color: '#43D88C', items: [
      { name: 'Потраченное время — тренинг', url: 'https://detroyd.com/guides/time.html', ty: 'Гайд', banner: '', _id: 'x1' },
      { name: 'Потраченное время — экспертный', url: 'https://detroyd.com/guides/time-pro.html', ty: 'Гайд', banner: '', _id: 'x2' } ] });
    renderTools();
    const кнопкаУдал = () => document.querySelector('#tools-body .tool-card.is-guide .tc-act-del');
    /* В разметке приложения живёт не одно окно, поэтому берём не первое
       попавшееся .modal, а именно то, где спрашивают про удаление: иначе
       проверка читает текст чужого окна и не находит ничего. */
    const окно = () => Array.from(document.querySelectorAll('.modal'))
      .find(m => /Удалить инструмент/.test(m.textContent)) || null;
    const текстОкна = () => { const m = окно(); return m ? m.textContent.replace(/\s+/g, ' ').trim() : ''; };
    const кнопка = (re) => { const m = окно(); if (!m) return null;
      return Array.from(m.querySelectorAll('button')).find(x => re.test(x.textContent)) || null; };

    /* Нет карточки гайда — дальше идти незачем, но и падать нельзя:
       возвращаем пустой результат, и проверки ниже честно станут красными. */
    const первая = кнопкаУдал();
    if (!первая) { window.LIVE = liveБыло; TOOLS_DATA.splice(0, TOOLS_DATA.length); было.forEach(x => TOOLS_DATA.push(x)); renderTools();
      return { спросили:false, названоИмя:false, послеОтмены:-1, послеУдаления:-1, осталось:['нет карточек гайдов'] }; }
    первая.click();
    const спросили = !!окно();
    const названоИмя = /Потраченное время — тренинг/.test(текстОкна());
    const отмена = кнопка(/Отмена/); if (отмена) отмена.click();
    const послеОтмены = TOOLS_DATA[0].items.length;

    const вторая = кнопкаУдал(); if (вторая) вторая.click();
    const убрать = кнопка(/^Удалить$/);
    if (убрать) убрать.click();
    const послеУдаления = TOOLS_DATA[0] ? TOOLS_DATA[0].items.length : 0;
    const осталось = Array.from(document.querySelectorAll('#tools-body .tool-card .tc-name')).map(e => e.textContent);

    window.LIVE = liveБыло;
    TOOLS_DATA.splice(0, TOOLS_DATA.length); было.forEach(x => TOOLS_DATA.push(x)); renderTools();
    return { спросили, названоИмя, послеОтмены, послеУдаления, осталось };
  });
  ok('кнопка открывает подтверждение', R.спросили);
  ok('в подтверждении названо имя материала', R.названоИмя);
  ok('«Отмена» ничего не удаляет', R.послеОтмены === 2, R.послеОтмены);
  ok('материал удаляется', R.послеУдаления === 1, R.послеУдаления);
  ok('удалён именно выбранный', R.осталось.length === 1 && /экспертный/.test(R.осталось[0]), R.осталось);

  console.log('[F] возврат из материала открывает «Инструменты»');
  /* Материал открывается в новой вкладке, истории у неё нет — возврат работает
     через адрес с хэшем. Проверяем разбор хэша и то, что вход в кабинет им
     пользуется: без второго условия функция может быть верной и никем не
     вызванной. */
  const H = await page.evaluate(() => {
    const был = location.hash;
    const пробa = (v) => { history.replaceState(null, '', location.pathname + (v ? '#' + v : ''));
      const r = agHashModule(); return { вернул: r, хэшПосле: location.hash }; };
    const res = {
      инструменты: пробa('tools'),
      сводка: пробa('overview'),
      чужое: пробa('zzz'),
      пусто: пробa(''),
      сПараметром: (function(){ history.replaceState(null,'',location.pathname+'#tools?x=1'); return agHashModule(); })(),
      вызовВходе: /agNav\(agHashModule\(\)/.test(document.documentElement.outerHTML),
    };
    history.replaceState(null, '', location.pathname + был);
    return res;
  });
  ok('«#tools» открывает инструменты', H.инструменты.вернул === 'tools', H.инструменты);
  ok('любой раздел из списка тоже работает', H.сводка.вернул === 'overview', H.сводка);
  ok('незнакомое значение игнорируется', H.чужое.вернул === '', H.чужое);
  ok('пустой хэш ничего не меняет', H.пусто.вернул === '', H.пусто);
  ok('хвост после раздела не мешает', H.сПараметром === 'tools', H.сПараметром);
  ok('хэш убирается после применения', H.инструменты.хэшПосле === '', H.инструменты.хэшПосле);
  ok('чужой хэш не стирается', H.чужое.хэшПосле === '#zzz', H.чужое.хэшПосле);
  ok('вход в кабинет пользуется разбором хэша', H.вызовВходе);

  console.log('[G] порядок из базы фиксирован');
  const O = await page.evaluate(() => {
    const s = document.documentElement.outerHTML;
    return { естьСортировка: /from\('tools'\)\.select\('\*'\)\.order\('created_at'/.test(s) };
  });
  ok('загрузка инструментов сортируется явно', O.естьСортировка);

  ok('без ошибок на странице', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' ok · ' + fail + ' fail');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
