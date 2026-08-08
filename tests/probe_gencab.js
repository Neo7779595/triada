/* probe_gencab — генеральный кабинет: дополнительные разделы агентства и
   ссылки на обучение.

   Раздел, которого у агентства нет, не должен существовать для него вовсе:
   ни пункта в меню, ни строки в правах, ни упоминания. Включает его владелец
   платформы поштучно, и это решение платформы, а не право сотрудника.

   Список опциональных разделов — один на продукт. Генеральный кабинет рисует
   переключатели ровно по тому списку, который читает сам агентский кабинет:
   два списка разошлись бы на первом же новом разделе, и получилось бы
   «включил, а не появилось».

   Ссылки на обучение — по одной на раздел. Раньше список разделов был вписан
   руками и дважды: в отрисовку полей и в сбор значений. Из него выпали
   «Калькулятор», «Почта» и «Интеграции» — в этих разделах кнопка «Обучение»
   отвечала, что ссылка не задана, а задать её было негде. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  console.log('[A] раздела нет, пока его не включили');
  /* Проверяем ВСЕ опциональные разделы, а не один названный: список растёт,
     и раздел, добавленный в него завтра, обязан проходить тот же путь
     «выключено → включено → выключено» без отдельной проверки под себя. */
  const M = await page.evaluate(() => {
    window.__me = { id: 'u1', role: 'agency_owner', agency_id: 'a1' }; window.tMe = () => window.__me;
    const снимок = (m) => { applyAgencyPerms();
      const nav = document.querySelector('#app-ag .nav-i[data-m="' + m + '"]');
      return {
        выключен: agModuleOff(m),
        пункт: nav ? getComputedStyle(nav).display : 'нет узла',
        право: agCanView(m),
        вПравах: _permKeys().indexOf(m) >= 0 }; };
    const по = {};
    AG_MODULES_OPT.forEach(m => {
      delete window.__me.agencyModules;
      const ново = снимок(m);
      window.__me.agencyModules = {}; const пусто = снимок(m);
      window.__me.agencyModules = {}; window.__me.agencyModules[m] = true;
      const включено = снимок(m);
      window.__me.agencyModules = {}; window.__me.agencyModules[m] = false;
      const явноВыключено = снимок(m);
      по[m] = { ново, пусто, включено, явноВыключено };
    });
    delete window.__me.agencyModules;
    return { по: по,
      опциональные: (typeof AG_MODULES_OPT !== 'undefined') ? AG_MODULES_OPT.slice() : null,
      обычныйНеОпционален: agModuleOff('projects') };
  });
  const все = (ф) => Object.keys(M.по).every(m => ф(M.по[m]));
  const кто = (ф) => Object.keys(M.по).filter(m => !ф(M.по[m]));
  ok('у нового агентства раздела нет: ни пункта, ни права, ни строки в правах',
    все(s => s.ново.выключен === true && s.ново.пункт === 'none'
          && s.ново.право === false && s.ново.вПравах === false), кто(s => s.ново.выключен === true
          && s.ново.пункт === 'none' && s.ново.право === false && s.ново.вПравах === false));
  ok('включили из генерального — раздел появился целиком',
    все(s => s.включено.выключен === false && s.включено.пункт !== 'none'
          && s.включено.право === true && s.включено.вПравах === true),
    кто(s => s.включено.выключен === false && s.включено.пункт !== 'none'
          && s.включено.право === true && s.включено.вПравах === true));
  ok('выключили — пропал так же целиком',
    все(s => s.пусто.выключен === true && s.пусто.пункт === 'none' && s.пусто.вПравах === false),
    кто(s => s.пусто.выключен === true && s.пусто.пункт === 'none' && s.пусто.вПравах === false));
  ok('явно выключенный и никогда не включённый — одно и то же',
    все(s => s.явноВыключено.выключен === true && s.явноВыключено.пункт === 'none'
          && s.явноВыключено.пункт === s.ново.пункт),
    кто(s => s.явноВыключено.выключен === true && s.явноВыключено.пункт === 'none'));
  ok('опциональны ровно «Финансы» и «Почта», обычный раздел — нет',
    Array.isArray(M.опциональные) && M.опциональные.join(',') === 'finance,mail'
    && M.обычныйНеОпционален === false, M.опциональные);

  /* Раздел прячут не для красоты: выключенный он не должен открываться ни
     одним путём. Пункт меню — только один из них; модуль умеют вызывать и
     напрямую, из восстановленного состояния или перехода по уведомлению. */
  const R = await page.evaluate(() => {
    const host = document.getElementById('content-ag');
    const проба = (флаг) => {
      window.__me.agencyModules = флаг;
      host.innerHTML = '<i id="метка"></i>';
      try{ renderMail(); }catch(e){ return 'упало: ' + e.message; }
      return document.getElementById('метка') ? 'не тронул' : 'нарисовал';
    };
    const выкл = проба({});
    const вкл  = проба({ mail: true });
    /* И навигация мимо меню. Выключенный раздел — не отказ в доступе:
       сказать владельцу «нет доступа» к тому, что он сам и выключил, значит
       соврать. Поэтому проверяем не только куда увело, но и что тоста нет. */
    window.__me.agencyModules = {};
    const прежнийToast = window.toast; let сказано = '';
    window.toast = (s)=>{ сказано = String(s); };
    agNav('team');                                   // уходим с проектов, чтобы переход было видно
    agNav('mail');
    window.toast = прежнийToast;
    const кудаУвело = (document.querySelector('#app-ag .nav-i.on') || {}).dataset;
    delete window.__me.agencyModules;
    return { выкл, вкл, увело: кудаУвело ? кудаУвело.m : null, сказано: сказано };
  });
  ok('выключенная почта не рисуется даже прямым вызовом', R.выкл === 'не тронул', R);
  ok('включённая — рисуется', R.вкл === 'нарисовал', R);
  ok('переход на выключенный раздел уводит на проекты, а не в пустоту',
    R.увело === 'projects', R);
  ok('и не врёт про «нет доступа» к тому, что выключено самим владельцем',
    R.сказано === '', R);

  console.log('[B] генеральный кабинет рисует те же разделы, что читает агентский');
  const G = await page.evaluate(() => {
    agModsRender({ finance: true });
    const строк = [...document.querySelectorAll('#f-mods .agmod-r')];
    const ключи = строк.map(r => (r.querySelector('input') || {}).id || '')
      .map(id => id.replace('f-mod-', ''));
    const подписи = строк.map(r => (r.querySelector('.agmod-n') || {}).textContent);
    const состояние = строк.map(r => (r.querySelector('.agmod-s') || {}).textContent);
    const включено = agModsValue();
    document.getElementById('f-mod-finance').checked = false; agModsSync();
    const снято = agModsValue();
    const состояниеПосле = (document.querySelector('#f-mods .agmod-s') || {}).textContent;
    return { ключи, подписи, состояние, включено, снято, состояниеПосле,
      опциональные: AG_MODULES_OPT.slice(),
      имена: AG_MODULES };
  });
  ok('переключатели ровно по списку опциональных разделов, без своего второго списка',
    G.ключи.join(',') === G.опциональные.join(','), [G.ключи, G.опциональные]);
  ok('раздел назван так же, как в меню, а не своим словом',
    G.подписи[0] === G.имена[G.ключи[0]], [G.подписи, G.имена[G.ключи[0]]]);
  ok('состояние подписано словами, а не только галочкой',
    G.состояние[0] === 'включён' && G.состояниеПосле === 'выключен', [G.состояние, G.состояниеПосле]);
  ok('в сохранение уходит только отмеченное',
    JSON.stringify(G.включено) === '{"finance":true}' && JSON.stringify(G.снято) === '{}', [G.включено, G.снято]);

  console.log('[C] ссылки на обучение — на все разделы без исключения');
  const T = await page.evaluate(() => {
    /* Считаем поля, которые правда нарисованы, а не список, из которого их
       собирались рисовать: разошлись бы именно эти две вещи. */
    window.PLATFORM_SETTINGS = window.PLATFORM_SETTINGS || {};
    let нарисованы = [];
    try {
      renderSettings();
      нарисованы = [...document.querySelectorAll('[id^="set-tl-"]')].map(e => e.id.replace('set-tl-', ''));
    } catch (e) { нарисованы = ['ОШИБКА: ' + (e && e.message)]; }
    const модули = Object.keys(AG_MODULES);
    return { ключи: нарисованы, модули,
      неПокрыты: модули.filter(k => нарисованы.indexOf(k) < 0),
      лишние: нарисованы.filter(k => модули.indexOf(k) < 0) };
  });
  ok('ни один раздел продукта не остался без поля для ссылки',
    T.неПокрыты.length === 0, T.неПокрыты);
  ok('и лишних полей нет — список один, а не переписан рядом',
    T.лишние.length === 0 && T.ключи.length === T.модули.length, [T.лишние, T.ключи.length, T.модули.length]);
  ok('прежде выпадавшие разделы на месте',
    ['calc', 'mail', 'integrations'].every(k => T.ключи.indexOf(k) >= 0), T.ключи);

  console.log('[D] кнопка «Обучение» не притворяется рабочей');
  /* Кнопка, которая всегда отвечает «ссылка не задана», — та же ошибка, что
     стрелка месяца на пределе истории: выглядит рабочей и не работает. */
  const L = await page.evaluate(() => {
    window.PLATFORM_SETTINGS = { training_links: { projects: 'https://learn/projects', calc: '   ' } };
    const b = document.getElementById('ag-learn-btn');
    const вид = m => { agSyncLearn(m); return getComputedStyle(b).display; };
    return { есть: вид('projects'), нет: вид('mail'), пробелы: вид('calc'), узел: !!b };
  });
  ok('кнопка есть там, где ссылка задана', L.узел === true && L.есть !== 'none', L);
  ok('и её нет там, где не задана', L.нет === 'none', L);
  ok('ссылка из одних пробелов за ссылку не считается', L.пробелы === 'none', L);

  console.log('\n[E] строка раздела выглядит строкой, а не слипшимся текстом');
  /* Строка — это <label> внутри .fld, а общий стиль .fld label ставит
     display:block и ПРОПИСНЫЕ. Селектор в один класс проигрывал ему по весу,
     и вместо ряда с переключателем выходило «ФИНАНСЫвыключен» без пробела. */
  const S = await page.evaluate(() => {
    /* Меряем только на открытом окне: у скрытого все прямоугольники нулевые,
       и проверка на размер переключателя проверяла бы саму себя. */
    document.getElementById('ov-agency').classList.add('on');
    document.getElementById('f-mods-fld').style.display = '';
    agModsRender({ finance: false });
    const r = document.querySelector('#f-mods .agmod-r');
    const cs = getComputedStyle(r);
    const n = r.querySelector('.agmod-n'), sw = r.querySelector('input');
    const cn = getComputedStyle(n), cw = getComputedStyle(sw);
    const порядок = [...r.children].map(x => x.tagName === 'INPUT' ? 'переключатель' : x.className);
    return { раскладка: cs.display, зазор: cs.gap, регистр: cn.textTransform,
      имя: n.textContent, порядок,
      ширинаПереключателя: Math.round(sw.getBoundingClientRect().width),
      кругл: cw.borderRadius, свой: cw.appearance,
      налезает: Math.round(n.getBoundingClientRect().right) <= Math.round(sw.getBoundingClientRect().left) };
  });
  ok('строка — ряд, а не блок', S.раскладка === 'flex' && S.зазор !== 'normal', S);
  ok('название раздела набрано как название, а не капсом', S.регистр === 'none' && S.имя === 'Финансы', S);
  ok('переключатель — переключатель, а не квадратик по умолчанию',
    S.свой === 'none' && S.ширинаПереключателя >= 30 && /999|9999/.test(S.кругл), S);
  ok('название, состояние и переключатель идут в этом порядке и не налезают',
    S.порядок.join(',') === 'agmod-n,agmod-s,переключатель' && S.налезает === true, S);

  console.log('\n[F] окно правки агентства помещается на экран ноутбука');
  /* Полей в окне девять плюс блок разделов. На экране 900 пикселей окно
     переставало помещаться, и кнопки «Отмена» и «Сохранить» уезжали за
     нижний край: человек не видел, чем закончить. */
  const W = await page.evaluate(() => {
    const ov = document.getElementById('ov-agency');
    document.getElementById('f-mods-fld').style.display = '';
    agModsRender({ finance: true });
    ov.classList.add('on');
    const m = ov.querySelector('.modal'), b = m.querySelector('.modal-b'), f = m.querySelector('.modal-f');
    const rm = m.getBoundingClientRect(), rf = f.getBoundingClientRect();
    return { окно: Math.round(rm.height), экран: window.innerHeight,
      низКнопок: Math.round(rf.bottom), кнопкиВидны: rf.bottom <= window.innerHeight,
      телоПрокручивается: getComputedStyle(b).overflowY,
      шапкаНеЖмётся: getComputedStyle(m.querySelector('.modal-h')).flexGrow };
  });
  ok('окно не выше экрана', W.окно <= W.экран, W);
  ok('кнопки «Отмена» и «Сохранить» видны без прокрутки страницы', W.кнопкиВидны === true, W);
  ok('прокручивается тело окна, а не всё окно целиком',
    W.телоПрокручивается === 'auto' || W.телоПрокручивается === 'scroll', W);

  console.log('\n[G] собственный кабинет владельца — не выручка платформы');
  /* Тариф собственному агентству нужен ради лимитов, но платить самому себе
     нельзя. Пока такие кабинеты считались наравне с клиентскими, платформа
     показывала доход, которого не существует, и портила себе и MRR, и
     средний чек, и «сколько платящих». */
  const O = await page.evaluate(() => {
    TARIFFS.length = 0; TARIFFS.push({ key: 'p1', price: 299000 }, { key: 'p2', price: 159000 });
    AGENCIES.length = 0;
    AGENCIES.push({ id: 'a1', name: 'Своё', plan: 'p1', status: 'active', mrr: 0, isOwn: true });
    AGENCIES.push({ id: 'a2', name: 'Клиент', plan: 'p2', status: 'active', mrr: 0, isOwn: false });
    agEnrichMrr();
    const до = { своё: AGENCIES[0].mrr, клиент: AGENCIES[1].mrr,
      платящих: payingCount(AGENCIES), mrr: platMrr(AGENCIES) };
    /* Сняли признак — кабинет снова считается клиентским. */
    AGENCIES[0].isOwn = false; delete AGENCIES[0]._mrrDb; agEnrichMrr();
    return { до, послеСнятия: AGENCIES[0].mrr, платящихПосле: payingCount(AGENCIES) };
  });
  ok('своему кабинету выручка не начисляется', O.до.своё === 0, O.до);
  ok('а клиентскому — по цене его тарифа', O.до.клиент === 159000, O.до);
  ok('в MRR платформы и в «платящих» своё не попадает',
    O.до.mrr === 159000 && O.до.платящих === 1, O.до);
  ok('признак снимается — кабинет снова считается клиентом',
    O.послеСнятия === 299000 && O.платящихПосле === 2, O);

  const OF = await page.evaluate(() => {
    const c = document.getElementById('f-own');
    if (!c) return { нет: true };
    c.checked = true; agOwnSync();
    const вкл = { знач: agOwnValue(), подпись: document.getElementById('f-own-s').textContent,
      класс: c.closest('.agmod-r').classList.contains('on') };
    c.checked = false; agOwnSync();
    return { вкл, выкл: { знач: agOwnValue(), подпись: document.getElementById('f-own-s').textContent } };
  });
  ok('признак переключается из окна агентства, а не только в базе',
    OF.вкл && OF.вкл.знач === true && OF.выкл.знач === false, OF);
  ok('и подписан словами, а не одной галочкой',
    OF.вкл.подпись === 'наше' && OF.выкл.подпись === 'клиент' && OF.вкл.класс === true, OF);

  /* Признак живёт в базе, а считается в интерфейсе: если он потеряется по
     дороге, выручка молча вернётся — цифра неверная, а видимых поломок нет. */
  const MAP = await page.evaluate(() => {
    const c = { emp: {}, cl: {}, pr: {}, seen: {}, online: {} };
    return { своё: mapAgency({ id: 'x', name: 'n', slug: 's', plan: 'p', status: 'active', is_own: true }, c).isOwn,
      клиент: mapAgency({ id: 'y', name: 'n', slug: 's', plan: 'p', status: 'active', is_own: false }, c).isOwn,
      безПоля: mapAgency({ id: 'z', name: 'n', slug: 's', plan: 'p', status: 'active' }, c).isOwn };
  });
  ok('признак доезжает из базы в интерфейс и не выдумывается',
    MAP.своё === true && MAP.клиент === false && MAP.безПоля === false, MAP);

  /* И уезжает обратно: окно, которое показывает переключатель, но не пишет
     его в базу, — худший вид поломки: человек уверен, что сохранил. */
  const SAVE = await page.evaluate(() => {
    const было = window.LIVE, ту = window.tUpdateAgency;
    let патч = null;
    window.LIVE = true; window.tUpdateAgency = (id, p) => { патч = p; };
    AGENCIES.length = 0;
    AGENCIES.push({ id: 'a9', name: 'Своё', slug: 'own', plan: 'p1', status: 'active',
      mrr: 0, isOwn: false, accent: '#37E6C8', logoUrl: '', vertical: '—', owner: 'o', modules: {} });
    openAgency('a9');
    document.getElementById('f-own').checked = true; agOwnSync();
    saveAgency();
    window.LIVE = было; window.tUpdateAgency = ту;
    return { есть: патч && Object.prototype.hasOwnProperty.call(патч, 'is_own'), знач: патч && патч.is_own };
  });
  ok('переключатель уезжает в базу вместе с остальными полями',
    SAVE.есть === true && SAVE.знач === true, SAVE);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
